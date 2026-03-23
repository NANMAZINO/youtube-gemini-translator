import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTranscriptFingerprint,
  estimateTokens,
  parseTimestamp,
} from './primitives.ts';

test('parseTimestamp parses H:MM:SS, MM:SS, and SS formats', () => {
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp('12:34'), 754);
  assert.equal(parseTimestamp('45'), 45);
});

test('parseTimestamp returns 0 for invalid values', () => {
  assert.equal(parseTimestamp(''), 0);
  assert.equal(parseTimestamp(null), 0);
  assert.equal(parseTimestamp('not-a-number'), 0);
  assert.equal(parseTimestamp('1:nope'), 0);
});

test('estimateTokens handles ASCII and CJK text', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('你好世界'), 2);
  assert.equal(estimateTokens('ab你好'), 2);
});

test('buildTranscriptFingerprint is deterministic and whitespace normalized', () => {
  const compact = [
    { start: '0:01', text: 'hello world' },
    { start: '0:03', text: 'next line' },
  ];
  const spaced = [
    { start: '0:01', text: '  hello   world  ' },
    { start: '0:03', text: '\nnext   line\t' },
  ];

  assert.equal(
    buildTranscriptFingerprint(compact),
    buildTranscriptFingerprint(compact),
  );
  assert.equal(
    buildTranscriptFingerprint(compact),
    buildTranscriptFingerprint(spaced),
  );
});

test('buildTranscriptFingerprint changes when content or order changes', () => {
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

  assert.notEqual(
    buildTranscriptFingerprint(base),
    buildTranscriptFingerprint(changedText),
  );
  assert.notEqual(
    buildTranscriptFingerprint(base),
    buildTranscriptFingerprint(changedOrder),
  );
});
