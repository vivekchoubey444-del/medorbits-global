# MedOrbits API Contracts

**Version:** 1.1.0  
**Status:** Proposed contract set  
**Scope:** Mobile application and backend API interfaces

This directory defines proposed contracts for MedOrbits mobile/backend integration. These documents do not prove that an endpoint is implemented. Before release, reconcile them with the actual server routes, controllers, middleware, database models, authentication provider, upload storage, and payment provider.

## Files

| File | Purpose |
|---|---|
| `README.md` | Index, implementation workflow, and contract governance |
| `common.md` | Shared conventions, response envelopes, pagination, dates, and idempotency |
| `errors.md` | Standard errors and HTTP status behavior |
| `authentication.md` | Sign-in, refresh, logout, and session handling |
| `users.md` | Current-user profile and account preferences |
| `admissions.md` | Admission opportunities, courses, institutions, and eligibility |
| `applications.md` | Application creation, editing, submission, and status history |
| `documents.md` | Document requirements, uploads, downloads, and deletion |
| `payments.md` | Fee quotes, payment initiation, confirmation, and refunds |
| `notifications.md` | In-app notifications, read state, and device registration |
| `webhooks.md` | Server-to-server event delivery and verification |
| `security.md` | Authorization, privacy, rate limits, and operational controls |
| `testing.md` | Contract tests and release checklist |
| `openapi.yaml` | Initial OpenAPI 3.1 contract for core endpoints |

## Contract rules

1. Use `/api/v1` as the proposed versioned base path.
2. Use HTTPS in deployed environments.
3. Use JSON for ordinary request/response bodies. Document upload endpoints may use `multipart/form-data` or a short-lived upload URL.
4. Authenticate private operations with `Authorization: Bearer <access-token>`.
5. Enforce object-level authorization on the server for every private resource.
6. Do not treat mobile-side validation as a security boundary.
7. Never invent admission dates, fees, eligibility requirements, official contact details, or institution status.
8. Use `null` or omit unavailable factual fields. An unknown fee is not zero; an unknown deadline does not mean applications are open.
9. Keep errors safe: do not return stack traces, SQL errors, tokens, secrets, or private reviewer notes.
10. Treat the contracts as proposed until matched to the implementation.

## Recommended implementation sequence

1. Confirm authentication strategy and session/token lifetimes.
2. Map these endpoints to existing backend routes and controllers.
3. Confirm database identifiers, status enums, and response envelope.
4. Implement shared validation and authorization middleware.
5. Implement application/document/payment state transitions server-side.
6. Add contract tests and negative authorization tests.
7. Generate or validate OpenAPI documentation from the implementation.
8. Update this contract whenever a breaking API change is made.

## Versioning

- Patch: clarifications and backward-compatible corrections.
- Minor: backward-compatible additions.
- Major: breaking contract changes.

Do not change a response field's meaning or remove a field in a patch release.

## Placeholder values

IDs, request IDs, emails, amounts, dates, and URLs in examples are illustrative. Replace them with actual values from verified data and the deployed environment. Never use example records as real admissions information.
