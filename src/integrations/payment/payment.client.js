
'use strict';

/**
 * MedOrbits -- Payment Client
 *
 * File: src/integrations/payment/payment.client.js
 * Runtime: Node.js >= 20
 *
 * Provides a provider-independent interface for:
 * - Checkout creation.
 * - Payment retrieval.
 * - Webhook signature verification.
 *
 * Security:
 * - Webhook verification requires original raw request bytes.
 * - Provider credentials must remain server-side.
 * - Payment status must be confirmed server-side.
 * - Provider ownership is explicit; injected providers are not
 *   closed unless ownership is transferred to this client.
 */

const REQUIRED_METHODS = Object.freeze([
  'createCheckout',
  'fetchPayment',
  'verifyWebhook',
]);

function validateProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider)
  ) {
    throw new TypeError(
      'A valid payment provider is required.',
    );
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof provider[method] !== 'function') {
      throw new TypeError(
        `Payment provider must implement ${method}().`,
      );
    }
  }

  if (
    provider.close !== undefined &&
    typeof provider.close !== 'function'
  ) {
    throw new TypeError(
      'Payment provider close, when provided, must be a function.',
    );
  }

  return provider;
}

function validateIdentifier(value, label) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 512 ||
    /[\u0000-\u001F\u007F]/u.test(value)
  ) {
    throw new TypeError(`A valid ${label} is required.`);
  }

  return value.trim();
}

class PaymentClient {
  #provider;
  #ownsProvider;
  #closed = false;
  #closePromise = null;

  constructor(provider, options = {}) {
    validateProvider(provider);

    if (
      !options ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        'Payment client options must be an object.',
      );
    }

    if (
      options.ownsProvider !== undefined &&
      typeof options.ownsProvider !== 'boolean'
    ) {
      throw new TypeError(
        'ownsProvider must be a boolean.',
      );
    }

    this.#provider = provider;
    this.#ownsProvider = options.ownsProvider === true;
  }

  #assertOpen() {
    if (this.#closed) {
      const error = new Error(
        'Payment client is closed.',
      );
      error.code = 'PAYMENT_CLIENT_CLOSED';
      throw error;
    }
  }

  async createCheckout(request) {
    this.#assertOpen();

    if (
      !request ||
      typeof request !== 'object' ||
      Array.isArray(request)
    ) {
      throw new TypeError(
        'Checkout request must be an object.',
      );
    }

    // Pass through the validated application request. The provider
    // remains responsible for provider-specific field validation,
    // amount/currency rules, and idempotency support.
    return this.#provider.createCheckout(request);
  }

  async fetchPayment(paymentId) {
    this.#assertOpen();

    const id = validateIdentifier(
      paymentId,
      'payment ID',
    );

    return this.#provider.fetchPayment(id);
  }

  async verifyWebhook(rawBody, headers) {
    this.#assertOpen();

    if (
      !Buffer.isBuffer(rawBody) &&
      !(rawBody instanceof Uint8Array)
    ) {
      throw new TypeError(
        'Webhook verification requires the original raw request bytes.',
      );
    }

    if (
      !headers ||
      typeof headers !== 'object' ||
      Array.isArray(headers)
    ) {
      throw new TypeError(
        'Webhook headers are required.',
      );
    }

    // Copy bytes to prevent later mutation of a caller-owned Uint8Array
    // from changing the payload passed to the provider.
    const body = Buffer.from(
      rawBody.buffer,
      rawBody.byteOffset,
      rawBody.byteLength,
    );

    return this.#provider.verifyWebhook(body, headers);
  }

  async close() {
    if (this.#closePromise) {
      return this.#closePromise;
    }

    this.#closed = true;

    this.#closePromise = (async () => {
      if (
        this.#ownsProvider &&
        typeof this.#provider.close === 'function'
      ) {
        await this.#provider.close();
      }
    })();

    return this.#closePromise;
  }
}

module.exports = {
  PaymentClient,
  REQUIRED_METHODS,
  validateProvider,
  validateIdentifier,
};
