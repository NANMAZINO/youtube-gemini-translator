import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldResetSurfaceForPageMessage } from './cache-invalidation.ts';

test('cache.clear always resets the current page surface', () => {
  assert.equal(
    shouldResetSurfaceForPageMessage(
      {
        kind: 'rebuild.page',
        type: 'cache.clear',
      },
      'abc123',
    ),
    true,
  );
});

test('cache.delete resets the surface when the current video cache key matches', () => {
  assert.equal(
    shouldResetSurfaceForPageMessage(
      {
        kind: 'rebuild.page',
        type: 'cache.delete',
        payload: { cacheKey: 'abc123_ko' },
      },
      'abc123',
    ),
    true,
  );
});

test('cache.delete ignores cache keys for other videos', () => {
  assert.equal(
    shouldResetSurfaceForPageMessage(
      {
        kind: 'rebuild.page',
        type: 'cache.delete',
        payload: { cacheKey: 'other456_ko' },
      },
      'abc123',
    ),
    false,
  );
});
