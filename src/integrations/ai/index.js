'use strict';

/**
 * MedOrbits -- AI Integration Entry Point
 *
 * File: src/integrations/ai/index.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Construct a configured AI client.
 * - Support injected providers for testing and alternative backends.
 * - Expose the provider contract and configuration loader.
 * - Keep provider construction separate from application business logic.
 * - Avoid network requests or background work during module import.
 *
 * Provider credentials must come from secure environment configuration.
 */

const { AiClient } = require('./ai.client');
const { AiProvider } = require('./ai.provider');
const { OpenAiProvider } = require('./openai.provider');
const { loadAiConfig } = require('./ai.config');

function validateProvider(provider) {
  if (
    !provider ||
    typeof provider !== 'object' ||
    Array.isArray(provider)
  ) {
    throw new TypeError('A valid AI provider instance is required.');
  }

  if (typeof provider.generateText !== 'function') {
    throw new TypeError(
      'AI provider must implement generateText(request).',
    );
  }

  if (
    provider.close !== undefined &&
    provider.close !== null &&
    typeof provider.close !== 'function'
  ) {
    throw new TypeError(
      'AI provider close must be a function when provided.',
    );
  }

  return provider;
}

function validateOptions(options) {
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('AI client options must be an object.');
  }

  if (
    options.provider !== undefined &&
    options.provider !== null &&
    options.config !== undefined
  ) {
    throw new TypeError(
      'Provide either an injected provider or provider configuration, not both.',
    );
  }

  if (
    options.env !== undefined &&
    (
      options.env === null ||
      typeof options.env !== 'object' ||
      Array.isArray(options.env)
    )
  ) {
    throw new TypeError('AI environment options must be an object.');
  }

  if (
    options.clientOptions !== undefined &&
    (
      options.clientOptions === null ||
      typeof options.clientOptions !== 'object' ||
      Array.isArray(options.clientOptions)
    )
  ) {
    throw new TypeError('clientOptions must be an object.');
  }
}

function createAiClient(options = {}) {
  validateOptions(options);

  let provider;
  let ownsProvider;

  if (options.provider !== undefined && options.provider !== null) {
    provider = validateProvider(options.provider);

    // Injected providers are shared or externally managed by default.
    ownsProvider = options.ownsProvider === true;
  } else {
    const config = options.config !== undefined
      ? options.config
      : loadAiConfig(options.env || process.env);

    provider = new OpenAiProvider(config);
    validateProvider(provider);

    // A provider created here is owned by this client.
    ownsProvider = true;
  }

  if (
    options.ownsProvider !== undefined &&
    typeof options.ownsProvider !== 'boolean'
  ) {
    throw new TypeError('ownsProvider must be a boolean.');
  }

  return new AiClient(provider, {
    ...(options.clientOptions || {}),
    ownsProvider,
  });
}

module.exports = {
  createAiClient,
  validateProvider,
  AiClient,
  AiProvider,
  OpenAiProvider,
  loadAiConfig,
};