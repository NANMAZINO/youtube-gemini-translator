// lib/retry.js
// 공통 재시도 유틸리티 (지수 백오프)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 공통 재시도 유틸
 * @template T
 * @param {() => Promise<T>} fn - 재시도 대상 비동기 함수
 * @param {Object} options
 * @param {number} options.maxRetries - 최대 재시도 횟수 (최초 시도 제외)
 * @param {(error: Error) => boolean} options.isRetryable - 재시도 가능 여부 판별 함수
 * @param {number} [options.baseDelayMs=1000] - 백오프 기준 지연(ms)
 * @param {(ctx: { attempt: number, delayMs: number, error: Error }) => (void | Promise<void>)} [options.onRetry]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxRetries, isRetryable, baseDelayMs = 1000, onRetry } = {}) {
  let retryCount = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const canRetry = typeof isRetryable === 'function' ? isRetryable(err) : false;

      if (!canRetry || retryCount >= maxRetries) {
        throw err;
      }

      retryCount += 1;
      const delayMs = baseDelayMs * Math.pow(2, retryCount);

      if (typeof onRetry === 'function') {
        await onRetry({ attempt: retryCount, delayMs, error: err });
      }

      await sleep(delayMs);
    }
  }
}

