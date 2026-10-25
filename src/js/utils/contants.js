
/**
 * MedOrbits -- Shared Application Constants
 * File: /src/js/utils/contants.js
 *
 * Purpose:
 * Centralize application-wide constants used by frontend modules.
 *
 * Security:
 * - Never place API secrets, private tokens, passwords, or credentials here.
 * - Browser-side constants are publicly accessible to users.
 * - Backend configuration and authorization rules remain server-controlled.
 *
 * Module format: ES Module
 */

const freeze = (value) => {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.isFrozen(value)
  ) {
    return value;
  }

  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

/* --------------------------------------------------------------------------
 * Application metadata
 * -------------------------------------------------------------------------- */

export const APP = freeze({
  NAME: "MedOrbits",
  DESCRIPTION:
    "Education, medical admissions, career guidance, and consultancy services.",
  DEFAULT_LOCALE: "en",
  DEFAULT_TIME_ZONE: "Asia/Kolkata",
  DEFAULT_COUNTRY_CODE: "IN",
  DEFAULT_CURRENCY: "INR",
  DEFAULT_CURRENCY_SYMBOL: "₹",
  VERSION: "1.0.0",
});

/* --------------------------------------------------------------------------
 * Environment
 * -------------------------------------------------------------------------- */

/**
 * Do not assume that a frontend variable is secret.
 * Build tools may replace environment variables during compilation.
 */
export const ENVIRONMENT = freeze({
  DEVELOPMENT: "development",
  TEST: "test",
  STAGING: "staging",
  PRODUCTION: "production",
});

/* --------------------------------------------------------------------------
 * Routes
 *
 * Adjust these paths to match the actual deployed site structure.
 * -------------------------------------------------------------------------- */

export const ROUTES = freeze({
  HOME: "/",
  ABOUT: "/pages/about.html",
  EDUCATION: "/pages/education.html",
  COURSES: "/pages/courses.html",
  COLLEGES: "/pages/colleges.html",
  UNIVERSITIES: "/pages/universities.html",
  ADMISSIONS: "/pages/admissions.html",
  CAREERS: "/pages/careers.html",
  JOBS: "/pages/jobs.html",
  OFFICIAL_DOCUMENTS: "/official-documents/",
  SUPPORT: "/support/",
  CONTACT: "/pages/contact.html",
  LOGIN: "/pages/login.html",
  REGISTER: "/pages/register.html",
  PRIVACY: "/pages/privacy-policy.html",
  TERMS: "/pages/terms.html",
  NOT_FOUND: "/404.html",
});

/* --------------------------------------------------------------------------
 * API configuration
 * -------------------------------------------------------------------------- */

export const API = freeze({
  /**
   * Empty base URL means API requests use the current origin.
   * Override this through your application's build configuration if needed.
   */
  BASE_URL: "",

  PREFIX: "/api",

  ENDPOINTS: {
    HEALTH: "/health",
    AUTH: "/auth",
    USERS: "/users",
    APPLICATIONS: "/applications",
    JOBS: "/jobs",
    PROPERTIES: "/properties",
    SEARCH: "/search",
    VISITS: "/visits",
    OFFERS: "/offers",
    DOCUMENTS: "/documents",
    NOTIFICATIONS: "/notifications",
    SUPPORT: "/support",
  },

  DEFAULT_TIMEOUT_MS: 15000,
  UPLOAD_TIMEOUT_MS: 60000,
});

/* --------------------------------------------------------------------------
 * HTTP
 * -------------------------------------------------------------------------- */

export const HTTP = freeze({
  METHODS: {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    DELETE: "DELETE",
    OPTIONS: "OPTIONS",
  },

  STATUS: {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
  },

  HEADERS: {
    ACCEPT: "Accept",
    CONTENT_TYPE: "Content-Type",
    AUTHORIZATION: "Authorization",
    REQUEST_ID: "X-Request-ID",
    CORRELATION_ID: "X-Correlation-ID",
  },

  CONTENT_TYPES: {
    JSON: "application/json",
    FORM_URLENCODED: "application/x-www-form-urlencoded",
    MULTIPART: "multipart/form-data",
    TEXT: "text/plain",
  },
});

/* --------------------------------------------------------------------------
 * Validation
 * -------------------------------------------------------------------------- */

export const VALIDATION = freeze({
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 100,

  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,

  MAX_EMAIL_LENGTH: 254,
  MAX_PHONE_LENGTH: 20,

  MIN_PAGE: 1,
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  MAX_TEXT_LENGTH: 5000,
  MAX_IDENTIFIER_LENGTH: 128,

  /**
   * These values are frontend safeguards, not substitutes for backend limits.
   */
  MAX_UPLOAD_SIZE_BYTES: 10 * 1024 * 1024,

  ALLOWED_DOCUMENT_MIME_TYPES: [
    "application/pdf",
  ],

  ALLOWED_IMAGE_MIME_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp",
  ],
});

/* --------------------------------------------------------------------------
 * Application statuses
 * -------------------------------------------------------------------------- */

export const APPLICATION_STATUS = freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  DOCUMENTS_REQUIRED: "documents_required",
  APPROVED: "approved",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  COMPLETED: "completed",
});

/* --------------------------------------------------------------------------
 * Job statuses
 * -------------------------------------------------------------------------- */

export const JOB_STATUS = freeze({
  DRAFT: "draft",
  OPEN: "open",
  PAUSED: "paused",
  CLOSED: "closed",
  FILLED: "filled",
  ARCHIVED: "archived",
});

/* --------------------------------------------------------------------------
 * User roles
 *
 * These are UI labels/identifiers only. The server must authorize each action.
 * -------------------------------------------------------------------------- */

export const USER_ROLE = freeze({
  STUDENT: "student",
  APPLICANT: "applicant",
  EMPLOYER: "employer",
  COUNSELLOR: "counsellor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
});

/* --------------------------------------------------------------------------
 * UI
 * -------------------------------------------------------------------------- */

export const UI = freeze({
  BREAKPOINTS: {
    MOBILE: 480,
    TABLET: 768,
    DESKTOP: 1024,
    WIDE: 1280,
  },

  ANIMATION: {
    FAST_MS: 150,
    NORMAL_MS: 250,
    SLOW_MS: 400,
  },

  DEBOUNCE_MS: 300,
  SEARCH_DEBOUNCE_MS: 350,

  TOAST_DURATION_MS: 4000,
  TOOLTIP_DELAY_MS: 500,
});

/* --------------------------------------------------------------------------
 * Accessibility
 * -------------------------------------------------------------------------- */

export const ACCESSIBILITY = freeze({
  LIVE_POLITE: "polite",
  LIVE_ASSERTIVE: "assertive",
  ROLE_ALERT: "alert",
  ROLE_STATUS: "status",
  ROLE_DIALOG: "dialog",
  ROLE_NAVIGATION: "navigation",
});

/* --------------------------------------------------------------------------
 * Storage keys
 *
 * Store only appropriate, non-sensitive preferences here.
 * Do not store passwords, access tokens, private documents, or session secrets
 * in localStorage or sessionStorage through these keys.
 * -------------------------------------------------------------------------- */

export const STORAGE_KEYS = freeze({
  THEME: "medorbits_theme",
  LOCALE: "medorbits_locale",
  COOKIE_PREFERENCES: "medorbits_cookie_preferences",
  DISMISSED_NOTICES: "medorbits_dismissed_notices",
});

/* --------------------------------------------------------------------------
 * Theme
 *
 * Keep these values aligned with the actual design system in your CSS.
 * -------------------------------------------------------------------------- */

export const THEME = freeze({
  DEFAULT: "midnight-sapphire",

  MODES: {
    DARK: "dark",
    LIGHT: "light",
    SYSTEM: "system",
  },

  COLORS: {
    BACKGROUND: "#061326",
    BACKGROUND_DEEP: "#030914",
    SURFACE: "#0B2039",
    SURFACE_ELEVATED: "#102B4B",
    PRIMARY: "#8BBcff".toLowerCase(),
    PRIMARY_LIGHT: "#D9E9FF",
    TEXT: "#F0F5FF",
    TEXT_MUTED: "#A9BCD5",
    BORDER: "#294563",
    SUCCESS: "#62D6A5",
    WARNING: "#F2C879",
    DANGER: "#FF8290",
  },
});

/* --------------------------------------------------------------------------
 * Internationalization
 * -------------------------------------------------------------------------- */

export const I18N = freeze({
  DEFAULT_LANGUAGE: "en",

  SUPPORTED_LANGUAGES: [
    "en",
    "hi",
    "bn",
    "as",
    "ne",
    "mr",
    "gu",
    "pa",
    "ur",
    "or",
    "ps",
    "fa",
    "fr",
    "de",
    "es",
    "zh",
    "ar",
    "ru",
    "ka",
    "kk",
    "uz",
    "ky",
  ],

  RTL_LANGUAGES: [
    "ar",
    "fa",
    "ps",
    "ur",
  ],
});

/* --------------------------------------------------------------------------
 * Error codes
 * -------------------------------------------------------------------------- */

export const ERROR_CODES = freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

/* --------------------------------------------------------------------------
 * Feature flags
 *
 * These flags control presentation only. They must never grant privileges.
 * -------------------------------------------------------------------------- */

export const FEATURES = freeze({
  SEARCH: true,
  NOTIFICATIONS: true,
  OFFICIAL_DOCUMENTS: true,
  CAREER_SERVICES: true,
  JOB_LISTINGS: true,
  APPLICATION_TRACKING: true,
});

/* --------------------------------------------------------------------------
 * General utilities
 * -------------------------------------------------------------------------- */

/**
 * Build an API path from a named endpoint.
 *
 * Example:
 * buildApiPath("APPLICATIONS") -> "/api/applications"
 */
export function buildApiPath(endpointName) {
  if (
    typeof endpointName !== "string" ||
    !Object.prototype.hasOwnProperty.call(API.ENDPOINTS, endpointName)
  ) {
    throw new TypeError("Unknown MedOrbits API endpoint.");
  }

  return `${API.PREFIX}${API.ENDPOINTS[endpointName]}`;
}

/**
 * Normalize a supported language code.
 * Falls back to the configured default for unsupported input.
 */
export function getSupportedLanguage(language) {
  if (typeof language !== "string") {
    return I18N.DEFAULT_LANGUAGE;
  }

  const normalized = language.trim().toLowerCase().split("-")[0];

  return I18N.SUPPORTED_LANGUAGES.includes(normalized)
    ? normalized
    : I18N.DEFAULT_LANGUAGE;
}

/**
 * Determine whether a language uses right-to-left layout.
 */
export function isRtlLanguage(language) {
  return I18N.RTL_LANGUAGES.includes(
    getSupportedLanguage(language)
  );
}

/**
 * Clamp a page size to the configured frontend range.
 */
export function normalizePageSize(value) {
  const pageSize = Number(value);

  if (!Number.isFinite(pageSize)) {
    return VALIDATION.DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    VALIDATION.MAX_PAGE_SIZE,
    Math.max(1, Math.floor(pageSize))
  );
}

/**
 * Convert a supported amount to the default Indian currency display.
 */
export function formatCurrency(
  amount,
  locale = "en-IN",
  currency = APP.DEFAULT_CURRENCY
) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "--";
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

/* --------------------------------------------------------------------------
 * Default export
 * -------------------------------------------------------------------------- */

const MEDORBITS_CONSTANTS = freeze({
  APP,
  ENVIRONMENT,
  ROUTES,
  API,
  HTTP,
  VALIDATION,
  APPLICATION_STATUS,
  JOB_STATUS,
  USER_ROLE,
  UI,
  ACCESSIBILITY,
  STORAGE_KEYS,
  THEME,
  I18N,
  ERROR_CODES,
  FEATURES,
  buildApiPath,
  getSupportedLanguage,
  isRtlLanguage,
  normalizePageSize,
  formatCurrency,
});

export default MEDORBITS_CONSTANTS;
