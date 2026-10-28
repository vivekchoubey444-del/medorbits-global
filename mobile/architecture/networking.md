# Networking and API Client

## 1. Single API client

Use one configured API client for base URL, headers, serialization, timeouts, request IDs, authentication, error parsing, and telemetry. Feature code should use typed repositories rather than constructing arbitrary URLs.

## 2. Configuration

Keep separate development, test, staging, and production configurations. Production base URLs must not be silently replaced with development endpoints. Never embed server secrets in the mobile application; client binaries can be inspected.

## 3. Timeouts and cancellation

Set explicit connection and response timeouts appropriate to each operation. Support cancellation for search and screen-scoped reads. Do not cancel uploads or submissions without preserving their state and explaining the outcome.

## 4. Authentication middleware

- Attach access credentials only to approved API origins.
- Never send credentials to arbitrary URLs returned by content or deep links.
- Centralize refresh behavior if refresh tokens are used.
- Prevent concurrent requests from triggering uncontrolled refresh storms.
- If refresh fails, clear the session safely and require reauthentication.
- Never log authorization headers.

## 5. Retry policy

Safe reads may use bounded retries for transient network failures and selected server errors.

Do not blindly retry:
- Application submission
- Payment-intent creation
- Refund requests
- Document mutation
- Any non-idempotent action

Use server-supported idempotency keys where appropriate. Honor `Retry-After` for rate limiting. Apply exponential backoff with jitter and a maximum attempt count.

## 6. Response handling

Map HTTP responses to typed application errors. Validate response shapes and tolerate documented optional fields. Treat malformed responses as protocol errors, not as empty successful data.

Suggested error categories:
- `networkUnavailable`
- `timeout`
- `unauthenticated`
- `forbidden`
- `notFound`
- `validation`
- `conflict`
- `rateLimited`
- `serverFailure`
- `protocolFailure`
- `cancelled`

## 7. Request metadata

Attach a correlation/request ID if supported. Do not send unnecessary device identifiers or personal data. Keep telemetry minimal and privacy-reviewed.

## 8. File uploads

Use only configured upload hosts. Validate file size and type client-side for usability, while relying on server-side validation for security. Support progress and cancellation states. A failed or interrupted upload must not be displayed as accepted.

## 9. Caching

Use explicit cache policies per endpoint. Never cache private API responses in a shared/public cache. Invalidate or refresh application, document, and payment status after relevant mutations.

## 10. Testing

Test offline conditions, timeouts, expired tokens, malformed responses, server errors, rate limits, duplicate submission attempts, cancellation, and upload interruption.
