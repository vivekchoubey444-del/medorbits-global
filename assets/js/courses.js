
/* =========================================================
   MedOrbits -- Course Listing
   File: /assets/js/courses.js
   Search, filters, sorting, rendering, and course details.
   ========================================================= */

(function (window, document) {
  "use strict";

  var CONFIG = window.MedOrbitsConfig || {};
  var CONSTANTS = window.MedOrbitsConstants || {};

  var DATA_URL = "/assets/data/courses.json";
  var DETAILS_URL = "/education/course-details.html";
  var API_BASE =
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    CONFIG.apiBaseURL ||
    "/api";

  var API_URL =
    (CONSTANTS.API && CONSTANTS.API.COURSES) ||
    (CONFIG.api && CONFIG.api.endpoints &&
      CONFIG.api.endpoints.courses) ||
    String(API_BASE).replace(/\/+$/, "") + "/courses";

  var DEFAULT_FILTERS = {
    search: "",
    category: "",
    level: "",
    mode: "",
    minFee: "",
    maxFee: "",
    sort: "name-asc"
  };

  var state = {
    courses: [],
    filtered: [],
    filters: copyFilters(),
    loading: false,
    error: null,
    loaded: false
  };

  var listeners = [];
  var requestVersion = 0;
  var activeController = null;

  function copyFilters() {
    var result = {};

    Object.keys(DEFAULT_FILTERS).forEach(function (key) {
      result[key] = DEFAULT_FILTERS[key];
    });

    return result;
  }

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase();
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function getCourseId(course) {
    return String(
      course.id ||
      course.courseId ||
      course.slug ||
      ""
    );
  }

  function getCourseSlug(course) {
    return String(course.slug || course.id || course.courseId || "");
  }

  function getCourseName(course) {
    return String(
      course.name ||
      course.title ||
      course.courseName ||
      course.shortName ||
      "Untitled Course"
    );
  }

  function getCourseCategory(course) {
    return String(
      course.category ||
      course.discipline ||
      course.stream ||
      course.field ||
      ""
    );
  }

  function getCourseLevel(course) {
    return String(
      course.level ||
      course.degreeLevel ||
      course.degree ||
      ""
    );
  }

  function getCourseMode(course) {
    return String(
      course.mode ||
      course.studyMode ||
      ""
    );
  }

  function getRawFee(course) {
    var candidates = [
      course.fee,
      course.fees,
      course.annualFee,
      course.totalFee
    ];

    for (var i = 0; i < candidates.length; i += 1) {
      if (
        candidates[i] !== undefined &&
        candidates[i] !== null &&
        candidates[i] !== ""
      ) {
        var value = Number(candidates[i]);

        if (Number.isFinite(value) && value >= 0) {
          return value;
        }
      }
    }

    return null;
  }

  function getCourseFee(course) {
    var fee = getRawFee(course);
    return fee === null ? 0 : fee;
  }

  function formatCurrency(amount, currency) {
    var value = Number(amount);
    currency = currency || "INR";

    if (!Number.isFinite(value) || value < 0) {
      return "Contact for fees";
    }

    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency,
        maximumFractionDigits: 0
      }).format(value);
    } catch (error) {
      return (currency === "INR" ? "₹" : currency + " ") +
        value.toLocaleString("en-IN");
    }
  }

  function formatDuration(course) {
    if (course.duration !== undefined && course.duration !== null &&
        String(course.duration).trim() !== "") {
      return String(course.duration);
    }

    var years = Number(course.durationYears || 0);
    var months = Number(course.durationMonths || 0);
    var parts = [];

    if (Number.isFinite(years) && years > 0) {
      parts.push(years + (years === 1 ? " year" : " years"));
    }

    if (Number.isFinite(months) && months > 0) {
      parts.push(months + (months === 1 ? " month" : " months"));
    }

    return parts.length ? parts.join(" ") : "Duration varies";
  }

  function getDurationMonths(course) {
    var explicitMonths = Number(course.durationMonths);
    var years = Number(course.durationYears);

    if (Number.isFinite(explicitMonths) && explicitMonths > 0) {
      return explicitMonths;
    }

    if (Number.isFinite(years) && years > 0) {
      return years * 12;
    }

    return null;
  }

  function requestJSON(url, options) {
    options = options || {};

    var headers = {
      Accept: "application/json"
    };

    if (options.headers) {
      Object.keys(options.headers).forEach(function (key) {
        headers[key] = options.headers[key];
      });
    }

    var requestOptions = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: headers,
      signal: options.signal
    };

    if (options.body !== undefined) {
      requestOptions.body = options.body;

      if (!headers["Content-Type"]) {
        requestOptions.headers["Content-Type"] = "application/json";
      }
    }

    return window.fetch(url, requestOptions).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed (" + response.status + ").");
      }

      return response.json();
    });
  }

  function extractList(data) {
    if (Array.isArray(data)) return data;
    if (!isObject(data)) return [];

    if (Array.isArray(data.courses)) return data.courses;
    if (isObject(data.data) && Array.isArray(data.data.courses)) {
      return data.data.courses;
    }
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;

    return [];
  }

  function isActiveCourse(course) {
    return course.active !== false &&
      course.isActive !== false &&
      course.status !== "inactive" &&
      course.status !== "archived";
  }

  function normalizeCourses(courses) {
    var seen = Object.create(null);

    return courses.filter(function (course) {
      if (!isObject(course) || !isActiveCourse(course)) {
        return false;
      }

      var id = getCourseId(course);

      if (id && seen[id]) {
        return false;
      }

      if (id) {
        seen[id] = true;
      }

      return true;
    });
  }

  function notify() {
    var snapshot = getState();

    listeners.slice().forEach(function (callback) {
      try {
        callback(snapshot);
      } catch (error) {
        if (window.console && typeof window.console.error === "function") {
          window.console.error("[MedOrbits Courses] Listener error:", error);
        }
      }
    });

    if (typeof window.CustomEvent === "function") {
      document.dispatchEvent(new window.CustomEvent(
        "medorbits:courses-updated",
        { detail: snapshot }
      ));
    }
  }

  function getState() {
    return {
      courses: state.filtered.slice(),
      allCourses: state.courses.slice(),
      filters: copyCurrentFilters(),
      loading: state.loading,
      error: state.error,
      loaded: state.loaded
    };
  }

  function copyCurrentFilters() {
    var result = {};

    Object.keys(state.filters).forEach(function (key) {
      result[key] = state.filters[key];
    });

    return result;
  }

  function load(options) {
    options = options || {};

    var version = ++requestVersion;

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    var controller = null;

    if (typeof window.AbortController === "function") {
      controller = new window.AbortController();
      activeController = controller;
    }

    state.loading = true;
    state.error = null;
    notify();

    var signal = controller ? controller.signal : undefined;
    var request;

    if (options.localOnly) {
      request = requestJSON(DATA_URL, { signal: signal });
    } else {
      request = requestJSON(API_URL, { signal: signal }).catch(function () {
        if (version !== requestVersion) {
          throw new Error("Course request superseded.");
        }

        return requestJSON(DATA_URL, { signal: signal });
      });
    }

    return request.then(function (data) {
      if (version !== requestVersion) {
        return getCourses();
      }

      state.courses = normalizeCourses(extractList(data));
      state.loaded = true;
      state.error = null;

      applyFilters();

      return getCourses();
    }).catch(function (error) {
      if (version !== requestVersion) {
        return getCourses();
      }

      state.error = error && error.name === "AbortError"
        ? null
        : "Course information could not be loaded. Please try again.";

      if (!state.loaded) {
        state.courses = [];
        state.filtered = [];
      }

      notify();
      return getCourses();
    }).then(function (courses) {
      if (version === requestVersion) {
        state.loading = false;
        activeController = null;
        notify();
      }

      return courses;
    });
  }

  function applyFilters() {
    var filters = state.filters;
    var results = state.courses.slice();
    var query = normalize(filters.search);

    if (query) {
      results = results.filter(function (course) {
        var searchable = [
          getCourseName(course),
          getCourseCategory(course),
          getCourseLevel(course),
          getCourseMode(course),
          course.description,
          course.eligibility,
          course.degree,
          course.shortName,
          course.slug,
          course.id
        ].map(normalize).join(" ");

        return searchable.indexOf(query) !== -1;
      });
    }

    if (filters.category) {
      results = results.filter(function (course) {
        return normalize(getCourseCategory(course)) ===
          normalize(filters.category);
      });
    }

    if (filters.level) {
      results = results.filter(function (course) {
        return normalize(getCourseLevel(course)) === normalize(filters.level);
      });
    }

    if (filters.mode) {
      results = results.filter(function (course) {
        return normalize(getCourseMode(course)) === normalize(filters.mode);
      });
    }

    if (filters.minFee !== "") {
      var minimum = Number(filters.minFee);

      if (Number.isFinite(minimum) && minimum >= 0) {
        results = results.filter(function (course) {
          var fee = getRawFee(course);
          return fee !== null && fee >= minimum;
        });
      }
    }

    if (filters.maxFee !== "") {
      var maximum = Number(filters.maxFee);

      if (Number.isFinite(maximum) && maximum >= 0) {
        results = results.filter(function (course) {
          var fee = getRawFee(course);
          return fee !== null && fee <= maximum;
        });
      }
    }

    results.sort(function (a, b) {
      switch (filters.sort) {
        case "name-desc":
          return getCourseName(b).localeCompare(getCourseName(a));

        case "fee-asc":
          return compareFees(a, b, 1);

        case "fee-desc":
          return compareFees(a, b, -1);

        case "duration-asc":
          return compareDuration(a, b);

        case "duration-desc":
          return compareDuration(b, a);

        case "name-asc":
        default:
          return getCourseName(a).localeCompare(getCourseName(b));
      }
    });

    state.filtered = results;
    notify();

    return getCourses();
  }

  function compareFees(a, b, direction) {
    var feeA = getRawFee(a);
    var feeB = getRawFee(b);

    if (feeA === null && feeB === null) return 0;
    if (feeA === null) return 1;
    if (feeB === null) return -1;

    return (feeA - feeB) * direction;
  }

  function compareDuration(a, b) {
    var durationA = getDurationMonths(a);
    var durationB = getDurationMonths(b);

    if (durationA === null && durationB === null) return 0;
    if (durationA === null) return 1;
    if (durationB === null) return -1;

    return durationA - durationB;
  }

  function setFilters(updates) {
    if (!isObject(updates)) return getCourses();

    Object.keys(updates).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_FILTERS, key)) {
        return;
      }

      var value = updates[key];

      if (value === undefined || value === null) {
        value = "";
      }

      if (key === "search" || key === "category" ||
          key === "level" || key === "mode" || key === "sort") {
        state.filters[key] = String(value).trim();
      } else {
        state.filters[key] = value === "" ? "" : String(value);
      }
    });

    return applyFilters();
  }

  function resetFilters() {
    state.filters = copyFilters();
    return applyFilters();
  }

  function getCourses() {
    return state.filtered.slice();
  }

  function getAllCourses() {
    return state.courses.slice();
  }

  function getCourse(id) {
    var target = String(id == null ? "" : id);

    for (var i = 0; i < state.courses.length; i += 1) {
      if (
        getCourseId(state.courses[i]) === target ||
        getCourseSlug(state.courses[i]) === target ||
        normalize(getCourseName(state.courses[i])) === normalize(target)
      ) {
        return state.courses[i];
      }
    }

    return null;
  }

  function uniqueSorted(values) {
    var seen = Object.create(null);
    var result = [];

    values.forEach(function (value) {
      var text = String(value == null ? "" : value).trim();
      var key = normalize(text);

      if (text && !seen[key]) {
        seen[key] = true;
        result.push(text);
      }
    });

    return result.sort(function (a, b) {
      return a.localeCompare(b);
    });
  }

  function getCategories() {
    return uniqueSorted(state.courses.map(getCourseCategory));
  }

  function getLevels() {
    return uniqueSorted(state.courses.map(getCourseLevel));
  }

  function getModes() {
    return uniqueSorted(state.courses.map(getCourseMode));
  }

  function renderCard(course) {
    var id = getCourseId(course);
    var slug = getCourseSlug(course);
    var name = getCourseName(course);
    var feeValue = getRawFee(course);
    var fee = feeValue === null
      ? "Contact for fees"
      : formatCurrency(feeValue, course.currency || "INR");

    var detailsURL = DETAILS_URL + "?slug=" +
      encodeURIComponent(slug || id);

    var card = document.createElement("article");
    card.className = "course-card";
    card.setAttribute("data-course-id", id);

    var content = document.createElement("div");
    content.className = "course-card__content";

    var category = document.createElement("span");
    category.className = "course-card__category";
    category.textContent = getCourseCategory(course) || "General";

    var heading = document.createElement("h3");
    heading.className = "course-card__title";
    heading.textContent = name;

    var description = document.createElement("p");
    description.className = "course-card__description";
    description.textContent = course.description ||
      "Explore course details and admission requirements.";

    var list = document.createElement("dl");
    list.className = "course-card__details";

    addCardDetail(list, "Level", getCourseLevel(course) || "All levels");
    addCardDetail(list, "Duration", formatDuration(course));
    addCardDetail(list, "Fees", fee);

    var link = document.createElement("a");
    link.className = "course-card__link";
    link.href = detailsURL;
    link.textContent = "View Course Details";
    link.setAttribute("data-course-details", id);

    content.appendChild(category);
    content.appendChild(heading);
    content.appendChild(description);
    content.appendChild(list);
    content.appendChild(link);
    card.appendChild(content);

    return card;
  }

  function addCardDetail(list, label, value) {
    var wrapper = document.createElement("div");
    var term = document.createElement("dt");
    var description = document.createElement("dd");

    term.textContent = label;
    description.textContent = String(value);

    wrapper.appendChild(term);
    wrapper.appendChild(description);
    list.appendChild(wrapper);
  }

  function resolveElement(container) {
    if (typeof container !== "string") {
      return container || null;
    }

    try {
      return document.querySelector(container);
    } catch (error) {
      return null;
    }
  }

  function render(container, courses) {
    var target = resolveElement(container);

    if (!target) return false;

    var list = Array.isArray(courses) ? courses : state.filtered;

    target.textContent = "";

    if (state.loading && !list.length) {
      target.appendChild(createStatus("Loading courses...", ""));
      return true;
    }

    if (state.error && !list.length) {
      target.appendChild(createStatus(state.error, "courses-status--error"));
      return true;
    }

    if (!list.length) {
      target.appendChild(createStatus("No courses found.", ""));
      return true;
    }

    var fragment = document.createDocumentFragment();

    list.forEach(function (course) {
      fragment.appendChild(renderCard(course));
    });

    target.appendChild(fragment);
    return true;
  }

  function createStatus(message, modifier) {
    var paragraph = document.createElement("p");
    paragraph.className = "courses-status" +
      (modifier ? " " + modifier : "");
    paragraph.textContent = message;
    paragraph.setAttribute("role", "status");

    return paragraph;
  }

  function renderFilters(container) {
    var target = resolveElement(container);

    if (!target) return false;

    target.textContent = "";

    var form = document.createElement("form");
    form.className = "courses-filters";
    form.setAttribute("data-courses-filter-form", "");

    addInput(form, "search", "search", "Search courses...", state.filters.search);
    addSelect(form, "category", "Course category", "All categories",
      getCategories(), state.filters.category);
    addSelect(form, "level", "Course level", "All levels",
      getLevels(), state.filters.level);
    addSelect(form, "mode", "Study mode", "All study modes",
      getModes(), state.filters.mode);

    addInput(form, "minFee", "number", "Minimum fee", state.filters.minFee);
    addInput(form, "maxFee", "number", "Maximum fee", state.filters.maxFee);

    var sortOptions = [
      { value: "name-asc", label: "Name: A–Z" },
      { value: "name-desc", label: "Name: Z–A" },
      { value: "fee-asc", label: "Fee: Low to high" },
      { value: "fee-desc", label: "Fee: High to low" },
      { value: "duration-asc", label: "Duration: Shortest first" },
      { value: "duration-desc", label: "Duration: Longest first" }
    ];

    addSelect(form, "sort", "Sort courses", "", sortOptions,
      state.filters.sort, true);

    var applyButton = document.createElement("button");
    applyButton.type = "submit";
    applyButton.textContent = "Apply Filters";

    var resetButton = document.createElement("button");
    resetButton.type = "reset";
    resetButton.textContent = "Reset";
    resetButton.setAttribute("data-courses-reset", "");

    form.appendChild(applyButton);
    form.appendChild(resetButton);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var formData = new window.FormData(form);

      setFilters({
        search: formData.get("search"),
        category: formData.get("category"),
        level: formData.get("level"),
        mode: formData.get("mode"),
        minFee: formData.get("minFee"),
        maxFee: formData.get("maxFee"),
        sort: formData.get("sort")
      });
    });

    form.addEventListener("reset", function (event) {
      event.preventDefault();
      resetFilters();
      renderFilters(target);
    });

    target.appendChild(form);
    return true;
  }

  function addInput(form, name, type, placeholder, value) {
    var input = document.createElement("input");

    input.type = type;
    input.name = name;
    input.placeholder = placeholder;
    input.value = value == null ? "" : String(value);
    input.setAttribute("aria-label", placeholder);

    if (type === "number") {
      input.min = "0";
      input.step = "any";
    }

    form.appendChild(input);
  }

  function addSelect(form, name, label, placeholder, options, selected, custom) {
    var select = document.createElement("select");
    select.name = name;
    select.setAttribute("aria-label", label);

    if (placeholder) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = placeholder;
      select.appendChild(empty);
    }

    options.forEach(function (option) {
      var value = custom ? option.value : option;
      var text = custom ? option.label : option;
      var item = document.createElement("option");

      item.value = value;
      item.textContent = text;

      if (normalize(value) === normalize(selected)) {
        item.selected = true;
      }

      select.appendChild(item);
    });

    form.appendChild(select);
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    if (listeners.indexOf(callback) === -1) {
      listeners.push(callback);
    }

    return function () {
      var index = listeners.indexOf(callback);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  function init(options) {
    options = options || {};

    var filtersSelector = options.filters || "[data-courses-filters]";
    var listSelector = options.list || "[data-courses-list]";
    var filtersContainer = resolveElement(filtersSelector);
    var listContainer = resolveElement(listSelector);

    if (filtersContainer) {
      renderFilters(filtersContainer);
    }

    var unsubscribe = subscribe(function () {
      if (listContainer) {
        render(listContainer);
      }
    });

    return load(options).then(function (courses) {
      if (filtersContainer) {
        renderFilters(filtersContainer);
      }

      if (listContainer) {
        render(listContainer, courses);
      }

      return courses;
    }).then(function (courses) {
      return courses;
    });
  }

  var api = {
    load: load,
    init: init,
    getCourses: getCourses,
    getAllCourses: getAllCourses,
    getCourse: getCourse,
    getCategories: getCategories,
    getLevels: getLevels,
    getModes: getModes,
    getState: getState,
    setFilters: setFilters,
    resetFilters: resetFilters,
    applyFilters: applyFilters,
    formatCurrency: formatCurrency,
    formatDuration: formatDuration,
    render: render,
    renderCard: renderCard,
    renderFilters: renderFilters,
    subscribe: subscribe
  };

  window.MedOrbitsCourses = Object.freeze
    ? Object.freeze(api)
    : api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      if (document.querySelector("[data-courses-list]") ||
          document.querySelector("[data-courses-filters]")) {
        init();
      }
    });
  } else if (
    document.querySelector("[data-courses-list]") ||
    document.querySelector("[data-courses-filters]")
  ) {
    init();
  }

})(window, document);
