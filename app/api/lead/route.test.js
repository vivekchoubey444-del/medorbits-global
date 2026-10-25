
/**
 * MedOrbits -- Lead API Tests
 * File: app/api/lead/route.test.js
 *
 * Test runner: Vitest
 * Runtime: Node.js 20+
 *
 * Tests:
 * - Request methods and content types
 * - JSON and payload validation
 * - Lead/download validation
 * - Consent and honeypot behavior
 * - Origin allowlist
 * - Email and phone validation
 * - Turnstile verification
 * - WhatsApp media upload and template delivery
 * - Provider failures and timeouts
 * - PDF attachment generation
 * - Sensitive-data-safe error responses
 *
 * Run:
 *   npx vitest run app/api/lead/route.test.js
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { POST, OPTIONS } from "./route.js";

const SITE_ORIGIN = "https://medorbits.in";
const API_URL = `${SITE_ORIGIN}/api/lead`;

const VALID_ENV = {
  WHATSAPP_ACCESS_TOKEN: "test_access_token_not_real",
  WHATSAPP_PHONE_NUMBER_ID: "123456789012345",
  ADMIN_WHATSAPP: "919876543210",
  WHATSAPP_TEMPLATE_NAME: "medorbits_notification",
  WHATSAPP_TEMPLATE_LANGUAGE: "en",
  WHATSAPP_GRAPH_VERSION: "v99.0",
  ALLOWED_ORIGINS: "https://medorbits.in,https://www.medorbits.in",
  MAX_BODY_BYTES: "12000",
  MAX_MESSAGE_LENGTH: "1500",
};

function makeLead(overrides = {}) {
  return {
    eventType: "lead",
    name: "Test Applicant",
    phone: "9876543210",
    email: "applicant@example.com",
    interest: "MBBS admission",
    message: "Please contact me about admission guidance.",
    pageUrl: `${SITE_ORIGIN}/admissions/mbbs.html`,
    consent: true,
    website: "",
    ...overrides,
  };
}

function makeDownload(overrides = {}) {
  return {
    eventType: "download",
    resource: "MBBS Admission Guide 2026",
    pageUrl: `${SITE_ORIGIN}/resources/mbbs-guide.html`,
    consent: true,
    website: "",
    ...overrides,
  };
}

function makeRequest({
  body = makeLead(),
  method = "POST",
  url = API_URL,
  origin = SITE_ORIGIN,
  contentType = "application/json",
  headers = {},
} = {}) {
  const requestHeaders = new Headers(headers);

  if (origin !== null) {
    requestHeaders.set("Origin", origin);
  }

  if (contentType) {
    requestHeaders.set("Content-Type", contentType);
  }

  const bodyValue =
    typeof body === "string" || body === null
      ? body
      : JSON.stringify(body);

  return new Request(url, {
    method,
    headers: requestHeaders,
    body: method === "GET" || method === "HEAD" ? undefined : bodyValue,
  });
}

async function readResponse(response) {
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

function mockWhatsAppSuccess() {
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce(
      Response.json({ id: "test_media_id" }, { status: 200 }),
    )
    .mockResolvedValueOnce(
      Response.json(
        { messages: [{ id: "wamid.test-message-id" }] },
        { status: 200 },
      ),
    );
}

function mockTurnstileAndWhatsAppSuccess() {
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce(
      Response.json({ success: true }, { status: 200 }),
    )
    .mockResolvedValueOnce(
      Response.json({ id: "test_media_id" }, { status: 200 }),
    )
    .mockResolvedValueOnce(
      Response.json(
        { messages: [{ id: "wamid.test-message-id" }] },
        { status: 200 },
      ),
    );
}

describe("MedOrbits lead API", () => {
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", VALID_ENV.WHATSAPP_ACCESS_TOKEN);
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", VALID_ENV.WHATSAPP_PHONE_NUMBER_ID);
    vi.stubEnv("ADMIN_WHATSAPP", VALID_ENV.ADMIN_WHATSAPP);
    vi.stubEnv("WHATSAPP_TEMPLATE_NAME", VALID_ENV.WHATSAPP_TEMPLATE_NAME);
    vi.stubEnv("WHATSAPP_TEMPLATE_LANGUAGE", VALID_ENV.WHATSAPP_TEMPLATE_LANGUAGE);
    vi.stubEnv("WHATSAPP_GRAPH_VERSION", VALID_ENV.WHATSAPP_GRAPH_VERSION);
    vi.stubEnv("ALLOWED_ORIGINS", VALID_ENV.ALLOWED_ORIGINS);
    vi.stubEnv("MAX_BODY_BYTES", VALID_ENV.MAX_BODY_BYTES);
    vi.stubEnv("MAX_MESSAGE_LENGTH", VALID_ENV.MAX_MESSAGE_LENGTH);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    globalThis.fetch = vi.fn();

    // Keep test output clean while still allowing assertions on returned errors.
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("request validation", () => {
    it("rejects requests without JSON content type", async () => {
      const request = makeRequest({
        contentType: "text/plain",
        body: '{"eventType":"lead"}',
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(415);
      expect(result.body.error).toBe("json_required");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      const request = makeRequest({ body: '{"eventType":' });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_json");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects a JSON array instead of an object", async () => {
      const request = makeRequest({ body: [] });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_payload");
    });

    it("rejects a null JSON body", async () => {
      const request = makeRequest({ body: null });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_payload");
    });

    it("rejects unsupported event types", async () => {
      const request = makeRequest({
        body: makeLead({ eventType: "subscribe" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_event_type");
    });

    it("requires explicit consent", async () => {
      const request = makeRequest({
        body: makeLead({ consent: false }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("consent_required");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("requires consent to be the boolean true", async () => {
      const request = makeRequest({
        body: makeLead({ consent: "true" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("consent_required");
    });

    it("silently accepts honeypot submissions without sending notifications", async () => {
      const request = makeRequest({
        body: makeLead({ website: "https://spam.example" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body).toEqual({ ok: true, accepted: true });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe("origin security", () => {
    it("accepts an allowlisted origin", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body.ok).toBe(true);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(SITE_ORIGIN);
    });

    it("rejects an origin not on the allowlist", async () => {
      const request = makeRequest({
        origin: "https://malicious.example",
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("origin_not_allowed");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects an origin that merely shares a hostname prefix", async () => {
      const request = makeRequest({
        origin: "https://medorbits.in.malicious.example",
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("origin_not_allowed");
    });

    it("rejects malformed origins", async () => {
      const request = makeRequest({ origin: "not a URL" });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("origin_not_allowed");
    });

    it("does not emit an allow-origin header for requests without Origin", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest({ origin: null }));

      expect(response.status).toBe(202);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("rejects page URLs outside the configured origins", async () => {
      const request = makeRequest({
        body: makeLead({
          pageUrl: "https://malicious.example/fake-page",
        }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_page_url");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects page URLs containing credentials", async () => {
      const request = makeRequest({
        body: makeLead({
          pageUrl: "https://user:password@medorbits.in/private",
        }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_page_url");
    });

    it("rejects unsupported URL schemes", async () => {
      const request = makeRequest({
        body: makeLead({ pageUrl: "javascript:alert(1)" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_page_url");
    });
  });

  describe("lead field validation", () => {
    it("requires a name of at least two characters", async () => {
      const request = makeRequest({
        body: makeLead({ name: "A" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("valid_name_required");
    });

    it("requires a valid phone number", async () => {
      const request = makeRequest({
        body: makeLead({ phone: "123" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("valid_phone_required");
    });

    it("rejects phone numbers exceeding the accepted digit count", async () => {
      const request = makeRequest({
        body: makeLead({ phone: "123456789012345678" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("valid_phone_required");
    });

    it("rejects malformed email addresses", async () => {
      const request = makeRequest({
        body: makeLead({ email: "not-an-email" }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("invalid_email");
    });

    it("allows an omitted email address", async () => {
      mockWhatsAppSuccess();

      const body = makeLead({ email: "" });
      const response = await POST(makeRequest({ body }));
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body.ok).toBe(true);
    });

    it("requires a resource for download events", async () => {
      const request = makeRequest({
        body: makeDownload({ resource: " " }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("resource_required");
    });

    it("does not require lead-only fields for a download event", async () => {
      mockWhatsAppSuccess();

      const body = makeDownload();
      const response = await POST(makeRequest({ body }));
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body.eventType).toBe("download");
    });
  });

  describe("payload size", () => {
    it("rejects a payload exceeding MAX_BODY_BYTES", async () => {
      vi.stubEnv("MAX_BODY_BYTES", "1000");

      const request = makeRequest({
        body: makeLead({ message: "x".repeat(3000) }),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(413);
      expect(result.body.error).toBe("payload_too_large");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects a declared content length above the configured limit", async () => {
      vi.stubEnv("MAX_BODY_BYTES", "1000");

      const headers = new Headers({
        Origin: SITE_ORIGIN,
        "Content-Type": "application/json",
        "Content-Length": "50000",
      });

      const request = new Request(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(makeLead()),
      });

      const response = await POST(request);
      const result = await readResponse(response);

      expect(result.status).toBe(413);
      expect(result.body.error).toBe("payload_too_large");
    });
  });

  describe("WhatsApp configuration", () => {
    it("returns a service error when required configuration is missing", async () => {
      vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(503);
      expect(result.body.error).toBe("notification_service_not_configured");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects an invalid Graph API version", async () => {
      vi.stubEnv("WHATSAPP_GRAPH_VERSION", "latest");

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(503);
      expect(result.body.error).toBe("invalid_graph_api_version");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects an invalid WhatsApp phone-number ID", async () => {
      vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "not-a-number");

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(503);
      expect(result.body.error).toBe("invalid_phone_number_id");
    });

    it("rejects an invalid template name", async () => {
      vi.stubEnv("WHATSAPP_TEMPLATE_NAME", "bad template name");

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(503);
      expect(result.body.error).toBe("invalid_template_name");
    });

    it("rejects an invalid recipient number", async () => {
      vi.stubEnv("ADMIN_WHATSAPP", "123");

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(503);
      expect(result.body.error).toBe("invalid_admin_whatsapp");
    });
  });

  describe("successful notifications", () => {
    it("uploads a PDF and sends a WhatsApp document template", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body).toMatchObject({
        ok: true,
        accepted: true,
        whatsappAcceptedByMeta: true,
        eventType: "lead",
        reference: "wamid.test-message-id",
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(2);

      const [uploadUrl, uploadOptions] = globalThis.fetch.mock.calls[0];
      expect(String(uploadUrl)).toContain("/123456789012345/media");
      expect(uploadOptions.method).toBe("POST");
      expect(uploadOptions.body).toBeInstanceOf(FormData);

      const uploadForm = uploadOptions.body;
      expect(uploadForm.get("messaging_product")).toBe("whatsapp");
      expect(uploadForm.get("type")).toBe("application/pdf");

      const pdf = uploadForm.get("file");
      expect(pdf).toBeInstanceOf(Blob);
      expect(pdf.type).toBe("application/pdf");

      const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
      const pdfText = new TextDecoder().decode(pdfBytes);

      expect(pdfText.startsWith("%PDF-1.4")).toBe(true);
      expect(pdfText).toContain("MEDORBITS - WEBSITE NOTIFICATION");
      expect(pdfText).toContain("Test Applicant");
      expect(pdfText).toContain("MBBS admission");

      const [messageUrl, messageOptions] = globalThis.fetch.mock.calls[1];
      expect(String(messageUrl)).toContain("/123456789012345/messages");

      const payload = JSON.parse(messageOptions.body);
      expect(payload.messaging_product).toBe("whatsapp");
      expect(payload.to).toBe("919876543210");
      expect(payload.type).toBe("template");
      expect(payload.template.name).toBe("medorbits_notification");

      const header = payload.template.components.find(
        (component) => component.type === "header",
      );

      const body = payload.template.components.find(
        (component) => component.type === "body",
      );

      expect(header.parameters[0].type).toBe("document");
      expect(header.parameters[0].document.id).toBe("test_media_id");
      expect(body.parameters).toHaveLength(4);
      expect(body.parameters[0].text).toBe("Website enquiry");
    });

    it("sends download events with resource details", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest({ body: makeDownload() }));
      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body.eventType).toBe("download");

      const messagePayload = JSON.parse(globalThis.fetch.mock.calls[1][1].body);
      const body = messagePayload.template.components.find(
        (component) => component.type === "body",
      );

      expect(body.parameters[0].text).toBe("Resource download");
      expect(body.parameters[1].text).toBe("MBBS Admission Guide 2026");
    });

    it("includes standard security headers", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest());

      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(response.headers.get("Content-Type")).toContain("application/json");
    });

    it("does not expose the submitted personal details in the response", async () => {
      mockWhatsAppSuccess();

      const response = await POST(makeRequest());
      const responseText = await response.text();

      expect(responseText).not.toContain("9876543210");
      expect(responseText).not.toContain("applicant@example.com");
      expect(responseText).not.toContain("Test Applicant");
    });
  });

  describe("Turnstile verification", () => {
    it("requires a token when Turnstile is configured", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test_turnstile_secret");

      const response = await POST(makeRequest({
        body: makeLead({ turnstileToken: "" }),
      }));

      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("turnstile_required");
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it("rejects failed Turnstile verification", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test_turnstile_secret");

      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        Response.json({ success: false }, { status: 200 }),
      );

      const response = await POST(makeRequest({
        body: makeLead({ turnstileToken: "invalid-test-token" }),
      }));

      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("turnstile_verification_failed");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("continues to WhatsApp when Turnstile succeeds", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test_turnstile_secret");
      mockTurnstileAndWhatsAppSuccess();

      const response = await POST(makeRequest({
        body: makeLead({ turnstileToken: "valid-test-token" }),
      }));

      const result = await readResponse(response);

      expect(result.status).toBe(202);
      expect(result.body.ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);

      const turnstileForm = globalThis.fetch.mock.calls[0][1].body;
      expect(turnstileForm.get("secret")).toBe("test_turnstile_secret");
      expect(turnstileForm.get("response")).toBe("valid-test-token");
    });
  });

  describe("WhatsApp provider failures", () => {
    it("handles a media upload failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        Response.json(
          { error: { code: 100, message: "Simulated provider failure" } },
          { status: 400 },
        ),
      );

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(502);
      expect(result.body).toEqual({
        ok: false,
        accepted: false,
        error: "whatsapp_media_upload_failed",
      });

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result.body)).not.toContain("Simulated provider failure");
    });

    it("handles a document message failure", async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(
          Response.json({ id: "test_media_id" }, { status: 200 }),
        )
        .mockResolvedValueOnce(
          Response.json(
            { error: { code: 131000, message: "Simulated send failure" } },
            { status: 500 },
          ),
        );

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(502);
      expect(result.body.error).toBe("whatsapp_document_send_failed");
      expect(result.body.accepted).toBe(false);
    });

    it("handles a provider returning malformed JSON", async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce(
        new Response("not-json", {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(502);
      expect(result.body.error).toBe("whatsapp_media_upload_failed");
    });

    it("does not expose access tokens in public errors", async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(
        new Error("Simulated network failure"),
      );

      const response = await POST(makeRequest());
      const result = await readResponse(response);

      expect(result.status).toBe(502);
      expect(JSON.stringify(result.body)).not.toContain(
        VALID_ENV.WHATSAPP_ACCESS_TOKEN,
      );
    });
  });

  describe("OPTIONS preflight", () => {
    it("accepts an allowlisted origin", async () => {
      const request = new Request(API_URL, {
        method: "OPTIONS",
        headers: { Origin: SITE_ORIGIN },
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(SITE_ORIGIN);
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("rejects a disallowed origin", async () => {
      const request = new Request(API_URL, {
        method: "OPTIONS",
        headers: { Origin: "https://malicious.example" },
      });

      const response = await OPTIONS(request);
      const result = await readResponse(response);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("origin_not_allowed");
    });

    it("returns a no-content response when Origin is absent", async () => {
      const request = new Request(API_URL, { method: "OPTIONS" });

      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
    });
  });
});
