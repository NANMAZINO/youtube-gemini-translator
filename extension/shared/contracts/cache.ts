import type {
  ResumeCheckpoint,
  SourceChunkCheckpoint,
  TranslationChunk,
} from './transcript.ts';

export const CACHE_SCHEMA_VERSION = 1;

export interface CacheMetadata {
  cacheKey: string;
  title: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  isRefined: boolean;
  isPartial: boolean;
  schemaVersion: number;
}

export interface CacheRecord extends ResumeCheckpoint {
  cacheKey: string;
  originalVideoId: string;
  title: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  translations: TranslationChunk[];
  isRefined: boolean;
  isPartial: boolean;
  schemaVersion: number;
  sourceChunkCheckpoints: SourceChunkCheckpoint[];
}
