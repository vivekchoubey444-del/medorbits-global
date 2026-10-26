
'use strict';

/**
 * MedOrbits -- Email Client
 *
 * File: src/integrations/email/email.client.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Validate outgoing email messages.
 * - Reject malformed addresses and unsafe headers.
 * - Normalize recipient fields.
 * - Delegate delivery to the configured email provider.
 * - Support controlled provider ownership and graceful shutdown.
 *
 * This module does not implement SMTP transport, templates, retries,
 * delivery tracking, or email queue processing.
 */

const EMAIL_PATTERN = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

const MAX_ADDRESS_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 998;
const MAX_RECIPIENTS = 100;
const MAX_BODY_LENGTH = 5 * 1024 * 1024;
const MAX_HEADERS = 50;
const MAX_HEADER_NAME_LENGTH = 78;
const MAX_HEADER_VALUE_LENGTH = 4096;

const ALLOWED_MESSAGE_FIELDS = new Set([
  'to',
  'cc',
  'bcc',
  'replyTo',
  'from',
  'subject',
  'text',
  'html',
  'headers',
  'attachments',
  'priority',
]);

function isEmail(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ADDRESS_LENGTH ||
    value !== value.trim() ||
    /[\r\n\0]/u.test(value)
  ) {
    return false;
  }

  const atIndex = value.lastIndexOf('@');

  if (
    atIndex <= 0 ||
    atIndex === value.length - 1
  ) {
    return false;
  }

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);

  if (
    local.length > 64 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    domain.length > 253 ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    return false;
  }

  return EMAIL_PATTERN.test(value);
}

function normalizeAddressList(value, fieldName, options = {}) {
  if (value == null && options.optional) {
    return undefined;
  }

  const addresses = Array.isArray(value) ? value : [value];

  if (
    addresses.length === 0 ||
    addresses.length > MAX_RECIPIENTS ||
    addresses.some((address) => !isEmail(address))
  ) {
    throw new TypeError(
      `Invalid ${fieldName} email address list.`,
    );
  }

  const normalized = addresses.map((address) => address.trim());

  if (options.unique) {
    const seen = new Set();

    for (const address of normalized) {
      const key = address.toLowerCase();

      if (seen.has(key)) {
        throw new TypeError(
          `Duplicate address in ${fieldName} email address list.`,
        );
      }

      seen.add(key);
    }
  }

  return normalized;
}

function validateHeaderValue(value, fieldName, maxLength) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maxLength ||
    /[\r\n\0]/u.test(value)
  ) {
    throw new TypeError(`Invalid email ${fieldName}.`);
  }

  return value.trim();
}

function validateBody(value, fieldName) {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MAX_BODY_LENGTH
  ) {
    throw new TypeError(
      `Email ${fieldName} must be a string within the configured size limit.`,
    );
  }

  return value;
}

function validateCustomHeaders(headers) {
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers)
  ) {
    throw new TypeError('Email headers must be an object.');
  }

  const entries = Object.entries(headers);

  if (entries.length > MAX_HEADERS) {
    throw new TypeError('Too many custom email headers.');
  }

  const normalized = Object.create(null);

  for (const [name, value] of entries) {
    if (
      typeof name !== 'string' ||
      name.length > MAX_HEADER_NAME_LENGTH ||
      !/^[a-zA-Z0-9-]+$/u.test(name) ||
      typeof value !== 'string' ||
      value.length > MAX_HEADER_VALUE_LENGTH ||
      /[\r\n\0]/u.test(value)
    ) {
      throw new TypeError('Invalid custom email header.');
    }

    const lowerName = name.toLowerCase();

    // These headers can affect delivery identity, routing, or content.
    // They must be controlled by the configured email provider.
    if (
      [
        'from',
        'to',
        'cc',
        'bcc',
        'reply-to',
        'sender',
        'return-path',
        'received',
        'content-type',
        'content-transfer-encoding',
        'mime-version',
        'message-id',
        'dkim-signature',
      ].includes(lowerName)
    ) {
      throw new TypeError(
        `The ${name} header cannot be set through custom headers.`,
      );
    }

    normalized[name] = value;
  }

  return normalized;
}

function validateMessage(message) {
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message)
  ) {
    throw new TypeError('Email message is required.');
  }

  for (const field of Object.keys(message)) {
    if (!ALLOWED_MESSAGE_FIELDS.has(field)) {
      throw new TypeError(
        `Unsupported email message field: ${field}.`,
      );
    }
  }

  const to = normalizeAddressList(message.to, 'recipient', {
    unique: true,
  });

  const subject = validateHeaderValue(
    message.subject,
    'subject',
    MAX_SUBJECT_LENGTH,
  );

  const hasHtml = message.html != null;
  const hasText = message.text != null;

  if (!hasHtml && !hasText) {
    throw new TypeError(
      'At least one email body field (html or text) is required.',
    );
  }

  const result = {
    to,
    subject,
  };

  if (hasHtml) {
    result.html = validateBody(message.html, 'HTML body');
  }

  if (hasText) {
    result.text = validateBody(message.text, 'text body');
  }

  for (const field of ['cc', 'bcc', 'replyTo']) {
    if (message[field] != null) {
      result[field] = normalizeAddressList(
        message[field],
        field,
        { unique: true },
      );
    }
  }

  if (message.from != null) {
    if (!isEmail(message.from)) {
      throw new TypeError('Invalid sender email address.');
    }

    result.from = message.from;
  }

  if (message.headers != null) {
    result.headers = validateCustomHeaders(message.headers);
  }

  if (message.priority != null) {
    if (
      typeof message.priority !== 'string' ||
      !['high', 'normal', 'low'].includes(
        message.priority.toLowerCase(),
      )
    ) {
      throw new TypeError(
        'Email priority must be high, normal, or low.',
      );
    }

    result.priority = message.priority.toLowerCase();
  }

  if (message.attachments != null) {
    if (!Array.isArray(message.attachments)) {
      throw new TypeError(
        'Email attachments must be an array.',
      );
    }

    // Attachment paths, streams, content, filenames, and MIME types
    // require provider-specific validation and are intentionally
    // not accepted by this generic client.
    if (message.attachments.length > 0) {
      throw new TypeError(
        'Attachments are not supported by this email client.',
      );
    }

    result.attachments = [];
  }

  return Object.freeze(result);
}

class EmailClient {
  #provider;
  #closed = false;
  #closePromise = null;
  #ownsProvider;

  constructor(provider, options = {}) {
    if (
      !provider ||
      typeof provider !== 'object' ||
      Array.isArray(provider) ||
      typeof provider.send !== 'function'
    ) {
      throw new TypeError(
        'A valid email provider implementing send(message) is required.',
      );
    }

    if (
      options === null ||
      typeof options !== 'object' ||
      Array.isArray(options)
    ) {
      throw new TypeError(
        'Email client options must be an object.',
      );
    }

    if (
      options.ownsProvider !== undefined &&
      typeof options.ownsProvider !== 'boolean'
    ) {
      throw new TypeError(
        'ownsProvider must be a boolean.',
      );
    }

    if (
      provider.close != null &&
      typeof provider.close !== 'function'
    ) {
      throw new TypeError(
        'Provider close must be a function when provided.',
      );
    }

    this.#provider = provider;
    this.#ownsProvider = options.ownsProvider === true;
  }

  get closed() {
    return this.#closed;
  }

  async send(message) {
    if (this.#closed) {
      throw new Error('Email client is closed.');
    }

    const validatedMessage = validateMessage(message);

    // Provider exceptions are propagated to the calling service.
    // The provider must sanitize its own errors and never expose secrets.
    return this.#provider.send(validatedMessage);
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
  EmailClient,
  validateMessage,
  validateCustomHeaders,
  normalizeAddressList,
  validateHeaderValue,
  validateBody,
  isEmail,
  MAX_ADDRESS_LENGTH,
  MAX_SUBJECT_LENGTH,
  MAX_RECIPIENTS,
  MAX_BODY_LENGTH,
  MAX_HEADERS,
};
