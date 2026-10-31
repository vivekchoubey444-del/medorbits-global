
# MedOrbits — Contribution Guidelines

**Version:** 1.0.0  
**Effective Date:** 1 November 2026  
**Project:** MedOrbits  
**Copyright © 2026 MedOrbits. All rights reserved.**

—

## 1. Welcome

Thank you for your interest in contributing to MedOrbits.

MedOrbits is an integrated education, admissions, career guidance,
recruitment and technology platform.

We welcome contributions that improve:

- Education and learning services.
- MBBS, BDS and AYUSH admissions information.
- Colleges and university information.
- Entrance examination resources.
- Scholarships and financial assistance.
- Jobs and recruitment services.
- Career guidance and professional development.
- Frontend and backend functionality.
- APIs and integrations.
- Security and privacy.
- Accessibility and performance.
- Documentation and infrastructure.

All contributions must follow these guidelines.

## 2. Before Contributing

Before making changes:

1. Read this document.
2. Review the repository README.
3. Check existing issues and pull requests.
4. Identify the relevant application module.
5. Confirm that your proposed change is within project scope.
6. Avoid duplicating existing functionality.

For major architectural changes, open an issue or discussion
before starting implementation.

## 3. Repository Access

Contributors should use their own GitHub accounts.

Never share:

- GitHub passwords.
- Personal access tokens.
- SSH private keys.
- API credentials.
- Production database credentials.
- Deployment secrets.

Use GitHub’s authorized contribution mechanisms.

## 4. Development Requirements

Recommended development environment:

| Requirement | Recommended Version |
|—|—|
| Node.js | 20 or later |
| npm | Version compatible with Node.js |
| Python | 3.10 or later |
| Git | Latest stable |
| Operating System | Windows, macOS or Linux |

Check installed versions:

```bash
node —version
npm —version
python —version
git —version
```

Use the versions and package manager specified by the actual
repository configuration when they differ from these recommendations.

## 5. Setting Up the Project

Clone the repository:

```bash
git clone https://github.com/vivekchoubey444-del/MedOrbits.git
```

Enter the project directory:

```bash
cd MedOrbits
```

Install locked dependencies:

```bash
npm ci
```

Create a local environment file if the project provides
an environment example:

```bash
cp .env.example .env
```

On Windows Command Prompt:

```cmd
copy .env.example .env
```

Configure only the environment variables required for local
development.

Never copy production credentials into a development environment.

Start the application using the scripts defined in `package.json`.

For example, if available:

```bash
npm run dev
```

Do not assume a script exists unless it is defined in the project.

## 6. Branching Strategy

Do not commit directly to protected production branches.

Create a dedicated branch for each contribution.

Recommended branch naming:

| Change | Branch Prefix |
|—|—|
| New feature | `feature/` |
| Bug fix | `fix/` |
| Documentation | `docs/` |
| Security | `security/` |
| Refactoring | `refactor/` |
| Performance | `perf/` |
| Maintenance | `chore/` |
| Testing | `test/` |

Examples:

```bash
git checkout -b feature/student-dashboard
```

```bash
git checkout -b fix/admission-search
```

```bash
git checkout -b docs/api-documentation
```

Keep each branch focused on one logical change.

## 7. Coding Standards

### General

- Write clear and maintainable code.
- Use descriptive variable and function names.
- Avoid unnecessary duplication.
- Prefer modular architecture.
- Preserve existing application conventions.
- Remove temporary debugging statements.
- Handle errors explicitly.
- Avoid unnecessary dependencies.
- Keep changes focused and reviewable.

### JavaScript and TypeScript

- Use strict mode where applicable.
- Prefer `const` for values that are not reassigned.
- Use `let` only when reassignment is required.
- Avoid unnecessary global variables.
- Validate external input.
- Use asynchronous error handling.
- Avoid exposing internal errors or secrets to users.
- Keep API and business logic separated.

### Python

- Follow PEP 8 conventions.
- Use meaningful function and variable names.
- Add type annotations where useful.
- Handle exceptions appropriately.
- Avoid hardcoded paths and credentials.

### HTML and CSS

- Use semantic HTML.
- Maintain accessible markup.
- Support responsive layouts.
- Preserve existing design-system conventions.
- Avoid unnecessary inline styles.
- Ensure sufficient text contrast.
- Avoid breaking existing page navigation.

### JSON

- Use valid JSON syntax.
- Avoid duplicate object keys.
- Maintain consistent naming conventions.
- Preserve established data structures.
- Validate JSON before submission.

## 8. Frontend Contributions

Frontend changes should:

- Preserve existing page structures unless the change requires otherwise.
- Maintain responsive behavior.
- Support mobile and desktop layouts.
- Use accessible labels and controls.
- Avoid broken navigation.
- Optimize images and assets.
- Avoid unnecessary JavaScript dependencies.
- Maintain consistent design-system usage.

Test the affected pages before submitting.

## 9. Backend and API Contributions

Backend changes should:

- Follow the existing controller, service and route architecture.
- Validate request parameters.
- Enforce authentication where required.
- Enforce authorization independently of authentication.
- Validate uploaded files.
- Use parameterized database queries.
- Handle database errors safely.
- Avoid returning internal stack traces.
- Apply appropriate rate limits.
- Document API behavior when it changes.

Never trust client-side validation as the only security control.

## 10. Database Changes

For database-related contributions:

- Include migration scripts when required.
- Avoid destructive changes without a migration plan.
- Preserve existing data where possible.
- Document schema changes.
- Consider backward compatibility.
- Test migration and rollback procedures.
- Never commit real production database records.

Do not run migrations against production without authorization.

## 11. Education and Admissions Data

Contributions involving admissions, educational institutions,
examinations, fees or scholarships must prioritize accuracy.

Contributors should:

- Use reliable and authoritative sources.
- Include relevant source references.
- Identify the academic year.
- Distinguish official information from estimates.
- Clearly indicate when information requires verification.
- Avoid presenting outdated cutoffs or fee structures as current.
- Avoid guaranteeing admission or employment outcomes.

For regulated admissions information, prioritize the relevant
official government, university, examination or regulatory source.

## 12. Jobs and Recruitment

Contributions involving employment and recruitment must:

- Present job eligibility accurately.
- Identify relevant application deadlines.
- Avoid fabricated job vacancies.
- Avoid misleading salary claims.
- Respect candidate privacy.
- Avoid exposing applicant documents or personal information.
- Clearly distinguish verified opportunities from unverified listings.

## 13. Security Requirements

Security is mandatory for every contribution.

Never commit:

- `.env` files containing real credentials.
- API keys.
- Access tokens.
- Passwords.
- Private keys.
- Production database dumps.
- Sensitive personal records.

Before submitting:

- Validate authentication and authorization.
- Check input validation.
- Review file upload handling.
- Review API access controls.
- Check dependency changes.
- Remove sensitive logging.
- Consider common web vulnerabilities.

For security vulnerabilities, follow `SECURITY.md`.

Do not disclose vulnerabilities through public issues.

## 14. Testing Requirements

Run relevant checks before submitting.

Example repository validation:

```bash
python .github/scripts/validate-repository.py
```

JSON validation:

```bash
python .github/scripts/validate-json.py —recursive
```

Environment example validation:

```bash
python .github/scripts/check-env-example.py
```

Secret scanning:

```bash
python .github/scripts/check-secrets.py
```

Link validation:

```bash
python .github/scripts/check-links.py
```

JavaScript syntax checks:

```bash
node —check .github/scripts/dependency-report.js
node —check .github/scripts/ci-summary.js
```

Shell syntax checks:

```bash
bash -n .github/scripts/validate-commit-message.sh
```

Commit-message tests:

```bash
bash .github/scripts/test-validate-commit-message.sh
```

Run the relevant application tests as defined in `package.json`.

Report any checks that could not be executed.

Do not claim that tests passed unless they were actually run.

## 15. Commit Message Convention

MedOrbits uses Conventional Commit-style messages.

Format:

```text
type(scope): description
```

Examples:

```text
feat(auth): add student registration
fix(api): handle missing response
docs(readme): update installation guide
security(auth): improve token validation
test(api): add admission endpoint tests
refactor(database): simplify query service
perf(search): optimize college lookup
chore(deps): update npm dependencies
```

Supported types:

- `feat`
- `fix`
- `docs`
- `style`
- `refactor`
- `perf`
- `test`
- `build`
- `ci`
- `chore`
- `revert`
- `security`

Keep commit subjects clear and concise.

## 16. Pull Request Requirements

Submit contributions through pull requests.

A pull request should:

1. Explain the problem being solved.
2. Describe the implementation.
3. Reference related issues.
4. Include testing details.
5. Identify breaking changes.
6. Document migration requirements.
7. Identify deployment implications.
8. Include screenshots for relevant UI changes.
9. Disclose security implications.

Use the repository pull-request template.

Do not combine unrelated changes in one pull request.

## 17. Code Review

Contributors should:

- Respond constructively to review comments.
- Explain implementation decisions.
- Address requested changes.
- Keep pull requests updated.
- Resolve conflicts carefully.
- Avoid force-pushing shared branches without coordination.

Approval and merging remain subject to repository permissions
and branch protection rules.

## 18. Dependencies

When adding or updating dependencies:

- Explain why the dependency is necessary.
- Prefer maintained packages.
- Review licenses and security advisories.
- Avoid unnecessary package duplication.
- Update `package.json`.
- Update `package-lock.json` when applicable.
- Verify installation using `npm ci`.

Do not introduce packages with known critical vulnerabilities
without an approved mitigation.

## 19. Documentation

Update documentation when changing:

- Installation procedures.
- Environment variables.
- APIs.
- Database schemas.
- Configuration.
- Application behavior.
- Deployment procedures.
- Security controls.

Documentation must match the actual implementation.

## 20. Prohibited Contributions

The following are not acceptable:

- Malicious code.
- Credential harvesting.
- Unauthorized access functionality.
- Hidden data collection.
- Malware or spyware.
- Deliberate security weaknesses.
- Fabricated admissions or job information.
- Copyright-infringing material.
- Unnecessary collection of personal information.
- Deliberately destructive scripts.

## 21. Licensing and Intellectual Property

Contributions are subject to the repository’s applicable
license and contribution requirements.

Contributors must:

- Have the right to submit contributed code.
- Respect third-party licenses.
- Avoid copying proprietary code without authorization.
- Identify third-party assets and dependencies.
- Avoid submitting confidential material.

Submission of a pull request does not automatically transfer
ownership of unrelated intellectual property.

## 22. Reporting Problems

Use the appropriate GitHub issue template:

- Bug Report
- Feature Request
- Question / Technical Support
- Documentation Improvement

For security vulnerabilities, use the private reporting
process described in `SECURITY.md`.

## 23. Final Checklist

Before submitting your pull request:

- [ ] I reviewed these contribution guidelines.
- [ ] I used an appropriate branch.
- [ ] I followed the repository coding conventions.
- [ ] I tested the affected functionality.
- [ ] I validated relevant JSON and configuration files.
- [ ] I did not commit credentials or private information.
- [ ] I updated relevant documentation.
- [ ] I used a valid commit message.
- [ ] I completed the pull-request template.
- [ ] I disclosed breaking changes and deployment requirements.

—

## 24. Contact and Governance

Contribution review, approval and merging are managed through
the repository’s authorized maintainers.

Official repository:

https://github.com/vivekchoubey444-del/MedOrbits

Official website:

https://medorbits.in

—

**MedOrbits Engineering**

Education | Admissions | Careers | Recruitment | Technology

Copyright © 2026 MedOrbits. All rights reserved.
