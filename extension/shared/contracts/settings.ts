export const SETTINGS_SCHEMA_VERSION = 2;

export const SOURCE_LANGUAGES = ['Auto', '한국어', 'English', '日本語'] as const;
export const TARGET_LANGUAGES = ['한국어', 'English', '日本語'] as const;
export const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const;
export const UI_LOCALES = ['auto', 'en', 'ko'] as const;
export const THEME_MODES = ['system', 'light', 'dark'] as const;

export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number];
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type UiLocale = (typeof UI_LOCALES)[number];
export type ResolvedUiLocale = Exclude<UiLocale, 'auto'>;
export type ThemeMode = (typeof THEME_MODES)[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export interface Settings {
  sourceLang: SourceLanguage;
  targetLang: TargetLanguage;
  thinkingLevel: ThinkingLevel;
  resumeMode: boolean;
  uiLocale: UiLocale;
  themeMode: ThemeMode;
  schemaVersion: number;
}

export type SettingsInput = Omit<Settings, 'schemaVersion'>;

export const DEFAULT_SETTINGS: Settings = {
  sourceLang: 'Auto',
  targetLang: '한국어',
  thinkingLevel: 'minimal',
  resumeMode: true,
  uiLocale: 'auto',
  themeMode: 'system',
  schemaVersion: SETTINGS_SCHEMA_VERSION,
};

function isAllowedValue<T extends string>(
  allowedValues: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

export function isSourceLanguage(value: unknown): value is SourceLanguage {
  return isAllowedValue(SOURCE_LANGUAGES, value);
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return isAllowedValue(TARGET_LANGUAGES, value);
}

export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return isAllowedValue(THINKING_LEVELS, value);
}

export function isUiLocale(value: unknown): value is UiLocale {
  return isAllowedValue(UI_LOCALES, value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return isAllowedValue(THEME_MODES, value);
}

export function normalizeSettingsInput(
  input: Partial<Record<keyof SettingsInput, unknown>> = {},
): SettingsInput {
  return {
    sourceLang: isSourceLanguage(input.sourceLang)
      ? input.sourceLang
      : DEFAULT_SETTINGS.sourceLang,
    targetLang: isTargetLanguage(input.targetLang)
      ? input.targetLang
      : DEFAULT_SETTINGS.targetLang,
    thinkingLevel: isThinkingLevel(input.thinkingLevel)
      ? input.thinkingLevel
      : DEFAULT_SETTINGS.thinkingLevel,
    resumeMode:
      typeof input.resumeMode === 'boolean'
        ? input.resumeMode
        : DEFAULT_SETTINGS.resumeMode,
    uiLocale:
      isUiLocale(input.uiLocale)
        ? input.uiLocale
        : DEFAULT_SETTINGS.uiLocale,
    themeMode:
      isThemeMode(input.themeMode)
        ? input.themeMode
        : DEFAULT_SETTINGS.themeMode,
  };
}

export function normalizeSettings(
  input: Partial<Record<keyof Settings | keyof SettingsInput, unknown>> = {},
): Settings {
  const normalizedInput = normalizeSettingsInput(input);

  return {
    ...normalizedInput,
    schemaVersion:
      typeof input.schemaVersion === 'number'
        ? input.schemaVersion
        : SETTINGS_SCHEMA_VERSION,
  };
}
