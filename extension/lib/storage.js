// lib/storage.js - 스토리지 및 토큰 관리 모듈

/**
 * API Key 조회
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

/**
 * 토큰 사용량 업데이트 (날짜별 히스토리 저장)
 * @param {number} inputTokens - 입력 토큰 수
 * @param {number} outputTokens - 출력 토큰 수
 */
export async function updateTokenUsage(inputTokens, outputTokens) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};

  // 오늘 사용량 업데이트 (불변성 유지)
  const todayUsage = history[today] || { input: 0, output: 0 };
  const updatedHistory = {
    ...history,
    [today]: {
      input: todayUsage.input + inputTokens,
      output: todayUsage.output + outputTokens
    }
  };

  // 30일 이전 데이터 정리
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  const cleanedHistory = Object.fromEntries(
    Object.entries(updatedHistory).filter(([date]) => date >= cutoffStr)
  );

  await chrome.storage.local.set({ tokenHistory: cleanedHistory });
}

/**
 * 오늘 토큰 사용량 조회
 */
export async function getTodayTokenUsage() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};
  return history[today] || { input: 0, output: 0 };
}

/**
 * 최근 30일 토큰 사용량 합계 조회
 */
export async function getMonthlyTokenUsage() {
  const result = await chrome.storage.local.get('tokenHistory');
  const history = result.tokenHistory || {};
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  return Object.entries(history)
    .filter(([date]) => date >= cutoffStr)
    .reduce((acc, [, usage]) => ({
      input: acc.input + (usage.input || 0),
      output: acc.output + (usage.output || 0)
    }), { input: 0, output: 0 });
}
