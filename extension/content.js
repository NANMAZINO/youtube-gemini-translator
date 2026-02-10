// YouTube AI Translator - Content Loader
// V3 Content scripts don't support "type: module" directly, so we use dynamic import.

(async () => {
  try {
    const src = chrome.runtime.getURL('content/main.js');
    await import(src);

  } catch (error) {
    console.error('[YT-AI-Translator] Failed to load modules:', error);
  }
})();
