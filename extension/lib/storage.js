// lib/storage.js - 스토리지 및 토큰 관리 모듈
import { createLogger } from './logger.js';

const log = createLogger('Storage');

// ========================================
// API Key 난독화 (XOR + Base64)
// ========================================

/**
 * XOR 인코딩/디코딩 (대칭 연산)
 * @param {string} text - 평문 또는 인코딩된 텍스트
 * @param {string} key - XOR 키 (chrome.runtime.id 기반)
 * @returns {string} XOR 처리된 문자열
 */
function xorCipher(text, key) {
  return Array.from(text)
    .map((char, i) =>
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    )
    .join('');
}

/** XOR 키로 확장 프로그램 ID 사용 (브라우저 프로필별 고유) */
function getXorKey() {
  return chrome.runtime.id || 'yt-ai-translator-fallback';
}

/**
 * API Key 저장 (XOR + Base64 난독화 적용)
 * @param {string} apiKey - 평문 API 키
 */
export async function saveApiKey(apiKey) {
  const encoded = btoa(xorCipher(apiKey, getXorKey()));
  await chrome.storage.local.set({ apiKey: encoded });
}

/**
 * API Key 조회 (디코딩 후 평문 반환)
 * 레거시(평문 저장) 호환: Base64가 아니면 재저장
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  const stored = result.apiKey;
  if (!stored) return null;

  try {
    // Base64 디코딩 → XOR 복원
    const decoded = xorCipher(atob(stored), getXorKey());

    // 유효한 API 키인지 간단 검증 (인쇄 가능 ASCII)
    const isValid = /^[\x20-\x7E]+$/.test(decoded);
    if (isValid) return decoded;

    // 디코딩 실패 → 레거시 평문으로 간주
    throw new Error('legacy format');
  } catch {
    // 레거시 평문 API 키 → 난독화해서 재저장
    log.info('레거시 API 키 감지, 난독화 적용 후 재저장');
    await saveApiKey(stored);
    return stored;
  }
}

/**
 * API Key 삭제
 */
export async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
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
