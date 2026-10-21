
'use strict';

/**
 * MedOrbits -- Internship Authorization Policy
 *
 * File: src/policies/internship.policy.js
 * Runtime: Node.js >= 20
 *
 * Authorization rules for internship records and applicant access.
 *
 * Important:
 * - Derive actor identity and permissions from trusted authentication data.
 * - Never trust ownership, employer IDs, status, or protected fields supplied
 *   by the client.
 * - Perform protected state transitions through dedicated service methods.
 * - Enforce database-level ownership and state checks during writes.
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

const OWNER_FIELDS = Object.freeze([
  'ownerId',
  'owner_id',
  'createdBy',
  'created_by',
  'managedBy',
  'managed_by',
]);

const EMPLOYER_FIELDS = Object.freeze([
  'employerId',
  'employer_id',
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
  'internshipId',
  'internship_id',
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

  const status = safeStatus(actor.status);

  return ![
    'disabled',
    'suspended',
    'inactive',
    'deleted',
    'blocked',
  ].includes(status);
}

function internshipStatus(internship) {
  return safeStatus(internship && internship.status);
}

function isDeletedInternship(internship) {
  return internshipStatus(internship) === 'deleted';
}

function internshipOwnerId(internship) {
  if (!isPlainObject(internship)) {
    return null;
  }

  return resourceOwnerId(internship, [
    ...EMPLOYER_FIELDS,
    ...OWNER_FIELDS,
  ]);
}

function internshipEmployerId(internship) {
  if (!isPlainObject(internship)) {
    return null;
  }

  for (const field of EMPLOYER_FIELDS) {
    if (internship[field] != null) {
      return internship[field];
    }
  }

  return null;
}

function isInternshipOwner(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship)
  ) {
    return false;
  }

  const employerId = internshipEmployerId(internship);
  const actorEmployerId = actor.employerId ?? actor.employer_id;

  if (
    employerId != null &&
    actorEmployerId != null &&
    sameId(actorEmployerId, employerId) &&
    hasRole(actor, 'employer')
  ) {
    return true;
  }

  const ownerId = resourceOwnerId(internship, OWNER_FIELDS);

  return ownerId != null &&
    actorId(actor) != null &&
    sameId(actorId(actor), ownerId);
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) =>
    PROTECTED_FIELDS.has(key)
  );
}

function canViewInternship(actor, internship) {
  if (!isPlainObject(internship) || isDeletedInternship(internship)) {
    return false;
  }

  const status = internshipStatus(internship);

  // Public listing access does not require authentication.
  if (status === 'published') {
    return true;
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:read:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) ||
    hasPermission(actor, 'internships:read:private')
  );
}

function canCreateInternship(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:create:any')
  ) {
    return true;
  }

  return Boolean(
    hasRole(actor, 'employer') &&
    (actor.employerId ?? actor.employer_id) != null &&
    hasPermission(actor, 'internships:create:own-employer')
  );
}

function canUpdateInternship(actor, internship, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    isDeletedInternship(internship) ||
    !isPlainObject(changes) ||
    Object.keys(changes).length === 0 ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:update:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    EDITABLE_STATUSES.has(internshipStatus(internship)) &&
    hasPermission(actor, 'internships:update:own-employer')
  );
}

function canPublishInternship(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    !PUBLISHABLE_STATUSES.has(internshipStatus(internship))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:publish:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'internships:publish:own-employer')
  );
}

function canPauseInternship(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    internshipStatus(internship) !== 'published'
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:pause:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'internships:pause:own-employer')
  );
}

function canCloseInternship(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    !CLOSABLE_STATUSES.has(internshipStatus(internship))
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:close:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'internships:close:own-employer')
  );
}

function canMarkInternshipFilled(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    internshipStatus(internship) !== 'published'
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:mark-filled:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'internships:mark-filled:own-employer')
  );
}

function canDeleteInternship(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    isDeletedInternship(internship)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internships:delete:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    internshipStatus(internship) === 'draft' &&
    hasPermission(actor, 'internships:delete:own-employer')
  );
}

function canViewInternshipApplicants(actor, internship) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(internship) ||
    isDeletedInternship(internship)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'internship-applications:read:any')
  ) {
    return true;
  }

  return Boolean(
    isInternshipOwner(actor, internship) &&
    hasRole(actor, 'employer') &&
    hasPermission(actor, 'internship-applications:read:employer')
  );
}

function canExportInternships(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'internships:export')
    )
  );
}

module.exports = Object.freeze({
  internshipOwnerId,
  internshipEmployerId,
  isInternshipOwner,
  canViewInternship,
  canCreateInternship,
  canUpdateInternship,
  canPublishInternship,
  canPauseInternship,
  canCloseInternship,
  canMarkInternshipFilled,
  canDeleteInternship,
  canViewInternshipApplicants,
  canExportInternships,
});
