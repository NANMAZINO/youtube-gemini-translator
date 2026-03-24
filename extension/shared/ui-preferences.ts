import type {
  ResolvedTheme,
  ResolvedUiLocale,
  ThemeMode,
  UiLocale,
} from './contracts/index.ts';

function normalizeLocaleTag(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function resolveUiLocale(
  preference: UiLocale,
  browserLanguage = '',
): ResolvedUiLocale {
  if (preference === 'en' || preference === 'ko') {
    return preference;
  }

  return /^ko(?:[-_]|$)/i.test(normalizeLocaleTag(browserLanguage))
    ? 'ko'
    : 'en';
}

export function detectSystemDarkTheme(
  matchMedia: ((query: string) => MediaQueryList) | undefined,
) {
  return !!matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function detectYouTubeDarkTheme(rootDocument: Document) {
  const html = rootDocument.documentElement;
  const ytdApp = rootDocument.querySelector('ytd-app');

  const candidates = [html, ytdApp].filter(
    (candidate): candidate is Element => candidate !== null,
  );

  return candidates.some((candidate) => {
    const className =
      typeof candidate.className === 'string' ? candidate.className : '';
    const theme = candidate.getAttribute('theme');
    const isDarkTheme = candidate.getAttribute('is-dark-theme');

    return (
      candidate.hasAttribute('dark') ||
      candidate.hasAttribute('dark-theme') ||
      theme === 'dark' ||
      isDarkTheme === 'true' ||
      /\bdark\b/i.test(className)
    );
  });
}

export function resolvePopupTheme(
  mode: ThemeMode,
  options: {
    systemDark: boolean;
  },
): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  return options.systemDark ? 'dark' : 'light';
}

export function resolveContentTheme(
  mode: ThemeMode,
  options: {
    youtubeDark: boolean;
    systemDark: boolean;
  },
): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  return options.youtubeDark || options.systemDark ? 'dark' : 'light';
}
