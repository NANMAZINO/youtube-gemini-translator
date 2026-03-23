import type { TranscriptSegment } from '../../shared/contracts/index.ts';

const CJK_REGEX = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g;

export const EMPTY_TRANSCRIPT_FINGERPRINT = '00000000';

export function parseTimestamp(timestamp?: string | null): number {
  if (!timestamp) return 0;

  const parts = String(timestamp)
    .split(':')
    .map((part) => Number(part));

  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts.length === 1 ? parts[0] : 0;
}

export function estimateTokens(text?: string | null): number {
  if (!text) return 0;

  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const asciiCount = text.length - cjkCount;

  const cjkTokens = cjkCount / 2;
  const asciiTokens = asciiCount / 4;

  return Math.ceil(cjkTokens + asciiTokens);
}

export function buildTranscriptFingerprint(
  groupedSegments: Array<Pick<TranscriptSegment, 'start' | 'text'>>,
): string {
  if (!Array.isArray(groupedSegments) || groupedSegments.length === 0) {
    return EMPTY_TRANSCRIPT_FINGERPRINT;
  }

  const serialized = groupedSegments
    .map((segment) => {
      const start = String(segment?.start ?? '');
      const text = String(segment?.text ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      return `${start}\u001f${text}`;
    })
    .join('\u001e');

  let hash = 0x811c9dc5;
  const fnvPrime = 0x01000193;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, fnvPrime) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}
