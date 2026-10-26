
/* MedOrbits -- Site Search
 * File: /assets/js/site-search.js
 * Version: 1.1.0
 *
 * Endpoint: GET /api/v1/site-search?q=<query>&limit=20
 * Preserves quickSearch, directorySearch and data-site-search-bar hooks.
 */
(function (window, document) {
  "use strict";

  if (window.MedOrbitsSiteSearch) return;

  var cfg = window.MedOrbitsConfig || {};
  var API = String(
    cfg.API_BASE_URL || cfg.apiBaseUrl || "/api/v1"
  ).replace(/\/+$/, "");

  if (!/\/v\d+$/.test(API)) {
    API = "/api/v1";
  }

  var ENDPOINT = API + "/site-search";
  var MIN_QUERY_LENGTH = 2;
  var MAX_QUERY_LENGTH = 200;
  var MAX_RESULTS = 20;
  var instances = [];
  var initialized = false;

  var TYPE_LABELS = {
    course: "Course",
    university: "University",
    college: "College",
    scholarship: "Scholarship",
    service: "Service",
    faq: "FAQ",
    news: "News",
    job: "Job",
    internship: "Internship",
    page: "Page"
  };

  function text(value, fallback) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return fallback || "";
  }

  function el(tag, content, css) {
    var node = document.createElement(tag);

    if (content !== undefined && content !== null) {
      node.textContent = text(content);
    }

    if (css) {
      node.style.cssText = css;
    }

    return node;
  }

  function safeUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return "";
    }

    try {
      var url = new URL(value, window.location.origin);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }

      if (url.origin !== window.location.origin) {
        return "";
      }

      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "";
    }
  }

  function normalizeResults(json) {
    if (!json || typeof json !== "object") {
      return [];
    }

    var results = Array.isArray(json.data)
      ? json.data
      : Array.isArray(json.results)
        ? json.results
        : [];

    return results
      .filter(function (item) {
        return item && typeof item === "object";
      })
      .map(function (item) {
        var type = text(item.type, "page").toLowerCase();

        return {
          title: text(item.title || item.name, "Untitled result"),
          summary: text(item.summary || item.description),
          type: type,
          url: safeUrl(item.url || item.href || item.path)
        };
      })
      .filter(function (item) {
        return Boolean(item.url);
      })
      .slice(0, MAX_RESULTS);
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (_) {
      // Custom events are optional integrations.
    }
  }

  function attach(form, input) {
    if (!form || !input || form.dataset.siteSearchAttached === "true") {
      return;
    }

    form.dataset.siteSearchAttached = "true";

    var panel = el("div", null,
      "width:100%;max-width:760px;margin:6px auto 12px;" +
      "padding:0 14px;box-sizing:border-box"
    );

    panel.className = "medorbits-site-search-results";
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-atomic", "true");
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Search results");
    panel.hidden = true;

    if (form.parentNode) {
      form.parentNode.insertBefore(panel, form.nextSibling);
    }

    var controller = null;
    var requestSequence = 0;
    var destroyed = false;

    function showMessage(message, kind) {
      panel.replaceChildren();
      panel.hidden = false;

      var paragraph = el("p", message,
        "margin:8px 0;padding:10px 12px;border-radius:8px;" +
        "color:#a9c0b4"
      );

      if (kind === "error") {
        paragraph.style.color = "#ffb4ab";
      }

      panel.appendChild(paragraph);
    }

    function render(data, query) {
      panel.replaceChildren();
      panel.hidden = false;

      if (!data.length) {
        panel.appendChild(el(
          "p",
          "No results found for \u201C" + query + "\u201D.",
          "color:#a9c0b4;margin:8px 0"
        ));

        emit("medorbits:site-search:completed", {
          query: query,
          count: 0
        });

        return;
      }

      panel.appendChild(el(
        "p",
        data.length + " result" +
          (data.length === 1 ? "" : "s") +
          " for \u201C" + query + "\u201D",
        "color:#a9c0b4;margin:8px 0;font-size:12px"
      ));

      var fragment = document.createDocumentFragment();

      data.forEach(function (item) {
        var card = el("article", null,
          "margin-bottom:8px;border:1px solid " +
          "rgba(201,169,110,.25);border-radius:8px;" +
          "background:rgba(16,10,23,.6);overflow:hidden"
        );

        var link = el("a", null,
          "display:block;padding:10px 12px;" +
          "color:#f2f8f3;text-decoration:none"
        );

        link.href = item.url;
        link.appendChild(el(
          "small",
          TYPE_LABELS[item.type] || item.type,
          "display:block;color:#c9a96e;text-transform:uppercase;" +
          "letter-spacing:.05em;font-size:10px"
        ));

        link.appendChild(el("strong", item.title,
          "display:block;margin:2px 0"
        ));

        if (item.summary) {
          link.appendChild(el("span", item.summary,
            "display:block;font-size:12px;color:#a9c0b4"
          ));
        }

        card.appendChild(link);
        fragment.appendChild(card);
      });

      panel.appendChild(fragment);

      emit("medorbits:site-search:completed", {
        query: query,
        count: data.length,
        results: data
      });
    }

    function search(query) {
      query = String(query || "").trim().replace(/\s+/g, " ");

      if (query.length < MIN_QUERY_LENGTH) {
        if (controller) {
          controller.abort();
          controller = null;
        }

        requestSequence += 1;
        showMessage(
          "Enter at least " + MIN_QUERY_LENGTH +
          " characters to search."
        );
        return Promise.resolve([]);
      }

      if (query.length > MAX_QUERY_LENGTH) {
        showMessage(
          "Please shorten your search to " +
          MAX_QUERY_LENGTH + " characters.",
          "error"
        );
        return Promise.resolve([]);
      }

      if (controller) {
        controller.abort();
      }

      controller = window.AbortController
        ? new window.AbortController()
        : null;

      var currentSequence = ++requestSequence;
      var options = {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      };

      if (controller) {
        options.signal = controller.signal;
      }

      var url = ENDPOINT + "?q=" +
        encodeURIComponent(query) + "&limit=" + MAX_RESULTS;

      panel.replaceChildren();
      panel.hidden = false;

      var loading = el("p", "Searching\u2026",
        "color:#a9c0b4;margin:8px 0"
      );

      loading.setAttribute("role", "status");
      panel.appendChild(loading);

      emit("medorbits:site-search:started", {
        query: query
      });

      return window.fetch(url, options)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Search request failed: " + response.status);
          }

          return response.json();
        })
        .then(function (json) {
          if (destroyed || currentSequence !== requestSequence) {
            return [];
          }

          var results = normalizeResults(json);
          render(results, query);

          return results;
        })
        .catch(function (error) {
          if (
            destroyed ||
            currentSequence !== requestSequence ||
            (error && error.name === "AbortError")
          ) {
            return [];
          }

          showMessage(
            "Search is unavailable right now. Please try again.",
            "error"
          );

          emit("medorbits:site-search:error", {
            query: query,
            message: error && error.message
              ? error.message
              : "Search request failed."
          });

          return [];
        });
    }

    function handleSubmit(event) {
      var query = String(input.value || "").trim();

      if (query.length < MIN_QUERY_LENGTH) {
        event.preventDefault();
        showMessage(
          "Enter at least " + MIN_QUERY_LENGTH +
          " characters to search."
        );
        input.focus();
        return;
      }

      event.preventDefault();
      search(query);
    }

    function handleInput() {
      // Invalidate in-flight results when the user changes the query.
      if (controller) {
        controller.abort();
        controller = null;
      }

      requestSequence += 1;
    }

    form.addEventListener("submit", handleSubmit);
    input.addEventListener("input", handleInput);

    instances.push({
      form: form,
      input: input,
      panel: panel,
      search: search,
      destroy: function () {
        destroyed = true;
        requestSequence += 1;

        if (controller) {
          controller.abort();
          controller = null;
        }

        form.removeEventListener("submit", handleSubmit);
        input.removeEventListener("input", handleInput);

        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }

        delete form.dataset.siteSearchAttached;
      }
    });

    return search;
  }

  function init() {
    if (initialized) return;
    initialized = true;

    var quick = document.getElementById("quickSearch");

    if (quick) {
      var quickInput = quick.querySelector('input[type="search"]');

      if (quickInput) {
        attach(quick, quickInput);
      }

      return;
    }

    // Respect existing directory search implementations.
    if (document.getElementById("directorySearch")) {
      return;
    }

    var existing = document.querySelector("[data-site-search-bar]");

    if (existing) {
      var existingInput = existing.querySelector(
        'input[type="search"], input[name="q"]'
      );

      if (existingInput) {
        attach(existing, existingInput);
      }

      return;
    }

    var form = el("form");
    form.setAttribute("data-site-search-bar", "");
    form.setAttribute("role", "search");
    form.setAttribute("aria-label", "Search MedOrbits");
    form.action = "/pages/search.html";
    form.method = "get";

    form.style.cssText =
      "display:flex;gap:8px;max-width:760px;margin:0 auto;" +
      "padding:10px 14px;box-sizing:border-box";

    var input = el("input");
    input.type = "search";
    input.name = "q";
    input.required = true;
    input.maxLength = MAX_QUERY_LENGTH;
    input.autocomplete = "off";
    input.placeholder =
      "Search MBBS colleges, courses, countries\u2026";

    input.setAttribute(
      "aria-label",
      "Search MBBS colleges, courses and resources"
    );

    input.style.cssText =
      "flex:1;min-width:0;padding:10px 12px;" +
      "border:1px solid #c9a96e;border-radius:8px;" +
      "background:#21172b;color:#fff";

    var button = el("button", "Search");
    button.type = "submit";
    button.style.cssText =
      "padding:10px 16px;border:0;border-radius:8px;" +
      "background:#c9a96e;color:#100a17;" +
      "font-weight:600;cursor:pointer";

    form.appendChild(input);
    form.appendChild(button);

    var header = document.querySelector("header");

    if (header && header.parentNode) {
      header.parentNode.insertBefore(form, header.nextSibling);
    } else if (document.body) {
      document.body.insertBefore(form, document.body.firstChild);
    }

    attach(form, input);
  }

  var api = {
    version: "1.1.0",
    init: init,
    search: function (query) {
      if (!instances.length) init();

      var instance = instances.find(function (item) {
        return !item.form.dataset.siteSearchAttached ||
          item.form.isConnected;
      });

      return instance
        ? instance.search(query)
        : Promise.resolve([]);
    },
    destroy: function () {
      instances.slice().forEach(function (instance) {
        instance.destroy();
      });

      instances = [];
      initialized = false;
    }
  };

  window.MedOrbitsSiteSearch = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.SiteSearch = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
