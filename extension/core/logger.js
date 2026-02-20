// Structured logger utility shared across extension modules.

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const ACTIVE_LEVEL = LOG_LEVELS.debug;

export function createLogger(tag) {
  const prefix = `[YT-Translator][${tag}]`;

  return {
    debug(...args) {
      if (ACTIVE_LEVEL <= LOG_LEVELS.debug) {
        console.debug(prefix, ...args);
      }
    },
    info(...args) {
      if (ACTIVE_LEVEL <= LOG_LEVELS.info) {
        console.info(prefix, ...args);
      }
    },
    warn(...args) {
      if (ACTIVE_LEVEL <= LOG_LEVELS.warn) {
        console.warn(prefix, ...args);
      }
    },
    error(...args) {
      if (ACTIVE_LEVEL <= LOG_LEVELS.error) {
        console.error(prefix, ...args);
      }
    },
  };
}
