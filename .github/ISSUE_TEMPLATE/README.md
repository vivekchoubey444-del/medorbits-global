MedOrbits — GitHub Issue Templates

Directory: .github/ISSUE_TEMPLATE/
Project: MedOrbits
Release target: 2.0.0

1. Purpose

This directory contains GitHub issue forms that help contributors report bugs, propose features, and communicate security concerns using consistent, structured information.

The templates are intended to improve issue quality, reduce duplicate reports, protect sensitive information, and help maintainers prioritize work.

2. Directory Structure

The following is the intended structure. Confirm that each file exists before relying on it.

.github/ISSUE_TEMPLATE/
├── README.md
├── config.yml
├── bug_report.yml
├── feature-request.yml
└── security-report.yml

GitHub recognizes YAML issue forms and the special config.yml configuration file in this directory.

3. Bug Report

File: bug_report.yml

Use this form to report reproducible software defects, including:

* Broken pages and interface behavior.
* API errors and backend failures.
* Incorrect or missing information.
* Form submission and document upload failures.
* Accessibility, compatibility, and performance issues.
* Deployment or infrastructure problems.

A useful bug report should include the affected area, reproduction steps, expected behavior, actual behavior, and relevant environment details.

Remove passwords, authentication tokens, personal records, and production secrets from screenshots and logs before submitting.

4. Feature Request

File: feature-request.yml

Use this form to suggest new capabilities or improvements to MedOrbits.

Requests should explain:

* The problem being solved.
* The users affected.
* The proposed solution.
* Example use cases.
* Acceptance criteria.
* Relevant dependencies or constraints.

Possible areas include education and admissions, college information, international education, careers, recruitment, search, accessibility, account management, and developer tooling.

A feature request is a proposal, not a guarantee of implementation or a delivery commitment.

5. Security Report

File: security-report.yml

Use the security form only for minimal, non-sensitive descriptions where a public issue is appropriate.

Do not publish confidential vulnerability information in a public issue.

Never include:

* Passwords or API keys.
* Access tokens, session cookies, or authorization headers.
* Private user records or documents.
* Sensitive production logs.
* Exploit code or detailed instructions that enable abuse.

Use the private vulnerability-reporting method documented in the repository’s SECURITY.md. Verify that the method is configured and operational before directing researchers to it.

A GitHub issue form does not make an issue private.

6. Issue Form Configuration

File: config.yml

This file controls the availability of blank issues and provides links to relevant resources.

Recommended configuration:

blank_issues_enabled: false
contact_links:
  - name: MedOrbits Documentation
    url: https://github.com/vivekchoubey366-dot/MedOrbits
    about: Read project documentation before opening an issue.

The complete configuration may also link to contribution guidelines, support documentation, release notes, and the security policy.

Keep every link accurate and ensure that the referenced files exist.

7. Naming and Link Consistency

GitHub issue-form links must match the actual filenames.

For this directory, use one consistent naming convention:

* bug_report.yml
* feature-request.yml
* security-report.yml

If config.yml contains a direct link to a feature request form, ensure the URL references feature-request.yml, not feature_request.yml.

Do not assume a form is available until it has been committed to the expected branch and verified on GitHub.

8. Validation Checklist

Before merging changes to issue templates:

* [ ]	YAML syntax is valid.
* [ ]	Each issue form uses supported GitHub field types.
* [ ]	Required fields are marked correctly.
* [ ]	Dropdown options are relevant and understandable.
* [ ]	Labels referenced by templates exist or are intentionally created.
* [ ]	The config.yml links match actual filenames.
* [ ]	All documentation URLs are correct.
* [ ]	No secrets or private information are requested unnecessarily.
* [ ]	Security guidance points to a verified private reporting channel.
* [ ]	Templates render correctly in the GitHub issue creation interface.

9. Maintenance Guidelines

Review these templates when MedOrbits changes its repository structure, contribution workflow, support process, or security policy.

Keep templates focused. Request only the information needed to triage and resolve an issue. Avoid collecting sensitive personal or educational information in public reports.

Maintainers should request additional sensitive evidence only through an approved, access-controlled channel.

10. Official Documentation

* GitHub issue form syntax
* GitHub issue template configuration
* GitHub security advisories

⸻

Maintenance note: This README documents the intended template structure and recommended practices. It does not establish that the templates, labels, links, or security reporting controls have been tested or activated.