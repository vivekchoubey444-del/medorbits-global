MedOrbits — Assets Architecture & Resource Guide

File: assets/README.md
Project: MedOrbits
Website: https://www.medorbits.in/
Version: 1.0.0
Status: Architecture documentation — verify actual files before marking implementation complete.

⸻

1. Purpose

The assets/ directory contains the reusable resources that support the MedOrbits website, including stylesheets, JavaScript, structured data, images, fonts, and documents.

It supports the following website areas:

* Education and course discovery
* Admissions and counselling guidance
* College and university directories
* Medical education resources
* Official-document guidance
* Study-abroad information
* Careers, jobs, internships, and recruitment
* Application forms and applicant-facing interfaces
* Shared navigation, dashboards, and interface components
* Responsive layouts, accessibility, and print-friendly pages

The objective is to keep website resources organised, reusable, maintainable, and easy to locate.

Important: This document describes the recommended resource architecture. It does not establish that every referenced resource exists, is complete, or is used by the deployed website.

⸻

2. Current directory structure

The following structure is based on the supplied repository screenshot. Verify the current repository for the complete file inventory.

assets/
├── README.md
├── data/
│   └── ... JSON data files
├── documents/
│   └── ... document resources
├── fonts/
│   └── ... font files
├── images/
│   ├── ... image categories
│   └── ... brand and content images
├── js/
│   └── ... JavaScript modules
└── css/
    ├── README.md
    ├── accessibility.css
    ├── animations.css
    ├── cards.css
    ├── components.css
    ├── dashboard.css
    ├── font.css
    ├── forms.css
    ├── layout.css
    ├── navigation.css
    ├── print.css
    ├── reset.css
    ├── responsive.css
    ├── styles.css
    ├── tables.css
    ├── theme.css
    ├── typography.css
    └── variables.css

The screenshot indicates that data/ contains 15 files, js/ contains 23 files, and images/ contains seven directories at the time of capture. These counts may change as the repository evolves.

The documents/ and fonts/ directories appeared empty in the screenshot. Verify their contents before relying on any document or font asset.

⸻

3. Directory responsibilities

Directory	Responsibility
assets/css/	Shared styles, layout, themes, components, responsive behaviour, accessibility, and print presentation
assets/js/	Client-side interactions, navigation behaviour, form enhancements, and other browser functionality
assets/data/	Structured content and configuration data, such as JSON datasets
assets/documents/	Public documents, templates, and downloadable resources approved for publication
assets/fonts/	Locally hosted web fonts and related font assets
assets/images/	Brand assets, illustrations, icons, college images, and other approved visual resources

Each directory should have a clear purpose. Avoid storing multiple copies of the same resource in different locations without a documented reason.

⸻

4. CSS architecture

The assets/css/ directory contains the website’s styling system.

Its current file inventory includes:

* reset.css — browser normalisation and baseline styling
* variables.css — shared design variables
* theme.css — theme-specific overrides
* font.css — font loading and configuration
* typography.css — heading and text hierarchy
* styles.css — shared site styling
* layout.css — containers, grids, and page structure
* components.css — reusable interface components
* navigation.css — navigation and menu styling
* cards.css — reusable cards and content panels
* forms.css — form controls and validation presentation
* tables.css — tables and responsive data layouts
* dashboard.css — dashboard presentation
* accessibility.css — accessibility-related styling
* animations.css — transitions and optional motion
* responsive.css — responsive refinements
* print.css — printing and print-friendly documents

The assets/css/README.md file is the detailed reference for stylesheet responsibilities, conventions, integration, testing, and maintenance.

CSS rules

1. Reuse existing design tokens instead of repeatedly hard-coding colours and spacing.
2. Keep shared component styles in the appropriate shared stylesheet.
3. Use page-specific styling only when a page needs a genuinely unique layout or treatment.
4. Avoid conflicting selectors and duplicate stylesheet imports.
5. Keep responsive and accessibility behaviour consistent across shared components.
6. Do not claim that a theme automatically affects all components until their styles consume the appropriate theme variables.
7. Test shared styling changes across representative pages before approving them.

Stylesheet loading

The HTML pages should reference the intended stylesheets through a consistent loading strategy.

Use either direct stylesheet links or a single CSS entry point. Do not combine both approaches in a way that loads the same styles repeatedly.

Check the CSS README for the current integration guidance.

⸻

5. JavaScript resources

The assets/js/ directory contains browser-side scripts used by the website.

Depending on the actual files, these scripts may provide:

* Navigation interactions
* Dropdown menus and mobile navigation
* Search and filtering
* Form interaction and client-side validation
* Multi-step application interfaces
* Document preview interactions
* Dashboard presentation and user-interface behaviour
* Accessibility enhancements
* Optional animations

These are functional categories, not a claim that every feature is currently implemented.

JavaScript rules

* Use descriptive filenames and clear module responsibilities.
* Avoid duplicating functionality across multiple scripts.
* Check whether a script is already loaded before adding another reference.
* Load scripts in the order required by their dependencies.
* Prefer event listeners and modular functions over unnecessary global variables.
* Handle missing DOM elements safely when scripts are shared across multiple pages.
* Report errors clearly without exposing secrets or sensitive applicant data.
* Avoid unnecessary third-party dependencies.
* Respect reduced-motion preferences.
* Test interactions on mobile as well as desktop.

Security

Client-side validation improves usability but cannot enforce security by itself. The backend must independently validate data, authenticate users, enforce permissions, and protect sensitive operations.

Do not place private API keys, passwords, session secrets, or confidential applicant information in public JavaScript files.

⸻

6. Structured data

The assets/data/ directory stores structured information used by the website.

Depending on the actual dataset, this may include:

* Courses and education categories
* Entrance examinations
* Colleges and universities
* Admission procedures
* Document checklists
* Study-abroad destinations
* Career categories
* Jobs and internships
* Website configuration and metadata

Data quality rules

* Use valid JSON syntax.
* Preserve a consistent schema for related records.
* Use null for unknown values where the schema permits it.
* Do not invent official fees, admission dates, eligibility rules, or institutional details.
* Distinguish verified information from unverified information.
* Record official sources when required by the relevant schema.
* Keep dates in the documented format, preferably YYYY-MM-DD.
* Use the documented currency and country-code conventions consistently.
* Validate changes before publication.
* Avoid embedding personal applicant data in public datasets.

For official education and admissions information, use authoritative sources and record when verification occurred if the data model supports it.

Example record

The following is an illustrative structure, not a verified college or admission record.

{
  “id”: “example-record”,
  “name”: “Example Resource”,
  “verificationStatus”: “unverified”,
  “sourceUrl”: null,
  “lastVerified”: null
}

Adjust property names to the existing schema rather than forcing all datasets to use the same structure.

Validation

Use the project’s existing JSON validation tools when available. Confirm the actual script name in package.json or the repository documentation before running or documenting a command.

⸻

7. Documents and downloadable resources

The assets/documents/ directory is intended for approved public documents and downloadable resources.

Potential uses include:

* Public guidance documents
* Educational reference materials
* Public checklists
* Approved templates
* Publicly distributable brochures
* Other resources intended for website visitors

Do not assume that every PDF or application document belongs in this directory. Follow the existing repository’s storage and access-control design.

Document handling rules

* Publish only documents intended to be public.
* Verify the document’s accuracy, source, and publication rights.
* Use descriptive filenames.
* Avoid exposing private application files, identity documents, signatures, or financial records.
* Check that download links resolve correctly.
* Provide accessible HTML alternatives for important information where practical.
* Keep public informational documents separate from private applicant uploads.

Private applicant uploads should use the project’s approved private storage and authorised backend access controls, not a publicly accessible static assets directory.

⸻

8. Fonts

The assets/fonts/ directory is intended for locally hosted font files.

The site’s design may use:

* DM Sans for body copy, navigation, labels, and controls
* Playfair Display for selected headings and editorial elements
* System fonts as fallbacks

The actual fonts, file names, weights, and formats must be verified in the repository.

Font rules

1. Confirm that each referenced font file exists.
2. Use the correct font weight and style in @font-face.
3. Include appropriate fallback fonts.
4. Load only the weights needed by the website.
5. Verify font licences before hosting fonts locally.
6. Use font-display: swap where appropriate to reduce invisible text during loading.
7. Check that typography remains readable when a custom font fails.

Do not assume that a font is installed simply because font.css references it.

⸻

9. Images and brand resources

The assets/images/ directory stores visual resources used by the website.

Recommended categories may include:

* Brand logos and marks
* Course and education illustrations
* College and institution images
* Career and recruitment visuals
* Document illustrations
* General interface graphics
* Approved decorative backgrounds

These categories should reflect the existing image directories rather than being created unnecessarily.

Image rules

* Use descriptive filenames.
* Prefer modern, appropriately sized image formats when supported.
* Provide meaningful alternative text for informative images.
* Use empty alternative text for purely decorative images.
* Avoid embedding text in images when HTML text would be more accessible.
* Optimise image dimensions and file sizes.
* Preserve appropriate aspect ratios.
* Verify image ownership and usage rights.
* Avoid using unofficial logos in a way that implies endorsement.
* Do not expose confidential applicant documents or personal photographs.

For responsive images, use suitable srcset and sizes attributes when multiple image sizes are available.

⸻

10. Resource paths

For a static website served from the domain root, root-relative paths are often convenient.

Examples:

<link rel=“stylesheet” href=“/assets/css/styles.css”>
<script src=“/assets/js/example.js” defer></script>
<img src=“/assets/images/example.webp” alt=“Example illustration”>

The example filenames are illustrative and must be replaced with verified paths.

Path rules

* Confirm that the target file exists.
* Match filename capitalisation exactly.
* Use a consistent path convention.
* Test links from nested HTML pages.
* Verify paths against the actual deployment base path.
* Do not reference a local development server in production HTML.
* Do not assume that a file is public merely because it is located under assets/.

Root-relative paths may need adjustment if the website is deployed under a subpath rather than the domain root.

⸻

11. Privacy and security

Static assets are generally downloadable by visitors when served publicly. Never use a public asset directory as a substitute for private storage.

Never publish

* API secrets or private keys
* Passwords or session secrets
* Private applicant documents
* Identity documents or signatures
* Confidential payment records
* Internal administrative data
* Private configuration files
* Sensitive personal information

Security requirements

* Enforce access control on the server.
* Keep private uploads in approved private storage.
* Validate file types, size limits, and upload content on the server.
* Do not rely on hidden buttons or CSS visibility for authorisation.
* Avoid leaking sensitive values in browser logs or error messages.
* Use approved third-party dependencies only.
* Verify that downloadable resources are intentionally public.

⸻

12. Performance and maintainability

Keep asset loading efficient without sacrificing readability or accessibility.

Recommended practices:

* Avoid unnecessary duplicate assets.
* Remove unused CSS and JavaScript only after checking actual usage.
* Optimise images and fonts.
* Use browser caching policies appropriate to each asset type.
* Avoid loading page-specific resources on unrelated pages where practical.
* Use deferred JavaScript loading when appropriate.
* Keep shared components and data schemas consistent.
* Minify or bundle resources only through a tested build process.
* Measure performance before claiming an improvement.
* Recheck representative pages after changing shared assets.

⸻

13. Validation and testing

Before releasing an asset change, verify:

CSS

* All referenced stylesheets load successfully.
* There are no unintended duplicate imports.
* Layouts work on mobile and desktop.
* Themes remain readable.
* Focus indicators are visible.
* Reduced-motion preferences are respected.
* Print output remains usable where relevant.

JavaScript

* Scripts load without console errors.
* Interactions work with keyboard and touch input.
* Missing elements do not break unrelated pages.
* Form validation and submission states behave as intended.
* Sensitive information is not exposed.

JSON data

* JSON syntax is valid.
* Schemas remain compatible.
* Required fields are present.
* Official-source claims are supported.
* Unknown information is not fabricated.
* Public datasets contain no private applicant information.

Images, fonts, and documents

* Files exist at their referenced paths.
* Resources load correctly in production.
* Image alternatives are appropriate.
* Font fallbacks work.
* Documents are intentionally public and have been checked for accuracy.

Repository checks

Run the project’s documented validation commands when available. Do not assume that a particular npm script exists without inspecting package.json.

⸻

14. Change-management workflow

Before modifying assets:

1. Inspect the existing directory and relevant files.
2. Identify which pages and features use the resource.
3. Check whether an equivalent asset already exists.
4. Make the smallest maintainable change.
5. Update references when paths change.
6. Test affected pages and interactions.
7. Run applicable validation checks.
8. Check privacy and publication requirements.
9. Update this README when the architecture changes.
10. Obtain approval before committing or pushing if approval is required.

Changes to shared CSS, fonts, or JavaScript may affect multiple sections. Test representative education, admissions, documents, careers, application, and dashboard pages as appropriate.

⸻

15. Completion checklist

Before declaring an asset change complete:

* [ ]	The file exists at the documented path.
* [ ]	References use the correct path and filename.
* [ ]	No unnecessary duplicate assets were introduced.
* [ ]	Shared styles and scripts follow the existing architecture.
* [ ]	Responsive behaviour has been tested.
* [ ]	Accessibility requirements have been considered.
* [ ]	JSON data is valid where applicable.
* [ ]	Fonts, images, and documents load correctly.
* [ ]	No confidential information is exposed.
* [ ]	Relevant validation checks pass.
* [ ]	Affected pages have been inspected.
* [ ]	Documentation reflects the actual implementation.

⸻

16. Source of truth

When this README and the implementation disagree, use the following order:

1. Actual files in the current repository
2. Actual HTML references and build configuration
3. Existing schemas, design tokens, and component definitions
4. Tests and verified browser behaviour
5. Documentation and illustrative examples

Do not assume that a resource exists, a feature works, or a security control is implemented merely because it is described here.

⸻

17. Maintenance

Review this document when:

* The asset directory structure changes.
* Shared styles or design tokens change.
* JavaScript modules are added, removed, or reorganised.
* Data schemas change.
* Fonts or brand assets are replaced.
* Document publication or private-upload workflows change.
* Deployment paths or build tooling change.
* Accessibility, privacy, or security requirements change.

Maintain one authoritative copy at assets/README.md.

⸻

MedOrbits — Education · Admissions · Careers · Recruitment

Website: https://www.medorbits.in/

This guide documents the intended asset architecture. Verify repository contents and deployed behaviour before marking any implementation complete.