import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectTranscriptDomCapability,
  findTranscriptButton,
  findTranscriptContainer,
  findTranscriptPanel,
  getTranscriptSegmentElements,
  getTranscriptSegmentText,
  getTranscriptSegmentTimestamp,
  isTranscriptPanelOpen,
} from './transcript-dom.ts';
import { createTranscriptFixtureEnvironment } from './test-dom-fixtures.js';

test('legacy transcript fixture covers button, panel, container, and segment parsing', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-legacy.html',
  );

  try {
    const transcriptButton = findTranscriptButton(fixture.document);
    const panel = findTranscriptPanel(fixture.document);
    const container = findTranscriptContainer(panel);
    const segments = getTranscriptSegmentElements(panel);

    assert.equal(transcriptButton?.id, 'show-transcript-button');
    assert.equal(panel?.id, 'watch-transcript-panel');
    assert.equal(container?.localName, 'ytd-transcript-segment-list-renderer');
    assert.equal(segments.length, 2);
    assert.equal(isTranscriptPanelOpen(panel), true);
    assert.equal(getTranscriptSegmentTimestamp(segments[0]), '0:00');
    assert.equal(getTranscriptSegmentText(segments[0]), 'Hello world.');
    assert.deepEqual(detectTranscriptDomCapability(fixture.document), {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 2,
    });
  } finally {
    fixture.cleanup();
  }
});

test('modern transcript fixture covers fallback button detection and attribute-only panel visibility changes', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-modern.html',
  );

  try {
    const transcriptButton = findTranscriptButton(fixture.document);
    const panel = findTranscriptPanel(fixture.document);

    assert.equal(transcriptButton?.id, 'modern-transcript-button');
    assert.equal(panel?.id, 'engagement-panel-searchable-transcript');
    assert.equal(isTranscriptPanelOpen(panel), false);

    panel?.removeAttribute('hidden');
    panel?.removeAttribute('aria-hidden');

    const container = findTranscriptContainer(panel);
    const segments = getTranscriptSegmentElements(panel);

    assert.equal(container?.id, 'body');
    assert.equal(segments.length, 2);
    assert.equal(isTranscriptPanelOpen(panel), true);
    assert.equal(getTranscriptSegmentTimestamp(segments[0]), '0:05');
    assert.equal(getTranscriptSegmentText(segments[0]), '첫 번째 줄입니다.');
    assert.deepEqual(detectTranscriptDomCapability(fixture.document), {
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 2,
    });
  } finally {
    fixture.cleanup();
  }
});
