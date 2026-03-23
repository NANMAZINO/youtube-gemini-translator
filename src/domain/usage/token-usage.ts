import type { TokenUsage, UsageSummary } from '../../shared/contracts/index.ts';

const INPUT_PRICE_PER_TOKEN = 0.5 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 3 / 1_000_000;

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function summarizeTokenUsage(
  history: Record<string, TokenUsage> = {},
  now = new Date(),
): UsageSummary {
  const normalizedHistory =
    history && typeof history === 'object' ? history : {};
  const today = toIsoDate(now);
  const todayUsage = normalizedHistory[today] || { input: 0, output: 0 };

  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoff = toIsoDate(cutoffDate);

  const monthly = Object.entries(normalizedHistory)
    .filter(([date]) => date >= cutoff)
    .reduce<TokenUsage>(
      (acc, [, usage]) => ({
        input: acc.input + (usage?.input || 0),
        output: acc.output + (usage?.output || 0),
      }),
      { input: 0, output: 0 },
    );

  return {
    today: {
      input: todayUsage.input || 0,
      output: todayUsage.output || 0,
    },
    monthly,
  };
}

export function calculateEstimatedCost(usage: TokenUsage) {
  return (
    (usage?.input || 0) * INPUT_PRICE_PER_TOKEN +
    (usage?.output || 0) * OUTPUT_PRICE_PER_TOKEN
  );
}

export function formatTokenCount(value: number) {
  const normalized = Number(value) || 0;
  if (normalized >= 1_000_000) return `${(normalized / 1_000_000).toFixed(2)}M`;
  if (normalized >= 1_000) return `${(normalized / 1_000).toFixed(1)}K`;
  return `${normalized}`;
}
