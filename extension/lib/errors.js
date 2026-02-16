// lib/errors.js - API 에러 분류 공통 모듈
// gemini.js와 gemini-refiner.js에서 중복되던 에러 판별 로직을 통합

/**
 * Gemini API 응답 에러를 분류하여 적절한 Error 객체를 throw
 * @param {Response} response - fetch 응답 객체
 * @throws {Error} 분류된 에러 (MODEL_OVERLOADED | QUOTA_EXCEEDED | 일반 에러)
 */
export async function throwClassifiedApiError(response) {
  const errorBody = await response.json().catch(() => ({}));
  const status = response.status;
  const message = errorBody.error?.message || '';

  // 429(Rate Limit) / 503(Service Unavailable) / overloaded 키워드 → 재시도 가능
  if (status === 429 || status === 503 || message.includes('overloaded')) {
    throw new Error('MODEL_OVERLOADED');
  }

  // 403(Forbidden) → API 할당량 초과
  if (status === 403) {
    throw new Error('QUOTA_EXCEEDED');
  }

  // 그 외 일반 에러
  throw new Error(message || `API 요청 실패: ${status}`);
}

/**
 * 에러가 재시도 가능한 유형인지 판별
 * @param {Error} err - 발생한 에러 객체
 * @returns {boolean} 재시도 가능 여부
 */
export function isRetryableError(err) {
  if (err?.name === 'AbortError') {
    return false;
  }
  return (
    err.message === 'MODEL_OVERLOADED' ||
    err.message.includes('overloaded') ||
    err.message.includes('fetch')
  );
}
