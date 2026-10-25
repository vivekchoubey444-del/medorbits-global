MedOrbits Support Guide

Education · Admissions · Careers · Recruitment · Technical Support

Document control	Details
Document	SUPPORT_GUIDE.md
Project	MedOrbits
Website	https://medorbits.in
Document type	Public support and reporting guidance
Document version	2.0.0
Publication status	Pending operational and policy verification
Document owner	Designated MedOrbits maintainer
Review cycle	Periodically and whenever relevant services, policies, or reporting channels change
Policy authority	Applicable approved policies, verified procedures, and relevant legal requirements

⸻

1. Purpose and Scope

The MedOrbits Support Guide establishes a consistent approach to reporting, documenting, and following up on issues involving the MedOrbits website, educational resources, admission guidance, career services, recruitment information, application-preparation workflows, and related technical functionality.

It is designed to help users and support personnel communicate clearly, protect sensitive information, and direct requests to the appropriate verified channel.

This guide establishes the following principles:

* Clarity: Support requests should describe the problem, expected behavior, observed result, and practical impact.
* Privacy by design: Requests should contain only the information necessary to investigate the reported issue.
* Security by default: Credentials, confidential records, and technical secrets must not be disclosed through ordinary support communications.
* Evidence-based handling: Receipt, progress, escalation, and resolution must reflect actual system or operational events.
* Accountability: Relevant issues should be traceable through appropriate references, records, and documented procedures.
* Accessibility: Reporting instructions and support experiences should be understandable and usable by people with different access needs.
* Transparency: Published support channels, service commitments, and policy statements must be accurate and operationally supported.

This guide describes recommended reporting practices. It does not independently establish a service-level agreement, guarantee a response or resolution, or replace the applicable privacy, security, refund, contractual, or other approved policies.

2. Support Channels and Routing

Users should contact MedOrbits through a verified channel appropriate to the nature and sensitivity of their request.

Before any channel is published, the responsible maintainer must confirm that it is active, controlled by the intended organization, accessible to the appropriate personnel, and suitable for the information it may receive.

Request category	Appropriate destination
General enquiries	Verified general contact channel
Website defects and technical issues	Verified technical support process, if available
Education and admission information	Relevant verified guidance or enquiry workflow
Application preparation	Applicable verified application-preparation process
Payment and refund concerns	Verified payment-support or refund procedure
Privacy and personal-information concerns	Verified privacy contact or applicable grievance procedure
Suspected security vulnerabilities	Private reporting procedure documented in SECURITY.md
Official eligibility, examination, or admission decisions	Relevant institution or official authority
Recruitment and employment enquiries	Verified recruitment or career-support channel, where available
Accessibility barriers	Verified support channel capable of receiving accessibility reports

This table describes intended routing categories. It does not confirm that a dedicated channel currently exists for every category.

2.1 Channel verification requirements

Before publishing a support channel, verify:

1. Ownership and organizational control.
2. Operational availability and responsible recipients.
3. The types of requests and information it is intended to handle.
4. Access restrictions and appropriate handling of sensitive submissions.
5. Relevant privacy notices and retention practices.
6. The procedure for redirecting misrouted or urgent requests.
7. The accuracy of its published URL, address, telephone number, or other contact details.

Publication rule: Do not invent or publish unverified email addresses, telephone numbers, support portals, service hours, escalation routes, or response commitments.

A general contact form must not be presented as a secure channel for confidential documents, account recovery, payment credentials, or vulnerability reports unless it has been specifically assessed and approved for that purpose.

3. Preparing an Effective Support Request

A well-structured report reduces unnecessary follow-up and helps the responsible team investigate the issue efficiently.

Provide only information relevant to the affected service and the problem being reported.

3.1 Recommended information

1. Affected service: Identify the page, feature, dataset, account workflow, or application process.
2. Issue summary: Describe the problem and its impact.
3. Expected behavior: Explain what should have happened.
4. Observed behavior: State what happened instead.
5. Reproduction steps: Provide concise steps that reproduce the problem, when safe and practical.
6. Approximate occurrence time: Include the date, time, and time zone when relevant.
7. Technical environment: Provide the browser, device, operating system, or application version if useful.
8. Sanitized evidence: Attach a redacted screenshot or minimal error excerpt when appropriate.
9. Existing reference: Include an existing support, application, or transaction reference only when necessary and safe.

Do not include unrelated information merely to make the report appear complete.

3.2 Reusable support-request template

<escape>
Subject: [Concise description of the issue]

Affected service:
[Page, feature, dataset, or workflow]

Issue summary:
[Describe the problem and its practical impact]

Expected behavior:
[Explain what should have happened]

Observed behavior:
[Explain what happened instead]

Reproduction steps:

1. [First step]
2. [Second step]
3. [Observed result]

Approximate occurrence time:
[Date, time, and time zone, if relevant]

Technical environment:
[Browser, device, operating system, or version, if relevant]

Existing reference:
[Include only when appropriate]

Evidence:
[Describe the attached, sanitized screenshot or error excerpt]

Additional context:
[Include only information necessary for investigation]
Do not attach complete application files, identity documents, database exports, unredacted logs, or unrelated records when a short explanation or sanitized excerpt is sufficient.

4. Security and Information Protection

Protect account credentials, applicant information, payment details, and internal technical information throughout the support process.

4.1 Information that must not be included in ordinary support messages

Never disclose:

* Passwords, one-time passwords (OTPs), recovery codes, or security answers.
* API keys, access tokens, session cookies, private keys, or other authentication secrets.
* Full payment-card details, card verification codes, or banking credentials.
* Unnecessary identity documents, medical records, financial records, or sensitive applicant information.
* Unredacted database exports or logs containing other users’ information.
* Private document links or URLs that grant access to authenticated sessions or confidential resources.
* Production configuration files containing secrets or internal credentials.

MedOrbits support personnel should not require users to disclose their passwords or OTPs.

4.2 Before sharing a screenshot, file, or log

Review the material and remove information that is not necessary for the investigation.

* Redact passwords, tokens, authorization headers, and session identifiers.
* Obscure unnecessary names, email addresses, phone numbers, identity numbers, and application details.
* Remove payment information and unrelated personal records.
* Check browser address bars for sensitive query parameters.
* Inspect screenshots for notifications, open tabs, and unrelated documents.
* Remove unnecessary personal information from logs and diagnostic excerpts.
* Confirm that the file does not contain embedded metadata or additional confidential material where relevant.
* Share only the minimum evidence needed to explain the issue.

If an approved application workflow requires supporting documents, use the verified submission process designed for that purpose. Do not send sensitive documents through an unverified channel.

4.3 If a secret is accidentally exposed

Treat an exposed credential as potentially compromised.

1. Revoke or rotate the affected credential through the relevant service.
2. Invalidate affected sessions where applicable.
3. Notify the responsible system owner through a verified private channel.
4. Review relevant access records for suspicious activity, where available.
5. Remove the exposed material from accessible locations and assess any repository history, backups, logs, or other copies that may require remediation.
6. Document the incident and corrective action according to the applicable security procedure.

Deleting a message or file does not necessarily invalidate an exposed credential or remove every copy of the information.

5. Admissions and Application-Related Support

MedOrbits may provide educational information, admissions resources, application-preparation assistance, document checklists, career guidance, and related services according to the features actually available.

When reporting an admission-related issue, identify the relevant institution, examination, counselling process, application workflow, or MedOrbits resource and explain the specific problem.

Use an existing case or application reference when appropriate instead of repeatedly sharing personal information.

5.1 Classify the issue correctly

Issue type	Description
Website defect	A page, form, or website feature does not behave as expected
Information enquiry	A published educational detail requires clarification or verification
Application preparation	Assistance is needed with a checklist, process, or supporting material
Official application issue	A submission, eligibility determination, examination result, or counselling status is controlled by another organization
Deadline or fee concern	An official schedule, fee, payment requirement, or published amount needs verification
Document issue	A required file cannot be uploaded, accessed, or processed through the applicable workflow
Career or recruitment enquiry	A job listing, recruitment process, eligibility requirement, or career resource needs clarification

5.2 Official decisions and verification

MedOrbits cannot independently guarantee admission, seat allotment, eligibility, document acceptance, examination results, visa approval, employment, recruitment outcomes, or any decision controlled by an external institution or authority.

Before taking consequential action, verify current requirements, deadlines, fees, eligibility conditions, and application instructions through the applicable official source.

Do not rely exclusively on an informational page if the relevant authority has published a newer or more specific instruction.

When reporting a possible factual error, provide the relevant page or data record, the disputed statement, and an authoritative source where available. This helps distinguish a website defect from a change made by the responsible institution.

6. Website Errors and Technical Problems

Technical reports should identify the failure, the steps that triggered it, and whether the problem can be reproduced.

Useful details include:

* The affected page, feature, or workflow.
* The approximate incident time.
* The action that triggered the error.
* The visible error message or sanitized screenshot.
* The browser and device used.
* Whether the issue persists after a safe retry.
* Whether the issue affects one page, one account, or multiple features.
* Any relevant reference generated by the system.

6.1 Avoid duplicate or harmful retries

Do not repeatedly submit a form, upload the same document, create duplicate applications, or repeat a payment simply to reproduce an error.

For an uncertain payment:

1. Do not immediately repeat the transaction.
2. Check the status through the verified payment provider or applicable account workflow.
3. Retain the legitimate transaction reference or confirmation, if available.
4. Contact the appropriate verified support channel if the result remains unclear.
5. Never disclose payment credentials, card verification codes, passwords, or OTPs.

For an uncertain application submission, check whether a confirmation or reference was generated before submitting again.

A browser refresh or a successful page reload does not prove that an earlier payment, document upload, or application submission succeeded or failed.

6.2 Reporting browser and interface defects

For interface issues, include the viewport or device context when relevant. For accessibility issues, identify the interaction or barrier rather than sharing unnecessary personal or medical information.

Do not attempt to bypass authentication, alter other users’ records, or access restricted endpoints merely to reproduce a defect.

7. Privacy and Personal Information

Personal information should be submitted only through a suitable, verified channel and only when reasonably necessary to resolve the request.

Users should consult the applicable MedOrbits Privacy Policy for the organization’s actual information-handling practices. Before publication, maintainers must verify that the policy exists, is current, and is linked correctly.

Do not imply that a support message is automatically confidential merely because it has been sent to an organization.

7.1 If information is sent to the wrong recipient

1. Stop sending further information to that destination.
2. Contact the intended recipient through a verified channel.
3. If sensitive information may have been exposed, take appropriate protective action.
4. Report the incident through the relevant verified privacy or security procedure.
5. Avoid reposting the affected information publicly while seeking assistance.
6. Preserve only the incident details necessary for appropriate investigation.

Do not promise deletion, confidentiality, retention periods, or a particular privacy outcome unless the applicable approved policy and operational capabilities support that commitment.

7.2 Data minimization

Support processes should avoid collecting sensitive information that is unrelated to the reported issue. Where a reference number can identify an existing case safely, prefer that reference over repeating an entire record.

Any access to, disclosure of, retention of, or deletion of personal information must follow the applicable approved policies and operational procedures.

8. Security Vulnerability Reporting

Suspected security vulnerabilities must be reported through the private process documented in SECURITY.md, once the procedure and its reporting destination have been verified and made operational.

Do not disclose exploitable technical details through public issues, social media, public discussions, or other channels that could unnecessarily expose users or systems to harm.

8.1 Information to include

Where safe and appropriate, provide:

* The affected component, endpoint, page, or feature.
* A concise description of the suspected vulnerability.
* Reproduction steps limited to authorized testing.
* The potential impact and conditions required to reproduce it.
* Sanitized evidence and approximate timestamps.
* A practical mitigation suggestion, if already identified.

Do not include live credentials, tokens, private keys, or sensitive user records.

8.2 Responsible testing boundaries

Do not:

* Access another user’s account or confidential information.
* Extract, modify, publish, or retain private records unnecessarily.
* Disrupt availability or interfere with production systems.
* Conduct testing beyond your authorization.
* Install persistent access mechanisms or attempt to conceal activity.
* Continue testing after encountering data or systems outside the authorized scope.
* Assume that submitting a vulnerability report authorizes additional testing.

A reporting process, acknowledgment target, disclosure timeline, reward, or resolution commitment must not be advertised unless it has been formally approved and is operational.

Publication dependency: Verify SECURITY.md, the private reporting route, and any linked security policy before presenting this section as an active reporting instruction.

9. Reference Numbers and Follow-Up

Retain legitimate support, application, or transaction references associated with your request.

When following up:

1. Refer to the existing case or transaction when appropriate.
2. Explain what has changed since the previous report.
3. Provide only new and relevant evidence.
4. Avoid creating duplicate requests unless the original channel is unavailable or a material development requires a new report.
5. Keep relevant confirmation messages and correspondence for your records.
6. Use the verified process for escalating unresolved or sensitive matters.

Do not assume that a request has been received, assigned, escalated, or resolved unless the relevant channel or system provides confirmation.

Any response targets, escalation routes, operating hours, or service-level commitments must reflect an approved and operational support policy.

10. Third-Party Institutions and External Services

MedOrbits resources may refer users to colleges, universities, examination authorities, counselling bodies, employers, payment providers, government agencies, and other external service providers.

Where an issue is controlled by an external organization, consult its verified official website and published contact channels.

Before publishing or relying on an external link:

* Confirm that the destination is legitimate and relevant.
* Check that the URL is current and uses the expected domain.
* Identify the responsible organization accurately.
* Avoid implying that an external service is operated, controlled, or endorsed by MedOrbits unless that relationship is verified.
* Review important links periodically, particularly those relating to admissions, fees, deadlines, eligibility, and applications.
* Distinguish MedOrbits guidance from decisions or instructions issued by the responsible authority.

External services, policies, and decisions may change independently of MedOrbits content. Where possible, retain the source and review date for consequential factual claims.

11. Accessibility and Inclusive Communication

Support instructions and reporting experiences should be clear, respectful, and accessible.

When describing an accessibility issue, identify the affected page or workflow and explain the barrier encountered.

Examples include:

* Keyboard navigation or focus-order problems.
* Missing, ambiguous, or misleading screen-reader labels.
* Dynamic status messages that are not announced appropriately.
* Insufficient contrast or unreadable text.
* Forms that cannot be completed on mobile devices.
* Document readability or language-rendering problems.
* Issues involving zoom, text resizing, or responsive layouts.
* Motion or animation that creates an avoidable accessibility barrier.

Include the browser, device, assistive technology, or relevant settings only when they help explain the problem.

Do not disclose unnecessary medical or personal information to report an accessibility barrier. Where supported by the verified channel, concise communication in an appropriate language can help the responsible team investigate the issue.

Accessibility checks should combine automated testing with manual evaluation of important user journeys.

12. Support Expectations and Limitations

This guide provides general reporting instructions. It does not independently establish or guarantee:

* Response or resolution deadlines.
* Support hours or continuous availability.
* Priority handling or escalation.
* Admission, educational, recruitment, financial, or application outcomes.
* Security disclosure rewards.
* Confidentiality, retention, or deletion outcomes beyond applicable policies.
* Availability or functionality of an unverified support channel.
* The availability of a feature that has not been implemented or released.

Specific commitments may be published only when supported by approved, current, and operational procedures.

Where a matter falls outside MedOrbits’ control, the responsible institution, authority, payment provider, employer, or other service provider may need to make the final determination.

13. Official Policies and Related Resources

The following resources should be verified before publication. The table identifies their intended purpose and does not establish that each document currently exists at a particular URL.

Resource	Intended purpose
Privacy Policy	Explains applicable personal-information handling practices
Terms and Conditions	Describes the applicable terms of website or service use
Refund Policy	Explains approved refund procedures and applicable conditions
Disclaimer	Clarifies the scope and limitations of informational content
SECURITY.md	Documents security reporting and responsible disclosure procedures
README.md	Provides the project overview, setup instructions, and development guidance
docs/SCAFFOLD_INVENTORY.md	Describes the intended repository structure and inventory verification status

Before publishing links, verify the actual paths, page content, current policy status, and relevance to the support process.

Do not publish placeholder links or imply that an unverified procedure is operational.

14. Operational Handling and Internal Quality Standards

The following are recommended internal practices for any team operating MedOrbits support. They should be adopted only to the extent that the relevant people, systems, and procedures are actually available.

14.1 Request classification

Where a case-management process exists, classify requests into appropriate categories such as:

* General enquiry.
* Technical defect.
* Education or admissions information.
* Application preparation.
* Account or access issue.
* Payment or refund concern.
* Privacy concern.
* Security vulnerability.
* Accessibility barrier.
* Recruitment or career enquiry.

Classification should support appropriate routing without unnecessarily exposing sensitive information.

14.2 Safe error handling

* Provide clear and proportionate user-facing messages.
* Do not expose credentials, internal paths, stack traces, or confidential records.
* Preserve appropriate internal diagnostics for investigation.
* Use a reference or correlation identifier when supported.
* Do not claim that a submission or payment succeeded unless the system confirms the outcome.
* Avoid unnecessary disruption of unrelated operations when a request is rejected or fails validation.
* Record security-relevant events where appropriate and permitted by the applicable policies.

14.3 Case closure

Where a case-management system exists, close requests according to the documented process. A closure should reflect the actual outcome, such as a resolved defect, a verified explanation, a referral to an external authority, or a documented limitation.

Do not treat an automated acknowledgment, an unanswered message, or a successful page load as proof of resolution.

15. Publication, Ownership, and Maintenance

The designated project owner or maintainer should review this guide before publication and whenever relevant services, policies, support channels, or legal requirements change.

15.1 Pre-publication checklist

* [ ]	Verify the official website and all published contact channels.
* [ ]	Confirm that each referenced support process is active and appropriate.
* [ ]	Review SECURITY.md and verify the private vulnerability-reporting route.
* [ ]	Verify the Privacy Policy, Terms and Conditions, Refund Policy, and Disclaimer links.
* [ ]	Confirm that referenced pages, workflows, and services exist.
* [ ]	Remove unsupported response targets, service hours, and guarantees.
* [ ]	Confirm that no credentials, tokens, personal records, or private URLs are included.
* [ ]	Verify that admissions and career statements are accurate and appropriately qualified.
* [ ]	Check external links for correctness and relevance.
* [ ]	Review spelling, readability, accessibility, and Markdown rendering.
* [ ]	Confirm that the instructions do not direct users to send sensitive information through unverified channels.
* [ ]	Record the review date and responsible maintainer through the project’s documentation process.

15.2 Maintenance requirements

* Keep this guide aligned with the actual support process.
* Review security and privacy reporting instructions when channels or procedures change.
* Correct outdated links and unsupported claims promptly.
* Maintain revision history through the normal version-control workflow.
* Avoid placing personal contact information or confidential operational details in the public repository.
* Review material changes to services, application workflows, payment handling, or data practices before updating corresponding support statements.

16. Final Notice

This guide provides general instructions for preparing and following up on support requests concerning MedOrbits.

The applicable approved policies, verified contact channels, and operational procedures govern the handling of individual requests. Nothing in this guide guarantees a particular response, resolution, admission decision, financial outcome, employment result, or security-reporting result.

Document: SUPPORT_GUIDE.md
Project: MedOrbits
Version: 2.0.0
Status: Pending verification of contact details, linked policies, and reporting procedures.

End of document.