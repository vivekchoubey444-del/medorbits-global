MedOrbits Advisor Images

Directory: assets/images/team/advisors/
Project: MedOrbits
Category: Advisor Portraits and Professional Advisory Team Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.0.0

⸻

1. Purpose

The assets/images/team/advisors/ directory is intended for approved images of professionals who serve as advisors to MedOrbits.

These images may support:

* Advisor profile cards
* About Us and Our Team pages
* Professional advisory introductions
* Education and career guidance information
* Approved advisor biographies
* Advisory team sections
* Relevant service landing pages
* Future advisor-related website content

Every image must accurately represent the person and their verified relationship with MedOrbits. Do not use unrelated stock photographs or placeholder portraits to imply that a person is an actual advisor.

2. Recommended Directory Structure

Verify the current repository before creating, renaming, or replacing files. The following is a recommended structure, not a confirmed inventory of existing assets.

assets/images/team/advisors/
├── README.md
├── advisor-placeholder.svg
└── example-advisor.jpg

The example image filenames are proposed only. Create them only when needed and approved.

For a larger advisory team, a consistent naming convention and asset catalogue can help maintain the directory.

3. Asset Catalogue

Record each approved advisor image as it is added.

Filename	Intended use	Status
advisor-placeholder.svg	Generic fallback for an unavailable advisor portrait	Proposed
example-advisor.jpg	Example advisor portrait	Proposed

The filenames above do not confirm that these files exist. Replace the examples with actual filenames after the corresponding assets have been created and verified.

Avoid storing unnecessary personal information in filenames or public asset metadata.

4. Brand and Visual Direction

Advisor imagery should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use existing brand colours, typography, backgrounds, and component styles.

Recommended characteristics:

* Professional and credible presentation
* Consistent portrait framing
* Natural lighting and balanced composition
* Appropriate image resolution
* Clear visibility of the subject
* Compatibility with mobile and desktop layouts
* Consistency with the premium MedOrbits design system

Avoid excessive filters, artificial facial alterations, misleading professional attire, and unauthorized third-party branding.

Do not modify the global website theme to accommodate individual advisor portraits.

5. Image Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized photographic portraits.
* Use SVG for simple placeholder illustrations.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Avoid phone numbers, email addresses, identity numbers, and other sensitive information in filenames.
* Check existing assets before creating duplicates.

Use an approved, consistent naming convention for advisor portraits. If names are included in filenames, ensure that publication is appropriate and consistent with the project’s privacy practices.

Before renaming or removing an asset, inspect its references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended Image Dimensions

Use the existing advisor components as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Advisor profile card	1:1	800 × 800 px
Detailed advisor profile	3:4	900 × 1200 px
Advisory team banner	16:9	1600 × 900 px
Small profile thumbnail	1:1	320 × 320 px

These dimensions are suggestions, not mandatory specifications.

Requirements:

* Preserve the original aspect ratio.
* Use consistent cropping for comparable profiles.
* Keep the subject appropriately positioned.
* Avoid stretching or distortion.
* Optimize image resolution for the intended display size.
* Test the crop on mobile and desktop layouts.

7. Recommended HTML Integration

The following example illustrates how an approved advisor portrait may be referenced.

<img
  src=“/assets/images/team/advisors/example-advisor.jpg”
  alt=“Name of the advisor”
  width=“800”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

Replace the example filename and alternative text with verified information. Do not reference this file in production until it exists.

Use meaningful alternative text when the portrait communicates relevant information. If the portrait is decorative and the adjacent content already identifies the advisor, an empty alt attribute may be appropriate.

Adapt the asset path to the existing deployment configuration.

8. Identity, Credentials, and Consent

Advisor portraits require particular care because they can imply professional authority or an official relationship with MedOrbits.

Before publishing an image:

* Verify the person’s identity.
* Confirm their actual advisory relationship with MedOrbits.
* Verify professional qualifications and credentials before displaying them.
* Obtain appropriate permission or consent for publication.
* Confirm that the image is approved for the intended website and marketing use.
* Ensure accompanying biographies are accurate.
* Avoid publishing private contact details or sensitive personal information.
* Respect applicable privacy, licensing, and removal requirements.

Do not imply that an advisor is a licensed professional, institutional representative, employee, or official partner unless that relationship and status have been verified.

Do not fabricate advisors, qualifications, affiliations, testimonials, or endorsements.

9. Accessibility

* Provide appropriate alternative text for informative portraits.
* Avoid repeating adjacent accessible names unnecessarily.
* Maintain sufficient contrast for names and profile descriptions.
* Keep essential biographical information in HTML text.
* Preserve keyboard navigation and visible focus indicators.
* Ensure profile cards remain usable on small screens.
* Do not rely on portrait appearance alone to communicate an advisor’s expertise.

If a portrait is unavailable, display an appropriate fallback while keeping the advisor’s verified name, role, and relevant information accessible.

10. Optimization and Performance

Recommended practices:

* Resize images to appropriate display dimensions.
* Compress photographic assets before publishing.
* Prefer JPG where supported.
* Use responsive image sources where beneficial.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold portraits where appropriate.
* Avoid unnecessarily large original photographs.
* Remove unnecessary metadata.
* Maintain acceptable visual quality after compression.

Do not lazy-load a portrait by default when it is the primary above-the-fold image and likely contributes to Largest Contentful Paint.

11. Missing Images and Fallbacks

When an advisor portrait is unavailable:

1. Use a verified generic placeholder.
2. Preserve the profile component’s dimensions.
3. Keep the advisor’s verified name and role visible.
4. Avoid broken-image indicators where practical.
5. Ensure the placeholder does not imply a real person’s identity.
6. Verify that the fallback file exists.
7. Reuse the application’s existing image-error handling where available.

A placeholder must never be presented as a photograph of an actual advisor.

12. Copyright and Licensing

Before publishing or replacing advisor images:

* Verify ownership or permission to use the asset.
* Confirm commercial-use and modification rights.
* Obtain appropriate consent for identifiable individuals.
* Respect photographer and licensing conditions.
* Avoid unauthorized institutional logos.
* Do not use another organization’s advisors to represent MedOrbits.
* Maintain source and licensing records where appropriate.

Stock imagery may be used for decorative purposes only when properly licensed and must not falsely represent an actual MedOrbits advisor.

13. Quality Assurance Checklist

File integrity

* [ ]	The image exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The extension matches the actual format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	Production references point to the correct asset.

Visual quality

* [ ]	The image accurately represents the intended person.
* [ ]	Portrait framing is consistent.
* [ ]	Royal Burgundy and Champagne Gold styling is preserved.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Existing page layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour matches the image’s position.
* [ ]	Text contrast remains sufficient.
* [ ]	Avoidable layout shifts are prevented.

Privacy and compliance

* [ ]	Identity and advisory relationship are verified.
* [ ]	Credentials and biographies are accurate.
* [ ]	Publication permission is confirmed where required.
* [ ]	Licensing requirements are satisfied.
* [ ]	No unnecessary sensitive information is exposed.

14. Adding More Advisor Images in the Future

This directory is designed to accommodate additional approved advisor portraits as MedOrbits expands.

14.1 Addition workflow

1. Obtain the approved portrait.
2. Verify the person’s identity and advisory relationship.
3. Confirm permission for publication.
4. Save the image in assets/images/team/advisors/.
5. Choose a descriptive lowercase filename.
6. Optimize the image for its intended display size.
7. Add the filename and intended use to the asset catalogue.
8. Update the relevant application references.
9. Test responsive rendering, accessibility, and loading performance.
10. Update this README when the approved inventory changes.

14.2 Future asset inventory

Use this table to document additional approved images.

Filename	Intended use	Format	Status
example-advisor-portrait.jpg	Approved advisor profile	JPG	Proposed

Replace the example row with actual filenames after the files have been created. Proposed entries do not confirm that files exist.

14.3 Suggested future assets

Potential additions include:

* education-advisor.jpg — Approved education advisor portrait
* career-advisor.jpg — Approved career advisor portrait
* admissions-advisor.jpg — Approved admissions advisor portrait
* international-education-advisor.jpg — Approved international education advisor portrait
* advisor-placeholder.svg — Generic fallback illustration
* advisory-team.jpg — Approved group photograph of advisors

These are suggestions only. Create them only when the corresponding people, roles, content, and publication permissions have been verified.

14.4 Final verification checklist

* [ ]	The new image exists at the documented path.
* [ ]	The image is approved for publication.
* [ ]	The person’s identity and role are verified.
* [ ]	The filename and format are correct.
* [ ]	Image dimensions and compression are appropriate.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Application references are correct.
* [ ]	Existing website styling and animations remain unchanged.

15. Maintenance and Version Control

When adding, replacing, or removing advisor images:

1. Inspect the existing directory and application references.
2. Verify the image and associated professional information.
3. Confirm publication permissions remain appropriate.
4. Preserve established filenames unless a migration is required.
5. Update the asset catalogue and documentation.
6. Test responsive rendering and accessibility.
7. Verify production paths.
8. Remove outdated assets only after confirming they are no longer referenced and applicable retention requirements have been considered.

Routine image maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

16. Related Directories

Potentially related locations include:

* assets/images/team/ — Shared team imagery.
* assets/images/team/leadership/ — Leadership portraits, if present.
* assets/images/team/counsellors/ — Counsellor portraits, if present.
* assets/images/placeholders/ — General fallback imagery.
* assets/images/services/ — Service-specific imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

17. Final Standard

The assets/images/team/advisors/ directory should contain approved, accurately represented, accessible, optimized, and appropriately licensed advisor imagery.

Future additions must be documented, verified, and tested before publication. All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.