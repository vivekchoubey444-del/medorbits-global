'use strict';
/**
 * MedOrbits -- Request Validation Middleware
 * File: api/middleware/validation.js
 *
 * Purpose:
 * - Validate request body, query parameters, and route parameters.
 * - Provide reusable validation rules and sanitization helpers.
 * - Return consistent 400 responses for invalid input.
 * - Avoid mutating the original request data.
 *
 * Dependencies: Express (no additional dependencies required).
 */
const DEFAULT_ERROR_CODE = 'VALIDATION_ERROR';
const MAX_ERRORS = 50;
/**
 * Safely identify plain objects.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
/**
 * Escape special characters for regular expressions.
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Normalize a value to a trimmed string.
 */
function normalizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.trim();
}
/**
 * Escape HTML-sensitive characters for safe HTML text output.
 * Prefer context-aware output encoding at the rendering layer.
 */
function escapeHtml(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}
/**
 * Create a normalized validation issue.
 */
function createIssue(field, message, code = DEFAULT_ERROR_CODE) {
  return {
    field: String(field || 'request'),
    message: String(message || 'Invalid value.'),
    code: String(code),
  };
}
/**
 * Send a consistent validation response.
 */
function sendValidationError(
  res,
  errors,
  message = 'Please correct the invalid request fields.'
) {
  const safeErrors = Array.isArray(errors)
    ? errors.slice(0, MAX_ERRORS).map((error) => ({
        field: String(error.field || 'request'),
        message: String(error.message || 'Invalid value.'),
        code: String(error.code || DEFAULT_ERROR_CODE),
      }))
    : [];
  return res.status(400).json({
    success: false,
    error: {
      code: DEFAULT_ERROR_CODE,
      message,
      details: safeErrors,
    },
  });
}
/**
 * Resolve a field from a nested object using dot notation.
 */
function getNestedValue(source, path) {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  return String(path)
    .split('.')
    .reduce((current, segment) => {
      if (
        current === null ||
        current === undefined ||
        !Object.prototype.hasOwnProperty.call(current, segment)
      ) {
        return undefined;
      }
      return current[segment];
    }, source);
}
/**
 * Set a nested field on a copied object.
 * Rejects prototype-related keys to reduce prototype-pollution risk.
 */
function setNestedValue(target, path, value) {
  const segments = String(path).split('.');
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  if (segments.some((segment) => forbidden.has(segment))) {
    throw new Error('Unsafe nested property path.');
  }
  let current = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment];
  }
  current[segments[segments.length - 1]] = value;
  return target;
}
/**
 * Apply a transform to a nested field on a shallow/deep plain-object copy.
 */
function clonePlainData(value) {
  if (Array.isArray(value)) {
    return value.map(clonePlainData);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) {
      continue;
    }
    result[key] = clonePlainData(child);
  }
  return result;
}
/**
 * Common validation rules.
 *
 * Each rule receives (value, request).
 * Return true when valid; return a string to describe a validation failure.
 */
const rules = {
  required(value) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
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
      'Must be a valid number.'
    );
  },
  integer(value) {
    return Number.isInteger(value) || 'Must be an integer.';
  },
  boolean(value) {
    return typeof value === 'boolean' || 'Must be a boolean.';
  },
  array(value) {
    return Array.isArray(value) || 'Must be an array.';
  },
  object(value) {
    return isPlainObject(value) || 'Must be an object.';
  },
  email(value) {
    if (typeof value !== 'string') {
      return 'Must be a valid email address.';
    }
    const email = value.trim();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return 'Must be a valid email address.';
    }
    return true;
  },
  phone(value) {
    if (typeof value !== 'string') {
      return 'Must be a valid phone number.';
    }
    const normalized = value.replace(/[\s().-]/g, '');
    return (
      /^\+?[0-9]{7,15}$/.test(normalized) ||
      'Must be a valid phone number.'
    );
  },
  url(value) {
    if (typeof value !== 'string') {
      return 'Must be a valid URL.';
    }
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'URL must use HTTP or HTTPS.';
      }
      return true;
    } catch {
      return 'Must be a valid URL.';
    }
  },
  minLength(length) {
    return (value) => {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        return 'Must be a string or array.';
      }
      return (
        value.length >= length ||
        `Must contain at least ${length} characters or items.`
      );
    };
  },
  maxLength(length) {
    return (value) => {
      if (typeof value !== 'string' && !Array.isArray(value)) {
        return 'Must be a string or array.';
      }
      return (
        value.length <= length ||
        `Must contain no more than ${length} characters or items.`
      );
    };
  },
  min(minimum) {
    return (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Must be a valid number.';
      }
      return value >= minimum || `Must be at least ${minimum}.`;
    };
  },
  max(maximum) {
    return (value) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'Must be a valid number.';
      }
      return value <= maximum || `Must be no greater than ${maximum}.`;
    };
  },
  oneOf(allowedValues) {
    return (value) =>
      allowedValues.includes(value) ||
      `Must be one of: ${allowedValues.join(', ')}.`;
  },
  pattern(expression, message = 'Has an invalid format.') {
    return (value) => {
      if (typeof value !== 'string') {
        return message;
      }
      return expression.test(value) || message;
    };
  },
  matches(field, message = `Must match ${field}.`) {
    return (value, req) => {
      const otherValue = getNestedValue(req.body, field);
      return value === otherValue || message;
    };
  },
  custom(validator, message = 'Invalid value.') {
    return async (value, req) => {
      const result = await validator(value, req);
      if (result === true) {
        return true;
      }
      if (typeof result === 'string') {
        return result;
      }
      return result ? true : message;
    };
  },
};
/**
 * Validate one value against an array of rule definitions.
 *
 * Rule formats:
 * - 'required'
 * - ['minLength', 8]
 * - { name: 'oneOf', args: [['active', 'inactive']] }
 * - { name: 'custom', args: [validator, 'Custom error message'] }
 */
async function validateValue(value, fieldRules, req) {
  const errors = [];
  const normalizedRules = Array.isArray(fieldRules)
    ? fieldRules
    : [fieldRules];
  for (const rule of normalizedRules) {
    let name;
    let args = [];
    if (typeof rule === 'string') {
      name = rule;
    } else if (Array.isArray(rule)) {
      [name, ...args] = rule;
    } else if (isPlainObject(rule)) {
      name = rule.name;
      args = Array.isArray(rule.args) ? rule.args : [];
    } else {
      errors.push('Invalid validation rule configuration.');
      continue;
    }
    const validator = rules[name];
    if (typeof validator !== 'function') {
      errors.push(`Unknown validation rule: ${String(name)}.`);
      continue;
    }
    let result;
    try {
      result =
        args.length > 0
          ? validator(...args)(value, req)
          : validator(value, req);
      result = await result;
    } catch {
      errors.push('Validation could not be completed.');
      continue;
    }
    if (result !== true) {
      errors.push(
        typeof result === 'string' ? result : 'Invalid value.'
      );
    }
  }
  return errors;
}
/**
 * Build request validation middleware.
 *
 * Schema example:
 * {
 *   body: {
 *     email: ['required', 'email'],
 *     password: ['required', ['minLength', 8]]
 *   },
 *   params: {
 *     id: ['required', ['pattern', /^[0-9]+$/, 'Must be a numeric ID.']]
 *   }
 * }
 *
 * Options:
 * - abortEarly: stop after the first issue.
 * - message: top-level error message.
 * - allowUnknown: permit unspecified fields (default true).
 */
function validate(schema = {}, options = {}) {
  const {
    abortEarly = false,
    message = 'Please correct the invalid request fields.',
    allowUnknown = true,
  } = options;
  return async function validationMiddleware(req, res, next) {
    try {
      const errors = [];
      const sections = ['body', 'query', 'params'];
      for (const section of sections) {
        const sectionSchema = schema[section];
        if (!sectionSchema) {
          continue;
        }
        if (!isPlainObject(sectionSchema)) {
          return next(
            new Error(`Validation schema for "${section}" must be an object.`)
          );
        }
        const source = req[section] || {};
        if (!allowUnknown) {
          for (const field of Object.keys(source)) {
            if (
              !Object.prototype.hasOwnProperty.call(sectionSchema, field)
            ) {
              errors.push(
                createIssue(
                  `${section}.${field}`,
                  'This field is not allowed.',
                  'UNKNOWN_FIELD'
                )
              );
              if (abortEarly || errors.length >= MAX_ERRORS) {
                break;
              }
            }
          }
        }
        for (const [field, fieldRules] of Object.entries(sectionSchema)) {
          const value = getNestedValue(source, field);
          const fieldErrors = await validateValue(
            value,
            fieldRules,
            req
          );
          for (const fieldError of fieldErrors) {
            errors.push(
              createIssue(`${section}.${field}`, fieldError)
            );
            if (abortEarly || errors.length >= MAX_ERRORS) {
              break;
            }
          }
          if (abortEarly && errors.length > 0) {
            break;
          }
          if (errors.length >= MAX_ERRORS) {
            break;
          }
        }
        if (abortEarly && errors.length > 0) {
          break;
        }
        if (errors.length >= MAX_ERRORS) {
          break;
        }
      }
      if (errors.length > 0) {
        return sendValidationError(res, errors, message);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
/**
 * Reject request bodies containing fields outside an allowlist.
 * This is useful for preventing mass assignment on write endpoints.
 */
function allowOnlyFields(allowedFields = [], section = 'body') {
  const allowed = new Set(allowedFields);
  return function allowOnlyFieldsMiddleware(req, res, next) {
    const source = req[section];
    if (!isPlainObject(source)) {
      return sendValidationError(res, [
        createIssue(section, 'Expected an object.', 'INVALID_TYPE'),
      ]);
    }
    const unknownFields = Object.keys(source).filter(
      (field) => !allowed.has(field)
    );
    if (unknownFields.length > 0) {
      return sendValidationError(
        res,
        unknownFields.map((field) =>
          createIssue(
            `${section}.${field}`,
            'This field is not allowed.',
            'UNKNOWN_FIELD'
          )
        )
      );
    }
    return next();
  };
}
/**
 * Return middleware that checks a request section is a plain object.
 */
function requireObject(section = 'body') {
  return function requireObjectMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return sendValidationError(res, [
        createIssue(section, 'Expected an object.', 'INVALID_TYPE'),
      ]);
    }
    return next();
  };
}
/**
 * Return middleware that trims string fields in the selected request section.
 * Works on a safe copy and supports nested dot-separated field paths.
 */
function trimFields(fields = [], section = 'body') {
  return function trimFieldsMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return next();
    }
    const copy = clonePlainData(req[section]);
    try {
      for (const field of fields) {
        const currentValue = getNestedValue(copy, field);
        if (typeof currentValue === 'string') {
          setNestedValue(copy, field, normalizeString(currentValue));
        }
      }
      req[section] = copy;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
/**
 * Convert selected string fields to lowercase.
 * Useful for emails and other case-insensitive identifiers.
 */
function lowercaseFields(fields = [], section = 'body') {
  return function lowercaseFieldsMiddleware(req, res, next) {
    if (!isPlainObject(req[section])) {
      return next();
    }
    const copy = clonePlainData(req[section]);
    try {
      for (const field of fields) {
        const value = getNestedValue(copy, field);
        if (typeof value === 'string') {
          setNestedValue(copy, field, value.toLowerCase());
        }
      }
      req[section] = copy;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
/**
 * Ensure request data is not excessively large.
 * Configure express.json({ limit: '...'} ) as the primary body-size defense.
 */
function limitFieldLengths(limits = {}, section = 'body') {
  return function limitFieldLengthsMiddleware(req, res, next) {
    const source = req[section];
    if (!isPlainObject(source)) {
      return next();
    }
    const errors = [];
    for (const [field, maximum] of Object.entries(limits)) {
      const value = getNestedValue(source, field);
      if (typeof value === 'string' && value.length > maximum) {
        errors.push(
          createIssue(
            `${section}.${field}`,
            `Must contain no more than ${maximum} characters.`,
            'MAX_LENGTH'
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
 * Validate a Mongo-style or general 24-character hexadecimal identifier.
 * Use only when the application's identifier format requires it.
 */
function isObjectId(value) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}
/**
 * Validate a UUID string.
 */
function isUUID(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}
/**
 * Validate a numeric ID represented as a string.
 */
function isNumericId(value) {
  return (
    (typeof value === 'string' && /^[1-9]\d*$/.test(value)) ||
    (typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0)
  );
}
module.exports = {
  validate,
  rules,
  validateValue,
  sendValidationError,
  createIssue,
  allowOnlyFields,
  requireObject,
  trimFields,
  lowercaseFields,
  limitFieldLengths,
  getNestedValue,
  setNestedValue,
  clonePlainData,
  normalizeString,
  escapeHtml,
  escapeRegExp,
  isPlainObject,
  isObjectId,
  isUUID,
  isNumericId,
};