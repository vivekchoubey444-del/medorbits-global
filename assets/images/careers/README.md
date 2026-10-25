
# MedOrbits Careers Assets

**Canonical directory:** `/assets/images/careers/`  
**Project:** MedOrbits  
**Document version:** 1.0.0  
**Last updated:** 2026-10-24  
**Purpose:** Standards for managing, validating, and publishing career and recruitment-related image assets.

## 1. Purpose

The `assets/images/careers/` directory stores approved images used for MedOrbits careers, recruitment, employment opportunities, job assistance, professional development, and career guidance pages.

Assets may include career banners, workplace photography, recruitment illustrations, professional-development graphics, and other approved visuals that support career-related content.

Images should communicate professionalism, opportunity, trust, inclusion, and clarity while remaining consistent with the MedOrbits visual identity.

This directory is intended for website-ready assets. Do not use it for confidential applicant documents, CVs, identity documents, recruitment records, or other private information.

## 2. Recommended Directory Structure

```text
assets/
└── images/
    └── careers/
        ├── README.md
        ├── careers-hero.webp
        ├── careers-banner.webp
        ├── job-assistance.webp
        ├── recruitment-services.webp
        ├── professional-development.webp
        ├── career-guidance.webp
        ├── workplace-collaboration.webp
        ├── internship-opportunities.webp
        ├── employer-services.webp
        └── archive/
```

These filenames are examples only. Create files only when the artwork exists, is approved, and is needed by the project.

Preserve existing filenames and paths when active pages depend on them.

## 3. Intended Uses

### Careers hero

A primary visual for the careers landing page. It should establish a professional, welcoming first impression and leave sufficient space for headings and calls to action.

### Job assistance

Visuals supporting job-search guidance, application preparation, CV improvement, interview preparation, and career planning.

Do not imply guaranteed employment or guaranteed placement unless the organization can substantiate and formally authorize such claims.

### Recruitment services

Images illustrating recruitment workflows, employer services, candidate engagement, and professional hiring environments.

Avoid visuals that imply partnerships, client relationships, or endorsements that have not been authorized.

### Professional development

Images supporting skills development, training, mentoring, career transitions, and lifelong learning.

### Internship and early-career opportunities

Images intended for internship guidance, entry-level career information, and early professional development.

Ensure that the imagery does not misrepresent eligibility, job availability, or actual employment opportunities.

## 4. Naming Conventions

Use lowercase kebab-case and descriptive filenames.

Examples:

- `careers-hero.webp`
- `careers-banner.webp`
- `job-assistance.webp`
- `recruitment-services.webp`
- `career-guidance.webp`
- `professional-development.webp`
- `workplace-collaboration.webp`
- `internship-opportunities.webp`
- `employer-services.webp`

Guidelines:

1. Use filenames that describe the image’s purpose.
2. Avoid names such as `career-final2.jpg` or `new-banner.png`.
3. Use consistent capitalization and file extensions.
4. Do not rename files without checking project references.
5. Do not change an extension without actually converting the file.
6. Avoid duplicate copies when an approved image can be reused.
7. Use date suffixes only when they help distinguish meaningful versions.

## 5. Supported Image Formats

### WebP

Recommended for most photographic career images because it can provide good image quality at a relatively small file size.

### AVIF

Consider AVIF when supported by the project’s image pipeline and target browsers.

### JPEG

Suitable for photographs that do not require transparency.

### PNG

Suitable for transparent graphics, diagrams, and artwork that requires lossless raster output.

### SVG

Suitable for approved vector illustrations, icons, and simple graphics.

Review SVG files before publication. Check for scripts, event handlers, embedded `foreignObject` content, and unexpected external references.

Choose formats according to the actual artwork and the project’s compatibility requirements.

## 6. Image Dimensions and Composition

Choose dimensions according to the intended component.

Suggested starting points:

- Careers hero: approximately 1920 × 1080 pixels.
- Wide recruitment banner: approximately 1920 × 600 pixels.
- Content illustration: approximately 1200 × 800 pixels.
- Card thumbnail: approximately 800 × 600 pixels.
- Small decorative graphic: use dimensions appropriate to its display size.

These are recommendations, not mandatory specifications.

### Composition requirements

- Keep important subjects visible after responsive cropping.
- Leave sufficient negative space for text overlays.
- Avoid placing faces or important details behind buttons and headings.
- Avoid distracting backgrounds behind forms.
- Use images with suitable resolution for high-density displays.
- Do not embed essential instructions or job details only inside an image.

## 7. Visual Identity

Career imagery should complement the MedOrbits design system.

Suitable visual directions include:

- Professional workplace photography.
- Modern educational and career environments.
- Natural, approachable human interactions.
- Subtle geometric illustrations.
- Restrained champagne-gold accents.
- Premium aubergine and burgundy tones.
- Soft blue-grey, sage, warm beige, and muted lavender backgrounds.

Avoid excessive saturation, stereotypical imagery, misleading professional settings, and unnecessary visual effects.

Use the same overall visual quality across careers, recruitment, job assistance, and professional-development pages.

## 8. HTML Usage

Example careers hero:

```html
<section class=“mo-careers-hero”>
  <div class=“mo-careers-hero__content”>
    <h1>Build Your Career with MedOrbits</h1>
    <p>
      Explore career guidance, job assistance, and professional development resources.
    </p>
    <a href=“/careers.html” class=“mo-careers-hero__link”>
      Explore Career Resources
    </a>
  </div>
</section>
```

This content is illustrative. Replace the text and destination with the actual page content and verified routes used by the project.

Example of a meaningful image:

```html
<img
  src=“/assets/images/careers/workplace-collaboration.webp”
  alt=“Professionals collaborating in a workplace”
  width=“1200”
  height=“800”
  loading=“lazy”
  decoding=“async”
>
```

Use accurate alternative text that describes the actual image. Do not use the example description if it does not match the asset.

## 9. CSS Background Example

```css
.mo-careers-hero {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  min-height: 28rem;
  padding: clamp(1.5rem, 5vw, 4rem);
  color: #fff4df;
  background-color: #21152b;
  background-image:
    linear-gradient(
      90deg,
      rgba(16, 10, 25, 0.88),
      rgba(16, 10, 25, 0.34)
    ),
    url(“/assets/images/careers/careers-hero.webp”);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}

.mo-careers-hero__content {
  width: min(100%, 44rem);
}

.mo-careers-hero__link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  background: #c9a96e;
  color: #180f20;
  font-weight: 600;
  text-decoration: none;
}

.mo-careers-hero__link:focus-visible {
  outline: 3px solid #fff0bd;
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .mo-careers-hero {
    min-height: 24rem;
    padding: 1.5rem;
    background-position: center;
  }
}
```

The image path is illustrative. Confirm that the referenced file exists before using this CSS.

## 10. Accessibility

All career images must support accessible, usable page layouts.

- Provide meaningful alternative text for informative images.
- Use `alt=“”` for purely decorative images.
- Maintain sufficient contrast for overlaid text.
- Ensure buttons and links remain distinguishable.
- Do not communicate job eligibility or application instructions only through images.
- Avoid flashing or distracting animations.
- Preserve content readability at increased zoom.
- Ensure essential content remains available if an image fails to load.

For background images, use a suitable fallback background color.

## 11. Responsive Design

Test career assets across phones, tablets, laptops, and desktop displays.

Verify:

- Hero image cropping.
- Banner focal points.
- Card thumbnail consistency.
- Image scaling and aspect ratios.
- Text overlay placement.
- Navigation and footer layouts.
- Form and application interface readability.
- Portrait and landscape orientations.

Use `background-size: cover` when a background must fill a component, but verify that cropping does not remove important visual information.

## 12. Performance Optimization

Career pages may contain multiple images. Optimize them to avoid unnecessary loading delays.

Recommended practices:

1. Compress images without unacceptable visual degradation.
2. Prefer WebP or AVIF for suitable photographic assets.
3. Use appropriate dimensions for the displayed size.
4. Avoid oversized source images when smaller assets are sufficient.
5. Lazy-load below-the-fold content images.
6. Avoid lazy-loading a critical hero image without evaluating its effect on loading performance.
7. Set explicit image width and height to reduce layout shifts.
8. Reuse approved assets where practical.
9. Avoid loading duplicate images and unused variants.
10. Check image requests and page performance on mobile connections.

## 13. Privacy, Consent, and Image Rights

Career-related imagery must comply with applicable privacy, consent, and licensing requirements.

- Publish only images MedOrbits owns or is authorized to use.
- Obtain appropriate permission for identifiable people when required.
- Follow license and attribution requirements.
- Do not publish applicant CVs, identity documents, phone numbers, email addresses, or private recruitment records as image assets.
- Do not include confidential employer or candidate information in images or metadata.
- Avoid presenting stock photography as proof of actual employees, offices, clients, or recruitment partnerships.
- Do not use an institution’s logo or branding in a way that implies unauthorized affiliation.

Public image URLs are not private storage.

## 14. Employment and Recruitment Claims

Career imagery must not create misleading impressions about the services offered.

- Do not imply guaranteed jobs, salaries, internships, admissions, or placements without substantiated authorization.
- Do not depict fictional vacancies as verified openings.
- Do not use images that imply an employer partnership that does not exist.
- Keep promotional artwork consistent with the actual service and its conditions.
- Ensure that claims displayed within graphics match the corresponding page content.

Actual job listings, eligibility criteria, application deadlines, and employer details should be maintained as verified text or structured data, not only as image content.

## 15. Security

- Review SVG files before publication.
- Avoid untrusted embedded active content.
- Do not store secrets or credentials in image metadata.
- Check file sources and licensing.
- Remove unnecessary metadata when appropriate.
- Do not expose confidential recruitment documents through public asset paths.
- Confirm that public assets are intended for public access.

## 16. Repository Integration

Career image references may appear in HTML, CSS, JavaScript, templates, or content data.

Before renaming, moving, or removing an asset:

1. Search the repository for its filename and path.
2. Check all affected pages and components.
3. Update references consistently.
4. Test the page locally or in the project’s test environment.
5. Verify the deployed asset path.

Use the project’s established path conventions and ensure filename capitalization matches exactly.

## 17. Archive Management

Move retired career images into an appropriate archive only when there is a documented reason to retain them.

Before archiving:

- Check active references.
- Confirm any replacement image works.
- Record the reason for retirement.
- Preserve relevant licensing information.
- Check whether archived assets are included in public deployment.

An archive inside a public assets directory is not private storage.

## 18. Troubleshooting

### Image does not load

Check the path, filename capitalization, file existence, server response, and deployment configuration.

### Image appears blurry

Use an appropriate source resolution and verify that the image is not being enlarged excessively.

### Image crops incorrectly

Review the aspect ratio, `object-fit`, `background-size`, `background-position`, and component dimensions.

### Text is difficult to read

Improve contrast, adjust the overlay, or choose a less busy image.

### Career page loads slowly

Inspect image sizes, remove unnecessary downloads, optimize the assets, and defer below-the-fold images where appropriate.

### Image works locally but fails in production

Check case-sensitive paths, build output, static asset configuration, caching, and the deployed file location.

## 19. Publishing Checklist

Before publishing a career image, confirm:

- [ ] The file exists at the referenced path.
- [ ] The filename and extension are correct.
- [ ] The image is approved for its intended use.
- [ ] Usage rights and licensing have been checked.
- [ ] Consent requirements have been addressed where applicable.
- [ ] No confidential candidate or employer information is exposed.
- [ ] The image is optimized for its intended display size.
- [ ] Desktop and mobile layouts have been tested.
- [ ] Cropping and focal positioning are acceptable.
- [ ] Text contrast and alternative text are appropriate.
- [ ] HTML and CSS references are valid.
- [ ] No unsupported employment or partnership claims are implied.
- [ ] The production asset loads successfully.

## 20. Maintenance

The MedOrbits project maintainer or designated asset owner should:

1. Keep career assets organized by purpose.
2. Preserve existing filenames unless a migration is planned.
3. Review licensing, consent, privacy, and security requirements.
4. Remove duplicate assets when safe and appropriate.
5. Monitor performance on mobile devices.
6. Retire obsolete assets only after checking active references.
7. Keep this README aligned with the actual directory structure.
8. Update the document when naming or publishing rules change.

## 21. Change Log

**Version 1.0.0 — 2026-10-24**

- Established career and recruitment asset-management standards.
- Defined directory structure and naming conventions.
- Added format, dimensions, composition, and responsive design guidance.
- Documented accessibility, performance, privacy, licensing, and security requirements.
- Added employment-claims guidance, troubleshooting, and publishing checklists.

—

Maintainer: MedOrbits Project  
Canonical directory: `/assets/images/careers/`  
Document: `README.md`

This document defines career image asset-management guidance. It does not provide artwork or certify the ownership, approval, licensing, or contents of any specific image.
