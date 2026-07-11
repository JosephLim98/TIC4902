const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const configuredLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const maxLevel = LEVELS[configuredLevel] ?? LEVELS.info;

function shouldLog(level) {
  return LEVELS[level] <= maxLevel;
}

function formatMeta(meta) {
  return meta ? JSON.stringify(meta) : '';
}

const logger = {
  error: (msg, meta) => {
    if (shouldLog('error')) {
      console.error(`[ERROR] ${msg}`, formatMeta(meta));
    }
  },
  warn: (msg, meta) => {
    if (shouldLog('warn')) {
      console.warn(`[WARN] ${msg}`, formatMeta(meta));
    }
  },
  info: (msg, meta) => {
    if (shouldLog('info')) {
      console.log(`[INFO] ${msg}`, formatMeta(meta));
    }
  },
  debug: (msg, meta) => {
    if (shouldLog('debug')) {
      console.debug(`[DEBUG] ${msg}`, formatMeta(meta));
    }
  },
};

export default logger;
