MedOrbits Image Assets

Canonical path: /assets/images/
Project: MedOrbits
Document version: 2.1.0
Scope: Image asset organization, publishing, optimization, and maintenance

This directory contains public image assets used by MedOrbits pages and interface components. Keep files organized, licensed, optimized, accessible, and referenced only through verified paths.

> **Important:** This directory is public-facing. Do not store private applicant documents, credentials, or files that require authorization here. Public image URLs can be copied.

1. Directory structure

assets/
└── images/
    ├── README.md
    ├── banners/
    │   ├── README.md
    │   ├── home/
    │   ├── education/
    │   ├── healthcare/
    │   ├── careers/
    │   ├── admissions/
    │   ├── campaigns/
    │   ├── shared/
    │   ├── mobile/
    │   └── archive/
    ├── backgrounds/
    ├── careers/
    ├── colleges/
    ├── courses/
    ├── healthcare/
    ├── hero/
    ├── icons/
    ├── illustrations/
    ├── logo/
    ├── placeholders/
    ├── social/
    ├── team/
    ├── testimonials/
    └── archive/

Existing project folder compatibility

The screenshots show existing folders named logo/ and hero/. Keep those names if existing HTML or CSS references them. Avoid renaming them to logos/ or moving hero files until every reference has been checked.

Likewise, the banners/ directory has its own README and should remain the detailed reference for banner artwork.

2. Folder responsibilities

|Folder          |Purpose                                               |
|-—————|——————————————————|
|`banners/`      |Wide hero, section, service, and campaign banners     |
|`hero/`         |Existing hero artwork used by current page templates  |
|`logo/`         |Existing MedOrbits logo files and approved variants   |
|`icons/`        |Raster or image-based UI icons                        |
|`illustrations/`|Custom vector or raster illustrations                 |
|`backgrounds/`  |Decorative textures and image backgrounds             |
|`courses/`      |Course and subject imagery                            |
|`colleges/`     |Approved campus and college imagery                   |
|`healthcare/`   |Healthcare education and service imagery              |
|`careers/`      |Career guidance, job, and recruitment imagery         |
|`team/`         |Approved staff or team photographs                    |
|`testimonials/` |Approved testimonial imagery                          |
|`social/`       |Social-sharing and Open Graph images                  |
|`placeholders/` |Fallback artwork for missing optional images          |
|`archive/`      |Retired assets kept for reference, not active page use|

Create additional directories only when there is a clear need. Do not maintain duplicate categories with different names unless compatibility with existing references requires them.

3. File naming

Use lowercase kebab-case and descriptive names.

Pattern:

{subject}-{purpose}-{variant}.{extension}

Examples:

medorbits-logo-primary.svg
medorbits-logo-horizontal.svg
home-hero-desktop.webp
home-hero-mobile.webp
mbbs-course-card.webp
college-campus-placeholder.webp
career-guidance-illustration.svg
social-share-default.webp

Rules:

• Prefer meaningful names over image1.png, final-new.png, or latest2.webp.
• Use -mobile, -desktop, -square, or -thumbnail only for genuine variants.
• Do not change a file extension without converting the actual file.
• Avoid case-only filename differences because some hosting systems are case-sensitive.
• Do not rename deployed assets until their HTML, CSS, JSON, and JavaScript references have been updated.

4. Format selection

|Format|Preferred use                                                      |
|——|-——————————————————————|
|WebP  |General photographic imagery and banners                           |
|AVIF  |Smaller photographic files when browser support is verified        |
|SVG   |Trusted logos and vector artwork after review                      |
|PNG   |Transparency or lossless raster imagery                            |
|JPEG  |Photographic fallback when appropriate                             |
|GIF   |Legacy animation only; consider modern video for substantial motion|

Use the format that provides appropriate visual quality, compatibility, and file size. Do not assume that an SVG is safe simply because it is an image.

5. Recommended dimensions

These are starting points; match the actual component and crop.

|Placement       |Suggested size|Ratio |
|-—————|-————:|——:|
|Hero            |1920 × 1080   |16:9  |
|Wide banner     |1800 × 600    |3:1   |
|Content card    |800 × 600     |4:3   |
|Square thumbnail|800 × 800     |1:1   |
|Social preview  |1200 × 630    |1.91:1|
|Mobile portrait |1080 × 1350   |4:5   |

Optimize images before deployment. Avoid sending a full-resolution source to a small card or thumbnail.

6. Responsive HTML

Use <picture> when the mobile layout needs a different crop. Replace these example paths with files that actually exist.

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

For noncritical images below the fold, use loading=“lazy”. Do not lazy-load the main hero image when it is the primary above-the-fold visual.

For decorative images that add no information, use alt=“”. Meaningful images need concise, contextual alternative text.

7. Reusable CSS

.mo-image {
  display: block;
  max-width: 100%;
  height: auto;
}

.mo-image-frame {
  overflow: hidden;
  border-radius: 1rem;
  background: #eaf0f8;
}

.mo-image-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mo-image-frame—contain img {
  object-fit: contain;
}

.mo-image-frame—hero {
  aspect-ratio: 16 / 9;
}

@media (max-width: 640px) {
  .mo-image-frame—hero {
    aspect-ratio: 4 / 5;
  }
}

Use cover only when cropping is intended. Use contain for logos and artwork that must remain fully visible. Avoid stretching images or applying one aspect ratio indiscriminately.

8. MedOrbits visual direction

Follow the current MedOrbits design system: a premium, professional appearance with sapphire-blue accents and restrained gold details where appropriate.

• Preserve logo proportions and clear space.
• Do not alter institutional or official marks without permission.
• Keep long headings, descriptions, buttons, prices, and notices in HTML rather than embedding them in images.
• Ensure overlay text remains readable across responsive crops.
• Do not imply government endorsement, official affiliation, guaranteed admission, or guaranteed employment without authorization and substantiation.
• Keep imagery consistent across education, healthcare, admissions, and career pages.

9. Security, privacy, and licensing

Before an asset is published:

• Confirm MedOrbits owns it or has permission to use it.
• Record creator/source, license, attribution, and approval requirements where applicable.
• Remove unnecessary EXIF metadata, especially GPS coordinates.
• Check photographs for visible personal or confidential information.
• Review SVG files for scripts, event handlers, external references, and other active content.
• Do not place credentials, private application documents, or confidential user records in this public directory.
• Store private documents in protected backend storage with authorization checks.

A hidden path is not access control. If an image must be private, it must not be served as a publicly accessible static asset.

10. Optional asset manifest

For larger collections, maintain /assets/data/image-manifest.json. Add entries only for files that exist and have been reviewed.

Example schema:

{
  “schemaVersion”: “1.0.0”,
  “images”: [
    {
      “id”: “social-share-default”,
      “src”: “/assets/images/social/social-share-default.webp”,
      “alt”: “MedOrbits education and career guidance”,
      “category”: “social”,
      “status”: “published”
    }
  ]
}

The entry above is illustrative; it does not mean that the image exists. A build or validation script should verify paths, duplicate IDs, allowed categories, and publication status.

11. Performance standards

• Compress raster images and test quality at display size.
• Provide intrinsic width and height, or a stable aspect ratio.
• Use srcset and sizes when multiple resolutions are available.
• Lazy-load below-the-fold content.
• Use fetchpriority=“high” sparingly, usually for the main hero image.
• Avoid unnecessary image downloads and duplicate assets.
• Consider cache headers and versioned filenames when replacing deployed images.
• Check Core Web Vitals and layout shifts after deployment.

12. Path and deployment rules

Use root-relative paths when the website is hosted at the domain root:

<img
  src=“/assets/images/placeholders/college-campus-placeholder.webp”
  alt=“Campus image placeholder”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>

• Verify that the deployment supports /assets/images/... from the site root.
• If the site is hosted under a subdirectory, configure asset paths accordingly.
• Avoid localhost URLs and development-only file paths in production.
• Remember that file paths may be case-sensitive on the production server.
• Do not reference placeholder examples until the actual files have been added.

13. Validation checklist

Before deployment, confirm:

☐ Every referenced file exists.
☐ File names and extensions match the actual files.
☐ The browser can decode the image.
☐ Dimensions and file sizes suit the intended placement.
☐ Alternative text is correct.
☐ Mobile, tablet, and desktop crops have been checked.
☐ Overlay text has sufficient contrast.
☐ Licensing and approval are documented.
☐ Unnecessary metadata is removed.
☐ No confidential information is visible.
☐ No active page references retired assets.
☐ Production URLs load successfully.

Automate broken-reference and manifest checks in development or CI where possible.

14. Maintenance workflow

1. Select the appropriate category folder.
2. Choose a descriptive filename.
3. Verify ownership, licensing, and approval.
4. Optimize the image and inspect its crop.
5. Add suitable alternative text where it is used.
6. Update all HTML, CSS, JSON, and JavaScript references.
7. Run asset validation and responsive checks.
8. Verify the deployed URL.
9. Retire old files only after checking references.
10. Update this README when folder names or standards change.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/
Document: README.md

This document defines asset-management standards. It does not generate artwork or certify that existing files already meet these requirements.