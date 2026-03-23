import assert from 'node:assert/strict';
import test from 'node:test';

import { createBackgroundService } from './service.ts';
import { createAbortError, withRetry } from '../domain/retry/with-retry.ts';

function waitFor(check, { timeoutMs = 200, intervalMs = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function poll() {
      if (check()) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for async background task'));
        return;
      }

      setTimeout(poll, intervalMs);
    }

    poll();
  });
}

function createBaseRequest() {
  return {
    videoId: 'video-123',
    transcript: {
      raw: [
        { start: '0:01', text: 'hello' },
        { start: '0:02', text: 'world' },
      ],
      grouped: [
        { start: '0:01', text: 'hello' },
        { start: '0:02', text: 'world' },
      ],
      fingerprint: 'fp-123',
    },
    settings: {
      sourceLang: 'Auto',
      targetLang: 'English',
      thinkingLevel: 'minimal',
      resumeMode: true,
      schemaVersion: 1,
    },
  };
}

test('startTranslation emits progress and completed events and persists partial/final cache', async () => {
  const events = [];
  const partialSaves = [];
  const finalSaves = [];
  const usageUpdates = [];

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    getTabTitle: async () => 'Readable Video Title',
    chunkTranscript: () => [
      [{ start: '0:01', text: 'hello' }],
      [{ start: '0:02', text: 'world' }],
    ],
    buildSourceChunkCheckpoints: () => [
      {
        chunkIndex: 0,
        chunkFingerprint: 'chunk-1',
        firstStartSec: 1,
        lastStartSec: 1,
        segmentCount: 1,
      },
      {
        chunkIndex: 1,
        chunkFingerprint: 'chunk-2',
        firstStartSec: 2,
        lastStartSec: 2,
        segmentCount: 1,
      },
    ],
    callGeminiTranslate: async ({ chunkIndex }) => ({
      parsed: [{ start: `0:0${chunkIndex}`, text: `translated-${chunkIndex}` }],
      usage: {
        promptTokenCount: chunkIndex,
        candidatesTokenCount: chunkIndex + 1,
        thoughtsTokenCount: 0,
      },
    }),
    updateTokenUsage: async (input, output) => {
      usageUpdates.push({ input, output });
    },
    savePartialCacheRecord: async (videoId, translations, metadata) => {
      partialSaves.push({ videoId, translations, metadata });
      return {
        cacheKey: `${videoId}_${metadata.targetLang}`,
        originalVideoId: videoId,
        title: metadata.title ?? 'Unknown Video',
        sourceLang: metadata.sourceLang ?? 'Auto',
        targetLang: metadata.targetLang ?? 'English',
        timestamp: Date.now(),
        translations,
        isRefined: false,
        isPartial: true,
        completedChunkCount: metadata.completedChunkCount ?? 0,
        transcriptFingerprint: metadata.transcriptFingerprint ?? '',
        sourceChunkCheckpoints: metadata.sourceChunkCheckpoints ?? [],
        schemaVersion: 1,
      };
    },
    saveCacheRecord: async (videoId, translations, metadata) => {
      finalSaves.push({ videoId, translations, metadata });
      return {
        cacheKey: `${videoId}_${metadata.targetLang}`,
        originalVideoId: videoId,
        title: metadata.title ?? 'Unknown Video',
        sourceLang: metadata.sourceLang ?? 'Auto',
        targetLang: metadata.targetLang ?? 'English',
        timestamp: Date.now(),
        translations,
        isRefined: !!metadata.isRefined,
        isPartial: !!metadata.isPartial,
        completedChunkCount: metadata.completedChunkCount ?? 0,
        transcriptFingerprint: metadata.transcriptFingerprint ?? '',
        sourceChunkCheckpoints: metadata.sourceChunkCheckpoints ?? [],
        schemaVersion: 1,
      };
    },
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  const { task } = await service.startTranslation(createBaseRequest(), { tabId: 7 });
  assert.equal(task.phase, 'translation');
  assert.equal(task.status, 'preparing');

  await waitFor(() => events.some((event) => event.type === 'translation.completed'));

  assert.deepEqual(
    events.map((event) => event.type),
    ['translation.progress', 'translation.progress', 'translation.completed'],
  );
  assert.equal(partialSaves.length, 2);
  assert.equal(finalSaves.length, 1);
  assert.deepEqual(usageUpdates, [
    { input: 1, output: 2 },
    { input: 2, output: 3 },
  ]);
  assert.equal(partialSaves[0].metadata.title, 'Readable Video Title');
  assert.equal(finalSaves[0].metadata.title, 'Readable Video Title');
  assert.equal(finalSaves[0].translations.length, 2);
});

test('cancelTranslation aborts an in-flight translation task and emits cancellation', async () => {
  const events = [];

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    chunkTranscript: () => [[{ start: '0:01', text: 'hello' }]],
    buildSourceChunkCheckpoints: () => [],
    callGeminiTranslate: ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            reject(createAbortError());
          },
          { once: true },
        );
      }),
    savePartialCacheRecord: async () => {
      throw new Error('should not save partial cache after cancellation');
    },
    saveCacheRecord: async () => {
      throw new Error('should not save final cache after cancellation');
    },
    updateTokenUsage: async () => {},
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  const { task } = await service.startTranslation(createBaseRequest(), { tabId: 9 });
  const cancelled = await service.cancelTranslation({ taskId: task.taskId });

  assert.equal(cancelled.cancelled, true);

  await waitFor(() => events.some((event) => event.type === 'translation.cancelled'));
  assert.equal(events.at(-1).type, 'translation.cancelled');
});

test('translation still completes when cache persistence fails', async () => {
  const events = [];

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    getTabTitle: async () => 'Title From Tab',
    chunkTranscript: () => [[{ start: '0:01', text: 'hello' }]],
    buildSourceChunkCheckpoints: () => [],
    callGeminiTranslate: async () => ({
      parsed: [{ start: '0:01', text: 'translated' }],
      usage: {
        promptTokenCount: 3,
        candidatesTokenCount: 4,
        thoughtsTokenCount: 0,
      },
    }),
    savePartialCacheRecord: async () => {
      throw new Error('quota exceeded');
    },
    saveCacheRecord: async () => {
      throw new Error('quota exceeded');
    },
    updateTokenUsage: async () => {},
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  await service.startTranslation(createBaseRequest(), { tabId: 12 });
  await waitFor(() => events.some((event) => event.type === 'translation.completed'));

  assert.deepEqual(
    events.map((event) => event.type),
    ['translation.progress', 'translation.completed'],
  );
});

test('resumeTranslation continues from the cached chunk index when fingerprints match', async () => {
  const events = [];
  const translateCalls = [];

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    getTabTitle: async () => 'Readable Video Title',
    chunkTranscript: () => [
      [{ start: '0:01', text: 'hello' }],
      [{ start: '0:02', text: 'world' }],
      [{ start: '0:03', text: 'again' }],
    ],
    buildSourceChunkCheckpoints: () => [
      {
        chunkIndex: 0,
        chunkFingerprint: 'chunk-1',
        firstStartSec: 1,
        lastStartSec: 1,
        segmentCount: 1,
      },
      {
        chunkIndex: 1,
        chunkFingerprint: 'chunk-2',
        firstStartSec: 2,
        lastStartSec: 2,
        segmentCount: 1,
      },
      {
        chunkIndex: 2,
        chunkFingerprint: 'chunk-3',
        firstStartSec: 3,
        lastStartSec: 3,
        segmentCount: 1,
      },
    ],
    readCacheRecord: async () => ({
      cacheKey: 'video-123_English',
      originalVideoId: 'video-123',
      title: 'Readable Video Title',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [
        { start: '0:01', text: 'translated-1' },
        { start: '0:02', text: 'translated-2' },
      ],
      isRefined: false,
      isPartial: true,
      completedChunkCount: 2,
      transcriptFingerprint: 'fp-123',
      sourceChunkCheckpoints: [
        {
          chunkIndex: 0,
          chunkFingerprint: 'chunk-1',
          firstStartSec: 1,
          lastStartSec: 1,
          segmentCount: 1,
        },
        {
          chunkIndex: 1,
          chunkFingerprint: 'chunk-2',
          firstStartSec: 2,
          lastStartSec: 2,
          segmentCount: 1,
        },
      ],
      schemaVersion: 1,
    }),
    callGeminiTranslate: async ({ chunkIndex }) => {
      translateCalls.push(chunkIndex);
      return {
        parsed: [{ start: '0:03', text: 'translated-3' }],
        usage: {
          promptTokenCount: 3,
          candidatesTokenCount: 4,
          thoughtsTokenCount: 0,
        },
      };
    },
    updateTokenUsage: async () => {},
    savePartialCacheRecord: async () => ({
      cacheKey: 'video-123_English',
      originalVideoId: 'video-123',
      title: 'Readable Video Title',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [],
      isRefined: false,
      isPartial: true,
      completedChunkCount: 3,
      transcriptFingerprint: 'fp-123',
      sourceChunkCheckpoints: [],
      schemaVersion: 1,
    }),
    saveCacheRecord: async () => ({
      cacheKey: 'video-123_English',
      originalVideoId: 'video-123',
      title: 'Readable Video Title',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [],
      isRefined: false,
      isPartial: false,
      completedChunkCount: 3,
      transcriptFingerprint: 'fp-123',
      sourceChunkCheckpoints: [],
      schemaVersion: 1,
    }),
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  await service.resumeTranslation({
    ...createBaseRequest(),
    cachedTranslations: [],
  });

  await waitFor(() => events.some((event) => event.type === 'translation.completed'));

  assert.deepEqual(translateCalls, [3]);
  assert.deepEqual(
    events.map((event) => event.type),
    ['translation.progress', 'translation.progress', 'translation.completed'],
  );
  assert.equal(events[0].payload.completedChunks, 2);
  assert.equal(events[1].payload.completedChunks, 3);
  assert.equal(events.at(-1).payload.translations.length, 3);
});

test('resumeTranslation completes immediately when cached progress already covers all chunks', async () => {
  const events = [];
  let translateCalls = 0;

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    getTabTitle: async () => 'Readable Video Title',
    chunkTranscript: () => [
      [{ start: '0:01', text: 'hello' }],
      [{ start: '0:02', text: 'world' }],
    ],
    buildSourceChunkCheckpoints: () => [
      {
        chunkIndex: 0,
        chunkFingerprint: 'chunk-1',
        firstStartSec: 1,
        lastStartSec: 1,
        segmentCount: 1,
      },
      {
        chunkIndex: 1,
        chunkFingerprint: 'chunk-2',
        firstStartSec: 2,
        lastStartSec: 2,
        segmentCount: 1,
      },
    ],
    readCacheRecord: async () => ({
      cacheKey: 'video-123_English',
      originalVideoId: 'video-123',
      title: 'Readable Video Title',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [
        { start: '0:01', text: 'translated-1' },
        { start: '0:02', text: 'translated-2' },
      ],
      isRefined: false,
      isPartial: false,
      completedChunkCount: 2,
      transcriptFingerprint: 'fp-123',
      sourceChunkCheckpoints: [
        {
          chunkIndex: 0,
          chunkFingerprint: 'chunk-1',
          firstStartSec: 1,
          lastStartSec: 1,
          segmentCount: 1,
        },
        {
          chunkIndex: 1,
          chunkFingerprint: 'chunk-2',
          firstStartSec: 2,
          lastStartSec: 2,
          segmentCount: 1,
        },
      ],
      schemaVersion: 1,
    }),
    callGeminiTranslate: async () => {
      translateCalls += 1;
      return {
        parsed: [{ start: '0:03', text: 'unexpected' }],
        usage: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          thoughtsTokenCount: 0,
        },
      };
    },
    updateTokenUsage: async () => {},
    saveCacheRecord: async () => ({
      cacheKey: 'video-123_English',
      originalVideoId: 'video-123',
      title: 'Readable Video Title',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [],
      isRefined: false,
      isPartial: false,
      completedChunkCount: 2,
      transcriptFingerprint: 'fp-123',
      sourceChunkCheckpoints: [],
      schemaVersion: 1,
    }),
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  await service.resumeTranslation({
    ...createBaseRequest(),
    cachedTranslations: [],
  });

  await waitFor(() => events.some((event) => event.type === 'translation.completed'));

  assert.equal(translateCalls, 0);
  assert.deepEqual(
    events.map((event) => event.type),
    ['translation.progress', 'translation.completed'],
  );
  assert.equal(events[0].payload.completedChunks, 2);
  assert.equal(events.at(-1).payload.translations.length, 2);
});

test('startRefine retries retryable errors before emitting refine.completed', async () => {
  const events = [];
  const usageUpdates = [];
  const cacheWrites = [];
  let attempts = 0;

  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
    getTabTitle: async () => 'Readable Video Title',
    withRetry: (fn, options = {}) =>
      withRetry(fn, {
        ...options,
        baseDelayMs: 1,
      }),
    callGeminiRefine: async ({ signal }) => {
      if (signal.aborted) {
        throw createAbortError();
      }

      attempts += 1;
      if (attempts === 1) {
        throw new Error('MODEL_OVERLOADED');
      }

      return {
        parsed: [{ start: '0:01', text: 'refined line' }],
        usage: {
          promptTokenCount: 5,
          candidatesTokenCount: 7,
          thoughtsTokenCount: 1,
        },
      };
    },
    updateTokenUsage: async (input, output) => {
      usageUpdates.push({ input, output });
    },
    saveCacheRecord: async (videoId, translations, metadata) => {
      cacheWrites.push({ videoId, translations, metadata });
      return {
        cacheKey: `${videoId}_${metadata.targetLang}`,
        originalVideoId: videoId,
        title: metadata.title ?? 'Unknown Video',
        sourceLang: metadata.sourceLang ?? 'Auto',
        targetLang: metadata.targetLang ?? 'English',
        timestamp: Date.now(),
        translations,
        isRefined: !!metadata.isRefined,
        isPartial: !!metadata.isPartial,
        completedChunkCount: metadata.completedChunkCount ?? 0,
        transcriptFingerprint: metadata.transcriptFingerprint ?? '',
        sourceChunkCheckpoints: metadata.sourceChunkCheckpoints ?? [],
        schemaVersion: 1,
      };
    },
    emitRuntimeEvent: async (event) => {
      events.push(event);
      return true;
    },
  });

  const request = {
    videoId: 'video-123',
    original: [
      { start: '0:01', text: 'hello' },
      { start: '0:02', text: 'world' },
    ],
    draft: [{ start: '0:01', text: 'hello world' }],
    settings: createBaseRequest().settings,
  };

  const { task } = await service.startRefine(request, { tabId: 11 });
  assert.equal(task.phase, 'refine');

  await waitFor(() => events.some((event) => event.type === 'refine.completed'));

  assert.deepEqual(
    events.map((event) => event.type),
    ['translation.retrying', 'refine.completed'],
  );
  assert.deepEqual(usageUpdates, [{ input: 5, output: 8 }]);
  assert.equal(cacheWrites[0].metadata.title, 'Readable Video Title');
});

test('startTranslation fails fast when the transcript is empty', async () => {
  const service = createBackgroundService({
    getApiKey: async () => 'test-api-key',
  });

  await assert.rejects(
    service.startTranslation({
      videoId: 'empty-video',
      transcript: {
        raw: [],
        grouped: [],
        fingerprint: 'empty',
      },
      settings: createBaseRequest().settings,
    }),
    (error) =>
      error instanceof Error &&
      error.name === 'BackgroundCommandError' &&
      error.message === 'Translation start requires at least one transcript segment.',
  );
});
