
/* =========================================================
   MedOrbits -- Form Validation
   File: /assets/js/validation.js

   Client-side validation for forms, fields, files, and inputs.
   Server-side validation is still required for all submissions.
   ========================================================= */

(function (window, document) {
  "use strict";

  var CONFIG = window.MedOrbitsConfig || {};
  var CONSTANTS = window.MedOrbitsConstants || {};

  var DEFAULTS = Object.freeze({
    validateOnInput: true,
    validateOnBlur: true,
    validateOnSubmit: true,
    showErrors: true,
    focusFirstError: true,
    maxFileSize: 10 * 1024 * 1024,
    allowedFileTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png"
    ],
    allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"]
  });

  var RULES = Object.freeze({
    required: "This field is required.",
    email: "Enter a valid email address.",
    phone: "Enter a valid phone number.",
    url: "Enter a valid website URL.",
    number: "Enter a valid number.",
    integer: "Enter a whole number.",
    min: "The value is below the minimum allowed.",
    max: "The value exceeds the maximum allowed.",
    minlength: "The value is too short.",
    maxlength: "The value is too long.",
    pattern: "The value format is invalid.",
    match: "The values do not match.",
    password: "The password does not meet the requirements.",
    file: "Choose a valid file.",
    fileSize: "The file exceeds the allowed size.",
    fileType: "This file type is not allowed.",
    date: "Enter a valid date.",
    checkbox: "Please confirm this field.",
    select: "Choose a valid option."
  });

  var initializedForms = [];
  var listeners = [];

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function getElement(value, root) {
    if (!value) return null;

    if (
      typeof window.Element === "function" &&
      value instanceof window.Element
    ) {
      return value;
    }

    try {
      return (root || document).querySelector(value);
    } catch (error) {
      return null;
    }
  }

  function getElements(selector, root) {
    try {
      return Array.prototype.slice.call(
        (root || document).querySelectorAll(selector)
      );
    } catch (error) {
      return [];
    }
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function normalize(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeEmail(value) {
    return normalize(value).toLowerCase();
  }

  function normalizePhone(value) {
    return normalize(value).replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  }

  function getValue(field) {
    if (!field) return "";

    if (field.type === "checkbox") {
      return field.checked;
    }

    if (field.type === "radio") {
      var form = field.form || document;
      var checked = form.querySelector(
        'input[type="radio"][name="' + escapeSelector(field.name) + '"]:checked'
      );

      return checked ? checked.value : "";
    }

    if (field.type === "file") {
      return field.files || null;
    }

    if (field.tagName === "SELECT" && field.multiple) {
      return Array.prototype.filter.call(
        field.options,
        function (option) {
          return option.selected;
        }
      ).map(function (option) {
        return option.value;
      });
    }

    return normalize(field.value);
  }

  function escapeSelector(value) {
    return String(value == null ? "" : value).replace(
      /([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g,
      "\\$1"
    );
  }

  function getFieldLabel(field) {
    if (!field) return "This field";

    var label = "";

    if (field.labels && field.labels.length) {
      label = normalize(field.labels[0].textContent);
    }

    if (!label && field.getAttribute("aria-label")) {
      label = normalize(field.getAttribute("aria-label"));
    }

    if (!label && field.placeholder) {
      label = normalize(field.placeholder);
    }

    if (!label && field.name) {
      label = field.name
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

      label = label.charAt(0).toUpperCase() + label.slice(1);
    }

    return label || "This field";
  }

  function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim() === "";
    if (typeof value === "boolean") return value === false;
    if (Array.isArray(value)) return value.length === 0;

    return false;
  }

  function isValidEmail(value) {
    var email = normalizeEmail(value);

    if (!email || email.length > 254) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function isValidPhone(value, options) {
    options = options || {};

    var digits = normalizePhone(value).replace(/\D/g, "");
    var min = options.minDigits == null ? 7 : Number(options.minDigits);
    var max = options.maxDigits == null ? 15 : Number(options.maxDigits);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) {
      return false;
    }

    return digits.length >= min && digits.length <= max;
  }

  function isValidURL(value, options) {
    options = options || {};

    var raw = normalize(value);
    if (!raw) return false;

    try {
      var url = new URL(raw);

      if (url.protocol !== "https:" &&
          !(options.allowHttp && url.protocol === "http:")) {
        return false;
      }

      if (options.sameOrigin && url.origin !== window.location.origin) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function isValidDate(value) {
    if (!value) return false;

    var date = new Date(value);
    return Number.isFinite(date.getTime());
  }

  function parseRuleValue(field, ruleName) {
    var datasetKey = "validate" + ruleName.charAt(0).toUpperCase() +
      ruleName.slice(1);

    if (field.dataset && field.dataset[datasetKey] !== undefined) {
      return field.dataset[datasetKey];
    }

    return field.getAttribute("data-" + datasetKey.replace(
      /[A-Z]/g,
      function (letter) {
        return "-" + letter.toLowerCase();
      }
    ));
  }

  function getCustomMessage(field, ruleName) {
    var custom = field.getAttribute("data-error-" + ruleName);

    if (custom) return custom;

    var general = field.getAttribute("data-error-message");

    if (general) return general;

    return null;
  }

  function messageFor(field, ruleName, fallback) {
    var custom = getCustomMessage(field, ruleName);

    if (custom) return custom;

    var label = getFieldLabel(field);

    switch (ruleName) {
      case "required":
        return label + " is required.";

      case "email":
        return "Enter a valid email address.";

      case "phone":
        return "Enter a valid phone number.";

      case "url":
        return "Enter a valid website URL.";

      case "minlength":
        return label + " must contain at least " + fallback + " characters.";

      case "maxlength":
        return label + " must contain no more than " + fallback + " characters.";

      case "min":
        return label + " must be at least " + fallback + ".";

      case "max":
        return label + " must be no greater than " + fallback + ".";

      case "match":
        return label + " does not match the required value.";

      case "pattern":
        return label + " has an invalid format.";

      default:
        return RULES[ruleName] || label + " is invalid.";
    }
  }

  function validateField(field, options) {
    options = options || {};

    if (!field || field.disabled) {
      return { valid: true, message: "", field: field };
    }

    var type = String(field.type || "").toLowerCase();
    var tag = String(field.tagName || "").toLowerCase();
    var value = getValue(field);
    var textValue = typeof value === "string" ? value : "";
    var required = field.required ||
      field.getAttribute("aria-required") === "true" ||
      field.hasAttribute("data-required");

    var rules = [
      "required",
      "email",
      "phone",
      "url",
      "number",
      "integer",
      "min",
      "max",
      "minlength",
      "maxlength",
      "pattern",
      "match",
      "password",
      "date",
      "file"
    ];

    if (required && isEmptyValue(value)) {
      return invalid("required", messageFor(field, "required"));
    }

    if (isEmptyValue(value)) {
      return { valid: true, message: "", field: field };
    }

    if (type === "checkbox" && required && !field.checked) {
      return invalid("required", messageFor(field, "required"));
    }

    if (type === "email" || field.hasAttribute("data-validate-email")) {
      if (!isValidEmail(textValue)) {
        return invalid("email", messageFor(field, "email"));
      }
    }

    if (type === "tel" || field.hasAttribute("data-validate-phone")) {
      var phoneOptions = {
        minDigits: parseRuleValue(field, "minDigits"),
        maxDigits: parseRuleValue(field, "maxDigits")
      };

      if (!isValidPhone(textValue, phoneOptions)) {
        return invalid("phone", messageFor(field, "phone"));
      }
    }

    if (type === "url" || field.hasAttribute("data-validate-url")) {
      if (!isValidURL(textValue, {
        allowHttp: field.getAttribute("data-allow-http") === "true",
        sameOrigin: field.getAttribute("data-same-origin") === "true"
      })) {
        return invalid("url", messageFor(field, "url"));
      }
    }

    if (type === "number" || field.hasAttribute("data-validate-number")) {
      var number = Number(textValue);

      if (!Number.isFinite(number)) {
        return invalid("number", messageFor(field, "number"));
      }

      if (field.min !== "" && Number.isFinite(Number(field.min)) &&
          number < Number(field.min)) {
        return invalid("min", messageFor(field, "min", field.min));
      }

      if (field.max !== "" && Number.isFinite(Number(field.max)) &&
          number > Number(field.max)) {
        return invalid("max", messageFor(field, "max", field.max));
      }

      if (field.step && field.step !== "any" && Number.isFinite(Number(field.step))) {
        var step = Number(field.step);
        var base = field.min !== "" && Number.isFinite(Number(field.min))
          ? Number(field.min)
          : 0;

        if (step > 0 && Math.abs((number - base) / step -
            Math.round((number - base) / step)) > 1e-8) {
          return invalid("number", "Enter a value using valid increments.");
        }
      }
    }

    if (field.hasAttribute("data-validate-integer")) {
      if (!/^-?\d+$/.test(textValue)) {
        return invalid("integer", messageFor(field, "integer"));
      }
    }

    var minLength = field.minLength >= 0 && field.minLength !== -1
      ? field.minLength
      : parseRuleValue(field, "minlength");

    var maxLength = field.maxLength >= 0 && field.maxLength !== -1
      ? field.maxLength
      : parseRuleValue(field, "maxlength");

    if (minLength !== null && minLength !== undefined && minLength !== "") {
      var minimumLength = Number(minLength);

      if (Number.isFinite(minimumLength) &&
          textValue.length < minimumLength) {
        return invalid(
          "minlength",
          messageFor(field, "minlength", minimumLength)
        );
      }
    }

    if (maxLength !== null && maxLength !== undefined && maxLength !== "") {
      var maximumLength = Number(maxLength);

      if (Number.isFinite(maximumLength) &&
          textValue.length > maximumLength) {
        return invalid(
          "maxlength",
          messageFor(field, "maxlength", maximumLength)
        );
      }
    }

    var minValue = parseRuleValue(field, "min");
    var maxValue = parseRuleValue(field, "max");

    if (minValue !== null && minValue !== undefined && minValue !== "") {
      if (type === "number" && Number(textValue) < Number(minValue)) {
        return invalid("min", messageFor(field, "min", minValue));
      }

      if (type !== "number" && textValue.length < Number(minValue)) {
        return invalid("min", messageFor(field, "min", minValue));
      }
    }

    if (maxValue !== null && maxValue !== undefined && maxValue !== "") {
      if (type === "number" && Number(textValue) > Number(maxValue)) {
        return invalid("max", messageFor(field, "max", maxValue));
      }

      if (type !== "number" && textValue.length > Number(maxValue)) {
        return invalid("max", messageFor(field, "max", maxValue));
      }
    }

    var pattern = field.getAttribute("pattern") ||
      parseRuleValue(field, "pattern");

    if (pattern) {
      try {
        if (!(new RegExp("^(?:" + pattern + ")$")).test(textValue)) {
          return invalid("pattern", messageFor(field, "pattern"));
        }
      } catch (error) {
        emit("medorbits:validation-config-error", {
          field: field.name || field.id || "",
          rule: "pattern"
        });
      }
    }

    var matchSelector = field.getAttribute("data-match");

    if (matchSelector) {
      var matchField = getElement(matchSelector, field.form || document);

      if (!matchField || String(field.value) !== String(matchField.value)) {
        return invalid("match", messageFor(field, "match"));
      }
    }

    if (type === "password" ||
        field.hasAttribute("data-validate-password")) {
      var passwordOptions = {
        minLength: parseRuleValue(field, "minlength") || 8,
        requireUppercase: field.getAttribute("data-require-uppercase") === "true",
        requireLowercase: field.getAttribute("data-require-lowercase") === "true",
        requireNumber: field.getAttribute("data-require-number") === "true",
        requireSymbol: field.getAttribute("data-require-symbol") === "true"
      };

      if (!validatePassword(textValue, passwordOptions).valid) {
        return invalid("password", messageFor(field, "password"));
      }
    }

    if (type === "date" || field.hasAttribute("data-validate-date")) {
      if (!isValidDate(textValue)) {
        return invalid("date", messageFor(field, "date"));
      }
    }

    if (type === "file") {
      var fileResult = validateFiles(field, options);

      if (!fileResult.valid) {
        return fileResult;
      }
    }

    if (tag === "select" && required && !textValue) {
      return invalid("required", messageFor(field, "select"));
    }

    if (typeof field.checkValidity === "function" &&
        !field.checkValidity()) {
      return invalid("native", field.validationMessage || "Check this field.");
    }

    return { valid: true, message: "", field: field };

    function invalid(rule, message) {
      return {
        valid: false,
        rule: rule,
        message: message,
        field: field
      };
    }
  }

  function validatePassword(password, options) {
    options = options || {};

    var value = String(password == null ? "" : password);
    var minimum = Number(options.minLength || 8);
    var errors = [];

    if (value.length < minimum) {
      errors.push("Use at least " + minimum + " characters.");
    }

    if (options.requireUppercase && !/[A-Z]/.test(value)) {
      errors.push("Include an uppercase letter.");
    }

    if (options.requireLowercase && !/[a-z]/.test(value)) {
      errors.push("Include a lowercase letter.");
    }

    if (options.requireNumber && !/\d/.test(value)) {
      errors.push("Include a number.");
    }

    if (options.requireSymbol && !/[^A-Za-z0-9]/.test(value)) {
      errors.push("Include a symbol.");
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function getFileRules(field, options) {
    options = options || {};

    var maxSize = Number(
      field.getAttribute("data-max-file-size") ||
      options.maxFileSize ||
      DEFAULTS.maxFileSize
    );

    var extensionText = field.getAttribute("data-allowed-extensions");
    var extensions = extensionText
      ? extensionText.split(",").map(function (item) {
          return item.trim().toLowerCase();
        }).filter(Boolean)
      : (options.allowedExtensions || DEFAULTS.allowedExtensions).slice();

    var accept = field.getAttribute("accept");
    var acceptedMimeTypes = options.allowedFileTypes ||
      DEFAULTS.allowedFileTypes;

    if (accept) {
      var accepted = accept.split(",").map(function (item) {
        return item.trim().toLowerCase();
      }).filter(Boolean);

      if (accepted.length) {
        extensions = extensions.filter(function (extension) {
          return accepted.some(function (item) {
            return item === extension ||
              item === "." + extension.replace(/^\./, "");
          });
        });

        acceptedMimeTypes = acceptedMimeTypes.filter(function (mime) {
          return accepted.some(function (item) {
            return item === mime.toLowerCase() ||
              item === mime.split("/")[0] + "/*";
          });
        });
      }
    }

    return {
      maxSize: Number.isFinite(maxSize) && maxSize > 0
        ? maxSize
        : DEFAULTS.maxFileSize,
      extensions: extensions,
      mimeTypes: acceptedMimeTypes
    };
  }

  function validateFiles(field, options) {
    options = options || {};

    var files = field.files;
    var required = field.required ||
      field.getAttribute("aria-required") === "true" ||
      field.hasAttribute("data-required");

    if (!files || !files.length) {
      return required
        ? {
            valid: false,
            rule: "required",
            message: messageFor(field, "required"),
            field: field
          }
        : { valid: true, message: "", field: field };
    }

    var rules = getFileRules(field, options);

    for (var i = 0; i < files.length; i += 1) {
      var file = files[i];
      var fileName = String(file.name || "").toLowerCase();
      var extensionMatch = fileName.match(/\.[^.]+$/);
      var extension = extensionMatch ? extensionMatch[0] : "";

      if (file.size > rules.maxSize) {
        return {
          valid: false,
          rule: "fileSize",
          message: "Each file must be no larger than " +
            formatBytes(rules.maxSize) + ".",
          field: field
        };
      }

      if (
        rules.extensions.length &&
        rules.extensions.indexOf(extension) === -1
      ) {
        return {
          valid: false,
          rule: "fileType",
          message: "Allowed file extensions: " +
            rules.extensions.join(", ") + ".",
          field: field
        };
      }

      if (
        file.type &&
        rules.mimeTypes.length &&
        rules.mimeTypes.indexOf(file.type.toLowerCase()) === -1 &&
        rules.extensions.indexOf(extension) === -1
      ) {
        return {
          valid: false,
          rule: "fileType",
          message: "This file type is not allowed.",
          field: field
        };
      }
    }

    return { valid: true, message: "", field: field };
  }

  function formatBytes(bytes) {
    var value = Number(bytes);

    if (!Number.isFinite(value) || value < 0) return "an unknown size";
    if (value < 1024) return value + " bytes";
    if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";

    return (value / (1024 * 1024)).toFixed(1) + " MB";
  }

  function getErrorContainer(field) {
    var explicitId = field.getAttribute("data-error-target");

    if (explicitId) {
      var explicit = getElement(explicitId, field.form || document);
      if (explicit) return explicit;
    }

    var id = field.id;

    if (id) {
      var associated = getElement(
        '[data-error-for="' + escapeSelector(id) + '"]',
        field.form || document
      );

      if (associated) return associated;
    }

    var parent = field.parentElement;

    if (parent) {
      var sibling = parent.querySelector("[data-field-error]");

      if (sibling) return sibling;
    }

    return null;
  }

  function showFieldError(field, message) {
    if (!field) return;

    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");

    var container = getErrorContainer(field);

    if (container) {
      container.textContent = message || "";
      container.hidden = !message;
      container.setAttribute("role", "alert");
      return;
    }

    if (!message || !field.parentNode) return;

    var errorNode = document.createElement("span");
    errorNode.className = "field-error";
    errorNode.setAttribute("data-generated-field-error", "");
    errorNode.setAttribute("role", "alert");
    errorNode.textContent = message;

    if (field.id) {
      errorNode.id = field.id + "-validation-error";

      var describedBy = (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean);

      if (describedBy.indexOf(errorNode.id) === -1) {
        describedBy.push(errorNode.id);
      }

      field.setAttribute("aria-describedby", describedBy.join(" "));
    }

    field.parentNode.insertBefore(errorNode, field.nextSibling);
  }

  function clearFieldError(field) {
    if (!field) return;

    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");

    var generated = field.parentNode
      ? field.parentNode.querySelectorAll("[data-generated-field-error]")
      : [];

    Array.prototype.forEach.call(generated, function (node) {
      if (
        field.id &&
        node.id === field.id + "-validation-error"
      ) {
        node.remove();
      }
    });

    var container = getErrorContainer(field);

    if (container) {
      container.textContent = "";
      container.hidden = true;
    }

    if (field.id) {
      var errorId = field.id + "-validation-error";
      var describedBy = (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(function (id) {
          return id && id !== errorId;
        });

      if (describedBy.length) {
        field.setAttribute("aria-describedby", describedBy.join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    }
  }

  function validateForm(form, options) {
    options = options || {};

    if (!form || !form.elements) {
      return {
        valid: false,
        errors: [],
        fields: []
      };
    }

    var fields = Array.prototype.filter.call(
      form.elements,
      function (field) {
        if (!field || !field.tagName) return false;

        var tag = field.tagName.toLowerCase();

        if (tag !== "input" && tag !== "textarea" && tag !== "select") {
          return false;
        }

        if (field.disabled || field.type === "hidden" ||
            field.hasAttribute("data-validation-ignore")) {
          return false;
        }

        return true;
      }
    );

    var errors = [];
    var results = [];

    fields.forEach(function (field) {
      var result = validateField(field, options);
      results.push(result);

      if (!result.valid) {
        errors.push(result);

        if (options.showErrors !== false && DEFAULTS.showErrors) {
          showFieldError(field, result.message);
        }
      } else {
        clearFieldError(field);
      }
    });

    var valid = errors.length === 0;

    if (!valid && options.focusFirstError !== false) {
      var first = errors[0].field;

      if (first && typeof first.focus === "function") {
        try {
          first.focus({ preventScroll: false });
        } catch (error) {
          first.focus();
        }
      }
    }

    return {
      valid: valid,
      errors: errors,
      fields: results
    };
  }

  function handleInput(event) {
    var field = event.target;

    if (!field || !field.form || !field.form.hasAttribute("data-validate")) {
      return;
    }

    if (!DEFAULTS.validateOnInput) return;

    var result = validateField(field);

    if (result.valid) {
      clearFieldError(field);
    } else {
      showFieldError(field, result.message);
    }

    emit("medorbits:field-validated", {
      field: field,
      valid: result.valid,
      rule: result.rule || null
    });
  }

  function handleBlur(event) {
    var field = event.target;

    if (!field || !field.form || !field.form.hasAttribute("data-validate")) {
      return;
    }

    if (!DEFAULTS.validateOnBlur) return;

    var result = validateField(field);

    if (result.valid) {
      clearFieldError(field);
    } else {
      showFieldError(field, result.message);
    }
  }

  function handleSubmit(event) {
    var form = event.target;

    if (!form || !form.matches || !form.matches("form[data-validate]")) {
      return;
    }

    if (!DEFAULTS.validateOnSubmit) return;

    var result = validateForm(form);

    emit("medorbits:form-validated", {
      form: form,
      valid: result.valid,
      errors: result.errors
    });

    if (!result.valid) {
      event.preventDefault();
      showFormSummary(form, result.errors);
    } else {
      clearFormSummary(form);
    }
  }

  function showFormSummary(form, errors) {
    var summary = form.querySelector("[data-validation-summary]");

    if (!summary) {
      summary = document.createElement("div");
      summary.setAttribute("data-validation-summary", "");
      summary.className = "validation-summary";
      summary.setAttribute("role", "alert");
      summary.setAttribute("tabindex", "-1");
      form.insertBefore(summary, form.firstChild);
    }

    summary.textContent = "";

    var heading = document.createElement("p");
    heading.textContent = "Please correct the following errors:";
    summary.appendChild(heading);

    var list = document.createElement("ul");

    errors.forEach(function (error) {
      var item = document.createElement("li");
      item.textContent = error.message;

      if (error.field && error.field.id) {
        var link = document.createElement("a");
        link.href = "#" + encodeURIComponent(error.field.id);
        link.textContent = error.message;

        item.textContent = "";
        item.appendChild(link);
      }

      list.appendChild(item);
    });

    summary.appendChild(list);

    try {
      summary.focus({ preventScroll: false });
    } catch (error) {
      summary.focus();
    }
  }

  function clearFormSummary(form) {
    if (!form) return;

    var summary = form.querySelector("[data-validation-summary]");

    if (summary) {
      summary.textContent = "";
      summary.hidden = true;
    }
  }

  function initForm(form, options) {
    if (!form || !form.matches || !form.matches("form")) return false;

    if (initializedForms.indexOf(form) !== -1) return true;

    initializedForms.push(form);
    form.setAttribute("data-validation-initialized", "true");

    if (options && options.validateOnInput === false) {
      form.setAttribute("data-validation-input", "false");
    }

    return true;
  }

  function init(root, options) {
    root = root || document;
    options = options || {};

    var forms = [];

    if (
      typeof window.HTMLFormElement === "function" &&
      root instanceof window.HTMLFormElement
    ) {
      forms.push(root);
    } else {
      forms = getElements("form[data-validate]", root);
    }

    forms.forEach(function (form) {
      initForm(form, options);
    });

    return forms.length;
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      return function () {};
    }

    if (listeners.indexOf(callback) === -1) {
      listeners.push(callback);
    }

    return function () {
      var index = listeners.indexOf(callback);

      if (index !== -1) listeners.splice(index, 1);
    };
  }

  function emitValidationEvent(name, detail) {
    emit(name, detail);

    listeners.slice().forEach(function (callback) {
      try {
        callback({
          event: name,
          detail: detail || {}
        });
      } catch (error) {
        if (window.console && typeof window.console.error === "function") {
          window.console.error("[MedOrbits Validation] Listener error:", error);
        }
      }
    });
  }

  function validateFormPublic(form, options) {
    var result = validateForm(form, options);

    emitValidationEvent("medorbits:form-validated", {
      form: form,
      valid: result.valid,
      errors: result.errors
    });

    return result;
  }

  function destroy() {
    document.removeEventListener("input", handleInput, true);
    document.removeEventListener("change", handleInput, true);
    document.removeEventListener("focusout", handleBlur, true);
    document.removeEventListener("submit", handleSubmit, true);

    initializedForms.forEach(function (form) {
      form.removeAttribute("data-validation-initialized");
    });

    initializedForms.length = 0;
    listeners.length = 0;
  }

  document.addEventListener("input", handleInput, true);
  document.addEventListener("change", handleInput, true);
  document.addEventListener("focusout", handleBlur, true);
  document.addEventListener("submit", handleSubmit, true);

  var api = {
    DEFAULTS: DEFAULTS,
    RULES: RULES,

    isEmptyValue: isEmptyValue,
    isValidEmail: isValidEmail,
    isValidPhone: isValidPhone,
    isValidURL: isValidURL,
    isValidDate: isValidDate,
    validatePassword: validatePassword,
    validateFiles: validateFiles,
    validateField: validateField,
    validateForm: validateFormPublic,

    showFieldError: showFieldError,
    clearFieldError: clearFieldError,
    showFormSummary: showFormSummary,
    clearFormSummary: clearFormSummary,

    initForm: initForm,
    init: init,
    subscribe: subscribe,
    destroy: destroy
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsValidation = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Validation = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init(document);
    }, { once: true });
  } else {
    init(document);
  }

})(window, document);
