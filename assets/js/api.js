
/* =========================================================
   MedOrbits -- assets/js/api.js
   Central API client for MedOrbits
   Version: 1.1.0
   Runtime: Modern browsers
   Dependencies: None
   ========================================================= */
(function (window, document) {
  "use strict";

  const DEFAULTS = Object.freeze({
    baseURL:
      window.MedOrbitsConfig?.api?.baseURL ||
      window.MedOrbitsConstants?.API?.PREFIX ||
      "/api/v1",
    timeout: 20000,
    credentials: "same-origin",
    headers: Object.freeze({
      Accept: "application/json"
    }),
    csrf: Object.freeze({
      enabled: true,
      headerName: "X-CSRF-Token",
      metaName: "csrf-token",
      cookieName: "csrf-token"
    })
  });

  const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
  const VALID_CREDENTIALS = new Set([
    "omit",
    "same-origin",
    "include"
  ]);
  const BODYLESS_STATUSES = new Set([204, 205, 304]);
  const MAX_ERROR_MESSAGE_LENGTH = 1000;

  let config = {
    ...DEFAULTS,
    headers: new Headers(DEFAULTS.headers),
    csrf: { ...DEFAULTS.csrf }
  };

  let authTokenProvider = null;
  let csrfTokenProvider = null;
  let requestInterceptor = null;
  let responseInterceptor = null;
  let errorInterceptor = null;

  class APIError extends Error {
    constructor(message, options = {}) {
      super(String(message || "API request failed."));

      this.name = "APIError";
      this.status = options.status ?? 0;
      this.code = options.code ?? "API_ERROR";
      this.details = options.details ?? null;
      this.data = options.data ?? null;
      this.url = options.url ?? null;
      this.method = options.method ?? null;
      this.isNetworkError = options.isNetworkError === true;
      this.isTimeout = options.isTimeout === true;
      this.isAborted = options.isAborted === true;
      this.retryAfter = options.retryAfter ?? null;
    }
  }

  // --------------------------------------------------
  // Validation and utilities
  // --------------------------------------------------

  const utils = {
    isPlainObject(value) {
      if (value === null || typeof value !== "object") {
        return false;
      }

      const prototype = Object.getPrototypeOf(value);

      return (
        prototype === Object.prototype ||
        prototype === null
      );
    },

    isFormData(value) {
      return typeof FormData !== "undefined" &&
        value instanceof FormData;
    },

    isBlob(value) {
      return typeof Blob !== "undefined" &&
        value instanceof Blob;
    },

    isURLSearchParams(value) {
      return typeof URLSearchParams !== "undefined" &&
        value instanceof URLSearchParams;
    },

    isBodyInit(value) {
      return (
        typeof value === "string" ||
        this.isFormData(value) ||
        this.isBlob(value) ||
        this.isURLSearchParams(value) ||
        (
          typeof ArrayBuffer !== "undefined" &&
          (
            value instanceof ArrayBuffer ||
            ArrayBuffer.isView(value)
          )
        ) ||
        (
          typeof ReadableStream !== "undefined" &&
          value instanceof ReadableStream
        )
      );
    },

    normalizeBaseURL(value) {
      const base = String(value || "/api/v1").trim();

      if (!base || /[\u0000-\u001F\u007F]/.test(base)) {
        throw new TypeError("Invalid API base URL.");
      }

      if (/^[a-z][a-z\d+.-]*:/i.test(base)) {
        let parsed;

        try {
          parsed = new URL(base);
        } catch {
          throw new TypeError("Invalid API base URL.");
        }

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new TypeError("API URLs must use HTTP or HTTPS.");
        }

        if (parsed.username || parsed.password) {
          throw new TypeError(
            "API URLs must not contain embedded credentials."
          );
        }

        if (
          typeof window !== "undefined" &&
          parsed.origin !== window.location.origin &&
          parsed.protocol !== "https:"
        ) {
          throw new TypeError(
            "Cross-origin API URLs must use HTTPS."
          );
        }

        return parsed.href.replace(/\/+$/, "");
      }

      if (!base.startsWith("/") || base.startsWith("//")) {
        throw new TypeError(
          "Use a root-relative path such as /api/v1 or a valid API URL."
        );
      }

      const parsed = new URL(base, window.location.origin);

      if (parsed.origin !== window.location.origin) {
        throw new TypeError("Invalid API base URL origin.");
      }

      return parsed.pathname.replace(/\/+$/, "") || "/";
    },

    buildURL(path, params) {
      if (typeof path !== "string" || !path.trim()) {
        throw new TypeError("An API endpoint path is required.");
      }

      const endpoint = path.trim();

      if (
        /^[a-z][a-z\d+.-]*:/i.test(endpoint) ||
        endpoint.startsWith("//") ||
        endpoint.includes("\\") ||
        /[\u0000-\u001F\u007F]/.test(endpoint)
      ) {
        throw new TypeError("Invalid API endpoint path.");
      }

      let decodedEndpoint;

      try {
        decodedEndpoint = decodeURIComponent(endpoint);
      } catch {
        throw new TypeError("Invalid URL encoding in API path.");
      }

      if (
        decodedEndpoint.startsWith("//") ||
        decodedEndpoint.includes("\\") ||
        /[\u0000-\u001F\u007F]/.test(decodedEndpoint)
      ) {
        throw new TypeError("Invalid API endpoint path.");
      }

      const base = config.baseURL.replace(/\/+$/, "");
      const relativePath = endpoint.replace(/^\/+/, "");

      const url = new URL(
        `${base}/${relativePath}`,
        window.location.origin
      );

      const configuredOrigin = new URL(
        config.baseURL,
        window.location.origin
      ).origin;

      if (
        url.origin !== configuredOrigin &&
        url.origin !== window.location.origin
      ) {
        throw new TypeError("API endpoint origin mismatch.");
      }

      if (params != null) {
        const entries = params instanceof URLSearchParams
          ? params.entries()
          : Object.entries(params);

        for (const [key, value] of entries) {
          if (value === undefined || value === null) {
            continue;
          }

          url.searchParams.delete(key);

          const values = Array.isArray(value) ? value : [value];

          values.forEach(item => {
            if (item !== undefined && item !== null) {
              url.searchParams.append(key, String(item));
            }
          });
        }
      }

      return url;
    },

    getCookie(name) {
      if (!document || !document.cookie) {
        return null;
      }

      const prefix = `${encodeURIComponent(name)}=`;

      const entry = document.cookie
        .split(";")
        .map(item => item.trim())
        .find(item => item.startsWith(prefix));

      if (!entry) {
        return null;
      }

      try {
        return decodeURIComponent(entry.slice(prefix.length));
      } catch {
        return entry.slice(prefix.length);
      }
    },

    getMetaContent(name) {
      if (!name || !document) {
        return null;
      }

      const meta = Array.from(
        document.querySelectorAll("meta[name]")
      ).find(item => item.getAttribute("name") === name);

      return meta?.getAttribute("content") || null;
    },

    parseRetryAfter(value) {
      if (!value) {
        return null;
      }

      const seconds = Number(value);

      if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds;
      }

      const date = Date.parse(value);

      return Number.isNaN(date)
        ? null
        : Math.max(0, (date - Date.now()) / 1000);
    },

    assertInterceptor(value, name) {
      if (value !== null && typeof value !== "function") {
        throw new TypeError(`${name} must be a function or null.`);
      }
    }
  };

  // --------------------------------------------------
  // Authentication and CSRF
  // --------------------------------------------------

  const security = {
    async getAuthToken() {
      if (!authTokenProvider) {
        return null;
      }

      const token = await authTokenProvider();

      return typeof token === "string" && token.trim()
        ? token.trim()
        : null;
    },

    async getCSRFToken() {
      if (csrfTokenProvider) {
        const token = await csrfTokenProvider();

        if (typeof token === "string" && token.trim()) {
          return token.trim();
        }
      }

      const metaToken = utils.getMetaContent(config.csrf.metaName);

      if (metaToken) {
        return metaToken;
      }

      // JavaScript-readable CSRF cookies are supported only when
      // the backend explicitly implements this token strategy.
      // HttpOnly session cookies are intentionally inaccessible.
      return utils.getCookie(config.csrf.cookieName);
    },

    async apply(headers, method, options = {}) {
      if (options.auth !== false) {
        const token = await this.getAuthToken();

        if (token && !headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      }

      const csrfEnabled =
        options.csrf !== false &&
        config.csrf.enabled &&
        !SAFE_METHODS.has(method);

      if (csrfEnabled && !headers.has(config.csrf.headerName)) {
        const csrfToken = await this.getCSRFToken();

        if (csrfToken) {
          headers.set(config.csrf.headerName, csrfToken);
        }
      }
    }
  };

  // --------------------------------------------------
  // Response parsing
  // --------------------------------------------------

  async function parseResponse(response, responseType = "auto") {
    if (BODYLESS_STATUSES.has(response.status)) {
      return null;
    }

    if (responseType === "response") {
      return response;
    }

    if (responseType === "blob") {
      return response.blob();
    }

    if (responseType === "arrayBuffer") {
      return response.arrayBuffer();
    }

    if (responseType === "text") {
      return response.text();
    }

    const contentType = (
      response.headers.get("content-type") || ""
    ).toLowerCase();

    if (
      responseType === "json" ||
      contentType.includes("application/json") ||
      contentType.includes("+json")
    ) {
      const text = await response.text();

      if (!text.trim()) {
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        throw new APIError("The server returned invalid JSON.", {
          status: response.status,
          code: "INVALID_JSON",
          details: error.message
        });
      }
    }

    if (
      contentType.startsWith("text/") ||
      contentType.includes("application/xml")
    ) {
      return response.text();
    }

    return response.blob();
  }

  function createHTTPError(response, data, url, method) {
    const payload = utils.isPlainObject(data) ? data : {};
    const nestedError = utils.isPlainObject(payload.error)
      ? payload.error
      : {};

    const rawMessage =
      payload.message ||
      nestedError.message ||
      (
        typeof payload.error === "string"
          ? payload.error
          : null
      ) ||
      `Request failed with HTTP ${response.status}.`;

    const message = String(rawMessage).slice(
      0,
      MAX_ERROR_MESSAGE_LENGTH
    );

    return new APIError(message, {
      status: response.status,
      code:
        payload.code ||
        nestedError.code ||
        `HTTP_${response.status}`,
      details: payload.details ?? null,
      data,
      url: url.toString(),
      method,
      retryAfter: utils.parseRetryAfter(
        response.headers.get("Retry-After")
      )
    });
  }

  function normalizeError(error, context) {
    if (error instanceof APIError) {
      if (!error.url) error.url = context.url;
      if (!error.method) error.method = context.method;
      return error;
    }

    if (context.timedOut) {
      return new APIError("The request timed out. Please try again.", {
        code: "REQUEST_TIMEOUT",
        url: context.url,
        method: context.method,
        isTimeout: true
      });
    }

    if (context.signal?.aborted) {
      return new APIError("The request was cancelled.", {
        code: "REQUEST_ABORTED",
        url: context.url,
        method: context.method,
        isAborted: true
      });
    }

    if (error instanceof TypeError) {
      return new APIError(
        "Unable to complete the request. Check the connection and API configuration.",
        {
          code: "NETWORK_ERROR",
          url: context.url,
          method: context.method,
          isNetworkError: true,
          details: error.message
        }
      );
    }

    return new APIError(
      error?.message || "An unexpected API error occurred.",
      {
        code: "API_ERROR",
        url: context.url,
        method: context.method,
        details: error?.message || null
      }
    );
  }

  // --------------------------------------------------
  // Core request method
  // --------------------------------------------------

  async function request(path, options = {}) {
    const {
      method = "GET",
      params,
      data,
      body,
      headers: customHeaders = {},
      timeout = config.timeout,
      signal: externalSignal,
      credentials = config.credentials,
      responseType = "auto",
      auth = true,
      csrf = true,
      ...fetchOptions
    } = options;

    const normalizedMethod = String(method).toUpperCase();

    if (!/^[A-Z]+$/.test(normalizedMethod)) {
      throw new TypeError("Invalid HTTP method.");
    }

    if (!VALID_CREDENTIALS.has(credentials)) {
      throw new TypeError("Invalid credentials setting.");
    }

    if (!Number.isFinite(timeout) || timeout < 0) {
      throw new TypeError("Timeout must be a non-negative number.");
    }

    if (
      !["auto", "json", "text", "blob", "arrayBuffer", "response"].includes(
        responseType
      )
    ) {
      throw new TypeError("Unsupported responseType.");
    }

    if (
      externalSignal != null &&
      typeof externalSignal.addEventListener !== "function"
    ) {
      throw new TypeError("signal must be an AbortSignal.");
    }

    const url = utils.buildURL(path, params);
    const originalURL = url.href;
    const headers = new Headers(config.headers);

    new Headers(customHeaders).forEach((value, key) => {
      headers.set(key, value);
    });

    await security.apply(headers, normalizedMethod, {
      auth,
      csrf
    });

    if (data !== undefined && body !== undefined) {
      throw new TypeError("Specify either data or body, not both.");
    }

    const payload = body !== undefined ? body : data;
    let requestBody;

    if (payload !== undefined) {
      if (SAFE_METHODS.has(normalizedMethod)) {
        throw new TypeError(
          `${normalizedMethod} requests cannot contain a body. Use params instead.`
        );
      }

      if (utils.isFormData(payload)) {
        requestBody = payload;
        headers.delete("Content-Type");
      } else if (
        utils.isBodyInit(payload) ||
        payload === null
      ) {
        requestBody = payload;
      } else {
        requestBody = JSON.stringify(payload);

        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }
    }

    const controller = new AbortController();
    let timedOut = false;
    let timeoutId = null;
    let removeAbortListener = () => {};

    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        const forwardAbort = () => {
          controller.abort(externalSignal.reason);
        };

        externalSignal.addEventListener("abort", forwardAbort, {
          once: true
        });

        removeAbortListener = () => {
          externalSignal.removeEventListener("abort", forwardAbort);
        };
      }
    }

    if (timeout > 0) {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }

    const context = {
      url: originalURL,
      method: normalizedMethod,
      signal: controller.signal,
      get timedOut() {
        return timedOut;
      }
    };

    let fetchConfig = {
      ...fetchOptions,
      method: normalizedMethod,
      headers,
      credentials,
      signal: controller.signal
    };

    if (requestBody !== undefined) {
      fetchConfig.body = requestBody;
    }

    try {
      if (typeof requestInterceptor === "function") {
        const modified = await requestInterceptor({
          url: new URL(url.href),
          options: { ...fetchConfig }
        });

        if (modified != null) {
          if (typeof modified !== "object") {
            throw new TypeError(
              "Request interceptor must return an object or undefined."
            );
          }

          if (modified.url !== undefined) {
            const candidate = new URL(
              String(modified.url),
              window.location.origin
            );

            const configuredOrigin = new URL(
              config.baseURL,
              window.location.origin
            ).origin;

            if (
              candidate.origin !== configuredOrigin &&
              candidate.origin !== window.location.origin
            ) {
              throw new APIError(
                "Request interceptor attempted to change the API origin.",
                { code: "INVALID_REQUEST_URL" }
              );
            }

            // Do not permit changing an API request to a URL containing
            // credentials, or to a different API path.
            if (candidate.username || candidate.password) {
              throw new APIError(
                "API URLs must not contain embedded credentials.",
                { code: "INVALID_REQUEST_URL" }
              );
            }

            url.href = candidate.href;
          }

          if (modified.options !== undefined) {
            if (
              !modified.options ||
              typeof modified.options !== "object"
            ) {
              throw new TypeError(
                "Request interceptor options must be an object."
              );
            }

            fetchConfig = {
              ...fetchConfig,
              ...modified.options,
              method: normalizedMethod,
              signal: controller.signal
            };

            fetchConfig.headers = new Headers(
              modified.options.headers || headers
            );

            // Do not permit the interceptor to accidentally remove the
            // request body or override the enforced HTTP method.
            if (requestBody !== undefined) {
              fetchConfig.body = requestBody;
            }
          }
        }
      }

      const response = await window.fetch(url.href, fetchConfig);

      let result = await parseResponse(response, responseType);

      if (typeof responseInterceptor === "function") {
        result = await responseInterceptor(result, response);
      }

      if (!response.ok) {
        throw createHTTPError(
          response,
          result,
          url,
          normalizedMethod
        );
      }

      return result;
    } catch (error) {
      let normalizedError = normalizeError(error, context);

      if (typeof errorInterceptor === "function") {
        try {
          const intercepted = await errorInterceptor(normalizedError);

          if (intercepted instanceof Error) {
            normalizedError = intercepted;
          }
        } catch (interceptorError) {
          // Interceptor failure must not hide the original API error.
          console.error(
            "[MedOrbits API] Error interceptor failed.",
            interceptorError
          );
        }
      }

      throw normalizedError;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      removeAbortListener();
    }
  }

  // --------------------------------------------------
  // HTTP shortcuts
  // --------------------------------------------------

  const http = {
    request,

    get(path, options = {}) {
      return request(path, { ...options, method: "GET" });
    },

    post(path, data, options = {}) {
      return request(path, { ...options, method: "POST", data });
    },

    put(path, data, options = {}) {
      return request(path, { ...options, method: "PUT", data });
    },

    patch(path, data, options = {}) {
      return request(path, { ...options, method: "PATCH", data });
    },

    delete(path, options = {}) {
      return request(path, { ...options, method: "DELETE" });
    },

    head(path, options = {}) {
      return request(path, { ...options, method: "HEAD" });
    },

    options(path, options = {}) {
      return request(path, { ...options, method: "OPTIONS" });
    }
  };

  // --------------------------------------------------
  // Uploads and downloads
  // --------------------------------------------------

  const files = {
    upload(path, input, options = {}) {
      let formData;

      if (utils.isFormData(input)) {
        formData = input;
      } else {
        formData = new FormData();

        if (
          typeof File !== "undefined" &&
          input instanceof File
        ) {
          formData.append("file", input, input.name);
        } else if (Array.isArray(input)) {
          input.forEach(item => {
            if (
              !item ||
              !item.file ||
              typeof item.field === "string" &&
              !item.field.trim()
            ) {
              throw new TypeError("Invalid file descriptor.");
            }

            const field = item.field || "files";
            const file = item.file;

            formData.append(
              field,
              file,
              item.filename || file.name
            );
          });
        } else {
          throw new TypeError(
            "Provide a File, an array of file descriptors, or FormData."
          );
        }
      }

      return request(path, {
        ...options,
        method: options.method || "POST",
        data: formData
      });
    },

    download(path, options = {}) {
      return request(path, {
        ...options,
        responseType: "blob"
      });
    }
  };

  // --------------------------------------------------
  // Configuration and interceptors
  // --------------------------------------------------

  const settings = {
    configure(options = {}) {
      if (options.baseURL !== undefined) {
        config.baseURL = utils.normalizeBaseURL(options.baseURL);
      }

      if (options.timeout !== undefined) {
        if (
          !Number.isFinite(options.timeout) ||
          options.timeout < 0
        ) {
          throw new TypeError(
            "Timeout must be a non-negative number."
          );
        }

        config.timeout = options.timeout;
      }

      if (options.credentials !== undefined) {
        if (!VALID_CREDENTIALS.has(options.credentials)) {
          throw new TypeError("Invalid credentials setting.");
        }

        config.credentials = options.credentials;
      }

      if (options.headers !== undefined) {
        const nextHeaders = new Headers(config.headers);

        new Headers(options.headers).forEach((value, key) => {
          nextHeaders.set(key, value);
        });

        config.headers = nextHeaders;
      }

      if (options.csrf !== undefined) {
        if (!utils.isPlainObject(options.csrf)) {
          throw new TypeError("CSRF configuration must be an object.");
        }

        const nextCSRF = {
          ...config.csrf,
          ...options.csrf
        };

        if (typeof nextCSRF.enabled !== "boolean") {
          throw new TypeError("CSRF enabled must be a boolean.");
        }

        ["headerName", "metaName", "cookieName"].forEach(key => {
          if (
            typeof nextCSRF[key] !== "string" ||
            !nextCSRF[key].trim()
          ) {
            throw new TypeError(`Invalid CSRF ${key}.`);
          }
        });

        config.csrf = nextCSRF;
      }

      return this.getConfig();
    },

    getConfig() {
      return Object.freeze({
        baseURL: config.baseURL,
        timeout: config.timeout,
        credentials: config.credentials,
        headers: Object.freeze(
          Object.fromEntries(config.headers.entries())
        ),
        csrf: Object.freeze({ ...config.csrf })
      });
    },

    setAuthTokenProvider(provider) {
      utils.assertInterceptor(provider, "Auth token provider");
      authTokenProvider = provider;
    },

    setCSRFTokenProvider(provider) {
      utils.assertInterceptor(provider, "CSRF token provider");
      csrfTokenProvider = provider;
    },

    setRequestInterceptor(interceptor) {
      utils.assertInterceptor(interceptor, "Request interceptor");
      requestInterceptor = interceptor;
    },

    setResponseInterceptor(interceptor) {
      utils.assertInterceptor(interceptor, "Response interceptor");
      responseInterceptor = interceptor;
    },

    setErrorInterceptor(interceptor) {
      utils.assertInterceptor(interceptor, "Error interceptor");
      errorInterceptor = interceptor;
    }
  };

  // --------------------------------------------------
  // Endpoint constants
  // These paths must match the deployed backend.
  // --------------------------------------------------

  const endpoints = Object.freeze({
    health: "/health",
    auth: "/auth",
    sessions: "/sessions",
    verification: "/verification",
    password: "/password",
    users: "/users",
    courses: "/courses",
    colleges: "/colleges",
    universities: "/universities",
    admissions: "/admissions",
    applications: "/applications",
    counselling: "/counselling",
    documents: "/documents",
    jobs: "/jobs",
    internships: "/internships",
    candidates: "/candidates",
    employers: "/employers",
    recruitment: "/recruitment",
    services: "/services",
    search: "/search",
    notifications: "/notifications",
    payments: "/payments",
    uploads: "/uploads",
    contact: "/contact",
    faqs: "/faqs",
    faqAnswer: "/faqs/answer",
    subscriptions: "/subscriptions",
    admin: "/admin"
  });

  // --------------------------------------------------
  // Public interface
  // --------------------------------------------------

  const api = {
    version: "1.1.0",
    APIError,
    request: http.request,
    get: http.get,
    post: http.post,
    put: http.put,
    patch: http.patch,
    delete: http.delete,
    head: http.head,
    options: http.options,
    http,
    files,
    settings,
    endpoints,

    health: Object.freeze({
      check(options = {}) {
        return http.get(endpoints.health, options);
      }
    })
  };

  const publicAPI = Object.freeze(api);

  window.MedOrbitsAPI = publicAPI;
  window.MedOrbitsApi = publicAPI;
})();
