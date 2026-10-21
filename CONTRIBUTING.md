Contributing to MedOrbits

Thank you for your interest in contributing to MedOrbits.

MedOrbits is an education, admissions, career development, recruitment, and student-services platform. We aim to build reliable, secure, accessible, maintainable, and user-friendly solutions that help people discover opportunities and navigate important educational and professional workflows.

We welcome meaningful contributions, including bug fixes, feature proposals, documentation improvements, accessibility enhancements, performance optimizations, automated tests, and security improvements.

This guide defines the expectations and workflow for contributing to the project. Please read it before submitting changes.

By participating, you agree to follow the project’s CODE_OF_CONDUCT.md and applicable repository policies.

⸻

Contents

1. Before You Begin
2. Development Environment
3. Project Architecture
4. Issues and Contribution Scope
5. Engineering Principles
6. Coding Standards
7. Backend and API Development
8. Frontend and Accessibility
9. Database and Migrations
10. Security and Privacy
11. Testing and Quality Assurance
12. Branches and Commits
13. Pull Request Workflow
14. Pull Request Checklist
15. Bug Reports
16. Feature Proposals
17. Security Vulnerability Reporting
18. Documentation and Configuration
19. Dependencies and External Services
20. Review and Merge Policy
21. Releases and Compatibility
22. Code of Conduct
23. Licensing and Contribution Rights
24. Support and Questions

⸻

1. Before You Begin

Before making changes:

* Read README.md to understand the project’s purpose, installation process, architecture, and supported technologies.
* Read SECURITY.md before investigating or reporting a potential vulnerability.
* Review CODE_OF_CONDUCT.md and communicate respectfully.
* Consult CHANGELOG.md, if present, for documented changes and release history.
* Search existing issues and pull requests to avoid duplicate work.
* Inspect the relevant implementation, configuration, tests, and documentation before introducing a new pattern.
* Discuss substantial architectural changes with maintainers before implementation.
* Confirm that you have permission to contribute any code, content, images, fonts, datasets, or other material you submit.

Never commit

* Production credentials, API keys, passwords, private keys, access tokens, session cookies, or recovery codes.
* .env files containing real secrets or environment-specific credentials.
* Private application records, identity documents, academic records, payment information, or personal-data exports.
* Production database dumps, private uploads, unredacted logs, or backups.
* Local dependency directories, temporary files, or generated artifacts unless explicitly required by the project.

Use synthetic data and sanitized examples in development, documentation, and tests.

2. Development Environment

Prerequisites

Use the versions and tools specified by the repository:

* Node.js version specified in package.json, .nvmrc, .node-version, or project documentation.
* The package manager and lockfile used by the project.
* Git.
* MySQL, Redis, browser automation, or other services when required by the feature.
* Any additional tools documented by the project.

Do not independently upgrade the runtime, package manager, or major dependencies as part of an unrelated change.

Initial setup

Clone the repository and enter its directory:

git clone <repository-url>
cd <repository-directory>

Install dependencies using the committed lockfile:

npm ci

If .env.example exists, copy it to a local development environment file:

cp .env.example .env

On Windows, use an appropriate PowerShell or Command Prompt equivalent.

Next:

1. Configure development-only credentials and required environment variables.
2. Start the required local services.
3. Initialize the development database using the documented migration process.
4. Run the project’s configured linting and test commands.
5. Start the application using an existing development script.
6. Verify the affected workflow locally.

Example commands:

npm run lint
npm test
npm run dev

These commands are examples. Check package.json before using them; not every script is guaranteed to exist.

Environment configuration

* Keep development, staging, and production credentials separate.
* Use strong development secrets where required.
* Never use production credentials or production data for routine testing.
* Document new environment variables in .env.example and relevant documentation.
* Use clearly identified placeholder values instead of real credentials.
* Validate required configuration at application startup.

Adding a variable to .env.example does not implement its functionality. Configuration must be connected to application code and tested.

3. Project Architecture

Follow the existing architecture and established conventions. Do not create duplicate implementations simply to introduce a preferred design pattern.

The following table describes intended responsibilities. Not every directory is guaranteed to exist.

Component	Responsibility
src/routes/	Register endpoints and connect middleware to controllers
src/controllers/	Handle HTTP requests and responses
src/services/	Implement business rules and coordinate workflows
src/repositories/	Encapsulate database access where this layer is used
src/models/	Represent domain entities or persistence models according to project conventions
src/validators/	Validate request input and other untrusted data
src/middleware/	Implement request processing, authentication, and error handling
src/policies/	Enforce authorization and resource-access decisions where implemented
src/config/	Load and validate application configuration
src/integrations/	Encapsulate external services and providers
src/jobs/ and src/workers/	Handle scheduled or asynchronous work where configured
src/utils/	Provide focused, reusable utilities
tests/	Contain automated tests following the established test architecture

Before adding a new abstraction, inspect the existing codebase and determine whether an appropriate implementation already exists.

Prefer explicit interfaces, clear module boundaries, and one reliable implementation of each business operation.

4. Issues and Contribution Scope

Contributions are welcome in areas including:

* Education guidance and admissions workflows.
* Medical admissions information and student services.
* Study-abroad resources and related workflows.
* Careers, internships, recruitment, and employment opportunities.
* Authentication, registration, profiles, and account management.
* Applications, document management, and notifications.
* Payment and subscription integrations.
* Search, comparison tools, calculators, and other platform utilities.
* Accessibility, responsive design, performance, and reliability.
* Documentation, developer tooling, and automated testing.

For an existing issue, follow its acceptance criteria and maintainer instructions.

For an undocumented problem, explain the issue and proposed solution before starting substantial work.

Large contributions should be divided into reviewable stages, each with a defined scope and measurable acceptance criteria.

Opening an issue or pull request does not guarantee acceptance, implementation, or a release date.

5. Engineering Principles

Every contribution should prioritize the following principles.

Correctness: Implement the intended behavior and account for relevant edge cases.

Security by default: Treat user input, uploaded files, webhooks, and external responses as untrusted.

Privacy: Collect, process, retain, and log only the information necessary for the intended purpose.

Maintainability: Prefer readable code, explicit responsibilities, and limited unnecessary complexity.

Reliability: Handle expected failures, timeouts, retries, and partial operations deliberately.

Accessibility: Support semantic HTML, keyboard interaction, assistive technologies, and responsive layouts.

Compatibility: Preserve existing interfaces unless a breaking change has been discussed and documented.

Testability: Make important behavior verifiable without unnecessary dependence on live external services.

Consistency: Follow existing naming, module-export, validation, error-handling, and formatting conventions.

Minimal scope: Avoid unrelated refactoring, dependency upgrades, formatting churn, and generated-file changes in focused fixes.

6. Coding Standards

JavaScript and Node.js

* Follow the configured ESLint and Prettier rules.
* Use the module system established by the relevant package or directory.
* Prefer const and use let when reassignment is necessary.
* Use descriptive names and focused functions.
* Handle rejected promises and asynchronous errors explicitly.
* Avoid blocking filesystem operations in request handlers unless justified.
* Do not swallow exceptions or report success after a failed operation.
* Remove unused imports, debugging statements, temporary code, and dead branches.
* Avoid unnecessary global mutable state.

HTTP and API behavior

* Use appropriate HTTP methods and status codes.
* Validate request bodies, route parameters, and query parameters.
* Follow the project’s established response format.
* Return generic public errors rather than internal stack traces or database details.
* Do not report success when an operation has failed or remains unconfirmed.
* Distinguish authentication from authorization.
* Enforce access restrictions at the resource level, not just at the route level.

Frontend development

* Use semantic HTML and accessible form labels.
* Preserve responsive layouts and readable text at supported screen sizes.
* Avoid unsafe HTML insertion and unsafe DOM manipulation.
* Render untrusted content safely.
* Follow the existing visual design system.
* Respect content-security controls and avoid weakening them to accommodate new inline scripts.
* Provide understandable loading, empty, error, success, and disabled states.

Formatting

Use the repository’s configured formatter and linter. Avoid mixing unrelated formatting changes with functional contributions.

7. Backend and API Development

Where appropriate, backend processing should separate:

1. Route registration.
2. Authentication and input validation.
3. Authorization and resource-access checks.
4. Controller request handling.
5. Service-layer business logic.
6. Repository or database operations.
7. Response formatting and centralized error handling.

The exact implementation should follow existing project conventions.

Authorization requirements

* Derive user identity from trusted server-side authentication state.
* Enforce ownership and role restrictions on the server.
* Do not trust client-supplied userId, ownerId, role, payment status, subscription status, or account status without independent verification.
* Verify that the requester may access or modify each requested resource.
* Prevent insecure direct object reference vulnerabilities.
* Fail closed when authorization cannot be established.

External integrations

External service calls should have appropriate timeouts, bounded retries, error handling, and observability.

Retry only operations that are safe to repeat or protected by idempotency controls. Avoid uncontrolled retry loops and duplicate side effects.

Use mocks, sandbox environments, or controlled test services where practical.

8. Frontend and Accessibility

User-facing changes must remain consistent with MedOrbits’ design conventions and accessibility requirements.

Contributors should:

* Use semantic headings, landmarks, buttons, links, and form controls.
* Provide labels and meaningful validation messages.
* Preserve keyboard navigation and visible focus indicators.
* Maintain sufficient contrast for text and interactive elements.
* Avoid communicating important information through color alone.
* Give interactive controls accessible names.
* Provide meaningful alternative text for informative images.
* Respect reduced-motion preferences when adding animations.
* Prevent unintended horizontal overflow and text clipping.
* Test loading, empty, error, and success states.
* Avoid exposing secrets or private records in client-side code, URLs, markup, or configuration.

Automated accessibility tools are useful but do not replace manual keyboard and interaction testing.

9. Database and Migrations

Database changes must be deliberate, reviewable, and compatible with the deployment process.

Contributors should:

* Use the project’s established migration mechanism.
* Include migrations for persistent schema changes where required.
* Use parameterized queries rather than interpolating untrusted values into SQL.
* Use transactions when multiple operations must succeed or fail together.
* Add suitable indexes and constraints.
* Consider concurrent requests, duplicate submissions, and transaction isolation.
* Avoid destructive changes without a documented migration strategy.
* Document backfills, deployment ordering, downtime, and rollback limitations.
* Use synthetic data in automated tests.
* Never run experimental migrations against production without an approved deployment procedure.

Migration compatibility

Where practical, use an expand-and-contract approach:

1. Introduce backward-compatible schema changes.
2. Deploy application code compatible with the existing and updated structures.
3. Backfill or migrate data safely.
4. Switch application behavior.
5. Remove obsolete structures only after compatibility is verified.

A rollback plan must account for data and schema risks. Reversing a migration is not always safe or possible after destructive changes.

10. Security and Privacy

Security is a mandatory part of contribution review.

Authentication and sessions

* Use established authentication mechanisms.
* Protect sensitive account changes and privileged operations.
* Do not expose tokens or session identifiers in URLs or logs.
* Avoid weakening password, session, cookie, or authentication controls to make tests pass.

Input validation and output handling

* Validate untrusted input on the server.
* Apply context-appropriate output encoding.
* Use parameterized database queries.
* Prevent injection, cross-site scripting, cross-site request forgery, unsafe deserialization, path traversal, and unsafe redirects where relevant.

File uploads and private documents

* Enforce file-size and permitted-type limits.
* Do not trust client-supplied filenames or MIME types.
* Generate safe storage identifiers.
* Store private documents outside publicly served directories or in appropriately private object storage.
* Enforce authorization before document downloads or other file operations.
* Use malware scanning or quarantine when required by the deployed architecture.
* Do not expose private documents through predictable public URLs.

Payments and subscriptions

* Verify webhook signatures using the provider’s documented procedure and the exact raw request bytes required.
* Verify transaction identity, amount, currency, and expected payment state.
* Implement durable idempotency and duplicate-event handling.
* Do not mark an application, order, or subscription as paid solely because of a browser redirect or client-supplied status.
* Protect payment credentials and webhook secrets.
* Test duplicate events, invalid signatures, interrupted processing, and retry behavior.

Configuration and secrets

* Never commit production secrets.
* Validate required environment variables at startup.
* Avoid insecure production defaults.
* Use least-privilege service accounts and database users.
* Review changes to CORS, trusted proxies, rate limiting, security headers, cookies, and logging carefully.

Follow SECURITY.md for vulnerability reporting and disclosure.

11. Testing and Quality Assurance

Every functional change should include appropriate verification.

Unit tests

Test isolated business rules, validation, transformations, permissions, and error handling, including relevant edge cases.

Integration tests

Where applicable, test interactions involving:

* Authentication and authorization middleware.
* Services and repositories.
* Database constraints and transactions.
* Application submission workflows.
* Notification dispatch and retry handling.
* Payment-event processing and idempotency.

Mocks are useful for external dependencies, but they do not prove that the real integration works.

End-to-end tests

Where supported, test important user workflows such as registration, login, application submission, document access, and payment completion.

Use actual configured routes and workflows rather than assuming example endpoints exist.

Regression and security tests

Where relevant, verify that:

* Unauthenticated access is rejected.
* Unauthorized users cannot access other users’ resources.
* Invalid input is rejected safely.
* Duplicate requests do not create unintended duplicate operations.
* Sensitive fields are not exposed.
* Invalid payment webhooks are rejected.
* Database failures do not produce false success responses.
* Existing functionality remains intact.

Running checks

Check package.json and run the scripts actually defined by the project. Examples may include:

npm test
npm run lint
npm run format:check
npm run test:integration
npm run test:e2e

Not every script is guaranteed to exist.

Before database-backed tests, verify that the test database is separate from development and production data. Never run destructive setup or cleanup against an unverified database.

Report results accurately

In the pull request, state:

* Which checks you ran.
* Which passed or failed.
* Which checks could not be run and why.
* Any required external services or manual verification.
* Known limitations and follow-up work.

Never claim that a test passed unless it was actually executed and passed.

12. Branches and Commit Messages

Use a descriptive branch for each independent contribution.

Examples:

feat/application-status
feat/study-abroad-search
fix/payment-webhook-validation
fix/document-access-control
docs/security-policy
test/application-submission
refactor/application-service

Use clear commit messages that describe the change.

Examples:

feat: add application status tracking
fix: reject invalid payment webhook signatures
docs: improve contributor setup instructions
test: cover application authorization rules
refactor: separate application persistence logic

These examples follow a Conventional Commits-inspired format. Follow any stricter convention already established in the repository.

Before committing, inspect the complete change set:

git status
git diff —check
git diff
git diff —cached

Do not commit secrets, private data, unrelated modifications, temporary debugging changes, or unnecessary generated artifacts.

13. Pull Request Workflow

Step 1 — Prepare the branch

Create a branch from the appropriate base branch and keep the change focused.

Step 2 — Implement the change

Follow existing conventions and add or update tests for the changed behavior.

Step 3 — Update documentation

Update relevant API documentation, environment examples, migration instructions, README sections, and changelog entries.

Step 4 — Run verification

Run the applicable tests, linting, formatting, build, migration, and security checks supported by the project.

Step 5 — Review the diff

Look for accidental changes, secrets, sensitive data, debug code, unsafe defaults, and generated artifacts.

Step 6 — Open the pull request

Explain the problem, proposed solution, implementation, testing performed, risks, and trade-offs.

Step 7 — Address review feedback

Respond constructively and make focused follow-up commits where necessary.

Step 8 — Communicate deployment requirements

Identify environment-variable changes, migrations, dependency updates, feature flags, external-service configuration, and operational considerations.

Do not merge until the applicable review requirements and required status checks have passed.

14. Pull Request Checklist

Before requesting review, confirm:

* [ ]	The purpose and scope are clear.
* [ ]	The implementation follows the existing architecture and conventions.
* [ ]	Relevant tests have been added or updated.
* [ ]	Checks have been executed and their results are accurately reported.
* [ ]	Input validation and resource-level authorization are enforced where required.
* [ ]	No secrets or sensitive information have been included.
* [ ]	Error handling and logging are appropriate.
* [ ]	Database changes include migration and recovery considerations.
* [ ]	Payment and asynchronous workflows handle failures and duplicates safely where applicable.
* [ ]	Documentation and configuration examples have been updated.
* [ ]	New dependencies and runtime requirements are justified.
* [ ]	User-facing changes preserve accessibility and responsive behavior.
* [ ]	Compatibility and deployment implications are documented.
* [ ]	The complete diff has been reviewed.
* [ ]	The contribution complies with the Code of Conduct and applicable project policies.

15. Reporting Bugs

Before opening a bug report, search existing issues and confirm that the behavior is reproducible.

Include, where relevant:

* Summary: A concise description of the problem.
* Expected behavior: What should happen.
* Actual behavior: What happened instead.
* Reproduction steps: The smallest reliable sequence that reproduces the issue.
* Environment: Relevant runtime, database, browser, operating-system, and application versions.
* Impact: Which workflows or users are affected.
* Evidence: Sanitized error messages, screenshots, or logs.
* Frequency: Whether the issue is consistent or intermittent.
* Workarounds: Any known temporary mitigation.

Remove credentials, access tokens, private user data, identity documents, payment details, session cookies, and unredacted logs.

If the issue may expose a security vulnerability, follow SECURITY.md instead of filing a public bug report.

16. Proposing Features

A useful feature proposal explains the problem before prescribing an implementation.

Include:

* The user need or operational problem.
* The intended audience and expected benefit.
* Proposed behavior and acceptance criteria.
* Relevant workflows, edge cases, and failure states.
* Accessibility and mobile considerations.
* Security, privacy, and authorization implications.
* Database, API, and configuration changes.
* Alternatives considered and their trade-offs.
* Dependencies or external services required.

Seek maintainer feedback before implementing substantial changes.

Proposals may be revised, deferred, or declined based on project priorities, feasibility, security, compatibility, and maintenance costs.

17. Security Vulnerability Reporting

Do not disclose security vulnerabilities through public issues, discussions, or pull requests.

Follow the private reporting procedure in SECURITY.md. Use only a private reporting channel explicitly documented in the repository or on the official MedOrbits website.

If no private reporting channel is available, ask a maintainer through an appropriate non-public channel to provide one before sharing sensitive technical details.

A report may include:

* The affected component and version, if known.
* The security impact and relevant threat scenario.
* Minimal reproduction steps.
* Sanitized logs or proof-of-concept material.
* Suggested mitigations, if known.

Do not include unrelated personal data, production credentials, or unnecessary copies of private records.

Do not access, modify, or extract data without authorization. A vulnerability report does not automatically authorize testing against production systems or third-party infrastructure.

18. Documentation and Configuration

Documentation is part of the implementation.

Update relevant documentation when behavior changes, including:

* README.md
* CHANGELOG.md
* API references and endpoint examples.
* Environment-variable documentation and .env.example.
* Installation and deployment instructions.
* Database migration and recovery instructions.
* Testing and development guides.
* Feature-specific documentation and troubleshooting instructions.

Configuration requirements

* Keep examples syntactically valid.
* Clearly distinguish required and optional variables.
* Document defaults, units, allowed values, and environment-specific behavior.
* Identify variables that require coordinated deployment or secret rotation.
* Never include real credentials.
* Ensure documentation matches the variables actually consumed by the application.

Do not document an unimplemented feature as available or claim that an example command works unless it has been verified.

19. Dependencies and Third-Party Services

New dependencies increase maintenance, security, and operational costs.

Before adding a dependency:

* Check whether existing packages already provide the required functionality.
* Explain why the dependency is necessary.
* Review maintenance status, license compatibility, security history, and transitive dependencies.
* Avoid packages with unnecessary permissions or excessive functionality.
* Follow the repository’s version-management strategy.
* Update the appropriate lockfile.
* Test the integration and document new configuration or runtime requirements.

For external integrations, document expected availability, authentication, timeouts, failure handling, and operational dependencies.

Never embed private API credentials in browser-delivered JavaScript or publicly accessible configuration.

20. Review and Merge Policy

Pull requests may be reviewed for:

* Functional correctness and maintainability.
* Architectural consistency.
* Security, privacy, and authorization.
* Test quality and reproducibility.
* Accessibility and usability.
* Performance and operational reliability.
* Documentation and migration completeness.
* Compatibility with supported runtime and dependency versions.

Reviewers may request changes, clarification, additional tests, or a narrower implementation.

Maintainers may close or defer contributions that are out of scope, duplicate existing work, introduce unacceptable risks, lack required information, or cannot be maintained.

Do not merge until the repository’s required approvals and applicable automated checks have passed. Any permitted exceptions must follow documented project policy.

21. Releases and Compatibility

Contributions affecting public APIs, database schemas, configuration, dependencies, or deployment procedures must identify compatibility implications.

Where applicable, document:

* Breaking changes.
* Required database migrations.
* Environment-variable additions, removals, or changes.
* Dependency or runtime requirements.
* Deployment ordering and service restarts.
* Data backfills and rollback limitations.
* Feature flags or staged rollout requirements.
* Changes to external integrations or payment workflows.

Follow the project’s release process and CHANGELOG.md conventions.

If Semantic Versioning is used, follow its compatibility rules. Do not claim that a release has been published unless it has been verified.

22. Code of Conduct

All contributors must follow CODE_OF_CONDUCT.md.

Maintain respectful, professional discussions. Critique technical decisions and work rather than attacking individuals.

Harassment, discrimination, threats, intimidation, disclosure of private information, and retaliation against good-faith reporters are unacceptable.

Maintainers may moderate contributions and restrict participation in accordance with the Code of Conduct.

23. Licensing and Contribution Rights

Before contributing, review LICENSE and any applicable third-party licensing requirements.

By submitting a contribution, you represent that you have the right to submit the material and that doing so is consistent with the applicable license and relevant agreements.

Do not submit code, images, fonts, documentation, datasets, or other materials that you do not have permission to distribute.

Retain applicable copyright notices and license attributions.

If the repository has no applicable license or the rights to a proposed contribution are unclear, ask the maintainers for clarification before submitting the material.

Submitting a contribution does not, by itself, grant the project rights beyond those provided by the applicable license or a separate agreement.

24. Support and Questions

For general contribution questions, use the project contact or discussion channel documented in README.md.

For security concerns, follow SECURITY.md.

For conduct concerns, follow CODE_OF_CONDUCT.md.

When requesting help, provide enough context to understand the problem while keeping credentials, personal information, and confidential material private.

⸻

Thank You

Thank you for helping improve MedOrbits.

Every thoughtful contribution—whether code, testing, documentation, accessibility improvements, or constructive feedback—helps make the project more reliable, secure, maintainable, and useful.

We appreciate your time, care, and commitment to building MedOrbits responsibly.

MedOrbits — Education · Admissions · Careers · Recruitment

Study · Work · Grow