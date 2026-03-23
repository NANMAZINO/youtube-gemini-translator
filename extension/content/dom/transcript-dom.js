import {
  SCRIPT_PANEL_SELECTOR,
  TRANSCRIPT_BUTTON_SECTION_SELECTOR,
} from '../../core/constants.js';

const TRANSCRIPT_PANEL_SELECTOR = 'ytd-engagement-panel-section-list-renderer';
const TRANSCRIPT_SEGMENT_SELECTOR =
  'ytd-transcript-segment-renderer, transcript-segment-view-model';
const TRANSCRIPT_CONTAINER_SELECTORS = [
  '#segments-container',
  'ytd-transcript-segment-list-renderer',
  'ytd-transcript-search-panel-renderer #body',
  'ytd-transcript-renderer #content',
  'ytd-transcript-search-panel-renderer',
  'ytd-transcript-renderer',
  '#body',
  '#content',
];
const TRANSCRIPT_TEXT_SELECTORS = [
  '.segment-text',
  '#segment-text',
  '.yt-core-attributed-string',
  'yt-formatted-string',
];
const TRANSCRIPT_TIMESTAMP_SELECTORS = [
  '.segment-timestamp',
  '#start-time',
  '[class*="timestamp"]',
  '[id*="timestamp"]',
];

export function isElementVisible(element) {
  if (!element?.isConnected) return false;
  if (element.hidden || element.getAttribute('hidden') !== null) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const visibilityState = (element.getAttribute('visibility') || '').toUpperCase();
  if (visibilityState.includes('HIDDEN')) return false;

  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

function isTranscriptPanelCandidate(panel) {
  if (!panel?.isConnected) return false;

  const targetId = (panel.getAttribute('target-id') || '').toLowerCase();
  const panelId = (panel.id || '').toLowerCase();

  return (
    panel.matches(SCRIPT_PANEL_SELECTOR) ||
    targetId.includes('transcript') ||
    panelId.includes('transcript') ||
    !!panel.querySelector(
      'ytd-transcript-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-segment-list-renderer, transcript-segment-view-model, ytd-transcript-segment-renderer',
    )
  );
}

export function getTranscriptPanels(root = document) {
  const preferred = root.querySelector(SCRIPT_PANEL_SELECTOR);
  const allPanels = Array.from(
    root.querySelectorAll(TRANSCRIPT_PANEL_SELECTOR),
  ).filter(isTranscriptPanelCandidate);

  if (!preferred) return allPanels;

  return [preferred, ...allPanels.filter((panel) => panel !== preferred)];
}

export function findTranscriptPanel(root = document) {
  const panels = getTranscriptPanels(root);
  return panels.find(isTranscriptPanelOpen) || panels[0] || null;
}

export function isTranscriptPanelOpen(panel) {
  if (!isTranscriptPanelCandidate(panel) || !isElementVisible(panel)) return false;

  if (panel.offsetHeight > 0) return true;

  return (
    !!findTranscriptContainer(panel) || getTranscriptSegmentElements(panel).length > 0
  );
}

export function findTranscriptContainer(panel = findTranscriptPanel()) {
  if (!panel) return null;

  const segmentContainer = panel.querySelector('#segments-container');
  if (segmentContainer) {
    return (
      segmentContainer.closest(
        'ytd-transcript-segment-list-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-renderer, #body, #content',
      ) || segmentContainer
    );
  }

  const modernSegment = panel.querySelector('transcript-segment-view-model');
  if (modernSegment) {
    return (
      modernSegment.closest(
        'ytd-transcript-segment-list-renderer, ytd-transcript-search-panel-renderer, ytd-transcript-renderer, #body, #content',
      ) ||
      modernSegment.parentElement ||
      null
    );
  }

  for (const selector of TRANSCRIPT_CONTAINER_SELECTORS) {
    const candidate = panel.querySelector(selector);
    if (candidate) return candidate;
  }

  return null;
}

export function getTranscriptSegmentElements(panel = findTranscriptPanel()) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(TRANSCRIPT_SEGMENT_SELECTOR));
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function looksLikeTimestamp(text) {
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(normalizeWhitespace(text));
}

function uniqueTexts(texts) {
  return [...new Set(texts.map(normalizeWhitespace).filter(Boolean))];
}

function collectTextCandidates(root, selectors) {
  const candidates = [];

  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach((element) => {
      const text = normalizeWhitespace(
        element.innerText || element.textContent || '',
      );
      if (text) candidates.push(text);
    });
  }

  return uniqueTexts(candidates);
}

export function getTranscriptSegmentTimestamp(segment) {
  const directMatches = collectTextCandidates(segment, TRANSCRIPT_TIMESTAMP_SELECTORS);
  const directTimestamp = directMatches.find(looksLikeTimestamp);
  if (directTimestamp) return directTimestamp;

  const fallbackTexts = collectTextCandidates(segment, [
    'span',
    'div',
    'yt-formatted-string',
    '.yt-core-attributed-string',
  ]);

  return fallbackTexts.find(looksLikeTimestamp) || '0:00';
}

export function getTranscriptSegmentText(segment) {
  const directMatches = collectTextCandidates(segment, TRANSCRIPT_TEXT_SELECTORS).filter(
    (text) => !looksLikeTimestamp(text),
  );

  if (directMatches.length > 0) {
    return directMatches.sort((left, right) => right.length - left.length)[0];
  }

  const fallbackTexts = collectTextCandidates(segment, [
    'span',
    'div',
    'yt-formatted-string',
    '.yt-core-attributed-string',
  ]).filter((text) => !looksLikeTimestamp(text));

  return fallbackTexts.sort((left, right) => right.length - left.length)[0] || '';
}

function looksLikeTranscriptButton(button) {
  const label = normalizeWhitespace(
    button.innerText ||
      button.textContent ||
      button.getAttribute('aria-label') ||
      button.getAttribute('title') ||
      '',
  ).toLowerCase();

  if (!label) return false;

  return /transcript|스크립트|대본|내용\s*대본|transcription/.test(label);
}

export function findTranscriptButton(root = document) {
  const scopedButtons = Array.from(
    root.querySelectorAll(`${TRANSCRIPT_BUTTON_SECTION_SELECTOR} button`),
  );
  const visibleScopedButton = scopedButtons.find(isElementVisible);
  if (visibleScopedButton) return visibleScopedButton;

  const candidates = Array.from(
    root.querySelectorAll('button, yt-button-shape button, tp-yt-paper-button'),
  );

  return candidates.find(
    (button) =>
      isElementVisible(button) &&
      looksLikeTranscriptButton(button) &&
      !!button.closest(
        'ytd-watch-metadata, ytd-video-description-transcript-section-renderer, ytd-structured-description-content-renderer',
      ),
  );
}
