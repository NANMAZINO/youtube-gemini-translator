import { createLogger } from './logger.js';

const log = createLogger('Storage');

function xorCipher(text, key) {
  return Array.from(text)
    .map((char, i) =>
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length)),
    )
    .join('');
}

function getXorKey() {
  return chrome.runtime.id || 'yt-ai-translator-fallback';
}

export async function saveApiKey(apiKey) {
  const encoded = btoa(xorCipher(apiKey, getXorKey()));
  await chrome.storage.local.set({ apiKey: encoded });
}

export async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  const stored = result.apiKey;
  if (!stored) return null;

  try {
    const decoded = xorCipher(atob(stored), getXorKey());
    const isValid = /^[\x20-\x7E]+$/.test(decoded);
    if (isValid) return decoded;
    throw new Error('legacy format');
  } catch {
    log.info('Detected legacy API key format. Migrating to encoded storage.');
    await saveApiKey(stored);
    return stored;
  }
}

export async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
}

export async function updateTokenUsage(inputTokens, outputTokens) {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};

  const todayUsage = history[today] || { input: 0, output: 0 };
  const updatedHistory = {
    ...history,
    [today]: {
      input: todayUsage.input + inputTokens,
      output: todayUsage.output + outputTokens,
    },
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const cleanedHistory = Object.fromEntries(
    Object.entries(updatedHistory).filter(([date]) => date >= cutoffStr),
  );

  await chrome.storage.local.set({ tokenHistory: cleanedHistory });
}
