# API Security and Privacy Requirements

## 1. Authentication

- Validate authentication server-side on every private endpoint.
- Validate token signature, issuer, audience, expiry, and other required claims.
- Keep access tokens short-lived where appropriate.
- Protect refresh credentials using the selected identity architecture.
- Rate-limit login, OTP, password reset, refresh, and other sensitive endpoints.

## 2. Authorization

- Enforce object-level authorization for applications, documents, payments, and notifications.
- Do not trust IDs supplied by the client.
- Verify resource ownership and role permissions on every request.
- Do not expose private records through list filters or predictable IDs.
- Keep staff/admin privileges separate from applicant privileges.
- Never accept client-supplied role, approval, verification, or payment-status fields as authoritative.

## 3. Input validation

- Validate content type, request size, required fields, lengths, formats, enum values, and referenced records.
- Reject invalid state transitions.
- Apply upload-specific validation and malware scanning where supported.
- Protect against injection, path traversal, mass assignment, and unsafe deserialization.
- Do not use `eval` or execute client-provided code.

## 4. Sensitive data

- Minimize personal data collection.
- Never log passwords, bearer tokens, OTPs, raw payment credentials, or full document contents.
- Redact personal data from operational logs where possible.
- Encrypt data in transit and protect stored sensitive records.
- Use private storage for documents.
- Use short-lived, scoped access for downloads.
- Define retention and deletion rules before production.

## 5. Rate limits and abuse controls

Apply documented limits to authentication, eligibility assessment, search, uploads, submissions, payment operations, and notification/device endpoints. Return `429` with `Retry-After` when supported.

## 6. Error handling

- Use stable error codes.
- Do not return stack traces, database messages, secret values, or internal hostnames.
- Avoid revealing whether another user's resource exists.
- Include a safe request ID for support.

## 7. CORS and mobile clients

CORS is a browser control, not an authentication mechanism. Configure allowed origins for supported web clients. Do not assume a mobile application cannot be modified by an attacker.

## 8. Secrets and configuration

- Store secrets in environment configuration or a secret manager.
- Never commit real secrets to source control.
- Provide placeholders in `.env.example`, never production values.
- Rotate compromised credentials.
- Do not disable TLS certificate verification.

## 9. Audit trail

Record security-sensitive actions such as login failures, permission changes, application submissions, document review, payment state changes, and administrative actions. Keep logs access-controlled and retention-limited.

## 10. Release gate

Do not release until authentication, authorization, input validation, dependency scanning, secret scanning, upload security, and negative access-control tests have been reviewed.
