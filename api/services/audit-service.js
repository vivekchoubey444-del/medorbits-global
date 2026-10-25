'use strict';
/**
 * MedOrbits -- Audit Service
 * File: api/services/audit-service.js
 *
 * Responsibilities:
 * - Record security and application audit events.
 * - Capture actor, action, resource, outcome, and request metadata.
 * - Support PostgreSQL pool and transaction-client injection.
 * - Query audit history with pagination and filters.
 * - Prevent sensitive fields from entering audit metadata.
 *
 * Requirements:
 * - Node.js 20+
 * - PostgreSQL
 * - A pg-compatible database pool
 *
 * Security:
 * - Never store passwords, access tokens, refresh tokens, session cookies,
 *   authorization headers, or complete request bodies in audit records.
 * - Restrict audit-history access to authorized staff.
 * - Audit records should be append-only for ordinary application users.
 */
const crypto = require('node:crypto');
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_METADATA_BYTES = 16 * 1024;
const MAX_STRING_LENGTH = 2000;
const AUDIT_OUTCOMES = Object.freeze([
  'success',
  'failure',
  'denied',
  'error',
]);
const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|authorization|cookie|session|api.?key|private.?key|credential|refresh.?token|access.?token/i;
const ALLOWED_FILTERS = new Set([
  'actorId',
  'action',
  'resourceType',
  'resourceId',
  'outcome',
  'requestId',
  'from',
  'to',
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
function badRequest(message, code = 'INVALID_AUDIT_REQUEST') {
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
  return prototype === Object.prototype || prototype === null;
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
  if (!allowEmpty && normalized.length === 0 && !required) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw badRequest(
      `${field} must not exceed ${maxLength} characters.`
    );
  }
  return normalized;
}
function normalizePage(value, fallback, maximum) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(
      'Pagination values must be positive integers.'
    );
  }
  return Math.min(parsed, maximum);
}
function normalizeDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date.`);
  }
  return date;
}
function normalizeOutcome(value) {
  if (value === undefined || value === null || value === '') {
    return 'success';
  }
  if (
    typeof value !== 'string' ||
    !AUDIT_OUTCOMES.includes(value)
  ) {
    throw badRequest('The audit outcome is invalid.');
  }
  return value;
}
/**
 * Remove sensitive values recursively from metadata.
 * Arrays and nested objects are supported.
 *
 * Note: This is defense in depth, not a replacement for explicitly
 * selecting which data should be logged.
 */
function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 8) {
    return '[MAX_DEPTH_REACHED]';
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return Number.isFinite(value) || typeof value !== 'number'
      ? value
      : null;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`
      : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 100)
      .map((item) => sanitizeMetadataValue(item, depth + 1));
  }
  if (!isPlainObject(value)) {
    return '[UNSUPPORTED_VALUE]';
  }
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }
    // Exclude prototype-related keys from copied metadata.
    if (
      key === '__proto__' ||
      key === 'prototype' ||
      key === 'constructor'
    ) {
      continue;
    }
    result[key] = sanitizeMetadataValue(child, depth + 1);
  }
  return result;
}
function normalizeMetadata(metadata) {
  if (metadata === undefined || metadata === null) {
    return {};
  }
  if (!isPlainObject(metadata)) {
    throw badRequest('Audit metadata must be an object.');
  }
  const sanitized = sanitizeMetadataValue(metadata);
  const serialized = JSON.stringify(sanitized);
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
function normalizeActorId(actorId) {
  if (
    actorId === undefined ||
    actorId === null ||
    String(actorId).trim() === ''
  ) {
    return null;
  }
  return normalizeString(String(actorId), 'actorId', {
    maxLength: 128,
  });
}
function normalizeIpAddress(ipAddress) {
  if (ipAddress === undefined || ipAddress === null) {
    return null;
  }
  const value = normalizeString(ipAddress, 'ipAddress', {
    maxLength: 64,
  });
  // This is a conservative syntax check. Use a dedicated IP parser
  // if canonical IP validation is required by the application.
  if (
    value &&
    !/^[0-9a-fA-F:.%]+$/.test(value)
  ) {
    throw badRequest('ipAddress has an invalid format.');
  }
  return value;
}
function normalizeUserAgent(userAgent) {
  return normalizeString(userAgent, 'userAgent', {
    maxLength: 512,
  });
}
function normalizeRequestId(requestId) {
  if (requestId === undefined || requestId === null) {
    return null;
  }
  const normalized = normalizeString(requestId, 'requestId', {
    maxLength: 128,
  });
  if (normalized && !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw badRequest('requestId has an invalid format.');
  }
  return normalized;
}
function mapDatabaseError(error) {
  if (error instanceof AuditServiceError) {
    return error;
  }
  // Do not return database internals to API consumers.
  return new AuditServiceError(
    'The audit service could not complete the request.',
    500,
    'AUDIT_DATABASE_FAILURE'
  );
}
/**
 * Create an audit service using a pg-compatible pool.
 *
 * Expected schema:
 *
 * CREATE TABLE audit_logs (
 *   id BIGSERIAL PRIMARY KEY,
 *   event_id UUID NOT NULL UNIQUE,
 *   actor_id TEXT,
 *   action TEXT NOT NULL,
 *   resource_type TEXT,
 *   resource_id TEXT,
 *   outcome TEXT NOT NULL,
 *   request_id TEXT,
 *   ip_address TEXT,
 *   user_agent TEXT,
 *   metadata JSONB NOT NULL DEFAULT '{}',
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE INDEX audit_logs_created_at_idx
 *   ON audit_logs (created_at DESC);
 *
 * CREATE INDEX audit_logs_actor_created_idx
 *   ON audit_logs (actor_id, created_at DESC);
 *
 * CREATE INDEX audit_logs_resource_idx
 *   ON audit_logs (resource_type, resource_id);
 */
function createAuditService({
  db,
  privilegedRoles = ['admin', 'super_admin', 'auditor'],
} = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError(
      'createAuditService requires a pg-compatible database pool.'
    );
  }
  /**
   * Choose the transaction client when supplied, otherwise the pool.
   * The supplied client must belong to the same PostgreSQL database.
   */
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
  /**
   * Record one audit event.
   *
   * Pass options.dbClient when the audit event must be committed in
   * the same transaction as the business operation.
   *
   * Do not allow unauthenticated clients to choose actorId. Derive
   * actor identity from trusted server-side authentication context.
   */
  async function record(event, options = {}) {
    if (!isPlainObject(event)) {
      throw badRequest('Audit event must be an object.');
    }
    if (!isPlainObject(options)) {
      throw badRequest('Audit options must be an object.');
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
    const resourceId = normalizeString(
      event.resourceId === undefined || event.resourceId === null
        ? null
        : String(event.resourceId),
      'resourceId',
      { maxLength: 128 }
    );
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
    return result.rows[0];
  }
  /**
   * Convenience helper for recording successful operations.
   */
  async function recordSuccess(event, options = {}) {
    return record(
      {
        ...event,
        outcome: 'success',
      },
      options
    );
  }
  /**
   * Convenience helper for recording failed operations.
   */
  async function recordFailure(event, options = {}) {
    return record(
      {
        ...event,
        outcome: 'failure',
      },
      options
    );
  }
  /**
   * Convenience helper for recording access-denied events.
   */
  async function recordDenied(event, options = {}) {
    return record(
      {
        ...event,
        outcome: 'denied',
      },
      options
    );
  }
  /**
   * Query audit records.
   *
   * Access is restricted to configured privileged roles.
   * actorInput must be populated by trusted authentication middleware.
   */
  async function list(filters = {}, actorInput) {
    if (!isPlainObject(filters)) {
      throw badRequest('Audit filters must be an object.');
    }
    if (!actorInput || typeof actorInput !== 'object') {
      throw unauthorized();
    }
    const role =
      typeof actorInput.role === 'string'
        ? actorInput.role
        : '';
    if (!privilegedRoles.includes(role)) {
      throw forbidden();
    }
    const unknownFilters = Object.keys(filters).filter(
      (key) => !ALLOWED_FILTERS.has(key) &&
        !['page', 'limit'].includes(key)
    );
    if (unknownFilters.length > 0) {
      throw badRequest(
        `Unsupported audit filters: ${unknownFilters.join(', ')}.`
      );
    }
    const page = normalizePage(
      filters.page,
      DEFAULT_PAGE,
      1000000
    );
    const limit = normalizePage(
      filters.limit,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const conditions = [];
    const values = [];
    function addCondition(sqlTemplate, value) {
      values.push(value);
      conditions.push(
        sqlTemplate.replace('?', `$${values.length}`)
      );
    }
    if (filters.actorId !== undefined) {
      addCondition(
        'actor_id = ?',
        normalizeString(String(filters.actorId), 'actorId', {
          maxLength: 128,
        })
      );
    }
    if (filters.action !== undefined) {
      addCondition(
        'action = ?',
        normalizeString(filters.action, 'action', {
          required: true,
          maxLength: 150,
        })
      );
    }
    if (filters.resourceType !== undefined) {
      addCondition(
        'resource_type = ?',
        normalizeString(filters.resourceType, 'resourceType', {
          required: true,
          maxLength: 100,
        })
      );
    }
    if (filters.resourceId !== undefined) {
      addCondition(
        'resource_id = ?',
        normalizeString(String(filters.resourceId), 'resourceId', {
          maxLength: 128,
        })
      );
    }
    if (filters.outcome !== undefined) {
      addCondition(
        'outcome = ?',
        normalizeOutcome(filters.outcome)
      );
    }
    if (filters.requestId !== undefined) {
      addCondition(
        'request_id = ?',
        normalizeRequestId(filters.requestId)
      );
    }
    const from = normalizeDate(filters.from, 'from');
    const to = normalizeDate(filters.to, 'to');
    if (from && to && from > to) {
      throw badRequest('"from" must be earlier than or equal to "to".');
    }
    if (from) {
      addCondition('created_at >= ?', from);
    }
    if (to) {
      addCondition('created_at <= ?', to);
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const countResult = await execute(
      null,
      `
        SELECT COUNT(*)::bigint AS total
        FROM audit_logs
        ${whereClause}
      `,
      values
    );
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) {
      throw badRequest('Pagination offset is too large.');
    }
    const dataValues = [...values, limit, offset];
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
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
      `,
      dataValues
    );
    const total = Number(countResult.rows[0]?.total || 0);
    return {
      items: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
  /**
   * Retrieve audit history for a resource.
   * The caller must be authorized to access audit data.
   */
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
    const id = normalizeString(String(resourceId), 'resourceId', {
      required: true,
      maxLength: 128,
    });
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