MedOrbits Team Images

Directory: assets/images/team/
Project: MedOrbits
Category: Team Profiles, Staff Portraits, and Professional Team Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/team/ directory stores approved visual assets representing MedOrbits team members, leadership, counsellors, advisors, and other authorized professionals featured on the website.

These images may be used for:

* About Us and Our Team pages
* Leadership profiles
* Education counsellor profiles
* Career guidance professionals
* Student support personnel
* Advisory team sections
* Professional biographies
* Approved organizational introductions
* Future team-related website sections

Every image must accurately represent the person or role associated with it. Do not use placeholder artwork or unrelated stock photographs to imply that a person works for MedOrbits.

2. Recommended Directory Structure

Verify the current repository before creating, renaming, or replacing files. The following is a recommended structure, not a confirmed inventory of existing assets.

assets/images/team/
├── README.md
├── team-placeholder.svg
├── leadership/
│   └── README.md
├── counsellors/
│   └── README.md
└── advisors/
    └── README.md

The optional subdirectories are suggestions for future organization. Create them only when the project requires them.

For a small team, keeping approved images directly inside assets/images/team/ may be sufficient.

3. Asset Catalogue

Maintain an inventory of approved team images as they are added.

Filename	Intended use	Status
team-placeholder.svg	Generic fallback when a team image is unavailable	Proposed
team-member-example.jpg	Example team portrait	Proposed

The filenames above are examples only. They do not confirm that these assets currently exist.

Replace example entries with actual filenames and verified intended uses as the directory grows.

4. Brand and Visual Direction

All team imagery should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use the existing brand colours, backgrounds, typography, and component styles.

Recommended image characteristics:

* Professional and credible
* Natural lighting and balanced composition
* Consistent portrait framing
* Clear facial visibility where appropriate
* Suitable for mobile and desktop layouts
* Visually consistent across profile cards
* Compatible with the existing premium website design

Avoid excessive filters, artificial facial alterations, distracting backgrounds, and unauthorized logos or uniforms.

Do not change the global colour theme to accommodate individual team portraits.

5. Image Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer descriptive names.
* Use JPG for optimized photographic portraits where appropriate.
* Use SVG for simple placeholder illustrations.
* Keep filenames stable once referenced by production pages.
* Avoid names containing unnecessary personal information.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.

For personal portraits, use a consistent naming convention approved by the project. Avoid including phone numbers, email addresses, identity numbers, or other sensitive information in filenames.

Before renaming or removing an image, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended Image Dimensions

Use the existing profile components as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Team profile card	1:1	800 × 800 px
Professional profile page	3:4	900 × 1200 px
Wide team banner	16:9	1600 × 900 px
Small profile thumbnail	1:1	320 × 320 px

These are suggested dimensions, not mandatory specifications.

Requirements:

* Keep the subject appropriately centred.
* Use consistent cropping for comparable profile cards.
* Preserve sufficient image resolution for the intended display size.
* Avoid stretching or distorting portraits.
* Test image cropping on mobile and desktop layouts.
* Use responsive art direction only when necessary.

7. Recommended HTML Integration

The following example illustrates how an approved team portrait may be referenced.

<img
  src=“/assets/images/team/team-member-example.jpg”
  alt=“Name of the team member”
  width=“800”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

Replace the example filename and alternative text with verified information. Do not deploy this reference until the image exists.

For a decorative portrait that duplicates the adjacent accessible name, an empty alt attribute may be appropriate. For an informative portrait, use concise alternative text that identifies the person when identification is relevant and authorized.

Adapt the asset path to the existing deployment configuration.

8. Privacy, Consent, and Representation

Team photographs can contain personal information. Handle them responsibly.

Before publishing a recognizable person’s photograph:

* Obtain appropriate permission or consent for publication.
* Confirm that the person is accurately represented.
* Verify their role and any accompanying professional credentials.
* Confirm that the image is approved for the intended website or marketing use.
* Avoid publishing private contact information.
* Remove unnecessary metadata that could expose sensitive details.
* Respect requests to correct or remove outdated portraits, subject to applicable requirements.

Do not imply that a person is an employee, qualified professional, institutional representative, or official advisor without verification.

Do not fabricate team members, credentials, testimonials, or professional affiliations.

9. Accessibility

* Provide appropriate alternative text for informative portraits.
* Avoid repeating adjacent text unnecessarily.
* Maintain sufficient contrast for names and profile descriptions.
* Keep essential information in HTML text rather than embedding it in images.
* Preserve keyboard navigation and visible focus indicators.
* Ensure profile cards remain usable at small screen sizes.
* Do not use image appearance as the only way to identify a person’s role.

If a portrait is unavailable, display an appropriate fallback without hiding the person’s name or professional information.

10. Image Optimization and Performance

Recommended practices:

* Resize images to appropriate display dimensions.
* Compress photographic assets before publishing.
* Prefer JPG where supported.
* Use responsive image sources where beneficial.
* Specify image dimensions or reserve layout space.
* Lazy-load below-the-fold team portraits where appropriate.
* Avoid loading unnecessarily large original photographs.
* Remove unnecessary metadata.
* Preserve acceptable visual quality after compression.

Do not lazy-load an image by default when it is the primary above-the-fold content and likely contributes to Largest Contentful Paint.

11. Missing Images and Fallbacks

When a team portrait is unavailable:

1. Use a verified generic placeholder.
2. Preserve the existing profile card dimensions.
3. Keep the person’s name, role, and relevant information visible.
4. Avoid showing broken-image indicators where practical.
5. Ensure the fallback does not imply a real person’s identity.
6. Verify that the referenced fallback exists.
7. Reuse the application’s existing image-error handling where available.

A placeholder should clearly function as a fallback, not as a representation of an actual employee or advisor.

12. Copyright and Licensing

Before publishing or replacing team imagery:

* Verify ownership or permission to use the image.
* Confirm commercial-use and modification rights.
* Obtain appropriate consent for identifiable individuals.
* Respect photographer and licensing conditions.
* Avoid unauthorized third-party logos.
* Do not use another organization’s team photographs to represent MedOrbits.
* Maintain source and licensing records where appropriate.

Stock imagery, if used for decorative purposes, must not be presented as actual MedOrbits personnel.

13. Quality Assurance Checklist

File integrity

* [ ]	The image exists at the documented path.
* [ ]	The file opens and renders correctly.
* [ ]	The extension matches the actual format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	Production references point to the correct asset.

Visual quality

* [ ]	The portrait accurately represents the intended person.
* [ ]	Cropping and framing are consistent.
* [ ]	The brand theme is preserved.
* [ ]	Desktop and mobile layouts have been tested.
* [ ]	Existing page layouts, opening animation, header, and footer remain unchanged.

Accessibility and performance

* [ ]	Alternative text is appropriate.
* [ ]	Image dimensions are specified or layout space is reserved.
* [ ]	Loading behaviour matches the image’s position.
* [ ]	Text contrast remains sufficient.
* [ ]	Images do not cause avoidable layout shifts.

Privacy and compliance

* [ ]	Publication permission is confirmed where required.
* [ ]	Names, roles, and credentials are accurate.
* [ ]	No sensitive personal information is exposed unnecessarily.
* [ ]	Image licensing requirements are satisfied.
* [ ]	Fallbacks do not misrepresent real people.

14. Adding More Team Images in the Future

This directory is designed to accommodate additional approved portraits and team imagery as MedOrbits grows.

14.1 Addition workflow

1. Obtain the approved image.
2. Confirm the person’s identity, role, and publication permission.
3. Save the image in assets/images/team/ or the appropriate existing subdirectory.
4. Choose a descriptive lowercase filename.
5. Optimize the image for its intended display size.
6. Add the filename and intended use to the asset catalogue.
7. Update the relevant application references.
8. Test responsive rendering and accessibility.
9. Update this README when the approved inventory changes.

14.2 Future asset inventory

Use this table to document additional assets.

Filename	Intended use	Format	Status
example-team-portrait.jpg	Approved team member portrait	JPG	Proposed

Replace the example row with actual filenames when the files are created. Proposed entries do not confirm that files exist.

14.3 Suggested future assets

Potential additions include:

* team-placeholder.svg — Generic portrait fallback
* leadership-team.jpg — Approved leadership group photograph
* counselling-team.jpg — Approved counselling team photograph
* student-support-team.jpg — Approved student support team photograph
* advisory-team.jpg — Approved advisory group photograph

These are suggestions only. Create them only when the corresponding content exists and the necessary permissions have been obtained.

14.4 Final verification checklist

* [ ]	The image exists at the documented path.
* [ ]	The image is approved for publication.
* [ ]	The filename and format are correct.
* [ ]	The person’s identity and role are verified.
* [ ]	Image dimensions and compression are appropriate.
* [ ]	Alternative text is suitable.
* [ ]	Responsive rendering has been tested.
* [ ]	Application references are correct.
* [ ]	Existing website styling and animations remain unchanged.

15. Maintenance and Version Control

When adding, replacing, or removing team images:

1. Inspect the existing directory and application references.
2. Verify the image and associated professional information.
3. Confirm that publication permissions remain appropriate.
4. Preserve established filenames unless a migration is required.
5. Update the asset catalogue and documentation.
6. Test responsive rendering and accessibility.
7. Verify production paths.
8. Remove outdated assets only after confirming they are no longer referenced and retention requirements have been considered.

Routine image maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

16. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/images/services/ — Service-specific imagery.
* assets/images/placeholders/ — Generic fallback imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

17. Final Standard

The assets/images/team/ directory should contain approved, accurately represented, accessible, optimized, and appropriately licensed team imagery.

Future additions must be documented, verified, and tested before publication. All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.