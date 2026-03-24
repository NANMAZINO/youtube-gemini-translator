import {
  SETTINGS_SCHEMA_VERSION,
  normalizeSettings,
  normalizeSettingsInput,
  type Settings,
  type SettingsInput,
} from '../../shared/contracts/index.ts';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from './schema.ts';

const SETTINGS_STORAGE_KEYS: string[] = [
  STORAGE_KEYS.targetLang,
  STORAGE_KEYS.sourceLang,
  STORAGE_KEYS.thinkingLevel,
  STORAGE_KEYS.resumeMode,
  STORAGE_KEYS.uiLocale,
  STORAGE_KEYS.themeMode,
  STORAGE_KEYS.settingsSchemaVersion,
  LEGACY_STORAGE_KEYS.settingsSchemaVersion,
] as const;

async function resolveSettingsSchemaVersion(result: Record<string, unknown>) {
  const activeVersion = result[STORAGE_KEYS.settingsSchemaVersion];
  if (typeof activeVersion === 'number') {
    return activeVersion;
  }

  const legacyVersion = result[LEGACY_STORAGE_KEYS.settingsSchemaVersion];
  if (typeof legacyVersion !== 'number') {
    return undefined;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.settingsSchemaVersion]: legacyVersion,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.settingsSchemaVersion);
  return legacyVersion;
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);
  const schemaVersion = await resolveSettingsSchemaVersion(result);

  return normalizeSettings({
    sourceLang: result[STORAGE_KEYS.sourceLang],
    targetLang: result[STORAGE_KEYS.targetLang],
    thinkingLevel: result[STORAGE_KEYS.thinkingLevel],
    resumeMode: result[STORAGE_KEYS.resumeMode],
    uiLocale: result[STORAGE_KEYS.uiLocale],
    themeMode: result[STORAGE_KEYS.themeMode],
    schemaVersion,
  });
}

export async function saveSettings(input: SettingsInput): Promise<Settings> {
  const normalizedInput = normalizeSettingsInput(input);
  const next = normalizeSettings({
    ...normalizedInput,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.sourceLang]: next.sourceLang,
    [STORAGE_KEYS.targetLang]: next.targetLang,
    [STORAGE_KEYS.thinkingLevel]: next.thinkingLevel,
    [STORAGE_KEYS.resumeMode]: next.resumeMode,
    [STORAGE_KEYS.uiLocale]: next.uiLocale,
    [STORAGE_KEYS.themeMode]: next.themeMode,
    [STORAGE_KEYS.settingsSchemaVersion]: SETTINGS_SCHEMA_VERSION,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.settingsSchemaVersion);

  return next;
}
