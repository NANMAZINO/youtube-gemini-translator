// YouTube AI Translator - Background Service Worker
import { callGeminiAPI } from './lib/gemini.js';
import { callRefineAPI } from './lib/gemini-refiner.js';
import { getApiKey, updateTokenUsage } from './lib/storage.js';



// ========================================
// 태스크 관리 (중단 로직용: 탭별 현재 실행중인 영상 ID 추적)
// ========================================
const activeTasks = new Map(); // tabId -> videoId

chrome.tabs.onRemoved.addListener((tabId) => activeTasks.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 페이지 이동 시 해당 탭의 태스크 정리
  if (changeInfo.status === 'loading' || changeInfo.url) {
    activeTasks.delete(tabId);
  }
});

// ========================================
// 메시지 핸들러
// ========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ error: err.message }));
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
    console.error('[YT-AI-Translator-BG] handleMessage 에러:', error);
    throw error;
  }
}

// ========================================
// 번역 처리
// ========================================
async function handleTranslation({ chunks, targetLang, sourceLang, thinkingLevel, videoId, stream = false }, sender) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다.');

  const tabId = sender?.tab?.id;
  if (tabId) activeTasks.set(tabId, videoId);

  const results = [];
  let totalInput = 0;
  let totalOutput = 0;
  let previousContext = '';

  try {
    for (let i = 0; i < chunks.length; i++) {
      // 태스크 중단 여부 체크 (새 영상이 시작되었거나 탭이 닫혔는지)
      if (tabId && activeTasks.get(tabId) !== videoId) {

        return { success: false, error: 'Task preempted by navigation' };
      }

      const chunkResults = await processChunk(
        apiKey, 
        chunks[i], 
        { targetLang, sourceLang, thinkingLevel, previousContext }, 
        i + 1, 
        chunks.length, 
        videoId, 
        stream, 
        sender
      );
      
      results.push(...chunkResults.parsed);
      
      // 실시간 토큰 정산 (중단되더라도 이미 처리된 토큰은 저장)
      const input = chunkResults.usage.promptTokenCount;
      // thinking 토큰은 과금 대상이므로 출력에 합산
      const thinking = chunkResults.usage.thoughtsTokenCount || 0;
      const output = chunkResults.usage.candidatesTokenCount + thinking;
      await updateTokenUsage(input, output);
      
      totalInput += input;
      totalOutput += output;

      // 다음 청크를 위한 문맥 업데이트 (마지막 3문장 추출)
      if (chunkResults.parsed.length > 0) {
        const lastItems = chunkResults.parsed.slice(-3);
        previousContext = lastItems.map(item => item.text).join(' ');
      }

      if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    return { success: true, translations: results, usage: { input: totalInput, output: totalOutput } };
  } catch (err) {
    console.error('[YT-AI-Translator-BG] 번역 처리 실패:', err);
    return { success: false, error: err.message };
  } finally {
    if (tabId && activeTasks.get(tabId) === videoId) {
      activeTasks.delete(tabId);
    }
  }
}

async function handleRefine({ original, draftText, thinkingLevel, videoId }, sender) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('API Key가 설정되지 않았습니다.');

  let retries = 0;
  const MAX_RETRIES = 3;

  while (retries <= MAX_RETRIES) {
    try {
      const { parsed, usage } = await callRefineAPI(apiKey, original, draftText, thinkingLevel);
      
      // 토큰 정산 (thinking 토큰은 과금 대상이므로 출력에 합산)
      const input = usage.promptTokenCount;
      const thinking = usage.thoughtsTokenCount || 0;
      const output = usage.candidatesTokenCount + thinking;
      await updateTokenUsage(input, output);

      return { success: true, translations: parsed, usage: { input, output } };
    } catch (err) {
      const isRetryable = err.message === 'MODEL_OVERLOADED' || 
                          err.message.includes('overloaded') || 
                          err.message.includes('fetch');

      if (isRetryable && retries < MAX_RETRIES) {
        retries++;
        console.log(`[YT-AI-Translator-BG] Refine 재시도 중 (${retries}/${MAX_RETRIES})...:`, err.message);
        
        // UI에 재시도 상태 표시 (main.js가 이 메시지를 구독함)
        if (sender?.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'TRANSLATION_RETRYING',
            payload: { videoId, current: '재분할', total: '진행', retryCount: retries }
          }).catch(() => {});
        }
        
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        continue;
      }
      
      console.error('[YT-AI-Translator-BG] Refine 처리 최종 실패:', err);
      return { success: false, error: err.message };
    }
  }
}

/**
 * 단일 청크 처리 및 시도 (Retry logic)
 */
async function processChunk(apiKey, chunk, options, idx, total, videoId, stream, sender) {
  let retries = 0;
  const MAX_RETRIES = 3;

  while (retries <= MAX_RETRIES) {
    try {
      const response = await callGeminiAPI(apiKey, chunk, options, idx, total);
      const usage = response.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) throw new Error('번역 결과 비어있음');
      const parsed = parseGeminiResponse(content);

      if (stream && sender?.tab?.id) {
        sendStreamMessage(sender.tab.id, videoId, idx, total, parsed);
      }

      return { parsed, usage };
    } catch (err) {
      const isRetryable = err.message === 'MODEL_OVERLOADED' || 
                          err.message.includes('overloaded') || 
                          err.message.includes('fetch');

      if (isRetryable && retries < MAX_RETRIES) {
        retries++;
        if (sender?.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'TRANSLATION_RETRYING',
            payload: { videoId, current: idx, total, retryCount: retries }
          }).catch(() => {});
        }
        await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
        continue;
      }
      throw new Error(err.message || '다시 시도했지만 번역에 실패했습니다.');
    }
  }
}

function parseGeminiResponse(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    return JSON.parse(repairTruncatedJson(content));
  }
}

function sendStreamMessage(tabId, videoId, current, total, translations) {
  chrome.tabs.sendMessage(tabId, {
    type: 'TRANSLATION_CHUNK_DONE',
    payload: { videoId, current, total, translations }
  }).catch(() => {});
}

/**
 * 잘린 JSON 문자열 복구 (Helper)
 */
function repairTruncatedJson(jsonStr) {
  let str = jsonStr.trim();
  let lastPos = str.lastIndexOf('}');
  while (lastPos !== -1) {
    let candidate = str.substring(0, lastPos + 1);
    if (candidate.startsWith('[') && !candidate.endsWith(']')) candidate += ']';
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      str = str.substring(0, lastPos);
      lastPos = str.lastIndexOf('}');
    }
  }
  return '[]';
}
