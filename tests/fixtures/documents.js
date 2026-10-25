
'use strict';

/**
 * MedOrbits -- Document Test Fixtures
 *
 * File: tests/fixtures/documents.js
 *
 * Purpose:
 *   Reusable synthetic document records for unit, integration, API,
 *   application, authorization, upload, download, and security tests.
 *
 * Security:
 *   - Uses synthetic metadata only.
 *   - Does not create files or upload content to storage.
 *   - Storage keys are test identifiers, not proof of file existence.
 *   - Ownership and permissions must be verified by the application.
 *   - Client-supplied ownership, status, verification, and storage fields
 *     must never be trusted by production request handlers.
 *   - These fixtures do not implement authorization or workflow rules.
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
  Object.values(DOCUMENT_STATUSES)
);

const DOCUMENT_TYPE_VALUES = Object.freeze(
  Object.values(DOCUMENT_TYPES)
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'documentNumber',
  'ownerId',
  'status',
  'verification',
  'storageKey',
  'uploadedAt',
  'createdAt',
  'updatedAt',
]);

const DEFAULT_DOCUMENT = Object.freeze({
  id: 'document_test_0001',
  documentNumber: 'MO-DOC-TEST-0001',
  ownerId: 'user_test_0001',
  applicationId: 'app_test_0001',
  documentType: DOCUMENT_TYPES.IDENTITY_PROOF,
  status: DOCUMENT_STATUSES.UPLOADED,
  file: Object.freeze({
    fileName: 'identity-proof-test.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    checksum: null,
    storageKey:
      'test-only/documents/document_test_0001/identity-proof-test.pdf',
  }),
  verification: Object.freeze({
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    expiresAt: null,
  }),
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

const DEFAULT_VERIFICATION = Object.freeze({
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  expiresAt: null,
});

/**
 * Validate a plain object.
 *
 * Rejects arrays, null, and objects with unexpected prototypes.
 *
 * @param {*} value
 * @param {string} [label='Value']
 * @returns {void}
 */
function assertPlainObject(value, label = 'Value') {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

/**
 * Validate a non-empty string.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

/**
 * Validate a non-negative safe integer.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative safe integer`
    );
  }
}

/**
 * Validate a supported document status.
 *
 * @param {*} status
 * @returns {void}
 */
function assertDocumentStatus(status) {
  if (!DOCUMENT_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported document status: ${status}`);
  }
}

/**
 * Validate a supported document type.
 *
 * @param {*} documentType
 * @returns {void}
 */
function assertDocumentType(documentType) {
  if (!DOCUMENT_TYPE_VALUES.includes(documentType)) {
    throw new RangeError(
      `Unsupported document type: ${documentType}`
    );
  }
}

/**
 * Recursively clone arrays and plain objects.
 *
 * Functions, dates, class instances, and other non-plain objects are
 * intentionally rejected rather than copied ambiguously.
 *
 * @param {*} value
 * @returns {*}
 */
function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone);
  }

  if (value !== null && typeof value === 'object') {
    assertPlainObject(value, 'Fixture values');

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)])
    );
  }

  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    throw new TypeError(
      'Fixture values cannot contain functions, symbols, or bigints'
    );
  }

  return value;
}

/**
 * Validate and clone nested metadata overrides.
 *
 * @param {*} value
 * @param {string} label
 * @returns {object}
 */
function cloneNestedObject(value, label) {
  assertPlainObject(value, label);
  return clone(value);
}

/**
 * Merge a nested object with a default object without sharing references.
 *
 * @param {object} defaults
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeNestedObject(defaults, overrides, label) {
  if (overrides === undefined) {
    return clone(defaults);
  }

  const clonedOverrides = cloneNestedObject(overrides, label);

  return {
    ...clone(defaults),
    ...clonedOverrides,
  };
}

/**
 * Create a fresh synthetic document record.
 *
 * Nested file and verification metadata are merged with their defaults.
 * This factory intentionally supports invalid workflow combinations for
 * negative tests; use the dedicated factories for common workflow states.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');

  const clonedOverrides = clone(overrides);

  const document = {
    ...clone(DEFAULT_DOCUMENT),
    ...clonedOverrides,
  };

  document.file = mergeNestedObject(
    DEFAULT_DOCUMENT.file,
    overrides.file,
    'Document file overrides'
  );

  document.verification = mergeNestedObject(
    DEFAULT_DOCUMENT.verification,
    overrides.verification,
    'Document verification overrides'
  );

  return document;
}

/**
 * Create a client-submittable document metadata payload.
 *
 * By default, server-managed fields are omitted. Explicit overrides are
 * retained to support mass-assignment and request-validation tests.
 *
 * The API under test must enforce its own request allowlist and access rules.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocumentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Document payload overrides');

  return {
    applicationId: DEFAULT_DOCUMENT.applicationId,
    documentType: DEFAULT_DOCUMENT.documentType,
    fileName: DEFAULT_DOCUMENT.file.fileName,
    mimeType: DEFAULT_DOCUMENT.file.mimeType,
    sizeBytes: DEFAULT_DOCUMENT.file.sizeBytes,
    ...clone(overrides),
  };
}

/**
 * Create a collection of documents with unique generated identities.
 *
 * Generated identity fields and the storage key are reserved by this
 * factory and cannot be overwritten by common overrides.
 *
 * Common fields, including status, visibility, and verification metadata,
 * may be shared across the generated collection.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createDocumentSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Document count must be an integer from 0 to 1000'
    );
  }

  assertPlainObject(overrides, 'Document set overrides');

  if (overrides.file !== undefined) {
    assertPlainObject(overrides.file, 'Document set file overrides');
  }

  const commonOverrides = clone(overrides);
  const commonFileOverrides = commonOverrides.file || {};

  delete commonOverrides.id;
  delete commonOverrides.documentNumber;
  delete commonOverrides.ownerId;
  delete commonOverrides.applicationId;
  delete commonOverrides.file;

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const documentId = `document_test_${sequence}`;
    const fileName = `test-document-${sequence}.pdf`;

    const file = {
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: 1024 + index,
      checksum: null,
      ...clone(commonFileOverrides),
      // Always reserve the generated storage key for this record.
      storageKey:
        `test-only/documents/${documentId}/${fileName}`,
    };

    return createDocument({
      ...clone(commonOverrides),
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
 * Useful for IDOR, cross-user access, and unauthorized-download tests.
 *
 * @param {string} [ownerId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignDocument(
  ownerId = 'user_test_foreign',
  overrides = {}
) {
  assertNonEmptyString(ownerId, 'Foreign document owner ID');
  assertPlainObject(overrides, 'Foreign document overrides');

  const clonedOverrides = clone(overrides);

  const fileOverrides = overrides.file === undefined
    ? {}
    : cloneNestedObject(
        overrides.file,
        'Foreign document file overrides'
      );

  return createDocument({
    ...clonedOverrides,
    // These values are reserved to make the fixture consistently foreign.
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
      storageKey:
        'test-only/documents/document_test_foreign_0001/foreign-document-test.pdf',
    },
  });
}

/**
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * The fields represent attacker-controlled input. Their presence in this
 * fixture does not make them valid API fields.
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
    verifiedBy: 'user_test_attacker',
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
    ...clone(overrides),
  };
}

/**
 * Create a document with a selected workflow status.
 *
 * This factory validates that the status is recognized, but does not
 * validate whether a transition to that status is permitted.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocumentWithStatus(status, overrides = {}) {
  assertDocumentStatus(status);
  assertPlainObject(overrides, 'Document status overrides');

  return createDocument({
    ...clone(overrides),
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

  const verificationOverrides = overrides.verification === undefined
    ? {}
    : cloneNestedObject(
        overrides.verification,
        'Verified document verification overrides'
      );

  return createDocument({
    ...clone(overrides),
    status: DOCUMENT_STATUSES.VERIFIED,
    verification: {
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: null,
      expiresAt: null,
      ...verificationOverrides,
    },
  });
}

/**
 * Create synthetic rejected-document metadata.
 *
 * This does not represent a real review or rejection event.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRejectedDocument(overrides = {}) {
  assertPlainObject(overrides, 'Rejected document overrides');

  const verificationOverrides = overrides.verification === undefined
    ? {}
    : cloneNestedObject(
        overrides.verification,
        'Rejected document verification overrides'
      );

  return createDocument({
    ...clone(overrides),
    status: DOCUMENT_STATUSES.REJECTED,
    verification: {
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: 'Test rejection reason',
      expiresAt: null,
      ...verificationOverrides,
    },
  });
}

/**
 * Create a synthetic upload request descriptor.
 *
 * Metadata only. This does not create a multipart request, a file, or a
 * storage object.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUploadDescriptor(overrides = {}) {
  assertPlainObject(overrides, 'Upload descriptor overrides');

  const descriptor = {
    ...clone(DEFAULT_UPLOAD_DESCRIPTOR),
    ...clone(overrides),
  };

  assertNonEmptyString(
    descriptor.originalName,
    'Upload originalName'
  );
  assertNonEmptyString(
    descriptor.mimeType,
    'Upload mimeType'
  );
  assertNonNegativeSafeInteger(
    descriptor.sizeBytes,
    'Upload sizeBytes'
  );
  assertDocumentType(descriptor.documentType);
  assertNonEmptyString(
    descriptor.applicationId,
    'Upload applicationId'
  );

  return descriptor;
}

/**
 * Create a synthetic download authorization scenario.
 *
 * This does not authorize a download or prove that the referenced object
 * exists. The expected result is test intent, not an access-control rule.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDownloadScenario(overrides = {}) {
  assertPlainObject(overrides, 'Download scenario overrides');

  const scenario = {
    requesterId: 'user_test_0001',
    expectedAllowed: true,
    ...clone(overrides),
  };

  assertNonEmptyString(
    scenario.requesterId,
    'Download requesterId'
  );

  if (typeof scenario.expectedAllowed !== 'boolean') {
    throw new TypeError('expectedAllowed must be a boolean');
  }

  scenario.document = overrides.document === undefined
    ? createDocument()
    : createDocument(
        cloneNestedObject(
          overrides.document,
          'Download scenario document'
        )
      );

  return scenario;
}

/**
 * Create a synthetic document that belongs to a different user than the
 * requester. Useful for testing that authorization denies cross-user access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnauthorizedDownloadScenario(overrides = {}) {
  assertPlainObject(overrides, 'Unauthorized download overrides');

  const requesterId = overrides.requesterId || 'user_test_requester';

  assertNonEmptyString(
    requesterId,
    'Unauthorized download requesterId'
  );

  const documentOverrides = overrides.document === undefined
    ? {}
    : cloneNestedObject(
        overrides.document,
        'Unauthorized download document overrides'
      );

  const foreignOwnerId = documentOverrides.ownerId || 'user_test_foreign';

  if (foreignOwnerId === requesterId) {
    throw new TypeError(
      'Unauthorized download scenario requires a different document owner'
    );
  }

  return createDownloadScenario({
    ...clone(overrides),
    requesterId,
    expectedAllowed: false,
    document: createForeignDocument(
      foreignOwnerId,
      documentOverrides
    ),
  });
}

module.exports = {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS_VALUES,
  DOCUMENT_TYPE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_DOCUMENT,
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
