import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTimestamp } from '../../core/utils.js';
import {
  buildSourceChunkCheckpoints,
  clampChunkIndex,
  findResumeStartChunkByTimestamp,
  resolveResumeFromSourceCheckpoints,
  resolveResumeState,
} from './resume-resolver.js';

test('clampChunkIndex: bounds values to [0, totalChunks]', () => {
  assert.equal(clampChunkIndex(-1, 5), 0);
  assert.equal(clampChunkIndex(2.9, 5), 2);
  assert.equal(clampChunkIndex(999, 5), 5);
  assert.equal(clampChunkIndex('x', 5), 0);
});

test('findResumeStartChunkByTimestamp: finds first chunk after saved timestamp', () => {
  const chunks = [
    [{ start: '0:01' }, { start: '0:03' }],
    [{ start: '0:05' }, { start: '0:07' }],
    [{ start: '0:10' }],
  ];

  assert.equal(findResumeStartChunkByTimestamp(chunks, 3, parseTimestamp), 1);
  assert.equal(findResumeStartChunkByTimestamp(chunks, 99, parseTimestamp), -1);
});

test('buildSourceChunkCheckpoints: creates checkpoint metadata per chunk', () => {
  const chunks = [
    [{ start: '0:01', text: 'a' }, { start: '0:03', text: 'b' }],
    [{ start: '0:05', text: 'c' }],
  ];

  const checkpoints = buildSourceChunkCheckpoints(
    chunks,
    parseTimestamp,
    (chunk) => `fp-${chunk.length}`,
  );

  assert.deepEqual(checkpoints, [
    {
      chunkIndex: 0,
      chunkFingerprint: 'fp-2',
      firstStartSec: 1,
      lastStartSec: 3,
      segmentCount: 2,
    },
    {
      chunkIndex: 1,
      chunkFingerprint: 'fp-1',
      firstStartSec: 5,
      lastStartSec: 5,
      segmentCount: 1,
    },
  ]);
});

test('resolveResumeFromSourceCheckpoints: uses fingerprint first and source-time fallback next', () => {
  const cachedCheckpoints = [
    { chunkFingerprint: 'a', lastStartSec: 3 },
    { chunkFingerprint: 'b', lastStartSec: 7 },
  ];
  const currentCheckpoints = [
    { chunkFingerprint: 'x', lastStartSec: 4 },
    { chunkFingerprint: 'b', lastStartSec: 8 },
    { chunkFingerprint: 'z', lastStartSec: 12 },
  ];

  const byFingerprint = resolveResumeFromSourceCheckpoints(
    cachedCheckpoints,
    currentCheckpoints,
    2,
    3,
  );
  assert.deepEqual(byFingerprint, {
    startChunkIndex: 2,
    reason: 'fingerprint-match',
  });

  const bySourceTime = resolveResumeFromSourceCheckpoints(
    cachedCheckpoints,
    [{ chunkFingerprint: 'x', lastStartSec: 6 }, { chunkFingerprint: 'y', lastStartSec: 9 }],
    2,
    2,
  );
  assert.deepEqual(bySourceTime, {
    startChunkIndex: 1,
    reason: 'source-time-fallback',
  });
});

test('resolveResumeState: keeps completed chunk count when fingerprint is same', () => {
  const chunks = [
    [{ start: '0:01', text: 'a' }],
    [{ start: '0:03', text: 'b' }],
    [{ start: '0:05', text: 'c' }],
  ];
  const cached = {
    transcriptFingerprint: 'fp-all',
    completedChunkCount: 2,
    translations: [{ start: '0:01', text: 'one' }],
  };

  const resolved = resolveResumeState({
    cached,
    chunks,
    transcriptFingerprint: 'fp-all',
    parseTimestamp,
    getFingerprint: () => 'ignored',
  });

  assert.equal(resolved.startChunkIndex, 2);
  assert.equal(resolved.reason, 'fingerprint-same');
  assert.equal(resolved.usedCheckpointFallback, false);
  assert.equal(resolved.usedTimestampFallback, false);
  assert.equal(resolved.initialTranslations.length, 1);
});

test('resolveResumeState: falls back to timestamp and resets when fallback fails', () => {
  const chunks = [
    [{ start: '0:01', text: 'a' }],
    [{ start: '0:03', text: 'b' }],
  ];
  const cached = {
    transcriptFingerprint: 'old',
    completedChunkCount: 9,
    sourceChunkCheckpoints: [{ chunkFingerprint: 'not-match', lastStartSec: 99 }],
    translations: [{ start: '9:59', text: 'old text' }],
  };

  const resolved = resolveResumeState({
    cached,
    chunks,
    transcriptFingerprint: 'new',
    parseTimestamp,
    getFingerprint: () => 'current',
  });

  assert.equal(resolved.startChunkIndex, 0);
  assert.equal(resolved.reason, 'timestamp-reset');
  assert.equal(resolved.usedCheckpointFallback, false);
  assert.equal(resolved.usedTimestampFallback, true);
  assert.deepEqual(resolved.initialTranslations, []);
});
