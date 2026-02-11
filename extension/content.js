// content.js - Content Script 로더
// MV3 Content Script는 module을 직접 지원하지 않으므로
// dynamic import로 메인 모듈을 로드

(async () => {
  try {
    const src = chrome.runtime.getURL('content/main.js');
    await import(src);
  } catch (error) {
    // 로거 모듈 로드 전이므로 console.error 직접 사용 (불가피)
    console.error('[YT-AI-Translator] Failed to load modules:', error);
  }
})();
