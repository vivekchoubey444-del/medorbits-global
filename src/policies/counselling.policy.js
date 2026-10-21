
'use strict';

/**
 * MedOrbits -- Counselling Authorization Policies
 *
 * File: src/policies/counselling.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls counselling-session access, requests, updates, assignment,
 * cancellation, completion, deletion, scheduling, and exports.
 *
 * Actor identity and permissions must come from trusted authentication
 * middleware. Services must validate counsellor eligibility, session
 * transitions, appointment times, and database ownership.
 */

const {
  isAdmin,
  hasPermission,
  hasRole,
  sameId,
  actorId,
  isOwner,
  safeStatus,
  resourceOwnerId,
} = require('./policy-utils');

const OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'candidateId',
  'candidate_id',
  'applicantId',
  'applicant_id',
  'ownerId',
  'owner_id',
]);

const STAFF_ROLES = Object.freeze([
  'counsellor',
  'support',
]);

const APPLICANT_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
]);

const EDITABLE_STATUSES = new Set([
  'requested',
  'scheduled',
]);

const TERMINAL_STATUSES = new Set([
  'completed',
  'cancelled',
  'deleted',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'sessionId',
  'session_id',
  'userId',
  'user_id',
  'candidateId',
  'candidate_id',
  'applicantId',
  'applicant_id',
  'ownerId',
  'owner_id',
  'counsellorId',
  'counsellor_id',
  'assignedCounsellorId',
  'assigned_counsellor_id',
  'assignedTo',
  'assigned_to',
  'status',
  'completedAt',
  'completed_at',
  'cancelledAt',
  'cancelled_at',
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

function isDeletedSession(session) {
  return (
    safeStatus(session?.status) === 'deleted' ||
    session?.deletedAt != null ||
    session?.deleted_at != null
  );
}

function counsellingOwnerId(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  return resourceOwnerId(session, OWNER_FIELDS);
}

function assignedCounsellorId(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  return (
    session.assignedCounsellorId ??
    session.assigned_counsellor_id ??
    session.counsellorId ??
    session.counsellor_id ??
    session.assignedTo ??
    session.assigned_to ??
    null
  );
}

function isAssignedCounsellor(actor, session) {
  if (!isActiveActor(actor) || !session || typeof session !== 'object') {
    return false;
  }

  const id = actorId(actor);
  const assignedId = assignedCounsellorId(session);

  return Boolean(
    id != null &&
    assignedId != null &&
    sameId(id, assignedId) &&
    hasRole(actor, 'counsellor')
  );
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) => {
    if (PROTECTED_FIELDS.has(key)) {
      return true;
    }

    const snakeCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return PROTECTED_FIELDS.has(snakeCase);
  });
}

function canViewCounselling(actor, session) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:read:any')
  ) {
    return true;
  }

  const ownerId = counsellingOwnerId(session);

  if (ownerId != null && isOwner(actor, ownerId)) {
    return true;
  }

  return Boolean(
    isAssignedCounsellor(actor, session) &&
    hasPermission(actor, 'counselling:read:assigned')
  );
}

function canRequestCounselling(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...APPLICANT_ROLES)) {
    return false;
  }

  const requestedOwner =
    input.userId ??
    input.user_id ??
    input.candidateId ??
    input.candidate_id ??
    input.applicantId ??
    input.applicant_id ??
    input.ownerId ??
    input.owner_id;

  // The service must set the stored owner from the authenticated actor.
  return (
    requestedOwner == null ||
    requestedOwner === '' ||
    isOwner(actor, requestedOwner)
  );
}

function canUpdateCounselling(actor, session, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes) ||
    !EDITABLE_STATUSES.has(safeStatus(session.status))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:update:any')
  ) {
    return true;
  }

  const ownerId = counsellingOwnerId(session);

  if (ownerId != null && isOwner(actor, ownerId)) {
    return true;
  }

  return Boolean(
    isAssignedCounsellor(actor, session) &&
    hasPermission(actor, 'counselling:update:assigned')
  );
}

function canAssignCounsellor(actor, session, targetCounsellorId) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session) ||
    targetCounsellorId == null ||
    targetCounsellorId === '' ||
    TERMINAL_STATUSES.has(safeStatus(session.status))
  ) {
    return false;
  }

  if (
    !isAdmin(actor) &&
    !hasPermission(actor, 'counselling:assign')
  ) {
    return false;
  }

  return !sameId(assignedCounsellorId(session), targetCounsellorId);
}

function canCancelCounselling(actor, session) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session) ||
    !EDITABLE_STATUSES.has(safeStatus(session.status))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:cancel:any')
  ) {
    return true;
  }

  const ownerId = counsellingOwnerId(session);

  if (ownerId != null && isOwner(actor, ownerId)) {
    return true;
  }

  return Boolean(
    isAssignedCounsellor(actor, session) &&
    hasPermission(actor, 'counselling:cancel:assigned')
  );
}

function canCompleteCounselling(actor, session) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session) ||
    safeStatus(session.status) !== 'scheduled'
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:complete:any')
  ) {
    return true;
  }

  return Boolean(
    isAssignedCounsellor(actor, session) &&
    hasPermission(actor, 'counselling:complete:assigned')
  );
}

function canDeleteCounselling(actor, session) {
  if (
    !isActiveActor(actor) ||
    !session ||
    typeof session !== 'object' ||
    isDeletedSession(session)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:delete:any')
  ) {
    return true;
  }

  const ownerId = counsellingOwnerId(session);

  return Boolean(
    ownerId != null &&
    isOwner(actor, ownerId) &&
    safeStatus(session.status) === 'requested' &&
    hasPermission(actor, 'counselling:delete:self')
  );
}

function canViewCounsellingSchedule(actor, targetUserId) {
  if (
    !isActiveActor(actor) ||
    targetUserId == null ||
    targetUserId === ''
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'counselling:schedule:read:any')
  ) {
    return true;
  }

  return sameId(actorId(actor), targetUserId);
}

function canExportCounsellingRecords(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'counselling:export')
    )
  );
}

module.exports = Object.freeze({
  OWNER_FIELDS,
  STAFF_ROLES,
  APPLICANT_ROLES,
  EDITABLE_STATUSES,
  TERMINAL_STATUSES,
  PROTECTED_FIELDS,
  counsellingOwnerId,
  assignedCounsellorId,
  isAssignedCounsellor,
  hasProtectedChanges,
  canViewCounselling,
  canRequestCounselling,
  canUpdateCounselling,
  canAssignCounsellor,
  canCancelCounselling,
  canCompleteCounselling,
  canDeleteCounselling,
  canViewCounsellingSchedule,
  canExportCounsellingRecords,
});
