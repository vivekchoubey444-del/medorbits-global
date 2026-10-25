
# MedOrbits — Fonts Directory

**Directory:** `/assets/fonts/fonts/`  
**Project:** MedOrbits  
**Purpose:** Manage locally hosted font files and their associated licensing documentation.  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `/assets/fonts/fonts/` directory contains font assets used by the MedOrbits website.

This directory currently includes two font families:

- **DM Sans** — for body text, navigation, forms, buttons, and interface content.
- **Playfair Display** — for headings, page titles, and selected editorial elements.

This README documents the existing font files, their intended use, licensing requirements, and maintenance procedures.

**Important:** Font files shown in this README are based on the supplied directory screenshot. Their licence terms must be verified separately.

—

## 2. Actual Directory Structure

```text
assets/
└── fonts/
    └── fonts/
        ├── README.md
        ├── DMSans-Bold.ttf
        ├── DMSans-Medium.ttf
        ├── DMSans-Regular.ttf
        ├── DMSans-SemiBold.ttf
        ├── PlayfairDisplay-Bold.ttf
        ├── PlayfairDisplay-Medium.ttf
        └── PlayfairDisplay-SemiBold.ttf
```

Keep the existing filenames unchanged unless a deliberate migration is required.

Do not add example font files or rename existing files solely to match a generic naming convention.

—

## 3. Existing Font Inventory

| Font file | Family | Weight | CSS weight |
|—|—|—|—:|
| `DMSans-Regular.ttf` | DM Sans | Regular | 400 |
| `DMSans-Medium.ttf` | DM Sans | Medium | 500 |
| `DMSans-SemiBold.ttf` | DM Sans | Semibold | 600 |
| `DMSans-Bold.ttf` | DM Sans | Bold | 700 |
| `PlayfairDisplay-Medium.ttf` | Playfair Display | Medium | 500 |
| `PlayfairDisplay-SemiBold.ttf` | Playfair Display | Semibold | 600 |
| `PlayfairDisplay-Bold.ttf` | Playfair Display | Bold | 700 |

The weight assignments above follow the filenames. Verify the font metadata if exact weight information is required.

No separate italic font files are shown in the supplied directory listing.

—

## 4. Font Usage

### DM Sans

Use DM Sans for:

- Body paragraphs and educational articles.
- Navigation and menus.
- Buttons and form controls.
- Tables and application forms.
- Course descriptions and admission guidance.
- Healthcare and career information.
- Dashboard labels and interface messages.

### Playfair Display

Use Playfair Display selectively for:

- Main page headings.
- Prominent section titles.
- Editorial headings.
- Selected promotional headings.
- Brand-aligned display text.

Avoid using Playfair Display for dense tables, small form labels, or lengthy instructional content where readability is more important than decorative styling.

—

## 5. CSS Integration

The following example references the existing filenames.

```css
@font-face {
  font-family: “DM Sans”;
  src: url(“/assets/fonts/fonts/DMSans-Regular.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: “DM Sans”;
  src: url(“/assets/fonts/fonts/DMSans-Medium.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: “DM Sans”;
  src: url(“/assets/fonts/fonts/DMSans-SemiBold.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: “DM Sans”;
  src: url(“/assets/fonts/fonts/DMSans-Bold.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

@font-face {
  font-family: “Playfair Display”;
  src: url(“/assets/fonts/fonts/PlayfairDisplay-Medium.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: “Playfair Display”;
  src: url(“/assets/fonts/fonts/PlayfairDisplay-SemiBold.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}

@font-face {
  font-family: “Playfair Display”;
  src: url(“/assets/fonts/fonts/PlayfairDisplay-Bold.ttf”)
    format(“truetype”);
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

:root {
  —font-body: “DM Sans”, Arial, sans-serif;
  —font-heading: “Playfair Display”, Georgia, serif;
}

body {
  font-family: var(—font-body);
  font-weight: 400;
  line-height: 1.65;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: var(—font-heading);
}

button,
input,
select,
textarea {
  font-family: var(—font-body);
}
```

**Path requirement:** These URLs assume the deployed website serves assets from the domain root and that the actual files are available at `/assets/fonts/fonts/`. Adjust the paths if the deployment uses a different structure.

—

## 6. Font Licensing and Attribution

Every font must be used according to its applicable licence.

Before deploying or redistributing a font, verify:

1. The original font family and creator.
2. The official source from which the font was obtained.
3. The applicable licence and copyright notice.
4. Whether commercial website use is permitted.
5. Whether self-hosting and web embedding are permitted.
6. Whether redistribution in a public repository is permitted.
7. Whether modification, conversion, or subsetting is permitted.
8. Any attribution or notice requirements.

Do not assume that a font is unrestricted merely because it is available for free download.

Retain the original licence files or copyright notices where required. Do not remove licence information when optimizing or converting font assets.

### Licensing status

The supplied directory screenshot confirms the listed filenames, but it does not establish their licensing status.

**Before production deployment, verify the licences for both DM Sans and Playfair Display.**

—

## 7. Licensing Documentation

If licensing records are maintained separately, use a structure such as:

```text
assets/
└── fonts/
    └── fonts/
        ├── README.md
        ├── DMSans-Bold.ttf
        ├── DMSans-Medium.ttf
        ├── DMSans-Regular.ttf
        ├── DMSans-SemiBold.ttf
        ├── PlayfairDisplay-Bold.ttf
        ├── PlayfairDisplay-Medium.ttf
        ├── PlayfairDisplay-SemiBold.ttf
        └── licenses/
            └── FONT-LICENSES.md
```

This is an optional extension. Create the `licenses/` directory and its files only when needed.

The licence record should identify:

- Font family.
- Source or provider.
- Font version, where available.
- Licence name.
- Location of the original licence document.
- Permitted use and redistribution conditions.
- Required attribution.
- Date of licence verification.

Do not invent licence details. Record only information supported by the actual licence documentation.

—

## 8. Performance and Maintenance

- Load only the font weights used by the website.
- Use `font-display: swap` to keep text visible while fonts load.
- Avoid duplicate font declarations across stylesheets.
- Keep font paths consistent across pages.
- Consider WOFF2 conversion only after checking the licence and testing the converted files.
- Retain the existing TTF files until all dependencies have been checked.
- Use browser caching appropriately for static font assets.
- Test font loading on mobile and desktop devices.
- Provide suitable fallback fonts.
- Verify that translated text renders correctly.

Do not preload every font file. Preload only a confirmed critical font that is needed for the initial page rendering.

—

## 9. Accessibility and Language Support

- Maintain readable text sizes and sufficient colour contrast.
- Use DM Sans for long-form body content and interface text.
- Preserve a clear heading hierarchy.
- Ensure forms, buttons, navigation, and validation messages remain readable.
- Provide fallback fonts if a custom font fails to load.
- Test the characters and writing systems required by the website.
- Verify support for Hindi, Bengali, Nepali, and other required languages before relying on these font files for multilingual content.
- Add appropriately licensed fonts when additional glyph coverage is required.

Do not assume that the current font files contain every character required by all supported languages.

—

## 10. Troubleshooting

### Font does not load

Check the file path, filename capitalization, CSS declaration, server response, and browser network errors.

### Incorrect font weight appears

Confirm that the correct font file is registered with the intended `font-weight`.

### Text uses a fallback font

Inspect the computed CSS, font loading status, and browser console.

### Font works locally but fails after deployment

Check static asset routing, case-sensitive filenames, build output, caching, and deployed file paths.

### Font licence is missing or unclear

Verify the original source and applicable licence before production use or redistribution.

—

## 11. Maintenance Checklist

Before merging or deploying changes:

- [ ] All referenced font files exist.
- [ ] Existing filenames are preserved or all dependencies are updated.
- [ ] CSS paths match the actual directory structure.
- [ ] Font families, weights, and styles are declared correctly.
- [ ] Both font families have verified licensing documentation.
- [ ] Required copyright notices and licence files are retained.
- [ ] No unauthorized font files are included.
- [ ] Font loading works in the deployed website.
- [ ] Fallback fonts are configured.
- [ ] Mobile and desktop typography has been tested.
- [ ] Required language coverage has been checked.
- [ ] Any conversion or optimization complies with the applicable licence.

—

## 12. Final Standard

The `/assets/fonts/fonts/` directory must contain only authorized, correctly referenced, documented, and actively used font assets.

**Core principle:** Maintain the existing DM Sans and Playfair Display files, verify their licensing, and keep all website font declarations consistent with the actual files in the repository.

**Verification note:** This README documents the font files visible in the supplied screenshot. It does not independently verify the contents, origin, or licensing of those files.
