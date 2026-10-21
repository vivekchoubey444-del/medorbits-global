
'use strict';

/**
 * MedOrbits -- Payment Provider Interface
 *
 * File: src/integrations/payment/payment.provider.js
 * Runtime: Node.js >= 20
 *
 * Defines the contract for payment provider adapters.
 *
 * Required methods:
 * - createCheckout(request)
 * - fetchPayment(paymentId)
 * - verifyWebhook(rawBody, headers)
 *
 * Optional lifecycle method:
 * - close()
 *
 * This class does not process payments directly.
 */

const REQUIRED_METHODS = Object.freeze([
  'createCheckout',
  'fetchPayment',
  'verifyWebhook',
]);

const OPTIONAL_METHODS = Object.freeze([
  'close',
]);

class PaymentProvider {
  constructor() {
    if (new.target === PaymentProvider) {
      throw new TypeError(
        'PaymentProvider is abstract and cannot be instantiated directly.',
      );
    }

    this.validateImplementation();
  }

  validateImplementation() {
    for (const method of REQUIRED_METHODS) {
      const implementation = this[method];

      if (
        implementation === PaymentProvider.prototype[method] ||
        typeof implementation !== 'function'
      ) {
        throw new TypeError(
          `${this.constructor.name} must implement ${method}().`,
        );
      }
    }

    for (const method of OPTIONAL_METHODS) {
      if (
        this[method] !== undefined &&
        typeof this[method] !== 'function'
      ) {
        throw new TypeError(
          `${this.constructor.name}.${method} must be a function when provided.`,
        );
      }
    }
  }

  async createCheckout(_request) {
    throw new Error(
      'createCheckout() must be implemented by the provider.',
    );
  }

  async fetchPayment(_paymentId) {
    throw new Error(
      'fetchPayment() must be implemented by the provider.',
    );
  }

  async verifyWebhook(_rawBody, _headers) {
    throw new Error(
      'verifyWebhook() must be implemented by the provider.',
    );
  }

  async close() {
    // Optional lifecycle hook. Override when the provider owns
    // resources that need explicit cleanup.
  }
}

module.exports = {
  PaymentProvider,
  REQUIRED_METHODS,
  OPTIONAL_METHODS,
};
