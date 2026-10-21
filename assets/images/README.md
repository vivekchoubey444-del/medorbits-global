MedOrbits Image Assets

Directory: assets/images/
Project: MedOrbits
Documentation Version: 1.2.0
Category: Shared Website Image Assets
Brand Theme: Royal Burgundy and Champagne Gold

⸻

1. Purpose

The assets/images/ directory contains shared visual assets for the MedOrbits education and career guidance website.

It organizes imagery used across landing pages, educational categories, admissions guidance, study abroad services, career development, marketing campaigns, and other approved website content.

The directory may contain:

* Hero images and landing-page banners
* Brand logos and visual identity assets
* Decorative backgrounds and patterns
* Education and course illustrations
* Admissions and counselling imagery
* Study abroad and international education visuals
* Career guidance and employment illustrations
* Campaign and promotional graphics
* Blog, team, testimonial, and service imagery
* Institution and campus placeholders
* General-purpose image fallbacks

All assets should support a consistent visual experience while maintaining accessibility, performance, licensing compliance, and compatibility with the existing website.

2. Brand Design System

All image assets should complement the established MedOrbits brand palette.

Colour	Hexadecimal	Intended use
Royal Burgundy	#6B1838	Primary brand colour
Champagne Gold	#C9A66B	Highlights and premium accents
Warm Cream	#F6EDDD	Soft backgrounds and supporting surfaces

Supporting neutral colours may be used when appropriate, provided they remain consistent with the existing website design.

Use the established brand colours consistently across illustrations, patterns, banners, placeholders, and other branded visual assets.

Do not introduce an unrelated colour system or change the site’s existing typography, page layouts, opening animation, header, footer, or responsive behaviour as part of routine image maintenance.

3. Asset Types and Usage

3.1 Content illustrations

JPG and JPG content images may include original abstract branded illustrations created for layout integration, visual prototyping, and website presentation.

Important: Abstract illustrations are not documentary photographs. Do not present them as authentic photographs of real students, institutions, campuses, hospitals, counsellors, or facilities.

Use these illustrations as visual support for page content rather than evidence of real-world facilities, partnerships, or outcomes.

3.2 Logo assets

SVG logo files may provide editable initial brand marks.

* Preserve existing logo files and their references.
* Use approved brand artwork where available.
* Replace provisional marks only after confirming the final approved artwork.
* Maintain appropriate aspect ratios and clear space.
* Do not stretch or distort logos.
* Verify rendering against the light and dark backgrounds used by the site.

3.3 Backgrounds and patterns

Background images and SVG patterns may support branded surfaces, hero sections, cards, and other components.

* Use restrained patterns and gradients.
* Maintain sufficient contrast with overlaid content.
* Avoid excessive decoration.
* Preserve the Royal Burgundy and Champagne Gold visual direction.
* Follow the existing background and surface design system.
* Do not introduce pure-white or transparent sections that conflict with the established design.

3.4 Placeholder assets

SVG placeholders provide scalable fallbacks when an approved content image is unavailable.

Use placeholders to communicate missing imagery without misrepresenting real people, institutions, services, testimonials, or outcomes.

Fallback assets must not replace meaningful content or conceal application errors.

3.5 Team and profile imagery

Team, advisor, counsellor, and leadership images must accurately represent the associated people and their verified roles.

* Obtain appropriate publication permission.
* Verify names, roles, and displayed credentials.
* Avoid exposing unnecessary personal information.
* Do not use stock imagery to imply actual MedOrbits personnel.

3.6 Campaign and promotional imagery

Campaign assets must represent the promoted service accurately.

Do not imply guaranteed admissions, scholarships, visa approvals, employment, salaries, or institutional partnerships unless the relevant claims are verified and authorized.

4. Recommended Directory Structure

The following structure describes the intended asset taxonomy. Verify the repository before creating, renaming, or removing files.

assets/images/
├── README.md
├── education-global.jpg
├── hero/
│   ├── README.md
│   ├── home-hero.jpg
│   ├── education-hero.jpg
│   ├── admissions-hero.jpg
│   ├── study-abroad-hero.jpg
│   ├── career-hero.jpg
│   └── contact-hero.jpg
├── logo/
├── backgrounds/
├── education/
├── admissions/
├── study-abroad/
├── career/
├── campaigns/
├── institutions/
├── services/
├── blog/
├── team/
├── testimonials/
└── placeholders/

This is an illustrative taxonomy, not a verified inventory of every directory or file. The root image education-global.jpg is a known project reference from the supplied project documentation; verify its current presence before modifying it.

Each category should have a clear purpose. Avoid duplicate assets across directories unless a documented reason requires them.

5. Naming Conventions

Use consistent, descriptive filenames.

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized raster content imagery.
* Use JPG when appropriate for existing content or compatibility requirements.
* Prefer SVG for scalable logos, simple illustrations, patterns, and placeholders.
* Use PNG when transparency or a specific technical requirement justifies it.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Keep filenames stable after they are referenced in production.
* Update relevant documentation when the approved inventory changes.

Before renaming or removing an asset, inspect its references in HTML, CSS, JavaScript, JSON, manifests, and other application configuration files.

6. Local Asset Policy

Image assets covered by this documentation are intended to be stored locally in the project.

* Do not introduce external image URLs without explicit approval.
* Avoid dependencies on third-party image-hosting services.
* Keep image paths consistent with the existing deployment configuration.
* Verify that every referenced asset exists.
* Use local assets for predictable rendering and controlled versioning.
* Ensure required SVG resources and other supporting files are available locally.
* Do not reference proposed assets in production until the files exist.

Example local references:

<img
  src=“/assets/images/hero/home-hero.jpg”
  alt=“Education guidance”
  width=“1600”
  height=“900”
>
<img
  src=“/assets/images/education/medical-education.jpg”
  alt=“Medical education”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

These examples assume the referenced files exist and their dimensions match the specified values. Verify both before using the markup.

The leading slash assumes the site is deployed at the domain root. Adapt asset paths if the application uses a subdirectory or a different routing strategy.

The intention to keep assets local does not independently verify that every current asset is free of external dependencies.

7. Image Dimensions and Responsive Behaviour

Choose image dimensions based on the component in which the asset is displayed.

Use case	Suggested aspect ratio	Example dimensions
Desktop hero	16:9	1920 × 1080 px
Content card	4:3	800 × 600 px
Blog thumbnail	16:9	1200 × 675 px
Square illustration	1:1	800 × 800 px
Wide promotional banner	2:1	1600 × 800 px
Profile image	1:1	512 × 512 px

These values are recommendations rather than mandatory specifications.

Responsive image handling should:

* Preserve existing page layouts and breakpoints.
* Prevent horizontal overflow.
* Avoid stretched or distorted images.
* Keep important subjects within the visible crop.
* Reserve layout space to prevent content shifts.
* Use mobile-specific artwork only when it materially improves composition.
* Keep headings, links, and calls to action readable.

Do not alter the website’s global layout merely to accommodate an individual image.

8. Image Optimization and Loading

Image assets should balance visual quality, file size, and loading performance.

Recommended practices:

* Resize images to appropriate display dimensions.
* Compress raster images before publishing.
* Prefer JPG for suitable content imagery.
* Use SVG for simple vector graphics where appropriate.
* Remove unnecessary metadata.
* Avoid oversized originals when smaller assets provide sufficient quality.
* Use responsive image sources when they provide a meaningful benefit.
* Avoid unnecessary JavaScript-based image loading.
* Verify loading behaviour on mobile connections.

Above-the-fold imagery

For the primary hero image:

* Consider eager loading.
* Use fetchpriority=“high” selectively when the image is the likely Largest Contentful Paint (LCP) element.
* Specify accurate dimensions or reserve layout space.
* Avoid delaying the image behind unrelated animations.

Below-the-fold imagery

For images outside the initial viewport:

* Consider loading=“lazy”.
* Use appropriate image dimensions.
* Avoid unnecessarily high fetch priority.
* Preserve stable layout dimensions.

Do not lazy-load the primary visible hero image by default when doing so would delay the main page content.

9. Accessibility and Alternative Text

Provide alternative text according to the purpose of each image.

Meaningful images

Use concise, descriptive alt text when an image conveys information not otherwise available in the surrounding content.

Decorative images

Use alt=“” when an image is decorative and does not add meaningful information beyond the surrounding text.

Additional requirements

* Do not use filenames as a substitute for meaningful alternative text.
* Avoid repeating nearby headings unnecessarily.
* Maintain sufficient contrast over image backgrounds.
* Keep essential headings and calls to action as HTML.
* Preserve keyboard navigation and visible focus indicators.
* Give informative SVG graphics appropriate accessible names.
* Do not use imagery alone to communicate essential information.

Abstract branded illustrations should not be described as photographs or depictions of specific real-world locations unless that description is accurate.

10. SVG Security and Compatibility

SVG assets should be optimized, accessible, and safe to use.

* Remove unnecessary editor metadata where appropriate.
* Avoid embedded scripts and untrusted external references.
* Keep SVG files self-contained when practical.
* Verify rendering at different sizes.
* Confirm compatibility with the existing colour system.
* Preserve required accessibility attributes.
* Check browser compatibility before relying on advanced SVG features.

Treat externally sourced SVG content as untrusted until reviewed.

11. Copyright and Licensing

Before publishing or replacing an asset:

* Confirm ownership or permission to use it.
* Verify that commercial use and modification are allowed.
* Provide attribution when required.
* Obtain appropriate releases for identifiable individuals where necessary.
* Avoid unauthorized institutional logos and third-party branding.
* Do not use stock imagery to imply actual MedOrbits personnel, students, partners, or facilities.
* Do not use visual assets to suggest guaranteed admissions, scholarships, placements, visas, or salaries.

Maintain records of sources, licences, attribution, and modification requirements where appropriate.

The intention to keep assets local does not independently verify ownership or licensing rights.

12. Quality Assurance Checklist

File integrity

* [ ]	The asset exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The file extension matches its actual format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	All production references point to valid local files.
* [ ]	No unnecessary duplicate assets have been introduced.

Brand and design

* [ ]	Royal Burgundy #6B1838 is used consistently.
* [ ]	Champagne Gold #C9A66B is used appropriately.
* [ ]	Warm Cream #F6EDDD is used consistently where suitable.
* [ ]	Existing typography and component styles are preserved.
* [ ]	The opening animation remains unchanged.
* [ ]	Header, navigation, and footer remain unchanged.
* [ ]	Desktop and mobile layouts have been tested.

Accessibility and performance

* [ ]	Alternative text matches the image’s purpose.
* [ ]	Decorative imagery uses appropriate empty alt text.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour suits the image’s position.
* [ ]	Images do not cause avoidable layout shifts.
* [ ]	Text contrast remains sufficient.
* [ ]	SVG files contain no unnecessary or untrusted dependencies.

Content and compliance

* [ ]	Asset licensing requirements are satisfied.
* [ ]	Abstract illustrations are not presented as documentary photographs.
* [ ]	Provisional logos are not represented as final approved artwork.
* [ ]	No unsupported partnerships or outcomes are implied.
* [ ]	All referenced local files exist.

13. Adding More Images in the Future

This directory is designed to accommodate additional image assets as MedOrbits expands its website, services, and content library.

13.1 Addition workflow

1. Inspect the existing directory and check for equivalent assets.
2. Identify the intended page, component, or content category.
3. Save the new asset in the appropriate existing subdirectory.
4. Choose a descriptive lowercase filename using hyphens.
5. Optimize the image for its intended display dimensions.
6. Verify visual quality, accessibility, licensing, and content accuracy.
7. Add the filename and intended use to the relevant asset catalogue.
8. Update the relevant HTML, CSS, JavaScript, or JSON references.
9. Test responsive rendering and loading performance.
10. Update this README or the category-specific README when the approved inventory changes.

13.2 Future asset inventory

Use this table to document new assets as they are approved.

Filename	Category	Intended use	Status
example-image.jpg	Relevant category	Describe the image’s purpose	Proposed

Replace the example row with actual filenames and details after the files have been created and verified. Proposed entries do not confirm that assets exist.

13.3 Suggested future additions

Potential additions include:

* Additional education and course illustrations
* More admissions and counselling imagery
* Study abroad destination and preparation visuals
* Career planning and professional development imagery
* Additional service and campaign illustrations
* Approved team and advisor portraits
* Blog thumbnails and article illustrations
* More reusable placeholder assets
* Additional approved logo variants

These are suggestions only. Add assets when supported by actual content or application requirements, and check for duplicates before creating files.

13.4 Final verification checklist

* [ ]	The new file exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The image matches the intended use.
* [ ]	The file is appropriately optimized.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	Application references are correct.
* [ ]	The relevant asset catalogue has been updated.
* [ ]	Existing website design and animations remain unchanged.

14. Maintenance and Version Control

When adding, updating, or removing image assets:

1. Inspect the existing directory structure.
2. Check all relevant references before modifying a file.
3. Preserve established filenames unless a migration is necessary.
4. Optimize new assets for their intended display dimensions.
5. Verify accessibility and visual consistency.
6. Update category-specific documentation when the approved inventory changes.
7. Test responsive behaviour and image loading.
8. Verify deployed asset paths after release.
9. Remove obsolete files only after confirming they are no longer referenced.

Keep changes scoped to the affected assets and their necessary references.

Do not rebuild page layouts or change the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme as part of routine image maintenance.

15. Related Directories

Potentially related locations include:

* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/logo/ — Brand logo assets.
* assets/images/backgrounds/ — Backgrounds and decorative patterns.
* assets/images/education/ — Education and course imagery.
* assets/images/admissions/ — Admissions and counselling imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/career/ — Career and employment imagery.
* assets/images/campaigns/ — Promotional and campaign graphics.
* assets/images/institutions/ — Institution-related imagery and placeholders.
* assets/images/services/ — Service-specific imagery.
* assets/images/blog/ — Blog and article imagery.
* assets/images/team/ — Team imagery.
* assets/images/testimonials/ — Testimonial-related assets.
* assets/images/placeholders/ — General fallback images.
* assets/icons/ — Interface and category icons.
* assets/css/ — Stylesheets, if consistent with the current project structure.

Verify each path before referencing it. These directories describe the intended organization and do not confirm that every location currently exists.

16. Final Standard

The assets/images/ directory is the shared visual library for MedOrbits.

All assets should be locally available, appropriately optimized, accessible, correctly licensed, and consistent with the Royal Burgundy, Champagne Gold, and Warm Cream brand palette.

Abstract branded illustrations must remain clearly distinguished from documentary photography. SVG placeholders should provide scalable, reliable fallbacks, while provisional logo marks should be replaced only when approved final artwork is available.

Every update must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and established visual identity.

End of document.