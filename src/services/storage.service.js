
'use strict';

const crypto = require('node:crypto');

const {
  ServiceError,
  requireDependency,
  requiredString,
  requiredId,
  assertFound,
  audit,
} = require('./service-utils');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIGNED_URL_SECONDS = 900;
const MIN_SIGNED_URL_SECONDS = 30;
const MAX_FILENAME_LENGTH = 255;
const MAX_STORAGE_KEY_LENGTH = 1024;

const DEFAULT_ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const FILE_SIGNATURES = Object.freeze({
  'application/pdf': (buffer) =>
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-',

  'image/jpeg': (buffer) =>
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff,

  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    ),
});

const DOWNLOAD_BLOCKED_STATUSES = new Set([
  'pending',
  'rejected',
  'deleted',
]);

function createStorageService({
  provider,
  documentRepository,
  auditService,
  maxBytes = DEFAULT_MAX_BYTES,
  allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES,
  clock = () => new Date(),
}) {
  requireDependency(provider, 'storage provider');

  if (
    typeof provider.put !== 'function' ||
    typeof provider.delete !== 'function'
  ) {
    throw new ServiceError(
      'Storage provider is missing required methods.',
      {
        code: 'STORAGE_PROVIDER_MISCONFIGURED',
        status: 500,
      },
    );
  }

  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }

  if (
    !Array.isArray(allowedMimeTypes) ||
    allowedMimeTypes.length === 0 ||
    !allowedMimeTypes.every(
      (type) =>
        typeof type === 'string' &&
        Object.prototype.hasOwnProperty.call(FILE_SIGNATURES, type),
    )
  ) {
    throw new TypeError(
      'allowedMimeTypes must contain supported MIME types only.',
    );
  }

  if (typeof clock !== 'function') {
    throw new TypeError('clock must be a function.');
  }

  const mimeAllowlist = new Set(allowedMimeTypes);

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

  function validateStorageKey(storageKey) {
    const key = requiredString(storageKey, 'storageKey', {
      max: MAX_STORAGE_KEY_LENGTH,
    });

    const parts = key.split('/');

    if (
      key.startsWith('/') ||
      key.endsWith('/') ||
      key.includes('\\') ||
      key.includes('\0') ||
      /[\u0000-\u001f\u007f]/.test(key) ||
      parts.length !== 2 ||
      parts.some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..',
      )
    ) {
      throw new ServiceError('Invalid storage key.', {
        code: 'INVALID_STORAGE_KEY',
        status: 422,
      });
    }

    return key;
  }

  function sanitizeFilename(filename) {
    const value = requiredString(filename, 'filename', {
      max: MAX_FILENAME_LENGTH,
    });

    if (
      !value ||
      value === '.' ||
      value === '..' ||
      /[\u0000-\u001f\u007f]/.test(value) ||
      /[/\\]/.test(value)
    ) {
      throw new ServiceError('Invalid filename.', {
        code: 'INVALID_FILENAME',
        status: 422,
      });
    }

    return value;
  }

  function validateFileSignature(buffer, mimeType) {
    const check = FILE_SIGNATURES[mimeType];

    return typeof check === 'function' && check(buffer);
  }

  function invalidDocumentError() {
    return new ServiceError('Document not found.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  async function findOwnedDocument(storageKey, ownerId) {
    if (
      !documentRepository ||
      typeof documentRepository.findByStorageKey !== 'function'
    ) {
      throw new ServiceError(
        'Document ownership verification is not configured.',
        {
          code: 'DOCUMENT_REPOSITORY_REQUIRED',
          status: 503,
        },
      );
    }

    const doc = await documentRepository.findByStorageKey(storageKey);

    if (
      !doc ||
      doc.storageKey !== storageKey ||
      String(doc.ownerId) !== String(ownerId)
    ) {
      throw invalidDocumentError();
    }

    return doc;
  }

  async function deleteStoredObject(key) {
    try {
      await provider.delete(key);
      return true;
    } catch {
      // Do not return provider details or credentials to the caller.
      return false;
    }
  }

  return {
    async upload({
      ownerId,
      buffer,
      filename,
      mimeType,
    } = {}) {
      requiredId(ownerId, 'ownerId');

      if (
        !documentRepository ||
        typeof documentRepository.create !== 'function'
      ) {
        throw new ServiceError(
          'Document metadata persistence is not configured.',
          {
            code: 'DOCUMENT_REPOSITORY_REQUIRED',
            status: 503,
          },
        );
      }

      const originalName = sanitizeFilename(filename);

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ServiceError(
          'A non-empty file buffer is required.',
          {
            code: 'INVALID_FILE',
            status: 422,
          },
        );
      }

      if (buffer.length > maxBytes) {
        throw new ServiceError(
          'File exceeds the maximum permitted size.',
          {
            code: 'FILE_TOO_LARGE',
            status: 413,
          },
        );
      }

      if (!mimeAllowlist.has(mimeType)) {
        throw new ServiceError('File type is not allowed.', {
          code: 'FILE_TYPE_NOT_ALLOWED',
          status: 415,
        });
      }

      if (!validateFileSignature(buffer, mimeType)) {
        throw new ServiceError(
          'The file content does not match the declared file type.',
          {
            code: 'FILE_SIGNATURE_MISMATCH',
            status: 415,
          },
        );
      }

      const checksum = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');

      const key = `${String(ownerId)}/${crypto.randomUUID()}`;

      await provider.put({
        key,
        body: buffer,
        contentType: mimeType,
        metadata: {
          originalName,
          checksum,
        },
      });

      let record;

      try {
        record = await documentRepository.create({
          ownerId,
          storageKey: key,
          originalName,
          mimeType,
          size: buffer.length,
          checksum,
          status: 'pending',
          createdAt: getNow(),
        });

        assertFound(record, 'Document');
      } catch {
        const cleanedUp = await deleteStoredObject(key);

        throw new ServiceError(
          cleanedUp
            ? 'Unable to register the uploaded document.'
            : 'Document registration failed and storage cleanup requires reconciliation.',
          {
            code: cleanedUp
              ? 'DOCUMENT_REGISTRATION_FAILED'
              : 'DOCUMENT_CLEANUP_REQUIRED',
            status: 500,
          },
        );
      }

      await audit(auditService, {
        action: 'document.uploaded',
        entity: 'Document',
        entityId: record.id,
        actorId: ownerId,
        metadata: {
          mimeType,
          size: buffer.length,
          checksum,
        },
      });

      return {
        document: record,
        storageKey: key,
      };
    },

    async createDownloadUrl({
      storageKey,
      ownerId,
      expiresInSeconds = 300,
    } = {}) {
      const key = validateStorageKey(storageKey);
      requiredId(ownerId, 'ownerId');

      const doc = await findOwnedDocument(key, ownerId);

      if (DOWNLOAD_BLOCKED_STATUSES.has(doc.status)) {
        throw new ServiceError(
          'This document is not available for download.',
          {
            code: 'DOCUMENT_UNAVAILABLE',
            status: 403,
          },
        );
      }

      if (doc.status !== 'approved') {
        throw new ServiceError(
          'This document is not available for download.',
          {
            code: 'DOCUMENT_UNAVAILABLE',
            status: 403,
          },
        );
      }

      if (typeof provider.createSignedUrl !== 'function') {
        throw new ServiceError(
          'Signed downloads are not configured.',
          {
            code: 'SIGNED_DOWNLOADS_UNAVAILABLE',
            status: 501,
          },
        );
      }

      if (
        typeof expiresInSeconds !== 'number' ||
        !Number.isFinite(expiresInSeconds) ||
        expiresInSeconds < MIN_SIGNED_URL_SECONDS
      ) {
        throw new ServiceError('Invalid signed URL expiry.', {
          code: 'INVALID_EXPIRY',
          status: 422,
        });
      }

      const ttl = Math.min(
        MAX_SIGNED_URL_SECONDS,
        Math.floor(expiresInSeconds),
      );

      const url = await provider.createSignedUrl(key, ttl);

      if (
        typeof url !== 'string' ||
        url.length === 0 ||
        /[\r\n\u0000-\u001f\u007f]/.test(url)
      ) {
        throw new ServiceError(
          'The storage provider returned an invalid download URL.',
          {
            code: 'STORAGE_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      let parsedUrl;

      try {
        parsedUrl = new URL(url);
      } catch {
        throw new ServiceError(
          'The storage provider returned an invalid download URL.',
          {
            code: 'STORAGE_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new ServiceError(
          'The storage provider returned an unsafe download URL.',
          {
            code: 'STORAGE_PROVIDER_ERROR',
            status: 502,
          },
        );
      }

      return {
        url,
        expiresInSeconds: ttl,
      };
    },

    async remove({
      storageKey,
      ownerId,
    } = {}) {
      const key = validateStorageKey(storageKey);
      requiredId(ownerId, 'ownerId');

      if (
        !documentRepository ||
        typeof documentRepository.updateById !== 'function'
      ) {
        throw new ServiceError(
          'Document status updates are not configured.',
          {
            code: 'DOCUMENT_REPOSITORY_MISCONFIGURED',
            status: 503,
          },
        );
      }

      const doc = await findOwnedDocument(key, ownerId);

      if (doc.status === 'deleted') {
        return { deleted: true };
      }

      // Mark metadata first so the document is no longer downloadable.
      // If storage deletion fails, reconciliation can retry later.
      assertFound(
        await documentRepository.updateById(doc.id, {
          status: 'deleted',
          deletedAt: getNow(),
        }),
        'Document',
      );

      try {
        await provider.delete(key);
      } catch {
        await audit(auditService, {
          action: 'document.storage_delete_failed',
          entity: 'Document',
          entityId: doc.id,
          actorId: ownerId,
          metadata: {
            storageKey: key,
          },
        });

        throw new ServiceError(
          'Document was marked deleted, but storage cleanup requires retry.',
          {
            code: 'DOCUMENT_CLEANUP_REQUIRED',
            status: 503,
          },
        );
      }

      await audit(auditService, {
        action: 'document.deleted',
        entity: 'Document',
        entityId: doc.id,
        actorId: ownerId,
      });

      return { deleted: true };
    },
  };
}

module.exports = {
  createStorageService,
  DEFAULT_MAX_BYTES,
  MAX_SIGNED_URL_SECONDS,
  MIN_SIGNED_URL_SECONDS,
  DEFAULT_ALLOWED_MIME_TYPES,
};
