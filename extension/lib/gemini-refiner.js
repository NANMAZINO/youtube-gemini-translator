// lib/gemini-refiner.js - 번역본 정밀 재분할(Alignment) 모듈
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const REFINER_SYSTEM_PROMPT = `
# Role
Expert Subtitle Aligner & Flow Optimizer.

# Objective
Re-segment the "Draft Translation" to align with the "Original Segments" naturally. Focus on creating a professional subtitle timeline with optimal reading pace and natural semantic breaks.

# Guidelines
1. Adaptive Timing: Use the "Original Segments" as a reference for timing, but adjust the "start" time if necessary to fit the length and flow of the translated text. Ensure a smooth transition between segments.
2. Natural Semantic Splitting: Divide the text into "Meaning Units" (e.g., at particles or verb endings). Prioritize natural breaks over strictly following the original split points if it improves readability.
3. Flow Optimization: Do not just map 1:1. Merge or split segments if it creates a better visual rhythm and pacing for the audience.
4. ID Guidance: Maintain a correspondence to the original segment IDs where possible to track the source, but prioritize "Natural Flow" and "Professional Pacing" over strict ID preservation.
5. Content Integrity: Maintain the core meaning of the "Draft Translation" while optimizing its distribution across the timeline.
6. Strict Start-Time Uniqueness: THE FINAL OUTPUT MUST NOT HAVE ANY DUPLICATE "start" TIMES. Whether due to input duplicates or your timing adjustments, if segments share the EXACT same "start" time, you MUST merge them into a single segment to avoid overlap.
`;

/**
 * 리파이너(재분할) API 호출
 */
export async function callRefineAPI(apiKey, original, draftText, thinkingLevel) {

  // 오리지널 데이터에 ID 주입 (만약 없다면)
  const originalWithIds = original.map((item, idx) => ({
    id: item.id !== undefined ? item.id : idx,
    ...item
  }));

  const userPrompt = `[Original Segments (Reference)]:
${JSON.stringify(originalWithIds)}

[Draft Translation]:
"${draftText}"

Task: Create an optimized subtitle timeline by distributing the "Draft Translation" across the segments. Use the original timing and IDs as a guideline, but prioritize natural flow and professional pacing. You may adjust start times and combine/split segments if it leads to a better viewer experience.`;

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
            id: { 
              type: 'integer',
              description: "Corresponding source segment ID. Use as a reference to track the timeline."
            },
            start: { 
              type: 'string',
              description: "Optimized start timestamp. Generally follows the original timing but should be adjusted for professional flow."
            },
            text: { 
              type: 'string',
              description: "Fragment of the translated text for this segment."
            },
          },
          required: ['id', 'start', 'text'],
          propertyOrdering: ['id', 'start', 'text'],
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

