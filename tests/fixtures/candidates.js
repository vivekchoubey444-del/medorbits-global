
'use strict';

/**
 * MedOrbits -- Candidate Test Fixtures
 *
 * File: tests/fixtures/candidates.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Reusable synthetic candidate data for unit, integration, API,
 *   recruitment, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic data only.
 *   - Separates normal client payloads from server-managed fields.
 *   - Does not create database records, sessions, or physical files.
 *   - Does not establish authentication, ownership, or permissions.
 *   - Does not replace production validation or authorization.
 *
 * Module format:
 *   CommonJS.
 */

const CANDIDATE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  ACTIVE: 'active',
  UNDER_REVIEW: 'under_review',
  SHORTLISTED: 'shortlisted',
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  HIRED: 'hired',
});

const CANDIDATE_TYPES = Object.freeze({
  STUDENT: 'student',
  GRADUATE: 'graduate',
  PROFESSIONAL: 'professional',
  HEALTHCARE: 'healthcare',
  OTHER: 'other',
});

const CANDIDATE_STATUS_VALUES = Object.freeze(
  Object.values(CANDIDATE_STATUSES),
);

const CANDIDATE_TYPE_VALUES = Object.freeze(
  Object.values(CANDIDATE_TYPES),
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'candidateNumber',
  'userId',
  'status',
  'createdAt',
  'updatedAt',
]);

const DEFAULT_PROFILE = Object.freeze({
  firstName: 'Test',
  lastName: 'Candidate',
  email: 'candidate1@example.test',
  phone: '+910000000001',
  location: Object.freeze({
    city: 'Noida',
    state: 'Uttar Pradesh',
    countryCode: 'IN',
  }),
});

const DEFAULT_PROFESSIONAL = Object.freeze({
  headline: 'Test Candidate',
  summary: 'Synthetic candidate profile for automated testing.',
  skills: Object.freeze(['communication', 'research']),
  experienceYears: 0,
  highestQualification: 'bachelor',
  preferredEmploymentTypes: Object.freeze(['full_time']),
  preferredLocations: Object.freeze(['Noida']),
});

const DEFAULT_CONSENT = Object.freeze({
  dataProcessing: true,
  recruitmentContact: true,
  recordedAt: '2026-10-01T09:00:00.000Z',
});

const DEFAULT_CANDIDATE = Object.freeze({
  id: 'candidate_test_0001',
  candidateNumber: 'MO-CAND-TEST-0001',
  userId: 'user_test_0001',
  status: CANDIDATE_STATUSES.ACTIVE,
  candidateType: CANDIDATE_TYPES.GRADUATE,
  profile: DEFAULT_PROFILE,
  professional: DEFAULT_PROFESSIONAL,
  education: Object.freeze([]),
  experience: Object.freeze([]),
  certifications: Object.freeze([]),
  resume: null,
  consent: DEFAULT_CONSENT,
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});

const DEFAULT_RESUME = Object.freeze({
  id: 'resume_test_0001',
  fileName: 'candidate-resume-test.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  storageKey:
    'test-only/candidates/candidate_test_0001/resume.pdf',
  uploadedAt: '2026-10-01T08:45:00.000Z',
});

const MAX_SET_SIZE = 1000;
const MAX_DEPTH = 50;

const FORBIDDEN_KEYS = new Set([
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
 * Validate a non-empty string.
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
 * Recursively clone JSON-compatible fixture data.
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
function clone(value, label = 'Fixture value', ancestors = new WeakSet(), depth = 0) {
  if (depth > MAX_DEPTH) {
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
 * Validate and clone an array of record objects.
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
 * Validate a candidate status.
 *
 * @param {unknown} status
 * @returns {string}
 */
function assertCandidateStatus(status) {
  if (!CANDIDATE_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported candidate status: ${status}`);
  }

  return status;
}

/**
 * Validate a candidate type.
 *
 * @param {unknown} candidateType
 * @returns {string}
 */
function assertCandidateType(candidateType) {
  if (!CANDIDATE_TYPE_VALUES.includes(candidateType)) {
    throw new RangeError(`Unsupported candidate type: ${candidateType}`);
  }

  return candidateType;
}

/**
 * Merge plain-object values without retaining mutable references.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(base, overrides, label) {
  assertPlainObject(overrides, label);

  return {
    ...clone(base, `${label} defaults`),
    ...clone(overrides, label),
  };
}

/**
 * Merge profile overrides and independently clone location data.
 *
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeProfile(overrides = {}, label = 'Profile overrides') {
  assertPlainObject(overrides, label);

  const safeOverrides = clone(overrides, label);

  const base = clone(DEFAULT_PROFILE, 'Default profile');

  if (safeOverrides.location !== undefined) {
    assertPlainObject(safeOverrides.location, `${label}.location`);
  }

  return {
    ...base,
    ...safeOverrides,
    location: {
      ...base.location,
      ...clone(safeOverrides.location || {}, `${label}.location`),
    },
  };
}

/**
 * Merge professional details and validate known array fields.
 *
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeProfessional(
  overrides = {},
  label = 'Professional overrides',
) {
  const result = mergeObject(
    DEFAULT_PROFESSIONAL,
    overrides,
    label,
  );

  for (const field of [
    'skills',
    'preferredEmploymentTypes',
    'preferredLocations',
  ]) {
    if (!Array.isArray(result[field])) {
      throw new TypeError(`${label}.${field} must be an array`);
    }
  }

  return result;
}

/**
 * Merge consent metadata.
 *
 * This helper does not establish that consent was lawfully obtained.
 *
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeConsent(overrides = {}, label = 'Consent overrides') {
  return mergeObject(DEFAULT_CONSENT, overrides, label);
}

/**
 * Create a fresh candidate record.
 *
 * This represents test data, not an API request. Server-managed fields
 * may be overridden deliberately when building test records.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidate(overrides = {}) {
  assertPlainObject(overrides, 'Candidate overrides');

  const safeOverrides = clone(overrides, 'Candidate overrides');

  const candidateType = safeOverrides.candidateType
    ?? DEFAULT_CANDIDATE.candidateType;

  const status = safeOverrides.status
    ?? DEFAULT_CANDIDATE.status;

  assertCandidateType(candidateType);
  assertCandidateStatus(status);

  const candidate = {
    ...clone(DEFAULT_CANDIDATE, 'Default candidate'),
    ...safeOverrides,
    candidateType,
    status,
    profile: mergeProfile(safeOverrides.profile || {}),
    professional: mergeProfessional(safeOverrides.professional || {}),
    consent: mergeConsent(safeOverrides.consent || {}),
  };

  for (const field of ['education', 'experience', 'certifications']) {
    candidate[field] = cloneRecordArray(
      safeOverrides[field] === undefined
        ? DEFAULT_CANDIDATE[field]
        : safeOverrides[field],
      field,
    );
  }

  if (safeOverrides.resume === undefined || safeOverrides.resume === null) {
    candidate.resume = null;
  } else {
    assertPlainObject(safeOverrides.resume, 'Resume metadata');
    candidate.resume = clone(safeOverrides.resume, 'Resume metadata');
  }

  return candidate;
}

/**
 * Create a normal client-submittable candidate payload.
 *
 * Server-managed fields are omitted by default. Explicitly supplied
 * extra fields are retained so tests can exercise mass-assignment
 * defenses. Production code must independently enforce an allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidatePayload(overrides = {}) {
  assertPlainObject(overrides, 'Candidate payload overrides');

  const safeOverrides = clone(overrides, 'Candidate payload overrides');

  const payload = {
    candidateType: DEFAULT_CANDIDATE.candidateType,
    profile: mergeProfile(),
    professional: mergeProfessional(),
    education: [],
    experience: [],
    certifications: [],
    resume: null,
    consent: mergeConsent(),
    ...safeOverrides,
  };

  payload.candidateType = safeOverrides.candidateType
    ?? DEFAULT_CANDIDATE.candidateType;

  assertCandidateType(payload.candidateType);

  payload.profile = mergeProfile(
    safeOverrides.profile || {},
    'Profile payload overrides',
  );

  payload.professional = mergeProfessional(
    safeOverrides.professional || {},
    'Professional payload overrides',
  );

  payload.consent = mergeConsent(
    safeOverrides.consent || {},
    'Consent payload overrides',
  );

  for (const field of ['education', 'experience', 'certifications']) {
    payload[field] = cloneRecordArray(
      safeOverrides[field] === undefined ? [] : safeOverrides[field],
      field,
    );
  }

  if (safeOverrides.resume === undefined || safeOverrides.resume === null) {
    payload.resume = null;
  } else {
    assertPlainObject(safeOverrides.resume, 'Resume payload metadata');
    payload.resume = clone(safeOverrides.resume, 'Resume payload metadata');
  }

  return payload;
}

/**
 * Create candidates with deterministic, unique identifiers.
 *
 * Profile identity fields remain unique by default. Explicit profile
 * overrides intentionally apply to every generated candidate.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createCandidateSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > MAX_SET_SIZE
  ) {
    throw new RangeError(
      `Candidate count must be an integer from 0 to ${MAX_SET_SIZE}`,
    );
  }

  assertPlainObject(overrides, 'Candidate set overrides');

  const safeOverrides = clone(overrides, 'Candidate set overrides');

  const {
    profile: profileOverrides = {},
    id: ignoredId,
    candidateNumber: ignoredCandidateNumber,
    userId: ignoredUserId,
    ...commonOverrides
  } = safeOverrides;

  assertPlainObject(profileOverrides, 'Candidate set profile overrides');

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    const profile = {
      ...profileOverrides,
      firstName: profileOverrides.firstName ?? 'Test',
      lastName: profileOverrides.lastName ?? `Candidate${index + 1}`,
      email: profileOverrides.email
        ?? `candidate${index + 1}@example.test`,
      phone: profileOverrides.phone
        ?? `+91000000${String(index + 1).padStart(4, '0')}`,
    };

    return createCandidate({
      ...commonOverrides,
      id: `candidate_test_${sequence}`,
      candidateNumber: `MO-CAND-TEST-${sequence}`,
      userId: `user_test_${sequence}`,
      profile,
    });
  });
}

/**
 * Create a candidate owned by another synthetic user.
 *
 * Useful for IDOR and object-level authorization tests.
 *
 * @param {string} [ownerId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignCandidate(
  ownerId = 'user_test_foreign',
  overrides = {},
) {
  assertNonEmptyString(ownerId, 'Foreign candidate owner ID');
  assertPlainObject(overrides, 'Foreign candidate overrides');

  const safeOverrides = clone(overrides, 'Foreign candidate overrides');

  const profileOverrides = safeOverrides.profile || {};
  assertPlainObject(profileOverrides, 'Foreign candidate profile overrides');

  return createCandidate({
    ...safeOverrides,
    id: 'candidate_test_foreign_0001',
    candidateNumber: 'MO-CAND-TEST-FOREIGN-0001',
    userId: ownerId,
    profile: {
      firstName: 'Foreign',
      lastName: 'Candidate',
      email: 'foreign.candidate@example.test',
      phone: '+910000000099',
      ...profileOverrides,
    },
  });
}

/**
 * Create a hostile payload for mass-assignment tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createMassAssignmentPayload(overrides = {}) {
  assertPlainObject(overrides, 'Mass-assignment overrides');

  return {
    ...createCandidatePayload(),
    id: 'candidate_test_attacker_controlled',
    candidateNumber: 'MO-CAND-ATTACKER-CONTROLLED',
    userId: 'user_test_attacker',
    status: CANDIDATE_STATUSES.HIRED,
    role: 'admin',
    isAdmin: true,
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    ...clone(overrides, 'Mass-assignment overrides'),
  };
}

/**
 * Create a synthetic education record.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEducationRecord(overrides = {}) {
  assertPlainObject(overrides, 'Education overrides');

  return {
    id: 'education_test_0001',
    institutionName: 'Example Test Institute',
    qualification: 'bachelor',
    fieldOfStudy: 'Computer Science',
    startYear: 2020,
    endYear: 2024,
    currentlyStudying: false,
    ...clone(overrides, 'Education overrides'),
  };
}

/**
 * Create a synthetic employment history record.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createExperienceRecord(overrides = {}) {
  assertPlainObject(overrides, 'Experience overrides');

  return {
    id: 'experience_test_0001',
    employerName: 'Example Test Employer',
    jobTitle: 'Junior Analyst',
    employmentType: 'full_time',
    startDate: '2024-07-01',
    endDate: '2025-06-30',
    currentlyWorking: false,
    description: 'Synthetic employment record for automated testing.',
    ...clone(overrides, 'Experience overrides'),
  };
}

/**
 * Create a synthetic certification record.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCertificationRecord(overrides = {}) {
  assertPlainObject(overrides, 'Certification overrides');

  return {
    id: 'certification_test_0001',
    name: 'Example Test Certification',
    issuingOrganization: 'Example Test Organization',
    issueDate: '2025-01-01',
    expiryDate: null,
    credentialId: 'TEST-CREDENTIAL-0001',
    credentialUrl: null,
    ...clone(overrides, 'Certification overrides'),
  };
}

/**
 * Create synthetic resume metadata.
 *
 * This helper does not create a file or authorize download access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createResumeMetadata(overrides = {}) {
  assertPlainObject(overrides, 'Resume overrides');

  return {
    ...clone(DEFAULT_RESUME, 'Default resume'),
    ...clone(overrides, 'Resume overrides'),
  };
}

/**
 * Create a candidate with a selected recruitment status.
 *
 * This helper does not enforce workflow transition rules.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidateWithStatus(status, overrides = {}) {
  assertCandidateStatus(status);
  assertPlainObject(overrides, 'Candidate status overrides');

  return createCandidate({
    ...clone(overrides, 'Candidate status overrides'),
    status,
  });
}

/**
 * Create a payload containing server-managed fields.
 *
 * Intended for tests that verify unauthorized properties are rejected
 * or ignored by the API.
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
    ...createCandidatePayload(),
    id: DEFAULT_CANDIDATE.id,
    candidateNumber: DEFAULT_CANDIDATE.candidateNumber,
    userId: DEFAULT_CANDIDATE.userId,
    status: DEFAULT_CANDIDATE.status,
    createdAt: DEFAULT_CANDIDATE.createdAt,
    updatedAt: DEFAULT_CANDIDATE.updatedAt,
    ...clone(overrides, 'Server-managed field payload overrides'),
  };
}

module.exports = {
  CANDIDATE_STATUSES,
  CANDIDATE_TYPES,
  CANDIDATE_STATUS_VALUES,
  CANDIDATE_TYPE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_CANDIDATE,
  createCandidate,
  createCandidatePayload,
  createCandidateSet,
  createForeignCandidate,
  createMassAssignmentPayload,
  createEducationRecord,
  createExperienceRecord,
  createCertificationRecord,
  createResumeMetadata,
  createCandidateWithStatus,
  createServerManagedFieldPayload,
};
