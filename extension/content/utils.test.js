import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateTokens, getVideoId, parseTimestamp } from './utils.js';

test('parseTimestamp: H:MM:SS, MM:SS, SS를 초 단위로 파싱한다', () => {
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp('12:34'), 754);
  assert.equal(parseTimestamp('45'), 45);
});

test('parseTimestamp: 빈 값/유효하지 않은 값은 0을 반환한다', () => {
  assert.equal(parseTimestamp(''), 0);
  assert.equal(parseTimestamp(null), 0);
  assert.equal(parseTimestamp('not-a-number'), 0);
});

test('estimateTokens: ASCII/CJK 혼합 비율로 토큰을 올림 계산한다', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('한글테스트'), 3);
  assert.equal(estimateTokens('ab한글'), 2);
});

test('getVideoId: 쿼리스트링에서 v 파라미터를 추출한다', () => {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const previousWindow = globalThis.window;

  try {
    globalThis.window = { location: { search: '?v=abc123&list=PL1' } };
    assert.equal(getVideoId(), 'abc123');

    globalThis.window = { location: { search: '?list=PL1' } };
    assert.equal(getVideoId(), null);
  } finally {
    if (hadWindow) {
      globalThis.window = previousWindow;
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
