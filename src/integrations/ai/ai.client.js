'use strict';

/**
 * MedOrbits -- AI Client
 *
 * File: src/integrations/ai/ai.client.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Validate text-generation requests.
 * - Delegate generation to an injected AI provider.
 * - Enforce configurable request and response limits.
 * - Prevent use after the client is closed.
 * - Support safe provider lifecycle management.
 *
 * Provider-specific API calls, prompts, model selection, credentials,
 * retries, and network timeouts belong in the provider/configuration layer.
 */

const DEFAULT_MAX_INPUT_LENGTH = 50_000;
const DEFAULT_MAX_OUTPUT_LENGTH = 200_000;

function positiveInteger(value, name, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(
      `${name} must be a positive safe integer.`,
    );
  }

  return value;
}

function validateRequest(request, maxInputLength = DEFAULT_MAX_INPUT_LENGTH) {
  positiveInteger(
    maxInputLength,
    'maxInputLength',
    DEFAULT_MAX_INPUT_LENGTH,
  );

  if (
    request === null ||
    typeof request !== 'object' ||
    Array.isArray(request)
  ) {
    throw new TypeError(
      'AI generation request must be an object.',
    );
  }

  if (typeof request.prompt !== 'string' || !request.prompt.trim()) {
    throw new TypeError('A non-empty prompt is required.');
  }

  const prompt = request.prompt.trim();

  if (prompt.length > maxInputLength) {
    throw new RangeError(
      'AI prompt exceeds the configured input limit.',
    );
  }

  return {
    ...request,
    prompt,
  };
}

function validateResponse(
  response,
  maxOutputLength = DEFAULT_MAX_OUTPUT_LENGTH,
) {
  positiveInteger(
    maxOutputLength,
    'maxOutputLength',
    DEFAULT_MAX_OUTPUT_LENGTH,
  );

  if (
    response === null ||
    typeof response !== 'object' ||
    Array.isArray(response)
  ) {
    throw new TypeError(
      'AI provider returned an invalid response.',
    );
  }

  if (typeof response.text !== 'string') {
    throw new TypeError(
      'AI provider response must contain a text string.',
    );
  }

  if (response.text.length > maxOutputLength) {
    throw new RangeError(
      'AI response exceeds the configured output limit.',
    );
  }

  return response;
}

class AiClient {
  #provider;
  #closed = false;
  #closePromise = null;
  #maxInputLength;
  #maxOutputLength;
  #ownsProvider;

  constructor(provider, options = {}) {
    if (
      !provider ||
      typeof provider.generateText !== 'function'
    ) {
      throw new TypeError(
        'AI provider must implement generateText(request).',
      );
    }

    if (
      options === null ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        'AI client options must be an object.',
      );
    }

    this.#maxInputLength = positiveInteger(
      options.maxInputLength,
      'maxInputLength',
      DEFAULT_MAX_INPUT_LENGTH,
    );

    this.#maxOutputLength = positiveInteger(
      options.maxOutputLength,
      'maxOutputLength',
      DEFAULT_MAX_OUTPUT_LENGTH,
    );

    if (
      options.ownsProvider !== undefined &&
      typeof options.ownsProvider !== 'boolean'
    ) {
      throw new TypeError(
        'ownsProvider must be a boolean.',
      );
    }

    // Provider ownership is explicit to avoid closing shared clients.
    this.#ownsProvider = options.ownsProvider === true;
    this.#provider = provider;
  }

  get isClosed() {
    return this.#closed;
  }

  async generateText(request) {
    if (this.#closed) {
      throw new Error('AI client is closed.');
    }

    const validatedRequest = validateRequest(
      request,
      this.#maxInputLength,
    );

    const response = await this.#provider.generateText(
      validatedRequest,
    );

    return validateResponse(
      response,
      this.#maxOutputLength,
    );
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
  AiClient,
  validateRequest,
  validateResponse,
  positiveInteger,
  DEFAULT_MAX_INPUT_LENGTH,
  DEFAULT_MAX_OUTPUT_LENGTH,
};