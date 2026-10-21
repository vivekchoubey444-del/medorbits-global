
// File: /assets/js/storage.js
(function (window, document) {
  "use strict";

  if (window.MedOrbitsStorage) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const PREFIX = String(CONFIG.STORAGE_PREFIX || "medorbits")
    .replace(/[^a-zA-Z0-9_-]/g, "") || "medorbits";

  const MAX_VALUE_SIZE = 1024 * 1024;
  const MEMORY = new Map();

  const EVENTS = Object.freeze({
    CHANGE: "medorbits:storage:change",
    ERROR: "medorbits:storage:error",
    CLEAR: "medorbits:storage:clear"
  });

  const SENSITIVE_KEY_PATTERN =
    /(?:password|passwd|secret|private.?key|access.?token|refresh.?token|authorization|session.?id|csrf|payment.?card|cvv)/i;

  const available = { local: false, session: false };

  function emit(name, detail = {}) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    } catch (_) {
      // Storage remains usable if custom events are unavailable.
    }
  }

  function reportError(operation, key, error) {
    const detail = {
      operation,
      key: key == null ? null : String(key),
      message: error?.message || "Storage operation failed."
    };

    emit(EVENTS.ERROR, detail);

    try {
      window.MedOrbitsErrorHandler?.notify?.(
        error || new Error(detail.message),
        { module: "storage", operation, key: detail.key }
      );
    } catch (_) {
      // Error reporting must not interrupt storage operations.
    }
  }

  function normalizeKey(key) {
    if (typeof key !== "string" && typeof key !== "number") {
      throw new TypeError("Storage key must be a string or number.");
    }

    const value = String(key).trim();

    if (!value) throw new TypeError("Storage key cannot be empty.");

    return `${PREFIX}:${value}`;
  }

  function validateValue(value) {
    let serialized;

    try {
      serialized = JSON.stringify(value);
    } catch (_) {
      throw new TypeError("Storage value must be JSON-serializable.");
    }

    if (typeof serialized !== "string") {
      throw new TypeError("Storage value cannot be serialized.");
    }

    if (serialized.length > MAX_VALUE_SIZE) {
      throw new RangeError("Storage value exceeds the 1 MB limit.");
    }

    return serialized;
  }

  function getBackend(type = "local") {
    if (type !== "local" && type !== "session") {
      throw new TypeError("Storage type must be 'local' or 'session'.");
    }

    if (!available[type]) return null;

    try {
      return type === "session"
        ? window.sessionStorage
        : window.localStorage;
    } catch (_) {
      available[type] = false;
      return null;
    }
  }

  function initialize() {
    ["local", "session"].forEach((type) => {
      try {
        const storage = type === "session"
          ? window.sessionStorage
          : window.localStorage;

        const testKey = `${PREFIX}:__storage_test__`;
        storage.setItem(testKey, "1");
        storage.removeItem(testKey);
        available[type] = true;
      } catch (_) {
        available[type] = false;
      }
    });
  }

  function readRaw(key, type = "local") {
    const normalized = normalizeKey(key);
    const backend = getBackend(type);

    if (backend) {
      try {
        const value = backend.getItem(normalized);
        if (value !== null) return value;
      } catch (error) {
        reportError("read", key, error);
      }
    }

    return MEMORY.get(normalized) ?? null;
  }

  function writeRaw(key, value, type = "local") {
    const normalized = normalizeKey(key);
    const serialized = validateValue(value);
    const backend = getBackend(type);

    if (backend) {
      try {
        backend.setItem(normalized, serialized);
        MEMORY.delete(normalized);
        return true;
      } catch (error) {
        reportError("write", key, error);
      }
    }

    MEMORY.set(normalized, serialized);
    return true;
  }

  function removeRaw(key, type = "local") {
    const normalized = normalizeKey(key);
    const backend = getBackend(type);
    let removed = false;

    if (backend) {
      try {
        removed = backend.getItem(normalized) !== null;
        backend.removeItem(normalized);
      } catch (error) {
        reportError("remove", key, error);
      }
    }

    if (MEMORY.has(normalized)) {
      MEMORY.delete(normalized);
      removed = true;
    }

    return removed;
  }

  function parseValue(raw, fallback = null) {
    if (raw === null || raw === undefined) return fallback;

    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function set(key, value, options = {}) {
    const type = options.storage || "local";

    try {
      writeRaw(key, value, type);
      emit(EVENTS.CHANGE, { key: String(key), operation: "set", storage: type });
      return true;
    } catch (error) {
      reportError("set", key, error);
      return false;
    }
  }

  function get(key, fallback = null, options = {}) {
    try {
      return parseValue(readRaw(key, options.storage || "local"), fallback);
    } catch (error) {
      reportError("get", key, error);
      return fallback;
    }
  }

  function remove(key, options = {}) {
    const type = options.storage || "local";

    try {
      const removed = removeRaw(key, type);

      if (removed) {
        emit(EVENTS.CHANGE, { key: String(key), operation: "remove", storage: type });
      }

      return removed;
    } catch (error) {
      reportError("remove", key, error);
      return false;
    }
  }

  function has(key, options = {}) {
    try {
      return readRaw(key, options.storage || "local") !== null;
    } catch (error) {
      reportError("has", key, error);
      return false;
    }
  }

  function keys(options = {}) {
    const type = options.storage || "local";
    const prefix = `${PREFIX}:`;
    const result = new Set();
    const backend = getBackend(type);

    if (backend) {
      try {
        for (let i = 0; i < backend.length; i += 1) {
          const key = backend.key(i);
          if (key?.startsWith(prefix)) result.add(key.slice(prefix.length));
        }
      } catch (error) {
        reportError("keys", null, error);
      }
    }

    MEMORY.forEach((_, key) => {
      if (key.startsWith(prefix)) result.add(key.slice(prefix.length));
    });

    return [...result];
  }

  function clear(options = {}) {
    const type = options.storage || "local";
    const prefix = `${PREFIX}:`;
    const removed = new Set();
    const backend = getBackend(type);

    if (backend) {
      try {
        const targets = [];

        for (let i = 0; i < backend.length; i += 1) {
          const key = backend.key(i);
          if (key?.startsWith(prefix)) targets.push(key);
        }

        targets.forEach((key) => {
          backend.removeItem(key);
          removed.add(key.slice(prefix.length));
        });
      } catch (error) {
        reportError("clear", null, error);
      }
    }

    MEMORY.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        MEMORY.delete(key);
        removed.add(key.slice(prefix.length));
      }
    });

    const result = [...removed];
    emit(EVENTS.CLEAR, { storage: type, keys: result });

    return result.length;
  }

  function setSession(key, value) {
    return set(key, value, { storage: "session" });
  }

  function getSession(key, fallback = null) {
    return get(key, fallback, { storage: "session" });
  }

  function removeSession(key) {
    return remove(key, { storage: "session" });
  }

  function setString(key, value, options) {
    return set(key, String(value ?? ""), options);
  }

  function getString(key, fallback = "", options) {
    const value = get(key, fallback, options);
    return typeof value === "string" ? value : fallback;
  }

  function setBoolean(key, value, options) {
    return set(key, Boolean(value), options);
  }

  function getBoolean(key, fallback = false, options) {
    const value = get(key, fallback, options);
    return typeof value === "boolean" ? value : fallback;
  }

  function setNumber(key, value, options) {
    const number = Number(value);
    return Number.isFinite(number) ? set(key, number, options) : false;
  }

  function getNumber(key, fallback = 0, options) {
    const defaultValue = Number.isFinite(Number(fallback)) ? Number(fallback) : 0;
    const value = get(key, defaultValue, options);
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : defaultValue;
  }

  function setWithExpiry(key, value, ttlMilliseconds, options) {
    const ttl = Number(ttlMilliseconds);

    if (!Number.isFinite(ttl) || ttl <= 0) return false;

    return set(key, {
      value,
      expiresAt: Date.now() + ttl
    }, options);
  }

  function getWithExpiry(key, fallback = null, options) {
    const entry = get(key, null, options);

    if (
      !entry ||
      typeof entry !== "object" ||
      !Object.prototype.hasOwnProperty.call(entry, "expiresAt")
    ) {
      return entry === null ? fallback : entry;
    }

    if (
      typeof entry.expiresAt !== "number" ||
      !Number.isFinite(entry.expiresAt) ||
      entry.expiresAt <= Date.now()
    ) {
      remove(key, options);
      return fallback;
    }

    return entry.value;
  }

  function onChange(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function.");
    }

    const handler = (event) => callback(event.detail || {});
    document.addEventListener(EVENTS.CHANGE, handler);

    return () => document.removeEventListener(EVENTS.CHANGE, handler);
  }

  function handleStorageEvent(event) {
    if (!event?.key?.startsWith(`${PREFIX}:`)) return;

    let type = "local";

    try {
      if (event.storageArea === window.sessionStorage) type = "session";
    } catch (_) {
      // Keep the default storage type.
    }

    emit(EVENTS.CHANGE, {
      key: event.key.slice(PREFIX.length + 1),
      operation: event.newValue === null ? "remove" : "external",
      storage: type,
      external: true
    });
  }

  function clearSensitiveMemory() {
    MEMORY.forEach((_, key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) MEMORY.delete(key);
    });
  }

  initialize();

  window.addEventListener("storage", handleStorageEvent);
  window.addEventListener("pagehide", clearSensitiveMemory);

  const api = Object.freeze({
    set,
    get,
    remove,
    has,
    clear,
    keys,

    setSession,
    getSession,
    removeSession,

    setJSON: set,
    getJSON: get,
    setString,
    getString,
    setBoolean,
    getBoolean,
    setNumber,
    getNumber,

    setWithExpiry,
    getWithExpiry,
    remember: setWithExpiry,
    forget: remove,

    isAvailable(type = "local") {
      if (type === "memory") return true;
      return type === "local" || type === "session"
        ? available[type]
        : false;
    },

    getStatus() {
      return {
        localStorage: available.local,
        sessionStorage: available.session,
        memoryFallback: true,
        prefix: PREFIX
      };
    },

    onChange,
    events: EVENTS
  });

  window.MedOrbitsStorage = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Storage = api;

})(window, document);
