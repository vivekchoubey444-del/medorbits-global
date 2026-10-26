
'use strict';

/**
 * MedOrbits -- University Authorization Policy
 *
 * File: src/policies/university.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls university visibility, ownership, editing, publication,
 * verification, lifecycle transitions, deletion, and exports.
 *
 * Protected fields and lifecycle transitions must be enforced by
 * dedicated service methods and database-level checks.
 */

const {
  isAdmin,
  hasPermission,
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

const EDITABLE_STATUSES = new Set([
  'draft',
  'published',
  'archived',
]);

const PUBLISHABLE_STATUSES = new Set([
  'draft',
  'archived',
]);

const HIDDEN_STATUSES = new Set([
  'deleted',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'universityId',
  'university_id',
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
  'archivedAt',
  'archived_at',
  'deletedAt',
  'deleted_at',
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

function universityStatus(university) {
  return safeStatus(university && university.status);
}

function isDeletedUniversity(university) {
  return HIDDEN_STATUSES.has(universityStatus(university));
}

function universityOwnerId(university) {
  if (!isPlainObject(university)) {
    return null;
  }

  return resourceOwnerId(university, OWNER_FIELDS);
}

function isUniversityOwner(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university)
  ) {
    return false;
  }

  const ownerId = universityOwnerId(university);
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

function canViewUniversity(actor, university) {
  if (
    !isPlainObject(university) ||
    isDeletedUniversity(university)
  ) {
    return false;
  }

  if (universityStatus(university) === 'published') {
    return true;
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'universities:read:any')
  ) {
    return true;
  }

  return Boolean(
    isUniversityOwner(actor, university) ||
    hasPermission(actor, 'universities:read:private')
  );
}

function canCreateUniversity(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:create')
  );
}

function canUpdateUniversity(actor, university, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    isDeletedUniversity(university) ||
    !isPlainObject(changes) ||
    Object.keys(changes).length === 0 ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'universities:update:any')
  ) {
    return true;
  }

  return Boolean(
    isUniversityOwner(actor, university) &&
    EDITABLE_STATUSES.has(universityStatus(university)) &&
    hasPermission(actor, 'universities:update:own')
  );
}

function canPublishUniversity(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    !PUBLISHABLE_STATUSES.has(universityStatus(university))
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:publish')
  );
}

function canArchiveUniversity(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    universityStatus(university) !== 'published'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:archive')
  );
}

function canRestoreUniversity(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    universityStatus(university) !== 'archived'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:restore')
  );
}

function canVerifyUniversity(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    isDeletedUniversity(university)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:verify')
  );
}

function canDeleteUniversity(actor, university) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(university) ||
    isDeletedUniversity(university)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'universities:delete')
  );
}

function canExportUniversities(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'universities:export')
    )
  );
}

module.exports = Object.freeze({
  universityOwnerId,
  isUniversityOwner,
  canViewUniversity,
  canCreateUniversity,
  canUpdateUniversity,
  canPublishUniversity,
  canArchiveUniversity,
  canRestoreUniversity,
  canVerifyUniversity,
  canDeleteUniversity,
  canExportUniversities,
});
