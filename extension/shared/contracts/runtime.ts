import type { CacheMetadata, CacheRecord } from './cache.ts';
import type { ExportBundle } from './export.ts';
import type { Settings, SettingsInput } from './settings.ts';
import type {
  NormalizedTranscript,
  TranscriptSegment,
  TranslationChunk,
} from './transcript.ts';
import type { UsageSummary } from './usage.ts';

export type TaskPhase = 'translation' | 'refine';
export type TaskStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TranslationTask {
  taskId: string;
  videoId: string;
  phase: TaskPhase;
  status: TaskStatus;
  sourceLang?: Settings['sourceLang'];
  targetLang?: Settings['targetLang'];
  startedAt: number;
  updatedAt: number;
}

export interface TranslationStartRequest {
  videoId: string;
  title?: string;
  transcript: NormalizedTranscript;
  settings: Settings;
}

export interface TranslationResumeRequest extends TranslationStartRequest {
  cachedTranslations: TranslationChunk[];
}

export interface TranslationCancelRequest {
  taskId: string;
}

export interface RefineStartRequest {
  videoId: string;
  title?: string;
  original: TranscriptSegment[];
  draft: ExportBundle;
  settings: Settings;
}

export interface CacheImportRequest {
  videoId: string;
  title?: string;
  targetLang: Settings['targetLang'];
  translations: ExportBundle;
}

export interface TranslationProgressEvent {
  taskId: string;
  videoId: string;
  completedChunks: number;
  totalChunks: number;
  message?: string;
}

export interface TranslationRetryingEvent {
  taskId: string;
  videoId: string;
  phase: TaskPhase;
  attempt: number;
  message?: string;
}

export interface TranslationCompletedEvent {
  taskId: string;
  videoId: string;
  translations: TranslationChunk[];
}

export interface TranslationFailedEvent {
  taskId: string;
  videoId: string;
  code: string;
  message: string;
}

export interface TranslationCancelledEvent {
  taskId: string;
  videoId: string;
}

export interface RefineCompletedEvent {
  taskId: string;
  videoId: string;
  translations: TranslationChunk[];
}

export interface RefineFailedEvent {
  taskId: string;
  videoId: string;
  code: string;
  message: string;
}

export interface RuntimeCommandMap {
  'settings.get': {
    request: undefined;
    response: Settings;
  };
  'settings.save': {
    request: SettingsInput;
    response: Settings;
  };
  'translation.start': {
    request: TranslationStartRequest;
    response: { task: TranslationTask };
  };
  'translation.cancel': {
    request: TranslationCancelRequest;
    response: { cancelled: boolean };
  };
  'translation.resume': {
    request: TranslationResumeRequest;
    response: { task: TranslationTask };
  };
  'refine.start': {
    request: RefineStartRequest;
    response: { task: TranslationTask };
  };
  'cache.list': {
    request: undefined;
    response: CacheMetadata[];
  };
  'cache.get': {
    request: { videoId: string; targetLang: Settings['targetLang'] };
    response: CacheRecord | null;
  };
  'cache.import': {
    request: CacheImportRequest;
    response: CacheRecord;
  };
  'cache.delete': {
    request: { cacheKey: string };
    response: { deleted: boolean };
  };
  'cache.clear': {
    request: undefined;
    response: { cleared: boolean };
  };
  'usage.get': {
    request: undefined;
    response: UsageSummary;
  };
}

export interface RuntimeEventMap {
  'translation.progress': TranslationProgressEvent;
  'translation.retrying': TranslationRetryingEvent;
  'translation.completed': TranslationCompletedEvent;
  'translation.failed': TranslationFailedEvent;
  'translation.cancelled': TranslationCancelledEvent;
  'refine.completed': RefineCompletedEvent;
  'refine.failed': RefineFailedEvent;
}

export type RuntimeCommandType = keyof RuntimeCommandMap;
export type RuntimeEventType = keyof RuntimeEventMap;

type BuildCommand<T extends RuntimeCommandType> =
  RuntimeCommandMap[T]['request'] extends undefined
    ? { kind: 'runtime.command'; type: T }
    : {
        kind: 'runtime.command';
        type: T;
        payload: RuntimeCommandMap[T]['request'];
      };

export type RuntimeCommand<T extends RuntimeCommandType = RuntimeCommandType> =
  {
    [K in RuntimeCommandType]: BuildCommand<K>;
  }[T];

export type RuntimeEvent<T extends RuntimeEventType = RuntimeEventType> = {
  kind: 'runtime.event';
  type: T;
  payload: RuntimeEventMap[T];
};

export interface CommandSuccess<T extends RuntimeCommandType> {
  ok: true;
  kind: 'runtime.command.result';
  type: T;
  data: RuntimeCommandMap[T]['response'];
}

export interface CommandFailure<T extends RuntimeCommandType = RuntimeCommandType> {
  ok: false;
  kind: 'runtime.command.result';
  type: T;
  error: {
    code: string;
    message: string;
  };
}

export type RuntimeCommandResult<T extends RuntimeCommandType = RuntimeCommandType> =
  | CommandSuccess<T>
  | CommandFailure<T>;
