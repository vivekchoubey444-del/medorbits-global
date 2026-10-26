'use strict';

const {
  ServiceError,
  requireDependency,
  requiredId,
  plainObject,
  assertFound,
  createCrudService,
  audit,
} = require('./service-utils');

const ALLOWED_STATUSES = new Set([
  'active',
  'inactive',
  'blocked',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  active: new Set(['active', 'inactive', 'blocked']),
  inactive: new Set(['active', 'inactive', 'blocked']),
  blocked: new Set(['blocked', 'inactive']),
});

function createCandidateService({
  candidateRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(candidateRepository, 'candidateRepository');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const crud = createCrudService({
    repository: candidateRepository,
    entity: 'Candidate',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'name',
      'status',
    ],
  });

  function getNow() {
    const value = clock();

    if (
      !(value instanceof Date) ||
      Number.isNaN(value.getTime())
    ) {
      throw new TypeError(
        'clock must return a valid Date.',
      );
    }

    return new Date(value.getTime());
  }

  return {
    ...crud,

    async setStatus(id, status, actor = {}) {
      requiredId(id, 'candidateId');

      const actorData = plainObject(actor, 'actor');

      if (
        typeof status !== 'string' ||
        !ALLOWED_STATUSES.has(status)
      ) {
        throw new ServiceError(
          'Unsupported candidate status.',
          {
            code: 'VALIDATION_ERROR',
            status: 422,
            details: {
              allowed: [...ALLOWED_STATUSES],
            },
          },
        );
      }

      const findById =
        candidateRepository.findById ||
        candidateRepository.getById;

      if (typeof findById !== 'function') {
        throw new TypeError(
          'Candidate repository must implement findById() or getById().',
        );
      }

      if (
        typeof candidateRepository.updateById !== 'function'
      ) {
        throw new TypeError(
          'Candidate repository must implement updateById().',
        );
      }

      const existing = assertFound(
        await findById.call(candidateRepository, id),
        'Candidate',
      );

      if (!ALLOWED_STATUSES.has(existing.status)) {
        throw new ServiceError(
          'The current candidate status is invalid.',
          {
            code: 'INVALID_STORED_STATUS',
            status: 409,
          },
        );
      }

      const transitions = ALLOWED_TRANSITIONS[existing.status];

      if (!transitions.has(status)) {
        throw new ServiceError(
          'This candidate status transition is not permitted.',
          {
            code: 'INVALID_STATUS_TRANSITION',
            status: 409,
            details: {
              previousStatus: existing.status,
              requestedStatus: status,
            },
          },
        );
      }

      // Idempotent request: do not modify timestamps or emit
      // duplicate audit events when the status is unchanged.
      if (existing.status === status) {
        return existing;
      }

      const record = assertFound(
        await candidateRepository.updateById(id, {
          status,
          updatedAt: getNow(),
        }),
        'Candidate',
      );

      await audit(auditService, {
        action: 'candidate.status_changed',
        entity: 'Candidate',
        entityId: id,
        actorId: actorData.id,
        metadata: {
          previousStatus: existing.status,
          status,
        },
      });

      return record;
    },
  };
}

module.exports = {
  createCandidateService,
  ALLOWED_STATUSES,
  ALLOWED_TRANSITIONS,
};