
'use strict';

/**
 * MedOrbits -- User Test Fixtures
 *
 * File: tests/fixtures/users.js
 *
 * Synthetic fixtures for:
 * - Authentication and authorization
 * - RBAC and privilege escalation
 * - IDOR and ownership checks
 * - Account lifecycle and verification
 * - MFA and failed-login handling
 * - Registration, login, and profile validation
 * - Mass assignment and untrusted input
 *
 * Security notes:
 * - These fixtures do not authenticate users.
 * - Passwords are synthetic test values, not password hashes.
 * - Principals are not signed tokens or verified sessions.
 * - Fixture roles do not grant real permissions.
 * - Never use these fixtures as production account data.
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
  Object.values(VERIFICATION_STATUSES)
);
const AUTH_PROVIDER_VALUES = Object.freeze(Object.values(AUTH_PROVIDERS));

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

  return value;
}

/**
 * Clone arrays and plain objects without sharing mutable references.
 * Reject non-plain objects to keep fixture data predictable.
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

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${label} must be a non-empty string`);
  }

  return value;
}

function assertOptionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== 'string') {
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
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }

  return value;
}

function assertValidEmail(value, label = 'Email') {
  assertNonEmptyString(value, label);

  // Deliberately lightweight fixture validation, not full RFC validation.
  if (
    value !== value.trim() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  ) {
    throw new TypeError(`${label} must be a valid test email address`);
  }

  return value;
}

function assertIsoDate(value, label) {
  assertNonEmptyString(value, label);

  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new TypeError(`${label} must be a valid UTC ISO timestamp`);
  }

  return value;
}

function mergeObject(defaults, overrides, label) {
  assertPlainObject(overrides, label);

  return {
    ...clone(defaults),
    ...clone(overrides),
  };
}

function createUser(overrides = {}) {
  assertPlainObject(overrides, 'User overrides');

  const user = mergeObject(DEFAULT_USER, overrides, 'User overrides');

  assertNonEmptyString(user.id, 'User ID');
  assertNonEmptyString(user.firstName, 'First name');
  assertNonEmptyString(user.lastName, 'Last name');
  assertValidEmail(user.email);
  assertEnum(user.role, USER_ROLE_VALUES, 'user role');
  assertEnum(user.status, USER_STATUS_VALUES, 'user status');
  assertEnum(
    user.emailVerificationStatus,
    VERIFICATION_STATUS_VALUES,
    'email verification status'
  );
  assertEnum(user.authProvider, AUTH_PROVIDER_VALUES, 'auth provider');

  assertNonNegativeInteger(
    user.failedLoginAttempts,
    'failedLoginAttempts'
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
    user.emailVerified &&
    user.emailVerificationStatus !== VERIFICATION_STATUSES.VERIFIED
  ) {
    throw new RangeError(
      'emailVerified cannot be true unless emailVerificationStatus is verified'
    );
  }

  if (
    !user.emailVerified &&
    user.emailVerificationStatus === VERIFICATION_STATUSES.VERIFIED
  ) {
    throw new RangeError(
      'A verified email status requires emailVerified to be true'
    );
  }

  return user;
}

function createUserRegistrationPayload(overrides = {}) {
  return mergeObject(
    DEFAULT_REGISTRATION_PAYLOAD,
    overrides,
    'Registration payload overrides'
  );
}

function createLoginPayload(overrides = {}) {
  return mergeObject(
    DEFAULT_LOGIN_PAYLOAD,
    overrides,
    'Login payload overrides'
  );
}

function createPasswordChangePayload(overrides = {}) {
  return mergeObject(
    DEFAULT_PASSWORD_CHANGE_PAYLOAD,
    overrides,
    'Password-change payload overrides'
  );
}

function createUserProfilePayload(overrides = {}) {
  return mergeObject(
    DEFAULT_PROFILE_PAYLOAD,
    overrides,
    'Profile payload overrides'
  );
}

/**
 * Create users with deterministic, unique IDs and emails.
 * Generated identity fields cannot be overridden by common overrides.
 */
function createUserSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError('User count must be an integer from 0 to 1000');
  }

  assertPlainObject(overrides, 'User set overrides');

  const commonOverrides = clone(overrides);
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

function createForeignUser(overrides = {}) {
  assertPlainObject(overrides, 'Foreign user overrides');

  return createUser({
    id: 'usr_foreign_001',
    firstName: 'Foreign',
    lastName: 'User',
    email: 'foreign.user@example.test',
    ...clone(overrides),
  });
}

function createUserWithRole(role, overrides = {}) {
  assertEnum(role, USER_ROLE_VALUES, 'user role');
  assertPlainObject(overrides, 'Role overrides');

  const normalizedRole = role.replace(/[^a-z0-9]+/gi, '.');

  return createUser({
    id: `usr_${normalizedRole}_001`,
    email: `${normalizedRole}.001@example.test`,
    ...clone(overrides),
    role,
  });
}

function createUserWithStatus(status, overrides = {}) {
  assertEnum(status, USER_STATUS_VALUES, 'user status');
  assertPlainObject(overrides, 'Status overrides');

  return createUser({
    ...clone(overrides),
    status,
  });
}

/**
 * Deliberately hostile payload for mass-assignment tests.
 * Do not use as a valid user record or registration payload.
 */
function createMassAssignmentPayload(overrides = {}) {
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
    ...clone(assertPlainObject(overrides, 'Mass-assignment overrides')),
  };
}

function createAdminUser(overrides = {}) {
  assertPlainObject(overrides, 'Admin overrides');

  return createUser({
    id: 'usr_admin_001',
    firstName: 'Test',
    lastName: 'Administrator',
    email: 'admin001@example.test',
    ...clone(overrides),
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
    ...clone(overrides),
    role: USER_ROLES.SUPER_ADMIN,
  });
}

function createInactiveUser(overrides = {}) {
  assertPlainObject(overrides, 'Inactive user overrides');

  return createUserWithStatus(USER_STATUSES.INACTIVE, {
    id: 'usr_inactive_001',
    email: 'inactive001@example.test',
    ...clone(overrides),
  });
}

function createSuspendedUser(overrides = {}) {
  assertPlainObject(overrides, 'Suspended user overrides');

  return createUserWithStatus(USER_STATUSES.SUSPENDED, {
    id: 'usr_suspended_001',
    email: 'suspended001@example.test',
    ...clone(overrides),
  });
}

function createLockedUser(overrides = {}) {
  assertPlainObject(overrides, 'Locked user overrides');

  return createUserWithStatus(USER_STATUSES.LOCKED, {
    id: 'usr_locked_001',
    email: 'locked001@example.test',
    failedLoginAttempts: 5,
    ...clone(overrides),
  });
}

function createDeletedUser(overrides = {}) {
  assertPlainObject(overrides, 'Deleted user overrides');

  return createUserWithStatus(USER_STATUSES.DELETED, {
    id: 'usr_deleted_001',
    email: 'deleted001@example.test',
    ...clone(overrides),
  });
}

function createPendingUser(overrides = {}) {
  assertPlainObject(overrides, 'Pending user overrides');

  return createUserWithStatus(USER_STATUSES.PENDING, {
    id: 'usr_pending_001',
    email: 'pending001@example.test',
    ...clone(overrides),
  });
}

function createUnverifiedUser(overrides = {}) {
  assertPlainObject(overrides, 'Unverified user overrides');

  return createUser({
    id: 'usr_unverified_001',
    email: 'unverified001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.UNVERIFIED,
    ...clone(overrides),
  });
}

function createPendingVerificationUser(overrides = {}) {
  assertPlainObject(overrides, 'Pending-verification overrides');

  return createUser({
    id: 'usr_verification_pending_001',
    email: 'verification.pending001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.PENDING,
    ...clone(overrides),
  });
}

function createRejectedVerificationUser(overrides = {}) {
  assertPlainObject(overrides, 'Rejected-verification overrides');

  return createUser({
    id: 'usr_verification_rejected_001',
    email: 'verification.rejected001@example.test',
    emailVerified: false,
    emailVerificationStatus: VERIFICATION_STATUSES.REJECTED,
    ...clone(overrides),
  });
}

function createMfaEnabledUser(overrides = {}) {
  assertPlainObject(overrides, 'MFA user overrides');

  return createUser({
    id: 'usr_mfa_001',
    email: 'mfa001@example.test',
    mfaEnabled: true,
    ...clone(overrides),
  });
}

function createPhoneVerifiedUser(overrides = {}) {
  assertPlainObject(overrides, 'Phone-verified overrides');

  return createUser({
    id: 'usr_phone_verified_001',
    email: 'phone.verified001@example.test',
    phone: '+910000000002',
    phoneVerified: true,
    ...clone(overrides),
  });
}

function createGoogleUser(overrides = {}) {
  assertPlainObject(overrides, 'Google user overrides');

  return createUser({
    id: 'usr_google_001',
    email: 'google001@example.test',
    authProvider: AUTH_PROVIDERS.GOOGLE,
    ...clone(overrides),
  });
}

function createUserWithFailedLogins(attempts = 3, overrides = {}) {
  assertNonNegativeInteger(attempts, 'Failed login attempts');
  assertPlainObject(overrides, 'Failed-login overrides');

  return createUser({
    id: 'usr_failed_login_001',
    email: 'failed.login001@example.test',
    ...clone(overrides),
    failedLoginAttempts: attempts,
  });
}

/**
 * Client-controlled fields intentionally mixed with server-managed fields.
 * Intended only for validation and mass-assignment security tests.
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
    ...clone(overrides),
  };
}

/**
 * A synthetic principal for authorization tests.
 * This is not a signed token, verified session, or proof of authentication.
 */
function createAuthenticatedPrincipal(overrides = {}) {
  assertPlainObject(overrides, 'Principal overrides');

  const principal = {
    id: 'usr_test_001',
    role: USER_ROLES.STUDENT,
    status: USER_STATUSES.ACTIVE,
    ...clone(overrides),
  };

  assertNonEmptyString(principal.id, 'Principal ID');
  assertEnum(principal.role, USER_ROLE_VALUES, 'principal role');
  assertEnum(principal.status, USER_STATUS_VALUES, 'principal status');

  return principal;
}

function createUserOwnershipScenario() {
  return {
    owner: createUser({
      id: 'usr_owner_001',
      email: 'owner001@example.test',
    }),
    foreignUser: createForeignUser(),
  };
}

function createUserAccessScenario(overrides = {}) {
  assertPlainObject(overrides, 'User access scenario overrides');

  const owner = createUser({
    id: 'usr_access_owner_001',
    email: 'access.owner001@example.test',
    ...clone(overrides.owner || {}),
  });

  const foreignUser = createForeignUser({
    id: 'usr_access_foreign_001',
    email: 'access.foreign001@example.test',
    ...clone(overrides.foreignUser || {}),
  });

  const principal = createAuthenticatedPrincipal({
    id: owner.id,
    role: owner.role,
    status: owner.status,
    ...clone(overrides.principal || {}),
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

function createUnauthorizedUserAccessScenario() {
  const scenario = createUserAccessScenario();

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

/**
 * Build a minimal set of users for account-status authorization tests.
 */
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

/**
 * Build fixtures for verification and MFA-related tests.
 */
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
