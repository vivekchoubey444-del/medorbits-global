
/* =========================================================
   MedOrbits -- Support Center
   File: /assets/js/support.js
   Version: 1.1.0
========================================================= */

(function (window, document) {
  "use strict";

  const CONFIG = window.MedOrbitsConfig || {};

  const API_BASE = String(
    CONFIG.API_BASE_URL || CONFIG.apiBaseUrl || "/api"
  ).replace(/\/+$/, "");

  const ENDPOINTS = Object.freeze({
    tickets: "/support/tickets",
    ticket: "/support/tickets/",
    categories: "/support/categories",
    replies: "/support/tickets/"
  });

  const EVENTS = Object.freeze({
    LOADED: "medorbits:support:loaded",
    TICKET_CREATED: "medorbits:support:ticket-created",
    TICKET_UPDATED: "medorbits:support:ticket-updated",
    REPLY_SENT: "medorbits:support:reply-sent",
    ERROR: "medorbits:support:error"
  });

  const state = {
    tickets: [],
    categories: [],
    currentTicket: null,
    loading: false,
    initialized: false,
    listeners: []
  };

  const CLOSED_STATUSES = ["resolved", "closed", "completed"];

  const PRIORITIES = ["low", "normal", "high", "urgent"];

  function emit(name, detail) {
    document.dispatchEvent(
      new CustomEvent(name, { detail: detail || {} })
    );
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[char];
      }
    );
  }

  function getValue(object, keys, fallback) {
    if (!object || typeof object !== "object") {
      return fallback == null ? "" : fallback;
    }

    for (const key of keys) {
      const value = object[key];

      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return fallback == null ? "" : fallback;
  }

  function getTicketId(ticket) {
    return String(
      getValue(ticket, ["id", "ticketId", "ticket_id"], "")
    );
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
    } catch (_) {
      return "";
    }

    return "";
  }

  function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json().catch(function () {
        return null;
      });
    }

    return response.text().then(function (text) {
      return text ? { message: text } : null;
    }).catch(function () {
      return null;
    });
  }

  async function request(path, options) {
    options = options || {};

    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");

    if (
      options.body !== undefined &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const token = getToken();

    if (token) {
      headers.set("Authorization", "Bearer " + token);
    }

    let response;

    try {
      response = await fetch(API_BASE + path, {
        method: options.method || "GET",
        headers: headers,
        credentials: "same-origin",
        cache: "no-store",
        body: options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
        signal: options.signal
      });
    } catch (cause) {
      const error = new Error(
        "Unable to connect to the support service. Please try again."
      );

      error.cause = cause;
      error.code = "SUPPORT_NETWORK_ERROR";

      emit(EVENTS.ERROR, {
        message: error.message,
        endpoint: path
      });

      throw error;
    }

    const result = await parseResponse(response);

    if (!response.ok) {
      const error = new Error(
        result && typeof result.message === "string"
          ? result.message
          : "Support request failed (" + response.status + ")."
      );

      error.status = response.status;
      error.data = result;

      emit(EVENTS.ERROR, {
        message: error.message,
        status: response.status,
        endpoint: path
      });

      const errorHandler = window.MedOrbitsErrorHandler;

      if (
        errorHandler &&
        typeof errorHandler.notify === "function"
      ) {
        try {
          errorHandler.notify(error, {
            module: "support",
            endpoint: path
          });
        } catch (_) {
          // Error reporting must not hide the original API error.
        }
      }

      throw error;
    }

    return result;
  }

  function unwrap(data) {
    if (!data || typeof data !== "object") {
      return data;
    }

    return data.data !== undefined ? data.data : data;
  }

  function normalizeTickets(data) {
    const payload = unwrap(data);

    if (Array.isArray(payload)) return payload;

    if (payload && Array.isArray(payload.tickets)) {
      return payload.tickets;
    }

    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }

    return [];
  }

  function normalizeCategories(data) {
    const payload = unwrap(data);

    if (Array.isArray(payload)) return payload;

    if (payload && Array.isArray(payload.categories)) {
      return payload.categories;
    }

    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }

    return [];
  }

  function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    try {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
    } catch (_) {
      return date.toLocaleString();
    }
  }

  function statusClass(status) {
    const value = String(status || "open")
      .trim()
      .toLowerCase();

    if (CLOSED_STATUSES.includes(value)) {
      return "is-resolved";
    }

    if (["pending", "waiting", "on-hold", "on hold"].includes(value)) {
      return "is-pending";
    }

    if (
      ["in-progress", "in progress", "processing"].includes(value)
    ) {
      return "is-in-progress";
    }

    return "is-open";
  }

  function isClosed(status) {
    return CLOSED_STATUSES.includes(
      String(status || "").trim().toLowerCase()
    );
  }

  function renderCategories() {
    document.querySelectorAll("[data-support-category]").forEach(
      function (select) {
        const currentValue = select.value;

        const options = [
          '<option value="">Select a category</option>'
        ];

        state.categories.forEach(function (category) {
          const value = typeof category === "string"
            ? category
            : getValue(
                category,
                ["id", "slug", "name", "value"],
                ""
              );

          const label = typeof category === "string"
            ? category
            : getValue(
                category,
                ["name", "label", "title"],
                value
              );

          if (!value) return;

          options.push(
            '<option value="' + escapeHTML(value) + '">' +
              escapeHTML(label) +
            "</option>"
          );
        });

        select.innerHTML = options.join("");

        if (
          currentValue &&
          Array.from(select.options).some(function (option) {
            return option.value === currentValue;
          })
        ) {
          select.value = currentValue;
        }
      }
    );
  }

  function renderTickets() {
    document.querySelectorAll("[data-support-tickets]").forEach(
      function (container) {
        if (!state.tickets.length) {
          container.innerHTML =
            '<p class="support-empty">You have no support tickets yet.</p>';
          return;
        }

        container.innerHTML = state.tickets.map(function (ticket) {
          const id = getTicketId(ticket);
          const subject = getValue(
            ticket,
            ["subject", "title"],
            "Support request"
          );
          const status = getValue(ticket, ["status"], "open");
          const priority = getValue(ticket, ["priority"], "normal");
          const createdAt = getValue(
            ticket,
            ["createdAt", "created_at", "createdOn"],
            ""
          );

          return [
            '<article class="support-ticket" data-ticket-id="' +
              escapeHTML(id) + '">',
            '<div class="support-ticket__header">',
            "<h3>" + escapeHTML(subject) + "</h3>",
            '<span class="support-ticket__status ' +
              statusClass(status) + '">',
            escapeHTML(status),
            "</span>",
            "</div>",
            '<p class="support-ticket__id">Ticket #' +
              escapeHTML(id || "--") + "</p>",
            '<p class="support-ticket__priority">Priority: ' +
              escapeHTML(priority) + "</p>",
            '<p class="support-ticket__date">Created: ' +
              escapeHTML(formatDate(createdAt)) + "</p>",
            '<button type="button" data-support-open-ticket="' +
              escapeHTML(id) + '"' +
              (id ? "" : " disabled") + ">",
            "View ticket",
            "</button>",
            "</article>"
          ].join("");
        }).join("");
      }
    );
  }

  function renderTicketDetails() {
    document.querySelectorAll("[data-support-ticket-details]").forEach(
      function (container) {
        const ticket = state.currentTicket;

        if (!ticket) {
          container.innerHTML =
            '<p class="support-empty">Select a ticket to view its details.</p>';
          return;
        }

        const id = getTicketId(ticket);
        const subject = getValue(
          ticket,
          ["subject", "title"],
          "Support request"
        );
        const status = getValue(ticket, ["status"], "open");
        const description = getValue(
          ticket,
          ["description", "message"],
          ""
        );

        const replies = Array.isArray(ticket.replies)
          ? ticket.replies
          : Array.isArray(ticket.messages)
            ? ticket.messages
            : [];

        const replyHTML = replies.map(function (reply) {
          const author = getValue(
            reply,
            [
              "authorName",
              "author_name",
              "senderName",
              "sender_name",
              "author"
            ],
            "Support"
          );

          const message = getValue(
            reply,
            ["message", "body", "content"],
            ""
          );

          const createdAt = getValue(
            reply,
            ["createdAt", "created_at", "date"],
            ""
          );

          return [
            '<article class="support-reply">',
            '<p class="support-reply__author">' +
              escapeHTML(author) + "</p>",
            '<p class="support-reply__message">' +
              escapeHTML(message).replace(/\n/g, "<br>") +
            "</p>",
            "<time>" + escapeHTML(formatDate(createdAt)) + "</time>",
            "</article>"
          ].join("");
        }).join("");

        container.innerHTML = [
          '<article class="support-ticket-details">',
          "<header>",
          "<h2>" + escapeHTML(subject) + "</h2>",
          "<p>Ticket #" + escapeHTML(id || "--") + "</p>",
          '<span class="support-ticket__status ' +
            statusClass(status) + '">',
          escapeHTML(status),
          "</span>",
          "</header>",
          '<div class="support-ticket-details__description">',
          escapeHTML(description).replace(/\n/g, "<br>"),
          "</div>",
          "<h3>Conversation</h3>",
          replies.length
            ? '<div class="support-replies">' + replyHTML + "</div>"
            : '<p class="support-empty">No replies yet.</p>',
          "</article>"
        ].join("");

        document.querySelectorAll("[data-support-reply-form]").forEach(
          function (form) {
            form.dataset.ticketId = id;
            form.hidden = isClosed(status);
          }
        );

        document.querySelectorAll("[data-support-close-ticket]").forEach(
          function (button) {
            button.dataset.supportCloseTicket = id;
            button.hidden = isClosed(status);
          }
        );
      }
    );
  }

  async function loadCategories() {
    try {
      const data = await request(ENDPOINTS.categories);

      state.categories = normalizeCategories(data);
      renderCategories();

      return state.categories.slice();
    } catch (error) {
      // Preserve categories already present in the page as a fallback.
      const fallback = document.querySelector("[data-support-category]");

      if (fallback && fallback.options.length > 1) {
        state.categories = Array.from(fallback.options)
          .slice(1)
          .map(function (option) {
            return {
              id: option.value,
              name: option.textContent
            };
          });

        renderCategories();
      }

      throw error;
    }
  }

  async function loadTickets(options) {
    options = options || {};

    const params = new URLSearchParams();

    if (options.status) {
      params.set("status", String(options.status));
    }

    if (options.page) {
      params.set("page", String(options.page));
    }

    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    const query = params.toString();

    const data = await request(
      ENDPOINTS.tickets + (query ? "?" + query : "")
    );

    state.tickets = normalizeTickets(data);
    renderTickets();

    emit(EVENTS.LOADED, {
      tickets: state.tickets.slice()
    });

    return state.tickets.slice();
  }

  async function createTicket(payload) {
    if (!payload || typeof payload !== "object") {
      throw new TypeError("Ticket details are required.");
    }

    const subject = String(payload.subject || "").trim();

    const description = String(
      payload.description || payload.message || ""
    ).trim();

    if (!subject) {
      throw new Error("Please enter a ticket subject.");
    }

    if (!description) {
      throw new Error("Please describe your issue.");
    }

    if (subject.length > 200) {
      throw new Error("Subject must be 200 characters or fewer.");
    }

    if (description.length > 10000) {
      throw new Error(
        "Description must be 10,000 characters or fewer."
      );
    }

    const requestedPriority = String(
      payload.priority || "normal"
    ).toLowerCase();

    const body = {
      subject: subject,
      description: description,
      category: String(payload.category || "").trim(),
      priority: PRIORITIES.includes(requestedPriority)
        ? requestedPriority
        : "normal"
    };

    const data = await request(ENDPOINTS.tickets, {
      method: "POST",
      body: body
    });

    const result = unwrap(data);
    const ticket = result && result.ticket
      ? result.ticket
      : result;

    emit(EVENTS.TICKET_CREATED, {
      ticket: ticket
    });

    await loadTickets().catch(function () {
      // Creation succeeded; refreshing the list is best-effort.
    });

    return ticket;
  }

  async function getTicket(ticketId) {
    if (
      ticketId === undefined ||
      ticketId === null ||
      String(ticketId).trim() === ""
    ) {
      throw new Error("Ticket ID is required.");
    }

    const safeId = encodeURIComponent(String(ticketId));

    const data = await request(ENDPOINTS.ticket + safeId);
    const result = unwrap(data);

    state.currentTicket = result && result.ticket
      ? result.ticket
      : result;

    renderTicketDetails();

    emit(EVENTS.LOADED, {
      type: "ticket",
      ticket: state.currentTicket
    });

    return state.currentTicket;
  }

  async function sendReply(ticketId, message) {
    if (
      ticketId === undefined ||
      ticketId === null ||
      String(ticketId).trim() === ""
    ) {
      throw new Error("Ticket ID is required.");
    }

    const text = String(message || "").trim();

    if (!text) {
      throw new Error("Please enter a reply.");
    }

    if (text.length > 10000) {
      throw new Error("Reply must be 10,000 characters or fewer.");
    }

    const safeId = encodeURIComponent(String(ticketId));

    const data = await request(
      ENDPOINTS.replies + safeId + "/replies",
      {
        method: "POST",
        body: { message: text }
      }
    );

    const reply = unwrap(data);

    emit(EVENTS.REPLY_SENT, {
      ticketId: ticketId,
      reply: reply
    });

    await getTicket(ticketId);

    return reply;
  }

  async function closeTicket(ticketId) {
    if (
      ticketId === undefined ||
      ticketId === null ||
      String(ticketId).trim() === ""
    ) {
      throw new Error("Ticket ID is required.");
    }

    const safeId = encodeURIComponent(String(ticketId));

    const data = await request(
      ENDPOINTS.ticket + safeId + "/close",
      {
        method: "POST",
        body: {}
      }
    );

    const result = unwrap(data);

    emit(EVENTS.TICKET_UPDATED, {
      ticketId: ticketId,
      response: result
    });

    await Promise.allSettled([
      loadTickets(),
      getTicket(ticketId)
    ]);

    return result;
  }

  function showMessage(message, isError) {
    document.querySelectorAll("[data-support-message]").forEach(
      function (element) {
        element.textContent = message || "";
        element.hidden = !message;
        element.setAttribute("role", isError ? "alert" : "status");
      }
    );
  }

  function setLoading(form, loading) {
    if (!form) return;

    form.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    ).forEach(function (button) {
      button.disabled = Boolean(loading);
      button.setAttribute("aria-busy", String(Boolean(loading)));
    });

    form.setAttribute("aria-busy", String(Boolean(loading)));
  }

  function handleError(error) {
    showMessage(
      error && error.message
        ? error.message
        : "Unable to complete your support request.",
      true
    );
  }

  function addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);

    state.listeners.push(function () {
      target.removeEventListener(type, handler, options);
    });
  }

  function bindEvents() {
    document.querySelectorAll("[data-support-create-form]").forEach(
      function (form) {
        addListener(form, "submit", async function (event) {
          event.preventDefault();

          if (!form.reportValidity()) return;

          const formData = new FormData(form);

          const payload = {
            subject: formData.get("subject"),
            description:
              formData.get("description") ||
              formData.get("message"),
            category: formData.get("category"),
            priority: formData.get("priority")
          };

          setLoading(form, true);
          showMessage("", false);

          try {
            const ticket = await createTicket(payload);

            form.reset();

            const ticketId = getTicketId(ticket);

            showMessage(
              "Your support ticket has been submitted." +
                (ticketId ? " Ticket ID: " + ticketId : ""),
              false
            );
          } catch (error) {
            handleError(error);
          } finally {
            setLoading(form, false);
          }
        });
      }
    );

    document.querySelectorAll("[data-support-reply-form]").forEach(
      function (form) {
        addListener(form, "submit", async function (event) {
          event.preventDefault();

          if (!form.reportValidity()) return;

          const formData = new FormData(form);

          const message =
            formData.get("message") ||
            formData.get("reply");

          const ticketId = form.dataset.ticketId;

          if (!ticketId) {
            handleError(
              new Error("Select a support ticket before replying.")
            );
            return;
          }

          setLoading(form, true);
          showMessage("", false);

          try {
            await sendReply(ticketId, message);

            form.reset();
            showMessage("Your reply has been sent.", false);
          } catch (error) {
            handleError(error);
          } finally {
            setLoading(form, false);
          }
        });
      }
    );

    addListener(document, "click", async function (event) {
      const target = event.target;

      if (!target || typeof target.closest !== "function") {
        return;
      }

      const openButton = target.closest(
        "[data-support-open-ticket]"
      );

      const closeButton = target.closest(
        "[data-support-close-ticket]"
      );

      if (openButton) {
        const ticketId = openButton.dataset.supportOpenTicket;

        showMessage("", false);
        openButton.disabled = true;

        try {
          await getTicket(ticketId);
        } catch (error) {
          handleError(error);
        } finally {
          openButton.disabled = false;
        }

        return;
      }

      if (closeButton) {
        const ticketId = closeButton.dataset.supportCloseTicket;

        if (!ticketId) {
          handleError(new Error("Ticket ID is required."));
          return;
        }

        if (!window.confirm("Close this support ticket?")) {
          return;
        }

        closeButton.disabled = true;

        try {
          await closeTicket(ticketId);
          showMessage("The support ticket has been closed.", false);
        } catch (error) {
          handleError(error);
        } finally {
          closeButton.disabled = false;
        }
      }
    });
  }

  async function refresh() {
    if (state.loading) {
      return getState();
    }

    state.loading = true;

    try {
      const results = await Promise.allSettled([
        loadTickets(),
        loadCategories()
      ]);

      const failure = results.find(function (result) {
        return result.status === "rejected";
      });

      if (failure) {
        throw failure.reason;
      }

      return getState();
    } finally {
      state.loading = false;
    }
  }

  function getState() {
    return {
      tickets: state.tickets.slice(),
      categories: state.categories.slice(),
      currentTicket: state.currentTicket,
      loading: state.loading
    };
  }

  function init() {
    if (state.initialized) return;

    const supportUI = document.querySelector(
      "[data-support-create-form], " +
      "[data-support-tickets], " +
      "[data-support-ticket-details], " +
      "[data-support-category], " +
      "[data-support-reply-form], " +
      "[data-support-close-ticket]"
    );

    if (!supportUI) return;

    state.initialized = true;

    bindEvents();

    refresh().catch(handleError);
  }

  function destroy() {
    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (_) {
        // Continue removing remaining listeners.
      }
    });

    state.listeners = [];
    state.initialized = false;
  }

  const api = Object.freeze({
    loadTickets: loadTickets,
    loadCategories: loadCategories,
    createTicket: createTicket,
    getTicket: getTicket,
    sendReply: sendReply,
    closeTicket: closeTicket,
    refresh: refresh,
    getState: getState,
    init: init,
    destroy: destroy,
    events: EVENTS
  });

  window.MedOrbitsSupport = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Support = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})(window, document);
