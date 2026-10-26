MedOrbits Admissions Images

Directory: assets/images/admissions/
Project: MedOrbits
Category: Admissions, Counselling, and Application Support Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/admissions/ directory contains visual assets supporting MedOrbits admissions guidance, application assistance, counselling, document preparation, and scholarship guidance services.

These assets support admissions landing pages, service cards, course guidance pages, informational content, and approved promotional materials.

All images should reinforce the MedOrbits brand identity and help users understand the purpose of each service without implying guaranteed admission, scholarship approval, or other outcomes.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/admissions/
├── README.md
├── admission-guidance.jpg
├── application-support.jpg
├── counselling.jpg
├── document-assistance.jpg
└── scholarship-guidance.jpg

Asset catalogue

Filename	Observed size	Intended use
admission-guidance.jpg	14.5 KB	General admission guidance and eligibility information
application-support.jpg	14.7 KB	Application preparation and submission assistance
counselling.jpg	14.6 KB	Educational counselling and pathway discussions
document-assistance.jpg	14.5 KB	Document preparation and checklist guidance
scholarship-guidance.jpg	14.6 KB	Scholarship information and application guidance

File sizes are approximate and may change after optimization or replacement.

The screenshot confirms the listed filenames and approximate sizes, but does not independently verify their dimensions, visual content, licensing, or production references.

3. Naming Conventions

Use consistent, descriptive filenames.

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized raster illustrations and content imagery.
* Keep filenames stable after production references are established.
* Avoid duplicate files with unclear suffixes such as final, new, or latest.
* Verify existing assets before creating replacements.
* Update this README whenever the approved inventory changes.

Do not rename or remove existing files without checking their references in HTML, CSS, JavaScript, JSON, and other application configuration.

4. Brand and Visual Direction

All admissions images must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use the existing brand colours, gradients, typography, and design tokens wherever applicable.

Visual standards

Images should be:

* Professional and visually refined
* Relevant to admissions and education guidance
* Consistent with the premium MedOrbits presentation
* Suitable for desktop and mobile layouts
* Composed to support nearby headings and calls to action
* Optimized for fast loading

The JPG assets may be abstract branded illustrations intended for visual presentation and prototyping. Do not describe them as documentary photographs unless their actual content supports that description.

Avoid unauthorized institutional logos, misleading campus imagery, fabricated endorsements, and visuals that suggest guaranteed admissions or scholarships.

5. Asset Usage Guidelines

admission-guidance.jpg

Use for general admissions information, eligibility guidance, application timelines, and educational pathway content.

Do not use the image alone to communicate official admission requirements or deadlines. Present those details as accurate, accessible text.

application-support.jpg

Use for application preparation, form completion guidance, application tracking information, and submission support.

Do not imply that an application has been submitted or accepted merely because the image appears on a page.

counselling.jpg

Use for counselling services, academic planning, course selection, and student guidance.

Ensure the surrounding content accurately describes the actual service offered by MedOrbits.

document-assistance.jpg

Use for document checklists, document preparation guidance, and application-related resources.

Do not imply that displaying this image means a document has been verified, authenticated, or approved.

scholarship-guidance.jpg

Use for scholarship discovery, eligibility information, financial-aid guidance, and scholarship application resources.

Do not imply guaranteed scholarship eligibility, funding, or approval.

6. Dimensions and Responsive Behaviour

Use the existing component dimensions as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Admissions service card	4:3	800 × 600 px
Wide landing-page section	16:9	1600 × 900 px
Compact content thumbnail	1:1	600 × 600 px
Promotional banner	2:1	1600 × 800 px

These dimensions are recommendations rather than verified specifications for the current files.

Images should:

* Preserve their intended aspect ratio.
* Avoid stretching or distortion.
* Maintain important visual details after cropping.
* Fit existing responsive breakpoints.
* Avoid causing horizontal overflow.
* Reserve layout space to minimize cumulative layout shift.

Do not change the existing page layout solely to accommodate an image.

7. Recommended HTML Integration

The following example illustrates how an admissions asset may be referenced:

<img
  src=“/assets/images/admissions/admission-guidance.jpg”
  alt=“”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

The example assumes that the asset exists and its actual dimensions match the specified values. Verify the file before using the markup.

Use alt=“” when the image is purely decorative and the surrounding content already communicates the relevant information. If the image provides meaningful information, supply concise alternative text.

The leading slash assumes deployment at the domain root. Adapt the path if the application uses a subdirectory or a different asset-routing strategy.

8. Image Optimization and Loading

Admissions images should be optimized for both visual quality and website performance.

Recommended practices:

* Compress JPG files before publishing.
* Use appropriate source dimensions.
* Avoid oversized originals.
* Remove unnecessary metadata.
* Avoid encoding essential headings or calls to action into images.
* Use responsive image sources where beneficial.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold images where appropriate.

Do not lazy-load a primary above-the-fold image by default if it is the likely Largest Contentful Paint element.

The observed file sizes are relatively small, but file size alone does not establish visual quality, correct dimensions, or suitability for production.

9. Accessibility and Content Accuracy

* Provide meaningful alt text for informative images.
* Use empty alt text for decorative images.
* Maintain sufficient contrast between surrounding text and image backgrounds.
* Keep headings, descriptions, and links as HTML elements.
* Preserve keyboard navigation and visible focus indicators.
* Avoid using image colour alone to convey meaning.
* Ensure essential admission and scholarship information is available as text.
* Do not present abstract illustrations as real institutions or real people.

Admissions information must be accurate and clearly distinguish general guidance from official requirements determined by institutions or regulatory authorities.

10. Fallbacks and Missing Assets

If an admissions image is unavailable:

* Use a verified existing fallback from the project’s placeholder library, if available.
* Preserve the existing card and container dimensions.
* Keep titles, descriptions, and actions visible.
* Avoid broken-image indicators where practical.
* Do not reference nonexistent fallback files.
* Do not replace the entire service card when only the image is missing.
* Follow the established Royal Burgundy and Champagne Gold design system.

Verify the actual placeholder directory and filename before implementing a fallback.

11. Copyright and Licensing

Before publishing or replacing admissions imagery:

* Confirm ownership or permission to use the asset.
* Verify commercial-use and modification rights.
* Provide attribution where required.
* Avoid unauthorized institutional branding.
* Do not expose personal student or applicant information.
* Do not fabricate testimonials, endorsements, or institutional affiliations.
* Do not imply guaranteed admissions, scholarships, or financial assistance.

Maintain source and licensing records where appropriate.

12. Quality Assurance Checklist

File integrity

* [ ]	Each documented image exists at the correct path.
* [ ]	Files open and render correctly.
* [ ]	File extensions match their actual formats.
* [ ]	Dimensions and compression are appropriate.
* [ ]	Production references point to the correct files.

Visual quality

* [ ]	Images accurately support their associated service.
* [ ]	Royal Burgundy and Champagne Gold styling is preserved.
* [ ]	Cropping does not hide important visual elements.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Existing layout, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text matches each image’s purpose.
* [ ]	Decorative images use appropriate empty alt text.
* [ ]	Dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour matches the image’s position.
* [ ]	Images do not cause avoidable layout shifts.
* [ ]	Text contrast and keyboard accessibility are maintained.

Content and compliance

* [ ]	Image usage rights are confirmed.
* [ ]	No unauthorized institutional branding is present.
* [ ]	No guaranteed outcomes are implied.
* [ ]	All referenced assets and fallbacks exist.

13. Maintenance and Version Control

When adding, replacing, or removing admissions images:

1. Inspect the current directory and image references.
2. Confirm whether an equivalent asset already exists.
3. Preserve established filenames unless a migration is required.
4. Optimize the replacement image.
5. Update this README when the approved inventory changes.
6. Test responsive rendering and accessibility.
7. Check loading performance.
8. Verify asset paths in the deployed website.
9. Remove obsolete assets only after confirming that they are no longer referenced.

Routine image maintenance must not rebuild existing pages or alter the opening animation, header, footer, typography, responsive breakpoints, or global colour theme.

14. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/education/ — Education and course imagery.
* assets/images/institutions/ — Institution-related imagery.
* assets/images/placeholders/ — Fallback images.
* assets/icons/education/ — Education-related icons.
* assets/css/ — Stylesheets, if consistent with the current project structure.

Verify each path before referencing it. These directory names describe potential relationships and do not confirm that every location exists.

15. Adding More Images in the Future

This directory is designed to support additional admissions-related images as MedOrbits expands its services and website content.

15.1 Adding a New Image

When adding a new image:

1. Save the image in assets/images/admissions/.
2. Use a descriptive, lowercase, hyphen-separated filename.
3. Prefer optimized JPG images for raster illustrations and content imagery.
4. Add the new filename, intended use, and approximate file size to the asset catalogue.
5. Update the relevant HTML, CSS, JavaScript, or JSON references if required.
6. Verify that the image exists and renders correctly.
7. Test responsiveness, accessibility, and loading performance.
8. Update this README to document the new asset.

15.2 Future Asset Inventory

Add new images to the following table as they are introduced.

Filename	Intended use	Format	Status
example-image.jpg	Describe the image’s purpose	JPG	Proposed

Replace the example row with actual filenames when new assets are added. Do not treat proposed entries as existing files.

15.3 Suggested Future Image Categories

Depending on future MedOrbits services, additional images may include:

* eligibility-guidance.jpg — Admission eligibility information
* entrance-exam-guidance.jpg — Entrance examination guidance
* college-selection.jpg — College selection and comparison
* admission-process.jpg — Admission process explanations
* fee-guidance.jpg — Tuition and fee information
* education-loan-guidance.jpg — Education financing guidance
* application-tracking.jpg — Application status guidance
* admission-checklist.jpg — Application readiness and document checklists

These are suggestions only. Create files when the corresponding content or page requires them.

15.4 File Naming and Compatibility

* Keep filenames unique and descriptive.
* Avoid overwriting an existing image unless replacement is intentional.
* Check existing references before renaming or deleting files.
* Keep image paths consistent with the current project structure.
* Avoid introducing external image dependencies without approval.
* Update this README whenever the approved asset inventory changes.

15.5 Final Verification

Before considering a new image ready for production, confirm that:

* [ ]	The file exists at the correct path.
* [ ]	Its filename and format are correct.
* [ ]	Its visual content matches the intended purpose.
* [ ]	The image is optimized for its display dimensions.
* [ ]	Alternative text is appropriate.
* [ ]	The image works on mobile and desktop.
* [ ]	Licensing and usage rights are verified.
* [ ]	All application references are correct.
* [ ]	Existing layouts, opening animation, header, footer, and brand styling remain unchanged.

Maintenance rule: New images should extend the existing asset library without disrupting the established MedOrbits website design.

⸻

Documentation maintenance: Increment the README documentation version when substantial changes are made to the asset inventory or usage standards.