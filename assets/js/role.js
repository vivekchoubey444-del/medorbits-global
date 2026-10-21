
/**
 * MedOrbits -- Role Management
 * File: /assets/js/role.js
 * Version: 1.1.0
 *
 * Defines application roles, role checks, UI visibility,
 * and role-based navigation helpers.
 *
 * IMPORTANT:
 * Client-side role checks are for UI convenience only.
 * Backend authorization remains mandatory.
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsRole) {
    console.warn("[MedOrbits] Role module already initialized.");
    return;
  }

  const CONSTANTS = window.MedOrbitsConstants || {};
  const ROUTES = CONSTANTS.ROUTES || {};
  const ACCOUNT_ROUTES = ROUTES.ACCOUNT || {};
  const CAREER_ROUTES = ROUTES.CAREER || {};
  const ADMIN_ROUTES = ROUTES.ADMIN || {};

  const ROLES = Object.freeze({
    GUEST: "guest",
    STUDENT: "student",
    CANDIDATE: "candidate",
    EMPLOYER: "employer",
    COUNSELLOR: "counsellor",
    RECRUITER: "recruiter",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin"
  });

  const ROLE_GROUPS = Object.freeze({
    USERS: Object.freeze([
      ROLES.STUDENT,
      ROLES.CANDIDATE
    ]),
    EMPLOYERS: Object.freeze([
      ROLES.EMPLOYER,
      ROLES.RECRUITER
    ]),
    STAFF: Object.freeze([
      ROLES.COUNSELLOR,
      ROLES.RECRUITER,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN
    ]),
    ADMINISTRATORS: Object.freeze([
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN
    ])
  });

  const ROLE_LABELS = Object.freeze({
    [ROLES.GUEST]: "Guest",
    [ROLES.STUDENT]: "Student",
    [ROLES.CANDIDATE]: "Job Candidate",
    [ROLES.EMPLOYER]: "Employer",
    [ROLES.COUNSELLOR]: "Counsellor",
    [ROLES.RECRUITER]: "Recruiter",
    [ROLES.ADMIN]: "Administrator",
    [ROLES.SUPER_ADMIN]: "Super Administrator"
  });

  const ROLE_HOME = Object.freeze({
    [ROLES.GUEST]:
      ROUTES.HOME || "/index.html",

    [ROLES.STUDENT]:
      ACCOUNT_ROUTES.DASHBOARD || "/account/dashboard.html",

    [ROLES.CANDIDATE]:
      ACCOUNT_ROUTES.DASHBOARD || "/account/dashboard.html",

    [ROLES.EMPLOYER]:
      CAREER_ROUTES.EMPLOYER_DASHBOARD ||
      "/career/employer-dashboard.html",

    [ROLES.RECRUITER]:
      CAREER_ROUTES.EMPLOYER_DASHBOARD ||
      "/career/employer-dashboard.html",

    [ROLES.COUNSELLOR]:
      ACCOUNT_ROUTES.COUNSELLING || "/account/counselling.html",

    [ROLES.ADMIN]:
      ADMIN_ROUTES.DASHBOARD || "/admin/dashboard.html",

    [ROLES.SUPER_ADMIN]:
      ADMIN_ROUTES.DASHBOARD || "/admin/dashboard.html"
  });

  const LOGIN_ROUTE =
    ACCOUNT_ROUTES.LOGIN || "/account/login.html";

  function normalizeRole(role) {
    if (typeof role !== "string") {
      return null;
    }

    const normalized = role.trim().toLowerCase();

    return normalized || null;
  }

  function getCurrentUser() {
    const auth = window.MedOrbitsAuth;

    if (!auth) {
      return null;
    }

    try {
      if (typeof auth.currentUser === "function") {
        return auth.currentUser() || null;
      }

      if (
        auth.currentUser &&
        typeof auth.currentUser === "object"
      ) {
        return auth.currentUser;
      }

      if (
        auth.user &&
        typeof auth.user === "object"
      ) {
        return auth.user;
      }
    } catch (error) {
      console.error(
        "[MedOrbits] Unable to retrieve the current user.",
        error
      );
    }

    return null;
  }

  function getCurrentRole() {
    const user = getCurrentUser();

    return normalizeRole(
      user &&
      (
        user.role ||
        user.role_name ||
        user.account_role
      )
    );
  }

  function isValidRole(role) {
    const normalized = normalizeRole(role);

    return normalized !== null &&
      Object.values(ROLES).includes(normalized);
  }

  function hasRole(role) {
    const expected = normalizeRole(role);
    const user = getCurrentUser();

    if (!expected || !user) {
      return false;
    }

    return getCurrentRole() === expected;
  }

  function hasAnyRole(roles) {
    if (!Array.isArray(roles) || !roles.length) {
      return false;
    }

    const currentRole = getCurrentRole();

    if (!getCurrentUser() || !currentRole) {
      return false;
    }

    return roles.some(function (role) {
      return normalizeRole(role) === currentRole;
    });
  }

  function hasAllRoles(roles) {
    if (!Array.isArray(roles) || !roles.length) {
      return false;
    }

    const currentRole = getCurrentRole();

    if (!getCurrentUser() || !currentRole) {
      return false;
    }

    return roles.every(function (role) {
      return normalizeRole(role) === currentRole;
    });
  }

  function isInGroup(group) {
    const roles = ROLE_GROUPS[group];

    return Array.isArray(roles) && hasAnyRole(roles);
  }

  function isAdmin() {
    return isInGroup("ADMINISTRATORS");
  }

  function getRoleLabel(role) {
    const normalized = normalizeRole(
      role === undefined ? getCurrentRole() : role
    );

    return ROLE_LABELS[normalized] || "Unknown Role";
  }

  function getHomeRoute(role) {
    const normalized = normalizeRole(
      role === undefined ? getCurrentRole() : role
    );

    return ROLE_HOME[normalized] || ROLE_HOME[ROLES.GUEST];
  }

  function parseRoleList(value) {
    if (typeof value !== "string" || !value.trim()) {
      return [];
    }

    return value
      .split(",")
      .map(normalizeRole)
      .filter(Boolean);
  }

  function canAccessElement(element) {
    if (
      !element ||
      element.nodeType !== 1 ||
      typeof element.hasAttribute !== "function"
    ) {
      return false;
    }

    const requiredRoles = parseRoleList(
      element.getAttribute("data-roles") || ""
    );

    const excludedRoles = parseRoleList(
      element.getAttribute("data-exclude-roles") || ""
    );

    const user = getCurrentUser();

    if (
      requiredRoles.length &&
      !hasAnyRole(requiredRoles)
    ) {
      return false;
    }

    if (
      excludedRoles.length &&
      excludedRoles.some(function (role) {
        return hasRole(role);
      })
    ) {
      return false;
    }

    if (
      element.hasAttribute("data-auth-required") &&
      !user
    ) {
      return false;
    }

    return true;
  }

  function applyRoleVisibility(root) {
    root = root || document;

    if (typeof root.querySelectorAll !== "function") {
      return;
    }

    const selector = [
      "[data-roles]",
      "[data-exclude-roles]",
      "[data-auth-required]"
    ].join(", ");

    const elements = [];

    if (
      root.nodeType === 1 &&
      typeof root.matches === "function" &&
      root.matches(selector)
    ) {
      elements.push(root);
    }

    root.querySelectorAll(selector).forEach(function (element) {
      elements.push(element);
    });

    elements.forEach(function (element) {
      const allowed = canAccessElement(element);

      element.hidden = !allowed;
      element.setAttribute("aria-hidden", String(!allowed));
    });
  }

  function redirectToRoleHome(role) {
    const route = getHomeRoute(role);

    window.location.assign(route);
  }

  function requireRole(roles, options) {
    options = options || {};

    const allowedRoles = Array.isArray(roles)
      ? roles
      : [roles];

    const user = getCurrentUser();

    if (!user) {
      if (options.redirect !== false) {
        window.location.assign(LOGIN_ROUTE);
      }

      return false;
    }

    if (hasAnyRole(allowedRoles)) {
      return true;
    }

    if (options.redirectOnDenied === true) {
      redirectToRoleHome();
    }

    return false;
  }

  let initialized = false;
  let authChangeHandler = null;

  function init() {
    if (initialized) {
      applyRoleVisibility();
      return;
    }

    initialized = true;
    applyRoleVisibility();

    authChangeHandler = function () {
      applyRoleVisibility();
    };

    document.addEventListener(
      "medorbits:auth-change",
      authChangeHandler
    );

    document.addEventListener(
      "medorbits:auth:changed",
      authChangeHandler
    );
  }

  function destroy() {
    if (authChangeHandler) {
      document.removeEventListener(
        "medorbits:auth-change",
        authChangeHandler
      );

      document.removeEventListener(
        "medorbits:auth:changed",
        authChangeHandler
      );

      authChangeHandler = null;
    }

    initialized = false;
  }

  const MedOrbitsRole = Object.freeze({
    ROLES: ROLES,
    ROLE_GROUPS: ROLE_GROUPS,
    ROLE_LABELS: ROLE_LABELS,
    ROLE_HOME: ROLE_HOME,

    normalizeRole: normalizeRole,
    isValidRole: isValidRole,

    getCurrentUser: getCurrentUser,
    getCurrentRole: getCurrentRole,

    hasRole: hasRole,
    hasAnyRole: hasAnyRole,
    hasAllRoles: hasAllRoles,
    isInGroup: isInGroup,
    isAdmin: isAdmin,

    getRoleLabel: getRoleLabel,
    getHomeRoute: getHomeRoute,

    canAccessElement: canAccessElement,
    applyRoleVisibility: applyRoleVisibility,

    redirectToRoleHome: redirectToRoleHome,
    requireRole: requireRole,

    init: init,
    destroy: destroy
  });

  Object.defineProperty(window, "MedOrbitsRole", {
    value: MedOrbitsRole,
    writable: false,
    configurable: false,
    enumerable: true
  });

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Role = MedOrbitsRole;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})(window, document);
