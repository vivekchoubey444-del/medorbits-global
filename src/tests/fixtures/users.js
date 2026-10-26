
'use strict';

/**
 * MedOrbits -- User Test Fixtures
 *
 * File: tests/fixtures/users.js
 * Runtime: Node.js 20+
 *
 * Purpose:
 *   Synthetic fixtures for authentication, authorization, RBAC, IDOR,
 *   account lifecycle, verification, MFA, validation, and security tests.
 *
 * Security:
 *   - No real user data or production credentials.
 *   - Passwords are synthetic plaintext test values, never password hashes.
 *   - Principals are not signed tokens or authenticated sessions.
 *   - Fixture roles do not grant actual permissions.
 *   - Production handlers must enforce validation and authorization.
 *
 * Module format: CommonJS.
 */

const USER_ROLES = Object.freeze({
  GUEST: 'guest',
  STUDENT: 'student',
  CANDIDATE: 'candidate',
  COUNSELLOR: 'counsellor',
  EMPLOYER: 'employer',
  RECRUITER: 'recruiter',
  SUPPORT: 'support',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

const USER_STATUSES = Object.freeze({
  PENDING: 'pending',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  LOCKED: 'locked',
  DELETED: 'deleted',
});

const VERIFICATION_STATUSES = Object.freeze({
  UNVERIFIED: 'unverified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
});

const AUTH_PROVIDERS = Object.freeze({
  LOCAL: 'local',
  GOOGLE: 'google',
});

const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));
const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUSES));
const VERIFICATION_STATUS_VALUES = Object.freeze(
  Object.values(VERIFICATION_STATUSES),
);
const AUTH_PROVIDER_VALUES = Object.freeze(Object.values(AUTH_PROVIDERS));

const MAX_SET_SIZE = 1000;
const MAX_CLONE_DEPTH = 50;

const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const DEFAULT_PASSWORD = 'TestOnly!Password123';

const USER_SERVER_MANAGED_FIELDS = Object.freeze([
  'id',
  'role',
  'status',
  'emailVerified',
  'emailVerificationStatus',
  'phoneVerified',
  'authProvider',
  'failedLoginAttempts',
  'mfaEnabled',
  'createdAt',
  'updatedAt',
  'isAdmin',
  'permissions',
]);

const DEFAULT_USER = Object.freeze({
  id: 'usr_test_001',
  firstName: 'Test',
  lastName: 'Student',
  email: 'student001@example.test',
  password: DEFAULT_PASSWORD,
  role: USER_ROLES.STUDENT,
  status: USER_STATUSES.ACTIVE,
  emailVerified: true,
  emailVerificationStatus: VERIFICATION_STATUSES.VERIFIED,
  phone: null,
  phoneVerified: false,
  authProvider: AUTH_PROVIDERS.LOCAL,
  failedLoginAttempts: 0,
  mfaEnabled: false,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
});

const DEFAULT_REGISTRATION_PAYLOAD = Object.freeze({
  firstName: 'Test',
  lastName: 'Student',
  email: 'new.student@example.test',
  password: DEFAULT_PASSWORD,
  confirmPassword: DEFAULT_PASSWORD,
});

const DEFAULT_LOGIN_PAYLOAD = Object.freeze({
  email: 'student001@example.test',
  password: DEFAULT_PASSWORD,
});

const DEFAULT_PASSWORD_CHANGE_PAYLOAD = Object.freeze({
  currentPassword: DEFAULT_PASSWORD,
  newPassword: 'NewTestOnly!Password456',
  confirmPassword: 'NewTestOnly!Password456',
});

const DEFAULT_PROFILE_PAYLOAD = Object.freeze({
  firstName: 'Updated',
  lastName: 'Student',
  phone: '+910000000001',
});

/**
 * Assert that a value is a plain object.
 *
 * @param {unknown} value
 * @param {string} [label='Value']
 * @returns {void}
 */
function assertPlainObject(value, label = 'Value') {
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
 * Clone JSON-compatible fixture data without sharing references.
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
function clone(
  value,
  label = 'Fixture value',
  ancestors = new WeakSet(),
  depth = 0,
) {
  if (depth > MAX_CLONE_DEPTH) {
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

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value;
}

function assertOptionalString(value, label) {
  if (
    value !== undefined
    && value !== null
    && typeof value !== 'string'
  ) {
    throw new TypeError(`${label} must be a string or null`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be a boolean`);
  }
}

function assertEnum(value, values, label) {
  if (!values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }

  return value;
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(
      `${label} must be a non-negative safe integer`,
    );
  }

  return value;
}

/**
 * Lightweight email format validation for synthetic fixtures.
 * Production registration must perform its own validation.
 *
 * @param {unknown} value
 * @param {string} [label='Email']
 * @returns {string}
 */
function assertValidEmail(value, label = 'Email') {
  assertNonEmptyString(value, label);

  if (
    value !== value.trim()
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    throw new TypeError(`${label} must be a valid test email address`);
  }

  return value;
}

/**
 * Validate a UTC ISO timestamp.
 *
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function assertIsoDate(value, label) {
  assertNonEmptyString(value, label);

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    throw new TypeError(`${label} must be a valid UTC ISO timestamp`);
  }

  return value;
}

/**
 * Merge plain objects using independent copies.
 *
 * @param {object} defaults
 * @param {object} overrides
 * @param {string} label
 * @returns {object}
 */
function mergeObject(defaults, overrides, label) {
  assertPlainObject(overrides, label);

  return {
    ...clone(defaults, `${label} defaults`),
    ...clone(overrides, label),
  };
}

/**
 * Validate a user record.
 *
 * This validates fixture consistency, not authentication or authorization.
 *
 * @param {object} user
 * @returns {object}
 */
function validateUser(user) {
  assertNonEmptyString(user.id, 'User ID');
  assertNonEmptyString(user.firstName, 'First name');
  assertNonEmptyString(user.lastName, 'Last name');
  assertValidEmail(user.email);
  assertEnum(user.role, USER_ROLE_VALUES, 'user role');
  assertEnum(user.status, USER_STATUS_VALUES, 'user status');
  assertEnum(
    user.emailVerificationStatus,
    VERIFICATION_STATUS_VALUES,
    'email verification status',
  );
  assertEnum(user.authProvider, AUTH_PROVIDER_VALUES, 'auth provider');

  assertNonNegativeInteger(
    user.failedLoginAttempts,
    'failedLoginAttempts',
  );

  for (const field of [
    'emailVerified',
    'phoneVerified',
    'mfaEnabled',
  ]) {
    assertBoolean(user[field], field);
  }

  assertOptionalString(user.phone, 'phone');
  assertOptionalString(user.password, 'password');
  assertIsoDate(user.createdAt, 'createdAt');
  assertIsoDate(user.updatedAt, 'updatedAt');

  if (
    user.emailVerified
    && user.emailVerificationStatus !== VERIFICATION_STATUSES.VERIFIED
  ) {
    throw new RangeError(
      'emailVerified requires emailVerificationStatus to be verified',
    );
  }

  if (
    !user.emailVerified
    && user.emailVerificationStatus === VERIFICATION_STATUSES.VERIFIED
  ) {
    throw new RangeError(
      'Verified email status requires emailVerified to be true',
    );
  }

  return user;
}

/**
 * Create a fresh synthetic user record.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUser(overrides = {}) {
  assertPlainObject(overrides, 'User overrides');

  const user = mergeObject(
    DEFAULT_USER,
    overrides,
    'User overrides',
  );

  return validateUser(user);
}

/**
 * Create a synthetic registration payload.
 *
 * Extra properties are preserved for negative request-validation tests.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUserRegistrationPayload(overrides = {}) {
  assertPlainObject(overrides, 'Registration payload overrides');

  return mergeObject(
    DEFAULT_REGISTRATION_PAYLOAD,
    overrides,
    'Registration payload overrides',
  );
}

/**
 * Create a synthetic login payload.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createLoginPayload(overrides = {}) {
  assertPlainObject(overrides, 'Login payload overrides');

  return mergeObject(
    DEFAULT_LOGIN_PAYLOAD,
    overrides,
    'Login payload overrides',
  );
}

/**
 * Create a synthetic password-change payload.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createPasswordChangePayload(overrides = {}) {
  assertPlainObject(overrides, 'Password-change payload overrides');

  return mergeObject(
    DEFAULT_PASSWORD_CHANGE_PAYLOAD,
    overrides,
    'Password-change payload overrides',
  );
}

/**
 * Create a synthetic profile-update payload.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUserProfilePayload(overrides = {}) {
  assertPlainObject(overrides, 'Profile payload overrides');

  return mergeObject(
    DEFAULT_PROFILE_PAYLOAD,
    overrides,
    'Profile payload overrides',
  );
}

/**
 * Create users with deterministic, unique default IDs and emails.
 *
 * Identity fields generated by this factory cannot be overridden through
 * the common overrides object.
 *
 * @param {number} [count=3]
 * @param {object} [overrides={}]
 * @returns {object[]}
 */
function createUserSet(count = 3, overrides = {}) {
  if (
    !Number.isInteger(count)
    || count < 0
    || count > MAX_SET_SIZE
  ) {
    throw new RangeError(
      `User count must be an integer from 0 to ${MAX_SET_SIZE}`,
    );
  }

  assertPlainObject(overrides, 'User set overrides');

  const commonOverrides = clone(overrides, 'User set overrides');

  delete commonOverrides.id;
  delete commonOverrides.email;
  delete commonOverrides.firstName;

  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(3, '0');

    return createUser({
      ...commonOverrides,
      id: `usr_test_${number}`,
      email: `student${number}@example.test`,
      firstName: `Student${number}`,
    });
  });
}

/**
 * Create a user belonging to a different synthetic identity.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createForeignUser(overrides = {}) {
  assertPlainObject(overrides, 'Foreign user overrides');

  return createUser({
    id: 'usr_foreign_001',
    firstName: 'Foreign',
    lastName: 'User',
    email: 'foreign.user@example.test',
    ...clone(overrides, 'Foreign user overrides'),
  });
}

/**
 * Create a user with a selected role.
 *
 * @param {string} role
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUserWithRole(role, overrides = {}) {
  assertEnum(role, USER_ROLE_VALUES, 'user role');
  assertPlainObject(overrides, 'Role overrides');

  const normalizedRole = role.replace(/[^a-z0-9]+/gi, '.');

  return createUser({
    id: `usr_${normalizedRole}_001`,
    email: `${normalizedRole}.001@example.test`,
    ...clone(overrides, 'Role overrides'),
    role,
  });
}

/**
 * Create a user with a selected account status.
 *
 * @param {string} status
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUserWithStatus(status, overrides = {}) {
  assertEnum(status, USER_STATUS_VALUES, 'user status');
  assertPlainObject(overrides, 'Status overrides');

  return createUser({
    ...clone(overrides, 'Status overrides'),
    status,
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
    firstName: 'Modified',
    lastName: 'Account',
    role: USER_ROLES.SUPER_ADMIN,
    status: USER_STATUSES.ACTIVE,
    emailVerified: true,
    emailVerificationStatus: VERIFICATION_STATUSES.VERIFIED,
    phoneVerified: true,
    failedLoginAttempts: 0,
    mfaEnabled: false,
    isAdmin: true,
    permissions: ['*'],
    ...clone(overrides, 'Mass-assignment overrides'),
  };
}

function createAdminUser(overrides = {}) {
  assertPlainObject(overrides, 'Admin overrides');

  return createUser({
    id: 'usr_admin_001',
    firstName: 'Test',
    lastName: 'Administrator',
    email: 'admin001@example.test',
    ...clone(overrides, 'Admin overrides'),
    role: USER_ROLES.ADMIN,
  });
}

function createSuperAdminUser(overrides = {}) {
  assertPlainObject(overrides, 'Super-admin overrides');

  return createUser({
    id: 'usr_super_admin_001',
    firstName: 'Test',
    lastName: 'SuperAdmin',
    email: 'superadmin001@example.test',
    ...clone(overrides, 'Super-admin overrides'),
    role: USER_ROLES.SUPER_ADMIN,
  });
}

function createInactiveUser(overrides = {}) {
  assertPlainObject(overrides, 'Inactive user overrides');

  return createUserWithStatus(USER_STATUSES.INACTIVE, {
    id: 'usr_inactive_001',
    email: 'inactive001@example.test',
    ...clone(overrides, 'Inactive user overrides'),
  });
}

function createSuspendedUser(overrides = {}) {
  assertPlainObject(overrides, 'Suspended user overrides');

  return createUserWithStatus(USER_STATUSES.SUSPENDED, {
    id: 'usr_suspended_001',
    email: 'suspended001@example.test',
    ...clone(overrides, 'Suspended user overrides'),
  });
}

function createLockedUser(overrides = {}) {
  assertPlainObject(overrides, 'Locked user overrides');

  return createUserWithStatus(USER_STATUSES.LOCKED, {
    id: 'usr_locked_001',
    email: 'locked001@example.test',
    failedLoginAttempts: 5,
    ...clone(overrides, 'Locked user overrides'),
  });
}

function createDeletedUser(overrides = {}) {
  assertPlainObject(overrides, 'Deleted user overrides');

  return createUserWithStatus(USER_STATUSES.DELETED, {
    id: 'usr_deleted_001',
    email: 'deleted001@example.test',
    ...clone(overrides, 'Deleted user overrides'),
  });
}

function createPendingUser(overrides = {}) {
  assertPlainObject(overrides, 'Pending user overrides');

  return createUserWithStatus(USER_STATUSES.PENDING, {
    id: 'usr_pending_001',
    email: 'pending001@example.test',
    ...clone(overrides, 'Pending user overrides'),
  });
}

function createUnverifiedUser(overrides = {}) {
  assertPlainObject(overrides, 'Unverified user overrides');

  return createUser({
    id: 'usr_unverified_001',
    email: 'unverified001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.UNVERIFIED,
    ...clone(overrides, 'Unverified user overrides'),
  });
}

function createPendingVerificationUser(overrides = {}) {
  assertPlainObject(overrides, 'Pending-verification overrides');

  return createUser({
    id: 'usr_verification_pending_001',
    email: 'verification.pending001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.PENDING,
    ...clone(overrides, 'Pending-verification overrides'),
  });
}

function createRejectedVerificationUser(overrides = {}) {
  assertPlainObject(overrides, 'Rejected-verification overrides');

  return createUser({
    id: 'usr_verification_rejected_001',
    email: 'verification.rejected001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.REJECTED,
    ...clone(overrides, 'Rejected-verification overrides'),
  });
}

function createMfaEnabledUser(overrides = {}) {
  assertPlainObject(overrides, 'MFA user overrides');

  return createUser({
    id: 'usr_mfa_001',
    email: 'mfa001@example.test',
    mfaEnabled: true,
    ...clone(overrides, 'MFA user overrides'),
  });
}

function createPhoneVerifiedUser(overrides = {}) {
  assertPlainObject(overrides, 'Phone-verified overrides');

  return createUser({
    id: 'usr_phone_verified_001',
    email: 'phone.verified001@example.test',
    phone: '+910000000002',
    phoneVerified: true,
    ...clone(overrides, 'Phone-verified overrides'),
  });
}

function createGoogleUser(overrides = {}) {
  assertPlainObject(overrides, 'Google user overrides');

  return createUser({
    id: 'usr_google_001',
    email: 'google001@example.test',
    authProvider: AUTH_PROVIDERS.GOOGLE,
    ...clone(overrides, 'Google user overrides'),
  });
}

function createUserWithFailedLogins(attempts = 3, overrides = {}) {
  assertNonNegativeInteger(attempts, 'Failed login attempts');
  assertPlainObject(overrides, 'Failed-login overrides');

  return createUser({
    id: 'usr_failed_login_001',
    email: 'failed.login001@example.test',
    ...clone(overrides, 'Failed-login overrides'),
    failedLoginAttempts: attempts,
  });
}

/**
 * Create deliberately untrusted input containing protected properties.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createUntrustedUserInput(overrides = {}) {
  assertPlainObject(overrides, 'Untrusted user input overrides');

  return {
    firstName: 'Untrusted',
    lastName: 'Input',
    email: 'untrusted.input@example.test',
    password: DEFAULT_PASSWORD,
    id: 'usr_attacker_controlled',
    role: USER_ROLES.SUPER_ADMIN,
    status: USER_STATUSES.ACTIVE,
    emailVerified: true,
    emailVerificationStatus: VERIFICATION_STATUSES.VERIFIED,
    phoneVerified: true,
    failedLoginAttempts: 0,
    mfaEnabled: false,
    isAdmin: true,
    permissions: ['*'],
    ...clone(overrides, 'Untrusted user input overrides'),
  };
}

/**
 * Create a synthetic principal for authorization tests.
 *
 * This is not a signed token or authenticated session.
 *
 * @param {object} [overrides={}]
 * @returns {object}
 */
function createAuthenticatedPrincipal(overrides = {}) {
  assertPlainObject(overrides, 'Principal overrides');

  const principal = {
    id: 'usr_test_001',
    role: USER_ROLES.STUDENT,
    status: USER_STATUSES.ACTIVE,
    ...clone(overrides, 'Principal overrides'),
  };

  assertNonEmptyString(principal.id, 'Principal ID');
  assertEnum(principal.role, USER_ROLE_VALUES, 'principal role');
  assertEnum(principal.status, USER_STATUS_VALUES, 'principal status');

  return principal;
}

function createUserOwnershipScenario() {
  const owner = createUser({
    id: 'usr_owner_001',
    email: 'owner001@example.test',
  });

  const foreignUser = createForeignUser();

  return { owner, foreignUser };
}

function createUserAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'User access scenario overrides');

  const safeOverrides = clone(overrides, 'User access scenario overrides');

  const ownerOverrides = safeOverrides.owner || {};
  const foreignOverrides = safeOverrides.foreignUser || {};
  const principalOverrides = safeOverrides.principal || {};

  assertPlainObject(ownerOverrides, 'Owner overrides');
  assertPlainObject(foreignOverrides, 'Foreign user overrides');
  assertPlainObject(principalOverrides, 'Principal overrides');

  const owner = createUser({
    id: 'usr_access_owner_001',
    email: 'access.owner001@example.test',
    ...ownerOverrides,
  });

  const foreignUser = createForeignUser({
    id: 'usr_access_foreign_001',
    email: 'access.foreign001@example.test',
    ...foreignOverrides,
  });

  const principal = createAuthenticatedPrincipal({
    id: owner.id,
    role: owner.role,
    status: owner.status,
    ...principalOverrides,
  });

  return {
    owner,
    foreignUser,
    principal,
    resource: {
      id: 'resource_owned_by_access_owner_001',
      ownerId: owner.id,
    },
  };
}

function createUnauthorizedUserAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'Unauthorized access overrides');

  const scenario = createUserAccessScenario(overrides);

  return {
    ...scenario,
    principal: createAuthenticatedPrincipal({
      id: scenario.foreignUser.id,
      role: scenario.foreignUser.role,
      status: scenario.foreignUser.status,
    }),
  };
}

function createAuthorizationUsers() {
  return {
    guest: createUserWithRole(USER_ROLES.GUEST, {
      id: 'usr_auth_guest_001',
      email: 'auth.guest001@example.test',
    }),
    student: createUserWithRole(USER_ROLES.STUDENT, {
      id: 'usr_auth_student_001',
      email: 'auth.student001@example.test',
    }),
    candidate: createUserWithRole(USER_ROLES.CANDIDATE, {
      id: 'usr_auth_candidate_001',
      email: 'auth.candidate001@example.test',
    }),
    counsellor: createUserWithRole(USER_ROLES.COUNSELLOR, {
      id: 'usr_auth_counsellor_001',
      email: 'auth.counsellor001@example.test',
    }),
    employer: createUserWithRole(USER_ROLES.EMPLOYER, {
      id: 'usr_auth_employer_001',
      email: 'auth.employer001@example.test',
    }),
    recruiter: createUserWithRole(USER_ROLES.RECRUITER, {
      id: 'usr_auth_recruiter_001',
      email: 'auth.recruiter001@example.test',
    }),
    support: createUserWithRole(USER_ROLES.SUPPORT, {
      id: 'usr_auth_support_001',
      email: 'auth.support001@example.test',
    }),
    admin: createAdminUser({
      id: 'usr_auth_admin_001',
      email: 'auth.admin001@example.test',
    }),
    superAdmin: createSuperAdminUser({
      id: 'usr_auth_super_admin_001',
      email: 'auth.superadmin001@example.test',
    }),
  };
}

function createAccountStatusUsers() {
  return {
    active: createUser(),
    pending: createPendingUser(),
    inactive: createInactiveUser(),
    suspended: createSuspendedUser(),
    locked: createLockedUser(),
    deleted: createDeletedUser(),
  };
}

function createVerificationUsers() {
  return {
    verified: createUser(),
    unverified: createUnverifiedUser(),
    verificationPending: createPendingVerificationUser(),
    verificationRejected: createRejectedVerificationUser(),
    phoneVerified: createPhoneVerifiedUser(),
    mfaEnabled: createMfaEnabledUser(),
  };
}

module.exports = {
  USER_ROLES,
  USER_STATUSES,
  VERIFICATION_STATUSES,
  AUTH_PROVIDERS,

  USER_ROLE_VALUES,
  USER_STATUS_VALUES,
  VERIFICATION_STATUS_VALUES,
  AUTH_PROVIDER_VALUES,

  DEFAULT_PASSWORD,
  DEFAULT_USER,
  DEFAULT_REGISTRATION_PAYLOAD,
  DEFAULT_LOGIN_PAYLOAD,
  DEFAULT_PASSWORD_CHANGE_PAYLOAD,
  DEFAULT_PROFILE_PAYLOAD,
  USER_SERVER_MANAGED_FIELDS,

  createUser,
  createUserRegistrationPayload,
  createLoginPayload,
  createPasswordChangePayload,
  createUserProfilePayload,

  createUserSet,
  createForeignUser,
  createUserWithRole,
  createUserWithStatus,
  createMassAssignmentPayload,

  createAdminUser,
  createSuperAdminUser,
  createInactiveUser,
  createSuspendedUser,
  createLockedUser,
  createDeletedUser,
  createPendingUser,
  createUnverifiedUser,
  createPendingVerificationUser,
  createRejectedVerificationUser,
  createMfaEnabledUser,
  createPhoneVerifiedUser,
  createGoogleUser,
  createUserWithFailedLogins,

  createUntrustedUserInput,
  createAuthenticatedPrincipal,

  createUserOwnershipScenario,
  createUserAccessScenario,
  createUnauthorizedUserAccessScenario,

  createAuthorizationUsers,
  createAccountStatusUsers,
  createVerificationUsers,
};
