
/* =========================================================
   MEDORBITS | APPLICATION WORKFLOW CONTROLLER
   File: assets/js/apply.js
   Version: 1.0.0
   Dependencies: None (other MedOrbits modules optional)
   Namespace: window.MedOrbitsApply
   ========================================================= */

(function MedOrbitsApplyModule(window, document) {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_APPLY_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    formSelector: "[data-mo-application-form]",
    submitSelector: "[data-application-submit]",
    statusSelector: "[data-application-status]",
    referenceSelector: "[data-application-reference]",
    draftPrefix: "medorbits-application-draft:",
    draftStorage: "session",
    autoSave: true,
    autoSaveDelay: 500,
    generateReference: true,
    preventDuplicateSubmit: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 10,
    allowedExtensions: ["pdf", "jpg", "jpeg", "png", "webp"],
    submissionEndpoint: "",
    successMessage: "Your application was submitted successfully.",
    errorMessage: "We could not submit your application. Please try again.",
    draftMessage: "Your draft has been saved.",
    clearDraftOnSuccess: true
  };

  var state = {
    options: Object.assign({}, DEFAULTS),
    forms: new Map(),
    listeners: [],
    started: false,
    observer: null
  };

  /* ---------------------------------------------------------
     GENERAL HELPERS
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

  function clean(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, maxLength || 10000);
  }

  function listen(target, eventName, callback, options) {
    if (!target || !target.addEventListener) return function () {};

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

  function notify(message, type) {
    var notifications = window.MedOrbitsNotifications;

    if (notifications && typeof notifications[type] === "function") {
      notifications[type](message);
      return;
    }

    if (notifications && typeof notifications.show === "function") {
      notifications.show(message, { type: type });
      return;
    }

    if (window.MedOrbitsUtils &&
        typeof window.MedOrbitsUtils.announce === "function") {
      window.MedOrbitsUtils.announce(message, {
        urgent: type === "error"
      });
    }
  }

  function getStorage() {
    try {
      return state.options.draftStorage === "local"
        ? window.localStorage
        : window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function getFormKey(form) {
    return clean(
      form.getAttribute("data-application-id") ||
      form.id ||
      form.getAttribute("name") ||
      "default",
      150
    );
  }

  function getDraftKey(form) {
    return state.options.draftPrefix + getFormKey(form);
  }

  function createReference() {
    var date = new Date();
    var datePart = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("");

    var randomPart;

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(5);
      window.crypto.getRandomValues(bytes);

      randomPart = Array.from(bytes).map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      }).join("").toUpperCase();
    } else {
      randomPart = Math.random().toString(36).slice(2, 12).toUpperCase();
    }

    return "MO-" + datePart + "-" + randomPart;
  }

  function setStatus(form, message, type) {
    var status = query(state.options.statusSelector, form);

    if (!status) {
      status = document.createElement("p");
      status.setAttribute("data-application-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.appendChild(status);
    }

    status.textContent = clean(message, 1000);
    status.setAttribute("data-status-type", type || "info");

    if (type === "error") {
      status.setAttribute("role", "alert");
      status.setAttribute("aria-live", "assertive");
    } else {
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
    }
  }

  function setSubmitting(form, submitting) {
    var record = state.forms.get(form);
    if (!record) return;

    record.submitting = submitting;

    queryAll(state.options.submitSelector, form).forEach(function (button) {
      if (submitting) {
        if (!button.hasAttribute("data-original-disabled")) {
          button.setAttribute(
            "data-original-disabled",
            button.disabled ? "true" : "false"
          );
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      } else {
        var wasDisabled = button.getAttribute("data-original-disabled");

        button.disabled = wasDisabled === "true";
        button.removeAttribute("data-original-disabled");
        button.removeAttribute("aria-busy");
      }
    });

    form.setAttribute("aria-busy", submitting ? "true" : "false");
  }

  /* ---------------------------------------------------------
     FORM DATA COLLECTION
     --------------------------------------------------------- */

  function isSensitiveField(field) {
    var type = (field.type || "").toLowerCase();
    var name = (field.name || "").toLowerCase();

    return [
      "password",
      "file",
      "hidden"
    ].includes(type) ||
      field.hasAttribute("data-no-draft") ||
      field.hasAttribute("data-sensitive") ||
      /password|passwd|token|secret|otp|aadhaar|aadhar|pan_number|card_number|cvv/.test(name);
  }

  function collectDraft(form) {
    var data = {};

    queryAll("input, select, textarea", form).forEach(function (field) {
      if (!field.name || isSensitiveField(field) || field.disabled) return;

      if (field.type === "radio") {
        if (field.checked) data[field.name] = field.value;
        return;
      }

      if (field.type === "checkbox") {
        if (!Array.isArray(data[field.name])) data[field.name] = [];

        if (field.checked) data[field.name].push(field.value || "on");
        return;
      }

      if (field.tagName === "SELECT" && field.multiple) {
        data[field.name] = Array.from(field.selectedOptions).map(function (option) {
          return option.value;
        });
        return;
      }

      data[field.name] = field.value;
    });

    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      fields: data
    };
  }

  function saveDraft(form, silent) {
    var storage = getStorage();

    if (!storage) {
      if (!silent) notify("Draft storage is unavailable in this browser.", "warning");
      return false;
    }

    try {
      storage.setItem(getDraftKey(form), JSON.stringify(collectDraft(form)));

      if (!silent) {
        setStatus(form, state.options.draftMessage, "success");
        notify(state.options.draftMessage, "success");
      }

      form.dispatchEvent(new CustomEvent("medorbits:applicationdraftsaved", {
        bubbles: true,
        detail: { formKey: getFormKey(form) }
      }));

      return true;
    } catch (error) {
      if (!silent) {
        setStatus(form, "The draft could not be saved in this browser.", "error");
      }

      return false;
    }
  }

  function restoreDraft(form) {
    var storage = getStorage();

    if (!storage) return false;

    try {
      var raw = storage.getItem(getDraftKey(form));

      if (!raw) return false;

      var draft = JSON.parse(raw);

      if (!draft || draft.version !== 1 || !draft.fields) {
        return false;
      }

      Object.keys(draft.fields).forEach(function (name) {
        var fields = form.elements.namedItem(name);

        if (!fields) return;

        if (fields instanceof RadioNodeList ||
            (typeof fields.length === "number" && !fields.tagName)) {
          fields = Array.from(fields);
        } else {
          fields = [fields];
        }

        var value = draft.fields[name];

        fields.forEach(function (field) {
          if (isSensitiveField(field)) return;

          if (field.type === "radio") {
            field.checked = String(value) === field.value;
          } else if (field.type === "checkbox") {
            field.checked = Array.isArray(value) &&
              value.includes(field.value || "on");
          } else if (field.tagName === "SELECT" && field.multiple) {
            Array.from(field.options).forEach(function (option) {
              option.selected = Array.isArray(value) &&
                value.includes(option.value);
            });
          } else if (field.type !== "file") {
            field.value = value == null ? "" : String(value);
          }

          field.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });

      form.dispatchEvent(new CustomEvent("medorbits:applicationdraftrestored", {
        bubbles: true,
        detail: { formKey: getFormKey(form), updatedAt: draft.updatedAt || null }
      }));

      setStatus(form, "Saved draft restored.", "info");
      return true;
    } catch (error) {
      return false;
    }
  }

  function deleteDraft(form) {
    var storage = getStorage();

    if (!storage) return false;

    try {
      storage.removeItem(getDraftKey(form));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ---------------------------------------------------------
     FILE VALIDATION
     --------------------------------------------------------- */

  function validateFiles(form) {
    var errors = [];
    var fileInputs = queryAll('input[type="file"]', form);
    var totalFiles = 0;

    fileInputs.forEach(function (input) {
      var files = input.files ? Array.from(input.files) : [];

      totalFiles += files.length;

      var extensions = (
        input.getAttribute("data-allowed-extensions") ||
        state.options.allowedExtensions.join(",")
      ).split(",").map(function (extension) {
        return extension.trim().replace(/^\./, "").toLowerCase();
      }).filter(Boolean);

      var maxSize = Number(input.getAttribute("data-max-size")) ||
        state.options.maxFileSize;

      files.forEach(function (file) {
        var extension = file.name.split(".").pop().toLowerCase();

        if (!extensions.includes(extension)) {
          errors.push({
            field: input.name,
            message: file.name + ": file type is not permitted."
          });
        }

        if (file.size <= 0) {
          errors.push({
            field: input.name,
            message: file.name + ": file is empty."
          });
        }

        if (file.size > maxSize) {
          errors.push({
            field: input.name,
            message: file.name + ": file exceeds the permitted size."
          });
        }
      });
    });

    if (totalFiles > state.options.maxFiles) {
      errors.push({
        field: "",
        message: "Too many files selected. Maximum: " +
          state.options.maxFiles + "."
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /* ---------------------------------------------------------
     VALIDATION INTEGRATION
     --------------------------------------------------------- */

  function validateForm(form) {
    var errors = [];

    if (window.MedOrbitsValidation &&
        typeof window.MedOrbitsValidation.validateForm === "function") {
      var validation = window.MedOrbitsValidation.validateForm(form, {
        focusFirstError: true,
        scrollToError: true
      });

      if (!validation.valid) {
        errors = errors.concat(validation.errors || []);
      }
    } else if (typeof form.checkValidity === "function" &&
               !form.checkValidity()) {
      form.reportValidity();
      errors.push({ message: "Please complete all required fields correctly." });
    }

    var files = validateFiles(form);

    if (!files.valid) {
      errors = errors.concat(files.errors);
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /* ---------------------------------------------------------
     SUBMISSION
     --------------------------------------------------------- */

  function getSubmissionEndpoint(form) {
    return clean(
      form.getAttribute("data-submit-url") ||
      state.options.submissionEndpoint,
      2000
    ).trim();
  }

  function buildPayload(form, reference) {
    var formData = new FormData(form);

    if (reference && !formData.has("application_reference")) {
      formData.append("application_reference", reference);
    }

    return formData;
  }

  async function submitWithAPI(form, payload, endpoint) {
    if (window.MedOrbitsAPI &&
        typeof window.MedOrbitsAPI.post === "function") {
      return window.MedOrbitsAPI.post(endpoint, payload);
    }

    var response = await window.fetch(endpoint, {
      method: "POST",
      body: payload,
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    });

    var contentType = response.headers.get("content-type") || "";
    var result = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      var message = result && typeof result === "object" && result.message
        ? result.message
        : "Submission failed with HTTP " + response.status + ".";

      throw new Error(message);
    }

    return result;
  }

  async function handleSubmit(form, event) {
    var record = state.forms.get(form);

    if (!record) return;

    if (state.options.preventDuplicateSubmit && record.submitting) {
      event.preventDefault();
      return;
    }

    var endpoint = getSubmissionEndpoint(form);

    /*
     * Without a configured endpoint, allow normal HTML form submission.
     * This avoids pretending a local draft is a submitted application.
     */
    if (!endpoint) {
      var validation = validateForm(form);

      if (!validation.valid) {
        event.preventDefault();
        setStatus(
          form,
          "Please correct the highlighted fields before submitting.",
          "error"
        );
      }

      return;
    }

    event.preventDefault();

    var result = validateForm(form);

    if (!result.valid) {
      setStatus(
        form,
        "Please correct the highlighted fields before submitting.",
        "error"
      );

      return;
    }

    var reference = query(state.options.referenceSelector, form);

    if (state.options.generateReference && reference && !reference.value) {
      reference.value = createReference();
    }

    var referenceValue = reference
      ? clean(reference.value, 100)
      : "";

    setSubmitting(form, true);
    setStatus(form, "Submitting your application…", "info");

    form.dispatchEvent(new CustomEvent("medorbits:applicationsubmitting", {
      bubbles: true,
      detail: { reference: referenceValue }
    }));

    try {
      var payload = buildPayload(form, referenceValue);
      var response = await submitWithAPI(form, payload, endpoint);

      var message = response && typeof response === "object" && response.message
        ? clean(response.message, 1000)
        : state.options.successMessage;

      setStatus(form, message, "success");

      if (state.options.clearDraftOnSuccess) {
        deleteDraft(form);
      }

      form.dispatchEvent(new CustomEvent("medorbits:applicationsubmitted", {
        bubbles: true,
        detail: {
          reference: referenceValue,
          response: response
        }
      }));

      notify(message, "success");

      if (form.hasAttribute("data-reset-on-success")) {
        form.reset();
      }

      var successTarget = form.getAttribute("data-success-target");

      if (successTarget) {
        var target = query(successTarget);

        if (target) {
          target.hidden = false;
          target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "auto"
              : "smooth",
            block: "start"
          });
        }
      }
    } catch (error) {
      var message = error && error.message
        ? clean(error.message, 1000)
        : state.options.errorMessage;

      setStatus(form, message || state.options.errorMessage, "error");
      notify(message || state.options.errorMessage, "error");

      form.dispatchEvent(new CustomEvent("medorbits:applicationsubmitfailed", {
        bubbles: true,
        detail: { message: message }
      }));
    } finally {
      setSubmitting(form, false);
    }
  }

  /* ---------------------------------------------------------
     FORM BINDING
     --------------------------------------------------------- */

  function bindForm(form) {
    if (state.forms.has(form)) return;

    var record = {
      submitting: false,
      saveTimer: null,
      removeListeners: []
    };

    state.forms.set(form, record);

    function addListener(target, eventName, callback, options) {
      target.addEventListener(eventName, callback, options || false);

      record.removeListeners.push(function () {
        target.removeEventListener(eventName, callback, options || false);
      });
    }

    addListener(form, "submit", function (event) {
      handleSubmit(form, event);
    });

    if (state.options.autoSave) {
      addListener(form, "input", function (event) {
        if (event.target && isSensitiveField(event.target)) return;

        window.clearTimeout(record.saveTimer);

        record.saveTimer = window.setTimeout(function () {
          saveDraft(form, true);
        }, state.options.autoSaveDelay);
      });

      addListener(form, "change", function (event) {
        if (event.target && isSensitiveField(event.target)) return;

        window.clearTimeout(record.saveTimer);

        record.saveTimer = window.setTimeout(function () {
          saveDraft(form, true);
        }, state.options.autoSaveDelay);
      });
    }

    addListener(form, "click", function (event) {
      var button = event.target.closest("[data-application-save-draft]");

      if (button && form.contains(button)) {
        event.preventDefault();
        saveDraft(form, false);
      }

      var restoreButton = event.target.closest("[data-application-restore-draft]");

      if (restoreButton && form.contains(restoreButton)) {
        event.preventDefault();

        if (!restoreDraft(form)) {
          setStatus(form, "No saved draft was found.", "info");
        }
      }

      var clearButton = event.target.closest("[data-application-clear-draft]");

      if (clearButton && form.contains(clearButton)) {
        event.preventDefault();

        if (window.confirm("Delete the saved application draft?")) {
          deleteDraft(form);
          setStatus(form, "Saved draft deleted.", "success");
        }
      }
    });

    if (form.hasAttribute("data-restore-draft")) {
      restoreDraft(form);
    }
  }

  function refresh() {
    queryAll(state.options.formSelector).forEach(bindForm);

    state.forms.forEach(function (record, form) {
      if (!form.isConnected) {
        window.clearTimeout(record.saveTimer);

        record.removeListeners.forEach(function (remove) {
          remove();
        });

        state.forms.delete(form);
      }
    });

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

    if (!state.started) {
      state.started = true;

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
    }

    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.forms.forEach(function (record) {
      window.clearTimeout(record.saveTimer);

      record.removeListeners.forEach(function (remove) {
        remove();
      });
    });

    state.forms.clear();

    state.listeners.forEach(function (remove) {
      try {
        remove();
      } catch (error) {
        // Continue cleanup.
      }
    });

    state.listeners = [];
    state.started = false;
  }

  var api = {
    version: "1.0.0",
    init: init,
    refresh: refresh,
    configure: configure,
    saveDraft: saveDraft,
    restoreDraft: restoreDraft,
    deleteDraft: deleteDraft,
    validateForm: validateForm,
    validateFiles: validateFiles,
    createReference: createReference,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsApply = api;

  function start() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
