// content/ui.js - Shadow DOM UI 및 스타일 관리 모듈
import { parseTimestamp } from './utils.js';
import {
  SHADOW_HOST_ID,
  OVERLAY_HOST_ID,
  SCRIPT_PANEL_SELECTOR,
  TRANSCRIPT_ITEMS_SELECTOR,
  IMPORT_BUTTON_ID,
  DEFAULT_MIN_HEIGHT_PX,
  PANEL_MIN_HEIGHT_RELEASE_MS,
  PROGRAMMATIC_SCROLL_RESET_MS,
  UI_CLOSE_ANIMATION_MS,
} from '../lib/constants.js';
import { sharedActions } from './shared-actions.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('UI');

let timeSyncAbortController = null;

let isAutoScrollEnabled = true;
let isProgrammaticScroll = false;

// 알림 스택 관리
let activeNotifications = [];

export function prepareRenderingContainer() {
  let shadowHost = document.getElementById(SHADOW_HOST_ID);
  
  let panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
  
  // 패널 탐색 강화
  if (!panel) {
    panel = Array.from(document.querySelectorAll('ytd-engagement-panel-section-list-renderer'))
      .find(el => el.getAttribute('target-id')?.includes('transcript') || el.id === 'transcript-panel');
  }

  if (!panel) {
    log.warn('Script panel not found');
    return null;
  }

  // 컨테이너 탐색: 세그먼트 리스트가 아직 없어도 패널 내부 컨텐츠 영역 사용
  let transcriptContainer = panel.querySelector(TRANSCRIPT_ITEMS_SELECTOR) || 
                          panel.querySelector('#segments-container') ||
                          panel.querySelector('ytd-transcript-renderer') ||
                          panel.querySelector('#content');

  // 만약 위에서 못 찾았으면 최후의 수단으로 #body나 패널 자체를 보지만, 
  // 실제 자막 리스트인 TRANSCRIPT_ITEMS_SELECTOR를 숨기는 것이 핵심임
  if (!transcriptContainer) {
    transcriptContainer = panel.querySelector('#body') || panel;
  }

  if (shadowHost && !shadowHost.isConnected) {
    shadowHost.remove();
    shadowHost = null;
  }

  if (!shadowHost) {
    shadowHost = document.createElement('div');
    shadowHost.id = SHADOW_HOST_ID;
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    isAutoScrollEnabled = true;
    injectStyles(shadow);
    const { header, container } = createLayout(shadowHost);
    shadow.appendChild(header);
    shadow.appendChild(container);
    setupTimeSync(shadow);

    // 부드러운 시작 애니메이션
    requestAnimationFrame(() => shadowHost.classList.add('visible'));
  }

  const shadow = shadowHost.shadowRoot;
  const container = shadow.getElementById('streaming-content');

  const videoPlayer = document.querySelector('.html5-video-player');
  if (videoPlayer && !document.getElementById(OVERLAY_HOST_ID)) {
    createVideoOverlay(videoPlayer);
  }

  container.onscroll = () => {
    if (isProgrammaticScroll) return;
    const isAtBottom = Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop) < 15;
    if (!isAtBottom) {
      if (isAutoScrollEnabled) {
        isAutoScrollEnabled = false;
        updateSyncButtonUI(shadow, false);
      }
    } else {
      if (!isAutoScrollEnabled) {
        isAutoScrollEnabled = true;
        updateSyncButtonUI(shadow, true);
      }
    }
  };

  // 레이아웃 점프 방지: 원래 자막의 높이를 캡처해서 우리 패널에 미리 할당
  const originalHeight = transcriptContainer.offsetHeight;
  
  if (shadowHost.parentElement !== transcriptContainer.parentNode) {
    transcriptContainer.parentNode.insertBefore(shadowHost, transcriptContainer);
  }

  // 우리 패널이 자리를 잡을 때까지 최소 높이를 유지해서 밑에 동영상들이 올라오지 않게 함
  shadowHost.style.flex = '1';
  shadowHost.style.minHeight = originalHeight > 0 ? `${originalHeight}px` : `${DEFAULT_MIN_HEIGHT_PX}px`;
  
  // 원본 숨김
  transcriptContainer.style.setProperty('display', 'none', 'important');

  // 애니메이션이 어느 정도 진행된 후(500ms) min-height를 풀어줌
  setTimeout(() => {
    shadowHost.style.minHeight = '0';
  }, PANEL_MIN_HEIGHT_RELEASE_MS);

  // 패널 자체가 visibility: hidden인 경우도 있으므로 체크 (유튜브 특성)
  if (panel.style.visibility === 'hidden') panel.style.visibility = 'visible';
  
  return shadow;
}

function createVideoOverlay(videoPlayer) {
  const existing = document.getElementById(OVERLAY_HOST_ID);
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = OVERLAY_HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    :host {
      position: absolute; bottom: 12%; left: 50%; transform: translateX(-50%);
      width: 80%; pointer-events: none; z-index: 2001; display: flex; justify-content: center;
    }
    .overlay-content {
      padding: 12px 24px; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px); border-radius: 12px; color: rgba(255, 255, 255, 1);
      font-size: 24px; font-weight: 600; text-align: center; line-height: 1.4;
      text-shadow: 
        -1px -1px 0 #000,  
         1px -1px 0 #000,
        -1px  1px 0 #000,
         1px  1px 0 #000,
         0px  2px 4px rgba(0,0,0,0.8); 
      border: 1px solid rgba(255,255,255,0.1);
      opacity: 0; transition: opacity 0.3s, background 0.3s, color 0.3s, backdrop-filter 0.3s, transform 0.3s;
      pointer-events: auto; cursor: move; user-select: none;
    }
    .overlay-content.visible { opacity: 1; }
    /* 배경과 글자 투명도를 각각 독립적으로 조절 (유튜브 스타일) */
    :host(:not(:hover)) .overlay-content.visible { 
      background: rgba(0, 0, 0, 0.1); 
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      color: rgba(255, 255, 255, 1); 
      border-color: transparent;
    }
    .overlay-hint {
      position: absolute; bottom: -50px; left: 50%; transform: translateX(-50%) translateY(10px);
      background: rgba(0,0,0,0.85); color: #fff; padding: 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 500; white-space: nowrap;
      opacity: 0; transition: opacity 0.5s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3); pointer-events: none;
    }
    .overlay-hint.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  shadow.appendChild(style);

  const content = document.createElement('div');
  content.className = 'overlay-content';
  content.id = 'overlay-text';
  shadow.appendChild(content);

  setupDraggable(host, content);
  setupFontSizeControl(content);
  videoPlayer.appendChild(host);

  // 오버레이 안내 툴팁 (처음 3회까지 표시)
  chrome.storage.local.get(['overlayHintCount'], (res) => {
    const count = res.overlayHintCount || 0;
    if (count < 3) {
      const hint = document.createElement('div');
      hint.className = 'overlay-hint';
      hint.textContent = '🖱️ 휠로 크기 조절 · 드래그로 이동 · 더블클릭으로 초기화';
      shadow.appendChild(hint);
      setTimeout(() => hint.classList.add('show'), 800);
      setTimeout(() => {
        hint.classList.remove('show');
        chrome.storage.local.set({ overlayHintCount: count + 1 });
        setTimeout(() => hint.remove(), 500);
      }, 6000);
    }
  });
}

function setupFontSizeControl(content) {
  // 초기 크기 복원
  chrome.storage.local.get(['subtitleFontSize'], (res) => {
    if (res.subtitleFontSize) {
      content.style.fontSize = `${res.subtitleFontSize}px`;
    }
  });

  content.onwheel = (e) => {
    e.preventDefault();
    const currentSize = parseInt(window.getComputedStyle(content).fontSize);
    const newSize = e.deltaY < 0 ? currentSize + 1 : currentSize - 1;
    const boundedSize = Math.max(12, Math.min(48, newSize));
    
    content.style.fontSize = `${boundedSize}px`;
    chrome.storage.local.set({ subtitleFontSize: boundedSize });
  };
}

function setupDraggable(host, content) {
  let isDragging = false;
  let startX, startY, initialX, initialY;

  // URL에서 videoId 추출 (저장용 키)
  const videoId = new URLSearchParams(window.location.search).get('v');
  const storageKey = videoId ? `overlayPos_${videoId}` : 'overlayPos_default';

  content.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = host.getBoundingClientRect();
    const parentRect = host.offsetParent.getBoundingClientRect();
    initialX = rect.left - parentRect.left;
    initialY = parentRect.bottom - rect.bottom;
    content.style.transition = 'none';

    // 드래그 시작 시 이벤트 등록
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    const deltaY = startY - e.clientY;
    
    const newLeft = initialX + deltaX;
    const newBottom = initialY + deltaY;
    
    host.style.left = `${newLeft}px`;
    host.style.bottom = `${newBottom}px`;
    host.style.transform = 'none';
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      content.style.transition = 'opacity 0.3s';
      
      const pos = { left: host.style.left, bottom: host.style.bottom };
      chrome.storage.local.set({ [storageKey]: pos });

      // 드래그 종료 시 이벤트 제거 (메모리 누수 방지 유지)
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  }

  // 더블 클릭 시 위치 초기화 (중앙 정렬)
  content.addEventListener('dblclick', () => {
    host.style.transition = 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)';
    host.style.left = '50%';
    host.style.bottom = '12%';
    host.style.transform = 'translateX(-50%)';
    
    chrome.storage.local.remove([storageKey]);
    
    // 애니메이션 종료 후 트랜지션 제거 (드래그 반응성 확보)
    setTimeout(() => {
      host.style.transition = 'none';
    }, 500);
  });
}

function updateSyncButtonUI(shadow, active) {
  const syncBtn = shadow.querySelector('.sync-btn');
  if (syncBtn) {
    syncBtn.style.opacity = active ? '1' : '0.4';
    syncBtn.title = active ? '자동 추적 중' : '수동 모드 (클릭하여 다시 추적)';
  }
}

function injectStyles(shadow) {
  const style = document.createElement('style');
  style.textContent = `
    :host { 
      display: block; 
      background: rgba(255, 255, 255, 0.7); 
      backdrop-filter: blur(20px); 
      -webkit-backdrop-filter: blur(20px); 
      border: 1px solid rgba(255, 255, 255, 0.3); 
      border-radius: 16px; 
      margin: 12px; 
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); 
      overflow: hidden; 
      font-family: 'Inter', system-ui, sans-serif;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host(.visible) {
      opacity: 1;
      transform: translateY(0);
    }
    @media (prefers-color-scheme: dark) { :host { background: rgba(30, 30, 30, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); color: #eee; } }
    .header { padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 0, 0, 0.05); background: rgba(255, 255, 255, 0.5); font-weight: 600; }
    .header-left { display: flex; flex-direction: column; gap: 2px; }
    .header-hint { font-size: 11px; font-weight: 400; opacity: 0.5; }
    .translation-container { padding: 8px; max-height: 500px; overflow-y: auto; scrollbar-width: thin; scroll-behavior: smooth; }
    .translation-item { display: flex; gap: 16px; padding: 14px; border-radius: 12px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin-bottom: 4px; }
    .translation-item:hover { background: rgba(6, 95, 212, 0.1); }
    .translation-item.active { background: rgba(6, 95, 212, 0.15); box-shadow: inset 4px 0 0 #065fd4; }
    .timestamp { color: #065fd4; font-weight: 600; font-size: 13px; width: 50px; }
    .text { flex: 1; font-size: 14px; line-height: 1.6; }
    .controls { display: flex; gap: 8px; align-items: center; }
    .sync-btn, .export-btn, .import-btn { background: none; border: none; cursor: pointer; font-size: 16px; color: inherit; padding: 4px; border-radius: 4px; transition: all 0.2s; }
    .sync-btn:hover, .export-btn:hover, .import-btn:hover { background: rgba(0,0,0,0.05); }
    .export-btn:disabled, .import-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  `;
  shadow.appendChild(style);
}

function createLayout(host) {
  const header = document.createElement('div');
  header.className = 'header';
  
  const headerLeft = document.createElement('div');
  headerLeft.className = 'header-left';

  const title = document.createElement('span');
  title.textContent = '🤖 AI 번역 스크립트';

  const hint = document.createElement('span');
  hint.className = 'header-hint';
  hint.textContent = '🖱️ 휠로 자막 오버레이 글자 크기 조절';

  headerLeft.append(title, hint);
  
  const controls = document.createElement('div');
  controls.className = 'controls';

  const syncBtn = document.createElement('button');
  syncBtn.className = 'sync-btn';
  syncBtn.textContent = '🎯';
  syncBtn.title = '자동 추적 중';
  syncBtn.onclick = () => {
    isAutoScrollEnabled = true;
    updateSyncButtonUI(host.shadowRoot, true);
    scrollToActive(host.shadowRoot);
  };

  const exportBtn = document.createElement('button');
  exportBtn.className = 'export-btn';
  exportBtn.textContent = '📥';
  exportBtn.title = 'JSON으로 내보내기 (번역 완료 후 활성화)';
  exportBtn.id = 'yt-ai-export-btn';
  exportBtn.disabled = true;

  const importBtn = document.createElement('button');
  importBtn.className = 'import-btn';
  importBtn.textContent = '📂';
  importBtn.title = 'JSON 가져오기';
  importBtn.id = IMPORT_BUTTON_ID;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.onchange = (e) => handleFileUpload(e);

  importBtn.onclick = () => fileInput.click();

  controls.append(exportBtn, importBtn, syncBtn, fileInput);
  header.append(headerLeft, controls);

  const container = document.createElement('div');
  container.className = 'translation-container';
  container.id = 'streaming-content';

  return { header, container };
}

export function appendStreamingResults(translations) {
  const host = document.getElementById(SHADOW_HOST_ID);
  const container = host?.shadowRoot.getElementById('streaming-content');
  if (!container) return;

  translations.forEach(item => {
    const div = document.createElement('div');
    div.className = 'translation-item';
    div.dataset.start = parseTimestamp(item.start);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'timestamp';
    timeSpan.textContent = item.start;

    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = item.text;

    div.append(timeSpan, textSpan);
    div.onclick = () => {
      const video = document.querySelector('video');
      if (video) video.currentTime = parseTimestamp(item.start);
    };

    container.appendChild(div);
  });

  // 스트리밍 중에도 자동 스크롤 유지
  if (isAutoScrollEnabled) {
    scrollToActive(host.shadowRoot);
  }
}

function setupTimeSync(shadow) {
  const video = document.querySelector('video');
  if (!video) return;

  if (timeSyncAbortController) timeSyncAbortController.abort();
  timeSyncAbortController = new AbortController();

  // 아이템 배열 캐싱 (DOM 쿼리 최소화)
  let cachedItems = [];
  let cachedStarts = [];

  const refreshCache = () => {
    cachedItems = Array.from(shadow.querySelectorAll('.translation-item'));
    cachedStarts = cachedItems.map(el => parseFloat(el.dataset.start));
  };

  // MutationObserver로 아이템 변경 시에만 캐시 갱신
  const container = shadow.getElementById('streaming-content');
  const observer = new MutationObserver(refreshCache);
  if (container) observer.observe(container, { childList: true });
  refreshCache();

  // 이진 탐색으로 현재 활성 아이템 찾기
  const findActiveIndex = (currentTime) => {
    let lo = 0, hi = cachedStarts.length - 1, result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (cachedStarts[mid] <= currentTime) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  };

  let lastActiveIndex = -1;

  video.addEventListener('timeupdate', () => {
    if (cachedItems.length === 0) return;

    const activeIndex = findActiveIndex(video.currentTime);
    if (activeIndex === lastActiveIndex) return;

    // 이전 활성 아이템 비활성화
    if (lastActiveIndex >= 0 && lastActiveIndex < cachedItems.length) {
      cachedItems[lastActiveIndex].classList.remove('active');
    }

    lastActiveIndex = activeIndex;

    if (activeIndex >= 0) {
      cachedItems[activeIndex].classList.add('active');
      updateOverlayText(cachedItems[activeIndex].querySelector('.text').textContent);
      if (isAutoScrollEnabled) scrollToActive(shadow);
    } else {
      updateOverlayText('');
    }
  }, { signal: timeSyncAbortController.signal });

  // AbortController 시 observer도 정리
  timeSyncAbortController.signal.addEventListener('abort', () => observer.disconnect());
}

function scrollToActive(shadow) {
  const container = shadow.getElementById('streaming-content');
  const activeItem = shadow.querySelector('.translation-item.active');
  
  if (container && activeItem) {
    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const scrollPos = (itemRect.top - containerRect.top) + container.scrollTop - (containerRect.height / 2);
    
    isProgrammaticScroll = true;
    container.scrollTo({
      top: scrollPos,
      behavior: 'smooth'
    });

    // Smooth scroll 완료 후 플래그 해제 (충분한 시간 확보)
    setTimeout(() => {
      isProgrammaticScroll = false;
    }, PROGRAMMATIC_SCROLL_RESET_MS);
  }
}

function updateOverlayText(text) {
  const host = document.getElementById(OVERLAY_HOST_ID);
  const content = host?.shadowRoot.getElementById('overlay-text');
  if (!content) return;

  if (text) {
    content.textContent = text;
    content.classList.add('visible');
  } else {
    content.classList.remove('visible');
  }
}

export function showNotification(message, type = 'info') {
  const colors = { success: '#2e7d32', error: '#c62828', info: '#1565c0' };
  const notification = document.createElement('div');
  notification.className = 'yt-ai-notification';
  
  Object.assign(notification.style, {
    position: 'fixed', top: '20px', right: '20px', padding: '14px 24px',
    backgroundColor: colors[type] || colors.info, color: 'white', borderRadius: '12px', zIndex: '9999',
    fontWeight: '500', fontSize: '14px', fontFamily: "'Inter', system-ui, sans-serif",
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)',
    opacity: '0', transform: 'translateY(-20px) scale(0.95)',
    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    pointerEvents: 'none'
  });
  notification.textContent = message;
  document.body.appendChild(notification);

  // 스택 추가 및 위치 계산
  activeNotifications.push(notification);
  
  // 브라우저가 레이아웃을 계산할 시간을 준 뒤 애니메이션 시작
  requestAnimationFrame(() => {
    updateNotificationPositions();
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0) scale(1)';
    notification.style.pointerEvents = 'auto';
  });

  // 페이드아웃 후 제거
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(10px) scale(0.95)';
    
    setTimeout(() => {
      notification.remove();
      activeNotifications = activeNotifications.filter(n => n !== notification);
      updateNotificationPositions();
    }, 500);
  }, 3500);
}

/**
 * 활성 알림들의 위치를 위 아래로 나열하도록 업데이트
 */
function updateNotificationPositions() {
  const spacing = 12;
  let currentTop = 20;

  activeNotifications.forEach((notification) => {
    notification.style.top = `${currentTop}px`;
    // 각 요소의 높이를 고려하여 다음 요소 위치 결정
    // offsetHeight가 0인 경우(아직 렌더링 전) 최소 높이 50px 가정
    currentTop += (notification.offsetHeight || 50) + spacing;
  });
}


/**
 * 번역 완료 후 내보내기 버튼 활성화 및 클릭 핸들러 설정
 */
export function setExportData(data, videoId) {
  const host = document.getElementById(SHADOW_HOST_ID);
  const shadow = host?.shadowRoot;
  const exportBtn = shadow?.getElementById('yt-ai-export-btn');
  
  if (exportBtn) {
    exportBtn.disabled = false;
    exportBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yt-subs-${videoId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('JSON 내보내기 완료', 'success');
    };
  }
}

/**
 * JSON 파일 업로드 처리
 */
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 유효성 검사
    if (!Array.isArray(data) || data.length === 0 || !data[0].start || !data[0].text) {
      throw new Error('유효하지 않은 자막 형식입니다.');
    }

    const host = document.getElementById(SHADOW_HOST_ID);
    const shadow = host?.shadowRoot;
    const container = shadow?.getElementById('streaming-content');

    if (!container) throw new Error('컨테이너를 찾을 수 없습니다.');

    // 기존 내용 비우기
    container.replaceChildren();

    // 렌더링 (XSS 방지는 innerText/textContent 사용으로 appendStreamingResults에서 이미 처리됨)
    appendStreamingResults(data);

    // 내보내기 데이터 설정 (재수출 가능하도록)
    const videoId = new URLSearchParams(window.location.search).get('v') || 'imported';
    setExportData(data, videoId);

    // 자동 캐시 저장 (V4 핵심)
    if (sharedActions.saveToCache && videoId !== 'imported') {
      const { targetLang } = await chrome.storage.local.get(['targetLang']);
      const currentLang = targetLang || '한국어';
      
      await sharedActions.saveToCache(videoId, data, {
        title: sharedActions.getTitle ? sharedActions.getTitle() : document.title,
        sourceLang: 'Imported',
        targetLang: currentLang,
        isRefined: false // 가져온 자막은 일단 미재분할 상태로 취급
      });
      log.info('Imported data auto-saved to cache');

      if (sharedActions.updateImportButtonState) {
        await sharedActions.updateImportButtonState();
      }
      
      // 가져오기 버튼 즉시 비활성화 (main.js의 로직 활용 가능 시 호출)
      const importBtn = shadow?.getElementById(IMPORT_BUTTON_ID);
      if (importBtn) {
        importBtn.disabled = true;
        importBtn.title = '성공적으로 가져와서 캐시에 저장되었습니다.';
      }
    }

    showNotification('자막을 성공적으로 가져왔으며 캐시에 저장되었습니다.', 'success');
  } catch (err) {
    log.error('Import failed:', err);
    showNotification('파일 로드 실패: ' + err.message, 'error');
  } finally {
    event.target.value = ''; // 같은 파일 다시 올릴 수 있도록 초기화
  }
}

/**
 * 모든 UI 요소 및 리스너 제거 (내비게이션 시 사용)
 * @param {boolean} keepButtons 헤더의 AI 버튼들을 유지할지 여부
 */
export async function clearUI(keepButtons = false) {
  // 사이드바 Shadow DOM 제거 (애니메이션 적용)
  const shadowHost = document.getElementById(SHADOW_HOST_ID);
  if (shadowHost) {
    shadowHost.classList.remove('visible');
    // 애니메이션 시간 대기 후 제거 (더 빠르게)
    await new Promise((r) => setTimeout(r, UI_CLOSE_ANIMATION_MS));
    shadowHost.remove();
  }

  // 1. 원본 자막 복구
  const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
  if (panel) {
    // prepareRenderingContainer와 동일한 로직으로 컨테이너 탐색
    const transcriptContainer = panel.querySelector(TRANSCRIPT_ITEMS_SELECTOR) || 
                              panel.querySelector('#segments-container') ||
                              panel.querySelector('ytd-transcript-renderer') ||
                              panel.querySelector('#content') ||
                              panel.querySelector('#body');
    
    if (transcriptContainer) {
      transcriptContainer.style.setProperty('display', 'block', 'important');
    }
  }

  // 2. 버튼 컨테이너 제거 (keepButtons가 false인 경우에만 - 네비게이션 시 등)
  if (!keepButtons) {
    const btnContainer = document.getElementById('yt-ai-btns-container');
    if (btnContainer) btnContainer.remove();
  }

  // 영상 오버레이 제거
  const overlayHost = document.getElementById(OVERLAY_HOST_ID);
  if (overlayHost) overlayHost.remove();

  // 알림 스택 정리 (메모리 누수 방지)
  activeNotifications.forEach(n => n.remove());
  activeNotifications = [];

  // 시간 동기화 중단
  if (timeSyncAbortController) {
    timeSyncAbortController.abort();
    timeSyncAbortController = null;
  }
}
