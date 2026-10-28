# Mobile Testing Strategy

## 1. Unit tests

Cover:
- Domain rules that are appropriate for client-side UX.
- Input formatting and validation.
- State transitions.
- Serialization and parsing.
- Retry and idempotency helpers.
- Localization formatting.
- Navigation/deep-link parsing.

Client-side eligibility checks must not be treated as authoritative server rules.

## 2. Repository and API tests

- Test repositories against mocked API responses.
- Validate request and response schemas against the OpenAPI contract.
- Test authentication expiry, malformed responses, timeouts, and rate limits.
- Ensure private resources cannot be accessed across users.
- Keep test credentials and records synthetic.

## 3. Integration tests

Cover login/logout, admissions discovery, application draft creation, draft update, submission, document upload, notification opening, and payment-provider sandbox flows where supported.

## 4. End-to-end tests

Prioritize critical journeys:
1. Browse an admission.
2. View verified requirements.
3. Sign in.
4. Create and save a draft.
5. Upload required documents.
6. Submit once.
7. View current status.
8. Handle action-required and error states.

Do not use real applicant documents or production payment credentials in automated tests.

## 5. Negative tests

- Expired session.
- Unauthorized application ID.
- Unauthorized document ID.
- Invalid state transition.
- Deadline passed.
- Missing required documents.
- Duplicate submit tap/retry.
- Interrupted upload.
- Stale cache.
- Invalid deep link.
- Payment callback not verified by backend.

## 6. Accessibility tests

Test screen readers, large text, contrast, focus order, forms, status announcements, and reduced motion on supported platforms.

## 7. Performance and resilience

Test slow networks, packet loss, offline startup, app background/foreground, low storage, large permitted files, cancellation, and stale responses.

## 8. Test environments

Use isolated development/test environments with synthetic data. Production data must not be copied into local test fixtures unless formally authorized and properly de-identified.

## 9. Release gate

All critical tests must pass. Document flaky tests, known issues, security exceptions, and migration risks rather than silently skipping them.
