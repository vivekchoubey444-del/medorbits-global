MedOrbits — GitHub Issue Templates

Clear reports. Better collaboration. More reliable software.

This directory contains the GitHub issue templates used to standardise bug reports, feature proposals, and security-related concerns for the MedOrbits project.

The goal is to make incoming reports easier to understand, reproduce, prioritise, and resolve while protecting users and sensitive project information.

⸻

1. Directory Structure

.github/
├── ISSUE_TEMPLATE/
│   ├── README.md
│   ├── bug_report.yml
│   ├── feature-request.md
│   └── security-report.yml
└── ISSUE_TEMPLATE/
    └── config.yml

The tree above illustrates the intended files, but config.yml must be stored directly inside .github/ISSUE_TEMPLATE/ alongside the other templates, not in a separate nested ISSUE_TEMPLATE directory.

The correct structure is:

.github/
└── ISSUE_TEMPLATE/
    ├── README.md
    ├── bug_report.yml
    ├── config.yml
    ├── feature-request.md
    └── security-report.yml

Keep filenames stable so contributors can locate templates easily.

2. Available Templates

bug_report.yml

Purpose: Report a defect, broken interaction, unexpected behaviour, or regression.

Collects information such as:

* Bug category and severity.
* Steps to reproduce.
* Expected and actual behaviour.
* Affected page or endpoint.
* Browser, device, and environment.
* Relevant non-sensitive error messages.
* Reproducibility and possible workarounds.
* Submission confirmations.

Best for: Reproducible technical defects and user-facing problems.

feature-request.md

Purpose: Propose a new capability, enhancement, or improvement.

Encourages contributors to describe:

* The problem or opportunity.
* Target users and user journey.
* Proposed solution and expected benefits.
* Design and implementation considerations.
* Dependencies, risks, and acceptance criteria.
* Related issues and willingness to contribute.

Best for: Product improvements, new functionality, and enhancements to existing workflows.

security-report.yml

Purpose: Collect high-level, non-sensitive security concerns.

Captures the type of concern, potential impact, affected environment, and general observations.

Important: This is not a confidential reporting channel. Actual vulnerabilities should be reported privately through GitHub’s private vulnerability reporting feature when available, or through an authorised private contact.

Never publish credentials, exploit instructions, sensitive personal information, or confidential proof-of-concept material in a public issue.

config.yml

Purpose: Configure the GitHub issue creation experience.

It can:

* Disable blank issues.
* Direct security reports to private vulnerability reporting.
* Link to contribution guidelines.
* Direct contributors to documentation and support resources.
* Provide links for other appropriate reporting channels.

Ensure that every configured URL points to the correct repository and an available resource.

3. How GitHub Uses These Files

GitHub recognises supported issue form YAML files and Markdown issue templates in the .github/ISSUE_TEMPLATE/ directory.

When a contributor selects Issues → New issue, GitHub presents the configured templates and contact links according to the repository’s settings.

YAML issue forms support structured fields such as:

* input
* textarea
* dropdown
* checkboxes
* markdown

They also support required-field validation and predefined labels.

Markdown templates use frontmatter for fields such as name, about, title, labels, and assignees, followed by the issue body.

Use the format supported by GitHub for the relevant template type.

4. Repository Configuration

Before relying on these templates, verify the following:

* [ ]	The repository contains .github/ISSUE_TEMPLATE/.
* [ ]	All intended templates are committed to the correct branch.
* [ ]	YAML files parse correctly.
* [ ]	Markdown template frontmatter is valid.
* [ ]	Labels such as bug, enhancement, and security exist or are created.
* [ ]	Configured contact links point to the intended repository.
* [ ]	Private vulnerability reporting is enabled if the security link depends on it.
* [ ]	Blank-issue behaviour matches the project’s workflow.
* [ ]	No placeholder contact details remain.
* [ ]	The issue creation page displays the expected options.

Recommended configuration

Keep the following files together:

.github/ISSUE_TEMPLATE/
├── README.md
├── bug_report.yml
├── config.yml
├── feature-request.md
└── security-report.yml

Do not create a second nested issue-template directory unless there is a specific, documented reason.

5. Security and Privacy Requirements

Issue templates are a first line of defence against accidental disclosure. They do not replace server-side security controls or confidential reporting processes.

Contributors must not include:

* Passwords, OTPs, API keys, or access tokens.
* Session cookies or authentication headers.
* Private identity or medical documents.
* Full payment credentials.
* Production database exports.
* Unredacted logs containing personal information.
* Exploit details that would enable unauthorised access.

Vulnerability reporting

For suspected security vulnerabilities:

1. Avoid further testing unless explicitly authorised.
2. Do not publish exploit details in an ordinary issue.
3. Use the repository’s private vulnerability reporting channel when available.
4. If private reporting is unavailable, request an authorised secure reporting channel.
5. Follow docs/SECURITY.md and the project’s incident-response procedures.

A public issue form cannot guarantee confidentiality.

6. Template Design Standards

New or modified templates should follow these standards.

Clarity

* Use concise, descriptive titles.
* Explain why each field is needed.
* Provide examples where they improve report quality.
* Avoid asking for the same information multiple times.

Practicality

* Make only essential fields mandatory.
* Allow users to submit partial information where practical.
* Use dropdowns for predictable categories.
* Use text areas for explanations and reproduction steps.
* Avoid requesting information that maintainers do not need.

Accessibility

* Use readable labels and descriptions.
* Keep instructions understandable.
* Avoid relying on colour or emoji alone to communicate meaning.
* Make the form usable by contributors with different levels of technical experience.

Maintainability

* Keep filenames descriptive and stable.
* Use valid YAML syntax.
* Update related documentation when a template changes.
* Verify all links and labels.
* Avoid embedding environment-specific secrets or private URLs.

7. Testing Issue Templates

After making changes:

1. Validate YAML syntax with an appropriate YAML parser.
2. Review Markdown frontmatter and headings.
3. Check that every referenced label exists or is intentionally managed.
4. Verify contact links and repository paths.
5. Open the GitHub issue creation page.
6. Confirm that required fields and dropdown options appear correctly.
7. Test the security guidance and ensure it does not encourage public disclosure.
8. Review the final files for sensitive information.

A local YAML parser can catch syntax errors, but GitHub’s own issue creation page is the final practical check for template behaviour.

8. Adding a New Template

When a new issue type is needed:

1. Confirm that an existing template cannot handle the request.
2. Select YAML for structured forms or Markdown for a simple free-text template.
3. Give the template a descriptive name and purpose.
4. Collect only the information needed to triage the request.
5. Define labels carefully.
6. Add appropriate privacy and security instructions.
7. Update config.yml if additional contact links or issue-routing options are needed.
8. Test the template on GitHub.
9. Update this README to explain the new template.

Potential future templates include:

* Documentation correction.
* Accessibility issue.
* Data-quality report.
* Performance issue.
* Deployment or infrastructure issue.

Add these only when they provide a useful, distinct workflow.

9. Maintenance Responsibilities

Repository maintainers should periodically:

* Review template relevance and field quality.
* Remove obsolete links and placeholder details.
* Keep security-reporting instructions current.
* Verify labels and issue-routing configuration.
* Update the documentation links when files move.
* Review recurring reports for opportunities to improve the forms.
* Ensure that templates continue to match the project’s contribution and security policies.

Changes to issue templates should be reviewed like other repository changes.

10. Related Documentation

Consult the following documents when present and current:

* ../../docs/CONTRIBUTING.md — Contribution standards and pull request workflow.
* ../../docs/TESTING.md — Testing and quality assurance.
* ../../docs/SECURITY.md — Security policy and vulnerability handling.
* ../../docs/PRIVACY.md — Privacy responsibilities.
* ../../docs/SUPPORT_GUIDE.md — Support categorisation and escalation.
* ../../docs/README.md — Main documentation index.

These are relative links from the issue-template directory. Verify that the referenced files exist before relying on them.

⸻

Final Checklist

* [ ]	All issue templates are stored in the correct directory.
* [ ]	config.yml is alongside the template files.
* [ ]	YAML and Markdown formatting are valid.
* [ ]	Repository labels and URLs are verified.
* [ ]	Security reports are clearly directed to a private channel.
* [ ]	No credentials or sensitive data are included.
* [ ]	GitHub displays the expected issue creation options.
* [ ]	Documentation is updated when the templates change.

MedOrbits principle: Make it easy to report problems, easy to propose improvements, and safe to disclose security concerns.

Maintainer: MedOrbits repository maintainers
Location: .github/ISSUE_TEMPLATE/README.md
Review cadence: Periodically and after changes to GitHub issue workflows or security-reporting configuration.