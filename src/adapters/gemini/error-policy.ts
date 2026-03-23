const MODEL_OVERLOADED = 'MODEL_OVERLOADED';
const QUOTA_EXCEEDED = 'QUOTA_EXCEEDED';

interface ErrorPayload {
  error?: {
    message?: string;
  };
}

interface ResponseLike {
  status: number;
  json(): Promise<unknown>;
}

export function classifyGeminiApiError(status: number, apiMessage = '') {
  const normalizedMessage = apiMessage.toLowerCase();

  if (
    status === 429 ||
    status === 503 ||
    normalizedMessage.includes('overloaded')
  ) {
    return MODEL_OVERLOADED;
  }

  if (status === 403) {
    return QUOTA_EXCEEDED;
  }

  return apiMessage || `API request failed: ${status}`;
}

export async function throwClassifiedGeminiApiError(
  response: ResponseLike,
): Promise<never> {
  const errorBody = (await response.json().catch(() => ({}))) as ErrorPayload;
  const message = errorBody.error?.message || '';

  throw new Error(classifyGeminiApiError(response.status, message));
}

export function isRetryableGeminiError(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  const message =
    error instanceof Error ? error.message : String(error ?? '');
  const normalizedMessage = message.toLowerCase();

  return (
    message === MODEL_OVERLOADED ||
    normalizedMessage.includes('overloaded') ||
    normalizedMessage.includes('fetch')
  );
}
