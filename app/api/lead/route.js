
/**
 * MedOrbits -- Lead & Download Notifications
 * File: app/api/lead/route.js
 *
 * Next.js App Router
 * Runtime: Node.js
 *
 * Required environment variables:
 *   WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   ADMIN_WHATSAPP
 *   WHATSAPP_TEMPLATE_NAME
 *   WHATSAPP_GRAPH_VERSION
 *
 * Optional:
 *   WHATSAPP_TEMPLATE_LANGUAGE=en
 *   ALLOWED_ORIGINS=https://medorbits.in,https://www.medorbits.in
 *   MAX_BODY_BYTES=12000
 *   MAX_MESSAGE_LENGTH=1500
 *   TURNSTILE_SECRET_KEY
 *
 * Request:
 *   Lead:
 *   { eventType:"lead", name, phone, email?, interest?, message?,
 *     pageUrl?, consent:true, website:"", turnstileToken? }
 *
 *   Download:
 *   { eventType:"download", resource, pageUrl?,
 *     consent:true, website:"", turnstileToken? }
 *
 * WhatsApp template:
 *   DOCUMENT header + 4 BODY text parameters:
 *   {{1}} event type
 *   {{2}} name or resource
 *   {{3}} phone/email or "Not provided"
 *   {{4}} interest/details/page
 *
 * This endpoint does not persist submissions.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DEFAULT = 12_000;
const MAX_HARD_LIMIT = 30_000;
const MAX_PDF_BYTES = 2_000_000;
const MAX_TIMEOUT_MS = 12_000;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(body, status = 200, origin = "") {
  const headers = new Headers(JSON_HEADERS);

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value, max = 500) {
  if (typeof value !== "string") return "";

  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeOrigin(value) {
  try {
    const parsed = new URL(value);

    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.origin === "null"
    ) {
      return "";
    }

    return parsed.origin;
  } catch {
    return "";
  }
}

function getAllowedOrigins(env, requestUrl) {
  const configured = clean(env.ALLOWED_ORIGINS || "", 2000);

  const entries = configured
    ? configured.split(",").map((value) => value.trim()).filter(Boolean)
    : [requestUrl.origin];

  return new Set(entries.map(normalizeOrigin).filter(Boolean));
}

function validEmail(value) {
  return !value || (
    value.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
  );
}

function validPhone(value) {
  if (!value || value.length > 25) return false;

  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function validRecipient(value) {
  const digits = clean(value, 20).replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function validatePageUrl(value, requestUrl, allowedOrigins) {
  if (!value) return requestUrl.origin;

  try {
    const parsed = new URL(value);

    if (
      !["https:", "http:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      !allowedOrigins.has(parsed.origin)
    ) {
      return "";
    }

    parsed.hash = "";
    return parsed.href.slice(0, 500);
  } catch {
    return "";
  }
}

function escapePdfText(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value, maxChars = 84) {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const originalWord of words) {
    // Split unusually long words instead of overflowing the page.
    const pieces = [];

    for (let i = 0; i < originalWord.length; i += maxChars) {
      pieces.push(originalWord.slice(i, i + maxChars));
    }

    for (const word of pieces) {
      if (!line) {
        line = word;
      } else if ((line + " " + word).length <= maxChars) {
        line += " " + word;
      } else {
        lines.push(line);
        line = word;
      }
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function createLeadPdf(record) {
  const lines = [
    "MEDORBITS - WEBSITE NOTIFICATION",
    "--------------------------------",
    "",
    `Event: ${record.eventType === "download" ? "Resource download" : "Website enquiry"}`,
    `Received (UTC): ${record.receivedAt}`,
    `Reference: ${record.reference}`,
    `Name: ${record.name || "Not collected"}`,
    `Phone: ${record.phone || "Not collected"}`,
    `Email: ${record.email || "Not provided"}`,
    `Interest: ${record.interest || "Not provided"}`,
    `Resource: ${record.resource || "Not applicable"}`,
    `Page: ${record.pageUrl || "Not provided"}`,
    "",
    "Message / details:",
    ...wrapText(record.message || "No additional message provided."),
    "",
    "Privacy note: Use this contact information only for the stated enquiry.",
  ];

  const maxLinesPerPage = 48;
  const pageLines = [];

  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pageLines.push(lines.slice(i, i + maxLinesPerPage));
  }

  const objects = [];
  const addObject = (value) => {
    objects.push(value);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  );

  const pageIds = [];

  for (const currentLines of pageLines) {
    const commands = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
    ];

    currentLines.forEach((line, index) => {
      if (pageIds.length === 0 && index === 0) {
        commands.push("/F1 15 Tf");
      } else if (pageIds.length === 0 && index === 1) {
        commands.push("/F1 10 Tf");
      }

      commands.push(`(${escapePdfText(line)}) Tj`);
      commands.push("T*");
    });

    commands.push("ET");

    const stream = commands.join("\n");
    const streamLength = new TextEncoder().encode(stream).length;

    const streamId = addObject(
      `<< /Length ${streamLength} >>\nstream\n${stream}\nendstream`,
    );

    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R ` +
      `/MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> ` +
      `/Contents ${streamId} 0 R >>`,
    );

    pageIds.push(pageId);
  }

  objects[catalogId - 1] =
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] ` +
    `/Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  const encoder = new TextEncoder();

  for (let i = 0; i < objects.length; i++) {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = encoder.encode(pdf).length;

  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  const bytes = encoder.encode(pdf);

  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error("pdf_too_large");
  }

  return bytes;
}

async function fetchWithTimeout(url, options, timeoutMs = MAX_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("provider_timeout");
    }

    throw new Error("provider_network_error");
  } finally {
    clearTimeout(timer);
  }
}

async function providerJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function validateConfiguration(env) {
  const required = [
    env.WHATSAPP_ACCESS_TOKEN,
    env.WHATSAPP_PHONE_NUMBER_ID,
    env.ADMIN_WHATSAPP,
    env.WHATSAPP_TEMPLATE_NAME,
    env.WHATSAPP_GRAPH_VERSION,
  ];

  if (required.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("notification_service_not_configured");
  }

  const graphVersion = clean(env.WHATSAPP_GRAPH_VERSION, 20);
  const phoneNumberId = clean(env.WHATSAPP_PHONE_NUMBER_ID, 100);
  const templateName = clean(env.WHATSAPP_TEMPLATE_NAME, 100);
  const templateLanguage = clean(env.WHATSAPP_TEMPLATE_LANGUAGE || "en", 20);

  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error("invalid_graph_api_version");
  }

  if (!/^\d{5,30}$/.test(phoneNumberId)) {
    throw new Error("invalid_phone_number_id");
  }

  if (!/^[a-zA-Z0-9_]{1,100}$/.test(templateName)) {
    throw new Error("invalid_template_name");
  }

  if (!/^[a-zA-Z0-9_-]{2,20}$/.test(templateLanguage)) {
    throw new Error("invalid_template_language");
  }

  if (!validRecipient(env.ADMIN_WHATSAPP)) {
    throw new Error("invalid_admin_whatsapp");
  }

  return {
    graphVersion,
    phoneNumberId,
    templateName,
    templateLanguage,
  };
}

async function verifyTurnstile({ token, request, env }) {
  if (!env.TURNSTILE_SECRET_KEY) return;

  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    throw new Error("turnstile_required");
  }

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);

  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  // Use Cloudflare's connecting-IP header only when deployed behind Cloudflare.
  const cfIp = request.headers.get("cf-connecting-ip");
  const ip = cfIp || remoteIp;

  if (ip) form.append("remoteip", ip);

  const response = await fetchWithTimeout(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );

  const result = await providerJson(response);

  if (!response.ok || result.success !== true) {
    throw new Error("turnstile_verification_failed");
  }
}

async function uploadPdf({ bytes, env, config }) {
  const form = new FormData();

  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "medorbits-notification.pdf",
  );

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: form,
    },
  );

  const result = await providerJson(response);

  if (!response.ok || typeof result.id !== "string" || !result.id) {
    console.error(
      "WhatsApp media upload failed",
      response.status,
      result?.error?.code || "unknown",
    );

    throw new Error("whatsapp_media_upload_failed");
  }

  return result.id;
}

async function sendDocumentTemplate({ env, config, mediaId, record }) {
  const recipient = clean(env.ADMIN_WHATSAPP, 20).replace(/\D/g, "");

  const subject = record.eventType === "download"
    ? record.resource || "Resource download"
    : record.name || "Website enquiry";

  const contact = record.eventType === "download"
    ? "Not collected"
    : [record.phone, record.email].filter(Boolean).join(" / ") || "Not provided";

  const details = record.eventType === "download"
    ? record.pageUrl
    : [record.interest, record.message, record.pageUrl]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 900);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: config.templateLanguage },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                id: mediaId,
                filename:
                  `MedOrbits-${record.eventType}-${record.receivedAt.slice(0, 10)}.pdf`,
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: clean(record.kind, 100) || "Website event" },
            { type: "text", text: clean(subject, 100) || "Not provided" },
            { type: "text", text: clean(contact, 150) || "Not provided" },
            { type: "text", text: clean(details, 900) || "Not provided" },
          ],
        },
      ],
    },
  };

  const response = await fetchWithTimeout(
    `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await providerJson(response);
  const messageId = result?.messages?.[0]?.id;

  if (!response.ok || typeof messageId !== "string" || !messageId) {
    console.error(
      "WhatsApp document send failed",
      response.status,
      result?.error?.code || "unknown",
    );

    throw new Error("whatsapp_document_send_failed");
  }

  return messageId;
}

function publicError(error) {
  const allowed = new Set([
    "notification_service_not_configured",
    "invalid_graph_api_version",
    "invalid_phone_number_id",
    "invalid_template_name",
    "invalid_template_language",
    "invalid_admin_whatsapp",
    "whatsapp_media_upload_failed",
    "whatsapp_document_send_failed",
    "provider_timeout",
    "provider_network_error",
    "pdf_too_large",
  ]);

  return allowed.has(error) ? error : "notification_failed";
}

export async function OPTIONS(request) {
  const requestUrl = new URL(request.url);
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        Allow: "POST, OPTIONS",
      },
    });
  }

  const origin = normalizeOrigin(originHeader);
  const allowedOrigins = getAllowedOrigins(process.env, requestUrl);

  if (!origin || !allowedOrigins.has(origin)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403);
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
      "Cache-Control": "no-store",
      Vary: "Origin",
    },
  });
}

export async function POST(request) {
  const requestUrl = new URL(request.url);
  const originHeader = request.headers.get("origin");
  let responseOrigin = "";

  const allowedOrigins = getAllowedOrigins(process.env, requestUrl);

  if (originHeader) {
    const origin = normalizeOrigin(originHeader);

    if (!origin || !allowedOrigins.has(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403);
    }

    responseOrigin = origin;
  }

  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (!contentType.includes("application/json")) {
    return json({ ok: false, error: "json_required" }, 415, responseOrigin);
  }

  const configuredMax = Number(process.env.MAX_BODY_BYTES);
  const maxBytes =
    Number.isFinite(configuredMax) && configuredMax > 0
      ? Math.max(1000, Math.min(configuredMax, MAX_HARD_LIMIT))
      : MAX_DEFAULT;

  let input;

  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);

    if (declaredLength > maxBytes) {
      return json({ ok: false, error: "payload_too_large" }, 413, responseOrigin);
    }

    const raw = await request.text();

    if (new TextEncoder().encode(raw).byteLength > maxBytes) {
      return json({ ok: false, error: "payload_too_large" }, 413, responseOrigin);
    }

    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, responseOrigin);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ ok: false, error: "invalid_payload" }, 400, responseOrigin);
  }

  // Honeypot: generic success response for automated form submissions.
  if (clean(input.website, 200)) {
    return json({ ok: true, accepted: true }, 202, responseOrigin);
  }

  if (!["lead", "download"].includes(input.eventType)) {
    return json({ ok: false, error: "invalid_event_type" }, 400, responseOrigin);
  }

  if (input.consent !== true) {
    return json({ ok: false, error: "consent_required" }, 400, responseOrigin);
  }

  const eventType = input.eventType;
  const name = clean(input.name, 100);
  const phone = clean(input.phone, 25);
  const email = clean(input.email, 150);
  const interest = clean(input.interest, 100);
  const resource = clean(input.resource, 250);

  const configuredMessageLength = Number(process.env.MAX_MESSAGE_LENGTH);
  const maxMessageLength =
    Number.isFinite(configuredMessageLength) && configuredMessageLength > 0
      ? Math.min(configuredMessageLength, 3000)
      : 1500;

  const message = clean(input.message, maxMessageLength);
  const pageUrl = validatePageUrl(
    clean(input.pageUrl, 1000),
    requestUrl,
    allowedOrigins,
  );

  if (!pageUrl) {
    return json({ ok: false, error: "invalid_page_url" }, 400, responseOrigin);
  }

  if (email && !validEmail(email)) {
    return json({ ok: false, error: "invalid_email" }, 400, responseOrigin);
  }

  if (eventType === "lead") {
    if (name.length < 2) {
      return json({ ok: false, error: "valid_name_required" }, 400, responseOrigin);
    }

    if (!validPhone(phone)) {
      return json({ ok: false, error: "valid_phone_required" }, 400, responseOrigin);
    }
  } else if (!resource) {
    return json({ ok: false, error: "resource_required" }, 400, responseOrigin);
  }

  let config;

  try {
    config = validateConfiguration(process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    console.error("MedOrbits configuration error", publicError(reason));

    return json(
      { ok: false, error: publicError(reason) },
      503,
      responseOrigin,
    );
  }

  try {
    await verifyTurnstile({
      token: input.turnstileToken,
      request,
      env: process.env,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    const failure = reason === "turnstile_required" ||
      reason === "turnstile_verification_failed"
      ? reason
      : "request_verification_failed";

    console.warn("MedOrbits request verification rejected", failure);

    return json({ ok: false, error: failure }, 403, responseOrigin);
  }

  const record = {
    eventType,
    kind: clean(
      input.kind ||
        (eventType === "download" ? "Resource download" : "Website enquiry"),
      100,
    ),
    name,
    phone,
    email,
    interest,
    message,
    resource,
    pageUrl,
    receivedAt: new Date().toISOString(),
    reference: crypto.randomUUID(),
  };

  try {
    const pdfBytes = createLeadPdf(record);
    const mediaId = await uploadPdf({ bytes: pdfBytes, env: process.env, config });
    const messageId = await sendDocumentTemplate({
      env: process.env,
      config,
      mediaId,
      record,
    });

    return json(
      {
        ok: true,
        accepted: true,
        whatsappAcceptedByMeta: true,
        eventType,
        reference: messageId,
        note: "Meta accepted the message; handset delivery is not confirmed.",
      },
      202,
      responseOrigin,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "notification_failed";
    const failure = publicError(reason);

    console.error("MedOrbits notification failed", failure);

    return json(
      {
        ok: false,
        accepted: false,
        error: failure,
      },
      502,
      responseOrigin,
    );
  }
}
