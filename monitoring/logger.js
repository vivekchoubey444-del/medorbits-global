
'use strict';

const crypto = require('node:crypto');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SENSITIVE_KEY =
  /password|passwd|secret|token|authorization|cookie|api[_-]?key|database_url|connectionstring/i;

function sanitize(value, depth = 0) {
  if (depth > 8) return '[MAX_DEPTH]';

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitize(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const output = {};

    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) {
        output[key] = '[REDACTED]';
      } else if (item instanceof Error) {
        output[key] = {
          name: item.name,
          message: item.message,
        };
      } else {
        output[key] = sanitize(item, depth + 1);
      }
    }

    return output;
  }

  if (typeof value === 'string') {
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

function createLogger(options = {}) {
  const configuredLevel = options.level || process.env.LOG_LEVEL || 'info';
  const threshold = LEVELS[configuredLevel] ?? LEVELS.info;
  const service = options.service || 'medorbits-api';

  function write(level, message, fields = {}) {
    if (LEVELS[level] < threshold) return;

    const record = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message: String(message).slice(0, 1000),
      eventId: crypto.randomUUID(),
      ...sanitize(fields),
    };

    const output = JSON.stringify(record);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  return Object.freeze({
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  });
}

module.exports = {
  createLogger,
  sanitize,
};
