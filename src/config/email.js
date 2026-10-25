
/**
 * MedOrbits -- Email Service
 *
 * File: src/config/email.js
 * Runtime: Node.js >=20
 * Module system: ES Modules
 *
 * Dependencies:
 *   npm install nodemailer
 *
 * Configuration:
 *   src/config/env.js
 *   src/config/logger.js
 *
 * Responsibilities:
 * - Validate SMTP settings and outgoing messages.
 * - Reuse a pooled SMTP transporter.
 * - Support text, HTML, To, CC, BCC, and Reply-To.
 * - Enforce recipient, subject, and message-size limits.
 * - Avoid logging message bodies, credentials, and recipient addresses.
 * - Verify SMTP connectivity.
 * - Drain active operations before closing the transporter.
 *
 * Security:
 * SMTP acceptance does not guarantee inbox delivery.
 * Render and sanitize HTML in a trusted template layer.
 * Never send arbitrary user-supplied HTML.
 * Never expose raw SMTP errors in public API responses.
 */

import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "./env.js";
import logger from "./logger.js";

const DEFAULT_EMAIL_TIMEOUT_MS = 10000;
const MAX_EMAIL_TIMEOUT_MS = 120000;

const MAX_SUBJECT_LENGTH = 998;
const MAX_RECIPIENTS = 100;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_FROM_NAME_LENGTH = 100;

const DEFAULT_FROM_NAME = "MedOrbits";
const MAX_CONNECTIONS = 5;
const MAX_MESSAGES_PER_CONNECTION = 100;

const EMAIL_ADDRESS_PATTERN =
  /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@(),;:"[\]\\]+$/u;

let transporter;
let transporterConfigKey;
let transporterClosePromise;
let closing = false;
let activeOperations = 0;
let drainWaiters = [];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function serviceError(message) {
  return new Error(`[MedOrbits Email] ${message}`);
}

function hasControlCharacters(value) {
  return /[\u0000-\u001f\u007f]/u.test(value);
}

function parseBoundedInteger(value, name, {
  fallback,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
} = {}) {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) {
      return fallback;
    }

    throw serviceError(`${name} is required.`);
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw serviceError(`${name} must be an integer.`);
  }

  const normalized = String(value).trim();

  if (!/^\d+$/u.test(normalized)) {
    throw serviceError(`${name} must be an integer.`);
  }

  const parsed = Number(normalized);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw serviceError(
      `${name} must be between ${min} and ${max}.`,
    );
  }

  return parsed;
}

/**
 * Validate a single email address.
 *
 * This is a practical application-level check, not a complete
 * implementation of every RFC mailbox syntax.
 */
export function validateEmailAddress(value, fieldName = "email") {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a valid email address.`);
  }

  const address = value.trim();

  if (
    address.length === 0 ||
    address.length > 254 ||
    hasControlCharacters(address) ||
    !EMAIL_ADDRESS_PATTERN.test(address)
  ) {
    throw new TypeError(`${fieldName} must be a valid email address.`);
  }

  const separator = address.lastIndexOf("@");
  const localPart = address.slice(0, separator);
  const domain = address.slice(separator + 1);

  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    domain.length > 253 ||
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..") ||
    domain.split(".").some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  ) {
    throw new TypeError(`${fieldName} must be a valid email address.`);
  }

  return address;
}

/**
 * Normalize a required recipient group and remove case-insensitive
 * duplicates while preserving the first spelling of each address.
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

  const unique = new Map();

  for (const recipient of recipients) {
    const address = validateEmailAddress(recipient, fieldName);
    const key = address.toLowerCase();

    if (!unique.has(key)) {
      unique.set(key, address);
    }
  }

  return [...unique.values()];
}

function normalizeOptionalRecipients(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value) && value.length === 0) {
    return [];
  }

  return normalizeRecipients(value, fieldName);
}

function validateSubject(subject) {
  if (typeof subject !== "string" || !subject.trim()) {
    throw new TypeError("Email subject must be a non-empty string.");
  }

  if (
    subject.length > MAX_SUBJECT_LENGTH ||
    hasControlCharacters(subject.replace(/\r?\n[ \t]+/gu, ""))
  ) {
    throw new TypeError(
      "Email subject exceeds the permitted length or contains invalid control characters.",
    );
  }

  // Reject CR/LF explicitly: email subjects must not contain header
  // line breaks, even when followed by whitespace.
  if (/[\r\n]/u.test(subject)) {
    throw new TypeError("Email subject must not contain line breaks.");
  }

  return subject.trim();
}

function validateBodyField(value, fieldName) {
  if (value !== undefined && typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  if (
    typeof value === "string" &&
    Buffer.byteLength(value, "utf8") > MAX_BODY_BYTES
  ) {
    throw new TypeError(
      `${fieldName} exceeds the maximum size of 5 MiB.`,
    );
  }
}

/**
 * Validate message fields and enforce aggregate recipient limits.
 */
export function validateMessage({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
} = {}) {
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

  const validatedSubject = validateSubject(subject);

  validateBodyField(text, "Email text content");
  validateBodyField(html, "Email HTML content");

  if (
    !isNonEmptyString(text) &&
    !isNonEmptyString(html)
  ) {
    throw new TypeError(
      "Email requires non-empty text or HTML content.",
    );
  }

  return {
    recipients,
    ccRecipients,
    bccRecipients,
    subject: validatedSubject,
  };
}

function getTransportConfig() {
  if (env.EMAIL_ENABLED !== true) {
    throw serviceError(
      "Email sending is disabled. Enable it explicitly in the environment configuration.",
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
    throw serviceError(
      `Email configuration is incomplete. Missing: ${missing.join(", ")}.`,
    );
  }

  const host = env.SMTP_HOST.trim();

  if (hasControlCharacters(host) || /\s/u.test(host)) {
    throw serviceError("SMTP_HOST contains invalid characters.");
  }

  const port = parseBoundedInteger(env.SMTP_PORT, "SMTP_PORT", {
    fallback: 587,
    min: 1,
    max: 65535,
  });

  const timeout = parseBoundedInteger(
    env.EMAIL_SEND_TIMEOUT_MS,
    "EMAIL_SEND_TIMEOUT_MS",
    {
      fallback: DEFAULT_EMAIL_TIMEOUT_MS,
      min: 1000,
      max: MAX_EMAIL_TIMEOUT_MS,
    },
  );

  if (typeof env.SMTP_SECURE !== "boolean") {
    throw serviceError(
      "SMTP_SECURE must be a boolean in src/config/env.js.",
    );
  }

  if (env.SMTP_SECURE && port === 587) {
    logger.warn(
      { port },
      "Review SMTP TLS configuration: implicit TLS is usually used on port 465.",
    );
  }

  if (!env.SMTP_SECURE && port === 465) {
    logger.warn(
      { port },
      "Review SMTP TLS configuration: port 465 normally requires implicit TLS.",
    );
  }

  const fromAddress = validateEmailAddress(
    env.EMAIL_FROM_ADDRESS,
    "EMAIL_FROM_ADDRESS",
  );

  const replyTo = isNonEmptyString(env.EMAIL_REPLY_TO)
    ? validateEmailAddress(env.EMAIL_REPLY_TO, "EMAIL_REPLY_TO")
    : undefined;

  const fromName = isNonEmptyString(env.EMAIL_FROM_NAME)
    ? env.EMAIL_FROM_NAME.trim()
    : DEFAULT_FROM_NAME;

  if (
    fromName.length > MAX_FROM_NAME_LENGTH ||
    hasControlCharacters(fromName)
  ) {
    throw serviceError(
      `EMAIL_FROM_NAME must not exceed ${MAX_FROM_NAME_LENGTH} characters or contain control characters.`,
    );
  }

  // Preserve password and username exactly; whitespace can be significant.
  return {
    host,
    port,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    timeout,
    from: {
      name: fromName,
      address: fromAddress,
    },
    replyTo,
  };
}

/**
 * Generate a configuration fingerprint. The digest is used only to
 * detect configuration changes; it is not a credential or auth token.
 */
function createConfigKey(config) {
  const fingerprint = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    password: config.password,
    from: config.from,
    replyTo: config.replyTo,
    timeout: config.timeout,
  });

  return createHash("sha256")
    .update(fingerprint)
    .digest("hex");
}

function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,

    auth: {
      user: config.user,
      pass: config.password,
    },

    connectionTimeout: config.timeout,
    greetingTimeout: config.timeout,
    socketTimeout: config.timeout,

    pool: true,
    maxConnections: MAX_CONNECTIONS,
    maxMessages: MAX_MESSAGES_PER_CONNECTION,
  });
}

function assertTransportAvailable() {
  if (closing || transporterClosePromise) {
    throw serviceError(
      "The email transport is shutting down. Retry after shutdown completes.",
    );
  }
}

/**
 * Get the shared SMTP transporter.
 *
 * Changing SMTP configuration while the pool is active requires closing
 * the current transporter first.
 */
export function getEmailTransporter() {
  assertTransportAvailable();

  const config = getTransportConfig();
  const configKey = createConfigKey(config);

  if (transporter) {
    if (transporterConfigKey !== configKey) {
      throw serviceError(
        "SMTP configuration changed. Close the existing transporter before reconfiguration.",
      );
    }

    return transporter;
  }

  transporter = createTransporter(config);
  transporterConfigKey = configKey;

  return transporter;
}

function beginOperation() {
  assertTransportAvailable();

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

function safeErrorMetadata(error) {
  return {
    code:
      typeof error?.code === "string" &&
      /^[A-Z0-9_-]{1,64}$/iu.test(error.code)
        ? error.code
        : undefined,

    command:
      typeof error?.command === "string" &&
      /^[A-Z0-9_-]{1,32}$/iu.test(error.command)
        ? error.command
        : undefined,

    responseCode:
      Number.isInteger(error?.responseCode)
        ? error.responseCode
        : undefined,
  };
}

/**
 * Send a message.
 *
 * Returns submission metadata, not a guarantee of final delivery.
 *
 * Do not return raw caught SMTP errors to public API clients. Convert
 * them through the application's centralized safe-error middleware.
 */
export async function sendEmail({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  replyTo,
} = {}) {
  // Validate user input before opening or using an SMTP connection.
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

    /*
     * A recipient appearing in more than one group is sent only once.
     * Remove cross-group duplicates to avoid accidental duplicate mail.
     */
    const toKeys = new Set(
      validated.recipients.map((address) => address.toLowerCase()),
    );

    const ccKeys = new Set();
    const bccKeys = new Set();

    const ccRecipients = validated.ccRecipients.filter((address) => {
      const key = address.toLowerCase();

      if (toKeys.has(key) || ccKeys.has(key)) {
        return false;
      }

      ccKeys.add(key);
      return true;
    });

    const bccRecipients = validated.bccRecipients.filter((address) => {
      const key = address.toLowerCase();

      if (toKeys.has(key) || ccKeys.has(key) || bccKeys.has(key)) {
        return false;
      }

      bccKeys.add(key);
      return true;
    });

    const message = {
      from: config.from,
      to: validated.recipients,
      subject: validated.subject,

      ...(ccRecipients.length > 0 ? { cc: ccRecipients } : {}),
      ...(bccRecipients.length > 0 ? { bcc: bccRecipients } : {}),
      ...(validatedReplyTo ? { replyTo: validatedReplyTo } : {}),
      ...(isNonEmptyString(text) ? { text } : {}),
      ...(isNonEmptyString(html) ? { html } : {}),
    };

    const info = await transport.sendMail(message);

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];

    logger.info(
      {
        messageId:
          typeof info.messageId === "string"
            ? info.messageId.slice(0, 255)
            : undefined,
        acceptedCount: accepted.length,
        rejectedCount: rejected.length,
      },
      "Email submission completed",
    );

    if (rejected.length > 0) {
      logger.warn(
        {
          messageId:
            typeof info.messageId === "string"
              ? info.messageId.slice(0, 255)
              : undefined,
          rejectedCount: rejected.length,
        },
        "SMTP transport rejected one or more recipients",
      );
    }

    return {
      messageId: info.messageId,
      accepted,
      rejected,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
    };
  } catch (error) {
    logger.error(
      safeErrorMetadata(error),
      "Email submission failed",
    );

    throw error;
  } finally {
    endOperation();
  }
}

/**
 * Verify SMTP connectivity and authentication.
 *
 * A successful verification does not guarantee delivery to a particular
 * mailbox or prove that a recipient will accept a future message.
 */
export async function verifyEmailTransport() {
  const endOperation = beginOperation();

  try {
    const transport = getEmailTransporter();

    await transport.verify();

    logger.info("SMTP transport verification succeeded");

    return { ok: true };
  } catch (error) {
    logger.error(
      safeErrorMetadata(error),
      "SMTP transport verification failed",
    );

    throw error;
  } finally {
    endOperation();
  }
}

/**
 * Drain active operations and close the pooled transporter.
 *
 * Concurrent close calls share one promise. Once shutdown starts,
 * new operations are rejected.
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
