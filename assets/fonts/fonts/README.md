MedOrbits — Fonts Directory

Directory: /assets/fonts/fonts/
Project: MedOrbits
Purpose: Store and manage locally hosted web fonts used throughout the MedOrbits website.

⸻

1. Directory Structure

Keep font files organized by font family and weight.

assets/
└── fonts/
    └── fonts/
        ├── README.md
        ├── inter-regular.woff
        ├── inter-medium.woff
        ├── inter-semibold.woff
        ├── inter-bold.woff
        └── ...

The font files shown above are examples. Add only files that actually exist in the project and whose licences permit the intended use.

2. Supported Font Formats

Format	Recommendation
WOFF2	Preferred for modern browsers because of its efficient compression.
WOFF	Optional fallback for older browser support requirements.
TTF	Use primarily when required for development or conversion workflows.
OTF	Use when a specific font distribution requires it.

Prefer WOFF2 for production websites. Avoid shipping unnecessary font formats.

3. Recommended Font Naming

Use lowercase filenames with hyphens.

inter-regular.woff2
inter-medium.woff2
inter-semibold.woff2
inter-bold.woff2
inter-italic.woff2

Use descriptive names that identify the font family, weight, and style. Do not rename font files in a way that obscures their original identity or licence information.

4. CSS Integration

Define local fonts using @font-face in the project’s main stylesheet or a dedicated font stylesheet.

Example for a font file that exists at /assets/fonts/fonts/inter-regular.woff2:

@font-face {
  font-family: “Inter”;
  src: url(“/assets/fonts/fonts/inter-regular.woff2”)
    format(“woff2”);
  font-style: normal;
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: “Inter”;
  src: url(“/assets/fonts/fonts/inter-semibold.woff2”)
    format(“woff2”);
  font-style: normal;
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: “Inter”;
  src: url(“/assets/fonts/fonts/inter-bold.woff2”)
    format(“woff2”);
  font-style: normal;
  font-weight: 700;
  font-display: swap;
}

Important: Update the font URLs and family names to match the actual files in the repository. The example does not create or supply font binaries.

5. Applying Fonts to the Website

Use the declared font family consistently across the website.

:root {
  —font-primary: “Inter”, Arial, sans-serif;
}
html {
  font-family: var(—font-primary);
}
body {
  margin: 0;
  font-family: var(—font-primary);
  font-weight: 400;
  line-height: 1.6;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 700;
}
button,
input,
select,
textarea {
  font: inherit;
}

Integrate these rules with the existing MedOrbits design system instead of introducing conflicting global styles.

6. Performance Guidelines

* Prefer WOFF2 files for production.
* Load only the font weights and styles that are actually used.
* Use font-display: swap to keep text visible while fonts load.
* Avoid loading the same font through multiple CSS files.
* Consider variable fonts when they reduce the number of required font files.
* Preload only critical fonts used immediately above the fold.
* Use crossorigin when preloading font resources.

Example preload element for a confirmed font file:

<link
  rel=“preload”
  href=“/assets/fonts/fonts/inter-regular.woff2”
  as=“font”
  type=“font/woff2”
  crossorigin
>

Do not add preload declarations for files that do not exist.

7. Accessibility and Typography

* Maintain readable text sizes and sufficient colour contrast.
* Use font weights that preserve legibility at different screen sizes.
* Ensure buttons, forms, navigation, and error messages remain readable.
* Provide suitable fallback fonts.
* Test special characters and the language scripts supported by the website.
* Do not use font styling as the only way to communicate important information.

8. Licensing and Attribution

Before adding any font, verify its licence and permitted use.

* Retain applicable licence and copyright notices.
* Include required attribution files.
* Confirm that redistribution and self-hosting are permitted.
* Do not commit commercially restricted font files without authorization.
* Keep licence documentation alongside the relevant font assets when appropriate.

Font availability online does not automatically grant permission to redistribute font binaries.

9. Maintenance Checklist

Before merging font-related changes, verify the following:

* [ ]	Font files are present at the referenced paths.
* [ ]	CSS family names, weights, and styles match the actual files.
* [ ]	No duplicate or unnecessary font files are included.
* [ ]	Fonts load successfully in the browser.
* [ ]	Fallback fonts work when a font fails to load.
* [ ]	Text remains visible during font loading.
* [ ]	Mobile and desktop typography has been checked.
* [ ]	Font licences and attribution requirements are satisfied.
* [ ]	Production build and deployment preserve the asset paths.

10. Troubleshooting

Font does not load

Check the URL, filename, capitalization, deployment configuration, and browser network errors.

Browser reports an incorrect font format

Confirm that the file is genuinely WOFF2 or another declared format. The format() descriptor must match the actual file.

Bold text appears incorrectly

Ensure the appropriate font weight is declared and that the corresponding font file exists. Do not assume every font family provides every weight.

Font works locally but not after deployment

Check static asset routing, case-sensitive filenames, caching, and server responses. Ensure the deployed build includes the required files.

Unexpected fallback font appears

Inspect the computed CSS, font loading status, font family name, and browser console for errors.

⸻

Maintenance Policy

This directory should contain only authorized, documented, and actively used font assets. Update this README whenever the directory structure, font families, supported formats, or loading strategy changes.

Note: This README documents the intended structure and usage. It does not verify that any example font file exists in the repository.