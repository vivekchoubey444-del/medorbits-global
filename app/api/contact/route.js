
/**
 * MedOrbits -- Contact API
 * File: app/api/contact/route.js
 *
 * Runtime: Next.js App Router / Node.js
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
 *   TURNSTILE_SECRET_KEY
 *
 * Request:
 * {
 *   "name": "Example Applicant",
 *   "email": "applicant@example.com",
 *   "phone": "9876543210",
 *   "subject": "Admission enquiry",
 *   "message": "Please contact me about admissions.",
 *   "consent": true,
 *   "website": "",
 *   "pageUrl": "https://medorbits.in/contact.html",
 *   "turnstileToken": ""
 * }
 *
 * This endpoint does not persist submissions.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_DEFAULT = 12_000;
const MAX_BODY_LIMIT = 30_000;
const MAX_PDF_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 12_000;

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
    const url = new URL(value);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.origin === "null"
    ) {
      return "";
    }

    return url.origin;
  } catch {
    return "";
  }
}

function allowedOrigins(env, requestUrl) {
  const configured = clean(env.ALLOWED_ORIGINS || "", 2000);
  const values = configured
    ? configured.split(",").map((item) => item.trim()).filter(Boolean)
    : [requestUrl.origin];

  return new Set(values.map(normalizeOrigin).filter(Boolean));
}

function validEmail(value) {
  return (
    typeof value === "string" &&
    value.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
  );
}

function validPhone(value) {
  if (!value || value.length > 25) return false;

  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function validPageUrl(value, requestUrl, origins) {
  if (!value) return requestUrl.origin;

  try {
    const url = new URL(value);

    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      !origins.has(url.origin)
    ) {
      return "";
    }

    url.hash = "";
    return url.href.slice(0, 500);
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
  const lines = [];
  let line = "";

  for (const word of String(value || "").split(/\s+/).filter(Boolean)) {
    for (let i = 0; i < word.length; i += maxChars) {
      const part = word.slice(i, i + maxChars);

      if (!line) {
        line = part;
      } else if ((line + " " + part).length <= maxChars) {
        line += " " + part;
      } else {
        lines.push(line);
        line = part;
      }
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function createContactPdf(record) {
  const lines = [
    "MEDORBITS - CONTACT ENQUIRY",
    "---------------------------",
    "",
    `Reference: ${record.reference}`,
    `Received (UTC): ${record.receivedAt}`,
    `Name: ${record.name}`,
    `Email: ${record.email}`,
    `Phone: ${record.phone || "Not provided"}`,
    `Subject: ${record.subject}`,
    `Page: ${record.pageUrl}`,
    "",
    "Message:",
    ...wrapText(record.message),
    "",
    "Privacy note: Use this information only to respond to this enquiry.",
  ];

  const pageSize = 48;
  const pageLines = [];

  for (let i = 0; i < lines.length; i += pageSize) {
    pageLines.push(lines.slice(i, i + pageSize));
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
  const encoder = new TextEncoder();

  for (const currentLines of pageLines) {
    const commands = ["BT", "/F1 10 Tf", "50 790 Td", "14 TL"];

    currentLines.forEach((line, index) => {
      if (pageIds.length === 0 && index === 0) {
        commands.push("/F1 15 Tf");
      } else if (pageIds.length === 0 && index === 1) {
        commands.push("/F1 10 Tf");
      }

      commands.push(`(${escapePdfText(line)}) Tj`, "T*");
    });

    commands.push("ET");

    const stream = commands.join("\n");
    const streamId = addObject(
      `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`,
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

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
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

function getConfiguration(env) {
  const required = [
    env.WHATSAPP_ACCESS_TOKEN,
    env.WHATSAPP_PHONE_NUMBER_ID,
    env.ADMIN_WHATSAPP,
    env.WHATSAPP_TEMPLATE_NAME,
    env.WHATSAPP_GRAPH_VERSION,
  ];

  if (required.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("notification_service_not_configured");
  }

  const graphVersion = clean(env.WHATSAPP_GRAPH_VERSION, 20);
  const phoneNumberId = clean(env.WHATSAPP_PHONE_NUMBER_ID, 100);
  const templateName = clean(env.WHATSAPP_TEMPLATE_NAME, 100);
  const templateLanguage = clean(env.WHATSAPP_TEMPLATE_LANGUAGE || "en", 20);
  const recipient = clean(env.ADMIN_WHATSAPP, 20).replace(/\D/g, "");

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

  if (recipient.length < 7 || recipient.length > 15) {
    throw new Error("invalid_admin_whatsapp");
  }

  return {
    graphVersion,
    phoneNumberId,
    templateName,
    templateLanguage,
    recipient,
  };
}

async function verifyTurnstile(token, request, env) {
  if (!env.TURNSTILE_SECRET_KEY) return;

  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    throw new Error("turnstile_required");
  }

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);

  const ip = request.headers.get("cf-connecting-ip");
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

async function uploadPdf(bytes, env, config) {
  const form = new FormData();

  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "medorbits-contact-enquiry.pdf",
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
      "Contact PDF upload failed",
      response.status,
      result?.error?.code || "unknown",
    );

    throw new Error("whatsapp_media_upload_failed");
  }

  return result.id;
}

async function sendContactTemplate(record, mediaId, env, config) {
  const details = [
    record.subject,
    record.message,
    record.pageUrl,
  ].filter(Boolean).join(" | ").slice(0, 900);

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: config.recipient,
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
                  `MedOrbits-contact-${record.receivedAt.slice(0, 10)}.pdf`,
              },
            },
          ],
        },
        {
          type: "body",
          parameters: [
            { type: "text", text: "Contact enquiry" },
            { type: "text", text: record.name.slice(0, 100) },
            {
              type: "text",
              text: [record.phone, record.email].filter(Boolean)
                .join(" / ").slice(0, 150) || "Not provided",
            },
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
      "Contact WhatsApp send failed",
      response.status,
      result?.error?.code || "unknown",
    );

    throw new Error("whatsapp_document_send_failed");
  }

  return messageId;
}

function publicError(reason) {
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

  return allowed.has(reason) ? reason : "notification_failed";
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
  const origins = allowedOrigins(process.env, requestUrl);

  if (!origin || !origins.has(origin)) {
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

  const origins = allowedOrigins(process.env, requestUrl);

  if (originHeader) {
    const origin = normalizeOrigin(originHeader);

    if (!origin || !origins.has(origin)) {
      return json({ ok: false, error: "origin_not_allowed" }, 403);
    }

    responseOrigin = origin;
  }

  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  ) {
    return json({ ok: false, error: "json_required" }, 415, responseOrigin);
  }

  const configuredLimit = Number(process.env.MAX_BODY_BYTES);
  const maxBytes = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.max(1000, Math.min(configuredLimit, MAX_BODY_LIMIT))
    : MAX_BODY_DEFAULT;

  const declaredLength = Number(request.headers.get("content-length") || 0);

  if (declaredLength > maxBytes) {
    return json({ ok: false, error: "payload_too_large" }, 413, responseOrigin);
  }

  let input;

  try {
    const raw = await request.text();

    if (new TextEncoder().encode(raw).length > maxBytes) {
      return json({ ok: false, error: "payload_too_large" }, 413, responseOrigin);
    }

    input = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, responseOrigin);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ ok: false, error: "invalid_payload" }, 400, responseOrigin);
  }

  // Generic response for likely bot submissions.
  if (clean(input.website, 200)) {
    return json({ ok: true, accepted: true }, 202, responseOrigin);
  }

  if (input.consent !== true) {
    return json({ ok: false, error: "consent_required" }, 400, responseOrigin);
  }

  const name = clean(input.name, 100);
  const email = clean(input.email, 150);
  const phone = clean(input.phone, 25);
  const subject = clean(input.subject, 150);
  const message = clean(input.message, 3000);
  const pageUrl = validPageUrl(
    clean(input.pageUrl, 1000),
    requestUrl,
    origins,
  );

  if (name.length < 2) {
    return json({ ok: false, error: "valid_name_required" }, 400, responseOrigin);
  }

  if (!validEmail(email)) {
    return json({ ok: false, error: "invalid_email" }, 400, responseOrigin);
  }

  if (!email && !validPhone(phone)) {
    return json(
      { ok: false, error: "valid_email_or_phone_required" },
      400,
      responseOrigin,
    );
  }

  if (!subject) {
    return json({ ok: false, error: "subject_required" }, 400, responseOrigin);
  }

  if (message.length < 5) {
    return json({ ok: false, error: "message_required" }, 400, responseOrigin);
  }

  if (!pageUrl) {
    return json({ ok: false, error: "invalid_page_url" }, 400, responseOrigin);
  }

  let config;

  try {
    config = getConfiguration(process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    console.error("Contact API configuration error", publicError(reason));

    return json(
      { ok: false, error: publicError(reason) },
      503,
      responseOrigin,
    );
  }

  try {
    await verifyTurnstile(input.turnstileToken, request, process.env);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";

    const failure = [
      "turnstile_required",
      "turnstile_verification_failed",
    ].includes(reason) ? reason : "request_verification_failed";

    console.warn("Contact request verification rejected", failure);

    return json({ ok: false, error: failure }, 403, responseOrigin);
  }

  const record = {
    name,
    email,
    phone,
    subject,
    message,
    pageUrl,
    receivedAt: new Date().toISOString(),
    reference: crypto.randomUUID(),
  };

  try {
    const pdf = createContactPdf(record);
    const mediaId = await uploadPdf(pdf, process.env, config);
    const messageId = await sendContactTemplate(
      record,
      mediaId,
      process.env,
      config,
    );

    return json(
      {
        ok: true,
        accepted: true,
        whatsappAcceptedByMeta: true,
        reference: messageId,
        note: "Meta accepted the message; handset delivery is not confirmed.",
      },
      202,
      responseOrigin,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "notification_failed";
    const failure = publicError(reason);

    console.error("Contact notification failed", failure);

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
