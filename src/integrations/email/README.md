
# MedOrbits Email Integration

**Directory:** `src/integrations/email/`  
**Runtime:** Node.js 20+  
**Transport:** Nodemailer SMTP

## 1. Purpose

The MedOrbits email integration provides reusable server-side email delivery for authentication, admissions enquiries, application updates, career services, employer communications, notifications, and transactional messages.

Application services use `createEmailClient()` to send validated messages through a configured provider. SMTP connection management, authentication, and transport operations remain inside the provider adapter.

The integration supports:

- Plain-text and HTML email.
- Multiple recipients, CC, and BCC.
- Configured sender identity and reply-to addresses.
- Pooled SMTP connections.
- Message and recipient validation.
- Provider injection for testing.
- Controlled provider shutdown.

It does not automatically implement email templates, durable queues, persistent retries, bounce processing, delivery analytics, or email verification workflows.

## 2. Directory Structure

```text
src/integrations/email/
├── README.md
├── index.js
├── email.client.js
├── email.provider.js
└── smtp.provider.js
```

| File | Responsibility |
|—|—|
| `README.md` | Setup, usage, security, testing, and operations |
| `index.js` | Exports the integration and creates email clients |
| `email.client.js` | Validates messages and delegates delivery |
| `email.provider.js` | Defines the abstract provider contract |
| `smtp.provider.js` | Configures Nodemailer and sends SMTP messages |

Controllers and business services must not construct Nodemailer transports directly.

## 3. Requirements

- Node.js 20 or later.
- npm.
- An authorized SMTP account or relay.
- Server-side SMTP credentials.
- An approved sender address or domain.

Install Nodemailer:

```bash
npm install nodemailer
```

Confirm that `nodemailer` is recorded in `package.json` and included in production deployments.

## 4. Environment Configuration

Configure these values in the server environment or deployment secret manager:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false

SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=20000

EMAIL_FROM=notifications@example.com
```

Replace the example values with credentials and settings supplied by your email provider.

| Variable | Required | Purpose |
|—|—|—|
| `SMTP_HOST` | Yes | SMTP server hostname |
| `SMTP_PORT` | Yes | SMTP port, commonly 587 or 465 |
| `SMTP_USER` | Yes | Authentication username |
| `SMTP_PASS` | Yes | Password or application-specific credential |
| `SMTP_SECURE` | No | Whether TLS is used immediately |
| `SMTP_CONNECTION_TIMEOUT_MS` | No | Connection timeout |
| `SMTP_GREETING_TIMEOUT_MS` | No | SMTP greeting timeout |
| `SMTP_SOCKET_TIMEOUT_MS` | No | Socket inactivity timeout |
| `EMAIL_FROM` | Yes | Configured sender address |

For port 465, SMTP commonly uses implicit TLS with `SMTP_SECURE=true`. For port 587, STARTTLS is commonly used with `SMTP_SECURE=false`. Follow your provider’s requirements.

Never commit SMTP credentials to Git. Rotate any exposed credentials immediately.

**Configuration alignment:** The current adapter reads `SMTP_PASS` and `EMAIL_FROM`. Standardize these names with `src/config/env.js` and `src/config/email.js` before deployment. Do not maintain competing configuration sources with different defaults.

## 5. Creating an Email Client

Create a shared client in the server-side composition layer:

```javascript
‘use strict’;

const {
  createEmailClient,
} = require(‘./src/integrations/email’);

const emailClient = createEmailClient();
```

The factory creates an SMTP provider from the environment by default. For testing, inject a mock provider implementing `send(message)`.

```javascript
const emailClient = createEmailClient({
  provider: mockEmailProvider,
});
```

Injected providers are externally managed by default. Use `ownsProvider: true` when the client should manage their lifecycle.

Reuse the shared client when connection pooling is enabled. Avoid creating a new SMTP transport for every HTTP request.

## 6. Sending Email

```javascript
await emailClient.send({
  to: ‘student@example.com’,
  subject: ‘Your MedOrbits enquiry’,
  text: ‘We have received your enquiry.’,
  html: ‘<p>We have received your enquiry.</p>’,
});
```

Supported message fields include:

- `to` — required recipient or recipient list.
- `subject` — required subject.
- `text` — optional plain-text body.
- `html` — optional HTML body.
- `cc` — optional carbon-copy recipients.
- `bcc` — optional blind carbon-copy recipients.
- `replyTo` — optional reply-to addresses.
- `headers` — optional validated custom headers.
- `priority` — optional `high`, `normal`, or `low` priority.

At least one body format is required. Prefer both text and HTML for transactional messages.

The SMTP provider returns a normalized result:

```javascript
{
  messageId: ‘provider-message-id’,
  accepted: [],
  rejected: []
}
```

Actual values depend on the SMTP response.

A successful SMTP submission does not prove inbox delivery. Messages can subsequently bounce, be filtered, or be rejected by recipient servers.

## 7. HTML Templates and Rendering Security

Use trusted templates and a template engine with automatic escaping.

- Escape user-provided values before inserting them into HTML.
- Never insert untrusted HTML directly into templates.
- Do not allow users to choose arbitrary template files or template source.
- Validate URLs before adding them to links.
- Restrict link schemes to approved schemes, normally HTTPS.
- Reject `javascript:`, unexpected `data:`, and other unsafe URL schemes.
- Avoid interpolating untrusted values into CSS, HTML attributes, or raw template blocks.
- Maintain templates separately from controllers and business logic.
- Provide meaningful plain-text alternatives.
- Test templates against HTML injection and malformed input.

Example:

```javascript
const html = renderTrustedTemplate(‘enquiry-received’, {
  studentName: validatedStudentName,
  enquiryReference: validatedReference,
});

await emailClient.send({
  to: validatedRecipient,
  subject: ‘We received your MedOrbits enquiry’,
  text: plainTextMessage,
  html,
});
```

`renderTrustedTemplate()` is an application-level function; it is not provided by this integration unless implemented separately.

HTML escaping alone does not validate URL destinations or prevent unsafe links.

## 8. Authentication and Account Enumeration

Authentication-related email workflows must not disclose whether an account exists.

Apply generic responses to:

- Password-reset requests.
- Account-recovery assistance.
- Email-verification resend requests.
- Registration attempts where account existence could otherwise be disclosed.

For example:

> If an account matches the supplied details, instructions will be sent to the registered email address.

Use rate limiting and abuse detection for endpoints that trigger email delivery.

Verification and password-reset tokens must be cryptographically secure, short-lived, purpose-specific, and single-use. Store token hashes where appropriate and invalidate tokens after successful use or expiry.

Never include passwords, session tokens, unrestricted account data, or sensitive documents in emails or URLs.

## 9. Message Validation

The email client and SMTP adapter validate messages before delivery.

Controls include:

- Recipient address validation and recipient-count limits.
- Subject validation and header-injection protection.
- Required body validation.
- CC, BCC, and reply-to validation.
- Custom header validation.
- Message-size limits.
- A configured sender identity.

The SMTP provider must use the trusted configured sender rather than allowing arbitrary callers to override it.

Address syntax validation does not prove that an address exists or belongs to the intended recipient.

Attachments are not supported by the current generic client/provider contract unless attachment validation is explicitly implemented. Do not assume that arbitrary attachment paths, streams, filenames, or MIME types are safe.

## 10. Application Integration

Use the email client through authorized application services.

| Service | Example use |
|—|—|
| Authentication | Verification and password-reset messages |
| Admissions | Enquiry acknowledgements and application updates |
| Career services | Career and recruitment notifications |
| Employer services | Approved recruitment communications |
| Support | Case acknowledgements and status updates |
| Notifications | Account and transactional messages |

Controllers should validate requests, authorize operations, and delegate delivery to the relevant service.

Public clients must not be allowed to use this integration as an unrestricted email relay, choose privileged sender identities, or submit arbitrary privileged message headers.

## 11. Error Handling and Reliability

Handle failures according to their category:

- **Validation failure:** Reject the message before transport.
- **Configuration failure:** Fail startup or disable the affected capability safely.
- **Authentication failure:** Alert operators and correct SMTP credentials.
- **Transient failure:** Retry under a bounded retry policy.
- **Permanent recipient failure:** Record the rejection and avoid endless retries.
- **Ambiguous network failure:** Account for the possibility that SMTP accepted the message before the connection failed.

For important messages, use a durable queue or transactional outbox. Record an application message ID and processing status to control duplicate attempts.

Email delivery is not inherently exactly-once. Design for at-least-once attempts and duplicate-resistant business workflows.

Do not hold a database transaction open while waiting for SMTP delivery.

The current SMTP adapter does not itself provide durable retries, a queue, bounce processing, or persistent delivery tracking.

## 12. Logging and Privacy

Capture operational metadata such as:

- Application message ID.
- Message category or template name.
- Processing outcome.
- Provider message ID when available.
- Error category and retry count.
- Timestamps and correlation IDs.

Avoid logging SMTP credentials, reset tokens, verification URLs containing secrets, unnecessary message bodies, or sensitive student and application information.

Protect logs with access controls, redaction, and defined retention policies.

## 13. Graceful Shutdown

Close the shared client during application shutdown:

```javascript
await emailClient.close();
```

A production shutdown sequence should:

1. Stop accepting new work.
2. Stop accepting new email jobs.
3. Allow in-flight operations to finish within a bounded deadline.
4. Close the email client and owned transport.
5. Record sanitized shutdown errors and exit according to application policy.

The SMTP provider’s `close()` method releases the Nodemailer transport. A closed client or provider must not accept new sends.

If the application shares a provider between components, only its designated owner should close it.

## 14. Testing Checklist

### Configuration

- [ ] Missing SMTP variables are detected.
- [ ] Invalid ports and timeout values are rejected.
- [ ] TLS settings match the selected provider.
- [ ] Credentials are never exposed in logs or public responses.
- [ ] Production uses the approved SMTP endpoint.

### Message validation

- [ ] Invalid recipient addresses are rejected.
- [ ] Empty subjects and bodies are rejected.
- [ ] Header-injection attempts are rejected.
- [ ] CC, BCC, and reply-to values are validated.
- [ ] Oversized messages are rejected.
- [ ] Sender identity remains controlled by configuration.
- [ ] Unsupported attachment fields are rejected.

### Security

- [ ] Templates escape untrusted values.
- [ ] Unsafe URLs are rejected.
- [ ] Authentication responses remain generic.
- [ ] Email-triggering endpoints are rate-limited.
- [ ] Verification and reset tokens expire and cannot be reused.

### Reliability

- [ ] SMTP failures are handled without exposing secrets.
- [ ] Retry behavior is bounded.
- [ ] Duplicate processing is controlled for queued messages.
- [ ] Provider resources close during shutdown.
- [ ] Important messages can be recovered after a process restart.

## 15. Operational Boundaries

The current integration provides an email client, an abstract provider contract, and an SMTP transport adapter.

It does not automatically implement:

- A template engine or template directory.
- A durable email queue.
- Scheduled reminders.
- Bounce, complaint, or delivery-event processing.
- Email verification or password-reset workflows.
- Exactly-once delivery.
- Provider-independent delivery analytics.
- Persistent retries or application-level idempotency.

Implement these capabilities in dedicated modules and document their actual behavior.

## 16. Maintenance and Production Readiness

Periodically review:

- SMTP credentials and access permissions.
- TLS configuration.
- Sender-domain authentication.
- Message templates and link destinations.
- Rate limits and delivery failures.
- Retry policies and queue health.
- Logging, privacy, and retention settings.
- Provider and application shutdown behavior.

Configure SPF, DKIM, and DMARC according to the sending provider’s instructions.

### Implementation status

This document describes the integration contract and recommended safeguards. Verify each feature against the actual source code, automated tests, central environment configuration, and deployment settings before considering it implemented or production-ready.
