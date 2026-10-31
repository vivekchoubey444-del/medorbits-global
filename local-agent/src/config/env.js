
'use strict';

/**
 * MedOrbits Local Agent -- Environment Configuration
 * -------------------------------------------------
 * Centralized environment parsing, validation, safe defaults,
 * secret redaction, and configuration loading.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 *
 * Security:
 * - Does not print secret values.
 * - Does not automatically load or overwrite .env files.
 * - Restricts repository paths to the configured root.
 * - Uses strict boolean and integer parsing.
 */

const fs = require('node:fs');
const path = require('node:path');

const ENV_CONFIG_VERSION = '1.0.0';

const DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  MEDORBITS_AGENT_ENABLED: true,
  MEDORBITS_AGENT_READ_ONLY: true,
  MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS: false,
  MEDORBITS_AGENT_MAX_FILE_BYTES: 2 * 1024 * 1024,
  MEDORBITS_AGENT_MAX_TOTAL_READ_BYTES: 10 * 1024 * 1024,
  MEDORBITS_AGENT_MAX_FILES: 500,
  MEDORBITS_AGENT_TASK_TIMEOUT_MS: 60_000,
  MEDORBITS_AGENT_MAX_CONCURRENT_TASKS: 2,
  MEDORBITS_AGENT_LOG_LEVEL: 'info',
  MEDORBITS_AGENT_LOG_FORMAT: 'json',
  MEDORBITS_AGENT_LOG_TO_FILE: false,
  MEDORBITS_AGENT_BACKUP_RETENTION: 10,
  OLLAMA_HOST: 'http://127.0.0.1:11434',
  OLLAMA_MODEL: 'llama3.2',
  OLLAMA_TIMEOUT_MS: 60_000
});

const SECRET_KEYS = new Set([
  'AI_API_KEY',
  'API_KEY',
  'AUTH_TOKEN',
  'ACCESS_TOKEN',
  'REFRESH_TOKEN',
  'SESSION_SECRET',
  'DATABASE_URL',
  'DB_PASSWORD',
  'PASSWORD',
  'OLLAMA_API_KEY',
  'PRIVATE_KEY',
  'CLIENT_SECRET'
]);

const ALLOWED_LOG_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent'
]);

const ALLOWED_LOG_FORMATS = new Set([
  'json',
  'text'
]);

class EnvironmentConfigError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = 'EnvironmentConfigError';
    this.code = options.code || 'INVALID_ENV_CONFIG';
    this.key = options.key || null;
  }
}

function parseBoolean(value, fallback, key) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new EnvironmentConfigError(
    `${key} must be a valid boolean.`,
    { key }
  );
}

function parseInteger(value, fallback, key, options = {}) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim();

  if (!/^-?\d+$/.test(normalized)) {
    throw new EnvironmentConfigError(
      `${key} must be an integer.`,
      { key }
    );
  }

  const parsed = Number(normalized);

  if (!Number.isSafeInteger(parsed)) {
    throw new EnvironmentConfigError(
      `${key} is outside the safe integer range.`,
      { key }
    );
  }

  const minimum = options.min ?? 1;
  const maximum = options.max ?? Number.MAX_SAFE_INTEGER;

  if (parsed < minimum || parsed > maximum) {
    throw new EnvironmentConfigError(
      `${key} must be between ${minimum} and ${maximum}.`,
      { key }
    );
  }

  return parsed;
}

function parseEnum(value, fallback, allowed, key) {
  const result = String(value ?? fallback).trim().toLowerCase();

  if (!allowed.has(result)) {
    throw new EnvironmentConfigError(
      `${key} has an unsupported value.`,
      { key }
    );
  }

  return result;
}

function parseString(value, fallback, key, options = {}) {
  const result = String(value ?? fallback).trim();

  if (!result && options.allowEmpty !== true) {
    throw new EnvironmentConfigError(
      `${key} must not be empty.`,
      { key }
    );
  }

  if (result.length > (options.maxLength ?? 4096)) {
    throw new EnvironmentConfigError(
      `${key} exceeds its maximum length.`,
      { key }
    );
  }

  if (/[\u0000-\u001f\u007f]/.test(result)) {
    throw new EnvironmentConfigError(
      `${key} contains control characters.`,
      { key }
    );
  }

  return result;
}

function parseHttpUrl(value, fallback, key, options = {}) {
  const raw = parseString(value, fallback, key, { maxLength: 2048 });

  let parsed;

  try {
    parsed = new URL(raw);
  } catch {
    throw new EnvironmentConfigError(
      `${key} must be a valid URL.`,
      { key }
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new EnvironmentConfigError(
      `${key} must use HTTP or HTTPS.`,
      { key }
    );
  }

  if (parsed.username || parsed.password) {
    throw new EnvironmentConfigError(
      `${key} must not contain embedded credentials.`,
      { key }
    );
  }

  if (parsed.search || parsed.hash) {
    throw new EnvironmentConfigError(
      `${key} must not contain a query string or fragment.`,
      { key }
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const loopback = [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '::1'
  ].includes(hostname);

  if (parsed.protocol === 'http:' && !loopback && options.allowInsecureHttp !== true) {
    throw new EnvironmentConfigError(
      `${key} must use HTTPS for non-loopback hosts.`,
      { key }
    );
  }

  return parsed.origin;
}

function resolveRepositoryRoot(value, cwd = process.cwd()) {
  const input = parseString(
    value,
    cwd,
    'MEDORBITS_REPO_ROOT',
    { maxLength: 4096 }
  );

  const absolute = path.resolve(cwd, input);

  let real;

  try {
    real = fs.realpathSync.native(absolute);
  } catch {
    throw new EnvironmentConfigError(
      'MEDORBITS_REPO_ROOT must point to an existing directory.',
      {
        key: 'MEDORBITS_REPO_ROOT',
        code: 'INVALID_REPOSITORY_ROOT'
      }
    );
  }

  let stat;

  try {
    stat = fs.statSync(real);
  } catch {
    throw new EnvironmentConfigError(
      'Unable to inspect MEDORBITS_REPO_ROOT.',
      { key: 'MEDORBITS_REPO_ROOT' }
    );
  }

  if (!stat.isDirectory()) {
    throw new EnvironmentConfigError(
      'MEDORBITS_REPO_ROOT must be a directory.',
      { key: 'MEDORBITS_REPO_ROOT' }
    );
  }

  return real;
}

function parseConfiguration(source = process.env, options = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('Environment source must be an object.');
  }

  const cwd = options.cwd || process.cwd();

  const nodeEnv = parseEnum(
    source.NODE_ENV,
    DEFAULTS.NODE_ENV,
    new Set(['development', 'test', 'production']),
    'NODE_ENV'
  );

  const root = resolveRepositoryRoot(
    source.MEDORBITS_REPO_ROOT,
    cwd
  );

  const config = {
    version: ENV_CONFIG_VERSION,
    nodeEnv,
    root,

    agent: {
      enabled: parseBoolean(
        source.MEDORBITS_AGENT_ENABLED,
        DEFAULTS.MEDORBITS_AGENT_ENABLED,
        'MEDORBITS_AGENT_ENABLED'
      ),

      readOnly: parseBoolean(
        source.MEDORBITS_AGENT_READ_ONLY,
        DEFAULTS.MEDORBITS_AGENT_READ_ONLY,
        'MEDORBITS_AGENT_READ_ONLY'
      ),

      allowExternalPaths: parseBoolean(
        source.MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS,
        DEFAULTS.MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS,
        'MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS'
      ),

      maxFileBytes: parseInteger(
        source.MEDORBITS_AGENT_MAX_FILE_BYTES,
        DEFAULTS.MEDORBITS_AGENT_MAX_FILE_BYTES,
        'MEDORBITS_AGENT_MAX_FILE_BYTES',
        { min: 1024, max: 100 * 1024 * 1024 }
      ),

      maxTotalReadBytes: parseInteger(
        source.MEDORBITS_AGENT_MAX_TOTAL_READ_BYTES,
        DEFAULTS.MEDORBITS_AGENT_MAX_TOTAL_READ_BYTES,
        'MEDORBITS_AGENT_MAX_TOTAL_READ_BYTES',
        { min: 1024, max: 1024 * 1024 * 1024 }
      ),

      maxFiles: parseInteger(
        source.MEDORBITS_AGENT_MAX_FILES,
        DEFAULTS.MEDORBITS_AGENT_MAX_FILES,
        'MEDORBITS_AGENT_MAX_FILES',
        { min: 1, max: 100_000 }
      ),

      taskTimeoutMs: parseInteger(
        source.MEDORBITS_AGENT_TASK_TIMEOUT_MS,
        DEFAULTS.MEDORBITS_AGENT_TASK_TIMEOUT_MS,
        'MEDORBITS_AGENT_TASK_TIMEOUT_MS',
        { min: 100, max: 30 * 60 * 1000 }
      ),

      maxConcurrentTasks: parseInteger(
        source.MEDORBITS_AGENT_MAX_CONCURRENT_TASKS,
        DEFAULTS.MEDORBITS_AGENT_MAX_CONCURRENT_TASKS,
        'MEDORBITS_AGENT_MAX_CONCURRENT_TASKS',
        { min: 1, max: 64 }
      ),

      backupRetention: parseInteger(
        source.MEDORBITS_AGENT_BACKUP_RETENTION,
        DEFAULTS.MEDORBITS_AGENT_BACKUP_RETENTION,
        'MEDORBITS_AGENT_BACKUP_RETENTION',
        { min: 1, max: 1000 }
      )
    },

    logging: {
      level: parseEnum(
        source.MEDORBITS_AGENT_LOG_LEVEL,
        DEFAULTS.MEDORBITS_AGENT_LOG_LEVEL,
        ALLOWED_LOG_LEVELS,
        'MEDORBITS_AGENT_LOG_LEVEL'
      ),

      format: parseEnum(
        source.MEDORBITS_AGENT_LOG_FORMAT,
        DEFAULTS.MEDORBITS_AGENT_LOG_FORMAT,
        ALLOWED_LOG_FORMATS,
        'MEDORBITS_AGENT_LOG_FORMAT'
      ),

      toFile: parseBoolean(
        source.MEDORBITS_AGENT_LOG_TO_FILE,
        DEFAULTS.MEDORBITS_AGENT_LOG_TO_FILE,
        'MEDORBITS_AGENT_LOG_TO_FILE'
      )
    },

    ollama: {
      host: parseHttpUrl(
        source.OLLAMA_HOST,
        DEFAULTS.OLLAMA_HOST,
        'OLLAMA_HOST',
        { allowInsecureHttp: true }
      ),

      model: parseString(
        source.OLLAMA_MODEL,
        DEFAULTS.OLLAMA_MODEL,
        'OLLAMA_MODEL',
        { maxLength: 200 }
      ),

      timeoutMs: parseInteger(
        source.OLLAMA_TIMEOUT_MS,
        DEFAULTS.OLLAMA_TIMEOUT_MS,
        'OLLAMA_TIMEOUT_MS',
        { min: 100, max: 30 * 60 * 1000 }
      )
    }
  };

  if (nodeEnv === 'production' && config.agent.allowExternalPaths) {
    throw new EnvironmentConfigError(
      'External filesystem paths cannot be enabled in production.',
      {
        key: 'MEDORBITS_AGENT_ALLOW_EXTERNAL_PATHS',
        code: 'UNSAFE_PRODUCTION_SETTING'
      }
    );
  }

  if (
    config.agent.maxFileBytes > config.agent.maxTotalReadBytes
  ) {
    throw new EnvironmentConfigError(
      'Maximum file size cannot exceed the total read budget.',
      {
        key: 'MEDORBITS_AGENT_MAX_FILE_BYTES',
        code: 'INCONSISTENT_LIMITS'
      }
    );
  }

  return deepFreeze(config);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

function redactEnvironment(source = process.env) {
  const output = {};

  for (const [key, value] of Object.entries(source)) {
    if (SECRET_KEYS.has(key.toUpperCase()) || /(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE.?KEY|API.?KEY)/i.test(key)) {
      output[key] = value === undefined || value === '' ? '' : '[REDACTED]';
    } else {
      output[key] = value;
    }
  }

  return output;
}

/**
 * Validate configuration without mutating process.env.
 */
function validateEnvironment(source = process.env, options = {}) {
  try {
    const config = parseConfiguration(source, options);

    return {
      valid: true,
      errors: [],
      config
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{
        code: error.code || 'INVALID_ENV_CONFIG',
        key: error.key || null,
        message: error.message
      }],
      config: null
    };
  }
}

/**
 * Optional .env.example checker.
 *
 * It only checks for missing keys. It does not read .env secrets,
 * parse .env files, or modify the process environment.
 */
function checkExampleFile(filePath, source = process.env) {
  const absolutePath = path.resolve(filePath);

  let contents;

  try {
    contents = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    throw new EnvironmentConfigError(
      'Unable to read environment example file.',
      {
        code: 'ENV_EXAMPLE_READ_FAILED'
      }
    );
  }

  const expectedKeys = new Set();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (match) expectedKeys.add(match[1]);
  }

  const missing = [...expectedKeys].filter(
    (key) => source[key] === undefined
  );

  return {
    file: absolutePath,
    expectedCount: expectedKeys.size,
    missing,
    valid: missing.length === 0
  };
}

module.exports = {
  ENV_CONFIG_VERSION,
  DEFAULTS,
  SECRET_KEYS,
  EnvironmentConfigError,
  parseBoolean,
  parseInteger,
  parseEnum,
  parseString,
  parseHttpUrl,
  resolveRepositoryRoot,
  parseConfiguration,
  redactEnvironment,
  validateEnvironment,
  checkExampleFile
};
