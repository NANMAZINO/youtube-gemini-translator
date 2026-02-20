// content/button-injector.js
// 유튜브 패널/헤더에 액션 버튼들을 주입하는 모듈

export function createButtonInjector({
  showNotification,
  openTranscriptPanel,
  SCRIPT_PANEL_SELECTOR,
  FLOATING_BUTTON_ID,
  TRANSLATE_BUTTON_ID,
  RE_SPLIT_BUTTON_ID,
  PANEL_TOGGLE_BUTTON_ID,
  handleTranslateClick,
  handleToggleClick,
  log,
}) {
  const BUTTON_CONTAINER_ID = 'yt-ai-btns-container';

  /**
   * 영상 하단(제목 근처)에 독립적인 번역 진입점 주입
   */
  function injectFloatingButton() {
    const existingBtn = document.getElementById(FLOATING_BUTTON_ID);
    if (existingBtn && existingBtn.isConnected) return;

    const targetContainer =
      document.querySelector('ytd-menu-renderer.ytd-watch-metadata #top-level-buttons-computed') ||
      document.querySelector('#top-level-buttons-computed') ||
      document.querySelector('#top-row.ytd-watch-metadata #owner');

    if (!targetContainer || targetContainer.offsetHeight === 0) return;

    const btn = document.createElement('button');
    btn.id = FLOATING_BUTTON_ID;
    btn.innerHTML = '📜 스크립트 열기';
    btn.className = 'yt-ai-floating-btn';

    btn.onclick = async () => {
      const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
      const isPanelVisible = panel && !panel.hidden && panel.offsetHeight > 0;

      if (isPanelVisible) {
        showNotification('이미 스크립트 창이 열려 있습니다.', 'info');
        return;
      }

      try {
        btn.disabled = true;
        btn.classList.add('is-busy');
        await openTranscriptPanel();
        showNotification('스크립트 창을 열었습니다.', 'info');
      } catch (err) {
        log.error('Transcript open failed:', err);
        showNotification('스크립트 열기 실패', 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-busy');
      }
    };

    targetContainer.appendChild(btn);
  }

  function injectTranslateButton(panel) {
    const existingContainer = document.getElementById(BUTTON_CONTAINER_ID);
    if (existingContainer && existingContainer.isConnected && existingContainer.offsetHeight > 0) {
      return true;
    }

    if (existingContainer && !existingContainer.isConnected) {
      existingContainer.remove();
    }

    const container = document.createElement('div');
    container.id = BUTTON_CONTAINER_ID;
    container.className = 'yt-ai-btns-container';

    const mainBtn = document.createElement('button');
    mainBtn.id = TRANSLATE_BUTTON_ID;
    mainBtn.textContent = '🤖 AI 번역';
    mainBtn.className = 'yt-ai-btn yt-ai-btn-main';
    mainBtn.onclick = (e) => {
      e.stopPropagation();
      handleTranslateClick(mainBtn);
    };

    const refineBtn = document.createElement('button');
    refineBtn.id = RE_SPLIT_BUTTON_ID;
    refineBtn.textContent = '재분할';
    refineBtn.disabled = true;
    refineBtn.className = 'yt-ai-btn yt-ai-btn-refine';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = PANEL_TOGGLE_BUTTON_ID;
    toggleBtn.textContent = '📑';
    toggleBtn.title = '스크립트 패널 열기/닫기';
    toggleBtn.className = 'yt-ai-btn yt-ai-btn-toggle is-closed';
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      handleToggleClick(toggleBtn);
    };

    container.append(mainBtn, refineBtn, toggleBtn);

    const activeEngagementHeader = document.querySelector(
      'ytd-engagement-panel-section-list-renderer:not([hidden]) ytd-engagement-panel-title-header-renderer #title-container',
    );
    if (activeEngagementHeader && activeEngagementHeader.isConnected && activeEngagementHeader.offsetHeight > 0) {
      container.classList.add('yt-ai-btns-container--header');
      activeEngagementHeader.parentElement.appendChild(container);
      return true;
    }

    const standardHeader = panel.querySelector('#header');
    if (standardHeader && standardHeader.offsetHeight > 0) {
      standardHeader.appendChild(container);
      return true;
    }

    const body = panel.querySelector('#body');
    if (body && body.offsetHeight > 0) {
      body.prepend(container);
      return true;
    }

    return false;
  }

  return {
    injectFloatingButton,
    injectTranslateButton,
  };
}
