
/* =========================================================
   MedOrbits -- Verification Manager
   File: /assets/js/verification.js

   Email, phone, identity, and document verification.
   Server responses are authoritative for verification status.
   ========================================================= */

(function (window, document) {
  "use strict";

  var CONFIG = window.MedOrbitsConfig || {};
  var CONSTANTS = window.MedOrbitsConstants || {};
  var API = CONSTANTS.API || {};

  var API_BASE = String(
    CONFIG.API_BASE_URL ||
    CONFIG.apiBaseUrl ||
    CONFIG.apiBaseURL ||
    "/api"
  ).replace(/\/+$/, "");

  var ENDPOINTS = Object.freeze({
    status: API.VERIFICATION_STATUS || API_BASE + "/verification/status",
    emailSend: API.EMAIL_VERIFICATION_SEND || API_BASE + "/verification/email/send",
    emailConfirm: API.EMAIL_VERIFICATION_CONFIRM || API_BASE + "/verification/email/confirm",
    phoneSend: API.PHONE_VERIFICATION_SEND || API_BASE + "/verification/phone/send",
    phoneConfirm: API.PHONE_VERIFICATION_CONFIRM || API_BASE + "/verification/phone/confirm",
    identity: API.IDENTITY_VERIFICATION || API_BASE + "/verification/identity",
    documents: API.DOCUMENT_VERIFICATION || API_BASE + "/verification/documents"
  });

  var STATUS = Object.freeze({
    UNVERIFIED: "unverified",
    PENDING: "pending",
    VERIFIED: "verified",
    REJECTED: "rejected",
    EXPIRED: "expired"
  });

  var VALID_TYPES = ["email", "phone", "identity", "documents"];
  var listeners = [];
  var requestVersion = 0;
  var activeStatusController = null;
  var destroyed = false;

  var state = {
    status: {
      email: STATUS.UNVERIFIED,
      phone: STATUS.UNVERIFIED,
      identity: STATUS.UNVERIFIED,
      documents: STATUS.UNVERIFIED
    },
    loading: false,
    sending: false,
    confirming: false,
    identitySubmitting: false,
    documentsSubmitting: false,
    error: null,
    lastUpdated: null
  };

  function isObject(value) {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value);
  }

  function emit(name, detail) {
    try {
      document.dispatchEvent(new window.CustomEvent(name, {
        detail: detail || {}
      }));
    } catch (error) {
      // Event support is optional.
    }
  }

  function normalizeStatus(value) {
    if (isObject(value)) {
      value = value.status;
    }

    var status = String(value || "").trim().toLowerCase();

    var aliases = {
      complete: STATUS.VERIFIED,
      completed: STATUS.VERIFIED,
      success: STATUS.VERIFIED,
      approved: STATUS.VERIFIED,
      verified: STATUS.VERIFIED,
      in_review: STATUS.PENDING,
      "in-review": STATUS.PENDING,
      processing: STATUS.PENDING,
      submitted: STATUS.PENDING,
      declined: STATUS.REJECTED,
      failed: STATUS.REJECTED,
      rejected: STATUS.REJECTED,
      not_verified: STATUS.UNVERIFIED,
      "not-verified": STATUS.UNVERIFIED,
      not_started: STATUS.UNVERIFIED,
      "not-started": STATUS.UNVERIFIED,
      invalid: STATUS.REJECTED,
      timed_out: STATUS.EXPIRED,
      "timed-out": STATUS.EXPIRED
    };

    var normalized = aliases[status] || status;

    return Object.prototype.hasOwnProperty.call(
      STATUS,
      String(normalized).toUpperCase()
    )
      ? STATUS[String(normalized).toUpperCase()]
      : STATUS.UNVERIFIED;
  }

  function normalizeStatusPayload(result) {
    var source = result;

    if (isObject(source) && isObject(source.data)) {
      source = source.data;
    }

    if (isObject(source) && isObject(source.verification)) {
      source = source.verification;
    }

    if (isObject(source) && isObject(source.statuses)) {
      source = source.statuses;
    }

    source = isObject(source) ? source : {};

    var email = source.emailStatus;
    var phone = source.phoneStatus;
    var identity = source.identityStatus;
    var documents = source.documentsStatus;

    if (email === undefined) email = source.emailVerificationStatus;
    if (phone === undefined) phone = source.phoneVerificationStatus;
    if (identity === undefined) identity = source.identityVerificationStatus;
    if (documents === undefined) documents = source.documentVerificationStatus;

    if (email === undefined) email = source.email;
    if (phone === undefined) phone = source.phone;
    if (identity === undefined) identity = source.identity;
    if (documents === undefined) documents = source.documents;

    return {
      email: normalizeStatus(email),
      phone: normalizeStatus(phone),
      identity: normalizeStatus(identity),
      documents: normalizeStatus(documents)
    };
  }

  function getErrorMessage(result, fallback) {
    if (isObject(result)) {
      if (typeof result.message === "string" && result.message.trim()) {
        return result.message.trim();
      }

      if (typeof result.error === "string" && result.error.trim()) {
        return result.error.trim();
      }
    }

    return fallback || "The verification request could not be completed.";
  }

  function createRequestError(message, status, code) {
    var error = new Error(message);

    error.status = status || 0;

    if (code) {
      error.code = code;
    }

    return error;
  }

  function requestJSON(url, options) {
    options = options || {};

    var method = String(options.method || "GET").toUpperCase();
    var headers = {
      Accept: "application/json"
    };

    if (options.headers) {
      Object.keys(options.headers).forEach(function (key) {
        headers[key] = options.headers[key];
      });
    }

    var body = options.body;
    var isFormData = typeof window.FormData === "function" &&
      body instanceof window.FormData;

    if (body !== undefined && body !== null && !isFormData &&
        !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }

    var requestOptions = {
      method: method,
      credentials: "same-origin",
      headers: headers,
      signal: options.signal
    };

    if (body !== undefined) {
      requestOptions.body = body;
    }

    return window.fetch(url, requestOptions).then(function (response) {
      if (response.status === 204) {
        if (!response.ok) {
          throw createRequestError("Request failed.", response.status);
        }

        return null;
      }

      return response.text().then(function (text) {
        var result = null;
        var contentType = response.headers &&
          response.headers.get("content-type") || "";

        if (text) {
          if (contentType.toLowerCase().indexOf("json") !== -1) {
            try {
              result = JSON.parse(text);
            } catch (error) {
              throw createRequestError(
                "The server returned an invalid response.",
                response.status
              );
            }
          } else {
            result = { message: text };
          }
        }

        if (!response.ok) {
          throw createRequestError(
            getErrorMessage(result, "Verification request failed."),
            response.status,
            result && result.code
          );
        }

        return result;
      });
    });
  }

  function getState() {
    return {
      status: copyStatus(),
      loading: state.loading,
      sending: state.sending,
      confirming: state.confirming,
      identitySubmitting: state.identitySubmitting,
      documentsSubmitting: state.documentsSubmitting,
      error: state.error,
      lastUpdated: state.lastUpdated,
      progress: getProgress()
    };
  }

  function copyStatus() {
    return {
      email: state.status.email,
      phone: state.status.phone,
      identity: state.status.identity,
      documents: state.status.documents
    };
  }

  function notify() {
    if (destroyed) return;

    var snapshot = getState();

    listeners.slice().forEach(function (callback) {
      try {
        callback(snapshot);
      } catch (error) {
        if (window.console && typeof window.console.error === "function") {
          window.console.error(
            "[MedOrbits Verification] Listener error:",
            error
          );
        }
      }
    });

    emit("medorbits:verification-updated", snapshot);
    renderAll();
  }

  function setError(error) {
    state.error = error && error.message
      ? String(error.message)
      : "Verification request failed.";

    if (
      window.MedOrbitsErrorHandler &&
      typeof window.MedOrbitsErrorHandler.handle === "function"
    ) {
      try {
        window.MedOrbitsErrorHandler.handle(
          error,
          { source: "verification" },
          { silent: true }
        );
      } catch (handlerError) {
        // Do not allow an optional error handler to break verification.
      }
    }

    emit("medorbits:verification-error", {
      message: state.error,
      status: error && error.status ? error.status : 0
    });
  }

  function clearError() {
    state.error = null;
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    var value = normalizeEmail(email);

    return value.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function normalizePhone(phone) {
    return String(phone || "").trim();
  }

  function isValidPhone(phone) {
    var digits = normalizePhone(phone).replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  }

  function normalizeCountryCode(value) {
    var code = String(value || "").trim();

    if (!code) return "";

    if (!/^\+?\d{1,4}$/.test(code)) {
      throw new Error("Enter a valid country calling code.");
    }

    return code.charAt(0) === "+" ? code : "+" + code;
  }

  function requireToken(token) {
    var value = String(token || "").trim();

    if (!value || value.length > 4096) {
      throw new Error("A valid verification token is required.");
    }

    return value;
  }

  function requireVerificationCode(code) {
    var value = String(code || "").trim();

    if (!/^\d{4,8}$/.test(value)) {
      throw new Error("Enter a valid verification code.");
    }

    return value;
  }

  function updateStatus(type, status) {
    if (VALID_TYPES.indexOf(type) === -1) return;

    state.status[type] = normalizeStatus(status);
    state.lastUpdated = new Date().toISOString();
  }

  function loadStatus() {
    var version = ++requestVersion;

    if (activeStatusController) {
      activeStatusController.abort();
      activeStatusController = null;
    }

    var controller = null;

    if (typeof window.AbortController === "function") {
      controller = new window.AbortController();
      activeStatusController = controller;
    }

    state.loading = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.status, {
      method: "GET",
      signal: controller ? controller.signal : undefined
    }).then(function (result) {
      if (destroyed || version !== requestVersion) {
        return getStatus();
      }

      state.status = normalizeStatusPayload(result);
      state.lastUpdated = new Date().toISOString();
      clearError();

      return getStatus();
    }).catch(function (error) {
      if (destroyed || version !== requestVersion) {
        return getStatus();
      }

      setError(error);
      throw error;
    }).then(function (result) {
      if (version === requestVersion && !destroyed) {
        state.loading = false;
        activeStatusController = null;
        notify();
      }

      return result;
    }, function (error) {
      if (version === requestVersion && !destroyed) {
        state.loading = false;
        activeStatusController = null;
        notify();
      }

      throw error;
    });
  }

  function getStatus() {
    return copyStatus();
  }

  function sendEmailVerification(email) {
    var value = normalizeEmail(email);

    if (!isValidEmail(value)) {
      return Promise.reject(new Error("Enter a valid email address."));
    }

    if (state.sending) {
      return Promise.reject(new Error(
        "A verification message is already being requested."
      ));
    }

    state.sending = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.emailSend, {
      method: "POST",
      body: JSON.stringify({ email: value })
    }).then(function (result) {
      updateStatus("email", STATUS.PENDING);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.sending = false;
      notify();
      return result;
    }, function (error) {
      state.sending = false;
      notify();
      throw error;
    });
  }

  function confirmEmailVerification(token) {
    var value;

    try {
      value = requireToken(token);
    } catch (error) {
      return Promise.reject(error);
    }

    if (state.confirming) {
      return Promise.reject(new Error(
        "A verification confirmation is already in progress."
      ));
    }

    state.confirming = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.emailConfirm, {
      method: "POST",
      body: JSON.stringify({ token: value })
    }).then(function (result) {
      /*
       * A successful server response confirms the operation.
       * The status endpoint remains authoritative for final account state.
       */
      updateStatus("email", result && result.status || STATUS.VERIFIED);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.confirming = false;
      notify();
      return result;
    }, function (error) {
      state.confirming = false;
      notify();
      throw error;
    });
  }

  function sendPhoneVerification(phone, countryCode) {
    var value = normalizePhone(phone);
    var code;

    if (!isValidPhone(value)) {
      return Promise.reject(new Error("Enter a valid phone number."));
    }

    try {
      code = normalizeCountryCode(countryCode);
    } catch (error) {
      return Promise.reject(error);
    }

    if (state.sending) {
      return Promise.reject(new Error(
        "A verification message is already being requested."
      ));
    }

    state.sending = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.phoneSend, {
      method: "POST",
      body: JSON.stringify({
        phone: value,
        countryCode: code
      })
    }).then(function (result) {
      updateStatus("phone", result && result.status || STATUS.PENDING);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.sending = false;
      notify();
      return result;
    }, function (error) {
      state.sending = false;
      notify();
      throw error;
    });
  }

  function confirmPhoneVerification(phone, code) {
    var phoneValue = normalizePhone(phone);
    var codeValue;

    if (!isValidPhone(phoneValue)) {
      return Promise.reject(new Error("Enter a valid phone number."));
    }

    try {
      codeValue = requireVerificationCode(code);
    } catch (error) {
      return Promise.reject(error);
    }

    if (state.confirming) {
      return Promise.reject(new Error(
        "A verification confirmation is already in progress."
      ));
    }

    state.confirming = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.phoneConfirm, {
      method: "POST",
      body: JSON.stringify({
        phone: phoneValue,
        code: codeValue
      })
    }).then(function (result) {
      updateStatus("phone", result && result.status || STATUS.VERIFIED);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.confirming = false;
      notify();
      return result;
    }, function (error) {
      state.confirming = false;
      notify();
      throw error;
    });
  }

  function validatePayload(payload, label) {
    if (!isObject(payload) || !Object.keys(payload).length) {
      throw new Error(label + " details are required.");
    }

    return payload;
  }

  function submitIdentityVerification(payload) {
    var body;

    try {
      body = validatePayload(payload, "Identity verification");
    } catch (error) {
      return Promise.reject(error);
    }

    if (state.identitySubmitting) {
      return Promise.reject(new Error(
        "Identity verification is already being submitted."
      ));
    }

    state.identitySubmitting = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.identity, {
      method: "POST",
      body: JSON.stringify(body)
    }).then(function (result) {
      updateStatus("identity", result && result.status || STATUS.PENDING);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.identitySubmitting = false;
      notify();
      return result;
    }, function (error) {
      state.identitySubmitting = false;
      notify();
      throw error;
    });
  }

  function submitDocumentVerification(payload) {
    var body;

    try {
      body = validatePayload(payload, "Document verification");
    } catch (error) {
      return Promise.reject(error);
    }

    if (state.documentsSubmitting) {
      return Promise.reject(new Error(
        "Document verification is already being submitted."
      ));
    }

    state.documentsSubmitting = true;
    clearError();
    notify();

    return requestJSON(ENDPOINTS.documents, {
      method: "POST",
      body: JSON.stringify(body)
    }).then(function (result) {
      updateStatus("documents", result && result.status || STATUS.PENDING);
      return result;
    }).catch(function (error) {
      setError(error);
      throw error;
    }).then(function (result) {
      state.documentsSubmitting = false;
      notify();
      return result;
    }, function (error) {
      state.documentsSubmitting = false;
      notify();
      throw error;
    });
  }

  function isVerified(type) {
    var key = String(type || "").toLowerCase();

    return Object.prototype.hasOwnProperty.call(state.status, key) &&
      state.status[key] === STATUS.VERIFIED;
  }

  function isFullyVerified(types) {
    types = Array.isArray(types) ? types : ["email", "phone"];

    return types.every(function (type) {
      return isVerified(type);
    });
  }

  function getProgress(types) {
    types = Array.isArray(types)
      ? types
      : ["email", "phone", "identity", "documents"];

    if (!types.length) return 100;

    var validTypes = types.filter(function (type) {
      return VALID_TYPES.indexOf(type) !== -1;
    });

    if (!validTypes.length) return 0;

    var completed = validTypes.filter(function (type) {
      return isVerified(type);
    }).length;

    return Math.round((completed / validTypes.length) * 100);
  }

  function resolveElement(element) {
    if (!element) return null;

    if (
      typeof window.Element === "function" &&
      element instanceof window.Element
    ) {
      return element;
    }

    try {
      return typeof element === "string"
        ? document.querySelector(element)
        : null;
    } catch (error) {
      return null;
    }
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  function renderStatus(container) {
    var target = resolveElement(container);
    if (!target) return false;

    var labels = {
      email: "Email Verification",
      phone: "Phone Verification",
      identity: "Identity Verification",
      documents: "Document Verification"
    };

    var fragment = document.createDocumentFragment();

    VALID_TYPES.forEach(function (key) {
      var status = state.status[key];
      var item = createElement(
        "div",
        "verification-item verification-item--" + status
      );

      item.setAttribute("data-verification-type", key);

      var content = createElement("div", "verification-item__content");
      var heading = createElement("h3", "", labels[key]);
      var badge = createElement(
        "span",
        "verification-status verification-status--" + status,
        status.charAt(0).toUpperCase() + status.slice(1)
      );

      content.appendChild(heading);
      content.appendChild(badge);
      item.appendChild(content);
      fragment.appendChild(item);
    });

    target.textContent = "";
    target.appendChild(fragment);

    return true;
  }

  function renderProgress(container) {
    var target = resolveElement(container);
    if (!target) return false;

    var progress = getProgress();
    var wrapper = createElement("div", "verification-progress");
    var header = createElement("div", "verification-progress__header");
    var label = createElement("span", "", "Verification Progress");
    var percentage = createElement("strong", "", progress + "%");
    var track = createElement("div", "verification-progress__track");
    var bar = createElement("span", "verification-progress__bar");

    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(progress));
    track.setAttribute("aria-label", "Verification progress");

    bar.style.width = progress + "%";

    header.appendChild(label);
    header.appendChild(percentage);
    track.appendChild(bar);
    wrapper.appendChild(header);
    wrapper.appendChild(track);

    target.textContent = "";
    target.appendChild(wrapper);

    return true;
  }

  function renderAll() {
    renderStatus("[data-verification-status]");
    renderProgress("[data-verification-progress]");
  }

  function showMessage(message, type) {
    type = type || "info";

    if (
      window.MedOrbitsToast &&
      typeof window.MedOrbitsToast.show === "function"
    ) {
      window.MedOrbitsToast.show(message, type);
      return;
    }

    emit("medorbits:toast", {
      message: message,
      type: type
    });
  }

  function getFormValue(form, name) {
    var field = form.elements.namedItem(name);

    return field ? field.value : "";
  }

  function handleVerificationSubmit(event) {
    var form = event.target;

    if (!form || typeof form.matches !== "function") return;

    var type = null;

    if (form.matches("[data-email-verification-form]")) {
      type = "email-send";
    } else if (form.matches("[data-phone-verification-form]")) {
      type = "phone-send";
    } else if (form.matches("[data-email-confirm-form]")) {
      type = "email-confirm";
    } else if (form.matches("[data-phone-confirm-form]")) {
      type = "phone-confirm";
    } else {
      return;
    }

    event.preventDefault();

    var submitButton = form.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }

    var action;

    try {
      switch (type) {
        case "email-send":
          action = sendEmailVerification(getFormValue(form, "email"));
          break;

        case "phone-send":
          action = sendPhoneVerification(
            getFormValue(form, "phone"),
            getFormValue(form, "countryCode")
          );
          break;

        case "email-confirm":
          action = confirmEmailVerification(getFormValue(form, "token"));
          break;

        case "phone-confirm":
          action = confirmPhoneVerification(
            getFormValue(form, "phone"),
            getFormValue(form, "code")
          );
          break;
      }
    } catch (error) {
      action = Promise.reject(error);
    }

    Promise.resolve(action).then(function () {
      var message = {
        "email-send": "Verification email requested.",
        "phone-send": "Phone verification code requested.",
        "email-confirm": "Email verification request completed.",
        "phone-confirm": "Phone verification request completed."
      };

      showMessage(message[type], "success");

      /*
       * Refresh status from the server. This avoids treating a client-side
       * response as the final source of truth for account verification.
       */
      return loadStatus().catch(function () {
        return getStatus();
      });
    }).catch(function (error) {
      showMessage(
        error && error.message
          ? error.message
          : "Verification failed. Please try again.",
        "error"
      );
    }).then(function () {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    });
  }

  function init() {
    if (destroyed) return;

    document.addEventListener("submit", handleVerificationSubmit);

    if (
      document.querySelector("[data-verification-status]") ||
      document.querySelector("[data-verification-progress]")
    ) {
      loadStatus().catch(function () {
        renderAll();
      });
    }
  }

  function destroy() {
    destroyed = true;
    requestVersion += 1;

    if (activeStatusController) {
      activeStatusController.abort();
      activeStatusController = null;
    }

    document.removeEventListener("submit", handleVerificationSubmit);
    listeners.length = 0;
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

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  var api = {
    STATUS: STATUS,
    ENDPOINTS: ENDPOINTS,

    loadStatus: loadStatus,
    sendEmailVerification: sendEmailVerification,
    confirmEmailVerification: confirmEmailVerification,
    sendPhoneVerification: sendPhoneVerification,
    confirmPhoneVerification: confirmPhoneVerification,
    submitIdentityVerification: submitIdentityVerification,
    submitDocumentVerification: submitDocumentVerification,

    getStatus: getStatus,
    getState: getState,
    isVerified: isVerified,
    isFullyVerified: isFullyVerified,
    getProgress: getProgress,

    renderStatus: renderStatus,
    renderProgress: renderProgress,
    renderAll: renderAll,
    subscribe: subscribe,
    init: init,
    destroy: destroy
  };

  if (typeof Object.freeze === "function") {
    Object.freeze(api);
  }

  window.MedOrbitsVerification = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})(window, document);
