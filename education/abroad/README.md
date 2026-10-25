
# MedOrbits — Study Abroad Education Directory

**Directory:** `/education/abroad/`  
**Brand:** MedOrbits — Education · Admissions · Careers · Recruitment  
**Website:** https://medorbits.in/  
**Purpose:** Study-abroad guidance, international education resources, university discovery, admissions planning, and student support.

—

## 1. Overview

The `/education/abroad/` directory contains public-facing pages and resources that help students explore international study opportunities. It should provide clear, structured, and regularly reviewed information about countries, universities, courses, eligibility requirements, tuition fees, scholarships, student visas, and application procedures.

All content must be informative, accessible, mobile-responsive, and consistent with the MedOrbits design system.

## 2. Scope

This directory may include resources covering:

- Study destinations and country guides
- International universities and recognized institutions
- Undergraduate and postgraduate programs
- Medicine, dentistry, nursing, engineering, business, and other disciplines
- Admission requirements and application timelines
- Tuition fees, living costs, and financial planning
- Scholarships, grants, and funding opportunities
- Student visa and immigration information
- Language proficiency and entrance examinations
- Required academic and financial documents
- Accommodation and student-life guidance
- International student support and career opportunities
- Frequently asked questions and application checklists

Country-specific rules must be verified against relevant official government, university, and regulatory sources.

## 3. Recommended Directory Structure

```text
education/
└── abroad/
    ├── README.md
    ├── index.html
    ├── countries/
    │   ├── index.html
    │   ├── germany.html
    │   ├── united-kingdom.html
    │   ├── united-states.html
    │   ├── canada.html
    │   ├── australia.html
    │   ├── russia.html
    │   ├── kazakhstan.html
    │   ├── georgia.html
    │   ├── nepal.html
    │   └── philippines.html
    ├── courses/
    │   └── index.html
    ├── universities/
    │   └── index.html
    ├── scholarships/
    │   └── index.html
    ├── admissions/
    │   └── index.html
    ├── student-visas/
    │   └── index.html
    └── resources/
        ├── index.html
        ├── document-checklist.html
        ├── application-timeline.html
        └── cost-of-study.html
```

**Implementation note:** This is a recommended structure, not a declaration that every listed file already exists. Create pages as the corresponding content and data sources become available.

## 4. Page Requirements

### Main landing page

The `index.html` page should provide:

- A clear introduction to studying abroad
- Search and filtering by destination, course, qualification, and budget
- Featured destinations and study disciplines
- University discovery and admissions resources
- Scholarship and cost-planning links
- Application guidance and calls to action
- Frequently asked questions
- Links to related MedOrbits education and career resources

### Country guides

Each country page should include:

- Country overview and education-system summary
- Available qualifications and popular disciplines
- Admission eligibility and application process
- Official university and regulator resources
- Tuition and living-cost estimates with currency and reference date
- Scholarship and funding options
- Language requirements
- Student visa requirements and official application links
- Accommodation and student-life considerations
- Recognition, licensing, and professional registration requirements where applicable

### University and course listings

University and course pages should distinguish verified facts from estimates and editorial guidance. Listings should include relevant details such as institution name, location, program, qualification, duration, fees, eligibility, application deadline, official website, and the date the information was last verified.

Do not publish an institution as accredited, recognized, or approved unless the claim is supported by an appropriate official source.

## 5. Data and Content Standards

Where possible, maintain structured data separately from HTML templates.

Suggested data resources include:

```text
data/
├── countries.json
├── universities.json
├── courses.json
├── scholarships.json
├── fees.json
├── admission-process.json
├── entrance-exams.json
├── documents.json
└── faqs.json
```

These filenames represent suggested shared resources; do not duplicate existing project data files unnecessarily.

Data standards:

- Use valid UTF-8 encoding.
- Use consistent country, university, and course identifiers.
- Store monetary amounts with explicit currencies.
- Distinguish annual tuition from total program costs.
- Record source URLs and verification dates where supported by the data model.
- Represent unknown values as `null` or an explicitly documented status rather than inventing details.
- Validate JSON syntax and required fields before deployment.
- Escape user-generated or externally sourced text before rendering it in HTML.

## 6. Design and Accessibility

Follow the MedOrbits premium visual identity.

- Use a refined, premium color palette; avoid pure-white page and section backgrounds.
- Maintain strong text contrast and readable typography.
- Support mobile, tablet, and desktop layouts.
- Use semantic HTML and logical heading order.
- Provide descriptive alternative text for meaningful images.
- Ensure links, menus, filters, and forms are keyboard accessible.
- Display visible focus indicators.
- Associate form labels with their controls and provide actionable validation messages.
- Respect reduced-motion preferences when using animations.
- Prevent horizontal overflow and clipped content.
- Use optimized, appropriately licensed images with descriptive filenames.

Shared styles and scripts should be loaded from the established project assets rather than duplicated inline when reusable assets already exist.

## 7. SEO Requirements

Each public page should have:

- A unique, descriptive title
- A useful meta description
- A canonical URL matching the deployed route
- One clear primary heading
- Descriptive internal links
- Appropriate Open Graph metadata where supported
- Valid structured data only when the content qualifies for that schema
- An appropriate indexability policy

Use the canonical host `https://medorbits.in/` consistently with the existing project configuration.

Only include published, canonical, indexable pages in the XML sitemap. Do not expose private application data, internal administration pages, or unpublished routes through sitemap entries.

## 8. Security and Privacy

- Never place API keys, database credentials, access tokens, or secrets in public files.
- Do not embed private student records or uploaded documents in static HTML or public JSON.
- Collect personal information only through approved, secured application workflows.
- Validate all submitted values on the server.
- Apply authorization checks to protected resources.
- Obtain appropriate consent before collecting or sharing student information.
- Publish privacy and data-retention information through the site’s applicable legal pages.
- Treat robots.txt as a crawler instruction file, not an access-control mechanism.

## 9. Quality Assurance

Before deploying a new or updated page:

1. Validate HTML structure and metadata.
2. Validate referenced local assets and internal links.
3. Validate JSON files against their applicable schemas.
4. Test navigation and interactive controls.
5. Check keyboard accessibility and color contrast.
6. Test responsive layouts on common screen sizes.
7. Verify all factual admission, fee, visa, and recognition claims against official sources.
8. Check canonical URLs, HTTP status codes, and sitemap inclusion.
9. Confirm that no secrets or private student information are exposed.
10. Review console errors and server logs.

## 10. Content Governance

Each page should have a clear maintenance owner and a process for reviewing time-sensitive information.

- Recheck fees, deadlines, visa rules, and eligibility before each relevant admissions cycle.
- Prefer official government, university, and regulatory sources.
- Display a last-reviewed date when the information has genuinely been reviewed.
- Correct inaccurate or outdated content promptly.
- Clearly label estimates, third-party information, and information that requires individual confirmation.
- Do not guarantee admission, scholarships, visas, employment, or professional licensing.

## 11. Definition of Done

A page is ready for publication when:

- Its content is accurate and appropriately sourced.
- Its layout follows the MedOrbits design and accessibility standards.
- Its links and local assets work correctly.
- Its metadata and canonical URL are correct.
- Its structured data passes validation, where applicable.
- Its responsive and functional checks pass.
- Its privacy and security requirements are satisfied.
- Its maintenance and review requirements are documented.

—

**Maintainer:** MedOrbits Website Team  
**Directory status:** Architecture and content guidelines  
**Review policy:** Update this README whenever the directory structure, shared data resources, or publishing standards change.
