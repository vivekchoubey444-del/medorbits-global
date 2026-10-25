MedOrbits Team Images

Canonical directory: /assets/images/team/
Project: MedOrbits
Document version: 1.0.0
Purpose: Standards for managing approved team portraits and professional photographs.

This directory contains images of MedOrbits team members and other people whose photographs are authorized for publication on the website. All images must be accurate, appropriately licensed or consented to, privacy-reviewed, and optimized for the intended display.

1. Directory structure

assets/
└── images/
    └── team/
        ├── README.md
        ├── leadership/
        ├── staff/
        ├── advisors/
        ├── placeholders/
        └── archive/

Create subdirectories only when they are useful for the actual project. Preserve existing folder names and paths until references in HTML, CSS, JavaScript, and JSON have been checked.

|Folder         |Purpose                                              |
|—————|——————————————————|
|`leadership/`  |Approved leadership portraits                        |
|`staff/`       |Approved employee and team-member portraits          |
|`advisors/`    |Approved advisor or consultant portraits             |
|`placeholders/`|Neutral fallback images when no portrait is available|
|`archive/`     |Retired images retained only when appropriate        |

2. Naming convention

Use lowercase kebab-case and stable, non-sensitive identifiers.

Examples:

team-leadership-001.webp
team-member-014.webp
team-advisor-003.webp
team-profile-placeholder.webp

Do not put phone numbers, email addresses, birth dates, employee IDs, identity numbers, or other personal information in filenames.

Use names only when necessary and authorized. A stable staff ID or approved public slug is usually easier to maintain than a person’s full name.

3. Consent, accuracy, and privacy

Before publishing a team photograph:

• Confirm the person’s identity and current role.
• Obtain documented permission for the intended website and promotional use, where required.
• Explain the intended use and how a person can request correction or removal.
• Do not publish photographs of applicants, clients, or other people as team members.
• Do not imply that a person is employed by, affiliated with, or endorses MedOrbits unless that is accurate and authorized.
• Remove unnecessary EXIF metadata, especially GPS coordinates.
• Check the image for visible badges, documents, screens, addresses, or other private information.
• Keep consent records and private source files in appropriately protected storage, not in this public asset directory.

This is a public-facing directory. Published image URLs can be copied or downloaded; filenames do not provide access control.

4. Recommended formats and dimensions

|Use               |Suggested dimensions|Preferred format|
|——————|-——————:|-—————|
|Profile portrait  |800 × 1000          |WebP            |
|Square team card  |800 × 800           |WebP            |
|Wide team feature |1600 × 900          |WebP            |
|Simple placeholder|Layout-dependent    |SVG or WebP     |

These are starting points, not mandatory limits. Match the image to its actual layout, compress it appropriately, and preserve a respectful, representative crop.

• Prefer WebP for photographs.
• Use AVIF when the browser and delivery pipeline have been tested.
• Use SVG only for trusted, reviewed vector artwork.
• Do not rename extensions without converting the file.
• Avoid uploading huge originals when a smaller optimized image will suffice.

5. Accessible HTML example

Replace the example path and alternative text with verified information.

<figure class=“mo-team-card”>
  <img
    src=“/assets/images/team/staff/team-member-014.webp”
    alt=“Portrait of a MedOrbits team member”
    width=“800”
    height=“1000”
    loading=“lazy”
    decoding=“async”
  >
  <figcaption>
    <h3>Approved Display Name</h3>
    <p>Verified Job Title</p>
  </figcaption>
</figure>

The display name and role above are placeholders, not claims about an actual person. Replace them with verified, approved details before publishing.

If the photograph is decorative and the adjacent text already identifies the person, alt=“” may be appropriate. Avoid adding personal details to alternative text that are not necessary to understand the image.

6. Reusable CSS example

.mo-team-card {
  margin: 0;
  overflow: hidden;
  border-radius: 1rem;
  background: #edf2fa;
  color: #1b2b43;
}

.mo-team-card img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  background: #dbe5f2;
}

.mo-team-card figcaption {
  padding: 1rem;
}

.mo-team-card h3 {
  margin: 0 0 0.35rem;
}

.mo-team-card p {
  margin: 0;
  color: #45566f;
}

@media (prefers-reduced-motion: no-preference) {
  .mo-team-card img {
    transition: filter 180ms ease;
  }

  .mo-team-card:hover img {
    filter: saturate(1.04);
  }
}

Follow the current MedOrbits design system, including sapphire-blue accents and restrained gold details where appropriate. Maintain readable contrast, keyboard-accessible interactions, and responsive card layouts.

7. Security and licensing

• Publish only images that MedOrbits owns or has permission to use.
• Keep a record of the source, creator, license, attribution, and approval requirements.
• Do not store identity documents, confidential HR records, credentials, or private employee data here.
• Review SVG files for scripts, event handlers, external references, and other active content.
• Avoid exposing original high-resolution files if there is no need to publish them.
• Do not treat obscure filenames as a privacy or security control.

8. Optional image manifest

For larger collections, use a manifest such as /assets/data/team-manifest.json. Keep it limited to approved public information.

Example:

{
  “schemaVersion”: “1.0.0”,
  “teamImages”: [
    {
      “id”: “team-member-014”,
      “src”: “/assets/images/team/staff/team-member-014.webp”,
      “alt”: “Portrait of a MedOrbits team member”,
      “displayName”: “Approved Display Name”,
      “role”: “Verified Job Title”,
      “status”: “published”
    }
  ]
}

This example is illustrative. Do not add the record until the image, identity, role, and publication permission have been verified. Do not include private contact details or consent documents in a public manifest.

9. Publishing checklist

☐ Identity and role are verified.
☐ Publication permission and licensing are confirmed.
☐ The image is appropriate for the stated role.
☐ Filename follows the naming convention.
☐ Image dimensions and file size suit the layout.
☐ Alternative text is accurate and privacy-conscious.
☐ Unnecessary EXIF metadata has been removed.
☐ No confidential information is visible.
☐ Mobile, tablet, and desktop layouts have been checked.
☐ HTML, CSS, and manifest paths point to existing files.
☐ The deployed image URL loads successfully.
☐ There is a process for correction or removal requests.

10. Maintenance

1. Add only approved, current photographs.
2. Update all page and manifest references when an asset changes.
3. Remove outdated role descriptions and images promptly.
4. Handle removal requests and relevant cache invalidation.
5. Retain retired images only where there is a valid business and retention reason.
6. Update this README whenever folder structure or publication rules change.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/team/
Document: README.md

This document defines asset-management guidance. It does not supply team photographs or verify the identity, role, consent, or employment status of any individual.