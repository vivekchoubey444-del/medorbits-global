
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
  'published',
  'paused',
  'closed',
  'filled',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['draft', 'published', 'closed']),
  published: new Set(['published', 'paused', 'closed', 'filled']),
  paused: new Set(['paused', 'published', 'closed', 'filled']),
  closed: new Set(['closed']),
  filled: new Set(['filled']),
});

function createInternshipService({
  internshipRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(internshipRepository, 'internshipRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof internshipRepository.findById === 'function'
      ? internshipRepository.findById
      : internshipRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Internship repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof internshipRepository.updateById !== 'function') {
    throw new ServiceError(
      'Internship repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: internshipRepository,
    entity: 'Internship',
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

  async function updateInternship(
    id,
    status,
    action,
    actor = {},
  ) {
    requiredId(id, 'internshipId');
    validateActor(actor);

    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported internship status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    // Status changes are restricted to trusted administrators.
    if (actor.isAdmin !== true) {
      throw new ServiceError(
        'Only an authorized administrator can change internship status.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    const existing = assertFound(
      await findById.call(internshipRepository, id),
      'Internship',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError(
        'Internship has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change internship status from "${existing.status}" to "${status}".`,
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

    if (status === 'published') {
      changes.publishedAt = existing.publishedAt || now;
    }

    if (status === 'closed') {
      changes.closedAt = now;
    }

    if (status === 'filled') {
      changes.filledAt = now;
    }

    if (status === 'paused') {
      changes.pausedAt = now;
    }

    if (status === 'draft') {
      changes.publishedAt = null;
      changes.pausedAt = null;
      changes.closedAt = null;
      changes.filledAt = null;
    }

    let updated;

    // Prefer an atomic conditional update when the repository supports it.
    if (
      typeof internshipRepository.updateIfStatusMatches === 'function'
    ) {
      updated = await internshipRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      updated = await internshipRepository.updateById(id, changes);
    }

    if (!updated) {
      throw new ServiceError(
        'Internship status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    const record = assertFound(updated, 'Internship');

    await audit(auditService, {
      action,
      entity: 'Internship',
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

    async setStatus(id, status, actor = {}) {
      return updateInternship(
        id,
        status,
        'internship.status_changed',
        actor,
      );
    },

    async publish(id, actor = {}) {
      return updateInternship(
        id,
        'published',
        'internship.published',
        actor,
      );
    },
  };
}

module.exports = {
  createInternshipService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
