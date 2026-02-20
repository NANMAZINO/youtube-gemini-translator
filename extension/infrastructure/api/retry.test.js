import assert from 'node:assert/strict';
import test from 'node:test';

import { withRetry } from './retry.js';

test('withRetry: returns immediately on success', async () => {
  let attempts = 0;

  const result = await withRetry(
    async () => {
      attempts += 1;
      return 'ok';
    },
    {
      maxRetries: 3,
      isRetryable: () => true,
      baseDelayMs: 1,
    },
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 1);
});

test('withRetry: retries retryable errors with exponential backoff', async () => {
  let attempts = 0;
  const retryEvents = [];

  const result = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('MODEL_OVERLOADED');
      return 'done';
    },
    {
      maxRetries: 3,
      isRetryable: (error) => error.message === 'MODEL_OVERLOADED',
      baseDelayMs: 1,
      onRetry: ({ attempt, delayMs, error }) => {
        retryEvents.push({ attempt, delayMs, message: error.message });
      },
    },
  );

  assert.equal(result, 'done');
  assert.equal(attempts, 3);
  assert.deepEqual(retryEvents, [
    { attempt: 1, delayMs: 2, message: 'MODEL_OVERLOADED' },
    { attempt: 2, delayMs: 4, message: 'MODEL_OVERLOADED' },
  ]);
});

test('withRetry: non-retryable errors are thrown immediately', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error('fatal');
      },
      {
        maxRetries: 5,
        isRetryable: () => false,
        baseDelayMs: 1,
      },
    ),
    /fatal/,
  );

  assert.equal(attempts, 1);
});

test('withRetry: throws when max retries are exceeded', async () => {
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error('MODEL_OVERLOADED');
      },
      {
        maxRetries: 2,
        isRetryable: () => true,
        baseDelayMs: 1,
      },
    ),
    /MODEL_OVERLOADED/,
  );

  assert.equal(attempts, 3);
});

test('withRetry: normalizes non-Error throws to Error', async () => {
  await assert.rejects(
    withRetry(
      async () => {
        throw 'boom';
      },
      {
        maxRetries: 0,
        isRetryable: () => false,
      },
    ),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.equal(error.message, 'boom');
      return true;
    },
  );
});

test('withRetry: pre-aborted signal throws AbortError immediately', async () => {
  const controller = new AbortController();
  controller.abort();
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        return 'should-not-run';
      },
      {
        maxRetries: 3,
        isRetryable: () => true,
        signal: controller.signal,
      },
    ),
    (error) => {
      assert.equal(error?.name, 'AbortError');
      return true;
    },
  );

  assert.equal(attempts, 0);
});

test('withRetry: abort during backoff sleep throws AbortError', async () => {
  const controller = new AbortController();
  let attempts = 0;

  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1;
        throw new Error('MODEL_OVERLOADED');
      },
      {
        maxRetries: 3,
        isRetryable: (error) => error.message === 'MODEL_OVERLOADED',
        baseDelayMs: 50,
        signal: controller.signal,
        onRetry: ({ attempt }) => {
          if (attempt === 1) {
            setTimeout(() => controller.abort(), 5);
          }
        },
      },
    ),
    (error) => {
      assert.equal(error?.name, 'AbortError');
      return true;
    },
  );

  assert.equal(attempts, 1);
});
