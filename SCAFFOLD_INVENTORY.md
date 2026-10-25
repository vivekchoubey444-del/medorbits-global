MedOrbits — Repository Scaffold Inventory & Engineering Readiness

Document ID: MO-ENG-DOC-001
Project: MedOrbits
Document Path: docs/SCAFFOLD_INVENTORY.md
Document Type: Engineering Reference / Repository Governance
Inventory Scope: Repository structure, starter templates, application modules, data resources, tooling, testing, and deployment configuration
Reported File Count: 640, including this inventory; not independently verified
Current Classification: Initial scaffold — verification and integration required
Document Version: 2.1.0
Last Updated: 2026-10-25
Review Cadence: Whenever repository structure, architecture, tooling, security requirements, or release processes change

⸻

1. Executive Summary

MedOrbits is being developed as an education, admissions, career guidance, application-preparation, and recruitment-support platform. Its intended architecture supports public-facing websites, structured educational resources, applicant workflows, administrative operations, backend services, data validation, security controls, testing, and deployment.

This document establishes a common engineering reference for understanding the repository, evaluating implementation maturity, identifying integration dependencies, and maintaining consistent development and release practices.

The objective is not to maximize repository size or populate every possible directory. It is to build a coherent, maintainable, accessible, accurate, secure, and verifiable platform in which every component has a defined responsibility and demonstrable purpose.

This inventory serves five primary functions:

1. Repository orientation: Document the intended purpose of major directories, files, and application modules.
2. Integration governance: Identify dependencies, interfaces, and checks required before components are connected.
3. Quality assurance: Define evidence required to demonstrate that code, data, and workflows meet acceptance criteria.
4. Security and privacy oversight: Establish expectations for authentication, authorization, applicant information, administrative access, and sensitive documents.
5. Release readiness: Define the progression from planned work to verified implementation and approved deployment.

This document describes the intended engineering structure. It does not establish that every listed path exists, every feature is implemented, or every security and operational control is effective in the current repository.

2. Scope, Evidence, and Limitations

2.1 Scope

The inventory covers the intended repository resources for:

* Public website pages, navigation, responsive layouts, and shared interface components.
* Education discovery, college information, admissions, examinations, counselling, and study-abroad resources.
* Career discovery, jobs, internships, recruitment, and application-preparation services.
* Applicant accounts, profiles, submissions, supporting documents, and status notifications.
* Administrative interfaces, permissions, operational tools, and audit records.
* APIs, middleware, validation schemas, business services, database structures, and migrations.
* Structured datasets, official reference documents, and reusable data contracts.
* Security, privacy, accessibility, testing, monitoring, and deployment configuration.
* Engineering documentation, contribution practices, change management, and release procedures.
* Inventory generation, repository validation, and future architecture expansion.

2.2 Evidence standard

Every repository or readiness claim must be supported by evidence appropriate to that claim.

Claim	Minimum acceptable evidence
A file exists	Verified filesystem path or repository entry
A feature is implemented	Code inspection and a reproducible functional check
An API route works	Route configuration and a successful request or integration test
A security control is effective	Relevant implementation and an appropriate security test
A dataset is valid	Syntax validation, schema validation, and applicable domain checks
A workflow is integrated	Verified connections between its UI, backend, storage, and state transitions
A test passes	Recorded result from the actual test command or CI run
A deployment works	Successful deployment and post-deployment smoke tests
A component is production-ready	Completed acceptance criteria, security review, operational checks, and release approval

A directory name, filename, comment, configuration entry, mock response, or successful build does not establish unrelated functionality or operational readiness.

2.3 Explicit limitations

The following remain unverified until inspected or tested against the actual repository and execution environment:

* The reported total of 640 files.
* The existence and completeness of the paths referenced in this document.
* The implementation and integration status of individual features.
* Test coverage, test success rates, and validation results.
* The effectiveness of security and privacy controls.
* The accuracy and freshness of educational and career information.
* The compatibility of configuration with the active hosting environment.
* The completeness of operational monitoring and recovery procedures.
* The production readiness of the application.

When verification produces materially different findings, this document must be updated to reflect the evidence.

3. Repository Architecture Overview

The following directory map describes the intended functional organization. It is a reference architecture, not a declaration that every path currently exists.

Repository path	Primary responsibility	Engineering expectations
.github/	Issue templates, pull-request templates, CI workflows, and repository automation	Reproducible checks, least-privilege permissions, protected secrets
account/	Applicant accounts, profiles, and account-management pages	Server-side authorization, accessible forms, privacy-aware presentation
admin/	Administrative interfaces and operational workflows	Role-based access, auditability, protected data, safe destructive actions
api/	API routes, middleware, schemas, services, and API documentation	Input validation, consistent errors, authorization, documented interfaces
assets/css/	Shared styles, themes, responsive layouts, accessibility, and print styles	Reusable design tokens, readable contrast, responsive behavior, minimal duplication
assets/data/	Education, institution, admissions, and career datasets	Schema validation, source traceability, update history
assets/images/	Brand assets, illustrations, banners, icons, and approved media	Optimization, licensing checks, descriptive alternatives
assets/js/	Browser-side navigation, forms, search, validation, and UI modules	Progressive enhancement, safe DOM handling, predictable module boundaries
career/	Jobs, internships, recruitment, career guidance, and application preparation	Verified claims, clear service boundaries, privacy-aware workflows
database/	SQL schemas, queries, indexes, constraints, views, and development fixtures	Data integrity, reviewed queries, safe test data
docs/	Architecture, API, deployment, data governance, security, and testing documentation	Versioned, discoverable, accurate documentation
education/	Education discovery, admissions, medical education, counselling, and study abroad	Authoritative-source verification, eligibility and date context
infrastructure/	Infrastructure definitions, hosting configuration, and deployment guidance	Environment consistency, minimal privileges, documented recovery
legal/	Privacy notices, terms, refunds, disclaimers, and related legal pages	Consistency with actual practices and applicable legal requirements
migrations/main/	Database migration files and migration guidance	Ordered migrations, review, repeatability, recovery strategy
official-documents/	Official notices, bulletins, fee notifications, and counselling references	Provenance, publication dates, version tracking, permitted distribution
pages/	General company, service, informational, and support pages	Consistent navigation, metadata, accessibility
public/	Public error pages, crawler instructions, sitemap, and static resources	Correct routing, public-only content, deployment compatibility
python/	Python integrations, utilities, and associated tests	Supported Python version, dependency discipline, automated tests
schemas/	Reusable schemas for education, applications, and structured records	Explicit versions, deterministic validation, documented changes
scripts/	Build, validation, data-checking, maintenance, and security scripts	Safe defaults, useful exit codes, clear output, no embedded secrets
src/	Shared application modules, where applicable	Clear module ownership, documented interfaces, limited duplication
support/	Help pages, complaints, account recovery, payment assistance, and support workflows	Privacy-aware handling, documented escalation, safe errors
tests/	Unit, integration, end-to-end, security, and accessibility tests	Reproducible execution, meaningful assertions, controlled test data

Directory responsibilities must be reconciled with the actual architecture before new folders or duplicate implementations are introduced.

3.1 Root-level engineering resources

The intended root-level resources may include:

File	Intended responsibility
README.md	Project overview, setup instructions, and developer entry point
CONTRIBUTING.md	Contribution workflow, coding standards, and review expectations
SECURITY.md	Security policy and vulnerability-reporting instructions
SUPPORT_GUIDE.md	Support procedures, request preparation, and escalation guidance
CHANGELOG.md	Significant user-facing and engineering changes
package.json	JavaScript package metadata, scripts, dependencies, and runtime constraints
package-lock.json	Reproducible npm dependency resolution
pyproject.toml	Python project and tooling configuration, where applicable
pytest.ini	Pytest configuration, if retained
ruff.toml	Ruff configuration, if retained separately
requirements.txt	Python runtime dependencies, where applicable
requirements-dev.txt	Python development and testing dependencies, where applicable
.nvmrc	Node.js version declaration, if used
.python-version	Python version declaration, if used
.gitignore	Generated files, local-only configuration, and sensitive artifacts excluded from Git
robots.txt	Crawler-access instructions in the deployed public document root, where required
sitemap.xml	Public URL discovery resource, where required

These files must be added or modified only when required by the actual implementation. Where configuration is duplicated, designate an authoritative source and prevent conflicting declarations.

4. Application Domains and Acceptance Criteria

4.1 Public website and navigation

Primary entry point: index.html
Related areas: pages/, assets/css/, assets/js/, public/

Required outcomes:

* The homepage and intended public pages load without broken local assets.
* Internal links resolve to their intended destinations.
* Navigation and content layouts work across supported viewport sizes.
* Keyboard navigation, focus visibility, form labels, and semantic structure are usable.
* Page titles, descriptions, canonical URLs, and indexing directives are appropriate.
* Error pages work with the actual hosting and routing configuration.
* Production pages do not depend on localhost URLs or developer-only services.
* Public pages do not expose private applicant records, administrative data, or internal configuration.
* Interactive components provide truthful feedback and handle failures appropriately.

Verification evidence: HTML validation, local-link checks, responsive testing, accessibility checks, and deployment smoke tests.

4.2 Applicant accounts and application preparation

Related areas: account/, relevant career/ pages, api/, database/, and private document-storage integrations.

Required outcomes:

* Each form has a documented and implemented submission destination.
* Authentication and authorization are enforced on the server.
* Applicants can access only records permitted by their identity and role.
* Sensitive documents are stored and served through verified private-storage mechanisms.
* Uploads enforce permitted file types, size limits, authorization, and suitable content-handling controls.
* Application statuses and confirmation messages reflect actual backend results.
* Failed submissions do not generate false success messages or unintended duplicate records.
* Consent language and privacy notices match actual data-processing practices.
* Retention, deletion, correction, and access procedures are documented where applicable.
* Account recovery does not unnecessarily disclose whether an account exists.

A static form, browser-side validation, hidden input, disabled button, or client-side role check does not independently secure an application workflow.

4.3 Administrative interfaces

Related area: admin/

Required outcomes:

* Administrative authentication is enforced by the server.
* Authorization is checked for every privileged action and protected resource.
* Permissions follow the principle of least privilege.
* Applicant documents, exports, and personal information are restricted to authorized users.
* Destructive operations have suitable confirmation and recovery safeguards.
* Security-relevant administrative events are logged without unnecessarily recording secrets or document contents.
* Public static hosting does not expose confidential production data or privileged operations.
* Administrative changes have traceable actors and timestamps where appropriate.
* Access revocation and account deactivation take effect across relevant services.

Administrative UI visibility is not an authorization boundary.

4.4 APIs and backend services

Related areas: api/, src/, database/, migrations/main/, and infrastructure configuration.

Required outcomes:

* Route definitions, middleware, schemas, service interfaces, and documentation agree.
* Validation is applied at server-side trust boundaries.
* Authentication and authorization protect restricted operations.
* Error responses do not disclose stack traces, credentials, internal paths, or sensitive records.
* Unexpected failures are logged internally with appropriate safeguards.
* Rate limits and abuse controls are applied according to endpoint risk.
* Database changes are versioned, reviewed, and tested.
* Transactions and integrity constraints prevent inconsistent state where required.
* Payment notifications, if implemented, are verified using the provider’s documented mechanism.
* Production secrets are supplied through an appropriate secrets-management process.
* API documentation describes actual endpoints, fields, responses, authentication requirements, and error behavior.

Verification evidence: Route tests, schema tests, authorization tests, integration tests, and deployment-configuration review.

4.5 Education, admissions, and career information

Related areas: assets/data/, education/, career/, schemas/, and official-documents/.

Required outcomes:

* JSON datasets pass syntax and applicable schema validation.
* Material factual claims have traceable, authoritative sources.
* Eligibility requirements, deadlines, fees, seat information, and application procedures are dated and verified.
* Unknown, estimated, outdated, or unverified values are not presented as confirmed facts.
* External links are checked before publication and rechecked according to risk.
* Official authority information is distinguished from MedOrbits’ explanatory guidance.
* Changes to time-sensitive information are traceable to a source and review date.
* Records use consistent identifiers, field names, units, currency conventions, and date formats.
* Missing data is represented explicitly rather than replaced with invented values.
* Admissions, employment, scholarship, loan, and recruitment outcomes are not guaranteed without a legitimate basis and appropriate qualification.

For time-sensitive educational information, authoritative regulators, examination authorities, institutions, counselling bodies, and employers take precedence over unverified third-party summaries.

4.6 Support and payment workflows

Related areas: support/, api/, relevant account pages, and payment integrations where implemented.

Required outcomes:

* Support forms collect only information necessary to resolve requests.
* A reference number is displayed only after the system actually creates it.
* Payment states accurately distinguish pending, successful, failed, cancelled, refunded, and other applicable outcomes.
* Payment success is based on verified backend or provider information, not solely on a browser redirect.
* Duplicate callbacks and retries are handled safely and idempotently where applicable.
* Refund and cancellation information matches the implemented service and published policy.
* Support tools do not expose payment credentials, authentication tokens, or unnecessary personal information.
* Escalation procedures and operational ownership are documented.

5. Shared Engineering Standards

5.1 Architecture and modularity

* Assign each module a clear responsibility and documented interface.
* Reuse established components where doing so reduces duplication and maintenance cost.
* Avoid unnecessary coupling between page templates, business rules, data access, and deployment configuration.
* Keep browser-side presentation separate from trusted server-side enforcement.
* Define ownership for shared utilities and data schemas.
* Introduce frameworks and dependencies only when they provide a clear functional or maintenance benefit.
* Document architectural decisions that materially affect security, compatibility, data handling, or deployment.

5.2 Code quality

* Follow conventions appropriate to the language and framework.
* Use descriptive names, clear control flow, and explicit error handling.
* Remove dead code only after verifying that its removal is safe.
* Reuse validation logic where a shared implementation is appropriate.
* Keep modules focused and independently testable where practical.
* Do not suppress warnings or test failures without a documented reason and review.
* Keep comments and documentation consistent with actual behavior.

5.3 User experience and accessibility

* Use semantic HTML and accessible names for controls.
* Support keyboard navigation and visible focus.
* Maintain sufficient contrast, readable typography, and responsive layouts.
* Associate validation messages with their relevant fields.
* Announce important dynamic status changes to assistive technologies where appropriate.
* Do not rely exclusively on color, animation, or icons to communicate critical states.
* Respect reduced-motion preferences when animation is not essential.
* Test important user journeys on representative mobile and desktop layouts.
* Keep error messages actionable without exposing confidential implementation details.

5.4 Performance and reliability

* Avoid unnecessarily large images, scripts, and third-party resources.
* Load noncritical resources without unnecessarily delaying primary content.
* Apply caching only where compatible with privacy and data freshness.
* Set reasonable request and upload limits.
* Handle timeouts, retries, and partial failures deliberately.
* Monitor critical operations where monitoring is available.
* Establish recovery or rollback procedures for risky deployments and database changes.

6. Security, Privacy, and Data Protection

Security must be verified at the relevant trust boundary. Browser-side behavior does not replace backend enforcement.

6.1 Security expectations

* Protect authentication and session handling against unauthorized access.
* Enforce authorization at individual resource and privileged-operation boundaries.
* Validate and normalize untrusted input using context-appropriate rules.
* Use parameterized database queries or safe query-building mechanisms.
* Apply output encoding and other appropriate protections against injection and cross-site scripting.
* Configure cross-origin access, security headers, cookies, and transport security for the deployed architecture.
* Protect uploads and downloads through authorization, size limits, safe storage, and suitable content validation.
* Keep secrets out of source code, public assets, logs, and client bundles.
* Scan dependencies and investigate material security advisories.
* Maintain safe error responses without disabling internal diagnostics.
* Review abuse controls for authentication, account recovery, search, uploads, and expensive API operations.
* Test access boundaries using different roles and record-ownership relationships.

6.2 Applicant and sensitive information

* Collect only information necessary for documented workflows.
* Use synthetic or sanitized test data outside approved production use.
* Do not commit personal documents, production database dumps, live credentials, or private exports.
* Restrict sensitive records according to legitimate operational need.
* Document retention, deletion, backup, and restoration expectations.
* Align privacy notices with actual collection, use, storage, sharing, and retention practices.
* Review third-party processors before transmitting sensitive information.
* Avoid storing sensitive values in browser storage unless specifically assessed and justified.

6.3 Error handling and rejected operations

Rejected requests must fail safely without unnecessarily disrupting unrelated, healthy operations.

* Return appropriate client-facing status codes and useful, non-sensitive error messages.
* Avoid revealing whether protected resources or accounts exist when doing so creates a security risk.
* Do not expose stack traces, secret values, internal filesystem paths, SQL details, or private payloads.
* Preserve sufficient internal diagnostic information to investigate failures.
* Use correlation identifiers where practical.
* Apply rate limits or temporary restrictions where justified by abuse risk.
* Ensure expected validation and authorization failures do not terminate the application.
* Do not silently ignore critical failures, disable audit logging, or report success when an operation failed.
* Prevent repeated or retried requests from unintentionally duplicating sensitive or financial operations.

The objective is controlled rejection, protected diagnostics, and service resilience—not the suppression of failures or security evidence.

6.4 Security documentation

SECURITY.md must describe the actual vulnerability-reporting process and avoid unverified contact details, response commitments, certifications, or security guarantees.

Security claims must be reviewed against implementation evidence before publication.

7. Data Architecture and Database Governance

7.1 Structured data

Datasets and schemas should have:

* A defined purpose and owner, where ownership is assigned.
* A documented schema or format.
* Stable identifiers where records require identity.
* Consistent field naming, date formats, units, and currency handling.
* Explicit treatment of missing, uncertain, or unverified values.
* Source and review metadata for important factual information.
* Validation rules for required fields, data types, ranges, and cross-field constraints.
* A documented change process for breaking schema changes.

7.2 Database migrations

* Preserve established migration history.
* Continue migration numbering or naming from the latest existing migration.
* Review migrations for compatibility, locking, data loss, and execution time.
* Test migrations against representative development data.
* Define rollback or forward-recovery procedures where appropriate.
* Do not modify an already-applied migration in a way that causes environment divergence.
* Use development fixtures that contain no real applicant or payment data.
* Verify indexes and constraints against actual query patterns and integrity requirements.

7.3 Data lifecycle

Document how data is created, validated, updated, archived, deleted, and restored. Data lifecycle decisions must account for legal obligations, service requirements, operational needs, and privacy commitments.

8. Toolchain and Configuration Consistency

The repository should maintain a coherent, documented toolchain.

Configuration	Required consistency check
.nvmrc	Matches the supported Node.js version or range
package.json	Declares compatible runtime requirements, scripts, and dependencies
package-lock.json	Matches the committed package manifest
.python-version	Matches the intended Python runtime, if used
pyproject.toml	Defines compatible project and tool settings
ruff.toml	Aligns with the selected linting rules, if retained separately
pytest.ini	Matches the actual test discovery and execution layout
requirements.txt	Contains appropriate Python runtime dependencies
requirements-dev.txt	Contains development and testing dependencies
CI workflows	Use compatible toolchain versions and repeatable commands
Cloudflare configuration	Matches the actual Pages, Workers, or other deployment architecture
Hosting configuration	Matches actual build commands, output directories, environment variables, and routing

Where configuration is duplicated, designate the authoritative source and avoid conflicting values.

Do not replace working configuration merely to conform to a generic template. Review the existing application, hosting platform, and established conventions before changing toolchain settings.

9. Testing and Quality Assurance

9.1 Potential test and validation resources

The intended quality-assurance resources may include:

* tests/unit/
* tests/integration/
* tests/e2e/
* tests/security/
* tests/accessibility/
* python/tests/
* scripts/validate-html.mjs
* scripts/check-links.mjs
* scripts/check-json.mjs
* scripts/check-security.mjs
* .github/workflows/

These paths are illustrative. Their existence and behavior must be verified before they are treated as available tools.

9.2 Verification sequence

Before release, execute the applicable checks in a sequence that identifies basic defects early and protects high-risk workflows.

1. Repository integrity: Confirm expected files, paths, and configuration.
2. Static validation: Check HTML, CSS, JavaScript syntax, JSON syntax, and applicable schemas.
3. Code quality: Run configured linters, format checks, and language-specific analysis.
4. Unit tests: Verify isolated business rules and utility functions.
5. Integration tests: Verify API, database, storage, and service boundaries.
6. Security tests: Verify authentication, authorization, input handling, file access, and abuse controls.
7. Accessibility checks: Run automated checks and relevant manual keyboard and assistive-technology reviews.
8. End-to-end tests: Verify critical user journeys, including failure paths.
9. Build and deployment checks: Confirm reproducible build output, routing, configuration, and deployment compatibility.
10. Post-deployment smoke tests: Confirm that the deployed application and critical workflows behave as expected.

The sequence may be adjusted to suit CI constraints, but material checks must not be omitted without documented justification.

9.3 Test reporting

Each release-verification run should record:

* Date and environment.
* Commit or revision tested.
* Commands or workflow identifiers.
* Passed, failed, skipped, and blocked checks.
* Relevant failure output or diagnostic-log references.
* Known limitations and accepted risks.
* Responsible reviewer or release approver, where applicable.

The existence of a test file, configured workflow, or successful build does not prove that all tests passed or that the system is secure.

10. Repository Inventory Validation

The reported total of 640 files must be verified against the actual checkout.

10.1 Validation procedure

1. Identify the repository root and revision being inspected.
2. Enumerate tracked files using Git.
3. Enumerate relevant untracked files separately.
4. Identify ignored files and generated artifacts when they affect the reported scope.
5. Compare actual paths with the intended structure in Section 3.
6. Identify missing, unexpected, duplicate, obsolete, and incorrectly cased paths.
7. Check whether referenced files are excluded by .gitignore or another ignore mechanism.
8. Review unexpected files for credentials, private documents, production data, or build artifacts.
9. Confirm that generated outputs are not incorrectly counted as source files.
10. Update this inventory with the verified scope, date, method, and revision.

10.2 File-count reporting

Every reported count must specify what it includes.

Count category	Reporting rule
Tracked files	Files recorded in the selected Git revision
Untracked files	Relevant working-tree files not yet tracked
Ignored files	Files excluded by ignore rules, reported separately if relevant
Generated artifacts	Build, cache, test, or tool outputs, reported separately
Vendored dependencies	Third-party code, reported separately where relevant
Total inventory scope	Explicitly state the categories included

Do not describe an estimate as an audited total. File count is a repository metric, not a measure of implementation quality, security, or production readiness.

11. Continuous Integration and Release Controls

Where CI is configured, it should provide consistent, reviewable evidence of repository quality.

Recommended controls include:

* Repeatable dependency installation and build steps.
* Automated syntax, lint, formatting, and schema checks.
* Unit and integration tests appropriate to the application.
* Dependency and secret scanning.
* Security-sensitive tests for authentication, authorization, uploads, and data access.
* Least-privilege workflow permissions.
* Protected handling of CI secrets.
* Clear failure reporting and useful diagnostic retention.
* Branch and release protections appropriate to project risk.
* Post-deployment smoke checks and documented rollback procedures.

Workflow configuration must match actual project scripts and deployment procedures. A workflow that references missing commands, nonexistent paths, or unavailable secrets is not a functioning quality gate.

12. Operational Readiness and Observability

Production readiness requires more than application code.

Where applicable, establish and verify:

* Health and readiness checks appropriate to the runtime.
* Structured logs with controlled access and retention.
* Request or correlation identifiers for troubleshooting.
* Monitoring for critical service failures and resource exhaustion.
* Alerts with a defined operational owner.
* Backup and restoration procedures for essential data.
* Recovery steps for failed deployments and database changes.
* Documented environment variables and external service dependencies.
* Incident triage and escalation procedures.
* A release record linking the deployed revision to verification evidence.

Monitoring must not collect unnecessary sensitive information. Operational logging should support diagnosis without becoming an uncontrolled repository of personal information or secrets.

13. Implementation Status Model

Assign each component a status based on current repository evidence, not filenames, directory names, comments, or assumptions.

Status	Definition	Minimum evidence
Planned	Intended capability not yet verified as implemented	Documented requirement or approved plan
Discovered	Resource found during repository inventory	Verified path and revision
Classified	Likely purpose identified	Relevant code, references, or configuration reviewed
Scaffolded	Starter file or initial structure exists	Verified path and initial contents
Implemented	Core behavior has been written and demonstrated	Code review and functional evidence
Integrated	Required interfaces and dependencies are connected	Verified interfaces and integration checks
Tested	Applicable tests have been executed	Recorded test results
Verified	Applicable acceptance criteria have passed	Reviewable evidence against requirements
Production-ready	Approved for deployment	Required implementation, testing, security, operational, and release approvals
Deprecated	Being phased out under a documented plan	Deprecation decision and transition plan
Blocked	Progress depends on an unresolved issue	Documented blocker and required follow-up

Discovery does not automatically promote a component to implemented, tested, verified, or production-ready.

Where evidence is incomplete, record the status as unknown or unverified rather than guessing.

14. Change Management and Maintenance

* Preserve established working behavior unless a change explicitly requires modifying it.
* Inspect existing files before creating replacements.
* Review diffs before overwriting or deleting content.
* Avoid duplicate pages, schemas, services, migrations, and configuration files without a defined need.
* Preserve database migration history and environment compatibility.
* Review material dependency changes before merging.
* Verify official information and external links before publication.
* Keep privacy notices, support policies, security claims, and product descriptions consistent with implemented behavior.
* Record significant user-facing, architectural, and operational changes in CHANGELOG.md, where maintained.
* Update relevant documentation when interfaces, routes, environment variables, schemas, or deployment processes change.
* Prefer focused, reviewable, reversible changes where practical.
* Do not commit secrets, production records, private documents, or local-only credentials.
* Document exceptions to mandatory quality checks, including their rationale, risk, owner, and follow-up plan.

15. Recommended Documentation Map

The following documentation map may improve discoverability as the repository matures. Create and maintain documents only where the corresponding need exists.

Document	Intended content
README.md	Project overview, prerequisites, setup, scripts, and primary navigation
docs/ARCHITECTURE.md	System boundaries, components, data flows, and architectural decisions
docs/REPOSITORY_STRUCTURE.md	Directory conventions and module ownership
docs/API_REFERENCE.md	API endpoints, schemas, authentication, and error formats
docs/DATA_GOVERNANCE.md	Dataset ownership, provenance, validation, freshness, and schema changes
docs/SECURITY_REVIEW.md	Security review process and evidence records, without exposing sensitive findings publicly
docs/PRIVACY_AND_DATA_LIFECYCLE.md	Data categories, access, retention, deletion, and processing boundaries
docs/TESTING.md	Test strategy, commands, environments, and reporting conventions
docs/DEPLOYMENT.md	Build, environment configuration, deployment, smoke tests, and rollback
docs/INCIDENT_RESPONSE.md	Incident roles, triage, containment, recovery, and post-incident review
docs/SCAFFOLD_INVENTORY.md	Intended repository structure and verified inventory status

This is a recommended documentation map, not a claim that all documents exist. Avoid duplicating information when a single authoritative source can be maintained.

16. Release Readiness Checklist

Mark each item complete only after the corresponding evidence has been reviewed.

Repository and configuration

* [ ]	Repository inventory and reported file count have been verified.
* [ ]	Required files, imports, routes, and assets resolve correctly.
* [ ]	Toolchain declarations, dependency manifests, and CI configuration are consistent.
* [ ]	No unintended secrets, private documents, or production data are present in the release.

Product and data

* [ ]	Critical public and authenticated user journeys have been tested.
* [ ]	Forms and APIs return truthful results for successful and failed operations.
* [ ]	Educational and career information has appropriate authoritative sources and review dates.
* [ ]	Privacy notices and service descriptions match actual product behavior.
* [ ]	Accessibility and responsive-layout checks have been completed.

Security and reliability

* [ ]	Authentication and resource-level authorization have been verified.
* [ ]	Sensitive document access and upload restrictions have been tested.
* [ ]	Error handling protects confidential implementation details while retaining useful diagnostics.
* [ ]	Dependencies, secrets, and relevant security findings have been reviewed.
* [ ]	Database migrations, backups, and recovery procedures have been assessed where applicable.

Deployment and approval

* [ ]	The release build completes successfully.
* [ ]	Applicable automated checks have executed and their results are recorded.
* [ ]	Deployment configuration matches the actual hosting architecture.
* [ ]	Post-deployment smoke checks pass.
* [ ]	Known risks and exceptions have documented owners and dispositions.
* [ ]	Required release approval has been recorded.

An unchecked item must be resolved, formally accepted by an authorized reviewer, or identified as a release blocker according to the project’s risk policy.

17. Ownership and Review

The repository owner or designated maintainers should ensure that:

* The inventory reflects the current repository architecture.
* Component owners maintain relevant implementation and testing documentation.
* Changes affecting security, privacy, data integrity, or deployment receive appropriate review.
* Significant structural changes are reflected in this document.
* Verification results identify the revision and environment tested.
* Unverified claims remain explicitly labeled.

Assign named owners in a maintained project register or contribution documentation only after responsibilities have been formally agreed. Do not invent ownership or approval authority.

18. Current Status and Next Actions

Current classification: Initial scaffold — verification and integration required.

Recommended next actions:

1. Inspect the actual repository and verify the reported file count.
2. Compare the actual directory tree with the intended structure in Section 3.
3. Confirm the authoritative application entry point, backend architecture, and deployment configuration.
4. Classify listed components as discovered, scaffolded, implemented, integrated, tested, verified, blocked, or deprecated using the status definitions in Section 13.
5. Run the checks supported by the current repository and record their actual results.
6. Review authentication, authorization, applicant-document handling, data validation, and production configuration.
7. Record the verified date, repository revision, discrepancies, and outstanding risks.

MedOrbits should be evaluated by the reliability of its user journeys, the integrity of its information, the protection of applicant data, the quality of its implementation, and the evidence supporting operational readiness.

Repository size is not a quality metric. A dependable platform is built through verified implementation, disciplined integration, documented decisions, repeatable testing, and responsible release management.

Until the relevant checks are completed, file count, implementation completeness, security posture, test status, and production readiness must remain explicitly unverified.

⸻

19. Adaptive Repository Growth and Inventory Automation

19.1 Purpose

Keep the inventory aligned with repository growth while distinguishing verified facts from planned architecture and inferred recommendations.

MedOrbits may acquire new pages, modules, services, schemas, datasets, test suites, infrastructure definitions, integrations, and documentation as requirements evolve. The inventory must therefore remain a living engineering reference rather than a fixed directory list.

Growth principle: The inventory should adapt to the actual repository rather than forcing the repository to conform to an outdated inventory.

19.2 Adaptive inventory policy

When new components are introduced:

1. Discover actual files and directories in the current repository.
2. Compare them with the documented architecture.
3. Identify additions, modifications, removals, duplicates, generated artifacts, and potentially obsolete components.
4. Determine component responsibilities from implementation and references.
5. Identify relevant dependencies, interfaces, tests, security boundaries, and deployment requirements.
6. Add inventory entries where they provide meaningful engineering value.
7. Mark uncertain responsibilities and implementation status as unverified.
8. Update acceptance criteria when architecture or requirements change.
9. Preserve existing behavior and migration history unless a reviewed change authorizes modification.
10. Record material changes in the appropriate engineering documentation.

19.3 Automatic discovery categories

Where present, repository discovery should support the following categories.

Category	Example resources
Application pages	HTML pages, templates, layouts, route-driven views
Frontend modules	JavaScript, TypeScript, CSS, shared UI components
Backend services	API routes, controllers, middleware, business services
Data resources	JSON, CSV, reference datasets, import files
Data contracts	JSON Schema, OpenAPI specifications, validation rules
Database resources	SQL schemas, migrations, indexes, fixtures
Testing	Unit, integration, end-to-end, security, accessibility tests
Automation	Build scripts, validation scripts, maintenance jobs
Infrastructure	Hosting configuration, containers, deployment definitions
Security	Policies, secret-scanning configuration, security tests
Documentation	Markdown guides, architecture decisions, API documentation
External integrations	Payment, messaging, authentication, storage, and service adapters
Generated resources	Build output, caches, generated documentation, test reports
Configuration	Package manifests, runtime declarations, environment examples

Discovery rules should be extensible so new file types and architectural patterns can be incorporated without redesigning the entire inventory.

19.4 Adaptive status tracking

Use the status model in Section 13 consistently across human-maintained and generated inventory records.

Automated discovery may assign Discovered when a path is found. It must not automatically assign Implemented, Integrated, Tested, Verified, or Production-ready without the required evidence.

Ambiguous classifications should be marked for human review.

19.5 Machine-readable inventory

For larger repositories, maintain a machine-readable inventory alongside this document. JSON is a suitable starting format.

A component record may contain the following fields:

Field	Purpose
path	Repository-relative path
type	File, directory, module, service, dataset, configuration, or another defined category
purpose	Verified or provisional responsibility
status	Evidence-based implementation status
owner	Responsible team or role, if assigned
dependencies	Known internal or external dependencies
interfaces	Routes, exports, schemas, events, or other contracts
tests	Relevant test paths or validation commands
security_relevance	Whether the component handles authentication, authorization, secrets, personal data, or other sensitive operations
deployment_relevance	Whether the component affects build, runtime, infrastructure, or deployment
verification	Evidence references and latest verification result
last_reviewed	Date of the latest review
notes	Known limitations, assumptions, and follow-up work

Use only fields that can be maintained reliably. Do not invent owners, successful test results, dates, dependencies, or security guarantees.

19.6 Proposed inventory automation

The following capabilities may be introduced incrementally:

1. File discovery: Enumerate tracked files and optionally relevant untracked files.
2. Classification: Group files using extensions, directory conventions, manifests, and explicit configuration.
3. Reference analysis: Identify imports, route registrations, schema references, script dependencies, and links where practical.
4. Validation: Detect missing referenced files, broken local links, invalid JSON, and inconsistent configuration.
5. Change detection: Compare the current inventory with the previous committed inventory.
6. Risk identification: Flag potentially exposed secrets, unexpected sensitive files, unreviewed dependency changes, and potentially public private resources.
7. Report generation: Summarize additions, removals, changes, unresolved references, and verification gaps.
8. Human review: Require maintainers to confirm ambiguous classifications and material architectural changes.
9. Reviewed documentation updates: Incorporate inventory changes through review rather than silently overwriting human-maintained decisions.

Automation should report findings, not invent architectural facts.

19.7 Suggested inventory outputs

If the automation is implemented, its outputs may include:

* docs/SCAFFOLD_INVENTORY.md — human-readable architecture and readiness reference.
* docs/generated/repository-inventory.json — machine-readable component inventory.
* docs/generated/repository-inventory-summary.md — concise generated summary.
* reports/repository-validation.json — machine-readable validation results.
* CI job summaries — additions, removals, missing references, and failed checks.

These are proposed paths, not confirmed existing files. Create them only when the corresponding generator and maintenance process are implemented.

Generated files must be clearly identified and must not overwrite manually maintained policies, architectural decisions, or review records.

19.8 File-count and repository metrics

Recalculate the reported file count whenever a verified inventory is generated.

Reports should distinguish:

* Git-tracked source files.
* Relevant untracked files.
* Ignored files, if included in scope.
* Generated artifacts.
* Vendored or third-party code.
* Binary assets.
* Directories and symbolic links, if counted separately.

Record the repository revision, generation time, counting method, and inclusion rules. Do not assume that the count will remain 640 or that an increase indicates improved quality.

19.9 Safe expansion rules

Adaptive inventory generation must:

* Preserve existing project conventions unless a reviewed change authorizes a migration.
* Avoid deleting files simply because they are absent from an expected template.
* Avoid automatically rewriting source files, configuration, or migrations.
* Avoid following symbolic links outside the intended repository boundary.
* Exclude credentials, private applicant records, and sensitive file contents from generated reports.
* Avoid executing discovered scripts or application code during basic inventory generation.
* Treat filenames and file contents as untrusted data.
* Produce deterministic output where practical to reduce unnecessary diffs.
* Report failures clearly when required discovery or validation steps cannot be completed.
* Keep destructive actions out of routine inventory jobs.

19.10 Adaptive inventory acceptance criteria

The inventory automation may be classified as implemented only when:

* [ ]	A reproducible discovery command exists.
* [ ]	Inclusion and exclusion rules are documented.
* [ ]	Generated inventory accurately represents the selected repository revision.
* [ ]	New files are detected without manually enumerating every path.
* [ ]	Missing references are reported where detection is supported.
* [ ]	Generated output distinguishes observations from inferred classifications.
* [ ]	Sensitive content is not copied into reports.
* [ ]	Inventory changes are reviewable in Git.
* [ ]	CI integration, if enabled, uses verified commands and appropriate permissions.
* [ ]	Maintainers can correct classifications and resolve failed checks through a documented process.

Until these criteria are satisfied, adaptive inventory automation remains proposed rather than implemented.

19.11 Long-term architecture evolution

As MedOrbits expands, the inventory may incorporate additional application domains, integrations, regional data sources, localization resources, observability systems, background workers, and deployment targets.

New architecture should be introduced when supported by actual requirements. Do not create empty directories, placeholder services, speculative dependencies, or duplicate documentation solely to increase repository size.

Final principle: MedOrbits should grow through verified capabilities and maintainable architecture. Its inventory should evolve with the codebase, preserve uncertainty where evidence is missing, and help maintainers make informed engineering decisions.