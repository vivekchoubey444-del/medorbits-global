
'use strict';

/**
 * MedOrbits -- College Authorization Policies
 *
 * File: src/policies/college.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls college visibility, creation, updates, publishing,
 * archiving, restoration, verification, deletion, and exports.
 *
 * Trusted actor identity and permissions must be established by
 * authentication middleware. Services must validate input schemas,
 * publication readiness, status transitions, and database ownership.
 */

const {
  isAdmin,
  hasPermission,
  sameId,
  actorId,
  safeStatus,
} = require('./policy-utils');

const COLLEGE_OWNER_FIELDS = Object.freeze([
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
  'archived',
]);

const HIDDEN_STATUSES = new Set([
  'deleted',
]);

const PROTECTED_FIELDS = new Set([
  'id',
  '_id',
  'collegeId',
  'college_id',
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

  const status = safeStatus(actor.status);

  return (
    actor.isDisabled !== true &&
    actor.isSuspended !== true &&
    actor.isLocked !== true &&
    actor.deletedAt == null &&
    actor.deleted_at == null &&
    !['disabled', 'suspended', 'locked', 'deleted', 'banned'].includes(status)
  );
}

function isDeletedCollege(college) {
  return (
    safeStatus(college?.status) === 'deleted' ||
    college?.deletedAt != null ||
    college?.deleted_at != null
  );
}

function collegeOwnerId(college) {
  if (!college || typeof college !== 'object') {
    return null;
  }

  for (const field of COLLEGE_OWNER_FIELDS) {
    const value = college[field];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function isCollegeOwner(actor, college) {
  if (
    !actor ||
    !college ||
    typeof college !== 'object'
  ) {
    return false;
  }

  const ownerId = collegeOwnerId(college);
  const currentActorId = actorId(actor);

  return (
    ownerId != null &&
    currentActorId != null &&
    sameId(currentActorId, ownerId)
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

/**
 * Public access is limited to published colleges.
 * Deleted records are never visible through this policy.
 */
function canViewCollege(actor, college) {
  if (
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college)
  ) {
    return false;
  }

  if (
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'colleges:read:any')
    )
  ) {
    return true;
  }

  if (PUBLIC_STATUSES.has(safeStatus(college.status))) {
    return true;
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  return Boolean(
    isCollegeOwner(actor, college) ||
    hasPermission(actor, 'colleges:read:private')
  );
}

/**
 * Creates a college record.
 * The service must assign ownership using trusted server-side data.
 */
function canCreateCollege(actor, input = {}) {
  if (!isActiveActor(actor) || !isPlainObject(input)) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:create')
  );
}

/**
 * Updates ordinary college fields only.
 * Status, ownership, and verification changes use dedicated methods.
 */
function canUpdateCollege(actor, college, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:update:any')
  ) {
    return true;
  }

  return Boolean(
    isCollegeOwner(actor, college) &&
    EDITABLE_STATUSES.has(safeStatus(college.status))
  );
}

/**
 * Publishing requires explicit permission and service-level readiness
 * checks, such as required fields and verification requirements.
 */
function canPublishCollege(actor, college) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college) ||
    !['draft', 'archived'].includes(safeStatus(college.status))
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:publish')
  );
}

function canArchiveCollege(actor, college) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college) ||
    safeStatus(college.status) !== 'published'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:archive')
  );
}

/**
 * Restores an archived college to draft status.
 * Restoration does not automatically publish the record.
 */
function canRestoreCollege(actor, college) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college) ||
    safeStatus(college.status) !== 'archived'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:restore')
  );
}

function canVerifyCollege(actor, college) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:verify')
  );
}

/**
 * Prefer soft deletion and preserve records referenced by applications
 * or historical admissions.
 */
function canDeleteCollege(actor, college) {
  if (
    !isActiveActor(actor) ||
    !college ||
    typeof college !== 'object' ||
    isDeletedCollege(college)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'colleges:delete')
  );
}

function canExportColleges(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'colleges:export')
    )
  );
}

module.exports = Object.freeze({
  COLLEGE_OWNER_FIELDS,
  PUBLIC_STATUSES,
  EDITABLE_STATUSES,
  HIDDEN_STATUSES,
  PROTECTED_FIELDS,
  collegeOwnerId,
  isCollegeOwner,
  hasProtectedChanges,
  canViewCollege,
  canCreateCollege,
  canUpdateCollege,
  canPublishCollege,
  canArchiveCollege,
  canRestoreCollege,
  canVerifyCollege,
  canDeleteCollege,
  canExportColleges,
});
