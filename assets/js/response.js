
/*!
 * MedOrbits | Response Handler
 * File: assets/js/response.js
 * Version: 2.0.0
 *
 * Features:
 * - Standardized API response parsing and HTTP error normalization
 * - Accessible success, error, warning and information messages
 * - Safe field-level validation errors
 * - Reliable form and button loading-state restoration
 * - Same-origin request protection and CSRF support
 * - Request timeouts, cancellation and cleanup
 * - JSON, text, empty and non-JSON response support
 * - Optional MedOrbitsNotifications integration
 * - Dynamic form support with MutationObserver
 * - Lifecycle cleanup and duplicate-listener prevention
 * - No external dependencies
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsResponse) return;

  const DEFAULTS = {
    messageDuration: 6000,
    requestTimeout: 15000,

    selectors: {
      status: "[data-mo-response]",
      form: "[data-mo-response-form]",
      submit: "[data-mo-response-submit]",
      fieldError: "[data-mo-response-field-error]"
    },

    messages: {
      genericError: "Something went wrong. Please try again.",
      networkError:
        "Unable to connect. Check your internet connection and try again.",
      timeoutError: "The request took too long. Please try again.",
      success: "Your request was completed successfully.",
      unauthorized: "Your session may have expired. Please sign in again.",
      forbidden: "You do not have permission to perform this action.",
      notFound: "The requested resource could not be found.",
      validation: "Please check the highlighted fields and try again.",
      serverError: "The server could not complete your request."
    }
  };

  const state = {
    config: null,
    initialized: false,
    observer: null,
    listeners: [],
    boundForms: new WeakSet(),
    boundButtons: new WeakSet(),
    requestControllers: new Set(),
    messageTimers: new WeakMap(),
    timerHandles: new Set(),
    busyStates: new WeakMap(),
    generatedStyles: false
  };

  /* -------------------------------------------------------
     Configuration and utilities
  ------------------------------------------------------- */

  function configure(options) {
    const input = options || {};

    state.config = {
      ...DEFAULTS,
      ...input,

      selectors: {
        ...DEFAULTS.selectors,
        ...(input.selectors || {})
      },

      messages: {
        ...DEFAULTS.messages,
        ...(input.messages || {})
      }
    };

    return api;
  }

  function listen(element, eventName, handler, options) {
    if (!element || !element.addEventListener) return;

    element.addEventListener(eventName, handler, options);

    state.listeners.push(function () {
      element.removeEventListener(eventName, handler, options);
    });
  }

  function queryAll(root, selector) {
    if (!root || !root.querySelectorAll) return [];

    try {
      return Array.from(root.querySelectorAll(selector));
    } catch (_) {
      return [];
    }
  }

  function isElement(value) {
    return Boolean(
      value &&
      typeof value.matches === "function" &&
      typeof value.querySelectorAll === "function"
    );
  }

  function safeString(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    return "";
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  function getCSRFToken() {
    const meta = document.querySelector(
      'meta[name="csrf-token"], meta[name="csrf_token"]'
    );

    return meta ? meta.content.trim() : "";
  }

  function dispatch(element, name, detail) {
    if (!element) return;

    element.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        detail: detail || {}
      })
    );
  }

  /* -------------------------------------------------------
     Styles
  ------------------------------------------------------- */

  function ensureStyles() {
    if (document.getElementById("mo-response-styles")) return;

    const style = document.createElement("style");

    style.id = "mo-response-styles";

    style.textContent = `
      .mo-response-message {
        margin: 12px 0;
        padding: 12px 14px;
        border: 1px solid #c9d4cb;
        border-radius: 10px;
        background: #e9efe9;
        color: #284535;
        font-size: 14px;
        line-height: 1.55;
        overflow-wrap: anywhere;
        box-sizing: border-box;
      }

      .mo-response-message:empty,
      .mo-response-message[hidden] {
        display: none !important;
      }

      .mo-response-message[data-type="success"] {
        background: #e4f0e5;
        color: #245d32;
        border-color: #b6d7bc;
      }

      .mo-response-message[data-type="error"] {
        background: #f8e8e5;
        color: #8c2821;
        border-color: #e6c0ba;
      }

      .mo-response-message[data-type="warning"] {
        background: #f7efdc;
        color: #74521d;
        border-color: #e7d5a8;
      }

      .mo-response-message[data-type="info"] {
        background: #e8edf0;
        color: #304b5a;
        border-color: #c4d4dd;
      }

      [data-mo-response-field-error] {
        display: block;
        margin: 5px 0 0;
        color: #a12820;
        font-size: 12px;
        line-height: 1.5;
      }

      [data-mo-response-invalid="true"] {
        border-color: #b42318 !important;
      }

      [data-mo-response-submit][aria-busy="true"] {
        cursor: wait;
        opacity: .72;
      }

      @media (prefers-reduced-motion: reduce) {
        .mo-response-message {
          scroll-behavior: auto;
          transition: none !important;
          animation: none !important;
        }
      }
    `;

    document.head.appendChild(style);
    state.generatedStyles = true;
  }

  /* -------------------------------------------------------
     Message containers
  ------------------------------------------------------- */

  function getMessageElement(target, create) {
    if (!isElement(target)) return null;

    if (target.matches(state.config.selectors.status)) {
      return target;
    }

    let element = target.querySelector(state.config.selectors.status);

    if (!element && create) {
      element = document.createElement("div");

      element.className = "mo-response-message";
      element.setAttribute("data-mo-response", "");
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
      element.setAttribute("tabindex", "-1");

      target.prepend(element);
    }

    return element;
  }

  function clearTimer(element) {
    const timer = state.messageTimers.get(element);

    if (timer !== undefined) {
      window.clearTimeout(timer);
      state.timerHandles.delete(timer);
      state.messageTimers.delete(element);
    }
  }

  function show(target, message, type, options) {
    const opts = options || {};
    const element = getMessageElement(target, opts.create !== false);

    if (!element) return null;

    clearTimer(element);

    const allowedTypes = ["success", "error", "warning", "info"];
    const messageType = allowedTypes.includes(type) ? type : "info";

    element.textContent = safeString(message);
    element.dataset.type = messageType;
    element.hidden = false;

    element.setAttribute(
      "role",
      messageType === "error" ? "alert" : "status"
    );

    element.setAttribute(
      "aria-live",
      messageType === "error" ? "assertive" : "polite"
    );

    if (opts.focus === true) {
      element.focus();
    }

    const duration = opts.duration === undefined
      ? state.config.messageDuration
      : Number(opts.duration);

    if (Number.isFinite(duration) && duration > 0) {
      const timer = window.setTimeout(function () {
        element.textContent = "";
        delete element.dataset.type;
        element.hidden = true;

        state.messageTimers.delete(element);
        state.timerHandles.delete(timer);
      }, duration);

      state.messageTimers.set(element, timer);
      state.timerHandles.add(timer);
    }

    dispatch(element, "medorbits:response", {
      type: messageType,
      message: element.textContent
    });

    return element;
  }

  function clear(target) {
    if (!isElement(target)) return;

    const elements = target.matches(state.config.selectors.status)
      ? [target]
      : queryAll(target, state.config.selectors.status);

    elements.forEach(function (element) {
      clearTimer(element);
      element.textContent = "";
      delete element.dataset.type;
      element.hidden = true;
    });
  }

  /* -------------------------------------------------------
     Field-level validation errors
  ------------------------------------------------------- */

  function findField(form, fieldName) {
    if (!form || !form.elements) return null;

    const fields = Array.from(form.elements);

    return fields.find(function (field) {
      return field.name === fieldName ||
        field.getAttribute("data-field") === fieldName;
    }) || null;
  }

  function clearFieldErrors(form) {
    if (!form) return;

    queryAll(form, '[data-mo-response-invalid="true"]').forEach(function (field) {
      field.removeAttribute("data-mo-response-invalid");
      field.removeAttribute("aria-invalid");

      const ids = (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);

      const remaining = ids.filter(function (id) {
        const error = document.getElementById(id);

        return !(
          error &&
          error.hasAttribute("data-mo-response-field-error")
        );
      });

      if (remaining.length) {
        field.setAttribute("aria-describedby", remaining.join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    });

    queryAll(form, state.config.selectors.fieldError).forEach(function (error) {
      error.remove();
    });
  }

  function showFieldErrors(form, errors) {
    if (!form || !errors || typeof errors !== "object") return;

    clearFieldErrors(form);

    let firstInvalid = null;

    Object.keys(errors).forEach(function (fieldName) {
      const raw = errors[fieldName];

      const message = Array.isArray(raw)
        ? raw.map(safeString).find(function (item) {
            return item.trim().length > 0;
          })
        : safeString(raw);

      if (!message || !message.trim()) return;

      const field = findField(form, fieldName);

      if (!field || !field.insertAdjacentElement) return;

      if (!field.id) {
        field.id = "mo-field-" +
          Math.random().toString(36).slice(2, 10);
      }

      const error = document.createElement("p");

      error.className = "mo-response-field-error";
      error.setAttribute("data-mo-response-field-error", "");
      error.id = field.id + "-response-error";
      error.textContent = message;

      field.setAttribute("aria-invalid", "true");
      field.setAttribute("data-mo-response-invalid", "true");

      field.insertAdjacentElement("afterend", error);

      const describedBy = new Set(
        (field.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter(Boolean)
      );

      describedBy.add(error.id);

      field.setAttribute(
        "aria-describedby",
        Array.from(describedBy).join(" ")
      );

      if (!firstInvalid) firstInvalid = field;
    });

    if (firstInvalid && typeof firstInvalid.focus === "function") {
      firstInvalid.focus();
    }
  }

  /* -------------------------------------------------------
     HTTP response normalization
  ------------------------------------------------------- */

  function normalize(response, body) {
    const status = response && Number.isFinite(response.status)
      ? response.status
      : null;

    const data = body && typeof body === "object" ? body : {};
    const messages = state.config.messages;

    let type = "error";
    let message = messages.genericError;

    if (response && response.ok) {
      type = "success";
      message = safeString(data.message) || messages.success;
    } else {
      switch (status) {
        case 400:
        case 422:
          message = safeString(data.message) || messages.validation;
          break;

        case 401:
          message = messages.unauthorized;
          break;

        case 403:
          message = messages.forbidden;
          break;

        case 404:
          message = messages.notFound;
          break;

        case 408:
        case 504:
          message = messages.timeoutError;
          break;

        default:
          if (status !== null && status >= 500) {
            message = messages.serverError;
          } else if (data.message) {
            message = safeString(data.message);
          }
      }
    }

    return {
      ok: Boolean(response && response.ok),
      status: status,
      type: type,
      message: message,
      data: data,
      errors: data.errors || data.fieldErrors || null
    };
  }

  async function readResponse(response) {
    if (!response) {
      throw new TypeError("A valid HTTP response is required.");
    }

    if (response.status === 204 || response.status === 205) {
      return {};
    }

    const contentType = response.headers
      ? response.headers.get("content-type") || ""
      : "";

    if (contentType.toLowerCase().includes("application/json")) {
      try {
        const body = await response.json();

        return body && typeof body === "object"
          ? body
          : { data: body };
      } catch (_) {
        return {
          message: response.ok
            ? state.config.messages.success
            : state.config.messages.genericError
        };
      }
    }

    if (typeof response.text === "function") {
      const text = await response.text();

      if (!text) return {};

      // Do not attempt to render HTML as markup.
      return { message: text };
    }

    return {};
  }

  async function parse(response) {
    const body = await readResponse(response);
    return normalize(response, body);
  }

  /* -------------------------------------------------------
     Render a normalized result
  ------------------------------------------------------- */

  function render(target, result, options) {
    const opts = options || {};

    if (!result || typeof result !== "object") {
      return show(
        target,
        state.config.messages.genericError,
        "error",
        opts
      );
    }

    const type = result.ok
      ? "success"
      : (["error", "warning", "info"].includes(result.type)
          ? result.type
          : "error");

    const element = show(
      target,
      safeString(result.message) || state.config.messages.genericError,
      type,
      opts
    );

    if (opts.form && result.errors) {
      showFieldErrors(opts.form, result.errors);
    }

    const notifications = window.MedOrbitsNotifications;

    if (
      opts.notifications !== false &&
      notifications &&
      typeof notifications[type] === "function"
    ) {
      try {
        notifications[type](safeString(result.message));
      } catch (_) {
        // The notification integration is optional.
      }
    }

    return element;
  }

  /* -------------------------------------------------------
     Loading-state management
  ------------------------------------------------------- */

  function getBusyElements(target) {
    if (!isElement(target)) return [];

    const selector =
      'button[type="submit"], input[type="submit"], ' +
      'button[data-mo-response-submit], ' +
      'input[data-mo-response-submit], ' +
      '[data-mo-response-submit]';

    if (target.matches("button, input, [data-mo-response-submit]")) {
      return [target];
    }

    return queryAll(target, selector);
  }

  function setBusy(target, busy, message) {
    const elements = getBusyElements(target);

    elements.forEach(function (element) {
      if (busy) {
        if (!state.busyStates.has(element)) {
          state.busyStates.set(element, {
            disabled: Boolean(element.disabled),
            ariaBusy: element.getAttribute("aria-busy"),
            value: element instanceof HTMLInputElement
              ? element.value
              : null,
            children: element instanceof HTMLInputElement
              ? null
              : Array.from(element.childNodes).map(function (node) {
                  return node.cloneNode(true);
                })
          });
        }

        element.disabled = true;
        element.setAttribute("aria-busy", "true");

        if (message !== undefined && message !== null) {
          const label = safeString(message);

          if (element instanceof HTMLInputElement) {
            element.value = label;
          } else {
            element.textContent = label;
          }
        }

        return;
      }

      const original = state.busyStates.get(element);

      if (!original) {
        element.disabled = false;
        element.removeAttribute("aria-busy");
        return;
      }

      element.disabled = original.disabled;

      if (original.ariaBusy === null) {
        element.removeAttribute("aria-busy");
      } else {
        element.setAttribute("aria-busy", original.ariaBusy);
      }

      if (element instanceof HTMLInputElement) {
        if (original.value !== null) {
          element.value = original.value;
        }
      } else if (original.children) {
        element.replaceChildren.apply(
          element,
          original.children.map(function (node) {
            return node.cloneNode(true);
          })
        );
      }

      state.busyStates.delete(element);
    });
  }

  /* -------------------------------------------------------
     Safe API request helper
  ------------------------------------------------------- */

  function safeEndpoint(endpoint) {
    if (typeof endpoint !== "string" || !endpoint.trim()) {
      throw new TypeError("A valid API endpoint is required.");
    }

    const url = new URL(endpoint, window.location.origin);

    if (url.origin !== window.location.origin) {
      throw new Error("Only same-origin API endpoints are allowed.");
    }

    if (url.username || url.password) {
      throw new Error("Credentials are not allowed in API URLs.");
    }

    return url.href;
  }

  function isFormData(value) {
    return typeof FormData !== "undefined" && value instanceof FormData;
  }

  function isBlob(value) {
    return typeof Blob !== "undefined" && value instanceof Blob;
  }

  async function request(endpoint, options) {
    const opts = options || {};
    const url = safeEndpoint(endpoint);
    const method = safeString(opts.method || "GET").toUpperCase();

    if (!/^(GET|HEAD|POST|PUT|PATCH|DELETE)$/.test(method)) {
      throw new Error("Unsupported HTTP method.");
    }

    const controller = typeof AbortController !== "undefined"
      ? new AbortController()
      : null;

    if (controller) state.requestControllers.add(controller);

    const timeoutMs = Number.isFinite(opts.timeout) && opts.timeout > 0
      ? opts.timeout
      : state.config.requestTimeout;

    const timeout = controller
      ? window.setTimeout(function () {
          controller.abort();
        }, timeoutMs)
      : null;

    let headers;

    try {
      headers = new Headers(opts.headers || {});
    } catch (_) {
      if (timeout !== null) window.clearTimeout(timeout);
      if (controller) state.requestControllers.delete(controller);

      throw new TypeError("Invalid request headers.");
    }

    headers.set("Accept", "application/json");

    let body = opts.body;

    if (body !== undefined && body !== null) {
      if (isFormData(body) || isBlob(body)) {
        // Let the browser set multipart boundaries for FormData.
        if (isFormData(body)) headers.delete("Content-Type");
      } else if (typeof body === "string") {
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "text/plain;charset=UTF-8");
        }
      } else if (
        Array.isArray(body) ||
        isPlainObject(body)
      ) {
        body = JSON.stringify(body);
        headers.set("Content-Type", "application/json");
      } else {
        if (timeout !== null) window.clearTimeout(timeout);
        if (controller) state.requestControllers.delete(controller);

        throw new TypeError(
          "Request body must be a string, object, FormData or Blob."
        );
      }
    }

    const csrf = getCSRFToken();

    if (csrf && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrf);
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: controller ? controller.signal : opts.signal
      });

      const result = await parse(response);

      if (!result.ok) {
        const error = new Error(result.message);
        error.result = result;
        error.status = result.status;
        throw error;
      }

      return result;
    } catch (error) {
      if (error && error.result) throw error;

      if (error && error.name === "AbortError") {
        throw new Error(state.config.messages.timeoutError);
      }

      if (error instanceof TypeError) {
        throw new Error(state.config.messages.networkError);
      }

      throw error;
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
      if (controller) state.requestControllers.delete(controller);
    }
  }

  /* -------------------------------------------------------
     Form integration
  ------------------------------------------------------- */

  function bindForm(form) {
    if (state.boundForms.has(form)) return;

    state.boundForms.add(form);

    listen(form, "input", function (event) {
      const field = event.target;

      if (
        field &&
        field.hasAttribute("data-mo-response-invalid")
      ) {
        field.removeAttribute("data-mo-response-invalid");
        field.removeAttribute("aria-invalid");

        const errorId = field.id
          ? field.id + "-response-error"
          : "";

        if (errorId) {
          const error = document.getElementById(errorId);
          if (error) error.remove();

          const ids = (field.getAttribute("aria-describedby") || "")
            .split(/\s+/)
            .filter(function (id) {
              return id && id !== errorId;
            });

          if (ids.length) {
            field.setAttribute("aria-describedby", ids.join(" "));
          } else {
            field.removeAttribute("aria-describedby");
          }
        }
      }
    });

    listen(form, "reset", function () {
      window.setTimeout(function () {
        clearFieldErrors(form);
        clear(form);
      }, 0);
    });
  }

  function refresh(root) {
    const scope = root || document;

    queryAll(scope, state.config.selectors.form).forEach(bindForm);

    if (
      scope.matches &&
      scope.matches(state.config.selectors.form)
    ) {
      bindForm(scope);
    }

    queryAll(scope, state.config.selectors.submit).forEach(function (button) {
      state.boundButtons.add(button);
    });

    return api;
  }

  /* -------------------------------------------------------
     Lifecycle
  ------------------------------------------------------- */

  function init(options) {
    if (!state.config) {
      configure(options);
    } else if (options) {
      configure(options);
    }

    if (state.initialized) {
      refresh(document);
      return api;
    }

    ensureStyles();
    refresh(document);

    if (
      typeof MutationObserver !== "undefined" &&
      document.documentElement
    ) {
      state.observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              refresh(node);
            }
          });
        });
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    state.initialized = true;
    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (_) {
        // Continue cleanup if an element was removed.
      }
    });

    state.listeners = [];

    state.timerHandles.forEach(function (timer) {
      window.clearTimeout(timer);
    });

    state.timerHandles.clear();
    state.messageTimers = new WeakMap();

    state.requestControllers.forEach(function (controller) {
      try {
        controller.abort();
      } catch (_) {
        // Ignore requests that have already completed.
      }
    });

    state.requestControllers.clear();
    state.boundForms = new WeakSet();
    state.boundButtons = new WeakSet();
    state.busyStates = new WeakMap();

    if (state.generatedStyles) {
      const style = document.getElementById("mo-response-styles");

      if (style) style.remove();

      state.generatedStyles = false;
    }

    state.initialized = false;
  }

  /* -------------------------------------------------------
     Public API
  ------------------------------------------------------- */

  const api = {
    init: init,
    configure: configure,
    show: show,
    clear: clear,
    normalize: normalize,
    parse: parse,
    render: render,
    setBusy: setBusy,
    showFieldErrors: showFieldErrors,
    clearFieldErrors: clearFieldErrors,
    request: request,
    refresh: refresh,
    destroy: destroy,

    config: function () {
      const current = state.config || DEFAULTS;

      return {
        ...current,
        selectors: { ...current.selectors },
        messages: { ...current.messages }
      };
    }
  };

  window.MedOrbitsResponse = api;

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(window, document);
