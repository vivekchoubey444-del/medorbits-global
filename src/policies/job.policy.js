
'use strict';

/**
 * MedOrbits -- Job Authorization Policy
 *
 * File: src/policies/job.policy.js
 * Runtime: Node.js >= 20
 *
 * Authorization for job listings, employer ownership, publication,
 * lifecycle transitions, applicant access, and exports.
 *
 * Protected lifecycle and ownership fields must be changed only through
 * dedicated service methods with database-level authorization checks.
 */

const {
  isAdmin,
  hasPermission,
  hasRole,
  sameId,
  actorId,
  resourceOwnerId,
  safeStatus,
} = require('./policy-utils');

const EMPLOYER_FIELDS = Object.freeze([
  'employerId',
  'employer_id',
]);

const OWNER_FIELDS = Object.freeze([
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'managedBy',
  'managed_by',
]);

const PUBLIC_STATUSES = new Set([
  'published',
]);

const EDITABLE_STATUSES = new Set([
  'draft',
  'published',
  'paused',
]);

const PUBLISHABLE_STATUSES = new Set([
  'draft',
  'paused',
]);

const CLOSABLE_STATUSES = new Set([
  'draft',
  'published',
  'paused',
]);

const TERMINAL_STATUSES = new Set([
  'closed',
  'filled',
  'deleted',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'jobId',
  'job_id',
  'employerId',
  'employer_id',
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'managedBy',
  'managed_by',
  'status',
  'verified',
  'isVerified',
  'is_verified',
  'verificationStatus',
  'verification_status',
  'approvedBy',
  'approved_by',
  'approvedAt',
  'approved_at',
  'publishedAt',
  'published_at',
  'closedAt',
  'closed_at',
  'filledAt',
  'filled_at',
  'deletedAt',
  'deleted_at',
  'applicationCount',
  'application_count',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function isActiveActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return false;
  }

  if (
    actor.isActive === false ||
    actor.is_active === false ||
    actor.isSuspended === true ||
    actor.is_suspended === true
  ) {
    return false;
  }

  return ![
    'disabled',
    'suspended',
    'inactive',
    'deleted',
    'blocked',
  ].includes(safeStatus(actor.status));
}

function jobStatus(job) {
  return safeStatus(job && job.status);
}

function isDeletedJob(job) {
  return jobStatus(job) === 'deleted';
}

function jobOwnerId(job) {
  if (!isPlainObject(job)) {
    return null;
  }

  return resourceOwnerId(job, [
    ...EMPLOYER_FIELDS,
    ...OWNER_FIELDS,
  ]);
}

function jobEmployerId(job) {
  if (!isPlainObject(job)) {
    return null;
  }

  for (const field of EMPLOYER_FIELDS) {
    if (job[field] != null) {
      return job[field];
    }
  }

  return null;
}

function isJobOwner(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job)
  ) {
    return false;
  }

  const employerId = jobEmployerId(job);
  const actorEmployerId = actor.employerId ?? actor.employer_id;

  if (
    employerId != null &&
    actorEmployerId != null &&
    sameId(actorEmployerId, employerId) &&
    hasRole(actor, 'employer')
  ) {
    return true;
  }

  const ownerId = resourceOwnerId(job, OWNER_FIELDS);
  const currentActorId = actorId(actor);

  return ownerId != null &&
    currentActorId != null &&
    sameId(currentActorId, ownerId);
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) =>
    PROTECTED_FIELDS.has(key)
  );
}

function canViewJob(actor, job) {
  if (!isPlainObject(job) || isDeletedJob(job)) {
    return false;
  }

  const status = jobStatus(job);

  // Published jobs are public unless explicitly deleted.
  if (PUBLIC_STATUSES.has(status)) {
    return true;
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:read:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) ||
    hasPermission(actor, 'jobs:read:private')
  );
}

function canCreateJob(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:create:any')
  ) {
    return true;
  }

  return Boolean(
    hasRole(actor, 'employer') &&
    (actor.employerId ?? actor.employer_id) != null &&
    hasPermission(actor, 'jobs:create:own-employer')
  );
}

function canUpdateJob(actor, job, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    isDeletedJob(job) ||
    !isPlainObject(changes) ||
    Object.keys(changes).length === 0 ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:update:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    EDITABLE_STATUSES.has(jobStatus(job)) &&
    hasPermission(actor, 'jobs:update:own-employer')
  );
}

function canPublishJob(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    !PUBLISHABLE_STATUSES.has(jobStatus(job))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:publish:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'jobs:publish:own-employer')
  );
}

function canPauseJob(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    jobStatus(job) !== 'published'
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:pause:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'jobs:pause:own-employer')
  );
}

function canCloseJob(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    !CLOSABLE_STATUSES.has(jobStatus(job))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:close:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'jobs:close:own-employer')
  );
}

function canMarkJobFilled(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    jobStatus(job) !== 'published'
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:mark-filled:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'jobs:mark-filled:own-employer')
  );
}

function canDeleteJob(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    isDeletedJob(job)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'jobs:delete:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    jobStatus(job) === 'draft' &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'jobs:delete:own-employer')
  );
}

function canViewJobApplicants(actor, job) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(job) ||
    isDeletedJob(job)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:read:any')
  ) {
    return true;
  }

  return Boolean(
    isJobOwner(actor, job) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'applications:read:employer')
  );
}

function canExportJobs(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'jobs:export')
    )
  );
}

module.exports = Object.freeze({
  jobOwnerId,
  jobEmployerId,
  isJobOwner,
  canViewJob,
  canCreateJob,
  canUpdateJob,
  canPublishJob,
  canPauseJob,
  canCloseJob,
  canMarkJobFilled,
  canDeleteJob,
  canViewJobApplicants,
  canExportJobs,
});
