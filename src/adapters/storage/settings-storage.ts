import {
  SETTINGS_SCHEMA_VERSION,
  normalizeSettings,
  normalizeSettingsInput,
  type Settings,
  type SettingsInput,
} from '../../shared/contracts/index.ts';
import { STORAGE_KEYS } from './schema.ts';

const SETTINGS_STORAGE_KEYS: string[] = [
  STORAGE_KEYS.targetLang,
  STORAGE_KEYS.sourceLang,
  STORAGE_KEYS.thinkingLevel,
  STORAGE_KEYS.resumeMode,
  STORAGE_KEYS.settingsSchemaVersion,
] as const;

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEYS);

  return normalizeSettings({
    sourceLang: result[STORAGE_KEYS.sourceLang],
    targetLang: result[STORAGE_KEYS.targetLang],
    thinkingLevel: result[STORAGE_KEYS.thinkingLevel],
    resumeMode: result[STORAGE_KEYS.resumeMode],
    schemaVersion: result[STORAGE_KEYS.settingsSchemaVersion],
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
    [STORAGE_KEYS.settingsSchemaVersion]: SETTINGS_SCHEMA_VERSION,
  });

  return next;
}
