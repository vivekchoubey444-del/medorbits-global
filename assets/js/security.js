
/* =========================================================
   MedOrbits | Client-Side Security Utilities
   File: /assets/js/security.js
   Version: 1.0.0

   Purpose:
   - Render only explicitly approved data fields
   - Prevent HTML injection in displayed content
   - Restrict unsafe URLs
   - Redact sensitive fields from display and logs
   - Make same-origin API requests by default
   - Avoid exposing raw server errors
   - Provide reusable security helpers for all pages

   SECURITY LIMITATIONS:
   - This file cannot hide JavaScript source from visitors.
   - This file cannot enforce database permissions.
   - Authorization, private data filtering, rate limits,
     and database policies MUST be enforced server-side.
   - Never put secrets, passwords, or private API keys here.
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsSecurity) return;

  const VERSION = "1.0.0";

  const DEFAULTS = {
    apiBase: "/api",
    sameOriginOnly: true,
    credentials: "same-origin",
    requestTimeout: 15000,
    maxTextLength: 20000,
    maxResponseBytes: 2 * 1024 * 1024,
    debug: false
  };

  const state = {
    initialized: false,
    options: { ...DEFAULTS },
    activeRequests: new Set()
  };

  const SENSITIVE_KEY =
    /password|passwd|secret|token|authorization|cookie|session|api.?key|private.?key|access.?key|refresh.?token|otp|cvv|cvc|aadhaar|aadhar|passport.?number|pan.?number|bank.?account|credit.?card/i;

  const ALLOWED_TAGS = new Set([
    "A", "B", "STRONG", "EM", "I", "P", "BR",
    "UL", "OL", "LI", "H2", "H3", "H4",
    "BLOCKQUOTE", "CODE", "PRE", "SPAN",
    "SMALL", "HR"
  ]);

  const ALLOWED_ATTRIBUTES = {
    A: ["href", "title", "target", "rel"],
    SPAN: ["class"],
    CODE: ["class"],
    PRE: ["class"]
  };

  function securityError(message, code) {
    const error = new Error(message);
    error.code = code || "SECURITY_ERROR";
    return error;
  }

  function isPlainObject(value) {
    if (value === null || typeof value !== "object") return false;

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  function configure(options) {
    if (!isPlainObject(options)) return api;

    Object.keys(DEFAULTS).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        state.options[key] = options[key];
      }
    });

    state.options.requestTimeout = Math.max(
      1000,
      Number(state.options.requestTimeout) || DEFAULTS.requestTimeout
    );

    state.options.maxTextLength = Math.max(
      100,
      Number(state.options.maxTextLength) || DEFAULTS.maxTextLength
    );

    state.options.maxResponseBytes = Math.max(
      1024,
      Number(state.options.maxResponseBytes) || DEFAULTS.maxResponseBytes
    );

    return api;
  }

  /* -------------------------------------------------------
     1. Safe text handling
     ------------------------------------------------------- */

  function sanitizeText(value, maxLength) {
    if (value === null || value === undefined) return "";

    let text;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      text = String(value);
    } else {
      return "";
    }

    const limit = Math.max(
      0,
      Number(maxLength) || state.options.maxTextLength
    );

    return text.slice(0, limit);
  }

  function setText(element, value, maxLength) {
    if (!element || !("textContent" in element)) return false;

    element.textContent = sanitizeText(value, maxLength);
    return true;
  }

  /* -------------------------------------------------------
     2. URL validation
     ------------------------------------------------------- */

  function safeURL(value, options) {
    const opts = options || {};

    if (typeof value !== "string" || !value.trim()) return null;

    try {
      const url = new URL(value, window.location.origin);
      const sameOrigin = url.origin === window.location.origin;

      if (state.options.sameOriginOnly && !sameOrigin) {
        if (!opts.allowExternal) return null;
      }

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return null;
      }

      if (
        url.username ||
        url.password ||
        url.href.startsWith("javascript:")
      ) {
        return null;
      }

      if (opts.sameOrigin && !sameOrigin) return null;

      return url.href;
    } catch (_) {
      return null;
    }
  }

  function setSafeLink(anchor, url, options) {
    if (!anchor || anchor.tagName !== "A") return false;

    const safe = safeURL(url, options);

    if (!safe) {
      anchor.removeAttribute("href");
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      return false;
    }

    anchor.href = safe;

    const parsed = new URL(safe);

    if (parsed.origin !== window.location.origin) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    } else {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }

    return true;
  }

  /* -------------------------------------------------------
     3. Approved-field filtering
     ------------------------------------------------------- */

  function pickFields(data, allowedFields) {
    if (!isPlainObject(data) || !Array.isArray(allowedFields)) {
      return {};
    }

    const result = {};

    allowedFields.forEach(function (field) {
      if (typeof field !== "string" || SENSITIVE_KEY.test(field)) {
        return;
      }

      if (!Object.prototype.hasOwnProperty.call(data, field)) {
        return;
      }

      const value = data[field];

      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result[field] = value;
      }
    });

    return result;
  }

  function redact(data, options) {
    const opts = options || {};
    const replacement = opts.replacement || "[REDACTED]";
    const maxDepth = Number.isFinite(opts.maxDepth)
      ? Math.max(0, opts.maxDepth)
      : 8;

    function walk(value, depth) {
      if (depth > maxDepth) return "[MAX DEPTH]";

      if (Array.isArray(value)) {
        return value.map(function (item) {
          return walk(item, depth + 1);
        });
      }

      if (!isPlainObject(value)) {
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          return value;
        }

        return undefined;
      }

      const output = {};

      Object.keys(value).forEach(function (key) {
        if (SENSITIVE_KEY.test(key)) {
          output[key] = replacement;
          return;
        }

        const safeValue = walk(value[key], depth + 1);

        if (safeValue !== undefined) {
          output[key] = safeValue;
        }
      });

      return output;
    }

    return walk(data, 0);
  }

  /* -------------------------------------------------------
     4. Safe HTML rendering

     Only a small allowlist of formatting tags is retained.
     Event handlers, scripts, styles, forms, embeds, and
     unknown attributes are removed.
     ------------------------------------------------------- */

  function sanitizeHTML(input) {
    const source = sanitizeText(input);

    if (!window.DOMParser) {
      return document.createTextNode(source);
    }

    const parser = new DOMParser();
    const parsed = parser.parseFromString(source, "text/html");
    const output = document.createDocumentFragment();

    function copyNode(node, parent) {
      if (node.nodeType === Node.TEXT_NODE) {
        parent.appendChild(document.createTextNode(node.nodeValue || ""));
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;

      if (!ALLOWED_TAGS.has(tag)) {
        // Preserve harmless text content, but discard active elements.
        if (
          tag === "SCRIPT" ||
          tag === "STYLE" ||
          tag === "IFRAME" ||
          tag === "OBJECT" ||
          tag === "EMBED" ||
          tag === "SVG" ||
          tag === "MATH" ||
          tag === "TEMPLATE"
        ) {
          return;
        }

        Array.from(node.childNodes).forEach(function (child) {
          copyNode(child, parent);
        });

        return;
      }

      const clean = document.createElement(tag.toLowerCase());
      const allowed = ALLOWED_ATTRIBUTES[tag] || [];

      allowed.forEach(function (attribute) {
        if (!node.hasAttribute(attribute)) return;

        const value = node.getAttribute(attribute) || "";

        if (attribute === "href") {
          const safe = safeURL(value, { allowExternal: true });
          if (safe) clean.setAttribute("href", safe);
          return;
        }

        if (attribute === "target") {
          if (value === "_blank" || value === "_self") {
            clean.setAttribute("target", value);
          }
          return;
        }

        if (attribute === "rel") {
          // Rel is controlled below for external links.
          return;
        }

        if (attribute === "class") {
          const classes = value
            .split(/\s+/)
            .filter(function (name) {
              return /^[a-zA-Z0-9_-]{1,60}$/.test(name);
            });

          if (classes.length) {
            clean.setAttribute("class", classes.join(" "));
          }

          return;
        }

        clean.setAttribute(attribute, sanitizeText(value, 300));
      });

      if (tag === "A" && clean.hasAttribute("href")) {
        const link = new URL(clean.getAttribute("href"), window.location.origin);

        if (link.origin !== window.location.origin) {
          clean.setAttribute("target", "_blank");
          clean.setAttribute("rel", "noopener noreferrer");
        }
      }

      parent.appendChild(clean);

      Array.from(node.childNodes).forEach(function (child) {
        copyNode(child, clean);
      });
    }

    Array.from(parsed.body.childNodes).forEach(function (node) {
      copyNode(node, output);
    });

    return output;
  }

  function setSafeHTML(element, html) {
    if (!element || !("replaceChildren" in element)) return false;

    element.replaceChildren(sanitizeHTML(html));
    return true;
  }

  /* -------------------------------------------------------
     5. Public-data rendering

     Use an explicit field allowlist. Never render a full
     database/API record directly into a public page.
     ------------------------------------------------------- */

  function renderPublicData(container, records, schema) {
    if (!container || !Array.isArray(records) || !isPlainObject(schema)) {
      return 0;
    }

    const fragment = document.createDocumentFragment();
    let count = 0;

    records.forEach(function (record) {
      const safeRecord = pickFields(record, Object.keys(schema));
      const card = document.createElement("article");
      card.className = "mo-secure-data-card";

      Object.keys(schema).forEach(function (field) {
        if (!Object.prototype.hasOwnProperty.call(safeRecord, field)) return;

        const descriptor = schema[field];

        if (descriptor === false || SENSITIVE_KEY.test(field)) return;

        const config = typeof descriptor === "string"
          ? { label: descriptor }
          : descriptor;

        if (!config || config.hidden === true) return;

        const row = document.createElement("div");
        row.className = "mo-secure-data-field";

        if (config.label) {
          const label = document.createElement("span");
          label.className = "mo-secure-data-label";
          setText(label, config.label);
          row.appendChild(label);
        }

        const value = document.createElement("span");
        value.className = "mo-secure-data-value";

        const fieldValue = safeRecord[field];

        if (config.type === "link") {
          const link = document.createElement("a");
          setText(link, fieldValue);

          if (setSafeLink(link, String(fieldValue), {
            allowExternal: config.allowExternal === true
          })) {
            value.appendChild(link);
          } else {
            value.textContent = sanitizeText(fieldValue);
          }
        } else {
          setText(value, fieldValue, config.maxLength);
        }

        row.appendChild(value);
        card.appendChild(row);
      });

      fragment.appendChild(card);
      count += 1;
    });

    container.replaceChildren(fragment);

    return count;
  }

  /* -------------------------------------------------------
     6. Safe error messages
     ------------------------------------------------------- */

  function safeError(error, fallback) {
    const defaultMessage = fallback ||
      "We could not complete this request. Please try again.";

    if (!error) return defaultMessage;

    const status = Number(error.status || error.statusCode || 0);

    if (status === 400 || status === 422) {
      return "Some information is invalid. Please review your entries.";
    }

    if (status === 401) {
      return "Please sign in to continue.";
    }

    if (status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (status === 404) {
      return "The requested item could not be found.";
    }

    if (status === 429) {
      return "Too many requests. Please wait and try again.";
    }

    if (status >= 500) {
      return "The service is temporarily unavailable. Please try again later.";
    }

    // Do not show raw server messages or stack traces to visitors.
    return defaultMessage;
  }

  /* -------------------------------------------------------
     7. Same-origin API requests

     The server must still authenticate and authorize every
     request and return only fields the caller may access.
     ------------------------------------------------------- */

  function safeEndpoint(endpoint) {
    if (typeof endpoint !== "string" || !endpoint.trim()) {
      throw securityError("A valid API endpoint is required.", "INVALID_URL");
    }

    const base = new URL(state.options.apiBase, window.location.origin);
    const url = new URL(endpoint, base);

    if (
      state.options.sameOriginOnly &&
      url.origin !== window.location.origin
    ) {
      throw securityError(
        "Cross-origin requests are not permitted.",
        "CROSS_ORIGIN_BLOCKED"
      );
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw securityError("Unsupported URL protocol.", "INVALID_PROTOCOL");
    }

    if (url.username || url.password) {
      throw securityError("Credentials in URLs are not allowed.", "URL_CREDENTIALS");
    }

    return url;
  }

  async function request(endpoint, options) {
    const opts = options || {};
    const url = safeEndpoint(endpoint);
    const method = String(opts.method || "GET").toUpperCase();

    const allowedMethods = new Set([
      "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"
    ]);

    if (!allowedMethods.has(method)) {
      throw securityError("Unsupported request method.", "METHOD_BLOCKED");
    }

    if (typeof window.fetch !== "function") {
      throw securityError("This browser does not support fetch.", "FETCH_UNAVAILABLE");
    }

    const controller = typeof AbortController === "function"
      ? new AbortController()
      : null;

    let timeoutId = null;

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, Math.max(1000, Number(opts.timeout) || state.options.requestTimeout));

      state.activeRequests.add(controller);
    }

    const headers = new Headers(opts.headers || {});

    headers.set("Accept", "application/json");

    const requestOptions = {
      method: method,
      headers: headers,
      credentials: state.options.credentials,
      redirect: "error",
      cache: method === "GET" ? "no-store" : "no-cache"
    };

    if (controller) requestOptions.signal = controller.signal;

    if (opts.signal && !controller) {
      requestOptions.signal = opts.signal;
    }

    if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
      if (
        typeof FormData !== "undefined" &&
        opts.body instanceof FormData
      ) {
        requestOptions.body = opts.body;
      } else if (
        typeof URLSearchParams !== "undefined" &&
        opts.body instanceof URLSearchParams
      ) {
        requestOptions.body = opts.body;
      } else if (typeof opts.body === "string") {
        requestOptions.body = opts.body;
      } else {
        headers.set("Content-Type", "application/json");
        requestOptions.body = JSON.stringify(opts.body);
      }
    }

    try {
      const response = await window.fetch(url.href, requestOptions);
      const contentLength = Number(response.headers.get("content-length") || 0);

      if (
        contentLength &&
        contentLength > state.options.maxResponseBytes
      ) {
        throw securityError("The response is too large.", "RESPONSE_TOO_LARGE");
      }

      let data = null;
      const contentType = response.headers.get("content-type") || "";

      if (method !== "HEAD" && response.status !== 204) {
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          const text = await response.text();

          if (text.length > state.options.maxResponseBytes) {
            throw securityError("The response is too large.", "RESPONSE_TOO_LARGE");
          }

          data = text;
        }
      }

      if (!response.ok) {
        const error = securityError(
          safeError({ status: response.status }),
          "HTTP_ERROR"
        );

        error.status = response.status;
        error.data = data;
        throw error;
      }

      return {
        ok: true,
        status: response.status,
        data: data
      };
    } catch (error) {
      if (error.name === "AbortError") {
        throw securityError("The request timed out or was cancelled.", "REQUEST_ABORTED");
      }

      throw error;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (controller) state.activeRequests.delete(controller);
    }
  }

  /* -------------------------------------------------------
     8. Safe public display helper
     ------------------------------------------------------- */

  function displayError(target, error, fallback) {
    if (!target) return false;

    target.textContent = safeError(error, fallback);
    target.setAttribute("role", "alert");
    target.setAttribute("aria-live", "polite");

    return true;
  }

  function clearError(target) {
    if (!target) return false;

    target.textContent = "";
    target.removeAttribute("role");
    target.removeAttribute("aria-live");

    return true;
  }

  /* -------------------------------------------------------
     9. Lifecycle
     ------------------------------------------------------- */

  function init(options) {
    configure(options);
    state.initialized = true;

    return api;
  }

  function destroy() {
    state.activeRequests.forEach(function (controller) {
      try {
        controller.abort();
      } catch (_) {
        // Ignore cancellation errors.
      }
    });

    state.activeRequests.clear();
    state.initialized = false;

    return true;
  }

  const api = {
    version: VERSION,
    init: init,
    configure: configure,

    sanitizeText: sanitizeText,
    setText: setText,
    safeURL: safeURL,
    setSafeLink: setSafeLink,
    sanitizeHTML: sanitizeHTML,
    setSafeHTML: setSafeHTML,

    pickFields: pickFields,
    redact: redact,
    renderPublicData: renderPublicData,

    safeError: safeError,
    displayError: displayError,
    clearError: clearError,

    request: request,
    destroy: destroy
  };

  window.MedOrbitsSecurity = api;

  init();

})(window, document);
