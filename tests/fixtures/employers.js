'use strict';
/**
 * MedOrbits -- Employer Test Fixtures
 *
 * File: tests/fixtures/employers.js
 *
 * Purpose:
 *   Reusable synthetic employer records for unit, integration, recruitment,
 *   API, authentication, authorization, and security tests.
 *
 * Security:
 *   - Uses synthetic organization data only.
 *   - Does not represent verified real-world employers.
 *   - Does not establish membership, permissions, or account ownership.
 *   - Verification and publication decisions belong to trusted server logic.
 */
const EMPLOYER_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING_VERIFICATION: 'pending_verification',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REJECTED: 'rejected',
  INACTIVE: 'inactive',
});
const EMPLOYER_TYPES = Object.freeze({
  HOSPITAL: 'hospital',
  CLINIC: 'clinic',
  HEALTHCARE_PROVIDER: 'healthcare_provider',
  EDUCATIONAL_INSTITUTION: 'educational_institution',
  RECRUITMENT_AGENCY: 'recruitment_agency',
  COMPANY: 'company',
  NON_PROFIT: 'non_profit',
  GOVERNMENT: 'government',
  OTHER: 'other',
});
const EMPLOYER_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_STATUSES)
);
const EMPLOYER_TYPE_VALUES = Object.freeze(
  Object.values(EMPLOYER_TYPES)
);
const DEFAULT_EMPLOYER = Object.freeze({
  id: 'employer_test_0001',
  employerNumber: 'MO-EMP-TEST-0001',
  ownerUserId: 'user_test_employer_0001',
  organization: Object.freeze({
    name: 'Example Test Healthcare Organization',
    slug: 'example-test-healthcare-organization',
    legalName: 'Example Test Healthcare Organization Private Limited',
    employerType: EMPLOYER_TYPES.HEALTHCARE_PROVIDER,
    description: 'Synthetic employer profile for automated testing.',
    website: null,
    industry: 'healthcare',
    companySize: '11-50',
    yearEstablished: null,
  }),
  contact: Object.freeze({
    contactName: 'Test Employer Contact',
    email: 'employer1@example.test',
    phone: '+910000000101',
    jobTitle: 'Recruitment Manager',
  }),
  address: Object.freeze({
    addressLine1: '100 Example Test Road',
    addressLine2: null,
    city: 'Noida',
    state: 'Uttar Pradesh',
    postalCode: '000000',
    countryCode: 'IN',
  }),
  verification: Object.freeze({
    status: 'pending',
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    documents: Object.freeze([]),
  }),
  status: EMPLOYER_STATUSES.PENDING_VERIFICATION,
  isPublished: false,
  createdAt: '2026-10-01T08:30:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
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
 * Merge a nested object with its defaults.
 *
 * @param {object} base
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(base, overrides, label) {
  assertPlainObject(overrides, label);
  return {
    ...clone(base),
    ...clone(overrides),
  };
}
/**
 * Create a fresh synthetic employer record.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployer(overrides = {}) {
  assertPlainObject(overrides, 'Employer overrides');
  const employer = {
    ...clone(DEFAULT_EMPLOYER),
    ...clone(overrides),
  };
  for (const field of [
    'organization',
    'contact',
    'address',
    'verification',
  ]) {
    employer[field] = overrides[field] === undefined
      ? clone(DEFAULT_EMPLOYER[field])
      : mergeObject(
          DEFAULT_EMPLOYER[field],
          overrides[field],
          `${field} overrides`
        );
  }
  employer.verification.documents = cloneArray(
    employer.verification.documents,
    'verification.documents'
  );
  return employer;
}
/**
 * Validate and clone an array.
 *
 * @param {*} value
 * @param {string} label
 * @returns {Array}
 */
function cloneArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return clone(value);
}
/**
 * Create a client-submittable employer registration payload.
 *
 * Server-managed fields are excluded by default:
 * id, employerNumber, ownerUserId, status, verification,
 * isPublished, createdAt, updatedAt.
 *
 * Explicit overrides remain available for negative security tests.
 * The server must enforce its own request-field allowlist.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerPayload(overrides = {}) {
  assertPlainObject(overrides, 'Employer payload overrides');
  const payload = {
    organization: clone(DEFAULT_EMPLOYER.organization),
    contact: clone(DEFAULT_EMPLOYER.contact),
    address: clone(DEFAULT_EMPLOYER.address),
    ...clone(overrides),
  };
  for (const field of ['organization', 'contact', 'address']) {
    payload[field] = overrides[field] === undefined
      ? clone(DEFAULT_EMPLOYER[field])
      : mergeObject(
          DEFAULT_EMPLOYER[field],
          overrides[field],
          `${field} payload overrides`
        );
  }
  return payload;
}
/**
 * Create several employers with unique generated identities.
 *
 * Generated IDs, employer numbers, owner IDs, default names, slugs,
 * and default contact emails remain unique despite common overrides.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createEmployerSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'Employer count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'Employer set overrides');
  for (const field of ['organization', 'contact']) {
    if (overrides[field] !== undefined) {
      assertPlainObject(
        overrides[field],
        `Employer set ${field} overrides`
      );
    }
  }
  const commonOverrides = clone(overrides);
  const organizationOverrides = commonOverrides.organization || {};
  const contactOverrides = commonOverrides.contact || {};
  delete commonOverrides.id;
  delete commonOverrides.employerNumber;
  delete commonOverrides.ownerUserId;
  delete commonOverrides.organization;
  delete commonOverrides.contact;
  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const organization = {
      name: `Example Test Employer ${index + 1}`,
      slug: `example-test-employer-${sequence}`,
      legalName: `Example Test Employer ${index + 1} Limited`,
      employerType: EMPLOYER_TYPES.HEALTHCARE_PROVIDER,
      description: 'Synthetic employer profile for automated testing.',
      website: null,
      industry: 'healthcare',
      companySize: '11-50',
      yearEstablished: null,
      ...clone(organizationOverrides),
    };
    if (organizationOverrides.name === undefined) {
      organization.name = `Example Test Employer ${index + 1}`;
    }
    if (organizationOverrides.slug === undefined) {
      organization.slug = `example-test-employer-${sequence}`;
    }
    const contact = {
      contactName: `Test Employer Contact ${index + 1}`,
      email: `employer${index + 1}@example.test`,
      phone: `+91000000${String(index + 101).padStart(4, '0')}`,
      jobTitle: 'Recruitment Manager',
      ...clone(contactOverrides),
    };
    if (contactOverrides.email === undefined) {
      contact.email = `employer${index + 1}@example.test`;
    }
    return createEmployer({
      ...commonOverrides,
      id: `employer_test_${sequence}`,
      employerNumber: `MO-EMP-TEST-${sequence}`,
      ownerUserId: `user_test_employer_${sequence}`,
      organization,
      contact,
    });
  });
}
/**
 * Create an employer owned by another synthetic user.
 *
 * Useful for testing cross-tenant access restrictions and IDOR protections.
 *
 * @param {string} [ownerUserId='user_test_foreign_employer']
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignEmployer(
  ownerUserId = 'user_test_foreign_employer',
  overrides = {}
) {
  assertNonEmptyString(ownerUserId, 'Foreign employer owner ID');
  assertPlainObject(overrides, 'Foreign employer overrides');
  const organization = {
    name: 'Example Foreign Test Employer',
    slug: 'example-foreign-test-employer',
    legalName: 'Example Foreign Test Employer Limited',
    employerType: EMPLOYER_TYPES.COMPANY,
    description: 'Synthetic foreign employer for security tests.',
    website: null,
    industry: 'healthcare',
    companySize: '1-10',
    yearEstablished: null,
    ...(overrides.organization === undefined
      ? {}
      : clone(assertObject(overrides.organization, 'Foreign organization overrides'))),
  };
  const contact = {
    contactName: 'Foreign Test Contact',
    email: 'foreign.employer@example.test',
    phone: '+910000000199',
    jobTitle: 'Recruitment Manager',
    ...(overrides.contact === undefined
      ? {}
      : clone(assertObject(overrides.contact, 'Foreign contact overrides'))),
  };
  const remainingOverrides = { ...clone(overrides) };
  delete remainingOverrides.organization;
  delete remainingOverrides.contact;
  return createEmployer({
    ...remainingOverrides,
    id: 'employer_test_foreign_0001',
    employerNumber: 'MO-EMP-TEST-FOREIGN-0001',
    ownerUserId,
    organization,
    contact,
  });
}
/**
 * Validate a nested object.
 *
 * @param {*} value
 * @param {string} label
 * @returns {object}
 */
function assertObject(value, label) {
  assertPlainObject(value, label);
  return value;
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
    ...createEmployerPayload(),
    id: 'employer_test_attacker_controlled',
    employerNumber: 'MO-EMP-ATTACKER-CONTROLLED',
    ownerUserId: 'user_test_attacker',
    status: EMPLOYER_STATUSES.ACTIVE,
    isPublished: true,
    isAdmin: true,
    role: 'admin',
    verification: {
      status: 'verified',
      verifiedBy: 'user_test_attacker',
      verifiedAt: '2026-10-01T09:00:00.000Z',
      rejectionReason: null,
      documents: [],
    },
    createdAt: '2000-01-01T00:00:00.000Z',
    updatedAt: '2000-01-01T00:00:00.000Z',
    ...clone(overrides),
  };
}
/**
 * Create an employer with a selected account status.
 *
 * This helper does not validate permitted status transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerWithStatus(status, overrides = {}) {
  if (!EMPLOYER_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported employer status: ${status}`);
  }
  assertPlainObject(overrides, 'Employer status overrides');
  return createEmployer({
    ...clone(overrides),
    status,
  });
}
/**
 * Create synthetic verified-employer metadata.
 *
 * This is a test state, not evidence of real-world verification.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createVerifiedEmployer(overrides = {}) {
  assertPlainObject(overrides, 'Verified employer overrides');
  const verificationOverrides = overrides.verification === undefined
    ? {}
    : assertObject(
        overrides.verification,
        'Verified employer verification overrides'
      );
  const remainingOverrides = { ...clone(overrides) };
  delete remainingOverrides.verification;
  return createEmployer({
    ...remainingOverrides,
    status: EMPLOYER_STATUSES.ACTIVE,
    isPublished: true,
    verification: {
      status: 'verified',
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: null,
      documents: [],
      ...clone(verificationOverrides),
    },
  });
}
/**
 * Create a synthetic suspended employer.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createSuspendedEmployer(overrides = {}) {
  assertPlainObject(overrides, 'Suspended employer overrides');
  return createEmployer({
    ...clone(overrides),
    id: 'employer_test_suspended_0001',
    employerNumber: 'MO-EMP-TEST-SUSPENDED-0001',
    status: EMPLOYER_STATUSES.SUSPENDED,
    isPublished: false,
  });
}
/**
 * Create synthetic employer membership metadata.
 *
 * This fixture does not establish actual membership or permissions.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerMembership(overrides = {}) {
  assertPlainObject(overrides, 'Employer membership overrides');
  return {
    id: 'membership_test_0001',
    employerId: DEFAULT_EMPLOYER.id,
    userId: DEFAULT_EMPLOYER.ownerUserId,
    role: 'recruiter',
    status: 'active',
    invitedBy: null,
    joinedAt: '2026-10-01T09:00:00.000Z',
    ...clone(overrides),
  };
}
/**
 * Create synthetic employer verification metadata.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerVerification(overrides = {}) {
  assertPlainObject(overrides, 'Employer verification overrides');
  const verification = {
    status: 'pending',
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    documents: [],
    ...clone(overrides),
  };
  verification.documents = cloneArray(
    verification.documents,
    'Employer verification documents'
  );
  return verification;
}
module.exports = {
  EMPLOYER_STATUSES,
  EMPLOYER_TYPES,
  EMPLOYER_STATUS_VALUES,
  EMPLOYER_TYPE_VALUES,
  DEFAULT_EMPLOYER,
  createEmployer,
  createEmployerPayload,
  createEmployerSet,
  createForeignEmployer,
  createMassAssignmentPayload,
  createEmployerWithStatus,
  createVerifiedEmployer,
  createSuspendedEmployer,
  createEmployerMembership,
  createEmployerVerification,
};