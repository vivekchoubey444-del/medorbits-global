
'use strict';

/**
 * MedOrbits -- SMTP Email Provider
 *
 * File: src/integrations/email/smtp.provider.js
 * Runtime: Node.js >= 20
 * Dependency: nodemailer
 *
 * Responsibilities:
 * - Create a configured SMTP transport.
 * - Validate SMTP configuration and outgoing messages.
 * - Enforce recipient and message-size limits.
 * - Return normalized delivery metadata.
 * - Support idempotent, graceful transport shutdown.
 *
 * Environment variables:
 * SMTP_HOST
 * SMTP_PORT
 * SMTP_USER
 * SMTP_PASS
 * SMTP_SECURE
 * SMTP_CONNECTION_TIMEOUT_MS
 * SMTP_GREETING_TIMEOUT_MS
 * SMTP_SOCKET_TIMEOUT_MS
 * EMAIL_FROM
 */

const { EmailProvider } = require('./email.provider');

const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_GREETING_TIMEOUT_MS = 10_000;
const DEFAULT_SOCKET_TIMEOUT_MS = 20_000;

const MAX_RECIPIENTS = 100;
const MAX_ADDRESS_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_LENGTH = 5 * 1024 * 1024;
const MAX_RESPONSE_HEADERS = 50;

const EMAIL_PATTERN =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }

  return value.trim();
}

function positiveInteger(value, name, fallback, max = 120_000) {
  if (value == null || value === '') {
    return fallback;
  }

  const number = typeof value === 'number' ? value : Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > max
  ) {
    throw new Error(
      `${name} must be an integer between 1 and ${max}.`,
    );
  }

  return number;
}

function parseBoolean(value, name, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`${name} must be true or false.`);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') return true;
  if (normalized === 'false') return false;

  throw new Error(`${name} must be true or false.`);
}

function validateEmailAddress(value, name) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ADDRESS_LENGTH ||
    value !== value.trim() ||
    /[\r\n\0]/u.test(value) ||
    !EMAIL_PATTERN.test(value)
  ) {
    throw new TypeError(
      `${name} must be a valid email address.`,
    );
  }

  const atIndex = value.lastIndexOf('@');
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
    throw new TypeError(
      `${name} must be a valid email address.`,
    );
  }

  return value;
}

function validateRecipientList(value, name) {
  const addresses = Array.isArray(value) ? value : [value];

  if (
    addresses.length === 0 ||
    addresses.length > MAX_RECIPIENTS
  ) {
    throw new TypeError(`Invalid ${name} recipient list.`);
  }

  const normalized = addresses.map((address) => {
    if (typeof address !== 'string') {
      throw new TypeError(`Invalid ${name} recipient list.`);
    }

    return validateEmailAddress(address, name);
  });

  const unique = new Set(
    normalized.map((address) => address.toLowerCase()),
  );

  if (unique.size !== normalized.length) {
    throw new TypeError(
      `Duplicate addresses are not allowed in ${name}.`,
    );
  }

  return normalized;
}

function validateHeaders(headers) {
  if (
    !headers ||
    typeof headers !== 'object' ||
    Array.isArray(headers)
  ) {
    throw new TypeError('Email headers must be an object.');
  }

  const entries = Object.entries(headers);

  if (entries.length > MAX_RESPONSE_HEADERS) {
    throw new TypeError('Too many custom email headers.');
  }

  const result = Object.create(null);

  const forbiddenHeaders = new Set([
    'from',
    'to',
    'cc',
    'bcc',
    'sender',
    'reply-to',
    'return-path',
    'received',
    'message-id',
    'mime-version',
    'content-type',
    'content-transfer-encoding',
    'dkim-signature',
  ]);

  for (const [name, value] of entries) {
    if (
      typeof name !== 'string' ||
      name.length > 78 ||
      !/^[a-zA-Z0-9-]+$/u.test(name) ||
      typeof value !== 'string' ||
      value.length > 4096 ||
      /[\r\n\0]/u.test(value) ||
      forbiddenHeaders.has(name.toLowerCase())
    ) {
      throw new TypeError('Invalid custom email header.');
    }

    result[name] = value;
  }

  return result;
}

function validateBody(value, name) {
  if (
    typeof value !== 'string' ||
    Buffer.byteLength(value, 'utf8') > MAX_BODY_LENGTH
  ) {
    throw new TypeError(
      `${name} must be a string within the configured size limit.`,
    );
  }

  return value;
}

function validateMessage(message, maxRecipients = MAX_RECIPIENTS) {
  if (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message)
  ) {
    throw new TypeError('A validated email message is required.');
  }

  const to = validateRecipientList(message.to, 'to');
  const cc = message.cc == null
    ? undefined
    : validateRecipientList(message.cc, 'cc');
  const bcc = message.bcc == null
    ? undefined
    : validateRecipientList(message.bcc, 'bcc');
  const replyTo = message.replyTo == null
    ? undefined
    : validateRecipientList(message.replyTo, 'replyTo');

  const allRecipients = [
    ...to,
    ...(cc || []),
    ...(bcc || []),
  ];

  if (allRecipients.length > maxRecipients) {
    throw new RangeError('Email recipient limit exceeded.');
  }

  if (
    typeof message.subject !== 'string' ||
    !message.subject.trim() ||
    message.subject.length > MAX_SUBJECT_LENGTH ||
    /[\r\n\0]/u.test(message.subject)
  ) {
    throw new TypeError('A valid email subject is required.');
  }

  const hasText = message.text != null;
  const hasHtml = message.html != null;

  if (!hasText && !hasHtml) {
    throw new TypeError(
      'Email text or HTML content is required.',
    );
  }

  const mail = {
    to,
    subject: message.subject.trim(),
  };

  if (cc) mail.cc = cc;
  if (bcc) mail.bcc = bcc;
  if (replyTo) mail.replyTo = replyTo;

  if (hasText) {
    mail.text = validateBody(message.text, 'Email text body');
  }

  if (hasHtml) {
    mail.html = validateBody(message.html, 'Email HTML body');
  }

  if (message.headers != null) {
    mail.headers = validateHeaders(message.headers);
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

    mail.priority = message.priority.toLowerCase();
  }

  return mail;
}

class SmtpProvider extends EmailProvider {
  constructor({
    transporter,
    from,
    maxRecipients = MAX_RECIPIENTS,
  } = {}) {
    super();

    if (
      !transporter ||
      typeof transporter.sendMail !== 'function' ||
      typeof transporter.close !== 'function'
    ) {
      throw new TypeError(
        'A valid Nodemailer transporter is required.',
      );
    }

    this.transporter = transporter;
    this.from = validateEmailAddress(from, 'EMAIL_FROM');

    if (
      !Number.isSafeInteger(maxRecipients) ||
      maxRecipients < 1 ||
      maxRecipients > MAX_RECIPIENTS
    ) {
      throw new TypeError(
        `maxRecipients must be between 1 and ${MAX_RECIPIENTS}.`,
      );
    }

    this.maxRecipients = maxRecipients;
    this.closed = false;
    this.closePromise = null;
  }

  static fromEnv(env = process.env) {
    if (
      !env ||
      typeof env !== 'object' ||
      Array.isArray(env)
    ) {
      throw new TypeError(
        'SMTP environment configuration is required.',
      );
    }

    const host = requiredString(env.SMTP_HOST, 'SMTP_HOST');
    const user = requiredString(env.SMTP_USER, 'SMTP_USER');
    const pass = requiredString(env.SMTP_PASS, 'SMTP_PASS');

    const from = validateEmailAddress(
      requiredString(env.EMAIL_FROM, 'EMAIL_FROM'),
      'EMAIL_FROM',
    );

    const port = Number(env.SMTP_PORT);

    if (
      !Number.isSafeInteger(port) ||
      port < 1 ||
      port > 65_535
    ) {
      throw new Error(
        'SMTP_PORT must be an integer between 1 and 65535.',
      );
    }

    const secure = parseBoolean(
      env.SMTP_SECURE,
      'SMTP_SECURE',
      port === 465,
    );

    if (port === 465 && !secure) {
      throw new Error(
        'SMTP port 465 requires SMTP_SECURE=true.',
      );
    }

    if (port !== 465 && secure && port === 587) {
      throw new Error(
        'SMTP port 587 normally uses STARTTLS; set SMTP_SECURE=false.',
      );
    }

    let nodemailer;

    try {
      nodemailer = require('nodemailer');
    } catch {
      throw new Error(
        'SMTP integration requires the nodemailer package.',
      );
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: positiveInteger(
        env.SMTP_CONNECTION_TIMEOUT_MS,
        'SMTP_CONNECTION_TIMEOUT_MS',
        DEFAULT_CONNECTION_TIMEOUT_MS,
      ),
      greetingTimeout: positiveInteger(
        env.SMTP_GREETING_TIMEOUT_MS,
        'SMTP_GREETING_TIMEOUT_MS',
        DEFAULT_GREETING_TIMEOUT_MS,
      ),
      socketTimeout: positiveInteger(
        env.SMTP_SOCKET_TIMEOUT_MS,
        'SMTP_SOCKET_TIMEOUT_MS',
        DEFAULT_SOCKET_TIMEOUT_MS,
      ),
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    return new SmtpProvider({
      transporter,
      from,
    });
  }

  async send(message) {
    if (this.closed) {
      throw new Error('SMTP provider is closed.');
    }

    const mail = validateMessage(
      message,
      this.maxRecipients,
    );

    // Enforce a configured sender rather than trusting callers.
    mail.from = this.from;

    try {
      const result = await this.transporter.sendMail(mail);

      return {
        messageId:
          typeof result?.messageId === 'string'
            ? result.messageId
            : null,
        accepted: Array.isArray(result?.accepted)
          ? result.accepted
          : [],
        rejected: Array.isArray(result?.rejected)
          ? result.rejected
          : [],
      };
    } catch {
      // Do not expose raw transport errors, credentials, or message data.
      const error = new Error('Email delivery failed.');
      error.code = 'EMAIL_DELIVERY_FAILED';
      error.status = 502;
      throw error;
    }
  }

  async close() {
    if (this.closePromise) {
      return this.closePromise;
    }

    this.closed = true;

    this.closePromise = Promise.resolve().then(() => {
      this.transporter.close();
    });

    return this.closePromise;
  }
}

module.exports = {
  SmtpProvider,
  validateEmailAddress,
  validateRecipientList,
  validateMessage,
  validateHeaders,
  positiveInteger,
  parseBoolean,
  MAX_RECIPIENTS,
};
