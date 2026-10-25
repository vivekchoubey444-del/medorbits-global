MedOrbits Banner Assets

Canonical directory: /assets/images/banners/
Project: MedOrbits
Purpose: Standards for organizing, creating, optimizing, and publishing website banners.

This directory contains approved banner artwork for MedOrbits homepage sections, education and admissions pages, healthcare content, career services, and campaigns. Store only assets that are approved for publication and referenced by the project.

1. Directory structure

assets/
└── images/
    └── banners/
        ├── README.md
        ├── admissions/
        ├── archive/
        ├── campaigns/
        ├── careers/
        ├── education/
        ├── healthcare/
        ├── home/
        ├── mobile/
        └── shared/

Folder responsibilities

|Folder       |Purpose                                                           |
|-————|——————————————————————|
|`home/`      |Homepage hero and homepage feature banners                        |
|`education/` |Courses, colleges, universities, and education guidance           |
|`healthcare/`|Healthcare education and related services                         |
|`careers/`   |Jobs, recruitment, and career guidance                            |
|`admissions/`|Admission processes, entrance exams, and application guidance     |
|`campaigns/` |Time-limited promotions and campaign artwork                      |
|`shared/`    |Reusable banners used on multiple pages                           |
|`mobile/`    |Mobile-specific crops when responsive markup alone is insufficient|
|`archive/`   |Retired banners kept for reference; do not use for active pages   |

Keep this folder structure aligned with the existing repository. Do not rename folders that are already referenced by deployed HTML, CSS, JavaScript, or JSON without updating and testing every reference.

2. Naming convention

Use lowercase kebab-case and descriptive filenames.

Recommended pattern:

{subject}-{purpose}-{variant}.{extension}

Examples:

home-hero-desktop.webp
home-hero-mobile.webp
mbbs-admissions-wide.webp
career-support-card.webp
college-directory-banner.webp
entrance-exam-guidance-mobile.webp

Rules:

• Use -desktop, -mobile, -square, or -thumbnail only for real variants.
• Avoid names such as banner1.png, final-final.jpg, or new-image2.webp.
• Do not change a file extension unless the file has actually been converted.
• Use consistent casing; production servers may treat filenames as case-sensitive.
• Keep filenames stable after deployment when possible.

3. Recommended dimensions

Choose the crop and dimensions to match the actual component. These are starting points, not mandatory limits.

|Placement                 |Suggested dimensions|Aspect ratio|
|—————————|-——————:|————:|
|Homepage hero             |1920 × 1080         |16:9        |
|Wide section banner       |1800 × 600          |3:1         |
|Service or feature card   |1200 × 900          |4:3         |
|Square campaign tile      |1000 × 1000         |1:1         |
|Mobile portrait banner    |1080 × 1350         |4:5         |
|Full-screen mobile artwork|1080 × 1920         |9:16        |

Check the final crop on mobile, tablet, and desktop. Keep important subjects away from edges that may be cropped. Whenever possible, place headings, calls to action, prices, and detailed copy in HTML rather than baking them into the image.

4. Image formats and optimization

• Prefer WebP for photographic and general raster banner assets.
• Use AVIF when browser support and the delivery pipeline have been tested.
• Use SVG only for trusted, reviewed vector artwork.
• Use PNG when transparency or lossless raster quality is required.
• Use JPEG when appropriate for photographs or compatibility fallback.
• Avoid GIF for substantial animation; consider modern video formats when suitable.

Before publishing:

• Compress images and inspect quality at their rendered size.
• Avoid serving unnecessarily large originals.
• Do not stretch images to fit a layout.
• Use width and height attributes or a stable CSS aspect ratio to reduce layout shifts.
• Use responsive variants when they materially reduce bytes or improve composition.
• Remove unnecessary EXIF metadata, especially GPS coordinates.

5. Responsive HTML example

Replace these sample paths with files that actually exist.

<picture>
  <source
    media=“(max-width: 640px)”
    srcset=“/assets/images/banners/home/home-hero-mobile.webp”
    type=“image/webp”
  >
  <img
    src=“/assets/images/banners/home/home-hero-desktop.webp”
    alt=“MedOrbits education and career guidance services”
    width=“1920”
    height=“1080”
    fetchpriority=“high”
    decoding=“async”
  >
</picture>

Use fetchpriority=“high” sparingly, generally for the primary above-the-fold hero. For banners below the fold, use loading=“lazy” and decoding=“async” as appropriate.

For decorative banners that add no information beyond the surrounding HTML, use alt=“”. For meaningful images, provide concise and contextual alternative text.

6. Reusable CSS example

.mo-banner {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  background: #eaf0f8;
}

.mo-banner img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
}

.mo-banner—hero img {
  aspect-ratio: 16 / 9;
}

@media (max-width: 640px) {
  .mo-banner—hero img {
    aspect-ratio: 4 / 5;
  }
}

Use object-fit: cover only when cropping is intended. Use contain for artwork that must remain fully visible. Ensure overlay text has sufficient contrast and remains readable across all crops.

7. MedOrbits visual direction

Follow the approved MedOrbits design system. The current project direction favors a premium, professional look with sapphire-blue accents and restrained gold details where appropriate.

• Keep the composition clean and uncluttered.
• Preserve approved logos and their proportions.
• Use consistent visual direction across education, healthcare, admissions, and careers.
• Avoid embedding long text or essential information in images.
• Do not imply government endorsement, official institutional affiliation, guaranteed admission, or guaranteed employment without authorization and substantiation.
• Ensure the banner complements the page background and does not reduce readability.

8. Accessibility requirements

For each banner, decide whether it is informative or decorative.

• Informative image: use meaningful alt text.
• Decorative image: use alt=“”.
• Do not duplicate long adjacent headings in the alternative text.
• Keep important text in accessible HTML whenever possible.
• Check text contrast if HTML content overlays the banner.
• Avoid using color alone to communicate status or meaning.

9. Licensing, privacy, and security

Only publish artwork that MedOrbits owns or is authorized to use.

• Record the source, creator, license, attribution requirements, and approval when applicable.
• Do not store credentials, private applicant documents, confidential medical information, or identity-document scans in this public directory.
• Remove unnecessary personal or location metadata.
• Review SVG files for scripts, event handlers, external references, and other active content before publication.
• Publicly served banners can be copied. This directory is not private storage.
• Store confidential files in protected backend storage with proper authorization controls.

10. Asset manifest (optional)

For larger projects, keep a manifest such as /assets/data/banner-manifest.json. Include only files that exist and have been reviewed.

Example:

{
  “schemaVersion”: “1.0.0”,
  “banners”: [
    {
      “id”: “home-hero”,
      “src”: “/assets/images/banners/home/home-hero-desktop.webp”,
      “mobileSrc”: “/assets/images/banners/home/home-hero-mobile.webp”,
      “alt”: “MedOrbits education and career guidance services”,
      “placement”: “homepage-hero”,
      “status”: “published”
    }
  ]
}

This is an illustrative schema only. Do not add an entry until its referenced files exist. Validate manifest paths against the repository and reject duplicate IDs.

11. Publishing checklist

Before publishing a banner:

☐ Confirm the file exists at the referenced path.
☐ Confirm ownership, licensing, and approval.
☐ Use a descriptive filename and correct extension.
☐ Optimize dimensions and file size.
☐ Check desktop, tablet, and mobile crops.
☐ Add appropriate alternative text.
☐ Check contrast for overlay content.
☐ Remove unnecessary metadata.
☐ Confirm no confidential information is visible.
☐ Update all HTML, CSS, JavaScript, and JSON references.
☐ Verify the asset loads successfully in the deployed environment.
☐ Remove stale references before archiving or deleting old files.

12. Maintenance

• Keep this document as the banner-specific standard for /assets/images/banners/.
• Keep /assets/images/README.md as the general image asset standard.
• Add new categories only when needed.
• Do not move or rename assets without checking active references.
• Retain retired artwork in archive/ only when it is needed for reference.
• Consider cache headers or versioned filenames when replacing a published image.
• Update this README when folder structure, formats, or publishing rules change.

Status: Directory documentation. Actual banner artwork must be created or supplied separately.