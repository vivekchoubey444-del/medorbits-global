Copy the following complete content into /assets/images/courses/README.md.

# MedOrbits — Course Images
**Directory:** `/assets/images/courses/`
**Project:** MedOrbits
**Document:** Course Image Asset Guidelines
**Version:** 1.0.0
**Last Updated:** 2026-10-24
—
## 1. Purpose
This directory stores visual assets used to represent academic courses, professional qualifications, entrance examinations, training programmes, and career pathways across the MedOrbits website.
Course images should help students, parents, graduates, and working professionals understand the subject or programme being presented. Images must be relevant, accessible, optimized for the web, and used with appropriate permissions.
This README defines recommended naming conventions, directory organization, visual standards, implementation practices, accessibility requirements, and maintenance procedures.
**Important:** The example filenames in this document are recommendations. They do not confirm that the corresponding image files already exist.
—
## 2. Directory Structure
Recommended structure:
```text
assets/
└── images/
    └── courses/
        ├── README.md
        ├── medical/
        │   ├── mbbs.webp
        │   ├── bds.webp
        │   ├── bams.webp
        │   ├── bhms.webp
        │   ├── bums.webp
        │   └── nursing.webp
        ├── paramedical/
        │   ├── medical-laboratory-technology.webp
        │   ├── radiology-imaging.webp
        │   ├── operation-theatre-technology.webp
        │   └── physiotherapy.webp
        ├── science/
        │   ├── biotechnology.webp
        │   ├── microbiology.webp
        │   └── data-science.webp
        ├── engineering/
        │   ├── computer-science-engineering.webp
        │   ├── mechanical-engineering.webp
        │   └── civil-engineering.webp
        ├── management/
        │   ├── bba.webp
        │   ├── mba.webp
        │   └── hospital-management.webp
        ├── commerce/
        │   ├── bcom.webp
        │   └── accounting-finance.webp
        ├── law/
        │   └── law.webp
        ├── arts-humanities/
        │   ├── psychology.webp
        │   └── social-sciences.webp
        ├── education/
        │   └── teacher-education.webp
        ├── vocational/
        │   ├── digital-marketing.webp
        │   └── vocational-training.webp
        └── placeholders/
            ├── course-placeholder.webp
            └── course-placeholder.svg
```
Create only the folders and files required by the actual project. Do not leave broken image references for assets that have not been added.
—
## 3. Supported Course Categories
The directory may contain images for the following categories, depending on the courses offered by MedOrbits.
### Medical and healthcare
- MBBS
- BDS
- BAMS
- BHMS
- BUMS
- Nursing
- Pharmacy
- Physiotherapy
- Allied health sciences
- Medical laboratory technology
- Radiology and imaging technology
- Operation theatre technology
- Other healthcare qualifications
### Science and technology
- B.Sc. programmes
- Biotechnology
- Microbiology
- Data science
- Computer science
- Information technology
- Research and laboratory sciences
### Engineering and technical education
- Computer science engineering
- Mechanical engineering
- Civil engineering
- Electrical engineering
- Electronics and communication engineering
- Diploma programmes
- Other technical qualifications
### Business, commerce, and management
- BBA
- MBA
- B.Com.
- Hospital management
- Accounting and finance
- Business analytics
- Human resource management
- Marketing and entrepreneurship
### Other academic and professional pathways
- Law
- Arts and humanities
- Psychology
- Social sciences
- Teacher education
- Digital marketing
- Vocational and skill-based programmes
- Professional certification courses
**Content accuracy:** Listing a course image does not mean that MedOrbits offers the course directly or that admission is currently open. Course availability, eligibility, duration, fees, recognition, and admission requirements must be verified separately using reliable sources.
—
## 4. File Naming Convention
Use descriptive, lowercase, hyphen-separated filenames.
### Recommended
```text
mbbs.webp
bds.webp
bams.webp
medical-laboratory-technology.webp
computer-science-engineering.webp
hospital-management.webp
data-science.webp
course-placeholder.webp
```
### Avoid
```text
IMG_0001.jpg
new-image-final-final.png
Course Image 1.JPG
download(3).webp
```
### Naming rules
1. Use lowercase letters.
2. Separate words with hyphens.
3. Use the course name or subject as the primary filename.
4. Avoid spaces, special characters, and unnecessary version numbers.
5. Use one consistent spelling for each course across the website.
6. Do not rename an asset without updating every reference to it.
7. Preserve existing filenames when they are already referenced by production pages, CSS, JavaScript, or JSON data.
8. Use meaningful suffixes only when multiple images serve different purposes.
Examples:
```text
mbbs-card.webp
mbbs-banner.webp
mbbs-laboratory.webp
mbbs-campus-life.webp
```
Use separate variants only when they are genuinely needed.
—
## 5. Image Formats
Choose formats based on image content and browser support.
| Format | Recommended use |
|—|—|
| WebP | General-purpose course cards, banners, and photographs |
| AVIF | Photographic images where supported and appropriately optimized |
| JPEG | Photographs requiring a widely supported fallback |
| PNG | Images requiring lossless quality or transparency |
| SVG | Simple vector illustrations, icons, and scalable graphics |
| GIF | Avoid for normal course imagery; use only when animation is necessary |
For most photographic course images, WebP is the preferred default. Use SVG for simple illustrations and icons rather than converting photographs into vector files.
Avoid unnecessarily large PNG files for ordinary photographs.
—
## 6. Image Dimensions and Aspect Ratios
Use consistent dimensions to maintain a professional layout.
| Image placement | Recommended aspect ratio | Suggested dimensions |
|—|—|—|
| Course card thumbnail | 4:3 | 800 × 600 px |
| Course listing card | 3:2 | 900 × 600 px |
| Course hero banner | 16:9 | 1600 × 900 px |
| Wide promotional banner | 21:9 | 1680 × 720 px |
| Small course icon | 1:1 | 256 × 256 px |
| Compact category thumbnail | 1:1 | 600 × 600 px |
These are recommended starting points, not mandatory dimensions. Select the dimensions that match the actual layout and required display quality.
### Image composition
- Keep the main subject visible after cropping.
- Leave sufficient negative space for text overlays on banners.
- Avoid placing important details near the edges.
- Ensure that faces, laboratory equipment, and other important subjects are not cropped awkwardly.
- Use a consistent crop within the same card grid.
- Avoid stretching images to fit containers.
- Test images at mobile, tablet, laptop, and desktop sizes.
—
## 7. MedOrbits Visual Standards
Course imagery should complement the premium MedOrbits design system.
### Recommended palette
Use coordinated colours such as:
- Sapphire blue
- Deep navy
- Royal blue
- Burgundy
- Imperial aubergine
- Champagne gold
- Warm grey
- Muted beige
- Soft blue-grey
Avoid pure-white background sections when creating new course artwork for the website. Prefer subtle tinted backgrounds, layered gradients, or softly textured surfaces where appropriate.
### Visual quality
Course images should be:
- Professional and relevant to the subject.
- Visually consistent across course cards.
- High enough in resolution for their intended display size.
- Free from unnecessary watermarks and promotional text.
- Legible when viewed on small screens.
- Consistent with the overall MedOrbits branding.
Do not add official logos, government emblems, university seals, or institutional branding unless their use is appropriate and authorized.
### Authenticity
Use genuine, properly licensed photographs or clearly illustrative artwork.
Do not present a generic laboratory, hospital, campus, classroom, or student photograph as a photograph of a specific institution unless that identification has been verified.
Do not imply that an institution endorses MedOrbits merely because its logo or campus appears in an image.
—
## 8. Image Optimization
Optimize images before publishing them.
### Recommended practices
1. Resize images to the dimensions actually needed.
2. Compress images without introducing visible artifacts.
3. Remove unnecessary metadata, including private location information.
4. Use descriptive filenames.
5. Prefer WebP or AVIF for suitable photographs.
6. Avoid uploading original camera files directly to production.
7. Do not serve a very large banner image as a tiny thumbnail.
8. Use responsive image sources for important images when multiple sizes are available.
9. Reserve eager loading for the main above-the-fold image where appropriate.
10. Lazy-load images that appear farther down the page.
### Suggested file-size targets
These are practical optimization targets, not strict technical limits.
| Image type | Suggested target |
|—|—:|
| Small icon or illustration | Under 50 KB |
| Course card image | Under 150 KB |
| Large course banner | Under 350 KB |
| Large photographic image | Optimize according to its dimensions and visual quality |
File size must be balanced with image quality, display dimensions, and device performance.
—
## 9. HTML Implementation
Use descriptive alternative text and explicit dimensions where possible.
### Basic course card
```html
<article class=“course-card”>
  <img
    src=“/assets/images/courses/medical/mbbs.webp”
    alt=“Medical students learning in a clinical training environment”
    width=“800”
    height=“600”
    loading=“lazy”
    decoding=“async”
  >
  <div class=“course-card__content”>
    <h2>MBBS</h2>
    <p>
      Explore medical education pathways, eligibility requirements,
      and admission guidance.
    </p>
    <a href=“/pages/courses/mbbs.html”>
      Explore MBBS
    </a>
  </div>
</article>
```
**Implementation note:** Update the image path and page URL to match the actual project structure. The example does not confirm that `/pages/courses/mbbs.html` already exists.
### Decorative image
If an image is purely decorative and conveys no additional information, use an empty alternative text:
```html
<img
  src=“/assets/images/courses/placeholders/course-placeholder.webp”
  alt=“”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>
```
Use this pattern only when the image is genuinely decorative or its information is already conveyed in adjacent text.
### Responsive image
```html
<img
  src=“/assets/images/courses/medical/mbbs.webp”
  srcset=“
    /assets/images/courses/medical/mbbs-400.webp 400w,
    /assets/images/courses/medical/mbbs-800.webp 800w,
    /assets/images/courses/medical/mbbs-1200.webp 1200w
  “
  sizes=“(max-width: 600px) 100vw,
         (max-width: 1024px) 50vw,
         33vw”
  alt=“Medical students in a clinical learning environment”
  width=“800”
  height=“600”
  loading=“lazy”
  decoding=“async”
>
```
Create and reference these size variants only if the corresponding files exist.
### Above-the-fold image
For the primary image that is immediately visible on page load, consider omitting `loading=“lazy”` or using eager loading. Do not apply high fetch priority to every image.
—
## 10. CSS Guidelines
Use a consistent aspect ratio and avoid layout shifts.
```css
.course-card__media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 1rem;
  background: linear-gradient(
    135deg,
    #e5ebf8,
    #e9dfeb,
    #f0e3ca
  );
}
.course-card__media img,
.course-card > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
.course-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(36, 55, 95, 0.14);
  border-radius: 1rem;
  background: #f1f2f7;
  color: #202744;
}
.course-card__content {
  padding: 1rem;
}
.course-card a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}
@media (max-width: 600px) {
  .course-card__content {
    padding: 0.875rem;
  }
}
```
The selector `.course-card > img` assumes that the image is a direct child of the card. Adjust it to match the actual HTML structure.
Use the project’s shared design tokens when available instead of introducing duplicate colour values throughout the stylesheet. The colours above are illustrative.
—
## 11. Accessibility Requirements
Course imagery must support users who rely on assistive technologies.
- Provide meaningful `alt` text for informative images.
- Use `alt=“”` for decorative images.
- Avoid repeating the complete adjacent heading in alternative text.
- Do not place essential course eligibility or admission information only inside an image.
- Maintain sufficient text contrast over banners.
- Do not rely on colour alone to distinguish categories.
- Preserve keyboard access to course links and buttons.
- Ensure that images do not obscure text or controls at increased zoom.
- Avoid flashing or rapidly changing visual effects.
Alternative text should describe the image’s purpose in its specific context, not merely state the filename.
—
## 12. Privacy and Consent
Course imagery may contain students, patients, educators, or other identifiable people.
Before publishing an image:
1. Confirm that its source and usage rights are documented.
2. Obtain appropriate permission or consent where required.
3. Avoid exposing private documents, medical records, student IDs, phone numbers, or other personal information.
4. Remove unnecessary location and device metadata.
5. Do not publish patient photographs or sensitive clinical images without appropriate authorization.
6. Avoid implying that identifiable people are affiliated with a particular institution without verification.
7. Follow applicable privacy, copyright, and data-protection requirements.
Use fictional, licensed, or properly authorized imagery when authentic photography is unavailable.
—
## 13. Copyright and Licensing
Every image must have a known source and permitted usage.
Suitable sources may include:
- Original artwork owned by MedOrbits.
- Photographs commissioned with appropriate usage rights.
- Properly licensed stock photography.
- Openly licensed images used in accordance with their terms.
- Official institutional media where reuse is permitted.
Do not assume that an image is free to use merely because it appears in a search engine, social media post, college brochure, or another website.
Maintain an asset register when practical:
| Field | Description |
|—|—|
| Filename | Exact image filename |
| Course/category | Course or subject represented |
| Source | Original source or provider |
| Creator | Photographer, designer, or organization |
| License | Applicable license or permission |
| Attribution | Required attribution text, if any |
| Verification date | Date usage rights were checked |
| Notes | Restrictions or additional details |
Do not publish assets with unresolved licensing restrictions.
—
## 14. Relationship with Course Data
Images are presentation assets. They are not authoritative sources for course details.
Keep course information in the project’s existing HTML, JSON, or application data layer.
Where a course catalogue uses JSON, a record may follow this pattern:
```json
{
  “id”: “mbbs”,
  “name”: “Bachelor of Medicine and Bachelor of Surgery”,
  “shortName”: “MBBS”,
  “category”: “medical”,
  “image”: “/assets/images/courses/medical/mbbs.webp”,
  “imageAlt”: “Medical students in a clinical learning environment”
}
```
This is an illustrative record. Adapt its property names and structure to the actual schema already used by the project.
### Data integrity rules
- Keep course IDs stable.
- Use valid, project-relative image paths.
- Ensure the referenced file exists.
- Keep alternative text relevant to the actual image.
- Do not invent course fees, eligibility, recognition, duration, or admission status.
- Verify educational information against applicable official sources.
- Keep image metadata separate from authoritative admissions data.
- Update all dependent pages and datasets when an asset path changes.
—
## 15. Placeholder Policy
Use a placeholder when a verified or appropriately licensed image is not yet available.
A placeholder must:
- Clearly function as a generic visual.
- Match the site’s design system.
- Avoid misleading institutional branding.
- Avoid implying that a particular course or campus has been photographed.
- Include suitable alternative text according to its purpose.
- Be replaced when an approved image becomes available.
Do not silently substitute an unrelated medical or campus photograph for a course image.
—
## 16. Performance and Caching
For production deployment:
- Use stable, versioned filenames or an appropriate cache-busting strategy.
- Configure image responses with suitable cache headers.
- Use a content delivery network if supported by the hosting architecture.
- Avoid embedding large image files directly in HTML or JSON.
- Check for broken image paths after deployment.
- Ensure images remain available at their referenced URLs.
- Review image loading on slow mobile connections.
- Avoid downloading multiple large image variants unnecessarily.
- Keep third-party image dependencies to a minimum.
If an image changes while its URL remains unchanged, ensure that browser and CDN caching will not keep an outdated version indefinitely.
—
## 17. Security Considerations
- Do not place confidential documents or private user uploads in this public asset directory.
- Do not include API keys, access tokens, or credentials in image metadata or filenames.
- Validate uploaded files on the server when the website supports user-submitted imagery.
- Do not trust the file extension alone to determine the true file type.
- Apply appropriate file-size and content-type restrictions to upload workflows.
- Keep private application documents outside publicly accessible static asset directories.
- Use secure upload and storage permissions where applicable.
The course image directory should contain approved public-facing assets only.
—
## 18. Maintenance Workflow
When adding or updating a course image:
1. Identify the course and intended placement.
2. Confirm that the image accurately represents the subject.
3. Verify ownership, licensing, and consent requirements.
4. Choose a descriptive filename.
5. Resize and optimize the image.
6. Save it in the appropriate category directory.
7. Update HTML, CSS, or course data references.
8. Add meaningful alternative text.
9. Check mobile and desktop layouts.
10. Confirm that no image paths are broken.
11. Test loading behaviour and page performance.
12. Record any relevant licensing or attribution details.
13. Remove obsolete files only after confirming that no active page references them.
Do not delete or rename production assets without checking their dependencies.
—
## 19. Troubleshooting
### Image does not load
Check:
- Whether the file exists at the referenced path.
- Whether the filename’s capitalization matches exactly.
- Whether the path is correct relative to the deployed website.
- Whether the server or CDN returns the correct status.
- Whether the browser console reports a loading error.
### Image appears stretched
Check the CSS `object-fit`, container dimensions, and aspect ratio. Use `object-fit: cover` for cropped card imagery or `contain` when the entire graphic must remain visible.
### Image looks blurry
Use a source image with adequate resolution. Avoid enlarging a small thumbnail into a large banner.
### Page layout shifts during loading
Provide explicit `width` and `height` attributes or reserve space using CSS `aspect-ratio`.
### Image loads slowly
Reduce file size, use an appropriate modern format, serve responsive variants, and lazy-load below-the-fold images.
### Incorrect course or institution is shown
Remove the image from the affected placement until its identity and relevance can be verified. Correct the image reference and review related course data.
### Image is missing after deployment
Check case-sensitive paths, deployment output, static-file configuration, and whether the image was included in the published build.
—
## 20. Pre-Publication Checklist
Before publishing any course image, confirm the following:
- [ ] The image is relevant to the course.
- [ ] The source and usage rights are known.
- [ ] Required permissions and consent have been obtained.
- [ ] The filename follows the naming convention.
- [ ] The image is stored in the correct directory.
- [ ] The file format is appropriate.
- [ ] The image is optimized for its intended dimensions.
- [ ] The HTML or JSON path is correct.
- [ ] Alternative text is accurate and useful.
- [ ] Decorative images use empty alternative text where appropriate.
- [ ] The layout works on mobile and desktop.
- [ ] The image does not introduce layout shifts.
- [ ] No confidential information is visible.
- [ ] Institutional identity and branding are not misrepresented.
- [ ] The page has been checked for broken images.
- [ ] Any required attribution has been recorded.
—
## 21. Related Project Directories
Depending on the actual project structure, course imagery may be used by:
```text
assets/
├── css/
├── js/
├── data/
└── images/
    ├── backgrounds/
    ├── careers/
    ├── colleges/
    ├── courses/
    ├── logo/
    └── archive/
```
These directories are illustrative. Use the actual repository structure as the source of truth.
Course images may be referenced by course catalogues, course detail pages, search results, admission guides, and relevant educational landing pages. Keep all references consistent when changing an asset.
—
## 22. Change Log
### Version 1.0.0 — 2026-10-24
- Established the course image directory guidelines.
- Defined recommended directory organization and naming conventions.
- Documented formats, dimensions, optimization, and responsive implementation.
- Added accessibility, privacy, licensing, and security requirements.
- Added course-data integration guidance and a publication checklist.
—
## 23. Final Standard
Every image stored in `/assets/images/courses/` must be relevant, appropriately licensed, accessible, optimized, and correctly referenced.
**Core principle:** Course imagery should improve the clarity and credibility of MedOrbits without misleading users about educational institutions, qualifications, eligibility, or admission opportunities.