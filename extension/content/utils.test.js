import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTranscriptFingerprint,
  estimateTokens,
  getVideoId,
  parseTimestamp,
} from './utils.js';

test('parseTimestamp: parses H:MM:SS, MM:SS, and SS', () => {
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp('12:34'), 754);
  assert.equal(parseTimestamp('45'), 45);
});

test('parseTimestamp: invalid values return 0', () => {
  assert.equal(parseTimestamp(''), 0);
  assert.equal(parseTimestamp(null), 0);
  assert.equal(parseTimestamp('not-a-number'), 0);
});

test('estimateTokens: estimates mixed ASCII/CJK inputs', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('한글테스트'), 3);
  assert.equal(estimateTokens('ab한글'), 2);
});

test('getVideoId: extracts v from query string', () => {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const previousWindow = globalThis.window;

  try {
    globalThis.window = { location: { search: '?v=abc123&list=PL1' } };
    assert.equal(getVideoId(), 'abc123');

    globalThis.window = { location: { search: '?list=PL1' } };
    assert.equal(getVideoId(), null);
  } finally {
    if (hadWindow) globalThis.window = previousWindow;
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('buildTranscriptFingerprint: same input yields same fingerprint', () => {
  const segments = [
    { start: '0:01', text: 'hello world' },
    { start: '0:03', text: 'next line' },
  ];

  const a = buildTranscriptFingerprint(segments);
  const b = buildTranscriptFingerprint(segments);
  assert.equal(a, b);
});

test('buildTranscriptFingerprint: normalizes whitespace', () => {
  const compact = [
    { start: '0:01', text: 'hello world' },
    { start: '0:03', text: 'next line' },
  ];
  const spaced = [
    { start: '0:01', text: '  hello   world  ' },
    { start: '0:03', text: '\nnext   line\t' },
  ];

  assert.equal(buildTranscriptFingerprint(compact), buildTranscriptFingerprint(spaced));
});

test('buildTranscriptFingerprint: changes when content/order differs', () => {
  const base = [
    { start: '0:01', text: 'hello world' },
    { start: '0:03', text: 'next line' },
  ];
  const changedText = [
    { start: '0:01', text: 'hello there' },
    { start: '0:03', text: 'next line' },
  ];
  const changedOrder = [
    { start: '0:03', text: 'next line' },
    { start: '0:01', text: 'hello world' },
  ];

  assert.notEqual(buildTranscriptFingerprint(base), buildTranscriptFingerprint(changedText));
  assert.notEqual(buildTranscriptFingerprint(base), buildTranscriptFingerprint(changedOrder));
});
