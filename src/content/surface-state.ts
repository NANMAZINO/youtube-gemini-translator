import { parseTimestamp } from '../domain/transcript/primitives.ts';
import type { TranslationChunk } from '../shared/contracts/index.ts';
import type { TranscriptDomCapability } from '../adapters/youtube/transcript-dom.ts';
import type { PreviewControllerState } from './preview-controller.ts';
import type { RuntimeTaskViewState } from './runtime-event-consumer.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';

export type SurfaceTone = 'neutral' | 'info' | 'warning' | 'success' | 'error';

export interface RebuildSurfaceState {
  panelVisible: boolean;
  overlayVisible: boolean;
  tone: SurfaceTone;
  statusText: string;
  progressText: string;
  detailText: string;
  emptyText: string;
  translations: TranslationChunk[];
  exportEnabled: boolean;
  importEnabled: boolean;
  importTitle: string;
  showRefineAction: boolean;
  refineEnabled: boolean;
  refineLabel: string;
}

interface ProjectSurfaceStateInput {
  capability: TranscriptDomCapability | null;
  controllerState: PreviewControllerState | null;
  task: RuntimeTaskViewState | null;
}

function formatTaskProgress(task: RuntimeTaskViewState | null) {
  if (!task) {
    return '';
  }

  if (task.totalChunks !== null) {
    return `${task.completedChunks ?? 0}/${task.totalChunks}`;
  }

  if (task.translationsCount !== null) {
    return `${task.translationsCount} segments`;
  }

  return '';
}

function toControllerStatusMessage(controllerState: PreviewControllerState | null) {
  if (!controllerState?.statusMessage) {
    return null;
  }

  if (controllerState.openingTranscript) {
    return CONTENT_UI_LABELS.status.openingTranscript;
  }

  if (controllerState.startingTranslation) {
    return CONTENT_UI_LABELS.status.startingTranslation;
  }

  if (controllerState.startingRefine) {
    return CONTENT_UI_LABELS.status.startingRefine;
  }

  return controllerState.statusMessage;
}

function createSurfaceControls(
  controllerState: PreviewControllerState | null,
  task: RuntimeTaskViewState | null,
  translations: TranslationChunk[],
  isRefinedResult: boolean,
) {
  const activeTask =
    !!task &&
    (task.status === 'preparing' ||
      task.status === 'running' ||
      task.status === 'retrying');
  const busy = !!controllerState?.busy;
  const hasVisibleTranslations = translations.length > 0;
  const hasCachedRecord = !!controllerState?.hasCachedRecord;
  const showRefineAction = hasVisibleTranslations;
  const importEnabled = !activeTask && !busy && !hasVisibleTranslations;

  return {
    exportEnabled: hasVisibleTranslations,
    importEnabled,
    importTitle:
      hasVisibleTranslations
        ? 'Import becomes available again when the current translation is no longer on screen.'
        : hasCachedRecord
          ? 'Import a JSON subtitle bundle. Any hidden saved draft for this video will be replaced.'
          : 'Import a JSON subtitle bundle into the rebuild surface.',
    showRefineAction,
    refineEnabled: showRefineAction && !activeTask && !busy && !isRefinedResult,
    refineLabel: isRefinedResult
      ? CONTENT_UI_LABELS.controls.refined
      : busy && controllerState?.startingRefine
        ? CONTENT_UI_LABELS.controls.startingRefine
        : CONTENT_UI_LABELS.controls.refine,
  };
}

function createSurfaceState(
  base: Omit<
    RebuildSurfaceState,
    | 'exportEnabled'
    | 'importEnabled'
    | 'importTitle'
    | 'showRefineAction'
    | 'refineEnabled'
    | 'refineLabel'
  >,
  controllerState: PreviewControllerState | null,
  task: RuntimeTaskViewState | null,
  isRefinedResult: boolean,
) {
  return {
    ...base,
    ...createSurfaceControls(
      controllerState,
      task,
      base.translations,
      isRefinedResult,
    ),
  } satisfies RebuildSurfaceState;
}

export function findActiveTranslationIndex(
  currentTimeSec: number,
  translations: TranslationChunk[],
) {
  let activeIndex = -1;

  for (let index = 0; index < translations.length; index += 1) {
    if (parseTimestamp(translations[index].start) <= currentTimeSec) {
      activeIndex = index;
      continue;
    }

    break;
  }

  return activeIndex;
}

export function projectRebuildSurfaceState(
  input: ProjectSurfaceStateInput,
): RebuildSurfaceState {
  const capability = input.capability;
  const controllerState = input.controllerState;
  const task = input.task;
  const panelVisible = !!capability?.panelOpen;
  const controllerMessage = toControllerStatusMessage(controllerState);
  const previewTranslations = controllerState?.previewTranslations ?? [];
  const previewSource = controllerState?.previewSource ?? 'none';
  const previewIsRefined = controllerState?.previewIsRefined ?? false;
  const translations = task?.translations ?? previewTranslations;

  if (
    controllerState &&
    (controllerState.startingTranslation || controllerState.startingRefine)
  ) {
    const preparingTranslations = previewTranslations;
    const preparingIsRefined = controllerState.startingRefine
      ? false
      : previewIsRefined;

    return createSurfaceState({
      panelVisible,
      overlayVisible: false,
      tone: controllerState.startingRefine ? 'warning' : 'info',
      statusText: controllerState.startingRefine
        ? CONTENT_UI_LABELS.status.startingRefine
        : CONTENT_UI_LABELS.status.startingTranslation,
      progressText: '',
      detailText: controllerMessage ?? '',
      emptyText: CONTENT_UI_LABELS.surface.empty,
      translations: preparingTranslations,
    }, controllerState, null, preparingIsRefined);
  }

  if (task) {
    const taskIsRefinedResult =
      task.phase === 'refine' && task.status === 'completed';

    switch (task.status) {
      case 'running':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'info',
          statusText: CONTENT_UI_LABELS.status.running,
          progressText: formatTaskProgress(task),
          detailText: task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'retrying':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'warning',
          statusText: CONTENT_UI_LABELS.status.retrying,
          progressText: formatTaskProgress(task),
          detailText: task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'completed':
        return createSurfaceState({
          panelVisible,
          overlayVisible: translations.length > 0,
          tone: 'success',
          statusText: taskIsRefinedResult
            ? CONTENT_UI_LABELS.surface.refinedReady
            : CONTENT_UI_LABELS.status.completed,
          progressText: formatTaskProgress(task),
          detailText:
            task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'failed':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'error',
          statusText: CONTENT_UI_LABELS.status.failed,
          progressText: formatTaskProgress(task),
          detailText: task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'cancelled':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'neutral',
          statusText: CONTENT_UI_LABELS.status.cancelled,
          progressText: formatTaskProgress(task),
          detailText: task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'preparing':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: controllerState?.startingRefine ? 'warning' : 'info',
          statusText: controllerState?.startingRefine
            ? CONTENT_UI_LABELS.status.startingRefine
            : CONTENT_UI_LABELS.status.startingTranslation,
          progressText: formatTaskProgress(task),
          detailText: task.message ?? '',
          emptyText: CONTENT_UI_LABELS.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult);

      case 'idle':
        break;
    }
  }

  if (panelVisible && previewTranslations.length > 0) {
    const statusText =
      previewSource === 'import'
        ? CONTENT_UI_LABELS.surface.importedReady
        : previewIsRefined
          ? CONTENT_UI_LABELS.surface.refinedReady
          : CONTENT_UI_LABELS.surface.cachedReady;

    return createSurfaceState({
      panelVisible,
      overlayVisible: true,
      tone: previewIsRefined ? 'success' : previewSource === 'import' ? 'info' : 'neutral',
      statusText,
      progressText: `${previewTranslations.length} segments`,
      detailText: controllerMessage ?? '',
      emptyText: CONTENT_UI_LABELS.surface.empty,
      translations: previewTranslations,
    }, controllerState, task, previewIsRefined);
  }

  if (controllerMessage) {
    return createSurfaceState({
      panelVisible,
      overlayVisible: false,
      tone: 'info',
      statusText: controllerMessage,
      progressText: '',
      detailText: '',
      emptyText: CONTENT_UI_LABELS.surface.empty,
      translations: [],
    }, controllerState, task, false);
  }

  if (panelVisible) {
    return createSurfaceState({
      panelVisible,
      overlayVisible: false,
      tone: 'neutral',
      statusText: CONTENT_UI_LABELS.surface.ready,
      progressText: 'Ready',
      detailText: '',
      emptyText: CONTENT_UI_LABELS.surface.empty,
      translations: [],
    }, controllerState, task, false);
  }

  return createSurfaceState({
    panelVisible: false,
    overlayVisible: false,
    tone: 'neutral',
    statusText: CONTENT_UI_LABELS.status.idle,
    progressText: '',
    detailText: CONTENT_UI_LABELS.surface.waiting,
    emptyText: CONTENT_UI_LABELS.surface.empty,
    translations: [],
  }, controllerState, task, false);
}
