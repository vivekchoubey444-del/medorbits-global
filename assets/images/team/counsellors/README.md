MedOrbits Counsellor Images

Directory: assets/images/team/counsellors/
Project: MedOrbits
Category: Education Counsellors, Career Counsellors, and Student Guidance Professionals
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.0.0

⸻

1. Purpose

The assets/images/team/counsellors/ directory is intended for approved images of counsellors associated with MedOrbits’ education guidance, admissions support, career planning, and student assistance services.

These images may be used for:

* Education counsellor profiles
* Admissions guidance pages
* Career counselling services
* Student support pages
* About Us and Our Team sections
* Professional biographies
* Counselling service cards
* Approved team introductions
* Future counsellor-related website content

Every image must accurately represent the person and their verified role. Do not use unrelated stock photographs or placeholder portraits to imply that a person works for MedOrbits.

2. Recommended Directory Structure

Verify the current repository before creating, renaming, or replacing files. The following structure is recommended and is not a confirmed inventory of existing assets.

assets/images/team/counsellors/
├── README.md
├── counsellor-placeholder.svg
└── example-counsellor.jpg

The example image filenames are proposed only. Create them when the corresponding assets are needed and approved.

For a small team, storing approved images directly in this directory is sufficient. Additional subdirectories may be introduced when the asset collection grows.

3. Asset Catalogue

Maintain an inventory of approved counsellor images as they are added.

Filename	Intended use	Status
counsellor-placeholder.svg	Generic fallback for an unavailable counsellor portrait	Proposed
example-counsellor.jpg	Example counsellor portrait	Proposed

These entries are examples, not confirmation that the files currently exist. Replace them with actual filenames after the assets have been created and verified.

Avoid storing unnecessary personal information in filenames or public asset metadata.

4. Brand and Visual Direction

Counsellor imagery should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use the existing brand colours, typography, backgrounds, and component styles.

Recommended image characteristics:

* Professional and credible presentation
* Natural lighting and balanced composition
* Consistent portrait framing
* Clear visibility of the subject
* Suitable resolution for the intended display size
* Compatibility with mobile and desktop layouts
* Consistency with the premium MedOrbits design system

Avoid excessive filters, artificial facial alterations, distracting backgrounds, and unauthorized third-party branding.

Do not change the global website theme to accommodate individual portraits.

5. Image Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized photographic portraits.
* Use SVG for simple placeholder illustrations.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Avoid phone numbers, email addresses, identity numbers, and other sensitive information in filenames.
* Check existing assets before creating duplicates.

Use an approved, consistent naming convention for counsellor portraits. If names are included in filenames, ensure that publication is appropriate and consistent with the project’s privacy practices.

Before renaming or removing an asset, inspect its references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended Image Dimensions

Use the existing counsellor profile components as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Counsellor profile card	1:1	800 × 800 px
Detailed counsellor profile	3:4	900 × 1200 px
Counselling team banner	16:9	1600 × 900 px
Small profile thumbnail	1:1	320 × 320 px

These are suggested dimensions, not mandatory specifications.

Requirements:

* Preserve the original aspect ratio.
* Use consistent cropping for comparable profile cards.
* Keep the subject appropriately positioned.
* Avoid stretching or distortion.
* Optimize resolution for the intended display size.
* Test image cropping on mobile and desktop layouts.

7. Recommended HTML Integration

The following example illustrates how an approved counsellor portrait may be referenced.

<img
  src=“/assets/images/team/counsellors/example-counsellor.jpg”
  alt=“Name of the counsellor”
  width=“800”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

Replace the example filename and alternative text with verified information. Do not reference this file in production until the image exists.

Use meaningful alternative text when the portrait communicates relevant information. If the portrait is decorative and the adjacent content already identifies the counsellor, an empty alt attribute may be appropriate.

Adapt the asset path to the existing deployment configuration.

8. Identity, Qualifications, and Consent

Counsellor portraits require particular care because they can imply professional authority or a formal relationship with MedOrbits.

Before publishing an image:

* Verify the person’s identity.
* Confirm their actual role and relationship with MedOrbits.
* Verify professional qualifications before displaying them.
* Obtain appropriate permission or consent for publication.
* Confirm approval for the intended website or marketing use.
* Ensure biographies and service descriptions are accurate.
* Avoid publishing private contact details or sensitive personal information.
* Respect applicable privacy, licensing, and removal requirements.

Do not imply that a counsellor holds a regulated professional qualification, licence, institutional affiliation, or specialist credential unless it has been verified.

Do not fabricate counsellors, qualifications, experience, testimonials, or professional affiliations.

9. Accessibility

* Provide appropriate alternative text for informative portraits.
* Avoid repeating adjacent accessible names unnecessarily.
* Maintain sufficient contrast for names and profile descriptions.
* Keep essential biographical information in HTML text.
* Preserve keyboard navigation and visible focus indicators.
* Ensure profile cards remain usable on small screens.
* Do not rely on a person’s appearance alone to communicate their expertise.

If a portrait is unavailable, use an appropriate fallback while keeping the counsellor’s verified name, role, and relevant information accessible.

10. Image Optimization and Performance

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

When a counsellor portrait is unavailable:

1. Use a verified generic placeholder.
2. Preserve the profile component’s dimensions.
3. Keep the counsellor’s verified name and role visible.
4. Avoid broken-image indicators where practical.
5. Ensure the placeholder does not imply a real person’s identity.
6. Verify that the fallback file exists.
7. Reuse the application’s existing image-error handling where available.

A placeholder must never be presented as a photograph of an actual counsellor.

12. Copyright and Licensing

Before publishing or replacing counsellor images:

* Verify ownership or permission to use the asset.
* Confirm commercial-use and modification rights.
* Obtain appropriate consent for identifiable individuals.
* Respect photographer and licensing conditions.
* Avoid unauthorized institutional logos.
* Do not use another organization’s counsellors to represent MedOrbits.
* Maintain source and licensing records where appropriate.

Stock imagery may be used for decorative purposes only when properly licensed. It must not falsely represent an actual MedOrbits counsellor.

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

* [ ]	Identity and role are verified.
* [ ]	Qualifications and biographies are accurate.
* [ ]	Publication permission is confirmed where required.
* [ ]	Licensing requirements are satisfied.
* [ ]	No unnecessary sensitive information is exposed.

14. Adding More Counsellor Images in the Future

This directory is designed to accommodate additional approved counsellor portraits as MedOrbits expands its education and career guidance services.

14.1 Addition workflow

1. Obtain the approved portrait.
2. Verify the person’s identity and role.
3. Confirm permission for publication.
4. Save the image in assets/images/team/counsellors/.
5. Choose a descriptive lowercase filename.
6. Optimize the image for its intended display size.
7. Add the filename and intended use to the asset catalogue.
8. Update the relevant application references.
9. Test responsive rendering, accessibility, and loading performance.
10. Update this README when the approved inventory changes.

14.2 Future asset inventory

Use this table to document additional approved images.

Filename	Intended use	Format	Status
example-counsellor-portrait.jpg	Approved counsellor profile	JPG	Proposed

Replace the example row with actual filenames after the files have been created. Proposed entries do not confirm that files exist.

14.3 Suggested future assets

Potential additions include:

* education-counsellor.jpg — Approved education counsellor portrait
* admissions-counsellor.jpg — Approved admissions counsellor portrait
* career-counsellor.jpg — Approved career counsellor portrait
* study-abroad-counsellor.jpg — Approved international education counsellor portrait
* student-support-counsellor.jpg — Approved student support counsellor portrait
* counsellor-placeholder.svg — Generic portrait fallback
* counselling-team.jpg — Approved group photograph of counsellors

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

When adding, replacing, or removing counsellor images:

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
* assets/images/team/advisors/ — Advisor portraits, if present.
* assets/images/team/leadership/ — Leadership portraits, if present.
* assets/images/placeholders/ — General fallback imagery.
* assets/images/services/ — Service-specific imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

17. Final Standard

The assets/images/team/counsellors/ directory should contain approved, accurately represented, accessible, optimized, and appropriately licensed counsellor imagery.

Future additions must be documented, verified, and tested before publication. All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.