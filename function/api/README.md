
# MedOrbits Function API

**Directory:** `function/api/`  
**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Website:** https://www.medorbits.in/  
**Purpose:** Serverless API functions for form submissions, resource requests, and external service integrations.

—

## 1. Overview

The `function/api/` directory is intended for serverless API handlers that run independently of the main website’s page-rendering layer.

Depending on the hosting platform, these functions may handle:

- Lead generation and admission enquiries.
- Contact form submissions.
- Resource and brochure requests.
- WhatsApp Business notifications.
- Bot protection and request validation.
- External service integrations.

**Important:** The directory name `function/api/` is not a universal serverless convention. Some hosting providers expect `functions/api/`, while Next.js App Router endpoints belong under `app/api/` or `src/app/api/`. Confirm the deployment platform’s routing rules before using this directory.

## 2. Recommended Directory Structure

```text
function/
└── api/
    ├── README.md
    ├── lead.js
    ├── contact.js
    ├── download.js
    ├── health.js
    └── shared/
        ├── response.js
        ├── validation.js
        ├── security.js
        └── whatsapp.js
```

This is a recommended organizational structure, not a statement that these files already exist.

Keep shared utilities separate from individual handlers. Avoid duplicating security checks, validation rules, and response formatting across functions.

## 3. Relationship to Next.js API Routes

MedOrbits may contain both serverless function handlers and Next.js route handlers. They should not be treated as interchangeable without an explicit migration or adapter.

| Feature | `function/api/` | `app/api/` |
|—|—|—|
| Typical purpose | Platform-specific serverless functions | Next.js App Router API endpoints |
| Handler format | Determined by hosting provider | Named HTTP method exports in `route.js` |
| Routing | Hosting-platform conventions | Directory-based Next.js routing |
| Runtime | Provider-dependent | Configured per route |
| Deployment | Depends on function adapter and host | Next.js-compatible deployment |

### Avoid duplicate endpoint ownership

Do not deploy two independent handlers for the same public endpoint without an intentional routing strategy.

For example, if `/api/contact` is already served by `app/api/contact/route.js`, do not assume `function/api/contact.js` will automatically replace or extend it.

Define which implementation owns each route and test the actual deployed URL.

## 4. Environment Variables

Keep secrets in server-side environment variables.

Example configuration for lead and contact integrations:

```dotenv
# Application
APP_BASE_URL=https://www.medorbits.in
ALLOWED_ORIGINS=https://www.medorbits.in,https://medorbits.in

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

Use only variables required by the actual function implementations.

Never commit real credentials, tokens, passwords, or production connection strings. Do not expose server-only secrets through `NEXT_PUBLIC_*` variables.

## 5. API Handler Requirements

Each function should follow these standards:

1. Validate the HTTP method and request content type.
2. Enforce request-size limits before buffering the entire body.
3. Parse JSON safely and reject malformed input.
4. Validate required fields, formats, and field lengths.
5. Apply appropriate consent and anti-spam checks.
6. Enforce origin policy for browser requests where applicable.
7. Use bounded timeouts for external requests.
8. Return consistent HTTP status codes and JSON responses.
9. Avoid exposing internal errors, filesystem paths, or secrets.
10. Record operational failures without unnecessarily logging personal information.
11. Add automated tests for success and failure scenarios.
12. Document required environment variables and deployment behavior.

CORS is not authentication. A non-browser client can forge or omit an `Origin` header, so sensitive operations must not rely on origin validation alone.

## 6. Recommended Response Format

Successful JSON response:

```json
{
  “success”: true,
  “message”: “Your request has been received.”
}
```

Validation failure:

```json
{
  “success”: false,
  “error”: “invalid_request”,
  “message”: “Please check the submitted information.”
}
```

Service unavailable:

```json
{
  “success”: false,
  “error”: “service_unavailable”,
  “message”: “The service is temporarily unavailable.”
}
```

These are recommended response conventions. Actual responses must match the relevant function’s contract.

## 7. HTTP Status Codes

| Status | Meaning |
|—|—|
| `200` | Request processed successfully |
| `201` | Resource created, where applicable |
| `204` | Successful response without a body |
| `400` | Malformed request |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Resource or endpoint not found |
| `405` | Method not supported |
| `413` | Request body too large |
| `415` | Unsupported content type |
| `422` | Valid request syntax but unacceptable field values |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure |
| `502` | Upstream provider failure |
| `503` | Service unavailable |

Use the status codes supported by the hosting platform and the actual handler implementation.

## 8. Security Requirements

### Request validation

- Reject unexpected event types and properties where appropriate.
- Apply field-length limits.
- Validate email addresses, phone numbers, and resource identifiers.
- Treat user-provided URLs as untrusted.
- Avoid accepting arbitrary file paths or storage keys.
- Require explicit authorization for private resources.

### Rate limiting

Implement rate limiting at the gateway, edge, or application layer. For distributed serverless environments, prefer a shared rate-limit store or platform-level protection over in-memory counters.

### Bot protection

Where appropriate, verify Turnstile tokens on the server using the secret key. Reject invalid or expired tokens and avoid logging token values.

### External services

For WhatsApp and other provider integrations:

- Use approved templates where required.
- Validate provider responses.
- Apply timeouts and bounded retries.
- Avoid duplicate sends when retrying.
- Keep credentials server-side.
- Do not equate an accepted API request with successful message delivery.

### Personal information

Lead and contact functions may process names, phone numbers, email addresses, and admission enquiries. Minimize collection, restrict access, define retention periods, and follow the MedOrbits privacy policy.

## 9. File Uploads and Downloads

If functions handle documents:

- Allow only explicitly supported file types.
- Limit upload size.
- Validate file contents rather than trusting the filename or MIME type alone.
- Store confidential files outside publicly served directories.
- Use authentication and authorization for private downloads.
- Avoid predictable public URLs for confidential documents.
- Scan uploaded files where the risk and deployment architecture require it.

Public brochure delivery and private application-document delivery must use separate security policies.

## 10. Testing

Test each handler independently and in the deployed environment.

Recommended test cases:

- Valid requests.
- Missing required fields.
- Malformed JSON.
- Invalid content types.
- Oversized bodies.
- Unsupported methods.
- Invalid origins.
- Failed anti-bot verification.
- Missing environment variables.
- External provider timeouts and errors.
- Rate-limit enforcement.
- Safe error responses.
- Duplicate request handling.
- Prevention of unauthorized resource access.

Mock external services in automated tests. Never send real customer notifications from a test suite unless an explicitly controlled integration test is intended.

For the Next.js API routes, run the existing project test script, if configured:

```bash
npm test
```

The actual test command for `function/api/` depends on the selected runtime and test framework.

## 11. Deployment Checklist

Before deployment:

- [ ] Confirm the hosting provider’s required function directory.
- [ ] Verify that each function exports the required handler format.
- [ ] Confirm that public routes do not conflict with Next.js API routes.
- [ ] Configure environment variables in the hosting dashboard.
- [ ] Verify request-size limits and timeouts.
- [ ] Configure rate limiting and bot protection.
- [ ] Test provider integrations using non-production credentials.
- [ ] Confirm that private documents cannot be accessed publicly.
- [ ] Run automated tests.
- [ ] Review dependency vulnerabilities.
- [ ] Verify logs do not expose credentials or unnecessary personal information.
- [ ] Test the deployed endpoint URLs.

## 12. Troubleshooting

### Function returns 404

Check the hosting provider’s required directory naming, function export format, deployment configuration, and route URL.

### Function returns 500

Inspect server-side logs for missing environment variables, unhandled exceptions, runtime incompatibilities, or upstream provider failures. Do not expose stack traces to clients.

### WhatsApp notifications fail

Verify credentials, recipient format, template approval, language, parameter ordering, and the provider’s response.

### Local requests work but production fails

Check production environment variables, runtime versions, deployment packaging, filesystem availability, CORS policy, and provider network restrictions.

### Function conflicts with Next.js route

Define one canonical route owner or configure an explicit proxy/rewriting strategy. Avoid assuming that both directory conventions map to the same URL.

—

## 13. Reference Documentation

- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js Environment Variables: https://nextjs.org/docs/app/guides/environment-variables
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Vercel Functions: https://vercel.com/docs/functions
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/

—

**Maintainer:** MedOrbits Engineering  
**Directory:** `function/api/`  
**Status:** Architecture and implementation guidance

Update this README whenever function routes, runtime requirements, request contracts, or security controls change.
