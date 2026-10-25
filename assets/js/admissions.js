
/* =========================================================
   MEDORBITS | ADMISSIONS ENHANCEMENT LAYER
   File: assets/js/admissions.js
   Version: 1.0.0

   Features:
   - No dependencies or framework requirements
   - Compatible with existing MedOrbits CSS
   - Duplicate-load protection
   - Dynamic admissions forms and content
   - Accessible field validation and error messages
   - Optional multi-step application forms
   - Optional dependent field visibility
   - Document checklist progress
   - Optional file-upload validation
   - Submission-state protection
   - Accessible status announcements
   - Safe handling of user-entered information
   - No forced page dimensions, grids, or flex layouts

   Load with defer:
   <script src="/assets/js/admissions.js" defer></script>

   IMPORTANT:
   Admission eligibility, deadlines, fees, seat counts, and
   document requirements must come from verified data and
   the relevant official admission authority.
   ========================================================= */

(function medOrbitsAdmissions() {
  "use strict";

  const GLOBAL_KEY = "__MEDORBITS_ADMISSIONS_V1__";

  if (window[GLOBAL_KEY]) {
    return;
  }

  window[GLOBAL_KEY] = true;

  const CONFIG = Object.freeze({
    styleId: "medorbits-admissions-styles",
    liveRegionId: "mo-admissions-announcements",
    formSelector: "form[data-admissions-form]",
    errorClass: "mo-admissions-field-error",
    statusClass: "mo-admissions-status",
    hiddenClass: "mo-admissions-managed-hidden",
    stepAttribute: "data-admission-step",
    currentStepAttribute: "data-admission-current-step",
    submittingAttribute: "data-admission-submitting",
    announcementDelay: 40
  });

  const state = {
    initialized: false,
    destroyed: false,
    observer: null,
    announcementRegion: null,
    announcementTimer: null,
    injectedStyle: null,
    forms: new WeakSet(),
    submittingForms: new WeakSet(),
    steps: new WeakMap(),
    idCounter: 0
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

  function isVisible(element) {
    if (!isHTMLElement(element)) {
      return false;
    }

    if (element.hidden || element.closest("[hidden], [inert]")) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function safeFocus(element) {
    if (!isHTMLElement(element) || !isVisible(element)) {
      return false;
    }

    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      try {
        element.focus();
      } catch (fallbackError) {
        return false;
      }
    }

    return document.activeElement === element;
  }

  function ensureId(element, prefix) {
    if (!isHTMLElement(element)) {
      return "";
    }

    if (element.id) {
      return element.id;
    }

    state.idCounter += 1;

    element.id = prefix + "-" + state.idCounter;

    return element.id;
  }

  function getFormStatus(form) {
    if (!isHTMLElement(form)) {
      return null;
    }

    let status = form.querySelector("[data-admissions-status]");

    if (!status) {
      status = document.createElement("div");
      status.className = CONFIG.statusClass;
      status.setAttribute("data-admissions-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("aria-atomic", "true");

      form.appendChild(status);
    }

    return status;
  }

  function showFormStatus(form, message, type) {
    const status = getFormStatus(form);

    if (!status) {
      return;
    }

    status.textContent = message;
    status.setAttribute("data-status-type", type || "info");
    status.hidden = false;
  }

  function clearFormStatus(form) {
    const status = form.querySelector("[data-admissions-status]");

    if (!status) {
      return;
    }

    status.textContent = "";
    status.hidden = true;
    status.removeAttribute("data-status-type");
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
       * MedOrbits admissions utilities.
       * No global layout, typography, width, or height overrides.
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

      .${CONFIG.hiddenClass}[hidden] {
        display: none !important;
      }

      [data-admissions-form][data-admission-submitting="true"] {
        cursor: progress;
      }

      [data-admission-next]:focus-visible,
      [data-admission-prev]:focus-visible,
      [data-admission-step]:focus-visible {
        outline: 3px solid #b78b36;
        outline-offset: 3px;
      }

      @media (forced-colors: active) {
        [data-admission-next]:focus-visible,
        [data-admission-prev]:focus-visible {
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
    if (
      state.announcementRegion &&
      state.announcementRegion.isConnected
    ) {
      return state.announcementRegion;
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
     4. FIELD ERROR MANAGEMENT
     --------------------------------------------------------- */

  function getFieldError(field) {
    if (!isHTMLElement(field)) {
      return null;
    }

    const explicitErrorId = field.getAttribute(
      "data-admission-error"
    );

    if (explicitErrorId) {
      return getById(explicitErrorId);
    }

    if (field.id) {
      const existing = getById(field.id + "-error");

      if (existing) {
        return existing;
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

    field.setAttribute("aria-describedby", Array.from(ids).join(" "));
  }

  function removeDescribedBy(field, id) {
    if (!isHTMLElement(field) || !id) {
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

  function showFieldError(field, message) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.setAttribute("aria-invalid", "true");

    const error = getFieldError(field);

    if (!error) {
      return;
    }

    ensureId(error, "mo-admission-error");

    error.textContent = message;
    error.hidden = false;
    error.classList.add(CONFIG.errorClass);

    addDescribedBy(field, error.id);
  }

  function clearFieldError(field) {
    if (!isHTMLElement(field)) {
      return;
    }

    field.removeAttribute("aria-invalid");

    const error = getFieldError(field);

    if (error) {
      error.textContent = "";
      error.hidden = true;

      if (error.id) {
        removeDescribedBy(field, error.id);
      }
    }
  }

  function getValidationMessage(field) {
    if (!isHTMLElement(field)) {
      return "Please check this field.";
    }

    if (field.validity.valueMissing) {
      return "Please complete this required field.";
    }

    if (field.validity.typeMismatch) {
      if (field instanceof HTMLInputElement && field.type === "email") {
        return "Enter a valid email address.";
      }

      if (field instanceof HTMLInputElement && field.type === "url") {
        return "Enter a valid web address.";
      }

      return "Enter a value in the required format.";
    }

    if (field.validity.patternMismatch) {
      return field.getAttribute("data-pattern-message") ||
        "Please follow the required format.";
    }

    if (field.validity.tooShort) {
      return "The entered value is too short.";
    }

    if (field.validity.tooLong) {
      return "The entered value is too long.";
    }

    if (field.validity.rangeUnderflow || field.validity.rangeOverflow) {
      return "Enter a value within the permitted range.";
    }

    if (field.validity.badInput) {
      return "Enter a valid value.";
    }

    return field.validationMessage || "Please check this field.";
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

    showFieldError(field, getValidationMessage(field));

    return false;
  }

  function validateFields(container) {
    const fields = container.querySelectorAll(
      "input, select, textarea"
    );

    let firstInvalid = null;

    fields.forEach(function (field) {
      if (!validateField(field) && !firstInvalid) {
        firstInvalid = field;
      }
    });

    return {
      valid: firstInvalid === null,
      firstInvalid: firstInvalid
    };
  }

  /* ---------------------------------------------------------
     5. DEPENDENT FIELD VISIBILITY
     --------------------------------------------------------- */

  /*
   * Optional markup:
   *
   * <select id="course-type" name="courseType">
   *   <option value="">Choose a course</option>
   *   <option value="mbbs">MBBS</option>
   *   <option value="bds">BDS</option>
   * </select>
   *
   * <section data-admission-show-when="course-type:mbbs" hidden>
   *   ...
   * </section>
   *
   * This controls visibility only. It does not establish eligibility.
   */

  function updateConditionalSections(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    const sections = [];

    if (
      isHTMLElement(root) &&
      root.hasAttribute("data-admission-show-when")
    ) {
      sections.push(root);
    }

    root.querySelectorAll("[data-admission-show-when]")
      .forEach(function (section) {
        sections.push(section);
      });

    sections.forEach(function (section) {
      const expression = section.getAttribute(
        "data-admission-show-when"
      );

      if (!expression) {
        return;
      }

      const separator = expression.indexOf(":");

      if (separator < 1) {
        return;
      }

      const fieldId = expression.slice(0, separator).trim();
      const expectedValue = expression.slice(separator + 1).trim();
      const field = getById(fieldId);

      if (!(field instanceof HTMLInputElement ||
            field instanceof HTMLSelectElement ||
            field instanceof HTMLTextAreaElement)) {
        return;
      }

      const matches = field.value === expectedValue;

      section.classList.add(CONFIG.hiddenClass);
      section.hidden = !matches;

      if (!matches && section.contains(document.activeElement)) {
        safeFocus(field);
      }
    });
  }

  /* ---------------------------------------------------------
     6. DOCUMENT CHECKLISTS
     --------------------------------------------------------- */

  /*
   * Optional markup:
   *
   * <div data-document-checklist>
   *   <label>
   *     <input type="checkbox" data-document-required>
   *     Identity proof
   *   </label>
   *   <label>
   *     <input type="checkbox" data-document-required>
   *     Academic marksheet
   *   </label>
   *   <p data-document-progress aria-live="polite"></p>
   * </div>
   *
   * The listed documents must be supplied by verified
   * admission guidance. This script does not define them.
   */

  function updateDocumentChecklist(checklist) {
    if (!isHTMLElement(checklist)) {
      return;
    }

    const checkboxes = Array.from(
      checklist.querySelectorAll(
        'input[type="checkbox"][data-document-required]'
      )
    );

    const total = checkboxes.length;
    const completed = checkboxes.filter(function (checkbox) {
      return checkbox.checked;
    }).length;

    const progress = checklist.querySelector(
      "[data-document-progress]"
    );

    if (progress) {
      progress.textContent = total
        ? completed + " of " + total + " documents checked."
        : "No documents listed.";
    }

    checklist.setAttribute(
      "data-document-completed",
      String(completed)
    );

    checklist.setAttribute(
      "data-document-total",
      String(total)
    );
  }

  function updateAllDocumentChecklists(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    if (
      isHTMLElement(root) &&
      root.matches("[data-document-checklist]")
    ) {
      updateDocumentChecklist(root);
    }

    root.querySelectorAll("[data-document-checklist]")
      .forEach(updateDocumentChecklist);
  }

  /* ---------------------------------------------------------
     7. OPTIONAL FILE-UPLOAD VALIDATION
     --------------------------------------------------------- */

  /*
   * Optional attributes:
   *
   * data-max-size-mb="5"
   * data-allowed-types=".pdf,.jpg,.jpeg,.png"
   *
   * These are client-side usability checks only.
   * The server must independently validate uploads.
   */

  function validateFileInput(input) {
    if (!(input instanceof HTMLInputElement) ||
        input.type !== "file") {
      return true;
    }

    const files = Array.from(input.files || []);
    const maxSizeRaw = input.getAttribute("data-max-size-mb");
    const maxSizeMb = maxSizeRaw === null
      ? null
      : Number(maxSizeRaw);

    const allowedRaw = input.getAttribute("data-allowed-types");

    const allowedTypes = allowedRaw
      ? allowedRaw
          .split(",")
          .map(function (type) {
            return type.trim().toLowerCase();
          })
          .filter(Boolean)
      : [];

    let errorMessage = "";

    if (
      maxSizeMb !== null &&
      Number.isFinite(maxSizeMb) &&
      maxSizeMb >= 0
    ) {
      const maxBytes = maxSizeMb * 1024 * 1024;

      if (files.some(function (file) {
        return file.size > maxBytes;
      })) {
        errorMessage =
          "Each file must be no larger than " +
          maxSizeMb + " MB.";
      }
    }

    if (!errorMessage && allowedTypes.length) {
      const invalidFile = files.find(function (file) {
        const name = file.name.toLowerCase();

        return !allowedTypes.some(function (type) {
          if (type.startsWith(".")) {
            return name.endsWith(type);
          }

          if (type.includes("/")) {
            return file.type.toLowerCase() === type;
          }

          return false;
        });
      });

      if (invalidFile) {
        errorMessage =
          "Choose a file in an accepted format: " +
          allowedTypes.join(", ") + ".";
      }
    }

    if (errorMessage) {
      input.setCustomValidity(errorMessage);
      showFieldError(input, errorMessage);
      return false;
    }

    input.setCustomValidity("");
    clearFieldError(input);

    return true;
  }

  /* ---------------------------------------------------------
     8. MULTI-STEP APPLICATION FORMS
     --------------------------------------------------------- */

  /*
   * Opt in by adding data-admission-multistep to a form.
   *
   * Mark each step:
   * <section data-admission-step="1">...</section>
   * <section data-admission-step="2" hidden>...</section>
   *
   * Add navigation buttons:
   * <button type="button" data-admission-next>Continue</button>
   * <button type="button" data-admission-prev>Back</button>
   *
   * Navigation does not submit the form.
   */

  function getSteps(form) {
    return Array.from(
      form.querySelectorAll("[" + CONFIG.stepAttribute + "]")
    ).filter(function (step) {
      return step.closest("form") === form;
    });
  }

  function getCurrentStepIndex(form, steps) {
    const saved = Number(
      form.getAttribute(CONFIG.currentStepAttribute)
    );

    if (Number.isInteger(saved) && saved >= 0 && saved < steps.length) {
      return saved;
    }

    const visibleIndex = steps.findIndex(isVisible);

    return visibleIndex >= 0 ? visibleIndex : 0;
  }

  function renderStep(form, requestedIndex, shouldFocus) {
    const steps = getSteps(form);

    if (!steps.length) {
      return false;
    }

    const index = Math.max(
      0,
      Math.min(steps.length - 1, requestedIndex)
    );

    steps.forEach(function (step, stepIndex) {
      const active = stepIndex === index;

      step.hidden = !active;
      step.setAttribute("aria-hidden", String(!active));
    });

    form.setAttribute(
      CONFIG.currentStepAttribute,
      String(index)
    );

    const previousButtons = form.querySelectorAll(
      "[data-admission-prev]"
    );

    const nextButtons = form.querySelectorAll(
      "[data-admission-next]"
    );

    previousButtons.forEach(function (button) {
      button.hidden = index === 0;
      button.disabled = index === 0;
    });

    nextButtons.forEach(function (button) {
      button.hidden = index === steps.length - 1;
    });

    const stepTitle = steps[index].querySelector(
      "h1, h2, h3, [data-admission-step-title]"
    );

    if (shouldFocus) {
      if (stepTitle instanceof HTMLElement) {
        if (!stepTitle.hasAttribute("tabindex")) {
          stepTitle.setAttribute("tabindex", "-1");
        }

        safeFocus(stepTitle);
      } else {
        const firstField = steps[index].querySelector(
          "input:not(:disabled), select:not(:disabled), " +
          "textarea:not(:disabled), button:not(:disabled)"
        );

        if (firstField instanceof HTMLElement) {
          safeFocus(firstField);
        }
      }
    }

    announce(
      "Step " + (index + 1) + " of " + steps.length + "."
    );

    return true;
  }

  function validateCurrentStep(form) {
    const steps = getSteps(form);

    if (!steps.length) {
      return true;
    }

    const index = getCurrentStepIndex(form, steps);
    const result = validateFields(steps[index]);

    if (!result.valid) {
      safeFocus(result.firstInvalid);

      if (typeof result.firstInvalid.reportValidity === "function") {
        result.firstInvalid.reportValidity();
      }

      showFormStatus(
        form,
        "Complete the required fields in this step before continuing.",
        "error"
      );

      announce("Please correct the fields in this step.");

      return false;
    }

    return true;
  }

  /* ---------------------------------------------------------
     9. SUBMISSION-STATE MANAGEMENT
     --------------------------------------------------------- */

  function resetSubmission(form) {
    if (!isHTMLElement(form)) {
      return;
    }

    state.submittingForms.delete(form);
    form.removeAttribute(CONFIG.submittingAttribute);
    clearFormStatus(form);
  }

  function handleFormSubmit(form, event) {
    if (state.submittingForms.has(form)) {
      event.preventDefault();

      showFormStatus(
        form,
        "This application is already being submitted.",
        "warning"
      );

      return;
    }

    const steps = getSteps(form);

    if (steps.length) {
      const currentIndex = getCurrentStepIndex(form, steps);
      const lastIndex = steps.length - 1;

      // Do not allow final submission from an earlier step.
      if (currentIndex < lastIndex) {
        event.preventDefault();

        if (validateCurrentStep(form)) {
          renderStep(form, currentIndex + 1, true);
        }

        return;
      }
    }

    const fieldResult = validateFields(form);

    if (!fieldResult.valid) {
      event.preventDefault();

      showFormStatus(
        form,
        "Please review the highlighted fields.",
        "error"
      );

      safeFocus(fieldResult.firstInvalid);

      if (
        fieldResult.firstInvalid &&
        typeof fieldResult.firstInvalid.reportValidity === "function"
      ) {
        fieldResult.firstInvalid.reportValidity();
      }

      announce("Please correct the application form errors.");

      return;
    }

    const invalidFile = Array.from(
      form.querySelectorAll('input[type="file"]')
    ).find(function (input) {
      return !validateFileInput(input);
    });

    if (invalidFile) {
      event.preventDefault();
      safeFocus(invalidFile);

      showFormStatus(
        form,
        "Please check the uploaded file requirements.",
        "error"
      );

      return;
    }

    /*
     * Do not prevent a valid submission here.
     * Native form submission and existing submit handlers can proceed.
     */
    state.submittingForms.add(form);

    form.setAttribute(CONFIG.submittingAttribute, "true");

    showFormStatus(
      form,
      "Submitting your application…",
      "pending"
    );
  }

  /* ---------------------------------------------------------
     10. FORM INITIALIZATION
     --------------------------------------------------------- */

  function initializeForm(form) {
    if (
      !isHTMLElement(form) ||
      state.forms.has(form)
    ) {
      return;
    }

    state.forms.add(form);

    form.setAttribute("data-admissions-ready", "true");

    form.querySelectorAll("input, select, textarea")
      .forEach(function (field) {
        field.addEventListener("input", function () {
          if (
            field instanceof HTMLInputElement &&
            field.type === "file"
          ) {
            validateFileInput(field);
          } else if (field.validity.valid) {
            clearFieldError(field);
          }

          updateConditionalSections(form);
          updateAllDocumentChecklists(form);
        });

        field.addEventListener("change", function () {
          if (
            field instanceof HTMLInputElement &&
            field.type === "file"
          ) {
            validateFileInput(field);
          }

          updateConditionalSections(form);
          updateAllDocumentChecklists(form);
        });
      });

    form.addEventListener("submit", function (event) {
      handleFormSubmit(form, event);
    });

    form.addEventListener("reset", function () {
      // Let the browser reset values before updating feedback.
      window.setTimeout(function () {
        form.querySelectorAll("input, select, textarea")
          .forEach(clearFieldError);

        form.querySelectorAll('input[type="file"]')
          .forEach(function (input) {
            input.setCustomValidity("");
          });

        resetSubmission(form);
        updateConditionalSections(form);
        updateAllDocumentChecklists(form);

        const steps = getSteps(form);

        if (steps.length) {
          renderStep(form, 0, false);
        }
      }, 0);
    });

    updateConditionalSections(form);
    updateAllDocumentChecklists(form);

    const steps = getSteps(form);

    if (steps.length) {
      renderStep(
        form,
        getCurrentStepIndex(form, steps),
        false
      );
    }
  }

  /* ---------------------------------------------------------
     11. DELEGATED INTERACTIONS
     --------------------------------------------------------- */

  function handleClick(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const nextButton = event.target.closest(
      "[data-admission-next]"
    );

    if (nextButton instanceof HTMLElement) {
      const form = nextButton.closest(CONFIG.formSelector);

      if (!form || isDisabled(nextButton)) {
        return;
      }

      event.preventDefault();

      if (!validateCurrentStep(form)) {
        return;
      }

      const steps = getSteps(form);
      const index = getCurrentStepIndex(form, steps);

      if (index < steps.length - 1) {
        renderStep(form, index + 1, true);
      }

      return;
    }

    const previousButton = event.target.closest(
      "[data-admission-prev]"
    );

    if (previousButton instanceof HTMLElement) {
      const form = previousButton.closest(CONFIG.formSelector);

      if (!form || isDisabled(previousButton)) {
        return;
      }

      event.preventDefault();

      const steps = getSteps(form);
      const index = getCurrentStepIndex(form, steps);

      if (index > 0) {
        renderStep(form, index - 1, true);
      }

      return;
    }

    const resetButton = event.target.closest(
      "[data-admissions-reset]"
    );

    if (resetButton instanceof HTMLElement) {
      const form = resetButton.closest(CONFIG.formSelector);

      if (form && !isDisabled(resetButton)) {
        window.setTimeout(function () {
          resetSubmission(form);
        }, 0);
      }
    }
  }

  function handleKeydown(event) {
    if (event.defaultPrevented || event.key !== "Escape") {
      return;
    }

    // No global focus trap or global Escape interception.
    // Application-specific overlays should manage their own state.
  }

  /* ---------------------------------------------------------
     12. DYNAMIC CONTENT
     --------------------------------------------------------- */

  function initializeWithin(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }

    if (
      isHTMLElement(root) &&
      root.matches(CONFIG.formSelector)
    ) {
      initializeForm(root);
    }

    root.querySelectorAll(CONFIG.formSelector)
      .forEach(initializeForm);

    updateConditionalSections(root);
    updateAllDocumentChecklists(root);
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
     13. INITIALIZATION
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
      "data-mo-admissions",
      "ready"
    );
  }

  /* ---------------------------------------------------------
     14. PUBLIC API AND CLEANUP
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

    document.documentElement.removeAttribute("data-mo-admissions");

    state.destroyed = true;
  }

  window.MedOrbitsAdmissions = Object.freeze({
    announce: announce,

    refresh: function () {
      initializeWithin(document);
    },

    validateForm: function (formOrId) {
      const form = typeof formOrId === "string"
        ? getById(formOrId)
        : formOrId;

      if (!isHTMLElement(form)) {
        return false;
      }

      return validateFields(form).valid;
    },

    updateConditionalSections: updateConditionalSections,
    updateDocumentChecklist: updateAllDocumentChecklists,
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
