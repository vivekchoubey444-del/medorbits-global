
/**
 * MedOrbits -- Centralized API Service
 * File: /src/js/services/api.services.js
 *
 * Responsibilities:
 * - Centralized HTTP requests.
 * - JSON and multipart/form-data support.
 * - Request timeouts and cancellation.
 * - Correlation ID propagation.
 * - Query parameter serialization.
 * - Consistent API error handling.
 * - Reusable methods for MedOrbits API resources.
 *
 * Module format: ES Module
 *
 * Security:
 * - Never place API secrets in frontend code.
 * - Server-side authentication and authorization remain authoritative.
 * - Do not automatically retry non-idempotent requests.
 * - Do not expose raw server errors or response bodies in exceptions.
 */

import {
  APP,
  API,
  HTTP,
} from "../utils/contants.js";

/* --------------------------------------------------------------------------
 * Internal constants
 * -------------------------------------------------------------------------- */

const DEFAULT_TIMEOUT_MS = API.DEFAULT_TIMEOUT_MS || 15000;
const UPLOAD_TIMEOUT_MS = API.UPLOAD_TIMEOUT_MS || 60000;

const SAFE_ERROR_MESSAGES = Object.freeze({
  400: "The request contains invalid information.",
  401: "Please sign in to continue.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource could not be found.",
  409: "This operation conflicts with the current resource state.",
  413: "The submitted file or request is too large.",
  422: "Please check the submitted information.",
  429: "Too many requests. Please wait and try again.",
  500: "An unexpected server error occurred.",
  502: "The service is temporarily unavailable.",
  503: "The service is temporarily unavailable.",
  504: "The request timed out while waiting for the service.",
});

const SAFE_ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "NETWORK_ERROR",
  "REQUEST_TIMEOUT",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
  "UNKNOWN_ERROR",
]);

const HTTP_METHODS = new Set(
  Object.values(HTTP.METHODS)
);

const hasOwn = (object, key) =>
  Object.prototype.hasOwnProperty.call(object, key);

/* --------------------------------------------------------------------------
 * Correlation IDs
 * -------------------------------------------------------------------------- */

/**
 * Generate a diagnostic request identifier.
 *
 * This is not an authentication token or a security credential.
 */
export function createCorrelationId() {
  try {
    if (
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Use the non-cryptographic fallback below.
  }

  return `req-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}

/**
 * Accept only simple, bounded correlation ID values.
 */
function normalizeCorrelationId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const id = value.trim();

  if (
    !id ||
    id.length > 128 ||
    !/^[a-zA-Z0-9._:-]+$/.test(id)
  ) {
    return null;
  }

  return id;
}

/* --------------------------------------------------------------------------
 * Safe API errors
 * -------------------------------------------------------------------------- */

/**
 * Standardized error for API operations.
 *
 * The public message is deliberately controlled by this module.
 * Raw server messages and response bodies are not included.
 */
export class ApiServiceError extends Error {
  constructor({
    message = "The request could not be completed.",
    status = 0,
    code = "UNKNOWN_ERROR",
    correlationId = null,
    retryAfter = null,
    cause,
  } = {}) {
    super(message);

    this.name = "ApiServiceError";
    this.status = Number.isInteger(status) ? status : 0;
    this.code = SAFE_ERROR_CODES.has(code)
      ? code
      : "UNKNOWN_ERROR";
    this.correlationId = normalizeCorrelationId(correlationId);
    this.retryAfter = retryAfter;

    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      correlationId: this.correlationId,
    };
  }
}

function safeErrorCode(value, status) {
  if (
    typeof value === "string" &&
    SAFE_ERROR_CODES.has(value)
  ) {
    return value;
  }

  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_ERROR";
    case 429:
      return "RATE_LIMITED";
    case 502:
    case 503:
    case 504:
      return "SERVICE_UNAVAILABLE";
    case 500:
      return "INTERNAL_ERROR";
    default:
      return "UNKNOWN_ERROR";
  }
}

function safeErrorMessage(status) {
  return SAFE_ERROR_MESSAGES[status] ||
    "The request could not be completed.";
}

function createApiError({
  status = 0,
  code,
  correlationId,
  retryAfter = null,
  message,
  cause,
} = {}) {
  const normalizedStatus =
    Number.isInteger(status) && status >= 0 && status <= 599
      ? status
      : 0;

  return new ApiServiceError({
    status: normalizedStatus,
    code: code || safeErrorCode(normalizedStatus),
    message: message || safeErrorMessage(normalizedStatus),
    correlationId,
    retryAfter,
    cause,
  });
}

/* --------------------------------------------------------------------------
 * URL construction
 * -------------------------------------------------------------------------- */

function getBaseUrl() {
  const configuredBase = API.BASE_URL;

  if (
    typeof configuredBase === "string" &&
    configuredBase.trim()
  ) {
    return configuredBase.trim();
  }

  return "";
}

function getOrigin() {
  if (
    typeof globalThis.location !== "undefined" &&
    globalThis.location.origin
  ) {
    return globalThis.location.origin;
  }

  return "http://localhost";
}

/**
 * Build a request URL.
 *
 * Relative paths remain relative when no API base URL is configured.
 * Query parameters are added without overwriting existing parameters.
 */
export function buildRequestUrl(path, query) {
  if (typeof path !== "string" || !path.trim()) {
    throw new TypeError("An API request path is required.");
  }

  const normalizedPath = path.trim();

  if (/[\u0000-\u0020\u007F]/u.test(normalizedPath)) {
    throw new TypeError("The API request path is invalid.");
  }

  const base = getBaseUrl();
  const absoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(normalizedPath);

  if (absoluteUrl) {
    throw new TypeError(
      "Absolute request URLs are not accepted by this API client."
    );
  }

  const basePath = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;

  let url;

  if (base) {
    let parsedBase;

    try {
      parsedBase = new URL(base);
    } catch {
      throw new TypeError("The configured API base URL is invalid.");
    }

    if (!["http:", "https:"].includes(parsedBase.protocol)) {
      throw new TypeError("The configured API base URL is invalid.");
    }

    url = new URL(basePath, parsedBase);
  } else {
    url = new URL(basePath, getOrigin());
  }

  if (query !== undefined && query !== null) {
    if (
      typeof query !== "object" ||
      Array.isArray(query)
    ) {
      throw new TypeError("Query parameters must be an object.");
    }

    for (const [key, value] of Object.entries(query)) {
      if (
        typeof key !== "string" ||
        /[\u0000-\u001F\u007F]/u.test(key)
      ) {
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        url.searchParams.delete(key);

        for (const item of value) {
          if (item !== undefined && item !== null) {
            url.searchParams.append(key, String(item));
          }
        }

        continue;
      }

      if (typeof value === "object") {
        continue;
      }

      url.searchParams.set(key, String(value));
    }
  }

  if (!base) {
    return `${url.pathname}${url.search}${url.hash}`;
  }

  return url.toString();
}

/* --------------------------------------------------------------------------
 * Response parsing
 * -------------------------------------------------------------------------- */

function isJsonContentType(contentType) {
  return typeof contentType === "string" &&
    (
      contentType.includes("application/json") ||
      contentType.includes("+json")
    );
}

/**
 * Parse a response without exposing its raw contents in errors.
 */
async function parseResponseBody(response) {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (isJsonContentType(contentType)) {
    try {
      return await response.json();
    } catch {
      throw createApiError({
        status: response.status,
        code: "BAD_REQUEST",
        correlationId: response.headers.get("x-correlation-id"),
        message: "The server returned an invalid response.",
      });
    }
  }

  if (contentType.includes("text/")) {
    try {
      return await response.text();
    } catch {
      throw createApiError({
        status: response.status,
        correlationId: response.headers.get("x-correlation-id"),
        message: "The server response could not be read.",
      });
    }
  }

  return null;
}

function getServerErrorDetails(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  const errorObject =
    body.error && typeof body.error === "object"
      ? body.error
      : body;

  const code = typeof errorObject.code === "string"
    ? errorObject.code
    : undefined;

  const requestId =
    errorObject.requestId ||
    errorObject.correlationId ||
    body.requestId ||
    body.correlationId;

  return {
    code: SAFE_ERROR_CODES.has(code) ? code : undefined,
    correlationId: normalizeCorrelationId(requestId),
  };
}

/* --------------------------------------------------------------------------
 * Request options
 * -------------------------------------------------------------------------- */

function isFormData(value) {
  return typeof FormData !== "undefined" &&
    value instanceof FormData;
}

function isBlob(value) {
  return typeof Blob !== "undefined" &&
    value instanceof Blob;
}

function isReadableStream(value) {
  return typeof ReadableStream !== "undefined" &&
    value instanceof ReadableStream;
}

function isArrayBuffer(value) {
  return (
    (typeof ArrayBuffer !== "undefined" &&
      value instanceof ArrayBuffer) ||
    (typeof ArrayBuffer !== "undefined" &&
      ArrayBuffer.isView(value))
  );
}

function isBodyInit(value) {
  return (
    typeof value === "string" ||
    isFormData(value) ||
    isBlob(value) ||
    isReadableStream(value) ||
    isArrayBuffer(value) ||
    (typeof URLSearchParams !== "undefined" &&
      value instanceof URLSearchParams)
  );
}

function createHeaders(inputHeaders, body) {
  const headers = new Headers(inputHeaders || {});

  if (!headers.has(HTTP.HEADERS.ACCEPT)) {
    headers.set(
      HTTP.HEADERS.ACCEPT,
      HTTP.CONTENT_TYPES.JSON
    );
  }

  if (
    body !== undefined &&
    body !== null &&
    !isFormData(body) &&
    !isBlob(body) &&
    !isArrayBuffer(body) &&
    !isReadableStream(body) &&
    !(typeof URLSearchParams !== "undefined" &&
      body instanceof URLSearchParams) &&
    !headers.has(HTTP.HEADERS.CONTENT_TYPE)
  ) {
    headers.set(
      HTTP.HEADERS.CONTENT_TYPE,
      HTTP.CONTENT_TYPES.JSON
    );
  }

  return headers;
}

function normalizeRequestBody(body, headers) {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (isBodyInit(body)) {
    return body;
  }

  const contentType = headers.get(HTTP.HEADERS.CONTENT_TYPE) || "";

  if (
    contentType.includes("application/json") ||
    contentType.includes("+json")
  ) {
    try {
      return JSON.stringify(body);
    } catch {
      throw new TypeError("The request body could not be serialized.");
    }
  }

  throw new TypeError(
    "Unsupported request body. Supply JSON-compatible data or a supported BodyInit value."
  );
}

function createTimeoutSignal(timeoutMs, callerSignal) {
  const timeout = Number(timeoutMs);

  if (
    !Number.isFinite(timeout) ||
    timeout <= 0
  ) {
    throw new TypeError("Request timeout must be a positive number.");
  }

  const controller = new AbortController();

  let timeoutId = null;
  let timedOut = false;

  const abortFromCaller = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else if (callerSignal) {
    callerSignal.addEventListener(
      "abort",
      abortFromCaller,
      { once: true }
    );
  }

  timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(
      new DOMException("Request timed out.", "TimeoutError")
    );
  }, timeout);

  return {
    signal: controller.signal,

    didTimeout() {
      return timedOut;
    },

    cleanup() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      if (callerSignal) {
        callerSignal.removeEventListener(
          "abort",
          abortFromCaller
        );
      }
    },
  };
}

/* --------------------------------------------------------------------------
 * Main API client
 * -------------------------------------------------------------------------- */

export class ApiClient {
  constructor({
    baseUrl = API.BASE_URL || "",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    credentials = "same-origin",
    defaultHeaders = {},
    fetchImplementation,
  } = {}) {
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new TypeError("The default timeout must be positive.");
    }

    if (
      !["omit", "same-origin", "include"].includes(credentials)
    ) {
      throw new TypeError("Invalid fetch credentials mode.");
    }

    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.credentials = credentials;
    this.defaultHeaders = new Headers(defaultHeaders);

    this.fetchImplementation =
      fetchImplementation ||
      (typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : null);

    if (!this.fetchImplementation) {
      throw new Error("This environment does not support fetch.");
    }
  }

  /**
   * Perform a request.
   *
   * Returns parsed response data on success.
   * Throws ApiServiceError for HTTP and network failures.
   */
  async request(path, options = {}) {
    const {
      method = HTTP.METHODS.GET,
      headers: requestHeaders,
      body,
      query,
      timeoutMs = this.timeoutMs,
      signal,
      credentials = this.credentials,
      correlationId: suppliedCorrelationId,
      includeCorrelationId = true,
      ...fetchOptions
    } = options;

    const normalizedMethod = String(method).toUpperCase();

    if (!HTTP_METHODS.has(normalizedMethod)) {
      throw new TypeError("Unsupported HTTP method.");
    }

    if (
      ["GET", "HEAD"].includes(normalizedMethod) &&
      body !== undefined &&
      body !== null
    ) {
      throw new TypeError(
        `${normalizedMethod} requests cannot contain a request body.`
      );
    }

    if (
      !["omit", "same-origin", "include"].includes(credentials)
    ) {
      throw new TypeError("Invalid fetch credentials mode.");
    }

    const url = buildRequestUrl(path, query);

    const headers = new Headers(this.defaultHeaders);

    if (requestHeaders) {
      new Headers(requestHeaders).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const requestId = normalizeCorrelationId(suppliedCorrelationId) ||
      createCorrelationId();

    if (
      includeCorrelationId &&
      !headers.has(HTTP.HEADERS.CORRELATION_ID)
    ) {
      headers.set(HTTP.HEADERS.CORRELATION_ID, requestId);
    }

    if (!headers.has(HTTP.HEADERS.ACCEPT)) {
      headers.set(
        HTTP.HEADERS.ACCEPT,
        HTTP.CONTENT_TYPES.JSON
      );
    }

    const normalizedBody = normalizeRequestBody(body, headers);

    const timeout = createTimeoutSignal(timeoutMs, signal);

    try {
      let response;

      try {
        response = await this.fetchImplementation(url, {
          ...fetchOptions,
          method: normalizedMethod,
          headers,
          body: normalizedBody,
          credentials,
          signal: timeout.signal,
        });
      } catch (error) {
        if (timeout.didTimeout()) {
          throw createApiError({
            status: 0,
            code: "REQUEST_TIMEOUT",
            correlationId: requestId,
            message: "The request timed out. Please try again.",
            cause: error,
          });
        }

        if (signal?.aborted) {
          throw createApiError({
            status: 0,
            code: "UNKNOWN_ERROR",
            correlationId: requestId,
            message: "The request was cancelled.",
            cause: error,
          });
        }

        throw createApiError({
          status: 0,
          code: "NETWORK_ERROR",
          correlationId: requestId,
          message: "Unable to connect to the service. Check your connection and try again.",
          cause: error,
        });
      }

      const responseCorrelationId =
        normalizeCorrelationId(
          response.headers.get("x-correlation-id")
        ) ||
        normalizeCorrelationId(
          response.headers.get("x-request-id")
        ) ||
        requestId;

      let data;

      try {
        data = await parseResponseBody(response);
      } catch (error) {
        if (error instanceof ApiServiceError) {
          throw error;
        }

        throw createApiError({
          status: response.status,
          correlationId: responseCorrelationId,
          message: "The server response could not be processed.",
          cause: error,
        });
      }

      if (!response.ok) {
        const details = getServerErrorDetails(data);

        const status = response.status;
        const retryAfter = response.headers.get("retry-after");

        throw createApiError({
          status,
          code: details.code || safeErrorCode(status),
          correlationId:
            details.correlationId || responseCorrelationId,
          retryAfter,
          message: safeErrorMessage(status),
        });
      }

      return data;
    } finally {
      timeout.cleanup();
    }
  }

  get(path, options = {}) {
    return this.request(path, {
      ...options,
      method: HTTP.METHODS.GET,
    });
  }

  post(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: HTTP.METHODS.POST,
      body,
    });
  }

  put(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: HTTP.METHODS.PUT,
      body,
    });
  }

  patch(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: HTTP.METHODS.PATCH,
      body,
    });
  }

  delete(path, options = {}) {
    return this.request(path, {
      ...options,
      method: HTTP.METHODS.DELETE,
    });
  }

  /**
   * Upload FormData without setting Content-Type manually.
   * The browser must supply the multipart boundary.
   */
  upload(path, formData, options = {}) {
    if (!isFormData(formData)) {
      throw new TypeError("Uploads require a FormData instance.");
    }

    const headers = new Headers(options.headers || {});
    headers.delete(HTTP.HEADERS.CONTENT_TYPE);

    return this.request(path, {
      ...options,
      headers,
      body: formData,
      timeoutMs: options.timeoutMs || UPLOAD_TIMEOUT_MS,
      method: HTTP.METHODS.POST,
    });
  }
}

/* --------------------------------------------------------------------------
 * Default client
 * -------------------------------------------------------------------------- */

export const apiClient = new ApiClient();

/* --------------------------------------------------------------------------
 * Resource endpoint helpers
 *
 * Paths are derived from the shared endpoint configuration.
 * Verify them against the deployed backend routers.
 * -------------------------------------------------------------------------- */

function getConfiguredEndpoint(name) {
  const endpoint = API.ENDPOINTS[name];

  if (typeof endpoint !== "string" || !endpoint.trim()) {
    throw new TypeError(`The API endpoint "${name}" is not configured.`);
  }

  return `${API.PREFIX}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
}

function resourcePath(name, id) {
  const base = getConfiguredEndpoint(name);

  if (id === undefined || id === null || id === "") {
    return base;
  }

  const identifier = String(id);

  if (
    identifier.length > 256 ||
    /[\u0000-\u001F\u007F/\\?#]/u.test(identifier)
  ) {
    throw new TypeError("The resource identifier is invalid.");
  }

  return `${base}/${encodeURIComponent(identifier)}`;
}

/* --------------------------------------------------------------------------
 * Applications
 * -------------------------------------------------------------------------- */

export const applicationsApi = Object.freeze({
  list(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("APPLICATIONS"),
      options
    );
  },

  get(id, options = {}) {
    return apiClient.get(
      resourcePath("APPLICATIONS", id),
      options
    );
  },

  create(payload, options = {}) {
    return apiClient.post(
      getConfiguredEndpoint("APPLICATIONS"),
      payload,
      options
    );
  },

  update(id, payload, options = {}) {
    return apiClient.patch(
      resourcePath("APPLICATIONS", id),
      payload,
      options
    );
  },

  delete(id, options = {}) {
    return apiClient.delete(
      resourcePath("APPLICATIONS", id),
      options
    );
  },
});

/* --------------------------------------------------------------------------
 * Jobs
 * -------------------------------------------------------------------------- */

export const jobsApi = Object.freeze({
  list(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("JOBS"),
      options
    );
  },

  get(id, options = {}) {
    return apiClient.get(
      resourcePath("JOBS", id),
      options
    );
  },

  create(payload, options = {}) {
    return apiClient.post(
      getConfiguredEndpoint("JOBS"),
      payload,
      options
    );
  },

  update(id, payload, options = {}) {
    return apiClient.patch(
      resourcePath("JOBS", id),
      payload,
      options
    );
  },

  delete(id, options = {}) {
    return apiClient.delete(
      resourcePath("JOBS", id),
      options
    );
  },
});

/* --------------------------------------------------------------------------
 * Documents
 * -------------------------------------------------------------------------- */

export const documentsApi = Object.freeze({
  list(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("DOCUMENTS"),
      options
    );
  },

  get(id, options = {}) {
    return apiClient.get(
      resourcePath("DOCUMENTS", id),
      options
    );
  },

  upload(formData, options = {}) {
    return apiClient.upload(
      getConfiguredEndpoint("DOCUMENTS"),
      formData,
      options
    );
  },

  delete(id, options = {}) {
    return apiClient.delete(
      resourcePath("DOCUMENTS", id),
      options
    );
  },
});

/* --------------------------------------------------------------------------
 * Notifications
 * -------------------------------------------------------------------------- */

export const notificationsApi = Object.freeze({
  list(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("NOTIFICATIONS"),
      options
    );
  },
});

/* --------------------------------------------------------------------------
 * Support
 * -------------------------------------------------------------------------- */

export const supportApi = Object.freeze({
  list(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("SUPPORT"),
      options
    );
  },

  create(payload, options = {}) {
    return apiClient.post(
      getConfiguredEndpoint("SUPPORT"),
      payload,
      options
    );
  },
});

/* --------------------------------------------------------------------------
 * Health
 * -------------------------------------------------------------------------- */

export const healthApi = Object.freeze({
  check(options = {}) {
    return apiClient.get(
      getConfiguredEndpoint("HEALTH"),
      {
        ...options,
        timeoutMs: options.timeoutMs || 5000,
      }
    );
  },
});

/* --------------------------------------------------------------------------
 * Default export
 * -------------------------------------------------------------------------- */

const apiService = Object.freeze({
  ApiClient,
  ApiServiceError,
  apiClient,
  buildRequestUrl,
  createCorrelationId,
  applicationsApi,
  jobsApi,
  documentsApi,
  notificationsApi,
  supportApi,
  healthApi,
});

export default apiService;
