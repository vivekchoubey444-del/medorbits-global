
'use strict';

/**
 * MedOrbits -- Email Service
 * File: src/config/email.js
 *
 * Responsibilities:
 * - Configure and reuse the SMTP transporter.
 * - Validate outgoing email messages and recipients.
 * - Send text and/or HTML email.
 * - Verify SMTP transport connectivity.
 * - Log delivery submission metadata without exposing message content.
 *
 * Required when EMAIL_ENABLED=true:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASSWORD
 * - EMAIL_FROM_ADDRESS
 *
 * The env module is expected to validate and normalize configuration.
 */

const nodemailer = require('nodemailer');
const { env } = require('./env');
const logger = require('./logger');

let transporter;
let transporterConfigKey;
let transporterClosePromise;

const EMAIL_ADDRESS_PATTERN =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

const DEFAULT_EMAIL_TIMEOUT_MS = 10000;
const MAX_EMAIL_TIMEOUT_MS = 120000;
const MAX_SUBJECT_LENGTH = 998;
const MAX_RECIPIENTS = 100;
const MAX_BODY_LENGTH = 5 * 1024 * 1024;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateEmailAddress(value, fieldName) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !EMAIL_ADDRESS_PATTERN.test(value.trim())
  ) {
    throw new TypeError(
      `${fieldName} must be a valid email address.`
    );
  }

  const address = value.trim();

  if (
    address.startsWith('.') ||
    address.endsWith('.') ||
    address.includes('..')
  ) {
    throw new TypeError(
      `${fieldName} must be a valid email address.`
    );
  }

  return address;
}

function normalizeRecipients(value, fieldName = 'to') {
  const recipients = Array.isArray(value) ? value : [value];

  if (
    recipients.length === 0 ||
    recipients.length > MAX_RECIPIENTS
  ) {
    throw new TypeError(
      `${fieldName} must contain between 1 and ${MAX_RECIPIENTS} recipients.`
    );
  }

  const normalized = recipients.map((recipient) =>
    validateEmailAddress(recipient, fieldName)
  );

  return [...new Set(normalized)];
}

function validateMessage({ to, subject, text, html }) {
  const recipients = normalizeRecipients(to);

  if (!isNonEmptyString(subject)) {
    throw new TypeError(
      'Email subject must be a non-empty string.'
    );
  }

  if (
    subject.length > MAX_SUBJECT_LENGTH ||
    /[\r\n]/.test(subject)
  ) {
    throw new TypeError(
      'Email subject exceeds the permitted length or contains invalid line breaks.'
    );
  }

  if (
    text !== undefined &&
    typeof text !== 'string'
  ) {
    throw new TypeError('Email text content must be a string.');
  }

  if (
    html !== undefined &&
    typeof html !== 'string'
  ) {
    throw new TypeError('Email HTML content must be a string.');
  }

  const hasText = isNonEmptyString(text);
  const hasHtml = isNonEmptyString(html);

  if (!hasText && !hasHtml) {
    throw new TypeError(
      'Email requires non-empty text or HTML string content.'
    );
  }

  if (
    (typeof text === 'string' && text.length > MAX_BODY_LENGTH) ||
    (typeof html === 'string' && html.length > MAX_BODY_LENGTH)
  ) {
    throw new TypeError(
      'Email body exceeds the permitted size.'
    );
  }

  return { recipients };
}

function getTransportConfig() {
  if (env.EMAIL_ENABLED !== true) {
    throw new Error(
      'Email is disabled. Set EMAIL_ENABLED=true to enable it.'
    );
  }

  const required = [
    ['SMTP_HOST', env.SMTP_HOST],
    ['SMTP_USER', env.SMTP_USER],
    ['SMTP_PASSWORD', env.SMTP_PASSWORD],
    ['EMAIL_FROM_ADDRESS', env.EMAIL_FROM_ADDRESS],
  ];

  const missing = required
    .filter(([, value]) => !isNonEmptyString(value))
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Email configuration is incomplete. Missing: ${missing.join(', ')}.`
    );
  }

  const port = Number(env.SMTP_PORT);

  const timeout = env.EMAIL_SEND_TIMEOUT_MS === undefined
    ? DEFAULT_EMAIL_TIMEOUT_MS
    : Number(env.EMAIL_SEND_TIMEOUT_MS);

  if (
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'SMTP_PORT must be an integer between 1 and 65535.'
    );
  }

  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1000 ||
    timeout > MAX_EMAIL_TIMEOUT_MS
  ) {
    throw new Error(
      `EMAIL_SEND_TIMEOUT_MS must be between 1000 and ${MAX_EMAIL_TIMEOUT_MS}.`
    );
  }

  if (typeof env.SMTP_SECURE !== 'boolean') {
    throw new Error('SMTP_SECURE must be a boolean.');
  }

  if (env.SMTP_SECURE && port === 587) {
    logger.warn(
      { port },
      'SMTP_SECURE=true on port 587; confirm the provider expects implicit TLS.'
    );
  }

  const fromAddress = validateEmailAddress(
    env.EMAIL_FROM_ADDRESS,
    'EMAIL_FROM_ADDRESS'
  );

  const replyTo = isNonEmptyString(env.EMAIL_REPLY_TO)
    ? validateEmailAddress(env.EMAIL_REPLY_TO, 'EMAIL_REPLY_TO')
    : undefined;

  const fromName = isNonEmptyString(env.EMAIL_FROM_NAME)
    ? env.EMAIL_FROM_NAME.trim()
    : 'MedOrbits';

  if (/[\r\n]/.test(fromName)) {
    throw new Error(
      'EMAIL_FROM_NAME must not contain line breaks.'
    );
  }

  return {
    host: env.SMTP_HOST.trim(),
    port,
    secure: env.SMTP_SECURE,

    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },

    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,

    pool: true,
    maxConnections: 5,
    maxMessages: 100,

    from: {
      name: fromName,
      address: fromAddress,
    },

    replyTo,
  };
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,

    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,

    pool: config.pool,
    maxConnections: config.maxConnections,
    maxMessages: config.maxMessages,
  });
}

function getEmailTransporter() {
  const config = getTransportConfig();

  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    from: config.from,
    replyTo: config.replyTo,
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    pool: config.pool,
    maxConnections: config.maxConnections,
    maxMessages: config.maxMessages,
  });

  if (transporter && transporterConfigKey === configKey) {
    return transporter;
  }

  if (transporter) {
    throw new Error(
      'Email transport configuration changed. Close the existing transporter before reconfiguration.'
    );
  }

  if (transporterClosePromise) {
    throw new Error(
      'Email transport is shutting down. Retry after shutdown completes.'
    );
  }

  transporter = createTransporter(config);
  transporterConfigKey = configKey;

  return transporter;
}

async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}) {
  const { recipients } = validateMessage({
    to,
    subject,
    text,
    html,
  });

  const config = getTransportConfig();

  const validatedReplyTo = isNonEmptyString(replyTo)
    ? validateEmailAddress(replyTo, 'replyTo')
    : config.replyTo;

  const transport = getEmailTransporter();

  try {
    const info = await transport.sendMail({
      from: config.from,
      ...(validatedReplyTo
        ? { replyTo: validatedReplyTo }
        : {}),
      to: recipients,
      subject: subject.trim(),
      ...(isNonEmptyString(text) ? { text } : {}),
      ...(isNonEmptyString(html) ? { html } : {}),
    });

    const acceptedCount = Array.isArray(info.accepted)
      ? info.accepted.length
      : 0;

    const rejectedCount = Array.isArray(info.rejected)
      ? info.rejected.length
      : 0;

    logger.info(
      {
        messageId: info.messageId,
        acceptedCount,
        rejectedCount,
      },
      'Email submission completed'
    );

    if (rejectedCount > 0) {
      logger.warn(
        { rejectedCount },
        'SMTP transport rejected one or more recipients'
      );
    }

    return info;
  } catch (error) {
    logger.error(
      {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
      },
      'Email submission failed'
    );

    throw error;
  }
}

async function verifyEmailTransport() {
  const transport = getEmailTransporter();

  try {
    await transport.verify();

    logger.info('SMTP transport verification succeeded');

    return { ok: true };
  } catch (error) {
    logger.error(
      {
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
      },
      'SMTP transport verification failed'
    );

    throw error;
  }
}

function closeEmailTransport() {
  if (transporterClosePromise) {
    return transporterClosePromise;
  }

  if (!transporter) {
    return Promise.resolve();
  }

  const currentTransporter = transporter;

  transporter = undefined;
  transporterConfigKey = undefined;

  transporterClosePromise = Promise.resolve()
    .then(() => currentTransporter.close())
    .finally(() => {
      transporterClosePromise = undefined;
    });

  return transporterClosePromise;
}

module.exports = {
  sendEmail,
  verifyEmailTransport,
  getEmailTransporter,
  closeEmailTransport,
  validateEmailAddress,
  normalizeRecipients,
  validateMessage,
};
