'use strict';
/**
 * MedOrbits -- Application Service 2
 * File: api/services/application-service-2.js
 *
 * Features:
 * - Create and retrieve applications.
 * - List applications with pagination and filters.
 * - Update draft applications.
 * - Submit, review, approve, reject, and withdraw applications.
 * - Record status transitions in application_status_history.
 * - Enforce ownership and privileged-role checks.
 * - Use parameterized SQL and PostgreSQL transactions.
 *
 * Requirements:
 * - Node.js 20+
 * - PostgreSQL
 * - A pg-compatible database pool.
 *
 * IMPORTANT:
 * Align the SQL table and column names with your existing schema.
 */
const crypto = require('node:crypto');
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const APPLICATION_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'under_review',
  'documents_required',
  'approved',
  'rejected',
  'withdrawn',
]);
const ALLOWED_TRANSITIONS = Object.freeze({
  draft: ['submitted', 'withdrawn'],
  submitted: [
    'under_review',
    'documents_required',
    'withdrawn',
  ],
  under_review: [
    'documents_required',
    'approved',
    'rejected',
    'withdrawn',
  ],
  documents_required: [
    'submitted',
    'under_review',
    'withdrawn',
  ],
  approved: [],
  rejected: [],
  withdrawn: [],
});
const PRIVILEGED_ROLES = Object.freeze([
  'admin',
  'super_admin',
  'admissions_officer',
]);
class ApplicationServiceError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'APPLICATION_SERVICE_ERROR'
  ) {
    super(message);
    this.name = 'ApplicationServiceError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.code = code;
    this.isOperational = statusCode < 500;
    Error.captureStackTrace?.(this, ApplicationServiceError);
  }
}
function badRequest(
  message,
  code = 'INVALID_APPLICATION_REQUEST'
) {
  return new ApplicationServiceError(message, 400, code);
}
function unauthorized() {
  return new ApplicationServiceError(
    'Authentication is required.',
    401,
    'UNAUTHENTICATED'
  );
}
function forbidden() {
  return new ApplicationServiceError(
    'You are not authorized to perform this operation.',
    403,
    'FORBIDDEN'
  );
}
function notFound() {
  return new ApplicationServiceError(
    'Application not found.',
    404,
    'APPLICATION_NOT_FOUND'
  );
}
function conflict(
  message,
  code = 'APPLICATION_CONFLICT'
) {
  return new ApplicationServiceError(message, 409, code);
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
  return normalized;
}
function normalizeId(value, field = 'id') {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    throw badRequest(`${field} is required.`);
  }
  return normalizeString(String(value), field, {
    required: true,
    maxLength: 128,
  });
}
function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object') {
    throw unauthorized();
  }
  const rawId = actor.id ?? actor.userId ?? actor.sub;
  if (
    rawId === undefined ||
    rawId === null ||
    String(rawId).trim() === ''
  ) {
    throw unauthorized();
  }
  return {
    id: normalizeId(String(rawId), 'actorId'),
    role:
      typeof actor.role === 'string'
        ? actor.role
        : 'user',
  };
}
function isPrivileged(actor, privilegedRoles) {
  return privilegedRoles.includes(actor.role);
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
function normalizeStatus(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (
    typeof value !== 'string' ||
    !APPLICATION_STATUSES.includes(value)
  ) {
    throw badRequest('Application status is invalid.');
  }
  return value;
}
function normalizeMetadata(value) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) {
    throw badRequest('Application metadata must be an object.');
  }
  const forbiddenKeys = new Set([
    '__proto__',
    'prototype',
    'constructor',
  ]);
  function sanitize(input, depth = 0) {
    if (depth > 8) {
      throw badRequest(
        'Application metadata is nested too deeply.'
      );
    }
    if (
      input === null ||
      typeof input === 'string' ||
      typeof input === 'boolean'
    ) {
      return input;
    }
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) {
        throw badRequest(
          'Application metadata contains an invalid number.'
        );
      }
      return input;
    }
    if (Array.isArray(input)) {
      if (input.length > 100) {
        throw badRequest(
          'Application metadata arrays may contain at most 100 items.'
        );
      }
      return input.map((item) => sanitize(item, depth + 1));
    }
    if (!isPlainObject(input)) {
      throw badRequest(
        'Application metadata contains an unsupported value.'
      );
    }
    const result = {};
    for (const [key, child] of Object.entries(input)) {
      if (forbiddenKeys.has(key)) {
        continue;
      }
      if (
        /password|secret|authorization|cookie|access.?token|refresh.?token|private.?key/i.test(
          key
        )
      ) {
        continue;
      }
      result[key] = sanitize(child, depth + 1);
    }
    return result;
  }
  const sanitized = sanitize(value);
  if (
    Buffer.byteLength(JSON.stringify(sanitized), 'utf8') >
    32 * 1024
  ) {
    throw badRequest(
      'Application metadata must not exceed 32 KB.'
    );
  }
  return sanitized;
}
function mapDatabaseError(error) {
  if (error instanceof ApplicationServiceError) {
    return error;
  }
  if (error?.code === '23505') {
    return conflict(
      'A conflicting application record already exists.',
      'DUPLICATE_APPLICATION'
    );
  }
  if (error?.code === '23503') {
    return badRequest(
      'A referenced record does not exist.',
      'INVALID_REFERENCE'
    );
  }
  return new ApplicationServiceError(
    'The application service could not complete the request.',
    500,
    'APPLICATION_DATABASE_ERROR'
  );
}
/**
 * Create an application service with a PostgreSQL pool.
 *
 * Required table: applications
 *
 * Expected columns:
 * id, applicant_id, application_type, status, title, description,
 * metadata, submitted_at, created_at, updated_at
 *
 * Required history table: application_status_history
 *
 * Expected columns:
 * id, application_id, changed_by, previous_status, new_status,
 * note, created_at
 */
function createApplicationService({
  db,
  privilegedRoles = [...PRIVILEGED_ROLES],
} = {}) {
  if (
    !db ||
    typeof db.query !== 'function' ||
    typeof db.connect !== 'function'
  ) {
    throw new TypeError(
      'A transaction-capable PostgreSQL pool is required.'
    );
  }
  async function query(sql, values = []) {
    try {
      return await db.query(sql, values);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }
  async function withTransaction(callback) {
    const client = await db.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const result = await callback(client);
      await client.query('COMMIT');
      transactionStarted = false;
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original error.
        }
      }
      throw mapDatabaseError(error);
    } finally {
      client.release();
    }
  }
  function applicationColumns(alias = '') {
    const prefix = alias ? `${alias}.` : '';
    return `
      ${prefix}id,
      ${prefix}applicant_id,
      ${prefix}application_type,
      ${prefix}status,
      ${prefix}title,
      ${prefix}description,
      ${prefix}metadata,
      ${prefix}submitted_at,
      ${prefix}created_at,
      ${prefix}updated_at
    `;
  }
  async function getById(applicationId, actorInput) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);
    const result = await query(
      `
        SELECT ${applicationColumns()}
        FROM applications
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );
    const application = result.rows[0];
    if (!application) {
      throw notFound();
    }
    if (
      application.applicant_id !== actor.id &&
      !isPrivileged(actor, privilegedRoles)
    ) {
      // Do not reveal another user's application.
      throw notFound();
    }
    return application;
  }
  async function create(input, actorInput) {
    const actor = normalizeActor(actorInput);
    if (!isPlainObject(input)) {
      throw badRequest(
        'Application data must be an object.'
      );
    }
    const applicationType = normalizeString(
      input.applicationType,
      'applicationType',
      { required: true, maxLength: 100 }
    );
    const title = normalizeString(
      input.title,
      'title',
      { maxLength: 200 }
    );
    const description = normalizeString(
      input.description,
      'description',
      { maxLength: 5000 }
    );
    const metadata = normalizeMetadata(input.metadata);
    const id = `APP-${crypto.randomUUID()}`;
    const result = await query(
      `
        INSERT INTO applications (
          id,
          applicant_id,
          application_type,
          status,
          title,
          description,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, 'draft', $4, $5, $6::jsonb, NOW(), NOW()
        )
        RETURNING ${applicationColumns()}
      `,
      [
        id,
        actor.id,
        applicationType,
        title,
        description,
        JSON.stringify(metadata),
      ]
    );
    return result.rows[0];
  }
  async function list(options = {}, actorInput) {
    const actor = normalizeActor(actorInput);
    if (!isPlainObject(options)) {
      throw badRequest(
        'Application list options must be an object.'
      );
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
    const status = normalizeStatus(options.status);
    const applicationType =
      options.applicationType === undefined ||
      options.applicationType === ''
        ? null
        : normalizeString(
            options.applicationType,
            'applicationType',
            { required: true, maxLength: 100 }
          );
    const conditions = [];
    const values = [];
    if (!isPrivileged(actor, privilegedRoles)) {
      values.push(actor.id);
      conditions.push(`applicant_id = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (applicationType) {
      values.push(applicationType);
      conditions.push(
        `application_type = $${values.length}`
      );
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';
    const countResult = await query(
      `
        SELECT COUNT(*)::bigint AS total
        FROM applications
        ${whereClause}
      `,
      values
    );
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) {
      throw badRequest('Pagination offset is too large.');
    }
    const dataValues = [...values, limit, offset];
    const result = await query(
      `
        SELECT ${applicationColumns()}
        FROM applications
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
  async function updateDraft(
    applicationId,
    input,
    actorInput
  ) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);
    if (!isPlainObject(input)) {
      throw badRequest(
        'Application update data must be an object.'
      );
    }
    const allowedFields = new Set([
      'applicationType',
      'title',
      'description',
      'metadata',
    ]);
    const unknownFields = Object.keys(input).filter(
      (field) => !allowedFields.has(field)
    );
    if (unknownFields.length > 0) {
      throw badRequest(
        `Unsupported fields: ${unknownFields.join(', ')}.`,
        'UNKNOWN_APPLICATION_FIELDS'
      );
    }
    return withTransaction(async (client) => {
      const selected = await client.query(
        `
          SELECT ${applicationColumns()}
          FROM applications
          WHERE id = $1
          FOR UPDATE
        `,
        [id]
      );
      const application = selected.rows[0];
      if (
        !application ||
        application.applicant_id !== actor.id
      ) {
        throw notFound();
      }
      if (application.status !== 'draft') {
        throw conflict(
          'Only draft applications can be edited.',
          'APPLICATION_NOT_EDITABLE'
        );
      }
      const applicationType =
        input.applicationType === undefined
          ? application.application_type
          : normalizeString(
              input.applicationType,
              'applicationType',
              { required: true, maxLength: 100 }
            );
      const title =
        input.title === undefined
          ? application.title
          : normalizeString(input.title, 'title', {
              maxLength: 200,
            });
      const description =
        input.description === undefined
          ? application.description
          : normalizeString(
              input.description,
              'description',
              { maxLength: 5000 }
            );
      const metadata =
        input.metadata === undefined
          ? application.metadata
          : normalizeMetadata(input.metadata);
      const updated = await client.query(
        `
          UPDATE applications
          SET
            application_type = $2,
            title = $3,
            description = $4,
            metadata = $5::jsonb,
            updated_at = NOW()
          WHERE id = $1
            AND applicant_id = $6
            AND status = 'draft'
          RETURNING ${applicationColumns()}
        `,
        [
          id,
          applicationType,
          title,
          description,
          JSON.stringify(metadata || {}),
          actor.id,
        ]
      );
      if (!updated.rows[0]) {
        throw conflict(
          'The application is no longer editable.',
          'APPLICATION_NOT_EDITABLE'
        );
      }
      return updated.rows[0];
    });
  }
  async function transitionStatus(
    applicationId,
    newStatus,
    actorInput,
    options = {}
  ) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);
    if (!APPLICATION_STATUSES.includes(newStatus)) {
      throw badRequest(
        'The requested application status is invalid.'
      );
    }
    if (!isPlainObject(options)) {
      throw badRequest(
        'Status transition options must be an object.'
      );
    }
    const note = normalizeString(options.note, 'note', {
      maxLength: 1000,
    });
    const privileged = isPrivileged(actor, privilegedRoles);
    if (
      !privileged &&
      !['submitted', 'withdrawn'].includes(newStatus)
    ) {
      throw forbidden();
    }
    return withTransaction(async (client) => {
      const selected = await client.query(
        `
          SELECT ${applicationColumns()}
          FROM applications
          WHERE id = $1
          FOR UPDATE
        `,
        [id]
      );
      const application = selected.rows[0];
      if (!application) {
        throw notFound();
      }
      if (
        application.applicant_id !== actor.id &&
        !privileged
      ) {
        throw notFound();
      }
      const allowedNextStatuses =
        ALLOWED_TRANSITIONS[application.status] || [];
      if (!allowedNextStatuses.includes(newStatus)) {
        throw conflict(
          `Cannot transition from "${application.status}" to "${newStatus}".`,
          'INVALID_STATUS_TRANSITION'
        );
      }
      const updated = await client.query(
        `
          UPDATE applications
          SET
            status = $2,
            submitted_at = CASE
              WHEN $2 = 'submitted' AND submitted_at IS NULL
                THEN NOW()
              ELSE submitted_at
            END,
            updated_at = NOW()
          WHERE id = $1
          RETURNING ${applicationColumns()}
        `,
        [id, newStatus]
      );
      await client.query(
        `
          INSERT INTO application_status_history (
            application_id,
            changed_by,
            previous_status,
            new_status,
            note,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW())
        `,
        [
          id,
          actor.id,
          application.status,
          newStatus,
          note,
        ]
      );
      return updated.rows[0];
    });
  }
  async function submit(applicationId, actor) {
    return transitionStatus(
      applicationId,
      'submitted',
      actor
    );
  }
  async function withdraw(applicationId, actor, note) {
    return transitionStatus(
      applicationId,
      'withdrawn',
      actor,
      { note }
    );
  }
  async function deleteDraft(applicationId, actorInput) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);
    const result = await query(
      `
        DELETE FROM applications
        WHERE id = $1
          AND applicant_id = $2
          AND status = 'draft'
        RETURNING id
      `,
      [id, actor.id]
    );
    if (!result.rows[0]) {
      throw notFound();
    }
    return {
      id: result.rows[0].id,
      deleted: true,
    };
  }
  async function getStatusHistory(
    applicationId,
    actorInput
  ) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);
    // Verify that the actor is allowed to access the application.
    await getById(id, actor);
    const result = await query(
      `
        SELECT
          id,
          application_id,
          changed_by,
          previous_status,
          new_status,
          note,
          created_at
        FROM application_status_history
        WHERE application_id = $1
        ORDER BY created_at DESC, id DESC
      `,
      [id]
    );
    return result.rows;
  }
  return Object.freeze({
    create,
    getById,
    list,
    updateDraft,
    transitionStatus,
    submit,
    withdraw,
    deleteDraft,
    getStatusHistory,
  });
}
module.exports = {
  createApplicationService,
  ApplicationServiceError,
  APPLICATION_STATUSES,
  ALLOWED_TRANSITIONS,
};