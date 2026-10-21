
'use strict';

/**
 * MedOrbits -- Employer Authorization Policies
 *
 * File: src/policies/employer.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls employer account creation, visibility, updates, job management,
 * applicant access, and recruitment management.
 *
 * Actor identity and permissions must come from trusted authentication
 * middleware. Services must validate schemas, employer verification,
 * subscription entitlements, and database ownership.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
} = require('./policy-utils');

const PROTECTED_EMPLOYER_FIELDS = new Set([
  'id',
  '_id',
  'employerId',
  'employer_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'verified',
  'isVerified',
  'is_verified',
  'verificationStatus',
  'verification_status',
  'verifiedAt',
  'verified_at',
  'verifiedBy',
  'verified_by',
  'status',
  'subscriptionStatus',
  'subscription_status',
  'planId',
  'plan_id',
  'billingStatus',
  'billing_status',
  'billingCustomerId',
  'billing_customer_id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'deletedAt',
  'deleted_at',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function actorId(actor) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }

  return actor.id ?? actor.userId ?? actor.user_id ?? actor.sub ?? actor._id ?? null;
}

function isActiveActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return false;
  }

  const status = typeof actor.status === 'string'
    ? actor.status.trim().toLowerCase()
    : '';

  return (
    actor.isDisabled !== true &&
    actor.isSuspended !== true &&
    actor.isLocked !== true &&
    actor.deletedAt == null &&
    actor.deleted_at == null &&
    !['disabled', 'suspended', 'locked', 'deleted', 'banned'].includes(status)
  );
}

function isDeletedEmployer(employer) {
  return Boolean(
    employer?.deletedAt != null ||
    employer?.deleted_at != null ||
    ['deleted', 'inactive'].includes(
      String(employer?.status || '').trim().toLowerCase()
    )
  );
}

function employerAccountId(employer) {
  if (!employer || typeof employer !== 'object') {
    return null;
  }

  return employer.employerId ??
    employer.employer_id ??
    employer.id ??
    employer._id ??
    null;
}

function employerOwnerUserId(employer) {
  if (!employer || typeof employer !== 'object') {
    return null;
  }

  return employer.userId ??
    employer.user_id ??
    employer.ownerId ??
    employer.owner_id ??
    employer.createdBy ??
    employer.created_by ??
    null;
}

function employerMatchesActor(actor, employer) {
  if (
    !isActiveActor(actor) ||
    !employer ||
    typeof employer !== 'object' ||
    isDeletedEmployer(employer)
  ) {
    return false;
  }

  const currentActorId = actorId(actor);
  const currentEmployerId =
    actor.employerId ??
    actor.employer_id;

  const targetEmployerId = employerAccountId(employer);
  const ownerUserId = employerOwnerUserId(employer);

  const accountMatch = Boolean(
    currentActorId != null &&
    currentEmployerId != null &&
    targetEmployerId != null &&
    sameId(currentEmployerId, targetEmployerId)
  );

  const ownerMatch = Boolean(
    currentActorId != null &&
    ownerUserId != null &&
    sameId(currentActorId, ownerUserId) &&
    hasRole(actor, 'employer')
  );

  return accountMatch || ownerMatch;
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) => {
    if (PROTECTED_EMPLOYER_FIELDS.has(key)) {
      return true;
    }

    const snakeCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return PROTECTED_EMPLOYER_FIELDS.has(snakeCase);
  });
}

function canCreateEmployerAccount(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'employers:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, 'user', 'employer')) {
    return false;
  }

  if (
    actor.isVerified !== true &&
    actor.is_verified !== true
  ) {
    return false;
  }

  const requestedOwner =
    input.userId ??
    input.user_id ??
    input.ownerId ??
    input.owner_id;

  // The service must derive the persisted owner from authenticated identity.
  if (requestedOwner == null || requestedOwner === '') {
    return true;
  }

  return Boolean(
    actorId(actor) != null &&
    isOwner(actor, requestedOwner)
  );
}

function canViewEmployer(actor, employer) {
  if (
    !employer ||
    typeof employer !== 'object' ||
    isDeletedEmployer(employer)
  ) {
    return false;
  }

  if (
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'employers:read:any')
    )
  ) {
    return true;
  }

  if (employerMatchesActor(actor, employer)) {
    return true;
  }

  return Boolean(
    isActiveActor(actor) &&
    employer.publicProfile === true &&
    hasPermission(actor, 'employers:read:public')
  );
}

function canUpdateEmployer(actor, employer, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !employer ||
    typeof employer !== 'object' ||
    isDeletedEmployer(employer) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'employers:update:any')
  ) {
    return true;
  }

  return employerMatchesActor(actor, employer);
}

function canManageEmployerJobs(actor, employer, job = null) {
  if (
    !isActiveActor(actor) ||
    !employer ||
    typeof employer !== 'object' ||
    isDeletedEmployer(employer)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:manage:any')
  ) {
    return true;
  }

  if (
    !employerMatchesActor(actor, employer) ||
    !hasRole(actor, 'employer') ||
    !hasPermission(actor, 'jobs:manage:own-employer')
  ) {
    return false;
  }

  if (job != null) {
    if (!job || typeof job !== 'object') {
      return false;
    }

    const jobEmployerId =
      job.employerId ??
      job.employer_id ??
      job.ownerEmployerId ??
      job.owner_employer_id;

    const targetEmployerId = employerAccountId(employer);

    if (
      jobEmployerId == null ||
      targetEmployerId == null ||
      !sameId(jobEmployerId, targetEmployerId)
    ) {
      return false;
    }
  }

  return true;
}

function canViewApplicants(actor, employer, job, application = null) {
  if (
    !isActiveActor(actor) ||
    !employer ||
    typeof employer !== 'object' ||
    !job ||
    typeof job !== 'object' ||
    isDeletedEmployer(employer)
  ) {
    return false;
  }

  const targetEmployerId = employerAccountId(employer);
  const jobEmployerId =
    job.employerId ??
    job.employer_id ??
    job.ownerEmployerId ??
    job.owner_employer_id;

  if (
    targetEmployerId == null ||
    jobEmployerId == null ||
    !sameId(jobEmployerId, targetEmployerId)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:read:any')
  ) {
    return true;
  }

  if (
    !employerMatchesActor(actor, employer) ||
    !hasRole(actor, 'employer', 'recruiter') ||
    !hasPermission(actor, 'applications:read:employer')
  ) {
    return false;
  }

  if (application != null) {
    if (!application || typeof application !== 'object') {
      return false;
    }

    const jobId = job.id ?? job._id;
    const applicationJobId =
      application.jobId ??
      application.job_id;

    if (
      jobId == null ||
      applicationJobId == null ||
      !sameId(applicationJobId, jobId)
    ) {
      return false;
    }

    const applicationEmployerId =
      application.employerId ??
      application.employer_id ??
      application.jobEmployerId ??
      application.job_employer_id;

    // Require an explicit employer match on the application record
    // when that field is present; job ownership is checked above.
    if (
      applicationEmployerId != null &&
      !sameId(applicationEmployerId, targetEmployerId)
    ) {
      return false;
    }
  }

  return true;
}

function canManageRecruitment(actor, employer, recruitment = null) {
  if (
    !isActiveActor(actor) ||
    !employer ||
    typeof employer !== 'object' ||
    isDeletedEmployer(employer)
  ) {
    return false;
  }

  const targetEmployerId = employerAccountId(employer);

  if (
    recruitment != null &&
    (
      !recruitment ||
      typeof recruitment !== 'object' ||
      targetEmployerId == null
    )
  ) {
    return false;
  }

  if (
    recruitment != null &&
    (
      recruitment.employerId == null &&
      recruitment.employer_id == null
    )
  ) {
    return false;
  }

  if (
    recruitment != null &&
    !sameId(
      recruitment.employerId ?? recruitment.employer_id,
      targetEmployerId
    )
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:manage:any')
  ) {
    return true;
  }

  return Boolean(
    employerMatchesActor(actor, employer) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:manage:own-employer')
  );
}

module.exports = Object.freeze({
  PROTECTED_EMPLOYER_FIELDS,
  actorId,
  employerAccountId,
  employerOwnerUserId,
  employerMatchesActor,
  hasProtectedChanges,
  canCreateEmployerAccount,
  canViewEmployer,
  canUpdateEmployer,
  canManageEmployerJobs,
  canViewApplicants,
  canManageRecruitment,
});
