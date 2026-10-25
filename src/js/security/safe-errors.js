
/**
 * MedOrbits -- Safe Error Handling
 * Path: /src/js/security/safe-errors.js
 *
 * Responsibilities:
 * - Normalize unknown errors into a consistent structure.
 * - Produce safe user-facing error messages.
 * - Map common HTTP status codes to stable error codes.
 * - Extract API error responses without exposing server internals.
 * - Generate and validate correlation IDs.
 * - Support centralized error reporting.
 *
 * Security:
 * - Never display stack traces or raw server exceptions to end users.
 * - Do not log passwords, tokens, session cookies, or complete request bodies.
 * - Do not treat client-side errors as authoritative server errors.
 * - Backend services must independently sanitize their error responses.
 */

const DEFAULT_OPTIONS = Object.freeze({
  genericMessage: "Something went wrong. Please try again.",
  validationMessage: "Please check your information and try again.",
  networkMessage: "Unable to connect. Check your connection and try again.",
  timeoutMessage: "The request timed out. Please try again.",
  unauthorizedMessage: "Please sign in to continue.",
  forbiddenMessage: "You do not have permission to perform this action.",
  notFoundMessage: "The requested resource could not be found.",
  rateLimitMessage: "Too many requests. Please wait before trying again.",
  maintenanceMessage: "The service is temporarily unavailable.",
});

const STATUS_MESSAGES = Object.freeze({
  400: "The request could not be processed.",
  401: DEFAULT_OPTIONS.unauthorizedMessage,
  403: DEFAULT_OPTIONS.forbiddenMessage,
  404: DEFAULT_OPTIONS.notFoundMessage,
  408: DEFAULT_OPTIONS.timeoutMessage,
  409: "This action conflicts with the current state.",
  413: "The submitted content is too large.",
  415: "This file or content type is not supported.",
  422: DEFAULT_OPTIONS.validationMessage,
  429: DEFAULT_OPTIONS.rateLimitMessage,
  500: DEFAULT_OPTIONS.genericMessage,
  502: DEFAULT_OPTIONS.maintenanceMessage,
  503: DEFAULT_OPTIONS.maintenanceMessage,
  504: DEFAULT_OPTIONS.timeoutMessage,
});

const STATUS_CODES = Object.freeze({
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  408: "REQUEST_TIMEOUT",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
  502: "UPSTREAM_ERROR",
  503: "SERVICE_UNAVAILABLE",
  504: "UPSTREAM_TIMEOUT",
});

const SAFE_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "REQUEST_TIMEOUT",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "UPSTREAM_ERROR",
  "SERVICE_UNAVAILABLE",
  "UPSTREAM_TIMEOUT",
  "NETWORK_ERROR",
  "ABORTED",
  "UNKNOWN_ERROR",
]);

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function safeString(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();

  if (CONTROL_CHARACTER_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function safeStatus(value) {
  const status = Number(value);

  if (
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
  ) {
    return status;
  }

  return 500;
}

function createCorrelationId() {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the non-cryptographic fallback.
  }

  // A correlation ID is for diagnostics, not authentication or authorization.
  return `req-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

function normalizeCorrelationId(value) {
  const candidate = safeString(value);

  if (
    candidate &&
    CORRELATION_ID_PATTERN.test(candidate)
  ) {
    return candidate;
  }

  return createCorrelationId();
}

function statusToCode(status) {
  return STATUS_CODES[status] || "INTERNAL_ERROR";
}

function statusToMessage(status, options = {}) {
  if (status === 422 || status === 400) {
    return options.validationMessage || DEFAULT_OPTIONS.validationMessage;
  }

  if (status === 401) {
    return options.unauthorizedMessage || DEFAULT_OPTIONS.unauthorizedMessage;
  }

  if (status === 403) {
    return options.forbiddenMessage || DEFAULT_OPTIONS.forbiddenMessage;
  }

  if (status === 404) {
    return options.notFoundMessage || DEFAULT_OPTIONS.notFoundMessage;
  }

  if (status === 408 || status === 504) {
    return options.timeoutMessage || DEFAULT_OPTIONS.timeoutMessage;
  }

  if (status === 429) {
    return options.rateLimitMessage || DEFAULT_OPTIONS.rateLimitMessage;
  }

  if (status === 502 || status === 503) {
    return options.maintenanceMessage || DEFAULT_OPTIONS.maintenanceMessage;
  }

  return STATUS_MESSAGES[status] || options.genericMessage ||
    DEFAULT_OPTIONS.genericMessage;
}

/**
 * Create a normalized internal error record.
 *
 * The original error is deliberately not returned. Callers should use the
 * original exception only within a trusted diagnostic path.
 */
export function normalizeError(error, options = {}) {
  const correlationId = normalizeCorrelationId(
    options.correlationId,
  );

  if (error instanceof SafeAppError) {
    return Object.freeze({
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.publicMessage,
      correlationId,
      retryable: error.retryable,
    });
  }

  if (error instanceof TypeError || error instanceof SyntaxError) {
    return Object.freeze({
      name: "ClientRuntimeError",
      code: "BAD_REQUEST",
      status: 400,
      message: statusToMessage(400, options),
      correlationId,
      retryable: false,
    });
  }

  if (
    error &&
    typeof error === "object" &&
    error.name === "AbortError"
  ) {
    return Object.freeze({
      name: "AbortError",
      code: "ABORTED",
      status: 408,
      message: options.timeoutMessage || DEFAULT_OPTIONS.timeoutMessage,
      correlationId,
      retryable: true,
    });
  }

  return Object.freeze({
    name: "SafeAppError",
    code: "UNKNOWN_ERROR",
    status: 500,
    message: options.genericMessage || DEFAULT_OPTIONS.genericMessage,
    correlationId,
    retryable: false,
  });
}

/**
 * Application error with an explicitly controlled public message.
 *
 * Do not put secrets, raw database errors, or stack traces in publicMessage.
 */
export class SafeAppError extends Error {
  constructor(
    message,
    {
      code = "INTERNAL_ERROR",
      status = 500,
      publicMessage = DEFAULT_OPTIONS.genericMessage,
      retryable = false,
      cause,
    } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });

    this.name = "SafeAppError";
    this.code = SAFE_ERROR_CODES.has(code)
      ? code
      : "INTERNAL_ERROR";
    this.status = safeStatus(status);
    this.publicMessage = safeString(
      publicMessage,
      DEFAULT_OPTIONS.genericMessage,
    );
    this.retryable = Boolean(retryable);
  }
}

/**
 * Create a safe error from an HTTP status.
 */
export function createHttpError(status, options = {}) {
  const normalizedStatus = safeStatus(status);

  const code = SAFE_ERROR_CODES.has(options.code)
    ? options.code
    : statusToCode(normalizedStatus);

  return new SafeAppError(
    options.internalMessage || `HTTP ${normalizedStatus}`,
    {
      code,
      status: normalizedStatus,
      publicMessage:
        options.publicMessage || statusToMessage(normalizedStatus, options),
      retryable:
        options.retryable ??
        [408, 429, 502, 503, 504].includes(normalizedStatus),
      cause: options.cause,
    },
  );
}

/**
 * Build a safe error object for UI display.
 */
export function toUserError(error, options = {}) {
  const normalized = normalizeError(error, options);

  return Object.freeze({
    success: false,
    error: Object.freeze({
      code: normalized.code,
      message: normalized.message,
      correlationId: normalized.correlationId,
      retryable: normalized.retryable,
    }),
  });
}

/**
 * Extract a safe error from a fetch Response.
 *
 * Never trust a server-provided message blindly. Only known error codes and
 * explicitly allowlisted messages may be exposed directly.
 */
export async function fromResponse(response, options = {}) {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.status !== "number"
  ) {
    return normalizeError(
      new Error("Invalid response object"),
      options,
    );
  }

  const status = safeStatus(response.status);
  const correlationId = normalizeCorrelationId(
    response.headers?.get?.("x-correlation-id") ||
    response.headers?.get?.("x-request-id") ||
    options.correlationId,
  );

  let body = null;

  try {
    const contentType = response.headers?.get?.("content-type") || "";

    if (contentType.toLowerCase().includes("application/json")) {
      body = await response.clone().json();
    }
  } catch {
    body = null;
  }

  const bodyError = isPlainObject(body) && isPlainObject(body.error)
    ? body.error
    : isPlainObject(body)
      ? body
      : {};

  const suppliedCode = safeString(bodyError.code);
  const code = SAFE_ERROR_CODES.has(suppliedCode)
    ? suppliedCode
    : statusToCode(status);

  const safeMessage = statusToMessage(status, options);

  return Object.freeze({
    name: "HttpResponseError",
    code,
    status,
    message: safeMessage,
    correlationId,
    retryable: [408, 429, 502, 503, 504].includes(status),
  });
}

/**
 * Convert common client-side network failures into safe error records.
 */
export function fromNetworkError(error, options = {}) {
  const correlationId = normalizeCorrelationId(
    options.correlationId,
  );

  if (error && typeof error === "object" && error.name === "AbortError") {
    return Object.freeze({
      name: "AbortError",
      code: "ABORTED",
      status: 408,
      message: options.timeoutMessage || DEFAULT_OPTIONS.timeoutMessage,
      correlationId,
      retryable: true,
    });
  }

  return Object.freeze({
    name: "NetworkError",
    code: "NETWORK_ERROR",
    status: 0,
    message: options.networkMessage || DEFAULT_OPTIONS.networkMessage,
    correlationId,
    retryable: true,
  });
}

/**
 * Display an error using textContent, never innerHTML.
 *
 * @param {HTMLElement} element
 * @param {object} error A normalized error or toUserError() result.
 */
export function displayError(element, error) {
  if (!element || !("textContent" in element)) {
    throw new TypeError("A valid error display element is required.");
  }

  const nestedError = isPlainObject(error?.error)
    ? error.error
    : error;

  const message = safeString(
    nestedError?.message,
    DEFAULT_OPTIONS.genericMessage,
  );

  element.textContent = message;
  element.hidden = false;
  element.setAttribute("role", "alert");
  element.setAttribute("aria-live", "assertive");

  return element;
}

/**
 * Clear an error display element.
 */
export function clearError(element) {
  if (!element || !("textContent" in element)) {
    return;
  }

  element.textContent = "";
  element.hidden = true;
}

/**
 * Create a correlation ID for an API request.
 *
 * Correlation IDs are diagnostic metadata only. Never use them as proof
 * of identity, permission, or request authenticity.
 */
export function getCorrelationId(existingId) {
  return normalizeCorrelationId(existingId);
}

/**
 * Return headers with a correlation ID added.
 *
 * Accepts a Headers instance, an object of header values, or no input.
 */
export function withCorrelationId(headers = {}, correlationId) {
  const requestId = getCorrelationId(correlationId);

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const copy = new Headers(headers);
    copy.set("X-Correlation-ID", requestId);
    return copy;
  }

  return {
    ...(isPlainObject(headers) ? headers : {}),
    "X-Correlation-ID": requestId,
  };
}

/**
 * Optional, centralized error reporter.
 *
 * reporter must be provided by the application. This module does not send
 * errors to third-party services or log raw exception contents.
 */
export function reportSafeError(error, reporter, options = {}) {
  const normalized = normalizeError(error, options);

  if (typeof reporter !== "function") {
    return normalized;
  }

  try {
    reporter({
      code: normalized.code,
      status: normalized.status,
      correlationId: normalized.correlationId,
      retryable: normalized.retryable,
    });
  } catch {
    // Error reporting must not break the main application flow.
  }

  return normalized;
}

/**
 * Normalize an API error response for consistent UI consumption.
 */
export async function handleApiError(response, options = {}) {
  const normalized = await fromResponse(response, options);

  return Object.freeze({
    success: false,
    error: Object.freeze({
      code: normalized.code,
      message: normalized.message,
      status: normalized.status,
      correlationId: normalized.correlationId,
      retryable: normalized.retryable,
    }),
  });
}

/**
 * Safely map a caught exception to a UI response.
 */
export function handleCaughtError(error, options = {}) {
  return toUserError(error, options);
}

export default Object.freeze({
  SafeAppError,
  normalizeError,
  createHttpError,
  toUserError,
  fromResponse,
  fromNetworkError,
  displayError,
  clearError,
  getCorrelationId,
  withCorrelationId,
  reportSafeError,
  handleApiError,
  handleCaughtError,
});
