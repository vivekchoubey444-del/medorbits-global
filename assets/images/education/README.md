MedOrbits Education Images

Directory: assets/images/education/
Project: MedOrbits
Category: Education, Academic Programmes and Student Guidance
Brand Theme: Royal Burgundy and Champagne Gold
Documentation Version: 1.0.0

⸻

1. Purpose

The assets/images/education/ directory stores educational images used throughout the MedOrbits website. These assets support educational programme discovery, academic guidance, institution selection, course information, student support, and education-related services.

The directory is intended to support:

* Medical and healthcare education
* Dental, nursing, pharmacy, and paramedical education
* Engineering and technology education
* Management, business, and law education
* Online and distance learning
* Academic counselling and course selection
* College and university guidance
* Scholarships and financial assistance
* International education and study abroad
* Student development and academic success

All images should communicate credibility, clarity, inclusivity, and educational value.

2. Recommended Directory Structure

The following is a proposed inventory. Check the existing repository before creating, renaming, or replacing files.

assets/images/education/
├── README.md
├── education-global.jpg
├── medical-education.jpg
├── mbbs-education.jpg
├── postgraduate-medical-education.jpg
├── dental-education.jpg
├── nursing-education.jpg
├── pharmacy-education.jpg
├── paramedical-education.jpg
├── allied-health-education.jpg
├── physiotherapy-education.jpg
├── engineering-education.jpg
├── computer-science-education.jpg
├── management-education.jpg
├── business-education.jpg
├── law-education.jpg
├── science-education.jpg
├── arts-humanities-education.jpg
├── commerce-education.jpg
├── agriculture-education.jpg
├── online-learning.jpg
├── distance-learning.jpg
├── classroom-learning.jpg
├── laboratory-learning.jpg
├── university-campus.jpg
├── academic-counselling.jpg
├── college-selection.jpg
├── scholarship-guidance.jpg
├── student-support.jpg
├── international-education.jpg
├── academic-success.jpg
└── education-placeholder.svg

Naming conventions

* Use lowercase filenames.
* Separate words with hyphens.
* Use descriptive names based on the image’s subject or purpose.
* Prefer .jpg for optimized photographs and raster imagery.
* Use .svg for suitable vector illustrations and placeholders.
* Avoid spaces, ambiguous abbreviations, and unnecessary version suffixes.
* Keep existing filenames and referenced paths stable unless a deliberate migration is required.

Important: The filenames above are recommendations, not confirmation that these assets already exist. Preserve the existing education-global.jpg until its references and replacement requirements have been checked.

3. Asset Catalogue

Filename	Intended purpose
education-global.jpg	General education landing pages and educational discovery
medical-education.jpg	Medical education overview and healthcare study pathways
mbbs-education.jpg	MBBS programme information and medical admission guidance
postgraduate-medical-education.jpg	MD, MS, and other postgraduate medical education content
dental-education.jpg	Dental education and BDS-related information
nursing-education.jpg	Nursing programmes and healthcare learning
pharmacy-education.jpg	Pharmacy courses and pharmaceutical education
paramedical-education.jpg	Paramedical and allied healthcare programmes
allied-health-education.jpg	Allied health education and professional training
physiotherapy-education.jpg	Physiotherapy and rehabilitation education
engineering-education.jpg	Engineering programmes and technical education
computer-science-education.jpg	Computer science, computing, and technology courses
management-education.jpg	Management programmes and leadership education
business-education.jpg	Business, commerce, and entrepreneurship learning
law-education.jpg	Legal studies and law programmes
science-education.jpg	Science courses and laboratory-based learning
arts-humanities-education.jpg	Arts, humanities, and social science education
commerce-education.jpg	Commerce, accounting, and finance education
agriculture-education.jpg	Agricultural sciences and related programmes
online-learning.jpg	Digital learning and online study environments
distance-learning.jpg	Distance education and flexible learning
classroom-learning.jpg	Classroom-based teaching and collaborative study
laboratory-learning.jpg	Practical learning and laboratory environments
university-campus.jpg	Campus life and institutional education
academic-counselling.jpg	Academic counselling and programme selection
college-selection.jpg	College comparison and institution discovery
scholarship-guidance.jpg	Scholarship information and financial assistance
student-support.jpg	Student services and academic support
international-education.jpg	International study and global education opportunities
academic-success.jpg	Study skills, educational development, and academic goals
education-placeholder.svg	Fallback for missing or unavailable educational imagery

Choose images that accurately represent the course or educational setting described by the page. Avoid using an image of one discipline to represent a different discipline simply because the visual style matches.

4. Brand and Visual Design

Educational imagery must complement the established MedOrbits visual identity.

Colour direction

* Primary: Royal Burgundy
* Secondary: Champagne Gold
* Supporting colours: Warm beige, muted gold, charcoal, warm grey, and burgundy-tinted neutrals

Images do not need to contain every brand colour. Their purpose is to integrate naturally with the site’s existing colours and component styles.

Visual direction

Prefer imagery that communicates:

* Academic credibility and learning
* Professional education environments
* Student engagement and collaboration
* Practical training and skill development
* Accessible academic guidance
* Modern teaching facilities and digital learning
* Diverse students and educators in appropriate contexts

Use balanced compositions, natural lighting, realistic educational settings, and clear focal points. Avoid misleading depictions of institutional facilities, uniforms, professional qualifications, or affiliations.

Preserve the existing website design

Adding educational images must not unintentionally change:

* The existing page layout and responsive breakpoints
* The opening animation or its timing
* Header and navigation structure
* Sticky-header behaviour
* Footer layout and content
* The Royal Burgundy and Champagne Gold colour theme
* Typography, spacing, cards, and buttons
* Existing animation and reduced-motion behaviour

Use the current components and styles wherever possible. Image integration should improve the content without redesigning unrelated website elements.

5. Image Formats and Optimization

Format	Recommended use
JPG	General educational photographs, banners, and card images
AVIF	Optional high-efficiency imagery when supported by the existing delivery pipeline
SVG	Simple vector illustrations and placeholders
JPEG	Existing photographic assets that remain in use
PNG	Images requiring raster transparency or lossless detail

Do not automatically convert or delete existing images. First verify their references, display quality, browser compatibility, and deployment configuration.

Optimization guidelines

* Compress images without visibly degrading their quality.
* Resize images to match their actual display requirements.
* Avoid loading large source images into small cards.
* Use responsive image variants when useful.
* Remove unnecessary metadata from published images.
* Use CSS for simple gradients and decorative backgrounds.
* Avoid excessive image effects and unnecessarily large files.
* Preserve important subjects when cropping.
* Keep image payloads appropriate for mobile connections.

Suggested starting targets:

* Small educational cards: approximately 50–150 KB
* Standard content images: approximately 100–250 KB
* Large banners: approximately 200–400 KB where practical

These are optimization targets, not strict limits. Prioritize a good visual result and appropriate loading performance.

6. Recommended Image Dimensions

Determine the final dimensions from the existing website components.

Placement	Aspect ratio	Example dimensions
Hero or banner	16:9	1600 × 900 px
Course card	4:3	800 × 600 px
General content image	3:2	1200 × 800 px
Square feature tile	1:1	800 × 800 px
Article or resource thumbnail	16:9	1200 × 675 px

These are suggested starting dimensions. Match existing component ratios and cropping behaviour before preparing replacements.

7. Accessibility Requirements

Every image must be evaluated according to its function.

Informative images

Use alternative text that describes the meaningful content of the actual image.

<img
  src=“/assets/images/education/medical-education.jpg”
  alt=“Students participating in a supervised medical education session”
  width=“1200”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

The alternative text is illustrative. Update it to accurately describe the published image.

Decorative images

When an image adds no information beyond the adjacent text, use an empty alternative text value.

<img
  src=“/assets/images/education/classroom-learning.jpg”
  alt=“”
  width=“1200”
  height=“800”
  loading=“lazy”
  decoding=“async”
>

Additional accessibility practices

* Maintain sufficient text contrast.
* Do not rely on colour alone to communicate meaning.
* Avoid embedding essential information in images.
* Keep image alternative text concise and relevant.
* Prevent decorative images from creating unnecessary screen-reader output.
* Respect reduced-motion preferences when images are used in animated effects.
* Specify image dimensions where practical to reduce layout shifts.

8. HTML Integration

Educational content image

<figure class=“education-image”>
  <img
    src=“/assets/images/education/medical-education.jpg”
    alt=“Medical students learning in an educational setting”
    width=“1200”
    height=“800”
    loading=“lazy”
    decoding=“async”
  >
</figure>

Course card

<article class=“course-card”>
  <img
    class=“course-card__image”
    src=“/assets/images/education/nursing-education.jpg”
    alt=“”
    width=“800”
    height=“600”
    loading=“lazy”
    decoding=“async”
  >
  <div class=“course-card__content”>
    <h3>Nursing Education</h3>
    <p>
      Explore nursing programmes, eligibility requirements,
      and academic pathways.
    </p>
    <a href=“/courses.html”>Explore courses</a>
  </div>
</article>

The class names and links above are examples. Use the existing project classes and actual page routes rather than introducing duplicate components.

Responsive image example

<picture>
  <source
    srcset=“/assets/images/education/medical-education.avif”
    type=“image/avif”
  >
  <source
    srcset=“/assets/images/education/medical-education.jpg”
    type="image/jpeg"
  >
  <img
    src=“/assets/images/education/medical-education.jpg”
    alt=“Students learning in a medical education environment”
    width=“1200”
    height=“800”
    loading=“lazy”
    decoding=“async”
  >
</picture>

Only use the AVIF source if that file actually exists. The browser can then fall back to JPG and the final image source as supported.

9. Responsive Behaviour

Educational imagery must display correctly on mobile phones, tablets, laptops, and larger desktop screens.

Recommended practices:

* Use fluid image sizing.
* Preserve the intended aspect ratio.
* Use object-fit: cover when images must fit uniform card dimensions.
* Set an appropriate object-position for important subjects.
* Use srcset or <picture> where different image sizes are needed.
* Avoid fixed widths that cause horizontal overflow.
* Test images inside the actual course grids, cards, and content sections.

Example CSS:

.education-image img,
.course-card__image {
  display: block;
  width: 100%;
  height: auto;
}
.course-card__image {
  aspect-ratio: 4 / 3;
  object-fit: cover;
  object-position: center;
}

This is reference CSS, not a replacement for the existing design system. Merge it carefully with the current styles and avoid conflicting selectors.

10. Loading Strategy and Fallbacks

Use lazy loading for suitable below-the-fold images. For the primary hero image or another important image in the initial viewport, consider eager loading when it improves perceived performance.

Do not apply high fetch priority to every image.

When an educational image is missing:

* Use a verified existing placeholder if available.
* Preserve the component’s intended dimensions.
* Avoid broken-image indicators where practical.
* Keep all essential text and links available.
* Prevent unnecessary layout shifts.
* Do not reference education-placeholder.svg in production until it exists and has been reviewed.

Fallbacks must remain consistent with the existing MedOrbits design.

11. Educational Accuracy and Responsible Representation

Educational imagery must accurately support the associated content.

* Do not imply that a course or institution is accredited unless verified.
* Do not portray admission, scholarships, or seat allocation as guaranteed.
* Do not use institutional logos or identifiable campus images without appropriate authorization.
* Do not imply a partnership with a university, college, or training provider unless it is verified.
* Do not misrepresent qualifications, professional licensing, or eligibility.
* Use inclusive and respectful imagery of students, educators, and professionals.
* Avoid using a generic photograph as evidence of a specific institution’s facilities.
* Ensure images match the programme and destination page.

Where admission rules, eligibility, fees, and professional registration vary by jurisdiction, the accompanying text must make those distinctions clear.

12. Copyright, Licensing, and Privacy

Before publishing any educational image:

* Confirm ownership, licensing, or permission to use it.
* Check whether commercial use and modification are allowed.
* Provide attribution when required.
* Obtain appropriate releases for identifiable people where necessary.
* Do not expose private student records, identity documents, application details, or contact information.
* Remove unnecessary location and personal metadata.
* Do not use third-party logos or trademarks without suitable authorization.

Maintain a record of image sources and licensing conditions where applicable.

13. Performance and Security

* Serve assets through HTTPS in production.
* Use trusted and controlled asset sources.
* Validate user-submitted images before publication.
* Apply suitable file-size and dimension limits to uploaded media.
* Do not trust filename extensions alone when validating files.
* Ensure the hosting environment serves images with correct content types.
* Keep asset paths compatible with the project’s existing routing and hosting setup.
* Apply suitable caching and compression through the existing delivery pipeline.

The image directory should contain approved static assets rather than executable uploads or unrelated files.

14. Quality Assurance Checklist

File integrity

* [ ]	The asset exists at the documented path.
* [ ]	The image opens and renders correctly.
* [ ]	Its extension matches the actual format.
* [ ]	Dimensions and compression are appropriate.
* [ ]	No unintended private information is exposed.

Visual consistency

* [ ]	The image matches the associated educational content.
* [ ]	The Royal Burgundy and Champagne Gold theme remains intact.
* [ ]	Existing page layout and responsive breakpoints are preserved.
* [ ]	The opening animation remains unchanged.
* [ ]	Header, navigation, and footer remain unchanged.
* [ ]	Images crop correctly on mobile and desktop.
* [ ]	Text remains readable against the surrounding design.

Accessibility and performance

* [ ]	Informative images have appropriate alternative text.
* [ ]	Decorative images use empty alternative text.
* [ ]	Image dimensions are specified where appropriate.
* [ ]	Lazy loading is used for suitable below-the-fold images.
* [ ]	Above-the-fold images are not unnecessarily delayed.
* [ ]	Images do not cause avoidable layout shifts.
* [ ]	Reduced-motion preferences are respected where relevant.

Content and compliance

* [ ]	The image does not imply unsupported accreditation or partnerships.
* [ ]	Admission and scholarship outcomes are not presented as guaranteed.
* [ ]	Appropriate image usage rights are documented.
* [ ]	Production references point to existing files.
* [ ]	Affected pages have been tested after integration.

15. Maintenance and Version Control

When updating the directory:

1. Inspect existing assets and references first.
2. Add new assets using the established naming conventions.
3. Update this README when the approved inventory changes.
4. Search the project before renaming or removing an asset.
5. Test all affected pages and responsive layouts.
6. Confirm asset paths in the deployed environment.
7. Remove obsolete files only after verifying they are no longer referenced.
8. Document relevant source and licensing changes.

Avoid unrelated changes to global styles, navigation, animations, page layout, headers, footers, or the existing colour theme during asset maintenance.

16. Related Directories

Educational imagery may be used alongside resources from the following locations:

* assets/images/ — Shared image library and documentation.
* assets/images/hero/ — Main page hero images.
* assets/images/admissions/ — Admission guidance imagery.
* assets/images/study-abroad/ — International education imagery.
* assets/images/blog/ — Educational articles and editorial images.
* assets/icons/education/ — Education-related interface icons.
* assets/data/courses.json — Course data, if present.
* assets/data/colleges.json — College data, if present.
* assets/data/universities.json — University data, if present.

Verify that each referenced directory or data file exists before integrating it. Image filenames should not be treated as proof of a course, college, university, or admission claim.

17. Final Standard

The assets/images/education/ directory should provide a consistent, accessible, optimized, and maintainable collection of educational imagery for MedOrbits.

Every asset must accurately represent its subject, respect copyright and privacy requirements, load efficiently across devices, and integrate with the existing website without disrupting its layout, opening animation, header, footer, or Royal Burgundy and Champagne Gold design system.

End of document.