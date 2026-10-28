# API Contract Testing and Release Checklist

## 1. General tests

- [ ] Every endpoint has a documented method, path, authentication rule, request schema, response schema, and error behavior.
- [ ] Success and error envelopes are consistent.
- [ ] Timestamps and currency formats are validated.
- [ ] Pagination limits and cursor behavior are tested.
- [ ] Unknown fields and invalid enum values follow the documented policy.
- [ ] Request IDs are available for diagnostics.
- [ ] No endpoint returns secrets or internal stack traces.

## 2. Authentication tests

- [ ] Missing token returns 401 for private endpoints.
- [ ] Invalid and expired tokens are rejected.
- [ ] Logout and refresh behavior matches the chosen identity architecture.
- [ ] Rate limits are applied.
- [ ] Authentication failures do not unnecessarily reveal account existence.

## 3. Authorization tests

- [ ] User A cannot read User B's application.
- [ ] User A cannot download User B's document.
- [ ] User A cannot view User B's payment.
- [ ] User A cannot mark User B's notification read.
- [ ] Applicant roles cannot invoke admin operations.
- [ ] Client-supplied role, status, verification, and approval fields are rejected or ignored safely.

## 4. Admissions tests

- [ ] Unpublished records are not exposed.
- [ ] Filters and pagination are validated.
- [ ] Unknown deadlines remain unknown.
- [ ] Unknown fees are not represented as zero.
- [ ] Factual data has an auditable source/verification process.
- [ ] Eligibility results distinguish insufficient information from a final decision.

## 5. Application tests

- [ ] Draft creation validates references and required consent.
- [ ] Draft updates enforce ownership and editable fields.
- [ ] Submitted applications cannot be edited outside permitted workflows.
- [ ] Closed-deadline submissions are rejected.
- [ ] Required documents are checked server-side.
- [ ] Duplicate submission retries are handled safely.
- [ ] State transitions are validated and audited.

## 6. Document tests

- [ ] Upload size and type restrictions are enforced.
- [ ] Content is validated beyond filename extension.
- [ ] Malware scanning is applied where supported.
- [ ] Storage is private.
- [ ] Download authorization is checked on every request.
- [ ] Expired download links cannot be reused.
- [ ] Deletion and replacement follow retention and workflow rules.

## 7. Payment tests

- [ ] The server calculates the authoritative amount.
- [ ] Client callbacks alone cannot mark payment successful.
- [ ] Provider signatures are verified.
- [ ] Duplicate and out-of-order provider events are handled.
- [ ] Payment-intent creation is idempotent where supported.
- [ ] Refund states are verified and audited.
- [ ] Sensitive payment data is not logged.

## 8. Notifications tests

- [ ] Users see only their own notifications.
- [ ] Push payloads avoid sensitive information.
- [ ] Duplicate push messages are handled.
- [ ] Device tokens can be revoked.
- [ ] Notification preferences are respected.

## 9. Tooling and release

- [ ] Validate `openapi.yaml` with a compatible OpenAPI 3.1 validator.
- [ ] Run backend unit and integration tests.
- [ ] Run negative authorization tests.
- [ ] Run secret and dependency scans.
- [ ] Verify migrations and deployment configuration separately.
- [ ] Confirm documented endpoints match actual routes.
- [ ] Review breaking changes and versioning.
- [ ] Obtain product/security approval before production release.
