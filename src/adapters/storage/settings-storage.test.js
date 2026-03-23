import assert from 'node:assert/strict';
import test from 'node:test';

import { getSettings, saveSettings } from './settings-storage.ts';
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

test('getSettings normalizes invalid legacy storage values', async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.sourceLang]: 'Français',
    [STORAGE_KEYS.targetLang]: 'Deutsch',
    [STORAGE_KEYS.thinkingLevel]: 'turbo',
    [STORAGE_KEYS.resumeMode]: 'yes',
    [STORAGE_KEYS.settingsSchemaVersion]: 7,
  });

  const settings = await getSettings();

  assert.deepEqual(settings, {
    sourceLang: 'Auto',
    targetLang: '한국어',
    thinkingLevel: 'minimal',
    resumeMode: true,
    schemaVersion: 7,
  });
});

test('saveSettings normalizes unsupported values before persisting', async () => {
  const settings = await saveSettings({
    sourceLang: 'Français',
    targetLang: 'Deutsch',
    thinkingLevel: 'turbo',
    resumeMode: false,
  });

  assert.deepEqual(settings, {
    sourceLang: 'Auto',
    targetLang: '한국어',
    thinkingLevel: 'minimal',
    resumeMode: false,
    schemaVersion: 1,
  });

  const snapshot = storageMock.snapshot();
  assert.equal(snapshot[STORAGE_KEYS.sourceLang], 'Auto');
  assert.equal(snapshot[STORAGE_KEYS.targetLang], '한국어');
  assert.equal(snapshot[STORAGE_KEYS.thinkingLevel], 'minimal');
  assert.equal(snapshot[STORAGE_KEYS.resumeMode], false);
  assert.equal(snapshot[STORAGE_KEYS.settingsSchemaVersion], 1);
});
