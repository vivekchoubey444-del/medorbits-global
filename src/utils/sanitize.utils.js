
'use strict';

/**
 * MedOrbits -- Sanitization Utilities
 *
 * File: src/utils/sanitize.js
 * Runtime: Node.js >= 20
 *
 * Provides:
 * - Plain-text normalization.
 * - Recursive sanitization of JSON-like values.
 * - Nesting, string, array, and object-property limits.
 * - Dangerous-key filtering.
 * - HTML text-context escaping.
 * - Unicode-normalized search-term processing.
 *
 * Security:
 * - Sanitization does not replace schema validation or authorization.
 * - Use parameterized SQL queries.
 * - Use context-appropriate output encoding.
 * - Do not treat sanitized input as trusted HTML.
 */

const DANGEROUS_KEYS = Object.freeze([
  '__proto__',
  'prototype',
  'constructor',
]);

const DANGEROUS_KEY_SET = new Set(DANGEROUS_KEYS);

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_STRING_LENGTH = 10000;
const DEFAULT_MAX_ARRAY_LENGTH = 1000;
const DEFAULT_MAX_OBJECT_KEYS = 500;
const DEFAULT_SEARCH_MAX_LENGTH = 100;

const MAX_SAFE_CONFIG_LIMIT = Number.MAX_SAFE_INTEGER;

function validateLimit(
  value,
  name,
  maximum = MAX_SAFE_CONFIG_LIMIT,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    !Number.isSafeInteger(maximum) ||
    maximum < 0 ||
    value > maximum
  ) {
    throw new RangeError(
      `${name} must be a non-negative safe integer no greater than ${maximum}.`,
    );
  }

  return value;
}

function validateOptions(options, name = 'Sanitization options') {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function sanitizeString(value, options = {}) {
  if (typeof value !== 'string') {
    return value;
  }

  validateOptions(options);

  const trim = options.trim ?? true;
  const maxLength = validateLimit(
    options.maxLength ?? DEFAULT_MAX_STRING_LENGTH,
    'maxLength',
  );

  if (typeof trim !== 'boolean') {
    throw new TypeError('trim must be a boolean.');
  }

  const normalized = trim ? value.trim() : value;

  return normalized.slice(0, maxLength);
}

function sanitizeObject(input, options = {}) {
  validateOptions(options);

  const maxDepth = validateLimit(
    options.maxDepth ?? DEFAULT_MAX_DEPTH,
    'maxDepth',
  );

  const maxStringLength = validateLimit(
    options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    'maxStringLength',
  );

  const maxArrayLength = validateLimit(
    options.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
    'maxArrayLength',
  );

  const maxObjectKeys = validateLimit(
    options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    'maxObjectKeys',
  );

  const trimStrings = options.trimStrings ?? true;

  if (typeof trimStrings !== 'boolean') {
    throw new TypeError('trimStrings must be a boolean.');
  }

  const activePath = new WeakSet();

  function visit(value, depth) {
    if (
      value === null ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (typeof value === 'number') {
      // JSON cannot represent NaN or Infinity.
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      return sanitizeString(value, {
        trim: trimStrings,
        maxLength: maxStringLength,
      });
    }

    if (
      value === undefined ||
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint'
    ) {
      return undefined;
    }

    if (typeof value !== 'object') {
      return undefined;
    }

    if (depth > maxDepth) {
      throw new RangeError(
        'Input exceeds the maximum allowed nesting depth.',
      );
    }

    if (activePath.has(value)) {
      throw new TypeError(
        'Circular input objects are not supported.',
      );
    }

    activePath.add(value);

    try {
      if (Array.isArray(value)) {
        const length = Math.min(
          value.length,
          maxArrayLength,
        );

        const result = [];

        for (let index = 0; index < length; index += 1) {
          if (
            !Object.prototype.hasOwnProperty.call(
              value,
              index,
            )
          ) {
            result.push(null);
            continue;
          }

          const sanitized = visit(value[index], depth + 1);

          result.push(
            sanitized === undefined ? null : sanitized,
          );
        }

        return result;
      }

      const prototype = Object.getPrototypeOf(value);

      if (
        prototype !== Object.prototype &&
        prototype !== null
      ) {
        throw new TypeError(
          'Only plain objects are supported.',
        );
      }

      const keys = Object.keys(value);

      if (keys.length > maxObjectKeys) {
        throw new RangeError(
          'Input contains too many object properties.',
        );
      }

      // Null-prototype objects avoid inherited-property behavior.
      const result = Object.create(null);

      for (const key of keys) {
        if (DANGEROUS_KEY_SET.has(key)) {
          continue;
        }

        // Ignore accessors instead of invoking arbitrary getters.
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          key,
        );

        if (
          !descriptor ||
          !Object.prototype.hasOwnProperty.call(
            descriptor,
            'value',
          )
        ) {
          continue;
        }

        const sanitized = visit(
          descriptor.value,
          depth + 1,
        );

        if (sanitized !== undefined) {
          result[key] = sanitized;
        }
      }

      return result;
    } finally {
      activePath.delete(value);
    }
  }

  return visit(input, 0);
}

/**
 * Escape text for an HTML text-node context.
 *
 * Not a universal sanitizer for URLs, CSS, JavaScript,
 * rich HTML, or arbitrary HTML attributes.
 */
function escapeHtml(value) {
  const text = String(value);

  return text.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#x27;';
      default:
        return character;
    }
  });
}

/**
 * Normalize a search term.
 *
 * This does not make the result safe for SQL, regular expressions,
 * filesystem paths, or HTML.
 */
function sanitizeSearchTerm(
  value,
  maxLength = DEFAULT_SEARCH_MAX_LENGTH,
) {
  validateLimit(maxLength, 'maxLength');

  if (typeof value !== 'string') {
    return '';
  }

  return value
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

module.exports = Object.freeze({
  DANGEROUS_KEYS,
  sanitizeString,
  sanitizeObject,
  sanitizeSearchTerm,
  escapeHtml,
});
