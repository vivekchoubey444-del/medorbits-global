# Navigation Contract

## 1. Goals

Navigation must be predictable, accessible, restorable where appropriate, and guarded by current authentication and authorization state.

## 2. Proposed route groups

Public routes:
- `/welcome`
- `/sign-in`
- `/forgot-password` (only if supported)
- `/admissions`
- `/admissions/:admissionId`
- `/courses`
- `/courses/:courseId`
- `/institutions/:institutionId`

Authenticated routes:
- `/home`
- `/profile`
- `/settings`
- `/applications`
- `/applications/:applicationId`
- `/applications/:applicationId/documents`
- `/applications/:applicationId/history`
- `/notifications`

Optional routes, only if implemented:
- `/payments/:paymentId`
- `/eligibility/:assessmentId`
- `/support`

Route names are proposals. Reconcile them with the selected navigation framework and actual feature set.

## 3. Route guards

- Authentication guards improve UX but do not replace backend authorization.
- On logout or session expiry, clear protected navigation history and return to the public entry flow.
- If a route requires a role or permission, verify it against trusted session/backend state.
- Do not rely on hidden buttons as access control.
- For a missing or inaccessible private resource, show a safe unavailable state without revealing whether another user's record exists.

## 4. Navigation state

- Preserve useful list filters and scroll state when returning from a detail page, where practical.
- Do not place tokens, personal data, document contents, or payment secrets in route parameters.
- Pass opaque resource IDs only; fetch and authorize data through the API.
- Avoid duplicate screens after repeated taps or push/deep-link delivery.
- Handle back navigation consistently with platform conventions.

## 5. Deep links

Deep links must be parsed and validated by the deep-link handler. They must not directly execute actions such as submitting an application, approving a record, or confirming a payment.

See `deep-links.md`.

## 6. Accessibility

- Navigation elements need accessible labels and predictable focus behavior.
- Dialogs must trap/restore focus where applicable.
- Do not rely on color alone to communicate route state.
- Provide a meaningful page/screen title for assistive technology.

## 7. Navigation tests

- Unauthenticated users cannot enter protected flows.
- Expired sessions clear protected history.
- Invalid IDs and malformed links fail safely.
- Repeated deep links do not create duplicate mutation requests.
- Back navigation returns users to a sensible prior screen.
