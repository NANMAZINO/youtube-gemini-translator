import assert from 'node:assert/strict';
import test from 'node:test';

import { findTranscriptButton, findTranscriptPanel } from './transcript-dom.ts';
import {
  openTranscriptPanel,
  waitForTranscriptPanelToOpen,
} from './transcript-opener.ts';
import { createTranscriptFixtureEnvironment } from './test-dom-fixtures.js';

test('waitForTranscriptPanelToOpen resolves when an existing panel becomes visible through attributes only', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-modern.html',
  );

  try {
    const panel = findTranscriptPanel(fixture.document);
    assert.ok(panel);

    const waitForOpen = waitForTranscriptPanelToOpen(1000, fixture.document);
    fixture.window.setTimeout(() => {
      panel.removeAttribute('hidden');
      panel.removeAttribute('aria-hidden');
    }, 0);

    const openedPanel = await waitForOpen;
    assert.equal(openedPanel, panel);
  } finally {
    fixture.cleanup();
  }
});

test('openTranscriptPanel clicks the transcript button and returns the revealed panel', async () => {
  const fixture = await createTranscriptFixtureEnvironment(
    'transcript-modern.html',
  );

  try {
    const transcriptButton = findTranscriptButton(fixture.document);
    const panel = findTranscriptPanel(fixture.document);
    let transcriptButtonClicks = 0;

    assert.ok(transcriptButton);
    assert.ok(panel);

    transcriptButton.addEventListener('click', () => {
      transcriptButtonClicks += 1;
      panel.removeAttribute('hidden');
      panel.removeAttribute('aria-hidden');
    });

    const openedPanel = await openTranscriptPanel(fixture.document);

    assert.equal(openedPanel, panel);
    assert.equal(transcriptButtonClicks, 1);
  } finally {
    fixture.cleanup();
  }
});
