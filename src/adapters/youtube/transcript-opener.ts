import {
  findTranscriptButton,
  findTranscriptPanel,
  isElementVisible,
  isTranscriptPanelOpen,
} from './transcript-dom.ts';

const DESCRIPTION_EXPAND_BUTTON_SELECTOR = '#expand, #more-button';
const PANEL_OBSERVER_ATTRIBUTES = ['hidden', 'style', 'visibility', 'target-id'] as const;

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export async function waitForTranscriptPanelToOpen(
  timeoutMs = 5000,
  root: ParentNode = document,
) {
  const existingPanel = findTranscriptPanel(root);
  if (isTranscriptPanelOpen(existingPanel)) {
    return existingPanel;
  }

  return await new Promise<Element>((resolve, reject) => {
    const observeTarget = document.body ?? document.documentElement;
    if (!observeTarget) {
      reject(new Error('Cannot observe the YouTube page before the DOM is ready.'));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error('Timed out waiting for the YouTube transcript panel to open.'));
    }, timeoutMs);

    const resolveIfReady = () => {
      const panel = findTranscriptPanel(root);
      if (!isTranscriptPanelOpen(panel)) {
        return false;
      }

      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(panel);
      return true;
    };

    const observer = new MutationObserver(() => {
      resolveIfReady();
    });

    observer.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...PANEL_OBSERVER_ATTRIBUTES],
    });

    resolveIfReady();
  });
}

export async function openTranscriptPanel(root: ParentNode = document) {
  const existingPanel = findTranscriptPanel(root);
  if (isTranscriptPanelOpen(existingPanel)) {
    return existingPanel;
  }

  const expandButton = document.querySelector(
    DESCRIPTION_EXPAND_BUTTON_SELECTOR,
  );
  if (expandButton && isElementVisible(expandButton)) {
    (expandButton as HTMLElement).click();
    await sleep(300);
  }

  const transcriptButton = findTranscriptButton(root);
  if (!transcriptButton) {
    throw new Error('Could not find the YouTube transcript button on this page.');
  }

  (transcriptButton as HTMLElement).click();
  return await waitForTranscriptPanelToOpen(5000, root);
}
