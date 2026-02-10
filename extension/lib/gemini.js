// lib/gemini.js - Gemini API 통신 전문 모듈
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const SYSTEM_PROMPT = `
# Role
Expert Subtitle Translator & Sync Engineer.

# Objective
Translate [Source Segments] into natural, colloquial target language. Prioritize visual rhythm and timestamp accuracy over grammatical perfection.

# Guidelines
1. Keyword-to-Segment Sync: Match keywords to their specific timestamped segments. Break SVO/SOV grammar if necessary to maintain narrative flow.
2. Semantic Chunking: Split text into "Meaning Units" using natural break points (e.g., Korean particles or verb endings).
3. Max 25 Characters: Each segment must be under 25 characters (including spaces). Redistribute text across adjacent segments if needed.
4. Scanability: Subtitles must be instantly readable. Prioritize visual clarity over complete sentences.
5. Segment Alignment: Maintain the segment count and structure of the input as much as possible. Only merge or omit if a segment carries no translatable semantic weight.
`;

/**
 * Gemini API 호출
 */
export async function callGeminiAPI(apiKey, chunk, options, chunkIdx, totalChunks) {
  const { targetLang, sourceLang, thinkingLevel, previousContext } = options;
  
  // 소스 언어 조건 생성
  const sourceCondition = sourceLang === 'Auto' ? 'the source language' : `the language "${sourceLang}"`;
  
  // 문맥(Previous Context) 주입 로직
  const contextInstruction = previousContext 
    ? `\n\n[Previous Context (Translation Style Guide)]:\n"${previousContext}"\nUse the context above for consistency in tone and terminology. Translate ONLY the current input below.`
    : '';

  const userPrompt = `[Chunk ${chunkIdx}/${totalChunks}]\n${JSON.stringify(chunk)}${contextInstruction}\n\nTranslate each "text" from ${sourceCondition} to "${targetLang}".`;

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
                start: { 
                  type: 'string',
                  description: "Original timestamp string from input. DO NOT MODIFY."
                },
                text: { 
                  type: 'string',
                  description: "Translated target language text (Max 25 chars)"
                }
              },
              required: ['start', 'text'],
              propertyOrdering: ['start', 'text']
            }
          },
          thinkingConfig: {
            thinkingLevel: thinkingLevel,
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const status = response.status;
      // Rate limit / Quota / Overload / 503 에러 구분
      if (status === 429 || status === 503 || (error.error?.message && error.error.message.includes('overloaded'))) throw new Error('MODEL_OVERLOADED');
      if (status === 403) throw new Error('QUOTA_EXCEEDED');
      throw new Error(error.error?.message || `API 요청 실패: ${status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[YT-AI-Translator-BG] Gemini API fetch error:', err);
    throw err;
  }
}
