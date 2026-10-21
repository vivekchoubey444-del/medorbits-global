
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
  'pending',
  'verified',
  'suspended',
]);

const STATUS_TRANSITIONS = Object.freeze({
  pending: new Set(['pending', 'verified', 'suspended']),
  verified: new Set(['verified', 'suspended']),
  suspended: new Set(['suspended', 'pending']),
});

function createEmployerService({
  employerRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(employerRepository, 'employerRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof employerRepository.findById === 'function'
      ? employerRepository.findById
      : employerRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Employer repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof employerRepository.updateById !== 'function') {
    throw new ServiceError(
      'Employer repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: employerRepository,
    entity: 'Employer',
    auditService,
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
    requiredId(id, 'employerId');
    validateActor(actor);

    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported employer status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    // Employer verification and suspension are privileged operations.
    if (actor.isAdmin !== true) {
      throw new ServiceError(
        'Only an authorized administrator can change employer status.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    const existing = assertFound(
      await findById.call(employerRepository, id),
      'Employer',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError(
        'Employer has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change employer status from "${existing.status}" to "${status}".`,
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

    if (status === 'verified') {
      changes.verifiedAt = now;
      changes.verifiedBy = actor.id;
      changes.suspendedAt = null;
    } else if (status === 'suspended') {
      changes.suspendedAt = now;
      changes.suspendedBy = actor.id;
    } else if (status === 'pending') {
      changes.verifiedAt = null;
      changes.verifiedBy = null;
      changes.suspendedAt = null;
      changes.suspendedBy = null;
    }

    let updated;

    // Prefer a repository-level atomic status transition.
    if (typeof employerRepository.updateIfStatusMatches === 'function') {
      updated = await employerRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      updated = await employerRepository.updateById(id, changes);
    }

    if (!updated) {
      throw new ServiceError(
        'Employer status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    const record = assertFound(updated, 'Employer');

    await audit(auditService, {
      action: 'employer.status_changed',
      entity: 'Employer',
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
  createEmployerService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
