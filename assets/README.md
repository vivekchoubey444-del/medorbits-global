
# MedOrbits Assets

**Directory:** `assets/`  
**Project:** MedOrbits  
**Purpose:** Shared frontend resources, structured public datasets, visual identity assets, schemas, and approved downloadable documents.  
**Brand identity:** MedOrbits design system, including Royal Burgundy and Champagne Gold where applicable.  
**Maintained by:** MedOrbits

—

## 1. Overview

The `assets/` directory contains reusable frontend resources used throughout the MedOrbits platform, including stylesheets, JavaScript modules, structured JSON datasets, images, icons, fonts, schemas, and downloadable documents.

Assets must remain organized, maintainable, accessible, optimized for production, and consistent with the design system applicable to each page or module.

This directory is intended primarily for public-facing resources. It must not be used as secure storage for credentials, private application records, confidential documents, or other restricted information.

The structure documented here is a reference. Documentation must reflect files and capabilities actually implemented in the repository.

## 2. Directory Structure

```text
assets/
├── README.md
├── css/
├── js/
├── data/
├── images/
├── icons/
├── fonts/
├── documents/
└── schemas/
```

Additional subdirectories may be introduced when they serve a clear purpose and are documented appropriately.

The `schemas/` directory contains reusable JSON Schema definitions. Package-specific schemas may also be maintained alongside individual document libraries.

Verify the actual repository before treating this structure as exhaustive.

## 3. Directory Responsibilities

| Directory | Responsibility |
|—|—|
| `css/` | Global styles, layouts, reusable components, themes, responsive rules, transitions, and animations. |
| `js/` | Application initialization, navigation, forms, search, account interfaces, and shared utilities. |
| `data/` | Structured JSON datasets for education, admissions, careers, and related content. |
| `images/` | Brand imagery, logos, hero images, illustrations, backgrounds, and placeholders. |
| `icons/` | Education, career, interface, and social media icons. |
| `fonts/` | Approved locally hosted fonts and licensing documentation. |
| `documents/` | Publicly downloadable brochures, guides, checklists, and approved educational resources. |
| `schemas/` | Shared and specialized JSON Schema definitions. |

Each asset must have a clear purpose and belong in the most appropriate directory.

## 4. Design System and Branding

All visual assets must preserve the established MedOrbits design identity.

Requirements:

- Maintain the applicable premium colour palette for each MedOrbits section.
- Use consistent typography, spacing, border radii, shadows, and component states.
- Reuse shared styles and components rather than introducing unnecessary duplicates.
- Preserve established headers, footers, navigation, transitions, and opening animations when updating individual pages.
- Maintain readable contrast across tinted backgrounds, gradients, overlays, and interactive components.
- Avoid pure-white or transparent sections where the applicable page design requires a visible tinted background.
- Keep animations purposeful and respect reduced-motion preferences.
- Avoid applying one colour palette indiscriminately across unrelated sections.

For applicable premium MedOrbits designs, use the Royal Burgundy and Champagne Gold visual direction. Follow the relevant page or module specification where another approved palette applies.

## 5. CSS Guidelines

Stylesheets in `assets/css/` should follow a consistent, maintainable structure.

- Prefer shared design tokens and reusable component styles.
- Scope page-specific styles to avoid unintended effects on unrelated pages.
- Support mobile, tablet, laptop, and desktop layouts.
- Avoid conflicting overrides, duplicated selectors, and unnecessary `!important` declarations.
- Preserve existing component behaviour when updating shared styles.
- Ensure visible keyboard focus, hover states, disabled states, and form-validation states.
- Use efficient transitions and animations without compromising usability.
- Respect reduced-motion preferences.
- Avoid unnecessary layout shifts and expensive rendering effects.

Before introducing a stylesheet, check whether an existing shared stylesheet already provides the required component or utility.

## 6. JavaScript Guidelines

JavaScript assets must remain modular, predictable, and compatible with the application’s configured runtime.

- Keep reusable functionality in shared modules where appropriate.
- Separate interface behaviour from validation and server-side business logic.
- Validate data received from APIs, forms, URL parameters, and other untrusted sources.
- Prefer safe DOM APIs and avoid inserting untrusted content through `innerHTML`.
- Handle failed requests, missing elements, and invalid data gracefully.
- Prevent duplicate event listeners, unnecessary global variables, and blocking operations.
- Do not expose private credentials or server-side authorization logic in browser code.
- Test interactions on the pages that consume the affected module.
- Clean up event listeners and resources when components are removed or reinitialized, where applicable.

Frontend authentication interfaces are not a substitute for server-side authentication, authorization, session validation, or access control.

## 7. Structured JSON Data

The `assets/data/` directory stores structured datasets consumed by the MedOrbits frontend and other approved application components.

Examples include:

- Courses and entrance examinations.
- Colleges and universities.
- Countries and locations.
- Admissions and admission processes.
- Fees and hostels.
- Scholarships and required documents.
- Career options and sectors.
- Jobs, internships, and recruitment.
- Services, FAQs, news, notifications, and testimonials.

### Data quality requirements

1. Keep JSON syntax valid and encoding consistent.
2. Follow the established schema and naming conventions for each dataset.
3. Use stable, unique identifiers for records.
4. Keep cross-file references consistent.
5. Represent unknown values explicitly rather than inventing data.
6. Use consistent date formats and time-zone conventions where applicable.
7. Include verified claims and distinguish illustrative content from confirmed information.
8. Never store passwords, API secrets, private contact details, confidential application records, or other sensitive information in public datasets.
9. Keep dataset metadata and documentation synchronized with the implemented structure.
10. Validate important business rules separately from basic JSON syntax.

### Validation commands

The following commands are examples of intended project checks:

```bash
npm run check:json
npm run check:data
```

Run them only after confirming that the corresponding scripts exist and are correctly configured in `package.json`.

The JSON syntax validator checks JSON validity. The application-data validator checks structural and consistency rules implemented by the project.

A successful syntax check does not establish factual accuracy or complete schema compliance.

## 8. JSON Schema Management

The `assets/schemas/` directory contains reusable JSON Schema definitions.

Schemas may validate:

- Shared document-manifest structures.
- Package-specific document manifests.
- Resource catalogues.
- Course and education datasets.
- Other structured application data where required.

### Schema requirements

- Declare the intended JSON Schema draft.
- Use stable and unique `$id` values.
- Use `$ref` for reusable definitions where appropriate.
- Define required fields and permitted values according to the actual data contract.
- Configure `additionalProperties` deliberately.
- Keep schema references valid.
- Maintain representative valid and invalid test cases.
- Update affected datasets and consumers when schemas change.

The shared MedOrbits document-manifest schema may support standard manifests using metadata and resources, as well as specialized manifests using package-level fields and documents, where the selected schema permits those structures.

Package-specific schemas may impose stricter rules. Do not assume all document libraries use identical field names or publication policies.

### Schema limitations

JSON Schema can validate structure and supported value constraints. It cannot independently confirm:

- Whether a referenced file exists.
- Whether a source URL is authoritative or current.
- Whether a document has actually been reviewed.
- Whether a checksum matches a real file.
- Whether a published document contains confidential information.
- Whether a resource is safe to distribute publicly.

Implement filesystem, cross-reference, verification, and publication checks in repository scripts, tests, or CI workflows.

## 9. Images, Icons, and Fonts

### Images

- Prefer optimized JPG or AVIF images when supported by the delivery pipeline.
- Provide appropriate dimensions and responsive variants where beneficial.
- Use meaningful alternative text for informative images.
- Use empty alternative text for purely decorative images.
- Avoid unnecessarily large hero images and oversized assets.
- Confirm that licensing and usage rights permit publication.
- Provide appropriate dimensions or aspect ratios to reduce layout shifts.

### Icons

- Use a consistent icon style and sizing system.
- Prefer existing approved icons before introducing additional libraries or duplicate assets.
- Ensure icons used as controls have accessible names.
- Do not rely on colour alone to communicate status or meaning.
- Avoid decorative icons that interfere with accessible labels.

### Fonts

- Use approved font families and sensible fallback stacks.
- Load only the weights and formats required by the interface.
- Use appropriate `font-display` behaviour to reduce invisible text during loading.
- Include licensing information for locally hosted font files.
- Confirm readability across supported screen sizes.

## 10. Public Documents and Downloads

The `assets/documents/` directory is intended for approved public resources, including brochures, educational guides, career checklists, and downloadable reference material.

Before publishing a document:

- Confirm that it is approved for public distribution.
- Remove private information, internal notes, and confidential metadata.
- Verify accuracy, readability, and accessibility.
- Use descriptive filenames and provide an appropriate title and description.
- Confirm that links resolve correctly and point to the intended version.
- Update the relevant manifest and README.
- Validate publication metadata and required source references.
- Confirm that the deployed download URL resolves to the approved file.

### Publication policy

Only documents that have passed the required publication checks should be exposed as active public downloads.

A manifest entry marked as published is not sufficient by itself. The application must also enforce file-existence, approval, privacy, and other applicable publication checks.

Do not store private student applications, identity documents, financial records, confidential admission files, or other restricted materials in publicly accessible asset directories.

Private documents must be stored in appropriately secured storage and delivered through authorized, access-controlled application endpoints.

## 11. Security Requirements

- Never include API keys, passwords, private tokens, session secrets, or database credentials in public assets.
- Treat client-provided and externally sourced data as untrusted.
- Validate and encode untrusted values before rendering them.
- Enforce authorization and access control on the server.
- Do not rely on hidden buttons, frontend route checks, or JavaScript conditions to protect sensitive operations.
- Avoid exposing internal configuration, private records, or unnecessary personal information in JSON files.
- Publish only approved documents and assets.
- Maintain dependency versions and security checks through established project tooling.
- Review third-party asset licensing and provenance before distribution.
- Avoid exposing sensitive details through filenames, source maps, logs, or public error messages.

Public frontend assets must be assumed accessible to anyone who can reach the deployed website.

## 12. Performance and Accessibility

### Performance

- Optimize image dimensions, compression, and delivery formats.
- Avoid duplicate CSS and JavaScript bundles.
- Load noncritical resources only when needed.
- Configure appropriate cache headers through hosting or server configuration.
- Prefer lazy loading for suitable below-the-fold images.
- Avoid unnecessary animation, layout shifts, and render-blocking resources.
- Measure performance changes on representative pages before deployment.
- Ensure cache invalidation or versioning works when important public assets change.

### Accessibility

- Use semantic HTML in consuming pages.
- Maintain sufficient text and interface contrast.
- Support keyboard navigation and visible focus.
- Respect `prefers-reduced-motion`.
- Provide accessible names and labels for interactive controls.
- Associate form errors with their corresponding fields.
- Ensure responsive layouts remain usable at enlarged text sizes.
- Provide useful alternative text for informative images.
- Make downloadable documents accessible where reasonably practicable.

## 13. Naming and File Organization

Use descriptive, consistent, lowercase filenames.

- Use hyphens to separate words in filenames.
- Choose names that describe an asset’s purpose.
- Keep related resources together.
- Avoid ambiguous names such as `new.css`, `final2.js`, or `image1.png`.
- Avoid unnecessary duplicate files and obsolete versions.
- Update references whenever an asset is moved or renamed.
- Keep naming consistent with manifests and data references.

Use paths compatible with the deployment configuration. Root-relative URLs are appropriate when the website is hosted at the domain root. Deployments under a subpath may require a configured base path.

## 14. Validation and Testing

Before submitting asset changes, run applicable checks:

```bash
npm run check:json
npm run check:data
npm run lint:check
npm run format:check
npm test
```

Run these commands only if the corresponding scripts and test suites exist and are correctly configured in `package.json`.

Also verify the affected pages in a browser.

Check for:

- Broken images, stylesheets, scripts, and document links.
- Missing fonts or icon resources.
- Incorrect JSON references.
- Schema validation failures.
- Console errors and failed network requests.
- Responsive layout problems.
- Keyboard and reduced-motion behaviour.
- Unexpected effects on shared components.
- Public exposure of sensitive data.
- Missing or incorrect publication files.
- Licensing or attribution issues where applicable.

A passing test suite confirms only the checks implemented by that suite. It does not establish that all assets, documents, or external claims have been independently verified.

## 15. Maintenance and Change Management

When adding, removing, or reorganizing assets:

1. Update affected files and references.
2. Update the relevant directory-level README.
3. Validate JSON datasets and application-specific data rules.
4. Validate affected schemas and their consumers.
5. Test pages that depend on changed shared resources.
6. Review security, licensing, accessibility, and performance implications.
7. Confirm that applicable CI checks pass before merging.
8. Verify deployed URLs when public assets change.

Remove obsolete assets only after verifying that no pages, scripts, stylesheets, tests, or build processes depend on them.

Preserve stable identifiers and URLs where practical. When a public URL must change, update affected references and consider redirects if the hosting architecture supports them.

## 16. Scope and Limitations

This directory documents frontend resources, structured public datasets, shared schemas, and approved public downloads. It does not replace:

- Server-side application logic.
- Secure database storage.
- Private document storage.
- Environment configuration and secrets management.
- Server-side validation and authorization.
- Backend API documentation.
- Legal review, factual verification, or publication approval.

The actual contents and capabilities of each subdirectory depend on the files implemented in the repository.

—

**Maintained by:** MedOrbits  
**Directory:** `assets/`  
**Purpose:** Shared frontend resources, structured public datasets, schemas, and approved downloadable documents  
**Design identity:** MedOrbits design system, including Royal Burgundy and Champagne Gold where applicable

**Maintenance note:** Keep this README synchronized with the actual `assets/` directory. Documented directories and capabilities must reflect implemented functionality rather than planned or unverified features.
