import assert from 'node:assert/strict';
import test from 'node:test';

import {
  describeCacheEntry,
  getApiKeyToggleState,
  summarizeCacheList,
  summarizeRefreshFailures,
} from './presentation.ts';

test('getApiKeyToggleState exposes accessible toggle copy', () => {
  assert.deepEqual(getApiKeyToggleState(false), {
    text: 'Show',
    ariaLabel: 'Show API key',
    ariaPressed: 'false',
  });
  assert.deepEqual(getApiKeyToggleState(true), {
    text: 'Hide',
    ariaLabel: 'Hide API key',
    ariaPressed: 'true',
  });
});

test('summarizeRefreshFailures builds a user-facing partial failure message', () => {
  assert.deepEqual(summarizeRefreshFailures([]), {
    message: 'Everything is ready.',
    type: 'success',
  });
  assert.deepEqual(
    summarizeRefreshFailures(['usage totals', 'saved subtitle bundles']),
    {
      message:
        'Loaded available data, but usage totals and saved subtitle bundles could not be refreshed.',
      type: 'error',
    },
  );
});

test('summarizeCacheList makes truncation explicit', () => {
  assert.equal(summarizeCacheList(0, 0), 'No saved subtitle bundles yet.');
  assert.equal(summarizeCacheList(1, 1), '1 saved subtitle bundle.');
  assert.equal(
    summarizeCacheList(8, 5),
    'Showing 5 of 8 saved subtitle bundles.',
  );
});

test('describeCacheEntry formats user-facing cache copy', () => {
  assert.deepEqual(
    describeCacheEntry(
      {
        cacheKey: 'video_en_true',
        title: 'Episode 12',
        sourceLang: '한국어',
        targetLang: 'English',
        timestamp: Date.UTC(2026, 2, 24),
        isRefined: false,
        isPartial: true,
        schemaVersion: 1,
      },
      'en-US',
    ),
    {
      stateLabel: 'Resume available',
      languageLabel: '한국어 -> English',
      savedLabel: 'Saved Mar 24, 2026',
      deleteLabel: 'Delete cached translation for Episode 12',
    },
  );
});
