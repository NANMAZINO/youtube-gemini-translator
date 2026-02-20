// content/transcript-opener.js - 유튜브 자막 패널 자동 제어 모듈
import {
  SCRIPT_PANEL_SELECTOR,
  TRANSCRIPT_BUTTON_SECTION_SELECTOR,
  DESCRIPTION_EXPAND_BUTTON_SELECTOR
} from '../../core/constants.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('Opener');

/**
 * 유튜브 자막 패널을 프로그래밍적으로 엽니다.
 * @returns {Promise<Element>} 패널 엘리먼트
 */
export async function openTranscriptPanel() {
  // 1. 이미 열려있는지 확인
  const existingPanel = document.querySelector(SCRIPT_PANEL_SELECTOR);
  if (existingPanel && isElementVisible(existingPanel)) {
    log.info('Transcript panel already open');
    return existingPanel;
  }

  log.info('Attempting to open transcript panel...');

  try {
    // 2. "더보기" 클릭 (섹션이 가려져 있을 수 있음)
    const expandBtn = document.querySelector(DESCRIPTION_EXPAND_BUTTON_SELECTOR);
    if (expandBtn && isElementVisible(expandBtn)) {
      expandBtn.click();
      // 약간의 렌더링 시간 확보
      await new Promise(r => setTimeout(r, 300));
    }

    // 3. "스크립트 표시" 버튼 찾기 및 클릭
    // 태그명 기반으로 접근하는 것이 텍스트 기반보다 훨씬 안정적임
    const section = document.querySelector(TRANSCRIPT_BUTTON_SECTION_SELECTOR);
    if (!section) {
      throw new Error('자막 버튼 섹션을 찾을 수 없습니다. (이 영상은 자막이 없을 수 있습니다)');
    }

    const button = section.querySelector('button');
    if (!button) {
      throw new Error('자막 활성화 버튼을 찾을 수 없습니다.');
    }

    button.click();
    log.info('Transcript button clicked');

    // 4. 패널이 나타날 때까지 대기 (MutationObserver)
    return await waitForPanelToAppear();
  } catch (error) {
    log.error('Failed to open transcript panel:', error);
    throw error;
  }
}

/**
 * MutationObserver를 사용하여 패널 등장을 감시합니다.
 */
function waitForPanelToAppear() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('패널이 열리는 데 시간이 너무 오래 걸립니다. (Timeout)'));
    }, 5000);

    const observer = new MutationObserver(() => {
      const panel = document.querySelector(SCRIPT_PANEL_SELECTOR);
      if (panel && isElementVisible(panel)) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(panel);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

/**
 * 엘리먼트가 실제로 보이는 상태인지 확인
 */
function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
