'use strict';
/**
 * MedOrbits -- Document Test Fixtures
 *
 * File: tests/fixtures/documents.js
 *
 * Purpose:
 *   Reusable synthetic document records for unit, integration, API,
 *   application, authorization, upload, and download security tests.
 *
 * Security:
 *   - Uses synthetic metadata only.
 *   - Does not create files or upload content to storage.
 *   - Storage keys are test identifiers, not proof of file existence.
 *   - Ownership and permissions must be verified by the application.
 *   - Never trust client-supplied owner IDs, verification states, or paths.
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
/**
 * Validate a plain object.
 *
 * @param {*} value
 * @param {string} label
 */
function assertPlainObject(value, label) {
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
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}
/**
 * Recursively clone arrays and plain objects.
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
  return value;
}
/**
 * Create a fresh synthetic document record.
 *
 * Nested file and verification metadata are merged with their defaults.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');
  const document = {
    ...clone(DEFAULT_DOCUMENT),
    ...clone(overrides),
  };
  for (const field of ['file', 'verification']) {
    document[field] = overrides[field] === undefined
      ? clone(DEFAULT_DOCUMENT[field])
      : {
          ...clone(DEFAULT_DOCUMENT[field]),
          ...clone(assertNestedObject(overrides[field], `${field} overrides`)),
        };
  }
  return document;
}
/**
 * Validate a nested plain object and return it.
 *
 * @param {*} value
 * @param {string} label
 * @returns {object}
 */
function assertNestedObject(value, label) {
  assertPlainObject(value, label);
  return value;
}
/**
 * Create a client-submittable document metadata payload.
 *
 * Server-managed properties are excluded by default:
 * id, documentNumber, ownerId, status, verification, storageKey,
 * uploadedAt, createdAt, updatedAt.
 *
 * Overrides are supported for negative and security tests. The actual API
 * must enforce its own request-field allowlist and authorization rules.
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
 * Common file metadata can be overridden, but generated IDs, document
 * numbers, owners, application IDs, and storage keys remain unique.
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
    const fileName = `test-document-${sequence}.pdf`;
    const generatedStorageKey =
      `test-only/documents/document_test_${sequence}/${fileName}`;
    const file = {
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: 1024 + index,
      checksum: null,
      ...commonFileOverrides,
      storageKey: generatedStorageKey,
    };
    return createDocument({
      ...commonOverrides,
      id: `document_test_${sequence}`,
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
  return createDocument({
    ...clone(overrides),
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
      storageKey:
        'test-only/documents/document_test_foreign_0001/foreign-document-test.pdf',
      ...(overrides.file === undefined ? {} : clone(
        assertNestedObject(overrides.file, 'Foreign document file overrides')
      )),
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
 * This factory does not validate permitted workflow transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDocumentWithStatus(status, overrides = {}) {
  if (!DOCUMENT_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported document status: ${status}`);
  }
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
    : assertNestedObject(
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
      ...clone(verificationOverrides),
    },
  });
}
/**
 * Create synthetic rejected-document metadata.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createRejectedDocument(overrides = {}) {
  assertPlainObject(overrides, 'Rejected document overrides');
  const verificationOverrides = overrides.verification === undefined
    ? {}
    : assertNestedObject(
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
      ...clone(verificationOverrides),
    },
  });
}
/**
 * Create a synthetic upload request descriptor.
 *
 * Metadata only; this does not create a multipart request or a file.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUploadDescriptor(overrides = {}) {
  assertPlainObject(overrides, 'Upload descriptor overrides');
  return {
    originalName: 'test-upload.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    documentType: DOCUMENT_TYPES.IDENTITY_PROOF,
    applicationId: 'app_test_0001',
    ...clone(overrides),
  };
}
/**
 * Create a synthetic download authorization scenario.
 *
 * This does not authorize a download or prove that the referenced object
 * exists.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createDownloadScenario(overrides = {}) {
  assertPlainObject(overrides, 'Download scenario overrides');
  const scenario = {
    requesterId: 'user_test_0001',
    document: createDocument(),
    expectedAllowed: true,
    ...clone(overrides),
  };
  if (overrides.document === undefined) {
    scenario.document = createDocument();
  } else {
    assertPlainObject(overrides.document, 'Download scenario document');
    scenario.document = createDocument(overrides.document);
  }
  if (typeof scenario.expectedAllowed !== 'boolean') {
    throw new TypeError('expectedAllowed must be a boolean');
  }
  return scenario;
}
module.exports = {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  DOCUMENT_STATUS_VALUES,
  DOCUMENT_TYPE_VALUES,
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
};