const SCRIPT_PANEL_SELECTOR =
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]';
const TRANSCRIPT_PANEL_SELECTOR = 'ytd-engagement-panel-section-list-renderer';
const TRANSCRIPT_BUTTON_SECTION_SELECTOR =
  'ytd-video-description-transcript-section-renderer';
const TRANSCRIPT_SEGMENT_SELECTOR =
  'ytd-transcript-segment-renderer, transcript-segment-view-model';
const TRANSCRIPT_DESCENDANT_SELECTOR =
  'ytd-transcript-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-segment-list-renderer, transcript-segment-view-model, ytd-transcript-segment-renderer';
const TRANSCRIPT_CONTAINER_SELECTORS = [
  '#segments-container',
  'ytd-transcript-segment-list-renderer',
  'ytd-transcript-search-panel-renderer #body',
  'ytd-transcript-renderer #content',
  'ytd-transcript-search-panel-renderer',
  'ytd-transcript-renderer',
  '#body',
  '#content',
] as const;
const TRANSCRIPT_TEXT_SELECTORS = [
  '.segment-text',
  '#segment-text',
  '.yt-core-attributed-string',
  'yt-formatted-string',
] as const;
const TRANSCRIPT_TIMESTAMP_SELECTORS = [
  '.segment-timestamp',
  '#start-time',
  '[class*="timestamp"]',
  '[id*="timestamp"]',
] as const;
const TRANSCRIPT_PANEL_OBSERVER_ATTRIBUTES = [
  'hidden',
  'style',
  'visibility',
  'aria-hidden',
  'target-id',
] as const;

export interface TranscriptPanelCandidateMetadata {
  matchesScriptPanelSelector: boolean;
  targetId?: string | null;
  panelId?: string | null;
  hasTranscriptDescendant: boolean;
}

export interface TranscriptPanelOpenStateInput {
  isCandidate: boolean;
  isVisible: boolean;
  offsetHeight: number;
  hasTranscriptContainer: boolean;
  segmentCount: number;
}

export interface TranscriptDomCapability {
  transcriptButtonFound: boolean;
  panelFound: boolean;
  panelOpen: boolean;
  containerFound: boolean;
  segmentCount: number;
}

interface WatchTranscriptDomCapabilityOptions {
  root?: ParentNode;
  observeTarget?: Node;
  debounceMs?: number;
  onChange: (capability: TranscriptDomCapability) => void;
}

function normalizeWhitespace(text: string | null | undefined) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryAll(root: ParentNode, selector: string) {
  return Array.from(root.querySelectorAll(selector));
}

function readElementText(element: Element) {
  if ('innerText' in element && typeof element.innerText === 'string') {
    return element.innerText;
  }

  return element.textContent ?? '';
}

function readOffsetHeight(element: Element) {
  if ('offsetHeight' in element && typeof element.offsetHeight === 'number') {
    return element.offsetHeight;
  }

  return 0;
}

export function isTranscriptPanelCandidateMetadata(
  metadata: TranscriptPanelCandidateMetadata,
) {
  const targetId = normalizeWhitespace(metadata.targetId).toLowerCase();
  const panelId = normalizeWhitespace(metadata.panelId).toLowerCase();

  return (
    metadata.matchesScriptPanelSelector ||
    targetId.includes('transcript') ||
    panelId.includes('transcript') ||
    metadata.hasTranscriptDescendant
  );
}

export function resolveTranscriptPanelOpenState(
  input: TranscriptPanelOpenStateInput,
) {
  if (!input.isCandidate || !input.isVisible) {
    return false;
  }

  if (input.offsetHeight > 0) {
    return true;
  }

  return input.hasTranscriptContainer || input.segmentCount > 0;
}

export function looksLikeTimestamp(text: string) {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalizeWhitespace(text));
}

export function looksLikeTranscriptButtonLabel(label: string) {
  const normalizedLabel = normalizeWhitespace(label).toLowerCase();

  if (!normalizedLabel) {
    return false;
  }

  return /transcript|스크립트|대본|내용\s*대본|transcription/.test(
    normalizedLabel,
  );
}

export function summarizeTranscriptDomCapability(
  capability: TranscriptDomCapability,
) {
  const buttonState = capability.transcriptButtonFound
    ? 'button ready'
    : 'button missing';
  const panelState = !capability.panelFound
    ? 'panel missing'
    : capability.panelOpen
      ? 'panel open'
      : 'panel hidden';
  const segmentState =
    capability.segmentCount > 0
      ? `${capability.segmentCount} segments`
      : capability.containerFound
        ? 'segments pending'
        : 'no segments';

  return `${buttonState} | ${panelState} | ${segmentState}`;
}

export function isElementVisible(element: Element | null | undefined) {
  if (!element?.isConnected) {
    return false;
  }

  const isHiddenPropertySet =
    'hidden' in element && typeof element.hidden === 'boolean'
      ? element.hidden
      : false;

  if (isHiddenPropertySet || element.getAttribute('hidden') !== null) {
    return false;
  }

  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  const visibilityState = (
    element.getAttribute('visibility') || ''
  ).toUpperCase();
  if (visibilityState.includes('HIDDEN')) {
    return false;
  }

  if (
    typeof window === 'undefined' ||
    typeof window.getComputedStyle !== 'function'
  ) {
    return true;
  }

  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

function isTranscriptPanelCandidate(panel: Element | null | undefined) {
  if (!panel?.isConnected) {
    return false;
  }

  return isTranscriptPanelCandidateMetadata({
    matchesScriptPanelSelector: panel.matches(SCRIPT_PANEL_SELECTOR),
    targetId: panel.getAttribute('target-id'),
    panelId: panel.id,
    hasTranscriptDescendant: !!panel.querySelector(TRANSCRIPT_DESCENDANT_SELECTOR),
  });
}

export function getTranscriptPanels(root: ParentNode = document) {
  const preferred = root.querySelector(SCRIPT_PANEL_SELECTOR);
  const allPanels = queryAll(root, TRANSCRIPT_PANEL_SELECTOR).filter(
    isTranscriptPanelCandidate,
  );

  if (!preferred) {
    return allPanels;
  }

  return [preferred, ...allPanels.filter((panel) => panel !== preferred)];
}

export function findTranscriptPanel(root: ParentNode = document) {
  const panels = getTranscriptPanels(root);
  return panels.find(isTranscriptPanelOpen) ?? panels[0] ?? null;
}

export function findTranscriptContainer(
  panel: ParentNode | null = findTranscriptPanel(),
) {
  if (!panel) {
    return null;
  }

  const segmentContainer = panel.querySelector('#segments-container');
  if (segmentContainer) {
    return (
      segmentContainer.closest(
        'ytd-transcript-segment-list-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-renderer, #body, #content',
      ) ?? segmentContainer
    );
  }

  const modernSegment = panel.querySelector('transcript-segment-view-model');
  if (modernSegment) {
    return (
      modernSegment.closest(
        'ytd-transcript-segment-list-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-renderer, #body, #content',
      ) ??
      modernSegment.parentElement ??
      null
    );
  }

  for (const selector of TRANSCRIPT_CONTAINER_SELECTORS) {
    const candidate = panel.querySelector(selector);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export function getTranscriptSegmentElements(
  panel: ParentNode | null = findTranscriptPanel(),
) {
  if (!panel) {
    return [];
  }

  return queryAll(panel, TRANSCRIPT_SEGMENT_SELECTOR);
}

function uniqueTexts(texts: string[]) {
  return [...new Set(texts.map((text) => normalizeWhitespace(text)).filter(Boolean))];
}

function collectTextCandidates(root: ParentNode, selectors: readonly string[]) {
  const candidates: string[] = [];

  for (const selector of selectors) {
    for (const element of queryAll(root, selector)) {
      const text = normalizeWhitespace(readElementText(element));
      if (text) {
        candidates.push(text);
      }
    }
  }

  return uniqueTexts(candidates);
}

export function getTranscriptSegmentTimestamp(segment: ParentNode) {
  const directMatches = collectTextCandidates(
    segment,
    TRANSCRIPT_TIMESTAMP_SELECTORS,
  );
  const directTimestamp = directMatches.find(looksLikeTimestamp);
  if (directTimestamp) {
    return directTimestamp;
  }

  const fallbackTexts = collectTextCandidates(segment, [
    'span',
    'div',
    'yt-formatted-string',
    '.yt-core-attributed-string',
  ]);

  return fallbackTexts.find(looksLikeTimestamp) ?? '0:00';
}

export function getTranscriptSegmentText(segment: ParentNode) {
  const directMatches = collectTextCandidates(
    segment,
    TRANSCRIPT_TEXT_SELECTORS,
  ).filter((text) => !looksLikeTimestamp(text));

  if (directMatches.length > 0) {
    return directMatches.sort((left, right) => right.length - left.length)[0];
  }

  const fallbackTexts = collectTextCandidates(segment, [
    'span',
    'div',
    'yt-formatted-string',
    '.yt-core-attributed-string',
  ]).filter((text) => !looksLikeTimestamp(text));

  return fallbackTexts.sort((left, right) => right.length - left.length)[0] ?? '';
}

export function isTranscriptPanelOpen(panel: Element | null | undefined) {
  const segmentCount = panel ? getTranscriptSegmentElements(panel).length : 0;

  return resolveTranscriptPanelOpenState({
    isCandidate: isTranscriptPanelCandidate(panel),
    isVisible: isElementVisible(panel),
    offsetHeight: panel ? readOffsetHeight(panel) : 0,
    hasTranscriptContainer: !!findTranscriptContainer(panel ?? null),
    segmentCount,
  });
}

function looksLikeTranscriptButton(button: Element) {
  const label = normalizeWhitespace(
    readElementText(button) ||
      button.getAttribute('aria-label') ||
      button.getAttribute('title') ||
      '',
  );

  return looksLikeTranscriptButtonLabel(label);
}

export function findTranscriptButton(root: ParentNode = document) {
  const scopedButtons = queryAll(
    root,
    `${TRANSCRIPT_BUTTON_SECTION_SELECTOR} button`,
  );
  const visibleScopedButton = scopedButtons.find(isElementVisible);
  if (visibleScopedButton) {
    return visibleScopedButton;
  }

  const candidates = queryAll(
    root,
    'button, yt-button-shape button, tp-yt-paper-button',
  );

  return (
    candidates.find(
      (button) =>
        isElementVisible(button) &&
        looksLikeTranscriptButton(button) &&
        !!button.closest(
          'ytd-watch-metadata, ytd-video-description-transcript-section-renderer, ytd-structured-description-content-renderer',
        ),
    ) ?? null
  );
}

export function detectTranscriptDomCapability(root: ParentNode = document) {
  const panel = findTranscriptPanel(root);
  const container = findTranscriptContainer(panel);
  const segments = getTranscriptSegmentElements(panel);

  return {
    transcriptButtonFound: !!findTranscriptButton(root),
    panelFound: !!panel,
    panelOpen: isTranscriptPanelOpen(panel),
    containerFound: !!container,
    segmentCount: segments.length,
  };
}

export function watchTranscriptDomCapability(
  options: WatchTranscriptDomCapabilityOptions,
) {
  if (typeof MutationObserver === 'undefined') {
    throw new Error(
      'MutationObserver is required to watch transcript DOM capability.',
    );
  }

  const root = options.root ?? document;
  const observeTarget =
    options.observeTarget ?? document.body ?? document.documentElement;
  const debounceMs = options.debounceMs ?? 120;
  let timeoutId: number | null = null;

  const publish = () => {
    options.onChange(detectTranscriptDomCapability(root));
  };

  const schedulePublish = () => {
    if (timeoutId !== null) {
      return;
    }

    // YouTube mutates aggressively, so coalesce bursts into one capability scan.
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      publish();
    }, debounceMs);
  };

  publish();

  const observer = new MutationObserver(() => {
    schedulePublish();
  });

  observer.observe(observeTarget, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...TRANSCRIPT_PANEL_OBSERVER_ATTRIBUTES],
  });

  return () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    observer.disconnect();
  };
}
