# API Errors

## Standard error body

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      {
        "field": "courseId",
        "issue": "This field is required."
      }
    ]
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

## Error codes

| HTTP | Code | Meaning | Client behavior |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed request or unsupported parameter | Correct request |
| 401 | `UNAUTHENTICATED` | Missing, invalid, or expired authentication | Re-authenticate if appropriate |
| 403 | `FORBIDDEN` | Authenticated user lacks permission | Do not retry without permission change |
| 404 | `RESOURCE_NOT_FOUND` | Resource unavailable or access intentionally concealed | Show safe not-found state |
| 409 | `CONFLICT` | Resource state conflicts with operation | Refresh resource and resolve |
| 409 | `INVALID_STATE_TRANSITION` | Requested workflow transition is not allowed | Show current valid next steps |
| 409 | `IDEMPOTENCY_CONFLICT` | Same key reused for a different request | Generate a new key only for a genuinely new operation |
| 413 | `FILE_TOO_LARGE` | Upload exceeds configured limit | Ask user to choose a smaller file |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Unsupported body or file type | Explain accepted types |
| 422 | `VALIDATION_ERROR` | Field values fail business validation | Show field-specific errors |
| 422 | `DEADLINE_PASSED` | Submission window is closed | Show verified deadline/status |
| 422 | `DOCUMENTS_INCOMPLETE` | Required documents are missing | Show checklist |
| 429 | `RATE_LIMITED` | Request rate exceeded | Honor `Retry-After` if present |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Show generic failure and request ID |
| 503 | `SERVICE_UNAVAILABLE` | Temporarily unavailable | Retry safely with backoff |

## Error requirements

- Never expose stack traces, SQL statements, internal hostnames, filesystem paths, secrets, or access tokens.
- Avoid revealing whether another user's private application or document exists.
- Do not automatically retry non-idempotent operations unless idempotency is guaranteed.
- Provide a request ID for support diagnostics when available.
- Use stable error codes; client logic must not depend on exact prose.
