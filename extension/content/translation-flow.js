// content/translation-flow.js
// Translation/refine flow orchestration for content script UI.
import {
  UI_RETRY_COUNT,
  UI_RETRY_INTERVAL_MS,
  CRAWL_INTERVAL_SEC,
  PROGRESS_TIMER_INTERVAL_MS,
} from '../lib/constants.js';

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
  RE_SPLIT_BUTTON_ID,
  log,
}) {
  const UI_RETRY_WARN_AT = Math.floor(UI_RETRY_COUNT / 2);
  let updateToggleBtnState = () => {};

  const getFingerprint =
    typeof buildTranscriptFingerprint === 'function'
      ? buildTranscriptFingerprint
      : () => '00000000';
  const savePartial =
    typeof savePartialTranslation === 'function'
      ? savePartialTranslation
      : async (videoId, translations, metadata) => saveToCache(videoId, translations, metadata);

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
      message.includes('The message port closed before a response was received') ||
      message.includes('Receiving end does not exist') ||
      message.includes('Extension context invalidated')
    );
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

  function clampChunkIndex(value, totalChunks) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(Math.floor(parsed), totalChunks));
  }

  function findResumeStartChunkByTimestamp(chunks, lastSavedStartSec) {
    if (!Array.isArray(chunks) || chunks.length === 0) return 0;
    if (!Number.isFinite(lastSavedStartSec)) return 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      if (!Array.isArray(chunk) || chunk.length === 0) continue;

      let maxStartSec = -Infinity;
      for (const segment of chunk) {
        const startSec = parseTimestamp(segment?.start);
        if (startSec > maxStartSec) maxStartSec = startSec;
      }

      if (maxStartSec > lastSavedStartSec) {
        return chunkIndex;
      }
    }

    return -1;
  }

  function buildSourceChunkCheckpoints(chunks) {
    if (!Array.isArray(chunks)) return [];

    return chunks.map((chunk, chunkIndex) => {
      const safeChunk = Array.isArray(chunk) ? chunk : [];
      let firstStartSec = null;
      let lastStartSec = null;

      for (const segment of safeChunk) {
        const startSec = parseTimestamp(segment?.start);
        if (!Number.isFinite(startSec)) continue;
        if (firstStartSec === null || startSec < firstStartSec) {
          firstStartSec = startSec;
        }
        if (lastStartSec === null || startSec > lastStartSec) {
          lastStartSec = startSec;
        }
      }

      return {
        chunkIndex,
        chunkFingerprint: getFingerprint(safeChunk),
        firstStartSec,
        lastStartSec,
        segmentCount: safeChunk.length,
      };
    });
  }

  function resolveResumeFromSourceCheckpoints(
    cachedCheckpoints,
    currentCheckpoints,
    completedChunkCount,
    currentTotalChunks,
  ) {
    if (!Array.isArray(cachedCheckpoints) || cachedCheckpoints.length === 0) {
      return { startChunkIndex: -1, reason: 'no-cached-checkpoints' };
    }

    const normalizedCompletedCount = clampChunkIndex(completedChunkCount ?? 0, cachedCheckpoints.length);
    if (normalizedCompletedCount === 0) {
      return { startChunkIndex: 0, reason: 'zero-completed-count' };
    }

    const lastCompletedCheckpoint = cachedCheckpoints[normalizedCompletedCount - 1];
    if (!lastCompletedCheckpoint) {
      return { startChunkIndex: -1, reason: 'missing-last-checkpoint' };
    }

    const matchedByFingerprintIndex = currentCheckpoints.findIndex(
      (checkpoint) =>
        checkpoint?.chunkFingerprint &&
        checkpoint.chunkFingerprint === lastCompletedCheckpoint.chunkFingerprint,
    );
    if (matchedByFingerprintIndex >= 0) {
      return {
        startChunkIndex: clampChunkIndex(matchedByFingerprintIndex + 1, currentTotalChunks),
        reason: 'fingerprint-match',
      };
    }

    const lastSourceEndSec = Number(lastCompletedCheckpoint.lastStartSec);
    if (Number.isFinite(lastSourceEndSec)) {
      const matchedBySourceTimeIndex = currentCheckpoints.findIndex(
        (checkpoint) => Number(checkpoint?.lastStartSec) > lastSourceEndSec,
      );
      if (matchedBySourceTimeIndex >= 0) {
        return {
          startChunkIndex: clampChunkIndex(matchedBySourceTimeIndex, currentTotalChunks),
          reason: 'source-time-fallback',
        };
      }
    }

    return { startChunkIndex: -1, reason: 'checkpoint-fallback-failed' };
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

  async function renderFromCache(button, cached, targetLang) {
    const shadow = await ensureUIReady();
    if (shadow) {
      const container = shadow.getElementById('streaming-content');
      if (container) container.replaceChildren();
      appendStreamingResults(cached);
      setExportData(cached, getVideoId());
      updateToggleBtnState();
      finalizeClick(button, `${targetLang} 번역을 캐시에서 불러왔습니다.`, 'success');
    } else {
      finalizeClick(button, '번역 UI를 준비하지 못했습니다.', 'error');
    }
  }

  async function executeTranslation(
    button,
    videoId,
    captions,
    videoTitle,
    targetLang,
    rawCaptions,
    resumeOptions = {},
  ) {
    const chunks = chunkTranscript(captions);
    const sourceChunkCheckpoints = buildSourceChunkCheckpoints(chunks);
    const total = chunks.length;
    const taskId = createTaskId('translate');
    const { sourceLang, thinkingLevel } = await chrome.storage.local.get([
      'sourceLang',
      'thinkingLevel',
    ]);

    const normalizedStartChunkIndex = clampChunkIndex(resumeOptions.startChunkIndex ?? 0, total);
    const initialPreviousContext = resumeOptions.initialPreviousContext || '';
    const initialTranslations = Array.isArray(resumeOptions.initialTranslations)
      ? [...resumeOptions.initialTranslations]
      : [];
    const transcriptFingerprint = resumeOptions.transcriptFingerprint || '';

    const shadow = await ensureUIReady();
    if (!shadow) {
      finalizeClick(button, '번역 UI를 준비하지 못했습니다.', 'error');
      return;
    }

    if (normalizedStartChunkIndex === 0 && initialTranslations.length === 0) {
      const container = shadow.getElementById('streaming-content');
      if (container) container.replaceChildren();
    }

    button.textContent = `준비 중 (${normalizedStartChunkIndex}/${total})...`;

    const fullTranslations = [...initialTranslations];
    let partialIndexRegistered = normalizedStartChunkIndex > 0 || fullTranslations.length > 0;
    let partialSaveQueue = Promise.resolve();
    let currentDisplayPercent = total > 0 ? Math.round((normalizedStartChunkIndex / total) * 100) : 100;
    let lastRealPercent = currentDisplayPercent;
    let isRetrying = false;
    const startTime = Date.now();

    const savePartialSnapshot = (completedChunkCount) => {
      partialSaveQueue = partialSaveQueue
        .catch(() => {})
        .then(async () => {
          const normalizedCompletedCount = clampChunkIndex(completedChunkCount, sourceChunkCheckpoints.length);
          const metadata = {
            title: videoTitle,
            sourceLang: sourceLang || 'Auto',
            targetLang: targetLang || DEFAULT_TARGET_LANG,
            isRefined: false,
            isPartial: true,
            completedChunkCount,
            transcriptFingerprint,
            sourceChunkCheckpoints: sourceChunkCheckpoints.slice(0, normalizedCompletedCount),
          };

          if (!partialIndexRegistered) {
            await saveToCache(videoId, fullTranslations, metadata);
            partialIndexRegistered = true;
            return;
          }
          await savePartial(videoId, fullTranslations, metadata);
        })
        .catch((error) => {
          log.error('부분 저장 실패:', error);
        });
    };

    const updateProgressUI = () => {
      if (getVideoId() !== videoId || isRetrying) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      button.textContent = `번역 중 (${currentDisplayPercent}%) [${elapsed}s]`;
    };

    let crawlCounter = 0;
    let lastRetryInfo = null;
    const timerInterval = setInterval(() => {
      if (getVideoId() !== videoId) return;

      if (isRetrying && lastRetryInfo) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        button.textContent = `재시도 중 (${lastRetryInfo.current}/${lastRetryInfo.total})... [${elapsed}s]`;
        return;
      }

      crawlCounter += 1;
      if (crawlCounter >= CRAWL_INTERVAL_SEC) {
        crawlCounter = 0;
        const chunkWeight = total > 0 ? 100 / total : 100;
        const nextTargetCap = Math.floor(lastRealPercent + chunkWeight) - 1;
        if (currentDisplayPercent < nextTargetCap) {
          currentDisplayPercent += 1;
        }
      }
      updateProgressUI();
    }, PROGRESS_TIMER_INTERVAL_MS);

    const listener = (msg) => {
      const payload = msg?.payload;
      if (!payload || payload.videoId !== videoId || payload.taskId !== taskId) return;

      if (msg.type === 'TRANSLATION_CHUNK_DONE') {
        const { current, total: chunkTotal, translations } = payload;
        isRetrying = false;
        lastRetryInfo = null;

        lastRealPercent = Math.round((current / chunkTotal) * 100);
        currentDisplayPercent = lastRealPercent;
        updateProgressUI();

        let filtered = Array.isArray(translations) ? translations : [];
        if (fullTranslations.length > 0) {
          const lastTimestamp = parseTimestamp(fullTranslations[fullTranslations.length - 1].start);
          filtered = filtered.filter((item) => parseTimestamp(item.start) > lastTimestamp);
        }
        if (filtered.length > 0) {
          fullTranslations.push(...filtered);
        }

        savePartialSnapshot(current);

        if (getVideoId() !== videoId) return;

        const currentShadow = prepareRenderingContainer();
        if (currentShadow) {
          const container = currentShadow.getElementById('streaming-content');
          if (container && container.children.length === 0 && fullTranslations.length > 0) {
            appendStreamingResults(fullTranslations);
          } else if (filtered.length > 0) {
            appendStreamingResults(filtered);
          }
        }
        return;
      }

      if (msg.type === 'TRANSLATION_RETRYING') {
        isRetrying = true;
        lastRetryInfo = { current: payload.current, total: payload.total };
        if (getVideoId() === videoId) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          button.textContent = `재시도 중 (${payload.current}/${payload.total})... [${elapsed}s]`;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        payload: {
          taskId,
          chunks,
          targetLang: targetLang || DEFAULT_TARGET_LANG,
          sourceLang: sourceLang || 'Auto',
          thinkingLevel: thinkingLevel || 'minimal',
          videoId,
          stream: true,
          startChunkIndex: normalizedStartChunkIndex,
          initialPreviousContext,
        },
      });

      if (response?.aborted) {
        log.info(`번역 중단됨: videoId=${videoId}, taskId=${taskId}`);
        updateExtRefineButton(false);
        await partialSaveQueue;
        return;
      }

      if (response?.success) {
        await partialSaveQueue;

        const translations =
          fullTranslations.length > 0 ? fullTranslations : response.translations || [];

        await saveToCache(videoId, translations, {
          title: videoTitle,
          sourceLang: sourceLang || 'Auto',
          targetLang: targetLang || DEFAULT_TARGET_LANG,
          isRefined: false,
          isPartial: false,
          completedChunkCount: chunks.length,
          transcriptFingerprint,
          sourceChunkCheckpoints,
        });

        setExportData(translations, videoId);
        updateToggleBtnState();
        showNotification('번역 완료', 'success');
        updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, translations));
      } else {
        const errorMsg = response?.error || '알 수 없는 오류';
        log.error('번역 실패:', errorMsg);
        showNotification(`번역 실패: ${errorMsg}`, 'error');
        updateExtRefineButton(false);
      }
    } catch (error) {
      if (isPortClosedError(error)) {
        log.info(`번역 채널 종료됨: videoId=${videoId}, taskId=${taskId}`);
        return;
      }
      log.error('번역 메시지 통신 실패:', error);
      showNotification(`통신 오류: ${error.message}`, 'error');
      updateExtRefineButton(false);
    } finally {
      isRetrying = false;
      clearInterval(timerInterval);
      chrome.runtime.onMessage.removeListener(listener);
      finalizeClick(button);
    }
  }

  async function handleTranslateClick(button) {
    try {
      const { hasKey } = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });
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
        finalizeClick(button, '자막이 비어 있어 번역을 진행할 수 없습니다.', 'error');
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
          updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, cached.translations));
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
          await executeTranslation(
            button,
            videoId,
            captions,
            videoTitle,
            currentLang,
            rawCaptions,
            { transcriptFingerprint },
          );
          return;
        }

        const initialTranslations = Array.isArray(cached.translations) ? cached.translations : [];
        const chunks = chunkTranscript(captions);
        const currentSourceChunkCheckpoints = buildSourceChunkCheckpoints(chunks);
        let startChunkIndex = 0;
        let effectiveInitialTranslations = initialTranslations;

        if (cached.transcriptFingerprint && cached.transcriptFingerprint === transcriptFingerprint) {
          startChunkIndex = clampChunkIndex(cached.completedChunkCount ?? 0, chunks.length);
        } else {
          const cachedCheckpoints = Array.isArray(cached.sourceChunkCheckpoints)
            ? cached.sourceChunkCheckpoints
            : [];
          const resolvedByCheckpoint = resolveResumeFromSourceCheckpoints(
            cachedCheckpoints,
            currentSourceChunkCheckpoints,
            cached.completedChunkCount,
            chunks.length,
          );

          if (resolvedByCheckpoint.startChunkIndex >= 0) {
            startChunkIndex = resolvedByCheckpoint.startChunkIndex;
            log.info(
              `자막 fingerprint 불일치. 원본 청크 체크포인트 재개: videoId=${videoId}, startChunkIndex=${startChunkIndex}, reason=${resolvedByCheckpoint.reason}`,
            );
            showNotification(
              '자막 변경이 감지되어 원본 청크 체크포인트 기준으로 이어받기를 시도합니다.',
              'info',
            );
          } else {
            const lastSavedStartRaw = initialTranslations.at(-1)?.start;
            const fallbackChunkIndex =
              typeof lastSavedStartRaw === 'string' && lastSavedStartRaw.trim() !== ''
                ? findResumeStartChunkByTimestamp(chunks, parseTimestamp(lastSavedStartRaw))
                : -1;

            if (fallbackChunkIndex < 0) {
              startChunkIndex = 0;
              effectiveInitialTranslations = [];
            } else {
              startChunkIndex = clampChunkIndex(fallbackChunkIndex, chunks.length);
            }

            log.info(
              `자막 fingerprint 불일치. 구형 timestamp fallback 재개: videoId=${videoId}, startChunkIndex=${startChunkIndex}`,
            );
            showNotification(
              '자막 변경이 감지되어 재개 위치를 다시 계산합니다.',
              'info',
            );
          }
        }

        const rendered = await renderCachedTranslationsOnly(effectiveInitialTranslations, videoId);
        if (!rendered) {
          finalizeClick(button, '번역 UI를 준비하지 못했습니다.', 'error');
          return;
        }

        const initialPreviousContext = effectiveInitialTranslations
          .slice(-3)
          .map((item) => item.text)
          .join(' ');

        await executeTranslation(
          button,
          videoId,
          captions,
          videoTitle,
          currentLang,
          rawCaptions,
          {
            startChunkIndex,
            initialPreviousContext,
            initialTranslations: effectiveInitialTranslations,
            transcriptFingerprint,
          },
        );
        return;
      }

      await executeTranslation(
        button,
        videoId,
        captions,
        videoTitle,
        currentLang,
        rawCaptions,
        { transcriptFingerprint },
      );
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
        if (!payload || payload.videoId !== videoId || payload.taskId !== taskId) return;
        if (payload.phase !== 'refine') return;

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        updateExtRefineButton(
          false,
          null,
          `재분할 재시도 중 (${payload.retryCount})... [${elapsed}s]`,
        );
      };
      chrome.runtime.onMessage.addListener(retryListener);

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
