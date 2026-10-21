'use strict';
/**
 * MedOrbits -- Application Test Fixtures
 *
 * File: tests/fixtures/applications.js
 *
 * Purpose:
 *   Provide reusable, deterministic synthetic application records and
 *   payloads for unit, integration, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic test data only.
 *   - Does not contain production credentials or real applicant information.
 *   - Does not treat client-supplied ownership, role, or status fields as trusted.
 *   - Does not create database records, files, sessions, or permissions.
 */
const APPLICATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  DOCUMENTS_REQUIRED: 'documents_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});
const APPLICATION_TYPES = Object.freeze({
  MBBS: 'mbbs',
  BDS: 'bds',
  BAMS: 'bams',
  BUMS: 'bums',
  PARAMEDICAL: 'paramedical',
  OTHER: 'other',
});
const APPLICATION_STATUS_VALUES = Object.freeze(
  Object.values(APPLICATION_STATUSES)
);
const APPLICATION_TYPE_VALUES = Object.freeze(
  Object.values(APPLICATION_TYPES)
);
const DEFAULT_APPLICANT = Object.freeze({
  firstName: 'Test',
  lastName: 'Applicant',
  email: 'applicant1@example.test',
  phone: '+910000000001',
});
const DEFAULT_APPLICATION = Object.freeze({
  id: 'app_test_0001',
  applicationNumber: 'MO-TEST-0001',
  userId: 'user_test_0001',
  courseId: 'course_test_mbbs',
  institutionId: 'institution_test_0001',
  applicationType: APPLICATION_TYPES.MBBS,
  status: APPLICATION_STATUSES.SUBMITTED,
  academicYear: '2026-2027',
  applicant: DEFAULT_APPLICANT,
  documents: Object.freeze([]),
  notes: null,
  submittedAt: '2026-10-01T09:00:00.000Z',
  reviewedAt: null,
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});
/**
 * Ensure a value is a plain object.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {void}
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
 * Copy a document metadata object.
 *
 * This validates the object shape, not the authenticity, safety, ownership,
 * or authorization of a real uploaded file.
 *
 * @param {object} document
 * @returns {object}
 */
function copyDocument(document) {
  assertPlainObject(document, 'Application document');
  return { ...document };
}
/**
 * Copy a document metadata array.
 *
 * @param {unknown} documents
 * @param {string} label
 * @returns {object[]}
 */
function copyDocuments(documents, label = 'Application documents') {
  if (!Array.isArray(documents)) {
    throw new TypeError(`${label} must be an array`);
  }
  return documents.map(copyDocument);
}
/**
 * Create a fresh application record.
 *
 * Overrides are shallowly applied to top-level fields. The applicant object
 * is merged independently, and the documents array is copied.
 *
 * This is a fixture factory, not a production validation or authorization
 * boundary.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplication(overrides = {}) {
  assertPlainObject(overrides, 'Application overrides');
  const applicantOverrides = overrides.applicant;
  if (applicantOverrides !== undefined) {
    assertPlainObject(applicantOverrides, 'Applicant overrides');
  }
  const application = {
    ...DEFAULT_APPLICATION,
    ...overrides,
    applicant: {
      ...DEFAULT_APPLICANT,
      ...(applicantOverrides || {}),
    },
    documents: copyDocuments(
      overrides.documents === undefined ? [] : overrides.documents
    ),
  };
  return application;
}
/**
 * Create a client-submittable application payload.
 *
 * Server-managed fields are intentionally excluded from the default payload:
 * id, applicationNumber, userId, status, reviewedAt, createdAt, updatedAt.
 *
 * Overrides are accepted to support negative and adversarial test cases.
 * Consequently, this helper does not guarantee that the returned payload
 * excludes server-managed fields if a caller explicitly supplies them.
 *
 * The server must independently allowlist accepted request fields.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationPayload(overrides = {}) {
  assertPlainObject(overrides, 'Application payload overrides');
  const applicantOverrides = overrides.applicant;
  if (applicantOverrides !== undefined) {
    assertPlainObject(applicantOverrides, 'Applicant payload overrides');
  }
  const payload = {
    courseId: DEFAULT_APPLICATION.courseId,
    institutionId: DEFAULT_APPLICATION.institutionId,
    applicationType: DEFAULT_APPLICATION.applicationType,
    academicYear: DEFAULT_APPLICATION.academicYear,
    applicant: {
      ...DEFAULT_APPLICANT,
      ...(applicantOverrides || {}),
    },
    documents: copyDocuments(
      overrides.documents === undefined ? [] : overrides.documents,
      'Application payload documents'
    ),
  };
  const { applicant, documents, ...otherOverrides } = overrides;
  return {
    ...payload,
    ...otherOverrides,
    applicant: {
      ...DEFAULT_APPLICANT,
      ...(applicant || {}),
    },
    documents: copyDocuments(
      documents === undefined ? [] : documents,
      'Application payload documents'
    ),
  };
}
/**
 * Create several applications with unique generated identifiers.
 *
 * The generated id, application number, user ID, and default applicant
 * identity are kept unique even when common overrides are provided.
 *
 * Explicit applicant overrides apply to every generated record. In that
 * case, email and other overridden fields may intentionally be shared.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createApplicationSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Application count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'Application set overrides');
  if (overrides.applicant !== undefined) {
    assertPlainObject(
      overrides.applicant,
      'Application set applicant overrides'
    );
  }
  const applicantOverrides = overrides.applicant || {};
  const otherOverrides = { ...overrides };
  delete otherOverrides.applicant;
  delete otherOverrides.id;
  delete otherOverrides.applicationNumber;
  delete otherOverrides.userId;
  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const generatedApplicant = {
      firstName: 'Test',
      lastName: `Applicant${index + 1}`,
      email: `applicant${index + 1}@example.test`,
      phone: `+91000000${String(index + 1).padStart(4, '0')}`,
      ...applicantOverrides,
    };
    return createApplication({
      ...otherOverrides,
      id: `app_test_${sequence}`,
      applicationNumber: `MO-TEST-${sequence}`,
      userId: `user_test_${sequence}`,
      applicant: generatedApplicant,
    });
  });
}
/**
 * Create an application owned by another synthetic user.
 *
 * Useful for testing insecure direct object reference (IDOR) protections
 * and object-level authorization.
 *
 * @param {string} [ownerId='user_test_other']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignApplication(
  ownerId = 'user_test_other',
  overrides = {}
) {
  if (typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TypeError(
      'Foreign application owner ID must be a non-empty string'
    );
  }
  assertPlainObject(overrides, 'Foreign application overrides');
  return createApplication({
    ...overrides,
    id: 'app_test_foreign_0001',
    applicationNumber: 'MO-TEST-FOREIGN-0001',
    userId: ownerId,
    applicant: {
      firstName: 'Foreign',
      lastName: 'Applicant',
      email: 'foreign.applicant@example.test',
      phone: '+910000000099',
      ...(overrides.applicant || {}),
    },
  });
}
/**
 * Create a deliberately hostile client payload for mass-assignment tests.
 *
 * Tests should verify that the server rejects or ignores unauthorized
 * server-managed fields rather than persisting attacker-controlled values.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');
  return {
    ...createApplicationPayload(),
    id: 'app_test_attacker_controlled',
    applicationNumber: 'MO-ATTACKER-CONTROLLED',
    userId: 'user_test_attacker',
    status: APPLICATION_STATUSES.APPROVED,
    reviewedAt: '2026-10-01T09:30:00.000Z',
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    isAdmin: true,
    role: 'admin',
    ...overrides,
  };
}
/**
 * Create synthetic document metadata.
 *
 * This does not create a file, establish ownership, or authorize access to a
 * download endpoint.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');
  return {
    id: 'document_test_0001',
    applicationId: DEFAULT_APPLICATION.id,
    ownerId: DEFAULT_APPLICATION.userId,
    documentType: 'identity_proof',
    fileName: 'identity-proof-test.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    storageKey:
      'test-only/applications/app_test_0001/identity-proof-test.pdf',
    status: 'uploaded',
    uploadedAt: '2026-10-01T08:45:00.000Z',
    ...overrides,
  };
}
/**
 * Create an application with a selected workflow status.
 *
 * This helper does not validate whether a transition is permitted.
 * Transition rules belong in the application service or domain layer.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationWithStatus(status, overrides = {}) {
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported application status: ${status}`);
  }
  assertPlainObject(overrides, 'Status overrides');
  return createApplication({
    ...overrides,
    status,
  });
}
module.exports = {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  APPLICATION_STATUS_VALUES,
  APPLICATION_TYPE_VALUES,
  DEFAULT_APPLICATION,
  createApplication,
  createApplicationPayload,
  createApplicationSet,
  createForeignApplication,
  createMassAssignmentPayload,
  createApplicationDocument,
  createApplicationWithStatus,
};