
/**
 * MedOrbits -- Central Environment Configuration
 *
 * File: src/config/env.js
 * Runtime: Node.js >=20
 * Module system: ES Modules
 *
 * Dependency:
 *   npm install dotenv
 *
 * Responsibilities:
 * - Load .env when available through dotenv.
 * - Parse and validate configuration at startup.
 * - Apply explicit defaults and bounded numeric settings.
 * - Export an immutable central configuration object.
 * - Preserve passwords exactly as configured.
 * - Validate runtime, HTTP, CORS, MySQL, and SMTP settings.
 *
 * Security:
 * - Never log secrets.
 * - Never expose this object through public API endpoints.
 * - Keep .env files out of version control.
 * - Store production secrets in the deployment secrets manager.
 */

import "dotenv/config";

const ALLOWED_ENVIRONMENTS = new Set([
  "development",
  "test",
  "staging",
  "production",
]);

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const HEADER_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

/**
 * Throw a configuration error without including secret values.
 */
function configurationError(message) {
  return new Error(`[MedOrbits Config] ${message}`);
}

/**
 * Read and validate NODE_ENV before other settings.
 */
function readNodeEnvironment() {
  const raw = process.env.NODE_ENV;

  if (raw === undefined || raw.trim() === "") {
    return "development";
  }

  const value = raw.trim();

  if (!ALLOWED_ENVIRONMENTS.has(value)) {
    throw configurationError(
      `NODE_ENV must be one of: ${[...ALLOWED_ENVIRONMENTS].join(", ")}.`,
    );
  }

  return value;
}

const NODE_ENV = readNodeEnvironment();

/**
 * Parse a bounded integer environment variable.
 */
function parseInteger(name, fallback, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const normalized = raw.trim();

  if (!/^\d+$/u.test(normalized)) {
    throw configurationError(`${name} must be an integer.`);
  }

  const value = Number(normalized);

  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw configurationError(
      `${name} must be between ${min} and ${max}.`,
    );
  }

  return value;
}

/**
 * Parse an explicit boolean.
 *
 * Accepted values: true, false, case-insensitive.
 */
function parseBoolean(name, fallback) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  switch (raw.trim().toLowerCase()) {
    case "true":
      return true;

    case "false":
      return false;

    default:
      throw configurationError(
        `${name} must be "true" or "false".`,
      );
  }
}

/**
 * Read a non-secret string and trim surrounding whitespace.
 */
function parseString(name, fallback = "") {
  const raw = process.env[name];

  if (raw === undefined) {
    return fallback;
  }

  return raw.trim();
}

/**
 * Read a secret without trimming it.
 *
 * Whitespace may be significant in passwords and other credentials.
 */
function parseSecret(name, fallback = "") {
  const raw = process.env[name];

  if (raw === undefined) {
    return fallback;
  }

  if (typeof raw !== "string") {
    throw configurationError(`${name} must be a string.`);
  }

  if (CONTROL_CHARACTERS.test(raw)) {
    throw configurationError(
      `${name} must not contain control characters.`,
    );
  }

  return raw;
}

/**
 * Parse comma-separated configuration values.
 */
function parseCsv(name, fallback = "") {
  return [
    ...new Set(
      parseString(name, fallback)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Validate the API prefix.
 *
 * This is a URL path prefix, not a full URL.
 */
function normalizeApiPrefix(value) {
  const prefix = value.trim();

  if (
    !prefix.startsWith("/") ||
    prefix === "/" ||
    prefix.includes("?") ||
    prefix.includes("#") ||
    prefix.includes("\\") ||
    prefix.includes("%") ||
    CONTROL_CHARACTERS.test(prefix) ||
    /\s/u.test(prefix) ||
    prefix.split("/").some(
      (segment) => segment === "." || segment === "..",
    )
  ) {
    throw configurationError(
      "API_PREFIX must be a valid absolute API path prefix, such as /api/v1.",
    );
  }

  const normalized = prefix.replace(/\/+$/u, "");

  if (!normalized) {
    throw configurationError(
      "API_PREFIX must not resolve to the root path.",
    );
  }

  return normalized;
}

/**
 * Validate a hostname or IP-address setting.
 *
 * This does not resolve DNS or verify network reachability.
 */
function validateHost(value, name = "HOST") {
  const host = value.trim();

  if (
    !host ||
    /[\u0000-\u0020\u007f/?#@\\]/u.test(host)
  ) {
    throw configurationError(
      `${name} must be a hostname or IP address, not a URL.`,
    );
  }

  return host;
}

/**
 * Normalize an HTTP(S) origin.
 *
 * Origin entries must not contain credentials, paths, queries,
 * fragments, whitespace, or control characters.
 */
function normalizeOrigin(value) {
  if (value === "*") {
    return "*";
  }

  if (
    typeof value !== "string" ||
    !value ||
    /[\u0000-\u0020\u007f]/u.test(value)
  ) {
    throw configurationError(
      "CORS_ALLOWED_ORIGINS contains an empty or malformed origin.",
    );
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw configurationError(
      "CORS_ALLOWED_ORIGINS contains an invalid URL origin.",
    );
  }

  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw configurationError(
      "CORS_ALLOWED_ORIGINS entries must be HTTP(S) origins without credentials, paths, queries, or fragments.",
    );
  }

  return parsed.origin;
}

/**
 * Validate the configured origin list.
 */
function validateOriginList(origins) {
  const normalized = origins.map(normalizeOrigin);
  const unique = [...new Set(normalized)];

  if (
    normalized.includes("*") &&
    normalized.length > 1
  ) {
    throw configurationError(
      "Do not combine a wildcard CORS origin with individual origins.",
    );
  }

  if (
    NODE_ENV === "production" &&
    unique.length === 0
  ) {
    throw configurationError(
      "CORS_ALLOWED_ORIGINS must contain at least one origin in production.",
    );
  }

  if (
    NODE_ENV === "production" &&
    unique.includes("*")
  ) {
    throw configurationError(
      "Wildcard CORS origins are prohibited in production.",
    );
  }

  return unique;
}

/**
 * Validate an SMTP hostname without DNS lookup.
 */
function validateSmtpHost(value) {
  const host = value.trim();

  if (
    !host ||
    /[\u0000-\u0020\u007f/@\\?#]/u.test(host)
  ) {
    throw configurationError(
      "SMTP_HOST must be a hostname or IP address without a scheme or path.",
    );
  }

  return host;
}

/**
 * Validate text used in email headers.
 */
function validateHeaderText(value, name, maxLength) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    HEADER_CONTROL_CHARACTERS.test(value)
  ) {
    throw configurationError(
      `${name} must not exceed ${maxLength} characters or contain control characters.`,
    );
  }

  return value;
}

// ---------------------------------------------------------------------
// HTTP server configuration
// ---------------------------------------------------------------------

const PORT = parseInteger("PORT", 3000, 1, 65535);

const HOST = validateHost(
  parseString("HOST", "0.0.0.0"),
);

const API_PREFIX = normalizeApiPrefix(
  parseString("API_PREFIX", "/api/v1"),
);

// ---------------------------------------------------------------------
// CORS configuration
// ---------------------------------------------------------------------

const CORS_ALLOWED_ORIGINS = Object.freeze(
  validateOriginList(
    parseCsv("CORS_ALLOWED_ORIGINS"),
  ),
);

const CORS_ALLOW_CREDENTIALS = parseBoolean(
  "CORS_ALLOW_CREDENTIALS",
  false,
);

const CORS_MAX_AGE_SECONDS = parseInteger(
  "CORS_MAX_AGE_SECONDS",
  600,
  0,
  86400,
);

if (
  CORS_ALLOW_CREDENTIALS &&
  CORS_ALLOWED_ORIGINS.includes("*")
) {
  throw configurationError(
    "Wildcard CORS origins cannot be used with credentials.",
  );
}

// ---------------------------------------------------------------------
// MySQL database configuration
// ---------------------------------------------------------------------

const DB_CHECK_ON_START = parseBoolean(
  "DB_CHECK_ON_START",
  true,
);

const DB_HOST = validateHost(
  parseString("DB_HOST", ""),
  "DB_HOST",
);

const DB_PORT = parseInteger(
  "DB_PORT",
  3306,
  1,
  65535,
);

const DB_NAME = parseString("DB_NAME");
const DB_USER = parseString("DB_USER");
const DB_PASSWORD = parseSecret("DB_PASSWORD");

const DB_CONNECTION_LIMIT = parseInteger(
  "DB_CONNECTION_LIMIT",
  10,
  1,
  100,
);

const DB_CONNECT_TIMEOUT_MS = parseInteger(
  "DB_CONNECT_TIMEOUT_MS",
  10000,
  1000,
  120000,
);

if (DB_CHECK_ON_START) {
  const requiredDatabaseSettings = [
    ["DB_HOST", DB_HOST],
    ["DB_NAME", DB_NAME],
    ["DB_USER", DB_USER],
    ["DB_PASSWORD", DB_PASSWORD],
  ];

  const missing = requiredDatabaseSettings
    .filter(([, value]) => !value.trim())
    .map(([name]) => name);

  if (missing.length > 0) {
    throw configurationError(
      "DB_CHECK_ON_START is enabled but required database settings are missing: " +
        missing.join(", ") +
        ".",
    );
  }
}

// ---------------------------------------------------------------------
// SMTP email configuration
// ---------------------------------------------------------------------

const EMAIL_ENABLED = parseBoolean(
  "EMAIL_ENABLED",
  false,
);

const SMTP_HOST = parseString("SMTP_HOST");
const SMTP_PORT = parseInteger(
  "SMTP_PORT",
  587,
  1,
  65535,
);

const SMTP_SECURE = parseBoolean(
  "SMTP_SECURE",
  false,
);

const SMTP_USER = parseString("SMTP_USER");
const SMTP_PASSWORD = parseSecret("SMTP_PASSWORD");

const EMAIL_FROM_NAME = validateHeaderText(
  parseString("EMAIL_FROM_NAME", "MedOrbits"),
  "EMAIL_FROM_NAME",
  100,
);

const EMAIL_FROM_ADDRESS = parseString(
  "EMAIL_FROM_ADDRESS",
);

const EMAIL_REPLY_TO = parseString(
  "EMAIL_REPLY_TO",
);

const EMAIL_SEND_TIMEOUT_MS = parseInteger(
  "EMAIL_SEND_TIMEOUT_MS",
  10000,
  1000,
  120000,
);

if (EMAIL_ENABLED) {
  const requiredEmailSettings = [
    ["SMTP_HOST", SMTP_HOST],
    ["SMTP_USER", SMTP_USER],
    ["SMTP_PASSWORD", SMTP_PASSWORD],
    ["EMAIL_FROM_ADDRESS", EMAIL_FROM_ADDRESS],
  ];

  const missing = requiredEmailSettings
    .filter(([, value]) => !value.trim())
    .map(([name]) => name);

  if (missing.length > 0) {
    throw configurationError(
      "Email is enabled but required settings are missing: " +
        missing.join(", ") +
        ".",
    );
  }

  validateSmtpHost(SMTP_HOST);
}

// ---------------------------------------------------------------------
// Immutable exported configuration
// ---------------------------------------------------------------------

export const env = Object.freeze({
  NODE_ENV,

  IS_PRODUCTION: NODE_ENV === "production",
  IS_DEVELOPMENT: NODE_ENV === "development",
  IS_TEST: NODE_ENV === "test",
  IS_STAGING: NODE_ENV === "staging",

  PORT,
  HOST,
  API_PREFIX,

  CORS_ALLOWED_ORIGINS,
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

export default env;
