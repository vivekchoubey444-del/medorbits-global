# Mobile Security and Privacy

## 1. Threat model

Consider device loss, rooted/jailbroken devices, modified clients, reverse engineering, insecure networks, malicious deep links, stolen sessions, object-level authorization flaws, unsafe file uploads, dependency compromise, and accidental data exposure through logs or screenshots.

Mobile security controls reduce risk but do not replace backend authorization.

## 2. Authentication and session

- Use the approved identity provider and documented OAuth/OIDC or session flow.
- Store credentials only in platform secure storage when persistence is required.
- Never embed server-side secrets in the app bundle.
- Never place tokens in URLs, deep links, analytics, or crash reports.
- Handle expiry and revocation consistently.
- Clear protected state after logout or unrecoverable authentication failure.
- Do not implement custom cryptography.

## 3. Authorization

The backend must enforce authorization for every private resource. Client-side route guards and hidden controls are UX features, not security controls.

Never trust client-supplied:
- User IDs as proof of identity.
- Application status or approval flags.
- Document acceptance status.
- Payment success status.
- Admin roles or verification flags.
- Fee amounts.

## 4. Network security

- Use HTTPS.
- Do not disable certificate validation.
- Use certificate pinning only with a documented rotation and recovery plan; incorrect pinning can lock out legitimate clients.
- Send credentials only to approved API origins.
- Do not follow untrusted URLs with authorization headers attached.
- Validate redirect behavior for authenticated requests.

## 5. Local data

- Minimize stored personal data.
- Use secure storage for secrets.
- Protect local databases and temporary files according to sensitivity.
- Exclude sensitive values from logs, analytics, crash reports, and clipboard operations where possible.
- Review screenshot, app-switcher preview, and backup exposure for sensitive screens.
- Clear or isolate account-specific caches on logout.

## 6. Documents

- Use private server storage.
- Validate file content and scan for malware server-side where supported.
- Use short-lived, scoped download links or authenticated streaming.
- Do not expose permanent public document URLs.
- Avoid saving sensitive files to shared folders without explicit user action and policy review.

## 7. Deep links and web views

- Validate link scheme, host, path, and resource identifier.
- Never accept a deep link as proof of payment or authentication.
- Avoid loading arbitrary content in privileged web views.
- Do not bridge untrusted web content to native capabilities.

## 8. Logging and analytics

Never log:
- Passwords, OTPs, access/refresh tokens.
- Full identity document data.
- Payment credentials.
- Private document URLs or signed URLs.
- Unnecessary full phone numbers, addresses, or applicant data.

Use redaction and access controls. Keep telemetry events minimal and privacy-reviewed.

## 9. Build and supply chain

- Keep dependencies updated and reviewed.
- Scan for known vulnerabilities and exposed secrets.
- Protect signing keys and release credentials.
- Separate development, staging, and production configuration.
- Do not commit production `.env` files or certificates with private keys.
- Use reproducible builds where practical.

## 10. Privacy and consent

- Collect only necessary information.
- Explain why sensitive information is needed.
- Record required consent on the server.
- Provide retention and deletion workflows consistent with applicable law and policy.
- Do not infer or expose sensitive attributes unnecessarily.

## 11. Incident response

Document how to revoke sessions, rotate credentials, disable compromised integrations, report incidents, and communicate user impact. Security-sensitive actions should be auditable.
