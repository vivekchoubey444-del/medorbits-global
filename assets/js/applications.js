
/**
 * MedOrbits -- Applications Manager
 * File: /assets/js/applications.js
 * Version: 1.1.0
 *
 * Handles education admissions, job applications, application tracking,
 * filtering, status updates, and accessible application rendering.
 *
 * Authentication, authorization, ownership checks, and status-transition
 * rules must be enforced by the backend.
 */

(() => {
  "use strict";

  if (window.MedOrbitsApplications) return;

  const CONSTANTS = window.MedOrbitsConstants || {};
  const API = CONSTANTS.API || {};
  const CONFIG = window.MedOrbitsConfig || {};

  const API_BASE_URL = String(
    CONFIG.API_BASE_URL || API.PREFIX || "/api"
  ).replace(/\/+$/, "");

  const ENDPOINT = String(
    API.ENDPOINTS?.APPLICATIONS || "/applications"
  ).replace(/^\/+|\/+$/g, "");

  const DEFAULT_TIMEOUT = 15000;
  const MAX_PAGE_SIZE = 100;

  const STATUS = Object.freeze({
    DRAFT: "draft",
    SUBMITTED: "submitted",
    UNDER_REVIEW: "under_review",
    SHORTLISTED: "shortlisted",
    APPROVED: "approved",
    REJECTED: "rejected",
    INTERVIEW: "interview",
    OFFERED: "offered",
    HIRED: "hired",
    WITHDRAWN: "withdrawn",
    COMPLETED: "completed"
  });

  const VALID_STATUSES = new Set(Object.values(STATUS));

  const state = {
    applications: [],
    currentApplication: null,
    loading: false,
    error: null,
    filters: {
      type: "all",
      status: "all",
      search: ""
    }
  };

  const listeners = new Set();
  const formBindings = new WeakMap();
  const refreshBindings = new WeakSet();

  class ApplicationError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "ApplicationError";
      this.code = options.code || "APPLICATION_ERROR";
      this.status = Number(options.status) || 0;
      this.details = options.details ?? null;
    }
  }

  // --------------------------------------------------
  // Utilities
  // --------------------------------------------------

  const utils = {
    normalizeId(id) {
      if (
        id === null ||
        id === undefined ||
        String(id).trim() === ""
      ) {
        throw new ApplicationError("A valid application ID is required.", {
          code: "INVALID_APPLICATION_ID"
        });
      }

      return encodeURIComponent(String(id).trim());
    },

    getCsrfToken() {
      return document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute("content") || "";
    },

    emit(name, detail = {}) {
      document.dispatchEvent(
        new CustomEvent(`medorbits:${name}`, { detail })
      );
    },

    normalizeApplication(application) {
      if (
        !application ||
        typeof application !== "object" ||
        Array.isArray(application)
      ) {
        return null;
      }

      return Object.freeze({ ...application });
    },

    extractList(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.applications)) return payload.applications;
      if (Array.isArray(payload?.data?.applications)) {
        return payload.data.applications;
      }
      if (Array.isArray(payload?.data)) return payload.data;

      return [];
    },

    extractItem(payload) {
      if (!payload || typeof payload !== "object") return null;

      const item =
        payload.application ??
        payload.data?.application ??
        payload.data ??
        payload;

      return (
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
      ) ? item : null;
    },

    getId(application) {
      return application?.id ?? application?.application_id ?? null;
    },

    normalizeStatus(value) {
      return String(value ?? "").trim().toLowerCase();
    },

    validFilterValue(value, allowedValues) {
      const normalized = String(value ?? "all").trim().toLowerCase();
      return normalized === "all" || allowedValues.has(normalized)
        ? normalized
        : "all";
    }
  };

  // --------------------------------------------------
  // HTTP client
  // --------------------------------------------------

  async function request(path = "", options = {}) {
    const method = String(options.method || "GET").toUpperCase();

    if (!/^(GET|POST|PUT|PATCH|DELETE|HEAD)$/.test(method)) {
      throw new ApplicationError("Unsupported request method.", {
        code: "INVALID_METHOD"
      });
    }

    const controller = new AbortController();
    const timeoutMs = Number(API.DEFAULT_TIMEOUT_MS || DEFAULT_TIMEOUT);
    const timeout = window.setTimeout(
      () => controller.abort("timeout"),
      Math.max(1000, Math.min(timeoutMs, 120000))
    );

    let abortHandler;

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason);
      } else {
        abortHandler = () => controller.abort(options.signal.reason);
        options.signal.addEventListener("abort", abortHandler, {
          once: true
        });
      }
    }

    try {
      if (controller.signal.aborted) {
        throw new ApplicationError("The request was cancelled.", {
          code: "REQUEST_ABORTED"
        });
      }

      const basePath = `${API_BASE_URL}/${ENDPOINT}`;
      const relativePath = String(path || "");

      if (
        /^[a-z][a-z\d+.-]*:/i.test(relativePath) ||
        relativePath.startsWith("//") ||
        relativePath.includes("\\")
      ) {
        throw new ApplicationError("Invalid API request path.", {
          code: "INVALID_REQUEST_PATH"
        });
      }

      const url = new URL(
        `${basePath}${relativePath}`,
        window.location.origin
      );

      const configuredBase = new URL(API_BASE_URL, window.location.origin);

      if (
        url.origin !== configuredBase.origin ||
        url.origin !== window.location.origin
      ) {
        throw new ApplicationError("API URL origin is not permitted.", {
          code: "INVALID_API_ORIGIN"
        });
      }

      const headers = new Headers(options.headers || {});
      headers.set("Accept", "application/json");

      let body;

      if (options.body !== undefined) {
        if (
          options.body instanceof FormData ||
          options.body instanceof Blob ||
          typeof options.body === "string"
        ) {
          body = options.body;
        } else {
          body = JSON.stringify(options.body);
          headers.set("Content-Type", "application/json");
        }
      }

      if (
        !["GET", "HEAD"].includes(method) &&
        !headers.has("X-CSRF-Token")
      ) {
        const csrfToken = utils.getCsrfToken();
        if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
      }

      const response = await fetch(url.href, {
        method,
        headers,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        body: ["GET", "HEAD"].includes(method) ? undefined : body,
        signal: controller.signal
      });

      const contentType = response.headers.get("content-type") || "";
      let payload = null;

      if (response.status !== 204 && response.status !== 205) {
        if (contentType.includes("application/json")) {
          payload = await response.json().catch(() => null);
        } else {
          const text = await response.text().catch(() => "");
          payload = text ? { message: text.slice(0, 1000) } : null;
        }
      }

      if (!response.ok) {
        throw new ApplicationError(
          payload?.message ||
            payload?.error?.message ||
            "Unable to process the application request.",
          {
            code: payload?.code || payload?.error?.code || "REQUEST_FAILED",
            status: response.status,
            details: payload?.details ?? payload?.error?.details ?? null
          }
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof ApplicationError) throw error;

      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new ApplicationError(
          options.signal?.aborted
            ? "The request was cancelled."
            : "The application request timed out or was interrupted.",
          {
            code: options.signal?.aborted
              ? "REQUEST_ABORTED"
              : "REQUEST_TIMEOUT"
          }
        );
      }

      throw new ApplicationError(
        "Unable to connect to the application service.",
        {
          code: "NETWORK_ERROR",
          details: window.MEDORBITS_DEBUG === true
            ? { message: String(error?.message || error) }
            : null
        }
      );
    } finally {
      window.clearTimeout(timeout);

      if (options.signal && abortHandler) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    }
  }

  // --------------------------------------------------
  // State management
  // --------------------------------------------------

  function notify(reason) {
    const detail = Object.freeze({
      reason,
      applications: [...state.applications],
      currentApplication: state.currentApplication,
      loading: state.loading,
      error: state.error,
      filters: Object.freeze({ ...state.filters })
    });

    utils.emit("applications-updated", detail);

    listeners.forEach((listener) => {
      try {
        listener(detail);
      } catch (error) {
        console.error("[MedOrbits Applications] Listener failed.", error);
      }
    });
  }

  function setApplications(applications, reason = "loaded") {
    state.applications = applications
      .map(utils.normalizeApplication)
      .filter(Boolean);

    state.error = null;
    notify(reason);

    return [...state.applications];
  }

  function upsertApplication(application) {
    const normalized = utils.normalizeApplication(application);
    if (!normalized) return null;

    const id = utils.getId(normalized);

    if (id !== null) {
      const index = state.applications.findIndex(
        (item) => String(utils.getId(item)) === String(id)
      );

      if (index >= 0) {
        state.applications[index] = normalized;
      } else {
        state.applications.unshift(normalized);
      }
    }

    state.currentApplication = normalized;
    return normalized;
  }

  function replaceApplication(id, application) {
    const normalized = utils.normalizeApplication(application);
    if (!normalized) return null;

    const targetId = String(id);
    const returnedId = utils.getId(normalized);
    const effectiveId = String(returnedId ?? targetId);

    const index = state.applications.findIndex(
      (item) => String(utils.getId(item)) === targetId
    );

    if (index >= 0) {
      state.applications[index] = normalized;
    } else if (returnedId !== null) {
      state.applications.unshift(normalized);
    }

    if (
      state.currentApplication &&
      String(utils.getId(state.currentApplication)) === targetId
    ) {
      state.currentApplication = normalized;
    }

    return { application: normalized, id: effectiveId };
  }

  // --------------------------------------------------
  // List applications
  // --------------------------------------------------

  async function getAll(options = {}) {
    const params = new URLSearchParams();

    const page = Number(options.page ?? 1);
    const limit = Number(options.limit ?? 20);

    params.set(
      "page",
      String(Number.isInteger(page) && page > 0 ? page : 1)
    );

    params.set(
      "limit",
      String(
        Number.isInteger(limit) && limit > 0
          ? Math.min(limit, MAX_PAGE_SIZE)
          : 20
      )
    );

    const type = String(options.type ?? "all").trim();
    const status = String(options.status ?? "all").trim();
    const search = String(options.search ?? "").trim();

    if (type && type !== "all") params.set("type", type);
    if (status && status !== "all") params.set("status", status);
    if (search) params.set("search", search);

    state.loading = true;
    state.error = null;
    notify("loading");

    try {
      const payload = await request(`?${params.toString()}`, {
        signal: options.signal
      });

      return setApplications(utils.extractList(payload), "loaded");
    } catch (error) {
      state.error = error;
      notify("error");
      throw error;
    } finally {
      state.loading = false;
      notify("loading-complete");
    }
  }

  async function getMine(options = {}) {
    return getAll(options);
  }

  // --------------------------------------------------
  // Application details
  // --------------------------------------------------

  async function getById(id, options = {}) {
    const payload = await request(`/${utils.normalizeId(id)}`, {
      signal: options.signal
    });

    const application = utils.normalizeApplication(
      utils.extractItem(payload)
    );

    if (!application) {
      throw new ApplicationError("Application details were not returned.", {
        code: "INVALID_RESPONSE"
      });
    }

    state.currentApplication = application;
    notify("details-loaded");

    return application;
  }

  // --------------------------------------------------
  // Submit application
  // --------------------------------------------------

  async function submit(details = {}, options = {}) {
    if (
      !details ||
      typeof details !== "object" ||
      Array.isArray(details)
    ) {
      throw new ApplicationError("Valid application details are required.", {
        code: "INVALID_APPLICATION_DETAILS"
      });
    }

    const payload = await request("", {
      method: "POST",
      body: { ...details },
      signal: options.signal
    });

    const application = utils.normalizeApplication(
      utils.extractItem(payload)
    );

    if (!application) {
      throw new ApplicationError("The server did not return the submitted application.", {
        code: "INVALID_RESPONSE"
      });
    }

    upsertApplication(application);
    state.error = null;
    notify("submitted");

    utils.emit("application-submitted", { application });

    return {
      success: true,
      application,
      message: payload?.message || "Application submitted."
    };
  }

  // --------------------------------------------------
  // Update application
  // --------------------------------------------------

  async function update(id, changes = {}, options = {}) {
    if (
      !changes ||
      typeof changes !== "object" ||
      Array.isArray(changes)
    ) {
      throw new ApplicationError("Valid application updates are required.", {
        code: "INVALID_APPLICATION_CHANGES"
      });
    }

    const encodedId = utils.normalizeId(id);
    const payload = await request(`/${encodedId}`, {
      method: "PATCH",
      body: { ...changes },
      signal: options.signal
    });

    const application = utils.normalizeApplication(
      utils.extractItem(payload)
    );

    if (!application) {
      throw new ApplicationError("The server did not return the updated application.", {
        code: "INVALID_RESPONSE"
      });
    }

    replaceApplication(id, application);
    state.error = null;
    notify("updated");

    utils.emit("application-updated", { application });

    return application;
  }

  // --------------------------------------------------
  // Withdraw application
  // --------------------------------------------------

  async function withdraw(id, reason = "", options = {}) {
    const payload = await request(
      `/${utils.normalizeId(id)}/withdraw`,
      {
        method: "POST",
        body: { reason: String(reason ?? "").trim() },
        signal: options.signal
      }
    );

    const application = utils.normalizeApplication(
      utils.extractItem(payload)
    );

    if (application) {
      replaceApplication(id, application);
    } else {
      const index = state.applications.findIndex(
        (item) => String(utils.getId(item)) === String(id)
      );

      if (index >= 0) {
        state.applications[index] = Object.freeze({
          ...state.applications[index],
          status: STATUS.WITHDRAWN
        });
      }

      if (
        state.currentApplication &&
        String(utils.getId(state.currentApplication)) === String(id)
      ) {
        state.currentApplication = Object.freeze({
          ...state.currentApplication,
          status: STATUS.WITHDRAWN
        });
      }
    }

    state.error = null;
    notify("withdrawn");

    return {
      success: true,
      application,
      message: payload?.message || "Withdrawal request processed."
    };
  }

  // --------------------------------------------------
  // Delete draft application
  // --------------------------------------------------

  async function deleteDraft(id, options = {}) {
    const encodedId = utils.normalizeId(id);

    const payload = await request(`/${encodedId}`, {
      method: "DELETE",
      signal: options.signal
    });

    state.applications = state.applications.filter(
      (item) => String(utils.getId(item)) !== String(id)
    );

    if (
      state.currentApplication &&
      String(utils.getId(state.currentApplication)) === String(id)
    ) {
      state.currentApplication = null;
    }

    state.error = null;
    notify("deleted");

    return {
      success: true,
      message: payload?.message || "Draft application deleted."
    };
  }

  // --------------------------------------------------
  // Local filtering
  // --------------------------------------------------

  function setFilters(filters = {}) {
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      throw new TypeError("Filters must be an object.");
    }

    const allowedTypes = new Set([
      "education",
      "admission",
      "job",
      "employment",
      "internship",
      "scholarship"
    ]);

    const next = { ...state.filters, ...filters };

    state.filters = {
      type: utils.validFilterValue(next.type, allowedTypes),
      status: utils.validFilterValue(next.status, VALID_STATUSES),
      search: String(next.search ?? "").trim().slice(0, 200)
    };

    notify("filters-changed");
    return getFiltered();
  }

  function getFiltered() {
    const { type, status, search } = state.filters;
    const query = search.toLowerCase();

    return state.applications.filter((application) => {
      const applicationType = String(
        application.type || application.application_type || "education"
      ).toLowerCase();

      const applicationStatus = utils.normalizeStatus(application.status);

      const searchable = [
        application.id,
        application.application_id,
        application.title,
        application.course,
        application.college,
        application.university,
        application.job_title,
        application.company,
        application.status
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return (
        (type === "all" || applicationType === type) &&
        (status === "all" || applicationStatus === status) &&
        (!query || searchable.includes(query))
      );
    });
  }

  // --------------------------------------------------
  // Render application list
  // --------------------------------------------------

  function renderList(container, applications = getFiltered()) {
    if (typeof container === "string") {
      container = document.querySelector(container);
    }

    if (!(container instanceof Element)) {
      throw new TypeError("A valid application list container is required.");
    }

    if (!Array.isArray(applications)) {
      throw new TypeError("Applications must be an array.");
    }

    const fragment = document.createDocumentFragment();

    if (applications.length === 0) {
      const empty = document.createElement("p");
      empty.className = "applications-empty";
      empty.textContent = "No applications found.";
      container.replaceChildren(empty);
      return;
    }

    applications.forEach((application) => {
      if (!application || typeof application !== "object") return;

      const card = document.createElement("article");
      card.className = "application-card";

      const title = document.createElement("h3");
      title.textContent =
        application.title ||
        application.course ||
        application.job_title ||
        "Application";

      const reference = document.createElement("p");
      reference.className = "application-card__reference";
      reference.textContent =
        `Reference: ${utils.getId(application) ?? "Pending"}`;

      const statusValue = utils.normalizeStatus(application.status) || "pending";

      const status = document.createElement("span");
      status.className = "application-card__status";
      status.dataset.status = statusValue;
      status.textContent = statusValue.replace(/[_-]/g, " ");

      const view = document.createElement("button");
      view.type = "button";
      view.className = "application-card__view";
      view.textContent = "View details";

      view.addEventListener("click", () => {
        const id = utils.getId(application);

        if (id !== null) {
          utils.emit("application-view-requested", { id: String(id) });
        }
      });

      card.append(title, reference, status, view);
      fragment.appendChild(card);
    });

    container.replaceChildren(fragment);
  }

  // --------------------------------------------------
  // Form integration
  // --------------------------------------------------

  function bindForm(form, options = {}) {
    if (typeof form === "string") {
      form = document.querySelector(form);
    }

    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("A valid application form is required.");
    }

    if (formBindings.has(form)) {
      return formBindings.get(form);
    }

    const handler = async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton?.disabled) return;

      const originalText = submitButton?.textContent;

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
        submitButton.textContent = "Submitting…";
      }

      try {
        const details = Object.fromEntries(new FormData(form).entries());
        const result = await submit(details, {
          signal: options.signal
        });

        if (typeof options.onSuccess === "function") {
          await options.onSuccess(result);
        } else if (window.MedOrbits?.toast) {
          window.MedOrbits.toast.success(result.message);
        }

        if (options.resetOnSuccess === true) {
          form.reset();
        }
      } catch (error) {
        if (typeof options.onError === "function") {
          options.onError(error);
        } else if (window.MedOrbits?.toast) {
          window.MedOrbits.toast.error(error.message);
        } else {
          console.error("[MedOrbits Applications]", error);
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute("aria-busy");

          if (originalText !== undefined) {
            submitButton.textContent = originalText;
          }
        }
      }
    };

    form.addEventListener("submit", handler);

    const unbind = () => {
      form.removeEventListener("submit", handler);
      formBindings.delete(form);
    };

    formBindings.set(form, unbind);
    return unbind;
  }

  // --------------------------------------------------
  // Change subscriptions
  // --------------------------------------------------

  function onChange(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("onChange expects a function.");
    }

    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  // --------------------------------------------------
  // Initialization
  // --------------------------------------------------

  function init() {
    document.querySelectorAll("[data-application-form]").forEach((form) => {
      try {
        bindForm(form);
      } catch (error) {
        console.error("[MedOrbits Applications] Form initialization failed.", error);
      }
    });

    document.querySelectorAll("[data-application-list]").forEach((container) => {
      try {
        renderList(container);
      } catch (error) {
        console.error("[MedOrbits Applications] List initialization failed.", error);
      }
    });

    document.querySelectorAll("[data-application-refresh]").forEach((button) => {
      if (refreshBindings.has(button)) return;
      refreshBindings.add(button);

      button.addEventListener("click", async () => {
        if (button.disabled) return;

        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        try {
          await getMine();

          document.querySelectorAll("[data-application-list]").forEach(
            (container) => renderList(container)
          );
        } catch (error) {
          if (window.MedOrbits?.toast) {
            window.MedOrbits.toast.error(error.message);
          } else {
            console.error("[MedOrbits Applications]", error);
          }
        } finally {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
      });
    });
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  const publicAPI = Object.freeze({
    STATUS,
    ApplicationError,

    getAll,
    getMine,
    getById,
    submit,
    update,
    withdraw,
    deleteDraft,

    setFilters,
    getFiltered,
    renderList,
    bindForm,
    onChange,

    get state() {
      return Object.freeze({
        applications: [...state.applications],
        currentApplication: state.currentApplication,
        loading: state.loading,
        error: state.error,
        filters: Object.freeze({ ...state.filters })
      });
    },

    init
  });

  Object.defineProperty(window, "MedOrbitsApplications", {
    value: publicAPI,
    writable: false,
    configurable: false,
    enumerable: true
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
