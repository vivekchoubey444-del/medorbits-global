MedOrbits Social Media Images

Canonical directory: /assets/images/social/
Project: MedOrbits
Document version: 1.0.0
Purpose: Standards for social sharing images, Open Graph previews, and approved campaign artwork.

This directory contains images used when MedOrbits pages are shared through social platforms, messaging apps, search previews, and other external services. Publish only approved assets that accurately represent the linked page and comply with brand, licensing, accessibility, and privacy requirements.

1. Directory structure

assets/
└── images/
    └── social/
        ├── README.md
        ├── open-graph/
        ├── campaigns/
        ├── platforms/
        ├── placeholders/
        └── archive/

Create subfolders only when useful. Preserve existing names and paths until references in HTML, metadata, CSS, and JSON have been checked.

|Folder         |Purpose                                                    |
|—————|————————————————————|
|`open-graph/`  |Default and page-specific Open Graph preview images        |
|`campaigns/`   |Approved social campaign graphics                          |
|`platforms/`   |Platform-specific artwork when a different crop is required|
|`placeholders/`|Fallback share images                                      |
|`archive/`     |Retired artwork retained for reference, not active use     |

2. Naming convention

Use lowercase kebab-case and descriptive filenames.

Recommended pattern:

{page-or-campaign}-{purpose}-{variant}.{extension}

Examples:

social-share-default.webp
home-open-graph.webp
mbbs-admissions-social-square.webp
career-guidance-link-preview.webp
campaign-2026-autumn.webp

Rules:

• Avoid names such as image1.png, final-new.jpg, or social2.webp.
• Use platform names only when the image is genuinely tailored to that platform.
• Do not include personal information, credentials, private campaign details, or tracking tokens in filenames.
• Do not rename extensions without converting the underlying file.
• Keep deployed paths stable where possible.

3. Recommended sizes and formats

Actual platform requirements can change. Verify current specifications before publishing platform-specific creative.

|Use                         |Suggested dimensions         |Aspect ratio         |
|-—————————|-—————————:|———————:|
|General link preview        |1200 × 630                   |1.91:1               |
|Square social post          |1080 × 1080                  |1:1                  |
|Portrait post               |1080 × 1350                  |4:5                  |
|Vertical story or reel cover|1080 × 1920                  |9:16                 |
|Wide campaign artwork       |1200 × 630 or layout-specific|1.91:1 or as required|

These dimensions are recommendations, not guarantees of acceptance by every platform. Check file size, safe areas, cropping, and current platform specifications.

• Prefer WebP or JPEG for photographic social images where supported.
• Use PNG for transparency or lossless graphics.
• Use AVIF only after testing compatibility with the target sharing platforms.
• Use reviewed SVG for trusted vector artwork only when the target platform supports it.
• Keep essential text away from crop-sensitive edges.
• Avoid very small text and overly dense layouts.

4. Open Graph metadata example

Use an absolute, publicly reachable URL for the social preview image. Replace the example domain and file paths with the real production values.

<meta property=“og:type” content=“website”>
<meta property=“og:site_name” content=“MedOrbits”>
<meta property=“og:title” content=“MedOrbits | Education and Career Guidance”>
<meta
  property=“og:description”
  content=“Explore education, admissions, and career guidance resources.”
>
<meta
  property=“og:url”
  content=“https://www.example.com/“
>
<meta
  property=“og:image”
  content=“https://www.example.com/assets/images/social/open-graph/home-open-graph.webp”
>
<meta
  property=“og:image:alt”
  content=“MedOrbits education and career guidance”
>
<meta property=“og:image:width” content=“1200”>
<meta property=“og:image:height” content=“630”>

example.com is a placeholder. Replace it with the canonical production domain before deployment.

Twitter/X card example

<meta name=“twitter:card” content=“summary_large_image”>
<meta name=“twitter:title” content=“MedOrbits | Education and Career Guidance”>
<meta
  name=“twitter:description”
  content=“Explore education, admissions, and career guidance resources.”
>
<meta
  name=“twitter:image”
  content=“https://www.example.com/assets/images/social/open-graph/home-open-graph.webp”
>
<meta
  name=“twitter:image:alt”
  content=“MedOrbits education and career guidance”
>

Ensure page-specific titles and descriptions match the actual page content. Do not place a different page’s title or image in metadata.

5. Design and branding

Follow the approved MedOrbits design system. The current project direction favors a premium, professional appearance with sapphire-blue accents and restrained gold details where appropriate.

• Preserve approved logos and their proportions.
• Keep visual hierarchy clear at small preview sizes.
• Maintain adequate contrast.
• Avoid long paragraphs and tiny text in artwork.
• Keep important content within safe margins.
• Ensure imagery accurately reflects the linked page.
• Do not imply government endorsement, official institutional affiliation, guaranteed admission, or guaranteed employment without authorization and substantiation.
• Avoid deceptive, fabricated, or misleading endorsements.

6. Accessibility and content accuracy

• Provide accurate image alternative text in metadata where supported.
• Make page titles and descriptions understandable without the image.
• Do not use an image as the only carrier of essential information.
• Avoid embedding personal data in campaign graphics.
• Verify dates, prices, eligibility, and claims before publishing time-sensitive creative.
• Remove or replace outdated campaign artwork promptly.

Social preview crawlers may not use ordinary page image alt text, so provide supported image-alt metadata and accessible page content.

7. Security, privacy, and licensing

• Publish only artwork that MedOrbits owns or is licensed to use.
• Record source, creator, license, attribution requirements, and approval when applicable.
• Obtain permission for identifiable people where required.
• Do not include private applicant documents, credentials, confidential information, or personal contact details without a valid, authorized reason.
• Remove unnecessary EXIF metadata, especially GPS coordinates.
• Review SVG files for scripts, event handlers, and external references.
• Assume public social images can be copied, downloaded, cached, and redistributed.
• Do not include secrets or personal information in image URLs.

8. Optional social image manifest

For larger collections, maintain a manifest such as /assets/data/social-image-manifest.json. Include only approved assets that exist.

Example:

{
  “schemaVersion”: “1.0.0”,
  “images”: [
    {
      “id”: “home-open-graph”,
      “src”: “/assets/images/social/open-graph/home-open-graph.webp”,
      “alt”: “MedOrbits education and career guidance”,
      “placement”: “open-graph”,
      “status”: “published”
    }
  ]
}

This is an illustrative example. Do not add the record until the referenced image exists and has been reviewed. A manifest is not an access-control mechanism.

9. Testing and cache refresh

Before publishing:

• Confirm the image exists at the exact path.
• Verify that the production URL returns a successful response.
• Confirm that the image is accessible to intended public crawlers.
• Check image dimensions, format, and file size.
• Test the preview using the relevant platform’s current sharing/debugging tools.
• Confirm that metadata points to the correct canonical page and image.
• Check mobile crops and text safe areas.
• Refresh platform caches when an updated image is not appearing.
• Use versioned filenames or cache invalidation when replacing a published asset.

Social platforms may cache previews independently of the website, so changing the file alone may not update an already cached preview immediately.

10. Publishing checklist

☐ Asset exists and has an approved filename.
☐ Artwork is licensed and approved.
☐ Correct page title, description, and canonical URL are configured.
☐ Absolute production image URL is used in social metadata.
☐ Image dimensions and file size meet current platform requirements.
☐ Important text remains visible after cropping.
☐ Alternative text or supported image-alt metadata is accurate.
☐ No confidential information or unnecessary metadata is exposed.
☐ The image matches the linked page’s actual content.
☐ Preview has been tested on relevant platforms.
☐ Cache refresh has been considered after updates.

11. Maintenance

1. Keep the default share image current and on-brand.
2. Use page-specific images where they improve the accuracy of previews.
3. Update metadata and references whenever an image changes.
4. Retire expired campaign artwork from active pages.
5. Keep archived assets only when retention is useful and permitted.
6. Update this README when the directory structure or publishing requirements change.

────────

Maintainer: MedOrbits Project
Canonical directory: /assets/images/social/
Document: README.md

This document defines asset-management guidance. It does not create social artwork or guarantee how a third-party platform will render or cache a preview.