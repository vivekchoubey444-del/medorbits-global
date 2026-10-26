
'use strict';

/**
 * MedOrbits -- Course Authorization Policies
 *
 * File: src/policies/course.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls course visibility, creation, editing, publishing, archiving,
 * restoration, verification, deletion, and export.
 *
 * Authorization policies do not replace schema validation, database
 * constraints, audit logging, or atomic status transitions.
 */

const {
  isAdmin,
  hasPermission,
  sameId,
  actorId,
  resourceOwnerId,
  safeStatus,
} = require('./policy-utils');

const COURSE_OWNER_FIELDS = Object.freeze([
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

function isDeletedCourse(course) {
  return (
    safeStatus(course?.status) === 'deleted' ||
    course?.deletedAt != null ||
    course?.deleted_at != null
  );
}

function courseOwnerId(course) {
  if (!course || typeof course !== 'object') {
    return null;
  }

  return resourceOwnerId(course, COURSE_OWNER_FIELDS);
}

function isCourseOwner(actor, course) {
  if (!actor || !course || typeof course !== 'object') {
    return false;
  }

  const ownerId = courseOwnerId(course);
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

function canViewCourse(actor, course) {
  if (
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course)
  ) {
    return false;
  }

  if (
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'courses:read:any')
    )
  ) {
    return true;
  }

  if (PUBLIC_STATUSES.has(safeStatus(course.status))) {
    return true;
  }

  if (!isActiveActor(actor)) {
    return false;
  }

  return Boolean(
    isCourseOwner(actor, course) ||
    hasPermission(actor, 'courses:read:private')
  );
}

function canCreateCourse(actor, input = {}) {
  if (
    !isActiveActor(actor) ||
    !isPlainObject(input)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:create')
  );
}

function canUpdateCourse(actor, course, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'courses:update:any')
  ) {
    return true;
  }

  return Boolean(
    isCourseOwner(actor, course) &&
    EDITABLE_STATUSES.has(safeStatus(course.status))
  );
}

function canPublishCourse(actor, course) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course) ||
    !['draft', 'archived'].includes(safeStatus(course.status))
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:publish')
  );
}

function canArchiveCourse(actor, course) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course) ||
    safeStatus(course.status) !== 'published'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:archive')
  );
}

function canRestoreCourse(actor, course) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course) ||
    safeStatus(course.status) !== 'archived'
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:restore')
  );
}

function canVerifyCourse(actor, course) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:verify')
  );
}

function canDeleteCourse(actor, course) {
  if (
    !isActiveActor(actor) ||
    !course ||
    typeof course !== 'object' ||
    isDeletedCourse(course)
  ) {
    return false;
  }

  return Boolean(
    isAdmin(actor) ||
    hasPermission(actor, 'courses:delete')
  );
}

function canExportCourses(actor) {
  return Boolean(
    isActiveActor(actor) &&
    (
      isAdmin(actor) ||
      hasPermission(actor, 'courses:export')
    )
  );
}

module.exports = Object.freeze({
  COURSE_OWNER_FIELDS,
  PUBLIC_STATUSES,
  EDITABLE_STATUSES,
  HIDDEN_STATUSES,
  PROTECTED_FIELDS,
  courseOwnerId,
  isCourseOwner,
  hasProtectedChanges,
  canViewCourse,
  canCreateCourse,
  canUpdateCourse,
  canPublishCourse,
  canArchiveCourse,
  canRestoreCourse,
  canVerifyCourse,
  canDeleteCourse,
  canExportCourses,
});
