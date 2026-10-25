
/* =========================================================
   MedOrbits | Browser Storage & Offline Form Persistence
   File: /assets/js/storage.js
   Version: 2.0.0

   Features:
   - IndexedDB with localStorage and memory fallbacks
   - Namespaced storage for multiple MedOrbits pages
   - Save, read, update, delete and list records
   - Form draft autosave and restore
   - Offline-safe page preferences and temporary data
   - Cross-tab storage notifications
   - Optional expiration (TTL)
   - Automatic fallback when browser storage is unavailable
   - No external dependencies

   IMPORTANT:
   Browser storage is NOT a secure document vault or server
   backup. Never persist passwords, access tokens, payment
   data, or identity-document contents in ordinary storage.
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsStorage) return;

  const VERSION = "2.0.0";
  const PREFIX = "medorbits:";
  const DB_NAME = "medorbits-browser-storage";
  const DB_VERSION = 1;
  const OBJECT_STORE = "records";

  const state = {
    initialized: false,
    db: null,
    dbPromise: null,
    backend: "memory",
    memory: new Map(),
    listeners: new Set(),
    formListeners: new Map(),
    formTimers: new WeakMap(),
    options: {
      prefix: PREFIX,
      database: DB_NAME,
      version: DB_VERSION,
      store: OBJECT_STORE,
      autosaveDelay: 500,
      defaultTTL: 0,
      enableIndexedDB: true,
      enableLocalStorage: true,
      enableSessionStorage: true,
      restoreForms: true,
      autosaveForms: true,
      onError: null
    }
  };

  const api = {};

  /* -------------------- General helpers -------------------- */

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function makeError(message, code) {
    const error = new Error(message);
    error.code = code || "STORAGE_ERROR";
    return error;
  }

  function reportError(error, operation) {
    if (typeof state.options.onError === "function") {
      try {
        state.options.onError(error, operation);
      } catch (_) {
        // Error handlers must not break storage operations.
      }
    }
  }

  function safeClone(value) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (_) {
        // Try JSON-compatible cloning below.
      }
    }

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  function normalizeKey(key) {
    if (key === undefined || key === null || key === "") {
      throw makeError("A storage key is required.", "INVALID_KEY");
    }

    return String(key);
  }

  function normalizeStore(store) {
    const value = String(store || "default").trim();

    if (!value || value.length > 120) {
      throw makeError("Invalid storage collection.", "INVALID_STORE");
    }

    return value;
  }

  function recordId(store, key) {
    return store + "::" + key;
  }

  function localKey(store, key) {
    return state.options.prefix +
      "record:" +
      encodeURIComponent(store) +
      ":" +
      encodeURIComponent(key);
  }

  function now() {
    return Date.now();
  }

  function createRecord(store, key, value, ttl) {
    const duration = Number.isFinite(Number(ttl))
      ? Math.max(0, Number(ttl))
      : state.options.defaultTTL;

    return {
      id: recordId(store, key),
      store: store,
      key: key,
      value: safeClone(value),
      updatedAt: now(),
      expiresAt: duration > 0 ? now() + duration : 0
    };
  }

  function isExpired(record) {
    return Boolean(
      record &&
      record.expiresAt &&
      record.expiresAt <= now()
    );
  }

  function emit(type, detail) {
    const event = {
      type: type,
      detail: detail || {},
      timestamp: now()
    };

    state.listeners.forEach(function (listener) {
      try {
        listener(event);
      } catch (error) {
        reportError(error, "listener");
      }
    });

    try {
      document.dispatchEvent(
        new CustomEvent("medorbits:storage", {
          detail: event
        })
      );
    } catch (_) {
      // Custom events may be unavailable in test environments.
    }
  }

  /* -------------------- IndexedDB -------------------- */

  function openDatabase() {
    if (state.db) return Promise.resolve(state.db);
    if (state.dbPromise) return state.dbPromise;

    if (
      !state.options.enableIndexedDB ||
      !window.indexedDB
    ) {
      return Promise.reject(
        makeError("IndexedDB is unavailable.", "IDB_UNAVAILABLE")
      );
    }

    state.dbPromise = new Promise(function (resolve, reject) {
      let request;

      try {
        request = window.indexedDB.open(
          state.options.database,
          state.options.version
        );
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = function () {
        const db = request.result;

        if (!db.objectStoreNames.contains(state.options.store)) {
          db.createObjectStore(state.options.store, {
            keyPath: "id"
          });
        }
      };

      request.onsuccess = function () {
        state.db = request.result;
        state.backend = "indexedDB";

        state.db.onversionchange = function () {
          state.db.close();
          state.db = null;
          state.dbPromise = null;
        };

        resolve(state.db);
      };

      request.onerror = function () {
        reject(
          request.error ||
          makeError("Could not open IndexedDB.", "IDB_OPEN_FAILED")
        );
      };

      request.onblocked = function () {
        reportError(
          makeError(
            "Database upgrade is blocked by another open tab.",
            "IDB_BLOCKED"
          ),
          "openDatabase"
        );
      };
    }).catch(function (error) {
      state.dbPromise = null;
      reportError(error, "openDatabase");
      throw error;
    });

    return state.dbPromise;
  }

  function idbRequest(mode, action) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        let transaction;
        let request;
        let result;

        try {
          transaction = db.transaction(
            state.options.store,
            mode
          );

          const store = transaction.objectStore(state.options.store);
          request = action(store);

          if (request) {
            request.onsuccess = function () {
              result = request.result;
            };

            request.onerror = function () {
              reject(request.error);
            };
          }

          transaction.oncomplete = function () {
            resolve(result);
          };

          transaction.onerror = function () {
            reject(
              transaction.error ||
              makeError("Storage transaction failed.", "IDB_TRANSACTION")
            );
          };

          transaction.onabort = function () {
            reject(
              transaction.error ||
              makeError("Storage transaction was aborted.", "IDB_ABORT")
            );
          };
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /* -------------------- Fallback storage -------------------- */

  function getWebStorage(type) {
    try {
      const storage = window[type];

      if (!storage) return null;

      const testKey = state.options.prefix + "__test__";
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);

      return storage;
    } catch (_) {
      return null;
    }
  }

  function fallbackSet(record) {
    const serialized = JSON.stringify(record);

    state.memory.set(record.id, record);

    if (state.options.enableLocalStorage) {
      const storage = getWebStorage("localStorage");

      if (storage) {
        try {
          storage.setItem(
            localKey(record.store, record.key),
            serialized
          );
          state.backend = "localStorage";
          return true;
        } catch (error) {
          reportError(error, "fallbackSet");
        }
      }
    }

    state.backend = "memory";
    return true;
  }

  function fallbackGet(store, key) {
    const id = recordId(store, key);

    if (state.options.enableLocalStorage) {
      const storage = getWebStorage("localStorage");

      if (storage) {
        try {
          const serialized = storage.getItem(localKey(store, key));

          if (serialized !== null) {
            const record = JSON.parse(serialized);

            if (isExpired(record)) {
              storage.removeItem(localKey(store, key));
              state.memory.delete(id);
              return undefined;
            }

            state.memory.set(id, record);
            return safeClone(record.value);
          }
        } catch (error) {
          reportError(error, "fallbackGet");
        }
      }
    }

    const record = state.memory.get(id);

    if (!record || isExpired(record)) {
      state.memory.delete(id);
      return undefined;
    }

    return safeClone(record.value);
  }

  function fallbackRemove(store, key) {
    const id = recordId(store, key);
    state.memory.delete(id);

    const storage = getWebStorage("localStorage");

    if (storage) {
      try {
        storage.removeItem(localKey(store, key));
      } catch (error) {
        reportError(error, "fallbackRemove");
      }
    }
  }

  /* -------------------- Core storage API -------------------- */

  async function set(key, value, options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);
    const normalizedKey = normalizeKey(key);
    const record = createRecord(
      store,
      normalizedKey,
      value,
      opts.ttl
    );

    try {
      await idbRequest("readwrite", function (objectStore) {
        return objectStore.put(record);
      });

      state.memory.set(record.id, record);
      emit("set", {
        store: store,
        key: normalizedKey
      });

      return safeClone(value);
    } catch (error) {
      reportError(error, "set");
      fallbackSet(record);

      emit("set", {
        store: store,
        key: normalizedKey,
        fallback: true
      });

      return safeClone(value);
    }
  }

  async function get(key, options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);
    const normalizedKey = normalizeKey(key);

    try {
      const record = await idbRequest("readonly", function (objectStore) {
        return objectStore.get(recordId(store, normalizedKey));
      });

      if (record) {
        if (isExpired(record)) {
          await remove(normalizedKey, { store: store });
          return opts.defaultValue;
        }

        state.memory.set(record.id, record);
        return safeClone(record.value);
      }
    } catch (error) {
      reportError(error, "get");
    }

    const value = fallbackGet(store, normalizedKey);

    return value === undefined ? opts.defaultValue : value;
  }

  async function has(key, options) {
    const marker = {};
    const value = await get(key, {
      ...(options || {}),
      defaultValue: marker
    });

    return value !== marker;
  }

  async function remove(key, options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);
    const normalizedKey = normalizeKey(key);

    try {
      await idbRequest("readwrite", function (objectStore) {
        return objectStore.delete(recordId(store, normalizedKey));
      });
    } catch (error) {
      reportError(error, "remove");
    }

    fallbackRemove(store, normalizedKey);

    emit("remove", {
      store: store,
      key: normalizedKey
    });

    return true;
  }

  async function keys(options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);
    const found = new Set();

    try {
      const records = await idbRequest("readonly", function (objectStore) {
        return objectStore.getAll();
      });

      (records || []).forEach(function (record) {
        if (record.store !== store) return;

        if (isExpired(record)) {
          remove(record.key, { store: store });
          return;
        }

        found.add(record.key);
      });
    } catch (error) {
      reportError(error, "keys");
    }

    state.memory.forEach(function (record) {
      if (record.store === store && !isExpired(record)) {
        found.add(record.key);
      }
    });

    const storage = getWebStorage("localStorage");

    if (storage) {
      const prefix = state.options.prefix +
        "record:" +
        encodeURIComponent(store) +
        ":";

      try {
        for (let index = 0; index < storage.length; index += 1) {
          const storageKey = storage.key(index);

          if (!storageKey || !storageKey.startsWith(prefix)) continue;

          try {
            const record = JSON.parse(storage.getItem(storageKey));

            if (record && !isExpired(record)) {
              found.add(record.key);
            } else {
              storage.removeItem(storageKey);
              index -= 1;
            }
          } catch (_) {
            // Ignore corrupted fallback records.
          }
        }
      } catch (error) {
        reportError(error, "keys");
      }
    }

    return Array.from(found);
  }

  async function all(options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);
    const result = {};

    for (const key of await keys({ store: store })) {
      result[key] = await get(key, { store: store });
    }

    return result;
  }

  async function clear(options) {
    const opts = options || {};
    const store = normalizeStore(opts.store);

    try {
      await idbRequest("readwrite", function (objectStore) {
        const request = objectStore.openCursor();

        request.onsuccess = function () {
          const cursor = request.result;

          if (!cursor) return;

          if (cursor.value.store === store) {
            cursor.delete();
          }

          cursor.continue();
        };

        return request;
      });
    } catch (error) {
      reportError(error, "clear");
    }

    Array.from(state.memory.entries()).forEach(function (entry) {
      if (entry[1].store === store) {
        state.memory.delete(entry[0]);
      }
    });

    const storage = getWebStorage("localStorage");

    if (storage) {
      const prefix = state.options.prefix +
        "record:" +
        encodeURIComponent(store) +
        ":";

      try {
        for (let index = storage.length - 1; index >= 0; index -= 1) {
          const key = storage.key(index);

          if (key && key.startsWith(prefix)) {
            storage.removeItem(key);
          }
        }
      } catch (error) {
        reportError(error, "clear");
      }
    }

    emit("clear", { store: store });
    return true;
  }

  /* -------------------- Session storage -------------------- */

  function sessionSet(key, value) {
    const normalizedKey = normalizeKey(key);
    const storage = state.options.enableSessionStorage
      ? getWebStorage("sessionStorage")
      : null;

    if (!storage) {
      state.memory.set("session::" + normalizedKey, {
        store: "session",
        key: normalizedKey,
        value: safeClone(value),
        expiresAt: 0
      });
      return false;
    }

    try {
      storage.setItem(
        state.options.prefix + "session:" + normalizedKey,
        JSON.stringify(value)
      );
      return true;
    } catch (error) {
      reportError(error, "sessionSet");
      return false;
    }
  }

  function sessionGet(key, defaultValue) {
    const normalizedKey = normalizeKey(key);
    const storage = state.options.enableSessionStorage
      ? getWebStorage("sessionStorage")
      : null;

    if (storage) {
      try {
        const value = storage.getItem(
          state.options.prefix + "session:" + normalizedKey
        );

        if (value !== null) return JSON.parse(value);
      } catch (error) {
        reportError(error, "sessionGet");
      }
    }

    const record = state.memory.get("session::" + normalizedKey);

    return record ? safeClone(record.value) : defaultValue;
  }

  function sessionRemove(key) {
    const normalizedKey = normalizeKey(key);
    const storage = getWebStorage("sessionStorage");

    if (storage) {
      try {
        storage.removeItem(
          state.options.prefix + "session:" + normalizedKey
        );
      } catch (error) {
        reportError(error, "sessionRemove");
      }
    }

    state.memory.delete("session::" + normalizedKey);
  }

  /* -------------------- Form draft helpers -------------------- */

  function isSensitiveField(field) {
    if (!field || !field.name || field.disabled) return true;

    const type = String(field.type || "").toLowerCase();
    const name = String(field.name || "").toLowerCase();
    const id = String(field.id || "").toLowerCase();

    if (
      field.hasAttribute("data-no-store") ||
      field.hasAttribute("data-sensitive") ||
      type === "password" ||
      type === "file" ||
      type === "hidden" ||
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "image"
    ) {
      return true;
    }

    if (
      /password|passwd|token|secret|authorization|csrf|otp|pin|cvv|cvc|aadhaar|aadhar|passport|pan_number|identity_document/i.test(name) ||
      /password|passwd|token|secret|authorization|csrf|otp|pin|cvv|cvc|aadhaar|aadhar|passport|identity_document/i.test(id)
    ) {
      return true;
    }

    return false;
  }

  function serializeForm(form) {
    if (!form || !form.elements) {
      throw makeError("A valid form element is required.", "INVALID_FORM");
    }

    const values = {};

    Array.from(form.elements).forEach(function (field) {
      if (!field.name || isSensitiveField(field)) return;

      const type = String(field.type || "").toLowerCase();

      if ((type === "checkbox" || type === "radio") && !field.checked) {
        return;
      }

      if (field instanceof HTMLSelectElement && field.multiple) {
        values[field.name] = Array.from(field.selectedOptions)
          .map(function (option) {
            return option.value;
          });
        return;
      }

      if (type === "checkbox") {
        if (Object.prototype.hasOwnProperty.call(values, field.name)) {
          if (!Array.isArray(values[field.name])) {
            values[field.name] = [values[field.name]];
          }

          values[field.name].push(field.value);
        } else {
          values[field.name] = field.value || true;
        }

        return;
      }

      if (type === "radio") {
        values[field.name] = field.value;
        return;
      }

      values[field.name] = field.value;
    });

    return values;
  }

  function restoreForm(form, values) {
    if (!form || !form.elements || !isObject(values)) return false;

    Array.from(form.elements).forEach(function (field) {
      if (!field.name || isSensitiveField(field)) return;
      if (!Object.prototype.hasOwnProperty.call(values, field.name)) return;

      const value = values[field.name];
      const type = String(field.type || "").toLowerCase();

      if (type === "radio") {
        field.checked = String(value) === String(field.value);
        return;
      }

      if (type === "checkbox") {
        if (Array.isArray(value)) {
          field.checked = value.map(String).includes(String(field.value));
        } else {
          field.checked =
            value === true ||
            String(value) === String(field.value);
        }
        return;
      }

      if (field instanceof HTMLSelectElement && field.multiple) {
        const selected = new Set(
          (Array.isArray(value) ? value : [value]).map(String)
        );

        Array.from(field.options).forEach(function (option) {
          option.selected = selected.has(String(option.value));
        });

        return;
      }

      field.value = value == null ? "" : String(value);
    });

    form.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function getFormKey(form) {
    return form.getAttribute("data-mo-storage-key") ||
      form.id ||
      form.getAttribute("name");
  }

  async function saveForm(form, options) {
    const opts = options || {};
    const key = opts.key || getFormKey(form);

    if (!key) {
      throw makeError(
        "Set data-mo-storage-key, form id, or form name.",
        "FORM_KEY_REQUIRED"
      );
    }

    const values = serializeForm(form);

    await set(String(key), {
      values: values,
      savedAt: new Date().toISOString(),
      page: window.location.pathname
    }, {
      store: opts.store || "form-drafts",
      ttl: opts.ttl
    });

    emit("form:saved", { key: String(key) });
    return values;
  }

  async function loadForm(form, options) {
    const opts = options || {};
    const key = opts.key || getFormKey(form);

    if (!key) return false;

    const draft = await get(String(key), {
      store: opts.store || "form-drafts"
    });

    if (!draft || !draft.values) return false;

    restoreForm(form, draft.values);
    emit("form:restored", { key: String(key) });

    return true;
  }

  async function clearForm(formOrKey, options) {
    const opts = options || {};
    const key = typeof formOrKey === "string"
      ? formOrKey
      : getFormKey(formOrKey);

    if (!key) return false;

    await remove(String(key), {
      store: opts.store || "form-drafts"
    });

    emit("form:cleared", { key: String(key) });
    return true;
  }

  function bindForms(root) {
    const container = root || document;
    const forms = container.querySelectorAll(
      "form[data-mo-storage-form]"
    );

    forms.forEach(function (form) {
      if (state.formListeners.has(form)) return;

      const config = {
        timer: null,
        save: null,
        input: null,
        submit: null
      };

      config.save = function () {
        saveForm(form).catch(function (error) {
          reportError(error, "autosaveForm");
        });
      };

      config.input = function () {
        window.clearTimeout(config.timer);

        config.timer = window.setTimeout(
          config.save,
          Math.max(0, Number(state.options.autosaveDelay) || 500)
        );
      };

      config.submit = function () {
        // Clear the draft only when the page confirms success.
        // Add data-mo-storage-clear-on-submit to opt into clearing
        // immediately after a valid submit event.
        if (form.hasAttribute("data-mo-storage-clear-on-submit")) {
          clearForm(form).catch(function (error) {
            reportError(error, "clearSubmittedForm");
          });
        } else {
          config.save();
        }
      };

      if (state.options.autosaveForms) {
        form.addEventListener("input", config.input);
        form.addEventListener("change", config.input);
      }

      form.addEventListener("submit", config.submit);

      state.formListeners.set(form, config);

      if (state.options.restoreForms) {
        loadForm(form).catch(function (error) {
          reportError(error, "restoreForm");
        });
      }
    });

    return forms.length;
  }

  function unbindForms(root) {
    const container = root || document;

    state.formListeners.forEach(function (config, form) {
      if (
        container !== document &&
        container !== form &&
        !(container.contains && container.contains(form))
      ) {
        return;
      }

      window.clearTimeout(config.timer);
      form.removeEventListener("input", config.input);
      form.removeEventListener("change", config.input);
      form.removeEventListener("submit", config.submit);

      state.formListeners.delete(form);
    });
  }

  /* -------------------- Cross-tab synchronization -------------------- */

  function handleStorageEvent(event) {
    if (!event.key || !event.key.startsWith(state.options.prefix)) return;

    emit("external-change", {
      key: event.key,
      removed: event.newValue === null
    });
  }

  /* -------------------- Initialization -------------------- */

  function configure(options) {
    if (!isObject(options)) return api;

    Object.keys(options).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(state.options, key)) {
        state.options[key] = options[key];
      }
    });

    return api;
  }

  function init(options) {
    configure(options);

    if (!state.initialized) {
      state.initialized = true;

      window.addEventListener("storage", handleStorageEvent);

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
          if (state.options.autosaveForms) bindForms(document);
        }, { once: true });
      } else if (state.options.autosaveForms) {
        bindForms(document);
      }

      if (state.options.enableIndexedDB && window.indexedDB) {
        openDatabase().catch(function () {
          state.backend = getWebStorage("localStorage")
            ? "localStorage"
            : "memory";
        });
      } else {
        state.backend = getWebStorage("localStorage")
          ? "localStorage"
          : "memory";
      }
    } else {
      bindForms(document);
    }

    return api;
  }

  function getStatus() {
    return {
      version: VERSION,
      initialized: state.initialized,
      backend: state.backend,
      indexedDBAvailable: Boolean(
        state.options.enableIndexedDB && window.indexedDB
      ),
      localStorageAvailable: Boolean(getWebStorage("localStorage")),
      sessionStorageAvailable: Boolean(getWebStorage("sessionStorage")),
      online: navigator.onLine !== false,
      boundForms: state.formListeners.size
    };
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw makeError("Listener must be a function.", "INVALID_LISTENER");
    }

    state.listeners.add(listener);

    return function unsubscribe() {
      state.listeners.delete(listener);
    };
  }

  async function destroy() {
    unbindForms(document);
    window.removeEventListener("storage", handleStorageEvent);

    if (state.db) {
      state.db.close();
      state.db = null;
    }

    state.dbPromise = null;
    state.initialized = false;
    state.listeners.clear();

    return true;
  }

  /* -------------------- Public API -------------------- */

  Object.assign(api, {
    version: VERSION,
    init: init,
    configure: configure,

    set: set,
    get: get,
    has: has,
    remove: remove,
    delete: remove,
    keys: keys,
    all: all,
    clear: clear,

    sessionSet: sessionSet,
    sessionGet: sessionGet,
    sessionRemove: sessionRemove,

    serializeForm: serializeForm,
    restoreForm: restoreForm,
    saveForm: saveForm,
    loadForm: loadForm,
    clearForm: clearForm,
    bindForms: bindForms,
    unbindForms: unbindForms,

    subscribe: subscribe,
    getStatus: getStatus,
    destroy: destroy
  });

  window.MedOrbitsStorage = api;

  // Initialize automatically when the script is loaded.
  init();

})(window, document);
