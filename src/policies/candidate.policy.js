
'use strict';

/**
 * MedOrbits -- Candidate Authorization Policies
 *
 * File: src/policies/candidate.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls candidate profile creation, visibility, updates, deletion,
 * employer access to application records, and candidate data exports.
 *
 * Actor identity, roles, and permissions must come from trusted
 * authentication middleware. Services must enforce input validation,
 * ownership constraints, field-level response filtering, and database
 * consistency.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  resourceOwnerId,
} = require('./policy-utils');

const CANDIDATE_OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'accountId',
  'account_id',
]);

const PROTECTED_CANDIDATE_FIELDS = new Set([
  'id',
  '_id',
  'candidateId',
  'candidate_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'accountId',
  'account_id',
  'role',
  'roles',
  'isAdmin',
  'is_admin',
  'permissions',
  'verified',
  'isVerified',
  'is_verified',
  'verificationStatus',
  'verification_status',
  'moderationStatus',
  'moderation_status',
  'status',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'deletedAt',
  'deleted_at',
  'resumeDocumentId',
  'resume_document_id',
  'hasActiveApplications',
  'has_active_applications',
  'hasOutstandingPayments',
  'has_outstanding_payments',
]);

const APPLICANT_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
]);

const DISCOVERY_ROLES = Object.freeze([
  'employer',
  'recruiter',
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

function isDeletedCandidate(candidate) {
  const status = typeof candidate?.status === 'string'
    ? candidate.status.trim().toLowerCase()
    : '';

  return (
    status === 'deleted' ||
    candidate?.deletedAt != null ||
    candidate?.deleted_at != null
  );
}

function candidateOwnerId(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  // Do not use candidate.id or candidate._id as ownership fallbacks:
  // those may identify the profile record rather than its user.
  return resourceOwnerId(candidate, CANDIDATE_OWNER_FIELDS);
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) => {
    if (PROTECTED_CANDIDATE_FIELDS.has(key)) {
      return true;
    }

    const snakeCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return PROTECTED_CANDIDATE_FIELDS.has(snakeCase);
  });
}

function canCreateCandidateProfile(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'candidates:create:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...APPLICANT_ROLES)) {
    return false;
  }

  const target =
    input.userId ??
    input.user_id ??
    input.ownerId ??
    input.owner_id ??
    input.accountId ??
    input.account_id;

  // The service must persist the authenticated actor's ID as owner.
  // A client-supplied owner identifier must never establish ownership.
  return (
    target == null ||
    target === '' ||
    (
      actorId(actor) != null &&
      isOwner(actor, target)
    )
  );
}

function canViewCandidate(actor, candidate) {
  if (
    !isActiveActor(actor) ||
    !candidate ||
    typeof candidate !== 'object' ||
    isDeletedCandidate(candidate)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'candidates:read:any')
  ) {
    return true;
  }

  if (
    candidateOwnerId(candidate) != null &&
    isOwner(actor, candidateOwnerId(candidate))
  ) {
    return true;
  }

  const discoverable =
    candidate.profileVisibility === 'public' &&
    candidate.allowRecruiterDiscovery === true;

  return Boolean(
    discoverable &&
    hasRole(actor, ...DISCOVERY_ROLES) &&
    hasPermission(actor, 'candidates:discover')
  );
}

function canUpdateCandidate(actor, candidate, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !candidate ||
    typeof candidate !== 'object' ||
    isDeletedCandidate(candidate) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'candidates:update:any')
  ) {
    return true;
  }

  return Boolean(
    candidateOwnerId(candidate) != null &&
    isOwner(actor, candidateOwnerId(candidate))
  );
}

function canDeleteCandidate(actor, candidate) {
  if (
    !isActiveActor(actor) ||
    !candidate ||
    typeof candidate !== 'object' ||
    isDeletedCandidate(candidate)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'candidates:delete:any')
  ) {
    return true;
  }

  return Boolean(
    candidateOwnerId(candidate) != null &&
    isOwner(actor, candidateOwnerId(candidate)) &&
    candidate.hasActiveApplications !== true &&
    candidate.hasOutstandingPayments !== true
  );
}

function canEmployerViewCandidateApplication(actor, candidate, application) {
  if (
    !isActiveActor(actor) ||
    !candidate ||
    typeof candidate !== 'object' ||
    !application ||
    typeof application !== 'object' ||
    isDeletedCandidate(candidate)
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
    !hasRole(actor, ...DISCOVERY_ROLES) ||
    !hasPermission(actor, 'applications:read:employer')
  ) {
    return false;
  }

  const employerId =
    actor.employerId ??
    actor.employer_id;

  const applicationEmployerId =
    application.employerId ??
    application.employer_id ??
    application.jobEmployerId ??
    application.job_employer_id;

  const candidateUserId = candidateOwnerId(candidate);

  const applicationCandidateId =
    application.candidateId ??
    application.candidate_id ??
    application.applicantId ??
    application.applicant_id ??
    application.userId ??
    application.user_id;

  // Require the application to match both the authenticated employer
  // and the candidate's actual user identity. A profile-record ID alone
  // is not sufficient proof that the candidate submitted the application.
  return Boolean(
    employerId != null &&
    applicationEmployerId != null &&
    candidateUserId != null &&
    applicationCandidateId != null &&
    sameId(employerId, applicationEmployerId) &&
    sameId(candidateUserId, applicationCandidateId)
  );
}

function canExportCandidateData(actor, candidate) {
  if (
    !isActiveActor(actor) ||
    !candidate ||
    typeof candidate !== 'object' ||
    isDeletedCandidate(candidate)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'candidates:export:any')
  ) {
    return true;
  }

  return Boolean(
    candidateOwnerId(candidate) != null &&
    isOwner(actor, candidateOwnerId(candidate)) &&
    hasPermission(actor, 'candidates:export:self')
  );
}

module.exports = Object.freeze({
  CANDIDATE_OWNER_FIELDS,
  PROTECTED_CANDIDATE_FIELDS,
  APPLICANT_ROLES,
  DISCOVERY_ROLES,
  actorId,
  candidateOwnerId,
  hasProtectedChanges,
  canCreateCandidateProfile,
  canViewCandidate,
  canUpdateCandidate,
  canDeleteCandidate,
  canEmployerViewCandidateApplication,
  canExportCandidateData,
});
