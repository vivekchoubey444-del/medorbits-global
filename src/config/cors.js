
/**
 * MedOrbits -- Centralized CORS Security Configuration
 * File: src/config/cors.js
 *
 * Node.js: >=20
 * Module system: ES Modules
 *
 * Responsibilities:
 * - Validate and normalize configured origins.
 * - Enforce an explicit origin allowlist.
 * - Prevent wildcard origins in production.
 * - Enforce safe credential and origin combinations.
 * - Validate preflight methods and request headers.
 * - Support configurable preflight caching.
 * - Reject malformed or unauthorized browser origins.
 * - Provide reusable configuration and validation helpers.
 *
 * Environment variables:
 * - CORS_ALLOWED_ORIGINS: comma-separated origins or an array.
 * - CORS_ALLOW_CREDENTIALS: boolean.
 * - CORS_MAX_AGE_SECONDS: non-negative integer.
 * - NODE_ENV: development, test, or production.
 *
 * Security note:
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
  "X-CSRF-Token",
]);

const EXPOSED_HEADERS = Object.freeze([
  "X-Request-ID",
  "Content-Disposition",
]);

const DEFAULT_MAX_AGE_SECONDS = 600;
const MAX_MAX_AGE_SECONDS = 86400;

function configurationError(message) {
  return new Error(`[MedOrbits CORS] ${message}`);
}

/**
 * Normalize an origin into its canonical URL origin.
 *
 * Accepted:
 *   https://medorbits.in
 *   https://www.medorbits.in
 *   http://localhost:3000
 *
 * Rejected:
 *   https://medorbits.in/dashboard
 *   https://user:password@medorbits.in
 *   javascript://example.com
 *   malformed URLs
 *
 * An empty string is returned only for an empty configuration entry.
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

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    throw configurationError(
      `Invalid origin "${input}". Expected an absolute HTTP or HTTPS origin.`,
    );
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw configurationError(
      `Origin "${input}" must use HTTP or HTTPS.`,
    );
  }

  if (!parsed.hostname) {
    throw configurationError(
      `Origin "${input}" must contain a hostname.`,
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
      `Origin "${input}" must not contain credentials, paths, queries, or fragments.`,
    );
  }

  return parsed.origin;
}

/**
 * Parse and deduplicate configured origins.
 *
 * Empty configuration is permitted outside production.
 * Production requirements are enforced separately.
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
 * Validate the security-sensitive CORS settings.
 *
 * Returns true if the supplied configuration is valid.
 * Throws an Error when a setting is unsafe or invalid.
 */
export function validateConfiguration(
  origins,
  settings = env,
) {
  if (!Array.isArray(origins)) {
    throw configurationError(
      "The allowed origins must be an array.",
    );
  }

  if (typeof settings.CORS_ALLOW_CREDENTIALS !== "boolean") {
    throw configurationError(
      "CORS_ALLOW_CREDENTIALS must be a boolean in src/config/env.js.",
    );
  }

  const normalizedOrigins = origins.map(normalizeOrigin);

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
 * Resolve and validate the origin allowlist at startup.
 *
 * Invalid configuration fails application startup rather than
 * silently weakening the cross-origin policy.
 */
export const allowedOrigins = Object.freeze(
  parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
);

validateConfiguration(allowedOrigins, env);

/**
 * Build the CORS options consumed by the cors middleware.
 *
 * Requests without an Origin header are allowed through the CORS
 * middleware for server-to-server, CLI, and same-origin use cases.
 * These requests must still pass normal authentication and authorization.
 */
export const corsOptions = Object.freeze({
  origin(origin, callback) {
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
  },

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
 * Mount before application routes so normal requests and preflight
 * OPTIONS requests receive consistent CORS handling.
 */
export const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
