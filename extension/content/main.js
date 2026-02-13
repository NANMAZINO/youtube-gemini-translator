// content/main.js - 메인 컨트롤러 엔트리
import { extractCaptions, chunkTranscript } from './captions.js';
import { openTranscriptPanel } from './transcript-opener.js';
import {
  getFromCache,
  saveToCache,
  getCacheCount,
  clearCache,
  getAllCacheMetadata,
  deleteFromCache,
  getCacheStorageSize,
} from '../lib/cache.js';
import {
  prepareRenderingContainer,
  appendStreamingResults,
  showNotification,
  setExportData,
  clearUI,
} from './ui.js';
import { sharedActions } from './shared-actions.js';
import { getVideoId, parseTimestamp } from './utils.js';
import {
  SCRIPT_PANEL_SELECTOR,
  TRANSLATE_BUTTON_ID,
  FLOATING_BUTTON_ID,
  RE_SPLIT_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  IMPORT_BUTTON_ID,
  SHADOW_HOST_ID,
} from '../lib/constants.js';
import { createLogger } from '../lib/logger.js';
import { createButtonInjector } from './button-injector.js';
import { createTranslationFlow } from './translation-flow.js';
import { createPanelController } from './panel-controller.js';
import { registerRuntimeMessageHandler } from './message-handler.js';

const log = createLogger('Main');

const translationFlow = createTranslationFlow({
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
});

const panelController = createPanelController({
  openTranscriptPanel,
  ensureUIReady: translationFlow.ensureUIReady,
  getVideoId,
  getFromCache,
  extractCaptions,
  showNotification,
  clearUI,
  renderFromCache: translationFlow.renderFromCache,
  startRefine: translationFlow.startRefine,
  updateExtRefineButton: translationFlow.updateExtRefineButton,
  TRANSLATE_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  IMPORT_BUTTON_ID,
  SHADOW_HOST_ID,
  log,
});

translationFlow.setUpdateToggleBtnState(panelController.updateToggleBtnState);

const buttonInjector = createButtonInjector({
  showNotification,
  openTranscriptPanel,
  SCRIPT_PANEL_SELECTOR,
  FLOATING_BUTTON_ID,
  TRANSLATE_BUTTON_ID,
  RE_SPLIT_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  handleTranslateClick: translationFlow.handleTranslateClick,
  handleToggleClick: panelController.handleToggleClick,
  log,
});

// 모듈 간 공유 액션 등록 (window 전역 노출 제거)
sharedActions.saveToCache = saveToCache;
sharedActions.getTitle = translationFlow.getTitle;
sharedActions.updateImportButtonState = panelController.updateImportButtonState;

registerRuntimeMessageHandler({
  getCacheCount,
  getAllCacheMetadata,
  deleteFromCache,
  getVideoId,
  clearUI,
  clearCache,
  getCacheStorageSize,
});

let mainObserver = null;
let throttleTimer = null;
let currentVideoId = null;

/**
 * 전역 자식 노드 변경 감시 시작
 * Throttling을 적용하여 성능 부하 차단 (500ms)
 */
function startMainObserver() {
  if (mainObserver) return;

  mainObserver = new MutationObserver(() => {
    if (throttleTimer) return;

    throttleTimer = setTimeout(() => {
      throttleTimer = null;

      const videoId = getVideoId();
      if (!videoId) return;

      const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
      if (panel) buttonInjector.injectTranslateButton(panel);
      buttonInjector.injectFloatingButton();

      const shadowHost = document.getElementById(SHADOW_HOST_ID);
      if (shadowHost && shadowHost.isConnected) {
        const isPanelVisible = panel && !panel.hidden && panel.offsetHeight > 0;
        if (!isPanelVisible) {
          log.info('Native script panel closed, clearing AI UI...');
          clearUI(true);
          panelController.updateToggleBtnState();
        }
      }
    }, 500);
  });

  mainObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function stopMainObserver() {
  if (mainObserver) {
    mainObserver.disconnect();
    mainObserver = null;
  }
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
}

function initPageAction() {
  startMainObserver();
}

window.addEventListener('yt-navigate-finish', () => {
  const videoId = getVideoId();
  if (videoId === currentVideoId) return;

  currentVideoId = videoId;
  stopMainObserver();
  clearUI();

  if (videoId) {
    initPageAction();
  } else {
    const floatingBtn = document.getElementById(FLOATING_BUTTON_ID);
    if (floatingBtn) floatingBtn.remove();
  }
});

if (getVideoId()) {
  currentVideoId = getVideoId();
  initPageAction();
}
