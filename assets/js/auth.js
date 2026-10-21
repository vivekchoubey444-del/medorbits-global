
/**
 * MedOrbits -- Authentication & Session Manager
 * File: /assets/js/auth.js
 * Version: 1.1.0
 *
 * Responsibilities:
 * - Login and registration
 * - Server-side session management
 * - Session restoration
 * - Email verification and password recovery
 * - Password changes
 * - Authentication state and role helpers
 * - Authentication events and accessible form integration
 *
 * Security:
 * - The server is the source of truth for identity and permissions.
 * - Uses same-origin cookie sessions by default.
 * - Never stores passwords or authentication tokens in localStorage.
 * - Protected endpoints must enforce authorization server-side.
 */

(() => {
  "use strict";

  if (window.MedOrbitsAuth) return;

  // --------------------------------------------------
  // Dependencies and configuration
  // --------------------------------------------------

  const CONSTANTS = window.MedOrbitsConstants || {};
  const API = CONSTANTS.API || {};
  const ROUTES = CONSTANTS.ROUTES || {};
  const AUTH = CONSTANTS.AUTH || {};
  const CONFIG = window.MedOrbitsConfig || {};

  const API_BASE_URL = String(
    CONFIG.API_BASE_URL || API.PREFIX || "/api"
  ).replace(/\/+$/, "");

  const REQUEST_TIMEOUT_MS = Math.max(
    1000,
    Math.min(
      Number(CONFIG.AUTH_TIMEOUT_MS || API.DEFAULT_TIMEOUT_MS || 15000),
      120000
    )
  );

  const DEFAULT_ENDPOINTS = Object.freeze({
    login: "/auth/login",
    register: "/auth/register",
    logout: "/auth/logout",
    session: "/session",
    verifyEmail: "/verification/verify-email",
    resendVerification: "/verification/resend",
    forgotPassword: "/password/forgot",
    resetPassword: "/password/reset",
    changePassword: "/password/change"
  });

  const ENDPOINTS = Object.freeze({
    ...DEFAULT_ENDPOINTS,
    ...(CONFIG.AUTH_ENDPOINTS || {})
  });

  const ROLES = Object.freeze({
    GUEST: "guest",
    STUDENT: "student",
    CANDIDATE: "candidate",
    EMPLOYER: "employer",
    COUNSELLOR: "counsellor",
    RECRUITER: "recruiter",
    ADMIN: "admin",
    SUPER_ADMIN: "super_admin",
    ...(AUTH.ROLES || {})
  });

  const EVENT_AUTH_CHANGE =
    CONSTANTS.EVENTS?.AUTH_CHANGE || "medorbits:auth-change";

  const state = {
    initialized: false,
    authenticated: false,
    loading: false,
    user: null,
    sessionChecked: false,
    lastError: null,
    sessionRequest: null,
    sessionController: null
  };

  const listeners = new Set();
  const boundLoginForms = new WeakSet();
  const boundLogoutButtons = new WeakSet();

  // --------------------------------------------------
  // Errors
  // --------------------------------------------------

  class AuthError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "AuthError";
      this.code = options.code || "AUTH_ERROR";
      this.status = Number(options.status) || 0;
      this.details = options.details ?? null;
    }
  }

  // --------------------------------------------------
  // Utilities
  // --------------------------------------------------

  const utils = {
    isObject(value) {
      return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      );
    },

    normalizeEmail(value) {
      return String(value ?? "").trim().toLowerCase();
    },

    safeString(value) {
      return typeof value === "string" ? value.trim() : "";
    },

    getCsrfToken() {
      return document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content") || "";
    },

    getRole(user) {
      if (!utils.isObject(user)) return null;

      const role =
        user.role ??
        user.role_name ??
        user.account_role ??
        null;

      return typeof role === "string" ? role.trim().toLowerCase() : null;
    },

    getUserId(user) {
      if (!utils.isObject(user)) return null;

      return user.id ?? user.userId ?? user.user_id ?? null;
    },

    sanitizeUser(user) {
      if (!utils.isObject(user)) return null;

      const allowedFields = [
        "id",
        "userId",
        "user_id",
        "name",
        "fullName",
        "full_name",
        "firstName",
        "first_name",
        "lastName",
        "last_name",
        "email",
        "phone",
        "role",
        "role_name",
        "account_role",
        "status",
        "emailVerified",
        "email_verified",
        "avatar",
        "profileImage",
        "profile_image",
        "createdAt",
        "created_at",
        "updatedAt",
        "updated_at"
      ];

      const clean = {};

      for (const key of allowedFields) {
        const value = user[key];

        if (
          value !== undefined &&
          (
            value === null ||
            ["string", "number", "boolean"].includes(typeof value)
          )
        ) {
          clean[key] = value;
        }
      }

      return Object.freeze(clean);
    },

    getSafeReturnUrl(candidate) {
      if (typeof candidate !== "string" || !candidate.trim()) {
        return null;
      }

      try {
        const url = new URL(candidate, window.location.origin);

        if (url.origin !== window.location.origin) return null;
        if (!["http:", "https:"].includes(url.protocol)) return null;

        const forbiddenPaths = [
          ROUTES.ACCOUNT?.LOGIN || "/account/login.html",
          ROUTES.ACCOUNT?.REGISTER || "/account/register.html",
          ROUTES.ACCOUNT?.LOGOUT || "/account/logout.html",
          "/account/forgot-password.html",
          "/account/reset-password.html"
        ];

        if (forbiddenPaths.includes(url.pathname)) return null;

        return `${url.pathname}${url.search}${url.hash}`;
      } catch {
        return null;
      }
    }
  };

  // --------------------------------------------------
  // Endpoint handling
  // --------------------------------------------------

  function endpointUrl(path) {
    if (typeof path !== "string" || !path.trim()) {
      throw new AuthError("Invalid authentication endpoint.", {
        code: "INVALID_ENDPOINT"
      });
    }

    if (
      /^[a-z][a-z\d+.-]*:/i.test(path) ||
      path.startsWith("//") ||
      path.includes("\\")
    ) {
      throw new AuthError("Invalid authentication endpoint.", {
        code: "INVALID_ENDPOINT"
      });
    }

    const base = new URL(API_BASE_URL, window.location.origin);

    if (base.origin !== window.location.origin) {
      throw new AuthError(
        "Authentication must use the configured same-origin API.",
        { code: "INVALID_API_ORIGIN" }
      );
    }

    const basePath = base.pathname.replace(/\/+$/, "");
    const relativePath = path.replace(/^\/+/, "");
    const url = new URL(`${basePath}/${relativePath}`, base.origin);

    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(`${basePath}/`)
    ) {
      throw new AuthError("Invalid authentication endpoint path.", {
        code: "INVALID_ENDPOINT"
      });
    }

    return url.href;
  }

  // --------------------------------------------------
  // HTTP client
  // --------------------------------------------------

  async function request(path, options = {}) {
    const method = String(options.method || "POST").toUpperCase();
    const allowedMethods = new Set([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD"
    ]);

    if (!allowedMethods.has(method)) {
      throw new AuthError("Unsupported request method.", {
        code: "INVALID_METHOD"
      });
    }

    const controller = new AbortController();
    const timeoutMs = Math.max(
      1000,
      Math.min(Number(options.timeoutMs || REQUEST_TIMEOUT_MS), 120000)
    );

    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    let abortHandler;

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        abortHandler = () => controller.abort(options.signal.reason);
        options.signal.addEventListener("abort", abortHandler, {
          once: true
        });
      }
    }

    try {
      if (controller.signal.aborted) {
        throw new AuthError("The request was cancelled.", {
          code: "REQUEST_ABORTED"
        });
      }

      const headers = new Headers(options.headers || {});
      headers.set("Accept", "application/json");

      let body;

      if (options.body !== undefined) {
        body = JSON.stringify(options.body);
        headers.set("Content-Type", "application/json");
      }

      if (
        options.includeCsrf !== false &&
        !["GET", "HEAD"].includes(method)
      ) {
        const csrfToken = utils.getCsrfToken();

        if (csrfToken) {
          headers.set("X-CSRF-Token", csrfToken);
        }
      }

      const response = await fetch(endpointUrl(path), {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        body: ["GET", "HEAD"].includes(method) ? undefined : body,
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") || "";
      let payload = null;

      if (response.status !== 204 && response.status !== 205) {
        if (contentType.includes("application/json")) {
          payload = await response.json().catch(() => null);
        } else {
          const text = await response.text().catch(() => "");
          payload = text ? { message: text.slice(0, 1000) } : null;
        }
      }

      if (!response.ok) {
        const message =
          payload?.message ||
          payload?.error?.message ||
          (typeof payload?.error === "string" ? payload.error : null) ||
          `Authentication request failed (${response.status}).`;

        throw new AuthError(message, {
          code: payload?.code || payload?.error?.code || "REQUEST_FAILED",
          status: response.status,
          details: payload?.details ?? payload?.error?.details ?? null
        });
      }

      return payload;
    } catch (error) {
      if (error instanceof AuthError) throw error;

      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new AuthError(
          timedOut
            ? "The authentication request timed out."
            : "The authentication request was cancelled.",
          {
            code: timedOut ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED"
          }
        );
      }

      throw new AuthError(
        "Unable to contact the authentication service. Please try again.",
        {
          code: "NETWORK_ERROR"
        }
      );
    } finally {
      window.clearTimeout(timeoutId);

      if (options.signal && abortHandler) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    }
  }

  // --------------------------------------------------
  // Response normalization
  // --------------------------------------------------

  function extractUser(payload) {
    if (!utils.isObject(payload)) return null;

    const candidates = [
      payload.user,
      payload.data?.user,
      payload.data?.profile,
      payload.profile
    ];

    for (const candidate of candidates) {
      if (utils.isObject(candidate)) {
        return utils.sanitizeUser(candidate);
      }
    }

    const direct = payload.data ?? payload;

    if (
      utils.isObject(direct) &&
      (
        direct.id !== undefined ||
        direct.userId !== undefined ||
        direct.user_id !== undefined ||
        direct.email !== undefined
      )
    ) {
      return utils.sanitizeUser(direct);
    }

    return null;
  }

  function extractAuthenticated(payload) {
    if (!utils.isObject(payload)) return false;

    if (payload.authenticated === true) return true;
    if (payload.data?.authenticated === true) return true;

    return Boolean(extractUser(payload));
  }

  // --------------------------------------------------
  // State and events
  // --------------------------------------------------

  function emitAuthChange(reason) {
    const detail = Object.freeze({
      authenticated: state.authenticated,
      user: state.user,
      reason
    });

    document.dispatchEvent(
      new CustomEvent(EVENT_AUTH_CHANGE, { detail })
    );

    listeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (error) {
        console.error("[MedOrbits Auth] Listener failed.", error);
      }
    });
  }

  function setAuthenticatedUser(user, reason = "session-updated") {
    state.user = utils.sanitizeUser(user);
    state.authenticated = Boolean(state.user);
    state.sessionChecked = true;
    state.lastError = null;

    emitAuthChange(reason);
    return state.user;
  }

  function clearSession(reason = "session-cleared") {
    state.user = null;
    state.authenticated = false;
    state.sessionChecked = true;
    state.lastError = null;

    emitAuthChange(reason);
  }

  // --------------------------------------------------
  // Login
  // --------------------------------------------------

  async function login(credentials = {}, options = {}) {
    const email = utils.normalizeEmail(credentials.email);
    const password = credentials.password;

    if (!email || typeof password !== "string" || !password) {
      throw new AuthError("Enter your email address and password.", {
        code: "MISSING_CREDENTIALS"
      });
    }

    state.loading = true;
    state.lastError = null;

    try {
      const payload = await request(ENDPOINTS.login, {
        body: { email, password },
        signal: options.signal
      });

      const user = extractUser(payload);

      if (!user || !extractAuthenticated(payload)) {
        throw new AuthError(
          "The server did not return a valid authenticated session.",
          { code: "INVALID_AUTH_RESPONSE" }
        );
      }

      setAuthenticatedUser(user, "login");

      return Object.freeze({
        success: true,
        user: state.user,
        message: payload?.message || "Login successful."
      });
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loading = false;
    }
  }

  // --------------------------------------------------
  // Registration
  // --------------------------------------------------

  async function register(details = {}, options = {}) {
    if (!utils.isObject(details)) {
      throw new AuthError("Valid registration details are required.", {
        code: "INVALID_REGISTRATION_DETAILS"
      });
    }

    const email = utils.normalizeEmail(details.email);
    const password = details.password;

    if (!email || typeof password !== "string") {
      throw new AuthError("Email address and password are required.", {
        code: "MISSING_REGISTRATION_FIELDS"
      });
    }

    const minLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MIN_LENGTH || 12
    );
    const maxLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MAX_LENGTH || 128
    );

    if (password.length < minLength || password.length > maxLength) {
      throw new AuthError(
        `Password must contain between ${minLength} and ${maxLength} characters.`,
        { code: "PASSWORD_POLICY" }
      );
    }

    const body = { ...details, email, password };

    // Never accept a client-selected privileged role.
    delete body.role;
    delete body.role_name;
    delete body.account_role;
    delete body.isAdmin;
    delete body.is_admin;
    delete body.permissions;

    state.loading = true;
    state.lastError = null;

    try {
      const payload = await request(ENDPOINTS.register, {
        body,
        signal: options.signal
      });

      const user = extractUser(payload);

      if (user && extractAuthenticated(payload)) {
        setAuthenticatedUser(user, "register");
      }

      return Object.freeze({
        success: true,
        user,
        authenticated: state.authenticated,
        message:
          payload?.message ||
          "Registration received. Follow the verification instructions."
      });
    } catch (error) {
      state.lastError = error;
      throw error;
    } finally {
      state.loading = false;
    }
  }

  // --------------------------------------------------
  // Session restoration
  // --------------------------------------------------

  async function getSession(options = {}) {
    if (state.sessionRequest && !options.force) {
      return state.sessionRequest;
    }

    if (state.sessionChecked && !options.force) {
      return state.user;
    }

    if (state.sessionController) {
      state.sessionController.abort();
    }

    const controller = new AbortController();
    state.sessionController = controller;
    state.loading = true;

    const sessionRequest = (async () => {
      try {
        const payload = await request(ENDPOINTS.session, {
          method: "GET",
          includeCsrf: false,
          signal: controller.signal
        });

        if (!extractAuthenticated(payload)) {
          clearSession("session-anonymous");
          return null;
        }

        const user = extractUser(payload);

        if (!user) {
          clearSession("session-invalid");
          return null;
        }

        return setAuthenticatedUser(user, "session-restored");
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          clearSession("session-expired");
          return null;
        }

        state.lastError = error;

        if (error.code !== "REQUEST_ABORTED") {
          throw error;
        }

        return null;
      } finally {
        if (state.sessionController === controller) {
          state.sessionController = null;
          state.sessionRequest = null;
          state.loading = false;
        }
      }
    })();

    state.sessionRequest = sessionRequest;
    return sessionRequest;
  }

  async function restoreSession() {
    try {
      return await getSession({ force: true });
    } catch (error) {
      state.lastError = error;
      return null;
    }
  }

  // --------------------------------------------------
  // Logout
  // --------------------------------------------------

  async function logout(options = {}) {
    const redirect = options.redirect === true;
    let requestError = null;

    try {
      await request(ENDPOINTS.logout, {
        body: {},
        signal: options.signal
      });

      clearSession("logout");
    } catch (error) {
      requestError = error;
      state.lastError = error;

      // A failed request does not prove that the server session
      // has been invalidated. Do not report confirmed server logout.
      throw error;
    } finally {
      if (redirect && !requestError) {
        window.location.assign(
          ROUTES.ACCOUNT?.LOGIN || "/account/login.html"
        );
      }
    }

    return { success: true };
  }

  // --------------------------------------------------
  // Email verification
  // --------------------------------------------------

  async function verifyEmail(token, options = {}) {
    const safeToken = utils.safeString(token);

    if (!safeToken) {
      throw new AuthError("A verification token is required.", {
        code: "MISSING_VERIFICATION_TOKEN"
      });
    }

    const payload = await request(ENDPOINTS.verifyEmail, {
      body: { token: safeToken },
      signal: options.signal
    });

    return {
      success: true,
      message: payload?.message || "Verification request completed."
    };
  }

  async function resendVerification(email, options = {}) {
    const normalizedEmail = utils.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new AuthError("Enter your email address.", {
        code: "MISSING_EMAIL"
      });
    }

    const payload = await request(ENDPOINTS.resendVerification, {
      body: { email: normalizedEmail },
      signal: options.signal
    });

    return {
      success: true,
      message:
        payload?.message ||
        "If the account is eligible, verification instructions will be sent."
    };
  }

  // --------------------------------------------------
  // Password reset
  // --------------------------------------------------

  async function requestPasswordReset(email, options = {}) {
    const normalizedEmail = utils.normalizeEmail(email);

    if (!normalizedEmail) {
      throw new AuthError("Enter your email address.", {
        code: "MISSING_EMAIL"
      });
    }

    const payload = await request(ENDPOINTS.forgotPassword, {
      body: { email: normalizedEmail },
      signal: options.signal
    });

    return {
      success: true,
      message:
        payload?.message ||
        "If the account exists, password reset instructions will be sent."
    };
  }

  async function resetPassword(details = {}, options = {}) {
    const token = utils.safeString(details.token);
    const password = details.password;
    const confirmPassword = details.confirmPassword;

    if (!token) {
      throw new AuthError("A password reset token is required.", {
        code: "MISSING_RESET_TOKEN"
      });
    }

    if (typeof password !== "string" || password !== confirmPassword) {
      throw new AuthError("The passwords do not match.", {
        code: "PASSWORD_MISMATCH"
      });
    }

    const minLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MIN_LENGTH || 12
    );
    const maxLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MAX_LENGTH || 128
    );

    if (password.length < minLength || password.length > maxLength) {
      throw new AuthError(
        `Password must contain between ${minLength} and ${maxLength} characters.`,
        { code: "PASSWORD_POLICY" }
      );
    }

    const payload = await request(ENDPOINTS.resetPassword, {
      body: { token, password, confirmPassword },
      signal: options.signal
    });

    return {
      success: true,
      message: payload?.message || "Password reset completed."
    };
  }

  // --------------------------------------------------
  // Change password
  // --------------------------------------------------

  async function changePassword(details = {}, options = {}) {
    if (!isAuthenticated()) {
      throw new AuthError("Sign in before changing your password.", {
        code: "AUTHENTICATION_REQUIRED",
        status: 401
      });
    }

    const {
      currentPassword,
      newPassword,
      confirmPassword
    } = details;

    if (!currentPassword || typeof newPassword !== "string") {
      throw new AuthError(
        "Enter your current password and new password.",
        { code: "MISSING_PASSWORD_FIELDS" }
      );
    }

    if (newPassword !== confirmPassword) {
      throw new AuthError("The passwords do not match.", {
        code: "PASSWORD_MISMATCH"
      });
    }

    const minLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MIN_LENGTH || 12
    );
    const maxLength = Number(
      CONSTANTS.VALIDATION?.PASSWORD_MAX_LENGTH || 128
    );

    if (newPassword.length < minLength || newPassword.length > maxLength) {
      throw new AuthError(
        `Password must contain between ${minLength} and ${maxLength} characters.`,
        { code: "PASSWORD_POLICY" }
      );
    }

    const payload = await request(ENDPOINTS.changePassword, {
      body: { currentPassword, newPassword, confirmPassword },
      signal: options.signal
    });

    return {
      success: true,
      message: payload?.message || "Password change completed."
    };
  }

  // --------------------------------------------------
  // Authorization helpers
  // UI helpers do not replace server-side authorization.
  // --------------------------------------------------

  function isAuthenticated() {
    return state.authenticated && Boolean(state.user);
  }

  function currentUser() {
    return state.user;
  }

  function hasRole(role) {
    if (!isAuthenticated() || typeof role !== "string") return false;

    const actualRole = utils.getRole(state.user);
    return Boolean(actualRole) && actualRole === role.trim().toLowerCase();
  }

  function hasAnyRole(roles = []) {
    if (!Array.isArray(roles)) return false;
    return roles.some((role) => hasRole(role));
  }

  function isAdmin() {
    return hasAnyRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]);
  }

  async function requireAuth(options = {}) {
    const redirect = options.redirect !== false;
    const returnTo = options.returnTo ??
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    let user;

    try {
      user = await getSession();
    } catch {
      if (!redirect) return null;

      if (window.MedOrbits?.toast) {
        window.MedOrbits.toast.error(
          "Unable to verify your session. Please try again."
        );
      }

      return null;
    }

    if (user) return user;
    if (!redirect) return null;

    const safeReturnTo = utils.getSafeReturnUrl(returnTo);
    const loginUrl = new URL(
      ROUTES.ACCOUNT?.LOGIN || "/account/login.html",
      window.location.origin
    );

    if (safeReturnTo) {
      loginUrl.searchParams.set("returnTo", safeReturnTo);
    }

    window.location.assign(`${loginUrl.pathname}${loginUrl.search}`);
    return null;
  }

  async function requireRole(roles, options = {}) {
    const user = await requireAuth(options);
    if (!user) return null;

    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!hasAnyRole(allowedRoles)) {
      if (options.redirectOnForbidden) {
        window.location.assign(
          ROUTES.PAGES?.NOT_FOUND || "/pages/404.html"
        );
      }

      throw new AuthError(
        "Your account does not have access to this area.",
        { code: "FORBIDDEN", status: 403 }
      );
    }

    return user;
  }

  // --------------------------------------------------
  // Auth change subscriptions
  // --------------------------------------------------

  function onChange(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onChange expects a function.");
    }

    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // --------------------------------------------------
  // Login form integration
  // --------------------------------------------------

  function bindLoginForm(form, options = {}) {
    if (typeof form === "string") {
      form = document.querySelector(form);
    }

    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("A valid login form is required.");
    }

    if (boundLoginForms.has(form)) return;

    boundLoginForms.add(form);

    const emailSelector = options.emailSelector || '[name="email"]';
    const passwordSelector = options.passwordSelector || '[name="password"]';
    const submitSelector = options.submitSelector || '[type="submit"]';

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const emailField = form.querySelector(emailSelector);
      const passwordField = form.querySelector(passwordSelector);
      const submitButton = form.querySelector(submitSelector);

      if (!emailField || !passwordField) {
        if (window.MedOrbits?.toast) {
          window.MedOrbits.toast.error("Login form fields are missing.");
        }
        return;
      }

      if (submitButton?.disabled) return;

      const originalText = submitButton?.textContent;

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        submitButton.textContent = "Signing in…";
      }

      try {
        const result = await login({
          email: emailField.value,
          password: passwordField.value
        });

        const returnTo = utils.getSafeReturnUrl(
          new URLSearchParams(window.location.search).get("returnTo")
        );

        if (typeof options.onSuccess === "function") {
          await options.onSuccess(result);
        } else {
          window.location.assign(
            returnTo ||
            ROUTES.ACCOUNT?.DASHBOARD ||
            "/account/dashboard.html"
          );
        }
      } catch (error) {
        if (typeof options.onError === "function") {
          options.onError(error);
        } else if (window.MedOrbits?.toast) {
          window.MedOrbits.toast.error(
            error.message || "Unable to sign in."
          );
        } else {
          console.error("[MedOrbits Auth]", error.message);
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute("aria-busy");

          if (originalText !== undefined) {
            submitButton.textContent = originalText;
          }
        }
      }
    });
  }

  // --------------------------------------------------
  // Logout buttons
  // --------------------------------------------------

  function bindLogoutButtons(selector = "[data-auth-logout]") {
    document.querySelectorAll(selector).forEach((button) => {
      if (boundLogoutButtons.has(button)) return;
      boundLogoutButtons.add(button);

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        if (button.disabled) return;

        button.disabled = true;

        try {
          await logout({ redirect: true });
        } catch (error) {
          console.error("[MedOrbits Auth] Logout failed.", error);

          if (window.MedOrbits?.toast) {
            window.MedOrbits.toast.error(
              "Unable to confirm sign out. Please try again."
            );
          }
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  // --------------------------------------------------
  // Initialization
  // --------------------------------------------------

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    bindLogoutButtons();

    document.querySelectorAll("[data-auth-login-form]").forEach((form) => {
      try {
        bindLoginForm(form);
      } catch (error) {
        console.error("[MedOrbits Auth] Login form initialization failed.", error);
      }
    });

    // Restore the server-side session without blocking page rendering.
    void restoreSession();

    document.dispatchEvent(
      new CustomEvent("medorbits:auth-module-ready", {
        detail: { version: "1.1.0" }
      })
    );
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  const publicAPI = Object.freeze({
    login,
    register,
    logout,

    getSession,
    restoreSession,

    verifyEmail,
    resendVerification,

    requestPasswordReset,
    resetPassword,
    changePassword,

    isAuthenticated,
    currentUser,
    hasRole,
    hasAnyRole,
    isAdmin,
    requireAuth,
    requireRole,

    onChange,
    bindLoginForm,
    bindLogoutButtons,

    get loading() {
      return state.loading;
    },

    get sessionChecked() {
      return state.sessionChecked;
    },

    get lastError() {
      return state.lastError;
    },

    AuthError
  });

  Object.defineProperty(window, "MedOrbitsAuth", {
    value: publicAPI,
    writable: false,
    configurable: false,
    enumerable: true
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
