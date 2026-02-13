// content/message-handler.js
// 팝업 ↔ 콘텐츠 스크립트 메시지 라우팅

export function registerRuntimeMessageHandler({
  getCacheCount,
  getAllCacheMetadata,
  deleteFromCache,
  getVideoId,
  clearUI,
  clearCache,
  getCacheStorageSize,
}) {
  const messageListener = (request, sender, sendResponse) => {
    if (request.type === 'GET_CACHE_COUNT') {
      getCacheCount().then((count) => sendResponse({ count }));
      return true;
    }

    if (request.type === 'GET_ALL_CACHE') {
      getAllCacheMetadata().then((list) => sendResponse({ list }));
      return true;
    }

    if (request.type === 'DELETE_CACHE') {
      deleteFromCache(request.payload.videoId).then((res) => {
        const videoId = getVideoId();
        chrome.storage.local.get(['targetLang'], (settings) => {
          const currentLang = settings.targetLang || '한국어';
          if (request.payload.videoId === `${videoId}_${currentLang}`) {
            clearUI();
          }
        });
        sendResponse(res);
      });
      return true;
    }

    if (request.type === 'CLEAR_CACHE') {
      clearCache().then(() => {
        clearUI();
        sendResponse({ success: true });
      });
      return true;
    }

    if (request.type === 'GET_CACHE_SIZE') {
      getCacheStorageSize().then((size) => sendResponse({ size }));
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(messageListener);
}
