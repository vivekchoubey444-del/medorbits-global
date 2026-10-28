# Authentication API Contract

**Base path:** `/api/v1/auth`  
**Status:** Proposed; reconcile with the configured identity provider.

## Security assumptions

This contract does not prescribe a specific identity provider. Password login, OTP login, OAuth/OIDC, and enterprise identity flows must be selected according to the deployed system. Do not implement multiple methods merely because they appear in examples.

Access tokens should be short-lived. Refresh tokens, if used, must be protected and rotated or otherwise invalidated according to the session design. Never store secrets in ordinary logs or URLs.

## Endpoints

### POST `/api/v1/auth/login`

Authenticates a user using the configured login method.

Request fields depend on the chosen identity provider. A password-based example, if supported:

```json
{
  "email": "user@example.com",
  "password": "REDACTED"
}
```

Never put a real password in documentation, test fixtures, or logs.

Success: `200 OK`

```json
{
  "success": true,
  "data": {
    "accessToken": "<redacted>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "user_example_001",
      "email": "user@example.com"
    }
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Token delivery and refresh-token handling must match the actual authentication architecture. If refresh tokens are used, prefer secure platform storage on mobile and define rotation/reuse detection.

### POST `/api/v1/auth/refresh`

Exchanges a valid refresh credential for a new access token, if refresh sessions are implemented.

- Reject expired, revoked, or reused refresh tokens according to the session policy.
- Rotate refresh tokens where supported.
- Invalidate prior refresh credentials when rotation occurs.
- Do not accept refresh tokens in query parameters.

### POST `/api/v1/auth/logout`

Authentication: Required unless the identity provider requires another logout flow.

Revokes the current session or refresh credential where supported.

Success: `204 No Content`

Logout must not merely clear client state if server-side revocation is part of the system's security model.

### GET `/api/v1/auth/session`

Authentication: Required.

Returns current session metadata without exposing secrets.

Example:

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "expiresAt": "2026-10-29T10:15:00Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

### POST `/api/v1/auth/password/forgot`

Only implement when password authentication is enabled.

Request:

```json
{
  "email": "user@example.com"
}
```

Return a generic response that does not disclose whether the account exists.

### POST `/api/v1/auth/password/reset`

Only implement when password reset is enabled. Require a short-lived, single-use reset credential and enforce password policy on the server.

## Required controls

- Rate-limit login, OTP, password reset, and refresh operations.
- Use generic authentication failures to reduce account enumeration.
- Never log passwords, OTP values, authorization headers, or tokens.
- Validate tokens on the server and enforce expiry, issuer, audience, and signature as applicable.
- Protect against brute force and credential stuffing.
- Keep authorization decisions separate from authentication.
- Do not place bearer tokens in URLs.
- Define account recovery and session revocation procedures.
