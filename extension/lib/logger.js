// lib/logger.js - 구조화된 로깅 모듈
// console.error 직접 호출 대신 모듈 태그 + 레벨 기반 통합 로거

/** 로그 레벨 정의 (숫자가 높을수록 심각) */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
};

/** 현재 최소 로그 레벨 (이 이상만 출력) */
let currentLevel = LOG_LEVELS.debug;

/**
 * 로그 레벨 설정
 * @param {'debug'|'info'|'warn'|'error'|'silent'} level
 */
export function setLogLevel(level) {
  currentLevel = LOG_LEVELS[level] ?? LOG_LEVELS.debug;
}

/**
 * 태그가 붙은 로거 인스턴스 생성
 * @param {string} tag - 모듈 식별 태그 (예: 'Cache', 'BG', 'Main')
 * @returns {Object} debug/info/warn/error 메서드를 가진 로거 객체
 *
 * @example
 * const log = createLogger('Cache');
 * log.error('Save failed:', error);  // [YT-Translator][Cache] Save failed: ...
 */
export function createLogger(tag) {
  const prefix = `[YT-Translator][${tag}]`;

  return {
    debug(...args) {
      if (currentLevel <= LOG_LEVELS.debug) {
        console.debug(prefix, ...args);
      }
    },
    info(...args) {
      if (currentLevel <= LOG_LEVELS.info) {
        console.info(prefix, ...args);
      }
    },
    warn(...args) {
      if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(prefix, ...args);
      }
    },
    error(...args) {
      if (currentLevel <= LOG_LEVELS.error) {
        console.error(prefix, ...args);
      }
    }
  };
}
