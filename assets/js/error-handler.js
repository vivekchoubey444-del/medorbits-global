
/* =========================================================
   MedOrbits -- assets/js/error-handler.js
   Centralized error handling, logging, and user feedback
   Version: 1.2.0
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsErrorHandler) return;

  const CONFIG = window.MedOrbitsConfig || {};

  const settings = {
    debug: Boolean(CONFIG.DEBUG ?? CONFIG.debug ?? false),
    logToConsole: true,
    captureGlobalErrors: true,
    captureUnhandledRejections: true,
    notifyUser: true,
    maxStoredErrors: 100
  };

  const state = {
    errors: [],
    initialized: false,
    errorCount: 0
  };

  const listeners = new Set();

  const ERROR_TYPES = Object.freeze({
    NETWORK: "NETWORK_ERROR",
    VALIDATION: "VALIDATION_ERROR",
    AUTHENTICATION: "AUTHENTICATION_ERROR",
    AUTHORIZATION: "AUTHORIZATION_ERROR",
    NOT_FOUND: "NOT_FOUND_ERROR",
    SERVER: "SERVER_ERROR",
    TIMEOUT: "TIMEOUT_ERROR",
    UNKNOWN: "UNKNOWN_ERROR"
  });

  const SENSITIVE_KEY_PATTERN =
    /password|token|secret|authorization|cookie|email|phone|address|document|file|credential|session|api.?key|signature/i;

  function createId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `err-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function getMessage(error, fallback = "Something went wrong.") {
    if (typeof error === "string") {
      return error.slice(0, 1000);
    }

    if (error instanceof Error) {
      return error.message || fallback;
    }

    if (error && typeof error === "object") {
      const message = error.userMessage || error.message || error.error;

      if (typeof message === "string") {
        return message.slice(0, 1000);
      }
    }

    return fallback;
  }

  function classify(error) {
    const status = Number(
      error?.status ?? error?.statusCode ?? 0
    );

    const message = getMessage(error, "").toLowerCase();

    if (
      error?.name === "AbortError" ||
      error?.name === "TimeoutError" ||
      message.includes("timeout") ||
      message.includes("timed out")
    ) {
      return ERROR_TYPES.TIMEOUT;
    }

    if (
      status === 400 ||
      status === 422 ||
      message.includes("validation")
    ) {
      return ERROR_TYPES.VALIDATION;
    }

    if (status === 401) return ERROR_TYPES.AUTHENTICATION;
    if (status === 403) return ERROR_TYPES.AUTHORIZATION;
    if (status === 404) return ERROR_TYPES.NOT_FOUND;

    if (status >= 500 && status <= 599) {
      return ERROR_TYPES.SERVER;
    }

    if (
      error instanceof TypeError ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("failed to fetch") ||
      message.includes("load failed") ||
      message.includes("networkerror")
    ) {
      return ERROR_TYPES.NETWORK;
    }

    return ERROR_TYPES.UNKNOWN;
  }

  function sanitizeValue(value, depth = 0) {
    if (
      value === null ||
      typeof value === "boolean" ||
      typeof value === "number"
    ) {
      return value;
    }

    if (typeof value === "string") {
      return value.slice(0, 300);
    }

    if (depth >= 3 || typeof value !== "object") {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value
        .slice(0, 20)
        .map(item => sanitizeValue(item, depth + 1))
        .filter(item => item !== undefined);
    }

    const output = {};

    Object.entries(value).slice(0, 30).forEach(([key, item]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) return;

      const safeValue = sanitizeValue(item, depth + 1);

      if (safeValue !== undefined) {
        output[key] = safeValue;
      }
    });

    return output;
  }

  function sanitizeContext(context) {
    if (
      !context ||
      typeof context !== "object" ||
      Array.isArray(context)
    ) {
      return {};
    }

    return sanitizeValue(context) || {};
  }

  function normalizeError(error, context = {}) {
    const original = error instanceof Error
      ? error
      : new Error(getMessage(error));

    const status = Number(
      error?.status ?? error?.statusCode ?? 0
    );

    return {
      id: createId(),
      name: String(original.name || "Error").slice(0, 100),
      message: getMessage(original),
      type: context.type || classify(error),
      status:
        Number.isFinite(status) && status > 0
          ? status
          : null,
      code:
        typeof error?.code === "string"
          ? error.code.slice(0, 100)
          : null,
      context: sanitizeContext(context),
      timestamp: new Date().toISOString(),
      url: window.location?.pathname || "",
      stack: settings.debug
        ? String(original.stack || "").slice(0, 10000) || null
        : null
    };
  }

  function notifyListeners(record) {
    listeners.forEach(function (callback) {
      try {
        callback(record);
      } catch (error) {
        if (settings.debug) {
          console.error(
            "[MedOrbits Error Handler] Listener failed:",
            error
          );
        }
      }
    });
  }

  function log(error, context = {}) {
    const record = normalizeError(error, context);

    state.errors.unshift(record);
    state.errorCount += 1;

    const maxErrors = Math.max(
      0,
      Math.floor(Number(settings.maxStoredErrors) || 0)
    );

    if (state.errors.length > maxErrors) {
      state.errors.length = maxErrors;
    }

    if (settings.logToConsole) {
      const logger =
        record.type === ERROR_TYPES.VALIDATION
          ? console.warn
          : console.error;

      if (settings.debug) {
        logger("[MedOrbits]", record.message, record);
      } else {
        logger("[MedOrbits]", record.message);
      }
    }

    notifyListeners(record);

    document.dispatchEvent(
      new CustomEvent("medorbits:error", {
        detail: record
      })
    );

    return record;
  }

  function getUserMessage(error, options = {}) {
    const type = options.type || classify(error);

    const messages = {
      [ERROR_TYPES.NETWORK]:
        "Unable to connect. Please check your internet connection and try again.",

      [ERROR_TYPES.VALIDATION]:
        "Please check the information entered and try again.",

      [ERROR_TYPES.AUTHENTICATION]:
        "Your session may have expired. Please sign in again.",

      [ERROR_TYPES.AUTHORIZATION]:
        "You do not have permission to perform this action.",

      [ERROR_TYPES.NOT_FOUND]:
        "The requested information could not be found.",

      [ERROR_TYPES.SERVER]:
        "Our server is temporarily unavailable. Please try again later.",

      [ERROR_TYPES.TIMEOUT]:
        "The request took too long. Please try again.",

      [ERROR_TYPES.UNKNOWN]:
        "Something went wrong. Please try again."
    };

    if (options.exposeMessage && error?.userMessage) {
      return String(error.userMessage).slice(0, 500);
    }

    return messages[type] || messages[ERROR_TYPES.UNKNOWN];
  }

  function show(message, type = "error", options = {}) {
    if (!settings.notifyUser || options.silent) return;

    const safeMessage = String(
      message || "Something went wrong."
    ).slice(0, 1000);

    if (window.MedOrbitsToast?.show) {
      window.MedOrbitsToast.show(safeMessage, type);
      return;
    }

    if (
      type === "error" &&
      typeof window.MedOrbitsToast?.error === "function"
    ) {
      window.MedOrbitsToast.error(safeMessage);
      return;
    }

    document.dispatchEvent(
      new CustomEvent("medorbits:toast", {
        detail: {
          message: safeMessage,
          type,
          duration: Number(options.duration) || 5000
        }
      })
    );
  }

  function handle(error, context = {}, options = {}) {
    const record = log(error, context);

    if (!options.silent) {
      show(
        options.message || getUserMessage(error, options),
        options.toastType || "error",
        options
      );
    }

    return record;
  }

  function handleAsync(error, context = {}, options = {}) {
    handle(error, context, options);
    return null;
  }

  function handleResponse(response, context = {}) {
    if (!response || response.ok) return response;

    const error = new Error(
      `Request failed with status ${response.status}`
    );

    error.status = response.status;
    error.statusCode = response.status;

    handle(error, {
      ...context,
      source: context.source || "http-response"
    });

    return response;
  }

  function wrap(callback, context = {}, options = {}) {
    if (typeof callback !== "function") {
      return callback;
    }

    return function wrappedHandler(...args) {
      try {
        const result = callback.apply(this, args);

        if (result && typeof result.then === "function") {
          return result.catch(function (error) {
            handle(error, context, options);

            if (options.rethrow) throw error;

            return options.fallback;
          });
        }

        return result;
      } catch (error) {
        handle(error, context, options);

        if (options.rethrow) throw error;

        return options.fallback;
      }
    };
  }

  function guard(promise, context = {}, options = {}) {
    return Promise.resolve(promise).catch(function (error) {
      handle(error, context, options);

      if (options.rethrow !== false) {
        throw error;
      }

      return options.fallback ?? null;
    });
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    listeners.add(callback);

    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  function getErrors(options = {}) {
    const errors = [...state.errors];

    if (options.type) {
      return errors.filter(function (error) {
        return error.type === options.type;
      });
    }

    return errors;
  }

  function clear(options = {}) {
    state.errors = [];

    if (options.resetCount) {
      state.errorCount = 0;
    }

    document.dispatchEvent(
      new CustomEvent("medorbits:errors-cleared", {
        detail: { errorCount: state.errorCount }
      })
    );
  }

  function getState() {
    return {
      initialized: state.initialized,
      errorCount: state.errorCount,
      storedErrors: state.errors.length,
      settings: { ...settings }
    };
  }

  function configure(options = {}) {
    const booleanSettings = [
      "debug",
      "logToConsole",
      "captureGlobalErrors",
      "captureUnhandledRejections",
      "notifyUser"
    ];

    booleanSettings.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(options, key)) {
        settings[key] = Boolean(options[key]);
      }
    });

    if (
      Object.prototype.hasOwnProperty.call(options, "maxStoredErrors")
    ) {
      const limit = Number(options.maxStoredErrors);

      if (Number.isFinite(limit) && limit >= 0) {
        settings.maxStoredErrors = Math.floor(limit);

        if (state.errors.length > settings.maxStoredErrors) {
          state.errors.length = settings.maxStoredErrors;
        }
      }
    }

    return { ...settings };
  }

  function captureGlobalErrors() {
    if (settings.captureGlobalErrors) {
      window.addEventListener("error", function (event) {
        const error = event.error instanceof Error
          ? event.error
          : new Error(event.message || "Uncaught browser error");

        handle(
          error,
          {
            source: "window-error",
            filename: event.filename || "",
            line: event.lineno || 0,
            column: event.colno || 0
          },
          { silent: true }
        );
      });
    }

    if (settings.captureUnhandledRejections) {
      window.addEventListener(
        "unhandledrejection",
        function (event) {
          const error = event.reason instanceof Error
            ? event.reason
            : new Error(
                getMessage(
                  event.reason,
                  "Unhandled promise rejection"
                )
              );

          handle(
            error,
            { source: "unhandled-rejection" },
            { silent: true }
          );
        }
      );
    }
  }

  function init(options = {}) {
    configure(options);

    if (state.initialized) {
      return api;
    }

    state.initialized = true;
    captureGlobalErrors();

    document.dispatchEvent(
      new CustomEvent("medorbits:error-handler-ready")
    );

    return api;
  }

  const api = Object.freeze({
    ERROR_TYPES,
    init,
    configure,
    classify,
    normalizeError,
    log,
    handle,
    handleAsync,
    handleResponse,
    getUserMessage,
    show,
    wrap,
    guard,
    subscribe,
    getErrors,
    getState,
    clear
  });

  window.MedOrbitsErrorHandler = api;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        init();
      },
      { once: true }
    );
  } else {
    init();
  }

})(window, document);
