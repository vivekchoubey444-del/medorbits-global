
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
  'pending',
  'under_review',
  'approved',
  'rejected',
  'deleted',
]);

const DOWNLOADABLE_STATUSES = new Set(['approved']);

const STATUS_TRANSITIONS = Object.freeze({
  pending: new Set(['pending', 'under_review', 'approved', 'rejected', 'deleted']),
  under_review: new Set(['under_review', 'approved', 'rejected', 'deleted']),
  approved: new Set(['approved', 'under_review', 'deleted']),
  rejected: new Set(['rejected', 'under_review', 'deleted']),
  deleted: new Set(['deleted']),
});

const DEFAULT_DOWNLOAD_TTL_SECONDS = 300;
const MAX_DOWNLOAD_TTL_SECONDS = 900;
const MIN_DOWNLOAD_TTL_SECONDS = 30;

function createDocumentService({
  documentRepository,
  storageService,
  auditService,
  clock = () => new Date(),
}) {
  requireDependency(documentRepository, 'documentRepository');
  requireDependency(storageService, 'storageService');

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const findById =
    typeof documentRepository.findById === 'function'
      ? documentRepository.findById
      : documentRepository.getById;

  if (typeof findById !== 'function') {
    throw new ServiceError(
      'Document repository must implement findById() or getById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  if (typeof documentRepository.updateById !== 'function') {
    throw new ServiceError(
      'Document repository must implement updateById().',
      {
        code: 'CONFIGURATION_ERROR',
        status: 500,
      },
    );
  }

  const crud = createCrudService({
    repository: documentRepository,
    entity: 'Document',
    auditService,
    allowedSort: [
      'createdAt',
      'updatedAt',
      'originalName',
      'status',
      'size',
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

  function assertOwnerOrAdmin(document, actor) {
    const isAdmin = actor.isAdmin === true;

    const isOwner =
      actor.id != null &&
      document.ownerId != null &&
      String(actor.id) === String(document.ownerId);

    if (!isAdmin && !isOwner) {
      throw new ServiceError('Document not found.', {
        code: 'NOT_FOUND',
        status: 404,
      });
    }
  }

  function assertStatus(status) {
    if (typeof status !== 'string' || !ALLOWED_STATUSES.has(status)) {
      throw new ServiceError('Unsupported document status.', {
        code: 'VALIDATION_ERROR',
        status: 422,
        details: {
          allowed: [...ALLOWED_STATUSES],
        },
      });
    }
  }

  async function findDocument(id) {
    return assertFound(
      await findById.call(documentRepository, id),
      'Document',
    );
  }

  async function persistStatus(id, existing, changes) {
    let updated;

    if (typeof documentRepository.updateIfStatusMatches === 'function') {
      updated = await documentRepository.updateIfStatusMatches(
        id,
        existing.status,
        changes,
      );
    } else {
      updated = await documentRepository.updateById(id, changes);
    }

    if (!updated) {
      throw new ServiceError(
        'Document status changed concurrently. Reload and try again.',
        {
          code: 'STATE_CONFLICT',
          status: 409,
        },
      );
    }

    return assertFound(updated, 'Document');
  }

  function normalizeLimit(value) {
    if (value === undefined || value === null || value === '') {
      return 20;
    }

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number < 1 || number > 100) {
      throw new ServiceError('Invalid document page limit.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return number;
  }

  function normalizeCursor(cursor) {
    if (cursor === undefined || cursor === null || cursor === '') {
      return undefined;
    }

    if (
      typeof cursor !== 'string' ||
      cursor.length > 512 ||
      /[\u0000-\u001f\u007f]/.test(cursor)
    ) {
      throw new ServiceError('Invalid document cursor.', {
        code: 'VALIDATION_ERROR',
        status: 422,
      });
    }

    return cursor;
  }

  function normalizeDownloadTtl(value) {
    if (!Number.isSafeInteger(value)) {
      throw new ServiceError(
        'Download URL expiry must be an integer number of seconds.',
        {
          code: 'VALIDATION_ERROR',
          status: 422,
        },
      );
    }

    return Math.max(
      MIN_DOWNLOAD_TTL_SECONDS,
      Math.min(value, MAX_DOWNLOAD_TTL_SECONDS),
    );
  }

  return {
    ...crud,

    async getById(id, actor = {}) {
      requiredId(id, 'documentId');
      validateActor(actor);

      const document = await findDocument(id);
      assertOwnerOrAdmin(document, actor);

      return document;
    },

    async listForOwner(ownerId, query = {}, actor = {}) {
      requiredId(ownerId, 'ownerId');
      validateActor(actor);

      const isOwner =
        actor.id != null &&
        String(actor.id) === String(ownerId);

      if (!isOwner && actor.isAdmin !== true) {
        throw new ServiceError('Document listing not found.', {
          code: 'NOT_FOUND',
          status: 404,
        });
      }

      if (typeof documentRepository.listForOwner !== 'function') {
        throw new ServiceError(
          'Document listing is not configured.',
          {
            code: 'DOCUMENT_REPOSITORY_MISCONFIGURED',
            status: 501,
          },
        );
      }

      if (
        query.status !== undefined &&
        query.status !== null &&
        query.status !== '' &&
        !ALLOWED_STATUSES.has(query.status)
      ) {
        throw new ServiceError('Unsupported document status filter.', {
          code: 'VALIDATION_ERROR',
          status: 422,
        });
      }

      return documentRepository.listForOwner(ownerId, {
        limit: normalizeLimit(query.limit),
        cursor: normalizeCursor(query.cursor),
        status: query.status || undefined,
      });
    },

    async setStatus(id, status, actor = {}) {
      requiredId(id, 'documentId');
      validateActor(actor);
      assertStatus(status);

      const document = await findDocument(id);

      if (
        status === 'approved' ||
        status === 'rejected' ||
        status === 'under_review'
      ) {
        if (actor.isAdmin !== true) {
          throw new ServiceError(
            'Only authorized reviewers can change the review status.',
            {
              code: 'FORBIDDEN',
              status: 403,
            },
          );
        }
      } else {
        assertOwnerOrAdmin(document, actor);
      }

      if (!ALLOWED_STATUSES.has(document.status)) {
        throw new ServiceError('Document has an invalid stored status.', {
          code: 'INVALID_STATE',
          status: 409,
        });
      }

      if (!STATUS_TRANSITIONS[document.status].has(status)) {
        throw new ServiceError(
          `Cannot change document status from "${document.status}" to "${status}".`,
          {
            code: 'INVALID_STATUS_TRANSITION',
            status: 409,
          },
        );
      }

      if (document.status === status) {
        return document;
      }

      const now = getNow();
      const changes = {
        status,
        updatedAt: now,
      };

      if (status === 'approved' || status === 'rejected') {
        changes.reviewedAt = now;
        changes.reviewedBy = actor.id;
      }

      if (status === 'deleted') {
        changes.deletedAt = now;
      }

      const updated = await persistStatus(id, document, changes);

      await audit(auditService, {
        action: 'document.status_changed',
        entity: 'Document',
        entityId: updated.id ?? id,
        actorId: actor.id,
        metadata: {
          previousStatus: document.status,
          status,
        },
      });

      return updated;
    },

    async createDownloadUrl({
      documentId,
      ownerId,
      actor = {},
      expiresInSeconds = DEFAULT_DOWNLOAD_TTL_SECONDS,
    } = {}) {
      requiredId(documentId, 'documentId');
      validateActor(actor);

      const document = await findDocument(documentId);
      assertOwnerOrAdmin(document, actor);

      if (
        ownerId != null &&
        String(ownerId) !== String(document.ownerId)
      ) {
        throw new ServiceError('Document not found.', {
          code: 'NOT_FOUND',
          status: 404,
        });
      }

      if (!DOWNLOADABLE_STATUSES.has(document.status)) {
        throw new ServiceError(
          'This document is not available for download.',
          {
            code: 'DOCUMENT_UNAVAILABLE',
            status: 403,
          },
        );
      }

      if (typeof storageService.createDownloadUrl !== 'function') {
        throw new ServiceError(
          'Document downloads are not configured.',
          {
            code: 'STORAGE_NOT_CONFIGURED',
            status: 501,
          },
        );
      }

      const result = await storageService.createDownloadUrl({
        storageKey: requiredString(
          document.storageKey,
          'storageKey',
          { max: 1024 },
        ),
        ownerId: document.ownerId,
        expiresInSeconds: normalizeDownloadTtl(expiresInSeconds),
      });

      await audit(auditService, {
        action: 'document.download_url_created',
        entity: 'Document',
        entityId: document.id ?? documentId,
        actorId: actor.id,
        metadata: {
          expiresInSeconds: normalizeDownloadTtl(expiresInSeconds),
        },
      });

      return result;
    },

    async remove(id, actor = {}) {
      requiredId(id, 'documentId');
      validateActor(actor);

      const document = await findDocument(id);
      assertOwnerOrAdmin(document, actor);

      if (document.status === 'deleted') {
        return { id, deleted: true };
      }

      if (typeof storageService.remove !== 'function') {
        throw new ServiceError(
          'Document deletion is not configured.',
          {
            code: 'STORAGE_NOT_CONFIGURED',
            status: 501,
          },
        );
      }

      /*
       * Mark the record deleted first to prevent new downloads.
       * If object deletion fails, retain the deleted record for retry.
       */
      const now = getNow();

      const updated = await persistStatus(id, document, {
        status: 'deleted',
        deletedAt: now,
        updatedAt: now,
      });

      try {
        await storageService.remove({
          storageKey: requiredString(
            document.storageKey,
            'storageKey',
            { max: 1024 },
          ),
          ownerId: document.ownerId,
        });
      } catch (error) {
        await audit(auditService, {
          action: 'document.storage_cleanup_failed',
          entity: 'Document',
          entityId: updated.id ?? id,
          actorId: actor.id,
          metadata: {
            status: 'deleted',
          },
        });

        throw new ServiceError(
          'Document was marked deleted, but storage cleanup failed. Retry cleanup.',
          {
            code: 'DOCUMENT_CLEANUP_FAILED',
            status: 503,
          },
        );
      }

      await audit(auditService, {
        action: 'document.deleted',
        entity: 'Document',
        entityId: updated.id ?? id,
        actorId: actor.id,
      });

      return {
        id,
        deleted: true,
        document: updated,
      };
    },
  };
}

module.exports = {
  createDocumentService,
  ALLOWED_STATUSES,
  DOWNLOADABLE_STATUSES,
  STATUS_TRANSITIONS,
  DEFAULT_DOWNLOAD_TTL_SECONDS,
  MIN_DOWNLOAD_TTL_SECONDS,
  MAX_DOWNLOAD_TTL_SECONDS,
};
