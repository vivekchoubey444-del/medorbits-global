
/**
 * MedOrbits -- Shared Validation Utilities
 * File: /src/js/utils/validators.js
 *
 * Purpose:
 * - Validate common strings, identifiers, numbers, dates, and URLs.
 * - Validate email addresses, phone numbers, and passwords.
 * - Validate application, job, and pagination data.
 * - Validate upload metadata and enumerated values.
 * - Provide reusable result objects and field-level validation helpers.
 *
 * Module format: ES Module
 *
 * Security:
 * - Client-side validation can be bypassed.
 * - This module does not replace server-side validation.
 * - URL validation does not prevent SSRF.
 * - File MIME types supplied by browsers are untrusted.
 */

import {
  VALIDATION,
  APPLICATION_STATUS,
  JOB_STATUS,
  USER_ROLE,
} from "./contants.js";

/* --------------------------------------------------------------------------
 * Validation result helpers
 * -------------------------------------------------------------------------- */

function success(value, message = "") {
  return {
    valid: true,
    value,
    message,
    errors: [],
  };
}

function failure(message, code = "VALIDATION_ERROR") {
  return {
    valid: false,
    value: undefined,
    message,
    errors: [
      {
        code,
        message,
      },
    ],
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : null;
}

function normalizeEnum(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function makeFieldError(field, message, code = "VALIDATION_ERROR") {
  return {
    field,
    code,
    message,
  };
}

/* --------------------------------------------------------------------------
 * General string validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a required or optional string.
 */
export function validateString(
  value,
  {
    required = true,
    minLength = 0,
    maxLength = VALIDATION.MAX_TEXT_LENGTH,
    trim = true,
    allowNewlines = true,
    label = "Value",
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success("");
  }

  if (typeof value !== "string") {
    return failure(`${label} must be text.`, "INVALID_TYPE");
  }

  const normalized = trim ? value.trim() : value;

  if (!allowNewlines && /[\r\n]/.test(normalized)) {
    return failure(`${label} must be a single line.`, "INVALID_FORMAT");
  }

  if (normalized.length < minLength) {
    return failure(
      `${label} must contain at least ${minLength} characters.`,
      "MIN_LENGTH"
    );
  }

  if (normalized.length > maxLength) {
    return failure(
      `${label} must not exceed ${maxLength} characters.`,
      "MAX_LENGTH"
    );
  }

  return success(normalized);
}

/**
 * Validate a person's name.
 *
 * Unicode letters and common name punctuation are supported.
 * Avoid imposing a rigid name format on international users.
 */
export function validateName(
  value,
  {
    required = true,
    minLength = VALIDATION.MIN_NAME_LENGTH,
    maxLength = VALIDATION.MAX_NAME_LENGTH,
    label = "Name",
  } = {}
) {
  const result = validateString(value, {
    required,
    minLength,
    maxLength,
    label,
    allowNewlines: false,
  });

  if (!result.valid || result.value === "") {
    return result;
  }

  if (/[\u0000-\u001F\u007F]/u.test(result.value)) {
    return failure(`${label} contains invalid characters.`, "INVALID_FORMAT");
  }

  if (!/[\p{L}\p{N}]/u.test(result.value)) {
    return failure(`${label} must contain a letter or number.`, "INVALID_FORMAT");
  }

  return result;
}

/**
 * Validate a plain-text field.
 *
 * This does not sanitize HTML. Use textContent when rendering user input.
 */
export function validatePlainText(
  value,
  {
    required = true,
    minLength = 0,
    maxLength = VALIDATION.MAX_TEXT_LENGTH,
    allowNewlines = true,
    label = "Text",
  } = {}
) {
  const result = validateString(value, {
    required,
    minLength,
    maxLength,
    allowNewlines,
    label,
  });

  if (!result.valid || result.value === "") {
    return result;
  }

  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(result.value)) {
    return failure(`${label} contains unsupported control characters.`, "INVALID_FORMAT");
  }

  return result;
}

/**
 * Validate an identifier without assuming a particular database format.
 */
export function validateIdentifier(
  value,
  {
    required = true,
    maxLength = VALIDATION.MAX_IDENTIFIER_LENGTH,
    label = "Identifier",
    pattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success("");
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return failure(`${label} is invalid.`, "INVALID_TYPE");
  }

  const identifier = String(value).trim();

  if (!identifier || identifier.length > maxLength) {
    return failure(`${label} has an invalid length.`, "INVALID_LENGTH");
  }

  if (!pattern.test(identifier)) {
    return failure(`${label} contains unsupported characters.`, "INVALID_FORMAT");
  }

  return success(identifier);
}

/* --------------------------------------------------------------------------
 * Email and telephone validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a conventional email address.
 *
 * This is a pragmatic application check, not a complete implementation of
 * every RFC-valid mailbox format. Verify email ownership separately.
 */
export function validateEmail(
  value,
  {
    required = true,
    maxLength = VALIDATION.MAX_EMAIL_LENGTH,
    normalize = true,
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure("Email address is required.", "REQUIRED")
      : success("");
  }

  if (typeof value !== "string") {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  const email = normalize ? value.trim().toLowerCase() : value.trim();

  if (email.length > maxLength || /[\s\u0000-\u001F\u007F]/u.test(email)) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === email.length - 1) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  if (domain.length > 253 || !domain.includes(".")) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  const labels = domain.split(".");

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
    )
  ) {
    return failure("Enter a valid email address.", "INVALID_EMAIL");
  }

  return success(email);
}

/**
 * Validate a phone number using a practical international input policy.
 *
 * This checks structure only; it does not verify assignment or reachability.
 */
export function validatePhone(
  value,
  {
    required = true,
    minDigits = 7,
    maxDigits = 15,
    allowExtension = false,
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure("Phone number is required.", "REQUIRED")
      : success("");
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return failure("Enter a valid phone number.", "INVALID_PHONE");
  }

  const phone = String(value).trim();

  const extensionPattern = allowExtension
    ? /(?:\s*(?:ext\.?|x|#)\s*\d{1,8})?$/i
    : /$^/;

  if (!extensionPattern.test(phone)) {
    return failure("Enter a valid phone number.", "INVALID_PHONE");
  }

  const withoutExtension = allowExtension
    ? phone.replace(/(?:\s*(?:ext\.?|x|#)\s*\d{1,8})$/i, "")
    : phone;

  if (!/^\+?[0-9().\-\s]+$/.test(withoutExtension)) {
    return failure("Enter a valid phone number.", "INVALID_PHONE");
  }

  const digits = withoutExtension.replace(/\D/g, "");

  if (digits.length < minDigits || digits.length > maxDigits) {
    return failure("Enter a valid phone number.", "INVALID_PHONE");
  }

  return success(phone);
}

/* --------------------------------------------------------------------------
 * Password validation
 * -------------------------------------------------------------------------- */

/**
 * Check password length and optional composition requirements.
 *
 * Prefer modern passphrase-friendly policies and server-side rate limiting.
 * Do not return or log the supplied password in error details.
 */
export function validatePassword(
  value,
  {
    minLength = VALIDATION.MIN_PASSWORD_LENGTH,
    maxLength = VALIDATION.MAX_PASSWORD_LENGTH,
    requireUppercase = false,
    requireLowercase = false,
    requireNumber = false,
    requireSymbol = false,
    required = true,
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure("Password is required.", "REQUIRED")
      : success("");
  }

  if (typeof value !== "string") {
    return failure("Enter a valid password.", "INVALID_PASSWORD");
  }

  if (value.length < minLength) {
    return failure(
      `Password must contain at least ${minLength} characters.`,
      "PASSWORD_TOO_SHORT"
    );
  }

  if (value.length > maxLength) {
    return failure(
      `Password must not exceed ${maxLength} characters.`,
      "PASSWORD_TOO_LONG"
    );
  }

  if (/[\u0000-\u001F\u007F]/u.test(value)) {
    return failure("Password contains unsupported control characters.", "INVALID_PASSWORD");
  }

  if (requireUppercase && !/[A-Z]/.test(value)) {
    return failure("Password must include an uppercase letter.", "PASSWORD_UPPERCASE");
  }

  if (requireLowercase && !/[a-z]/.test(value)) {
    return failure("Password must include a lowercase letter.", "PASSWORD_LOWERCASE");
  }

  if (requireNumber && !/[0-9]/.test(value)) {
    return failure("Password must include a number.", "PASSWORD_NUMBER");
  }

  if (requireSymbol && !/[^A-Za-z0-9]/.test(value)) {
    return failure("Password must include a symbol.", "PASSWORD_SYMBOL");
  }

  return success(value);
}

/**
 * Compare password confirmation fields.
 */
export function validatePasswordConfirmation(
  password,
  confirmation,
  { required = true } = {}
) {
  if (isEmpty(confirmation)) {
    return required
      ? failure("Confirm your password.", "REQUIRED")
      : success("");
  }

  if (typeof password !== "string" || typeof confirmation !== "string") {
    return failure("Passwords do not match.", "PASSWORD_MISMATCH");
  }

  return password === confirmation
    ? success(true)
    : failure("Passwords do not match.", "PASSWORD_MISMATCH");
}

/* --------------------------------------------------------------------------
 * Numeric validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a finite numeric value and optional bounds.
 */
export function validateNumber(
  value,
  {
    required = true,
    min = -Infinity,
    max = Infinity,
    integer = false,
    label = "Value",
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success(null);
  }

  const number = finiteNumber(value);

  if (number === null) {
    return failure(`${label} must be a valid number.`, "INVALID_NUMBER");
  }

  if (integer && !Number.isInteger(number)) {
    return failure(`${label} must be a whole number.`, "INVALID_INTEGER");
  }

  if (number < min) {
    return failure(`${label} must be at least ${min}.`, "MIN_VALUE");
  }

  if (number > max) {
    return failure(`${label} must not exceed ${max}.`, "MAX_VALUE");
  }

  return success(number);
}

/**
 * Validate a positive integer, such as a page number or quantity.
 */
export function validatePositiveInteger(
  value,
  {
    min = 1,
    max = Number.MAX_SAFE_INTEGER,
    label = "Value",
  } = {}
) {
  return validateNumber(value, {
    required: true,
    min,
    max,
    integer: true,
    label,
  });
}

/**
 * Validate a percentage supplied as a number from 0 to 100.
 */
export function validatePercentage(
  value,
  { required = true, label = "Percentage" } = {}
) {
  return validateNumber(value, {
    required,
    min: 0,
    max: 100,
    label,
  });
}

/**
 * Validate a numeric range.
 */
export function validateRange(minValue, maxValue, label = "Range") {
  const min = finiteNumber(minValue);
  const max = finiteNumber(maxValue);

  if (min === null || max === null) {
    return failure(`${label} must contain valid minimum and maximum values.`, "INVALID_RANGE");
  }

  if (min > max) {
    return failure(`${label} minimum must not exceed its maximum.`, "INVALID_RANGE");
  }

  return success({ min, max });
}

/* --------------------------------------------------------------------------
 * Date validation
 * -------------------------------------------------------------------------- */

/**
 * Parse supported date inputs.
 *
 * For date-only fields, prefer the canonical YYYY-MM-DD format.
 */
export function validateDate(
  value,
  {
    required = true,
    minDate,
    maxDate,
    label = "Date",
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success(null);
  }

  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return failure(`${label} is invalid.`, "INVALID_DATE");
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));

    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return failure(`${label} is not a valid calendar date.`, "INVALID_DATE");
    }
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return failure(`${label} is invalid.`, "INVALID_DATE");
  }

  if (minDate !== undefined) {
    const min = new Date(minDate);

    if (Number.isNaN(min.getTime())) {
      return failure("Date validation configuration is invalid.", "INVALID_CONFIG");
    }

    if (date < min) {
      return failure(`${label} is earlier than permitted.`, "DATE_TOO_EARLY");
    }
  }

  if (maxDate !== undefined) {
    const max = new Date(maxDate);

    if (Number.isNaN(max.getTime())) {
      return failure("Date validation configuration is invalid.", "INVALID_CONFIG");
    }

    if (date > max) {
      return failure(`${label} is later than permitted.`, "DATE_TOO_LATE");
    }
  }

  return success(date);
}

/**
 * Validate that a date occurs after another date.
 */
export function validateDateOrder(
  startValue,
  endValue,
  {
    allowEqual = true,
    label = "Date range",
  } = {}
) {
  const start = validateDate(startValue, { label: `${label} start` });
  const end = validateDate(endValue, { label: `${label} end` });

  if (!start.valid) return start;
  if (!end.valid) return end;

  const ordered = allowEqual
    ? start.value.getTime() <= end.value.getTime()
    : start.value.getTime() < end.value.getTime();

  return ordered
    ? success({ start: start.value, end: end.value })
    : failure(`${label} has an invalid order.`, "INVALID_DATE_ORDER");
}

/* --------------------------------------------------------------------------
 * URL validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a URL for browser-side use.
 *
 * This function does not establish destination trust and is not an SSRF
 * defense for servers that fetch user-provided URLs.
 */
export function validateUrl(
  value,
  {
    required = true,
    protocols = ["https:", "http:"],
    allowCredentials = false,
    label = "URL",
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success("");
  }

  if (typeof value !== "string") {
    return failure(`Enter a valid ${label.toLowerCase()}.`, "INVALID_URL");
  }

  const input = value.trim();

  if (/[\u0000-\u0020\u007F]/u.test(input)) {
    return failure(`Enter a valid ${label.toLowerCase()}.`, "INVALID_URL");
  }

  let url;

  try {
    url = new URL(input);
  } catch {
    return failure(`Enter a valid ${label.toLowerCase()}.`, "INVALID_URL");
  }

  if (!protocols.includes(url.protocol)) {
    return failure(`${label} uses an unsupported protocol.`, "INVALID_PROTOCOL");
  }

  if (!allowCredentials && (url.username || url.password)) {
    return failure(`${label} must not contain embedded credentials.`, "URL_CREDENTIALS");
  }

  if (!url.hostname) {
    return failure(`Enter a valid ${label.toLowerCase()}.`, "INVALID_URL");
  }

  return success(url.href);
}

/* --------------------------------------------------------------------------
 * Enumerations and allowlists
 * -------------------------------------------------------------------------- */

/**
 * Validate a value against an explicit allowlist.
 */
export function validateChoice(
  value,
  allowedValues,
  {
    required = true,
    caseInsensitive = false,
    label = "Selection",
  } = {}
) {
  if (isEmpty(value)) {
    return required
      ? failure(`${label} is required.`, "REQUIRED")
      : success("");
  }

  if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
    return failure("Validation configuration is invalid.", "INVALID_CONFIG");
  }

  const candidate = String(value).trim();

  const match = allowedValues.find((item) => {
    if (typeof item !== "string") {
      return item === value;
    }

    return caseInsensitive
      ? item.toLowerCase() === candidate.toLowerCase()
      : item === candidate;
  });

  if (match === undefined) {
    return failure(`Select a valid ${label.toLowerCase()}.`, "INVALID_CHOICE");
  }

  return success(match);
}

export function validateApplicationStatus(value) {
  return validateChoice(
    normalizeEnum(value),
    Object.values(APPLICATION_STATUS),
    { label: "Application status" }
  );
}

export function validateJobStatus(value) {
  return validateChoice(
    normalizeEnum(value),
    Object.values(JOB_STATUS),
    { label: "Job status" }
  );
}

export function validateUserRole(value) {
  return validateChoice(
    normalizeEnum(value),
    Object.values(USER_ROLE),
    { label: "User role" }
  );
}

/* --------------------------------------------------------------------------
 * File metadata validation
 * -------------------------------------------------------------------------- */

/**
 * Validate browser File metadata.
 *
 * MIME type and filename are untrusted. Server-side file inspection is required.
 */
export function validateFile(
  file,
  {
    required = true,
    maxSizeBytes = VALIDATION.MAX_UPLOAD_SIZE_BYTES,
    allowedMimeTypes = [
      ...VALIDATION.ALLOWED_DOCUMENT_MIME_TYPES,
      ...VALIDATION.ALLOWED_IMAGE_MIME_TYPES,
    ],
    maxNameLength = 255,
  } = {}
) {
  if (isEmpty(file)) {
    return required
      ? failure("Choose a file to upload.", "REQUIRED")
      : success(null);
  }

  if (
    typeof File !== "undefined" &&
    !(file instanceof File)
  ) {
    return failure("The selected file is invalid.", "INVALID_FILE");
  }

  if (
    !file ||
    typeof file !== "object" ||
    typeof file.name !== "string" ||
    !Number.isFinite(file.size) ||
    typeof file.type !== "string"
  ) {
    return failure("The selected file is invalid.", "INVALID_FILE");
  }

  const filename = file.name.trim();

  if (
    !filename ||
    filename.length > maxNameLength ||
    /[\u0000-\u001F\u007F/\\]/u.test(filename)
  ) {
    return failure("The filename is invalid.", "INVALID_FILENAME");
  }

  if (file.size < 0 || file.size > maxSizeBytes) {
    return failure("The selected file exceeds the permitted size.", "FILE_TOO_LARGE");
  }

  if (!Array.isArray(allowedMimeTypes) || allowedMimeTypes.length === 0) {
    return failure("File validation configuration is invalid.", "INVALID_CONFIG");
  }

  if (!allowedMimeTypes.includes(file.type)) {
    return failure("This file type is not supported.", "INVALID_FILE_TYPE");
  }

  return success(file);
}

/* --------------------------------------------------------------------------
 * Pagination validation
 * -------------------------------------------------------------------------- */

/**
 * Validate pagination parameters.
 */
export function validatePagination(
  page,
  pageSize,
  {
    maxPageSize = VALIDATION.MAX_PAGE_SIZE,
    defaultPageSize = VALIDATION.DEFAULT_PAGE_SIZE,
  } = {}
) {
  const validatedPage = validatePositiveInteger(page, {
    min: 1,
    label: "Page",
  });

  if (!validatedPage.valid) {
    return validatedPage;
  }

  const candidatePageSize = isEmpty(pageSize)
    ? defaultPageSize
    : pageSize;

  const validatedPageSize = validatePositiveInteger(candidatePageSize, {
    min: 1,
    max: maxPageSize,
    label: "Page size",
  });

  if (!validatedPageSize.valid) {
    return validatedPageSize;
  }

  return success({
    page: validatedPage.value,
    pageSize: validatedPageSize.value,
  });
}

/* --------------------------------------------------------------------------
 * Application payload validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a basic application payload.
 *
 * Adjust required fields and constraints to match the canonical backend
 * application schema. Never rely on this helper as the API's only validator.
 */
export function validateApplicationPayload(
  payload,
  {
    requiredFields = ["name", "email"],
    allowedStatuses = Object.values(APPLICATION_STATUS),
  } = {}
) {
  if (!isPlainObject(payload)) {
    return failure("Application data must be an object.", "INVALID_PAYLOAD");
  }

  const errors = [];

  for (const field of requiredFields) {
    if (isEmpty(payload[field])) {
      errors.push(makeFieldError(field, `${field} is required.`, "REQUIRED"));
    }
  }

  if (!isEmpty(payload.name)) {
    const result = validateName(payload.name);

    if (!result.valid) {
      errors.push(makeFieldError("name", result.message, result.errors[0].code));
    }
  }

  if (!isEmpty(payload.email)) {
    const result = validateEmail(payload.email);

    if (!result.valid) {
      errors.push(makeFieldError("email", result.message, result.errors[0].code));
    }
  }

  if (hasOwn(payload, "phone") && !isEmpty(payload.phone)) {
    const result = validatePhone(payload.phone, { required: false });

    if (!result.valid) {
      errors.push(makeFieldError("phone", result.message, result.errors[0].code));
    }
  }

  if (hasOwn(payload, "status") && !isEmpty(payload.status)) {
    const result = validateChoice(payload.status, allowedStatuses, {
      caseInsensitive: true,
      label: "Application status",
    });

    if (!result.valid) {
      errors.push(makeFieldError("status", result.message, result.errors[0].code));
    }
  }

  return errors.length
    ? {
        valid: false,
        value: undefined,
        message: "Please correct the application information.",
        errors,
      }
    : success(payload);
}

/* --------------------------------------------------------------------------
 * Job payload validation
 * -------------------------------------------------------------------------- */

/**
 * Validate a basic job payload.
 *
 * Adapt required fields and salary/experience rules to the actual job schema.
 */
export function validateJobPayload(
  payload,
  {
    requiredFields = ["title", "description"],
    allowedStatuses = Object.values(JOB_STATUS),
  } = {}
) {
  if (!isPlainObject(payload)) {
    return failure("Job data must be an object.", "INVALID_PAYLOAD");
  }

  const errors = [];

  for (const field of requiredFields) {
    if (isEmpty(payload[field])) {
      errors.push(makeFieldError(field, `${field} is required.`, "REQUIRED"));
    }
  }

  if (!isEmpty(payload.title)) {
    const result = validateString(payload.title, {
      minLength: 2,
      maxLength: 200,
      label: "Job title",
      allowNewlines: false,
    });

    if (!result.valid) {
      errors.push(makeFieldError("title", result.message, result.errors[0].code));
    }
  }

  if (!isEmpty(payload.description)) {
    const result = validatePlainText(payload.description, {
      minLength: 10,
      maxLength: VALIDATION.MAX_TEXT_LENGTH,
      label: "Job description",
    });

    if (!result.valid) {
      errors.push(makeFieldError("description", result.message, result.errors[0].code));
    }
  }

  if (hasOwn(payload, "status") && !isEmpty(payload.status)) {
    const result = validateChoice(payload.status, allowedStatuses, {
      caseInsensitive: true,
      label: "Job status",
    });

    if (!result.valid) {
      errors.push(makeFieldError("status", result.message, result.errors[0].code));
    }
  }

  if (
    hasOwn(payload, "minSalary") &&
    !isEmpty(payload.minSalary)
  ) {
    const result = validateNumber(payload.minSalary, {
      min: 0,
      label: "Minimum salary",
    });

    if (!result.valid) {
      errors.push(makeFieldError("minSalary", result.message, result.errors[0].code));
    }
  }

  if (
    hasOwn(payload, "maxSalary") &&
    !isEmpty(payload.maxSalary)
  ) {
    const result = validateNumber(payload.maxSalary, {
      min: 0,
      label: "Maximum salary",
    });

    if (!result.valid) {
      errors.push(makeFieldError("maxSalary", result.message, result.errors[0].code));
    }
  }

  if (
    !isEmpty(payload.minSalary) &&
    !isEmpty(payload.maxSalary)
  ) {
    const range = validateRange(
      payload.minSalary,
      payload.maxSalary,
      "Salary range"
    );

    if (!range.valid) {
      errors.push(
        makeFieldError("maxSalary", range.message, range.errors[0].code)
      );
    }
  }

  if (
    hasOwn(payload, "minExperience") &&
    !isEmpty(payload.minExperience)
  ) {
    const result = validateNumber(payload.minExperience, {
      min: 0,
      label: "Minimum experience",
    });

    if (!result.valid) {
      errors.push(makeFieldError("minExperience", result.message, result.errors[0].code));
    }
  }

  if (
    hasOwn(payload, "maxExperience") &&
    !isEmpty(payload.maxExperience)
  ) {
    const result = validateNumber(payload.maxExperience, {
      min: 0,
      label: "Maximum experience",
    });

    if (!result.valid) {
      errors.push(makeFieldError("maxExperience", result.message, result.errors[0].code));
    }
  }

  if (
    !isEmpty(payload.minExperience) &&
    !isEmpty(payload.maxExperience)
  ) {
    const range = validateRange(
      payload.minExperience,
      payload.maxExperience,
      "Experience range"
    );

    if (!range.valid) {
      errors.push(
        makeFieldError("maxExperience", range.message, range.errors[0].code)
      );
    }
  }

  return errors.length
    ? {
        valid: false,
        value: undefined,
        message: "Please correct the job information.",
        errors,
      }
    : success(payload);
}

/* --------------------------------------------------------------------------
 * Cross-field validation
 * -------------------------------------------------------------------------- */

/**
 * Ensure that two fields match.
 */
export function validateMatch(
  firstValue,
  secondValue,
  {
    label = "Values",
    caseInsensitive = false,
    required = true,
  } = {}
) {
  if (isEmpty(firstValue) || isEmpty(secondValue)) {
    return required
      ? failure(`${label} are required.`, "REQUIRED")
      : success(true);
  }

  const first = String(firstValue);
  const second = String(secondValue);

  const matches = caseInsensitive
    ? first.toLowerCase() === second.toLowerCase()
    : first === second;

  return matches
    ? success(true)
    : failure(`${label} do not match.`, "MISMATCH");
}

/**
 * Validate a field using a selected validator.
 */
export function validateField(value, validator, options = {}) {
  if (typeof validator !== "function") {
    return failure("Field validation configuration is invalid.", "INVALID_CONFIG");
  }

  try {
    const result = validator(value, options);

    if (
      !result ||
      typeof result !== "object" ||
      typeof result.valid !== "boolean"
    ) {
      return failure("Field validation could not be completed.", "INVALID_RESULT");
    }

    return result;
  } catch {
    return failure("Field validation could not be completed.", "VALIDATION_FAILED");
  }
}

/**
 * Validate a collection of field definitions.
 *
 * Each field definition:
 * {
 *   name: "email",
 *   value: "student@example.com",
 *   validator: validateEmail,
 *   options: { required: true }
 * }
 */
export function validateFields(fields) {
  if (!Array.isArray(fields)) {
    return failure("Field definitions must be an array.", "INVALID_CONFIG");
  }

  const errors = [];
  const values = {};

  for (const field of fields) {
    if (
      !isPlainObject(field) ||
      typeof field.name !== "string" ||
      !field.name.trim() ||
      typeof field.validator !== "function"
    ) {
      errors.push(
        makeFieldError(
          "form",
          "A field definition is invalid.",
          "INVALID_CONFIG"
        )
      );
      continue;
    }

    const name = field.name.trim();
    const result = validateField(
      field.value,
      field.validator,
      field.options || {}
    );

    if (!result.valid) {
      errors.push(
        ...result.errors.map((error) => ({
          ...error,
          field: name,
        }))
      );
    } else {
      values[name] = result.value;
    }
  }

  return errors.length
    ? {
        valid: false,
        value: undefined,
        message: "Please correct the highlighted fields.",
        errors,
      }
    : success(values);
}

/* --------------------------------------------------------------------------
 * Export convenience object
 * -------------------------------------------------------------------------- */

const validators = Object.freeze({
  validateString,
  validateName,
  validatePlainText,
  validateIdentifier,

  validateEmail,
  validatePhone,

  validatePassword,
  validatePasswordConfirmation,

  validateNumber,
  validatePositiveInteger,
  validatePercentage,
  validateRange,

  validateDate,
  validateDateOrder,

  validateUrl,

  validateChoice,
  validateApplicationStatus,
  validateJobStatus,
  validateUserRole,

  validateFile,
  validatePagination,

  validateApplicationPayload,
  validateJobPayload,

  validateMatch,
  validateField,
  validateFields,
});

export default validators;
