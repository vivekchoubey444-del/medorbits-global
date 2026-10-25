
/* =========================================================
   MEDORBITS | API CLIENT
   File: assets/js/api-client.js
   Version: 1.0.0

   Features:
   - No dependencies or framework requirements
   - No CSS or layout modifications
   - Configurable API base URL
   - JSON and FormData request support
   - Request timeout and AbortSignal support
   - Safe JSON/text response parsing
   - Structured API errors
   - Optional CSRF token support
   - Optional credentials policy
   - Duplicate concurrent GET request deduplication
   - Safe retry policy for selected transient failures
   - Request/response hooks
   - No sensitive payload logging
   - Duplicate-script-load protection

   Load before scripts that use the client:
   <script src="/assets/js/api-client.js" defer></script>

   SECURITY:
   Client-side checks are not authorization controls.
   Enforce authentication, permissions, validation, rate limits,
   and data protection on the server.
   ========================================================= */

(function medOrbitsApiClient() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_API_CLIENT_V1__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  const DEFAULTS = Object.freeze({
    baseURL: "/api",
    timeout: 15000,
    credentials: "same-origin",
    headers: {},
    csrfTokenSelector: 'meta[name="csrf-token"]',
    csrfHeaderName: "X-CSRF-Token",
    deduplicateGET: true,
    retryCount: 0,
    retryDelay: 300,
    maxRetryDelay: 3000
  });

  const state = {
    config: { ...DEFAULTS },
    inflightGET: new Map(),
    requestInterceptors: [],
    responseInterceptors: [],
    requestCounter: 0,
    destroyed: false
  };

  class ApiError extends Error {
    constructor(message, options) {
      super(message);

      options = options || {};

      this.name = "ApiError";
      this.status = options.status || 0;
      this.code = options.code || "API_ERROR";
      this.url = options.url || "";
      this.method = options.method || "GET";
      this.details = options.details ?? null;
      this.data = options.data ?? null;
      this.retryable = Boolean(options.retryable);

      if (options.cause !== undefined) {
        this.cause = options.cause;
      }
    }
  }

  /* ---------------------------------------------------------
     1. CONFIGURATION AND URL HELPERS
     --------------------------------------------------------- */

  function normalizeBaseURL(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("API baseURL must be a non-empty string.");
    }

    const base = value.trim();

    if (/^[a-z][a-z\d+.-]*:/i.test(base)) {
      const parsed = new URL(base, window.location.href);

      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new TypeError("API baseURL must use HTTP or HTTPS.");
      }

      return parsed.href.replace(/\/+$/, "");
    }

    if (base.startsWith("//")) {
      throw new TypeError("Protocol-relative API URLs are not allowed.");
    }

    return base.replace(/\/+$/, "") || "/";
  }

  function configure(options) {
    if (!options || typeof options !== "object") {
      return getConfig();
    }

    if (Object.prototype.hasOwnProperty.call(options, "baseURL")) {
      state.config.baseURL = normalizeBaseURL(options.baseURL);
    }

    if (
      Object.prototype.hasOwnProperty.call(options, "timeout")
    ) {
      const timeout = Number(options.timeout);

      if (!Number.isFinite(timeout) || timeout < 0) {
        throw new TypeError("timeout must be a non-negative number.");
      }

      state.config.timeout = timeout;
    }

    if (
      Object.prototype.hasOwnProperty.call(options, "credentials")
    ) {
      const allowed = [
        "omit",
        "same-origin",
        "include"
      ];

      if (!allowed.includes(options.credentials)) {
        throw new TypeError("Invalid credentials policy.");
      }

      state.config.credentials = options.credentials;
    }

    if (options.headers && typeof options.headers === "object") {
      state.config.headers = {
        ...state.config.headers,
        ...options.headers
      };
    }

    if (
      Object.prototype.hasOwnProperty.call(
        options,
        "csrfTokenSelector"
      )
    ) {
      state.config.csrfTokenSelector =
        options.csrfTokenSelector;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        options,
        "csrfHeaderName"
      )
    ) {
      state.config.csrfHeaderName = options.csrfHeaderName;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        options,
        "deduplicateGET"
      )
    ) {
      state.config.deduplicateGET =
        Boolean(options.deduplicateGET);
    }

    if (
      Object.prototype.hasOwnProperty.call(options, "retryCount")
    ) {
      const retries = Number(options.retryCount);

      if (
        !Number.isInteger(retries) ||
        retries < 0 ||
        retries > 3
      ) {
        throw new TypeError(
          "retryCount must be an integer from 0 to 3."
        );
      }

      state.config.retryCount = retries;
    }

    return getConfig();
  }

  function getConfig() {
    return Object.freeze({
      ...state.config,
      headers: { ...state.config.headers }
    });
  }

  function buildURL(path, query) {
    if (typeof path !== "string" || !path.trim()) {
      throw new TypeError("Request path must be a non-empty string.");
    }

    const trimmedPath = path.trim();

    // Prevent accidental protocol-relative or external API paths.
    if (
      trimmedPath.startsWith("//") ||
      /^[a-z][a-z\d+.-]*:/i.test(trimmedPath)
    ) {
      throw new TypeError(
        "Use a relative API path, not an external URL."
      );
    }

    const base = state.config.baseURL;
    const cleanPath = trimmedPath.replace(/^\/+/, "");

    let url;

    if (/^https?:\/\//i.test(base)) {
      url = new URL(
        cleanPath,
        base.endsWith("/") ? base : base + "/"
      );
    } else {
      const prefix = base === "/" ? "" : base;

      url = new URL(
        (prefix + "/" + cleanPath).replace(/\/{2,}/g, "/"),
        window.location.origin
      );
    }

    if (query && typeof query === "object") {
      Object.entries(query).forEach(function ([key, value]) {
        if (value === undefined || value === null) {
          return;
        }

        if (Array.isArray(value)) {
          value.forEach(function (item) {
            if (item !== undefined && item !== null) {
              url.searchParams.append(key, String(item));
            }
          });
        } else {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url;
  }

  /* ---------------------------------------------------------
     2. HEADERS AND CSRF
     --------------------------------------------------------- */

  function getCsrfToken() {
    const selector = state.config.csrfTokenSelector;

    if (typeof selector !== "string" || !selector.trim()) {
      return null;
    }

    try {
      const element = document.querySelector(selector);

      if (!element) {
        return null;
      }

      return (
        element.getAttribute("content") ||
        element.value ||
        null
      );
    } catch (error) {
      return null;
    }
  }

  function createHeaders(options, hasBody) {
    const headers = new Headers(state.config.headers);

    if (options.headers) {
      const suppliedHeaders = new Headers(options.headers);

      suppliedHeaders.forEach(function (value, key) {
        headers.set(key, value);
      });
    }

    if (
      hasBody &&
      !(options.body instanceof FormData) &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const csrfToken = getCsrfToken();
    const method = (options.method || "GET").toUpperCase();

    if (
      csrfToken &&
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !headers.has(state.config.csrfHeaderName)
    ) {
      headers.set(state.config.csrfHeaderName, csrfToken);
    }

    return headers;
  }

  /* ---------------------------------------------------------
     3. RESPONSE PARSING
     --------------------------------------------------------- */

  async function parseResponse(response) {
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (error) {
        throw new ApiError(
          "The server returned invalid JSON.",
          {
            status: response.status,
            code: "INVALID_JSON",
            url: response.url,
            retryable: false,
            cause: error
          }
        );
      }
    }

    const text = await response.text();

    return text || null;
  }

  function extractErrorMessage(data, status) {
    if (data && typeof data === "object") {
      if (
        typeof data.message === "string" &&
        data.message.trim()
      ) {
        return data.message.trim();
      }

      if (
        typeof data.error === "string" &&
        data.error.trim()
      ) {
        return data.error.trim();
      }
    }

    return status
      ? "The request failed with HTTP status " + status + "."
      : "The API request failed.";
  }

  function isRetryableStatus(status) {
    return [
      408,
      425,
      429,
      500,
      502,
      503,
      504
    ].includes(status);
  }

  /* ---------------------------------------------------------
     4. REQUEST INTERCEPTORS
     --------------------------------------------------------- */

  function useRequest(interceptor) {
    if (typeof interceptor !== "function") {
      throw new TypeError("Request interceptor must be a function.");
    }

    state.requestInterceptors.push(interceptor);

    return function unsubscribe() {
      const index = state.requestInterceptors.indexOf(interceptor);

      if (index !== -1) {
        state.requestInterceptors.splice(index, 1);
      }
    };
  }

  function useResponse(interceptor) {
    if (typeof interceptor !== "function") {
      throw new TypeError("Response interceptor must be a function.");
    }

    state.responseInterceptors.push(interceptor);

    return function unsubscribe() {
      const index = state.responseInterceptors.indexOf(interceptor);

      if (index !== -1) {
        state.responseInterceptors.splice(index, 1);
      }
    };
  }

  async function runRequestInterceptors(context) {
    let current = context;

    for (const interceptor of state.requestInterceptors) {
      current = await interceptor(current);

      if (!current || typeof current !== "object") {
        throw new ApiError(
          "A request interceptor returned an invalid result.",
          { code: "INVALID_REQUEST_INTERCEPTOR" }
        );
      }
    }

    return current;
  }

  async function runResponseInterceptors(result) {
    let current = result;

    for (const interceptor of state.responseInterceptors) {
      current = await interceptor(current);
    }

    return current;
  }

  /* ---------------------------------------------------------
     5. CORE REQUEST ENGINE
     --------------------------------------------------------- */

  function sleep(milliseconds, signal) {
    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        reject(new DOMException("Request aborted.", "AbortError"));
        return;
      }

      const timer = window.setTimeout(function () {
        cleanup();
        resolve();
      }, milliseconds);

      function onAbort() {
        window.clearTimeout(timer);
        cleanup();
        reject(new DOMException("Request aborted.", "AbortError"));
      }

      function cleanup() {
        if (signal) {
          signal.removeEventListener("abort", onAbort);
        }
      }

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  async function performRequest(context) {
    const method = context.method;
    const url = context.url;
    const options = context.options;

    const maxRetries = Number.isInteger(options.retryCount)
      ? Math.max(0, Math.min(3, options.retryCount))
      : state.config.retryCount;

    let attempt = 0;

    while (true) {
      if (state.destroyed) {
        throw new ApiError(
          "The API client has been destroyed.",
          { code: "CLIENT_DESTROYED", method, url: url.href }
        );
      }

      const controller = new AbortController();
      let timedOut = false;

      const timeout = Number.isFinite(options.timeout)
        ? Math.max(0, options.timeout)
        : state.config.timeout;

      let timeoutId = null;

      if (timeout > 0) {
        timeoutId = window.setTimeout(function () {
          timedOut = true;
          controller.abort();
        }, timeout);
      }

      const externalSignal = options.signal;
      let externalAbortHandler = null;

      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
        } else {
          externalAbortHandler = function () {
            controller.abort();
          };

          externalSignal.addEventListener(
            "abort",
            externalAbortHandler,
            { once: true }
          );
        }
      }

      try {
        let body = options.body;

        if (
          body !== undefined &&
          body !== null &&
          !(body instanceof FormData) &&
          !(body instanceof Blob) &&
          !(body instanceof URLSearchParams) &&
          typeof body !== "string" &&
          !(body instanceof ArrayBuffer) &&
          !ArrayBuffer.isView(body)
        ) {
          body = JSON.stringify(body);
        }

        const requestInit = {
          method,
          headers: createHeaders(options, body !== undefined && body !== null),
          credentials: options.credentials || state.config.credentials,
          signal: controller.signal,
          cache: options.cache,
          redirect: options.redirect || "follow"
        };

        if (
          body !== undefined &&
          body !== null &&
          !["GET", "HEAD"].includes(method)
        ) {
          requestInit.body = body;
        }

        const response = await fetch(url.href, requestInit);
        const data = await parseResponse(response);

        if (!response.ok) {
          throw new ApiError(
            extractErrorMessage(data, response.status),
            {
              status: response.status,
              code:
                data && typeof data === "object" && data.code
                  ? String(data.code)
                  : "HTTP_ERROR",
              url: url.href,
              method,
              data,
              details:
                data && typeof data === "object"
                  ? data.details ?? data.errors ?? null
                  : null,
              retryable: isRetryableStatus(response.status)
            }
          );
        }

        return {
          data,
          status: response.status,
          headers: response.headers,
          url: response.url || url.href,
          method
        };
      } catch (error) {
        if (error instanceof ApiError) {
          if (
            error.retryable &&
            attempt < maxRetries &&
            !["POST", "PUT", "PATCH", "DELETE"].includes(method)
          ) {
            attempt += 1;

            const delay = Math.min(
              state.config.maxRetryDelay,
              state.config.retryDelay * Math.pow(2, attempt - 1)
            );

            await sleep(delay, externalSignal);
            continue;
          }

          throw error;
        }

        if (
          externalSignal &&
          externalSignal.aborted
        ) {
          throw new ApiError(
            "The request was cancelled.",
            {
              code: "REQUEST_ABORTED",
              method,
              url: url.href,
              cause: error
            }
          );
        }

        if (timedOut) {
          throw new ApiError(
            "The request timed out. Please try again.",
            {
              code: "REQUEST_TIMEOUT",
              method,
              url: url.href,
              retryable: true,
              cause: error
            }
          );
        }

        // Network errors may be transient, but never automatically
        // retry mutation requests that could create duplicate records.
        if (
          attempt < maxRetries &&
          !["POST", "PUT", "PATCH", "DELETE"].includes(method)
        ) {
          attempt += 1;

          const delay = Math.min(
            state.config.maxRetryDelay,
            state.config.retryDelay * Math.pow(2, attempt - 1)
          );

          await sleep(delay, externalSignal);
          continue;
        }

        throw new ApiError(
          "Unable to connect to the server. Check your connection and try again.",
          {
            code: "NETWORK_ERROR",
            method,
            url: url.href,
            retryable: true,
            cause: error
          }
        );
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        if (externalSignal && externalAbortHandler) {
          externalSignal.removeEventListener(
            "abort",
            externalAbortHandler
          );
        }
      }
    }
  }

  async function request(path, options) {
    if (state.destroyed) {
      throw new ApiError(
        "The API client has been destroyed.",
        { code: "CLIENT_DESTROYED" }
      );
    }

    options = options || {};

    const method = String(options.method || "GET").toUpperCase();

    if (!/^[A-Z]+$/.test(method)) {
      throw new TypeError("Invalid HTTP method.");
    }

    const url = buildURL(path, options.query);

    let context = {
      method,
      url,
      options: { ...options }
    };

    context = await runRequestInterceptors(context);

    if (!(context.url instanceof URL)) {
      context.url = new URL(
        String(context.url),
        window.location.href
      );
    }

    const canDeduplicate =
      state.config.deduplicateGET &&
      method === "GET" &&
      !options.signal &&
      options.deduplicate !== false;

    const key = canDeduplicate
      ? method + ":" + context.url.href
      : null;

    if (key && state.inflightGET.has(key)) {
      return state.inflightGET.get(key);
    }

    const promise = performRequest(context)
      .then(runResponseInterceptors)
      .finally(function () {
        if (key && state.inflightGET.get(key) === promise) {
          state.inflightGET.delete(key);
        }
      });

    if (key) {
      state.inflightGET.set(key, promise);
    }

    return promise;
  }

  /* ---------------------------------------------------------
     6. CONVENIENCE METHODS
     --------------------------------------------------------- */

  function get(path, options) {
    return request(path, {
      ...(options || {}),
      method: "GET"
    });
  }

  function post(path, body, options) {
    return request(path, {
      ...(options || {}),
      method: "POST",
      body
    });
  }

  function put(path, body, options) {
    return request(path, {
      ...(options || {}),
      method: "PUT",
      body
    });
  }

  function patch(path, body, options) {
    return request(path, {
      ...(options || {}),
      method: "PATCH",
      body
    });
  }

  function del(path, options) {
    return request(path, {
      ...(options || {}),
      method: "DELETE"
    });
  }

  function upload(path, formData, options) {
    if (!(formData instanceof FormData)) {
      return Promise.reject(
        new TypeError("upload() requires a FormData instance.")
      );
    }

    const uploadOptions = {
      ...(options || {}),
      method: "POST",
      body: formData
    };

    if (uploadOptions.headers) {
      uploadOptions.headers = new Headers(uploadOptions.headers);
      uploadOptions.headers.delete("Content-Type");
    }

    return request(path, uploadOptions);
  }

  /* ---------------------------------------------------------
     7. CLEANUP AND PUBLIC API
     --------------------------------------------------------- */

  function destroy() {
    state.destroyed = true;
    state.inflightGET.clear();
    state.requestInterceptors.length = 0;
    state.responseInterceptors.length = 0;
  }

  const client = Object.freeze({
    configure,
    getConfig,
    request,
    get,
    post,
    put,
    patch,
    delete: del,
    upload,
    useRequest,
    useResponse,
    ApiError,
    destroy
  });

  window[GLOBAL_KEY] = client;
  window.MedOrbitsAPI = client;

  /*
   * Safe same-origin default.
   * Override this during application initialization if needed:
   *
   * MedOrbitsAPI.configure({ baseURL: "/api/v1" });
   */
})();
