// lib/gemini.js - Gemini API 통신 전문 모듈
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const SYSTEM_PROMPT = `You are a specialized JSON array processor for strict 1-to-1 linguistic mapping.
Your primary objective is to ensure structural identity between the input and output arrays.
- Follow the 1:1 mapping of the input array. Do NOT merge multiple segments into one.
- Do NOT modify the 'start' field; copy it exactly as-is.
- Use natural, colloquial language (context-appropriate).
- Keep specialized terms (technical words) if they are commonly used in the target language's community.`;

/**
 * Gemini API 호출
 */
export async function callGeminiAPI(apiKey, chunk, options, chunkIdx, totalChunks) {
  const { targetLang, sourceLang, thinkingLevel, previousContext } = options;
  console.log(`[YT-AI-Translator-BG] Gemini API 요청 (${chunkIdx}/${totalChunks})`, new Date().toLocaleTimeString(), { thinkingLevel, sourceLang, targetLang });
  
  // 소스 언어 조건 생성
  const sourceCondition = sourceLang === 'Auto' ? 'the source language' : `the language "${sourceLang}"`;
  
  // 문맥(Previous Context) 주입 로직
  const contextInstruction = previousContext 
    ? `\n\n[Previous Context (Translation Style Guide)]:\n"${previousContext}"\nUse the context above for consistency in tone and terminology. Translate ONLY the current input below.`
    : '';

  const userPrompt = `${JSON.stringify(chunk)}${contextInstruction}\n\nBased on the data above, translate each "text" field from ${sourceCondition} to "${targetLang}".`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          responseSchema: {
            type: 'array',
            description: "A JSON array strictly maintaining 1-to-1 parity with the input. The output length MUST match the input length exactly.",
            items: {
              type: 'object',
              properties: {
                start: { 
                  type: 'string',
                  description: "Original timestamp string from input (e.g., '0:01'). DO NOT MODIFY OR REFORMAT."
                },
                text: { 
                  type: 'string',
                  description: "Mandatory: Translate only this specific segment. DO NOT merge with adjacent segments or skip elements. Ensure 1-to-1 continuity."
                }
              },
              required: ['start', 'text']
            }
          },
          temperature: 1.0,
          thinkingConfig: {
            thinkingLevel: thinkingLevel
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
