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

/**
 * 토큰 수 추정 (대략적)
 */
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 3);
}

/**
 * 영상 ID 추출
 */
export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}
