
'use strict';

/**
 * MedOrbits -- Stripe Payment Provider
 *
 * File: src/integrations/payment/stripe.provider.js
 * Runtime: Node.js >= 20
 *
 * Implements:
 * - createCheckout()
 * - fetchPayment()
 * - verifyWebhook()
 * - close()
 *
 * Security:
 * - Stripe credentials remain server-side.
 * - Webhooks require the original raw request bytes.
 * - Checkout URLs must use HTTPS.
 * - Payment completion must be verified before fulfillment.
 * - Checkout amounts must originate from trusted server-side pricing.
 */

const { PaymentProvider } = require('./payment.provider');
const { loadPaymentConfig } = require('./payment.config');
const { verifyStripeWebhook } = require('./webhook-verifier');

const SUPPORTED_CURRENCIES = new Set([
  'inr',
  'usd',
  'eur',
  'gbp',
  'aud',
  'cad',
  'sgd',
]);

const MAX_METADATA_ENTRIES = 50;
const MAX_METADATA_KEY_LENGTH = 40;
const MAX_METADATA_VALUE_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_PRODUCT_NAME_LENGTH = 250;
const MAX_SESSION_ID_LENGTH = 255;

function normalizeCurrency(currency) {
  if (typeof currency !== 'string') {
    throw new TypeError('Currency must be a string.');
  }

  const normalized = currency.trim().toLowerCase();

  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new TypeError('Unsupported Stripe currency.');
  }

  return normalized;
}

function validateAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new TypeError(
      'Amount must be a positive integer in the smallest currency unit.',
    );
  }

  return amount;
}

function validateHttpsUrl(value, fieldName) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_URL_LENGTH ||
    value !== value.trim()
  ) {
    throw new TypeError(
      `${fieldName} must be a valid HTTPS URL.`,
    );
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(
      `${fieldName} must be a valid HTTPS URL.`,
    );
  }

  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.hostname.endsWith('.')
  ) {
    throw new TypeError(
      `${fieldName} must use HTTPS and cannot contain URL credentials.`,
    );
  }

  return parsed.toString();
}

function validateMetadata(metadata = {}) {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata)
  ) {
    throw new TypeError('Metadata must be an object.');
  }

  const entries = Object.entries(metadata);

  if (entries.length > MAX_METADATA_ENTRIES) {
    throw new RangeError('Too many Stripe metadata fields.');
  }

  const result = Object.create(null);

  for (const [key, value] of entries) {
    if (
      !key ||
      key.length > MAX_METADATA_KEY_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(key) ||
      typeof value !== 'string' ||
      value.length > MAX_METADATA_VALUE_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(value)
    ) {
      throw new TypeError(
        'Metadata keys and values must be valid strings within Stripe limits.',
      );
    }

    result[key] = value;
  }

  return result;
}

function validateSessionId(sessionId) {
  if (
    typeof sessionId !== 'string' ||
    sessionId.length > MAX_SESSION_ID_LENGTH ||
    !/^cs_(?:test|live)_[a-zA-Z0-9]+$/u.test(sessionId)
  ) {
    throw new TypeError(
      'Invalid Stripe Checkout Session ID.',
    );
  }

  return sessionId;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length === 1 && typeof value[0] === 'string'
      ? value[0]
      : null;
  }

  return typeof value === 'string' ? value : null;
}

class StripeProvider extends PaymentProvider {
  constructor({
    client,
    webhookSecret,
    currency = 'inr',
    ownsClient = true,
  } = {}) {
    super();

    if (
      !client ||
      typeof client !== 'object' ||
      !client.checkout ||
      !client.checkout.sessions ||
      typeof client.checkout.sessions.create !== 'function' ||
      typeof client.checkout.sessions.retrieve !== 'function' ||
      !client.webhooks ||
      typeof client.webhooks.constructEvent !== 'function'
    ) {
      throw new TypeError(
        'A valid Stripe SDK client is required.',
      );
    }

    if (
      typeof webhookSecret !== 'string' ||
      !webhookSecret.trim() ||
      /[\u0000-\u001F\u007F]/u.test(webhookSecret)
    ) {
      throw new TypeError(
        'Stripe webhook secret is required.',
      );
    }

    if (typeof ownsClient !== 'boolean') {
      throw new TypeError('ownsClient must be a boolean.');
    }

    this.client = client;
    this.webhookSecret = webhookSecret;
    this.currency = normalizeCurrency(currency);
    this.ownsClient = ownsClient;
    this.closed = false;
    this.closePromise = null;
  }

  static fromEnv(environment = process.env) {
    if (
      !environment ||
      typeof environment !== 'object' ||
      Array.isArray(environment)
    ) {
      throw new TypeError(
        'Payment environment configuration is required.',
      );
    }

    const config = loadPaymentConfig({
      ...environment,
      PAYMENT_PROVIDER: 'stripe',
    });

    const credentials = config.stripe;

    if (!credentials.secretKey || !credentials.webhookSecret) {
      throw new Error(
        'Stripe secret key and webhook secret are required.',
      );
    }

    let Stripe;

    try {
      Stripe = require('stripe');
    } catch {
      throw new Error(
        'Stripe integration requires the stripe package.',
      );
    }

    const client = new Stripe(credentials.secretKey);

    return new StripeProvider({
      client,
      webhookSecret: credentials.webhookSecret,
      currency: config.currency,
      ownsClient: true,
    });
  }

  assertOpen() {
    if (this.closed) {
      const error = new Error(
        'Stripe payment provider is closed.',
      );
      error.code = 'PAYMENT_PROVIDER_CLOSED';
      throw error;
    }
  }

  async createCheckout({
    amount,
    currency = this.currency,
    successUrl,
    cancelUrl,
    metadata = {},
    productName = 'MedOrbits service',
  } = {}) {
    this.assertOpen();

    const validatedAmount = validateAmount(amount);
    const validatedCurrency = normalizeCurrency(currency);

    const validatedSuccessUrl = validateHttpsUrl(
      successUrl,
      'successUrl',
    );

    const validatedCancelUrl = validateHttpsUrl(
      cancelUrl,
      'cancelUrl',
    );

    const validatedMetadata = validateMetadata(metadata);

    if (
      typeof productName !== 'string' ||
      !productName.trim() ||
      productName.length > MAX_PRODUCT_NAME_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(productName)
    ) {
      throw new TypeError('Invalid checkout product name.');
    }

    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: validatedCurrency,
            unit_amount: validatedAmount,
            product_data: {
              name: productName.trim(),
            },
          },
          quantity: 1,
        },
      ],
      success_url: validatedSuccessUrl,
      cancel_url: validatedCancelUrl,
      metadata: validatedMetadata,
    });

    if (
      !session ||
      typeof session.id !== 'string' ||
      !/^cs_(?:test|live)_[a-zA-Z0-9]+$/u.test(session.id) ||
      typeof session.url !== 'string'
    ) {
      throw new Error(
        'Stripe returned an invalid Checkout Session response.',
      );
    }

    // Never trust a provider-returned URL without validating it.
    const checkoutUrl = validateHttpsUrl(
      session.url,
      'Stripe checkout URL',
    );

    return {
      provider: 'stripe',
      sessionId: session.id,
      checkoutUrl,
      paymentStatus:
        typeof session.payment_status === 'string'
          ? session.payment_status
          : 'unpaid',
    };
  }

  async fetchPayment(sessionId) {
    this.assertOpen();

    const validatedId = validateSessionId(sessionId);

    const session =
      await this.client.checkout.sessions.retrieve(validatedId);

    if (
      !session ||
      session.id !== validatedId ||
      typeof session.payment_status !== 'string'
    ) {
      throw new Error(
        'Stripe returned an invalid Checkout Session response.',
      );
    }

    return {
      provider: 'stripe',
      id: session.id,
      paymentIntent:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      amount: Number.isSafeInteger(session.amount_total)
        ? session.amount_total
        : null,
      currency:
        typeof session.currency === 'string'
          ? session.currency
          : null,
      status: session.payment_status,
      checkoutStatus:
        typeof session.status === 'string'
          ? session.status
          : null,
    };
  }

  async verifyWebhook(rawBody, headers) {
    this.assertOpen();

    if (
      !Buffer.isBuffer(rawBody) &&
      !(rawBody instanceof Uint8Array)
    ) {
      throw new TypeError(
        'Stripe webhook verification requires the original raw request bytes.',
      );
    }

    if (
      !headers ||
      typeof headers !== 'object' ||
      Array.isArray(headers)
    ) {
      throw new TypeError('Webhook headers are required.');
    }

    const signature = normalizeHeaderValue(
      headers['stripe-signature'] ??
        headers['Stripe-Signature'],
    );

    if (!signature || !signature.trim()) {
      return false;
    }

    // verifyStripeWebhook returns the verified event object or false.
    return verifyStripeWebhook(
      Buffer.from(
        rawBody.buffer,
        rawBody.byteOffset,
        rawBody.byteLength,
      ),
      signature,
      this.webhookSecret,
      this.client,
    );
  }

  async close() {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;

    this.closePromise = Promise.resolve().then(() => {
      if (
        this.ownsClient &&
        typeof this.client.close === 'function'
      ) {
        return this.client.close();
      }

      // Stripe's SDK generally doesn't require an explicit close.
      // If supported by the HTTP client version, destroy it.
      if (
        this.ownsClient &&
        typeof this.client.destroy === 'function'
      ) {
        return this.client.destroy();
      }
    });

    return this.closePromise;
  }
}

module.exports = {
  StripeProvider,
  normalizeCurrency,
  validateAmount,
  validateHttpsUrl,
  validateMetadata,
  validateSessionId,
};
