'use strict';

/**
 * MedOrbits -- AI Provider Configuration
 *
 * File: src/integrations/ai/ai.config.js
 * Runtime: Node.js >= 20
 *
 * Loads and validates AI provider settings.
 * Never logs or exposes API credentials through diagnostic output.
 */

const DEFAULTS = Object.freeze({
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  timeoutMs: 20_000,
  maxOutputTokens: 800,
  maxInputChars: 12_000,
});

const LIMITS = Object.freeze({
  timeoutMs: Object.freeze({ min: 1_000, max: 120_000 }),
  maxOutputTokens: Object.freeze({ min: 1, max: 8_000 }),
  maxInputChars: Object.freeze({ min: 1, max: 100_000 }),
});

function readString(source, key, fallback = '') {
  const value = source[key];

  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${key} must be a string.`);
  }

  return value.trim();
}

function readInteger(source, key, fallback, min, max) {
  const raw = source[key];

  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }

  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new TypeError(`${key} must be an integer.`);
  }

  const value = String(raw).trim();

  if (!/^\d+$/.test(value)) {
    throw new TypeError(`${key} must be an integer.`);
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new RangeError(
      `${key} must be between ${min} and ${max}.`,
    );
  }

  return parsed;
}

function normalizeBaseUrl(value, nodeEnv = 'development') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('AI_API_URL must be a non-empty URL.');
  }

  let parsed;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new TypeError(
      'AI_API_URL must be a valid absolute URL.',
    );
  }

  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      'AI_API_URL must use HTTP(S) and cannot contain credentials, query parameters, or fragments.',
    );
  }

  if (nodeEnv === 'production' && parsed.protocol !== 'https:') {
    throw new TypeError(
      'AI_API_URL must use HTTPS in production.',
    );
  }

  // Reject URLs that include a non-root path ending in a traversal segment.
  const segments = parsed.pathname.split('/');

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new TypeError(
      'AI_API_URL must not contain path traversal segments.',
    );
  }

  return parsed.href.replace(/\/+$/, '');
}

function validateModel(model) {
  if (
    typeof model !== 'string' ||
    !model ||
    model.length > 128 ||
    /[\u0000-\u001f\u007f]/.test(model)
  ) {
    throw new TypeError('AI_MODEL is invalid.');
  }

  return model;
}

function validateApiKey(apiKey) {
  if (
    typeof apiKey !== 'string' ||
    /[\u0000-\u001f\u007f]/.test(apiKey)
  ) {
    throw new TypeError('AI_API_KEY is invalid.');
  }

  // Empty keys are allowed at configuration load time so that deployments
  // without the optional AI integration can still start. The provider
  // must reject generation requests when credentials are missing.
  return apiKey;
}

function loadAiConfig(source = process.env) {
  if (
    source === null ||
    typeof source !== 'object' ||
    Array.isArray(source)
  ) {
    throw new TypeError(
      'AI environment configuration must be an object.',
    );
  }

  const nodeEnv = readString(source, 'NODE_ENV', 'development');

  const apiKey = validateApiKey(
    readString(source, 'AI_API_KEY'),
  );

  const baseUrl = normalizeBaseUrl(
    readString(source, 'AI_API_URL', DEFAULTS.baseUrl),
    nodeEnv,
  );

  const model = validateModel(
    readString(source, 'AI_MODEL', DEFAULTS.model),
  );

  const timeoutMs = readInteger(
    source,
    'AI_TIMEOUT_MS',
    DEFAULTS.timeoutMs,
    LIMITS.timeoutMs.min,
    LIMITS.timeoutMs.max,
  );

  const maxOutputTokens = readInteger(
    source,
    'AI_MAX_OUTPUT_TOKENS',
    DEFAULTS.maxOutputTokens,
    LIMITS.maxOutputTokens.min,
    LIMITS.maxOutputTokens.max,
  );

  const maxInputChars = readInteger(
    source,
    'AI_MAX_INPUT_CHARS',
    DEFAULTS.maxInputChars,
    LIMITS.maxInputChars.min,
    LIMITS.maxInputChars.max,
  );

  return Object.freeze({
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    maxOutputTokens,
    maxInputChars,
  });
}

module.exports = {
  DEFAULTS,
  LIMITS,
  loadAiConfig,
  normalizeBaseUrl,
  validateModel,
};