// content/translation-flow.js
// 번역 실행/스트리밍/재분할 전체 흐름 담당
import {
  UI_RETRY_COUNT,
  UI_RETRY_INTERVAL_MS,
  CRAWL_INTERVAL_SEC,
  PROGRESS_TIMER_INTERVAL_MS,
} from '../lib/constants.js';

export function createTranslationFlow({
  extractCaptions,
  chunkTranscript,
  getFromCache,
  saveToCache,
  prepareRenderingContainer,
  appendStreamingResults,
  showNotification,
  setExportData,
  getVideoId,
  parseTimestamp,
  RE_SPLIT_BUTTON_ID,
  log,
}) {
  const UI_RETRY_WARN_AT = Math.floor(UI_RETRY_COUNT / 2);
  let updateToggleBtnState = () => {};

  function setUpdateToggleBtnState(fn) {
    updateToggleBtnState = typeof fn === 'function' ? fn : () => {};
  }

  /**
   * 유튜브 영상 제목 추출 (다각도 시도)
   */
  function getTitle() {
    const ytTitle =
      document.querySelector('h1.ytd-watch-metadata')?.innerText ||
      document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText ||
      document.title.replace(' - YouTube', '').trim();
    return ytTitle.trim() || 'Unknown Video';
  }

  function finalizeClick(button, msg, type) {
    if (button) {
      button.disabled = false;
      button.textContent = '🤖 AI 번역';
    }
    if (msg) showNotification(msg, type);
  }

  /**
   * 유튜브 패널에 직접 붙은 재분할 버튼 상태 업데이트
   */
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

    // 최대 10초 대기 (UI_RETRY_INTERVAL_MS * UI_RETRY_COUNT)
    for (let i = 0; i < UI_RETRY_COUNT; i++) {
      await new Promise((r) => setTimeout(r, UI_RETRY_INTERVAL_MS));
      shadow = prepareRenderingContainer();
      if (shadow) return shadow;

      if (i === UI_RETRY_WARN_AT) {
        log.warn(`UI 준비 대기 ${UI_RETRY_WARN_AT}회 초과, 계속 시도 중...`);
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
      finalizeClick(button, `✓ ${targetLang} 번역 불러옴 (캐시)`, 'success');
    } else {
      finalizeClick(button, 'UI 컨테이너를 준비하지 못했습니다.', 'error');
    }
  }

  async function executeTranslation(button, videoId, captions, videoTitle, targetLang, rawCaptions) {
    const chunks = chunkTranscript(captions);
    const total = chunks.length;
    const { sourceLang, thinkingLevel } = await chrome.storage.local.get(['sourceLang', 'thinkingLevel']);

    const shadow = await ensureUIReady();
    if (!shadow) return showNotification('영상 스크립트 데이터를 불러오지 못했습니다.', 'error');

    button.textContent = `🔄 준비 중 (0/${total})...`;

    const fullTranslations = [];

    let currentDisplayPercent = 0;
    let lastRealPercent = 0;
    let isRetrying = false;
    const startTime = Date.now();

    const updateProgressUI = () => {
      if (getVideoId() !== videoId || isRetrying) return;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      button.textContent = `🔄 번역 중 (${currentDisplayPercent}%) [${elapsed}s]`;
    };

    let crawlCounter = 0;
    let lastRetryInfo = null;
    const timerInterval = setInterval(() => {
      if (getVideoId() !== videoId) return;

      if (isRetrying && lastRetryInfo) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        button.textContent = `⏳ 재시도 (${lastRetryInfo.current}/${lastRetryInfo.total})... [${elapsed}s]`;
      } else {
        crawlCounter++;
        if (crawlCounter >= CRAWL_INTERVAL_SEC) {
          crawlCounter = 0;
          const chunkWeight = 100 / total;
          const nextTargetCap = Math.floor(lastRealPercent + chunkWeight) - 1;

          if (currentDisplayPercent < nextTargetCap) {
            currentDisplayPercent++;
          }
        }
        updateProgressUI();
      }
    }, PROGRESS_TIMER_INTERVAL_MS);

    const listener = (msg) => {
      if (msg.type === 'TRANSLATION_CHUNK_DONE' && msg.payload.videoId === videoId) {
        const { current, total: chunkTotal, translations } = msg.payload;

        isRetrying = false;
        lastRetryInfo = null;

        lastRealPercent = Math.round((current / chunkTotal) * 100);
        currentDisplayPercent = lastRealPercent;

        updateProgressUI();

        const isCurrentVideo = getVideoId() === videoId;

        let filtered = translations;
        if (fullTranslations.length > 0) {
          const lastTimestamp = parseTimestamp(fullTranslations[fullTranslations.length - 1].start);
          filtered = translations.filter((t) => parseTimestamp(t.start) > lastTimestamp);
        }
        if (filtered.length > 0) {
          fullTranslations.push(...filtered);
        }

        if (!isCurrentVideo || filtered.length === 0) return;

        const shadow = prepareRenderingContainer();
        if (shadow) {
          const container = shadow.getElementById('streaming-content');
          if (container && container.children.length === 0 && fullTranslations.length > 0) {
            appendStreamingResults(fullTranslations);
          } else {
            appendStreamingResults(filtered);
          }
        }
      } else if (msg.type === 'TRANSLATION_RETRYING' && msg.payload.videoId === videoId) {
        isRetrying = true;
        lastRetryInfo = { current: msg.payload.current, total: msg.payload.total };
        if (getVideoId() === videoId) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          button.textContent = `⏳ 재시도 (${msg.payload.current}/${msg.payload.total})... [${elapsed}s]`;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE',
        payload: {
          chunks,
          targetLang: targetLang || '한국어',
          sourceLang: sourceLang || 'Auto',
          thinkingLevel: thinkingLevel || 'minimal',
          videoId,
          stream: true,
        },
      });

      if (response && response.success) {
        await saveToCache(videoId, fullTranslations, {
          title: videoTitle,
          sourceLang: sourceLang || 'Auto',
          targetLang: targetLang || '한국어',
          isRefined: false,
        });
        setExportData(fullTranslations, videoId);
        updateToggleBtnState();
        showNotification('번역 완료', 'success');

        updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, fullTranslations));
      } else {
        const errorMsg = response?.error || '알 수 없는 오류';
        log.error('번역 실패:', errorMsg);
        showNotification(`번역 실패: ${errorMsg}`, 'error');
        updateExtRefineButton(false);
      }
    } catch (err) {
      log.error('통신 오류:', err);
      showNotification(`통신 오류: ${err.message}`, 'error');
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
      if (!hasKey) return showNotification('API Key를 설정해주세요.', 'error');

      const videoTitle = getTitle();

      updateExtRefineButton(false);

      button.disabled = true;
      const videoId = getVideoId();
      const result = await extractCaptions();
      if (!result) return finalizeClick(button, '자막을 찾을 수 없습니다.', 'error');
      const { raw: rawCaptions, grouped: captions } = result;

      const { targetLang } = await chrome.storage.local.get(['targetLang']);
      const currentLang = targetLang || '한국어';
      const cached = await getFromCache(videoId, currentLang);

      if (cached) {
        if (cached.isRefined) {
          updateExtRefineButton(false, null, '✅ 재분할 완료');
        } else if (rawCaptions) {
          updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, cached.translations));
        } else {
          updateExtRefineButton(false);
        }
        return renderFromCache(button, cached.translations, currentLang);
      }

      await executeTranslation(button, videoId, captions, videoTitle, currentLang, rawCaptions);
    } catch (err) {
      const msg =
        err.message === 'MODEL_OVERLOADED'
          ? '서버가 너무 바쁩니다. 잠시 후 다시 시도해주세요.'
          : err.message === 'QUOTA_EXCEEDED'
            ? 'API 할당량 초과. 내일 다시 시도해주세요'
            : '번역 실패';
      showNotification(msg, 'error');
      finalizeClick(button);
    }
  }

  /**
   * 재분할(Refinement) 실행 공정
   */
  async function startRefine(videoId, originalCaptions, draftResults) {
    let timerInterval = null;
    let retryListener = null;
    try {
      const { targetLang, thinkingLevel } = await chrome.storage.local.get(['targetLang', 'thinkingLevel']);
      const currentLang = targetLang || '한국어';

      const startTime = Date.now();
      updateExtRefineButton(false, null, '⏳ 처리 중... [0s]');

      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        updateExtRefineButton(false, null, `⏳ 처리 중... [${elapsed}s]`);
      }, PROGRESS_TIMER_INTERVAL_MS);

      retryListener = (msg) => {
        if (msg.type === 'TRANSLATION_RETRYING' && msg.payload.videoId === videoId && msg.payload.current === '재분할') {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          updateExtRefineButton(false, null, `⏳ 재시도 (${msg.payload.retryCount}회)... [${elapsed}s]`);
        }
      };
      chrome.runtime.onMessage.addListener(retryListener);

      showNotification('자막 재분할을 시작합니다.', 'info');

      const draftText = draftResults.map((t) => t.text).join(' ');

      const response = await chrome.runtime.sendMessage({
        type: 'REFINE_TRANSLATION',
        payload: {
          videoId,
          original: originalCaptions,
          draftText,
          thinkingLevel: thinkingLevel || 'minimal',
        },
      });

      if (response.success) {
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
        showNotification('재분할 및 캐시 업데이트 완료!', 'success');
        updateExtRefineButton(false, null, '✅ 재분할 완료');
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      log.error('Refine failed:', error);
      showNotification('재분할 실패: ' + error.message, 'error');
      updateExtRefineButton(true, null, '❌ 재시도');
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
