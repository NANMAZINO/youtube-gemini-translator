// infrastructure/storage/cache.js - chrome.storage.local based global cache module
import {
  MAX_CACHE_ENTRIES,
  CACHE_TTL_DAYS,
  CACHE_INDEX_KEY,
  CACHE_DATA_PREFIX,
} from '../../core/constants.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('Cache');
const INDEX_KEY = CACHE_INDEX_KEY;
const DATA_PREFIX = CACHE_DATA_PREFIX;
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

async function cleanExpiredEntries() {
  try {
    const result = await chrome.storage.local.get(INDEX_KEY);
    const index = result[INDEX_KEY] || [];
    if (index.length === 0) return [];

    const now = Date.now();
    const expired = [];
    const valid = [];

    for (const item of index) {
      if (now - item.timestamp > CACHE_TTL_MS) expired.push(item);
      else valid.push(item);
    }

    if (expired.length > 0) {
      const expiredKeys = expired.map((item) => `${DATA_PREFIX}${item.videoId}`);
      await chrome.storage.local.remove(expiredKeys);
      await chrome.storage.local.set({ [INDEX_KEY]: valid });
    }

    return expired.map((item) => item.videoId);
  } catch {
    return [];
  }
}

export async function saveToCache(videoId, translations, metadata = {}) {
  try {
    const targetLang = metadata.targetLang || '한국어';
    const cacheKey = `${videoId}_${targetLang}`;
    const dataKey = `${DATA_PREFIX}${cacheKey}`;

    const data = {
      videoId: cacheKey,
      originalVideoId: videoId,
      translations,
      timestamp: Date.now(),
      title: metadata.title || 'Unknown Video',
      sourceLang: metadata.sourceLang || 'Auto',
      targetLang,
      isRefined: !!metadata.isRefined,
      isPartial: !!metadata.isPartial,
      completedChunkCount: metadata.completedChunkCount ?? 0,
      transcriptFingerprint: metadata.transcriptFingerprint || '',
      sourceChunkCheckpoints: Array.isArray(metadata.sourceChunkCheckpoints)
        ? metadata.sourceChunkCheckpoints
        : [],
    };

    await chrome.storage.local.set({ [dataKey]: data });

    const result = await chrome.storage.local.get(INDEX_KEY);
    let index = result[INDEX_KEY] || [];
    index = index.filter((item) => item.videoId !== cacheKey);

    index.unshift({
      videoId: cacheKey,
      title: data.title,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      timestamp: data.timestamp,
      isRefined: data.isRefined,
      isPartial: data.isPartial,
    });

    if (index.length > MAX_CACHE_ENTRIES) {
      const removedItems = index.splice(MAX_CACHE_ENTRIES);
      const removedKeys = removedItems.map((item) => `${DATA_PREFIX}${item.videoId}`);
      await chrome.storage.local.remove(removedKeys);
    }

    await chrome.storage.local.set({ [INDEX_KEY]: index });
    return true;
  } catch (error) {
    log.error('Save failed:', error);
    return false;
  }
}

// Partial save path: updates data key only and does not touch index list.
export async function savePartialTranslation(videoId, translations, metadata = {}) {
  try {
    const targetLang = metadata.targetLang || '한국어';
    const cacheKey = `${videoId}_${targetLang}`;
    const dataKey = `${DATA_PREFIX}${cacheKey}`;

    const data = {
      videoId: cacheKey,
      originalVideoId: videoId,
      translations,
      timestamp: Date.now(),
      title: metadata.title || 'Unknown Video',
      sourceLang: metadata.sourceLang || 'Auto',
      targetLang,
      isRefined: false,
      isPartial: true,
      completedChunkCount: metadata.completedChunkCount ?? 0,
      transcriptFingerprint: metadata.transcriptFingerprint || '',
      sourceChunkCheckpoints: Array.isArray(metadata.sourceChunkCheckpoints)
        ? metadata.sourceChunkCheckpoints
        : [],
    };

    await chrome.storage.local.set({ [dataKey]: data });
    return true;
  } catch (error) {
    log.error('Partial save failed:', error);
    return false;
  }
}

export async function getFromCache(videoId, targetLang) {
  try {
    await cleanExpiredEntries();

    const cacheKey = `${videoId}_${targetLang}`;
    const dataKey = `${DATA_PREFIX}${cacheKey}`;
    const result = await chrome.storage.local.get(dataKey);

    return result[dataKey] || null;
  } catch {
    return null;
  }
}

export async function getAllCacheMetadata() {
  try {
    await cleanExpiredEntries();
    const result = await chrome.storage.local.get(INDEX_KEY);
    return result[INDEX_KEY] || [];
  } catch {
    return [];
  }
}

export async function deleteFromCache(cacheKey) {
  try {
    const dataKey = `${DATA_PREFIX}${cacheKey}`;
    await chrome.storage.local.remove(dataKey);

    const result = await chrome.storage.local.get(INDEX_KEY);
    const index = result[INDEX_KEY] || [];
    const updatedIndex = index.filter((item) => item.videoId !== cacheKey);

    await chrome.storage.local.set({ [INDEX_KEY]: updatedIndex });
    return { success: true };
  } catch (error) {
    log.error('Delete failed:', error);
    return { success: false };
  }
}

export async function clearCache() {
  try {
    const result = await chrome.storage.local.get(INDEX_KEY);
    const index = result[INDEX_KEY] || [];

    const keysToDelete = [INDEX_KEY, ...index.map((item) => `${DATA_PREFIX}${item.videoId}`)];
    await chrome.storage.local.remove(keysToDelete);
    return true;
  } catch (error) {
    log.error('Clear failed:', error);
    return false;
  }
}

export async function getCacheStorageSize() {
  try {
    const index = await getAllCacheMetadata();
    const keys = [INDEX_KEY, ...index.map((item) => `${DATA_PREFIX}${item.videoId}`)];
    if (keys.length === 0) return 0;

    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(keys, (bytes) => {
        resolve(bytes);
      });
    });
  } catch (error) {
    log.error('Size calculation failed:', error);
    return 0;
  }
}

export async function getCacheCount() {
  try {
    const list = await getAllCacheMetadata();
    return list.length;
  } catch {
    return 0;
  }
}
