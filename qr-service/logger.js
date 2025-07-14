// Simple logger utility with configurable log levels
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] !== undefined 
  ? LOG_LEVELS[process.env.LOG_LEVEL] 
  : LOG_LEVELS.info; // Default to info level

const logger = {
  error: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.error) {
      console.error('[ERROR]', ...args);
    }
  },
  
  warn: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.warn) {
      console.warn('[WARN]', ...args);
    }
  },
  
  info: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.info) {
      console.log('[INFO]', ...args);
    }
  },
  
  debug: (...args) => {
    if (currentLogLevel >= LOG_LEVELS.debug) {
      console.log('[DEBUG]', ...args);
    }
  }
};

module.exports = logger; 