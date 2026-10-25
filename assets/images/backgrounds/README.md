
# MedOrbits Background Assets

**Canonical directory:** `/assets/images/backgrounds/`  
**Project:** MedOrbits  
**Document version:** 1.0.0  
**Last updated:** 2026-10-24  
**Purpose:** Standards for managing, optimizing, and publishing website background assets.

## 1. Purpose

The `assets/images/backgrounds/` directory stores approved visual assets used as backgrounds throughout the MedOrbits website and application.

Backgrounds may support page layouts, hero sections, banners, promotional areas, course pages, authentication screens, and other interface components.

The MedOrbits design system prioritizes a premium, professional appearance, using carefully selected colors, subtle textures, restrained gradients, and readable content.

This directory is intended for website-ready assets, not confidential files, temporary downloads, or unapproved artwork.

## 2. Recommended Directory Structure

```text
assets/
└── images/
    └── backgrounds/
        ├── README.md
        ├── hero-background.webp
        ├── homepage-background.webp
        ├── about-background.webp
        ├── courses-background.webp
        ├── admissions-background.webp
        ├── contact-background.webp
        ├── login-background.webp
        ├── dashboard-background.webp
        ├── subtle-texture.webp
        ├── decorative-pattern.svg
        └── archive/
```

The filenames above are examples only. Create files only when they exist, are approved, and are required by the project. Preserve existing filenames and paths when active pages depend on them.

## 3. Naming Conventions

Use lowercase kebab-case and descriptive filenames.

Examples:

- `hero-background.webp`
- `homepage-background.webp`
- `admissions-background.webp`
- `contact-background.webp`
- `login-background.webp`
- `subtle-texture.webp`
- `decorative-pattern.svg`

Guidelines:

1. Describe the intended page or visual purpose.
2. Avoid unclear names such as `bg-final2.jpg` or `new-image.png`.
3. Use consistent file extensions and capitalization.
4. Do not rename an asset without checking all references.
5. Do not change a file extension without actually converting the file.
6. Avoid duplicate copies when one approved asset can serve multiple pages.

## 4. Supported Formats

### WebP

Recommended for photographic backgrounds and complex raster artwork because it can provide good visual quality at a relatively small file size.

### AVIF

Consider AVIF for photographic backgrounds when the supported browser environment and image pipeline allow it.

### JPEG

Suitable for photographs that do not require transparency.

### PNG

Use PNG when transparency or lossless raster output is necessary. Avoid unnecessarily large PNG files for photographic backgrounds.

### SVG

Suitable for scalable decorative patterns, geometric backgrounds, and simple vector artwork.

Review SVG source before publication. Check for scripts, event handlers, embedded `foreignObject` content, and unexpected external references.

### CSS Gradients

Use CSS gradients instead of image files when the background can be produced efficiently with CSS.

Example:

```css
.mo-background {
  background:
    radial-gradient(
      circle at 15% 15%,
      rgba(201, 169, 110, 0.15),
      transparent 40%
    ),
    linear-gradient(
      135deg,
      #f1e8e3,
      #e6dce8,
      #dce7ef
    );
}
```

## 5. MedOrbits Visual Design Standards

Backgrounds should support the website’s content rather than compete with it.

Recommended design directions include:

- Premium champagne and warm beige.
- Soft burgundy and muted maroon.
- Sage and muted green.
- Lavender and subdued aubergine.
- Peach and warm grey.
- Sapphire blue and blue-grey.
- Deep aubergine with restrained gold accents.
- Subtle geometric patterns and low-contrast textures.

Avoid excessively bright backgrounds, harsh color combinations, distracting patterns, and unnecessary visual effects.

Background colors should remain consistent with the page’s branding, purpose, and accessibility requirements.

## 6. Background Image Dimensions

Choose image dimensions according to the component where the background will appear.

Suggested starting points:

- Hero background: approximately 1920 × 1080 pixels.
- Wide page banner: approximately 1920 × 600 pixels.
- Section background: approximately 1600 × 900 pixels.
- Card background: approximately 800 × 600 pixels.
- Small texture: use a suitably optimized repeatable pattern.

These are recommendations, not mandatory dimensions. Determine the actual dimensions based on the component’s layout and expected display size.

Do not force all backgrounds into the same aspect ratio.

## 7. Image Composition and Readability

When preparing a background:

1. Keep the primary visual subject away from important text where practical.
2. Leave sufficient negative space for headings and buttons.
3. Check cropping on mobile and desktop.
4. Maintain readable foreground text.
5. Avoid placing important information inside a background image.
6. Use CSS overlays when necessary to improve contrast.
7. Avoid unnecessary visual clutter behind forms and navigation.

Backgrounds should remain decorative. Essential text, labels, instructions, and interface information must remain available as HTML content.

## 8. HTML Usage

Use a background image only when it is appropriate for the component.

Example:

```html
<section class=“mo-hero”>
  <div class=“mo-hero__content”>
    <h1>Explore Your Future with MedOrbits</h1>
    <p>Discover educational opportunities and admission guidance.</p>
    <a href=“/courses.html” class=“mo-hero__button”>
      Explore Courses
    </a>
  </div>
</section>
```

The text above is illustrative. Replace it with the approved content for the actual page.

## 9. CSS Background Usage

Example using an image asset:

```css
.mo-hero {
  position: relative;
  isolation: isolate;
  min-height: 28rem;
  display: flex;
  align-items: center;
  padding: clamp(1.5rem, 5vw, 4rem);
  background-color: #24152d;
  background-image:
    linear-gradient(
      90deg,
      rgba(16, 10, 25, 0.88),
      rgba(16, 10, 25, 0.35)
    ),
    url(“/assets/images/backgrounds/hero-background.webp”);
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  color: #fff4df;
}

.mo-hero__content {
  width: min(100%, 44rem);
}

.mo-hero__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  background: #c9a96e;
  color: #180f20;
  text-decoration: none;
  font-weight: 600;
}

@media (max-width: 640px) {
  .mo-hero {
    min-height: 24rem;
    background-position: center;
    padding: 1.5rem;
  }
}
```

The asset path is an example. Confirm that the referenced file exists before using this CSS in production.

## 10. Responsive Design

Backgrounds must work across phones, tablets, laptops, and desktop displays.

Check:

- Wide and narrow screen layouts.
- Portrait and landscape orientations.
- Text placement and readability.
- Background cropping and focal points.
- Form and card visibility.
- Sticky headers and navigation overlays.
- High-density displays.
- Browser zoom and text scaling.

Use `background-size: cover` when the background should fill a component, understanding that cropping may occur.

Use `background-size: contain` when the complete image must remain visible, understanding that empty space may remain.

For important focal points, adjust `background-position` or use responsive image alternatives.

## 11. Accessibility and Contrast

Backgrounds must not reduce the usability of foreground content.

- Maintain sufficient text contrast.
- Use overlays when necessary.
- Avoid rapidly flashing or distracting background effects.
- Do not rely on background images to communicate essential information.
- Respect reduced-motion preferences when backgrounds are animated.
- Check links, buttons, labels, and form controls against the actual rendered background.
- Ensure content remains understandable if a background image fails to load.

Provide a suitable fallback background color for every image-based section.

## 12. Performance Optimization

Background assets can increase page load time if they are too large or poorly optimized.

Recommended practices:

1. Compress images without unacceptable visual degradation.
2. Prefer WebP or AVIF for suitable photographic backgrounds.
3. Use SVG for appropriate lightweight vector patterns.
4. Avoid loading large images for small components.
5. Avoid downloading multiple unused background variants.
6. Reuse approved assets when practical.
7. Set suitable image dimensions and responsive behavior.
8. Use a solid or gradient fallback.
9. Review the network panel for unnecessary downloads.
10. Test performance on mobile connections.

Do not lazy-load a critical above-the-fold hero background without evaluating its impact on loading performance. Consider preload or other prioritization only when measurements justify it.

For below-the-fold sections, defer unnecessary image downloads where the implementation supports it.

## 13. CSS and Asset Security

- Use trusted assets from the project or authorized sources.
- Review SVG files before publication.
- Avoid embedding untrusted active content.
- Do not place secrets or private information inside asset files or metadata.
- Avoid unexpected external image dependencies.
- Verify that URLs point to intended resources.
- Do not assume that an asset is safe merely because it has an image extension.

Public image paths should contain only material intended for public delivery.

## 14. Licensing and Usage Rights

Publish only backgrounds that MedOrbits owns or is authorized to use.

Where appropriate, record:

- Asset source.
- Creator or provider.
- License.
- Attribution requirements.
- Approval status.
- Usage restrictions.
- Date added.

Do not assume that an image found online is free to use commercially.

Avoid using copyrighted artwork, institutional branding, or third-party promotional graphics without the required authorization.

## 15. Caching and Version Control

Use stable filenames for unchanged assets.

When replacing a deployed background:

1. Confirm the replacement is approved.
2. Check all HTML and CSS references.
3. Decide whether the filename should remain stable or be versioned.
4. Update references when necessary.
5. Invalidate caches where required.
6. Verify the production asset.
7. Confirm that the previous background is no longer unintentionally displayed.

Do not remove an old background until active references have been checked.

## 16. Archive Management

Move retired backgrounds to an archive only when there is a clear reason to retain them.

Before archiving:

- Search for active references.
- Confirm that the replacement is working.
- Record the retirement reason.
- Preserve useful licensing and source information.
- Check whether archived files are included in public deployment.

An archive directory inside a public assets directory is not private storage.

## 17. Troubleshooting

### Background does not appear

Check:

- The file exists.
- The path is correct.
- Filename capitalization matches.
- CSS is being loaded.
- The file is accessible from the deployed site.
- The element has visible dimensions.
- No later CSS rule overrides the background.

### Image is cropped incorrectly

Review `background-size`, `background-position`, the container’s dimensions, and the image’s aspect ratio.

### Text is difficult to read

Increase the contrast, adjust the overlay, or select a less busy image. Do not rely on a shadow alone to fix inadequate contrast.

### Page loads slowly

Reduce image dimensions and file size, avoid unnecessary background variants, and check network requests. Do not sacrifice necessary image quality or accessibility.

### Background works locally but fails in production

Check case-sensitive paths, build output, deployment configuration, caching, and the server’s static asset handling.

## 18. Publishing Checklist

Before deploying a background asset:

- [ ] The file exists at the referenced path.
- [ ] The filename and extension are correct.
- [ ] The image is approved for its intended use.
- [ ] Ownership or usage rights have been checked.
- [ ] The image is appropriately optimized.
- [ ] Desktop and mobile rendering have been tested.
- [ ] Cropping and focal positioning are acceptable.
- [ ] Text and interface contrast are sufficient.
- [ ] A fallback background color is defined.
- [ ] The asset does not contain unintended private information.
- [ ] SVG content has been reviewed where applicable.
- [ ] HTML and CSS references are valid.
- [ ] Production loading and caching have been checked.
- [ ] The README and asset inventory are updated when necessary.

## 19. Maintenance

The MedOrbits project maintainer or designated asset owner should:

1. Keep background assets organized by purpose.
2. Preserve existing paths unless a migration is planned.
3. Remove duplicate assets when safe and appropriate.
4. Review licensing and security before publication.
5. Monitor performance on mobile devices.
6. Retire obsolete assets only after checking references.
7. Update this README when directory conventions change.
8. Keep example filenames clearly distinguished from actual assets.

## 20. Change Log

**Version 1.0.0 — 2026-10-24**

- Established background asset-management standards.
- Defined directory structure and naming conventions.
- Added format, dimension, composition, and responsive design guidance.
- Documented accessibility, performance, security, and licensing requirements.
- Added caching, troubleshooting, publishing, and maintenance procedures.

—

Maintainer: MedOrbits Project  
Canonical directory: `/assets/images/backgrounds/`  
Document: `README.md`

This document defines background asset-management guidance. It does not provide background artwork or certify the ownership, approval, or contents of any specific image.
