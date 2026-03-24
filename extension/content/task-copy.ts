import type { ContentUiLabels } from '../shared/ui-copy.ts';
import type { RuntimeTaskViewState } from './runtime-event-consumer.ts';

function getCompletedTranslationCount(task: RuntimeTaskViewState) {
  return task.translationsCount ?? task.translations?.length ?? 0;
}

export function formatTaskProgress(
  task: RuntimeTaskViewState,
  labels: ContentUiLabels,
) {
  if (task.totalChunks !== null) {
    return `${task.completedChunks ?? 0}/${task.totalChunks}`;
  }

  if (task.translationsCount !== null) {
    return labels.messages.translatedSegments(task.translationsCount);
  }

  return labels.controls.runningHint;
}

export function getTaskDetailText(
  task: RuntimeTaskViewState,
  labels: ContentUiLabels,
) {
  switch (task.status) {
    case 'completed': {
      const completedCount = getCompletedTranslationCount(task);

      return task.phase === 'refine'
        ? labels.messages.completedRefineSegments(completedCount)
        : labels.messages.completedSegments(completedCount);
    }

    case 'failed':
      return task.errorCode
        ? labels.errors[task.errorCode as keyof typeof labels.errors] ??
            task.message ??
            ''
        : task.message ?? '';

    case 'cancelled':
      return labels.errors.ABORTED;

    default:
      return task.message ?? '';
  }
}
