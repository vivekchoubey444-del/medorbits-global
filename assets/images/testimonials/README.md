MedOrbits — Testimonial Images

Directory: assets/images/testimonials/
Documentation Version: 1.1.0
Status: Asset directory documentation
Brand: MedOrbits
Design System: Royal Burgundy and Champagne Gold

⸻

1. Purpose

The assets/images/testimonials/ directory stores approved image assets used to support testimonials, student feedback, client experiences, and service reviews across the MedOrbits website.

These images may appear in:

* Student testimonial sections.
* Education consultancy service pages.
* Career counselling and guidance pages.
* Admissions and application support pages.
* Study-abroad service pages.
* Homepage success stories.
* Approved promotional campaigns.
* Testimonials displayed in cards, sliders, or responsive grids.

The directory should contain only assets that have been reviewed and approved for their intended use.

Important: Images must not be presented as evidence of a genuine client experience unless the associated testimonial and the use of the image have been verified.

2. Brand and visual direction

Testimonial imagery must complement the existing MedOrbits design system without changing the website’s established layout, navigation, typography, header, footer, animations, or responsive behaviour.

Brand colour palette

Colour	Hexadecimal	Recommended use
Royal Burgundy	#6B1838	Brand accents and testimonial overlays
Champagne Gold	#C9A66B	Decorative details and subtle highlights
Warm Cream	#F6EDDD	Supporting backgrounds and visual balance

Visual guidelines

* Use authentic, appropriately licensed photographs whenever real people are depicted.
* Prefer professional, approachable, natural-looking portraits.
* Maintain consistent image quality and visual treatment across testimonial cards.
* Use restrained colour grading that complements the brand palette.
* Avoid excessive filters, distracting backgrounds, and artificial-looking effects.
* Preserve natural skin tones and important image details.
* Ensure sufficient contrast between text, overlays, and surrounding backgrounds.
* Do not use decorative imagery that could misrepresent a person’s identity, experience, qualification, or relationship with MedOrbits.

The colour palette is a design reference. Do not recolour every photograph to match the brand.

3. Directory structure

Recommended structure:

assets/
└── images/
    └── testimonials/
        ├── README.md
        ├── student-testimonial.jpg
        ├── graduate-testimonial.jpg
        ├── parent-testimonial.jpg
        ├── career-testimonial.jpg
        ├── study-abroad-testimonial.jpg
        └── placeholder-testimonial.jpg

The filenames above are examples of possible assets, not confirmation that these files already exist.

Add only assets that have an identified use case. Avoid creating duplicate images or maintaining unused files without a clear reason.

If the testimonial collection grows substantially, use descriptive subdirectories where they improve organisation, such as:

assets/images/testimonials/
├── README.md
├── students/
├── graduates/
├── parents/
├── career-services/
├── study-abroad/
└── placeholders/

Use either a flat or nested structure according to the existing project conventions. Do not introduce additional directories unless the project needs them.

4. Asset naming conventions

Use lowercase, descriptive, hyphen-separated filenames.

Recommended pattern:

audience-or-service-testimonial.jpg

Examples:

* student-testimonial.jpg
* graduate-testimonial.jpg
* parent-testimonial.jpg
* career-testimonial.jpg
* study-abroad-testimonial.jpg
* admissions-testimonial.jpg
* placeholder-testimonial.jpg

Naming rules

1. Use lowercase letters and hyphens.
2. Prefer meaningful names over generic names such as image1.jpg.
3. Use the appropriate file extension.
4. Avoid spaces, special characters, and unnecessary version suffixes.
5. Do not include personal information in filenames.
6. Avoid names that imply a verified outcome when the image’s intended use has not been verified.
7. Update any corresponding references when an asset is renamed or removed.

5. Supported image formats

Format	Recommended use
JPG	Preferred format for optimised photographic assets
AVIF	Optional modern format when supported by the existing image pipeline
JPEG/JPG	Compatible photographic fallback where needed
PNG	Images requiring transparency or lossless raster detail
SVG	Simple vector illustrations or placeholder graphics, not photographs

Prefer JPG for ordinary photographic testimonials when browser support and the project’s image pipeline permit it.

Use responsive image variants where needed instead of serving unnecessarily large files to small screens.

6. Image dimensions and quality

Choose dimensions according to the component that displays the image.

Use case	Suggested aspect ratio	Guidance
Testimonial card portrait	1:1	Suitable for compact portrait cards
Profile portrait	4:5	Suitable for vertically oriented portraits
Wide testimonial panel	16:9	Suitable for landscape compositions
Slider or carousel image	Component-dependent	Maintain consistent dimensions between slides
Placeholder image	Match its intended component	Avoid layout shifts when the image is unavailable

These are recommended design targets rather than mandatory dimensions. Existing component requirements take precedence.

Image quality requirements

* Keep faces and important subjects clearly visible.
* Avoid excessive compression and visible artefacts.
* Maintain consistent cropping within comparable components.
* Use object-fit: cover only when cropping is appropriate.
* Use object-position when necessary to preserve the subject’s face.
* Prevent images from stretching or distorting.
* Reserve adequate space for images to minimise cumulative layout shift.
* Provide a suitable fallback for missing or failed image requests.

7. Privacy, consent, and authenticity

Testimonial photographs may contain personal information. Handle them responsibly.

Before publishing an identifiable person’s photograph:

* Obtain appropriate permission for the intended publication and promotional use.
* Confirm that the testimonial is authentic and approved for publication.
* Verify that the image corresponds to the person identified in the testimonial, where applicable.
* Follow applicable privacy, data protection, and advertising requirements.
* Avoid publishing private documents, contact details, identification numbers, or other sensitive information.
* Remove unnecessary metadata, including GPS location data, before publication.
* Use fictional or neutral placeholders when a genuine testimonial image is unavailable.

Do not imply that a person is a MedOrbits client, student, graduate, or beneficiary solely because their photograph appears on the website.

Do not invent names, reviews, academic results, admission outcomes, employment outcomes, or university placements.

8. Accessibility requirements

Every meaningful testimonial image must have appropriate alternative text when used in HTML.

Meaningful image

Use concise, context-appropriate alternative text when the photograph communicates information not already provided by adjacent content.

Example:

<img
  src=“/assets/images/testimonials/student-testimonial.jpg”
  alt=“Student sharing their experience of admissions guidance”
  loading=“lazy”
  decoding=“async”
>

Only use this description if it accurately represents the image and its context.

Decorative image

If an image is purely decorative and adds no information beyond the surrounding content, use an empty alternative text value:

<img
  src=“/assets/images/testimonials/decorative-detail.jpg”
  alt=“”
  loading=“lazy”
  decoding=“async”
>

Accessibility checklist

* Do not use filenames as a substitute for meaningful alternative text.
* Avoid repeating an adjacent testimonial verbatim in the image’s alt attribute.
* Do not infer a person’s identity, occupation, qualification, or achievements from appearance.
* Ensure text overlaid on images remains readable.
* Do not communicate a rating or testimonial outcome using colour alone.
* Ensure carousel controls and any image-linked actions are keyboard accessible.
* Respect reduced-motion preferences for animated testimonial components.

9. Performance and loading

Testimonial images should load efficiently without compromising the user experience.

Recommended practices

* Compress photographic assets before deployment.
* Prefer appropriately sized responsive images.
* Use lazy loading for images outside the initial viewport.
* Use decoding=“async” when appropriate.
* Specify image width and height, or reserve space using CSS aspect-ratio.
* Avoid lazy-loading a prominent above-the-fold image when it is needed for the initial render.
* Prevent duplicate downloads caused by inconsistent asset references.
* Avoid large animated image files unless animation serves a defined purpose.
* Test image loading on mobile networks and smaller devices.

Example responsive image:

<img
  src=“/assets/images/testimonials/student-testimonial.jpg”
  alt=“Approved student testimonial portrait”
  width=“600”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

The example dimensions are illustrative. Use the actual intrinsic dimensions or the dimensions appropriate to the asset and component.

10. Front-end integration

Reference images using the project’s established asset URL conventions.

For a root-relative public asset path:

<img
  src=“/assets/images/testimonials/student-testimonial.jpg”
  alt=“Appropriate alternative text”
  width=“600”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

If the website uses a base URL, a build tool, a content management system, or another asset resolver, follow that system instead.

Integration requirements

* Use the existing testimonial component and design tokens.
* Preserve established card spacing, border radius, typography, and responsive breakpoints.
* Keep testimonial content separate from image metadata wherever possible.
* Use the existing placeholder asset or a suitable fallback when a photograph cannot be loaded.
* Ensure image paths work in local development, preview deployments, and production.
* Avoid hard-coding absolute development-machine paths.
* Do not introduce a new JavaScript dependency solely to display static testimonial images.

The presence of an image in this directory does not automatically authorise its display. The corresponding testimonial content and publication status must also be approved.

11. Placeholder and fallback handling

Use a neutral placeholder when a testimonial has no approved image or when an image cannot be loaded.

Recommended example filename:

placeholder-testimonial.jpg

A placeholder should:

* Match the intended component’s aspect ratio.
* Complement the MedOrbits brand palette.
* Avoid suggesting a real person’s identity.
* Avoid implying a verified testimonial or successful outcome.
* Remain visually unobtrusive.
* Include suitable alternative text depending on whether it conveys information or is decorative.

Where available, reuse the project’s established placeholder assets rather than creating redundant alternatives.

12. Licensing and asset ownership

Every image must have a clear usage basis.

Acceptable sources may include:

* Photographs supplied with documented permission.
* Images commissioned for MedOrbits.
* Properly licensed stock photography.
* Approved partner-provided assets.
* Original illustrations created for the website.

For each externally sourced or identifiable image, maintain relevant attribution, licence, consent, and expiry information in the project’s approved records.

Do not assume that an image is free to use because it appears in a search result, on social media, or on another website.

Do not commit confidential client photographs or unpublished personal information to a public repository.

13. Recommended asset inventory

Maintain an internal inventory for the images used by testimonial components.

Field	Purpose
Filename	Exact asset filename
Intended use	Component or page using the image
Asset format	JPG, AVIF, JPEG, PNG, or SVG
Dimensions	Actual pixel dimensions
Source	Original, commissioned, stock, or client-supplied
Permission status	Approved, pending, or not permitted
Publication status	Draft, approved, or retired
Alt-text guidance	Appropriate accessibility description
Review date	Date of the latest review

Do not place sensitive consent forms or personal records in a public asset directory. Store those records in an appropriately restricted location.

14. Quality assurance checklist

Before deploying a testimonial image, verify the following:

* [ ]	The asset has an identified use case.
* [ ]	The image is authentic or clearly treated as illustrative.
* [ ]	Required permissions and usage rights have been confirmed.
* [ ]	The associated testimonial is genuine and approved.
* [ ]	The filename follows the project’s naming convention.
* [ ]	The file format and compression are appropriate.
* [ ]	The image has been checked for visual defects.
* [ ]	The intended crop preserves important content.
* [ ]	Alternative text is appropriate for the image’s context.
* [ ]	The image has no unnecessary sensitive metadata.
* [ ]	The asset path works in the deployed environment.
* [ ]	Missing-image handling has been tested.
* [ ]	The image does not introduce layout shifts.
* [ ]	Mobile and desktop layouts have been checked.
* [ ]	The image complements the existing MedOrbits design system.
* [ ]	No unverified claims or implied endorsements are introduced.

15. Adding more testimonial images in the future

When adding a new image:

1. Identify the testimonial, page, or component that requires it.
2. Confirm that the image is appropriate for that use.
3. Verify authenticity, consent, and licensing requirements.
4. Optimise the image and select an appropriate format.
5. Name the file using lowercase, hyphen-separated words.
6. Place it in this directory or a relevant existing subdirectory.
7. Add responsive variants if the component requires them.
8. Update the asset inventory and any associated data references.
9. Supply suitable alternative text in the component or content data.
10. Test the image on mobile and desktop layouts.
11. Confirm that no existing asset or component is unintentionally replaced.
12. Update this README if the directory structure, conventions, or supported use cases change.

Do not add assets solely to increase the number of images. Every file should have a clear purpose and an approved usage basis.

16. Maintenance

Review this directory periodically to:

* Remove genuinely unused assets after verifying all references.
* Replace outdated or low-quality images where appropriate.
* Review permissions and usage restrictions.
* Identify duplicate or unnecessarily large files.
* Check references after file renames.
* Verify that placeholder images remain available.
* Keep documentation aligned with the actual directory structure.
* Ensure that approved images are not accidentally replaced by unverified alternatives.

Before deleting any asset, search the codebase, templates, JSON files, CSS, JavaScript, and page content for references to it.

17. Related directories

Depending on the actual project structure, related resources may include:

* assets/images/ — Shared image asset documentation and conventions.
* assets/images/placeholders/ — Generic fallback images.
* assets/images/team/ — Approved team and staff imagery.
* assets/images/services/ — Service-related photographs and illustrations.
* assets/images/campaigns/ — Promotional campaign imagery.
* assets/data/ — Structured content and metadata, where applicable.
* assets/css/ — Styling and responsive image presentation.
* assets/js/ — Testimonial sliders and related interactive behaviour.

These paths describe potential relationships within the project. Verify that each directory exists before relying on it.

18. Final implementation principle

The assets/images/testimonials/ directory should remain organised, lightweight, accessible, privacy-conscious, and consistent with the MedOrbits visual identity.

Priority order: authenticity and permission → privacy → accessibility → image quality → performance → visual consistency.

Testimonial imagery should support trustworthy user experiences without making unverified claims or compromising the privacy of students, clients, or other individuals.