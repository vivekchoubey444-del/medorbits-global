
/**
 * MedOrbits -- Comparison Manager
 * File: /assets/js/compare.js
 * Version: 1.2.0
 *
 * Compares colleges, courses, universities, and jobs.
 * Features: session persistence, category isolation, safe rendering,
 * comparison limits, filtering differences, and UI integration.
 */
(function (window, document) {
  "use strict";

  if (window.MedOrbitsCompare) {
    return;
  }

  var MAX_ITEMS = 4;
  var STORAGE_KEY = "medorbits-comparison";
  var EVENT_UPDATED = "medorbits:comparison-updated";

  var state = {
    items: [],
    category: null
  };

  var listeners = new Set();
  var initialized = false;

  var utils = {
    getId: function (item) {
      if (!item || typeof item !== "object") return null;

      var keys = [
        "id",
        "college_id",
        "course_id",
        "university_id",
        "job_id",
        "slug"
      ];

      for (var i = 0; i < keys.length; i++) {
        var value = item[keys[i]];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {
          return value;
        }
      }

      return null;
    },

    getName: function (item) {
      return String(
        item.name ||
        item.title ||
        item.college_name ||
        item.course_name ||
        item.university_name ||
        item.job_title ||
        "Unnamed item"
      );
    },

    normalizeCategory: function (category) {
      var value = String(category || "college").trim().toLowerCase();

      if (!/^[a-z][a-z0-9_-]{0,39}$/.test(value)) {
        throw new TypeError("A valid comparison category is required.");
      }

      return value;
    },

    cloneItem: function (item) {
      // Accept plain JSON-compatible records only.
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        throw new TypeError("A valid comparison item is required.");
      }

      var serialized;

      try {
        serialized = JSON.stringify(item);
      } catch (error) {
        throw new TypeError("The comparison item must contain JSON-compatible data.");
      }

      if (typeof serialized !== "string") {
        throw new TypeError("The comparison item could not be serialized.");
      }

      var clone = JSON.parse(serialized);

      if (!clone || typeof clone !== "object" || Array.isArray(clone)) {
        throw new TypeError("The comparison item must be a plain object.");
      }

      return deepFreeze(clone);
    },

    emit: function (reason) {
      var detail = Object.freeze({
        category: state.category,
        items: state.items.slice(),
        count: state.items.length,
        maxItems: MAX_ITEMS,
        reason: reason
      });

      try {
        document.dispatchEvent(
          new CustomEvent(EVENT_UPDATED, { detail: detail })
        );
      } catch (error) {
        // State changes remain valid even if custom events are unavailable.
      }

      listeners.forEach(function (listener) {
        try {
          listener(detail);
        } catch (error) {
          if (window.console && typeof window.console.error === "function") {
            window.console.error(
              "[MedOrbits Compare] Change listener failed.",
              error
            );
          }
        }
      });

      updateCounters();
    },

    save: function () {
      try {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 1,
            category: state.category,
            items: state.items
          })
        );

        return true;
      } catch (error) {
        // Comparison remains available in memory if storage is unavailable.
        return false;
      }
    },

    load: function () {
      var raw;

      try {
        raw = window.sessionStorage.getItem(STORAGE_KEY);
      } catch (error) {
        return;
      }

      if (!raw) return;

      try {
        var parsed = JSON.parse(raw);

        if (
          !parsed ||
          typeof parsed !== "object" ||
          !Array.isArray(parsed.items)
        ) {
          return;
        }

        var category = parsed.category
          ? utils.normalizeCategory(parsed.category)
          : null;

        var restored = [];
        var seen = new Set();

        parsed.items.slice(0, MAX_ITEMS).forEach(function (item) {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return;
          }

          var id = utils.getId(item);

          if (id === null) return;

          var key = String(id);

          if (seen.has(key)) return;

          seen.add(key);
          restored.push(utils.cloneItem(item));
        });

        if (restored.length && !category) {
          // Do not restore ambiguous records without their category.
          return;
        }

        state.category = restored.length ? category : null;
        state.items = restored;
      } catch (error) {
        state.category = null;
        state.items = [];

        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch (storageError) {
          // Ignore storage restrictions.
        }
      }
    }
  };

  function deepFreeze(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Object.isFrozen(value)
    ) {
      return value;
    }

    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key]);
    });

    return Object.freeze(value);
  }

  function add(item, category) {
    category = utils.normalizeCategory(category || "college");

    var snapshot = utils.cloneItem(item);
    var id = utils.getId(snapshot);

    if (id === null) {
      throw new Error("The item must have a unique identifier.");
    }

    if (state.category && state.category !== category) {
      throw new Error(
        "Compare items from the same category. Clear the comparison first."
      );
    }

    var idString = String(id);

    if (
      state.items.some(function (existing) {
        return String(utils.getId(existing)) === idString;
      })
    ) {
      return state.items.slice();
    }

    if (state.items.length >= MAX_ITEMS) {
      throw new Error("You can compare up to " + MAX_ITEMS + " items.");
    }

    state.category = category;
    state.items.push(snapshot);

    utils.save();
    utils.emit("added");

    return state.items.slice();
  }

  function remove(id) {
    if (id === null || id === undefined) {
      return state.items.slice();
    }

    var idString = String(id);
    var previousLength = state.items.length;

    state.items = state.items.filter(function (item) {
      return String(utils.getId(item)) !== idString;
    });

    if (state.items.length === previousLength) {
      return state.items.slice();
    }

    if (!state.items.length) {
      state.category = null;
    }

    utils.save();
    utils.emit("removed");

    return state.items.slice();
  }

  function clear() {
    state.items = [];
    state.category = null;

    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Clearing in-memory state still succeeds.
    }

    utils.emit("cleared");
    return [];
  }

  function getItems() {
    return state.items.slice();
  }

  function contains(id) {
    if (id === null || id === undefined) return false;

    return state.items.some(function (item) {
      return String(utils.getId(item)) === String(id);
    });
  }

  function getDifferences(fields) {
    fields = Array.isArray(fields) ? fields : [];

    return fields.map(function (field) {
      var key = typeof field === "string" ? field : field.key;

      if (typeof key !== "string" || !key.trim()) {
        return null;
      }

      var values = state.items.map(function (item) {
        return {
          id: utils.getId(item),
          name: utils.getName(item),
          value: getPathValue(item, key)
        };
      });

      var distinctValues = new Set(
        values.map(function (entry) {
          return stableValue(entry.value);
        })
      );

      return {
        field: key,
        label: typeof field === "object" && field.label
          ? String(field.label)
          : key,
        values: values,
        differs: distinctValues.size > 1
      };
    }).filter(Boolean);
  }

  function getPathValue(object, path) {
    if (typeof path !== "string" || !path.trim()) {
      return undefined;
    }

    var parts = path.split(".");

    // Avoid inherited properties and prototype-related paths.
    var blocked = ["__proto__", "prototype", "constructor"];

    for (var i = 0; i < parts.length; i++) {
      if (blocked.indexOf(parts[i]) !== -1) {
        return undefined;
      }
    }

    var value = object;

    for (var j = 0; j < parts.length; j++) {
      if (value === null || value === undefined) {
        return undefined;
      }

      value = value[parts[j]];
    }

    if (
      value !== null &&
      typeof value === "object"
    ) {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return "[Complex value]";
      }
    }

    return value;
  }

  function stableValue(value) {
    if (value === undefined) return "__undefined__";

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === "") {
      return "Not available";
    }

    if (Array.isArray(value)) {
      return value.map(function (entry) {
        if (entry === null || entry === undefined) return "";
        return typeof entry === "object"
          ? JSON.stringify(entry)
          : String(entry);
      }).filter(Boolean).join(", ") || "Not available";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return "Not available";
      }
    }

    return String(value);
  }

  function resolveContainer(container) {
    if (typeof container === "string") {
      return document.querySelector(container);
    }

    return container;
  }

  function render(container, fields) {
    container = resolveContainer(container);
    fields = Array.isArray(fields) ? fields : [];

    if (
      !container ||
      container.nodeType !== 1 ||
      typeof container.replaceChildren !== "function"
    ) {
      throw new TypeError("A valid comparison container is required.");
    }

    if (!state.items.length) {
      var empty = document.createElement("p");
      empty.className = "comparison-empty";
      empty.textContent = "Add items to compare them side by side.";
      container.replaceChildren(empty);
      return container;
    }

    var table = document.createElement("table");
    table.className = "comparison-table";

    var caption = document.createElement("caption");
    caption.className = "visually-hidden";
    caption.textContent = "Comparison of " + state.items.length + " items";
    table.appendChild(caption);

    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");

    var labelHeader = document.createElement("th");
    labelHeader.scope = "col";
    labelHeader.textContent = "Feature";
    headerRow.appendChild(labelHeader);

    state.items.forEach(function (item) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = utils.getName(item);
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");

    fields.forEach(function (field) {
      if (!field || typeof field.key !== "string" || !field.key.trim()) {
        return;
      }

      var row = document.createElement("tr");
      var label = document.createElement("th");

      label.scope = "row";
      label.textContent = field.label || field.key;
      row.appendChild(label);

      var rawValues = state.items.map(function (item) {
        return getPathValue(item, field.key);
      });

      var differs = new Set(rawValues.map(stableValue)).size > 1;

      state.items.forEach(function (item, index) {
        var cell = document.createElement("td");
        cell.textContent = formatValue(rawValues[index]);

        if (differs) {
          cell.classList.add("comparison-different");
        }

        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.replaceChildren(table);

    return table;
  }

  function onChange(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onChange expects a function.");
    }

    listeners.add(callback);

    return function unsubscribe() {
      return listeners.delete(callback);
    };
  }

  function updateCounters() {
    document.querySelectorAll("[data-compare-count]").forEach(function (element) {
      element.textContent = String(state.items.length);
    });

    document.querySelectorAll("[data-compare-clear]").forEach(function (button) {
      button.disabled = state.items.length === 0;
    });

    document.querySelectorAll("[data-compare-add]").forEach(function (button) {
      var id = button.getAttribute("data-compare-add");
      var alreadyAdded = id !== null && contains(id);

      button.disabled = alreadyAdded || state.items.length >= MAX_ITEMS;

      button.setAttribute(
        "aria-pressed",
        alreadyAdded ? "true" : "false"
      );
    });

    document.querySelectorAll("[data-compare-remove]").forEach(function (button) {
      button.disabled = !contains(button.getAttribute("data-compare-remove"));
    });
  }

  function handleDocumentClick(event) {
    var target = event.target;

    if (!target || typeof target.closest !== "function") return;

    var clearButton = target.closest("[data-compare-clear]");

    if (clearButton) {
      event.preventDefault();
      clear();
      return;
    }

    var removeButton = target.closest("[data-compare-remove]");

    if (removeButton) {
      event.preventDefault();

      var removeId = removeButton.getAttribute("data-compare-remove");

      if (removeId) remove(removeId);
      return;
    }

    var addButton = target.closest("[data-compare-add]");

    if (addButton) {
      event.preventDefault();

      var rawItem = addButton.getAttribute("data-compare-item");
      var category = addButton.getAttribute("data-compare-category") || "college";

      if (!rawItem) {
        // An item object must be supplied by application code.
        return;
      }

      try {
        var item = JSON.parse(rawItem);
        add(item, category);
      } catch (error) {
        if (window.console && typeof window.console.warn === "function") {
          window.console.warn(
            "[MedOrbits Compare] Could not add item.",
            error.message
          );
        }

        document.dispatchEvent(
          new CustomEvent("medorbits:comparison-error", {
            detail: {
              message: error.message || "Unable to add this item."
            }
          })
        );
      }
    }
  }

  function init() {
    if (initialized) {
      updateCounters();
      return;
    }

    initialized = true;
    utils.load();

    document.addEventListener("click", handleDocumentClick);

    updateCounters();
    utils.emit("initialized");
  }

  var api = {
    MAX_ITEMS: MAX_ITEMS,
    add: add,
    remove: remove,
    clear: clear,
    contains: contains,
    getItems: getItems,
    getDifferences: getDifferences,
    render: render,
    onChange: onChange,
    init: init,

    get state() {
      return Object.freeze({
        category: state.category,
        items: state.items.slice()
      });
    }
  };

  Object.defineProperty(window, "MedOrbitsCompare", {
    value: Object.freeze(api),
    writable: false,
    configurable: false,
    enumerable: true
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
