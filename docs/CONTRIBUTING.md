MedOrbits — Contribution Guide

Build with purpose. Contribute with care. Create impact that travels further.

Welcome to MedOrbits — a digital platform designed to make educational resources, medical admissions information, career guidance, official documents, and student support more accessible and useful.

Every meaningful improvement matters. Whether you are correcting a factual error, improving a mobile layout, strengthening an API, refining a dataset, fixing a security weakness, or introducing a new capability, your contribution can make the platform more reliable for the people who depend on it.

This guide explains how to contribute consistently, safely, and professionally.

⸻

Contents

1. Our Mission
2. Contribution Philosophy
3. Who Can Contribute
4. Before You Begin
5. Repository Orientation
6. Getting Started Locally
7. Choose the Right Contribution
8. Git Branching and Workflow
9. Commit Message Standards
10. Code Quality Standards
11. Frontend and Design Contributions
12. Backend and API Contributions
13. Data and Official Information Contributions
14. Documentation Contributions
15. Testing Requirements
16. Security and Privacy Rules
17. Pull Request Process
18. Issue Reporting
19. Review and Acceptance Criteria
20. Release and Deployment Responsibilities
21. Accessibility and Inclusive Design
22. Community Standards
23. Contributor Recognition
24. Frequently Asked Questions
25. Contribution Checklist

⸻

1. Our Mission

MedOrbits aims to bring education, medical admissions guidance, official resources, consultancy services, and career opportunities into a more coherent digital experience.

Our contribution standards are built around five priorities:

Principle	What it means
Accuracy	Information must be verifiable, especially when it affects admissions, eligibility, fees, or deadlines.
Accessibility	People should be able to use the platform across devices, abilities, and supported languages.
Reliability	Features should behave predictably and handle failures gracefully.
Security	User accounts, applications, documents, and transactions must be protected.
Clarity	Interfaces, code, documentation, and communication should be understandable and maintainable.

Our standard: A contribution is successful when it improves the experience without introducing avoidable risk, confusion, or maintenance burden.

2. Contribution Philosophy

We value thoughtful improvements over unnecessary complexity.

Build for real needs

Every new feature should solve a defined problem. Before introducing a large component, dependency, service, or abstraction, explain why it is necessary and how it fits the existing architecture.

Improve before duplicating

Look for existing utilities, design tokens, components, data models, and services before creating replacements.

Make changes traceable

A reviewer should be able to understand what changed, why it changed, how it was tested, and what risks remain.

Respect the existing system

Preserve working routes, public interfaces, data contracts, established visual conventions, and backward compatibility unless a deliberate migration is approved.

Prefer maintainable solutions

Choose clear, modular implementations over clever but difficult-to-maintain code. Avoid introducing unnecessary dependencies or duplicating business logic.

Verify before publishing

Educational and admission-related information must be supported by credible sources. Technical changes must be tested against the actual implementation.

⸻

3. Who Can Contribute

Contributions may come from:

* Frontend developers.
* Backend and API developers.
* UI/UX designers.
* Accessibility specialists.
* QA engineers and testers.
* Data and content reviewers.
* Technical writers.
* Security researchers using authorised reporting channels.
* Students and community members who identify practical improvements.

You do not need to contribute code to make a useful contribution. Documentation improvements, reproducible bug reports, verified corrections, accessibility feedback, and well-researched feature proposals are valuable.

All contributors must follow the applicable licence, repository permissions, security rules, and community standards.

4. Before You Begin

Before starting substantial work:

1. Read this guide.
2. Review the repository’s root README.md and existing project instructions.
3. Inspect the relevant implementation rather than relying exclusively on documentation.
4. Search existing issues and pull requests for related work.
5. Identify the intended scope and acceptance criteria.
6. Confirm that you have permission to modify the relevant repository or branch.
7. Check whether the proposed change affects data contracts, security, deployment, or user-facing behaviour.

For substantial features, create or discuss an issue before investing in a large implementation.

For small corrections, such as a typo or a narrowly scoped bug fix, a concise pull request may be sufficient.

Project documentation

Use the documentation that is present and current in the repository. Relevant references may include:

* docs/ARCHITECTURE.md
* docs/API_REFERENCE.md
* docs/DATABASE_SCHEMA.md
* docs/DEPLOYMENT.md
* docs/DATA_VERIFICATION.md
* docs/PRIVACY.md
* docs/SECURITY.md
* docs/SUPPORT_GUIDE.md
* docs/TESTING.md

These filenames describe the intended documentation set. Verify that each file exists and reflects the current implementation before relying on it as an authoritative specification.

⸻

5. Repository Orientation

MedOrbits may contain frontend pages, reusable assets, public datasets, backend services, configuration, and documentation.

A possible organisation is shown below. Treat it as an orientation aid, not a requirement to restructure the repository.

MedOrbits/
├── assets/
│   ├── css/
│   ├── js/
│   ├── images/
│   ├── icons/
│   └── data/
├── pages/
├── support/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── tests/
├── docs/
├── server.js
├── package.json
└── README.md

The actual project may use a different structure. Follow the established organisation unless a structural change has a clear technical justification.

General ownership boundaries

* Pages and UI: Presentation, navigation, content hierarchy, and user interactions.
* Assets: Shared styles, scripts, images, icons, and approved public resources.
* Data: Validated public datasets and documented data contracts.
* Routes and controllers: HTTP request handling and response coordination, where applicable.
* Services: Reusable business logic and external-service integrations.
* Models and repositories: Data persistence and access patterns, where applicable.
* Middleware: Cross-cutting concerns such as authentication, validation, and rate limiting.
* Tests: Automated checks and reproducible test cases.
* Documentation: Setup instructions, contracts, policies, workflows, and maintenance guidance.

Do not introduce a new layer merely to follow this example. Use the architecture that the application actually supports.

6. Getting Started Locally

Prerequisites

Confirm the project’s required versions and tools before installation.

Typical requirements for a Node.js-based implementation may include:

* Git.
* Node.js compatible with the project’s engines requirement.
* npm or the package manager indicated by the lockfile.
* A supported database, if required.
* Environment variables documented by the project.
* A modern browser for frontend testing.

Step 1 — Obtain the repository

If you have repository access, clone it:

git clone <REPOSITORY_URL>
cd <REPOSITORY_DIRECTORY>

Replace the placeholders with the actual repository URL and directory.

If you are contributing through a fork, clone your fork and configure the original repository as an upstream remote according to your hosting platform’s workflow.

Step 2 — Install dependencies

For an npm project with a committed package-lock.json:

npm ci

Use the package manager and lockfile already adopted by the project. Do not regenerate or replace the lockfile without a deliberate dependency change.

Step 3 — Configure the environment

Review .env.example, the README, or the project’s configuration documentation.

Create a local environment file only if the application expects one. Use local or sandbox credentials and keep the file out of version control.

Never copy production secrets into a development environment.

Step 4 — Start the application

Use the scripts defined in package.json. For example, if the project provides these scripts:

npm run dev

or:

npm start

Do not assume either command exists. Inspect the actual scripts first.

Step 5 — Verify the baseline

Before making changes:

* Confirm that the application starts.
* Open the relevant page or endpoint.
* Check for existing errors.
* Run the existing test suite, if available.
* Record any baseline failures that are unrelated to your contribution.

A baseline check helps distinguish newly introduced regressions from pre-existing issues.

⸻

7. Choose the Right Contribution

Select the contribution type that best matches the problem.

<details>
<summary>Frontend and UI improvements</summary>

Examples:

* Responsive layout fixes.
* Navigation and interaction improvements.
* Form validation and error-state design.
* Accessibility enhancements.
* Performance improvements.
* Reusable components and design-system refinements.

Include screenshots or a short recording when visual changes are difficult to explain in text. Test the relevant viewport sizes and interaction states.

</details>
<details>
<summary>Backend and API improvements</summary>

Examples:

* Request validation.
* Authentication and authorisation fixes.
* Error-handling improvements.
* Database query optimisation.
* Safe service integrations.
* API contract corrections.

Include tests for successful requests, invalid input, unauthorised access, and relevant failure conditions.

</details>
<details>
<summary>Data and content corrections</summary>

Examples:

* Correcting outdated resource links.
* Updating verified admission information.
* Fixing inconsistent course metadata.
* Improving data provenance and review dates.
* Correcting duplicate or invalid records.

Provide the source, the date checked, the affected records, and a clear explanation of the correction. Do not make unsupported factual claims.

</details>
<details>
<summary>Documentation and developer experience</summary>

Examples:

* Improving installation instructions.
* Documenting existing API behaviour.
* Adding troubleshooting procedures.
* Clarifying configuration variables.
* Writing reproducible testing instructions.
* Correcting outdated architectural descriptions.

Ensure the instructions match the actual repository and do not expose credentials or internal operational secrets.

</details>
<details>
<summary>Testing and quality assurance</summary>

Examples:

* Reproducible bug reports.
* Regression tests.
* API contract tests.
* Accessibility checks.
* Browser compatibility checks.
* Performance measurements.

Include the environment, steps, expected result, actual result, and relevant non-sensitive evidence.

</details>

⸻

8. Git Branching and Workflow

Use focused branches and small, reviewable changes.

Recommended branch naming

Contribution	Example
Feature	feat/course-search-filters
Bug fix	fix/document-upload-validation
Documentation	docs/contribution-guide
Refactoring	refactor/resource-loader
Testing	test/application-status-flow
Security	security/document-access-check
Performance	perf/dataset-loading

Use the repository’s established naming convention if one exists.

Standard workflow

1. Start from the correct base branch.
2. Update your local branch.
3. Create a descriptive working branch.
4. Make the smallest coherent set of changes.
5. Run relevant checks.
6. Review the diff for accidental changes and sensitive information.
7. Commit with a meaningful message.
8. Push the branch.
9. Open a pull request.
10. Address review feedback and re-run relevant tests.

Example commands:

git status
git switch <BASE_BRANCH>
git pull —ff-only
git switch -c feat/descriptive-change

After making changes:

git diff —check
git diff
git status

Then stage and commit only the intended files:

git add <FILE_PATHS>
git commit -m “feat: describe the improvement”
git push -u origin feat/descriptive-change

Replace placeholders with actual branch names and file paths.

Branch safety

* Do not commit directly to a protected production branch unless the project explicitly authorises that workflow.
* Do not force-push shared branches without coordinating with affected contributors.
* Do not rewrite shared history without permission.
* Do not commit generated files, build output, logs, local databases, or environment secrets unless the project explicitly requires them.
* Do not bundle unrelated refactoring with a narrowly scoped fix.

⸻

9. Commit Message Standards

Use concise, descriptive commit messages. The following Conventional Commits style is recommended where it fits the project’s workflow.

Format:

<type>(optional-scope): <short description>

Examples:

feat(search): add course category filtering
fix(documents): validate uploaded file size
docs(api): clarify application response fields
test(auth): cover expired sessions
refactor(resources): centralise URL validation
perf(home): reduce unnecessary asset loading
security(access): enforce document ownership
chore(deps): update approved dependency

Common types:

* feat — new capability.
* fix — defect correction.
* docs — documentation changes.
* test — tests or test infrastructure.
* refactor — restructuring without intended behaviour change.
* perf — performance improvement.
* security — security-related changes.
* build — build system or dependency tooling.
* ci — continuous integration configuration.
* chore — maintenance tasks.

Commit quality

A good commit:

* Describes one coherent change.
* Uses the imperative or a concise action-oriented description.
* Avoids vague messages such as updates, changes, or final code.
* Does not contain unrelated modifications.
* Includes appropriate tests when behaviour changes.

If a change is breaking, document the compatibility impact and migration requirements in the commit or pull request.

⸻

10. Code Quality Standards

General rules

* Prefer readable, modular code.
* Reuse established project utilities and components.
* Keep functions focused on one responsibility.
* Use meaningful names for variables, functions, classes, and files.
* Handle expected errors explicitly.
* Avoid unnecessary global state and hidden side effects.
* Validate external input at system boundaries.
* Keep configuration separate from application logic.
* Remove obsolete code only when its removal is understood and tested.
* Avoid adding dependencies when existing capabilities are sufficient.
* Document non-obvious decisions and important constraints.

JavaScript

* Follow the existing module system and formatting conventions.
* Avoid implicit global variables.
* Prefer const unless reassignment is needed; use let when appropriate.
* Use strict comparisons where suitable.
* Handle promises and asynchronous failures explicitly.
* Avoid swallowing errors without recording a useful, non-sensitive outcome.
* Avoid rendering untrusted content as executable HTML.
* Clean up event listeners, timers, and observers when required.
* Keep browser-only APIs out of code paths that execute in Node.js unless guarded appropriately.

HTML and CSS

* Use semantic HTML.
* Associate form controls with labels.
* Use stable, meaningful class names.
* Prefer reusable design tokens over scattered literal values.
* Preserve readable contrast and keyboard focus.
* Avoid unnecessary inline styles when the project uses shared stylesheets.
* Keep mobile layouts usable without horizontal overflow.
* Respect reduced-motion preferences for nonessential animation.
* Avoid breaking existing page layouts or shared navigation.

Backend and database code

* Validate requests before processing them.
* Keep authentication and authorisation separate from presentation.
* Enforce resource ownership on the server.
* Use parameterised database queries or the ORM’s safe query interface.
* Handle transaction boundaries and concurrency deliberately.
* Avoid exposing internal stack traces or database details to public clients.
* Use structured, sanitised logging where available.
* Follow the existing migration strategy for schema changes.

Comments and documentation

Explain why a non-obvious decision exists, not merely what a line of code does.

Keep documentation close to the implementation it describes, and update relevant examples when changing interfaces or configuration.

⸻

11. Frontend and Design Contributions

MedOrbits should feel coherent, accessible, and professionally designed across its pages.

Design consistency

When modifying existing pages:

* Reuse the established colour palette, typography, spacing, and components.
* Preserve the existing design direction unless a redesign is intentional.
* Keep text readable against backgrounds.
* Maintain consistent interaction states.
* Ensure visual effects do not obstruct content or controls.
* Avoid introducing unrelated design systems on individual pages.

Where the current MedOrbits design system calls for premium dark or tinted backgrounds, do not replace sections with pure white backgrounds without an intentional design decision.

Responsive behaviour

Verify the modified page on small mobile, typical mobile, tablet, and desktop layouts.

Check:

* Header and navigation behaviour.
* Card and grid sizing.
* Image cropping and scaling.
* Text wrapping and long URLs.
* Forms and button alignment.
* Footer layout.
* Scroll behaviour and sticky elements.
* Overlay and modal placement.

Do not assume a layout is responsive simply because the CSS contains a media query.

Animation and motion

Use motion to communicate state or guide attention, not as a substitute for hierarchy.

* Avoid animation that blocks interaction.
* Respect prefers-reduced-motion.
* Avoid excessive motion that harms readability.
* Ensure autoplaying carousels do not prevent users from accessing content.
* Test animated elements on mobile and lower-powered devices.

Visual pull request evidence

For significant visual changes, provide:

* Before-and-after screenshots when useful.
* The tested viewport dimensions.
* A short explanation of the design intent.
* Known browser or device limitations.
* Accessibility considerations.

Do not include screenshots containing real user documents, private account details, or production credentials.

⸻

12. Backend and API Contributions

Backend changes must preserve explicit boundaries between public data and protected resources.

Request handling

* Validate path parameters, query parameters, headers, and request bodies.
* Reject unsupported content types and malformed payloads.
* Apply size limits where appropriate.
* Return consistent status codes and documented response shapes.
* Avoid leaking internal error messages.
* Ensure asynchronous errors reach the intended error-handling path.

Authentication and authorisation

* Require authentication for protected operations.
* Check permissions on every sensitive resource access.
* Enforce ownership on the server rather than relying on UI visibility.
* Avoid insecure direct object references.
* Apply appropriate rate limits to sensitive or abuse-prone endpoints.
* Test both authorised and unauthorised cases.

API compatibility

Before changing an API response, field name, status value, or route:

1. Search for consumers in the frontend and backend.
2. Identify integrations that depend on the current contract.
3. Assess backward compatibility.
4. Update the API documentation and tests.
5. Provide a migration or versioning plan when necessary.

Do not document a proposed endpoint as live unless it exists and has been verified.

⸻

13. Data and Official Information Contributions

Educational and admission information can influence consequential decisions. It requires stronger evidence and review than ordinary descriptive content.

Source requirements

Prefer authoritative sources, including the responsible examination authority, counselling body, institution, government department, or official publication.

For a factual correction, provide:

* The affected dataset and record identifier.
* The field or statement being changed.
* The original and proposed values, where practical.
* The authoritative source URL.
* The publication date, if available.
* The date the information was checked.
* Any applicable admission year or validity period.
* An explanation of uncertainty, if any.

Data integrity

* Preserve the existing schema unless a schema change is intentional.
* Use unique identifiers.
* Follow documented date and status conventions.
* Keep cross-dataset references valid.
* Avoid duplicate records.
* Ensure URLs are valid and appropriate for the field.
* Keep private information out of public datasets.
* Do not invent official fees, deadlines, eligibility criteria, or institutional affiliations.

Data verification

Where applicable, follow docs/DATA_VERIFICATION.md.

If the source is unavailable, contradictory, or unclear, flag the issue for review rather than guessing. Clearly distinguish verified information from provisional or general guidance.

⸻

14. Documentation Contributions

Documentation is part of the product and should be maintained with the code.

Documentation standards

* Use descriptive headings.
* Prefer short, direct paragraphs.
* Include complete, copyable commands when possible.
* Explain prerequisites and assumptions.
* Identify placeholders clearly.
* Keep links and file paths current.
* Provide examples that match the actual implementation.
* Describe failure modes and recovery steps where useful.
* Avoid committing internal URLs, secrets, private data, or credentials.
* Label proposed architecture and unimplemented features accurately.

When documentation must change

Update relevant documentation when a contribution changes:

* Setup instructions.
* Environment variables.
* API routes or response contracts.
* Database schemas or migrations.
* Data formats.
* Authentication or permissions.
* Deployment procedures.
* Support workflows.
* Security controls.
* User-facing behaviour.

A pull request that changes important behaviour without updating the affected documentation may require revision before approval.

⸻

15. Testing Requirements

Testing should be appropriate to the risk of the change.

Minimum expectations

Change type	Expected checks
Typographical correction	Review the changed content and affected page
CSS or layout change	Check affected viewports and interaction states
JavaScript behaviour	Run relevant tests and verify error handling
JSON dataset change	Validate JSON syntax, schema, identifiers, and references
API change	Test valid, invalid, unauthorised, and failure cases
Database change	Test migrations, constraints, persistence, and rollback implications
Authentication change	Test access control, expiry, and privilege boundaries
Document upload change	Test validation, storage, ownership, and access restrictions
Payment change	Test sandbox success, failure, retries, and webhook verification
Security change	Test the reported weakness and related regression scenarios

Run the available project checks

Inspect package.json and the repository’s CI configuration before running commands. Depending on the configured project, checks may include:

npm ci
npm run lint
npm test
npm run build

These commands are examples, not a claim that every script exists.

If a test cannot run, state why. Do not report a test as passing when it was skipped, unavailable, or only partially executed.

For more detailed procedures, follow docs/TESTING.md if that file is present and current.

Regression prevention

When fixing a reproducible bug, add a regression test where practical. Confirm that the test would have detected the original failure and that it passes with the fix.

⸻

16. Security and Privacy Rules

Security is everyone’s responsibility.

Never commit

* .env files containing secrets.
* API keys or access tokens.
* Passwords or private keys.
* Production database credentials.
* Session cookies or authentication headers.
* Real identity documents or private application records.
* Unredacted payment or personal information.
* Logs that contain confidential data.

Security expectations

* Validate and constrain untrusted input.
* Encode output appropriately for its context.
* Enforce server-side authorisation.
* Use safe database access patterns.
* Verify third-party webhook signatures where supported.
* Restrict file upload types, sizes, and access.
* Avoid exposing sensitive data in URLs and logs.
* Keep dependencies maintained.
* Avoid disabling security controls to make a test pass.
* Use least privilege for local, CI, staging, and production credentials.

Vulnerability reporting

Do not publish exploit details, live credentials, or sensitive proof-of-concept data in an ordinary public issue or pull request.

Use the repository’s configured private security reporting channel. If no channel is documented, contact the authorised maintainer privately and request a secure reporting route.

Do not test vulnerabilities against systems you do not own or have explicit permission to assess.

Follow docs/SECURITY.md and docs/PRIVACY.md where applicable.

⸻

17. Pull Request Process

A pull request (PR) should explain the change clearly enough that a reviewer can evaluate its correctness, risk, and maintenance impact.

Before opening a PR

* Confirm the change addresses a defined problem.
* Check that the branch is based on the intended target.
* Review the full diff.
* Remove unrelated edits and temporary files.
* Run relevant tests.
* Check for secrets and sensitive information.
* Update affected documentation.
* Verify that data and API contracts remain consistent.

Recommended PR title format

Use a concise title, optionally following the commit conventions.

Examples:

* feat: improve course search filtering
* fix: prevent unauthorised document access
* docs: add contributor onboarding guide
* test: cover application submission failures

Pull request description template

Copy and adapt this template when opening a PR:

## Summary
Describe the change and the problem it solves.
## Motivation
Why is this change needed?
## Changes made
- 
- 
- 
## Related issue
Closes #<issue-number>
## Implementation notes
Describe relevant technical decisions or trade-offs.
## Testing performed
- [ ] Syntax / static checks
- [ ] Unit tests
- [ ] Integration / API tests
- [ ] UI and responsive checks
- [ ] Accessibility checks, where relevant
- [ ] Security checks, where relevant
- [ ] Manual verification
Commands executed:
Results:
## Visual evidence
Add screenshots or recordings for visual changes, if applicable.
## Data and API impact
Describe schema, contract, or dataset changes.
## Security and privacy impact
Describe relevant risks and mitigations.
## Deployment or migration impact
List required configuration, migration, or rollout steps.
## Known limitations
Document anything not addressed.
## Contributor checklist
- [ ] My change is focused and understandable.
- [ ] I have reviewed the diff.
- [ ] I have added or updated relevant tests.
- [ ] I have updated relevant documentation.
- [ ] I have not committed secrets or private data.
- [ ] I have identified breaking changes and risks.

Do not leave sections misleadingly marked as completed. Remove irrelevant sections or state that a check was not applicable.

Review cycle

After submitting:

1. Respond to reviewer questions with technical reasoning.
2. Make requested changes in the same branch where appropriate.
3. Re-run affected tests.
4. Summarise material changes in the PR discussion.
5. Resolve conversations only after the relevant issue is addressed.
6. Wait for the required approvals and automated checks.

A review request is not a guarantee of acceptance or a specific turnaround time.

⸻

18. Issue Reporting

A good issue is reproducible, focused, and specific.

Bug report template

## Summary
Describe the defect in one or two sentences.
## Environment
- Browser / device:
- Operating system:
- Release or commit:
- Environment: local / test / staging / production
## Steps to reproduce
1.
2.
3.
## Expected behaviour
What should happen?
## Actual behaviour
What happens instead?
## Reproduction frequency
Always / sometimes / once
## Evidence
Provide a redacted screenshot, error message, or relevant log.
## Impact
Who is affected and what is blocked?
## Additional context
Include relevant non-sensitive details.

Feature proposal template

## Problem
What user need or limitation does this address?
## Proposed solution
Describe the suggested behaviour.
## User impact
Who benefits, and how?
## Alternatives considered
What other approaches could solve the problem?
## Technical considerations
List dependencies, compatibility concerns, and integration points.
## Acceptance criteria
- [ ]
- [ ]
- [ ]
## Risks
Identify security, privacy, data-quality, and maintenance implications.

Search for existing issues before opening a duplicate. If a related issue already exists, add useful evidence or context there.

⸻

19. Review and Acceptance Criteria

A contribution may be approved when it meets the applicable criteria below.

Correctness

* It addresses the stated problem.
* Expected behaviour is clear and verified.
* Failure paths are handled appropriately.
* Existing functionality is preserved unless a change is intentional.

Maintainability

* The implementation fits the established architecture.
* Naming and structure are understandable.
* Unnecessary complexity is avoided.
* Documentation is updated where needed.

Testing

* Relevant checks pass.
* Important edge cases are covered.
* Regressions have been considered.
* Any skipped checks are disclosed.

Security and privacy

* Access control is enforced where required.
* Sensitive information is protected.
* New dependencies and integrations have been assessed.
* High-risk behaviour has appropriate safeguards.

User experience

* Interfaces remain usable across supported viewports.
* Accessibility has been considered.
* Error messages are clear and actionable.
* Visual changes remain consistent with the product’s design direction.

Data quality

* Factual claims have credible evidence.
* Data structure and identifiers remain valid.
* Uncertainty is not presented as confirmed information.

Maintainers may request changes, defer a contribution, or decline it when it is out of scope, inadequately supported, unsafe, duplicative, or incompatible with the project’s direction.

⸻

20. Release and Deployment Responsibilities

Contributors should not assume that merging a PR automatically authorises production deployment.

Before a change is released, the responsible maintainer or release owner should verify:

* Required automated checks have passed.
* Configuration and secrets are available through approved mechanisms.
* Database migrations are reviewed and tested.
* Breaking changes have a migration plan.
* Rollback or mitigation steps are understood.
* Relevant smoke tests are prepared.
* Monitoring and error reporting are available.
* User-facing documentation is current.

Never deploy unreviewed code, expose development services publicly, or perform destructive production operations without explicit authorisation.

Refer to docs/DEPLOYMENT.md if it accurately describes the current deployment process.

⸻

21. Accessibility and Inclusive Design

MedOrbits should be usable by people with different devices, abilities, languages, and levels of technical familiarity.

Contributors should:

* Use semantic HTML and meaningful headings.
* Ensure keyboard accessibility.
* Provide visible focus indicators.
* Use clear form labels and error messages.
* Maintain sufficient text and control contrast.
* Supply useful alternative text for meaningful images.
* Avoid communicating status through colour alone.
* Respect reduced-motion settings.
* Use plain language for consequential information.
* Avoid assuming every user has a high-speed connection or a large screen.

Where feasible, align accessibility work with WCAG 2.2 Level AA and test important interactions manually as well as with automated tools.

Do not treat automated accessibility scans as proof of complete accessibility.

⸻

22. Community Standards

Contributors are expected to maintain a respectful, constructive, and professional environment.

Expected behaviour

* Communicate clearly and respectfully.
* Critique code and ideas rather than individuals.
* Explain disagreements with evidence.
* Welcome good-faith questions.
* Give useful, actionable review feedback.
* Respect privacy and confidentiality.
* Acknowledge uncertainty and correct mistakes.
* Keep discussions relevant to the project.

Unacceptable behaviour

* Harassment, discrimination, or personal attacks.
* Threats, intimidation, or deliberate disruption.
* Publishing private information without permission.
* Misrepresenting test results or factual evidence.
* Uploading malicious code or intentionally weakening security.
* Using project access to view or disclose information without authorisation.
* Repeatedly ignoring reasonable security, review, or community requirements.

Report serious concerns privately to the authorised maintainer or the repository’s designated reporting channel.

⸻

23. Contributor Recognition

MedOrbits values contributions that improve quality, reliability, accessibility, accuracy, and user trust.

Where the project maintains contributor acknowledgements, contributors may be recognised for:

* Code and architecture improvements.
* Bug fixes and regression prevention.
* Documentation and onboarding.
* Data verification and corrections.
* Accessibility and design improvements.
* Testing and quality assurance.
* Security improvements and responsible disclosures.
* Community support and review.

Recognition should be accurate, voluntary where appropriate, and consistent with the project’s privacy and attribution practices.

Do not claim employment, official partnership, certification, or endorsement from MedOrbits solely because you contributed to the repository.

⸻

24. Frequently Asked Questions

Can I contribute without writing code?

Yes. Reproducible bug reports, verified content corrections, documentation, accessibility feedback, and testing improvements are valuable.

Should I open an issue before every change?

Not necessarily. Small, obvious fixes may be submitted directly through the normal review process. Discuss substantial features, architectural changes, schema changes, and new dependencies before implementation.

Can I add a new dependency?

Yes, when justified. Explain why existing functionality is insufficient, review maintenance and security risks, and update the lockfile and documentation appropriately.

Can I change a public API or dataset schema?

Yes, when necessary, but first identify dependent consumers. Document compatibility impacts, update tests, and provide a migration plan for breaking changes.

What if the test suite is already failing?

Document the baseline failure, identify whether your changes affect it, and avoid claiming that the suite passes. Do not conceal unrelated failures.

What if I find a security vulnerability?

Use an authorised private reporting channel. Do not disclose sensitive exploit details in a public issue.

Can I deploy my own changes?

Only if you have the appropriate permissions and the project explicitly authorises that deployment workflow.

What if I am unsure about a technical decision?

Describe the problem, the alternatives, and the trade-offs in an issue or review discussion. Early clarification is usually less expensive than reversing a large implementation.

⸻

25. Contribution Checklist

Before submitting your work, review the checklist below.

Preparation

* [ ]	I have read the relevant project documentation.
* [ ]	I have inspected the existing implementation.
* [ ]	I have checked for related issues or duplicate work.
* [ ]	I understand the intended scope of the change.

Implementation

* [ ]	My change solves a defined problem.
* [ ]	I have followed existing coding and design conventions.
* [ ]	I have avoided unnecessary dependencies and unrelated refactoring.
* [ ]	I have considered backward compatibility.
* [ ]	I have protected sensitive data and credentials.

Verification

* [ ]	I have run the relevant tests.
* [ ]	I have checked failure and edge cases.
* [ ]	I have tested affected UI behaviour and viewports, where relevant.
* [ ]	I have validated changed datasets and API contracts, where relevant.
* [ ]	I have reviewed accessibility, security, and privacy implications.

Submission

* [ ]	My branch and commits are clearly named.
* [ ]	I have reviewed the complete diff.
* [ ]	I have updated affected documentation.
* [ ]	My PR explains the motivation and implementation.
* [ ]	I have disclosed limitations and skipped checks.
* [ ]	My evidence and logs contain no secrets or unnecessary personal data.

⸻

Closing Note

Every contribution is an opportunity to make MedOrbits more useful, trustworthy, accessible, and resilient.

The best improvements are not necessarily the largest. A verified correction, a clearer instruction, a safer endpoint, a more accessible form, or a well-designed regression test can have lasting value.

Build thoughtfully. Verify carefully. Review respectfully. Ship responsibly.

Thank you for contributing to MedOrbits.

⸻

Document maintenance

* Owner: MedOrbits repository maintainers
* Review cadence: Periodically and whenever contribution workflows or repository policies change
* Related references: README.md, docs/TESTING.md, docs/SECURITY.md, docs/PRIVACY.md, and other current project documentation
* Policy note: Repository-specific commands, branch protection, review requirements, licence terms, and reporting channels must be verified against the actual project configuration.

End of document.