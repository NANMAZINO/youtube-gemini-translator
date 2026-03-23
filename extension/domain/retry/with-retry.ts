export interface RetryContext {
  attempt: number;
  delayMs: number;
  error: Error;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  isRetryable?: (error: Error) => boolean;
  onRetry?: (context: RetryContext) => void | Promise<void>;
  signal?: AbortSignal;
}

export function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('Aborted', 'AbortError');
  }

  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function abortableSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
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

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, Math.floor(options.maxRetries ?? 0));
  const baseDelayMs = options.baseDelayMs ?? 1000;
  let retryCount = 0;

  while (true) {
    throwIfAborted(options.signal);

    try {
      return await fn();
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      if (normalizedError.name === 'AbortError') {
        throw normalizedError;
      }

      const canRetry = options.isRetryable?.(normalizedError) ?? false;
      if (!canRetry || retryCount >= maxRetries) {
        throw normalizedError;
      }

      retryCount += 1;
      const delayMs = baseDelayMs * Math.pow(2, retryCount);

      if (options.onRetry) {
        await options.onRetry({
          attempt: retryCount,
          delayMs,
          error: normalizedError,
        });
      }

      await abortableSleep(delayMs, options.signal);
    }
  }
}
