
'use strict';

/**
 * MedOrbits -- Audit Service
 * File: api/services/audit-service.js
 *
 * Runtime: Node.js >= 20
 * Database: PostgreSQL
 *
 * Features:
 * - Record security, application, and administrative audit events.
 * - Support PostgreSQL pools and caller-supplied transaction clients.
 * - Redact sensitive metadata recursively.
 * - Validate audit fields, filters, dates, and pagination.
 * - Restrict audit-history queries to privileged roles.
 * - Provide an append-only application-level interface.
 * - Return sanitized database errors.
 *
 * Security notes:
 * - Application-level append-only behavior is not sufficient to
 *   guarantee immutability. Enforce it using database permissions
 *   and, where appropriate, database triggers.
 * - Derive actor identity and authorization roles from trusted
 *   server-side authentication, never directly from request bodies.
 * - Record audit events in the same transaction as the business
 *   operation when atomicity is required.
 */

const crypto = require('node:crypto');
const net = require('node:net');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_PAGE = 1_000_000;

const MAX_METADATA_BYTES = 16 * 1024;
const MAX_STRING_LENGTH = 2_000;
const MAX_METADATA_DEPTH = 8;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 200;
const MAX_USER_AGENT_LENGTH = 512;

const AUDIT_OUTCOMES = Object.freeze([
  'success',
  'failure',
  'denied',
  'error',
]);

const DEFAULT_PRIVILEGED_ROLES = Object.freeze([
  'admin',
  'super_admin',
  'auditor',
]);

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|authorization|cookie|session|api.?key|private.?key|credential|refresh.?token|access.?token|client.?secret|jwt|ssn|social.?security|credit.?card|card.?number|cvv|cvc|bank.?account/i;

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const ALLOWED_EVENT_FIELDS = new Set([
  'actorId',
  'action',
  'resourceType',
  'resourceId',
  'outcome',
  'requestId',
  'ipAddress',
  'userAgent',
  'metadata',
]);

const ALLOWED_RECORD_OPTIONS = new Set([
  'dbClient',
]);

const ALLOWED_FILTERS = new Set([
  'actorId',
  'action',
  'resourceType',
  'resourceId',
  'outcome',
  'requestId',
  'from',
  'to',
  'page',
  'limit',
]);

const ALLOWED_HISTORY_OPTIONS = new Set([
  'page',
  'limit',
  'from',
  'to',
  'outcome',
  'action',
  'actorId',
  'requestId',
]);

class AuditServiceError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'AUDIT_SERVICE_ERROR'
  ) {
    super(message);

    this.name = 'AuditServiceError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.isOperational = statusCode < 500;

    Error.captureStackTrace?.(this, AuditServiceError);
  }
}

function badRequest(
  message,
  code = 'INVALID_AUDIT_REQUEST'
) {
  return new AuditServiceError(message, 400, code);
}

function unauthorized() {
  return new AuditServiceError(
    'Authentication is required.',
    401,
    'UNAUTHENTICATED'
  );
}

function forbidden() {
  return new AuditServiceError(
    'You are not authorized to access audit records.',
    403,
    'FORBIDDEN'
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function assertKnownFields(object, allowedFields, label) {
  const unknown = Object.keys(object).filter(
    (key) => !allowedFields.has(key)
  );

  if (unknown.length > 0) {
    throw badRequest(
      `Unsupported ${label} fields: ${unknown.join(', ')}.`
    );
  }
}

function normalizeString(
  value,
  field,
  {
    required = false,
    maxLength = 255,
    allowEmpty = false,
  } = {}
) {
  if (value === undefined || value === null) {
    if (required) {
      throw badRequest(`${field} is required.`);
    }

    return null;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${field} must be a string.`);
  }

  const normalized = value.trim();

  if (required && normalized.length === 0) {
    throw badRequest(`${field} is required.`);
  }

  if (!allowEmpty && normalized.length === 0) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw badRequest(
      `${field} must not exceed ${maxLength} characters.`
    );
  }

  if (/[\u0000]/.test(normalized)) {
    throw badRequest(`${field} contains an invalid character.`);
  }

  return normalized;
}

function normalizePage(value, fallback, maximum) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  if (
    typeof value === 'string' &&
    !/^\d+$/.test(value.trim())
  ) {
    throw badRequest(
      'Pagination values must be positive integers.'
    );
  }

  if (
    typeof value !== 'number' &&
    typeof value !== 'string'
  ) {
    throw badRequest(
      'Pagination values must be positive integers.'
    );
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(
      'Pagination values must be positive integers.'
    );
  }

  if (parsed > maximum) {
    throw badRequest(
      `Pagination values must not exceed ${maximum}.`
    );
  }

  return parsed;
}

function normalizeDate(value, field) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  let date;

  if (value instanceof Date) {
    date = new Date(value.getTime());
  } else if (typeof value === 'string') {
    if (
      value.length > 100 ||
      value.trim().length === 0
    ) {
      throw badRequest(`${field} must be a valid date.`);
    }

    date = new Date(value);
  } else {
    throw badRequest(`${field} must be a valid date.`);
  }

  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date.`);
  }

  return date;
}

function normalizeOutcome(value, defaultValue = 'success') {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return defaultValue;
  }

  if (
    typeof value !== 'string' ||
    !AUDIT_OUTCOMES.includes(value)
  ) {
    throw badRequest('The audit outcome is invalid.');
  }

  return value;
}

function normalizeActorId(actorId) {
  if (
    actorId === undefined ||
    actorId === null ||
    actorId === ''
  ) {
    return null;
  }

  if (
    typeof actorId !== 'string' &&
    typeof actorId !== 'number'
  ) {
    throw badRequest('actorId is invalid.');
  }

  if (
    typeof actorId === 'number' &&
    !Number.isSafeInteger(actorId)
  ) {
    throw badRequest('actorId is invalid.');
  }

  return normalizeString(String(actorId), 'actorId', {
    required: true,
    maxLength: 128,
  });
}

function normalizeResourceId(resourceId) {
  if (
    resourceId === undefined ||
    resourceId === null
  ) {
    return null;
  }

  if (
    typeof resourceId !== 'string' &&
    typeof resourceId !== 'number'
  ) {
    throw badRequest('resourceId is invalid.');
  }

  if (
    typeof resourceId === 'number' &&
    !Number.isSafeInteger(resourceId)
  ) {
    throw badRequest('resourceId is invalid.');
  }

  return normalizeString(String(resourceId), 'resourceId', {
    required: true,
    maxLength: 128,
  });
}

function normalizeRequestId(requestId) {
  if (
    requestId === undefined ||
    requestId === null
  ) {
    return null;
  }

  const normalized = normalizeString(
    requestId,
    'requestId',
    { maxLength: 128 }
  );

  if (
    normalized &&
    !/^[A-Za-z0-9._:-]+$/.test(normalized)
  ) {
    throw badRequest('requestId has an invalid format.');
  }

  return normalized;
}

function normalizeIpAddress(ipAddress) {
  if (
    ipAddress === undefined ||
    ipAddress === null ||
    ipAddress === ''
  ) {
    return null;
  }

  const value = normalizeString(
    ipAddress,
    'ipAddress',
    { maxLength: 64 }
  );

  if (!value) {
    return null;
  }

  // Reject malformed addresses and IPv6 zone identifiers.
  if (value.includes('%') || net.isIP(value) === 0) {
    throw badRequest('ipAddress has an invalid format.');
  }

  return value;
}

function normalizeUserAgent(userAgent) {
  return normalizeString(
    userAgent,
    'userAgent',
    { maxLength: MAX_USER_AGENT_LENGTH }
  );
}

function normalizePrivilegedRoles(roles) {
  if (!Array.isArray(roles)) {
    throw new TypeError(
      'privilegedRoles must be an array.'
    );
  }

  const normalized = roles.map((role) => {
    if (
      typeof role !== 'string' ||
      role.trim().length === 0
    ) {
      throw new TypeError(
        'Every privileged role must be a non-empty string.'
      );
    }

    return role.trim().toLowerCase();
  });

  return Object.freeze([...new Set(normalized)]);
}

function normalizeAuthenticatedActor(actorInput) {
  if (
    !actorInput ||
    typeof actorInput !== 'object' ||
    Array.isArray(actorInput)
  ) {
    throw unauthorized();
  }

  const actorId =
    actorInput.id ??
    actorInput.userId ??
    actorInput.sub;

  if (
    actorId === undefined ||
    actorId === null ||
    (
      typeof actorId === 'string' &&
      actorId.trim() === ''
    )
  ) {
    throw unauthorized();
  }

  const role =
    typeof actorInput.role === 'string'
      ? actorInput.role.trim().toLowerCase()
      : '';

  if (!role) {
    throw forbidden();
  }

  return {
    id: normalizeActorId(actorId),
    role,
  };
}

/**
 * Recursively redact sensitive fields.
 *
 * Circular references, unsupported values, accessors, and excessive
 * nesting are handled defensively. The function does not mutate input.
 */
function sanitizeMetadataValue(
  value,
  depth = 0,
  ancestors = new WeakSet()
) {
  if (depth > MAX_METADATA_DEPTH) {
    return '[MAX_DEPTH_REACHED]';
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
      : value;
  }

  if (typeof value !== 'object') {
    return '[UNSUPPORTED_VALUE]';
  }

  if (ancestors.has(value)) {
    return '[CIRCULAR_REFERENCE]';
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const output = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) =>
          sanitizeMetadataValue(item, depth + 1, ancestors)
        );

      if (value.length > MAX_ARRAY_ITEMS) {
        output.push('[ARRAY_ITEMS_TRUNCATED]');
      }

      return output;
    }

    if (!isPlainObject(value)) {
      return '[UNSUPPORTED_VALUE]';
    }

    const output = Object.create(null);
    const keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS);

    for (const key of keys) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        continue;
      }

      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = '[REDACTED]';
        continue;
      }

      // Avoid invoking arbitrary getters while sanitizing metadata.
      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        output[key] = '[UNSUPPORTED_VALUE]';
        continue;
      }

      output[key] = sanitizeMetadataValue(
        descriptor.value,
        depth + 1,
        ancestors
      );
    }

    if (Object.keys(value).length > MAX_OBJECT_KEYS) {
      output._truncated = '[OBJECT_KEYS_TRUNCATED]';
    }

    return output;
  } finally {
    ancestors.delete(value);
  }
}

function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }

  if (!isPlainObject(metadata)) {
    throw badRequest('Audit metadata must be an object.');
  }

  let sanitized;
  let serialized;

  try {
    sanitized = sanitizeMetadataValue(metadata);
    serialized = JSON.stringify(sanitized);
  } catch {
    throw badRequest('Audit metadata could not be processed.');
  }

  if (typeof serialized !== 'string') {
    throw badRequest('Audit metadata could not be serialized.');
  }

  if (
    Buffer.byteLength(serialized, 'utf8') >
    MAX_METADATA_BYTES
  ) {
    throw badRequest(
      `Audit metadata must not exceed ${MAX_METADATA_BYTES} bytes.`
    );
  }

  return sanitized;
}

function mapDatabaseError(error) {
  if (error instanceof AuditServiceError) {
    return error;
  }

  switch (error?.code) {
    case '23505':
      return new AuditServiceError(
        'The audit event conflicts with an existing record.',
        409,
        'AUDIT_EVENT_CONFLICT'
      );

    case '23503':
    case '23502':
    case '23514':
    case '22P02':
    case '22001':
      return new AuditServiceError(
        'The audit event contains data that the database rejected.',
        400,
        'AUDIT_DATA_REJECTED'
      );

    case '40001':
    case '40P01':
      return new AuditServiceError(
        'The audit operation conflicted with another database operation.',
        409,
        'AUDIT_TRANSACTION_CONFLICT'
      );

    case '42501':
      return new AuditServiceError(
        'The database role is not permitted to perform this audit operation.',
        500,
        'AUDIT_DATABASE_PERMISSION_ERROR'
      );

    default:
      return new AuditServiceError(
        'The audit service could not complete the request.',
        500,
        'AUDIT_DATABASE_FAILURE'
      );
  }
}

/**
 * Create the audit service.
 *
 * Expected table columns:
 * id BIGSERIAL PRIMARY KEY
 * event_id UUID NOT NULL UNIQUE
 * actor_id TEXT
 * action TEXT NOT NULL
 * resource_type TEXT
 * resource_id TEXT
 * outcome TEXT NOT NULL
 * request_id TEXT
 * ip_address INET
 * user_agent TEXT
 * metadata JSONB NOT NULL DEFAULT '{}'::jsonb
 * created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *
 * Ensure indexes exist for created_at, actor_id, action, and
 * (resource_type, resource_id) to support audit-history queries.
 */
function createAuditService({
  db,
  privilegedRoles = [...DEFAULT_PRIVILEGED_ROLES],
} = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError(
      'createAuditService requires a pg-compatible database pool or client.'
    );
  }

  const authorizedRoles = normalizePrivilegedRoles(privilegedRoles);

  async function execute(target, sql, values = []) {
    const connection = target || db;

    if (!connection || typeof connection.query !== 'function') {
      throw new TypeError('Invalid audit database connection.');
    }

    try {
      return await connection.query(sql, values);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  function assertAuditReader(actorInput) {
    const actor = normalizeAuthenticatedActor(actorInput);

    if (!authorizedRoles.includes(actor.role)) {
      throw forbidden();
    }

    return actor;
  }

  async function record(event, options = {}) {
    if (!isPlainObject(event)) {
      throw badRequest('Audit event must be an object.');
    }

    if (!isPlainObject(options)) {
      throw badRequest('Audit options must be an object.');
    }

    assertKnownFields(event, ALLOWED_EVENT_FIELDS, 'audit event');
    assertKnownFields(options, ALLOWED_RECORD_OPTIONS, 'audit options');

    if (
      options.dbClient !== undefined &&
      (
        !options.dbClient ||
        typeof options.dbClient.query !== 'function'
      )
    ) {
      throw badRequest(
        'dbClient must be a valid PostgreSQL client.'
      );
    }

    const action = normalizeString(event.action, 'action', {
      required: true,
      maxLength: 150,
    });

    const actorId = normalizeActorId(event.actorId);

    const resourceType = normalizeString(
      event.resourceType,
      'resourceType',
      { maxLength: 100 }
    );

    const resourceId = normalizeResourceId(event.resourceId);
    const outcome = normalizeOutcome(event.outcome);
    const requestId = normalizeRequestId(event.requestId);
    const ipAddress = normalizeIpAddress(event.ipAddress);
    const userAgent = normalizeUserAgent(event.userAgent);
    const metadata = normalizeMetadata(event.metadata);

    const eventId = crypto.randomUUID();

    const result = await execute(
      options.dbClient,
      `
        INSERT INTO audit_logs (
          event_id,
          actor_id,
          action,
          resource_type,
          resource_id,
          outcome,
          request_id,
          ip_address,
          user_agent,
          metadata,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10::jsonb, NOW()
        )
        RETURNING
          id,
          event_id,
          actor_id,
          action,
          resource_type,
          resource_id,
          outcome,
          request_id,
          ip_address,
          user_agent,
          metadata,
          created_at
      `,
      [
        eventId,
        actorId,
        action,
        resourceType,
        resourceId,
        outcome,
        requestId,
        ipAddress,
        userAgent,
        JSON.stringify(metadata),
      ]
    );

    if (!result.rows || result.rows.length !== 1) {
      throw new AuditServiceError(
        'The audit event could not be confirmed.',
        500,
        'AUDIT_INSERT_FAILED'
      );
    }

    return result.rows[0];
  }

  function recordWithOutcome(outcome) {
    return async function recordOutcome(event, options = {}) {
      if (!isPlainObject(event)) {
        throw badRequest('Audit event must be an object.');
      }

      // Explicit outcome helpers must not silently override a caller's
      // conflicting outcome; this prevents ambiguous event intent.
      if (
        event.outcome !== undefined &&
        event.outcome !== outcome
      ) {
        throw badRequest(
          `This method only records the "${outcome}" outcome.`
        );
      }

      return record({ ...event, outcome }, options);
    };
  }

  const recordSuccess = recordWithOutcome('success');
  const recordFailure = recordWithOutcome('failure');
  const recordDenied = recordWithOutcome('denied');
  const recordError = recordWithOutcome('error');

  async function list(filters = {}, actorInput) {
    assertAuditReader(actorInput);

    if (!isPlainObject(filters)) {
      throw badRequest('Audit filters must be an object.');
    }

    assertKnownFields(filters, ALLOWED_FILTERS, 'audit filter');

    const page = normalizePage(
      filters.page,
      DEFAULT_PAGE,
      MAX_PAGE
    );

    const limit = normalizePage(
      filters.limit,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const conditions = [];
    const values = [];

    function addCondition(sql, value) {
      values.push(value);
      conditions.push(`${sql} $${values.length}`);
    }

    if (filters.actorId !== undefined) {
      const value = normalizeActorId(filters.actorId);

      if (value === null) {
        throw badRequest('actorId cannot be empty.');
      }

      addCondition('actor_id =', value);
    }

    if (filters.action !== undefined) {
      addCondition(
        'action =',
        normalizeString(filters.action, 'action', {
          required: true,
          maxLength: 150,
        })
      );
    }

    if (filters.resourceType !== undefined) {
      addCondition(
        'resource_type =',
        normalizeString(filters.resourceType, 'resourceType', {
          required: true,
          maxLength: 100,
        })
      );
    }

    if (filters.resourceId !== undefined) {
      const value = normalizeResourceId(filters.resourceId);

      if (value === null) {
        throw badRequest('resourceId cannot be empty.');
      }

      addCondition('resource_id =', value);
    }

    if (filters.outcome !== undefined) {
      addCondition(
        'outcome =',
        normalizeOutcome(filters.outcome, null)
      );
    }

    if (filters.requestId !== undefined) {
      const value = normalizeRequestId(filters.requestId);

      if (value === null) {
        throw badRequest('requestId cannot be empty.');
      }

      addCondition('request_id =', value);
    }

    const from = normalizeDate(filters.from, 'from');
    const to = normalizeDate(filters.to, 'to');

    if (from && to && from > to) {
      throw badRequest(
        '"from" must be earlier than or equal to "to".'
      );
    }

    if (from) {
      addCondition('created_at >=', from);
    }

    if (to) {
      addCondition('created_at <=', to);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const countResult = await execute(
      null,
      `
        SELECT COUNT(*)::text AS total
        FROM audit_logs
        ${whereClause}
      `,
      values
    );

    const totalText = countResult.rows?.[0]?.total ?? '0';
    const total = Number(totalText);

    if (!Number.isSafeInteger(total) || total < 0) {
      throw new AuditServiceError(
        'Audit pagination could not be calculated.',
        500,
        'AUDIT_COUNT_OVERFLOW'
      );
    }

    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      throw badRequest('Pagination offset is too large.');
    }

    const dataValues = [...values, limit, offset];
    const limitPlaceholder = `$${values.length + 1}`;
    const offsetPlaceholder = `$${values.length + 2}`;

    const result = await execute(
      null,
      `
        SELECT
          id,
          event_id,
          actor_id,
          action,
          resource_type,
          resource_id,
          outcome,
          request_id,
          ip_address,
          user_agent,
          metadata,
          created_at
        FROM audit_logs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      dataValues
    );

    return {
      items: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1 && offset > 0,
      },
    };
  }

  async function getResourceHistory(
    resourceType,
    resourceId,
    actorInput,
    options = {}
  ) {
    const type = normalizeString(resourceType, 'resourceType', {
      required: true,
      maxLength: 100,
    });

    const id = normalizeResourceId(resourceId);

    if (id === null) {
      throw badRequest('resourceId is required.');
    }

    if (!isPlainObject(options)) {
      throw badRequest(
        'Resource history options must be an object.'
      );
    }

    assertKnownFields(
      options,
      ALLOWED_HISTORY_OPTIONS,
      'resource history option'
    );

    return list(
      {
        ...options,
        resourceType: type,
        resourceId: id,
      },
      actorInput
    );
  }

  return Object.freeze({
    record,
    recordSuccess,
    recordFailure,
    recordDenied,
    recordError,
    list,
    getResourceHistory,
  });
}

module.exports = {
  createAuditService,
  AuditServiceError,
  AUDIT_OUTCOMES,
  sanitizeMetadataValue,
  normalizeMetadata,
};
