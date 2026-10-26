
/* =========================================================
   MedOrbits -- Visits Manager
   File: /assets/js/visits.js
========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsVisits) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const API_BASE = String(
    CONFIG.API_BASE_URL || CONFIG.apiBaseUrl || "/api"
  ).replace(/\/+$/, "");

  const ENDPOINTS = Object.freeze({
    visits: "/visits",
    details: "/visits/",
    cancel: "/visits/",
    reschedule: "/visits/"
  });

  const EVENTS = Object.freeze({
    LOADED: "medorbits:visits:loaded",
    BOOKED: "medorbits:visits:booked",
    CANCELLED: "medorbits:visits:cancelled",
    RESCHEDULED: "medorbits:visits:rescheduled",
    ERROR: "medorbits:visits:error"
  });

  const state = {
    visits: [],
    currentVisit: null,
    loading: false,
    initialized: false,
    activeController: null
  };

  const CANCELLED_STATUSES = new Set([
    "cancelled", "canceled", "completed", "visited", "rejected"
  ]);

  const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, {
      detail: detail || {}
    }));
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

  function getToken() {
    const auth = window.MedOrbitsAuth;

    if (!auth) return "";

    try {
      if (typeof auth.getToken === "function") {
        return auth.getToken() || "";
      }

      if (typeof auth.getAccessToken === "function") {
        return auth.getAccessToken() || "";
      }
    } catch (_) {}

    return "";
  }

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : "";
  }

  async function request(path, options) {
    options = options || {};

    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const token = getToken();
    const csrfToken = getCsrfToken();

    if (token) headers.set("Authorization", "Bearer " + token);
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);

    let response;

    try {
      response = await fetch(API_BASE + path, {
        method: options.method || "GET",
        headers: headers,
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body)
      });
    } catch (cause) {
      if (cause && cause.name === "AbortError") throw cause;

      const error = new Error("Unable to connect to the visits service.");
      error.cause = cause;

      emit(EVENTS.ERROR, {
        message: error.message,
        endpoint: path
      });

      throw error;
    }

    const contentType = response.headers.get("content-type") || "";
    let result = null;

    if (contentType.includes("application/json")) {
      result = await response.json().catch(function () {
        return null;
      });
    } else {
      const text = await response.text().catch(function () {
        return "";
      });

      result = text ? { message: text } : null;
    }

    if (!response.ok) {
      const error = new Error(
        result && result.message
          ? result.message
          : "Visit request failed (" + response.status + ")."
      );

      error.status = response.status;
      error.data = result;

      emit(EVENTS.ERROR, {
        message: error.message,
        status: response.status,
        endpoint: path
      });

      const handler = window.MedOrbitsErrorHandler;

      if (handler && typeof handler.notify === "function") {
        try {
          handler.notify(error, {
            module: "visits",
            endpoint: path
          });
        } catch (_) {}
      }

      throw error;
    }

    return result;
  }

  function unwrap(data) {
    if (!data || typeof data !== "object") return data;
    return data.data !== undefined ? data.data : data;
  }

  function normalizeVisits(data) {
    const payload = unwrap(data);

    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.visits)) return payload.visits;
    if (payload && Array.isArray(payload.items)) return payload.items;

    return [];
  }

  function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "--"
      : DATE_FORMATTER.format(date);
  }

  function formatTime(value) {
    if (!value) return "--";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : TIME_FORMATTER.format(date);
  }

  function statusClass(status) {
    const value = String(status || "scheduled").toLowerCase();

    if (["completed", "visited", "approved"].includes(value)) {
      return "is-completed";
    }

    if (["cancelled", "canceled", "rejected"].includes(value)) {
      return "is-cancelled";
    }

    if (["pending", "requested", "rescheduling"].includes(value)) {
      return "is-pending";
    }

    return "is-scheduled";
  }

  function getVisitId(visit) {
    if (!visit) return "";

    return visit.id ||
      visit.visitId ||
      visit.visit_id ||
      visit.bookingId ||
      visit.booking_id ||
      "";
  }

  function getVisitDate(visit) {
    if (!visit) return null;

    return visit.scheduledAt ||
      visit.scheduled_at ||
      visit.visitDate ||
      visit.visit_date ||
      visit.date ||
      null;
  }

  function getPropertyName(visit) {
    return visit.propertyTitle ||
      visit.property_title ||
      (visit.property && visit.property.title) ||
      visit.title ||
      "Property visit";
  }

  function getLocation(visit) {
    return visit.location ||
      visit.propertyAddress ||
      visit.property_address ||
      (visit.property && visit.property.address) ||
      "";
  }

  function canCancelVisit(status) {
    return !CANCELLED_STATUSES.has(
      String(status || "scheduled").toLowerCase()
    );
  }

  function renderVisits() {
    document.querySelectorAll("[data-visits-list]").forEach(function (container) {
      if (!state.visits.length) {
        container.innerHTML =
          '<p class="visits-empty">No property visits found.</p>';
        return;
      }

      container.innerHTML = state.visits.map(function (visit) {
        const id = getVisitId(visit);
        const status = visit.status || "scheduled";
        const date = getVisitDate(visit);
        const location = getLocation(visit);

        return [
          '<article class="visit-card" data-visit-id="' + escapeHTML(id) + '">',
          '<div class="visit-card__header">',
          '<h3>' + escapeHTML(getPropertyName(visit)) + '</h3>',
          '<span class="visit-card__status ' + statusClass(status) + '">',
          escapeHTML(status),
          '</span>',
          '</div>',
          location
            ? '<p class="visit-card__location">' + escapeHTML(location) + '</p>'
            : "",
          '<p class="visit-card__date">Date: ' + escapeHTML(formatDate(date)) + '</p>',
          '<p class="visit-card__time">Time: ' + escapeHTML(formatTime(date)) + '</p>',
          visit.visitType || visit.visit_type
            ? '<p class="visit-card__type">Type: ' +
              escapeHTML(visit.visitType || visit.visit_type) + '</p>'
            : "",
          '<div class="visit-card__actions">',
          id
            ? '<button type="button" data-visit-view="' +
              escapeHTML(id) + '">View details</button>'
            : "",
          id && canCancelVisit(status)
            ? '<button type="button" data-visit-cancel="' +
              escapeHTML(id) + '">Cancel visit</button>'
            : "",
          '</div>',
          '</article>'
        ].join("");
      }).join("");
    });
  }

  function renderVisitDetails() {
    document.querySelectorAll("[data-visit-details]").forEach(function (container) {
      const visit = state.currentVisit;

      if (!visit) {
        container.innerHTML =
          '<p class="visits-empty">Select a visit to view its details.</p>';
        return;
      }

      const id = getVisitId(visit);
      const status = visit.status || "scheduled";
      const date = getVisitDate(visit);
      const location = getLocation(visit);

      container.innerHTML = [
        '<article class="visit-details">',
        '<h2>' + escapeHTML(getPropertyName(visit)) + '</h2>',
        id ? '<p>Visit ID: ' + escapeHTML(id) + '</p>' : "",
        '<p>Status: <span class="visit-card__status ' +
          statusClass(status) + '">' + escapeHTML(status) + '</span></p>',
        '<p>Date: ' + escapeHTML(formatDate(date)) + '</p>',
        '<p>Time: ' + escapeHTML(formatTime(date)) + '</p>',
        location ? '<p>Location: ' + escapeHTML(location) + '</p>' : "",
        visit.notes ? '<p>Notes: ' + escapeHTML(visit.notes) + '</p>' : "",
        visit.contactName || visit.contact_name
          ? '<p>Contact: ' +
            escapeHTML(visit.contactName || visit.contact_name) + '</p>'
          : "",
        '</article>'
      ].join("");
    });
  }

  async function loadVisits(options) {
    options = options || {};

    const params = new URLSearchParams();

    if (options.status) params.set("status", options.status);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.propertyId) {
      params.set("propertyId", String(options.propertyId));
    }

    const query = params.toString();
    const data = await request(
      ENDPOINTS.visits + (query ? "?" + query : ""),
      { signal: options.signal }
    );

    state.visits = normalizeVisits(data);
    renderVisits();

    emit(EVENTS.LOADED, {
      visits: state.visits.slice()
    });

    return state.visits.slice();
  }

  async function getVisit(visitId) {
    if (!visitId) throw new Error("Visit ID is required.");

    const data = await request(
      ENDPOINTS.details + encodeURIComponent(String(visitId))
    );

    const payload = unwrap(data);
    state.currentVisit = payload && (payload.visit || payload);

    renderVisitDetails();

    emit(EVENTS.LOADED, {
      type: "details",
      visit: state.currentVisit
    });

    return state.currentVisit;
  }

  async function bookVisit(payload) {
    if (!payload || typeof payload !== "object") {
      throw new TypeError("Visit details are required.");
    }

    const propertyId = payload.propertyId || payload.property_id;
    const scheduledAt = payload.scheduledAt ||
      payload.scheduled_at ||
      payload.visitDate ||
      payload.visit_date;

    if (!propertyId) throw new Error("Property ID is required.");

    const date = new Date(scheduledAt);

    if (!scheduledAt || Number.isNaN(date.getTime())) {
      throw new Error("Select a valid visit date and time.");
    }

    if (date.getTime() <= Date.now()) {
      throw new Error("Visit date and time must be in the future.");
    }

    const data = await request(ENDPOINTS.visits, {
      method: "POST",
      body: {
        propertyId: propertyId,
        scheduledAt: date.toISOString(),
        visitType: payload.visitType || payload.visit_type || "in-person",
        notes: String(payload.notes || "").trim()
      }
    });

    const visit = unwrap(data);

    emit(EVENTS.BOOKED, { visit: visit });
    await loadVisits().catch(function () {});

    return visit;
  }

  async function cancelVisit(visitId, reason) {
    if (!visitId) throw new Error("Visit ID is required.");

    const data = await request(
      ENDPOINTS.cancel + encodeURIComponent(String(visitId)) + "/cancel",
      {
        method: "POST",
        body: { reason: String(reason || "").trim() }
      }
    );

    const result = unwrap(data);

    emit(EVENTS.CANCELLED, {
      visitId: visitId,
      response: result
    });

    await Promise.allSettled([
      loadVisits(),
      getVisit(visitId)
    ]);

    return result;
  }

  async function rescheduleVisit(visitId, scheduledAt, notes) {
    if (!visitId) throw new Error("Visit ID is required.");

    const date = new Date(scheduledAt);

    if (!scheduledAt || Number.isNaN(date.getTime())) {
      throw new Error("Select a valid visit date and time.");
    }

    if (date.getTime() <= Date.now()) {
      throw new Error("Visit date and time must be in the future.");
    }

    const data = await request(
      ENDPOINTS.reschedule + encodeURIComponent(String(visitId)) +
        "/reschedule",
      {
        method: "PATCH",
        body: {
          scheduledAt: date.toISOString(),
          notes: String(notes || "").trim()
        }
      }
    );

    const result = unwrap(data);

    emit(EVENTS.RESCHEDULED, {
      visitId: visitId,
      response: result
    });

    await Promise.allSettled([
      loadVisits(),
      getVisit(visitId)
    ]);

    return result;
  }

  function showMessage(message, isError) {
    document.querySelectorAll("[data-visits-message]").forEach(function (element) {
      element.textContent = message || "";
      element.hidden = !message;
      element.setAttribute("role", isError ? "alert" : "status");
    });
  }

  function setLoading(form, loading) {
    if (!form) return;

    form.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    ).forEach(function (button) {
      if (loading) {
        if (!button.hasAttribute("data-visits-original-disabled")) {
          button.dataset.visitsOriginalDisabled = String(button.disabled);
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      } else {
        button.disabled = button.dataset.visitsOriginalDisabled === "true";
        button.removeAttribute("data-visits-original-disabled");
        button.removeAttribute("aria-busy");
      }
    });
  }

  function handleError(error) {
    showMessage(
      error && error.message
        ? error.message
        : "Unable to complete the visit request.",
      true
    );
  }

  function bindBookingForms() {
    document.querySelectorAll("[data-visit-booking-form]").forEach(function (form) {
      if (form.dataset.visitsBound === "true") return;
      form.dataset.visitsBound = "true";

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const payload = {
          propertyId: formData.get("propertyId") || formData.get("property_id"),
          scheduledAt: formData.get("scheduledAt") ||
            formData.get("scheduled_at") ||
            formData.get("visitDate"),
          visitType: formData.get("visitType") || formData.get("visit_type"),
          notes: formData.get("notes")
        };

        setLoading(form, true);
        showMessage("", false);

        try {
          const visit = await bookVisit(payload);
          form.reset();

          const id = getVisitId(visit);
          showMessage(
            "Property visit requested successfully." +
              (id ? " Visit ID: " + id : ""),
            false
          );
        } catch (error) {
          handleError(error);
        } finally {
          setLoading(form, false);
        }
      });
    });
  }

  function bindRescheduleForms() {
    document.querySelectorAll("[data-visit-reschedule-form]").forEach(function (form) {
      if (form.dataset.visitsBound === "true") return;
      form.dataset.visitsBound = "true";

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const visitId = form.dataset.visitId ||
          formData.get("visitId") ||
          formData.get("visit_id");
        const date = formData.get("scheduledAt") ||
          formData.get("scheduled_at") ||
          formData.get("visitDate");

        setLoading(form, true);
        showMessage("", false);

        try {
          await rescheduleVisit(visitId, date, formData.get("notes"));
          showMessage("Visit rescheduled successfully.", false);
        } catch (error) {
          handleError(error);
        } finally {
          setLoading(form, false);
        }
      });
    });
  }

  function bindActions() {
    if (state.actionsBound) return;
    state.actionsBound = true;

    document.addEventListener("click", async function (event) {
      const target = event.target instanceof Element
        ? event.target
        : event.target && event.target.parentElement;

      if (!target) return;

      const viewButton = target.closest("[data-visit-view]");
      const cancelButton = target.closest("[data-visit-cancel]");

      if (viewButton) {
        try {
          await getVisit(viewButton.dataset.visitView);
          showMessage("", false);
        } catch (error) {
          handleError(error);
        }
        return;
      }

      if (cancelButton) {
        const visitId = cancelButton.dataset.visitCancel;

        if (!window.confirm("Are you sure you want to cancel this visit?")) {
          return;
        }

        cancelButton.disabled = true;
        showMessage("", false);

        try {
          await cancelVisit(visitId);
          showMessage("Visit cancelled successfully.", false);
        } catch (error) {
          handleError(error);
        } finally {
          cancelButton.disabled = false;
        }
      }
    });
  }

  async function refresh(options) {
    state.loading = true;

    try {
      await loadVisits(options);
      return getState();
    } finally {
      state.loading = false;
    }
  }

  function getState() {
    return {
      visits: state.visits.slice(),
      currentVisit: state.currentVisit,
      loading: state.loading
    };
  }

  function init() {
    if (state.initialized) return;

    const hasUI = document.querySelector(
      "[data-visits-list], [data-visit-details], " +
      "[data-visit-booking-form], [data-visit-reschedule-form]"
    );

    if (!hasUI) return;

    state.initialized = true;

    bindBookingForms();
    bindRescheduleForms();
    bindActions();

    loadVisits().catch(handleError);
  }

  const api = Object.freeze({
    loadVisits: loadVisits,
    getVisit: getVisit,
    bookVisit: bookVisit,
    cancelVisit: cancelVisit,
    rescheduleVisit: rescheduleVisit,
    refresh: refresh,
    getState: getState,
    formatDate: formatDate,
    formatTime: formatTime,
    events: EVENTS
  });

  window.MedOrbitsVisits = api;
  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Visits = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
