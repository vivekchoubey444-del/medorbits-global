
/* =========================================================
   MEDORBITS | ACCOUNT ENHANCEMENT LAYER
   File: assets/js/account.js
   Version: 1.0.0

   Features:
   - No dependencies or framework requirements
   - Compatible with existing MedOrbits CSS
   - Safe repeated-script-load protection
   - Dynamic-content support
   - Accessible password visibility toggles
   - Password confirmation validation
   - Accessible account-form validation
   - Submission-state and duplicate-submit protection
   - Accessible status announcements
   - Safe input handling without logging credentials
   - Optional account UI disclosure controls
   - No forced page dimensions, grids, or flex layouts

   Load with defer:
   <script src="/assets/js/account.js" defer></script>

   SECURITY:
   This file is a frontend enhancement layer.
   Authentication, authorization, session management,
   password hashing, and account persistence must be
   implemented and enforced by the server.
   ========================================================= */

(function medOrbitsAccount() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_ACCOUNT_V1__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  window[GLOBAL_KEY] = true;

  const CONFIG = Object.freeze({
    styleId: "medorbits-account-styles",
    liveRegionId: "mo-account-announcements",
    errorClass: "mo-account-field-error",
    statusClass: "mo-account-form-status",
    managedHiddenClass: "mo-account-managed-hidden",
    passwordToggleAttribute: "data-password-toggle",
    passwordConfirmAttribute: "data-password-confirm",
    formAttribute: "data-account-form",
    submitStateAttribute: "data-account-submitting",
    announcementDelay: 40
  });

  const state = {
    initialized: false,
    destroyed: false,
    observer: null,
    announcementRegion: null,
    announcementTimer: null,
    injectedStyle: null,
    processedForms: new WeakSet(),
    submittingForms: new WeakSet(),
    passwordToggles: new WeakSet()
  };

  /* ---------------------------------------------------------
     1. SAFE DOM HELPERS
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

  function getAssociatedLabel(field) {
    if (!isHTMLElement(field)) {
      return "";
    }

    if (field.labels && field.labels.length) {
      return Array.from(field.labels)
        .map(function (label) {
          return label.textContent.trim();
        })
        .filter(Boolean)
        .join(" ");
    }

    return (
      field.getAttribute("aria-label") ||
      field.name ||
      field.id ||
      "This field"
    );
  }

  function getFormStatus(form) {
    if (!isHTMLElement(form)) {
      return null;
    }

    let status = form.querySelector(
      "[data-account-status]"
    );

    if (!status) {
      status = document.createElement("div");
      status.className = CONFIG.statusClass;
      status.setAttribute("data-account-status", "");
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
       * MedOrbits account utilities.
       * No global dimensions, grids, flex rules, or page styles.
       */

      .${CONFIG.errorClass} {
        color: #a12626;
        font: inherit;
      }

      .${CONFIG.statusClass} {
        font: inherit;
        overflow-wrap: anywhere;
      }

      .${CONFIG.managedHiddenClass}[hidden] {
        display: none !important;
      }

      [data-account-form][data-account-submitting="true"] {
        cursor: progress;
      }

      [data-password-toggle]:focus-visible,
      [data-account-action]:focus-visible {
        outline: 3px solid #b78b36;
        outline-offset: 3px;
      }

      @media (forced-colors: active) {
        [data-password-toggle]:focus-visible,
        [data-account-action]:focus-visible {
          outline: 3px solid Highlight;
        }
      }
    `;

    (document.head || document.documentElement)
      .appendChild(style);

    state.injectedStyle = style;
  }

  /* ---------------------------------------------------------
     3. ACCESSIBLE ANNOUNCEMENTS
     --------------------------------------------------------- */

  function ensureLiveRegion() {
    if (
      state.announcementRegion &&
      state.announcementRegion.isConnected
    ) {
      return state.announcementRegion;
    }

    let region = document.getElementById(
      CONFIG.liveRegionId
    );

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

      (document.body || document.documentElement)
        .appendChild(region);
    }

    state.announcementRegion = region;

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

    if (!region) {
      return;
    }

    region.textContent = "";

    if (state.announcementTimer !== null) {
      window.clearTimeout(state.announcementTimer);
    }

    state.announcementTimer = window.setTimeout(function () {
      region.textContent = message.trim();
      state.announcementTimer = null;
    }, CONFIG.announcementDelay);
  }

  /* ---------------------------------------------------------
     4. FIELD ERROR HELPERS
     --------------------------------------------------------- */

  function getErrorElement(field) {
    if (!isHTMLElement(field)) {
      return null;
    }

    const explicitId = field.getAttribute(
      "data-account-error"
    );

    if (explicitId) {
      return getById(explicitId);
    }

    const errorId = field.id
      ? field.id + "-error"
      : null;

    if (errorId) {
      let error = getById(errorId);

      if (error) {
        return error;
      }
    }

    return null;
  }

  function addDescribedBy(field, id) {
    if (!isHTMLElement(field) || !id) {
      return;
    }

    const ids = new Set(
      (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean)
    );

    ids.add(id);

    field.setAttribute(
      "aria-describedby",
      Array.from(ids).join(" ")
    );
  }

  function removeDescribedBy(field, id) {
    if (!isHTMLElement(field) || !id) {
      return;
    }

    const ids = (
      field.getAttribute("aria-describedby") || ""
    )
      .split(/\s+/)
      .filter(function (item) {
        return item && item !== id;
      });

    if (ids.length) {
      field.setAttribute(
        "aria-describedby",
        ids.join(" ")
      );
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function showFieldError(field, message) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.setAttribute("aria-invalid", "true");

    const error = getErrorElement(field);

    if (error) {
      error.textContent = message;
      error.hidden = false;
      error.classList.add(CONFIG.errorClass);

      if (!error.id) {
        error.id = field.id
          ? field.id + "-error"
          : "mo-account-error-" +
            Math.random().toString(36).slice(2, 9);
      }

      addDescribedBy(field, error.id);
    }
  }

  function clearFieldError(field) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.removeAttribute("aria-invalid");

    const error = getErrorElement(field);

    if (error) {
      error.textContent = "";
      error.hidden = true;

      if (error.id) {
        removeDescribedBy(field, error.id);
      }
    }
  }

  function showFormStatus(form, message, type) {
    const status = getFormStatus(form);

    if (!status) {
      return;
    }

    status.textContent = message;
    status.setAttribute(
      "data-status-type",
      type || "info"
    );

    status.hidden = false;
  }

  /* ---------------------------------------------------------
     5. PASSWORD VISIBILITY
     --------------------------------------------------------- */

  function initializePasswordToggle(control) {
    if (
      !isHTMLElement(control) ||
      state.passwordToggles.has(control)
    ) {
      return;
    }

    const target = getById(
      control.getAttribute(CONFIG.passwordToggleAttribute)
    );

    if (
      !(target instanceof HTMLInputElement) ||
      !["password", "text"].includes(target.type)
    ) {
      return;
    }

    state.passwordToggles.add(control);

    if (!control.hasAttribute("aria-label")) {
      control.setAttribute(
        "aria-label",
        target.type === "password"
          ? "Show password"
          : "Hide password"
      );
    }

    control.setAttribute(
      "aria-pressed",
      String(target.type === "text")
    );
  }

  function togglePasswordVisibility(control) {
    const target = getById(
      control.getAttribute(CONFIG.passwordToggleAttribute)
    );

    if (
      !(target instanceof HTMLInputElement) ||
      !["password", "text"].includes(target.type)
    ) {
      return;
    }

    const showing = target.type === "password";

    target.type = showing ? "text" : "password";

    control.setAttribute(
      "aria-pressed",
      String(showing)
    );

    control.setAttribute(
      "aria-label",
      showing ? "Hide password" : "Show password"
    );

    // Keep focus on the toggle; do not move focus unexpectedly.
    announce(
      showing ? "Password is visible." : "Password is hidden."
    );
  }

  /* ---------------------------------------------------------
     6. PASSWORD CONFIRMATION
     --------------------------------------------------------- */

  function getPasswordConfirmationField(field) {
    const targetId = field.getAttribute(
      CONFIG.passwordConfirmAttribute
    );

    if (targetId) {
      return getById(targetId);
    }

    return null;
  }

  function validatePasswordConfirmation(field) {
    if (!isHTMLElement(field)) {
      return true;
    }

    const confirmation = getPasswordConfirmationField(field);

    if (!(confirmation instanceof HTMLInputElement)) {
      return true;
    }

    // Empty optional confirmation fields are handled by the
    // browser's required-field validation if marked required.
    if (!confirmation.value && !confirmation.required) {
      clearFieldError(confirmation);
      confirmation.setCustomValidity("");
      return true;
    }

    const matches = field.value === confirmation.value;

    confirmation.setCustomValidity(
      matches ? "" : "Passwords do not match."
    );

    if (!matches) {
      showFieldError(
        confirmation,
        "Passwords do not match."
      );
    } else {
      clearFieldError(confirmation);
    }

    return matches;
  }

  function validateConfirmationsInForm(form) {
    let valid = true;

    const passwordFields = form.querySelectorAll(
      'input[type="password"], input[data-account-password]'
    );

    passwordFields.forEach(function (field) {
      if (
        field.hasAttribute(CONFIG.passwordConfirmAttribute)
      ) {
        if (!validatePasswordConfirmation(field)) {
          valid = false;
        }
      }
    });

    // Also support confirmation fields marked with
    // data-password-confirm-field and data-password-source.
    const confirmations = form.querySelectorAll(
      "[data-password-confirm-field][data-password-source]"
    );

    confirmations.forEach(function (confirmation) {
      const source = getById(
        confirmation.getAttribute("data-password-source")
      );

      if (
        !(source instanceof HTMLInputElement) ||
        !(confirmation instanceof HTMLInputElement)
      ) {
        return;
      }

      const matches = source.value === confirmation.value;

      confirmation.setCustomValidity(
        matches ? "" : "Passwords do not match."
      );

      if (!matches) {
        showFieldError(
          confirmation,
          "Passwords do not match."
        );
        valid = false;
      } else {
        clearFieldError(confirmation);
      }
    });

    return valid;
  }

  /* ---------------------------------------------------------
     7. ACCOUNT FORM INITIALIZATION
     --------------------------------------------------------- */

  function initializeAccountForm(form) {
    if (
      !isHTMLElement(form) ||
      state.processedForms.has(form)
    ) {
      return;
    }

    state.processedForms.add(form);

    form.setAttribute("data-account-form-ready", "true");

    // Remove stale submission state from server-rendered forms.
    if (
      form.getAttribute(CONFIG.submitStateAttribute) === "true"
    ) {
      form.removeAttribute(CONFIG.submitStateAttribute);
    }

    const fields = form.querySelectorAll(
      "input, select, textarea"
    );

    fields.forEach(function (field) {
      field.addEventListener("input", function () {
        if (field.validity.valid) {
          clearFieldError(field);
        }

        if (
          field instanceof HTMLInputElement &&
          field.type === "password"
        ) {
          const confirmation = getPasswordConfirmationField(field);

          if (confirmation) {
            validatePasswordConfirmation(field);
          }
        }

        const sourceId = field.getAttribute(
          "data-password-source"
        );

        if (sourceId) {
          const source = getById(sourceId);

          if (source instanceof HTMLInputElement) {
            const matches = source.value === field.value;

            field.setCustomValidity(
              matches ? "" : "Passwords do not match."
            );

            if (matches) {
              clearFieldError(field);
            }
          }
        }
      });

      field.addEventListener("blur", function () {
        if (
          field.hasAttribute("data-validate-on-blur") &&
          !field.validity.valid
        ) {
          showFieldError(
            field,
            field.validationMessage || "Please check this field."
          );
        }
      });
    });

    form.addEventListener("submit", function (event) {
      if (state.submittingForms.has(form)) {
        event.preventDefault();
        showFormStatus(
          form,
          "This form is already being submitted.",
          "warning"
        );
        return;
      }

      const confirmationsValid =
        validateConfirmationsInForm(form);

      if (!confirmationsValid || !form.checkValidity()) {
        event.preventDefault();

        showFormStatus(
          form,
          "Please check the highlighted fields and try again.",
          "error"
        );

        const invalidField = form.querySelector(
          ":invalid"
        );

        if (invalidField instanceof HTMLElement) {
          invalidField.focus();
          if (typeof invalidField.reportValidity === "function") {
            invalidField.reportValidity();
          }
        }

        announce("Please correct the form errors.");
        return;
      }

      /*
       * Mark the form as submitting without disabling controls.
       * This avoids interfering with FormData serialization,
       * submit buttons, and existing application handlers.
       */
      state.submittingForms.add(form);
      form.setAttribute(CONFIG.submitStateAttribute, "true");

      showFormStatus(form, "Submitting…", "pending");
    });
  }

  function resetSubmission(form) {
    if (!isHTMLElement(form)) {
      return;
    }

    state.submittingForms.delete(form);
    form.removeAttribute(CONFIG.submitStateAttribute);

    const status = form.querySelector("[data-account-status]");

    if (status) {
      status.textContent = "";
      status.hidden = true;
      status.removeAttribute("data-status-type");
    }
  }

  /* ---------------------------------------------------------
     8. OPTIONAL ACCOUNT DISCLOSURES
     --------------------------------------------------------- */

  function initializeAccountDisclosure(control) {
    if (!isHTMLElement(control)) {
      return;
    }

    const targetId = control.getAttribute(
      "data-account-toggle"
    );

    if (!targetId) {
      return;
    }

    const target = getById(targetId);

    if (!isHTMLElement(target)) {
      return;
    }

    if (!control.hasAttribute("aria-controls") && target.id) {
      control.setAttribute("aria-controls", target.id);
    }

    if (!control.hasAttribute("aria-expanded")) {
      control.setAttribute(
        "aria-expanded",
        String(!target.hidden)
      );
    }

    target.classList.add(CONFIG.managedHiddenClass);
  }

  function toggleAccountDisclosure(control) {
    const target = getById(
      control.getAttribute("data-account-toggle")
    );

    if (!isHTMLElement(target) || isDisabled(control)) {
      return;
    }

    const expanded =
      control.getAttribute("aria-expanded") !== "true";

    control.setAttribute(
      "aria-expanded",
      String(expanded)
    );

    target.hidden = !expanded;

    if (
      !expanded &&
      target.contains(document.activeElement)
    ) {
      control.focus();
    }

    announce(
      expanded
        ? "Account section expanded."
        : "Account section collapsed."
    );
  }

  /* ---------------------------------------------------------
     9. EVENT DELEGATION
     --------------------------------------------------------- */

  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const passwordToggle = event.target.closest(
      "[" + CONFIG.passwordToggleAttribute + "]"
    );

    if (
      passwordToggle instanceof HTMLElement &&
      !isDisabled(passwordToggle)
    ) {
      togglePasswordVisibility(passwordToggle);
      return;
    }

    const accountToggle = event.target.closest(
      "[data-account-toggle]"
    );

    if (
      accountToggle instanceof HTMLElement &&
      !isDisabled(accountToggle)
    ) {
      toggleAccountDisclosure(accountToggle);
      return;
    }

    const resetControl = event.target.closest(
      "[data-account-reset]"
    );

    if (
      resetControl instanceof HTMLElement &&
      !isDisabled(resetControl)
    ) {
      const form = resetControl.closest("form");

      if (form) {
        window.setTimeout(function () {
          resetSubmission(form);

          form.querySelectorAll(
            "input, select, textarea"
          ).forEach(function (field) {
            clearFieldError(field);

            if (field instanceof HTMLInputElement) {
              field.setCustomValidity("");
            }
          });
        }, 0);
      }
    }
  }

  function handleKeydown(event) {
    if (event.key !== "Escape" || event.defaultPrevented) {
      return;
    }

    const controls = document.querySelectorAll(
      '[data-account-toggle][aria-expanded="true"]'
    );

    for (const control of controls) {
      const target = getById(
        control.getAttribute("data-account-toggle")
      );

      if (
        target &&
        target.contains(document.activeElement)
      ) {
        control.setAttribute("aria-expanded", "false");
        target.hidden = true;
        control.focus();
        announce("Account section collapsed.");
        return;
      }
    }
  }

  /* ---------------------------------------------------------
     10. DYNAMIC CONTENT SUPPORT
     --------------------------------------------------------- */

  function initializeWithin(scope) {
    if (!scope || !scope.querySelectorAll) {
      return;
    }

    if (
      isHTMLElement(scope) &&
      scope.matches("form[" + CONFIG.formAttribute + "]")
    ) {
      initializeAccountForm(scope);
    }

    if (
      isHTMLElement(scope) &&
      scope.matches("[" + CONFIG.passwordToggleAttribute + "]")
    ) {
      initializePasswordToggle(scope);
    }

    if (
      isHTMLElement(scope) &&
      scope.matches("[data-account-toggle]")
    ) {
      initializeAccountDisclosure(scope);
    }

    scope.querySelectorAll(
      "form[" + CONFIG.formAttribute + "]"
    ).forEach(initializeAccountForm);

    scope.querySelectorAll(
      "[" + CONFIG.passwordToggleAttribute + "]"
    ).forEach(initializePasswordToggle);

    scope.querySelectorAll(
      "[data-account-toggle]"
    ).forEach(initializeAccountDisclosure);
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
     11. INITIALIZATION
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
    observeDynamicContent();

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeydown);

    document.documentElement.setAttribute(
      "data-mo-account",
      "ready"
    );
  }

  /* ---------------------------------------------------------
     12. CLEANUP AND PUBLIC API
     --------------------------------------------------------- */

  function destroy() {
    if (state.destroyed) {
      return;
    }

    document.removeEventListener("click", handleClick);
    document.removeEventListener("keydown", handleKeydown);

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
      state.announcementRegion &&
      state.announcementRegion.id === CONFIG.liveRegionId
    ) {
      state.announcementRegion.remove();
    }

    document.documentElement.removeAttribute(
      "data-mo-account"
    );

    state.destroyed = true;
  }

  window.MedOrbitsAccount = Object.freeze({
    announce: announce,
    refresh: function () {
      initializeWithin(document);
    },
    resetSubmission: resetSubmission,
    destroy: destroy
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
