import type { TranscriptChunk, TranscriptSegment } from '../../shared/contracts/index.ts';
import { estimateTokens } from './primitives.ts';

const DEFAULT_SENTENCE_END_PATTERN = /[.?!]\s*$/;

export const DEFAULT_SOFT_TOKEN_LIMIT = 2800;
export const DEFAULT_MAX_TOKENS_PER_CHUNK = 3800;

export interface ChunkTranscriptOptions {
  softTokenLimit?: number;
  maxTokensPerChunk?: number;
  sentenceEndPattern?: RegExp;
  estimateTokensFn?: (text: string) => number;
}

export function chunkTranscript(
  segments: TranscriptSegment[] | null | undefined,
  options: ChunkTranscriptOptions = {},
): TranscriptChunk[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const softTokenLimit = options.softTokenLimit ?? DEFAULT_SOFT_TOKEN_LIMIT;
  const maxTokensPerChunk =
    options.maxTokensPerChunk ?? DEFAULT_MAX_TOKENS_PER_CHUNK;
  const sentenceEndPattern =
    options.sentenceEndPattern ?? DEFAULT_SENTENCE_END_PATTERN;
  const countTokens = options.estimateTokensFn ?? estimateTokens;

  const chunks: TranscriptChunk[] = [];
  let currentChunk: TranscriptChunk = [];
  let tokenCount = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentTokens = Math.max(0, Number(countTokens(segment.text)) || 0);

    currentChunk.push(segment);
    tokenCount += segmentTokens;

    const isLast = index === segments.length - 1;
    const isSentenceEnd = sentenceEndPattern.test(segment.text);
    const shouldSplit =
      (tokenCount >= softTokenLimit && isSentenceEnd) ||
      tokenCount >= maxTokensPerChunk ||
      isLast;

    if (shouldSplit) {
      chunks.push([...currentChunk]);
      currentChunk = [];
      tokenCount = 0;
    }
  }

  return chunks;
}
