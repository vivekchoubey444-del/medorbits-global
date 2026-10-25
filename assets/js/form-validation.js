
/* =========================================================
   MEDORBITS | FORM VALIDATION
   File: assets/js/form-validation.js
   Version: 1.0.0
   No external dependencies.
   ========================================================= */

(function MedOrbitsFormValidation() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_FORM_VALIDATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var CONFIG = {
    formSelector: "form[data-validate], form[data-form-validation]",
    fieldSelector: "input, select, textarea",
    maxFileSize: 10 * 1024 * 1024,
    defaultExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
  };

  var state = {
    forms: new WeakMap(),
    elements: new Set(),
    observer: null,
    initialized: false,
    destroyed: false
  };

  function clean(value, max) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max || 1000);
  }

  function listen(record, element, event, handler, options) {
    element.addEventListener(event, handler, options || false);

    record.listeners.push(function () {
      element.removeEventListener(event, handler, options || false);
    });
  }

  function getErrorElement(field) {
    var id = field.getAttribute("data-validation-error-id");
    return id ? document.getElementById(id) : null;
  }

  function clearError(field) {
    field.removeAttribute("aria-invalid");

    var error = getErrorElement(field);

    if (error && error.hasAttribute("data-mo-validation-error")) {
      error.remove();
    }

    field.removeAttribute("data-validation-error-id");

    var describedBy = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean);

    if (error) {
      describedBy = describedBy.filter(function (id) {
        return id !== error.id;
      });
    }

    if (describedBy.length) {
      field.setAttribute("aria-describedby", describedBy.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function getMessage(field) {
    if (field.validity.valueMissing) {
      return "This field is required.";
    }

    if (field.validity.typeMismatch) {
      return field.type === "email"
        ? "Enter a valid email address."
        : "Enter a valid value.";
    }

    if (field.validity.patternMismatch) {
      return field.getAttribute("data-pattern-message") ||
        "The value does not match the required format.";
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

    if (field.validity.badInput) {
      return "Enter a valid value.";
    }

    if (field.validity.customError) {
      return field.validationMessage || "Please check this field.";
    }

    return "Please check this field.";
  }

  function showError(field, message) {
    clearError(field);

    field.setAttribute("aria-invalid", "true");

    var error = document.createElement("span");
    var errorId = field.id
      ? field.id + "-validation-error"
      : "mo-validation-error-" + Math.random().toString(36).slice(2, 10);

    error.id = errorId;
    error.setAttribute("data-mo-validation-error", "");
    error.setAttribute("role", "alert");
    error.textContent = clean(message, 500);

    field.setAttribute("data-validation-error-id", errorId);

    var ids = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean);

    if (!ids.includes(errorId)) {
      ids.push(errorId);
    }

    field.setAttribute("aria-describedby", ids.join(" "));
    field.insertAdjacentElement("afterend", error);
  }

  function validateFile(field) {
    var files = Array.from(field.files || []);
    var maxMB = Number(field.getAttribute("data-max-size-mb"));
    var maxBytes = Number.isFinite(maxMB) && maxMB > 0
      ? Math.min(maxMB * 1024 * 1024, 100 * 1024 * 1024)
      : CONFIG.maxFileSize;

    var extensions = (field.getAttribute("data-allowed-extensions") ||
      CONFIG.defaultExtensions.join(","))
      .split(",")
      .map(function (extension) {
        extension = extension.trim().toLowerCase();
        return extension.charAt(0) === "." ? extension : "." + extension;
      });

    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      var dot = file.name.lastIndexOf(".");
      var extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";

      if (!extensions.includes(extension)) {
        return "Unsupported file type. Allowed: " + extensions.join(", ") + ".";
      }

      if (file.size <= 0) {
        return "The selected file is empty.";
      }

      if (file.size > maxBytes) {
        return "File size must not exceed " +
          (maxBytes / (1024 * 1024)) + " MB.";
      }
    }

    var maxCount = Number.parseInt(
      field.getAttribute("data-max-files") || (field.multiple ? "5" : "1"),
      10
    );

    if (files.length > maxCount) {
      return "Select no more than " + maxCount + " file(s).";
    }

    return "";
  }

  function validateField(field, form) {
    clearError(field);

    if (
      field.disabled ||
      field.type === "hidden" ||
      field.closest("[hidden]") ||
      field.closest('[aria-hidden="true"]')
    ) {
      return true;
    }

    var customMessage = "";

    if (field.type === "file") {
      customMessage = validateFile(field);
    }

    var confirmId = field.getAttribute("data-confirm-field");

    if (confirmId) {
      var confirmField = form.querySelector(
        "#" + (window.CSS && CSS.escape
          ? CSS.escape(confirmId)
          : confirmId.replace(/[^a-zA-Z0-9_-]/g, "\\$&"))
      );

      if (confirmField && field.value !== confirmField.value) {
        customMessage = "The values do not match.";
      }
    }

    var confirmSource = field.getAttribute("data-confirm-password");

    if (confirmSource) {
      var sourceField = form.querySelector(
        "#" + (window.CSS && CSS.escape
          ? CSS.escape(confirmSource)
          : confirmSource.replace(/[^a-zA-Z0-9_-]/g, "\\$&"))
      );

      if (sourceField && field.value !== sourceField.value) {
        customMessage = "Passwords do not match.";
      }
    }

    if (field.hasAttribute("data-validate-phone") && field.value.trim()) {
      var digits = field.value.replace(/\D/g, "");

      if (digits.length < 7 || digits.length > 15) {
        customMessage = "Enter a valid phone number.";
      }
    }

    if (
      field.hasAttribute("data-validate-password") &&
      field.value &&
      field.value.length < 8
    ) {
      customMessage = "Password must contain at least 8 characters.";
    }

    if (!customMessage && !field.checkValidity()) {
      customMessage = getMessage(field);
    }

    if (customMessage) {
      showError(field, customMessage);
      return false;
    }

    return true;
  }

  function announce(record, message) {
    if (!record.announcer) {
      return;
    }

    record.announcer.textContent = clean(message, 500);
  }

  function validateForm(record, focusFirst) {
    var fields = Array.from(
      record.form.querySelectorAll(CONFIG.fieldSelector)
    ).filter(function (field) {
      return !field.matches("[data-validation-skip]");
    });

    var invalid = [];

    fields.forEach(function (field) {
      if (!validateField(field, record.form)) {
        invalid.push(field);
      }
    });

    if (record.summary) {
      record.summary.hidden = invalid.length === 0;
      record.summary.textContent = invalid.length
        ? "Please correct " + invalid.length +
          (invalid.length === 1 ? " field." : " fields.")
        : "";
    }

    if (invalid.length) {
      announce(record, invalid.length + " field(s) need attention.");

      if (focusFirst) {
        var first = invalid[0];
        var step = first.closest("[data-form-step]");

        if (step && step.hidden && window.MedOrbitsFormSteps) {
          var formSteps = window.MedOrbitsFormSteps;
          var steps = Array.from(
            record.form.querySelectorAll("[data-form-step]")
          );

          var index = steps.indexOf(step);

          if (index >= 0) {
            formSteps.setStep(record.form, index);
          }
        }

        first.focus();
      }

      return false;
    }

    announce(record, "All fields passed validation.");
    return true;
  }

  function initializeForm(form) {
    if (state.forms.has(form)) {
      return state.forms.get(form);
    }

    var record = {
      form: form,
      listeners: [],
      announcer: null,
      summary: form.querySelector("[data-validation-summary]")
    };

    if (!record.announcer) {
      record.announcer = form.querySelector("[data-validation-announcer]");

      if (!record.announcer) {
        record.announcer = document.createElement("div");
        record.announcer.setAttribute("data-validation-announcer", "");
        record.announcer.setAttribute("aria-live", "polite");
        record.announcer.setAttribute("aria-atomic", "true");
        record.announcer.className = "mo-validation-visually-hidden";
        form.appendChild(record.announcer);
      }
    }

    if (record.summary) {
      record.summary.setAttribute("role", "alert");
      record.summary.hidden = true;
    }

    state.forms.set(form, record);
    state.elements.add(form);

    listen(record, form, "input", function (event) {
      var field = event.target;

      if (!field.matches(CONFIG.fieldSelector)) {
        return;
      }

      validateField(field, form);

      // Revalidate linked confirmation fields when the source changes.
      if (field.id) {
        var linked = form.querySelectorAll(
          '[data-confirm-field="' + field.id + '"], ' +
          '[data-confirm-password="' + field.id + '"]'
        );

        linked.forEach(function (item) {
          if (item.value) {
            validateField(item, form);
          }
        });
      }
    });

    listen(record, form, "submit", function (event) {
      if (!validateForm(record, true)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);

    listen(record, form, "reset", function () {
      window.setTimeout(function () {
        form.querySelectorAll(CONFIG.fieldSelector).forEach(clearError);

        if (record.summary) {
          record.summary.hidden = true;
          record.summary.textContent = "";
        }

        announce(record, "Form reset.");
      }, 0);
    });

    return record;
  }

  function injectStyles() {
    if (document.getElementById("mo-form-validation-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mo-form-validation-styles";
    style.textContent =
      ".mo-validation-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}" +
      "[data-validation-summary][hidden]{display:none!important}";

    document.head.appendChild(style);
    state.styleElement = style;
  }

  function refresh() {
    if (state.destroyed) return;

    injectStyles();

    document.querySelectorAll(CONFIG.formSelector).forEach(initializeForm);
  }

  function findRecord(formOrElement) {
    if (!formOrElement) return null;

    var form = formOrElement.matches &&
      formOrElement.matches(CONFIG.formSelector)
      ? formOrElement
      : formOrElement.closest
        ? formOrElement.closest(CONFIG.formSelector)
        : null;

    return form ? state.forms.get(form) || null : null;
  }

  function destroy() {
    if (state.destroyed) return;

    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.elements.forEach(function (form) {
      var record = state.forms.get(form);

      if (record) {
        record.listeners.forEach(function (removeListener) {
          try {
            removeListener();
          } catch (error) {
            // Continue cleanup.
          }
        });
      }
    });

    state.elements.clear();

    if (state.styleElement) {
      state.styleElement.remove();
    }

    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    refresh: refresh,
    validate: function (formOrElement) {
      var record = findRecord(formOrElement);
      return record ? validateForm(record, true) : false;
    },
    validateField: function (field) {
      var form = field && field.closest(CONFIG.formSelector);
      return form ? validateField(field, form) : false;
    },
    clearError: clearError,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsFormValidation = api;

  function initialize() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var addedForm = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(CONFIG.formSelector)) ||
                (node.querySelector && node.querySelector(CONFIG.formSelector))
              );
          });
        });

        if (addedForm) refresh();
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
