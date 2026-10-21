
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

function createJobService({
  jobRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(jobRepository, 'jobRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof jobRepository.findById === 'function'
      ? jobRepository.findById
      : jobRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Job repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof jobRepository.updateById !== 'function') {
    throw new ServiceError(
      'Job repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: jobRepository,
    entity: 'Job',
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

  async function updateJob(id, status, action, actor = {}) {
    requiredId(id, 'jobId');
    validateActor(actor);

    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported job status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    // Publishing and job lifecycle changes require an administrator.
    if (actor.isAdmin !== true) {
      throw new ServiceError(
        'Only an authorized administrator can change job status.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    const existing = assertFound(
      await findById.call(jobRepository, id),
      'Job',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError('Job has an invalid stored status.', {
        code: 'INVALID_STATE',
        status: 409,
      });
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change job status from "${existing.status}" to "${status}".`,
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
    } else if (status === 'paused') {
      changes.pausedAt = now;
    } else if (status === 'closed') {
      changes.closedAt = now;
    } else if (status === 'filled') {
      changes.filledAt = now;
    } else if (status === 'draft') {
      changes.publishedAt = null;
      changes.pausedAt = null;
      changes.closedAt = null;
      changes.filledAt = null;
    }

    let updated;

    // Prefer atomic conditional updates to prevent concurrent state changes.
    if (typeof jobRepository.updateIfStatusMatches === 'function') {
      updated = await jobRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      updated = await jobRepository.updateById(id, changes);
    }

    if (!updated) {
      throw new ServiceError(
        'Job status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    const record = assertFound(updated, 'Job');

    await audit(auditService, {
      action,
      entity: 'Job',
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
      return updateJob(
        id,
        status,
        'job.status_changed',
        actor,
      );
    },

    async publish(id, actor = {}) {
      return updateJob(
        id,
        'published',
        'job.published',
        actor,
      );
    },
  };
}

module.exports = {
  createJobService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
