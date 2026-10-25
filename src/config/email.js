
/**
 * MedOrbits -- Email Service
 * File: src/config/email.js
 *
 * Node.js: >=20
 * Module system: ES Modules
 *
 * Requirements:
 * - nodemailer
 * - src/config/env.js
 * - src/config/logger.js
 *
 * Responsibilities:
 * - Validate SMTP configuration and outgoing messages.
 * - Reuse a pooled SMTP transporter.
 * - Support text and HTML email.
 * - Validate recipients, subjects, display names, and Reply-To addresses.
 * - Support To, CC, and BCC recipients.
 * - Enforce recipient and message-size limits.
 * - Report SMTP submission metadata without logging message content.
 * - Verify SMTP connectivity.
 * - Drain active operations before closing the transporter.
 *
 * Important:
 * SMTP acceptance does not guarantee inbox delivery.
 * HTML sanitization and template escaping belong in the rendering layer.
 * Do not use this service to send arbitrary user-supplied HTML.
 */

import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "./env.js";
import logger from "./logger.js";

let transporter;
let transporterConfigKey;
let transporterClosePromise;
let closing = false;
let activeOperations = 0;
let drainWaiters = [];

const EMAIL_ADDRESS_PATTERN =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@(),;:"[\]\\]+$/;

const DEFAULT_EMAIL_TIMEOUT_MS = 10000;
const MAX_EMAIL_TIMEOUT_MS = 120000;

const MAX_SUBJECT_LENGTH = 998;
const MAX_RECIPIENTS = 100;
const MAX_BODY_LENGTH = 5 * 1024 * 1024;
const MAX_FROM_NAME_LENGTH = 100;

const DEFAULT_FROM_NAME = "MedOrbits";

/**
 * Check whether a value contains non-whitespace text.
 */
function isNonEmptyString(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

/**
 * Validate an email address.
 *
 * This is intentionally a practical application-level check rather
 * than a complete implementation of every RFC email-address form.
 * The receiving mail server remains authoritative for deliverability.
 */
export function validateEmailAddress(value, fieldName = "email") {
  if (typeof value !== "string") {
    throw new TypeError(
      `${fieldName} must be a valid email address.`,
    );
  }

  const address = value.trim();

  if (
    address.length === 0 ||
    address.length > 254 ||
    /[\r\n\u0000-\u001F\u007F]/.test(address) ||
    !EMAIL_ADDRESS_PATTERN.test(address)
  ) {
    throw new TypeError(
      `${fieldName} must be a valid email address.`,
    );
  }

  const [localPart, domain] = address.split("@");

  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    throw new TypeError(
      `${fieldName} must be a valid email address.`,
    );
  }

  return address;
}

/**
 * Normalize and deduplicate recipients.
 */
export function normalizeRecipients(value, fieldName = "to") {
  const recipients = Array.isArray(value) ? value : [value];

  if (
    recipients.length === 0 ||
    recipients.length > MAX_RECIPIENTS
  ) {
    throw new TypeError(
      `${fieldName} must contain between 1 and ${MAX_RECIPIENTS} recipients.`,
    );
  }

  const normalized = recipients.map((recipient) =>
    validateEmailAddress(recipient, fieldName),
  );

  const unique = [
    ...new Set(
      normalized.map((address) => address.toLowerCase()),
    ),
  ];

  /*
   * Keep the first original spelling of each address while
   * comparing addresses case-insensitively.
   */
  const originalByNormalized = new Map();

  for (const address of normalized) {
    const key = address.toLowerCase();

    if (!originalByNormalized.has(key)) {
      originalByNormalized.set(key, address);
    }
  }

  return unique.map((key) => originalByNormalized.get(key));
}

/**
 * Validate an optional recipient group.
 */
function normalizeOptionalRecipients(value, fieldName) {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value) && value.length === 0) {
    return [];
  }

  return normalizeRecipients(value, fieldName);
}

/**
 * Validate message fields and enforce recipient and body limits.
 */
export function validateMessage({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
}) {
  const recipients = normalizeRecipients(to, "to");
  const ccRecipients = normalizeOptionalRecipients(cc, "cc");
  const bccRecipients = normalizeOptionalRecipients(bcc, "bcc");

  const allRecipients = new Set(
    [...recipients, ...ccRecipients, ...bccRecipients]
      .map((address) => address.toLowerCase()),
  );

  if (allRecipients.size > MAX_RECIPIENTS) {
    throw new TypeError(
      `An email cannot have more than ${MAX_RECIPIENTS} unique recipients.`,
    );
  }

  if (!isNonEmptyString(subject)) {
    throw new TypeError(
      "Email subject must be a non-empty string.",
    );
  }

  if (
    subject.length > MAX_SUBJECT_LENGTH ||
    /[\r\n\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(subject)
  ) {
    throw new TypeError(
      "Email subject exceeds the permitted length or contains invalid control characters.",
    );
  }

  if (text !== undefined && typeof text !== "string") {
    throw new TypeError(
      "Email text content must be a string.",
    );
  }

  if (html !== undefined && typeof html !== "string") {
    throw new TypeError(
      "Email HTML content must be a string.",
    );
  }

  const hasText = isNonEmptyString(text);
  const hasHtml = isNonEmptyString(html);

  if (!hasText && !hasHtml) {
    throw new TypeError(
      "Email requires non-empty text or HTML content.",
    );
  }

  if (
    (typeof text === "string" && Buffer.byteLength(text, "utf8") > MAX_BODY_LENGTH) ||
    (typeof html === "string" && Buffer.byteLength(html, "utf8") > MAX_BODY_LENGTH)
  ) {
    throw new TypeError(
      "Email body exceeds the permitted size of 5 MiB per content field.",
    );
  }

  return {
    recipients,
    ccRecipients,
    bccRecipients,
  };
}

/**
 * Validate SMTP settings and build the transporter configuration.
 */
function getTransportConfig() {
  if (env.EMAIL_ENABLED !== true) {
    throw new Error(
      "Email is disabled. Set EMAIL_ENABLED=true to enable email sending.",
    );
  }

  const required = [
    ["SMTP_HOST", env.SMTP_HOST],
    ["SMTP_USER", env.SMTP_USER],
    ["SMTP_PASSWORD", env.SMTP_PASSWORD],
    ["EMAIL_FROM_ADDRESS", env.EMAIL_FROM_ADDRESS],
  ];

  const missing = required
    .filter(([, value]) => !isNonEmptyString(value))
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Email configuration is incomplete. Missing: ${missing.join(", ")}.`,
    );
  }

  const host = env.SMTP_HOST.trim();

  if (/[\s\u0000-\u001F\u007F]/.test(host)) {
    throw new Error(
      "SMTP_HOST contains invalid whitespace or control characters.",
    );
  }

  const port = Number(env.SMTP_PORT);

  const timeout =
    env.EMAIL_SEND_TIMEOUT_MS === undefined
      ? DEFAULT_EMAIL_TIMEOUT_MS
      : Number(env.EMAIL_SEND_TIMEOUT_MS);

  if (
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "SMTP_PORT must be an integer between 1 and 65535.",
    );
  }

  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1000 ||
    timeout > MAX_EMAIL_TIMEOUT_MS
  ) {
    throw new Error(
      `EMAIL_SEND_TIMEOUT_MS must be between 1000 and ${MAX_EMAIL_TIMEOUT_MS}.`,
    );
  }

  if (typeof env.SMTP_SECURE !== "boolean") {
    throw new Error(
      "SMTP_SECURE must be a boolean in src/config/env.js.",
    );
  }

  if (env.SMTP_SECURE && port === 587) {
    logger.warn(
      { port },
      "SMTP_SECURE=true on port 587; verify the SMTP provider's TLS configuration.",
    );
  }

  if (!env.SMTP_SECURE && port === 465) {
    logger.warn(
      { port },
      "SMTP_SECURE=false on port 465; verify the SMTP provider's TLS configuration.",
    );
  }

  const fromAddress = validateEmailAddress(
    env.EMAIL_FROM_ADDRESS,
    "EMAIL_FROM_ADDRESS",
  );

  const replyTo = isNonEmptyString(env.EMAIL_REPLY_TO)
    ? validateEmailAddress(
        env.EMAIL_REPLY_TO,
        "EMAIL_REPLY_TO",
      )
    : undefined;

  const fromName = isNonEmptyString(env.EMAIL_FROM_NAME)
    ? env.EMAIL_FROM_NAME.trim()
    : DEFAULT_FROM_NAME;

  if (
    fromName.length > MAX_FROM_NAME_LENGTH ||
    /[\r\n\u0000-\u001F\u007F]/.test(fromName)
  ) {
    throw new Error(
      `EMAIL_FROM_NAME must not exceed ${MAX_FROM_NAME_LENGTH} characters or contain control characters.`,
    );
  }

  return {
    host,
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

/**
 * Create the SMTP transporter.
 */
function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,

    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },

    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,

    pool: config.pool,
    maxConnections: config.maxConnections,
    maxMessages: config.maxMessages,
  });
}

/**
 * Compute a configuration fingerprint without retaining a plaintext
 * JSON representation of the SMTP password in the configuration key.
 */
function createConfigKey(config) {
  const fingerprint = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    password: config.auth.pass,
    from: config.from,
    replyTo: config.replyTo,
    connectionTimeout: config.connectionTimeout,
    greetingTimeout: config.greetingTimeout,
    socketTimeout: config.socketTimeout,
    pool: config.pool,
    maxConnections: config.maxConnections,
    maxMessages: config.maxMessages,
  };

  return createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex");
}

/**
 * Return the shared transporter.
 *
 * If configuration changes while a transporter exists, fail explicitly
 * rather than leaking an old connection pool or silently using stale
 * credentials. Close the transport before changing configuration.
 */
export function getEmailTransporter() {
  if (closing || transporterClosePromise) {
    throw new Error(
      "Email transport is shutting down. Retry after shutdown completes.",
    );
  }

  const config = getTransportConfig();
  const configKey = createConfigKey(config);

  if (transporter) {
    if (transporterConfigKey !== configKey) {
      throw new Error(
        "Email transport configuration changed. Close the existing transporter before reconfiguration.",
      );
    }

    return transporter;
  }

  transporter = createTransporter(config);
  transporterConfigKey = configKey;

  return transporter;
}

/**
 * Track active operations so shutdown can drain them before closing
 * the pooled SMTP connections.
 */
function beginOperation() {
  if (closing || transporterClosePromise) {
    throw new Error(
      "Email transport is shutting down. Retry after shutdown completes.",
    );
  }

  activeOperations += 1;

  let finished = false;

  return function endOperation() {
    if (finished) {
      return;
    }

    finished = true;
    activeOperations -= 1;

    if (activeOperations === 0 && drainWaiters.length > 0) {
      const waiters = drainWaiters;
      drainWaiters = [];

      for (const resolve of waiters) {
        resolve();
      }
    }
  };
}

function waitForActiveOperations() {
  if (activeOperations === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    drainWaiters.push(resolve);
  });
}

/**
 * Send an email.
 *
 * Returns SMTP submission metadata. This is not a guarantee of
 * final inbox delivery.
 */
export async function sendEmail({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  replyTo,
}) {
  const validated = validateMessage({
    to,
    cc,
    bcc,
    subject,
    text,
    html,
  });

  const config = getTransportConfig();

  const validatedReplyTo = isNonEmptyString(replyTo)
    ? validateEmailAddress(replyTo, "replyTo")
    : config.replyTo;

  const endOperation = beginOperation();

  try {
    const transport = getEmailTransporter();

    const message = {
      from: config.from,
      to: validated.recipients,
      subject: subject.trim(),

      ...(validated.ccRecipients.length > 0
        ? { cc: validated.ccRecipients }
        : {}),

      ...(validated.bccRecipients.length > 0
        ? { bcc: validated.bccRecipients }
        : {}),

      ...(validatedReplyTo
        ? { replyTo: validatedReplyTo }
        : {}),

      ...(isNonEmptyString(text) ? { text } : {}),
      ...(isNonEmptyString(html) ? { html } : {}),
    };

    const info = await transport.sendMail(message);

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
      "Email submission completed",
    );

    if (rejectedCount > 0) {
      logger.warn(
        {
          messageId: info.messageId,
          rejectedCount,
        },
        "SMTP transport rejected one or more recipients",
      );
    }

    return {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      acceptedCount,
      rejectedCount,
      response: info.response,
    };
  } catch (error) {
    logger.error(
      {
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      },
      "Email submission failed",
    );

    throw error;
  } finally {
    endOperation();
  }
}

/**
 * Verify the SMTP transporter.
 *
 * A successful verification checks connection/authentication readiness
 * but does not prove that a specific recipient will accept a message.
 */
export async function verifyEmailTransport() {
  const endOperation = beginOperation();

  try {
    const transport = getEmailTransporter();

    await transport.verify();

    logger.info(
      "SMTP transport verification succeeded",
    );

    return { ok: true };
  } catch (error) {
    logger.error(
      {
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      },
      "SMTP transport verification failed",
    );

    throw error;
  } finally {
    endOperation();
  }
}

/**
 * Close the SMTP transporter after active send and verify operations
 * finish. Repeated calls share the same shutdown operation.
 */
export function closeEmailTransport() {
  if (transporterClosePromise) {
    return transporterClosePromise;
  }

  if (!transporter) {
    return Promise.resolve();
  }

  closing = true;

  const currentTransporter = transporter;

  transporterClosePromise = (async () => {
    try {
      await waitForActiveOperations();

      currentTransporter.close();
    } finally {
      if (transporter === currentTransporter) {
        transporter = undefined;
        transporterConfigKey = undefined;
      }

      closing = false;
    }
  })().finally(() => {
    transporterClosePromise = undefined;
  });

  return transporterClosePromise;
}

const emailService = Object.freeze({
  sendEmail,
  verifyEmailTransport,
  getEmailTransporter,
  closeEmailTransport,
  validateEmailAddress,
  normalizeRecipients,
  validateMessage,
});

export default emailService;
