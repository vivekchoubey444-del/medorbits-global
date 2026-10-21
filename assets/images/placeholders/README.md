MedOrbits Image Placeholders

Directory: assets/images/placeholders/
Project: MedOrbits
Category: Image Fallbacks and Missing-Content Illustrations
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/placeholders/ directory contains reusable visual fallbacks for missing, unavailable, or not-yet-assigned images across the MedOrbits website.

These assets help maintain consistent layouts when actual content images are unavailable.

Placeholder images may be used for:

* Course cards and course listings
* User profiles and account interfaces
* Institution and education listings
* General content images
* Missing or unavailable image states
* Loading or empty-content interfaces, where appropriate
* Future application components requiring generic visual fallbacks

Placeholders should communicate that an image is unavailable or generic without misleading users about the underlying content.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/placeholders/
├── README.md
├── course-placeholder.svg
├── image-placeholder.svg
├── profile-placeholder.svg
└── unavailable-image.svg

Current asset catalogue

Filename	Observed size	Intended use
course-placeholder.svg	557 bytes	Fallback for course imagery
image-placeholder.svg	673 bytes	General-purpose image fallback
profile-placeholder.svg	526 bytes	Fallback for missing profile imagery
unavailable-image.svg	730 bytes	Indicates an unavailable or failed image

File sizes are approximate and may change after modification or optimization.

The screenshot confirms the filenames and approximate sizes. It does not independently verify the SVG appearance, accessibility, or application references.

3. Brand and Visual Direction

Placeholder assets should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing brand colours, design tokens, and component styles wherever appropriate.

Placeholders should be:

* Simple and recognizable
* Visually neutral
* Lightweight and scalable
* Consistent with the premium MedOrbits presentation
* Suitable for mobile and desktop layouts
* Clearly distinguishable from actual content imagery

Do not introduce an unrelated colour system or change the existing website design to accommodate a placeholder.

4. Existing Placeholder Guidelines

course-placeholder.svg

Use when a course card or course detail component has no available course image.

The course name, qualification, and other relevant information must remain available as text.

image-placeholder.svg

Use as a general fallback when no more specific placeholder is appropriate.

Avoid using this asset when a dedicated course, profile, or institution placeholder would communicate the situation more clearly.

profile-placeholder.svg

Use when a user profile image is missing or unavailable.

Do not use it to imply a person’s identity, appearance, or verified profile information.

unavailable-image.svg

Use when an expected image cannot be displayed or is unavailable.

Where appropriate, distinguish an unavailable image from a normal empty state. Avoid displaying an error illustration when no image was expected in the first place.

5. Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer SVG for lightweight, scalable placeholder illustrations.
* Use descriptive names that identify the intended purpose.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing a placeholder, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended HTML Integration

The following example illustrates how to use a course placeholder.

<img
  src=“/assets/images/placeholders/course-placeholder.svg”
  alt=“”
  width=“800”
  height=“450”
  loading=“lazy”
  decoding=“async”
>

The dimensions are illustrative. Verify the actual SVG and the intended component dimensions before using them.

Use an empty alt attribute when the placeholder is decorative and the surrounding text already communicates the relevant information.

If an image conveys information that is not otherwise available, provide appropriate alternative text. Do not describe a generic placeholder as an actual course photograph or institutional image.

Adapt the asset path if the website is deployed under a subdirectory rather than the domain root.

7. Responsive Behaviour

Placeholders should work across mobile phones, tablets, laptops, and desktop displays.

Recommended practices:

* Preserve the image aspect ratio.
* Use object-fit: contain for artwork that should remain fully visible.
* Use object-fit: cover only when cropping is appropriate.
* Prevent image distortion.
* Avoid horizontal overflow.
* Reserve suitable space to prevent layout shifts.
* Preserve existing component dimensions and responsive breakpoints.

Example CSS:

.image-placeholder {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

This is an illustrative rule. Adapt it to the existing component instead of overriding established site styles.

8. Fallback Behaviour

When an image fails to load:

1. Identify whether a fallback is appropriate.
2. Select the most relevant existing placeholder.
3. Preserve the original image container dimensions.
4. Keep associated headings, descriptions, and controls visible.
5. Avoid repeated fallback attempts.
6. Verify that the placeholder path resolves correctly.
7. Avoid replacing the entire component when only the image is unavailable.

A missing image should not prevent users from accessing course information, profile controls, or other associated content.

If the application already implements centralized image-error handling, reuse that mechanism instead of introducing a competing system.

9. Accessibility

* Use meaningful alternative text for informative images.
* Use empty alternative text for decorative placeholders.
* Maintain sufficient text contrast.
* Do not rely on colour alone to communicate an error.
* Keep essential information in accessible HTML text.
* Preserve keyboard navigation and visible focus indicators.
* Ensure profile placeholders do not misrepresent an actual person.
* Avoid unnecessarily repetitive announcements by assistive technologies.

If an unavailable image needs to be announced to users, communicate the status through the appropriate accessible interface rather than relying solely on the SVG.

10. Optimization and Performance

SVG placeholders are generally lightweight and scale without rasterization artifacts.

Recommended practices:

* Keep SVG files concise.
* Remove unnecessary metadata when safe.
* Avoid unnecessary external dependencies.
* Avoid embedding large raster images inside SVG files.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold imagery where appropriate.
* Avoid unnecessary JavaScript-based image loading.
* Reuse existing placeholders instead of creating near-identical duplicates.

Do not lazy-load an above-the-fold image by default when it is the likely Largest Contentful Paint element.

11. Security and Content Integrity

When adding or modifying SVG assets:

* Use trusted, reviewed SVG markup.
* Avoid scripts and unnecessary event attributes.
* Avoid unexpected external references.
* Validate modified SVG files before publishing.
* Do not include private user information.
* Do not embed untrusted user-provided markup directly into an SVG.
* Keep placeholder assets separate from uploaded user images.

If users can upload profile or course images, validate and process those uploads through the application’s existing secure upload workflow. A placeholder is not a substitute for upload validation or authorization.

12. Quality Assurance Checklist

File integrity

* [ ]	The placeholder exists at the documented path.
* [ ]	The SVG opens and renders correctly.
* [ ]	The extension matches the actual file format.
* [ ]	The file is appropriately lightweight.
* [ ]	Application references point to the correct asset.

Visual quality

* [ ]	The placeholder matches its intended use.
* [ ]	The brand palette remains consistent.
* [ ]	The artwork is not stretched or clipped.
* [ ]	Mobile and desktop layouts have been tested.
* [ ]	Existing page layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Essential information remains available as text.
* [ ]	Image dimensions or layout space are reserved.
* [ ]	Fallback behaviour avoids repeated failures.
* [ ]	SVG assets have been reviewed for unnecessary dependencies.

Content integrity

* [ ]	Placeholders are not presented as actual photographs.
* [ ]	Profile placeholders do not imply a real person’s identity.
* [ ]	Missing-image states are communicated appropriately.
* [ ]	All referenced assets exist.

13. Adding More Placeholder Images in the Future

This directory is designed to accommodate additional placeholder assets as MedOrbits expands its course catalogue, user interfaces, institution listings, and other website features.

13.1 Addition workflow

1. Save the new placeholder in assets/images/placeholders/.
2. Choose a descriptive lowercase filename using hyphens.
3. Prefer SVG for simple scalable illustrations.
4. Use the established MedOrbits visual direction.
5. Verify the artwork and file integrity.
6. Add the filename and intended use to the asset catalogue.
7. Update the relevant application references.
8. Test responsive rendering, accessibility, and fallback behaviour.
9. Update this README when the approved inventory changes.

13.2 Future asset inventory

Use this table to record additional placeholders.

Filename	Intended use	Format	Status
example-placeholder.svg	Describe the fallback purpose	SVG	Proposed

Replace the example row with actual filenames when the files are created. Proposed entries do not confirm that files exist.

13.3 Suggested future placeholders

Possible additions include:

* institution-placeholder.svg — General institution fallback
* document-placeholder.svg — Document preview fallback
* video-placeholder.svg — Unavailable video thumbnail
* article-placeholder.svg — Article thumbnail fallback
* application-placeholder.svg — Application-related content
* certificate-placeholder.svg — Certificate preview fallback
* scholarship-placeholder.svg — Scholarship listing fallback
* notification-placeholder.svg — Empty notification state, if appropriate

These are suggestions only. Check existing directories before adding files, because dedicated placeholders may already exist elsewhere in the project.

13.4 Final verification checklist

* [ ]	The new file exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The illustration matches the intended fallback purpose.
* [ ]	The SVG renders and scales correctly.
* [ ]	Accessibility has been reviewed.
* [ ]	Application references are correct.
* [ ]	Missing-image behaviour has been tested.
* [ ]	Existing website styling remains unchanged.

14. Maintenance and Version Control

When adding, replacing, or removing placeholder assets:

1. Inspect the current directory and application references.
2. Check for equivalent placeholders elsewhere in the project.
3. Preserve established filenames unless a migration is required.
4. Review SVG changes before publishing.
5. Update the asset catalogue and documentation.
6. Test fallback behaviour across supported screen sizes.
7. Verify production paths.
8. Remove obsolete files only after confirming they are no longer referenced.

Routine placeholder maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

15. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/institutions/ — Institution-specific placeholders.
* assets/images/blog/ — Blog imagery and article placeholders.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/education/ — Educational imagery.
* assets/images/career/ — Career-related imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

16. Final Standard

The assets/images/placeholders/ directory should contain lightweight, accessible, reusable, and visually consistent fallback assets for MedOrbits.

The four existing SVG placeholders should remain available until their application references and replacement requirements have been verified. Future additions must be documented, tested, and integrated without disrupting the existing website architecture, opening animation, header, footer, responsive behaviour, or Royal Burgundy and Champagne Gold design system.

End of document.