
# 🩺 MedOrbits — GitHub Issue Templates

**Project:** MedOrbits  
**Release target:** `2.0.0`  
**Directory:** `.github/ISSUE_TEMPLATE/`

—

## 1. Purpose

This directory contains GitHub issue forms that help contributors report bugs, propose features, and communicate security concerns using consistent, structured information.

The templates are intended to improve issue quality, reduce duplicate reports, protect sensitive information, and help maintainers prioritize work.

> **Important:** This README describes the intended configuration. It does not confirm that every template exists, has been committed, or has been validated on GitHub.

## 2. Directory Structure

The intended directory structure is:

```text
.github/ISSUE_TEMPLATE/
├── README.md
├── config.yml
├── bug_report.yml
├── feature-request.yml
└── security-report.yml
```

GitHub recognizes YAML issue forms and the special `config.yml` configuration file in this directory.

Before relying on this structure, verify that every listed file exists on the target branch.

## 3. 🐛 Bug Report

**File:** `bug_report.yml`

Use this form to report reproducible software defects, including:

- Broken pages and interface behavior.
- API errors and backend failures.
- Incorrect or missing information.
- Form submission and document upload failures.
- Accessibility, compatibility, and performance issues.
- Deployment or infrastructure problems.

A useful bug report should include the affected area, reproduction steps, expected behavior, actual behavior, and relevant environment details.

**Privacy and security:** Remove passwords, authentication tokens, session cookies, personal records, private documents, and production secrets from screenshots and logs before submitting.

## 4. 💡 Feature Request

**File:** `feature-request.yml`

Use this form to suggest new capabilities or improvements to MedOrbits.

Requests should explain:

- The problem being solved.
- The users affected.
- The proposed solution.
- Example use cases.
- Acceptance criteria.
- Relevant dependencies or constraints.

Potential areas include:

- Education and admissions.
- College and university information.
- International education.
- Careers and recruitment.
- Search and discovery.
- Accessibility.
- Account management.
- Developer tooling and infrastructure.

A feature request is a proposal, not a guarantee of implementation or a delivery commitment.

## 5. 🔐 Security Report

**File:** `security-report.yml`

Use the security form only for minimal, non-sensitive descriptions where a public issue is appropriate.

**Do not publish confidential vulnerability information in a public issue.**

Never include:

- Passwords or API keys.
- Access tokens, session cookies, or authorization headers.
- Private user records or educational documents.
- Sensitive production logs.
- Exploit code or detailed instructions that enable abuse.
- Personally identifiable information that is unnecessary for initial triage.

For confidential vulnerability details, use the private vulnerability-reporting method documented in the repository’s `SECURITY.md`.

Maintainers must verify that this reporting method is configured, accessible, and operational before directing researchers to it.

> A GitHub issue form does not make an issue private. A public issue remains public unless GitHub provides and the maintainer uses an appropriate private reporting mechanism.

## 6. ⚙️ Issue Form Configuration

**File:** `config.yml`

This file controls whether blank issues are enabled and provides links to relevant resources.

Recommended starting configuration:

```yaml
blank_issues_enabled: false

contact_links:
  - name: MedOrbits Documentation
    url: https://github.com/vivekchoubey366-dot/MedOrbits
    about: Read project documentation before opening an issue.
```

The complete configuration may also link to contribution guidelines, support documentation, release notes, and the security policy.

Before committing `config.yml`:

1. Verify every URL.
2. Confirm that linked files exist on the default branch.
3. Confirm that the destination is appropriate for public access.
4. Ensure that security links direct users to a suitable private reporting method where required.

## 7. 🗂️ Naming and Link Consistency

Use the following filenames consistently:

| Purpose | Filename |
|—|—|
| Bug reports | `bug_report.yml` |
| Feature requests | `feature-request.yml` |
| Security reports | `security-report.yml` |
| Issue configuration | `config.yml` |
| Directory documentation | `README.md` |

GitHub recognizes issue-form files by their location and supported format. Direct links to individual form files must match their actual filenames and branch paths.

For example, if a link points to the feature request form, use:

```text
.github/ISSUE_TEMPLATE/feature-request.yml
```

Do not substitute `feature_request.yml` unless that is the actual filename.

Do not assume a form is available until it has been committed to the expected branch and verified in GitHub’s issue creation interface.

## 8. ✅ Validation Checklist

Before merging issue-template changes, verify the following:

- [ ] All intended files exist in `.github/ISSUE_TEMPLATE/`.
- [ ] YAML syntax is valid.
- [ ] Each form uses supported GitHub issue-form field types.
- [ ] Required fields are marked correctly.
- [ ] Dropdown options are relevant and understandable.
- [ ] Referenced labels exist or are intentionally created.
- [ ] `config.yml` links match the actual filenames.
- [ ] Documentation URLs are correct.
- [ ] No unnecessary sensitive or personal information is requested.
- [ ] Security guidance points to a verified private reporting channel.
- [ ] The forms render correctly in GitHub’s issue creation interface.
- [ ] The changes are committed to the intended branch.
- [ ] The final behavior is checked against the repository’s contribution and security policies.

## 9. 🔧 Maintenance Guidelines

Review these templates whenever MedOrbits changes its repository structure, contribution workflow, support process, or security policy.

Maintain the following principles:

- Keep forms focused and easy to complete.
- Request only the information needed for triage and resolution.
- Avoid collecting sensitive personal or educational information in public reports.
- Do not request passwords, private keys, tokens, or session cookies.
- Collect sensitive evidence only through an approved, access-controlled channel.
- Keep links and field descriptions synchronized with the current project.
- Test changes before treating them as active repository controls.

Issue templates improve the quality of incoming reports. They do not independently enforce repository permissions, prevent unauthorized pushes, guarantee confidentiality, or replace branch protection and access controls.

## 10. 📚 Official Documentation

Consult the official GitHub documentation for current requirements:

- [GitHub issue forms syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [GitHub issue template configuration](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository)
- [GitHub security advisories](https://docs.github.com/en/code-security/security-advisories)

—

### Maintenance Note

This README documents the intended issue-template structure and recommended practices for MedOrbits `2.0.0`.

It does **not** establish that the templates, labels, links, or security-reporting controls have been tested or activated. Verify the actual repository contents and GitHub configuration before relying on them.
