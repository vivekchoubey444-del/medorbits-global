Here is the refined, ready-to-paste education/study-abroad/README.md. It preserves your directory structure, page responsibilities, MedOrbits design conventions, and emphasis on verifying international education requirements.

MedOrbits — Study Abroad

Directory: education/study-abroad/
Section: Education → Study Abroad
Suggested URL base: /education/study-abroad/
Brand: MedOrbits

1. Purpose

The Study Abroad section helps students explore international study options, understand common application steps, and navigate destination-specific information from one consistent area of the MedOrbits website.

This directory organizes the general study-abroad landing page, an MBBS-abroad guide, destination-specific pages, and a page for additional countries.

Implementation note: This README documents the intended structure and maintenance guidance. It does not imply that every listed HTML page, feature, integration, or asset has already been implemented.

2. Directory Structure

education/study-abroad/
├── README.md
├── index.html
├── mbbs-abroad.html
├── russia.html
├── georgia.html
├── kazakhstan.html
├── uzbekistan.html
├── kyrgyzstan.html
├── uae.html
└── more-countries.html

3. Page Responsibilities

File	Purpose
index.html	Main study-abroad hub introducing international study planning and linking to destination and subject-specific pages.
mbbs-abroad.html	Overview of MBBS-abroad research, eligibility considerations, admissions, costs, recognition, licensing, and student planning.
russia.html	Destination guide for researching study options in Russia.
georgia.html	Destination guide for researching study options in Georgia.
kazakhstan.html	Destination guide for researching study options in Kazakhstan.
uzbekistan.html	Destination guide for researching study options in Uzbekistan.
kyrgyzstan.html	Destination guide for researching study options in Kyrgyzstan.
uae.html	Destination guide for researching study options in the United Arab Emirates.
more-countries.html	Entry point for additional destinations not covered by a dedicated page.

4. Suggested Page Content

4.1 index.html — Study Abroad Homepage

* Introduction to studying abroad.
* Destination cards linking to available country pages.
* Study fields and degree-level pathways.
* Application planning steps.
* Fees, scholarships, documents, and frequently asked questions.
* Clear links to request guidance, where an operational enquiry workflow exists.

4.2 mbbs-abroad.html — MBBS Abroad

* Overview of international medical education research.
* Country and institution comparison considerations.
* Academic eligibility and entrance requirements.
* Tuition, living costs, and other expenses.
* Recognition and approval checks.
* Language of instruction and clinical training considerations.
* Current licensing, screening, and registration requirements for the student’s intended country of practice.
* Application documents, visa planning, and frequently asked questions.

Students should independently verify the exact institution, campus, programme, clinical training arrangements, and applicable recognition and licensing requirements before making an admission decision.

4.3 Destination Pages

Each country page should follow a common information structure where practical:

1. Destination overview.
2. Available study fields and qualification types.
3. Institution and programme research links.
4. Admission requirements and application process.
5. Tuition, living expenses, and funding considerations.
6. Language, accommodation, travel, and student-life information.
7. Visa and immigration requirements.
8. Recognition, accreditation, and professional licensing checks, where relevant.
9. Document checklist.
10. Frequently asked questions and a request-guidance call to action.

Country-specific details must be verified and maintained independently. Do not assume that admission, immigration, recognition, or licensing requirements are identical across destinations.

4.4 more-countries.html — Additional Destinations

* List additional destinations that do not yet have dedicated pages.
* Link to official national education, immigration, and institutional resources.
* Provide a consistent way to explore further study destinations.
* Link to a dedicated destination page when one is added to the project.

5. Shared Design and Navigation

Keep these pages consistent with the existing MedOrbits website design system.

* Use the established brand logo, shared header, navigation dropdowns, footer, and opening animation where appropriate.
* Follow the visual design and component patterns established by the root index.html and education/index.html.
* Maintain responsive layouts for mobile, tablet, and desktop.
* Use accessible headings, descriptive image alternative text, keyboard-friendly controls, and visible focus states.
* Apply the established burgundy, emerald, gold, or other page-specific palettes intentionally while maintaining readable contrast and a consistent brand identity.
* Reuse shared CSS and JavaScript under assets/css/ and assets/js/ where practical.
* Avoid duplicating site-wide behavior when reusable components already exist.
* Respect reduced-motion preferences.

6. Asset and Link Conventions

Use root-relative URLs when the website is deployed at the domain root and the existing project supports that convention.

Examples:

<link rel=“stylesheet” href=“/assets/css/style.css”>
<img
  src=“/assets/images/destinations/russia.jpg”
  alt=“University campus in Russia”
>
<a href=“/education/study-abroad/georgia.html”>
  Explore Georgia
</a>

Suggested destination-image directory:

assets/
└── images/
    └── destinations/
        ├── russia.jpg
        ├── georgia.jpg
        ├── kazakhstan.jpg
        ├── uzbekistan.jpg
        ├── kyrgyzstan.jpg
        ├── uae.jpg
        └── study-uk.jpg

These paths and filenames are examples only. Confirm that every asset exists before referencing it. Use the actual shared stylesheet, JavaScript, and image filenames from the repository.

7. Accuracy, Compliance, and Student Safety

International education requirements can change. Verify country-specific information against current official sources, including:

* The university or institution itself.
* The relevant national education regulator or recognition authority.
* The appropriate immigration or visa authority.
* The relevant professional regulator or licensing authority for regulated careers.

Apply the following standards:

* Distinguish general guidance from confirmed institution-specific requirements.
* Do not promise admission, visa approval, scholarships, employment, licensing eligibility, or specific outcomes.
* Include review dates for time-sensitive information and update content when requirements change.
* Clearly identify estimated costs and link to official fee information when available.
* Avoid presenting third-party claims as official institutional statements.
* Provide appropriate privacy and security protections for any student enquiry or document-submission workflow.

For MBBS and other regulated professional programmes, students must verify the exact university, campus, programme, clinical training arrangements, and recognition status against the requirements applicable in their intended country of practice.

8. Functional Requirements

Before considering this section production-ready, confirm that:

* [ ]	All listed HTML pages exist.
* [ ]	Destination links resolve to the correct pages.
* [ ]	Navigation and footer links match the actual project structure.
* [ ]	Search and enquiry forms have working destinations and server-side validation, where included.
* [ ]	Shared JavaScript files exist and execute without relevant browser-console errors.
* [ ]	Images and videos load correctly, with appropriate fallbacks.
* [ ]	Each page has a unique title and meta description.
* [ ]	Canonical URLs reflect the actual deployed URL structure.
* [ ]	Mobile navigation, keyboard interaction, and reduced-motion preferences work correctly.
* [ ]	Country-specific information is reviewed for accuracy.
* [ ]	External links point to appropriate and current sources.

9. Maintenance Checklist

When adding or updating a destination:

* [ ]	Add or update its HTML page.
* [ ]	Add links from index.html and more-countries.html.
* [ ]	Update relevant navigation or search data if the project uses it.
* [ ]	Confirm all image, stylesheet, and script paths.
* [ ]	Verify current official admission, recognition, visa, and cost information.
* [ ]	Test desktop and mobile layouts.
* [ ]	Check internal links and browser-console errors.
* [ ]	Update SEO metadata and the content review date.
* [ ]	Confirm that any new forms or integrations enforce appropriate security controls.

10. Maintenance Policy

Update this document whenever the directory structure, destination pages, asset paths, integrations, or content requirements change.

Keep documentation aligned with the actual repository. Identify planned enhancements separately from implemented functionality, and do not describe a page, integration, or asset as operational until it has been verified.

⸻

MedOrbits — Study · Work · Grow

Explore international education pathways, compare destinations, and prepare for your next academic step.

Save as: education/study-abroad/README.md. The documented filenames follow the structure in your draft; verify the files and assets exist before marking the section complete.