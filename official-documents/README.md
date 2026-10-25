MedOrbits Official Documents

Directory: /official-documents/
Website: https://medorbits.in/
Purpose: Official-source discovery, education and admission document guidance, regulatory information, counselling notices, and fee notification resources.

⸻

1. Overview

The official-documents directory contains public-facing resources that help students, applicants, parents, and education advisers locate and interpret official information relevant to education and medical admissions.

The directory is designed to provide a consistent, accessible, mobile-responsive experience across document-related pages, including admission notices, counselling information, fee notifications, regulatory resources, important dates, and verification checklists.

MedOrbits is an independent educational information resource. It is not a government authority, examination board, counselling authority, university, college regulator, or official fee-setting body.

Core principle: Use MedOrbits to discover and understand resources; use the responsible official authority to confirm requirements, deadlines, eligibility, fees, and regulatory decisions.

2. Directory Responsibilities

Pages in this directory should:

* Help users identify the official authority responsible for a document or process.
* Link to relevant official websites and published notifications.
* Explain how to check applicability, publication dates, academic sessions, and subsequent corrections.
* Present information clearly without implying that unverified data is official or current.
* Provide practical checklists and guidance for preparing documents and completing admission-related tasks.
* Direct users to appropriate MedOrbits educational resources and support pages where relevant.

Pages must not fabricate official notices, document numbers, fee amounts, approval status, publication dates, or regulatory decisions.

3. Recommended Directory Structure

The following structure is a reference architecture. Maintain existing filenames and routes when they are already in use; create or rename files only when the project explicitly requires it.

official-documents/
├── README.md
├── INTEGRATION.md
├── official-documents.js
├── official-documents.css
├── official-fee-notifications.html
├── nmc-guidelines.html
├── nmc-college-permissions.html
├── verification-checklist.html
├── admission-notices.html
├── important-dates.html
├── wbmcc-seat-matrix.html
└── mcc-counselling.html

Page responsibilities

File	Responsibility
README.md	Directory purpose, conventions, architecture, and maintenance.
INTEGRATION.md	Implementation instructions for shared scripts, styles, and data sources.
official-documents.js	Shared interactions where implemented, such as resource search, filters, and accessible navigation.
official-documents.css	Shared document-page styles, if the project uses a central stylesheet.
official-fee-notifications.html	Official-source discovery for fee schedules, tuition, deposits, payment instructions, and refunds.
nmc-guidelines.html	Guidance for locating and understanding relevant National Medical Commission publications and regulatory materials.
nmc-college-permissions.html	Resources for checking official medical college permissions, approvals, and related publications.
verification-checklist.html	General document and information verification checklist.
admission-notices.html	Admission-related notices, circulars, updates, and corrigenda.
important-dates.html	Guidance for locating official deadlines, schedules, and date revisions.
wbmcc-seat-matrix.html	West Bengal medical counselling seat-matrix resources.
mcc-counselling.html	Medical Counselling Committee counselling resources and official notices.

A file listed here is not necessarily present in every deployment. Check the repository before relying on a path or introducing a new integration.

4. Official Source Policy

Use the following official websites as starting points when relevant:

* National Medical Commission (NMC): https://www.nmc.org.in/
* Medical Counselling Committee (MCC): https://mcc.nic.in/
* West Bengal Medical Counselling Committee (WBMCC): https://wbmcc.nic.in/

These are starting points, not confirmation that a specific notification is currently applicable. Direct users to the relevant publication or section whenever its exact official URL is known and verified.

Source verification requirements

Before publishing a claim about a rule, fee, admission, approval, or deadline, verify:

1. Issuing authority: Who published the information?
2. Publication date: When was the notice issued?
3. Applicability: Which course, institution, state, category, academic session, or counselling round does it cover?
4. Current validity: Has a later notice, amendment, corrigendum, or replacement been published?
5. Document integrity: Is the original publication or official PDF accessible?
6. Scope: Does the source actually support the statement being made?

Do not infer that a notice is current simply because it remains accessible on a website.

Source precedence

Where information conflicts, direct users to the competent authority and the applicable current official publication. Escalate unresolved discrepancies to the relevant official helpdesk or institution.

Do not present an unofficial summary, search-engine snippet, social media post, or old screenshot as conclusive proof of a current requirement.

5. Medical Regulatory Information

The NMC-related pages should distinguish regulatory guidance from admission administration.

For example, the NMC website may contain regulations, notifications, standards, and medical education information. It should not automatically be described as the authority responsible for every college fee, state counselling deadline, or seat-allocation decision.

When preparing nmc-guidelines.html:

* Identify the relevant NMC publication or official resource category.
* Explain what the source can help users establish.
* Distinguish regulations and standards from counselling instructions and institutional processes.
* Link to the NMC’s official website.
* Avoid claiming that a college has permission, recognition, or approval without a supporting official source.
* Encourage users to check the relevant publication’s date, scope, and any subsequent updates.
* Avoid legal or regulatory interpretations that go beyond the available evidence.

For institution-specific status, use the relevant official NMC records and other competent authority publications as applicable.

6. Design System and User Experience

Document pages should follow the established MedOrbits premium design language.

Visual standards

* Use the midnight, sapphire-blue, and champagne-gold palette established by the reference page.
* Preserve strong text contrast against dark surfaces.
* Use the existing DM Sans and Playfair Display typography where appropriate.
* Maintain consistent spacing, card borders, buttons, badges, and section hierarchy.
* Use restrained decorative animation and provide reduced-motion support.
* Avoid pure-white page sections and transparent sections that compromise readability.
* Do not allow headings, links, labels, or cards to overflow their containers.

Responsive standards

* Use responsive layouts for desktop, tablet, and mobile.
* Preserve readable card layouts on narrow screens.
* Use two-column resource cards on mobile where the page design calls for a 2 × 2-style card grid.
* Ensure long URLs, filenames, and technical labels wrap safely.
* Keep interactive controls appropriately sized for touch input.
* Prevent horizontal page overflow.

Navigation

* Reuse the established MedOrbits header and footer conventions.
* Keep links consistent with the repository’s actual routes.
* Mark the current page with aria-current=“page” where appropriate.
* Ensure mobile menus and dropdowns can be operated using a keyboard.
* Provide a skip link to the main content.
* Avoid broken links and duplicate navigation destinations.

Accessibility

* Use semantic HTML elements such as header, nav, main, section, article, and footer.
* Provide meaningful page titles and descriptions.
* Associate form labels with their controls.
* Expose dynamic search results and checklist progress using accessible status messages.
* Maintain visible keyboard focus.
* Use descriptive link text instead of generic labels wherever practical.
* Respect prefers-reduced-motion.
* Do not use colour as the sole means of communicating status.

7. HTML, SEO, and Metadata

Every standalone HTML page should include:

* <!doctype html> and an appropriate language attribute, such as lang=“en-IN”.
* A responsive viewport declaration.
* A page-specific <title>.
* A unique, accurate meta description.
* A canonical URL matching the deployed page.
* Appropriate indexing directives.
* A favicon referencing the established MedOrbits logo asset.
* Semantic heading hierarchy and a single clear primary page heading.
* Structured data only when it accurately describes the page.
* Working internal links and relevant official external links.

Canonical URL convention

Use the production URL for the specific page, for example:

<link rel=“canonical”
  href=“https://medorbits.in/official-documents/nmc-guidelines.html”>

Do not reuse the canonical URL of official-fee-notifications.html on the NMC guidelines page.

Structured data

Use a suitable schema type such as WebPage when appropriate. Ensure the page name, description, URL, language, publisher, and logo accurately reflect the page and site.

Do not use structured data to imply government affiliation, official certification, approval, or live verification that MedOrbits does not possess.

8. JavaScript and Data Integration

Shared scripts should be loaded consistently and should not interfere with the page’s core content.

When applicable, use deferred script loading:

<script src=“/official-documents/official-documents.js” defer></script>

The actual script location must match the repository and deployment configuration.

Interaction requirements

If a page provides resource search, category filters, sorting, dropdowns, or checklists:

* Ensure each control performs its advertised action.
* Keep filtering and sorting consistent with the displayed result count.
* Provide a useful empty state when no resources match.
* Prevent search forms from triggering unintended page reloads.
* Make dropdowns keyboard-accessible.
* Keep controls functional when optional data is unavailable.
* Avoid injecting untrusted data as HTML.
* Do not claim that a checklist, payment, verification, or form submission has been saved unless the relevant operation has actually succeeded.

Data-driven resources

If a page loads JSON data, validate the expected structure and handle fetch failures gracefully. Provide a clear error state rather than silently presenting incomplete or invented results.

Do not publish private credentials, access tokens, API keys, personal applicant information, or payment secrets in client-side JavaScript or public JSON files.

For integration-specific details, use INTEGRATION.md as the implementation reference.

9. External Links and Security

External official links should be accurate and relevant to the claim being made.

For links opened in a new tab, use:

<a href=“https://www.nmc.org.in/“
   target=“_blank”
   rel=“noopener noreferrer”>
  National Medical Commission official website
</a>

Security requirements:

* Do not link to invented document URLs.
* Do not label an unofficial website as a government portal.
* Do not request passwords, OTPs, banking credentials, or unnecessary sensitive information.
* Do not collect payments on a resource-discovery page unless a separately designed and properly secured payment workflow exists.
* Avoid embedding third-party scripts without a clear purpose and appropriate security review.
* Do not expose internal administrative endpoints or privileged credentials.

10. Accuracy, Disclaimers, and Financial Safety

Include a context-appropriate disclaimer on pages dealing with fees, regulatory requirements, admission notices, or counselling.

Recommended wording:

MedOrbits is an independent educational information resource and is not a government authority, regulatory body, counselling authority, or official fee-setting institution. Information is provided for general guidance. Users should confirm applicable requirements, fees, deadlines, permissions, and procedures using the latest publication from the competent official authority.

For fee-related pages, additionally explain that fees and refund conditions can vary by institution, course, admission category, academic session, jurisdiction, and counselling round.

For NMC-related pages, distinguish official regulatory publications from MedOrbits’ explanatory content.

Disclaimers do not replace the requirement to check sources and correct factual errors.

11. Quality Assurance Checklist

Before publishing or updating a page, verify the following.

Content and source quality

* [ ]	The content matches the page’s stated purpose.
* [ ]	Official source links are valid and relevant.
* [ ]	Claims are supported by the linked source.
* [ ]	Publication dates and applicability are checked where material.
* [ ]	No unsupported fee amount, deadline, approval, or regulatory claim is presented as fact.
* [ ]	Any limitations on freshness or completeness are clearly disclosed.

Technical quality

* [ ]	The page loads without JavaScript console errors.
* [ ]	All local assets and scripts use correct paths.
* [ ]	Internal links point to intended routes.
* [ ]	External links use appropriate security attributes.
* [ ]	Search, filters, sorting, and checklist interactions work as intended.
* [ ]	Empty states and data-loading errors are handled.
* [ ]	The canonical URL and metadata match the deployed page.
* [ ]	Structured data is valid and accurate.

Design and accessibility

* [ ]	The page works on desktop, tablet, and mobile.
* [ ]	Mobile cards remain readable without horizontal overflow.
* [ ]	Headings and text wrap correctly.
* [ ]	Keyboard navigation and visible focus work.
* [ ]	Form controls have labels.
* [ ]	Dynamic status messages are accessible.
* [ ]	Reduced-motion preferences are respected.
* [ ]	Colour contrast remains readable.

Release readiness

* [ ]	The page has been reviewed before deployment.
* [ ]	Relevant navigation and footer links have been checked.
* [ ]	Existing routes and shared assets have not been unintentionally broken.
* [ ]	The production page and canonical URL have been tested after deployment.

12. Maintenance and Updates

Review pages whenever a relevant official authority publishes a material update, or when a broken link, inaccurate statement, or user-reported issue is identified.

Recommended maintenance workflow:

1. Identify the affected page and claim.
2. Locate the relevant official source.
3. Confirm applicability and subsequent updates.
4. Correct the content, links, or integration.
5. Test the page and related navigation.
6. Record significant changes in the project’s version-control history.
7. Recheck the deployed page.

Do not label a page or resource “latest,” “verified today,” or “currently valid” without an appropriate verification process supporting that statement.

13. Contribution Guidelines

Contributors should:

* Follow the established MedOrbits design and coding conventions.
* Preserve existing routes and integrations unless a change is intentional.
* Keep pages focused on their stated subject.
* Prefer concise explanations supported by official links.
* Avoid duplicating shared functionality across pages when a maintained shared module already exists.
* Use descriptive filenames and consistent naming conventions.
* Test changes before committing them.
* Never commit secrets, private records, or unapproved applicant data.

For substantial changes, include a clear commit message describing the affected page, feature, or correction.

14. Related Resources

* MedOrbits homepage
* National Medical Commission
* Medical Counselling Committee
* West Bengal Medical Counselling Committee

Internal MedOrbits page references should be checked against the actual repository before use.

⸻

Document owner: MedOrbits
Directory: /official-documents/
Maintenance principle: Accurate information, official-source traceability, accessible design, and responsible guidance.