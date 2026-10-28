# Deep Links and App Links

## 1. Purpose

Deep links may navigate to public admissions pages or to an authenticated application screen. They must not grant permissions or directly perform irreversible actions.

## 2. Validation

For each incoming link:
- Allowlist schemes and hosts.
- Validate path patterns and resource identifiers.
- Reject malformed, oversized, or unexpected parameters.
- Do not accept access tokens, refresh tokens, OTPs, or secrets in URLs.
- Do not forward authorization headers to arbitrary hosts.
- Avoid logging full links if they may contain personal information.

## 3. Authentication

If a link targets a protected screen while signed out:
1. Store only the validated intended destination.
2. Send the user through the approved sign-in flow.
3. Revalidate the destination after authentication.
4. Fetch the resource through the API.
5. Allow the backend to enforce authorization.

## 4. Irreversible actions

A deep link must not by itself:
- Submit an application.
- Approve or reject an application.
- Confirm payment.
- Initiate a refund.
- Delete a document.
- Change user permissions.

Require an authenticated, explicit in-app action and server-side validation.

## 5. Web content

Use verified universal/app links where supported. Avoid privileged native bridges for untrusted web content. Validate return URLs to prevent open redirects.

## 6. Tests

Test unknown hosts, malformed IDs, repeated links, signed-out navigation, expired sessions, inaccessible private resources, and redirect attacks.
