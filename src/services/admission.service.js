
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
  'open',
  'closed',
  'cancelled',
]);

const TERMINAL_STATUSES = new Set([
  'cancelled',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['draft', 'open', 'closed', 'cancelled']),
  open: new Set(['open', 'closed', 'cancelled']),
  closed: new Set(['closed', 'cancelled']),
  cancelled: new Set(['cancelled']),
});

function createAdmissionService({
  admissionRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(admissionRepository, 'admissionRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof admissionRepository.findById === 'function'
      ? admissionRepository.findById
      : admissionRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Admission repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof admissionRepository.updateById !== 'function') {
    throw new ServiceError(
      'Admission repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: admissionRepository,
    entity: 'Admission',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'name',
      'title',
      'status',
      'startDate',
      'endDate',
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

  async function setStatus(id, status, actor = {}) {
    requiredId(id, 'admissionId');
    validateActor(actor);

    if (
      typeof status !== 'string' ||
      !ALLOWED_STATUSES.has(status)
    ) {
      throw new ServiceError('Unsupported admission status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    const existing = assertFound(
      await findById.call(admissionRepository, id),
      'Admission',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError(
        'Admission has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change admission status from "${existing.status}" to "${status}".`,
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
    const changes = {
      status,
      updatedAt: now,
    };

    if (status === 'open') {
      changes.openedAt = now;
    }

    if (status === 'closed') {
      changes.closedAt = now;
    }

    if (status === 'cancelled') {
      changes.cancelledAt = now;
    }

    let record;

    if (
      typeof admissionRepository.updateStatusIfCurrent === 'function'
    ) {
      record = await admissionRepository.updateStatusIfCurrent(
        id,
        existing.status,
        changes,
      );
    } else {
      record = await admissionRepository.updateById(id, changes);
    }

    if (!record) {
      throw new ServiceError(
        'Admission status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    assertFound(record, 'Admission');

    await audit(auditService, {
      action: 'admission.status_changed',
      entity: 'Admission',
      entityId: record.id ?? id,
      actorId: actor.id,
      metadata: {
        previousStatus: existing.status,
        status,
      },
    });

    return record;
  }

  return {
    ...crud,
    setStatus,
  };
}

module.exports = {
  createAdmissionService,
  ALLOWED_STATUSES,
  TERMINAL_STATUSES,
  STATUS_TRANSITIONS,
};
