'use strict';

/**
 * MedOrbits -- Application Service
 * File: api/services/application-service-2.js
 *
 * Requirements:
 * - Node.js 20+
 * - PostgreSQL
 * - Transaction-capable pg-compatible connection pool
 *
 * Responsibilities:
 * - Create, retrieve, and list applications.
 * - Update draft applications with ownership enforcement.
 * - Submit, review, approve, reject, and withdraw applications.
 * - Record status transitions transactionally.
 * - Enforce authorization and permitted state transitions.
 * - Sanitize metadata and validate inputs.
 * - Use parameterized SQL.
 *
 * IMPORTANT:
 * Verify the table names, column names, ID types, foreign keys,
 * and role names against the actual MedOrbits database schema.
 */

const crypto = require('node:crypto');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_METADATA_BYTES = 32 * 1024;
const MAX_METADATA_DEPTH = 8;
const MAX_METADATA_ARRAY_ITEMS = 100;

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
  draft: Object.freeze(['submitted', 'withdrawn']),
  submitted: Object.freeze([
    'under_review',
    'documents_required',
    'withdrawn',
  ]),
  under_review: Object.freeze([
    'documents_required',
    'approved',
    'rejected',
    'withdrawn',
  ]),
  documents_required: Object.freeze([
    'submitted',
    'under_review',
    'withdrawn',
  ]),
  approved: Object.freeze([]),
  rejected: Object.freeze([]),
  withdrawn: Object.freeze([]),
});

const PRIVILEGED_ROLES = Object.freeze([
  'admin',
  'super_admin',
  'admissions_officer',
]);

const EDITABLE_FIELDS = new Set([
  'applicationType',
  'title',
  'description',
  'metadata',
]);

const SENSITIVE_METADATA_KEY =
  /password|secret|authorization|cookie|access.?token|refresh.?token|private.?key/i;

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
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
    (typeof value === 'string' && value.trim() === '')
  ) {
    throw badRequest(`${field} is required.`);
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

  const rawRole =
    typeof actor.role === 'string'
      ? actor.role.trim().toLowerCase()
      : 'user';

  return {
    id: normalizeId(String(rawId), 'actorId'),
    role: rawRole || 'user',
  };
}

function normalizePrivilegedRoles(roles) {
  if (!Array.isArray(roles)) {
    throw new TypeError(
      'privilegedRoles must be an array of role names.'
    );
  }

  const normalized = roles.map((role) => {
    if (typeof role !== 'string' || !role.trim()) {
      throw new TypeError(
        'Every privileged role must be a non-empty string.'
      );
    }

    return role.trim().toLowerCase();
  });

  return Object.freeze([...new Set(normalized)]);
}

function isPrivileged(actor, privilegedRoles) {
  return privilegedRoles.includes(actor.role);
}

function normalizePage(value, fallback, maximum) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
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
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
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
    throw badRequest(
      'Application metadata must be an object.'
    );
  }

  function sanitize(input, depth = 0) {
    if (depth > MAX_METADATA_DEPTH) {
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
      if (input.length > MAX_METADATA_ARRAY_ITEMS) {
        throw badRequest(
          `Application metadata arrays may contain at most ${MAX_METADATA_ARRAY_ITEMS} items.`
        );
      }

      return input.map((item) => sanitize(item, depth + 1));
    }

    if (!isPlainObject(input)) {
      throw badRequest(
        'Application metadata contains an unsupported value.'
      );
    }

    const result = Object.create(null);

    for (const [key, child] of Object.entries(input)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        continue;
      }

      if (SENSITIVE_METADATA_KEY.test(key)) {
        continue;
      }

      result[key] = sanitize(child, depth + 1);
    }

    return result;
  }

  const sanitized = sanitize(value);
  const serialized = JSON.stringify(sanitized);

  if (
    Buffer.byteLength(serialized, 'utf8') >
    MAX_METADATA_BYTES
  ) {
    throw badRequest(
      'Application metadata must not exceed 32 KB.'
    );
  }

  return sanitized;
}

/**
 * Convert known PostgreSQL constraint failures to safe API errors.
 * Internal database messages are deliberately not returned to clients.
 */
function mapDatabaseError(error) {
  if (error instanceof ApplicationServiceError) {
    return error;
  }

  switch (error?.code) {
    case '23505':
      return conflict(
        'A conflicting application record already exists.',
        'DUPLICATE_APPLICATION'
      );

    case '23503':
      return badRequest(
        'A referenced record does not exist.',
        'INVALID_REFERENCE'
      );

    case '23502':
      return badRequest(
        'A required application field is missing.',
        'REQUIRED_FIELD_MISSING'
      );

    case '23514':
        return badRequest(
          'The application violates a data constraint.',
          'DATA_CONSTRAINT_VIOLATION'
        );

    case '40001':
    case '40P01':
      return conflict(
        'The operation conflicted with another database operation. Please retry.',
        'TRANSACTION_CONFLICT'
      );

    default:
      return new ApplicationServiceError(
        'The application service could not complete the request.',
        500,
        'APPLICATION_DATABASE_ERROR'
      );
  }
}

/**
 * Create the application service.
 *
 * Expected applications columns:
 * id, applicant_id, application_type, status, title,
 * description, metadata, submitted_at, created_at, updated_at
 *
 * Expected application_status_history columns:
 * id, application_id, changed_by, previous_status,
 * new_status, note, created_at
 *
 * Ensure the changed_by column type matches the authenticated actor ID.
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

  const configuredPrivilegedRoles =
    normalizePrivilegedRoles(privilegedRoles);

  async function query(sql, values = []) {
    try {
      return await db.query(sql, values);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async function withTransaction(callback) {
    let client;
    let transactionStarted = false;
    let originalError;

    try {
      client = await db.connect();

      await client.query('BEGIN');
      transactionStarted = true;

      const result = await callback(client);

      await client.query('COMMIT');
      transactionStarted = false;

      return result;
    } catch (error) {
      originalError = error;

      if (client && transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original operation error.
        }
      }

      throw mapDatabaseError(originalError);
    } finally {
      if (client) {
        client.release();
      }
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

  function ensurePlainInput(input, message) {
    if (!isPlainObject(input)) {
      throw badRequest(message);
    }
  }

  function assertKnownFields(input, allowedFields) {
    const unknownFields = Object.keys(input).filter(
      (field) => !allowedFields.has(field)
    );

    if (unknownFields.length > 0) {
      throw badRequest(
        `Unsupported fields: ${unknownFields.join(', ')}.`,
        'UNKNOWN_APPLICATION_FIELDS'
      );
    }
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
      String(application.applicant_id) !== actor.id &&
      !isPrivileged(actor, configuredPrivilegedRoles)
    ) {
      throw notFound();
    }

    return application;
  }

  async function create(input, actorInput) {
    const actor = normalizeActor(actorInput);

    ensurePlainInput(
      input,
      'Application data must be an object.'
    );

    assertKnownFields(
      input,
      EDITABLE_FIELDS
    );

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
          $1, $2, $3, 'draft', $4, $5, $6::jsonb,
          NOW(), NOW()
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

    ensurePlainInput(
      options,
      'Application list options must be an object.'
    );

    const allowedOptions = new Set([
      'page',
      'limit',
      'status',
      'applicationType',
    ]);

    assertKnownFields(options, allowedOptions);

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

    if (!isPrivileged(actor, configuredPrivilegedRoles)) {
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
        SELECT COUNT(*)::text AS total
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

    const totalString = countResult.rows[0]?.total ?? '0';
    const total = Number(totalString);

    if (!Number.isSafeInteger(total)) {
      throw new ApplicationServiceError(
        'Application pagination could not be calculated.',
        500,
        'APPLICATION_COUNT_OVERFLOW'
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

  async function updateDraft(
    applicationId,
    input,
    actorInput
  ) {
    const id = normalizeId(applicationId, 'applicationId');
    const actor = normalizeActor(actorInput);

    ensurePlainInput(
      input,
      'Application update data must be an object.'
    );

    assertKnownFields(input, EDITABLE_FIELDS);

    if (Object.keys(input).length === 0) {
      throw badRequest(
        'Provide at least one field to update.',
        'EMPTY_APPLICATION_UPDATE'
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
        String(application.applicant_id) !== actor.id
      ) {
        // Draft editing is intentionally applicant-only.
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
          JSON.stringify(metadata ?? {}),
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

    if (
      typeof newStatus !== 'string' ||
      !APPLICATION_STATUSES.includes(newStatus)
    ) {
      throw badRequest(
        'The requested application status is invalid.'
      );
    }

    ensurePlainInput(
      options,
      'Status transition options must be an object.'
    );

    assertKnownFields(options, new Set(['note']));

    const note = normalizeString(options.note, 'note', {
      maxLength: 1000,
    });

    const privileged = isPrivileged(
      actor,
      configuredPrivilegedRoles
    );

    // Applicants may request only submission or withdrawal.
    // Actual transition availability is checked against the
    // application's current status inside the transaction.
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
        String(application.applicant_id) !== actor.id &&
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

      if (!updated.rows[0]) {
        throw conflict(
          'The application status could not be updated.',
          'APPLICATION_UPDATE_FAILED'
        );
      }

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

  async function withdraw(
    applicationId,
    actor,
    note
  ) {
    return transitionStatus(
      applicationId,
      'withdrawn',
      actor,
      { note }
    );
  }

  async function review(
    applicationId,
    actorInput,
    options = {}
  ) {
    const actor = normalizeActor(actorInput);

    if (!isPrivileged(actor, configuredPrivilegedRoles)) {
      throw forbidden();
    }

    return transitionStatus(
      applicationId,
      'under_review',
      actor,
      options
    );
  }

  async function requestDocuments(
    applicationId,
    actorInput,
    note
  ) {
    const actor = normalizeActor(actorInput);

    if (!isPrivileged(actor, configuredPrivilegedRoles)) {
      throw forbidden();
    }

    return transitionStatus(
      applicationId,
      'documents_required',
      actor,
      { note }
    );
  }

  async function approve(
    applicationId,
    actorInput,
    note
  ) {
    const actor = normalizeActor(actorInput);

    if (!isPrivileged(actor, configuredPrivilegedRoles)) {
      throw forbidden();
    }

    return transitionStatus(
      applicationId,
      'approved',
      actor,
      { note }
    );
  }

  async function reject(
    applicationId,
    actorInput,
    note
  ) {
    const actor = normalizeActor(actorInput);

    if (!isPrivileged(actor, configuredPrivilegedRoles)) {
      throw forbidden();
    }

    return transitionStatus(
      applicationId,
      'rejected',
      actor,
      { note }
    );
  }

  async function deleteDraft(
    applicationId,
    actorInput
  ) {
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

    // Confirm access before returning status history.
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
    review,
    requestDocuments,
    approve,
    reject,
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