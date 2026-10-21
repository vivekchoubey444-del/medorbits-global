
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

function createCourseService({
  courseRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(courseRepository, 'courseRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof courseRepository.findById === 'function'
      ? courseRepository.findById
      : courseRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Course repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof courseRepository.updateById !== 'function') {
    throw new ServiceError(
      'Course repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: courseRepository,
    entity: 'Course',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'name',
      'title',
      'status',
      'slug',
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
    requiredId(id, 'courseId');
    validateActor(actor);

    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported course status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }

    const existing = assertFound(
      await findById.call(courseRepository, id),
      'Course',
    );

    if (!ALLOWED_STATUSES.has(existing.status)) {
      throw new ServiceError('Course has an invalid stored status.', {
        code: 'INVALID_STATE',
        status: 409,
      });
    }

    // Publishing or archiving requires trusted administrator authorization.
    if (
      (status === 'published' || status === 'archived') &&
      actor.isAdmin !== true
    ) {
      throw new ServiceError(
        'Only an authorized administrator can publish or archive a course.',
        {
          code: 'FORBIDDEN',
          status: 403,
        },
      );
    }

    if (!STATUS_TRANSITIONS[existing.status].has(status)) {
      throw new ServiceError(
        `Cannot change course status from "${existing.status}" to "${status}".`,
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

    let updated;

    // Prefer an atomic conditional update to prevent concurrent transitions.
    if (typeof courseRepository.updateIfStatusMatches === 'function') {
      updated = await courseRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      updated = await courseRepository.updateById(id, changes);
    }

    if (!updated) {
      throw new ServiceError(
        'Course status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    const record = assertFound(updated, 'Course');

    await audit(auditService, {
      action: 'course.status_changed',
      entity: 'Course',
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
  createCourseService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
