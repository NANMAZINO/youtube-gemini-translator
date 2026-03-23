export interface TranscriptSegment {
  id?: string;
  start: string;
  text: string;
}

export interface NormalizedTranscript {
  raw: TranscriptSegment[];
  grouped: TranscriptSegment[];
  fingerprint: string;
}

export interface TranslationChunk {
  id?: string;
  start: string;
  text: string;
}

export type TranscriptChunk = TranscriptSegment[];

export interface SourceChunkCheckpoint {
  chunkIndex: number;
  chunkFingerprint: string;
  firstStartSec: number | null;
  lastStartSec: number | null;
  segmentCount: number;
}

export interface ResumeCheckpoint {
  completedChunkCount: number;
  transcriptFingerprint: string;
  sourceChunkCheckpoints: SourceChunkCheckpoint[];
}
