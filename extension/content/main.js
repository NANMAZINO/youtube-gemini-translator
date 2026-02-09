// content/main.js - 메인 컨트롤러 모듈
import { extractCaptions, chunkTranscript } from './captions.js';
import { getFromCache, saveToCache, getCacheCount, clearCache } from './cache.js';
import { prepareRenderingContainer, appendStreamingResults, showNotification, setExportData, showProgressToast, clearUI } from './ui.js';
import { getVideoId, parseTimestamp } from './utils.js';

const TRANSLATE_BUTTON_ID = 'yt-ai-translate-btn';
const SCRIPT_PANEL_SELECTOR = 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';

let currentVideoId = null;
let pollInterval = null;

// 초기화
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_CACHE_COUNT') {
    getCacheCount().then(count => sendResponse({ count }));
    return true;
  }
  if (request.type === 'GET_ALL_CACHE') {
    import('./cache.js').then(module => module.getAllCacheMetadata()).then(list => sendResponse({ list }));
    return true;
  }
  if (request.type === 'DELETE_CACHE') {
    import('./cache.js').then(module => module.deleteFromCache(request.payload.videoId)).then(res => {
      const videoId = getVideoId();
      chrome.storage.local.get(['targetLang'], (settings) => {
        const currentLang = settings.targetLang || '한국어';
        if (request.payload.videoId === `${videoId}_${currentLang}`) {
          clearUI();
        }
      });
      sendResponse(res);
    });
    return true;
  }
  if (request.type === 'CLEAR_CACHE') {
    clearCache().then(() => {
      clearUI();
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.type === 'GET_CACHE_SIZE') {
    import('./cache.js').then(module => module.getCacheStorageSize()).then(size => sendResponse({ size }));
    return true;
  }
});

window.addEventListener('yt-navigate-finish', () => {
  const videoId = getVideoId();
  if (videoId !== currentVideoId) {
    currentVideoId = videoId;
    clearUI(); // 무조건 청소 (홈으로 가는 경우 포함)
    if (videoId) initPageAction();
  }
});

// 첫 실행 시 (정적 로드 대응)
if (getVideoId()) {
  currentVideoId = getVideoId();
  initPageAction();
}

function initPageAction() {
  waitForTranscriptPanel();
}



function waitForTranscriptPanel() {
  if (pollInterval) clearInterval(pollInterval);
  // 주기적으로 패널 감시해서 버튼 주입
  pollInterval = setInterval(() => {
    const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
    if (panel) injectTranslateButton(panel);
  }, 1000);
}

function injectTranslateButton(panel) {
  if (document.getElementById(TRANSLATE_BUTTON_ID)) return;
  const button = document.createElement('button');
  button.id = TRANSLATE_BUTTON_ID;
  button.textContent = '🤖 AI 번역';
  button.className = 'yt-ai-translate-button'; // 스타일은 manifest injection css 권장
  
  Object.assign(button.style, {
    padding: '8px 16px', margin: '8px', backgroundColor: '#065fd4', color: 'white',
    border: 'none', borderRadius: '18px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
  });

  button.onclick = () => handleTranslateClick(button);
  const header = panel.querySelector('#header') || panel;
  header.appendChild(button);
}

async function handleTranslateClick(button) {
  try {
    const { hasKey } = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });
    if (!hasKey) return showNotification('API Key를 설정해주세요.', 'error');

    button.disabled = true;
    const captions = await extractCaptions();
    if (!captions) return finalizeClick(button, '자막을 찾을 수 없습니다.', 'error');

    const videoId = getVideoId();
    const { targetLang } = await chrome.storage.local.get(['targetLang']);
    const cached = await getFromCache(videoId, targetLang || '한국어');
    
    if (cached) return renderFromCache(button, cached, targetLang || '한국어');

    await executeTranslation(button, videoId, captions);
  } catch (err) {
    // 에러 메시지 세분화
    const msg = err.message === 'MODEL_OVERLOADED' ? '서버가 너무 바쁩니다. 잠시 후 다시 시도해주세요.'
              : err.message === 'QUOTA_EXCEEDED' ? 'API 할당량 초과. 내일 다시 시도해주세요'
              : '번역 실패';
    showNotification(msg, 'error');
    finalizeClick(button);
  }
}

async function ensureUIReady() {
  let shadow = prepareRenderingContainer();
  if (shadow) return shadow;

  // 최대 10초 대기 (500ms * 20회)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    shadow = prepareRenderingContainer();
    if (shadow) return shadow;
    
    // 로그만 남기고 재귀 호출은 하지 않음 (무한 루프 방지)
    if (i === 10) {
      console.log('[YT-AI] UI container still missing after 5 seconds...');
    }
  }
  return null;
}

async function renderFromCache(button, cached, targetLang) {
  const shadow = await ensureUIReady();
  if (shadow) {
    appendStreamingResults(cached);
    setExportData(cached, getVideoId());
    finalizeClick(button, `✓ ${targetLang} 번역 불러옴 (캐시)`, 'success');
  } else {
    finalizeClick(button, 'UI 컨테이너를 준비하지 못했습니다.', 'error');
  }
}

async function executeTranslation(button, videoId, captions) {
  const chunks = chunkTranscript(captions);
  const total = chunks.length;
  const { targetLang, sourceLang, thinkingLevel } = await chrome.storage.local.get(['targetLang', 'sourceLang', 'thinkingLevel']);
  
  const shadow = await ensureUIReady();
  if (!shadow) return showNotification('영상 스크립트 데이터를 불러오지 못했습니다.', 'error');

  // 즉각적인 피드백 제공
  button.textContent = `🔄 준비 중 (0/${total})...`;
  showProgressToast(0, total, '🔄 AI가 자막 맥락 분석 중...');
  
  const fullTranslations = [];

  const listener = (msg) => {
    if (msg.type === 'TRANSLATION_CHUNK_DONE' && msg.payload.videoId === videoId) {
      const { current, total, translations } = msg.payload;
      button.textContent = `🔄 번역 중 (${Math.round((current / total) * 100)}%)...`;
      showProgressToast(current, total);
      
      // 중복 제거 생략 (기존 로직 유지)
      let filtered = translations;
      if (fullTranslations.length > 0) {
        const lastTimestamp = parseTimestamp(fullTranslations[fullTranslations.length - 1].start);
        filtered = translations.filter(t => parseTimestamp(t.start) > lastTimestamp);
      }
      if (filtered.length === 0) return;
      fullTranslations.push(...filtered);
      
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
      const { current, total, retryCount } = msg.payload;
      button.textContent = `⏳ 재시도 (${current}/${total})...`;
      showProgressToast(current, total, `⚠️ [${current}/${total}] 서버 응답 지연으로 재시도 중... (${retryCount}/3)`);
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
        stream: true 
      }
    });

    if (response && response.success) {
      await saveToCache(videoId, fullTranslations, {
        title: document.title.replace(' - YouTube', ''),
        sourceLang: sourceLang || 'Auto',
        targetLang: targetLang || '한국어'
      });
      setExportData(fullTranslations, videoId);
      showNotification('번역 완료', 'success');
    } else {
      const errorMsg = response?.error || '알 수 없는 오류';
      console.error('[YT-AI-Translator] 번역 실패:', errorMsg);
      showNotification(`번역 실패: ${errorMsg}`, 'error');
      showProgressToast(0, 0, 'HIDE'); // 실패 시 토스트 강제 제거
    }
  } catch (err) {
    console.error('[YT-AI-Translator] 통신 오류:', err);
    showNotification(`통신 오류: ${err.message}`, 'error');
    showProgressToast(0, 0, 'HIDE');
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
    finalizeClick(button);
  }
}

function finalizeClick(button, msg, type) {
  button.disabled = false;
  button.textContent = '🤖 AI 번역';
  if (msg) showNotification(msg, type);
}
