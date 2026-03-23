export function normalizeApiKeyInput(value: string) {
  return value.trim();
}

export function isLikelyApiKey(value: string) {
  const normalized = normalizeApiKeyInput(value);
  return normalized.startsWith('AI') || normalized.length >= 30;
}
