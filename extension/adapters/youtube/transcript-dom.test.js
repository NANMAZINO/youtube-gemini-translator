import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTranscriptPanelCandidateMetadata,
  looksLikeTimestamp,
  looksLikeTranscriptButtonLabel,
  resolveTranscriptPanelOpenState,
  summarizeTranscriptDomCapability,
} from './transcript-dom.ts';

test('looksLikeTimestamp accepts normalized transcript timestamp formats', () => {
  assert.equal(looksLikeTimestamp(' 1:23 '), true);
  assert.equal(looksLikeTimestamp('01:02:03'), true);
  assert.equal(looksLikeTimestamp('1:2'), false);
  assert.equal(looksLikeTimestamp('about 1 minute'), false);
});

test('looksLikeTranscriptButtonLabel recognizes transcript labels across locales', () => {
  assert.equal(looksLikeTranscriptButtonLabel('Show transcript'), true);
  assert.equal(looksLikeTranscriptButtonLabel('스크립트 표시'), true);
  assert.equal(looksLikeTranscriptButtonLabel('내용 대본'), true);
  assert.equal(looksLikeTranscriptButtonLabel('Download subtitles'), false);
});

test('isTranscriptPanelCandidateMetadata accepts selector, id, and descendant hints', () => {
  assert.equal(
    isTranscriptPanelCandidateMetadata({
      matchesScriptPanelSelector: true,
      hasTranscriptDescendant: false,
    }),
    true,
  );

  assert.equal(
    isTranscriptPanelCandidateMetadata({
      matchesScriptPanelSelector: false,
      targetId: 'engagement-panel-searchable-transcript',
      hasTranscriptDescendant: false,
    }),
    true,
  );

  assert.equal(
    isTranscriptPanelCandidateMetadata({
      matchesScriptPanelSelector: false,
      panelId: 'watch-transcript-panel',
      hasTranscriptDescendant: false,
    }),
    true,
  );

  assert.equal(
    isTranscriptPanelCandidateMetadata({
      matchesScriptPanelSelector: false,
      hasTranscriptDescendant: true,
    }),
    true,
  );

  assert.equal(
    isTranscriptPanelCandidateMetadata({
      matchesScriptPanelSelector: false,
      targetId: 'engagement-panel-comments',
      panelId: 'watch-comments-panel',
      hasTranscriptDescendant: false,
    }),
    false,
  );
});

test('resolveTranscriptPanelOpenState tolerates attribute-only transcript visibility', () => {
  assert.equal(
    resolveTranscriptPanelOpenState({
      isCandidate: true,
      isVisible: true,
      offsetHeight: 0,
      hasTranscriptContainer: true,
      segmentCount: 0,
    }),
    true,
  );

  assert.equal(
    resolveTranscriptPanelOpenState({
      isCandidate: true,
      isVisible: true,
      offsetHeight: 0,
      hasTranscriptContainer: false,
      segmentCount: 2,
    }),
    true,
  );

  assert.equal(
    resolveTranscriptPanelOpenState({
      isCandidate: true,
      isVisible: false,
      offsetHeight: 24,
      hasTranscriptContainer: true,
      segmentCount: 2,
    }),
    false,
  );
});

test('summarizeTranscriptDomCapability reports button, panel, and segment state compactly', () => {
  assert.equal(
    summarizeTranscriptDomCapability({
      transcriptButtonFound: true,
      panelFound: true,
      panelOpen: true,
      containerFound: true,
      segmentCount: 12,
    }),
    'button ready | panel open | 12 segments',
  );

  assert.equal(
    summarizeTranscriptDomCapability({
      transcriptButtonFound: false,
      panelFound: true,
      panelOpen: false,
      containerFound: true,
      segmentCount: 0,
    }),
    'button missing | panel hidden | segments pending',
  );
});
