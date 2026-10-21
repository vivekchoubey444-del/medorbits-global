
'use strict';

/**
 * MedOrbits -- Payment Configuration
 * File: src/config/payment.js
 *
 * Responsibilities:
 * - Centralize payment provider configuration.
 * - Validate enabled providers and required credentials.
 * - Prevent ambiguous multi-provider configuration.
 * - Validate payment mode and currency.
 * - Keep payment secrets out of logs and public responses.
 *
 * IMPORTANT:
 * This module validates configuration only. It does not create orders,
 * verify payment signatures, process webhooks, or confirm settlements.
 */

const { env } = require('./env');

const SUPPORTED_PROVIDERS = Object.freeze([
  'razorpay',
  'cashfree',
  'stripe',
]);

const SUPPORTED_CURRENCIES = new Set([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
]);

const SUPPORTED_MODES = new Set([
  'test',
  'live',
]);

function isPresent(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireValue(value, name) {
  if (!isPresent(value)) {
    throw new Error(
      `${name} is required for the enabled payment provider.`
    );
  }

  return value.trim();
}

function deepFreeze(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Object.isFrozen(value)
  ) {
    Object.freeze(value);

    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }

  return value;
}

function getPaymentConfig() {
  const currency = String(env.PAYMENT_CURRENCY || 'INR')
    .trim()
    .toUpperCase();

  const mode = String(env.PAYMENT_MODE || 'test')
    .trim()
    .toLowerCase();

  const config = {
    enabled: env.PAYMENTS_ENABLED === true,
    mode,
    currency,

    razorpay: {
      enabled: env.RAZORPAY_ENABLED === true,
      keyId: env.RAZORPAY_KEY_ID || '',
      keySecret: env.RAZORPAY_KEY_SECRET || '',
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
    },

    cashfree: {
      enabled: env.CASHFREE_ENABLED === true,
      appId: env.CASHFREE_APP_ID || '',
      secretKey: env.CASHFREE_SECRET_KEY || '',
      webhookSecret: env.CASHFREE_WEBHOOK_SECRET || '',
    },

    stripe: {
      enabled: env.STRIPE_ENABLED === true,
      secretKey: env.STRIPE_SECRET_KEY || '',
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    },
  };

  return deepFreeze(config);
}

function validateMode(mode) {
  if (!SUPPORTED_MODES.has(mode)) {
    throw new Error(
      `PAYMENT_MODE must be one of: ${[
        ...SUPPORTED_MODES,
      ].join(', ')}.`
    );
  }
}

function validateCurrency(currency) {
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    throw new Error(
      `Unsupported PAYMENT_CURRENCY "${currency}".`
    );
  }
}

function validateProviderSelection(config) {
  const enabledProviders = SUPPORTED_PROVIDERS.filter(
    (provider) => config[provider].enabled
  );

  if (enabledProviders.length !== 1) {
    throw new Error(
      'Enable exactly one payment provider when PAYMENTS_ENABLED=true.'
    );
  }

  return enabledProviders[0];
}

function validateModeConsistency(secret, mode, variableName) {
  if (variableName === 'STRIPE_SECRET_KEY') {
    if (
      mode === 'live' &&
      !secret.startsWith('sk_live_')
    ) {
      throw new Error(
        'PAYMENT_MODE=live requires a live Stripe secret key.'
      );
    }

    if (
      mode === 'test' &&
      !secret.startsWith('sk_test_')
    ) {
      throw new Error(
        'PAYMENT_MODE=test requires a test Stripe secret key.'
      );
    }
  }

  if (variableName === 'RAZORPAY_KEY_ID') {
    if (
      mode === 'live' &&
      !secret.startsWith('rzp_live_')
    ) {
      throw new Error(
        'PAYMENT_MODE=live requires a live Razorpay key ID.'
      );
    }

    if (
      mode === 'test' &&
      !secret.startsWith('rzp_test_')
    ) {
      throw new Error(
        'PAYMENT_MODE=test requires a test Razorpay key ID.'
      );
    }
  }
}

function validateProviderCredentials(config, provider) {
  switch (provider) {
    case 'razorpay': {
      const payment = config.razorpay;

      requireValue(payment.keyId, 'RAZORPAY_KEY_ID');
      requireValue(
        payment.keySecret,
        'RAZORPAY_KEY_SECRET'
      );
      requireValue(
        payment.webhookSecret,
        'RAZORPAY_WEBHOOK_SECRET'
      );

      validateModeConsistency(
        payment.keyId,
        config.mode,
        'RAZORPAY_KEY_ID'
      );

      break;
    }

    case 'cashfree': {
      const payment = config.cashfree;

      requireValue(payment.appId, 'CASHFREE_APP_ID');
      requireValue(
        payment.secretKey,
        'CASHFREE_SECRET_KEY'
      );
      requireValue(
        payment.webhookSecret,
        'CASHFREE_WEBHOOK_SECRET'
      );

      break;
    }

    case 'stripe': {
      const payment = config.stripe;

      requireValue(
        payment.secretKey,
        'STRIPE_SECRET_KEY'
      );
      requireValue(
        payment.webhookSecret,
        'STRIPE_WEBHOOK_SECRET'
      );

      validateModeConsistency(
        payment.secretKey,
        config.mode,
        'STRIPE_SECRET_KEY'
      );

      break;
    }

    default:
      throw new Error('Unsupported payment provider.');
  }
}

function validatePaymentConfiguration() {
  const config = getPaymentConfig();

  // Disabled payments do not require provider credentials.
  if (!config.enabled) {
    return true;
  }

  validateMode(config.mode);
  validateCurrency(config.currency);

  const provider = validateProviderSelection(config);

  validateProviderCredentials(config, provider);

  return true;
}

module.exports = {
  getPaymentConfig,
  validatePaymentConfiguration,
};
