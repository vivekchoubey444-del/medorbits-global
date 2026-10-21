MedOrbits Icon Library

Path: /assets/icons/README.md
Purpose: Central documentation for the MedOrbits SVG icon library.
Status: Living documentation

1. Overview

The MedOrbits icon library provides reusable SVG assets for education, career guidance, professional development, social services, and other website features.

Icons should be:

* Consistent with the MedOrbits visual identity.
* Scalable and responsive across desktop, tablet, and mobile.
* Accessible to screen readers where appropriate.
* Lightweight, reusable, and easy to maintain.
* Organized by purpose and stored in predictable locations.
* Compatible with the website’s existing design system.

Important: Preserve the established visual design of existing icons. New icons should complement the current collection rather than introduce an unrelated style.

2. Directory Structure

assets/
└── icons/
    ├── README.md
    ├── education/
    │   └── README.md
    ├── career/
    │   └── README.md
    └── social/
        └── README.md

Each category directory should contain its own documentation and relevant SVG assets.

Additional categories may be introduced when a distinct group of icons is needed.

3. Education Icons

Directory: /assets/icons/education/

Suggested icon inventory:

education/
├── README.md
├── university.svg
├── college.svg
├── school.svg
├── course.svg
├── degree.svg
├── diploma.svg
├── admission.svg
├── application.svg
├── entrance-exam.svg
├── scholarship.svg
├── fees.svg
├── documents.svg
├── certificate.svg
├── online-learning.svg
├── study-abroad.svg
├── hostel.svg
├── library.svg
├── classroom.svg
├── student.svg
└── graduation.svg

These filenames describe the intended inventory. Confirm that each file exists before referencing it in production.

4. Career Icons

Directory: /assets/icons/career/

Suggested icon inventory:

career/
├── README.md
├── career.svg
├── career-assessment.svg
├── career-counselling.svg
├── career-guidance.svg
├── career-planning.svg
├── career-resources.svg
├── career-success.svg
├── career-transition.svg
├── certification.svg
├── cover-letter.svg
├── employer.svg
├── employment-support.svg
├── internship.svg
├── interview.svg
├── job-application.svg
├── job-opening.svg
├── job-search.svg
├── networking.svg
├── portfolio.svg
├── professional-skills.svg
├── promotion.svg
├── recruitment.svg
├── remote-work.svg
├── resume.svg
├── salary.svg
├── saved-job.svg
├── soft-skills.svg
├── technical-skills.svg
├── training.svg
└── work-experience.svg

Use career icons consistently throughout career counselling, job search, recruitment, professional development, training, and employment support interfaces.

5. Social Icons

Directory: /assets/icons/social/

Suggested icon inventory:

social/
├── README.md
├── community.svg
├── volunteer.svg
├── accessibility.svg
├── support.svg
├── family.svg
├── public-service.svg
├── inclusion.svg
└── outreach.svg

Add only icons relevant to the services and features provided by MedOrbits.

6. File Naming Standards

Use lowercase, descriptive, hyphen-separated filenames.

Preferred:

career-guidance.svg
job-application.svg
study-abroad.svg

Avoid:

CareerGuidance.svg
job_application.svg
icon-final-new.svg

Naming rules:

1. Use lowercase letters.
2. Separate multiple words with hyphens.
3. Use names that describe the icon’s meaning.
4. Keep filenames stable after integration.
5. Avoid duplicate filenames within the same category.
6. Do not rename existing assets without updating their references.
7. Keep category-specific icons in the appropriate directory.

7. Visual Design Standards

Existing icon compatibility

* Preserve the established palette, proportions, gradients, shapes, and illustration style.
* Use existing icons as the reference for new designs.
* Avoid unnecessary changes to established artwork.
* Keep illustrations recognizable at their intended display size.
* Use a consistent level of visual detail across related icons.

MedOrbits visual direction

Where appropriate, use the existing premium visual language, including dark plum or charcoal backgrounds, champagne-gold accents, and complementary lavender details.

Do not force this palette onto icons that already follow a different established category style.

Shape and composition

* Center the main illustration within its viewBox.
* Maintain balanced spacing around the artwork.
* Avoid clipping important details.
* Use clear silhouettes and distinguishable shapes.
* Ensure icons remain legible at small sizes.

8. SVG Technical Standards

SVG is the preferred format for interface icons and illustrations.

Standard requirements

* Use a valid SVG root element.
* Include an appropriate viewBox.
* Use explicit width and height when required by the established icon design.
* Avoid unnecessary embedded raster images.
* Avoid scripts, event-handler attributes, and external dependencies.
* Prefer reusable SVG primitives such as path, rect, circle, line, and g.
* Use gradients and filters only when they serve the intended visual design.
* Avoid excessive path complexity and unnecessary metadata.

Example SVG structure

<svg
  xmlns=“http://www.w3.org/2000/svg”
  width=“128”
  height=“128”
  viewBox=“0 0 128 128”
  role=“img”
  aria-labelledby=“icon-title icon-description”
>
  <title id=“icon-title”>Career Guidance</title>
  <desc id=“icon-description”>
    An illustration representing career guidance and planning.
  </desc>
  <!— Place the icon artwork here. —>
</svg>

This is a structural example, not a replacement for the actual icon artwork.

ViewBox conventions

Use a viewBox that matches the asset’s intended design.

* Use viewBox=“0 0 24 24” for compact interface icons when that matches the existing collection.
* Use viewBox=“0 0 128 128” for detailed illustrations when that matches the existing collection.

Do not resize or redraw existing artwork solely to make every icon use the same dimensions.

9. Accessibility

Icons must be understandable and usable across assistive technologies.

Decorative icons

When an icon adds no information beyond nearby text, hide it from assistive technology:

<img src=“/assets/icons/career/resume.svg” alt=“” aria-hidden=“true”>

Informative images

When an SVG is used as an informative image, provide meaningful alternative text:

<img
  src=“/assets/icons/career/career-guidance.svg”
  alt=“Career guidance”
  width=“128”
  height=“128”
  loading=“lazy”
>

Inline SVG

For inline SVG illustrations, use an appropriate accessible title and description when the image conveys meaningful information.

Do not repeat the same accessible label unnecessarily when the adjacent text already communicates the icon’s purpose.

10. Using Icons in HTML

External SVG image

<img
  src=“/assets/icons/career/job-search.svg”
  alt=“”
  width=“128”
  height=“128”
  loading=“lazy”
>

Icon with a text label

<div class=“career-feature”>
  <img
    src=“/assets/icons/career/career-guidance.svg”
    alt=“”
    aria-hidden=“true”
    width=“128”
    height=“128”
  >
  <h3>Career Guidance</h3>
  <p>Explore career pathways and professional opportunities.</p>
</div>

CSS sizing

.icon {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  object-fit: contain;
}
.icon—illustration {
  width: 8rem;
  height: 8rem;
  object-fit: contain;
}

Use class names that fit the existing CSS architecture. Do not introduce conflicting global styles.

11. Security and Privacy

SVG files are image assets and must be treated as static content.

* Do not embed JavaScript in SVG files.
* Do not use inline event-handler attributes such as onload or onclick.
* Avoid untrusted external references.
* Do not embed credentials, tokens, personal information, or confidential data.
* Review externally sourced SVGs before adding them to the repository.
* Prefer local assets over unnecessary third-party dependencies.

12. Performance

* Keep SVG markup as simple as practical.
* Remove unused shapes, definitions, and metadata where appropriate.
* Reuse assets rather than creating unnecessary duplicates.
* Use lazy loading for below-the-fold HTML image elements.
* Avoid loading the same asset through multiple mechanisms without a clear reason.
* Do not add heavy filters or complex animations unless required by the design.

13. Integration Checklist

Before referencing an icon in a page or component:

* [ ]	Confirm the SVG file exists at the expected path.
* [ ]	Verify the filename and letter casing.
* [ ]	Confirm the SVG opens and renders correctly.
* [ ]	Check the artwork against the existing visual style.
* [ ]	Verify the intended display dimensions.
* [ ]	Provide appropriate accessibility treatment.
* [ ]	Check rendering on desktop and mobile.
* [ ]	Confirm the asset path works from the deployed website.
* [ ]	Update category documentation when the inventory changes.

14. Maintenance

When adding, updating, or removing an icon:

1. Preserve existing asset names where possible.
2. Update the relevant category README.
3. Update this central inventory when appropriate.
4. Search for references to renamed or removed assets before changing them.
5. Remove obsolete assets only after confirming they are no longer used.
6. Keep documentation aligned with the actual repository.

The documented inventory represents intended assets, not a guarantee that every listed file currently exists.

15. Source of Truth

This file is the central entry point for the MedOrbits icon library.

* General standards and directory organization belong here.
* Education-specific assets belong in /assets/icons/education/README.md.
* Career-specific assets belong in /assets/icons/career/README.md.
* Social-service assets belong in /assets/icons/social/README.md.

Keep this document concise enough to maintain while ensuring that naming, accessibility, security, and visual consistency standards remain clear.