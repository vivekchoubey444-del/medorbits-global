
/**
 * MedOrbits -- College Directory
 * File: /assets/js/colleges.js
 * Version: 1.2.0
 *
 * Renders /assets/data/colleges.json into #college-results.
 * Supports URL filters: q, course, state, type.
 */
(function (window, document) {
  "use strict";

  var RESULTS_ID = "college-results";
  var DATA_URL = "/assets/data/colleges.json";
  var REQUEST_TIMEOUT_MS = 15000;

  var box = document.getElementById(RESULTS_ID);
  if (!box) return;

  var requestController = null;

  function createElement(tag, text, className) {
    var node = document.createElement(tag);

    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }

    if (className) {
      node.className = className;
    }

    return node;
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase();
  }

  function getObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  }

  function getArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getFilters() {
    var params = new URLSearchParams(window.location.search);

    return {
      q: normalize(params.get("q")),
      course: normalize(params.get("course")),
      state: normalize(params.get("state")),
      type: normalize(params.get("type"))
    };
  }

  function getCourseId(course) {
    if (!course) return "";

    // Accept an existing ID or a course slug.
    return course.indexOf("course-") === 0
      ? course
      : "course-" + course;
  }

  function getCollegeName(college) {
    return String(college.name || college.shortName || "Unnamed institution");
  }

  function getLocation(college) {
    var location = getObject(college.location);

    return {
      city: String(location.city || ""),
      state: String(location.state || "")
    };
  }

  function isActive(college) {
    var status = getObject(college.status);

    return status.active !== false;
  }

  function matchesSearch(college, query) {
    if (!query) return true;

    var location = getLocation(college);
    var searchText = [
      college.name,
      college.shortName,
      college.institutionType,
      location.city,
      location.state
    ].join(" ");

    return normalize(searchText).indexOf(query) !== -1;
  }

  function matchesCourse(college, course) {
    if (!course) return true;

    var courseId = getCourseId(course);
    var courseIds = getArray(college.courseIds);

    return courseIds.some(function (id) {
      return normalize(id) === courseId;
    });
  }

  function filterColleges(colleges, filters) {
    return colleges.filter(function (rawCollege) {
      var college = getObject(rawCollege);

      if (!isActive(college)) return false;
      if (!matchesSearch(college, filters.q)) return false;

      var location = getLocation(college);

      if (
        filters.state &&
        normalize(location.state) !== filters.state
      ) {
        return false;
      }

      if (
        filters.type &&
        normalize(college.institutionType) !== filters.type
      ) {
        return false;
      }

      if (!matchesCourse(college, filters.course)) {
        return false;
      }

      return true;
    });
  }

  function createOfficialWebsite(college) {
    var contact = getObject(college.contact);
    var website = String(contact.officialWebsite || "").trim();

    if (!website) return null;

    try {
      var url = new URL(website, window.location.origin);

      // Only link to HTTPS websites.
      if (url.protocol !== "https:") return null;

      var link = createElement(
        "a",
        "Official website ↗",
        "card-link"
      );

      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.referrerPolicy = "no-referrer";

      return link;
    } catch (error) {
      return null;
    }
  }

  function createCollegeCard(rawCollege) {
    var college = getObject(rawCollege);
    var location = getLocation(college);

    var card = createElement("article", null, "card");
    var body = createElement("div", null, "card-body");

    var type = String(college.institutionType || "Institution");
    body.appendChild(createElement("span", type, "tag"));

    body.appendChild(
      createElement("h3", getCollegeName(college))
    );

    var locationParts = [
      college.shortName,
      location.city,
      location.state
    ].filter(function (part) {
      return Boolean(String(part || "").trim());
    });

    if (locationParts.length) {
      body.appendChild(
        createElement("p", locationParts.join(" · "))
      );
    }

    var websiteLink = createOfficialWebsite(college);

    if (websiteLink) {
      body.appendChild(websiteLink);
    }

    body.appendChild(
      createElement(
        "p",
        "Listing information may be incomplete or unverified. " +
          "Confirm recognition, fees, eligibility and admissions " +
          "directly with the institution and relevant authorities.",
        "search-note"
      )
    );

    card.appendChild(body);

    return card;
  }

  function renderLoading() {
    box.setAttribute("aria-live", "polite");
    box.setAttribute("aria-busy", "true");
    box.textContent = "Loading colleges…";
  }

  function renderError() {
    box.textContent = "";

    var message = createElement(
      "p",
      "Colleges could not be loaded. Please try again.",
      "search-note"
    );

    message.setAttribute("role", "alert");
    box.appendChild(message);

    var retry = createElement("button", "Try again", "button");
    retry.type = "button";

    retry.addEventListener("click", loadColleges);

    box.appendChild(retry);
    box.setAttribute("aria-busy", "false");
  }

  function renderColleges(colleges) {
    box.textContent = "";

    var heading = createElement(
      "h3",
      colleges.length +
        (colleges.length === 1
          ? " college found"
          : " colleges found")
    );

    box.appendChild(heading);

    if (!colleges.length) {
      box.appendChild(
        createElement(
          "p",
          "No colleges match your search. Try fewer filters.",
          "search-note"
        )
      );

      box.setAttribute("aria-busy", "false");
      return;
    }

    var grid = createElement("div", null, "cards");

    colleges.forEach(function (college) {
      grid.appendChild(createCollegeCard(college));
    });

    box.appendChild(grid);
    box.setAttribute("aria-busy", "false");
  }

  function loadColleges() {
    if (requestController) {
      requestController.abort();
    }

    renderLoading();

    var controller =
      typeof window.AbortController === "function"
        ? new window.AbortController()
        : null;

    requestController = controller;

    var timeoutId = null;

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    var options = {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-cache",
      credentials: "same-origin"
    };

    if (controller) {
      options.signal = controller.signal;
    }

    fetch(DATA_URL, options)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("College data request failed.");
        }

        return response.json();
      })
      .then(function (json) {
        if (!json || !Array.isArray(json.colleges)) {
          throw new Error("Invalid college data format.");
        }

        var filters = getFilters();
        var colleges = filterColleges(json.colleges, filters);

        renderColleges(colleges);

        try {
          document.dispatchEvent(
            new CustomEvent("medorbits:colleges-loaded", {
              detail: {
                count: colleges.length,
                filters: filters
              }
            })
          );
        } catch (error) {
          // Rendering should not depend on custom-event support.
        }
      })
      .catch(function (error) {
        if (error && error.name === "AbortError") {
          // A superseded request should not overwrite newer results.
          if (requestController !== controller) return;
        }

        renderError();

        try {
          document.dispatchEvent(
            new CustomEvent("medorbits:colleges-error", {
              detail: {
                message: "College listings could not be loaded."
              }
            })
          );
        } catch (eventError) {
          // Ignore event-dispatch failures.
        }
      })
      .then(function () {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        if (requestController === controller) {
          requestController = null;
        }
      });
  }

  window.MedOrbitsColleges = {
    load: loadColleges
  };

  loadColleges();
})(window, document);
