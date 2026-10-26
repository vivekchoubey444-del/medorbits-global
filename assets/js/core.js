
/**
 * MedOrbits -- Core Runtime
 * File: /assets/js/core.js
 * Version: 1.1.0
 *
 * Responsibilities:
 * - Runtime defaults and environment detection
 * - Safe DOM utilities
 * - Shared event bus
 * - Storage abstraction
 * - Formatting and validation helpers
 * - Debounce, throttle and ID generation
 * - Safe JSON handling
 * - URL and query-string utilities
 * - Runtime diagnostics
 *
 * Dependencies: None
 *
 * Does not implement authentication, API requests, payments,
 * permissions, or page-specific UI behavior.
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsCore) {
    return;
  }

  // --------------------------------------------------
  // Configuration
  // --------------------------------------------------

  var ENVIRONMENTS = Object.freeze({
    DEVELOPMENT: "development",
    TEST: "test",
    STAGING: "staging",
    PRODUCTION: "production"
  });

  var STORAGE_TYPES = Object.freeze({
    LOCAL: "local",
    SESSION: "session"
  });

  var STORAGE_KEYS = Object.freeze({
    THEME: "theme",
    LOCALE: "locale",
    COOKIE_CONSENT: "cookie-consent",
    LAST_VISITED: "last-visited"
  });

  var HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  });

  function detectEnvironment() {
    var explicit = window.MEDORBITS_ENV;

    if (
      Object.keys(ENVIRONMENTS).some(function (key) {
        return ENVIRONMENTS[key] === explicit;
      })
    ) {
      return explicit;
    }

    var hostname = window.location.hostname.toLowerCase();

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return ENVIRONMENTS.DEVELOPMENT;
    }

    if (
      hostname.endsWith(".test") ||
      hostname.endsWith(".localhost")
    ) {
      return ENVIRONMENTS.TEST;
    }

    if (
      hostname.indexOf("staging.") === 0 ||
      hostname.indexOf("test.") === 0
    ) {
      return ENVIRONMENTS.STAGING;
    }

    return ENVIRONMENTS.PRODUCTION;
  }

  var environment = detectEnvironment();

  var locale =
    document.documentElement.lang ||
    "en-IN";

  var DEFAULTS = Object.freeze({
    name: "MedOrbits",
    version: "1.1.0",
    locale: locale,
    currency: "INR",
    currencySymbol: "₹",
    timeZone: "Asia/Kolkata",
    dateFormat: "DD MMM YYYY",
    pageSize: 12,
    maxPageSize: 100,
    requestTimeout: 15000,
    debounceDelay: 300,
    throttleDelay: 200,
    storagePrefix: "medorbits:",
    debug:
      window.MEDORBITS_DEBUG === true ||
      environment === ENVIRONMENTS.DEVELOPMENT
  });

  var config = Object.freeze(
    Object.assign({}, DEFAULTS, {
      environment: environment
    })
  );

  // --------------------------------------------------
  // Logging
  // --------------------------------------------------

  var logger = {
    info: function (message, details) {
      if (!config.debug) return;

      console.info(
        "[" + config.name + ":core] " + message,
        details === undefined ? "" : details
      );
    },

    warn: function (message, details) {
      console.warn(
        "[" + config.name + ":core] " + message,
        details === undefined ? "" : details
      );
    },

    error: function (message, details) {
      console.error(
        "[" + config.name + ":core] " + message,
        details === undefined ? "" : details
      );
    },

    debug: function (message, details) {
      if (!config.debug) return;

      console.debug(
        "[" + config.name + ":core] " + message,
        details === undefined ? "" : details
      );
    }
  };

  // --------------------------------------------------
  // Type helpers
  // --------------------------------------------------

  var types = {
    isString: function (value) {
      return typeof value === "string";
    },

    isNonEmptyString: function (value) {
      return typeof value === "string" && value.trim().length > 0;
    },

    isNumber: function (value) {
      return typeof value === "number" && Number.isFinite(value);
    },

    isInteger: function (value) {
      return Number.isSafeInteger(value);
    },

    isBoolean: function (value) {
      return typeof value === "boolean";
    },

    isArray: function (value) {
      return Array.isArray(value);
    },

    isObject: function (value) {
      return value !== null && typeof value === "object" &&
        !Array.isArray(value);
    },

    isPlainObject: function (value) {
      if (!this.isObject(value)) return false;

      var prototype = Object.getPrototypeOf(value);

      return prototype === Object.prototype || prototype === null;
    },

    isFunction: function (value) {
      return typeof value === "function";
    },

    isNullish: function (value) {
      return value === null || value === undefined;
    },

    isEmpty: function (value) {
      if (this.isNullish(value)) return true;
      if (this.isString(value)) return value.trim() === "";
      if (this.isArray(value)) return value.length === 0;

      if (this.isPlainObject(value)) {
        return Object.keys(value).length === 0;
      }

      return false;
    }
  };

  // --------------------------------------------------
  // DOM utilities
  // --------------------------------------------------

  var dom = {
    query: function (selector, root) {
      root = root || document;

      if (!types.isString(selector) ||
          !root ||
          typeof root.querySelector !== "function") {
        return null;
      }

      try {
        return root.querySelector(selector);
      } catch (error) {
        logger.warn("Invalid selector", {
          selector: selector,
          message: error.message
        });

        return null;
      }
    },

    queryAll: function (selector, root) {
      root = root || document;

      if (!types.isString(selector) ||
          !root ||
          typeof root.querySelectorAll !== "function") {
        return [];
      }

      try {
        return Array.prototype.slice.call(
          root.querySelectorAll(selector)
        );
      } catch (error) {
        logger.warn("Invalid selector", {
          selector: selector,
          message: error.message
        });

        return [];
      }
    },

    byId: function (id, root) {
      root = root || document;

      if (!types.isNonEmptyString(id)) return null;

      if (
        root === document &&
        typeof document.getElementById === "function"
      ) {
        return document.getElementById(id);
      }

      // Avoid constructing a selector from an untrusted ID.
      return this.query(
        '[id="' + String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]',
        root
      );
    },

    create: function (tagName, options) {
      options = options || {};

      if (!types.isNonEmptyString(tagName)) {
        throw new TypeError("A valid element tag is required.");
      }

      if (!/^[a-z][a-z0-9-]*$/i.test(tagName)) {
        throw new TypeError("Invalid element tag name.");
      }

      var element = document.createElement(tagName);

      if (options.className) {
        element.className = String(options.className);
      }

      if (options.id) {
        element.id = String(options.id);
      }

      if (options.text !== undefined && options.text !== null) {
        element.textContent = String(options.text);
      }

      if (types.isPlainObject(options.attributes)) {
        Object.keys(options.attributes).forEach(function (name) {
          var value = options.attributes[name];

          if (
            value === null ||
            value === undefined ||
            typeof value === "object" ||
            /^on/i.test(name) ||
            name.toLowerCase() === "srcdoc"
          ) {
            return;
          }

          element.setAttribute(name, String(value));
        });
      }

      return element;
    },

    setText: function (element, value) {
      if (!element || !("textContent" in element)) return false;

      element.textContent = value == null ? "" : String(value);

      return true;
    },

    toggleClass: function (element, className, force) {
      if (
        !element ||
        !element.classList ||
        !types.isNonEmptyString(className)
      ) {
        return false;
      }

      if (force === undefined) {
        return element.classList.toggle(className);
      }

      return element.classList.toggle(className, Boolean(force));
    },

    isVisible: function (element) {
      if (!element || element.nodeType !== 1) return false;

      var style = window.getComputedStyle(element);

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.visibility !== "collapse" &&
        element.getClientRects().length > 0
      );
    },

    ready: function (callback) {
      if (!types.isFunction(callback)) {
        throw new TypeError("DOM ready callback must be a function.");
      }

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          callback,
          { once: true }
        );
      } else {
        callback();
      }
    }
  };

  // --------------------------------------------------
  // Storage abstraction
  // --------------------------------------------------

  function resolveStorage(type) {
    if (
      type !== STORAGE_TYPES.LOCAL &&
      type !== STORAGE_TYPES.SESSION
    ) {
      throw new TypeError("Unsupported storage type.");
    }

    return type === STORAGE_TYPES.SESSION
      ? window.sessionStorage
      : window.localStorage;
  }

  function storageKey(key) {
    return config.storagePrefix + key;
  }

  var storage = {
    get: function (key, type) {
      type = type || STORAGE_TYPES.LOCAL;

      if (!types.isNonEmptyString(key)) return null;

      try {
        return resolveStorage(type).getItem(storageKey(key));
      } catch (error) {
        logger.warn("Storage read failed", {
          key: key,
          type: type,
          message: error.message
        });

        return null;
      }
    },

    set: function (key, value, type) {
      type = type || STORAGE_TYPES.LOCAL;

      if (!types.isNonEmptyString(key)) return false;
      if (value === undefined || value === null) return false;

      try {
        resolveStorage(type).setItem(
          storageKey(key),
          String(value)
        );

        return true;
      } catch (error) {
        logger.warn("Storage write failed", {
          key: key,
          type: type,
          message: error.message
        });

        return false;
      }
    },

    getJSON: function (key, type) {
      var value = this.get(key, type);

      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch (error) {
        logger.warn("Stored JSON is invalid", {
          key: key,
          message: error.message
        });

        return null;
      }
    },

    setJSON: function (key, value, type) {
      try {
        var serialized = JSON.stringify(value);

        if (serialized === undefined) return false;

        return this.set(key, serialized, type);
      } catch (error) {
        logger.warn("JSON serialization failed", {
          key: key,
          message: error.message
        });

        return false;
      }
    },

    remove: function (key, type) {
      type = type || STORAGE_TYPES.LOCAL;

      if (!types.isNonEmptyString(key)) return false;

      try {
        resolveStorage(type).removeItem(storageKey(key));
        return true;
      } catch (error) {
        logger.warn("Storage removal failed", {
          key: key,
          type: type,
          message: error.message
        });

        return false;
      }
    },

    clear: function (type) {
      type = type || STORAGE_TYPES.LOCAL;

      try {
        var target = resolveStorage(type);
        var keys = [];

        for (var index = 0; index < target.length; index += 1) {
          var key = target.key(index);

          if (key && key.indexOf(config.storagePrefix) === 0) {
            keys.push(key);
          }
        }

        keys.forEach(function (key) {
          target.removeItem(key);
        });

        return true;
      } catch (error) {
        logger.warn("Storage cleanup failed", {
          type: type,
          message: error.message
        });

        return false;
      }
    }
  };

  // --------------------------------------------------
  // Shared event bus
  // --------------------------------------------------

  var eventListeners = new Map();

  var events = {
    on: function (name, callback) {
      if (!types.isNonEmptyString(name)) {
        throw new TypeError("Event name is required.");
      }

      if (!types.isFunction(callback)) {
        throw new TypeError("Event callback must be a function.");
      }

      if (!eventListeners.has(name)) {
        eventListeners.set(name, new Set());
      }

      var listeners = eventListeners.get(name);
      listeners.add(callback);

      var subscribed = true;

      return function unsubscribe() {
        if (!subscribed) return false;

        subscribed = false;
        listeners.delete(callback);

        if (listeners.size === 0) {
          eventListeners.delete(name);
        }

        return true;
      };
    },

    once: function (name, callback) {
      if (!types.isFunction(callback)) {
        throw new TypeError("Event callback must be a function.");
      }

      var unsubscribe = null;

      var wrapper = function (detail) {
        if (unsubscribe) unsubscribe();
        callback(detail);
      };

      unsubscribe = this.on(name, wrapper);

      return unsubscribe;
    },

    emit: function (name, detail) {
      if (!types.isNonEmptyString(name)) {
        throw new TypeError("Event name is required.");
      }

      var listeners = eventListeners.get(name);

      if (!listeners) return 0;

      var delivered = 0;

      Array.from(listeners).forEach(function (callback) {
        try {
          callback(detail === undefined ? {} : detail);
          delivered += 1;
        } catch (error) {
          logger.error('Listener failed for "' + name + '"', {
            message: error.message
          });
        }
      });

      return delivered;
    },

    off: function (name, callback) {
      var listeners = eventListeners.get(name);

      if (!listeners) return false;

      var removed = listeners.delete(callback);

      if (listeners.size === 0) {
        eventListeners.delete(name);
      }

      return removed;
    },

    clear: function (name) {
      if (name === undefined) {
        eventListeners.clear();
        return;
      }

      eventListeners.delete(name);
    }
  };

  // --------------------------------------------------
  // Debounce and throttle
  // --------------------------------------------------

  var timing = {
    debounce: function (callback, delay) {
      if (!types.isFunction(callback)) {
        throw new TypeError("Debounce callback must be a function.");
      }

      delay = delay === undefined ? config.debounceDelay : delay;
      delay = Math.max(0, Number(delay) || 0);

      var timerId = null;
      var lastContext;
      var lastArgs;

      function debounced() {
        lastContext = this;
        lastArgs = Array.prototype.slice.call(arguments);

        window.clearTimeout(timerId);

        timerId = window.setTimeout(function () {
          timerId = null;
          callback.apply(lastContext, lastArgs);
          lastContext = lastArgs = null;
        }, delay);
      }

      debounced.cancel = function () {
        window.clearTimeout(timerId);
        timerId = null;
        lastContext = lastArgs = null;
      };

      debounced.flush = function () {
        if (timerId === null) return;

        window.clearTimeout(timerId);
        timerId = null;

        callback.apply(lastContext, lastArgs || []);

        lastContext = lastArgs = null;
      };

      return debounced;
    },

    throttle: function (callback, delay) {
      if (!types.isFunction(callback)) {
        throw new TypeError("Throttle callback must be a function.");
      }

      delay = delay === undefined ? config.throttleDelay : delay;
      delay = Math.max(0, Number(delay) || 0);

      var lastRun = 0;
      var timerId = null;
      var lastArgs = null;
      var lastContext = null;

      function throttled() {
        var now = Date.now();
        var remaining = delay - (now - lastRun);

        lastArgs = Array.prototype.slice.call(arguments);
        lastContext = this;

        if (remaining <= 0) {
          if (timerId !== null) {
            window.clearTimeout(timerId);
            timerId = null;
          }

          lastRun = now;

          callback.apply(lastContext, lastArgs);

          lastArgs = lastContext = null;
        } else if (timerId === null) {
          timerId = window.setTimeout(function () {
            timerId = null;
            lastRun = Date.now();

            callback.apply(lastContext, lastArgs || []);

            lastArgs = lastContext = null;
          }, remaining);
        }
      }

      throttled.cancel = function () {
        window.clearTimeout(timerId);

        timerId = null;
        lastRun = 0;
        lastArgs = lastContext = null;
      };

      return throttled;
    },

    sleep: function (milliseconds) {
      var duration = Math.max(0, Number(milliseconds) || 0);

      return new Promise(function (resolve) {
        window.setTimeout(resolve, duration);
      });
    }
  };

  // --------------------------------------------------
  // ID generation
  // --------------------------------------------------

  var ids = {
    uuid: function () {
      var cryptoObject = window.crypto;

      if (
        cryptoObject &&
        typeof cryptoObject.randomUUID === "function"
      ) {
        return cryptoObject.randomUUID();
      }

      if (
        cryptoObject &&
        typeof cryptoObject.getRandomValues === "function"
      ) {
        var bytes = new Uint8Array(16);

        cryptoObject.getRandomValues(bytes);

        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        var hex = Array.prototype.map.call(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        });

        return [
          hex.slice(0, 4).join(""),
          hex.slice(4, 6).join(""),
          hex.slice(6, 8).join(""),
          hex.slice(8, 10).join(""),
          hex.slice(10, 16).join("")
        ].join("-");
      }

      throw new Error("Secure random number generation is unavailable.");
    },

    short: function (prefix) {
      return String(prefix || "mo") + "-" + this.uuid();
    }
  };

  // --------------------------------------------------
  // Formatting
  // --------------------------------------------------

  var format = {
    number: function (value, options) {
      options = options || {};

      var number = Number(value);

      if (!Number.isFinite(number)) return "--";

      try {
        var locale = options.locale || config.locale;
        var settings = Object.assign({}, options);

        delete settings.locale;

        return new Intl.NumberFormat(locale, settings).format(number);
      } catch (error) {
        return String(number);
      }
    },

    currency: function (value, options) {
      options = options || {};

      var number = Number(value);

      if (!Number.isFinite(number)) return "--";

      var locale = options.locale || config.locale;
      var currency = options.currency || config.currency;
      var settings = Object.assign(
        {
          style: "currency",
          currency: currency,
          maximumFractionDigits: 2
        },
        options
      );

      delete settings.locale;

      try {
        return new Intl.NumberFormat(locale, settings).format(number);
      } catch (error) {
        return config.currencySymbol + number.toFixed(2);
      }
    },

    date: function (value, options) {
      options = options || {};

      var date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) return "--";

      try {
        var locale = options.locale || config.locale;
        var settings = Object.assign(
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: config.timeZone
          },
          options
        );

        delete settings.locale;

        return new Intl.DateTimeFormat(locale, settings).format(date);
      } catch (error) {
        return date.toISOString().slice(0, 10);
      }
    },

    relativeTime: function (value, options) {
      options = options || {};

      var date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) return "--";

      var seconds = Math.round((date.getTime() - Date.now()) / 1000);
      var units = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
        ["second", 1]
      ];

      try {
        var formatter = new Intl.RelativeTimeFormat(
          options.locale || config.locale,
          { numeric: "auto" }
        );

        for (var i = 0; i < units.length; i += 1) {
          var unit = units[i];

          if (Math.abs(seconds) >= unit[1] || unit[0] === "second") {
            return formatter.format(Math.round(seconds / unit[1]), unit[0]);
          }
        }
      } catch (error) {
        // Fall through to a plain-text fallback.
      }

      return date.toISOString().slice(0, 10);
    },

    truncate: function (value, maxLength, suffix) {
      var text = String(value == null ? "" : value);
      var limit = maxLength === undefined ? 100 : Math.max(0, Number(maxLength) || 0);
      var ending = suffix === undefined ? "…" : String(suffix);

      if (text.length <= limit) return text;
      if (limit === 0) return "";
      if (limit <= ending.length) return ending.slice(0, limit);

      return text.slice(0, limit - ending.length).trimEnd() + ending;
    },

    capitalize: function (value) {
      var text = String(value == null ? "" : value).trim();

      if (!text) return "";

      return text.charAt(0).toLocaleUpperCase(config.locale) + text.slice(1);
    },

    initials: function (value, maxCharacters) {
      var limit = Math.max(1, Number(maxCharacters) || 2);

      return String(value == null ? "" : value)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, limit)
        .map(function (part) {
          return Array.from(part)[0] || "";
        })
        .join("")
        .toLocaleUpperCase(config.locale);
    }
  };

  // --------------------------------------------------
  // String helpers
  // --------------------------------------------------

  var strings = {
    slug: function (value) {
      return String(value == null ? "" : value)
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    },

    escapeHTML: function (value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[character];
      });
    },

    normalizeWhitespace: function (value) {
      return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
    },

    stripControlCharacters: function (value) {
      return String(value == null ? "" : value).replace(/[\u0000-\u001F\u007F]/g, "");
    }
  };

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------

  var validators = {
    email: function (value) {
      if (typeof value !== "string") return false;

      var email = value.trim();

      return email.length <= 254 &&
        !/\s/.test(email) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    phone: function (value) {
      if (typeof value !== "string") return false;

      var normalized = value.replace(/[\s().-]/g, "");

      return /^\+?[0-9]{7,15}$/.test(normalized);
    },

    url: function (value, options) {
      options = options || {};

      if (!types.isNonEmptyString(value)) return false;

      try {
        var parsed = new URL(value);

        return (
          parsed.protocol === "https:" ||
          parsed.protocol === "http:"
        );
      } catch (error) {
        if (!options.allowRelative) return false;

        return (
          value.charAt(0) === "/" &&
          value.indexOf("//") !== 0 &&
          value.indexOf("\\") === -1 &&
          !/[?#]/.test(value) &&
          !/(^|\/)\.\.?($|\/)/.test(value)
        );
      }
    },

    required: function (value) {
      if (value === null || value === undefined) return false;

      if (typeof value === "string") return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;

      return true;
    },

    length: function (value, options) {
      options = options || {};

      var text = String(value == null ? "" : value);
      var min = options.min === undefined ? 0 : options.min;
      var max = options.max === undefined ? Infinity : options.max;

      return text.length >= min && text.length <= max;
    }
  };

  // --------------------------------------------------
  // URL and query helpers
  // --------------------------------------------------

  var url = {
    parse: function (value, base) {
      try {
        return new URL(value, base || window.location.href);
      } catch (error) {
        return null;
      }
    },

    getQuery: function (name) {
      if (!types.isNonEmptyString(name)) return null;

      return new URLSearchParams(window.location.search).get(name);
    },

    getAllQuery: function (name) {
      if (!types.isNonEmptyString(name)) return [];

      return new URLSearchParams(window.location.search).getAll(name);
    },

    build: function (path, parameters) {
      parameters = parameters || {};

      var parsed = this.parse(path);

      if (!parsed) return "";
      if (!types.isPlainObject(parameters)) return parsed.toString();

      Object.keys(parameters).forEach(function (key) {
        var value = parameters[key];

        if (value === null || value === undefined) {
          parsed.searchParams.delete(key);
        } else if (Array.isArray(value)) {
          parsed.searchParams.delete(key);

          value.forEach(function (item) {
            parsed.searchParams.append(key, String(item));
          });
        } else {
          parsed.searchParams.set(key, String(value));
        }
      });

      return parsed.toString();
    },

    isSameOrigin: function (value) {
      var parsed = this.parse(value);

      return parsed !== null && parsed.origin === window.location.origin;
    }
  };

  // --------------------------------------------------
  // Object and JSON helpers
  // --------------------------------------------------

  var objects = {
    safeParseJSON: function (value, fallback) {
      fallback = fallback === undefined ? null : fallback;

      if (typeof value !== "string") return fallback;

      try {
        return JSON.parse(value);
      } catch (error) {
        return fallback;
      }
    },

    clone: function (value) {
      if (typeof window.structuredClone === "function") {
        return window.structuredClone(value);
      }

      var serialized = JSON.stringify(value);

      if (serialized === undefined) {
        throw new TypeError("Value cannot be cloned as JSON.");
      }

      return JSON.parse(serialized);
    },

    pick: function (source, keys) {
      keys = Array.isArray(keys) ? keys : [];

      if (!types.isPlainObject(source)) return {};

      var result = {};

      keys.forEach(function (key) {
        if (
          typeof key === "string" &&
          Object.prototype.hasOwnProperty.call(source, key)
        ) {
          result[key] = source[key];
        }
      });

      return result;
    },

    omit: function (source, keys) {
      keys = Array.isArray(keys) ? keys : [];

      if (!types.isPlainObject(source)) return {};

      var excluded = new Set(keys);

      return Object.keys(source).reduce(function (result, key) {
        if (!excluded.has(key)) {
          result[key] = source[key];
        }

        return result;
      }, {});
    }
  };

  // --------------------------------------------------
  // Browser utilities
  // --------------------------------------------------

  var browser = {
    get online() {
      return window.navigator.onLine;
    },

    get language() {
      return window.navigator.language || config.locale;
    },

    get reducedMotion() {
      return window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    },

    get touchDevice() {
      return (
        window.navigator.maxTouchPoints > 0 ||
        "ontouchstart" in window
      );
    },

    get standalone() {
      return (
        (window.matchMedia &&
          window.matchMedia("(display-mode: standalone)").matches) ||
        window.navigator.standalone === true
      );
    },

    onOnline: function (callback) {
      if (!types.isFunction(callback)) {
        throw new TypeError("Online callback must be a function.");
      }

      window.addEventListener("online", callback);

      return function unsubscribe() {
        window.removeEventListener("online", callback);
      };
    },

    onOffline: function (callback) {
      if (!types.isFunction(callback)) {
        throw new TypeError("Offline callback must be a function.");
      }

      window.addEventListener("offline", callback);

      return function unsubscribe() {
        window.removeEventListener("offline", callback);
      };
    }
  };

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  var core = Object.freeze({
    config: config,
    environments: ENVIRONMENTS,
    storageTypes: STORAGE_TYPES,
    storageKeys: STORAGE_KEYS,
    httpStatus: HTTP_STATUS,

    logger: logger,
    types: types,
    dom: dom,
    storage: storage,
    events: events,
    timing: timing,
    ids: ids,
    format: format,
    strings: strings,
    validators: validators,
    url: url,
    objects: objects,
    browser: browser,

    get ready() {
      return document.readyState !== "loading";
    }
  });

  Object.defineProperty(window, "MedOrbitsCore", {
    value: core,
    enumerable: true,
    configurable: false,
    writable: false
  });

  logger.info("Core runtime loaded", {
    version: config.version,
    environment: environment
  });
})(window, document);
