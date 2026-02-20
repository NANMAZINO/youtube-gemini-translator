// content/resume-resolver.js
// 이어받기 시작 청크 계산 전용 순수 로직 모듈

const DEFAULT_FINGERPRINT = '00000000';

export function clampChunkIndex(value, totalChunks) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(Math.floor(parsed), totalChunks));
}

export function findResumeStartChunkByTimestamp(chunks, lastSavedStartSec, parseTimestamp) {
  if (!Array.isArray(chunks) || chunks.length === 0) return 0;
  if (!Number.isFinite(lastSavedStartSec)) return 0;

  const parse =
    typeof parseTimestamp === 'function' ? parseTimestamp : () => Number.NaN;

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    if (!Array.isArray(chunk) || chunk.length === 0) continue;

    let maxStartSec = -Infinity;
    for (const segment of chunk) {
      const startSec = parse(segment?.start);
      if (startSec > maxStartSec) maxStartSec = startSec;
    }

    if (maxStartSec > lastSavedStartSec) {
      return chunkIndex;
    }
  }

  return -1;
}

export function buildSourceChunkCheckpoints(chunks, parseTimestamp, getFingerprint) {
  if (!Array.isArray(chunks)) return [];

  const parse =
    typeof parseTimestamp === 'function' ? parseTimestamp : () => Number.NaN;
  const fingerprintOf =
    typeof getFingerprint === 'function'
      ? getFingerprint
      : () => DEFAULT_FINGERPRINT;

  return chunks.map((chunk, chunkIndex) => {
    const safeChunk = Array.isArray(chunk) ? chunk : [];
    let firstStartSec = null;
    let lastStartSec = null;

    for (const segment of safeChunk) {
      const startSec = parse(segment?.start);
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
      chunkFingerprint: fingerprintOf(safeChunk),
      firstStartSec,
      lastStartSec,
      segmentCount: safeChunk.length,
    };
  });
}

export function resolveResumeFromSourceCheckpoints(
  cachedCheckpoints,
  currentCheckpoints,
  completedChunkCount,
  currentTotalChunks,
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

  const lastCompletedCheckpoint = cachedCheckpoints[normalizedCompletedCount - 1];
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
      (checkpoint) => Number(checkpoint?.lastStartSec) > lastSourceEndSec,
    );
    if (matchedBySourceTimeIndex >= 0) {
      return {
        startChunkIndex: clampChunkIndex(matchedBySourceTimeIndex, currentTotalChunks),
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
  parseTimestamp,
  getFingerprint,
}) {
  const sourceChunkCheckpoints = buildSourceChunkCheckpoints(
    chunks,
    parseTimestamp,
    getFingerprint,
  );

  const initialTranslations = Array.isArray(cached?.translations)
    ? cached.translations
    : [];
  let effectiveInitialTranslations = initialTranslations;
  let startChunkIndex = 0;
  let reason = 'start-from-beginning';
  let usedCheckpointFallback = false;
  let usedTimestampFallback = false;

  if (cached?.transcriptFingerprint && cached.transcriptFingerprint === transcriptFingerprint) {
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

  const cachedCheckpoints = Array.isArray(cached?.sourceChunkCheckpoints)
    ? cached.sourceChunkCheckpoints
    : [];
  const resolvedByCheckpoint = resolveResumeFromSourceCheckpoints(
    cachedCheckpoints,
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

  const lastSavedStartRaw = initialTranslations.at(-1)?.start;
  const fallbackChunkIndex =
    typeof lastSavedStartRaw === 'string' && lastSavedStartRaw.trim() !== ''
      ? findResumeStartChunkByTimestamp(
          chunks,
          parseTimestamp(lastSavedStartRaw),
          parseTimestamp,
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

