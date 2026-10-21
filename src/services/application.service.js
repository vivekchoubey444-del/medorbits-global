
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredId,
  assertFound,
  createCrudService,
  audit,
} = require('./service-utils');

const ALLOWED_STATUSES = new Set([
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
]);

const TERMINAL_STATUSES = new Set([
  'approved',
  'rejected',
  'withdrawn',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['draft', 'submitted', 'withdrawn']),
  submitted: new Set([
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'withdrawn',
  ]),
  under_review: new Set([
    'under_review',
    'approved',
    'rejected',
    'withdrawn',
  ]),
  approved: new Set(['approved']),
  rejected: new Set(['rejected']),
  withdrawn: new Set(['withdrawn']),
});

const ADMIN_ONLY_STATUSES = new Set([
  'under_review',
  'approved',
  'rejected',
]);

function createApplicationService({
  applicationRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(
    applicationRepository,
    'applicationRepository',
  );

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof applicationRepository.findById === 'function'
      ? applicationRepository.findById
      : applicationRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Application repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof applicationRepository.updateById !== 'function') {
    throw new ServiceError(
      'Application repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: applicationRepository,
    entity: 'Application',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'submittedAt',
      'status',
    ],
  });

  function getNow() {
    const value = clock();
    const date = value instanceof Date
      ? new Date(value.getTime())
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new ServiceError('Invalid service clock value.', {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      });
    }

    return date;
  }

  function validateActor(actor) {
    if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
      throw new ServiceError('Invalid actor.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (actor.id !== undefined && actor.id !== null) {
      requiredId(actor.id, 'actor.id');
    }

    return actor;
  }

  function assertOwnerOrAdmin(record, actor) {
    const isOwner =
      actor.id != null &&
      record.applicantId != null &&
      String(record.applicantId) === String(actor.id);

    if (!isOwner && actor.isAdmin !== true) {
      throw new ServiceError('Application not found.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }

  async function findApplication(id) {
    return assertFound(
      await findById.call(applicationRepository, id),
      'Application',
    );
  }

  async function persistChanges(id, expectedStatus, changes) {
    const update = {
      ...changes,
      updatedAt: getNow(),
    };

    /*
     * Prefer a conditional update so concurrent requests cannot bypass
     * transition rules. The repository should return null on conflict.
     */
    let record;

    if (
      typeof applicationRepository.updateIfStatusMatches === 'function'
    ) {
      record = await applicationRepository.updateIfStatusMatches(
        id,
        expectedStatus,
        update,
      );
    } else {
      record = await applicationRepository.updateById(id, update);
    }

    if (!record) {
      throw new ServiceError(
        'Application changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    return assertFound(record, 'Application');
  }

  async function setStatus(id, status, actor = {}) {
    requiredId(id, 'applicationId');
    validateActor(actor);

    if (!ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported application status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    const existing = await findApplication(id);

    assertOwnerOrAdmin(existing, actor);

    if (
      ADMIN_ONLY_STATUSES.has(status) &&
      actor.isAdmin !== true
    ) {
      throw new ServiceError(
        'Only an authorized administrator can set this status.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError(
        'Application has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change application status from "${existing.status}" to "${status}".`,
        {
          code: 'INVALID_STATUS_TRANSITION',
          status: 409,
        },
      );
    }

    if (existing.status === status) {
      return existing;
    }

    const now = getNow();
    const changes = { status };

    if (status === 'submitted') {
      changes.submittedAt = now;
    }

    if (status === 'withdrawn') {
      changes.withdrawnAt = now;
    }

    if (status === 'approved' || status === 'rejected') {
      changes.reviewedAt = now;
      changes.reviewedBy = actor.id;
    }

    const record = await persistChanges(
      id,
      existing.status,
      changes,
    );

    await audit(auditService, {
      action: 'application.status_changed',
      entity: 'Application',
      entityId: record.id ?? id,
      actorId: actor.id,
      metadata: {
        previousStatus: existing.status,
        status,
      },
    });

    return record;
  }

  async function submit(id, actor = {}) {
    requiredId(id, 'applicationId');
    validateActor(actor);
    requiredId(actor.id, 'actor.id');

    const existing = await findApplication(id);

    // Submission is strictly limited to the authenticated applicant.
    if (
      existing.applicantId == null ||
      String(existing.applicantId) !== String(actor.id)
    ) {
      throw new ServiceError('Application not found.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }

    if (existing.status !== 'draft') {
      throw new ServiceError(
        'Only draft applications can be submitted.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    const now = getNow();

    const record = await persistChanges(id, 'draft', {
      status: 'submitted',
      submittedAt: now,
    });

    await audit(auditService, {
      action: 'application.submitted',
      entity: 'Application',
      entityId: record.id ?? id,
      actorId: actor.id,
      metadata: {
        previousStatus: 'draft',
        status: 'submitted',
      },
    });

    return record;
  }

  return {
    ...crud,
    setStatus,
    submit,
  };
}

module.exports = {
  createApplicationService,
  ALLOWED_STATUSES,
  TERMINAL_STATUSES,
  STATUS_TRANSITIONS,
  ADMIN_ONLY_STATUSES,
};
