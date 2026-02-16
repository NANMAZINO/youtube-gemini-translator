// YouTube AI Translator - Background Service Worker
import { callGeminiAPI } from './lib/gemini.js';
import { callRefineAPI } from './lib/gemini-refiner.js';
import { getApiKey, updateTokenUsage } from './lib/storage.js';
import { MAX_RETRIES } from './lib/constants.js';
import { isRetryableError } from './lib/errors.js';
import { withRetry } from './lib/retry.js';
import { createLogger } from './lib/logger.js';

const log = createLogger('BG');

let taskCounter = 0;
// Map<tabId, { taskId, videoId, kind, abortController }>
const activeTasks = new Map();

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('Aborted', 'AbortError');
  }
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function createTaskId(prefix = 'task') {
  taskCounter += 1;
  return `${prefix}-${Date.now()}-${taskCounter}`;
}

function delayWithSignal(ms, signal) {
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

function isTaskActive(tabId, taskId) {
  if (tabId == null) return true;
  return activeTasks.get(tabId)?.taskId === taskId;
}

function abortAndClearTask(tabId, reason) {
  const currentTask = activeTasks.get(tabId);
  if (!currentTask) return;

  currentTask.abortController?.abort();
  activeTasks.delete(tabId);
  log.info(`Task aborted: tab=${tabId}, taskId=${currentTask.taskId}, reason=${reason}`);
}

function setActiveTask(tabId, task) {
  if (tabId == null) return;

  const previousTask = activeTasks.get(tabId);
  if (previousTask && previousTask.taskId !== task.taskId) {
    previousTask.abortController?.abort();
    log.info(
      `Task preempted: tab=${tabId}, prevTaskId=${previousTask.taskId}, nextTaskId=${task.taskId}`,
    );
  }

  activeTasks.set(tabId, task);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  abortAndClearTask(tabId, 'tab-removed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    abortAndClearTask(tabId, 'tab-updated');
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true;
});

async function handleMessage(request, sender) {
  try {
    switch (request.type) {
      case 'TRANSLATE':
        return await handleTranslation(request.payload, sender);
      case 'REFINE_TRANSLATION':
        return await handleRefine(request.payload, sender);
      case 'CHECK_API_KEY':
        return { hasKey: !!(await getApiKey()) };
      default:
        throw new Error(`Unknown message type: ${request.type}`);
    }
  } catch (error) {
    log.error('handleMessage error:', error);
    throw error;
  }
}

async function handleTranslation(
  {
    chunks,
    targetLang,
    sourceLang,
    thinkingLevel,
    videoId,
    stream = false,
    startChunkIndex = 0,
    initialPreviousContext = '',
    taskId: incomingTaskId,
  },
  sender,
) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다.');

  const tabId = sender?.tab?.id;
  const taskId = incomingTaskId || createTaskId('translate');
  const abortController = new AbortController();

  if (tabId != null) {
    setActiveTask(tabId, { taskId, videoId, kind: 'translate', abortController });
  }

  const results = [];
  let totalInput = 0;
  let totalOutput = 0;
  let previousContext = initialPreviousContext || '';
  const parsedStartChunkIndex = Number(startChunkIndex);
  const normalizedStartChunkIndex = Math.max(
    0,
    Math.min(Number.isFinite(parsedStartChunkIndex) ? parsedStartChunkIndex : 0, chunks.length),
  );

  try {
    for (let i = normalizedStartChunkIndex; i < chunks.length; i += 1) {
      if (!isTaskActive(tabId, taskId)) {
        throw createAbortError();
      }

      const chunkResults = await processChunk(
        apiKey,
        chunks[i],
        { targetLang, sourceLang, thinkingLevel, previousContext },
        i + 1,
        chunks.length,
        videoId,
        taskId,
        stream,
        sender,
        abortController.signal,
      );

      results.push(...chunkResults.parsed);

      const input = chunkResults.usage.promptTokenCount;
      const thinking = chunkResults.usage.thoughtsTokenCount || 0;
      const output = chunkResults.usage.candidatesTokenCount + thinking;
      await updateTokenUsage(input, output);

      totalInput += input;
      totalOutput += output;

      if (chunkResults.parsed.length > 0) {
        const lastItems = chunkResults.parsed.slice(-3);
        previousContext = lastItems.map((item) => item.text).join(' ');
      }

      if (i < chunks.length - 1) {
        await delayWithSignal(300, abortController.signal);
      }
    }

    return { success: true, translations: results, usage: { input: totalInput, output: totalOutput }, taskId };
  } catch (error) {
    if (isAbortError(error)) {
      log.info(`Translation aborted: tab=${tabId ?? 'none'}, videoId=${videoId}, taskId=${taskId}`);
      return { success: false, aborted: true, taskId, error: 'ABORTED' };
    }

    log.error('Translation failed:', error);
    return { success: false, taskId, error: error.message };
  } finally {
    if (tabId != null && activeTasks.get(tabId)?.taskId === taskId) {
      activeTasks.delete(tabId);
    }
  }
}

async function handleRefine(
  { original, draftText, thinkingLevel, videoId, taskId: incomingTaskId },
  sender,
) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다.');

  const tabId = sender?.tab?.id;
  const taskId = incomingTaskId || createTaskId('refine');
  const abortController = new AbortController();

  if (tabId != null) {
    setActiveTask(tabId, { taskId, videoId, kind: 'refine', abortController });
  }

  try {
    const { parsed, usage } = await withRetry(
      () => callRefineAPI(apiKey, original, draftText, thinkingLevel, abortController.signal),
      {
        maxRetries: MAX_RETRIES,
        isRetryable: isRetryableError,
        signal: abortController.signal,
        onRetry: async ({ attempt, error }) => {
          log.warn(`Refine retry (${attempt}/${MAX_RETRIES})...:`, error.message);

          if (tabId != null && isTaskActive(tabId, taskId)) {
            await chrome.tabs
              .sendMessage(tabId, {
                type: 'TRANSLATION_RETRYING',
                payload: {
                  videoId,
                  taskId,
                  phase: 'refine',
                  current: 'REFINE',
                  total: 'REFINE',
                  retryCount: attempt,
                },
              })
              .catch(() => {});
          }
        },
      },
    );

    const input = usage.promptTokenCount;
    const thinking = usage.thoughtsTokenCount || 0;
    const output = usage.candidatesTokenCount + thinking;
    await updateTokenUsage(input, output);

    return { success: true, translations: parsed, usage: { input, output }, taskId };
  } catch (error) {
    if (isAbortError(error)) {
      log.info(`Refine aborted: tab=${tabId ?? 'none'}, videoId=${videoId}, taskId=${taskId}`);
      return { success: false, aborted: true, taskId, error: 'ABORTED' };
    }

    log.error('Refine failed:', error);
    return { success: false, taskId, error: error.message };
  } finally {
    if (tabId != null && activeTasks.get(tabId)?.taskId === taskId) {
      activeTasks.delete(tabId);
    }
  }
}

async function processChunk(
  apiKey,
  chunk,
  options,
  idx,
  total,
  videoId,
  taskId,
  stream,
  sender,
  signal,
) {
  try {
    return await withRetry(
      async () => {
        const response = await callGeminiAPI(apiKey, chunk, options, idx, total, signal);
        const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
        const content = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) throw new Error('번역 결과가 비어 있습니다.');
        const parsed = parseGeminiResponse(content);

        if (stream && sender?.tab?.id && isTaskActive(sender.tab.id, taskId)) {
          sendStreamMessage(sender.tab.id, videoId, taskId, idx, total, parsed);
        }

        return { parsed, usage };
      },
      {
        maxRetries: MAX_RETRIES,
        isRetryable: isRetryableError,
        signal,
        onRetry: async ({ attempt }) => {
          if (sender?.tab?.id && isTaskActive(sender.tab.id, taskId)) {
            await chrome.tabs
              .sendMessage(sender.tab.id, {
                type: 'TRANSLATION_RETRYING',
                payload: { videoId, taskId, phase: 'translate', current: idx, total, retryCount: attempt },
              })
              .catch(() => {});
          }
        },
      },
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw new Error(error.message || '다시 시도했지만 번역에 실패했습니다.');
  }
}

function parseGeminiResponse(content) {
  try {
    return JSON.parse(content);
  } catch {
    return JSON.parse(repairTruncatedJson(content));
  }
}

function sendStreamMessage(tabId, videoId, taskId, current, total, translations) {
  chrome.tabs
    .sendMessage(tabId, {
      type: 'TRANSLATION_CHUNK_DONE',
      payload: { videoId, taskId, phase: 'translate', current, total, translations },
    })
    .catch(() => {});
}

function repairTruncatedJson(jsonStr) {
  let str = jsonStr.trim();
  let lastPos = str.lastIndexOf('}');
  while (lastPos !== -1) {
    let candidate = str.substring(0, lastPos + 1);
    if (candidate.startsWith('[') && !candidate.endsWith(']')) candidate += ']';
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      str = str.substring(0, lastPos);
      lastPos = str.lastIndexOf('}');
    }
  }
  return '[]';
}
