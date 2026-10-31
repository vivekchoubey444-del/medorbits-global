'use strict';

/**
 * Express response security headers.
 * This intentionally does not set CSP or HSTS automatically:
 * CSP must be derived from deployed frontend dependencies, and HSTS
 * belongs only on verified HTTPS responses/edge configuration.
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (process.env.HSTS_ENABLED === 'true' && req.secure) {
    const maxAge = Number(process.env.HSTS_MAX_AGE || 86400);
    const includeSubDomains = process.env.HSTS_INCLUDE_SUBDOMAINS === 'true';
    const preload = process.env.HSTS_PRELOAD === 'true';
    let value = `max-age=${Math.max(0, Math.min(maxAge, 63072000))}`;
    if (includeSubDomains) value += '; includeSubDomains';
    if (preload) value += '; preload';
    res.setHeader('Strict-Transport-Security', value);
  }

  next();
}

module.exports = { securityHeaders };
