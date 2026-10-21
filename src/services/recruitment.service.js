
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
  'requested',
  'in_progress',
  'fulfilled',
  'cancelled',
]);

const STATUS_TRANSITIONS = Object.freeze({
  requested: new Set([
    'requested',
    'in_progress',
    'cancelled',
  ]),
  in_progress: new Set([
    'in_progress',
    'fulfilled',
    'cancelled',
  ]),
  fulfilled: new Set([
    'fulfilled',
  ]),
  cancelled: new Set([
    'cancelled',
  ]),
});

function createRecruitmentService({
  recruitmentRepository,
  auditService,
}) {
  requireDependency(recruitmentRepository, 'recruitmentRepository');

  if (
    typeof recruitmentRepository.getById !== 'function' ||
    typeof recruitmentRepository.updateById !== 'function'
  ) {
    throw new ServiceError(
      'Recruitment repository is missing required methods.',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: recruitmentRepository,
    entity: 'Recruitment',
    auditService,
  });

  async function setStatus(id, status, actor = {}) {
    requiredId(id);

    if (!ALLOWED_STATUSES.has(status)) {
      throw new ServiceError(
        'Unsupported recruitment status.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
          details: {
            allowed: [...ALLOWED_STATUSES],
          },
        },
      );
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
      await recruitmentRepository.getById(id),
      'Recruitment',
    );

    if (!ALLOWED_STATUSES.has(current.status)) {
      throw new ServiceError(
        'Recruitment record has an invalid stored status.',
        {
          code: 'INVALID_STATE',
          status: 409,
        },
      );
    }

    if (!STATUS_TRANSITIONS[current.status].has(status)) {
      throw new ServiceError(
        `Cannot change recruitment status from "${current.status}" to "${status}".`,
        {
          code: 'INVALID_STATUS_TRANSITION',
          status: 409,
        },
      );
    }

    // Idempotent: do not write or audit an unchanged status.
    if (current.status === status) {
      return current;
    }

    const record = assertFound(
      await recruitmentRepository.updateById(id, {
        status,
      }),
      'Recruitment',
    );

    await audit(auditService, {
      action: 'recruitment.status_changed',
      entity: 'Recruitment',
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
  createRecruitmentService,
  ALLOWED_STATUSES,
  STATUS_TRANSITIONS,
};
