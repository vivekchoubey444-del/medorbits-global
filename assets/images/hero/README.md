MedOrbits Hero Images

Directory: assets/images/hero/
Project: MedOrbits
Category: Website Hero and Banner Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.2.0

⸻

1. Purpose

The assets/images/hero/ directory contains the primary hero images used across the MedOrbits website.

These assets establish visual context for education, admissions, study abroad, career guidance, and contact services while supporting the website’s premium brand identity.

Hero images may appear on:

* Homepage and primary landing pages
* Education and course discovery pages
* Admissions and counselling pages
* Study abroad pages
* Career guidance pages
* Contact and enquiry pages
* Other approved landing pages

Hero imagery must support the page’s message without overwhelming content, reducing text readability, or unnecessarily increasing loading time.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/hero/
├── README.md
├── admissions-hero.jpg
├── career-hero.jpg
├── contact-hero.jpg
├── education-hero.jpg
├── hero-home.png
├── home-hero.jpg
└── study-abroad-hero.jpg

Current asset catalogue

Filename	Observed size	Intended use
admissions-hero.jpg	18.3 KB	Admissions and counselling
career-hero.jpg	20.7 KB	Career guidance and professional development
contact-hero.jpg	18.5 KB	Contact and enquiry pages
education-hero.jpg	18.4 KB	Education and course discovery
hero-home.png	2.0 MB	Existing homepage image; verify current references
home-hero.jpg	18.3 KB	Homepage hero image
study-abroad-hero.jpg	18.3 KB	International education

File sizes are approximate and may change after optimization or replacement.

The screenshot confirms the filenames and approximate sizes, but does not establish the images’ dimensions, visual content, licensing, or production usage.

Important: Both hero-home.png and home-hero.jpg are present. Compare their content and check application references before replacing, renaming, or deleting either file.

3. Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized photographic or raster hero imagery.
* Use SVG only for suitable scalable vector artwork.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check for existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing files, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

4. Hero Asset Catalogue

Filename	Intended page	Visual direction
home-hero.jpg	Homepage	Welcoming education and career guidance
hero-home.png	Existing homepage asset	Preserve until its current role is verified
education-hero.jpg	Education	Academic learning and course discovery
admissions-hero.jpg	Admissions	Application guidance and counselling
study-abroad-hero.jpg	Study abroad	International education and global learning
career-hero.jpg	Career	Professional development and career planning
contact-hero.jpg	Contact	Consultation and student support

Choose imagery that matches the actual content of each page. Do not imply institutional partnerships, campus facilities, admission guarantees, or employment outcomes through the images.

5. Brand and Visual Direction

All hero images must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing colour tokens, gradients, overlays, and typography.

Hero imagery should be:

* Professional and visually refined
* Relevant to education, admissions, or career development
* Suitable for mobile and desktop layouts
* Composed with sufficient negative space for text and controls
* Consistent with the existing premium presentation
* Cropped without hiding important visual details

Where images are abstract branded illustrations, do not describe them as documentary photographs of real students, institutions, or facilities.

6. Preserve the Existing Website Design

Hero images are content assets, not a reason to rebuild pages.

Preserve:

* Existing page layouts and content hierarchy
* Opening animation and its timing
* Header, navigation, and sticky-header behaviour
* Footer layout and content
* Royal Burgundy and Champagne Gold styling
* Existing typography, spacing, and components
* Established responsive breakpoints
* Existing animation and reduced-motion behaviour

Update only the image source or minimum necessary image-specific styling unless a broader change is explicitly requested.

7. Dimensions and Responsive Behaviour

Use the existing hero container dimensions as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Desktop hero	16:9	1920 × 1080 px
Landing-page hero	16:9	1600 × 900 px
Wide banner	2:1	1600 × 800 px
Optional mobile hero	4:5	800 × 1000 px

These dimensions are recommendations, not verified specifications for the current assets.

Composition requirements

* Keep important subjects away from headings and buttons.
* Ensure important details remain visible after cropping.
* Avoid placing faces behind text.
* Test existing desktop and mobile layouts.
* Use a dedicated mobile image only when responsive cropping cannot preserve the composition.
* Prevent horizontal overflow and unnecessary layout shifts.

8. Image Optimization

Hero images can significantly affect initial loading and Largest Contentful Paint (LCP).

Recommended practices:

* Compress images before publishing.
* Resize images to appropriate source dimensions.
* Prefer JPG for supported raster imagery.
* Remove unnecessary metadata.
* Use responsive image sources where beneficial.
* Avoid serving oversized originals when smaller files provide sufficient quality.
* Use CSS for simple gradients and overlays.
* Keep essential headings and calls to action as HTML.

Suggested starting targets:

Asset type	Optimization target
Standard hero	Approximately 200–400 KB
Large photographic hero	Approximately 300–500 KB where practical

These are guidelines rather than strict limits.

The observed JPG files are approximately 18–21 KB, while hero-home.png is approximately 2 MB. These sizes alone do not prove that the files are visually equivalent or that either is suitable for every use. Compare their quality, dimensions, composition, and production references before deciding whether to replace the PNG.

9. Recommended HTML Integration

The following example illustrates how a hero image can be referenced. Adapt it to the existing page structure.

<img
  class=“hero__image”
  src=“/assets/images/hero/home-hero.jpg”
  alt=“”
  width=“1920”
  height=“1080”
  fetchpriority=“high”
  decoding=“async”
>

Verify the actual image dimensions before using the example values.

Use alt=“” only when the image is decorative and nearby text communicates the relevant information. Provide meaningful alternative text when an image conveys information not available elsewhere.

The example assumes the site is deployed at the domain root. Adapt the path if the application uses a subdirectory or different routing configuration.

10. Loading Strategy

Above-the-fold images

* Consider eager loading for the primary hero image.
* Use fetchpriority=“high” selectively when the image is the likely LCP element.
* Specify accurate dimensions or reserve the required layout space.
* Avoid unnecessary JavaScript-based image loading.
* Do not delay the primary image behind unrelated animations.

Below-the-fold images

* Use loading=“lazy” where appropriate.
* Avoid unnecessary high fetch priority.
* Keep image dimensions stable.
* Prevent avoidable layout shifts.

Do not lazy-load the primary visible hero image by default if doing so delays the page’s main content.

11. Accessibility and Text Contrast

* Use meaningful alt text for informative images.
* Use empty alt text for decorative images.
* Maintain sufficient contrast between text and backgrounds.
* Use suitable overlays where necessary.
* Keep headings and calls to action as HTML.
* Preserve keyboard focus indicators.
* Respect reduced-motion preferences.
* Avoid flashing or distracting effects.
* Preserve the existing opening animation unless explicitly requested otherwise.

Integrate overlays using the existing Burgundy palette and stacking order. Do not introduce competing visual treatments when the current design already provides sufficient contrast.

12. Missing Assets and Fallbacks

When a hero image is unavailable:

* Use a verified existing fallback or approved CSS background.
* Preserve the hero container dimensions.
* Keep headings, navigation, and calls to action visible.
* Avoid broken-image indicators where practical.
* Maintain sufficient contrast.
* Do not introduce a competing visual style.
* Verify every fallback path before using it in production.

Do not reference an uncreated mobile variant or fallback.

13. Copyright, Licensing, and Content Accuracy

Before publishing an image:

* Confirm ownership or permission to use it.
* Verify commercial-use and modification rights.
* Provide attribution when required.
* Obtain appropriate releases for identifiable individuals where necessary.
* Avoid unauthorized third-party logos and institutional branding.
* Do not imply accreditation, partnerships, or guaranteed outcomes.
* Avoid exposing private student or applicant information.

Maintain source and licensing records where appropriate.

14. Quality Assurance Checklist

File integrity

* [ ]	The image exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The extension matches its actual format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	All production references are correct.
* [ ]	Homepage PNG and JPG references have been checked.

Visual quality

* [ ]	The image matches the page’s purpose.
* [ ]	The brand palette is preserved.
* [ ]	Cropping retains important visual elements.
* [ ]	Text and calls to action remain readable.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	The main hero image is not unnecessarily delayed.
* [ ]	High fetch priority is used selectively.
* [ ]	Avoidable layout shifts are prevented.
* [ ]	Reduced-motion preferences are respected.

Content and compliance

* [ ]	Usage rights are confirmed.
* [ ]	Unsupported partnerships or outcomes are not implied.
* [ ]	All referenced image variants exist.
* [ ]	Production paths have been verified.

15. Adding More Hero Images in the Future

This directory is designed to accommodate additional hero images as MedOrbits expands its website and services.

15.1 Addition workflow

1. Save the image in assets/images/hero/.
2. Choose a descriptive lowercase filename using hyphens.
3. Prefer JPG for optimized raster imagery.
4. Optimize the image for its intended dimensions.
5. Add the filename and intended use to the asset catalogue.
6. Update the relevant HTML, CSS, JavaScript, or JSON references.
7. Test desktop and mobile rendering.
8. Check accessibility, licensing, contrast, and loading performance.
9. Update this README when the approved inventory changes.

15.2 Future asset inventory

Use this table to document new assets.

Filename	Intended page	Format	Status
example-hero.jpg	Describe the destination page	JPG	Proposed

Replace the example row with actual files when they are created. Proposed entries do not confirm that files exist.

15.3 Suggested future assets

Possible additions include:

* online-learning-hero.jpg — Online education and learning resources
* student-support-hero.jpg — Student guidance and support
* scholarship-hero.jpg — Scholarship information
* medical-education-hero.jpg — Medical education guidance
* career-planning-hero.jpg — Career planning services
* exam-preparation-hero.jpg — Examination preparation resources

These are suggestions only. Add them when supported by actual page requirements, and check for duplicates before creating files.

15.4 Final verification checklist

* [ ]	The new file exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The image matches the intended page.
* [ ]	The file is appropriately optimized.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	Application references are correct.
* [ ]	Existing website design and animations remain unchanged.

16. Maintenance and Version Control

When adding, replacing, or removing hero images:

1. Inspect the current directory and image references.
2. Check the affected page before modifying an asset.
3. Preserve established filenames unless a migration is required.
4. Compare the homepage PNG and JPG before choosing a canonical asset.
5. Update this README when the approved inventory changes.
6. Test responsive rendering and accessibility.
7. Check loading performance and text contrast.
8. Verify deployed asset paths.
9. Remove obsolete files only after confirming they are no longer referenced.

Do not modify global styles, page structure, opening animation, header, footer, typography, responsive breakpoints, or the overall colour theme as part of routine image maintenance.

17. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/logo/ — Brand logo assets.
* assets/images/backgrounds/ — Backgrounds and textures.
* assets/images/education/ — Educational imagery.
* assets/images/admissions/ — Admissions imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/career/ — Career imagery.
* assets/images/contact/ — Contact-specific imagery, if present.
* assets/images/placeholders/ — Fallback images.
* assets/css/ — Stylesheets, if consistent with the existing project structure.

Verify each path before referencing it. These directory names describe potential relationships and do not confirm that every directory exists.

18. Final Standard

The assets/images/hero/ directory should contain optimized, accessible, responsive, appropriately licensed, and visually consistent hero images for MedOrbits.

The documented inventory includes six JPG assets and one PNG asset. Both homepage filename variants must be checked against the actual code before either is replaced or removed.

All new hero images must support their page’s purpose, preserve content readability, and integrate with the existing website without disrupting its layout, opening animation, header, footer, responsive behaviour, or Royal Burgundy and Champagne Gold design system.

End of document.