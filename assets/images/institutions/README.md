MedOrbits Institution Images

Directory: assets/images/institutions/
Project: MedOrbits
Category: Institution, College, University, and Campus Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/institutions/ directory contains visual assets representing educational institutions and providing fallbacks when verified institution imagery is unavailable.

These assets support:

* College and university listings
* Institution detail pages
* Campus information sections
* Medical college listings
* Institution search results
* Course and admission discovery pages
* Education comparison cards
* Institution-related content previews
* Missing-image and fallback states

The directory currently contains SVG placeholder assets. These provide consistent visual representations when actual, approved campus or institution images are unavailable.

Placeholders must not be presented as real photographs of campuses, colleges, universities, or facilities.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/institutions/
├── README.md
├── campus-placeholder.svg
├── college-campus-placeholder.svg
├── institution-placeholder.svg
└── university-campus-placeholder.svg

Current asset catalogue

Filename	Observed size	Intended use
campus-placeholder.svg	540 bytes	General campus-image fallback
college-campus-placeholder.svg	694 bytes	College campus-image fallback
institution-placeholder.svg	701 bytes	General institution-image fallback
university-campus-placeholder.svg	628 bytes	University campus-image fallback

File sizes are approximate and may change after modification or optimization.

The screenshot confirms the filenames and approximate sizes. It does not independently verify SVG rendering, visual appearance, licensing, or application references.

3. Brand and Visual Direction

All institution-related assets must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing brand colours, visual tokens, and component styles.

Institution placeholders should be:

* Professional and visually neutral
* Simple and recognizable at small sizes
* Scalable across different display dimensions
* Consistent with the premium MedOrbits presentation
* Suitable for desktop and mobile layouts
* Free of unauthorized logos and misleading institutional branding

Actual institution photographs, when added, must accurately represent the named institution and be appropriately licensed.

4. Existing Placeholder Guidelines

campus-placeholder.svg

Use as a general fallback when a campus image is unavailable and a more specific placeholder is unnecessary.

college-campus-placeholder.svg

Use for college listings and college detail cards when an approved campus photograph is unavailable.

institution-placeholder.svg

Use as a generic fallback for educational institutions that do not have a suitable image.

university-campus-placeholder.svg

Use for university listings and university detail pages when an approved campus photograph is unavailable.

Placeholder selection rules

* Prefer the most specific appropriate placeholder.
* Use the generic institution placeholder when the institution type is unknown.
* Do not imply that a placeholder depicts an actual campus.
* Keep image dimensions consistent with the surrounding component.
* Ensure the placeholder does not hide important institution information.
* Avoid duplicating placeholder files without a clear functional reason.

5. Naming Conventions

Use consistent and descriptive filenames.

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer .svg for simple scalable placeholders and vector illustrations.
* Prefer JPG for optimized raster photographs and illustrations.
* Use JPG when appropriate for existing content or compatibility.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing an asset, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended Future Asset Structure

The following structure is proposed for future expansion. It does not indicate that the listed image files already exist.

assets/images/institutions/
├── README.md
├── campus-placeholder.svg
├── college-campus-placeholder.svg
├── institution-placeholder.svg
├── university-campus-placeholder.svg
├── medical-college-placeholder.svg
├── hospital-placeholder.svg
└── institution-default.jpg

Create additional assets only when they support an actual application requirement. Check the existing directory for equivalent files before adding new ones.

7. Image Dimensions and Responsive Behaviour

Use the existing institution card or detail-page layout as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
College listing card	16:9	800 × 450 px
University detail page	16:9	1200 × 675 px
Campus gallery	4:3	1200 × 900 px
Square institution thumbnail	1:1	600 × 600 px
Campus hero image	16:9	1600 × 900 px

These are recommendations, not verified specifications for the current website.

Images should preserve their intended proportions, avoid distortion, and keep important details visible after cropping.

SVG placeholders should use a suitable viewBox and scale correctly without unnecessary whitespace or clipping.

8. Recommended HTML Integration

The following example illustrates how to use a college placeholder.

<img
  src=“/assets/images/institutions/college-campus-placeholder.svg”
  alt=“”
  width=“800”
  height=“450”
  loading=“lazy”
  decoding=“async”
>

This example assumes that the asset exists and that the dimensions suit the component. Verify the file and intended display dimensions before integration.

Use an empty alt attribute when the placeholder is decorative and the surrounding content already identifies the institution.

If the image communicates meaningful information, provide appropriate alternative text. Do not describe a placeholder as an actual photograph of the institution.

Adapt the asset path if the website is deployed under a subdirectory rather than the domain root.

9. Handling Actual Institution Images

When verified campus photographs or institution-specific images become available:

* Confirm that the image depicts the correct institution.
* Verify the right to use and publish the image.
* Choose an appropriate image format and resolution.
* Store the image using a descriptive filename.
* Update the institution record or relevant content reference.
* Preserve the existing placeholder as a fallback.
* Avoid using a generic placeholder as evidence of institutional facilities.
* Do not imply accreditation, affiliation, recognition, or partnership based solely on an image.

Where institution data is managed through JSON or an API, ensure that image references remain consistent with the application’s existing data model.

10. Fallback Behaviour

If an institution image fails to load:

1. Use the most appropriate verified placeholder.
2. Preserve the image container dimensions.
3. Keep the institution name and other content visible.
4. Avoid broken-image indicators where practical.
5. Prevent repeated fallback attempts.
6. Verify the fallback path.
7. Avoid replacing the entire institution card when only its image is missing.

If the institution information itself is unavailable, use the application’s appropriate error or empty state rather than relying on an image placeholder alone.

11. Optimization and Performance

Institution imagery should balance visual quality, loading performance, and data accuracy.

Recommended practices:

* Compress raster photographs before publishing.
* Resize images to appropriate display dimensions.
* Prefer JPG for supported raster imagery.
* Keep SVG placeholders lightweight.
* Remove unnecessary SVG metadata.
* Avoid unnecessary external SVG references.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold images where appropriate.
* Avoid unnecessarily high loading priority for off-screen images.

Do not lazy-load the primary above-the-fold image by default if it is the likely Largest Contentful Paint element.

12. Accessibility and Content Accuracy

* Use meaningful alternative text for informative images.
* Use empty alternative text for decorative placeholders.
* Maintain sufficient contrast.
* Keep institution names and details as HTML text.
* Preserve keyboard navigation and visible focus indicators.
* Ensure essential information does not depend on the image alone.
* Do not present placeholder illustrations as documentary photographs.
* Avoid misleading claims about facilities, recognition, or institutional status.

Institution details should be based on verified information rather than inferred from image content.

13. Copyright and Licensing

Before publishing institution imagery:

* Verify ownership or permission to use the asset.
* Confirm commercial-use and modification rights.
* Provide attribution when required.
* Respect institution branding and trademark requirements.
* Avoid unauthorized logos and seals.
* Do not expose private student or staff information.
* Maintain source and licensing records where appropriate.

Do not assume that a publicly accessible campus photograph is automatically available for commercial reuse.

14. Quality Assurance Checklist

File integrity

* [ ]	The asset exists at the documented path.
* [ ]	The SVG or raster image opens and renders correctly.
* [ ]	The extension matches the actual file format.
* [ ]	Image dimensions and scaling are appropriate.
* [ ]	Production references point to the correct files.

Visual quality

* [ ]	The placeholder suits the institution type.
* [ ]	Royal Burgundy and Champagne Gold styling is preserved.
* [ ]	The image is not stretched or distorted.
* [ ]	Desktop and mobile rendering have been tested.
* [ ]	Existing page layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour suits the image’s position.
* [ ]	SVG files are lightweight and self-contained where practical.
* [ ]	Text contrast remains sufficient.

Content and compliance

* [ ]	Actual institution images are correctly identified.
* [ ]	Usage rights are confirmed.
* [ ]	No unsupported affiliations or recognition claims are implied.
* [ ]	All fallback references resolve correctly.

15. Adding More Institution Images in the Future

This directory is designed to support additional institution placeholders and verified campus imagery as MedOrbits expands its educational listings.

15.1 Addition workflow

1. Save the new image in assets/images/institutions/.
2. Choose a descriptive lowercase filename using hyphens.
3. Use SVG for simple scalable placeholders or JPG for optimized raster imagery.
4. Verify the image’s content, dimensions, and licensing.
5. Add the filename and intended use to the asset catalogue.
6. Update the relevant HTML, CSS, JavaScript, JSON, or API references.
7. Preserve existing fallback behaviour.
8. Test responsive rendering, accessibility, and loading performance.
9. Update this README when the approved inventory changes.

15.2 Future asset inventory

Use this table to record new assets as they are created.

Filename	Intended use	Format	Status
example-institution-image.jpg	Describe the institution or campus use	JPG	Proposed

Replace the example row with actual filenames when the files are created. Proposed entries are not confirmation that the files exist.

15.3 Suggested future assets

Possible additions include:

* medical-college-placeholder.svg — Medical college listings
* hospital-placeholder.svg — Hospital or clinical institution listings, where appropriate
* engineering-college-placeholder.svg — Engineering college listings
* nursing-college-placeholder.svg — Nursing institution listings
* research-institution-placeholder.svg — Research institution listings
* institution-default.jpg — General raster fallback where required

These are suggestions only. Create them when supported by actual application requirements, and check for duplicates before adding files.

15.4 Final verification checklist

* [ ]	The new asset exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The image accurately represents its intended use.
* [ ]	The file is appropriately optimized.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	Application references and fallbacks are correct.
* [ ]	Existing website design and animations remain unchanged.

16. Maintenance and Version Control

When adding, replacing, or removing institution assets:

1. Inspect the existing directory and application references.
2. Check whether an equivalent asset already exists.
3. Preserve established filenames unless a migration is required.
4. Verify the accuracy and licensing of replacement images.
5. Update the asset catalogue and documentation.
6. Test responsive rendering and accessibility.
7. Verify production paths and fallback behaviour.
8. Remove obsolete assets only after confirming they are no longer referenced.

Routine asset maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

17. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/education/ — Educational imagery.
* assets/images/admissions/ — Admissions guidance imagery.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/placeholders/ — General fallback assets.
* assets/icons/education/ — Education-related icons, if present.
* assets/data/ — Institution data files, if consistent with the current project structure.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

18. Final Standard

The assets/images/institutions/ directory should contain accessible, appropriately licensed, visually consistent placeholders and verified institution imagery for MedOrbits.

The four existing SVG placeholders should remain available as fallback assets. Future additions must be documented, linked to verified files, and tested for rendering, accessibility, and content accuracy.

All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.