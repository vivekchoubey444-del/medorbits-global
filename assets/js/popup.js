
/*!
 * MedOrbits | Enquiry Popup
 * File: assets/js/popup.js
 * Version: 1.0.0
 *
 * Features:
 * - Appears after 120 seconds of visible, active page time
 * - Automatically appears only once per browser tab session
 * - Responsive, smooth animation and mobile-friendly design
 * - Accessible dialog, keyboard support and focus management
 * - Enquiry form with client-side validation
 * - Sends enquiries to a configurable backend endpoint
 * - Respects reduced-motion preferences
 * - No external dependencies
 */

(function () {
  "use strict";

  if (window.MedOrbitsPopup) return;

  const CONFIG = {
    delay: 120000,
    sessionKey: "medorbits_enquiry_popup_shown",
    endpoint: "/api/enquiries",
    animationDuration: 260,
    maxMessageLength: 2000,
    phoneMinDigits: 7,
    phoneMaxDigits: 15
  };

  const state = {
    initialized: false,
    opened: false,
    closing: false,
    elapsed: 0,
    lastTick: Date.now(),
    timer: null,
    overlay: null,
    dialog: null,
    form: null,
    status: null,
    previousFocus: null,
    previousOverflow: "",
    submitting: false,
    endpoint: CONFIG.endpoint
  };

  const reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  function sessionHasShown() {
    try {
      return sessionStorage.getItem(CONFIG.sessionKey) === "1";
    } catch (_) {
      return false;
    }
  }

  function markSessionShown() {
    try {
      sessionStorage.setItem(CONFIG.sessionKey, "1");
    } catch (_) {
      // In-memory state still prevents repeats during this page lifetime.
    }
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function getCSRFToken() {
    const meta = document.querySelector(
      'meta[name="csrf-token"], meta[name="csrf_token"]'
    );

    return meta ? meta.content : "";
  }

  function injectStyles() {
    if (document.getElementById("mo-popup-styles")) return;

    const style = document.createElement("style");
    style.id = "mo-popup-styles";

    style.textContent = `
      .mo-popup-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(13, 24, 22, .68);
        backdrop-filter: blur(7px);
        -webkit-backdrop-filter: blur(7px);
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition:
          opacity ${CONFIG.animationDuration}ms ease,
          visibility ${CONFIG.animationDuration}ms ease;
      }

      .mo-popup-overlay.mo-popup-visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .mo-popup-dialog {
        position: relative;
        width: min(100%, 570px);
        max-height: min(88vh, 850px);
        overflow: auto;
        overscroll-behavior: contain;
        background: linear-gradient(145deg, #f5efe3, #e9e0d1 70%, #e4e9df);
        color: #20342d;
        border: 1px solid rgba(194, 160, 102, .65);
        border-radius: 22px;
        box-shadow: 0 28px 90px rgba(0, 0, 0, .32);
        padding: clamp(22px, 4vw, 36px);
        opacity: 0;
        transform: translateY(18px) scale(.985);
        transition:
          transform ${CONFIG.animationDuration}ms ease,
          opacity ${CONFIG.animationDuration}ms ease;
        font-family: system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      .mo-popup-visible .mo-popup-dialog {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .mo-popup-dialog *,
      .mo-popup-dialog *::before,
      .mo-popup-dialog *::after {
        box-sizing: border-box;
      }

      .mo-popup-header {
        padding-right: 35px;
        margin-bottom: 22px;
      }

      .mo-popup-eyebrow {
        display: inline-block;
        margin-bottom: 10px;
        color: #8b672f;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .16em;
        text-transform: uppercase;
      }

      .mo-popup-title {
        margin: 0 0 10px;
        color: #20342d;
        font-size: clamp(25px, 5vw, 34px);
        line-height: 1.16;
        letter-spacing: -.035em;
        overflow-wrap: anywhere;
      }

      .mo-popup-description {
        margin: 0;
        color: #58675f;
        font-size: 14px;
        line-height: 1.65;
      }

      .mo-popup-close {
        position: absolute;
        top: 15px;
        right: 15px;
        display: inline-grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border: 1px solid #d4cbbb;
        border-radius: 50%;
        background: #e9e2d6;
        color: #263a31;
        font-size: 25px;
        line-height: 1;
        cursor: pointer;
        transition: background .18s ease, transform .18s ease;
      }

      .mo-popup-close:hover {
        background: #ded3c0;
        transform: rotate(90deg);
      }

      .mo-popup-close:focus-visible,
      .mo-popup-dialog button:focus-visible,
      .mo-popup-dialog input:focus-visible,
      .mo-popup-dialog select:focus-visible,
      .mo-popup-dialog textarea:focus-visible {
        outline: 3px solid #b38a48;
        outline-offset: 3px;
      }

      .mo-popup-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .mo-popup-field {
        min-width: 0;
        margin-bottom: 15px;
      }

      .mo-popup-field-full {
        grid-column: 1 / -1;
      }

      .mo-popup-field label {
        display: block;
        margin-bottom: 7px;
        color: #344a40;
        font-size: 12px;
        font-weight: 750;
      }

      .mo-popup-field input,
      .mo-popup-field select,
      .mo-popup-field textarea {
        display: block;
        width: 100%;
        min-width: 0;
        min-height: 46px;
        padding: 12px 13px;
        border: 1px solid #d2c8b7;
        border-radius: 10px;
        background: rgba(255, 252, 245, .8);
        color: #20342d;
        font: inherit;
        font-size: 14px;
        line-height: 1.4;
        transition: border-color .18s ease, box-shadow .18s ease;
      }

      .mo-popup-field input:focus,
      .mo-popup-field select:focus,
      .mo-popup-field textarea:focus {
        border-color: #9b773c;
        box-shadow: 0 0 0 3px rgba(179, 138, 72, .14);
        outline: none;
      }

      .mo-popup-field textarea {
        min-height: 92px;
        resize: vertical;
      }

      .mo-popup-field [aria-invalid="true"] {
        border-color: #b42318;
      }

      .mo-popup-submit {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 49px;
        gap: 9px;
        padding: 13px 18px;
        border: 1px solid #c6a25e;
        border-radius: 11px;
        background: linear-gradient(115deg, #243e32, #172b23);
        color: #f7efdf;
        font: inherit;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease;
      }

      .mo-popup-submit:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(26, 49, 39, .18);
      }

      .mo-popup-submit:disabled {
        cursor: wait;
        opacity: .72;
      }

      .mo-popup-privacy {
        margin: 12px 0 0;
        color: #69756e;
        font-size: 11px;
        line-height: 1.6;
        text-align: center;
      }

      .mo-popup-status {
        margin: 0 0 14px;
        padding: 11px 12px;
        border-radius: 9px;
        font-size: 13px;
        line-height: 1.5;
      }

      .mo-popup-status:empty {
        display: none;
      }

      .mo-popup-status[data-type="success"] {
        background: #e0eee2;
        color: #205c34;
        border: 1px solid #b5d7bc;
      }

      .mo-popup-status[data-type="error"] {
        background: #f8e6e3;
        color: #8b241d;
        border: 1px solid #e7bdb8;
      }

      .mo-popup-status[data-type="info"] {
        background: #e6ece8;
        color: #304d40;
        border: 1px solid #c6d4ca;
      }

      .mo-popup-honeypot {
        position: absolute !important;
        left: -10000px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
      }

      body.mo-popup-lock {
        overflow: hidden !important;
      }

      @media (max-width: 520px) {
        .mo-popup-overlay {
          align-items: flex-end;
          padding: 0;
        }

        .mo-popup-dialog {
          width: 100%;
          max-height: 92dvh;
          padding: 25px 19px calc(22px + env(safe-area-inset-bottom));
          border-radius: 22px 22px 0 0;
          border-bottom: 0;
          transform: translateY(24px);
        }

        .mo-popup-visible .mo-popup-dialog {
          transform: translateY(0);
        }

        .mo-popup-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
        }

        .mo-popup-field-full {
          grid-column: auto;
        }

        .mo-popup-close {
          top: 12px;
          right: 12px;
        }

        .mo-popup-header {
          padding-right: 28px;
          margin-bottom: 20px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mo-popup-overlay,
        .mo-popup-dialog,
        .mo-popup-close,
        .mo-popup-submit {
          transition: none !important;
          animation: none !important;
          scroll-behavior: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPopup() {
    const overlay = document.createElement("div");
    overlay.className = "mo-popup-overlay";
    overlay.id = "mo-enquiry-popup";
    overlay.setAttribute("data-mo-popup-root", "");
    overlay.setAttribute("aria-hidden", "true");

    overlay.innerHTML = `
      <section
        class="mo-popup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mo-popup-title"
        aria-describedby="mo-popup-description"
        tabindex="-1"
      >
        <button
          type="button"
          class="mo-popup-close"
          data-mo-popup-close
          aria-label="Close enquiry form"
          title="Close"
        >&times;</button>

        <header class="mo-popup-header">
          <span class="mo-popup-eyebrow">MedOrbits · Personal Guidance</span>
          <h2 class="mo-popup-title" id="mo-popup-title">
            Let's plan your next step.
          </h2>
          <p class="mo-popup-description" id="mo-popup-description">
            Tell us what you're looking for. Our team can help you explore
            courses, admissions and career guidance options.
          </p>
        </header>

        <div class="mo-popup-status" data-mo-popup-status
             role="status" aria-live="polite"></div>

        <form data-mo-popup-form novalidate>
          <div class="mo-popup-grid">
            <div class="mo-popup-field">
              <label for="mo-popup-name">Full name *</label>
              <input
                id="mo-popup-name"
                name="name"
                type="text"
                autocomplete="name"
                maxlength="100"
                required
                placeholder="Enter your name"
              >
            </div>

            <div class="mo-popup-field">
              <label for="mo-popup-phone">Phone number *</label>
              <input
                id="mo-popup-phone"
                name="phone"
                type="tel"
                autocomplete="tel"
                inputmode="tel"
                maxlength="25"
                required
                placeholder="+91 98765 43210"
              >
            </div>

            <div class="mo-popup-field mo-popup-field-full">
              <label for="mo-popup-email">Email address *</label>
              <input
                id="mo-popup-email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                required
                placeholder="you@example.com"
              >
            </div>

            <div class="mo-popup-field mo-popup-field-full">
              <label for="mo-popup-course">Course or service of interest *</label>
              <select id="mo-popup-course" name="course" required>
                <option value="">Choose an option</option>
                <option value="MBBS">MBBS / Medical admission</option>
                <option value="BDS">BDS / Dental admission</option>
                <option value="AYUSH">BAMS / BUMS / AYUSH</option>
                <option value="Nursing">Nursing / Paramedical</option>
                <option value="Study Abroad">Study abroad</option>
                <option value="Jobs">Jobs / Recruitment</option>
                <option value="Career Guidance">Career guidance</option>
                <option value="Other">Other enquiry</option>
              </select>
            </div>

            <div class="mo-popup-field mo-popup-field-full">
              <label for="mo-popup-message">Your enquiry *</label>
              <textarea
                id="mo-popup-message"
                name="message"
                maxlength="${CONFIG.maxMessageLength}"
                required
                placeholder="Briefly tell us how we can help..."
              ></textarea>
            </div>
          </div>

          <div class="mo-popup-honeypot" aria-hidden="true">
            <label for="mo-popup-website">Leave this field empty</label>
            <input
              id="mo-popup-website"
              name="website"
              type="text"
              tabindex="-1"
              autocomplete="off"
            >
          </div>

          <button class="mo-popup-submit" type="submit" data-mo-popup-submit>
            <span data-mo-popup-submit-text>Submit enquiry</span>
            <span aria-hidden="true">→</span>
          </button>

          <p class="mo-popup-privacy">
            By submitting, you agree that MedOrbits may contact you about
            this enquiry. Please do not include passwords or sensitive
            personal documents in this form.
          </p>
        </form>
      </section>
    `;

    document.body.appendChild(overlay);

    state.overlay = overlay;
    state.dialog = overlay.querySelector(".mo-popup-dialog");
    state.form = overlay.querySelector("[data-mo-popup-form]");
    state.status = overlay.querySelector("[data-mo-popup-status]");

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });

    overlay.querySelectorAll("[data-mo-popup-close]").forEach(function (button) {
      button.addEventListener("click", close);
    });

    state.form.addEventListener("submit", handleSubmit);
    state.form.addEventListener("input", clearFieldError);
    state.form.addEventListener("change", clearFieldError);

    state.dialog.addEventListener("keydown", handleDialogKeydown);
  }

  function showStatus(message, type) {
    state.status.textContent = message || "";
    if (type) {
      state.status.dataset.type = type;
    } else {
      delete state.status.dataset.type;
    }
  }

  function clearFieldError(event) {
    const field = event.target;

    if (!field || !field.matches("input, select, textarea")) return;

    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");

    const error = field.parentElement.querySelector(
      "[data-mo-popup-field-error]"
    );

    if (error) error.remove();
  }

  function setFieldError(field, message) {
    field.setAttribute("aria-invalid", "true");

    const errorId = field.id + "-error";
    field.setAttribute("aria-describedby", errorId);

    let error = document.getElementById(errorId);

    if (!error) {
      error = document.createElement("p");
      error.id = errorId;
      error.dataset.moPopupFieldError = "";
      error.style.cssText =
        "margin:6px 0 0;color:#9b2922;font-size:12px;line-height:1.4;";
      field.insertAdjacentElement("afterend", error);
    }

    error.textContent = message;
  }

  function validateForm() {
    let firstInvalid = null;
    const fields = Array.from(
      state.form.querySelectorAll("input[required], select[required], textarea[required]")
    );

    fields.forEach(function (field) {
      clearFieldError({ target: field });

      const value = String(field.value || "").trim();
      let error = "";

      if (!value) {
        error = "This field is required.";
      } else if (field.type === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Enter a valid email address.";
        }
      } else if (field.name === "phone") {
        const digits = value.replace(/\D/g, "");
        if (
          digits.length < CONFIG.phoneMinDigits ||
          digits.length > CONFIG.phoneMaxDigits
        ) {
          error = "Enter a valid phone number.";
        }
      } else if (
        field.name === "name" &&
        value.length < 2
      ) {
        error = "Enter your full name.";
      }

      if (error) {
        setFieldError(field, error);
        if (!firstInvalid) firstInvalid = field;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }

    return true;
  }

  function setSubmitting(isSubmitting) {
    state.submitting = isSubmitting;

    const button = state.form.querySelector("[data-mo-popup-submit]");
    const text = state.form.querySelector("[data-mo-popup-submit-text]");

    if (!button || !text) return;

    button.disabled = isSubmitting;
    button.setAttribute("aria-busy", String(isSubmitting));
    text.textContent = isSubmitting ? "Submitting..." : "Submit enquiry";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state.submitting) return;

    showStatus("", "");

    if (!validateForm()) {
      showStatus("Please correct the highlighted fields.", "error");
      return;
    }

    const honeypot = state.form.querySelector('[name="website"]');
    if (honeypot && honeypot.value.trim()) {
      // Do not reveal honeypot detection to automated submissions.
      showStatus("Thank you. Your enquiry has been received.", "success");
      state.form.reset();
      return;
    }

    if (!state.endpoint) {
      showStatus(
        "The enquiry service is not configured yet. Please contact support@medorbits.in or call +91 7644987052.",
        "error"
      );
      return;
    }

    const formData = new FormData(state.form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      course: String(formData.get("course") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      source: window.location.href,
      formType: "website-enquiry"
    };

    setSubmitting(true);
    showStatus("Sending your enquiry securely...", "info");

    try {
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
      };

      const csrfToken = getCSRFToken();
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

      const response = await fetch(state.endpoint, {
        method: "POST",
        headers: headers,
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "The enquiry endpoint was not found. Please configure the correct backend URL."
            : "The enquiry could not be submitted. Please try again."
        );
      }

      let result = {};
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        result = await response.json();
      }

      showStatus(
        result.message || "Thank you. Your enquiry has been submitted successfully.",
        "success"
      );

      state.form.reset();

      state.form.querySelectorAll("[aria-invalid]").forEach(function (field) {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      });

      state.form.querySelectorAll("[data-mo-popup-field-error]").forEach(function (error) {
        error.remove();
      });

      state.form.dispatchEvent(
        new CustomEvent("medorbits:enquirysuccess", {
          bubbles: true,
          detail: { response: result }
        })
      );

      const submitButton = state.form.querySelector("[data-mo-popup-submit]");
      const submitText = state.form.querySelector("[data-mo-popup-submit-text]");

      if (submitButton && submitText) {
        submitButton.disabled = true;
        submitText.textContent = "Enquiry submitted";
      }

      window.setTimeout(function () {
        if (state.opened) close();
      }, 2200);
    } catch (error) {
      showStatus(
        error && error.message
          ? error.message
          : "Unable to submit your enquiry. Please try again or contact support@medorbits.in.",
        "error"
      );

      state.form.dispatchEvent(
        new CustomEvent("medorbits:enquiryerror", {
          bubbles: true,
          detail: { message: error && error.message ? error.message : "Submission failed" }
        })
      );
    } finally {
      setSubmitting(false);
    }
  }

  function getFocusableElements() {
    return Array.from(
      state.dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (element) {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true";
    });
  }

  function handleDialogKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusableElements();

    if (!focusable.length) {
      event.preventDefault();
      state.dialog.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (state.opened || sessionHasShown() || !state.overlay) return;

    state.opened = true;
    state.closing = false;
    state.previousFocus = document.activeElement;
    state.previousOverflow = document.body.style.overflow;

    markSessionShown();

    state.overlay.setAttribute("aria-hidden", "false");
    state.overlay.style.display = "flex";
    document.body.classList.add("mo-popup-lock");
    document.body.style.overflow = "hidden";

    // Force layout so the entrance transition starts reliably.
    void state.overlay.offsetWidth;

    state.overlay.classList.add("mo-popup-visible");

    window.setTimeout(function () {
      if (!state.opened) return;
      const nameField = state.form.querySelector('[name="name"]');
      if (nameField) nameField.focus();
      else state.dialog.focus();
    }, reducedMotion.matches ? 0 : CONFIG.animationDuration);

    state.overlay.dispatchEvent(
      new CustomEvent("medorbits:popupopen", { bubbles: true })
    );
  }

  function close() {
    if (!state.opened || state.closing) return;

    state.closing = true;
    state.opened = false;

    state.overlay.classList.remove("mo-popup-visible");
    state.overlay.setAttribute("aria-hidden", "true");

    const finishClose = function () {
      if (!state.overlay) return;

      state.overlay.style.display = "none";
      document.body.classList.remove("mo-popup-lock");
      document.body.style.overflow = state.previousOverflow;

      const target = state.previousFocus;
      if (target && typeof target.focus === "function" && target.isConnected) {
        target.focus({ preventScroll: true });
      }

      state.closing = false;

      state.overlay.dispatchEvent(
        new CustomEvent("medorbits:popupclose", { bubbles: true })
      );
    };

    if (reducedMotion.matches) {
      finishClose();
    } else {
      window.setTimeout(finishClose, CONFIG.animationDuration);
    }
  }

  function trackVisibleTime() {
    if (state.timer) window.clearInterval(state.timer);

    state.lastTick = Date.now();

    state.timer = window.setInterval(function () {
      const now = Date.now();

      if (!document.hidden && !state.opened && !state.closing) {
        // Count active visible time in bounded increments, avoiding large
        // jumps after device sleep or a throttled background tab.
        state.elapsed += Math.min(now - state.lastTick, 1000);
      }

      state.lastTick = now;

      if (
        state.elapsed >= CONFIG.delay &&
        !state.opened &&
        !state.closing
      ) {
        window.clearInterval(state.timer);
        state.timer = null;
        open();
      }
    }, 250);
  }

  function init(options) {
    if (state.initialized) return api;

    const settings = options || {};

    if (typeof settings.delay === "number" && settings.delay >= 0) {
      CONFIG.delay = settings.delay;
    }

    if (typeof settings.endpoint === "string") {
      state.endpoint = settings.endpoint.trim();
    } else {
      const script = document.currentScript ||
        document.querySelector('script[src*="assets/js/popup.js"]');

      if (script && script.dataset.enquiryEndpoint) {
        state.endpoint = script.dataset.enquiryEndpoint.trim();
      }
    }

    if (sessionHasShown()) {
      state.initialized = true;
      return api;
    }

    injectStyles();
    createPopup();
    state.initialized = true;

    document.addEventListener("visibilitychange", function () {
      state.lastTick = Date.now();
    });

    trackVisibleTime();

    return api;
  }

  function destroy() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }

    if (state.overlay) {
      state.overlay.remove();
      state.overlay = null;
    }

    document.body.classList.remove("mo-popup-lock");
    document.body.style.overflow = state.previousOverflow;

    const style = document.getElementById("mo-popup-styles");
    if (style) style.remove();

    state.dialog = null;
    state.form = null;
    state.status = null;
    state.opened = false;
    state.closing = false;
    state.initialized = false;
    state.elapsed = 0;
  }

  const api = {
    init: init,
    open: open,
    close: close,
    destroy: destroy,
    getState: function () {
      return {
        initialized: state.initialized,
        opened: state.opened,
        elapsedVisibleTime: state.elapsed,
        delay: CONFIG.delay,
        endpoint: state.endpoint
      };
    }
  };

  window.MedOrbitsPopup = api;

  function autoInit() {
    init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit();
  }
})();
