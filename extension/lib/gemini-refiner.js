// lib/gemini-refiner.js - 번역본 정밀 재분할(Alignment) 모듈
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const REFINER_SYSTEM_PROMPT = `
# Role
Expert Subtitle Aligner & Flow Optimizer.

# Objective
Re-segment the "Draft Translation" to perfectly align with the "Original Segments"' timing. Ensure the result follows the visual rhythm and scanability rules of professional subtitling.

# Guidelines
1. Timing-Semantic Mapping: Map the draft phrases to the exact timestamps of the original text. If a keyword appears in an original segment, its translation must reside in the corresponding refined segment.
2. Particle-Based Splitting: When breaking the draft into segments, always split at natural pause points (e.g., Korean particles 은/는/이/가 or verb endings) to maintain "Meaning Units."
3. Structural Mirroring: Mirror the split-logic of the original segments. If the original text is fragmented for dramatic effect or pacing, the refined translation must follow that same rhythm.
4. Content Integrity: Do not alter the core meaning of the "Draft Translation." Your task is "Re-segmentation" and "Flow Optimization," not re-translation.
`;

/**
 * 리파이너(재분할) API 호출
 */
export async function callRefineAPI(apiKey, original, draftText, thinkingLevel) {

  const userPrompt = `[Original Segments]:\n${JSON.stringify(original)}\n\n[Draft Translation]:\n"${draftText}"\n\nTask: Redistribute the "Draft Translation" across the "Original Segments" timeline. Ensure the text for each timestamp accurately reflects the meaning of the original text at that time.`;

  const requestBody = {
    contents: [{
      role: 'user',
      parts: [{ text: userPrompt }]
    }],
    systemInstruction: {
      parts: [{ text: REFINER_SYSTEM_PROMPT }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            text: { type: 'string' },
          },
          required: ['start', 'text'],
          propertyOrdering: ['start', 'text'],
        },
      },
      thinkingConfig: {
        thinkingLevel: thinkingLevel,
      }
    },
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const status = response.status;
    // gemini.js와 동일한 에러 분류
    if (status === 429 || status === 503 || (error.error?.message && error.error.message.includes('overloaded'))) throw new Error('MODEL_OVERLOADED');
    if (status === 403) throw new Error('QUOTA_EXCEEDED');
    throw new Error(error.error?.message || `Refiner API failure: ${status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const usage = data.usageMetadata || {
    promptTokenCount: 0,
    candidatesTokenCount: 0,
  };

  return { parsed: JSON.parse(content), usage };
}

