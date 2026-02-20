// content/captions.js - 자막 추출 및 가공 모듈
import { estimateTokens } from '../../core/utils.js';
import {
  SCRIPT_PANEL_SELECTOR,
  MAX_TOKENS_PER_CHUNK,
  SOFT_LIMIT
} from '../../core/constants.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('Captions');

export async function extractCaptions() {
  try {
    const transcriptPanel = document.querySelector(SCRIPT_PANEL_SELECTOR);
    if (!transcriptPanel) return null;

    let segmentElements = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
    if (!segmentElements || segmentElements.length === 0) {
      await new Promise(r => setTimeout(r, 1000));
      segmentElements = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
    }

    const rawSegments = Array.from(segmentElements).map(el => {
      const timestamp = el.querySelector('.segment-timestamp')?.textContent?.trim() || '0:00';
      const text = el.querySelector('.segment-text')?.textContent?.trim() || '';
      return { start: timestamp, text };
    }).filter(s => s.text);

    return {
      raw: rawSegments,
      grouped: groupSegmentsBySentence(rawSegments)
    };
  } catch (error) {
    log.error('Extraction failed:', error);
    return null;
  }
}

function groupSegmentsBySentence(segments) {
  const grouped = [];
  let currentGroup = null;
  const sentenceEndRegex = /[.?!]\s*$/;

  segments.forEach((seg, index) => {
    // 불변성 유지 (원본 보전)
    if (!currentGroup) {
      currentGroup = { ...seg };
    } else {
      currentGroup = { ...currentGroup, text: currentGroup.text + ' ' + seg.text };
    }

    const isSentenceEnd = sentenceEndRegex.test(seg.text);
    const isTooLong = currentGroup.text.length > 150;
    const isLast = index === segments.length - 1;

    if (isSentenceEnd || isTooLong || isLast) {
      grouped.push(currentGroup);
      currentGroup = null;
    }
  });

  return grouped;
}

export function chunkTranscript(segments) {
  const chunks = [];
  let currentChunk = [];
  let tokenCount = 0;
  const sentenceEndRegex = /[.?!]\s*$/;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentTokens = estimateTokens(segment.text);
    
    currentChunk.push(segment);
    tokenCount += segmentTokens;

    const isLast = i === segments.length - 1;
    const isPunctuationEnd = sentenceEndRegex.test(segment.text);
    
    // 분할 조건:
    // 1. SOFT_LIMIT(2800)을 넘었고 문장이 끝났을 때
    // 2. 혹은 MAX_TOKENS(3800)을 아예 넘겨버렸을 때
    // 3. 혹은 마지막 세그먼트일 때
    const shouldSplit = (tokenCount >= SOFT_LIMIT && isPunctuationEnd) || (tokenCount >= MAX_TOKENS_PER_CHUNK) || isLast;

    if (shouldSplit && currentChunk.length > 0) {
      chunks.push([...currentChunk]);
      currentChunk = [];
      tokenCount = 0;
    }
  }

  return chunks;
}
