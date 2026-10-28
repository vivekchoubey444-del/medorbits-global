# Notifications API Contract

**Base path:** `/api/v1`  
**Authentication:** Required for user-specific notifications and device registration.

## 1. List notifications

`GET /api/v1/notifications`

Optional query parameters:

- `unreadOnly`: boolean
- `limit`: integer, server-capped
- `cursor`: opaque pagination cursor

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "notification_example_001",
      "type": "application_status",
      "title": "Application status updated",
      "body": "Your application status has changed.",
      "createdAt": "2026-10-29T10:30:00Z",
      "readAt": null,
      "resource": {
        "type": "application",
        "id": "application_example_001"
      }
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false,
    "requestId": "req_example"
  }
}
```

Notification content must not expose unnecessary sensitive personal data on lock screens.

## 2. Mark one notification read

`PATCH /api/v1/notifications/{notificationId}`

Request:

```json
{
  "read": true
}
```

Only allow the authenticated user to update their own notification.

## 3. Mark all notifications read

`POST /api/v1/notifications/read-all`

Authentication: Required.

Success: `204 No Content` or a documented success envelope.

## 4. Register a device

`POST /api/v1/devices`

Example request:

```json
{
  "platform": "ios",
  "pushToken": "<redacted>",
  "appVersion": "1.0.0",
  "locale": "en"
}
```

Supported platform values may include `ios` and `android`. Validate push tokens and store them securely. Never include real push tokens in logs or documentation.

## 5. Unregister a device

`DELETE /api/v1/devices/{deviceId}`

Authentication: Required. A user may remove only a device registration they control.

## 6. Delivery semantics

Push notifications are best-effort delivery signals. The in-app notification API remains the source of truth.

- Expect duplicate and delayed push messages.
- Do not assume delivery means the user read the message.
- Use stable notification IDs for deduplication.
- Do not include access tokens, full identity details, or sensitive document information in push payloads.
- Respect user preferences and applicable consent requirements.

## 7. Errors

Use the shared error format and standard HTTP status codes. Do not reveal notifications belonging to another account.
