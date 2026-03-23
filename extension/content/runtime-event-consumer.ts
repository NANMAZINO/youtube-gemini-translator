import type {
  RuntimeEvent,
  RuntimeEventType,
  TaskPhase,
  TaskStatus,
  TranslationChunk,
} from '../shared/contracts/index.ts';

type KnownRuntimeEvent = {
  [K in RuntimeEventType]: RuntimeEvent<K>;
}[RuntimeEventType];

export interface RuntimeTaskViewState {
  taskId: string;
  videoId: string;
  phase: TaskPhase;
  status: TaskStatus;
  completedChunks: number | null;
  totalChunks: number | null;
  attempt: number | null;
  translationsCount: number | null;
  translations: TranslationChunk[] | null;
  errorCode: string | null;
  message: string | null;
  lastEventType: RuntimeEventType;
  updatedAt: number;
}

export interface RuntimeTaskProjection {
  latestTaskId: string | null;
  tasks: Record<string, RuntimeTaskViewState>;
}

interface RuntimeEventConsumerOptions {
  onTaskUpdated?: (
    task: RuntimeTaskViewState,
    projection: RuntimeTaskProjection,
  ) => void;
  onTaskFinished?: (
    task: RuntimeTaskViewState,
    projection: RuntimeTaskProjection,
  ) => void;
}

const TERMINAL_STATUSES = new Set<TaskStatus>([
  'completed',
  'failed',
  'cancelled',
]);

export function createInitialRuntimeTaskProjection(): RuntimeTaskProjection {
  return {
    latestTaskId: null,
    tasks: {},
  };
}

export function isTerminalTaskStatus(status: TaskStatus) {
  return TERMINAL_STATUSES.has(status);
}

function resolvePhase(
  event: KnownRuntimeEvent,
  previous: RuntimeTaskViewState | undefined,
): TaskPhase {
  switch (event.type) {
    case 'refine.completed':
    case 'refine.failed':
      return 'refine';

    case 'translation.retrying': {
      return event.payload.phase;
    }

    case 'translation.cancelled':
      return previous?.phase ?? 'translation';

    default:
      return 'translation';
  }
}

function resolveStatus(eventType: RuntimeEventType): TaskStatus {
  switch (eventType) {
    case 'translation.progress':
      return 'running';

    case 'translation.retrying':
      return 'retrying';

    case 'translation.completed':
    case 'refine.completed':
      return 'completed';

    case 'translation.failed':
    case 'refine.failed':
      return 'failed';

    case 'translation.cancelled':
      return 'cancelled';
  }
}

function countTranslations(event: KnownRuntimeEvent) {
  switch (event.type) {
    case 'translation.completed':
    case 'refine.completed': {
      return event.payload.translations.length;
    }

    default:
      return null;
  }
}

function resolveTranslations(
  event: KnownRuntimeEvent,
  previous: RuntimeTaskViewState | undefined,
) {
  switch (event.type) {
    case 'translation.completed':
    case 'refine.completed':
      return event.payload.translations;

    default:
      return previous?.translations ?? null;
  }
}

function resolveMessage(
  event: KnownRuntimeEvent,
  previous: RuntimeTaskViewState | undefined,
) {
  switch (event.type) {
    case 'translation.progress':
    case 'translation.retrying':
    case 'translation.failed':
    case 'refine.failed': {
      return event.payload.message ?? previous?.message ?? null;
    }

    case 'translation.completed': {
      return `Completed ${event.payload.translations.length} translated segments.`;
    }

    case 'refine.completed': {
      return `Completed refine output with ${event.payload.translations.length} segments.`;
    }

    case 'translation.cancelled':
      return previous?.message ?? 'Task cancelled.';
  }
}

export function projectRuntimeEvent(
  projection: RuntimeTaskProjection,
  event: KnownRuntimeEvent,
  now = Date.now(),
): RuntimeTaskProjection {
  const previous = projection.tasks[event.payload.taskId];
  let completedChunks = previous?.completedChunks ?? null;
  let totalChunks = previous?.totalChunks ?? null;
  let attempt = previous?.attempt ?? null;
  let errorCode: string | null = null;
  const translations = resolveTranslations(event, previous);

  switch (event.type) {
    case 'translation.progress':
      completedChunks = event.payload.completedChunks;
      totalChunks = event.payload.totalChunks;
      break;

    case 'translation.retrying':
      attempt = event.payload.attempt;
      break;

    case 'translation.failed':
    case 'refine.failed':
      errorCode = event.payload.code;
      break;

    default:
      break;
  }

  const nextTask: RuntimeTaskViewState = {
    taskId: event.payload.taskId,
    videoId: event.payload.videoId,
    phase: resolvePhase(event, previous),
    status: resolveStatus(event.type),
    completedChunks,
    totalChunks,
    attempt,
    translationsCount:
      countTranslations(event) ?? previous?.translationsCount ?? null,
    translations,
    errorCode,
    message: resolveMessage(event, previous),
    lastEventType: event.type,
    updatedAt: now,
  };

  return {
    latestTaskId: nextTask.taskId,
    tasks: {
      ...projection.tasks,
      [nextTask.taskId]: nextTask,
    },
  };
}

export function getLatestTaskView(
  projection: RuntimeTaskProjection,
): RuntimeTaskViewState | null {
  if (!projection.latestTaskId) {
    return null;
  }

  return projection.tasks[projection.latestTaskId] ?? null;
}

export function createRuntimeEventConsumer(
  options: RuntimeEventConsumerOptions = {},
) {
  let projection = createInitialRuntimeTaskProjection();

  function handleRuntimeEvent(event: RuntimeEvent) {
    projection = projectRuntimeEvent(projection, event as KnownRuntimeEvent);
    const task = getLatestTaskView(projection);

    if (!task) {
      return false;
    }

    options.onTaskUpdated?.(task, projection);

    if (isTerminalTaskStatus(task.status)) {
      options.onTaskFinished?.(task, projection);
    }

    return false;
  }

  function handleMessage(message: unknown) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (
      !('kind' in message) ||
      !('type' in message) ||
      message.kind !== 'runtime.event' ||
      typeof message.type !== 'string'
    ) {
      return false;
    }

    return handleRuntimeEvent(message as RuntimeEvent);
  }

  return {
    getProjection() {
      return projection;
    },
    getLatestTaskView() {
      return getLatestTaskView(projection);
    },
    handleRuntimeEvent,
    handleMessage,
  };
}
