// content/translation-flow.js
// Translation/refine flow orchestration for content script UI.
import {
  UI_RETRY_COUNT,
  UI_RETRY_INTERVAL_MS,
  RE_SPLIT_BUTTON_ID,
  PROGRESS_TIMER_INTERVAL_MS,
} from '../../core/constants.js';
import { resolveResumeState } from './resume-resolver.js';
import { createTranslationExecutor } from './translation-executor.js';

const DEFAULT_TARGET_LANG = '한국어';

export function createTranslationFlow({
  extractCaptions,
  chunkTranscript,
  getFromCache,
  saveToCache,
  savePartialTranslation,
  prepareRenderingContainer,
  appendStreamingResults,
  showNotification,
  setExportData,
  getVideoId,
  parseTimestamp,
  buildTranscriptFingerprint,
  log,
}) {
  const UI_RETRY_WARN_AT = Math.floor(UI_RETRY_COUNT / 2);
  let updateToggleBtnState = () => {};

  const getFingerprint =
    typeof buildTranscriptFingerprint === 'function'
      ? buildTranscriptFingerprint
      : () => '00000000';

  function setUpdateToggleBtnState(fn) {
    updateToggleBtnState = typeof fn === 'function' ? fn : () => {};
  }

  function createTaskId(prefix) {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === 'function') {
      return `${prefix}-${randomUUID.call(globalThis.crypto)}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isPortClosedError(error) {
    const message = String(error?.message || error || '');
    return (
      message.includes('message port closed before a response was received') ||
      message.includes(
        'The message port closed before a response was received',
      ) ||
      message.includes(
        'message channel closed before a response was received',
      ) ||
      message.includes('Receiving end does not exist') ||
      message.includes('Extension context invalidated')
    );
  }

  // Keep-alive 포트: 번역/재분할 중 Background SW가 꺼지지 않도록 연결 유지
  function openKeepAlivePort() {
    try {
      return chrome.runtime.connect({ name: 'keep-alive' });
    } catch {
      log.warn('keep-alive 포트 연결 실패 (무시)');
      return null;
    }
  }

  function closeKeepAlivePort(port) {
    try {
      port?.disconnect();
    } catch {
      // 이미 닫혔으면 무시
    }
  }

  function getTitle() {
    const ytTitle =
      document.querySelector('h1.ytd-watch-metadata')?.innerText ||
      document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText ||
      document.title.replace(' - YouTube', '').trim();
    return ytTitle.trim() || '알 수 없는 영상';
  }

  function finalizeClick(button, msg, type) {
    if (button) {
      button.disabled = false;
      button.textContent = 'AI 번역';
    }
    if (msg) showNotification(msg, type);
  }

  async function ensureUIReady() {
    let shadow = prepareRenderingContainer();
    if (shadow) return shadow;

    for (let i = 0; i < UI_RETRY_COUNT; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, UI_RETRY_INTERVAL_MS));
      shadow = prepareRenderingContainer();
      if (shadow) return shadow;

      if (i === UI_RETRY_WARN_AT) {
        log.warn(`UI 준비가 지연되고 있습니다. (${UI_RETRY_WARN_AT}회 경과)`);
      }
    }

    return null;
  }

  async function renderCachedTranslationsOnly(translations, videoId) {
    const shadow = await ensureUIReady();
    if (!shadow) return false;

    const container = shadow.getElementById('streaming-content');
    if (container) container.replaceChildren();
    appendStreamingResults(translations);
    setExportData(translations, videoId);
    updateToggleBtnState();
    return true;
  }

  function updateExtRefineButton(enabled, handler = null, text = null) {
    const btn = document.getElementById(RE_SPLIT_BUTTON_ID);
    if (!btn) return;

    btn.disabled = !enabled;
    if (text) btn.textContent = text;
    if (handler) btn.onclick = handler;
    else if (!enabled) btn.onclick = null;
  }

  async function renderFromCache(button, cached, targetLang) {
    const shadow = await ensureUIReady();
    if (shadow) {
      const container = shadow.getElementById('streaming-content');
      if (container) container.replaceChildren();
      appendStreamingResults(cached);
      setExportData(cached, getVideoId());
      updateToggleBtnState();
      finalizeClick(
        button,
        `${targetLang} 번역을 캐시에서 불러왔습니다.`,
        'success',
      );
    } else {
      finalizeClick(button, '번역 UI를 준비하지 못했습니다.', 'error');
    }
  }

  const translationExecutor = createTranslationExecutor({
    chunkTranscript,
    saveToCache,
    savePartialTranslation,
    prepareRenderingContainer,
    appendStreamingResults,
    showNotification,
    setExportData,
    getVideoId,
    parseTimestamp,
    getFingerprint,
    ensureUIReady,
    updateToggleBtnState: () => updateToggleBtnState(),
    updateExtRefineButton,
    createTaskId,
    isPortClosedError,
    openKeepAlivePort,
    closeKeepAlivePort,
    log,
    defaultTargetLang: DEFAULT_TARGET_LANG,
  });

  async function handleTranslateClick(button) {
    try {
      const { hasKey } = await chrome.runtime.sendMessage({
        type: 'CHECK_API_KEY',
      });
      if (!hasKey) {
        showNotification('API Key를 먼저 설정해주세요.', 'error');
        return;
      }

      const videoTitle = getTitle();
      updateExtRefineButton(false);
      button.disabled = true;

      const videoId = getVideoId();
      const result = await extractCaptions();
      if (!result) {
        finalizeClick(button, '자막을 찾을 수 없습니다.', 'error');
        return;
      }
      const rawCaptions = Array.isArray(result.raw) ? result.raw : [];
      const captions = Array.isArray(result.grouped) ? result.grouped : [];
      if (rawCaptions.length === 0 || captions.length === 0) {
        log.warn(
          `Empty transcript rejected: videoId=${videoId}, raw=${rawCaptions.length}, grouped=${captions.length}`,
        );
        finalizeClick(
          button,
          '자막이 비어 있어 번역을 진행할 수 없습니다.',
          'error',
        );
        return;
      }

      const { targetLang, resumeMode } = await chrome.storage.local.get([
        'targetLang',
        'resumeMode',
      ]);
      const currentLang = targetLang || DEFAULT_TARGET_LANG;
      const isResumeModeEnabled = resumeMode !== false;
      const transcriptFingerprint = getFingerprint(captions);
      const cached = await getFromCache(videoId, currentLang);

      if (cached && !cached.isPartial) {
        if (cached.isRefined) {
          updateExtRefineButton(false, null, '재분할 완료');
        } else if (rawCaptions) {
          updateExtRefineButton(true, () =>
            startRefine(videoId, rawCaptions, cached.translations),
          );
        } else {
          updateExtRefineButton(false);
        }
        await renderFromCache(button, cached.translations, currentLang);
        return;
      }

      if (cached?.isPartial) {
        if (!isResumeModeEnabled) {
          showNotification(
            '진행중 캐시가 있지만 이어받기가 꺼져 있습니다. 처음부터 번역합니다.',
            'info',
          );
          await translationExecutor.executeTranslation({
            button,
            videoId,
            captions,
            videoTitle,
            targetLang: currentLang,
            rawCaptions,
            resumeOptions: { transcriptFingerprint },
            onRefine: (translations) =>
              startRefine(videoId, rawCaptions, translations),
          });
          return;
        }

        const chunks = chunkTranscript(captions);
        const resolvedResume = resolveResumeState({
          cached,
          chunks,
          transcriptFingerprint,
          parseTimestamp,
          getFingerprint,
        });

        if (resolvedResume.usedCheckpointFallback) {
          log.info(
            `자막 fingerprint 불일치. 원본 청크 체크포인트 재개: videoId=${videoId}, startChunkIndex=${resolvedResume.startChunkIndex}, reason=${resolvedResume.reason}`,
          );
          showNotification(
            '자막 변경이 감지되어 원본 청크 체크포인트 기준으로 이어받기를 시도합니다.',
            'info',
          );
        } else if (resolvedResume.usedTimestampFallback) {
          log.info(
            `자막 fingerprint 불일치. timestamp fallback 재개: videoId=${videoId}, startChunkIndex=${resolvedResume.startChunkIndex}, reason=${resolvedResume.reason}`,
          );
          showNotification(
            '자막 변경이 감지되어 재개 위치를 다시 계산합니다.',
            'info',
          );
        }

        const rendered = await renderCachedTranslationsOnly(
          resolvedResume.initialTranslations,
          videoId,
        );
        if (!rendered) {
          finalizeClick(button, '번역 UI를 준비하지 못했습니다.', 'error');
          return;
        }

        const initialPreviousContext = resolvedResume.initialTranslations
          .slice(-3)
          .map((item) => item.text)
          .join(' ');

        await translationExecutor.executeTranslation({
          button,
          videoId,
          captions,
          videoTitle,
          targetLang: currentLang,
          rawCaptions,
          resumeOptions: {
            startChunkIndex: resolvedResume.startChunkIndex,
            initialPreviousContext,
            initialTranslations: resolvedResume.initialTranslations,
            transcriptFingerprint,
          },
          onRefine: (translations) =>
            startRefine(videoId, rawCaptions, translations),
        });
        return;
      }

      await translationExecutor.executeTranslation({
        button,
        videoId,
        captions,
        videoTitle,
        targetLang: currentLang,
        rawCaptions,
        resumeOptions: { transcriptFingerprint },
        onRefine: (translations) => startRefine(videoId, rawCaptions, translations),
      });
    } catch (error) {
      const message =
        error.message === 'MODEL_OVERLOADED'
          ? '서버가 너무 바쁩니다. 잠시 후 다시 시도해주세요.'
          : error.message === 'QUOTA_EXCEEDED'
            ? 'API 할당량 초과. 나중에 다시 시도해주세요.'
            : '번역 실패';
      showNotification(message, 'error');
      finalizeClick(button);
    }
  }

  async function startRefine(videoId, originalCaptions, draftResults) {
    let timerInterval = null;
    let retryListener = null;
    let keepAlivePort = null;
    const taskId = createTaskId('refine');

    const restoreRetryButton = () => {
      updateExtRefineButton(
        true,
        () => startRefine(videoId, originalCaptions, draftResults),
        '재분할 재시도',
      );
    };

    try {
      const { targetLang, thinkingLevel } = await chrome.storage.local.get([
        'targetLang',
        'thinkingLevel',
      ]);
      const currentLang = targetLang || DEFAULT_TARGET_LANG;

      const startTime = Date.now();
      updateExtRefineButton(false, null, '재분할 처리 중... [0s]');

      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        updateExtRefineButton(false, null, `재분할 처리 중... [${elapsed}s]`);
      }, PROGRESS_TIMER_INTERVAL_MS);

      retryListener = (msg) => {
        const payload = msg?.payload;
        if (msg.type !== 'TRANSLATION_RETRYING') return;
        if (
          !payload ||
          payload.videoId !== videoId ||
          payload.taskId !== taskId
        ) {
          return;
        }
        if (payload.phase !== 'refine') return;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        updateExtRefineButton(
          false,
          null,
          `재분할 재시도 중 (${payload.retryCount})... [${elapsed}s]`,
        );
      };
      chrome.runtime.onMessage.addListener(retryListener);
      keepAlivePort = openKeepAlivePort();

      showNotification('재분할을 시작합니다...', 'info');
      const draftText = draftResults.map((item) => item.text).join(' ');

      const response = await chrome.runtime.sendMessage({
        type: 'REFINE_TRANSLATION',
        payload: {
          taskId,
          videoId,
          original: originalCaptions,
          draftText,
          thinkingLevel: thinkingLevel || 'minimal',
        },
      });

      if (response?.aborted) {
        log.info(`재분할 중단됨: videoId=${videoId}, taskId=${taskId}`);
        restoreRetryButton();
        return;
      }

      if (!response?.success) {
        throw new Error(response?.error || '알 수 없는 재분할 오류');
      }

      const shadow = prepareRenderingContainer();
      if (shadow) {
        const container = shadow.getElementById('streaming-content');
        if (container) {
          container.replaceChildren();
          appendStreamingResults(response.translations);
          container.scrollTop = 0;
        }
      }

      await saveToCache(videoId, response.translations, {
        title: getTitle(),
        sourceLang: 'Auto',
        targetLang: currentLang,
        isRefined: true,
      });

      setExportData(response.translations, videoId);
      showNotification('재분할 완료 및 캐시 업데이트!', 'success');
      updateExtRefineButton(false, null, '재분할 완료');
    } catch (error) {
      if (isPortClosedError(error)) {
        log.info(`재분할 채널 종료됨: videoId=${videoId}, taskId=${taskId}`);
        restoreRetryButton();
        return;
      }
      log.error('재분할 실패:', error);
      showNotification(`재분할 실패: ${error.message}`, 'error');
      restoreRetryButton();
    } finally {
      if (timerInterval) clearInterval(timerInterval);
      if (retryListener) chrome.runtime.onMessage.removeListener(retryListener);
      closeKeepAlivePort(keepAlivePort);
    }
  }

  return {
    ensureUIReady,
    renderFromCache,
    handleTranslateClick,
    startRefine,
    updateExtRefineButton,
    getTitle,
    setUpdateToggleBtnState,
  };
}
