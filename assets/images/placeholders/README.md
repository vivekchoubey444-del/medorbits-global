MedOrbits Placeholder Images

Canonical directory: /assets/images/placeholders/
Project: MedOrbits
Document version: 1.0.0

Purpose

Store neutral fallback images used when an optional image is missing, unavailable, or intentionally not provided. Placeholders must be clearly generic and must not be mistaken for genuine people, institutions, testimonials, or official announcements.

Recommended structure

assets/
└── images/
    └── placeholders/
        ├── README.md
        ├── image-unavailable.svg
        ├── course-placeholder.webp
        ├── college-placeholder.webp
        ├── career-placeholder.webp
        └── archive/

Create only files that are actually needed. The filenames above are examples, not a claim that these assets already exist.

Naming rules

Use lowercase kebab-case and descriptive names, such as:

• image-unavailable.svg
• course-placeholder.webp
• college-placeholder.webp
• career-placeholder.webp
• profile-placeholder.webp

Do not use real people’s names or personal information in placeholder filenames.

Usage example

Replace the example path with an asset that exists in the repository.

<img
  src=“/assets/images/placeholders/college-placeholder.webp”
  alt=“College image unavailable”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

For decorative placeholders that add no information, use alt=“”. If the missing image is meaningful, describe the unavailable content accurately without implying that the placeholder is the real image.

Design guidelines

• Follow the MedOrbits visual system: premium, professional, sapphire-blue accents, and restrained gold details where appropriate.
• Use a calm, neutral composition that fits the surrounding page.
• Avoid pure-white backgrounds when the page design requires a tinted background.
• Keep shapes and text simple and legible at small sizes.
• Do not include fake logos, invented institutional marks, fabricated reviews, or misleading official-looking seals.
• Prefer SVG for simple, trusted vector placeholders and WebP for raster artwork.

Performance and accessibility

• Keep placeholder files small and appropriately sized.
• Provide width and height attributes or a stable aspect ratio.
• Use meaningful alternative text for informative placeholders and empty alt text for decorative ones.
• Do not use a placeholder as a substitute for required information or a successful data response.
• Avoid repeated network requests for missing assets; verify paths and use reliable fallback handling.

Privacy and security

• Do not place private documents, credentials, personal data, or applicant records in this directory.
• Review SVG files before publication; do not assume SVG is inherently safe.
• Public assets can be copied or downloaded.
• Do not use placeholders to conceal an authorization error or make a failed application submission appear successful.

Publishing checklist

☐ File exists at the referenced path.
☐ Filename is descriptive and follows kebab-case.
☐ Asset is visually neutral and not misleading.
☐ File size and dimensions suit its intended placement.
☐ Alternative text is appropriate.
☐ Mobile and desktop rendering have been checked.
☐ No personal or confidential information is included.
☐ All references work in the deployed environment.

Maintenance

Keep only placeholders that are used or expected to be used. Update page references when an asset is renamed, and move retired files to archive/ only when retaining them is useful.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/placeholders/
Document: README.md