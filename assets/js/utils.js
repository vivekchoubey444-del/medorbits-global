
/* =========================================================
   MEDORBITS | SHARED UTILITIES
   File: assets/js/utils.js
   Version: 1.0.0
   Dependencies: None
   Namespace: window.MedOrbitsUtils
   ========================================================= */

(function MedOrbitsUtilsModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_UTILS_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    locale: "en-IN",
    currency: "INR",
    dateFormat: {
      year: "numeric",
      month: "short",
      day: "numeric"
    },
    maxStringLength: 10000
  };

  var state = {
    config: Object.assign({}, DEFAULTS),
    listeners: [],
    destroyed: false
  };

  /* ---------------------------------------------------------
     STRING UTILITIES
     --------------------------------------------------------- */

  function cleanString(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, Math.min(
        Number.isFinite(maxLength) && maxLength >= 0
          ? maxLength
          : state.config.maxStringLength,
        state.config.maxStringLength
      ));
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function capitalize(value) {
    var string = cleanString(value).trim();

    if (!string) return "";

    return string.charAt(0).toLocaleUpperCase(state.config.locale) +
      string.slice(1);
  }

  function titleCase(value) {
    return cleanString(value).toLocaleLowerCase(state.config.locale)
      .replace(/(^|[\s\-_/])([^\s\-_/])/g, function (_, separator, letter) {
        return separator + letter.toLocaleUpperCase(state.config.locale);
      });
  }

  function slugify(value) {
    return cleanString(value, 500)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function truncate(value, maxLength, suffix) {
    var string = cleanString(value);
    var limit = Number(maxLength);

    if (!Number.isInteger(limit) || limit < 0) {
      limit = 100;
    }

    suffix = suffix == null ? "…" : String(suffix);

    if (string.length <= limit) return string;

    if (limit <= suffix.length) return suffix.slice(0, limit);

    return string.slice(0, limit - suffix.length).trimEnd() + suffix;
  }

  function normalizeWhitespace(value) {
    return cleanString(value).replace(/\s+/g, " ").trim();
  }

  function initials(value, maxInitials) {
    var words = normalizeWhitespace(value).split(" ").filter(Boolean);
    var limit = Number.isInteger(maxInitials) && maxInitials > 0
      ? Math.min(maxInitials, 10)
      : 2;

    return words.slice(0, limit).map(function (word) {
      return word.charAt(0).toLocaleUpperCase(state.config.locale);
    }).join("");
  }

  /* ---------------------------------------------------------
     DOM UTILITIES
     --------------------------------------------------------- */

  function $(selector, root) {
    if (selector instanceof Element || selector === document) {
      return selector;
    }

    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function $$(selector, root) {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function createElement(tag, options) {
    options = options || {};

    if (!/^[a-z][a-z0-9-]*$/i.test(tag)) {
      throw new TypeError("Invalid HTML element name.");
    }

    var element = document.createElement(tag);

    if (options.className) {
      element.className = cleanString(options.className, 500);
    }

    if (options.text != null) {
      element.textContent = cleanString(options.text);
    }

    if (options.id) {
      element.id = cleanString(options.id, 200);
    }

    if (options.attributes && typeof options.attributes === "object") {
      Object.keys(options.attributes).forEach(function (name) {
        if (!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(name)) return;

        var value = options.attributes[name];

        if (value == null || value === false) return;

        if (name.toLowerCase().startsWith("on")) return;

        if (name === "href" || name === "src" || name === "action") {
          var safe = safeURL(value);

          if (!safe) return;

          element.setAttribute(name, safe);
          return;
        }

        if (value === true) {
          element.setAttribute(name, "");
        } else {
          element.setAttribute(name, cleanString(value, 1000));
        }
      });
    }

    return element;
  }

  function setText(element, value) {
    if (!element || !("textContent" in element)) return false;

    element.textContent = cleanString(value);
    return true;
  }

  function setHTML(element, value) {
    if (!element || !("innerHTML" in element)) return false;

    // Only use with trusted, application-authored HTML.
    element.innerHTML = String(value == null ? "" : value);
    return true;
  }

  function show(element) {
    if (!element) return false;

    element.hidden = false;
    element.removeAttribute("aria-hidden");

    return true;
  }

  function hide(element) {
    if (!element) return false;

    element.hidden = true;
    element.setAttribute("aria-hidden", "true");

    return true;
  }

  function toggle(element, force) {
    if (!element) return false;

    var shouldShow = typeof force === "boolean" ? force : element.hidden;

    if (shouldShow) show(element);
    else hide(element);

    return shouldShow;
  }

  function on(element, eventName, handler, options) {
    if (!element || typeof element.addEventListener !== "function") {
      return function () {};
    }

    element.addEventListener(eventName, handler, options || false);

    var removed = false;

    function off() {
      if (removed) return;

      element.removeEventListener(eventName, handler, options || false);
      removed = true;
    }

    state.listeners.push(off);

    return off;
  }

  function ready(callback) {
    if (typeof callback !== "function") return;

    if (document.readyState !== "loading") {
      callback();
    } else {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    }
  }

  /* ---------------------------------------------------------
     URL AND ID UTILITIES
     --------------------------------------------------------- */

  function safeURL(value, options) {
    options = options || {};

    if (typeof value !== "string" || !value.trim()) return "";

    try {
      var url = new URL(value, window.location.href);
      var protocols = options.protocols || ["https:", "http:"];

      if (!protocols.includes(url.protocol)) return "";

      if (options.sameOrigin && url.origin !== window.location.origin) {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function randomId(prefix) {
    var id;

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      id = window.crypto.randomUUID();
    } else if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);

      id = Array.from(bytes).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    } else {
      id = Date.now().toString(36) +
        Math.random().toString(36).slice(2, 12);
    }

    return (prefix ? slugify(prefix) + "-" : "") + id;
  }

  function isExternalURL(value) {
    var url = safeURL(value);

    if (!url) return false;

    return new URL(url).origin !== window.location.origin;
  }

  /* ---------------------------------------------------------
     VALIDATION UTILITIES
     --------------------------------------------------------- */

  function isEmail(value) {
    var email = cleanString(value, 254).trim();

    if (!email || /\s/.test(email)) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isPhone(value, options) {
    options = options || {};

    var input = cleanString(value, 50).trim();
    var digits = input.replace(/\D/g, "");
    var minDigits = options.minDigits || 7;
    var maxDigits = options.maxDigits || 15;

    return digits.length >= minDigits &&
      digits.length <= maxDigits &&
      /^[+\d\s().-]+$/.test(input);
  }

  function isStrongPassword(value, options) {
    options = options || {};

    var password = String(value == null ? "" : value);
    var minLength = options.minLength || 8;

    if (password.length < minLength) return false;

    if (options.requireUppercase && !/[A-Z]/.test(password)) return false;
    if (options.requireLowercase && !/[a-z]/.test(password)) return false;
    if (options.requireNumber && !/\d/.test(password)) return false;
    if (options.requireSymbol && !/[^A-Za-z0-9]/.test(password)) return false;

    return true;
  }

  function isValidNumber(value, options) {
    options = options || {};

    if (value === "" || value == null) return false;

    var number = Number(value);

    if (!Number.isFinite(number)) return false;
    if (options.min != null && number < options.min) return false;
    if (options.max != null && number > options.max) return false;
    if (options.integer && !Number.isInteger(number)) return false;

    return true;
  }

  /* ---------------------------------------------------------
     DATE AND CURRENCY UTILITIES
     --------------------------------------------------------- */

  function parseDate(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }

    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    var date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value, options) {
    var date = parseDate(value);

    if (!date) return "";

    try {
      return new Intl.DateTimeFormat(
        (options && options.locale) || state.config.locale,
        (options && options.format) || DEFAULTS.dateFormat
      ).format(date);
    } catch (error) {
      return date.toISOString().slice(0, 10);
    }
  }

  function formatDateTime(value, options) {
    var date = parseDate(value);

    if (!date) return "";

    try {
      return new Intl.DateTimeFormat(
        (options && options.locale) || state.config.locale,
        (options && options.format) || {
          dateStyle: "medium",
          timeStyle: "short"
        }
      ).format(date);
    } catch (error) {
      return date.toISOString();
    }
  }

  function formatCurrency(value, options) {
    var amount = Number(value);

    if (!Number.isFinite(amount)) return "";

    options = options || {};

    try {
      return new Intl.NumberFormat(
        options.locale || state.config.locale,
        {
          style: "currency",
          currency: options.currency || state.config.currency,
          maximumFractionDigits: options.maximumFractionDigits == null
            ? 2
            : options.maximumFractionDigits,
          minimumFractionDigits: options.minimumFractionDigits
        }
      ).format(amount);
    } catch (error) {
      return amount.toFixed(2) + " " +
        (options.currency || state.config.currency);
    }
  }

  function formatNumber(value, options) {
    var number = Number(value);

    if (!Number.isFinite(number)) return "";

    options = options || {};

    try {
      return new Intl.NumberFormat(
        options.locale || state.config.locale,
        options.format || {}
      ).format(number);
    } catch (error) {
      return String(number);
    }
  }

  /* ---------------------------------------------------------
     ASYNC UTILITIES
     --------------------------------------------------------- */

  function debounce(callback, delay) {
    var timer = null;

    function debounced() {
      var context = this;
      var args = arguments;

      window.clearTimeout(timer);

      timer = window.setTimeout(function () {
        callback.apply(context, args);
      }, Math.max(0, Number(delay) || 0));
    }

    debounced.cancel = function () {
      window.clearTimeout(timer);
      timer = null;
    };

    debounced.flush = function () {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
        callback();
      }
    };

    return debounced;
  }

  function throttle(callback, delay) {
    var lastRun = 0;
    var timer = null;

    return function () {
      var context = this;
      var args = arguments;
      var now = Date.now();
      var wait = Math.max(0, Number(delay) || 0);
      var remaining = wait - (now - lastRun);

      if (remaining <= 0) {
        window.clearTimeout(timer);
        timer = null;
        lastRun = now;
        callback.apply(context, args);
      } else if (timer === null) {
        timer = window.setTimeout(function () {
          lastRun = Date.now();
          timer = null;
          callback.apply(context, args);
        }, remaining);
      }
    };
  }

  function sleep(milliseconds, signal) {
    var delay = Math.max(0, Number(milliseconds) || 0);

    return new Promise(function (resolve, reject) {
      if (signal && signal.aborted) {
        reject(new DOMException("Operation aborted.", "AbortError"));
        return;
      }

      var timer = window.setTimeout(function () {
        cleanup();
        resolve();
      }, delay);

      function abort() {
        window.clearTimeout(timer);
        cleanup();
        reject(new DOMException("Operation aborted.", "AbortError"));
      }

      function cleanup() {
        if (signal) {
          signal.removeEventListener("abort", abort);
        }
      }

      if (signal) {
        signal.addEventListener("abort", abort, { once: true });
      }
    });
  }

  /* ---------------------------------------------------------
     STORAGE UTILITIES
     --------------------------------------------------------- */

  function getStorage(type) {
    try {
      var storage = type === "local" ? window.localStorage : window.sessionStorage;
      var testKey = "__medorbits_storage_test__";

      storage.setItem(testKey, "1");
      storage.removeItem(testKey);

      return storage;
    } catch (error) {
      return null;
    }
  }

  function storageGet(key, options) {
    options = options || {};

    var storage = getStorage(options.type || "session");

    if (!storage) return null;

    try {
      var value = storage.getItem(String(key));

      if (value === null) return null;

      if (options.json) {
        return JSON.parse(value);
      }

      return value;
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value, options) {
    options = options || {};

    var storage = getStorage(options.type || "session");

    if (!storage) return false;

    try {
      var serialized = options.json
        ? JSON.stringify(value)
        : String(value);

      storage.setItem(String(key), serialized);
      return true;
    } catch (error) {
      return false;
    }
  }

  function storageRemove(key, options) {
    options = options || {};

    var storage = getStorage(options.type || "session");

    if (!storage) return false;

    try {
      storage.removeItem(String(key));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ---------------------------------------------------------
     OBJECT AND ARRAY UTILITIES
     --------------------------------------------------------- */

  function clone(value) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (error) {
        // Use JSON-compatible fallback.
      }
    }

    if (value === undefined) return undefined;

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function unique(values, key) {
    if (!Array.isArray(values)) return [];

    var seen = new Set();

    return values.filter(function (item) {
      var value = key && item && typeof item === "object"
        ? item[key]
        : item;

      if (value == null || seen.has(value)) return false;

      seen.add(value);
      return true;
    });
  }

  function sortBy(values, key, direction) {
    if (!Array.isArray(values)) return [];

    var multiplier = direction === "desc" ? -1 : 1;

    return values.slice().sort(function (a, b) {
      var valueA = key && a ? a[key] : a;
      var valueB = key && b ? b[key] : b;

      if (valueA == null) return 1;
      if (valueB == null) return -1;

      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * multiplier;
      }

      return String(valueA).localeCompare(String(valueB), state.config.locale) *
        multiplier;
    });
  }

  function getNestedValue(object, path, fallback) {
    if (!path) return fallback;

    var result = String(path).split(".").reduce(function (current, key) {
      if (current == null || !Object.prototype.hasOwnProperty.call(current, key)) {
        return undefined;
      }

      return current[key];
    }, object);

    return result === undefined || result === null ? fallback : result;
  }

  /* ---------------------------------------------------------
     GENERAL HELPERS
     --------------------------------------------------------- */

  function copyText(value) {
    var text = String(value == null ? "" : value);

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");

      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();

      var successful = false;

      try {
        successful = document.execCommand("copy");
      } catch (error) {
        successful = false;
      }

      textarea.remove();

      if (successful) resolve(true);
      else reject(new Error("Copying text is not supported."));
    });
  }

  function announce(message, options) {
    options = options || {};

    var region = document.querySelector("[data-mo-live-region]");

    if (!region) {
      region = document.createElement("div");
      region.setAttribute("data-mo-live-region", "");
      region.setAttribute("aria-live", options.urgent ? "assertive" : "polite");
      region.setAttribute("aria-atomic", "true");
      region.className = "mo-utils-visually-hidden";
      document.body.appendChild(region);
    }

    region.setAttribute("aria-live", options.urgent ? "assertive" : "polite");
    region.textContent = "";

    window.setTimeout(function () {
      if (region.isConnected) {
        region.textContent = cleanString(message, 1000);
      }
    }, 20);
  }

  function refresh() {
    if (state.destroyed) return;

    document.querySelectorAll("[data-mo-utils-ready]").forEach(function (element) {
      element.setAttribute("data-mo-utils-ready", "true");
    });
  }

  function configure(options) {
    options = options || {};

    if (typeof options.locale === "string" && options.locale.trim()) {
      state.config.locale = options.locale;
    }

    if (typeof options.currency === "string" && options.currency.trim()) {
      state.config.currency = options.currency;
    }

    if (Number.isInteger(options.maxStringLength) && options.maxStringLength > 0) {
      state.config.maxStringLength = Math.min(options.maxStringLength, 100000);
    }

    return clone(state.config);
  }

  function destroy() {
    if (state.destroyed) return;

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",

    // Strings
    cleanString: cleanString,
    escapeHTML: escapeHTML,
    capitalize: capitalize,
    titleCase: titleCase,
    slugify: slugify,
    truncate: truncate,
    normalizeWhitespace: normalizeWhitespace,
    initials: initials,

    // DOM
    $: $,
    $$: $$,
    createElement: createElement,
    setText: setText,
    setHTML: setHTML,
    show: show,
    hide: hide,
    toggle: toggle,
    on: on,
    ready: ready,

    // URL and IDs
    safeURL: safeURL,
    isExternalURL: isExternalURL,
    randomId: randomId,

    // Validation
    isEmail: isEmail,
    isPhone: isPhone,
    isStrongPassword: isStrongPassword,
    isValidNumber: isValidNumber,

    // Formatting
    parseDate: parseDate,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatCurrency: formatCurrency,
    formatNumber: formatNumber,

    // Async
    debounce: debounce,
    throttle: throttle,
    sleep: sleep,

    // Storage
    storageGet: storageGet,
    storageSet: storageSet,
    storageRemove: storageRemove,

    // Objects and arrays
    clone: clone,
    unique: unique,
    sortBy: sortBy,
    getNestedValue: getNestedValue,

    // General
    copyText: copyText,
    announce: announce,
    configure: configure,
    refresh: refresh,
    destroy: destroy
  };

  window.__MEDORBITS_UTILS_V1__ = api;
  window.MedOrbitsUtils = api;

  ready(refresh);
})();
