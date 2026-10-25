
/* =========================================================
   MEDORBITS | MODAL & DIALOG CONTROLLER
   File: assets/js/modal.js
   Version: 1.0.0
   Dependencies: None
   Namespace: window.MedOrbitsModal
   ========================================================= */

(function (window, document) {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_MODAL_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    modalSelector: "[data-mo-modal]",
    openSelector: "[data-modal-open]",
    closeSelector: "[data-modal-close]",
    duration: 180,
    closeOnBackdrop: true,
    closeOnEscape: true,
    trapFocus: true,
    lockScroll: true,
    restoreFocus: true,
    preventBackgroundInteraction: true
  };

  var state = {
    options: Object.assign({}, DEFAULTS),
    modals: new Map(),
    listeners: [],
    observer: null,
    activeModal: null,
    previousFocus: null,
    previousBodyOverflow: "",
    scrollLockCount: 0,
    started: false
  };

  var FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  /* ---------------------------------------------------------
     HELPERS
     --------------------------------------------------------- */

  function query(selector, root) {
    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function queryAll(selector, root) {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function listen(target, eventName, callback, options) {
    if (!target || !target.addEventListener) {
      return function () {};
    }

    target.addEventListener(eventName, callback, options || false);

    var active = true;

    function remove() {
      if (!active) return;
      target.removeEventListener(eventName, callback, options || false);
      active = false;
    }

    state.listeners.push(remove);

    return remove;
  }

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function getModalById(id) {
    if (!id) return null;

    var modal = document.getElementById(id);

    if (!modal || !modal.matches(state.options.modalSelector)) {
      return null;
    }

    return modal;
  }

  function getModalFromTrigger(trigger) {
    var target = trigger.getAttribute("data-modal-open");

    if (!target) return null;

    target = target.trim();

    if (target.charAt(0) === "#") {
      target = target.slice(1);
    }

    return getModalById(target);
  }

  function getFocusableElements(modal) {
    return queryAll(FOCUSABLE_SELECTOR, modal).filter(function (element) {
      if (element.hidden || element.closest("[hidden], [inert]")) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;

      var style = window.getComputedStyle(element);

      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0;
    });
  }

  function dispatch(modal, eventName, detail) {
    modal.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      detail: detail || {}
    }));
  }

  function getDuration(modal) {
    if (prefersReducedMotion()) return 0;

    var value = Number(modal.getAttribute("data-modal-duration"));

    if (Number.isFinite(value) && value >= 0) {
      return Math.min(value, 3000);
    }

    return state.options.duration;
  }

  function safeFocus(element) {
    if (!element || typeof element.focus !== "function") return;

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  /* ---------------------------------------------------------
     SCROLL LOCK
     --------------------------------------------------------- */

  function lockScroll() {
    if (!state.options.lockScroll) return;

    if (state.scrollLockCount === 0) {
      state.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    state.scrollLockCount += 1;
  }

  function unlockScroll() {
    if (!state.options.lockScroll) return;

    state.scrollLockCount = Math.max(0, state.scrollLockCount - 1);

    if (state.scrollLockCount === 0) {
      document.body.style.overflow = state.previousBodyOverflow;
    }
  }

  /* ---------------------------------------------------------
     BACKGROUND INTERACTION
     --------------------------------------------------------- */

  function setBackgroundInert(modal, inert) {
    if (!state.options.preventBackgroundInteraction) return;

    Array.from(document.body.children).forEach(function (element) {
      if (element === modal || element.contains(modal)) return;
      if (element.hasAttribute("data-mo-modal-utility")) return;

      if (inert) {
        if (!element.hasAttribute("data-mo-original-inert")) {
          element.setAttribute(
            "data-mo-original-inert",
            element.inert ? "true" : "false"
          );
        }

        element.inert = true;
      } else {
        var original = element.getAttribute("data-mo-original-inert");

        if (original !== null) {
          element.inert = original === "true";
          element.removeAttribute("data-mo-original-inert");
        }
      }
    });
  }

  /* ---------------------------------------------------------
     MODAL PREPARATION
     --------------------------------------------------------- */

  function prepareModal(modal) {
    if (!modal || state.modals.has(modal)) return;

    var record = {
      originalRole: modal.getAttribute("role"),
      originalAriaModal: modal.getAttribute("aria-modal"),
      originalAriaHidden: modal.getAttribute("aria-hidden"),
      originalTabindex: modal.getAttribute("tabindex"),
      originalHidden: modal.hidden,
      originalInert: modal.inert,
      originalStyle: modal.getAttribute("style"),
      isOpen: false,
      opener: null,
      timer: null,
      closeListener: null,
      backdropListener: null
    };

    if (!modal.hasAttribute("role")) {
      modal.setAttribute("role", "dialog");
    }

    if (!modal.hasAttribute("aria-modal")) {
      modal.setAttribute("aria-modal", "true");
    }

    if (!modal.hasAttribute("tabindex")) {
      modal.setAttribute("tabindex", "-1");
    }

    modal.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    modal.inert = true;

    state.modals.set(modal, record);

    record.closeListener = function (event) {
      var button = event.target.closest(state.options.closeSelector);

      if (button && modal.contains(button)) {
        event.preventDefault();
        close(modal);
      }
    };

    record.backdropListener = function (event) {
      if (!state.options.closeOnBackdrop) return;

      if (event.target === modal ||
          event.target.hasAttribute("data-modal-backdrop")) {
        close(modal);
      }
    };

    modal.addEventListener("click", record.closeListener);
    modal.addEventListener("click", record.backdropListener);
  }

  /* ---------------------------------------------------------
     OPEN MODAL
     --------------------------------------------------------- */

  function open(target, options) {
    options = options || {};

    var modal = typeof target === "string"
      ? getModalById(target.replace(/^#/, ""))
      : target;

    if (!modal || !modal.matches(state.options.modalSelector)) {
      return false;
    }

    prepareModal(modal);

    var record = state.modals.get(modal);

    if (!record || record.isOpen) return true;

    if (state.activeModal && state.activeModal !== modal) {
      close(state.activeModal, { restoreFocus: false });
    }

    record.opener = options.trigger ||
      document.activeElement;

    state.previousFocus = record.opener;
    state.activeModal = modal;
    record.isOpen = true;

    if (record.timer) {
      window.clearTimeout(record.timer);
      record.timer = null;
    }

    lockScroll();
    setBackgroundInert(modal, true);

    modal.hidden = false;
    modal.inert = false;
    modal.setAttribute("aria-hidden", "false");
    modal.setAttribute("data-modal-state", "opening");

    // Force layout so opening transitions can run.
    void modal.offsetWidth;

    modal.setAttribute("data-modal-state", "open");

    dispatch(modal, "medorbits:modalopen", {
      modal: modal
    });

    var autofocus = query("[autofocus], [data-modal-autofocus]", modal);
    var focusable = getFocusableElements(modal);
    var focusTarget = autofocus || focusable[0] || modal;

    if (options.focus !== false) {
      window.requestAnimationFrame(function () {
        if (record.isOpen) safeFocus(focusTarget);
      });
    }

    return true;
  }

  /* ---------------------------------------------------------
     CLOSE MODAL
     --------------------------------------------------------- */

  function close(target, options) {
    options = options || {};

    var modal = typeof target === "string"
      ? getModalById(target.replace(/^#/, ""))
      : target || state.activeModal;

    if (!modal) return false;

    var record = state.modals.get(modal);

    if (!record || !record.isOpen) return false;

    record.isOpen = false;

    if (record.timer) {
      window.clearTimeout(record.timer);
      record.timer = null;
    }

    modal.setAttribute("data-modal-state", "closing");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;

    var duration = getDuration(modal);

    record.timer = window.setTimeout(function () {
      if (record.isOpen) return;

      modal.hidden = true;
      modal.setAttribute("data-modal-state", "closed");
      record.timer = null;

      if (state.activeModal === modal) {
        state.activeModal = null;
        setBackgroundInert(modal, false);
      }

      unlockScroll();

      dispatch(modal, "medorbits:modalclose", {
        modal: modal
      });

      var shouldRestore = options.restoreFocus !== false &&
        state.options.restoreFocus;

      if (shouldRestore && record.opener && record.opener.isConnected) {
        safeFocus(record.opener);
      }
    }, duration);

    return true;
  }

  function closeActive(options) {
    return close(state.activeModal, options);
  }

  /* ---------------------------------------------------------
     KEYBOARD ACCESSIBILITY
     --------------------------------------------------------- */

  function handleKeydown(event) {
    var modal = state.activeModal;

    if (!modal) return;

    if (event.key === "Escape" && state.options.closeOnEscape) {
      event.preventDefault();
      close(modal);
      return;
    }

    if (event.key !== "Tab" || !state.options.trapFocus) return;

    var focusable = getFocusableElements(modal);

    if (!focusable.length) {
      event.preventDefault();
      safeFocus(modal);
      return;
    }

    var firstElement = focusable[0];
    var lastElement = focusable[focusable.length - 1];

    if (event.shiftKey && (
      document.activeElement === firstElement ||
      !modal.contains(document.activeElement)
    )) {
      event.preventDefault();
      safeFocus(lastElement);
    } else if (!event.shiftKey && (
      document.activeElement === lastElement ||
      !modal.contains(document.activeElement)
    )) {
      event.preventDefault();
      safeFocus(firstElement);
    }
  }

  function handleTriggerClick(event) {
    var trigger = event.target.closest(state.options.openSelector);

    if (!trigger) return;

    var modal = getModalFromTrigger(trigger);

    if (!modal) return;

    event.preventDefault();

    open(modal, {
      trigger: trigger
    });
  }

  function handleDocumentFocus(event) {
    if (!state.options.trapFocus || !state.activeModal) return;

    if (!state.activeModal.contains(event.target)) {
      var focusable = getFocusableElements(state.activeModal);

      safeFocus(focusable[0] || state.activeModal);
    }
  }

  /* ---------------------------------------------------------
     CONFIRMATION DIALOG
     --------------------------------------------------------- */

  function confirm(message, options) {
    options = options || {};

    return new Promise(function (resolve) {
      var existing = query("[data-mo-confirm-dialog]");

      if (existing) existing.remove();

      var dialog = document.createElement("section");
      var panel = document.createElement("div");
      var heading = document.createElement("h2");
      var description = document.createElement("p");
      var actions = document.createElement("div");
      var cancelButton = document.createElement("button");
      var confirmButton = document.createElement("button");

      var id = "mo-confirm-" + Math.random().toString(36).slice(2, 10);
      heading.id = id + "-title";
      description.id = id + "-description";

      dialog.id = id;
      dialog.setAttribute("data-mo-modal", "");
      dialog.setAttribute("data-mo-confirm-dialog", "");
      dialog.setAttribute("data-mo-modal-utility", "");
      dialog.setAttribute("aria-labelledby", heading.id);
      dialog.setAttribute("aria-describedby", description.id);

      panel.setAttribute("data-modal-backdrop", "");
      panel.className = "mo-modal-panel";

      heading.textContent = options.title || "Confirm action";
      description.textContent = String(message || "Are you sure?");

      cancelButton.type = "button";
      cancelButton.textContent = options.cancelText || "Cancel";
      cancelButton.setAttribute("data-modal-close", "");

      confirmButton.type = "button";
      confirmButton.textContent = options.confirmText || "Confirm";
      confirmButton.className = options.danger
        ? "mo-modal-confirm-danger"
        : "mo-modal-confirm";

      actions.className = "mo-modal-actions";
      actions.append(cancelButton, confirmButton);
      panel.append(heading, description, actions);
      dialog.appendChild(panel);
      document.body.appendChild(dialog);

      var resolved = false;

      function finish(result) {
        if (resolved) return;
        resolved = true;

        dialog.removeEventListener("medorbits:modalclose", onClose);
        close(dialog, { restoreFocus: false });

        var record = state.modals.get(dialog);

        if (record) {
          if (record.closeListener) {
            dialog.removeEventListener("click", record.closeListener);
          }

          if (record.backdropListener) {
            dialog.removeEventListener("click", record.backdropListener);
          }

          if (record.timer) window.clearTimeout(record.timer);

          state.modals.delete(dialog);
        }

        window.setTimeout(function () {
          dialog.remove();
        }, getDuration(dialog));

        resolve(result);
      }

      function onClose() {
        finish(false);
      }

      dialog.addEventListener("medorbits:modalclose", onClose);

      listen(confirmButton, "click", function () {
        finish(true);
      });

      prepareModal(dialog);
      open(dialog, {
        trigger: document.activeElement
      });

      // Escape and backdrop closing resolve as cancellation.
      listen(dialog, "medorbits:modalclose", onClose);
    });
  }

  /* ---------------------------------------------------------
     LIFECYCLE
     --------------------------------------------------------- */

  function refresh() {
    queryAll(state.options.modalSelector).forEach(prepareModal);
    return api;
  }

  function configure(options) {
    options = options || {};

    Object.keys(options).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        state.options[key] = options[key];
      }
    });

    return Object.assign({}, state.options);
  }

  function init(options) {
    if (options) configure(options);

    refresh();

    if (state.started) return api;

    state.started = true;

    listen(document, "click", handleTriggerClick);
    listen(document, "keydown", handleKeydown);
    listen(document, "focusin", handleDocumentFocus);

    if ("MutationObserver" in window && document.documentElement) {
      state.observer = new MutationObserver(function (mutations) {
        if (mutations.some(function (mutation) {
          return mutation.addedNodes.length > 0;
        })) {
          refresh();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    Array.from(state.modals.entries()).forEach(function (entry) {
      var modal = entry[0];
      var record = entry[1];

      if (record.timer) window.clearTimeout(record.timer);

      modal.removeEventListener("click", record.closeListener);
      modal.removeEventListener("click", record.backdropListener);

      modal.hidden = record.originalHidden;
      modal.inert = record.originalInert;

      restoreAttribute(modal, "role", record.originalRole);
      restoreAttribute(modal, "aria-modal", record.originalAriaModal);
      restoreAttribute(modal, "aria-hidden", record.originalAriaHidden);
      restoreAttribute(modal, "tabindex", record.originalTabindex);
      restoreAttribute(modal, "style", record.originalStyle);

      modal.removeAttribute("data-modal-state");
    });

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.modals.clear();
    state.activeModal = null;
    state.scrollLockCount = 0;

    if (document.body) {
      document.body.style.overflow = state.previousBodyOverflow;
    }

    Array.from(document.body.children).forEach(function (element) {
      var original = element.getAttribute("data-mo-original-inert");

      if (original !== null) {
        element.inert = original === "true";
        element.removeAttribute("data-mo-original-inert");
      }
    });

    state.started = false;
  }

  function restoreAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  var api = {
    version: "1.0.0",
    init: init,
    refresh: refresh,
    configure: configure,
    open: open,
    close: close,
    closeActive: closeActive,
    confirm: confirm,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsModal = api;

  function start() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
