MedOrbits — CSS Architecture & Styling Guide

File: assets/css/README.md
Project: MedOrbits
Website: https://www.medorbits.in/
Version: 1.1.0
Status: Architecture documentation; implementation must be verified against the repository.

⸻

1. Purpose

The assets/css/ directory contains the stylesheets responsible for MedOrbits’ visual design, layout, typography, responsiveness, accessibility, themes, and reusable interface components.

The styling system supports:

* Main website and landing pages
* Education and course discovery
* Admissions and counselling resources
* College and university information
* Official-document guidance
* Study-abroad resources
* Careers, jobs, internships, and recruitment
* Application forms and applicant interfaces
* Account, applicant, and administrative dashboards
* Navigation, cards, buttons, notices, and tables
* Mobile, tablet, laptop, and desktop layouts
* Keyboard accessibility, readable typography, and reduced motion
* Print-friendly documents and application pages

The objective is to maintain a consistent, accessible, responsive, and maintainable design system without unnecessary duplication.

Implementation rule: this document describes the intended architecture. A file’s presence in this guide does not prove that the file exists, is loaded, or is fully implemented. Confirm the actual repository before reporting completion.

⸻

2. Current CSS directory

The following files appear in the supplied repository screenshots. Verify the current repository before treating this inventory as exhaustive.

assets/
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

Directory rules

1. Preserve existing filenames unless a refactor has been reviewed and approved.
2. Keep shared design tokens in a single authoritative location.
3. Keep page-specific styling separate only when a page genuinely needs unique styling.
4. Do not create empty CSS files merely to match a proposed directory tree.
5. Avoid defining the same component in several files without a clear override strategy.
6. Do not load the same stylesheet twice.
7. Test every change that affects shared styles against the pages that use them.
8. Keep this README aligned with the actual repository.

Optional future modules, such as buttons.css, utilities.css, pages/, or themes/, may be introduced when there is a clear maintenance benefit. They are not prerequisites for the current architecture.

⸻

3. Design principles

MedOrbits uses a premium visual direction built around deep backgrounds, restrained champagne-gold accents, clear typography, carefully spaced layouts, and accessible interface states.

The shared system should provide consistency without forcing every page to have an identical appearance.

Core principles

* Consistent: shared components follow common design rules.
* Adaptable: pages can use different themes and accent colours.
* Responsive: content works across narrow phones, tablets, and desktop screens.
* Accessible: focus, contrast, labels, and reduced motion are considered.
* Maintainable: repeated styles use shared tokens and reusable components.
* Progressive: pages remain readable when optional fonts or decorative effects fail.
* Honest: CSS presentation does not imply that a feature, backend operation, or security control exists when it does not.

⸻

4. Design tokens

variables.css and theme.css should have clearly separated responsibilities.

Recommended responsibility split:

File	Responsibility
variables.css	Canonical fallback values and shared design variables
theme.css	Explicit theme overrides and theme-specific colours
font.css	Font loading and font-family configuration
typography.css	Heading, paragraph, list, and text hierarchy
styles.css	Shared base elements and common styling
layout.css	Containers, grids, spacing, and structural layouts
components.css	Reusable interface components
responsive.css	Cross-component responsive refinements

Avoid maintaining two unrelated token systems. If variables.css already defines a variable, reuse it or migrate it deliberately instead of introducing a conflicting replacement.

4.1 Example token system

The following is a valid CSS example. Merge it with the project’s existing variables.css rather than blindly replacing existing tokens.

/* assets/css/variables.css */
:root {
  /* Backgrounds */
  —mo-bg: #100a17;
  —mo-bg-elevated: #191023;
  —mo-surface: #21172b;
  —mo-surface-hover: #2b1d36;
  /* Brand */
  —mo-gold: #c9a96e;
  —mo-gold-light: #e4d0a1;
  /* Text */
  —mo-text: #f7f1fa;
  —mo-text-muted: #b7acbf;
  —mo-text-inverse: #100a17;
  /* Borders */
  —mo-border: #40304d;
  —mo-border-strong: #705a7f;
  /* Semantic states */
  —mo-success: #a8d7b1;
  —mo-warning: #f0cc83;
  —mo-danger: #ffaaaa;
  —mo-info: #a8c9f5;
  /* Typography */
  —mo-font-body: “DM Sans”, system-ui, sans-serif;
  —mo-font-heading: “Playfair Display”, Georgia, serif;
  —mo-text-xs: 0.75rem;
  —mo-text-sm: 0.875rem;
  —mo-text-base: 1rem;
  —mo-text-lg: 1.125rem;
  —mo-heading-sm: 1.5rem;
  —mo-heading-md: 2rem;
  —mo-heading-lg: clamp(2.25rem, 5vw, 4rem);
  /* Spacing */
  —mo-space-1: 0.25rem;
  —mo-space-2: 0.5rem;
  —mo-space-3: 0.75rem;
  —mo-space-4: 1rem;
  —mo-space-6: 1.5rem;
  —mo-space-8: 2rem;
  —mo-space-12: 3rem;
  —mo-space-16: 4rem;
  /* Layout */
  —mo-container: 1160px;
  —mo-header-height: 76px;
  /* Shape */
  —mo-radius-sm: 8px;
  —mo-radius-md: 12px;
  —mo-radius-lg: 18px;
  —mo-radius-xl: 24px;
  /* Shadows */
  —mo-shadow-sm: 0 4px 14px rgb(0 0 0 / 12%);
  —mo-shadow-lg: 0 18px 48px rgb(0 0 0 / 22%);
  /* Layering */
  —mo-z-header: 100;
  —mo-z-dropdown: 200;
  —mo-z-overlay: 900;
  —mo-z-dialog: 1000;
}

4.2 Correct token usage

.card {
  padding: var(—mo-space-6);
  border: 1px solid var(—mo-border);
  border-radius: var(—mo-radius-lg);
  background: var(—mo-surface);
  color: var(—mo-text);
}

CSS custom properties must start with two ordinary hyphens, such as —mo-bg. Use straight quotation marks in CSS strings.

Do not use typographic em dashes, en dashes, or curly quotes in place of CSS syntax.

⸻

5. Theme management

Themes should be explicit and predictable. theme.css may define royal, burgundy, sapphire, light, and ivory themes, provided those theme selectors are actually implemented.

Example HTML:

<body data-theme=“royal” data-page=“home”>

Other examples:

<body data-theme=“burgundy” data-page=“admissions”>
<body data-theme=“sapphire” data-page=“study-abroad”>
<body data-theme=“light” data-page=“applications”>

Theme requirements

* Theme attributes should be optional and documented.
* Page-specific accents must not force unrelated page layouts.
* Light themes must provide suitable text, border, focus, and input colours.
* Dark themes must maintain readable contrast.
* Components should consume shared variables rather than hard-code every colour.
* Avoid selectors that assume data-theme and data-page are on different elements when both attributes are placed on the same <body>.
* Test theme combinations on real pages before claiming complete theme switching.

Changing CSS variables will not automatically recolour components that still use hard-coded values.

⸻

6. Stylesheet responsibilities

File	Responsibility
reset.css	Browser normalization and safe baseline rules
variables.css	Shared variables and fallback values
theme.css	Theme-specific design overrides
font.css	Font-face declarations and font loading
typography.css	Text hierarchy, headings, paragraphs, and reading styles
styles.css	Shared site foundations and common elements
layout.css	Containers, grids, sections, and page structure
components.css	Reusable interface components
navigation.css	Header, menus, navigation, breadcrumbs, and related patterns
cards.css	College, course, job, resource, and feature cards
forms.css	Inputs, labels, validation, uploads, and form layouts
tables.css	Tables, responsive wrappers, and table variants
dashboard.css	Applicant, career, employer, and admin dashboard layouts
accessibility.css	Focus indicators, skip links, and accessibility utilities
animations.css	Optional motion and transition rules
responsive.css	Responsive refinements across components
print.css	Print and PDF print-layout rules
README.md	Architecture, conventions, and maintenance instructions

These boundaries are guidelines. A component may need a small amount of styling in more than one file, but there should be a clear reason and no accidental cascade conflicts.

⸻

7. Stylesheet loading strategy

Use one loading strategy per page. Do not combine both approaches without checking for duplicate rules.

Option A — Direct stylesheet links

This is the recommended approach for a static website when individual CSS files are maintained separately.

Place the following in the HTML <head> after verifying that each file exists:

<link rel=“stylesheet” href=“/assets/css/reset.css”>
<link rel=“stylesheet” href=“/assets/css/variables.css”>
<link rel=“stylesheet” href=“/assets/css/theme.css”>
<link rel=“stylesheet” href=“/assets/css/font.css”>
<link rel=“stylesheet” href=“/assets/css/typography.css”>
<link rel=“stylesheet” href=“/assets/css/styles.css”>
<link rel=“stylesheet” href=“/assets/css/layout.css”>
<link rel=“stylesheet” href=“/assets/css/components.css”>
<link rel=“stylesheet” href=“/assets/css/navigation.css”>
<link rel=“stylesheet” href=“/assets/css/cards.css”>
<link rel=“stylesheet” href=“/assets/css/forms.css”>
<link rel=“stylesheet” href=“/assets/css/tables.css”>
<link rel=“stylesheet” href=“/assets/css/dashboard.css”>
<link rel=“stylesheet” href=“/assets/css/accessibility.css”>
<link rel=“stylesheet” href=“/assets/css/animations.css”>
<link rel=“stylesheet” href=“/assets/css/responsive.css”>
<link rel=“stylesheet” href=“/assets/css/print.css” media=“print”>

This order establishes the reset and variables first, theme and typography next, shared styling after that, and specialised overrides towards the end.

The final order may need adjustment to match the actual selectors and cascade dependencies in the existing files.

Important: if styles.css contains this line:

@import url(“./variables.css”);

remove that import when variables.css is already linked separately in the HTML. Keep the import only if you deliberately use a compatible single-entry-point approach.

Option B — A single CSS entry point

A single entry point is also possible, but only after confirming that all imported files exist and are intended to be imported together.

/* Example only: use after verifying the modules. */
@import url(“./reset.css”);
@import url(“./variables.css”);
@import url(“./theme.css”);
@import url(“./font.css”);
@import url(“./typography.css”);
@import url(“./layout.css”);
@import url(“./components.css”);
@import url(“./navigation.css”);
@import url(“./cards.css”);
@import url(“./forms.css”);
@import url(“./tables.css”);
@import url(“./dashboard.css”);
@import url(“./accessibility.css”);
@import url(“./animations.css”);
@import url(“./responsive.css”);
@import url(“./print.css”);

When using this strategy, the HTML should load the entry point instead of separately linking every imported file.

All @import rules must appear before ordinary style rules in the importing stylesheet. For production, a tested build process can bundle and optimise the CSS.

⸻

8. Typography standards

Recommended font pairing:

* DM Sans: body copy, navigation, labels, tables, and form controls.
* Playfair Display: selected headings and editorial brand elements.
* System fonts: reliable fallbacks when web fonts are unavailable.

Example:

body {
  margin: 0;
  background: var(—mo-bg);
  color: var(—mo-text);
  font-family: var(—mo-font-body);
  font-size: var(—mo-text-base);
  line-height: 1.7;
}
h1,
h2,
h3 {
  font-family: var(—mo-font-heading);
  line-height: 1.2;
  text-wrap: balance;
}
h1 {
  font-size: var(—mo-heading-lg);
  letter-spacing: -0.025em;
}
p {
  margin-block: 0 1rem;
}
small,
.text-muted {
  color: var(—mo-text-muted);
}

Typography requirements:

* Maintain readable body text.
* Use a clear heading hierarchy.
* Avoid excessive letter spacing in paragraphs.
* Prevent long headings from overflowing narrow screens.
* Do not use font size alone to communicate status or importance.
* Verify font file paths and licensing before self-hosting.
* Load only the font weights the site actually needs.

⸻

9. Layout and responsive design

Prefer flexible containers and grids over fixed widths.

.container {
  width: min(
    var(—mo-container),
    calc(100% - 2rem)
  );
  margin-inline: auto;
}
.section {
  padding-block: clamp(2.5rem, 6vw, 5rem);
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(—mo-space-4);
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .container {
    width: min(
      calc(100% - 1.5rem),
      var(—mo-container)
    );
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

These are examples. Adapt class names and breakpoints to the actual page structure and existing responsive styles.

Responsive test targets

Viewport width	Primary checks
320–375 px	Narrow phones, wrapping, navigation
390–430 px	Common mobile layouts and touch targets
600–800 px	Tablets and compact browser windows
1024 px	Laptop layouts
1280 px and above	Desktop grids and content width

Check for horizontal overflow, clipped buttons, overlapping text, inaccessible navigation, and tables that cannot be used on mobile.

⸻

10. Reusable components

10.1 Buttons

Buttons should distinguish primary, secondary, and disabled actions.

.button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: var(—mo-space-2);
  padding: 0.75rem 1.125rem;
  border: 1px solid var(—mo-gold);
  border-radius: var(—mo-radius-md);
  background: var(—mo-gold-light);
  color: var(—mo-text-inverse);
  font: inherit;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}
.button:hover {
  background: var(—mo-gold);
}
.button-secondary {
  border-color: var(—mo-border);
  background: var(—mo-surface);
  color: var(—mo-text);
}
.button:disabled,
.button[aria-disabled=“true”] {
  cursor: not-allowed;
  opacity: 0.6;
}

Do not remove focus indicators. Use native disabled when an action is genuinely disabled; aria-disabled alone does not disable behaviour.

10.2 Cards

.card {
  min-width: 0;
  padding: var(—mo-space-6);
  border: 1px solid var(—mo-border);
  border-radius: var(—mo-radius-lg);
  background: var(—mo-surface);
  color: var(—mo-text);
}
.card__title {
  margin-top: 0;
  color: var(—mo-gold-light);
}
.card__description {
  color: var(—mo-text-muted);
}

Use cards.css for specialised college, course, job, and resource cards.

10.3 Notices and statuses

Provide visually distinct informational, warning, error, and success states. Never communicate a critical state through colour alone.

10.4 Forms

Form styling should support:

* Visible labels
* Required-field indicators
* Helpful instructions
* Inline validation errors
* Keyboard focus
* Readable controls on dark and light backgrounds
* Upload progress and submission states where implemented
* Responsive multi-step forms where implemented

CSS improves presentation. It does not replace server-side validation, authentication, or authorisation.

⸻

11. Accessibility

Accessibility is part of the shared design system.

11.1 Keyboard focus

:where(
  a,
  button,
  input,
  select,
  textarea,
  summary,
  [tabindex]
):focus-visible {
  outline: 3px solid var(—mo-gold-light);
  outline-offset: 3px;
}

Avoid applying tabindex indiscriminately. Interactive elements should use appropriate semantic HTML.

11.2 Skip links

.skip-link {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: var(—mo-z-overlay);
  padding: 0.75rem 1rem;
  transform: translateY(-180%);
  border-radius: var(—mo-radius-sm);
  background: var(—mo-gold-light);
  color: var(—mo-text-inverse);
}
.skip-link:focus {
  transform: translateY(0);
}

A matching link should appear near the beginning of the page and target a real main-content element, for example:

<a class=“skip-link” href=“#main-content”>Skip to main content</a>
<main id=“main-content”>
  <!— Page content —>
</main>

11.3 Reduced motion

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

JavaScript-driven animation should also respect the user’s reduced-motion preference.

11.4 Accessibility checks

* Ensure sufficient contrast between text and backgrounds.
* Preserve visible keyboard focus.
* Do not use colour as the only indicator of errors or success.
* Test increased text sizes and narrow screens.
* Ensure sticky headers do not hide focused controls or anchor targets.
* Avoid motion that interferes with reading.
* Test keyboard navigation and, where practical, screen-reader behaviour.

⸻

12. CSS security and privacy

CSS is client-side presentation code, not an access-control system.

Rules:

* Never include passwords, private keys, API secrets, or confidential applicant data in CSS.
* Do not rely on display: none to protect sensitive information already sent to the browser.
* Do not place confidential information in comments, data URLs, or generated content.
* Avoid importing untrusted external stylesheets.
* Document external font and asset dependencies.
* Enforce authentication and authorisation on the server.
* Do not use visual hiding to represent a security boundary.

⸻

13. Performance standards

Keep CSS efficient and avoid unnecessary rendering work.

Recommended practices:

* Remove unused rules only after checking their use across the project.
* Avoid duplicating shared component styles.
* Limit expensive visual effects on large repeated elements.
* Use animations selectively.
* Avoid excessive selector specificity.
* Reuse established design tokens.
* Keep responsive rules organised.
* Minify CSS only through a tested deployment process.
* Test the rendered page after minification.
* Avoid loading page-specific styles on unrelated pages when the architecture supports selective loading.

Do not claim a performance improvement without measuring it.

⸻

14. Loading CSS in HTML

For a static website deployed at the domain root, a root-relative reference is commonly appropriate:

<link rel=“stylesheet” href=“/assets/css/styles.css”>

Confirm that root-relative paths work for the actual deployment and any subpath hosting.

Rules:

* Reference only existing files.
* Choose direct stylesheet links or a single entry point; do not accidentally use both.
* Avoid loading the same file more than once.
* Keep inline CSS limited to justified use cases.
* Check the browser console and network panel for missing stylesheets.
* Verify that the production domain serves the expected CSS.

⸻

15. Validation and testing

15.1 Repository checks

Run the project’s documented validation command from the repository root, if it exists:

npm run check

Do not assume this script is defined in package.json.

15.2 Browser validation

Inspect representative pages and check for:

* Missing stylesheet requests
* Unexpected browser defaults
* Horizontal overflow
* Overlapping text or controls
* Broken hover or focus states
* Unreadable form fields
* Inconsistent typography
* Inaccessible sticky navigation
* Unwanted animation when reduced motion is enabled
* Incorrect colours in light and dark themes

15.3 Visual regression

Where available, use browser automation or screenshot comparisons to detect unintended layout changes after shared CSS modifications.

A visual difference is not automatically a defect; compare it with the intended design.

15.4 Accessibility validation

Automated accessibility checks are useful as an initial screen, but they must be supplemented with keyboard and manual testing.

Passing automated checks alone does not establish full accessibility compliance.

⸻

16. Change-management workflow

Before modifying a shared stylesheet:

1. Inspect the existing stylesheet and its dependencies.
2. Identify which pages and components use the affected rules.
3. Decide whether the change belongs in a token, shared component, utility, or page-specific stylesheet.
4. Make the smallest maintainable change.
5. Check for conflicting rules and unnecessary specificity.
6. Test affected pages on mobile and desktop.
7. Check keyboard focus, contrast, and reduced motion where relevant.
8. Run available project checks.
9. Update this README if the architecture changes.
10. Obtain approval before committing or pushing when repository approval is required.

Shared styles can affect many sections. Test education, admissions, document resources, careers, forms, and administrative pages where applicable.

⸻

17. Completion checklist

Before declaring a CSS change complete:

* [ ]	The stylesheet exists at the documented path.
* [ ]	HTML references the correct file.
* [ ]	All referenced CSS imports resolve.
* [ ]	Stylesheets are not loaded twice unintentionally.
* [ ]	Design tokens are used consistently.
* [ ]	No unintended duplicate or conflicting styles are introduced.
* [ ]	Mobile and desktop layouts have been checked.
* [ ]	Keyboard focus remains visible.
* [ ]	Reduced-motion behaviour has been considered.
* [ ]	Text and controls remain readable.
* [ ]	No confidential information is exposed.
* [ ]	Browser errors and missing requests have been checked.
* [ ]	Relevant automated checks pass.
* [ ]	Affected pages have been visually inspected.
* [ ]	Documentation reflects the actual implementation.

⸻

18. Source of truth

When documentation and implementation disagree, use this order:

1. Actual files in the current repository
2. Actual HTML stylesheet references and build configuration
3. Existing design tokens and shared component definitions
4. Tests and validated browser behaviour
5. Project documentation and proposed examples

Do not assume that a stylesheet exists or that a feature is implemented merely because it appears in this guide.

⸻

19. Maintenance

Review this document when:

* The MedOrbits design system changes.
* Colour tokens or typography are updated.
* Shared components are added, removed, or reorganised.
* The CSS directory structure changes.
* A build pipeline is introduced.
* Accessibility requirements or testing practices change.
* Deployment paths or stylesheet-loading behaviour changes.

Maintain one authoritative copy at assets/css/README.md.

⸻

MedOrbits — Education · Admissions · Careers · Recruitment

Website: https://www.medorbits.in/

This guide defines recommended CSS practices. Verify the repository and deployed website before claiming that a stylesheet, design feature, or test is complete.