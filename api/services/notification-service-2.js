'use strict';

/**
 * MedOrbits -- Notification Service
 * File: api/services/notification-service.js
 *
 * Requirements:
 * - Node.js 20+
 * - PostgreSQL
 * - A pg-compatible pool or transaction client
 *
 * Features:
 * - Create notifications for individual recipients or bounded batches.
 * - List notifications with pagination and filters.
 * - Count unread, non-expired notifications.
 * - Mark notifications read or unread.
 * - Delete individual notifications or clear a user's inbox.
 * - Sanitize metadata and validate URLs.
 * - Support transaction-client injection.
 * - Enforce recipient ownership for user-facing operations.
 *
 * Security:
 * - Derive user identity from trusted authentication middleware.
 * - Restrict notification creation to trusted internal callers or
 *   callers authorized to notify the specified recipients.
 * - Use parameterized SQL for all queries.
 * - Never store credentials or tokens in notification metadata.
 *
 * IMPORTANT:
 * Match table and column types to the actual MedOrbits migrations.
 */

const crypto = require('node:crypto');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 1_000_000;
const MAX_RECIPIENTS = 500;
const MAX_METADATA_BYTES = 16 * 1024;
const MAX_METADATA_DEPTH = 8;
const MAX_METADATA_ARRAY_ITEMS = 100;
const MAX_METADATA_STRING_LENGTH = 2000;

const NOTIFICATION_TYPES = Object.freeze([
  'general',
  'account',
  'application',
  'admission',
  'document',
  'payment',
  'security',
  'system',
  'support',
  'career',
]);

const NOTIFICATION_PRIORITIES = Object.freeze([
  'low',
  'normal',
  'high',
  'urgent',
]);

const SENSITIVE_KEY_PATTERN =
  /password|passwd|secret|token|authorization|cookie|session|api.?key|private.?key|credential|refresh.?token|access.?token|client.?secret/i;

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const LIST_OPTION_KEYS = new Set([
  'page',
  'limit',
  'unreadOnly',
  'type',
  'priority',
]);

const NOTIFICATION_INPUT_KEYS = new Set([
  'recipientId',
  'recipientIds',
  'title',
  'message',
  'type',
  'priority',
  'actionUrl',
  'expiresAt',
  'metadata',
]);

class NotificationServiceError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'NOTIFICATION_SERVICE_ERROR'
  ) {
    super(message);

    this.name = 'NotificationServiceError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.isOperational = statusCode < 500;

    Error.captureStackTrace?.(this, NotificationServiceError);
  }
}

function badRequest(
  message,
  code = 'INVALID_NOTIFICATION_REQUEST'
) {
  return new NotificationServiceError(
    message,
    400,
    code
  );
}

function unauthorized() {
  return new NotificationServiceError(
    'Authentication is required.',
    401,
    'UNAUTHENTICATED'
  );
}

function forbidden() {
  return new NotificationServiceError(
    'You are not authorized to perform this operation.',
    403,
    'FORBIDDEN'
  );
}

function notFound() {
  return new NotificationServiceError(
    'Notification not found.',
    404,
    'NOTIFICATION_NOT_FOUND'
  );
}

function conflict(
  message,
  code = 'NOTIFICATION_CONFLICT'
) {
  return new NotificationServiceError(
    message,
    409,
    code
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

function assertKnownFields(input, allowedFields, label) {
  const unknownFields = Object.keys(input).filter(
    (field) => !allowedFields.has(field)
  );

  if (unknownFields.length > 0) {
    throw badRequest(
      `Unsupported ${label} fields: ${unknownFields.join(', ')}.`,
      'UNKNOWN_FIELDS'
    );
  }
}

function normalizeString(
  value,
  field,
  {
    required = false,
    maxLength = 255,
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

  if (normalized.length > maxLength) {
    throw badRequest(
      `${field} must not exceed ${maxLength} characters.`
    );
  }

  return normalized || null;
}

function normalizeUserId(value, field = 'userId') {
  if (
    value === undefined ||
    value === null ||
    (
      typeof value === 'string' &&
      value.trim() === ''
    )
  ) {
    throw unauthorized();
  }

  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    throw badRequest(`${field} is invalid.`);
  }

  if (
    typeof value === 'number' &&
    !Number.isSafeInteger(value)
  ) {
    throw badRequest(`${field} is invalid.`);
  }

  return normalizeString(String(value), field, {
    required: true,
    maxLength: 128,
  });
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

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(
      'Pagination values must be positive integers.'
    );
  }

  return Math.min(parsed, maximum);
}

function normalizeEnum(value, allowed, field, fallback) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return fallback;
  }

  if (
    typeof value !== 'string' ||
    !allowed.includes(value)
  ) {
    throw badRequest(`${field} is invalid.`);
  }

  return value;
}

function normalizeBoolean(value, field, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw badRequest(`${field} must be a boolean.`);
}

function normalizeDate(value, field) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value !== 'string' &&
    !(value instanceof Date)
  ) {
    throw badRequest(`${field} must be a valid date.`);
  }

  if (
    typeof value === 'string' &&
    value.length > 100
  ) {
    throw badRequest(`${field} must be a valid date.`);
  }

  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${field} must be a valid date.`);
  }

  return date;
}

function normalizeMetadataValue(value, depth = 0) {
  if (depth > MAX_METADATA_DEPTH) {
    throw badRequest(
      'Notification metadata is nested too deeply.'
    );
  }

  if (
    value === null ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    return value.length > MAX_METADATA_STRING_LENGTH
      ? `${value.slice(0, MAX_METADATA_STRING_LENGTH)}...[TRUNCATED]`
      : value;
  }

  if (Array.isArray(value)) {
    if (value.length > MAX_METADATA_ARRAY_ITEMS) {
      throw badRequest(
        `Notification metadata arrays may contain at most ${MAX_METADATA_ARRAY_ITEMS} items.`
      );
    }

    return value.map((item) =>
      normalizeMetadataValue(item, depth + 1)
    );
  }

  if (!isPlainObject(value)) {
    throw badRequest(
      'Notification metadata contains an unsupported value.'
    );
  }

  const result = Object.create(null);

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      continue;
    }

    if (SENSITIVE_KEY_PATTERN.test(key)) {
      result[key] = '[REDACTED]';
      continue;
    }

    result[key] = normalizeMetadataValue(
      child,
      depth + 1
    );
  }

  return result;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isPlainObject(value)) {
    throw badRequest(
      'Notification metadata must be an object.'
    );
  }

  const sanitized = normalizeMetadataValue(value);
  const serialized = JSON.stringify(sanitized);

  if (
    Buffer.byteLength(serialized, 'utf8') >
    MAX_METADATA_BYTES
  ) {
    throw badRequest(
      `Notification metadata must not exceed ${MAX_METADATA_BYTES} bytes.`
    );
  }

  return sanitized;
}

function sanitizeMetadataValue(value, depth = 0) {
  try {
    return normalizeMetadataValue(value, depth);
  } catch {
    return '[INVALID_METADATA]';
  }
}

function normalizeActionUrl(value) {
  const actionUrl = normalizeString(
    value,
    'actionUrl',
    { maxLength: 2048 }
  );

  if (!actionUrl) {
    return null;
  }

  let parsed;

  try {
    parsed = new URL(actionUrl);
  } catch {
    throw badRequest(
      'actionUrl must be a valid absolute URL.'
    );
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw badRequest(
      'actionUrl must be an HTTP or HTTPS URL without embedded credentials.'
    );
  }

  return parsed.toString();
}

function normalizeNotificationInput(input) {
  if (!isPlainObject(input)) {
    throw badRequest(
      'Notification data must be an object.'
    );
  }

  assertKnownFields(
    input,
    NOTIFICATION_INPUT_KEYS,
    'notification'
  );

  const title = normalizeString(
    input.title,
    'title',
    { required: true, maxLength: 200 }
  );

  const message = normalizeString(
    input.message,
    'message',
    { required: true, maxLength: 10000 }
  );

  const type = normalizeEnum(
    input.type,
    NOTIFICATION_TYPES,
    'type',
    'general'
  );

  const priority = normalizeEnum(
    input.priority,
    NOTIFICATION_PRIORITIES,
    'priority',
    'normal'
  );

  const actionUrl = normalizeActionUrl(input.actionUrl);
  const expiresAt = normalizeDate(
    input.expiresAt,
    'expiresAt'
  );

  if (expiresAt && expiresAt <= new Date()) {
    throw badRequest(
      'expiresAt must be a future date.'
    );
  }

  const metadata = normalizeMetadata(input.metadata);

  return {
    title,
    message,
    type,
    priority,
    actionUrl,
    expiresAt,
    metadata,
  };
}

function mapDatabaseError(error) {
  if (error instanceof NotificationServiceError) {
    return error;
  }

  if (error?.code === '23503') {
    return badRequest(
      'A referenced user does not exist.',
      'INVALID_RECIPIENT'
    );
  }

  if (error?.code === '23505') {
    return conflict(
      'The notification conflicts with an existing record.',
      'DUPLICATE_NOTIFICATION'
    );
  }

  if (
    error?.code === '40001' ||
    error?.code === '40P01'
  ) {
    return conflict(
      'The operation conflicted with another database operation. Please retry.',
      'TRANSACTION_CONFLICT'
    );
  }

  return new NotificationServiceError(
    'The notification service could not complete the request.',
    500,
    'NOTIFICATION_DATABASE_FAILURE'
  );
}

/**
 * Create the notification service.
 *
 * Expected schema:
 *
 * CREATE TABLE notifications (
 *   id UUID PRIMARY KEY,
 *   recipient_id TEXT NOT NULL,
 *   type VARCHAR(40) NOT NULL DEFAULT 'general',
 *   priority VARCHAR(20) NOT NULL DEFAULT 'normal',
 *   title VARCHAR(200) NOT NULL,
 *   message TEXT NOT NULL,
 *   action_url TEXT,
 *   metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 *   read_at TIMESTAMPTZ,
 *   expires_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   CHECK (type IN (
 *     'general', 'account', 'application', 'admission',
 *     'document', 'payment', 'security', 'system',
 *     'support', 'career'
 *   )),
 *   CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
 * );
 *
 * CREATE INDEX notifications_recipient_created_idx
 *   ON notifications (recipient_id, created_at DESC, id DESC);
 *
 * CREATE INDEX notifications_unread_idx
 *   ON notifications (recipient_id, created_at DESC)
 *   WHERE read_at IS NULL;
 *
 * CREATE INDEX notifications_expiry_idx
 *   ON notifications (expires_at)
 *   WHERE expires_at IS NOT NULL;
 *
 * Ensure recipient_id matches the actual users table ID type.
 */
function createNotificationService({ db } = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError(
      'createNotificationService requires a pg-compatible database pool.'
    );
  }

  async function execute(target, sql, values = []) {
    const connection = target || db;

    if (
      !connection ||
      typeof connection.query !== 'function'
    ) {
      throw new TypeError(
        'Invalid notification database connection.'
      );
    }

    try {
      return await connection.query(sql, values);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  function validateOptions(options, allowedKeys, label) {
    if (!isPlainObject(options)) {
      throw badRequest(`${label} must be an object.`);
    }

    assertKnownFields(options, allowedKeys, label);

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
  }

  function normalizeRecipientIds(recipientIds) {
    if (!Array.isArray(recipientIds)) {
      throw badRequest('recipientIds must be an array.');
    }

    if (
      recipientIds.length === 0 ||
      recipientIds.length > MAX_RECIPIENTS
    ) {
      throw badRequest(
        `recipientIds must contain between 1 and ${MAX_RECIPIENTS} users.`
      );
    }

    const normalized = recipientIds.map((id) =>
      normalizeUserId(id, 'recipientId')
    );

    return [...new Set(normalized)];
  }

  function assertListOptions(options) {
    if (!isPlainObject(options)) {
      throw badRequest(
        'Notification list options must be an object.'
      );
    }

    assertKnownFields(
      options,
      LIST_OPTION_KEYS,
      'notification list'
    );
  }

  /**
   * Create a notification for one recipient.
   *
   * This is a trusted service operation, not an authorization boundary.
   * Controllers must authorize the caller before specifying recipientId.
   */
  async function create(input, options = {}) {
    if (!isPlainObject(input)) {
      throw badRequest(
        'Notification data must be an object.'
      );
    }

    validateOptions(
      options,
      new Set(['dbClient']),
      'Notification options'
    );

    const recipientId = normalizeUserId(
      input.recipientId,
      'recipientId'
    );

    const notification = normalizeNotificationInput(input);

    const result = await execute(
      options.dbClient,
      `
        INSERT INTO notifications (
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          expires_at,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, NOW()
        )
        RETURNING
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
      `,
      [
        crypto.randomUUID(),
        recipientId,
        notification.type,
        notification.priority,
        notification.title,
        notification.message,
        notification.actionUrl,
        JSON.stringify(notification.metadata),
        notification.expiresAt,
      ]
    );

    return result.rows[0];
  }

  /**
   * Create the same notification for multiple recipients.
   *
   * UUIDs are generated in Node.js, avoiding a dependency on
   * PostgreSQL's gen_random_uuid() function or an extension.
   */
  async function createBulk(input, options = {}) {
    if (!isPlainObject(input)) {
      throw badRequest(
        'Bulk notification data must be an object.'
      );
    }

    assertKnownFields(
      input,
      NOTIFICATION_INPUT_KEYS,
      'bulk notification'
    );

    validateOptions(
      options,
      new Set(['dbClient']),
      'Notification options'
    );

    const recipientIds = normalizeRecipientIds(
      input.recipientIds
    );

    const notification = normalizeNotificationInput(input);

    const rows = recipientIds.map((recipientId) => ({
      id: crypto.randomUUID(),
      recipientId,
    }));

    const values = [];
    const tuples = rows.map((row) => {
      const offset = values.length;

      values.push(
        row.id,
        row.recipientId,
        notification.type,
        notification.priority,
        notification.title,
        notification.message,
        notification.actionUrl,
        JSON.stringify(notification.metadata),
        notification.expiresAt
      );

      return `(
        $${offset + 1},
        $${offset + 2},
        $${offset + 3},
        $${offset + 4},
        $${offset + 5},
        $${offset + 6},
        $${offset + 7},
        $${offset + 8}::jsonb,
        $${offset + 9},
        NOW()
      )`;
    });

    const result = await execute(
      options.dbClient,
      `
        INSERT INTO notifications (
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          expires_at,
          created_at
        )
        VALUES ${tuples.join(', ')}
        RETURNING
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
      `,
      values
    );

    return {
      createdCount: result.rowCount,
      items: result.rows,
    };
  }

  /**
   * Get one notification owned by the specified authenticated user.
   */
  async function getById(notificationId, userId) {
    const id = normalizeUserId(
      notificationId,
      'notificationId'
    );

    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        SELECT
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
        FROM notifications
        WHERE id = $1
          AND recipient_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `,
      [id, recipientId]
    );

    if (!result.rows[0]) {
      throw notFound();
    }

    return result.rows[0];
  }

  /**
   * List notifications for one user.
   */
  async function list(userId, options = {}) {
    const recipientId = normalizeUserId(userId);

    assertListOptions(options);

    const page = normalizePage(
      options.page,
      DEFAULT_PAGE,
      MAX_PAGE
    );

    const limit = normalizePage(
      options.limit,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const unreadOnly = normalizeBoolean(
      options.unreadOnly,
      'unreadOnly',
      false
    );

    const type = normalizeEnum(
      options.type,
      NOTIFICATION_TYPES,
      'type',
      null
    );

    const priority = normalizeEnum(
      options.priority,
      NOTIFICATION_PRIORITIES,
      'priority',
      null
    );

    const conditions = [
      'recipient_id = $1',
      '(expires_at IS NULL OR expires_at > NOW())',
    ];

    const values = [recipientId];

    if (unreadOnly) {
      conditions.push('read_at IS NULL');
    }

    if (type) {
      values.push(type);
      conditions.push(`type = $${values.length}`);
    }

    if (priority) {
      values.push(priority);
      conditions.push(`priority = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await execute(
      null,
      `
        SELECT COUNT(*)::text AS total
        FROM notifications
        ${whereClause}
      `,
      values
    );

    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      throw badRequest(
        'Pagination offset is too large.'
      );
    }

    const dataValues = [...values, limit, offset];

    const result = await execute(
      null,
      `
        SELECT
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${dataValues.length - 1}
        OFFSET $${dataValues.length}
      `,
      dataValues
    );

    const total = Number(
      countResult.rows[0]?.total ?? '0'
    );

    if (!Number.isSafeInteger(total)) {
      throw new NotificationServiceError(
        'Notification pagination could not be calculated.',
        500,
        'NOTIFICATION_COUNT_OVERFLOW'
      );
    }

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
   * Count unread, non-expired notifications.
   */
  async function countUnread(userId) {
    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        SELECT COUNT(*)::text AS unread_count
        FROM notifications
        WHERE recipient_id = $1
          AND read_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [recipientId]
    );

    const count = Number(
      result.rows[0]?.unread_count ?? '0'
    );

    if (!Number.isSafeInteger(count)) {
      throw new NotificationServiceError(
        'Unread notification count could not be calculated.',
        500,
        'NOTIFICATION_COUNT_OVERFLOW'
      );
    }

    return count;
  }

  /**
   * Mark one notification as read.
   * Repeated calls are idempotent.
   */
  async function markAsRead(notificationId, userId) {
    const id = normalizeUserId(
      notificationId,
      'notificationId'
    );

    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        UPDATE notifications
        SET read_at = COALESCE(read_at, NOW())
        WHERE id = $1
          AND recipient_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
      `,
      [id, recipientId]
    );

    if (!result.rows[0]) {
      throw notFound();
    }

    return result.rows[0];
  }

  /**
   * Mark one notification as unread.
   */
  async function markAsUnread(notificationId, userId) {
    const id = normalizeUserId(
      notificationId,
      'notificationId'
    );

    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        UPDATE notifications
        SET read_at = NULL
        WHERE id = $1
          AND recipient_id = $2
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING
          id,
          recipient_id,
          type,
          priority,
          title,
          message,
          action_url,
          metadata,
          read_at,
          expires_at,
          created_at
      `,
      [id, recipientId]
    );

    if (!result.rows[0]) {
      throw notFound();
    }

    return result.rows[0];
  }

  /**
   * Mark all unread, non-expired notifications as read.
   */
  async function markAllAsRead(userId) {
    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        UPDATE notifications
        SET read_at = NOW()
        WHERE recipient_id = $1
          AND read_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [recipientId]
    );

    return {
      updatedCount: result.rowCount,
    };
  }

  /**
   * Delete one notification owned by the specified user.
   */
  async function remove(notificationId, userId) {
    const id = normalizeUserId(
      notificationId,
      'notificationId'
    );

    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        DELETE FROM notifications
        WHERE id = $1
          AND recipient_id = $2
        RETURNING id
      `,
      [id, recipientId]
    );

    if (!result.rows[0]) {
      throw notFound();
    }

    return {
      id: result.rows[0].id,
      deleted: true,
    };
  }

  /**
   * Delete all notifications owned by one user.
   */
  async function clearAll(userId) {
    const recipientId = normalizeUserId(userId);

    const result = await execute(
      null,
      `
        DELETE FROM notifications
        WHERE recipient_id = $1
      `,
      [recipientId]
    );

    return {
      deletedCount: result.rowCount,
    };
  }

  return Object.freeze({
    create,
    createBulk,
    getById,
    list,
    countUnread,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    remove,
    clearAll,
  });
}

module.exports = {
  createNotificationService,
  NotificationServiceError,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  sanitizeMetadataValue,
  normalizeMetadata,
};