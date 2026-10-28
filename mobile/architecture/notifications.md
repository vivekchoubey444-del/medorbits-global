# Mobile Notifications

## 1. Types

Possible notification categories include:
- Application status changes
- Action required on an application
- Document upload or review status
- Payment status updates
- General service announcements

Only implement categories supported by the product and backend.

## 2. Source of truth

Push notifications are best-effort delivery signals. The authenticated in-app notification API and authoritative resource endpoint remain the source of truth.

Opening a push notification must fetch current authorized resource data before displaying private details.

## 3. Permissions and tokens

- Request push permission in context and explain the benefit.
- Support permission denial without breaking core application functionality.
- Register device tokens through the backend contract.
- Treat push tokens as sensitive identifiers.
- Update or unregister tokens when they rotate or are no longer valid.
- Do not log tokens.

## 4. Payload minimization

Do not include identity numbers, private document details, payment credentials, or unnecessary applicant data in push payloads. Prefer a notification ID and a safe category, then fetch details after authentication.

## 5. Delivery and deduplication

- Expect duplicate, delayed, and out-of-order notifications.
- Use stable notification IDs.
- Do not treat push delivery as proof of reading.
- Handle notifications received while the app is foregrounded, backgrounded, or terminated.
- Prevent duplicate navigation when the same notification is opened more than once.

## 6. Preferences

Respect user notification preferences and applicable consent requirements. Critical service notifications should follow a clearly documented product policy.

## 7. Tests

Test permission denied, token rotation, duplicate delivery, expired sessions, invalid resource IDs, and notification taps while signed out.
