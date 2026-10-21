
'use strict';

/**
 * MedOrbits -- HTTP Security Headers
 * File: src/config/security.js
 *
 * Responsibilities:
 * - Configure Helmet security headers.
 * - Apply a configurable Content Security Policy (CSP).
 * - Enable HSTS in production.
 * - Enforce safe defaults for browser resource loading.
 *
 * Dependencies:
 * - helmet
 * - ./env
 *
 * Important:
 * CSP must be tested against the actual frontend, API integrations,
 * payment providers, authentication flows, and external resources.
 */

const helmet = require('helmet');
const { env } = require('./env');

const IS_PRODUCTION = env.NODE_ENV === 'production';

const DEFAULT_CSP_DIRECTIVES = Object.freeze({
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  mediaSrc: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  frameSrc: ["'self'"],
});

const CONFIGURABLE_DIRECTIVES = Object.freeze({
  scriptSrc: 'CSP_SCRIPT_SRC',
  styleSrc: 'CSP_STYLE_SRC',
  imgSrc: 'CSP_IMG_SRC',
  fontSrc: 'CSP_FONT_SRC',
  connectSrc: 'CSP_CONNECT_SRC',
  mediaSrc: 'CSP_MEDIA_SRC',
  frameSrc: 'CSP_FRAME_SRC',
});

const ALLOWED_CSP_KEYWORDS = new Set([
  "'self'",
  "'none'",
  "'unsafe-inline'",
  "'unsafe-eval'",
  "'strict-dynamic'",
  "'report-sample'",
  "'wasm-unsafe-eval'",
]);

function parseDirectiveSources(value, fallback, name) {
  if (value === undefined || value === null) {
    return [...fallback];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(
      `${name} must be an array of CSP sources.`
    );
  }

  const sources = value.map((item) => {
    if (
      typeof item !== 'string' ||
      item.trim() === '' ||
      /[\u0000-\u0020\u007F]/.test(item.trim())
    ) {
      throw new TypeError(
        `${name} contains invalid CSP source values.`
      );
    }

    const source = item.trim();

    if (source === '*') {
      return source;
    }

    if (source.startsWith("'") || source.endsWith("'")) {
      if (!ALLOWED_CSP_KEYWORDS.has(source)) {
        // Permit nonce/hash sources, which Helmet supports.
        if (
          !/^'nonce-[A-Za-z0-9+/_=-]+'$/.test(source) &&
          !/^'sha256-[A-Za-z0-9+/=]+'$/.test(source) &&
          !/^'sha384-[A-Za-z0-9+/=]+'$/.test(source) &&
          !/^'sha512-[A-Za-z0-9+/=]+'$/.test(source)
        ) {
          throw new TypeError(
            `${name} contains an invalid quoted CSP source.`
          );
        }
      }
    }

    if (
      IS_PRODUCTION &&
      ["'unsafe-eval'", "'wasm-unsafe-eval'"].includes(source)
    ) {
      throw new Error(
        `${name} must not contain ${source} in production.`
      );
    }

    return source;
  });

  const uniqueSources = [...new Set(sources)];

  if (
    uniqueSources.includes("'none'") &&
    uniqueSources.length > 1
  ) {
    throw new Error(
      `${name} cannot combine 'none' with other CSP sources.`
    );
  }

  if (
    IS_PRODUCTION &&
    uniqueSources.includes('*')
  ) {
    throw new Error(
      `${name} must not contain a wildcard source in production.`
    );
  }

  return uniqueSources;
}

function buildContentSecurityPolicy() {
  if (env.CONTENT_SECURITY_POLICY_ENABLED === false) {
    return false;
  }

  const directives = Object.fromEntries(
    Object.entries(DEFAULT_CSP_DIRECTIVES).map(
      ([name, sources]) => [name, [...sources]]
    )
  );

  for (const [directive, variableName] of Object.entries(
    CONFIGURABLE_DIRECTIVES
  )) {
    const configuredSources = env[variableName];

    if (configuredSources !== undefined && configuredSources !== null) {
      directives[directive] = parseDirectiveSources(
        configuredSources,
        directives[directive] || [],
        variableName
      );
    }
  }

  // Keep the browser from loading insecure HTTP resources on HTTPS pages.
  if (IS_PRODUCTION) {
    directives.upgradeInsecureRequests = [];
  }

  return {
    useDefaults: true,
    directives,
  };
}

function buildHelmetOptions() {
  const options = {
    contentSecurityPolicy: buildContentSecurityPolicy(),

    // Enable only after confirming cross-origin resources remain compatible.
    crossOriginEmbedderPolicy: false,

    // Prevent MIME-type sniffing.
    xContentTypeOptions: true,

    // Reduce referrer information sent to other origins.
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // Disable legacy browser-specific headers.
    xPoweredBy: false,

    // Restrict framing; CSP frame-ancestors also applies when supported.
    frameguard: {
      action: 'sameorigin',
    },

    // Disable browser DNS prefetching.
    xDnsPrefetchControl: {
      allow: false,
    },

    // Prevent legacy download behavior from executing HTML in some contexts.
    xDownloadOptions: true,

    // Reduce cross-origin information leakage.
    crossOriginResourcePolicy: {
      policy: 'same-origin',
    },
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

const securityHeaders = helmet(buildHelmetOptions());

function securityHeadersMiddleware(req, res, next) {
  if (env.HELMET_ENABLED === false) {
    return next();
  }

  return securityHeaders(req, res, next);
}

module.exports = {
  securityHeadersMiddleware,
  buildContentSecurityPolicy,
  buildHelmetOptions,
  parseDirectiveSources,
};
