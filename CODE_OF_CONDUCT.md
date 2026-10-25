Contributing to MedOrbits

Project: MedOrbits
Website: https://medorbits.in
Document: CONTRIBUTING.md
Document Version: 1.0.0
Status: Contribution guidelines
JavaScript Runtime: Node.js 20 or later
Python Runtime: Python 3.12 or later
Package Manager: npm
Python Tooling: pytest, Ruff, mypy and Coverage.py, where installed
Primary Branch: Use the repository’s configured default branch
License: Refer to the repository’s LICENSE file

⸻

Table of Contents

1. Welcome
2. Purpose and Scope
3. Contribution Principles
4. Code of Conduct
5. Ways to Contribute
6. Before You Begin
7. Development Environment
8. Repository Structure
9. Branching Strategy
10. Issue Reporting
11. Development Workflow
12. JavaScript and Node.js Standards
13. Python Standards
14. Testing Requirements
15. Security and Privacy Requirements
16. API and Database Changes
17. Educational Content and Data Accuracy
18. Frontend and Accessibility Standards
19. Documentation Requirements
20. Commit Message Conventions
21. Pull Request Requirements
22. Code Review Process
23. Dependencies and Supply Chain
24. Continuous Integration and Quality Gates
25. Release and Changelog Requirements
26. Handling Defects and Regressions
27. Contributor Recognition
28. Questions and Support
29. Contribution Checklist
30. Governance and Maintenance

⸻

1. Welcome

Thank you for your interest in contributing to MedOrbits.

MedOrbits is a project focused on education, admissions, career guidance, recruitment and application-related services. Contributions should help improve the project’s reliability, usability, accessibility, security, accuracy and maintainability.

This document establishes a consistent workflow for proposing, implementing, testing, reviewing and documenting changes.

Contributors are expected to work collaboratively, respect project ownership and licensing requirements, protect confidential information, and provide evidence for claims about functionality, testing and security.

These guidelines apply to code, configuration, tests, documentation, educational information, datasets, website content and operational tooling.

2. Purpose and Scope

These guidelines explain how to:

* Identify and report defects.
* Propose features and improvements.
* Set up a local development environment.
* Follow the project’s coding and formatting conventions.
* Write and run appropriate tests.
* Handle security-sensitive changes responsibly.
* Submit focused commits and pull requests.
* Document compatibility and migration requirements.
* Maintain accurate release history.
* Review contributions consistently.

The instructions are intended to evolve with the repository. If a command, directory, workflow or policy described here does not match the current implementation, verify the actual repository configuration before relying on it.

2.1 Source of truth

Information	Preferred source
Project overview and setup	README.md
Contribution workflow	CONTRIBUTING.md
Release history	CHANGELOG.md
Security reporting	SECURITY.md
License and permissions	LICENSE
JavaScript dependencies	package.json and package-lock.json
Python tool configuration	pyproject.toml and pytest.ini
API contracts	Current API specification and implementation
Database migrations	Actual migration files and migration documentation
CI checks	Repository workflow configuration
Official admissions information	Relevant official authority or institution

A reference to a file in this table does not independently establish that the file exists or that its contents are current.

3. Contribution Principles

All contributions should follow these principles.

Principle	Expected practice
Correctness	Make changes that solve the stated problem without introducing unrelated regressions
Security	Apply appropriate validation, authentication, authorization and data-protection controls
Privacy	Minimize collection, exposure and retention of personal information
Accessibility	Build interfaces that can be used across devices and assistive technologies
Reliability	Handle errors predictably and test important failure paths
Maintainability	Prefer clear, modular and documented implementations
Compatibility	Assess the effect on existing APIs, users, data and integrations
Evidence	Report only tests, reviews and results that actually occurred
Traceability	Connect changes to relevant issues, requirements or review records
Professionalism	Communicate respectfully and respond constructively to review feedback

3.1 Keep contributions focused

A contribution should have a clear objective.

Avoid combining unrelated changes such as a security fix, a full redesign, dependency upgrades and broad formatting changes in one pull request unless they are genuinely interdependent.

Focused changes are easier to review, test, diagnose and revert.

4. Code of Conduct

Contributors are expected to maintain a respectful and constructive environment.

Acceptable participation includes:

* Discussing technical disagreements professionally.
* Providing actionable feedback.
* Respecting different levels of experience.
* Explaining the rationale for requested changes.
* Protecting private information.
* Acknowledging errors and correcting them transparently.

Unacceptable behavior includes harassment, discriminatory conduct, threats, deliberate disruption, impersonation, unauthorized disclosure of confidential information and repeated abusive communication.

Follow the project’s CODE_OF_CONDUCT.md and its reporting procedure if one is established. Do not assume a particular reporting contact exists unless it has been verified.

5. Ways to Contribute

Contributions may include:

Contribution type	Examples
Bug fixes	Correct broken functionality, validation defects or regressions
Features	Add useful pages, APIs, workflows or application capabilities
Security	Improve authorization, input validation, secret handling or dependency hygiene
Testing	Add unit, integration, regression, contract or accessibility tests
Documentation	Improve setup instructions, architecture notes and API references
Educational content	Correct or improve sourced admissions and career information
Accessibility	Improve keyboard navigation, focus behavior and semantic markup
Performance	Reduce measured latency, resource use or unnecessary work
Developer tooling	Improve linting, formatting, test discovery or CI diagnostics
Data quality	Improve schemas, consistency checks and source traceability
Operations	Improve deployment validation, monitoring and recovery documentation

Before undertaking substantial work, look for an existing issue, related implementation or documented requirement. For large changes, obtain maintainer feedback on scope before investing significant effort.

6. Before You Begin

Before contributing:

1. Read this document and the relevant project documentation.
2. Review the repository’s current branch and working-tree state.
3. Search for existing issues or implementations related to the proposed change.
4. Identify the affected application components.
5. Consider security, privacy, accessibility and compatibility implications.
6. Determine which tests and validation checks are appropriate.
7. Confirm that the intended contribution is permitted under the applicable license and ownership requirements.

6.1 Changes requiring early coordination

Discuss the scope with a maintainer before making substantial changes to:

* Public APIs or response contracts.
* Authentication and authorization.
* Applicant document access or storage.
* Database schema or migration behavior.
* Dependency or runtime requirements.
* Deployment architecture or secret management.
* Official admissions, eligibility or fee information.
* Licensing, ownership or redistribution terms.

Coordination does not guarantee acceptance, but it can reduce duplicated effort and prevent incompatible design decisions.

7. Development Environment

7.1 Prerequisites

The following tools are expected for the corresponding development tasks.

Tool	Requirement	Purpose
Node.js	Version 20 or later	JavaScript runtime
npm	Version compatible with the selected Node.js installation	JavaScript package management
Python	Version 3.12 or later	Python application and quality tooling
Git	Compatible installed version	Source control
pytest	Installed in the active Python environment	Test execution
Ruff	Installed in the active Python environment	Python linting and formatting
mypy	Installed if static type checking is required	Python type analysis
Coverage.py / pytest-cov	Installed if coverage reporting is required	Coverage measurement

Check installed versions:

node —version
npm —version
python —version
git —version

Check Python tools when installed:

python -m pytest —version
python -m ruff —version
python -m mypy —version
python -m coverage —version

Use python3 instead of python on systems where that is the configured Python 3 executable.

7.2 Clone the repository

Use the repository’s actual canonical URL and access method.

git clone <REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>

Replace both placeholders with the verified repository URL and directory. Do not publish credentials in a clone URL.

7.3 Inspect the working tree

Before changing files:

git status —short
git branch —show-current
git log -5 —oneline

If you have existing uncommitted work, preserve it. Do not overwrite or discard unrelated changes while following this guide.

7.4 Install JavaScript dependencies

From the repository root:

npm ci

Use npm ci when a valid, complete package-lock.json is available and consistent with package.json.

If the lockfile is missing or needs intentional regeneration, review the project dependency policy and use:

npm install

Review changes to package-lock.json before committing them. Do not manually invent resolved package versions or integrity hashes.

7.5 Set up Python tooling

Create a virtual environment:

python -m venv .venv

Activate it on Linux or macOS:

source .venv/bin/activate

Activate it in Windows PowerShell:

.\.venv\Scripts\Activate.ps1

Install the project’s declared Python development dependencies if a suitable dependency file exists. For example:

python -m pip install -r requirements-dev.txt

If the repository does not contain requirements-dev.txt, do not assume that file exists. Consult the actual dependency configuration before installing packages.

Keep the virtual environment out of version control.

8. Repository Structure

MedOrbits may contain JavaScript, Python, HTML, CSS, JSON, API specifications, documentation and operational configuration.

Use the actual repository layout when implementing changes.

Area	Typical responsibility
Root configuration	Project metadata, dependency management and quality-tool configuration
server.js	Node.js application entry point, subject to the actual implementation
scripts/	Development and validation utilities
python/	Python source and associated tests
python/tests/	Python test suite, where configured
api/	API implementation, schemas or specifications, depending on current structure
assets/	Static assets and client-side resources, where present
pages/	Website pages, where present
docs/	Technical and operational documentation
.github/	Repository workflows and contribution templates, where configured

These are organizational examples, not a guarantee that every path exists.

8.1 Placement rules

* Put new files in the directory that matches their responsibility.
* Avoid duplicate implementations of the same functionality.
* Reuse established helpers and conventions when appropriate.
* Do not add generated files or build artifacts unless explicitly required.
* Keep secrets, local credentials and private data out of the repository.
* Update related tests, schemas and documentation when behavior changes.
* Avoid introducing a new framework or dependency for a problem that can be solved safely with existing project tools.

9. Branching Strategy

Use the repository’s actual branch protection and review policy. If no more specific naming convention exists, the following names are recommended.

Work type	Suggested branch prefix	Example
New feature	feature/	feature/admission-search
Bug fix	fix/	fix/form-validation
Security fix	security/	security/document-access
Documentation	docs/	docs/setup-guide
Tests	test/	test/api-regressions
Refactoring	refactor/	refactor/config-loading
Maintenance	chore/	chore/python-tooling

Create a branch from the repository’s current default branch after synchronizing with the remote.

git fetch origin
git switch <DEFAULT_BRANCH>
git pull —ff-only
git switch -c feature/short-description

Replace <DEFAULT_BRANCH> with the verified branch name. Do not assume it is named main or master.

Keep the branch focused and update it according to the repository’s merge policy.

10. Issue Reporting

10.1 Bug reports

A useful bug report should contain:

* A concise title.
* The affected page, module, API or workflow.
* The expected behavior.
* The actual behavior.
* Reproduction steps.
* Relevant runtime and environment versions.
* Relevant error messages or sanitized logs.
* The impact and approximate frequency.
* A proposed workaround, if known.
* Whether the issue is reproducible.

Use this template:

### Summary
[Concise description of the defect.]

Environment

* Operating system:
* Node.js version:
* Python version, if relevant:
* Browser or client, if relevant:
* Application version or commit:

Steps to Reproduce

1. [First step]
2. [Second step]
3. [Observed result]

Expected Behavior

[What should happen.]

Actual Behavior

[What happens instead.]

Evidence

[Sanitized logs, screenshots or relevant test output.]

Impact

[Users, workflows or integrations affected.]

Additional Context

[Relevant references or workaround.]

Remove irrelevant fields before submitting.

10.2 Feature proposals

A feature proposal should explain:

1. The problem or user need.
2. The intended behavior.
3. The users or workflows affected.
4. The proposed scope.
5. Security, privacy and accessibility considerations.
6. Compatibility implications.
7. How success can be verified.

For large proposals, separate the initial problem statement from detailed implementation planning.

10.3 Do not include sensitive evidence

Before submitting a report, remove:

* Passwords and tokens.
* Authorization headers.
* Session cookies.
* Database connection strings.
* Personal applicant data.
* Private documents and identifying records.
* Confidential production logs.

For suspected vulnerabilities, follow SECURITY.md and use the authorized reporting channel. Do not publish exploitable details in a public issue before coordinating appropriate disclosure.

11. Development Workflow

Follow this general workflow for each contribution.

Step 1 — Understand the change

Read the relevant code, documentation, schemas and tests. Determine which behavior should change and which behavior must remain compatible.

Step 2 — Define the scope

Identify the files and components involved. Establish acceptance criteria before making broad modifications.

Step 3 — Implement the change

Use clear naming, modular functions, predictable error handling and the project’s existing patterns.

Avoid unrelated refactoring unless it is necessary for correctness or maintainability.

Step 4 — Add or update tests

Test the expected behavior and important failure paths. Add regression coverage for defects where practical.

Step 5 — Run relevant checks

Run the checks that apply to the changed components. Investigate failures rather than suppressing them without justification.

Step 6 — Review the diff

git diff —check
git diff
git status —short

Verify that the diff contains only intended changes and no credentials, unrelated files or accidental generated output.

Step 7 — Update documentation

Update the relevant documentation, API contracts, migration guidance or changelog when the change warrants it.

Step 8 — Commit and submit

Create focused commits, push the branch and open a pull request according to the repository’s actual hosting and review policy.

12. JavaScript and Node.js Standards

MedOrbits uses ES modules according to the current package.json configuration.

12.1 General standards

* Use import and export consistently with the ES module setup.
* Prefer const unless reassignment is necessary.
* Use let for values that must be reassigned.
* Avoid introducing var.
* Use clear names for variables, functions, classes and modules.
* Prefer small functions with explicit responsibilities.
* Validate untrusted input at application boundaries.
* Handle asynchronous operations and errors deliberately.
* Avoid leaking internal stack traces, secrets or database details to clients.
* Use parameterized SQL queries rather than string interpolation for user-controlled values.
* Avoid synchronous operations in request handlers when they can block application responsiveness.
* Keep configuration and secrets outside source code.
* Avoid adding dependencies without a clear justification.

12.2 Express application changes

When modifying Express routes, middleware or controllers:

* Verify that the route is registered at the intended path.
* Ensure middleware order is correct.
* Validate request parameters, query values and bodies.
* Apply authentication and authorization where required.
* Return consistent status codes and response formats.
* Forward asynchronous errors using patterns compatible with the installed Express version.
* Avoid sending multiple responses for one request.
* Do not expose internal exceptions or sensitive data.
* Add tests for both successful and rejected requests.

12.3 HTTP security

Where applicable:

* Use secure response headers.
* Configure CORS with the intended trusted origins.
* Apply rate limiting to sensitive or abuse-prone endpoints.
* Avoid overly permissive access-control policies.
* Configure secure cookies and session behavior when sessions are used.
* Verify file upload size, type and storage constraints.
* Do not rely on client-side validation alone.
* Ensure authorization is enforced on the server for every protected resource.

12.4 Syntax checks

The existing project scripts may provide:

npm run check:syntax

Run this command only after verifying that the referenced files and script exist in the current repository.

13. Python Standards

Python contributions should follow the Python version and quality configuration established by the repository.

13.1 General standards

* Target Python 3.12 or later unless the project policy changes.
* Use four spaces for indentation.
* Prefer descriptive names and small, cohesive functions.
* Use context managers for resources that require cleanup.
* Handle exceptions deliberately.
* Avoid broad exception suppression.
* Add type annotations where useful.
* Avoid mutable global state unless explicitly justified.
* Keep network, filesystem and database behavior testable.
* Use timezone-aware datetimes when representing real-world timestamps.
* Avoid hardcoded credentials and sensitive configuration.
* Document non-obvious behavior and public interfaces.

13.2 Ruff linting

Run:

python -m ruff check .

To apply supported automatic fixes intentionally:

python -m ruff check —fix .

Review the resulting diff. Automated fixes do not replace code review.

13.3 Ruff formatting

Check formatting:

python -m ruff format —check .

Format files intentionally:

python -m ruff format .

Avoid mixing large, unrelated formatting changes with a narrowly scoped bug fix.

13.4 Static type checking

When mypy is installed and configured:

python -m mypy

Address type errors when practical. If a limitation requires a type suppression, keep it narrow, explain the reason and ensure that the suppression does not conceal a genuine defect.

13.5 Security-sensitive Python code

Pay particular attention to:

* Unsafe deserialization.
* Path traversal.
* Command execution.
* SQL injection.
* Weak cryptographic usage.
* Insecure temporary files.
* Untrusted network responses.
* Uncontrolled resource consumption.
* Secret exposure through exceptions and logs.
* Insecure handling of uploaded files.

Use established libraries and safe APIs instead of creating custom security mechanisms unnecessarily.

14. Testing Requirements

Tests are an essential part of a reliable contribution.

14.1 Test categories

Test type	Purpose
Unit	Validate isolated functions or components
Integration	Validate interactions among application components
API	Validate request handling, response formats and status codes
Security	Validate access control, validation and security-sensitive behavior
Regression	Prevent recurrence of known defects
Contract	Validate API schemas and external integration expectations
Database	Validate persistence, constraints and transactional behavior
Smoke	Check essential application functionality
End-to-end	Validate a complete user workflow
Performance	Measure behavior under defined workload and conditions

Use the categories relevant to the change rather than adding unnecessary tests.

14.2 Python tests

Run the complete Python test suite:

python -m pytest

Run with detailed output:

python -m pytest -v

Collect tests without executing them:

python -m pytest —collect-only

Stop at the first failure:

python -m pytest -x

Use the configured test directory and registered markers. If the actual test layout differs from the configuration, correct the configuration or use the appropriate path rather than silently skipping tests.

14.3 Test quality requirements

Tests should:

* Have a clear purpose.
* Be deterministic where practical.
* Avoid relying on execution order.
* Clean up resources they create.
* Use isolated test data.
* Avoid production databases and real user accounts.
* Avoid external network dependencies unless required.
* Use obviously fake credentials.
* Cover relevant failure and boundary conditions.
* Assert observable behavior rather than implementation details unnecessarily.

Do not delete, skip or weaken a test solely to make a build pass.

14.4 Coverage

If Coverage.py and pytest-cov are installed:

python -m pytest —cov=python —cov-branch —cov-report=term-missing

The repository’s coverage configuration may require a minimum overall coverage threshold.

Coverage is a useful measurement, but it does not establish that a feature is correct, secure or comprehensively tested. Prioritize meaningful assertions and critical paths over superficial line coverage.

14.5 Integration testing

Integration tests may require a dedicated database or test service.

Before running them:

* Confirm the target environment.
* Use test-only credentials.
* Verify that the test database is isolated from production.
* Avoid destructive operations against shared environments.
* Clean up created records when appropriate.
* Record external dependencies and setup requirements.

Do not claim that integration tests passed if they were skipped or could not connect to the required service.

15. Security and Privacy Requirements

Security and privacy must be considered throughout development, not added only before release.

15.1 Secret management

Never commit:

* Passwords.
* API keys.
* Access tokens.
* Private keys.
* Production database credentials.
* Session secrets.
* Cloud provider credentials.
* Sensitive environment files.

Use environment variables or an approved secret-management mechanism. Commit only safe example configuration with clearly fake placeholder values.

If a secret is exposed, remove it from the affected location, follow the appropriate rotation procedure and report the incident through the authorized channel. Deleting a secret from the latest commit alone does not guarantee that it has been removed from repository history or other copies.

15.2 Authentication and authorization

For protected operations:

* Verify the identity of the caller.
* Enforce permissions on the server.
* Check resource ownership or access rights where required.
* Deny access by default when authorization cannot be established.
* Avoid relying on hidden buttons or client-side restrictions.
* Test unauthorized, unauthenticated and cross-user access attempts.
* Prevent insecure direct object references.
* Ensure administrative operations receive appropriate protection.

15.3 Personal data and documents

When handling application records or uploaded documents:

* Collect only information required for the documented purpose.
* Restrict access to authorized users.
* Validate uploads and enforce size limits.
* Avoid exposing private files through public URLs.
* Use safe storage and access-control mechanisms.
* Avoid logging document contents or sensitive identifiers.
* Follow the applicable retention and deletion policy.
* Use synthetic data in development and automated tests.

15.4 Vulnerability reporting

Follow SECURITY.md for reporting suspected vulnerabilities.

Do not publish confidential vulnerability details or exploit instructions in public pull requests or issues before appropriate disclosure has been coordinated.

Do not claim that a vulnerability is fully resolved until the fix and relevant verification support that conclusion.

16. API and Database Changes

API and database changes may affect existing users, integrations and stored records.

16.1 API contributions

For API changes:

* Update the relevant schema or specification when applicable.
* Validate request and response fields.
* Document authentication and authorization requirements.
* Preserve compatibility unless a breaking change is intentional.
* Use consistent error responses.
* Add tests for success, validation failure and authorization failure.
* Avoid exposing internal implementation details.
* Document new configuration requirements.

16.2 Database contributions

For schema and migration changes:

* Use the repository’s established migration mechanism.
* Avoid undocumented manual production changes.
* Preserve data integrity.
* Review constraints, indexes and relationships.
* Test migrations against representative data.
* Document migration ordering and prerequisites.
* Assess backup and rollback requirements.
* Avoid destructive changes without an explicit, reviewed plan.

Do not claim a migration is reversible unless its rollback behavior has been evaluated.

16.3 Breaking changes

A breaking change may include:

* Removing or renaming an API field.
* Changing an endpoint or response contract.
* Altering required configuration.
* Modifying database schemas incompatibly.
* Changing authentication or authorization requirements.
* Removing a supported page or workflow.
* Raising the minimum supported runtime.

Document who is affected, what action is required and how the new behavior can be verified.

17. Educational Content and Data Accuracy

MedOrbits may publish information about education, admissions, examinations, careers and institutions.

Contributions affecting this information must prioritize accuracy, source traceability and clear communication.

17.1 Source requirements

When updating time-sensitive or institution-specific information:

* Consult the relevant official authority or institution.
* Record the source and date checked where appropriate.
* Distinguish confirmed requirements from provisional information.
* Verify dates, eligibility criteria, fees and application conditions.
* Avoid unsupported claims about admissions or recruitment outcomes.
* Identify material changes that may affect existing users.
* Update related datasets and pages consistently.

17.2 Official information

Do not present content as an official institutional announcement unless the relevant institution issued or authorized it.

Do not fabricate:

* Admission dates.
* Eligibility requirements.
* Examination results.
* Fee schedules.
* Institutional approvals.
* Seat availability.
* Job openings.
* Scholarship awards.
* Application status.

When a source is unclear or conflicting, document the uncertainty and request review instead of guessing.

17.3 Data changes

For structured data, consider:

* Schema compatibility.
* Required and optional fields.
* Data validation.
* Duplicate and missing records.
* Source attribution.
* Effective dates.
* Downstream consumers.
* Migration requirements.

Never include real applicant information in public examples or test fixtures.

18. Frontend and Accessibility Standards

Frontend contributions should provide a consistent, usable experience across supported screen sizes and interaction methods.

18.1 General standards

* Use semantic HTML where applicable.
* Maintain readable text and appropriate contrast.
* Keep forms understandable and label their inputs.
* Provide useful error and success messages.
* Avoid unnecessary layout shifts.
* Ensure layouts work on mobile, tablet and desktop.
* Avoid horizontal overflow at supported viewport sizes.
* Preserve keyboard access to interactive controls.
* Use appropriate loading and empty states.
* Avoid exposing sensitive information in page markup or client-side storage.

18.2 Accessibility

Where relevant:

* Use correct heading hierarchy.
* Provide accessible names for controls.
* Ensure keyboard navigation and visible focus.
* Associate form errors with the corresponding fields.
* Use meaningful alternative text for informative images.
* Respect reduced-motion preferences.
* Avoid conveying important status through color alone.
* Test dialog, menu and dynamic content behavior.
* Use appropriate labels, landmarks and semantic elements.

Do not claim full accessibility conformance without appropriate evaluation.

18.3 Visual consistency

Follow the project’s established design system, tokens and reusable components. Avoid introducing conflicting color systems, typography scales or interaction patterns without a clear reason.

Visual changes should not compromise legibility, accessibility, responsive behavior or security.

19. Documentation Requirements

Update documentation when a change materially affects setup, behavior, maintenance, compatibility, security or operational procedures.

Change	Documentation to consider
New feature	User guidance and relevant technical documentation
API change	API specification, examples and compatibility notes
Configuration change	Environment variable documentation and setup instructions
Database change	Migration guide and recovery instructions
Security change	Appropriate security and operational documentation
Dependency change	Installation requirements and compatibility notes
Test change	Test setup, fixtures and execution instructions
Breaking change	Upgrade steps and affected workflows
Content correction	Relevant authoritative source and verification date
Release	CHANGELOG.md and verified release references

Documentation should describe the actual implementation, not an intended future state.

Avoid adding empty placeholders, broken links, invented contact addresses or instructions that depend on nonexistent scripts.

20. Commit Message Conventions

Use concise, descriptive commit messages. If the repository does not enforce a different convention, the following format is recommended:

type(scope): short description

20.1 Suggested types

Type	Use
feat	New functionality
fix	Defect correction
docs	Documentation changes
test	Test additions or changes
refactor	Internal restructuring without intended behavior changes
perf	Performance improvements
security	Security-related changes
build	Build or dependency configuration
ci	Continuous integration changes
chore	Routine maintenance
style	Formatting-only changes that do not alter behavior

Examples:

feat(api): add application status endpoint
fix(auth): enforce ownership checks for documents
docs(contributing): clarify local test setup
test(python): cover invalid application payloads
security(files): validate uploaded document types
build(deps): update reviewed dependency constraints

These are examples of the naming convention, not claims that the corresponding changes exist.

20.2 Commit quality

* Keep commits focused.
* Use the imperative mood where practical.
* Avoid vague messages such as changes, update or final fix.
* Reference an issue only when its identifier is verified.
* Do not include secrets or personal data in commit messages.
* Avoid combining unrelated formatting and functional changes.
* Do not rewrite shared history unless permitted by the repository’s workflow.

21. Pull Request Requirements

A pull request should explain the change, its impact and the verification performed.

21.1 Pull request description

Use this template:

## Summary

* [Describe the primary change.]
* [Explain the reason for the change.]

Related Issue

* [Verified issue reference, if applicable.]

Scope

* [Affected components, pages, APIs or workflows.]

Implementation

* [Summarize the approach and relevant design decisions.]

Testing

* [List the commands actually run.]
* [Describe the results and any skipped checks.]

Security and Privacy

* [Describe relevant considerations or state that none were identified.]

Compatibility and Migration

* [Describe breaking changes, migration requirements or state that none were identified.]

Documentation

* [List the documentation updated.]

Screenshots or Evidence

* [Add appropriate evidence for visual or behavioral changes.]

Known Limitations

* [Identify unresolved issues or unverified behavior.]

Checklist

* [ ]	The change is focused and ready for review.
* [ ]	Relevant tests have been added or updated.
* [ ]	Applicable checks have been run.
* [ ]	No secrets or confidential information are included.
* [ ]	Documentation has been updated where required.
* [ ]	Compatibility and migration effects have been considered.
* [ ]	Changelog updates have been considered.

Remove sections that are irrelevant to the proposed change.

21.2 Pull request expectations

* Keep the change reasonably scoped.
* Explain unusual implementation decisions.
* Include reproduction steps for defect fixes where useful.
* Include screenshots for meaningful visual changes.
* Include tests for changed behavior.
* Identify any checks that could not be run.
* Document known limitations.
* Resolve review feedback before requesting final approval.

Do not report tests as passing unless they were actually executed successfully.

22. Code Review Process

Reviewers should assess contributions for correctness, maintainability, security, compatibility and scope.

22.1 Review criteria

Area	Review question
Correctness	Does the change solve the stated problem?
Scope	Are unrelated modifications avoided?
Design	Is the implementation understandable and maintainable?
Tests	Are important success and failure paths covered?
Security	Are input validation and access controls appropriate?
Privacy	Is sensitive information handled safely?
Compatibility	Could existing users or integrations be affected?
Data integrity	Are migrations and validation rules safe?
Accessibility	Are relevant usability and accessibility requirements met?
Documentation	Are instructions and claims accurate?
Operations	Are configuration, deployment and recovery implications addressed?

22.2 Review etiquette

* Explain blocking issues clearly.
* Distinguish required changes from suggestions.
* Ask questions when intent is unclear.
* Avoid personal or dismissive comments.
* Do not request unnecessary refactoring unrelated to the change.
* Re-review updates that materially change implementation or behavior.

Passing automated checks does not automatically mean a contribution is approved. Conversely, a review approval does not replace required tests or deployment verification.

23. Dependencies and Supply Chain

Dependencies affect security, compatibility, performance and maintainability.

Before adding or upgrading a dependency:

1. Confirm that the dependency is necessary.
2. Check whether an existing project dependency already provides the capability.
3. Review maintenance activity and compatibility requirements.
4. Check applicable licensing terms.
5. Review relevant known vulnerabilities.
6. Assess transitive dependency impact.
7. Update the appropriate manifest and lockfile.
8. Run applicable tests and validation.
9. Document significant compatibility or configuration changes.

23.1 npm dependency policy

* Keep package.json and package-lock.json consistent.
* Prefer reproducible installations with npm ci in CI when the lockfile is valid.
* Do not manually fabricate lockfile resolution or integrity metadata.
* Review lockfile changes before committing.
* Avoid using npm audit fix —force without understanding the resulting major-version changes.
* Do not commit node_modules/.
* Keep runtime and development dependencies appropriately separated if the project adopts that structure.

23.2 Python dependency policy

Use the dependency-management approach established by the repository. Do not add dependencies to an unrelated file merely because it is convenient.

Review compatibility and security implications, and keep local virtual environments and generated package artifacts out of version control.

24. Continuous Integration and Quality Gates

Contributions should pass the checks required by the actual repository workflow.

24.1 Suggested local validation sequence

For a typical MedOrbits change, run the relevant checks.

JavaScript syntax:

npm run check:syntax

JSON validation:

npm run check:json

Python tests:

npm test

Python linting:

npm run lint:python

Python formatting:

npm run format:python:check

Python type checking, if configured:

npm run typecheck:python

Combined validation, if defined by package.json:

npm run validate

Strict validation, if defined:

npm run validate:strict

These commands depend on the corresponding scripts and tools being present. Verify the actual package.json, pyproject.toml and pytest.ini before relying on a particular command.

24.2 Interpreting results

Result	Required response
Check passes	Record the result accurately
Check fails	Investigate and correct the underlying issue
Check is skipped	Explain why it was not run
Required dependency is missing	Install the approved development dependency
External service is unavailable	Record the limitation and arrange the required validation
Existing unrelated failure occurs	Document the failure and distinguish it from the contribution
Security check reports a finding	Review the finding; do not dismiss it without justification

Do not weaken global quality rules solely to make a contribution pass. Prefer fixing the code or adding a narrow, justified exception where appropriate.

25. Release and Changelog Requirements

Significant changes should be considered for inclusion in CHANGELOG.md.

25.1 Changes worth documenting

* New user-facing features.
* Behavior changes and defect fixes.
* Security and privacy improvements.
* Breaking API or workflow changes.
* Database migrations.
* Material dependency and runtime changes.
* Educational content corrections.
* Operational and deployment changes.
* Significant documentation and developer-tooling improvements.

25.2 Changelog accuracy

* Use the established date and version conventions.
* Do not invent release versions or dates.
* Distinguish unreleased changes from formally released changes.
* Document breaking changes and migration steps.
* Avoid publishing sensitive security details.
* Remove irrelevant categories from finalized release entries.
* Verify all links and references.

A merged pull request is not automatically a published release. Record the actual release status.

26. Handling Defects and Regressions

When a contribution introduces or reveals a defect:

1. Reproduce the behavior where possible.
2. Identify the affected component and likely cause.
3. Assess impact, including security and data integrity.
4. Add a regression test where practical.
5. Implement a focused correction.
6. Run the relevant tests and quality checks.
7. Document remaining limitations.
8. Follow the appropriate incident or disclosure process if the issue is security-sensitive.

26.1 Regression prevention

A regression test should fail when the defect is present and pass when the correction is applied.

Avoid tests that merely reproduce the implementation’s internal details without validating the required behavior.

For serious defects, consider whether related interfaces or workflows need additional testing.

27. Contributor Recognition

MedOrbits may recognize contributions according to project policy and applicable legal requirements.

Contributors should not assume that submission guarantees acceptance, public attribution, compensation, employment or ownership rights beyond the applicable written agreements and license terms.

Do not add another person’s name, endorsement, signature or affiliation to project materials without appropriate authorization.

28. Questions and Support

Before requesting assistance:

* Review the README and relevant documentation.
* Search for an existing issue or discussion.
* Provide a concise description of the problem.
* Include sanitized error output and reproduction steps.
* Identify the affected component and relevant environment.
* Explain what you have already tried.

Use the repository’s verified issue tracker or designated support channel.

Do not invent or rely on an unverified email address, reporting URL or support contact. Security-sensitive reports must follow SECURITY.md rather than a general public discussion channel.

29. Contribution Checklist

Use this checklist before submitting a pull request.

Preparation

* [ ]	I reviewed the relevant project documentation.
* [ ]	I checked for related issues or existing implementations.
* [ ]	I understand the scope and acceptance criteria.
* [ ]	I used the correct repository branch and preserved unrelated work.

Implementation

* [ ]	My changes are focused and maintainable.
* [ ]	I followed the applicable JavaScript or Python conventions.
* [ ]	I considered error handling and input validation.
* [ ]	I considered security and privacy implications.
* [ ]	I avoided unnecessary dependencies and unrelated refactoring.

Testing

* [ ]	I added or updated relevant tests.
* [ ]	I ran the applicable checks that were available.
* [ ]	I reviewed test failures and skipped checks.
* [ ]	I did not weaken tests simply to obtain a passing result.
* [ ]	I documented limitations that could not be verified.

Documentation

* [ ]	I updated relevant documentation.
* [ ]	I considered whether CHANGELOG.md needs an entry.
* [ ]	I documented breaking changes and migration requirements.
* [ ]	I verified links and factual claims.
* [ ]	I did not include unsupported release or deployment claims.

Security and privacy

* [ ]	I did not commit secrets or credentials.
* [ ]	I did not include private applicant information.
* [ ]	I considered authorization and data access where applicable.
* [ ]	I used synthetic or appropriately sanitized test data.

Submission

* [ ]	My commit messages are descriptive.
* [ ]	I reviewed the complete diff.
* [ ]	My pull request explains the change and its impact.
* [ ]	My test results accurately reflect what I ran.
* [ ]	I am prepared to address review feedback.

Do not mark a checklist item complete unless it has actually been performed.

30. Governance and Maintenance

These contribution guidelines should evolve with the MedOrbits repository, tooling and release process.

Maintainers should review this document when:

* The supported Node.js or Python version changes.
* The package manager or dependency-management strategy changes.
* New test or quality tools are adopted.
* The repository layout changes materially.
* Security or privacy procedures change.
* API, database or release policies change.
* The contribution or review workflow changes.

30.1 Policy precedence

If this document conflicts with applicable law, the repository’s governing license, a verified security policy or an explicitly approved project requirement, the applicable governing requirement takes precedence.

Where a conflict exists between a suggested command in this document and the actual repository configuration, verify the intended workflow with the maintainers and update the documentation.

30.2 Document maintenance

Field	Value
Document	CONTRIBUTING.md
Project	MedOrbits
Document version	1.0.0
Runtime baseline	Node.js 20+
Python baseline	Python 3.12+
Review trigger	Material changes to development or contribution practices
Maintenance owner	Authorized MedOrbits project maintainers
Verification requirement	Confirm instructions against the current repository

⸻

Thank you for helping improve MedOrbits. Contributions that are focused, tested, secure, accessible and accurately documented help keep the project reliable and maintainable.

End of MedOrbits Contribution Guidelines.