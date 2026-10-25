
'use strict';

/**
 * MedOrbits -- Application Test Fixtures
 *
 * File: tests/fixtures/applications.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Provide reusable synthetic application records and payloads for unit,
 *   integration, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic test data only.
 *   - Contains no production credentials or real applicant information.
 *   - Does not establish ownership, roles, permissions, or authentication.
 *   - Does not create database records, files, sessions, or permissions.
 *   - Does not replace production request validation or authorization.
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

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'applicationNumber',
  'userId',
  'status',
  'reviewedAt',
  'createdAt',
  'updatedAt',
]);

const DEFAULT_DOCUMENT = Object.freeze({
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
});

/**
 * Assert that a value is a plain object.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {void}
 */
function assertPlainObject(value, label) {
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
 * Copy a plain object without retaining its top-level reference.
 *
 * Fixture properties are intentionally treated as JSON-like test data.
 * This helper does not validate domain-specific field values.
 *
 * @param {object} value
 * @param {string} label
 * @returns {object}
 */
function copyObject(value, label) {
  assertPlainObject(value, label);
  return { ...value };
}

/**
 * Copy document metadata.
 *
 * Validates object shape only. It does not verify file contents,
 * authenticity, ownership, safety, or download authorization.
 *
 * @param {object} document
 * @returns {object}
 */
function copyDocument(document) {
  return copyObject(document, 'Application document');
}

/**
 * Copy an array of document metadata.
 *
 * @param {unknown} documents
 * @param {string} [label]
 * @returns {object[]}
 */
function copyDocuments(
  documents,
  label = 'Application documents'
) {
  if (!Array.isArray(documents)) {
    throw new TypeError(`${label} must be an array`);
  }

  return documents.map((document) => copyDocument(document));
}

/**
 * Validate an application type.
 *
 * @param {string} type
 * @returns {string}
 */
function assertApplicationType(type) {
  if (!APPLICATION_TYPE_VALUES.includes(type)) {
    throw new RangeError(`Unsupported application type: ${type}`);
  }

  return type;
}

/**
 * Validate an application status.
 *
 * @param {string} status
 * @returns {string}
 */
function assertApplicationStatus(status) {
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported application status: ${status}`);
  }

  return status;
}

/**
 * Create a fresh application record.
 *
 * Top-level overrides are shallowly applied. The applicant object is
 * merged separately, and documents are copied into a fresh array.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplication(overrides = {}) {
  assertPlainObject(overrides, 'Application overrides');

  if (overrides.applicant !== undefined) {
    assertPlainObject(
      overrides.applicant,
      'Applicant overrides'
    );
  }

  const applicationType = overrides.applicationType
    ?? DEFAULT_APPLICATION.applicationType;

  const status = overrides.status
    ?? DEFAULT_APPLICATION.status;

  assertApplicationType(applicationType);
  assertApplicationStatus(status);

  const applicant = {
    ...DEFAULT_APPLICANT,
    ...(overrides.applicant || {}),
  };

  const documents = copyDocuments(
    overrides.documents === undefined
      ? []
      : overrides.documents
  );

  return {
    ...DEFAULT_APPLICATION,
    ...overrides,
    applicationType,
    status,
    applicant,
    documents,
  };
}

/**
 * Create a client-submittable application payload.
 *
 * Server-managed fields are excluded from the normal payload.
 * Explicitly supplied overrides are retained to support negative,
 * adversarial, and mass-assignment tests.
 *
 * The production server must independently allowlist accepted fields.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationPayload(overrides = {}) {
  assertPlainObject(overrides, 'Application payload overrides');

  if (overrides.applicant !== undefined) {
    assertPlainObject(
      overrides.applicant,
      'Applicant payload overrides'
    );
  }

  const applicant = {
    ...DEFAULT_APPLICANT,
    ...(overrides.applicant || {}),
  };

  const documents = copyDocuments(
    overrides.documents === undefined
      ? []
      : overrides.documents,
    'Application payload documents'
  );

  const {
    applicant: ignoredApplicant,
    documents: ignoredDocuments,
    ...otherOverrides
  } = overrides;

  return {
    courseId: DEFAULT_APPLICATION.courseId,
    institutionId: DEFAULT_APPLICATION.institutionId,
    applicationType: DEFAULT_APPLICATION.applicationType,
    academicYear: DEFAULT_APPLICATION.academicYear,
    applicant,
    documents,
    ...otherOverrides,
  };
}

/**
 * Create a set of applications with deterministic, unique default IDs.
 *
 * The generated ID, application number, user ID, and default applicant
 * identity are unique within this set. Explicit applicant overrides
 * intentionally apply to every record.
 *
 * Explicit overrides for generated identifiers are ignored to preserve
 * uniqueness within the returned set.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createApplicationSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > 1000
  ) {
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

  const {
    applicant: applicantOverrides = {},
    id: ignoredId,
    applicationNumber: ignoredApplicationNumber,
    userId: ignoredUserId,
    ...otherOverrides
  } = overrides;

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    const applicant = {
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
      applicant,
    });
  });
}

/**
 * Create an application owned by another synthetic user.
 *
 * Useful for IDOR and object-level authorization tests.
 *
 * @param {string} [ownerId='user_test_other']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignApplication(
  ownerId = 'user_test_other',
  overrides = {}
) {
  if (
    typeof ownerId !== 'string'
    || ownerId.trim() === ''
  ) {
    throw new TypeError(
      'Foreign application owner ID must be a non-empty string'
    );
  }

  assertPlainObject(overrides, 'Foreign application overrides');

  if (overrides.applicant !== undefined) {
    assertPlainObject(
      overrides.applicant,
      'Foreign application applicant overrides'
    );
  }

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
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * Tests should verify that the server rejects or ignores unauthorized
 * server-managed fields rather than trusting attacker-controlled values.
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
 * Create synthetic application document metadata.
 *
 * This helper does not create a file, establish ownership, or authorize
 * access to a document or download endpoint.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');

  return {
    ...DEFAULT_DOCUMENT,
    ...overrides,
  };
}

/**
 * Create an application with a selected workflow status.
 *
 * This helper does not validate whether a status transition is permitted.
 * Transition rules belong in the application service or domain layer.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationWithStatus(status, overrides = {}) {
  assertApplicationStatus(status);
  assertPlainObject(overrides, 'Status overrides');

  return createApplication({
    ...overrides,
    status,
  });
}

/**
 * Create a payload containing explicitly supplied server-managed fields.
 *
 * Useful when a test needs to assert that such fields are not accepted.
 * Unlike createApplicationPayload(), this function does not imply that
 * the result is safe to submit.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createServerManagedFieldPayload(overrides = {}) {
  assertPlainObject(
    overrides,
    'Server-managed field payload overrides'
  );

  return {
    ...createApplicationPayload(),
    id: DEFAULT_APPLICATION.id,
    applicationNumber: DEFAULT_APPLICATION.applicationNumber,
    userId: DEFAULT_APPLICATION.userId,
    status: DEFAULT_APPLICATION.status,
    reviewedAt: DEFAULT_APPLICATION.reviewedAt,
    createdAt: DEFAULT_APPLICATION.createdAt,
    updatedAt: DEFAULT_APPLICATION.updatedAt,
    ...overrides,
  };
}

module.exports = {
  APPLICATION_STATUSES,
  APPLICATION_TYPES,
  APPLICATION_STATUS_VALUES,
  APPLICATION_TYPE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_APPLICANT,
  DEFAULT_APPLICATION,
  DEFAULT_DOCUMENT,
  createApplication,
  createApplicationPayload,
  createApplicationSet,
  createForeignApplication,
  createMassAssignmentPayload,
  createApplicationDocument,
  createApplicationWithStatus,
  createServerManagedFieldPayload,
};
