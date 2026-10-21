
/* =========================================================
   MedOrbits -- assets/js/filters.js
   Reusable filtering, sorting, searching, and URL sync
   Version: 1.2.0
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsFilters) return;

  const state = {
    collections: new Map(),
    initialized: false
  };

  function normalize(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value).toLowerCase();
      } catch {
        return "";
      }
    }
    return String(value).trim().toLowerCase();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getValue(item, path) {
    if (!path) return item;

    return String(path).split(".").reduce((value, key) => {
      return value == null ? undefined : value[key];
    }, item);
  }

  function compareValues(a, b, direction = "asc") {
    const multiplier = direction === "desc" ? -1 : 1;

    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;

    const stringA = String(a).trim();
    const stringB = String(b).trim();

    const numberA = Number(a);
    const numberB = Number(b);

    if (
      stringA !== "" &&
      stringB !== "" &&
      Number.isFinite(numberA) &&
      Number.isFinite(numberB)
    ) {
      return (numberA - numberB) * multiplier;
    }

    return stringA.localeCompare(stringB, undefined, {
      numeric: true,
      sensitivity: "base"
    }) * multiplier;
  }

  function parseList(value) {
    if (Array.isArray(value)) return value;

    if (value === null || value === undefined || value === "") {
      return [];
    }

    return String(value)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }

  function matchesSearch(item, query, fields = []) {
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) return true;

    const values = fields.length
      ? fields.map(field => getValue(item, field))
      : Object.values(
          item && typeof item === "object" ? item : {}
        );

    const searchable = values
      .flatMap(value => Array.isArray(value) ? value : [value])
      .filter(value => value !== null && value !== undefined)
      .map(normalize)
      .join(" ");

    return searchable.includes(normalizedQuery);
  }

  function matchesCondition(item, condition) {
    if (!condition || typeof condition !== "object") return true;

    const value = getValue(item, condition.field);
    const expected = condition.value;
    const operator = condition.operator || "equals";

    switch (operator) {
      case "equals":
        return normalize(value) === normalize(expected);

      case "notEquals":
        return normalize(value) !== normalize(expected);

      case "contains":
        return normalize(value).includes(normalize(expected));

      case "notContains":
        return !normalize(value).includes(normalize(expected));

      case "startsWith":
        return normalize(value).startsWith(normalize(expected));

      case "endsWith":
        return normalize(value).endsWith(normalize(expected));

      case "greaterThan":
        return value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value)) &&
          Number(value) > Number(expected);

      case "greaterThanOrEqual":
        return value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value)) &&
          Number(value) >= Number(expected);

      case "lessThan":
        return value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value)) &&
          Number(value) < Number(expected);

      case "lessThanOrEqual":
        return value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(Number(value)) &&
          Number(value) <= Number(expected);

      case "between": {
        const min = Number(condition.min);
        const max = Number(condition.max);
        const number = Number(value);

        return value !== null &&
          value !== undefined &&
          value !== "" &&
          Number.isFinite(number) &&
          Number.isFinite(min) &&
          Number.isFinite(max) &&
          number >= Math.min(min, max) &&
          number <= Math.max(min, max);
      }

      case "in":
        return parseList(expected).some(option =>
          normalize(option) === normalize(value)
        );

      case "notIn":
        return !parseList(expected).some(option =>
          normalize(option) === normalize(value)
        );

      case "isEmpty":
        return value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "");

      case "isNotEmpty":
        return value !== null &&
          value !== undefined &&
          !(typeof value === "string" && value.trim() === "");

      case "truthy":
        return Boolean(value);

      case "falsy":
        return !value;

      default:
        return true;
    }
  }

  function filterItems(items = [], options = {}) {
    if (!Array.isArray(items)) return [];

    const {
      search = "",
      searchFields = [],
      conditions = [],
      filters = {},
      customFilter,
      match = "all"
    } = options;

    let results = items.filter(item => {
      if (!matchesSearch(item, search, searchFields)) {
        return false;
      }

      const conditionResults = conditions.map(condition =>
        matchesCondition(item, condition)
      );

      const conditionsMatch = match === "any"
        ? conditionResults.some(Boolean)
        : conditionResults.every(Boolean);

      if (!conditionsMatch) return false;

      for (const [field, expected] of Object.entries(filters || {})) {
        if (
          expected === "" ||
          expected === null ||
          expected === undefined
        ) {
          continue;
        }

        const value = getValue(item, field);

        if (Array.isArray(expected)) {
          if (
            expected.length &&
            !expected.some(option =>
              normalize(option) === normalize(value)
            )
          ) {
            return false;
          }
        } else if (
          expected &&
          typeof expected === "object"
        ) {
          if (!matchesCondition(item, { ...expected, field })) {
            return false;
          }
        } else if (normalize(value) !== normalize(expected)) {
          return false;
        }
      }

      return typeof customFilter !== "function" ||
        Boolean(customFilter(item));
    });

    if (options.sortBy) {
      results = sortItems(
        results,
        options.sortBy,
        options.sortDirection
      );
    }

    const offset = Number(options.offset);

    if (Number.isFinite(offset) && offset > 0) {
      results = results.slice(Math.floor(offset));
    }

    const limit = Number(options.limit);

    if (
      options.limit !== undefined &&
      options.limit !== null &&
      options.limit !== "" &&
      Number.isFinite(limit) &&
      limit >= 0
    ) {
      results = results.slice(0, Math.floor(limit));
    }

    return results;
  }

  function sortItems(items = [], sortBy, direction = "asc") {
    if (!Array.isArray(items) || !sortBy) {
      return Array.isArray(items) ? [...items] : [];
    }

    const fields = Array.isArray(sortBy) ? sortBy : [sortBy];

    return [...items].sort((a, b) => {
      for (const field of fields) {
        const path = typeof field === "string"
          ? field
          : field.field;

        const order = typeof field === "string"
          ? direction
          : field.direction || direction;

        const result = compareValues(
          getValue(a, path),
          getValue(b, path),
          order
        );

        if (result !== 0) return result;
      }

      return 0;
    });
  }

  function getUniqueValues(items = [], field, options = {}) {
    if (!Array.isArray(items)) return [];

    const values = items
      .map(item => getValue(item, field))
      .filter(value =>
        value !== null &&
        value !== undefined &&
        value !== ""
      );

    const unique = [
      ...new Map(
        values.map(value => [normalize(value), value])
      ).values()
    ];

    if (options.sort !== false) {
      unique.sort((a, b) =>
        compareValues(a, b, options.direction || "asc")
      );
    }

    return unique;
  }

  function getNumericRange(items = [], field) {
    if (!Array.isArray(items)) {
      return { min: null, max: null };
    }

    const values = items
      .map(item => getValue(item, field))
      .filter(value =>
        value !== null &&
        value !== undefined &&
        value !== ""
      )
      .map(Number)
      .filter(Number.isFinite);

    if (!values.length) {
      return { min: null, max: null };
    }

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  function getFacets(items = [], fields = []) {
    const facets = {};

    fields.forEach(field => {
      facets[field] = getUniqueValues(items, field);
    });

    return facets;
  }

  function getPagination(total, page = 1, pageSize = 10) {
    const totalItems = Math.max(
      0,
      Math.floor(Number(total) || 0)
    );

    const safePageSize = Math.max(
      1,
      Math.floor(Number(pageSize) || 10)
    );

    const totalPages = Math.max(
      1,
      Math.ceil(totalItems / safePageSize)
    );

    const requestedPage = Number(page);

    const currentPage = Math.max(
      1,
      Math.min(
        Number.isFinite(requestedPage)
          ? Math.floor(requestedPage)
          : 1,
        totalPages
      )
    );

    return {
      total: totalItems,
      page: currentPage,
      pageSize: safePageSize,
      totalPages,
      start: totalItems
        ? (currentPage - 1) * safePageSize
        : 0,
      end: Math.min(
        currentPage * safePageSize,
        totalItems
      ),
      hasPrevious: currentPage > 1,
      hasNext: currentPage < totalPages
    };
  }

  function paginate(items = [], page = 1, pageSize = 10) {
    if (!Array.isArray(items)) {
      return {
        items: [],
        pagination: getPagination(0, page, pageSize)
      };
    }

    const pagination = getPagination(
      items.length,
      page,
      pageSize
    );

    return {
      items: items.slice(
        pagination.start,
        pagination.start + pagination.pageSize
      ),
      pagination
    };
  }

  function readURLFilters(keys = []) {
    const params = new URLSearchParams(window.location.search);
    const filters = {};

    keys.forEach(key => {
      if (params.has(key)) {
        const values = params.getAll(key);
        filters[key] = values.length > 1
          ? values
          : values[0];
      }
    });

    return filters;
  }

  function writeURLFilters(filters = {}, options = {}) {
    const url = new URL(window.location.href);

    Object.entries(filters).forEach(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        url.searchParams.delete(key);
        return;
      }

      url.searchParams.delete(key);

      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item !== null && item !== undefined && item !== "") {
            url.searchParams.append(key, String(item));
          }
        });
      } else {
        url.searchParams.set(key, String(value));
      }
    });

    if (options.replace) {
      window.history.replaceState(
        window.history.state,
        "",
        url
      );
    } else {
      window.history.pushState(
        window.history.state,
        "",
        url
      );
    }

    return url;
  }

  function resolveElement(element) {
    if (!element) return null;

    return typeof element === "string"
      ? document.querySelector(element)
      : element;
  }

  function getFormValues(form) {
    const target = resolveElement(form);

    if (!target || typeof target.querySelectorAll !== "function") {
      return {};
    }

    const values = {};
    const data = new FormData(target);

    for (const [key, value] of data.entries()) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        values[key] = Array.isArray(values[key])
          ? [...values[key], value]
          : [values[key], value];
      } else {
        values[key] = value;
      }
    }

    target.querySelectorAll(
      'input[type="checkbox"][name], input[type="radio"][name]'
    ).forEach(input => {
      if (
        !input.checked &&
        !Object.prototype.hasOwnProperty.call(values, input.name)
      ) {
        values[input.name] = "";
      }
    });

    return values;
  }

  function applyFormFilters(items, form, options = {}) {
    const values = getFormValues(form);

    const searchField = options.searchField || "search";
    const sortField = options.sortField || "sortBy";
    const directionField = options.directionField || "sortDirection";

    const search = values[searchField] || "";
    const sortBy = values[sortField] || options.sortBy || "";
    const sortDirection =
      values[directionField] || options.sortDirection || "asc";

    delete values[searchField];
    delete values[sortField];
    delete values[directionField];

    const filters = {
      ...(options.filters || {})
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        delete filters[key];
      } else {
        filters[key] = value;
      }
    });

    return filterItems(items, {
      ...options,
      search,
      filters,
      sortBy,
      sortDirection
    });
  }

  function createFilterController(config = {}) {
    const id = config.id ||
      `filters-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (state.collections.has(id)) {
      state.collections.get(id).destroy();
    }

    const controller = {
      id,
      items: Array.isArray(config.items) ? [...config.items] : [],
      filtered: [],
      options: { ...(config.options || {}) },
      listeners: new Set(),

      setItems(items) {
        this.items = Array.isArray(items) ? [...items] : [];
        return this.apply();
      },

      setOptions(options = {}) {
        this.options = {
          ...this.options,
          ...options
        };

        return this.apply();
      },

      apply() {
        this.filtered = filterItems(this.items, this.options);

        const snapshot = this.getState();

        this.listeners.forEach(callback => {
          try {
            callback(snapshot);
          } catch (error) {
            console.error(
              "[MedOrbits Filters] Listener error:",
              error
            );
          }
        });

        return this.getItems();
      },

      getItems() {
        return [...this.filtered];
      },

      getAllItems() {
        return [...this.items];
      },

      getState() {
        return {
          id: this.id,
          total: this.items.length,
          count: this.filtered.length,
          items: this.getItems(),
          options: { ...this.options }
        };
      },

      subscribe(callback) {
        if (typeof callback !== "function") {
          return function () {};
        }

        this.listeners.add(callback);

        return () => this.listeners.delete(callback);
      },

      clear() {
        this.options = {};
        return this.apply();
      },

      destroy() {
        this.listeners.clear();
        state.collections.delete(this.id);
      }
    };

    controller.apply();
    state.collections.set(id, controller);

    return controller;
  }

  function bindForm(form, options = {}) {
    const target = resolveElement(form);

    if (!target) return null;

    const controller = options.controller ||
      createFilterController({
        id: options.id,
        items: options.items || [],
        options: options.filterOptions || {}
      });

    const renderCallback = typeof options.render === "function"
      ? options.render
      : null;

    let destroyed = false;

    function update() {
      if (destroyed) return [];

      const filtered = applyFormFilters(
        controller.getAllItems(),
        target,
        options
      );

      controller.filtered = filtered;

      const snapshot = controller.getState();

      controller.listeners.forEach(callback => {
        try {
          callback(snapshot);
        } catch (error) {
          console.error(
            "[MedOrbits Filters] Listener error:",
            error
          );
        }
      });

      if (renderCallback) {
        renderCallback([...filtered], snapshot);
      }

      target.dispatchEvent(
        new CustomEvent("medorbits:filters-applied", {
          bubbles: true,
          detail: {
            count: filtered.length,
            items: [...filtered]
          }
        })
      );

      return filtered;
    }

    function onSubmit(event) {
      event.preventDefault();
      update();
    }

    function onInput() {
      update();
    }

    function onReset() {
      window.setTimeout(update, 0);
    }

    target.addEventListener("submit", onSubmit);

    if (options.live !== false) {
      target.addEventListener("input", onInput);
      target.addEventListener("change", onInput);
    }

    target.addEventListener("reset", onReset);

    if (options.applyOnInit !== false) {
      update();
    }

    return {
      controller,
      apply: update,

      destroy() {
        destroyed = true;
        target.removeEventListener("submit", onSubmit);
        target.removeEventListener("input", onInput);
        target.removeEventListener("change", onInput);
        target.removeEventListener("reset", onReset);

        if (!options.controller) {
          controller.destroy();
        }
      }
    };
  }

  function renderOptions(select, values = [], options = {}) {
    const target = resolveElement(select);

    if (!target) return false;

    const placeholder = options.placeholder || "All";
    const selectedValue = options.selected ?? target.value;
    const fragment = document.createDocumentFragment();

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = placeholder;
    fragment.appendChild(defaultOption);

    values.forEach(item => {
      const value = item && typeof item === "object"
        ? item.value
        : item;

      const label = item && typeof item === "object"
        ? item.label ?? item.value
        : item;

      const option = document.createElement("option");

      option.value = String(value ?? "");
      option.textContent = String(label ?? "");
      option.selected =
        normalize(value) === normalize(selectedValue);

      fragment.appendChild(option);
    });

    target.replaceChildren(fragment);

    return true;
  }

  function updateResultCount(container, count, total = count) {
    const target = resolveElement(container);

    if (!target) return false;

    const safeCount = Math.max(0, Number(count) || 0);
    const safeTotal = Math.max(0, Number(total) || 0);

    target.textContent = safeCount === safeTotal
      ? `${safeCount} results`
      : `${safeCount} of ${safeTotal} results`;

    target.setAttribute("aria-live", "polite");

    return true;
  }

  function clearForm(form) {
    const target = resolveElement(form);

    if (!target || typeof target.reset !== "function") {
      return false;
    }

    target.reset();

    target.querySelectorAll("[data-filter-value]").forEach(element => {
      element.value = "";
    });

    return true;
  }

  function init(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") {
      return api;
    }

    const forms = [];

    if (
      root instanceof Element &&
      root.matches("[data-filter-form]")
    ) {
      forms.push(root);
    }

    forms.push(...root.querySelectorAll("[data-filter-form]"));

    forms.forEach(form => {
      if (form.dataset.filtersInitialized === "true") return;

      form.dataset.filtersInitialized = "true";

      form.addEventListener("submit", event => {
        event.preventDefault();

        form.dispatchEvent(
          new CustomEvent("medorbits:filter-submit", {
            bubbles: true,
            detail: {
              values: getFormValues(form)
            }
          })
        );
      });

      form.addEventListener("reset", () => {
        window.setTimeout(() => {
          form.dispatchEvent(
            new CustomEvent("medorbits:filter-reset", {
              bubbles: true
            })
          );
        }, 0);
      });
    });

    state.initialized = true;

    return api;
  }

  const api = Object.freeze({
    init,
    normalize,
    escapeHTML,
    getValue,
    compareValues,
    parseList,
    matchesSearch,
    matchesCondition,
    filterItems,
    sortItems,
    getUniqueValues,
    getNumericRange,
    getFacets,
    getPagination,
    paginate,
    readURLFilters,
    writeURLFilters,
    getFormValues,
    applyFormFilters,
    createFilterController,
    bindForm,
    renderOptions,
    updateResultCount,
    clearForm
  });

  window.MedOrbitsFilters = api;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => init(),
      { once: true }
    );
  } else {
    init();
  }

})(window, document);
