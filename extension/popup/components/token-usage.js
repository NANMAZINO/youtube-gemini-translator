// popup/components/token-usage.js
// 토큰 사용량 집계/비용 계산 전용 순수 로직

const INPUT_PRICE_PER_TOKEN = 0.5 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 3.0 / 1_000_000;

function toIsoDate(date) {
  return date.toISOString().split('T')[0];
}

export function calculateTokenUsage(history = {}, now = new Date()) {
  const normalizedHistory = history && typeof history === 'object' ? history : {};
  const today = toIsoDate(now);
  const todayUsage = normalizedHistory[today] || { input: 0, output: 0 };

  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = toIsoDate(cutoffDate);

  const monthlyUsage = Object.entries(normalizedHistory)
    .filter(([date]) => date >= cutoffStr)
    .reduce(
      (acc, [, usage]) => ({
        input: acc.input + (usage?.input || 0),
        output: acc.output + (usage?.output || 0),
      }),
      { input: 0, output: 0 },
    );

  return {
    today: { input: todayUsage.input || 0, output: todayUsage.output || 0 },
    monthly: monthlyUsage,
  };
}

export function calculateEstimatedCost(usage) {
  const input = usage?.input || 0;
  const output = usage?.output || 0;
  return input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN;
}

export function formatTokenNumber(num) {
  const value = Number(num) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}
