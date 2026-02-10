// content/main.js - 메인 컨트롤러 모듈
import { extractCaptions, chunkTranscript } from './captions.js';
import { getFromCache, saveToCache, getCacheCount, clearCache, getAllCacheMetadata, deleteFromCache, getCacheStorageSize } from '../lib/cache.js';
import { 
  prepareRenderingContainer, 
  appendStreamingResults, 
  showNotification, 
  setExportData, 
  clearUI
} from './ui.js';
import { getVideoId, parseTimestamp } from './utils.js';

const TRANSLATE_BUTTON_ID = 'yt-ai-translate-btn';
const RE_SPLIT_BUTTON_ID = 'yt-ai-refine-btn-ext';
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
    getAllCacheMetadata().then(list => sendResponse({ list }));
    return true;
  }
  if (request.type === 'DELETE_CACHE') {
    deleteFromCache(request.payload.videoId).then(res => {
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
    getCacheStorageSize().then(size => sendResponse({ size }));
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
    if (panel && injectTranslateButton(panel)) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }, 1000);
}

function injectTranslateButton(panel) {
  if (document.getElementById(TRANSLATE_BUTTON_ID)) return true;
  
  const container = document.createElement('div');
  container.id = 'yt-ai-btns-container';
  container.style.display = 'flex';
  container.style.gap = '8px';
  container.style.padding = '8px';

  const mainBtn = document.createElement('button');
  mainBtn.id = TRANSLATE_BUTTON_ID;
  mainBtn.textContent = '🤖 AI 번역';
  Object.assign(mainBtn.style, {
    padding: '8px 16px', backgroundColor: '#065fd4', color: 'white',
    border: 'none', borderRadius: '18px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
  });
  mainBtn.onclick = () => handleTranslateClick(mainBtn);

  const refineBtn = document.createElement('button');
  refineBtn.id = RE_SPLIT_BUTTON_ID;
  refineBtn.textContent = '재분할';
  refineBtn.disabled = true;
  Object.assign(refineBtn.style, {
    padding: '8px 14px', backgroundColor: '#444', color: 'white',
    border: 'none', borderRadius: '18px', cursor: 'not-allowed', fontSize: '12px', fontWeight: '500', 
    opacity: '0.5'
  });
  // 초기 클릭은 무시 (handleTranslateClick 이후에 활성화됨)

  container.append(mainBtn, refineBtn);
  const header = panel.querySelector('#header') || panel;
  header.appendChild(container);
  return true;
}

async function handleTranslateClick(button) {
  try {
    const { hasKey } = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });
    if (!hasKey) return showNotification('API Key를 설정해주세요.', 'error');

    // [Title Fix] 번역 버튼 클릭 시점에 제목을 미리 캡처 (SPA 이동 대응)
    const videoTitle = getTitle();

    // 번역 시작 시 재분할 버튼 비활성화
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
      } else {
        // 재분할 안 된 캐시: 원본 자막을 확보하여 재분할 버튼 활성화
        if (rawCaptions) {
          updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, cached.translations));
        } else {
          updateExtRefineButton(false);
        }
      }
      return renderFromCache(button, cached.translations, currentLang);
    }

    await executeTranslation(button, videoId, captions, videoTitle, currentLang, rawCaptions);
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

    }
  }
  return null;
}

async function renderFromCache(button, cached, targetLang) {
  const shadow = await ensureUIReady();
  if (shadow) {
    // 기존 컨텐츠 초기화 후 렌더링 (중복 방지)
    const container = shadow.getElementById('streaming-content');
    if (container) container.innerHTML = '';
    appendStreamingResults(cached);
    setExportData(cached, getVideoId());
    finalizeClick(button, `✓ ${targetLang} 번역 불러옴 (캐시)`, 'success');
  } else {
    finalizeClick(button, 'UI 컨테이너를 준비하지 못했습니다.', 'error');
  }
}

async function executeTranslation(button, videoId, captions, videoTitle, targetLang, rawCaptions) {
  const chunks = chunkTranscript(captions);
  const total = chunks.length;
  const { sourceLang, thinkingLevel } = await chrome.storage.local.get(['sourceLang', 'thinkingLevel']);
  const currentLang = targetLang || '한국어';
  
  const shadow = await ensureUIReady();
  if (!shadow) return showNotification('영상 스크립트 데이터를 불러오지 못했습니다.', 'error');

  // 즉각적인 피드백 제공
  button.textContent = `🔄 준비 중 (0/${total})...`;
  
  const fullTranslations = [];

  let currentPercent = 0;
  const startTime = Date.now();
  const timerInterval = setInterval(() => {
    if (getVideoId() !== videoId) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    button.textContent = `🔄 번역 중 (${currentPercent}%) [${elapsed}s]`;
  }, 1000);

  const listener = (msg) => {
    if (msg.type === 'TRANSLATION_CHUNK_DONE' && msg.payload.videoId === videoId) {
      const { current, total, translations } = msg.payload;
      currentPercent = Math.round((current / total) * 100);
      
      // [Ghost Subtitles Fix] 현재 보고 있는 영상이 아니면 렌더링 무시 (하지만 데이터는 계속 모음)
      const isCurrentVideo = getVideoId() === videoId;

      // 데이터 누적 (나중에 캐시 저장 및 다시 돌아왔을 때 사용을 위해 계속 진행)
      let filtered = translations;
      if (fullTranslations.length > 0) {
        const lastTimestamp = parseTimestamp(fullTranslations[fullTranslations.length - 1].start);
        filtered = translations.filter(t => parseTimestamp(t.start) > lastTimestamp);
      }
      if (filtered.length > 0) {
        fullTranslations.push(...filtered);
      }

      // UI 렌더링 가드
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
      const { current, total, retryCount } = msg.payload;
      if (getVideoId() === videoId) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        button.textContent = `⏳ 재시도 (${current}/${total})... [${elapsed}s]`;
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
        stream: true 
      }
    });

    if (response && response.success) {
      await saveToCache(videoId, fullTranslations, {
        title: videoTitle,
        sourceLang: sourceLang || 'Auto',
        targetLang: targetLang || '한국어',
        isRefined: false // 최초 번역은 refined 아님
      });
      setExportData(fullTranslations, videoId);
      showNotification('번역 완료', 'success');
      
      // [Phase 3] 재분할 버튼 활성화 및 핸들러 등록 (원본 rawCaptions 전달)
      updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, fullTranslations));
    } else {
      const errorMsg = response?.error || '알 수 없는 오류';
      console.error('[YT-AI-Translator] 번역 실패:', errorMsg);
      showNotification(`번역 실패: ${errorMsg}`, 'error');
      updateExtRefineButton(false);
    }
  } catch (err) {
    console.error('[YT-AI-Translator] 통신 오류:', err);
    showNotification(`통신 오류: ${err.message}`, 'error');
    updateExtRefineButton(false);
  } finally {
    clearInterval(timerInterval);
    chrome.runtime.onMessage.removeListener(listener);
    finalizeClick(button);
  }
}

/**
 * 유튜브 영상 제목 추출 (다각도 시도)
 */
function getTitle() {
  const ytTitle = document.querySelector('h1.ytd-watch-metadata')?.innerText 
               || document.querySelector('h1.ytd-video-primary-info-renderer')?.innerText
               || document.title.replace(' - YouTube', '').trim();
  return ytTitle.trim() || 'Unknown Video';
}

function finalizeClick(button, msg, type) {
  button.disabled = false;
  button.textContent = '🤖 AI 번역';
  // 번역 완료 상태 유지 (재분할 버튼은 그대로 둠)
  if (msg) showNotification(msg, type);
}

/**
 * 유튜브 패널에 직접 붙은 재분할 버튼 상태 업데이트
 */
function updateExtRefineButton(enabled, handler = null, text = null) {
  const btn = document.getElementById(RE_SPLIT_BUTTON_ID);
  if (!btn) return;

  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.5';
  btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  btn.style.backgroundColor = enabled ? '#065fd4' : '#444';
  if (text) btn.textContent = text;
  // 활성화 시 핸들러 등록, 비활성화 시 핸들러 제거 (유령 핸들러 방지)
  if (handler) btn.onclick = handler;
  else if (!enabled) btn.onclick = null;
}

// [DEBUG] 캐시 구조 테스트용 (콘솔에서 수동 확인 가능)
// window.getAllCache = getAllCacheMetadata;

// ========================================
// 끗.
// ========================================

/**
 * 재분할(Refinement) 실행 공정
 */
async function startRefine(videoId, originalCaptions, draftResults) {
  let timerInterval = null;
  try {
    const { targetLang, thinkingLevel } = await chrome.storage.local.get(['targetLang', 'thinkingLevel']);
    const currentLang = targetLang || '한국어';
    
    const startTime = Date.now();
    updateExtRefineButton(false, null, '⏳ 처리 중... [0s]');
    
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      updateExtRefineButton(false, null, `⏳ 처리 중... [${elapsed}s]`);
    }, 1000);

    showNotification('자막 재분할을 시작합니다.', 'info');

    // 초안 텍스트 결합
    const draftText = draftResults.map(t => t.text).join(' ');

    const response = await chrome.runtime.sendMessage({
      type: 'REFINE_TRANSLATION',
      payload: {
        videoId,
        original: originalCaptions,
        draftText,
        thinkingLevel: thinkingLevel || 'minimal'
      }
    });

    if (response.success) {
      // UI 초기화 후 재분할 데이터로 다시 그리기 (확실하게 비우고 새로 채움)
      const shadow = prepareRenderingContainer();
      if (shadow) {
        const container = shadow.getElementById('streaming-content');
        if (container) {
          container.innerHTML = ''; // 기존 초안 싹 비우기
          appendStreamingResults(response.translations); // 1:1 매핑된 결과로 다시 채우기
          container.scrollTop = 0; // 최상단으로 이동해서 '바뀌었다'는 시각적 피드백 제공
        }
      }
      
      // 캐시 업데이트
      await saveToCache(videoId, response.translations, {
        title: getTitle(),
        sourceLang: 'Auto',
        targetLang: currentLang,
        isRefined: true // 재분할 완료됨
      });

      setExportData(response.translations, videoId);
      showNotification('재분할 및 캐시 업데이트 완료!', 'success');
      updateExtRefineButton(false, null, '✅ 재분할 완료');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Main] Refine failed:', error);
    showNotification('재분할 실패: ' + error.message, 'error');
    updateExtRefineButton(true, null, '❌ 재시도');
  } finally {
    if (timerInterval) clearInterval(timerInterval);
  }
}
