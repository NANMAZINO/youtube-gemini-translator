import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearCacheRecords,
  listCacheMetadata,
  readCacheRecord,
  saveCacheRecord,
  savePartialCacheRecord,
} from './cache-storage.ts';
import { STORAGE_KEYS } from './schema.ts';

function createStorageLocalMock() {
  const store = Object.create(null);

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeGet(keys) {
    if (keys == null) return clone(store);

    if (typeof keys === 'string') {
      return store[keys] === undefined ? {} : { [keys]: clone(store[keys]) };
    }

    if (Array.isArray(keys)) {
      const result = {};
      keys.forEach((key) => {
        if (store[key] !== undefined) {
          result[key] = clone(store[key]);
        }
      });
      return result;
    }

    if (typeof keys === 'object') {
      const result = {};
      Object.entries(keys).forEach(([key, defaultValue]) => {
        result[key] = store[key] === undefined ? defaultValue : clone(store[key]);
      });
      return result;
    }

    return {};
  }

  return {
    local: {
      async get(keys) {
        return normalizeGet(keys);
      },
      async set(items) {
        Object.entries(items).forEach(([key, value]) => {
          store[key] = clone(value);
        });
      },
      async remove(keys) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach((key) => {
          delete store[key];
        });
      },
    },
    reset() {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
    snapshot() {
      return clone(store);
    },
  };
}

const storageMock = createStorageLocalMock();
globalThis.chrome = {
  storage: {
    local: storageMock.local,
  },
};

test.beforeEach(() => {
  storageMock.reset();
});

test('saveCacheRecord stores metadata with an explicit cacheKey', async () => {
  const record = await saveCacheRecord(
    'video-a',
    [{ start: '0:01', text: 'hello' }],
    {
      title: 'Video A',
      sourceLang: 'Auto',
      targetLang: 'English',
      completedChunkCount: 1,
      transcriptFingerprint: 'abc12345',
      sourceChunkCheckpoints: [
        {
          chunkIndex: 0,
          chunkFingerprint: 'fp-1',
          firstStartSec: 1,
          lastStartSec: 1,
          segmentCount: 1,
        },
      ],
    },
  );

  assert.equal(record.cacheKey, 'video-a_English');
  assert.equal(record.originalVideoId, 'video-a');

  const metadata = await listCacheMetadata();
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].cacheKey, 'video-a_English');
});

test('savePartialCacheRecord updates data without changing the cache index order', async () => {
  await saveCacheRecord(
    'video-b',
    [{ start: '0:01', text: 'first' }],
    {
      title: 'Video B',
      sourceLang: 'Auto',
      targetLang: 'English',
      isPartial: true,
      completedChunkCount: 1,
      transcriptFingerprint: 'fingerprint-a',
    },
  );

  const before = storageMock.snapshot();

  const partial = await savePartialCacheRecord(
    'video-b',
    [{ start: '0:02', text: 'second' }],
    {
      title: 'Video B',
      sourceLang: 'Auto',
      targetLang: 'English',
      completedChunkCount: 2,
      transcriptFingerprint: 'fingerprint-a',
    },
  );

  const after = storageMock.snapshot();

  assert.deepEqual(after[STORAGE_KEYS.cacheIndex], before[STORAGE_KEYS.cacheIndex]);
  assert.equal(partial.isPartial, true);

  const cached = await readCacheRecord('video-b', 'English');
  assert.equal(cached?.completedChunkCount, 2);
  assert.equal(cached?.cacheKey, 'video-b_English');
});

test('savePartialCacheRecord creates an index entry when the cache key is new', async () => {
  const partial = await savePartialCacheRecord(
    'video-new',
    [{ start: '0:02', text: 'draft' }],
    {
      title: 'Video New',
      sourceLang: 'Auto',
      targetLang: 'English',
      completedChunkCount: 1,
      transcriptFingerprint: 'fresh-cache',
    },
  );

  assert.equal(partial.cacheKey, 'video-new_English');

  const metadata = await listCacheMetadata();
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].cacheKey, 'video-new_English');
  assert.equal(metadata[0].isPartial, true);
});

test('cache schema mismatch invalidates stored cache entries', async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.cacheSchemaVersion]: 99,
    [STORAGE_KEYS.cacheIndex]: [
      {
        videoId: 'video-c_English',
        title: 'Video C',
        timestamp: Date.now(),
      },
    ],
    [`${STORAGE_KEYS.cacheDataPrefix}video-c_English`]: {
      videoId: 'video-c_English',
      originalVideoId: 'video-c',
      title: 'Video C',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [{ start: '0:01', text: 'hello' }],
    },
  });

  const metadata = await listCacheMetadata();
  assert.deepEqual(metadata, []);

  const snapshot = storageMock.snapshot();
  assert.equal(snapshot[STORAGE_KEYS.cacheIndex], undefined);
  assert.equal(snapshot[`${STORAGE_KEYS.cacheDataPrefix}video-c_English`], undefined);
  assert.equal(snapshot[STORAGE_KEYS.cacheSchemaVersion], 1);
});

test('clearCacheRecords removes cached data and leaves the active schema marker', async () => {
  await saveCacheRecord(
    'video-d',
    [{ start: '0:01', text: 'hello' }],
    {
      title: 'Video D',
      sourceLang: 'Auto',
      targetLang: 'English',
    },
  );

  await clearCacheRecords();

  const metadata = await listCacheMetadata();
  assert.deepEqual(metadata, []);

  const snapshot = storageMock.snapshot();
  assert.equal(snapshot[STORAGE_KEYS.cacheSchemaVersion], 1);
});

test('clearCacheRecords removes orphaned cache data keys that are missing from the index', async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.cacheSchemaVersion]: 1,
    [`${STORAGE_KEYS.cacheDataPrefix}orphan_English`]: {
      videoId: 'orphan_English',
      originalVideoId: 'orphan',
      title: 'Orphan',
      sourceLang: 'Auto',
      targetLang: 'English',
      timestamp: Date.now(),
      translations: [{ start: '0:01', text: 'hello' }],
      isPartial: true,
    },
  });

  await clearCacheRecords();

  const snapshot = storageMock.snapshot();
  assert.equal(snapshot[`${STORAGE_KEYS.cacheDataPrefix}orphan_English`], undefined);
  assert.equal(snapshot[STORAGE_KEYS.cacheSchemaVersion], 1);
});
