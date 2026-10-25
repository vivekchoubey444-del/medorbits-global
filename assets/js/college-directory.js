
/* =========================================================
   MEDORBITS | COLLEGE DIRECTORY
   File: assets/js/college-directory.js
   Version: 1.0.0

   Features:
   - College directory search and filtering
   - State, course, ownership and type filters
   - Sorting and pagination
   - JSON data loading
   - Safe DOM rendering (no unsafe HTML injection)
   - Accessible announcements and keyboard support
   - Dynamic content support
   - Optional integration with MedOrbitsAPI
   - No external dependencies

   Supported data attributes:
   [data-college-directory]
   [data-college-search]
   [data-college-state-filter]
   [data-college-course-filter]
   [data-college-type-filter]
   [data-college-ownership-filter]
   [data-college-sort]
   [data-college-page-size]
   [data-college-results]
   [data-college-result-count]
   [data-college-empty]
   [data-college-pagination]
   [data-college-prev]
   [data-college-next]
   [data-college-page-indicator]
   [data-college-data-url]
   [data-college-card]
   [data-college-detail-link]
   ========================================================= */

(function collegeDirectoryModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_COLLEGE_DIRECTORY_V1__";

  if (window[GLOBAL_KEY]) {
    if (typeof window[GLOBAL_KEY].refresh === "function") {
      window[GLOBAL_KEY].refresh();
    }
    return;
  }

  var CONFIG = {
    dataUrl: "",
    pageSize: 12,
    maxPageSize: 100,
    searchDebounce: 150,
    observeDOM: true,
    selectors: {
      directory: "[data-college-directory]",
      search: "[data-college-search]",
      state: "[data-college-state-filter]",
      course: "[data-college-course-filter]",
      type: "[data-college-type-filter]",
      ownership: "[data-college-ownership-filter]",
      sort: "[data-college-sort]",
      pageSize: "[data-college-page-size]",
      results: "[data-college-results]",
      count: "[data-college-result-count]",
      empty: "[data-college-empty]",
      pagination: "[data-college-pagination]",
      previous: "[data-college-prev]",
      next: "[data-college-next]",
      pageIndicator: "[data-college-page-indicator]"
    }
  };

  var state = {
    initialized: false,
    destroyed: false,
    observer: null,
    directories: new WeakMap(),
    directoryElements: new Set(),
    dataCache: new Map(),
    globalData: [],
    announcement: null,
    styleElement: null,
    listeners: [],
    requestControllers: new WeakMap()
  };

  var textEncoder = document.createElement("textarea");

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function cleanText(value, maxLength) {
    var result = String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim();

    return result.slice(0, maxLength || 500);
  }

  function safeArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value == null || value === "") {
      return [];
    }

    return [value];
  }

  function parseBoolean(value, fallback) {
    if (value == null || value === "") {
      return fallback;
    }

    return !["false", "0", "no", "off"].includes(
      normalizeText(value)
    );
  }

  function parsePositiveInteger(value, fallback, maximum) {
    var number = Number.parseInt(value, 10);

    if (!Number.isFinite(number) || number < 1) {
      return fallback;
    }

    return Math.min(number, maximum || CONFIG.maxPageSize);
  }

  function uniqueStrings(values) {
    var seen = new Set();
    var result = [];

    safeArray(values).forEach(function (value) {
      var item = cleanText(value, 160);

      if (!item) {
        return;
      }

      var key = normalizeText(item);

      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    });

    return result;
  }

  function getElement(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function getElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function announce(message, root) {
    var target = root
      ? getElement(root, "[data-college-announcer]")
      : null;

    if (!target) {
      target = state.announcement;
    }

    if (target) {
      target.textContent = "";
      window.requestAnimationFrame(function () {
        if (target.isConnected) {
          target.textContent = cleanText(message, 500);
        }
      });
    }
  }

  function createAnnouncement(root) {
    var existing = getElement(root, "[data-college-announcer]");

    if (existing) {
      existing.setAttribute("aria-live", "polite");
      existing.setAttribute("aria-atomic", "true");
      return existing;
    }

    var region = document.createElement("div");
    region.setAttribute("data-college-announcer", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "mo-college-visually-hidden";

    root.appendChild(region);
    return region;
  }

  function injectStyles() {
    if (document.getElementById("mo-college-directory-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mo-college-directory-styles";

    style.textContent = [
      ".mo-college-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}",
      "[data-college-directory] [hidden]{display:none!important}",
      "[data-college-directory] [aria-invalid='true']{outline-offset:2px}",
      "[data-college-directory] [data-college-card][hidden]{display:none!important}"
    ].join("\n");

    document.head.appendChild(style);
    state.styleElement = style;
  }

  /*
   * Expected normalized college record:
   * {
   *   id, name, slug, state, city, country,
   *   courses, type, ownership, accreditation,
   *   website, officialUrl, address, description,
   *   establishedYear, fees, sourceUrl, verificationStatus
   * }
   *
   * Alternative source keys are accepted where practical.
   */

  function normalizeCollege(record, index) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return null;
    }

    var name = cleanText(
      record.name || record.collegeName || record.institutionName ||
      record.title,
      250
    );

    if (!name) {
      return null;
    }

    var courses = uniqueStrings(
      record.courses ||
      record.programs ||
      record.courseNames ||
      record.course ||
      record.program
    );

    var id = cleanText(
      record.id || record.collegeId || record.code ||
      record.slug || ("college-" + (index + 1)),
      160
    );

    var website = cleanText(
      record.website || record.officialUrl ||
      record.officialWebsite || record.url,
      1000
    );

    var sourceUrl = cleanText(
      record.sourceUrl || record.source || record.officialSource,
      1000
    );

    var fees = record.fees != null
      ? record.fees
      : (record.feeStructure != null ? record.feeStructure : null);

    return {
      id: id,
      name: name,
      slug: cleanText(record.slug || "", 250),
      state: cleanText(record.state || record.stateName || "", 160),
      city: cleanText(record.city || record.district || "", 160),
      country: cleanText(record.country || "India", 100),
      courses: courses,
      type: cleanText(
        record.type || record.institutionType || record.collegeType || "",
        160
      ),
      ownership: cleanText(
        record.ownership || record.management || record.sector || "",
        160
      ),
      accreditation: cleanText(
        record.accreditation || record.recognition || "",
        300
      ),
      website: website,
      address: cleanText(record.address || "", 500),
      description: cleanText(
        record.description || record.summary || "",
        2000
      ),
      establishedYear: record.establishedYear != null
        ? record.establishedYear
        : (record.yearEstablished != null ? record.yearEstablished : null),
      fees: fees,
      sourceUrl: sourceUrl,
      verificationStatus: cleanText(
        record.verificationStatus || record.status || "unverified",
        100
      ),
      raw: record
    };
  }

  function normalizeDataset(payload) {
    var records = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.colleges)
        ? payload.colleges
        : payload && Array.isArray(payload.data)
          ? payload.data
          : payload && Array.isArray(payload.results)
            ? payload.results
            : null;

    if (!records) {
      throw new Error(
        "Invalid college dataset. Expected an array or an object containing colleges."
      );
    }

    return records
      .map(normalizeCollege)
      .filter(Boolean);
  }

  function getSearchText(college) {
    return normalizeText([
      college.name,
      college.state,
      college.city,
      college.country,
      college.type,
      college.ownership,
      college.accreditation,
      college.description,
      college.address,
      college.courses.join(" ")
    ].join(" "));
  }

  function getDirectoryConfig(root) {
    var pageSize = parsePositiveInteger(
      root.getAttribute("data-college-page-size"),
      CONFIG.pageSize,
      CONFIG.maxPageSize
    );

    return {
      pageSize: pageSize,
      dataUrl: cleanText(
        root.getAttribute("data-college-data-url") ||
        root.getAttribute("data-source") ||
        CONFIG.dataUrl,
        1000
      ),
      localSearch: parseBoolean(
        root.getAttribute("data-college-local-search"),
        true
      ),
      sort: "name-asc"
    };
  }

  function createDirectoryState(root) {
    return {
      root: root,
      config: getDirectoryConfig(root),
      allColleges: [],
      filteredColleges: [],
      currentPage: 1,
      loading: false,
      error: null,
      initialized: false,
      abortController: null,
      searchTimer: null,
      listeners: [],
      cardTemplate: getElement(root, "template[data-college-card-template]"),
      originalCards: getElements(root, "[data-college-card]"),
      generatedCards: [],
      isRendering: false
    };
  }

  function addListener(directory, element, eventName, handler, options) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler, options || false);
    directory.listeners.push(function () {
      element.removeEventListener(eventName, handler, options || false);
    });
  }

  function readFilterValues(directory) {
    var root = directory.root;

    return {
      search: normalizeText(
        (getElement(root, CONFIG.selectors.search) || {}).value || ""
      ),
      state: normalizeText(
        (getElement(root, CONFIG.selectors.state) || {}).value || ""
      ),
      course: normalizeText(
        (getElement(root, CONFIG.selectors.course) || {}).value || ""
      ),
      type: normalizeText(
        (getElement(root, CONFIG.selectors.type) || {}).value || ""
      ),
      ownership: normalizeText(
        (getElement(root, CONFIG.selectors.ownership) || {}).value || ""
      ),
      sort: cleanText(
        (getElement(root, CONFIG.selectors.sort) || {}).value || "name-asc",
        60
      )
    };
  }

  function applyFilters(directory, shouldAnnounce) {
    var filters = readFilterValues(directory);
    var results = directory.allColleges.filter(function (college) {
      if (filters.search && !getSearchText(college).includes(filters.search)) {
        return false;
      }

      if (filters.state && normalizeText(college.state) !== filters.state) {
        return false;
      }

      if (
        filters.course &&
        !college.courses.some(function (course) {
          return normalizeText(course) === filters.course;
        })
      ) {
        return false;
      }

      if (filters.type && normalizeText(college.type) !== filters.type) {
        return false;
      }

      if (
        filters.ownership &&
        normalizeText(college.ownership) !== filters.ownership
      ) {
        return false;
      }

      return true;
    });

    var compareName = function (a, b) {
      return a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true
      });
    };

    switch (filters.sort) {
      case "name-desc":
        results.sort(function (a, b) {
          return compareName(b, a);
        });
        break;
      case "state-asc":
        results.sort(function (a, b) {
          return a.state.localeCompare(b.state) || compareName(a, b);
        });
        break;
      case "city-asc":
        results.sort(function (a, b) {
          return a.city.localeCompare(b.city) || compareName(a, b);
        });
        break;
      case "newest":
        results.sort(function (a, b) {
          return (Number(b.establishedYear) || 0) -
            (Number(a.establishedYear) || 0);
        });
        break;
      case "name-asc":
      default:
        results.sort(compareName);
        break;
    }

    directory.filteredColleges = results;
    directory.currentPage = 1;

    renderDirectory(directory);

    if (shouldAnnounce) {
      announce(
        results.length + (results.length === 1 ? " college found." : " colleges found."),
        directory.root
      );
    }
  }

  function safeHttpUrl(value) {
    if (!value) {
      return "";
    }

    try {
      var url = new URL(value, window.location.origin);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function createTextElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent = cleanText(text, 2000);
    return element;
  }

  function createCollegeCard(college, directory) {
    var template = directory.cardTemplate;

    if (template && template.content) {
      var fragment = template.content.cloneNode(true);
      var card = fragment.firstElementChild;

      if (card) {
        card.setAttribute("data-college-card", "");
        card.setAttribute("data-college-id", college.id);

        var nameTarget = card.querySelector("[data-college-name]");
        var stateTarget = card.querySelector("[data-college-state]");
        var cityTarget = card.querySelector("[data-college-city]");
        var courseTarget = card.querySelector("[data-college-courses]");
        var typeTarget = card.querySelector("[data-college-type]");
        var ownershipTarget = card.querySelector("[data-college-ownership]");
        var descriptionTarget = card.querySelector("[data-college-description]");
        var addressTarget = card.querySelector("[data-college-address]");
        var accreditationTarget = card.querySelector("[data-college-accreditation]");
        var yearTarget = card.querySelector("[data-college-established]");
        var websiteTarget = card.querySelector("[data-college-website]");
        var sourceTarget = card.querySelector("[data-college-source]");

        if (nameTarget) nameTarget.textContent = college.name;
        if (stateTarget) stateTarget.textContent = college.state || "State not listed";
        if (cityTarget) cityTarget.textContent = college.city;
        if (courseTarget) courseTarget.textContent = college.courses.join(", ");
        if (typeTarget) typeTarget.textContent = college.type;
        if (ownershipTarget) ownershipTarget.textContent = college.ownership;
        if (descriptionTarget) descriptionTarget.textContent = college.description;
        if (addressTarget) addressTarget.textContent = college.address;
        if (accreditationTarget) accreditationTarget.textContent = college.accreditation;
        if (yearTarget) {
          yearTarget.textContent = college.establishedYear == null
            ? "Not listed"
            : String(college.establishedYear);
        }

        if (websiteTarget) {
          var website = safeHttpUrl(college.website);

          if (website) {
            websiteTarget.href = website;
            websiteTarget.target = "_blank";
            websiteTarget.rel = "noopener noreferrer";
            websiteTarget.hidden = false;
          } else {
            websiteTarget.hidden = true;
          }
        }

        if (sourceTarget) {
          var sourceUrl = safeHttpUrl(college.sourceUrl);

          if (sourceUrl) {
            sourceTarget.href = sourceUrl;
            sourceTarget.target = "_blank";
            sourceTarget.rel = "noopener noreferrer";
            sourceTarget.hidden = false;
          } else {
            sourceTarget.hidden = true;
          }
        }

        return card;
      }
    }

    var article = document.createElement("article");
    article.setAttribute("data-college-card", "");
    article.setAttribute("data-college-id", college.id);

    article.appendChild(createTextElement("h3", "college-directory__name", college.name));

    var location = [college.city, college.state].filter(Boolean).join(", ");

    if (location) {
      article.appendChild(
        createTextElement("p", "college-directory__location", location)
      );
    }

    if (college.courses.length) {
      article.appendChild(
        createTextElement("p", "college-directory__courses", college.courses.join(", "))
      );
    }

    if (college.type) {
      article.appendChild(
        createTextElement("p", "college-directory__type", college.type)
      );
    }

    if (college.ownership) {
      article.appendChild(
        createTextElement("p", "college-directory__ownership", college.ownership)
      );
    }

    if (college.description) {
      article.appendChild(
        createTextElement("p", "college-directory__description", college.description)
      );
    }

    var websiteUrl = safeHttpUrl(college.website);

    if (websiteUrl) {
      var websiteLink = document.createElement("a");
      websiteLink.href = websiteUrl;
      websiteLink.target = "_blank";
      websiteLink.rel = "noopener noreferrer";
      websiteLink.textContent = "Official website";
      article.appendChild(websiteLink);
    }

    var sourceUrl = safeHttpUrl(college.sourceUrl);

    if (sourceUrl) {
      var sourceLink = document.createElement("a");
      sourceLink.href = sourceUrl;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = "View source";
      article.appendChild(sourceLink);
    }

    return article;
  }

  function getCurrentPageItems(directory) {
    var start = (directory.currentPage - 1) * directory.config.pageSize;

    return directory.filteredColleges.slice(
      start,
      start + directory.config.pageSize
    );
  }

  function renderDirectory(directory) {
    if (!directory.root.isConnected || directory.isRendering) {
      return;
    }

    directory.isRendering = true;

    try {
      var root = directory.root;
      var resultsContainer = getElement(root, CONFIG.selectors.results);
      var emptyMessage = getElement(root, CONFIG.selectors.empty);
      var countElement = getElement(root, CONFIG.selectors.count);
      var pagination = getElement(root, CONFIG.selectors.pagination);
      var total = directory.filteredColleges.length;
      var totalPages = Math.max(
        1,
        Math.ceil(total / directory.config.pageSize)
      );

      directory.currentPage = Math.max(
        1,
        Math.min(directory.currentPage, totalPages)
      );

      if (countElement) {
        countElement.textContent = String(total);
      }

      if (emptyMessage) {
        emptyMessage.hidden = total !== 0;
      }

      if (resultsContainer) {
        resultsContainer.setAttribute("aria-busy", "true");

        directory.generatedCards.forEach(function (card) {
          if (card.parentNode === resultsContainer) {
            card.remove();
          }
        });

        directory.generatedCards = [];

        directory.originalCards.forEach(function (card) {
          card.hidden = true;
        });

        if (total === 0) {
          resultsContainer.setAttribute("aria-busy", "false");
        } else {
          var fragment = document.createDocumentFragment();

          getCurrentPageItems(directory).forEach(function (college) {
            var card = createCollegeCard(college, directory);
            directory.generatedCards.push(card);
            fragment.appendChild(card);
          });

          resultsContainer.appendChild(fragment);
          resultsContainer.setAttribute("aria-busy", "false");
        }
      }

      if (pagination) {
        pagination.hidden = totalPages <= 1;
      }

      var previous = getElement(root, CONFIG.selectors.previous);
      var next = getElement(root, CONFIG.selectors.next);
      var pageIndicator = getElement(root, CONFIG.selectors.pageIndicator);

      if (previous) {
        previous.disabled = directory.currentPage <= 1;
        previous.setAttribute("aria-disabled", String(previous.disabled));
      }

      if (next) {
        next.disabled = directory.currentPage >= totalPages;
        next.setAttribute("aria-disabled", String(next.disabled));
      }

      if (pageIndicator) {
        pageIndicator.textContent =
          "Page " + directory.currentPage + " of " + totalPages;
      }
    } finally {
      directory.isRendering = false;
    }
  }

  function populateFilterOptions(directory) {
    var root = directory.root;

    var filters = [
      {
        selector: CONFIG.selectors.state,
        getter: function (college) { return college.state; }
      },
      {
        selector: CONFIG.selectors.course,
        getter: function (college) { return college.courses; }
      },
      {
        selector: CONFIG.selectors.type,
        getter: function (college) { return college.type; }
      },
      {
        selector: CONFIG.selectors.ownership,
        getter: function (college) { return college.ownership; }
      }
    ];

    filters.forEach(function (filter) {
      var select = getElement(root, filter.selector);

      if (!select || select.getAttribute("data-college-auto-options") !== "true") {
        return;
      }

      var currentValue = select.value;
      var options = [];

      directory.allColleges.forEach(function (college) {
        safeArray(filter.getter(college)).forEach(function (value) {
          if (cleanText(value, 160)) {
            options.push(value);
          }
        });
      });

      var values = uniqueStrings(options).sort(function (a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
      });

      var placeholderText = cleanText(
        select.getAttribute("data-college-placeholder") ||
        select.options[0] && select.options[0].textContent ||
        "All",
        100
      );

      select.replaceChildren();

      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = placeholderText;
      select.appendChild(placeholder);

      values.forEach(function (value) {
        var option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      var matchingOption = Array.from(select.options).find(function (option) {
        return normalizeText(option.value) === normalizeText(currentValue);
      });

      if (matchingOption) {
        select.value = matchingOption.value;
      }
    });
  }

  function getApiClient() {
    return window.MedOrbitsAPI &&
      typeof window.MedOrbitsAPI.get === "function"
      ? window.MedOrbitsAPI
      : null;
  }

  async function loadData(directory, suppliedData) {
    if (suppliedData !== undefined) {
      directory.allColleges = normalizeDataset(suppliedData);
      directory.error = null;
      populateFilterOptions(directory);
      applyFilters(directory, false);
      return directory.allColleges;
    }

    if (!directory.config.dataUrl) {
      directory.allColleges = [];
      directory.error = null;
      renderDirectory(directory);
      return [];
    }

    var url = safeHttpUrl(directory.config.dataUrl);

    if (!url) {
      throw new Error("The college data URL must use HTTP or HTTPS.");
    }

    if (state.dataCache.has(url)) {
      directory.allColleges = state.dataCache.get(url).slice();
      populateFilterOptions(directory);
      applyFilters(directory, false);
      return directory.allColleges;
    }

    if (directory.abortController) {
      directory.abortController.abort();
    }

    directory.abortController = typeof AbortController === "function"
      ? new AbortController()
      : null;

    directory.loading = true;
    directory.error = null;
    announce("Loading college directory.", directory.root);

    try {
      var payload;
      var api = getApiClient();

      if (api && directory.config.dataUrl.charAt(0) === "/") {
        payload = await api.get(directory.config.dataUrl, {
          signal: directory.abortController
            ? directory.abortController.signal
            : undefined
        });
      } else {
        var response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          signal: directory.abortController
            ? directory.abortController.signal
            : undefined
        });

        if (!response.ok) {
          throw new Error("Unable to load the college directory (HTTP " + response.status + ").");
        }

        payload = await response.json();
      }

      var colleges = normalizeDataset(payload);
      state.dataCache.set(url, colleges.slice());
      directory.allColleges = colleges;

      populateFilterOptions(directory);
      applyFilters(directory, false);

      announce(
        "Loaded " + colleges.length +
        (colleges.length === 1 ? " college." : " colleges."),
        directory.root
      );

      return colleges;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return [];
      }

      directory.error = error;
      directory.allColleges = [];
      directory.filteredColleges = [];
      renderDirectory(directory);

      announce("The college directory could not be loaded.", directory.root);

      var errorTarget = getElement(
        directory.root,
        "[data-college-load-error]"
      );

      if (errorTarget) {
        errorTarget.hidden = false;
        errorTarget.textContent =
          "College data could not be loaded. Please try again later.";
      }

      throw error;
    } finally {
      directory.loading = false;
    }
  }

  function initializeDirectory(root) {
    if (!root || state.directories.has(root)) {
      return state.directories.get(root) || null;
    }

    var directory = createDirectoryState(root);
    state.directories.set(root, directory);
    state.directoryElements.add(root);

    createAnnouncement(root);

    var search = getElement(root, CONFIG.selectors.search);
    var filterSelectors = [
      CONFIG.selectors.state,
      CONFIG.selectors.course,
      CONFIG.selectors.type,
      CONFIG.selectors.ownership,
      CONFIG.selectors.sort
    ];

    if (search) {
      addListener(directory, search, "input", function () {
        if (directory.searchTimer) {
          window.clearTimeout(directory.searchTimer);
        }

        directory.searchTimer = window.setTimeout(function () {
          applyFilters(directory, true);
        }, CONFIG.searchDebounce);
      });
    }

    filterSelectors.forEach(function (selector) {
      var filter = getElement(root, selector);

      if (!filter) {
        return;
      }

      addListener(directory, filter, "change", function () {
        applyFilters(directory, true);
      });
    });

    var pageSizeControl = getElement(root, CONFIG.selectors.pageSize);

    if (pageSizeControl) {
      addListener(directory, pageSizeControl, "change", function () {
        directory.config.pageSize = parsePositiveInteger(
          pageSizeControl.value,
          CONFIG.pageSize,
          CONFIG.maxPageSize
        );

        directory.currentPage = 1;
        renderDirectory(directory);
      });
    }

    var previous = getElement(root, CONFIG.selectors.previous);
    var next = getElement(root, CONFIG.selectors.next);

    if (previous) {
      addListener(directory, previous, "click", function () {
        if (directory.currentPage > 1) {
          directory.currentPage -= 1;
          renderDirectory(directory);
          announce("Page " + directory.currentPage + ".", root);
        }
      });
    }

    if (next) {
      addListener(directory, next, "click", function () {
        var pages = Math.max(
          1,
          Math.ceil(
            directory.filteredColleges.length /
            directory.config.pageSize
          )
        );

        if (directory.currentPage < pages) {
          directory.currentPage += 1;
          renderDirectory(directory);
          announce("Page " + directory.currentPage + ".", root);
        }
      });
    }

    directory.initialized = true;

    var errorTarget = getElement(root, "[data-college-load-error]");

    if (errorTarget) {
      errorTarget.hidden = true;
    }

    if (root.hasAttribute("data-college-json")) {
      try {
        var inlineData = JSON.parse(root.getAttribute("data-college-json"));
        loadData(directory, inlineData).catch(function () {});
      } catch (error) {
        directory.error = error;
        announce("The embedded college data is invalid.", root);
      }
    } else if (directory.config.dataUrl) {
      loadData(directory).catch(function () {});
    } else {
      var existingData = root.querySelectorAll("[data-college-record]");

      if (existingData.length) {
        var records = Array.from(existingData).map(function (element) {
          return {
            id: element.getAttribute("data-college-id") || "",
            name: element.getAttribute("data-college-name") ||
              element.textContent.trim(),
            state: element.getAttribute("data-college-state") || "",
            city: element.getAttribute("data-college-city") || "",
            type: element.getAttribute("data-college-type") || "",
            ownership: element.getAttribute("data-college-ownership") || "",
            courses: (element.getAttribute("data-college-courses") || "")
              .split(",")
              .map(function (course) { return course.trim(); })
              .filter(Boolean),
            website: element.getAttribute("data-college-website") || "",
            description: element.getAttribute("data-college-description") || ""
          };
        });

        loadData(directory, records).catch(function () {});
      } else {
        directory.allColleges = [];
        directory.filteredColleges = [];
        renderDirectory(directory);
      }
    }

    return directory;
  }

  function refresh() {
    if (state.destroyed) {
      return;
    }

    injectStyles();

    getElements(document, CONFIG.selectors.directory).forEach(function (root) {
      initializeDirectory(root);
    });
  }

  function findDirectory(rootOrElement) {
    if (!rootOrElement) {
      return null;
    }

    var root = rootOrElement.matches &&
      rootOrElement.matches(CONFIG.selectors.directory)
      ? rootOrElement
      : rootOrElement.closest
        ? rootOrElement.closest(CONFIG.selectors.directory)
        : null;

    return root ? state.directories.get(root) || null : null;
  }

  function setData(rootOrElement, payload) {
    var directory = findDirectory(rootOrElement);

    if (!directory) {
      throw new Error("No initialized college directory was found.");
    }

    return loadData(directory, payload);
  }

  function load(rootOrElement) {
    var directory = findDirectory(rootOrElement);

    if (!directory) {
      throw new Error("No initialized college directory was found.");
    }

    return loadData(directory);
  }

  function clearFilters(rootOrElement) {
    var directory = findDirectory(rootOrElement);

    if (!directory) {
      return false;
    }

    [
      CONFIG.selectors.search,
      CONFIG.selectors.state,
      CONFIG.selectors.course,
      CONFIG.selectors.type,
      CONFIG.selectors.ownership
    ].forEach(function (selector) {
      var control = getElement(directory.root, selector);

      if (control) {
        control.value = "";
      }
    });

    var sort = getElement(directory.root, CONFIG.selectors.sort);

    if (sort) {
      sort.value = "name-asc";
    }

    applyFilters(directory, true);
    return true;
  }

  function destroyDirectory(directory) {
    if (directory.searchTimer) {
      window.clearTimeout(directory.searchTimer);
    }

    if (directory.abortController) {
      directory.abortController.abort();
    }

    directory.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup even if one listener cannot be removed.
      }
    });

    directory.generatedCards.forEach(function (card) {
      if (card.parentNode) {
        card.remove();
      }
    });

    directory.listeners = [];
    directory.generatedCards = [];
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.directoryElements.forEach(function (root) {
      var directory = state.directories.get(root);

      if (directory) {
        destroyDirectory(directory);
      }
    });

    state.directoryElements.clear();

    if (state.styleElement && state.styleElement.parentNode) {
      state.styleElement.remove();
    }

    state.destroyed = true;
  }

  function initialize() {
    if (state.initialized || state.destroyed) {
      return;
    }

    state.initialized = true;
    refresh();

    if (CONFIG.observeDOM && typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                node.matches && node.matches(CONFIG.selectors.directory) ||
                node.querySelector && node.querySelector(CONFIG.selectors.directory)
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

  var publicAPI = {
    version: "1.0.0",
    refresh: refresh,
    load: load,
    setData: setData,
    clearFilters: clearFilters,
    announce: announce,
    getDirectory: findDirectory,
    destroy: destroy,
    configure: function (options) {
      if (!options || typeof options !== "object") {
        return false;
      }

      if (typeof options.dataUrl === "string") {
        CONFIG.dataUrl = options.dataUrl;
      }

      if (options.pageSize != null) {
        CONFIG.pageSize = parsePositiveInteger(
          options.pageSize,
          CONFIG.pageSize,
          CONFIG.maxPageSize
        );
      }

      if (options.observeDOM != null) {
        CONFIG.observeDOM = Boolean(options.observeDOM);
      }

      return true;
    }
  };

  window[GLOBAL_KEY] = publicAPI;
  window.MedOrbitsCollegeDirectory = publicAPI;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
