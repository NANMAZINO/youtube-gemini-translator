// infrastructure/api/retry.js
// Common retry utility with abort-aware exponential backoff.

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('Aborted', 'AbortError');
  }
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Retry wrapper with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Object} options
 * @param {number} options.maxRetries
 * @param {(error: Error) => boolean} options.isRetryable
 * @param {number} [options.baseDelayMs=1000]
 * @param {(ctx: { attempt: number, delayMs: number, error: Error }) => (void | Promise<void>)} [options.onRetry]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<T>}
 */
export async function withRetry(
  fn,
  { maxRetries, isRetryable, baseDelayMs = 1000, onRetry, signal } = {},
) {
  let retryCount = 0;

  while (true) {
    throwIfAborted(signal);

    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name === 'AbortError') {
        throw err;
      }

      const canRetry = typeof isRetryable === 'function' ? isRetryable(err) : false;
      if (!canRetry || retryCount >= maxRetries) {
        throw err;
      }

      retryCount += 1;
      const delayMs = baseDelayMs * Math.pow(2, retryCount);

      if (typeof onRetry === 'function') {
        await onRetry({ attempt: retryCount, delayMs, error: err });
      }

      await abortableSleep(delayMs, signal);
    }
  }
}
