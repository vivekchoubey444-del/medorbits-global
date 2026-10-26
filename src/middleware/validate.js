
'use strict';

/**
 * MedOrbits -- Request Validation Middleware
 *
 * File: src/middleware/validate.js
 * Runtime: Node.js >= 20
 *
 * Supports:
 * - Zod: safeParseAsync / safeParse
 * - Joi: validateAsync / validate
 * - Custom synchronous or asynchronous validation functions
 *
 * Validated values replace req.body, req.params, or req.query.
 */

const ALLOWED_TARGETS = new Set([
  'body',
  'params',
  'query',
  'all',
]);

const MAX_VALIDATION_DETAILS = 100;

function badRequest(
  message = 'Request validation failed.',
  details
) {
  const error = new Error(message);
  error.status = 400;
  error.statusCode = 400;
  error.code = 'VALIDATION_ERROR';
  error.publicMessage = message;

  if (Array.isArray(details)) {
    error.details = details.slice(0, MAX_VALIDATION_DETAILS);
  }

  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function normalizeDetails(details) {
  if (!Array.isArray(details)) {
    return undefined;
  }

  return details.slice(0, MAX_VALIDATION_DETAILS).map((detail) => {
    if (!detail || typeof detail !== 'object') {
      return {
        message: 'Invalid value.',
      };
    }

    const path = Array.isArray(detail.path)
      ? detail.path
          .filter(
            (part) =>
              typeof part === 'string' ||
              (typeof part === 'number' &&
                Number.isSafeInteger(part) &&
                part >= 0)
          )
          .slice(0, 20)
      : Array.isArray(detail.context?.key)
        ? detail.context.key.slice(0, 20)
        : undefined;

    const message =
      typeof detail.message === 'string'
        ? detail.message.slice(0, 300)
        : 'Invalid value.';

    const result = { message };

    if (path && path.length) {
      result.path = path;
    }

    if (
      typeof detail.code === 'string' &&
      /^[A-Za-z0-9_.-]{1,80}$/.test(detail.code)
    ) {
      result.code = detail.code;
    }

    return result;
  });
}

function validationError(details) {
  return badRequest(
    'Request validation failed.',
    normalizeDetails(details)
  );
}

function validate(schema, options = {}) {
  if (
    !schema ||
    (
      typeof schema !== 'function' &&
      typeof schema !== 'object'
    )
  ) {
    throw new TypeError(
      'A validation schema or function is required.'
    );
  }

  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Validation options must be an object.');
  }

  const target = options.target ?? 'body';

  if (!ALLOWED_TARGETS.has(target)) {
    throw new TypeError(
      'target must be body, params, query, or all.'
    );
  }

  const targets =
    target === 'all'
      ? ['body', 'params', 'query']
      : [target];

  const validationOptions = {
    abortEarly: false,
    stripUnknown: true,
    ...(options.joiOptions || {}),
  };

  if (
    options.joiOptions != null &&
    (
      !isPlainObject(options.joiOptions)
    )
  ) {
    throw new TypeError('joiOptions must be a plain object.');
  }

  return async function validateMiddleware(req, res, next) {
    if (!req || typeof req !== 'object') {
      return next(
        new TypeError('A valid Express request is required.')
      );
    }

    try {
      for (const key of targets) {
        const input = req[key] ?? {};

        let result;

        if (typeof schema.safeParseAsync === 'function') {
          result = await schema.safeParseAsync(input);

          if (!result || result.success !== true) {
            return next(
              validationError(result?.error?.issues)
            );
          }

          req[key] = result.data;
          continue;
        }

        if (typeof schema.safeParse === 'function') {
          result = schema.safeParse(input);

          if (!result || result.success !== true) {
            return next(
              validationError(result?.error?.issues)
            );
          }

          req[key] = result.data;
          continue;
        }

        if (typeof schema.validateAsync === 'function') {
          try {
            req[key] = await schema.validateAsync(
              input,
              validationOptions
            );
          } catch (error) {
            if (error?.isJoi || error?.name === 'ValidationError') {
              return next(
                validationError(error.details)
              );
            }

            return next(error);
          }

          continue;
        }

        if (typeof schema.validate === 'function') {
          result = schema.validate(
            input,
            validationOptions
          );

          if (result?.error) {
            return next(
              validationError(result.error.details)
            );
          }

          if (!result || !Object.prototype.hasOwnProperty.call(result, 'value')) {
            return next(
              new TypeError(
                'The schema validate() method returned an invalid result.'
              )
            );
          }

          req[key] = result.value;
          continue;
        }

        if (typeof schema === 'function') {
          result = await schema(input, req);

          if (result instanceof Error) {
            return next(result);
          }

          if (result === false) {
            return next(validationError());
          }

          if (
            result &&
            typeof result === 'object' &&
            result.valid === false
          ) {
            return next(
              validationError(result.errors)
            );
          }

          if (
            result === true ||
            result === undefined ||
            result === null
          ) {
            continue;
          }

          if (
            result &&
            typeof result === 'object' &&
            Object.prototype.hasOwnProperty.call(result, 'value')
          ) {
            req[key] = result.value;
            continue;
          }

          // Explicitly reject ambiguous custom-validator return values.
          return next(
            new TypeError(
              'Custom validator must return true, undefined, an Error, false, or { valid, errors, value }.'
            )
          );
        }

        throw new TypeError(
          'Unsupported validation schema. Use Zod, Joi, or a custom function.'
        );
      }

      return next();
    } catch (error) {
      if (
        error &&
        Number.isInteger(error.status) &&
        error.status >= 400 &&
        error.status <= 599
      ) {
        return next(error);
      }

      if (
        error?.isJoi ||
        error?.name === 'ZodError' ||
        error?.name === 'ValidationError'
      ) {
        return next(
          validationError(error.details || error.issues)
        );
      }

      return next(error);
    }
  };
}

module.exports = validate;
module.exports.validate = validate;
module.exports.badRequest = badRequest;
module.exports.normalizeDetails = normalizeDetails;
