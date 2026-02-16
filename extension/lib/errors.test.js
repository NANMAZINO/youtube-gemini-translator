import assert from 'node:assert/strict';
import test from 'node:test';

import { isRetryableError, throwClassifiedApiError } from './errors.js';

function createResponse({ status, body = {}, rejectJson = false }) {
  return {
    status,
    json: async () => {
      if (rejectJson) throw new Error('invalid json');
      return body;
    },
  };
}

test('throwClassifiedApiError: 429 maps to MODEL_OVERLOADED', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 429 })),
    /MODEL_OVERLOADED/,
  );
});

test('throwClassifiedApiError: 503 maps to MODEL_OVERLOADED', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 503 })),
    /MODEL_OVERLOADED/,
  );
});

test('throwClassifiedApiError: overloaded message maps to MODEL_OVERLOADED', async () => {
  await assert.rejects(
    throwClassifiedApiError(
      createResponse({
        status: 500,
        body: { error: { message: 'temporarily overloaded, retry later' } },
      }),
    ),
    /MODEL_OVERLOADED/,
  );
});

test('throwClassifiedApiError: 403 maps to QUOTA_EXCEEDED', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 403 })),
    /QUOTA_EXCEEDED/,
  );
});

test('throwClassifiedApiError: fallback uses API message first', async () => {
  await assert.rejects(
    throwClassifiedApiError(
      createResponse({
        status: 500,
        body: { error: { message: 'upstream gateway error' } },
      }),
    ),
    /upstream gateway error/,
  );
});

test('throwClassifiedApiError: JSON parse failure falls back to status message', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 500, rejectJson: true })),
    /API 요청 실패: 500/,
  );
});

test('isRetryableError: classifies retryable and non-retryable errors', () => {
  assert.equal(isRetryableError(new Error('MODEL_OVERLOADED')), true);
  assert.equal(isRetryableError(new Error('service overloaded now')), true);
  assert.equal(isRetryableError(new Error('fetch failed')), true);
  assert.equal(isRetryableError(new Error('QUOTA_EXCEEDED')), false);

  const abortError = new Error('Aborted');
  abortError.name = 'AbortError';
  assert.equal(isRetryableError(abortError), false);
});
