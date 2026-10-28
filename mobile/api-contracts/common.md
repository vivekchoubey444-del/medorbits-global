# Common API Conventions

**Version:** 1.1.0  
**Base path:** `/api/v1`

## 1. Transport and content

- Deployed APIs must use HTTPS.
- JSON requests use `Content-Type: application/json`.
- JSON responses use `Content-Type: application/json; charset=utf-8`.
- Upload endpoints must document their content type and size limits.
- Timestamps use ISO 8601 / RFC 3339 with an explicit timezone, preferably UTC, for example `2026-10-29T10:30:00Z`.
- Calendar dates without a time use `YYYY-MM-DD`.
- Currency uses an ISO 4217 code, for example `INR`.
- IDs are opaque strings. Clients must not infer internal database structure from IDs.

## 2. Authentication

Private endpoints use:

`Authorization: Bearer <access-token>`

Never place access tokens in URLs, query parameters, analytics events, or logs.

## 3. Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_example"
  }
}
```

`data` may be an object, an array, or `null`, as defined by the endpoint.

## 4. Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "email",
        "issue": "Enter a valid email address."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

`details` is optional. Error messages must be safe for end users and must not reveal sensitive implementation details.

## 5. Pagination

List endpoints may support `limit` and `cursor`.

- `limit` must be validated and capped by the server.
- `cursor` is opaque and must not be constructed by clients.
- Results should have deterministic ordering.
- A cursor may expire; the server should return a documented error if it does.
- Do not assume a page contains exactly the requested number of records.

Example metadata:

```json
{
  "nextCursor": null,
  "hasMore": false,
  "requestId": "req_example"
}
```

## 6. Idempotency

For operations that can create duplicate applications, charges, or external effects, support an idempotency key where appropriate:

`Idempotency-Key: <client-generated-unique-value>`

The server must define the key scope, retention period, request fingerprint rules, and behavior for repeated or conflicting requests. Reusing a key with a different payload should return a conflict rather than silently applying the second payload.

## 7. Conditional updates

For concurrent updates, the server may expose `ETag` and accept `If-Match`. If optimistic concurrency is not implemented, document the conflict behavior explicitly. Do not silently overwrite a newer record.

## 8. Unknown and unavailable values

- Unknown amounts must be `null` or omitted, never represented as zero.
- Unknown deadlines must be `null` or omitted.
- A missing source verification timestamp must not be replaced with the current date.
- Distinguish `unknown`, `not_applicable`, and `not_provided` when the domain requires it.

## 9. Request IDs and observability

The server should return a request ID in `meta.requestId` and, where supported, the `X-Request-Id` response header. Request IDs are diagnostic references, not authorization credentials.

Do not log passwords, access tokens, full identity documents, payment card data, or unnecessary personal information.

## 10. HTTP status conventions

- `200`: successful read or update
- `201`: resource created
- `202`: accepted for asynchronous processing
- `204`: successful operation with no response body
- `400`: malformed request
- `401`: missing or invalid authentication
- `403`: authenticated but not authorized
- `404`: not found or intentionally concealed
- `409`: state conflict or idempotency conflict
- `413`: payload too large
- `415`: unsupported media type
- `422`: semantically invalid request
- `429`: rate limit exceeded
- `500`: unexpected server error
- `503`: service unavailable

Endpoint-specific contracts may define additional statuses.
