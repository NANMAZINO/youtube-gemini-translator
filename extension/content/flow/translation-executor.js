// content/translation-executor.js
// 번역 실행 세션(스트리밍/진행률/부분저장) 전용 모듈
import {
  CRAWL_INTERVAL_SEC,
  PROGRESS_TIMER_INTERVAL_MS,
} from '../../core/constants.js';
import { buildSourceChunkCheckpoints, clampChunkIndex } from './resume-resolver.js';

export function createTranslationExecutor({
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
  updateToggleBtnState,
  updateExtRefineButton,
  createTaskId,
  isPortClosedError,
  openKeepAlivePort,
  closeKeepAlivePort,
  log,
  defaultTargetLang = '한국어',
}) {
  const savePartial =
    typeof savePartialTranslation === 'function'
      ? savePartialTranslation
      : async (videoId, translations, metadata) =>
          saveToCache(videoId, translations, metadata);

  function finalizeClick(button, msg, type) {
    if (button) {
      button.disabled = false;
      button.textContent = 'AI 번역';
    }
    if (msg) showNotification(msg, type);
  }

  async function executeTranslation({
    button,
    videoId,
    captions,
    videoTitle,
    targetLang,
    rawCaptions,
    resumeOptions = {},
    onRefine,
  }) {
    const chunks = chunkTranscript(captions);
    const sourceChunkCheckpoints = buildSourceChunkCheckpoints(
      chunks,
      parseTimestamp,
      getFingerprint,
    );
    const total = chunks.length;
    const taskId = createTaskId('translate');
    const { sourceLang, thinkingLevel } = await chrome.storage.local.get([
      'sourceLang',
      'thinkingLevel',
    ]);

    const normalizedStartChunkIndex = clampChunkIndex(
      resumeOptions.startChunkIndex ?? 0,
      total,
    );
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
    let partialIndexRegistered =
      normalizedStartChunkIndex > 0 || fullTranslations.length > 0;
    let partialSaveQueue = Promise.resolve();
    let currentDisplayPercent =
      total > 0 ? Math.round((normalizedStartChunkIndex / total) * 100) : 100;
    let lastRealPercent = currentDisplayPercent;
    let isRetrying = false;
    const startTime = Date.now();

    const savePartialSnapshot = (completedChunkCount) => {
      partialSaveQueue = partialSaveQueue
        .catch(() => {})
        .then(async () => {
          const normalizedCompletedCount = clampChunkIndex(
            completedChunkCount,
            sourceChunkCheckpoints.length,
          );
          const metadata = {
            title: videoTitle,
            sourceLang: sourceLang || 'Auto',
            targetLang: targetLang || defaultTargetLang,
            isRefined: false,
            isPartial: true,
            completedChunkCount: normalizedCompletedCount,
            transcriptFingerprint,
            sourceChunkCheckpoints: sourceChunkCheckpoints.slice(
              0,
              normalizedCompletedCount,
            ),
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
      if (!payload || payload.videoId !== videoId || payload.taskId !== taskId) {
        return;
      }

      if (msg.type === 'TRANSLATION_CHUNK_DONE') {
        const { current, total: chunkTotal, translations } = payload;
        isRetrying = false;
        lastRetryInfo = null;

        lastRealPercent = Math.round((current / chunkTotal) * 100);
        currentDisplayPercent = lastRealPercent;
        updateProgressUI();

        let filtered = Array.isArray(translations) ? translations : [];
        if (fullTranslations.length > 0) {
          const lastTimestamp = parseTimestamp(
            fullTranslations[fullTranslations.length - 1].start,
          );
          filtered = filtered.filter(
            (item) => parseTimestamp(item.start) > lastTimestamp,
          );
        }
        if (filtered.length > 0) {
          fullTranslations.push(...filtered);
        }

        savePartialSnapshot(current);

        if (getVideoId() !== videoId) return;

        const currentShadow = prepareRenderingContainer();
        if (currentShadow) {
          const container = currentShadow.getElementById('streaming-content');
          if (
            container &&
            container.children.length === 0 &&
            fullTranslations.length > 0
          ) {
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
    const keepAlivePort = openKeepAlivePort();
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        payload: {
          taskId,
          chunks,
          targetLang: targetLang || defaultTargetLang,
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
          fullTranslations.length > 0
            ? fullTranslations
            : response.translations || [];

        await saveToCache(videoId, translations, {
          title: videoTitle,
          sourceLang: sourceLang || 'Auto',
          targetLang: targetLang || defaultTargetLang,
          isRefined: false,
          isPartial: false,
          completedChunkCount: chunks.length,
          transcriptFingerprint,
          sourceChunkCheckpoints,
        });

        setExportData(translations, videoId);
        updateToggleBtnState();
        showNotification('번역 완료', 'success');

        if (typeof onRefine === 'function') {
          updateExtRefineButton(true, () => onRefine(translations));
        } else {
          updateExtRefineButton(false);
        }
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
      closeKeepAlivePort(keepAlivePort);
      finalizeClick(button);
    }
  }

  return {
    executeTranslation,
  };
}
