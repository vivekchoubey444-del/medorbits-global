
/* =========================================================
   MedOrbits -- assets/js/dashboard.js
   User dashboard, statistics, recent activity, and widgets
   Version: 1.1.0
   ========================================================= */

(function (window, document) {
  "use strict";

  const CONFIG = window.MedOrbitsConfig || {};
  const CONSTANTS = window.MedOrbitsConstants || {};

  const API_BASE = String(
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    CONFIG.apiBaseURL ||
    "/api"
  ).replace(/\/+$/, "");

  const API = CONSTANTS.API || {};

  const ENDPOINTS = Object.freeze({
    dashboard: API.DASHBOARD || API_BASE + "/dashboard",
    applications: API.APPLICATIONS || API_BASE + "/applications",
    notifications: API.NOTIFICATIONS || API_BASE + "/notifications",
    profile: API.PROFILE || API_BASE + "/users/profile",
    activity: API.USER_ACTIVITY || API_BASE + "/users/activity"
  });

  const state = {
    data: null,
    applications: [],
    notifications: [],
    activity: [],
    profile: null,
    loading: false,
    error: null,
    lastUpdated: null
  };

  const listeners = new Set();

  let loadSequence = 0;
  let activeController = null;

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function resolveElement(element, root) {
    if (!element) return null;

    if (
      typeof window.Element === "function" &&
      element instanceof window.Element
    ) {
      return element;
    }

    if (typeof element !== "string") return null;

    try {
      return (root || document).querySelector(element);
    } catch (error) {
      return null;
    }
  }

  function cleanText(value, maxLength) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "object"
    ) {
      return "";
    }

    return String(value).trim().slice(0, maxLength || 2000);
  }

  function escapeHTML(value) {
    return cleanText(value, 10000).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function normalize(value) {
    return cleanText(value, 100).toLowerCase();
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (error) {
      // Custom events are optional.
    }
  }

  function getErrorMessage(result, fallback) {
    if (isObject(result)) {
      if (typeof result.message === "string" && result.message.trim()) {
        return result.message.trim();
      }

      if (typeof result.error === "string" && result.error.trim()) {
        return result.error.trim();
      }
    }

    return fallback || "The request could not be completed.";
  }

  async function requestJSON(url, options) {
    options = options || {};

    const requestOptions = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined && options.body !== null
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      },
      signal: options.signal
    };

    if (options.body !== undefined && options.body !== null) {
      requestOptions.body = typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
    }

    const response = await window.fetch(url, requestOptions);

    if (response.status === 204) {
      if (!response.ok) {
        throw new Error("Request failed (" + response.status + ").");
      }

      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    let result;

    if (contentType.toLowerCase().includes("json")) {
      try {
        result = await response.json();
      } catch (error) {
        throw new Error("The server returned an invalid JSON response.");
      }
    } else {
      result = await response.text();
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          result,
          "Request failed (" + response.status + ")."
        )
      );
    }

    return result;
  }

  function extractObject(result, keys) {
    if (!result || typeof result !== "object") return {};

    if (Array.isArray(result)) return {};

    if (isObject(result.data)) {
      if (keys) {
        for (const key of keys) {
          if (isObject(result.data[key])) return result.data[key];
        }
      }

      return result.data;
    }

    if (keys) {
      for (const key of keys) {
        if (isObject(result[key])) return result[key];
      }
    }

    return result;
  }

  function extractList(result, keys) {
    if (Array.isArray(result)) return result;
    if (!result || typeof result !== "object") return [];

    for (const key of keys || []) {
      if (Array.isArray(result[key])) return result[key];

      if (
        isObject(result.data) &&
        Array.isArray(result.data[key])
      ) {
        return result.data[key];
      }
    }

    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.results)) return result.results;

    return [];
  }

  function formatDate(value, options) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "--";

    const settings = {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...(options || {})
    };

    const locale = settings.locale || "en-IN";
    delete settings.locale;

    try {
      return new Intl.DateTimeFormat(locale, settings).format(date);
    } catch (error) {
      return date.toLocaleDateString("en-IN");
    }
  }

  function formatRelativeDate(value) {
    if (!value) return "Recently";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Recently";

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);

    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60]
    ];

    for (const entry of units) {
      const unit = entry[0];
      const amount = entry[1];
      const interval = Math.round(seconds / amount);

      if (Math.abs(interval) >= 1) {
        return new Intl.RelativeTimeFormat("en", {
          numeric: "auto"
        }).format(interval, unit);
      }
    }

    return "Just now";
  }

  function formatCurrency(amount, currency) {
    const value = Number(amount);
    const currencyCode = currency || "INR";

    if (!Number.isFinite(value)) return "--";

    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 0
      }).format(value);
    } catch (error) {
      return "₹" + value.toLocaleString("en-IN");
    }
  }

  function getApplicationStatus(application) {
    if (!isObject(application)) return "Pending";

    return cleanText(
      application.status ||
      application.applicationStatus ||
      "Pending",
      100
    );
  }

  function getStatusClass(status) {
    const value = normalize(status).replace(/[^a-z0-9]+/g, "-");

    const allowed = [
      "pending",
      "approved",
      "rejected",
      "submitted",
      "under-review",
      "in-review",
      "in-progress",
      "completed",
      "cancelled",
      "canceled",
      "draft",
      "accepted",
      "waitlisted"
    ];

    return allowed.includes(value) ? value : "default";
  }

  function getApplicationTitle(application) {
    if (!isObject(application)) return "Application";

    return cleanText(
      application.courseName ||
      application.course ||
      application.collegeName ||
      application.institutionName ||
      application.title ||
      "Application",
      250
    );
  }

  function getApplicationId(application) {
    if (!isObject(application)) return "";

    return cleanText(
      application.id ||
      application.applicationId ||
      application.referenceId ||
      "",
      150
    );
  }

  function isNotificationUnread(notification) {
    if (!isObject(notification)) return false;

    if (typeof notification.isRead === "boolean") {
      return !notification.isRead;
    }

    if (typeof notification.read === "boolean") {
      return !notification.read;
    }

    if (notification.readAt === null) return true;

    return false;
  }

  function getProfileCompletion(profile) {
    if (!isObject(profile)) return 0;

    const explicit = profile.profileCompletion;

    if (
      explicit !== undefined &&
      explicit !== null &&
      explicit !== "" &&
      Number.isFinite(Number(explicit))
    ) {
      return Math.max(0, Math.min(100, Number(explicit)));
    }

    const nested = isObject(profile.profile) ? profile.profile : {};

    const fields = [
      profile.firstName || nested.firstName,
      profile.lastName || nested.lastName,
      profile.email || nested.email,
      profile.phone || nested.phone,
      profile.dateOfBirth || profile.dob || nested.dateOfBirth,
      profile.address || nested.address,
      profile.education || nested.education,
      profile.profileImage || profile.avatar || nested.profileImage
    ];

    const completed = fields.filter(function (value) {
      if (Array.isArray(value)) return value.length > 0;

      return value !== undefined &&
        value !== null &&
        value !== "";
    }).length;

    return Math.round((completed / fields.length) * 100);
  }

  function calculateStats() {
    const applications = state.applications;
    const notifications = state.notifications;

    const countStatus = function (statuses) {
      const normalizedStatuses = statuses.map(normalize);

      return applications.filter(function (application) {
        return normalizedStatuses.includes(
          normalize(getApplicationStatus(application))
        );
      }).length;
    };

    return {
      totalApplications: applications.length,

      pendingApplications: countStatus([
        "pending",
        "submitted",
        "under review",
        "under-review",
        "in review",
        "in-review",
        "in progress",
        "in-progress",
        "draft"
      ]),

      approvedApplications: countStatus([
        "approved",
        "accepted",
        "completed"
      ]),

      rejectedApplications: countStatus(["rejected"]),

      unreadNotifications: notifications.filter(
        isNotificationUnread
      ).length,

      profileCompletion: getProfileCompletion(state.profile)
    };
  }

  function getState() {
    return {
      data: state.data,
      applications: state.applications.slice(),
      notifications: state.notifications.slice(),
      activity: state.activity.slice(),
      profile: state.profile,
      stats: calculateStats(),
      loading: state.loading,
      error: state.error,
      lastUpdated: state.lastUpdated
    };
  }

  function notify() {
    const snapshot = getState();

    listeners.forEach(function (callback) {
      try {
        callback(snapshot);
      } catch (error) {
        if (window.console && window.console.error) {
          window.console.error(
            "[MedOrbits Dashboard] Listener error."
          );
        }
      }
    });

    emit("medorbits:dashboard-updated", snapshot);

    renderAll();
  }

  function getRecentApplications(limit) {
    const count = limit === undefined ? 5 : Number(limit);
    const safeLimit = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 5;

    return state.applications.slice().sort(function (a, b) {
      const dateA = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      const dateB = Date.parse(b.updatedAt || b.createdAt || "") || 0;

      return dateB - dateA;
    }).slice(0, safeLimit);
  }

  function getRecentNotifications(limit) {
    const count = limit === undefined ? 5 : Number(limit);
    const safeLimit = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 5;

    return state.notifications.slice().sort(function (a, b) {
      const dateA = Date.parse(a.createdAt || a.date || "") || 0;
      const dateB = Date.parse(b.createdAt || b.date || "") || 0;

      return dateB - dateA;
    }).slice(0, safeLimit);
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function createLink(href, text, className) {
    const link = createElement("a", className, text);
    link.href = href;
    return link;
  }

  function renderStats(container) {
    const target = resolveElement(container);
    if (!target) return false;

    const stats = calculateStats();

    const cards = [
      {
        label: "Total Applications",
        value: stats.totalApplications,
        icon: "📄",
        key: "applications"
      },
      {
        label: "Pending Applications",
        value: stats.pendingApplications,
        icon: "⏳",
        key: "pending"
      },
      {
        label: "Approved Applications",
        value: stats.approvedApplications,
        icon: "✓",
        key: "approved"
      },
      {
        label: "Unread Notifications",
        value: stats.unreadNotifications,
        icon: "🔔",
        key: "notifications"
      }
    ];

    target.replaceChildren();

    cards.forEach(function (card) {
      const article = createElement(
        "article",
        "dashboard-stat-card dashboard-stat-card--" + card.key
      );

      const icon = createElement(
        "span",
        "dashboard-stat-card__icon",
        card.icon
      );

      icon.setAttribute("aria-hidden", "true");

      const content = createElement(
        "div",
        "dashboard-stat-card__content"
      );

      content.append(
        createElement("p", "dashboard-stat-card__label", card.label),
        createElement("strong", "dashboard-stat-card__value", card.value)
      );

      article.append(icon, content);
      target.appendChild(article);
    });

    return true;
  }

  function renderApplications(container, limit) {
    const target = resolveElement(container);
    if (!target) return false;

    const applications = getRecentApplications(limit);

    target.replaceChildren();

    if (!applications.length) {
      const empty = createElement("div", "dashboard-empty-state");
      empty.appendChild(createElement("p", "", "No applications yet."));
      empty.appendChild(createLink("/education/courses.html", "Explore courses"));
      target.appendChild(empty);
      return true;
    }

    applications.forEach(function (application) {
      const article = createElement("article", "dashboard-application");
      const main = createElement("div", "dashboard-application__main");
      const id = getApplicationId(application);
      const status = getApplicationStatus(application);
      const date = application.updatedAt || application.createdAt;

      main.appendChild(
        createElement("h3", "", getApplicationTitle(application))
      );

      const metadata = createElement("p", "");

      const metadataParts = [];

      if (id) metadataParts.push("Reference: " + id);

      if (date) {
        metadataParts.push(
          formatDate(date, {
            day: "numeric",
            month: "short",
            year: "numeric"
          })
        );
      }

      metadata.textContent = metadataParts.join(" · ") || "Application";
      main.appendChild(metadata);

      const badge = createElement(
        "span",
        "status-badge status-badge--" + getStatusClass(status),
        status
      );

      article.append(main, badge);

      if (id) {
        const link = createLink(
          "/account/applications.html?id=" + encodeURIComponent(id),
          "View"
        );

        link.setAttribute(
          "aria-label",
          "View application " + id
        );

        article.appendChild(link);
      }

      target.appendChild(article);
    });

    return true;
  }

  function renderNotifications(container, limit) {
    const target = resolveElement(container);
    if (!target) return false;

    const notifications = getRecentNotifications(limit);

    target.replaceChildren();

    if (!notifications.length) {
      const empty = createElement("div", "dashboard-empty-state");
      empty.appendChild(
        createElement("p", "", "You have no notifications.")
      );
      target.appendChild(empty);
      return true;
    }

    notifications.forEach(function (notification) {
      const unread = isNotificationUnread(notification);

      const article = createElement(
        "article",
        "dashboard-notification" + (unread ? " is-unread" : "")
      );

      const indicator = createElement(
        "div",
        "dashboard-notification__indicator"
      );

      indicator.setAttribute("aria-hidden", "true");

      const content = createElement(
        "div",
        "dashboard-notification__content"
      );

      content.appendChild(
        createElement(
          "h3",
          "",
          cleanText(notification.title || "Notification", 250)
        )
      );

      content.appendChild(
        createElement(
          "p",
          "",
          cleanText(notification.message || notification.body || "", 2000)
        )
      );

      const date = notification.createdAt || notification.date;

      const time = createElement(
        "time",
        "",
        formatRelativeDate(date)
      );

      if (date && !Number.isNaN(Date.parse(date))) {
        time.dateTime = new Date(date).toISOString();
      }

      content.appendChild(time);
      article.append(indicator, content);
      target.appendChild(article);
    });

    return true;
  }

  function renderProfileCompletion(container) {
    const target = resolveElement(container);
    if (!target) return false;

    const completion = getProfileCompletion(state.profile);

    target.replaceChildren();

    const section = createElement(
      "section",
      "dashboard-profile-completion"
    );

    const header = createElement(
      "div",
      "dashboard-profile-completion__header"
    );

    header.append(
      createElement("h3", "", "Profile Completion"),
      createElement("strong", "", completion + "%")
    );

    const progress = createElement("div", "dashboard-progress");

    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", "Profile completion");
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(completion));

    const bar = createElement("span", "dashboard-progress__bar");

    bar.style.width = completion + "%";
    progress.appendChild(bar);

    const description = createElement(
      "p",
      "",
      completion === 100
        ? "Your profile is complete."
        : "Complete your profile to improve your counselling experience."
    );

    section.append(header, progress, description);

    if (completion < 100) {
      section.appendChild(
        createLink("/account/profile.html", "Complete Profile")
      );
    }

    target.appendChild(section);

    return true;
  }

  function renderActivity(container, limit) {
    const target = resolveElement(container);
    if (!target) return false;

    const count = limit === undefined ? 8 : Number(limit);
    const safeLimit = Number.isFinite(count)
      ? Math.max(0, Math.floor(count))
      : 8;

    const activities = state.activity.slice().sort(function (a, b) {
      const dateA = Date.parse(a.createdAt || a.timestamp || "") || 0;
      const dateB = Date.parse(b.createdAt || b.timestamp || "") || 0;

      return dateB - dateA;
    }).slice(0, safeLimit);

    target.replaceChildren();

    if (!activities.length) {
      const empty = createElement("div", "dashboard-empty-state");
      empty.appendChild(
        createElement("p", "", "No recent activity available.")
      );
      target.appendChild(empty);
      return true;
    }

    activities.forEach(function (activity) {
      const article = createElement("article", "dashboard-activity-item");

      const content = createElement(
        "div",
        "dashboard-activity-item__content"
      );

      content.appendChild(
        createElement(
          "h3",
          "",
          activity.title ||
          activity.action ||
          activity.event ||
          "Account activity"
        )
      );

      content.appendChild(
        createElement(
          "p",
          "",
          activity.description ||
          activity.message ||
          activity.details ||
          ""
        )
      );

      const date = activity.createdAt || activity.timestamp;
      const time = createElement(
        "time",
        "",
        formatRelativeDate(date)
      );

      if (date && !Number.isNaN(Date.parse(date))) {
        time.dateTime = new Date(date).toISOString();
      }

      article.append(content, time);
      target.appendChild(article);
    });

    return true;
  }

  function renderAll() {
    renderStats("[data-dashboard-stats]");
    renderApplications("[data-dashboard-applications]");
    renderNotifications("[data-dashboard-notifications]");
    renderProfileCompletion("[data-dashboard-profile-completion]");
    renderActivity("[data-dashboard-activity]");
  }

  async function load(options) {
    options = options || {};

    const sequence = ++loadSequence;

    if (activeController) {
      activeController.abort();
    }

    activeController = typeof window.AbortController === "function"
      ? new window.AbortController()
      : null;

    const signal = activeController
      ? activeController.signal
      : undefined;

    state.loading = true;
    state.error = null;
    notify();

    const requestOptions = { signal: signal };

    const jobs = [
      requestJSON(ENDPOINTS.dashboard, requestOptions).then(function (result) {
        return {
          key: "data",
          value: extractObject(result, ["dashboard"])
        };
      }),

      requestJSON(ENDPOINTS.applications, requestOptions).then(function (result) {
        return {
          key: "applications",
          value: extractList(result, ["applications"])
        };
      }),

      requestJSON(ENDPOINTS.notifications, requestOptions).then(function (result) {
        return {
          key: "notifications",
          value: extractList(result, ["notifications"])
        };
      }),

      requestJSON(ENDPOINTS.profile, requestOptions).then(function (result) {
        return {
          key: "profile",
          value: extractObject(result, ["profile", "user"])
        };
      })
    ];

    if (options.loadActivity) {
      jobs.push(
        requestJSON(ENDPOINTS.activity, requestOptions).then(function (result) {
          return {
            key: "activity",
            value: extractList(result, ["activity", "activities", "logs"])
          };
        })
      );
    }

    const results = await Promise.allSettled(jobs);

    // Ignore responses belonging to an older request.
    if (sequence !== loadSequence) {
      return getState();
    }

    let successCount = 0;
    const failures = [];

    results.forEach(function (result) {
      if (result.status === "fulfilled") {
        state[result.value.key] = result.value.value;
        successCount += 1;
      } else {
        failures.push(result.reason);
      }
    });

    if (failures.length === jobs.length) {
      state.error = failures[0] && failures[0].message
        ? failures[0].message
        : "Unable to load dashboard information.";
    } else if (failures.length) {
      state.error = "Some dashboard information could not be loaded.";
    }

    state.loading = false;
    state.lastUpdated = new Date().toISOString();

    activeController = null;
    notify();

    emit("medorbits:dashboard-load-complete", {
      successCount: successCount,
      failureCount: failures.length,
      error: state.error
    });

    return getState();
  }

  async function refresh() {
    return load({
      loadActivity: state.activity.length > 0
    });
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    listeners.add(callback);

    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  async function init(options) {
    options = options || {};

    const dashboard = document.querySelector("[data-dashboard]");

    if (!dashboard && !options.force) return null;

    return load({
      loadActivity: options.loadActivity !== false
    });
  }

  function handleRefreshClick(event) {
    const target = event.target;

    if (!target || typeof target.closest !== "function") return;

    const button = target.closest("[data-dashboard-refresh]");

    if (!button) return;

    event.preventDefault();

    if (button.disabled) return;

    button.disabled = true;

    refresh().catch(function () {
      // The dashboard state contains the error for the UI to display.
    }).finally(function () {
      button.disabled = false;
    });
  }

  document.addEventListener("click", handleRefreshClick);

  function autoInit() {
    if (!document.querySelector("[data-dashboard]")) return;

    init().catch(function () {
      if (window.console && window.console.error) {
        window.console.error(
          "[MedOrbits Dashboard] Initialization failed."
        );
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

  const api = {
    version: "1.1.0",
    ENDPOINTS: ENDPOINTS,

    init: init,
    load: load,
    refresh: refresh,
    getState: getState,
    subscribe: subscribe,

    getRecentApplications: getRecentApplications,
    getRecentNotifications: getRecentNotifications,
    calculateStats: calculateStats,
    getProfileCompletion: getProfileCompletion,

    formatCurrency: formatCurrency,
    formatDate: formatDate,
    formatRelativeDate: formatRelativeDate,

    renderStats: renderStats,
    renderApplications: renderApplications,
    renderNotifications: renderNotifications,
    renderProfileCompletion: renderProfileCompletion,
    renderActivity: renderActivity,
    renderAll: renderAll
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsDashboard = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Dashboard = api;

})(window, document);
