
# MedOrbits Security Policy

## Supported Versions

Security fixes are prioritized for the latest maintained version of MedOrbits.

Older versions may not receive security updates. Users should upgrade to the latest maintained version whenever possible.

## Reporting a Vulnerability

Please do not disclose exploitable vulnerabilities, credentials, API keys, personal information, or security-sensitive logs in public issues, discussions, or pull requests.

Report suspected vulnerabilities through GitHub’s **private vulnerability reporting** feature, if enabled for this repository.

If private vulnerability reporting is unavailable, contact the repository maintainers through an established private communication channel. Do not publish sensitive exploit details while seeking a reporting channel.

### Information to Include

When reporting a vulnerability, provide as much of the following information as safely possible:

- **Summary:** A clear description of the suspected vulnerability.
- **Affected component:** The affected file, service, endpoint, dependency, or version.
- **Reproduction steps:** Minimal steps to reproduce the issue in an authorized test environment.
- **Security impact:** Potential confidentiality, integrity, or availability consequences.
- **Evidence:** Sanitized logs, screenshots, or proof-of-concept details that do not expose real user data or secrets.
- **Suggested mitigation:** Any known workaround or remediation, if available.

Never include real passwords, access tokens, API keys, private user data, or production credentials in a report. Replace sensitive values with clearly marked placeholders.

## Responsible Disclosure

- Test only systems you own or are explicitly authorized to assess.
- Avoid accessing, modifying, or deleting other users’ data.
- Do not perform denial-of-service testing or other disruptive actions against production systems.
- Give maintainers a reasonable opportunity to investigate and address a reported issue before public disclosure.
- Coordinate public disclosure with maintainers where practical, taking applicable legal and safety considerations into account.

## Handling and Remediation

Maintainers should assess reported vulnerabilities, determine affected components, prioritize remediation according to severity and impact, and communicate relevant fixes or mitigations when appropriate.

Any exposed credential should be revoked or rotated promptly. Removing a secret from the latest commit alone does not invalidate it.

## Scope

This policy applies to security vulnerabilities affecting the MedOrbits repository, its maintained application code, configuration, and associated services.

Do not assume that third-party services or infrastructure are covered by this policy. Report issues affecting those systems to their respective owners under their applicable security policies.
