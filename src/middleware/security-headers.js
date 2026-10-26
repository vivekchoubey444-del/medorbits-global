
'use strict';

/**
 * MedOrbits -- HTTP Security Headers
 *
 * File: src/middleware/security-headers.js
 * Runtime: Node.js >= 20
 *
 * Requires:
 *   npm install helmet
 *
 * Configure CSP directives explicitly for the deployed application.
 */

function loadHelmet() {
  try {
    const mod = require('helmet');
    const helmet = mod.default || mod;

    if (typeof helmet !== 'function') {
      throw new TypeError('Invalid Helmet module export.');
    }

    return helmet;
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        'Security headers require `helmet`. Install it with `npm install helmet`.',
        { cause: error }
      );
    }

    throw error;
  }
}

function securityHeaders(options = {}) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Security headers options must be an object.');
  }

  const helmet = loadHelmet();
  const isProduction = process.env.NODE_ENV === 'production';

  const helmetOptions = options.helmetOptions ?? {};

  if (
    !helmetOptions ||
    typeof helmetOptions !== 'object' ||
    Array.isArray(helmetOptions)
  ) {
    throw new TypeError('helmetOptions must be an object.');
  }

  if (
    options.contentSecurityPolicy != null &&
    typeof options.contentSecurityPolicy !== 'boolean' &&
    (
      typeof options.contentSecurityPolicy !== 'object' ||
      Array.isArray(options.contentSecurityPolicy)
    )
  ) {
    throw new TypeError(
      'contentSecurityPolicy must be a boolean or a Helmet CSP configuration object.'
    );
  }

  if (
    options.crossOriginEmbedderPolicy != null &&
    typeof options.crossOriginEmbedderPolicy !== 'boolean' &&
    typeof options.crossOriginEmbedderPolicy !== 'object'
  ) {
    throw new TypeError(
      'crossOriginEmbedderPolicy must be a boolean or configuration object.'
    );
  }

  const referrerPolicy =
    options.referrerPolicy ??
    { policy: 'strict-origin-when-cross-origin' };

  const frameguard =
    options.frameguard ??
    { action: 'sameorigin' };

  const hsts =
    options.hsts ??
    isProduction;

  if (
    typeof hsts !== 'boolean' &&
    (
      !hsts ||
      typeof hsts !== 'object' ||
      Array.isArray(hsts)
    )
  ) {
    throw new TypeError(
      'hsts must be a boolean or a Helmet HSTS configuration object.'
    );
  }

  const defaults = {
    // CSP is configurable because inline scripts, external APIs, and
    // third-party integrations vary by deployment. Enable explicitly
    // after configuring the application's required directives.
    contentSecurityPolicy:
      options.contentSecurityPolicy ?? false,

    crossOriginEmbedderPolicy:
      options.crossOriginEmbedderPolicy ?? false,

    referrerPolicy,
    hsts,

    // Helmet's modern equivalent of the old noSniff option.
    xContentTypeOptions: true,

    frameguard,

    // Explicitly keep legacy browser security headers enabled.
    xPoweredBy: false,
  };

  // Allow advanced Helmet settings, while keeping critical protections
  // from being accidentally disabled by a spread-order mistake.
  const configuration = {
    ...defaults,
    ...helmetOptions,
  };

  configuration.xContentTypeOptions = true;
  configuration.xPoweredBy = false;

  // Respect explicitly supplied top-level settings.
  if (options.contentSecurityPolicy !== undefined) {
    configuration.contentSecurityPolicy =
      options.contentSecurityPolicy;
  }

  if (options.crossOriginEmbedderPolicy !== undefined) {
    configuration.crossOriginEmbedderPolicy =
      options.crossOriginEmbedderPolicy;
  }

  if (options.referrerPolicy !== undefined) {
    configuration.referrerPolicy = referrerPolicy;
  }

  if (options.frameguard !== undefined) {
    configuration.frameguard = frameguard;
  }

  if (options.hsts !== undefined) {
    configuration.hsts = hsts;
  }

  return helmet(configuration);
}

module.exports = securityHeaders;
module.exports.securityHeaders = securityHeaders;
