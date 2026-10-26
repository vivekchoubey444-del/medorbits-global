MedOrbits Career Icons

Directory: assets/icons/career/
Category: Career Development and Employment
Brand: MedOrbits
Design System: Royal Burgundy and Champagne Gold
Primary Format: SVG
Access: Public frontend assets

⸻

1. Purpose

The assets/icons/career/ directory contains reusable vector icons for career development, employment opportunities, internships, recruitment services, professional skills, and career guidance across the MedOrbits platform.

These icons provide a consistent visual language for career-related pages, cards, navigation elements, forms, checklists, dashboards, and educational resources.

The icon library prioritizes visual consistency, accessibility, lightweight assets, and reuse across the platform.

2. Directory Structure

assets/
└── icons/
    └── career/
        ├── README.md
        ├── career.svg
        ├── career-guidance.svg
        ├── career-planning.svg
        ├── resume.svg
        ├── cover-letter.svg
        ├── interview.svg
        ├── job-search.svg
        ├── job-opening.svg
        ├── saved-job.svg
        ├── job-application.svg
        ├── internship.svg
        ├── recruitment.svg
        ├── employer.svg
        ├── professional-skills.svg
        ├── soft-skills.svg
        ├── technical-skills.svg
        ├── portfolio.svg
        ├── networking.svg
        ├── career-assessment.svg
        ├── career-counselling.svg
        ├── career-transition.svg
        ├── promotion.svg
        ├── salary.svg
        ├── remote-work.svg
        ├── work-experience.svg
        ├── certification.svg
        ├── training.svg
        ├── career-resources.svg
        ├── employment-support.svg
        └── career-success.svg

Inventory note: This is the intended icon inventory. A filename in this README does not confirm that the corresponding SVG file has been created or reviewed.

3. Icon Catalogue

Icon	Intended use
career.svg	General career services and career dashboard sections.
career-guidance.svg	Career guidance and professional direction.
career-planning.svg	Career roadmaps, goals, and planning activities.
resume.svg	Resume preparation and review resources.
cover-letter.svg	Cover-letter preparation and guidance.
interview.svg	Interview preparation and practice.
job-search.svg	Job discovery and search interfaces.
job-opening.svg	Available positions and job listings.
saved-job.svg	Saved or bookmarked job opportunities.
job-application.svg	Job application submission and tracking.
internship.svg	Internship opportunities and related services.
recruitment.svg	Recruitment and hiring services.
employer.svg	Employer information and employer-facing features.
professional-skills.svg	Professional competencies and workplace skills.
soft-skills.svg	Communication, collaboration, and interpersonal skills.
technical-skills.svg	Technical competencies and practical skills.
portfolio.svg	Professional portfolios and project showcases.
networking.svg	Professional networking and industry connections.
career-assessment.svg	Career assessments and readiness evaluations.
career-counselling.svg	Career counselling and advisory services.
career-transition.svg	Career changes and professional transitions.
promotion.svg	Career progression and advancement.
salary.svg	Salary information and compensation guidance.
remote-work.svg	Remote and flexible work opportunities.
work-experience.svg	Employment history and practical experience.
certification.svg	Professional certificates and qualifications.
training.svg	Professional training and upskilling.
career-resources.svg	Career guides and learning materials.
employment-support.svg	Employment assistance and job-search support.
career-success.svg	Career milestones and professional achievements.

4. Brand and Visual Design

All icons should follow the MedOrbits Royal Burgundy and Champagne Gold visual identity.

Recommended visual standards

* Primary colour: Royal Burgundy, coordinated with existing MedOrbits design tokens.
* Accent colour: Champagne Gold, used for emphasis and selected details.
* Supporting colours: Complementary dark neutrals and accessible foreground colours.
* Background: Transparent by default.
* Style: Consistent outline or filled-vector treatment.
* Geometry: Clear silhouettes, balanced proportions, and consistent visual weight.
* Complexity: Simple enough to remain recognizable at small sizes.

Use existing shared design tokens or CSS styling where possible instead of hardcoding different colours into every icon.

Do not mix unrelated icon styles, inconsistent stroke widths, or unnecessarily detailed illustrations within the same collection.

5. SVG Technical Standards

Each icon should:

1. Use valid, optimized SVG markup.
2. Use a consistent viewBox, preferably 0 0 24 24 for standard interface icons.
3. Scale cleanly without distortion.
4. Avoid unnecessary metadata and excessive path complexity.
5. Use transparent backgrounds unless a specific design requires otherwise.
6. Avoid embedded raster images where a vector implementation is practical.
7. Avoid scripts, embedded event handlers, and unsafe external references.
8. Be checked for rendering problems at the sizes used by the website.

Minimal SVG structure

<svg
  xmlns=“http://www.w3.org/2000/svg”
  viewBox=“0 0 24 24”
  fill=“none”
  stroke=“currentColor”
  stroke-width=“1.75”
  stroke-linecap=“round”
  stroke-linejoin=“round”
  aria-hidden=“true”
>
  <!— Insert approved icon paths here. —>
</svg>

This is a structural example, not a complete career icon. Replace the comment with valid SVG geometry before publishing the asset.

Using currentColor allows an inline SVG or a compatible icon system to follow the surrounding CSS colour. An SVG loaded through an HTML <img> element does not automatically inherit the parent element’s text colour.

The existing career icon designs may use a larger viewBox and explicit burgundy, gold, and supporting colours. Keep the collection consistent when creating new icons; do not resize or rewrite existing assets solely to match the example above.

6. Usage in HTML

For an informative icon used inside a page located one directory below the project root:

<img
  src=“../assets/icons/career/resume.svg”
  alt=“Resume resources”
  width=“32”
  height=“32”
  loading=“lazy”
/>

Use a relative path that matches the actual HTML file location. For pages served from the site root, root-relative paths such as /assets/icons/career/resume.svg may be more appropriate.

Decorative icons

When an icon adds decoration but conveys no additional information, use an empty alternative text:

<img
  src=“../assets/icons/career/career-success.svg”
  alt=“”
  width=“24”
  height=“24”
  aria-hidden=“true”
  loading=“lazy”
/>

Do not use empty alternative text for an icon that communicates essential information without an equivalent accessible label.

Icons inside interactive controls

Provide an accessible name for the button or link itself. Do not rely solely on an icon’s appearance.

<button type=“button” aria-label=“Save job”>
  <img
    src=“/assets/icons/career/saved-job.svg”
    alt=“”
    width=“20”
    height=“20”
    aria-hidden=“true”
  />
</button>

This example illustrates accessible labelling only. Implement the actual save action and its state handling through the appropriate application module.

7. Integration with MedOrbits

Use the career icon collection where it improves clarity and consistency, including:

* Career guidance and counselling pages.
* Career planning and assessment interfaces.
* Job listings and saved-job controls.
* Job application tracking.
* Internship discovery and applications.
* Recruitment and employer services.
* Resume, interview, and portfolio resources.
* Professional skills and certification sections.
* Employment assistance and career-support dashboards.
* Career checklists and downloadable resource catalogues.

Integration principles

* Reuse the same icon for the same concept throughout the platform.
* Prefer the existing shared icon library when it already provides a suitable icon.
* Avoid creating duplicate icons that differ only by colour or size.
* Keep icon paths independent of environment-specific URLs.
* Use CSS for sizing and layout rather than creating separate files for every display size.
* Verify all references after renaming or moving an icon.

Career icons are interface assets, not substitutes for downloadable career documents. Store PDF guides and checklists in their designated directories under assets/documents/.

8. Accessibility Requirements

* Provide meaningful alternative text for informative images.
* Use empty alternative text for decorative images.
* Give icon-only buttons and links accessible names.
* Maintain sufficient contrast between icons and their backgrounds.
* Do not communicate status through colour alone.
* Preserve visible keyboard focus on interactive controls.
* Avoid excessively intricate shapes that become indistinguishable at small sizes.

Accessibility requirements apply to the complete interface, not just the SVG file.

9. Security and Asset Optimization

Before publishing an SVG:

* Remove scripts and embedded event handlers.
* Avoid unsafe external resource references.
* Sanitize SVGs obtained from third parties.
* Validate the markup and inspect the rendered result.
* Remove unnecessary metadata and optimize path data.
* Confirm that the file does not contain unexpected embedded content.

SVG files can contain active content in some rendering contexts. Treat externally sourced SVGs as untrusted until reviewed and sanitized.

Keep assets small enough for efficient page loading without degrading their appearance.

10. Naming Conventions

Use lowercase, descriptive, hyphen-separated filenames.

Examples:

* career-guidance.svg
* job-application.svg
* career-assessment.svg
* employment-support.svg

Avoid spaces, ambiguous abbreviations, inconsistent spelling, and unnecessary version numbers in filenames.

Before introducing a new icon, check whether an equivalent already exists in the career collection or shared icon library.

11. Quality Assurance Checklist

Before adding or updating an icon, verify:

* [ ]	The filename follows the naming convention.
* [ ]	The SVG is valid and renders correctly.
* [ ]	The icon follows the MedOrbits visual identity.
* [ ]	The icon remains recognizable at its intended display size.
* [ ]	The SVG contains no unsafe active content.
* [ ]	Accessibility requirements are satisfied by the consuming interface.
* [ ]	The asset is optimized and uses a transparent background where appropriate.
* [ ]	The icon does not unnecessarily duplicate an existing asset.
* [ ]	All relevant page references resolve correctly.
* [ ]	This README reflects the actual icon inventory.

12. Maintenance

Whenever an icon is added, renamed, replaced, or removed:

1. Update the directory inventory in this README.
2. Update the icon catalogue and intended-use description.
3. Check references across career pages and shared components.
4. Verify visual consistency and accessibility.
5. Remove obsolete references only after confirming that no pages depend on them.

Do not list planned icons as available assets until their files have been created and reviewed.

⸻

Module objective: Provide a consistent, accessible, secure, and maintainable icon library for MedOrbits career services, supporting career development, employment, internships, recruitment, and professional guidance within the Royal Burgundy and Champagne Gold design system.