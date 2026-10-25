
/* =========================================================
   MEDORBITS | NOTIFICATIONS
   File: assets/js/notifications.js
   Version: 1.0.0
   Dependencies: None
   Optional dataset: /assets/data/notifications.json
   ========================================================= */

(function MedOrbitsNotifications() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_NOTIFICATIONS_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    dataUrl: "/assets/data/notifications.json",
    maxNotifications: 100,
    defaultDuration: 5000,
    maxDuration: 60000,
    maxMessageLength: 2000,
    maxTitleLength: 150,
    storageKey: "medorbits:notifications:read:v1",
    persistReadState: true
  };

  var state = {
    notifications: [],
    toastContainer: null,
    liveRegion: null,
    center: null,
    observer: null,
    listeners: [],
    timers: new Map(),
    readIds: new Set(),
    sequence: 0,
    initialized: false,
    destroyed: false
  };

  var TYPES = ["success", "error", "warning", "info"];

  function clean(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || CONFIG.maxMessageLength);
  }

  function listen(element, eventName, handler) {
    element.addEventListener(eventName, handler);

    state.listeners.push(function () {
      element.removeEventListener(eventName, handler);
    });
  }

  function makeId() {
    state.sequence += 1;

    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "mo-notification-" + Date.now().toString(36) +
      "-" + state.sequence.toString(36);
  }

  function normalizeType(type) {
    type = clean(type, 20).toLowerCase();
    return TYPES.includes(type) ? type : "info";
  }

  function normalizeNotification(input) {
    input = input && typeof input === "object" ? input : {};

    var id = clean(input.id, 150) || makeId();
    var createdAt = input.createdAt || input.date || new Date().toISOString();
    var timestamp = Date.parse(createdAt);

    return {
      id: id,
      title: clean(input.title || input.heading, CONFIG.maxTitleLength),
      message: clean(input.message || input.body || input.description),
      type: normalizeType(input.type || input.severity),
      createdAt: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : new Date().toISOString(),
      read: Boolean(input.read),
      persistent: Boolean(input.persistent),
      duration: normalizeDuration(input.duration),
      link: safeUrl(input.link || input.url),
      linkLabel: clean(input.linkLabel || "View details", 100),
      source: clean(input.source || "MedOrbits", 100)
    };
  }

  function normalizeDuration(value) {
    if (value === 0 || value === false || value === "persistent") {
      return 0;
    }

    var duration = Number(value);

    if (!Number.isFinite(duration) || duration < 0) {
      return CONFIG.defaultDuration;
    }

    return Math.min(duration, CONFIG.maxDuration);
  }

  function safeUrl(value) {
    if (!value) return "";

    try {
      var url = new URL(String(value), window.location.href);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
  }

  function loadReadState() {
    if (!CONFIG.persistReadState) return;

    try {
      var raw = window.localStorage.getItem(CONFIG.storageKey);
      var ids = raw ? JSON.parse(raw) : [];

      if (Array.isArray(ids)) {
        ids.slice(-CONFIG.maxNotifications).forEach(function (id) {
          state.readIds.add(String(id));
        });
      }
    } catch (error) {
      // Storage may be disabled or unavailable.
    }
  }

  function saveReadState() {
    if (!CONFIG.persistReadState) return;

    try {
      window.localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify(Array.from(state.readIds).slice(-CONFIG.maxNotifications))
      );
    } catch (error) {
      // Continue without persistent read state.
    }
  }

  function applyReadState(notification) {
    if (state.readIds.has(notification.id)) {
      notification.read = true;
    }

    if (notification.read) {
      state.readIds.add(notification.id);
    }

    return notification;
  }

  function ensureToastContainer() {
    if (state.toastContainer && state.toastContainer.isConnected) {
      return state.toastContainer;
    }

    var existing = document.querySelector("[data-mo-toast-container]");

    if (existing) {
      state.toastContainer = existing;
      return existing;
    }

    var container = document.createElement("div");
    container.setAttribute("data-mo-toast-container", "");
    container.setAttribute("aria-label", "Notifications");
    container.className = "mo-notification-toasts";

    document.body.appendChild(container);
    state.toastContainer = container;

    return container;
  }

  function ensureLiveRegion() {
    if (state.liveRegion && state.liveRegion.isConnected) {
      return state.liveRegion;
    }

    var existing = document.querySelector("[data-mo-notification-live]");

    if (existing) {
      state.liveRegion = existing;
      return existing;
    }

    var region = document.createElement("div");
    region.setAttribute("data-mo-notification-live", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "mo-notification-visually-hidden";

    document.body.appendChild(region);
    state.liveRegion = region;

    return region;
  }

  function announce(message, urgent) {
    var region = ensureLiveRegion();

    region.setAttribute("aria-live", urgent ? "assertive" : "polite");
    region.textContent = "";

    window.setTimeout(function () {
      if (region.isConnected) {
        region.textContent = clean(message, 500);
      }
    }, 20);
  }

  function createButton(label, action, className) {
    var button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.className = className || "";
    button.addEventListener("click", action);

    return button;
  }

  function renderToast(notification) {
    var container = ensureToastContainer();
    var toast = document.createElement("section");

    toast.className = "mo-notification-toast mo-notification-toast--" +
      notification.type;

    toast.setAttribute("data-notification-id", notification.id);
    toast.setAttribute("role", notification.type === "error" ? "alert" : "status");

    var content = document.createElement("div");
    content.className = "mo-notification-toast__content";

    if (notification.title) {
      var title = document.createElement("strong");
      title.className = "mo-notification-toast__title";
      title.textContent = notification.title;
      content.appendChild(title);
    }

    var message = document.createElement("p");
    message.className = "mo-notification-toast__message";
    message.textContent = notification.message;
    content.appendChild(message);

    if (notification.link) {
      var link = document.createElement("a");
      link.href = notification.link;
      link.textContent = notification.linkLabel;

      if (new URL(notification.link).origin !== window.location.origin) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      content.appendChild(link);
    }

    var dismiss = createButton("Dismiss", function () {
      dismissToast(notification.id);
    }, "mo-notification-toast__dismiss");

    dismiss.setAttribute("aria-label", "Dismiss notification");

    toast.appendChild(content);
    toast.appendChild(dismiss);
    container.appendChild(toast);

    if (notification.duration > 0 && !notification.persistent) {
      var timer = window.setTimeout(function () {
        dismissToast(notification.id);
      }, notification.duration);

      state.timers.set(notification.id, timer);
    }

    return toast;
  }

  function dismissToast(id) {
    var timer = state.timers.get(id);

    if (timer) {
      window.clearTimeout(timer);
      state.timers.delete(id);
    }

    var container = state.toastContainer;

    if (container) {
      var toast = Array.from(
        container.querySelectorAll("[data-notification-id]")
      ).find(function (element) {
        return element.getAttribute("data-notification-id") === String(id);
      });

      if (toast) toast.remove();
    }
  }

  function getNotification(id) {
    return state.notifications.find(function (item) {
      return item.id === String(id);
    }) || null;
  }

  function getUnreadCount() {
    return state.notifications.filter(function (item) {
      return !item.read;
    }).length;
  }

  function updateBadges() {
    var count = getUnreadCount();

    document.querySelectorAll("[data-notification-count]").forEach(function (badge) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = count === 0;
      badge.setAttribute("aria-label", count + " unread notifications");
    });

    document.querySelectorAll("[data-notification-unread-count]").forEach(
      function (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      }
    );
  }

  function renderCenter() {
    var container = document.querySelector("[data-notification-list]");
    if (!container) return;

    container.replaceChildren();

    if (!state.notifications.length) {
      var empty = document.createElement("p");
      empty.className = "mo-notification-empty";
      empty.textContent = "You have no notifications.";
      container.appendChild(empty);
      return;
    }

    state.notifications.slice().reverse().forEach(function (notification) {
      var item = document.createElement("article");

      item.className = "mo-notification-item" +
        (notification.read ? " is-read" : " is-unread");

      item.setAttribute("data-notification-id", notification.id);

      var heading = document.createElement("h3");
      heading.textContent = notification.title || "Notification";
      item.appendChild(heading);

      var message = document.createElement("p");
      message.textContent = notification.message;
      item.appendChild(message);

      var meta = document.createElement("time");
      meta.dateTime = notification.createdAt;

      try {
        meta.textContent = new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(notification.createdAt));
      } catch (error) {
        meta.textContent = notification.createdAt;
      }

      item.appendChild(meta);

      if (notification.link) {
        var link = document.createElement("a");
        link.href = notification.link;
        link.textContent = notification.linkLabel;

        if (new URL(notification.link).origin !== window.location.origin) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }

        item.appendChild(link);
      }

      if (!notification.read) {
        item.appendChild(createButton("Mark as read", function () {
          markRead(notification.id);
        }, "mo-notification-item__read"));
      }

      item.appendChild(createButton("Dismiss", function () {
        remove(notification.id);
      }, "mo-notification-item__dismiss"));

      container.appendChild(item);
    });
  }

  function notify(input, options) {
    if (state.destroyed) return null;

    options = options || {};

    var notification = normalizeNotification(
      typeof input === "string"
        ? {
            message: input,
            type: options.type,
            title: options.title,
            duration: options.duration,
            persistent: options.persistent
          }
        : input
    );

    if (!notification.message && !notification.title) return null;

    var existing = getNotification(notification.id);

    if (existing) {
      Object.assign(existing, notification);
      dismissToast(existing.id);
    } else {
      state.notifications.push(applyReadState(notification));

      if (state.notifications.length > CONFIG.maxNotifications) {
        var removed = state.notifications.shift();
        dismissToast(removed.id);
      }
    }

    if (options.toast !== false) {
      renderToast(notification);
    }

    announce(
      [notification.title, notification.message].filter(Boolean).join(". "),
      notification.type === "error"
    );

    renderCenter();
    updateBadges();

    return notification.id;
  }

  function markRead(id) {
    var notification = getNotification(id);
    if (!notification) return false;

    notification.read = true;
    state.readIds.add(notification.id);

    saveReadState();
    renderCenter();
    updateBadges();

    return true;
  }

  function markAllRead() {
    state.notifications.forEach(function (notification) {
      notification.read = true;
      state.readIds.add(notification.id);
    });

    saveReadState();
    renderCenter();
    updateBadges();

    return true;
  }

  function remove(id) {
    var index = state.notifications.findIndex(function (item) {
      return item.id === String(id);
    });

    if (index < 0) return false;

    var notification = state.notifications[index];

    state.notifications.splice(index, 1);
    state.readIds.delete(notification.id);

    dismissToast(notification.id);
    saveReadState();
    renderCenter();
    updateBadges();

    return true;
  }

  function clearAll() {
    state.notifications.slice().forEach(function (item) {
      dismissToast(item.id);
    });

    state.notifications = [];
    state.readIds.clear();

    saveReadState();
    renderCenter();
    updateBadges();

    return true;
  }

  async function load(url) {
    var dataUrl = safeUrl(url || CONFIG.dataUrl);

    if (!dataUrl) {
      throw new Error("Invalid notifications data URL.");
    }

    var response = await fetch(dataUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    });

    if (!response.ok) {
      throw new Error("Unable to load notifications (HTTP " + response.status + ").");
    }

    var data = await response.json();
    var items = Array.isArray(data)
      ? data
      : data && Array.isArray(data.notifications)
        ? data.notifications
        : null;

    if (!items) {
      throw new Error("Notifications data must be an array or contain a notifications array.");
    }

    items.slice(0, CONFIG.maxNotifications).forEach(function (item) {
      var notification = applyReadState(normalizeNotification(item));

      if (!getNotification(notification.id)) {
        state.notifications.push(notification);
      }
    });

    state.notifications = state.notifications.slice(-CONFIG.maxNotifications);

    renderCenter();
    updateBadges();

    return state.notifications.slice();
  }

  function refresh() {
    if (state.destroyed) return;

    ensureLiveRegion();
    updateBadges();
    renderCenter();

    document.querySelectorAll("[data-notification-toast]").forEach(function (button) {
      if (button.hasAttribute("data-mo-notification-bound")) return;

      button.setAttribute("data-mo-notification-bound", "true");

      button.addEventListener("click", function () {
        var type = button.getAttribute("data-notification-type") || "info";
        var title = button.getAttribute("data-notification-title") || "";
        var message = button.getAttribute("data-notification-message") || "";

        notify({
          type: type,
          title: title,
          message: message
        });
      });
    });
  }

  function bindCenterControls() {
    document.querySelectorAll("[data-notification-mark-all-read]").forEach(
      function (button) {
        listen(button, "click", markAllRead);
      }
    );

    document.querySelectorAll("[data-notification-clear-all]").forEach(
      function (button) {
        listen(button, "click", clearAll);
      }
    );
  }

  function injectStyles() {
    if (document.getElementById("mo-notification-styles")) return;

    var style = document.createElement("style");
    style.id = "mo-notification-styles";
    style.textContent =
      ".mo-notification-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}";

    document.head.appendChild(style);
    state.styleElement = style;
  }

  function init() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;

    loadReadState();
    injectStyles();
    ensureToastContainer();
    ensureLiveRegion();
    bindCenterControls();
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && (
                  node.matches("[data-notification-toast]") ||
                  node.matches("[data-notification-list]") ||
                  node.matches("[data-notification-count]")
                )) ||
                (node.querySelector && (
                  node.querySelector("[data-notification-toast]") ||
                  node.querySelector("[data-notification-list]") ||
                  node.querySelector("[data-notification-count]")
                ))
              );
          });
        });

        if (shouldRefresh) {
          bindCenterControls();
          refresh();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function destroy() {
    if (state.destroyed) return;

    if (state.observer) state.observer.disconnect();

    state.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.timers.forEach(function (timer) {
      window.clearTimeout(timer);
    });

    state.timers.clear();

    if (state.toastContainer &&
        state.toastContainer.hasAttribute("data-mo-created")) {
      state.toastContainer.remove();
    }

    if (state.liveRegion &&
        state.liveRegion.hasAttribute("data-mo-created")) {
      state.liveRegion.remove();
    }

    if (state.styleElement) state.styleElement.remove();

    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    notify: notify,
    success: function (message, title, options) {
      return notify({
        type: "success",
        message: message,
        title: title,
        duration: options && options.duration
      }, options);
    },
    error: function (message, title, options) {
      return notify({
        type: "error",
        message: message,
        title: title,
        duration: options && options.duration
      }, options);
    },
    warning: function (message, title, options) {
      return notify({
        type: "warning",
        message: message,
        title: title,
        duration: options && options.duration
      }, options);
    },
    info: function (message, title, options) {
      return notify({
        type: "info",
        message: message,
        title: title,
        duration: options && options.duration
      }, options);
    },
    load: load,
    refresh: refresh,
    markRead: markRead,
    markAllRead: markAllRead,
    remove: remove,
    clear: clearAll,
    getAll: function () {
      return state.notifications.slice();
    },
    getUnreadCount: getUnreadCount,
    configure: function (options) {
      options = options || {};

      if (typeof options.dataUrl === "string") {
        CONFIG.dataUrl = options.dataUrl;
      }

      if (Number.isInteger(options.maxNotifications) &&
          options.maxNotifications > 0) {
        CONFIG.maxNotifications = Math.min(options.maxNotifications, 500);
      }

      if (Number.isFinite(options.defaultDuration) &&
          options.defaultDuration >= 0) {
        CONFIG.defaultDuration = Math.min(
          options.defaultDuration,
          CONFIG.maxDuration
        );
      }

      if (typeof options.persistReadState === "boolean") {
        CONFIG.persistReadState = options.persistReadState;
      }
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsNotifications = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
