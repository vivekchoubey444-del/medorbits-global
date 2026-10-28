# User Profile API Contract

**Base path:** `/api/v1/users`

## GET `/api/v1/users/me`

Authentication: Required.

Returns the current authenticated user's profile.

Example:

```json
{
  "success": true,
  "data": {
    "id": "user_example_001",
    "fullName": "Applicant Name",
    "email": "user@example.com",
    "phone": null,
    "preferredLanguage": "en",
    "createdAt": "2026-10-01T10:00:00Z"
  },
  "meta": {
    "requestId": "req_example"
  }
}
```

Return only fields the current user is allowed to view. Never return password hashes, authentication secrets, internal risk scores, or private administrative notes.

## PATCH `/api/v1/users/me`

Authentication: Required.

Updates allowed profile fields. The server must allowlist editable properties; clients must not set roles, account status, verified flags, or permissions.

Example request:

```json
{
  "fullName": "Updated Name",
  "preferredLanguage": "en"
}
```

Validate field length, language support, and any verification requirements. Email or phone changes may require a separate verification flow.

## GET `/api/v1/users/me/preferences`

Authentication: Required.

Returns supported application preferences, such as locale and notification settings.

## PATCH `/api/v1/users/me/preferences`

Authentication: Required.

Updates supported preferences only. Unknown fields should be rejected or safely ignored according to the API's documented validation policy.

## Account deletion

If account deletion is supported, define a dedicated endpoint and workflow after reviewing retention, legal, payment, and active-application requirements. Do not imply that deleting a mobile session deletes server-side personal data.

## Security requirements

- Enforce access to the current user's profile server-side.
- Validate all writable fields.
- Keep verification status server-controlled.
- Apply privacy and retention rules.
- Audit security-sensitive profile changes.
