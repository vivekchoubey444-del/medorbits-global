'use strict';

/**
 * MedOrbits -- Admission Authorization Policy
 *
 * File: src/policies/admission.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls admission ownership, applicant edits, staff access,
 * review, assignment, status transitions, decisions, deletion,
 * and exports.
 *
 * Authorization inputs must come from trusted server-side records.
 * This module does not replace service validation or database constraints.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  safeStatus,
  resourceOwnerId,
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

const ADMISSION_OWNER_FIELDS = Object.freeze([
  'applicantId',
  'applicant_id',
  'candidateId',
  'candidate_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'admissionId',
  'admission_id',
  'applicationId',
  'application_id',
  'applicantId',
  'applicant_id',
  'candidateId',
  'candidate_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'status',
  'decision',
  'decisionStatus',
  'decision_status',
  'reviewStatus',
  'review_status',
  'assignedCounsellorId',
  'assigned_counsellor_id',
  'assignedTo',
  'assigned_to',
  'reviewedBy',
  'reviewed_by',
  'approvedBy',
  'approved_by',
  'rejectedBy',
  'rejected_by',
  'approvedAt',
  'approved_at',
  'rejectedAt',
  'rejected_at',
  'reviewedAt',
  'reviewed_at',
  'submittedAt',
  'submitted_at',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'deletedAt',
  'deleted_at',
]);

const EDITABLE_STATUSES = new Set([
  'draft',
  'incomplete',
]);

const REVIEWABLE_STATUSES = new Set([
  'submitted',
  'under_review',
  'pending_review',
]);

const TERMINAL_STATUSES = new Set([
  'approved',
  'rejected',
  'cancelled',
  'withdrawn',
  'closed',
  'deleted',
]);

const VALID_DECISIONS = new Set([
  'approved',
  'rejected',
  'waitlisted',
]);

const STATUS_TRANSITIONS = Object.freeze({
  draft: Object.freeze([
    'submitted',
    'incomplete',
    'cancelled',
  ]),
  incomplete: Object.freeze([
    'submitted',
    'cancelled',
  ]),
  submitted: Object.freeze([
    'under_review',
    'pending_review',
    'approved',
    'rejected',
    'waitlisted',
    'withdrawn',
  ]),
  pending_review: Object.freeze([
    'under_review',
    'approved',
    'rejected',
    'waitlisted',
    'withdrawn',
  ]),
  under_review: Object.freeze([
    'approved',
    'rejected',
    'waitlisted',
    'withdrawn',
  ]),
  waitlisted: Object.freeze([
    'approved',
    'rejected',
    'withdrawn',
  ]),
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function actorUserId(actor) {
  if (!actor || typeof actor !== 'object') {
    return null;
  }

  return actor.id ?? actor.userId ?? actor.user_id ?? actor.sub ?? actor._id ?? null;
}

function admissionOwnerId(admission) {
  if (!admission || typeof admission !== 'object') {
    return null;
  }

  return resourceOwnerId(admission, ADMISSION_OWNER_FIELDS);
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

function isDeletedAdmission(admission) {
  return (
    safeStatus(admission?.status) === 'deleted' ||
    admission?.deletedAt != null ||
    admission?.deleted_at != null
  );
}

function hasAdmissionAccess(actor, admission) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    isDeletedAdmission(admission)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:read:any')
  ) {
    return true;
  }

  if (isOwner(actor, admissionOwnerId(admission))) {
    return true;
  }

  const assignedTo =
    admission.assignedCounsellorId ??
    admission.assigned_counsellor_id ??
    admission.assignedTo ??
    admission.assigned_to;

  return Boolean(
    assignedTo != null &&
    sameId(assignedTo, actorUserId(actor)) &&
    hasRole(actor, ...STAFF_ROLES) &&
    hasPermission(actor, 'admissions:read:assigned')
  );
}

function canCreateAdmission(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...APPLICANT_ROLES)) {
    return false;
  }

  const requestedOwner =
    input.applicantId ??
    input.applicant_id ??
    input.candidateId ??
    input.candidate_id ??
    input.userId ??
    input.user_id ??
    input.ownerId ??
    input.owner_id;

  // Public applicants may create records only for themselves.
  // The service must derive the persisted owner from authenticated identity.
  return (
    requestedOwner == null ||
    requestedOwner === '' ||
    isOwner(actor, requestedOwner)
  );
}

function canViewAdmission(actor, admission) {
  return hasAdmissionAccess(actor, admission);
}

function canUpdateAdmission(actor, admission, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    !isPlainObject(changes) ||
    isDeletedAdmission(admission)
  ) {
    return false;
  }

  const keys = Object.keys(changes);

  // Reject protected fields even for privileged callers here.
  // Dedicated review/status/assignment methods must handle those operations.
  if (keys.some((key) => PROTECTED_FIELDS.has(key))) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:update:any')
  ) {
    return true;
  }

  const assignedTo =
    admission.assignedCounsellorId ??
    admission.assigned_counsellor_id ??
    admission.assignedTo ??
    admission.assigned_to;

  const assignedStaff = Boolean(
    assignedTo != null &&
    sameId(assignedTo, actorUserId(actor)) &&
    hasRole(actor, ...STAFF_ROLES) &&
    hasPermission(actor, 'admissions:update:assigned')
  );

  if (assignedStaff) {
    return true;
  }

  return (
    isOwner(actor, admissionOwnerId(admission)) &&
    !['suspended', 'disabled', 'locked', 'banned'].includes(
      safeStatus(actor.status)
    ) &&
    EDITABLE_STATUSES.has(safeStatus(admission.status))
  );
}

function canReviewAdmission(actor, admission) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    isDeletedAdmission(admission)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:review:any')
  ) {
    return true;
  }

  const assignedTo =
    admission.assignedCounsellorId ??
    admission.assigned_counsellor_id ??
    admission.assignedTo ??
    admission.assigned_to;

  return Boolean(
    assignedTo != null &&
    sameId(assignedTo, actorUserId(actor)) &&
    hasRole(actor, 'counsellor') &&
    hasPermission(actor, 'admissions:review:assigned')
  );
}

function canChangeAdmissionStatus(actor, admission, nextStatus) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    typeof nextStatus !== 'string' ||
    isDeletedAdmission(admission)
  ) {
    return false;
  }

  const targetStatus = safeStatus(nextStatus);
  const currentStatus = safeStatus(admission.status);

  if (
    !targetStatus ||
    targetStatus === currentStatus ||
    TERMINAL_STATUSES.has(currentStatus)
  ) {
    return false;
  }

  const hasStatusPermission = Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:status:update:any') ||
    canReviewAdmission(actor, admission)
  );

  if (!hasStatusPermission) {
    return false;
  }

  return (STATUS_TRANSITIONS[currentStatus] || []).includes(targetStatus);
}

function canAssignAdmission(actor, admission, assigneeId) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    isDeletedAdmission(admission) ||
    assigneeId == null ||
    assigneeId === ''
  ) {
    return false;
  }

  if (
    !isAdmin(actor) &&
    !hasPermission(actor, 'admissions:assign')
  ) {
    return false;
  }

  const currentAssignee =
    admission.assignedCounsellorId ??
    admission.assigned_counsellor_id ??
    admission.assignedTo ??
    admission.assigned_to;

  return !sameId(currentAssignee, assigneeId);
}

function canDeleteAdmission(actor, admission) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    isDeletedAdmission(admission)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'admissions:delete:any')
  ) {
    return true;
  }

  return Boolean(
    isOwner(actor, admissionOwnerId(admission)) &&
    EDITABLE_STATUSES.has(safeStatus(admission.status)) &&
    hasPermission(actor, 'admissions:delete:self')
  );
}

function canSetAdmissionDecision(actor, admission, decision) {
  if (
    !isActiveActor(actor) ||
    !admission ||
    typeof admission !== 'object' ||
    typeof decision !== 'string' ||
    !VALID_DECISIONS.has(safeStatus(decision)) ||
    !canReviewAdmission(actor, admission)
  ) {
    return false;
  }

  return REVIEWABLE_STATUSES.has(safeStatus(admission.status));
}

function canExportAdmissions(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'admissions:export')
    )
  );
}

module.exports = Object.freeze({
  APPLICANT_ROLES,
  STAFF_ROLES,
  ADMISSION_OWNER_FIELDS,
  PROTECTED_FIELDS,
  EDITABLE_STATUSES,
  REVIEWABLE_STATUSES,
  TERMINAL_STATUSES,
  VALID_DECISIONS,
  STATUS_TRANSITIONS,
  admissionOwnerId,
  hasAdmissionAccess,
  canCreateAdmission,
  canViewAdmission,
  canUpdateAdmission,
  canReviewAdmission,
  canChangeAdmissionStatus,
  canAssignAdmission,
  canDeleteAdmission,
  canSetAdmissionDecision,
  canExportAdmissions,
});