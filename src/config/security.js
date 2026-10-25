
/**
 * MedOrbits -- HTTP Security Headers
 * File: src/config/security.js
 *
 * Responsibilities:
 * - Configure Helmet security headers.
 * - Apply configurable Content Security Policy (CSP).
 * - Enable HSTS in production.
 * - Validate configurable CSP sources.
 * - Provide safe browser resource-loading defaults.
 *
 * Dependency:
 *   npm install helmet
 *
 * Integration:
 * - ./env.js must export env.
 * - Use this middleware early in the Express middleware stack.
 *
 * IMPORTANT:
 * Test CSP against the actual frontend, API integrations, payment providers,
 * authentication flows, fonts, images, analytics, and external resources.
 */

import helmet from "helmet";
import { env } from "./env.js";

const IS_PRODUCTION = env.NODE_ENV === "production";

const DEFAULT_CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", "data:"],
  fontSrc: ["'self'", "data:"],
  connectSrc: ["'self'"],
  mediaSrc: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  frameSrc: ["'self'"],
});

const CONFIGURABLE_DIRECTIVES = Object.freeze({
  scriptSrc: "CSP_SCRIPT_SRC",
  styleSrc: "CSP_STYLE_SRC",
  imgSrc: "CSP_IMG_SRC",
  fontSrc: "CSP_FONT_SRC",
  connectSrc: "CSP_CONNECT_SRC",
  mediaSrc: "CSP_MEDIA_SRC",
  frameSrc: "CSP_FRAME_SRC",
});

const ALLOWED_CSP_KEYWORDS = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'strict-dynamic'",
  "'report-sample'",
  "'wasm-unsafe-eval'",
  "'unsafe-hashes'",
]);

const CSP_NONCE_PATTERN = /^'nonce-[A-Za-z0-9+/_=-]+'$/;
const CSP_HASH_PATTERN = /^'sha(?:256|384|512)-[A-Za-z0-9+/=]+'$/;
const CSP_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:$/;
const CSP_HOST_PATTERN =
  /^(?:\*\.)?(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?(?::\d{1,5})?(?:\/[^\s]*)?$/;

function isValidHostSource(source) {
  if (source.startsWith("https://") || source.startsWith("http://")) {
    try {
      const url = new URL(source);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        return false;
      }

      if (
        url.port &&
        (!Number.isInteger(Number(url.port)) ||
          Number(url.port) < 1 ||
          Number(url.port) > 65535)
      ) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // CSP host sources may include wildcard subdomains, ports, and paths.
  // This check intentionally does not accept arbitrary URI schemes.
  return CSP_HOST_PATTERN.test(source);
}

function validateSource(source, variableName) {
  if (typeof source !== "string" || source.length === 0) {
    throw new TypeError(`${variableName} contains an invalid CSP source.`);
  }

  if (/[\u0000-\u0020\u007F]/.test(source)) {
    throw new TypeError(
      `${variableName} CSP sources must not contain whitespace or control characters.`
    );
  }

  if (source === "*") {
    if (IS_PRODUCTION) {
      throw new Error(
        `${variableName} must not contain a wildcard source in production.`
      );
    }

    return source;
  }

  if (ALLOWED_CSP_KEYWORDS.has(source)) {
    if (
      IS_PRODUCTION &&
      ["'unsafe-eval'", "'wasm-unsafe-eval'"].includes(source)
    ) {
      throw new Error(
        `${variableName} must not contain ${source} in production.`
      );
    }

    return source;
  }

  if (source.startsWith("'") || source.endsWith("'")) {
    if (CSP_NONCE_PATTERN.test(source) || CSP_HASH_PATTERN.test(source)) {
      return source;
    }

    throw new TypeError(
      `${variableName} contains an unsupported quoted CSP source.`
    );
  }

  if (CSP_SCHEME_PATTERN.test(source)) {
    const scheme = source.toLowerCase();

    if (IS_PRODUCTION && scheme === "http:") {
      throw new Error(
        `${variableName} must not allow the http: scheme in production.`
      );
    }

    return source;
  }

  if (!isValidHostSource(source)) {
    throw new TypeError(
      `${variableName} contains an invalid CSP host source.`
    );
  }

  if (IS_PRODUCTION && source.startsWith("http://")) {
    throw new Error(
      `${variableName} must not contain insecure HTTP sources in production.`
    );
  }

  return source;
}

export function parseDirectiveSources(value, fallback, name) {
  if (value === undefined || value === null) {
    return [...fallback];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array of CSP sources.`);
  }

  const sources = value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new TypeError(`${name} contains an invalid CSP source.`);
    }

    // Reject whitespace rather than silently normalizing potentially
    // malformed values from configuration.
    if (item !== item.trim()) {
      throw new TypeError(`${name} CSP sources must not have surrounding whitespace.`);
    }

    return validateSource(item, name);
  });

  const uniqueSources = [...new Set(sources)];

  if (uniqueSources.includes("'none'") && uniqueSources.length > 1) {
    throw new Error(`${name} cannot combine 'none' with other CSP sources.`);
  }

  return uniqueSources;
}

export function buildContentSecurityPolicy() {
  if (env.CONTENT_SECURITY_POLICY_ENABLED === false) {
    return false;
  }

  const directives = Object.fromEntries(
    Object.entries(DEFAULT_CSP_DIRECTIVES).map(([name, sources]) => [
      name,
      [...sources],
    ])
  );

  for (const [directive, variableName] of Object.entries(
    CONFIGURABLE_DIRECTIVES
  )) {
    const configuredSources = env[variableName];

    if (configuredSources !== undefined && configuredSources !== null) {
      directives[directive] = parseDirectiveSources(
        configuredSources,
        directives[directive] ?? [],
        variableName
      );
    }
  }

  if (IS_PRODUCTION) {
    // Browsers upgrade eligible insecure resource requests on HTTPS pages.
    directives.upgradeInsecureRequests = [];
  }

  return {
    useDefaults: true,
    directives,
  };
}

export function buildHelmetOptions() {
  const options = {
    contentSecurityPolicy: buildContentSecurityPolicy(),

    // Enable only after testing COEP compatibility with cross-origin assets.
    crossOriginEmbedderPolicy: false,

    // Prevent MIME-type sniffing.
    noSniff: true,

    // Reduce referrer information sent to other origins.
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },

    // Helmet does not emit X-Powered-By.
    xPoweredBy: false,

    // Prevent framing by other origins; CSP frame-ancestors is also set.
    frameguard: {
      action: "sameorigin",
    },

    // Disable legacy browser DNS prefetching.
    xDnsPrefetchControl: {
      allow: false,
    },

    // Legacy protection for downloaded files in supported browsers.
    xDownloadOptions: true,

    // Restrict cross-origin resource sharing behavior in browsers.
    crossOriginResourcePolicy: {
      policy: "same-origin",
    },

    // Avoid legacy XSS-filter behavior; CSP is the modern control.
    xXssProtection: false,
  };

  if (IS_PRODUCTION) {
    options.strictTransportSecurity = {
      maxAge: 15_552_000,
      includeSubDomains: true,
      preload: false,
    };
  } else {
    options.strictTransportSecurity = false;
  }

  return options;
}

const helmetMiddleware = helmet(buildHelmetOptions());

export function securityHeadersMiddleware(req, res, next) {
  if (env.HELMET_ENABLED === false) {
    return next();
  }

  return helmetMiddleware(req, res, next);
}

export default securityHeadersMiddleware;
