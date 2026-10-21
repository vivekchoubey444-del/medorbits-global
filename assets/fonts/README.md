MedOrbits Fonts

Brand: MedOrbits
Design System: Royal Burgundy and Champagne Gold
Package: Local Web Font Assets
Version: 1.2.0

1. Overview

The MedOrbits Fonts package provides locally hosted typography assets for the MedOrbits website and related web applications.

The typography system uses two complementary font families:

* DM Sans: Body text, navigation, forms, buttons, labels, dashboards, tables, and interface elements.
* Playfair Display: Editorial headings, premium display text, promotional banners, and selected branding elements.

The font assets must integrate with the existing MedOrbits design system without changing its colors, page layouts, opening animations, header, footer, or responsive behavior.

2. Asset Directory Structure

The package may contain existing TrueType (.ttf) files and generated Web Open Font Format 2 (.woff2) files. Confirm the actual repository structure before running scripts or changing CSS paths.

Example source assets:

fonts/
├── DMSans-Regular.ttf
├── DMSans-Medium.ttf
├── DMSans-SemiBold.ttf
├── DMSans-Bold.ttf
├── PlayfairDisplay-Medium.ttf
├── PlayfairDisplay-SemiBold.ttf
└── PlayfairDisplay-Bold.ttf

Recommended production WOFF2 assets:

fonts/
├── dm-sans-regular.woff2
├── dm-sans-medium.woff2
├── dm-sans-semibold.woff2
├── dm-sans-bold.woff2
├── playfair-display-medium.woff2
├── playfair-display-semibold.woff2
├── playfair-display-bold.woff2
└── font-manifest.json

These are intended filenames, not confirmation that the files currently exist.

3. Font Inventory

File	Family	CSS Weight
DMSans-Regular.ttf / dm-sans-regular.woff2	DM Sans	400
DMSans-Medium.ttf / dm-sans-medium.woff2	DM Sans	500
DMSans-SemiBold.ttf / dm-sans-semibold.woff2	DM Sans	600
DMSans-Bold.ttf / dm-sans-bold.woff2	DM Sans	700
PlayfairDisplay-Medium.ttf / playfair-display-medium.woff2	Playfair Display	500
PlayfairDisplay-SemiBold.ttf / playfair-display-semibold.woff2	Playfair Display	600
PlayfairDisplay-Bold.ttf / playfair-display-bold.woff2	Playfair Display	700

These are intended weight mappings. Verify the internal font metadata before production deployment. Filenames alone do not prove a font’s family, weight, format, or character coverage.

4. Requirements

The download script requires:

* Bash
* curl
* Python 3
* Internet access to the configured font provider

Once the font files are included in the deployed application, normal page rendering should use local assets and should not need to download fonts during application startup.

5. Installation and Generation

If the script is located at assets/fonts/download-fonts.sh, run this command from the repository root:

bash assets/fonts/download-fonts.sh

If the script is at the repository root, run:

bash download-fonts.sh

To make the script executable:

chmod +x assets/fonts/download-fonts.sh
./assets/fonts/download-fonts.sh

Use the command matching the actual script location.

Format warning: A downloader that creates WOFF2 files may produce additional files alongside existing TTF assets. It should not delete or overwrite TTF originals unless that behavior is explicitly intended.

Never rename a .ttf file to .woff2. Obtain an actual WOFF2 resource or convert the font with an appropriate font-conversion tool.

6. Recommended Web Font Format

Prefer WOFF2 for production web delivery where supported. It is designed for web use and generally provides smaller downloads than equivalent TTF files.

Keep TTF files only when required as source assets or by another documented workflow. Avoid shipping duplicate formats to browsers unnecessarily.

7. CSS Integration

The following example assumes that the stylesheet is at the repository root and the WOFF2 files are in fonts/. Adjust paths to match the actual stylesheet location and deployment base path.

DM Sans — interface and body

@font-face {
  font-family: “DM Sans”;
  src: url(“./fonts/dm-sans-regular.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: “DM Sans”;
  src: url(“./fonts/dm-sans-medium.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: “DM Sans”;
  src: url(“./fonts/dm-sans-semibold.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: “DM Sans”;
  src: url(“./fonts/dm-sans-bold.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

Playfair Display — premium headings

@font-face {
  font-family: “Playfair Display”;
  src: url(“./fonts/playfair-display-medium.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}
@font-face {
  font-family: “Playfair Display”;
  src: url(“./fonts/playfair-display-semibold.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: “Playfair Display”;
  src: url(“./fonts/playfair-display-bold.woff2”) format(“woff2”);
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

If using TTF assets directly, change the URLs to the real .ttf filenames and use format(“truetype”). Do not declare TTF files as WOFF2.

Typography tokens

Merge these tokens into the existing MedOrbits CSS variables. Do not replace the current design system or its other tokens.

:root {
  —font-body: “DM Sans”, Arial, sans-serif;
  —font-heading: “Playfair Display”, Georgia, serif;
}
body,
button,
input,
select,
textarea {
  font-family: var(—font-body);
}
h1,
h2,
h3,
.display-heading {
  font-family: var(—font-heading);
}

Integrate these selectors with existing component-specific font rules. Avoid broad overrides that change intentionally customized typography.

8. Brand Usage

DM Sans

Use for:

* Body copy and paragraphs
* Navigation and breadcrumbs
* Forms, labels, and input controls
* Buttons and calls to action
* Course listings and fee tables
* Dashboards and interface components

Playfair Display

Use for:

* Main page headings
* Editorial titles
* Selected premium promotional banners
* Admissions and study-abroad headings
* Emphasized display text

Maintain readable line heights, responsive font sizes, and consistent spacing across desktop, tablet, and mobile.

9. Performance and Deployment

Before deployment:

1. Confirm all seven intended font assets exist.
2. Validate file signatures and internal font metadata.
3. Verify each asset’s family and weight.
4. Check CSS paths and browser network requests.
5. Keep runtime font assets local to the application.
6. Use font-display: swap.
7. Preload only fonts needed for initial rendering.
8. Configure caching for versioned static assets.
9. Include font assets in the deployment package.
10. Preserve existing colors, layouts, animations, header, footer, and responsive behavior.
11. Avoid downloading fonts on every application startup.

Preload example, only if the font is needed for initial rendering:

<link
  rel=“preload”
  href=“/fonts/dm-sans-regular.woff2”
  as=“font”
  type=“font/woff2”
  crossorigin
/>

Ensure the preload URL matches the actual deployed asset path. Unnecessary preloads can compete with more important resources.

10. Font Manifest

If generated, fonts/font-manifest.json should list the actual installed files and include:

* Filename and path
* Font family and weight
* Format and byte size
* SHA-256 checksum
* Manifest schema version
* Generation timestamp

Generate the manifest from validated files. Do not claim an asset exists merely because it appears in a configuration list.

11. Licensing and Attribution

DM Sans and Playfair Display are distributed as open-source font families through Google Fonts. Before redistributing assets, obtain and verify the applicable upstream license and copyright notices for the actual files used.

Recommended license directory:

LICENSES/
├── OFL-DM-Sans.txt
└── OFL-Playfair-Display.txt

Include these files only after obtaining and verifying the correct license text. Record the source and version of each font asset where available.

12. Quality Assurance

* [ ]	All seven intended font assets are present.
* [ ]	File signatures match their extensions.
* [ ]	Internal metadata matches the intended family and weight.
* [ ]	Required character sets render correctly.
* [ ]	CSS paths resolve successfully.
* [ ]	Fonts load without browser console errors.
* [ ]	Body text uses DM Sans.
* [ ]	Headings use Playfair Display.
* [ ]	Desktop and mobile layouts remain readable.
* [ ]	Existing colors, layouts, animations, header, and footer remain unchanged.
* [ ]	Applicable license files are included and verified.
* [ ]	Production assets are version-controlled.

13. Troubleshooting

Fonts do not load: Check CSS paths, filename casing, deployment base paths, MIME types, and browser network errors.

Fonts appear too bold or too light: Verify the internal font weight and matching CSS font-weight.

Characters are missing: Check the font’s supported character set and Unicode coverage.

Downloads fail: Check network connectivity, provider responses, proxy settings, and retry logs.

Duplicate font files appear: Check whether the downloader writes to a different directory or generates a different format from the existing assets.

Manifest validation fails: Confirm every listed file exists, has the expected signature, and matches the manifest generation logic.

14. Maintenance

Update this README, the CSS declarations, manifest, and inventory whenever assets change. Test affected pages after each update to ensure typography, responsive layouts, and existing branding remain intact.

⸻

MedOrbits Fonts
Royal Burgundy and Champagne Gold Design System