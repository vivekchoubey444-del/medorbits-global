
'use strict';

const {
  ServiceError,
  requireDependency,
  requiredId,
  requiredString,
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

function createUniversityService({
  universityRepository,
  auditService,
}) {
  requireDependency(universityRepository, 'universityRepository');

  if (
    typeof universityRepository.updateById !== 'function' ||
    typeof universityRepository.getById !== 'function'
  ) {
    throw new ServiceError(
      'University repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: universityRepository,
    entity: 'University',
    auditService,
  });

  async function setStatus(id, status, actor = {}) {
    requiredId(id);

    if (!ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported university status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    if (
      actor === null ||
      typeof actor !== 'object' ||
      Array.isArray(actor)
    ) {
      throw new ServiceError('Invalid actor.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    const actorId = actor.id == null
      ? undefined
      : requiredId(actor.id, 'actor.id');

    const current = assertFound(
      await universityRepository.getById(id),
      'University',
    );

    if (!ALLOWED_STATUSES.has(current.status)) {
      throw new ServiceError(
        'University has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[current.status].has(status)) {
      throw new ServiceError(
        `Cannot change university status from "${current.status}" to "${status}".`,
        {
          code: 'INVALID_STATUS_TRANSITION',
          status: 409,
        },
      );
    }

    if (current.status === status) {
      return current;
    }

    const record = assertFound(
      await universityRepository.updateById(id, {
        status,
      }),
      'University',
    );

    await audit(auditService, {
      action: 'university.status_changed',
      entity: 'University',
      entityId: record.id ?? id,
      actorId,
      metadata: {
        previousStatus: current.status,
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
  createUniversityService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
