import type {
  RuntimeCommandType,
  TranslationChunk,
} from '../shared/contracts/index.ts';
import { extractNormalizedTranscript } from '../adapters/youtube/transcript-extractor.ts';
import { openTranscriptPanel } from '../adapters/youtube/transcript-opener.ts';
import {
  getCurrentYouTubeVideoId,
  getCurrentYouTubeVideoTitle,
} from '../adapters/youtube/video-context.ts';
import { sendCommand } from '../shared/messaging.ts';
import { parseImportBundle } from './bundle-io.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';
import {
  isTerminalTaskStatus,
  type RuntimeTaskViewState,
} from './runtime-event-consumer.ts';

export type PreviewSource = 'none' | 'cache' | 'import';

export interface PreviewControllerState {
  busy: boolean;
  openingTranscript: boolean;
  startingTranslation: boolean;
  startingRefine: boolean;
  cancellingTask: boolean;
  activeTaskId: string | null;
  statusMessage: string | null;
  lastCommandType: RuntimeCommandType | null;
  previewTranslations: TranslationChunk[];
  previewSource: PreviewSource;
  previewIsRefined: boolean;
  hasCachedRecord: boolean;
}

interface PreviewControllerOptions {
  onStateChanged?: (state: PreviewControllerState) => void;
}

function createInitialState(): PreviewControllerState {
  return {
    busy: false,
    openingTranscript: false,
    startingTranslation: false,
    startingRefine: false,
    cancellingTask: false,
    activeTaskId: null,
    statusMessage: null,
    lastCommandType: null,
    previewTranslations: [],
    previewSource: 'none',
    previewIsRefined: false,
    hasCachedRecord: false,
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'The action could not be completed.';
}

function openKeepAlivePort() {
  try {
    return chrome.runtime.connect({ name: 'keep-alive' });
  } catch {
    return null;
  }
}

function closeKeepAlivePort(port: chrome.runtime.Port | null) {
  try {
    port?.disconnect();
  } catch {
    // Ignore already closed ports.
  }
}

export function createPreviewController(options: PreviewControllerOptions = {}) {
  let state = createInitialState();
  let keepAlivePort: chrome.runtime.Port | null = null;
  let hydratedCacheKey: string | null = null;

  function publish(next: Partial<PreviewControllerState>) {
    state = {
      ...state,
      ...next,
    };

    options.onStateChanged?.(state);
  }

  function clearSurface(statusMessage: string | null = null) {
    closeKeepAlivePort(keepAlivePort);
    keepAlivePort = null;
    hydratedCacheKey = null;
    publish({
      ...createInitialState(),
      statusMessage,
    });
  }

  async function loadSettings() {
    const response = await sendCommand<'settings.get'>({
      kind: 'rebuild.command',
      type: 'settings.get',
    });

    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async function loadCachedRecord(
    videoId: string,
    targetLang: Parameters<typeof sendCommand<'cache.get'>>[0]['payload']['targetLang'],
  ) {
    const response = await sendCommand<'cache.get'>({
      kind: 'rebuild.command',
      type: 'cache.get',
      payload: {
        videoId,
        targetLang,
      },
    });

    if (!response.ok) {
      throw new Error(response.error.message);
    }

    return response.data;
  }

  async function openTranscript() {
    publish({
      busy: true,
      openingTranscript: true,
      statusMessage: CONTENT_UI_LABELS.status.openingTranscript,
    });

    try {
      await openTranscriptPanel();
      publish({
        busy: false,
        openingTranscript: false,
        statusMessage: CONTENT_UI_LABELS.status.transcriptReady,
      });
      await hydrateCachedPreview(true);
    } catch (error) {
      publish({
        busy: false,
        openingTranscript: false,
        statusMessage: toErrorMessage(error),
      });
    }
  }

  async function hydrateCachedPreview(force = false) {
    if (
      state.activeTaskId ||
      state.startingTranslation ||
      state.startingRefine ||
      state.cancellingTask
    ) {
      return false;
    }

    if (!force && state.previewSource === 'import') {
      return false;
    }

    const videoId = getCurrentYouTubeVideoId();
    if (!videoId) {
      return false;
    }

    try {
      const settings = await loadSettings();
      const cacheKey = `${videoId}_${settings.targetLang}_${settings.resumeMode}`;

      if (
        !force &&
        hydratedCacheKey === cacheKey &&
        (state.hasCachedRecord || state.previewTranslations.length > 0)
      ) {
        return false;
      }

      const cachedRecord = await loadCachedRecord(videoId, settings.targetLang);
      hydratedCacheKey = cacheKey;

      if (!cachedRecord) {
        publish({
          previewTranslations: [],
          previewSource: 'none',
          previewIsRefined: false,
          hasCachedRecord: false,
          statusMessage: null,
        });
        return false;
      }

      if (cachedRecord.isPartial && !settings.resumeMode) {
        publish({
          previewTranslations: [],
          previewSource: 'none',
          previewIsRefined: false,
          hasCachedRecord: true,
          statusMessage: CONTENT_UI_LABELS.surface.partialResumeAvailable,
        });
        return true;
      }

      publish({
        previewTranslations: cachedRecord.translations,
        previewSource: 'cache',
        previewIsRefined: cachedRecord.isRefined,
        hasCachedRecord: true,
        statusMessage: null,
      });
      return true;
    } catch (error) {
      publish({
        statusMessage: toErrorMessage(error),
      });
      return false;
    }
  }

  async function startTranslation() {
    let previewTranslations: TranslationChunk[] = [];
    let previewSource: PreviewSource = 'none';
    let previewIsRefined = false;
    let hasCachedRecord = state.hasCachedRecord;

    publish({
      busy: true,
      startingTranslation: true,
      statusMessage: CONTENT_UI_LABELS.status.startingTranslation,
    });

    try {
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new Error('Could not determine the current YouTube video id.');
      }

      await openTranscriptPanel();
      publish({
        statusMessage: 'Extracting transcript segments from the YouTube panel...',
      });

      const transcript = await extractNormalizedTranscript();
      if (transcript.raw.length === 0 || transcript.grouped.length === 0) {
        throw new Error('No transcript segments were extracted from the current page.');
      }

      const settings = await loadSettings();
      const title = getCurrentYouTubeVideoTitle();
      if (settings.resumeMode) {
        const cachedRecord = await loadCachedRecord(videoId, settings.targetLang);
        previewTranslations = cachedRecord?.translations ?? [];
        previewSource = cachedRecord ? 'cache' : 'none';
        previewIsRefined = cachedRecord?.isRefined ?? false;
        hasCachedRecord = !!cachedRecord;
      }

      const commandType: RuntimeCommandType = settings.resumeMode
        ? 'translation.resume'
        : 'translation.start';

      keepAlivePort = openKeepAlivePort();

      publish({
        lastCommandType: commandType,
        previewTranslations,
        previewSource,
        previewIsRefined,
        hasCachedRecord,
        statusMessage:
          commandType === 'translation.resume'
            ? 'Starting a resume-aware translation task...'
            : 'Starting a translation task...',
      });

      const response =
        commandType === 'translation.resume'
          ? await sendCommand<'translation.resume'>({
              kind: 'rebuild.command',
              type: 'translation.resume',
              payload: {
                videoId,
                title,
                transcript,
                settings,
                cachedTranslations: previewTranslations,
              },
            })
          : await sendCommand<'translation.start'>({
              kind: 'rebuild.command',
              type: 'translation.start',
              payload: {
                videoId,
                title,
                transcript,
                settings,
              },
            });

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      publish({
        busy: false,
        startingTranslation: false,
        activeTaskId: response.data.task.taskId,
        previewTranslations,
        previewSource,
        previewIsRefined,
        hasCachedRecord,
        statusMessage:
          'Background task started. Waiting for the first runtime event...',
      });
    } catch (error) {
      closeKeepAlivePort(keepAlivePort);
      keepAlivePort = null;
      publish({
        busy: false,
        startingTranslation: false,
        activeTaskId: null,
        previewTranslations,
        previewSource,
        previewIsRefined,
        hasCachedRecord,
        statusMessage: toErrorMessage(error),
      });
    }
  }

  async function startRefine(draftTranslations: TranslationChunk[]) {
    if (draftTranslations.length === 0) {
      publish({
        statusMessage: 'There is no translated draft to refine yet.',
      });
      return false;
    }

    publish({
      busy: true,
      startingRefine: true,
      lastCommandType: 'refine.start',
      previewTranslations: draftTranslations,
      statusMessage: CONTENT_UI_LABELS.status.startingRefine,
    });

    try {
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new Error('Could not determine the current YouTube video id.');
      }

      await openTranscriptPanel();
      publish({
        statusMessage: 'Extracting original transcript segments for refine...',
      });

      const transcript = await extractNormalizedTranscript();
      if (transcript.raw.length === 0) {
        throw new Error('No original transcript segments were extracted for refine.');
      }

      const settings = await loadSettings();
      const title = getCurrentYouTubeVideoTitle();
      keepAlivePort = openKeepAlivePort();

      const response = await sendCommand<'refine.start'>({
        kind: 'rebuild.command',
        type: 'refine.start',
        payload: {
          videoId,
          title,
          original: transcript.raw,
          draft: draftTranslations,
          settings,
        },
      });

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      publish({
        busy: false,
        startingRefine: false,
        activeTaskId: response.data.task.taskId,
        previewTranslations: draftTranslations,
        statusMessage:
          'Background refine task started. Waiting for the first runtime event...',
      });
      return true;
    } catch (error) {
      closeKeepAlivePort(keepAlivePort);
      keepAlivePort = null;
      publish({
        busy: false,
        startingRefine: false,
        activeTaskId: null,
        previewTranslations: draftTranslations,
        statusMessage: toErrorMessage(error),
      });
      return false;
    }
  }

  async function importBundleFile(file: File) {
    publish({
      busy: true,
      statusMessage: 'Importing JSON subtitles into the translation surface...',
    });

    try {
      const jsonText = await file.text();
      const translations = parseImportBundle(jsonText);
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new Error('Could not determine the current YouTube video id.');
      }

      const settings = await loadSettings();
      const title = getCurrentYouTubeVideoTitle();
      const response = await sendCommand<'cache.import'>({
        kind: 'rebuild.command',
        type: 'cache.import',
        payload: {
          videoId,
          title,
          targetLang: settings.targetLang,
          translations,
        },
      });

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      hydratedCacheKey = `${videoId}_${settings.targetLang}_${settings.resumeMode}`;
      publish({
        busy: false,
        previewTranslations: response.data.translations,
        previewSource: 'import',
        previewIsRefined: false,
        hasCachedRecord: true,
        statusMessage: 'Imported subtitles are ready and cached locally.',
      });
      return true;
    } catch (error) {
      publish({
        busy: false,
        statusMessage: toErrorMessage(error),
      });
      return false;
    }
  }

  async function cancelActiveTask(task: RuntimeTaskViewState | null) {
    const taskId = task?.taskId ?? state.activeTaskId;
    if (!taskId) {
      publish({
        statusMessage: 'There is no active task to cancel.',
      });
      return;
    }

    publish({
      busy: true,
      cancellingTask: true,
      statusMessage: 'Requesting cancellation for the active task...',
    });

    try {
      const response = await sendCommand<'translation.cancel'>({
        kind: 'rebuild.command',
        type: 'translation.cancel',
        payload: { taskId },
      });

      if (!response.ok) {
        throw new Error(response.error.message);
      }

      publish({
        busy: false,
        cancellingTask: false,
        activeTaskId: taskId,
        statusMessage:
          'Cancellation requested. Waiting for runtime confirmation...',
      });
    } catch (error) {
      publish({
        busy: false,
        cancellingTask: false,
        statusMessage: toErrorMessage(error),
      });
    }
  }

  function handleTaskUpdated(task: RuntimeTaskViewState) {
    if (isTerminalTaskStatus(task.status)) {
      closeKeepAlivePort(keepAlivePort);
      keepAlivePort = null;

      if (task.status === 'completed') {
        publish({
          ...createInitialState(),
          hasCachedRecord: state.hasCachedRecord,
        });
        return;
      }

      publish({
        busy: false,
        openingTranscript: false,
        startingTranslation: false,
        startingRefine: false,
        cancellingTask: false,
        activeTaskId: null,
        statusMessage: null,
      });
      return;
    }

    publish({
      busy: false,
      openingTranscript: false,
      startingTranslation: false,
      startingRefine: false,
      cancellingTask: false,
      activeTaskId: task.taskId,
      statusMessage: null,
    });
  }

  async function handleVideoNavigation() {
    const taskId = state.activeTaskId;

    clearSurface();

    if (!taskId) {
      return;
    }

    try {
      await sendCommand<'translation.cancel'>({
        kind: 'rebuild.command',
        type: 'translation.cancel',
        payload: { taskId },
      });
    } catch {
      // Ignore best-effort cancellation failures during SPA navigation.
    }
  }

  return {
    getState() {
      return state;
    },
    openTranscript,
    hydrateCachedPreview,
    startTranslation,
    startRefine,
    importBundleFile,
    cancelActiveTask,
    clearSurface,
    handleTaskUpdated,
    handleVideoNavigation,
  };
}
