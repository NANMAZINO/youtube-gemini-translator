// content/cache.js - IndexedDB 캐시 관리 모듈

const CACHE_DB_NAME = 'yt-ai-translator';
const CACHE_STORE_NAME = 'translations';
const CACHE_DB_VERSION = 1;
const MAX_CACHE_ENTRIES = 100;

function openCacheDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'videoId' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function getFromCache(videoId, targetLang) {
  try {
    const db = await openCacheDB();
    const cacheKey = `${videoId}_${targetLang}`;
    const result = await new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.get(cacheKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (result) {
      updateCacheTimestamp(cacheKey);
      return result.translations;
    }
    return null;
  } catch { return null; }
}

/**
 * 캐시 저장 (메타데이터 포함)
 */
export async function saveToCache(videoId, translations, metadata = {}) {
  try {
    const db = await openCacheDB();
    await cleanupCache(db);
    const targetLang = metadata.targetLang || '한국어';
    const cacheKey = `${videoId}_${targetLang}`;
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const data = { 
        videoId: cacheKey, // 비디오 ID와 언어를 조합한 복합 키 사용
        originalVideoId: videoId,
        translations, 
        timestamp: Date.now(),
        title: metadata.title || 'Unknown Video',
        sourceLang: metadata.sourceLang || 'Auto',
        targetLang: targetLang
      };
      const request = store.put(data);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) { console.error('[Cache] Save failed:', error); }
}

/**
 * 모든 캐시의 메타데이터만 조회
 */
export async function getAllCacheMetadata() {
  try {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll(); // 전체 데이터를 가져오되 팝업에서 필요한 것만 필터링해서 씀
      
      request.onsuccess = () => {
        // translations는 제외하고 가벼운 정보만 매핑해서 반환
        const metadataList = request.result.map(item => ({
          videoId: item.videoId,
          title: item.title,
          sourceLang: item.sourceLang,
          targetLang: item.targetLang,
          timestamp: item.timestamp
        })).sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬
        resolve(metadataList);
      };
      request.onerror = () => reject(request.error);
    });
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
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.delete(cacheKey);
      request.onsuccess = () => resolve({ success: true });
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Cache] Delete failed:', error);
    return { success: false };
  }
}

/**
 * 캐시 스토리지 용량 계산 (대략적 추정)
 */
export async function getCacheStorageSize() {
  try {
    const db = await openCacheDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        // JSON 문자열화하여 대략적인 바이트 수 계산
        const totalBytes = items.reduce((acc, item) => {
          return acc + new Blob([JSON.stringify(item)]).size;
        }, 0);
        resolve(totalBytes);
      };
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

async function updateCacheTimestamp(cacheKey) {
  const db = await openCacheDB();
  const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(CACHE_STORE_NAME);
  const request = store.get(cacheKey);
  request.onsuccess = () => {
    const data = request.result;
    if (data) { data.timestamp = Date.now(); store.put(data); }
  };
}

async function cleanupCache(db) {
  const transaction = db.transaction(CACHE_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(CACHE_STORE_NAME);
  const count = await new Promise(r => {
      const req = store.count();
      req.onsuccess = () => r(req.result);
  });

  if (count >= MAX_CACHE_ENTRIES) {
    const index = store.index('timestamp');
    const cursorReq = index.openCursor();
    let deleteCount = count - MAX_CACHE_ENTRIES + 10;
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && deleteCount > 0) {
        store.delete(cursor.primaryKey);
        deleteCount--;
        cursor.continue();
      }
    };
  }
}

// 팝업용 유틸리티
export async function getCacheCount() {
    const db = await openCacheDB();
    return new Promise(r => {
        const store = db.transaction(CACHE_STORE_NAME, 'readonly').objectStore(CACHE_STORE_NAME);
        const req = store.count();
        req.onsuccess = () => r(req.result);
    });
}

export async function clearCache() {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction(CACHE_STORE_NAME, 'readwrite').objectStore(CACHE_STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject();
    });
}
