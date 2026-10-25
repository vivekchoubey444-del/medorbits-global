
/**
 * MedOrbits -- Safe Error Handling
 * Path: /src/js/security/safe-errors.js
 *
 * Responsibilities:
 * - Normalize unknown errors into a consistent structure.
 * - Produce safe user-facing error messages.
 * - Map HTTP status codes to stable error codes.
 * - Extract safe API error metadata without exposing server internals.
 * - Generate and validate correlation IDs.
 * - Support optional centralized error reporting.
 *
 * Security:
 * - Never display stack traces or raw server exceptions to end users.
 * - Do not log passwords, tokens, session cookies, or request bodies.
 * - Client-side errors are not authoritative server errors.
 * - Backend services must independently sanitize their responses.
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
  400: DEFAULT_OPTIONS.validationMessage,
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
  ...Object.values(STATUS_CODES),
  "NETWORK_ERROR",
  "ABORTED",
  "UNKNOWN_ERROR",
]);

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/u;
const MAX_PUBLIC_MESSAGE_LENGTH = 500;

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function safeString(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_PUBLIC_MESSAGE_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    return fallback;
  }

  return normalized;
}

function safeStatus(value) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 400 ||
    value > 599
  ) {
    return 500;
  }

  return value;
}

function getOption(options, key) {
  if (!isPlainObject(options)) {
    return DEFAULT_OPTIONS[key];
  }

  return safeString(options[key], DEFAULT_OPTIONS[key]);
}

function createCorrelationId() {
  try {
    if (
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Secure ID generation is unavailable in this environment.
  }

  // Fail closed instead of using Math.random() for an identifier that may
  // be mistaken for a security-sensitive token.
  return `req-${Date.now().toString(36)}-${fallbackSequence()}`;
}

let fallbackCounter = 0;

function fallbackSequence() {
  fallbackCounter = (fallbackCounter + 1) % 0xFFFFFF;
  return fallbackCounter.toString(36).padStart(5, "0");
}

function normalizeCorrelationId(value) {
  const candidate = safeString(value, "");

  if (
    candidate &&
    candidate.length <= 128 &&
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
  switch (status) {
    case 400:
    case 422:
      return getOption(options, "validationMessage");
    case 401:
      return getOption(options, "unauthorizedMessage");
    case 403:
      return getOption(options, "forbiddenMessage");
    case 404:
      return getOption(options, "notFoundMessage");
    case 408:
    case 504:
      return getOption(options, "timeoutMessage");
    case 429:
      return getOption(options, "rateLimitMessage");
    case 502:
    case 503:
      return getOption(options, "maintenanceMessage");
    default:
      return STATUS_MESSAGES[status] || getOption(options, "genericMessage");
  }
}

function isAbortError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  try {
    return error.name === "AbortError";
  } catch {
    return false;
  }
}

function isSafeAppError(error) {
  return error instanceof SafeAppError;
}

/**
 * Create a normalized internal error record.
 *
 * The original exception and its stack are never returned.
 */
export function normalizeError(error, options = {}) {
  const correlationId = normalizeCorrelationId(options?.correlationId);

  if (isSafeAppError(error)) {
    return Object.freeze({
      name: "SafeAppError",
      code: error.code,
      status: error.status,
      message: error.publicMessage,
      correlationId,
      retryable: error.retryable,
    });
  }

  if (isAbortError(error)) {
    return Object.freeze({
      name: "AbortError",
      code: "ABORTED",
      status: 408,
      message: getOption(options, "timeoutMessage"),
      correlationId,
      retryable: true,
    });
  }

  // Do not infer HTTP status from TypeError or SyntaxError. These can arise
  // from programming errors, JSON parsing, or unrelated client operations.
  return Object.freeze({
    name: "SafeAppError",
    code: "UNKNOWN_ERROR",
    status: 500,
    message: getOption(options, "genericMessage"),
    correlationId,
    retryable: false,
  });
}

/**
 * Application error with an explicitly controlled public message.
 *
 * `message` and `cause` are internal diagnostics. Never display them directly.
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
    const internalMessage =
      typeof message === "string" ? message : "Application error";

    super(
      internalMessage,
      cause === undefined ? undefined : { cause },
    );

    this.name = "SafeAppError";
    this.code = SAFE_ERROR_CODES.has(code) ? code : "INTERNAL_ERROR";
    this.status = safeStatus(status);
    this.publicMessage = safeString(
      publicMessage,
      DEFAULT_OPTIONS.genericMessage,
    );
    this.retryable = retryable === true;
  }
}

/**
 * Create an application error from an HTTP status.
 */
export function createHttpError(status, options = {}) {
  const normalizedStatus = safeStatus(status);
  const suppliedCode = options?.code;

  // The status determines the public classification. A caller may supply
  // an alternative known code only when it is consistent with the status.
  const mappedCode = statusToCode(normalizedStatus);
  const code =
    SAFE_ERROR_CODES.has(suppliedCode) &&
    suppliedCode === mappedCode
      ? suppliedCode
      : mappedCode;

  const retryable =
    typeof options?.retryable === "boolean"
      ? options.retryable
      : [408, 429, 502, 503, 504].includes(normalizedStatus);

  return new SafeAppError(
    typeof options?.internalMessage === "string"
      ? options.internalMessage
      : `HTTP ${normalizedStatus}`,
    {
      code,
      status: normalizedStatus,
      publicMessage: safeString(
        options?.publicMessage,
        statusToMessage(normalizedStatus, options),
      ),
      retryable,
      cause: options?.cause,
    },
  );
}

/**
 * Build a safe object for UI display.
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
 * Extract a safe error from a Fetch Response.
 *
 * Server-provided messages are never rendered directly.
 */
export async function fromResponse(response, options = {}) {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.status !== "number"
  ) {
    return normalizeError(null, options);
  }

  const status = safeStatus(response.status);

  let correlationId = normalizeCorrelationId(options?.correlationId);

  try {
    const headers = response.headers;

    const headerId =
      headers?.get?.("x-correlation-id") ||
      headers?.get?.("x-request-id");

    if (headerId) {
      correlationId = normalizeCorrelationId(headerId);
    }
  } catch {
    // Malformed or inaccessible headers do not prevent safe error handling.
  }

  // Intentionally do not parse the response body. It is unnecessary to
  // determine the safe public message and may contain private server details.
  return Object.freeze({
    name: "HttpResponseError",
    code: statusToCode(status),
    status,
    message: statusToMessage(status, options),
    correlationId,
    retryable: [408, 429, 502, 503, 504].includes(status),
  });
}

/**
 * Normalize common client-side network failures.
 */
export function fromNetworkError(error, options = {}) {
  const correlationId = normalizeCorrelationId(options?.correlationId);

  if (isAbortError(error)) {
    return Object.freeze({
      name: "AbortError",
      code: "ABORTED",
      status: 408,
      message: getOption(options, "timeoutMessage"),
      correlationId,
      retryable: true,
    });
  }

  return Object.freeze({
    name: "NetworkError",
    code: "NETWORK_ERROR",
    status: 0,
    message: getOption(options, "networkMessage"),
    correlationId,
    retryable: true,
  });
}

/**
 * Display an error using textContent rather than innerHTML.
 *
 * @param {HTMLElement} element
 * @param {object} error A normalized error or toUserError() result.
 */
export function displayError(element, error) {
  if (
    !element ||
    typeof element !== "object" ||
    !("textContent" in element)
  ) {
    throw new TypeError("A valid error display element is required.");
  }

  const nestedError = isPlainObject(error?.error) ? error.error : error;
  const message = safeString(
    nestedError?.message,
    DEFAULT_OPTIONS.genericMessage,
  );

  element.textContent = message;
  element.hidden = false;

  if (typeof element.setAttribute === "function") {
    element.setAttribute("role", "alert");
    element.setAttribute("aria-live", "assertive");
  }

  return element;
}

/**
 * Clear an error display element.
 */
export function clearError(element) {
  if (!element || typeof element !== "object" || !("textContent" in element)) {
    return;
  }

  element.textContent = "";
  element.hidden = true;
}

/**
 * Generate or validate a correlation ID.
 *
 * Correlation IDs are diagnostic metadata, never authentication credentials.
 */
export function getCorrelationId(existingId) {
  return normalizeCorrelationId(existingId);
}

/**
 * Return copied headers with a correlation ID.
 *
 * Supports a Headers instance or a plain object.
 */
export function withCorrelationId(headers = {}, correlationId) {
  const requestId = getCorrelationId(correlationId);

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    const copy = new Headers(headers);
    copy.set("X-Correlation-ID", requestId);
    return copy;
  }

  const result = {};

  if (isPlainObject(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      // Header names are case-insensitive; replace existing variants.
      if (key.toLowerCase() !== "x-correlation-id") {
        result[key] = value;
      }
    }
  }

  result["X-Correlation-ID"] = requestId;
  return result;
}

/**
 * Report sanitized error metadata through an application-provided reporter.
 *
 * This function never transmits errors itself.
 */
export function reportSafeError(error, reporter, options = {}) {
  const normalized = normalizeError(error, options);

  if (typeof reporter !== "function") {
    return normalized;
  }

  try {
    reporter(
      Object.freeze({
        code: normalized.code,
        status: normalized.status,
        correlationId: normalized.correlationId,
        retryable: normalized.retryable,
      }),
    );
  } catch {
    // Reporting failures must not disrupt application behavior.
  }

  return normalized;
}

/**
 * Normalize an API response into a consistent UI error object.
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
 * Convert a caught exception into a safe UI response.
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
