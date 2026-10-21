
/* =========================================================
   MedOrbits -- Notifications Manager
   File: /assets/js/notifications.js
   Purpose: Notifications, unread counts, preferences, polling
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsNotifications) return;

  const CONFIG = window.MedOrbitsConfig || {};
  const API_BASE = String(
    CONFIG.API_BASE_URL || CONFIG.apiBaseUrl || "/api"
  ).replace(/\/+$/, "");

  const STORAGE_KEY = "medorbits_notifications_cache";
  const DEFAULT_PAGE_SIZE = 20;
  const DEFAULT_POLL_INTERVAL = 60000;
  const MAX_TITLE_LENGTH = 200;
  const MAX_MESSAGE_LENGTH = 5000;

  const state = {
    items: [],
    unreadCount: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    loading: false,
    pollingTimer: null,
    initialized: false,
    preferences: {
      email: true,
      push: true,
      inApp: true,
      categories: {}
    }
  };

  const listeners = new Map();
  const boundControls = new WeakSet();
  const pendingActions = new Set();

  const EVENTS = Object.freeze({
    LOADED: "loaded",
    UPDATED: "updated",
    READ: "read",
    UNREAD: "unread",
    DELETED: "deleted",
    ARCHIVED: "archived",
    ERROR: "error",
    UNREAD_COUNT_UPDATED: "unread-count-updated"
  });

  const utils = {
    escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    },

    dispatch(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(
        `medorbits:notifications:${name}`,
        { detail }
      ));
    },

    notify(message, type = "info") {
      if (window.MedOrbitsToast?.[type]) {
        window.MedOrbitsToast[type](message);
        return;
      }

      if (window.MedOrbitsErrorHandler?.notify) {
        window.MedOrbitsErrorHandler.notify(message, type);
        return;
      }

      window.MedOrbitsApp?.notify?.(message, type);
    },

    formatDate(value) {
      const date = value ? new Date(value) : null;

      if (!date || Number.isNaN(date.getTime())) return "";

      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(date);
    },

    relativeTime(value) {
      const date = value ? new Date(value) : null;

      if (!date || Number.isNaN(date.getTime())) return "";

      const seconds = Math.round((date.getTime() - Date.now()) / 1000);
      const units = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
        ["second", 1]
      ];

      const formatter = new Intl.RelativeTimeFormat(undefined, {
        numeric: "auto"
      });

      for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size || unit === "second") {
          return formatter.format(Math.round(seconds / size), unit);
        }
      }

      return "";
    },

    getCache() {
      try {
        return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        return {};
      }
    },

    setCache(data) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Storage may be unavailable.
      }
    },

    getElement(target) {
      if (target && target.nodeType === 1) return target;
      if (typeof target !== "string" || !target) return null;

      try {
        return document.querySelector(target);
      } catch {
        return null;
      }
    }
  };

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const isFormData = options.body instanceof FormData;

    if (options.body != null && !isFormData &&
        !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (isFormData) headers.delete("Content-Type");

    const token =
      window.MedOrbitsAuth?.getToken?.() ||
      window.MedOrbitsAuth?.getAccessToken?.();

    if (token) headers.set("Authorization", `Bearer ${token}`);

    const fetchOptions = {
      ...options,
      headers,
      credentials: options.credentials || "same-origin"
    };

    delete fetchOptions.responseType;

    const response = await fetch(
      `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
      fetchOptions
    );

    const contentType = response.headers.get("content-type") || "";
    let data = null;

    if (options.responseType === "blob" && response.ok) {
      data = await response.blob();
    } else if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => "");
    }

    if (!response.ok) {
      const error = new Error(
        data?.message ||
        data?.error ||
        `Notification request failed (${response.status}).`
      );

      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function safeLink(value) {
    if (!value) return "";

    try {
      const url = new URL(String(value), window.location.origin);

      if (!["https:", "http:"].includes(url.protocol)) return "";

      // Permit same-origin relative paths and valid HTTP(S) links.
      return url.href;
    } catch {
      return "";
    }
  }

  function normalizeNotification(item = {}) {
    const createdAt =
      item.createdAt ||
      item.created_at ||
      item.timestamp ||
      null;

    return {
      ...item,
      id: String(item.id || item._id || item.notificationId || ""),
      title: String(item.title || item.subject || "Notification")
        .slice(0, MAX_TITLE_LENGTH),
      message: String(
        item.message || item.body || item.description || ""
      ).slice(0, MAX_MESSAGE_LENGTH),
      type: String(item.type || item.category || "general"),
      category: String(item.category || item.type || "general"),
      priority: String(item.priority || "normal"),
      read: Boolean(item.read ?? item.isRead ?? item.is_read ?? false),
      readAt: item.readAt || item.read_at || null,
      createdAt,
      updatedAt: item.updatedAt || item.updated_at || null,
      link: safeLink(item.link || item.url || ""),
      actionLabel: String(item.actionLabel || item.action_label || ""),
      metadata: item.metadata && typeof item.metadata === "object"
        ? item.metadata
        : {},
      archived: Boolean(item.archived || item.isArchived)
    };
  }

  function normalizeList(response) {
    if (Array.isArray(response)) return response;

    const data = response?.data;

    if (Array.isArray(data)) return data;

    return (
      data?.items ||
      data?.notifications ||
      response?.items ||
      response?.notifications ||
      []
    );
  }

  function extractUnreadCount(response) {
    const candidates = [
      response?.unreadCount,
      response?.unread_count,
      response?.data?.unreadCount,
      response?.data?.unread_count,
      response?.meta?.unreadCount,
      response?.count,
      response?.data?.count
    ];

    for (const value of candidates) {
      if (value !== undefined && value !== null &&
          Number.isFinite(Number(value))) {
        return Math.max(0, Number(value));
      }
    }

    return null;
  }

  function updateUnreadCount(serverCount) {
    state.unreadCount = serverCount !== null &&
      serverCount !== undefined &&
      Number.isFinite(Number(serverCount))
      ? Math.max(0, Number(serverCount))
      : state.items.filter((item) => !item.read && !item.archived).length;

    document.querySelectorAll(
      "[data-notification-count], [data-notification-badge]"
    ).forEach((element) => {
      element.textContent = state.unreadCount > 99
        ? "99+"
        : String(state.unreadCount);

      element.hidden = state.unreadCount <= 0;
      element.setAttribute(
        "aria-label",
        `${state.unreadCount} unread notifications`
      );
    });

    document.querySelectorAll(
      "[data-notification-unread-count]"
    ).forEach((element) => {
      element.textContent = String(state.unreadCount);
      element.hidden = state.unreadCount <= 0;
    });

    utils.dispatch(EVENTS.UNREAD_COUNT_UPDATED, {
      unreadCount: state.unreadCount
    });
  }

  function persistCache() {
    utils.setCache({
      items: state.items,
      unreadCount: state.unreadCount,
      savedAt: Date.now()
    });
  }

  function findNotification(id) {
    return state.items.find((item) => item.id === String(id)) || null;
  }

  async function load(options = {}) {
    state.loading = true;
    utils.dispatch("loading", { loading: true });

    try {
      const page = Math.max(1, Number(options.page) || state.page);
      const limit = Math.min(
        100,
        Math.max(1, Number(options.limit) || state.pageSize)
      );

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });

      if (options.unreadOnly) params.set("unreadOnly", "true");
      if (options.category) params.set("category", String(options.category));
      if (options.type) params.set("type", String(options.type));
      if (options.search) params.set("search", String(options.search));

      if (options.archived !== undefined) {
        params.set("archived", String(Boolean(options.archived)));
      }

      const response = await request(`/notifications?${params}`);

      state.items = normalizeList(response)
        .map(normalizeNotification)
        .filter((item) => item.id);

      state.page = page;
      state.pageSize = limit;
      state.total = Math.max(0, Number(
        response?.total ??
        response?.data?.total ??
        response?.meta?.total ??
        state.items.length
      ) || 0);

      updateUnreadCount(extractUnreadCount(response));
      persistCache();
      render(options.container);

      utils.dispatch(EVENTS.LOADED, {
        items: state.items.slice(),
        unreadCount: state.unreadCount,
        total: state.total
      });

      return state.items.slice();
    } catch (error) {
      utils.dispatch(EVENTS.ERROR, { error, action: "load" });
      utils.notify(error.message || "Unable to load notifications.", "error");
      throw error;
    } finally {
      state.loading = false;
      utils.dispatch("loading", { loading: false });
    }
  }

  async function loadUnreadCount() {
    try {
      const response = await request("/notifications/unread-count");
      const count = extractUnreadCount(response);

      if (count !== null) {
        updateUnreadCount(count);
        return count;
      }

      updateUnreadCount();
      return state.unreadCount;
    } catch (error) {
      utils.dispatch(EVENTS.ERROR, {
        error,
        action: "load-unread-count"
      });

      throw error;
    }
  }

  async function performAction(key, action) {
    if (pendingActions.has(key)) return false;

    pendingActions.add(key);

    try {
      return await action();
    } finally {
      pendingActions.delete(key);
    }
  }

  async function markRead(notificationId) {
    const id = String(notificationId || "");
    if (!id) throw new Error("A notification ID is required.");

    return performAction(`read:${id}`, async () => {
      const notification = findNotification(id);
      if (notification?.read) return notification;

      await request(`/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        body: JSON.stringify({})
      });

      if (notification) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
      }

      updateUnreadCount();
      persistCache();
      render();

      utils.dispatch(EVENTS.READ, { notificationId: id });

      return notification || { id, read: true };
    });
  }

  async function markUnread(notificationId) {
    const id = String(notificationId || "");
    if (!id) throw new Error("A notification ID is required.");

    return performAction(`unread:${id}`, async () => {
      await request(`/notifications/${encodeURIComponent(id)}/unread`, {
        method: "PATCH",
        body: JSON.stringify({})
      });

      const notification = findNotification(id);

      if (notification) {
        notification.read = false;
        notification.readAt = null;
      }

      updateUnreadCount();
      persistCache();
      render();

      utils.dispatch(EVENTS.UNREAD, { notificationId: id });

      return notification || { id, read: false };
    });
  }

  async function markAllRead() {
    await request("/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({})
    });

    const now = new Date().toISOString();

    state.items = state.items.map((item) => ({
      ...item,
      read: true,
      readAt: item.readAt || now
    }));

    updateUnreadCount(0);
    persistCache();
    render();

    utils.dispatch("all-read", { count: state.items.length });
    return true;
  }

  async function remove(notificationId) {
    const id = String(notificationId || "");
    if (!id) throw new Error("A notification ID is required.");

    return performAction(`delete:${id}`, async () => {
      await request(`/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });

      state.items = state.items.filter((item) => item.id !== id);

      updateUnreadCount();
      persistCache();
      render();

      utils.dispatch(EVENTS.DELETED, { notificationId: id });
      return true;
    });
  }

  async function clearRead() {
    await request("/notifications/read", { method: "DELETE" });

    state.items = state.items.filter((item) => !item.read);

    updateUnreadCount();
    persistCache();
    render();

    utils.dispatch("read-cleared");
    return true;
  }

  async function archive(notificationId) {
    const id = String(notificationId || "");
    if (!id) throw new Error("A notification ID is required.");

    await request(`/notifications/${encodeURIComponent(id)}/archive`, {
      method: "POST",
      body: JSON.stringify({})
    });

    const notification = findNotification(id);

    if (notification) notification.archived = true;

    updateUnreadCount();
    persistCache();
    render();

    utils.dispatch(EVENTS.ARCHIVED, { notificationId: id });

    return notification || { id, archived: true };
  }

  async function create(payload = {}) {
    const title = String(payload.title || "").trim();
    const message = String(payload.message || "").trim();

    if (!title) throw new Error("A notification title is required.");
    if (title.length > MAX_TITLE_LENGTH) {
      throw new Error("The notification title is too long.");
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new Error("The notification message is too long.");
    }

    const response = await request("/notifications", {
      method: "POST",
      body: JSON.stringify({
        title,
        message,
        type: payload.type || "general",
        category: payload.category || payload.type || "general",
        priority: payload.priority || "normal",
        link: safeLink(payload.link || ""),
        metadata: payload.metadata || {}
      })
    });

    const raw = response?.data?.notification ||
      response?.notification ||
      response?.data ||
      response;

    const notification = normalizeNotification(raw);

    if (notification.id) {
      state.items = [
        notification,
        ...state.items.filter((item) => item.id !== notification.id)
      ];

      updateUnreadCount();
      persistCache();
      render();
    }

    utils.dispatch("created", { notification });
    return notification;
  }

  async function getPreferences() {
    const response = await request("/notifications/preferences");

    const preferences = response?.data?.preferences ||
      response?.preferences ||
      response?.data ||
      response;

    state.preferences = {
      ...state.preferences,
      ...(preferences || {}),
      categories: {
        ...state.preferences.categories,
        ...(preferences?.categories || {})
      }
    };

    renderPreferences();

    utils.dispatch("preferences-loaded", {
      preferences: { ...state.preferences }
    });

    return { ...state.preferences };
  }

  async function savePreferences(updates = {}) {
    const payload = {
      ...state.preferences,
      ...updates,
      categories: {
        ...state.preferences.categories,
        ...(updates.categories || {})
      }
    };

    const response = await request("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    const saved = response?.data?.preferences ||
      response?.preferences ||
      payload;

    state.preferences = {
      ...state.preferences,
      ...saved,
      categories: {
        ...state.preferences.categories,
        ...(saved.categories || {})
      }
    };

    renderPreferences();

    utils.dispatch("preferences-saved", {
      preferences: { ...state.preferences }
    });

    return { ...state.preferences };
  }

  function renderPreferences(target) {
    const container = utils.getElement(
      target || "[data-notification-preferences]"
    );

    if (!container) return;

    container.querySelectorAll("[data-notification-preference]").forEach((input) => {
      const key = input.dataset.notificationPreference;

      if (typeof state.preferences[key] === "boolean") {
        input.checked = state.preferences[key];
      }
    });

    container.querySelectorAll("[data-notification-category]").forEach((input) => {
      const category = input.dataset.notificationCategory;

      if (category) {
        input.checked = state.preferences.categories[category] !== false;
      }
    });
  }

  function getIcon(type) {
    const icons = {
      success: "✓",
      application: "▣",
      admission: "🎓",
      payment: "₹",
      document: "▤",
      security: "🔒",
      warning: "!",
      error: "×",
      message: "✉",
      reminder: "◷",
      general: "●"
    };

    return icons[String(type || "general").toLowerCase()] || icons.general;
  }

  function render(target) {
    const containers = target
      ? [utils.getElement(target)]
      : Array.from(document.querySelectorAll("[data-notifications-list]"));

    containers.filter(Boolean).forEach((container) => {
      const filter = container.dataset.filter || "all";

      const items = state.items.filter((item) => {
        if (filter === "unread") return !item.read && !item.archived;
        if (filter === "read") return item.read && !item.archived;
        if (filter === "archived") return item.archived;
        return !item.archived;
      });

      if (!items.length) {
        container.innerHTML = `
          <div class="mo-notifications-empty" role="status">
            <span class="mo-notifications-empty-icon" aria-hidden="true">♧</span>
            <p>No notifications to display.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = items.map((item) => {
        const id = utils.escapeHTML(item.id);
        const title = utils.escapeHTML(item.title);
        const message = utils.escapeHTML(item.message);
        const type = utils.escapeHTML(item.type);
        const date = utils.escapeHTML(utils.formatDate(item.createdAt));
        const relative = utils.escapeHTML(utils.relativeTime(item.createdAt));
        const link = safeLink(item.link);

        return `
          <article
            class="mo-notification-item${item.read ? " is-read" : " is-unread"}"
            data-notification-id="${id}"
            data-notification-type="${type}"
          >
            <span class="mo-notification-icon" aria-hidden="true">
              ${utils.escapeHTML(getIcon(item.type))}
            </span>

            <div class="mo-notification-content">
              <div class="mo-notification-heading">
                <h3>${title}</h3>
                ${!item.read
                  ? '<span class="mo-notification-dot" aria-label="Unread"></span>'
                  : ""}
              </div>

              <p>${message}</p>

              <time datetime="${utils.escapeHTML(item.createdAt || "")}"
                    title="${date}">${relative}</time>

              ${link
                ? `<a class="mo-notification-action"
                     href="${utils.escapeHTML(link)}"
                     data-notification-link="${id}">
                     ${utils.escapeHTML(item.actionLabel || "View details")}
                   </a>`
                : ""}

              <div class="mo-notification-actions">
                ${item.read
                  ? `<button type="button" data-notification-mark-unread="${id}">Mark unread</button>`
                  : `<button type="button" data-notification-mark-read="${id}">Mark read</button>`}
                <button type="button" data-notification-archive="${id}">Archive</button>
                <button type="button" data-notification-delete="${id}">Delete</button>
              </div>
            </div>
          </article>
        `;
      }).join("");
    });

    updateUnreadCount();
  }

  function bindActions() {
    document.addEventListener("click", async (event) => {
      if (!(event.target instanceof Element)) return;

      const readButton = event.target.closest("[data-notification-mark-read]");
      const unreadButton = event.target.closest("[data-notification-mark-unread]");
      const archiveButton = event.target.closest("[data-notification-archive]");
      const deleteButton = event.target.closest("[data-notification-delete]");
      const markAllButton = event.target.closest("[data-notifications-mark-all-read]");
      const clearReadButton = event.target.closest("[data-notifications-clear-read]");
      const link = event.target.closest("[data-notification-link]");

      if (link) {
        const id = link.dataset.notificationLink;
        const item = findNotification(id);

        if (item && !item.read) {
          markRead(id).catch(() => {});
        }

        return;
      }

      try {
        if (readButton) {
          event.preventDefault();
          await markRead(readButton.dataset.notificationMarkRead);
        } else if (unreadButton) {
          event.preventDefault();
          await markUnread(unreadButton.dataset.notificationMarkUnread);
        } else if (archiveButton) {
          event.preventDefault();
          await archive(archiveButton.dataset.notificationArchive);
        } else if (deleteButton) {
          event.preventDefault();

          if (!window.confirm("Delete this notification?")) return;

          await remove(deleteButton.dataset.notificationDelete);
          utils.notify("Notification deleted.", "success");
        } else if (markAllButton) {
          event.preventDefault();
          await markAllRead();
          utils.notify("All notifications marked as read.", "success");
        } else if (clearReadButton) {
          event.preventDefault();

          if (!window.confirm("Delete all read notifications?")) return;

          await clearRead();
          utils.notify("Read notifications cleared.", "success");
        }
      } catch (error) {
        utils.notify(error.message || "Unable to update notifications.", "error");
      }
    });
  }

  function bindPreferences() {
    document.querySelectorAll("[data-notification-preferences]").forEach((form) => {
      if (boundControls.has(form)) return;
      boundControls.add(form);

      form.addEventListener("change", async (event) => {
        const input = event.target;

        if (!(input instanceof HTMLInputElement)) return;

        const preference = input.dataset.notificationPreference;
        const category = input.dataset.notificationCategory;

        if (!preference && !category) return;

        try {
          if (preference) {
            await savePreferences({
              [preference]: Boolean(input.checked)
            });
          } else {
            await savePreferences({
              categories: {
                [category]: Boolean(input.checked)
              }
            });
          }
        } catch (error) {
          utils.notify(error.message || "Unable to save preferences.", "error");
        }
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const preferences = {};
        const categories = {};

        form.querySelectorAll("[data-notification-preference]").forEach((input) => {
          preferences[input.dataset.notificationPreference] = Boolean(input.checked);
        });

        form.querySelectorAll("[data-notification-category]").forEach((input) => {
          categories[input.dataset.notificationCategory] = Boolean(input.checked);
        });

        preferences.categories = categories;

        try {
          await savePreferences(preferences);
          utils.notify("Notification preferences saved.", "success");
        } catch (error) {
          utils.notify(error.message || "Unable to save preferences.", "error");
        }
      });
    });
  }

  function bindFilters() {
    document.querySelectorAll("[data-notifications-filter]").forEach((control) => {
      if (boundControls.has(control)) return;
      boundControls.add(control);

      control.addEventListener("change", () => {
        const container = utils.getElement(
          control.dataset.target || "[data-notifications-list]"
        );

        if (!container) return;

        container.dataset.filter = control.value || "all";
        render(container);
      });
    });
  }

  function startPolling(interval) {
    stopPolling();

    const delay = Math.max(
      30000,
      Number(interval) || DEFAULT_POLL_INTERVAL
    );

    state.pollingTimer = window.setInterval(async () => {
      if (document.hidden || state.loading) return;

      try {
        await loadUnreadCount();
      } catch {
        // Keep polling failures silent.
      }
    }, delay);
  }

  function stopPolling() {
    if (state.pollingTimer) {
      window.clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }
  }

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("A callback function is required.");
    }

    const event = `medorbits:notifications:${eventName}`;
    document.addEventListener(event, callback);

    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(callback);

    return () => off(eventName, callback);
  }

  function off(eventName, callback) {
    const event = `medorbits:notifications:${eventName}`;
    const callbacks = listeners.get(event);

    if (!callbacks) return;

    if (callback) {
      document.removeEventListener(event, callback);
      callbacks.delete(callback);
    } else {
      callbacks.forEach((listener) => {
        document.removeEventListener(event, listener);
      });

      callbacks.clear();
    }

    if (!callbacks.size) listeners.delete(event);
  }

  async function init(options = {}) {
    if (state.initialized && !options.force) return api;

    bindActions();
    bindPreferences();
    bindFilters();

    const cache = utils.getCache();

    if (Array.isArray(cache.items)) {
      state.items = cache.items.map(normalizeNotification);
      updateUnreadCount(cache.unreadCount);
      render();
    }

    await Promise.allSettled([
      load(options),
      getPreferences()
    ]);

    if (options.polling !== false) {
      startPolling(options.pollingInterval);
    }

    state.initialized = true;

    utils.dispatch("initialized", {
      unreadCount: state.unreadCount
    });

    return api;
  }

  function destroy() {
    stopPolling();

    listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        document.removeEventListener(event, callback);
      });
    });

    listeners.clear();
    state.initialized = false;
  }

  const api = Object.freeze({
    init,
    destroy,
    on,
    off,

    load,
    loadUnreadCount,
    create,
    markRead,
    markUnread,
    markAllRead,
    remove,
    clearRead,
    archive,

    getPreferences,
    savePreferences,
    render,
    renderPreferences,

    startPolling,
    stopPolling,

    getAll: () => state.items.slice(),
    getUnread: () => state.items.filter((item) => !item.read && !item.archived),
    getUnreadCount: () => state.unreadCount,
    getPreferencesState: () => ({
      ...state.preferences,
      categories: { ...state.preferences.categories }
    }),

    getState: () => ({
      items: state.items.slice(),
      unreadCount: state.unreadCount,
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      loading: state.loading,
      initialized: state.initialized,
      preferences: {
        ...state.preferences,
        categories: { ...state.preferences.categories }
      }
    }),

    events: EVENTS,

    constants: Object.freeze({
      DEFAULT_PAGE_SIZE,
      DEFAULT_POLL_INTERVAL,
      MAX_TITLE_LENGTH,
      MAX_MESSAGE_LENGTH
    })
  });

  window.MedOrbitsNotifications = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Notifications = api;

  function autoInit() {
    if (document.querySelector(
      "[data-notifications-list], [data-notification-count], " +
      "[data-notification-preferences]"
    )) {
      init();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }

})(window, document);
