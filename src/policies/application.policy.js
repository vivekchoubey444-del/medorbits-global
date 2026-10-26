
'use strict';

/**
 * MedOrbits -- Application Authorization Policy
 *
 * File: src/policies/application.policy.js
 * Runtime: Node.js >= 20
 *
 * Enforces access rules for application creation, viewing, editing,
 * review, deletion, and counsellor assignment.
 *
 * Actor identity and permissions must originate from trusted
 * authentication middleware. Services must validate input fields,
 * state transitions, assignment targets, and database ownership.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  resourceOwnerId,
  safeStatus,
} = require('./policy-utils');

const APPLICANT_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
]);

const STAFF_ROLES = Object.freeze([
  'counsellor',
  'support',
]);

const EDITABLE_STATUSES = new Set([
  'draft',
  'incomplete',
  'submitted',
]);

const DELETABLE_STATUSES = new Set([
  'draft',
  'incomplete',
]);

const PROTECTED_APPLICATION_FIELDS = new Set([
  'id',
  '_id',
  'applicationId',
  'application_id',
  'status',
  'reviewStatus',
  'review_status',
  'decision',
  'decisionStatus',
  'decision_status',
  'approvedBy',
  'approved_by',
  'rejectedBy',
  'rejected_by',
  'reviewedBy',
  'reviewed_by',
  'reviewedAt',
  'reviewed_at',
  'approvedAt',
  'approved_at',
  'rejectedAt',
  'rejected_at',
  'applicantId',
  'applicant_id',
  'candidateId',
  'candidate_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'counsellorId',
  'counsellor_id',
  'assignedCounsellorId',
  'assigned_counsellor_id',
  'assignedTo',
  'assigned_to',
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

function applicantId(application) {
  if (!application || typeof application !== 'object') {
    return null;
  }

  return resourceOwnerId(application, [
    'applicantId',
    'applicant_id',
    'candidateId',
    'candidate_id',
    'userId',
    'user_id',
    'ownerId',
    'owner_id',
    'createdBy',
    'created_by',
  ]);
}

function isActiveActor(actor) {
  if (!actor || typeof actor !== 'object') {
    return false;
  }

  const status = safeStatus(actor.status);

  return (
    actor.isSuspended !== true &&
    actor.isDisabled !== true &&
    actor.isLocked !== true &&
    actor.deletedAt == null &&
    actor.deleted_at == null &&
    !['suspended', 'disabled', 'locked', 'deleted', 'banned'].includes(status)
  );
}

function isDeletedApplication(application) {
  return (
    safeStatus(application?.status) === 'deleted' ||
    application?.deletedAt != null ||
    application?.deleted_at != null
  );
}

function hasApplicantRole(actor) {
  return hasRole(actor, ...APPLICANT_ROLES);
}

function isApplicationOwner(actor, application) {
  const ownerId = applicantId(application);

  return (
    ownerId != null &&
    actorId(actor) != null &&
    isOwner(actor, ownerId)
  );
}

function counsellorAssigned(actor, application) {
  if (!actor || !application) {
    return false;
  }

  const id = actorId(actor);

  if (id == null) {
    return false;
  }

  const assignedTo =
    application.counsellorId ??
    application.counsellor_id ??
    application.assignedCounsellorId ??
    application.assigned_counsellor_id ??
    application.assignedTo ??
    application.assigned_to;

  return assignedTo != null && sameId(assignedTo, id);
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) => {
    if (PROTECTED_APPLICATION_FIELDS.has(key)) {
      return true;
    }

    // Treat camelCase and snake_case variants consistently.
    const snakeCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return PROTECTED_APPLICATION_FIELDS.has(snakeCase);
  });
}

function canCreateApplication(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:create:any')
  ) {
    return true;
  }

  if (!hasApplicantRole(actor)) {
    return false;
  }

  const targetApplicant =
    input.applicantId ??
    input.applicant_id ??
    input.candidateId ??
    input.candidate_id ??
    input.userId ??
    input.user_id ??
    input.ownerId ??
    input.owner_id;

  // The service must always derive the persisted owner from the
  // authenticated actor, even when the policy permits creation.
  return (
    targetApplicant == null ||
    targetApplicant === '' ||
    isOwner(actor, targetApplicant)
  );
}

function canViewApplication(actor, application) {
  if (
    !isActiveActor(actor) ||
    !application ||
    typeof application !== 'object' ||
    isDeletedApplication(application)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:read:any')
  ) {
    return true;
  }

  if (isApplicationOwner(actor, application)) {
    return true;
  }

  return Boolean(
    counsellorAssigned(actor, application) &&
    hasRole(actor, ...STAFF_ROLES) &&
    hasPermission(actor, 'applications:read:assigned')
  );
}

function canUpdateApplication(actor, application, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !application ||
    typeof application !== 'object' ||
    !isPlainObject(changes) ||
    isDeletedApplication(application) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:update:any')
  ) {
    return true;
  }

  if (isApplicationOwner(actor, application)) {
    return EDITABLE_STATUSES.has(safeStatus(application.status));
  }

  return Boolean(
    counsellorAssigned(actor, application) &&
    hasRole(actor, 'counsellor') &&
    hasPermission(actor, 'applications:update:assigned') &&
    EDITABLE_STATUSES.has(safeStatus(application.status))
  );
}

function canReviewApplication(actor, application) {
  if (
    !isActiveActor(actor) ||
    !application ||
    typeof application !== 'object' ||
    isDeletedApplication(application)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:review:any')
  ) {
    return true;
  }

  return Boolean(
    counsellorAssigned(actor, application) &&
    hasRole(actor, 'counsellor') &&
    hasPermission(actor, 'applications:review:assigned')
  );
}

function canDeleteApplication(actor, application) {
  if (
    !isActiveActor(actor) ||
    !application ||
    typeof application !== 'object' ||
    isDeletedApplication(application)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'applications:delete:any')
  ) {
    return true;
  }

  return Boolean(
    isApplicationOwner(actor, application) &&
    DELETABLE_STATUSES.has(safeStatus(application.status)) &&
    hasPermission(actor, 'applications:delete:self')
  );
}

function canAssignCounsellor(actor, application, assigneeId) {
  if (
    !isActiveActor(actor) ||
    !application ||
    typeof application !== 'object' ||
    isDeletedApplication(application) ||
    assigneeId == null ||
    assigneeId === ''
  ) {
    return false;
  }

  if (
    !isAdmin(actor) &&
    !hasPermission(actor, 'applications:assign')
  ) {
    return false;
  }

  const currentAssignee =
    application.counsellorId ??
    application.counsellor_id ??
    application.assignedCounsellorId ??
    application.assigned_counsellor_id ??
    application.assignedTo ??
    application.assigned_to;

  return !sameId(currentAssignee, assigneeId);
}

module.exports = Object.freeze({
  APPLICANT_ROLES,
  STAFF_ROLES,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  PROTECTED_APPLICATION_FIELDS,
  applicantId,
  isApplicationOwner,
  counsellorAssigned,
  hasProtectedChanges,
  canCreateApplication,
  canViewApplication,
  canUpdateApplication,
  canReviewApplication,
  canDeleteApplication,
  canAssignCounsellor,
});
