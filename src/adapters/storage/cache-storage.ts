import type {
  CacheMetadata,
  CacheRecord,
} from '../../shared/contracts/cache.ts';
import {
  CACHE_SCHEMA_VERSION,
} from '../../shared/contracts/cache.ts';
import type {
  SourceChunkCheckpoint,
  TranslationChunk,
} from '../../shared/contracts/transcript.ts';
import { DEFAULT_SETTINGS } from '../../shared/contracts/settings.ts';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from './schema.ts';

const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_DAYS = 30;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

interface RawCacheIndexItem {
  videoId: string;
  title?: string;
  sourceLang?: string;
  targetLang?: string;
  timestamp: number;
  isRefined?: boolean;
  isPartial?: boolean;
}

type RawCacheRecord = {
  videoId?: string;
  originalVideoId?: string;
  title?: string;
  sourceLang?: string;
  targetLang?: string;
  timestamp?: number;
  translations?: unknown;
  isRefined?: boolean;
  isPartial?: boolean;
  completedChunkCount?: number;
  transcriptFingerprint?: string;
  sourceChunkCheckpoints?: unknown[];
};

interface SaveCacheRecordOptions {
  title?: string;
  sourceLang?: string;
  targetLang?: string;
  isRefined?: boolean;
  isPartial?: boolean;
  completedChunkCount?: number;
  transcriptFingerprint?: string;
  sourceChunkCheckpoints?: SourceChunkCheckpoint[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function toFiniteNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function getDataKey(cacheKey: string) {
  return `${STORAGE_KEYS.cacheDataPrefix}${cacheKey}`;
}

function buildCacheKey(videoId: string, targetLang: string) {
  return `${videoId}_${targetLang}`;
}

function normalizeIndex(value: unknown): RawCacheIndexItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is RawCacheIndexItem =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as RawCacheIndexItem).videoId === 'string' &&
      typeof (item as RawCacheIndexItem).timestamp === 'number',
  );
}

function normalizeTranslations(value: unknown): TranslationChunk[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is TranslationChunk =>
        isObject(item) &&
        typeof item.start === 'string' &&
        typeof item.text === 'string',
    )
    .map((item) => ({
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      start: item.start,
      text: item.text,
    }));
}

function normalizeCheckpoint(
  value: unknown,
  fallbackChunkIndex: number,
): SourceChunkCheckpoint | null {
  if (!isObject(value)) return null;

  const chunkIndex = toFiniteNumber(value.chunkIndex);
  const segmentCount = toFiniteNumber(value.segmentCount);
  const chunkFingerprint =
    typeof value.chunkFingerprint === 'string'
      ? value.chunkFingerprint
      : typeof value.fingerprint === 'string'
        ? value.fingerprint
        : '';

  return {
    chunkIndex:
      chunkIndex === null ? fallbackChunkIndex : Math.max(0, Math.floor(chunkIndex)),
    chunkFingerprint,
    firstStartSec:
      toFiniteNumber(value.firstStartSec) ?? toFiniteNumber(value.startSeconds),
    lastStartSec: toFiniteNumber(value.lastStartSec),
    segmentCount:
      segmentCount === null ? 0 : Math.max(0, Math.floor(segmentCount)),
  };
}

function normalizeSourceChunkCheckpoints(value: unknown): SourceChunkCheckpoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((checkpoint, index) => normalizeCheckpoint(checkpoint, index))
    .filter(
      (checkpoint): checkpoint is SourceChunkCheckpoint => checkpoint !== null,
    );
}

function normalizeCacheRecord(
  cacheKey: string,
  record: RawCacheRecord,
  schemaVersion: number,
): CacheRecord {
  return {
    cacheKey,
    originalVideoId:
      typeof record.originalVideoId === 'string'
        ? record.originalVideoId
        : cacheKey,
    title: typeof record.title === 'string' ? record.title : 'Unknown Video',
    sourceLang:
      typeof record.sourceLang === 'string' ? record.sourceLang : 'Auto',
    targetLang:
      typeof record.targetLang === 'string'
        ? record.targetLang
        : DEFAULT_SETTINGS.targetLang,
    timestamp: toFiniteNumber(record.timestamp) ?? 0,
    translations: normalizeTranslations(record.translations),
    isRefined: !!record.isRefined,
    isPartial: !!record.isPartial,
    completedChunkCount: Math.max(
      0,
      Math.floor(toFiniteNumber(record.completedChunkCount) ?? 0),
    ),
    transcriptFingerprint:
      typeof record.transcriptFingerprint === 'string'
        ? record.transcriptFingerprint
        : '',
    sourceChunkCheckpoints: normalizeSourceChunkCheckpoints(
      record.sourceChunkCheckpoints,
    ),
    schemaVersion,
  };
}

function getStoredCacheSchemaVersion(result: Record<string, unknown>) {
  const activeVersion = result[STORAGE_KEYS.cacheSchemaVersion];
  if (typeof activeVersion === 'number') {
    return activeVersion;
  }

  const legacyVersion = result[LEGACY_STORAGE_KEYS.cacheSchemaVersion];
  return typeof legacyVersion === 'number' ? legacyVersion : undefined;
}

async function syncCacheSchemaVersion(version: number) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.cacheSchemaVersion]: version,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.cacheSchemaVersion);
}

async function removeAllCacheEntries() {
  const allItems = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(allItems).filter(
    (key) =>
      key === STORAGE_KEYS.cacheIndex ||
      key === STORAGE_KEYS.cacheSchemaVersion ||
      key === LEGACY_STORAGE_KEYS.cacheSchemaVersion ||
      key.startsWith(STORAGE_KEYS.cacheDataPrefix),
  );

  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
}

async function ensureCompatibleCacheSchema() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.cacheSchemaVersion,
    LEGACY_STORAGE_KEYS.cacheSchemaVersion,
  ]);
  const storedVersion = getStoredCacheSchemaVersion(result);
  const hasLegacySchemaMarker =
    typeof result[LEGACY_STORAGE_KEYS.cacheSchemaVersion] === 'number';

  if (
    typeof storedVersion === 'number' &&
    storedVersion !== CACHE_SCHEMA_VERSION
  ) {
    await removeAllCacheEntries();
  }

  if (storedVersion !== CACHE_SCHEMA_VERSION || hasLegacySchemaMarker) {
    await syncCacheSchemaVersion(CACHE_SCHEMA_VERSION);
  }
}

async function cleanExpiredEntries() {
  await ensureCompatibleCacheSchema();

  const result = await chrome.storage.local.get(STORAGE_KEYS.cacheIndex);
  const index = normalizeIndex(result[STORAGE_KEYS.cacheIndex]);

  if (index.length === 0) return;

  const now = Date.now();
  const expired = index.filter((item) => now - item.timestamp > CACHE_TTL_MS);
  if (expired.length === 0) return;

  const valid = index.filter((item) => now - item.timestamp <= CACHE_TTL_MS);
  await chrome.storage.local.remove(expired.map((item) => getDataKey(item.videoId)));
  await chrome.storage.local.set({ [STORAGE_KEYS.cacheIndex]: valid });
}

async function ensureIndexedCacheEntry(
  cacheKey: string,
  record: RawCacheRecord,
  timestamp: number,
) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.cacheIndex);
  const index = normalizeIndex(result[STORAGE_KEYS.cacheIndex]);

  if (index.some((item) => item.videoId === cacheKey)) {
    return;
  }

  const nextIndex = [
    {
      videoId: cacheKey,
      title: record.title,
      sourceLang: record.sourceLang,
      targetLang: record.targetLang,
      timestamp,
      isRefined: !!record.isRefined,
      isPartial: !!record.isPartial,
    },
    ...index,
  ];

  if (nextIndex.length > MAX_CACHE_ENTRIES) {
    const removedItems = nextIndex.splice(MAX_CACHE_ENTRIES);
    await chrome.storage.local.remove(
      removedItems.map((item) => getDataKey(item.videoId)),
    );
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.cacheIndex]: nextIndex,
  });
}

export async function listCacheMetadata(): Promise<CacheMetadata[]> {
  await cleanExpiredEntries();

  const result = await chrome.storage.local.get(STORAGE_KEYS.cacheIndex);
  const index = normalizeIndex(result[STORAGE_KEYS.cacheIndex]);

  return index.map((item) => ({
    cacheKey: item.videoId,
    title: item.title || 'Unknown Video',
    sourceLang: item.sourceLang || 'Auto',
    targetLang: item.targetLang || DEFAULT_SETTINGS.targetLang,
    timestamp: item.timestamp || 0,
    isRefined: !!item.isRefined,
    isPartial: !!item.isPartial,
    schemaVersion: CACHE_SCHEMA_VERSION,
  }));
}

export async function readCacheRecord(
  videoId: string,
  targetLang: string,
): Promise<CacheRecord | null> {
  await cleanExpiredEntries();

  const cacheKey = buildCacheKey(videoId, targetLang);
  const dataKey = getDataKey(cacheKey);
  const result = await chrome.storage.local.get(dataKey);
  const record = result[dataKey] as RawCacheRecord | undefined;

  if (!record) return null;

  return normalizeCacheRecord(cacheKey, record, CACHE_SCHEMA_VERSION);
}

export async function saveCacheRecord(
  videoId: string,
  translations: TranslationChunk[],
  metadata: SaveCacheRecordOptions = {},
): Promise<CacheRecord> {
  await ensureCompatibleCacheSchema();

  const targetLang = metadata.targetLang || DEFAULT_SETTINGS.targetLang;
  const cacheKey = buildCacheKey(videoId, targetLang);
  const timestamp = Date.now();
  const record: RawCacheRecord = {
    videoId: cacheKey,
    originalVideoId: videoId,
    title: metadata.title || 'Unknown Video',
    sourceLang: metadata.sourceLang || 'Auto',
    targetLang,
    timestamp,
    translations,
    isRefined: !!metadata.isRefined,
    isPartial: !!metadata.isPartial,
    completedChunkCount: metadata.completedChunkCount ?? 0,
    transcriptFingerprint: metadata.transcriptFingerprint || '',
    sourceChunkCheckpoints: normalizeSourceChunkCheckpoints(
      metadata.sourceChunkCheckpoints,
    ),
  };

  await chrome.storage.local.set({ [getDataKey(cacheKey)]: record });

  const result = await chrome.storage.local.get(STORAGE_KEYS.cacheIndex);
  const nextIndex = normalizeIndex(result[STORAGE_KEYS.cacheIndex]).filter(
    (item) => item.videoId !== cacheKey,
  );

  nextIndex.unshift({
    videoId: cacheKey,
    title: record.title,
    sourceLang: record.sourceLang,
    targetLang: record.targetLang,
    timestamp,
    isRefined: record.isRefined,
    isPartial: record.isPartial,
  });

  if (nextIndex.length > MAX_CACHE_ENTRIES) {
    const removedItems = nextIndex.splice(MAX_CACHE_ENTRIES);
    await chrome.storage.local.remove(
      removedItems.map((item) => getDataKey(item.videoId)),
    );
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.cacheIndex]: nextIndex,
    [STORAGE_KEYS.cacheSchemaVersion]: CACHE_SCHEMA_VERSION,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.cacheSchemaVersion);

  return normalizeCacheRecord(cacheKey, record, CACHE_SCHEMA_VERSION);
}

export async function savePartialCacheRecord(
  videoId: string,
  translations: TranslationChunk[],
  metadata: SaveCacheRecordOptions = {},
): Promise<CacheRecord> {
  await ensureCompatibleCacheSchema();

  const targetLang = metadata.targetLang || DEFAULT_SETTINGS.targetLang;
  const cacheKey = buildCacheKey(videoId, targetLang);
  const record: RawCacheRecord = {
    videoId: cacheKey,
    originalVideoId: videoId,
    title: metadata.title || 'Unknown Video',
    sourceLang: metadata.sourceLang || 'Auto',
    targetLang,
    timestamp: Date.now(),
    translations,
    isRefined: false,
    isPartial: true,
    completedChunkCount: metadata.completedChunkCount ?? 0,
    transcriptFingerprint: metadata.transcriptFingerprint || '',
    sourceChunkCheckpoints: normalizeSourceChunkCheckpoints(
      metadata.sourceChunkCheckpoints,
    ),
  };

  await chrome.storage.local.set({
    [getDataKey(cacheKey)]: record,
    [STORAGE_KEYS.cacheSchemaVersion]: CACHE_SCHEMA_VERSION,
  });
  await chrome.storage.local.remove(LEGACY_STORAGE_KEYS.cacheSchemaVersion);

  await ensureIndexedCacheEntry(
    cacheKey,
    record,
    toFiniteNumber(record.timestamp) ?? Date.now(),
  );

  return normalizeCacheRecord(cacheKey, record, CACHE_SCHEMA_VERSION);
}

export async function deleteCacheRecord(cacheKey: string): Promise<boolean> {
  await ensureCompatibleCacheSchema();
  await chrome.storage.local.remove(getDataKey(cacheKey));

  const result = await chrome.storage.local.get(STORAGE_KEYS.cacheIndex);
  const index = normalizeIndex(result[STORAGE_KEYS.cacheIndex]);
  const next = index.filter((item) => item.videoId !== cacheKey);

  await chrome.storage.local.set({ [STORAGE_KEYS.cacheIndex]: next });
  return true;
}

export async function clearCacheRecords(): Promise<boolean> {
  await ensureCompatibleCacheSchema();
  await removeAllCacheEntries();
  await syncCacheSchemaVersion(CACHE_SCHEMA_VERSION);
  return true;
}
