
/**
 * MedOrbits Search Engine
 * File: /assets/js/search.js
 * Version: 1.3.0
 *
 * Improvements:
 * - Preserves existing public APIs and endpoint conventions.
 * - Prevents stale search and suggestion responses from overwriting newer results.
 * - Cancels superseded requests and cleans up pending timers.
 * - Safely renders result content without injecting HTML from API responses.
 * - Supports filters, sorting, pagination, recent searches and URL synchronization.
 * - Provides accessible loading, empty and error states.
 * - Supports custom events and on/off subscriptions.
 * - Avoids duplicate delegated event listeners.
 */

(function (window, document) {
  "use strict";

  if (window.MedorbitsSearch) return;

  const root = window;
  const doc = document;

  const config = root.MedOrbitsConfig || {};

  const API_BASE = String(
    config.API_BASE_URL ||
    config.apiBaseUrl ||
    "/api"
  ).replace(/\/+$/, "");

  const SEARCH_ENDPOINT = API_BASE + "/search";
  const SUGGESTIONS_ENDPOINT = API_BASE + "/search/suggestions";

  const STORAGE_KEY = "medorbits_recent_searches";
  const MAX_RECENT_SEARCHES = 8;
  const DEFAULT_PAGE_SIZE = 10;
  const MAX_PAGE_SIZE = 100;
  const MIN_QUERY_LENGTH = 2;
  const DEBOUNCE_DELAY = 300;
  const SUGGESTION_LIMIT = 8;

  const EVENTS = {
    SEARCH_STARTED: "medorbits:search:started",
    SEARCH_COMPLETED: "medorbits:search:completed",
    SEARCH_ERROR: "medorbits:search:error",
    SUGGESTIONS_UPDATED: "medorbits:search:suggestions",
    RESULTS_UPDATED: "medorbits:search:results",
    FILTERS_UPDATED: "medorbits:search:filters",
    PAGE_CHANGED: "medorbits:search:page",
    RECENT_UPDATED: "medorbits:search:recent",
    SAVE_REQUESTED: "medorbits:search:save"
  };

  const state = {
    query: "",
    category: "",
    filters: {},
    sort: "relevance",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    results: [],
    suggestions: [],
    recent: [],
    loading: false,
    error: null,
    initialized: false,
    searchController: null,
    suggestionController: null,
    searchSequence: 0,
    suggestionSequence: 0,
    timers: new Map(),
    listeners: new Map(),
    lastResponse: null
  };

  const SELECTORS = {
    form: "[data-search-form]",
    input: "[data-search-input]",
    results: "[data-search-results]",
    suggestions: "[data-search-suggestions]",
    recent: "[data-search-recent]",
    category: "[data-search-category]",
    page: "[data-search-page]",
    sort: "[data-search-sort]",
    pageSize: "[data-search-page-size]",
    filter: "[data-search-filter]",
    save: "[data-search-save]",
    total: "[data-search-total]",
    query: "[data-search-query]",
    loading: "[data-search-loading]"
  };

  /* ---------------------------------------------------------
     Utilities
  --------------------------------------------------------- */

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function toText(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    return fallback || "";
  }

  function positiveInteger(value, fallback, maximum) {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    return maximum
      ? Math.min(parsed, maximum)
      : parsed;
  }

  function normalizeQuery(value) {
    return toText(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value) {
    return toText(value)
      .trim()
      .replace(/[^\w.-]/g, "");
  }

  function dispatch(name, detail) {
    const payload = detail || {};

    try {
      doc.dispatchEvent(
        new CustomEvent(name, {
          detail: payload,
          bubbles: false
        })
      );
    } catch (_) {
      // Custom events are optional integrations.
    }

    const subscribers = state.listeners.get(name);

    if (subscribers) {
      subscribers.forEach(function (callback) {
        try {
          callback(payload);
        } catch (error) {
          console.error(
            "[MedOrbits Search] Subscriber error:",
            error
          );
        }
      });
    }
  }

  function emitError(error, context) {
    const detail = {
      error: toText(
        error && error.message,
        "An unexpected search error occurred."
      ),
      context: context || "search"
    };

    dispatch(EVENTS.SEARCH_ERROR, detail);
  }

  function getHeaders() {
    const headers = {
      Accept: "application/json"
    };

    const token =
      root.localStorage &&
      root.localStorage.getItem("medorbits_token");

    if (token) {
      headers.Authorization = "Bearer " + token;
    }

    return headers;
  }

  function buildUrl(endpoint, params) {
    const url = new URL(endpoint, root.location.origin);

    Object.keys(params || {}).forEach(function (key) {
      const value = params[key];

      if (value === null || value === undefined || value === "") {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach(function (item) {
          url.searchParams.append(key, String(item));
        });
        return;
      }

      if (isObject(value)) {
        Object.keys(value).forEach(function (nestedKey) {
          const nestedValue = value[nestedKey];

          if (
            nestedValue !== null &&
            nestedValue !== undefined &&
            nestedValue !== ""
          ) {
            url.searchParams.append(
              key + "[" + nestedKey + "]",
              String(nestedValue)
            );
          }
        });

        return;
      }

      url.searchParams.set(key, String(value));
    });

    return url.toString();
  }

  async function request(url, options) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...getHeaders(),
        ...(options && options.headers)
      }
    });

    if (!response.ok) {
      let message = "Request failed (" + response.status + ").";

      try {
        const body = await response.json();

        message = toText(
          body.message ||
          body.error ||
          body.detail,
          message
        );
      } catch (_) {
        // Keep the HTTP status message.
      }

      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "The search API returned an unexpected response format."
      );
    }

    return response.json();
  }

  function isAbortError(error) {
    return Boolean(
      error &&
      (
        error.name === "AbortError" ||
        error.code === "ABORT_ERR"
      )
    );
  }

  function safeInternalUrl(value) {
    const raw = toText(value).trim();

    if (!raw) return "";

    try {
      const url = new URL(raw, root.location.origin);

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      if (url.origin !== root.location.origin) {
        return "";
      }

      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "";
    }
  }

  function createElement(tag, className, text) {
    const element = doc.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function setTextAll(selector, value) {
    doc.querySelectorAll(selector).forEach(function (element) {
      element.textContent = toText(value);
    });
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);

    doc.querySelectorAll(SELECTORS.loading).forEach(function (element) {
      element.hidden = !state.loading;
      element.setAttribute(
        "aria-hidden",
        state.loading ? "false" : "true"
      );
    });

    doc.querySelectorAll(SELECTORS.form).forEach(function (form) {
      form.setAttribute(
        "aria-busy",
        state.loading ? "true" : "false"
      );
    });

    doc.querySelectorAll(SELECTORS.results).forEach(function (container) {
      container.setAttribute(
        "aria-busy",
        state.loading ? "true" : "false"
      );
    });
  }

  /* ---------------------------------------------------------
     Response normalization
  --------------------------------------------------------- */

  function normalizeResult(item) {
    if (!isObject(item)) return null;

    const title = toText(
      item.title ||
      item.name ||
      item.label ||
      item.heading,
      "Untitled result"
    );

    const description = toText(
      item.description ||
      item.summary ||
      item.excerpt ||
      item.snippet
    );

    const url = safeInternalUrl(
      item.url ||
      item.href ||
      item.link ||
      item.path
    );

    return {
      ...item,
      title: title,
      description: description,
      url: url,
      category: toText(
        item.category ||
        item.type ||
        item.contentType,
        "Resource"
      ),
      id: toText(
        item.id ||
        item.slug ||
        url ||
        title
      )
    };
  }

  function normalizeResponse(response) {
    const data = isObject(response) ? response : {};

    const candidates = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.documents)
            ? data.documents
            : [];

    const results = candidates
      .map(normalizeResult)
      .filter(Boolean);

    const pagination = isObject(data.pagination)
      ? data.pagination
      : {};

    const total = positiveInteger(
      data.total !== undefined
        ? data.total
        : data.totalCount !== undefined
          ? data.totalCount
          : pagination.total,
      results.length
    );

    return {
      results: results,
      total: total,
      totalPages: positiveInteger(
        data.totalPages !== undefined
          ? data.totalPages
          : pagination.totalPages,
        Math.ceil(total / state.pageSize)
      ),
      page: positiveInteger(
        data.page !== undefined
          ? data.page
          : pagination.page,
        state.page
      ),
      pageSize: positiveInteger(
        data.pageSize !== undefined
          ? data.pageSize
          : pagination.pageSize,
        state.pageSize,
        MAX_PAGE_SIZE
      ),
      raw: data
    };
  }

  function normalizeSuggestions(response) {
    const data = isObject(response) ? response : {};

    const candidates = Array.isArray(response)
      ? response
      : Array.isArray(data.suggestions)
        ? data.suggestions
        : Array.isArray(data.results)
          ? data.results
          : Array.isArray(data.items)
            ? data.items
            : [];

    const seen = new Set();

    return candidates
      .map(function (item) {
        return typeof item === "string"
          ? item.trim()
          : toText(
              item && (
                item.query ||
                item.title ||
                item.name ||
                item.value
              )
            ).trim();
      })
      .filter(function (value) {
        const key = value.toLowerCase();

        if (!value || seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .slice(0, SUGGESTION_LIMIT);
  }

  /* ---------------------------------------------------------
     Recent searches
  --------------------------------------------------------- */

  function loadRecentSearches() {
    try {
      const stored = root.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];

      state.recent = Array.isArray(parsed)
        ? parsed
            .filter(function (item) {
              return typeof item === "string" && item.trim();
            })
            .map(normalizeQuery)
            .filter(Boolean)
            .slice(0, MAX_RECENT_SEARCHES)
        : [];
    } catch (_) {
      state.recent = [];
    }

    renderRecentSearches();
  }

  function saveRecentSearch(query) {
    const normalized = normalizeQuery(query);

    if (!normalized) return;

    state.recent = [
      normalized,
      ...state.recent.filter(function (item) {
        return item.toLowerCase() !== normalized.toLowerCase();
      })
    ].slice(0, MAX_RECENT_SEARCHES);

    try {
      root.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.recent)
      );
    } catch (_) {
      // Search still works when storage is unavailable.
    }

    renderRecentSearches();

    dispatch(EVENTS.RECENT_UPDATED, {
      recent: state.recent.slice()
    });
  }

  function renderRecentSearches() {
    doc.querySelectorAll(SELECTORS.recent).forEach(function (container) {
      container.replaceChildren();

      state.recent.forEach(function (query) {
        const button = createElement(
          "button",
          "medorbits-search-recent-item",
          query
        );

        button.type = "button";
        button.dataset.searchRecent = query;
        button.setAttribute("aria-label", "Search for " + query);

        container.appendChild(button);
      });

      container.hidden = state.recent.length === 0;
    });
  }

  /* ---------------------------------------------------------
     Search request
  --------------------------------------------------------- */

  function getSearchParams(overrides) {
    const params = {
      q: state.query,
      query: state.query,
      category: state.category,
      sort: state.sort,
      page: state.page,
      pageSize: state.pageSize
    };

    Object.keys(state.filters).forEach(function (key) {
      params["filter[" + key + "]"] = state.filters[key];
    });

    return Object.assign(params, overrides || {});
  }

  async function search(query, options) {
    const settings = options || {};

    if (query !== undefined) {
      state.query = normalizeQuery(query);
    }

    if (settings.category !== undefined) {
      state.category = toText(settings.category).trim();
    }

    if (settings.sort !== undefined) {
      state.sort = toText(settings.sort, "relevance");
    }

    if (settings.page !== undefined) {
      state.page = positiveInteger(settings.page, 1);
    } else if (!settings.keepPage) {
      state.page = 1;
    }

    if (settings.pageSize !== undefined) {
      state.pageSize = positiveInteger(
        settings.pageSize,
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );
    }

    const sequence = ++state.searchSequence;

    if (state.searchController) {
      state.searchController.abort();
    }

    const controller = new AbortController();
    state.searchController = controller;

    setLoading(true);
    state.error = null;

    dispatch(EVENTS.SEARCH_STARTED, {
      query: state.query,
      page: state.page,
      pageSize: state.pageSize
    });

    syncUrl();

    try {
      const response = await request(
        buildUrl(SEARCH_ENDPOINT, getSearchParams()),
        { signal: controller.signal }
      );

      if (sequence !== state.searchSequence) {
        return state.lastResponse;
      }

      const normalized = normalizeResponse(response);

      state.results = normalized.results;
      state.total = normalized.total;
      state.totalPages = normalized.totalPages;
      state.page = normalized.page;
      state.pageSize = normalized.pageSize;
      state.lastResponse = normalized;
      state.error = null;

      renderResults(settings.container);
      renderPagination();
      updateMetadata();

      if (state.query) {
        saveRecentSearch(state.query);
      }

      dispatch(EVENTS.SEARCH_COMPLETED, {
        query: state.query,
        results: state.results.slice(),
        total: state.total,
        page: state.page,
        pageSize: state.pageSize,
        response: normalized.raw
      });

      dispatch(EVENTS.RESULTS_UPDATED, {
        results: state.results.slice(),
        total: state.total
      });

      return normalized;
    } catch (error) {
      if (
        isAbortError(error) ||
        sequence !== state.searchSequence
      ) {
        return null;
      }

      state.error = error.message ||
        "Unable to complete the search.";

      renderError(state.error, settings.container);
      emitError(error, "search");

      return null;
    } finally {
      if (sequence === state.searchSequence) {
        setLoading(false);
      }
    }
  }

  /* ---------------------------------------------------------
     Results rendering
  --------------------------------------------------------- */

  function renderResults(target) {
    const containers = target
      ? [typeof target === "string" ? doc.querySelector(target) : target]
      : Array.from(doc.querySelectorAll(SELECTORS.results));

    containers.filter(Boolean).forEach(function (container) {
      container.replaceChildren();

      if (!state.results.length) {
        container.appendChild(
          createElement(
            "p",
            "medorbits-search-empty",
            state.query
              ? "No results found. Try different keywords or filters."
              : "No resources are available to display."
          )
        );
        return;
      }

      const fragment = doc.createDocumentFragment();

      state.results.forEach(function (result) {
        const card = createElement(
          "article",
          "medorbits-search-result"
        );

        card.dataset.searchResultId = result.id;

        card.appendChild(
          createElement(
            "span",
            "medorbits-search-result-category",
            result.category
          )
        );

        const heading = createElement(
          "h3",
          "medorbits-search-result-title"
        );

        if (result.url) {
          const link = createElement(
            "a",
            "",
            result.title
          );

          link.href = result.url;
          heading.appendChild(link);
        } else {
          heading.textContent = result.title;
        }

        card.appendChild(heading);

        if (result.description) {
          card.appendChild(
            createElement(
              "p",
              "medorbits-search-result-description",
              result.description
            )
          );
        }

        if (result.url) {
          const openLink = createElement(
            "a",
            "medorbits-search-result-link",
            "View resource"
          );

          openLink.href = result.url;
          card.appendChild(openLink);
        }

        fragment.appendChild(card);
      });

      container.appendChild(fragment);
    });
  }

  function renderError(message, target) {
    const containers = target
      ? [typeof target === "string" ? doc.querySelector(target) : target]
      : Array.from(doc.querySelectorAll(SELECTORS.results));

    containers.filter(Boolean).forEach(function (container) {
      container.replaceChildren();

      container.appendChild(
        createElement(
          "p",
          "medorbits-search-error",
          toText(message, "Search is temporarily unavailable.")
        )
      );
    });
  }

  function updateMetadata() {
    setTextAll(SELECTORS.total, state.total);
    setTextAll(SELECTORS.query, state.query);
  }

  /* ---------------------------------------------------------
     Suggestions
  --------------------------------------------------------- */

  async function getSuggestions(query) {
    const normalized = normalizeQuery(query);

    if (normalized.length < MIN_QUERY_LENGTH) {
      state.suggestions = [];
      renderSuggestions();
      return [];
    }

    const sequence = ++state.suggestionSequence;

    if (state.suggestionController) {
      state.suggestionController.abort();
    }

    const controller = new AbortController();
    state.suggestionController = controller;

    try {
      const response = await request(
        buildUrl(SUGGESTIONS_ENDPOINT, {
          q: normalized,
          query: normalized,
          limit: SUGGESTION_LIMIT
        }),
        { signal: controller.signal }
      );

      if (sequence !== state.suggestionSequence) {
        return state.suggestions;
      }

      state.suggestions = normalizeSuggestions(response);
      renderSuggestions();

      dispatch(EVENTS.SUGGESTIONS_UPDATED, {
        query: normalized,
        suggestions: state.suggestions.slice()
      });

      return state.suggestions;
    } catch (error) {
      if (
        isAbortError(error) ||
        sequence !== state.suggestionSequence
      ) {
        return [];
      }

      state.suggestions = [];
      renderSuggestions();
      emitError(error, "suggestions");

      return [];
    }
  }

  function renderSuggestions() {
    doc.querySelectorAll(SELECTORS.suggestions).forEach(function (container) {
      container.replaceChildren();

      state.suggestions.forEach(function (suggestion) {
        const button = createElement(
          "button",
          "medorbits-search-suggestion",
          suggestion
        );

        button.type = "button";
        button.dataset.searchSuggestion = suggestion;
        button.setAttribute("role", "option");

        container.appendChild(button);
      });

      container.hidden = state.suggestions.length === 0;
      container.setAttribute("role", "listbox");
    });
  }

  function hideSuggestions() {
    doc.querySelectorAll(SELECTORS.suggestions).forEach(function (container) {
      container.hidden = true;
    });
  }

  /* ---------------------------------------------------------
     Filters, sorting and pagination
  --------------------------------------------------------- */

  function setFilters(filters) {
    if (!isObject(filters)) {
      throw new TypeError("Search filters must be an object.");
    }

    const next = {};

    Object.keys(filters).forEach(function (key) {
      const safeKey = normalizeKey(key);
      const value = filters[key];

      if (!safeKey || value === null || value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        const values = value
          .map(function (item) {
            return toText(item).trim();
          })
          .filter(Boolean);

        if (values.length) next[safeKey] = values;
        return;
      }

      if (typeof value === "boolean" || typeof value === "number") {
        next[safeKey] = value;
        return;
      }

      const textValue = toText(value).trim();

      if (textValue) {
        next[safeKey] = textValue;
      }
    });

    state.filters = next;
    state.page = 1;

    dispatch(EVENTS.FILTERS_UPDATED, {
      filters: { ...state.filters }
    });

    return search(undefined, { page: 1 });
  }

  function setCategory(category) {
    state.category = toText(category).trim();
    return search(undefined, { page: 1 });
  }

  function setSort(sort) {
    state.sort = toText(sort, "relevance").trim() || "relevance";
    return search(undefined, { page: 1 });
  }

  function setPage(page) {
    const nextPage = positiveInteger(page, 1);

    if (state.totalPages > 0 && nextPage > state.totalPages) {
      return Promise.resolve(null);
    }

    state.page = nextPage;

    dispatch(EVENTS.PAGE_CHANGED, {
      page: state.page
    });

    return search(undefined, {
      page: state.page,
      keepPage: true
    });
  }

  function setPageSize(size) {
    state.pageSize = positiveInteger(
      size,
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    return search(undefined, {
      page: 1,
      pageSize: state.pageSize
    });
  }

  function renderPagination() {
    doc.querySelectorAll("[data-search-pagination]").forEach(
      function (container) {
        container.replaceChildren();

        if (state.totalPages <= 1) {
          container.hidden = true;
          return;
        }

        container.hidden = false;

        const previous = createElement(
          "button",
          "medorbits-search-page-previous",
          "Previous"
        );

        previous.type = "button";
        previous.dataset.searchPage = String(state.page - 1);
        previous.disabled = state.page <= 1;
        previous.setAttribute("aria-label", "Previous page");

        container.appendChild(previous);

        const start = Math.max(1, state.page - 2);
        const end = Math.min(state.totalPages, state.page + 2);

        for (let page = start; page <= end; page += 1) {
          const button = createElement(
            "button",
            "medorbits-search-page",
            page
          );

          button.type = "button";
          button.dataset.searchPage = String(page);
          button.setAttribute(
            "aria-current",
            page === state.page ? "page" : "false"
          );
          button.disabled = page === state.page;

          container.appendChild(button);
        }

        const next = createElement(
          "button",
          "medorbits-search-page-next",
          "Next"
        );

        next.type = "button";
        next.dataset.searchPage = String(state.page + 1);
        next.disabled = state.page >= state.totalPages;
        next.setAttribute("aria-label", "Next page");

        container.appendChild(next);
      }
    );
  }

  /* ---------------------------------------------------------
     URL synchronization
  --------------------------------------------------------- */

  function syncUrl() {
    try {
      const url = new URL(root.location.href);

      if (state.query) {
        url.searchParams.set("q", state.query);
      } else {
        url.searchParams.delete("q");
      }

      if (state.category) {
        url.searchParams.set("category", state.category);
      } else {
        url.searchParams.delete("category");
      }

      url.searchParams.set("page", String(state.page));
      url.searchParams.set("pageSize", String(state.pageSize));
      url.searchParams.set("sort", state.sort);

      Array.from(url.searchParams.keys()).forEach(function (key) {
        if (key.startsWith("filter[")) {
          url.searchParams.delete(key);
        }
      });

      Object.keys(state.filters).forEach(function (key) {
        const value = state.filters[key];

        if (Array.isArray(value)) {
          value.forEach(function (item) {
            url.searchParams.append(
              "filter[" + key + "]",
              String(item)
            );
          });
        } else {
          url.searchParams.set(
            "filter[" + key + "]",
            String(value)
          );
        }
      });

      root.history.replaceState(
        root.history.state,
        "",
        url.pathname + url.search + url.hash
      );
    } catch (_) {
      // URL synchronization must not break searching.
    }
  }

  function readUrlState() {
    const params = new URLSearchParams(root.location.search);
    const filters = {};

    params.forEach(function (value, key) {
      const match = key.match(/^filter\[([^\]]+)\]$/);

      if (!match) return;

      const filterKey = normalizeKey(match[1]);

      if (!filterKey) return;

      if (Object.prototype.hasOwnProperty.call(filters, filterKey)) {
        if (!Array.isArray(filters[filterKey])) {
          filters[filterKey] = [filters[filterKey]];
        }

        filters[filterKey].push(value);
      } else {
        filters[filterKey] = value;
      }
    });

    state.query = normalizeQuery(
      params.get("q") || params.get("query") || ""
    );

    state.category = toText(params.get("category")).trim();
    state.sort = toText(params.get("sort"), "relevance");
    state.page = positiveInteger(params.get("page"), 1);
    state.pageSize = positiveInteger(
      params.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    state.filters = filters;

    return {
      query: state.query,
      category: state.category,
      sort: state.sort,
      page: state.page,
      pageSize: state.pageSize,
      filters: { ...state.filters }
    };
  }

  function applyStateToControls() {
    doc.querySelectorAll(SELECTORS.input).forEach(function (input) {
      input.value = state.query;
    });

    doc.querySelectorAll(SELECTORS.category).forEach(function (input) {
      input.value = state.category;
    });

    doc.querySelectorAll(SELECTORS.sort).forEach(function (input) {
      input.value = state.sort;
    });

    doc.querySelectorAll(SELECTORS.pageSize).forEach(function (input) {
      input.value = String(state.pageSize);
    });

    doc.querySelectorAll(SELECTORS.filter).forEach(function (input) {
      const key = normalizeKey(input.dataset.searchFilter);
      const value = state.filters[key];

      if (!key || value === undefined) return;

      if (input.type === "checkbox") {
        input.checked = Array.isArray(value)
          ? value.includes(input.value)
          : String(value) === input.value ||
            value === true;
      } else {
        input.value = Array.isArray(value)
          ? value.join(",")
          : String(value);
      }
    });
  }

  /* ---------------------------------------------------------
     Debouncing and delegated controls
  --------------------------------------------------------- */

  function debounceElement(element, callback) {
    const previous = state.timers.get(element);

    if (previous) {
      clearTimeout(previous);
    }

    const timer = setTimeout(function () {
      state.timers.delete(element);
      callback();
    }, DEBOUNCE_DELAY);

    state.timers.set(element, timer);
  }

  function readFiltersFromControls() {
    const filters = {};

    doc.querySelectorAll(SELECTORS.filter).forEach(function (input) {
      const key = normalizeKey(input.dataset.searchFilter);

      if (!key) return;

      if (input.type === "checkbox") {
        if (!input.checked) return;

        if (!filters[key]) {
          filters[key] = [];
        }

        if (!Array.isArray(filters[key])) {
          filters[key] = [filters[key]];
        }

        filters[key].push(input.value);
        return;
      }

      if (input.type === "radio" && !input.checked) {
        return;
      }

      const value = toText(input.value).trim();

      if (value) {
        filters[key] = value;
      }
    });

    return filters;
  }

  function handleInput(event) {
    const input = event.target;

    if (!input.matches(SELECTORS.input)) return;

    const query = normalizeQuery(input.value);

    state.query = query;

    debounceElement(input, function () {
      if (query.length >= MIN_QUERY_LENGTH) {
        getSuggestions(query);
      } else {
        state.suggestions = [];
        renderSuggestions();
      }

      search(query, { page: 1 });
    });
  }

  function handleSubmit(event) {
    const form = event.target;

    if (!form.matches(SELECTORS.form)) return;

    event.preventDefault();

    const input = form.querySelector(SELECTORS.input);
    const query = input ? input.value : state.query;

    doc.querySelectorAll(SELECTORS.input).forEach(function (item) {
      item.value = normalizeQuery(query);
    });

    search(query, { page: 1 });
    hideSuggestions();
  }

  function handleChange(event) {
    const element = event.target;

    if (element.matches(SELECTORS.category)) {
      setCategory(element.value);
      return;
    }

    if (element.matches(SELECTORS.sort)) {
      setSort(element.value);
      return;
    }

    if (element.matches(SELECTORS.pageSize)) {
      setPageSize(element.value);
      return;
    }

    if (element.matches(SELECTORS.filter)) {
      setFilters(readFiltersFromControls());
    }
  }

  function handleClick(event) {
    const target = event.target.closest(
      [
        SELECTORS.page,
        SELECTORS.suggestions + " button",
        SELECTORS.recent + " button",
        SELECTORS.save
      ].join(",")
    );

    if (!target) return;

    if (target.matches(SELECTORS.page)) {
      event.preventDefault();

      setPage(target.dataset.searchPage).catch(function (error) {
        emitError(error, "pagination");
      });

      return;
    }

    if (target.matches("[data-search-suggestion]")) {
      event.preventDefault();

      const query = target.dataset.searchSuggestion;

      doc.querySelectorAll(SELECTORS.input).forEach(function (input) {
        input.value = query;
      });

      state.query = normalizeQuery(query);
      hideSuggestions();

      search(state.query, { page: 1 });
      return;
    }

    if (target.matches("[data-search-recent]")) {
      event.preventDefault();

      const query = target.dataset.searchRecent;

      doc.querySelectorAll(SELECTORS.input).forEach(function (input) {
        input.value = query;
      });

      search(query, { page: 1 });
      return;
    }

    if (target.matches(SELECTORS.save)) {
      event.preventDefault();

      dispatch(EVENTS.SAVE_REQUESTED, {
        query: state.query,
        filters: { ...state.filters },
        sort: state.sort,
        page: state.page,
        pageSize: state.pageSize
      });
    }
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      hideSuggestions();
    }
  }

  function handleDocumentClick(event) {
    if (
      !event.target.closest(SELECTORS.input) &&
      !event.target.closest(SELECTORS.suggestions)
    ) {
      hideSuggestions();
    }
  }

  /* ---------------------------------------------------------
     Initialization and lifecycle
  --------------------------------------------------------- */

  function init(options) {
    if (state.initialized) return api;

    const settings = options || {};

    if (settings.pageSize !== undefined) {
      state.pageSize = positiveInteger(
        settings.pageSize,
        DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );
    }

    readUrlState();
    loadRecentSearches();
    applyStateToControls();

    doc.addEventListener("input", handleInput);
    doc.addEventListener("submit", handleSubmit);
    doc.addEventListener("change", handleChange);
    doc.addEventListener("click", handleClick);
    doc.addEventListener("keydown", handleKeydown);
    doc.addEventListener("click", handleDocumentClick);

    state.initialized = true;

    if (settings.searchOnInit !== false) {
      search(state.query, { page: state.page, keepPage: true });
    }

    return api;
  }

  function destroy() {
    if (state.searchController) {
      state.searchController.abort();
      state.searchController = null;
    }

    if (state.suggestionController) {
      state.suggestionController.abort();
      state.suggestionController = null;
    }

    state.timers.forEach(function (timer) {
      clearTimeout(timer);
    });

    state.timers.clear();

    doc.removeEventListener("input", handleInput);
    doc.removeEventListener("submit", handleSubmit);
    doc.removeEventListener("change", handleChange);
    doc.removeEventListener("click", handleClick);
    doc.removeEventListener("keydown", handleKeydown);
    doc.removeEventListener("click", handleDocumentClick);

    state.searchSequence += 1;
    state.suggestionSequence += 1;
    state.initialized = false;

    setLoading(false);
  }

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("Event subscriber must be a function.");
    }

    const name = toText(eventName);

    if (!state.listeners.has(name)) {
      state.listeners.set(name, new Set());
    }

    state.listeners.get(name).add(callback);

    return function unsubscribe() {
      off(name, callback);
    };
  }

  function off(eventName, callback) {
    const subscribers = state.listeners.get(toText(eventName));

    if (!subscribers) return;

    if (typeof callback === "function") {
      subscribers.delete(callback);
    } else {
      subscribers.clear();
    }

    if (!subscribers.size) {
      state.listeners.delete(toText(eventName));
    }
  }

  function getState() {
    return {
      query: state.query,
      category: state.category,
      filters: { ...state.filters },
      sort: state.sort,
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      totalPages: state.totalPages,
      results: state.results.slice(),
      suggestions: state.suggestions.slice(),
      recent: state.recent.slice(),
      loading: state.loading,
      error: state.error
    };
  }

  const api = {
    version: "1.3.0",

    init: init,
    destroy: destroy,

    search: search,
    getSuggestions: getSuggestions,

    setFilters: setFilters,
    setCategory: setCategory,
    setSort: setSort,
    setPage: setPage,
    setPageSize: setPageSize,

    syncUrl: syncUrl,
    readUrlState: readUrlState,

    getState: getState,
    getRecentSearches: function () {
      return state.recent.slice();
    },

    clearRecentSearches: function () {
      state.recent = [];

      try {
        root.localStorage.removeItem(STORAGE_KEY);
      } catch (_) {
        // Storage may be unavailable.
      }

      renderRecentSearches();

      dispatch(EVENTS.RECENT_UPDATED, {
        recent: []
      });
    },

    on: on,
    off: off,

    events: Object.freeze({ ...EVENTS })
  };

  root.MedorbitsSearch = api;

  root.MedOrbitsSearch = api;

  root.MedOrbits = root.MedOrbits || {};
  root.MedOrbits.Search = api;

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () {
      if (doc.querySelector(SELECTORS.form)) {
        init();
      }
    }, { once: true });
  } else if (doc.querySelector(SELECTORS.form)) {
    init();
  }

})(window, document);
