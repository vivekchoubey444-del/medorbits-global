
'use strict';

/**
 * MedOrbits -- Document Authorization Policies
 *
 * File: src/policies/document.policy.js
 * Runtime: Node.js >= 20
 *
 * Controls document upload, viewing, metadata updates, review,
 * deletion, and download authorization.
 *
 * These policies do not validate file contents, scan for malware,
 * verify database ownership, or generate signed URLs. Those checks
 * must be performed by the corresponding service.
 */

const {
  isAdmin,
  hasRole,
  hasPermission,
  isOwner,
  sameId,
  resourceOwnerId,
} = require('./policy-utils');

const OWNER_FIELDS = Object.freeze([
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'candidateId',
  'candidate_id',
  'applicantId',
  'applicant_id',
  'uploadedBy',
  'uploaded_by',
]);

const UPLOAD_ROLES = Object.freeze([
  'user',
  'student',
  'candidate',
  'employer',
]);

const REVIEW_ROLES = Object.freeze([
  'counsellor',
  'support',
]);

const PROTECTED_DOCUMENT_FIELDS = new Set([
  'id',
  '_id',
  'documentId',
  'document_id',
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'candidateId',
  'candidate_id',
  'applicantId',
  'applicant_id',
  'uploadedBy',
  'uploaded_by',
  'status',
  'verificationStatus',
  'verification_status',
  'reviewStatus',
  'review_status',
  'reviewerId',
  'reviewer_id',
  'assignedTo',
  'assigned_to',
  'storageKey',
  'storage_key',
  'bucket',
  'url',
  'downloadUrl',
  'download_url',
  'checksum',
  'malwareScanStatus',
  'malware_scan_status',
  'isDeleted',
  'is_deleted',
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

function isDeletedDocument(document) {
  return Boolean(
    document?.isDeleted === true ||
    document?.is_deleted === true ||
    document?.deletedAt != null ||
    document?.deleted_at != null ||
    ['deleted', 'purged'].includes(
      String(document?.status || '').trim().toLowerCase()
    )
  );
}

function documentOwnerId(document) {
  if (!document || typeof document !== 'object') {
    return null;
  }

  return resourceOwnerId(document, OWNER_FIELDS);
}

function hasProtectedChanges(changes) {
  if (!isPlainObject(changes)) {
    return true;
  }

  return Object.keys(changes).some((key) => {
    if (PROTECTED_DOCUMENT_FIELDS.has(key)) {
      return true;
    }

    const snakeCase = key
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase();

    return PROTECTED_DOCUMENT_FIELDS.has(snakeCase);
  });
}

function canUploadDocument(actor, metadata = {}) {
  if (!isActiveActor(actor) || !isPlainObject(metadata)) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'documents:upload:any')
  ) {
    return true;
  }

  if (!hasRole(actor, ...UPLOAD_ROLES)) {
    return false;
  }

  const targetOwner =
    metadata.userId ??
    metadata.user_id ??
    metadata.ownerId ??
    metadata.owner_id ??
    metadata.candidateId ??
    metadata.candidate_id ??
    metadata.applicantId ??
    metadata.applicant_id ??
    metadata.uploadedBy ??
    metadata.uploaded_by;

  // Missing ownership is permitted for self-service uploads only.
  // The service must set the persisted owner from the authenticated actor.
  if (targetOwner == null || targetOwner === '') {
    return true;
  }

  return Boolean(
    actorId(actor) != null &&
    isOwner(actor, targetOwner)
  );
}

function canViewDocument(actor, document) {
  if (
    !isActiveActor(actor) ||
    !document ||
    typeof document !== 'object' ||
    isDeletedDocument(document)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'documents:read:any')
  ) {
    return true;
  }

  const ownerId = documentOwnerId(document);

  if (
    ownerId != null &&
    isOwner(actor, ownerId)
  ) {
    return true;
  }

  const id = actorId(actor);

  if (id == null) {
    return false;
  }

  const assignedTo =
    document.assignedTo ??
    document.assigned_to ??
    document.reviewerId ??
    document.reviewer_id;

  const assignedReviewer = Boolean(
    assignedTo != null &&
    sameId(assignedTo, id) &&
    hasRole(actor, ...REVIEW_ROLES) &&
    hasPermission(actor, 'documents:review:assigned')
  );

  if (assignedReviewer) {
    return true;
  }

  const applicationId =
    document.applicationId ??
    document.application_id;

  const applicationApplicantId =
    document.applicationApplicantId ??
    document.application_applicant_id ??
    document.applicantId ??
    document.applicant_id;

  return Boolean(
    applicationId != null &&
    applicationApplicantId != null &&
    sameId(applicationApplicantId, id) &&
    hasPermission(actor, 'applications:read:assigned')
  );
}

function canUpdateDocument(actor, document, changes = {}) {
  if (
    !isActiveActor(actor) ||
    !document ||
    typeof document !== 'object' ||
    isDeletedDocument(document) ||
    !isPlainObject(changes) ||
    hasProtectedChanges(changes)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'documents:update:any')
  ) {
    return true;
  }

  const ownerId = documentOwnerId(document);

  return Boolean(
    ownerId != null &&
    isOwner(actor, ownerId)
  );
}

function canReviewDocument(actor, document) {
  if (
    !isActiveActor(actor) ||
    !document ||
    typeof document !== 'object' ||
    isDeletedDocument(document)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'documents:review:any')
  ) {
    return true;
  }

  const id = actorId(actor);

  if (id == null) {
    return false;
  }

  const assignedTo =
    document.reviewerId ??
    document.reviewer_id ??
    document.assignedTo ??
    document.assigned_to;

  return Boolean(
    assignedTo != null &&
    sameId(assignedTo, id) &&
    hasRole(actor, ...REVIEW_ROLES) &&
    hasPermission(actor, 'documents:review:assigned')
  );
}

function canDeleteDocument(actor, document) {
  if (
    !isActiveActor(actor) ||
    !document ||
    typeof document !== 'object' ||
    isDeletedDocument(document)
  ) {
    return false;
  }

  if (
    isAdmin(actor) ||
    hasPermission(actor, 'documents:delete:any')
  ) {
    return true;
  }

  const status = String(document.status || '').trim().toLowerCase();
  const ownerId = documentOwnerId(document);

  return Boolean(
    ownerId != null &&
    isOwner(actor, ownerId) &&
    document.requiredForActiveApplication !== true &&
    document.required_for_active_application !== true &&
    !['verified', 'approved', 'locked', 'submitted', 'under_review'].includes(status)
  );
}

function canGenerateDocumentDownload(actor, document) {
  if (
    !isActiveActor(actor) ||
    !document ||
    typeof document !== 'object' ||
    isDeletedDocument(document) ||
    !canViewDocument(actor, document)
  ) {
    return false;
  }

  const status = String(document.status || '').trim().toLowerCase();

  // Default to approved documents only. If your workflow permits
  // applicants to download their own pending/rejected files, implement
  // that exception explicitly in the service and policy.
  if (status !== 'approved') {
    return false;
  }

  const storageKey = document.storageKey ?? document.storage_key;

  return typeof storageKey === 'string' && storageKey.trim().length > 0;
}

module.exports = Object.freeze({
  OWNER_FIELDS,
  UPLOAD_ROLES,
  REVIEW_ROLES,
  PROTECTED_DOCUMENT_FIELDS,
  actorId,
  documentOwnerId,
  hasProtectedChanges,
  canUploadDocument,
  canViewDocument,
  canUpdateDocument,
  canReviewDocument,
  canDeleteDocument,
  canGenerateDocumentDownload,
});
