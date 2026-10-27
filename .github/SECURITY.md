
# MedOrbits Security Policy

**Policy version:** 2.0.0  
**Scope:** MedOrbits repositories, source code, APIs, web applications, dependencies, and deployment configuration.

## 1. Purpose

MedOrbits takes the security of its applications, infrastructure, repository, and user data seriously. This policy explains how to report vulnerabilities, which software versions receive security fixes, and how security issues are handled.

This document establishes a reporting process; it does not guarantee a particular response or remediation timeline.

## 2. Supported Versions

Security fixes are prioritized for actively maintained releases and the production deployment.

| Version or branch | Security support |
|—|—|
| Current production release | Prioritized |
| `main` | Active development and security fixes |
| `develop` | Active development; fixes may be incorporated before release |
| Older releases | Best effort, subject to maintenance status |
| Unsupported or archived versions | No guaranteed security updates |

The actual support status depends on the repository’s release and maintenance state. Do not assume that every branch or release receives security updates.

## 3. Reporting a Vulnerability

**Please report suspected vulnerabilities privately. Do not publish exploitable details in public issues or pull requests.**

Use GitHub’s private vulnerability reporting feature if it is enabled for this repository:

1. Open the MedOrbits repository on GitHub.
2. Navigate to the repository’s **Security** tab.
3. Select **Report a vulnerability** or the equivalent private reporting option.
4. Provide the technical details needed to reproduce and assess the issue.

If private vulnerability reporting is unavailable, contact the repository owner or maintainers through an established, private contact channel.

Do not assume that a public issue, public discussion, or ordinary pull request is a confidential reporting channel.

### Include the following information

- A concise description of the vulnerability.
- The affected component, file, endpoint, version, or deployment.
- The potential security impact.
- Reproduction steps or a minimal proof of concept.
- Relevant request/response examples, logs, or screenshots with sensitive data removed.
- Any known prerequisites, mitigations, or workarounds.
- Your preferred contact method for follow-up, if appropriate.

Please provide enough evidence to reproduce the issue without exposing real users’ data or production credentials.

## 4. Responsible Disclosure

MedOrbits asks security researchers to:

- Allow maintainers a reasonable opportunity to investigate and remediate reported vulnerabilities before public disclosure.
- Avoid accessing, modifying, deleting, or exfiltrating data that does not belong to them.
- Avoid disrupting services, degrading availability, or conducting destructive tests.
- Test only systems they own or are explicitly authorized to assess.
- Avoid social engineering, phishing, physical attacks, and attacks against third-party infrastructure.
- Stop testing and report the issue promptly if sensitive information is encountered.
- Share only the minimum evidence necessary to demonstrate the vulnerability.

Do not include passwords, access tokens, API keys, private keys, session cookies, personal information, or unredacted production records in reports.

## 5. Vulnerability Scope

The following areas may be in scope when they belong to or are operated by MedOrbits:

- Authentication, authorization, and session management.
- API access controls, validation, and rate limiting.
- SQL injection, command injection, cross-site scripting, and path traversal.
- Server-side request forgery and insecure file handling.
- Sensitive-data exposure and improper error handling.
- Dependency vulnerabilities and supply-chain risks.
- Security misconfiguration in Node.js, Express, Python, and related components.
- Insecure secrets management and accidental credential exposure.
- Cross-origin resource sharing and security-header configuration.
- Insecure deployment workflows and excessive GitHub Actions permissions.
- Access-control failures involving applications, documents, and uploaded files.
- Vulnerabilities affecting data integrity, confidentiality, or service availability.

### Generally out of scope

Unless a clear security impact is demonstrated, the following are generally not treated as security vulnerabilities:

- Reports based solely on outdated software banners or version disclosures.
- Missing security headers without a demonstrated exploitable impact.
- Best-practice recommendations without a concrete vulnerability.
- Denial-of-service testing against live production systems.
- Social engineering, phishing, or attacks against third-party services.
- Issues in software or infrastructure outside MedOrbits’ control.
- Vulnerabilities in unsupported third-party services that cannot be addressed by MedOrbits.

Scope decisions are made on a case-by-case basis.

## 6. Security Response Process

Maintainers should use the following process when handling a report:

1. **Triage:** Review the report for relevance, reproducibility, and potential impact.
2. **Assessment:** Identify affected components, versions, attack prerequisites, and severity.
3. **Containment:** Apply temporary mitigations when needed to reduce immediate risk.
4. **Remediation:** Develop and review a fix, configuration change, or mitigation.
5. **Verification:** Test the correction and check for related vulnerabilities.
6. **Release:** Distribute the fix through an appropriate release or deployment process.
7. **Disclosure:** Coordinate public disclosure when appropriate and when doing so does not create undue risk.

Response times depend on severity, available evidence, maintainer availability, and remediation complexity. No fixed service-level agreement is implied by this policy.

## 7. Severity and Prioritization

Security issues are prioritized according to factors including:

- Exploitability and attack complexity.
- Required privileges and user interaction.
- Confidentiality, integrity, and availability impact.
- Exposure of production systems or sensitive data.
- Scope of affected components and users.
- Availability of mitigations and active exploitation evidence.

Critical and high-impact vulnerabilities affecting production systems should receive priority. A formal CVSS score may be used when sufficient information is available, but severity decisions also consider the actual deployment context.

## 8. Repository Security Controls

MedOrbits uses or may introduce the following controls as appropriate to the repository:

- GitHub Actions with least-privilege permissions.
- CodeQL static analysis.
- Dependency vulnerability audits.
- JSON, YAML, shell, and configuration validation.
- Automated tests and syntax checks.
- Secret scanning and credential hygiene.
- Pull-request review and controlled production deployment.
- Environment-scoped deployment secrets and approval requirements.
- Security headers, input validation, and access-control checks.
- Logging and audit trails that avoid exposing sensitive information.

The presence of a workflow or configuration file does not, by itself, guarantee that a control is enabled, passing, or effective. Security status must be verified through actual configuration and execution results.

## 9. Secrets and Sensitive Information

Never commit production credentials, private keys, passwords, session secrets, database connection strings containing credentials, or live API tokens.

If a secret is exposed:

1. Revoke or rotate it immediately.
2. Review relevant access logs and usage.
3. Assess whether unauthorized access may have occurred.
4. Remove the exposed value from active configuration.
5. Address repository history and any other copies where appropriate.
6. Store replacement credentials in a managed secret store or approved environment-specific secret configuration.

Deleting a secret from the latest commit does not invalidate it or remove it from repository history, caches, logs, forks, or existing clones.

## 10. Third-Party Dependencies

Dependencies should be maintained using supported versions and reproducible lockfiles where applicable.

Maintainers should:

- Review security advisories and dependency audit results.
- Update vulnerable dependencies when a safe compatible fix is available.
- Review breaking changes before upgrading production dependencies.
- Avoid unreviewed dependency installation or execution during privileged workflows.
- Use trusted package registries and verified workflow actions.
- Prefer immutable commit-SHA pins for third-party GitHub Actions where practical.
- Test dependency changes before production deployment.

Automated audit output must be assessed in context. A passing audit does not establish that an application is free from vulnerabilities.

## 11. Security Updates and Disclosure

When a fix is ready, maintainers may publish a security advisory, release notes, or a coordinated disclosure describing:

- The affected components and versions.
- The impact and severity.
- The corrected versions or mitigations.
- Any required configuration changes.
- Recommended upgrade or recovery steps.

Details that would materially increase exploitation risk may be withheld until affected users have a reasonable opportunity to apply the fix.

Credit may be given to the reporter with their consent.

## 12. Privacy and Data Handling

Security reports should contain only the minimum information necessary to investigate the issue.

Maintainers should:

- Restrict access to confidential vulnerability reports.
- Redact credentials and personal data from logs and reproduction artifacts.
- Avoid copying production data into development or test environments unnecessarily.
- Follow applicable data-protection obligations and internal retention requirements.
- Avoid promising absolute confidentiality beyond the capabilities and policies of the reporting platform.

## 13. Policy Maintenance

This policy should be reviewed periodically and whenever the repository’s security reporting process, production architecture, or supported release model changes.

Policy updates should remain consistent with the repository’s actual practices and capabilities.

—

**MedOrbits Security Policy — Version 2.0.0**

For security issues, use the repository’s private vulnerability reporting feature when available. Do not disclose exploitable details publicly before coordinating with the maintainers.
