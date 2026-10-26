
'use strict';

/**
 * MedOrbits API -- Validation Middleware
 * File: /api/middleware/validation.js
 *
 * Features:
 * - Schema-based request validation
 * - Safe field allowlisting
 * - Request body, query and params validation
 * - String trimming and normalization
 * - Field length limits
 * - Object ID, UUID and numeric ID validation
 * - Safe nested property access
 * - Consistent validation errors
 *
 * Compatible with CommonJS Express applications.
 */

const DEFAULT_MAX_ERRORS = 50;
const DEFAULT_MAX_FIELD_LENGTH = 10_000;
const ALLOWED_REQUEST_SECTIONS = new Set([
  'body',
  'query',
  'params',
]);

const UNSAFE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_PATTERN = /^[1-9]\d*$/;

/**
 * Returns true for a plain object.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

/**
 * Validate a request section name.
 */
function assertRequestSection(section) {
  if (!ALLOWED_REQUEST_SECTIONS.has(section)) {
    throw new TypeError(
      `Unsupported request section: ${String(section)}`
    );
  }
}

/**
 * Split and validate a dot-separated property path.
 */
function parsePath(path) {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new TypeError('Field path must be a non-empty string.');
  }

  const segments = path.split('.');

  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        UNSAFE_KEYS.has(segment)
    )
  ) {
    throw new TypeError(`Unsafe or invalid field path: ${path}`);
  }

  return segments;
}

/**
 * Read a nested property without traversing unsafe keys.
 */
function getNestedValue(object, path) {
  const segments = Array.isArray(path) ? path : parsePath(path);
  let current = object;

  for (const segment of segments) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

/**
 * Safely assign a nested property.
 * Creates plain objects where necessary.
 */
function setNestedValue(object, path, value) {
  if (!isPlainObject(object)) {
    throw new TypeError('Target must be a plain object.');
  }

  const segments = Array.isArray(path) ? path : parsePath(path);
  let current = object;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];

    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      current[segment] = Object.create(null);
    } else if (!isPlainObject(current[segment])) {
      throw new TypeError(
        `Cannot assign nested field through non-object: ${segment}`
      );
    }

    current = current[segment];
  }

  current[segments[segments.length - 1]] = value;

  return object;
}

/**
 * Send a consistent validation error response.
 */
function sendValidationError(
  res,
  errors,
  statusCode = 400
) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: errors,
    },
  });
}

/**
 * Build a normalized validation error.
 */
function makeError(field, message, code = 'INVALID_VALUE') {
  return {
    field,
    message,
    code,
  };
}

/**
 * Add a validation error until the configured limit is reached.
 */
function addError(errors, error, maxErrors) {
  if (errors.length < maxErrors) {
    errors.push(error);
  }
}

/**
 * Validate a field against a regular expression.
 *
 * Resets lastIndex so global/sticky regular expressions
 * cannot produce inconsistent results across requests.
 */
function pattern(regex, message = 'Invalid format.') {
  if (!(regex instanceof RegExp)) {
    throw new TypeError('pattern() requires a RegExp.');
  }

  return (value) => {
    if (typeof value !== 'string') {
      return message;
    }

    regex.lastIndex = 0;
    const valid = regex.test(value);
    regex.lastIndex = 0;

    return valid ? true : message;
  };
}

/**
 * Built-in validation rules.
 *
 * Each rule returns true when valid or an error message
 * when invalid. A thrown error is treated as a schema or
 * validator configuration error, not a user validation error.
 */
const rules = Object.freeze({
  required(value) {
    if (value === undefined || value === null) {
      return 'This field is required.';
    }

    if (typeof value === 'string' && value.trim() === '') {
      return 'This field is required.';
    }

    return true;
  },

  string(value) {
    return typeof value === 'string' || 'Must be a string.';
  },

  number(value) {
    return (
      (typeof value === 'number' && Number.isFinite(value)) ||
      'Must be a finite number.'
    );
  },

  integer(value) {
    return Number.isSafeInteger(value) || 'Must be a safe integer.';
  },

  boolean(value) {
    return typeof value === 'boolean' || 'Must be a boolean.';
  },

  object(value) {
    return isPlainObject(value) || 'Must be a plain object.';
  },

  array(value) {
    return Array.isArray(value) || 'Must be an array.';
  },

  email(value) {
    if (typeof value !== 'string') {
      return 'Must be a valid email address.';
    }

    if (value.length > 254) {
      return 'Email address is too long.';
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return (
      emailPattern.test(value) ||
      'Must be a valid email address.'
    );
  },

  url(value) {
    if (typeof value !== 'string') {
      return 'Must be a valid URL.';
    }

    try {
      const parsed = new URL(value);

      return (
        ['http:', 'https:'].includes(parsed.protocol) ||
        'URL must use HTTP or HTTPS.'
      );
    } catch {
      return 'Must be a valid URL.';
    }
  },

  min(value, minimum) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      return 'Must be a finite number.';
    }

    return value >= minimum || `Must be at least ${minimum}.`;
  },

  max(value, maximum) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      return 'Must be a finite number.';
    }

    return value <= maximum || `Must be at most ${maximum}.`;
  },

  minLength(value, minimum) {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return 'Must be a string or array.';
    }

    return (
      value.length >= minimum ||
      `Must contain at least ${minimum} characters or items.`
    );
  },

  maxLength(value, maximum) {
    if (typeof value !== 'string' && !Array.isArray(value)) {
      return 'Must be a string or array.';
    }

    return (
      value.length <= maximum ||
      `Must contain no more than ${maximum} characters or items.`
    );
  },

  oneOf(value, allowedValues) {
    if (!Array.isArray(allowedValues)) {
      throw new TypeError('oneOf requires an array of allowed values.');
    }

    return (
      allowedValues.includes(value) ||
      'Value is not an allowed option.'
    );
  },

  matches(value, regex) {
    if (!(regex instanceof RegExp)) {
      throw new TypeError('matches requires a RegExp.');
    }

    if (typeof value !== 'string') {
      return 'Must be a string.';
    }

    regex.lastIndex = 0;
    const valid = regex.test(value);
    regex.lastIndex = 0;

    return valid || 'Value has an invalid format.';
  },

  objectId(value) {
    return (
      (typeof value === 'string' &&
        OBJECT_ID_PATTERN.test(value)) ||
      'Must be a valid 24-character object ID.'
    );
  },

  uuid(value) {
    return (
      (typeof value === 'string' &&
        UUID_PATTERN.test(value)) ||
      'Must be a valid UUID.'
    );
  },

  numericId(value) {
    return (
      ((typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0) ||
        (typeof value === 'string' &&
          NUMERIC_ID_PATTERN.test(value))) ||
      'Must be a positive numeric ID.'
    );
  },
});

/**
 * Validate a schema definition before processing requests.
 *
 * Schema format:
 * {
 *   email: {
 *     required: true,
 *     rules: [
 *       rules.string,
 *       rules.email
 *     ]
 *   }
 * }
 *
 * A field definition may also be an array of validator functions.
 */
function validateSchema(schema) {
  if (!isPlainObject(schema)) {
    throw new TypeError('Validation schema must be a plain object.');
  }

  for (const [field, definition] of Object.entries(schema)) {
    parsePath(field);

    const validators = Array.isArray(definition)
      ? definition
      : definition?.rules ?? [];

    if (!Array.isArray(validators)) {
      throw new TypeError(
        `Validators for "${field}" must be an array.`
      );
    }

    for (const validator of validators) {
      if (typeof validator !== 'function') {
        throw new TypeError(
          `Every validator for "${field}" must be a function.`
        );
      }
    }

    if (
      !Array.isArray(definition) &&
      definition !== null &&
      definition !== undefined &&
      !isPlainObject(definition)
    ) {
      throw new TypeError(
        `Definition for "${field}" must be an object or validator array.`
      );
    }
  }

  return schema;
}

/**
 * Express middleware for validating req.body, req.query or req.params.
 *
 * Usage:
 * validate({
 *   email: {
 *     required: true,
 *     rules: [rules.string, rules.email]
 *   }
 * }, 'body')
 */
function validate(schema, section = 'body', options = {}) {
  assertRequestSection(section);
  validateSchema(schema);

  const maxErrors = Number.isSafeInteger(options.maxErrors)
    ? Math.max(1, options.maxErrors)
    : DEFAULT_MAX_ERRORS;

  return function validationMiddleware(req, res, next) {
    const source = req[section];

    if (!isPlainObject(source)) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    const errors = [];

    for (const [field, definition] of Object.entries(schema)) {
      const path = parsePath(field);
      const value = getNestedValue(source, path);

      const config = Array.isArray(definition)
        ? { rules: definition }
        : definition;

      const validators = config.rules || [];
      const isRequired = config.required === true;

      if (isRequired) {
        const requiredResult = rules.required(value);

        if (requiredResult !== true) {
          addError(
            errors,
            makeError(field, requiredResult, 'REQUIRED'),
            maxErrors
          );

          if (errors.length >= maxErrors) break;
          continue;
        }
      }

      if (value === undefined || value === null) {
        continue;
      }

      for (const validator of validators) {
        let result;

        try {
          result = validator(value, req);
        } catch (error) {
          return next(error);
        }

        if (result !== true) {
          addError(
            errors,
            makeError(
              field,
              typeof result === 'string'
                ? result
                : 'Invalid value.',
              'INVALID_VALUE'
            ),
            maxErrors
          );

          if (errors.length >= maxErrors) break;
        }
      }

      if (errors.length >= maxErrors) break;
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    return next();
  };
}

/**
 * Reject unexpected keys in a request section.
 */
function allowOnlyFields(
  allowedFields,
  section = 'body',
  options = {}
) {
  assertRequestSection(section);

  if (
    !Array.isArray(allowedFields) ||
    !allowedFields.every(
      (field) => typeof field === 'string' && field.length > 0
    )
  ) {
    throw new TypeError('allowedFields must be an array of field names.');
  }

  const allowedPaths = new Set(
    allowedFields.map((field) => parsePath(field).join('.'))
  );

  const allowNested = options.allowNested === true;

  return function allowOnlyFieldsMiddleware(req, res, next) {
    const source = req[section];

    if (!isPlainObject(source)) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    const unexpected = [];

    for (const key of Object.keys(source)) {
      const safeKey = parsePath(key).join('.');

      if (allowedPaths.has(safeKey)) {
        continue;
      }

      if (
        allowNested &&
        [...allowedPaths].some((path) => path.startsWith(`${safeKey}.`))
      ) {
        continue;
      }

      unexpected.push(
        makeError(
          key,
          'Unexpected field.',
          'UNEXPECTED_FIELD'
        )
      );
    }

    if (unexpected.length > 0) {
      return sendValidationError(res, unexpected);
    }

    return next();
  };
}

/**
 * Require a request section to be a plain object.
 */
function requireObject(section = 'body') {
  assertRequestSection(section);

  return function requireObjectMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    return next();
  };
}

/**
 * Clone a plain object before transforming it.
 */
function clonePlainObject(value) {
  if (!isPlainObject(value)) {
    throw new TypeError('Expected a plain object.');
  }

  const clone = Object.create(null);

  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) {
      throw new TypeError(`Unsafe property name: ${key}`);
    }

    const item = value[key];

    if (Array.isArray(item)) {
      clone[key] = item.slice();
    } else if (isPlainObject(item)) {
      clone[key] = clonePlainObject(item);
    } else {
      clone[key] = item;
    }
  }

  return clone;
}

/**
 * Trim string fields in a request section.
 *
 * Nested paths are supported.
 */
function trimFields(
  fields,
  section = 'body'
) {
  assertRequestSection(section);

  if (!Array.isArray(fields)) {
    throw new TypeError('fields must be an array.');
  }

  const paths = fields.map(parsePath);

  return function trimFieldsMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    try {
      const transformed = clonePlainObject(req[section]);

      for (const path of paths) {
        const value = getNestedValue(transformed, path);

        if (typeof value === 'string') {
          setNestedValue(transformed, path, value.trim());
        }
      }

      req[section] = transformed;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Convert string fields to lowercase.
 *
 * Intended for fields such as email addresses, not display names.
 */
function lowercaseFields(
  fields,
  section = 'body'
) {
  assertRequestSection(section);

  if (!Array.isArray(fields)) {
    throw new TypeError('fields must be an array.');
  }

  const paths = fields.map(parsePath);

  return function lowercaseFieldsMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    try {
      const transformed = clonePlainObject(req[section]);

      for (const path of paths) {
        const value = getNestedValue(transformed, path);

        if (typeof value === 'string') {
          setNestedValue(
            transformed,
            path,
            value.toLowerCase()
          );
        }
      }

      req[section] = transformed;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

/**
 * Limit the length of string fields.
 *
 * Fields not present in the request are ignored.
 */
function limitFieldLengths(
  fields,
  maximum = DEFAULT_MAX_FIELD_LENGTH,
  section = 'body'
) {
  assertRequestSection(section);

  if (!Array.isArray(fields)) {
    throw new TypeError('fields must be an array.');
  }

  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1
  ) {
    throw new TypeError('maximum must be a positive safe integer.');
  }

  const paths = fields.map(parsePath);

  return function limitFieldLengthsMiddleware(req, res, next) {
    const source = req[section];

    if (!isPlainObject(source)) {
      return sendValidationError(
        res,
        [
          makeError(
            section,
            `Request ${section} must be a plain object.`,
            'INVALID_REQUEST_SECTION'
          ),
        ]
      );
    }

    const errors = [];

    for (const path of paths) {
      const value = getNestedValue(source, path);

      if (typeof value === 'string' && value.length > maximum) {
        errors.push(
          makeError(
            path.join('.'),
            `Must not exceed ${maximum} characters.`,
            'FIELD_TOO_LONG'
          )
        );
      }
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    return next();
  };
}

/**
 * Validate a MongoDB-style ObjectId.
 */
function isValidObjectId(value) {
  return (
    typeof value === 'string' &&
    OBJECT_ID_PATTERN.test(value)
  );
}

/**
 * Validate a UUID.
 */
function isValidUUID(value) {
  return (
    typeof value === 'string' &&
    UUID_PATTERN.test(value)
  );
}

/**
 * Validate a positive numeric ID.
 */
function isValidNumericId(value) {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value)
  ) {
    return value > 0;
  }

  return (
    typeof value === 'string' &&
    NUMERIC_ID_PATTERN.test(value)
  );
}

module.exports = {
  rules,
  pattern,
  validate,
  validateSchema,
  allowOnlyFields,
  requireObject,
  trimFields,
  lowercaseFields,
  limitFieldLengths,
  isValidObjectId,
  isValidUUID,
  isValidNumericId,
  getNestedValue,
  setNestedValue,
  sendValidationError,
};
