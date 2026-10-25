
/* =========================================================
   MEDORBITS | MULTI-STEP FORM CONTROLLER
   File: assets/js/form-steps.js
   Version: 1.0.0

   Features:
   - Multi-step form navigation
   - Current step and progress indicator
   - Step-level validation
   - Required field and native constraint validation
   - Conditional fields and sections
   - Review screen population
   - Back, next, and submit controls
   - Accessible announcements and focus management
   - Dynamic content support
   - Optional draft persistence
   - No external dependencies

   Supported attributes:
   [data-form-steps]
   [data-form-step]
   [data-form-next]
   [data-form-prev]
   [data-form-submit]
   [data-form-progress]
   [data-form-progress-bar]
   [data-form-step-indicator]
   [data-form-error]
   [data-form-review]
   [data-form-review-field]
   [data-form-condition]
   [data-form-draft-key]
   [data-form-save-draft]
   [data-form-clear-draft]

   ========================================================= */

(function medOrbitsFormStepsModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_FORM_STEPS_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    selectors: {
      form: "[data-form-steps]",
      step: "[data-form-step]",
      next: "[data-form-next]",
      previous: "[data-form-prev]",
      submit: "[data-form-submit]",
      progress: "[data-form-progress]",
      progressBar: "[data-form-progress-bar]",
      indicator: "[data-form-step-indicator]",
      error: "[data-form-error]",
      review: "[data-form-review]",
      reviewField: "[data-form-review-field]",
      condition: "[data-form-condition]",
      saveDraft: "[data-form-save-draft]",
      clearDraft: "[data-form-clear-draft]"
    },
    maxDraftBytes: 100000
  };

  var state = {
    initialized: false,
    destroyed: false,
    observer: null,
    forms: new WeakMap(),
    formElements: new Set()
  };

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 1000);
  }

  function getElement(root, selector) {
    return root ? root.querySelector(selector) : null;
  }

  function getElements(root, selector) {
    return root ? Array.from(root.querySelectorAll(selector)) : [];
  }

  function addListener(record, element, eventName, handler, options) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler, options || false);

    record.listeners.push(function () {
      element.removeEventListener(eventName, handler, options || false);
    });
  }

  function safeStorage() {
    try {
      var key = "__medorbits_form_steps_test__";
      window.sessionStorage.setItem(key, "1");
      window.sessionStorage.removeItem(key);
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function createAnnouncer(record) {
    var existing = getElement(record.form, "[data-form-announcer]");

    if (existing) {
      existing.setAttribute("aria-live", "polite");
      existing.setAttribute("aria-atomic", "true");
      return existing;
    }

    var region = document.createElement("div");
    region.setAttribute("data-form-announcer", "");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.className = "mo-form-visually-hidden";
    record.form.appendChild(region);

    return region;
  }

  function announce(record, message) {
    if (!record.announcer) {
      return;
    }

    record.announcer.textContent = "";

    window.requestAnimationFrame(function () {
      if (record.announcer && record.announcer.isConnected) {
        record.announcer.textContent = cleanText(message, 500);
      }
    });
  }

  function injectStyles() {
    if (document.getElementById("mo-form-steps-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mo-form-steps-styles";

    style.textContent = [
      ".mo-form-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}",
      "[data-form-steps] [hidden]{display:none!important}",
      "[data-form-steps] [aria-invalid='true']{outline-offset:2px}",
      "[data-form-steps] [data-form-step][hidden]{display:none!important}"
    ].join("\n");

    document.head.appendChild(style);
    state.styleElement = style;
  }

  function getSteps(record) {
    return getElements(record.form, CONFIG.selectors.step).filter(function (step) {
      return step.closest(CONFIG.selectors.form) === record.form;
    });
  }

  function getCurrentStep(record) {
    var steps = getSteps(record);
    return steps[record.currentIndex] || null;
  }

  function getStepHeading(step) {
    return step.querySelector(
      "[data-form-step-title], h1, h2, h3, legend"
    );
  }

  function focusStep(step) {
    if (!step) {
      return;
    }

    var heading = getStepHeading(step);

    if (heading) {
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }

      heading.focus({ preventScroll: false });
      return;
    }

    var firstField = step.querySelector(
      'input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );

    if (firstField) {
      firstField.focus({ preventScroll: false });
    } else {
      step.setAttribute("tabindex", "-1");
      step.focus({ preventScroll: false });
    }
  }

  function isEffectivelyHidden(element) {
    if (!element) {
      return true;
    }

    return Boolean(
      element.hidden ||
      element.closest("[hidden]") ||
      element.closest('[aria-hidden="true"]') ||
      element.closest("[data-form-condition-hidden]")
    );
  }

  function getValidationFields(container) {
    return getElements(
      container,
      "input,select,textarea"
    ).filter(function (field) {
      return (
        !field.disabled &&
        field.type !== "hidden" &&
        !field.hasAttribute("data-form-skip-validation") &&
        !isEffectivelyHidden(field)
      );
    });
  }

  function clearFieldError(field) {
    field.removeAttribute("aria-invalid");

    var errorId = field.getAttribute("data-form-error-id");

    if (errorId) {
      var errorElement = document.getElementById(errorId);

      if (errorElement && errorElement.hasAttribute("data-mo-form-error-created")) {
        errorElement.remove();
      }

      field.removeAttribute("data-form-error-id");
    }

    var describedBy = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean);

    if (errorId) {
      describedBy = describedBy.filter(function (id) {
        return id !== errorId;
      });
    }

    if (describedBy.length) {
      field.setAttribute("aria-describedby", describedBy.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function showFieldError(field, message) {
    clearFieldError(field);

    field.setAttribute("aria-invalid", "true");

    var error = document.createElement("span");
    error.setAttribute("data-mo-form-error-created", "");
    error.setAttribute("role", "alert");
    error.textContent = cleanText(message, 500);

    var errorId = field.id
      ? field.id + "-step-error"
      : "mo-form-step-error-" + Math.random().toString(36).slice(2, 10);

    error.id = errorId;
    field.setAttribute("data-form-error-id", errorId);

    var describedBy = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean);

    if (!describedBy.includes(errorId)) {
      describedBy.push(errorId);
    }

    field.setAttribute("aria-describedby", describedBy.join(" "));

    field.insertAdjacentElement("afterend", error);
  }

  function getFieldError(field) {
    if (field.validity.valid) {
      return "";
    }

    if (field.validity.valueMissing) {
      return "This field is required.";
    }

    if (field.validity.typeMismatch) {
      return field.type === "email"
        ? "Enter a valid email address."
        : "Enter a value in the required format.";
    }

    if (field.validity.patternMismatch) {
      return "The value does not match the required format.";
    }

    if (field.validity.tooShort) {
      return "Enter at least " + field.minLength + " characters.";
    }

    if (field.validity.tooLong) {
      return "Enter no more than " + field.maxLength + " characters.";
    }

    if (field.validity.rangeUnderflow) {
      return "The value must be at least " + field.min + ".";
    }

    if (field.validity.rangeOverflow) {
      return "The value must not exceed " + field.max + ".";
    }

    if (field.validity.stepMismatch) {
      return "Enter a value that matches the allowed increment.";
    }

    if (field.validity.badInput) {
      return "Enter a valid value.";
    }

    return "Check this field and try again.";
  }

  function validateContainer(record, container, focusInvalid) {
    var fields = getValidationFields(container);
    var invalidFields = [];

    fields.forEach(function (field) {
      clearFieldError(field);

      if (!field.checkValidity()) {
        invalidFields.push(field);
        showFieldError(field, getFieldError(field));
      }
    });

    if (invalidFields.length) {
      var message = invalidFields.length +
        (invalidFields.length === 1
          ? " field needs your attention."
          : " fields need your attention.");

      announce(record, message);

      var errorSummary = getElement(
        record.form,
        CONFIG.selectors.error
      );

      if (errorSummary) {
        errorSummary.hidden = false;
        errorSummary.textContent = message;
      }

      if (focusInvalid) {
        invalidFields[0].focus();
      }

      return false;
    }

    var errorSummary = getElement(record.form, CONFIG.selectors.error);

    if (errorSummary) {
      errorSummary.hidden = true;
      errorSummary.textContent = "";
    }

    return true;
  }

  function getConditionValue(record, fieldName) {
    var field = record.form.elements.namedItem(fieldName);

    if (!field) {
      return "";
    }

    if (field instanceof RadioNodeList) {
      return field.value || "";
    }

    if (field.type === "checkbox") {
      return field.checked ? field.value || "true" : "false";
    }

    if (field.type === "radio") {
      var checked = record.form.querySelector(
        'input[type="radio"][name="' + CSS.escape(field.name) + '"]:checked'
      );

      return checked ? checked.value : "";
    }

    if (field.multiple && field.options) {
      return Array.from(field.selectedOptions).map(function (option) {
        return option.value;
      });
    }

    return field.value == null ? "" : field.value;
  }

  function updateConditions(record) {
    getElements(record.form, "[data-form-condition]").forEach(function (section) {
      var expression = cleanText(
        section.getAttribute("data-form-condition"),
        300
      );

      var separator = expression.indexOf(":");

      if (separator < 1) {
        return;
      }

      var fieldName = expression.slice(0, separator).trim();
      var expectedValue = expression.slice(separator + 1).trim();
      var actualValue = getConditionValue(record, fieldName);

      var matches = Array.isArray(actualValue)
        ? actualValue.includes(expectedValue)
        : String(actualValue) === expectedValue;

      section.hidden = !matches;
      section.setAttribute("data-form-condition-hidden", String(!matches));

      getElements(section, "input,select,textarea").forEach(function (field) {
        if (!matches) {
          field.setAttribute("data-form-condition-disabled", "true");
          field.disabled = true;
          clearFieldError(field);
        } else if (field.hasAttribute("data-form-condition-disabled")) {
          field.removeAttribute("data-form-condition-disabled");
          field.disabled = false;
        }
      });
    });
  }

  function updateReview(record) {
    var review = getElement(record.form, CONFIG.selectors.review);

    if (!review) {
      return;
    }

    getElements(review, CONFIG.selectors.reviewField).forEach(function (target) {
      var fieldName = cleanText(
        target.getAttribute("data-form-review-field"),
        160
      );

      if (!fieldName) {
        return;
      }

      var value = getConditionValue(record, fieldName);

      if (Array.isArray(value)) {
        value = value.join(", ");
      }

      var field = record.form.elements.namedItem(fieldName);

      if (field && field.type === "file") {
        value = Array.from(field.files || []).map(function (file) {
          return file.name;
        }).join(", ");
      }

      target.textContent = cleanText(value || "Not provided", 1000);
    });
  }

  function updateProgress(record) {
    var steps = getSteps(record);
    var total = steps.length;
    var current = Math.min(record.currentIndex + 1, total);
    var percentage = total ? Math.round((current / total) * 100) : 0;

    var progress = getElement(record.form, CONFIG.selectors.progress);

    if (progress) {
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.setAttribute("aria-valuenow", String(percentage));

      if (progress.tagName === "PROGRESS") {
        progress.max = 100;
        progress.value = percentage;
      }
    }

    var bar = getElement(record.form, CONFIG.selectors.progressBar);

    if (bar) {
      bar.style.width = percentage + "%";
      bar.setAttribute("aria-valuenow", String(percentage));
    }

    var indicator = getElement(record.form, CONFIG.selectors.indicator);

    if (indicator) {
      indicator.textContent = "Step " + current + " of " + total;
    }

    steps.forEach(function (step, index) {
      step.setAttribute("aria-current", index === record.currentIndex ? "step" : "false");

      getElements(step, "[data-form-step-marker]").forEach(function (marker) {
        marker.setAttribute(
          "aria-current",
          index === record.currentIndex ? "step" : "false"
        );

        marker.setAttribute(
          "data-step-state",
          index < record.currentIndex
            ? "completed"
            : index === record.currentIndex
              ? "current"
              : "upcoming"
        );
      });
    });
  }

  function renderStep(record, shouldFocus) {
    var steps = getSteps(record);

    if (!steps.length) {
      return false;
    }

    record.currentIndex = Math.max(
      0,
      Math.min(record.currentIndex, steps.length - 1)
    );

    steps.forEach(function (step, index) {
      step.hidden = index !== record.currentIndex;
    });

    var previousButtons = getElements(
      record.form,
      CONFIG.selectors.previous
    );

    previousButtons.forEach(function (button) {
      button.disabled = record.currentIndex === 0;
      button.hidden = record.currentIndex === 0 &&
        button.hasAttribute("data-form-hide-on-first-step");
    });

    var nextButtons = getElements(record.form, CONFIG.selectors.next);

    nextButtons.forEach(function (button) {
      button.hidden = record.currentIndex === steps.length - 1;
    });

    var submitButtons = getElements(record.form, CONFIG.selectors.submit);

    submitButtons.forEach(function (button) {
      button.hidden = record.currentIndex !== steps.length - 1;
    });

    updateProgress(record);
    updateConditions(record);
    updateReview(record);

    if (shouldFocus) {
      focusStep(steps[record.currentIndex]);
      announce(record, "Step " + (record.currentIndex + 1) + " of " + steps.length);
    }

    return true;
  }

  function goNext(record) {
    var steps = getSteps(record);
    var currentStep = getCurrentStep(record);

    if (!currentStep || !validateContainer(record, currentStep, true)) {
      return false;
    }

    if (record.currentIndex < steps.length - 1) {
      record.currentIndex += 1;
      renderStep(record, true);
      return true;
    }

    return false;
  }

  function goPrevious(record) {
    if (record.currentIndex <= 0) {
      return false;
    }

    record.currentIndex -= 1;
    renderStep(record, true);
    return true;
  }

  function getDraftKey(record) {
    return cleanText(
      record.form.getAttribute("data-form-draft-key"),
      160
    );
  }

  function saveDraft(record) {
    var storage = safeStorage();
    var key = getDraftKey(record);

    if (!storage || !key || !record.form.hasAttribute("data-form-save-draft")) {
      return false;
    }

    var data = {
      version: 1,
      currentStep: record.currentIndex,
      values: {}
    };

    Array.from(record.form.elements).forEach(function (field) {
      if (
        !field.name ||
        field.disabled ||
        field.type === "password" ||
        field.type === "file" ||
        field.type === "submit" ||
        field.type === "button" ||
        field.type === "reset"
      ) {
        return;
      }

      if (field.type === "checkbox" || field.type === "radio") {
        if (!field.checked) {
          return;
        }

        if (!Array.isArray(data.values[field.name])) {
          data.values[field.name] = [];
        }

        data.values[field.name].push(field.value);
        return;
      }

      data.values[field.name] = field.value;
    });

    try {
      var serialized = JSON.stringify(data);

      if (serialized.length > CONFIG.maxDraftBytes) {
        announce(record, "Draft is too large to save.");
        return false;
      }

      storage.setItem("medorbits-form-draft:" + key, serialized);
      announce(record, "Draft saved on this device.");
      return true;
    } catch (error) {
      announce(record, "Draft could not be saved in this browser.");
      return false;
    }
  }

  function restoreDraft(record) {
    var storage = safeStorage();
    var key = getDraftKey(record);

    if (!storage || !key || !record.form.hasAttribute("data-form-save-draft")) {
      return false;
    }

    try {
      var serialized = storage.getItem("medorbits-form-draft:" + key);

      if (!serialized || serialized.length > CONFIG.maxDraftBytes) {
        return false;
      }

      var data = JSON.parse(serialized);

      if (!data || data.version !== 1 || !data.values) {
        return false;
      }

      Object.keys(data.values).forEach(function (name) {
        var field = record.form.elements.namedItem(name);
        var value = data.values[name];

        if (!field) {
          return;
        }

        if (field instanceof RadioNodeList) {
          Array.from(field).forEach(function (item) {
            if (item.type === "radio") {
              item.checked = item.value === value;
            } else if (item.type === "checkbox") {
              item.checked = Array.isArray(value) && value.includes(item.value);
            }
          });
          return;
        }

        if (field.type === "password" || field.type === "file") {
          return;
        }

        if (field.type === "checkbox") {
          field.checked = Array.isArray(value)
            ? value.includes(field.value)
            : Boolean(value);
          return;
        }

        if (field.type === "radio") {
          field.checked = field.value === value;
          return;
        }

        if (field.multiple && Array.isArray(value)) {
          Array.from(field.options).forEach(function (option) {
            option.selected = value.includes(option.value);
          });
          return;
        }

        field.value = typeof value === "string" ? value : "";
      });

      record.currentIndex = Number.isInteger(data.currentStep)
        ? data.currentStep
        : 0;

      updateConditions(record);
      updateReview(record);
      renderStep(record, false);

      announce(record, "Saved draft restored.");
      return true;
    } catch (error) {
      return false;
    }
  }

  function clearDraft(record) {
    var storage = safeStorage();
    var key = getDraftKey(record);

    if (!storage || !key) {
      return false;
    }

    try {
      storage.removeItem("medorbits-form-draft:" + key);
      announce(record, "Saved draft cleared.");
      return true;
    } catch (error) {
      return false;
    }
  }

  function initializeForm(form) {
    if (!form || state.forms.has(form)) {
      return state.forms.get(form) || null;
    }

    var record = {
      form: form,
      currentIndex: 0,
      listeners: [],
      announcer: null
    };

    state.forms.set(form, record);
    state.formElements.add(form);
    record.announcer = createAnnouncer(record);

    addListener(record, form, "click", function (event) {
      var next = event.target.closest(CONFIG.selectors.next);
      var previous = event.target.closest(CONFIG.selectors.previous);
      var clear = event.target.closest(CONFIG.selectors.clearDraft);
      var save = event.target.closest(CONFIG.selectors.saveDraft);

      if (!form.contains(event.target)) {
        return;
      }

      if (next) {
        event.preventDefault();
        goNext(record);
      } else if (previous) {
        event.preventDefault();
        goPrevious(record);
      } else if (save) {
        event.preventDefault();
        saveDraft(record);
      } else if (clear) {
        event.preventDefault();
        clearDraft(record);
      }
    });

    addListener(record, form, "input", function (event) {
      var field = event.target;

      if (!field.matches("input,select,textarea")) {
        return;
      }

      clearFieldError(field);
      updateConditions(record);
      updateReview(record);

      if (form.hasAttribute("data-form-save-draft") &&
          form.hasAttribute("data-form-autosave")) {
        saveDraft(record);
      }
    });

    addListener(record, form, "change", function () {
      updateConditions(record);
      updateReview(record);
    });

    addListener(record, form, "submit", function (event) {
      var steps = getSteps(record);

      updateConditions(record);

      /*
       * Validate all active, visible fields before allowing the
       * form's normal submit handler to proceed.
       */
      var valid = validateContainer(record, form, false);

      if (!valid) {
        event.preventDefault();

        var firstInvalid = getValidationFields(form).find(function (field) {
          return !field.checkValidity();
        });

        if (firstInvalid) {
          var owningStep = firstInvalid.closest(CONFIG.selectors.step);

          if (owningStep) {
            var stepIndex = steps.indexOf(owningStep);

            if (stepIndex >= 0 && stepIndex !== record.currentIndex) {
              record.currentIndex = stepIndex;
              renderStep(record, false);
            }
          }

          firstInvalid.focus();
        }

        announce(record, "Please correct the highlighted fields before submitting.");
        return;
      }

      updateReview(record);

      /*
       * Draft removal is intentionally not automatic here.
       * A page may need to retain the draft if a network request fails.
       * Clear it after the application has been successfully accepted.
       */
    }, true);

    renderStep(record, false);

    if (form.hasAttribute("data-form-restore-draft")) {
      restoreDraft(record);
    }

    return record;
  }

  function refresh() {
    if (state.destroyed) {
      return;
    }

    injectStyles();

    getElements(document, CONFIG.selectors.form).forEach(function (form) {
      initializeForm(form);
    });
  }

  function findRecord(formOrElement) {
    if (!formOrElement) {
      return null;
    }

    var form = formOrElement.matches &&
      formOrElement.matches(CONFIG.selectors.form)
      ? formOrElement
      : formOrElement.closest
        ? formOrElement.closest(CONFIG.selectors.form)
        : null;

    return form ? state.forms.get(form) || null : null;
  }

  function setStep(formOrElement, index) {
    var record = findRecord(formOrElement);
    var steps = record ? getSteps(record) : [];

    if (!record || !Number.isInteger(index) || index < 0 || index >= steps.length) {
      return false;
    }

    /*
     * Forward navigation validates the current step first.
     * Going backwards does not block the user.
     */
    if (index > record.currentIndex) {
      for (var i = record.currentIndex; i < index; i += 1) {
        if (!validateContainer(record, steps[i], true)) {
          record.currentIndex = i;
          renderStep(record, false);
          return false;
        }
      }
    }

    record.currentIndex = index;
    renderStep(record, true);
    return true;
  }

  function destroyRecord(record) {
    record.listeners.forEach(function (removeListener) {
      try {
        removeListener();
      } catch (error) {
        // Continue cleanup.
      }
    });

    record.listeners = [];
  }

  function destroy() {
    if (state.destroyed) {
      return;
    }

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.formElements.forEach(function (form) {
      var record = state.forms.get(form);

      if (record) {
        destroyRecord(record);
      }
    });

    state.formElements.clear();

    if (state.styleElement && state.styleElement.parentNode) {
      state.styleElement.remove();
    }

    state.destroyed = true;
  }

  var publicAPI = {
    version: "1.0.0",
    refresh: refresh,
    setStep: setStep,
    next: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? goNext(record) : false;
    },
    previous: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? goPrevious(record) : false;
    },
    validate: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? validateContainer(record, record.form, true) : false;
    },
    saveDraft: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? saveDraft(record) : false;
    },
    restoreDraft: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? restoreDraft(record) : false;
    },
    clearDraft: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? clearDraft(record) : false;
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = publicAPI;
  window.MedOrbitsFormSteps = publicAPI;

  function initialize() {
    if (state.initialized || state.destroyed) {
      return;
    }

    state.initialized = true;
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var shouldRefresh = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(CONFIG.selectors.form)) ||
                (node.querySelector && node.querySelector(CONFIG.selectors.form))
              );
          });
        });

        if (shouldRefresh) {
          refresh();
        }
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
