
'use strict';

/**
 * MedOrbits -- Payment Integration Factory
 *
 * File: src/integrations/payment/index.js
 * Runtime: Node.js >= 20
 *
 * Creates the configured payment client and exposes provider interfaces.
 *
 * Security:
 * - Never expose provider credentials to frontend clients.
 * - Keep payment operations server-side.
 * - Verify webhook signatures in the webhook handling layer.
 * - Do not initialize an unconfigured payment provider.
 * - Do not silently fall back to another payment provider.
 */

const {
  PaymentClient,
} = require('./payment.client');

const {
  PaymentProvider,
} = require('./payment.provider');

const {
  RazorpayProvider,
} = require('./razorpay.provider');

const {
  StripeProvider,
} = require('./stripe.provider');

const {
  loadPaymentConfig,
} = require('./payment.config');

const SUPPORTED_PROVIDERS = Object.freeze([
  'razorpay',
  'stripe',
]);

const SUPPORTED_PROVIDER_SET = new Set(
  SUPPORTED_PROVIDERS,
);

function assertOptions(options) {
  if (
    !options ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError(
      'Payment options must be an object.',
    );
  }
}

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

  if (typeof provider.createPayment !== 'function') {
    throw new TypeError(
      'Payment provider must implement createPayment().',
    );
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

function validateConfig(config) {
  if (
    !config ||
    typeof config !== 'object' ||
    Array.isArray(config)
  ) {
    throw new TypeError(
      'Payment configuration is invalid.',
    );
  }

  if (!SUPPORTED_PROVIDER_SET.has(config.provider)) {
    throw new Error(
      `Unsupported payment provider: ${String(config.provider)}`,
    );
  }

  return config;
}

function createPaymentClient(options = {}) {
  assertOptions(options);

  const {
    provider: injectedProvider,
    config: suppliedConfig,
    env = process.env,
    clientOptions = {},
  } = options;

  if (
    !clientOptions ||
    typeof clientOptions !== 'object' ||
    Array.isArray(clientOptions)
  ) {
    throw new TypeError(
      'clientOptions must be an object.',
    );
  }

  // Injected providers are caller-owned by default.
  if (injectedProvider !== undefined) {
    return new PaymentClient(
      validateProvider(injectedProvider),
      {
        ...clientOptions,
        ownsProvider: clientOptions.ownsProvider === true,
      },
    );
  }

  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    throw new TypeError(
      'Payment environment must be an object.',
    );
  }

  const config = validateConfig(
    suppliedConfig || loadPaymentConfig(env),
  );

  let paymentProvider;

  switch (config.provider) {
    case 'razorpay':
      paymentProvider = suppliedConfig
        ? new RazorpayProvider(config)
        : RazorpayProvider.fromEnv(env);
      break;

    case 'stripe':
      paymentProvider = suppliedConfig
        ? new StripeProvider(config)
        : StripeProvider.fromEnv(env);
      break;

    default:
      // Defensive fallback if supported providers change later.
      throw new Error(
        'No supported payment provider is configured.',
      );
  }

  return new PaymentClient(
    validateProvider(paymentProvider),
    {
      ...clientOptions,
      ownsProvider: true,
    },
  );
}

module.exports = {
  createPaymentClient,
  validateProvider,
  validateConfig,
  SUPPORTED_PROVIDERS,
  PaymentClient,
  PaymentProvider,
  RazorpayProvider,
  StripeProvider,
  loadPaymentConfig,
};
