# State Management

## 1. State categories

Separate state into:

- **Ephemeral UI state:** open modal, selected tab, text field focus.
- **Form/draft state:** unsaved applicant input and validation results.
- **Server state:** admissions, institutions, application status, documents, fees.
- **Session state:** authenticated user and token/session metadata.
- **Device state:** connectivity, permissions, notification token, platform settings.
- **Persistent preferences:** locale, theme, accessibility preferences, and selected filters where appropriate.

## 2. Source of truth

The backend is authoritative for published admissions, eligibility results, application status, document review, and payment status.

Local state may temporarily contain unsaved drafts. Label unsynced changes and do not imply that a server operation succeeded before confirmation.

## 3. State lifecycle

For asynchronous features, represent at least:
- Initial/not requested
- Loading
- Success with data
- Empty
- Recoverable error
- Unrecoverable/permission error
- Offline/stale data where applicable

Avoid a single boolean that cannot distinguish loading from failure or empty results.

## 4. Race conditions

- Cancel or ignore stale search results.
- Associate responses with the request/query that produced them.
- Prevent a slow earlier response from replacing a newer result.
- Use server versions or conditional updates where supported.
- Serialize sensitive workflow transitions where required.

## 5. Forms

- Validate fields for user feedback, then revalidate on the server.
- Preserve user input on recoverable failures.
- Never persist passwords, OTPs, payment credentials, or sensitive documents in ordinary form caches.
- Disable duplicate submit actions while a request is in flight, but do not treat UI disabling as the only duplicate protection.
- Display server validation errors next to relevant fields.

## 6. State reset

On logout, clear protected in-memory state, private caches, and session-bound navigation. Follow retention policy for drafts that may need to survive logout; do not silently discard user work without clear product behavior.

## 7. Testing

Test state transitions, stale response handling, duplicate taps, app background/foreground behavior, session expiry, and offline restoration.
