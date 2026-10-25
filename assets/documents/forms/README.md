Copy this into /assets/documents/forms/README.md.
# Forms Directory — MedOrbits
**Project:** MedOrbits
**Directory:** `assets/documents/forms/`
**Document Type:** Application forms, registration forms, checklists, and structured data-collection forms
**Version:** 1.0.0
**Last Updated:** 2026-10-25
—
## 1. Purpose
The `forms/` directory organises forms used by MedOrbits to support education counselling, admissions guidance, course enquiries, document preparation, career assistance, recruitment, and other authorised services.
Forms should make it easy for users to understand what information is required, complete the necessary fields, provide supporting documents where appropriate, and review their entries before submission.
This directory may contain:
- Education and course enquiry forms.
- Student registration forms.
- MBBS, BDS, BAMS, BUMS, and other course application-preparation forms.
- Counselling and admission-guidance forms.
- Document checklists and declaration forms.
- Scholarship assistance enquiry forms.
- Career guidance and job registration forms.
- Recruitment and employer enquiry forms.
- Consent and acknowledgement forms.
- Feedback and support request forms.
- Printable PDF forms and reusable form templates.
**Important:** A MedOrbits form is not an official government, examination, counselling, university, college, employer, or regulatory form unless its official origin and authorised use have been verified.
—
## 2. Recommended Directory Structure
The following is a suggested structure. Create only the folders and files required by the project.
```text
assets/
└── documents/
    └── forms/
        ├── README.md
        ├── admissions/
        │   └── README.md
        ├── course-enquiries/
        │   └── README.md
        ├── counselling/
        │   └── README.md
        ├── document-preparation/
        │   └── README.md
        ├── scholarships/
        │   └── README.md
        ├── careers/
        │   └── README.md
        ├── recruitment/
        │   └── README.md
        ├── consent/
        │   └── README.md
        ├── feedback/
        │   └── README.md
        ├── support/
        │   └── README.md
        ├── pdf/
        │   └── README.md
        ├── templates/
        │   └── README.md
        └── metadata/
            └── README.md
```
### Directory responsibilities
| Directory | Purpose |
|—|—|
| `admissions/` | Forms supporting admissions guidance and application preparation. |
| `course-enquiries/` | Course enquiries and requests for information. |
| `counselling/` | Education counselling enquiries and preference-gathering forms. |
| `document-preparation/` | Document checklists and application-document preparation forms. |
| `scholarships/` | Scholarship information and assistance enquiries. |
| `careers/` | Career guidance and job-seeker registration. |
| `recruitment/` | Recruitment enquiries and candidate application forms. |
| `consent/` | Consent, acknowledgement, and declaration templates. |
| `feedback/` | Service feedback and user experience forms. |
| `support/` | Help requests and technical support forms. |
| `pdf/` | Approved downloadable or printable PDF forms. |
| `templates/` | Reusable source templates for creating consistent forms. |
| `metadata/` | Structured form descriptions and publishing metadata. |
This layout is illustrative and does not confirm that all listed files or folders currently exist.
—
## 3. Supported Form Formats
Choose the format based on the purpose, user experience, and information-security requirements.
| Format | Use |
|—|—|
| `.html` | Browser-based forms with validation and responsive layouts. |
| `.pdf` | Printable forms or fillable PDF documents. |
| `.md` | Form instructions, field specifications, and supporting documentation. |
| `.json` | Form definitions, field metadata, and controlled option lists. |
| `.csv` | Approved data-import or export templates that do not expose private records. |
| `.docx` | Editable office forms where an editable document is required. |
Use a consistent source-of-truth approach. If a PDF is generated from an HTML or document template, keep the editable source under version control and verify that the exported PDF matches the approved version.
—
## 4. Form Design Principles
Every form should be clear, accessible, secure, and suitable for its intended users.
### 4.1 Clarity
- Use a descriptive title.
- Explain the purpose before requesting information.
- Divide long forms into logical sections.
- Use familiar labels and short instructions.
- Identify required fields clearly.
- Explain why sensitive information is necessary.
- Show applicable fees, deadlines, eligibility conditions, and limitations only when verified.
- Provide a review step for lengthy or consequential submissions.
### 4.2 Accessibility
- Associate every input with a visible label.
- Use appropriate HTML input types.
- Support keyboard navigation.
- Provide meaningful validation messages.
- Maintain sufficient text and control contrast.
- Avoid relying on colour alone to indicate errors.
- Make forms usable on mobile screens.
- Keep buttons and controls large enough to operate comfortably.
- Provide accessible alternatives to CAPTCHA or other interaction barriers where feasible.
- Preserve readable text and logical field order in PDF forms.
### 4.3 Consistency
Use consistent field labels, date formats, button text, error messages, and status terminology across MedOrbits forms.
Do not change the meaning of a field between forms without documenting the difference.
—
## 5. Standard Form Structure
Where appropriate, use the following structure.
1. **Form title:** Name the task or application.
2. **Introduction:** Explain the purpose and intended audience.
3. **Instructions:** Describe prerequisites and how to complete the form.
4. **Applicant or requester details:** Collect only the information needed.
5. **Request details:** Capture the specific course, service, or support request.
6. **Supporting documents:** Explain which documents are required and acceptable formats.
7. **Consent and declarations:** Present applicable notices and acknowledgements.
8. **Review:** Allow users to check their entries before submission.
9. **Submission:** Explain what happens after the form is submitted.
10. **Confirmation:** Provide a reference number or other confirmation when supported by the application.
11. **Support:** Explain how to report a problem or request assistance.
Not all forms require every section. Keep simple enquiries short and avoid collecting unnecessary information.
—
## 6. Education and Admissions Forms
Education-related forms may support enquiries or application preparation for MBBS, BDS, BAMS, BUMS, nursing, paramedical programmes, undergraduate courses, postgraduate courses, and other education pathways.
Depending on the service, relevant fields may include:
- Applicant’s name.
- Preferred contact method.
- Email address or telephone number, when necessary.
- Course of interest.
- Preferred institution or location.
- Academic qualification details relevant to the request.
- Examination or counselling year.
- General enquiry or assistance required.
- Preferred language for communication.
Collect examination roll numbers, identity-document details, certificates, marksheets, or other sensitive information only when genuinely necessary and through an appropriate secure process.
### Admissions-specific requirements
- Clearly state the academic year.
- Identify the official authority responsible for the admission process.
- Separate optional preferences from mandatory eligibility requirements.
- Verify dates, fees, eligibility rules, and required documents against current official sources.
- Avoid promising admission, a seat, a rank, or a particular counselling outcome.
- Explain whether the form is an enquiry, a MedOrbits service request, or an official application.
**Official-form distinction:** A MedOrbits enquiry or preparation form must not be presented as a substitute for the relevant official application or counselling portal.
—
## 7. Career and Recruitment Forms
Career and recruitment forms should make the purpose of candidate registration clear.
Potential fields include:
- Name.
- Preferred contact information.
- Job category or target role.
- Skills and qualifications relevant to the role.
- Experience level.
- Preferred work location.
- Availability, where relevant.
- CV or résumé upload, if required.
- Consent and privacy acknowledgement.
Only request information needed for the stated recruitment or career-support purpose.
### Employment form requirements
- Identify whether the form is for career guidance, job registration, recruitment, or a specific vacancy.
- Verify vacancy details before linking a form to a job.
- Do not invent employers, job titles, salaries, selection criteria, or deadlines.
- Do not imply that registration guarantees a job, interview, or placement.
- Explain how candidates can correct inaccurate submissions or contact support.
- Do not collect passwords, one-time passcodes, payment card details, or other credentials.
- Treat identity documents and employment records as sensitive information.
If an employer requires additional documents, explain the purpose and use an appropriately secured submission method.
—
## 8. Consent, Declarations, and Acknowledgements
Consent and declaration forms must use clear language that explains the action being agreed to.
Where applicable, explain:
- Who is collecting the information.
- Why the information is being collected.
- What information is required.
- How the information will be used.
- Whether information may be shared with a service provider or other recipient.
- How long information may be retained, where established.
- How the user can contact the responsible organisation.
- Whether consent is optional or required for the requested service.
Do not bundle unrelated permissions into a single mandatory checkbox.
A user must not be shown a preselected consent checkbox where affirmative, informed consent is required. Do not state that consent has been recorded unless the system actually records it.
Declarations must not misrepresent official eligibility, institutional approval, legal status, or the authority of MedOrbits.
Have legal or compliance-sensitive wording reviewed by an appropriate professional before publication.
—
## 9. File Upload Requirements
If a form accepts documents, provide clear upload instructions.
Specify:
- Accepted file types.
- Maximum file size.
- Maximum number of files.
- Whether multiple pages should be combined into one PDF.
- Required file quality and orientation.
- Whether password-protected files are accepted.
- What happens if an upload fails.
- Whether the user can replace a file before submission.
### Recommended upload practices
- Validate file type and size on the server, not only in the browser.
- Do not trust a filename or browser-provided MIME type as proof of file contents.
- Use secure storage outside the publicly served assets directory for private applicant documents.
- Restrict file access to authorised users.
- Apply malware scanning and other appropriate file-safety controls.
- Use randomised storage identifiers rather than exposing personal details in file paths.
- Avoid public document URLs for confidential uploads.
- Define retention and deletion procedures.
- Provide a clear error message when an upload is rejected.
A file input in HTML does not, by itself, securely store or submit an uploaded document. Upload processing requires a correctly configured backend or authorised document-storage service.
—
## 10. Privacy and Data Protection
Forms must follow the applicable privacy policy and the project’s actual data-handling practices.
Before publishing a form, confirm:
- What information is collected.
- Why each field is necessary.
- Which fields are optional.
- Where the submitted data is sent.
- Who can access it.
- How it is protected.
- Whether third-party services process it.
- How long it is retained.
- How correction, deletion, or other applicable requests are handled.
### Data minimisation
Do not collect personal information simply because it might be useful later. Remove unnecessary fields and explain the purpose of sensitive fields.
### Public and private files
The `assets/documents/forms/` directory may contain public form templates and blank PDFs. It must not be used as a public storage location for completed applications, identity documents, marksheets, medical records, CVs, or other confidential submissions.
### Security
- Use HTTPS for forms that transmit personal data.
- Keep API keys and credentials out of HTML and JavaScript delivered to browsers.
- Enforce server-side access controls.
- Protect endpoints against spam, abuse, and unauthorised access.
- Validate and sanitise input on the server.
- Avoid logging sensitive form values unnecessarily.
- Use CSRF protection where applicable to the authentication and request architecture.
- Apply rate limiting and other relevant abuse controls.
Do not claim a form is secure or compliant merely because it contains a privacy notice. Security depends on the actual implementation and operational controls.
—
## 11. HTML Form Implementation
Browser-based forms should use semantic HTML and appropriate validation.
Illustrative example:
```html
<form action=“/api/enquiries” method=“post”>
  <fieldset>
    <legend>Course enquiry</legend>
    <label for=“course”>Course of interest</label>
    <select id=“course” name=“course” required>
      <option value=“”>Select a course</option>
      <option value=“mbbs”>MBBS</option>
      <option value=“bds”>BDS</option>
      <option value=“bams”>BAMS</option>
      <option value=“bums”>BUMS</option>
    </select>
    <label for=“email”>Email address</label>
    <input
      id=“email”
      name=“email”
      type=“email”
      autocomplete=“email”
      required
    >
    <label for=“message”>How can we help?</label>
    <textarea
      id=“message”
      name=“message”
      rows=“4”
      maxlength=“2000”
    ></textarea>
    <button type=“submit”>Submit enquiry</button>
  </fieldset>
</form>
```
This snippet is illustrative and is not a complete production form. The example endpoint must exist and implement appropriate server-side validation, rate limiting, privacy safeguards, error handling, and submission processing before the form is deployed.
### Implementation rules
- Use the correct HTTP method for the operation.
- Never place secrets in browser-delivered code.
- Validate all input on the server.
- Encode output appropriately to prevent injection vulnerabilities.
- Display understandable success and error states.
- Prevent duplicate submissions where necessary.
- Do not report success until the server confirms successful processing.
- Ensure the form’s `action` points to a real, approved endpoint.
- Avoid unnecessary local-development URLs in production pages.
—
## 12. PDF Forms
PDF forms may be provided for printing, offline completion, or digital form entry.
Before publishing a PDF, verify:
- Text is readable at normal zoom and on mobile devices.
- Fonts are embedded where appropriate.
- Form fields have meaningful names and labels.
- Required fields are identified.
- Field order follows the intended reading sequence.
- Page margins and print layout are correct.
- Checkboxes and signature areas are usable.
- Instructions and privacy notices are included where necessary.
- The document has appropriate accessibility features.
- The filename and version match the approved source.
- The PDF opens correctly in commonly used viewers.
If a form must be submitted online, explain the submission procedure and any file restrictions. Do not imply that completing a downloadable PDF automatically submits it to MedOrbits.
—
## 13. Form Metadata
Where forms are listed dynamically on the website, maintain structured metadata in a separate file.
Illustrative JSON record:
```json
{
  “id”: “course-enquiry”,
  “title”: “Course Enquiry Form”,
  “category”: “course-enquiries”,
  “description”: “Submit an enquiry about available education guidance services.”,
  “format”: “html”,
  “path”: “pages/course-enquiry.html”,
  “status”: “draft”,
  “version”: “1.0.0”,
  “language”: “en”,
  “requiresAuthentication”: false,
  “acceptsUploads”: false,
  “lastReviewed”: null
}
```
This is an example record only. It does not confirm that the referenced HTML page exists or that the form is implemented.
Metadata guidelines:
- Use unique, stable IDs.
- Keep paths aligned with the actual repository.
- Define allowed categories and status values.
- Validate JSON before deployment.
- Do not place submitted personal data in public metadata.
- Avoid publishing draft forms as approved forms.
- Ensure the metadata accurately describes the form’s actual behaviour.
—
## 14. Naming and Versioning
Use descriptive, lowercase filenames with hyphens.
Recommended examples:
```text
course-enquiry-form.html
mbbs-admission-guidance-form.html
document-checklist.pdf
career-registration-form.html
job-application-form.html
feedback-form.html
privacy-acknowledgement.pdf
```
Avoid ambiguous names such as `form-new-final2.html`.
### Versioning
- `1.0.0` — first approved release.
- `1.1.0` — compatible additions or improvements.
- `1.0.1` — minor corrections that do not change the form’s intended behaviour.
- `2.0.0` — a major change to the form structure, requirements, or processing.
When a form collects consent, changes eligibility questions, or changes how data is used, assess whether the change requires renewed notice or consent rather than treating it as a cosmetic update.
—
## 15. Testing and Quality Assurance
Test forms before publication and whenever significant changes are made.
### Functional tests
- [ ] All expected fields render correctly.
- [ ] Required fields are enforced.
- [ ] Validation messages are understandable.
- [ ] Valid submissions reach the intended backend.
- [ ] Invalid submissions are rejected safely.
- [ ] Upload restrictions work on the server.
- [ ] Duplicate submissions are handled appropriately.
- [ ] Success messages appear only after confirmed processing.
- [ ] Error states provide a useful next step.
- [ ] Form links and downloads work in production.
### Accessibility and usability tests
- [ ] Every input has a visible label.
- [ ] Keyboard navigation works.
- [ ] Focus states are visible.
- [ ] Errors are associated with the relevant fields.
- [ ] Layout adapts to mobile and desktop screens.
- [ ] Text and controls have sufficient contrast.
- [ ] Long forms are organised into clear sections.
- [ ] PDF documents remain readable and printable.
### Privacy and security tests
- [ ] Only necessary information is collected.
- [ ] Privacy information is accessible before submission.
- [ ] Sensitive files are not stored in public directories.
- [ ] Server-side validation and access controls are enabled.
- [ ] Secrets are not exposed in browser code.
- [ ] Logs do not unnecessarily capture sensitive submissions.
- [ ] Retention and deletion procedures are documented.
- [ ] External integrations are identified and reviewed.
—
## 16. Publication Workflow
Use the following workflow for new or updated forms.
1. **Define the requirement:** Identify the service and the purpose of the form.
2. **Design the fields:** Include only necessary questions and supporting documents.
3. **Prepare the content:** Write clear instructions and appropriate notices.
4. **Review the legal and privacy implications:** Confirm consent, data handling, and any relevant licence requirements.
5. **Implement the form:** Build the HTML or PDF and configure its submission workflow.
6. **Test the form:** Verify validation, accessibility, mobile layout, and security.
7. **Review the destination:** Confirm the backend or authorised submission channel exists.
8. **Approve the release:** Assign the appropriate publication status.
9. **Publish:** Link the form from the relevant website page.
10. **Maintain:** Monitor errors and update the form when requirements change.
Recommended statuses:
- `draft`
- `in_review`
- `approved`
- `published`
- `needs_update`
- `archived`
Use these statuses consistently if the project implements a publishing workflow.
—
## 17. Troubleshooting
### The submit button does nothing
Check browser-console errors, form event handling, endpoint configuration, network requests, and server logs. Confirm that JavaScript is not preventing submission unexpectedly.
### The form returns a server error
Verify the API route, request method, validation rules, server configuration, database connection, and backend logs. Do not expose stack traces or secrets to end users.
### File uploads fail
Check the server-side size limit, permitted formats, storage permissions, network limits, and any configured malware scanning. Ensure the error message explains how to correct the problem.
### The PDF cannot be filled in
Confirm whether the PDF contains interactive form fields or is intended for printing only. If digital completion is required, generate and test a properly fillable PDF.
### A form collects information that is no longer required
Review the service requirements, remove unnecessary fields, and update the privacy notice and processing logic where necessary.
### The form appears to submit twice
Check repeated clicks, retries, network behaviour, and server-side duplicate handling. Use appropriate submission controls and idempotency measures when relevant.
### The form is linked to the wrong page
Check the actual repository path, production URL, and deployment configuration. Update the link and test it from the page where users access the form.
—
## 18. Related Directories
| Directory | Purpose |
|—|—|
| `/assets/documents/` | Main public-document directory. |
| `/assets/documents/guides/` | Instructions for completing forms and using services. |
| `/assets/documents/templates/` | Reusable document and form templates. |
| `/assets/documents/policies/` | Policies, privacy notices, and procedural documentation. |
| `/assets/documents/licences/` | Licence records and third-party permissions. |
| `/assets/documents/metadata/` | Structured metadata for document assets. |
| `/assets/documents/officials/` | Official-document references and verification records. |
Confirm that each referenced path exists before using it in website links or deployment configuration.
—
## 19. Disclaimer
MedOrbits forms are intended to support the services described on the relevant page. Completing a form does not automatically establish eligibility, guarantee admission, secure a scholarship, confirm recruitment, or create an official application with a third-party authority.
Users must follow the applicable official process and verify important requirements with the responsible organisation. All claims about data processing, security, consent, and service outcomes must reflect the actual implementation and published policies.
—
## 20. Final Checklist
- [ ] Create `/assets/documents/forms/README.md`.
- [ ] Add only the form categories required by the project.
- [ ] Use consistent names, labels, and field validation.
- [ ] Keep blank public templates separate from private submissions.
- [ ] Verify official references and time-sensitive requirements.
- [ ] Implement secure server-side processing for online submissions.
- [ ] Review privacy, consent, and accessibility.
- [ ] Test HTML and PDF forms before release.
- [ ] Verify every link and submission destination.
- [ ] Maintain versions and review forms when requirements change.
**End of README**