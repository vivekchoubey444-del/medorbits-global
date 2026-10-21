'use strict';

const ALLOWED_FIELDS = Object.freeze([
  'user_id',
  'first_name',
  'last_name',
  'email',
  'phone',
  'headline',
  'summary',
  'location',
  'skills',
  'experience_years',
  'education',
  'resume_document_id',
  'availability',
  'status',
]);

const ALLOWED_AVAILABILITY = Object.freeze([
  'immediate',
  'within_15_days',
  'within_30_days',
  'within_60_days',
  'not_available',
]);

const ALLOWED_STATUSES = Object.freeze([
  'draft',
  'active',
  'inactive',
]);

const ALLOWED_EDUCATION_FIELDS = Object.freeze([
  'qualification',
  'institution',
  'field_of_study',
  'year_completed',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+()\d\s.-]+$/;

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_PHONE_LENGTH = 7;
const MAX_PHONE_LENGTH = 25;
const MAX_HEADLINE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 5000;
const MAX_SKILLS = 50;
const MAX_SKILL_LENGTH = 100;
const MAX_EDUCATION_FIELD_LENGTH = 200;
const MIN_EXPERIENCE_YEARS = 0;
const MAX_EXPERIENCE_YEARS = 70;
const MIN_COMPLETION_YEAR = 1900;
const MAX_COMPLETION_YEAR = 2100;

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

function validationError(message, code = 'VALIDATION_ERROR') {
  const error = new Error(message);

  error.status = 400;
  error.code = code;
  error.publicMessage = message;

  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, message, code = 'INVALID_BODY') {
  if (!isPlainObject(value)) {
    throw validationError(message, code);
  }
}

function pickAllowed(input = {}) {
  assertPlainObject(input, 'Request body must be a JSON object.');

  const unknownFields = Object.keys(input).filter(
    (key) => !ALLOWED_FIELDS.includes(key)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported field(s): ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELDS'
    );
  }

  const output = {};

  for (const key of ALLOWED_FIELDS) {
    if (hasOwn(input, key)) {
      output[key] = input[key];
    }
  }

  return output;
}

function validateStringField(data, field, options = {}) {
  const {
    minLength = 0,
    maxLength,
    required = false,
    normalize = (value) => value.trim(),
    message,
  } = options;

  if (data[field] === undefined) {
    if (required) {
      throw validationError(`${field} is required.`);
    }

    return;
  }

  if (typeof data[field] !== 'string') {
    throw validationError(message || `${field} must be a string.`);
  }

  const value = normalize(data[field]);

  if (value.length < minLength || value.length > maxLength) {
    throw validationError(
      message ||
        `${field} must contain between ${minLength} and ${maxLength} characters.`
    );
  }

  data[field] = value;
}

function validateEducation(education) {
  assertPlainObject(
    education,
    'education must be a JSON object.'
  );

  const unknownFields = Object.keys(education).filter(
    (key) => !ALLOWED_EDUCATION_FIELDS.includes(key)
  );

  if (unknownFields.length > 0) {
    throw validationError(
      `Unsupported education field(s): ${unknownFields.join(', ')}.`
    );
  }

  const output = {};

  for (const [key, value] of Object.entries(education)) {
    if (key === 'year_completed') {
      if (
        !Number.isSafeInteger(value) ||
        value < MIN_COMPLETION_YEAR ||
        value > MAX_COMPLETION_YEAR
      ) {
        throw validationError(
          `education.${key} must be an integer between ${MIN_COMPLETION_YEAR} and ${MAX_COMPLETION_YEAR}.`
        );
      }

      output[key] = value;
      continue;
    }

    if (typeof value !== 'string') {
      throw validationError(
        `education.${key} must be a string.`
      );
    }

    const normalized = value.trim();

    if (normalized.length > MAX_EDUCATION_FIELD_LENGTH) {
      throw validationError(
        `education.${key} must not exceed ${MAX_EDUCATION_FIELD_LENGTH} characters.`
      );
    }

    output[key] = normalized;
  }

  return output;
}

function validate(input = {}, options = {}) {
  const { partial = false } = options;
  const data = pickAllowed(input);

  if (Object.keys(data).length === 0) {
    throw validationError(
      'At least one supported field must be provided.'
    );
  }

  /*
   * SECURITY:
   * Ordinary users must not be allowed to choose their own user_id.
   * Controllers should derive identity from authenticated server-side
   * context. Any privileged workflow that accepts user_id must enforce
   * authorization independently.
   *
   * This validator only validates the identifier's format; it does not
   * establish permission to create or modify another user's profile.
   */
  if (data.user_id !== undefined) {
    if (
      !Number.isSafeInteger(data.user_id) ||
      data.user_id < 1
    ) {
      throw validationError(
        'user_id must be a positive integer.'
      );
    }
  }

  for (const field of ['first_name', 'last_name']) {
    validateStringField(data, field, {
      minLength: 1,
      maxLength: MAX_NAME_LENGTH,
    });
  }

  if (data.email !== undefined) {
    validateStringField(data, 'email', {
      minLength: 1,
      maxLength: MAX_EMAIL_LENGTH,
      normalize: (value) => value.trim().toLowerCase(),
      message: 'A valid email address is required.',
    });

    if (!EMAIL_REGEX.test(data.email)) {
      throw validationError(
        'A valid email address is required.'
      );
    }
  }

  if (data.phone !== undefined) {
    if (typeof data.phone !== 'string') {
      throw validationError('phone must be a string.');
    }

    data.phone = data.phone.trim();

    if (
      data.phone.length < MIN_PHONE_LENGTH ||
      data.phone.length > MAX_PHONE_LENGTH ||
      !PHONE_REGEX.test(data.phone)
    ) {
      throw validationError(
        'A valid phone number is required.'
      );
    }
  }

  for (const field of ['headline', 'location']) {
    validateStringField(data, field, {
      maxLength: MAX_HEADLINE_LENGTH,
    });
  }

  if (data.summary !== undefined) {
    validateStringField(data, 'summary', {
      maxLength: MAX_SUMMARY_LENGTH,
    });
  }

  if (data.skills !== undefined) {
    if (
      !Array.isArray(data.skills) ||
      data.skills.length > MAX_SKILLS
    ) {
      throw validationError(
        `skills must be an array containing at most ${MAX_SKILLS} entries.`
      );
    }

    const skills = data.skills.map((skill) => {
      if (typeof skill !== 'string') {
        throw validationError(
          'Each skill must be a string.'
        );
      }

      const normalized = skill.trim();

      if (
        normalized.length < 1 ||
        normalized.length > MAX_SKILL_LENGTH
      ) {
        throw validationError(
          `Each skill must contain between 1 and ${MAX_SKILL_LENGTH} characters.`
        );
      }

      return normalized;
    });

    const normalizedSkills = skills.map((skill) =>
      skill.toLocaleLowerCase('en')
    );

    if (new Set(normalizedSkills).size !== skills.length) {
      throw validationError(
        'skills must not contain duplicates.'
      );
    }

    data.skills = skills;
  }

  if (data.experience_years !== undefined) {
    if (
      typeof data.experience_years !== 'number' ||
      !Number.isFinite(data.experience_years) ||
      data.experience_years < MIN_EXPERIENCE_YEARS ||
      data.experience_years > MAX_EXPERIENCE_YEARS
    ) {
      throw validationError(
        `experience_years must be a number between ${MIN_EXPERIENCE_YEARS} and ${MAX_EXPERIENCE_YEARS}.`
      );
    }
  }

  if (data.education !== undefined) {
    data.education = validateEducation(data.education);
  }

  if (data.resume_document_id !== undefined) {
    if (
      !Number.isSafeInteger(data.resume_document_id) ||
      data.resume_document_id < 1
    ) {
      throw validationError(
        'resume_document_id must be a positive integer.'
      );
    }
  }

  if (data.availability !== undefined) {
    if (typeof data.availability !== 'string') {
      throw validationError(
        `availability must be one of: ${ALLOWED_AVAILABILITY.join(', ')}.`
      );
    }

    data.availability = data.availability.trim().toLowerCase();

    if (!ALLOWED_AVAILABILITY.includes(data.availability)) {
      throw validationError(
        `availability must be one of: ${ALLOWED_AVAILABILITY.join(', ')}.`
      );
    }
  }

  if (data.status !== undefined) {
    if (typeof data.status !== 'string') {
      throw validationError(
        `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`
      );
    }

    data.status = data.status.trim().toLowerCase();

    if (!ALLOWED_STATUSES.includes(data.status)) {
      throw validationError(
        `status must be one of: ${ALLOWED_STATUSES.join(', ')}.`
      );
    }
  }

  if (!partial) {
    for (const field of ['first_name', 'last_name', 'email']) {
      if (
        data[field] === undefined ||
        data[field] === ''
      ) {
        throw validationError(`${field} is required.`);
      }
    }
  }

  return data;
}

function validateCreate(input) {
  return validate(input);
}

function validateUpdate(input) {
  return validate(input, { partial: true });
}

module.exports = {
  ALLOWED_FIELDS,
  ALLOWED_AVAILABILITY,
  ALLOWED_STATUSES,
  ALLOWED_EDUCATION_FIELDS,
  pickAllowed,
  validate,
  validateCreate,
  validateUpdate,
};