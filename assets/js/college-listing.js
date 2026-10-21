
/* =========================================================
   MedOrbits -- College Listing
   File: /assets/js/college-listing.js
   Features: Load, search, filter, sort, paginate and render colleges
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsCollegeListing) return;

  const DEFAULTS = Object.freeze({
    dataUrl: "/assets/data/colleges.json",
    pageSize: 12,
    container: "[data-college-list]",
    search: "[data-college-search]",
    filters: "[data-college-filter]",
    sort: "[data-college-sort]",
    pagination: "[data-college-pagination]",
    count: "[data-college-count]",
    empty: "[data-college-empty]",
    loading: "[data-college-loading]",
    error: "[data-college-error]"
  });

  const state = {
    colleges: [],
    filtered: [],
    page: 1,
    pageSize: 12,
    search: "",
    filters: {},
    sort: "name-asc",
    loading: false,
    initialized: false,
    controller: null,
    elements: {},
    config: {},
    listeners: []
  };

  const boundElements = new WeakSet();

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function getValue(object, keys, fallback = "") {
    for (const key of keys) {
      const value = key.split(".").reduce(
        (current, part) => current?.[part],
        object
      );

      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    return fallback;
  }

  function getName(college) {
    return String(getValue(college, [
      "name",
      "collegeName",
      "institutionName",
      "title"
    ], "Unnamed College"));
  }

  function getId(college, index = 0) {
    return String(getValue(college, [
      "id",
      "collegeId",
      "slug",
      "code"
    ], `college-${index + 1}`));
  }

  function getLocation(college) {
    const city = getValue(college, ["city", "location.city"]);
    const stateName = getValue(college, ["state", "location.state"]);
    const country = getValue(college, ["country", "location.country"]);

    return [
      city,
      stateName,
      country
    ].filter(Boolean).join(", ") ||
      String(getValue(college, ["location", "address"], "Location unavailable"));
  }

  function getCourses(college) {
    const courses = getValue(college, [
      "courses",
      "programs",
      "courseNames"
    ], []);

    if (Array.isArray(courses)) {
      return courses.map((course) => {
        if (typeof course === "string") return course;

        return String(getValue(course, [
          "name",
          "title",
          "courseName"
        ], ""));
      }).filter(Boolean);
    }

    return courses ? [String(courses)] : [];
  }

  function getFees(college) {
    return getValue(college, [
      "fees",
      "annualFees",
      "tuitionFees",
      "fee"
    ], null);
  }

  function getRating(college) {
    const rating = Number(getValue(college, [
      "rating",
      "reviews.rating",
      "averageRating"
    ], NaN));

    return Number.isFinite(rating) && rating >= 0
      ? rating
      : null;
  }

  function getImage(college) {
    const image = getValue(college, [
      "image",
      "imageUrl",
      "image_url",
      "coverImage",
      "logo"
    ]);

    if (!image) return "";

    try {
      const url = new URL(String(image), window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) return "";

      return url.href;
    } catch {
      return "";
    }
  }

  function getDetailUrl(college, index) {
    const rawUrl = getValue(college, [
      "url",
      "detailUrl",
      "detail_url",
      "href"
    ]);

    if (!rawUrl) return "";

    try {
      const url = new URL(String(rawUrl), window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) return "";

      return url.href;
    } catch {
      return "";
    }
  }

  function formatCurrency(value) {
    if (value === null || value === undefined || value === "") {
      return "Contact college";
    }

    if (typeof value === "string" && /[₹$€£]/.test(value)) {
      return value;
    }

    const amount = Number(String(value).replace(/,/g, ""));

    if (!Number.isFinite(amount)) return String(value);

    const formatter = window.MedOrbitsFormatters?.formatCurrency;

    if (typeof formatter === "function") {
      return formatter(amount, {
        currency: "INR",
        locale: "en-IN",
        maximumFractionDigits: 0
      });
    }

    return `₹${amount.toLocaleString("en-IN", {
      maximumFractionDigits: 0
    })}`;
  }

  function getFeeAmount(college) {
    const value = getFees(college);

    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "object") {
      const amount = getValue(value, [
        "amount",
        "annual",
        "total",
        "min"
      ], null);

      const number = Number(amount);

      return Number.isFinite(number) ? number : null;
    }

    const amount = Number(String(value).replace(/[₹,\s]/g, ""));

    return Number.isFinite(amount) ? amount : null;
  }

  function matchesSearch(college, query) {
    if (!query) return true;

    const searchable = [
      getName(college),
      getLocation(college),
      getValue(college, ["type", "collegeType", "institutionType"]),
      getValue(college, ["ownership", "management"]),
      getValue(college, ["university", "affiliation"]),
      getValue(college, ["description", "about", "overview"]),
      ...getCourses(college)
    ].join(" ");

    return normalize(searchable).includes(query);
  }

  function matchesFilters(college) {
    return Object.entries(state.filters).every(([field, expected]) => {
      if (expected === "" || expected === null || expected === undefined) {
        return true;
      }

      const actual = getValue(college, field.split("|"));

      if (Array.isArray(actual)) {
        return actual.some((value) =>
          normalize(value) === normalize(expected)
        );
      }

      return normalize(actual) === normalize(expected);
    });
  }

  function sortColleges(colleges) {
    const list = [...colleges];

    const compareText = (a, b) =>
      String(a ?? "").localeCompare(String(b ?? ""), undefined, {
        sensitivity: "base",
        numeric: true
      });

    switch (state.sort) {
      case "name-desc":
        return list.sort((a, b) => compareText(getName(b), getName(a)));

      case "fees-asc":
        return list.sort((a, b) =>
          (getFeeAmount(a) ?? Infinity) - (getFeeAmount(b) ?? Infinity)
        );

      case "fees-desc":
        return list.sort((a, b) =>
          (getFeeAmount(b) ?? -Infinity) - (getFeeAmount(a) ?? -Infinity)
        );

      case "rating-desc":
        return list.sort((a, b) =>
          (getRating(b) ?? -Infinity) - (getRating(a) ?? -Infinity)
        );

      case "name-asc":
      default:
        return list.sort((a, b) => compareText(getName(a), getName(b)));
    }
  }

  function updateResults() {
    const query = normalize(state.search);

    state.filtered = sortColleges(
      state.colleges.filter((college) =>
        matchesSearch(college, query) && matchesFilters(college)
      )
    );

    const totalPages = Math.max(
      1,
      Math.ceil(state.filtered.length / state.pageSize)
    );

    state.page = Math.min(Math.max(1, state.page), totalPages);

    render();
  }

  function renderCard(college, index) {
    const name = getName(college);
    const id = getId(college, index);
    const location = getLocation(college);
    const courses = getCourses(college);
    const fee = getFees(college);
    const rating = getRating(college);
    const image = getImage(college);
    const detailUrl = getDetailUrl(college, index);

    const imageMarkup = image
      ? `<img class="college-card__image"
               src="${escapeHTML(image)}"
               alt="${escapeHTML(name)}"
               loading="lazy"
               decoding="async">`
      : `<div class="college-card__image college-card__image--placeholder"
               aria-hidden="true">🎓</div>`;

    const courseMarkup = courses.length
      ? `<p class="college-card__courses">${escapeHTML(
          courses.slice(0, 3).join(" · ")
        )}${courses.length > 3 ? " +" + (courses.length - 3) + " more" : ""}</p>`
      : "";

    const ratingMarkup = rating !== null
      ? `<span class="college-card__rating"
               aria-label="Rating ${escapeHTML(rating)} out of 5">★ ${escapeHTML(rating)}</span>`
      : "";

    const actionMarkup = detailUrl
      ? `<a class="college-card__button"
            href="${escapeHTML(detailUrl)}">View details</a>`
      : `<button class="college-card__button"
                 type="button"
                 data-college-details="${escapeHTML(id)}">View details</button>`;

    return `
      <article class="college-card" data-college-id="${escapeHTML(id)}">
        <div class="college-card__media">
          ${imageMarkup}
          ${ratingMarkup}
        </div>
        <div class="college-card__body">
          <h3 class="college-card__title">${escapeHTML(name)}</h3>
          <p class="college-card__location">${escapeHTML(location)}</p>
          ${courseMarkup}
          <div class="college-card__footer">
            <span class="college-card__fees">${escapeHTML(formatCurrency(fee))}</span>
            ${actionMarkup}
          </div>
        </div>
      </article>
    `;
  }

  function renderPagination(totalPages) {
    const container = state.elements.pagination;
    if (!container) return;

    if (totalPages <= 1) {
      container.replaceChildren();
      container.hidden = true;
      return;
    }

    container.hidden = false;

    const buttons = [];
    const addButton = (page, label, disabled = false, current = false) => {
      buttons.push(`
        <button type="button"
          class="college-pagination__button${current ? " is-active" : ""}"
          data-college-page="${page}"
          ${disabled ? "disabled" : ""}
          ${current ? 'aria-current="page"' : ""}
          aria-label="${escapeHTML(label)}">
          ${escapeHTML(label)}
        </button>
      `);
    };

    addButton(state.page - 1, "Previous", state.page <= 1);

    const start = Math.max(1, state.page - 2);
    const end = Math.min(totalPages, state.page + 2);

    if (start > 1) {
      addButton(1, "1");
      if (start > 2) buttons.push('<span class="college-pagination__ellipsis" aria-hidden="true">…</span>');
    }

    for (let page = start; page <= end; page += 1) {
      addButton(page, String(page), false, page === state.page);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        buttons.push('<span class="college-pagination__ellipsis" aria-hidden="true">…</span>');
      }
      addButton(totalPages, String(totalPages));
    }

    addButton(state.page + 1, "Next", state.page >= totalPages);

    container.innerHTML = buttons.join("");
  }

  function render() {
    const container = state.elements.container;
    const count = state.elements.count;
    const empty = state.elements.empty;

    if (!container) return;

    const total = state.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    const start = (state.page - 1) * state.pageSize;
    const visible = state.filtered.slice(start, start + state.pageSize);

    container.innerHTML = visible.length
      ? visible.map(renderCard).join("")
      : "";

    if (count) {
      count.textContent = `${total.toLocaleString("en-IN")} college${total === 1 ? "" : "s"} found`;
    }

    if (empty) {
      empty.hidden = total !== 0;
    }

    renderPagination(totalPages);
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);

    if (state.elements.loading) {
      state.elements.loading.hidden = !state.loading;
    }

    if (state.elements.container) {
      state.elements.container.setAttribute(
        "aria-busy",
        String(state.loading)
      );
    }
  }

  function showError(message) {
    const element = state.elements.error;
    if (!element) return;

    element.textContent = message;
    element.hidden = false;
  }

  function clearError() {
    const element = state.elements.error;
    if (!element) return;

    element.textContent = "";
    element.hidden = true;
  }

  async function load(options = {}) {
    const url = options.url || state.config.dataUrl || DEFAULTS.dataUrl;

    if (state.controller) {
      state.controller.abort();
    }

    const controller = new AbortController();
    state.controller = controller;

    setLoading(true);
    clearError();

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        signal: controller.signal,
        cache: options.cache || "default"
      });

      if (!response.ok) {
        throw new Error(`College data request failed (${response.status}).`);
      }

      const payload = await response.json();

      if (controller.signal.aborted) return [];

      const colleges = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.colleges)
          ? payload.colleges
          : Array.isArray(payload?.data)
            ? payload.data
            : null;

      if (!colleges) {
        throw new Error("The college data format is invalid.");
      }

      state.colleges = colleges.filter(
        (college) => college && typeof college === "object"
      );

      state.page = 1;
      updateResults();

      return state.colleges;
    } catch (error) {
      if (error?.name === "AbortError") return [];

      showError(
        "College listings could not be loaded. Please try again."
      );

      console.error("[MedOrbitsCollegeListing]", error);

      return [];
    } finally {
      if (state.controller === controller) {
        state.controller = null;
        setLoading(false);
      }
    }
  }

  function bind(element, event, handler) {
    if (!element) return;

    element.addEventListener(event, handler);

    state.listeners.push(() => {
      element.removeEventListener(event, handler);
    });
  }

  function bindControls() {
    const { search, sort, filters, pagination, container } = state.elements;

    bind(search, "input", () => {
      state.search = search.value;
      state.page = 1;
      updateResults();
    });

    bind(sort, "change", () => {
      state.sort = sort.value || "name-asc";
      state.page = 1;
      updateResults();
    });

    if (filters) {
      const filterHandler = (event) => {
        const target = event.target.closest("[data-college-filter]");
        if (!target || !filters.contains(target)) return;

        const field = target.dataset.collegeFilter;
        if (!field) return;

        state.filters[field] = target.value;
        state.page = 1;
        updateResults();
      };

      bind(filters, "change", filterHandler);
    }

    bind(pagination, "click", (event) => {
      const button = event.target.closest("[data-college-page]");
      if (!button || button.disabled) return;

      const page = Number(button.dataset.collegePage);
      if (!Number.isInteger(page) || page < 1) return;

      state.page = page;
      render();

      state.elements.container?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });

    bind(container, "click", (event) => {
      const button = event.target.closest("[data-college-details]");
      if (!button) return;

      const id = button.dataset.collegeDetails;
      const college = state.colleges.find((item, index) =>
        getId(item, index) === id
      );

      if (!college) return;

      const detailEvent = new CustomEvent("medorbits:college-details", {
        bubbles: true,
        detail: { college }
      });

      container.dispatchEvent(detailEvent);
    });
  }

  function resolveElements(config) {
    const selectors = { ...DEFAULTS, ...config.selectors };

    const find = (selector) => {
      if (!selector) return null;

      try {
        return document.querySelector(selector);
      } catch {
        return null;
      }
    };

    return {
      container: find(selectors.container),
      search: find(selectors.search),
      sort: find(selectors.sort),
      filters: find(selectors.filters),
      pagination: find(selectors.pagination),
      count: find(selectors.count),
      empty: find(selectors.empty),
      loading: find(selectors.loading),
      error: find(selectors.error)
    };
  }

  async function init(options = {}) {
    destroy();

    state.config = { ...options };
    state.pageSize = Math.max(
      1,
      Math.floor(toNumber(options.pageSize, DEFAULTS.pageSize))
    );
    state.search = "";
    state.sort = options.sort || "name-asc";
    state.filters = {};
    state.page = 1;
    state.elements = resolveElements(options);

    if (!state.elements.container) {
      console.warn(
        "[MedOrbitsCollegeListing] Listing container not found."
      );
      return [];
    }

    if (state.elements.search) {
      state.elements.search.value = "";
    }

    if (state.elements.sort) {
      state.elements.sort.value = state.sort;
    }

    if (state.elements.empty) {
      state.elements.empty.hidden = true;
    }

    if (state.elements.error) {
      state.elements.error.hidden = true;
    }

    bindControls();
    state.initialized = true;

    return load(options);
  }

  function search(query) {
    state.search = String(query ?? "");

    if (state.elements.search) {
      state.elements.search.value = state.search;
    }

    state.page = 1;
    updateResults();

    return state.filtered;
  }

  function setFilter(field, value) {
    if (!field) return state.filtered;

    state.filters[field] = value ?? "";
    state.page = 1;
    updateResults();

    return state.filtered;
  }

  function setSort(sort) {
    state.sort = String(sort || "name-asc");
    state.page = 1;
    updateResults();

    return state.filtered;
  }

  function setPage(page) {
    const nextPage = Math.floor(toNumber(page, 1));
    const totalPages = Math.max(
      1,
      Math.ceil(state.filtered.length / state.pageSize)
    );

    state.page = Math.max(1, Math.min(nextPage, totalPages));
    render();

    return state.page;
  }

  function getColleges() {
    return [...state.colleges];
  }

  function getFilteredColleges() {
    return [...state.filtered];
  }

  function destroy() {
    state.listeners.splice(0).forEach((unbind) => {
      try {
        unbind();
      } catch {
        // Continue cleanup if an element has already been removed.
      }
    });

    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }

    state.initialized = false;
  }

  window.MedOrbitsCollegeListing = Object.freeze({
    init,
    load,
    search,
    setFilter,
    setSort,
    setPage,
    render,
    destroy,
    getColleges,
    getFilteredColleges
  });

  document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(DEFAULTS.container);

    if (container && !container.dataset.collegeListingManual) {
      init();
    }
  });

})(window, document);
