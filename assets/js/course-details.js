
/**
 * MedOrbits -- Course Details
 * File: /assets/js/course-details.js
 * Reads /assets/data/courses.json and renders a course selected by ?slug=.
 */
(function (window, document) {
  "use strict";

  var detail = document.getElementById("courseDetail");
  var related = document.getElementById("relatedCourses");

  if (!detail) return;

  var DATA_URL = "/assets/data/courses.json";
  var COURSE_LIST_URL = "/education/courses.html";
  var DETAILS_URL = "/education/course-details.html";
  var MAX_RELATED = 4;

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

  function normalizeLabel(value) {
    if (value === undefined || value === null || value === "") {
      return "Not specified";
    }

    return String(value)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSlug() {
    try {
      return new URLSearchParams(window.location.search).get("slug") || "";
    } catch (error) {
      return "";
    }
  }

  function getCourses(json) {
    var source;

    if (Array.isArray(json)) {
      source = json;
    } else if (json && Array.isArray(json.courses)) {
      source = json.courses;
    } else {
      source = [];
    }

    return source.filter(function (course) {
      return course &&
        typeof course === "object" &&
        course.active !== false;
    });
  }

  function findCourse(courses, slug) {
    if (!slug) return null;

    for (var i = 0; i < courses.length; i += 1) {
      if (
        String(courses[i].slug || "") === slug ||
        String(courses[i].id || "") === slug
      ) {
        return courses[i];
      }
    }

    return null;
  }

  function addDetailRow(list, name, value) {
    var item = createElement("li");
    var strong = createElement("strong", name + ": ");
    var text = document.createTextNode(String(value));

    item.appendChild(strong);
    item.appendChild(text);
    list.appendChild(item);
  }

  function getExamNames(course) {
    if (!Array.isArray(course.examIds) || course.examIds.length === 0) {
      return "Not specified";
    }

    return course.examIds.map(function (exam) {
      return normalizeLabel(
        String(exam || "").replace(/^exam-/i, "")
      ).toUpperCase();
    }).filter(Boolean).join(", ") || "Not specified";
  }

  function getDuration(course) {
    var duration = course.durationYears;

    if (
      duration !== undefined &&
      duration !== null &&
      duration !== "" &&
      isFinite(Number(duration)) &&
      Number(duration) > 0
    ) {
      return String(duration) + (Number(duration) === 1 ? " year" : " years");
    }

    if (course.duration) {
      return String(course.duration);
    }

    return "Verify with the official regulator";
  }

  function addVerificationNotice(course) {
    if (course.verificationStatus === "verified") return;

    detail.appendChild(
      createElement(
        "p",
        "This information has not been confirmed as verified. Check current course details, eligibility, duration and admission requirements with the relevant official authority.",
        "search-note"
      )
    );
  }

  function renderNotFound() {
    detail.textContent = "";

    detail.appendChild(createElement("h1", "Course not found"));
    detail.appendChild(
      createElement(
        "p",
        "The requested course could not be found or is unavailable."
      )
    );

    var link = createElement("a", "Browse all courses");
    link.href = COURSE_LIST_URL;
    detail.appendChild(link);

    if (related) {
      related.textContent = "";
      related.hidden = true;
    }

    document.title = "Course Not Found | MedOrbits";
  }

  function renderRelatedCourses(courses, currentCourse) {
    if (!related) return;

    related.textContent = "";
    related.hidden = false;

    var matches = courses.filter(function (course) {
      return course.id !== currentCourse.id &&
        (course.slug || "") !== (currentCourse.slug || "") &&
        currentCourse.discipline &&
        course.discipline === currentCourse.discipline;
    }).slice(0, MAX_RELATED);

    if (!matches.length) {
      related.hidden = true;
      return;
    }

    matches.forEach(function (course) {
      var identifier = course.slug || course.id;

      if (!identifier) return;

      var link = createElement("a", null, "card");
      link.href = DETAILS_URL + "?slug=" +
        encodeURIComponent(String(identifier));

      var body = createElement("div", null, "card-body");

      body.appendChild(
        createElement("h3", course.shortName || course.name || "Course")
      );

      if (course.shortName && course.name) {
        body.appendChild(createElement("p", course.name));
      }

      link.appendChild(body);
      related.appendChild(link);
    });

    if (!related.children.length) {
      related.hidden = true;
    }
  }

  function renderCourse(courses, course) {
    detail.textContent = "";

    if (!course) {
      renderNotFound();
      return;
    }

    var name = course.name || course.shortName || "Course details";
    document.title = name + " | MedOrbits";

    detail.appendChild(
      createElement("span", course.shortName || "Course", "kicker")
    );

    detail.appendChild(createElement("h1", name));

    detail.appendChild(
      createElement(
        "p",
        course.description ||
          "Check the relevant official authority for current course details."
      )
    );

    var list = createElement("ul", null, "course-detail-list");

    addDetailRow(list, "Level", normalizeLabel(course.level));
    addDetailRow(list, "Discipline", normalizeLabel(course.discipline));
    addDetailRow(list, "Duration", getDuration(course));
    addDetailRow(list, "Entrance exams", getExamNames(course));

    if (course.eligibility) {
      addDetailRow(list, "Eligibility", course.eligibility);
    }

    if (course.studyMode) {
      addDetailRow(list, "Study mode", normalizeLabel(course.studyMode));
    }

    detail.appendChild(list);
    addVerificationNotice(course);
    renderRelatedCourses(courses, course);
  }

  function renderError() {
    detail.textContent = "";

    detail.appendChild(
      createElement(
        "h1",
        "Unable to load course details"
      )
    );

    detail.appendChild(
      createElement(
        "p",
        "Course information could not be loaded. Please check your connection and try again."
      )
    );

    var retry = createElement("button", "Try again");
    retry.type = "button";

    retry.addEventListener("click", loadCourse);

    detail.appendChild(retry);

    if (related) {
      related.textContent = "";
      related.hidden = true;
    }
  }

  function loadCourse() {
    detail.setAttribute("aria-busy", "true");

    if (related) {
      related.textContent = "";
      related.hidden = true;
    }

    fetch(DATA_URL, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin"
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Course data request failed.");
        }

        return response.json();
      })
      .then(function (json) {
        var courses = getCourses(json);
        var course = findCourse(courses, getSlug());

        renderCourse(courses, course);
      })
      .catch(function () {
        renderError();
      })
      .then(function () {
        detail.removeAttribute("aria-busy");
      });
  }

  loadCourse();

  window.MedOrbitsCourseDetails = Object.freeze({
    reload: loadCourse
  });
})(window, document);
