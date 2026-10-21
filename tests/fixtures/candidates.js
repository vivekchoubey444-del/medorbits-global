'use strict';
/**
 * MedOrbits -- Candidate Test Fixtures
 *
 * File: tests/fixtures/candidates.js
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
const DEFAULT_CANDIDATE = Object.freeze({
  id: 'candidate_test_0001',
  candidateNumber: 'MO-CAND-TEST-0001',
  userId: 'user_test_0001',
  status: CANDIDATE_STATUSES.ACTIVE,
  candidateType: CANDIDATE_TYPES.GRADUATE,
  profile: Object.freeze({
    firstName: 'Test',
    lastName: 'Candidate',
    email: 'candidate1@example.test',
    phone: '+910000000001',
    location: Object.freeze({
      city: 'Noida',
      state: 'Uttar Pradesh',
      countryCode: 'IN',
    }),
  }),
  professional: Object.freeze({
    headline: 'Test Candidate',
    summary: 'Synthetic candidate profile for automated testing.',
    skills: Object.freeze(['communication', 'research']),
    experienceYears: 0,
    highestQualification: 'bachelor',
    preferredEmploymentTypes: Object.freeze(['full_time']),
    preferredLocations: Object.freeze(['Noida']),
  }),
  education: Object.freeze([]),
  experience: Object.freeze([]),
  certifications: Object.freeze([]),
  resume: null,
  consent: Object.freeze({
    dataProcessing: true,
    recruitmentContact: true,
    recordedAt: '2026-10-01T09:00:00.000Z',
  }),
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});
/**
 * Validate a plain object.
 *
 * @param {unknown} value
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
 * @param {unknown} value
 * @param {string} label
 */
function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }
}
/**
 * Recursively clone fixture values.
 *
 * Supports primitives, arrays, and plain objects. Rejects class instances
 * and other non-plain object values.
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
 * Validate and clone an array of plain-object records.
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
 * Merge profile overrides while validating the nested location object.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeProfile(base, overrides, label = 'Profile overrides') {
  assertPlainObject(overrides, label);
  const result = {
    ...clone(base),
    ...clone(overrides),
  };
  if (overrides.location !== undefined) {
    assertPlainObject(overrides.location, `${label}.location`);
    result.location = {
      ...clone(base.location || {}),
      ...clone(overrides.location),
    };
  } else if (base.location !== undefined) {
    result.location = clone(base.location);
  }
  return result;
}
/**
 * Merge professional details and validate nested arrays.
 *
 * @param {object} base
 * @param {object} overrides
 * @param {string} label
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
    if (overrides[field] !== undefined) {
      if (!Array.isArray(overrides[field])) {
        throw new TypeError(`${label}.${field} must be an array`);
      }
      result[field] = clone(overrides[field]);
    }
  }
  return result;
}
/**
 * Create a fresh candidate record.
 *
 * Top-level overrides are supported. Profile and professional fields are
 * merged with their defaults. Nested records and arrays are independently
 * copied to prevent mutations leaking between tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidate(overrides = {}) {
  assertPlainObject(overrides, 'Candidate overrides');
  const candidate = {
    ...clone(DEFAULT_CANDIDATE),
    ...clone(overrides),
  };
  if (overrides.profile !== undefined) {
    candidate.profile = mergeProfile(
      DEFAULT_CANDIDATE.profile,
      overrides.profile
    );
  }
  if (overrides.professional !== undefined) {
    candidate.professional = mergeProfessional(
      DEFAULT_CANDIDATE.professional,
      overrides.professional
    );
  }
  if (overrides.consent !== undefined) {
    assertPlainObject(overrides.consent, 'Consent overrides');
    candidate.consent = {
      ...clone(DEFAULT_CANDIDATE.consent),
      ...clone(overrides.consent),
    };
  }
  for (const field of ['education', 'experience', 'certifications']) {
    candidate[field] = cloneRecordArray(
      overrides[field] === undefined
        ? DEFAULT_CANDIDATE[field]
        : overrides[field],
      field
    );
  }
  if (overrides.resume !== undefined && overrides.resume !== null) {
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
 * Overrides are intentionally supported for negative and security tests.
 * Therefore, explicitly supplied extra fields can still appear in the
 * returned object. The application must enforce its own request allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidatePayload(overrides = {}) {
  assertPlainObject(overrides, 'Candidate payload overrides');
  const payload = {
    candidateType: DEFAULT_CANDIDATE.candidateType,
    profile: clone(DEFAULT_CANDIDATE.profile),
    professional: clone(DEFAULT_CANDIDATE.professional),
    education: [],
    experience: [],
    certifications: [],
    resume: null,
    consent: clone(DEFAULT_CANDIDATE.consent),
    ...clone(overrides),
  };
  if (overrides.profile !== undefined) {
    payload.profile = mergeProfile(
      DEFAULT_CANDIDATE.profile,
      overrides.profile,
      'Profile payload overrides'
    );
  }
  if (overrides.professional !== undefined) {
    payload.professional = mergeProfessional(
      DEFAULT_CANDIDATE.professional,
      overrides.professional,
      'Professional payload overrides'
    );
  }
  if (overrides.consent !== undefined) {
    assertPlainObject(overrides.consent, 'Consent payload overrides');
    payload.consent = {
      ...clone(DEFAULT_CANDIDATE.consent),
      ...clone(overrides.consent),
    };
  }
  for (const field of ['education', 'experience', 'certifications']) {
    payload[field] = cloneRecordArray(
      overrides[field] === undefined ? [] : overrides[field],
      field
    );
  }
  if (overrides.resume !== undefined && overrides.resume !== null) {
    assertPlainObject(overrides.resume, 'Resume payload metadata');
    payload.resume = clone(overrides.resume);
  }
  return payload;
}
/**
 * Create multiple candidates with unique generated identities.
 *
 * Common overrides can customize shared attributes, but generated identity
 * fields remain unique. By default, generated names, email addresses, and
 * phone numbers are also unique.
 *
 * Explicit profile overrides take precedence for the supplied profile
 * fields; unspecified identity fields remain unique.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createCandidateSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Candidate count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'Candidate set overrides');
  if (overrides.profile !== undefined) {
    assertPlainObject(overrides.profile, 'Candidate set profile overrides');
  }
  const commonOverrides = clone(overrides);
  // Generated identity fields are controlled by this factory.
  delete commonOverrides.id;
  delete commonOverrides.candidateNumber;
  delete commonOverrides.userId;
  const profileOverrides = commonOverrides.profile || {};
  delete commonOverrides.profile;
  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const generatedProfile = {
      firstName: 'Test',
      lastName: `Candidate${index + 1}`,
      email: `candidate${index + 1}@example.test`,
      phone: `+91000000${String(index + 1).padStart(4, '0')}`,
      ...clone(profileOverrides),
    };
    if (profileOverrides.lastName === undefined) {
      generatedProfile.lastName = `Candidate${index + 1}`;
    }
    if (profileOverrides.email === undefined) {
      generatedProfile.email = `candidate${index + 1}@example.test`;
    }
    if (profileOverrides.phone === undefined) {
      generatedProfile.phone =
        `+91000000${String(index + 1).padStart(4, '0')}`;
    }
    return createCandidate({
      ...commonOverrides,
      id: `candidate_test_${sequence}`,
      candidateNumber: `MO-CAND-TEST-${sequence}`,
      userId: `user_test_${sequence}`,
      profile: generatedProfile,
    });
  });
}
/**
 * Create a candidate owned by a different synthetic user.
 *
 * Useful for testing object-level authorization and IDOR protections.
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
  const foreignProfile = {
    firstName: 'Foreign',
    lastName: 'Candidate',
    email: 'foreign.candidate@example.test',
    phone: '+910000000099',
    ...(overrides.profile === undefined
      ? {}
      : clone(overrides.profile)),
  };
  const foreignOverrides = {
    ...clone(overrides),
    id: 'candidate_test_foreign_0001',
    candidateNumber: 'MO-CAND-TEST-FOREIGN-0001',
    userId: ownerId,
    profile: foreignProfile,
  };
  // Reassert ownership after applying every caller-provided override.
  foreignOverrides.userId = ownerId;
  return createCandidate(foreignOverrides);
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
 * Create synthetic education history.
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
 * Create synthetic employment history.
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
 * This does not create a file or authorize access to a download endpoint.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createResumeMetadata(overrides = {}) {
  assertPlainObject(overrides, 'Resume overrides');
  return {
    id: 'resume_test_0001',
    fileName: 'candidate-resume-test.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    storageKey: 'test-only/candidates/candidate_test_0001/resume.pdf',
    uploadedAt: '2026-10-01T08:45:00.000Z',
    ...clone(overrides),
  };
}
/**
 * Create a candidate with a selected recruitment status.
 *
 * This helper does not validate workflow transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createCandidateWithStatus(status, overrides = {}) {
  if (!CANDIDATE_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported candidate status: ${status}`);
  }
  assertPlainObject(overrides, 'Candidate status overrides');
  return createCandidate({
    ...clone(overrides),
    status,
  });
}
module.exports = {
  CANDIDATE_STATUSES,
  CANDIDATE_TYPES,
  CANDIDATE_STATUS_VALUES,
  CANDIDATE_TYPE_VALUES,
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
};