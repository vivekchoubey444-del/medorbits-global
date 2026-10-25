
/* =========================================================
   MEDORBITS | FORM VALIDATION ENGINE
   File: assets/js/validation.js
   Version: 1.0.0
   Dependencies: None (MedOrbitsUtils optional)
   Namespace: window.MedOrbitsValidation
   ========================================================= */

(function MedOrbitsValidationModule() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_VALIDATION_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    selector: "form[data-validate], form[data-mo-validate]",
    validateOnInput: true,
    validateOnBlur: true,
    validateOnSubmit: true,
    focusFirstError: true,
    scrollToError: true,
    errorClass: "mo-field-error",
    invalidClass: "is-invalid",
    validClass: "is-valid",
    maxTextLength: 10000,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10,
    allowedFileTypes: [
      "pdf", "jpg", "jpeg", "png", "webp"
    ],
    allowedMimeTypes: {
      pdf: ["application/pdf"],
      jpg: ["image/jpeg"],
      jpeg: ["image/jpeg"],
      png: ["image/png"],
      webp: ["image/webp"]
    },
    messages: {
      required: "This field is required.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
      url: "Enter a valid URL.",
      number: "Enter a valid number.",
      integer: "Enter a whole number.",
      min: "The value is below the permitted minimum.",
      max: "The value exceeds the permitted maximum.",
      minlength: "The value is too short.",
      maxlength: "The value is too long.",
      pattern: "The value does not match the required format.",
      password: "The password does not meet the security requirements.",
      confirm: "The values do not match.",
      fileType: "This file type is not permitted.",
      fileSize: "The selected file is too large.",
      fileCount: "Too many files were selected.",
      fileEmpty: "The selected file is empty.",
      generic: "Please check this field."
    }
  };

  var state = {
    options: clone(DEFAULTS),
    forms: new Map(),
    observer: null,
    initialized: false
  };

  function clone(value) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch (error) {
        // Use the JSON-compatible fallback below.
      }
    }

    return JSON.parse(JSON.stringify(value));
  }

  function clean(value) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, state.options.maxTextLength);
  }

  function all(selector, root) {
    try {
      return Array.from((root || document).querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function first(selector, root) {
    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function getMessage(rule, fallback) {
    return state.options.messages[rule] || fallback ||
      state.options.messages.generic;
  }

  function getFieldLabel(field) {
    if (!field) return "Field";

    var label = "";

    if (field.labels && field.labels.length) {
      label = field.labels[0].textContent;
    }

    if (!label && field.getAttribute("aria-label")) {
      label = field.getAttribute("aria-label");
    }

    if (!label && field.name) {
      label = field.name.replace(/[_-]+/g, " ");
    }

    return clean(label || "Field").trim();
  }

  function getErrorContainer(field) {
    var wrapper = field.closest("[data-field-wrapper]") ||
      field.closest(".form-group") ||
      field.closest(".form-field") ||
      field.parentElement;

    if (!wrapper) return null;

    var existing = first("[data-validation-error]", wrapper);

    if (existing) return existing;

    var error = document.createElement("div");

    error.className = state.options.errorClass;
    error.setAttribute("data-validation-error", "");
    error.setAttribute("aria-live", "polite");
    error.hidden = true;

    wrapper.appendChild(error);

    return error;
  }

  function getFieldValue(field) {
    if (!field) return "";

    if (field.type === "checkbox") {
      return field.checked ? field.value || "on" : "";
    }

    if (field.type === "radio") {
      var checked = first(
        'input[type="radio"][name="' + escapeAttribute(field.name) + '"]:checked',
        field.form
      );

      return checked ? checked.value : "";
    }

    if (field.tagName === "SELECT" && field.multiple) {
      return Array.from(field.selectedOptions).map(function (option) {
        return option.value;
      });
    }

    if (field.type === "file") {
      return field.files ? Array.from(field.files) : [];
    }

    return typeof field.value === "string" ? field.value.trim() : "";
  }

  function escapeAttribute(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function isEmpty(value) {
    if (Array.isArray(value)) return value.length === 0;

    return value == null || String(value).trim() === "";
  }

  function isFieldDisabled(field) {
    if (!field || field.disabled) return true;

    if (field.closest("[hidden], [inert]")) return true;

    var style = window.getComputedStyle(field);

    return style.display === "none" ||
      style.visibility === "hidden";
  }

  function normalizeDigits(value) {
    return String(value).replace(/\D/g, "");
  }

  function validEmail(value) {
    var email = String(value).trim();

    if (email.length > 254 || /\s/.test(email)) return false;

    var parts = email.split("@");

    if (parts.length !== 2) return false;

    var local = parts[0];
    var domain = parts[1];

    if (!local || local.length > 64 || !domain) return false;

    if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
      return false;
    }

    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
      return false;
    }

    if (domain.length > 253 || !domain.includes(".")) return false;

    var labels = domain.split(".");

    return labels.every(function (part) {
      return part.length > 0 &&
        part.length <= 63 &&
        /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(part);
    });
  }

  function validPhone(value, field) {
    var input = String(value).trim();

    if (!/^[+\d\s().-]+$/.test(input)) return false;

    var digits = normalizeDigits(input);
    var min = Number(field.getAttribute("data-min-digits")) || 7;
    var max = Number(field.getAttribute("data-max-digits")) || 15;

    return digits.length >= min && digits.length <= max;
  }

  function validURL(value) {
    try {
      var url = new URL(value);

      return url.protocol === "https:" || url.protocol === "http:";
    } catch (error) {
      return false;
    }
  }

  function validPattern(value, pattern) {
    try {
      return new RegExp(pattern).test(value);
    } catch (error) {
      return false;
    }
  }

  function getPasswordRules(field) {
    return {
      minLength: Number(field.getAttribute("minlength")) || 8,
      uppercase: field.hasAttribute("data-require-uppercase"),
      lowercase: field.hasAttribute("data-require-lowercase"),
      number: field.hasAttribute("data-require-number"),
      symbol: field.hasAttribute("data-require-symbol")
    };
  }

  function validPassword(value, rules) {
    if (value.length < rules.minLength) return false;
    if (rules.uppercase && !/[A-Z]/.test(value)) return false;
    if (rules.lowercase && !/[a-z]/.test(value)) return false;
    if (rules.number && !/\d/.test(value)) return false;
    if (rules.symbol && !/[^A-Za-z0-9]/.test(value)) return false;

    return true;
  }

  function getAllowedExtensions(field) {
    var configured = field.getAttribute("data-allowed-extensions");

    if (!configured) return state.options.allowedFileTypes.slice();

    return configured.split(",").map(function (extension) {
      return extension.trim().replace(/^\./, "").toLowerCase();
    }).filter(Boolean);
  }

  function validateFile(file, field) {
    var result = { valid: true, rule: "", message: "" };

    if (!file || typeof file.name !== "string") {
      return result;
    }

    if (file.size <= 0) {
      result.valid = false;
      result.rule = "fileEmpty";
      result.message = getMessage("fileEmpty");
      return result;
    }

    var maxSize = Number(field.getAttribute("data-max-size")) ||
      state.options.maxFileSize;

    if (file.size > maxSize) {
      result.valid = false;
      result.rule = "fileSize";
      result.message = getMessage("fileSize");
      return result;
    }

    var extension = file.name.split(".").pop().toLowerCase();
    var allowed = getAllowedExtensions(field);

    if (!allowed.includes(extension)) {
      result.valid = false;
      result.rule = "fileType";
      result.message = getMessage("fileType");
      return result;
    }

    var mimeMap = state.options.allowedMimeTypes[extension];

    if (file.type && mimeMap && !mimeMap.includes(file.type)) {
      result.valid = false;
      result.rule = "fileType";
      result.message = getMessage("fileType");
      return result;
    }

    return result;
  }

  function getConfirmationField(field) {
    var target = field.getAttribute("data-confirm-field");

    if (target) {
      try {
        return field.form.querySelector(target);
      } catch (error) {
        return null;
      }
    }

    if (field.name === "confirmPassword") {
      return field.form.elements.namedItem("password");
    }

    if (field.name === "confirm_password") {
      return field.form.elements.namedItem("password") ||
        field.form.elements.namedItem("new_password");
    }

    return null;
  }

  function validateField(field) {
    if (!field || !field.form || isFieldDisabled(field)) {
      return { valid: true, errors: [] };
    }

    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(field.tagName)) {
      return { valid: true, errors: [] };
    }

    if (["submit", "reset", "button", "image"].includes(field.type)) {
      return { valid: true, errors: [] };
    }

    var value = getFieldValue(field);
    var errors = [];
    var label = getFieldLabel(field);

    function add(rule, message) {
      errors.push({
        rule: rule,
        message: label + ": " + (message || getMessage(rule))
      });
    }

    if (field.required && isEmpty(value)) {
      add("required");
      return applyFieldResult(field, errors);
    }

    if (isEmpty(value)) {
      return applyFieldResult(field, errors);
    }

    if (field.type === "email" && !validEmail(value)) {
      add("email");
    }

    if (field.type === "tel" && !validPhone(value, field)) {
      add("phone");
    }

    if (field.type === "url" && !validURL(value)) {
      add("url");
    }

    if (field.type === "number" || field.type === "range") {
      var number = Number(value);

      if (!Number.isFinite(number)) {
        add("number");
      } else {
        if (field.min !== "" && number < Number(field.min)) {
          add("min", getMessage("min") + " Minimum: " + field.min + ".");
        }

        if (field.max !== "" && number > Number(field.max)) {
          add("max", getMessage("max") + " Maximum: " + field.max + ".");
        }

        if (field.step && field.step !== "any" && Number(field.step) > 0) {
          var base = field.min !== "" ? Number(field.min) : 0;
          var steps = (number - base) / Number(field.step);

          if (Math.abs(steps - Math.round(steps)) > 1e-8) {
            add("number", "Enter a value in the permitted increments.");
          }
        }
      }
    }

    if (field.minLength >= 0 && field.value.length < field.minLength) {
      add("minlength", getMessage("minlength") +
        " Minimum length: " + field.minLength + ".");
    }

    if (field.maxLength >= 0 && field.value.length > field.maxLength) {
      add("maxlength", getMessage("maxlength") +
        " Maximum length: " + field.maxLength + ".");
    }

    var dataMin = field.getAttribute("data-min");
    var dataMax = field.getAttribute("data-max");

    if (dataMin !== null && field.type !== "number" &&
        field.value.length < Number(dataMin)) {
      add("minlength", getMessage("minlength"));
    }

    if (dataMax !== null && field.type !== "number" &&
        field.value.length > Number(dataMax)) {
      add("maxlength", getMessage("maxlength"));
    }

    if (field.pattern && !validPattern(field.value, field.pattern)) {
      add("pattern");
    }

    if (field.type === "password" &&
        (field.hasAttribute("data-password-strength") ||
         field.hasAttribute("data-require-uppercase") ||
         field.hasAttribute("data-require-lowercase") ||
         field.hasAttribute("data-require-number") ||
         field.hasAttribute("data-require-symbol"))) {
      if (!validPassword(field.value, getPasswordRules(field))) {
        add("password");
      }
    }

    if (field.hasAttribute("data-confirm-field") ||
        field.name === "confirmPassword" ||
        field.name === "confirm_password") {
      var confirmation = getConfirmationField(field);

      if (confirmation && field.value !== confirmation.value) {
        add("confirm");
      }
    }

    if (field.type === "file") {
      var files = value;
      var maxFiles = Number(field.getAttribute("data-max-files")) ||
        state.options.maxFiles;

      if (files.length > maxFiles) {
        add("fileCount", getMessage("fileCount") +
          " Maximum files: " + maxFiles + ".");
      }

      files.forEach(function (file) {
        var result = validateFile(file, field);

        if (!result.valid) {
          add(result.rule, result.message);
        }
      });
    }

    if (field.type === "checkbox" &&
        field.hasAttribute("data-required-checked") &&
        !field.checked) {
      add("required");
    }

    return applyFieldResult(field, errors);
  }

  function applyFieldResult(field, errors) {
    var valid = errors.length === 0;
    var errorElement = getErrorContainer(field);

    field.classList.toggle(state.options.invalidClass, !valid);
    field.classList.toggle(state.options.validClass, valid && !isEmpty(getFieldValue(field)));

    if (valid) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("data-validation-message");

      if (errorElement) {
        errorElement.textContent = "";
        errorElement.hidden = true;
      }

      removeDescribedBy(field, errorElement);
    } else {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("data-validation-message", errors[0].message);

      if (errorElement) {
        errorElement.textContent = errors.map(function (error) {
          return error.message;
        }).join(" ");
        errorElement.hidden = false;
        addDescribedBy(field, errorElement);
      }
    }

    field.dispatchEvent(new CustomEvent("medorbits:fieldvalidated", {
      bubbles: true,
      detail: {
        valid: valid,
        errors: errors,
        field: field
      }
    }));

    return { valid: valid, errors: errors };
  }

  function addDescribedBy(field, element) {
    if (!element.id) {
      element.id = "mo-validation-" + Math.random().toString(36).slice(2, 10);
    }

    var ids = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/).filter(Boolean);

    if (!ids.includes(element.id)) {
      ids.push(element.id);
      field.setAttribute("aria-describedby", ids.join(" "));
    }
  }

  function removeDescribedBy(field, element) {
    if (!element || !element.id) return;

    var ids = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/).filter(function (id) {
        return id && id !== element.id;
      });

    if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
    else field.removeAttribute("aria-describedby");
  }

  function getFields(form) {
    return all("input, select, textarea", form).filter(function (field) {
      return !field.matches("[data-validation-ignore]");
    });
  }

  function validateForm(form, options) {
    options = options || {};

    if (!form || !form.elements) {
      return { valid: false, errors: [], fields: [] };
    }

    var results = getFields(form).map(function (field) {
      return {
        field: field,
        result: validateField(field)
      };
    });

    var invalid = results.filter(function (entry) {
      return !entry.result.valid;
    });

    var errors = [];

    invalid.forEach(function (entry) {
      entry.result.errors.forEach(function (error) {
        errors.push({
          field: entry.field,
          rule: error.rule,
          message: error.message
        });
      });
    });

    if (invalid.length && options.focusFirstError !== false &&
        state.options.focusFirstError) {
      var firstInvalid = invalid[0].field;

      if (options.scrollToError !== false && state.options.scrollToError) {
        firstInvalid.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "center"
        });
      }

      firstInvalid.focus({ preventScroll: true });
    }

    form.dispatchEvent(new CustomEvent("medorbits:formvalidated", {
      bubbles: true,
      detail: {
        valid: invalid.length === 0,
        errors: errors,
        invalidCount: invalid.length
      }
    }));

    return {
      valid: invalid.length === 0,
      errors: errors,
      fields: results
    };
  }

  function clearField(field) {
    if (!field) return;

    field.classList.remove(
      state.options.invalidClass,
      state.options.validClass
    );

    field.removeAttribute("aria-invalid");
    field.removeAttribute("data-validation-message");

    var errorElement = getErrorContainer(field);

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.hidden = true;
      removeDescribedBy(field, errorElement);
    }
  }

  function clearForm(form) {
    getFields(form).forEach(clearField);

    var summary = first("[data-validation-summary]", form);

    if (summary) {
      summary.textContent = "";
      summary.hidden = true;
    }
  }

  function bindForm(form) {
    if (state.forms.has(form)) return;

    var listeners = [];

    function listen(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options || false);
      listeners.push(function () {
        target.removeEventListener(eventName, handler, options || false);
      });
    }

    if (state.options.validateOnBlur) {
      listen(form, "focusout", function (event) {
        if (event.target.matches("input, select, textarea")) {
          validateField(event.target);
        }
      });
    }

    if (state.options.validateOnInput) {
      listen(form, "input", function (event) {
        if (event.target.matches("input, select, textarea") &&
            event.target.getAttribute("aria-invalid") === "true") {
          validateField(event.target);
        }

        var name = event.target.name;

        if (name === "password" || name === "new_password") {
          all('[name="confirmPassword"], [name="confirm_password"]', form)
            .forEach(function (field) {
              if (field.value) validateField(field);
            });
        }
      });
    }

    listen(form, "change", function (event) {
      if (event.target.matches("input, select, textarea")) {
        if (event.target.type === "file" ||
            event.target.type === "checkbox" ||
            event.target.type === "radio") {
          validateField(event.target);
        }
      }
    });

    if (state.options.validateOnSubmit) {
      listen(form, "submit", function (event) {
        var result = validateForm(form);

        if (!result.valid) {
          event.preventDefault();

          var summary = first("[data-validation-summary]", form);

          if (summary) {
            summary.textContent = result.errors.length +
              " validation error(s) found. Please review the highlighted fields.";
            summary.hidden = false;
            summary.setAttribute("role", "alert");
          }
        }
      });
    }

    listen(form, "reset", function () {
      window.setTimeout(function () {
        clearForm(form);
      }, 0);
    });

    state.forms.set(form, {
      listeners: listeners
    });
  }

  function refresh() {
    all(state.options.selector).forEach(bindForm);
  }

  function init(options) {
    if (options) configure(options);

    state.forms.forEach(function (record, form) {
      if (!form.isConnected) {
        record.listeners.forEach(function (remove) {
          remove();
        });
        state.forms.delete(form);
      }
    });

    refresh();

    if (!state.observer && document.documentElement) {
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

  function configure(options) {
    options = options || {};

    Object.keys(options).forEach(function (key) {
      if (key === "messages" && options.messages &&
          typeof options.messages === "object") {
        state.options.messages = Object.assign(
          {},
          state.options.messages,
          options.messages
        );
      } else if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        state.options[key] = options[key];
      }
    });

    return clone(state.options);
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.forms.forEach(function (record) {
      record.listeners.forEach(function (remove) {
        remove();
      });
    });

    state.forms.clear();
    state.initialized = false;
  }

  var api = {
    version: "1.0.0",
    init: init,
    refresh: refresh,
    configure: configure,
    validateField: validateField,
    validateForm: validateForm,
    clearField: clearField,
    clearForm: clearForm,
    isEmail: validEmail,
    isPhone: validPhone,
    isValidURL: validURL,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsValidation = api;

  function start() {
    init();
    state.initialized = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
