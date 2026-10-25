
# MedOrbits College Image Assets

**Canonical directory:** `/assets/images/colleges/`  
**Project:** MedOrbits  
**Document version:** 1.0.0  
**Last updated:** 2026-10-24  
**Purpose:** Standards for managing, validating, and publishing college and educational institution images.

## 1. Purpose

The `assets/images/colleges/` directory stores approved images used to represent colleges, universities, medical institutions, educational campuses, and other academic organizations featured on the MedOrbits website.

Images may include campus photographs, institutional buildings, academic facilities, libraries, laboratories, student facilities, and approved institutional branding.

The purpose of these assets is to support educational discovery and admission guidance while maintaining accuracy, accessibility, performance, and appropriate usage rights.

This directory is intended for website-ready images. Do not use it to store confidential student records, admission documents, identity documents, examination records, or other private information.

## 2. Recommended Directory Structure

```text
assets/
└── images/
    └── colleges/
        ├── README.md
        ├── college-placeholder.webp
        ├── campus-placeholder.webp
        ├── medical-college-placeholder.webp
        ├── university-placeholder.webp
        ├── cnmc-campus.webp
        ├── nrs-medical-college.webp
        ├── rg-kar-medical-college.webp
        ├── sskm-medical-college.webp
        ├── mch-campus.webp
        └── archive/
```

The filenames above are examples only. They do not confirm that the files exist or that the images accurately represent the named institutions.

Create institution-specific files only after verifying the image source, institution identity, usage rights, and intended purpose.

Preserve existing filenames and paths when active pages depend on them.

## 3. Supported Image Categories

### College campus images

Photographs showing an institution’s campus, exterior, buildings, or general surroundings.

Verify that the image actually represents the named institution and has not been incorrectly attributed.

### Academic facilities

Images of libraries, lecture halls, laboratories, research spaces, and other academic facilities.

Do not imply that a facility exists at a particular institution unless the image and its source support that claim.

### Medical college images

Images of medical colleges, teaching facilities, laboratories, and other relevant academic environments.

Do not confuse a medical college with an affiliated hospital, university, or another institution.

### University images

Images representing universities and their campuses, academic buildings, or approved educational facilities.

Ensure that the institution name and the image’s attribution are consistent.

### Placeholder images

Generic images displayed when a verified institution photograph is unavailable.

Placeholders must be clearly distinguished from real institutional photographs and must not imply that a generic building belongs to a named college.

## 4. Naming Conventions

Use lowercase kebab-case and descriptive filenames.

Examples:

- `college-placeholder.webp`
- `campus-placeholder.webp`
- `medical-college-placeholder.webp`
- `university-placeholder.webp`
- `cnmc-campus.webp`
- `nrs-medical-college.webp`
- `rg-kar-medical-college.webp`
- `sskm-medical-college.webp`

Naming requirements:

1. Use names that clearly identify the image’s purpose.
2. Use institution-specific names only when the attribution has been verified.
3. Avoid vague names such as `college-final2.jpg` or `new-campus.png`.
4. Keep filenames consistent with the project’s naming conventions.
5. Do not change an extension without converting the actual file.
6. Avoid duplicate copies when one approved image can be reused.
7. Check all active references before renaming or removing files.

## 5. Supported File Formats

### WebP

Recommended for most photographic campus images because it can provide good quality at relatively small file sizes.

### AVIF

Consider AVIF when supported by the project’s image pipeline and target browsers.

### JPEG

Suitable for photographs that do not require transparency.

### PNG

Suitable for graphics, diagrams, or images requiring lossless raster output or transparency.

### SVG

Suitable for approved vector illustrations, diagrams, and logos where appropriate.

Review SVG files before publication for scripts, event handlers, embedded `foreignObject` content, and unexpected external references.

Choose the format according to the image, quality requirements, compatibility, and expected display size.

## 6. Image Dimensions and Composition

Choose dimensions according to the component where the image will appear.

Suggested starting points:

- College hero image: approximately 1920 × 1080 pixels.
- Campus banner: approximately 1600 × 600 pixels.
- College profile image: approximately 1200 × 800 pixels.
- Institution card thumbnail: approximately 800 × 600 pixels.
- Small list thumbnail: approximately 400 × 300 pixels.

These are recommendations rather than mandatory dimensions.

### Composition guidelines

- Keep the main building or subject visible after cropping.
- Avoid cutting off important architectural features.
- Use suitable resolution for high-density displays.
- Avoid excessive filters or color adjustments that misrepresent the institution.
- Keep text outside the image whenever practical.
- Do not embed admission deadlines, fees, rankings, or eligibility details into photographs.
- Avoid images that reveal sensitive information on noticeboards, screens, or documents.

## 7. Institutional Accuracy and Verification

College images must be attributed accurately.

Before publishing an institution-specific image:

1. Verify the institution’s full name.
2. Confirm that the image represents the intended campus or facility.
3. Identify the original source.
4. Check permission, licensing, and attribution requirements.
5. Confirm whether the image is current enough for the intended use.
6. Record the source and verification details where appropriate.
7. Avoid implying that the institution endorses MedOrbits unless an authorized relationship exists.

A filename containing a college name is not proof that the image belongs to that institution.

Do not use an image of one institution to represent another institution merely because the buildings look similar.

## 8. Institutional Logos and Official Branding

College logos, university marks, government emblems, and institutional seals must be handled separately from ordinary campus photographs where appropriate.

- Use only authorized or appropriately licensed marks.
- Preserve the original proportions and colors.
- Do not create misleading variations of official logos.
- Do not imply accreditation, partnership, affiliation, or endorsement without authorization.
- Verify institutional branding before displaying it alongside admission guidance.
- Follow any applicable usage and attribution conditions.

When official branding is not available or cannot be used appropriately, use a neutral placeholder instead.

## 9. HTML Usage

Example of a college image:

```html
<figure class=“mo-college-image”>
  <img
    src=“/assets/images/colleges/college-placeholder.webp”
    alt=“Representative college campus placeholder”
    width=“1200”
    height=“800”
    loading=“lazy”
    decoding=“async”
  >
  <figcaption>
    Illustrative campus image
  </figcaption>
</figure>
```

The filename and alternative text are illustrative. Replace them with the actual asset and an accurate description.

For a verified institutional photograph, use alternative text that describes the visible content without making unsupported claims.

Example:

```html
<img
  src=“/assets/images/colleges/verified-campus-image.webp”
  alt=“Exterior of the verified college campus”
  width=“1200”
  height=“800”
  loading=“lazy”
  decoding=“async”
>
```

The example filename is not a claim that such a file exists.

## 10. CSS Integration

Recommended baseline styles:

```css
.mo-college-image {
  margin: 0;
  overflow: hidden;
  border-radius: 0.875rem;
  background: #eee6e2;
}

.mo-college-image img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 3 / 2;
  object-fit: cover;
}

.mo-college-card__image {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: #e8dfe8;
}

.mo-college-image figcaption {
  padding: 0.625rem 0.75rem;
  color: #493b4c;
  font-size: 0.875rem;
}
```

Adjust aspect ratios to suit the actual layout and image composition.

Use `object-fit: cover` when the image should fill a defined area. Check that important details are not cropped. Use `object-fit: contain` when the complete image must remain visible.

## 11. Accessibility

College images should support accessible and understandable educational content.

- Provide meaningful alternative text for informative photographs.
- Use empty alternative text for purely decorative images.
- Do not repeat nearby captions unnecessarily in alternative text.
- Maintain sufficient contrast for any text overlay.
- Ensure image-based content is not the only source of essential admission information.
- Keep captions accurate and readable.
- Avoid placing sensitive personal information in publicly displayed images.
- Ensure the page remains understandable when an image fails to load.

Do not describe a generic placeholder as a photograph of a specific college.

## 12. Responsive Design

Test college images on phones, tablets, laptops, and desktop displays.

Check:

- College profile cards.
- Search results and listing grids.
- Institution detail pages.
- Campus banners.
- Mobile navigation and content layouts.
- Portrait and landscape orientations.
- High-density displays.
- Responsive image cropping.

Use `srcset` and `sizes` where multiple image resolutions are available and beneficial.

Example:

```html
<img
  src=“/assets/images/colleges/college-placeholder.webp”
  srcset=“
    /assets/images/colleges/college-placeholder-400.webp 400w,
    /assets/images/colleges/college-placeholder-800.webp 800w,
    /assets/images/colleges/college-placeholder.webp 1200w
  “
  sizes=“(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw”
  alt=“Representative college campus placeholder”
  width=“1200”
  height=“800”
  loading=“lazy”
  decoding=“async”
>
```

The responsive filenames are examples. Use this pattern only after creating and verifying each referenced file.

## 13. Image Optimization and Performance

College directories and search results may display many images. Optimize them to reduce loading time and unnecessary bandwidth use.

Recommended practices:

1. Compress images while maintaining acceptable visual quality.
2. Prefer WebP or AVIF for suitable photographs.
3. Generate appropriate image sizes for cards and detail pages.
4. Avoid downloading full-resolution photographs for small thumbnails.
5. Use lazy loading for below-the-fold images.
6. Prioritize important above-the-fold imagery when measurements justify it.
7. Set explicit width and height attributes to reduce layout shifts.
8. Reuse approved assets when appropriate.
9. Avoid duplicate downloads and unused variants.
10. Test page performance on mobile connections.

Do not lazy-load critical above-the-fold images automatically without evaluating the impact on loading performance.

## 14. Licensing, Privacy, and Security

Only publish images that MedOrbits owns or is authorized to use.

Where applicable, record:

- Image source.
- Photographer or creator.
- License.
- Attribution requirements.
- Approval status.
- Date acquired.
- Usage restrictions.

Additional requirements:

- Do not publish confidential student records.
- Do not expose identity documents, application forms, phone numbers, or private information.
- Check photographs for visible personal information.
- Review metadata for unnecessary sensitive details.
- Do not assume that an image available online is free for commercial use.
- Review SVG content before publication.
- Keep confidential files outside public asset directories.

Public image URLs are not private storage.

## 15. Data Separation and College Information

Images should remain separate from structured college information.

Maintain institution names, addresses, course details, fees, seat information, eligibility criteria, and official links in the project’s appropriate data files or content system.

For example, if the project uses a college JSON dataset, image paths may be referenced by a college record. The exact schema must follow the existing project implementation.

Illustrative record:

```json
{
  “id”: “example-college”,
  “name”: “Example College”,
  “image”: “/assets/images/colleges/college-placeholder.webp”,
  “imageAlt”: “Representative college campus placeholder”,
  “imageStatus”: “placeholder”
}
```

This is an example schema only. Do not treat the example college or its data as a real institutional record.

Do not infer official fees, rankings, recognition, admission availability, or institutional affiliation from an image.

## 16. Security and Repository Integration

College image references may appear in HTML, CSS, JavaScript, JSON, templates, or content-management systems.

Before moving, renaming, or removing an image:

1. Search the repository for its filename and path.
2. Check direct and dynamically generated references.
3. Update the relevant data and page components.
4. Test the affected pages.
5. Confirm the deployed image loads correctly.

Use consistent paths and exact filename capitalization.

Do not store API keys, credentials, confidential documents, or private application records in this directory.

## 17. Archive Management

Retired college images may be moved to an archive only when there is a documented reason to retain them.

Before archiving:

- Check active references.
- Confirm the replacement image works.
- Record the reason for retirement.
- Preserve relevant source and licensing details.
- Check whether archived files are included in public deployment.

An archive inside a public assets directory is not private storage.

## 18. Troubleshooting

### Image does not load

Check the filename, path, capitalization, file existence, server response, and deployment configuration.

### Wrong college image appears

Review the image source, institution mapping, structured data, and page references. Correct the attribution before republishing.

### Image looks blurry

Use a suitable source resolution and verify that the image is not being enlarged beyond its intended size.

### Image crops incorrectly

Review `object-fit`, `object-position`, the aspect ratio, and the container dimensions.

### Page loads slowly

Optimize image sizes, use suitable formats, avoid unnecessary downloads, and load below-the-fold images when needed.

### Image works locally but fails in production

Check case-sensitive paths, build output, static asset configuration, caching, and deployment paths.

## 19. Publishing Checklist

Before publishing a college image, confirm:

- [ ] The file exists at the referenced path.
- [ ] The filename and format are correct.
- [ ] The institution attribution has been verified.
- [ ] The image is approved for its intended use.
- [ ] Licensing and usage rights have been checked.
- [ ] Institutional branding is used appropriately.
- [ ] No confidential personal information is exposed.
- [ ] The image is optimized for its display size.
- [ ] Desktop and mobile rendering have been tested.
- [ ] Cropping and composition are appropriate.
- [ ] Alternative text and captions are accurate.
- [ ] Structured data references the correct image.
- [ ] No unsupported institutional claims are implied.
- [ ] HTML, CSS, and data references are valid.
- [ ] The deployed image loads successfully.

## 20. Maintenance

The MedOrbits project maintainer or designated asset owner should:

1. Keep college images organized and consistently named.
2. Preserve existing filenames unless a migration is planned.
3. Verify institutional attribution and usage rights.
4. Replace placeholders only with verified, authorized images.
5. Remove duplicate assets when safe and appropriate.
6. Monitor image performance on mobile devices.
7. Retire obsolete images only after checking references.
8. Update this README when directory conventions change.

## 21. Change Log

**Version 1.0.0 — 2026-10-24**

- Established college image asset-management standards.
- Defined directory structure and naming conventions.
- Added image format, dimensions, and composition guidance.
- Documented institutional verification and logo usage requirements.
- Added HTML, CSS, accessibility, responsive design, and performance guidance.
- Added licensing, privacy, data separation, security, and troubleshooting procedures.
- Added publishing and maintenance checklists.

—

Maintainer: MedOrbits Project  
Canonical directory: `/assets/images/colleges/`  
Document: `README.md`

This document defines college image asset-management guidance. It does not supply image artwork or certify the ownership, approval, licensing, or accuracy of any particular image.
