
# MedOrbits Lead API

**File:** `app/api/lead/README.md`  
**Endpoint:** `/api/lead`  
**Framework:** Next.js App Router  
**Runtime:** Node.js  
**Purpose:** Receive website enquiries and resource-download events, generate a PDF notification, and send it to the configured MedOrbits administrator through the WhatsApp Cloud API.

## 1. Overview

The Lead API supports two event types:

- `lead` — collects a website enquiry.
- `download` — records a resource-download notification.

The API validates requests, checks consent, optionally verifies Cloudflare Turnstile, generates a PDF, uploads the document to WhatsApp, and sends an approved document-header template.

Next.js App Router handlers use named HTTP-method exports in `route.js`. This endpoint exports `POST` and `OPTIONS`. See the [Next.js Route Handlers documentation](https://nextjs.org/docs/app/getting-started/route-handlers).

## 2. File structure

```text
medorbits/
├── app/
│   └── api/
│       └── lead/
│           ├── route.js
│           ├── route.test.js
│           └── README.md
├── .env.example
├── package.json
└── vitest.config.js
```

The API is available at:

```text
POST https://medorbits.in/api/lead
```

The test file is intended for Vitest and should be run separately from the production handler.

## 3. Environment variables

Configure these variables in your local `.env.local` file and production hosting environment.

| Variable | Required | Description |
|—|—|—|
| `WHATSAPP_ACCESS_TOKEN` | Yes | Server-side WhatsApp Cloud API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Meta-issued sender phone-number ID |
| `ADMIN_WHATSAPP` | Yes | Recipient phone number with country code, digits only |
| `WHATSAPP_TEMPLATE_NAME` | Yes | Approved WhatsApp message-template name |
| `WHATSAPP_GRAPH_VERSION` | Yes | Supported Meta Graph API version |
| `WHATSAPP_TEMPLATE_LANGUAGE` | No | Template language code; defaults to `en` |
| `ALLOWED_ORIGINS` | No | Comma-separated exact website origins |
| `MAX_BODY_BYTES` | No | Request-body limit; defaults to 12,000 bytes |
| `MAX_MESSAGE_LENGTH` | No | Maximum accepted message length; defaults to 1,500 characters |
| `TURNSTILE_SECRET_KEY` | No | Secret for server-side Turnstile verification |

Example `.env.example`:

```dotenv
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ADMIN_WHATSAPP=
WHATSAPP_TEMPLATE_NAME=
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_GRAPH_VERSION=
ALLOWED_ORIGINS=https://medorbits.in,https://www.medorbits.in
MAX_BODY_BYTES=12000
MAX_MESSAGE_LENGTH=1500
TURNSTILE_SECRET_KEY=
```

Never commit real credentials to Git. Do not expose these secrets through variables prefixed with `NEXT_PUBLIC_`.

## 4. Lead request

Send a JSON request with the following structure:

```json
{
  “eventType”: “lead”,
  “name”: “Example Applicant”,
  “phone”: “9876543210”,
  “email”: “applicant@example.com”,
  “interest”: “MBBS admission guidance”,
  “message”: “Please contact me about the admission process.”,
  “pageUrl”: “https://medorbits.in/admissions/mbbs.html”,
  “consent”: true,
  “website”: “”
}
```

Required lead fields:

- `eventType` must be `lead`.
- `name` must contain at least two characters after sanitization.
- `phone` must contain 7–15 digits.
- `consent` must be the boolean `true`.

Email, interest, message, and page URL are optional, subject to validation when supplied.

## 5. Download request

```json
{
  “eventType”: “download”,
  “resource”: “MBBS Admission Guide 2026”,
  “pageUrl”: “https://medorbits.in/resources/mbbs-guide.html”,
  “consent”: true,
  “website”: “”
}
```

Required download fields:

- `eventType` must be `download`.
- `resource` must not be empty.
- `consent` must be the boolean `true`.

The `website` field is a honeypot. It should remain empty in legitimate submissions.

## 6. Turnstile integration

Turnstile verification is optional until `TURNSTILE_SECRET_KEY` is configured.

When enabled, the client must submit a `turnstileToken`:

```json
{
  “eventType”: “lead”,
  “name”: “Example Applicant”,
  “phone”: “9876543210”,
  “consent”: true,
  “website”: “”,
  “turnstileToken”: “CLIENT_GENERATED_TURNSTILE_TOKEN”
}
```

The server must validate the token with Cloudflare before calling WhatsApp.

The client must obtain the token through the actual Turnstile widget; it must not fabricate one. Configure the Turnstile site key on the frontend separately from the server-side secret.

## 7. WhatsApp template requirements

Create and obtain approval for a WhatsApp template with:

- A **DOCUMENT header**.
- Exactly four body text parameters in the configured order.
- A supported language code.
- A template name matching `WHATSAPP_TEMPLATE_NAME`.

Parameter mapping:

| Parameter | Value |
|—|—|
| `{{1}}` | Event type or event description |
| `{{2}}` | Applicant name or requested resource |
| `{{3}}` | Contact details or `Not provided` |
| `{{4}}` | Interest, details, and page URL |

The API first uploads the generated PDF to Meta and then sends the template using the returned media ID. The recipient must be configured correctly, and the access token must have the required permissions.

See the [WhatsApp document-message reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/document/) for document handling concepts. Confirm current production requirements in Meta’s official WhatsApp Cloud API documentation before deployment.

## 8. Responses

### Accepted by Meta

HTTP `202 Accepted`:

```json
{
  “ok”: true,
  “accepted”: true,
  “whatsappAcceptedByMeta”: true,
  “eventType”: “lead”,
  “reference”: “wamid.example”,
  “note”: “Meta accepted the message; handset delivery is not confirmed.”
}
```

This response indicates that Meta accepted the message. It does not guarantee delivery to the administrator’s handset.

### Validation failure

HTTP `400 Bad Request`:

```json
{
  “ok”: false,
  “error”: “consent_required”
}
```

### Origin rejection

HTTP `403 Forbidden`:

```json
{
  “ok”: false,
  “error”: “origin_not_allowed”
}
```

### Configuration failure

HTTP `503 Service Unavailable`:

```json
{
  “ok”: false,
  “error”: “notification_service_not_configured”
}
```

### Notification failure

HTTP `502 Bad Gateway`:

```json
{
  “ok”: false,
  “accepted”: false,
  “error”: “whatsapp_media_upload_failed”
}
```

The precise error codes depend on the failure. The API should not return provider access tokens, raw provider payloads, or applicant details in error responses.

## 9. Validation and security

The handler implements or should maintain these controls:

- JSON-only request handling.
- Request-size limits.
- Field sanitization and length limits.
- Email, phone, event-type, and consent validation.
- Exact-origin allowlisting for requests carrying an `Origin` header.
- Page URL restrictions to allowlisted website origins.
- Honeypot handling for likely automated submissions.
- Optional server-side Turnstile verification.
- Request timeouts for external API calls.
- Server-side secret storage.
- Minimal error logging.
- `Cache-Control: no-store` on API responses.

**Important:** Origin validation does not authenticate callers. Requests without an `Origin` header can still reach the handler. Add Cloudflare WAF rate limiting and appropriate abuse controls. Avoid trusting arbitrary forwarded-IP headers unless your deployment infrastructure establishes them.

The endpoint should be deployed with HTTPS and should not be exposed through an untrusted proxy that can bypass your controls.

## 10. Testing

Install Vitest if it is not already installed:

```bash
npm install —save-dev vitest
```

Run the lead API tests:

```bash
npx vitest run app/api/lead/route.test.js
```

Run the broader test suite:

```bash
npx vitest run
```

The test suite should mock external `fetch` calls. Do not use production credentials or send real WhatsApp messages in automated tests.

Before release, test:

1. Valid lead submission.
2. Valid download notification.
3. Missing consent and required fields.
4. Invalid phone number and email.
5. Disallowed origin and page URL.
6. Oversized request body.
7. Missing or invalid environment variables.
8. Failed Turnstile verification.
9. Failed media upload and template delivery.
10. Provider timeout and malformed provider responses.
11. PDF validity and page overflow.
12. Duplicate submissions and rate-limit behavior.

## 11. Deployment checklist

- [ ] Confirm `app/api/lead/route.js` exists and exports `POST`.
- [ ] Confirm the deployment uses the Node.js runtime.
- [ ] Set the five required WhatsApp environment variables.
- [ ] Set exact production origins in `ALLOWED_ORIGINS`.
- [ ] Confirm the template is approved and its parameter order matches the handler.
- [ ] Configure Turnstile on both the frontend and backend if enabled.
- [ ] Configure WAF rate limiting.
- [ ] Run the tests and a production build.
- [ ] Test with a controlled administrator recipient.
- [ ] Verify actual delivery using Meta’s delivery-status mechanisms.
- [ ] Ensure logs do not expose personal data or secrets.

## 12. Reliability and data retention

This endpoint does not persist submissions. If WhatsApp fails after a visitor submits a form, the lead is not saved by this implementation.

For production lead capture, consider adding:

- A database table for lead and download events.
- A durable queue for notification jobs.
- Idempotency keys to reduce duplicate processing.
- Retry policies with backoff for transient provider errors.
- Notification status tracking and reconciliation.
- Access controls and retention rules for personal information.

Do not automatically retry every failed request: a timeout can occur after a provider has already accepted a message, which may lead to duplicate notifications.

## 13. Troubleshooting

| Symptom | Likely cause | Action |
|—|—|—|
| `notification_service_not_configured` | Missing environment variable | Check production environment settings |
| `invalid_graph_api_version` | Incorrect Graph API version format | Configure a supported Meta version |
| `invalid_page_url` | URL is malformed or outside the allowlist | Correct `pageUrl` or allowed origins |
| `turnstile_required` | Token missing while Turnstile is enabled | Connect the frontend widget |
| `turnstile_verification_failed` | Invalid, expired, or reused token | Request a fresh token and verify site configuration |
| `whatsapp_media_upload_failed` | Media endpoint, permissions, or file problem | Inspect server logs and Meta configuration |
| `whatsapp_document_send_failed` | Template, language, recipient, or permissions problem | Verify template approval and payload mapping |
| `provider_timeout` | External service did not respond in time | Investigate availability and add controlled retries |
| HTTP `413` | Request exceeded the configured body limit | Reduce form payload size |
| HTTP `403` | Origin rejected or Turnstile verification failed | Check the corresponding error code |

## 14. Operational limitations

This API is a notification endpoint, not a complete CRM or lead-management system. It does not provide durable storage, an administrator dashboard, delivery webhooks, retry queues, or guaranteed exactly-once processing.

Implement those components separately before relying on this endpoint as the sole record of customer enquiries.

—

**Documentation status:** Implementation guide for `app/api/lead/route.js`. Verify the actual route implementation and production environment configuration before treating every documented feature as enabled.
