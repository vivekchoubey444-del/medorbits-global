
/**
 * MedOrbits -- Permissions & Access Control
 * File: /assets/js/permissions.js
 * Version: 1.1.0
 *
 * Frontend permission helpers only.
 * All permissions must also be enforced by the backend.
 */

(() => {
  "use strict";

  if (window.MedOrbitsPermissions) return;

  const CONSTANTS = window.MedOrbitsConstants || {};

  const ROLES = Object.freeze({
    GUEST: "guest",
    STUDENT: "student",
    CANDIDATE: "candidate",
    EMPLOYER: "employer",
    COUNSELLOR: "counsellor",
    RECRUITER: "recruiter",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin",
    ...(CONSTANTS.AUTH?.ROLES || {})
  });

  const PERMISSIONS = Object.freeze({
    PROFILE_READ: "profile:read",
    PROFILE_UPDATE: "profile:update",
    ACCOUNT_DELETE: "account:delete",

    APPLICATION_READ: "application:read",
    APPLICATION_CREATE: "application:create",
    APPLICATION_UPDATE: "application:update",
    APPLICATION_DELETE: "application:delete",
    APPLICATION_REVIEW: "application:review",

    COUNSELLING_READ: "counselling:read",
    COUNSELLING_MANAGE: "counselling:manage",

    DOCUMENT_READ: "document:read",
    DOCUMENT_UPLOAD: "document:upload",
    DOCUMENT_DELETE: "document:delete",
    DOCUMENT_VERIFY: "document:verify",

    COURSE_READ: "course:read",
    COURSE_CREATE: "course:create",
    COURSE_UPDATE: "course:update",
    COURSE_DELETE: "course:delete",

    COLLEGE_READ: "college:read",
    COLLEGE_MANAGE: "college:manage",

    JOB_READ: "job:read",
    JOB_CREATE: "job:create",
    JOB_UPDATE: "job:update",
    JOB_DELETE: "job:delete",
    JOB_PUBLISH: "job:publish",

    CANDIDATE_READ: "candidate:read",
    CANDIDATE_MANAGE: "candidate:manage",

    EMPLOYER_READ: "employer:read",
    EMPLOYER_MANAGE: "employer:manage",

    RECRUITMENT_MANAGE: "recruitment:manage",

    PAYMENT_READ: "payment:read",
    PAYMENT_MANAGE: "payment:manage",
    REFUND_MANAGE: "refund:manage",

    SUBSCRIPTION_READ: "subscription:read",
    SUBSCRIPTION_MANAGE: "subscription:manage",

    SUPPORT_READ: "support:read",
    SUPPORT_MANAGE: "support:manage",

    USER_READ: "user:read",
    USER_MANAGE: "user:manage",
    ROLE_MANAGE: "role:manage",
    SETTINGS_MANAGE: "settings:manage",
    AUDIT_READ: "audit:read"
  });

  const ROLE_PERMISSIONS = Object.freeze({
    [ROLES.GUEST]: Object.freeze([
      PERMISSIONS.COURSE_READ,
      PERMISSIONS.COLLEGE_READ,
      PERMISSIONS.JOB_READ
    ]),

    [ROLES.STUDENT]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.ACCOUNT_DELETE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_UPDATE,
      PERMISSIONS.COUNSELLING_READ,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_UPLOAD,
      PERMISSIONS.COURSE_READ,
      PERMISSIONS.COLLEGE_READ,
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.SUBSCRIPTION_READ
    ]),

    [ROLES.CANDIDATE]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.ACCOUNT_DELETE,
      PERMISSIONS.JOB_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_CREATE,
      PERMISSIONS.APPLICATION_UPDATE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_UPLOAD,
      PERMISSIONS.SUBSCRIPTION_READ
    ]),

    [ROLES.EMPLOYER]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.JOB_READ,
      PERMISSIONS.JOB_CREATE,
      PERMISSIONS.JOB_UPDATE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.CANDIDATE_READ,
      PERMISSIONS.SUBSCRIPTION_READ,
      PERMISSIONS.PAYMENT_READ
    ]),

    [ROLES.COUNSELLOR]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.COURSE_READ,
      PERMISSIONS.COLLEGE_READ,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_REVIEW,
      PERMISSIONS.COUNSELLING_READ,
      PERMISSIONS.COUNSELLING_MANAGE,
      PERMISSIONS.DOCUMENT_READ
    ]),

    [ROLES.RECRUITER]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.JOB_READ,
      PERMISSIONS.JOB_CREATE,
      PERMISSIONS.JOB_UPDATE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.CANDIDATE_READ,
      PERMISSIONS.CANDIDATE_MANAGE,
      PERMISSIONS.RECRUITMENT_MANAGE
    ]),

    [ROLES.ADMIN]: Object.freeze([
      PERMISSIONS.PROFILE_READ,
      PERMISSIONS.PROFILE_UPDATE,
      PERMISSIONS.APPLICATION_READ,
      PERMISSIONS.APPLICATION_REVIEW,
      PERMISSIONS.APPLICATION_UPDATE,
      PERMISSIONS.COUNSELLING_READ,
      PERMISSIONS.COUNSELLING_MANAGE,
      PERMISSIONS.DOCUMENT_READ,
      PERMISSIONS.DOCUMENT_VERIFY,
      PERMISSIONS.COURSE_READ,
      PERMISSIONS.COURSE_CREATE,
      PERMISSIONS.COURSE_UPDATE,
      PERMISSIONS.COLLEGE_READ,
      PERMISSIONS.COLLEGE_MANAGE,
      PERMISSIONS.JOB_READ,
      PERMISSIONS.JOB_CREATE,
      PERMISSIONS.JOB_UPDATE,
      PERMISSIONS.JOB_PUBLISH,
      PERMISSIONS.CANDIDATE_READ,
      PERMISSIONS.CANDIDATE_MANAGE,
      PERMISSIONS.EMPLOYER_READ,
      PERMISSIONS.EMPLOYER_MANAGE,
      PERMISSIONS.RECRUITMENT_MANAGE,
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.SUBSCRIPTION_READ,
      PERMISSIONS.SUPPORT_READ,
      PERMISSIONS.SUPPORT_MANAGE,
      PERMISSIONS.USER_READ,
      PERMISSIONS.USER_MANAGE,
      PERMISSIONS.AUDIT_READ
    ]),

    [ROLES.SUPER_ADMIN]: Object.freeze(
      Object.values(PERMISSIONS)
    )
  });

  const ROLE_HIERARCHY = Object.freeze({
    [ROLES.GUEST]: 0,
    [ROLES.STUDENT]: 1,
    [ROLES.CANDIDATE]: 1,
    [ROLES.EMPLOYER]: 1,
    [ROLES.COUNSELLOR]: 2,
    [ROLES.RECRUITER]: 2,
    [ROLES.ADMIN]: 3,
    [ROLES.SUPER_ADMIN]: 4
  });

  const permissionSets = new Map(
    Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => [
      role,
      new Set(permissions)
    ])
  );

  const knownRoles = new Set(Object.values(ROLES));
  const knownPermissions = new Set(Object.values(PERMISSIONS));

  let initialized = false;

  function normalizeRole(role) {
    if (typeof role !== "string") return ROLES.GUEST;

    const normalized = role.trim().toLowerCase();

    return knownRoles.has(normalized)
      ? normalized
      : ROLES.GUEST;
  }

  function normalizePermission(permission) {
    return typeof permission === "string"
      ? permission.trim().toLowerCase()
      : "";
  }

  function getAuth() {
    return window.MedOrbitsAuth || null;
  }

  function getCurrentUser() {
    try {
      const auth = getAuth();

      if (!auth || typeof auth.currentUser !== "function") {
        return null;
      }

      const user = auth.currentUser();

      return user && typeof user === "object" ? user : null;
    } catch (_) {
      return null;
    }
  }

  function isAuthenticated() {
    try {
      const auth = getAuth();

      return Boolean(
        auth &&
        typeof auth.isAuthenticated === "function" &&
        auth.isAuthenticated() === true &&
        getCurrentUser()
      );
    } catch (_) {
      return false;
    }
  }

  function getRole() {
    if (!isAuthenticated()) {
      return ROLES.GUEST;
    }

    const user = getCurrentUser();

    return normalizeRole(
      user?.role ||
      user?.role_name ||
      user?.account_role
    );
  }

  function hasRole(role) {
    const requested = normalizeRole(role);

    if (!knownRoles.has(requested)) {
      return false;
    }

    if (requested === ROLES.GUEST) {
      return !isAuthenticated();
    }

    return isAuthenticated() && getRole() === requested;
  }

  function hasAnyRole(roles = []) {
    if (!Array.isArray(roles)) return false;

    return roles.some((role) => hasRole(role));
  }

  function getPermissions(role = getRole()) {
    const normalized = normalizeRole(role);

    return ROLE_PERMISSIONS[normalized] || [];
  }

  function can(permission) {
    const requested = normalizePermission(permission);

    if (!requested || !knownPermissions.has(requested)) {
      return false;
    }

    const role = getRole();

    if (role === ROLES.GUEST) {
      return permissionSets.get(ROLES.GUEST)?.has(requested) === true;
    }

    if (!isAuthenticated()) {
      return false;
    }

    return permissionSets.get(role)?.has(requested) === true;
  }

  function canAny(permissions = []) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return false;
    }

    return permissions.some((permission) => can(permission));
  }

  function canAll(permissions = []) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return false;
    }

    return permissions.every((permission) => can(permission));
  }

  function hasMinimumRole(requiredRole) {
    if (!isAuthenticated()) return false;

    const currentLevel = ROLE_HIERARCHY[getRole()];
    const requiredLevel = ROLE_HIERARCHY[normalizeRole(requiredRole)];

    if (
      currentLevel === undefined ||
      requiredLevel === undefined
    ) {
      return false;
    }

    return currentLevel >= requiredLevel;
  }

  function canAccessResource(resource, action = "read") {
    if (
      typeof resource !== "string" ||
      typeof action !== "string"
    ) {
      return false;
    }

    const key = `${resource.trim().toLowerCase()}:${action.trim().toLowerCase()}`;

    return can(key);
  }

  function filterByPermission(items, permission) {
    if (!Array.isArray(items) || !can(permission)) {
      return [];
    }

    return items.slice();
  }

  function protectElement(element, options = {}) {
    if (!element || typeof element.setAttribute !== "function") {
      return false;
    }

    const roles = Array.isArray(options.roles)
      ? options.roles
      : [];

    const permissions = Array.isArray(options.permissions)
      ? options.permissions
      : [];

    const requireAll = options.requireAll === true;
    const hide = options.hide !== false;

    const roleAllowed =
      roles.length === 0 || hasAnyRole(roles);

    const permissionAllowed =
      permissions.length === 0 ||
      (requireAll ? canAll(permissions) : canAny(permissions));

    const allowed = roleAllowed && permissionAllowed;

    element.hidden = !allowed && hide;
    element.setAttribute("aria-hidden", String(!allowed));

    if (!allowed) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }

    if ("disabled" in element) {
      element.disabled = !allowed;
    }

    return allowed;
  }

  function parseList(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function applyPagePermissions() {
    document.querySelectorAll("[data-permission]").forEach((element) => {
      protectElement(element, {
        permissions: parseList(element.dataset.permission),
        requireAll: element.dataset.permissionMode === "all"
      });
    });

    document.querySelectorAll("[data-role]").forEach((element) => {
      protectElement(element, {
        roles: parseList(element.dataset.role)
      });
    });

    document.querySelectorAll("[data-minimum-role]").forEach((element) => {
      const allowed = hasMinimumRole(
        element.dataset.minimumRole
      );

      element.hidden = !allowed;
      element.setAttribute("aria-hidden", String(!allowed));
      element.toggleAttribute("inert", !allowed);

      if ("disabled" in element) {
        element.disabled = !allowed;
      }
    });

    window.dispatchEvent(new CustomEvent(
      "medorbits:permissions-applied",
      {
        detail: {
          role: getRole(),
          authenticated: isAuthenticated()
        }
      }
    ));
  }

  function createPermissionError(message = "Permission denied.") {
    const error = new Error(message);

    error.name = "PermissionError";
    error.code = "PERMISSION_DENIED";

    return error;
  }

  function requirePermission(permission) {
    if (can(permission)) return true;

    throw createPermissionError();
  }

  function requireAnyPermission(permissions = []) {
    if (canAny(permissions)) return true;

    throw createPermissionError();
  }

  function requireAllPermissions(permissions = []) {
    if (canAll(permissions)) return true;

    throw createPermissionError();
  }

  function init() {
    applyPagePermissions();

    if (initialized) return;
    initialized = true;

    window.addEventListener(
      "medorbits:auth-change",
      applyPagePermissions
    );

    window.addEventListener(
      "medorbits:auth-changed",
      applyPagePermissions
    );

    window.addEventListener(
      "medorbits:profile-updated",
      applyPagePermissions
    );
  }

  function destroy() {
    if (!initialized) return;

    window.removeEventListener(
      "medorbits:auth-change",
      applyPagePermissions
    );

    window.removeEventListener(
      "medorbits:auth-changed",
      applyPagePermissions
    );

    window.removeEventListener(
      "medorbits:profile-updated",
      applyPagePermissions
    );

    initialized = false;
  }

  const publicAPI = Object.freeze({
    version: "1.1.0",

    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY,

    getCurrentUser,
    getRole,
    getPermissions,
    isAuthenticated,

    hasRole,
    hasAnyRole,
    hasMinimumRole,

    can,
    canAny,
    canAll,
    canAccessResource,

    filterByPermission,
    protectElement,
    applyPagePermissions,

    requirePermission,
    requireAnyPermission,
    requireAllPermissions,

    init,
    destroy
  });

  Object.defineProperty(window, "MedOrbitsPermissions", {
    value: publicAPI,
    writable: false,
    configurable: false,
    enumerable: true
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();
