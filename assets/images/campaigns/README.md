MedOrbits Campaign Images

Directory: assets/images/campaigns/
Project: MedOrbits
Category: Marketing Campaigns and Promotional Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/campaigns/ directory contains visual assets used for MedOrbits marketing campaigns, promotional landing pages, digital advertisements, and service awareness initiatives.

These assets may support:

* Admissions and counselling campaigns
* Career guidance promotions
* Scholarship awareness campaigns
* Education service advertisements
* Website promotional banners
* Social media campaign creatives
* Campaign-specific landing pages
* Approved promotional content

Campaign images must communicate the intended service accurately, maintain brand consistency, and support a professional user experience across desktop and mobile devices.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/campaigns/
├── README.md
├── admissions-campaign.jpg
├── career-campaign.jpg
└── scholarship-campaign.jpg

Current asset catalogue

Filename	Observed size	Intended use
admissions-campaign.jpg	18.3 KB	Admissions and counselling promotions
career-campaign.jpg	20.9 KB	Career guidance and professional development campaigns
scholarship-campaign.jpg	18.2 KB	Scholarship awareness and financial-aid guidance

File sizes are approximate and may change after optimization or replacement.

The screenshot confirms the filenames and approximate sizes. It does not independently verify image dimensions, visual content, licensing, or production usage.

3. Brand and Visual Direction

All campaign assets must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing brand colours, gradients, typography, and visual design tokens.

Campaign imagery should be:

* Professional and visually refined
* Relevant to the promoted service
* Clear and legible at different display sizes
* Consistent with the premium MedOrbits presentation
* Suitable for responsive website layouts
* Designed to support, rather than replace, the campaign’s message

Do not introduce an unrelated colour system or alter existing website layouts, opening animation, header, footer, or responsive behaviour to accommodate campaign images.

4. Asset Usage Guidelines

admissions-campaign.jpg

Use for admissions guidance, counselling services, application assistance, and educational pathway promotions.

Do not imply guaranteed admission, official institutional endorsement, or confirmed seat availability unless the relevant claim is independently verified and appropriately authorized.

career-campaign.jpg

Use for career planning, professional development, employment support, and career guidance campaigns.

Avoid promising guaranteed employment, salaries, placements, or professional outcomes.

scholarship-campaign.jpg

Use for scholarship awareness, eligibility guidance, financial-aid information, and scholarship application support.

Do not imply guaranteed scholarship approval or funding.

5. Naming Conventions

Use descriptive and consistent filenames.

* Use lowercase characters.
* Separate words with hyphens.
* Prefer JPG for optimized raster campaign imagery.
* Use SVG for suitable scalable vector graphics.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check for existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing files, inspect their references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Image Dimensions and Responsive Behaviour

Choose image dimensions according to the campaign placement.

Placement	Suggested aspect ratio	Example dimensions
Website campaign card	4:3	800 × 600 px
Wide promotional banner	2:1	1600 × 800 px
Website hero campaign	16:9	1920 × 1080 px
Square campaign creative	1:1	1080 × 1080 px
Portrait social creative	4:5	1080 × 1350 px

These are recommendations, not verified specifications for the existing assets.

Ensure that:

* Important subjects remain visible after cropping.
* Text and controls remain readable.
* Images do not stretch or distort.
* Responsive layouts avoid horizontal overflow.
* Layout dimensions remain stable during image loading.
* Essential campaign information is also available as HTML text.

Create dedicated mobile variants only when responsive cropping cannot preserve the intended composition.

7. Recommended HTML Integration

The following example illustrates how a campaign image can be referenced.

<img
  src=“/assets/images/campaigns/admissions-campaign.jpg”
  alt=“”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

This example assumes the asset exists and the specified dimensions match the actual file. Verify both before using it.

Use alt=“” when the image is purely decorative and surrounding text communicates the campaign’s purpose. Provide concise descriptive alternative text when the image conveys information not otherwise available.

Adapt asset paths to the existing deployment configuration if the website is not hosted at the domain root.

8. Image Optimization and Loading

Campaign imagery should balance visual quality and loading performance.

Recommended practices:

* Compress images before publishing.
* Resize assets to suitable display dimensions.
* Prefer JPG for supported raster imagery.
* Remove unnecessary metadata.
* Avoid oversized originals when smaller files provide sufficient quality.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold campaign images where appropriate.
* Avoid unnecessary JavaScript-based image loading.

Do not lazy-load the primary above-the-fold campaign image by default if it is the likely Largest Contentful Paint element.

File size alone does not establish visual quality or suitability for production.

9. Accessibility and Promotional Accuracy

* Use meaningful alternative text for informative images.
* Use empty alternative text for decorative images.
* Maintain sufficient text contrast.
* Keep headings, descriptions, and calls to action as HTML.
* Preserve keyboard navigation and visible focus indicators.
* Avoid using image colour alone to communicate meaning.
* Ensure important campaign conditions are available as readable text.
* Do not imply unauthorized institutional partnerships.
* Do not make unsupported admissions, scholarship, placement, or salary claims.

Promotional copy must accurately represent the services MedOrbits actually offers.

10. Missing Assets and Fallbacks

When a campaign image is unavailable:

* Use a verified existing fallback from the project’s placeholder library, if suitable.
* Preserve the campaign container dimensions.
* Keep campaign headings and calls to action visible.
* Avoid broken-image indicators where practical.
* Verify the fallback path before using it.
* Avoid replacing the entire campaign component when only its image is missing.
* Preserve the existing website design system.

A fallback must not imply that an unavailable campaign or service is active.

11. Copyright and Licensing

Before publishing campaign imagery:

* Confirm ownership or permission to use the asset.
* Verify commercial-use and modification rights.
* Provide attribution when required.
* Obtain appropriate releases for identifiable individuals where necessary.
* Avoid unauthorized logos and institutional branding.
* Do not fabricate testimonials, endorsements, partnerships, or results.
* Maintain source and licensing records where appropriate.

12. Quality Assurance Checklist

File integrity

* [ ]	The campaign image exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The extension matches the actual file format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	Application references point to the correct files.

Visual quality

* [ ]	The image accurately represents the campaign.
* [ ]	Royal Burgundy and Champagne Gold styling is preserved.
* [ ]	Cropping maintains important visual elements.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Existing layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour matches the image’s position.
* [ ]	Avoidable layout shifts are prevented.
* [ ]	Text contrast remains sufficient.

Content and compliance

* [ ]	Usage rights are confirmed.
* [ ]	No unsupported outcomes or partnerships are implied.
* [ ]	Campaign conditions are clear and accessible.
* [ ]	All referenced assets and fallbacks exist.

13. Adding More Campaign Images in the Future

This directory is designed to support additional MedOrbits campaigns as new services, promotional activities, and marketing initiatives are introduced.

13.1 Addition workflow

When adding a new image:

1. Save the file in assets/images/campaigns/.
2. Choose a descriptive lowercase filename using hyphens.
3. Prefer JPG for optimized raster imagery.
4. Optimize the image for its intended display dimensions.
5. Add the filename and intended use to the asset catalogue.
6. Update the relevant HTML, CSS, JavaScript, or JSON references.
7. Test rendering, cropping, accessibility, and loading performance.
8. Verify licensing and promotional accuracy.
9. Update this README when the approved inventory changes.

13.2 Future asset inventory

Use this table to document new campaign assets.

Filename	Campaign purpose	Format	Status
example-campaign.jpg	Describe the campaign	JPG	Proposed

Replace the example entry with actual filenames when assets are created. Proposed filenames do not confirm that files exist.

13.3 Suggested future campaign images

Possible additions include:

* study-abroad-campaign.jpg — International education promotions
* medical-education-campaign.jpg — Medical education guidance
* course-discovery-campaign.jpg — Course exploration and selection
* application-support-campaign.jpg — Application assistance services
* education-loan-campaign.jpg — Education financing guidance
* exam-preparation-campaign.jpg — Entrance examination resources
* student-guidance-campaign.jpg — Student counselling and planning

These are suggestions only. Add assets when the relevant campaign or content requirement exists, and check for duplicates before creating files.

13.4 Final verification checklist

* [ ]	The new image exists at the documented path.
* [ ]	The filename and format are correct.
* [ ]	The image matches the campaign’s purpose.
* [ ]	The file is optimized.
* [ ]	Alternative text is appropriate.
* [ ]	Responsive rendering has been tested.
* [ ]	Licensing requirements are satisfied.
* [ ]	Promotional claims are accurate.
* [ ]	All application references are correct.
* [ ]	Existing website design and animations remain unchanged.

14. Maintenance and Version Control

When adding, replacing, or removing campaign images:

1. Inspect the current directory and application references.
2. Check whether an equivalent asset already exists.
3. Preserve established filenames unless a migration is required.
4. Optimize new files before publishing.
5. Update the asset catalogue and documentation.
6. Test responsive rendering and accessibility.
7. Check loading performance and production paths.
8. Remove obsolete files only after confirming they are no longer referenced.

Routine campaign asset maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

15. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/admissions/ — Admissions campaign imagery.
* assets/images/career/ — Career guidance imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/placeholders/ — Fallback images.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

16. Final Standard

The assets/images/campaigns/ directory should contain optimized, accessible, appropriately licensed, and visually consistent promotional assets for MedOrbits.

Future additions must be documented, linked to verified files, and checked for responsive rendering and promotional accuracy.

All campaign assets must integrate with the existing website without disrupting its architecture, page layouts, opening animation, header, footer, responsive behaviour, or Royal Burgundy and Champagne Gold design system.

End of document.