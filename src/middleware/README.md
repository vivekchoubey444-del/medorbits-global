
# MedOrbits — Middleware Architecture and Security Contract

**Directory:** `src/middleware/`  
**Runtime:** Node.js ≥ 20  
**Framework:** Express.js  
**Purpose:** Centralized request processing, authentication, authorization, validation, security controls, and error handling.

## 1. Purpose and Scope

The MedOrbits middleware layer provides reusable security and operational controls for the Express application.

Middleware is mounted explicitly through `server.js`, `src/app.js`, or individual route modules. Each component must have a documented contract, validated configuration, predictable error behavior, and tests.

**Security principle:** a middleware file existing in the repository does not prove that it is configured, mounted, or protecting a route.

This document defines the intended architecture. Actual filenames, exports, configuration options, and behavior must match the implementation.

## 2. Middleware Inventory

| Module | Responsibility |
|—|—|
| `authenticate.js` | Verify bearer JWTs and establish a trusted request identity. |
| `authorize.js` | Enforce role, permission, and custom ownership requirements. |
| `validate.js` | Validate request bodies, parameters, queries, or multiple request targets. |
| `rate-limit.js` | Provide configurable rate-limit factories for sensitive endpoints. |
| `csrf.js` | Protect applicable cookie-authenticated requests against CSRF. |
| `error-handler.js` | Normalize errors and return safe client responses. |
| `not-found.js` | Handle unmatched routes consistently. |
| `request-id.js` | Generate or accept approved request correlation IDs. |
| `request-logger.js` | Record structured request metadata without sensitive payloads. |
| `security-headers.js` | Configure HTTP security headers through Helmet. |
| `upload.js` | Apply Multer limits and normalize upload errors. |
| `verify-webhook.js` | Verify raw-body HMAC signatures when compatible with the provider specification. |
| `maintenance.js` | Restrict normal traffic during maintenance while preserving configured health endpoints. |

Do not document `upload-limits.js` as the active filename unless that file actually exists or the module is renamed.

## 3. Dependencies and Configuration

Install only dependencies used by the enabled middleware:

```bash
npm install jsonwebtoken express-rate-limit helmet cookie-parser multer
```

Install schema-validation packages only when required by the application:

```bash
npm install zod joi
```

Configuration must be validated at startup wherever practical.

| Configuration | Purpose |
|—|—|
| `JWT_SECRET` | JWT signing/verification secret when using symmetric signing. |
| `CSRF_SECRET` | Secret for signed CSRF tokens. |
| `SESSION_SECRET` | Session-related secret; use as a CSRF fallback only when the configuration is intentionally shared. |
| `PAYMENT_WEBHOOK_SECRET` | Provider webhook secret for a compatible HMAC scheme. |
| `NODE_ENV` | Environment-dependent behavior. |
| `MAINTENANCE_MODE` | Enables maintenance mode when set to `true`. |

Keep secrets in the deployment environment or an approved secret manager. Never commit secrets to source control, expose them through frontend configuration, or include them in logs.

For multi-instance deployments, use a shared rate-limit store, such as Redis. An in-memory store does not coordinate limits across instances.

## 4. Authentication and Authorization

### 4.1 Authentication

`authenticate.js` verifies bearer tokens using `jsonwebtoken` and establishes the trusted `req.user` identity.

Required controls:

- Reject missing, malformed, expired, or invalid tokens.
- Restrict accepted signing algorithms.
- Validate issuer, audience, expiration, and relevant claims.
- Load the current user from a trusted data source when required.
- Reject disabled, suspended, deleted, or otherwise ineligible accounts.
- Never trust identity, roles, or permissions supplied in request bodies or arbitrary headers.
- Avoid logging tokens, authorization headers, or complete JWT claims.

For immediate logout, account revocation, or role-change propagation, implement session/version checks, token revocation, or an equivalent application control.

Opaque session authentication requires a session-aware implementation; it must not be treated as JWT authentication.

### 4.2 Authorization

`authorize.js` provides route-level checks. The resource-specific `src/policies/` modules determine whether an actor may perform an operation on a particular resource.

Use the layers together:

1. Authenticate the request.
2. Enforce general route permissions.
3. Load the resource from a trusted data source.
4. Evaluate the applicable resource policy.
5. Validate permitted field changes and state transitions.
6. Perform the operation through the service layer.
7. Record security-relevant audit events.

Do not rely on roles alone for ownership-sensitive operations involving applications, documents, candidates, employers, payments, subscriptions, or other private records.

**Important:** authorization must fail closed. A missing resource, malformed identity, policy error, or unresolved ownership relationship must not grant access.

## 5. Request Validation and Mass Assignment

`validate.js` supports the validation interfaces implemented for Zod, Joi, and custom validators.

Validate:

- Request bodies and nested objects.
- Route identifiers and parameters.
- Query filters, pagination, and sorting.
- Dates, numeric ranges, enumerations, and arrays.
- Fields that control resource status or ownership.
- Upload-related parameters and metadata.

Use strict schemas and explicit writable-field allowlists for create and update operations.

Never blindly spread untrusted request objects into database updates:

```javascript
// Avoid
await repository.update(id, req.body);

// Prefer an explicit, validated field allowlist
const changes = {
  title: validated.title,
  description: validated.description,
};

await repository.update(id, changes);
```

The example is illustrative; use the actual repository and validated schema interfaces in MedOrbits.

Validation does not replace authorization, business-rule enforcement, SQL parameterization, or output encoding.

## 6. Rate Limiting and Abuse Prevention

`rate-limit.js` provides configurable limiter factories, including authentication, upload, password-reset, and general API limits.

Apply endpoint-specific limits to:

- Login, registration, and account recovery.
- OTP issuance and verification.
- Public search, enquiries, and contact forms.
- Uploads and resource-intensive processing.
- Payment initiation and other abuse-sensitive actions.

Requirements:

- Configure trusted proxy handling correctly.
- Use a shared store for multi-instance deployments.
- Avoid client-controlled identity values as rate-limit keys.
- Monitor store failures and define a deliberate failure policy.
- Combine rate limits with account-level quotas and abuse detection where appropriate.

Rate limiting is not a replacement for authentication or authorization.

## 7. CSRF Protection and Cookie Security

`csrf.js` implements a signed double-submit cookie/token design for applicable cookie-authenticated requests.

Required controls:

- Parse cookies before token verification.
- Issue tokens through a trusted application route or page.
- Require the corresponding token in the configured request header.
- Verify both token equality and the server-side signature.
- Protect relevant state-changing methods.
- Configure `Secure`, `SameSite`, cookie scope, and token delivery deliberately.
- Apply origin validation where appropriate.

A double-submit design must be implemented correctly. Merely comparing two client-provided strings is insufficient.

Bearer-token-only APIs generally do not need CSRF protection when credentials are not automatically attached by the browser. They still require authentication, authorization, and appropriate CORS controls.

Never exempt a route simply because it is called an API. Verified webhooks and other non-cookie-authenticated routes require explicit, documented handling.

## 8. Error Handling and HTTP Responses

`error-handler.js` must be mounted last, after application routes and the 404 middleware.

Expected behavior:

- Return valid HTTP status codes.
- Use stable application error codes.
- Avoid exposing internal 5xx messages, stack traces, SQL details, secrets, or provider responses.
- Include a validated request ID when available.
- Log operational errors without recording sensitive request content.
- Handle parser, validation, authentication, authorization, upload, and database errors consistently.
- Delegate to Express when response headers have already been sent.

Only trusted application errors should supply client-facing details. Never expose arbitrary `error.message`, `error.details`, or `error.publicMessage` without an explicit trust contract.

Ensure the response helper used by the application follows the same security contract.

### HTTP status conventions

| Status | Meaning |
|—|—|
| `400` | Malformed request or invalid syntax. |
| `401` | Authentication is missing or invalid. |
| `403` | The actor is authenticated but not permitted. |
| `404` | Resource or route not found, including concealed resources where appropriate. |
| `409` | State or uniqueness conflict. |
| `413` | Payload or file exceeds allowed limits. |
| `415` | Unsupported media or file type. |
| `422` | Semantically invalid input, if adopted consistently. |
| `429` | Rate limit exceeded. |
| `503` | Maintenance or temporary service unavailability. |
| `500` | Unexpected internal failure. |

Use one consistent convention for validation errors; do not alternate arbitrarily between `400` and `422`.

## 9. Request IDs and Structured Logging

### Request IDs

`request-id.js` establishes a correlation ID for each request.

- Generate a cryptographically random identifier when no trusted upstream ID is available.
- Validate incoming IDs against a documented format and length limit.
- Trust incoming IDs only when the proxy or gateway overwrites client-supplied values.
- Use the resolved ID consistently in logs and error responses.

A request ID is not an authentication credential, authorization token, or proof of identity.

### Request logging

`request-logger.js` should record only operational metadata necessary for diagnostics:

- Request ID.
- HTTP method and path.
- Response status.
- Request duration.
- Approved user identifier, where needed.
- Event type and error classification, where applicable.

Do not log query strings, passwords, authorization headers, cookies, session identifiers, raw webhook bodies, payment credentials, or private document contents.

Redact user-controlled values and ensure logging failures do not break normal request processing.

Use a centralized logging service and define retention, access control, and alerting policies for production.

## 10. Security Headers

`security-headers.js` uses Helmet to configure HTTP security headers.

Review and test:

- Content Security Policy.
- Cross-origin resource policies.
- Framing restrictions.
- MIME-sniffing protection.
- Referrer policy.
- HTTPS transport security.

CSP must reflect the actual frontend, assets, APIs, and integrations. Avoid broad wildcard origins and unsafe directives unless there is a reviewed requirement.

Enable HSTS only when HTTPS and hostname coverage are correctly configured. Do not weaken a security header merely to bypass an integration issue.

## 11. File Upload Security

`upload.js` uses Multer and applies upload limits.

Before accepting files into persistent storage:

1. Enforce file-size, file-count, field-count, and request-size limits.
2. Validate the permitted file type.
3. Inspect file signatures and content instead of trusting client MIME types.
4. Scan for malware where required.
5. Generate server-controlled storage keys and filenames.
6. Store private documents outside the public web root or in approved private object storage.
7. Enforce authorization for upload, preview, download, replacement, and deletion.
8. Define retention, deletion, and audit requirements.

Memory storage can exhaust process memory under concurrency. Use conservative limits and concurrency controls; consider streaming to private storage for larger files.

A successful Multer upload does not establish that a file is safe.

## 12. Payment Webhook Verification

`verify-webhook.js` supports HMAC-SHA256 verification only when the provider’s official specification matches the implemented scheme.

For each provider:

- Follow the exact signing algorithm, header format, and canonicalization rules.
- Preserve the original raw request bytes used for signature verification.
- Implement timestamp validation and replay protection where required.
- Compare signatures securely.
- Reject invalid signatures before parsing or processing the event.
- Validate event type and resource identifiers.
- Enforce event-ID idempotency.
- Update payment state through trusted, transaction-safe services.
- Record audit events without logging secrets or raw payloads.

Register the raw-body capture and provider-specific verification path before middleware consumes or transforms the body.

**Never assume the generic HMAC verifier is compatible with Stripe, Razorpay, or another provider without checking that provider’s current specification.**

Signature verification alone does not prevent duplicate event processing or establish that a payment state transition is valid.

## 13. Maintenance and Health Endpoints

`maintenance.js` restricts normal application traffic while allowing explicitly configured exemptions.

Separate health behavior into:

- **Liveness:** the process can respond.
- **Readiness:** the instance is ready to accept traffic and required dependencies are available.
- **Maintenance:** normal application operations are intentionally restricted.

Keep only the required health endpoints exempt. Avoid exposing credentials, detailed infrastructure information, or sensitive dependency diagnostics in public responses.

Ensure the deployment platform’s health checks agree with the application’s readiness and maintenance behavior.

## 14. Recommended Express Middleware Order

The actual order must be verified against the application bootstrap and route requirements.

A typical arrangement is:

1. Configure `trust proxy` for the actual deployment topology, if required.
2. Install request ID middleware.
3. Install request logging.
4. Install security headers.
5. Configure CORS.
6. Install cookie parsing when needed.
7. Install bounded request-body parsers.
8. Mount maintenance and appropriate rate limiters.
9. Mount route-specific authentication and authorization.
10. Validate route inputs.
11. Execute routes and service operations.
12. Mount `not-found.js`.
13. Mount `error-handler.js`.

### Webhook exception

Webhook routes must preserve the exact raw request body. Configure raw-body capture and provider-specific signature verification before a general parser consumes the payload, according to the provider’s requirements.

Keep webhook middleware and routing explicit rather than relying on a broad, undocumented global exception.

## 15. Example Route Integration

Confirm the actual export signatures before applying this example.

```javascript
‘use strict’;

const express = require(‘express’);

const authenticate = require(‘./middleware/authenticate’);
const authorize = require(‘./middleware/authorize’);

const router = express.Router();

router.get(
  ‘/me’,
  authenticate(),
  (req, res) => {
    // Return an approved response DTO, not the complete user object.
    return res.json({
      success: true,
      data: {
        id: req.user.id,
        role: req.user.role,
      },
      requestId: req.id || null,
    });
  }
);

router.post(
  ‘/admin-task’,
  authenticate(),
  authorize({ roles: [‘admin’] }),
  async (req, res, next) => {
    try {
      // Invoke the actual authorized service operation here.
      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
```

Role checks alone are insufficient for resource-specific access. Use the corresponding policy and service checks for sensitive operations.

## 16. Automated Test Requirements

Each middleware should have unit tests for its own contract and integration tests for its actual placement in Express.

Minimum coverage:

- Missing, malformed, expired, and invalid authentication credentials.
- Disabled users and invalid identity records.
- Role and permission denials.
- Ownership and protected-field enforcement.
- Invalid body, parameter, and query input.
- Malformed and oversized requests.
- Rate-limit threshold behavior and shared-store configuration.
- Missing, mismatched, and invalid CSRF tokens.
- Safe error responses and request ID consistency.
- Logging redaction and client disconnects.
- Security header configuration.
- Oversized, disallowed, and malformed uploads.
- Invalid webhook signatures and duplicate event IDs.
- Maintenance behavior and health endpoint availability.
- Unknown routes and centralized error handling.

Tests must use isolated test configuration and mocked or dedicated test dependencies. They must not trigger real payments, send production OTPs, or access production data.

## 17. Production Release Checklist

- [ ] Actual middleware filenames and exports match this contract.
- [ ] All protected routes are mounted behind authentication.
- [ ] Resource-specific policies are applied where required.
- [ ] Write operations use validated schemas and field allowlists.
- [ ] Secrets are securely configured and never logged.
- [ ] JWT/session revocation behavior is documented.
- [ ] Rate limits are appropriate and shared across instances where necessary.
- [ ] CSRF is correctly configured for cookie-authenticated flows.
- [ ] CORS, proxy trust, and security headers match the deployment.
- [ ] Error responses do not disclose internal implementation details.
- [ ] Request IDs and logs are consistent and sanitized.
- [ ] Uploads are inspected and stored privately.
- [ ] Webhooks use provider-compatible verification and idempotency.
- [ ] Health checks and maintenance exemptions are tested.
- [ ] Middleware ordering is verified in the actual bootstrap.
- [ ] Unit and integration tests pass in CI.
- [ ] Dependency advisories and deployment configuration are reviewed.

## 18. Maintenance Contract

Update this document whenever a middleware export, configuration option, security assumption, or mounting requirement changes.

For each module, maintain:

- A clear export contract.
- Validated configuration.
- Explicit failure behavior.
- Unit tests.
- Integration coverage.
- A documented security boundary.

**Final requirement:** verify the implementation and actual route coverage before claiming MedOrbits is production-ready. Documentation describes the intended controls; only tested, correctly configured middleware provides them.
