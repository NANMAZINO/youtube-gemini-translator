import type { ExportBundle, TranslationChunk } from '../shared/contracts/index.ts';

export class ImportBundleError extends Error {
  code:
    | 'IMPORT_BUNDLE_INVALID_JSON'
    | 'IMPORT_BUNDLE_EMPTY'
    | 'IMPORT_BUNDLE_INVALID_ROW';

  constructor(
    code:
      | 'IMPORT_BUNDLE_INVALID_JSON'
      | 'IMPORT_BUNDLE_EMPTY'
      | 'IMPORT_BUNDLE_INVALID_ROW',
    message: string,
  ) {
    super(message);
    this.name = 'ImportBundleError';
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function normalizeTranslationChunk(value: unknown): TranslationChunk {
  if (!isObject(value)) {
    throw new ImportBundleError(
      'IMPORT_BUNDLE_INVALID_ROW',
      'Imported JSON must be a non-empty array of caption rows with "start" and "text".',
    );
  }

  const start = typeof value.start === 'string' ? value.start.trim() : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const id = typeof value.id === 'string' ? value.id : undefined;

  if (!start || !text) {
    throw new ImportBundleError(
      'IMPORT_BUNDLE_INVALID_ROW',
      'Imported JSON must be a non-empty array of caption rows with "start" and "text".',
    );
  }

  return {
    ...(id ? { id } : {}),
    start,
    text,
  };
}

export function parseImportBundle(jsonText: string): ExportBundle {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new ImportBundleError(
      'IMPORT_BUNDLE_INVALID_JSON',
      'Imported JSON must be valid JSON subtitle data.',
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new ImportBundleError(
      'IMPORT_BUNDLE_EMPTY',
      'Imported JSON must be a non-empty array of caption rows with "start" and "text".',
    );
  }

  return parsed.map((item) => normalizeTranslationChunk(item));
}

export function serializeExportBundle(bundle: ExportBundle) {
  return JSON.stringify(bundle, null, 2);
}
