import assert from 'node:assert/strict';
import test from 'node:test';

import { chunkTranscript } from './chunking.ts';
import {
  groupSegmentsBySentence,
  normalizeTranscript,
  sanitizeTranscriptSegments,
} from './normalize.ts';

test('sanitizeTranscriptSegments trims whitespace and drops empty entries', () => {
  const sanitized = sanitizeTranscriptSegments([
    { start: '0:01', text: '  hello   world  ' },
    { start: '0:02', text: '   ' },
    { start: '0:03', text: '\nnext\tline' },
  ]);

  assert.deepEqual(sanitized, [
    { start: '0:01', text: 'hello world' },
    { start: '0:03', text: 'next line' },
  ]);
});

test('groupSegmentsBySentence merges until sentence end or last segment', () => {
  const grouped = groupSegmentsBySentence([
    { start: '0:01', text: 'Hello' },
    { start: '0:02', text: 'world.' },
    { start: '0:03', text: 'Next bit' },
  ]);

  assert.deepEqual(grouped, [
    { start: '0:01', text: 'Hello world.' },
    { start: '0:03', text: 'Next bit' },
  ]);
});

test('normalizeTranscript returns sanitized raw/grouped segments and fingerprint', () => {
  const normalized = normalizeTranscript([
    { start: '0:01', text: '  Hello ' },
    { start: '0:02', text: 'world.' },
    { start: '0:03', text: '' },
  ]);

  assert.equal(normalized.raw.length, 2);
  assert.equal(normalized.grouped.length, 1);
  assert.equal(typeof normalized.fingerprint, 'string');
  assert.equal(normalized.fingerprint.length, 8);
});

test('chunkTranscript splits on soft limit at sentence boundaries', () => {
  const chunks = chunkTranscript(
    [
      { start: '0:01', text: 'First sentence.' },
      { start: '0:02', text: 'Second sentence.' },
      { start: '0:03', text: 'Third sentence.' },
    ],
    {
      softTokenLimit: 4,
      maxTokensPerChunk: 20,
      estimateTokensFn: () => 2,
    },
  );

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0].map((item) => item.start), ['0:01', '0:02']);
  assert.deepEqual(chunks[1].map((item) => item.start), ['0:03']);
});

test('chunkTranscript forces a split at the hard limit', () => {
  const chunks = chunkTranscript(
    [
      { start: '0:01', text: 'one' },
      { start: '0:02', text: 'two' },
      { start: '0:03', text: 'three' },
    ],
    {
      softTokenLimit: 99,
      maxTokensPerChunk: 10,
      estimateTokensFn: () => 5,
    },
  );

  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0].map((item) => item.start), ['0:01', '0:02']);
  assert.deepEqual(chunks[1].map((item) => item.start), ['0:03']);
});
