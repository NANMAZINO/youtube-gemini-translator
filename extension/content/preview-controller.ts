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
import { ImportBundleError, parseImportBundle } from './bundle-io.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';
import {
  isTerminalTaskStatus,
  type RuntimeTaskViewState,
} from './runtime-event-consumer.ts';
import type { ContentUiLabels } from '../shared/ui-copy.ts';

export type PreviewSource = 'none' | 'cache' | 'import';
type PreviewStatusMessageKey =
  | 'messages.backgroundRefineTaskStarted'
  | 'messages.backgroundTaskStarted'
  | 'messages.cancellationRequested'
  | 'messages.extractOriginalForRefine'
  | 'messages.extractTranscriptFromPanel'
  | 'messages.importedReadyAndCached'
  | 'messages.importingJson'
  | 'messages.noActiveTaskToCancel'
  | 'messages.noDraftToRefine'
  | 'messages.noOriginalForRefine'
  | 'messages.noTranscriptExtracted'
  | 'messages.requestingCancellation'
  | 'messages.startResumeAwareTask'
  | 'messages.startTranslationTask'
  | 'messages.videoIdMissing'
  | 'status.openingTranscript'
  | 'status.startingRefine'
  | 'status.startingTranslation'
  | 'status.transcriptReady'
  | 'surface.partialResumeAvailable';

export interface PreviewControllerState {
  busy: boolean;
  openingTranscript: boolean;
  startingTranslation: boolean;
  startingRefine: boolean;
  cancellingTask: boolean;
  activeTaskId: string | null;
  statusMessage: string | null;
  statusMessageKey: PreviewStatusMessageKey | null;
  lastCommandType: RuntimeCommandType | null;
  previewTranslations: TranslationChunk[];
  previewSource: PreviewSource;
  previewIsRefined: boolean;
  hasCachedRecord: boolean;
}

interface PreviewControllerOptions {
  onStateChanged?: (state: PreviewControllerState) => void;
  getLabels?: () => ContentUiLabels;
}

class PreviewControllerError extends Error {
  key: PreviewStatusMessageKey;

  constructor(key: PreviewStatusMessageKey, message: string) {
    super(message);
    this.name = 'PreviewControllerError';
    this.key = key;
  }
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
    statusMessageKey: null,
    lastCommandType: null,
    previewTranslations: [],
    previewSource: 'none',
    previewIsRefined: false,
    hasCachedRecord: false,
  };
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

  function getLabels() {
    return options.getLabels?.() ?? CONTENT_UI_LABELS;
  }

  function localizeRuntimeErrorMessage(code: string, fallbackMessage: string) {
    return getLabels().errors[code as keyof ReturnType<typeof getLabels>['errors']]
      ?? fallbackMessage;
  }

  function resolveStatusMessageKey(key: PreviewStatusMessageKey) {
    const labels = getLabels();
    const [scope, field] = key.split('.') as [
      'messages' | 'status' | 'surface',
      string,
    ];
    const value = labels[scope][field as keyof (typeof labels)[typeof scope]];

    return typeof value === 'string' ? value : '';
  }

  function publishStatusMessage(key: PreviewStatusMessageKey) {
    return {
      statusMessageKey: key,
      statusMessage: resolveStatusMessageKey(key),
    } as const;
  }

  function toErrorMessage(error: unknown) {
    if (error instanceof PreviewControllerError) {
      return {
        statusMessageKey: error.key,
        statusMessage: resolveStatusMessageKey(error.key),
      } as const;
    }

    if (error instanceof ImportBundleError) {
      return {
        statusMessageKey: null,
        statusMessage: localizeRuntimeErrorMessage(error.code, error.message),
      } as const;
    }

    return {
      statusMessageKey: null,
      statusMessage:
        error instanceof Error && error.message
          ? error.message
          : getLabels().messages.genericActionFailed,
    } as const;
  }

  function toCommandErrorMessage(response: {
    error: {
      code: string;
      message: string;
    };
  }) {
    return localizeRuntimeErrorMessage(
      response.error.code,
      response.error.message,
    );
  }

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
      statusMessageKey: null,
    });
  }

  async function loadSettings() {
    const response = await sendCommand<'settings.get'>({
      kind: 'runtime.command',
      type: 'settings.get',
    });

    if (!response.ok) {
      throw new Error(toCommandErrorMessage(response));
    }

    return response.data;
  }

  async function loadCachedRecord(
    videoId: string,
    targetLang: Parameters<typeof sendCommand<'cache.get'>>[0]['payload']['targetLang'],
  ) {
    const response = await sendCommand<'cache.get'>({
      kind: 'runtime.command',
      type: 'cache.get',
      payload: {
        videoId,
        targetLang,
      },
    });

    if (!response.ok) {
      throw new Error(toCommandErrorMessage(response));
    }

    return response.data;
  }

  async function openTranscript() {
    const labels = getLabels();

    publish({
      busy: true,
      openingTranscript: true,
      ...publishStatusMessage('status.openingTranscript'),
    });

    try {
      await openTranscriptPanel();
      publish({
        busy: false,
        openingTranscript: false,
        ...publishStatusMessage('status.transcriptReady'),
      });
      await hydrateCachedPreview(true);
    } catch (error) {
      const errorState = toErrorMessage(error);
      publish({
        busy: false,
        openingTranscript: false,
        ...errorState,
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
          statusMessageKey: null,
        });
        return false;
      }

      if (cachedRecord.isPartial && !settings.resumeMode) {
        publish({
          previewTranslations: [],
          previewSource: 'none',
          previewIsRefined: false,
          hasCachedRecord: true,
          ...publishStatusMessage('surface.partialResumeAvailable'),
        });
        return true;
      }

      publish({
        previewTranslations: cachedRecord.translations,
        previewSource: 'cache',
        previewIsRefined: cachedRecord.isRefined,
        hasCachedRecord: true,
        statusMessage: null,
        statusMessageKey: null,
      });
      return true;
    } catch (error) {
      const errorState = toErrorMessage(error);
      publish({
        ...errorState,
      });
      return false;
    }
  }

  async function startTranslation() {
    let previewTranslations: TranslationChunk[] = [];
    let previewSource: PreviewSource = 'none';
    let previewIsRefined = false;
    let hasCachedRecord = state.hasCachedRecord;
    const labels = getLabels();

    publish({
      busy: true,
      startingTranslation: true,
      ...publishStatusMessage('status.startingTranslation'),
    });

    try {
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new PreviewControllerError(
          'messages.videoIdMissing',
          labels.messages.videoIdMissing,
        );
      }

      await openTranscriptPanel();
      publish({
        ...publishStatusMessage('messages.extractTranscriptFromPanel'),
      });

      const transcript = await extractNormalizedTranscript();
      if (transcript.raw.length === 0 || transcript.grouped.length === 0) {
        throw new PreviewControllerError(
          'messages.noTranscriptExtracted',
          labels.messages.noTranscriptExtracted,
        );
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
        ...(commandType === 'translation.resume'
          ? publishStatusMessage('messages.startResumeAwareTask')
          : publishStatusMessage('messages.startTranslationTask')),
      });

      const response =
        commandType === 'translation.resume'
          ? await sendCommand<'translation.resume'>({
              kind: 'runtime.command',
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
              kind: 'runtime.command',
              type: 'translation.start',
              payload: {
                videoId,
                title,
                transcript,
                settings,
              },
            });

      if (!response.ok) {
        throw new Error(toCommandErrorMessage(response));
      }

      publish({
        busy: false,
        startingTranslation: false,
        activeTaskId: response.data.task.taskId,
        previewTranslations,
        previewSource,
        previewIsRefined,
        hasCachedRecord,
        ...publishStatusMessage('messages.backgroundTaskStarted'),
      });
    } catch (error) {
      closeKeepAlivePort(keepAlivePort);
      keepAlivePort = null;
      const errorState = toErrorMessage(error);
      publish({
        busy: false,
        startingTranslation: false,
        activeTaskId: null,
        previewTranslations,
        previewSource,
        previewIsRefined,
        hasCachedRecord,
        ...errorState,
      });
    }
  }

  async function startRefine(draftTranslations: TranslationChunk[]) {
    const labels = getLabels();

    if (draftTranslations.length === 0) {
      publish({
        ...publishStatusMessage('messages.noDraftToRefine'),
      });
      return false;
    }

    publish({
      busy: true,
      startingRefine: true,
      lastCommandType: 'refine.start',
      previewTranslations: draftTranslations,
      ...publishStatusMessage('status.startingRefine'),
    });

    try {
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new PreviewControllerError(
          'messages.videoIdMissing',
          labels.messages.videoIdMissing,
        );
      }

      await openTranscriptPanel();
      publish({
        ...publishStatusMessage('messages.extractOriginalForRefine'),
      });

      const transcript = await extractNormalizedTranscript();
      if (transcript.raw.length === 0) {
        throw new PreviewControllerError(
          'messages.noOriginalForRefine',
          labels.messages.noOriginalForRefine,
        );
      }

      const settings = await loadSettings();
      const title = getCurrentYouTubeVideoTitle();
      keepAlivePort = openKeepAlivePort();

      const response = await sendCommand<'refine.start'>({
        kind: 'runtime.command',
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
        throw new Error(toCommandErrorMessage(response));
      }

      publish({
        busy: false,
        startingRefine: false,
        activeTaskId: response.data.task.taskId,
        previewTranslations: draftTranslations,
        ...publishStatusMessage('messages.backgroundRefineTaskStarted'),
      });
      return true;
    } catch (error) {
      closeKeepAlivePort(keepAlivePort);
      keepAlivePort = null;
      const errorState = toErrorMessage(error);
      publish({
        busy: false,
        startingRefine: false,
        activeTaskId: null,
        previewTranslations: draftTranslations,
        ...errorState,
      });
      return false;
    }
  }

  async function importBundleFile(file: File) {
    const labels = getLabels();

    publish({
      busy: true,
      ...publishStatusMessage('messages.importingJson'),
    });

    try {
      const jsonText = await file.text();
      const translations = parseImportBundle(jsonText);
      const videoId = getCurrentYouTubeVideoId();
      if (!videoId) {
        throw new PreviewControllerError(
          'messages.videoIdMissing',
          labels.messages.videoIdMissing,
        );
      }

      const settings = await loadSettings();
      const title = getCurrentYouTubeVideoTitle();
      const response = await sendCommand<'cache.import'>({
        kind: 'runtime.command',
        type: 'cache.import',
        payload: {
          videoId,
          title,
          targetLang: settings.targetLang,
          translations,
        },
      });

      if (!response.ok) {
        throw new Error(toCommandErrorMessage(response));
      }

      hydratedCacheKey = `${videoId}_${settings.targetLang}_${settings.resumeMode}`;
      publish({
        busy: false,
        previewTranslations: response.data.translations,
        previewSource: 'import',
        previewIsRefined: false,
        hasCachedRecord: true,
        ...publishStatusMessage('messages.importedReadyAndCached'),
      });
      return true;
    } catch (error) {
      const errorState = toErrorMessage(error);
      publish({
        busy: false,
        ...errorState,
      });
      return false;
    }
  }

  async function cancelActiveTask(task: RuntimeTaskViewState | null) {
    const labels = getLabels();
    const taskId = task?.taskId ?? state.activeTaskId;
    if (!taskId) {
      publish({
        ...publishStatusMessage('messages.noActiveTaskToCancel'),
      });
      return;
    }

    publish({
      busy: true,
      cancellingTask: true,
      ...publishStatusMessage('messages.requestingCancellation'),
    });

    try {
      const response = await sendCommand<'translation.cancel'>({
        kind: 'runtime.command',
        type: 'translation.cancel',
        payload: { taskId },
      });

      if (!response.ok) {
        throw new Error(toCommandErrorMessage(response));
      }

      publish({
        busy: false,
        cancellingTask: false,
        activeTaskId: taskId,
        ...publishStatusMessage('messages.cancellationRequested'),
      });
    } catch (error) {
      const errorState = toErrorMessage(error);
      publish({
        busy: false,
        cancellingTask: false,
        ...errorState,
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
        statusMessageKey: null,
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
      statusMessageKey: null,
    });
  }

  function refreshLocalizedStatusMessage(): boolean {
    if (!state.statusMessageKey) {
      return false;
    }

    publish(publishStatusMessage(state.statusMessageKey));
    return true;
  }

  async function handleVideoNavigation() {
    const taskId = state.activeTaskId;

    clearSurface();

    if (!taskId) {
      return;
    }

    try {
      await sendCommand<'translation.cancel'>({
        kind: 'runtime.command',
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
    refreshLocalizedStatusMessage,
    handleTaskUpdated,
    handleVideoNavigation,
  };
}
