
/* =========================================================
   MEDORBITS | JOB SEARCH
   File: assets/js/job-search.js
   Version: 1.0.0
   Dependencies: None
   ========================================================= */

(function MedOrbitsJobSearch() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_JOB_SEARCH_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    dataUrl: "/assets/data/jobs.json",
    pageSize: 10,
    maxPageSize: 100,
    debounceMs: 250,
    currency: "INR",
    locale: "en-IN"
  };

  var state = {
    jobs: [],
    filtered: [],
    page: 1,
    pageSize: DEFAULTS.pageSize,
    loading: false,
    error: "",
    initialized: false,
    destroyed: false,
    listeners: [],
    timer: null,
    observer: null,
    config: Object.assign({}, DEFAULTS)
  };

  var SELECTORS = {
    root: "[data-job-search]",
    form: "[data-job-search-form]",
    keyword: "[data-job-keyword]",
    location: "[data-job-location]",
    category: "[data-job-category]",
    type: "[data-job-type]",
    mode: "[data-job-work-mode]",
    minSalary: "[data-job-min-salary]",
    maxSalary: "[data-job-max-salary]",
    sort: "[data-job-sort]",
    pageSize: "[data-job-page-size]",
    results: "[data-job-results]",
    count: "[data-job-count]",
    status: "[data-job-status]",
    pagination: "[data-job-pagination]",
    previous: "[data-job-previous]",
    next: "[data-job-next]",
    pageNumber: "[data-job-current-page]",
    clear: "[data-job-clear]",
    loading: "[data-job-loading]",
    empty: "[data-job-empty]",
    error: "[data-job-error]"
  };

  function listen(element, event, handler) {
    element.addEventListener(event, handler);
    state.listeners.push(function () {
      element.removeEventListener(event, handler);
    });
  }

  function text(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 500);
  }

  function normalize(value) {
    return text(value, 500).toLocaleLowerCase();
  }

  function getRoot() {
    return document.querySelector(SELECTORS.root);
  }

  function find(selector) {
    var root = getRoot();
    return root ? root.querySelector(selector) : null;
  }

  function findAll(selector) {
    var root = getRoot();
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }

  function number(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      var parsed = Number(value.replace(/[,\s₹$]/g, ""));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  function salaryValue(job) {
    var salary = job.salary;

    if (salary && typeof salary === "object") {
      return number(
        salary.max != null ? salary.max :
        salary.min != null ? salary.min :
        salary.amount
      );
    }

    return number(job.salaryMax != null ? job.salaryMax : salary);
  }

  function salaryLabel(job) {
    if (job.salaryLabel) return text(job.salaryLabel, 100);

    var salary = job.salary;

    if (salary && typeof salary === "object") {
      var min = number(salary.min);
      var max = number(salary.max);
      var period = text(salary.period || "year", 30);

      if (min != null && max != null) {
        return formatMoney(min) + " – " + formatMoney(max) + " / " + period;
      }

      if (max != null) return "Up to " + formatMoney(max) + " / " + period;
      if (min != null) return "From " + formatMoney(min) + " / " + period;
    }

    var value = salaryValue(job);

    return value == null ? "Salary not disclosed" : formatMoney(value);
  }

  function formatMoney(amount) {
    try {
      return new Intl.NumberFormat(state.config.locale, {
        style: "currency",
        currency: state.config.currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return String(amount);
    }
  }

  function getJobText(job) {
    return [
      job.title,
      job.company,
      job.location,
      job.city,
      job.state,
      job.country,
      job.category,
      job.department,
      job.description,
      job.requirements,
      job.skills,
      job.employmentType,
      job.type,
      job.workMode,
      job.qualification
    ].concat(asArray(job.tags)).map(function (value) {
      return Array.isArray(value) ? value.join(" ") : String(value || "");
    }).join(" ");
  }

  function getField(job, field) {
    var value = job[field];

    if (value == null && field === "type") {
      value = job.employmentType;
    }

    if (value == null && field === "location") {
      value = [job.city, job.state, job.country].filter(Boolean).join(", ");
    }

    return value;
  }

  function selectedValue(selector) {
    var element = find(selector);
    return element ? text(element.value, 200) : "";
  }

  function getFilters() {
    return {
      keyword: normalize(selectedValue(SELECTORS.keyword)),
      location: normalize(selectedValue(SELECTORS.location)),
      category: normalize(selectedValue(SELECTORS.category)),
      type: normalize(selectedValue(SELECTORS.type)),
      mode: normalize(selectedValue(SELECTORS.mode)),
      minSalary: number(selectedValue(SELECTORS.minSalary)),
      maxSalary: number(selectedValue(SELECTORS.maxSalary)),
      sort: selectedValue(SELECTORS.sort) || "relevance"
    };
  }

  function matches(job, filters) {
    var jobText = normalize(getJobText(job));

    if (filters.keyword && !jobText.includes(filters.keyword)) {
      return false;
    }

    if (filters.location) {
      var location = normalize(getField(job, "location"));
      var locationText = normalize([
        job.city, job.state, job.country, job.location
      ].filter(Boolean).join(" "));

      if (
        !location.includes(filters.location) &&
        !locationText.includes(filters.location)
      ) {
        return false;
      }
    }

    if (
      filters.category &&
      normalize(getField(job, "category")) !== filters.category
    ) {
      return false;
    }

    if (filters.type) {
      var type = normalize(getField(job, "type"));

      if (type !== filters.type) return false;
    }

    if (filters.mode) {
      if (normalize(getField(job, "workMode")) !== filters.mode) {
        return false;
      }
    }

    var salary = salaryValue(job);

    if (filters.minSalary != null) {
      if (salary == null || salary < filters.minSalary) return false;
    }

    if (filters.maxSalary != null) {
      if (salary == null || salary > filters.maxSalary) return false;
    }

    return true;
  }

  function dateValue(job) {
    var value = job.postedAt || job.datePosted || job.createdAt;
    if (!value) return 0;

    var timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function sortJobs(jobs, sort, keyword) {
    var result = jobs.slice();

    result.sort(function (a, b) {
      if (sort === "newest") {
        return dateValue(b) - dateValue(a);
      }

      if (sort === "salary-high") {
        return (salaryValue(b) || -1) - (salaryValue(a) || -1);
      }

      if (sort === "salary-low") {
        var salaryA = salaryValue(a);
        var salaryB = salaryValue(b);

        if (salaryA == null) return 1;
        if (salaryB == null) return -1;

        return salaryA - salaryB;
      }

      if (sort === "title") {
        return text(a.title).localeCompare(text(b.title));
      }

      if (keyword) {
        var term = keyword;
        var scoreA = normalize(a.title).includes(term) ? 2 : 0;
        var scoreB = normalize(b.title).includes(term) ? 2 : 0;

        scoreA += normalize(a.company).includes(term) ? 1 : 0;
        scoreB += normalize(b.company).includes(term) ? 1 : 0;

        if (scoreA !== scoreB) return scoreB - scoreA;
      }

      return dateValue(b) - dateValue(a);
    });

    return result;
  }

  function createElement(tag, className, value) {
    var element = document.createElement(tag);

    if (className) element.className = className;
    if (value != null) element.textContent = text(value, 2000);

    return element;
  }

  function createJobCard(job) {
    var card = createElement("article", "mo-job-card");
    card.setAttribute("data-job-id", text(job.id || job.slug || "", 150));

    var heading = createElement("h3", "mo-job-card__title", job.title || "Untitled role");
    card.appendChild(heading);

    if (job.company) {
      card.appendChild(createElement("p", "mo-job-card__company", job.company));
    }

    var location = job.location ||
      [job.city, job.state, job.country].filter(Boolean).join(", ");

    if (location) {
      card.appendChild(createElement("p", "mo-job-card__location", location));
    }

    var metadata = createElement("ul", "mo-job-card__details");

    [
      ["Category", job.category],
      ["Employment", job.employmentType || job.type],
      ["Work mode", job.workMode],
      ["Salary", salaryLabel(job)]
    ].forEach(function (pair) {
      if (!pair[1]) return;

      var item = createElement("li", "", pair[0] + ": " + pair[1]);
      metadata.appendChild(item);
    });

    card.appendChild(metadata);

    if (job.description) {
      card.appendChild(
        createElement("p", "mo-job-card__description", job.description)
      );
    }

    var linkUrl = safeUrl(job.applyUrl || job.url || job.detailUrl);

    if (linkUrl) {
      var link = createElement("a", "mo-job-card__link", job.applyLabel || "View opportunity");
      link.href = linkUrl;

      if (new URL(linkUrl, window.location.href).origin !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      card.appendChild(link);
    }

    return card;
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

  function renderResults() {
    var container = find(SELECTORS.results);
    var count = find(SELECTORS.count);
    var status = find(SELECTORS.status);
    var pagination = find(SELECTORS.pagination);
    var loading = find(SELECTORS.loading);
    var empty = find(SELECTORS.empty);
    var error = find(SELECTORS.error);

    if (loading) loading.hidden = !state.loading;
    if (error) {
      error.hidden = !state.error;
      error.textContent = state.error;
    }

    if (!container) return;

    container.replaceChildren();

    var total = state.filtered.length;
    var pageCount = Math.max(1, Math.ceil(total / state.pageSize));

    state.page = Math.min(Math.max(1, state.page), pageCount);

    var start = (state.page - 1) * state.pageSize;
    var visibleJobs = state.filtered.slice(start, start + state.pageSize);

    visibleJobs.forEach(function (job) {
      container.appendChild(createJobCard(job));
    });

    if (count) {
      count.textContent = total === 1 ? "1 job found" : total + " jobs found";
    }

    if (status) {
      status.textContent = total
        ? "Showing " + (start + 1) + "–" +
          Math.min(start + state.pageSize, total) + " of " + total + " jobs."
        : "No jobs match your search.";
    }

    if (empty) empty.hidden = total > 0;
    if (pagination) pagination.hidden = total <= state.pageSize;

    var previous = find(SELECTORS.previous);
    var next = find(SELECTORS.next);
    var pageNumber = find(SELECTORS.pageNumber);

    if (previous) previous.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= pageCount;
    if (pageNumber) pageNumber.textContent = state.page + " / " + pageCount;
  }

  function applyFilters() {
    var filters = getFilters();

    if (
      filters.minSalary != null &&
      filters.maxSalary != null &&
      filters.minSalary > filters.maxSalary
    ) {
      var maxField = find(SELECTORS.maxSalary);

      if (maxField) {
        maxField.setCustomValidity("Maximum salary must be greater than or equal to minimum salary.");
        maxField.reportValidity();
      }

      return;
    }

    var maxSalaryField = find(SELECTORS.maxSalary);
    if (maxSalaryField) maxSalaryField.setCustomValidity("");

    state.filtered = sortJobs(
      state.jobs.filter(function (job) {
        return matches(job, filters);
      }),
      filters.sort,
      filters.keyword
    );

    state.page = 1;
    renderResults();
  }

  function populateOptions(selector, values) {
    var select = find(selector);
    if (!select) return;

    var existing = select.value;
    var placeholder = select.options.length
      ? select.options[0].textContent
      : "All";

    select.replaceChildren();

    var first = document.createElement("option");
    first.value = "";
    first.textContent = placeholder;
    select.appendChild(first);

    Array.from(new Set(values.filter(Boolean).map(function (value) {
      return text(value, 150);
    }))).sort(function (a, b) {
      return a.localeCompare(b);
    }).forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });

    if (Array.from(select.options).some(function (option) {
      return option.value === existing;
    })) {
      select.value = existing;
    }
  }

  function populateFilters() {
    populateOptions(SELECTORS.category, state.jobs.map(function (job) {
      return job.category;
    }));

    populateOptions(SELECTORS.type, state.jobs.map(function (job) {
      return job.employmentType || job.type;
    }));

    populateOptions(SELECTORS.mode, state.jobs.map(function (job) {
      return job.workMode;
    }));
  }

  function normalizeJobs(data) {
    var jobs = Array.isArray(data)
      ? data
      : data && Array.isArray(data.jobs)
        ? data.jobs
        : data && Array.isArray(data.results)
          ? data.results
          : null;

    if (!jobs) {
      throw new Error("The jobs dataset must be an array or contain a jobs/results array.");
    }

    return jobs.filter(function (job) {
      return job && typeof job === "object" &&
        !Array.isArray(job) && typeof job.title === "string";
    }).map(function (job, index) {
      var copy = Object.assign({}, job);

      copy.id = text(copy.id || copy.slug || "job-" + (index + 1), 150);
      copy.title = text(copy.title, 200);
      copy.company = text(copy.company, 200);
      copy.location = text(copy.location, 250);
      copy.category = text(copy.category, 150);
      copy.employmentType = text(copy.employmentType || copy.type, 100);
      copy.workMode = text(copy.workMode, 100);
      copy.description = text(copy.description, 1500);

      return copy;
    });
  }

  async function loadData(url) {
    state.loading = true;
    state.error = "";
    renderResults();

    try {
      var safeDataUrl = safeUrl(url || state.config.dataUrl);

      if (!safeDataUrl) {
        throw new Error("The jobs data URL is invalid.");
      }

      var response = await fetch(safeDataUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Unable to load jobs (HTTP " + response.status + ").");
      }

      var data = await response.json();

      if (state.destroyed) return [];

      state.jobs = normalizeJobs(data);
      populateFilters();
      applyFilters();

      return state.jobs;
    } catch (error) {
      state.error = error && error.message
        ? error.message
        : "Unable to load job listings.";

      state.jobs = [];
      state.filtered = [];
      renderResults();

      return [];
    } finally {
      state.loading = false;
      renderResults();
    }
  }

  function clearFilters() {
    [
      SELECTORS.keyword,
      SELECTORS.location,
      SELECTORS.category,
      SELECTORS.type,
      SELECTORS.mode,
      SELECTORS.minSalary,
      SELECTORS.maxSalary
    ].forEach(function (selector) {
      var element = find(selector);
      if (element) element.value = "";
    });

    var sort = find(SELECTORS.sort);
    if (sort) sort.value = "relevance";

    var maxSalaryField = find(SELECTORS.maxSalary);
    if (maxSalaryField) maxSalaryField.setCustomValidity("");

    applyFilters();
  }

  function initialize() {
    if (state.initialized || state.destroyed) return;

    var root = getRoot();
    if (!root) return;

    state.initialized = true;

    var form = root.querySelector(SELECTORS.form);

    if (form) {
      listen(form, "submit", function (event) {
        event.preventDefault();
        applyFilters();
      });
    }

    [
      SELECTORS.location,
      SELECTORS.category,
      SELECTORS.type,
      SELECTORS.mode,
      SELECTORS.sort,
      SELECTORS.pageSize
    ].forEach(function (selector) {
      findAll(selector).forEach(function (element) {
        listen(element, "change", function () {
          if (selector === SELECTORS.pageSize) {
            var size = Number(element.value);

            if (Number.isInteger(size) && size > 0) {
              state.pageSize = Math.min(size, state.config.maxPageSize);
            }
          }

          applyFilters();
        });
      });
    });

    [SELECTORS.keyword, SELECTORS.minSalary, SELECTORS.maxSalary]
      .forEach(function (selector) {
        findAll(selector).forEach(function (element) {
          listen(element, "input", function () {
            window.clearTimeout(state.timer);

            state.timer = window.setTimeout(
              applyFilters,
              state.config.debounceMs
            );
          });
        });
      });

    var clearButton = find(SELECTORS.clear);

    if (clearButton) {
      listen(clearButton, "click", function () {
        clearFilters();
      });
    }

    var previous = find(SELECTORS.previous);
    if (previous) {
      listen(previous, "click", function () {
        if (state.page > 1) {
          state.page -= 1;
          renderResults();
        }
      });
    }

    var next = find(SELECTORS.next);
    if (next) {
      listen(next, "click", function () {
        var pageCount = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));

        if (state.page < pageCount) {
          state.page += 1;
          renderResults();
        }
      });
    }

    loadData(root.getAttribute("data-job-data-url") || state.config.dataUrl);
  }

  function refresh() {
    if (state.destroyed) return;

    var root = getRoot();

    if (!root) {
      state.initialized = false;
      return;
    }

    if (!state.initialized) {
      initialize();
    }
  }

  function destroy() {
    if (state.destroyed) return;

    window.clearTimeout(state.timer);

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    load: loadData,
    search: applyFilters,
    clear: clearFilters,
    refresh: refresh,
    destroy: destroy,
    getJobs: function () {
      return state.jobs.slice();
    },
    getResults: function () {
      return state.filtered.slice();
    },
    configure: function (options) {
      if (!options || typeof options !== "object") return;

      if (typeof options.dataUrl === "string") {
        state.config.dataUrl = options.dataUrl;
      }

      if (Number.isInteger(options.pageSize) && options.pageSize > 0) {
        state.pageSize = Math.min(options.pageSize, state.config.maxPageSize);
      }

      if (typeof options.currency === "string") {
        state.config.currency = options.currency;
      }

      if (typeof options.locale === "string") {
        state.config.locale = options.locale;
      }
    }
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsJobSearch = api;

  function boot() {
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function () {
        if (!state.initialized && !state.destroyed) refresh();
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
