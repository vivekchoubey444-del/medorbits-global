
/**
 * MedOrbits -- Input Validation
 * Path: /src/js/security/input-validation.js
 *
 * Features:
 * - Reusable input validators
 * - Application and job payload validation
 * - Accessible field-level validation feedback
 * - Form validation without inline event handlers
 * - Safe text normalization
 * - Configurable validation rules
 *
 * Security:
 * - Client-side validation is for usability, not authorization.
 * - Repeat all validation on the server.
 * - Never use this module as an HTML sanitizer.
 * - Never trust client-supplied field values, IDs, or MIME types.
 */

const DEFAULTS = Object.freeze({
  maxTextLength: 5000,
  maxNameLength: 150,
  maxEmailLength: 254,
  maxPhoneDigits: 15,
  minPhoneDigits: 7,
  maxIdentifierLength: 128,
});

const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const MIME_TYPE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$/;

const PHONE_PATTERN = /^[+0-9().\-\s]+$/;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

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

/**
 * Return a plain validation result.
 *
 * @param {boolean} valid
 * @param {string} [message]
 * @param {string} [code]
 * @returns {{valid: boolean, message: string, code: string}}
 */
function result(valid, message = "", code = "") {
  return Object.freeze({ valid, message, code });
}

/**
 * Safely convert supported primitive values into a string.
 * Objects are rejected rather than coerced to "[object Object]".
 */
function requireString(value, fieldName = "value") {
  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string.`);
  }

  return value;
}

/**
 * Normalize whitespace without modifying the original source value.
 */
export function normalizeWhitespace(value) {
  return requireString(value)
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Normalize an email address for application-level comparison.
 * This does not establish that a mailbox exists.
 */
export function normalizeEmail(value) {
  const email = requireString(value, "email").trim();

  if (!validateEmail(email).valid) {
    throw new TypeError("Email address is invalid.");
  }

  return email.toLowerCase();
}

/**
 * Validate an email address.
 */
export function validateEmail(
  value,
  { maxLength = DEFAULTS.maxEmailLength } = {},
) {
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
    return result(
      false,
      FIELD_MESSAGES.invalidEmail,
      "invalid_email",
    );
  }

  const [local, ...domainParts] = email.split("@");
  const domain = domainParts.join("@");

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.length > 253
  ) {
    return result(
      false,
      FIELD_MESSAGES.invalidEmail,
      "invalid_email",
    );
  }

  return result(true);
}

/**
 * Validate a phone number's basic syntax and digit count.
 *
 * This does not validate a national numbering plan. Use a specialized
 * phone-number library for strict international validation.
 */
export function validatePhone(
  value,
  {
    minDigits = DEFAULTS.minPhoneDigits,
    maxDigits = DEFAULTS.maxPhoneDigits,
    requireInternationalPrefix = false,
  } = {},
) {
  if (typeof value !== "string") {
    return result(false, "Enter a phone number.", "invalid_type");
  }

  const phone = value.trim();

  if (!phone) {
    return result(false, FIELD_MESSAGES.required, "required");
  }

  if (!PHONE_PATTERN.test(phone)) {
    return result(
      false,
      FIELD_MESSAGES.invalidPhone,
      "invalid_phone",
    );
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

  const digits = phone.replace(/\D/g, "");

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
 * Validate a human-readable name without limiting it to ASCII characters.
 */
export function validateName(
  value,
  { maxLength = DEFAULTS.maxNameLength } = {},
) {
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

  if (
    CONTROL_CHARACTER_PATTERN.test(name) ||
    !/[\p{L}]/u.test(name)
  ) {
    return result(
      false,
      FIELD_MESSAGES.invalidName,
      "invalid_name",
    );
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

  if (CONTROL_CHARACTER_PATTERN.test(text)) {
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
  if (value === "" || value === null || value === undefined) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return result(false, FIELD_MESSAGES.invalidNumber, "invalid_type");
  }

  const number =
    typeof value === "number" ? value : Number(value.trim());

  if (!Number.isFinite(number)) {
    return result(
      false,
      FIELD_MESSAGES.invalidNumber,
      "invalid_number",
    );
  }

  if (integer && !Number.isInteger(number)) {
    return result(
      false,
      "Enter a whole number.",
      "invalid_integer",
    );
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
 * Validate an ISO-style calendar date in YYYY-MM-DD format.
 */
export function validateDate(value, { required = true } = {}) {
  if (typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_type");
  }

  const date = value.trim();

  if (!date) {
    return required
      ? result(false, FIELD_MESSAGES.required, "required")
      : result(true);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_date");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

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
 * Validate a URL. HTTPS is the default allowed scheme.
 *
 * This is a browser-side format check, not protection against SSRF or
 * malicious redirect chains on a server.
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

  if (!allowedProtocols.includes(parsed.protocol)) {
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
    return result(
      false,
      "Localhost URLs are not allowed.",
      "local_hostname",
    );
  }

  return result(true);
}

/**
 * Validate a declared MIME type against an explicit allowlist.
 * The server must independently inspect the file contents.
 */
export function validateMimeType(value, allowedTypes = []) {
  if (typeof value !== "string") {
    return result(false, FIELD_MESSAGES.invalidFileType, "invalid_type");
  }

  const mime = value.trim().toLowerCase();

  if (!MIME_TYPE_PATTERN.test(mime)) {
    return result(
      false,
      FIELD_MESSAGES.invalidFileType,
      "invalid_mime_type",
    );
  }

  const allowlist = new Set(
    allowedTypes
      .filter((type) => typeof type === "string")
      .map((type) => type.trim().toLowerCase()),
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
 * Validate browser File objects against size and declared MIME type.
 */
export function validateFile(
  file,
  {
    maxBytes = 10 * 1024 * 1024,
    minBytes = 1,
    allowedTypes = [],
  } = {},
) {
  if (
    !file ||
    typeof file !== "object" ||
    typeof file.size !== "number" ||
    typeof file.type !== "string"
  ) {
    return result(false, "Select a valid file.", "invalid_file");
  }

  if (file.size < minBytes || file.size > maxBytes) {
    return result(
      false,
      `File size must be between ${minBytes} and ${maxBytes} bytes.`,
      "invalid_file_size",
    );
  }

  return validateMimeType(file.type, allowedTypes);
}

/**
 * Validate a value against a set of allowed options.
 */
export function validateChoice(
  value,
  allowedValues,
  { required = true, caseSensitive = false } = {},
) {
  if (!Array.isArray(allowedValues)) {
    throw new TypeError("allowedValues must be an array.");
  }

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
 * Validate a password using configurable length and complexity rules.
 *
 * This is only a client-side policy check. The server should enforce the
 * authoritative policy and use a suitable password-hashing algorithm.
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
    return result(
      false,
      "Password must contain a lowercase letter.",
      "password_lowercase",
    );
  }

  if (requireUppercase && !/[A-Z]/u.test(value)) {
    return result(
      false,
      "Password must contain an uppercase letter.",
      "password_uppercase",
    );
  }

  if (requireDigit && !/\d/u.test(value)) {
    return result(
      false,
      "Password must contain a digit.",
      "password_digit",
    );
  }

  if (requireSymbol && !/[^\p{L}\p{N}\s]/u.test(value)) {
    return result(
      false,
      "Password must contain a symbol.",
      "password_symbol",
    );
  }

  return result(true);
}

/**
 * Validate the basic shape of an application payload.
 *
 * Extend allowed fields to match the canonical backend schema.
 */
export function validateApplicationPayload(
  payload,
  {
    requiredFields = ["full_name", "email", "course"],
    allowUnknownFields = false,
  } = {},
) {
  const allowedFields = new Set([
    "application_id",
    "full_name",
    "email",
    "phone",
    "course",
    "course_type",
    "qualification",
    "date_of_birth",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "institution",
    "exam_name",
    "exam_score",
    "exam_rank",
    "graduation_year",
    "message",
    "consent",
  ]);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return result(false, "Application must be an object.", "invalid_payload");
  }

  for (const key of requiredFields) {
    const value = payload[key];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      return result(
        false,
        `Required field is missing: ${key}.`,
        "required_field",
      );
    }
  }

  if (!allowUnknownFields) {
    for (const key of Object.keys(payload)) {
      if (!allowedFields.has(key)) {
        return result(
          false,
          "Application contains unsupported fields.",
          "unknown_fields",
        );
      }
    }
  }

  if (
    payload.full_name !== undefined &&
    !validateName(payload.full_name).valid
  ) {
    return result(false, FIELD_MESSAGES.invalidName, "invalid_name");
  }

  if (
    payload.email !== undefined &&
    !validateEmail(payload.email).valid
  ) {
    return result(false, FIELD_MESSAGES.invalidEmail, "invalid_email");
  }

  if (
    payload.phone !== undefined &&
    payload.phone !== null &&
    payload.phone !== "" &&
    !validatePhone(payload.phone).valid
  ) {
    return result(false, FIELD_MESSAGES.invalidPhone, "invalid_phone");
  }

  if (
    payload.date_of_birth !== undefined &&
    payload.date_of_birth !== null &&
    payload.date_of_birth !== "" &&
    !validateDate(payload.date_of_birth).valid
  ) {
    return result(false, FIELD_MESSAGES.invalidDate, "invalid_date");
  }

  if (
    payload.consent !== undefined &&
    typeof payload.consent !== "boolean"
  ) {
    return result(
      false,
      "Consent must be a boolean.",
      "invalid_consent",
    );
  }

  return result(true);
}

/**
 * Validate the basic shape of a job payload.
 */
export function validateJobPayload(
  payload,
  {
    requiredFields = ["title", "description", "employment_type", "location"],
    allowUnknownFields = false,
  } = {},
) {
  const allowedFields = new Set([
    "job_id",
    "title",
    "description",
    "employment_type",
    "location",
    "department",
    "experience_min_years",
    "experience_max_years",
    "salary_min",
    "salary_max",
    "currency",
    "skills",
    "qualifications",
    "application_deadline",
    "is_remote",
    "status",
  ]);

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return result(false, "Job must be an object.", "invalid_payload");
  }

  for (const key of requiredFields) {
    const value = payload[key];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim())
    ) {
      return result(
        false,
        `Required field is missing: ${key}.`,
        "required_field",
      );
    }
  }

  if (!allowUnknownFields) {
    for (const key of Object.keys(payload)) {
      if (!allowedFields.has(key)) {
        return result(
          false,
          "Job contains unsupported fields.",
          "unknown_fields",
        );
      }
    }
  }

  if (
    payload.application_deadline !== undefined &&
    payload.application_deadline !== null &&
    payload.application_deadline !== "" &&
    !validateDate(payload.application_deadline).valid
  ) {
    return result(
      false,
      FIELD_MESSAGES.invalidDate,
      "invalid_application_deadline",
    );
  }

  for (const field of ["experience_min_years", "experience_max_years"]) {
    if (
      payload[field] !== undefined &&
      payload[field] !== null &&
      !validateNumber(payload[field], { min: 0, max: 80 }).valid
    ) {
      return result(
        false,
        `${field} must be between 0 and 80.`,
        "invalid_experience",
      );
    }
  }

  for (const field of ["salary_min", "salary_max"]) {
    if (
      payload[field] !== undefined &&
      payload[field] !== null &&
      !validateNumber(payload[field], { min: 0 }).valid
    ) {
      return result(
        false,
        `${field} must be a non-negative number.`,
        "invalid_salary",
      );
    }
  }

  if (
    payload.is_remote !== undefined &&
    typeof payload.is_remote !== "boolean"
  ) {
    return result(
      false,
      "is_remote must be a boolean.",
      "invalid_remote_flag",
    );
  }

  for (const field of ["skills", "qualifications"]) {
    if (payload[field] !== undefined) {
      if (
        !Array.isArray(payload[field]) ||
        payload[field].length > 100 ||
        !payload[field].every(
          (item) =>
            typeof item === "string" &&
            item.trim().length > 0 &&
            item.length <= 200,
        )
      ) {
        return result(
          false,
          `${field} must be a list of valid strings.`,
          "invalid_list",
        );
      }
    }
  }

  return result(true);
}

// ---------------------------------------------------------------------------
// Accessible form integration
// ---------------------------------------------------------------------------

/**
 * Find the associated error message element for a field.
 *
 * Supported conventions:
 * - data-error-for="email"
 * - id="email-error"
 */
function findErrorElement(form, field) {
  const name = field.name || field.id;

  if (!name) return null;

  const escapedName =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(name)
      : name.replace(/["\\]/gu, "\\$&");

  return (
    form.querySelector(`[data-error-for="${escapedName}"]`) ||
    form.querySelector(`#${escapedName}-error`)
  );
}

/**
 * Set accessible error feedback for one field.
 */
function setFieldError(form, field, message) {
  const errorElement = findErrorElement(form, field);

  if (message) {
    field.setAttribute("aria-invalid", "true");

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.hidden = false;

      if (errorElement.id) {
        const current = (field.getAttribute("aria-describedby") || "")
          .split(/\s+/u)
          .filter(Boolean);

        if (!current.includes(errorElement.id)) {
          current.push(errorElement.id);
        }

        field.setAttribute("aria-describedby", current.join(" "));
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
 * Return the validation result for a form control.
 *
 * Supported data-validation values:
 * required, email, phone, name, url, number, date, identifier, password
 */
export function validateField(field) {
  if (!field || typeof field !== "object") {
    return result(false, "Invalid form field.", "invalid_field");
  }

  const rule = field.dataset?.validation || "";
  const required =
    field.required ||
    field.dataset?.required === "true";

  const value =
    field.type === "checkbox"
      ? field.checked
      : field.type === "file"
        ? field.files?.[0] || null
        : typeof field.value === "string"
          ? field.value
          : "";

  if (field.type === "checkbox") {
    if (required && !value) {
      return result(false, "This option must be selected.", "required");
    }

    return result(true);
  }

  if (field.type === "file") {
    if (!value) {
      return required
        ? result(false, FIELD_MESSAGES.required, "required")
        : result(true);
    }

    const allowedTypes = (field.dataset?.allowedTypes || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const maxBytes = Number(field.dataset?.maxBytes || 10 * 1024 * 1024);

    return validateFile(value, {
      maxBytes,
      allowedTypes,
    });
  }

  if (!required && !value.trim()) {
    return result(true);
  }

  switch (rule) {
    case "email":
      return validateEmail(value);

    case "phone":
      return validatePhone(value);

    case "name":
      return validateName(value);

    case "url":
      return validateUrl(value);

    case "number":
      return validateNumber(value, {
        required,
        min: field.min === "" ? Number.NEGATIVE_INFINITY : Number(field.min),
        max: field.max === "" ? Number.POSITIVE_INFINITY : Number(field.max),
        integer: field.step === "1",
      });

    case "date":
      return validateDate(value, { required });

    case "identifier":
      return validateIdentifier(value);

    case "password":
      return validatePassword(value);

    default: {
      const maxLength =
        field.maxLength > 0
          ? field.maxLength
          : DEFAULTS.maxTextLength;

      const minLength =
        field.minLength > 0
          ? field.minLength
          : 0;

      return validateText(value, {
        required,
        minLength,
        maxLength,
        allowNewlines: field.tagName === "TEXTAREA",
      });
    }
  }
}

/**
 * Validate a form and show accessible error messages.
 *
 * @returns {{valid: boolean, invalidFields: HTMLElement[]}}
 */
export function validateForm(form, { focusFirstInvalid = true } = {}) {
  if (!form || typeof form.querySelectorAll !== "function") {
    throw new TypeError("A valid form element is required.");
  }

  const fields = Array.from(
    form.querySelectorAll(
      "input:not([type='hidden']), select, textarea",
    ),
  ).filter((field) => !field.disabled);

  const invalidFields = [];

  for (const field of fields) {
    const validation = validateField(field);
    setFieldError(form, field, validation.message);

    if (!validation.valid) {
      invalidFields.push(field);
    }
  }

  const summary = form.querySelector("[data-validation-summary]");

  if (summary) {
    if (invalidFields.length) {
      summary.textContent =
        `Please correct ${invalidFields.length} ` +
        `field${invalidFields.length === 1 ? "" : "s"} before continuing.`;
      summary.hidden = false;
      summary.setAttribute("role", "alert");
    } else {
      summary.textContent = "";
      summary.hidden = true;
    }
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
 * Attach validation behavior to a form.
 *
 * The module does not automatically submit data. The application's submit
 * handler remains responsible for authorization-aware API requests,
 * CSRF protections where applicable, and server-side error handling.
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

    if (!validation.valid) {
      event.preventDefault();
    }
  };

  if (validateOnBlur) {
    form.addEventListener("focusout", onBlur);
  }

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
 * Remove event listeners installed by attachFormValidation().
 */
export function detachFormValidation(form) {
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
 * Automatically attach validation to forms marked with:
 *
 *   data-validate-form
 *
 * Call this after the relevant DOM has been created.
 */
export function initializeFormValidation(root = document) {
  const forms = [];

  if (root.matches?.("form[data-validate-form]")) {
    forms.push(root);
  }

  forms.push(
    ...root.querySelectorAll("form[data-validate-form]"),
  );

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
