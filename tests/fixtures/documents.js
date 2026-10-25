
'use strict';

/**
 * MedOrbits -- Document Test Fixtures
 *
 * File: tests/fixtures/documents.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Reusable synthetic document records and payloads for unit,
 *   integration, API, upload, download, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic metadata only.
 *   - Never creates files or uploads content to storage.
 *   - Storage keys are identifiers, not proof of file existence.
 *   - Does not establish ownership, authentication, or permissions.
 *   - Does not replace production validation or authorization.
 *
 * Module format: CommonJS.
 */

const DOCUMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  UNDER_REVIEW: 'under_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  DELETED: 'deleted',
});

const DOCUMENT_TYPES = Object.freeze({
  IDENTITY_PROOF: 'identity_proof',
  ADDRESS_PROOF: 'address_proof',
  EDUCATION_CERTIFICATE: 'education_certificate',
  MARKSHEET: 'marksheet',
  TRANSCRIPT: 'transcript',
  ENTRANCE_EXAM_SCORECARD: 'entrance_exam_scorecard',
  PHOTO: 'photo',
  SIGNATURE: 'signature',
  RESUME: 'resume',
  EXPERIENCE_CERTIFICATE: 'experience_certificate',
  INCOME_PROOF: 'income_proof',
  CATEGORY_CERTIFICATE: 'category_certificate',
  MIGRATION_CERTIFICATE: 'migration_certificate',
  TRANSFER_CERTIFICATE: 'transfer_certificate',
  OTHER: 'other',
});

const DOCUMENT_STATUS_VALUES = Object.freeze(
  Object.values(DOCUMENT_STATUSES),
);

const DOCUMENT_TYPE_VALUES = Object.freeze(
  Object.values(DOCUMENT_TYPES),
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'documentNumber',
  'ownerId',
  'status',
  'verification',
  'uploadedAt',
  'createdAt',
  'updatedAt',
]);

const MAX_SET_SIZE = 1000;
const MAX_CLONE_DEPTH = 50;

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const DEFAULT_VERIFICATION = Object.freeze({
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  expiresAt: null,
});

const DEFAULT_FILE = Object.freeze({
  fileName: 'identity-proof-test.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  checksum: null,
  storageKey:
    'test-only/documents/document_test_0001/identity-proof-test.pdf',
});

const DEFAULT_DOCUMENT = Object.freeze({
  id: 'document_test_0001',
  documentNumber: 'MO-DOC-TEST-0001',
  ownerId: 'user_test_0001',
  applicationId: 'app_test_0001',
  documentType: DOCUMENT_TYPES.IDENTITY_PROOF,
  status: DOCUMENT_STATUSES.UPLOADED,
  file: DEFAULT_FILE,
  verification: DEFAULT_VERIFICATION,
  visibility: 'private',
  uploadedAt: '2026-10-01T08:45:00.000Z',
  createdAt: '2026-10-01T08:45:00.000Z',
  updatedAt: '2026-10-01T08:45:00.000Z',
});

const DEFAULT_UPLOAD_DESCRIPTOR = Object.freeze({
  originalName: 'test-upload.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  documentType: DOCUMENT_TYPES.IDENTITY_PROOF,
  applicationId: 'app_test_0001',
});

/**
 * Assert that a value is a plain object.
 *
 * @param {unknown} value
 * @param {string} [label='Value']
 * @returns {void}
 */
function assertPlainObject(value, label = 'Value') {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype
    && prototype !== null
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

/**
 * Assert that a value is a non-empty string.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value;
}

/**
 * Validate a non-negative safe integer.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function assertNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative safe integer`,
    );
  }

  return value;
}

/**
 * Validate a supported document status.
 *
 * @param {unknown} status
 * @returns {string}
 */
function assertDocumentStatus(status) {
  if (!DOCUMENT_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported document status: ${status}`);
  }

  return status;
}

/**
 * Validate a supported document type.
 *
 * @param {unknown} documentType
 * @returns {string}
 */
function assertDocumentType(documentType) {
  if (!DOCUMENT_TYPE_VALUES.includes(documentType)) {
    throw new RangeError(`Unsupported document type: ${documentType}`);
  }

  return documentType;
}

/**
 * Clone JSON-compatible fixture values.
 *
 * Rejects circular references, accessors, unsupported object types,
 * dangerous property names, non-finite numbers, and excessive depth.
 *
 * @param {unknown} value
 * @param {string} [label]
 * @param {WeakSet<object>} [ancestors]
 * @param {number} [depth]
 * @returns {any}
 */
function clone(
  value,
  label = 'Fixture value',
  ancestors = new WeakSet(),
  depth = 0,
) {
  if (depth > MAX_CLONE_DEPTH) {
    throw new RangeError(`${label} exceeds maximum nesting depth`);
  }

  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${label} contains a non-finite number`);
    }

    return value;
  }

  if (typeof value !== 'object') {
    throw new TypeError(`${label} contains an unsupported value`);
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${label} must not contain circular references`);
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => (
        clone(item, `${label}[${index}]`, ancestors, depth + 1)
      ));
    }

    assertPlainObject(value, label);

    const result = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        throw new TypeError(`${label} must not contain symbol keys`);
      }

      if (FORBIDDEN_KEYS.has(key)) {
        throw new TypeError(`${label} contains a prohibited property name`);
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(`${label}.${key} must be a data property`);
      }

      result[key] = clone(
        descriptor.value,
        `${label}.${key}`,
        ancestors,
        depth + 1,
      );
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Merge a nested object with its defaults.
 *
 * @param {object} defaults
 * @param {unknown} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeNestedObject(defaults, overrides, label) {
  if (overrides === undefined) {
    return clone(defaults, label);
  }

  assertPlainObject(overrides, label);

  return {
    ...clone(defaults, `${label} defaults`),
    ...clone(overrides, label),
  };
}

/**
 * Validate and clone a record array.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {object[]}
 */
function cloneRecordArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }

  return value.map((record, index) => {
    assertPlainObject(record, `${label}[${index}]`);
    return clone(record, `${label}[${index}]`);
  });
}

/**
 * Validate the file metadata shape.
 *
 * This does not verify actual file content, file signatures, storage
 * existence, MIME authenticity, or upload authorization.
 *
 * @param {object} file
 * @returns {object}
 */
function normalizeFileMetadata(file) {
  assertPlainObject(file, 'Document file metadata');

  const result = {
    ...clone(DEFAULT_FILE, 'Default file metadata'),
    ...clone(file, 'Document file metadata'),
  };

  assertNonEmptyString(result.fileName, 'file.fileName');
  assertNonEmptyString(result.mimeType, 'file.mimeType');
  assertNonNegativeSafeInteger(result.sizeBytes, 'file.sizeBytes');

  if (
    result.checksum !== null
    && result.checksum !== undefined
    && typeof result.checksum !== 'string'
  ) {
    throw new TypeError('file.checksum must be a string or null');
  }

  if (
    result.storageKey !== null
    && result.storageKey !== undefined
    && typeof result.storageKey !== 'string'
  ) {
    throw new TypeError('file.storageKey must be a string or null');
  }

  return result;
}

/**
 * Create a fresh synthetic document record.
 *
 * This factory supports intentionally inconsistent workflow metadata
 * for negative tests. Use the dedicated workflow factories for common
 * scenarios.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');

  const safeOverrides = clone(overrides, 'Document overrides');

  const document = {
    ...clone(DEFAULT_DOCUMENT, 'Default document'),
    ...safeOverrides,
  };

  document.file = mergeNestedObject(
    DEFAULT_FILE,
    safeOverrides.file,
    'Document file overrides',
  );

  document.file = normalizeFileMetadata(document.file);

  document.verification = mergeNestedObject(
    DEFAULT_VERIFICATION,
    safeOverrides.verification,
    'Document verification overrides',
  );

  assertDocumentType(document.documentType);
  assertDocumentStatus(document.status);

  return document;
}

/**
 * Create a client-submittable document metadata payload.
 *
 * Explicit overrides are preserved for mass-assignment and request
 * validation tests. Production handlers must independently enforce
 * accepted fields and validate upload content.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocumentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Document payload overrides');

  const safeOverrides = clone(overrides, 'Document payload overrides');

  return {
    applicationId: DEFAULT_DOCUMENT.applicationId,
    documentType: DEFAULT_DOCUMENT.documentType,
    fileName: DEFAULT_FILE.fileName,
    mimeType: DEFAULT_FILE.mimeType,
    sizeBytes: DEFAULT_FILE.sizeBytes,
    ...safeOverrides,
  };
}

/**
 * Create a collection with deterministic, unique document identities.
 *
 * Generated document IDs, document numbers, owners, application IDs,
 * filenames, and storage keys are reserved by this factory.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createDocumentSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > MAX_SET_SIZE
  ) {
    throw new RangeError(
      `Document count must be an integer from 0 to ${MAX_SET_SIZE}`,
    );
  }

  assertPlainObject(overrides, 'Document set overrides');

  const safeOverrides = clone(overrides, 'Document set overrides');

  const {
    id: ignoredId,
    documentNumber: ignoredDocumentNumber,
    ownerId: ignoredOwnerId,
    applicationId: ignoredApplicationId,
    file: fileOverrides = {},
    ...commonOverrides
  } = safeOverrides;

  assertPlainObject(fileOverrides, 'Document set file overrides');

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const documentId = `document_test_${sequence}`;
    const fileName = `test-document-${sequence}.pdf`;

    const file = {
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: 1024 + index,
      checksum: null,
      ...fileOverrides,
      fileName,
      storageKey: `test-only/documents/${documentId}/${fileName}`,
    };

    return createDocument({
      ...commonOverrides,
      id: documentId,
      documentNumber: `MO-DOC-TEST-${sequence}`,
      ownerId: `user_test_${sequence}`,
      applicationId: `app_test_${sequence}`,
      file,
    });
  });
}

/**
 * Create a document owned by another synthetic user.
 *
 * Useful for IDOR and cross-user access tests.
 *
 * @param {string} [ownerId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignDocument(
  ownerId = 'user_test_foreign',
  overrides = {},
) {
  assertNonEmptyString(ownerId, 'Foreign document owner ID');
  assertPlainObject(overrides, 'Foreign document overrides');

  const safeOverrides = clone(overrides, 'Foreign document overrides');

  const fileOverrides = safeOverrides.file === undefined
    ? {}
    : safeOverrides.file;

  assertPlainObject(fileOverrides, 'Foreign document file overrides');

  return createDocument({
    ...safeOverrides,
    id: 'document_test_foreign_0001',
    documentNumber: 'MO-DOC-TEST-FOREIGN-0001',
    ownerId,
    applicationId: 'app_test_foreign_0001',
    documentType: DOCUMENT_TYPES.IDENTITY_PROOF,
    visibility: 'private',
    file: {
      fileName: 'foreign-document-test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      checksum: null,
      ...fileOverrides,
      fileName: 'foreign-document-test.pdf',
      storageKey:
        'test-only/documents/document_test_foreign_0001/foreign-document-test.pdf',
    },
  });
}

/**
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');

  return {
    ...createDocumentPayload(),
    id: 'document_test_attacker_controlled',
    documentNumber: 'MO-DOC-ATTACKER-CONTROLLED',
    ownerId: 'user_test_attacker',
    status: DOCUMENT_STATUSES.VERIFIED,
    verification: {
      verifiedBy: 'user_test_attacker',
      verifiedAt: '2026-10-01T09:00:00.000Z',
      rejectionReason: null,
      expiresAt: null,
    },
    storageKey: '../../private/other-user/document.pdf',
    uploadedAt: '2000-01-01T00:00:00.000Z',
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    isAdmin: true,
    role: 'admin',
    ...clone(overrides, 'Mass-assignment overrides'),
  };
}

/**
 * Create a document with a selected workflow status.
 *
 * Status validation does not validate transition rules.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocumentWithStatus(status, overrides = {}) {
  assertDocumentStatus(status);
  assertPlainObject(overrides, 'Document status overrides');

  return createDocument({
    ...clone(overrides, 'Document status overrides'),
    status,
  });
}

/**
 * Create synthetic verified-document metadata.
 *
 * This does not represent a real verification event.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createVerifiedDocument(overrides = {}) {
  assertPlainObject(overrides, 'Verified document overrides');

  const safeOverrides = clone(overrides, 'Verified document overrides');

  const verification = mergeNestedObject(
    {
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: null,
      expiresAt: null,
    },
    safeOverrides.verification,
    'Verified document verification overrides',
  );

  return createDocument({
    ...safeOverrides,
    status: DOCUMENT_STATUSES.VERIFIED,
    verification,
  });
}

/**
 * Create synthetic rejected-document metadata.
 *
 * This does not represent a real rejection event.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRejectedDocument(overrides = {}) {
  assertPlainObject(overrides, 'Rejected document overrides');

  const safeOverrides = clone(overrides, 'Rejected document overrides');

  const verification = mergeNestedObject(
    {
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: 'Test rejection reason',
      expiresAt: null,
    },
    safeOverrides.verification,
    'Rejected document verification overrides',
  );

  return createDocument({
    ...safeOverrides,
    status: DOCUMENT_STATUSES.REJECTED,
    verification,
  });
}

/**
 * Create a synthetic upload request descriptor.
 *
 * This metadata does not create a file or storage object.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUploadDescriptor(overrides = {}) {
  assertPlainObject(overrides, 'Upload descriptor overrides');

  const descriptor = {
    ...clone(DEFAULT_UPLOAD_DESCRIPTOR, 'Default upload descriptor'),
    ...clone(overrides, 'Upload descriptor overrides'),
  };

  assertNonEmptyString(descriptor.originalName, 'Upload originalName');
  assertNonEmptyString(descriptor.mimeType, 'Upload mimeType');
  assertNonNegativeSafeInteger(descriptor.sizeBytes, 'Upload sizeBytes');
  assertDocumentType(descriptor.documentType);
  assertNonEmptyString(descriptor.applicationId, 'Upload applicationId');

  return descriptor;
}

/**
 * Create a synthetic download authorization scenario.
 *
 * expectedAllowed describes the test expectation. It does not grant access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDownloadScenario(overrides = {}) {
  assertPlainObject(overrides, 'Download scenario overrides');

  const safeOverrides = clone(overrides, 'Download scenario overrides');

  const requesterId = safeOverrides.requesterId ?? 'user_test_0001';
  const expectedAllowed = safeOverrides.expectedAllowed ?? true;

  assertNonEmptyString(requesterId, 'Download requesterId');

  if (typeof expectedAllowed !== 'boolean') {
    throw new TypeError('expectedAllowed must be a boolean');
  }

  const document = safeOverrides.document === undefined
    ? createDocument()
    : createDocument(safeOverrides.document);

  return {
    requesterId,
    expectedAllowed,
    document,
  };
}

/**
 * Create a cross-user download scenario expected to be denied.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnauthorizedDownloadScenario(overrides = {}) {
  assertPlainObject(overrides, 'Unauthorized download overrides');

  const safeOverrides = clone(
    overrides,
    'Unauthorized download overrides',
  );

  const requesterId = safeOverrides.requesterId
    ?? 'user_test_requester';

  assertNonEmptyString(
    requesterId,
    'Unauthorized download requesterId',
  );

  const documentOverrides = safeOverrides.document === undefined
    ? {}
    : safeOverrides.document;

  assertPlainObject(
    documentOverrides,
    'Unauthorized download document overrides',
  );

  const ownerId = documentOverrides.ownerId
    ?? 'user_test_foreign';

  assertNonEmptyString(ownerId, 'Foreign document owner ID');

  if (ownerId === requesterId) {
    throw new TypeError(
      'Unauthorized download scenario requires a different document owner',
    );
  }

  const document = createForeignDocument(ownerId, documentOverrides);

  return {
    requesterId,
    expectedAllowed: false,
    document,
  };
}

module.exports = {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS_VALUES,
  DOCUMENT_TYPE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_DOCUMENT,
  DEFAULT_UPLOAD_DESCRIPTOR,
  DEFAULT_VERIFICATION,
  createDocument,
  createDocumentPayload,
  createDocumentSet,
  createForeignDocument,
  createMassAssignmentPayload,
  createDocumentWithStatus,
  createVerifiedDocument,
  createRejectedDocument,
  createUploadDescriptor,
  createDownloadScenario,
  createUnauthorizedDownloadScenario,
};
