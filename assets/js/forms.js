
/* =========================================================
   MEDORBITS | FORMS MODULE
   File: assets/js/forms.js
   Version: 1.0.0
   Dependencies: None
   Optional integration: form-validation.js
   ========================================================= */

(function MedOrbitsForms() {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_FORMS_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var SELECTORS = {
    form: "form[data-mo-form], form[data-form-manager]",
    conditional: "[data-form-condition]",
    counter: "[data-character-counter]",
    draft: "[data-form-draft]",
    reset: "[data-form-reset]",
    status: "[data-form-status]"
  };

  var state = {
    forms: new Map(),
    observer: null,
    initialized: false,
    destroyed: false
  };

  function clean(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, maxLength || 2000);
  }

  function listen(record, element, eventName, handler) {
    element.addEventListener(eventName, handler);

    record.listeners.push(function () {
      element.removeEventListener(eventName, handler);
    });
  }

  function getFieldValue(form, name) {
    if (!name) return "";

    var fields = Array.from(form.elements).filter(function (field) {
      return field.name === name || field.id === name;
    });

    if (!fields.length) return "";

    var first = fields[0];

    if (first.type === "radio") {
      var selected = fields.find(function (field) {
        return field.checked;
      });

      return selected ? selected.value : "";
    }

    if (first.type === "checkbox") {
      if (fields.length > 1) {
        return fields.filter(function (field) {
          return field.checked;
        }).map(function (field) {
          return field.value;
        });
      }

      return first.checked ? first.value : "";
    }

    if (first.type === "file") {
      return Array.from(first.files || []).map(function (file) {
        return file.name;
      });
    }

    return first.value == null ? "" : first.value;
  }

  function valuesMatch(actual, expected, operator) {
    var expectedValues = String(expected == null ? "" : expected)
      .split("|")
      .map(function (value) {
        return value.trim();
      });

    var actualValues = Array.isArray(actual)
      ? actual.map(String)
      : [String(actual == null ? "" : actual)];

    switch (operator) {
      case "not-equals":
        return !expectedValues.includes(actualValues[0]);

      case "contains":
        return actualValues.some(function (value) {
          return value.toLowerCase().includes(String(expected).toLowerCase());
        });

      case "checked":
        return actual === true ||
          actual === "true" ||
          actual === "on" ||
          actual === "yes";

      case "empty":
        return actualValues.every(function (value) {
          return value.trim() === "";
        });

      case "not-empty":
        return actualValues.some(function (value) {
          return value.trim() !== "";
        });

      case "equals":
      default:
        return actualValues.some(function (value) {
          return expectedValues.includes(value);
        });
    }
  }

  function parseCondition(element) {
    var raw = element.getAttribute("data-form-condition") || "";
    var parts = raw.split(":");

    if (parts.length < 2) return null;

    var field = parts.shift().trim();
    var expected = parts.join(":").trim();

    return {
      field: field,
      expected: expected,
      operator: element.getAttribute("data-form-condition-operator") || "equals",
      mode: element.getAttribute("data-form-condition-mode") || "hide"
    };
  }

  function updateConditions(record) {
    var form = record.form;

    form.querySelectorAll(SELECTORS.conditional).forEach(function (section) {
      var condition = parseCondition(section);
      if (!condition) return;

      var actual = getFieldValue(form, condition.field);
      var matches = valuesMatch(actual, condition.expected, condition.operator);
      var shouldShow = condition.mode === "show" ? matches : !matches;

      section.hidden = !shouldShow;
      section.setAttribute("data-form-condition-hidden", String(!shouldShow));

      section.querySelectorAll("input, select, textarea, button").forEach(
        function (field) {
          if (!field.hasAttribute("data-condition-original-disabled")) {
            field.setAttribute(
              "data-condition-original-disabled",
              field.disabled ? "true" : "false"
            );
          }

          var originallyDisabled =
            field.getAttribute("data-condition-original-disabled") === "true";

          field.disabled = !shouldShow || originallyDisabled;
        }
      );
    });
  }

  function updateCounter(field) {
    var targetId = field.getAttribute("data-counter-target");
    var counter = targetId ? document.getElementById(targetId) : null;

    if (!counter) {
      var wrapper = field.closest("[data-character-counter-wrapper]");
      counter = wrapper ? wrapper.querySelector(SELECTORS.counter) : null;
    }

    if (!counter) return;

    var current = String(field.value || "").length;
    var max = Number(field.getAttribute("maxlength"));

    counter.textContent = Number.isFinite(max) && max > 0
      ? current + " / " + max
      : String(current);

    counter.setAttribute("aria-live", "polite");

    if (Number.isFinite(max) && max > 0) {
      counter.setAttribute("data-limit-reached", String(current >= max));
    }
  }

  function announce(record, message) {
    if (!record.status) return;
    record.status.textContent = clean(message, 300);
  }

  function getDraftKey(form) {
    return clean(
      form.getAttribute("data-form-draft-key") ||
      form.id ||
      form.getAttribute("name") ||
      "medorbits-form",
      100
    );
  }

  function getDraftStorage(form) {
    var requested = form.getAttribute("data-form-draft-storage") || "session";

    try {
      if (requested === "local") return window.localStorage;
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function collectDraft(form) {
    var data = {};

    Array.from(form.elements).forEach(function (field) {
      if (!field.name || field.disabled) return;

      if (
        field.type === "password" ||
        field.type === "file" ||
        field.type === "hidden" ||
        field.hasAttribute("data-no-draft") ||
        field.hasAttribute("data-sensitive")
      ) {
        return;
      }

      if (field.type === "submit" || field.type === "button" ||
          field.type === "reset") {
        return;
      }

      if (field.type === "radio") {
        if (field.checked) data[field.name] = field.value;
        return;
      }

      if (field.type === "checkbox") {
        if (!Array.isArray(data[field.name])) data[field.name] = [];

        if (field.checked) data[field.name].push(field.value);
        return;
      }

      data[field.name] = clean(field.value, 10000);
    });

    return data;
  }

  function saveDraft(record) {
    var form = record.form;

    if (!form.hasAttribute("data-form-draft")) return false;

    var storage = getDraftStorage(form);
    if (!storage) {
      announce(record, "Draft saving is unavailable in this browser.");
      return false;
    }

    try {
      var payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        values: collectDraft(form)
      };

      storage.setItem(
        "medorbits:form-draft:" + getDraftKey(form),
        JSON.stringify(payload)
      );

      announce(record, "Draft saved in this browser.");
      return true;
    } catch (error) {
      announce(record, "Unable to save the draft.");
      return false;
    }
  }

  function restoreDraft(record) {
    var form = record.form;

    if (!form.hasAttribute("data-form-draft")) return false;

    var storage = getDraftStorage(form);
    if (!storage) return false;

    try {
      var raw = storage.getItem(
        "medorbits:form-draft:" + getDraftKey(form)
      );

      if (!raw) return false;

      var payload = JSON.parse(raw);

      if (!payload || payload.version !== 1 ||
          !payload.values || typeof payload.values !== "object") {
        return false;
      }

      Object.keys(payload.values).forEach(function (name) {
        var value = payload.values[name];

        var fields = Array.from(form.elements).filter(function (field) {
          return field.name === name &&
            field.type !== "password" &&
            field.type !== "file" &&
            field.type !== "hidden" &&
            !field.disabled &&
            !field.hasAttribute("data-no-draft") &&
            !field.hasAttribute("data-sensitive");
        });

        fields.forEach(function (field) {
          if (field.type === "radio") {
            field.checked = field.value === String(value);
          } else if (field.type === "checkbox") {
            field.checked = Array.isArray(value) &&
              value.includes(field.value);
          } else if (typeof value === "string") {
            field.value = value;
          }

          field.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });

      updateConditions(record);

      form.querySelectorAll("[maxlength]").forEach(updateCounter);

      announce(record, "Saved draft restored.");
      return true;
    } catch (error) {
      announce(record, "Unable to restore the saved draft.");
      return false;
    }
  }

  function clearDraft(record) {
    var storage = getDraftStorage(record.form);
    if (!storage) return false;

    try {
      storage.removeItem(
        "medorbits:form-draft:" + getDraftKey(record.form)
      );
      announce(record, "Saved draft cleared.");
      return true;
    } catch (error) {
      return false;
    }
  }

  function handleReset(record) {
    window.setTimeout(function () {
      updateConditions(record);
      record.form.querySelectorAll("[maxlength]").forEach(updateCounter);
      announce(record, "Form reset.");
    }, 0);
  }

  function initializeForm(form) {
    if (state.forms.has(form)) return state.forms.get(form);

    var record = {
      form: form,
      listeners: [],
      status: form.querySelector(SELECTORS.status),
      timer: null
    };

    if (!record.status) {
      record.status = document.createElement("div");
      record.status.setAttribute("data-form-status", "");
      record.status.setAttribute("role", "status");
      record.status.setAttribute("aria-live", "polite");
      record.status.className = "mo-forms-visually-hidden";
      form.appendChild(record.status);
    }

    state.forms.set(form, record);

    listen(record, form, "input", function (event) {
      var field = event.target;

      if (!field.matches("input, select, textarea")) return;

      updateConditions(record);

      if (field.hasAttribute("maxlength")) {
        updateCounter(field);
      }

      if (form.hasAttribute("data-form-draft") &&
          form.getAttribute("data-form-autosave") !== "false") {
        window.clearTimeout(record.timer);

        record.timer = window.setTimeout(function () {
          saveDraft(record);
        }, 500);
      }
    });

    listen(record, form, "change", function () {
      updateConditions(record);
    });

    listen(record, form, "reset", function () {
      handleReset(record);
    });

    form.querySelectorAll(SELECTORS.counter).forEach(function (counter) {
      var targetId = counter.getAttribute("data-counter-for");
      var field = targetId ? document.getElementById(targetId) : null;

      if (field) updateCounter(field);
    });

    form.querySelectorAll("[maxlength]").forEach(updateCounter);

    updateConditions(record);

    if (form.hasAttribute("data-form-restore-draft")) {
      restoreDraft(record);
    }

    return record;
  }

  function handleFormAction(event) {
    var button = event.target.closest(
      "[data-form-save-draft], [data-form-clear-draft], [data-form-restore]"
    );

    if (!button) return;

    var form = button.closest(SELECTORS.form);
    if (!form) return;

    var record = state.forms.get(form);
    if (!record) return;

    if (button.hasAttribute("data-form-save-draft")) {
      event.preventDefault();
      saveDraft(record);
    } else if (button.hasAttribute("data-form-clear-draft")) {
      event.preventDefault();
      clearDraft(record);
    } else if (button.hasAttribute("data-form-restore")) {
      event.preventDefault();
      restoreDraft(record);
    }
  }

  function refresh() {
    if (state.destroyed) return;

    document.querySelectorAll(SELECTORS.form).forEach(initializeForm);
  }

  function init() {
    if (state.initialized || state.destroyed) return;

    state.initialized = true;

    var style = document.createElement("style");
    style.id = "mo-forms-helper-styles";
    style.textContent =
      ".mo-forms-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}";

    if (!document.getElementById(style.id)) {
      document.head.appendChild(style);
      state.styleElement = style;
    }

    document.addEventListener("click", handleFormAction);
    refresh();

    if (typeof MutationObserver === "function") {
      state.observer = new MutationObserver(function (mutations) {
        var foundForm = mutations.some(function (mutation) {
          return Array.from(mutation.addedNodes).some(function (node) {
            return node.nodeType === 1 &&
              (
                (node.matches && node.matches(SELECTORS.form)) ||
                (node.querySelector && node.querySelector(SELECTORS.form))
              );
          });
        });

        if (foundForm) refresh();
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
  }

  function destroy() {
    if (state.destroyed) return;

    if (state.observer) state.observer.disconnect();

    document.removeEventListener("click", handleFormAction);

    state.forms.forEach(function (record) {
      window.clearTimeout(record.timer);

      record.listeners.forEach(function (removeListener) {
        try {
          removeListener();
        } catch (error) {
          // Continue cleanup.
        }
      });
    });

    state.forms.clear();

    if (state.styleElement) state.styleElement.remove();

    state.destroyed = true;
  }

  var api = {
    version: "1.0.0",
    refresh: refresh,
    saveDraft: function (form) {
      var record = state.forms.get(form);
      return record ? saveDraft(record) : false;
    },
    restoreDraft: function (form) {
      var record = state.forms.get(form);
      return record ? restoreDraft(record) : false;
    },
    clearDraft: function (form) {
      var record = state.forms.get(form);
      return record ? clearDraft(record) : false;
    },
    updateConditions: function (form) {
      var record = state.forms.get(form);
      if (record) updateConditions(record);
    },
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsForms = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
