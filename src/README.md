MedOrbits — Source Directory Documentation

Directory: /src/

MedOrbits source code is organized into modular frontend components that support education resources, medical admissions, application management, official documents, career services, recruitment, and customer support.

This document defines the intended organization, integration boundaries, development standards, and release requirements for the source directory.

Architecture note: The directory tree below is a reference structure. Preserve existing repository paths and filenames unless a deliberate migration is planned.

⸻

1. Source Directory Structure

src/
├── README.md
├── js/
│   ├── README.md
│   ├── main.js
│   ├── bootstrap.js
│   ├── config/
│   ├── utils/
│   │   ├── contants.js
│   │   ├── formatters.js
│   │   ├── validators.js
│   │   └── README.md
│   ├── services/
│   │   ├── api.services.js
│   │   ├── auth.services.js
│   │   ├── application.services.js
│   │   ├── document.services.js
│   │   └── README.md
│   ├── security/
│   │   ├── input-validation.js
│   │   └── safe-errors.js
│   ├── components/
│   ├── modules/
│   ├── pages/
│   ├── state/
│   ├── accessibility/
│   └── analytics/
├── css/
│   ├── README.md
│   ├── base.css
│   ├── tokens.css
│   ├── layout.css
│   ├── components/
│   ├── pages/
│   └── utilities.css
├── assets/
│   ├── images/
│   ├── icons/
│   ├── fonts/
│   └── media/
├── data/
│   ├── README.md
│   ├── courses.json
│   ├── colleges.json
│   ├── universities.json
│   ├── scholarships.json
│   ├── fees.json
│   ├── entrance-exams.json
│   ├── documents.json
│   ├── career-options.json
│   ├── jobs.json
│   ├── faqs.json
│   ├── services.json
│   └── notifications.json
└── templates/
    ├── components/
    ├── emails/
    └── documents/

Create directories and files only when required. If assets or data already live outside /src/, preserve their existing locations and document the actual paths.

2. Architectural Boundaries

Layer	Responsibility
JavaScript	Client-side interactions and application workflows
CSS	Design tokens, responsive layouts, and visual styling
Assets	Images, icons, fonts, and static media
Data	Public structured content used by frontend features
Templates	Reusable presentation and document templates

Server-side authorization, database access, private configuration, and authoritative validation belong in the backend—not in browser-delivered source files.

3. JavaScript

Path: /src/js/

JavaScript modules provide application initialization, reusable UI components, validation, API services, and feature-specific behavior.

Responsibilities include:

* Authentication and account interactions.
* Education and admission workflows.
* Application creation and status tracking.
* Official document listings, uploads, and downloads.
* Career and recruitment features.
* Support and notification interactions.
* Accessible loading, success, and error states.

Use ES modules, explicit imports, and clear module boundaries.

Documentation: /src/js/README.md

Shared utilities

The /src/js/utils/ directory contains reusable constants, formatters, and validators.

Filename note: contants.js is retained above to reflect the supplied reference tree. For a new implementation, prefer the correctly spelled constants.js. Do not rename an existing file until its imports and dependencies have been checked.

API services

The /src/js/services/ directory centralizes backend communication and domain-specific API operations.

Security helpers

The /src/js/security/ directory contains frontend validation and safe-error utilities. These improve usability but do not replace backend security controls.

4. CSS and Design System

Path: /src/css/

Organize styles into reusable layers:

* Design tokens: Colors, typography, spacing, radii, shadows, and animation timing.
* Base styles: Global resets, body styles, typography, and accessibility defaults.
* Layout styles: Containers, grids, navigation, and responsive page structure.
* Component styles: Buttons, cards, forms, modals, and notifications.
* Page styles: Styles specific to individual pages.
* Utilities: Small, reusable layout and display helpers.

MedOrbits visual standards

* Use the established premium midnight-sapphire visual identity.
* Maintain strong contrast between text and backgrounds.
* Avoid pure-white sections where the established design system requires tinted or dark surfaces.
* Support mobile, tablet, and desktop screens.
* Respect prefers-reduced-motion.
* Provide visible focus indicators and accessible interaction states.
* Prevent horizontal overflow and unintended text clipping.
* Centralize design tokens rather than duplicating color values across stylesheets.

5. Static Assets

Path: /src/assets/

Use descriptive, consistent filenames for images, icons, fonts, and media.

Recommended practices:

* Prefer optimized image formats such as WebP or AVIF where supported.
* Include appropriate alternative text for meaningful images.
* Use empty alternative text for purely decorative images.
* Avoid embedding large media files directly in JavaScript.
* Use appropriately licensed assets.
* Never store private user documents or server secrets in public asset directories.
* Verify paths and filename casing before deployment.

Public assets must not contain confidential application data.

6. Structured Data

Path: /src/data/

Structured JSON can provide public educational content, course information, examination resources, career options, FAQs, and catalogue data.

Example:

{
  “id”: “course-example-001”,
  “title”: “Bachelor of Medicine and Bachelor of Surgery”,
  “shortName”: “MBBS”,
  “category”: “medical”,
  “status”: “published”
}

This example illustrates a possible data shape; it is not an authoritative course record.

Data requirements

* Keep JSON syntactically valid.
* Use consistent identifiers and property names.
* Document required and optional fields.
* Validate records before publishing.
* Avoid duplicate identifiers.
* Use authoritative sources for official admission requirements, deadlines, fees, and eligibility.
* Include source and verification metadata for information that changes over time.

Never place credentials, private student records, payment details, or confidential documents in client-accessible data files.

Documentation: /src/data/README.md

7. Templates

Path: /src/templates/

Templates may provide reusable structures for:

* Shared interface elements.
* Transactional emails.
* Application confirmations.
* Document layouts.
* Notifications and printable summaries.

Escape untrusted values in templates and never expose private information to unauthorized recipients.

For email templates, verify that links, sender identities, and user-specific values are generated by trusted application logic.

8. Frontend–Backend Integration

Keep frontend source synchronized with the actual backend implementation.

Before integrating a feature, verify:

1. The backend route exists.
2. The HTTP method and URL match.
3. Request and response payloads match the defined schemas.
4. Authentication and authorization requirements are documented.
5. Error codes and response formats are consistent.
6. Upload limits and accepted file types match server configuration.
7. Relevant endpoints are documented in /api/openapi.yaml, where applicable.
8. Integration tests cover successful and unsuccessful requests.

A frontend service method does not prove that its corresponding backend endpoint exists.

9. Security Standards

All source code must follow these requirements:

* Never expose server secrets in browser-delivered files.
* Never rely on client-side role checks for authorization.
* Validate and authorize requests on the backend.
* Use secure authentication and session-management practices.
* Protect cookie-authenticated state-changing requests against CSRF where applicable.
* Avoid unsafe HTML injection.
* Validate uploaded file content on the server.
* Restrict access to private application and identity documents.
* Apply appropriate rate limits to sensitive operations.
* Avoid logging passwords, tokens, payment details, or private document contents.
* Use HTTPS in production.
* Apply appropriate retention and privacy policies to personal data.

Security controls must remain effective even when the frontend is bypassed.

10. Accessibility and Responsive Design

All interactive features should support:

* Keyboard navigation.
* Visible focus states.
* Semantic HTML.
* Accessible form labels.
* Screen-reader announcements for meaningful updates.
* Proper focus management in dialogs.
* Sufficient text and interface contrast.
* Reduced-motion preferences.
* Responsive layouts across supported viewport sizes.

Do not rely on color alone to communicate errors, selection, or status.

11. Performance and Maintainability

* Load only the scripts required by each page.
* Avoid duplicate event listeners and unnecessary DOM updates.
* Use pagination for large result sets.
* Debounce expensive search operations.
* Cancel obsolete network requests where practical.
* Optimize image sizes and font loading.
* Avoid blocking rendering with unnecessary scripts.
* Use caching only when compatible with data freshness and privacy requirements.
* Keep functions small and module interfaces explicit.
* Remove obsolete code only after verifying its dependencies.

12. Testing Strategy

Functional tests

* Navigation and page initialization.
* Form validation and submission.
* Search and pagination.
* Authentication workflows.
* Application creation and status tracking.
* Document upload and download.
* Support and notification interactions.

Integration tests

* Frontend service and backend route compatibility.
* Request and response schema compliance.
* Session handling and authorization.
* Error handling and timeout behavior.
* File upload and download behavior.

Quality and security checks

* JavaScript syntax and module import checks.
* JSON validation.
* CSS and responsive-layout checks.
* Accessibility testing.
* Dependency vulnerability checks.
* Authorization and document-access tests.
* Production asset-path verification.

Report tests as passing only after they have actually been executed.

13. Deployment Checklist

Before deploying a release:

* [ ]	Required source files exist at their expected paths.
* [ ]	JavaScript imports and exports resolve.
* [ ]	JSON data files parse correctly.
* [ ]	CSS and assets load successfully.
* [ ]	API paths match the deployed backend.
* [ ]	No secrets are included in public bundles.
* [ ]	Authentication and authorization are verified.
* [ ]	Sensitive document access is restricted.
* [ ]	Mobile and desktop layouts are checked.
* [ ]	Accessibility and reduced-motion behavior are checked.
* [ ]	Production errors do not expose internal implementation details.
* [ ]	Relevant unit and integration tests have been executed.
* [ ]	Documentation reflects the implemented architecture.

14. Documentation and Maintenance

Keep documentation close to the code it describes.

Documentation	Purpose
/src/README.md	Source architecture and shared development standards
/src/js/README.md	JavaScript modules, services, and client-side conventions
/src/js/utils/README.md	Constants, formatting, and validation utilities
/src/js/services/README.md	API services and domain workflows
/src/data/README.md	Structured data formats and source-verification rules
/api/README.md	Backend architecture and API integration
/api/openapi.yaml	Documented API contract, where maintained

Update relevant documentation whenever module responsibilities, public interfaces, data schemas, or integration contracts change.

15. Final Principle

The /src/ directory should provide a consistent, modular, accessible, and maintainable foundation for MedOrbits.

Source of truth: The actual repository structure, implemented modules, backend routes, data schemas, and deployment configuration. This document describes intended architecture and does not imply that every recommended directory or file already exists.