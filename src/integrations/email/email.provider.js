
'use strict';

/**
 * MedOrbits -- Abstract Email Provider
 *
 * File: src/integrations/email/email.provider.js
 * Runtime: Node.js >= 20
 *
 * Contract:
 * - send(message): deliver a validated email message.
 * - close(): release provider resources when supported.
 *
 * Implementations may include SMTP or another approved email service.
 * This module does not implement transport, retries, templates,
 * queues, or delivery tracking.
 */

const REQUIRED_METHODS = Object.freeze(['send']);

class EmailProvider {
  constructor() {
    if (new.target === EmailProvider) {
      throw new TypeError(
        'EmailProvider is abstract and cannot be instantiated directly.',
      );
    }

    for (const method of REQUIRED_METHODS) {
      if (
        typeof this[method] !== 'function' ||
        this[method] === EmailProvider.prototype[method]
      ) {
        throw new TypeError(
          `${new.target.name || 'Email provider'} must implement ${method}().`,
        );
      }
    }
  }

  async send(_message) {
    throw new Error(
      'EmailProvider.send(message) must be implemented.',
    );
  }

  async close() {
    // Override when the provider owns resources that need cleanup.
  }
}

function validateEmailProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider)
  ) {
    throw new TypeError(
      'A valid email provider instance is required.',
    );
  }

  if (typeof provider.send !== 'function') {
    throw new TypeError(
      'Email provider must implement send(message).',
    );
  }

  if (
    provider.close !== undefined &&
    provider.close !== null &&
    typeof provider.close !== 'function'
  ) {
    throw new TypeError(
      'Email provider close must be a function when provided.',
    );
  }

  return provider;
}

module.exports = {
  EmailProvider,
  REQUIRED_METHODS,
  validateEmailProvider,
};
