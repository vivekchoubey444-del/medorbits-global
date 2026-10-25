
/**
 * MedOrbits -- Authentication Services
 * File: /src/js/services/auth.services.js
 *
 * Responsibilities:
 * - User login and registration.
 * - Logout and session retrieval.
 * - Password reset requests and password changes.
 * - Email verification.
 * - Current-user retrieval.
 * - Safe authentication error handling.
 * - Optional CSRF token integration.
 *
 * Dependencies:
 * - ./api.services.js
 * - ../utils/contants.js
 * - ../utils/validators.js
 *
 * Security:
 * - Defaults to same-origin cookie credentials through the API client.
 * - Never stores passwords, session cookies, or tokens in localStorage.
 * - Does not decode client-side state as proof of authentication.
 * - The backend must enforce authentication, authorization, and CSRF controls.
 *
 * IMPORTANT:
 * Confirm all endpoint paths and payload shapes against the actual backend.
 */

import {
  apiClient,
  ApiServiceError,
} from "./api.services.js";

import {
  API,
} from "../utils/contants.js";

import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from "../utils/validators.js";

/* --------------------------------------------------------------------------
 * Configuration
 * -------------------------------------------------------------------------- */

const AUTH_ENDPOINT = (() => {
  const endpoint = API.ENDPOINTS?.AUTH;

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return `${API.PREFIX}/auth`;
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
})();

const CSRF_HEADER_NAME = "X-CSRF-Token";

const DEFAULT_TIMEOUT_MS = API.DEFAULT_TIMEOUT_MS || 15000;

/**
 * Optional CSRF token provider.
 *
 * Configure this only if the backend provides a documented CSRF token
 * mechanism. Do not assume that a cookie value is readable by JavaScript.
 */
let csrfTokenProvider = null;

/* --------------------------------------------------------------------------
 * Service errors
 * -------------------------------------------------------------------------- */

export class AuthServiceError extends Error {
  constructor({
    message = "The authentication operation could not be completed.",
    code = "AUTH_SERVICE_ERROR",
    status = 0,
    correlationId = null,
    cause,
  } = {}) {
    super(message);

    this.name = "AuthServiceError";
    this.code = code;
    this.status = Number.isInteger(status) ? status : 0;
    this.correlationId = correlationId;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      correlationId: this.correlationId,
    };
  }
}

function toAuthError(error, fallbackMessage) {
  if (error instanceof AuthServiceError) {
    return error;
  }

  if (error instanceof ApiServiceError) {
    return new AuthServiceError({
      message: error.message || fallbackMessage,
      code: error.code || "AUTH_SERVICE_ERROR",
      status: error.status,
      correlationId: error.correlationId,
      cause: error,
    });
  }

  return new AuthServiceError({
    message: fallbackMessage,
    code: "AUTH_SERVICE_ERROR",
    cause: error,
  });
}

async function execute(operation, fallbackMessage) {
  try {
    return await operation();
  } catch (error) {
    throw toAuthError(error, fallbackMessage);
  }
}

/* --------------------------------------------------------------------------
 * Endpoint construction
 * -------------------------------------------------------------------------- */

function authPath(action) {
  if (
    typeof action !== "string" ||
    !/^[a-z][a-z0-9-]*$/.test(action)
  ) {
    throw new TypeError("Invalid authentication action.");
  }

  return `${AUTH_ENDPOINT}/${action}`;
}

/* --------------------------------------------------------------------------
 * Request helpers
 * -------------------------------------------------------------------------- */

function requirePlainObject(value, label = "Request data") {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new AuthServiceError({
      message: `${label} is invalid.`,
      code: "INVALID_PAYLOAD",
    });
  }

  return value;
}

function requireNonEmptyString(value, label, maxLength = 512) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new AuthServiceError({
      message: `${label} is required.`,
      code: "INVALID_INPUT",
    });
  }

  return value;
}

function validateEmailInput(email) {
  const result = validateEmail(email);

  if (!result.valid) {
    throw new AuthServiceError({
      message: result.message || "Enter a valid email address.",
      code: "INVALID_EMAIL",
    });
  }

  return result.value;
}

function validatePasswordInput(password) {
  const result = validatePassword(password);

  if (!result.valid) {
    throw new AuthServiceError({
      message: result.message || "Enter a valid password.",
      code: "INVALID_PASSWORD",
    });
  }

  return result.value;
}

function validateNewPassword(password) {
  const result = validatePassword(password);

  if (!result.valid) {
    throw new AuthServiceError({
      message: result.message || "Enter a valid password.",
      code: "INVALID_PASSWORD",
    });
  }

  return result.value;
}

/**
 * Build request options with optional CSRF support.
 *
 * Same-origin credentials are the default. The API client remains responsible
 * for request serialization, timeout handling, and safe HTTP errors.
 */
async function requestOptions(options = {}, { csrf = false } = {}) {
  const headers = new Headers(options.headers || {});

  if (csrf) {
    let token = options.csrfToken;

    if (
      token === undefined &&
      typeof csrfTokenProvider === "function"
    ) {
      token = await csrfTokenProvider();
    }

    if (token !== undefined && token !== null) {
      if (
        typeof token !== "string" ||
        token.length === 0 ||
        token.length > 4096 ||
        /[\r\n]/.test(token)
      ) {
        throw new AuthServiceError({
          message: "The security token is invalid. Refresh the page and try again.",
          code: "INVALID_CSRF_TOKEN",
        });
      }

      headers.set(CSRF_HEADER_NAME, token);
    }
  }

  return {
    signal: options.signal,
    timeoutMs: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    correlationId: options.correlationId,
    credentials: "same-origin",
    headers,
  };
}

/* --------------------------------------------------------------------------
 * CSRF configuration
 * -------------------------------------------------------------------------- */

/**
 * Configure a provider for obtaining a CSRF token.
 *
 * Example:
 * configureCsrfTokenProvider(async () => {
 *   const response = await fetch("/api/csrf-token", {
 *     credentials: "same-origin"
 *   });
 *   if (!response.ok) throw new Error("CSRF token unavailable");
 *   const data = await response.json();
 *   return data.csrfToken;
 * });
 *
 * Use only if this matches the backend's documented CSRF design.
 */
export function configureCsrfTokenProvider(provider) {
  if (provider !== null && typeof provider !== "function") {
    throw new TypeError("The CSRF token provider must be a function or null.");
  }

  csrfTokenProvider = provider;
}

/* --------------------------------------------------------------------------
 * Login
 * -------------------------------------------------------------------------- */

/**
 * Sign in with email and password.
 *
 * Expected request shape:
 * { email, password }
 *
 * The backend should establish the authenticated session using its configured
 * session or cookie mechanism. Do not persist the password in browser storage.
 */
export async function login(
  credentials,
  options = {}
) {
  requirePlainObject(credentials, "Login data");

  const email = validateEmailInput(credentials.email);
  const password = validatePasswordInput(credentials.password);

  const payload = {
    email,
    password,
  };

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("login"),
        payload,
        request
      );
    },
    "Sign-in failed. Check your details and try again."
  );
}

/* --------------------------------------------------------------------------
 * Registration
 * -------------------------------------------------------------------------- */

/**
 * Register a new account.
 *
 * The backend determines permitted roles, registration eligibility,
 * verification requirements, and account status.
 *
 * Never trust a role supplied by the browser as an authorization decision.
 */
export async function register(
  registration,
  options = {}
) {
  requirePlainObject(registration, "Registration data");

  const email = validateEmailInput(registration.email);
  const password = validateNewPassword(registration.password);

  if (registration.confirmPassword !== undefined) {
    const confirmation = validatePasswordConfirmation(
      password,
      registration.confirmPassword
    );

    if (!confirmation.valid) {
      throw new AuthServiceError({
        message: confirmation.message || "Passwords do not match.",
        code: "PASSWORD_MISMATCH",
      });
    }
  }

  const payload = {
    email,
    password,
  };

  if (registration.name !== undefined) {
    if (
      typeof registration.name !== "string" ||
      !registration.name.trim() ||
      registration.name.trim().length > 100
    ) {
      throw new AuthServiceError({
        message: "Enter a valid name.",
        code: "INVALID_NAME",
      });
    }

    payload.name = registration.name.trim();
  }

  if (registration.phone !== undefined) {
    if (
      typeof registration.phone !== "string" &&
      typeof registration.phone !== "number"
    ) {
      throw new AuthServiceError({
        message: "Enter a valid phone number.",
        code: "INVALID_PHONE",
      });
    }

    const phone = String(registration.phone).trim();

    if (!phone || phone.length > 30) {
      throw new AuthServiceError({
        message: "Enter a valid phone number.",
        code: "INVALID_PHONE",
      });
    }

    payload.phone = phone;
  }

  // Do not copy registration.role into the payload by default.
  // If role selection is part of the product, validate it against an explicit
  // server-approved registration policy before including it.

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("register"),
        payload,
        request
      );
    },
    "Registration could not be completed."
  );
}

/* --------------------------------------------------------------------------
 * Logout
 * -------------------------------------------------------------------------- */

/**
 * End the server-side session.
 *
 * The backend should invalidate the session and expire the relevant cookie.
 * The client must not claim that logout succeeded if the request fails.
 */
export async function logout(options = {}) {
  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("logout"),
        {},
        request
      );
    },
    "Sign-out could not be completed."
  );
}

/* --------------------------------------------------------------------------
 * Session and current user
 * -------------------------------------------------------------------------- */

/**
 * Retrieve the current authenticated session.
 *
 * The server must determine the authenticated identity from its trusted
 * session or token verification process.
 */
export async function getSession(options = {}) {
  return execute(
    async () => {
      const request = await requestOptions(options);

      return apiClient.get(
        authPath("session"),
        request
      );
    },
    "The current session could not be retrieved."
  );
}

/**
 * Retrieve the current user profile from the authentication endpoint.
 *
 * If the backend exposes /api/users/me instead, change this method to use
 * the documented user-profile route.
 */
export async function getCurrentUser(options = {}) {
  return execute(
    async () => {
      const request = await requestOptions(options);

      return apiClient.get(
        authPath("me"),
        request
      );
    },
    "The current user profile could not be retrieved."
  );
}

/**
 * Check authentication state by asking the backend.
 *
 * This method does not infer authentication from localStorage, a UI flag,
 * or a client-decoded token.
 */
export async function checkAuthentication(options = {}) {
  try {
    const session = await getSession(options);

    return {
      authenticated: true,
      session,
    };
  } catch (error) {
    if (
      error instanceof AuthServiceError &&
      error.status === 401
    ) {
      return {
        authenticated: false,
        session: null,
      };
    }

    throw error;
  }
}

/* --------------------------------------------------------------------------
 * Password reset
 * -------------------------------------------------------------------------- */

/**
 * Request a password reset email.
 *
 * The backend should return a generic response to avoid revealing whether
 * an email address is registered.
 */
export async function requestPasswordReset(
  email,
  options = {}
) {
  const normalizedEmail = validateEmailInput(email);

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("forgot-password"),
        {
          email: normalizedEmail,
        },
        request
      );
    },
    "The password-reset request could not be completed."
  );
}

/**
 * Reset a password using a server-issued, single-use reset token.
 *
 * The token is sent in the request body, not a URL or browser storage.
 */
export async function resetPassword(
  {
    token,
    password,
    confirmPassword,
  },
  options = {}
) {
  if (
    !token ||
    typeof token !== "string" ||
    token.length > 4096 ||
    /[\r\n]/.test(token)
  ) {
    throw new AuthServiceError({
      message: "The password-reset link is invalid or expired.",
      code: "INVALID_RESET_TOKEN",
    });
  }

  const normalizedPassword = validateNewPassword(password);

  if (confirmPassword !== undefined) {
    const confirmation = validatePasswordConfirmation(
      normalizedPassword,
      confirmPassword
    );

    if (!confirmation.valid) {
      throw new AuthServiceError({
        message: confirmation.message || "Passwords do not match.",
        code: "PASSWORD_MISMATCH",
      });
    }
  }

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("reset-password"),
        {
          token,
          password: normalizedPassword,
        },
        request
      );
    },
    "The password could not be reset. Request a new reset link if necessary."
  );
}

/**
 * Change the password for the currently authenticated user.
 *
 * Requires a protected backend endpoint and current-session verification.
 */
export async function changePassword(
  {
    currentPassword,
    newPassword,
    confirmPassword,
  },
  options = {}
) {
  requireNonEmptyString(currentPassword, "Current password", 4096);

  const normalizedNewPassword = validateNewPassword(newPassword);

  if (confirmPassword !== undefined) {
    const confirmation = validatePasswordConfirmation(
      normalizedNewPassword,
      confirmPassword
    );

    if (!confirmation.valid) {
      throw new AuthServiceError({
        message: confirmation.message || "Passwords do not match.",
        code: "PASSWORD_MISMATCH",
      });
    }
  }

  if (currentPassword === normalizedNewPassword) {
    throw new AuthServiceError({
      message: "Choose a password different from your current password.",
      code: "PASSWORD_UNCHANGED",
    });
  }

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("change-password"),
        {
          currentPassword,
          newPassword: normalizedNewPassword,
        },
        request
      );
    },
    "The password could not be changed."
  );
}

/* --------------------------------------------------------------------------
 * Email verification
 * -------------------------------------------------------------------------- */

/**
 * Verify an email address with a server-issued verification token.
 */
export async function verifyEmail(
  token,
  options = {}
) {
  if (
    typeof token !== "string" ||
    !token.trim() ||
    token.length > 4096 ||
    /[\r\n]/.test(token)
  ) {
    throw new AuthServiceError({
      message: "The verification link is invalid or expired.",
      code: "INVALID_VERIFICATION_TOKEN",
    });
  }

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("verify-email"),
        {
          token: token.trim(),
        },
        request
      );
    },
    "Email verification could not be completed."
  );
}

/**
 * Request a new email-verification message.
 *
 * The backend should avoid exposing whether an account exists.
 */
export async function resendVerificationEmail(
  email,
  options = {}
) {
  const normalizedEmail = validateEmailInput(email);

  return execute(
    async () => {
      const request = await requestOptions(options, { csrf: true });

      return apiClient.post(
        authPath("resend-verification"),
        {
          email: normalizedEmail,
        },
        request
      );
    },
    "The verification request could not be completed."
  );
}

/* --------------------------------------------------------------------------
 * Authentication facade
 * -------------------------------------------------------------------------- */

export const authService = Object.freeze({
  login,
  register,
  logout,

  getSession,
  getCurrentUser,
  checkAuthentication,

  requestPasswordReset,
  resetPassword,
  changePassword,

  verifyEmail,
  resendVerificationEmail,

  configureCsrfTokenProvider,
});

export default authService;
