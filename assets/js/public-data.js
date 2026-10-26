
/**
 * MedOrbits -- Public Data Loader
 * File: /assets/js/public-data.js
 * Version: 1.2.0
 *
 * Loads public datasets from the API with static JSON fallback.
 * Renders catalogue cards and searchable institution directories.
 *
 * Backend authorization and publication filtering remain mandatory.
 */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsPublicData) return;

  const API_BASE = "/api/v1/public-data/";
  const STATIC_BASE = "/assets/data/";
  const PAGE_SIZE = 50;

  const APPROVED_VERIFICATION = new Set([
    "verified",
    "content_reviewed"
  ]);

  const BLOCKED_STATUSES = new Set([
    "draft",
    "planned",
    "inactive",
    "archived"
  ]);

  const datasetsByPage = {
    "/education/index.html": [
      {
        file: "categories.json",
        collection: "categories",
        title: "Education categories"
      }
    ],
    "/education/courses.html": [
      {
        file: "courses.json",
        collection: "courses",
        title: "Course catalogue records"
      }
    ],
    "/education/colleges.html": [
      {
        file: "colleges.json",
        collection: "colleges",
        title: "College directory",
        directory: true,
        directoryKind: "college",
        showTypeFilter: true,
        mountSelector: "#college-results"
      }
    ],
    "/education/government-colleges.html": [
      {
        file: "colleges.json",
        collection: "colleges",
        title: "Government colleges",
        directory: true,
        directoryKind: "college",
        institutionTypes: [
          "government",
          "public",
          "government-aided"
        ],
        mountSelector: "#college-results"
      }
    ],
    "/education/private-colleges.html": [
      {
        file: "colleges.json",
        collection: "colleges",
        title: "Private colleges",
        directory: true,
        directoryKind: "college",
        institutionTypes: ["private"],
        mountSelector: "#college-results"
      }
    ],
    "/education/universities.html": [
      {
        file: "universities.json",
        collection: "universities",
        title: "Indian university directory",
        directory: true,
        showTypeFilter: true,
        allowUgcPending: true,
        mountSelector: "#university-results"
      }
    ],
    "/education/government-universities.html": [
      {
        file: "universities.json",
        collection: "universities",
        title: "Central and state universities",
        directory: true,
        institutionTypes: [
          "central-university",
          "state-university"
        ],
        allowUgcPending: true,
        mountSelector: "#university-results"
      }
    ],
    "/education/private-universities.html": [
      {
        file: "universities.json",
        collection: "universities",
        title: "Private universities",
        directory: true,
        institutionTypes: ["private-university"],
        allowUgcPending: true,
        mountSelector: "#university-results"
      }
    ],
    "/education/deemed-universities.html": [
      {
        file: "universities.json",
        collection: "universities",
        title: "Deemed universities",
        directory: true,
        institutionTypes: ["deemed-university"],
        allowUgcPending: true,
        mountSelector: "#university-results"
      }
    ],
    "/education/study-abroad/index.html": [
      {
        file: "countries.json",
        collection: "countries",
        title: "Study destination records"
      }
    ],
    "/education/admissions/index.html": [
      {
        file: "admissions.json",
        collection: "admissions",
        title: "Admission records"
      }
    ],
    "/education/admissions/process.html": [
      {
        file: "admission-process.json",
        collection: "processes",
        title: "Admission planning workflows"
      }
    ],
    "/education/admissions/documents.html": [
      {
        file: "documents.json",
        collection: "documents",
        title: "Admission document records"
      }
    ],
    "/education/admissions/exams.html": [
      {
        file: "entrance-exams.json",
        collection: "exams",
        title: "Entrance examination records"
      }
    ],
    "/education/resources/faqs.html": [
      {
        file: "faqs.json",
        collection: "faqs",
        title: "Frequently asked questions"
      }
    ],
    "/education/resources/guides.html": [
      {
        file: "fee-guides.json",
        collection: "documents",
        title: "Fee guide documents"
      }
    ],
    "/education/resources/fees.html": [
      {
        file: "fees.json",
        collection: "fees",
        title: "Fee records"
      }
    ],
    "/education/resources/hostels.html": [
      {
        file: "hostels.json",
        collection: "hostels",
        title: "Hostel records"
      }
    ],
    "/career/index.html": [
      {
        file: "sectors.json",
        collection: "sectors",
        title: "Career sectors"
      },
      {
        file: "locations.json",
        collection: ["countries", "states", "cities"],
        title: "Location records"
      }
    ],
    "/career/jobs.html": [
      {
        file: "jobs.json",
        collection: "jobs",
        title: "Job listings"
      }
    ],
    "/career/internships.html": [
      {
        file: "internships.json",
        collection: "internships",
        title: "Internship listings"
      }
    ],
    "/career/guidance.html": [
      {
        file: "career-options.json",
        collection: "careerOptions",
        title: "Career pathways"
      }
    ],
    "/career/recruitment.html": [
      {
        file: "recruitment.json",
        collection: "recruitments",
        title: "Recruitment drives"
      }
    ],
    "/pages/careers.html": [
      {
        file: "career-options.json",
        collection: "careerOptions",
        title: "Career pathways"
      }
    ],
    "/pages/services.html": [
      {
        file: "services.json",
        collection: "services",
        title: "Service catalogue"
      }
    ],
    "/pages/notifications.html": [
      {
        file: "news.json",
        collection: "news",
        title: "News"
      },
      {
        file: "notifications.json",
        collection: "notifications",
        title: "Notifications"
      }
    ],
    "/pages/testimonials.html": [
      {
        file: "testimonials.json",
        collection: "testimonials",
        title: "Testimonials"
      }
    ]
  };

  const state = {
    initialized: false,
    activeRequests: new Set()
  };

  function currentPath() {
    const path = window.location.pathname;
    return path.endsWith("/") ? path + "index.html" : path;
  }

  function textValue(record, keys) {
    if (!record || typeof record !== "object") return "";

    for (const key of keys) {
      if (
        typeof record[key] === "string" &&
        record[key].trim()
      ) {
        return record[key].trim();
      }
    }

    return "";
  }

  function normalizeStatus(record) {
    if (!record || typeof record !== "object") return {};

    return record.status && typeof record.status === "object"
      ? record.status
      : {};
  }

  function verificationStatus(record) {
    const status = normalizeStatus(record);

    return String(
      record.verificationStatus ||
      status.verificationStatus ||
      ""
    ).trim().toLowerCase();
  }

  function isPublicRecord(record, config) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      return false;
    }

    const statusObject = normalizeStatus(record);

    if (
      record.active === false ||
      statusObject.active === false
    ) {
      return false;
    }

    const publicationStatus = String(
      record.publicationStatus || ""
    ).trim().toLowerCase();

    if (
      publicationStatus &&
      publicationStatus !== "published"
    ) {
      return false;
    }

    if (
      typeof record.status === "string" &&
      BLOCKED_STATUSES.has(record.status.trim().toLowerCase())
    ) {
      return false;
    }

    const verification = verificationStatus(record);

    if (APPROVED_VERIFICATION.has(verification)) {
      return true;
    }

    if (config.directoryKind === "college") {
      return false;
    }

    if (!verification) {
      return true;
    }

    if (
      config.allowUgcPending !== true ||
      verification !== "pending-review" ||
      !Array.isArray(record.sourceUrls)
    ) {
      return false;
    }

    return record.sourceUrls.some(function (source) {
      return source &&
        source.sourceType === "government-directory" &&
        Boolean(safeHttpUrl(source.url));
    });
  }

  function safeHttpUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
      return null;
    }

    try {
      const url = new URL(value, window.location.origin);

      if (!["http:", "https:"].includes(url.protocol)) {
        return null;
      }

      return url.href;
    } catch (_) {
      return null;
    }
  }

  function createExternalLink(url, label) {
    const safeUrl = safeHttpUrl(url);
    if (!safeUrl) return null;

    const link = document.createElement("a");
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;

    return link;
  }

  function appendTextElement(parent, tag, className, text) {
    if (!text) return null;

    const element = document.createElement(tag);

    if (className) element.className = className;

    element.textContent = text;
    parent.appendChild(element);

    return element;
  }

  function createCard(record, config) {
    config = config || {};

    const card = document.createElement("article");
    card.className = "card";

    const body = document.createElement("div");
    body.className = "card-body";

    appendTextElement(
      body,
      "h3",
      "",
      textValue(record, [
        "title",
        "name",
        "question",
        "shortName",
        "label"
      ]) || "Information"
    );

    if (config.directory) {
      const verification = verificationStatus(record);

      appendTextElement(
        body,
        "p",
        "university-status",
        config.directoryKind === "college"
          ? "College record · " +
            (verification || "verification status unavailable")
          : "Directory listing · independent review pending"
      );

      const location = config.directoryKind === "college"
        ? textValue(record.location || {}, [
            "city",
            "district",
            "state"
          ])
        : textValue(record, ["stateName"]);

      const type = textValue(record, ["institutionType"]);

      const metadata = [
        location,
        type,
        config.directoryKind !== "college" &&
        record.ugcStatus
          ? "UGC status: " + String(record.ugcStatus)
          : ""
      ].filter(Boolean);

      if (metadata.length) {
        appendTextElement(
          body,
          "p",
          "university-meta",
          metadata.join(" · ")
        );
      }
    }

    const description = textValue(record, [
      "shortDescription",
      "summary",
      "description",
      "answer"
    ]);

    appendTextElement(body, "p", "", description);

    if (config.directory) {
      const links = document.createElement("div");
      links.className = "university-record-links";

      const website = config.directoryKind === "college"
        ? record.contact && record.contact.officialWebsite
        : record.website;

      const websiteLink = createExternalLink(
        website,
        config.directoryKind === "college"
          ? "Official college website"
          : "Institution website"
      );

      if (websiteLink) links.appendChild(websiteLink);

      const sources = config.directoryKind === "college"
        ? record.officialSources
        : record.sourceUrls;

      const source = Array.isArray(sources)
        ? sources.find(function (item) {
            if (!item || !safeHttpUrl(item.url)) return false;

            return config.directoryKind === "college" ||
              item.sourceType === "government-directory";
          })
        : null;

      if (source) {
        const sourceLink = createExternalLink(
          source.url,
          config.directoryKind === "college"
            ? "Source"
            : "Government directory source"
        );

        if (sourceLink) links.appendChild(sourceLink);
      }

      if (links.childElementCount) {
        body.appendChild(links);
      }
    }

    if (Array.isArray(record.steps) && record.steps.length) {
      const list = document.createElement("ol");

      record.steps.forEach(function (step) {
        if (!step || typeof step.title !== "string") return;

        const title = step.title.trim();
        if (!title) return;

        const item = document.createElement("li");
        item.textContent = title;
        list.appendChild(item);
      });

      if (list.childElementCount) body.appendChild(list);
    }

    if (
      Array.isArray(record.careerPaths) &&
      record.careerPaths.length
    ) {
      const list = document.createElement("ul");

      record.careerPaths.forEach(function (careerPath) {
        if (
          !careerPath ||
          typeof careerPath.title !== "string" ||
          !careerPath.title.trim()
        ) {
          return;
        }

        const item = document.createElement("li");
        item.textContent = careerPath.title.trim();
        list.appendChild(item);
      });

      if (list.childElementCount) body.appendChild(list);
    }

    card.appendChild(body);

    return card;
  }

  function stateName(record, config) {
    return config.directoryKind === "college"
      ? textValue(record.location || {}, ["state"])
      : textValue(record, ["stateName"]);
  }

  function recordType(record) {
    return textValue(record, ["institutionType"]);
  }

  function recordSearchText(record, config) {
    const location = record.location || {};

    return [
      textValue(record, ["name", "shortName", "title"]),
      textValue(record, ["summary", "shortDescription"]),
      stateName(record, config),
      textValue(record, ["ugcStatus", "institutionType"]),
      textValue(location, ["city", "district", "state"])
    ].filter(Boolean).join(" ").toLocaleLowerCase();
  }

  function createDirectoryContent(config, records, container) {
    const tools = document.createElement("div");
    tools.className = "university-directory-tools";
    tools.setAttribute("role", "search");

    const search = document.createElement("input");
    search.type = "search";
    search.className = "field";
    search.placeholder = "Search by institution, location, or status";
    search.setAttribute("aria-label", "Search directory");
    search.value = new URLSearchParams(
      window.location.search
    ).get("q") || "";

    tools.appendChild(search);

    let typeSelect = null;

    if (config.showTypeFilter) {
      typeSelect = document.createElement("select");
      typeSelect.className = "field";
      typeSelect.setAttribute(
        "aria-label",
        "Filter by institution type"
      );

      const typeOptions = config.directoryKind === "college"
        ? [
            ["", "All institution types"],
            ["government", "Government"],
            ["public", "Public"],
            ["government-aided", "Government-aided"],
            ["private", "Private"]
          ]
        : [
            ["", "All institution types"],
            ["central-university", "Central government"],
            ["state-university", "State government"],
            ["private-university", "Private"],
            ["deemed-university", "Deemed"]
          ];

      typeOptions.forEach(function (entry) {
        const option = document.createElement("option");
        option.value = entry[0];
        option.textContent = entry[1];
        typeSelect.appendChild(option);
      });

      tools.appendChild(typeSelect);
    }

    const stateSelect = document.createElement("select");
    stateSelect.className = "field";
    stateSelect.setAttribute(
      "aria-label",
      "Filter by state or union territory"
    );

    const allStates = document.createElement("option");
    allStates.value = "";
    allStates.textContent = "All states and union territories";
    stateSelect.appendChild(allStates);

    const states = Array.from(new Set(
      records.map(function (record) {
        return stateName(record, config);
      }).filter(Boolean)
    )).sort(function (a, b) {
      return a.localeCompare(b);
    });

    states.forEach(function (name) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      stateSelect.appendChild(option);
    });

    stateSelect.value = new URLSearchParams(
      window.location.search
    ).get("state") || "";

    tools.appendChild(stateSelect);
    container.appendChild(tools);

    const count = document.createElement("p");
    count.className = "university-result-count";
    count.setAttribute("aria-live", "polite");
    container.appendChild(count);

    const grid = document.createElement("div");
    grid.className = "cards university-cards";
    container.appendChild(grid);

    const empty = document.createElement("p");
    empty.className = "university-empty-state";
    empty.hidden = true;
    empty.textContent = "No records match these filters.";
    container.appendChild(empty);

    const pagination = document.createElement("nav");
    pagination.className = "university-pagination";
    pagination.setAttribute("aria-label", "Directory result pages");

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn btn-outline";
    previous.textContent = "Previous";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn";
    next.textContent = "Next";

    pagination.append(previous, next);
    container.appendChild(pagination);

    let page = 1;

    function update() {
      const query = search.value.trim().toLocaleLowerCase();
      const selectedState = stateSelect.value;
      const selectedType = typeSelect ? typeSelect.value : "";

      const filtered = records.filter(function (record) {
        if (
          selectedState &&
          stateName(record, config) !== selectedState
        ) {
          return false;
        }

        if (
          selectedType &&
          recordType(record) !== selectedType
        ) {
          return false;
        }

        return !query ||
          recordSearchText(record, config).includes(query);
      });

      const pageCount = Math.max(
        1,
        Math.ceil(filtered.length / PAGE_SIZE)
      );

      page = Math.max(1, Math.min(page, pageCount));

      const start = (page - 1) * PAGE_SIZE;
      const visible = filtered.slice(start, start + PAGE_SIZE);

      grid.replaceChildren(
        ...visible.map(function (record) {
          return createCard(record, config);
        })
      );

      empty.hidden = filtered.length > 0;

      count.textContent = filtered.length
        ? "Showing " + (start + 1) + "–" +
          Math.min(start + PAGE_SIZE, filtered.length) +
          " of " + filtered.length.toLocaleString("en-IN") +
          " records · Page " + page + " of " + pageCount
        : "0 records found";

      previous.disabled = page <= 1;
      next.disabled = page >= pageCount;
      pagination.hidden = filtered.length <= PAGE_SIZE;
    }

    search.addEventListener("input", function () {
      page = 1;
      update();
    });

    stateSelect.addEventListener("change", function () {
      page = 1;
      update();
    });

    if (typeSelect) {
      typeSelect.addEventListener("change", function () {
        page = 1;
        update();
      });
    }

    previous.addEventListener("click", function () {
      if (page > 1) {
        page -= 1;
        update();
      }
    });

    next.addEventListener("click", function () {
      page += 1;
      update();
    });

    update();
  }

  function createSection(config, records, withheldCount) {
    const section = document.createElement("section");
    section.className = "section public-json-data";

    const container = document.createElement("div");
    container.className = "container";

    appendTextElement(container, "h2", "", config.title);

    if (config.directory) {
      createDirectoryContent(config, records, container);
    } else if (records.length) {
      const grid = document.createElement("div");
      grid.className = "cards";

      records.forEach(function (record) {
        grid.appendChild(createCard(record, config));
      });

      container.appendChild(grid);
    } else {
      appendTextElement(
        container,
        "p",
        "public-data-empty",
        "No published records are currently available."
      );
    }

    if (withheldCount > 0) {
      appendTextElement(
        container,
        "p",
        "disclaimer",
        withheldCount + " record" +
          (withheldCount === 1 ? " is" : "s are") +
          " withheld because publication or verification requirements were not met."
      );
    }

    if (config.directory) {
      appendTextElement(
        container,
        "p",
        "disclaimer university-data-disclaimer",
        "Directory records may require independent verification. A directory listing alone does not confirm current recognition, programme availability, admissions, or fees. Verify details with the institution and relevant authorities."
      );
    }

    section.appendChild(container);

    return section;
  }

  async function fetchJSON(url, signal) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin",
      cache: "no-cache",
      signal: signal
    });

    if (!response.ok) {
      throw new Error("Request failed with HTTP " + response.status);
    }

    return response.json();
  }

  async function loadRawDataset(config, signal) {
    const datasetName = config.file.replace(/\.json$/i, "");

    try {
      const payload = await fetchJSON(
        API_BASE + encodeURIComponent(datasetName),
        signal
      );

      if (
        !payload ||
        payload.success !== true ||
        !payload.data ||
        typeof payload.data !== "object" ||
        Array.isArray(payload.data)
      ) {
        throw new Error("Invalid public-data API response.");
      }

      return payload.data;
    } catch (apiError) {
      if (signal && signal.aborted) {
        throw apiError;
      }

      console.warn(
        "[MedOrbits data] API unavailable for " +
          config.file + "; trying static JSON.",
        apiError
      );

      return fetchJSON(
        STATIC_BASE + encodeURIComponent(config.file),
        signal
      );
    }
  }

  async function loadDataset(config, signal) {
    const data = await loadRawDataset(config, signal);

    const collections = Array.isArray(config.collection)
      ? config.collection
      : [config.collection];

    const records = [];

    collections.forEach(function (collection) {
      if (!Array.isArray(data[collection])) {
        throw new Error(
          config.file + " must contain an array named " +
          collection + "."
        );
      }

      records.push(...data[collection]);
    });

    const scopedRecords = config.institutionTypes
      ? records.filter(function (record) {
          return config.institutionTypes.includes(
            record.institutionType
          );
        })
      : records;

    const publishedRecords = scopedRecords.filter(function (record) {
      return isPublicRecord(record, config);
    });

    return createSection(
      config,
      publishedRecords,
      scopedRecords.length - publishedRecords.length
    );
  }

  function showLoadError(config, error) {
    const section = document.createElement("section");
    section.className = "section public-json-data";

    const container = document.createElement("div");
    container.className = "container";

    appendTextElement(container, "h2", "", config.title);

    appendTextElement(
      container,
      "p",
      "disclaimer",
      config.title +
        " could not be loaded. Please try again later."
    );

    section.appendChild(container);

    console.error(
      "[MedOrbits data] Failed to load " + config.file + ".",
      error
    );

    return section;
  }

  async function renderPage() {
    const path = currentPath();
    const configs = datasetsByPage[path];
    const main = document.querySelector("main");

    if (!configs || !main) {
      return {
        loaded: false,
        reason: "No configured datasets or main element."
      };
    }

    const controller = new AbortController();
    state.activeRequests.add(controller);

    try {
      const results = await Promise.all(
        configs.map(async function (config) {
          try {
            return {
              config: config,
              section: await loadDataset(
                config,
                controller.signal
              )
            };
          } catch (error) {
            return {
              config: config,
              section: showLoadError(config, error)
            };
          }
        })
      );

      results.forEach(function (result) {
        const target = result.config.mountSelector
          ? document.querySelector(result.config.mountSelector)
          : null;

        (target || main).appendChild(result.section);
      });

      document.dispatchEvent(new CustomEvent(
        "medorbits:public-data:loaded",
        {
          detail: {
            path: path,
            datasets: configs.map(function (config) {
              return config.file;
            })
          }
        }
      ));

      return {
        loaded: true,
        path: path,
        datasets: configs.map(function (config) {
          return config.file;
        })
      };
    } finally {
      state.activeRequests.delete(controller);
    }
  }

  function init() {
    if (state.initialized) return;

    state.initialized = true;
    renderPage().catch(function (error) {
      console.error("[MedOrbits data] Initialization failed.", error);
    });
  }

  function destroy() {
    state.activeRequests.forEach(function (controller) {
      controller.abort();
    });

    state.activeRequests.clear();
    state.initialized = false;
  }

  const api = Object.freeze({
    init: init,
    destroy: destroy,
    renderPage: renderPage,
    isPublicRecord: isPublicRecord,
    safeHttpUrl: safeHttpUrl,
    datasetsByPage: datasetsByPage
  });

  Object.defineProperty(window, "MedOrbitsPublicData", {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true
  });

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.PublicData = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})(window, document);
