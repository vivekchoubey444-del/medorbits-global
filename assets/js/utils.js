
/* =========================================================
   MedOrbits -- Utility Helpers
   File: /assets/js/utils.js
   ========================================================= */

(function (window, document) {
  "use strict";

  var CONFIG = window.MedOrbitsConfig || {};

  var DEFAULTS = Object.freeze({
    currency: CONFIG.CURRENCY || CONFIG.currency || "INR",
    locale: CONFIG.LOCALE || CONFIG.locale || "en-IN",
    dateFormat: CONFIG.DATE_FORMAT || CONFIG.dateFormat || "medium"
  });

  var EVENTS = Object.freeze({
    READY: "medorbits:utils:ready",
    ERROR: "medorbits:utils:error"
  });

  function emit(name, detail) {
    try {
      document.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (error) {
      // Utilities should remain usable when custom events are unavailable.
    }
  }

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function isPlainObject(value) {
    if (!isObject(value)) return false;

    var prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  }

  function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;

    return false;
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

  function stripHTML(value) {
    var template = document.createElement("template");
    template.innerHTML = String(value == null ? "" : value);

    return (template.content.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function capitalize(value) {
    var text = String(value == null ? "" : value).trim();

    return text
      ? text.charAt(0).toUpperCase() + text.slice(1)
      : "";
  }

  function titleCase(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .replace(/\b([a-z])/g, function (match) {
        return match.toUpperCase();
      });
  }

  function toSlug(value) {
    var text = String(value == null ? "" : value).trim().toLowerCase();

    if (typeof text.normalize === "function") {
      text = text.normalize("NFKD");
    }

    return text
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function truncate(value, limit, suffix) {
    var text = String(value == null ? "" : value);
    var max = Math.max(0, Math.floor(Number(limit) || 0));
    var ending = suffix === undefined ? "…" : String(suffix);

    if (text.length <= max) return text;
    if (max === 0) return "";
    if (max <= ending.length) return ending.slice(0, max);

    return text.slice(0, max - ending.length).replace(/\s+$/, "") + ending;
  }

  function clamp(value, min, max) {
    var number = Number(value);
    var lower = Number(min);
    var upper = Number(max);

    if (
      !Number.isFinite(number) ||
      !Number.isFinite(lower) ||
      !Number.isFinite(upper) ||
      lower > upper
    ) {
      return null;
    }

    return Math.min(upper, Math.max(lower, number));
  }

  function randomId(prefix) {
    var name = String(prefix || "mo");
    var cryptoObject = window.crypto;
    var id;

    if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
      id = cryptoObject.randomUUID();
    } else if (
      cryptoObject &&
      typeof cryptoObject.getRandomValues === "function"
    ) {
      var bytes = new Uint8Array(16);
      cryptoObject.getRandomValues(bytes);

      id = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("");
    } else {
      id = Date.now().toString(36) +
        Math.random().toString(36).slice(2);
    }

    return name + "-" + id;
  }

  function formatCurrency(amount, currency, locale) {
    var value = Number(amount);
    currency = currency || DEFAULTS.currency;

    if (!Number.isFinite(value)) return "--";

    try {
      return new Intl.NumberFormat(locale || DEFAULTS.locale, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 2
      }).format(value);
    } catch (error) {
      return value.toFixed(2) + " " + currency;
    }
  }

  function formatNumber(value, options) {
    var number = Number(value);
    options = options || {};

    if (!Number.isFinite(number)) return "--";

    try {
      var settings = {};
      Object.keys(options).forEach(function (key) {
        if (key !== "locale") settings[key] = options[key];
      });

      return new Intl.NumberFormat(
        options.locale || DEFAULTS.locale,
        settings
      ).format(number);
    } catch (error) {
      return String(number);
    }
  }

  function formatCompactNumber(value, locale) {
    var number = Number(value);

    if (!Number.isFinite(number)) return "--";

    try {
      return new Intl.NumberFormat(locale || DEFAULTS.locale, {
        notation: "compact",
        maximumFractionDigits: 1
      }).format(number);
    } catch (error) {
      return String(number);
    }
  }

  function formatDate(value, options) {
    if (value === undefined || value === null || value === "") return "--";

    var date = value instanceof Date ? value : new Date(value);

    if (!Number.isFinite(date.getTime())) return "--";

    options = options || {};

    var locale = options.locale || DEFAULTS.locale;
    var settings = {};
    var hasDateStyle = options.dateStyle || DEFAULTS.dateFormat;

    Object.keys(options).forEach(function (key) {
      if (key !== "locale") settings[key] = options[key];
    });

    if (!settings.dateStyle && !settings.year && !settings.month &&
        !settings.day) {
      settings.dateStyle = hasDateStyle;
    }

    try {
      return new Intl.DateTimeFormat(locale, settings).format(date);
    } catch (error) {
      return date.toLocaleDateString(locale);
    }
  }

  function formatDateTime(value, locale) {
    return formatDate(value, {
      locale: locale || DEFAULTS.locale,
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function formatRelativeTime(value, locale) {
    if (value === undefined || value === null || value === "") return "--";

    var date = value instanceof Date ? value : new Date(value);

    if (!Number.isFinite(date.getTime())) return "--";

    var difference = date.getTime() - Date.now();
    var seconds = Math.round(difference / 1000);
    var minutes = Math.round(seconds / 60);
    var hours = Math.round(minutes / 60);
    var days = Math.round(hours / 24);

    var amount = seconds;
    var unit = "second";

    if (Math.abs(days) >= 1) {
      amount = days;
      unit = "day";
    } else if (Math.abs(hours) >= 1) {
      amount = hours;
      unit = "hour";
    } else if (Math.abs(minutes) >= 1) {
      amount = minutes;
      unit = "minute";
    }

    try {
      return new Intl.RelativeTimeFormat(locale || DEFAULTS.locale, {
        numeric: "auto"
      }).format(amount, unit);
    } catch (error) {
      return formatDate(date);
    }
  }

  function formatBytes(bytes, decimals) {
    var value = Number(bytes);
    var precision = Math.max(0, Math.floor(Number(decimals) || 0));

    if (!Number.isFinite(value) || value < 0) return "--";
    if (value === 0) return "0 Bytes";

    var units = ["Bytes", "KB", "MB", "GB", "TB", "PB"];
    var index = Math.min(
      Math.floor(Math.log(value) / Math.log(1024)),
      units.length - 1
    );

    var formatted = value / Math.pow(1024, index);

    return formatted.toFixed(index === 0 ? 0 : precision) +
      " " + units[index];
  }

  function normalizePhone(value) {
    return String(value == null ? "" : value)
      .trim()
      .replace(/[^\d+]/g, "")
      .replace(/(?!^)\+/g, "");
  }

  function isValidEmail(value) {
    var email = String(value == null ? "" : value).trim();

    if (!email || email.length > 254) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function isValidPhone(value, minLength, maxLength) {
    var phone = normalizePhone(value).replace(/\D/g, "");
    var minimum = minLength == null ? 7 : Number(minLength);
    var maximum = maxLength == null ? 15 : Number(maxLength);

    if (
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 1 ||
      maximum < minimum
    ) {
      return false;
    }

    return phone.length >= minimum && phone.length <= maximum;
  }

  function getURL(value) {
    try {
      return new URL(String(value), window.location.href);
    } catch (error) {
      return null;
    }
  }

  function isValidURL(value, options) {
    options = options || {};

    var raw = String(value == null ? "" : value).trim();
    if (!raw) return false;

    var url = getURL(raw);
    if (!url) return false;

    var hasExplicitScheme = /^[a-z][a-z\d+.-]*:/i.test(raw);

    if (options.allowRelative && !hasExplicitScheme) {
      if (url.origin !== window.location.origin) return false;
      return true;
    }

    if (options.sameOrigin && url.origin !== window.location.origin) {
      return false;
    }

    return url.protocol === "https:" ||
      (options.allowHttp === true && url.protocol === "http:");
  }

  function safeURL(value, options) {
    options = options || {};

    var raw = String(value == null ? "" : value).trim();
    if (!raw) return "";

    var url = getURL(raw);
    if (!url) return "";

    var allowedProtocols = ["https:"];

    if (options.allowHttp === true) allowedProtocols.push("http:");
    if (options.allowMailto === true) allowedProtocols.push("mailto:");
    if (options.allowTel === true) allowedProtocols.push("tel:");

    if (allowedProtocols.indexOf(url.protocol) === -1) return "";

    if (options.sameOrigin && url.origin !== window.location.origin) {
      return "";
    }

    if (
      (url.protocol === "mailto:" || url.protocol === "tel:") &&
      options.sameOrigin
    ) {
      return "";
    }

    return url.href;
  }

  function debounce(callback, wait) {
    if (typeof callback !== "function") {
      throw new TypeError("Debounce requires a function.");
    }

    var timer = null;
    var latestContext;
    var latestArgs;

    function debounced() {
      latestContext = this;
      latestArgs = arguments;

      window.clearTimeout(timer);

      timer = window.setTimeout(function () {
        timer = null;
        callback.apply(latestContext, latestArgs);
      }, Math.max(0, Number(wait) || 0));
    }

    debounced.cancel = function () {
      window.clearTimeout(timer);
      timer = null;
      latestArgs = null;
    };

    debounced.flush = function () {
      if (timer === null) return undefined;

      window.clearTimeout(timer);
      timer = null;

      var result = callback.apply(latestContext, latestArgs);
      latestArgs = null;

      return result;
    };

    return debounced;
  }

  function throttle(callback, wait) {
    if (typeof callback !== "function") {
      throw new TypeError("Throttle requires a function.");
    }

    var lastRun = 0;
    var timer = null;
    var latestContext;
    var latestArgs;

    function invoke() {
      lastRun = Date.now();
      timer = null;

      var args = latestArgs;
      var context = latestContext;

      latestArgs = null;
      callback.apply(context, args);
    }

    function throttled() {
      latestContext = this;
      latestArgs = arguments;

      var delay = Math.max(0, Number(wait) || 0);
      var remaining = delay - (Date.now() - lastRun);

      if (remaining <= 0) {
        window.clearTimeout(timer);
        invoke();
      } else if (timer === null) {
        timer = window.setTimeout(invoke, remaining);
      }
    }

    throttled.cancel = function () {
      window.clearTimeout(timer);
      timer = null;
      latestArgs = null;
      lastRun = 0;
    };

    return throttled;
  }

  function deepClone(value) {
    if (typeof window.structuredClone === "function") {
      try {
        return window.structuredClone(value);
      } catch (error) {}
    }

    if (value === undefined) return undefined;

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      throw new TypeError("Value cannot be safely cloned.");
    }
  }

  function deepMerge(target) {
    var output = isPlainObject(target) ? Object.assign({}, target) : {};

    Array.prototype.slice.call(arguments, 1).forEach(function (source) {
      if (!isPlainObject(source)) return;

      Object.keys(source).forEach(function (key) {
        if (
          key === "__proto__" ||
          key === "constructor" ||
          key === "prototype"
        ) {
          return;
        }

        var value = source[key];

        if (isPlainObject(value)) {
          output[key] = deepMerge(
            isPlainObject(output[key]) ? output[key] : {},
            value
          );
        } else {
          output[key] = value;
        }
      });
    });

    return output;
  }

  function getNestedValue(object, path, fallback) {
    if (object == null || path == null || path === "") return fallback;

    var keys = Array.isArray(path)
      ? path
      : String(path).split(".").filter(Boolean);

    var current = object;

    for (var index = 0; index < keys.length; index += 1) {
      var key = String(keys[index]);

      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype" ||
        current == null ||
        !Object.prototype.hasOwnProperty.call(Object(current), key)
      ) {
        return fallback;
      }

      current = current[key];
    }

    return current === undefined ? fallback : current;
  }

  function setNestedValue(object, path, value) {
    if (!isObject(object) || path == null || path === "") return false;

    var keys = Array.isArray(path)
      ? path
      : String(path).split(".").filter(Boolean);

    if (!keys.length) return false;

    var current = object;

    for (var index = 0; index < keys.length - 1; index += 1) {
      var key = String(keys[index]);

      if (
        key === "__proto__" ||
        key === "constructor" ||
        key === "prototype"
      ) {
        return false;
      }

      if (!isPlainObject(current[key])) {
        current[key] = {};
      }

      current = current[key];
    }

    var lastKey = String(keys[keys.length - 1]);

    if (
      lastKey === "__proto__" ||
      lastKey === "constructor" ||
      lastKey === "prototype"
    ) {
      return false;
    }

    current[lastKey] = value;
    return true;
  }

  function getQueryParam(name, url) {
    try {
      var target = new URL(url || window.location.href);
      return target.searchParams.get(String(name));
    } catch (error) {
      return null;
    }
  }

  function buildQuery(params) {
    var query = new URLSearchParams();

    if (!isObject(params)) return "";

    Object.keys(params).forEach(function (key) {
      var value = params[key];

      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        value.forEach(function (item) {
          if (item !== undefined && item !== null) {
            query.append(key, String(item));
          }
        });
      } else if (isPlainObject(value)) {
        query.set(key, JSON.stringify(value));
      } else {
        query.set(key, String(value));
      }
    });

    return query.toString();
  }

  function copyToClipboard(value) {
    var text = String(value == null ? "" : value);

    if (
      window.navigator.clipboard &&
      window.isSecureContext &&
      typeof window.navigator.clipboard.writeText === "function"
    ) {
      return window.navigator.clipboard.writeText(text).then(function () {
        return true;
      });
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");

      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      textarea.style.opacity = "0";

      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      var copied = false;

      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }

      textarea.remove();

      if (copied) {
        resolve(true);
      } else {
        reject(new Error("Clipboard access is unavailable."));
      }
    });
  }

  function downloadBlob(blob, filename) {
    if (typeof window.Blob !== "function" || !(blob instanceof window.Blob)) {
      throw new TypeError("A Blob is required.");
    }

    var url = window.URL.createObjectURL(blob);
    var anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = String(filename || "download");
    anchor.hidden = true;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(function () {
      window.URL.revokeObjectURL(url);
    }, 1000);
  }

  function downloadText(text, filename, mimeType) {
    var blob = new window.Blob([
      String(text == null ? "" : text)
    ], {
      type: mimeType || "text/plain;charset=utf-8"
    });

    downloadBlob(blob, filename || "download.txt");
  }

  function makeAbortError() {
    try {
      return new window.DOMException("Operation aborted.", "AbortError");
    } catch (error) {
      var abortError = new Error("Operation aborted.");
      abortError.name = "AbortError";
      return abortError;
    }
  }

  function wait(milliseconds, signal) {
    return new Promise(function (resolve, reject) {
      var delay = Math.max(0, Number(milliseconds) || 0);

      if (signal && signal.aborted) {
        reject(makeAbortError());
        return;
      }

      var timer = window.setTimeout(function () {
        cleanup();
        resolve();
      }, delay);

      function onAbort() {
        window.clearTimeout(timer);
        cleanup();
        reject(makeAbortError());
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

  function once(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Once requires a function.");
    }

    var called = false;
    var result;

    return function () {
      if (called) return result;

      called = true;
      result = callback.apply(this, arguments);

      return result;
    };
  }

  function retry(callback, options) {
    options = options || {};

    var attempts = Math.max(1, Math.floor(Number(options.attempts) || 3));
    var delay = Math.max(0, Number(options.delay) || 300);
    var backoff = Math.max(1, Number(options.backoff) || 2);
    var shouldRetry = typeof options.shouldRetry === "function"
      ? options.shouldRetry
      : function () {
          return true;
        };

    if (typeof callback !== "function") {
      return Promise.reject(new TypeError("Retry requires a function."));
    }

    return (async function () {
      var lastError;

      for (var attempt = 0; attempt < attempts; attempt += 1) {
        if (options.signal && options.signal.aborted) {
          throw makeAbortError();
        }

        try {
          return await callback(attempt + 1);
        } catch (error) {
          lastError = error;

          if (
            attempt === attempts - 1 ||
            !shouldRetry(error, attempt + 1)
          ) {
            throw error;
          }

          await wait(
            delay * Math.pow(backoff, attempt),
            options.signal
          );
        }
      }

      throw lastError;
    })();
  }

  function getElement(selector, root) {
    if (!selector) return null;

    if (
      typeof window.Element === "function" &&
      selector instanceof window.Element
    ) {
      return selector;
    }

    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function getElements(selector, root) {
    if (!selector) return [];

    try {
      return Array.prototype.slice.call(
        (root || document).querySelectorAll(selector)
      );
    } catch (error) {
      return [];
    }
  }

  function setText(selector, value, root) {
    var element = getElement(selector, root);

    if (!element) return false;

    element.textContent = value == null ? "" : String(value);
    return true;
  }

  function setHTML(selector, value, root) {
    var element = getElement(selector, root);

    if (!element) return false;

    // This helper deliberately inserts text, not trusted HTML.
    element.textContent = value == null ? "" : String(value);
    return true;
  }

  function toggleClass(elementOrSelector, className, force) {
    var element = getElement(elementOrSelector);

    if (!element || !className) return false;

    if (force === undefined) {
      return element.classList.toggle(className);
    }

    return element.classList.toggle(className, Boolean(force));
  }

  function getCookie(name) {
    var cookieName = String(name || "");

    if (!cookieName) return null;

    var escaped = cookieName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var match = document.cookie.match(
      new RegExp("(?:^|;\\s*)" + escaped + "=([^;]*)")
    );

    if (!match) return null;

    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      return match[1];
    }
  }

  function getDeviceInfo() {
    var userAgent = window.navigator.userAgent || {};

    return {
      mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent),
      language: window.navigator.language || DEFAULTS.locale,
      online: window.navigator.onLine !== false,
      cookieEnabled: window.navigator.cookieEnabled,
      screen: {
        width: window.screen ? window.screen.width : 0,
        height: window.screen ? window.screen.height : 0
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  function isOnline() {
    return window.navigator.onLine !== false;
  }

  function scrollToElement(selector, options) {
    var element = getElement(selector);

    if (!element || typeof element.scrollIntoView !== "function") {
      return false;
    }

    options = options || {};

    try {
      element.scrollIntoView({
        behavior: options.behavior || "smooth",
        block: options.block || "start",
        inline: options.inline || "nearest"
      });
    } catch (error) {
      element.scrollIntoView();
    }

    return true;
  }

  function focusElement(selector, options) {
    var element = getElement(selector);

    if (!element || typeof element.focus !== "function") return false;

    try {
      element.focus(options || { preventScroll: false });
    } catch (error) {
      element.focus();
    }

    return true;
  }

  function dispatch(name, detail, target) {
    if (!name) return false;

    var element = target || document;

    try {
      return element.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {},
        bubbles: true,
        cancelable: true
      }));
    } catch (error) {
      emit(EVENTS.ERROR, {
        message: error.message || "Unable to dispatch event.",
        eventName: name
      });

      return false;
    }
  }

  var api = {
    isObject: isObject,
    isPlainObject: isPlainObject,
    isEmpty: isEmpty,
    escapeHTML: escapeHTML,
    stripHTML: stripHTML,
    capitalize: capitalize,
    titleCase: titleCase,
    toSlug: toSlug,
    truncate: truncate,
    clamp: clamp,
    randomId: randomId,

    formatCurrency: formatCurrency,
    formatNumber: formatNumber,
    formatCompactNumber: formatCompactNumber,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatRelativeTime: formatRelativeTime,
    formatBytes: formatBytes,

    normalizePhone: normalizePhone,
    isValidEmail: isValidEmail,
    isValidPhone: isValidPhone,
    isValidURL: isValidURL,
    safeURL: safeURL,

    debounce: debounce,
    throttle: throttle,
    deepClone: deepClone,
    deepMerge: deepMerge,
    getNestedValue: getNestedValue,
    setNestedValue: setNestedValue,

    getQueryParam: getQueryParam,
    buildQuery: buildQuery,
    copyToClipboard: copyToClipboard,
    downloadBlob: downloadBlob,
    downloadText: downloadText,
    wait: wait,
    once: once,
    retry: retry,

    getElement: getElement,
    getElements: getElements,
    setText: setText,
    setHTML: setHTML,
    toggleClass: toggleClass,
    getCookie: getCookie,
    getDeviceInfo: getDeviceInfo,
    isOnline: isOnline,
    scrollToElement: scrollToElement,
    focusElement: focusElement,
    dispatch: dispatch,

    events: EVENTS
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsUtils = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Utils = api;

  emit(EVENTS.READY, {
    version: CONFIG.VERSION || CONFIG.version || "1.0.0"
  });

})(window, document);
