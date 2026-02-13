// content/panel-controller.js
// 사이드 패널 토글/열기 및 버튼 상태 관리

export function createPanelController({
  openTranscriptPanel,
  ensureUIReady,
  getVideoId,
  getFromCache,
  extractCaptions,
  showNotification,
  clearUI,
  renderFromCache,
  startRefine,
  updateExtRefineButton,
  TRANSLATE_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  IMPORT_BUTTON_ID,
  SHADOW_HOST_ID,
  log,
}) {
  /**
   * 패널 토글 핸들러
   */
  async function handleToggleClick(button) {
    const shadowHost = document.getElementById(SHADOW_HOST_ID);

    if (shadowHost) {
      await clearUI(true);
      updateToggleBtnState();
    } else {
      try {
        button.disabled = true;
        button.textContent = '⏳';
        await openPanel();
      } catch (err) {
        log.error('Toggle failed:', err);
        showNotification(err.message, 'error');
      } finally {
        button.disabled = false;
        updateToggleBtnState();
      }
    }
  }

  /**
   * 패널을 열고 필요한 초기화(캐시 로드 등)를 수행하는 핵심 함수
   */
  async function openPanel() {
    await openTranscriptPanel();
    const shadow = await ensureUIReady();

    if (!shadow) throw new Error('패널 준비 실패');

    const videoId = getVideoId();
    const { targetLang } = await chrome.storage.local.get(['targetLang']);
    const currentLang = targetLang || '한국어';
    const cached = await getFromCache(videoId, currentLang);

    if (cached) {
      const mainBtn = document.getElementById(TRANSLATE_BUTTON_ID);
      await renderFromCache(mainBtn, cached.translations, currentLang);

      const result = await extractCaptions();
      const rawCaptions = result?.raw;
      if (cached.isRefined) {
        updateExtRefineButton(false, null, '✅ 재분할 완료');
      } else if (rawCaptions) {
        updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, cached.translations));
      }
    }

    showNotification('패널이 준비되었습니다.', 'info');
    updateToggleBtnState();
  }

  /**
   * 패널 토글 버튼의 외형을 실제 패널 상태(열림/닫힘)에 맞춰 동기화
   */
  function updateToggleBtnState() {
    const button = document.getElementById(PANEL_TOGGLE_BUTTON_ID);
    if (!button) return;

    const isOpen = !!document.getElementById(SHADOW_HOST_ID);
    button.classList.remove('is-open', 'is-closed');
    button.classList.add(isOpen ? 'is-open' : 'is-closed');
    button.textContent = isOpen ? '✕ 닫기' : '📑';

    updateImportButtonState();
  }

  /**
   * 캐시 존재 여부에 따라 가져오기 버튼 활성화/비활성화
   */
  async function updateImportButtonState() {
    const videoId = getVideoId();
    if (!videoId) return;

    const { targetLang } = await chrome.storage.local.get(['targetLang']);
    const currentLang = targetLang || '한국어';
    const cached = await getFromCache(videoId, currentLang);

    const shadowHost = document.getElementById(SHADOW_HOST_ID);
    const importBtn = shadowHost?.shadowRoot?.getElementById(IMPORT_BUTTON_ID);

    if (importBtn) {
      if (cached) {
        importBtn.disabled = true;
        importBtn.title = '이미 번역된 데이터(캐시)가 있어 가져오기를 제한합니다.';
      } else {
        importBtn.disabled = false;
        importBtn.title = 'JSON 자막 파일 가져오기';
      }
    }
  }

  return {
    handleToggleClick,
    updateToggleBtnState,
    updateImportButtonState,
  };
}
