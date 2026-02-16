// content/utils.js - 유틸리티 함수 모듈

/**
 * 타임스탬프 문자열을 초로 변환
 * @param {string} timestamp - "MM:SS" 또는 "H:MM:SS" 형식
 */
export function parseTimestamp(timestamp) {
  if (!timestamp) return 0;
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// CJK 유니코드 범위 정규식 (한국어, 중국어, 일본어)
const CJK_REGEX = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/g;

/**
 * 토큰 수 추정 (CJK 문자 가중치 적용)
 * - ASCII/Latin: 약 4글자 ≈ 1토큰
 * - CJK (한/중/일): 약 2글자 ≈ 1토큰 (Gemini SentencePiece 기준)
 * @param {string} text - 추정할 텍스트
 * @returns {number} 추정 토큰 수
 */
export function estimateTokens(text) {
  if (!text) return 0;

  // 모듈 레벨 CJK_REGEX 사용
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const asciiCount = text.length - cjkCount;

  // 각각의 비율로 토큰 수 추정 후 합산
  const cjkTokens = cjkCount / 2;    // 2글자 ≈ 1토큰
  const asciiTokens = asciiCount / 4; // 4글자 ≈ 1토큰

  return Math.ceil(cjkTokens + asciiTokens);
}

/**
 * Build deterministic fingerprint for grouped transcript segments.
 * Uses FNV-1a 32-bit over normalized "start<US>text" joined by <RS>.
 * @param {{start: string, text: string}[]} groupedSegments
 * @returns {string}
 */
export function buildTranscriptFingerprint(groupedSegments) {
  if (!Array.isArray(groupedSegments) || groupedSegments.length === 0) {
    return '00000000';
  }

  const serialized = groupedSegments
    .map((segment) => {
      const start = String(segment?.start ?? '');
      const text = String(segment?.text ?? '')
        .trim()
        .replace(/\s+/g, ' ');
      return `${start}\u001f${text}`;
    })
    .join('\u001e');

  let hash = 0x811c9dc5;
  const fnvPrime = 0x01000193;

  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, fnvPrime) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

/**
 * 영상 ID 추출
 */
export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}
