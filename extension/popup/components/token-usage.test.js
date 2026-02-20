import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateEstimatedCost,
  calculateTokenUsage,
  formatTokenNumber,
} from './token-usage.js';

test('calculateTokenUsage: aggregates today and rolling 30-day usage', () => {
  const now = new Date('2026-02-20T12:00:00.000Z');
  const history = {
    '2026-02-20': { input: 1000, output: 2000 },
    '2026-02-10': { input: 300, output: 500 },
    '2026-01-21': { input: 100, output: 100 },
    '2026-01-20': { input: 999, output: 999 }, // 컷오프 이전 (제외)
  };

  const usage = calculateTokenUsage(history, now);
  assert.deepEqual(usage.today, { input: 1000, output: 2000 });
  assert.deepEqual(usage.monthly, { input: 1400, output: 2600 });
});

test('calculateEstimatedCost: computes price from input/output tokens', () => {
  const cost = calculateEstimatedCost({ input: 1_000_000, output: 1_000_000 });
  assert.equal(cost, 3.5);
});

test('formatTokenNumber: formats K/M suffix values', () => {
  assert.equal(formatTokenNumber(999), '999');
  assert.equal(formatTokenNumber(1500), '1.5K');
  assert.equal(formatTokenNumber(2_500_000), '2.50M');
});

