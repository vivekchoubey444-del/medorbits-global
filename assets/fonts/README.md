
# MedOrbits — Fonts Directory

**Directory:** `/assets/fonts/`  
**Project:** MedOrbits  
**Purpose:** Manage, download, organize, and document web fonts used throughout the MedOrbits website.  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `/assets/fonts/` directory is the central location for font-related assets, font download utilities, typography documentation, and licensing records used by MedOrbits.

It supports consistent typography across:

- Main website pages and navigation.
- Educational content and course catalogues.
- Medical and healthcare information.
- Admission guidance and application forms.
- Careers, recruitment, and professional services.
- Dashboards, tables, buttons, and form controls.
- Supported multilingual content.

All font assets must be appropriately licensed, correctly referenced, and maintained in accordance with the project’s design and technical requirements.

—

## 2. Actual Directory Structure

The supplied directory screenshot shows the following structure:

```text id=“8n3xqf”
assets/
└── fonts/
    ├── fonts/
    │   ├── README.md
    │   ├── DMSans-Bold.ttf
    │   ├── DMSans-Medium.ttf
    │   ├── DMSans-Regular.ttf
    │   ├── DMSans-SemiBold.ttf
    │   ├── PlayfairDisplay-Bold.ttf
    │   ├── PlayfairDisplay-Medium.ttf
    │   ├── PlayfairDisplay-SemiBold.ttf
    │   └── FONT-LICENCES/
    │       ├── README.md
    │       └── FONT-LICENSE.md
    ├── download-fonts.sh
    └── README.md
```

This structure reflects the supplied screenshots and the previously specified licensing paths. Verify the actual repository before assuming every nested file is present.

### Directory responsibilities

| Path | Responsibility |
|—|—|
| `/assets/fonts/` | Font management, download utility, and overview documentation |
| `/assets/fonts/fonts/` | Local font binaries and their directory-specific README |
| `/assets/fonts/fonts/FONT-LICENCES/` | Font licensing documentation and verification records |
| `/assets/fonts/download-fonts.sh` | Optional script for downloading approved font assets |

Keep the existing directory names consistent across documentation, scripts, CSS, and deployment configuration.

—

## 3. Existing Font Inventory

The nested font directory contains the following files according to the supplied screenshot.

### DM Sans

| File | Intended weight | CSS value |
|—|—|—:|
| `DMSans-Regular.ttf` | Regular | 400 |
| `DMSans-Medium.ttf` | Medium | 500 |
| `DMSans-SemiBold.ttf` | Semibold | 600 |
| `DMSans-Bold.ttf` | Bold | 700 |

### Playfair Display

| File | Intended weight | CSS value |
|—|—|—:|
| `PlayfairDisplay-Medium.ttf` | Medium | 500 |
| `PlayfairDisplay-SemiBold.ttf` | Semibold | 600 |
| `PlayfairDisplay-Bold.ttf` | Bold | 700 |

The weight assignments follow the filenames. Verify the font metadata if exact weight information is required.

—

## 4. Font Usage Standards

### DM Sans

Use DM Sans for:

- Body text and educational articles.
- Navigation, menus, and interface labels.
- Buttons, inputs, and form controls.
- Tables and application instructions.
- Course descriptions and admission guidance.
- Healthcare and career information.
- Dashboard content and validation messages.

### Playfair Display

Use Playfair Display selectively for:

- Main page headings.
- Prominent section titles.
- Editorial headings.
- Selected promotional titles.
- Display text that benefits from a serif typeface.

Use a readable sans-serif typeface for dense instructional content and interface elements.

Maintain a consistent hierarchy across the MedOrbits website.

—

## 5. Font CSS Integration

The main website stylesheet should reference the actual files stored in `/assets/fonts/fonts/`.

Example:

```css id=“x2e3vt”
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

**Important:** These paths assume the website is served from the domain root. Adjust them if the application uses a different deployment base path.

Integrate these declarations with the existing shared stylesheet rather than duplicating font definitions across individual pages.

—

## 6. Font Download Script

The root directory contains `download-fonts.sh`, according to the supplied screenshot.

Its intended role may include downloading approved font assets into the nested `fonts/` directory. Inspect the script before relying on its behaviour.

### Script requirements

The script should:

1. Use verified and trusted font sources.
2. Download only fonts approved for the project.
3. Place files in the correct destination directory.
4. Check whether downloads succeeded.
5. Avoid silently overwriting existing files.
6. Preserve applicable licensing and copyright notices.
7. Report failed downloads clearly.
8. Avoid downloading unverified or unauthorized font binaries.
9. Support safe execution and predictable exit codes.
10. Avoid embedding credentials, tokens, or private information.

### Before running the script

- Inspect its contents.
- Verify the download URLs and their sources.
- Confirm the applicable font licences.
- Check its output paths.
- Confirm that it does not overwrite existing assets unexpectedly.
- Run it in an appropriate development environment.
- Verify downloaded files before deployment.

The presence of `download-fonts.sh` does not establish that it is complete, secure, or functional. Test the actual script before using it.

—

## 7. Font Licensing

Font licences are maintained separately under:

```text id=“j4e1kc”
assets/fonts/fonts/FONT-LICENCES/
├── README.md
└── FONT-LICENSE.md
```

Use these files to document licence requirements and verification status for DM Sans and Playfair Display.

Before production use or repository redistribution, verify:

- Original font source.
- Applicable licence and copyright notices.
- Permission for website embedding and self-hosting.
- Commercial-use requirements.
- Public repository redistribution restrictions.
- Conversion and modification permissions.
- Required attribution and licence files.

Do not assume that free availability automatically permits commercial use or redistribution.

The licensing README and register must reflect the actual licence documents, not unverified assumptions.

—

## 8. Performance and Optimization

- Load only the font weights used by the website.
- Use `font-display: swap` to keep text visible during font loading.
- Avoid redundant font declarations.
- Configure caching for static font assets.
- Test font loading on mobile devices and slower connections.
- Consider WOFF2 conversion only after verifying licence permissions.
- Preserve the original files until converted versions are tested.
- Preload only critical fonts needed for initial rendering.
- Avoid loading every font weight on every page.
- Remove obsolete assets only after checking their dependencies.

TTF files can be used by modern browsers, but WOFF2 may offer better compression for production delivery. Conversion is optional and must comply with the applicable licence.

—

## 9. Accessibility and Language Support

- Use readable body text and sufficient colour contrast.
- Maintain a clear heading hierarchy.
- Keep forms, buttons, navigation, and error messages legible.
- Provide fallback font families.
- Allow browser zoom and responsive text resizing.
- Test special characters and translated content.
- Verify support for Hindi, Bengali, Nepali, and other required writing systems.
- Add appropriately licensed fonts if additional glyph coverage is needed.

Do not assume that DM Sans or Playfair Display files contain every glyph required by all supported languages.

—

## 10. Asset Path and Deployment Rules

Use consistent paths throughout the project.

The following is the expected relationship:

```text id=“4eqh8y”
Website HTML/CSS
       |
       v
/assets/fonts/fonts/
       |
       +— DMSans-Regular.ttf
       +— DMSans-Medium.ttf
       +— DMSans-SemiBold.ttf
       +— DMSans-Bold.ttf
       +— PlayfairDisplay-Medium.ttf
       +— PlayfairDisplay-SemiBold.ttf
       +— PlayfairDisplay-Bold.ttf
```

Before deployment:

- Verify that all referenced files exist.
- Check filename capitalization.
- Confirm that static assets are included in the build.
- Test paths on the deployed website.
- Check browser network errors.
- Confirm that the server returns font files correctly.
- Ensure caching does not serve outdated assets after a deliberate update.

Do not rename or move existing font files without updating all dependent references.

—

## 11. Troubleshooting

### Fonts do not load

Check CSS URLs, filenames, capitalization, server responses, and browser network errors.

### Fonts work locally but fail after deployment

Check static asset routing, build output, deployment base paths, and case-sensitive filenames.

### Incorrect weight appears

Verify that the correct file is registered with the intended `font-weight`.

### Text uses a fallback font

Inspect the computed font family and loading status. Confirm that the file exists at the requested path.

### Download script fails

Inspect the script, verify its source URLs, check network access, and confirm that the destination directory exists and is writable.

### Converted fonts behave incorrectly

Check font metadata, weight declarations, glyph coverage, conversion quality, and licence restrictions.

### Licence status is unclear

Do not redistribute or deploy the affected font until its source and applicable terms have been verified.

—

## 12. Maintenance Checklist

- [ ] Directory structure matches the actual repository.
- [ ] Existing font files are correctly documented.
- [ ] CSS references point to existing assets.
- [ ] Font weights and styles are declared correctly.
- [ ] Download script has been inspected and tested.
- [ ] Font sources and licences have been verified.
- [ ] Required copyright notices are retained.
- [ ] No unauthorized or unverified binaries are downloaded.
- [ ] Responsive and multilingual rendering has been checked.
- [ ] Performance and caching have been reviewed.
- [ ] Deployment includes all required font assets.
- [ ] Documentation is updated after structural changes.

—

## 13. Related Documentation

| File | Purpose |
|—|—|
| `/assets/fonts/README.md` | Main directory overview |
| `/assets/fonts/fonts/README.md` | Nested font inventory and usage |
| `/assets/fonts/fonts/FONT-LICENCES/README.md` | Licensing directory guidance |
| `/assets/fonts/fonts/FONT-LICENCES/FONT-LICENSE.md` | Font licence verification register |
| `/assets/fonts/download-fonts.sh` | Font download utility |

Confirm each path exists before treating it as an active project dependency.

—

## 14. Change Log

### Version 1.0.0 — 2026-10-24

- Documented the font directory structure.
- Recorded the existing DM Sans and Playfair Display files.
- Added CSS integration guidance.
- Documented download-script expectations.
- Added licensing, accessibility, performance, and deployment requirements.

—

## 15. Final Standard

The `/assets/fonts/` directory must contain organized, authorized, documented, and correctly referenced font assets.

**Core principle:** Keep font binaries, download utilities, and licensing documentation consistent with the actual repository, and verify all font usage rights before production deployment or redistribution.
