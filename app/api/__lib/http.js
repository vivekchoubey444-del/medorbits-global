'use strict';

const crypto = require('node:crypto');

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function json(res, status, payload) {
  setSecurityHeaders(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function methodOnly(req, res, allowed) {
  if (allowed.includes(req.method)) return false;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed.' });
  return true;
}

function parseBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      reject(Object.assign(new Error('Content-Type must be application/json.'), { statusCode: 415 }));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw.trim()) return resolve({});
        const value = JSON.parse(raw);
        if (!value || Array.isArray(value) || typeof value !== 'object') {
          throw new Error('JSON body must be an object.');
        }
        resolve(value);
      } catch (error) {
        reject(Object.assign(new Error('Invalid JSON request body.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function text(value, max = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max);
}

function email(value) {
  const candidate = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : '';
}

function requestId(req) {
  const supplied = req.headers['x-request-id'];
  if (typeof supplied === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(supplied)) return supplied;
  return crypto.randomUUID();
}

function sameOriginIfConfigured(req, res) {
  const allowed = String(process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (!origin || allowed.length === 0) return true;
  if (!allowed.includes(origin)) {
    json(res, 403, { error: 'Origin is not allowed.' });
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
  return true;
}

function handleError(res, error, id) {
  const status = Number.isInteger(error && error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(`[api:${id}]`, error && error.message ? error.message : 'Unexpected error');
  json(res, status, { error: status >= 500 ? 'Internal server error.' : error.message, requestId: id });
}

module.exports = { json, methodOnly, parseBody, text, email, requestId, sameOriginIfConfigured, handleError };
