
'use strict';

/**
 * MedOrbits -- Razorpay Payment Provider
 *
 * File: src/integrations/payment/razorpay.provider.js
 * Runtime: Node.js >= 20
 *
 * Implements:
 * - createCheckout()
 * - fetchPayment()
 * - verifyWebhook()
 * - close()
 *
 * Security:
 * - Keep Razorpay credentials server-side.
 * - Verify webhooks using original raw request bytes.
 * - Never treat checkout creation as proof of payment.
 * - Validate payment identifiers and provider responses.
 * - Do not expose key secrets or webhook secrets.
 */

const { PaymentProvider } = require('./payment.provider');
const { loadPaymentConfig } = require('./payment.config');
const { verifyRazorpayWebhook } = require('./webhook-verifier');

const SUPPORTED_CURRENCIES = new Set([
  'INR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'SGD',
]);

const MAX_RECEIPT_LENGTH = 40;
const MAX_NOTES_COUNT = 15;
const MAX_NOTE_KEY_LENGTH = 256;
const MAX_NOTE_VALUE_LENGTH = 256;
const MAX_PAYMENT_ID_LENGTH = 64;
const MAX_ORDER_ID_LENGTH = 64;

function normalizeCurrency(currency) {
  if (typeof currency !== 'string') {
    throw new TypeError('Currency must be a string.');
  }

  const normalized = currency.trim().toUpperCase();

  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new TypeError('Unsupported payment currency.');
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

function validateReceipt(receipt) {
  if (
    typeof receipt !== 'string' ||
    !receipt.trim() ||
    receipt.length > MAX_RECEIPT_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/u.test(receipt)
  ) {
    throw new TypeError(
      'Receipt must contain 1–40 alphanumeric characters, underscores, or hyphens.',
    );
  }

  return receipt;
}

function validateNotes(notes = {}) {
  if (
    !notes ||
    typeof notes !== 'object' ||
    Array.isArray(notes)
  ) {
    throw new TypeError('Notes must be an object.');
  }

  const entries = Object.entries(notes);

  if (entries.length > MAX_NOTES_COUNT) {
    throw new RangeError('Too many checkout note fields.');
  }

  const result = Object.create(null);

  for (const [key, value] of entries) {
    if (
      !key ||
      key.length > MAX_NOTE_KEY_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(key) ||
      typeof value !== 'string' ||
      value.length > MAX_NOTE_VALUE_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(value)
    ) {
      throw new TypeError('Invalid checkout note.');
    }

    result[key] = value;
  }

  return result;
}

function validatePaymentId(paymentId) {
  if (
    typeof paymentId !== 'string' ||
    paymentId.length > MAX_PAYMENT_ID_LENGTH ||
    !/^pay_[a-zA-Z0-9]+$/u.test(paymentId)
  ) {
    throw new TypeError('Invalid Razorpay payment ID.');
  }

  return paymentId;
}

function validateOrderId(orderId) {
  if (
    typeof orderId !== 'string' ||
    orderId.length > MAX_ORDER_ID_LENGTH ||
    !/^order_[a-zA-Z0-9]+$/u.test(orderId)
  ) {
    throw new TypeError('Invalid Razorpay order ID.');
  }

  return orderId;
}

function normalizeHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length === 1 && typeof value[0] === 'string'
      ? value[0]
      : null;
  }

  return typeof value === 'string' ? value : null;
}

class RazorpayProvider extends PaymentProvider {
  constructor({
    client,
    keyId,
    webhookSecret,
    currency = 'INR',
    ownsClient = true,
  } = {}) {
    super();

    if (
      !client ||
      typeof client !== 'object' ||
      !client.orders ||
      typeof client.orders.create !== 'function' ||
      !client.payments ||
      typeof client.payments.fetch !== 'function'
    ) {
      throw new TypeError(
        'A valid Razorpay client is required.',
      );
    }

    if (
      typeof keyId !== 'string' ||
      !keyId.trim() ||
      /[\u0000-\u001F\u007F]/u.test(keyId)
    ) {
      throw new TypeError('Razorpay key ID is required.');
    }

    if (
      typeof webhookSecret !== 'string' ||
      !webhookSecret.trim() ||
      /[\u0000-\u001F\u007F]/u.test(webhookSecret)
    ) {
      throw new TypeError(
        'Razorpay webhook secret is required.',
      );
    }

    if (typeof ownsClient !== 'boolean') {
      throw new TypeError('ownsClient must be a boolean.');
    }

    this.client = client;
    this.keyId = keyId.trim();
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
      PAYMENT_PROVIDER: 'razorpay',
    });

    const credentials = config.razorpay;

    if (!credentials.keyId || !credentials.keySecret) {
      throw new Error(
        'Razorpay key ID and key secret are required.',
      );
    }

    if (!credentials.webhookSecret) {
      throw new Error(
        'Razorpay webhook secret is required.',
      );
    }

    let Razorpay;

    try {
      Razorpay = require('razorpay');
    } catch {
      throw new Error(
        'Razorpay integration requires the razorpay package.',
      );
    }

    const client = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });

    return new RazorpayProvider({
      client,
      keyId: credentials.keyId,
      webhookSecret: credentials.webhookSecret,
      currency: config.currency,
      ownsClient: true,
    });
  }

  assertOpen() {
    if (this.closed) {
      const error = new Error(
        'Razorpay payment provider is closed.',
      );
      error.code = 'PAYMENT_PROVIDER_CLOSED';
      throw error;
    }
  }

  async createCheckout({
    amount,
    currency = this.currency,
    receipt,
    notes = {},
  } = {}) {
    this.assertOpen();

    const validatedAmount = validateAmount(amount);
    const validatedCurrency = normalizeCurrency(currency);
    const validatedReceipt = validateReceipt(receipt);
    const validatedNotes = validateNotes(notes);

    const order = await this.client.orders.create({
      amount: validatedAmount,
      currency: validatedCurrency,
      receipt: validatedReceipt,
      notes: validatedNotes,
    });

    if (
      !order ||
      typeof order.id !== 'string' ||
      !/^order_[a-zA-Z0-9]+$/u.test(order.id) ||
      order.amount !== validatedAmount ||
      order.currency !== validatedCurrency
    ) {
      throw new Error(
        'Razorpay returned an invalid order response.',
      );
    }

    return {
      provider: 'razorpay',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.keyId,
      status: typeof order.status === 'string'
        ? order.status
        : null,
    };
  }

  async fetchPayment(paymentId) {
    this.assertOpen();

    const validatedId = validatePaymentId(paymentId);
    const payment = await this.client.payments.fetch(validatedId);

    if (
      !payment ||
      payment.id !== validatedId ||
      !Number.isSafeInteger(payment.amount) ||
      payment.amount < 0 ||
      typeof payment.currency !== 'string' ||
      typeof payment.status !== 'string'
    ) {
      throw new Error(
        'Razorpay returned an invalid payment response.',
      );
    }

    return {
      provider: 'razorpay',
      id: payment.id,
      orderId:
        typeof payment.order_id === 'string'
          ? payment.order_id
          : null,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      captured: payment.captured === true,
      refunded: payment.status === 'refunded',
    };
  }

  async verifyWebhook(rawBody, headers) {
    this.assertOpen();

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
      throw new TypeError('Webhook headers are required.');
    }

    const signature = normalizeHeaderValue(
      headers['x-razorpay-signature'] ??
        headers['X-Razorpay-Signature'],
    );

    if (
      !signature ||
      signature.length !== 64 ||
      !/^[a-f0-9]{64}$/iu.test(signature)
    ) {
      return false;
    }

    return verifyRazorpayWebhook(
      Buffer.from(
        rawBody.buffer,
        rawBody.byteOffset,
        rawBody.byteLength,
      ),
      signature,
      this.webhookSecret,
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
  RazorpayProvider,
  normalizeCurrency,
  validateAmount,
  validateReceipt,
  validateNotes,
  validatePaymentId,
  validateOrderId,
};
