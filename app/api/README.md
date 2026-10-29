
# MedOrbits API

**Directory:** `/app/api/`  
**Framework:** Next.js App Router  
**Runtime:** Node.js for database-dependent handlers  
**Primary database:** PostgreSQL  
**Purpose:** Central documentation for MedOrbits API routes, request validation, integrations, security, and testing.

## 1. Overview

The `/app/api/` directory contains server-side API endpoints used by the MedOrbits website and its associated services.

The API may support:

- Contact form submissions
- Education and admission enquiries
- Payment processing and verification
- Secure document downloads
- Health and service availability checks
- Future integrations with colleges, courses, and consultancy services

Each endpoint must validate incoming requests, handle errors safely, and return consistent HTTP responses.

## 2. Directory structure

```text
app/api/
├── README.md
├── contact/
│   ├── route.js
│   └── README.md
├── download/
│   ├── route.js
│   └── README.md
├── health/
│   ├── route.js
│   └── README.md
├── lead/
│   ├── route.js
│   ├── route.test.js
│   └── README.md
└── payment/
    ├── route.js
    └── README.md
```

This is the intended structure, not a guarantee that every listed file already exists. Add optional route handlers and tests only when their implementations are available.

**Next.js convention:** Use `route.js` for App Router handlers. A file named `routes.js` does not automatically register an API endpoint.

## 3. Endpoint inventory

| Endpoint | Purpose | Expected method |
|—|—|—|
| `/api/health` | Service health check | `GET` |
| `/api/contact` | Submit a contact enquiry | `POST` |
| `/api/lead` | Submit a course or admission enquiry | `POST` |
| `/api/payment` | Initiate a payment | `POST` |
| `/api/download` | Retrieve an approved downloadable file | `GET` |

The endpoint inventory must be updated whenever routes are added, renamed, or removed.

Payment verification, webhooks, and payment status endpoints should be documented separately once implemented.

## 4. Common response conventions

Use JSON responses for API requests unless the endpoint intentionally returns a file or another content type.

Example successful response:

```json
{
  “success”: true,
  “message”: “Request completed successfully.”
}
```

Example validation error:

```json
{
  “success”: false,
  “error”: “Invalid request.”
}
```

Do not expose database errors, stack traces, internal paths, secrets, or provider credentials to clients.

### Recommended HTTP status codes

| Status | Usage |
|—|—|
| `200` | Request completed successfully |
| `201` | Resource created |
| `400` | Invalid request data |
| `401` | Authentication required |
| `403` | Request not permitted |
| `404` | Resource not found |
| `405` | HTTP method not supported |
| `409` | Resource conflict |
| `413` | Request body too large |
| `415` | Unsupported media type |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |
| `503` | Required service unavailable |

Use only the statuses appropriate to each route’s actual behavior.

## 5. Environment configuration

API routes may depend on database connections, payment gateways, and trusted website origins.

Example `.env.example` entries:

```dotenv
NODE_ENV=development
DATABASE_URL=
ALLOWED_ORIGINS=http://localhost:3000
DOWNLOAD_ROOT=private-downloads
DOWNLOAD_ALLOWLIST=
```

Payment-specific variables must be documented in `payment/README.md` and included in the root environment template only when the corresponding integration is implemented.

### Configuration rules

- Keep real credentials in environment variables or a secret manager.
- Never commit `.env` files containing real credentials.
- Validate required configuration at runtime or during application startup.
- Use secure database settings in production.
- Do not assume a configured environment variable means the associated service is working.
- Document all environment variables and their expected formats.

## 6. Database conventions

The API uses PostgreSQL for persistent records where configured.

Recommended practices:

- Use parameterized queries.
- Apply version-controlled database migrations.
- Add appropriate indexes and uniqueness constraints.
- Validate data before database insertion.
- Use transactions for operations that must succeed or fail together.
- Set connection and query timeouts.
- Avoid creating a new connection pool for every request.
- Handle unavailable database connections without exposing internal errors.

Document table definitions and migrations alongside the relevant feature or in the repository’s database directory.

## 7. Request validation

Every endpoint must validate incoming requests on the server.

Validation should include, where relevant:

- Supported HTTP method
- Content type
- Request body size
- JSON syntax
- Expected object structure
- Required fields and data types
- String length and format
- Numeric ranges
- Identifiers and ownership
- Allowed values and state transitions

Do not rely exclusively on browser-side validation.

Normalize user input where appropriate, but do not silently transform invalid input in ways that change its intended meaning.

## 8. Security requirements

### General API security

- Use HTTPS in production.
- Apply least-privilege database credentials.
- Validate all untrusted input.
- Use parameterized database queries.
- Add rate limiting and abuse protection to public endpoints.
- Apply authentication and authorization to private operations.
- Avoid exposing personally identifiable information in logs.
- Return generic public error messages.
- Maintain audit logs for sensitive operations where appropriate.

### Cross-origin requests

Configure a strict origin allowlist when browser-based cross-origin access is required.

CORS and `Origin` validation are not authentication. Requests can be made by scripts and other HTTP clients without a browser’s cross-origin restrictions.

### File downloads

- Resolve requested files within an approved storage directory.
- Reject path traversal and unexpected filenames.
- Use an explicit file allowlist where practical.
- Enforce file-size limits.
- Require authentication or signed access where files are private.
- Do not assume a hard-to-guess URL is secure.

### Payments

- Determine prices on the server.
- Verify transactions through the selected payment provider.
- Validate provider signatures and webhooks.
- Handle repeated events idempotently.
- Never trust client-submitted payment status.
- Never store CVVs, PINs, or raw payment-card credentials.

## 9. Privacy and data retention

Contact forms and lead submissions may contain personal information.

The API should:

- Collect only information needed for the stated purpose.
- Display appropriate privacy notices and consent language.
- Restrict access to submitted enquiries.
- Define data-retention and deletion procedures.
- Protect backups and production logs.
- Avoid sending personal data to third parties without an appropriate legal basis.

## 10. Testing

Run the test scripts configured in the root `package.json`.

Example commands, depending on repository configuration:

```bash
npm test
npm run lint
npm run build
```

For each route, test:

- Valid requests
- Missing and malformed fields
- Unsupported methods
- Invalid content types
- Oversized request bodies
- Unauthorized requests
- Database and third-party service failures
- Unexpected exceptions
- Appropriate response status codes
- Protection against duplicate operations

Use mocked services for isolated unit tests and a dedicated test database for integration tests. Never run destructive integration tests against production data.

## 11. Local development

From the repository root:

```bash
npm install
```

Create a local `.env` file using `.env.example` as a reference. Configure only the services required for the routes you intend to test.

Start the application using the script defined in `package.json`, commonly:

```bash
npm run dev
```

Test the health endpoint if it exists:

```bash
curl -i http://localhost:3000/api/health
```

Test other endpoints according to their individual README files.

## 12. Deployment checklist

- [ ] All required route handlers exist.
- [ ] Route filenames follow Next.js App Router conventions.
- [ ] Environment variables are configured in the deployment platform.
- [ ] Database migrations have been applied.
- [ ] Secrets are not committed to source control.
- [ ] Public endpoints have suitable rate limiting.
- [ ] Private operations enforce authentication and authorization.
- [ ] Payment verification and download access controls are implemented where required.
- [ ] Unit and integration tests pass.
- [ ] Production build succeeds.
- [ ] Logs and monitoring are configured.
- [ ] API documentation matches the deployed implementation.

## 13. Monitoring and maintenance

Monitor API error rates, response times, database availability, failed payment verification, and suspicious request patterns.

Use structured logs with request IDs where practical. Never log passwords, API secrets, payment credentials, or unnecessary personal information.

Review dependencies and security advisories regularly. Keep route-level README files, tests, schemas, environment templates, and this document synchronized with the actual implementation.

## 14. Contribution rules

When adding an endpoint:

1. Create the route in the appropriate directory.
2. Implement server-side validation and safe error handling.
3. Add authentication and authorization where required.
4. Add unit or integration tests.
5. Document request and response formats.
6. Update the endpoint inventory in this README.
7. Update `.env.example` for any new configuration.
8. Run the repository’s available checks before submitting changes.

**Maintenance principle:** Documentation describes intended and verified behavior; it must not claim that an endpoint, security control, integration, or test exists until the corresponding implementation has been confirmed.
