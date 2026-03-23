import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeYouTubeVideoTitle,
  parseYouTubeVideoId,
} from './video-context.ts';

test('parseYouTubeVideoId reads watch, shorts, live, and embed URLs', () => {
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/watch?v=abc123xyz'),
    'abc123xyz',
  );
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/shorts/short456?t=5'),
    'short456',
  );
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/live/live789'),
    'live789',
  );
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/embed/embed000?start=30'),
    'embed000',
  );
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/feed/subscriptions'), null);
});

test('normalizeYouTubeVideoTitle trims whitespace and removes the YouTube suffix', () => {
  assert.equal(
    normalizeYouTubeVideoTitle(' Sample Title - YouTube '),
    'Sample Title',
  );
  assert.equal(normalizeYouTubeVideoTitle('Standalone Title'), 'Standalone Title');
  assert.equal(normalizeYouTubeVideoTitle(''), '');
});
