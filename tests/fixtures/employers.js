
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
 *   - Fixtures do not persist records or enforce authorization.
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

const EMPLOYER_VERIFICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

const EMPLOYER_VERIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_VERIFICATION_STATUSES)
);

const EMPLOYER_MEMBERSHIP_STATUSES = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

const EMPLOYER_MEMBERSHIP_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_MEMBERSHIP_STATUSES)
);

const EMPLOYER_MEMBERSHIP_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  RECRUITER: 'recruiter',
  VIEWER: 'viewer',
});

const EMPLOYER_MEMBERSHIP_ROLE_VALUES = Object.freeze(
  Object.values(EMPLOYER_MEMBERSHIP_ROLES)
);

const SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'employerNumber',
  'ownerUserId',
  'status',
  'verification',
  'isPublished',
  'createdAt',
  'updatedAt',
]);

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
    status: EMPLOYER_VERIFICATION_STATUSES.PENDING,
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

const DEFAULT_MEMBERSHIP = Object.freeze({
  id: 'membership_test_0001',
  employerId: DEFAULT_EMPLOYER.id,
  userId: DEFAULT_EMPLOYER.ownerUserId,
  role: EMPLOYER_MEMBERSHIP_ROLES.RECRUITER,
  status: EMPLOYER_MEMBERSHIP_STATUSES.ACTIVE,
  invitedBy: null,
  joinedAt: '2026-10-01T09:00:00.000Z',
});

/**
 * Validate a plain object.
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
 * Validate a supported employer status.
 *
 * @param {*} status
 * @returns {void}
 */
function assertEmployerStatus(status) {
  if (!EMPLOYER_STATUS_VALUES.includes(status)) {
    throw new RangeError(`Unsupported employer status: ${status}`);
  }
}

/**
 * Validate a supported employer type.
 *
 * @param {*} employerType
 * @returns {void}
 */
function assertEmployerType(employerType) {
  if (!EMPLOYER_TYPE_VALUES.includes(employerType)) {
    throw new RangeError(
      `Unsupported employer type: ${employerType}`
    );
  }
}

/**
 * Validate a supported verification status.
 *
 * @param {*} status
 * @returns {void}
 */
function assertVerificationStatus(status) {
  if (!EMPLOYER_VERIFICATION_STATUS_VALUES.includes(status)) {
    throw new RangeError(
      `Unsupported employer verification status: ${status}`
    );
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
 * Clone and validate an array.
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
 * Clone a nested object, rejecting arrays and non-plain objects.
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
 * Merge an optional nested override with defaults.
 *
 * @param {object} defaults
 * @param {*} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(defaults, overrides, label) {
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
 * Create a fresh synthetic employer record.
 *
 * Nested organization, contact, address, and verification fields are
 * merged independently so each fixture receives its own nested objects.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployer(overrides = {}) {
  assertPlainObject(overrides, 'Employer overrides');

  const clonedOverrides = clone(overrides);

  const employer = {
    ...clone(DEFAULT_EMPLOYER),
    ...clonedOverrides,
  };

  employer.organization = mergeObject(
    DEFAULT_EMPLOYER.organization,
    overrides.organization,
    'Organization overrides'
  );

  employer.contact = mergeObject(
    DEFAULT_EMPLOYER.contact,
    overrides.contact,
    'Contact overrides'
  );

  employer.address = mergeObject(
    DEFAULT_EMPLOYER.address,
    overrides.address,
    'Address overrides'
  );

  employer.verification = mergeObject(
    DEFAULT_EMPLOYER.verification,
    overrides.verification,
    'Verification overrides'
  );

  employer.verification.documents = cloneArray(
    employer.verification.documents,
    'Verification documents'
  );

  return employer;
}

/**
 * Create a client-submittable employer registration payload.
 *
 * Server-managed fields are omitted by default. Explicit overrides are
 * retained to support negative request-validation and security tests.
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
    payload[field] = mergeObject(
      DEFAULT_EMPLOYER[field],
      overrides[field],
      `${field} payload overrides`
    );
  }

  return payload;
}

/**
 * Create multiple employers with unique generated identities.
 *
 * IDs, employer numbers, owner IDs, default organization names/slugs,
 * and default contact emails are unique unless callers explicitly provide
 * a common override for the relevant organization/contact property.
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

  for (const field of [
    'organization',
    'contact',
    'address',
    'verification',
  ]) {
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
    const number = index + 1;

    const organization = {
      ...clone(DEFAULT_EMPLOYER.organization),
      name: `Example Test Employer ${number}`,
      slug: `example-test-employer-${sequence}`,
      legalName: `Example Test Employer ${number} Limited`,
      ...clone(organizationOverrides),
    };

    // Generated values remain unique unless explicitly overridden.
    if (organizationOverrides.name === undefined) {
      organization.name = `Example Test Employer ${number}`;
    }

    if (organizationOverrides.slug === undefined) {
      organization.slug = `example-test-employer-${sequence}`;
    }

    const contact = {
      ...clone(DEFAULT_EMPLOYER.contact),
      contactName: `Test Employer Contact ${number}`,
      email: `employer${number}@example.test`,
      phone: `+91000000${String(number + 100).padStart(4, '0')}`,
      ...clone(contactOverrides),
    };

    if (contactOverrides.email === undefined) {
      contact.email = `employer${number}@example.test`;
    }

    return createEmployer({
      ...clone(commonOverrides),
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
 * Useful for IDOR and cross-tenant authorization tests.
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

  const organizationOverrides = overrides.organization === undefined
    ? {}
    : cloneNestedObject(
        overrides.organization,
        'Foreign organization overrides'
      );

  const contactOverrides = overrides.contact === undefined
    ? {}
    : cloneNestedObject(
        overrides.contact,
        'Foreign contact overrides'
      );

  const remainingOverrides = clone(overrides);

  delete remainingOverrides.organization;
  delete remainingOverrides.contact;

  return createEmployer({
    ...remainingOverrides,

    // Reserved fields keep the record identifiable as foreign.
    id: 'employer_test_foreign_0001',
    employerNumber: 'MO-EMP-TEST-FOREIGN-0001',
    ownerUserId,

    organization: {
      name: 'Example Foreign Test Employer',
      slug: 'example-foreign-test-employer',
      legalName: 'Example Foreign Test Employer Limited',
      employerType: EMPLOYER_TYPES.COMPANY,
      description: 'Synthetic foreign employer for security tests.',
      website: null,
      industry: 'healthcare',
      companySize: '1-10',
      yearEstablished: null,
      ...organizationOverrides,
    },

    contact: {
      contactName: 'Foreign Test Contact',
      email: 'foreign.employer@example.test',
      phone: '+910000000199',
      jobTitle: 'Recruitment Manager',
      ...contactOverrides,
    },
  });
}

/**
 * Create a deliberately hostile payload for mass-assignment tests.
 *
 * This fixture deliberately includes server-managed and privileged fields.
 * The application must reject or ignore unauthorized fields according to
 * its own request schema and authorization policy.
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
      status: EMPLOYER_VERIFICATION_STATUSES.VERIFIED,
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
 * This helper checks that the status is recognized but does not validate
 * permitted workflow transitions.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerWithStatus(status, overrides = {}) {
  assertEmployerStatus(status);
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
    : cloneNestedObject(
        overrides.verification,
        'Verified employer verification overrides'
      );

  const remainingOverrides = clone(overrides);
  delete remainingOverrides.verification;

  return createEmployer({
    ...remainingOverrides,
    status: EMPLOYER_STATUSES.ACTIVE,
    isPublished: true,

    verification: {
      status: EMPLOYER_VERIFICATION_STATUSES.VERIFIED,
      verifiedBy: 'user_test_reviewer',
      verifiedAt: '2026-10-02T10:00:00.000Z',
      rejectionReason: null,
      documents: [],
      ...verificationOverrides,
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

  const clonedOverrides = clone(overrides);

  return createEmployer({
    ...clonedOverrides,
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

  const membership = {
    ...clone(DEFAULT_MEMBERSHIP),
    ...clone(overrides),
  };

  for (const field of ['id', 'employerId', 'userId', 'role', 'status']) {
    assertNonEmptyString(membership[field], `Membership ${field}`);
  }

  if (!EMPLOYER_MEMBERSHIP_ROLE_VALUES.includes(membership.role)) {
    throw new RangeError(
      `Unsupported employer membership role: ${membership.role}`
    );
  }

  if (!EMPLOYER_MEMBERSHIP_STATUS_VALUES.includes(membership.status)) {
    throw new RangeError(
      `Unsupported employer membership status: ${membership.status}`
    );
  }

  return membership;
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
    status: EMPLOYER_VERIFICATION_STATUSES.PENDING,
    verifiedBy: null,
    verifiedAt: null,
    rejectionReason: null,
    documents: [],
    ...clone(overrides),
  };

  assertVerificationStatus(verification.status);

  verification.documents = cloneArray(
    verification.documents,
    'Employer verification documents'
  );

  return verification;
}

/**
 * Create a synthetic employer membership scenario for authorization tests.
 *
 * expectedAllowed records the test's intended outcome; it does not
 * determine or grant actual access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Employer access scenario overrides');

  const scenario = {
    requesterId: DEFAULT_EMPLOYER.ownerUserId,
    employer: createEmployer(),
    membership: null,
    expectedAllowed: true,
    ...clone(overrides),
  };

  assertNonEmptyString(scenario.requesterId, 'Access requesterId');

  if (typeof scenario.expectedAllowed !== 'boolean') {
    throw new TypeError('expectedAllowed must be a boolean');
  }

  scenario.employer = overrides.employer === undefined
    ? createEmployer()
    : createEmployer(
        cloneNestedObject(overrides.employer, 'Access scenario employer')
      );

  scenario.membership = overrides.membership === undefined ||
    overrides.membership === null
    ? null
    : createEmployerMembership(
        cloneNestedObject(
          overrides.membership,
          'Access scenario membership'
        )
      );

  return scenario;
}

/**
 * Create a cross-tenant scenario expected to be denied.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUnauthorizedEmployerAccessScenario(overrides = {}) {
  assertPlainObject(
    overrides,
    'Unauthorized employer access overrides'
  );

  const requesterId = overrides.requesterId || 'user_test_requester';

  assertNonEmptyString(requesterId, 'Unauthorized requester ID');

  const employerOverrides = overrides.employer === undefined
    ? {}
    : cloneNestedObject(
        overrides.employer,
        'Unauthorized employer overrides'
      );

  const ownerUserId = employerOverrides.ownerUserId ||
    'user_test_foreign_employer';

  if (ownerUserId === requesterId) {
    throw new TypeError(
      'Unauthorized access scenario requires a different employer owner'
    );
  }

  const remainingOverrides = clone(overrides);
  delete remainingOverrides.employer;
  delete remainingOverrides.membership;
  delete remainingOverrides.expectedAllowed;

  return createEmployerAccessScenario({
    ...remainingOverrides,
    requesterId,
    employer: createForeignEmployer(ownerUserId, employerOverrides),
    membership: null,
    expectedAllowed: false,
  });
}

module.exports = {
  EMPLOYER_STATUSES,
  EMPLOYER_TYPES,
  EMPLOYER_STATUS_VALUES,
  EMPLOYER_TYPE_VALUES,
  EMPLOYER_VERIFICATION_STATUSES,
  EMPLOYER_VERIFICATION_STATUS_VALUES,
  EMPLOYER_MEMBERSHIP_STATUSES,
  EMPLOYER_MEMBERSHIP_STATUS_VALUES,
  EMPLOYER_MEMBERSHIP_ROLES,
  EMPLOYER_MEMBERSHIP_ROLE_VALUES,
  SERVER_MANAGED_FIELDS,
  DEFAULT_EMPLOYER,
  DEFAULT_MEMBERSHIP,

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
  createEmployerAccessScenario,
  createUnauthorizedEmployerAccessScenario,
};
