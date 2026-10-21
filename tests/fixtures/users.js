'use strict';
/**
 * MedOrbits -- User Test Fixtures
 *
 * File: tests/fixtures/users.js
 *
 * Synthetic fixtures for authentication, authorization, RBAC, IDOR,
 * account-status, verification, and mass-assignment tests.
 *
 * These fixtures do not authenticate users, hash passwords, persist data,
 * or grant permissions.
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
}
function assertEnum(value, values, label) {
  if (!values.includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
}
function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}
/**
 * Create a synthetic user record.
 *
 * This factory does not hash the password or persist the user.
 */
function createUser(overrides = {}) {
  assertPlainObject(overrides, 'User overrides');
  const user = {
    ...clone(DEFAULT_USER),
    ...clone(overrides),
  };
  assertNonEmptyString(user.id, 'User ID');
  assertNonEmptyString(user.firstName, 'First name');
  assertNonEmptyString(user.lastName, 'Last name');
  assertNonEmptyString(user.email, 'Email');
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
    if (typeof user[field] !== 'boolean') {
      throw new TypeError(`${field} must be a boolean`);
    }
  }
  if (user.phone !== null && typeof user.phone !== 'string') {
    throw new TypeError('phone must be a string or null');
  }
  return user;
}
/**
 * Client-submittable registration data.
 *
 * Server-managed identity, role, status, verification, and MFA fields
 * are deliberately excluded.
 */
function createUserRegistrationPayload(overrides = {}) {
  assertPlainObject(overrides, 'Registration payload overrides');
  return {
    firstName: 'Test',
    lastName: 'Student',
    email: 'new.student@example.test',
    password: DEFAULT_PASSWORD,
    confirmPassword: DEFAULT_PASSWORD,
    ...clone(overrides),
  };
}
function createLoginPayload(overrides = {}) {
  assertPlainObject(overrides, 'Login payload overrides');
  return {
    email: 'student001@example.test',
    password: DEFAULT_PASSWORD,
    ...clone(overrides),
  };
}
function createPasswordChangePayload(overrides = {}) {
  assertPlainObject(overrides, 'Password-change payload overrides');
  return {
    currentPassword: DEFAULT_PASSWORD,
    newPassword: 'NewTestOnly!Password456',
    confirmPassword: 'NewTestOnly!Password456',
    ...clone(overrides),
  };
}
function createUserProfilePayload(overrides = {}) {
  assertPlainObject(overrides, 'Profile payload overrides');
  return {
    firstName: 'Updated',
    lastName: 'Student',
    phone: '+910000000001',
    ...clone(overrides),
  };
}
/**
 * Create users with unique generated IDs and emails.
 *
 * Overrides may customize shared fields, but generated identities are
 * reapplied afterward to prevent accidental duplicates.
 */
function createUserSet(count = 3, overrides = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new RangeError(
      'User count must be an integer from 0 to 1000'
    );
  }
  assertPlainObject(overrides, 'User set overrides');
  const commonOverrides = clone(overrides);
  for (const field of ['id', 'email']) {
    delete commonOverrides[field];
  }
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
 * Deliberately hostile input for mass-assignment security tests.
 *
 * Do not use this as a normal user record.
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
    ...clone(overrides),
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
  return createUserWithStatus(USER_STATUSES.INACTIVE, {
    id: 'usr_inactive_001',
    email: 'inactive001@example.test',
    ...overrides,
  });
}
function createSuspendedUser(overrides = {}) {
  return createUserWithStatus(USER_STATUSES.SUSPENDED, {
    id: 'usr_suspended_001',
    email: 'suspended001@example.test',
    ...overrides,
  });
}
function createLockedUser(overrides = {}) {
  return createUserWithStatus(USER_STATUSES.LOCKED, {
    id: 'usr_locked_001',
    email: 'locked001@example.test',
    failedLoginAttempts: 5,
    ...overrides,
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
function createMfaEnabledUser(overrides = {}) {
  assertPlainObject(overrides, 'MFA user overrides');
  return createUser({
    id: 'usr_mfa_001',
    email: 'mfa001@example.test',
    mfaEnabled: true,
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
    isAdmin: true,
    permissions: ['*'],
    ...clone(overrides),
  };
}
/**
 * This object is only a test representation of a principal.
 * It is not a signed token or authenticated session.
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
function createAuthorizationUsers() {
  return {
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
  createUnverifiedUser,
  createMfaEnabledUser,
  createUserWithFailedLogins,
  createUntrustedUserInput,
  createAuthenticatedPrincipal,
  createUserOwnershipScenario,
  createAuthorizationUsers,
};