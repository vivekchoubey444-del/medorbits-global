MedOrbits Leadership Images

Directory: assets/images/team/leadership/
Project: MedOrbits
Category: Leadership Portraits and Executive Team Imagery
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.0.0

⸻

1. Purpose

The assets/images/team/leadership/ directory is intended for approved images of MedOrbits’ verified leadership team and authorized organizational representatives.

These images may be used for:

* Leadership profile cards
* About Us and Our Team pages
* Founder and director profiles
* Executive biographies
* Organizational introductions
* Approved leadership announcements
* Company presentations and digital materials
* Future leadership-related website sections

Every image must accurately represent the person and their verified role within the organization. Do not use stock photographs or placeholder portraits to imply that a person is a real MedOrbits leader.

2. Recommended Directory Structure

Verify the current repository before creating, renaming, or replacing files. The following structure is recommended, not a confirmed inventory of existing assets.

assets/images/team/leadership/
├── README.md
├── leadership-placeholder.svg
└── example-leader.jpg

The example image filenames are proposed only. Create them when the corresponding assets are required and approved.

For a small leadership team, approved images may be stored directly in this directory without additional subdirectories.

3. Asset Catalogue

Maintain an inventory of approved leadership images as they are added.

Filename	Intended use	Status
leadership-placeholder.svg	Generic fallback for an unavailable leadership portrait	Proposed
example-leader.jpg	Example leadership portrait	Proposed

These entries do not confirm that the files currently exist. Replace the examples with actual filenames after the assets have been created and verified.

Avoid including private contact information, identity numbers, or other sensitive personal details in filenames or public metadata.

4. Brand and Visual Direction

Leadership imagery should complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use the existing brand colours, typography, backgrounds, and component styles.

Recommended image characteristics:

* Professional and credible presentation
* Consistent portrait framing
* Natural lighting and balanced composition
* Clear visibility of the subject
* Suitable resolution for the intended display size
* Compatibility with mobile and desktop layouts
* Consistency with the premium MedOrbits design system

Avoid excessive filters, artificial facial alterations, distracting backgrounds, and unauthorized third-party branding.

Do not introduce a separate visual theme for leadership pages.

5. Image Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer JPG for optimized photographic portraits.
* Use SVG for simple placeholder illustrations.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.
* Avoid unnecessary personal information in filenames.

Use a consistent naming convention approved for the project. If names are included in filenames, ensure publication is appropriate under the project’s privacy practices.

Before renaming or removing an asset, inspect references in HTML, CSS, JavaScript, JSON, and other application configuration.

6. Recommended Image Dimensions

Use the existing leadership components as the primary reference.

Placement	Suggested aspect ratio	Example dimensions
Leadership profile card	1:1	800 × 800 px
Detailed executive profile	3:4	900 × 1200 px
Leadership team banner	16:9	1600 × 900 px
Small profile thumbnail	1:1	320 × 320 px

These are suggestions, not mandatory specifications.

Requirements:

* Preserve the original aspect ratio.
* Maintain consistent cropping across comparable profiles.
* Position the subject appropriately within the frame.
* Avoid stretching or distortion.
* Optimize resolution for the intended display size.
* Test cropping on mobile and desktop layouts.

7. Recommended HTML Integration

The following example illustrates how an approved leadership portrait may be referenced.

<img
  src=“/assets/images/team/leadership/example-leader.jpg”
  alt=“Name of the leadership team member”
  width=“800”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

Replace the example filename and alternative text with verified information. Do not reference this file in production until the image exists.

Use meaningful alternative text when the portrait conveys relevant information. If the portrait is decorative and adjacent content already identifies the person, an empty alt attribute may be appropriate.

Adapt the asset path to the existing deployment configuration.

8. Identity, Role, and Consent

Leadership imagery can imply organizational authority and official representation. Verify all associated information before publication.

Before publishing an image:

* Verify the person’s identity.
* Confirm their current leadership role and relationship with MedOrbits.
* Verify titles, credentials, and professional affiliations.
* Obtain appropriate permission or consent for publication.
* Confirm approval for the intended website or marketing use.
* Ensure accompanying biographies are accurate and current.
* Avoid publishing private contact details or sensitive personal information.
* Respect applicable privacy, licensing, and removal requirements.

Do not imply that someone is a founder, director, executive, owner, or official representative without verification.

Do not fabricate leadership positions, qualifications, biographies, endorsements, or affiliations.

9. Accessibility

* Provide appropriate alternative text for informative portraits.
* Avoid unnecessarily repeating adjacent accessible names.
* Maintain sufficient contrast for names and profile descriptions.
* Keep essential biographical information in HTML text.
* Preserve keyboard navigation and visible focus indicators.
* Ensure leadership cards remain usable on small screens.
* Do not rely on appearance alone to communicate a person’s role.

If a portrait is unavailable, use an appropriate fallback while keeping the person’s verified name and role accessible.

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

When a leadership portrait is unavailable:

1. Use a verified generic placeholder.
2. Preserve the profile component’s dimensions.
3. Keep the person’s verified name and role visible.
4. Avoid broken-image indicators where practical.
5. Ensure the placeholder does not imply a real person’s identity.
6. Verify that the fallback file exists.
7. Reuse the application’s existing image-error handling where available.

A placeholder must never be presented as a photograph of an actual leadership team member.

12. Copyright and Licensing

Before publishing or replacing leadership images:

* Verify ownership or permission to use the asset.
* Confirm commercial-use and modification rights.
* Obtain appropriate consent for identifiable individuals.
* Respect photographer and licensing conditions.
* Avoid unauthorized third-party logos.
* Do not use another organization’s leadership photographs to represent MedOrbits.
* Maintain source and licensing records where appropriate.

Stock imagery may be used for decorative purposes only when properly licensed. It must not falsely represent actual MedOrbits leadership.

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

* [ ]	Identity and leadership role are verified.
* [ ]	Biographies and credentials are accurate.
* [ ]	Publication permission is confirmed where required.
* [ ]	Licensing requirements are satisfied.
* [ ]	No unnecessary sensitive information is exposed.

14. Adding More Leadership Images in the Future

This directory is designed to accommodate additional approved leadership portraits as MedOrbits grows.

14.1 Addition workflow

1. Obtain the approved portrait.
2. Verify the person’s identity and leadership role.
3. Confirm permission for publication.
4. Save the image in assets/images/team/leadership/.
5. Choose a descriptive lowercase filename.
6. Optimize the image for its intended display size.
7. Add the filename and intended use to the asset catalogue.
8. Update the relevant application references.
9. Test responsive rendering, accessibility, and loading performance.
10. Update this README when the approved inventory changes.

14.2 Future asset inventory

Use this table to document additional approved images.

Filename	Intended use	Format	Status
example-leader-portrait.jpg	Approved leadership profile	JPG	Proposed

Replace the example row with actual filenames after the files have been created. Proposed entries do not confirm that files exist.

14.3 Suggested future assets

Potential additions include:

* founder-portrait.jpg — Approved founder portrait
* director-portrait.jpg — Approved director portrait
* executive-team.jpg — Approved leadership group photograph
* leadership-placeholder.svg — Generic portrait fallback

These are suggestions only. Create them when the corresponding people, roles, content, and publication permissions have been verified.

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

When adding, replacing, or removing leadership images:

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
* assets/images/team/counsellors/ — Counsellor portraits, if present.
* assets/images/placeholders/ — General fallback imagery.
* assets/images/services/ — Service-specific imagery.
* assets/icons/ — Interface and category icons.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

17. Final Standard

The assets/images/team/leadership/ directory should contain approved, accurately represented, accessible, optimized, and appropriately licensed leadership imagery.

Future additions must be documented, verified, and tested before publication. All changes must preserve the existing website architecture, page layouts, opening animation, header, footer, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.