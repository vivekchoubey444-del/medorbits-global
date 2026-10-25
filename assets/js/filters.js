
/* =========================================================
   MEDORBITS | REUSABLE FILTERS
   File: assets/js/filters.js
   Version: 1.0.0

   Features:
   - Search and keyword matching
   - Multiple field filters
   - Exact, partial and multi-value matching
   - Sorting and pagination
   - Active filter indicators
   - Clear-all and individual filter reset
   - JSON dataset integration
   - Accessible result announcements
   - Dynamic content support
   - Safe DOM text rendering
   - No external dependencies

   Supported attributes:
   [data-mo-filters]
   [data-filter-search]
   [data-filter-control]
   [data-filter-field]
   [data-filter-operator]
   [data-filter-sort]
   [data-filter-page-size]
   [data-filter-item]
   [data-filter-results]
   [data-filter-count]
   [data-filter-empty]
   [data-filter-clear]
   [data-filter-reset]
   [data-filter-active]
   [data-filter-pagination]
   [data-filter-prev]
   [data-filter-next]
   [data-filter-page-indicator]

   ========================================================= */

(function medOrbitsFiltersModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_FILTERS_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    debounceMs: 180,
    defaultPageSize: 12,
    maxPageSize: 100,
    maxSearchLength: 300,

    selectors: {
      root: "[data-mo-filters]",
      search: "[data-filter-search]",
      control: "[data-filter-control]",
      sort: "[data-filter-sort]",
      pageSize: "[data-filter-page-size]",
      item: "[data-filter-item]",
      results: "[data-filter-results]",
      count: "[data-filter-count]",
      empty: "[data-filter-empty]",
      clear: "[data-filter-clear]",
      reset: "[data-filter-reset]",
      active: "[data-filter-active]",
      pagination: "[data-filter-pagination]",
      previous: "[data-filter-prev]",
      next: "[data-filter-next]",
      pageIndicator: "[data-filter-page-indicator]"
    }
  };

  var state = {
    initialized: false,
    destroyed: false,
    observer: null,
    instances: new WeakMap(),
    elements: new Set(),
    listeners: []
  };

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function normalize(value) {
    return cleanText(value, CONFIG.maxSearchLength)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  }

  function getElement(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function getElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function addListener(instance, element, eventName, handler, options) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler, options || false);

    instance.listeners.push(function () {
      element.removeEventListener(eventName, handler, options || false);
    });
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value == null || value === "") {
      return [];
    }

    return [value];
  }

  function parsePositiveInteger(value, fallback, maximum) {
    var parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return Math.min(parsed, maximum || CONFIG.maxPageSize);
  }

  function getNestedValue(object, path) {
    if (!object || typeof object !== "object" || !path) {
      return undefined;
    }

    var segments = String(path).split(".");
    var value = object;

    for (var i = 0; i < segments.length; i += 1) {
      var segment = segments[i];

      if (
        !segment ||
        segment === "__proto__" ||
        segment === "prototype" ||
        segment === "constructor" ||
        value == null ||
        typeof value !== "object" ||
        !Object.prototype.hasOwnProperty.call(value, segment)
      ) {
        return undefined;
      }

      value = value[segment];
    }

    return value;
  }

  function getItemValue(item, field) {
    if (!field) {
      return "";
    }

    if (item && item.nodeType === 1) {
      var attributeName = "data-filter-value-" +
        field.replace(/[^a-zA-Z0-9_-]/g, "-");

      var value = item.getAttribute(attributeName);

      if (value !== null) {
        return value;
      }

      var fieldElement = item.querySelector(
        '[data-filter-value="' + cssEscape(field) + '"]'
      );

      if (fieldElement) {
        return fieldElement.value !== undefined
          ? fieldElement.value
          : fieldElement.textContent;
      }

      return item.getAttribute("data-" + field) ||
        item.textContent ||
        "";
    }

    return getNestedValue(item, field);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function getItemText(item) {
    if (item && item.nodeType === 1) {
      return normalize(
        item.getAttribute("data-filter-search-text") ||
        item.textContent ||
        ""
      );
    }

    if (item && typeof item === "object") {
      return normalize(
        [
          item.name,
          item.title,
          item.description,
          item.summary,
          item.city,
          item.state,
          item.country,
          item.category,
          item.type,
          item.course,
          item.ownership,
          item.keywords
        ].flatMap(function (value) {
          return Array.isArray(value) ? value : [value];
        }).filter(function (value) {
          return value != null;
        }).join(" ")
      );
    }

    return normalize(item);
  }

  function readControls(instance) {
    var filters = [];

    getElements(instance.root, CONFIG.selectors.control).forEach(function (control) {
      var field = cleanText(control.getAttribute("data-filter-field"), 120);

      if (!field) {
        return;
      }

      if (
        (control.type === "checkbox" || control.type === "radio") &&
        !control.checked
      ) {
        return;
      }

      var rawValue = control.value;

      if (control.tagName === "SELECT" && control.multiple) {
        rawValue = Array.from(control.selectedOptions).map(function (option) {
          return option.value;
        });
      }

      if (Array.isArray(rawValue)) {
        rawValue = rawValue.filter(function (value) {
          return cleanText(value, 300) !== "";
        });
      } else if (typeof rawValue === "string") {
        rawValue = rawValue.trim();
      }

      if (
        rawValue === "" ||
        rawValue == null ||
        (Array.isArray(rawValue) && rawValue.length === 0)
      ) {
        return;
      }

      filters.push({
        field: field,
        value: rawValue,
        operator: cleanText(
          control.getAttribute("data-filter-operator") || "equals",
          40
        ).toLowerCase(),
        control: control
      });
    });

    return filters;
  }

  function matchesFilter(item, filter) {
    var itemValue = getItemValue(item, filter.field);
    var filterValues = toArray(filter.value).map(normalize);

    if (itemValue == null) {
      return filter.operator === "empty" ||
        filter.operator === "is-empty";
    }

    var itemValues = toArray(itemValue).map(normalize);
    var operator = filter.operator;

    if (operator === "empty" || operator === "is-empty") {
      return itemValues.every(function (value) {
        return value === "";
      });
    }

    if (operator === "not-empty" || operator === "is-not-empty") {
      return itemValues.some(function (value) {
        return value !== "";
      });
    }

    if (operator === "not-equals") {
      return itemValues.every(function (value) {
        return !filterValues.includes(value);
      });
    }

    if (operator === "contains") {
      return itemValues.some(function (itemValuePart) {
        return filterValues.some(function (filterValue) {
          return itemValuePart.includes(filterValue);
        });
      });
    }

    if (operator === "not-contains") {
      return itemValues.every(function (itemValuePart) {
        return filterValues.every(function (filterValue) {
          return !itemValuePart.includes(filterValue);
        });
      });
    }

    if (operator === "starts-with") {
      return itemValues.some(function (itemValuePart) {
        return filterValues.some(function (filterValue) {
          return itemValuePart.startsWith(filterValue);
        });
      });
    }

    if (operator === "ends-with") {
      return itemValues.some(function (itemValuePart) {
        return filterValues.some(function (filterValue) {
          return itemValuePart.endsWith(filterValue);
        });
      });
    }

    if (operator === "in") {
      return itemValues.some(function (value) {
        return filterValues.includes(value);
      });
    }

    if (operator === "not-in") {
      return itemValues.every(function (value) {
        return !filterValues.includes(value);
      });
    }

    if (operator === "greater-than" || operator === "gt") {
      return Number(itemValue) > Number(filter.value);
    }

    if (operator === "greater-or-equal" || operator === "gte") {
      return Number(itemValue) >= Number(filter.value);
    }

    if (operator === "less-than" || operator === "lt") {
      return Number(itemValue) < Number(filter.value);
    }

    if (operator === "less-or-equal" || operator === "lte") {
      return Number(itemValue) <= Number(filter.value);
    }

    if (operator === "true") {
      return itemValue === true || normalize(itemValue) === "true";
    }

    if (operator === "false") {
      return itemValue === false || normalize(itemValue) === "false";
    }

    // Default operator: exact, case-insensitive equality.
    return itemValues.some(function (value) {
      return filterValues.includes(value);
    });
  }

  function getSearchQuery(instance) {
    var search = getElement(instance.root, CONFIG.selectors.search);

    return normalize(search ? search.value : "");
  }

  function compareValues(a, b, direction) {
    var multiplier = direction === "desc" ? -1 : 1;

    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    var numberA = Number(a);
    var numberB = Number(b);

    if (
      String(a).trim() !== "" &&
      String(b).trim() !== "" &&
      Number.isFinite(numberA) &&
      Number.isFinite(numberB)
    ) {
      return (numberA - numberB) * multiplier;
    }

    return String(a).localeCompare(String(b), undefined, {
      numeric: true,
      sensitivity: "base"
    }) * multiplier;
  }

  function sortItems(instance, items) {
    var sortControl = getElement(instance.root, CONFIG.selectors.sort);

    if (!sortControl || !sortControl.value) {
      return items;
    }

    var sortValue = sortControl.value;
    var separator = sortValue.lastIndexOf(":");
    var field;
    var direction;

    if (separator > -1) {
      field = sortValue.slice(0, separator).trim();
      direction = sortValue.slice(separator + 1).trim().toLowerCase();
    } else {
      field = sortValue;
      direction = "asc";
    }

    if (!field || !["asc", "desc"].includes(direction)) {
      return items;
    }

    return items.slice().sort(function (a, b) {
      return compareValues(
        getItemValue(a, field),
        getItemValue(b, field),
        direction
      );
    });
  }

  function createAnnouncer(instance) {
    var existing = getElement(
      instance.root,
      "[data-filter-announcer]"
    );

    if (existing) {
      existing.setAttribute("aria-live", "polite");
      existing.setAttribute("aria-atomic", "true");
      return existing;
    }

    var region = document.createElement("div");
    region.setAttribute("data-filter-announcer", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "mo-filter-visually-hidden";
    instance.root.appendChild(region);

    return region;
  }

  function announce(instance, message) {
    if (!instance.announcer) {
      return;
    }

    instance.announcer.textContent = "";

    window.requestAnimationFrame(function () {
      if (instance.announcer && instance.announcer.isConnected) {
        instance.announcer.textContent = cleanText(message, 500);
      }
    });
  }

  function injectStyles() {
    if (document.getElementById("mo-filters-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mo-filters-styles";
    style.textContent = [
      ".mo-filter-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}",
      "[data-mo-filters] [hidden]{display:none!important}"
    ].join("\n");

    document.head.appendChild(style);
    state.styleElement = style;
  }

  function getItems(instance) {
    if (instance.dataItems) {
      return instance.dataItems.slice();
    }

    return getElements(instance.root, CONFIG.selectors.item);
  }

  function renderActiveFilters(instance, filters, query) {
    var container = getElement(instance.root, CONFIG.selectors.active);

    if (!container) {
      return;
    }

    container.replaceChildren();

    filters.forEach(function (filter) {
      var label = document.createElement("span");
      label.textContent = filter.field + ": " +
        toArray(filter.value).map(function (value) {
          return cleanText(value, 120);
        }).join(", ");

      container.appendChild(label);
    });

    if (query) {
      var searchLabel = document.createElement("span");
      searchLabel.textContent = "Search: " + query;
      container.appendChild(searchLabel);
    }

    container.hidden = filters.length === 0 && !query;
  }

  function renderResults(instance, results) {
    var allItems = instance.originalItems;
    var resultSet = new Set(results);
    var resultsContainer = getElement(
      instance.root,
      CONFIG.selectors.results
    );

    /*
     * DOM mode: hide nonmatching existing items, and reorder
     * visible items when sorting. No item HTML is reconstructed.
     */
    if (!instance.dataItems) {
      allItems.forEach(function (item) {
        item.hidden = !resultSet.has(item);
      });

      if (resultsContainer) {
        var fragment = document.createDocumentFragment();

        results.forEach(function (item) {
          fragment.appendChild(item);
        });

        resultsContainer.appendChild(fragment);
      }
    }

    var count = getElement(instance.root, CONFIG.selectors.count);

    if (count) {
      count.textContent = String(results.length);
    }

    var empty = getElement(instance.root, CONFIG.selectors.empty);

    if (empty) {
      empty.hidden = results.length > 0;
    }

    var pageSizeControl = getElement(
      instance.root,
      CONFIG.selectors.pageSize
    );

    if (pageSizeControl) {
      instance.pageSize = parsePositiveInteger(
        pageSizeControl.value,
        instance.pageSize,
        CONFIG.maxPageSize
      );
    }

    var pageCount = Math.max(
      1,
      Math.ceil(results.length / instance.pageSize)
    );

    instance.currentPage = Math.min(instance.currentPage, pageCount);

    var start = (instance.currentPage - 1) * instance.pageSize;
    var pageItems = results.slice(start, start + instance.pageSize);

    if (!instance.dataItems) {
      var visibleSet = new Set(pageItems);

      allItems.forEach(function (item) {
        item.hidden = !visibleSet.has(item);
      });
    } else if (typeof instance.render === "function") {
      instance.render(pageItems, results);
    }

    var pagination = getElement(
      instance.root,
      CONFIG.selectors.pagination
    );

    if (pagination) {
      pagination.hidden = pageCount <= 1;
    }

    var previous = getElement(instance.root, CONFIG.selectors.previous);
    var next = getElement(instance.root, CONFIG.selectors.next);
    var indicator = getElement(
      instance.root,
      CONFIG.selectors.pageIndicator
    );

    if (previous) {
      previous.disabled = instance.currentPage <= 1;
      previous.setAttribute("aria-disabled", String(previous.disabled));
    }

    if (next) {
      next.disabled = instance.currentPage >= pageCount;
      next.setAttribute("aria-disabled", String(next.disabled));
    }

    if (indicator) {
      indicator.textContent =
        "Page " + instance.currentPage + " of " + pageCount;
    }
  }

  function apply(instance, shouldAnnounce) {
    var filters = readControls(instance);
    var query = getSearchQuery(instance);

    var results = getItems(instance).filter(function (item) {
      var text = getItemText(item);

      if (query && !text.includes(query)) {
        return false;
      }

      return filters.every(function (filter) {
        return matchesFilter(item, filter);
      });
    });

    results = sortItems(instance, results);

    instance.filteredItems = results;
    instance.currentPage = 1;

    renderActiveFilters(instance, filters, query);
    renderResults(instance, results);

    if (shouldAnnounce) {
      announce(
        instance,
        results.length +
          (results.length === 1 ? " result found." : " results found.")
      );
    }

    return results;
  }

  function reset(instance) {
    getElements(instance.root, CONFIG.selectors.control).forEach(function (control) {
      if (control.type === "checkbox" || control.type === "radio") {
        control.checked = false;
      } else if (control.tagName === "SELECT" && control.multiple) {
        Array.from(control.options).forEach(function (option) {
          option.selected = false;
        });
      } else {
        control.value = "";
      }
    });

    var search = getElement(instance.root, CONFIG.selectors.search);

    if (search) {
      search.value = "";
    }

    var sort = getElement(instance.root, CONFIG.selectors.sort);

    if (sort) {
      sort.value = "";
    }

    instance.currentPage = 1;
    apply(instance, true);
  }

  function initializeRoot(root) {
    if (!root || state.instances.has(root)) {
      return state.instances.get(root) || null;
    }

    var resultsContainer = getElement(root, CONFIG.selectors.results);

    var instance = {
      root: root,
      listeners: [],
      originalItems: getElements(
        resultsContainer || root,
        CONFIG.selectors.item
      ),
      dataItems: null,
      filteredItems: [],
      render: null,
      currentPage: 1,
      pageSize: parsePositiveInteger(
        root.getAttribute("data-filter-page-size"),
        CONFIG.defaultPageSize,
        CONFIG.maxPageSize
      ),
      debounceTimer: null,
      announcer: null
    };

    state.instances.set(root, instance);
    state.elements.add(root);

    instance.announcer = createAnnouncer(instance);

    var search = getElement(root, CONFIG.selectors.search);

    if (search) {
      addListener(instance, search, "input", function () {
        if (instance.debounceTimer) {
          window.clearTimeout(instance.debounceTimer);
        }

        instance.debounceTimer = window.setTimeout(function () {
          apply(instance, true);
        }, CONFIG.debounceMs);
      });
    }

    getElements(root, CONFIG.selectors.control).forEach(function (control) {
      addListener(instance, control, "change", function () {
        apply(instance, true);
      });
    });

    var sort = getElement(root, CONFIG.selectors.sort);

    if (sort) {
      addListener(instance, sort, "change", function () {
        apply(instance, true);
      });
    }

    var pageSize = getElement(root, CONFIG.selectors.pageSize);

    if (pageSize) {
      addListener(instance, pageSize, "change", function () {
        instance.pageSize = parsePositiveInteger(
          pageSize.value,
          CONFIG.defaultPageSize,
          CONFIG.maxPageSize
        );

        instance.currentPage = 1;
        apply(instance, true);
      });
    }

    var clearButton = getElement(root, CONFIG.selectors.clear);

    if (clearButton) {
      addListener(instance, clearButton, "click", function () {
        reset(instance);
      });
    }

    var resetButton = getElement(root, CONFIG.selectors.reset);

    if (resetButton) {
      addListener(instance, resetButton, "click", function () {
        reset(instance);
      });
    }

    var previous = getElement(root, CONFIG.selectors.previous);

    if (previous) {
      addListener(instance, previous, "click", function () {
        if (instance.currentPage > 1) {
          instance.currentPage -= 1;
          renderResults(instance, instance.filteredItems);
          announce(instance, "Page " + instance.currentPage + ".");
        }
      });
    }

    var next = getElement(root, CONFIG.selectors.next);

    if (next) {
      addListener(instance, next, "click", function () {
        var pages = Math.max(
          1,
          Math.ceil(instance.filteredItems.length / instance.pageSize)
        );

        if (instance.currentPage < pages) {
          instance.currentPage += 1;
          renderResults(instance, instance.filteredItems);
          announce(instance, "Page " + instance.currentPage + ".");
        }
      });
    }

    apply(instance, false);
    return instance;
  }

  function refresh() {
    if (state.destroyed) {
      return;
    }

    injectStyles();

    getElements(document, CONFIG.selectors.root).forEach(function (root) {
      initializeRoot(root);
    });
  }

  function findInstance(rootOrElement) {
    if (!rootOrElement) {
      return null;
    }

    var root = rootOrElement.matches &&
      rootOrElement.matches(CONFIG.selectors.root)
      ? rootOrElement
      : rootOrElement.closest
        ? rootOrElement.closest(CONFIG.selectors.root)
        : null;

    return root ? state.instances.get(root) || null : null;
  }

  function setData(rootOrElement, items, renderCallback) {
    var instance = findInstance(rootOrElement);

    if (!instance) {
      throw new Error("No initialized filter component was found.");
    }

    if (!Array.isArray(items)) {
      throw new TypeError("Filter data must be an array.");
    }

    instance.dataItems = items.slice();
    instance.render = typeof renderCallback === "function"
      ? renderCallback
      : null;

    instance.currentPage = 1;
    return apply(instance, true);
  }

  function getResults(rootOrElement) {
    var instance = findInstance(rootOrElement);

    return instance ? instance.filteredItems.slice() : [];
  }

  function destroyInstance(instance) {
    if (instance.debounceTimer) {
      window.clearTimeout(instance.debounceTimer);
    }

    instance.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    instance.listeners = [];
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.elements.forEach(function (root) {
      var instance = state.instances.get(root);

      if (instance) {
        destroyInstance(instance);
      }
    });

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.elements.clear();
    state.listeners = [];
    state.destroyed = true;
  }

  var publicAPI = {
    version: "1.0.0",
    refresh: refresh,
    apply: function (rootOrElement) {
      var instance = findInstance(rootOrElement);
      return instance ? apply(instance, true) : [];
    },
    reset: function (rootOrElement) {
      var instance = findInstance(rootOrElement);
      if (!instance) return false;
      reset(instance);
      return true;
    },
    setData: setData,
    getResults: getResults,
    destroy: destroy,
    configure: function (options) {
      if (!options || typeof options !== "object") {
        return false;
      }

      if (Number.isFinite(options.debounceMs) && options.debounceMs >= 0) {
        CONFIG.debounceMs = Math.min(options.debounceMs, 5000);
      }

      if (Number.isInteger(options.defaultPageSize) && options.defaultPageSize > 0) {
        CONFIG.defaultPageSize = Math.min(
          options.defaultPageSize,
          CONFIG.maxPageSize
        );
      }

      return true;
    }
  };

  window[GLOBAL_KEY] = publicAPI;
  window.MedOrbitsFilters = publicAPI;

  function initialize() {
    if (state.initialized || state.destroyed) {
      return;
    }

    state.initialized = true;
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(CONFIG.selectors.root)) ||
                (node.querySelector && node.querySelector(CONFIG.selectors.root))
              );
          });
        });

        if (shouldRefresh) {
          refresh();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
