"use strict";

const DEFAULTS = Object.freeze({
  contentTypeOptions: "nosniff",
  referrerPolicy: "strict-origin-when-cross-origin",
  frameOptions: "SAMEORIGIN",
  permissionsPolicy: "camera=(), microphone=(), geolocation=()",
  crossOriginOpenerPolicy: null,
  crossOriginResourcePolicy: null,
  contentSecurityPolicy: null,
  contentSecurityPolicyReportOnly: null,
  strictTransportSecurity: null,
  removePoweredBy: true
});

function validateHeaderValue(name, value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string or null.`);
  }

  if (/[\r\n]/.test(value)) {
    throw new TypeError(`${name} must not contain CR or LF characters.`);
  }
}

function securityHeaders(options = {}) {
  const config = { ...DEFAULTS, ...options };

  for (const [key, value] of Object.entries(config)) {
    if (value !== null && value !== undefined && key !== "removePoweredBy") {
      validateHeaderValue(key, value);
    }
  }

  if (config.contentSecurityPolicy && config.contentSecurityPolicyReportOnly) {
    throw new Error(
      "Set either contentSecurityPolicy or contentSecurityPolicyReportOnly, not both."
    );
  }

  return function medorbitsSecurityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", config.contentTypeOptions);
    res.setHeader("Referrer-Policy", config.referrerPolicy);
    res.setHeader("X-Frame-Options", config.frameOptions);
    res.setHeader("Permissions-Policy", config.permissionsPolicy);

    if (config.crossOriginOpenerPolicy) {
      res.setHeader("Cross-Origin-Opener-Policy", config.crossOriginOpenerPolicy);
    }

    if (config.crossOriginResourcePolicy) {
      res.setHeader("Cross-Origin-Resource-Policy", config.crossOriginResourcePolicy);
    }

    if (config.contentSecurityPolicy) {
      res.setHeader("Content-Security-Policy", config.contentSecurityPolicy);
    }

    if (config.contentSecurityPolicyReportOnly) {
      res.setHeader(
        "Content-Security-Policy-Report-Only",
        config.contentSecurityPolicyReportOnly
      );
    }

    if (config.strictTransportSecurity) {
      res.setHeader(
        "Strict-Transport-Security",
        config.strictTransportSecurity
      );
    }

    if (config.removePoweredBy && typeof res.removeHeader === "function") {
      res.removeHeader("X-Powered-By");
    }

    next();
  };
}

module.exports = {
  securityHeaders,
  DEFAULTS
};
