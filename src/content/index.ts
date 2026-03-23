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
import { createRebuildSurface } from './rebuild-surface.ts';
import { REBUILD_META } from '../shared/rebuild-meta.ts';
import {
  createInitialRuntimeTaskProjection,
  createRuntimeEventConsumer,
} from './runtime-event-consumer.ts';
import { projectRebuildSurfaceState } from './surface-state.ts';
import { isRebuildPageMessage } from '../shared/messaging.ts';

declare global {
  interface Window {
    __YT_AI_REBUILD_CONTENT__?: boolean;
    __YT_AI_REBUILD_RUNTIME_PROJECTION__?: RuntimeTaskProjection;
    __YT_AI_REBUILD_RUNTIME_LISTENER__?: boolean;
    __YT_AI_REBUILD_PAGE_MESSAGE_LISTENER__?: boolean;
    __YT_AI_REBUILD_TRANSCRIPT_DOM_OBSERVER__?: boolean;
  }
}

let currentTask: RuntimeTaskViewState | null = null;
let currentYouTubeCapability: TranscriptDomCapability | null = null;
let currentControllerState: PreviewControllerState | null = null;
let currentVideoId = getCurrentYouTubeVideoId();

function getDisplayedTranslations() {
  const controllerState = currentControllerState ?? previewController.getState();
  return currentTask?.translations ?? controllerState.previewTranslations;
}

function resetRuntimeProjection() {
  window.__YT_AI_REBUILD_RUNTIME_PROJECTION__ =
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
  onStateChanged(state) {
    currentControllerState = state;
    renderAll();
  },
});

const rebuildSurface = createRebuildSurface({
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
    return rebuildSurface.getPanelActionElements();
  },
});

function renderAll() {
  const controllerState = currentControllerState ?? previewController.getState();

  actionControls.render({
    capability: currentYouTubeCapability,
    controllerState,
    task: currentTask,
  });

  rebuildSurface.render(
    projectRebuildSurfaceState({
      capability: currentYouTubeCapability,
      controllerState,
      task: currentTask,
    }),
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

if (!window.__YT_AI_REBUILD_CONTENT__) {
  window.__YT_AI_REBUILD_CONTENT__ = true;
  resetRuntimeProjection();

  console.info(
    `[YT AI Translator] Content runtime active on YouTube (${REBUILD_META.phase}: ${REBUILD_META.title})`,
  );

  currentTask = null;
  renderAll();

  window.addEventListener('yt-navigate-finish', () => {
    const nextVideoId = getCurrentYouTubeVideoId();
    if (nextVideoId === currentVideoId) {
      return;
    }

    resetPageState(nextVideoId);
    void previewController.handleVideoNavigation();
  });
}

if (!window.__YT_AI_REBUILD_RUNTIME_LISTENER__) {
  window.__YT_AI_REBUILD_RUNTIME_LISTENER__ = true;

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
      window.__YT_AI_REBUILD_RUNTIME_PROJECTION__ = projection;
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

if (!window.__YT_AI_REBUILD_PAGE_MESSAGE_LISTENER__) {
  window.__YT_AI_REBUILD_PAGE_MESSAGE_LISTENER__ = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (!isRebuildPageMessage(message)) {
      return false;
    }

    if (shouldResetSurfaceForPageMessage(message, currentVideoId)) {
      clearCurrentSurfaceState();
    }

    return false;
  });
}

if (!window.__YT_AI_REBUILD_TRANSCRIPT_DOM_OBSERVER__) {
  window.__YT_AI_REBUILD_TRANSCRIPT_DOM_OBSERVER__ = true;

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
