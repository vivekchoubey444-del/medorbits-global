MedOrbits — Study in India

Directory: education/study-in-india/
Section: Education → Study in India
Brand: MedOrbits
Design system: Royal Burgundy & Champagne Gold

1. Purpose

The Study in India module serves as a destination hub for students exploring education opportunities in India. It organizes course-specific information, admission guidance, eligibility considerations, entrance examinations, and academic pathways across medical, healthcare, engineering, management, law, and other disciplines.

This directory provides a consistent structure for discovering courses and navigating relevant MedOrbits education resources.

Implementation note: This README documents the intended structure and maintenance requirements. Verify actual files, functionality, shared assets, and integrations against the current repository before treating them as implemented.

2. Directory Structure

study-in-india/
├── README.md
├── index.html
├── mbbs.html
├── bds.html
├── ayush.html
├── nursing.html
├── pharmacy.html
├── paramedical.html
├── engineering.html
├── management.html
├── law.html
├── pg-medical.html
├── pg-others.html
└── more-courses.html

3. Page Responsibilities

File	Purpose
index.html	Main Study in India landing page introducing study pathways and linking to course pages.
mbbs.html	MBBS education, admission pathways, eligibility, counselling, and medical-college research.
bds.html	Dental education and BDS admission information.
ayush.html	AYUSH pathways, including relevant traditional and complementary healthcare programmes.
nursing.html	Nursing courses, study routes, eligibility, and career pathways.
pharmacy.html	Pharmacy programmes, admission planning, and related career options.
paramedical.html	Paramedical and allied-health programmes and application guidance.
engineering.html	Engineering disciplines, course selection, entrance examinations, and institution research.
management.html	Management and business programmes, including undergraduate and postgraduate pathways.
law.html	Legal education pathways, entrance examinations, and law-school research.
pg-medical.html	Postgraduate medical education and related admission planning.
pg-others.html	Other postgraduate programmes outside the dedicated medical postgraduate page.
more-courses.html	Additional courses and pathways not covered by the primary pages.

4. Design System

All pages should follow the MedOrbits Royal Burgundy & Champagne Gold visual direction.

Colour and surfaces

* Primary surfaces: Deep royal burgundy and dark aubergine.
* Accents: Champagne gold for highlights, borders, icons, and primary actions.
* Supporting colours: Coordinated dark, muted, and tinted surfaces that preserve readability.
* Background policy: Avoid pure-white section backgrounds. Maintain strong contrast between text, surfaces, and gold accents.

Typography and layout

* Pair elegant display headings with a legible sans-serif body font.
* Use responsive sections, compact cards, clear visual hierarchy, and consistent spacing.
* Keep content readable across mobile, tablet, and desktop layouts.
* Avoid horizontal overflow and unintended text wrapping or clipping.

Interaction

* Use the established sticky header, dropdown navigation, and mobile menu where supported by the reference implementation.
* Reuse existing navigation and animation components.
* Apply subtle transitions and the animated MedOrbits introduction where appropriate.
* Respect reduced-motion preferences.

Accessibility

* Use semantic HTML and a logical heading hierarchy.
* Provide visible keyboard focus states.
* Use descriptive image alternative text.
* Ensure controls work with keyboard and touch input.
* Associate form labels with their inputs.
* Maintain sufficient text and interactive-element contrast.

5. Shared Project Dependencies

Reuse existing site-wide assets rather than creating duplicate files.

Stylesheet

/assets/css/style.css

JavaScript modules

Use the following modules when they exist in the deployed project:

/assets/js/constants.js
/assets/js/config.js
/assets/js/utils.js
/assets/js/navigation.js
/assets/js/search.js
/assets/js/animations.js
/assets/js/app.js

Brand and image assets

/assets/images/logo/medorbits-logo.png
/assets/images/
/assets/images/placeholders/image-placeholder.svg

The placeholder path is optional and should be used only if that file exists.

Dependency rule: Verify each stylesheet, script, logo, and image path before referencing it. Include only existing modules, and follow the loading order and initialization conventions used by the current application.

6. Navigation and Internal Linking

* Link the Study in India hub from the main Education navigation and relevant Education Hub or Study Abroad pages.
* Link each course card to its corresponding page in this directory.
* Provide a clear route back to /education/study-in-india/index.html.
* Link general course discovery to /education/courses.html.
* Reuse relevant admission, fee, scholarship, document, college, and university resources where those pages exist.
* Align contact and guidance calls to action with the actual site routes, such as /pages/contact.html and /pages/apply.html, when available.
* Verify every destination before publishing a link.
* Use consistent navigation labels and avoid links to placeholder or nonexistent pages.

7. SEO and Page Metadata

Every HTML page should include:

* A unique, descriptive <title>.
* A concise, page-specific meta description.
* A canonical URL matching the actual deployed page.
* A viewport declaration.
* An appropriate theme colour.
* A meaningful heading hierarchy and descriptive link text.
* Relevant image alternative text.
* loading=“lazy” for non-critical images where appropriate.
* An appropriate indexing directive based on the page’s intended visibility.

Do not reuse the MBBS page title, description, or canonical URL unchanged on other course pages. Canonical URLs must reflect the actual deployment domain and URL structure rather than an assumed domain.

8. Content Accuracy and Admissions Guidance

Course and admission information may change by academic year, institution, examination cycle, applicant category, and applicable regulations.

* Treat eligibility, entrance examinations, recognition, fees, seat availability, counselling rules, and deadlines as cycle-specific.
* Prefer official regulator, examination, institution, and counselling-authority information.
* Clearly distinguish general educational guidance from official requirements.
* Link to authoritative sources where appropriate.
* Identify the applicable academic year or review date for time-sensitive information.
* Do not promise admission, scholarships, employment, or specific outcomes.
* Direct students to verify current requirements with the relevant official authority before applying.

For regulated professional programmes, ensure that claims about recognition, eligibility, registration, and professional practice are supported by the relevant authoritative sources.

9. Functional Requirements

Before considering a page production-ready, verify the following:

* [ ]	The HTML file exists at the documented path.
* [ ]	Course cards and internal links resolve correctly.
* [ ]	The shared header, footer, and navigation behave as expected.
* [ ]	The sticky header, dropdowns, and mobile menu work where implemented.
* [ ]	Search and calls to action work where implemented.
* [ ]	All image, stylesheet, and script paths resolve.
* [ ]	No relevant browser-console errors or missing assets remain.
* [ ]	Metadata, canonical URLs, headings, and image alternative text are correct.
* [ ]	Keyboard navigation, focus visibility, and reduced-motion behaviour are tested.
* [ ]	Desktop, tablet, and mobile layouts are checked.
* [ ]	Admission details are verified against current official sources.
* [ ]	Forms and backend integrations enforce server-side validation and appropriate authorization where applicable.

10. Maintenance Checklist

When adding or updating a course page:

* [ ]	Add or update the HTML page.
* [ ]	Update this README.
* [ ]	Add the course to index.html and more-courses.html where appropriate.
* [ ]	Update relevant site navigation or course-directory data.
* [ ]	Confirm image, stylesheet, and script paths.
* [ ]	Verify current official admission, eligibility, and recognition information.
* [ ]	Test desktop and mobile layouts.
* [ ]	Check internal links and browser-console errors.
* [ ]	Update page-specific SEO metadata and review dates.
* [ ]	Confirm that any new forms or integrations follow the applicable security requirements.

11. Maintenance Policy

Keep this documentation aligned with the actual repository. Update it whenever the directory structure, course pages, shared dependencies, navigation, or admission requirements change.

Document planned enhancements separately from implemented functionality. Do not describe a feature, integration, or asset as operational until it has been verified.

⸻

MedOrbits — Study · Work · Grow

Explore education pathways in India, compare course options, and prepare for your next academic step.