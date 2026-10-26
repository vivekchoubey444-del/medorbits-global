
'use strict';

/**
 * MedOrbits -- Application Test Fixtures
 *
 * File: tests/fixtures/applications.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Provide deterministic, reusable synthetic application records and
 *   payloads for unit, integration, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic test data only.
 *   - Never creates database records, files, sessions, or permissions.
 *   - Does not establish authentication, ownership, or authorization.
 *   - Does not replace production validation or access-control policies.
 *   - Provides adversarial payloads for negative security tests.
 *
 * Module format:
 *   CommonJS, consistent with module.exports below.
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
  Object.values(APPLICATION_STATUSES),
);

const APPLICATION_TYPE_VALUES = Object.freeze(
  Object.values(APPLICATION_TYPES),
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'applicationNumber',
  'userId',
  'status',
  'reviewedAt',
  'createdAt',
  'updatedAt',
]);

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

const MAX_APPLICATION_SET_SIZE = 1000;
const MAX_OVERRIDE_DEPTH = 50;

const RESERVED_OVERRIDE_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

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
 * Validate and copy JSON-like fixture data.
 *
 * The copy is recursive so nested objects and arrays do not retain
 * references to caller-owned mutable data.
 *
 * Only ordinary objects, arrays, strings, booleans, finite numbers,
 * and null are accepted. Functions, symbols, bigint values, dates,
 * class instances, and cyclic structures are rejected.
 *
 * @param {unknown} value
 * @param {string} label
 * @param {WeakSet<object>} [ancestors]
 * @param {number} [depth]
 * @returns {unknown}
 */
function cloneFixtureValue(
  value,
  label,
  ancestors = new WeakSet(),
  depth = 0,
) {
  if (depth > MAX_OVERRIDE_DEPTH) {
    throw new RangeError(
      `${label} exceeds the maximum nesting depth`,
    );
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
    throw new TypeError(
      `${label} contains an unsupported value type`,
    );
  }

  if (ancestors.has(value)) {
    throw new TypeError(`${label} must not contain circular references`);
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => (
        cloneFixtureValue(
          item,
          `${label}[${index}]`,
          ancestors,
          depth + 1,
        )
      ));
    }

    assertPlainObject(value, label);

    const result = Object.create(null);

    for (const key of Object.keys(value)) {
      if (RESERVED_OVERRIDE_KEYS.has(key)) {
        throw new TypeError(
          `${label} contains a prohibited property name`,
        );
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(
          `${label}.${key} must be a data property`,
        );
      }

      result[key] = cloneFixtureValue(
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
 * Copy an ordinary object into a normal object.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {object}
 */
function copyObject(value, label) {
  assertPlainObject(value, label);

  return cloneFixtureValue(value, label);
}

/**
 * Copy an array of document metadata.
 *
 * This checks fixture data shape only. It does not verify real files,
 * MIME signatures, document authenticity, ownership, or permissions.
 *
 * @param {unknown} documents
 * @param {string} [label]
 * @returns {object[]}
 */
function copyDocuments(
  documents,
  label = 'Application documents',
) {
  if (!Array.isArray(documents)) {
    throw new TypeError(`${label} must be an array`);
  }

  return documents.map((document, index) => (
    copyObject(document, `${label}[${index}]`)
  ));
}

/**
 * Validate an application type.
 *
 * @param {unknown} type
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
 * @param {unknown} status
 * @returns {string}
 */
function assertApplicationStatus(status) {
  if (!APPLICATION_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported application status: ${status}`);
  }

  return status;
}

/**
 * Validate a non-empty identifier.
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
 * Create a fresh application record.
 *
 * The record is independent of the defaults and caller-provided nested
 * data. Overrides are shallowly applied at the application level, while
 * the applicant object is merged with its default fields.
 *
 * Explicit record identifiers and server-managed values are permitted
 * here because this helper represents test records, not HTTP payloads.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplication(overrides = {}) {
  assertPlainObject(overrides, 'Application overrides');

  const safeOverrides = copyObject(
    overrides,
    'Application overrides',
  );

  if (safeOverrides.applicant !== undefined) {
    assertPlainObject(
      safeOverrides.applicant,
      'Applicant overrides',
    );
  }

  const applicationType = safeOverrides.applicationType
    ?? DEFAULT_APPLICATION.applicationType;

  const status = safeOverrides.status
    ?? DEFAULT_APPLICATION.status;

  assertApplicationType(applicationType);
  assertApplicationStatus(status);

  const applicantOverrides = safeOverrides.applicant || {};

  const applicant = {
    ...copyObject(DEFAULT_APPLICANT, 'Default applicant'),
    ...applicantOverrides,
  };

  const documents = copyDocuments(
    safeOverrides.documents === undefined
      ? []
      : safeOverrides.documents,
  );

  return {
    ...copyObject(DEFAULT_APPLICATION, 'Default application'),
    ...safeOverrides,
    applicationType,
    status,
    applicant,
    documents,
  };
}

/**
 * Create a client-submittable application payload.
 *
 * The normal payload excludes server-managed fields. Explicitly supplied
 * server-managed keys are preserved for adversarial tests, so the
 * production server must independently enforce an input allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationPayload(overrides = {}) {
  assertPlainObject(overrides, 'Application payload overrides');

  const safeOverrides = copyObject(
    overrides,
    'Application payload overrides',
  );

  if (safeOverrides.applicant !== undefined) {
    assertPlainObject(
      safeOverrides.applicant,
      'Applicant payload overrides',
    );
  }

  const applicant = {
    ...copyObject(DEFAULT_APPLICANT, 'Default applicant'),
    ...(safeOverrides.applicant || {}),
  };

  const documents = copyDocuments(
    safeOverrides.documents === undefined
      ? []
      : safeOverrides.documents,
    'Application payload documents',
  );

  const {
    applicant: ignoredApplicant,
    documents: ignoredDocuments,
    ...otherOverrides
  } = safeOverrides;

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
 * Create a set of applications with deterministic identifiers.
 *
 * Explicit overrides for generated IDs, application numbers, and user
 * IDs are ignored. Applicant overrides apply to every generated record.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createApplicationSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > MAX_APPLICATION_SET_SIZE
  ) {
    throw new RangeError(
      `Application count must be an integer from 0 to ${MAX_APPLICATION_SET_SIZE}`,
    );
  }

  assertPlainObject(overrides, 'Application set overrides');

  const safeOverrides = copyObject(
    overrides,
    'Application set overrides',
  );

  if (safeOverrides.applicant !== undefined) {
    assertPlainObject(
      safeOverrides.applicant,
      'Application set applicant overrides',
    );
  }

  const {
    applicant: applicantOverrides = {},
    id: ignoredId,
    applicationNumber: ignoredApplicationNumber,
    userId: ignoredUserId,
    ...otherOverrides
  } = safeOverrides;

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
 * Create an application owned by a different synthetic user.
 *
 * Useful for IDOR and object-level authorization tests.
 * This fixture does not enforce or establish actual authorization.
 *
 * @param {string} [ownerId='user_test_other']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignApplication(
  ownerId = 'user_test_other',
  overrides = {},
) {
  assertNonEmptyString(ownerId, 'Foreign application owner ID');
  assertPlainObject(overrides, 'Foreign application overrides');

  const safeOverrides = copyObject(
    overrides,
    'Foreign application overrides',
  );

  if (safeOverrides.applicant !== undefined) {
    assertPlainObject(
      safeOverrides.applicant,
      'Foreign application applicant overrides',
    );
  }

  return createApplication({
    ...safeOverrides,
    id: 'app_test_foreign_0001',
    applicationNumber: 'MO-TEST-FOREIGN-0001',
    userId: ownerId,
    applicant: {
      firstName: 'Foreign',
      lastName: 'Applicant',
      email: 'foreign.applicant@example.test',
      phone: '+910000000099',
      ...(safeOverrides.applicant || {}),
    },
  });
}

/**
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * The result intentionally contains server-managed and unauthorized
 * fields. It must never be treated as a trusted or validated payload.
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
    ...copyObject(overrides, 'Mass-assignment overrides'),
  };
}

/**
 * Create synthetic application document metadata.
 *
 * Does not create a physical file, verify content, establish ownership,
 * or authorize access to a download endpoint.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationDocument(overrides = {}) {
  assertPlainObject(overrides, 'Document overrides');

  return {
    ...copyObject(DEFAULT_DOCUMENT, 'Default document'),
    ...copyObject(overrides, 'Document overrides'),
  };
}

/**
 * Create an application with a selected workflow status.
 *
 * This helper does not validate whether a status transition is allowed.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createApplicationWithStatus(status, overrides = {}) {
  assertApplicationStatus(status);
  assertPlainObject(overrides, 'Status overrides');

  return createApplication({
    ...copyObject(overrides, 'Status overrides'),
    status,
  });
}

/**
 * Create a payload containing server-managed fields.
 *
 * Useful for testing that the API rejects or ignores unauthorized
 * properties. This payload is intentionally not safe for direct use
 * without server-side validation.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createServerManagedFieldPayload(overrides = {}) {
  assertPlainObject(
    overrides,
    'Server-managed field payload overrides',
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
    ...copyObject(overrides, 'Server-managed field payload overrides'),
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
