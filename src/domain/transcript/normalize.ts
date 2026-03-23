import type { NormalizedTranscript, TranscriptSegment } from '../../shared/contracts/index.ts';
import { buildTranscriptFingerprint } from './primitives.ts';

const DEFAULT_SENTENCE_END_PATTERN = /[.?!]\s*$/;
const DEFAULT_MAX_GROUP_CHARACTERS = 150;

export interface GroupSegmentsOptions {
  maxCharactersPerGroup?: number;
  sentenceEndPattern?: RegExp;
}

function normalizeSegmentText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeSegment(segment: TranscriptSegment | null | undefined) {
  if (!segment || typeof segment !== 'object') return null;

  const text = normalizeSegmentText(segment.text);
  if (!text) return null;

  const normalized: TranscriptSegment = {
    start: typeof segment.start === 'string' ? segment.start.trim() : '',
    text,
  };

  if (typeof segment.id === 'string' && segment.id.trim() !== '') {
    normalized.id = segment.id.trim();
  }

  return normalized;
}

export function sanitizeTranscriptSegments(
  segments: TranscriptSegment[] | null | undefined,
): TranscriptSegment[] {
  if (!Array.isArray(segments)) return [];

  return segments
    .map((segment) => normalizeSegment(segment))
    .filter((segment): segment is TranscriptSegment => segment !== null);
}

export function groupSegmentsBySentence(
  segments: TranscriptSegment[] | null | undefined,
  options: GroupSegmentsOptions = {},
): TranscriptSegment[] {
  const safeSegments = sanitizeTranscriptSegments(segments);
  if (safeSegments.length === 0) return [];

  const sentenceEndPattern =
    options.sentenceEndPattern ?? DEFAULT_SENTENCE_END_PATTERN;
  const maxCharactersPerGroup =
    options.maxCharactersPerGroup ?? DEFAULT_MAX_GROUP_CHARACTERS;

  const grouped: TranscriptSegment[] = [];
  let currentGroup: TranscriptSegment | null = null;

  safeSegments.forEach((segment, index) => {
    currentGroup = currentGroup
      ? { ...currentGroup, text: `${currentGroup.text} ${segment.text}` }
      : { ...segment };

    const isSentenceEnd = sentenceEndPattern.test(segment.text);
    const isTooLong = currentGroup.text.length > maxCharactersPerGroup;
    const isLast = index === safeSegments.length - 1;

    if (isSentenceEnd || isTooLong || isLast) {
      grouped.push(currentGroup);
      currentGroup = null;
    }
  });

  return grouped;
}

export function normalizeTranscript(
  rawSegments: TranscriptSegment[] | null | undefined,
  options: GroupSegmentsOptions = {},
): NormalizedTranscript {
  const raw = sanitizeTranscriptSegments(rawSegments);
  const grouped = groupSegmentsBySentence(raw, options);

  return {
    raw,
    grouped,
    fingerprint: buildTranscriptFingerprint(grouped),
  };
}
