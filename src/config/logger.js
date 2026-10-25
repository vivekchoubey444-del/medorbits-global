
/**
 * MedOrbits -- Structured Application Logger
 * File: src/config/logger.js
 *
 * Node.js: >=20
 * Module system: ES Modules
 *
 * Dependency:
 * - pino
 *
 * Features:
 * - Structured JSON logging.
 * - Environment-aware log levels.
 * - Sensitive-field redaction.
 * - Optional append-only file output.
 * - Restricted log-file permissions.
 * - Safe initialization and resource cleanup.
 * - Explicit flush support for graceful shutdown.
 *
 * Important:
 * - This module does not implement log rotation.
 * - Do not log raw request bodies, credentials, access tokens,
 *   database connection strings, or email message content.
 * - File rotation, retention, shipping, and monitoring should be
 *   handled by an approved operational logging system.
 */

import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { env } from "./env.js";

const VALID_LOG_LEVELS = new Set([
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
]);

const REDACTION_CENSOR = "[REDACTED]";
const DEFAULT_LOG_LEVEL = "info";
const LOG_FILE_NAME = "application.log";

const configuredLevel =
  typeof env.LOG_LEVEL === "string" && env.LOG_LEVEL.trim()
    ? env.LOG_LEVEL.trim().toLowerCase()
    : DEFAULT_LOG_LEVEL;

if (!VALID_LOG_LEVELS.has(configuredLevel)) {
  throw new Error(
    `Invalid LOG_LEVEL "${configuredLevel}". Allowed values: ${[
      ...VALID_LOG_LEVELS,
    ].join(", ")}.`,
  );
}

/**
 * Sensitive field paths understood by Pino's redaction mechanism.
 *
 * Add reviewed paths here when application-specific payloads introduce
 * additional sensitive field names.
 */
const redactPaths = [
  // HTTP request headers.
  "req.headers.authorization",
  'req.headers["proxy-authorization"]',
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',

  // Generic headers.
  "headers.authorization",
  'headers["proxy-authorization"]',
  "headers.cookie",
  'headers["set-cookie"]',
  'headers["x-api-key"]',
  'headers["x-auth-token"]',

  // Credentials and passwords.
  "password",
  "*.password",
  "currentPassword",
  "*.currentPassword",
  "newPassword",
  "*.newPassword",
  "confirmPassword",
  "*.confirmPassword",
  "oldPassword",
  "*.oldPassword",
  "passwordHash",
  "*.passwordHash",
  "password_hash",
  "*.password_hash",
  "passwd",
  "*.passwd",

  // Tokens and authentication.
  "token",
  "*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "idToken",
  "*.idToken",
  "resetToken",
  "*.resetToken",
  "verificationToken",
  "*.verificationToken",
  "csrfToken",
  "*.csrfToken",
  "sessionToken",
  "*.sessionToken",
  "otp",
  "*.otp",
  "authorization",
  "*.authorization",

  // Secrets and keys.
  "secret",
  "*.secret",
  "sessionSecret",
  "*.sessionSecret",
  "clientSecret",
  "*.clientSecret",
  "apiKey",
  "*.apiKey",
  "api_key",
  "*.api_key",
  "privateKey",
  "*.privateKey",
  "signingKey",
  "*.signingKey",
  "encryptionKey",
  "*.encryptionKey",
  "webhookSecret",
  "*.webhookSecret",

  // Environment and connection secrets.
  "DB_PASSWORD",
  "SMTP_PASSWORD",
  "SESSION_SECRET",
  "DATABASE_URL",
  "databaseUrl",
  "*.databaseUrl",
  "smtpPassword",
  "*.smtpPassword",
  "dbPassword",
  "*.dbPassword",
  "connectionString",
  "*.connectionString",
  "connection_string",
  "*.connection_string",

  // Personal and financial information.
  "creditCard",
  "*.creditCard",
  "cardNumber",
  "*.cardNumber",
  "cvv",
  "*.cvv",
  "ssn",
  "*.ssn",
  "aadhaar",
  "*.aadhaar",
  "aadhaarNumber",
  "*.aadhaarNumber",
  "passportNumber",
  "*.passportNumber",
  "accessCode",
  "*.accessCode",
];

const options = {
  level: configuredLevel,

  base: {
    service: "medorbits",
    environment: env.NODE_ENV,
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  redact: {
    paths: redactPaths,
    censor: REDACTION_CENSOR,
  },

  /*
   * Do not automatically serialize arbitrary request/response objects.
   * Use reviewed serializers or explicitly selected safe fields when
   * request-level logging is required.
   */
};

/**
 * Create the optional file destination.
 *
 * The configured directory must be a real directory at the final path
 * component. The log file is opened in append mode with restrictive
 * permissions and without following a final-component symlink where
 * the operating system supports O_NOFOLLOW.
 *
 * Parent directories may still be symlinks; use a trusted log root
 * with appropriate operating-system permissions in production.
 */
function createDestination() {
  if (env.LOG_TO_FILE !== true) {
    return undefined;
  }

  if (
    typeof env.LOG_DIRECTORY !== "string" ||
    env.LOG_DIRECTORY.trim() === ""
  ) {
    throw new Error(
      "LOG_DIRECTORY must be configured when LOG_TO_FILE=true.",
    );
  }

  const logDirectory = path.resolve(
    process.cwd(),
    env.LOG_DIRECTORY.trim(),
  );

  fs.mkdirSync(logDirectory, {
    recursive: true,
    mode: 0o750,
  });

  const directoryStats = fs.lstatSync(logDirectory);

  if (
    directoryStats.isSymbolicLink() ||
    !directoryStats.isDirectory()
  ) {
    throw new Error(
      "LOG_DIRECTORY must resolve to a real directory, not a symbolic link.",
    );
  }

  const logFile = path.join(
    logDirectory,
    LOG_FILE_NAME,
  );

  let fileDescriptor;

  try {
    const flags =
      fs.constants.O_WRONLY |
      fs.constants.O_APPEND |
      fs.constants.O_CREAT |
      (fs.constants.O_NOFOLLOW || 0);

    fileDescriptor = fs.openSync(
      logFile,
      flags,
      0o600,
    );

    const fileStats = fs.fstatSync(fileDescriptor);

    if (!fileStats.isFile()) {
      throw new Error(
        "The configured log path must be a regular file.",
      );
    }

    // Apply restrictive permissions to existing files where supported.
    fs.fchmodSync(fileDescriptor, 0o600);

    const destination = pino.destination({
      dest: fileDescriptor,
      append: true,
      sync: false,
    });

    /*
     * Ownership of the descriptor is transferred to the destination.
     * Do not close it here after successful initialization.
     */
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

/**
 * Flush buffered log output.
 *
 * Resolve when the configured destination reports that buffered data
 * has been flushed. This does not implement rotation or remote delivery.
 */
export function flushLogs() {
  if (!destination) {
    return new Promise((resolve, reject) => {
      logger.flush((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  return new Promise((resolve, reject) => {
    destination.flush((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * End the file destination after flushing pending log entries.
 *
 * Call this only during application shutdown, after normal logging
 * has stopped. Do not use it for ordinary request processing.
 */
export async function closeLogger() {
  if (!destination) {
    await flushLogs();
    return;
  }

  await new Promise((resolve, reject) => {
    destination.flush((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await new Promise((resolve, reject) => {
    destination.end((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export { logger };

export default logger;
