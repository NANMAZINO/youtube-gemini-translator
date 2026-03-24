import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import {
  detectSystemDarkTheme,
  detectYouTubeDarkTheme,
  resolveContentTheme,
  resolvePopupTheme,
  resolveUiLocale,
} from './ui-preferences.ts';

test('resolveUiLocale respects explicit values and auto-detects Korean browsers', () => {
  assert.equal(resolveUiLocale('en', 'ko-KR'), 'en');
  assert.equal(resolveUiLocale('ko', 'en-US'), 'ko');
  assert.equal(resolveUiLocale('auto', 'ko-KR'), 'ko');
  assert.equal(resolveUiLocale('auto', 'en-US'), 'en');
});

test('resolvePopupTheme follows explicit modes and system fallback', () => {
  assert.equal(resolvePopupTheme('light', { systemDark: true }), 'light');
  assert.equal(resolvePopupTheme('dark', { systemDark: false }), 'dark');
  assert.equal(resolvePopupTheme('system', { systemDark: true }), 'dark');
  assert.equal(resolvePopupTheme('system', { systemDark: false }), 'light');
});

test('resolveContentTheme prefers explicit modes and YouTube dark state for system mode', () => {
  assert.equal(
    resolveContentTheme('system', {
      youtubeDark: true,
      systemDark: false,
    }),
    'dark',
  );
  assert.equal(
    resolveContentTheme('system', {
      youtubeDark: false,
      systemDark: true,
    }),
    'dark',
  );
  assert.equal(
    resolveContentTheme('system', {
      youtubeDark: false,
      systemDark: false,
    }),
    'light',
  );
});

test('detectSystemDarkTheme reads matchMedia state safely', () => {
  assert.equal(
    detectSystemDarkTheme((query) => ({
      media: query,
      matches: true,
    })),
    true,
  );
  assert.equal(detectSystemDarkTheme(undefined), false);
});

test('detectYouTubeDarkTheme finds dark markers on html and ytd-app', () => {
  const darkDom = new JSDOM('<!doctype html><html dark><body><ytd-app></ytd-app></body></html>');
  assert.equal(detectYouTubeDarkTheme(darkDom.window.document), true);

  const appDarkDom = new JSDOM(
    '<!doctype html><html><body><ytd-app is-dark-theme="true"></ytd-app></body></html>',
  );
  assert.equal(detectYouTubeDarkTheme(appDarkDom.window.document), true);

  const lightDom = new JSDOM('<!doctype html><html><body><ytd-app></ytd-app></body></html>');
  assert.equal(detectYouTubeDarkTheme(lightDom.window.document), false);
});
