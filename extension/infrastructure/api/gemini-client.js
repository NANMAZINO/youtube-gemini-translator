// infrastructure/api/gemini-client.js - Gemini API 통신 통합 모듈
import { GEMINI_API_URL } from '../../core/constants.js';
import { throwClassifiedApiError } from '../../core/errors.js';
import { createLogger } from '../../core/logger.js';

const log = createLogger('GeminiClient');

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

const REFINER_SYSTEM_PROMPT = `
# Role
Strict Subtitle Resegmenter & Readability Optimizer.

# Objective
The provided "Draft Translation" contains high-quality, continuous translated text. Your primary objective is to sub-divide this text and align it onto the "Original Segments" timeline. You MUST prioritize grammatical correctness, logical flow, and readability over rigid 1:1 timestamp mapping. Ensure the meaning of the subdivided translated chunk aligns broadly with the source text, but do not force unnatural splits.

# Guidelines
1. Prioritize Linguistic Completeness: Your primary goal is to maintain the grammatical correctness and readability of the target language. Do not slice the text artificially just to fit every original timestamp. Divide the text ONLY where natural pauses, punctuation, or independent logical clauses occur.
2. Cohesive Segmenting over Rigid 1:1 Mapping: Prioritize natural readability over a forced 1:1 split. If a translated phrase or logical unit naturally spans multiple original segments without a clear linguistic break point, keep it as a single cohesive segment. In these cases, assign ONLY the 'start' time and 'id' of the first original segment in that range, and discard all intermediate timestamps.
3. Anchor Timing: Use the "Original Segments" as your absolute timing bounds. You must strictly utilize only the existing timestamps provided in the source data. DO NOT invent new timings.
4. Prevent Micro-Fragmentation: Do not create fragments that are too short or lack standalone meaning (e.g., isolated nouns, single particles, or dangling modifiers) just to satisfy a timestamp. A unified, naturally flowing segment is ALWAYS preferred over heavily fragmented, unreadable micro-segments.
5. **[CRITICAL]** Strict Start-Time Uniqueness: You must assign a uniquely distinct "start" time to every output segment. In cases where original timestamps overlap perfectly, you must combine the corresponding text into one single block.
6. Source Text Alignment: Compare the original source text with the draft translation. Align the chunks based on semantic meaning, but remember that translation naturally alters word order. Group the text into logical blocks and align them seamlessly with the starting timestamp of that specific block.
`;

async function postGenerateContent(
  apiKey,
  requestBody,
  signal,
  { abortLogMessage, errorLogPrefix },
) {
  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      await throwClassifiedApiError(response);
    }

    return await response.json();
  } catch (err) {
    if (err?.name === 'AbortError') {
      log.info(abortLogMessage);
      throw err;
    }

    const message = err?.message || String(err);
    log.error(errorLogPrefix, message);
    throw err;
  }
}

/**
 * Gemini 번역 API 호출
 */
export async function callGeminiAPI(
  apiKey,
  chunk,
  options,
  chunkIdx,
  totalChunks,
  signal,
) {
  const { targetLang, thinkingLevel, previousContext } = options;

  // 소스 데이터에 안전한 고유 ID 문자열 주입 (식별자 충돌 방지)
  const chunkWithIds = chunk.map((item, idx) => ({
    ...item,
    id: item.id !== undefined ? String(item.id) : `${chunkIdx}_${idx}`,
  }));

  // 문맥(Previous Context) 주입 로직
  const contextInstruction = previousContext
    ? `\n\n[Previous Context (Translation Style Guide)]:\n"${previousContext}"\nUse the context above for consistency in tone and terminology. Translate ONLY the current input below.`
    : '';

  const userPrompt = `[Chunk ${chunkIdx}/${totalChunks}]
${JSON.stringify(chunkWithIds)}${contextInstruction}

Translate into "${targetLang}". Return valid JSON matching the schema, using ONLY original "id" and "start" values from the input.`;

  return postGenerateContent(
    apiKey,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
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
              id: {
                type: 'string',
                description:
                  'Anchor segment ID from the source input. Represents the earliest ID if merged.',
              },
              start: {
                type: 'string',
                description:
                  'Original bounding timestamp from the input. DO NOT invent new time values.',
              },
              text: {
                type: 'string',
                description: 'The natural, readable translated text chunk.',
              },
            },
            required: ['id', 'start', 'text'],
            propertyOrdering: ['id', 'start', 'text'],
          },
        },
        thinkingConfig: {
          thinkingLevel,
        },
      },
    },
    signal,
    {
      abortLogMessage: 'Gemini API request aborted',
      errorLogPrefix: 'Gemini API fetch error:',
    },
  );
}

/**
 * 리파이너(재분할) API 호출
 */
export async function callRefineAPI(
  apiKey,
  original,
  draftText,
  thinkingLevel,
  signal,
) {
  // 오리지널 데이터에 ID 주입 (스트링 변환)
  const originalWithIds = original.map((item, idx) => ({
    ...item,
    id: item.id !== undefined ? String(item.id) : String(idx),
  }));

  const userPrompt = `[Original Segments]:
${JSON.stringify(originalWithIds)}

[Draft Translation]:
"${draftText}"

Slice the "Draft Translation" to fit the "Original Segments". Return valid JSON matching the schema, strictly reusing original "id" and "start" values. DO NOT invent new timings.`;

  const data = await postGenerateContent(
    apiKey,
    {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: REFINER_SYSTEM_PROMPT }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description:
                  'Exact ID from the Original Segments used as the anchor for this text chunk.',
              },
              start: {
                type: 'string',
                description:
                  'Exact start timestamp from the Original Segments used as the anchor for this text chunk. DO NOT invent new times.',
              },
              text: {
                type: 'string',
                description: 'Fragment of the translated text for this segment.',
              },
            },
            required: ['id', 'start', 'text'],
            propertyOrdering: ['id', 'start', 'text'],
          },
        },
        thinkingConfig: {
          thinkingLevel,
        },
      },
    },
    signal,
    {
      abortLogMessage: 'Refiner API request aborted',
      errorLogPrefix: 'Refiner API fetch error:',
    },
  );

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  const usage = data.usageMetadata || {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
  };

  let parsed = [];
  try {
    // LLM 마크다운 백틱 오작동 방지용 정규식
    const cleanContent = content
      .replace(/```(?:json)?\n?/g, '')
      .replace(/```/g, '')
      .trim();
    parsed = JSON.parse(cleanContent);
  } catch (parseError) {
    log.error('Refiner JSON Parse Error:', parseError.message);
    throw new Error(`Refiner JSON Parse Error: ${parseError.message}`);
  }

  return { parsed, usage };
}
