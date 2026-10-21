
'use strict';

/**
 * MedOrbits -- Payment Webhook Signature Verification
 *
 * File: src/middleware/verify-webhook.js
 * Runtime: Node.js >= 20
 *
 * IMPORTANT:
 * This generic verifier is valid only for providers whose official
 * specification defines HMAC-SHA256 over the exact raw request body.
 * Use a dedicated verifier for timestamped or provider-specific schemes.
 */

const crypto = require('node:crypto');

const DEFAULT_HEADER = 'x-webhook-signature';
const MAX_SIGNATURE_LENGTH = 256;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  error.publicMessage = message;
  return error;
}

function validateOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Webhook verifier options must be an object.');
  }

  const secret =
    options.secret ??
    process.env.PAYMENT_WEBHOOK_SECRET;

  if (
    typeof secret !== 'string' ||
    Buffer.byteLength(secret, 'utf8') < 16
  ) {
    throw new Error(
      'PAYMENT_WEBHOOK_SECRET must be configured with at least 16 bytes.'
    );
  }

  const headerName = (
    options.headerName || DEFAULT_HEADER
  ).toLowerCase();

  if (
    !/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(headerName)
  ) {
    throw new TypeError('Invalid webhook signature header name.');
  }

  const prefix = options.prefix ?? '';

  if (
    typeof prefix !== 'string' ||
    prefix.length > 32
  ) {
    throw new TypeError('Webhook signature prefix is invalid.');
  }

  if (
    options.digestEncoding != null &&
    options.digestEncoding !== 'hex'
  ) {
    throw new TypeError(
      'Only hexadecimal signatures are supported by this verifier.'
    );
  }

  if (
    options.onVerified != null &&
    typeof options.onVerified !== 'function'
  ) {
    throw new TypeError('onVerified must be a function.');
  }

  return { secret, headerName, prefix };
}

function verifyWebhook(options = {}) {
  const {
    secret,
    headerName,
    prefix,
  } = validateOptions(options);

  function reject(next, status, code, message) {
    return next(createHttpError(status, code, message));
  }

  return function verifyWebhookMiddleware(req, res, next) {
    if (!Buffer.isBuffer(req.rawBody)) {
      return reject(
        next,
        400,
        'WEBHOOK_RAW_BODY_REQUIRED',
        'Raw webhook body is unavailable.'
      );
    }

    const suppliedHeader =
      typeof req.get === 'function'
        ? req.get(headerName)
        : req.headers?.[headerName];

    if (
      typeof suppliedHeader !== 'string' ||
      !suppliedHeader.length
    ) {
      return reject(
        next,
        401,
        'WEBHOOK_SIGNATURE_MISSING',
        'Webhook signature is missing.'
      );
    }

    // Reject oversized or ambiguous signature values before parsing.
    if (
      suppliedHeader.length > MAX_SIGNATURE_LENGTH ||
      suppliedHeader.trim() !== suppliedHeader
    ) {
      return reject(
        next,
        401,
        'WEBHOOK_SIGNATURE_INVALID',
        'Webhook signature is invalid.'
      );
    }

    let supplied = suppliedHeader;

    if (prefix) {
      if (!supplied.startsWith(prefix)) {
        return reject(
          next,
          401,
          'WEBHOOK_SIGNATURE_INVALID',
          'Webhook signature is invalid.'
        );
      }

      supplied = supplied.slice(prefix.length);
    }

    // SHA-256 hexadecimal digest is exactly 64 hexadecimal characters.
    if (!/^[a-fA-F0-9]{64}$/.test(supplied)) {
      return reject(
        next,
        401,
        'WEBHOOK_SIGNATURE_INVALID',
        'Webhook signature is invalid.'
      );
    }

    let expected;

    try {
      expected = crypto
        .createHmac('sha256', Buffer.from(secret, 'utf8'))
        .update(req.rawBody)
        .digest();
    } catch (error) {
      return next(error);
    }

    const received = Buffer.from(supplied, 'hex');

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return reject(
        next,
        401,
        'WEBHOOK_SIGNATURE_INVALID',
        'Webhook signature is invalid.'
      );
    }

    // Set only after successful signature verification.
    req.webhookVerified = true;
    req.webhookVerification = Object.freeze({
      scheme: 'hmac-sha256-raw-body',
      verifiedAt: new Date().toISOString(),
    });

    if (options.onVerified) {
      try {
        options.onVerified(req);
      } catch (error) {
        return next(error);
      }
    }

    return next();
  };
}

module.exports = verifyWebhook;
module.exports.createHttpError = createHttpError;
