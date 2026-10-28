
'use strict';

/**
 * MedOrbits Local Agent -- Structured Logger
 * File: /local-agent/src/utils/logger.js
 * Version: 1.0.0
 * Runtime: Node.js 20+
 *
 * Features:
 * - Structured JSON logging.
 * - Configurable severity levels.
 * - Secret and sensitive-data redaction.
 * - Error serialization.
 * - Child loggers with contextual metadata.
 * - Optional file output with rotation.
 * - Safe handling of circular objects and oversized fields.
 * - No external dependencies.
 *
 * Usage:
 *   const { createLogger } = require('./utils/logger');
 *   const logger = createLogger({ service: 'medorbits-local-agent' });
 *
 *   logger.info('Agent started', { version: '1.0.0' });
 *   logger.error('Task failed', { error: new Error('Example failure') });
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const LOGGER_VERSION = '1.0.0';

const LEVELS = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
  silent: Infinity
});

const DEFAULTS = Object.freeze({
  service: 'medorbits-local-agent',
  level: process.env.MEDORBITS_AGENT_LOG_LEVEL || 'info',
  format: 'json',
  destination: 'console',
  filePath: null,
  maxFileBytes: 5 * 1024 * 1024,
  maxFiles: 5,
  maxDepth: 6,
  maxArrayItems: 50,
  maxStringLength: 4000,
  maxMetadataKeys: 100,
  includeHostname: false,
  includePid: true,
  timestamp: true
});

const SECRET_KEY_PATTERN =
  /(?:password|passwd|secret|token|authorization|cookie|credential|private.?key|api.?key|access.?key|client.?secret|refresh.?token)/i;

const ENV_SECRET_PATTERN =
  /(?:^|[_-])(?:API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIALS?)(?:$|[_-])/i;

const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b(?:sk|pk|rk|ghp|github_pat|xox[baprs])_[A-Za-z0-9_-]{12,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g
];

const REDACTED = '[REDACTED]';
const OMITTED = '[OMITTED]';

function normalizeLevel(level) {
  const normalized = String(level || 'info').toLowerCase();

  if (!Object.hasOwn(LEVELS, normalized)) {
    throw new TypeError(`Unsupported log level: ${normalized}`);
  }

  return normalized;
}

function sanitizeString(value, maxLength = DEFAULTS.maxStringLength) {
  let result = String(value);

  for (const pattern of SECRET_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }

  // Reduce the risk of log injection using forged multiline records.
  result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (result.length > maxLength) {
    result = `${result.slice(0, maxLength)}…[TRUNCATED]`;
  }

  return result;
}

function isSensitiveKey(key) {
  const name = String(key);

  return SECRET_KEY_PATTERN.test(name) ||
    ENV_SECRET_PATTERN.test(name);
}

function safeError(error, options, depth, seen) {
  if (!(error instanceof Error)) {
    return sanitizeValue(error, options, depth, seen);
  }

  if (seen.has(error)) {
    return '[Circular Error]';
  }

  seen.add(error);

  const result = {
    name: sanitizeString(error.name || 'Error', 200),
    message: sanitizeString(error.message || 'Unknown error', options.maxStringLength)
  };

  if (error.code !== undefined) {
    result.code = sanitizeValue(error.code, options, depth + 1, seen);
  }

  if (error.stack) {
    result.stack = sanitizeString(error.stack, options.maxStringLength * 2);
  }

  if (error.cause !== undefined && depth < options.maxDepth) {
    result.cause = sanitizeValue(error.cause, options, depth + 1, seen);
  }

  seen.delete(error);
  return result;
}

function sanitizeValue(value, options, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) {
    return value === undefined ? null : value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value, options.maxStringLength);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (value instanceof Error) {
    return safeError(value, options, depth, seen);
  }

  if (typeof value !== 'object') {
    return OMITTED;
  }

  if (depth >= options.maxDepth) {
    return '[MAX_DEPTH]';
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  let result;

  if (Array.isArray(value)) {
    result = value
      .slice(0, options.maxArrayItems)
      .map((item) => sanitizeValue(item, options, depth + 1, seen));

    if (value.length > options.maxArrayItems) {
      result.push(`[${value.length - options.maxArrayItems} items omitted]`);
    }
  } else if (
    value instanceof Date
  ) {
    result = Number.isNaN(value.getTime())
      ? '[Invalid Date]'
      : value.toISOString();
  } else if (
    Buffer.isBuffer(value)
  ) {
    result = `[Buffer ${value.length} bytes]`;
  } else {
    result = {};

    let entries = [];

    try {
      entries = Object.entries(value).slice(0, options.maxMetadataKeys);
    } catch {
      result = '[Uninspectable Object]';
    }

    if (result !== '[Uninspectable Object]') {
      for (const [key, item] of entries) {
        if (isSensitiveKey(key)) {
          result[key] = REDACTED;
        } else {
          result[key] = sanitizeValue(item, options, depth + 1, seen);
        }
      }

      if (Object.keys(value).length > options.maxMetadataKeys) {
        result._omittedKeys = true;
      }
    }
  }

  seen.delete(value);
  return result;
}

function normalizeMetadata(metadata, options) {
  if (metadata === null || metadata === undefined) {
    return {};
  }

  if (metadata instanceof Error) {
    return { error: safeError(metadata, options, 0, new WeakSet()) };
  }

  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { value: sanitizeValue(metadata, options) };
  }

  const result = {};
  let count = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (count >= options.maxMetadataKeys) {
      result._omittedKeys = true;
      break;
    }

    result[key] = isSensitiveKey(key)
      ? REDACTED
      : sanitizeValue(value, options);

    count += 1;
  }

  return result;
}

function normalizeOptions(input = {}) {
  const options = {
    ...DEFAULTS,
    ...input
  };

  options.level = normalizeLevel(options.level);

  if (!['json', 'text'].includes(options.format)) {
    throw new TypeError('Logger format must be "json" or "text".');
  }

  if (!['console', 'file', 'both'].includes(options.destination)) {
    throw new TypeError(
      'Logger destination must be "console", "file", or "both".'
    );
  }

  for (const name of ['maxFileBytes', 'maxFiles', 'maxDepth',
    'maxArrayItems', 'maxStringLength', 'maxMetadataKeys']) {
    if (!Number.isSafeInteger(options[name]) || options[name] < 1) {
      throw new TypeError(`${name} must be a positive integer.`);
    }
  }

  if (
    ['file', 'both'].includes(options.destination) &&
    (!options.filePath || typeof options.filePath !== 'string')
  ) {
    throw new TypeError(
      'filePath is required when file logging is enabled.'
    );
  }

  return Object.freeze(options);
}

function formatText(entry) {
  const {
    timestamp,
    level,
    service,
    message,
    ...metadata
  } = entry;

  const prefix = [
    timestamp,
    level.toUpperCase(),
    `[${service}]`
  ].filter(Boolean).join(' ');

  const details = Object.keys(metadata).length
    ? ` ${JSON.stringify(metadata)}`
    : '';

  return `${prefix} ${message}${details}`;
}

function createFileWriter(options) {
  const filePath = path.resolve(options.filePath);
  const directory = path.dirname(filePath);

  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700
  });

  let stream = null;
  let currentSize = 0;
  let closed = false;

  try {
    const stat = fs.statSync(filePath);

    if (!stat.isFile()) {
      throw new TypeError('Log destination must be a regular file.');
    }

    currentSize = stat.size;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  function openStream() {
    if (closed) return;

    stream = fs.createWriteStream(filePath, {
      flags: 'a',
      mode: 0o600
    });

    stream.on('error', (error) => {
      process.stderr.write(
        `[medorbits-logger] File logging failed: ${sanitizeString(error.message, 300)}\n`
      );
    });
  }

  function rotateIfNeeded(nextBytes) {
    if (currentSize + nextBytes <= options.maxFileBytes) {
      return;
    }

    if (stream) {
      stream.end();
      stream = null;
    }

    try {
      for (let index = options.maxFiles - 1; index >= 1; index -= 1) {
        const source = `${filePath}.${index}`;
        const destination = `${filePath}.${index + 1}`;

        if (index + 1 > options.maxFiles) {
          try {
            fs.unlinkSync(source);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          continue;
        }

        try {
          fs.renameSync(source, destination);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }

      if (options.maxFiles > 1) {
        try {
          fs.renameSync(filePath, `${filePath}.1`);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      } else {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }

      currentSize = 0;
    } catch (error) {
      process.stderr.write(
        `[medorbits-logger] Rotation failed: ${sanitizeString(error.message, 300)}\n`
      );
    }

    openStream();
  }

  openStream();

  return {
    write(line) {
      if (closed) return false;

      const bytes = Buffer.byteLength(line) + 1;

      rotateIfNeeded(bytes);

      if (!stream || stream.destroyed) {
        openStream();
      }

      if (!stream || stream.destroyed) {
        return false;
      }

      currentSize += bytes;
      return stream.write(`${line}\n`);
    },

    close() {
      closed = true;

      if (!stream) return Promise.resolve();

      return new Promise((resolve) => {
        stream.end(resolve);
      });
    }
  };
}

function createLogger(inputOptions = {}, parentContext = {}) {
  const options = normalizeOptions(inputOptions);
  const context = normalizeMetadata(parentContext, options);

  let fileWriter = null;

  if (['file', 'both'].includes(options.destination)) {
    fileWriter = createFileWriter(options);
  }

  function emit(level, message, metadata) {
    if (LEVELS[level] < LEVELS[options.level]) {
      return false;
    }

    const safeMessage = sanitizeString(
      message instanceof Error ? message.message : message,
      options.maxStringLength
    );

    const entry = {};

    if (options.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    entry.level = level;
    entry.service = options.service;

    if (options.includePid) {
      entry.pid = process.pid;
    }

    if (options.includeHostname) {
      entry.hostname = os.hostname();
    }

    entry.message = safeMessage;

    const safeContext = normalizeMetadata(context, options);
    const safeMetadata = normalizeMetadata(metadata, options);

    Object.assign(entry, safeContext, safeMetadata);

    let output;

    try {
      output = options.format === 'json'
        ? JSON.stringify(entry)
        : formatText(entry);
    } catch {
      output = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        service: options.service,
        message: 'Failed to serialize log record.'
      });
    }

    if (['console', 'both'].includes(options.destination)) {
      const target = level === 'error' || level === 'fatal'
        ? process.stderr
        : process.stdout;

      target.write(`${output}\n`);
    }

    if (fileWriter) {
      fileWriter.write(output);
    }

    return true;
  }

  const logger = {
    debug(message, metadata) {
      return emit('debug', message, metadata);
    },

    info(message, metadata) {
      return emit('info', message, metadata);
    },

    warn(message, metadata) {
      return emit('warn', message, metadata);
    },

    error(message, metadata) {
      return emit('error', message, metadata);
    },

    fatal(message, metadata) {
      return emit('fatal', message, metadata);
    },

    child(additionalContext = {}) {
      const mergedContext = {
        ...context,
        ...normalizeMetadata(additionalContext, options)
      };

      return createLogger(inputOptions, mergedContext);
    },

    isLevelEnabled(level) {
      const normalized = normalizeLevel(level);
      return LEVELS[normalized] >= LEVELS[options.level] &&
        normalized !== 'silent';
    },

    async close() {
      if (fileWriter) {
        await fileWriter.close();
      }
    },

    get level() {
      return options.level;
    },

    get service() {
      return options.service;
    }
  };

  return Object.freeze(logger);
}

function createRequestId() {
  return crypto.randomUUID();
}

module.exports = {
  LOGGER_VERSION,
  LEVELS,
  AgentLogger: createLogger,
  createLogger,
  createRequestId,
  sanitizeString,
  sanitizeValue,
  isSensitiveKey
};
