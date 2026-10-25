MedOrbits Support Guide

Document: docs/SUPPORT_GUIDE.md
Project: MedOrbits
Purpose: Standardise customer support, issue triage, escalation, resolution, and follow-up across the MedOrbits platform.

⸻

1. Purpose and Scope

This guide defines how MedOrbits support requests should be received, categorised, investigated, resolved, and escalated.

It covers support related to:

* User accounts, registration, login, and account recovery
* Courses, colleges, universities, and educational information
* NEET, MBBS, BDS, AYUSH, paramedical, and other admission guidance
* Applications, submissions, uploaded documents, and status tracking
* Official documents and resource links
* Payments, receipts, failed transactions, and refund requests
* Technical errors, website performance, and accessibility
* Privacy requests, suspected account compromise, and data concerns
* Consultancy services, career assistance, and recruitment support

This document describes the recommended support workflow. Features, contact channels, service-level targets, and automated actions must be aligned with the actual implementation before being advertised as available.

2. Support Principles

Every support interaction should follow these principles:

1. Clarity: Explain the issue and next steps in plain language.
2. Accuracy: Verify admission, examination, fee, and eligibility information against authoritative sources.
3. Privacy: Request only the information necessary to resolve the issue.
4. Security: Never request passwords, OTPs, complete card details, or authentication tokens.
5. Accountability: Maintain a clear owner, status, and history for each support case.
6. Accessibility: Provide understandable instructions and alternatives where possible.
7. Transparency: Communicate known limitations, dependencies, and expected next steps without promising an unverified resolution date.
8. Traceability: Record relevant actions and decisions without unnecessarily copying sensitive data into support notes.

3. Support Channels

Use only contact channels that MedOrbits has actually configured and published.

Channel	Intended use
Website support form	General questions and service requests
Support ticket system	Trackable issues requiring investigation
Official support email	Written enquiries and follow-up
Account dashboard	Application or account-related requests, if implemented
Payment support form	Transaction investigation and refund enquiries
Privacy or security contact	Personal-data requests, suspected compromise, and security disclosures

Configuration requirements

Before publication, confirm:

* The actual support email address and telephone number, if applicable.
* The support form URL and whether ticket creation is functional.
* Whether users can attach files securely.
* Whether ticket status updates and email notifications are operational.
* The published support hours and any response-time commitments.
* The correct privacy, grievance, and security reporting contacts.

Do not publish placeholder addresses or imply that an unconfigured channel is monitored.

4. Ticket Categories

Assign each request a category and, where useful, a subcategory.

Category	Examples	Typical initial action
Account	Login failure, registration, profile changes	Verify the account and investigate authentication
Admissions	Eligibility, counselling, deadlines, course selection	Check current official sources
Educational resources	Broken links, incorrect details, missing resources	Verify the resource and report content defects
Applications	Submission failure, missing confirmation, status discrepancy	Check application records and submission events
Documents	Upload errors, file rejection, access problems	Verify file constraints and storage status
Payments	Failed, pending, duplicate, or unrecognised payment	Reconcile transaction and provider records
Refunds	Refund eligibility, pending refund, disputed amount	Check the applicable terms and transaction state
Technical	Broken page, JavaScript error, slow response	Reproduce and diagnose the issue
Privacy	Data access, correction, deletion, or privacy concern	Route to the authorised privacy process
Security	Suspected account takeover, data exposure, vulnerability	Escalate immediately to the designated security owner
Consultancy	Guidance, service scope, follow-up	Route to the responsible service team
Feedback	Suggestions, complaints, accessibility feedback	Record, assess, and route to the relevant owner

Avoid including unnecessary personal or medical information in category labels, ticket titles, analytics, or notification previews.

5. Priority and Severity

Set priority according to impact, urgency, scope, and risk. The following targets are proposed internal targets, not promises to customers. Adopt them only after confirming staffing and operational capacity.

Priority	Description	Examples	Suggested initial response target
P1 — Critical	Active security incident, confirmed exposure of sensitive data, or widespread critical outage	Suspected document exposure, site-wide failure	Within 1 hour during monitored coverage
P2 — High	Major feature unavailable or a time-critical application/payment issue affecting multiple users	Application submission failure near an official deadline	Within 4 business hours
P3 — Normal	Individual issue with a workaround available	Login issue, broken resource link	Within 1 business day
P4 — Low	General enquiry, suggestion, or non-urgent improvement	Feature request, minor content correction	Within 3 business days

These are initial-response targets, not guaranteed resolution times. Business hours, holidays, staffing, external-provider delays, and published terms may affect handling.

Priority escalation rules

Increase priority when:

* An official admission, counselling, examination, or submission deadline is imminent.
* A user may lose access to an application or payment record.
* Multiple users report the same failure.
* Personal information or uploaded documents may have been exposed.
* A suspected fraudulent transaction or account compromise is reported.
* An official source contradicts information currently published on MedOrbits.

Security incidents must be routed through the security response process rather than handled solely as ordinary customer support.

6. Ticket Lifecycle

Use a consistent lifecycle for each support request.

1. Received: The request has arrived.
2. Acknowledged: A ticket reference and next-step information have been provided, where supported.
3. Triaged: Category, priority, impact, and ownership are assigned.
4. In progress: Investigation or resolution is underway.
5. Waiting for user: Necessary information is outstanding.
6. Waiting for third party: A payment provider, institution, or other external party must respond.
7. Resolved: A solution or verified answer has been provided.
8. Closed: The case is complete under the published closure policy.
9. Reopened: The user reports that the issue persists or the proposed resolution was unsuccessful.

Record each status transition with a timestamp and responsible actor where the system supports it.

A ticket should not be marked resolved solely because a reply was sent. The reply must address the reported issue or clearly explain what remains outstanding.

7. Ticket Intake Requirements

Collect only information relevant to the reported problem.

Recommended fields

* Ticket subject
* Issue category and subcategory
* Description of the problem
* Affected page or feature
* Approximate date and time of the incident
* Error message or error code, if available
* Browser and device information, when relevant
* Relevant application or transaction reference, when necessary
* Preferred reply channel
* Optional attachment, if the support system securely supports uploads

Do not request through ordinary support forms

* Account passwords or OTPs
* Full payment-card numbers, CVV codes, or banking PINs
* API keys, session cookies, access tokens, or recovery secrets
* Unredacted identity documents when a reference number is sufficient
* Complete medical records when they are not necessary for the enquiry

For identity verification, use an approved verification workflow. Never ask a user to send authentication secrets in a support reply.

8. Standard Investigation Workflow

For each ticket:

1. Read the request and identify the user’s desired outcome.
2. Check for duplicate or related tickets.
3. Confirm the category, priority, and responsible team.
4. Review the minimum necessary account, application, document, or transaction records using authorised access.
5. Reproduce technical issues in a safe environment when possible.
6. Verify factual claims against current official sources where appropriate.
7. Record the investigation, relevant references, and actions taken.
8. Explain the result and next steps to the user.
9. Escalate unresolved or high-risk issues to the correct owner.
10. Confirm resolution or follow the configured closure policy.

Never alter an application, transaction, document, or account record merely to make a ticket appear resolved. Follow the relevant authorisation and audit requirements.

9. Issue-Specific Procedures

9.1 Account and Login Issues

Check:

* Whether the user is using the correct login method.
* Whether registration or email/phone verification is complete.
* Whether the account is locked, disabled, or subject to a security restriction.
* Whether the problem can be reproduced across supported browsers.
* Whether authentication service errors or session failures are occurring.

Provide the approved account recovery process. Do not disclose whether a particular email address or phone number belongs to an account unless the disclosure is authorised and appropriate.

If compromise is suspected, escalate to security and follow the account-containment process.

9.2 Admissions and Educational Information

For eligibility, counselling, examinations, deadlines, fees, seat allocation, and document requirements:

1. Identify the relevant examination, course, institution, jurisdiction, and admission cycle.
2. Locate the responsible official authority.
3. Verify the current notice, prospectus, schedule, or regulation.
4. Record the source URL, publication date where available, and date checked.
5. Distinguish confirmed facts from general guidance or unresolved questions.
6. Correct inaccurate MedOrbits content through the approved content-maintenance workflow.

Do not guarantee admission, seat allocation, examination results, eligibility, scholarships, employment, or visa approval.

If an official source is ambiguous or unavailable, state that the requirement needs confirmation from the responsible authority.

9.3 Application and Submission Issues

Check:

* The application reference and authenticated user context.
* Whether required fields and files were accepted.
* Whether the submission request reached the backend.
* Whether the database record and submission timestamp exist.
* Whether duplicate submissions were created.
* Whether a confirmation message failed after successful submission.

Do not advise users to resubmit repeatedly until the original submission state has been checked. Where safe, use idempotent operations or an approved reconciliation procedure to avoid duplicate records.

When an official deadline is near, prioritise investigation and explain any verified alternative submission route. Do not claim an application was submitted unless the record confirms it.

9.4 Document Upload and Access Issues

Check:

* Permitted file types and maximum size.
* Whether the file is corrupted, encrypted, or unsupported.
* Whether the upload completed or failed midway.
* Whether the stored document is associated with the correct user and application.
* Whether access permissions and download links are valid.
* Whether malware scanning or processing is pending, if configured.

Treat uploaded documents as sensitive. Do not send them to personal email accounts, public file-sharing services, or unauthorised third parties.

If a document may have been exposed, escalate immediately to security. Preserve relevant evidence according to the incident-response policy and restrict access where authorised.

9.5 Payment and Refund Issues

Collect the minimum necessary information, such as:

* Transaction reference or provider-generated payment ID
* Approximate transaction date and amount
* Currency, if relevant
* Order or application reference
* A concise description of the observed problem

Investigate payment status using authorised backend records and the payment provider’s dashboard or API, if integrated.

Distinguish clearly between:

* Payment initiated
* Payment pending
* Payment failed
* Payment successful
* Refund requested
* Refund processing
* Refund completed
* Payment status requiring provider reconciliation

A user’s bank statement and the application’s displayed status may update at different times. Verify the transaction before advising a retry.

Never request a CVV, PIN, password, OTP, or full card number. Do not promise a refund or completion date unless supported by the applicable terms and verified provider information.

For suspected unauthorised payments, direct the user to the appropriate bank or payment provider reporting channel and escalate internally.

9.6 Technical Errors

Capture:

* Affected URL and feature
* Steps to reproduce
* Expected and actual behaviour
* Error message or code
* Browser, operating system, and device where relevant
* Approximate occurrence time and timezone
* Whether the issue affects one user or multiple users

Check application logs, API responses, network failures, recent deployments, dependency errors, and service health as appropriate.

Do not ask users to disable security protections, expose session cookies, or run unsafe commands. Request screenshots only when helpful, and ask users to redact personal or financial information.

9.7 Privacy Requests

Route requests involving access, correction, deletion, consent, retention, or personal-data concerns to the designated privacy owner.

Before acting:

1. Verify the requester using an approved process.
2. Identify the relevant records and systems.
3. Confirm the applicable legal, contractual, and retention requirements.
4. Obtain the necessary internal approval.
5. Complete the authorised action and record its outcome.
6. Communicate the result and any applicable limitations.

Do not promise immediate deletion if legal obligations, dispute preservation, backups, or other valid constraints apply. Follow the published privacy policy and applicable law.

9.8 Security Reports

Treat suspected vulnerabilities, unauthorised access, exposed documents, account takeover, credential leaks, and suspicious administrative activity as security-sensitive.

* Escalate immediately to the designated security owner.
* Do not reproduce an exploit against production without explicit authorisation.
* Restrict distribution of evidence to people who need it.
* Preserve relevant logs and timestamps according to the incident-response policy.
* Avoid posting incident details in public support replies.
* Follow docs/SECURITY.md and the incident-response procedure.

Do not ask a reporter to send passwords, live access tokens, or other secrets to prove the issue.

10. Escalation Matrix

Issue	Primary owner	Escalate when
Account and access	Support / engineering	Suspected compromise, repeated authentication failures, or privilege issues
Admissions content	Content / admissions specialist	Official sources conflict or a deadline-sensitive answer remains uncertain
Applications	Application operations / engineering	Submission state is inconsistent, records are missing, or duplicate actions occur
Document handling	Engineering / security	Access control fails or exposure is suspected
Payments and refunds	Finance / payment operations	Provider reconciliation fails, duplicate charges appear, or fraud is suspected
Technical outage	Engineering / operations	Multiple users are affected or service availability is materially impaired
Privacy request	Privacy owner	Identity, retention, legal basis, or fulfilment is uncertain
Security incident	Security owner	Any credible indication of unauthorised access, data exposure, or exploitation
Complaint or service dispute	Support lead / management	The case remains unresolved or requires a policy exception

Replace role names with actual team assignments and escalation contacts in the operational version of this guide.

11. Communication Standards

Every response should contain, where applicable:

* A brief acknowledgement of the issue.
* The ticket reference.
* What has been verified.
* What is still being investigated.
* Any action the user needs to take.
* The next update point or a realistic timeframe, if known.
* A warning not to share passwords, OTPs, or payment secrets.

Use neutral, respectful language. Avoid blame, unexplained technical jargon, unverified assurances, and guarantees that depend on external authorities or providers.

Example: Technical issue acknowledgement

Thank you for reporting this issue to MedOrbits. We are reviewing the affected feature and the information you provided. Please share the exact error message and the approximate time the issue occurred, if available. Do not include passwords, OTPs, or payment-card security details. We will update you when we have verified the next steps.

Example: Application status enquiry

We will check the application reference and the recorded submission status before advising you to submit again. Please provide the relevant application reference through the approved support channel. If an official deadline is approaching, mention it in your request so the case can be prioritised appropriately.

Example: Payment pending

The transaction status needs to be verified against the available payment records. Please provide the transaction reference, approximate transaction time, and amount through the approved support channel. Do not share your PIN, OTP, CVV, password, or full card number. We will explain the verified status and the applicable next steps.

Example: Official information clarification

Admission requirements and deadlines can change by course, institution, and admission cycle. We will check the relevant official notice and clarify which information is confirmed. Where the official guidance remains unclear, we will identify the point that needs confirmation from the responsible authority.

These are sample responses. Adapt them to the actual case and verified facts.

12. Internal Ticket Record

A support record should capture the minimum necessary operational information.

Recommended fields:

Field	Purpose
ticket_id	Unique case identifier
created_at	Creation timestamp
updated_at	Latest update timestamp
category	Main issue type
subcategory	More specific issue type
priority	P1–P4 or the adopted priority model
status	Current lifecycle status
requester_id	Internal user reference, if applicable
assigned_to	Responsible support owner
subject	Concise issue description
description	User’s problem statement, with sensitive data minimised
related_reference	Application, order, or transaction reference where needed
internal_notes	Restricted investigation notes
resolution_summary	Verified outcome
resolved_at	Resolution timestamp
closed_at	Closure timestamp, if applicable

This is a conceptual field list, not a claim about the existing database schema. Align it with the actual ticket implementation before use.

Internal notes must not contain passwords, OTPs, session tokens, full payment credentials, or unnecessary copies of sensitive documents.

13. Service Quality and Reporting

Review support performance regularly using privacy-conscious aggregate metrics.

Suggested indicators:

* Ticket volume by category and priority
* First-response time
* Time to resolution
* Number and age of unresolved tickets
* Reopen rate
* Escalation rate
* Repeated incidents by feature
* User satisfaction, where feedback is collected
* Application and payment issues near critical deadlines
* Content corrections and time taken to verify them

Define metric calculations consistently. For example, distinguish elapsed time from business-hours time and separate first response from final resolution.

Do not use raw ticket contents or sensitive user attributes in general analytics dashboards unless there is a documented need and appropriate access control.

14. Knowledge Base and Recurring Issues

When a recurring issue is resolved:

1. Determine whether the cause is confirmed.
2. Write a concise user-facing help article or troubleshooting instruction.
3. Include applicable limitations and supported environments.
4. Link to authoritative external sources where relevant.
5. Assign an owner and review date for information that can change.
6. Update the article when the underlying feature or official guidance changes.

Potential knowledge-base topics include:

* Account recovery
* Supported document formats
* Application submission confirmation
* Payment status and refund requests
* Official admission-resource verification
* Browser troubleshooting
* Privacy and account-data requests

Do not publish internal security procedures, sensitive incident details, or confidential operational information in public help articles.

15. Data Protection and Access Control

Support personnel should:

* Access only the records necessary for the assigned case.
* Use individual accounts and approved authentication controls.
* Avoid exporting user data unless necessary and authorised.
* Share case details only with authorised recipients.
* Store attachments in approved, access-controlled systems.
* Follow retention and deletion rules.
* Use redacted examples when discussing issues in development or testing environments.
* Record privileged actions where audit logging is available.

Do not place sensitive personal information in URLs, analytics events, public logs, repository issues, or unprotected chat channels.

For detailed controls, follow docs/PRIVACY.md and docs/SECURITY.md.

16. Support Tooling Requirements

If MedOrbits implements a support dashboard or ticket API, consider the following capabilities:

* Ticket creation and unique references
* Category, priority, status, and assignment
* Search and filtering with access controls
* Internal notes separated from user-visible replies
* Attachment validation and protected access
* Notification delivery and failure handling
* Duplicate detection and related-ticket linking
* Audit history for important actions
* Escalation flags for security, privacy, payment, and deadline-sensitive cases
* Reporting that avoids unnecessary sensitive-data exposure

Do not expose administrative ticket operations through public endpoints without authentication, authorisation, validation, and rate limiting.

Automated notifications should not include sensitive documents or unnecessary personal details. Use a protected link to the authenticated application when appropriate.

17. Closure Policy

Before closing a ticket, verify that:

* The requested issue has been addressed or the remaining limitation has been explained.
* Any required action or next step has been communicated.
* Relevant records and resolution notes are complete.
* Any associated incident or content correction has been routed appropriately.
* No unresolved security or privacy concern is being closed as an ordinary support issue.

If a ticket is waiting for the user, apply only the closure timeframe actually adopted by MedOrbits. Notify the user before closure where the configured process requires it. Permit reopening or a new linked ticket according to the published policy.

18. Operational Readiness Checklist

Before enabling or advertising the support process, verify the following:

* [ ]	Published support contact details are correct and monitored.
* [ ]	Support form validation and submission work.
* [ ]	Ticket references are unique.
* [ ]	Ticket status and assignment are recorded correctly.
* [ ]	User-facing replies are separated from internal notes.
* [ ]	Access to applications, documents, and payment data is restricted.
* [ ]	Attachments have size/type validation and protected storage.
* [ ]	Notifications avoid disclosing sensitive information.
* [ ]	Priority definitions and escalation owners are documented.
* [ ]	Security and privacy incidents have dedicated escalation paths.
* [ ]	Official information can be checked against authoritative sources.
* [ ]	Response targets reflect actual staffing and coverage.
* [ ]	Ticket retention and deletion rules are defined.
* [ ]	Support workflows are tested before production release.
* [ ]	Contact details and policy links are reviewed periodically.

19. Related Documentation

Keep this guide aligned with:

* docs/API_REFERENCE.md — API conventions and proposed endpoint contracts
* docs/ARCHITECTURE.md — Application architecture and service boundaries
* docs/DATABASE_SCHEMA.md — Proposed data model and record relationships
* docs/DEPLOYMENT.md — Deployment, environment configuration, and operational checks
* docs/DATA_VERIFICATION.md — Verification of educational and official information
* docs/PRIVACY.md — Personal-data handling and privacy responsibilities
* docs/SECURITY.md — Security controls and incident response

The existence of a reference in this list does not mean every described feature has already been implemented.

20. Maintenance

Assign an owner to review this document when support channels, service commitments, application workflows, payment integrations, data-handling practices, or escalation responsibilities change.

Review it periodically and remove obsolete contacts, unimplemented capabilities, and response targets that are no longer operationally realistic.

End of document.