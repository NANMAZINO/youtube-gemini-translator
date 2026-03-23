import type { ExportBundle } from '../../shared/contracts/export.ts';
import type { Settings, ThinkingLevel } from '../../shared/contracts/settings.ts';
import type {
  TranscriptChunk,
  TranscriptSegment,
  TranslationChunk,
} from '../../shared/contracts/transcript.ts';
import { throwClassifiedGeminiApiError } from './error-policy.ts';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const TRANSLATE_SYSTEM_PROMPT = `
# Role
Master Subtitle Translator & Localizer.

# Objective
Translate [Source Segments] into a flawless, natural target language. Your primary goal is to produce a standalone, perfect translation that prioritizes immediate scanability (visual clarity) and narrative flow over strict, 1:1 segment matching.

# Guidelines
1. Contextual Mastery: Identify the overarching domain to ensure perfect tone and accurate terminology.
2. Fluid Narrative (Merge Freely): If forced 1:1 segment matching breaks linguistic flow, you MUST group multiple segments and merge them into seamless, natural sentences.
3. Natural Chunking: When translating, construct output in concise "Meaning Units" (e.g., stopping at natural particles or verb endings). Do NOT over-merge into massive paragraphs; keep chunks short enough for effortless reading on a screen.
4. Structural Anchoring: When you merge or adjust segments for flow, ALWAYS use the earliest "id" and "start" timestamp of the grouped segments as your anchor. You MUST NOT invent new timing.
5. Contextual Priority & Neutrality: If ambiguous, prioritize semantic safety over creative interpretation.
6. Strict Start-Time Uniqueness: THE FINAL OUTPUT MUST NOT HAVE ANY DUPLICATE "start" TIMES. Ensure duplicate start times are merged.
`;

const REFINE_SYSTEM_PROMPT = `
# Role
Strict Subtitle Resegmenter & Readability Optimizer.

# Objective
The provided "Draft Translation" contains high-quality, continuous translated text. Your primary objective is to sub-divide this text and align it onto the "Original Segments" timeline. You MUST prioritize grammatical correctness, logical flow, and readability over rigid 1:1 timestamp mapping. Ensure the meaning of the subdivided translated chunk aligns broadly with the source text, but do not force unnatural splits.

# Guidelines
1. Prioritize Linguistic Completeness: Your primary goal is to maintain the grammatical correctness and readability of the target language. Do not slice the text artificially just to fit every original timestamp. Divide the text ONLY where natural pauses, punctuation, or independent logical clauses occur.
2. Cohesive Segmenting over Rigid 1:1 Mapping: Prioritize natural readability over a forced 1:1 split. If a translated phrase or logical unit naturally spans multiple original segments without a clear linguistic break point, keep it as a single cohesive segment. In these cases, assign ONLY the 'start' time and 'id' of the first original segment in that range, and discard all intermediate timestamps.
3. Anchor Timing: Use the "Original Segments" as your absolute timing bounds. You must strictly utilize only the existing timestamps provided in the source data. DO NOT invent new timings.
4. Prevent Micro-Fragmentation: Do not create fragments that are too short or lack standalone meaning just to satisfy a timestamp.
5. Strict Start-Time Uniqueness: You must assign a uniquely distinct "start" time to every output segment.
6. Source Text Alignment: Compare the original source text with the draft translation and align logical meaning blocks to the earliest matching source timestamp.
`;

const DEFAULT_USAGE = Object.freeze({
  promptTokenCount: 0,
  candidatesTokenCount: 0,
  thoughtsTokenCount: 0,
});

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}

interface GeminiApiCandidate {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
}

interface GeminiApiResponse {
  candidates?: GeminiApiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
}

type FetchImpl = typeof fetch;

export interface TranslateChunkOptions {
  targetLang: string;
  sourceLang?: string;
  thinkingLevel: ThinkingLevel;
  previousContext?: string;
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
}

export interface RefineTranslationOptions {
  thinkingLevel: ThinkingLevel;
  signal?: AbortSignal;
  fetchImpl?: FetchImpl;
}

export interface GeminiTranslationResult {
  parsed: TranslationChunk[];
  usage: Required<GeminiUsageMetadata>;
}

function createGeminiParseError(message: string) {
  const error = new Error(message);
  error.name = 'GeminiParseError';
  return error;
}

function getFetchImplementation(fetchImpl?: FetchImpl) {
  const activeFetch = fetchImpl ?? globalThis.fetch;
  if (typeof activeFetch !== 'function') {
    throw new Error('Fetch API is not available in the extension runtime.');
  }

  return activeFetch;
}

function normalizeUsage(
  usageMetadata?: GeminiUsageMetadata,
): Required<GeminiUsageMetadata> {
  return {
    promptTokenCount: Number(usageMetadata?.promptTokenCount) || 0,
    candidatesTokenCount: Number(usageMetadata?.candidatesTokenCount) || 0,
    thoughtsTokenCount: Number(usageMetadata?.thoughtsTokenCount) || 0,
  };
}

function normalizeTranslationChunks(value: unknown): TranslationChunk[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is TranslationChunk =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as TranslationChunk).start === 'string' &&
        typeof (item as TranslationChunk).text === 'string',
    )
    .map((item) => ({
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      start: item.start,
      text: item.text.trim(),
    }))
    .filter((item) => item.text !== '');
}

function cleanMarkdownJsonFence(content: string) {
  return content.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
}

function readResponseText(response: GeminiApiResponse) {
  return response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function postGenerateContent(
  apiKey: string,
  requestBody: Record<string, unknown>,
  signal?: AbortSignal,
  fetchImpl?: FetchImpl,
): Promise<GeminiApiResponse> {
  const activeFetch = getFetchImplementation(fetchImpl);
  const response = await activeFetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    signal,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    await throwClassifiedGeminiApiError(response);
  }

  return (await response.json()) as GeminiApiResponse;
}

function buildChunkWithIds(chunk: TranscriptChunk, chunkIndex: number) {
  return chunk.map((segment, index) => ({
    ...segment,
    id:
      typeof segment.id === 'string' && segment.id.trim() !== ''
        ? segment.id
        : `${chunkIndex}_${index}`,
  }));
}

function buildDraftText(draft: ExportBundle) {
  return draft
    .map((chunk) => chunk.text.trim())
    .filter((text) => text !== '')
    .join(' ');
}

export function repairTruncatedJson(jsonText: string) {
  let candidate = jsonText.trim();
  let lastObjectEnd = candidate.lastIndexOf('}');

  while (lastObjectEnd !== -1) {
    let current = candidate.slice(0, lastObjectEnd + 1);
    if (current.startsWith('[') && !current.endsWith(']')) {
      current += ']';
    }

    try {
      JSON.parse(current);
      return current;
    } catch {
      candidate = candidate.slice(0, lastObjectEnd);
      lastObjectEnd = candidate.lastIndexOf('}');
    }
  }

  return null;
}

function ensureNonEmptyParsedResult(
  parsed: TranslationChunk[],
  responseKind: 'translation' | 'refine',
) {
  if (parsed.length === 0) {
    throw createGeminiParseError(
      `Gemini returned an empty ${responseKind} payload.`,
    );
  }

  return parsed;
}

export function parseGeminiResponse(
  content: string,
  responseKind: 'translation' | 'refine' = 'translation',
) {
  const cleaned = cleanMarkdownJsonFence(content);

  try {
    return ensureNonEmptyParsedResult(
      normalizeTranslationChunks(JSON.parse(cleaned)),
      responseKind,
    );
  } catch (initialError) {
    if (
      initialError instanceof Error &&
      initialError.name === 'GeminiParseError'
    ) {
      throw initialError;
    }

    const repaired = repairTruncatedJson(cleaned);
    if (!repaired) {
      throw createGeminiParseError(
        `Gemini returned invalid JSON for ${responseKind}.`,
      );
    }

    try {
      return ensureNonEmptyParsedResult(
        normalizeTranslationChunks(JSON.parse(repaired)),
        responseKind,
      );
    } catch {
      if (
        initialError instanceof Error &&
        initialError.name === 'GeminiParseError'
      ) {
        throw initialError;
      }

      throw createGeminiParseError(
        `Gemini returned invalid JSON for ${responseKind}.`,
      );
    }
  }
}

export async function translateChunkWithGemini(
  apiKey: string,
  chunk: TranscriptChunk,
  options: TranslateChunkOptions,
  chunkIndex: number,
  totalChunks: number,
): Promise<GeminiTranslationResult> {
  const chunkWithIds = buildChunkWithIds(chunk, chunkIndex);
  const previousContext = options.previousContext?.trim();
  const sourceInstruction =
    options.sourceLang && options.sourceLang !== 'Auto'
      ? ` from "${options.sourceLang}"`
      : '';
  const contextInstruction = previousContext
    ? `\n\n[Previous Context]\n"${previousContext}"\nUse it only to preserve tone and terminology consistency.`
    : '';

  const response = await postGenerateContent(
    apiKey,
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `[Chunk ${chunkIndex}/${totalChunks}]\n${JSON.stringify(chunkWithIds)}${contextInstruction}\n\nTranslate${sourceInstruction} into "${options.targetLang}". Return valid JSON using only original "id" and "start" values from the input.`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: TRANSLATE_SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              start: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['id', 'start', 'text'],
            propertyOrdering: ['id', 'start', 'text'],
          },
        },
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel,
        },
      },
    },
    options.signal,
    options.fetchImpl,
  );

  const content = readResponseText(response);
  if (!content) {
    throw new Error('Gemini returned an empty translation response.');
  }

  return {
    parsed: parseGeminiResponse(content, 'translation'),
    usage: normalizeUsage(response.usageMetadata ?? DEFAULT_USAGE),
  };
}

export async function refineTranslationWithGemini(
  apiKey: string,
  original: TranscriptSegment[],
  draft: ExportBundle,
  options: RefineTranslationOptions,
): Promise<GeminiTranslationResult> {
  const originalWithIds = original.map((segment, index) => ({
    ...segment,
    id:
      typeof segment.id === 'string' && segment.id.trim() !== ''
        ? segment.id
        : String(index),
  }));
  const draftText = buildDraftText(draft);

  const response = await postGenerateContent(
    apiKey,
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `[Original Segments]\n${JSON.stringify(originalWithIds)}\n\n[Draft Translation]\n"${draftText}"\n\nResegment the draft so it fits the original timing anchors. Return valid JSON using only original "id" and "start" values.`,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [{ text: REFINE_SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              start: { type: 'string' },
              text: { type: 'string' },
            },
            required: ['id', 'start', 'text'],
            propertyOrdering: ['id', 'start', 'text'],
          },
        },
        thinkingConfig: {
          thinkingLevel: options.thinkingLevel,
        },
      },
    },
    options.signal,
    options.fetchImpl,
  );

  const content = readResponseText(response);
  if (!content) {
    throw new Error('Gemini returned an empty refine response.');
  }

  return {
    parsed: parseGeminiResponse(content, 'refine'),
    usage: normalizeUsage(response.usageMetadata ?? DEFAULT_USAGE),
  };
}

interface CallGeminiTranslateOptions {
  apiKey: string;
  chunk: TranscriptChunk;
  settings: Settings;
  chunkIndex: number;
  totalChunks: number;
  previousContext?: string;
  signal?: AbortSignal;
}

interface CallGeminiRefineOptions {
  apiKey: string;
  original: TranscriptSegment[];
  draft: ExportBundle;
  settings: Settings;
  signal?: AbortSignal;
}

export function callGeminiTranslate({
  apiKey,
  chunk,
  settings,
  chunkIndex,
  totalChunks,
  previousContext,
  signal,
}: CallGeminiTranslateOptions) {
  return translateChunkWithGemini(
    apiKey,
    chunk,
    {
      targetLang: settings.targetLang,
      sourceLang: settings.sourceLang,
      thinkingLevel: settings.thinkingLevel,
      previousContext,
      signal,
    },
    chunkIndex,
    totalChunks,
  );
}

export function callGeminiRefine({
  apiKey,
  original,
  draft,
  settings,
  signal,
}: CallGeminiRefineOptions) {
  return refineTranslationWithGemini(apiKey, original, draft, {
    thinkingLevel: settings.thinkingLevel,
    signal,
  });
}
