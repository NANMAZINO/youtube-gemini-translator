// lib/cache.js - chrome.storage.local 기반 글로벌 캐시 관리 모듈

const INDEX_KEY = 'idx_translations';
const DATA_PREFIX = 'dat_';
const MAX_CACHE_ENTRIES = 100;

/**
 * 캐시 저장 (메타데이터와 본문 데이터 분리 저장)
 */
export async function saveToCache(videoId, translations, metadata = {}) {
  try {
    const targetLang = metadata.targetLang || '한국어';
    const cacheKey = `${videoId}_${targetLang}`;
    const dataKey = `${DATA_PREFIX}${cacheKey}`;

    // 1. 데이터(본문) 저장
    const data = {
      videoId: cacheKey,
      originalVideoId: videoId,
      translations,
      timestamp: Date.now(),
      title: metadata.title || 'Unknown Video',
      sourceLang: metadata.sourceLang || 'Auto',
      targetLang: targetLang,
      isRefined: !!metadata.isRefined
    };

    await chrome.storage.local.set({ [dataKey]: data });

    // 2. 인덱스(목록) 업데이트
    const result = await chrome.storage.local.get(INDEX_KEY);
    let index = result[INDEX_KEY] || [];

    // 기존 동일 영상/언어 항목 제거 (중복 방지)
    index = index.filter(item => item.videoId !== cacheKey);

    // 새 항목 추가 (맨 앞에)
    index.unshift({
      videoId: cacheKey,
      title: data.title,
      sourceLang: data.sourceLang,
      targetLang: data.targetLang,
      timestamp: data.timestamp,
      isRefined: data.isRefined
    });

    // 최대 개수 제한 (100개)
    if (index.length > MAX_CACHE_ENTRIES) {
      const removedItems = index.splice(MAX_CACHE_ENTRIES);
      // 삭제된 항목들의 실제 데이터도 삭제 (백그라운드 처리 권장되나 여기선 일단 직접 삭제)
      const removedKeys = removedItems.map(item => `${DATA_PREFIX}${item.videoId}`);
      await chrome.storage.local.remove(removedKeys);
    }

    await chrome.storage.local.set({ [INDEX_KEY]: index });
    return true;
  } catch (error) {
    console.error('[Cache] Save failed:', error);
    return false;
  }
}

/**
 * 캐시 조회 (본문 데이터)
 */
export async function getFromCache(videoId, targetLang) {
  try {
    const cacheKey = `${videoId}_${targetLang}`;
    const dataKey = `${DATA_PREFIX}${cacheKey}`;
    const result = await chrome.storage.local.get(dataKey);
    
    if (result[dataKey]) {
      return result[dataKey];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 전체 캐시 메타데이터(목록) 조회
 */
export async function getAllCacheMetadata() {
  try {
    const result = await chrome.storage.local.get(INDEX_KEY);
    return result[INDEX_KEY] || [];
  } catch (error) {
    console.error('[Cache] GetAllMetadata failed:', error);
    return [];
  }
}

/**
 * 특정 캐시 삭제
 */
export async function deleteFromCache(cacheKey) {
  try {
    const dataKey = `${DATA_PREFIX}${cacheKey}`;
    
    // 1. 데이터 삭제
    await chrome.storage.local.remove(dataKey);
    
    // 2. 인덱스에서 제거
    const result = await chrome.storage.local.get(INDEX_KEY);
    const index = result[INDEX_KEY] || [];
    const updatedIndex = index.filter(item => item.videoId !== cacheKey);
    
    await chrome.storage.local.set({ [INDEX_KEY]: updatedIndex });
    return { success: true };
  } catch (error) {
    console.error('[Cache] Delete failed:', error);
    return { success: false };
  }
}

/**
 * 모든 캐시 삭제
 */
export async function clearCache() {
  try {
    const result = await chrome.storage.local.get(INDEX_KEY);
    const index = result[INDEX_KEY] || [];
    
    const keysToDelete = [INDEX_KEY, ...index.map(item => `${DATA_PREFIX}${item.videoId}`)];
    await chrome.storage.local.remove(keysToDelete);
    return true;
  } catch (error) {
    console.error('[Cache] Clear failed:', error);
    return false;
  }
}

/**
 * (선택) 캐시 용량 계산
 */
export async function getCacheStorageSize() {
  try {
    const index = await getAllCacheMetadata();
    const keys = [INDEX_KEY, ...index.map(item => `${DATA_PREFIX}${item.videoId}`)];
    
    if (keys.length === 0) return 0;
    
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(keys, (bytes) => {
        resolve(bytes);
      });
    });
  } catch (error) {
    console.error('[Cache] Size calculation failed:', error);
    return 0;
  }
}

/**
 * 캐시 개수 조회
 */
export async function getCacheCount() {
  try {
    const list = await getAllCacheMetadata();
    return list.length;
  } catch {
    return 0;
  }
}
