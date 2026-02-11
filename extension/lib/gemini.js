// lib/gemini.js - Gemini API 통신 전문 모듈
import { GEMINI_API_URL } from './constants.js';
import { throwClassifiedApiError } from './errors.js';
import { createLogger } from './logger.js';

const log = createLogger('Gemini');

const SYSTEM_PROMPT = `
# Role
Expert Subtitle Translator & Sync Engineer.

# Objective
Translate [Source Segments] into natural, colloquial target language. Prioritize visual rhythm and timestamp accuracy over grammatical perfection.

# Guidelines
1. Context: Identify the overarching topic or domain (e.g., daily life, gaming, sports, economy) first to align tone and terminology.
2. Keyword-to-Segment Sync: Match keywords to their specific timestamped segments. Break SVO/SOV grammar if necessary to maintain narrative flow.
3. Semantic Chunking: Split text into "Meaning Units" using natural break points (e.g., particles or verb endings).
4. Scanability: Subtitles must be instantly readable. Prioritize visual clarity over complete sentences.
5. Contextual Priority & Neutrality: If the context is ambiguous or evidence is insufficient, prioritize semantic safety (the most broadly applicable term) over creative interpretation.
6. Alignment & ID: Maintain segment count and structure. You MUST include each unique "id".
8. Strict Start-Time Uniqueness: THE FINAL OUTPUT MUST NOT HAVE ANY DUPLICATE "start" TIMES. Merge segments if they share the exact same start time.
9. Nuanced Tone Observation: Shifts in speech levels (e.g., formal vs. casual) may be considered as potential indicators of different speakers. Where the context supports it, you may use these stylistic cues to help inform a consistent tone for each inferred persona.
`;

/**
 * Gemini API 호출
 */
export async function callGeminiAPI(apiKey, chunk, options, chunkIdx, totalChunks) {
  const { targetLang, sourceLang, thinkingLevel, previousContext } = options;
  
  // 소스 데이터에 ID 주입
  const chunkWithIds = chunk.map((item, idx) => ({
    id: chunkIdx * 1000 + idx,
    ...item
  }));

  // 소스 언어 조건 생성
  const sourceCondition = sourceLang === 'Auto' ? 'the source language' : `the language "${sourceLang}"`;
  
  // 문맥(Previous Context) 주입 로직
  const contextInstruction = previousContext 
    ? `\n\n[Previous Context (Translation Style Guide)]:\n"${previousContext}"\nUse the context above for consistency in tone and terminology. Translate ONLY the current input below.`
    : '';

  const userPrompt = `[Chunk ${chunkIdx}/${totalChunks}]\n${JSON.stringify(chunkWithIds)}${contextInstruction}\n\nTranslate each "text" from ${sourceCondition} to "${targetLang}". Ensure each translated segment maps back to its source "id".`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ 
          role: 'user',
          parts: [{ text: userPrompt }] 
        }],
        systemInstruction: { 
          parts: [{ text: SYSTEM_PROMPT }] 
        },
        generationConfig: { 
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'integer',
                  description: "Unique segment ID from the input."
                },
                start: { 
                  type: 'string',
                  description: "Original timestamp string from input. DO NOT MODIFY."
                },
                text: { 
                  type: 'string',
                  description: "Translated target language text (Max 25 chars)"
                }
              },
              required: ['id', 'start', 'text'],
              propertyOrdering: ['id', 'start', 'text']
            }
          },
          thinkingConfig: {
            thinkingLevel: thinkingLevel,
          }
        }
      })
    });

    if (!response.ok) {
      // 공통 에러 분류 모듈에 위임
      await throwClassifiedApiError(response);
    }

    return await response.json();
  } catch (err) {
    log.error('Gemini API fetch error:', err);
    throw err;
  }
}
