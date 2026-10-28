
/*!
 * MedOrbits Compatible Share & API Bridge
 * File: /tools/comatible-share.js
 * Version: 2.0.0
 *
 * Purpose:
 *   Provide a safe browser-side bridge to configured MedOrbits API endpoints,
 *   plus clipboard and native-share fallbacks.
 *
 * Security:
 *   - No eval() or dynamic code execution.
 *   - Same-origin requests by default.
 *   - Cross-origin requests require HTTPS and omit credentials.
 *   - Endpoint allowlist; callers cannot provide arbitrary endpoint URLs.
 *   - Request and response size limits.
 *   - AbortController timeout.
 *   - JSON-only API responses.
 *   - Optional CSRF token from a meta tag or explicit configuration.
 *   - UI helpers use textContent instead of HTML injection.
 *
 * Important:
 *   This file does not execute Python in the browser. A server-side API must
 *   expose the configured endpoints and independently enforce authentication,
 *   authorization, validation, CSRF protection, rate limits and path safety.
 */
(function (global) {
  "use strict";

  const VERSION = "2.0.0";
  const DEFAULT_TIMEOUT_MS = 20000;
  const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;
  const DEFAULT_MAX_RESPONSE_CHARS = 2 * 1024 * 1024;

  const DEFAULT_ENDPOINTS = Object.freeze({
    status: "/status",
    inspect: "/inspect",
    validate: "/validate",
    organizePreview: "/organize/preview"
  });

  const SAFE_ENDPOINT_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
  const SAFE_HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

  class MedOrbitsToolsError extends Error {
    constructor(message, code, details) {
      super(message);
      this.name = "MedOrbitsToolsError";
      this.code = code || "TOOLS_ERROR";
      if (details !== undefined) {
        this.details = details;
      }
    }
  }

  let configuration = {
    baseUrl: "/api/tools",
    endpoints: Object.assign({}, DEFAULT_ENDPOINTS),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRequestBytes: DEFAULT_MAX_REQUEST_BYTES,
    maxResponseChars: DEFAULT_MAX_RESPONSE_CHARS,
    credentials: "same-origin",
    csrfMetaName: "csrf-token",
    csrfHeaderName: "X-CSRF-Token",
    headers: {},
    fetchImpl: null,
    onError: null
  };

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assert(condition, message, code) {
    if (!condition) {
      throw new MedOrbitsToolsError(message, code);
    }
  }

  function normalizeBaseUrl(value) {
    assert(
      typeof value === "string" && value.trim().length > 0,
      "baseUrl must be a non-empty string.",
      "INVALID_BASE_URL"
    );

    const raw = value.trim();

    if (raw.startsWith("//")) {
      throw new MedOrbitsToolsError(
        "Protocol-relative base URLs are not allowed.",
        "INVALID_BASE_URL"
      );
    }

    let parsed;

    try {
      parsed = new URL(raw, global.location.href);
    } catch {
      throw new MedOrbitsToolsError(
        "baseUrl is not a valid URL.",
        "INVALID_BASE_URL"
      );
    }

    const sameOrigin = parsed.origin === global.location.origin;

    assert(
      sameOrigin || parsed.protocol === "https:",
      "Cross-origin API URLs must use HTTPS.",
      "INSECURE_CROSS_ORIGIN"
    );

    assert(
      parsed.protocol === "https:" || parsed.origin === global.location.origin,
      "Only HTTPS or same-origin API URLs are allowed.",
      "INVALID_PROTOCOL"
    );

    assert(
      !parsed.username && !parsed.password,
      "Credentials embedded in URLs are not allowed.",
      "URL_CREDENTIALS_FORBIDDEN"
    );

    assert(
      !parsed.hash,
      "URL fragments are not allowed in API base URLs.",
      "URL_FRAGMENT_FORBIDDEN"
    );

    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

    return {
      url: parsed,
      sameOrigin: sameOrigin
    };
  }

  function normalizeEndpointPath(value) {
    assert(
      typeof value === "string" && value.trim().length > 0,
      "Endpoint paths must be non-empty strings.",
      "INVALID_ENDPOINT"
    );

    const path = value.trim();

    assert(
      !path.startsWith("//") &&
        !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path),
      "Endpoint entries must be relative paths, not absolute URLs.",
      "INVALID_ENDPOINT"
    );

    assert(
      !path.includes("\\") &&
        !path.includes("?") &&
        !path.includes("#"),
      "Endpoint paths cannot contain backslashes, query strings or fragments.",
      "INVALID_ENDPOINT"
    );

    const segments = path.split("/").filter(Boolean);

    assert(
      segments.length > 0 &&
        segments.every(function (segment) {
          return segment !== "." &&
            segment !== ".." &&
            /^[A-Za-z0-9._~-]+$/.test(segment);
        }),
      "Endpoint path contains an invalid segment.",
      "INVALID_ENDPOINT"
    );

    return "/" + segments.join("/");
  }

  function mergeHeaders(baseHeaders, extraHeaders) {
    const output = Object.create(null);

    function add(source) {
      if (!source) {
        return;
      }

      assert(
        isPlainObject(source),
        "Headers must be provided as a plain object.",
        "INVALID_HEADERS"
      );

      Object.keys(source).forEach(function (key) {
        assert(
          SAFE_HEADER_NAME.test(key),
          "Invalid HTTP header name.",
          "INVALID_HEADERS"
        );

        const value = source[key];

        assert(
          typeof value === "string" &&
            !/[\r\n]/.test(value),
          "Header values must be strings without line breaks.",
          "INVALID_HEADERS"
        );

        output[key.toLowerCase()] = {
          name: key,
          value: value
        };
      });
    }

    add(baseHeaders);
    add(extraHeaders);

    return output;
  }

  function getCsrfToken() {
    if (typeof document === "undefined") {
      return "";
    }

    const meta = document.querySelector(
      'meta[name="' + configuration.csrfMetaName + '"]'
    );

    return meta ? (meta.getAttribute("content") || "").trim() : "";
  }

  function safeJsonStringify(value) {
    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch (error) {
      throw new MedOrbitsToolsError(
        "Request data could not be serialized as JSON.",
        "SERIALIZATION_FAILED",
        { message: error.message }
      );
    }

    assert(
      typeof serialized === "string",
      "Request data must be JSON-serializable.",
      "SERIALIZATION_FAILED"
    );

    return serialized;
  }

  function byteLength(value) {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(value).length;
    }

    return unescape(encodeURIComponent(value)).length;
  }

  function getFetch() {
    const fetchFunction = configuration.fetchImpl || global.fetch;

    assert(
      typeof fetchFunction === "function",
      "Fetch is unavailable in this environment.",
      "FETCH_UNAVAILABLE"
    );

    return fetchFunction;
  }

  function buildEndpointUrl(endpointName) {
    assert(
      typeof endpointName === "string" &&
        SAFE_ENDPOINT_NAME.test(endpointName),
      "Invalid endpoint name.",
      "INVALID_ENDPOINT_NAME"
    );

    const endpointPath = configuration.endpoints[endpointName];

    assert(
      typeof endpointPath === "string",
      "Endpoint is not configured: " + endpointName,
      "ENDPOINT_NOT_CONFIGURED"
    );

    const base = normalizeBaseUrl(configuration.baseUrl);
    const path = normalizeEndpointPath(endpointPath);

    const prefix = base.url.pathname.replace(/\/+$/, "");
    const fullPath = (prefix || "") + path;

    const result = new URL(base.url.origin);
    result.pathname = fullPath.startsWith("/")
      ? fullPath
      : "/" + fullPath;

    assert(
      result.origin === global.location.origin ||
        result.protocol === "https:",
      "Insecure API destination rejected.",
      "INSECURE_DESTINATION"
    );

    return {
      url: result,
      sameOrigin: result.origin === global.location.origin
    };
  }

  function reportError(error, endpointName) {
    if (typeof configuration.onError === "function") {
      try {
        configuration.onError(error, {
          endpoint: endpointName,
          version: VERSION
        });
      } catch {
        // Error callbacks must not replace the original API error.
      }
    }
  }

  async function request(endpointName, payload, options) {
    const opts = options || {};

    assert(
      payload === undefined || isPlainObject(payload) || Array.isArray(payload),
      "Payload must be a plain object, array or undefined.",
      "INVALID_PAYLOAD"
    );

    const destination = buildEndpointUrl(endpointName);
    const fetchFunction = getFetch();
    const controller = typeof AbortController !== "undefined"
      ? new AbortController()
      : null;

    const timeoutMs = Number.isFinite(opts.timeoutMs)
      ? Math.min(Math.max(opts.timeoutMs, 1000), 120000)
      : configuration.timeoutMs;

    const headersMap = mergeHeaders(
      configuration.headers,
      opts.headers
    );

    if (!headersMap.accept) {
      headersMap.accept = {
        name: "Accept",
        value: "application/json"
      };
    }

    let body;

    if (payload !== undefined) {
      body = safeJsonStringify(payload);

      assert(
        byteLength(body) <= configuration.maxRequestBytes,
        "Request payload exceeds the configured size limit.",
        "REQUEST_TOO_LARGE"
      );

      if (!headersMap["content-type"]) {
        headersMap["content-type"] = {
          name: "Content-Type",
          value: "application/json"
        };
      }
    }

    const csrfToken = getCsrfToken();

    if (csrfToken && !headersMap[configuration.csrfHeaderName.toLowerCase()]) {
      headersMap[configuration.csrfHeaderName.toLowerCase()] = {
        name: configuration.csrfHeaderName,
        value: csrfToken
      };
    }

    const headers = {};

    Object.keys(headersMap).forEach(function (key) {
      headers[headersMap[key].name] = headersMap[key].value;
    });

    const credentials = destination.sameOrigin
      ? configuration.credentials
      : "omit";

    const fetchOptions = {
      method: "POST",
      headers: headers,
      credentials: credentials,
      redirect: "error",
      cache: "no-store"
    };

    if (body !== undefined) {
      fetchOptions.body = body;
    }

    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    let timeoutId;

    try {
      const timeoutPromise = new Promise(function (_, reject) {
        timeoutId = setTimeout(function () {
          if (controller) {
            controller.abort();
          }

          reject(
            new MedOrbitsToolsError(
              "API request timed out.",
              "REQUEST_TIMEOUT"
            )
          );
        }, timeoutMs);
      });

      const response = await Promise.race([
        fetchFunction(destination.url.href, fetchOptions),
        timeoutPromise
      ]);

      clearTimeout(timeoutId);

      assert(
        response && typeof response.status === "number",
        "Invalid response returned by the fetch implementation.",
        "INVALID_RESPONSE"
      );

      const contentType = (
        response.headers &&
        response.headers.get("content-type")
      ) || "";

      const responseText = await response.text();

      assert(
        responseText.length <= configuration.maxResponseChars,
        "API response exceeds the configured size limit.",
        "RESPONSE_TOO_LARGE"
      );

      let responseData = null;

      if (responseText.length > 0) {
        assert(
          /application\/(?:[\w.+-]*\+)?json\b/i.test(contentType),
          "API returned a non-JSON response.",
          "UNEXPECTED_CONTENT_TYPE"
        );

        try {
          responseData = JSON.parse(responseText);
        } catch {
          throw new MedOrbitsToolsError(
            "API returned malformed JSON.",
            "INVALID_JSON_RESPONSE"
          );
        }
      }

      if (!response.ok) {
        const message =
          responseData &&
          typeof responseData.message === "string"
            ? responseData.message
            : "API request failed with HTTP " + response.status + ".";

        throw new MedOrbitsToolsError(
          message,
          "HTTP_ERROR",
          {
            status: response.status,
            response: responseData
          }
        );
      }

      return responseData;
    } catch (error) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      let normalizedError = error;

      if (
        error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        normalizedError = new MedOrbitsToolsError(
          "API request was cancelled or timed out.",
          "REQUEST_ABORTED"
        );
      } else if (!(error instanceof MedOrbitsToolsError)) {
        normalizedError = new MedOrbitsToolsError(
          error && error.message
            ? error.message
            : "Network request failed.",
          "NETWORK_ERROR"
        );
      }

      reportError(normalizedError, endpointName);
      throw normalizedError;
    }
  }

  function configure(options) {
    assert(
      isPlainObject(options),
      "Configuration must be a plain object.",
      "INVALID_CONFIGURATION"
    );

    const next = Object.assign({}, configuration);

    if (options.baseUrl !== undefined) {
      next.baseUrl = options.baseUrl;
    }

    if (options.endpoints !== undefined) {
      assert(
        isPlainObject(options.endpoints),
        "endpoints must be a plain object.",
        "INVALID_CONFIGURATION"
      );

      const endpoints = Object.assign({}, next.endpoints);

      Object.keys(options.endpoints).forEach(function (name) {
        assert(
          SAFE_ENDPOINT_NAME.test(name),
          "Invalid endpoint name: " + name,
          "INVALID_ENDPOINT_NAME"
        );

        endpoints[name] = normalizeEndpointPath(options.endpoints[name]);
      });

      next.endpoints = endpoints;
    }

    if (options.timeoutMs !== undefined) {
      assert(
        Number.isFinite(options.timeoutMs) &&
          options.timeoutMs >= 1000 &&
          options.timeoutMs <= 120000,
        "timeoutMs must be between 1000 and 120000.",
        "INVALID_CONFIGURATION"
      );

      next.timeoutMs = options.timeoutMs;
    }

    if (options.maxRequestBytes !== undefined) {
      assert(
        Number.isInteger(options.maxRequestBytes) &&
          options.maxRequestBytes > 0 &&
          options.maxRequestBytes <= 10 * 1024 * 1024,
        "maxRequestBytes must be between 1 byte and 10 MB.",
        "INVALID_CONFIGURATION"
      );

      next.maxRequestBytes = options.maxRequestBytes;
    }

    if (options.maxResponseChars !== undefined) {
      assert(
        Number.isInteger(options.maxResponseChars) &&
          options.maxResponseChars > 0 &&
          options.maxResponseChars <= 10 * 1024 * 1024,
        "maxResponseChars must be between 1 character and 10 MB.",
        "INVALID_CONFIGURATION"
      );

      next.maxResponseChars = options.maxResponseChars;
    }

    if (options.credentials !== undefined) {
      assert(
        options.credentials === "same-origin" ||
          options.credentials === "include" ||
          options.credentials === "omit",
        "Unsupported credentials setting.",
        "INVALID_CONFIGURATION"
      );

      next.credentials = options.credentials;
    }

    if (options.csrfMetaName !== undefined) {
      assert(
        typeof options.csrfMetaName === "string" &&
          /^[A-Za-z0-9_-]{1,80}$/.test(options.csrfMetaName),
        "Invalid CSRF meta tag name.",
        "INVALID_CONFIGURATION"
      );

      next.csrfMetaName = options.csrfMetaName;
    }

    if (options.csrfHeaderName !== undefined) {
      assert(
        typeof options.csrfHeaderName === "string" &&
          SAFE_HEADER_NAME.test(options.csrfHeaderName),
        "Invalid CSRF header name.",
        "INVALID_CONFIGURATION"
      );

      next.csrfHeaderName = options.csrfHeaderName;
    }

    if (options.headers !== undefined) {
      mergeHeaders(options.headers);
      next.headers = Object.assign({}, options.headers);
    }

    if (options.fetchImpl !== undefined) {
      assert(
        typeof options.fetchImpl === "function",
        "fetchImpl must be a function.",
        "INVALID_CONFIGURATION"
      );

      next.fetchImpl = options.fetchImpl;
    }

    if (options.onError !== undefined) {
      assert(
        options.onError === null ||
          typeof options.onError === "function",
        "onError must be a function or null.",
        "INVALID_CONFIGURATION"
      );

      next.onError = options.onError;
    }

    normalizeBaseUrl(next.baseUrl);
    configuration = next;

    return getConfig();
  }

  function getConfig() {
    return Object.freeze({
      version: VERSION,
      baseUrl: configuration.baseUrl,
      endpoints: Object.assign({}, configuration.endpoints),
      timeoutMs: configuration.timeoutMs,
      maxRequestBytes: configuration.maxRequestBytes,
      maxResponseChars: configuration.maxResponseChars,
      credentials: configuration.credentials
    });
  }

  function call(endpointName, payload, options) {
    return request(endpointName, payload, options);
  }

  function status(payload, options) {
    return request("status", payload || {}, options);
  }

  function inspect(payload, options) {
    return request("inspect", payload || {}, options);
  }

  function validate(payload, options) {
    return request("validate", payload || {}, options);
  }

  function organizePreview(payload, options) {
    return request("organizePreview", payload || {}, options);
  }

  async function copyText(value) {
    assert(
      typeof value === "string",
      "copyText requires a string.",
      "INVALID_COPY_VALUE"
    );

    if (
      global.navigator &&
      global.navigator.clipboard &&
      typeof global.navigator.clipboard.writeText === "function" &&
      global.isSecureContext
    ) {
      try {
        await global.navigator.clipboard.writeText(value);
        return { copied: true, method: "clipboard" };
      } catch {
        // Continue to the compatibility fallback.
      }
    }

    if (typeof document === "undefined") {
      throw new MedOrbitsToolsError(
        "Clipboard is unavailable in this environment.",
        "CLIPBOARD_UNAVAILABLE"
      );
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.left = "-9999px";

    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }

    if (!copied) {
      throw new MedOrbitsToolsError(
        "Unable to copy text. Please copy it manually.",
        "COPY_FAILED"
      );
    }

    return { copied: true, method: "execCommand" };
  }

  async function share(data) {
    assert(
      isPlainObject(data),
      "share requires an object.",
      "INVALID_SHARE_DATA"
    );

    const shareData = {};

    ["title", "text", "url"].forEach(function (key) {
      if (data[key] !== undefined) {
        assert(
          typeof data[key] === "string",
          key + " must be a string.",
          "INVALID_SHARE_DATA"
        );

        shareData[key] = data[key];
      }
    });

    if (shareData.url) {
      let parsed;

      try {
        parsed = new URL(shareData.url, global.location.href);
      } catch {
        throw new MedOrbitsToolsError(
          "Share URL is invalid.",
          "INVALID_SHARE_URL"
        );
      }

      assert(
        parsed.protocol === "https:" ||
          parsed.origin === global.location.origin,
        "Share URLs must use HTTPS or the current origin.",
        "INVALID_SHARE_URL"
      );

      shareData.url = parsed.href;
    }

    if (
      global.navigator &&
      typeof global.navigator.share === "function"
    ) {
      try {
        await global.navigator.share(shareData);
        return { shared: true, method: "native" };
      } catch (error) {
        if (error && error.name === "AbortError") {
          return { shared: false, cancelled: true, method: "native" };
        }
      }
    }

    const fallbackText = [
      shareData.title,
      shareData.text,
      shareData.url
    ].filter(Boolean).join("\n");

    await copyText(fallbackText);

    return {
      shared: false,
      copied: true,
      method: "clipboard-fallback"
    };
  }

  function bindText(selector, value) {
    assert(
      typeof selector === "string" && selector.length > 0,
      "A selector is required.",
      "INVALID_SELECTOR"
    );

    assert(
      typeof document !== "undefined",
      "DOM is unavailable.",
      "DOM_UNAVAILABLE"
    );

    const element = document.querySelector(selector);

    assert(
      element,
      "No element matches selector: " + selector,
      "ELEMENT_NOT_FOUND"
    );

    element.textContent = value == null ? "" : String(value);
    return element;
  }

  function bindJson(selector, value) {
    return bindText(selector, JSON.stringify(value, null, 2));
  }

  const api = {
    version: VERSION,
    configure: configure,
    getConfig: getConfig,
    call: call,
    status: status,
    inspect: inspect,
    validate: validate,
    organizePreview: organizePreview,
    copyText: copyText,
    share: share,
    bindText: bindText,
    bindJson: bindJson,
    MedOrbitsToolsError: MedOrbitsToolsError
  };

  Object.defineProperty(global, "MedOrbitsPythonTools", {
    value: Object.freeze(api),
    configurable: false,
    enumerable: false,
    writable: false
  });
})(typeof window !== "undefined" ? window : globalThis);
