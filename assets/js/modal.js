
/* =========================================================
   MedOrbits -- Modal Manager
   File: /assets/js/modal.js
   Purpose: Accessible modals, dialogs, confirmations, focus
   Version: 1.1.0
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsModal) return;

  const state = {
    stack: [],
    initialized: false,
    previousBodyOverflow: "",
    generatedId: 0,
    backgroundState: new Map(),
    listeners: []
  };

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "button:not([disabled])",
    "iframe",
    "object",
    "embed",
    "[contenteditable='true']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

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
        "medorbits:modal:" + name,
        { detail }
      ));
    },

    getElement(target) {
      if (!target) return null;

      if (target instanceof Element) return target;

      if (typeof target === "string") {
        try {
          return document.querySelector(target);
        } catch (_) {
          return null;
        }
      }

      return null;
    },

    getFocusable(modal) {
      if (!modal) return [];

      return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((element) => {
          if (
            element.hidden ||
            element.disabled ||
            element.getAttribute("aria-hidden") === "true" ||
            element.closest("[hidden], [inert], [aria-hidden='true']")
          ) {
            return false;
          }

          return element.getClientRects().length > 0;
        });
    },

    createId(prefix = "mo-modal") {
      state.generatedId += 1;

      return `${prefix}-${Date.now().toString(36)}-${state.generatedId}`;
    },

    safeFocus(element) {
      if (!element || typeof element.focus !== "function") return;

      try {
        element.focus({ preventScroll: true });
      } catch (_) {
        element.focus();
      }
    },

    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      state.listeners.push({ target, type, handler, options });
    }
  };

  function getModal(target) {
    const element = utils.getElement(target);

    if (!element) return null;

    if (element.matches("[data-modal], .modal, [role='dialog'], [role='alertdialog']")) {
      return element;
    }

    return element.closest(
      "[data-modal], .modal, [role='dialog'], [role='alertdialog']"
    );
  }

  function getEntry(modal) {
    return state.stack.find((entry) => entry.modal === modal) || null;
  }

  function getTopEntry() {
    return state.stack[state.stack.length - 1] || null;
  }

  function isOpen(target) {
    const modal = getModal(target);
    return Boolean(modal && getEntry(modal));
  }

  function setBackgroundInert(enabled, activeModal) {
    if (!document.body) return;

    if (enabled) {
      state.backgroundState.clear();

      Array.from(document.body.children).forEach((element) => {
        if (
          element === activeModal ||
          element.contains(activeModal) ||
          ["SCRIPT", "STYLE", "TEMPLATE"].includes(element.tagName)
        ) {
          return;
        }

        state.backgroundState.set(element, {
          inert: Boolean(element.inert),
          ariaHidden: element.getAttribute("aria-hidden")
        });

        element.inert = true;
        element.setAttribute("aria-hidden", "true");
      });

      return;
    }

    state.backgroundState.forEach((previous, element) => {
      if (!element.isConnected) return;

      element.inert = previous.inert;

      if (previous.ariaHidden === null) {
        element.removeAttribute("aria-hidden");
      } else {
        element.setAttribute("aria-hidden", previous.ariaHidden);
      }
    });

    state.backgroundState.clear();
  }

  function prepareModal(modal, options = {}) {
    if (!modal.id) modal.id = utils.createId();

    const role = options.role ||
      modal.getAttribute("role") ||
      "dialog";

    modal.setAttribute(
      "role",
      role === "alertdialog" ? "alertdialog" : "dialog"
    );
    modal.setAttribute("aria-modal", "true");

    if (options.label) {
      modal.setAttribute("aria-label", String(options.label));
    } else if (
      !modal.hasAttribute("aria-label") &&
      !modal.hasAttribute("aria-labelledby")
    ) {
      const heading = modal.querySelector(
        "[data-modal-title], .modal-title, h1, h2, h3"
      );

      if (heading) {
        if (!heading.id) {
          heading.id = utils.createId("mo-modal-title");
        }

        modal.setAttribute("aria-labelledby", heading.id);
      } else {
        modal.setAttribute("aria-label", "Dialog");
      }
    }

    if (options.description) {
      const description = utils.getElement(options.description);

      if (description) {
        if (!description.id) {
          description.id = utils.createId("mo-modal-description");
        }

        modal.setAttribute("aria-describedby", description.id);
      }
    }

    if (!modal.hasAttribute("tabindex")) {
      modal.setAttribute("tabindex", "-1");
    }

    if (options.size) {
      modal.dataset.modalSize = String(options.size);
    }

    modal.hidden = false;
    modal.removeAttribute("aria-hidden");
    modal.dataset.modalOpen = "true";
  }

  function focusModal(modal) {
    if (!modal) return;

    const autofocus = modal.querySelector(
      "[autofocus]:not([disabled])"
    );

    const focusable = utils.getFocusable(modal);
    utils.safeFocus(autofocus || focusable[0] || modal);
  }

  function open(target, options = {}) {
    const modal = getModal(target);

    if (!modal) {
      throw new Error("Modal element was not found.");
    }

    const existing = getEntry(modal);

    if (existing) {
      focusModal(modal);
      return modal;
    }

    const previousActiveElement = document.activeElement;
    const firstOpen = state.stack.length === 0;

    if (firstOpen) {
      state.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    prepareModal(modal, options);

    const entry = {
      modal,
      previousActiveElement,
      closeOnBackdrop:
        options.closeOnBackdrop !== false &&
        modal.dataset.closeOnBackdrop !== "false",
      closeOnEscape:
        options.closeOnEscape !== false &&
        modal.dataset.closeOnEscape !== "false",
      onClose: typeof options.onClose === "function"
        ? options.onClose
        : null,
      onOpen: typeof options.onOpen === "function"
        ? options.onOpen
        : null,
      options
    };

    state.stack.push(entry);

    if (firstOpen) {
      setBackgroundInert(true, modal);
    } else {
      const previousTop = state.stack[state.stack.length - 2];

      if (previousTop) {
        previousTop.modal.setAttribute("aria-hidden", "true");
        previousTop.modal.removeAttribute("aria-modal");
        previousTop.modal.inert = true;
      }
    }

    modal.classList.add("is-open", "modal-open");
    modal.dispatchEvent(new CustomEvent("modal:open", {
      bubbles: true,
      detail: { modal, options }
    }));

    utils.dispatch("opened", { modal, options });

    window.requestAnimationFrame(() => {
      if (getEntry(modal)) focusModal(modal);
    });

    if (entry.onOpen) {
      try {
        entry.onOpen(modal);
      } catch (error) {
        console.error("[MedOrbits Modal] onOpen error:", error);
      }
    }

    return modal;
  }

  function close(target, options = {}) {
    const modal = getModal(target) || getTopEntry()?.modal;

    if (!modal) return false;

    const index = state.stack.findIndex(
      (entry) => entry.modal === modal
    );

    if (index === -1) return false;

    const entry = state.stack[index];

    if (typeof options.beforeClose === "function") {
      try {
        if (options.beforeClose(modal) === false) return false;
      } catch (error) {
        console.error("[MedOrbits Modal] beforeClose error:", error);
        return false;
      }
    }

    // Close only the topmost modal to preserve stack and focus order.
    if (index !== state.stack.length - 1 && options.force !== true) {
      return false;
    }

    state.stack.splice(index, 1);

    modal.classList.remove("is-open", "modal-open");
    delete modal.dataset.modalOpen;
    modal.setAttribute("aria-hidden", "true");
    modal.removeAttribute("aria-modal");
    modal.inert = false;
    modal.hidden = true;

    modal.dispatchEvent(new CustomEvent("modal:close", {
      bubbles: true,
      detail: { modal, options }
    }));

    utils.dispatch("closed", { modal, options });

    if (entry.onClose) {
      try {
        entry.onClose(modal);
      } catch (error) {
        console.error("[MedOrbits Modal] onClose error:", error);
      }
    }

    const topEntry = getTopEntry();

    if (topEntry) {
      topEntry.modal.inert = false;
      topEntry.modal.hidden = false;
      topEntry.modal.removeAttribute("aria-hidden");
      topEntry.modal.setAttribute("aria-modal", "true");
      focusModal(topEntry.modal);
    } else {
      document.body.style.overflow = state.previousBodyOverflow;
      setBackgroundInert(false, modal);

      if (
        entry.previousActiveElement &&
        entry.previousActiveElement.isConnected
      ) {
        utils.safeFocus(entry.previousActiveElement);
      }
    }

    return true;
  }

  function closeAll(options = {}) {
    let allClosed = true;

    while (state.stack.length) {
      const entry = getTopEntry();

      if (!entry || !close(entry.modal, options)) {
        allClosed = false;
        break;
      }
    }

    return allClosed;
  }

  function create(options = {}) {
    const modal = document.createElement("div");
    modal.className = "mo-modal";
    modal.dataset.modal = "";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "mo-modal-dialog";
    content.setAttribute("role", "document");

    if (options.size) {
      content.dataset.modalSize = String(options.size);
    }

    const header = document.createElement("div");
    header.className = "mo-modal-header";

    const title = document.createElement("h2");
    title.className = "mo-modal-title";
    title.dataset.modalTitle = "";
    title.textContent = String(options.title || "Dialog");

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "mo-modal-close";
    closeButton.dataset.modalClose = "";
    closeButton.setAttribute("aria-label", "Close dialog");
    closeButton.textContent = "×";

    header.append(title);

    if (options.closeButton !== false) {
      header.append(closeButton);
    }

    const body = document.createElement("div");
    body.className = "mo-modal-body";

    if (options.content instanceof Node) {
      body.appendChild(options.content);
    } else {
      body.textContent = String(options.content ?? "");
    }

    content.append(header, body);

    if (options.footer instanceof Node) {
      const footer = document.createElement("div");
      footer.className = "mo-modal-footer";
      footer.appendChild(options.footer);
      content.appendChild(footer);
    }

    modal.appendChild(content);
    document.body.appendChild(modal);

    if (options.removeOnClose !== false) {
      modal.addEventListener("modal:close", () => modal.remove(), {
        once: true
      });
    }

    if (options.open !== false) {
      open(modal, options);
    }

    return modal;
  }

  function alertDialog(message, options = {}) {
    return new Promise((resolve) => {
      const footer = document.createElement("div");
      footer.className = "mo-modal-actions";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "mo-button mo-button-primary";
      button.textContent = options.confirmText || "OK";
      footer.appendChild(button);

      const modal = create({
        title: options.title || "Notice",
        content: String(message ?? ""),
        footer,
        closeOnBackdrop: false,
        closeOnEscape: options.closeOnEscape !== false
      });

      let settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        close(modal);
        resolve(result);
      }

      button.addEventListener("click", () => finish(true));

      modal.addEventListener("modal:close", () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });

      button.focus();
    });
  }

  function confirmDialog(message, options = {}) {
    return new Promise((resolve) => {
      const footer = document.createElement("div");
      footer.className = "mo-modal-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "mo-button mo-button-secondary";
      cancelButton.textContent = options.cancelText || "Cancel";

      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "mo-button " +
        (options.danger
          ? "mo-button-danger"
          : "mo-button-primary");
      confirmButton.textContent = options.confirmText || "Confirm";

      footer.append(cancelButton, confirmButton);

      const modal = create({
        title: options.title || "Confirm action",
        content: String(message ?? ""),
        footer,
        closeOnBackdrop: false,
        closeOnEscape: options.closeOnEscape !== false
      });

      let settled = false;

      function finish(result) {
        if (settled) return;
        settled = true;
        close(modal);
        resolve(result);
      }

      cancelButton.addEventListener("click", () => finish(false));
      confirmButton.addEventListener("click", () => finish(true));

      modal.addEventListener("modal:close", () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });

      confirmButton.focus();
    });
  }

  function promptDialog(message, options = {}) {
    return new Promise((resolve) => {
      const wrapper = document.createElement("div");

      const description = document.createElement("p");
      description.textContent = String(message ?? "");

      const input = document.createElement(
        options.multiline ? "textarea" : "input"
      );

      input.className = "mo-modal-input";
      input.name = "modal-prompt";
      input.value = String(options.defaultValue ?? "");
      input.placeholder = String(options.placeholder ?? "");

      if (options.multiline) {
        input.rows = Math.max(1, Number(options.rows) || 4);
      } else {
        const allowedTypes = [
          "text", "email", "number", "tel", "url", "password", "search"
        ];

        input.type = allowedTypes.includes(options.inputType)
          ? options.inputType
          : "text";
      }

      if (options.required) input.required = true;

      wrapper.append(description, input);

      const footer = document.createElement("div");
      footer.className = "mo-modal-actions";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "mo-button mo-button-secondary";
      cancelButton.textContent = options.cancelText || "Cancel";

      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.className = "mo-button mo-button-primary";
      confirmButton.textContent = options.confirmText || "Submit";

      footer.append(cancelButton, confirmButton);

      const modal = create({
        title: options.title || "Enter information",
        content: wrapper,
        footer,
        closeOnBackdrop: false,
        closeOnEscape: options.closeOnEscape !== false
      });

      let settled = false;

      function finish(value) {
        if (settled) return;

        if (value !== null && options.required && !input.value.trim()) {
          input.setAttribute("aria-invalid", "true");
          input.focus();
          return;
        }

        settled = true;
        close(modal);
        resolve(value);
      }

      cancelButton.addEventListener("click", () => finish(null));
      confirmButton.addEventListener("click", () => finish(input.value));

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !options.multiline) {
          event.preventDefault();
          finish(input.value);
        }
      });

      modal.addEventListener("modal:close", () => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      });

      input.focus();
    });
  }

  function bindTriggers() {
    utils.listen(document, "click", (event) => {
      if (!(event.target instanceof Element)) return;

      const opener = event.target.closest("[data-modal-open]");

      if (opener) {
        const selector = opener.dataset.modalOpen;

        if (selector) {
          event.preventDefault();

          const target = utils.getElement(selector);

          if (target) {
            open(target, {
              closeOnBackdrop: target.dataset.closeOnBackdrop !== "false",
              closeOnEscape: target.dataset.closeOnEscape !== "false"
            });
          }

          return;
        }
      }

      const closer = event.target.closest("[data-modal-close]");

      if (closer) {
        const modal = getModal(closer) || getTopEntry()?.modal;

        if (modal) {
          event.preventDefault();
          close(modal);
        }
      }
    });

    utils.listen(document, "click", (event) => {
      const entry = getTopEntry();

      if (
        entry &&
        event.target === entry.modal &&
        entry.closeOnBackdrop
      ) {
        close(entry.modal);
      }
    });
  }

  function bindKeyboard() {
    utils.listen(document, "keydown", (event) => {
      const entry = getTopEntry();

      if (!entry) return;

      if (event.key === "Escape" && entry.closeOnEscape) {
        event.preventDefault();
        close(entry.modal);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = utils.getFocusable(entry.modal);

      if (!focusable.length) {
        event.preventDefault();
        utils.safeFocus(entry.modal);
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!entry.modal.contains(active)) {
        event.preventDefault();
        utils.safeFocus(event.shiftKey ? last : first);
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        utils.safeFocus(last);
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        utils.safeFocus(first);
      }
    });
  }

  function init() {
    if (state.initialized) return api;

    bindTriggers();
    bindKeyboard();

    document.querySelectorAll(
      "[data-modal], .modal, [role='dialog'], [role='alertdialog']"
    ).forEach((modal) => {
      if (!getEntry(modal) && !modal.hidden) {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        modal.classList.remove("is-open", "modal-open");
      }
    });

    state.initialized = true;
    utils.dispatch("initialized");

    return api;
  }

  function destroy() {
    closeAll({ force: true });

    state.listeners.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });

    state.listeners = [];
    state.initialized = false;
  }

  const api = Object.freeze({
    init,
    destroy,
    open,
    close,
    closeAll,
    create,
    isOpen,
    focus: focusModal,

    alert: alertDialog,
    confirm: confirmDialog,
    prompt: promptDialog,

    getOpenModals() {
      return state.stack.map((entry) => entry.modal);
    },

    getTopModal() {
      return getTopEntry()?.modal || null;
    },

    constants: Object.freeze({
      FOCUSABLE_SELECTOR
    })
  });

  window.MedOrbitsModal = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Modal = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window, document);
