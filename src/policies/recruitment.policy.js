
'use strict';

/**
 * MedOrbits -- Recruitment Authorization Policy
 *
 * File: src/policies/recruitment.policy.js
 * Runtime: Node.js >= 20
 *
 * Enforces access to recruitment campaigns, lifecycle transitions,
 * candidate data, recruitment pipelines, and exports.
 *
 * State changes, employer relationships, and candidate access must
 * also be validated by the service and repository layers.
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

const EDITABLE_STATUSES = new Set([
  'draft',
  'active',
  'published',
  'paused',
]);

const PUBLISHABLE_STATUSES = new Set([
  'draft',
  'paused',
]);

const PAUSABLE_STATUSES = new Set([
  'active',
  'published',
]);

const CLOSABLE_STATUSES = new Set([
  'draft',
  'active',
  'published',
  'paused',
]);

const COMPLETABLE_STATUSES = new Set([
  'active',
  'published',
  'paused',
]);

const TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled',
  'closed',
  'deleted',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'recruitmentId',
  'recruitment_id',
  'employerId',
  'employer_id',
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'managedBy',
  'managed_by',
  'status',
  'isPublic',
  'is_public',
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
  'completedAt',
  'completed_at',
  'cancelledAt',
  'cancelled_at',
  'deletedAt',
  'deleted_at',
  'candidateCount',
  'candidate_count',
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

function recruitmentStatus(recruitment) {
  return safeStatus(recruitment && recruitment.status);
}

function isDeletedRecruitment(recruitment) {
  return recruitmentStatus(recruitment) === 'deleted';
}

function recruitmentEmployerId(recruitment) {
  if (!isPlainObject(recruitment)) {
    return null;
  }

  for (const field of EMPLOYER_FIELDS) {
    if (recruitment[field] != null) {
      return recruitment[field];
    }
  }

  return null;
}

function recruitmentOwnerId(recruitment) {
  if (!isPlainObject(recruitment)) {
    return null;
  }

  return resourceOwnerId(recruitment, [
    ...EMPLOYER_FIELDS,
    ...OWNER_FIELDS,
  ]);
}

function isRecruitmentOwner(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment)
  ) {
    return false;
  }

  const employerId = recruitmentEmployerId(recruitment);
  const actorEmployerId = actor.employerId ?? actor.employer_id;

  if (
    employerId != null &&
    actorEmployerId != null &&
    sameId(actorEmployerId, employerId) &&
    hasRole(actor, 'employer', 'recruiter')
  ) {
    return true;
  }

  const ownerId = resourceOwnerId(recruitment, OWNER_FIELDS);
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

function canViewRecruitment(actor, recruitment) {
  if (
    !isPlainObject(recruitment) ||
    isDeletedRecruitment(recruitment)
  ) {
    return false;
  }

  const status = recruitmentStatus(recruitment);

  if (
    recruitment.isPublic === true ||
    recruitment.is_public === true
  ) {
    if (['active', 'published'].includes(status)) {
      return true;
    }
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:read:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) ||
    hasPermission(actor, 'recruitment:read:private')
  );
}

function canCreateRecruitment(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:create:any')
  ) {
    return true;
  }

  if (
    !hasRole(actor, 'employer', 'recruiter') ||
    (actor.employerId ?? actor.employer_id) == null
  ) {
    return false;
  }

  const requestedEmployerId =
    input.employerId ?? input.employer_id;

  const authenticatedEmployerId =
    actor.employerId ?? actor.employer_id;

  if (
    requestedEmployerId != null &&
    !sameId(requestedEmployerId, authenticatedEmployerId)
  ) {
    return false;
  }

  return hasPermission(actor, 'recruitment:create:own-employer');
}

function canUpdateRecruitment(actor, recruitment, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    isDeletedRecruitment(recruitment) ||
    !isPlainObject(changes) ||
    Object.keys(changes).length === 0 ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:update:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    EDITABLE_STATUSES.has(recruitmentStatus(recruitment)) &&
    hasPermission(actor, 'recruitment:update:own-employer')
  );
}

function canPublishRecruitment(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    !PUBLISHABLE_STATUSES.has(recruitmentStatus(recruitment))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:publish:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:publish:own-employer')
  );
}

function canPauseRecruitment(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    !PAUSABLE_STATUSES.has(recruitmentStatus(recruitment))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:pause:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:pause:own-employer')
  );
}

function canCloseRecruitment(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    !CLOSABLE_STATUSES.has(recruitmentStatus(recruitment))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:close:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:close:own-employer')
  );
}

function canCompleteRecruitment(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    !COMPLETABLE_STATUSES.has(recruitmentStatus(recruitment))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:complete:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:complete:own-employer')
  );
}

function canDeleteRecruitment(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    isDeletedRecruitment(recruitment)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:delete:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    recruitmentStatus(recruitment) === 'draft' &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:delete:own-employer')
  );
}

function canViewRecruitmentCandidates(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    isDeletedRecruitment(recruitment)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:candidates:read:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:candidates:read:own-employer')
  );
}

function canManageRecruitmentPipeline(actor, recruitment) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(recruitment) ||
    isDeletedRecruitment(recruitment)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'recruitment:pipeline:manage:any')
  ) {
    return true;
  }

  return Boolean(
    isRecruitmentOwner(actor, recruitment) &&
    hasRole(actor, 'employer', 'recruiter') &&
    hasPermission(actor, 'recruitment:pipeline:manage:own-employer')
  );
}

function canExportRecruitment(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'recruitment:export')
    )
  );
}

module.exports = Object.freeze({
  recruitmentOwnerId,
  recruitmentEmployerId,
  isRecruitmentOwner,
  canViewRecruitment,
  canCreateRecruitment,
  canUpdateRecruitment,
  canPublishRecruitment,
  canPauseRecruitment,
  canCloseRecruitment,
  canCompleteRecruitment,
  canDeleteRecruitment,
  canViewRecruitmentCandidates,
  canManageRecruitmentPipeline,
  canExportRecruitment,
});
