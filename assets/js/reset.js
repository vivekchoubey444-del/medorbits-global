
/*!
 * MedOrbits | Password Reset Module
 * File: assets/js/reset.js
 * Version: 1.0.0
 *
 * Supports:
 * - Forgot-password request form
 * - Reset-password form with secure token
 * - Password strength and confirmation validation
 * - Show/hide password buttons
 * - Accessible status and field errors
 * - Same-origin API requests by default
 * - CSRF token support
 * - Request timeout and duplicate-submit protection
 * - Dynamic forms and reduced dependency footprint
 *
 * No external libraries required.
 */

(function () {
  "use strict";

  if (window.MedOrbitsReset) return;

  const DEFAULTS = {
    forgotEndpoint: "/api/auth/forgot-password",
    resetEndpoint: "/api/auth/reset-password",
    requestTimeout: 15000,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    selectors: {
      forgotForm: "[data-mo-forgot-form]",
      resetForm: "[data-mo-reset-form]",
      password: "[data-mo-new-password]",
      confirmation: "[data-mo-confirm-password]",
      toggle: "[data-mo-password-toggle]",
      strength: "[data-mo-password-strength]",
      status: "[data-mo-reset-status]",
      submit: "[data-mo-reset-submit]"
    }
  };

  const state = {
    initialized: false,
    config: {},
    observer: null,
    boundForms: new WeakSet(),
    boundToggles: new WeakSet(),
    listeners: [],
    activeRequests: new WeakSet()
  };

  function mergeConfig(options) {
    const input = options || {};

    state.config = {
      ...DEFAULTS,
      ...input,
      selectors: {
        ...DEFAULTS.selectors,
        ...(input.selectors || {})
      }
    };

    return state.config;
  }

  function queryAll(root, selector) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function listen(element, eventName, handler, options) {
    element.addEventListener(eventName, handler, options);
    state.listeners.push(function () {
      element.removeEventListener(eventName, handler, options);
    });
  }

  function getCSRFToken() {
    const meta = document.querySelector(
      'meta[name="csrf-token"], meta[name="csrf_token"]'
    );

    return meta ? meta.content : "";
  }

  function safeMessage(value, fallback) {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : fallback;
  }

  function setStatus(form, message, type) {
    let status = form.querySelector(state.config.selectors.status);

    if (!status) {
      status = document.createElement("div");
      status.className = "mo-reset-status";
      status.setAttribute("data-mo-reset-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.setAttribute("tabindex", "-1");
      form.prepend(status);
    }

    status.textContent = message || "";

    if (type) {
      status.dataset.type = type;
    } else {
      delete status.dataset.type;
    }
  }

  function clearStatus(form) {
    const status = form.querySelector(state.config.selectors.status);
    if (!status) return;

    status.textContent = "";
    delete status.dataset.type;
  }

  function getFieldError(field) {
    if (!field.id) {
      field.id = "mo-reset-field-" + Math.random().toString(36).slice(2, 10);
    }

    return document.getElementById(field.id + "-error");
  }

  function clearFieldError(field) {
    if (!field) return;

    field.removeAttribute("aria-invalid");

    const error = getFieldError(field);

    if (error) error.remove();

    const existingIds = (field.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter(Boolean)
      .filter(function (id) {
        return id !== field.id + "-error";
      });

    if (existingIds.length) {
      field.setAttribute("aria-describedby", existingIds.join(" "));
    } else {
      field.removeAttribute("aria-describedby");
    }
  }

  function setFieldError(field, message) {
    if (!field.id) {
      field.id = "mo-reset-field-" + Math.random().toString(36).slice(2, 10);
    }

    const errorId = field.id + "-error";
    let error = document.getElementById(errorId);

    if (!error) {
      error = document.createElement("p");
      error.id = errorId;
      error.className = "mo-reset-field-error";
      error.style.cssText =
        "margin:6px 0 0;color:#a12820;font-size:12px;line-height:1.5;";
      field.insertAdjacentElement("afterend", error);
    }

    error.textContent = message;
    field.setAttribute("aria-invalid", "true");

    const describedBy = new Set(
      (field.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean)
    );

    describedBy.add(errorId);
    field.setAttribute("aria-describedby", Array.from(describedBy).join(" "));
  }

  function getPasswordStrength(password) {
    let score = 0;
    const value = String(password || "");

    if (value.length >= state.config.minPasswordLength) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    if (value.length >= 14) score++;

    let label = "Very weak";

    if (!value) label = "Not entered";
    else if (score <= 1) label = "Weak";
    else if (score === 2) label = "Fair";
    else if (score === 3) label = "Good";
    else label = "Strong";

    return {
      score: score,
      label: label,
      valid: value.length >= state.config.minPasswordLength &&
        value.length <= state.config.maxPasswordLength &&
        /[A-Za-z]/.test(value) &&
        /\d/.test(value)
    };
  }

  function updateStrength(form, password) {
    const output = form.querySelector(state.config.selectors.strength);
    if (!output) return;

    const result = getPasswordStrength(password.value);

    output.textContent = password.value
      ? "Password strength: " + result.label
      : "Use at least " + state.config.minPasswordLength +
        " characters, including letters and numbers.";

    output.dataset.strength = result.label.toLowerCase().replace(/\s+/g, "-");
    output.setAttribute("aria-live", "polite");
  }

  function validateEmail(field) {
    const value = String(field.value || "").trim();

    if (!value) return "Enter your email address.";

    if (
      value.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      return "Enter a valid email address.";
    }

    return "";
  }

  function validatePassword(field) {
    const value = String(field.value || "");
    const cfg = state.config;

    if (!value) return "Enter your new password.";

    if (value.length < cfg.minPasswordLength) {
      return "Use at least " + cfg.minPasswordLength + " characters.";
    }

    if (value.length > cfg.maxPasswordLength) {
      return "Password must not exceed " + cfg.maxPasswordLength + " characters.";
    }

    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
      return "Include at least one letter and one number.";
    }

    return "";
  }

  function validateForm(form) {
    const isForgot = form.matches(state.config.selectors.forgotForm);
    const email = form.querySelector('input[type="email"], [name="email"]');
    const password = form.querySelector(state.config.selectors.password);
    const confirmation = form.querySelector(state.config.selectors.confirmation);
    let firstInvalid = null;

    queryAll(form, "input, select, textarea").forEach(clearFieldError);

    if (isForgot) {
      if (!email) {
        setStatus(form, "The email field is missing from this form.", "error");
        return false;
      }

      const error = validateEmail(email);

      if (error) {
        setFieldError(email, error);
        firstInvalid = email;
      }
    } else {
      if (!password) {
        setStatus(form, "The new password field is missing from this form.", "error");
        return false;
      }

      const passwordError = validatePassword(password);

      if (passwordError) {
        setFieldError(password, passwordError);
        firstInvalid = password;
      }

      if (confirmation) {
        if (!confirmation.value) {
          setFieldError(confirmation, "Confirm your new password.");
          if (!firstInvalid) firstInvalid = confirmation;
        } else if (confirmation.value !== password.value) {
          setFieldError(confirmation, "The passwords do not match.");
          if (!firstInvalid) firstInvalid = confirmation;
        }
      }
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }

    return true;
  }

  function setBusy(form, busy) {
    const submitButtons = queryAll(
      form,
      'button[type="submit"], input[type="submit"], ' +
      state.config.selectors.submit
    );

    submitButtons.forEach(function (button) {
      if (busy) {
        if (!button.hasAttribute("data-mo-reset-original-text")) {
          button.dataset.moResetOriginalText =
            button.tagName === "INPUT" ? button.value : button.textContent;
        }

        button.disabled = true;
        button.setAttribute("aria-busy", "true");

        if (button.tagName === "INPUT") {
          button.value = "Please wait...";
        } else {
          button.textContent = "Please wait...";
        }
      } else {
        button.disabled = false;
        button.removeAttribute("aria-busy");

        if (button.hasAttribute("data-mo-reset-original-text")) {
          const original = button.dataset.moResetOriginalText;

          if (button.tagName === "INPUT") button.value = original;
          else button.textContent = original;

          delete button.dataset.moResetOriginalText;
        }
      }
    });
  }

  async function requestJSON(url, payload) {
    const controller = typeof AbortController !== "undefined"
      ? new AbortController()
      : null;

    const timeout = controller
      ? window.setTimeout(
          function () {
            controller.abort();
          },
          state.config.requestTimeout
        )
      : null;

    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json"
    };

    const csrf = getCSRFToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });

      const contentType = response.headers.get("content-type") || "";
      let body = {};

      if (contentType.includes("application/json")) {
        body = await response.json();
      } else {
        const text = await response.text();
        if (text) body.message = text;
      }

      if (!response.ok) {
        const error = new Error(
          safeMessage(body.message, "The request failed. Please try again.")
        );
        error.status = response.status;
        throw error;
      }

      return body;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("The request timed out. Please try again.");
      }

      if (error instanceof TypeError) {
        throw new Error("Unable to connect. Check your connection and try again.");
      }

      throw error;
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
    }
  }

  function getToken(form) {
    const url = new URL(window.location.href);

    const hiddenToken = form.querySelector(
      'input[name="token"], input[name="resetToken"]'
    );

    return (
      (hiddenToken && hiddenToken.value.trim()) ||
      url.searchParams.get("token") ||
      url.searchParams.get("resetToken") ||
      ""
    );
  }

  async function handleSubmit(event) {
    const form = event.currentTarget;

    if (state.activeRequests.has(form)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    clearStatus(form);

    if (!validateForm(form)) {
      setStatus(form, "Please correct the highlighted fields.", "error");
      return;
    }

    const isForgot = form.matches(state.config.selectors.forgotForm);

    const payload = {};

    if (isForgot) {
      const email = form.querySelector('input[type="email"], [name="email"]');
      payload.email = email.value.trim().toLowerCase();
    } else {
      const password = form.querySelector(state.config.selectors.password);
      const token = getToken(form);

      if (!token) {
        setStatus(
          form,
          "This reset link is missing its token. Please request a new password-reset link.",
          "error"
        );
        return;
      }

      payload.token = token;
      payload.password = password.value;

      const confirmation = form.querySelector(state.config.selectors.confirmation);
      if (confirmation) payload.confirmPassword = confirmation.value;
    }

    const endpoint = isForgot
      ? state.config.forgotEndpoint
      : state.config.resetEndpoint;

    if (!endpoint || typeof endpoint !== "string") {
      setStatus(form, "Password reset is not configured on this website.", "error");
      return;
    }

    state.activeRequests.add(form);
    setBusy(form, true);
    setStatus(form, "Processing your request securely...", "info");

    try {
      const result = await requestJSON(endpoint, payload);

      if (isForgot) {
        // Use a generic message to reduce email-account enumeration.
        setStatus(
          form,
          "If an account matches that email address, password-reset instructions will be sent.",
          "success"
        );

        form.dispatchEvent(new CustomEvent("medorbits:resetrequest", {
          bubbles: true,
          detail: { success: true }
        }));
      } else {
        setStatus(
          form,
          safeMessage(result.message, "Your password has been reset successfully."),
          "success"
        );

        form.dispatchEvent(new CustomEvent("medorbits:passwordreset", {
          bubbles: true,
          detail: { success: true }
        }));

        const password = form.querySelector(state.config.selectors.password);
        const confirmation = form.querySelector(state.config.selectors.confirmation);

        if (password) password.value = "";
        if (confirmation) confirmation.value = "";

        const redirect = form.dataset.successRedirect;

        if (redirect) {
          try {
            const target = new URL(redirect, window.location.origin);

            if (target.origin === window.location.origin) {
              window.setTimeout(function () {
                window.location.assign(target.href);
              }, 1200);
            }
          } catch (_) {
            // Ignore invalid or unsafe redirect destinations.
          }
        }
      }
    } catch (error) {
      setStatus(
        form,
        safeMessage(error.message, "Unable to complete the request. Please try again."),
        "error"
      );

      form.dispatchEvent(new CustomEvent("medorbits:reseterror", {
        bubbles: true,
        detail: {
          message: safeMessage(error.message, "Request failed"),
          status: error.status || null
        }
      }));
    } finally {
      state.activeRequests.delete(form);
      setBusy(form, false);
    }
  }

  function bindForm(form) {
    if (state.boundForms.has(form)) return;

    state.boundForms.add(form);
    listen(form, "submit", handleSubmit);

    const password = form.querySelector(state.config.selectors.password);

    if (password) {
      listen(password, "input", function () {
        updateStrength(form, password);

        const confirmation = form.querySelector(state.config.selectors.confirmation);
        if (confirmation && confirmation.value) {
          clearFieldError(confirmation);

          if (confirmation.value !== password.value) {
            setFieldError(confirmation, "The passwords do not match.");
          }
        }
      });

      updateStrength(form, password);
    }

    const confirmation = form.querySelector(state.config.selectors.confirmation);

    if (confirmation) {
      listen(confirmation, "input", function () {
        clearFieldError(confirmation);

        if (confirmation.value && password && confirmation.value !== password.value) {
          setFieldError(confirmation, "The passwords do not match.");
        }
      });
    }
  }

  function bindPasswordToggles(root) {
    queryAll(root, state.config.selectors.toggle).forEach(function (button) {
      if (state.boundToggles.has(button)) return;

      state.boundToggles.add(button);

      listen(button, "click", function () {
        const targetId = button.getAttribute("data-target");
        let input = null;

        if (targetId) {
          input = document.getElementById(targetId);
        } else {
          input = button.parentElement
            ? button.parentElement.querySelector('input[type="password"], input[type="text"]')
            : null;
        }

        if (!input || !/^(password|text)$/.test(input.type)) return;

        const show = input.type === "password";
        input.type = show ? "text" : "password";

        button.setAttribute("aria-pressed", String(show));
        button.setAttribute(
          "aria-label",
          show ? "Hide password" : "Show password"
        );

        const text = button.querySelector("[data-mo-toggle-label]");
        if (text) text.textContent = show ? "Hide" : "Show";
      });
    });
  }

  function refresh(root) {
    const scope = root || document;
    const forms = new Set();

    queryAll(scope, state.config.selectors.forgotForm).forEach(function (form) {
      forms.add(form);
    });

    queryAll(scope, state.config.selectors.resetForm).forEach(function (form) {
      forms.add(form);
    });

    // Also support a form passed directly to refresh().
    if (
      scope instanceof HTMLFormElement &&
      (scope.matches(state.config.selectors.forgotForm) ||
       scope.matches(state.config.selectors.resetForm))
    ) {
      forms.add(scope);
    }

    forms.forEach(bindForm);
    bindPasswordToggles(scope);
  }

  function init(options) {
    if (state.initialized) {
      if (options) mergeConfig(options);
      refresh(document);
      return api;
    }

    mergeConfig(options);
    refresh(document);

    if ("MutationObserver" in window && document.documentElement) {
      state.observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) refresh(node);
          });
        });
      });

      state.observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    state.initialized = true;
    return api;
  }

  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.listeners.forEach(function (removeListener) {
      removeListener();
    });

    state.listeners = [];
    state.boundForms = new WeakSet();
    state.boundToggles = new WeakSet();
    state.activeRequests = new WeakSet();
    state.initialized = false;
  }

  const api = {
    init: init,
    refresh: refresh,
    destroy: destroy,
    validate: validateForm,
    getPasswordStrength: getPasswordStrength,
    config: function () {
      return { ...state.config, selectors: { ...state.config.selectors } };
    }
  };

  window.MedOrbitsReset = api;

  function boot() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
