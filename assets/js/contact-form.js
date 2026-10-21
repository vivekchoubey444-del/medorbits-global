
/**
 * MedOrbits -- Contact Form Manager
 * File: /assets/js/contact-form.js
 * Version: 1.2.0
 *
 * Supports:
 * - Contact form validation and JSON submission
 * - WhatsApp and email enquiry actions
 * - Downloadable enquiry text
 * - Printable, branded enquiry summary
 * - Accessible status messages and request timeout
 *
 * Security:
 * - Never place secrets in frontend code.
 * - The server must validate and rate-limit submissions.
 * - Client-side validation does not replace server-side validation.
 */

(function (window, document) {
  "use strict";

  var form = document.getElementById("contactForm");

  if (!form || form.dataset.contactFormInitialized === "true") {
    return;
  }

  form.dataset.contactFormInitialized = "true";

  var status = document.getElementById("formStatus");
  var submitButton = form.querySelector('[type="submit"]');

  var SUPPORT_EMAIL = "support@medorbits.in";
  var DEFAULT_WHATSAPP = "916205889064";
  var REQUEST_TIMEOUT_MS = 20000;

  var email = form.dataset.email || SUPPORT_EMAIL;
  var whatsapp = normalizePhone(
    form.dataset.whatsapp || DEFAULT_WHATSAPP
  );

  var labels = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    enquiryType: "Enquiry topic",
    subject: "Subject",
    message: "Message"
  };

  var submitting = false;
  var activeController = null;

  // --------------------------------------------------
  // Utilities
  // --------------------------------------------------

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getField(name) {
    return form.elements.namedItem(name);
  }

  function getDetails() {
    var data = {};

    Object.keys(labels).forEach(function (key) {
      var field = getField(key);

      if (!field) return;

      if (
        typeof RadioNodeList !== "undefined" &&
        field instanceof RadioNodeList
      ) {
        data[key] = String(field.value || "").trim();
      } else {
        data[key] = String(field.value || "").trim();
      }
    });

    return data;
  }

  function getMessage(details) {
    return Object.keys(labels)
      .filter(function (key) {
        return String(details[key] || "").trim() !== "";
      })
      .map(function (key) {
        return labels[key] + ": " + String(details[key]).trim();
      })
      .join("\n");
  }

  function setStatus(message, isError) {
    if (!status) return;

    status.textContent = String(message || "");
    status.style.display = "block";
    status.setAttribute("role", isError ? "alert" : "status");
    status.setAttribute("aria-live", isError ? "assertive" : "polite");
  }

  function clearStatus() {
    if (!status) return;

    status.textContent = "";
    status.style.display = "none";
    status.removeAttribute("role");
  }

  function setSubmitting(value) {
    submitting = value;

    if (submitButton) {
      submitButton.disabled = value;

      if (value) {
        submitButton.dataset.originalText =
          submitButton.dataset.originalText ||
          submitButton.textContent ||
          "Submit Enquiry Online";

        submitButton.textContent = "Sending…";
        submitButton.setAttribute("aria-busy", "true");
      } else {
        submitButton.textContent =
          submitButton.dataset.originalText ||
          "Submit Enquiry Online";

        submitButton.removeAttribute("aria-busy");
      }
    }

    form.setAttribute("aria-busy", value ? "true" : "false");
  }

  function isValidEmail(value) {
    if (!value) return true;

    if (value.length > 254) return false;

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function isValidPhone(value) {
    if (!value) return true;

    if (!/^[+()\d\s.-]+$/.test(value)) {
      return false;
    }

    var digits = normalizePhone(value);

    return digits.length >= 7 && digits.length <= 15;
  }

  function validateContactMethod() {
    var emailField = getField("email");
    var phoneField = getField("phone");

    var emailValue = emailField
      ? String(emailField.value || "").trim()
      : "";

    var phoneValue = phoneField
      ? String(phoneField.value || "").trim()
      : "";

    if (emailField && typeof emailField.setCustomValidity === "function") {
      emailField.setCustomValidity("");
    }

    if (phoneField && typeof phoneField.setCustomValidity === "function") {
      phoneField.setCustomValidity("");
    }

    if (!emailValue && !phoneValue) {
      var message = "Enter an email address or a phone number.";

      if (emailField) emailField.setCustomValidity(message);
      if (phoneField) phoneField.setCustomValidity(message);

      if (emailField) {
        emailField.reportValidity();
      } else if (phoneField) {
        phoneField.reportValidity();
      }

      return false;
    }

    if (emailValue && !isValidEmail(emailValue)) {
      if (emailField) {
        emailField.setCustomValidity("Enter a valid email address.");
        emailField.reportValidity();
      }

      return false;
    }

    if (phoneValue && !isValidPhone(phoneValue)) {
      if (phoneField) {
        phoneField.setCustomValidity("Enter a valid phone number.");
        phoneField.reportValidity();
      }

      return false;
    }

    return true;
  }

  function validateForm() {
    if (!validateContactMethod()) return false;

    return form.reportValidity();
  }

  function isMobile() {
    return (
      window.matchMedia("(max-width: 760px)").matches ||
      /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)
    );
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      var entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entities[character];
    });
  }

  function safeEmailAddress(value) {
    var address = String(value || "").trim();

    if (
      address.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
    ) {
      return SUPPORT_EMAIL;
    }

    return address;
  }

  function safeWhatsAppNumber(value) {
    var number = normalizePhone(value);

    if (number.length < 7 || number.length > 15) {
      return DEFAULT_WHATSAPP;
    }

    return number;
  }

  function makeContactFooter() {
    return [
      "",
      "MedOrbits",
      "support@medorbits.in",
      "+91 62058 89064 | +91 76449 87052"
    ].join("\n");
  }

  // --------------------------------------------------
  // Download enquiry
  // --------------------------------------------------

  function downloadText(message) {
    var content =
      "\uFEFF" +
      message +
      "\n\n" +
      "MedOrbits\n" +
      "support@medorbits.in\n" +
      "+91 62058 89064 | +91 76449 87052\n";

    var blob = new Blob([content], {
      type: "text/plain;charset=utf-8"
    });

    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = "medorbits-enquiry.txt";
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // --------------------------------------------------
  // Printable branded enquiry summary
  // --------------------------------------------------

  function openPrintView(details) {
    var printWindow = window.open("", "_blank");

    if (!printWindow) {
      setStatus(
        "Allow pop-ups to open the printable enquiry summary.",
        true
      );
      return false;
    }

    // Prevent the new document from controlling the original window.
    try {
      printWindow.opener = null;
    } catch (error) {
      // Continue with the printable document.
    }

    var rows = Object.keys(labels)
      .filter(function (key) {
        return String(details[key] || "").trim() !== "";
      })
      .map(function (key) {
        return (
          "<section>" +
          "<h2>" + escapeHtml(labels[key]) + "</h2>" +
          "<p>" +
          escapeHtml(details[key]).replace(/\r?\n/g, "<br>") +
          "</p>" +
          "</section>"
        );
      })
      .join("");

    var preparedAt = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata"
    });

    var html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MedOrbits Enquiry Summary</title>
<style>
@page{size:A4;margin:18mm}
*{box-sizing:border-box}
body{margin:0;color:#24202a;font:14px/1.65 Arial,sans-serif}
.brand{display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:3px solid #8a2438}
.brand img{width:68px;height:68px;object-fit:contain}
.brand h1{margin:0;color:#6f1d31;font:700 25px Georgia,serif}
.brand p{margin:4px 0 0;color:#77666a;font-size:11px}
.document-title{margin:28px 0 16px;padding:14px 18px;background:#f7f1e8;border-left:4px solid #c9a96e}
.document-title h2{margin:0;color:#6f1d31;font:700 20px Georgia,serif}
.document-title p{margin:4px 0 0;color:#6b6261;font-size:11px}
section{padding:13px 0;border-bottom:1px solid #e5ded7;break-inside:avoid}
section h2{margin:0 0 4px;color:#6f1d31;font-size:12px}
section p{margin:0;white-space:normal;overflow-wrap:anywhere}
.contact{margin-top:30px;padding-top:14px;border-top:1px solid #d8c9b0;color:#5d5150;font-size:11px}
.disclaimer{margin-top:18px;color:#77666a;font-size:10px}
.print-button{margin-top:20px;padding:10px 16px;border:0;border-radius:6px;background:#6f1d31;color:#fff;cursor:pointer}
@media print{
  .print-button{display:none}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
</style>
</head>
<body>
<header class="brand">
  <img src="/assets/images/logo/medorbits-logo.png" alt="MedOrbits logo">
  <div>
    <h1>MedOrbits</h1>
    <p>Study · Career · Consultancy</p>
  </div>
</header>
<div class="document-title">
  <h2>Enquiry Summary</h2>
  <p>Prepared ${escapeHtml(preparedAt)} (India Standard Time)</p>
</div>
${rows}
<footer class="contact">
  support@medorbits.in<br>
  +91 62058 89064 · +91 76449 87052<br>
  WhatsApp: wa.me/916205889064 · wa.me/917644987052
  <p class="disclaimer">
    This document contains information submitted by the enquirer.
    It is not confirmation of admission, employment, or any service outcome.
  </p>
</footer>
<button class="print-button" type="button" onclick="window.print()">Print or save as PDF</button>
</body>
</html>`;

    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return true;
    } catch (error) {
      try {
        printWindow.close();
      } catch (closeError) {
        // Ignore window cleanup failures.
      }

      setStatus("The printable enquiry summary could not be opened.", true);
      return false;
    }
  }

  // --------------------------------------------------
  // Submission
  // --------------------------------------------------

  function getSubmissionURL() {
    var action = String(form.getAttribute("action") || "").trim();

    if (!action) {
      throw new Error("The contact form submission endpoint is not configured.");
    }

    var url;

    try {
      url = new URL(action, window.location.href);
    } catch (error) {
      throw new Error("The contact form endpoint is invalid.");
    }

    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && window.location.hostname === "localhost")
    ) {
      throw new Error("The contact form endpoint must use HTTPS.");
    }

    if (url.origin !== window.location.origin) {
      throw new Error("The contact form endpoint must be on this website.");
    }

    return url.href;
  }

  async function submitForm(event) {
    event.preventDefault();

    if (submitting || !validateForm()) return;

    var body = getDetails();
    var submitURL;

    try {
      submitURL = getSubmissionURL();
    } catch (error) {
      setStatus(error.message, true);
      return;
    }

    setSubmitting(true);
    setStatus("Sending your enquiry…", false);

    var controller =
      typeof window.AbortController === "function"
        ? new window.AbortController()
        : null;

    activeController = controller;

    var timeoutId = null;

    if (controller) {
      timeoutId = window.setTimeout(function () {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    try {
      var options = {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(body)
      };

      if (controller) {
        options.signal = controller.signal;
      }

      var response = await fetch(submitURL, options);
      var payload = await response.json().catch(function () {
        return {};
      });

      if (!response.ok) {
        var serverMessage =
          payload &&
          payload.error &&
          typeof payload.error.message === "string"
            ? payload.error.message
            : payload && typeof payload.message === "string"
              ? payload.message
              : "";

        throw new Error(
          serverMessage || "The enquiry could not be submitted."
        );
      }

      setStatus(
        "Thank you. Your enquiry has been submitted successfully.",
        false
      );

      form.reset();

      // Clear custom validity after resetting.
      form.querySelectorAll('[name="email"], [name="phone"]').forEach(
        function (field) {
          field.setCustomValidity("");
        }
      );

      document.dispatchEvent(
        new CustomEvent("medorbits:contact-submitted", {
          detail: {
            success: true
          }
        })
      );
    } catch (error) {
      if (error && error.name === "AbortError") {
        setStatus(
          "The request timed out or was cancelled. Please try again, or contact us by WhatsApp or email.",
          true
        );
      } else {
        setStatus(
          error && error.message
            ? error.message
            : "The enquiry could not be submitted. Please try WhatsApp or email instead.",
          true
        );
      }
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (activeController === controller) {
        activeController = null;
      }

      setSubmitting(false);
    }
  }

  // --------------------------------------------------
  // Alternative contact actions
  // --------------------------------------------------

  function handleContactAction(button) {
    if (!validateForm()) return;

    var details = getDetails();
    var message = getMessage(details);
    var action = button.getAttribute("data-contact-action");

    if (!message) {
      setStatus("Enter your enquiry details before continuing.", true);
      return;
    }

    if (action === "download") {
      if (isMobile()) {
        downloadText(message + makeContactFooter());
        setStatus("Your enquiry text file has been downloaded.", false);
      } else {
        openPrintView(details);
      }

      return;
    }

    if (action === "whatsapp") {
      var number = safeWhatsAppNumber(
        button.getAttribute("data-number") || whatsapp
      );

      var whatsappURL =
        "https://wa.me/" +
        number +
        "?text=" +
        encodeURIComponent(message);

      // Use a direct URL navigation so popup blockers are less likely
      // to block the user-initiated action.
      var opened = window.open(
        whatsappURL,
        "_blank",
        "noopener,noreferrer"
      );

      if (!opened && !isMobile()) {
        setStatus(
          "WhatsApp could not be opened. Allow pop-ups or use the email option.",
          true
        );
      } else {
        setStatus("Opening WhatsApp with your enquiry details.", false);
      }

      return;
    }

    if (action === "email") {
      var recipient = safeEmailAddress(email);

      var subject =
        "MedOrbits enquiry: " +
        String(details.enquiryType || "General").slice(0, 80);

      var mailto =
        "mailto:" +
        recipient +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(message + makeContactFooter());

      window.location.href = mailto;

      setStatus("Opening your email application.", false);
    }
  }

  // --------------------------------------------------
  // Event listeners
  // --------------------------------------------------

  form.querySelectorAll('[name="email"], [name="phone"]').forEach(
    function (field) {
      field.addEventListener("input", function () {
        field.setCustomValidity("");

        var otherName = field.name === "email" ? "phone" : "email";
        var otherField = getField(otherName);

        if (otherField) {
          otherField.setCustomValidity("");
        }
      });
    }
  );

  form.addEventListener("submit", submitForm);

  form.querySelectorAll("[data-contact-action]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();

      if (submitting) return;

      handleContactAction(button);
    });
  });

  // Clear status when the user begins editing again.
  form.addEventListener("input", function () {
    if (status && status.textContent) {
      clearStatus();
    }
  });

  // --------------------------------------------------
  // Public interface and cleanup
  // --------------------------------------------------

  window.MedOrbitsContactForm = Object.freeze({
    validate: validateForm,
    getDetails: getDetails,
    getMessage: getMessage,

    reset: function () {
      if (activeController) {
        activeController.abort();
      }

      form.reset();

      form.querySelectorAll('[name="email"], [name="phone"]').forEach(
        function (field) {
          field.setCustomValidity("");
        }
      );

      clearStatus();
    }
  });
})(window, document);
