MedOrbits Logo Assets

Directory: assets/images/logo/
Project: MedOrbits
Category: Brand Identity, Logos, and Symbol Variants
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.1.0

⸻

1. Purpose

The assets/images/logo/ directory contains the MedOrbits brand marks and logo variations used throughout the website and related digital materials.

These assets support:

* Website header and navigation
* Footer branding
* Compact mobile layouts
* Light and dark backgrounds
* Favicon and brand-symbol integration, where appropriate
* Promotional materials
* Social media and digital communication
* Brand identity across responsive interfaces

Use the appropriate logo variant for each context while maintaining consistent proportions, legibility, and brand recognition.

2. Current Directory Structure

The following inventory reflects the supplied directory screenshot.

assets/images/logo/
├── README.md
├── medorbits-logo-compact.svg
├── medorbits-logo-dark.svg
├── medorbits-logo-horizontal.svg
├── medorbits-logo-light.svg
├── medorbits-logo.png
├── medorbits-logo.svg
└── medorbits-symbol.svg

Current asset catalogue

Filename	Observed size	Intended use
medorbits-logo-compact.svg	386 bytes	Compact logo or reduced-space placement
medorbits-logo-dark.svg	637 bytes	Logo variant intended for light backgrounds
medorbits-logo-horizontal.svg	637 bytes	Horizontal logo placement
medorbits-logo-light.svg	637 bytes	Logo variant intended for dark backgrounds
medorbits-logo.png	2.2 MB	Existing raster logo; inspect before production use
medorbits-logo.svg	632 bytes	General-purpose SVG logo
medorbits-symbol.svg	386 bytes	Compact brand symbol

File sizes are approximate and may change after optimization or replacement.

The screenshot confirms filenames and approximate sizes. It does not independently verify the artwork, colour values, transparency, dimensions, or suitability for each background.

Important: Keep the PNG and SVG assets until their visual equivalence and application references have been verified. Do not assume they are interchangeable simply because their filenames are similar.

3. Brand and Visual Direction

The logo assets must complement the established MedOrbits visual identity.

Brand palette

* Royal Burgundy: #6B1838
* Champagne Gold: #C9A66B
* Warm Cream: #F6EDDD

Use approved logo artwork and existing brand colour tokens.

Logo variations should preserve:

* Original proportions
* Consistent spacing and alignment
* Legible lettering
* Recognizable brand symbolism
* Appropriate contrast against the background
* Consistent visual quality at different sizes

Do not stretch, distort, recolour, or add effects to an approved logo without authorization.

4. Logo Variant Guidelines

medorbits-logo.svg

Purpose: General-purpose logo asset.

Use when a standard MedOrbits logo is needed and the existing design is compatible with the intended background.

medorbits-logo-horizontal.svg

Purpose: Horizontal logo placement.

Potential uses include the website header, navigation, and other wide layouts. Verify the actual artwork and proportions before selecting it for a particular component.

medorbits-logo-compact.svg

Purpose: Compact logo presentation.

Consider it for narrow headers or other space-constrained placements when the actual artwork remains recognizable at the required size.

medorbits-logo-dark.svg

Purpose: Logo variant intended for light backgrounds.

Verify the SVG colours and contrast before using it on a light surface.

medorbits-logo-light.svg

Purpose: Logo variant intended for dark backgrounds.

Verify the artwork against the background before production use.

medorbits-symbol.svg

Purpose: Standalone brand symbol.

Potential uses include compact brand placements and other approved contexts where the symbol remains identifiable without the full wordmark.

medorbits-logo.png

Purpose: Existing raster logo asset.

Inspect its dimensions, transparency, visual quality, and current references. If an equivalent approved SVG is suitable, consider the SVG for scalable display. Do not replace or delete the PNG until its existing usage has been checked.

5. Naming Conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Prefer SVG for scalable logo artwork.
* Use PNG when raster transparency or compatibility is required.
* Keep filenames stable after production references are established.
* Avoid unclear suffixes such as final, new, latest, or final-2.
* Check existing assets before creating duplicates.
* Update this README when the approved inventory changes.

Before renaming or removing a logo, inspect its references in HTML, CSS, JavaScript, JSON, manifests, and other application configuration.

6. Recommended Logo Integration

The following example illustrates a standard logo reference. Adapt it to the existing header and deployment configuration.

<a href=“/“ aria-label=“MedOrbits home”>
  <img
    src=“/assets/images/logo/medorbits-logo-horizontal.svg”
    alt=“MedOrbits”
    width=“220”
    height=“60”
  >
</a>

The dimensions are illustrative, not verified specifications for the existing SVG. Confirm the artwork’s aspect ratio and intended display size before using these values.

For a purely decorative logo inside a link that already has an accessible name, an empty alt attribute may be appropriate. For a standalone logo, provide a meaningful accessible name.

Do not introduce a new header or change the existing header’s dimensions simply to accommodate a different logo variant.

7. Responsive Behaviour

Logo assets must remain legible across mobile phones, tablets, laptops, and desktop displays.

Recommended practices:

* Preserve the source aspect ratio.
* Use responsive width constraints.
* Avoid fixed dimensions that distort the artwork.
* Ensure the logo does not cause horizontal overflow.
* Maintain adequate space around the logo.
* Test visibility against both light and dark surfaces.
* Preserve existing header and navigation breakpoints.

Example CSS:

.site-logo {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}

This is an illustrative rule. Adapt it to the existing logo component and stylesheet rather than overriding established layout behaviour.

8. Accessibility and Performance

* Use meaningful accessible names for linked logos.
* Maintain sufficient contrast against the background.
* Keep the logo’s original proportions.
* Avoid unnecessary animation or visual effects.
* Ensure the logo remains recognizable at small sizes.
* Use optimized SVG artwork where appropriate.
* Remove unnecessary SVG metadata when safe.
* Avoid unnecessary external references within SVG files.
* Prevent layout shifts by reserving appropriate display dimensions.

Do not use the logo image as the only way to communicate essential page information.

9. SVG and Raster Asset Quality

SVG assets

Check that each SVG:

* Contains valid SVG markup.
* Renders correctly in supported browsers.
* Has an appropriate viewBox.
* Preserves its intended colours and proportions.
* Scales without clipping.
* Avoids unnecessary embedded raster data or external dependencies.

PNG asset

Check that medorbits-logo.png:

* Opens correctly.
* Has sufficient resolution for its intended use.
* Has appropriate transparency or background treatment.
* Does not contain unintended whitespace or cropping.
* Is optimized where practical.

Do not overwrite approved brand artwork as part of routine file optimization.

10. Copyright and Brand Protection

Before publishing or modifying logo assets:

* Confirm that the artwork is approved for MedOrbits use.
* Preserve any applicable brand restrictions.
* Do not introduce unauthorized third-party marks.
* Do not imply partnerships or endorsements through logo combinations.
* Keep editable source artwork where available.
* Record important brand changes and approvals.

Use approved artwork consistently across the website and marketing materials.

11. Quality Assurance Checklist

File integrity

* [ ]	Each documented logo file exists.
* [ ]	SVG files render correctly.
* [ ]	The PNG file opens correctly.
* [ ]	File extensions match the actual formats.
* [ ]	Production references point to the correct files.

Visual quality

* [ ]	The correct logo variant is used for each background.
* [ ]	Logo proportions are preserved.
* [ ]	The brand palette is consistent.
* [ ]	The logo remains legible at the intended size.
* [ ]	Mobile and desktop displays have been tested.

Accessibility and performance

* [ ]	Accessible naming is appropriate.
* [ ]	Background contrast is sufficient.
* [ ]	Image dimensions are suitable for the component.
* [ ]	SVG files are optimized where practical.
* [ ]	Avoidable layout shifts are prevented.

Website consistency

* [ ]	Existing header and navigation behaviour are preserved.
* [ ]	Footer branding remains consistent.
* [ ]	Opening animation is unchanged.
* [ ]	Existing page layouts and responsive breakpoints are preserved.
* [ ]	No unrelated global styling has been changed.

12. Adding More Logo Assets in the Future

This directory is designed to accommodate additional approved logo variants as the MedOrbits brand develops.

12.1 Addition workflow

1. Obtain or create the approved brand artwork.
2. Save the new asset in assets/images/logo/.
3. Choose a descriptive lowercase filename using hyphens.
4. Prefer SVG for scalable vector logos.
5. Use PNG when raster transparency or compatibility is required.
6. Verify colours, proportions, dimensions, and background suitability.
7. Add the filename and intended use to the asset catalogue.
8. Update the relevant application references.
9. Test the asset at its intended display sizes.
10. Update this README when the approved inventory changes.

12.2 Future asset inventory

Use this table to record additional approved logo assets.

Filename	Intended use	Format	Status
example-logo-variant.svg	Describe the approved logo variant	SVG	Proposed

Replace the example row with actual filenames when the files are created. Proposed entries do not confirm that files exist.

12.3 Suggested future assets

Potential additions include:

* medorbits-logo-square.svg — Square logo layout, if approved
* medorbits-logo-monochrome.svg — Single-colour logo, if approved
* medorbits-favicon.svg — Browser icon artwork, if appropriate
* medorbits-logo-print.svg — Print-oriented vector artwork, if required
* medorbits-logo-social.png — Social media use, if a raster export is needed

These are suggestions only. Confirm that each variant is needed and approved before creating it. Check the existing repository for equivalent assets first.

12.4 Final verification checklist

* [ ]	The new file exists at the documented path.
* [ ]	The artwork is approved.
* [ ]	The filename and format are correct.
* [ ]	Proportions and colours are preserved.
* [ ]	Background contrast has been tested.
* [ ]	Application references are correct.
* [ ]	Existing branding and website layout remain unchanged.

13. Maintenance and Version Control

When adding, replacing, or removing logo assets:

1. Inspect the current directory and all relevant references.
2. Compare duplicate or alternative formats before making changes.
3. Preserve established filenames unless a migration is required.
4. Confirm that the replacement artwork is approved.
5. Update the asset catalogue and documentation.
6. Test logo rendering across supported screen sizes and backgrounds.
7. Verify deployed asset paths.
8. Remove obsolete files only after confirming they are no longer referenced.

Routine logo maintenance must not alter the opening animation, header, footer, global typography, responsive breakpoints, or overall colour theme.

14. Related Directories

Potentially related locations include:

* assets/images/ — Shared image library.
* assets/images/hero/ — Hero and landing-page imagery.
* assets/icons/ — Interface and category icons.
* assets/icons/social/ — Social media icons, if present.
* assets/ — Other brand resources, subject to the existing project structure.

Verify each directory before referencing it. These locations describe potential relationships and do not confirm that every directory exists.

15. Final Standard

The assets/images/logo/ directory should contain approved, scalable, accessible, and visually consistent MedOrbits brand assets.

The seven existing logo files should remain documented until their intended uses and application references have been verified. Future additions must be approved, catalogued, and tested before production use.

All changes must preserve the existing website architecture, header, footer, opening animation, responsive behaviour, and Royal Burgundy and Champagne Gold design system.

End of document.