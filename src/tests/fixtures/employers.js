
'use strict';

/**
 * MedOrbits -- Employer Test Fixtures
 *
 * File: tests/fixtures/employers.js
 *
 * Purpose:
 *   Reusable synthetic employer records for unit, integration, recruitment,
 *   API, authentication, authorization, multi-tenant, and security tests.
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

const EMPLOYER_VERIFICATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

const EMPLOYER_MEMBERSHIP_STATUSES = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REVOKED: 'revoked',
});

const EMPLOYER_MEMBERSHIP_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  RECRUITER: 'recruiter',
  VIEWER: 'viewer',
});

const EMPLOYER_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_STATUSES)
);

const EMPLOYER_TYPE_VALUES = Object.freeze(
  Object.values(EMPLOYER_TYPES)
);

const EMPLOYER_VERIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_VERIFICATION_STATUSES)
);

const EMPLOYER_MEMBERSHIP_STATUS_VALUES = Object.freeze(
  Object.values(EMPLOYER_MEMBERSHIP_STATUSES)
);

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

const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const MAX_CLONE_DEPTH = 50;
const MAX_FIXTURE_COUNT = 1000;

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
  role: EMPLOYER_MEMBERSHIP_ROLES.OWNER,
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
 * Validate an optional nullable string.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertOptionalString(value, label) {
  if (value !== null && value !== undefined) {
    assertNonEmptyString(value, label);
  }
}

/**
 * Validate a boolean.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

/**
 * Validate a non-negative integer.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}

/**
 * Validate an optional ISO UTC timestamp.
 *
 * @param {*} value
 * @param {string} label
 * @returns {void}
 */
function assertOptionalUtcTimestamp(value, label) {
  if (value === null || value === undefined) {
    return;
  }

  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new TypeError(`${label} must be a valid UTC ISO timestamp`);
  }
}

/**
 * Validate a supported enum value.
 *
 * @param {*} value
 * @param {string[]} values
 * @param {string} label
 * @returns {void}
 */
function assertEnumValue(value, values, label) {
  if (!values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
}

/**
 * Recursively clone JSON-like fixture values.
 *
 * Rejects circular references, accessors, dangerous property names,
 * sparse arrays, unsupported values, and excessive nesting.
 *
 * @param {*} value
 * @param {WeakSet<object>} [ancestors]
 * @param {number} [depth=0]
 * @returns {*}
 */
function clone(value, ancestors = new WeakSet(), depth = 0) {
  if (depth > MAX_CLONE_DEPTH) {
    throw new TypeError('Fixture values exceed the maximum clone depth');
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Fixture numbers must be finite');
    }

    return value;
  }

  if (
    typeof value === 'undefined' ||
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  ) {
    throw new TypeError(
      'Fixture values cannot contain undefined, functions, symbols, or bigints'
    );
  }

  if (typeof value !== 'object') {
    throw new TypeError('Unsupported fixture value');
  }

  if (ancestors.has(value)) {
    throw new TypeError('Fixture values cannot contain circular references');
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const result = [];

      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError('Fixture arrays cannot contain empty slots');
        }

        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index)
        );

        if (
          !descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ) {
          throw new TypeError('Fixture arrays cannot contain accessors');
        }

        result.push(clone(descriptor.value, ancestors, depth + 1));
      }

      const extraKeys = Reflect.ownKeys(value).filter((key) => {
        if (key === 'length') {
          return false;
        }

        return !(
          typeof key === 'string' &&
          /^(0|[1-9]\d*)$/.test(key) &&
          Number(key) < value.length
        );
      });

      if (extraKeys.length > 0) {
        throw new TypeError(
          'Fixture arrays cannot contain custom properties'
        );
      }

      return result;
    }

    assertPlainObject(value, 'Fixture values');

    const result = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        throw new TypeError('Fixture object keys must be strings');
      }

      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw new TypeError(`Unsafe fixture object key: ${key}`);
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ) {
        throw new TypeError(
          `Fixture properties cannot be accessors: ${key}`
        );
      }

      result[key] = clone(descriptor.value, ancestors, depth + 1);
    }

    return result;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Clone a nested plain object.
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

  return {
    ...clone(defaults),
    ...cloneNestedObject(overrides, label),
  };
}

/**
 * Validate an organization object.
 *
 * @param {object} organization
 * @returns {void}
 */
function validateOrganization(organization) {
  assertPlainObject(organization, 'Employer organization');

  assertNonEmptyString(organization.name, 'Organization name');
  assertNonEmptyString(organization.slug, 'Organization slug');

  assertEnumValue(
    organization.employerType,
    EMPLOYER_TYPE_VALUES,
    'employer type'
  );

  for (const field of [
    'legalName',
    'description',
    'industry',
    'companySize',
  ]) {
    assertOptionalString(organization[field], `Organization ${field}`);
  }

  if (
    organization.website !== null &&
    organization.website !== undefined
  ) {
    assertNonEmptyString(organization.website, 'Organization website');

    let parsedUrl;

    try {
      parsedUrl = new URL(organization.website);
    } catch {
      throw new TypeError('Organization website must be a valid URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new TypeError(
        'Organization website must use HTTP or HTTPS'
      );
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new TypeError(
        'Organization website must not contain URL credentials'
      );
    }
  }

  if (
    organization.yearEstablished !== null &&
    organization.yearEstablished !== undefined
  ) {
    assertNonNegativeInteger(
      organization.yearEstablished,
      'Organization yearEstablished'
    );

    if (organization.yearEstablished < 1800) {
      throw new RangeError(
        'Organization yearEstablished must be at least 1800'
      );
    }
  }
}

/**
 * Validate an employer contact object.
 *
 * @param {object} contact
 * @returns {void}
 */
function validateContact(contact) {
  assertPlainObject(contact, 'Employer contact');

  assertNonEmptyString(contact.contactName, 'Contact name');

  if (contact.email !== null && contact.email !== undefined) {
    assertNonEmptyString(contact.email, 'Contact email');

    if (
      contact.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)
    ) {
      throw new TypeError('Contact email must have a valid email format');
    }
  }

  for (const field of ['phone', 'jobTitle']) {
    assertOptionalString(contact[field], `Contact ${field}`);
  }
}

/**
 * Validate an employer address object.
 *
 * @param {object} address
 * @returns {void}
 */
function validateAddress(address) {
  assertPlainObject(address, 'Employer address');

  for (const field of [
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postalCode',
  ]) {
    assertOptionalString(address[field], `Address ${field}`);
  }

  assertNonEmptyString(address.countryCode, 'Address countryCode');

  if (!/^[A-Z]{2}$/.test(address.countryCode)) {
    throw new TypeError(
      'Address countryCode must be a two-letter uppercase code'
    );
  }
}

/**
 * Validate employer verification metadata.
 *
 * @param {object} verification
 * @returns {void}
 */
function validateVerification(verification) {
  assertPlainObject(verification, 'Employer verification');

  assertEnumValue(
    verification.status,
    EMPLOYER_VERIFICATION_STATUS_VALUES,
    'employer verification status'
  );

  assertOptionalString(verification.verifiedBy, 'Verification verifiedBy');
  assertOptionalString(
    verification.rejectionReason,
    'Verification rejectionReason'
  );

  assertOptionalUtcTimestamp(
    verification.verifiedAt,
    'Verification verifiedAt'
  );

  if (!Array.isArray(verification.documents)) {
    throw new TypeError('Verification documents must be an array');
  }

  for (const [index, document] of verification.documents.entries()) {
    assertPlainObject(document, `Verification document ${index}`);

    for (const [key, value] of Object.entries(document)) {
      assertNonEmptyString(key, 'Verification document field name');

      if (typeof value === 'string' && value.trim() === '') {
        throw new TypeError(
          `Verification document ${index} field "${key}" cannot be empty`
        );
      }
    }
  }
}

/**
 * Create a fresh synthetic employer record.
 *
 * Nested organization, contact, address, and verification fields are
 * merged independently so fixtures do not share mutable nested objects.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployer(overrides = {}) {
  assertPlainObject(overrides, 'Employer overrides');

  const input = clone(overrides);

  const employer = {
    ...clone(DEFAULT_EMPLOYER),
    ...input,
  };

  employer.organization = mergeObject(
    DEFAULT_EMPLOYER.organization,
    input.organization,
    'Organization overrides'
  );

  employer.contact = mergeObject(
    DEFAULT_EMPLOYER.contact,
    input.contact,
    'Contact overrides'
  );

  employer.address = mergeObject(
    DEFAULT_EMPLOYER.address,
    input.address,
    'Address overrides'
  );

  employer.verification = mergeObject(
    DEFAULT_EMPLOYER.verification,
    input.verification,
    'Verification overrides'
  );

  employer.verification.documents = cloneArray(
    employer.verification.documents,
    'Verification documents'
  );

  assertNonEmptyString(employer.id, 'Employer ID');
  assertNonEmptyString(employer.employerNumber, 'Employer number');
  assertNonEmptyString(employer.ownerUserId, 'Employer ownerUserId');

  assertEnumValue(
    employer.status,
    EMPLOYER_STATUS_VALUES,
    'employer status'
  );

  assertBoolean(employer.isPublished, 'Employer isPublished');

  assertOptionalUtcTimestamp(employer.createdAt, 'Employer createdAt');
  assertOptionalUtcTimestamp(employer.updatedAt, 'Employer updatedAt');

  validateOrganization(employer.organization);
  validateContact(employer.contact);
  validateAddress(employer.address);
  validateVerification(employer.verification);

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

  const input = clone(overrides);

  const payload = {
    organization: clone(DEFAULT_EMPLOYER.organization),
    contact: clone(DEFAULT_EMPLOYER.contact),
    address: clone(DEFAULT_EMPLOYER.address),
    ...input,
  };

  for (const field of ['organization', 'contact', 'address']) {
    payload[field] = mergeObject(
      DEFAULT_EMPLOYER[field],
      input[field],
      `${field} payload overrides`
    );
  }

  return payload;
}

/**
 * Create multiple employers with unique generated identities.
 *
 * Nested organization/contact overrides are supported. Generated IDs,
 * employer numbers, owner IDs, organization names/slugs, and contact emails
 * remain unique unless their corresponding nested values are explicitly
 * overridden.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createEmployerSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    count > MAX_FIXTURE_COUNT
  ) {
    throw new RangeError(
      `Employer count must be an integer from 0 to ${MAX_FIXTURE_COUNT}`
    );
  }

  assertPlainObject(overrides, 'Employer set overrides');

  const input = clone(overrides);

  for (const field of [
    'organization',
    'contact',
    'address',
    'verification',
  ]) {
    if (input[field] !== undefined) {
      assertPlainObject(input[field], `Employer set ${field} overrides`);
    }
  }

  const commonOverrides = clone(input);
  const organizationOverrides = commonOverrides.organization || {};
  const contactOverrides = commonOverrides.contact || {};

  for (const field of [
    'id',
    'employerNumber',
    'ownerUserId',
    'organization',
    'contact',
  ]) {
    delete commonOverrides[field];
  }

  return Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(4, '0');
    const number = index + 1;

    const organization = {
      ...clone(DEFAULT_EMPLOYER.organization),
      ...clone(organizationOverrides),
    };

    if (organizationOverrides.name === undefined) {
      organization.name = `Example Test Employer ${number}`;
    }

    if (organizationOverrides.slug === undefined) {
      organization.slug = `example-test-employer-${sequence}`;
    }

    if (organizationOverrides.legalName === undefined) {
      organization.legalName = `Example Test Employer ${number} Limited`;
    }

    const contact = {
      ...clone(DEFAULT_EMPLOYER.contact),
      ...clone(contactOverrides),
    };

    if (contactOverrides.contactName === undefined) {
      contact.contactName = `Test Employer Contact ${number}`;
    }

    if (contactOverrides.email === undefined) {
      contact.email = `employer${number}@example.test`;
    }

    if (contactOverrides.phone === undefined) {
      contact.phone =
        `+91000000${String(number + 100).padStart(4, '0')}`;
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
 * Reserved identity fields are applied after overrides so they cannot
 * accidentally be replaced by the caller.
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

  const input = clone(overrides);

  const organizationOverrides = input.organization === undefined
    ? {}
    : cloneNestedObject(
        input.organization,
        'Foreign organization overrides'
      );

  const contactOverrides = input.contact === undefined
    ? {}
    : cloneNestedObject(
        input.contact,
        'Foreign contact overrides'
      );

  delete input.organization;
  delete input.contact;
  delete input.id;
  delete input.employerNumber;
  delete input.ownerUserId;

  return createEmployer({
    ...input,

    id: 'employer_test_foreign_0001',
    employerNumber: 'MO-EMP-TEST-FOREIGN-0001',
    ownerUserId,

    organization: {
      ...clone(DEFAULT_EMPLOYER.organization),
      name: 'Example Foreign Test Employer',
      slug: 'example-foreign-test-employer',
      legalName: 'Example Foreign Test Employer Limited',
      employerType: EMPLOYER_TYPES.COMPANY,
      description: 'Synthetic foreign employer for security tests.',
      ...organizationOverrides,
    },

    contact: {
      ...clone(DEFAULT_EMPLOYER.contact),
      contactName: 'Foreign Test Contact',
      email: 'foreign.employer@example.test',
      phone: '+910000000199',
      ...contactOverrides,
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
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerWithStatus(status, overrides = {}) {
  assertEnumValue(status, EMPLOYER_STATUS_VALUES, 'employer status');
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

  const input = clone(overrides);

  const verificationOverrides = input.verification === undefined
    ? {}
    : cloneNestedObject(
        input.verification,
        'Verified employer verification overrides'
      );

  delete input.verification;

  return createEmployer({
    ...input,
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
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerMembership(overrides = {}) {
  assertPlainObject(overrides, 'Employer membership overrides');

  const membership = {
    ...clone(DEFAULT_MEMBERSHIP),
    ...clone(overrides),
  };

  for (const field of ['id', 'employerId', 'userId']) {
    assertNonEmptyString(membership[field], `Membership ${field}`);
  }

  assertEnumValue(
    membership.role,
    EMPLOYER_MEMBERSHIP_ROLE_VALUES,
    'employer membership role'
  );

  assertEnumValue(
    membership.status,
    EMPLOYER_MEMBERSHIP_STATUS_VALUES,
    'employer membership status'
  );

  assertOptionalString(membership.invitedBy, 'Membership invitedBy');
  assertOptionalUtcTimestamp(membership.joinedAt, 'Membership joinedAt');

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

  assertEnumValue(
    verification.status,
    EMPLOYER_VERIFICATION_STATUS_VALUES,
    'employer verification status'
  );

  assertOptionalString(verification.verifiedBy, 'Verification verifiedBy');
  assertOptionalString(
    verification.rejectionReason,
    'Verification rejectionReason'
  );

  assertOptionalUtcTimestamp(
    verification.verifiedAt,
    'Verification verifiedAt'
  );

  verification.documents = cloneArray(
    verification.documents,
    'Employer verification documents'
  );

  for (const [index, document] of verification.documents.entries()) {
    assertPlainObject(document, `Verification document ${index}`);
  }

  return verification;
}

/**
 * Create an employer membership authorization scenario.
 *
 * expectedAllowed describes the intended test outcome; it does not grant
 * or determine actual access.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createEmployerAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Employer access scenario overrides');

  const input = clone(overrides);

  const requesterId = input.requesterId === undefined
    ? DEFAULT_EMPLOYER.ownerUserId
    : input.requesterId;

  const expectedAllowed = input.expectedAllowed === undefined
    ? true
    : input.expectedAllowed;

  assertNonEmptyString(requesterId, 'Access requesterId');
  assertBoolean(expectedAllowed, 'Access expectedAllowed');

  const employer = input.employer === undefined
    ? createEmployer()
    : createEmployer(input.employer);

  const membership = input.membership === undefined ||
    input.membership === null
    ? null
    : createEmployerMembership(input.membership);

  return {
    requesterId,
    employer,
    membership,
    expectedAllowed,
  };
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

  const input = clone(overrides);

  const requesterId = input.requesterId === undefined
    ? 'user_test_requester'
    : input.requesterId;

  assertNonEmptyString(requesterId, 'Unauthorized requester ID');

  const employerOverrides = input.employer === undefined
    ? {}
    : cloneNestedObject(
        input.employer,
        'Unauthorized employer overrides'
      );

  const ownerUserId = employerOverrides.ownerUserId === undefined
    ? 'user_test_foreign_employer'
    : employerOverrides.ownerUserId;

  assertNonEmptyString(ownerUserId, 'Unauthorized employer owner ID');

  if (ownerUserId === requesterId) {
    throw new TypeError(
      'Unauthorized access scenario requires a different employer owner'
    );
  }

  delete input.employer;
  delete input.membership;
  delete input.expectedAllowed;

  return {
    requesterId,
    employer: createForeignEmployer(ownerUserId, employerOverrides),
    membership: null,
    expectedAllowed: false,
    ...input,
  };
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
