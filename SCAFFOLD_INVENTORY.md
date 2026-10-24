MedOrbits — Scaffold Inventory

Project: MedOrbits
Document: docs/SCAFFOLD_INVENTORY.md
Inventory scope: Repository scaffold and starter templates
Reported file count: 640, including this inventory
Status: Initial scaffold — integration and verification required

1. Purpose

This inventory documents the planned repository structure for MedOrbits, covering website pages, educational resources, career services, application workflows, administrative interfaces, API scaffolding, data files, database resources, security controls, testing, and deployment configuration.

It serves as a repository reference for integration, maintenance, quality assurance, and release planning.

2. Important Status Notice

The reported count of 640 files is an inventory claim and must be confirmed against the actual repository.

Files listed here may be starter templates, examples, configuration files, placeholders, or partially implemented components. Their presence does not establish that a feature is functional, secure, complete, or production-ready.

Before integrating existing or newly generated files:

* Preserve existing repository files and established application behavior.
* Review changes before overwriting existing content.
* Verify HTML links, asset paths, imports, routes, and configuration.
* Validate educational facts and official links against authoritative sources.
* Test security controls on the server, not only in browser interfaces.
* Confirm deployment compatibility with the actual hosting architecture.

3. Repository Structure

The following directories define the major functional areas of the scaffold.

Directory	Responsibility
.github/	Issue templates, pull-request template, and automation workflows
account/	Applicant account and profile page templates
admin/	Administrative interface templates
api/	API routes, middleware, schemas, services, and OpenAPI documentation
assets/css/	Stylesheets, layout, themes, accessibility, and print styles
assets/data/	Structured education, college, admission, and career data
assets/images/	Logo, banner, icon, college, and career asset locations
assets/js/	Browser-side navigation, forms, search, validation, and UI modules
career/	Jobs, recruitment, career guidance, and application-preparation pages
database/	SQL schema, queries, indexes, constraints, views, and development seeds
docs/	Architecture, API, deployment, data verification, privacy, security, and testing documentation
education/	Education discovery, admissions, medical education, counselling, and study-abroad pages
infrastructure/	Cloudflare configuration and environment/deployment documentation
legal/	Legal notices, privacy policies, terms, and service disclaimers
migrations/main/	Database migration directory and migration guidance
official-documents/	Official notices, bulletins, fee notifications, and counselling resources
pages/	General company, service, information, and support pages
public/	Public error pages, crawler instructions, and sitemap files
python/	Python integrations, utility scripts, and tests
schemas/	Reusable JSON schemas for structured application and education data
scripts/	Build, validation, data-checking, and security-check scripts
src/	Shared JavaScript and Python application modules
support/	Support, complaints, account recovery, payment assistance, and help pages
tests/	Security, integration, end-to-end, accessibility, and unit-test locations

Root-level configuration and documentation include README.md, CONTRIBUTING.md, SECURITY.md, SUPPORT_GUIDE.md, CHANGELOG.md, package.json, package-lock.json, pyproject.toml, pytest.ini, ruff.toml, requirements.txt, and requirements-dev.txt.

4. Core Implementation Areas

4.1 Website and navigation

Primary entry point: index.html

Related areas: pages/, assets/css/, assets/js/, public/

Acceptance criteria:

* The homepage loads without missing local resources.
* Internal links resolve to the intended pages.
* Navigation works on mobile and desktop.
* Keyboard focus and form labels are accessible.
* Public error pages are configured for the selected hosting platform.
* No local development server URLs are required in production pages.

4.2 Accounts and application preparation

Related areas: account/ and career/application-preparation/

Acceptance criteria:

* Forms have documented submission destinations.
* Protected operations require server-side authentication and authorization.
* Applicants can access only records they are authorized to view.
* Sensitive documents are handled through verified private storage.
* Application states and confirmation messages reflect actual backend results.
* Privacy notices and consent language match implemented practices.

A static form or browser-side validation script does not, by itself, securely process or store applicant information.

4.3 Administrative interfaces

Related area: admin/

Acceptance criteria:

* Administrative access is enforced on the server.
* Permissions are checked for every privileged operation.
* Data exports and document access are restricted.
* Destructive operations require appropriate safeguards.
* Audit records exclude unnecessary secrets and sensitive payloads.
* Administrative pages do not expose production data through public static hosting.

4.4 API and backend scaffolding

Related areas: api/, src/js/services/, database/, and migrations/main/

Acceptance criteria:

* Routes, middleware, schemas, and service interfaces agree.
* Input validation and authorization are enforced server-side.
* Error handling avoids leaking secrets or internal implementation details.
* Database changes are versioned and tested.
* Payment notifications, if supported, are verified using the payment provider’s documented mechanism.
* Production secrets are supplied through an appropriate secrets-management process.

4.5 Education and career data

Related areas: assets/data/, education/, career/, schemas/, and official-documents/

Acceptance criteria:

* JSON data passes syntax and schema validation.
* Important factual claims have traceable authoritative sources.
* Fees, seat matrices, eligibility requirements, and deadlines are dated and verified.
* Unknown or unverified values are not presented as established facts.
* External links are checked before publication.
* Information controlled by third-party authorities is clearly distinguished from MedOrbits guidance.

5. Quality Assurance and Security

Relevant resources include:

* tests/security/
* tests/integration/
* tests/e2e/
* tests/accessibility/
* python/tests/
* scripts/validate-html.mjs
* scripts/check-links.mjs
* scripts/check-json.mjs
* scripts/check-security.mjs
* .github/workflows/

The presence of a test file or workflow is not proof that it executes successfully or provides complete coverage.

Release verification should include:

1. HTML and internal-link validation.
2. JSON syntax and schema validation.
3. Python tests and linting.
4. JavaScript validation and security tests.
5. SQL and migration checks.
6. Dependency and secret scanning.
7. Authorization and document-access testing.
8. Build and deployment verification.

Record actual results, failures, skipped checks, and outstanding risks.

6. Configuration Consistency

Keep the toolchain configuration aligned:

* .nvmrc and package.json must specify compatible Node.js requirements.
* .python-version, pyproject.toml, ruff.toml, and CI must agree on the supported Python version.
* pytest.ini must match the actual test directory layout.
* requirements.txt must reflect runtime dependencies; requirements-dev.txt must contain development and testing dependencies.
* package-lock.json must correspond to the committed package.json.
* Cloudflare configuration must match the chosen Pages or Workers deployment architecture.

Do not introduce dependencies or overwrite existing configuration merely to make the scaffold resemble a generic project template.

7. Inventory Validation Procedure

Validate the inventory against the repository checkout.

1. Enumerate tracked and relevant untracked files.
2. Compare actual paths with the inventory.
3. Identify missing, unexpected, duplicate, and obsolete entries.
4. Check for case-sensitive path errors.
5. Confirm that referenced files are not unintentionally excluded by .gitignore.
6. Review generated files and ensure secrets, private documents, and production data are absent.
7. Update the inventory after verified changes.

Distinguish tracked files, untracked working files, ignored files, and generated build artifacts when reporting counts.

8. Release Readiness

Do not declare the scaffold production-ready until the relevant implementation and deployment checks have been completed.

Status	Meaning
Planned	The file or feature is intended but has not been verified
Scaffolded	A starter file or initial implementation exists
Integrated	The component is connected to the relevant application workflow
Tested	Documented tests have been executed and their results recorded
Verified	Required functional, security, and operational checks have passed
Production-ready	Approved for deployment following the applicable release review

Assign these statuses using actual repository evidence, not file names or assumptions.

9. Maintenance Rules

* Preserve existing working files and migration history.
* Review file changes before committing.
* Continue migration numbering from the latest existing migration.
* Do not add duplicate pages or configuration files without a defined need.
* Verify external facts and links before publication.
* Keep security and privacy claims consistent with the implemented system.
* Record significant changes in CHANGELOG.md.
* Update this inventory when the repository structure changes.

10. Final Status

Current classification: Scaffold inventory requiring repository verification.

The reported total of 640 files, implementation completeness, test status, and deployment readiness remain unverified until checked against the actual repository and execution results.

The objective is a maintainable, accessible, accurate, and secure MedOrbits platform—not simply a large collection of files.