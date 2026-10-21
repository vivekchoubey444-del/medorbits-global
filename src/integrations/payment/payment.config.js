
'use strict';

/**
 * MedOrbits -- Payment Configuration
 *
 * File: src/integrations/payment/payment.config.js
 * Runtime: Node.js >= 20
 *
 * Loads and validates payment provider configuration.
 *
 * Security:
 * - Provider secrets remain server-side.
 * - Only the selected provider's credentials are required.
 * - Webhook secrets are mandatory.
 * - Configuration objects are immutable.
 * - Never return this configuration from public API endpoints.
 */

const SUPPORTED_PROVIDERS = Object.freeze([
  'razorpay',
  'stripe',
]);

const SUPPORTED_CURRENCIES = Object.freeze([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
]);

const SUPPORTED_PROVIDER_SET = new Set(SUPPORTED_PROVIDERS);
const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCIES);

function readEnvString(env, name, { required = false } = {}) {
  const value = env[name];

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new Error(`${name} is required.`);
    }

    return '';
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a string.`);
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new Error(`${name} is required.`);
  }

  if (/[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new Error(`${name} contains invalid control characters.`);
  }

  return normalized;
}

function loadPaymentConfig(env = process.env) {
  if (
    !env ||
    typeof env !== 'object' ||
    Array.isArray(env)
  ) {
    throw new TypeError(
      'Payment environment configuration is required.',
    );
  }

  const provider = readEnvString(
    env,
    'PAYMENT_PROVIDER',
    { required: true },
  ).toLowerCase();

  if (!SUPPORTED_PROVIDER_SET.has(provider)) {
    throw new Error(
      'PAYMENT_PROVIDER must be razorpay or stripe.',
    );
  }

  const currency = (
    readEnvString(env, 'PAYMENT_CURRENCY') || 'INR'
  ).toUpperCase();

  if (!SUPPORTED_CURRENCY_SET.has(currency)) {
    throw new Error(
      'PAYMENT_CURRENCY is not supported by this configuration.',
    );
  }

  const razorpay = {
    keyId: '',
    keySecret: '',
    webhookSecret: '',
  };

  const stripe = {
    secretKey: '',
    webhookSecret: '',
  };

  if (provider === 'razorpay') {
    razorpay.keyId = readEnvString(
      env,
      'RAZORPAY_KEY_ID',
      { required: true },
    );

    razorpay.keySecret = readEnvString(
      env,
      'RAZORPAY_KEY_SECRET',
      { required: true },
    );

    razorpay.webhookSecret = readEnvString(
      env,
      'RAZORPAY_WEBHOOK_SECRET',
      { required: true },
    );
  }

  if (provider === 'stripe') {
    stripe.secretKey = readEnvString(
      env,
      'STRIPE_SECRET_KEY',
      { required: true },
    );

    stripe.webhookSecret = readEnvString(
      env,
      'STRIPE_WEBHOOK_SECRET',
      { required: true },
    );
  }

  const config = {
    provider,
    currency,
    razorpay: Object.freeze(razorpay),
    stripe: Object.freeze(stripe),
  };

  return Object.freeze(config);
}

module.exports = {
  loadPaymentConfig,
  SUPPORTED_PROVIDERS,
  SUPPORTED_CURRENCIES,
};
