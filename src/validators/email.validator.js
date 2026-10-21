
'use strict';

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_DOMAIN_LABEL_LENGTH = 63;

const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F]/;

const LOCAL_PART_REGEX =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;

const DOMAIN_LABEL_REGEX =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function validationError(
  message,
  code = 'INVALID_EMAIL',
  field = 'email'
) {
  const error = new Error(message);

  error.name = 'ValidationError';
  error.status = 400;
  error.statusCode = 400;
  error.code = code;
  error.publicMessage = message;

  if (field) {
    error.field = field;
  }

  return error;
}

/**
 * Normalize an email address according to the application's policy.
 *
 * Policy:
 * - Trim surrounding whitespace.
 * - Convert to lowercase.
 *
 * This does not establish mailbox existence or ownership.
 */
function normalizeEmail(value) {
  if (typeof value !== 'string') {
    throw validationError(
      'Email address must be a string.',
      'INVALID_TYPE'
    );
  }

  const email = value.trim().toLowerCase();

  if (!email) {
    throw validationError(
      'Email address is required.',
      'REQUIRED_FIELD'
    );
  }

  if (CONTROL_CHARACTERS_REGEX.test(email)) {
    throw validationError(
      'Email address must not contain control characters.',
      'INVALID_FORMAT'
    );
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    throw validationError(
      `Email address must not exceed ${MAX_EMAIL_LENGTH} characters.`,
      'OUT_OF_RANGE'
    );
  }

  return email;
}

/**
 * Validate a common dot-atom email address.
 *
 * Supported:
 * - Standard ASCII email addresses.
 * - Lowercase normalization.
 * - Optional missing values when required is false.
 *
 * Not supported:
 * - Display-name formats.
 * - Quoted local parts.
 * - Internationalized email addresses.
 *
 * This function does not perform DNS, mailbox-existence, or
 * ownership verification.
 */
function validateEmail(value, options = {}) {
  const {
    required = true,
    allowDisplayName = false,
  } = options;

  if (value === undefined || value === null) {
    if (!required) {
      return undefined;
    }

    throw validationError(
      'Email address is required.',
      'REQUIRED_FIELD'
    );
  }

  if (typeof value !== 'string') {
    throw validationError(
      'Email address must be a string.',
      'INVALID_TYPE'
    );
  }

  const email = normalizeEmail(value);

  // Display-name parsing is intentionally unsupported.
  // Reject the option explicitly instead of silently ignoring it.
  if (allowDisplayName) {
    throw validationError(
      'Display-name email formats are not supported. Provide the email address only.',
      'UNSUPPORTED_FORMAT'
    );
  }

  if (/\s/.test(email)) {
    throw validationError(
      'Email address must not contain whitespace.',
      'INVALID_FORMAT'
    );
  }

  const separatorIndex = email.indexOf('@');

  if (
    separatorIndex <= 0 ||
    separatorIndex !== email.lastIndexOf('@') ||
    separatorIndex === email.length - 1
  ) {
    throw validationError(
      'Enter a valid email address.',
      'INVALID_FORMAT'
    );
  }

  const localPart = email.slice(0, separatorIndex);
  const domain = email.slice(separatorIndex + 1);

  if (
    localPart.length === 0 ||
    localPart.length > MAX_LOCAL_PART_LENGTH ||
    !LOCAL_PART_REGEX.test(localPart)
  ) {
    throw validationError(
      'Email address has an invalid local part.',
      'INVALID_FORMAT'
    );
  }

  if (
    domain.length === 0 ||
    domain.length > MAX_DOMAIN_LENGTH
  ) {
    throw validationError(
      'Email address has an invalid domain.',
      'INVALID_FORMAT'
    );
  }

  const labels = domain.split('.');

  if (labels.length < 2) {
    throw validationError(
      'Email domain must contain a valid domain suffix.',
      'INVALID_FORMAT'
    );
  }

  for (const label of labels) {
    if (
      label.length === 0 ||
      label.length > MAX_DOMAIN_LABEL_LENGTH ||
      !DOMAIN_LABEL_REGEX.test(label)
    ) {
      throw validationError(
        'Email address has an invalid domain.',
        'INVALID_FORMAT'
      );
    }
  }

  const suffix = labels[labels.length - 1];

  if (!/[a-z]/i.test(suffix)) {
    throw validationError(
      'Email domain suffix is invalid.',
      'INVALID_FORMAT'
    );
  }

  return email;
}

/**
 * Boolean convenience wrapper.
 *
 * Returns false for invalid addresses and invalid options.
 */
function isValidEmail(value, options = {}) {
  try {
    validateEmail(value, options);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  validateEmail,
  normalizeEmail,
  isValidEmail,
  MAX_EMAIL_LENGTH,
  MAX_LOCAL_PART_LENGTH,
  MAX_DOMAIN_LENGTH,
  MAX_DOMAIN_LABEL_LENGTH,
};
