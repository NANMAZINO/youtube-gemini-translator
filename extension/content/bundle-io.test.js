import assert from 'node:assert/strict';
import test from 'node:test';

import { parseImportBundle, serializeExportBundle } from './bundle-io.ts';

test('parseImportBundle accepts a valid translation array', () => {
  const bundle = parseImportBundle(
    JSON.stringify([
      { id: 'seg-1', start: '0:01', text: 'hello' },
      { start: '0:03', text: 'world' },
    ]),
  );

  assert.deepEqual(bundle, [
    { id: 'seg-1', start: '0:01', text: 'hello' },
    { start: '0:03', text: 'world' },
  ]);
});

test('parseImportBundle rejects empty arrays', () => {
  assert.throws(
    () => parseImportBundle('[]'),
    /Imported JSON must be a non-empty array/,
  );
});

test('parseImportBundle rejects invalid JSON payloads', () => {
  assert.throws(
    () => parseImportBundle('{broken'),
    /Imported JSON must be valid JSON subtitle data/,
  );
});

test('parseImportBundle rejects rows without required fields', () => {
  assert.throws(
    () => parseImportBundle(JSON.stringify([{ start: '0:01' }])),
    /Imported JSON must be a non-empty array/,
  );
});

test('serializeExportBundle writes pretty JSON for download', () => {
  assert.equal(
    serializeExportBundle([{ start: '0:01', text: 'hello' }]),
    '[\n  {\n    "start": "0:01",\n    "text": "hello"\n  }\n]',
  );
});
