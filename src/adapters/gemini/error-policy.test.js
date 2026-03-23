import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyGeminiApiError,
  isRetryableGeminiError,
  throwClassifiedGeminiApiError,
} from './error-policy.ts';

function createResponse({ status, body = {}, rejectJson = false }) {
  return {
    status,
    json: async () => {
      if (rejectJson) throw new Error('invalid json');
      return body;
    },
  };
}

test('classifyGeminiApiError maps overload statuses and messages', () => {
  assert.equal(classifyGeminiApiError(429), 'MODEL_OVERLOADED');
  assert.equal(classifyGeminiApiError(503), 'MODEL_OVERLOADED');
  assert.equal(
    classifyGeminiApiError(500, 'temporarily overloaded, retry later'),
    'MODEL_OVERLOADED',
  );
});

test('classifyGeminiApiError maps quota errors and falls back to API messages', () => {
  assert.equal(classifyGeminiApiError(403), 'QUOTA_EXCEEDED');
  assert.equal(
    classifyGeminiApiError(500, 'upstream gateway error'),
    'upstream gateway error',
  );
  assert.equal(classifyGeminiApiError(500), 'API request failed: 500');
});

test('throwClassifiedGeminiApiError throws classified messages', async () => {
  await assert.rejects(
    throwClassifiedGeminiApiError(createResponse({ status: 429 })),
    /MODEL_OVERLOADED/,
  );

  await assert.rejects(
    throwClassifiedGeminiApiError(
      createResponse({
        status: 500,
        body: { error: { message: 'upstream gateway error' } },
      }),
    ),
    /upstream gateway error/,
  );

  await assert.rejects(
    throwClassifiedGeminiApiError(createResponse({ status: 500, rejectJson: true })),
    /API request failed: 500/,
  );
});

test('isRetryableGeminiError classifies retryable and non-retryable errors', () => {
  assert.equal(isRetryableGeminiError(new Error('MODEL_OVERLOADED')), true);
  assert.equal(isRetryableGeminiError(new Error('service overloaded now')), true);
  assert.equal(isRetryableGeminiError(new Error('fetch failed')), true);
  assert.equal(isRetryableGeminiError(new Error('QUOTA_EXCEEDED')), false);

  const abortError = new Error('Aborted');
  abortError.name = 'AbortError';
  assert.equal(isRetryableGeminiError(abortError), false);
});
