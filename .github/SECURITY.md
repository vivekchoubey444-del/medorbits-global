
# MedOrbits Security Policy

**Version:** 1.0  
**Effective Date:** 1 November 2026  
**Copyright © 2026 MedOrbits. All rights reserved.**

—

## 1. Introduction

MedOrbits takes the security of its software, infrastructure,
applications and user information seriously.

We appreciate responsible security researchers and contributors
who help identify and report security vulnerabilities.

This policy explains supported versions, reporting procedures
and responsible disclosure expectations.

## 2. Supported Versions

Security updates are prioritized for:

| Version | Security Support |
|—|—|
| Latest stable release | Supported |
| Previous stable release | Evaluated individually |
| Development versions | Best effort |
| Archived releases | Not guaranteed |

Users should upgrade to the latest stable release whenever possible.

## 3. Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues,
pull requests, discussions or social media.**

Use GitHub’s private vulnerability reporting facility:

1. Open the MedOrbits repository.
2. Navigate to the Security tab.
3. Select Advisories.
4. Choose Report a vulnerability.
5. Submit the report privately.

If private vulnerability reporting is unavailable, contact the
repository’s verified security contact through an official channel.

Do not send credentials, production database records or
unnecessary personal information.

## 4. Information to Include

Where possible, provide:

- Vulnerability title and category.
- Affected application component.
- Affected version or commit.
- Security impact and potential consequences.
- Reproduction steps in a controlled environment.
- Proof of concept that does not access real user data.
- Suggested mitigation, if known.

Never include actual passwords, API keys, access tokens,
private keys or personal user records.

## 5. Scope

Potentially reportable security issues include:

- Authentication and authorization weaknesses.
- SQL injection and command injection.
- Cross-site scripting (XSS).
- Cross-site request forgery (CSRF).
- Server-side request forgery (SSRF).
- Insecure direct object references (IDOR).
- Sensitive information disclosure.
- Insecure file uploads.
- Session management vulnerabilities.
- Payment and transaction security flaws.
- API access-control weaknesses.
- Dependency vulnerabilities affecting MedOrbits.
- Security misconfiguration.
- Remote code execution.

## 6. Responsible Disclosure

Security researchers are expected to:

- Avoid accessing or modifying other users’ data.
- Avoid service disruption and denial-of-service testing.
- Avoid destructive testing against production systems.
- Avoid social engineering and phishing.
- Avoid persistence or unauthorized access.
- Keep vulnerability details private until coordinated disclosure.
- Stop testing and report immediately if sensitive data is exposed.

## 7. Response and Remediation

MedOrbits aims to:

1. Acknowledge a valid report within five business days.
2. Review the reported vulnerability.
3. Assess severity and affected components.
4. Coordinate remediation with the reporter.
5. Release fixes or mitigation guidance.
6. Coordinate public disclosure when appropriate.

Response times are targets, not guaranteed service-level commitments.

## 8. Severity Assessment

| Severity | Description |
|—|—|
| Critical | Remote compromise, major data exposure or equivalent impact |
| High | Significant unauthorized access or security compromise |
| Medium | Limited security impact requiring remediation |
| Low | Minor weakness with limited practical impact |

Final severity depends on exploitability, affected assets and
potential impact.

## 9. Security Updates

Security fixes may be distributed through:

- Application releases.
- Dependency updates.
- Infrastructure configuration changes.
- Emergency patches.
- Security advisories.

Users should install security updates promptly.

## 10. Safe Harbor

MedOrbits will consider security research conducted in good faith
and in accordance with this policy.

This statement does not authorize unlawful access, disruption,
data extraction or activities outside the research scope.

## 11. Contact

Use the repository’s private vulnerability reporting feature
as the preferred reporting channel.

For general security questions, use the official MedOrbits
website or verified repository contact information.

—

**MedOrbits Engineering**

Security | Privacy | Reliability

Copyright © 2026 MedOrbits. All rights reserved.
