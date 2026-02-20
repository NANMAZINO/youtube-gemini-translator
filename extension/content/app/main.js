// content/app/main.js - 메인 컨트롤러 엔트리
import { extractCaptions, chunkTranscript } from '../dom/captions.js';
import { openTranscriptPanel } from '../dom/transcript-opener.js';
import {
  getFromCache,
  saveToCache,
  savePartialTranslation,
  getCacheCount,
  clearCache,
  getAllCacheMetadata,
  deleteFromCache,
  getCacheStorageSize,
} from '../../infrastructure/storage/cache.js';
import {
  prepareRenderingContainer,
  appendStreamingResults,
  showNotification,
  setExportData,
  clearUI,
  setUIActionHandlers,
} from '../ui/ui.js';
import { getVideoId, parseTimestamp, buildTranscriptFingerprint } from '../../core/utils.js';
import {
  SCRIPT_PANEL_SELECTOR,
  TRANSLATE_BUTTON_ID,
  FLOATING_BUTTON_ID,
  RE_SPLIT_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  IMPORT_BUTTON_ID,
  SHADOW_HOST_ID,
} from '../../core/constants.js';
import { createLogger } from '../../core/logger.js';
import { createButtonInjector } from '../dom/button-injector.js';
import { createTranslationFlow } from '../flow/translation-flow.js';
import { createPanelController } from './panel-controller.js';

const log = createLogger('Main');

function registerRuntimeMessageHandler({
  getCacheCount,
  getAllCacheMetadata,
  deleteFromCache,
  getVideoId,
  clearUI,
  clearCache,
  getCacheStorageSize,
}) {
  const messageListener = (request, sender, sendResponse) => {
    if (request.type === 'GET_CACHE_COUNT') {
      getCacheCount().then((count) => sendResponse({ count }));
      return true;
    }

    if (request.type === 'GET_ALL_CACHE') {
      getAllCacheMetadata().then((list) => sendResponse({ list }));
      return true;
    }

    if (request.type === 'DELETE_CACHE') {
      deleteFromCache(request.payload.videoId).then((res) => {
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
      getCacheStorageSize().then((size) => sendResponse({ size }));
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(messageListener);
}

const translationFlow = createTranslationFlow({
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

setUIActionHandlers({
  saveToCache,
  getTitle: translationFlow.getTitle,
  updateImportButtonState: panelController.updateImportButtonState,
});

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
