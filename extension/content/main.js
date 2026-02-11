// content/main.js - 메인 컨트롤러 모듈
import { extractCaptions, chunkTranscript } from './captions.js';
import { openTranscriptPanel } from './transcript-opener.js';
import { getFromCache, saveToCache, getCacheCount, clearCache, getAllCacheMetadata, deleteFromCache, getCacheStorageSize } from '../lib/cache.js';
import { 
  prepareRenderingContainer, 
  appendStreamingResults, 
  showNotification, 
  setExportData, 
  clearUI
} from './ui.js';
import { getVideoId, parseTimestamp } from './utils.js';
import {
  SCRIPT_PANEL_SELECTOR,
  TRANSLATE_BUTTON_ID,
  FLOATING_BUTTON_ID,
  RE_SPLIT_BUTTON_ID
} from '../lib/constants.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Main');

let panelObserver = null;

function waitForTranscriptPanel() {
  // 기존 옵저버 정리
  if (panelObserver) {
    panelObserver.disconnect();
    panelObserver = null;
  }

  // 이미 패널이 있으면 즉시 버튼 주입
  const existingPanel = document.querySelector(SCRIPT_PANEL_SELECTOR);
  if (existingPanel && injectTranslateButton(existingPanel)) return;

  // MutationObserver로 패널 등장 감시 (setInterval 대체)
  panelObserver = new MutationObserver(() => {
    const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
    if (panel && injectTranslateButton(panel)) {
      panelObserver.disconnect();
      panelObserver = null;
    }
  });

  panelObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

let currentVideoId = null;

// 메시지 리스너 (팝업↔컨텐츠 통신)
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
    clearUI(); // 결과 UI 청소
    if (videoId) {
      initPageAction();
    } else {
      // 영상 페이지가 아니면 진입용 플로팅 버튼도 제거
      const floatingBtn = document.getElementById(FLOATING_BUTTON_ID);
      if (floatingBtn) floatingBtn.remove();
    }
  }
});

// 첫 실행 시 (정적 로드 대응)
if (getVideoId()) {
  currentVideoId = getVideoId();
  initPageAction();
}

function initPageAction() {
  waitForTranscriptPanel();
  injectFloatingButton();
}

/**
 * 영상 하단(제목 근처)에 독립적인 번역 진입점 주입
 */
function injectFloatingButton() {
  if (document.getElementById(FLOATING_BUTTON_ID)) return;

  // 유튜브의 좋아요/공유 버튼이 있는 컨테이너를 우선 탐색
  const targetContainer = document.querySelector('ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed')
                       || document.querySelector('#top-level-buttons-computed')
                       || document.querySelector('#top-row.ytd-watch-metadata #owner');
  
  if (!targetContainer) {
    setTimeout(injectFloatingButton, 1000);
    return;
  }

  const btn = document.createElement('button');
  btn.id = FLOATING_BUTTON_ID;
  btn.innerHTML = '🤖 AI 번역';
  Object.assign(btn.style, {
    padding: '0 16px',
    height: '36px',
    backgroundColor: '#065fd4', // 유튜브 블루 스타일로 변경
    color: 'white',
    border: 'none',
    borderRadius: '18px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    marginLeft: '8px', // 왼쪽 여백 추가해서 간격 맞춤
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color 0.2s'
  });

  btn.onmouseover = () => btn.style.backgroundColor = '#054fba';
  btn.onmouseout = () => btn.style.backgroundColor = '#065fd4';

  btn.onclick = async () => {
    try {
      btn.disabled = true;
      btn.innerHTML = '⏳ 패널 여는 중...';
      
      // 1. 패널 자동 오픈 시도
      await openTranscriptPanel();
      
      // 2. 패널이 열리면 기존의 handleTranslateClick 호출
      // (기존 버튼을 동적으로 찾아서 클릭 시뮬레이션하거나 직접 호출)
      const mainBtn = document.getElementById(TRANSLATE_BUTTON_ID);
      if (mainBtn) {
        handleTranslateClick(mainBtn);
      } else {
        // 패널이 막 열려서 아직 버튼 주입 전일 수 있음
        setTimeout(() => {
          const retryBtn = document.getElementById(TRANSLATE_BUTTON_ID);
          if (retryBtn) handleTranslateClick(retryBtn);
          else showNotification('번역 버튼을 찾을 수 없습니다.', 'error');
        }, 500);
      }
    } catch (err) {
      log.error('Auto-open failed:', err);
      showNotification(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🤖 AI 번역';
    }
  };

  targetContainer.appendChild(btn);
}

function injectTranslateButton(panel) {
  // 이미 버튼 컨테이너가 있고, 그것이 현재 눈에 보이는 곳에 있다면 중단
  const existingContainer = document.getElementById('yt-ai-btns-container');
  if (existingContainer && existingContainer.offsetHeight > 0) return true;

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
  mainBtn.onclick = (e) => {
    e.stopPropagation();
    handleTranslateClick(mainBtn);
  };

  const refineBtn = document.createElement('button');
  refineBtn.id = RE_SPLIT_BUTTON_ID;
  refineBtn.textContent = '재분할';
  refineBtn.disabled = true;
  Object.assign(refineBtn.style, {
    padding: '8px 14px', backgroundColor: '#444', color: 'white',
    border: 'none', borderRadius: '18px', cursor: 'not-allowed', fontSize: '12px', fontWeight: '500', 
    opacity: '0.5'
  });

  container.append(mainBtn, refineBtn);
  
  // 주입 로직 고도화 (Visibility Priority)
  
  // 1. 현재 사용자 눈에 보이는 '참여 패널(Engagement Panel)'의 헤더를 최우선으로 함
  // '동영상 정보'와 '스크립트'가 합쳐진 경우 이 헤더가 유일하게 보임
  const activeEngagementHeader = document.querySelector('ytd-engagement-panel-section-list-renderer:not([hidden]) ytd-engagement-panel-title-header-renderer #title-container');
  if (activeEngagementHeader && activeEngagementHeader.offsetHeight > 0) {
    container.style.padding = '0 0 8px 12px'; // 헤더 옆 공간에 맞춤
    activeEngagementHeader.parentElement.appendChild(container);
    return true;
  }

  // 2. 표준 자막 패널 헤더 (전용 레이아웃인 경우)
  const standardHeader = panel.querySelector('#header');
  if (standardHeader && standardHeader.offsetHeight > 0) {
    standardHeader.appendChild(container);
    return true;
  }

  // 3. 최후의 수단: 본문 상단
  const body = panel.querySelector('#body');
  if (body && body.offsetHeight > 0) {
    body.prepend(container);
    return true;
  }

  return false;
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
    if (container) container.replaceChildren();
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

  let currentDisplayPercent = 0;
  let lastRealPercent = 0;
  let isRetrying = false;
  const startTime = Date.now();

  // 진행도 업데이트 헬퍼
  const updateProgressUI = () => {
    if (getVideoId() !== videoId || isRetrying) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    button.textContent = `🔄 번역 중 (${currentDisplayPercent}%) [${elapsed}s]`;
  };

  // 1초마다 타이머 업데이트 및 '가짜' 진행도 3초마다 올리기
  let crawlCounter = 0;
  let lastRetryInfo = null; // 재시도 시 UI 갱신용
  const timerInterval = setInterval(() => {
    if (getVideoId() !== videoId) return;

    if (isRetrying && lastRetryInfo) {
      // 재시도 중이면 진행도 대신 재시도 타이머 갱신
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      button.textContent = `⏳ 재시도 (${lastRetryInfo.current}/${lastRetryInfo.total})... [${elapsed}s]`;
    } else {
      crawlCounter++;
      if (crawlCounter >= 3) { // 3초마다 1% 상승
        crawlCounter = 0;
        const chunkWeight = 100 / total;
        const nextTargetCap = Math.floor(lastRealPercent + chunkWeight) - 1;

        if (currentDisplayPercent < nextTargetCap) {
          currentDisplayPercent++;
        }
      }
      updateProgressUI();
    }
  }, 1000); // UI(시간) 업데이트는 1초마다

  const listener = (msg) => {
    if (msg.type === 'TRANSLATION_CHUNK_DONE' && msg.payload.videoId === videoId) {
      const { current, total, translations } = msg.payload;
      
      isRetrying = false; // 성공 시 재시도 상태 해제
      lastRetryInfo = null;
      
      // 실제 완료 시점에 해당 구간의 시작점으로 점프
      lastRealPercent = Math.round((current / total) * 100);
      currentDisplayPercent = lastRealPercent;
      
      updateProgressUI(); // 즉시 UI 업데이트 (재시도 메시지 빠른 제거)
      
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
      isRetrying = true; // 재시도 상태 진입
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
      log.error('번역 실패:', errorMsg);
      showNotification(`번역 실패: ${errorMsg}`, 'error');
      updateExtRefineButton(false);
    }
  } catch (err) {
    log.error('통신 오류:', err);
    showNotification(`통신 오류: ${err.message}`, 'error');
    updateExtRefineButton(false);
  } finally {
    isRetrying = false; // 종료 시 무조건 해제
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

    const retryListener = (msg) => {
      if (msg.type === 'TRANSLATION_RETRYING' && msg.payload.videoId === videoId && msg.payload.current === '재분할') {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        updateExtRefineButton(false, null, `⏳ 재시도 (${msg.payload.retryCount}회)... [${elapsed}s]`);
      }
    };
    chrome.runtime.onMessage.addListener(retryListener);

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
          container.replaceChildren(); // 기존 초안 싹 비우기
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
    log.error('Refine failed:', error);
    showNotification('재분할 실패: ' + error.message, 'error');
    updateExtRefineButton(true, null, '❌ 재시도');
  } finally {
    if (timerInterval) clearInterval(timerInterval);
    chrome.runtime.onMessage.removeListener(retryListener);
  }
}
