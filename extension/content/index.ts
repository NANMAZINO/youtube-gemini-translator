import type { RuntimeTaskProjection, RuntimeTaskViewState } from './runtime-event-consumer.ts';
import { createContentActionControls } from './action-controls.ts';
import { serializeExportBundle } from './bundle-io.ts';
import { shouldResetSurfaceForPageMessage } from './cache-invalidation.ts';
import {
  type TranscriptDomCapability,
  watchTranscriptDomCapability,
} from '../adapters/youtube/transcript-dom.ts';
import { getCurrentYouTubeVideoId } from '../adapters/youtube/video-context.ts';
import {
  createPreviewController,
  type PreviewControllerState,
} from './preview-controller.ts';
import { createTranslationSurface } from './translation-surface.ts';
import { RUNTIME_META } from '../shared/runtime-meta.ts';
import {
  createInitialRuntimeTaskProjection,
  createRuntimeEventConsumer,
} from './runtime-event-consumer.ts';
import { projectTranslationSurfaceState } from './surface-state.ts';
import { isRuntimePageMessage } from '../shared/messaging.ts';
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '../shared/contracts/index.ts';
import { getContentUiLabels } from './ui-labels.ts';
import {
  detectSystemDarkTheme,
  detectYouTubeDarkTheme,
  resolveContentTheme,
  resolveUiLocale,
} from '../shared/ui-preferences.ts';

declare global {
  interface Window {
    __YT_AI_CONTENT_RUNTIME__?: boolean;
    __YT_AI_RUNTIME_PROJECTION__?: RuntimeTaskProjection;
    __YT_AI_RUNTIME_LISTENER__?: boolean;
    __YT_AI_PAGE_MESSAGE_LISTENER__?: boolean;
    __YT_AI_TRANSCRIPT_DOM_OBSERVER__?: boolean;
  }
}

let currentTask: RuntimeTaskViewState | null = null;
let currentYouTubeCapability: TranscriptDomCapability | null = null;
let currentControllerState: PreviewControllerState | null = null;
let currentVideoId = getCurrentYouTubeVideoId();
let currentSettings: Settings = DEFAULT_SETTINGS;
let systemThemeMediaQuery: MediaQueryList | null = null;
let htmlThemeObserver: MutationObserver | null = null;
let appThemeObserver: MutationObserver | null = null;

function getResolvedUiLocale() {
  return resolveUiLocale(currentSettings.uiLocale, navigator.language);
}

function getResolvedTheme() {
  return resolveContentTheme(currentSettings.themeMode, {
    youtubeDark: detectYouTubeDarkTheme(document),
    systemDark: detectSystemDarkTheme(
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : undefined,
    ),
  });
}

function getLabels() {
  return getContentUiLabels(getResolvedUiLocale());
}

async function syncCurrentSettings() {
  const response = await chrome.runtime.sendMessage({
    kind: 'runtime.command',
    type: 'settings.get',
  });

  if (
    !response ||
    typeof response !== 'object' ||
    response.kind !== 'runtime.command.result' ||
    response.type !== 'settings.get' ||
    response.ok !== true
  ) {
    return;
  }

  currentSettings = response.data;
  if (!previewController.refreshLocalizedStatusMessage()) {
    renderAll();
  }
}

function refreshThemeIfNeeded() {
  if (currentSettings.themeMode !== 'system') {
    return;
  }

  renderAll();
}

function bindThemeObservers() {
  systemThemeMediaQuery?.removeEventListener('change', refreshThemeIfNeeded);
  systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  systemThemeMediaQuery.addEventListener('change', refreshThemeIfNeeded);

  htmlThemeObserver?.disconnect();
  htmlThemeObserver = new MutationObserver(() => {
    refreshThemeIfNeeded();
  });
  htmlThemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'dark', 'dark-theme', 'theme', 'is-dark-theme'],
  });

  appThemeObserver?.disconnect();
  const ytdApp = document.querySelector('ytd-app');
  if (!(ytdApp instanceof HTMLElement)) {
    appThemeObserver = null;
    return;
  }

  appThemeObserver = new MutationObserver(() => {
    refreshThemeIfNeeded();
  });
  appThemeObserver.observe(ytdApp, {
    attributes: true,
    attributeFilter: ['class', 'dark', 'dark-theme', 'theme', 'is-dark-theme'],
  });
}

function getDisplayedTranslations() {
  const controllerState = currentControllerState ?? previewController.getState();
  return currentTask?.translations ?? controllerState.previewTranslations;
}

function resetRuntimeProjection() {
  window.__YT_AI_RUNTIME_PROJECTION__ =
    createInitialRuntimeTaskProjection();
}

function downloadBundle(bundle: ReturnType<typeof getDisplayedTranslations>) {
  if (bundle.length === 0) {
    return;
  }

  const blob = new Blob([serializeExportBundle(bundle)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `yt-subs-${currentVideoId ?? 'imported'}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const previewController = createPreviewController({
  getLabels,
  onStateChanged(state) {
    currentControllerState = state;
    renderAll();
  },
});

const translationSurface = createTranslationSurface({
  getLabels,
  getResolvedTheme,
  onExport(translations) {
    downloadBundle(translations);
  },
  async onImportFile(file) {
    const imported = await previewController.importBundleFile(file);
    if (!imported) {
      return;
    }

    currentTask = null;
    resetRuntimeProjection();
    renderAll();
  },
  onStartRefine() {
    const translations = getDisplayedTranslations();
    void previewController.startRefine(translations);
  },
});
const actionControls = createContentActionControls({
  getLabels,
  getResolvedTheme,
  onOpenTranscript() {
    void previewController.openTranscript();
  },
  onStartTranslation() {
    void previewController.startTranslation();
  },
  onCancelTask(task) {
    void previewController.cancelActiveTask(task);
  },
  getSurfaceActionElements() {
    return translationSurface.getPanelActionElements();
  },
});

function renderAll() {
  const controllerState = currentControllerState ?? previewController.getState();
  const labels = getLabels();

  actionControls.render({
    capability: currentYouTubeCapability,
    controllerState,
    task: currentTask,
  });

  translationSurface.render(
    projectTranslationSurfaceState({
      capability: currentYouTubeCapability,
      controllerState,
      task: currentTask,
    }, labels),
  );
}

function resetPageState(nextVideoId: string | null) {
  currentVideoId = nextVideoId;
  currentTask = null;
  currentYouTubeCapability = null;
  resetRuntimeProjection();
  renderAll();
}

function clearCurrentSurfaceState(statusMessage: string | null = null) {
  currentTask = null;
  resetRuntimeProjection();
  previewController.clearSurface(statusMessage);
}

if (!window.__YT_AI_CONTENT_RUNTIME__) {
  window.__YT_AI_CONTENT_RUNTIME__ = true;
  resetRuntimeProjection();
  bindThemeObservers();
  void syncCurrentSettings();

  console.info(
    `[YT AI Translator] Content runtime active on YouTube (${RUNTIME_META.phase}: ${RUNTIME_META.title})`,
  );

  currentTask = null;
  renderAll();

  window.addEventListener('yt-navigate-finish', () => {
    const nextVideoId = getCurrentYouTubeVideoId();
    if (nextVideoId === currentVideoId) {
      return;
    }

    resetPageState(nextVideoId);
    bindThemeObservers();
    void previewController.handleVideoNavigation();
  });
}

if (!window.__YT_AI_RUNTIME_LISTENER__) {
  window.__YT_AI_RUNTIME_LISTENER__ = true;

  const runtimeConsumer = createRuntimeEventConsumer({
    onTaskUpdated(task, projection) {
      const activeVideoId = getCurrentYouTubeVideoId();
      if (!activeVideoId || task.videoId !== activeVideoId) {
        console.info(
          '[YT AI Translator] Ignoring stale event for inactive video:',
          task.videoId,
          activeVideoId,
        );
        return;
      }

      currentTask = task;
      previewController.handleTaskUpdated(task);
      window.__YT_AI_RUNTIME_PROJECTION__ = projection;
      renderAll();

      console.info(
        '[YT AI Translator] Event received:',
        task.lastEventType,
        projection.tasks[task.taskId],
      );
    },
  });

  chrome.runtime.onMessage.addListener((message) =>
    runtimeConsumer.handleMessage(message)
  );
}

if (!window.__YT_AI_PAGE_MESSAGE_LISTENER__) {
  window.__YT_AI_PAGE_MESSAGE_LISTENER__ = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (!isRuntimePageMessage(message)) {
      return false;
    }

    if (shouldResetSurfaceForPageMessage(message, currentVideoId)) {
      clearCurrentSurfaceState();
    }

    return false;
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName !== 'local' ||
    (!changes.uiLocale &&
      !changes.themeMode &&
      !changes.settingsSchemaVersion)
  ) {
    return;
  }

  void syncCurrentSettings();
});

if (!window.__YT_AI_TRANSCRIPT_DOM_OBSERVER__) {
  window.__YT_AI_TRANSCRIPT_DOM_OBSERVER__ = true;

  watchTranscriptDomCapability({
    onChange(capability) {
      const wasPanelOpen = !!currentYouTubeCapability?.panelOpen;
      currentYouTubeCapability = capability;
      renderAll();

      const shouldHydrateCachedPreview =
        capability.panelOpen &&
        (!wasPanelOpen || !currentTask) &&
        (currentTask === null ||
          (currentControllerState?.previewTranslations.length ?? 0) === 0);

      if (shouldHydrateCachedPreview) {
        void previewController.hydrateCachedPreview(!wasPanelOpen);
      }
    },
  });
}
