export const STORAGE_KEYS = Object.freeze({
  apiKey: 'apiKey',
  tokenHistory: 'tokenHistory',
  targetLang: 'targetLang',
  sourceLang: 'sourceLang',
  thinkingLevel: 'thinkingLevel',
  resumeMode: 'resumeMode',
  settingsSchemaVersion: 'rebuildSettingsSchemaVersion',
  cacheSchemaVersion: 'rebuildCacheSchemaVersion',
  cacheIndex: 'idx_translations',
  cacheDataPrefix: 'dat_',
});

export const STORAGE_SCHEMA = Object.freeze({
  settings: 1,
  cache: 1,
});
