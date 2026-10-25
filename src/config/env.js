
/**
 * MedOrbits -- Central Environment Configuration
 * File: src/config/env.js
 *
 * Node.js: >=20
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Load environment variables from .env when available.
 * - Parse and validate configuration at startup.
 * - Apply explicit, documented defaults.
 * - Fail fast when configuration is invalid.
 * - Export a centralized immutable configuration object.
 *
 * Configuration domains:
 * - Runtime and HTTP server
 * - API routing
 * - CORS
 * - MySQL
 * - SMTP email
 *
 * Security:
 * - Never log secrets.
 * - Preserve passwords exactly as configured.
 * - Do not expose the complete env object through public endpoints.
 * - Keep .env files out of version control.
 */

import "dotenv/config";

const ALLOWED_ENVIRONMENTS = new Set([
  "development",
  "test",
  "staging",
  "production",
]);

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * Read NODE_ENV before parsing environment-dependent settings.
 */
const NODE_ENV = (
  process.env.NODE_ENV === undefined
    ? "development"
    : process.env.NODE_ENV
).trim();

if (!ALLOWED_ENVIRONMENTS.has(NODE_ENV)) {
  throw new Error(
    `NODE_ENV must be one of: ${[...ALLOWED_ENVIRONMENTS].join(", ")}.`,
  );
}

/**
 * Parse a bounded integer.
 */
function parseInteger(name, fallback, min, max) {
  const raw = process.env[name];

  if (raw === undefined || raw.trim() === "") {
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
      `${name} must be between ${min} and ${max}.`,
    );
  }

  return value;
}

/**
 * Parse an explicit boolean.
 *
 * Accepted values: true, false (case-insensitive).
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
      throw new Error(
        `${name} must be "true" or "false".`,
      );
  }
}

/**
 * Read a non-secret string setting.
 *
 * Secret values should be read separately so they are not accidentally
 * modified by trimming.
 */
function parseString(name, fallback = "") {
  const raw = process.env[name];

  if (raw === undefined) {
    return fallback;
  }

  return raw.trim();
}

/**
 * Parse comma-separated values and remove duplicates.
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
 * Validate and normalize the API path prefix.
 */
function normalizeApiPrefix(value) {
  const prefix = value.trim();

  if (!prefix.startsWith("/")) {
    throw new Error(
      'API_PREFIX must start with "/".',
    );
  }

  if (
    prefix === "/" ||
    prefix.includes("?") ||
    prefix.includes("#") ||
    prefix.includes("\\") ||
    prefix.includes("%") ||
    prefix.split("/").some(
      (segment) => segment === "." || segment === "..",
    ) ||
    CONTROL_CHARACTERS.test(prefix)
  ) {
    throw new Error(
      "API_PREFIX is not a valid API path prefix.",
    );
  }

  const normalized = prefix.replace(/\/+$/, "");

  if (!normalized) {
    throw new Error(
      "API_PREFIX must not resolve to the root path.",
    );
  }

  return normalized;
}

/**
 * Validate a server hostname or IP-address setting.
 *
 * This rejects URL schemes, paths, credentials, whitespace, and
 * control characters. It deliberately does not resolve DNS at startup.
 */
function validateHost(value, name = "HOST") {
  const host = value.trim();

  if (
    !host ||
    /[\u0000-\u0020\u007F]/.test(host) ||
    /[/?#@\\]/.test(host)
  ) {
    throw new Error(
      `${name} must be a hostname or IP address, not a URL.`,
    );
  }

  return host;
}

/**
 * Validate and normalize an HTTP(S) origin.
 *
 * Origin entries must not contain credentials, non-root paths,
 * query strings, or fragments.
 */
function normalizeOrigin(value) {
  if (value === "*") {
    return "*";
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `CORS_ALLOWED_ORIGINS contains an invalid origin: "${value}".`,
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
    throw new Error(
      "CORS_ALLOWED_ORIGINS entries must be HTTP(S) origins without credentials, paths, queries, or fragments.",
    );
  }

  return parsed.origin;
}

function validateOriginList(origins) {
  const normalized = origins.map(normalizeOrigin);

  if (
    normalized.includes("*") &&
    normalized.length > 1
  ) {
    throw new Error(
      "Do not combine a wildcard CORS origin with individual origins.",
    );
  }

  if (
    NODE_ENV === "production" &&
    normalized.length === 0
  ) {
    throw new Error(
      "CORS_ALLOWED_ORIGINS must contain at least one origin in production.",
    );
  }

  if (
    NODE_ENV === "production" &&
    normalized.includes("*")
  ) {
    throw new Error(
      "Wildcard CORS origins are not permitted in production.",
    );
  }

  return [...new Set(normalized)];
}

/**
 * Validate an SMTP hostname.
 */
function validateSmtpHost(value) {
  const host = value.trim();

  if (
    !host ||
    /[\u0000-\u0020\u007F/@\\?#]/.test(host)
  ) {
    throw new Error(
      "SMTP_HOST must be a hostname or IP address without a scheme or path.",
    );
  }

  return host;
}

/**
 * Validate display names and other header text.
 */
function validateHeaderText(value, name, maxLength) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    CONTROL_CHARACTERS.test(value)
  ) {
    throw new Error(
      `${name} must not exceed ${maxLength} characters or contain control characters.`,
    );
  }

  return value;
}

// ---------------------------------------------------------------------
// HTTP server configuration
// ---------------------------------------------------------------------

const PORT = parseInteger(
  "PORT",
  3000,
  1,
  65535,
);

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
  throw new Error(
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
  parseString("DB_HOST"),
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

// Preserve secret values exactly. Do not trim passwords.
const DB_PASSWORD = process.env.DB_PASSWORD ?? "";

if (
  CONTROL_CHARACTERS.test(DB_PASSWORD)
) {
  throw new Error(
    "DB_PASSWORD must not contain control characters.",
  );
}

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
    throw new Error(
      "DB_CHECK_ON_START is enabled but database settings are missing: " +
        missing.join(", ") +
        ".",
    );
  }
}

// ---------------------------------------------------------------------
// Email and SMTP configuration
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

// Preserve SMTP password exactly as configured.
const SMTP_PASSWORD = process.env.SMTP_PASSWORD ?? "";

if (
  CONTROL_CHARACTERS.test(SMTP_PASSWORD)
) {
  throw new Error(
    "SMTP_PASSWORD must not contain control characters.",
  );
}

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
    throw new Error(
      "Email is enabled but required settings are missing: " +
        missing.join(", ") +
        ".",
    );
  }

  validateSmtpHost(SMTP_HOST);
}

// ---------------------------------------------------------------------
// Central immutable configuration
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
