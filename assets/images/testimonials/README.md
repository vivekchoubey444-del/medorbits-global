MedOrbits Testimonial Images

Canonical directory: /assets/images/testimonials/
Project: MedOrbits
Document version: 1.0.0
Purpose: Standards for managing images associated with approved testimonials and reviews.

This directory is intended for testimonial-related images that MedOrbits is authorized to publish, such as approved portraits or supporting visuals. Testimonials and images must be genuine, correctly attributed when consent permits, and presented without misleading edits.

1. Directory structure

assets/
└── images/
    └── testimonials/
        ├── README.md
        ├── portraits/
        ├── organizations/
        ├── placeholders/
        └── archive/

Create subfolders only when needed. If the repository already uses a different structure, preserve existing paths until all references have been reviewed.

|Folder          |Purpose                                                            |
|-—————|-——————————————————————|
|`portraits/`    |Approved images of testimonial authors                             |
|`organizations/`|Approved organization or campus imagery used alongside testimonials|
|`placeholders/` |Neutral fallback artwork when no portrait is supplied              |
|`archive/`      |Retired images retained for reference; not for active display      |

2. Naming convention

Use lowercase kebab-case. Prefer a non-sensitive reference ID over a person’s full name.

Examples:

testimonial-t001.webp
testimonial-t002.webp
student-success-placeholder.webp
organization-campus-example.webp

Do not include phone numbers, email addresses, application IDs, dates of birth, student IDs, or other personal data in filenames.

Use stable identifiers that correspond to the approved testimonial record. Do not guess or invent an identity from an image filename.

3. Consent and authenticity

Before publishing a testimonial image:

• Obtain documented permission for the intended use and channels.
• Confirm that the testimonial and image refer to the correct person or organization.
• Use the image only for the agreed purpose.
• Follow applicable privacy, publicity, and data-protection requirements.
• Provide a way to request correction or removal.
• Keep evidence of consent in an appropriately protected system, not in this public directory.
• Do not publish private messages, identity documents, or screenshots containing personal information without explicit authorization and a valid reason.

Do not create fabricated portraits, fake testimonials, misleading before-and-after imagery, or endorsements that imply a result is typical or guaranteed when it is not.

4. Privacy and security

This is a public asset directory. Any image published here may be downloaded, copied, or indexed.

• Never store confidential applicant records or private identity documents here.
• Remove unnecessary EXIF metadata, including GPS coordinates.
• Check images for visible addresses, phone numbers, email addresses, ID cards, or other unintended personal information.
• Restrict source originals and consent records to authorized staff in protected storage.
• Do not rely on obscure filenames to protect sensitive content.
• Review uploaded images before they become publicly accessible.

If consent is withdrawn, remove or replace the public image and update all active page references and caches as appropriate.

5. Recommended formats and dimensions

|Use                         |Suggested size  |Preferred format|
|-—————————|—————:|-—————|
|Portrait card               |600 × 600       |WebP            |
|Portrait with shoulders     |800 × 1000      |WebP            |
|Organization or campus image|1200 × 800      |WebP            |
|Generic placeholder         |Layout-dependent|SVG or WebP     |

These are starting points, not strict requirements. Optimize the image for its actual display size and avoid unnecessarily large source files.

• Prefer WebP for photographs.
• Use AVIF if the delivery pipeline and target browsers have been tested.
• Use SVG only for trusted, reviewed vector artwork.
• Preserve the original aspect ratio unless cropping is intentional.
• Use object-fit: cover only when the chosen crop remains respectful and representative.

6. Accessible HTML example

Replace the example path and alternative text with accurate, approved content.

<figure class=“mo-testimonial”>
  <img
    src=“/assets/images/testimonials/portraits/testimonial-t001.webp”
    alt=“Portrait of a testimonial author”
    width=“600”
    height=“600”
    loading=“lazy”
    decoding=“async”
  >
  <blockquote>
    <p>Insert the verified, approved testimonial text here.</p>
  </blockquote>
  <figcaption>
    Name or approved attribution, shown only with permission
  </figcaption>
</figure>

If the image is purely decorative and the adjacent text already identifies the person, use alt=“”. Do not expose a person’s identity in alternative text if the testimonial is approved to be anonymous.

Do not publish the example text as a real testimonial. Replace it with verified material before use.

7. CSS example

.mo-testimonial {
  margin: 0;
  padding: 1.25rem;
  border-radius: 1rem;
  background: #edf2fa;
  color: #1b2b43;
}

.mo-testimonial img {
  display: block;
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  object-fit: cover;
  background: #dbe5f2;
}

.mo-testimonial blockquote {
  margin: 1rem 0;
}

.mo-testimonial figcaption {
  font-size: 0.9rem;
  font-weight: 600;
}

Follow the approved MedOrbits design system, including sapphire-blue accents and restrained gold details where appropriate. Keep text readable and avoid pure-white sections when the page design specifies tinted backgrounds.

8. Attribution and claims

• Attribute a testimonial only as authorized by the contributor.
• Clearly distinguish verified customer feedback from editorial content or illustrative examples.
• Do not imply that a testimonial represents typical results unless that claim is substantiated.
• Do not promise admission, employment, financial outcomes, or other guaranteed results based on an individual account.
• Do not alter a testimonial in a way that changes its meaning.
• Clearly label anonymized, composite, or illustrative material where its use is lawful and appropriate; never present fabricated content as a genuine customer statement.

9. Optional metadata manifest

For larger collections, maintain a manifest such as /assets/data/testimonials-manifest.json. Store only the minimum public metadata required by the website.

Example:

{
  “schemaVersion”: “1.0.0”,
  “testimonials”: [
    {
      “id”: “t001”,
      “image”: “/assets/images/testimonials/portraits/testimonial-t001.webp”,
      “alt”: “Portrait of a testimonial author”,
      “attribution”: “Approved display name”,
      “consentStatus”: “approved”,
      “status”: “published”
    }
  ]
}

This is an illustrative schema. Do not add entries until the image, testimonial, attribution, and publication permission have been verified. Keep detailed consent documents and private contact details out of a public manifest.

10. Publishing checklist

☐ Testimonial text is genuine and verified.
☐ Image use is covered by documented consent or another valid legal basis.
☐ Attribution matches the person’s approved preference.
☐ Image contains no unintended personal or confidential information.
☐ Unnecessary EXIF metadata has been removed.
☐ Filename follows the naming convention.
☐ Image dimensions and file size suit the component.
☐ Alternative text respects accessibility and privacy.
☐ Page presentation does not misrepresent the person’s words or results.
☐ The asset path loads successfully in the deployed environment.
☐ Removal or correction requests can be handled promptly.

11. Maintenance

1. Add only approved assets.
2. Use stable, non-sensitive filenames.
3. Update page and manifest references whenever an asset changes.
4. Remove withdrawn or expired assets from active pages.
5. Purge relevant CDN or browser caches when necessary.
6. Keep private consent records in protected storage.
7. Move retired images to archive/ only when retention is appropriate.
8. Update this README whenever folder structure or publication requirements change.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/testimonials/
Document: README.md

This document defines asset-management guidance. It does not itself supply testimonial images, establish consent, or verify the authenticity of any testimonial.