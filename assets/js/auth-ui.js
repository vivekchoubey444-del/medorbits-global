
/* =========================================================
   MEDORBITS | AUTHENTICATION UI
   File: assets/js/auth-ui.js
   Version: 1.0.0

   Features:
   - No dependencies or framework requirements
   - No global layout or CSS framework overrides
   - Duplicate-load protection
   - Password visibility toggles
   - Password confirmation validation
   - Accessible field errors and status messages
   - Login/register mode switching
   - Optional password requirement feedback
   - Submit-state protection
   - Dynamic-content support
   - Safe error messaging
   - Public API and cleanup support

   Load after api-client.js if using MedOrbitsAPI:
   <script src="/assets/js/api-client.js" defer></script>
   <script src="/assets/js/auth-ui.js" defer></script>

   SECURITY:
   Authentication and authorization must be enforced by
   the server. Never store plaintext passwords or trust
   client-side validation as a security boundary.
   ========================================================= */

(function medOrbitsAuthUI() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_AUTH_UI_V1__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  const CONFIG = Object.freeze({
    styleId: "medorbits-auth-ui-styles",
    liveRegionId: "mo-auth-announcements",
    formSelector: "[data-auth-form]",
    passwordToggle: "[data-auth-password-toggle]",
    confirmationAttribute: "data-auth-confirm-password",
    modeToggle: "[data-auth-mode-toggle]",
    modeAttribute: "data-auth-mode",
    submitAttribute: "data-auth-submitting",
    errorClass: "mo-auth-field-error",
    statusClass: "mo-auth-status",
    managedHiddenClass: "mo-auth-managed-hidden",
    announcementDelay: 40
  });

  const state = {
    initialized: false,
    destroyed: false,
    observer: null,
    liveRegion: null,
    announcementTimer: null,
    injectedStyle: null,
    initializedForms: new WeakSet(),
    initializedToggles: new WeakSet(),
    initializedModeControls: new WeakSet(),
    submittingForms: new WeakSet(),
    listeners: []
  };

  /* ---------------------------------------------------------
     1. SAFE HELPERS
     --------------------------------------------------------- */

  function isHTMLElement(value) {
    return value instanceof HTMLElement;
  }

  function getById(id) {
    if (typeof id !== "string" || !id.trim()) {
      return null;
    }

    return document.getElementById(id.replace(/^#/, ""));
  }

  function isDisabled(element) {
    return (
      !isHTMLElement(element) ||
      element.matches(":disabled") ||
      element.getAttribute("aria-disabled") === "true"
    );
  }

  function listen(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);

    state.listeners.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function getFormStatus(form) {
    let status = form.querySelector("[data-auth-status]");

    if (!status) {
      status = document.createElement("div");
      status.className = CONFIG.statusClass;
      status.setAttribute("data-auth-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");
      form.appendChild(status);
    }

    return status;
  }

  /* ---------------------------------------------------------
     2. SCOPED STYLES
     --------------------------------------------------------- */

  function installStyles() {
    const existing = document.getElementById(CONFIG.styleId);

    if (existing) {
      state.injectedStyle = existing;
      return;
    }

    const style = document.createElement("style");

    style.id = CONFIG.styleId;

    style.textContent = `
      /*
       * MedOrbits authentication UI utilities only.
       * Existing page dimensions, layouts, and theme remain intact.
       */

      .${CONFIG.errorClass} {
        color: #a12626;
        font: inherit;
        overflow-wrap: anywhere;
      }

      .${CONFIG.statusClass} {
        font: inherit;
        overflow-wrap: anywhere;
      }

      .${CONFIG.managedHiddenClass}[hidden] {
        display: none !important;
      }

      [data-auth-form][data-auth-submitting="true"] {
        cursor: progress;
      }

      [data-auth-password-toggle]:focus-visible,
      [data-auth-mode-toggle]:focus-visible {
        outline: 3px solid #b78b36;
        outline-offset: 3px;
      }

      @media (forced-colors: active) {
        [data-auth-password-toggle]:focus-visible,
        [data-auth-mode-toggle]:focus-visible {
          outline: 3px solid Highlight;
        }
      }
    `;

    (document.head || document.documentElement).appendChild(style);

    state.injectedStyle = style;
  }

  /* ---------------------------------------------------------
     3. ACCESSIBLE ANNOUNCEMENTS
     --------------------------------------------------------- */

  function ensureLiveRegion() {
    if (state.liveRegion && state.liveRegion.isConnected) {
      return state.liveRegion;
    }

    let region = document.getElementById(CONFIG.liveRegionId);

    if (!region) {
      region = document.createElement("div");

      region.id = CONFIG.liveRegionId;
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");

      Object.assign(region.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: "0",
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: "0"
      });

      (document.body || document.documentElement).appendChild(region);
    }

    state.liveRegion = region;

    return region;
  }

  function announce(message) {
    if (
      typeof message !== "string" ||
      !message.trim() ||
      state.destroyed
    ) {
      return;
    }

    const region = ensureLiveRegion();

    region.textContent = "";

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
    }

    state.announcementTimer = window.setTimeout(function () {
      region.textContent = message.trim();
      state.announcementTimer = null;
    }, CONFIG.announcementDelay);
  }

  function setStatus(form, message, type) {
    const status = getFormStatus(form);

    status.textContent = message;
    status.hidden = false;
    status.setAttribute("data-status-type", type || "info");
  }

  function clearStatus(form) {
    const status = form.querySelector("[data-auth-status]");

    if (!status) {
      return;
    }

    status.textContent = "";
    status.hidden = true;
    status.removeAttribute("data-status-type");
  }

  /* ---------------------------------------------------------
     4. FIELD ERRORS
     --------------------------------------------------------- */

  function getErrorElement(field) {
    const explicitId = field.getAttribute("data-auth-error");

    if (explicitId) {
      return getById(explicitId);
    }

    if (field.id) {
      return getById(field.id + "-error");
    }

    return null;
  }

  function addDescribedBy(field, id) {
    if (!id) {
      return;
    }

    const ids = new Set(
      (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean)
    );

    ids.add(id);

    field.setAttribute("aria-describedby", Array.from(ids).join(" "));
  }

  function removeDescribedBy(field, id) {
    if (!id) {
      return;
    }

    const ids = (
      field.getAttribute("aria-describedby") || ""
    )
      .split(/\s+/)
      .filter(function (value) {
        return value && value !== id;
      });

    if (ids.length) {
      field.setAttribute("aria-describedby", ids.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function fieldMessage(field) {
    if (field.validity.valueMissing) {
      return "Complete this required field.";
    }

    if (field.validity.typeMismatch) {
      return field.type === "email"
        ? "Enter a valid email address."
        : "Enter a value in the required format.";
    }

    if (field.validity.tooShort) {
      return "The entered value is too short.";
    }

    if (field.validity.tooLong) {
      return "The entered value is too long.";
    }

    if (field.validity.patternMismatch) {
      return field.getAttribute("data-auth-pattern-message") ||
        "The value does not match the required format.";
    }

    return field.validationMessage || "Check this field.";
  }

  function showFieldError(field, message) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.setAttribute("aria-invalid", "true");

    const error = getErrorElement(field);

    if (!error) {
      return;
    }

    if (!error.id) {
      error.id = field.id
        ? field.id + "-error"
        : "mo-auth-error-" + Math.random().toString(36).slice(2, 9);
    }

    error.classList.add(CONFIG.errorClass);
    error.textContent = message;
    error.hidden = false;

    addDescribedBy(field, error.id);
  }

  function clearFieldError(field) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.removeAttribute("aria-invalid");

    const error = getErrorElement(field);

    if (!error) {
      return;
    }

    error.textContent = "";
    error.hidden = true;

    if (error.id) {
      removeDescribedBy(field, error.id);
    }
  }

  function validateField(field) {
    if (
      !isHTMLElement(field) ||
      field.disabled ||
      field.type === "hidden"
    ) {
      return true;
    }

    if (field.validity.valid) {
      clearFieldError(field);
      return true;
    }

    showFieldError(field, fieldMessage(field));

    return false;
  }

  /* ---------------------------------------------------------
     5. PASSWORD VISIBILITY
     --------------------------------------------------------- */

  function initializePasswordToggle(control) {
    if (
      !isHTMLElement(control) ||
      state.initializedToggles.has(control)
    ) {
      return;
    }

    const input = getById(
      control.getAttribute("data-auth-password-toggle")
    );

    if (
      !(input instanceof HTMLInputElement) ||
      !["password", "text"].includes(input.type)
    ) {
      return;
    }

    state.initializedToggles.add(control);

    control.setAttribute("aria-pressed", String(input.type === "text"));

    if (!control.hasAttribute("aria-label")) {
      control.setAttribute(
        "aria-label",
        input.type === "text" ? "Hide password" : "Show password"
      );
    }
  }

  function togglePassword(control) {
    const input = getById(
      control.getAttribute("data-auth-password-toggle")
    );

    if (
      !(input instanceof HTMLInputElement) ||
      isDisabled(control)
    ) {
      return;
    }

    const show = input.type === "password";

    input.type = show ? "text" : "password";

    control.setAttribute("aria-pressed", String(show));
    control.setAttribute(
      "aria-label",
      show ? "Hide password" : "Show password"
    );

    announce(show ? "Password is visible." : "Password is hidden.");
  }

  /* ---------------------------------------------------------
     6. PASSWORD CONFIRMATION
     --------------------------------------------------------- */

  function getConfirmationInput(passwordField) {
    const id = passwordField.getAttribute(
      CONFIG.confirmationAttribute
    );

    const input = getById(id);

    return input instanceof HTMLInputElement ? input : null;
  }

  function validatePasswordConfirmation(passwordField) {
    const confirmation = getConfirmationInput(passwordField);

    if (!confirmation) {
      return true;
    }

    if (!confirmation.value && !confirmation.required) {
      confirmation.setCustomValidity("");
      clearFieldError(confirmation);
      return true;
    }

    const matches = passwordField.value === confirmation.value;

    confirmation.setCustomValidity(
      matches ? "" : "Passwords do not match."
    );

    if (matches) {
      clearFieldError(confirmation);
    } else {
      showFieldError(confirmation, "Passwords do not match.");
    }

    return matches;
  }

  function validateConfirmations(form) {
    let valid = true;

    form.querySelectorAll(
      'input[type="password"][data-auth-confirm-password]'
    ).forEach(function (passwordField) {
      if (!validatePasswordConfirmation(passwordField)) {
        valid = false;
      }
    });

    return valid;
  }

  /* ---------------------------------------------------------
     7. OPTIONAL PASSWORD REQUIREMENT FEEDBACK
     --------------------------------------------------------- */

  /*
   * This is only a user-interface helper. The server must apply
   * the real password policy.
   *
   * <input type="password" data-auth-password-rules>
   * <ul data-auth-password-feedback>
   *   <li data-rule="length">At least 12 characters</li>
   *   <li data-rule="lowercase">A lowercase letter</li>
   *   <li data-rule="uppercase">An uppercase letter</li>
   *   <li data-rule="number">A number</li>
   * </ul>
   */

  function updatePasswordFeedback(input) {
    if (!isHTMLElement(input)) {
      return;
    }

    const feedbackId = input.getAttribute(
      "data-auth-password-feedback"
    );

    if (!feedbackId) {
      return;
    }

    const feedback = getById(feedbackId);

    if (!feedback) {
      return;
    }

    const value = input.value;

    const rules = {
      length: value.length >= 12,
      lowercase: /[a-z]/.test(value),
      uppercase: /[A-Z]/.test(value),
      number: /\d/.test(value)
    };

    feedback.querySelectorAll("[data-rule]").forEach(function (item) {
      const rule = item.getAttribute("data-rule");

      if (!Object.prototype.hasOwnProperty.call(rules, rule)) {
        return;
      }

      item.setAttribute(
        "data-rule-met",
        String(rules[rule])
      );

      item.setAttribute(
        "aria-label",
        rules[rule] ? "Requirement met" : "Requirement not met"
      );
    });
  }

  /* ---------------------------------------------------------
     8. LOGIN / REGISTER MODE SWITCHING
     --------------------------------------------------------- */

  function initializeModeToggle(control) {
    if (
      !isHTMLElement(control) ||
      state.initializedModeControls.has(control)
    ) {
      return;
    }

    const targetId = control.getAttribute(
      "data-auth-mode-toggle"
    );

    if (!targetId || !getById(targetId)) {
      return;
    }

    state.initializedModeControls.add(control);
  }

  function setAuthMode(targetId, mode) {
    const target = getById(targetId);

    if (!target || !["login", "register", "forgot"].includes(mode)) {
      return false;
    }

    target.querySelectorAll("[data-auth-mode-panel]").forEach(
      function (panel) {
        const active = panel.getAttribute("data-auth-mode-panel") === mode;

        panel.hidden = !active;
        panel.setAttribute("aria-hidden", String(!active));
      }
    );

    target.setAttribute(CONFIG.modeAttribute, mode);

    announce(
      mode === "login"
        ? "Login form selected."
        : mode === "register"
          ? "Registration form selected."
          : "Password recovery form selected."
    );

    return true;
  }

  /* ---------------------------------------------------------
     9. FORM INITIALIZATION
     --------------------------------------------------------- */

  function initializeForm(form) {
    if (
      !(form instanceof HTMLFormElement) ||
      state.initializedForms.has(form)
    ) {
      return;
    }

    state.initializedForms.add(form);

    form.setAttribute("data-auth-ui-ready", "true");

    form.querySelectorAll("input, select, textarea").forEach(
      function (field) {
        field.addEventListener("input", function () {
          if (field.validity.valid) {
            clearFieldError(field);
          }

          if (
            field instanceof HTMLInputElement &&
            field.type === "password"
          ) {
            validatePasswordConfirmation(field);
            updatePasswordFeedback(field);
          }

          const confirmationPassword = form.querySelector(
            'input[type="password"][data-auth-confirm-password="' +
              field.id +
              '"]'
          );

          if (confirmationPassword) {
            validatePasswordConfirmation(confirmationPassword);
          }
        });

        if (field.hasAttribute("data-auth-validate-on-blur")) {
          field.addEventListener("blur", function () {
            validateField(field);
          });
        }
      }
    );

    form.addEventListener("submit", function (event) {
      if (state.submittingForms.has(form)) {
        event.preventDefault();

        setStatus(
          form,
          "This request is already being submitted.",
          "warning"
        );

        return;
      }

      const confirmationsValid = validateConfirmations(form);
      let firstInvalid = null;

      form.querySelectorAll("input, select, textarea").forEach(
        function (field) {
          if (!validateField(field) && !firstInvalid) {
            firstInvalid = field;
          }
        }
      );

      if (!confirmationsValid || firstInvalid || !form.checkValidity()) {
        event.preventDefault();

        setStatus(
          form,
          "Please review the highlighted fields.",
          "error"
        );

        if (firstInvalid) {
          try {
            firstInvalid.focus({ preventScroll: true });
          } catch (error) {
            firstInvalid.focus();
          }

          if (typeof firstInvalid.reportValidity === "function") {
            firstInvalid.reportValidity();
          }
        }

        announce("Please correct the form errors.");
        return;
      }

      /*
       * Allow the browser or existing application handler to submit.
       * Do not disable submit buttons before FormData is constructed.
       */
      state.submittingForms.add(form);
      form.setAttribute(CONFIG.submitAttribute, "true");

      setStatus(form, "Submitting…", "pending");
    });

    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        form.querySelectorAll("input, select, textarea").forEach(
          function (field) {
            clearFieldError(field);

            if (field instanceof HTMLInputElement) {
              field.setCustomValidity("");
              updatePasswordFeedback(field);
            }
          }
        );

        state.submittingForms.delete(form);
        form.removeAttribute(CONFIG.submitAttribute);

        const status = form.querySelector("[data-auth-status]");

        if (status) {
          status.textContent = "";
          status.hidden = true;
          status.removeAttribute("data-status-type");
        }
      }, 0);
    });
  }

  /* ---------------------------------------------------------
     10. EVENT DELEGATION
     --------------------------------------------------------- */

  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const passwordToggle = event.target.closest(
      CONFIG.passwordToggle
    );

    if (passwordToggle instanceof HTMLElement) {
      togglePassword(passwordToggle);
      return;
    }

    const modeControl = event.target.closest(
      CONFIG.modeToggle
    );

    if (modeControl instanceof HTMLElement && !isDisabled(modeControl)) {
      const targetId = modeControl.getAttribute(
        "data-auth-mode-toggle"
      );

      const mode = modeControl.getAttribute("data-auth-mode-value");

      if (targetId && mode) {
        setAuthMode(targetId, mode);
      }
    }

    const resetControl = event.target.closest("[data-auth-reset-state]");

    if (resetControl instanceof HTMLElement) {
      const form = resetControl.closest(CONFIG.formSelector);

      if (form) {
        window.setTimeout(function () {
          state.submittingForms.delete(form);
          form.removeAttribute(CONFIG.submitAttribute);
        }, 0);
      }
    }
  }

  /* ---------------------------------------------------------
     11. DYNAMIC CONTENT SUPPORT
     --------------------------------------------------------- */

  function initializeWithin(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    if (
      root instanceof HTMLFormElement &&
      root.matches(CONFIG.formSelector)
    ) {
      initializeForm(root);
    }

    if (
      isHTMLElement(root) &&
      root.matches(CONFIG.passwordToggle)
    ) {
      initializePasswordToggle(root);
    }

    if (
      isHTMLElement(root) &&
      root.matches(CONFIG.modeToggle)
    ) {
      initializeModeToggle(root);
    }

    root.querySelectorAll(CONFIG.formSelector).forEach(initializeForm);
    root.querySelectorAll(CONFIG.passwordToggle)
      .forEach(initializePasswordToggle);
    root.querySelectorAll(CONFIG.modeToggle)
      .forEach(initializeModeToggle);

    root.querySelectorAll("[data-auth-password-rules]")
      .forEach(updatePasswordFeedback);
  }

  function observeDynamicContent() {
    if (typeof MutationObserver !== "function") {
      return;
    }

    state.observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node instanceof HTMLElement) {
            initializeWithin(node);
          }
        });
      });
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* ---------------------------------------------------------
     12. INITIALIZATION
     --------------------------------------------------------- */

  function initialize() {
    if (
      state.initialized ||
      state.destroyed ||
      !document.documentElement
    ) {
      return;
    }

    state.initialized = true;

    installStyles();
    ensureLiveRegion();
    initializeWithin(document);

    listen(document, "click", handleClick);

    document.documentElement.setAttribute(
      "data-mo-auth-ui",
      "ready"
    );

    observeDynamicContent();
  }

  /* ---------------------------------------------------------
     13. PUBLIC API AND CLEANUP
     --------------------------------------------------------- */

  function resetSubmission(formOrId) {
    const form = typeof formOrId === "string"
      ? getById(formOrId)
      : formOrId;

    if (!(form instanceof HTMLFormElement)) {
      return false;
    }

    state.submittingForms.delete(form);
    form.removeAttribute(CONFIG.submitAttribute);

    const status = form.querySelector("[data-auth-status]");

    if (status) {
      status.textContent = "";
      status.hidden = true;
      status.removeAttribute("data-status-type");
    }

    return true;
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    state.listeners.forEach(function (removeListener) {
      removeListener();
    });

    state.listeners.length = 0;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
      state.announcementTimer = null;
    }

    if (state.injectedStyle) {
      state.injectedStyle.remove();
    }

    if (
      state.liveRegion &&
      state.liveRegion.id === CONFIG.liveRegionId
    ) {
      state.liveRegion.remove();
    }

    document.documentElement.removeAttribute("data-mo-auth-ui");

    state.destroyed = true;
  }

  const api = Object.freeze({
    announce: announce,
    setAuthMode: setAuthMode,
    resetSubmission: resetSubmission,

    refresh: function () {
      initializeWithin(document);
    },

    destroy: destroy
  });

  window.MedOrbitsAuthUI = api;
  window[GLOBAL_KEY] = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, {
      once: true
    });
  } else {
    initialize();
  }
})();
