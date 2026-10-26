
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
  'archived',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['draft', 'published', 'archived']),
  published: new Set(['published', 'draft', 'archived']),
  archived: new Set(['archived', 'draft']),
});

function createCollegeService({
  collegeRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(collegeRepository, 'collegeRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof collegeRepository.findById === 'function'
      ? collegeRepository.findById
      : collegeRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'College repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof collegeRepository.updateById !== 'function') {
    throw new ServiceError(
      'College repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: collegeRepository,
    entity: 'College',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'name',
      'status',
      'country',
      'state',
      'city',
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
    requiredId(id, 'collegeId');
    validateActor(actor);

    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported college status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    const existing = assertFound(
      await findById.call(collegeRepository, id),
      'College',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError(
        'College has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    /*
     * Publishing and archiving are administrative operations.
     * actor.isAdmin must come from trusted server-side authorization.
     */
    if (
      (status === 'published' || status === 'archived') &&
      actor.isAdmin !== true
    ) {
      throw new ServiceError(
        'Only an authorized administrator can publish or archive a college.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change college status from "${existing.status}" to "${status}".`,
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
    } else if (status === 'draft') {
      changes.publishedAt = null;
    }

    let record;

    /*
     * Implement this repository method as an atomic conditional update.
     * The fallback is compatible with simpler repositories but is not
     * safe against concurrent status changes.
     */
    if (
      typeof collegeRepository.updateIfStatusMatches === 'function'
    ) {
      record = await collegeRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      record = await collegeRepository.updateById(id, changes);
    }

    if (!record) {
      throw new ServiceError(
        'College status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    record = assertFound(record, 'College');

    await audit(auditService, {
      action: 'college.status_changed',
      entity: 'College',
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
  createCollegeService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
