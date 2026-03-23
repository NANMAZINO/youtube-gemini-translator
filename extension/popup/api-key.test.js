import assert from 'node:assert/strict';
import test from 'node:test';

import { isLikelyApiKey, normalizeApiKeyInput } from './api-key.ts';

test('normalizeApiKeyInput trims surrounding whitespace', () => {
  assert.equal(normalizeApiKeyInput('  AI-test-key  '), 'AI-test-key');
});

test('isLikelyApiKey accepts AI-prefixed values', () => {
  assert.equal(isLikelyApiKey('AI-short'), true);
});

test('isLikelyApiKey accepts long fallback values', () => {
  assert.equal(isLikelyApiKey('x'.repeat(30)), true);
});

test('isLikelyApiKey rejects short non-AI values', () => {
  assert.equal(isLikelyApiKey('short-key'), false);
});
