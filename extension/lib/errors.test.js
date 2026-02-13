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

test('throwClassifiedApiError: 429는 MODEL_OVERLOADED로 분류한다', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 429 })),
    /MODEL_OVERLOADED/,
  );
});

test('throwClassifiedApiError: 503는 MODEL_OVERLOADED로 분류한다', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 503 })),
    /MODEL_OVERLOADED/,
  );
});

test('throwClassifiedApiError: overloaded 메시지는 MODEL_OVERLOADED로 분류한다', async () => {
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

test('throwClassifiedApiError: 403은 QUOTA_EXCEEDED로 분류한다', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 403 })),
    /QUOTA_EXCEEDED/,
  );
});

test('throwClassifiedApiError: 기타 상태는 API 메시지를 우선 사용한다', async () => {
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

test('throwClassifiedApiError: JSON 파싱 실패 시 상태코드 기반 기본 메시지를 사용한다', async () => {
  await assert.rejects(
    throwClassifiedApiError(createResponse({ status: 500, rejectJson: true })),
    /API 요청 실패: 500/,
  );
});

test('isRetryableError: 재시도 가능 조건을 판별한다', () => {
  assert.equal(isRetryableError(new Error('MODEL_OVERLOADED')), true);
  assert.equal(isRetryableError(new Error('service overloaded now')), true);
  assert.equal(isRetryableError(new Error('fetch failed')), true);
  assert.equal(isRetryableError(new Error('QUOTA_EXCEEDED')), false);
});
