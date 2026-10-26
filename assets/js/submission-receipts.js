
// File: /assets/js/submission-receipts.js
(() => {
  "use strict";

  if (window.MedOrbitsSubmissionReceipts) return;

  const BRAND = "MedOrbits";
  const EMAIL = "support@medorbits.in";
  const PHONES = ["+91 62058 89064", "+91 76449 87052"];
  const LOGO = "/assets/images/logo/medorbits-logo.png";
  const TTL = 120000;
  const MAX_PAGE_NAME = 160;
  let pending = null;

  const nativeFetch = window.fetch.bind(window);

  function makeReference() {
    const date = new Date();
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("");

    let random;

    try {
      random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    } catch {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      random = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("").slice(0, 12);
    }

    return `MO-${day}-${random.toUpperCase()}`;
  }

  function pageName() {
    return document.title.trim() ||
      location.pathname.split("/").filter(Boolean).pop() ||
      `${BRAND} page`;
  }

  function apiUrl(input) {
    try {
      const raw = typeof input === "string" || input instanceof URL
        ? input
        : input.url;

      const url = new URL(raw, location.href);

      return url.origin === location.origin &&
        url.pathname.startsWith("/api/")
        ? url
        : null;
    } catch {
      return null;
    }
  }

  function eligibleForm(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    if (form.dataset.submissionReceipt === "off") return false;
    if (form.method.toUpperCase() !== "POST") return false;

    const url = apiUrl(form.action);

    return Boolean(url) &&
      !/\/(?:login|logout|refresh|webhook)(?:\/|$)/i.test(url.pathname);
  }

  function createReceipt(context, reference = context.reference) {
    return { ...context, reference };
  }

  function downloadText(receipt) {
    const content = [
      `${BRAND} submission receipt`,
      `Reference: ${receipt.reference}`,
      `Page: ${receipt.pageName}`,
      `Path: ${receipt.pagePath}`,
      `Submitted: ${receipt.submittedAt}`,
      "",
      EMAIL,
      PHONES.join(" | "),
      "",
      "Keep this reference for follow-up.",
      "This receipt does not guarantee an admission, payment, job, or other outcome."
    ].join("\n");

    const blob = new Blob(["\uFEFF", content, "\n"], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${receipt.reference.toLowerCase()}.txt`;
    link.hidden = true;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printPdf(receipt) {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      window.MedOrbits?.toast?.warning?.(
        "Allow pop-ups to print or save the receipt as PDF."
      );
      return;
    }

    printWindow.opener = null;

    const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

    const fields = [
      ["Reference", receipt.reference],
      ["Submitted from", receipt.pageName],
      ["Page path", receipt.pagePath],
      ["Date and time", receipt.submittedAt]
    ];

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(receipt.reference)} -- ${BRAND}</title>
<style>
@page{size:A4;margin:18mm}
*{box-sizing:border-box}
body{color:#342d2d;font:14px/1.6 Arial,sans-serif}
header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #711f36;padding-bottom:18px}
header img{width:64px;height:64px;object-fit:contain}
h1,h2{color:#711f36}
h1{font-size:24px;margin:0}
h2{font-size:20px}
.title{margin:28px 0;padding:14px;background:#f6f0e6}
dl{display:grid;grid-template-columns:130px 1fr}
dt,dd{padding:12px 8px;margin:0;border-bottom:1px solid #e2d9d1;overflow-wrap:anywhere}
dt{font-weight:bold;color:#711f36}
footer{margin-top:28px;padding-top:14px;border-top:1px solid #c9a96e;font-size:11px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<header>
<img src="${LOGO}" alt="${BRAND} logo">
<div><h1>${BRAND}</h1><p>Study · Career · Consultancy</p></div>
</header>
<div class="title"><h2>Submission receipt</h2></div>
<dl>${fields.map(([label, value]) =>
  `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`
).join("")}</dl>
<footer>
${EMAIL}<br>${PHONES.join(" · ")}
<p>This receipt records a successful response from the connected service. It does not guarantee a particular outcome.</p>
</footer>
<script>
window.addEventListener("load", () => window.print());
<\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  function showReceipt(receipt) {
    if (typeof HTMLDialogElement === "undefined") {
      window.alert(`Submission received.\nReference: ${receipt.reference}`);
      return;
    }

    const dialog = document.createElement("dialog");
    dialog.className = "submission-receipt";
    dialog.setAttribute("aria-labelledby", "submissionReceiptTitle");

    const heading = document.createElement("h2");
    heading.id = "submissionReceiptTitle";
    heading.textContent = "Submission received";

    const reference = document.createElement("p");
    reference.className = "submission-receipt__reference";
    reference.textContent = receipt.reference;

    const details = document.createElement("p");
    details.textContent = `${receipt.pageName} · ${receipt.pagePath}`;

    const date = document.createElement("p");
    date.textContent = receipt.submittedAt;

    const actions = document.createElement("div");
    actions.className = "submission-receipt__actions";

    function addButton(label, className, callback) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      button.addEventListener("click", callback);
      actions.appendChild(button);
    }

    addButton("Print / Save PDF", "btn", () => printPdf(receipt));
    addButton("Download TXT", "btn btn-outline", () => downloadText(receipt));
    addButton("Close", "submission-receipt__close", () => dialog.close());

    dialog.append(heading, reference, details, date, actions);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });

    document.body.appendChild(dialog);
    dialog.showModal();
  }

  // Capture form intent before its submission handler sends the request.
  document.addEventListener("submit", (event) => {
    const form = event.target;

    if (!eligibleForm(form)) return;

    const createdAt = Date.now();

    pending = {
      reference: makeReference(),
      pageName: pageName().slice(0, MAX_PAGE_NAME),
      pagePath: location.pathname.slice(0, 512),
      submittedAt: new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata"
      }).format(new Date()),
      createdAt,
      form
    };

    form.dataset.submissionReference = pending.reference;
    form.dataset.submissionPage = pending.pagePath;

    setTimeout(() => {
      if (pending?.createdAt === createdAt) pending = null;
    }, TTL);
  }, true);

  // Attach receipt metadata only to eligible same-origin POST API requests.
  window.fetch = async function medorbitsFetch(input, init = {}) {
    const context = pending;
    const requestMethod = input instanceof Request ? input.method : "GET";
    const method = String(init.method || requestMethod).toUpperCase();
    const url = apiUrl(input);

    if (
      !context ||
      Date.now() - context.createdAt > TTL ||
      !url ||
      method !== "POST"
    ) {
      return nativeFetch(input, init);
    }

    // Consume the context once to avoid attaching it to unrelated requests.
    pending = null;

    const headers = new Headers(
      init.headers || (input instanceof Request ? input.headers : undefined)
    );

    headers.set("X-Submission-Reference", context.reference);
    headers.set("X-Page-Name", context.pageName);
    headers.set("X-Page-Path", context.pagePath);

    const response = await nativeFetch(input, { ...init, headers });

    // Show a receipt only after a successful response.
    if (response.ok) {
      showReceipt(createReceipt(
        context,
        response.headers.get("X-Request-ID") || context.reference
      ));
    }

    return response;
  };

  window.MedOrbitsSubmissionReceipts = Object.freeze({
    makeReference,
    downloadText,
    printPdf
  });
})();
