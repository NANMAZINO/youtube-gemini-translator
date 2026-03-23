import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractNormalizedTranscript,
  extractTranscriptSegments,
} from './transcript-extractor.ts';
import { createTranscriptFixtureEnvironment } from './test-dom-fixtures.js';

test('extractTranscriptSegments reads legacy transcript renderer fixtures', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-legacy.html',
  );

  try {
    const segments = await extractTranscriptSegments({
      root: fixture.document,
      waitForSegmentsMs: 0,
    });
    const normalized = await extractNormalizedTranscript({
      root: fixture.document,
      waitForSegmentsMs: 0,
    });

    assert.deepEqual(segments, [
      { id: 'segment-1', start: '0:00', text: 'Hello world.' },
      { id: 'segment-2', start: '0:04', text: 'Thanks for watching.' },
    ]);
    assert.deepEqual(normalized.raw, segments);
    assert.equal(normalized.grouped.length, 2);
    assert.match(normalized.fingerprint, /^[a-f0-9]{8}$/);
  } finally {
    fixture.cleanup();
  }
});

test('extractTranscriptSegments reads modern transcript view-model fixtures after reveal', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-modern.html',
  );

  try {
    const panel = fixture.document.getElementById(
      'engagement-panel-searchable-transcript',
    );
    panel?.removeAttribute('hidden');
    panel?.removeAttribute('aria-hidden');

    const segments = await extractTranscriptSegments({
      root: fixture.document,
      waitForSegmentsMs: 0,
    });
    const normalized = await extractNormalizedTranscript({
      root: fixture.document,
      waitForSegmentsMs: 0,
    });

    assert.deepEqual(segments, [
      { id: 'segment-1', start: '0:05', text: '첫 번째 줄입니다.' },
      { id: 'segment-2', start: '0:09', text: '두 번째 줄입니다.' },
    ]);
    assert.deepEqual(normalized.raw, segments);
    assert.equal(normalized.grouped.length, 2);
    assert.match(normalized.fingerprint, /^[a-f0-9]{8}$/);
  } finally {
    fixture.cleanup();
  }
});
