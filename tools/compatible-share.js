
/*
 * MedOrbits Python Tool Compatibility Bridge
 * File: /tools/comatible-share.js
 * Version: 1.0.0
 *
 * Connects browser pages to approved MedOrbits Python-tool API endpoints.
 *
 * IMPORTANT:
 * Browsers cannot directly execute local .py files. A trusted backend must
 * expose the API routes configured below and enforce authentication,
 * authorization, CSRF protection, input validation, rate limits, and audit logs.
 *
 * This client deliberately does NOT provide arbitrary command execution,
 * arbitrary Python evaluation, or direct filesystem access.
 *
 * Example:
 *   <script src="/tools/comatible-share.js" defer></script>
 *
 * API:
 *   MedOrbitsPythonTools.status()
 *   MedOrbitsPythonTools.inspect(options)
 *   MedOrbitsPythonTools.validate(options)
 *   MedOrbitsPythonTools.organizePreview(options)
 *   MedOrbitsPythonTools.request(name, payload)
 *   MedOrbitsPythonTools.copyText(text)
 *   MedOrbitsPythonTools.sharePage()
 */
(function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULT_TIMEOUT_MS = 20000;
  const DEFAULT_MAX_RESPONSE_CHARS = 2000000;

  const DEFAULT_ENDPOINTS = Object.freeze({
    status: "/status",
    inspect: "/inspect",
    validate: "/validate",
    organizePreview: "/organize/preview"
  });

  let config = {
    baseUrl: "/api/tools",
    endpoints: Object.assign({}, DEFAULT_ENDPOINTS),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxResponseChars: DEFAULT_MAX_RESPONSE_CHARS,
    credentials: "same-origin",
    csrfToken: null,
    headers: {}
  };

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function normalizeBaseUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("baseUrl must be a non-empty string.");
    }

    const trimmed = value.trim();
    if (trimmed.startsWith("/")) return trimmed.replace(/\/+$/, "");

    let parsed;
    try {
      parsed = new URL(trimmed, global.location && global.location.href);
    } catch (_error) {
      throw new TypeError("baseUrl is not a valid URL.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new TypeError("Only HTTP and HTTPS API URLs are supported.");
    }

    if (
      global.location &&
      parsed.origin !== global.location.origin &&
      parsed.protocol !== "https:"
    ) {
      throw new TypeError("Cross-origin API connections must use HTTPS.");
    }

    return parsed.href.replace(/\/+$/, "");
  }

  function normalizeEndpoint(value) {
    if (typeof value !== "string" || !value.trim()) {
      throw new TypeError("Endpoint paths must be non-empty strings.");
    }

    const trimmed = value.trim();

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
      throw new TypeError(
        "Endpoint values must be relative API paths, not full URLs."
      );
    }

    if (trimmed.split("/").includes("..")) {
      throw new TypeError("Endpoint paths cannot contain traversal segments.");
    }

    return trimmed.startsWith("/") ? trimmed : "/" + trimmed;
  }

  function configure(options) {
    if (!isPlainObject(options)) {
      throw new TypeError("configure() expects an options object.");
    }

    const next = Object.assign({}, config);

    if (Object.prototype.hasOwnProperty.call(options, "baseUrl")) {
      next.baseUrl = normalizeBaseUrl(options.baseUrl);
    }

    if (Object.prototype.hasOwnProperty.call(options, "endpoints")) {
      if (!isPlainObject(options.endpoints)) {
        throw new TypeError("endpoints must be an object.");
      }

      next.endpoints = Object.assign({}, config.endpoints);

      Object.keys(options.endpoints).forEach((key) => {
        next.endpoints[key] = normalizeEndpoint(options.endpoints[key]);
      });
    }

    if (options.timeoutMs !== undefined) {
      const value = Number(options.timeoutMs);

      if (!Number.isFinite(value) || value < 1000 || value > 120000) {
        throw new RangeError("timeoutMs must be between 1000 and 120000.");
      }

      next.timeoutMs = value;
    }

    if (options.maxResponseChars !== undefined) {
      const value = Number(options.maxResponseChars);

      if (
        !Number.isInteger(value) ||
        value < 1024 ||
        value > 20000000
      ) {
        throw new RangeError(
          "maxResponseChars must be between 1024 and 20000000."
        );
      }

      next.maxResponseChars = value;
    }

    if (options.credentials !== undefined) {
      if (!["omit", "same-origin", "include"].includes(options.credentials)) {
        throw new TypeError("Invalid credentials mode.");
      }

      next.credentials = options.credentials;
    }

    if (options.csrfToken !== undefined) {
      if (
        options.csrfToken !== null &&
        typeof options.csrfToken !== "string"
      ) {
        throw new TypeError("csrfToken must be a string or null.");
      }

      next.csrfToken = options.csrfToken;
    }

    if (options.headers !== undefined) {
      if (!isPlainObject(options.headers)) {
        throw new TypeError("headers must be a plain object.");
      }

      const safeHeaders = {};

      Object.keys(options.headers).forEach((key) => {
        const value = String(options.headers[key]);

        if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
          throw new TypeError("Headers cannot contain line breaks.");
        }

        safeHeaders[key] = value;
      });

      next.headers = Object.assign({}, config.headers, safeHeaders);
    }

    config = next;
    return getConfig();
  }

  function getConfig() {
    return Object.freeze({
      version: VERSION,
      baseUrl: config.baseUrl,
      endpoints: Object.assign({}, config.endpoints),
      timeoutMs: config.timeoutMs,
      maxResponseChars: config.maxResponseChars,
      credentials: config.credentials
    });
  }

  function getCsrfTokenFromMeta() {
    if (!global.document) return null;

    const element = global.document.querySelector(
      'meta[name="csrf-token"]'
    );

    return element && element.content ? element.content : null;
  }

  function makeUrl(endpoint) {
    const safeEndpoint = normalizeEndpoint(endpoint);
    const base = config.baseUrl.replace(/\/+$/, "");
    return base + safeEndpoint;
  }

  async function request(endpointName, payload) {
    if (typeof endpointName !== "string" || !endpointName.trim()) {
      throw new TypeError("endpointName must be a string.");
    }

    const endpoint = config.endpoints[endpointName];

    if (!endpoint) {
      throw new Error(
        "Unknown or unconfigured Python-tool endpoint: " + endpointName
      );
    }

    if (payload !== undefined && !isPlainObject(payload)) {
      throw new TypeError("Request payload must be a plain object.");
    }

    if (
      typeof global.fetch !== "function" ||
      typeof global.AbortController !== "function"
    ) {
      throw new Error(
        "This browser does not support the required Fetch API."
      );
    }

    const controller = new global.AbortController();

    const timeoutId = global.setTimeout(
      () => controller.abort(),
      config.timeoutMs
    );

    const headers = Object.assign(
      { Accept: "application/json" },
      config.headers
    );

    const init = {
      method: payload === undefined ? "GET" : "POST",
      credentials: config.credentials,
      headers,
      signal: controller.signal,
      redirect: "error",
      cache: "no-store"
    };

    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(payload);

      const csrf = config.csrfToken || getCsrfTokenFromMeta();

      if (csrf) {
        headers["X-CSRF-Token"] = csrf;
      }
    }

    let response;

    try {
      response = await global.fetch(makeUrl(endpoint), init);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("Python-tool request timed out.");
      }

      throw new Error(
        "Could not connect to the Python-tool API. Check the backend and network."
      );
    } finally {
      global.clearTimeout(timeoutId);
    }

    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();

    if (rawText.length > config.maxResponseChars) {
      throw new Error(
        "The API response exceeded the configured size limit."
      );
    }

    let data = null;

    if (rawText) {
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error("The API returned a non-JSON response.");
      }

      try {
        data = JSON.parse(rawText);
      } catch (_error) {
        throw new Error("The API returned malformed JSON.");
      }
    }

    if (!response.ok) {
      const message =
        data && typeof data.message === "string"
          ? data.message
          : "Python-tool API request failed with HTTP " +
            response.status +
            ".";

      const error = new Error(message);
      error.status = response.status;
      error.code =
        data && typeof data.code === "string"
          ? data.code
          : "API_ERROR";

      throw error;
    }

    return data;
  }

  function validateOptions(options) {
    if (options === undefined) return {};

    if (!isPlainObject(options)) {
      throw new TypeError("Options must be a plain object.");
    }

    const result = {};

    if (options.path !== undefined) {
      if (typeof options.path !== "string" || !options.path.trim()) {
        throw new TypeError("path must be a non-empty relative path.");
      }

      if (
        options.path.startsWith("/") ||
        options.path.includes("\\") ||
        options.path
          .split("/")
          .some((part) => part === ".." || part === ".")
      ) {
        throw new TypeError(
          "path must be a safe repository-relative path."
        );
      }

      result.path = options.path;
    }

    if (options.includeHidden !== undefined) {
      result.includeHidden = Boolean(options.includeHidden);
    }

    return result;
  }

  function status() {
    return request("status");
  }

  function inspect(options) {
    return request("inspect", validateOptions(options));
  }

  function validate(options) {
    return request("validate", validateOptions(options));
  }

  function organizePreview(options) {
    return request("organizePreview", validateOptions(options));
  }

  async function copyText(text) {
    if (typeof text !== "string" || !text.trim()) {
      throw new TypeError("Text to copy must be a non-empty string.");
    }

    if (
      global.navigator &&
      global.navigator.clipboard &&
      typeof global.navigator.clipboard.writeText === "function"
    ) {
      await global.navigator.clipboard.writeText(text);

      return {
        ok: true,
        method: "clipboard-api"
      };
    }

    const doc = global.document;

    if (!doc || !doc.body) {
      throw new Error("Clipboard is unavailable.");
    }

    const textarea = doc.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";

    doc.body.appendChild(textarea);
    textarea.select();

    let ok = false;

    try {
      ok =
        typeof doc.execCommand === "function" &&
        doc.execCommand("copy");
    } finally {
      textarea.remove();
    }

    if (!ok) {
      throw new Error("Copy was blocked. Copy the text manually.");
    }

    return {
      ok: true,
      method: "execCommand-fallback"
    };
  }

  async function sharePage() {
    if (!global.location || !global.document) {
      throw new Error("Page information is unavailable.");
    }

    const description = global.document.querySelector(
      'meta[name="description"]'
    );

    const data = {
      title: global.document.title || "MedOrbits",
      text: description ? description.content : "",
      url: global.location.href
    };

    if (
      global.navigator &&
      typeof global.navigator.share === "function"
    ) {
      try {
        await global.navigator.share(data);

        return {
          ok: true,
          method: "web-share"
        };
      } catch (error) {
        if (error && error.name === "AbortError") {
          return {
            ok: false,
            cancelled: true,
            method: "web-share"
          };
        }
      }
    }

    const copied = await copyText(data.url);

    return {
      ok: true,
      method: "copy-fallback",
      message: "Native sharing is unavailable; the page link was copied.",
      fallback: copied.method
    };
  }

  function bindUi(root) {
    const scope = root || global.document;

    if (!scope || typeof scope.querySelectorAll !== "function") {
      return;
    }

    scope.querySelectorAll("[data-python-tool]").forEach((button) => {
      if (button.dataset.medOrbitsPythonBound === "true") return;

      button.dataset.medOrbitsPythonBound = "true";

      button.addEventListener("click", async () => {
        const operation = button.dataset.pythonTool;
        const originalText = button.textContent;

        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        try {
          let result;

          if (operation === "status") {
            result = await status();
          } else if (operation === "inspect") {
            result = await inspect({});
          } else if (operation === "validate") {
            result = await validate({});
          } else if (operation === "organize-preview") {
            result = await organizePreview({});
          } else {
            throw new Error("Unsupported UI operation.");
          }

          const outputSelector = button.dataset.output;
          const output = outputSelector
            ? scope.querySelector(outputSelector)
            : null;

          if (output) {
            // textContent prevents response content from being interpreted as HTML.
            output.textContent = JSON.stringify(result, null, 2);
          }

          button.dataset.result = "success";
        } catch (error) {
          const outputSelector = button.dataset.output;
          const output = outputSelector
            ? scope.querySelector(outputSelector)
            : null;

          if (output) {
            output.textContent = error.message || "Request failed.";
          }

          button.dataset.result = "error";
        } finally {
          button.disabled = false;
          button.removeAttribute("aria-busy");

          if (button.dataset.restoreLabel === "true") {
            button.textContent = originalText;
          }
        }
      });
    });

    scope.querySelectorAll("[data-share-page]").forEach((button) => {
      if (button.dataset.medOrbitsShareBound === "true") return;

      button.dataset.medOrbitsShareBound = "true";

      button.addEventListener("click", async () => {
        const originalText = button.textContent;

        try {
          const result = await sharePage();

          if (result.cancelled) return;

          button.textContent = result.message || "Shared";
        } catch (_error) {
          button.textContent = "Sharing unavailable";
        }

        global.setTimeout(() => {
          if (button.isConnected) {
            button.textContent = originalText;
          }
        }, 1800);
      });
    });
  }

  const api = Object.freeze({
    version: VERSION,
    configure,
    getConfig,
    request,
    status,
    inspect,
    validate,
    organizePreview,
    copyText,
    sharePage,
    bindUi
  });

  if (!global.MedOrbitsPythonTools) {
    Object.defineProperty(global, "MedOrbitsPythonTools", {
      value: api,
      configurable: false,
      enumerable: false,
      writable: false
    });
  }

  if (global.document) {
    if (global.document.readyState === "loading") {
      global.document.addEventListener(
        "DOMContentLoaded",
        () => bindUi(),
        { once: true }
      );
    } else {
      bindUi();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
