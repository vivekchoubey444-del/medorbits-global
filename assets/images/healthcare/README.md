
# MedOrbits — Healthcare Image Assets

**Directory:** `/assets/images/healthcare/`  
**Project:** MedOrbits  
**Document:** Healthcare Image Asset Guidelines  
**Version:** 1.0.0  
**Last Updated:** 2026-10-24

—

## 1. Purpose

The `/assets/images/healthcare/` directory stores approved visual assets used throughout the MedOrbits website for healthcare information, medical education, clinical services, allied health professions, patient guidance, and healthcare career resources.

Images should help users understand healthcare topics while maintaining professional presentation, factual accuracy, privacy, accessibility, and appropriate visual sensitivity.

This document establishes standards for image organization, naming, optimization, implementation, licensing, privacy, and maintenance.

**Important:** Filenames and directory structures shown below are examples and recommendations. They do not confirm that the files already exist in the repository.

—

## 2. Recommended Directory Structure

```text
assets/
└── images/
    └── healthcare/
        ├── README.md
        ├── medical/
        │   ├── general-medicine.webp
        │   ├── clinical-training.webp
        │   ├── medical-research.webp
        │   └── hospital-care.webp
        ├── nursing/
        │   ├── nursing-education.webp
        │   └── nursing-care.webp
        ├── diagnostics/
        │   ├── medical-laboratory.webp
        │   ├── diagnostic-imaging.webp
        │   └── pathology.webp
        ├── allied-health/
        │   ├── physiotherapy.webp
        │   ├── rehabilitation.webp
        │   ├── operation-theatre.webp
        │   └── emergency-care.webp
        ├── pharmacy/
        │   ├── pharmaceutical-sciences.webp
        │   └── pharmacy-practice.webp
        ├── public-health/
        │   ├── community-health.webp
        │   └── health-awareness.webp
        ├── healthcare-careers/
        │   ├── healthcare-professionals.webp
        │   └── healthcare-team.webp
        ├── facilities/
        │   ├── hospital-exterior.webp
        │   └── healthcare-facility.webp
        └── placeholders/
            ├── healthcare-placeholder.webp
            └── healthcare-placeholder.svg
```

Create only the folders and files needed by the actual project. Avoid empty folders and references to missing assets.

—

## 3. Supported Image Categories

### 3.1 Medical education

Images may represent:

- Medical students in supervised training.
- Clinical skills education.
- Medical research and laboratory learning.
- Anatomy and medical science education.
- Hospital-based teaching environments.
- Medical simulation and practical learning.

Do not portray simulated training as real patient treatment.

### 3.2 Nursing and patient care

Images may represent:

- Nursing education and practical training.
- General patient-care environments.
- Professional teamwork.
- Healthcare communication.
- Patient safety and care coordination.

Patient photographs must be used only with appropriate permissions and safeguards.

### 3.3 Diagnostics and laboratory sciences

Images may represent:

- Medical laboratory technology.
- Diagnostic imaging.
- Pathology and laboratory research.
- Scientific instruments.
- Sample analysis and laboratory education.

Do not expose patient identifiers, laboratory reports, medical records, or other confidential information.

### 3.4 Allied health and rehabilitation

Images may represent:

- Physiotherapy.
- Rehabilitation and mobility support.
- Occupational therapy.
- Emergency medical training.
- Operation theatre technology.
- Other allied health professions.

Ensure that images accurately represent the activity and professional context.

### 3.5 Pharmacy and pharmaceutical sciences

Images may represent:

- Pharmacy education.
- Pharmaceutical research.
- Medication safety education.
- Drug formulation laboratories.
- Pharmacy practice and professional training.

Do not use imagery that implies a medicine is approved, effective, or suitable for a particular person without supporting evidence.

### 3.6 Public health and community care

Images may represent:

- Community health education.
- Preventive healthcare awareness.
- Public health research.
- Health education programmes.
- Community outreach and health promotion.

Avoid stigmatizing or misleading representations of patients, communities, disabilities, or medical conditions.

### 3.7 Healthcare careers

Images may represent:

- Healthcare professionals at work.
- Medical and allied health teams.
- Professional training.
- Healthcare recruitment and career guidance.
- Workplace and clinical learning environments.

Images must not imply a confirmed job vacancy, employment guarantee, institutional partnership, or professional qualification unless the accompanying claims are verified.

—

## 4. File Naming Convention

Use descriptive, lowercase filenames with hyphens between words.

### Recommended

```text
clinical-training.webp
medical-laboratory.webp
diagnostic-imaging.webp
nursing-education.webp
physiotherapy.webp
community-health.webp
healthcare-careers.webp
healthcare-placeholder.webp
```

### Avoid

```text
IMG_2345.jpg
newimage-final.png
Health Image 2.JPG
download(4).webp
```

### Naming rules

1. Use lowercase letters.
2. Separate words with hyphens.
3. Describe the subject or purpose.
4. Avoid spaces and unnecessary special characters.
5. Avoid vague filenames such as `image1` or `photo-final`.
6. Use consistent terminology throughout the repository.
7. Preserve existing filenames when active pages already depend on them.
8. Update all references if a filename must change.
9. Use suffixes such as `-banner`, `-card`, or `-thumbnail` only when they identify a genuine variant.

Examples:

```text
medical-laboratory-card.webp
medical-laboratory-banner.webp
medical-laboratory-thumbnail.webp
```

—

## 5. Supported Image Formats

| Format | Recommended use |
|—|—|
| WebP | General healthcare photographs and website cards |
| AVIF | Optimized photographic imagery where supported |
| JPEG | Photographs requiring broad compatibility |
| PNG | Graphics requiring lossless quality or transparency |
| SVG | Simple icons, diagrams, and scalable illustrations |
| GIF | Avoid for normal healthcare imagery unless animation is necessary |

Prefer WebP for most photographic assets. Use SVG for suitable vector graphics rather than photographs.

Choose the format that maintains appropriate visual quality while minimizing file size.

—

## 6. Image Dimensions and Aspect Ratios

Use consistent dimensions for predictable layouts.

| Placement | Recommended aspect ratio | Suggested dimensions |
|—|—|—|
| Healthcare card | 4:3 | 800 × 600 px |
| Small thumbnail | 1:1 | 500 × 500 px |
| Healthcare page banner | 16:9 | 1600 × 900 px |
| Wide hero image | 21:9 | 1680 × 720 px |
| Small icon or illustration | 1:1 | 256 × 256 px |
| Educational infographic | Depends on content | Designed for responsive scaling |

These values are recommendations, not mandatory requirements.

### Composition guidelines

- Keep the primary subject clearly visible.
- Avoid stretching or distorting photographs.
- Use consistent crops within a card grid.
- Leave suitable space for headings on banner images.
- Avoid placing important content near crop boundaries.
- Ensure the image remains understandable on small screens.
- Do not use graphic or distressing medical imagery for decorative purposes.
- Do not use a photograph of a specific hospital or institution without verifying its identity.

—

## 7. MedOrbits Visual Identity

Healthcare imagery should complement the premium MedOrbits design system.

### Recommended colour palette

- Sapphire blue
- Deep navy
- Royal blue
- Burgundy
- Imperial aubergine
- Champagne gold
- Warm grey
- Soft blue-grey
- Muted beige

Avoid pure-white background sections when creating new website artwork. Where appropriate, use softly tinted backgrounds, subtle gradients, and restrained visual textures.

Healthcare content must still prioritize clarity, trust, and readability over decoration.

### Visual standards

Images should be:

- Relevant to the healthcare subject.
- Professional and respectful.
- High enough in resolution for the intended display.
- Free from unauthorized watermarks.
- Consistent with the MedOrbits visual system.
- Suitable for the intended audience.
- Free from misleading text overlays and unsupported claims.

Do not add government emblems, medical council seals, hospital logos, or university branding unless their use is authorized and appropriate.

—

## 8. Medical Accuracy and Ethical Representation

Healthcare imagery can influence users’ understanding of medical topics. Use accurate, context-appropriate visuals.

### Requirements

1. Do not misrepresent simulated training as actual treatment.
2. Do not imply that a generic facility is a named hospital.
3. Do not use an image to imply medical endorsement by an institution.
4. Do not suggest that a particular treatment guarantees recovery.
5. Do not use misleading before-and-after medical photographs.
6. Avoid sensational, stigmatizing, or unnecessarily graphic images.
7. Use relevant illustrations for complex medical concepts when photographs may be misleading.
8. Ensure that diagrams and infographics are reviewed for scientific accuracy.
9. Do not imply that MedOrbits provides clinical treatment unless that service is genuinely offered.
10. Review medical claims separately from image selection.

Images support educational content; they do not replace clinical evidence or professional medical advice.

—

## 9. HTML Implementation

Use meaningful alternative text, explicit dimensions, and appropriate loading behaviour.

### Example: healthcare card

```html
<article class=“healthcare-card”>
  <img
    src=“/assets/images/healthcare/diagnostics/medical-laboratory.webp”
    alt=“Medical laboratory equipment used for diagnostic testing”
    width=“800”
    height=“600”
    loading=“lazy”
    decoding=“async”
  >

  <div class=“healthcare-card__content”>
    <h2>Medical Laboratory Technology</h2>
    <p>
      Explore laboratory-based healthcare education and related
      professional pathways.
    </p>

    <a href=“/pages/healthcare/medical-laboratory-technology.html”>
      Explore the field
    </a>
  </div>
</article>
```

**Implementation note:** Replace example paths with actual project paths. The example does not confirm that the referenced image or HTML page exists.

### Decorative imagery

For an image that is purely decorative and adds no information:

```html
<img
  src=“/assets/images/healthcare/placeholders/healthcare-placeholder.webp”
  alt=“”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>
```

Use an empty `alt` attribute only when the image is genuinely decorative or its information is already conveyed in the surrounding content.

### Responsive images

```html
<img
  src=“/assets/images/healthcare/medical/clinical-training.webp”
  srcset=“
    /assets/images/healthcare/medical/clinical-training-400.webp 400w,
    /assets/images/healthcare/medical/clinical-training-800.webp 800w,
    /assets/images/healthcare/medical/clinical-training-1200.webp 1200w
  “
  sizes=“(max-width: 600px) 100vw,
         (max-width: 1024px) 50vw,
         33vw”
  alt=“Students practising clinical skills in a supervised learning environment”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>
```

Create and reference the alternative sizes only when those files actually exist.

—

## 10. CSS Guidelines

Use consistent aspect ratios, prevent layout shifts, and maintain readable contrast.

```css
.healthcare-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(35, 57, 100, 0.16);
  border-radius: 1rem;
  background: #eef1f8;
  color: #202944;
}

.healthcare-card__media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    #dce6f7,
    #e8e0ed,
    #f0e4cf
  );
}

.healthcare-card__media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.healthcare-card__content {
  padding: 1rem;
}

.healthcare-card a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

@media (max-width: 600px) {
  .healthcare-card__content {
    padding: 0.875rem;
  }
}
```

The example CSS assumes a matching `.healthcare-card__media` wrapper. Adapt the selectors to the actual markup and reuse existing design tokens where available.

—

## 11. Accessibility Requirements

Healthcare content should remain accessible to people using assistive technologies and different devices.

- Provide meaningful alternative text for informative images.
- Use `alt=“”` for decorative images.
- Do not repeat nearby headings unnecessarily in alternative text.
- Do not embed essential health or admission information only inside an image.
- Maintain sufficient contrast between text and image backgrounds.
- Provide captions or descriptions when diagrams need explanation.
- Ensure links and controls remain keyboard accessible.
- Do not rely on colour alone to convey meaning.
- Avoid flashing imagery and distracting animation.
- Check the layout at increased zoom and on small screens.
- Ensure that images do not obscure text, warnings, or important instructions.

Alternative text should describe the purpose of the image in context rather than merely naming the file.

—

## 12. Privacy, Consent, and Confidentiality

Healthcare imagery may contain sensitive information. Review every image carefully before publication.

### Before publishing

1. Verify the image source and permitted use.
2. Obtain appropriate consent or authorization where required.
3. Remove or obscure identifiable patient information.
4. Check medical documents, monitors, screens, and visible records.
5. Remove unnecessary location and device metadata.
6. Do not publish patient records, prescriptions, reports, or identity documents.
7. Do not publish identifiable patient photographs without appropriate authorization.
8. Avoid using identifiable minors without the required permissions and safeguards.
9. Ensure that images do not disclose private information about healthcare workers or students.
10. Follow applicable privacy, copyright, and data-protection requirements.

Do not place confidential user-uploaded documents in this public image directory.

—

## 13. Copyright and Licensing

Every image must have a known source and permitted usage.

Acceptable sources may include:

- Original MedOrbits artwork.
- Photographs commissioned with appropriate usage rights.
- Properly licensed stock images.
- Openly licensed images used according to their terms.
- Official institutional images where reuse is permitted.

Do not assume that images found through search engines, social media, college brochures, or other websites are free to reuse.

### Recommended asset register

| Field | Description |
|—|—|
| Filename | Exact image filename |
| Category | Medical, nursing, diagnostics, or other category |
| Source | Original source or provider |
| Creator | Photographer, designer, or organization |
| License | Applicable license or permission |
| Attribution | Required credit, if any |
| Verification date | Date usage rights were checked |
| Notes | Restrictions or additional information |

Keep licensing information in a suitable project document or asset register. Do not embed private information or credentials in filenames or metadata.

—

## 14. Integration with Website Content

Healthcare images may be used on:

- Healthcare information pages.
- Medical education and course pages.
- Allied health programme pages.
- Healthcare career and recruitment pages.
- Public health awareness content.
- Educational guidance pages.
- Relevant landing pages and search results.

Keep authoritative information in the appropriate HTML, JSON, or application data layer. An image should not be the source of truth for eligibility, recognition, fees, qualifications, or service availability.

### Example JSON record

```json
{
  “id”: “medical-laboratory-technology”,
  “name”: “Medical Laboratory Technology”,
  “category”: “allied-health”,
  “image”: “/assets/images/healthcare/diagnostics/medical-laboratory.webp”,
  “imageAlt”: “Medical laboratory equipment used for diagnostic testing”
}
```

This is an illustrative record. Adapt its field names to the project’s actual schema.

### Data integrity rules

- Keep IDs stable.
- Use correct image paths.
- Verify that every referenced file exists.
- Ensure alternative text matches the actual image.
- Verify educational and healthcare claims independently.
- Do not invent institutional affiliations or professional endorsements.
- Keep image metadata separate from official or authoritative healthcare information.

—

## 15. Placeholder Policy

Use a placeholder when a suitable, verified image is unavailable.

A placeholder must:

- Match the MedOrbits design system.
- Avoid misleading institutional branding.
- Avoid implying a specific clinical procedure or facility.
- Remain legible on small screens.
- Have appropriate alternative text for its context.
- Be replaced when a suitable, licensed asset becomes available.

Do not substitute an unrelated hospital, patient, or medical procedure photograph simply to fill an empty image area.

—

## 16. Image Optimization and Performance

### Recommended practices

1. Resize images to their intended display dimensions.
2. Compress files while preserving acceptable visual quality.
3. Prefer WebP or AVIF for suitable photographs.
4. Use responsive image variants when appropriate.
5. Lazy-load below-the-fold images.
6. Avoid lazy-loading the primary image when doing so would delay important above-the-fold content.
7. Specify image dimensions or reserve space using CSS `aspect-ratio`.
8. Avoid serving full-resolution photographs as small thumbnails.
9. Avoid loading unnecessary duplicate image variants.
10. Test on mobile devices and slower connections.

### Suggested file-size targets

These are practical starting points rather than strict limits.

| Image type | Suggested target |
|—|—:|
| Small icon or illustration | Under 50 KB |
| Standard card image | Under 150 KB |
| Large banner image | Under 350 KB |
| Detailed clinical or educational image | Optimize according to dimensions and quality |

Prioritize readable, accurate imagery over aggressive compression that makes medical details difficult to understand.

—

## 17. Security Considerations

- Store only approved public-facing assets in this directory.
- Keep API keys, access tokens, and credentials out of image metadata.
- Do not store confidential patient records or private application documents here.
- Validate uploaded files on the server if user uploads are supported.
- Do not trust file extensions alone to determine file type.
- Apply file-size and content-type restrictions to upload workflows.
- Keep private files in storage with appropriate access controls.
- Use secure delivery and permissions for any sensitive assets.

A public static directory should never be treated as secure storage for private healthcare documents.

—

## 18. Caching and Deployment

- Use stable filenames or an appropriate cache-busting strategy.
- Configure suitable browser and CDN cache headers.
- Confirm that assets are included in the production build.
- Check paths on the deployed website, not only in local development.
- Verify case-sensitive filenames.
- Check for broken image responses.
- Ensure that image URLs remain consistent with the application’s routing and static-file configuration.
- Review cache behaviour when replacing an image at an existing URL.

Avoid changing an image path without updating all references in HTML, CSS, JavaScript, JSON, and other dependent files.

—

## 19. Maintenance Workflow

When adding or replacing an image:

1. Identify the intended healthcare topic.
2. Verify the image’s relevance and accuracy.
3. Confirm licensing, permissions, and consent requirements.
4. Check for personal or confidential information.
5. Choose a descriptive filename.
6. Optimize the image for its intended display.
7. Save it in the appropriate category.
8. Update all references.
9. Add appropriate alternative text.
10. Test desktop and mobile layouts.
11. Verify that the image loads correctly after deployment.
12. Record relevant source and licensing information.
13. Remove obsolete files only after checking their dependencies.

—

## 20. Troubleshooting

### Image does not load

Check the file path, filename capitalization, deployment output, static-file configuration, and browser console.

### Image appears distorted

Check the container dimensions, aspect ratio, and `object-fit` setting.

### Image appears blurry

Use an adequately sized source image and avoid enlarging a small thumbnail beyond its intended dimensions.

### Page layout shifts during loading

Set explicit image dimensions or reserve space with CSS `aspect-ratio`.

### Image loads slowly

Optimize the file, select an appropriate format, use responsive variants, and lazy-load below-the-fold images.

### Incorrect hospital or medical activity is shown

Remove the image from the affected page until its identity and relevance can be verified. Correct the asset reference and review the associated content.

### Confidential information appears in an image

Remove the asset from public access immediately, investigate where it is referenced, and replace it with an appropriately authorized image. Follow the applicable privacy incident procedure if personal information has been exposed.

### Image fails after deployment

Verify the exact path, filename capitalization, file inclusion, server response, and caching behaviour.

—

## 21. Pre-Publication Checklist

- [ ] Image accurately represents the intended healthcare topic.
- [ ] Source and usage rights have been verified.
- [ ] Required consent and authorization have been obtained.
- [ ] No confidential or identifying information is exposed.
- [ ] Filename follows the naming convention.
- [ ] File is stored in the correct directory.
- [ ] Format and dimensions suit the intended placement.
- [ ] Image has been optimized.
- [ ] HTML, CSS, or JSON references are correct.
- [ ] Alternative text is meaningful and accurate.
- [ ] Decorative images use empty alternative text where appropriate.
- [ ] Mobile and desktop layouts have been checked.
- [ ] Image loading does not cause unnecessary layout shifts.
- [ ] No unsupported medical or institutional claims are implied.
- [ ] Required attribution is documented.
- [ ] Production deployment has been checked for broken images.

—

## 22. Related Directories

Depending on the actual repository structure, related assets may be stored in:

```text
assets/images/
├── backgrounds/
├── careers/
├── colleges/
├── courses/
├── healthcare/
├── logo/
└── archive/
```

This structure is illustrative. The actual repository is the source of truth.

Healthcare images may be referenced by course catalogues, admission guides, healthcare career pages, and other relevant sections. Keep paths consistent across all dependent pages and datasets.

—

## 23. Change Log

### Version 1.0.0 — 2026-10-24

- Established healthcare image directory guidelines.
- Defined recommended categories, naming conventions, and dimensions.
- Added HTML, CSS, and JSON integration examples.
- Documented medical accuracy, accessibility, and image optimization.
- Added privacy, consent, licensing, and security requirements.
- Established maintenance, troubleshooting, and publication checklists.

—

## 24. Final Standard

Every image stored in `/assets/images/healthcare/` must be relevant, appropriately licensed, accessible, optimized, and correctly referenced.

**Core principle:** Healthcare imagery must support accurate, respectful, and trustworthy educational content without compromising privacy or misleading users about medical services, institutions, qualifications, or clinical outcomes.
