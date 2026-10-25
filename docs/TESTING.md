MedOrbits Testing Guide

Document: docs/TESTING.md
Project: MedOrbits
Purpose: Define testing standards, test organisation, execution procedures, quality gates, and release verification.

⸻

1. Objectives

The MedOrbits testing strategy aims to:

* Verify that core website pages and navigation work correctly.
* Prevent regressions in responsive layouts and interactive components.
* Validate public JSON datasets and their relationships.
* Test backend routes, authentication, authorisation, and data validation.
* Verify application submissions, document handling, support tickets, and payment workflows where implemented.
* Identify accessibility, performance, privacy, and security defects.
* Ensure production deployments pass critical smoke tests.
* Provide reproducible evidence that changes work as intended.

Testing should be proportionate to the risk and impact of each change. Admission deadlines, application submissions, payments, personal documents, authentication, and administrative operations require particular care.

2. Testing Principles

1. Test observable behaviour: Verify what users and systems can actually do.
2. Automate repeatable checks: Run linting, syntax checks, dataset validation, and automated tests in development and CI.
3. Isolate environments: Never use production data for routine automated tests.
4. Use realistic test cases: Include valid, invalid, missing, boundary, and unexpected inputs.
5. Protect sensitive information: Use synthetic accounts and documents; redact logs and screenshots.
6. Reproduce defects: Document steps, expected behaviour, actual behaviour, and relevant environment details.
7. Test failure paths: Cover network errors, timeouts, duplicate requests, unavailable dependencies, and partial failures.
8. Verify the actual implementation: Do not treat proposed APIs, schemas, or UI features as implemented until confirmed in the repository.
9. Make releases traceable: Record the tested commit, environment, test results, and unresolved risks.

3. Testing Scope

Test area	Main purpose
Static analysis	Detect syntax errors and common code defects
Unit tests	Verify isolated functions and modules
Integration tests	Verify interactions between modules and services
API tests	Validate HTTP contracts, authentication, validation, and error handling
Data tests	Check JSON structure, required fields, IDs, URLs, and references
UI tests	Verify navigation, forms, interactions, and responsive behaviour
Accessibility tests	Check keyboard operation, labels, contrast, and semantic structure
Security tests	Test access control, input handling, upload restrictions, and abuse resistance
Performance tests	Identify slow routes, oversized assets, and rendering bottlenecks
End-to-end tests	Verify critical user journeys across the application
Regression tests	Prevent previously fixed issues from returning
Deployment smoke tests	Verify that a deployed release starts and serves critical features

Not every category requires a separate framework. Choose tools compatible with the actual project structure and existing dependencies.

4. Repository and Test Organisation

A possible test layout is:

MedOrbits/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── e2e/
│   ├── accessibility/
│   ├── security/
│   ├── fixtures/
│   └── helpers/
├── assets/
│   ├── data/
│   ├── js/
│   └── css/
├── pages/
├── support/
├── server.js
├── package.json
└── docs/
    └── TESTING.md

Adapt this structure to the existing repository. Do not move application files solely to match this example.

Naming conventions

Use descriptive filenames that identify the feature and behaviour being tested.

Examples:

tests/unit/formatters.test.js
tests/unit/official-documents.test.js
tests/api/auth.test.js
tests/api/applications.test.js
tests/api/support.test.js
tests/integration/database.test.js
tests/e2e/critical-user-journeys.spec.js

These filenames are examples, not a statement that these test files already exist.

5. Test Environments

Maintain separate environments for local development, automated testing, staging, and production.

Environment	Purpose	Data policy
Local	Development and debugging	Synthetic data
Test	Repeatable automated checks	Disposable test records
Staging	Release verification and integration checks	Synthetic or properly anonymised data
Production	Live service	Real user data; no destructive test operations

Environment requirements

* Use environment variables for credentials and service configuration.
* Keep test database credentials separate from production credentials.
* Use dedicated test accounts and payment-provider sandbox credentials.
* Avoid production email, payment, or document operations during automated tests.
* Reset test fixtures safely between test runs.
* Ensure test cleanup cannot target production resources.
* Do not commit secrets, personal documents, or production database exports.

If the application supports multiple database engines, run tests against each supported engine and version. Otherwise, test against the database actually used by the application.

6. JavaScript and Static Checks

Run syntax checks and linting before executing higher-level tests.

Suggested checks

For Node.js JavaScript files:

node —check server.js

Run syntax checks on other critical JavaScript files as appropriate:

node —check assets/js/official-documents.js

The paths above are examples; use the actual locations in the repository.

If the project has configured linting, use its existing script:

npm run lint

If configured:

npm run typecheck

Do not add scripts to package.json without checking the existing scripts, dependencies, and project conventions first.

Static review checklist

* [ ]	No syntax errors in modified JavaScript.
* [ ]	No accidental debug output or sensitive values in logs.
* [ ]	No hardcoded credentials or production-only configuration.
* [ ]	No unsafe HTML injection or untrusted dynamic script execution.
* [ ]	Event listeners and asynchronous operations handle failures appropriately.
* [ ]	Timers, observers, and listeners are cleaned up when necessary.
* [ ]	API calls handle non-success responses and network failures.
* [ ]	DOM selectors handle missing elements where the module may run on multiple pages.

7. Unit Testing

Unit tests should verify isolated functions, utilities, and modules without requiring production infrastructure.

Examples of suitable targets include:

* Formatting and validation helpers.
* URL and query-string utilities.
* Data filtering and sorting functions.
* JSON transformation functions.
* Form validation.
* Document metadata validation.
* Error normalisation.
* Permission checks.
* Notification formatting.
* Status transition rules.

Example using Node.js’s built-in test runner

This example illustrates a small isolated test. Adapt the import path to an existing project function.

import test from “node:test”;
import assert from “node:assert/strict”;
function isNonEmptyString(value) {
  return typeof value === “string” && value.trim().length > 0;
}
test(“accepts a non-empty string”, () => {
  assert.equal(isNonEmptyString(“MedOrbits”), true);
});
test(“rejects an empty or whitespace-only string”, () => {
  assert.equal(isNonEmptyString(“”), false);
  assert.equal(isNonEmptyString(“   “), false);
});
test(“rejects non-string values”, () => {
  assert.equal(isNonEmptyString(null), false);
  assert.equal(isNonEmptyString(123), false);
});

The example function is self-contained and is not intended to replace an existing production validator.

Unit test cases

For each important function, consider:

* Normal valid input.
* Empty and missing input.
* Null values and unexpected types.
* Boundary values.
* Invalid formats.
* Unicode and non-English text.
* Duplicate values.
* Large but permitted inputs.
* Errors from dependencies.
* Security-sensitive input.

Tests should assert meaningful outcomes rather than implementation details that may change during refactoring.

8. JSON Dataset Validation

MedOrbits may use public JSON datasets for courses, institutions, fees, scholarships, official documents, jobs, news, services, and other resources.

Validate every dataset that is intended to be consumed by the website or API.

Validation checklist

* [ ]	The file parses as valid JSON.
* [ ]	The root value matches the expected object or array.
* [ ]	Required properties exist.
* [ ]	Field types are consistent.
* [ ]	Record identifiers are unique.
* [ ]	Required arrays and objects have the correct structure.
* [ ]	Internal references resolve to existing records.
* [ ]	URLs use permitted schemes and expected destinations.
* [ ]	Dates use the documented format.
* [ ]	Status fields use an agreed set of values.
* [ ]	Empty or unavailable values follow a consistent convention.
* [ ]	No credentials, private user data, or internal secrets are included.
* [ ]	Educational and admission information has appropriate provenance and review metadata.

Example: Validate JSON syntax

Run the following command from the repository root for an individual dataset:

node -e “JSON.parse(require(‘node:fs’).readFileSync(‘assets/data/courses.json’, ‘utf8’)); console.log(‘Valid JSON’)”

Replace the path with the actual dataset location.

This checks syntax only. It does not verify schema compliance, record uniqueness, URL safety, or factual accuracy.

Dataset integrity

Where datasets reference each other, validate the relationships. For example, an application workflow that references a course should not point to a nonexistent course record.

Do not silently delete invalid records during validation. Report the failing record and correct the source data through the appropriate review process.

For official educational information, follow docs/DATA_VERIFICATION.md.

9. Frontend and UI Testing

Test important pages on supported mobile and desktop viewport sizes.

Page rendering

* [ ]	Every intended route loads correctly.
* [ ]	Page titles and descriptions are appropriate.
* [ ]	Fonts, images, icons, CSS, and JavaScript assets load.
* [ ]	No unintended horizontal overflow occurs.
* [ ]	Cards, grids, navigation, and footers fit supported viewports.
* [ ]	Long headings and URLs wrap without breaking the layout.
* [ ]	Empty, loading, success, and error states render correctly.
* [ ]	Missing optional content does not break the page.
* [ ]	Reduced-motion preferences are respected where animations are present.

Interactions

* [ ]	Buttons perform their advertised actions.
* [ ]	Links point to the intended destinations.
* [ ]	Forms validate required fields.
* [ ]	Invalid forms explain how to correct errors.
* [ ]	Search and filters behave consistently.
* [ ]	Pagination or lazy loading works where implemented.
* [ ]	Dialogs, menus, accordions, and carousels can be operated.
* [ ]	Double-clicking or repeated submissions do not cause unintended duplicate operations.
* [ ]	API failures display useful, non-sensitive feedback.

Responsive test matrix

Test representative viewport sizes rather than relying on a single device.

Profile	Example viewport	Focus
Small mobile	320 × 568	Narrow layout, text wrapping, overflow
Typical mobile	390 × 844	Touch targets, card layout, navigation
Large mobile	430 × 932	Spacing, image scaling, form layout
Tablet	768 × 1024	Grid transitions and navigation
Laptop	1366 × 768	Main content and sidebar behaviour
Desktop	1920 × 1080	Maximum content width and visual balance

These are representative test viewports, not a guarantee that all devices have these exact dimensions.

10. API Testing

Test API behaviour using the actual routes and contracts implemented by the backend. Refer to docs/API_REFERENCE.md, while distinguishing documented proposals from active routes.

For each endpoint, test:

* Correct HTTP method and path.
* Valid request payloads.
* Missing, malformed, and unexpected fields.
* Correct success status and response structure.
* Authentication requirements.
* Authorisation and ownership enforcement.
* Invalid identifiers and nonexistent records.
* Pagination, filtering, and sorting limits.
* Rate limiting where configured.
* Consistent error responses.
* Database failures and external-service timeouts.
* Duplicate or concurrent requests where relevant.
* Appropriate cache and security headers.

Example API test scenarios

Area	Test	Expected outcome
Health	Request configured health endpoint	Documented healthy response
Authentication	Submit invalid credentials	Generic failure without secret disclosure
Authorisation	Access another user’s protected resource	Denied unless explicitly permitted
Validation	Submit malformed JSON or invalid fields	Controlled client error
Applications	Submit valid application data	Correct record and response, if implemented
Documents	Request an unauthorised document	Access denied
Support	Submit an invalid ticket	Validation error without unintended record creation
Payments	Send an invalid payment status update	Rejected; no unverified payment transition
Rate limiting	Exceed configured request threshold	Appropriate rate-limit response
Missing record	Request an unknown resource	Consistent not-found response

Never treat an HTTP success status as proof that a payment, application, or document operation is correct. Verify the underlying state transition.

11. Authentication and Authorisation Testing

Test access control independently from UI visibility.

* [ ]	Protected endpoints reject unauthenticated requests.
* [ ]	Users cannot access another user’s private records by changing an ID.
* [ ]	Administrative endpoints require appropriate privileges.
* [ ]	Role changes take effect according to the intended session policy.
* [ ]	Expired or revoked sessions are rejected.
* [ ]	Logout invalidates the appropriate session or token.
* [ ]	Password recovery does not reveal whether an account exists.
* [ ]	Repeated login attempts are handled according to configured protections.
* [ ]	Cookies use appropriate security attributes where cookie-based sessions are used.
* [ ]	CSRF protections are tested where applicable.
* [ ]	API keys and bearer tokens are not exposed in URLs or client logs.

Include both allowed and denied cases for every sensitive operation. A test that verifies only successful access is incomplete.

12. Application and Document Workflow Testing

Where application management is implemented, test the entire lifecycle.

Application scenarios

1. A valid application is created.
2. Required fields are validated.
3. The correct user owns the record.
4. The application status changes through permitted transitions.
5. Invalid transitions are rejected.
6. Repeated submission is handled safely.
7. Failed persistence does not produce a false success message.
8. Notifications reflect the actual application status.
9. Restricted records cannot be retrieved by unauthorised users.
10. An audit record is created for important changes where required.

Document scenarios

1. A supported file type and size are accepted.
2. Disallowed extensions and oversized files are rejected.
3. Content does not rely solely on a filename or browser-provided MIME type.
4. Unauthorised downloads are denied.
5. Storage errors do not expose internal paths or secrets.
6. File metadata is associated with the correct user and application.
7. Deleted or revoked files cannot still be retrieved through an unprotected URL.
8. Logs and error messages do not disclose document contents.

Use synthetic files and test accounts. Perform upload security testing only in an authorised environment.

13. Payment Testing

Use the payment provider’s sandbox or test mode whenever available.

Test at least:

* Successful payment.
* Declined payment.
* Pending payment.
* User cancellation.
* Timeout or connection interruption.
* Duplicate client submission.
* Duplicate webhook delivery.
* Invalid webhook signature.
* Out-of-order webhook events.
* Amount or currency mismatch.
* Unknown transaction reference.
* Refund request and provider-confirmed refund outcome.
* Reconciliation after an ambiguous response.

Payment invariants

* A client-side success message must not independently establish a successful payment.
* Payment state must be verified against trusted server-side evidence.
* Webhook signatures must be verified where the provider supports signed webhooks.
* Duplicate webhook events must not create duplicate fulfilment or financial records.
* Amount, currency, order reference, and transaction status must be validated.
* Refunds must follow the authorised workflow and applicable provider rules.
* Sensitive cardholder authentication data must not be logged or stored improperly.

Never run destructive or real-money payment tests in production unless an explicitly approved operational procedure requires them.

14. Security Testing

Security tests should be risk-based and authorised. Follow docs/SECURITY.md for the broader security policy.

Test for:

* Cross-site scripting (XSS).
* SQL injection or equivalent database injection.
* Broken object-level authorisation.
* Privilege escalation.
* Cross-site request forgery where relevant.
* Unsafe file uploads.
* Path traversal.
* Open redirects.
* Server-side request forgery where the application fetches user-controlled URLs.
* Sensitive data exposure.
* Missing or incorrect security headers.
* Weak rate limiting.
* Authentication and session weaknesses.
* Dependency vulnerabilities.
* Secrets accidentally committed to source control.
* Unsafe error messages and stack traces.

Use controlled test inputs and non-production environments. Do not test against third-party systems without authorisation.

A clean automated scanner report does not prove that an application is secure. Review business logic, access control, and sensitive workflows separately.

15. Accessibility Testing

Aim for WCAG 2.2 Level AA where feasible and appropriate for the service.

Check:

* Semantic headings and landmarks.
* Accessible names for controls.
* Labels and instructions for form fields.
* Keyboard navigation and visible focus.
* Logical focus order.
* Dialog focus management.
* Sufficient text and control contrast.
* Alternative text for meaningful images.
* Error identification and recovery instructions.
* Screen-reader announcements for dynamic status changes.
* Reduced-motion support.
* Zoom and text scaling.
* Touch-target usability.

Automated accessibility tools can detect some issues but cannot replace manual keyboard and screen-reader testing.

16. Performance Testing

Assess performance on representative pages and critical user journeys.

Monitor:

* Initial page load.
* JavaScript and CSS transfer sizes.
* Image dimensions and compression.
* API response latency.
* Database query latency.
* Error and timeout rates.
* Layout shifts and rendering delays.
* Search performance on large datasets.
* Behaviour under expected concurrent usage.

Where appropriate, measure Core Web Vitals:

* Largest Contentful Paint (LCP).
* Interaction to Next Paint (INP).
* Cumulative Layout Shift (CLS).

Use representative test data and record the test conditions. Establish numerical budgets based on the actual product and hosting environment rather than treating unmeasured targets as achieved.

Avoid running uncontrolled load tests against production or external providers.

17. End-to-End User Journeys

End-to-end tests should verify the most important complete workflows.

Recommended journeys, where the corresponding features exist:

Journey A — Public education resource

1. Open the homepage.
2. Navigate to education or courses.
3. Search or filter resources.
4. Open a course or official resource.
5. Verify that details and links are correct.

Journey B — Account access

1. Register a synthetic user, if registration is enabled.
2. Complete the configured verification flow.
3. Log in.
4. Open a protected page.
5. Log out.
6. Confirm that protected access is no longer available.

Journey C — Application submission

1. Sign in as a test user.
2. Open an application form.
3. Enter valid synthetic data.
4. Submit the application.
5. Verify the persisted record and reference.
6. Confirm the displayed status.
7. Verify that a different user cannot access the application.

Journey D — Support ticket

1. Open the support form.
2. Submit a valid test request.
3. Verify ticket creation and reference.
4. Check validation for invalid fields.
5. Verify status and notification behaviour where implemented.

Journey E — Payment sandbox

1. Initiate a sandbox payment.
2. Exercise success, failure, and pending outcomes.
3. Verify server-side transaction state.
4. Deliver a duplicate test webhook.
5. Confirm that duplicate processing does not create duplicate financial effects.

Journey F — Document upload

1. Sign in with a synthetic test account.
2. Upload an allowed test document.
3. Verify file metadata and association.
4. Attempt access with an unauthorised account.
5. Verify that access is denied.

Use stable selectors, isolated test data, and deterministic assertions. Avoid relying on arbitrary fixed delays where explicit application-state checks are available.

18. Regression Testing

When a defect is fixed:

1. Reproduce the original problem.
2. Add a test that fails before the fix, where practical.
3. Apply the fix.
4. Confirm that the new test passes.
5. Run related unit and integration tests.
6. Test neighbouring functionality for regressions.
7. Record the issue reference and the test that protects against recurrence.

For example, a fix to an official-documents filter should include tests for the original failing filter, empty results, reset behaviour, and unaffected filters.

19. CI and Test Commands

Use the existing package.json scripts and CI configuration. The following commands are illustrative and should only be used when the corresponding scripts or dependencies exist.

npm ci
npm run lint
npm run test
npm run test:coverage
npm run build

Not every repository has all these scripts. Inspect the actual package.json before invoking them or adding new ones.

Optional Node.js built-in test runner

For a project using compatible JavaScript modules, tests can be executed with:

node —test

If the project uses a different module system or test framework, follow its configured approach.

Recommended CI sequence

1. Install locked dependencies.
2. Run syntax and static checks.
3. Validate required JSON datasets.
4. Run unit tests.
5. Run integration and API tests against isolated services.
6. Run security and dependency checks.
7. Run production build or startup checks where configured.
8. Publish test results and relevant diagnostics.
9. Block release when mandatory checks fail.

Keep secrets out of build logs and ensure CI permissions follow least privilege.

20. Test Coverage and Release Gates

Coverage is useful for identifying untested code but should not be treated as the only measure of quality.

Prioritise meaningful coverage of:

* Authentication and authorisation.
* Application creation and status changes.
* Document access controls.
* Payment verification and webhook processing.
* Data validation.
* Error and retry handling.
* Support ticket creation.
* Official information display and source links.

Suggested release gates

A release should not proceed when:

* Critical unit or integration tests fail.
* Required datasets are invalid.
* A critical user journey is broken.
* An unauthorised user can access protected records.
* A payment or application can enter an invalid state.
* A known critical security issue remains unmitigated.
* Production configuration or required secrets are missing.
* Database migrations or rollback procedures have not been reviewed where applicable.

Any exception should be documented, approved by the responsible owner, and accompanied by a risk assessment and mitigation plan.

21. Production Smoke Tests

After deployment, run non-destructive checks against the deployed release.

* [ ]	Homepage returns the expected response.
* [ ]	Critical static assets load.
* [ ]	Required JSON datasets return valid responses.
* [ ]	Configured health endpoints behave as documented.
* [ ]	Public navigation and key pages work.
* [ ]	Authentication works using an approved test procedure.
* [ ]	Critical APIs respond correctly.
* [ ]	Database connectivity is healthy, where applicable.
* [ ]	Support contact links are correct.
* [ ]	No unexpected server errors appear in monitoring.
* [ ]	Security-sensitive endpoints reject unauthorised requests.
* [ ]	No secrets or private data are exposed in client responses.

Do not create real applications, upload real identity documents, trigger real payments, or alter live user data as part of routine smoke tests.

If a smoke test fails, determine whether the release is safe to continue serving. Use the documented rollback or mitigation procedure where necessary.

22. Bug Report Template

Use this template when reporting a reproducible defect.

Title:
Environment:
Release / commit:
Affected page or endpoint:
Severity / priority:
Description:
Steps to reproduce:
1.
2.
3.
Expected result:
Actual result:
Reproduction frequency:
Approximate time and timezone:
Relevant error code:
Test account / synthetic record reference:
Related logs or screenshots:
Workaround:
Potential impact:
Regression test added:
Assigned owner:
Status:

Remove passwords, session tokens, payment credentials, private documents, and unnecessary personal information before attaching logs or screenshots.

23. Test Case Template

Test ID:
Feature:
Objective:
Preconditions:
Test data:
Steps:
Expected result:
Actual result:
Pass / Fail / Blocked:
Environment:
Tested commit:
Evidence reference:
Defect reference:
Tester:
Execution date:

Keep test cases version-controlled when practical. Use stable identifiers for critical workflows so test results can be compared between releases.

24. Maintenance Responsibilities

The engineering or quality owner should:

* Keep tests aligned with the actual routes, schemas, and frontend modules.
* Remove obsolete test scripts and fixtures.
* Review flaky tests and fix their underlying causes.
* Keep test dependencies and browser tooling updated.
* Ensure that CI does not depend on production data.
* Review failed test results before merging or releasing.
* Update this guide when the stack, deployment workflow, or test strategy changes.

Feature owners should add or update tests alongside changes to application behaviour, API contracts, data schemas, security controls, and user journeys.

25. Final Testing Checklist

Before merging a change:

* [ ]	The change has been reviewed for scope and risk.
* [ ]	Syntax and static checks pass.
* [ ]	Relevant unit tests pass.
* [ ]	JSON data and schema validation pass where applicable.
* [ ]	Relevant API and integration tests pass.
* [ ]	UI behaviour has been checked on relevant viewports.
* [ ]	Accessibility has been considered.
* [ ]	Security and authorisation checks pass for affected workflows.
* [ ]	Error handling and failure states have been tested.
* [ ]	No secrets or sensitive test data are committed.

Before releasing:

* [ ]	Required CI checks pass.
* [ ]	Critical user journeys pass in staging.
* [ ]	Deployment configuration is verified.
* [ ]	Database changes and rollback options are reviewed where applicable.
* [ ]	Production smoke tests are ready.
* [ ]	Known risks and unresolved defects are documented.
* [ ]	Monitoring and incident escalation are available.

⸻

End of document.

Implementation note: This guide defines the recommended testing standard. Align commands, test paths, coverage thresholds, CI jobs, and test cases with the actual MedOrbits repository and its installed dependencies.