
/**
 * MedOrbits -- Centralized CORS Security Configuration
 *
 * File: src/config/cors.js
 * Runtime: Node.js >=20
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Validate and normalize configured HTTP(S) origins.
 * - Enforce an explicit origin allowlist.
 * - Prohibit wildcard origins in production.
 * - Prevent wildcard origins with credentialed requests.
 * - Validate preflight methods and request headers.
 * - Configure bounded preflight caching.
 * - Reject malformed or unauthorized browser origins.
 * - Fail startup on invalid security configuration.
 * - Export reusable configuration and validation helpers.
 *
 * Environment variables:
 * - CORS_ALLOWED_ORIGINS: comma-separated string or string array.
 * - CORS_ALLOW_CREDENTIALS: boolean.
 * - CORS_MAX_AGE_SECONDS: integer from 0 through 86400.
 * - NODE_ENV: development, test, or production.
 *
 * Security boundary:
 * CORS is a browser-enforced access policy. It is not authentication,
 * authorization, CSRF protection, or a firewall for non-browser clients.
 */

import cors from "cors";
import { env } from "./env.js";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const ALLOWED_METHODS = Object.freeze([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

const ALLOWED_HEADERS = Object.freeze([
  "Accept",
  "Authorization",
  "Content-Type",
  "Origin",
  "X-Request-ID",
  "X-Correlation-ID",
  "X-CSRF-Token",
]);

const EXPOSED_HEADERS = Object.freeze([
  "X-Request-ID",
  "X-Correlation-ID",
  "Content-Disposition",
]);

const DEFAULT_MAX_AGE_SECONDS = 600;
const MAX_MAX_AGE_SECONDS = 86400;

function configurationError(message) {
  return new Error(`[MedOrbits CORS] ${message}`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Normalize an origin into its canonical URL origin.
 *
 * Accepted examples:
 *   https://medorbits.in
 *   https://www.medorbits.in
 *   http://localhost:3000
 *
 * Rejected examples:
 *   https://medorbits.in/dashboard
 *   https://user:password@medorbits.in
 *   javascript://example.com
 *   malformed URLs
 *
 * Empty strings are returned only for empty configuration entries.
 * A wildcard is preserved for separate policy validation.
 */
export function normalizeOrigin(value) {
  if (typeof value !== "string") {
    throw new TypeError("CORS origins must be strings.");
  }

  const input = value.trim();

  if (!input) {
    return "";
  }

  if (input === "*") {
    return "*";
  }

  // Reject whitespace and control characters instead of silently
  // normalizing potentially malformed header/configuration values.
  if (/[\u0000-\u0020\u007f]/u.test(input)) {
    throw configurationError(
      "An origin contains whitespace or control characters.",
    );
  }

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    throw configurationError(
      "An origin must be an absolute HTTP or HTTPS URL.",
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw configurationError(
      "An origin must use HTTP or HTTPS.",
    );
  }

  if (!parsed.hostname) {
    throw configurationError(
      "An origin must contain a hostname.",
    );
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw configurationError(
      "An origin must not contain credentials, paths, queries, or fragments.",
    );
  }

  return parsed.origin;
}

/**
 * Parse and deduplicate configured origins.
 *
 * Empty configuration is permitted outside production.
 * Production requirements are enforced by validateConfiguration().
 */
export function parseAllowedOrigins(value) {
  let entries;

  if (typeof value === "string") {
    entries = value.split(",");
  } else if (Array.isArray(value)) {
    entries = value;
  } else {
    throw configurationError(
      "CORS_ALLOWED_ORIGINS must be a string or an array of strings.",
    );
  }

  const origins = [];

  for (const entry of entries) {
    if (typeof entry !== "string") {
      throw configurationError(
        "Every CORS_ALLOWED_ORIGINS entry must be a string.",
      );
    }

    const normalized = normalizeOrigin(entry);

    if (normalized) {
      origins.push(normalized);
    }
  }

  const uniqueOrigins = [...new Set(origins)];

  if (
    uniqueOrigins.includes("*") &&
    uniqueOrigins.length > 1
  ) {
    throw configurationError(
      "Do not combine a wildcard origin with individual origins.",
    );
  }

  return uniqueOrigins;
}

/**
 * Validate CORS configuration.
 *
 * Returns true when valid. Throws when a security-sensitive setting
 * is invalid or inconsistent.
 */
export function validateConfiguration(origins, settings = env) {
  if (!Array.isArray(origins)) {
    throw configurationError(
      "The allowed origins must be an array.",
    );
  }

  if (!isPlainObject(settings)) {
    throw configurationError(
      "CORS settings must be supplied as a plain object.",
    );
  }

  if (typeof settings.CORS_ALLOW_CREDENTIALS !== "boolean") {
    throw configurationError(
      "CORS_ALLOW_CREDENTIALS must be a boolean in src/config/env.js.",
    );
  }

  if (
    typeof settings.NODE_ENV !== "string" ||
    !["development", "test", "production"].includes(settings.NODE_ENV)
  ) {
    throw configurationError(
      "NODE_ENV must be development, test, or production.",
    );
  }

  const normalizedOrigins = origins.map((origin) => {
    if (typeof origin !== "string") {
      throw configurationError(
        "Every allowed origin must be a string.",
      );
    }

    return normalizeOrigin(origin);
  });

  if (normalizedOrigins.some((origin) => !origin)) {
    throw configurationError(
      "The allowed origins array must not contain empty entries.",
    );
  }

  if (new Set(normalizedOrigins).size !== normalizedOrigins.length) {
    throw configurationError(
      "The allowed origins array contains duplicate origins.",
    );
  }

  if (
    normalizedOrigins.includes("*") &&
    normalizedOrigins.length !== 1
  ) {
    throw configurationError(
      "A wildcard cannot be combined with individual origins.",
    );
  }

  const isProduction = settings.NODE_ENV === "production";
  const credentialsEnabled = settings.CORS_ALLOW_CREDENTIALS;

  if (isProduction && normalizedOrigins.length === 0) {
    throw configurationError(
      "Production requires at least one explicitly allowed origin.",
    );
  }

  if (isProduction && normalizedOrigins.includes("*")) {
    throw configurationError(
      "Wildcard CORS origins are prohibited in production.",
    );
  }

  if (credentialsEnabled && normalizedOrigins.includes("*")) {
    throw configurationError(
      "Credentialed CORS requests cannot use a wildcard origin.",
    );
  }

  const maxAge = settings.CORS_MAX_AGE_SECONDS;

  if (
    !Number.isSafeInteger(maxAge) ||
    maxAge < 0 ||
    maxAge > MAX_MAX_AGE_SECONDS
  ) {
    throw configurationError(
      `CORS_MAX_AGE_SECONDS must be an integer between 0 and ${MAX_MAX_AGE_SECONDS}.`,
    );
  }

  return true;
}

/**
 * Validate a requested preflight method.
 *
 * HTTP method names are case-sensitive in protocol semantics, but
 * browser-generated Access-Control-Request-Method values use the
 * standard uppercase method token.
 */
export function isAllowedMethod(method) {
  return (
    typeof method === "string" &&
    ALLOWED_METHODS.includes(method.trim().toUpperCase())
  );
}

/**
 * Validate requested preflight header names.
 *
 * Header names are case-insensitive. This helper is available for
 * custom preflight middleware and tests.
 */
export function areAllowedHeaders(headers) {
  if (headers == null || headers === "") {
    return true;
  }

  const requested = Array.isArray(headers)
    ? headers
    : typeof headers === "string"
      ? headers.split(",")
      : null;

  if (!requested) {
    return false;
  }

  const allowed = new Set(
    ALLOWED_HEADERS.map((header) => header.toLowerCase()),
  );

  return requested.every((header) => {
    if (typeof header !== "string") {
      return false;
    }

    const normalized = header.trim().toLowerCase();

    return (
      normalized.length > 0 &&
      /^[!#$%&'*+.^_`|~0-9a-z-]+$/u.test(normalized) &&
      allowed.has(normalized)
    );
  });
}

/**
 * Resolve and validate the origin allowlist at startup.
 *
 * Invalid production configuration fails startup rather than silently
 * weakening the cross-origin policy.
 */
export const allowedOrigins = Object.freeze(
  parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
);

validateConfiguration(allowedOrigins, env);

/**
 * Create the callback used by the cors package.
 *
 * Requests without Origin are allowed through the CORS middleware.
 * This does not authorize those requests; normal authentication,
 * authorization, and CSRF protections still apply.
 */
function validateRequestOrigin(origin, callback) {
  if (typeof origin !== "string" || origin.length === 0) {
    return callback(null, true);
  }

  let normalizedOrigin;

  try {
    normalizedOrigin = normalizeOrigin(origin);
  } catch {
    return callback(
      configurationError(
        "The request contains a malformed or unauthorized Origin header.",
      ),
    );
  }

  const permitted =
    allowedOrigins.includes("*") ||
    allowedOrigins.includes(normalizedOrigin);

  if (!permitted) {
    return callback(
      configurationError(
        "The request origin is not permitted by the CORS policy.",
      ),
    );
  }

  return callback(null, true);
}

/**
 * Frozen options for the cors package.
 *
 * Note: the cors package handles preflight requests using its configured
 * methods and headers. The exported validation helpers can also be used
 * by custom middleware when strict rejection of unapproved preflight
 * methods or headers is required.
 */
export const corsOptions = Object.freeze({
  origin: validateRequestOrigin,

  credentials: env.CORS_ALLOW_CREDENTIALS,

  methods: [...ALLOWED_METHODS],

  allowedHeaders: [...ALLOWED_HEADERS],

  exposedHeaders: [...EXPOSED_HEADERS],

  maxAge: env.CORS_MAX_AGE_SECONDS,

  optionsSuccessStatus: 204,

  preflightContinue: false,
});

/**
 * Reusable Express middleware.
 *
 * Mount before application routes.
 */
export const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
