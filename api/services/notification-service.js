'use strict';
/**
 * MedOrbits -- Notification Service
 * File: api/services/notification-service.js
 *
 * Responsibilities:
 * - Create in-app notifications.
 * - Notify individual users or multiple recipients.
 * - List notifications for the authenticated user.
 * - Count unread notifications.
 * - Mark notifications as read or unread.
 * - Delete notifications owned by the requesting user.
 *
 * Requirements:
 * - Node.js 20+
 * - PostgreSQL
 * - A pg-compatible database pool
 *
 * Security:
 * - Always scope user-facing operations to the authenticated user's ID.
 * - Never accept recipient identity from an untrusted client without
 *   authorization checks.
 * - Never store passwords, access tokens, or session cookies in metadata.
 * - Use parameterized SQL for every database query.
 */
const crypto = require('node:crypto');
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_RECIPIENTS = 500;
const MAX_METADATA_BYTES = 16 * 1024;
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
  /password|passwd|secret|token|authorization|cookie|session|api.?key|private.?key|credential/i;
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
  return new NotificationServiceError(message, 400, code);
}
function unauthorized() {
  return new NotificationServiceError(
    'Authentication is required.',
    401,
    'UNAUTHENTICATED'
  );
}
function notFound() {
  return new NotificationServiceError(
    'Notification not found.',
    404,
    'NOTIFICATION_NOT_FOUND'
  );
}
function conflict(message, code = 'NOTIFICATION_CONFLICT') {
  return new NotificationServiceError(message, 409, code);
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
    String(value).trim() === ''
  ) {
    throw unauthorized();
  }
  return normalizeString(String(value), field, {
    required: true,
    maxLength: 128,
  });
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
function normalizeEnum(value, allowed, field, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw badRequest(`${field} is invalid.`);
  }
  return value;
}
/**
 * Recursively sanitize metadata and remove sensitive fields.
 */
function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 8) {
    return '[MAX_DEPTH_REACHED]';
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
    return value.length > 2000
      ? `${value.slice(0, 2000)}...[TRUNCATED]`
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
function normalizeMetadata(value) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw badRequest('Notification metadata must be an object.');
  }
  const sanitized = sanitizeMetadataValue(value);
  const serialized = JSON.stringify(sanitized);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
    throw badRequest(
      `Notification metadata must not exceed ${MAX_METADATA_BYTES} bytes.`
    );
  }
  return sanitized;
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
  // Do not expose SQL, database parameters, or internal server details.
  return new NotificationServiceError(
    'The notification service could not complete the request.',
    500,
    'NOTIFICATION_DATABASE_FAILURE'
  );
}
/**
 * Expected database table:
 *
 * CREATE TABLE notifications (
 *   id UUID PRIMARY KEY,
 *   recipient_id TEXT NOT NULL,
 *   type VARCHAR(40) NOT NULL DEFAULT 'general',
 *   priority VARCHAR(20) NOT NULL DEFAULT 'normal',
 *   title VARCHAR(200) NOT NULL,
 *   message TEXT NOT NULL,
 *   action_url TEXT,
 *   metadata JSONB NOT NULL DEFAULT '{}',
 *   read_at TIMESTAMPTZ,
 *   expires_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * The table's recipient_id type must match your users table.
 */
function createNotificationService({ db } = {}) {
  if (!db || typeof db.query !== 'function') {
    throw new TypeError(
      'createNotificationService requires a pg-compatible database pool.'
    );
  }
  async function execute(target, sql, values = []) {
    try {
      return await (target || db).query(sql, values);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
  function normalizeNotificationInput(input) {
    if (!isPlainObject(input)) {
      throw badRequest('Notification data must be an object.');
    }
    const title = normalizeString(input.title, 'title', {
      required: true,
      maxLength: 200,
    });
    const message = normalizeString(input.message, 'message', {
      required: true,
      maxLength: 10000,
    });
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
    const actionUrl = normalizeString(
      input.actionUrl,
      'actionUrl',
      { maxLength: 2048 }
    );
    if (actionUrl) {
      let parsedUrl;
      try {
        parsedUrl = new URL(actionUrl);
      } catch {
        throw badRequest('actionUrl must be a valid URL.');
      }
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw badRequest(
          'actionUrl must use HTTP or HTTPS.'
        );
      }
    }
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
  /**
   * Create an in-app notification for one recipient.
   *
   * The caller must establish that it is authorized to notify the
   * specified recipient before invoking this method.
   */
  async function create(input, options = {}) {
    if (!isPlainObject(options)) {
      throw badRequest('Notification options must be an object.');
    }
    const recipientId = normalizeUserId(
      input?.recipientId,
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
   * Create the same notification for a bounded set of recipients.
   *
   * This method uses one INSERT statement. For atomic integration with
   * another business operation, pass its transaction client.
   */
  async function createBulk(input, options = {}) {
    if (!isPlainObject(input)) {
      throw badRequest('Bulk notification data must be an object.');
    }
    if (!Array.isArray(input.recipientIds)) {
      throw badRequest('recipientIds must be an array.');
    }
    if (
      input.recipientIds.length === 0 ||
      input.recipientIds.length > MAX_RECIPIENTS
    ) {
      throw badRequest(
        `recipientIds must contain between 1 and ${MAX_RECIPIENTS} users.`
      );
    }
    const recipientIds = [
      ...new Set(
        input.recipientIds.map((id) =>
          normalizeUserId(id, 'recipientId')
        )
      ),
    ];
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
        SELECT
          gen_random_uuid(),
          recipient_id,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8,
          NOW()
        FROM unnest($1::text[]) AS recipients(recipient_id)
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
        recipientIds,
        notification.type,
        notification.priority,
        notification.title,
        notification.message,
        notification.actionUrl,
        JSON.stringify(notification.metadata),
        notification.expiresAt,
      ]
    );
    return {
      createdCount: result.rowCount,
      items: result.rows,
    };
  }
  /**
   * Get one notification belonging to the authenticated user.
   */
  async function getById(notificationId, userId) {
    const id = normalizeUserId(notificationId, 'notificationId');
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
    if (!isPlainObject(options)) {
      throw badRequest('Notification list options must be an object.');
    }
    const page = normalizePage(
      options.page,
      DEFAULT_PAGE,
      1000000
    );
    const limit = normalizePage(
      options.limit,
      DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const unreadOnly = options.unreadOnly === true;
    const type = options.type === undefined
      ? null
      : normalizeEnum(
          options.type,
          NOTIFICATION_TYPES,
          'type',
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
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countResult = await execute(
      null,
      `
        SELECT COUNT(*)::bigint AS total
        FROM notifications
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
   * Count unread, non-expired notifications for one user.
   */
  async function countUnread(userId) {
    const recipientId = normalizeUserId(userId);
    const result = await execute(
      null,
      `
        SELECT COUNT(*)::bigint AS unread_count
        FROM notifications
        WHERE recipient_id = $1
          AND read_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
      `,
      [recipientId]
    );
    return Number(result.rows[0]?.unread_count || 0);
  }
  /**
   * Mark a single notification as read.
   * A repeated request is safe and returns the existing record.
   */
  async function markAsRead(notificationId, userId) {
    const id = normalizeUserId(notificationId, 'notificationId');
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
   * Mark a notification as unread.
   */
  async function markAsUnread(notificationId, userId) {
    const id = normalizeUserId(notificationId, 'notificationId');
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
   * Mark all currently unread, non-expired notifications as read.
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
   * Delete one notification belonging to the authenticated user.
   */
  async function remove(notificationId, userId) {
    const id = normalizeUserId(notificationId, 'notificationId');
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
   * Delete all notifications belonging to one user.
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