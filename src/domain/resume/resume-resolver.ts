import type {
  SourceChunkCheckpoint,
  TranscriptChunk,
  TranscriptSegment,
  TranslationChunk,
} from '../../shared/contracts/index.ts';
import {
  buildTranscriptFingerprint,
  EMPTY_TRANSCRIPT_FINGERPRINT,
  parseTimestamp,
} from '../transcript/primitives.ts';

export interface CachedResumeSnapshot {
  completedChunkCount?: number;
  transcriptFingerprint?: string;
  sourceChunkCheckpoints?: SourceChunkCheckpoint[];
  translations?: TranslationChunk[];
}

export interface ResolveResumeStateOptions {
  cached?: CachedResumeSnapshot | null;
  chunks: TranscriptChunk[];
  transcriptFingerprint: string;
  parseTimestampFn?: (timestamp?: string | null) => number;
  getFingerprint?: (segments: TranscriptSegment[]) => string;
}

export interface ResumeStateResolution {
  startChunkIndex: number;
  initialTranslations: TranslationChunk[];
  reason: string;
  usedCheckpointFallback: boolean;
  usedTimestampFallback: boolean;
  sourceChunkCheckpoints: SourceChunkCheckpoint[];
}

export function clampChunkIndex(value: unknown, totalChunks: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(Math.floor(parsed), totalChunks));
}

export function findResumeStartChunkByTimestamp(
  chunks: TranscriptChunk[] | null | undefined,
  lastSavedStartSec: number,
  parseTimestampFn: (timestamp?: string | null) => number = parseTimestamp,
) {
  if (!Array.isArray(chunks) || chunks.length === 0) return 0;
  if (!Number.isFinite(lastSavedStartSec)) return 0;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    if (!Array.isArray(chunk) || chunk.length === 0) continue;

    let maxStartSec = -Infinity;
    for (const segment of chunk) {
      const startSec = parseTimestampFn(segment?.start);
      if (startSec > maxStartSec) {
        maxStartSec = startSec;
      }
    }

    if (maxStartSec > lastSavedStartSec) {
      return chunkIndex;
    }
  }

  return -1;
}

export function buildSourceChunkCheckpoints(
  chunks: TranscriptChunk[] | null | undefined,
  parseTimestampFn: (timestamp?: string | null) => number = parseTimestamp,
  getFingerprint: (segments: TranscriptSegment[]) => string = buildTranscriptFingerprint,
): SourceChunkCheckpoint[] {
  if (!Array.isArray(chunks)) return [];

  return chunks.map((chunk, chunkIndex) => {
    const safeChunk = Array.isArray(chunk) ? chunk : [];
    let firstStartSec: number | null = null;
    let lastStartSec: number | null = null;

    for (const segment of safeChunk) {
      const startSec = parseTimestampFn(segment?.start);
      if (!Number.isFinite(startSec)) continue;

      if (firstStartSec === null || startSec < firstStartSec) {
        firstStartSec = startSec;
      }

      if (lastStartSec === null || startSec > lastStartSec) {
        lastStartSec = startSec;
      }
    }

    return {
      chunkIndex,
      chunkFingerprint:
        getFingerprint(safeChunk) || EMPTY_TRANSCRIPT_FINGERPRINT,
      firstStartSec,
      lastStartSec,
      segmentCount: safeChunk.length,
    };
  });
}

export function resolveResumeFromSourceCheckpoints(
  cachedCheckpoints: SourceChunkCheckpoint[] | null | undefined,
  currentCheckpoints: SourceChunkCheckpoint[],
  completedChunkCount: unknown,
  currentTotalChunks: number,
) {
  if (!Array.isArray(cachedCheckpoints) || cachedCheckpoints.length === 0) {
    return { startChunkIndex: -1, reason: 'no-cached-checkpoints' };
  }

  const normalizedCompletedCount = clampChunkIndex(
    completedChunkCount ?? 0,
    cachedCheckpoints.length,
  );

  if (normalizedCompletedCount === 0) {
    return { startChunkIndex: 0, reason: 'zero-completed-count' };
  }

  const lastCompletedCheckpoint =
    cachedCheckpoints[normalizedCompletedCount - 1];
  if (!lastCompletedCheckpoint) {
    return { startChunkIndex: -1, reason: 'missing-last-checkpoint' };
  }

  const matchedByFingerprintIndex = currentCheckpoints.findIndex(
    (checkpoint) =>
      checkpoint?.chunkFingerprint &&
      checkpoint.chunkFingerprint === lastCompletedCheckpoint.chunkFingerprint,
  );

  if (matchedByFingerprintIndex >= 0) {
    return {
      startChunkIndex: clampChunkIndex(
        matchedByFingerprintIndex + 1,
        currentTotalChunks,
      ),
      reason: 'fingerprint-match',
    };
  }

  const lastSourceEndSec = Number(lastCompletedCheckpoint.lastStartSec);
  if (Number.isFinite(lastSourceEndSec)) {
    const matchedBySourceTimeIndex = currentCheckpoints.findIndex(
      (checkpoint) =>
        Number.isFinite(Number(checkpoint?.lastStartSec)) &&
        Number(checkpoint.lastStartSec) > lastSourceEndSec,
    );

    if (matchedBySourceTimeIndex >= 0) {
      return {
        startChunkIndex: clampChunkIndex(
          matchedBySourceTimeIndex,
          currentTotalChunks,
        ),
        reason: 'source-time-fallback',
      };
    }
  }

  return { startChunkIndex: -1, reason: 'checkpoint-fallback-failed' };
}

export function resolveResumeState({
  cached,
  chunks,
  transcriptFingerprint,
  parseTimestampFn = parseTimestamp,
  getFingerprint = buildTranscriptFingerprint,
}: ResolveResumeStateOptions): ResumeStateResolution {
  const sourceChunkCheckpoints = buildSourceChunkCheckpoints(
    chunks,
    parseTimestampFn,
    getFingerprint,
  );

  const initialTranslations = Array.isArray(cached?.translations)
    ? cached.translations
    : [];
  let effectiveInitialTranslations = [...initialTranslations];
  let startChunkIndex = 0;
  let reason = 'start-from-beginning';
  let usedCheckpointFallback = false;
  let usedTimestampFallback = false;

  if (
    cached?.transcriptFingerprint &&
    cached.transcriptFingerprint === transcriptFingerprint
  ) {
    startChunkIndex = clampChunkIndex(
      cached.completedChunkCount ?? 0,
      chunks.length,
    );
    reason = 'fingerprint-same';

    return {
      startChunkIndex,
      initialTranslations: effectiveInitialTranslations,
      reason,
      usedCheckpointFallback,
      usedTimestampFallback,
      sourceChunkCheckpoints,
    };
  }

  const resolvedByCheckpoint = resolveResumeFromSourceCheckpoints(
    cached?.sourceChunkCheckpoints,
    sourceChunkCheckpoints,
    cached?.completedChunkCount,
    chunks.length,
  );

  if (resolvedByCheckpoint.startChunkIndex >= 0) {
    startChunkIndex = resolvedByCheckpoint.startChunkIndex;
    reason = resolvedByCheckpoint.reason;
    usedCheckpointFallback = true;

    return {
      startChunkIndex,
      initialTranslations: effectiveInitialTranslations,
      reason,
      usedCheckpointFallback,
      usedTimestampFallback,
      sourceChunkCheckpoints,
    };
  }

  const lastSavedStartRaw = effectiveInitialTranslations.at(-1)?.start;
  const fallbackChunkIndex =
    typeof lastSavedStartRaw === 'string' && lastSavedStartRaw.trim() !== ''
      ? findResumeStartChunkByTimestamp(
          chunks,
          parseTimestampFn(lastSavedStartRaw),
          parseTimestampFn,
        )
      : -1;

  if (fallbackChunkIndex < 0) {
    startChunkIndex = 0;
    effectiveInitialTranslations = [];
    reason = 'timestamp-reset';
  } else {
    startChunkIndex = clampChunkIndex(fallbackChunkIndex, chunks.length);
    reason = 'timestamp-fallback';
  }

  usedTimestampFallback = true;

  return {
    startChunkIndex,
    initialTranslations: effectiveInitialTranslations,
    reason,
    usedCheckpointFallback,
    usedTimestampFallback,
    sourceChunkCheckpoints,
  };
}
