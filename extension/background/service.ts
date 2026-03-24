import { callGeminiRefine, callGeminiTranslate } from '../adapters/gemini/client.ts';
import { isRetryableGeminiError } from '../adapters/gemini/error-policy.ts';
import {
  readCacheRecord,
  saveCacheRecord,
  savePartialCacheRecord,
} from '../adapters/storage/cache-storage.ts';
import { getApiKey } from '../adapters/storage/api-key-storage.ts';
import { updateTokenUsage } from '../adapters/storage/usage-storage.ts';
import { withRetry } from '../domain/retry/with-retry.ts';
import {
  buildSourceChunkCheckpoints,
  resolveResumeState,
} from '../domain/resume/resume-resolver.ts';
import { chunkTranscript } from '../domain/transcript/chunking.ts';
import type {
  RefineStartRequest,
  SourceChunkCheckpoint,
  TranslationCancelRequest,
  TranslationChunk,
  TranslationResumeRequest,
  TranslationStartRequest,
} from '../shared/contracts/index.ts';
import { emitRuntimeEvent } from './events.ts';
import { TaskRegistry } from './task-registry.ts';

const MAX_RETRIES = 3;

interface BackgroundServiceDependencies {
  taskRegistry: TaskRegistry;
  getApiKey: typeof getApiKey;
  getTabTitle: (tabId: number) => Promise<string | null>;
  readCacheRecord: typeof readCacheRecord;
  chunkTranscript: typeof chunkTranscript;
  buildSourceChunkCheckpoints: typeof buildSourceChunkCheckpoints;
  resolveResumeState: typeof resolveResumeState;
  withRetry: typeof withRetry;
  queueTask: (work: () => Promise<void>) => void;
  retryBaseDelayMs: number;
  callGeminiTranslate: typeof callGeminiTranslate;
  callGeminiRefine: typeof callGeminiRefine;
  isRetryableGeminiError: typeof isRetryableGeminiError;
  updateTokenUsage: typeof updateTokenUsage;
  saveCacheRecord: typeof saveCacheRecord;
  savePartialCacheRecord: typeof savePartialCacheRecord;
  emitRuntimeEvent: typeof emitRuntimeEvent;
}

interface RuntimeContext {
  tabId?: number | null;
}

export class BackgroundCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BackgroundCommandError';
    this.code = code;
  }
}

interface ResumeExecutionState {
  startChunkIndex: number;
  initialTranslations: TranslationChunk[];
  sourceChunkCheckpoints: SourceChunkCheckpoint[];
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function createEmptyTranscriptError() {
  return new BackgroundCommandError(
    'EMPTY_TRANSCRIPT',
    'Translation start requires at least one transcript segment.',
  );
}

function createEmptyDraftError() {
  return new BackgroundCommandError(
    'EMPTY_DRAFT',
    'Refine start requires at least one translated draft segment.',
  );
}

function toUsageTotals(usage: {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
}) {
  return {
    input: usage.promptTokenCount,
    output: usage.candidatesTokenCount + usage.thoughtsTokenCount,
  };
}

function toFailureCode(error: unknown, fallbackCode: string) {
  if (isAbortError(error)) {
    return 'ABORTED';
  }

  const message = error instanceof Error ? error.message : String(error ?? '');
  return /^[A-Z_]+$/.test(message) ? message : fallbackCode;
}

function toFailureMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function buildPreviousContext(translations: TranslationChunk[]) {
  return translations
    .slice(-3)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(' ');
}

function normalizeTitle(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

async function getChromeTabTitle(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return normalizeTitle(tab.title);
  } catch {
    return null;
  }
}

async function ensureApiKey(
  getStoredApiKey: BackgroundServiceDependencies['getApiKey'],
) {
  const apiKey = await getStoredApiKey();
  if (!apiKey) {
    throw new BackgroundCommandError(
      'API_KEY_MISSING',
      'API Key가 설정되지 않았습니다.',
    );
  }

  return apiKey;
}

export function createBackgroundService(
  overrides: Partial<BackgroundServiceDependencies> = {},
) {
  const dependencies: BackgroundServiceDependencies = {
    taskRegistry: new TaskRegistry(),
    getApiKey,
    getTabTitle: getChromeTabTitle,
    readCacheRecord,
    chunkTranscript,
    buildSourceChunkCheckpoints,
    resolveResumeState,
    withRetry,
    queueTask(work) {
      void work();
    },
    retryBaseDelayMs: 1000,
    callGeminiTranslate,
    callGeminiRefine,
    isRetryableGeminiError,
    updateTokenUsage,
    saveCacheRecord,
    savePartialCacheRecord,
    emitRuntimeEvent,
    ...overrides,
  };

  async function resolveCacheTitle(
    requestedTitle: string | undefined,
    videoId: string,
    tabId: number | null,
  ) {
    const explicitTitle = normalizeTitle(requestedTitle);
    if (explicitTitle) {
      return explicitTitle;
    }

    if (typeof tabId === 'number') {
      const tabTitle = await dependencies.getTabTitle(tabId);
      if (tabTitle) {
        return tabTitle;
      }
    }

    return videoId;
  }

  async function safePersistCache(
    label: 'partial' | 'final' | 'refine-final',
    taskId: string,
    videoId: string,
    write: () => Promise<unknown>,
  ) {
    try {
      await write();
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'Unknown error');
      console.warn(
        `[YT AI Translator] Cache ${label} write failed for ${videoId} (${taskId}): ${message}`,
      );
      return false;
    }
  }

  async function runTranslationTask(
    apiKey: string,
    request: TranslationStartRequest,
    taskId: string,
    tabId: number | null,
    resumeState?: ResumeExecutionState,
  ) {
    const signal = dependencies.taskRegistry.getSignal(taskId);
    if (!signal) return;

    const segments = request.transcript.grouped.length
      ? request.transcript.grouped
      : request.transcript.raw;
    const chunks = dependencies.chunkTranscript(segments);
    const sourceChunkCheckpoints =
      resumeState?.sourceChunkCheckpoints ??
      dependencies.buildSourceChunkCheckpoints(chunks);
    const cacheTitle = await resolveCacheTitle(request.title, request.videoId, tabId);
    let translations = [...(resumeState?.initialTranslations ?? [])];
    let previousContext = buildPreviousContext(translations);
    const startChunkIndex = Math.max(0, resumeState?.startChunkIndex ?? 0);

    try {
      dependencies.taskRegistry.updateTaskStatus(taskId, 'running');

      if (startChunkIndex > 0 && startChunkIndex <= chunks.length) {
        await dependencies.emitRuntimeEvent({
          type: 'translation.progress',
          tabId,
          payload: {
            taskId,
            videoId: request.videoId,
            completedChunks: startChunkIndex,
            totalChunks: chunks.length,
          },
        });
      }

      for (let index = startChunkIndex; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const result = await dependencies.withRetry(
          () =>
            dependencies.callGeminiTranslate({
              apiKey,
              chunk,
              settings: request.settings,
              chunkIndex: index + 1,
              totalChunks: chunks.length,
              previousContext,
              signal,
            }),
          {
            maxRetries: MAX_RETRIES,
            baseDelayMs: dependencies.retryBaseDelayMs,
            isRetryable: dependencies.isRetryableGeminiError,
            signal,
            onRetry: async ({ attempt, error }) => {
              dependencies.taskRegistry.updateTaskStatus(taskId, 'retrying');
              await dependencies.emitRuntimeEvent({
                type: 'translation.retrying',
                tabId,
                payload: {
                  taskId,
                  videoId: request.videoId,
                  phase: 'translation',
                  attempt,
                  message: error.message,
                },
              });
            },
          },
        );

        dependencies.taskRegistry.updateTaskStatus(taskId, 'running');
        translations = [...translations, ...result.parsed];
        previousContext = buildPreviousContext(result.parsed) || previousContext;

        const usageTotals = toUsageTotals(result.usage);
        await dependencies.updateTokenUsage(usageTotals.input, usageTotals.output);

        await safePersistCache('partial', taskId, request.videoId, () =>
          dependencies.savePartialCacheRecord(request.videoId, translations, {
            title: cacheTitle,
            sourceLang: request.settings.sourceLang,
            targetLang: request.settings.targetLang,
            completedChunkCount: index + 1,
            transcriptFingerprint: request.transcript.fingerprint,
            sourceChunkCheckpoints,
          }),
        );

        await dependencies.emitRuntimeEvent({
          type: 'translation.progress',
          tabId,
          payload: {
            taskId,
            videoId: request.videoId,
            completedChunks: index + 1,
            totalChunks: chunks.length,
          },
        });
      }

      await safePersistCache('final', taskId, request.videoId, () =>
        dependencies.saveCacheRecord(request.videoId, translations, {
          title: cacheTitle,
          sourceLang: request.settings.sourceLang,
          targetLang: request.settings.targetLang,
          completedChunkCount: chunks.length,
          transcriptFingerprint: request.transcript.fingerprint,
          sourceChunkCheckpoints,
        }),
      );

      dependencies.taskRegistry.updateTaskStatus(taskId, 'completed');
      await dependencies.emitRuntimeEvent({
        type: 'translation.completed',
        tabId,
        payload: {
          taskId,
          videoId: request.videoId,
          translations,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dependencies.taskRegistry.updateTaskStatus(taskId, 'cancelled');
        await dependencies.emitRuntimeEvent({
          type: 'translation.cancelled',
          tabId,
          payload: {
            taskId,
            videoId: request.videoId,
          },
        });
        return;
      }

      dependencies.taskRegistry.updateTaskStatus(taskId, 'failed');
      await dependencies.emitRuntimeEvent({
        type: 'translation.failed',
        tabId,
        payload: {
          taskId,
          videoId: request.videoId,
          code: toFailureCode(error, 'TRANSLATION_FAILED'),
          message: toFailureMessage(error, '번역에 실패했습니다.'),
        },
      });
    } finally {
      dependencies.taskRegistry.finalizeTask(taskId);
    }
  }

  async function runRefineTask(
    apiKey: string,
    request: RefineStartRequest,
    taskId: string,
    tabId: number | null,
  ) {
    const signal = dependencies.taskRegistry.getSignal(taskId);
    if (!signal) return;
    const cacheTitle = await resolveCacheTitle(request.title, request.videoId, tabId);

    try {
      dependencies.taskRegistry.updateTaskStatus(taskId, 'running');

      const result = await dependencies.withRetry(
        () =>
          dependencies.callGeminiRefine({
            apiKey,
            original: request.original,
            draft: request.draft,
            settings: request.settings,
            signal,
          }),
        {
          maxRetries: MAX_RETRIES,
          baseDelayMs: dependencies.retryBaseDelayMs,
          isRetryable: dependencies.isRetryableGeminiError,
          signal,
          onRetry: async ({ attempt, error }) => {
            dependencies.taskRegistry.updateTaskStatus(taskId, 'retrying');
            await dependencies.emitRuntimeEvent({
              type: 'translation.retrying',
              tabId,
              payload: {
                taskId,
                videoId: request.videoId,
                phase: 'refine',
                attempt,
                message: error.message,
              },
            });
          },
        },
      );

      const usageTotals = toUsageTotals(result.usage);
      await dependencies.updateTokenUsage(usageTotals.input, usageTotals.output);

      await safePersistCache('refine-final', taskId, request.videoId, () =>
        dependencies.saveCacheRecord(request.videoId, result.parsed, {
          title: cacheTitle,
          sourceLang: request.settings.sourceLang,
          targetLang: request.settings.targetLang,
          isRefined: true,
        }),
      );

      dependencies.taskRegistry.updateTaskStatus(taskId, 'completed');
      await dependencies.emitRuntimeEvent({
        type: 'refine.completed',
        tabId,
        payload: {
          taskId,
          videoId: request.videoId,
          translations: result.parsed,
        },
      });
    } catch (error) {
      if (isAbortError(error)) {
        dependencies.taskRegistry.updateTaskStatus(taskId, 'cancelled');
        await dependencies.emitRuntimeEvent({
          type: 'translation.cancelled',
          tabId,
          payload: {
            taskId,
            videoId: request.videoId,
          },
        });
        return;
      }

      dependencies.taskRegistry.updateTaskStatus(taskId, 'failed');
      await dependencies.emitRuntimeEvent({
        type: 'refine.failed',
        tabId,
        payload: {
          taskId,
          videoId: request.videoId,
          code: toFailureCode(error, 'REFINE_FAILED'),
          message: toFailureMessage(error, '재분할에 실패했습니다.'),
        },
      });
    } finally {
      dependencies.taskRegistry.finalizeTask(taskId);
    }
  }

  return {
    async startTranslation(
      request: TranslationStartRequest,
      context: RuntimeContext = {},
    ) {
      const segments = request.transcript.grouped.length
        ? request.transcript.grouped
        : request.transcript.raw;
      const chunks = dependencies.chunkTranscript(segments);
      if (chunks.length === 0) {
        throw createEmptyTranscriptError();
      }

      const apiKey = await ensureApiKey(dependencies.getApiKey);
      const started = dependencies.taskRegistry.startTask({
        videoId: request.videoId,
        phase: 'translation',
        sourceLang: request.settings.sourceLang,
        targetLang: request.settings.targetLang,
        tabId: context.tabId,
      });

      dependencies.queueTask(async () => {
        await runTranslationTask(
          apiKey,
          request,
          started.task.taskId,
          context.tabId ?? null,
        );
      });

      return { task: started.task };
    },

    async resumeTranslation(
      request: TranslationResumeRequest,
      context: RuntimeContext = {},
    ) {
      const segments = request.transcript.grouped.length
        ? request.transcript.grouped
        : request.transcript.raw;
      const chunks = dependencies.chunkTranscript(segments);
      if (chunks.length === 0) {
        throw createEmptyTranscriptError();
      }

      const apiKey = await ensureApiKey(dependencies.getApiKey);
      const cachedRecord = await dependencies.readCacheRecord(
        request.videoId,
        request.settings.targetLang,
      );

      const resumeState = dependencies.resolveResumeState({
        cached: cachedRecord
          ? {
              completedChunkCount: cachedRecord.completedChunkCount,
              transcriptFingerprint: cachedRecord.transcriptFingerprint,
              sourceChunkCheckpoints: cachedRecord.sourceChunkCheckpoints,
              translations:
                request.cachedTranslations.length > 0
                  ? request.cachedTranslations
                  : cachedRecord.translations,
            }
          : request.cachedTranslations.length > 0
            ? {
                translations: request.cachedTranslations,
              }
            : null,
        chunks,
        transcriptFingerprint: request.transcript.fingerprint,
      });

      const started = dependencies.taskRegistry.startTask({
        videoId: request.videoId,
        phase: 'translation',
        sourceLang: request.settings.sourceLang,
        targetLang: request.settings.targetLang,
        tabId: context.tabId,
      });

      dependencies.queueTask(async () => {
        await runTranslationTask(
          apiKey,
          request,
          started.task.taskId,
          context.tabId ?? null,
          {
            startChunkIndex: resumeState.startChunkIndex,
            initialTranslations: resumeState.initialTranslations,
            sourceChunkCheckpoints: resumeState.sourceChunkCheckpoints,
          },
        );
      });

      return { task: started.task };
    },

    async cancelTranslation(request: TranslationCancelRequest) {
      return {
        cancelled: dependencies.taskRegistry.cancelTask(request.taskId),
      };
    },

    async startRefine(request: RefineStartRequest, context: RuntimeContext = {}) {
      if (request.original.length === 0) {
        throw createEmptyTranscriptError();
      }

      if (request.draft.length === 0) {
        throw createEmptyDraftError();
      }

      const apiKey = await ensureApiKey(dependencies.getApiKey);
      const started = dependencies.taskRegistry.startTask({
        videoId: request.videoId,
        phase: 'refine',
        sourceLang: request.settings.sourceLang,
        targetLang: request.settings.targetLang,
        tabId: context.tabId,
      });

      dependencies.queueTask(async () => {
        await runRefineTask(
          apiKey,
          request,
          started.task.taskId,
          context.tabId ?? null,
        );
      });
      return { task: started.task };
    },

    cancelTasksForTab(tabId: number, reason?: string) {
      return dependencies.taskRegistry.cancelTasksForTab(tabId, reason);
    },
  };
}
