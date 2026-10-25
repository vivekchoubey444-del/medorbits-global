
/* =========================================================
   MEDORBITS | GLOBAL SEARCH
   File: assets/js/search.js
   Version: 1.0.0
   Dependencies: None
   ========================================================= */

(function MedOrbitsSearchModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_SEARCH_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    minChars: 2,
    debounceMs: 220,
    maxResults: 8,
    maxDataItems: 10000,
    maxQueryLength: 150,
    recentLimit: 5,
    recentStorageKey: "medorbits:recent-searches:v1",
    dataUrl: "/assets/data/search-index.json",
    locale: "en-IN"
  };

  var state = {
    config: Object.assign({}, DEFAULTS),
    index: [],
    recent: [],
    roots: new Map(),
    listeners: [],
    timers: new Map(),
    observer: null,
    requestId: 0,
    initialized: false,
    destroyed: false
  };

  var SELECTORS = {
    root: "[data-mo-search]",
    form: "[data-search-form]",
    input: "[data-search-input]",
    clear: "[data-search-clear]",
    suggestions: "[data-search-suggestions]",
    status: "[data-search-status]",
    recent: "[data-search-recent]",
    resultCount: "[data-search-count]"
  };

  function listen(element, event, handler) {
    element.addEventListener(event, handler);

    state.listeners.push(function () {
      element.removeEventListener(event, handler);
    });
  }

  function clean(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function normalize(value) {
    return clean(value, state.config.maxQueryLength)
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function safeUrl(value) {
    if (!value) return "";

    try {
      var url = new URL(String(value), window.location.href);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function makeItem(item, index) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    var title = clean(item.title || item.name || item.label, 200);

    if (!title) return null;

    var description = clean(
      item.description || item.summary || item.excerpt,
      500
    );

    var category = clean(
      item.category || item.type || item.section,
      100
    );

    var url = safeUrl(
      item.url || item.href || item.path || item.link
    );

    var keywords = Array.isArray(item.keywords)
      ? item.keywords.map(function (keyword) {
          return clean(keyword, 100);
        }).join(" ")
      : clean(item.keywords || "", 300);

    return {
      id: clean(item.id || item.slug || "search-" + index, 150),
      title: title,
      description: description,
      category: category,
      keywords: keywords,
      url: url,
      searchText: normalize([
        title,
        description,
        category,
        keywords,
        item.location,
        item.course,
        item.company
      ].filter(Boolean).join(" "))
    };
  }

  function normalizeDataset(data) {
    var items = Array.isArray(data)
      ? data
      : data && Array.isArray(data.items)
        ? data.items
        : data && Array.isArray(data.results)
          ? data.results
          : data && Array.isArray(data.pages)
            ? data.pages
            : null;

    if (!items) {
      throw new Error("Search data must be an array or contain items, results, or pages.");
    }

    return items.slice(0, state.config.maxDataItems)
      .map(makeItem)
      .filter(Boolean);
  }

  function getRoot(element) {
    return element && element.closest
      ? element.closest(SELECTORS.root)
      : null;
  }

  function find(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function saveRecent(query) {
    query = clean(query, state.config.maxQueryLength);
    if (!query) return;

    state.recent = state.recent.filter(function (item) {
      return normalize(item) !== normalize(query);
    });

    state.recent.unshift(query);
    state.recent = state.recent.slice(0, state.config.recentLimit);

    try {
      window.localStorage.setItem(
        state.config.recentStorageKey,
        JSON.stringify(state.recent)
      );
    } catch (error) {
      // Recent searches remain available in memory.
    }
  }

  function loadRecent() {
    try {
      var saved = JSON.parse(
        window.localStorage.getItem(state.config.recentStorageKey) || "[]"
      );

      if (Array.isArray(saved)) {
        state.recent = saved
          .filter(function (item) {
            return typeof item === "string";
          })
          .map(function (item) {
            return clean(item, state.config.maxQueryLength);
          })
          .filter(Boolean)
          .slice(0, state.config.recentLimit);
      }
    } catch (error) {
      state.recent = [];
    }
  }

  function scoreItem(item, query) {
    var normalizedTitle = normalize(item.title);
    var normalizedCategory = normalize(item.category);
    var normalizedDescription = normalize(item.description);
    var normalizedKeywords = normalize(item.keywords);
    var score = 0;

    if (normalizedTitle === query) score += 100;
    else if (normalizedTitle.startsWith(query)) score += 60;
    else if (normalizedTitle.includes(query)) score += 40;

    if (normalizedCategory.includes(query)) score += 18;
    if (normalizedKeywords.includes(query)) score += 14;
    if (normalizedDescription.includes(query)) score += 8;

    var words = query.split(/\s+/).filter(Boolean);

    if (words.length > 1) {
      var matches = words.filter(function (word) {
        return item.searchText.includes(word);
      }).length;

      score += matches * 3;
    }

    return score;
  }

  function search(query, options) {
    options = options || {};

    var normalizedQuery = normalize(query);

    if (normalizedQuery.length < state.config.minChars) {
      return [];
    }

    var results = state.index.map(function (item) {
      return {
        item: item,
        score: scoreItem(item, normalizedQuery)
      };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score ||
        a.item.title.localeCompare(b.item.title);
    });

    var limit = Number(options.limit) || state.config.maxResults;
    limit = Math.min(Math.max(1, limit), 50);

    return results.slice(0, limit).map(function (entry) {
      return Object.assign({}, entry.item, { score: entry.score });
    });
  }

  function createElement(tag, className, value) {
    var element = document.createElement(tag);

    if (className) element.className = className;
    if (value != null) element.textContent = clean(value, 1000);

    return element;
  }

  function renderSuggestions(root, results, query) {
    var list = find(root, SELECTORS.suggestions);
    var status = find(root, SELECTORS.status);
    var count = find(root, SELECTORS.resultCount);

    if (!list) return;

    list.replaceChildren();
    list.hidden = true;

    if (results.length) {
      results.forEach(function (item, index) {
        var option = document.createElement("li");
        option.id = "mo-search-option-" + state.requestId + "-" + index;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.setAttribute("data-search-option", "");
        option.dataset.index = String(index);

        if (item.url) {
          var link = createElement("a", "mo-search-suggestion__link");
          link.href = item.url;
          link.textContent = item.title;

          if (new URL(item.url).origin !== window.location.origin) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }

          option.appendChild(link);
        } else {
          option.appendChild(
            createElement("span", "mo-search-suggestion__title", item.title)
          );
        }

        if (item.category) {
          option.appendChild(
            createElement("span", "mo-search-suggestion__category", item.category)
          );
        }

        if (item.description) {
          option.appendChild(
            createElement("p", "mo-search-suggestion__description", item.description)
          );
        }

        list.appendChild(option);
      });

      list.hidden = false;
      list.setAttribute("role", "listbox");

      var input = find(root, SELECTORS.input);

      if (input) {
        input.setAttribute("aria-expanded", "true");
        input.setAttribute("aria-controls", list.id || "mo-search-suggestions");
      }
    }

    if (status) {
      status.textContent = results.length
        ? results.length + " suggestions for " + query + "."
        : "No suggestions found for " + query + ".";
    }

    if (count) count.textContent = String(results.length);
  }

  function closeSuggestions(root) {
    var list = find(root, SELECTORS.suggestions);
    var input = find(root, SELECTORS.input);

    if (list) list.hidden = true;

    if (input) {
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }
  }

  function getOptions(root) {
    var list = find(root, SELECTORS.suggestions);

    return list ? Array.from(list.querySelectorAll("[data-search-option]")) : [];
  }

  function setActiveOption(root, index) {
    var options = getOptions(root);
    var input = find(root, SELECTORS.input);

    if (!options.length || !input) return;

    index = Math.max(0, Math.min(index, options.length - 1));

    options.forEach(function (option, optionIndex) {
      var active = optionIndex === index;

      option.setAttribute("aria-selected", String(active));

      if (active) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function renderRecent(root) {
    var container = find(root, SELECTORS.recent);
    if (!container) return;

    container.replaceChildren();

    if (!state.recent.length) {
      container.hidden = true;
      return;
    }

    var heading = createElement("p", "mo-search-recent__heading", "Recent searches");
    container.appendChild(heading);

    state.recent.forEach(function (query) {
      var button = createElement("button", "mo-search-recent__item", query);
      button.type = "button";
      button.setAttribute("data-search-recent-query", query);

      container.appendChild(button);
    });

    container.hidden = false;
  }

  function navigateToResults(root, query) {
    query = clean(query, state.config.maxQueryLength);
    if (!query) return;

    saveRecent(query);

    var resultsUrl = root.getAttribute("data-search-results-url") ||
      "/pages/search.html";

    var safeResultsUrl = safeUrl(resultsUrl);

    if (!safeResultsUrl) return;

    var url = new URL(safeResultsUrl);
    url.searchParams.set("q", query);

    window.location.href = url.href;
  }

  function bindRoot(root) {
    if (state.roots.has(root)) return;

    var input = find(root, SELECTORS.input);
    var form = find(root, SELECTORS.form);
    var clear = find(root, SELECTORS.clear);
    var list = find(root, SELECTORS.suggestions);

    if (!input) return;

    if (list && !list.id) {
      list.id = "mo-search-suggestions-" +
        Math.random().toString(36).slice(2, 10);
    }

    input.setAttribute("autocomplete", input.getAttribute("autocomplete") || "off");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    var record = {
      root: root,
      input: input,
      activeIndex: -1,
      timer: null
    };

    state.roots.set(root, record);

    listen(input, "input", function () {
      window.clearTimeout(record.timer);

      var query = clean(input.value, state.config.maxQueryLength);
      record.activeIndex = -1;

      if (clear) clear.hidden = !query;

      if (normalize(query).length < state.config.minChars) {
        closeSuggestions(root);
        renderRecent(root);
        return;
      }

      record.timer = window.setTimeout(function () {
        state.requestId += 1;

        renderSuggestions(root, search(query), query);
        renderRecent(root);
      }, state.config.debounceMs);
    });

    listen(input, "keydown", function (event) {
      var options = getOptions(root);

      if (event.key === "ArrowDown" && options.length) {
        event.preventDefault();
        record.activeIndex = Math.min(record.activeIndex + 1, options.length - 1);
        setActiveOption(root, record.activeIndex);
      } else if (event.key === "ArrowUp" && options.length) {
        event.preventDefault();
        record.activeIndex = Math.max(record.activeIndex - 1, 0);
        setActiveOption(root, record.activeIndex);
      } else if (event.key === "Escape") {
        closeSuggestions(root);
      } else if (event.key === "Enter") {
        var active = options[record.activeIndex];

        if (active) {
          var link = active.querySelector("a[href]");

          if (link) {
            event.preventDefault();
            window.location.href = link.href;
          } else {
            event.preventDefault();
            navigateToResults(root, input.value);
          }
        }
      }
    });

    if (form) {
      listen(form, "submit", function (event) {
        event.preventDefault();
        navigateToResults(root, input.value);
      });
    }

    if (clear) {
      clear.hidden = !input.value;

      listen(clear, "click", function () {
        input.value = "";
        record.activeIndex = -1;
        closeSuggestions(root);
        renderRecent(root);
        if (clear) clear.hidden = true;
        input.focus();
      });
    }

    if (list) {
      listen(list, "click", function (event) {
        var option = event.target.closest("[data-search-option]");
        if (!option) return;

        var link = option.querySelector("a[href]");

        if (!link) {
          navigateToResults(root, input.value);
        }
      });
    }

    var recentContainer = find(root, SELECTORS.recent);

    if (recentContainer) {
      listen(recentContainer, "click", function (event) {
        var button = event.target.closest("[data-search-recent-query]");
        if (!button) return;

        input.value = button.getAttribute("data-search-recent-query") || "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    }

    listen(document, "click", function (event) {
      if (!root.contains(event.target)) {
        closeSuggestions(root);
      }
    });

    renderRecent(root);
  }

  async function load(url) {
    var dataUrl = safeUrl(url || state.config.dataUrl);

    if (!dataUrl) {
      throw new Error("Invalid search index URL.");
    }

    var response = await fetch(dataUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Unable to load search index (HTTP " + response.status + ").");
    }

    var data = await response.json();
    state.index = normalizeDataset(data);

    return state.index.slice();
  }

  function setIndex(items) {
    if (!Array.isArray(items)) {
      throw new TypeError("Search index must be an array.");
    }

    state.index = normalizeDataset(items);
    return state.index.length;
  }

  function refresh() {
    if (state.destroyed) return;

    document.querySelectorAll(SELECTORS.root).forEach(bindRoot);
    state.roots.forEach(function (_, root) {
      if (!root.isConnected) state.roots.delete(root);
    });
  }

  function init() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;
    loadRecent();
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(SELECTORS.root)) ||
                (node.querySelector && node.querySelector(SELECTORS.root))
              );
          });
        });

        if (shouldRefresh) refresh();
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function destroy() {
    if (state.destroyed) return;

    if (state.observer) state.observer.disconnect();

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.roots.forEach(function (record) {
      window.clearTimeout(record.timer);
    });

    state.listeners = [];
    state.roots.clear();
    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    search: search,
    load: load,
    setIndex: setIndex,
    refresh: refresh,
    clearRecent: function () {
      state.recent = [];

      try {
        window.localStorage.removeItem(state.config.recentStorageKey);
      } catch (error) {
        // Ignore storage errors.
      }

      state.roots.forEach(function (record) {
        renderRecent(record.root);
      });
    },
    getRecent: function () {
      return state.recent.slice();
    },
    getIndex: function () {
      return state.index.slice();
    },
    configure: function (options) {
      options = options || {};

      ["dataUrl", "recentStorageKey", "locale"].forEach(function (key) {
        if (typeof options[key] === "string") {
          state.config[key] = options[key];
        }
      });

      ["minChars", "debounceMs", "maxResults", "maxDataItems",
        "maxQueryLength", "recentLimit"].forEach(function (key) {
        if (Number.isInteger(options[key]) && options[key] > 0) {
          state.config[key] = options[key];
        }
      });
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsSearch = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
