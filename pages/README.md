
# MedOrbits — Pages Directory

> **Directory:** `/pages/`  
> **Website:** [https://medorbits.in](https://medorbits.in)  
> **Brand:** MedOrbits — Education · Career · Opportunities  
> **Primary audience:** Students, parents, graduates, working professionals and education seekers.

—

## 1. Overview

The `/pages/` directory contains standalone informational pages that support the MedOrbits website.

These pages help users discover education pathways, compare institutions, understand admissions, find official documents, explore consultancy services, read news and updates, and access support.

Every page should maintain a consistent visual identity, responsive layout, accessible navigation and clear links to relevant resources.

### Core principles

- Present information clearly and professionally.
- Use official sources for time-sensitive education and career information.
- Make navigation consistent across the website.
- Prioritise mobile usability and readable typography.
- Avoid unsupported admission, employment, scholarship or visa guarantees.
- Clearly distinguish editorial information from official announcements.
- Never display fabricated partnerships, endorsements or institutional affiliations.
- Avoid collecting sensitive information without a justified purpose and an appropriate privacy process.

—

## 2. Directory Structure

The following structure is the intended organisation. Keep existing filenames and routes consistent with the actual repository.

```text
pages/
├── README.md
├── about.html
├── our-vision.html
├── our-mission.html
├── services.html
├── consultancy.html
├── institutional-partners.html
├── news.html
├── contact.html
├── support.html
├── help-centre.html
├── colleges.html
├── admissions.html
├── entrance-exams.html
├── study-abroad.html
├── official-documents.html
├── education.html
├── sitemap.html
└── 404.html
```

**Important:** This is a planning inventory, not a confirmation that every listed file already exists. Verify filenames against the repository before creating new pages or changing links.

Other website sections may live in separate directories, including:

```text
education/
├── index.html
├── courses.html
└── universities.html

career/
├── index.html
├── jobs.html
├── internships.html
├── resume-support.html
└── recruitment.html

legal/
├── privacy-policy.html
├── terms.html
├── refund-policy.html
└── ...

assets/
├── css/
├── js/
├── images/
│   └── logo/
└── data/
```

—

## 3. Page Responsibilities

| Page | Purpose |
|—|—|
| `about.html` | Introduce MedOrbits, its purpose and platform scope. |
| `our-vision.html` | Explain the long-term vision for education and career information access. |
| `our-mission.html` | Describe the platform’s mission and operating principles. |
| `services.html` | Present the available website resources and service categories. |
| `consultancy.html` | Explain education, admissions, study abroad and career consultancy enquiries. |
| `institutional-partners.html` | Present verified institutional relationships, where applicable. |
| `news.html` | Organise education news, admission information, examination topics, scholarships and career updates. |
| `contact.html` | Provide official contact channels and contact instructions. |
| `support.html` | Help users navigate common questions and support options. |
| `help-centre.html` | Provide a central directory of help resources, if maintained separately. |
| `colleges.html` | Support college discovery and institution research. |
| `admissions.html` | Explain admission research and application planning. |
| `entrance-exams.html` | Organise entrance examination resources and official links. |
| `study-abroad.html` | Help users research international education pathways. |
| `official-documents.html` | Organise information about education, identity and application documents. |
| `education.html` | Present educational resources, pathways and learning topics. |
| `sitemap.html` | Provide a human-readable directory of public website pages. |
| `404.html` | Help visitors recover from broken or unavailable routes. |

Avoid creating duplicate pages that compete for the same purpose. If two pages cover similar topics, define their distinct responsibilities and link between them.

—

## 4. Design System

### Colour palette

The pages directory follows the pale-blue and gold visual direction used by the MedOrbits consultancy and news page references.

| Token | Suggested value | Purpose |
|—|—|—|
| `—bg` | `#EDF4FF` | Main page background |
| `—bg-deep` | `#DCE9FA` | Footer and deeper background surfaces |
| `—bg-soft` | `#E4EFFF` | Secondary background |
| `—surface` | `#F5F8FF` | Cards and content panels |
| `—surface-2` | `#E0ECFC` | Inputs and interactive surfaces |
| `—blue` | `#416B9E` | Primary blue accent |
| `—blue-bright` | `#254E82` | Strong blue accent |
| `—blue-deep` | `#17385E` | Headings and navigation |
| `—gold` | `#B58B43` | Buttons and key highlights |
| `—gold-bright` | `#E4C47E` | Decorative accents |
| `—gold-light` | `#FFF0C9` | Highlighted surfaces |
| `—text` | `#1D3554` | Primary text |
| `—text-soft` | `#405976` | Secondary text |
| `—muted` | `#617792` | Supporting text |
| `—border` | `rgba(49, 91, 143, .18)` | Standard borders |
| `—border-gold` | `rgba(181, 139, 67, .42)` | Gold-accent borders |

### Background requirements

- Avoid pure-white page sections as the default visual treatment.
- Use tinted blue, champagne, pale cream and related muted surfaces.
- Maintain sufficient contrast between text and background.
- Keep decorative gradients behind content rather than over text.
- Use deep-blue image overlays where text is placed on photographs.
- Avoid excessive gold decoration that reduces readability.

### Typography

Recommended fonts:

- **DM Sans:** navigation, body text, controls and supporting content.
- **Playfair Display:** major headings and selected editorial titles.
- **Georgia or a sans-serif fallback:** use when web fonts cannot load.

Use responsive font sizes, consistent line heights and readable text widths. Prevent horizontal overflow, broken words and clipped navigation labels.

### Shared interface components

Pages should use consistent styles for:

- Sticky site header and responsive navigation.
- Dropdown navigation groups.
- Breadcrumb navigation.
- Buttons and text links.
- Eyebrows and section headings.
- Cards with image overlays.
- Category badges.
- Search fields and filter controls.
- FAQ accordions.
- Call-to-action panels.
- Footer columns and policy links.
- Loading, empty and error states where dynamic content is used.

—

## 5. Navigation and Internal Links

Use the website’s established routes rather than inventing alternate paths.

### Main navigation

Recommended groups:

1. Home
2. Education
3. Careers
4. Help
5. About
6. Consultancy
7. News

### Education links

```text
/education/index.html
/education/courses.html
/pages/colleges.html
/education/universities.html
/pages/entrance-exams.html
/pages/admissions.html
/pages/study-abroad.html
/pages/official-documents.html
```

### Career links

```text
/career/index.html
/career/jobs.html
/career/internships.html
/career/resume-support.html
/career/recruitment.html
```

### Company and support links

```text
/pages/about.html
/pages/our-vision.html
/pages/our-mission.html
/pages/services.html
/pages/consultancy.html
/pages/institutional-partners.html
/pages/news.html
/pages/contact.html
/pages/support.html
/pages/help-centre.html
/pages/sitemap.html
```

### Navigation requirements

- Use root-relative paths for internal pages where consistent with the project.
- Mark the current page using `aria-current=“page”`.
- Ensure dropdowns work with touch, keyboard and pointer input.
- Close mobile navigation after a visitor selects a link.
- Provide visible focus indicators.
- Do not link to files that do not exist in the deployed site.
- Test navigation from nested pages and from the homepage.

—

## 6. News Page Standards

`/pages/news.html` is the editorial discovery page for education and career information.

### Recommended categories

- Education and university news
- Medical education and admissions
- Entrance examinations
- Scholarships and financial aid
- International education
- Careers and employment
- Internships and professional development
- Application documents and deadlines

### News card fields

A structured news record should support fields such as:

```json
{
  “id”: “news-example-001”,
  “title”: “Example editorial title”,
  “summary”: “A concise summary of the subject.”,
  “category”: “education”,
  “image”: “/assets/images/news/example.webp”,
  “imageAlt”: “Descriptive alternative text for the image”,
  “publishedAt”: “2026-10-25”,
  “updatedAt”: null,
  “sourceName”: “Official issuing organisation”,
  “sourceUrl”: “https://example.org/official-notice”,
  “articleUrl”: null,
  “contentType”: “editorial-guide”,
  “verificationStatus”: “pending”,
  “featured”: false
}
```

This is a schema example only. Replace placeholder values with real content before publication.

### News publishing rules

- Do not label sample cards as breaking, latest or officially announced without evidence.
- Store actual publication dates in a consistent ISO date format.
- Distinguish the date of publication from the date of an event or deadline.
- Link official notices to the issuing authority.
- Check whether a notice has been amended, withdrawn or superseded.
- Keep summaries accurate and avoid overstating what a source says.
- Add meaningful image alternative text.
- Use a maintained JSON dataset, CMS or API for regularly updated news.
- Keep news search and category filtering functional.
- Display a helpful empty state when no records match a search.
- Never imply that a static HTML page automatically receives live updates.

### Suggested data location

If consistent with the existing project architecture, use:

```text
/assets/data/news.json
```

Alternatively, use the repository’s established data directory if one already exists. Do not create competing datasets for the same content.

—

## 7. Images and Media

### Image sources

Prefer:

1. Images owned by MedOrbits.
2. Licensed stock photography.
3. Approved institutional media.
4. Other images with clearly verified usage rights.

Unsplash and other external image URLs should be checked for availability and licensing requirements before production use.

### Image requirements

- Use relevant images for education, campuses, students, medicine, professional development and international study.
- Provide descriptive `alt` attributes for informative images.
- Use `alt=“”` for purely decorative images.
- Set image dimensions or aspect ratios to reduce layout shifts.
- Lazy-load below-the-fold images.
- Use `fetchpriority=“high”` selectively for the primary hero image.
- Provide a fallback style for failed image requests.
- Avoid placing critical information only inside an image.
- Use optimised WebP or AVIF assets when practical.

### Suggested image folders

```text
/assets/images/logo/
/assets/images/news/
/assets/images/education/
/assets/images/careers/
/assets/images/consultancy/
/assets/images/official-documents/
```

Confirm these folders against the actual repository before adding files.

—

## 8. SEO Requirements

Each public HTML page should have its own relevant metadata.

### Required elements

- Unique page title.
- Accurate meta description.
- Canonical URL.
- Viewport metadata.
- Appropriate robots directives.
- Descriptive headings and subheadings.
- Internal links with meaningful anchor text.
- Descriptive image alternative text.
- Relevant structured data when justified.

### Canonical URL examples

```html
<link rel=“canonical” href=“https://medorbits.in/pages/news.html”>
```

```html
<link rel=“canonical” href=“https://medorbits.in/pages/consultancy.html”>
```

Use the actual canonical route for each page. Avoid canonicalising unrelated pages to one URL.

### Structured data

Use schema types that match the actual page:

- `WebPage` for general informational pages.
- `CollectionPage` for a genuine collection or listing page.
- `Article` or `NewsArticle` for individual articles when the required information is available.
- `Organization` for accurate organisation details.

Structured data must accurately represent visible content. Do not add fabricated ratings, dates, affiliations or article authors.

### Search-engine requirements

- Keep public pages crawlable unless there is a specific reason to restrict them.
- Avoid duplicate titles and descriptions.
- Keep canonical URLs consistent with redirects and the sitemap.
- Do not include private dashboards, temporary URLs or confidential records in the public sitemap.
- Validate structured data and inspect the deployed pages after major changes.

—

## 9. Accessibility and Responsive Design

All pages should aim for WCAG 2.2 AA accessibility.

### Accessibility checklist

- [ ] Include a skip link to the main content.
- [ ] Use semantic `header`, `nav`, `main`, `section` and `footer` elements.
- [ ] Maintain a logical heading hierarchy.
- [ ] Label every form input.
- [ ] Provide visible keyboard focus.
- [ ] Support keyboard interaction for dropdowns and accordions.
- [ ] Use appropriate accessible names for buttons.
- [ ] Do not communicate status using colour alone.
- [ ] Provide descriptive alternative text for meaningful images.
- [ ] Maintain sufficient text contrast.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Keep interactive targets comfortable on touch devices.
- [ ] Ensure text does not overflow at narrow screen widths.
- [ ] Test browser zoom and larger text sizes.

### Responsive layout targets

Test at minimum:

- 320–360 px: compact mobile.
- 375–430 px: common mobile devices.
- 560–800 px: large phones and tablets.
- 801–1100 px: tablet and small laptop.
- 1101 px and above: desktop.

Use CSS Grid and Flexbox with `minmax(0, 1fr)` to help prevent layout overflow.

For card-based pages, two columns on mobile can work where text remains readable. Switch to one column for controls, long forms or layouts that become cramped.

—

## 10. JavaScript and Performance

Keep scripts small, scoped and easy to maintain.

### JavaScript guidelines

- Wrap page-specific logic in an immediately invoked function or module.
- Check that required elements exist before attaching event listeners.
- Avoid unnecessary global variables.
- Use `textContent` for plain user-provided text.
- Avoid inserting untrusted content through `innerHTML`.
- Validate form inputs on both the client and server.
- Provide accessible status and error messages.
- Ensure interactive controls perform their advertised actions.
- Do not claim that a form has been submitted if it only prepares a local preview.
- Do not store sensitive user data in browser storage without a justified, documented design.

### Performance guidelines

- Optimise images before deployment.
- Lazy-load non-critical images.
- Avoid excessive animation and large third-party libraries.
- Load scripts with appropriate `defer` or module behaviour.
- Minimise layout shifts.
- Avoid loading multiple font families unnecessarily.
- Respect reduced-motion preferences.
- Check the browser console for runtime errors.

—

## 11. Forms, Privacy and Security

Forms on consultancy, contact and support pages must have a clear processing flow.

### Before enabling a live form

- Identify the receiving endpoint or approved service.
- Document the purpose of every collected field.
- Collect only the information needed for the request.
- Provide a suitable privacy notice and retention policy.
- Validate data on the server.
- Add abuse prevention and rate limiting where appropriate.
- Use HTTPS.
- Apply appropriate access controls to stored enquiries.
- Avoid logging passwords, OTPs, payment credentials or unnecessary sensitive records.
- Test successful submission, validation failures and server errors.
- Provide clear confirmation only after the server confirms success.

A standalone frontend form does not transmit or store information unless it is connected to a functioning submission service.

Never expose API keys, administrative tokens, database credentials or private service endpoints in client-side JavaScript.

—

## 12. Accuracy and Editorial Responsibility

Education, medical admissions, examination and career information can materially affect a user’s decisions.

For time-sensitive content:

1. Find the original issuing organisation.
2. Read the complete notice or official documentation.
3. Confirm the relevant academic year or examination cycle.
4. Check eligibility, dates, fees and document requirements.
5. Check for later amendments.
6. State the publication or update date accurately.
7. Link the original source.
8. Correct or remove outdated information promptly.

Do not guarantee admission, exam results, employment, scholarship awards, visa approvals or any other decision controlled by a third party.

Do not describe an organisation as an institutional partner without a verifiable basis and appropriate permission.

When official information cannot be confirmed, label the content as general guidance or omit the unsupported claim.

—

## 13. Internal Linking and Related Pages

Use relevant internal links to help visitors move between related topics.

| Starting page | Related destinations |
|—|—|
| News | Admissions, entrance exams, education, careers |
| Consultancy | Admissions, colleges, study abroad, contact |
| Colleges | Courses, universities, admissions |
| Entrance exams | Admissions, official documents, education |
| Study abroad | Universities, admissions, consultancy |
| Careers | Jobs, internships, resume support |
| Official documents | Admissions, support, contact |
| Support | Contact, help centre, privacy policy |

Only create links to destinations that exist or are intentionally planned for the release.

—

## 14. Testing Checklist

Before releasing a page, complete the following checks.

### Content and links

- [ ] Correct page title and description.
- [ ] Correct canonical URL.
- [ ] No placeholder copy presented as fact.
- [ ] No unsupported institutional claims.
- [ ] Internal links resolve correctly.
- [ ] External links use the correct destination.
- [ ] Current-page navigation is marked correctly.
- [ ] Dates and official references have been checked.

### Design and responsiveness

- [ ] Palette matches the approved design system.
- [ ] No unwanted pure-white content sections.
- [ ] No horizontal scrolling at target widths.
- [ ] Images have appropriate aspect ratios.
- [ ] Cards fit the mobile grid.
- [ ] Navigation works on mobile and desktop.
- [ ] Footer columns wrap correctly.
- [ ] Focus indicators are visible.

### Functionality

- [ ] Search returns expected results.
- [ ] Category filters work correctly.
- [ ] Empty states are understandable.
- [ ] Dropdowns work with keyboard and touch.
- [ ] FAQ accordions work.
- [ ] Form validation behaves correctly.
- [ ] No false submission confirmation appears.
- [ ] No JavaScript errors appear in the browser console.

### Production checks

- [ ] Images load successfully.
- [ ] External resources have been reviewed.
- [ ] No secrets are exposed in frontend code.
- [ ] Privacy and legal links resolve.
- [ ] Structured data matches visible content.
- [ ] Sitemap and canonical URLs are consistent.

—

## 15. Maintenance Workflow

When adding or updating a page:

1. Inspect the current repository structure.
2. Confirm whether the requested page already exists.
3. Reuse the approved design system and navigation.
4. Preserve existing routes and integrations.
5. Add only the necessary files and dependencies.
6. Verify links, assets, metadata and interactive behaviour.
7. Test mobile and desktop layouts.
8. Review content accuracy and accessibility.
9. Update this README if directory responsibilities or conventions change.
10. Verify the deployed page after release.

Avoid rewriting unrelated pages or duplicating existing datasets during a page-specific change.

—

## 16. Source of Truth

This README documents intended conventions for the MedOrbits `/pages/` directory. It does not prove that every listed page, dataset, image or integration exists in the current deployment.

When the README and the actual repository differ:

1. Inspect the current code and directory structure.
2. Identify the existing routes and integrations.
3. Preserve functioning production behaviour.
4. Update the documentation to reflect the approved implementation.

**End of README**
