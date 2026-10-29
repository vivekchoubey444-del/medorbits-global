Legal & Policies — MedOrbits

Directory: legal/
Project: MedOrbits

1. Overview

The legal/ directory contains public-facing legal, privacy, payment, service, and accessibility information for the MedOrbits website and its education and career services.

These pages should clearly explain applicable policies, user choices, service limitations, and how users can contact the appropriate team.

Important: This README is an implementation guide, not legal advice or confirmation that any policy has been legally reviewed. Final policy wording must reflect MedOrbits’ actual operations, applicable jurisdictions, vendor relationships, and legal obligations. Obtain qualified legal review before publishing policy commitments.

2. Directory Structure

legal/
├── README.md
├── index.html
├── accessibility-statement.html
├── consent-preferences.html
├── cookie-policy.html
├── data-deletion.html
├── disclaimer.html
├── employer-terms.html
├── grievance-redressal.html
├── job-service-terms.html
├── payment-terms.html
├── privacy-policy.html
├── refund-policy.html
└── terms.html

3. Page Responsibilities

File	Purpose
index.html	Legal information hub linking to all policy and terms pages.
privacy-policy.html	Explain personal data collection, purposes, applicable lawful bases, sharing, retention, security, user rights, and contact routes.
terms.html	Define general website terms, permitted use, intellectual-property rules, account responsibilities, limitations, and dispute provisions.
refund-policy.html	Explain refund eligibility, exclusions, cancellation procedures, timelines, and assessment criteria in line with actual services and payment arrangements.
disclaimer.html	Clarify the scope and limitations of educational, admission, career, recruitment, and informational content without unsupported guarantees.
cookie-policy.html	Describe cookies and similar technologies, their purposes, relevant categories, and available management options.
accessibility-statement.html	State accessibility goals, verified limitations, feedback channels, and procedures for requesting assistance or accommodations.
data-deletion.html	Explain deletion requests, identity-verification procedures, applicable exceptions, and request handling.
consent-preferences.html	Explain and provide controls for optional cookies or consent-based processing where applicable, including updating or withdrawing choices.
job-service-terms.html	Define terms for job seekers using career support, job listings, resume assistance, internships, and related services.
employer-terms.html	Define employer account rules, job-posting requirements, candidate-data responsibilities, prohibited listings, and account enforcement.
payment-terms.html	Explain accepted payment methods, billing, subscriptions where applicable, failed payments, cancellations, receipts, applicable taxes, and payment disputes.
grievance-redressal.html	Publish the approved complaint and escalation process, response expectations, and verified grievance contact details.

4. Navigation and Page Structure

* Provide a prominent link to legal/index.html in the website footer.
* Include consistent legal navigation on every legal page.
* Display a meaningful page title and an accurate last-updated or effective date where appropriate.
* Provide the appropriate contact or escalation route.
* Use semantic HTML, logical headings, accessible links, and a readable content width.
* Link related policies contextually, such as payment terms from the refund policy and privacy information from data-deletion and consent pages.
* Keep navigation and page structure consistent with the main MedOrbits design system.

5. Design Guidelines

* Reuse shared CSS and JavaScript where practical.
* Follow the MedOrbits premium visual direction, using deep tinted backgrounds, high-contrast text, and restrained metallic accents.
* Avoid plain white page sections where they conflict with the established design system.
* Prioritize readability and clear navigation over decorative animation.
* Ensure responsive layouts work on mobile, tablet, and desktop.
* Provide visible keyboard focus, descriptive link text, and a logical heading hierarchy.
* Respect prefers-reduced-motion.
* Avoid interactive patterns that obstruct access to legal content.

6. Accuracy and Governance

* Keep policies aligned with actual business practices, data flows, service providers, retention schedules, refund rules, subscription billing, and support processes.
* Do not invent a registered business address, legal entity name, grievance officer, email address, telephone number, response deadline, certification, or compliance claim.
* Publish only verified and approved contact details.
* Use accurate effective and revision dates. Never display a last-updated date that does not reflect a real review.
* Distinguish general educational information from decisions made by institutions, regulators, employers, immigration authorities, payment providers, and other third parties.
* Avoid promising admission, employment, visas, scholarships, refunds, or other outcomes unless the commitment is authorized, accurate, and reflected in the applicable service agreement.
* Make exclusions, limitations, and cancellation rules clear and consistent across related pages.
* Ensure privacy, cookie, consent, and deletion wording matches the technologies and processes actually used by the website.

7. Privacy, Consent, and Data Requests

* Collect only information needed for stated purposes and protect it using appropriate technical and organizational controls.
* Describe third-party processors and data-sharing practices accurately.
* Define how identity and authority are verified before fulfilling access, correction, deletion, or other data requests.
* Explain applicable retention exceptions only when they genuinely apply, such as legally required records or legitimate security, accounting, contractual, or dispute-resolution needs.
* Ensure consent controls reflect the choices genuinely available to users.
* Do not claim optional tracking is disabled if it remains active.
* Establish an operational process for receiving, routing, tracking, responding to, and documenting data requests and grievances.

8. Recommended Implementation Order

1. index.html — Legal policy hub and navigation.
2. privacy-policy.html, terms.html, and disclaimer.html.
3. payment-terms.html and refund-policy.html.
4. cookie-policy.html, consent-preferences.html, and data-deletion.html.
5. job-service-terms.html and employer-terms.html.
6. accessibility-statement.html and grievance-redressal.html.
7. Review all cross-links, dates, contact details, and policy consistency.

9. Testing Checklist

* [ ]	Every listed page exists and loads successfully.
* [ ]	All policy, navigation, and footer links point to the correct locations.
* [ ]	Pages work on mobile, tablet, and desktop.
* [ ]	Keyboard users can navigate links and controls.
* [ ]	Document titles, headings, and language metadata are meaningful.
* [ ]	Effective and last-updated dates are accurate.
* [ ]	Privacy, cookie, consent, and deletion pages reflect the actual implementation.
* [ ]	Refund and payment terms match the live checkout and service arrangements.
* [ ]	Grievance contact details are verified and monitored.
* [ ]	No placeholder legal contacts, fabricated compliance claims, or unsupported guarantees remain.
* [ ]	Qualified legal review is completed before publishing policy commitments.

10. Maintenance

Assign an owner to review these pages whenever the business model, services, payment flows, subscription rules, data collection, analytics, third-party providers, or applicable requirements change.

Record approved revisions and keep related pages synchronized.

Implementation note: This README describes the intended scope of the legal pages. It does not confirm that any specific policy, consent mechanism, deletion workflow, grievance process, or compliance control has been implemented.

## Expanded dual-tone legal pages (added)
The following additional, non-duplicate pages are included in this package:
- `ai-use-transparency.html` — AI use and transparency
- `information-security.html` — information security
- `document-verification-policy.html` — document verification
- `education-agent-disclosure.html` — education consultancy and agent disclosure
- `complaint-handling-policy.html` — complaint handling and escalation
- `financial-aid-disclaimer.html` — scholarship and financial-aid disclaimer
- `editorial-corrections-policy.html` — editorial standards and corrections
- `third-party-service-disclosure.html` — third-party service disclosure

The legal pages receive an additive dual-tone animation layer and a three-slide carousel. The legal directory index links to the new pages. Existing source files and redirect aliases are preserved. New policy text is a general draft, not legal advice; confirm it reflects actual operations and obtain qualified legal review before publication.

