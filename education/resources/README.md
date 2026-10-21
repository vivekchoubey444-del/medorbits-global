MedOrbits Education Resources

Directory: education/resources/

1. Overview

The Education Resources module brings together information and guidance on education costs, scholarships, accommodation, study planning, brochures, student loans, and frequently asked questions.

It serves as a supporting resource library within the MedOrbits Education module, helping students research educational opportunities, plan expenses, understand funding options, and access relevant guidance.

Implementation note: The presence of a page does not guarantee that its content, search functionality, downloadable files, external links, or data integrations are operational. Verify the current HTML, JavaScript, data files, and backend integrations before documenting a feature as implemented.

2. Directory Structure

education/resources/
├── README.md
├── index.html
├── fees.html
├── scholarships.html
├── hostels.html
├── guides.html
├── brochures.html
├── student-loans.html
└── faqs.html

3. Page Guide

File	Responsibility
index.html	Main resource-library landing page with summaries and links to available resources.
fees.html	Education fee information and cost-planning guidance.
scholarships.html	Scholarship and financial-aid information, eligibility, application requirements, and deadlines.
hostels.html	Student accommodation information, facilities, costs, location, and relevant conditions.
guides.html	Study-planning articles, educational guides, checklists, and reference material.
brochures.html	Directory of available brochures and downloadable educational resources.
student-loans.html	Student-loan and education-financing guidance, including eligibility and repayment considerations.
faqs.html	Frequently asked questions about education costs, funding, accommodation, and study planning.

4. Page Responsibilities

4.1 index.html — Resource Library

* Introduce the education resource library.
* Provide concise summaries of the available resource categories.
* Link to each resource page.
* Include search or category navigation where supported by the implementation.

4.2 fees.html — Education Fees

* Organize fee information by course, institution, location, or cost type where relevant.
* Distinguish tuition fees from accommodation, travel, deposits, examination charges, and other expenses.
* Identify the source and review date for published figures when available.
* Clearly distinguish estimated costs from official fee schedules.

4.3 scholarships.html — Scholarships and Financial Aid

* Explain relevant scholarship categories and application procedures.
* Present eligibility, award coverage, required documents, and deadlines only when verified.
* Link to official scholarship providers for current conditions.
* Avoid guaranteeing scholarship eligibility or award approval.

4.4 hostels.html — Student Accommodation

* Help students understand accommodation options and relevant facilities.
* Present rent, deposits, utilities, location, safety information, and cancellation conditions only when verified.
* Identify the source and date of accommodation information where practical.
* Clearly distinguish informational listings from confirmed availability or actual booking services.

4.5 guides.html — Education Guides

* Organize guides by topic, course, study level, or destination.
* Provide practical educational guidance and supporting checklists.
* Include publication or review dates for time-sensitive information.
* Reference official institutions and authorities for formal requirements.

4.6 brochures.html — Brochures and Downloads

* Display available brochures with a title, description, category, format, and working file link.
* Link only to files that actually exist in the project or an approved document-storage service.
* Store public, approved brochure PDFs in a consistent directory, such as assets/documents/brochures/, if that matches the existing project architecture.
* Ensure downloadable files are accessible and have descriptive filenames.
* Do not expose private student documents through the public brochure library.

Example brochure filenames, if those resources are created and approved:

* medical-courses-guide.pdf
* admission-checklist.pdf
* study-abroad-guide.pdf
* career-planning-checklist.pdf

These filenames are examples, not confirmation that the files currently exist.

4.7 student-loans.html — Student Loans

* Explain education-financing concepts in clear language.
* Identify important comparison factors, including interest rates, processing fees, collateral, co-applicant requirements, moratorium terms, and repayment conditions.
* Link to official lenders for current eligibility criteria and product terms.
* Distinguish general financial information from personalized financial advice.
* Never guarantee loan approval or financing availability.

4.8 faqs.html — Frequently Asked Questions

* Group questions by relevant topic.
* Provide concise answers consistent with the related resource pages.
* Direct visitors to official sources for current fees, scholarship rules, loan terms, and accommodation information.
* Keep answers updated when relevant policies or requirements change.

5. Shared Design and Frontend Standards

* Follow the established MedOrbits design system and existing page themes.
* Reuse shared navigation, footer, typography, spacing, cards, buttons, and design tokens.
* Maintain responsive layouts across mobile, tablet, and desktop.
* Reuse shared CSS and JavaScript where available rather than duplicating site-wide functionality.
* Use semantic HTML, accessible labels, meaningful image alternative text, and visible keyboard focus states.
* Respect reduced-motion preferences.
* Provide appropriate loading, empty, validation, and error states wherever dynamic functionality is implemented.
* Ensure internal links resolve to valid pages or routes.

Use the project’s existing asset paths and conventions. Example paths such as /assets/css/style.css or /assets/js/app.js must be verified before use.

6. Data and External Integrations

The resource pages may use public educational catalogues, approved downloadable files, or external information sources.

Potential data categories include:

* Tuition and additional education costs.
* Scholarship opportunities.
* Accommodation information.
* Study guides and educational checklists.
* Student-loan and financing information.
* Frequently asked questions.

Before implementing an integration, verify:

1. The actual data source and filename.
2. The data schema and required fields.
3. The endpoint, if an API is used.
4. The response format and error-handling behavior.
5. Whether the information is public or requires authorization.
6. The source and review date for information that can change.

Public catalogues and brochures must not contain private application records, identity documents, authentication tokens, or confidential student information.

7. Content Accuracy and Maintenance

* Treat fees, scholarships, accommodation availability, loan terms, eligibility criteria, and deadlines as changeable information.
* Verify details with the relevant institution, official authority, accommodation provider, or lender before publication.
* Record a source and last-reviewed date for time-sensitive information.
* Clearly distinguish estimates, general guidance, and official requirements.
* Avoid guarantees concerning admission, scholarships, accommodation, loan approval, or employment.
* Review external links and downloadable files periodically.

8. Testing and Quality Assurance

Before releasing changes to the Education Resources module, verify the following:

* [ ]	All eight HTML pages exist.
* [ ]	The landing page links to the relevant resource pages.
* [ ]	Internal navigation and shared assets load correctly.
* [ ]	Every brochure download points to an existing, approved file.
* [ ]	Fees, scholarships, accommodation, and loan details are verified and dated where appropriate.
* [ ]	Search and filters work where implemented.
* [ ]	Dynamic content handles empty results and errors.
* [ ]	Pages are responsive and accessible.
* [ ]	Page titles and meta descriptions are accurate.
* [ ]	Shared navigation and footer links are tested.
* [ ]	No credentials or private student information are exposed.

9. Maintenance

Update this document whenever the resource pages, downloadable materials, data sources, integrations, or directory structure change.

Verify filenames, internal links, and referenced assets against the current repository. Clearly distinguish implemented functionality from proposed enhancements.

⸻

MedOrbits — Study · Work · Grow

Reliable educational resources to help students research costs, explore funding options, plan accommodation, and make informed academic decisions.