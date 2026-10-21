
'use strict';

/**
 * MedOrbits -- Structured Application Logger
 * File: src/config/logger.js
 *
 * Features:
 * - Structured JSON logging with Pino.
 * - Environment-aware log levels.
 * - Sensitive-field redaction.
 * - Optional file output.
 * - Safe initialization and configurable output destination.
 *
 * Note:
 * File rotation is not implemented by this module. Use an approved
 * rotation strategy or logging platform for production file retention.
 */

const pino = require('pino');
const path = require('node:path');
const fs = require('node:fs');
const { env } = require('./env');

const VALID_LOG_LEVELS = new Set([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);

const configuredLevel =
  typeof env.LOG_LEVEL === 'string'
    ? env.LOG_LEVEL.trim().toLowerCase()
    : 'info';

if (!VALID_LOG_LEVELS.has(configuredLevel)) {
  throw new Error(
    `Invalid LOG_LEVEL "${configuredLevel}". Allowed values: ${[
      ...VALID_LOG_LEVELS,
    ].join(', ')}.`
  );
}

const REDACTION_CENSOR = '[REDACTED]';

const redactPaths = [
  // HTTP request headers.
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["proxy-authorization"]',

  // Generic headers.
  'headers.authorization',
  'headers.cookie',
  'headers["set-cookie"]',
  'headers["x-api-key"]',
  'headers["proxy-authorization"]',

  // Authentication and account credentials.
  'password',
  '*.password',
  'currentPassword',
  '*.currentPassword',
  'newPassword',
  '*.newPassword',
  'confirmPassword',
  '*.confirmPassword',
  'oldPassword',
  '*.oldPassword',
  'passwordHash',
  '*.passwordHash',
  'password_hash',
  '*.password_hash',

  // Authentication tokens and secrets.
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'idToken',
  '*.idToken',
  'resetToken',
  '*.resetToken',
  'verificationToken',
  '*.verificationToken',
  'otp',
  '*.otp',
  'secret',
  '*.secret',
  'sessionSecret',
  '*.sessionSecret',
  'clientSecret',
  '*.clientSecret',
  'apiKey',
  '*.apiKey',
  'api_key',
  '*.api_key',
  'authorization',
  '*.authorization',

  // Database, SMTP, and application secrets.
  'DB_PASSWORD',
  'SMTP_PASSWORD',
  'SESSION_SECRET',
  'DATABASE_URL',
  'databaseUrl',
  '*.databaseUrl',
  'smtpPassword',
  '*.smtpPassword',
  'privateKey',
  '*.privateKey',
  'signingKey',
  '*.signingKey',
  'encryptionKey',
  '*.encryptionKey',

  // Personal and financial data.
  'creditCard',
  '*.creditCard',
  'cardNumber',
  '*.cardNumber',
  'cvv',
  '*.cvv',
  'ssn',
  '*.ssn',
  'aadhaar',
  '*.aadhaar',
  'aadhaarNumber',
  '*.aadhaarNumber',
  'passportNumber',
  '*.passportNumber',
  'accessCode',
  '*.accessCode',
];

const options = {
  level: configuredLevel,

  base: {
    service: 'medorbits',
    environment: env.NODE_ENV,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: redactPaths,
    censor: REDACTION_CENSOR,
  },

  // Do not automatically serialize arbitrary request/response objects.
  // Add explicit, reviewed serializers when request-level logging is needed.
};

function createDestination() {
  if (env.LOG_TO_FILE !== true) {
    return undefined;
  }

  if (
    typeof env.LOG_DIRECTORY !== 'string' ||
    env.LOG_DIRECTORY.trim() === ''
  ) {
    throw new Error(
      'LOG_DIRECTORY must be configured when LOG_TO_FILE=true.'
    );
  }

  const logDirectory = path.resolve(
    process.cwd(),
    env.LOG_DIRECTORY.trim()
  );

  fs.mkdirSync(logDirectory, {
    recursive: true,
    mode: 0o750,
  });

  // Refuse a symbolic-link directory to avoid redirecting log output.
  const directoryStats = fs.lstatSync(logDirectory);

  if (
    directoryStats.isSymbolicLink() ||
    !directoryStats.isDirectory()
  ) {
    throw new Error(
      'LOG_DIRECTORY must resolve to a real directory, not a symbolic link.'
    );
  }

  const logFile = path.join(
    logDirectory,
    'application.log'
  );

  let fileDescriptor;

  try {
    // O_NOFOLLOW is available on supported POSIX platforms.
    // O_CREAT | O_APPEND avoids truncating existing logs.
    const flags =
      fs.constants.O_WRONLY |
      fs.constants.O_APPEND |
      fs.constants.O_CREAT |
      (fs.constants.O_NOFOLLOW || 0);

    fileDescriptor = fs.openSync(logFile, flags, 0o600);

    const fileStats = fs.fstatSync(fileDescriptor);

    if (!fileStats.isFile()) {
      throw new Error(
        'The configured application log path must be a regular file.'
      );
    }

    // Restrict permissions on existing files too, where permitted.
    fs.fchmodSync(fileDescriptor, 0o600);

    const destination = pino.destination({
      dest: fileDescriptor,
      append: true,
      sync: false,
    });

    fileDescriptor = undefined;

    return destination;
  } catch (error) {
    if (fileDescriptor !== undefined) {
      try {
        fs.closeSync(fileDescriptor);
      } catch {
        // Preserve the original initialization error.
      }
    }

    throw error;
  }
}

const destination = createDestination();

const logger = pino(options, destination);

module.exports = logger;
