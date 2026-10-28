# Client Error Handling

## 1. Goals

Errors should be consistent, actionable, accessible, and privacy-safe. Do not display raw backend exception text.

## 2. Error categories

- Network unavailable
- Request timeout
- Authentication required
- Permission denied
- Resource unavailable
- Validation error
- State conflict
- Rate limited
- Server failure
- Invalid response/protocol error
- Cancelled operation
- Unknown failure

## 3. User experience

- Preserve entered form data after recoverable errors.
- Show field-specific validation feedback when provided.
- Provide retry only when retrying is safe.
- For an ambiguous submission/payment timeout, query authoritative status before offering another action.
- Explain when cached information may be stale.
- Provide a support request ID where available.
- Make errors accessible to screen readers.

## 4. Retry rules

Reads may be retried with bounded backoff. Mutations must use idempotency or a status-check workflow before replay. Never automatically repeat payment/refund operations solely because the client did not receive a response.

## 5. Logging

Log safe categories, endpoint templates, status codes, durations, and request IDs. Redact tokens, query strings containing personal data, document URLs, and request bodies with sensitive fields.

## 6. Unknown errors

Show a generic message and a request ID if available. Preserve enough diagnostics for support without exposing internal details to the user.
