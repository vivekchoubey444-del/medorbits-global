MedOrbits — GitHub Issue Templates

This directory contains standardized GitHub issue templates for reporting bugs, proposing features, and directing suspected security vulnerabilities to the appropriate reporting channel.

The templates improve issue quality, simplify triage, and help maintain consistent reporting across the MedOrbits project.

Available Templates

1. Bug Report

File: bug_report.yml

Use this template to report reproducible problems affecting:

* Website, frontend, and user interface
* Authentication, registration, and account management
* Education, admissions, and course information
* Applications and document handling
* Careers, jobs, and recruitment
* Payments and subscriptions
* Notifications and email delivery
* Administration dashboard
* APIs, backend services, and databases
* Deployment and infrastructure

Include reproduction steps, expected behavior, actual behavior, relevant environment details, and sanitized error logs wherever possible.

Never include passwords, access tokens, private user information, confidential documents, or sensitive production data.

2. Feature Request

File: feature_request.yml

Use this template to propose new capabilities, improvements, or changes to existing MedOrbits functionality.

Describe:

* The problem or opportunity
* The intended users and use case
* The proposed solution
* Expected behavior and impact
* Acceptance criteria
* Relevant security, privacy, accessibility, and compatibility considerations

Requests should explain the intended outcome clearly enough for maintainers to assess feasibility, scope, and completion criteria.

3. Security Vulnerability Reporting

File: security-report.yml

This template warns reporters about public disclosure and directs them to the project’s documented security reporting process.

Important: A GitHub Issue Form normally creates a public issue. This template does not make reports private and must not be treated as a secure vulnerability disclosure channel.

Before reporting a suspected vulnerability:

1. Read the repository’s root SECURITY.md.
2. Use GitHub’s private vulnerability reporting feature if it is enabled, or another private channel explicitly documented by the project.
3. If no private channel is documented, contact a maintainer through an appropriate non-public channel to request secure reporting instructions.
4. Do not publish exploit instructions, proof-of-concept code, credentials, session tokens, exposed secrets, or sensitive technical details in a public issue.

Never include passwords, API keys, payment-card information, identity documents, confidential production data, or another person’s private information.

Prioritize confidentiality over completing a public issue form.

Issue Template Configuration

File: config.yml

The configuration file controls whether blank issues are allowed and may provide links to documentation, bug reports, feature requests, or security reporting resources.

Keep all configured links accurate and verify that referenced forms and reporting channels exist.

If blank issues are disabled, users should be directed to the appropriate template or documented contact channel.

A security contact link must not imply that private reporting is available unless the repository actually supports that mechanism.

Labels

Templates may reference the following GitHub issue labels:

Label	Purpose
bug	Reports a defect or unexpected behavior
enhancement	Proposes a feature or improvement
triage	Indicates that an issue requires initial review

Create these labels in the repository if they do not already exist. Confirm that every label referenced by a template matches a label configured in GitHub.

Templates without labels should not receive labels automatically unless that behavior is explicitly configured.

Maintainer Responsibilities

Maintainers are responsible for keeping templates accurate, useful, and consistent with the repository’s contribution and security policies.

* Keep templates aligned with CONTRIBUTING.md and SECURITY.md.
* Keep questions relevant and reporting straightforward.
* Review incoming issues and apply appropriate labels.
* Avoid requesting sensitive personal information or credentials.
* Direct vulnerability reports to a verified private reporting channel.
* Handle public security disclosures according to the project’s security response procedure.
* Update this documentation when filenames, template behavior, labels, or reporting procedures change.
* Periodically verify compatibility with GitHub Issue Forms and template configuration.

Adding or Updating a Template

Add a Markdown issue template (.md) or a GitHub Issue Form (.yml) to this directory.

After adding or updating a template:

1. Verify that the filename matches this documentation.
2. Validate YAML syntax for Issue Forms.
3. Confirm that referenced labels exist in the repository.
4. Check required fields, dropdown options, and validation rules.
5. Open a test issue when appropriate and verify that the template renders correctly.
6. Confirm that security instructions do not encourage public disclosure of sensitive details.
7. Update this README whenever a filename, purpose, label, or reporting procedure changes.

GitHub Configuration

Keep issue template files under:

.github/ISSUE_TEMPLATE/

GitHub supports Markdown issue templates and structured YAML Issue Forms. An optional config.yml file in this directory controls blank-issue behavior and can provide links to external resources.

Ensure that configured links point to valid destinations and that private security reporting is enabled or otherwise documented before directing reporters to it.

Related Documentation

* README.md — Repository overview and setup
* CONTRIBUTING.md — Contribution workflow and standards
* SECURITY.md — Vulnerability disclosure and security policies
* CODE_OF_CONDUCT.md — Community participation standards
* SUPPORT.md — General support and troubleshooting

These files should exist at the repository root for the links and references to be applicable.

Security Reminder

Issue templates improve reporting consistency; they do not protect source code, restrict repository cloning, grant repository permissions, or make public issues private.

Use repository access controls, branch protection or rulesets, and a properly configured private vulnerability reporting process for their respective purposes.

Before publishing changes, ensure every documented filename matches the actual files in .github/ISSUE_TEMPLATE/.