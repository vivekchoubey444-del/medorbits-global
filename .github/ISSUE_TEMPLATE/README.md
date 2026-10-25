
# MedOrbits — GitHub Issue Templates

**Clear reports. Better collaboration. More reliable software.**

This directory contains the GitHub issue templates and configuration used to standardize bug reports, feature proposals, and non-sensitive security concerns for MedOrbits.

The objective is to make incoming reports easier to understand, reproduce, prioritize, and resolve while protecting users and sensitive project information.

—

## 1. Directory Structure

The expected structure is:

```text
.github/
└── ISSUE_TEMPLATE/
    ├── README.md
    ├── bug_report.yml
    ├── config.yml
    ├── feature_request.yml
    └── security_report.yml
```

Keep all issue templates and their configuration directly inside `.github/ISSUE_TEMPLATE/`.

Do not create a second nested `ISSUE_TEMPLATE/` directory unless there is a specific, documented reason.

Keep filenames stable and descriptive so contributors and maintainers can locate templates easily.

## 2. Available Templates

### `bug_report.yml`

**Purpose:** Report a defect, broken interaction, unexpected behaviour, or regression.

The form collects information such as:

- Bug category and severity.
- Steps to reproduce.
- Expected and actual behaviour.
- Affected page or endpoint.
- Browser, device, and environment.
- Relevant non-sensitive error messages.
- Reproducibility and possible workarounds.
- Submission confirmations.

**Best for:** Reproducible technical defects and user-facing problems.

### `feature_request.yml`

**Purpose:** Propose a new capability, enhancement, or improvement.

The form encourages contributors to describe:

- The problem or opportunity.
- Target users and user journey.
- Proposed solution and expected benefits.
- Design and implementation considerations.
- Dependencies, risks, and acceptance criteria.
- Related issues and willingness to contribute.

**Best for:** Product improvements, new functionality, and enhancements to existing workflows.

### `security_report.yml`

**Purpose:** Collect high-level, non-sensitive security concerns that are safe to discuss publicly.

The form captures the type of concern, potential impact, affected environment, and general observations.

**Important:** This is not a confidential reporting channel. Actual vulnerabilities should be reported privately through GitHub’s private vulnerability reporting feature when available, or through an authorized private contact.

Never publish credentials, exploit instructions, sensitive personal information, confidential logs, or proof-of-concept material in a public issue.

### `config.yml`

**Purpose:** Configure the GitHub issue-creation experience.

It can:

- Disable blank issues.
- Direct users to private security reporting.
- Link to contribution guidelines.
- Direct contributors to documentation and support resources.
- Provide links for other appropriate reporting channels.

Ensure that every configured URL points to the intended repository and an available resource.

## 3. How GitHub Uses These Files

GitHub recognizes supported YAML issue forms and Markdown issue templates stored in `.github/ISSUE_TEMPLATE/`.

When a contributor selects **Issues → New issue**, GitHub displays the available templates and contact links according to the repository configuration.

### YAML issue forms

Supported field types include:

- `markdown`
- `input`
- `textarea`
- `dropdown`
- `checkboxes`

Issue forms can provide structured input, descriptions, placeholders, required-field validation, and predefined labels.

For checkbox fields, individual options can be marked as required. Contributors must select those options before submitting the form.

### Markdown issue templates

Markdown templates use YAML frontmatter for metadata such as:

- `name`
- `about`
- `title`
- `labels`
- `assignees`

The frontmatter is followed by the Markdown issue body.

Use the format supported by GitHub for the relevant template type. Do not mix YAML issue-form syntax with Markdown-template frontmatter.

## 4. Repository Configuration

Before relying on these templates, verify the following:

- [ ] The repository contains `.github/ISSUE_TEMPLATE/`.
- [ ] All intended templates are committed to the correct branch.
- [ ] YAML files parse correctly.
- [ ] Markdown template frontmatter is valid, if Markdown templates are used.
- [ ] Labels such as `bug`, `enhancement`, and `security` exist or are intentionally managed.
- [ ] Configured contact links point to the intended repository.
- [ ] Private vulnerability reporting is enabled if the security link depends on it.
- [ ] Blank-issue behaviour matches the project’s workflow.
- [ ] No placeholder contact details remain.
- [ ] The issue-creation page displays the expected options.

### Recommended configuration

Keep these files together:

```text
.github/ISSUE_TEMPLATE/
├── README.md
├── bug_report.yml
├── config.yml
├── feature_request.yml
└── security_report.yml
```

Do not create a second nested issue-template directory.

## 5. Security and Privacy Requirements

Issue templates are a first line of defence against accidental disclosure. They do not replace server-side security controls, access restrictions, or confidential reporting processes.

Contributors must not include:

- Passwords, OTPs, API keys, or access tokens.
- Session cookies or authentication headers.
- Private identity or medical documents.
- Full payment credentials.
- Production database exports.
- Unredacted logs containing personal information.
- Exploit details that would enable unauthorized access.
- Private infrastructure details that could increase security risk.

### Vulnerability reporting procedure

For suspected security vulnerabilities:

1. Avoid further testing unless explicitly authorized.
2. Do not publish exploit details in an ordinary issue.
3. Use the repository’s private vulnerability reporting channel when available.
4. If private reporting is unavailable, request an authorized secure reporting channel.
5. Follow the repository’s `SECURITY.md` policy and incident-response procedures.

Private reporting link:

<https://github.com/vivekchoubey366-dot/MedOrbits/security/advisories/new>

A public issue form cannot guarantee confidentiality. Do not use the public security form to disclose a vulnerability that requires confidential handling.

## 6. Template Design Standards

New or modified templates should follow these standards.

### Clarity

- Use concise, descriptive titles.
- Explain why each field is needed.
- Provide examples where they improve report quality.
- Avoid asking for the same information multiple times.

### Practicality

- Make only essential fields mandatory.
- Allow partial information where practical.
- Use dropdowns for predictable categories.
- Use text areas for explanations and reproduction steps.
- Avoid requesting information maintainers do not need.

### Accessibility

- Use readable labels and descriptions.
- Keep instructions understandable.
- Do not rely on colour or emoji alone to communicate meaning.
- Make forms usable by contributors with different levels of technical experience.
- Consider mobile layouts and assistive technology when designing related website interfaces.

### Maintainability

- Keep filenames descriptive and stable.
- Use valid YAML syntax.
- Update related documentation when a template changes.
- Verify links, labels, and routing.
- Avoid embedding environment-specific secrets or private URLs.
- Keep documentation aligned with the actual files in the repository.

## 7. Testing Issue Templates

After making changes:

1. Validate YAML syntax with an appropriate YAML parser.
2. Review Markdown frontmatter and headings if Markdown templates are present.
3. Check that referenced labels exist or are intentionally managed.
4. Verify contact links and repository paths.
5. Open the GitHub issue-creation page.
6. Confirm that required fields and dropdown options appear correctly.
7. Test required checkbox behaviour.
8. Review the security guidance to ensure it does not encourage public disclosure.
9. Check the final files for credentials, secrets, and sensitive information.

A local YAML parser can catch syntax errors, but GitHub’s issue-creation page is the final practical check for form behaviour.

## 8. Adding a New Template

When a new issue type is needed:

1. Confirm that an existing template cannot handle the request.
2. Choose YAML for a structured form or Markdown for a simple free-text template.
3. Give the template a descriptive name and purpose.
4. Collect only the information needed to triage the request.
5. Define labels carefully.
6. Add appropriate privacy and security instructions.
7. Update `config.yml` if additional contact links or routing options are needed.
8. Test the template on GitHub.
9. Update this README to explain the new template.

Potential future templates include:

- Documentation correction.
- Accessibility issue.
- Data-quality report.
- Performance issue.
- Deployment or infrastructure issue.

Add these only when they provide a useful, distinct workflow.

## 9. Maintenance Responsibilities

Repository maintainers should periodically:

- Review template relevance and field quality.
- Remove obsolete links and placeholder details.
- Keep security-reporting instructions current.
- Verify labels and issue-routing configuration.
- Update documentation links when files move.
- Review recurring reports for opportunities to improve the forms.
- Ensure templates continue to match contribution and security policies.
- Check that public issue forms do not request sensitive information unnecessarily.

Changes to issue templates should be reviewed like other repository changes.

## 10. Related Documentation

The following documents may be relevant, if present and current:

- [`CONTRIBUTING.md`](../../docs/CONTRIBUTING.md) — contribution standards and pull request workflow.
- [`TESTING.md`](../../docs/TESTING.md) — testing and quality assurance.
- [`SECURITY.md`](../../docs/SECURITY.md) — security policy and vulnerability handling.
- [`PRIVACY.md`](../../docs/PRIVACY.md) — privacy responsibilities.
- [`SUPPORT_GUIDE.md`](../../docs/SUPPORT_GUIDE.md) — support categorization and escalation.
- [`README.md`](../../docs/README.md) — main documentation index.

These links are relative to `.github/ISSUE_TEMPLATE/`. Verify that the referenced files exist at the specified paths before relying on them.

—

## Final Checklist

- [ ] All issue templates are stored in the correct directory.
- [ ] `config.yml` is alongside the template files.
- [ ] YAML and Markdown formatting are valid.
- [ ] Repository labels and URLs are verified.
- [ ] Security reports are clearly directed to a private channel for actual vulnerabilities.
- [ ] No credentials or sensitive data are included.
- [ ] GitHub displays the expected issue-creation options.
- [ ] Documentation is updated when templates change.

**MedOrbits principle:** Make it easy to report problems, easy to propose improvements, and safe to disclose security concerns.

**Maintainer:** MedOrbits repository maintainers  
**Location:** `.github/ISSUE_TEMPLATE/README.md`  
**Review cadence:** Periodically and after changes to GitHub issue workflows or security-reporting configuration.
