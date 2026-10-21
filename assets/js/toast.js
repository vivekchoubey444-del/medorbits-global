
/* =========================================================
   MedOrbits -- Toast Notification System
   File: /assets/js/toast.js
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsToast) return;

  const CONFIG = window.MedOrbitsConfig || {};

  const DEFAULTS = Object.freeze({
    duration: 4000,
    position: CONFIG.TOAST_POSITION || "top-right",
    maxVisible: 5,
    closeButton: true,
    pauseOnHover: true
  });

  const TYPES = Object.freeze([
    "success", "error", "warning", "info", "loading"
  ]);

  const ICONS = Object.freeze({
    success: "✓",
    error: "✕",
    warning: "!",
    info: "i",
    loading: "…"
  });

  const EVENTS = Object.freeze({
    SHOW: "medorbits:toast:show",
    HIDE: "medorbits:toast:hide",
    CLEAR: "medorbits:toast:clear"
  });

  const activeToasts = new Map();
  const containers = new Map();
  let toastCounter = 0;

  const utils = {
    emit(name, detail = {}) {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    },

    normalizeType(type) {
      type = String(type || "info").toLowerCase();
      return TYPES.includes(type) ? type : "info";
    },

    normalizePosition(position) {
      const allowed = [
        "top-right", "top-left", "top-center",
        "bottom-right", "bottom-left", "bottom-center"
      ];

      return allowed.includes(position)
        ? position
        : DEFAULTS.position;
    },

    normalizeOptions(message, options = {}) {
      if (message && typeof message === "object" && !Array.isArray(message)) {
        options = message;
        message = options.message ?? options.title ?? "";
      }

      const duration = options.duration === undefined
        ? DEFAULTS.duration
        : Math.max(0, Number(options.duration) || 0);

      return {
        message: String(message ?? ""),
        title: String(options.title || ""),
        type: this.normalizeType(options.type),
        duration,
        position: this.normalizePosition(options.position || DEFAULTS.position),
        closeButton: options.closeButton === undefined
          ? DEFAULTS.closeButton
          : Boolean(options.closeButton),
        pauseOnHover: options.pauseOnHover === undefined
          ? DEFAULTS.pauseOnHover
          : Boolean(options.pauseOnHover),
        dismissible: options.dismissible !== false,
        id: options.id ? String(options.id) : "",
        onClick: typeof options.onClick === "function" ? options.onClick : null,
        onClose: typeof options.onClose === "function" ? options.onClose : null,
        actionLabel: options.actionLabel ? String(options.actionLabel) : "",
        onAction: typeof options.onAction === "function" ? options.onAction : null
      };
    }
  };

  function ensureStyles() {
    if (document.getElementById("medorbits-toast-styles")) return;

    const style = document.createElement("style");
    style.id = "medorbits-toast-styles";
    style.textContent = `
      .mo-toast-container {
        position: fixed;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(390px, calc(100vw - 32px));
        max-height: calc(100vh - 32px);
        overflow-y: auto;
        padding: 4px;
        box-sizing: border-box;
        pointer-events: none;
      }
      .mo-toast-container[data-position="top-right"] { top: 12px; right: 12px; }
      .mo-toast-container[data-position="top-left"] { top: 12px; left: 12px; }
      .mo-toast-container[data-position="bottom-right"] { right: 12px; bottom: 12px; }
      .mo-toast-container[data-position="bottom-left"] { left: 12px; bottom: 12px; }
      .mo-toast-container[data-position="top-center"] {
        top: 12px; left: 50%; transform: translateX(-50%);
      }
      .mo-toast-container[data-position="bottom-center"] {
        bottom: 12px; left: 50%; transform: translateX(-50%);
      }
      .mo-toast {
        --mo-toast-accent: #b99a63;
        position: relative;
        display: grid;
        grid-template-columns: 30px minmax(0, 1fr) auto;
        gap: 10px;
        align-items: start;
        padding: 14px;
        color: #f5efe6;
        background: #211b24;
        border: 1px solid rgba(207,176,121,.24);
        border-left: 3px solid var(--mo-toast-accent);
        border-radius: 12px;
        box-shadow: 0 12px 35px rgba(0,0,0,.25);
        font-family: inherit;
        pointer-events: auto;
        overflow-wrap: anywhere;
        box-sizing: border-box;
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .mo-toast.is-visible { opacity: 1; transform: translateY(0); }
      .mo-toast.is-leaving { opacity: 0; transform: translateY(-8px); }
      .mo-toast--success { --mo-toast-accent: #35b887; }
      .mo-toast--error { --mo-toast-accent: #e16b72; }
      .mo-toast--warning { --mo-toast-accent: #e6b45f; }
      .mo-toast--info { --mo-toast-accent: #77a9e8; }
      .mo-toast--loading { --mo-toast-accent: #b79add; }
      .mo-toast__icon {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        color: var(--mo-toast-accent);
        background: color-mix(in srgb, var(--mo-toast-accent) 15%, transparent);
        font-weight: 700;
      }
      .mo-toast__content { min-width: 0; }
      .mo-toast__title {
        margin: 0 0 4px;
        color: #f7e7c6;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
      }
      .mo-toast__message {
        margin: 0;
        color: #ded5df;
        font-size: 13px;
        line-height: 1.55;
        white-space: pre-wrap;
      }
      .mo-toast__close {
        display: grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
        color: #d6cbd8;
        background: transparent;
        border: 0;
        border-radius: 6px;
        cursor: pointer;
        font-size: 19px;
      }
      .mo-toast__close:hover { background: rgba(255,255,255,.09); }
      .mo-toast__action {
        grid-column: 2 / 4;
        justify-self: start;
        margin-top: 3px;
        padding: 7px 11px;
        color: #f7e7c6;
        background: rgba(207,176,121,.12);
        border: 1px solid rgba(207,176,121,.3);
        border-radius: 7px;
        cursor: pointer;
        font: inherit;
        font-size: 12px;
      }
      .mo-toast__progress {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--mo-toast-accent);
        transform-origin: left;
        animation: mo-toast-progress linear forwards;
        opacity: .75;
      }
      .mo-toast--loading .mo-toast__icon {
        animation: mo-toast-spin 1.2s linear infinite;
      }
      @keyframes mo-toast-progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
      @keyframes mo-toast-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .mo-toast, .mo-toast__icon { transition: none; animation: none; }
      }
      @media (max-width: 480px) {
        .mo-toast-container { width: calc(100vw - 20px); }
        .mo-toast-container[data-position^="top-"] {
          top: 8px; right: 10px; left: 10px;
        }
        .mo-toast-container[data-position^="bottom-"] {
          right: 10px; bottom: 8px; left: 10px;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  function getContainer(position) {
    position = utils.normalizePosition(position);

    const existing = containers.get(position);
    if (existing?.isConnected) return existing;

    ensureStyles();

    const container = document.createElement("div");
    container.className = "mo-toast-container";
    container.dataset.position = position;
    container.setAttribute("aria-label", "Notifications");
    container.setAttribute("role", "region");
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-relevant", "additions text");

    (document.body || document.documentElement).appendChild(container);
    containers.set(position, container);

    return container;
  }

  function clearTimer(toast) {
    if (toast.timer) {
      window.clearTimeout(toast.timer);
      toast.timer = null;
    }
  }

  function removeToast(id, reason = "dismissed") {
    const toast = activeToasts.get(id);
    if (!toast || toast.removing) return false;

    toast.removing = true;
    clearTimer(toast);

    const element = toast.element;

    function finish() {
      if (toast.finished) return;
      toast.finished = true;

      element.remove();
      activeToasts.delete(id);

      utils.emit(EVENTS.HIDE, {
        id,
        type: toast.options.type,
        reason
      });

      try {
        toast.options.onClose?.(reason);
      } catch (error) {
        console.error("[MedOrbits Toast] onClose failed.", error);
      }
    }

    element.classList.remove("is-visible");
    element.classList.add("is-leaving");
    element.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, 300);

    return true;
  }

  function startTimer(toast, duration) {
    clearTimer(toast);

    if (duration <= 0 || toast.paused || toast.removing) return;

    toast.remaining = duration;
    toast.startedAt = Date.now();

    toast.timer = window.setTimeout(() => {
      removeToast(toast.id, "timeout");
    }, duration);

    const progress = toast.element.querySelector(".mo-toast__progress");

    if (progress) {
      progress.style.animationDuration = `${duration}ms`;
      progress.style.animationPlayState = "running";
    }
  }

  function pauseTimer(toast) {
    if (
      !toast.options.pauseOnHover ||
      !toast.timer ||
      toast.paused ||
      toast.removing
    ) return;

    toast.remaining = Math.max(
      0,
      toast.remaining - (Date.now() - toast.startedAt)
    );

    clearTimer(toast);
    toast.paused = true;

    const progress = toast.element.querySelector(".mo-toast__progress");
    if (progress) progress.style.animationPlayState = "paused";
  }

  function resumeTimer(toast) {
    if (!toast.paused || toast.removing) return;

    toast.paused = false;

    if (toast.remaining > 0) {
      startTimer(toast, toast.remaining);
    } else {
      removeToast(toast.id, "timeout");
    }
  }

  function updateContent(toast, options) {
    toast.options.message = options.message;
    toast.options.title = options.title;

    const content = toast.element.querySelector(".mo-toast__content");
    content.replaceChildren();

    if (options.title) {
      const title = document.createElement("p");
      title.className = "mo-toast__title";
      title.textContent = options.title;
      content.appendChild(title);
    }

    const body = document.createElement("p");
    body.className = "mo-toast__message";
    body.textContent = options.message;
    content.appendChild(body);
  }

  function createToast(message, options) {
    const settings = utils.normalizeOptions(message, options);

    if (!settings.message && !settings.title) return null;

    if (settings.id && activeToasts.has(settings.id)) {
      const existing = activeToasts.get(settings.id);
      updateContent(existing, settings);

      if (settings.type !== existing.options.type) {
        existing.element.classList.remove(
          `mo-toast--${existing.options.type}`
        );
        existing.element.classList.add(`mo-toast--${settings.type}`);

        existing.element.querySelector(".mo-toast__icon").textContent =
          ICONS[settings.type];

        existing.element.setAttribute(
          "role",
          settings.type === "error" ? "alert" : "status"
        );

        existing.options.type = settings.type;
      }

      if (settings.duration > 0 && settings.type !== "loading") {
        existing.options.duration = settings.duration;
        startTimer(existing, settings.duration);
      } else {
        clearTimer(existing);
      }

      return settings.id;
    }

    const id = settings.id || `mo-toast-${++toastCounter}`;
    const container = getContainer(settings.position);
    const maxVisible = Math.max(1, Number(DEFAULTS.maxVisible) || 5);

    while (container.children.length >= maxVisible) {
      const oldest = container.firstElementChild;
      if (!oldest) break;

      const oldestId = oldest.dataset.toastId;

      if (oldestId) {
        removeToast(oldestId, "limit");
      } else {
        oldest.remove();
      }

      // Remove synchronously to enforce the visible-toast limit.
      if (oldest.parentNode) oldest.remove();
    }

    const element = document.createElement("div");
    element.className = `mo-toast mo-toast--${settings.type}`;
    element.dataset.toastId = id;
    element.setAttribute(
      "role",
      settings.type === "error" ? "alert" : "status"
    );
    element.setAttribute("aria-atomic", "true");

    const icon = document.createElement("span");
    icon.className = "mo-toast__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ICONS[settings.type];

    const content = document.createElement("div");
    content.className = "mo-toast__content";

    if (settings.title) {
      const title = document.createElement("p");
      title.className = "mo-toast__title";
      title.textContent = settings.title;
      content.appendChild(title);
    }

    const body = document.createElement("p");
    body.className = "mo-toast__message";
    body.textContent = settings.message;
    content.appendChild(body);

    element.append(icon, content);

    if (settings.closeButton && settings.dismissible) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "mo-toast__close";
      close.setAttribute("aria-label", "Dismiss notification");
      close.textContent = "×";
      close.addEventListener("click", () => removeToast(id, "dismissed"));
      element.appendChild(close);
    } else {
      const spacer = document.createElement("span");
      spacer.setAttribute("aria-hidden", "true");
      element.appendChild(spacer);
    }

    if (settings.actionLabel && settings.onAction) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "mo-toast__action";
      action.textContent = settings.actionLabel;

      action.addEventListener("click", () => {
        try {
          settings.onAction();
        } catch (error) {
          console.error("[MedOrbits Toast] action failed.", error);
        } finally {
          removeToast(id, "action");
        }
      });

      element.appendChild(action);
    }

    if (settings.duration > 0 && settings.type !== "loading") {
      const progress = document.createElement("span");
      progress.className = "mo-toast__progress";
      progress.setAttribute("aria-hidden", "true");
      element.appendChild(progress);
    }

    if (settings.onClick) {
      element.addEventListener("click", (event) => {
        if (event.target.closest("button")) return;

        try {
          settings.onClick();
        } catch (error) {
          console.error("[MedOrbits Toast] click handler failed.", error);
        }
      });
    }

    const toast = {
      id,
      element,
      options: settings,
      timer: null,
      startedAt: 0,
      remaining: settings.duration,
      paused: false,
      removing: false,
      finished: false
    };

    if (settings.pauseOnHover) {
      element.addEventListener("mouseenter", () => pauseTimer(toast));
      element.addEventListener("mouseleave", () => resumeTimer(toast));
      element.addEventListener("focusin", () => pauseTimer(toast));

      element.addEventListener("focusout", (event) => {
        if (!element.contains(event.relatedTarget)) {
          resumeTimer(toast);
        }
      });
    }

    activeToasts.set(id, toast);
    container.appendChild(element);

    window.requestAnimationFrame(() => {
      if (!toast.removing) element.classList.add("is-visible");
    });

    if (settings.duration > 0 && settings.type !== "loading") {
      startTimer(toast, settings.duration);
    }

    utils.emit(EVENTS.SHOW, {
      id,
      type: settings.type,
      message: settings.message
    });

    return id;
  }

  function show(message, options) {
    return createToast(message, options);
  }

  function withType(type, message, options = {}) {
    return show(message, { ...options, type });
  }

  function update(id, message, options = {}) {
    const toast = activeToasts.get(String(id));

    if (!toast) {
      return show(message, { ...options, id: String(id) });
    }

    const next = utils.normalizeOptions(message, {
      ...toast.options,
      ...options,
      id: String(id)
    });

    updateContent(toast, next);

    if (next.type !== toast.options.type) {
      toast.element.classList.remove(`mo-toast--${toast.options.type}`);
      toast.element.classList.add(`mo-toast--${next.type}`);
      toast.element.querySelector(".mo-toast__icon").textContent =
        ICONS[next.type];
      toast.element.setAttribute(
        "role",
        next.type === "error" ? "alert" : "status"
      );
    }

    toast.options = next;

    if (next.duration > 0 && next.type !== "loading") {
      startTimer(toast, next.duration);
    } else {
      clearTimer(toast);
    }

    return toast.id;
  }

  function dismiss(id) {
    return removeToast(String(id), "dismissed");
  }

  function dismissAll() {
    Array.from(activeToasts.keys()).forEach((id) => {
      removeToast(id, "clear");
    });

    utils.emit(EVENTS.CLEAR, {});
  }

  function loading(message, options = {}) {
    return show(message || "Please wait…", {
      ...options,
      type: "loading",
      duration: 0,
      closeButton: options.closeButton ?? false
    });
  }

  function promise(promiseOrFunction, messages = {}, options = {}) {
    const toastId = loading(
      messages.loading || "Please wait…",
      { ...options, id: options.id || "" }
    );

    let task;

    try {
      task = typeof promiseOrFunction === "function"
        ? promiseOrFunction()
        : promiseOrFunction;
    } catch (error) {
      dismiss(toastId);
      show(messages.error || error?.message || "Something went wrong.", {
        ...options,
        type: "error"
      });
      return Promise.reject(error);
    }

    return Promise.resolve(task).then(
      (result) => {
        dismiss(toastId);

        if (messages.success) {
          show(messages.success, { ...options, type: "success" });
        }

        return result;
      },
      (error) => {
        dismiss(toastId);

        show(
          messages.error ||
          error?.message ||
          "Something went wrong. Please try again.",
          { ...options, type: "error" }
        );

        throw error;
      }
    );
  }

  function bindDataAttributes() {
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;

      const trigger = event.target.closest("[data-toast-message]");
      if (!trigger) return;

      show(trigger.getAttribute("data-toast-message"), {
        type: trigger.getAttribute("data-toast-type") || "info",
        title: trigger.getAttribute("data-toast-title") || "",
        duration: Number(trigger.getAttribute("data-toast-duration")) ||
          DEFAULTS.duration
      });
    });
  }

  const api = Object.freeze({
    show,
    success: (message, options) => withType("success", message, options),
    error: (message, options) => withType("error", message, options),
    warning: (message, options) => withType("warning", message, options),
    info: (message, options) => withType("info", message, options),
    loading,
    update,
    dismiss,
    dismissAll,
    promise,
    getActive: () => Array.from(activeToasts.keys()),
    events: EVENTS
  });

  window.MedOrbitsToast = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Toast = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDataAttributes, {
      once: true
    });
  } else {
    bindDataAttributes();
  }
})(window, document);
