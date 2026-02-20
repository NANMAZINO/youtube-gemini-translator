import assert from 'node:assert/strict';
import test from 'node:test';

import {
  saveToCache,
  savePartialTranslation,
  getFromCache,
  getAllCacheMetadata,
} from './cache.js';
import { CACHE_INDEX_KEY, CACHE_DATA_PREFIX } from '../../core/constants.js';

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
        if (store[key] !== undefined) result[key] = clone(store[key]);
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

  const local = {
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
    getBytesInUse(keys, callback) {
      const keyList = Array.isArray(keys) ? keys : [keys];
      const bytes = keyList.reduce((acc, key) => {
        if (store[key] === undefined) return acc;
        return acc + Buffer.byteLength(JSON.stringify(store[key]), 'utf8');
      }, 0);
      callback(bytes);
    },
  };

  return {
    local,
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

test('savePartialTranslation does not update cache index', async () => {
  await saveToCache('video-a', [{ start: '0:01', text: 'one' }], {
    title: 'Video A',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    isPartial: true,
    completedChunkCount: 1,
    transcriptFingerprint: 'abc12345',
    sourceChunkCheckpoints: [{ chunkIndex: 0, chunkFingerprint: '11111111', lastStartSec: 1 }],
  });

  const indexBefore = await getAllCacheMetadata();

  await savePartialTranslation('video-a', [{ start: '0:01', text: 'updated one' }], {
    title: 'Video A',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    completedChunkCount: 2,
    transcriptFingerprint: 'abc12345',
    sourceChunkCheckpoints: [
      { chunkIndex: 0, chunkFingerprint: '11111111', lastStartSec: 1 },
      { chunkIndex: 1, chunkFingerprint: '22222222', lastStartSec: 3 },
    ],
  });

  const indexAfter = await getAllCacheMetadata();
  assert.deepEqual(indexAfter, indexBefore);

  const cached = await getFromCache('video-a', 'Korean');
  assert.equal(cached.isPartial, true);
  assert.equal(cached.completedChunkCount, 2);
  assert.equal(cached.transcriptFingerprint, 'abc12345');
  assert.equal(cached.translations[0].text, 'updated one');
  assert.deepEqual(cached.sourceChunkCheckpoints, [
    { chunkIndex: 0, chunkFingerprint: '11111111', lastStartSec: 1 },
    { chunkIndex: 1, chunkFingerprint: '22222222', lastStartSec: 3 },
  ]);
});

test('saveToCache toggles isPartial state in index metadata', async () => {
  await saveToCache('video-b', [{ start: '0:01', text: 'draft' }], {
    title: 'Video B',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    isPartial: true,
    completedChunkCount: 1,
    transcriptFingerprint: 'finger-a',
  });

  let index = await getAllCacheMetadata();
  assert.equal(index.length, 1);
  assert.equal(index[0].isPartial, true);

  await saveToCache('video-b', [{ start: '0:01', text: 'final' }], {
    title: 'Video B',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    isPartial: false,
    completedChunkCount: 3,
    transcriptFingerprint: 'finger-a',
  });

  index = await getAllCacheMetadata();
  assert.equal(index.length, 1);
  assert.equal(index[0].isPartial, false);
});

test('getFromCache returns extended resume metadata fields', async () => {
  await saveToCache('video-c', [{ start: '0:05', text: 'hello' }], {
    title: 'Video C',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    isPartial: true,
    completedChunkCount: 4,
    transcriptFingerprint: 'deadbeef',
    sourceChunkCheckpoints: [{ chunkIndex: 0, chunkFingerprint: 'aaaa0000', lastStartSec: 5 }],
  });

  const cached = await getFromCache('video-c', 'Korean');
  assert.ok(cached);
  assert.equal(cached.isPartial, true);
  assert.equal(cached.completedChunkCount, 4);
  assert.equal(cached.transcriptFingerprint, 'deadbeef');
  assert.deepEqual(cached.sourceChunkCheckpoints, [
    { chunkIndex: 0, chunkFingerprint: 'aaaa0000', lastStartSec: 5 },
  ]);
  assert.equal(cached.videoId, 'video-c_Korean');
});

test('savePartialTranslation writes data key only', async () => {
  await saveToCache('video-d', [{ start: '0:01', text: 'first' }], {
    title: 'Video D',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    isPartial: true,
    completedChunkCount: 1,
    transcriptFingerprint: 'fff11111',
  });

  const beforeSnapshot = storageMock.snapshot();
  await savePartialTranslation('video-d', [{ start: '0:02', text: 'second' }], {
    title: 'Video D',
    sourceLang: 'Auto',
    targetLang: 'Korean',
    completedChunkCount: 2,
    transcriptFingerprint: 'fff11111',
  });
  const afterSnapshot = storageMock.snapshot();

  assert.deepEqual(afterSnapshot[CACHE_INDEX_KEY], beforeSnapshot[CACHE_INDEX_KEY]);
  assert.ok(afterSnapshot[`${CACHE_DATA_PREFIX}video-d_Korean`]);
});
