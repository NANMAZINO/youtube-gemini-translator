import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGeminiResponse, repairTruncatedJson } from './client.ts';

test('repairTruncatedJson returns null when JSON cannot be repaired', () => {
  assert.equal(repairTruncatedJson('{"broken": true'), null);
});

test('parseGeminiResponse repairs truncated arrays when a valid object tail exists', () => {
  const parsed = parseGeminiResponse(
    '[{"start":"0:01","text":"hello"},{"start":"0:02","text":"world"}',
    'translation',
  );

  assert.deepEqual(parsed, [
    { start: '0:01', text: 'hello' },
    { start: '0:02', text: 'world' },
  ]);
});

test('parseGeminiResponse throws when the model returns an empty payload', () => {
  assert.throws(
    () => parseGeminiResponse('[]', 'translation'),
    (error) =>
      error instanceof Error &&
      error.name === 'GeminiParseError' &&
      error.message === 'Gemini returned an empty translation payload.',
  );
});

test('parseGeminiResponse throws when the model returns irreparable JSON', () => {
  assert.throws(
    () => parseGeminiResponse('{"broken": true', 'refine'),
    (error) =>
      error instanceof Error &&
      error.name === 'GeminiParseError' &&
      error.message === 'Gemini returned invalid JSON for refine.',
  );
});
