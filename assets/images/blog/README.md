MedOrbits Blog Images

Directory: assets/images/blog/
Project: MedOrbits
Category: Blog Thumbnails, Article Illustrations, and Content Placeholders
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/blog/ directory contains visual assets used throughout the MedOrbits blog, articles, educational resources, and informational content.

These assets support:

* Blog listing cards
* Article header images
* Education and career guidance articles
* Admissions and study abroad content
* Featured posts and promotional sections
* Article thumbnails and previews
* Empty states and missing-image fallbacks
* Social sharing previews, where applicable

Blog imagery should reinforce the MedOrbits brand, complement article content, and maintain a consistent visual experience across desktop and mobile devices.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/blog/
├── README.md
└── blog-placeholder.svg

Current asset catalogue

Filename	Observed size	Intended use
blog-placeholder.svg	632 bytes	Scalable fallback for blog thumbnails or unavailable article imagery

The screenshot confirms the filename and approximate file size. It does not independently verify the SVG’s appearance, accessibility, licensing, or production references.

3. Brand and Visual Direction

All blog imagery should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing design tokens, typography, colour treatments, and component styles.

Blog illustrations should be professional, relevant to the article, visually balanced, and consistent with the website’s premium presentation.

Where assets are abstract branded illustrations, do not present them as documentary photographs of real students, institutions, professionals, or facilities.

4. Existing Placeholder

blog-placeholder.svg

Purpose: Provides a reusable visual fallback when an article does not have an approved thumbnail or when an image is unavailable.

Recommended usage:

* Blog listing cards
* Article preview components
* Featured content placeholders
* Empty or incomplete article-image states

The placeholder should not imply that an article contains a photograph or that a particular institution or individual is represented.

Keep the SVG lightweight, scalable, and compatible with the established brand palette.

5. Recommended Future Asset Structure

The following structure is proposed for future expansion. It does not indicate that the listed files already exist.

assets/images/blog/
├── README.md
├── blog-placeholder.svg
├── education-guidance.jpg
├── admissions-guidance.jpg
├── study-abroad-guidance.jpg
├── career-guidance.jpg
├── scholarship-guidance.jpg
├── medical-education.jpg
└── exam-preparation.jpg

Create additional assets only when required by actual article content or website components. Check the directory for existing equivalents before adding files.

6. Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized raster illustrations and thumbnails.
* Use SVG for scalable patterns, icons, and simple vector illustrations.
* Keep filenames descriptive and relevant to article content.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Preserve established filenames referenced by production code.
* Update this README when the approved inventory changes.

Do not rename or remove existing assets without checking references in HTML, CSS, JavaScript, JSON, and other application configuration.

7. Image Dimensions and Aspect Ratios

Use the existing blog components as the primary reference for image dimensions.

Placement	Suggested aspect ratio	Example dimensions
Blog listing thumbnail	16:9	1200 × 675 px
Article header image	16:9	1600 × 900 px
Compact content card	4:3	800 × 600 px
Square promotional graphic	1:1	800 × 800 px
Social sharing preview	1.91:1	1200 × 628 px

These are recommendations, not verified specifications for the current website.

Images should retain their intended proportions, avoid distortion, and keep important subjects visible after cropping.

8. Recommended HTML Integration

Decorative placeholder

<img
  src=“/assets/images/blog/blog-placeholder.svg”
  alt=“”
  width=“1200”
  height=“675”
  loading=“lazy”
  decoding=“async”
>

Use an empty alt attribute when the placeholder is purely decorative and surrounding text communicates the relevant information.

The example dimensions are illustrative. Verify the SVG’s intended display dimensions and the existing component layout before using them.

Informative article image

<img
  src=“/assets/images/blog/education-guidance.jpg”
  alt=“Illustration representing educational guidance”
  width=“1200”
  height=“675”
  loading=“lazy”
  decoding=“async”
>

The second example uses a proposed filename. Create and verify the file before referencing it in production.

Use concise alternative text that accurately describes an informative image. Avoid repeating the article title unnecessarily.

9. Optimization and Loading

Blog images should be optimized to maintain fast page loading.

Recommended practices:

* Compress raster images before publishing.
* Use appropriately sized source images.
* Prefer JPG for supported raster content.
* Use SVG for suitable vector illustrations.
* Remove unnecessary metadata.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold thumbnails where appropriate.
* Avoid lazy-loading a primary above-the-fold image when it is the likely Largest Contentful Paint element.
* Avoid unnecessary external image dependencies.

Use responsive image sources when they provide a meaningful performance benefit.

10. Accessibility and Content Accuracy

* Provide meaningful alt text for informative images.
* Use alt=“” for purely decorative imagery.
* Maintain sufficient contrast between text and image backgrounds.
* Keep article titles and descriptions as HTML.
* Preserve keyboard navigation and visible focus indicators.
* Do not rely on image colour alone to communicate meaning.
* Avoid presenting abstract illustrations as real photographs.
* Do not use imagery to imply unsupported institutional partnerships, qualifications, or outcomes.

Important article information must remain available as accessible text.

11. Missing Images and Fallback Behaviour

When an article image is unavailable:

1. Use the verified blog-placeholder.svg when appropriate.
2. Preserve the thumbnail’s existing dimensions.
3. Keep the article title, summary, and navigation visible.
4. Avoid broken-image indicators where practical.
5. Prevent repeated fallback attempts.
6. Verify that the placeholder path resolves correctly.
7. Avoid replacing an entire article card when only its image is missing.

The placeholder should be used as a visual fallback, not as a substitute for missing article content.

12. Copyright and Licensing

Before publishing or replacing an image:

* Verify ownership or permission to use it.
* Confirm commercial-use and modification rights.
* Provide attribution when required.
* Avoid unauthorized institutional logos and third-party branding.
* Obtain appropriate releases for identifiable individuals where necessary.
* Do not use stock imagery to imply real MedOrbits staff, students, or institutional partners.
* Maintain source and licensing records where appropriate.

13. Adding More Images in the Future

This directory is designed to accommodate new blog imagery as the MedOrbits content library grows.

13.1 Addition workflow

When adding an image:

1. Save the asset in assets/images/blog/.
2. Choose a descriptive lowercase filename using hyphens.
3. Select an appropriate format, preferably JPG for raster imagery or SVG for scalable vector artwork.
4. Optimize the image for its intended dimensions.
5. Add the filename and intended use to the asset catalogue.
6. Update relevant application references.
7. Test rendering, cropping, accessibility, and loading performance.
8. Update this README when the approved inventory changes.

13.2 Future asset inventory

Use this table to record additional assets as they are created.

Filename	Intended use	Format	Status
example-article-image.jpg	Describe the article or content category	JPG	Proposed

Replace the example entry with actual filenames when new assets are added. Proposed entries are not confirmation that the files exist.

13.3 Suggested future assets

Potential additions include:

* education-guidance.jpg — Educational planning articles
* admissions-guidance.jpg — Admissions information
* study-abroad-guidance.jpg — International education articles
* career-guidance.jpg — Career planning and employment content
* scholarship-guidance.jpg — Scholarship information
* medical-education.jpg — Medical education resources
* exam-preparation.jpg — Entrance examination preparation

These are suggestions only. Add them when supported by actual content requirements and after checking for duplicates.

13.4 Final verification checklist

* [ ]	The new asset exists at the documented path.
* [ ]	The filename and file format are correct.
* [ ]	The image matches the article’s subject.
* [ ]	The file is appropriately optimized.
* [ ]	Alternative text is appropriate.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	All application references are correct.
* [ ]	Existing page layouts and animations remain unchanged.

14. Maintenance and Version Control

When adding, replacing, or removing blog assets:

1. Inspect the existing directory and references.
2. Check whether an equivalent asset already exists.
3. Preserve established filenames unless a migration is required.
4. Update the asset catalogue and documentation.
5. Verify responsive rendering and accessibility.
6. Check loading performance.
7. Verify deployed asset paths.
8. Remove obsolete assets only after confirming they are no longer referenced.

Routine image maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

15. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/education/ — Education-related imagery.
* assets/images/admissions/ — Admissions imagery.
* assets/images/career/ — Career guidance imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/placeholders/ — General fallback images.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

16. Final Standard

The assets/images/blog/ directory should contain optimized, accessible, appropriately licensed, and visually consistent imagery for MedOrbits blog content.

The existing blog-placeholder.svg should remain available as a lightweight fallback. Future images should be added using consistent filenames, documented intended uses, verified application references, and appropriate quality checks.

All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.