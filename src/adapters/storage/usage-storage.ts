import type { UsageSummary } from '../../shared/contracts/usage.ts';
import type { TokenUsage } from '../../shared/contracts/usage.ts';
import { summarizeTokenUsage } from '../../domain/usage/token-usage.ts';
import { STORAGE_KEYS } from './schema.ts';

export async function getUsageSummary(now = new Date()): Promise<UsageSummary> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.tokenHistory);
  const history = result[STORAGE_KEYS.tokenHistory];
  const normalizedHistory =
    history && typeof history === 'object'
      ? (history as Record<string, TokenUsage>)
      : {};
  return summarizeTokenUsage(normalizedHistory, now);
}

export async function updateTokenUsage(inputTokens: number, outputTokens: number) {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(STORAGE_KEYS.tokenHistory);
  const history =
    result[STORAGE_KEYS.tokenHistory] &&
    typeof result[STORAGE_KEYS.tokenHistory] === 'object'
      ? (result[STORAGE_KEYS.tokenHistory] as Record<string, TokenUsage>)
      : {};

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
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const trimmedHistory = Object.fromEntries(
    Object.entries(updatedHistory).filter(([date]) => date >= cutoff),
  );

  await chrome.storage.local.set({
    [STORAGE_KEYS.tokenHistory]: trimmedHistory,
  });
}
