import { parseTimestamp } from '../domain/transcript/primitives.ts';
import type { TranslationChunk } from '../shared/contracts/index.ts';
import type { TranscriptDomCapability } from '../adapters/youtube/transcript-dom.ts';
import type { PreviewControllerState } from './preview-controller.ts';
import type { RuntimeTaskViewState } from './runtime-event-consumer.ts';
import { CONTENT_UI_LABELS } from './ui-labels.ts';
import type { ContentUiLabels } from '../shared/ui-copy.ts';
import {
  formatTaskProgress as formatLocalizedTaskProgress,
  getTaskDetailText,
} from './task-copy.ts';

export type SurfaceTone = 'neutral' | 'info' | 'warning' | 'success' | 'error';

export interface TranslationSurfaceState {
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

function formatTaskProgress(
  task: RuntimeTaskViewState | null,
  labels: ContentUiLabels,
) {
  if (!task) {
    return '';
  }

  return formatLocalizedTaskProgress(task, labels);
}

function toControllerStatusMessage(
  controllerState: PreviewControllerState | null,
  labels: ContentUiLabels,
) {
  if (!controllerState?.statusMessage) {
    return null;
  }

  if (controllerState.openingTranscript) {
    return labels.status.openingTranscript;
  }

  if (controllerState.startingTranslation) {
    return labels.status.startingTranslation;
  }

  if (controllerState.startingRefine) {
    return labels.status.startingRefine;
  }

  return controllerState.statusMessage;
}

function createSurfaceControls(
  controllerState: PreviewControllerState | null,
  task: RuntimeTaskViewState | null,
  translations: TranslationChunk[],
  isRefinedResult: boolean,
  labels: ContentUiLabels,
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
        ? labels.messages.importLockedVisible
        : hasCachedRecord
          ? labels.messages.importWillReplaceHiddenDraft
          : labels.messages.importIntoSurface,
    showRefineAction,
    refineEnabled: showRefineAction && !activeTask && !busy && !isRefinedResult,
    refineLabel: isRefinedResult
      ? labels.controls.refined
      : busy && controllerState?.startingRefine
        ? labels.controls.startingRefine
        : labels.controls.refine,
  };
}

function createSurfaceState(
  base: Omit<
    TranslationSurfaceState,
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
  labels: ContentUiLabels,
) {
  return {
    ...base,
    ...createSurfaceControls(
      controllerState,
      task,
      base.translations,
      isRefinedResult,
      labels,
    ),
  } satisfies TranslationSurfaceState;
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

export function projectTranslationSurfaceState(
  input: ProjectSurfaceStateInput,
  labels: ContentUiLabels = CONTENT_UI_LABELS,
): TranslationSurfaceState {
  const capability = input.capability;
  const controllerState = input.controllerState;
  const task = input.task;
  const panelVisible = !!capability?.panelOpen;
  const controllerMessage = toControllerStatusMessage(controllerState, labels);
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
        ? labels.status.startingRefine
        : labels.status.startingTranslation,
      progressText: '',
      detailText: controllerMessage ?? '',
      emptyText: labels.surface.empty,
      translations: preparingTranslations,
    }, controllerState, null, preparingIsRefined, labels);
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
          statusText: labels.status.running,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'retrying':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'warning',
          statusText: labels.status.retrying,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'completed':
        return createSurfaceState({
          panelVisible,
          overlayVisible: translations.length > 0,
          tone: 'success',
          statusText: taskIsRefinedResult
            ? labels.surface.refinedReady
            : labels.status.completed,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'failed':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'error',
          statusText: labels.status.failed,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'cancelled':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: 'neutral',
          statusText: labels.status.cancelled,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'preparing':
        return createSurfaceState({
          panelVisible,
          overlayVisible: false,
          tone: controllerState?.startingRefine ? 'warning' : 'info',
          statusText: controllerState?.startingRefine
            ? labels.status.startingRefine
            : labels.status.startingTranslation,
          progressText: formatTaskProgress(task, labels),
          detailText: getTaskDetailText(task, labels),
          emptyText: labels.surface.empty,
          translations,
        }, controllerState, task, taskIsRefinedResult, labels);

      case 'idle':
        break;
    }
  }

  if (panelVisible && previewTranslations.length > 0) {
    const statusText =
      previewSource === 'import'
        ? labels.surface.importedReady
        : previewIsRefined
          ? labels.surface.refinedReady
          : labels.surface.cachedReady;

    return createSurfaceState({
      panelVisible,
      overlayVisible: true,
      tone: previewIsRefined ? 'success' : previewSource === 'import' ? 'info' : 'neutral',
      statusText,
      progressText: labels.messages.translatedSegments(previewTranslations.length),
      detailText: controllerMessage ?? '',
      emptyText: labels.surface.empty,
      translations: previewTranslations,
    }, controllerState, task, previewIsRefined, labels);
  }

  if (controllerMessage) {
    return createSurfaceState({
      panelVisible,
      overlayVisible: false,
      tone: 'info',
      statusText: controllerMessage,
      progressText: '',
      detailText: '',
      emptyText: labels.surface.empty,
      translations: [],
    }, controllerState, task, false, labels);
  }

  if (panelVisible) {
    return createSurfaceState({
      panelVisible,
      overlayVisible: false,
      tone: 'neutral',
      statusText: labels.surface.ready,
      progressText: labels.status.transcriptReady,
      detailText: '',
      emptyText: labels.surface.empty,
      translations: [],
    }, controllerState, task, false, labels);
  }

  return createSurfaceState({
    panelVisible: false,
    overlayVisible: false,
    tone: 'neutral',
    statusText: labels.status.idle,
    progressText: '',
    detailText: labels.surface.waiting,
    emptyText: labels.surface.empty,
    translations: [],
  }, controllerState, task, false, labels);
}
