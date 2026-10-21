
'use strict';

/**
 * MedOrbits -- Environment Configuration
 * File: src/config/env.js
 *
 * Responsibilities:
 * - Parse and validate environment variables.
 * - Apply documented defaults.
 * - Reject invalid configuration during startup.
 * - Export a centralized, immutable configuration object.
 *
 * Load dotenv in the application entry point before importing this module.
 */

const ALLOWED_ENVIRONMENTS = new Set([
  'development',
  'test',
  'staging',
  'production',
]);

const NODE_ENV = (
  process.env.NODE_ENV === undefined
    ? 'development'
    : process.env.NODE_ENV
).trim();

function parseInteger(name, fallback, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const normalized = raw.trim();

  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${name} must be an integer.`);
  }

  const value = Number(normalized);

  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}.`
    );
  }

  return value;
}

function parseBoolean(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  switch (raw.trim().toLowerCase()) {
    case 'true':
      return true;

    case 'false':
      return false;

    default:
      throw new Error(
        `${name} must be "true" or "false".`
      );
  }
}

function parseString(name, fallback = '') {
  const raw = process.env[name];

  if (raw === undefined) {
    return fallback;
  }

  return raw.trim();
}

function parseCsv(name, fallback = '') {
  return [
    ...new Set(
      parseString(name, fallback)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeApiPrefix(value) {
  const prefix = value.trim();

  if (!prefix.startsWith('/')) {
    throw new Error('API_PREFIX must start with "/".');
  }

  if (
    prefix === '/' ||
    prefix.includes('?') ||
    prefix.includes('#') ||
    prefix.includes('\\') ||
    prefix.includes('%') ||
    prefix.split('/').some(
      (segment) => segment === '.' || segment === '..'
    ) ||
    /[\u0000-\u001F\u007F]/.test(prefix)
  ) {
    throw new Error(
      'API_PREFIX is not a valid API path prefix.'
    );
  }

  return prefix.replace(/\/+$/, '');
}

function validateEnvironment() {
  if (!ALLOWED_ENVIRONMENTS.has(NODE_ENV)) {
    throw new Error(
      `NODE_ENV must be one of: ${[...ALLOWED_ENVIRONMENTS].join(', ')}.`
    );
  }
}

function validateHost(host) {
  if (
    !host ||
    /[\u0000-\u0020\u007F]/.test(host) ||
    host.includes('/') ||
    host.includes('\\') ||
    host.includes('@')
  ) {
    throw new Error('HOST must be a valid hostname or IP address.');
  }

  return host;
}

function validateOriginList(origins) {
  for (const origin of origins) {
    if (origin === '*') {
      continue;
    }

    let parsed;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `CORS_ALLOWED_ORIGINS contains an invalid origin: "${origin}".`
      );
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS entries must be HTTP(S) origins without paths or credentials: "${origin}".`
      );
    }
  }
}

validateEnvironment();

const PORT = parseInteger('PORT', 3000, 1, 65535);
const HOST = validateHost(parseString('HOST', '0.0.0.0'));

const API_PREFIX = normalizeApiPrefix(
  parseString('API_PREFIX', '/api/v1')
);

const CORS_ALLOWED_ORIGINS = parseCsv(
  'CORS_ALLOWED_ORIGINS'
);

const CORS_ALLOW_CREDENTIALS = parseBoolean(
  'CORS_ALLOW_CREDENTIALS',
  false
);

const CORS_MAX_AGE_SECONDS = parseInteger(
  'CORS_MAX_AGE_SECONDS',
  600,
  0,
  86400
);

validateOriginList(CORS_ALLOWED_ORIGINS);

if (
  NODE_ENV === 'production' &&
  CORS_ALLOWED_ORIGINS.length === 0
) {
  throw new Error(
    'CORS_ALLOWED_ORIGINS must contain at least one origin in production.'
  );
}

if (
  NODE_ENV === 'production' &&
  CORS_ALLOWED_ORIGINS.includes('*')
) {
  throw new Error(
    'Wildcard CORS origins are not permitted in production.'
  );
}

if (
  CORS_ALLOW_CREDENTIALS &&
  CORS_ALLOWED_ORIGINS.includes('*')
) {
  throw new Error(
    'Wildcard CORS origins cannot be used with credentials.'
  );
}

// Database configuration.
const DB_CHECK_ON_START = parseBoolean(
  'DB_CHECK_ON_START',
  true
);

const DB_PORT = parseInteger(
  'DB_PORT',
  3306,
  1,
  65535
);

const DB_CONNECTION_LIMIT = parseInteger(
  'DB_CONNECTION_LIMIT',
  10,
  1,
  100
);

const DB_CONNECT_TIMEOUT_MS = parseInteger(
  'DB_CONNECT_TIMEOUT_MS',
  10000,
  1000,
  120000
);

const DB_HOST = parseString('DB_HOST');
const DB_NAME = parseString('DB_NAME');
const DB_USER = parseString('DB_USER');

// Preserve password bytes; do not trim secrets.
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';

if (DB_PASSWORD.includes('\u0000')) {
  throw new Error('DB_PASSWORD must not contain a null character.');
}

if (DB_CHECK_ON_START) {
  const requiredDatabaseSettings = [
    ['DB_HOST', DB_HOST],
    ['DB_NAME', DB_NAME],
    ['DB_USER', DB_USER],
    ['DB_PASSWORD', DB_PASSWORD],
  ];

  const missing = requiredDatabaseSettings
    .filter(([, value]) => !value.trim())
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `DB_CHECK_ON_START is enabled but database settings are missing: ${missing.map((name) => name).join(', ')}.`
    );
  }
}

// Email configuration.
const EMAIL_ENABLED = parseBoolean(
  'EMAIL_ENABLED',
  false
);

const SMTP_HOST = parseString('SMTP_HOST');
const SMTP_PORT = parseInteger(
  'SMTP_PORT',
  587,
  1,
  65535
);

const SMTP_SECURE = parseBoolean(
  'SMTP_SECURE',
  false
);

const SMTP_USER = parseString('SMTP_USER');
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? '';

const EMAIL_FROM_NAME = parseString(
  'EMAIL_FROM_NAME',
  'MedOrbits'
);

const EMAIL_FROM_ADDRESS = parseString(
  'EMAIL_FROM_ADDRESS'
);

const EMAIL_REPLY_TO = parseString(
  'EMAIL_REPLY_TO'
);

const EMAIL_SEND_TIMEOUT_MS = parseInteger(
  'EMAIL_SEND_TIMEOUT_MS',
  10000,
  1000,
  120000
);

if (/[\r\n]/.test(EMAIL_FROM_NAME)) {
  throw new Error(
    'EMAIL_FROM_NAME must not contain line breaks.'
  );
}

if (EMAIL_ENABLED) {
  const requiredEmailSettings = [
    ['SMTP_HOST', SMTP_HOST],
    ['SMTP_USER', SMTP_USER],
    ['SMTP_PASSWORD', SMTP_PASSWORD],
    ['EMAIL_FROM_ADDRESS', EMAIL_FROM_ADDRESS],
  ];

  const missing = requiredEmailSettings
    .filter(([, value]) => !value.trim())
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Email is enabled but required settings are missing: ${missing.join(', ')}.`
    );
  }

  if (
    /[\u0000-\u0020\u007F/\\@]/.test(SMTP_HOST)
  ) {
    throw new Error(
      'SMTP_HOST must be a valid hostname without a scheme or path.'
    );
  }
}

// Validate known URL-shaped origins, but leave full email-address
// validation to the email service's dedicated validator.

const env = Object.freeze({
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === 'production',
  IS_DEVELOPMENT: NODE_ENV === 'development',
  IS_TEST: NODE_ENV === 'test',
  IS_STAGING: NODE_ENV === 'staging',

  PORT,
  HOST,
  API_PREFIX,

  CORS_ALLOWED_ORIGINS: Object.freeze(
    [...CORS_ALLOWED_ORIGINS]
  ),
  CORS_ALLOW_CREDENTIALS,
  CORS_MAX_AGE_SECONDS,

  DB_CHECK_ON_START,
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_CONNECTION_LIMIT,
  DB_CONNECT_TIMEOUT_MS,

  EMAIL_ENABLED,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASSWORD,
  EMAIL_FROM_NAME,
  EMAIL_FROM_ADDRESS,
  EMAIL_REPLY_TO,
  EMAIL_SEND_TIMEOUT_MS,
});

module.exports = { env };
