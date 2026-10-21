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
  'requested',
  'scheduled',
  'completed',
  'cancelled',
]);

const TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled',
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  requested: new Set([
    'requested',
    'scheduled',
    'cancelled',
  ]),
  scheduled: new Set([
    'scheduled',
    'completed',
    'cancelled',
  ]),
  completed: new Set(['completed']),
  cancelled: new Set(['cancelled']),
});

function createCounsellingService({
  counsellingRepository,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(
    counsellingRepository,
    'counsellingRepository',
  );

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const crud = createCrudService({
    repository: counsellingRepository,
    entity: 'Counselling',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'status',
      'scheduledAt',
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

  function assertValidStatus(status) {
    if (
      typeof status !== 'string' ||
      !ALLOWED_STATUSES.has(status)
    ) {
      throw new ServiceError(
        'Unsupported counselling status.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
          details: {
            allowed: [...ALLOWED_STATUSES],
          },
        },
      );
    }
  }

  function assertTransitionAllowed(previousStatus, nextStatus) {
    const transitions = ALLOWED_TRANSITIONS[previousStatus];

    if (!transitions || !transitions.has(nextStatus)) {
      throw new ServiceError(
        'This counselling status transition is not permitted.',
        {
          code: 'INVALID_STATUS_TRANSITION',
          status: 409,
          details: {
            previousStatus,
            requestedStatus: nextStatus,
          },
        },
      );
    }
  }

  return {
    ...crud,

    async setStatus(id, status, actor = {}) {
      requiredId(id, 'counsellingId');
      assertValidStatus(status);

      const actorData = plainObject(actor, 'actor');

      const findById =
        counsellingRepository.findById ||
        counsellingRepository.getById;

      if (typeof findById !== 'function') {
        throw new TypeError(
          'Counselling repository must implement findById() or getById().',
        );
      }

      if (
        typeof counsellingRepository.updateById !== 'function'
      ) {
        throw new TypeError(
          'Counselling repository must implement updateById().',
        );
      }

      const existing = assertFound(
        await findById.call(counsellingRepository, id),
        'Counselling',
      );

      if (!ALLOWED_STATUSES.has(existing.status)) {
        throw new ServiceError(
          'The current counselling status is invalid.',
          {
            code: 'INVALID_STORED_STATUS',
            status: 409,
          },
        );
      }

      assertTransitionAllowed(existing.status, status);

      // Repeating the current status is idempotent and must not
      // reset scheduling or completion timestamps.
      if (existing.status === status) {
        return existing;
      }

      const now = getNow();

      const changes = {
        status,
        updatedAt: now,
      };

      if (status === 'scheduled') {
        if (!existing.scheduledAt) {
          changes.scheduledAt = now;
        }
      }

      if (status === 'completed') {
        changes.completedAt = existing.completedAt || now;
      }

      if (status === 'cancelled') {
        changes.cancelledAt = existing.cancelledAt || now;
      }

      const record = assertFound(
        await counsellingRepository.updateById(id, changes),
        'Counselling',
      );

      await audit(auditService, {
        action: 'counselling.status_changed',
        entity: 'Counselling',
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
  createCounsellingService,
  ALLOWED_STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_TRANSITIONS,
};