
/* =========================================================
   MEDORBITS | LOGIN & LOGOUT CONTROLLER
   File: assets/js/login-logout.js
   Version: 1.0.0
   Dependencies: None (MedOrbits modules optional)
   Namespace: window.MedOrbitsLoginLogout
   ========================================================= */

(function (window, document) {
  "use strict";

  var GLOBAL_KEY = "__MEDORBITS_LOGIN_LOGOUT_V1__";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].refresh();
    return;
  }

  var DEFAULTS = {
    loginSelector: "[data-mo-login-form]",
    logoutSelector: "[data-mo-logout]",
    statusSelector: "[data-auth-status]",
    loginEndpoint: "/api/auth/login",
    logoutEndpoint: "/api/auth/logout",
    sessionEndpoint: "/api/auth/me",
    requestTimeout: 15000,
    validateOnInput: true,
    validateOnBlur: true,
    redirectAfterLogin: "",
    redirectAfterLogout: "",
    checkSessionOnLoad: false,
    showPasswordSelector: "[data-toggle-password]",
    preventDuplicateSubmit: true,
    messages: {
      required: "Please complete this field.",
      email: "Enter a valid email address.",
      password: "Enter your password.",
      invalid: "The credentials could not be verified.",
      network: "Unable to connect. Check your connection and try again.",
      loginSuccess: "Login successful. Redirecting…",
      logoutSuccess: "You have been logged out.",
      logoutError: "Logout failed. Please try again.",
      sessionExpired: "Your session may have expired. Please log in again."
    }
  };

  var state = {
    options: Object.assign({}, DEFAULTS),
    forms: new Map(),
    logoutButtons: new Map(),
    listeners: [],
    observer: null,
    started: false
  };

  /* ---------------------------------------------------------
     HELPERS
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

  function listen(target, eventName, callback, options) {
    if (!target || !target.addEventListener) {
      return function () {};
    }

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

  function clean(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .slice(0, maxLength || 2000);
  }

  function reducedMotion() {
    return Boolean(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function safeRedirect(value) {
    if (!value || typeof value !== "string") return "";

    try {
      var url = new URL(value, window.location.href);

      if (url.origin !== window.location.origin) return "";

      // Avoid redirecting to javascript:, data:, or other schemes.
      if (url.protocol !== window.location.protocol &&
          url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }

      return url.href;
    } catch (error) {
      return "";
    }
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

  function getStatus(form) {
    var status = query(state.options.statusSelector, form);

    if (!status) {
      status = document.createElement("p");
      status.setAttribute("data-auth-status", "");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      form.appendChild(status);
    }

    return status;
  }

  function setStatus(form, message, type) {
    if (!form) return;

    var status = getStatus(form);

    status.textContent = clean(message, 1000);
    status.dataset.statusType = type || "info";
    status.setAttribute("role", type === "error" ? "alert" : "status");
    status.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    status.hidden = !message;
  }

  function setButtonBusy(button, busy, busyText) {
    if (!button) return;

    if (busy) {
      if (!button.hasAttribute("data-mo-original-text")) {
        button.setAttribute("data-mo-original-text", button.textContent);
        button.setAttribute(
          "data-mo-original-disabled",
          button.disabled ? "true" : "false"
        );
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");

      if (busyText) button.textContent = busyText;
    } else {
      var originalText = button.getAttribute("data-mo-original-text");
      var originalDisabled = button.getAttribute("data-mo-original-disabled");

      if (originalText !== null) button.textContent = originalText;

      button.disabled = originalDisabled === "true";
      button.removeAttribute("data-mo-original-text");
      button.removeAttribute("data-mo-original-disabled");
      button.removeAttribute("aria-busy");
    }
  }

  function setFormBusy(form, busy) {
    var record = state.forms.get(form);
    if (!record) return;

    record.busy = busy;
    form.setAttribute("aria-busy", busy ? "true" : "false");

    queryAll("[type='submit']", form).forEach(function (button) {
      setButtonBusy(button, busy, busy ? "Please wait…" : "");
    });
  }

  function getEndpoint(element, attribute, fallback) {
    var configured = element.getAttribute(attribute);

    return configured && configured.trim()
      ? configured.trim()
      : fallback;
  }

  /* ---------------------------------------------------------
     VALIDATION
     --------------------------------------------------------- */

  function validateField(field) {
    if (!field || field.disabled || field.type === "hidden") {
      return { valid: true, message: "" };
    }

    var value = String(field.value || "").trim();
    var message = "";

    if (field.required && !value) {
      message = field.type === "password"
        ? state.options.messages.password
        : state.options.messages.required;
    } else if (value && field.type === "email") {
      var validEmail = window.MedOrbitsValidation &&
        typeof window.MedOrbitsValidation.isEmail === "function"
        ? window.MedOrbitsValidation.isEmail(value)
        : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

      if (!validEmail) message = state.options.messages.email;
    }

    if (field.type === "password" && field.required && !value) {
      message = state.options.messages.password;
    }

    var error = query("[data-auth-field-error]", field.parentElement);

    if (!error && field.parentElement) {
      error = document.createElement("span");
      error.setAttribute("data-auth-field-error", "");
      error.className = "mo-auth-field-error";
      error.hidden = true;
      field.parentElement.appendChild(error);
    }

    if (message) {
      field.setAttribute("aria-invalid", "true");

      if (error) {
        if (!error.id) {
          error.id = "mo-auth-error-" + Math.random().toString(36).slice(2, 10);
        }

        error.textContent = message;
        error.hidden = false;

        var describedBy = (field.getAttribute("aria-describedby") || "")
          .split(/\s+/).filter(Boolean);

        if (!describedBy.includes(error.id)) describedBy.push(error.id);

        field.setAttribute("aria-describedby", describedBy.join(" "));
      }
    } else {
      field.removeAttribute("aria-invalid");

      if (error) {
        error.textContent = "";
        error.hidden = true;

        var ids = (field.getAttribute("aria-describedby") || "")
          .split(/\s+/).filter(function (id) {
            return id && id !== error.id;
          });

        if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
        else field.removeAttribute("aria-describedby");
      }
    }

    return {
      valid: !message,
      message: message
    };
  }

  function validateLoginForm(form) {
    var fields = queryAll(
      "input[required], select[required], textarea[required]",
      form
    ).filter(function (field) {
      return field.type !== "hidden" &&
        field.type !== "submit" &&
        field.type !== "button" &&
        !field.disabled;
    });

    var firstInvalid = null;
    var valid = true;

    fields.forEach(function (field) {
      var result = validateField(field);

      if (!result.valid) {
        valid = false;
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });

      firstInvalid.scrollIntoView({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "center"
      });
    }

    return {
      valid: valid,
      firstInvalid: firstInvalid
    };
  }

  /* ---------------------------------------------------------
     NETWORK REQUESTS
     --------------------------------------------------------- */

  async function requestJSON(url, options) {
    var controller = "AbortController" in window
      ? new AbortController()
      : null;

    var timeoutId = null;

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, state.options.requestTimeout);
    }

    try {
      var headers = Object.assign({
        "Accept": "application/json"
      }, options.headers || {});

      var requestOptions = Object.assign({}, options, {
        headers: headers,
        credentials: "same-origin"
      });

      if (controller) requestOptions.signal = controller.signal;

      var response = await window.fetch(url, requestOptions);
      var contentType = response.headers.get("content-type") || "";

      var body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        var message = body && typeof body === "object" && body.message
          ? body.message
          : "Request failed (HTTP " + response.status + ").";

        var error = new Error(clean(message, 1000));
        error.status = response.status;
        error.body = body;

        throw error;
      }

      return body;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("The request timed out. Please try again.");
      }

      if (error instanceof TypeError) {
        throw new Error(state.options.messages.network);
      }

      throw error;
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }

  function getCsrfToken() {
    var meta = query('meta[name="csrf-token"]');

    if (meta && meta.content) return meta.content;

    var input = query('input[name="_csrf"]');

    return input ? input.value : "";
  }

  async function postJSON(endpoint, payload) {
    var csrf = getCsrfToken();
    var headers = {
      "Content-Type": "application/json"
    };

    if (csrf) headers["X-CSRF-Token"] = csrf;

    /*
     * The API client is optional. Direct fetch is used here to keep
     * request timeout and response handling consistent.
     */
    return requestJSON(endpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload)
    });
  }

  /* ---------------------------------------------------------
     LOGIN
     --------------------------------------------------------- */

  function getLoginPayload(form) {
    var identifier = query(
      '[name="email"], [name="identifier"], [name="username"]',
      form
    );

    var password = query('[name="password"]', form);

    var payload = {
      password: password ? password.value : ""
    };

    if (identifier) {
      var key = identifier.name === "username" ? "username" : "email";
      payload[key] = identifier.value.trim();
    }

    var remember = query('[name="remember"], [name="remember_me"]', form);

    if (remember) {
      payload.remember = remember.type === "checkbox"
        ? remember.checked
        : Boolean(remember.value);
    }

    return payload;
  }

  async function handleLogin(form, event) {
    var record = state.forms.get(form);

    if (!record) return;

    if (state.options.preventDuplicateSubmit && record.busy) {
      event.preventDefault();
      return;
    }

    var endpoint = getEndpoint(
      form,
      "data-login-url",
      state.options.loginEndpoint
    );

    // Always handle marked login forms with client-side validation.
    event.preventDefault();

    var validation = validateLoginForm(form);

    if (!validation.valid) {
      setStatus(form, "Please correct the highlighted fields.", "error");
      return;
    }

    var payload = getLoginPayload(form);

    if (!payload.password ||
        (!payload.email && !payload.username)) {
      setStatus(form, "Enter your login details to continue.", "error");
      return;
    }

    setFormBusy(form, true);
    setStatus(form, "Signing you in…", "info");

    form.dispatchEvent(new CustomEvent("medorbits:loginstarted", {
      bubbles: true
    }));

    try {
      var result = await postJSON(endpoint, payload);

      /*
       * The backend must set a secure session cookie or use its
       * established authentication mechanism. Never store passwords
       * or authentication tokens in localStorage.
       */
      if (result && result.success === false) {
        throw new Error(result.message || state.options.messages.invalid);
      }

      setStatus(form, state.options.messages.loginSuccess, "success");

      form.dispatchEvent(new CustomEvent("medorbits:loginsuccess", {
        bubbles: true,
        detail: { result: result }
      }));

      notify(state.options.messages.loginSuccess, "success");

      var requestedRedirect = form.getAttribute("data-redirect") ||
        state.options.redirectAfterLogin;

      var redirect = safeRedirect(requestedRedirect);

      if (redirect) {
        window.setTimeout(function () {
          window.location.assign(redirect);
        }, reducedMotion() ? 0 : 250);
      } else {
        setFormBusy(form, false);
      }
    } catch (error) {
      var message = clean(
        error && error.message
          ? error.message
          : state.options.messages.invalid,
        1000
      );

      setStatus(form, message, "error");
      notify(message, "error");

      form.dispatchEvent(new CustomEvent("medorbits:loginfailed", {
        bubbles: true,
        detail: { message: message }
      }));

      setFormBusy(form, false);
    }
  }

  /* ---------------------------------------------------------
     LOGOUT
     --------------------------------------------------------- */

  async function handleLogout(button) {
    var record = state.logoutButtons.get(button);

    if (!record || record.busy) return;

    var endpoint = getEndpoint(
      button,
      "data-logout-url",
      state.options.logoutEndpoint
    );

    record.busy = true;
    setButtonBusy(button, true, "Signing out…");

    button.dispatchEvent(new CustomEvent("medorbits:logoutstarted", {
      bubbles: true
    }));

    try {
      var csrf = getCsrfToken();
      var headers = { "Accept": "application/json" };

      if (csrf) headers["X-CSRF-Token"] = csrf;

      await requestJSON(endpoint, {
        method: "POST",
        headers: headers
      });

      notify(state.options.messages.logoutSuccess, "success");

      button.dispatchEvent(new CustomEvent("medorbits:logoutsuccess", {
        bubbles: true
      }));

      var redirect = safeRedirect(
        button.getAttribute("data-redirect") ||
        state.options.redirectAfterLogout
      );

      if (redirect) {
        window.location.assign(redirect);
      } else {
        setButtonBusy(button, false);
        record.busy = false;
      }
    } catch (error) {
      var message = clean(
        error && error.message
          ? error.message
          : state.options.messages.logoutError,
        1000
      );

      notify(message, "error");

      button.dispatchEvent(new CustomEvent("medorbits:logoutfailed", {
        bubbles: true,
        detail: { message: message }
      }));

      setButtonBusy(button, false);
      record.busy = false;
    }
  }

  /* ---------------------------------------------------------
     PASSWORD VISIBILITY
     --------------------------------------------------------- */

  function bindPasswordToggle(button) {
    if (button.hasAttribute("data-mo-password-bound")) return;

    var targetSelector = button.getAttribute("data-toggle-password");
    var input = targetSelector ? query(targetSelector) : null;

    if (!input) {
      var wrapper = button.closest("[data-password-wrapper]") ||
        button.parentElement;

      input = wrapper && query('input[type="password"], input[type="text"]', wrapper);
    }

    if (!input || input.tagName !== "INPUT") return;

    button.setAttribute("data-mo-password-bound", "true");

    listen(button, "click", function () {
      var showing = input.type === "password";

      input.type = showing ? "text" : "password";
      button.setAttribute("aria-pressed", showing ? "true" : "false");
      button.setAttribute(
        "aria-label",
        showing ? "Hide password" : "Show password"
      );
    });
  }

  /* ---------------------------------------------------------
     FORM BINDING
     --------------------------------------------------------- */

  function bindLoginForm(form) {
    if (state.forms.has(form)) return;

    var record = { busy: false, removers: [] };
    state.forms.set(form, record);

    function add(target, eventName, handler) {
      target.addEventListener(eventName, handler);
      record.removers.push(function () {
        target.removeEventListener(eventName, handler);
      });
    }

    add(form, "submit", function (event) {
      handleLogin(form, event);
    });

    if (state.options.validateOnBlur) {
      add(form, "focusout", function (event) {
        if (event.target.matches("input, select, textarea")) {
          validateField(event.target);
        }
      });
    }

    if (state.options.validateOnInput) {
      add(form, "input", function (event) {
        if (event.target.matches("input, select, textarea") &&
            event.target.getAttribute("aria-invalid") === "true") {
          validateField(event.target);
        }
      });
    }

    add(form, "reset", function () {
      window.setTimeout(function () {
        queryAll("[aria-invalid]", form).forEach(function (field) {
          field.removeAttribute("aria-invalid");
        });

        queryAll("[data-auth-field-error]", form).forEach(function (error) {
          error.textContent = "";
          error.hidden = true;
        });

        setStatus(form, "", "info");
      }, 0);
    });
  }

  function bindLogoutButton(button) {
    if (state.logoutButtons.has(button)) return;

    var record = { busy: false };
    state.logoutButtons.set(button, record);

    listen(button, "click", function (event) {
      event.preventDefault();
      handleLogout(button);
    });
  }

  /* ---------------------------------------------------------
     SESSION CHECK (OPTIONAL)
     --------------------------------------------------------- */

  async function checkSession() {
    var endpoint = state.options.sessionEndpoint;

    try {
      return await requestJSON(endpoint, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
    } catch (error) {
      return null;
    }
  }

  /* ---------------------------------------------------------
     INITIALIZATION AND CLEANUP
     --------------------------------------------------------- */

  function refresh() {
    queryAll(state.options.loginSelector).forEach(bindLoginForm);
    queryAll(state.options.logoutSelector).forEach(bindLogoutButton);
    queryAll(state.options.showPasswordSelector).forEach(bindPasswordToggle);

    state.forms.forEach(function (record, form) {
      if (!form.isConnected) {
        record.removers.forEach(function (remove) {
          remove();
        });

        state.forms.delete(form);
      }
    });

    state.logoutButtons.forEach(function (record, button) {
      if (!button.isConnected) state.logoutButtons.delete(button);
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
      record.removers.forEach(function (remove) {
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
    state.logoutButtons.clear();
    state.started = false;
  }

  var api = {
    version: "1.0.0",
    init: init,
    refresh: refresh,
    configure: configure,
    validateField: validateField,
    validateLoginForm: validateLoginForm,
    checkSession: checkSession,
    logout: handleLogout,
    destroy: destroy
  };

  window[GLOBAL_KEY] = api;
  window.MedOrbitsLoginLogout = api;

  function start() {
    init();

    if (state.options.checkSessionOnLoad) {
      checkSession().then(function (result) {
        document.dispatchEvent(new CustomEvent("medorbits:sessionchecked", {
          detail: { session: result }
        }));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window, document);
