import type { TranslationChunk } from '../shared/contracts/index.ts';
import {
  findTranscriptContainer,
  findTranscriptPanel,
} from '../adapters/youtube/transcript-dom.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';
import {
  findActiveTranslationIndex,
  type RebuildSurfaceState,
} from './surface-state.ts';

const SURFACE_HOST_ID = 'yt-ai-rebuild-surface-host';
const OVERLAY_HOST_ID = 'yt-ai-rebuild-overlay-host';
const DEFAULT_OVERLAY_FONT_SIZE_PX = 22;

interface SurfaceElements {
  host: HTMLDivElement;
  translateButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  importButton: HTMLButtonElement;
  refineButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  progressValue: HTMLParagraphElement;
  detailValue: HTMLParagraphElement;
  emptyValue: HTMLParagraphElement;
  list: HTMLDivElement;
}

interface OverlayElements {
  host: HTMLDivElement;
  text: HTMLDivElement;
}

interface RebuildSurfaceOptions {
  onExport: (translations: TranslationChunk[]) => void;
  onImportFile: (file: File) => void | Promise<void>;
  onStartRefine: () => void;
}

function parseSeconds(timestamp: string) {
  return timestamp
    .split(':')
    .map((part) => Number(part))
    .reduce((total, part) => total * 60 + part, 0);
}

export function createRebuildSurface(options: RebuildSurfaceOptions) {
  let currentTranslations: TranslationChunk[] = [];
  let lastActiveIndex = -1;
  let syncedVideo: HTMLVideoElement | null = null;
  let syncedAbortController: AbortController | null = null;
  let overlayFontSizePx = DEFAULT_OVERLAY_FONT_SIZE_PX;
  let overlayPosition:
    | {
        leftPx: number;
        bottomPx: number;
      }
    | null = null;

  function stopOverlaySync() {
    syncedAbortController?.abort();
    syncedAbortController = null;
    syncedVideo = null;
  }

  function ensurePanelElements(): SurfaceElements | null {
    const transcriptContainer = findTranscriptContainer();
    const transcriptPanel = findTranscriptPanel();
    const parent =
      transcriptContainer?.parentElement ??
      transcriptPanel?.querySelector('#body') ??
      null;

    if (!(parent instanceof HTMLElement)) {
      return null;
    }

    let host = document.getElementById(SURFACE_HOST_ID) as HTMLDivElement | null;
    let shadow = host?.shadowRoot ?? null;

    if (!host || !shadow) {
      host = document.createElement('div');
      host.id = SURFACE_HOST_ID;
      host.style.display = 'block';
      host.style.margin = '16px 0 14px';
      host.style.position = 'relative';
      host.style.zIndex = '1';

      shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host {
            all: initial;
            --s-bg: rgba(255, 255, 255, 0.7);
            --s-border: rgba(255, 255, 255, 0.3);
            --s-header-bg: rgba(255, 255, 255, 0.5);
            --s-header-border: rgba(0, 0, 0, 0.05);
            --s-text: #0f0f0f;
            --s-text-secondary: #606060;
            --s-text-muted: #909090;
            --s-accent: #065fd4;
            --s-accent-hover: rgba(6, 95, 212, 0.1);
            --s-accent-active: rgba(6, 95, 212, 0.15);
            --s-success: #2e7d32;
            --s-warning: #e65100;
            --s-error: #c62828;
            --s-btn-bg: rgba(0, 0, 0, 0.05);
            --s-btn-hover: rgba(0, 0, 0, 0.1);
            --s-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            font-family: 'Roboto', 'Arial', sans-serif;
          }

          @media (prefers-color-scheme: dark) {
            :host {
              --s-bg: rgba(30, 30, 30, 0.7);
              --s-border: rgba(255, 255, 255, 0.1);
              --s-header-bg: rgba(40, 40, 40, 0.5);
              --s-header-border: rgba(255, 255, 255, 0.06);
              --s-text: #f1f1f1;
              --s-text-secondary: #aaa;
              --s-text-muted: #717171;
              --s-accent: #3ea6ff;
              --s-accent-hover: rgba(62, 166, 255, 0.1);
              --s-accent-active: rgba(62, 166, 255, 0.15);
              --s-success: #81c995;
              --s-warning: #ffa726;
              --s-error: #f28b82;
              --s-btn-bg: rgba(255, 255, 255, 0.1);
              --s-btn-hover: rgba(255, 255, 255, 0.15);
              --s-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            }
          }

          * { box-sizing: border-box; }

          /* 메인 서피스 — 글래스모피즘 */
          .surface {
            background: var(--s-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--s-border);
            border-radius: 16px;
            box-shadow: var(--s-shadow);
            overflow: hidden;
            color: var(--s-text);
            font: 14px/1.5 'Roboto', 'Arial', sans-serif;
          }

          /* 헤더 — 한 줄 flat 레이아웃 */
          .hero {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            border-bottom: 1px solid var(--s-header-border);
            flex-wrap: nowrap;
          }


          /* 버튼 공통 */
          .control-btn {
            background: none;
            border: none;
            cursor: pointer;
            font: 500 13px/1 'Roboto', 'Arial', sans-serif;
            padding: 0;
            border-radius: 999px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .control-btn:disabled {
            cursor: default;
            opacity: 0.3;
          }

          /* Translate — 구글 블루 솔리드 pill */
          .control-btn-accent {
            background: var(--s-accent);
            color: #fff;
            font-weight: 600;
            padding: 0 14px;
            min-height: 32px;
            font-size: 13px;
            line-height: 30px;
          }

          .control-btn-accent:hover:enabled {
            opacity: 0.88;
          }

          /* Cancel — 아웃라인 (Refine/Export와 동일) */
          .control-btn-secondary {
            color: var(--s-accent);
            border: 1px solid var(--s-accent);
            padding: 0 12px;
            min-height: 32px;
            font-size: 12px;
            line-height: 30px;
          }

          .control-btn-secondary:hover:enabled {
            background: var(--s-accent-hover);
          }

          /* Refine/Export/Import — 아웃라인 pill (동일 크기) */
          .control-btn-outline {
            color: var(--s-accent);
            border: 1px solid var(--s-accent);
            padding: 0 12px;
            min-height: 32px;
            font-size: 12px;
            line-height: 30px;
          }

          .control-btn-outline:hover:enabled {
            background: var(--s-accent-hover);
          }

          .control-btn:disabled {
            cursor: default;
            opacity: 0.3;
          }

          .control-btn:focus-visible,
          .item:focus-visible {
            outline: 2px solid var(--s-accent);
            outline-offset: 2px;
          }

          /* 상태 텍스트 */
          .status-text {
            margin: 0;
            padding: 4px 16px 0;
            font-size: 12px;
            color: var(--s-text-muted);
          }

          .status-text:empty { display: none; }

          /* 진행률 패널 — 컴팩트 한줄 */
          .progress-panel {
            display: flex;
            align-items: baseline;
            gap: 8px;
            padding: 8px 16px;
            border-bottom: 1px solid var(--s-header-border);
          }

          .progress-panel:has(.meta:empty):has(.detail:empty) {
            display: none;
          }

          .meta {
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            color: var(--s-text);
          }

          .meta:empty { display: none; }

          .detail {
            margin: 0;
            font-size: 11px;
            color: var(--s-text-muted);
          }

          .detail:empty { display: none; }

          /* 빈 상태 */
          .empty {
            display: none;
            margin: 0;
            padding: 24px 16px;
            text-align: center;
            color: var(--s-text-muted);
            font-size: 13px;
          }

          .empty:not(:empty) { display: block; }

          /* 리스트 프레임 */
          .list-frame { overflow: hidden; }

          .list {
            display: flex;
            flex-direction: column;
            padding: 8px;
            max-height: min(52vh, 500px);
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-width: thin;
            scroll-behavior: smooth;
          }

          /* 번역 아이템 — extension 스타일 */
          .item {
            display: flex;
            gap: 16px;
            width: 100%;
            padding: 14px;
            border-radius: 12px;
            border: none;
            background: none;
            color: inherit;
            text-align: left;
            cursor: pointer;
            font: inherit;
            margin-bottom: 2px;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          }

          .item:hover:enabled {
            background: var(--s-accent-hover);
          }

          .item.active {
            background: var(--s-accent-active);
            box-shadow: inset 4px 0 0 var(--s-accent);
          }

          /* 타임스탬프 */
          .item-meta {
            display: flex;
            align-items: flex-start;
            flex-shrink: 0;
          }

          .time {
            display: inline-block;
            color: var(--s-accent);
            font-weight: 600;
            font-size: 13px;
            min-width: 50px;
            padding: 0;
            border: none;
            border-radius: 0;
            background: none;
          }

          .item.active .time { color: var(--s-accent); }

          /* 본문 텍스트 */
          .item-body { min-width: 0; flex: 1; }

          .text {
            color: var(--s-text);
            font-size: 14px;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }

          /* 스크롤바 */
          .list::-webkit-scrollbar { width: 4px; }
          .list::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--s-text-muted); }
          .list::-webkit-scrollbar-track { background: transparent; }

          /* 반응형 */
          @media (max-width: 480px) {
            .hero { flex-wrap: wrap; }
          }

          /* 모션 감소 */
          /* 토글 버튼 */
          .toggle-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            color: var(--s-text-secondary);
            font-size: 14px;
            line-height: 1;
            transition: all 0.2s ease;
            flex-shrink: 0;
            margin-left: auto;
          }

          .toggle-btn:hover {
            background: var(--s-btn-bg);
            color: var(--s-text);
          }

          .toggle-btn[aria-expanded="false"] {
            transform: rotate(90deg);
          }

          /* 접힌 상태 */
          .content-body[hidden] {
            display: none;
          }

          @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
              animation-duration: 0.01ms !important;
              transition-duration: 0.01ms !important;
            }
          }
        </style>
        <section class="surface">
          <div class="hero">
            <button class="control-btn control-btn-accent" type="button" data-role="translate"></button>
            <button class="control-btn control-btn-secondary" type="button" data-role="cancel" hidden></button>
            <button class="control-btn control-btn-outline" type="button" data-role="refine"></button>
            <button class="control-btn control-btn-outline" type="button" data-role="export">${CONTENT_UI_LABELS.surface.export}</button>
            <button class="control-btn control-btn-outline" type="button" data-role="import" title="Import a JSON subtitle bundle.">${CONTENT_UI_LABELS.surface.import}</button>
            <input data-role="file-input" type="file" accept=".json" hidden />
            <button class="toggle-btn" type="button" data-role="toggle" aria-expanded="true" aria-label="Toggle transcript" title="Toggle transcript">▼</button>
          </div>
          <div class="content-body" data-role="content-body">
            <section class="progress-panel" aria-label="Translation status">
              <p class="meta" data-role="progress"></p>
              <p class="detail" data-role="detail" role="status" aria-live="polite"></p>
            </section>
            <p class="empty" data-role="empty"></p>
            <section class="list-frame" aria-label="Translated transcript map">
              <div class="list" data-role="list" role="list" aria-label="Translated transcript"></div>
            </section>
          </div>
        </section>
      `;

      /* 토글 버튼 이벤트 바인딩 */
      const toggleBtn = shadow.querySelector('[data-role="toggle"]');
      const contentBody = shadow.querySelector('[data-role="content-body"]');
      if (toggleBtn instanceof HTMLButtonElement && contentBody instanceof HTMLDivElement) {
        toggleBtn.addEventListener('click', () => {
          const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
          contentBody.hidden = isExpanded;
        });
      }
    }

    if (transcriptContainer && host.parentElement !== transcriptContainer.parentElement) {
      transcriptContainer.parentElement?.insertBefore(host, transcriptContainer);
    } else if (!host.parentElement) {
      parent.prepend(host);
    }

    const translateButton = shadow.querySelector('[data-role="translate"]');
    const cancelButton = shadow.querySelector('[data-role="cancel"]');
    const exportButton = shadow.querySelector('[data-role="export"]');
    const importButton = shadow.querySelector('[data-role="import"]');
    const refineButton = shadow.querySelector('[data-role="refine"]');
    const fileInput = shadow.querySelector('[data-role="file-input"]');
    const progressValue = shadow.querySelector('[data-role="progress"]');
    const detailValue = shadow.querySelector('[data-role="detail"]');
    const emptyValue = shadow.querySelector('[data-role="empty"]');
    const list = shadow.querySelector('[data-role="list"]');

    if (
      !(translateButton instanceof HTMLButtonElement) ||
      !(cancelButton instanceof HTMLButtonElement) ||
      !(exportButton instanceof HTMLButtonElement) ||
      !(importButton instanceof HTMLButtonElement) ||
      !(refineButton instanceof HTMLButtonElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(progressValue instanceof HTMLParagraphElement) ||
      !(detailValue instanceof HTMLParagraphElement) ||
      !(emptyValue instanceof HTMLParagraphElement) ||
      !(list instanceof HTMLDivElement)
    ) {
      throw new Error('Failed to initialize the translation surface.');
    }

    return {
      host,
      translateButton,
      cancelButton,
      exportButton,
      importButton,
      refineButton,
      fileInput,
      progressValue,
      detailValue,
      emptyValue,
      list,
    };
  }

  function ensureOverlayElements(): OverlayElements | null {
    const player = document.querySelector('.html5-video-player');
    if (!(player instanceof HTMLElement)) {
      return null;
    }

    let host = document.getElementById(OVERLAY_HOST_ID) as HTMLDivElement | null;
    let shadow = host?.shadowRoot ?? null;

    if (!host || !shadow) {
      host = document.createElement('div');
      host.id = OVERLAY_HOST_ID;
      host.style.position = 'absolute';
      host.style.left = '50%';
      host.style.bottom = '12%';
      host.style.transform = 'translateX(-50%)';
      host.style.width = '80%';
      host.style.display = 'flex';
      host.style.justifyContent = 'center';
      host.style.zIndex = '2001';
      host.style.pointerEvents = 'none';

      shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

          :host {
            all: initial;
          }

          .overlay {
            position: relative;
            max-width: 100%;
            padding: 10px 22px;
            border-radius: 10px;
            background: rgba(0, 0, 0, 0.55);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.98);
            font: 600 24px/1.4 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            -webkit-font-smoothing: antialiased;
            text-align: center;
            text-shadow:
              0 1px 4px rgba(0, 0, 0, 0.6),
              0 0 12px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(16px) saturate(140%);
            -webkit-backdrop-filter: blur(16px) saturate(140%);
            opacity: 0;
            transition:
              opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.3s,
              backdrop-filter 0.3s,
              transform 0.3s;
            pointer-events: auto;
            cursor: move;
            user-select: none;
          }

          .overlay.visible {
            opacity: 1;
          }

          :host(:not(:hover)) .overlay.visible {
            background: rgba(0, 0, 0, 0.08);
            border-color: transparent;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
          }

          .overlay.dragging {
            cursor: grabbing;
            transition: none;
          }

          @media (max-width: 960px) {
            .overlay {
              padding: 8px 14px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .overlay {
              transition-duration: 0.01ms !important;
            }
          }
        </style>
        <div class="overlay" data-role="overlay"></div>
      `;
    }

    if (host.parentElement !== player) {
      player.appendChild(host);
    }

    const text = shadow.querySelector('[data-role="overlay"]');
    if (!(text instanceof HTMLDivElement)) {
      throw new Error('Failed to initialize the translation overlay.');
    }

    applyOverlayLayout(host, text);
    setupOverlayInteraction(host, text);

    return {
      host,
      text,
    };
  }

  function clearOverlay() {
    document.getElementById(OVERLAY_HOST_ID)?.remove();
    lastActiveIndex = -1;
  }

  function applyOverlayLayout(host: HTMLDivElement, text: HTMLDivElement) {
    text.style.fontSize = `${overlayFontSizePx}px`;

    if (overlayPosition) {
      host.style.left = `${overlayPosition.leftPx}px`;
      host.style.bottom = `${overlayPosition.bottomPx}px`;
      host.style.transform = 'none';
      return;
    }

    host.style.left = '50%';
    host.style.bottom = '12%';
    host.style.transform = 'translateX(-50%)';
  }

  function resetOverlayLayout(host: HTMLDivElement, text: HTMLDivElement) {
    overlayPosition = null;
    overlayFontSizePx = DEFAULT_OVERLAY_FONT_SIZE_PX;
    applyOverlayLayout(host, text);
  }

  function setupOverlayInteraction(host: HTMLDivElement, text: HTMLDivElement) {
    if (text.dataset.interactive === 'true') {
      return;
    }

    let dragPointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startBottom = 0;

    const finishDrag = () => {
      dragPointerId = null;
      text.classList.remove('dragging');
    };

    text.dataset.interactive = 'true';
    text.title = 'Drag to move, wheel to resize, double-click to reset.';

    text.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      const player = host.parentElement;
      if (!(player instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      const playerRect = player.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();

      dragPointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = hostRect.left - playerRect.left;
      startBottom = playerRect.bottom - hostRect.bottom;
      text.classList.add('dragging');
      text.setPointerCapture(event.pointerId);
    });

    text.addEventListener('pointermove', (event) => {
      if (dragPointerId !== event.pointerId) {
        return;
      }

      const player = host.parentElement;
      if (!(player instanceof HTMLElement)) {
        finishDrag();
        return;
      }

      const playerRect = player.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const nextLeft = startLeft + (event.clientX - startX);
      const nextBottom = startBottom + (startY - event.clientY);
      const maxLeft = Math.max(0, playerRect.width - hostRect.width);
      const maxBottom = Math.max(0, playerRect.height - hostRect.height);

      overlayPosition = {
        leftPx: Math.min(Math.max(0, nextLeft), maxLeft),
        bottomPx: Math.min(Math.max(0, nextBottom), maxBottom),
      };
      applyOverlayLayout(host, text);
    });

    text.addEventListener('pointerup', finishDrag);
    text.addEventListener('pointercancel', finishDrag);
    text.addEventListener('lostpointercapture', finishDrag);

    text.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        overlayFontSizePx = Math.max(
          16,
          Math.min(
            36,
            overlayFontSizePx + (event.deltaY < 0 ? 1 : -1),
          ),
        );
        text.style.fontSize = `${overlayFontSizePx}px`;
      },
      { passive: false },
    );

    text.addEventListener('dblclick', () => {
      resetOverlayLayout(host, text);
    });
  }

  function updateActiveTranslation(currentTimeSec: number) {
    const overlay = ensureOverlayElements();
    const panel = ensurePanelElements();
    if (!overlay || !panel) {
      return;
    }

    const nextActiveIndex = findActiveTranslationIndex(
      currentTimeSec,
      currentTranslations,
    );

    if (nextActiveIndex === lastActiveIndex) {
      return;
    }

    lastActiveIndex = nextActiveIndex;

    const rows = panel.list.querySelectorAll<HTMLButtonElement>('[data-index]');
    rows.forEach((row, index) => {
      const isActive = index === nextActiveIndex;
      row.classList.toggle('active', isActive);
      row.setAttribute('aria-current', isActive ? 'true' : 'false');

      if (isActive) {
        row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    });

    const activeTranslation =
      nextActiveIndex >= 0 ? currentTranslations[nextActiveIndex] : null;
    overlay.text.textContent =
      activeTranslation?.text ?? CONTENT_UI_LABELS.surface.overlayPlaceholder;
    overlay.text.classList.toggle('visible', !!activeTranslation);
  }

  function syncOverlayToVideo() {
    const video = document.querySelector('video');
    if (!(video instanceof HTMLVideoElement)) {
      stopOverlaySync();
      clearOverlay();
      return;
    }

    if (syncedVideo === video && syncedAbortController) {
      return;
    }

    syncedAbortController?.abort();
    syncedAbortController = new AbortController();
    syncedVideo = video;

    video.addEventListener(
      'timeupdate',
      () => {
        updateActiveTranslation(video.currentTime);
      },
      { signal: syncedAbortController.signal },
    );
  }

  function renderList(panel: SurfaceElements, translations: TranslationChunk[]) {
    panel.list.replaceChildren();

    translations.forEach((translation, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'item';
      row.dataset.index = String(index);
      row.dataset.seconds = String(parseSeconds(translation.start));
      row.setAttribute('aria-current', 'false');
      row.setAttribute(
        'aria-label',
        `${translation.start} ${translation.text}`,
      );
      row.title = 'Jump the player to this translated segment.';

      const meta = document.createElement('span');
      meta.className = 'item-meta';

      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = translation.start;

      const body = document.createElement('span');
      body.className = 'item-body';

      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = translation.text;

      meta.append(time);
      body.append(text);
      row.append(meta, body);
      row.addEventListener('click', () => {
        const video = document.querySelector('video');
        if (video instanceof HTMLVideoElement) {
          video.currentTime = Number(row.dataset.seconds ?? '0');
          video.play().catch(() => {});
        }
      });

      panel.list.appendChild(row);
    });
  }

  function render(state: RebuildSurfaceState) {
    const panel = ensurePanelElements();

    if (panel) {
      panel.host.style.display = state.panelVisible ? 'block' : 'none';
      panel.exportButton.disabled = !state.exportEnabled;
      panel.exportButton.onclick = () => {
        options.onExport(state.translations);
      };
      panel.importButton.disabled = !state.importEnabled;
      panel.importButton.title = state.importTitle;
      panel.importButton.onclick = () => {
        panel.fileInput.click();
      };
      panel.fileInput.onchange = () => {
        const file = panel.fileInput.files?.[0];
        if (!file) {
          return;
        }

        void options.onImportFile(file);
        panel.fileInput.value = '';
      };
      panel.refineButton.hidden = !state.showRefineAction;
      panel.refineButton.disabled = !state.refineEnabled;
      panel.refineButton.textContent = state.refineLabel;
      panel.refineButton.onclick = () => {
        void options.onStartRefine();
      };
      panel.progressValue.textContent = state.progressText;
      panel.detailValue.textContent = state.detailText;
      panel.emptyValue.textContent =
        state.translations.length === 0 ? state.emptyText : '';
      renderList(panel, state.translations);
    }

    currentTranslations = state.translations;
    if (state.overlayVisible && currentTranslations.length > 0) {
      ensureOverlayElements();
      syncOverlayToVideo();

      if (syncedVideo) {
        updateActiveTranslation(syncedVideo.currentTime);
      }
    } else {
      stopOverlaySync();
      clearOverlay();
    }
  }

  return {
    render,
    /** action-controls에서 사용할 수 있도록 패널 내 Translate/Cancel 요소를 노출 */
    getPanelActionElements() {
      const panel = ensurePanelElements();
      if (!panel) {
        return null;
      }

      return {
        translateButton: panel.translateButton,
        cancelButton: panel.cancelButton,
      };
    },
  };
}
