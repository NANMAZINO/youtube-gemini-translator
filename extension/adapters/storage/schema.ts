export const STORAGE_KEYS = Object.freeze({
  apiKey: 'apiKey',
  tokenHistory: 'tokenHistory',
  targetLang: 'targetLang',
  sourceLang: 'sourceLang',
  thinkingLevel: 'thinkingLevel',
  resumeMode: 'resumeMode',
  uiLocale: 'uiLocale',
  themeMode: 'themeMode',
  settingsSchemaVersion: 'settingsSchemaVersion',
  cacheSchemaVersion: 'cacheSchemaVersion',
  cacheIndex: 'idx_translations',
  cacheDataPrefix: 'dat_',
});

export const LEGACY_STORAGE_KEYS = Object.freeze({
  settingsSchemaVersion: 'rebuildSettingsSchemaVersion',
  cacheSchemaVersion: 'rebuildCacheSchemaVersion',
});

export const STORAGE_SCHEMA = Object.freeze({
  settings: 2,
  cache: 1,
});
