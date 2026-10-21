MedOrbits CSS Architecture

Directory: /assets/css/
Purpose: Shared styling system for MedOrbits pages, authentication, education, career services, dashboards, administration, accessibility, and responsive layouts.

1. Directory structure

assets/
└── css/
    ├── README.md
    ├── accessibility.css
    ├── admin.css
    ├── animations.css
    ├── auth.css
    ├── career.css
    ├── components.css
    ├── dashboard.css
    ├── education.css
    ├── fonts.css
    ├── forms.css
    ├── layout.css
    ├── print.css
    ├── reset.css
    ├── responsive.css
    ├── style.css
    ├── typography.css
    ├── universities-directory.css
    └── variables.css

This inventory reflects the filenames visible in the working-copy screenshots. Confirm any additional files before adding them to the documented structure.

2. Stylesheet responsibilities

File	Responsibility
variables.css	Shared design tokens, colors, spacing, typography variables, shadows, and radii.
reset.css	Consistent browser defaults, box sizing, base elements, and control normalization.
fonts.css	Font-face declarations and local font loading.
typography.css	Heading hierarchy, body text, links, text utilities, and readable line lengths.
style.css	General or legacy styles. Review before using it as the main stylesheet.
components.css	Reusable buttons, cards, badges, tags, visual labels, tool panels, and shared UI components.
layout.css	Header, navigation, page containers, footer, and primary layout structures.
forms.css	Inputs, labels, selects, textareas, validation states, search forms, and form actions.
education.css	Education landing pages, course sections, education cards, FAQs, and related content.
career.css	Career listings, career cards, metadata, tags, and career-related UI.
auth.css	Login, registration, password recovery, OTP, and authentication page styling.
dashboard.css	User dashboard, dashboard navigation, statistics, panels, and data displays.
admin.css	Administrative layouts, management tables, status indicators, and admin navigation.
animations.css	Intro screen, entrance effects, keyframes, transitions, and reusable animations.
accessibility.css	Skip links, visually hidden content, focus indicators, reduced-motion support, and accessibility utilities.
responsive.css	Breakpoints, mobile navigation layouts, responsive grids, and small-screen adjustments.
print.css	Print-specific colors, visibility rules, page breaks, and printable layouts.
universities-directory.css	University directory filters, listings, metadata, pagination, and empty states.

3. Recommended stylesheet loading order

Load shared foundations before component and page-specific styles. Load responsive overrides after the styles they modify, and print rules last.

@import url(“./variables.css”);
@import url(“./reset.css”);
@import url(“./fonts.css”);
@import url(“./typography.css”);
@import url(“./components.css”);
@import url(“./layout.css”);
@import url(“./forms.css”);
@import url(“./education.css”);
@import url(“./universities-directory.css”);
@import url(“./career.css”);
@import url(“./auth.css”);
@import url(“./dashboard.css”);
@import url(“./admin.css”);
@import url(“./animations.css”);
@import url(“./accessibility.css”);
@import url(“./responsive.css”);
@import url(“./print.css”);

Important: This is the recommended order, not a verified copy of the current master.css. Use it only if all referenced files exist and the project is configured to use this import-based architecture. Avoid loading the same stylesheet through both master.css and individual HTML pages.

4. Design system conventions

Shared design tokens

Use the existing CSS custom properties in variables.css wherever possible.

.example-card {
  color: var(—text, #f5f0e8);
  background: var(—panel, #211d29);
  border: 1px solid var(—border, #494151);
  border-radius: var(—radius-md, 12px);
  padding: var(—space-4, 16px);
}

The fallback values above are examples. Keep them consistent with the actual tokens defined by the project.

Responsive design

* Use flexible grids and layouts instead of fixed page widths.
* Prevent long URLs, labels, and user-generated text from overflowing containers.
* Keep forms, navigation, tables, and cards usable on mobile screens.
* Put wide tables inside horizontally scrollable wrappers.
* Avoid introducing breakpoints that conflict with responsive.css.

Accessibility

* Maintain visible keyboard focus indicators.
* Keep text and controls sufficiently contrasted against their backgrounds.
* Respect prefers-reduced-motion.
* Use semantic HTML and accessible names for controls.
* Do not rely on color alone to communicate errors or status.
* Ensure hidden dialogs and panels are also handled correctly by JavaScript.

Animation

Use animations.css for the intro screen and reusable motion effects. Preserve existing selectors and animation names when updating styles that are referenced by HTML or JavaScript.

Keep motion restrained, avoid unnecessary continuous animation, and provide reduced-motion alternatives.

Forms and authentication

CSS controls appearance only. Authentication, OTP delivery, password validation, session management, rate limiting, authorization, and server-side validation must be implemented separately.

Dashboards and administration

CSS must not be treated as an access-control mechanism. Enforce user roles, permissions, record ownership, and administrative actions on the server.

5. Maintenance rules

1. Keep shared design tokens in one authoritative file.
2. Avoid duplicating global resets or loading competing typography definitions.
3. Prefer reusable classes over page-specific overrides.
4. Keep page-specific styles in their relevant modules.
5. Check that imported filenames match the actual filesystem, including capitalization.
6. Preserve existing class names and IDs unless corresponding HTML and JavaScript are updated.
7. Test desktop, tablet, mobile, keyboard navigation, reduced-motion preferences, and print output after major changes.
8. Remove obsolete CSS only after confirming that no page or script depends on it.
9. Keep this README synchronized with the actual stylesheet inventory and import order.

6. Integration checklist

* [ ]	Confirm variables.css contains the tokens used by the other stylesheets.
* [ ]	Confirm fonts.css points to valid font assets.
* [ ]	Confirm the main stylesheet imports each required module only once.
* [ ]	Confirm animations.css is the canonical animation filename.
* [ ]	Confirm universities-directory.css matches the actual filename.
* [ ]	Confirm style.css is not unintentionally overriding the shared design system.
* [ ]	Confirm responsive and accessibility styles are loaded.
* [ ]	Check for missing imports and obsolete references to renamed files.

Source of truth: The actual files in /assets/css/ and the stylesheet entry point used by the application. This README documents the intended architecture; it does not claim that imports, assets, or runtime behavior have been tested.