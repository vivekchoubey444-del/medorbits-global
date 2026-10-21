
'use strict';

/**
 * MedOrbits -- Shared Policy Utilities
 *
 * File: src/policies/policy-utils.js
 * Runtime: Node.js >= 20
 *
 * Shared identity, role, permission, ownership, and status helpers.
 *
 * Security requirements:
 * - Actor roles and permissions must originate from trusted server-side
 *   authentication/authorization data.
 * - Never build an actor object directly from request-body fields.
 * - Unknown identifiers and malformed inputs fail closed.
 */

const ROLE_ALIASES = Object.freeze({
  super_admin: 'superadmin',
  superadmin: 'superadmin',
  administrator: 'admin',
  admin: 'admin',
  student: 'student',
  applicant: 'candidate',
  candidate: 'candidate',
  employer: 'employer',
  counsellor: 'counsellor',
  counselor: 'counsellor',
  recruiter: 'recruiter',
  support: 'support',
  user: 'user',
});

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const ROLE_LIST_FIELDS = Object.freeze([
  'roles',
]);

const ROLE_SINGLE_FIELDS = Object.freeze([
  'role',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function normalizeId(value, depth = 0) {
  if (
    value === null ||
    value === undefined ||
    depth > 3
  ) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return String(value);
  }

  if (typeof value === 'bigint') {
    return String(value);
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  // Support common database identifier wrappers without invoking
  // arbitrary toString/valueOf methods.
  if (
    value._bsontype === 'ObjectId' &&
    typeof value.toHexString === 'function'
  ) {
    try {
      const hex = value.toHexString();

      return (
        typeof hex === 'string' &&
        OBJECT_ID_PATTERN.test(hex)
      )
        ? hex.toLowerCase()
        : null;
    } catch {
      return null;
    }
  }

  // Avoid recursive self-references and arbitrary coercion.
  for (const key of ['id', '_id']) {
    if (
      Object.prototype.hasOwnProperty.call(value, key) &&
      value[key] !== value
    ) {
      const normalized = normalizeId(value[key], depth + 1);

      if (normalized !== null) {
        return normalized;
      }
    }
  }

  return null;
}

function actorId(actor) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
    return null;
  }

  // Prefer the canonical authenticated account ID. If it exists but
  // is malformed, do not silently fall back to a different identity.
  const candidates = [
    actor.id,
    actor.userId,
    actor.user_id,
    actor.sub,
    actor._id,
  ];

  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && candidate !== '') {
      return normalizeId(candidate);
    }
  }

  return null;
}

function normalizeRole(role) {
  if (typeof role !== 'string') {
    return null;
  }

  const normalized = role.trim().toLowerCase();

  if (!normalized || normalized.length > 64) {
    return null;
  }

  return ROLE_ALIASES[normalized] || normalized;
}

function actorRoles(actor) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
    return [];
  }

  const rawRoles = [];

  for (const field of ROLE_LIST_FIELDS) {
    if (Array.isArray(actor[field])) {
      rawRoles.push(...actor[field]);
    }
  }

  for (const field of ROLE_SINGLE_FIELDS) {
    if (actor[field] != null) {
      rawRoles.push(actor[field]);
    }
  }

  return [
    ...new Set(
      rawRoles
        .map(normalizeRole)
        .filter(Boolean)
    ),
  ];
}

function hasRole(actor, ...roles) {
  if (
    !actor ||
    typeof actor !== 'object' ||
    roles.length === 0
  ) {
    return false;
  }

  const currentRoles = actorRoles(actor);

  if (currentRoles.length === 0) {
    return false;
  }

  const expectedRoles = roles
    .map(normalizeRole)
    .filter(Boolean);

  return expectedRoles.some((role) =>
    currentRoles.includes(role)
  );
}

function hasPermission(actor, permission) {
  if (
    !actor ||
    typeof actor !== 'object' ||
    typeof permission !== 'string'
  ) {
    return false;
  }

  const requestedPermission = permission.trim();

  if (
    !requestedPermission ||
    requestedPermission.length > 256
  ) {
    return false;
  }

  // Superadmin is a trusted, server-assigned role. Never accept this
  // role directly from client-submitted profile or request data.
  if (hasRole(actor, 'superadmin')) {
    return true;
  }

  if (!Array.isArray(actor.permissions)) {
    return false;
  }

  return actor.permissions.some(
    (item) =>
      typeof item === 'string' &&
      item === requestedPermission
  );
}

function isAdmin(actor) {
  return Boolean(
    hasRole(actor, 'admin', 'superadmin') ||
    hasPermission(actor, 'platform:admin')
  );
}

function sameId(left, right) {
  const a = normalizeId(left);
  const b = normalizeId(right);

  return a !== null && b !== null && a === b;
}

function isOwner(actor, ownerId) {
  const currentActorId = actorId(actor);

  return (
    currentActorId !== null &&
    sameId(currentActorId, ownerId)
  );
}

function resourceOwnerId(
  resource,
  keys = [
    'userId',
    'user_id',
    'ownerId',
    'owner_id',
    'createdBy',
    'created_by',
    'candidateId',
    'candidate_id',
  ]
) {
  if (
    !resource ||
    typeof resource !== 'object' ||
    Array.isArray(resource) ||
    !Array.isArray(keys)
  ) {
    return null;
  }

  for (const key of keys) {
    if (
      typeof key !== 'string' ||
      !key ||
      !Object.prototype.hasOwnProperty.call(resource, key)
    ) {
      continue;
    }

    const id = normalizeId(resource[key]);

    if (id !== null) {
      return id;
    }
  }

  return null;
}

function hasAnyPermission(actor, permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return false;
  }

  return permissions.some((permission) =>
    hasPermission(actor, permission)
  );
}

function safeStatus(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = value.trim().toLowerCase();

  return normalized.length <= 64 ? normalized : '';
}

function denyUnless(condition) {
  return condition === true;
}

module.exports = Object.freeze({
  normalizeId,
  actorId,
  normalizeRole,
  actorRoles,
  hasRole,
  hasPermission,
  isAdmin,
  sameId,
  isOwner,
  resourceOwnerId,
  hasAnyPermission,
  safeStatus,
  denyUnless,
});
