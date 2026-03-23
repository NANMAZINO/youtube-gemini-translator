// content/panel-controller.js
// 사이드 패널 토글/열기와 버튼 상태 관리
import { UI_LABELS } from '../../core/ui-icons.js';

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
   * 패널을 열고 필요 시 캐시를 렌더링합니다.
   */
  async function openPanel() {
    await openTranscriptPanel();
    const shadow = await ensureUIReady();

    if (!shadow) throw new Error('패널 준비 실패');

    const videoId = getVideoId();
    const { targetLang, resumeMode } = await chrome.storage.local.get(['targetLang', 'resumeMode']);
    const currentLang = targetLang || '한국어';
    const isResumeModeEnabled = resumeMode !== false;
    const cached = await getFromCache(videoId, currentLang);

    if (cached && (!cached.isPartial || isResumeModeEnabled)) {
      const mainBtn = document.getElementById(TRANSLATE_BUTTON_ID);
      await renderFromCache(mainBtn, cached.translations, currentLang);

      const result = await extractCaptions();
      const rawCaptions = result?.raw;

      if (cached.isPartial) {
        updateExtRefineButton(false);
      } else if (cached.isRefined) {
        updateExtRefineButton(false, null, UI_LABELS.refineDone);
      } else if (rawCaptions) {
        updateExtRefineButton(true, () => startRefine(videoId, rawCaptions, cached.translations));
      } else {
        updateExtRefineButton(false);
      }
    } else if (cached?.isPartial && !isResumeModeEnabled) {
      updateExtRefineButton(false);
    }

    showNotification('패널이 준비되었습니다.', 'info');
    updateToggleBtnState();
  }

  /**
   * 패널 토글 버튼을 현재 패널 상태(열림/닫힘)에 맞춰 동기화합니다.
   */
  function updateToggleBtnState() {
    const button = document.getElementById(PANEL_TOGGLE_BUTTON_ID);
    if (!button) return;

    const isOpen = !!document.getElementById(SHADOW_HOST_ID);
    button.classList.remove('is-open', 'is-closed');
    button.classList.add(isOpen ? 'is-open' : 'is-closed');
    button.textContent = isOpen ? UI_LABELS.panelOpen : UI_LABELS.panelClosed;

    updateImportButtonState();
  }

  /**
   * 캐시 존재 여부에 따라 가져오기 버튼을 활성/비활성화합니다.
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
