
# MedOrbits API Documentation

**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Website:** https://www.medorbits.in/  
**Directory:** `app/api/`  
**Runtime:** Node.js 20+  
**Framework:** Next.js App Router  
**Status:** API architecture and implementation guide

—

## 1. Overview

The `app/api/` directory contains server-side API endpoints for the MedOrbits website. These endpoints handle enquiries, lead submissions, contact forms, and integrations with external services.

API handlers must validate incoming requests, protect sensitive configuration, return consistent responses, and avoid exposing personal information or internal errors.

### Core principles

- Validate every request on the server.
- Keep API keys and secrets in environment variables.
- Use HTTPS in production.
- Apply rate limiting and abuse protection.
- Use consistent JSON response structures.
- Log operational events without recording unnecessary personal data.
- Never trust client-side validation alone.
- Test success paths, validation failures, and provider failures.

—

## 2. Directory Structure

```text
app/
└── api/
    ├── README.md
    │
    ├── lead/
    │   ├── route.js
    │   ├── route.test.js
    │   └── README.md
    │
    └── contact/
        ├── route.js
        ├── route.test.js
        └── README.md
```

This is the documented structure for the endpoints covered here. Add additional routes only when their implementation and requirements are defined.

Each endpoint directory should contain its own route handler, focused tests, and endpoint-specific documentation when appropriate.

—

## 3. Available Endpoints

| Endpoint | Method | Purpose |
|—|—|—|
| `/api/lead` | `POST` | Submit a lead or request a resource download |
| `/api/lead` | `OPTIONS` | Handle supported cross-origin preflight requests |
| `/api/contact` | `POST` | Submit a general contact enquiry |
| `/api/contact` | `OPTIONS` | Handle supported cross-origin preflight requests |

The methods and payloads documented here must match the actual deployed route handlers.

### Lead endpoint

File: `app/api/lead/route.js`

Supports lead submissions and resource-download requests. The handler may generate a PDF and forward the relevant information through the configured WhatsApp Business integration.

Typical lead fields:

```json
{
  “eventType”: “lead”,
  “name”: “Example Applicant”,
  “phone”: “9876543210”,
  “email”: “applicant@example.com”,
  “interest”: “MBBS Admission”,
  “message”: “I would like admission guidance.”,
  “consent”: true,
  “website”: “”,
  “pageUrl”: “https://www.medorbits.in/“
}
```

For a resource download, use the `download` event type and provide the resource identifier expected by the handler.

### Contact endpoint

File: `app/api/contact/route.js`

Handles general website contact enquiries.

Typical payload:

```json
{
  “name”: “Example Applicant”,
  “email”: “applicant@example.com”,
  “phone”: “9876543210”,
  “subject”: “Admission enquiry”,
  “message”: “Please contact me about admissions.”,
  “consent”: true,
  “website”: “”,
  “pageUrl”: “https://www.medorbits.in/contact.html”
}
```

Optional anti-bot fields may be included when Turnstile protection is configured.

**Important:** The payload examples are illustrative. Always verify field requirements against the current handler and its tests before connecting a frontend form.

—

## 4. Environment Configuration

Create or update the root `.env.example` file. Do not commit real credentials.

```dotenv
# Application
NODE_ENV=development
APP_BASE_URL=http://localhost:3000

# Cross-origin access
ALLOWED_ORIGINS=http://localhost:3000,https://www.medorbits.in,https://medorbits.in

# WhatsApp Business Cloud API
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ADMIN_WHATSAPP=
WHATSAPP_TEMPLATE_NAME=
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_GRAPH_VERSION=

# Optional bot protection
TURNSTILE_SECRET_KEY=

# Request controls
MAX_BODY_BYTES=20000
MAX_MESSAGE_LENGTH=5000
```

Use the exact environment variable names expected by the route handlers.

### Environment rules

1. Store production secrets in the hosting provider’s environment settings.
2. Never expose private keys through `NEXT_PUBLIC_*` variables.
3. Never commit `.env`, `.env.local`, or production credentials.
4. Rotate any credential that has been exposed.
5. Validate required environment variables during deployment or endpoint execution.
6. Keep development and production credentials separate.
7. Configure a currently supported WhatsApp Graph API version.

—

## 5. Request and Response Standards

API routes should use JSON for request and response bodies unless a documented integration requires another content type.

### Successful response

```json
{
  “success”: true,
  “message”: “Your request has been received.”
}
```

### Validation failure

```json
{
  “success”: false,
  “error”: “invalid_request”,
  “message”: “Please check the submitted information.”
}
```

### Service failure

```json
{
  “success”: false,
  “error”: “service_unavailable”,
  “message”: “We could not process your request right now.”
}
```

These are recommended response conventions, not a guarantee that every existing route currently returns these exact fields.

### HTTP status codes

| Status | Meaning |
|—|—|
| `200` | Request processed successfully |
| `201` | Resource created successfully, where applicable |
| `400` | Invalid JSON or request data |
| `401` | Authentication required |
| `403` | Request rejected by an access or security rule |
| `404` | Endpoint or resource not found |
| `405` | HTTP method not supported |
| `413` | Request body too large |
| `415` | Unsupported content type |
| `422` | Valid JSON with unacceptable field values |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `502` | Upstream provider returned an invalid response |
| `503` | Required service is unavailable |

Use status codes consistently with each endpoint’s actual behavior.

—

## 6. Security Requirements

### Input validation

- Validate field types, lengths, and formats.
- Normalize phone numbers before sending them to an external provider.
- Reject invalid or unexpected event types.
- Validate URLs before accepting them for logging or processing.
- Treat hidden honeypot fields as one layer of spam prevention, not as authentication.
- Require explicit consent where the form’s purpose requires it.

### Request-body limits

Enforce request-size limits before reading an unrestricted body into memory. Checking the size only after `request.text()` has completed does not prevent oversized-body resource consumption.

Use hosting-level request limits or a bounded streaming reader when the runtime and framework permit it.

### Origin and CORS

- Maintain an explicit allowlist for trusted website origins.
- Return appropriate CORS headers for allowed origins.
- Reject disallowed browser origins where applicable.
- Do not treat the `Origin` header as authentication; non-browser clients can forge or omit it.
- Do not use wildcard origins with credentialed requests.

CORS is a browser access policy, not a replacement for authorization or abuse protection.

### Rate limiting and spam protection

Production deployments should implement distributed rate limiting where necessary, ideally using a shared store or gateway rather than in-memory counters in serverless instances.

Consider:

- IP-based and endpoint-based limits.
- Turnstile verification.
- Request timeouts.
- Retry controls for external services.
- Abuse monitoring and alerting.
- Idempotency for operations that could be repeated.

Do not trust forwarded IP headers unless they are set by a trusted proxy.

### Personal information

Contact and lead forms may contain personal information. Apply data minimization, access controls, retention limits, and appropriate privacy notices. Avoid logging full messages, phone numbers, email addresses, access tokens, or generated documents unless there is a justified and protected operational need.

—

## 7. WhatsApp Integration

The lead and contact routes may use the WhatsApp Business Cloud API to forward enquiries.

Typical workflow:

1. Validate the incoming request.
2. Verify consent and configured anti-bot controls.
3. Validate the required server-side configuration.
4. Generate the required document, if applicable.
5. Upload the document through the WhatsApp media endpoint.
6. Send the approved WhatsApp message template.
7. Return an appropriate API response.

### Template requirements

- Use an approved WhatsApp template when required by WhatsApp’s messaging rules.
- Match template parameter order and types exactly.
- Verify the recipient’s WhatsApp number format.
- Handle provider errors and timeouts.
- Avoid returning access tokens or internal provider responses to the browser.
- Do not report successful delivery merely because a request was accepted by an upstream API.

### Reliability warning

Sending a WhatsApp message is not equivalent to durably storing a lead. If the business requires reliable lead retention, implement persistent database storage and preferably a durable queue with retry and idempotency controls.

The currently documented handlers should not be assumed to provide durable lead storage unless that functionality has been implemented and verified.

—

## 8. Testing

The project uses Vitest for automated tests.

Install the test dependencies if they are not already present:

```bash
npm install —save-dev vitest @vitest/coverage-v8
```

Recommended `package.json` scripts:

```json
{
  “scripts”: {
    “test”: “vitest run”,
    “test:watch”: “vitest”,
    “test:coverage”: “vitest run —coverage”,
    “test:lead”: “vitest run app/api/lead/route.test.js”,
    “test:contact”: “vitest run app/api/contact/route.test.js”
  }
}
```

Merge these scripts into the existing `package.json`; do not replace unrelated scripts or dependencies.

### Run the tests

```bash
# Run all tests
npm test

# Test lead submissions
npm run test:lead

# Test contact submissions
npm run test:contact

# Generate coverage reports
npm run test:coverage
```

### Required test coverage

Each endpoint should test:

- Valid requests.
- Malformed JSON.
- Missing required fields.
- Invalid field formats.
- Oversized request bodies.
- Unsupported content types and methods.
- Invalid origins where origin checks apply.
- Missing configuration.
- Honeypot spam submissions.
- Turnstile rejection and provider failures.
- WhatsApp upload and send failures.
- Network errors and timeouts.
- Safe error responses.
- Correct HTTP status codes.
- No secret leakage in response bodies or logs.

Mock external HTTP requests in automated tests. Tests must not send real WhatsApp messages or use production credentials.

—

## 9. Local Development

Install dependencies:

```bash
npm install
```

Configure local environment variables in `.env.local`, then start the development server:

```bash
npm run dev
```

Test the contact endpoint with a sample request:

```bash
curl -X POST http://localhost:3000/api/contact \
  -H “Content-Type: application/json” \
  -d ‘{
    “name”: “Example Applicant”,
    “email”: “applicant@example.com”,
    “phone”: “9876543210”,
    “subject”: “Admission enquiry”,
    “message”: “Please contact me about admissions.”,
    “consent”: true,
    “website”: “”,
    “pageUrl”: “http://localhost:3000/contact.html”
  }’
```

The request must satisfy the currently configured origin and validation rules. Adjust the test URL to match the local configuration.

Use mock integrations or test credentials while developing.

—

## 10. Production Deployment Checklist

Before deployment:

- [ ] All required environment variables are configured.
- [ ] No secrets are committed to Git.
- [ ] All automated tests pass.
- [ ] WhatsApp template names and parameters are verified.
- [ ] The Graph API version is supported.
- [ ] CORS and origin allowlists are correct.
- [ ] Request-body limits are enforced before unrestricted buffering.
- [ ] Distributed rate limiting is configured where needed.
- [ ] Bot protection is configured if required.
- [ ] Provider requests have appropriate timeouts.
- [ ] Personal information is handled according to the privacy policy.
- [ ] Errors do not reveal internal implementation details.
- [ ] Monitoring and operational alerts are configured.
- [ ] Durable storage and retry behavior are implemented if lead loss is unacceptable.
- [ ] Production smoke tests are completed without exposing real customer information.

—

## 11. Troubleshooting

### `500 Internal Server Error`

Check the server logs for missing environment variables, PDF generation failures, unexpected exceptions, or upstream provider errors. Do not expose stack traces to public clients.

### WhatsApp message not received

Verify the access token, phone-number ID, recipient format, approved template, template language, parameter order, and upstream API response.

### `403 Forbidden`

Check origin restrictions, configured allowlists, Turnstile validation, and other endpoint security rules.

### `413 Payload Too Large`

Reduce the request size or review the configured body limit. Enforce limits before buffering the entire request body.

### Tests fail locally

Verify Node.js compatibility, installed dependencies, Vitest configuration, environment stubs, and mocked fetch responses. Ensure test requests match the actual route contract.

—

## 12. API Development Standards

New endpoints should:

1. Use the Next.js App Router route-handler convention.
2. Declare the intended runtime explicitly when required.
3. Export only supported HTTP method handlers.
4. Validate request bodies before business processing.
5. Keep reusable business logic separate as the API grows.
6. Use stable error codes and safe public messages.
7. Add automated tests for both success and failure cases.
8. Document required environment variables and request schemas.
9. Avoid hard-coded credentials, secrets, and production URLs.
10. Include security, privacy, and operational considerations in code review.

—

## 13. Reference Documentation

- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js Environment Variables: https://nextjs.org/docs/app/guides/environment-variables
- Vitest: https://vitest.dev/guide/
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/

—

**Maintainer:** MedOrbits Engineering  
**Directory owner:** `app/api/`  
**Review requirement:** Update this document whenever API routes, request contracts, environment variables, or security controls change.
