import assert from 'node:assert/strict';
import test from 'node:test';

import { withRetry } from './retry.js';

test('withRetry: 성공 시 즉시 결과를 반환한다', async () => {
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

test('withRetry: 재시도 가능한 에러는 지수 백오프로 재시도한다', async () => {
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

test('withRetry: 재시도 불가 에러는 즉시 throw 한다', async () => {
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

test('withRetry: 최대 재시도 횟수를 넘기면 마지막 에러를 throw 한다', async () => {
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

test('withRetry: Error가 아닌 throw 값도 Error로 정규화한다', async () => {
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
