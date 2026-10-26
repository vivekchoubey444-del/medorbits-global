MedOrbits Service Images

Directory: assets/images/services/
Project: MedOrbits
Category: Education Consultancy, Student Support, and Career Services Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/services/ directory contains visual assets representing the services offered through the MedOrbits website.

These images help users understand the available services and provide consistent visual support across service cards, landing pages, informational sections, and promotional content.

Images may be used for:

* Education consultancy
* Career support and professional guidance
* Student support services
* Admissions and application assistance
* Course selection and academic planning
* Education-related counselling
* Service overview cards
* Service-specific landing pages
* Future approved service categories

All service imagery should accurately represent the associated service and complement the established MedOrbits visual identity.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/services/
├── README.md
├── career-support.jpg
├── education-consultation.jpg
└── student-support.jpg

Current asset catalogue

Filename	Observed size	Intended use
career-support.jpg	17.0 KB	Career guidance and professional support
education-consultation.jpg	17.1 KB	Education planning and consultancy
student-support.jpg	17.1 KB	Student guidance and support services

File sizes are approximate and may change after optimization or replacement.

The screenshot confirms the filenames and approximate sizes. It does not independently verify the image dimensions, visual content, licensing, or application references.

3. Brand and Visual Direction

All service images must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing colour tokens, gradients, typography, and component styles.

Service imagery should be:

* Professional and visually refined
* Relevant to the service being described
* Suitable for mobile and desktop layouts
* Consistent with the premium MedOrbits presentation
* Clear and balanced within the existing component
* Optimized for efficient page loading

If an asset is an abstract branded illustration, do not present it as a documentary photograph of real staff, students, institutions, or facilities.

4. Existing Asset Guidelines

career-support.jpg

Use for career guidance, career planning, professional development, and related employment-support information.

Do not imply guaranteed employment, placement, salary, or career outcomes.

education-consultation.jpg

Use for education consultancy, course discovery, academic planning, and guidance about educational pathways.

Do not imply guaranteed admissions, official institutional endorsement, or confirmed seat availability unless the relevant claims are verified and authorized.

student-support.jpg

Use for student assistance, educational guidance, application support, and related student-facing services.

Keep the image consistent with the actual service content presented on the page.

5. Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized raster illustrations and content imagery.
* Use SVG for suitable scalable vector artwork.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing files, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Image Dimensions and Responsive Behaviour

Use existing service components as the primary reference for image dimensions.

Placement	Suggested aspect ratio	Example dimensions
Service card	4:3	800 × 600 px
Service landing-page hero	16:9	1600 × 900 px
Wide service banner	2:1	1600 × 800 px
Square service thumbnail	1:1	800 × 800 px

These are recommendations, not verified specifications for the current assets.

Images should retain their intended proportions, avoid distortion, and keep important visual elements visible after cropping.

Preserve the existing layout, responsive breakpoints, spacing, and component dimensions.

7. Recommended HTML Integration

The following example illustrates how to reference a service image.

<img
  src=“/assets/images/services/education-consultation.jpg”
  alt=“”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

The dimensions are illustrative. Verify the actual image dimensions and intended component before using them.

Use an empty alt attribute when the image is decorative and surrounding text already communicates the service. Provide concise alternative text when the image conveys information not available elsewhere.

Adapt the asset path if the website is deployed under a subdirectory rather than the domain root.

8. Optimization and Loading

Service images should balance visual quality and loading performance.

Recommended practices:

* Compress images before publishing.
* Resize images to appropriate display dimensions.
* Prefer JPG for supported raster imagery.
* Remove unnecessary metadata.
* Use responsive image sources where beneficial.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold images where appropriate.
* Avoid unnecessary JavaScript-based image loading.
* Avoid serving oversized originals when smaller files provide sufficient quality.

Do not lazy-load the primary above-the-fold image by default when it is the likely Largest Contentful Paint element.

File size alone does not establish image quality, correct dimensions, or production suitability.

9. Accessibility and Content Accuracy

* Use meaningful alternative text for informative images.
* Use empty alternative text for decorative images.
* Maintain sufficient text contrast.
* Keep headings, descriptions, and calls to action as HTML.
* Preserve keyboard navigation and visible focus indicators.
* Avoid relying on image colour alone to communicate meaning.
* Ensure essential service information remains available as accessible text.
* Do not imply unsupported partnerships, qualifications, or outcomes.

Service descriptions and imagery must accurately reflect the services MedOrbits actually offers.

10. Missing Assets and Fallbacks

When a service image is unavailable:

1. Use a verified existing placeholder when appropriate.
2. Preserve the image container dimensions.
3. Keep the service title, description, and actions visible.
4. Avoid broken-image indicators where practical.
5. Verify the fallback path before using it.
6. Avoid replacing an entire service component when only its image is missing.
7. Preserve the existing website design system.

A missing image should not prevent users from accessing the associated service information.

11. Copyright and Licensing

Before publishing or replacing a service image:

* Verify ownership or permission to use the asset.
* Confirm commercial-use and modification rights.
* Provide attribution when required.
* Obtain appropriate releases for identifiable individuals where necessary.
* Avoid unauthorized institutional logos and third-party branding.
* Do not fabricate testimonials, partnerships, or service outcomes.
* Maintain source and licensing records where appropriate.

12. Quality Assurance Checklist

File integrity

* [ ]	The image exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The extension matches the actual file format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	Application references point to the correct files.

Visual quality

* [ ]	The image matches its intended service.
* [ ]	Royal Burgundy and Champagne Gold styling is preserved.
* [ ]	Cropping retains important visual elements.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Existing page layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour matches the image’s position.
* [ ]	Avoidable layout shifts are prevented.
* [ ]	Text contrast remains sufficient.

Content and compliance

* [ ]	Usage rights are confirmed.
* [ ]	No unsupported service outcomes are implied.
* [ ]	Unauthorized branding is absent.
* [ ]	All referenced assets and fallbacks exist.

13. Adding More Service Images in the Future

This directory is designed to accommodate additional service images as MedOrbits expands its education, admissions, student support, and career-related offerings.

13.1 Addition workflow

1. Save the new image in assets/images/services/.
2. Choose a descriptive lowercase filename using hyphens.
3. Prefer JPG for optimized raster imagery.
4. Optimize the image for its intended display dimensions.
5. Add the filename and intended use to the asset catalogue.
6. Update the relevant HTML, CSS, JavaScript, or JSON references.
7. Test responsive rendering, accessibility, and loading performance.
8. Verify licensing and content accuracy.
9. Update this README when the approved inventory changes.

13.2 Future asset inventory

Use this table to record additional service images.

Filename	Intended use	Format	Status
example-service.jpg	Describe the service	JPG	Proposed

Replace the example row with actual filenames when assets are created. Proposed entries do not confirm that files exist.

13.3 Suggested future images

Potential additions include:

* admission-assistance.jpg — Admissions and application support
* course-selection.jpg — Course discovery and academic planning
* scholarship-guidance.jpg — Scholarship information and guidance
* study-abroad-support.jpg — International education assistance
* document-assistance.jpg — Document preparation guidance
* career-counselling.jpg — Career counselling services
* application-support.jpg — Application assistance

These are suggestions only. Add assets when supported by actual page content or service requirements, and check for duplicates before creating files.

13.4 Final verification checklist

* [ ]	The new image exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The image matches the intended service.
* [ ]	The file is appropriately optimized.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	Application references are correct.
* [ ]	Existing website design and animations remain unchanged.

14. Maintenance and Version Control

When adding, replacing, or removing service images:

1. Inspect the existing directory and application references.
2. Check whether an equivalent asset already exists.
3. Preserve established filenames unless a migration is required.
4. Optimize replacement images before publishing.
5. Update the asset catalogue and documentation.
6. Test responsive rendering and accessibility.
7. Verify production paths.
8. Remove obsolete assets only after confirming they are no longer referenced.

Routine image maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

15. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/career/ — Career guidance imagery.
* assets/images/admissions/ — Admissions imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/placeholders/ — General fallback imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

16. Final Standard

The assets/images/services/ directory should contain optimized, accessible, appropriately licensed, and visually consistent imagery supporting MedOrbits services.

Future additions must be documented, linked to verified files, and tested for responsive rendering, accessibility, and content accuracy.

All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.