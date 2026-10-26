
'use strict';

/**
 * MedOrbits -- Email Integration Entry Point
 *
 * File: src/integrations/email/index.js
 * Runtime: Node.js >= 20
 *
 * Responsibilities:
 * - Export the email client and provider contract.
 * - Expose the configured SMTP adapter.
 * - Construct clients with injected or environment-configured providers.
 * - Support explicit provider ownership and lifecycle management.
 *
 * Importing this module does not send email or start background workers.
 */

const { EmailClient } = require('./email.client');
const {
  EmailProvider,
  validateEmailProvider,
} = require('./email.provider');
const { SmtpProvider } = require('./smtp.provider');

function validateOptions(options) {
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
    options.env !== undefined &&
    (
      options.env === null ||
      typeof options.env !== 'object' ||
      Array.isArray(options.env)
    )
  ) {
    throw new TypeError(
      'Email environment options must be an object.',
    );
  }

  if (
    options.clientOptions !== undefined &&
    (
      options.clientOptions === null ||
      typeof options.clientOptions !== 'object' ||
      Array.isArray(options.clientOptions)
    )
  ) {
    throw new TypeError(
      'clientOptions must be an object.',
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
    options.provider != null &&
    options.env !== undefined
  ) {
    throw new TypeError(
      'Provide either an injected provider or environment configuration, not both.',
    );
  }
}

function createEmailClient(options = {}) {
  validateOptions(options);

  let provider;
  let ownsProvider;

  if (options.provider != null) {
    provider = validateEmailProvider(options.provider);

    // Injected providers remain externally managed by default.
    ownsProvider = options.ownsProvider === true;
  } else {
    provider = SmtpProvider.fromEnv(
      options.env || process.env,
    );

    validateEmailProvider(provider);

    // The factory created this provider, so the client owns it.
    ownsProvider = true;
  }

  return new EmailClient(provider, {
    ...(options.clientOptions || {}),
    ownsProvider,
  });
}

module.exports = {
  createEmailClient,
  validateProvider: validateEmailProvider,
  EmailClient,
  EmailProvider,
  SmtpProvider,
};
