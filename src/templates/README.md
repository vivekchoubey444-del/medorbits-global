# MedOrbits Templates

**Directory:** `src/templates/`

**Brand direction:** Deep Plum · Royal Plum · Burgundy Plum · Champagne Gold

## 1. Purpose

The `src/templates/` directory contains reusable presentation templates for the MedOrbits application.

Templates define the structure and presentation of generated content, including transactional emails, account notifications, application communications, payment messages, and printable documents.

Templates are presentation resources. They must remain separate from database access, authorization decisions, business rules, payment processing, email delivery, file storage, and other infrastructure responsibilities.

The directory contains two primary template categories:

- `email/` — HTML and plain-text templates for transactional and service-related communications.
- `documents/` — Standalone HTML templates for printable documents and document-generation workflows.

**Implementation note:** The presence of a template does not establish that its rendering, delivery, PDF conversion, or integration workflow has been implemented.

## 2. Directory Structure

The intended directory structure is:

```text
src/templates/
├── README.md
├── email/
│   ├── README.md
│   ├── base.html
│   ├── base.text
│   ├── welcome.html
│   ├── verification.html
│   ├── password-reset.html
│   ├── password-change.html
│   ├── application-received.html
│   ├── application-status.html
│   ├── payment-success.html
│   ├── payment-failed.html
│   ├── job-alert.html
│   ├── subscription-renewal.html
│   └── interview-invitation.html
└── documents/
    ├── README.md
    ├── application-summary.html
    ├── payment-receipt.html
    ├── counselling-summary.html
    ├── resume.html
    └── document-checklist.html
```

This tree describes the intended organization, not a verified inventory of existing files.

Verify the actual repository before assuming that every listed template, README, base file, or integration exists. Keep this directory-level README synchronized with the email and document subdirectories.

## 3. Shared Brand System

Use the approved MedOrbits visual identity consistently across email and document templates.

| Color | Hex | Intended use |
|—|—|—|
| Deep Plum | `#100a17` | Outer backgrounds and primary dark surfaces |
| Royal Plum | `#191023` | Main content surfaces |
| Burgundy Plum | `#21172b` | Secondary panels and highlighted sections |
| Champagne Gold | `#c9a96e` | Borders, dividers, and restrained accents |
| Light Champagne | `#e4d0a1` | Headings and emphasized content |
| Soft Lavender | `#d9cce4` | Supporting accents |
| Muted Text | `#b7acbf` | Secondary text where contrast permits |
| Primary Text | `#f7f1fa` | Main text on dark surfaces |

These are design tokens, not a guarantee of accessibility. Validate the contrast of each actual foreground and background combination.

### Brand implementation requirements

- Keep brand colors consistent across template categories.
- Use readable typography and a clear content hierarchy.
- Use restrained decoration and meaningful whitespace.
- Preserve legibility when styles or images are unavailable.
- Avoid unnecessary external resources and network dependencies.
- Use verified asset paths and ensure assets are available to the rendering environment.
- Do not assume website components or website navigation are appropriate for email or printable documents.
- Use a consistent MedOrbits wordmark and approved brand assets where supported.

Email and document templates may use different layout strategies while sharing the same brand palette.

## 4. Template Categories

### 4.1 Email templates

**Directory:** `src/templates/email/`

Email templates support transactional and service-related communications, including:

- Account registration and welcome messages.
- Email verification.
- Password reset and password-change notifications.
- Application receipt and status updates.
- Successful and failed payment notifications.
- Job opportunity alerts.
- Subscription renewal notifications.
- Interview invitations.

Email templates should use a centered, table-based HTML layout with inline CSS for broad email-client compatibility.

Important transactional emails should have corresponding plain-text alternatives. The email-specific README defines the intended template inventory, placeholder contracts, shared shell conventions, and delivery requirements.

### 4.2 Document templates

**Directory:** `src/templates/documents/`

Document templates support printable output, including:

- Application summaries.
- Payment receipts.
- Counselling summaries.
- Resumes.
- Document checklists.

Document templates should use standalone layouts suitable for browser previews and controlled PDF generation.

They must not depend on website navigation, dashboards, or interactive website components. Document-specific branding may appear inside the document when appropriate.

The document-specific README defines layout, data validation, security, rendering, and PDF conversion requirements.

## 5. Rendering Contract

Template placeholders are conventions, not a rendering engine.

For example:

```html
<p>Hello {{firstName}},</p>
```

The application must use its configured template engine or rendering implementation to resolve placeholders.

Do not assume that the project supports template inheritance, partials, loops, conditional blocks, automatic escaping, or plain-text generation without verifying the actual implementation.

### Requirements

- Document required and optional variables for each template.
- Validate required values before rendering.
- Pass only the data needed by the selected template.
- Use consistent variable naming conventions.
- Enable automatic escaping where supported.
- Escape untrusted values according to their output context.
- Validate URLs independently of HTML escaping.
- Handle missing optional values without exposing raw placeholders.
- Reject invalid required values rather than producing misleading documents or messages.
- Keep formatting logic in shared helpers or services.
- Avoid business logic inside presentation templates.
- Fail safely if rendering fails; do not send partially rendered transactional content.

### Context-aware output handling

**HTML text:** Escape untrusted values before inserting them into text nodes.

**HTML attributes:** Apply appropriate attribute-context escaping and validate the attribute value.

**URLs:** Restrict permitted schemes and destinations to an explicit allowlist. Use trusted HTTPS origins in production.

**Rich HTML:** Permit only trusted or appropriately sanitized HTML where rich content is explicitly required.

**Financial values:** Use authoritative transaction data and decimal-safe calculations before formatting amounts.

**Dates and times:** Use validated date values and explicit timezone conventions.

HTML escaping alone does not make arbitrary HTML, CSS, JavaScript, or URLs safe.

## 6. Data Integrity and Business Rules

Templates must display prepared application data rather than independently determining business outcomes.

- Application statuses must originate from authorized application records.
- Payment statuses must originate from verified transaction records.
- Subscription details must reflect authoritative billing records.
- Interview details must originate from confirmed scheduling information.
- Resume content must preserve candidate-provided facts.
- Counselling recommendations must be distinguished from confirmed institutional requirements.
- Document checklists must reflect applicable requirements and recorded document states.

A rendered email or document must not automatically be treated as proof of payment, admission, approval, eligibility, employment, or credential authenticity.

The relevant application service must validate business rules before preparing template data.

## 7. Security and Privacy

### 7.1 Authorization

- Verify the requester’s identity and permissions before generating or retrieving private content.
- Verify access to the underlying application, transaction, subscription, or document.
- Do not trust client-supplied record identifiers as proof of authorization.
- Prevent cross-user data disclosure.
- Restrict access to generated files and private document links.

### 7.2 Sensitive information

- Never include passwords, password hashes, API keys, payment credentials, or authentication secrets in templates.
- Do not log complete rendered messages or confidential document payloads.
- Minimize personal information in email subjects and previews.
- Use only the information necessary for the intended communication.
- Apply appropriate retention and deletion policies to generated content and delivery records.

### 7.3 Links and tokens

- Generate security tokens using approved cryptographically secure mechanisms.
- Enforce appropriate token expiration and single-use semantics.
- Never log complete verification or password-reset URLs.
- Generate links from configured, trusted application origins.
- Validate external destinations against explicit policies.
- Apply authorization checks when accessing private receipts, applications, and generated documents.

### 7.4 Payment communications

- Do not trust client-supplied amounts or transaction states.
- Distinguish successful, pending, failed, cancelled, and reversed transactions.
- Do not send a success notification before the payment state is verified.
- Avoid duplicate or misleading notifications during retries.
- Do not imply that a payment receipt is a compliant tax invoice unless applicable requirements are satisfied.

## 8. Integration Boundaries

| Module | Intended responsibility |
|—|—|
| `src/controllers/` | Handles authorized requests and standardized responses |
| `src/services/` | Coordinates workflows and prepares validated presentation data |
| `src/repositories/` | Retrieves authoritative records |
| `src/integrations/email/` | Integrates with the configured email provider |
| `src/integrations/storage/` | Handles document storage and retrieval through configured adapters |
| `src/jobs/` | Discovers eligible scheduled notifications or reminders |
| `src/workers/` | Processes queued notification or document-generation tasks |
| `src/templates/` | Defines reusable presentation structures |

These paths describe intended architectural boundaries. Confirm the actual repository structure and implementations before depending on them.

Templates must not access databases, send emails directly, implement authorization, process payments, or manage files.

## 9. Error Handling and Reliability

Where supported by the application architecture:

- Validate template variables before rendering.
- Fail safely when required values are missing.
- Distinguish rendering errors from delivery errors.
- Avoid exposing internal paths, stack traces, or sensitive values in user-facing errors.
- Deduplicate notification events where repeated processing could send duplicate messages.
- Apply bounded retries to transient provider or renderer failures.
- Clean up temporary files after document generation.
- Record operational metadata without logging secrets or complete confidential content.
- Prevent retries from producing duplicate payment, application, or subscription notifications.

A successful rendering operation does not guarantee successful email delivery. A successful email-provider response does not necessarily guarantee that a recipient read the message.

Likewise, successful HTML rendering does not guarantee that a PDF renderer will produce correct or safe output.

Do not document these capabilities as implemented until they have been verified.

## 10. Testing Requirements

### Template rendering

- [ ] All documented template files exist.
- [ ] Each template renders using the configured engine.
- [ ] Required variables are validated.
- [ ] Optional values are handled safely.
- [ ] Untrusted values are escaped correctly.
- [ ] Invalid URLs are rejected.
- [ ] Missing values do not expose raw placeholders.
- [ ] Long text and special characters render correctly.
- [ ] Financial values and dates are formatted consistently.
- [ ] Rendering failures do not produce partially populated transactional messages.

### Email templates

- [ ] HTML uses email-client-compatible layout techniques.
- [ ] Plain-text alternatives contain essential information.
- [ ] Links and calls to action are validated.
- [ ] Mobile layouts are tested.
- [ ] Account verification and password-reset workflows are tested.
- [ ] Payment messages use authoritative transaction states.
- [ ] Duplicate notification scenarios are tested.

### Document templates

- [ ] Print styles are tested in the actual rendering environment.
- [ ] Multi-page layouts and page breaks are reviewed.
- [ ] Tables and long text remain readable.
- [ ] Generated PDFs are checked for correctness.
- [ ] Unauthorized document access is rejected.
- [ ] Temporary files and generated documents follow retention policies.
- [ ] PDF rendering is appropriately isolated and resource-limited.

### Privacy and security

- [ ] Sensitive information is absent from logs.
- [ ] Cross-user access attempts are rejected.
- [ ] Token expiry and single-use behavior are verified.
- [ ] URL and renderer restrictions are tested.
- [ ] Synthetic data is used in automated tests.
- [ ] Private document links enforce authorization and expiry where required.

## 11. Maintenance and Implementation Status

Keep this README synchronized with:

- The actual email and document template files.
- Template variable contracts.
- The configured rendering engine.
- Plain-text generation and email delivery workflows.
- PDF conversion and storage integrations.
- Authorization and validation logic.
- Automated tests and deployment configuration.

When adding a template:

1. Define its purpose and triggering conditions.
2. Document required and optional variables.
3. Follow the shared MedOrbits brand system.
4. Implement the relevant plain-text alternative or print layout.
5. Validate untrusted values and link destinations.
6. Integrate the template through the appropriate service.
7. Add rendering and workflow tests.
8. Update the relevant category README and this directory-level README.

The presence of a template or README does not prove that its associated application workflow is operational or production-ready.

—

**MedOrbits — Study · Work · Grow**

*Reusable templates designed for consistent presentation, data integrity, privacy, and controlled access.*