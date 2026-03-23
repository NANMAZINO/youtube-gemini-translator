function xorCipher(text: string, key: string) {
  return Array.from(text)
    .map((char, index) =>
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(index % key.length)),
    )
    .join('');
}

function encodeBase64(value: string) {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  return Buffer.from(value, 'binary').toString('base64');
}

function decodeBase64(value: string) {
  if (typeof atob === 'function') {
    return atob(value);
  }

  return Buffer.from(value, 'base64').toString('binary');
}

function getXorKey() {
  return chrome.runtime.id || 'yt-ai-translator-fallback';
}

export async function saveApiKey(apiKey: string) {
  const encoded = encodeBase64(xorCipher(apiKey, getXorKey()));
  await chrome.storage.local.set({ apiKey: encoded });
}

export async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  const stored = result.apiKey;
  if (!stored || typeof stored !== 'string') return null;

  try {
    const decoded = xorCipher(decodeBase64(stored), getXorKey());
    const isPrintableAscii = /^[\x20-\x7E]+$/.test(decoded);
    if (isPrintableAscii) {
      return decoded;
    }

    throw new Error('legacy format');
  } catch {
    await saveApiKey(stored);
    return stored;
  }
}

export async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
}
