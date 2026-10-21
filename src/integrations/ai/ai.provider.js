'use strict';

/**
 * MedOrbits -- Abstract AI Provider
 *
 * File: src/integrations/ai/ai.provider.js
 * Runtime: Node.js >= 20
 *
 * Contract:
 * - generateText(request): generate text using the configured AI service.
 * - close(): optionally release provider-owned resources.
 *
 * Provider-specific API requests, authentication, model selection,
 * timeouts, retries, and response parsing belong in concrete providers.
 */

const REQUIRED_METHODS = Object.freeze([
  'generateText',
]);

class AiProvider {
  constructor() {
    if (new.target === AiProvider) {
      throw new TypeError(
        'AiProvider is abstract and cannot be instantiated directly.',
      );
    }

    for (const method of REQUIRED_METHODS) {
      if (
        typeof this[method] !== 'function' ||
        this[method] === AiProvider.prototype[method]
      ) {
        throw new TypeError(
          `${new.target.name || 'AI provider'} must implement ${method}().`,
        );
      }
    }
  }

  async generateText(_request) {
    throw new Error(
      'AiProvider.generateText(request) must be implemented.',
    );
  }

  async close() {
    // Override only when the provider owns resources requiring cleanup.
  }
}

module.exports = {
  AiProvider,
  REQUIRED_METHODS,
};