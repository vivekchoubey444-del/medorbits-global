
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
 *   - Does not establish ownership, permissions, or authenticated sessions.
 *   - Does not create database records or physical files.
 *   - Does not replace production validation or authorization.
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
  Object.values(CANDIDATE_STATUSES)
);

const CANDIDATE_TYPE_VALUES = Object.freeze(
  Object.values(CANDIDATE_TYPES)
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
 * @returns {void}
 */
function assertNonEmptyString(value, label) {
  if (
    typeof value !== 'string'
    || value.trim() === ''
  ) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}

/**
 * Recursively clone fixture values.
 *
 * Supports primitives, arrays, and plain objects.
 * Rejects class instances and other non-plain object values.
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
      Object.entries(value).map(([key, item]) => [
        key,
        clone(item),
      ])
    );
  }

  return value;
}

/**
 * Clone an array of plain-object records.
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
    return clone(record);
  });
}

/**
 * Validate a candidate status.
 *
 * @param {string} status
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
 * @param {string} candidateType
 * @returns {string}
 */
function assertCandidateType(candidateType) {
  if (!CANDIDATE_TYPE_VALUES.includes(candidateType)) {
    throw new RangeError(
      `Unsupported candidate type: ${candidateType}`
    );
  }

  return candidateType;
}

/**
 * Merge profile overrides and independently clone location data.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeProfile(
  base,
  overrides,
  label = 'Profile overrides'
) {
  assertPlainObject(overrides, label);

  if (overrides.location !== undefined) {
    assertPlainObject(
      overrides.location,
      `${label}.location`
    );
  }

  return {
    ...clone(base),
    ...clone(overrides),
    location: {
      ...clone(base.location || {}),
      ...clone(overrides.location || {}),
    },
  };
}

/**
 * Merge professional details.
 *
 * Nested arrays are cloned and checked for the expected array shape.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeProfessional(
  base,
  overrides,
  label = 'Professional overrides'
) {
  assertPlainObject(overrides, label);

  const result = {
    ...clone(base),
    ...clone(overrides),
  };

  for (const field of [
    'skills',
    'preferredEmploymentTypes',
    'preferredLocations',
  ]) {
    if (result[field] !== undefined && !Array.isArray(result[field])) {
      throw new TypeError(`${label}.${field} must be an array`);
    }

    if (Array.isArray(result[field])) {
      result[field] = clone(result[field]);
    }
  }

  return result;
}

/**
 * Merge consent details.
 *
 * This helper does not establish that consent was lawfully obtained.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} [label]
 * @returns {object}
 */
function mergeConsent(
  base,
  overrides,
  label = 'Consent overrides'
) {
  assertPlainObject(overrides, label);

  return {
    ...clone(base),
    ...clone(overrides),
  };
}

/**
 * Create a fresh candidate record.
 *
 * Top-level overrides are supported. Profile and professional fields
 * are merged with defaults. Nested records and arrays are independently
 * copied to prevent mutations leaking between tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidate(overrides = {}) {
  assertPlainObject(overrides, 'Candidate overrides');

  const candidateType = overrides.candidateType
    ?? DEFAULT_CANDIDATE.candidateType;

  const status = overrides.status
    ?? DEFAULT_CANDIDATE.status;

  assertCandidateType(candidateType);
  assertCandidateStatus(status);

  const candidate = {
    ...clone(DEFAULT_CANDIDATE),
    ...clone(overrides),
    candidateType,
    status,
  };

  candidate.profile = mergeProfile(
    DEFAULT_PROFILE,
    overrides.profile === undefined ? {} : overrides.profile
  );

  candidate.professional = mergeProfessional(
    DEFAULT_PROFESSIONAL,
    overrides.professional === undefined
      ? {}
      : overrides.professional
  );

  candidate.consent = mergeConsent(
    DEFAULT_CONSENT,
    overrides.consent === undefined
      ? {}
      : overrides.consent
  );

  for (const field of [
    'education',
    'experience',
    'certifications',
  ]) {
    candidate[field] = cloneRecordArray(
      overrides[field] === undefined
        ? DEFAULT_CANDIDATE[field]
        : overrides[field],
      field
    );
  }

  if (overrides.resume === undefined || overrides.resume === null) {
    candidate.resume = overrides.resume === null
      ? null
      : clone(DEFAULT_CANDIDATE.resume);
  } else {
    assertPlainObject(overrides.resume, 'Resume metadata');
    candidate.resume = clone(overrides.resume);
  }

  return candidate;
}

/**
 * Create a normal client-submittable candidate payload.
 *
 * Server-managed fields are excluded by default:
 * id, candidateNumber, userId, status, createdAt, updatedAt.
 *
 * Explicit overrides are retained to support adversarial tests.
 * The server must enforce its own request-field allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidatePayload(overrides = {}) {
  assertPlainObject(overrides, 'Candidate payload overrides');

  const payload = {
    candidateType: DEFAULT_CANDIDATE.candidateType,
    profile: clone(DEFAULT_PROFILE),
    professional: clone(DEFAULT_PROFESSIONAL),
    education: [],
    experience: [],
    certifications: [],
    resume: null,
    consent: clone(DEFAULT_CONSENT),
    ...clone(overrides),
  };

  payload.candidateType = overrides.candidateType
    ?? DEFAULT_CANDIDATE.candidateType;

  assertCandidateType(payload.candidateType);

  payload.profile = mergeProfile(
    DEFAULT_PROFILE,
    overrides.profile === undefined ? {} : overrides.profile,
    'Profile payload overrides'
  );

  payload.professional = mergeProfessional(
    DEFAULT_PROFESSIONAL,
    overrides.professional === undefined
      ? {}
      : overrides.professional,
    'Professional payload overrides'
  );

  payload.consent = mergeConsent(
    DEFAULT_CONSENT,
    overrides.consent === undefined
      ? {}
      : overrides.consent,
    'Consent payload overrides'
  );

  for (const field of [
    'education',
    'experience',
    'certifications',
  ]) {
    payload[field] = cloneRecordArray(
      overrides[field] === undefined ? [] : overrides[field],
      field
    );
  }

  if (overrides.resume === undefined || overrides.resume === null) {
    payload.resume = overrides.resume === null ? null : null;
  } else {
    assertPlainObject(
      overrides.resume,
      'Resume payload metadata'
    );

    payload.resume = clone(overrides.resume);
  }

  return payload;
}

/**
 * Create multiple candidates with deterministic, unique identities.
 *
 * Generated ID, candidate number, user ID, default email, default phone,
 * and default last name remain unique within the set unless a caller
 * explicitly overrides those profile identity fields.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createCandidateSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > 1000
  ) {
    throw new RangeError(
      'Candidate count must be an integer from 0 to 1000'
    );
  }

  assertPlainObject(overrides, 'Candidate set overrides');

  if (overrides.profile !== undefined) {
    assertPlainObject(
      overrides.profile,
      'Candidate set profile overrides'
    );
  }

  const commonOverrides = clone(overrides);

  delete commonOverrides.id;
  delete commonOverrides.candidateNumber;
  delete commonOverrides.userId;

  const profileOverrides = commonOverrides.profile || {};
  delete commonOverrides.profile;

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');

    const profile = {
      ...clone(profileOverrides),
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
 * Useful for object-level authorization and IDOR tests.
 *
 * @param {string} [ownerId='user_test_foreign']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignCandidate(
  ownerId = 'user_test_foreign',
  overrides = {}
) {
  assertNonEmptyString(ownerId, 'Foreign candidate owner ID');
  assertPlainObject(overrides, 'Foreign candidate overrides');

  const profileOverrides = overrides.profile === undefined
    ? {}
    : clone(overrides.profile);

  assertPlainObject(
    profileOverrides,
    'Foreign candidate profile overrides'
  );

  return createCandidate({
    ...clone(overrides),
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
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * Tests should verify that the server rejects or ignores unauthorized
 * server-managed properties.
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
    ...clone(overrides),
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
    ...clone(overrides),
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
    ...clone(overrides),
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
    ...clone(overrides),
  };
}

/**
 * Create synthetic resume metadata.
 *
 * This does not create a physical file or authorize download access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createResumeMetadata(overrides = {}) {
  assertPlainObject(overrides, 'Resume overrides');

  return {
    ...clone(DEFAULT_RESUME),
    ...clone(overrides),
  };
}

/**
 * Create a candidate with a selected recruitment status.
 *
 * This helper does not validate whether a workflow transition is permitted.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidateWithStatus(status, overrides = {}) {
  assertCandidateStatus(status);
  assertPlainObject(overrides, 'Candidate status overrides');

  return createCandidate({
    ...clone(overrides),
    status,
  });
}

/**
 * Create a payload containing server-managed fields.
 *
 * Intended for testing that an API rejects or ignores fields a client
 * must not control.
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
    ...createCandidatePayload(),
    id: DEFAULT_CANDIDATE.id,
    candidateNumber: DEFAULT_CANDIDATE.candidateNumber,
    userId: DEFAULT_CANDIDATE.userId,
    status: DEFAULT_CANDIDATE.status,
    createdAt: DEFAULT_CANDIDATE.createdAt,
    updatedAt: DEFAULT_CANDIDATE.updatedAt,
    ...clone(overrides),
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
