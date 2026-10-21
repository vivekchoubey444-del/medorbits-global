
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredString,
} = require('./service-utils');

const DEFAULT_ACTION_TOKEN_TTL_MINUTES = 30;
const MAX_SUBJECT_LENGTH = 998;
const MAX_BODY_LENGTH = 200000;
const MAX_VARIABLES_BYTES = 32768;
const MAX_METADATA_BYTES = 16384;
const MAX_EXPIRY_MINUTES = 1440;

function createEmailService({
  provider,
  from,
  emailRepository,
  allowedHosts = [],
  appUrl,
  clock = () => new Date(),
}) {
  requireDependency(provider, 'email provider');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const sender = requiredString(from, 'from', { max: 254 });

  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender)) {
    throw new TypeError('from must be a valid email address.');
  }

  if (
    !Array.isArray(allowedHosts) ||
    !allowedHosts.every(
      (host) => typeof host === 'string' && host.trim().length > 0,
    )
  ) {
    throw new TypeError(
      'allowedHosts must be an array of non-empty strings.',
    );
  }

  const normalizedAllowedHosts = allowedHosts.map((host) =>
    host.trim().toLowerCase().replace(/\.$/, ''),
  );

  const baseUrl = appUrl
    ? requiredString(appUrl, 'appUrl', { max: 2048 })
    : null;

  if (baseUrl) {
    let parsed;

    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new TypeError('appUrl must be a valid absolute URL.');
    }

    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '[::1]';

    if (
      parsed.protocol !== 'https:' &&
      !(parsed.protocol === 'http:' && isLocalhost)
    ) {
      throw new TypeError(
        'appUrl must use HTTPS except for localhost development.',
      );
    }

    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new TypeError(
        'appUrl must not contain credentials, query parameters, or fragments.',
      );
    }

    if (parsed.pathname !== '/') {
      throw new TypeError(
        'appUrl must be an origin without a path.',
      );
    }
  }

  function getNow() {
    const value = clock();
    const date = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new ServiceError('Invalid service clock value.', {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      });
    }

    return date;
  }

  function normalizeRecipient(value) {
    const recipient = requiredString(value, 'to', { max: 254 });

    if (
      !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient) ||
      /[\r\n\u0000-\u001f\u007f]/.test(recipient)
    ) {
      throw new ServiceError('Invalid recipient email address.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const host = recipient
      .slice(recipient.lastIndexOf('@') + 1)
      .toLowerCase()
      .replace(/\.$/, '');

    if (
      normalizedAllowedHosts.length > 0 &&
      !normalizedAllowedHosts.includes(host)
    ) {
      throw new ServiceError('Recipient domain is not allowed.', {
        code: 'RECIPIENT_NOT_ALLOWED',
        status: 422,
      });
    }

    return recipient;
  }

  function normalizeText(value, field, maxLength) {
    if (value === undefined) {
      return undefined;
    }

    if (
      typeof value !== 'string' ||
      value.length > maxLength ||
      value.includes('\u0000')
    ) {
      throw new ServiceError(`Invalid ${field}.`, {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return value;
  }

  function normalizeObject(value, field, maxBytes) {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    ) {
      throw new ServiceError(`${field} must be a plain object.`, {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new ServiceError(`${field} is invalid.`, {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (
      typeof serialized !== 'string' ||
      Buffer.byteLength(serialized, 'utf8') > maxBytes
    ) {
      throw new ServiceError(`${field} exceeds the allowed size.`, {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return JSON.parse(serialized);
  }

  function normalizeExpiry(value) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > MAX_EXPIRY_MINUTES
    ) {
      throw new ServiceError('Invalid email token expiry.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return value;
  }

  async function updateEmailRecord(record, changes) {
    if (record?.id == null) {
      return;
    }

    if (typeof emailRepository?.updateById !== 'function') {
      throw new ServiceError(
        'Email repository must implement updateById().',
        {
          code: 'EMAIL_REPOSITORY_MISCONFIGURED',
          status: 503,
        },
      );
    }

    await emailRepository.updateById(record.id, changes);
  }

  async function send({
    to,
    subject,
    text,
    html,
    template,
    variables = {},
    metadata = {},
  } = {}) {
    const recipient = normalizeRecipient(to);
    const normalizedSubject = normalizeText(
      subject,
      'subject',
      MAX_SUBJECT_LENGTH,
    );
    const normalizedText = normalizeText(text, 'text', MAX_BODY_LENGTH);
    const normalizedHtml = normalizeText(html, 'html', MAX_BODY_LENGTH);
    const normalizedTemplate = normalizeText(
      template,
      'template',
      100,
    );

    const hasSubject =
      typeof normalizedSubject === 'string' &&
      normalizedSubject.trim().length > 0;

    const hasTemplate =
      typeof normalizedTemplate === 'string' &&
      normalizedTemplate.trim().length > 0;

    if (!hasSubject && !hasTemplate) {
      throw new ServiceError(
        'Email subject or template is required.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      );
    }

    if (
      !normalizedText &&
      !normalizedHtml &&
      !hasTemplate
    ) {
      throw new ServiceError(
        'Email text, HTML, or a registered template is required.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      );
    }

    const safeVariables = normalizeObject(
      variables,
      'variables',
      MAX_VARIABLES_BYTES,
    );

    const safeMetadata = normalizeObject(
      metadata,
      'metadata',
      MAX_METADATA_BYTES,
    );

    const payload = {
      from: sender,
      to: recipient,
      subject: hasSubject ? normalizedSubject.trim() : undefined,
      text: normalizedText,
      html: normalizedHtml,
      template: hasTemplate ? normalizedTemplate.trim() : undefined,
      variables: safeVariables,
    };

    let record = null;

    if (emailRepository) {
      if (typeof emailRepository.create !== 'function') {
        throw new ServiceError(
          'Email repository must implement create().',
          {
            code: 'EMAIL_REPOSITORY_MISCONFIGURED',
            status: 503,
          },
        );
      }

      record = await emailRepository.create({
        to: recipient,
        subject: payload.subject || payload.template,
        template: payload.template || null,
        status: 'queued',
        metadata: safeMetadata,
      });
    }

    try {
      let result;

      if (typeof provider.send === 'function') {
        result = await provider.send(payload);
      } else if (typeof provider.sendMail === 'function') {
        result = await provider.sendMail(payload);
      } else {
        throw new ServiceError(
          'Email provider must implement send() or sendMail().',
          {
            code: 'EMAIL_PROVIDER_MISCONFIGURED',
            status: 503,
          },
        );
      }

      const messageId =
        typeof result?.messageId === 'string'
          ? result.messageId
          : typeof result?.id === 'string'
            ? result.id
            : null;

      await updateEmailRecord(record, {
        status: 'sent',
        providerMessageId: messageId,
        sentAt: getNow(),
      });

      return {
        accepted: true,
        messageId,
      };
    } catch (error) {
      try {
        await updateEmailRecord(record, {
          status: 'failed',
          failureCode:
            typeof error?.code === 'string' &&
            /^[A-Z0-9_-]{1,80}$/i.test(error.code)
              ? error.code
              : 'PROVIDER_ERROR',
          failedAt: getNow(),
        });
      } catch {
        // Record persistence failures through infrastructure monitoring.
      }

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError('Email could not be delivered.', {
        code: 'EMAIL_DELIVERY_FAILED',
        status: 502,
      });
    }
  }

  function buildActionUrl(path, token) {
    if (!baseUrl) {
      throw new ServiceError(
        'Email action URL configuration is missing.',
        {
          code: 'EMAIL_CONFIGURATION_ERROR',
          status: 503,
        },
      );
    }

    const safeToken = requiredString(token, 'token', { max: 256 });

    if (!/^[a-f0-9]{64}$/i.test(safeToken)) {
      throw new ServiceError('Invalid email action token.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const url = new URL(path, `${baseUrl}/`);
    url.searchParams.set('token', safeToken);

    return url.toString();
  }

  function normalizeName(name) {
    if (name === undefined || name === null) {
      return '';
    }

    if (typeof name !== 'string' || name.length > 200) {
      throw new ServiceError('Invalid recipient name.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return name.trim();
  }

  return {
    send,

    async sendVerificationEmail({
      to,
      name,
      token,
      expiryMinutes = DEFAULT_ACTION_TOKEN_TTL_MINUTES,
    } = {}) {
      const verificationUrl = buildActionUrl('/verify-email', token);

      return send({
        to,
        subject: 'Verify your MedOrbits email',
        template: 'verification',
        variables: {
          firstName: normalizeName(name),
          email: normalizeRecipient(to),
          verificationUrl,
          expiryMinutes: normalizeExpiry(expiryMinutes),
          year: getNow().getFullYear(),
        },
        metadata: {
          category: 'email_verification',
        },
      });
    },

    async sendPasswordResetEmail({
      to,
      name,
      token,
      expiryMinutes = DEFAULT_ACTION_TOKEN_TTL_MINUTES,
    } = {}) {
      const resetUrl = buildActionUrl('/reset-password', token);

      return send({
        to,
        subject: 'Reset your MedOrbits password',
        template: 'password-reset',
        variables: {
          firstName: normalizeName(name),
          email: normalizeRecipient(to),
          resetUrl,
          expiryMinutes: normalizeExpiry(expiryMinutes),
          year: getNow().getFullYear(),
        },
        metadata: {
          category: 'password_reset',
        },
      });
    },
  };
}

module.exports = {
  createEmailService,
  DEFAULT_ACTION_TOKEN_TTL_MINUTES,
  MAX_EXPIRY_MINUTES,
};
