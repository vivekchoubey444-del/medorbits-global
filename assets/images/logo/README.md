MedOrbits Logo Assets — Complete README.md

Canonical directory: /assets/images/logo/ Project: MedOrbits Document version: 2.0.0 Last updated: 2026-10-24 Document type: Technical asset documentation Maintainer: MedOrbits Project

1. Overview

The /assets/images/logo/ directory contains approved MedOrbits brand marks used across the website, application interface, navigation, authentication pages, browser icons, and other digital properties.

This README establishes standards for:

* Asset organization and naming.
* Primary logo and monogram management.
* SVG, PNG, WebP, and favicon formats.
* HTML and CSS integration.
* Accessibility and responsive display.
* Brand consistency and approval.
* Security and licensing.
* Performance and caching.
* Testing, publishing, maintenance, and version control.

Existing project assets: The supplied directory screenshot shows medorbits-logo.svg, medorbits-monogram.svg, and README.md. These filenames should remain unchanged unless a deliberate migration has been planned and all project references have been reviewed.

The other filenames described below are recommended options, not confirmation that those assets already exist.

2. Canonical Directory Structure

Recommended directory structure:

MedOrbits/ └── assets/ └── images/ └── logo/ ├── README.md ├── medorbits-logo.svg ├── medorbits-monogram.svg ├── medorbits-logo-primary.svg ├── medorbits-logo-horizontal.svg ├── medorbits-logo-light.svg ├── medorbits-logo-dark.svg ├── medorbits-logo-stacked.svg ├── medorbits-favicon.svg ├── medorbits-favicon.png ├── medorbits-app-icon.png └── archive/ └── README.md

Only add files that are actually needed and approved. Do not create empty placeholders or duplicate logos simply to match the proposed structure.

Directory responsibilities

* README.md: Documents logo usage and asset-management rules.
* medorbits-logo.svg: Existing logo filename shown in the supplied screenshot.
* medorbits-monogram.svg: Existing compact brand-mark filename shown in the screenshot.
* medorbits-logo-primary.svg: Optional explicitly named primary logo.
* medorbits-logo-horizontal.svg: Optional horizontal lockup.
* medorbits-logo-light.svg: Optional variant for dark backgrounds.
* medorbits-logo-dark.svg: Optional variant for light backgrounds.
* medorbits-logo-stacked.svg: Optional vertically arranged logo.
* medorbits-favicon.svg: Optional vector favicon.
* medorbits-favicon.png: Optional raster favicon.
* medorbits-app-icon.png: Optional application icon.
* archive/: Retired assets retained only when historical reference is necessary.

3. Asset Inventory and Documentation

Maintain an inventory of the approved assets. For each asset, record its filename, purpose, format, dimensions or viewBox, approval status, source, and relevant licensing information.

Recommended inventory fields:

* Asset filename.
* Asset type.
* Intended use.
* File format.
* Intrinsic dimensions or SVG viewBox.
* Background compatibility.
* Approval status.
* Source or creator.
* License or usage restrictions.
* Date introduced.
* Replacement or retirement notes.

Example inventory entry:

Filename: medorbits-logo.svg Asset type: Primary logo candidate Format: SVG Purpose: Website branding Approval status: Verify before production use Source: Existing project asset Dimensions: Inspect the actual SVG Background compatibility: Verify against the artwork Usage restrictions: Follow the approved MedOrbits brand guidance

Do not infer approval, ownership, dimensions, or background compatibility from the filename alone.

4. Naming Convention

Use lowercase kebab-case for all logo filenames.

Recommended examples:

* medorbits-logo.svg
* medorbits-monogram.svg
* medorbits-logo-primary.svg
* medorbits-logo-horizontal.svg
* medorbits-logo-stacked.svg
* medorbits-logo-light.svg
* medorbits-logo-dark.svg
* medorbits-favicon.svg
* medorbits-favicon.png
* medorbits-app-icon.png

Naming rules

* Use descriptive names that explain the intended purpose.
* Avoid spaces, unnecessary punctuation, and inconsistent capitalization.
* Avoid ambiguous names such as logo-final.svg, logo-final2.svg, or new-logo-fixed.svg.
* Use variant suffixes only when the artwork genuinely differs.
* Do not use -light or -dark unless the artwork has been checked against the intended background.
* Do not rename an asset without checking its references.
* Do not change the extension without converting the underlying file.
* Keep the same naming convention throughout the repository.

File paths must match their actual names, including capitalization, because many production environments use case-sensitive filesystems.

5. Logo Types and Intended Use

5.1 Primary logo

The primary logo is the default MedOrbits brand representation.

Use it in:

* Main website navigation.
* Website footer.
* Login and registration interfaces.
* Application dashboards.
* Official digital documents where appropriate.
* Brand-related landing pages.

Use the approved artwork without modifying its proportions or colors.

5.2 Monogram

The monogram is a compact symbol or abbreviated brand mark.

Use it where the full logo would be too large or unreadable, such as:

* Compact mobile navigation.
* Small interface controls where a brand symbol is appropriate.
* Application icons, if the artwork is suitable.
* Small branded interface elements.

Do not assume the monogram is an official favicon or application icon without checking its design and approval status.

5.3 Horizontal logo

A horizontal logo combines the symbol and wordmark in a horizontal arrangement.

It may be appropriate for desktop headers, footers, and wide layout areas. Use it only if it is an approved, genuine variant.

5.4 Stacked logo

A stacked logo places the symbol and wordmark vertically.

It may be appropriate for narrow spaces, title pages, or branded promotional layouts. Avoid adding it if the existing logo already serves these purposes.

5.5 Light and dark variants

A light variant is designed for dark backgrounds, while a dark variant is designed for light backgrounds.

Confirm the actual artwork, brand colors, and contrast before using either variant. A filename alone does not guarantee readability.

6. Supported File Formats

SVG

Preferred for clean vector logos because it scales without the pixelation associated with raster images.

Advantages:

* Resolution-independent rendering.
* Often small file size for simple artwork.
* Easy scaling across screen sizes.
* Support for transparent backgrounds.

Requirements:

* Inspect the SVG source.
* Verify its dimensions and viewBox.
* Remove unexpected scripts and external references.
* Avoid unnecessary embedded resources.
* Test the artwork in supported browsers.

PNG

Use PNG when a raster asset is required, particularly for transparent backgrounds or platform compatibility.

Requirements:

* Export at suitable resolutions.
* Avoid unnecessary oversized files.
* Preserve transparency when required.
* Verify that the artwork remains sharp at its actual display size.

WebP

WebP can be useful for complex raster brand artwork, but SVG is generally preferable for simple vector marks.

Use WebP only when it provides a practical benefit and is supported by the target environments.

ICO

ICO may be needed for legacy favicon compatibility.

Create it from the approved brand mark and test it in the supported browsers. Do not rename a PNG or SVG file to .ico without performing a real conversion.

7. SVG Security Requirements

SVG files are XML-based and can contain more than static vector shapes. Review SVG files before publishing them.

Required review

* Inspect the XML structure.
* Verify that the visible artwork is expected.
* Remove scripts and event-handler attributes.
* Check for embedded foreignObject content.
* Check for unexpected external URLs and resource dependencies.
* Avoid untrusted embedded data.
* Confirm that the file does not require unavailable external fonts or images.
* Validate the SVG in the browsers used by the project.
* Keep the original source in an appropriately controlled location if required.
* Record any sanitization or optimization performed.

Do not insert untrusted SVG source directly into HTML. Treat uploaded SVG files as untrusted until they have been reviewed.

8. Brand Integrity and Visual Standards

All published logos must follow the approved MedOrbits visual identity.

Required standards

* Preserve the approved aspect ratio.
* Maintain the original logo proportions.
* Do not stretch, skew, rotate, or distort the artwork.
* Do not alter brand colors without authorization.
* Maintain sufficient clear space around the logo.
* Do not crop important parts of the artwork.
* Use a suitable variant for the background.
* Avoid unnecessary visual effects.
* Do not combine the logo with misleading symbols or text.
* Do not imply unauthorized affiliation with another organization.

Background compatibility

Test the logo against the actual interface background.

Check:

* Header backgrounds.
* Footer backgrounds.
* Navigation overlays.
* Login and registration cards.
* Mobile menus.
* Promotional banners.
* Dark and light interface themes.

For MedOrbits pages that use premium tinted backgrounds, ensure the logo remains clearly visible against the actual palette. Do not assume that a logo intended for a plain background will work on every surface.

Clear space

Maintain enough surrounding space to keep the logo visually distinct from nearby text, controls, borders, and other graphics.

If formal brand guidelines specify a minimum clear-space measurement, follow that specification. Do not invent a mandatory measurement where no official standard exists.

9. HTML Integration

Use the existing approved file path wherever possible.

Example using the filename shown in the supplied screenshot:

The width and height above are illustrative. Replace them with values reflecting the actual asset dimensions.

Accessible naming

The link must have a meaningful accessible name.

When the image is the only content of the link, use either:

* Meaningful image alternative text, such as alt=“MedOrbits”, or
* An appropriately labelled link with a decorative image using alt=“”.

Avoid unnecessarily repeating the same accessible name.

Decorative logo

If the logo is decorative and the surrounding content already identifies the brand, an empty alternative text attribute may be appropriate.

Path requirements

Use the project’s established path convention.

Root-relative path:

/assets/images/logo/medorbits-logo.svg

Relative path example:

../assets/images/logo/medorbits-logo.svg

The correct relative path depends on the location of the HTML document. Do not copy the same relative path into every page without checking directory depth.

10. CSS Integration

Recommended baseline styles:

.mo-logo-link