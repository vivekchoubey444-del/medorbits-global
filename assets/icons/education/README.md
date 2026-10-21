MedOrbits Education Icons

Directory: /assets/icons/education/
Category: Education, Admissions and Student Services
Brand: MedOrbits
Design System: Royal Burgundy and Champagne Gold
Primary Format: SVG
Access: Public frontend assets

⸻

1. Purpose

The assets/icons/education/ directory contains reusable vector icons for education discovery, academic programmes, college and university information, admissions, entrance examinations, scholarships, student support, and study-abroad services.

These icons provide a consistent visual language across MedOrbits, including course catalogues, institution profiles, admissions guidance, application forms, educational resources, dashboards, and comparison interfaces.

The collection prioritizes clarity, accessibility, visual consistency, lightweight assets, and reuse across the platform.

2. Directory Structure

The following is the proposed icon inventory. Create each SVG when required by the application and reviewed for quality.

assets/icons/education/
├── README.md
├── education.svg
├── academic-programme.svg
├── course.svg
├── course-catalogue.svg
├── college.svg
├── university.svg
├── institution.svg
├── campus.svg
├── classroom.svg
├── online-learning.svg
├── distance-learning.svg
├── admission.svg
├── admission-process.svg
├── application.svg
├── application-status.svg
├── entrance-exam.svg
├── examination.svg
├── admit-card.svg
├── result.svg
├── merit-list.svg
├── counselling.svg
├── seat-allocation.svg
├── eligibility.svg
├── required-documents.svg
├── document-verification.svg
├── scholarship.svg
├── financial-aid.svg
├── education-loan.svg
├── tuition-fees.svg
├── fee-payment.svg
├── fee-refund.svg
├── hostel.svg
├── student-support.svg
├── student-profile.svg
├── graduation.svg
├── certificate.svg
├── transcript.svg
├── research.svg
├── library.svg
├── study-abroad.svg
├── international-admission.svg
├── student-visa.svg
├── language-test.svg
├── career-pathway.svg
├── academic-calendar.svg
├── education-resources.svg
└── academic-success.svg

Inventory note: These filenames define the proposed collection; they do not confirm that every SVG file exists in the repository.

3. Icon Catalogue

Category	Representative icons	Intended use
General education	education.svg, academic-programme.svg, course.svg	Education landing pages, course discovery, academic categories
Institutions	college.svg, university.svg, institution.svg, campus.svg	College listings, university profiles, campus information
Learning	classroom.svg, online-learning.svg, distance-learning.svg, library.svg	Learning methods and academic resources
Admissions	admission.svg, admission-process.svg, application.svg, eligibility.svg	Admission guidance, application workflows, eligibility
Examinations	entrance-exam.svg, examination.svg, admit-card.svg, result.svg, merit-list.svg	Entrance examinations, examination resources, results
Counselling	counselling.svg, seat-allocation.svg	Counselling workflows and allocation-related information
Documents	required-documents.svg, document-verification.svg, certificate.svg, transcript.svg	Document checklists, verification, academic records
Financial assistance	scholarship.svg, financial-aid.svg, education-loan.svg	Scholarships, financial support, education financing
Fees	tuition-fees.svg, fee-payment.svg, fee-refund.svg	Fee guidance, payments, refund information
Student services	hostel.svg, student-support.svg, student-profile.svg	Accommodation, student accounts, support services
Academic progression	graduation.svg, research.svg, academic-success.svg	Graduation, research, academic milestones
International education	study-abroad.svg, international-admission.svg, student-visa.svg, language-test.svg	International admissions and study-abroad guidance
Career preparation	career-pathway.svg	Connections between academic programmes and career options
General resources	academic-calendar.svg, education-resources.svg	Academic schedules, guides, educational resources

4. Brand and Visual Design

All icons should follow the MedOrbits Royal Burgundy and Champagne Gold design system.

Recommended standards

* Primary colour: Royal Burgundy, aligned with existing MedOrbits design tokens.
* Accent colour: Champagne Gold for emphasis and selected details.
* Supporting colours: Complementary dark neutrals and accessible foreground colours.
* Background: Transparent by default.
* Style: Consistent outline or filled-vector treatment.
* Geometry: Balanced proportions, clear silhouettes, consistent visual weight.
* Complexity: Simple enough to remain recognizable at small sizes.

Use the same visual language across education, career, account, and other icon collections. Avoid creating a separate visual style for each directory.

Prefer shared CSS variables or design tokens over hardcoded colours in individual SVG files where practical. Where an SVG is loaded as an external image, ensure its colours render correctly without relying on CSS inheritance from the parent HTML element.

5. SVG Technical Standards

Every published icon should:

1. Use valid, optimized SVG markup.
2. Use a consistent viewBox, preferably 0 0 24 24 for standard interface icons.
3. Scale without distortion.
4. Avoid unnecessary metadata and overly complex paths.
5. Use transparent backgrounds unless a particular design requires otherwise.
6. Avoid embedded raster images when a vector implementation is practical.
7. Contain no scripts, embedded event handlers, or unsafe external references.
8. Render correctly at its intended display sizes.

Example SVG structure

<svg
  xmlns=“http://www.w3.org/2000/svg”
  width=“24”
  height=“24”
  viewBox=“0 0 24 24”
  fill=“none”
  stroke=“currentColor”
  stroke-width=“1.75”
  stroke-linecap=“round”
  stroke-linejoin=“round”
  aria-hidden=“true”
>
  <!— Insert reviewed education-icon paths here. —>
</svg>

This is a structural example, not a complete icon. Replace the comment with valid SVG geometry before publishing the asset.

Important: When an SVG is loaded using an HTML img element, its internal currentColor does not automatically inherit the parent element’s CSS colour. Use a compatible rendering method or explicit SVG colours where necessary.

6. Usage in HTML

Adjust relative paths according to the actual location of the HTML page. Confirm that the referenced file exists before using it.

Informative icon

<img
  src=“../assets/icons/education/university.svg”
  alt=“University”
  width=“32”
  height=“32”
  loading=“lazy”
/>

Decorative icon

For icons that add no information beyond nearby text:

<img
  src=“../assets/icons/education/graduation.svg”
  alt=“”
  width=“24”
  height=“24”
  aria-hidden=“true”
  loading=“lazy”
/>

Use an empty alt value only when the icon is decorative or its meaning is already adequately conveyed by surrounding content.

Icons in interactive controls

Icon-only buttons and links must have accessible names.

<button type=“button” aria-label=“View university details”>
  <img
    src=“../assets/icons/education/university.svg”
    alt=“”
    width=“20”
    height=“20”
    aria-hidden=“true”
  />
</button>

This example demonstrates accessible labelling only. Connect the button to the appropriate page navigation or application behaviour.

7. Integration with MedOrbits

Use education icons where they improve comprehension and navigation across:

* Course catalogues and academic programme pages.
* College and university directories.
* MBBS, BDS, AYUSH, nursing, pharmacy, paramedical, engineering, and other course pages.
* Entrance-examination guides and examination calendars.
* Admission-process pages and eligibility checklists.
* Application tracking and counselling interfaces.
* Scholarship and financial-aid resources.
* Tuition-fee guides, payment information, and refund policies.
* Hostel and accommodation information.
* Academic documents and verification workflows.
* Study-abroad and international-admission resources.
* Student dashboards and education-support services.
* Career-pathway and professional-development pages.

Integration principles

* Reuse one icon consistently for the same concept.
* Prefer existing shared icons when a suitable equivalent already exists.
* Avoid duplicate assets that differ only by size or colour.
* Keep filenames stable so page references remain predictable.
* Use CSS to control layout and display size.
* Do not use an icon as a substitute for explanatory text when users need detailed guidance.

Icons are visual interface assets. Store downloadable guides, checklists, brochures, and other documents in their designated directories under assets/documents/.

8. Accessibility Requirements

* Provide meaningful alternative text for informative icons.
* Use empty alternative text for decorative icons.
* Provide accessible names for icon-only buttons and links.
* Maintain sufficient contrast between icons and their backgrounds.
* Do not rely on colour alone to indicate admission status, eligibility, results, or other important information.
* Preserve keyboard focus visibility on interactive controls.
* Keep icon shapes distinguishable at their intended sizes.
* Ensure that icons supplement, rather than replace, accessible text labels.

Accessibility must be considered in both the SVG asset and the HTML component that uses it.

9. Security and Optimization

Before publishing an SVG:

* Validate and sanitize its markup.
* Remove scripts and embedded event handlers.
* Avoid unsafe external resource references.
* Review third-party SVGs before including them.
* Optimize path data and remove unnecessary metadata.
* Check that the icon does not contain unexpected embedded content.
* Confirm that the rendered icon matches the approved design.

Treat externally sourced SVGs as untrusted until reviewed and sanitized.

Keep the collection lightweight and avoid unnecessary duplicate variants.

10. Naming Conventions

Use descriptive, lowercase, hyphen-separated filenames.

Examples:

* academic-programme.svg
* entrance-exam.svg
* document-verification.svg
* financial-aid.svg
* international-admission.svg

Avoid spaces, inconsistent abbreviations, ambiguous names, and unnecessary version numbers in filenames.

Before adding an icon, check whether an equivalent already exists in assets/icons/education/ or the shared icon library.

11. Quality Assurance Checklist

Before publishing a new or updated icon, verify:

* [ ]	The filename follows the naming convention.
* [ ]	The SVG markup is valid and renders correctly.
* [ ]	The icon follows the MedOrbits visual identity.
* [ ]	The icon remains recognizable at the intended size.
* [ ]	No unsafe active content or unnecessary external references are present.
* [ ]	Accessibility requirements are satisfied by the consuming interface.
* [ ]	The asset is optimized.
* [ ]	Existing shared icons have been checked for duplication.
* [ ]	Referenced asset paths resolve correctly.
* [ ]	Relevant education pages display the icon correctly.
* [ ]	This README reflects the actual icon inventory.

12. Maintenance

Whenever an icon is added, renamed, replaced, or removed:

1. Update the directory inventory.
2. Update the icon catalogue and intended-use description.
3. Search for references across education pages and shared components.
4. Verify rendering, accessibility, and responsive behaviour.
5. Remove obsolete references only after confirming that no pages depend on them.
6. Keep the documented inventory synchronized with the actual SVG files.

Do not list planned icons as available assets until their files have been created and reviewed.

⸻

Module objective: Provide a consistent, accessible, secure, and maintainable education icon library for MedOrbits, supporting academic discovery, admissions, examinations, counselling, student services, financial assistance, and international education within the Royal Burgundy and Champagne Gold design system.