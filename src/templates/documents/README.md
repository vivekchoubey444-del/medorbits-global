File path: src/templates/documents/README.md

# MedOrbits Document Templates
**Directory:** `src/templates/documents/`
## 1. Purpose
This directory contains standalone HTML templates used to present printable documents across the MedOrbits platform, including application summaries, payment receipts, counselling summaries, resumes, and document checklists.
Templates follow the MedOrbits visual identity and use a consistent design system, accessible typography, responsive layouts, and print-friendly styling.
Documents are presentation resources. A generated document does not automatically constitute a legally valid instrument, proof of payment, official admission confirmation, or verified credential. Its validity depends on authoritative records, applicable requirements, and authorized issuance.
## 2. Directory Structure
```text
src/templates/documents/
├── README.md
├── application-summary.html
├── payment-receipt.html
├── counselling-summary.html
├── resume.html
└── document-checklist.html
```
This is the intended directory structure. Verify the repository before treating this inventory as complete.
## 3. Template Responsibilities
| Template | Responsibility |
|—|—|
| `application-summary.html` | Presents an authorized summary of an education or career application. |
| `payment-receipt.html` | Presents payment details obtained from authoritative transaction records. |
| `counselling-summary.html` | Presents counselling details, recommendations, and agreed next steps. |
| `resume.html` | Formats candidate-provided professional and educational information. |
| `document-checklist.html` | Presents required, optional, received, pending, or rejected documents. |
Templates must not independently establish payment completion, application approval, admission, eligibility, or credential authenticity.
The presence of a template does not prove that HTML rendering, PDF conversion, storage, delivery, or access control has been implemented.
## 4. Design System
### 4.1 Brand Palette
Use the shared MedOrbits palette consistently.
| Token | Hex | Intended use |
|—|—|—|
| Deep Plum | `#100a17` | Primary dark backgrounds |
| Royal Plum | `#191023` | Main document surfaces |
| Burgundy Plum | `#21172b` | Secondary panels |
| Champagne Gold | `#c9a96e` | Borders, accents, and emphasis |
| Light Champagne | `#e4d0a1` | Headings and highlights |
| Soft Lavender | `#d9cce4` | Supporting text |
| Muted Text | `#b7acbf` | Secondary text |
| Primary Text | `#f7f1fa` | Main text on dark backgrounds |
Individual templates may use approved complementary palettes, such as sapphire blue and champagne gold, provided they remain consistent with MedOrbits branding and maintain readable contrast.
Color tokens alone do not guarantee accessibility. Check the contrast of actual foreground and background combinations.
### 4.2 Layout Standards
Templates should:
- Use standalone document layouts without website navigation or unrelated promotional sections.
- Include document-specific branding where appropriate.
- Maintain a clear hierarchy of titles, headings, labels, and content.
- Use readable typography, adequate spacing, and visible focus states for interactive controls.
- Support responsive previews and A4 printing unless another paper format is required.
- Handle long text, optional fields, and multi-page content.
- Avoid splitting important labels, totals, table rows, or signature areas across pages where feasible.
- Include print-specific styles that remove interactive controls and unnecessary decoration.
- Respect `prefers-reduced-motion` when animation is present.
- Avoid unnecessary external dependencies during production rendering.
- Use verified asset paths and ensure required assets are available to the rendering environment.
The document must remain understandable when decorative effects, external fonts, or animations are unavailable.
### 4.3 Standalone Documents
Document templates must not depend on the website’s dashboard, interactive navigation, or shared website header and footer.
Branding may be included within the document itself. Avoid adding unrelated website controls or promotional content to printable output.
Interactive actions, such as Print, Save as PDF, or Back, must not appear in the printed document.
## 5. Template Data and Rendering
### 5.1 Placeholder Convention
Templates may contain placeholders such as:
```text
{{documentTitle}}
{{candidateName}}
{{documentReference}}
{{generatedAt}}
```
This syntax is a placeholder convention, not a rendering engine. The implementation must use the actual template engine configured in the project.
Before relying on automatic escaping, conditional sections, loops, or missing-value handling, verify that the configured engine supports those features and that its configuration is secure.
### 5.2 Intended Rendering Workflow
The following describes the intended architecture, not a claim that each component already exists.
1. An authorized controller receives a document-generation request.
2. The appropriate service selects an allowlisted template.
3. The service retrieves authoritative records through the relevant repository or integration.
4. The requester’s identity, permissions, and access to the records are verified.
5. Required fields, identifiers, status values, and business rules are validated.
6. A minimal presentation object is prepared.
7. The configured template engine renders the HTML with context-appropriate escaping.
8. The document service returns the HTML or submits it to the configured PDF renderer.
9. Where implemented, the generated file is stored or delivered through an authorized workflow.
10. Access controls, audit requirements, retention policies, and cleanup procedures are applied.
Templates must not directly query databases, perform authorization, call payment providers, or manage files.
### 5.3 Data Validation
Validate data before rendering, including:
- Required fields and identifier formats.
- Amounts, currency codes, and financial precision.
- Dates, timestamps, and timezone assumptions.
- Status values against approved enumerations.
- Optional fields and maximum text lengths.
- URLs and permitted destinations.
- Nested structures and collection sizes.
- Document row counts and maximum output size.
- Business rules specific to the document type.
Use existing project validators or explicit schemas where available. Reject invalid required values rather than silently replacing them with plausible-looking data.
A template must not establish that a source record is genuine or that a business process has completed.
### 5.4 Missing Values
Handle optional and required values consistently:
- Reject missing required fields before rendering.
- Omit optional sections when the configured template engine supports safe conditional rendering.
- Use a meaningful neutral fallback only where omission is not possible.
- Never expose unresolved placeholder syntax to end users.
- Never fabricate names, dates, references, amounts, qualifications, or statuses.
- Avoid empty table rows and unexplained blank sections.
Do not assume that the template engine supports conditional blocks unless verified.
## 6. Security and Privacy
### 6.1 HTML and Context Safety
- Escape untrusted text according to its output context.
- Prefer automatic escaping when supported by the configured template engine.
- Never concatenate untrusted input into raw HTML.
- Do not allow arbitrary user-supplied HTML, JavaScript, or CSS.
- Validate URLs before rendering them as links.
- Apply URL scheme and destination restrictions.
- Avoid executable scripts and unnecessary external resources in generated documents.
- Treat HTML text, HTML attributes, URLs, CSS, and JavaScript as distinct output contexts.
- Use an allowlist-based sanitizer if rich HTML is explicitly required.
HTML escaping alone does not make arbitrary HTML safe for a browser-based PDF renderer.
Where possible, keep the rendering layer data-only and avoid inserting dynamic values into executable JavaScript or CSS.
### 6.2 Data Integrity and Authorization
- Retrieve application and counselling information from authoritative records.
- Retrieve payment information from the trusted transaction or payment service.
- Never trust client-submitted payment status, totals, tax amounts, or transaction references.
- Verify ownership and permissions before generating or retrieving documents.
- Prevent cross-user identifier manipulation from exposing private information.
- Apply business rules on the server before presenting approval or completion statuses.
- Minimize disclosure of personal, educational, and financial information.
- Use unpredictable document identifiers where appropriate, but never treat an unguessable identifier as a substitute for authorization.
### 6.3 File Protection
- Store private generated documents outside publicly served directories.
- Authorize every document retrieval.
- Keep internal storage paths and filesystem details private.
- Apply documented retention, deletion, and audit requirements.
- Avoid logging complete documents or sensitive field values.
- Remove temporary files after successful and failed generation attempts.
- Do not expose private documents through unrestricted static-file hosting.
- Ensure that storage errors do not disclose internal infrastructure details.
## 7. Template-Specific Requirements
### 7.1 Application Summary
- Use authoritative application records for references, status, and submission details.
- Distinguish submitted, pending, approved, rejected, and other supported statuses.
- Do not imply admission or approval unless the underlying authorized record confirms it.
- Avoid unnecessary identity or document details.
### 7.2 Payment Receipt
- Use trusted transaction records.
- Verify the transaction state before representing payment as completed.
- Calculate financial totals using decimal-safe arithmetic.
- Use valid currency codes and consistent amount formatting.
- Include tax and business details only when verified.
- Do not label a receipt as a tax invoice unless the applicable requirements are met.
- Keep receipt references traceable to authoritative transaction records.
### 7.3 Counselling Summary
- Present session details and recommendations accurately.
- Distinguish adviser recommendations from confirmed institutional requirements.
- Do not guarantee admission, employment, scholarships, eligibility, or other outcomes.
- Limit disclosure of sensitive student information.
- Make follow-up actions understandable and specific.
### 7.4 Resume
- Preserve candidate-provided facts without inventing qualifications or experience.
- Escape all candidate-provided text.
- Validate profile URLs before rendering clickable links.
- Avoid unnecessary sensitive personal information.
- Keep headings and content readable across multiple pages.
- Prefer conventional text-based sections for compatibility with applicant tracking systems (ATS).
- Do not claim ATS compatibility has been verified without testing the actual output.
### 7.5 Document Checklist
- Distinguish required, optional, received, pending, and rejected documents using approved values.
- Base requirements on the relevant application route or authoritative source.
- Do not imply that a checklist guarantees acceptance or completeness.
- Restrict access to document names and notes when they reveal sensitive information.
- Ensure status labels are understandable without relying on color alone.
## 8. PDF Conversion
PDF conversion must use a dedicated, controlled document-generation service.
Production requirements:
- Run the renderer with restricted operating-system permissions.
- Do not accept arbitrary user HTML or scripts as trusted rendering input.
- Disable unnecessary network access, especially access to internal services.
- Prevent access to cloud metadata endpoints, local secrets, and application files.
- Restrict filesystem access to explicitly permitted temporary directories.
- Enforce execution-time, CPU, memory, page-count, and output-size limits.
- Validate generated output and clean up temporary files.
- Pin and maintain the rendering engine and its dependencies.
- Handle crashes, timeouts, and malformed documents without leaking internal errors.
- Test print layout in the actual browser or PDF rendering environment.
Browser-based PDF renderers can introduce server-side request forgery (SSRF) and other risks if they can access arbitrary URLs or internal resources. Input validation and HTML escaping are not substitutes for network and operating-system restrictions.
## 9. Integration Boundaries
| Module | Responsibility |
|—|—|
| `src/controllers/` | Handles authorized requests and standardized responses. |
| `src/services/` | Coordinates document workflows and prepares validated presentation data. |
| `src/repositories/` | Retrieves authoritative application and transaction records. |
| `src/workers/` | Processes queued generation tasks, where implemented. |
| `src/integrations/storage/` | Stores and retrieves files through the configured storage adapter, where implemented. |
| `src/templates/documents/` | Defines document presentation and layout. |
These paths describe intended responsibilities. Confirm the actual repository structure before assuming that a particular module or integration exists.
Keep templates independent of database queries, authorization logic, payment-provider operations, filesystem management, and storage implementation details.
## 10. Testing Checklist
### Template and Rendering Tests
- [ ] Every documented template exists in the repository.
- [ ] Each template renders using the configured engine.
- [ ] Required variables are validated.
- [ ] Missing optional fields render safely.
- [ ] Invalid and unexpected values are handled appropriately.
- [ ] Untrusted values are escaped in their output contexts.
- [ ] Invalid amounts, dates, identifiers, and statuses are rejected.
- [ ] Long text and multi-page layouts are handled correctly.
- [ ] Tables and key content avoid awkward page breaks where feasible.
- [ ] Print output is checked in the actual rendering environment.
- [ ] Contrast and readability are reviewed.
- [ ] No unresolved placeholders appear in final output.
- [ ] Missing assets and unavailable external fonts do not make documents unusable.
### Business and Security Tests
- [ ] Payment receipts use authoritative transaction records.
- [ ] Financial totals and currency formatting are verified.
- [ ] Application and counselling statuses come from authorized records.
- [ ] Unauthorized generation requests are rejected.
- [ ] Unauthorized retrieval requests are rejected.
- [ ] Cross-user identifier manipulation does not disclose private documents.
- [ ] URL and renderer network restrictions are tested.
- [ ] Generated files follow retention and deletion policies.
- [ ] PDF rendering is sandboxed and resource-limited.
- [ ] Temporary files are cleaned up after success and failure.
- [ ] Sensitive information is excluded from application logs.
Use synthetic data in automated tests. Do not include real applicant documents, personal identifiers, or payment details in fixtures or test logs.
## 11. Implementation Status
This README documents the intended template organization, design standards, architecture, and security requirements. It does not confirm that the described functionality has been implemented.
Before reporting a capability as available, verify the actual:
- Template files and rendering engine.
- Document-generation service.
- Data validation and authorization paths.
- PDF renderer and sandbox configuration.
- Storage adapter and retrieval controls.
- Retention, deletion, and audit mechanisms.
- Automated tests and deployment configuration.
Do not infer implementation status from the existence of HTML templates or documentation.
—
**MedOrbits — Study · Work · Grow**
Standalone documents designed for consistent presentation, data integrity, privacy, and controlled access.