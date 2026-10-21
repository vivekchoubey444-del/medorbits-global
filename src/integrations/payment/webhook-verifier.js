
'use strict';

/**
 * MedOrbits -- Payment Webhook Signature Verification
 *
 * File: src/integrations/payment/webhook-signature.js
 * Runtime: Node.js >= 20
 *
 * Security:
 * - Verify signatures against the original raw request bytes.
 * - Use constant-time comparison for hexadecimal HMAC signatures.
 * - Use the official Stripe SDK for Stripe signature verification.
 * - Never process payment events before signature verification succeeds.
 */

const crypto = require('node:crypto');

const HEX_SIGNATURE_PATTERN = /^[a-f0-9]+$/i;
const SHA256_HEX_LENGTH = 64;
const MAX_SIGNATURE_LENGTH = 512;

function safeEqualHex(expected, received) {
  if (
    typeof expected !== 'string' ||
    typeof received !== 'string' ||
    expected.length === 0 ||
    received.length === 0 ||
    expected.length > MAX_SIGNATURE_LENGTH ||
    received.length > MAX_SIGNATURE_LENGTH ||
    expected.length % 2 !== 0 ||
    received.length % 2 !== 0 ||
    !HEX_SIGNATURE_PATTERN.test(expected) ||
    !HEX_SIGNATURE_PATTERN.test(received)
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');

  if (
    expectedBuffer.length === 0 ||
    expectedBuffer.length !== receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

function validateRawBody(rawBody) {
  if (!Buffer.isBuffer(rawBody)) {
    throw new TypeError(
      'rawBody must be the exact raw request Buffer.',
    );
  }
}

function validateSecret(secret, label = 'Webhook secret') {
  if (
    typeof secret !== 'string' ||
    secret.length === 0 ||
    secret.trim().length === 0 ||
    /[\u0000-\u001F\u007F]/u.test(secret)
  ) {
    throw new TypeError(`${label} is required.`);
  }
}

function verifyHmacSha256(rawBody, signature, secret) {
  validateRawBody(rawBody);
  validateSecret(secret);

  if (
    typeof signature !== 'string' ||
    signature.length !== SHA256_HEX_LENGTH ||
    !HEX_SIGNATURE_PATTERN.test(signature)
  ) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return safeEqualHex(expected, signature);
}

/**
 * Verify Razorpay webhook signatures.
 *
 * Razorpay webhook signatures use HMAC-SHA256 over the exact raw
 * request body, represented as a hexadecimal signature.
 */
function verifyRazorpayWebhook(rawBody, signature, secret) {
  return verifyHmacSha256(rawBody, signature, secret);
}

/**
 * Verify Stripe webhooks using the official Stripe SDK.
 *
 * Stripe signatures contain timestamp and signature components.
 * Do not treat the complete Stripe-Signature header as a plain
 * hexadecimal HMAC.
 */
function verifyStripeWebhook(
  rawBody,
  signature,
  secret,
  stripe,
) {
  validateRawBody(rawBody);
  validateSecret(secret, 'Stripe webhook secret');

  if (
    typeof signature !== 'string' ||
    signature.length === 0 ||
    signature.length > MAX_SIGNATURE_LENGTH ||
    /[\r\n\0]/u.test(signature)
  ) {
    return false;
  }

  if (
    !stripe ||
    typeof stripe !== 'object' ||
    !stripe.webhooks ||
    typeof stripe.webhooks.constructEvent !== 'function'
  ) {
    throw new TypeError(
      'A valid Stripe SDK instance is required.',
    );
  }

  try {
    // Successful construction verifies the signature and payload.
    // Return the verified event so callers can process the exact
    // event that was authenticated.
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    );
  } catch {
    // Do not authorize malformed payloads or invalid signatures.
    return false;
  }
}

module.exports = {
  safeEqualHex,
  verifyHmacSha256,
  verifyRazorpayWebhook,
  verifyStripeWebhook,
};
