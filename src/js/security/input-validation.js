
/**
 * MedOrbits -- Input Validation
 * Path: /src/js/security/input-validation.js
 *
 * Features:
 * - Reusable, configurable input validators.
 * - Application and job payload validation.
 * - Accessible field-level validation feedback.
 * - Form validation without inline event handlers.
 * - Safe text normalization.
 * - Explicit, bounded validation rules.
 *
 * Security:
 * - Client-side validation is for usability, not authorization.
 * - Repeat validation on the server.
 * - This module is not an HTML sanitizer.
 * - Never trust client-supplied IDs, field values, or MIME types.
 */

const DEFAULTS = Object.freeze({
  maxTextLength: 5000,
  maxNameLength: 150,
  maxEmailLength: 254,
  maxPhoneDigits: 15,
  minPhoneDigits: 7,
  maxIdentifierLength: 128,
  maxFileBytes: 10 * 1024 * 1024,
});

const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const MIME_TYPE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;

const PHONE_PATTERN = /^[+0-9().\-\s]+$/;

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const FIELD_MESSAGES = Object.freeze({
  required: "This field is required.",
  invalidEmail: "Enter a valid email address.",
  invalidPhone: "Enter a valid phone number.",
  invalidUrl: "Enter a valid HTTPS URL.",
  invalidName: "Enter a valid name.",
  invalidNumber: "Enter a valid number.",
  invalidDate: "Enter a valid date.",
  tooShort: "This value is too short.",
  tooLong: "This value is too long.",
  invalidChoice: "Select a valid option.",
  invalidFileType: "This file type is not allowed.",
  invalidFileSize: "The file exceeds the allowed size.",
});

const registeredForms = new WeakMap();

function result(valid, message = "", code = "") {
  return Object.freeze({ valid, message, code });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function requireString(value, fieldName = "value") {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  return value;
}

function validLimit(value, fallback, { minimum = 0, maximum = 1_000_000 } = {}) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(
      `Validation limit must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function validBooleanOption(value, fallback, name) {
  if (value === undefined) return fallback;

  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean.`);
  }

  return value;
}

function containsControlCharacters(value) {
  return CONTROL_CHARACTER_PATTERN.test(value);
}

/**
 * Normalize whitespace without modifying the original source value.
 */
export function normalizeWhitespace(value) {
  return requireString(value).replace(/\s+/gu, " ").trim();
}

/**
 * Validate an email address.
 *
 * This checks syntax only. It does not verify mailbox existence.
 */
export function validateEmail(
  value,
  { maxLength = DEFAULTS.maxEmailLength } = {},
) {
  maxLength = validLimit(maxLength, DEFAULTS.maxEmailLength, {
    minimum: 1,
    maximum: 4096,
  });

  if (typeof value !== "string") {
    return result(false, "Enter an email address.", "invalid_type");
  }

  const email = value.trim();

  if (!email) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (email.length > maxLength) {
    return result(false, FIELD_MESSAGES.tooLong, "max_length");
  }

  if (/\s/u.test(email) || !EMAIL_PATTERN.test(email)) {
    return result(false, FIELD_MESSAGES.invalidEmail, "invalid_email");
  }

  const separator = email.lastIndexOf("@");
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.length > 253
  ) {
    return result(false, FIELD_MESSAGES.invalidEmail, "invalid_email");
  }

  return result(true);
}

/**
 * Normalize an email address for application-level comparison.
 *
 * Lowercasing the local part is a practical application convention, not a
 * guarantee of universal email-provider equivalence.
 */
export function normalizeEmail(value) {
  const email = requireString(value, "email").trim();

  if (!validateEmail(email).valid) {
    throw new TypeError("Email address is invalid.");
  }

  return email.toLowerCase();
}

/**
 * Validate basic phone syntax and digit count.
 *
 * This does not validate a national numbering plan.
 */
export function validatePhone(
  value,
  {
    minDigits = DEFAULTS.minPhoneDigits,
    maxDigits = DEFAULTS.maxPhoneDigits,
    requireInternationalPrefix = false,
  } = {},
) {
  minDigits = validLimit(minDigits, DEFAULTS.minPhoneDigits, {
    minimum: 1,
    maximum: 30,
  });
  maxDigits = validLimit(maxDigits, DEFAULTS.maxPhoneDigits, {
    minimum: minDigits,
    maximum: 30,
  });
  requireInternationalPrefix = validBooleanOption(
    requireInternationalPrefix,
    false,
    "requireInternationalPrefix",
  );

  if (typeof value !== "string") {
    return result(false, "Enter a phone number.", "invalid_type");
  }

  const phone = value.trim();

  if (!phone) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (!PHONE_PATTERN.test(phone)) {
    return result(false, FIELD_MESSAGES.invalidPhone, "invalid_phone");
  }

  if (
    phone.indexOf("+") !== phone.lastIndexOf("+") ||
    (phone.includes("+") && !phone.startsWith("+"))
  ) {
    return result(
      false,
      "The plus sign must appear only at the beginning.",
      "invalid_phone_prefix",
    );
  }

  const digits = phone.replace(/\D/gu, "");

  if (digits.length < minDigits || digits.length > maxDigits) {
    return result(
      false,
      `Phone number must contain ${minDigits}–${maxDigits} digits.`,
      "invalid_phone_length",
    );
  }

  if (requireInternationalPrefix && !phone.startsWith("+")) {
    return result(
      false,
      "Include the international dialing prefix.",
      "country_code_required",
    );
  }

  return result(true);
}

/**
 * Validate a human-readable name, including non-ASCII letters.
 */
export function validateName(
  value,
  { maxLength = DEFAULTS.maxNameLength } = {},
) {
  maxLength = validLimit(maxLength, DEFAULTS.maxNameLength, {
    minimum: 1,
    maximum: 10_000,
  });

  if (typeof value !== "string") {
    return result(false, "Enter a name.", "invalid_type");
  }

  const name = normalizeWhitespace(value);

  if (!name) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (name.length > maxLength) {
    return result(false, FIELD_MESSAGES.tooLong, "max_length");
  }

  if (containsControlCharacters(name) || !/[\p{L}]/u.test(name)) {
    return result(false, FIELD_MESSAGES.invalidName, "invalid_name");
  }

  return result(true);
}

/**
 * Validate generic text.
 */
export function validateText(
  value,
  {
    required = true,
    minLength = 0,
    maxLength = DEFAULTS.maxTextLength,
    allowNewlines = true,
    trim = true,
  } = {},
) {
  required = validBooleanOption(required, true, "required");
  allowNewlines = validBooleanOption(allowNewlines, true, "allowNewlines");
  trim = validBooleanOption(trim, true, "trim");

  minLength = validLimit(minLength, 0, {
    minimum: 0,
    maximum: 1_000_000,
  });
  maxLength = validLimit(maxLength, DEFAULTS.maxTextLength, {
    minimum: minLength,
    maximum: 1_000_000,
  });

  if (typeof value !== "string") {
    return result(false, "Enter text.", "invalid_type");
  }

  const text = trim ? value.trim() : value;

  if (required && !text) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (!required && !text) {
    return result(true);
  }

  if (containsControlCharacters(text)) {
    return result(
      false,
      "Text contains unsupported control characters.",
      "control_character",
    );
  }

  if (!allowNewlines && /[\r\n\t]/u.test(text)) {
    return result(
      false,
      "Newlines and tabs are not allowed.",
      "invalid_whitespace",
    );
  }

  if (text.length < minLength) {
    return result(false, FIELD_MESSAGES.tooShort, "min_length");
  }

  if (text.length > maxLength) {
    return result(false, FIELD_MESSAGES.tooLong, "max_length");
  }

  return result(true);
}

/**
 * Validate an internal identifier.
 */
export function validateIdentifier(
  value,
  {
    minLength = 1,
    maxLength = DEFAULTS.maxIdentifierLength,
  } = {},
) {
  minLength = validLimit(minLength, 1, {
    minimum: 1,
    maximum: 4096,
  });
  maxLength = validLimit(maxLength, DEFAULTS.maxIdentifierLength, {
    minimum: minLength,
    maximum: 4096,
  });

  if (typeof value !== "string") {
    return result(false, "Enter a valid identifier.", "invalid_type");
  }

  const identifier = value.trim();

  if (
    identifier.length < minLength ||
    identifier.length > maxLength
  ) {
    return result(
      false,
      `Identifier must be ${minLength}–${maxLength} characters.`,
      "invalid_identifier_length",
    );
  }

  if (
    !IDENTIFIER_PATTERN.test(identifier) ||
    identifier.includes("..") ||
    identifier.endsWith(".")
  ) {
    return result(
      false,
      "Identifier contains unsupported characters.",
      "invalid_identifier",
    );
  }

  return result(true);
}

/**
 * Validate a finite numeric value.
 */
export function validateNumber(
  value,
  {
    required = true,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
  } = {},
) {
  required = validBooleanOption(required, true, "required");
  integer = validBooleanOption(integer, false, "integer");

  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    Number.isNaN(min) ||
    Number.isNaN(max) ||
    min > max
  ) {
    throw new RangeError("Numeric minimum and maximum are invalid.");
  }

  if (value === "" || value === null || value === undefined) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidNumber, "invalid_type");
  }

  if (typeof value === "string" && !value.trim()) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  const number = typeof value === "number" ? value : Number(value.trim());

  if (!Number.isFinite(number)) {
    return result(false, FIELD_MESSAGES.invalidNumber, "invalid_number");
  }

  if (integer && !Number.isInteger(number)) {
    return result(false, "Enter a whole number.", "invalid_integer");
  }

  if (number < min) {
    return result(false, `Value must be at least ${min}.`, "min_value");
  }

  if (number > max) {
    return result(false, `Value must not exceed ${max}.`, "max_value");
  }

  return result(true);
}

/**
 * Validate a real calendar date in YYYY-MM-DD format.
 */
export function validateDate(value, { required = true } = {}) {
  required = validBooleanOption(required, true, "required");

  if (typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_type");
  }

  const date = value.trim();

  if (!date) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);

  if (!match) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_date");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Avoid Date.UTC's special handling of years 0 through 99.
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_date");
  }

  return result(true);
}

/**
 * Validate a URL. HTTPS is the default allowed protocol.
 *
 * This does not protect server-side URL fetching against SSRF.
 */
export function validateUrl(
  value,
  {
    allowedProtocols = ["https:"],
    allowLocalhost = false,
  } = {},
) {
  if (typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidUrl, "invalid_type");
  }

  if (
    !Array.isArray(allowedProtocols) ||
    allowedProtocols.length === 0 ||
    !allowedProtocols.every(
      (protocol) =>
        typeof protocol === "string" &&
        /^[a-z][a-z0-9+.-]*:$/iu.test(protocol),
    )
  ) {
    throw new TypeError("allowedProtocols must contain valid URL schemes.");
  }

  allowLocalhost = validBooleanOption(allowLocalhost, false, "allowLocalhost");

  const input = value.trim();

  if (!input) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (/[\u0000-\u0020\u007F]/u.test(input)) {
    return result(false, FIELD_MESSAGES.invalidUrl, "invalid_url");
  }

  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    return result(false, FIELD_MESSAGES.invalidUrl, "invalid_url");
  }

  if (!allowedProtocols.some(
    (protocol) => protocol.toLowerCase() === parsed.protocol.toLowerCase(),
  )) {
    return result(
      false,
      "This URL protocol is not permitted.",
      "invalid_url_scheme",
    );
  }

  if (parsed.username || parsed.password) {
    return result(
      false,
      "URLs containing embedded credentials are not allowed.",
      "url_credentials",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    !allowLocalhost &&
    (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    )
  ) {
    return result(false, "Localhost URLs are not allowed.", "local_hostname");
  }

  return result(true);
}

/**
 * Validate a declared MIME type against an explicit allowlist.
 */
export function validateMimeType(value, allowedTypes = []) {
  if (typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidFileType, "invalid_type");
  }

  if (!Array.isArray(allowedTypes)) {
    throw new TypeError("allowedTypes must be an array.");
  }

  const mime = value.trim().toLowerCase();

  if (!MIME_TYPE_PATTERN.test(mime)) {
    return result(false, FIELD_MESSAGES.invalidFileType, "invalid_mime_type");
  }

  const allowlist = new Set(
    allowedTypes.map((type) => {
      if (typeof type !== "string") {
        throw new TypeError("Every allowed MIME type must be a string.");
      }
      return type.trim().toLowerCase();
    }),
  );

  if (!allowlist.has(mime)) {
    return result(
      false,
      FIELD_MESSAGES.invalidFileType,
      "mime_type_not_allowed",
    );
  }

  return result(true);
}

/**
 * Validate a browser File object against size and declared MIME type.
 *
 * File.type may be empty or spoofed. Verify file contents on the server.
 */
export function validateFile(
  file,
  {
    maxBytes = DEFAULTS.maxFileBytes,
    minBytes = 1,
    allowedTypes = [],
  } = {},
) {
  maxBytes = validLimit(maxBytes, DEFAULTS.maxFileBytes, {
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
  });
  minBytes = validLimit(minBytes, 1, {
    minimum: 0,
    maximum: maxBytes,
  });

  if (
    !file ||
    typeof file !== "object" ||
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    typeof file.type !== "string"
  ) {
    return result(false, "Select a valid file.", "invalid_file");
  }

  if (file.size < minBytes || file.size > maxBytes) {
    return result(false, FIELD_MESSAGES.invalidFileSize, "invalid_file_size");
  }

  return validateMimeType(file.type, allowedTypes);
}

/**
 * Validate a value against an explicit allowlist.
 */
export function validateChoice(
  value,
  allowedValues,
  { required = true, caseSensitive = false } = {},
) {
  if (!Array.isArray(allowedValues)) {
    throw new TypeError("allowedValues must be an array.");
  }

  required = validBooleanOption(required, true, "required");
  caseSensitive = validBooleanOption(caseSensitive, false, "caseSensitive");

  const candidate = typeof value === "string" ? value.trim() : value;

  if (candidate === "" || candidate === null || candidate === undefined) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  const found = allowedValues.some((allowed) => {
    if (typeof candidate !== "string" || typeof allowed !== "string") {
      return candidate === allowed;
    }

    return caseSensitive
      ? candidate === allowed
      : candidate.toLowerCase() === allowed.toLowerCase();
  });

  return found
    ? result(true)
    : result(false, FIELD_MESSAGES.invalidChoice, "invalid_choice");
}

/**
 * Validate password policy. The server remains authoritative.
 */
export function validatePassword(
  value,
  {
    minLength = 12,
    maxLength = 128,
    requireLowercase = true,
    requireUppercase = true,
    requireDigit = true,
    requireSymbol = false,
  } = {},
) {
  minLength = validLimit(minLength, 12, { minimum: 1, maximum: 4096 });
  maxLength = validLimit(maxLength, 128, {
    minimum: minLength,
    maximum: 4096,
  });

  requireLowercase = validBooleanOption(
    requireLowercase, true, "requireLowercase",
  );
  requireUppercase = validBooleanOption(
    requireUppercase, true, "requireUppercase",
  );
  requireDigit = validBooleanOption(requireDigit, true, "requireDigit");
  requireSymbol = validBooleanOption(requireSymbol, false, "requireSymbol");

  if (typeof value !== "string") {
    return result(false, "Enter a password.", "invalid_type");
  }

  if (value.length < minLength || value.length > maxLength) {
    return result(
      false,
      `Password must be ${minLength}–${maxLength} characters long.`,
      "invalid_password_length",
    );
  }

  if (requireLowercase && !/[a-z]/u.test(value)) {
    return result(false, "Password must contain a lowercase letter.", "password_lowercase");
  }

  if (requireUppercase && !/[A-Z]/u.test(value)) {
    return result(false, "Password must contain an uppercase letter.", "password_uppercase");
  }

  if (requireDigit && !/\d/u.test(value)) {
    return result(false, "Password must contain a digit.", "password_digit");
  }

  if (requireSymbol && !/[^\p{L}\p{N}\s]/u.test(value)) {
    return result(false, "Password must contain a symbol.", "password_symbol");
  }

  return result(true);
}

const APPLICATION_FIELDS = new Set([
  "application_id", "full_name", "email", "phone", "course",
  "course_type", "qualification", "date_of_birth", "address", "city",
  "state", "country", "postal_code", "institution", "exam_name",
  "exam_score", "exam_rank", "graduation_year", "message", "consent",
]);

const JOB_FIELDS = new Set([
  "job_id", "title", "description", "employment_type", "location",
  "department", "experience_min_years", "experience_max_years",
  "salary_min", "salary_max", "currency", "skills", "qualifications",
  "application_deadline", "is_remote", "status",
]);

function validatePayloadObject(payload, allowedFields, requiredFields, allowUnknownFields, label) {
  if (!isPlainObject(payload)) {
    return result(false, `${label} must be an object.`, "invalid_payload");
  }

  if (!Array.isArray(requiredFields) ||
      !requiredFields.every((field) => typeof field === "string")) {
    throw new TypeError("requiredFields must be an array of field names.");
  }

  allowUnknownFields = validBooleanOption(
    allowUnknownFields, false, "allowUnknownFields",
  );

  for (const key of requiredFields) {
    const value = payload[key];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      return result(false, `Required field is missing: ${key}.`, "required_field");
    }
  }

  if (!allowUnknownFields) {
    for (const key of Object.keys(payload)) {
      if (!allowedFields.has(key)) {
        return result(false, `${label} contains unsupported fields.`, "unknown_fields");
      }
    }
  }

  return result(true);
}

/**
 * Validate an application payload against the client-side field allowlist.
 */
export function validateApplicationPayload(
  payload,
  {
    requiredFields = ["full_name", "email", "course"],
    allowUnknownFields = false,
  } = {},
) {
  const base = validatePayloadObject(
    payload, APPLICATION_FIELDS, requiredFields, allowUnknownFields, "Application",
  );

  if (!base.valid) return base;

  if (payload.full_name !== undefined &&
      !validateName(payload.full_name).valid) {
    return result(false, FIELD_MESSAGES.invalidName, "invalid_name");
  }

  if (payload.email !== undefined &&
      !validateEmail(payload.email).valid) {
    return result(false, FIELD_MESSAGES.invalidEmail, "invalid_email");
  }

  if (payload.phone !== undefined &&
      payload.phone !== null &&
      payload.phone !== "" &&
      !validatePhone(payload.phone).valid) {
    return result(false, FIELD_MESSAGES.invalidPhone, "invalid_phone");
  }

  if (payload.date_of_birth !== undefined &&
      payload.date_of_birth !== null &&
      payload.date_of_birth !== "" &&
      !validateDate(payload.date_of_birth).valid) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_date");
  }

  if (payload.consent !== undefined && typeof payload.consent !== "boolean") {
    return result(false, "Consent must be a boolean.", "invalid_consent");
  }

  for (const field of ["exam_score", "exam_rank", "graduation_year"]) {
    if (payload[field] !== undefined && payload[field] !== null &&
        payload[field] !== "" &&
        !validateNumber(payload[field], {
          min: 0,
          integer: field !== "exam_score",
        }).valid) {
      return result(false, `${field} is invalid.`, "invalid_numeric_field");
    }
  }

  return result(true);
}

/**
 * Validate a job payload against the client-side field allowlist.
 */
export function validateJobPayload(
  payload,
  {
    requiredFields = ["title", "description", "employment_type", "location"],
    allowUnknownFields = false,
  } = {},
) {
  const base = validatePayloadObject(
    payload, JOB_FIELDS, requiredFields, allowUnknownFields, "Job",
  );

  if (!base.valid) return base;

  for (const field of ["title", "location", "employment_type"]) {
    if (payload[field] !== undefined &&
        !validateText(payload[field], { maxLength: 300 }).valid) {
      return result(false, `${field} is invalid.`, "invalid_job_field");
    }
  }

  if (payload.description !== undefined &&
      !validateText(payload.description, { maxLength: 50_000 }).valid) {
    return result(false, "Job description is invalid.", "invalid_description");
  }

  if (payload.application_deadline !== undefined &&
      payload.application_deadline !== null &&
      payload.application_deadline !== "" &&
      !validateDate(payload.application_deadline).valid) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_application_deadline");
  }

  for (const field of ["experience_min_years", "experience_max_years"]) {
    if (payload[field] !== undefined && payload[field] !== null &&
        !validateNumber(payload[field], { min: 0, max: 80, integer: true }).valid) {
      return result(false, `${field} must be between 0 and 80.`, "invalid_experience");
    }
  }

  for (const field of ["salary_min", "salary_max"]) {
    if (payload[field] !== undefined && payload[field] !== null &&
        !validateNumber(payload[field], { min: 0 }).valid) {
      return result(false, `${field} must be non-negative.`, "invalid_salary");
    }
  }

  if (payload.is_remote !== undefined && typeof payload.is_remote !== "boolean") {
    return result(false, "is_remote must be a boolean.", "invalid_remote_flag");
  }

  for (const field of ["skills", "qualifications"]) {
    if (payload[field] !== undefined) {
      if (
        !Array.isArray(payload[field]) ||
        payload[field].length > 100 ||
        !payload[field].every(
          (item) => typeof item === "string" &&
            item.trim().length > 0 && item.length <= 200,
        )
      ) {
        return result(false, `${field} must be a list of valid strings.`, "invalid_list");
      }
    }
  }

  return result(true);
}

// ---------------------------------------------------------------------------
// Accessible form integration
// ---------------------------------------------------------------------------

function findErrorElement(form, field) {
  const name = field.name || field.id;
  if (!name) return null;

  const escape = (value) => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }
    return value.replace(/[^A-Za-z0-9_-]/gu, "\\$&");
  };

  return (
    form.querySelector(`[data-error-for="${escape(name)}"]`) ||
    form.querySelector(`#${escape(name)}-error`)
  );
}

function setFieldError(form, field, message) {
  const errorElement = findErrorElement(form, field);

  if (message) {
    field.setAttribute("aria-invalid", "true");

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;

      if (errorElement.id) {
        const ids = (field.getAttribute("aria-describedby") || "")
          .split(/\s+/u).filter(Boolean);

        if (!ids.includes(errorElement.id)) ids.push(errorElement.id);
        field.setAttribute("aria-describedby", ids.join(" "));
      }
    }
    return;
  }

  field.removeAttribute("aria-invalid");

  if (errorElement) {
    errorElement.textContent = "";
    errorElement.hidden = true;

    if (errorElement.id) {
      const remaining = (field.getAttribute("aria-describedby") || "")
        .split(/\s+/u)
        .filter((id) => id && id !== errorElement.id);

      if (remaining.length) {
        field.setAttribute("aria-describedby", remaining.join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    }
  }
}

/**
 * Validate a single form control.
 *
 * Supported data-validation values:
 * email, phone, name, url, number, date, identifier, password.
 */
export function validateField(field) {
  if (!field || typeof field !== "object") {
    return result(false, "Invalid form field.", "invalid_field");
  }

  const rule = field.dataset?.validation || "";
  const required = field.required || field.dataset?.required === "true";

  if (field.type === "checkbox") {
    return required && !field.checked
      ? result(false, "This option must be selected.", "required")
      : result(true);
  }

  if (field.type === "file") {
    const file = field.files?.[0] || null;

    if (!file) {
      return required ? result(false, FIELD_MESSAGES.required, "required") : result(true);
    }

    const allowedTypes = (field.dataset?.allowedTypes || "")
      .split(",").map((item) => item.trim()).filter(Boolean);

    const rawMax = field.dataset?.maxBytes;
    const maxBytes = rawMax ? Number(rawMax) : DEFAULTS.maxFileBytes;

    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      return result(false, "Invalid file validation configuration.", "invalid_config");
    }

    return validateFile(file, { maxBytes, allowedTypes });
  }

  const value = typeof field.value === "string" ? field.value : "";

  if (!required && !value.trim()) return result(true);

  switch (rule) {
    case "email":
      return validateEmail(value);
    case "phone":
      return validatePhone(value);
    case "name":
      return validateName(value);
    case "url":
      return validateUrl(value);
    case "number": {
      const min = field.min === "" ? Number.NEGATIVE_INFINITY : Number(field.min);
      const max = field.max === "" ? Number.POSITIVE_INFINITY : Number(field.max);

      if (Number.isNaN(min) || Number.isNaN(max)) {
        return result(false, "Invalid number validation configuration.", "invalid_config");
      }

      return validateNumber(value, {
        required,
        min,
        max,
        integer: field.step === "1",
      });
    }
    case "date":
      return validateDate(value, { required });
    case "identifier":
      return validateIdentifier(value);
    case "password":
      return validatePassword(value);
    default:
      return validateText(value, {
        required,
        minLength: field.minLength > 0 ? field.minLength : 0,
        maxLength: field.maxLength > 0 ? field.maxLength : DEFAULTS.maxTextLength,
        allowNewlines: field.tagName === "TEXTAREA",
      });
  }
}

/**
 * Validate all eligible controls in a form.
 */
export function validateForm(form, { focusFirstInvalid = true } = {}) {
  if (!form || typeof form.querySelectorAll !== "function") {
    throw new TypeError("A valid form element is required.");
  }

  focusFirstInvalid = validBooleanOption(focusFirstInvalid, true, "focusFirstInvalid");

  const fields = Array.from(
    form.querySelectorAll("input:not([type='hidden']), select, textarea"),
  ).filter((field) => !field.disabled);

  const invalidFields = [];

  for (const field of fields) {
    const validation = validateField(field);
    setFieldError(form, field, validation.message);

    if (!validation.valid) invalidFields.push(field);
  }

  const summary = form.querySelector("[data-validation-summary]");

  if (summary) {
    summary.textContent = invalidFields.length
      ? `Please correct ${invalidFields.length} field${invalidFields.length === 1 ? "" : "s"} before continuing.`
      : "";
    summary.hidden = invalidFields.length === 0;

    if (invalidFields.length) summary.setAttribute("role", "alert");
  }

  if (invalidFields.length && focusFirstInvalid) {
    invalidFields[0].focus();
  }

  return {
    valid: invalidFields.length === 0,
    invalidFields,
  };
}

/**
 * Attach event-driven validation without inline event handlers.
 *
 * This does not submit data or replace server-side validation.
 */
export function attachFormValidation(
  form,
  {
    validateOnBlur = true,
    validateOnInput = false,
    validateOnSubmit = true,
    focusFirstInvalid = true,
  } = {},
) {
  if (!form || typeof form.addEventListener !== "function") {
    throw new TypeError("A valid form element is required.");
  }

  validateOnBlur = validBooleanOption(validateOnBlur, true, "validateOnBlur");
  validateOnInput = validBooleanOption(validateOnInput, false, "validateOnInput");
  validateOnSubmit = validBooleanOption(validateOnSubmit, true, "validateOnSubmit");
  focusFirstInvalid = validBooleanOption(
    focusFirstInvalid, true, "focusFirstInvalid",
  );

  detachFormValidation(form);

  const onBlur = (event) => {
    const field = event.target;
    if (!field.matches?.("input, select, textarea")) return;

    const validation = validateField(field);
    setFieldError(form, field, validation.message);
  };

  const onInput = (event) => {
    const field = event.target;
    if (!field.matches?.("input, select, textarea")) return;

    const validation = validateField(field);
    setFieldError(form, field, validation.message);
  };

  const onSubmit = (event) => {
    if (!validateOnSubmit) return;

    const validation = validateForm(form, { focusFirstInvalid });

    if (!validation.valid) event.preventDefault();
  };

  if (validateOnBlur) form.addEventListener("focusout", onBlur);

  if (validateOnInput) {
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
  }

  form.addEventListener("submit", onSubmit);

  registeredForms.set(form, {
    onBlur,
    onInput,
    onSubmit,
    validateOnBlur,
    validateOnInput,
  });

  return () => detachFormValidation(form);
}

/**
 * Remove listeners installed by attachFormValidation().
 */
export function detachFormValidation(form) {
  if (!form || typeof form.removeEventListener !== "function") return;

  const handlers = registeredForms.get(form);
  if (!handlers) return;

  if (handlers.validateOnBlur) {
    form.removeEventListener("focusout", handlers.onBlur);
  }

  if (handlers.validateOnInput) {
    form.removeEventListener("input", handlers.onInput);
    form.removeEventListener("change", handlers.onInput);
  }

  form.removeEventListener("submit", handlers.onSubmit);
  registeredForms.delete(form);
}

/**
 * Attach validation to forms marked data-validate-form.
 *
 * Call after the DOM has been created.
 */
export function initializeFormValidation(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    throw new TypeError("A valid DOM root is required.");
  }

  const forms = [];

  if (root.matches?.("form[data-validate-form]")) forms.push(root);
  forms.push(...root.querySelectorAll("form[data-validate-form]"));

  return forms.map((form) => attachFormValidation(form));
}

export default Object.freeze({
  normalizeWhitespace,
  normalizeEmail,
  validateEmail,
  validatePhone,
  validateName,
  validateText,
  validateIdentifier,
  validateNumber,
  validateDate,
  validateUrl,
  validateMimeType,
  validateFile,
  validateChoice,
  validatePassword,
  validateApplicationPayload,
  validateJobPayload,
  validateField,
  validateForm,
  attachFormValidation,
  detachFormValidation,
  initializeFormValidation,
});
