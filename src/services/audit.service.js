'use strict';

const {
  ServiceError,
  requireDependency,
  requiredString,
  plainObject,
} = require('./service-utils');

const REDACT = /password|passphrase|token|secret|authorization|cookie|paymentMethod|cardNumber|cvv|cvc|documentContent|documentData|privateKey|apiKey|accessKey|refreshToken|sessionToken|credential|otp|recoveryCode|bankAccount|accountNumber|securityCode|clientSecret|webhookSecret|signature/i;

const MAX_DEPTH = 5;
const MAX_ITEMS = 50;
const MAX_STRING_LENGTH = 500;
const MAX_KEY_LENGTH = 100;
const MAX_METADATA_BYTES = 16_384;
const MAX_ACTION_LENGTH = 160;
const MAX_ENTITY_LENGTH = 100;
const MAX_ID_LENGTH = 128;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_IP_LENGTH = 64;
const MAX_CURSOR_LENGTH = 512;
const MAX_LIMIT = 100;

function redact(value, depth = 0, seen = new WeakSet()) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.slice(0, MAX_STRING_LENGTH);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (seen.has(value)) {
    return '[CIRCULAR_REFERENCE]';
  }

  seen.add(value);

  let output;

  if (Array.isArray(value)) {
    output = value
      .slice(0, MAX_ITEMS)
      .map((item) => redact(item, depth + 1, seen))
      .map((item) =>
        item === undefined ? null : item
      );
  } else {
    output = Object.create(null);

    for (
      const [key, item] of Object.entries(value).slice(0, MAX_ITEMS)
    ) {
      if (REDACT.test(key)) {
        continue;
      }

      const safeKey = key.slice(0, MAX_KEY_LENGTH);
      const safeValue = redact(item, depth + 1, seen);

      if (safeValue !== undefined) {
        output[safeKey] = safeValue;
      }
    }
  }

  seen.delete(value);
  return output;
}

function normalizeOptionalId(value, field, max = MAX_ID_LENGTH) {
  if (value == null || value === '') {
    return null;
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    throw new ServiceError(
      `${field} must be a string or number.`,
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  return requiredString(String(value), field, { max });
}

function normalizeDate(value, field) {
  if (value == null || value === '') {
    return undefined;
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    !(value instanceof Date)
  ) {
    throw new ServiceError(
      `${field} must be a valid date.`,
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ServiceError(
      `${field} must be a valid date.`,
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  return date;
}

function normalizeLimit(value, fallback = 50) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed =
    typeof value === 'number' ||
    typeof value === 'string'
      ? Number(value)
      : NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ServiceError(
      'limit must be a positive integer.',
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  return Math.min(parsed, MAX_LIMIT);
}

function validateIpAddress(value) {
  if (value == null || value === '') {
    return null;
  }

  const ipAddress = requiredString(
    String(value),
    'ipAddress',
    { max: MAX_IP_LENGTH }
  );

  // Reject control characters and whitespace. Full IP address
  // validation should use a trusted IP parsing utility.
  if (/[\s\u0000-\u001f\u007f]/.test(ipAddress)) {
    throw new ServiceError(
      'ipAddress has an invalid format.',
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  return ipAddress;
}

function serializeMetadata(metadata) {
  let serialized;

  try {
    serialized = JSON.stringify(metadata);
  } catch {
    throw new ServiceError(
      'Audit metadata could not be serialized.',
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  if (typeof serialized !== 'string') {
    throw new ServiceError(
      'Audit metadata must be serializable.',
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  if (
    Buffer.byteLength(serialized, 'utf8') >
    MAX_METADATA_BYTES
  ) {
    throw new ServiceError(
      'Audit metadata exceeds the allowed size.',
      {
        code: 'VALIDATION_ERROR',
        status: 422,
      }
    );
  }

  return metadata;
}

function createAuditService({
  auditRepository,
  clock = () => new Date(),
}) {
  requireDependency(auditRepository, 'auditRepository');

  if (typeof auditRepository.create !== 'function') {
    throw new TypeError(
      'auditRepository must implement create().'
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  return {
    async record(event) {
      const input = plainObject(event, 'event');

      const action = requiredString(
        input.action,
        'action',
        {
          min: 1,
          max: MAX_ACTION_LENGTH,
        }
      );

      const entity =
        input.entity == null
          ? null
          : requiredString(
              String(input.entity),
              'entity',
              {
                min: 1,
                max: MAX_ENTITY_LENGTH,
              }
            );

      const entityId = normalizeOptionalId(
        input.entityId,
        'entityId'
      );

      const actorId = normalizeOptionalId(
        input.actorId,
        'actorId'
      );

      const requestId = normalizeOptionalId(
        input.requestId,
        'requestId',
        MAX_REQUEST_ID_LENGTH
      );

      const ipAddress = validateIpAddress(input.ipAddress);

      const metadataInput =
        input.metadata == null
          ? {}
          : plainObject(input.metadata, 'metadata');

      const metadata = serializeMetadata(
        redact(metadataInput)
      );

      const createdAt = clock();

      if (
        !(createdAt instanceof Date) ||
        Number.isNaN(createdAt.getTime())
      ) {
        throw new TypeError(
          'Audit clock must return a valid Date.'
        );
      }

      const entry = {
        action,
        entity,
        entityId,
        actorId,
        requestId,
        ipAddress,
        metadata,
        createdAt: new Date(createdAt.getTime()),
      };

      // The repository should enforce append-only behavior and
      // appropriate access controls for audit records.
      return auditRepository.create(entry);
    },

    async log(event) {
      return this.record(event);
    },

    async write(event) {
      return this.record(event);
    },

    async list(query = {}) {
      const input = plainObject(query, 'query');

      if (typeof auditRepository.list !== 'function') {
        throw new TypeError(
          'auditRepository must implement list().'
        );
      }

      const limit = normalizeLimit(input.limit, 50);
      const from = normalizeDate(input.from, 'from');
      const to = normalizeDate(input.to, 'to');

      if (from && to && from > to) {
        throw new ServiceError(
          'from must be earlier than or equal to to.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
          }
        );
      }

      const cursor =
        input.cursor == null
          ? undefined
          : requiredString(
              input.cursor,
              'cursor',
              {
                min: 1,
                max: MAX_CURSOR_LENGTH,
              }
            );

      const filters = { limit };

      if (cursor !== undefined) {
        filters.cursor = cursor;
      }

      if (input.actorId != null && input.actorId !== '') {
        filters.actorId = normalizeOptionalId(
          input.actorId,
          'actorId'
        );
      }

      if (input.entity != null && input.entity !== '') {
        filters.entity = requiredString(
          input.entity,
          'entity',
          {
            min: 1,
            max: MAX_ENTITY_LENGTH,
          }
        );
      }

      if (input.action != null && input.action !== '') {
        filters.action = requiredString(
          input.action,
          'action',
          {
            min: 1,
            max: MAX_ACTION_LENGTH,
          }
        );
      }

      if (from) {
        filters.from = from;
      }

      if (to) {
        filters.to = to;
      }

      // Authorization for audit-log access must be enforced by
      // the calling service/controller or an explicit policy layer.
      return auditRepository.list(filters);
    },
  };
}

module.exports = {
  createAuditService,
  redact,
  normalizeDate,
  normalizeLimit,
};