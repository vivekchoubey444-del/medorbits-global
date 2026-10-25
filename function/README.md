
# MedOrbits Serverless Functions

**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Website:** https://www.medorbits.in/  
**Directory:** `function/`  
**Purpose:** Serverless backend functions, request processing, and external service integrations.

—

## 1. Overview

The `function/` directory organizes serverless backend functionality for MedOrbits. It is intended to separate request handling and integration logic from the website’s user interface.

Depending on the selected hosting platform, functions may support:

- Admission and education enquiries.
- Lead collection and contact submissions.
- Brochure and resource delivery.
- WhatsApp Business notifications.
- Request validation and spam prevention.
- Health and operational checks.
- External API integrations.
- Scheduled tasks, where supported by the hosting platform.

**Deployment warning:** A directory named `function/` is not automatically recognized by every hosting provider. Confirm the platform’s required directory convention and handler format before deployment. Some platforms use `functions/`, while Next.js App Router APIs normally use `app/api/` or `src/app/api/`.

## 2. Recommended Directory Structure

```text
function/
├── README.md
│
└── api/
    ├── README.md
    ├── lead.js
    ├── contact.js
    ├── download.js
    ├── health.js
    │
    └── shared/
        ├── README.md
        ├── response.js
        ├── validation.js
        ├── security.js
        └── whatsapp.js
```

This is a suggested structure, not a claim that every listed file already exists.

Keep reusable utilities in a shared module instead of duplicating validation, response formatting, and security checks across handlers.

## 3. Relationship to the Next.js Application

MedOrbits may use Next.js route handlers under `app/api/` as well as serverless functions under `function/api/`.

These are separate implementation conventions. They should not be assumed to expose the same URLs or share the same runtime behavior.

| Component | Responsibility |
|—|—|
| `app/` or `src/app/` | Next.js pages, layouts, and route handlers |
| `app/api/` or `src/app/api/` | Next.js API endpoints |
| `function/api/` | Platform-specific serverless handlers |
| `public/` | Public website assets and approved public resources |
| `tests/` | Automated tests and integration checks |
| `.env.example` | Documented environment-variable names without secrets |

### Route ownership

Define one canonical implementation for each public endpoint.

For example, if `/api/contact` is implemented by `app/api/contact/route.js`, do not create a second handler for that endpoint without an explicit routing, proxying, or migration plan.

Duplicate route ownership can cause inconsistent validation, confusing deployments, and different behavior between development and production.

## 4. Runtime Requirements

The MedOrbits project targets:

- Node.js 20 or newer.
- A supported package manager.
- A hosting provider compatible with the chosen serverless implementation.
- Environment-variable configuration for server-side secrets.
- Automated tests for critical request handlers.

The precise runtime, memory limit, execution timeout, and file-system behavior depend on the deployment platform.

Before implementing a function, verify whether the target runtime supports Node.js APIs, filesystem access, streaming responses, and the required external dependencies.

## 5. Environment Configuration

Use `.env.example` to document required environment variables.

Example:

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

# Request limits
MAX_BODY_BYTES=20000
MAX_MESSAGE_LENGTH=5000

# Optional resource delivery configuration
DOWNLOADS_DIRECTORY=public/downloads
DOWNLOAD_MAX_FILE_BYTES=52428800
```

These variables are illustrative. Individual functions should read only the variables they actually require.

### Secret management

1. Store production credentials in the hosting provider’s secret or environment-variable settings.
2. Never commit real access tokens, passwords, private keys, or database credentials.
3. Do not expose server-only secrets through `NEXT_PUBLIC_*` variables.
4. Keep development, testing, and production credentials separate.
5. Rotate any credential that may have been exposed.
6. Validate required configuration before performing sensitive operations.

## 6. Function Development Standards

Every serverless function should:

1. Validate the HTTP method.
2. Validate content type and request-body size.
3. Parse request bodies safely.
4. Validate required fields, types, formats, and maximum lengths.
5. Enforce authorization for protected operations.
6. Apply rate limiting and anti-abuse controls where appropriate.
7. Use explicit timeouts for outbound network requests.
8. Return consistent HTTP status codes.
9. Avoid disclosing internal errors or sensitive configuration.
10. Avoid logging unnecessary personal information.
11. Handle retries and duplicate submissions safely.
12. Include automated tests and endpoint documentation.

### Request processing

Do not trust browser-side validation alone. A client can submit arbitrary HTTP requests without using the website’s forms.

Request-size limits must be enforced before an unrestricted body is fully buffered into memory.

### External services

When calling external services:

- Validate the upstream response.
- Apply appropriate timeouts.
- Limit retries.
- Avoid retrying non-idempotent operations blindly.
- Handle rate limits and provider outages.
- Keep credentials out of responses and logs.
- Distinguish an accepted request from a confirmed completed operation.

## 7. API Response Convention

A recommended success response:

```json
{
  “success”: true,
  “message”: “Your request has been received.”
}
```

A recommended validation response:

```json
{
  “success”: false,
  “error”: “invalid_request”,
  “message”: “Please check the submitted information.”
}
```

A recommended service-failure response:

```json
{
  “success”: false,
  “error”: “service_unavailable”,
  “message”: “The service is temporarily unavailable.”
}
```

Individual handlers may require additional fields, but public errors should remain safe and predictable.

### HTTP status codes

| Status | Usage |
|—|—|
| `200` | Successful operation |
| `201` | Resource created |
| `204` | Successful operation without a response body |
| `400` | Malformed request |
| `401` | Authentication required |
| `403` | Access denied |
| `404` | Resource not found |
| `405` | Unsupported HTTP method |
| `413` | Request body too large |
| `415` | Unsupported media type |
| `422` | Request fields fail validation |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal failure |
| `502` | Upstream service failure |
| `503` | Service unavailable |

Use status codes consistently with the actual handler contract.

## 8. Security and Privacy

### Input validation

- Validate all user-controlled values.
- Reject unexpected event types.
- Restrict resource identifiers to an allowlist.
- Never use user input directly as a filesystem path.
- Validate URLs before using them in redirects or outbound requests.
- Apply limits to strings, arrays, and uploaded files.

### Authentication and authorization

Public contact forms may not require user authentication, but private document access, administrative actions, and user-specific operations require appropriate authorization.

Do not use CORS or an `Origin` header as a substitute for authentication.

### Rate limiting and abuse prevention

Consider distributed rate limiting, bot verification, and abuse monitoring for public endpoints.

In serverless environments, in-memory counters are not reliable as a global rate limiter because requests may be handled by different instances.

### Personal information

MedOrbits may process names, phone numbers, email addresses, admission enquiries, and employment-related information.

Apply data minimization, restricted access, retention limits, secure transport, and the applicable privacy policy. Do not log full enquiry messages or confidential documents unless a documented operational requirement justifies it.

## 9. File Handling

Functions that handle files must enforce explicit upload and download policies.

For uploads:

- Enforce size limits.
- Validate file content and supported formats.
- Generate safe server-side filenames.
- Store confidential files outside publicly served directories.
- Apply malware scanning where appropriate.

For downloads:

- Allow only approved resources.
- Keep private files behind authorization.
- Use safe `Content-Disposition` headers.
- Prevent path traversal.
- Avoid loading large files into memory unnecessarily.
- Use object storage when appropriate for large or frequently updated resources.

Never place confidential student records, identity documents, or private admission applications in a publicly accessible download directory.

## 10. WhatsApp Business Integration

Functions that use the WhatsApp Business Cloud API should:

1. Validate the incoming request.
2. Verify consent and configured anti-abuse controls.
3. Validate the required server-side configuration.
4. Use approved templates when required.
5. Match template parameters to the approved template definition.
6. Handle provider failures and timeouts.
7. Avoid exposing provider credentials or raw internal error responses.
8. Record operational outcomes without unnecessarily logging personal data.

### Lead retention

Sending an enquiry through WhatsApp does not constitute durable storage.

If losing a lead is unacceptable, implement persistent database storage and a reliable delivery workflow with retries and idempotency controls.

## 11. Health Monitoring

A health endpoint can help deployment infrastructure verify service availability.

If the project uses `app/api/health/route.js`, keep that endpoint’s routing and runtime configuration consistent with the deployed Next.js application.

Distinguish between:

- **Liveness:** the application process or handler is responsive.
- **Readiness:** required dependencies are available.
- **End-to-end monitoring:** a controlled test verifies that an important user workflow works.

Do not make a public health endpoint expose credentials, database connection details, or internal infrastructure information.

## 12. Testing

Critical functions should have automated tests covering:

- Valid requests.
- Missing or invalid fields.
- Malformed JSON.
- Unsupported methods and content types.
- Oversized request bodies.
- Authorization failures.
- Invalid origins where applicable.
- Rate limiting and anti-bot failures.
- Missing environment variables.
- External service failures and timeouts.
- Duplicate submissions.
- Safe error responses.
- Unauthorized file access.

Mock external services in ordinary unit tests. Use isolated test credentials and explicit controls for any integration tests that can send real notifications.

Run the project’s configured test suite:

```bash
npm test
```

If the project uses Vitest directly, a typical command is:

```bash
npx vitest run
```

Use the actual scripts defined in `package.json`.

## 13. Local Development

From the project root:

```bash
npm install
```

Configure local environment variables in `.env.local` and start the application:

```bash
npm run dev
```

Test the deployed function URL separately from the local Next.js route. A local route working correctly does not prove that the serverless hosting adapter is configured correctly.

## 14. Deployment Checklist

Before deploying:

- [ ] Confirm the hosting provider’s function directory convention.
- [ ] Confirm the expected handler export format.
- [ ] Ensure public endpoints have one canonical route owner.
- [ ] Configure required environment variables.
- [ ] Verify Node.js and package-manager compatibility.
- [ ] Enforce request-size limits and execution timeouts.
- [ ] Configure rate limiting and bot protection where appropriate.
- [ ] Verify that private documents cannot be accessed publicly.
- [ ] Run lint, tests, and the production build.
- [ ] Review dependency vulnerabilities.
- [ ] Check that logs do not expose secrets or unnecessary personal information.
- [ ] Test deployed URLs and provider integrations.
- [ ] Configure monitoring and alerting.
- [ ] Verify rollback procedures.

## 15. Troubleshooting

### Function returns 404

Check the deployment platform’s required directory structure, function export convention, route configuration, and deployed URL.

### Function returns 500

Inspect server-side logs for missing configuration, runtime incompatibilities, unhandled exceptions, or upstream provider failures. Do not return stack traces to public clients.

### External notifications fail

Verify the credentials, recipient format, approved template, template parameters, provider limits, and upstream response.

### Works locally but fails after deployment

Check environment variables, runtime compatibility, filesystem packaging, execution timeouts, networking restrictions, and route ownership.

### Duplicate or inconsistent API behavior

Check whether the same public URL is implemented in multiple places, such as `app/api/` and `function/api/`. Consolidate route ownership or configure an explicit proxy strategy.

—

## 16. Reference Documentation

- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Next.js Environment Variables: https://nextjs.org/docs/app/guides/environment-variables
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Vercel Functions: https://vercel.com/docs/functions
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Cloudflare Turnstile: https://developers.cloudflare.com/turnstile/

—

**Maintainer:** MedOrbits Engineering  
**Directory:** `function/`  
**Status:** Architecture and implementation guidance

Update this document whenever function conventions, route ownership, runtime requirements, environment variables, or security controls change.
