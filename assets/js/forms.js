
/* =========================================================
   MedOrbits -- Form Manager
   File: /assets/js/forms.js
   Purpose: Validation, secure submission, error handling,
            accessibility and form UX helpers
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MedOrbitsForms) return;

  const CONFIG = window.MedOrbitsConfig || {};

  const DEFAULTS = Object.freeze({
    formSelector: "[data-validate-form]",
    submittingText: "Submitting...",
    successMessage: "Form submitted successfully.",
    errorMessage: "Unable to submit the form. Please try again.",
    resetOnSuccess: false,
    focusFirstError: true
  });

  const state = {
    submitting: new WeakSet(),
    originalButtonState: new WeakMap(),
    boundValidationForms: new WeakSet(),
    boundAjaxForms: new WeakSet()
  };

  const VALIDATORS = {
    required(value, parameter, field) {
      if (field.type === "checkbox") return field.checked;
      if (field.type === "radio") {
        return Boolean(getCheckedRadio(field));
      }
      return String(value ?? "").trim().length > 0;
    },

    email(value) {
      if (!value) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim());
    },

    phone(value) {
      if (!value) return true;
      const digits = String(value).replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15;
    },

    url(value) {
      if (!value) return true;

      try {
        const url = new URL(String(value));
        return ["http:", "https:"].includes(url.protocol);
      } catch (_) {
        return false;
      }
    },

    number(value) {
      if (value === "") return true;
      return Number.isFinite(Number(value));
    },

    integer(value) {
      if (value === "") return true;
      return Number.isInteger(Number(value));
    },

    minLength(value, length) {
      return String(value ?? "").length >= Number(length);
    },

    maxLength(value, length) {
      return String(value ?? "").length <= Number(length);
    },

    min(value, minimum) {
      if (value === "") return true;
      return Number(value) >= Number(minimum);
    },

    max(value, maximum) {
      if (value === "") return true;
      return Number(value) <= Number(maximum);
    },

    pattern(value, pattern) {
      if (!value) return true;

      try {
        return new RegExp(pattern).test(String(value));
      } catch (_) {
        return false;
      }
    },

    match(value, selector, form) {
      try {
        const target = form.querySelector(selector);
        return Boolean(target) && String(value) === String(getFieldValue(target));
      } catch (_) {
        return false;
      }
    },

    accepted(value, field) {
      return field.type !== "checkbox" || field.checked;
    },

    fileType(value, acceptedTypes) {
      if (!value || !value.length) return true;

      const allowed = String(acceptedTypes)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      return value.every((file) => allowed.some((type) => {
        if (type.startsWith(".")) {
          return file.name.toLowerCase().endsWith(type);
        }

        if (type.endsWith("/*")) {
          return file.type.startsWith(type.slice(0, -1));
        }

        return file.type.toLowerCase() === type;
      }));
    },

    maxFileSize(value, maximumBytes) {
      if (!value || !value.length) return true;
      return value.every((file) => file.size <= Number(maximumBytes));
    }
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getFieldLabel(field) {
    if (field.labels?.length) {
      return field.labels[0].textContent.trim();
    }

    return (
      field.dataset.label ||
      field.getAttribute("aria-label") ||
      field.name ||
      field.id ||
      "This field"
    );
  }

  function getCheckedRadio(field) {
    if (!field.name || !field.form) {
      return field.checked ? field : null;
    }

    return Array.from(
      field.form.querySelectorAll('input[type="radio"]')
    ).find((radio) => radio.name === field.name && radio.checked) || null;
  }

  function getFieldValue(field) {
    if (field.type === "checkbox") {
      return field.checked ? field.value || "on" : "";
    }

    if (field.type === "radio") {
      return getCheckedRadio(field)?.value ?? "";
    }

    if (field.type === "file") {
      return Array.from(field.files || []);
    }

    return String(field.value ?? "").trim();
  }

  function parseRules(field) {
    const rules = {};

    if (field.required || field.dataset.required === "true") {
      rules.required = true;
    }

    if (field.type === "email") rules.email = true;
    if (field.type === "url") rules.url = true;
    if (field.type === "number") rules.number = true;
    if (field.type === "number" && field.step === "1") {
      rules.integer = true;
    }

    if (field.minLength > 0) rules.minLength = field.minLength;
    if (field.maxLength > 0) rules.maxLength = field.maxLength;
    if (field.min !== "") rules.min = field.min;
    if (field.max !== "") rules.max = field.max;
    if (field.pattern) rules.pattern = field.pattern;

    if (field.dataset.rules) {
      try {
        const customRules = JSON.parse(field.dataset.rules);

        if (
          customRules &&
          typeof customRules === "object" &&
          !Array.isArray(customRules)
        ) {
          Object.assign(rules, customRules);
        }
      } catch (_) {
        console.warn(
          "[MedOrbits Forms] Invalid data-rules JSON:",
          field.name || field.id
        );
      }
    }

    if (field.dataset.match) rules.match = field.dataset.match;
    if (field.dataset.phone === "true") rules.phone = true;
    if (field.dataset.integer === "true") rules.integer = true;

    if (field.type === "checkbox" && field.dataset.acceptance === "true") {
      rules.accepted = true;
    }

    if (field.type === "file") {
      if (field.dataset.fileTypes) {
        rules.fileType = field.dataset.fileTypes;
      }

      if (field.dataset.maxFileSize) {
        rules.maxFileSize = Number(field.dataset.maxFileSize);
      }
    }

    return rules;
  }

  function getRuleMessage(rule, field, parameter) {
    const label = getFieldLabel(field);

    const messages = {
      required: `${label} is required.`,
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
      url: "Enter a valid URL beginning with http:// or https://.",
      number: `${label} must be a valid number.`,
      integer: `${label} must be a whole number.`,
      minLength: `${label} must contain at least ${parameter} characters.`,
      maxLength: `${label} must contain no more than ${parameter} characters.`,
      min: `${label} must be at least ${parameter}.`,
      max: `${label} must not exceed ${parameter}.`,
      pattern: `${label} has an invalid format.`,
      match: `${label} does not match the required field.`,
      accepted: "You must accept this requirement to continue.",
      fileType: `${label} has an unsupported file type.`,
      maxFileSize: `${label} exceeds the permitted file size.`
    };

    return (
      field.dataset.errorMessage ||
      field.dataset[`${rule}Message`] ||
      messages[rule] ||
      `${label} is invalid.`
    );
  }

  function validateField(field, form) {
    if (
      !field ||
      field.disabled ||
      field.type === "submit" ||
      field.type === "button" ||
      field.type === "reset"
    ) {
      return { valid: true, errors: [] };
    }

    // Validate radio groups once, using their first enabled member.
    if (field.type === "radio" && form && field.name) {
      const radios = Array.from(
        form.querySelectorAll('input[type="radio"]')
      ).filter((radio) => radio.name === field.name && !radio.disabled);

      const first = radios[0];

      if (first && field !== first) {
        return { valid: true, errors: [] };
      }
    }

    const value = getFieldValue(field);
    const rules = parseRules(field);
    const errors = [];

    for (const [rule, parameter] of Object.entries(rules)) {
      if (!Object.prototype.hasOwnProperty.call(VALIDATORS, rule)) continue;

      if (
        rule !== "required" &&
        rule !== "accepted" &&
        value === "" &&
        !(field.type === "file" && value.length)
      ) {
        continue;
      }

      let valid;

      if (rule === "match") {
        valid = VALIDATORS.match(value, parameter, form);
      } else {
        valid = VALIDATORS[rule](value, parameter, field);
      }

      if (!valid) {
        errors.push(getRuleMessage(rule, field, parameter));
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  function getValidationFields(form) {
    return Array.from(form.querySelectorAll("input, select, textarea"))
      .filter((field) => {
        if (field.type === "radio" && field.name) {
          const radios = Array.from(
            form.querySelectorAll('input[type="radio"]')
          ).filter((radio) => radio.name === field.name && !radio.disabled);

          return field === radios[0];
        }

        return true;
      });
  }

  function getErrorElement(field) {
    const id = field.id || field.name;

    if (!id) return null;

    const errorId = `${id}-error`;
    let errorElement = document.getElementById(errorId);

    if (!errorElement) {
      errorElement = document.createElement("p");
      errorElement.id = errorId;
      errorElement.className = "form-field-error";
      errorElement.setAttribute("aria-live", "polite");
      errorElement.hidden = true;

      const container = field.closest(
        "[data-form-field], .form-group, .form-field"
      );

      if (container) {
        container.appendChild(errorElement);
      } else {
        field.insertAdjacentElement("afterend", errorElement);
      }
    }

    return errorElement;
  }

  function setFieldError(field, message) {
    field.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");

    const errorElement = getErrorElement(field);

    if (errorElement) {
      errorElement.textContent = message || "";
      errorElement.hidden = !message;

      const describedBy = new Set(
        (field.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter(Boolean)
      );

      if (message) {
        describedBy.add(errorElement.id);
      } else {
        describedBy.delete(errorElement.id);
      }

      if (describedBy.size) {
        field.setAttribute("aria-describedby", [...describedBy].join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    }
  }

  function clearFieldError(field) {
    if (!field) return;

    field.classList.remove("is-invalid");
    field.removeAttribute("aria-invalid");

    const id = field.id || field.name;
    const errorElement = id
      ? document.getElementById(`${id}-error`)
      : null;

    if (errorElement) {
      errorElement.textContent = "";
      errorElement.hidden = true;

      const describedBy = new Set(
        (field.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter(Boolean)
      );

      describedBy.delete(errorElement.id);

      if (describedBy.size) {
        field.setAttribute("aria-describedby", [...describedBy].join(" "));
      } else {
        field.removeAttribute("aria-describedby");
      }
    }
  }

  function validateForm(form, options = {}) {
    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("A valid form element is required.");
    }

    const errors = [];

    getValidationFields(form).forEach((field) => {
      clearFieldError(field);

      const result = validateField(field, form);

      if (!result.valid) {
        result.errors.forEach((message) => {
          setFieldError(field, message);
          errors.push({
            field,
            name: field.name,
            message
          });
        });
      }
    });

    if (options.focusFirstError !== false && errors.length) {
      const first = errors[0].field;

      try {
        first.focus({ preventScroll: false });
      } catch (_) {
        first.focus();
      }
    }

    form.dispatchEvent(new CustomEvent("medorbits:form-validated", {
      bubbles: true,
      detail: {
        valid: errors.length === 0,
        errors
      }
    }));

    return {
      valid: errors.length === 0,
      errors
    };
  }

  function serializeForm(form, options = {}) {
    const data = new FormData(form);
    const result = {};

    for (const [key, value] of data.entries()) {
      if (options.excludeEmpty && value === "") continue;

      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key])
          ? [...result[key], value]
          : [result[key], value];
      } else {
        result[key] = value;
      }
    }

    if (options.includeUnchecked !== false) {
      form.querySelectorAll('input[type="checkbox"][name]').forEach((field) => {
        if (!field.checked && !(field.name in result)) {
          result[field.name] = false;
        }
      });
    }

    return result;
  }

  function serializeFormData(form) {
    return new FormData(form);
  }

  function setSubmitting(form, submitting, options = {}) {
    const buttons = form.querySelectorAll(
      'button[type="submit"], input[type="submit"], [data-submit-button]'
    );

    buttons.forEach((button) => {
      if (submitting) {
        if (!state.originalButtonState.has(button)) {
          state.originalButtonState.set(button, {
            disabled: button.disabled,
            text: button.tagName === "INPUT"
              ? button.value
              : button.textContent
          });
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        const text = options.submittingText || DEFAULTS.submittingText;

        if (button.tagName === "INPUT") {
          button.value = text;
        } else {
          button.textContent = text;
        }
      } else {
        const original = state.originalButtonState.get(button);

        if (original) {
          button.disabled = original.disabled;

          if (button.tagName === "INPUT") {
            button.value = original.text;
          } else {
            button.textContent = original.text;
          }

          state.originalButtonState.delete(button);
        }

        button.removeAttribute("aria-busy");
      }
    });

    if (submitting) {
      form.setAttribute("aria-busy", "true");
    } else {
      form.removeAttribute("aria-busy");
    }
  }

  function showMessage(message, type = "info", container) {
    if (window.MedOrbitsToast?.show) {
      window.MedOrbitsToast.show(String(message), type);
      return;
    }

    const target = typeof container === "string"
      ? document.querySelector(container)
      : container;

    if (target) {
      target.textContent = String(message);
      target.className = `form-message form-message--${type}`;
      target.setAttribute("role", type === "error" ? "alert" : "status");
      target.hidden = false;
      return;
    }

    document.dispatchEvent(new CustomEvent("medorbits:toast", {
      detail: {
        message: String(message),
        type
      }
    }));
  }

  async function requestJSON(url, options = {}) {
    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    const requestOptions = { ...options };

    if (
      requestOptions.body &&
      !(requestOptions.body instanceof FormData) &&
      typeof requestOptions.body !== "string"
    ) {
      requestOptions.body = JSON.stringify(requestOptions.body);
      headers["Content-Type"] = "application/json";
    } else if (
      typeof requestOptions.body === "string" &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }

    // Do not set Content-Type manually for FormData: the browser supplies
    // the multipart boundary.
    if (requestOptions.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    const response = await fetch(url, {
      credentials: "same-origin",
      ...requestOptions,
      headers
    });

    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    let result;

    if (contentType.includes("application/json")) {
      result = await response.json();
    } else {
      result = await response.text();
    }

    if (!response.ok) {
      const error = new Error(
        result?.message ||
        result?.error ||
        `Request failed (${response.status})`
      );

      error.status = response.status;
      error.data = result;

      throw error;
    }

    return result;
  }

  async function submitForm(form, options = {}) {
    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("A valid form element is required.");
    }

    if (state.submitting.has(form)) {
      throw new Error("This form is already being submitted.");
    }

    const validation = validateForm(form, options);

    if (!validation.valid) {
      const error = new Error("Please correct the highlighted fields.");
      error.code = "VALIDATION_ERROR";
      error.validationErrors = validation.errors;
      throw error;
    }

    const method = String(
      options.method || form.method || "POST"
    ).toUpperCase();

    const url = options.url || form.action || window.location.href;

    const hasFiles = Array.from(
      form.querySelectorAll('input[type="file"]')
    ).some((field) => field.files?.length);

    const useMultipart =
      options.multipart === true ||
      form.enctype === "multipart/form-data" ||
      hasFiles;

    const data = useMultipart
      ? serializeFormData(form)
      : serializeForm(form, {
          excludeEmpty: options.excludeEmpty
        });

    state.submitting.add(form);
    setSubmitting(form, true, options);

    try {
      let result;

      if (typeof options.onSubmit === "function") {
        result = await options.onSubmit({
          form,
          data,
          validation
        });
      } else {
        result = await requestJSON(url, {
          method,
          body: useMultipart ? data : JSON.stringify(data),
          headers: options.headers,
          signal: options.signal
        });
      }

      form.dispatchEvent(new CustomEvent("medorbits:form-success", {
        bubbles: true,
        detail: { result }
      }));

      showMessage(
        options.successMessage || DEFAULTS.successMessage,
        "success",
        options.messageContainer
      );

      if (options.resetOnSuccess ?? DEFAULTS.resetOnSuccess) {
        form.reset();
        getValidationFields(form).forEach(clearFieldError);
      }

      if (typeof options.onSuccess === "function") {
        await options.onSuccess(result, form);
      }

      return result;
    } catch (error) {
      form.dispatchEvent(new CustomEvent("medorbits:form-error", {
        bubbles: true,
        detail: { error }
      }));

      if (error.code !== "VALIDATION_ERROR") {
        showMessage(
          options.errorMessage || DEFAULTS.errorMessage,
          "error",
          options.messageContainer
        );
      }

      if (window.MedOrbitsErrorHandler?.handle) {
        try {
          window.MedOrbitsErrorHandler.handle(
            error,
            {
              source: "form-submit",
              formId: form.id || null
            },
            { silent: true }
          );
        } catch (_) {
          // Preserve the original submission error.
        }
      }

      if (typeof options.onError === "function") {
        await options.onError(error, form);
      }

      throw error;
    } finally {
      state.submitting.delete(form);
      setSubmitting(form, false, options);
    }
  }

  function bindValidation(form, options = {}) {
    const target = typeof form === "string"
      ? document.querySelector(form)
      : form;

    if (!(target instanceof HTMLFormElement)) return null;

    if (state.boundValidationForms.has(target)) {
      return {
        validate: () => validateForm(target, options),
        clear: () => getValidationFields(target).forEach(clearFieldError)
      };
    }

    state.boundValidationForms.add(target);

    target.addEventListener("submit", (event) => {
      const result = validateForm(target, options);

      if (!result.valid) {
        event.preventDefault();
      }
    });

    if (options.validateOnInput !== false) {
      target.addEventListener("input", (event) => {
        const field = event.target;

        if (!(field instanceof HTMLElement) ||
            !field.matches("input, select, textarea")) {
          return;
        }

        const result = validateField(field, target);

        if (result.valid) {
          clearFieldError(field);
        } else {
          setFieldError(field, result.errors[0]);
        }
      });
    }

    target.addEventListener("change", (event) => {
      const field = event.target;

      if (!(field instanceof HTMLElement) ||
          !field.matches("input, select, textarea")) {
        return;
      }

      const result = validateField(field, target);

      if (result.valid) {
        clearFieldError(field);
      } else {
        setFieldError(field, result.errors[0]);
      }
    });

    return {
      validate: () => validateForm(target, options),
      clear: () => getValidationFields(target).forEach(clearFieldError)
    };
  }

  function bindAjaxForm(form, options = {}) {
    const target = typeof form === "string"
      ? document.querySelector(form)
      : form;

    if (!(target instanceof HTMLFormElement)) return null;

    if (state.boundAjaxForms.has(target)) return target;

    state.boundAjaxForms.add(target);

    target.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm(target, options).catch(() => {
        // Errors are surfaced through events and feedback.
      });
    });

    return target;
  }

  function init(root = document) {
    if (!root?.querySelectorAll) return api;

    if (root instanceof HTMLFormElement) {
      if (root.matches(DEFAULTS.formSelector)) {
        bindValidation(root);
      }

      if (root.matches("[data-ajax-form]")) {
        bindAjaxForm(root, {
          url: root.dataset.url || root.action,
          method: root.dataset.method || root.method || "POST",
          successMessage: root.dataset.successMessage,
          errorMessage: root.dataset.errorMessage,
          resetOnSuccess: root.dataset.resetOnSuccess === "true",
          submittingText: root.dataset.submittingText
        });
      }

      return api;
    }

    root.querySelectorAll(DEFAULTS.formSelector).forEach((form) => {
      bindValidation(form);
    });

    root.querySelectorAll("[data-ajax-form]").forEach((form) => {
      bindAjaxForm(form, {
        url: form.dataset.url || form.action,
        method: form.dataset.method || form.method || "POST",
        successMessage: form.dataset.successMessage,
        errorMessage: form.dataset.errorMessage,
        resetOnSuccess: form.dataset.resetOnSuccess === "true",
        submittingText: form.dataset.submittingText
      });
    });

    return api;
  }

  const api = Object.freeze({
    VALIDATORS,
    validateField,
    validateForm,
    serializeForm,
    serializeFormData,
    submitForm,
    bindValidation,
    bindAjaxForm,
    setSubmitting,
    showMessage,
    requestJSON,
    clearFieldError,
    setFieldError,
    init,
    defaults: DEFAULTS
  });

  window.MedOrbitsForms = api;

  window.MedOrbits = window.MedOrbits || {};
  window.MedOrbits.Forms = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), {
      once: true
    });
  } else {
    init();
  }
})(window, document);
