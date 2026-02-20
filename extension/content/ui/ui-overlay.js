// content/ui-overlay.js
// 영상 오버레이 UI(자막 표시/드래그/폰트크기) 전용 모듈
import { OVERLAY_HOST_ID } from '../../core/constants.js';

export function ensureVideoOverlay(videoPlayer) {
  if (!videoPlayer) return;
  if (!document.getElementById(OVERLAY_HOST_ID)) {
    createVideoOverlay(videoPlayer);
  }
}

export function clearVideoOverlay() {
  const overlayHost = document.getElementById(OVERLAY_HOST_ID);
  if (overlayHost) overlayHost.remove();
}

export function updateOverlayText(text) {
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
      background: rgba(0,0,0,0.85); color: #fff; padding: 10px 14px 10px 20px; border-radius: 10px;
      font-size: 13px; font-weight: 500; white-space: nowrap;
      opacity: 0; transition: opacity 0.5s, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 4px 16px rgba(0,0,0,0.3); pointer-events: none;
      display: flex; align-items: center; gap: 12px;
    }
    .overlay-hint.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
    .overlay-hint-close {
      background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.7);
      width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      cursor: pointer; transform: scale(1); transition: all 0.2s; font-size: 11px;
    }
    .overlay-hint-close:hover { background: rgba(255,255,255,0.25); color: #fff; transform: scale(1.1); }
  `;
  shadow.appendChild(style);

  const content = document.createElement('div');
  content.className = 'overlay-content';
  content.id = 'overlay-text';
  shadow.appendChild(content);

  setupDraggable(host, content);
  setupFontSizeControl(content);
  videoPlayer.appendChild(host);

  // 오버레이 안내 툴팁 (단 1회만 노출, 수동 닫기)
  chrome.storage.local.get(['overlayHintCount'], (res) => {
    const count = res.overlayHintCount || 0;
    if (count < 1) {
      const hint = document.createElement('div');
      hint.className = 'overlay-hint';
      
      const textSpan = document.createElement('span');
      textSpan.textContent = '🖱️ 휠로 크기 조절 · 드래그로 이동 · 더블클릭으로 초기화';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'overlay-hint-close';
      closeBtn.innerHTML = '✕';
      closeBtn.onclick = (e) => {
        // 드래그나 상위 이벤트로 전파 방지
        e.stopPropagation();
        
        hint.style.opacity = '0';
        hint.style.transform = 'translateX(-50%) translateY(10px)';
        hint.style.pointerEvents = 'none';
        
        chrome.storage.local.set({ overlayHintCount: 1 });
        
        // 애니메이션 끝나고 DOM에서 완전 제거
        setTimeout(() => hint.remove(), 500);
      };

      hint.appendChild(textSpan);
      hint.appendChild(closeBtn);
      shadow.appendChild(hint);
      
      // 약간의 지연 후 렌더링 애니메이션
      setTimeout(() => hint.classList.add('show'), 800);
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
    const currentSize = parseInt(window.getComputedStyle(content).fontSize, 10);
    const newSize = e.deltaY < 0 ? currentSize + 1 : currentSize - 1;
    const boundedSize = Math.max(12, Math.min(48, newSize));

    content.style.fontSize = `${boundedSize}px`;
    chrome.storage.local.set({ subtitleFontSize: boundedSize });
  };
}

function setupDraggable(host, content) {
  let isDragging = false;
  let startX;
  let startY;
  let initialX;
  let initialY;

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
