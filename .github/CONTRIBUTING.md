
# MedOrbits — Contribution Guidelines

Thank you for contributing to **MedOrbits**, an education and career guidance platform covering courses, colleges, medical admissions, scholarships, study abroad, and employment opportunities.

These guidelines help maintain code quality, accessibility, security, compatibility, and consistency across the repository.

## 1. Before You Contribute

Before creating a change:

- Review the root `README.md` and relevant project documentation.
- Search existing issues and pull requests for related work.
- For significant changes, open an issue or discussion before implementation.
- Confirm that your proposed change fits the scope of MedOrbits.
- Never include passwords, API keys, private documents, personal records, or production credentials.

For bugs, use the GitHub **Bug Report** form.

For new functionality, use the **Feature Request** form.

For security vulnerabilities, follow the private reporting instructions in `SECURITY.md` or the repository’s Security tab. Do not publish exploitable vulnerability details in a public issue.

## 2. Repository Structure

Follow the existing directory organization. Common areas include:

| Path | Responsibility |
| — | — |
| `index.html` | Main website entry point |
| `pages/` | Public website pages |
| `assets/css/` | Stylesheets and design systems |
| `assets/js/` | Frontend behavior and utilities |
| `assets/images/` | Images, icons, and visual assets |
| `data/` | JSON catalogs and structured content |
| `server/` | Backend API and server-side modules |
| `scripts/` | Validation, maintenance, and build utilities |
| `tests/` | Automated tests |
| `.github/` | Issue forms, workflows, and repository policies |
| `docs/` | Technical and user documentation |

This is a reference, not permission to reorganize existing files arbitrarily. Follow the actual repository structure and established import paths.

## 3. Preserve Existing Website Behavior

Unless a change explicitly requires otherwise:

- Preserve existing page structures, filenames, navigation, and working functionality.
- Do not replace established pages with generic templates.
- Do not force a fixed card layout or redesign unrelated sections.
- Maintain existing branding, typography, and color schemes.
- Use page-specific styling when required instead of introducing conflicting global rules.
- Preserve working internal links, forms, search, filters, and responsive behavior.
- Avoid unnecessary dependencies and duplicate implementations.
- Do not remove existing features without documenting the reason and scope.

For visual changes, check mobile, tablet, and desktop layouts.

## 4. HTML, CSS, and JavaScript Standards

### HTML

- Use semantic HTML5 elements.
- Include appropriate metadata, page titles, and viewport configuration.
- Use meaningful headings in a logical hierarchy.
- Provide accessible labels for form controls.
- Add useful alternative text to informative images.
- Avoid duplicate IDs and broken internal links.
- Escape or safely render untrusted user-provided content.

### CSS

- Follow the existing design tokens and stylesheet conventions.
- Avoid unnecessary global selectors and `!important` declarations.
- Keep layouts responsive and prevent horizontal overflow.
- Preserve readable contrast, visible focus indicators, and reduced-motion support.
- Avoid inline styles when an existing stylesheet or component pattern is appropriate.

### JavaScript

- Follow the existing module system and coding conventions.
- Use descriptive names and small, maintainable functions.
- Handle expected errors and invalid inputs.
- Avoid polluting the global namespace.
- Do not use `eval()` or construct executable code from untrusted input.
- Do not expose secrets in client-side JavaScript.
- Clean up event listeners and other resources where appropriate.

## 5. JSON Catalogs and Data Integrity

When editing files under `data/`:

- Keep JSON syntactically valid.
- Preserve established field names and record structures unless a schema change is intentional.
- Use consistent IDs and prevent duplicate identifiers.
- Verify references between related catalogs, such as courses, colleges, universities, fees, and scholarships.
- Use valid URLs and accurate, traceable information.
- Distinguish verified information from estimates or unconfirmed details.
- Include source and update-date metadata where the existing schema supports it.
- Do not fabricate admission dates, fees, accreditation details, rankings, eligibility requirements, or scholarship availability.

If a schema changes, update dependent code, validation rules, documentation, and tests together.

## 6. Backend and API Changes

For backend work:

- Follow the existing server architecture and route conventions.
- Validate all incoming data on the server.
- Apply authentication and authorization checks where required.
- Use parameterized database queries or the project’s established safe database abstraction.
- Avoid returning internal stack traces or sensitive configuration to clients.
- Apply appropriate request-size limits, rate limits, and security headers.
- Use environment variables for secrets and deployment-specific configuration.
- Update API documentation and tests when endpoints or response formats change.

Never commit a real `.env` file, database password, private key, access token, or production user data.

## 7. PWA and Offline Support

For changes to the web app manifest, service worker, caching, or offline pages:

- Preserve the existing public URL structure.
- Ensure manifest and icon paths point to real files.
- Keep the service worker’s cache version and precache list consistent.
- Avoid caching authenticated pages, private user data, or sensitive API responses.
- Provide a useful offline fallback where appropriate.
- Verify that updated assets can be loaded after deployment.
- Do not cache responses marked `no-store` or other responses prohibited by the application’s caching policy.

Do not claim that a feature works offline unless its required resources and behavior have been tested offline.

## 8. Accessibility and Localization

Contributions should:

- Support keyboard navigation and visible focus.
- Use accessible names and labels for interactive controls.
- Avoid communicating information through color alone.
- Respect reduced-motion preferences.
- Preserve existing translation keys and localization conventions.
- Avoid hard-coding user-facing text when the relevant translation system is already in use.
- Ensure text remains readable at different screen sizes and zoom levels.

## 9. Security and Privacy

All contributions must follow these principles:

- Collect only the personal information needed for the intended purpose.
- Never log passwords, authentication tokens, payment credentials, or sensitive documents.
- Avoid exposing personal information in public URLs, analytics, error messages, or logs.
- Do not weaken authentication, authorization, validation, or security controls to make tests pass.
- Review dependency changes for compatibility and known vulnerabilities.
- Do not add tracking, external scripts, or data-sharing integrations without appropriate justification and review.
- Use synthetic data in tests and examples.

If you accidentally expose a secret, revoke or rotate it immediately. Removing it from a later commit does not guarantee that it has disappeared from Git history.

## 10. Python Utilities and Automation

For Python scripts:

- Prefer the standard library when practical.
- Keep scripts compatible with the Python version documented by the project.
- Use clear error messages and appropriate exit codes.
- Avoid destructive operations unless explicitly required and safely guarded.
- Do not overwrite user files or rewrite repository content unexpectedly.
- Make automated fixes deterministic and reviewable.
- Add tests for important validation and transformation logic.

Automation must not silently delete project files, force-push changes, or deploy to production without explicit authorization.

## 11. Dependencies

Before adding or upgrading a dependency:

- Check whether an existing dependency already provides the required capability.
- Confirm compatibility with the supported Node.js or Python version.
- Prefer maintained packages from trustworthy sources.
- Update the appropriate manifest and lockfile together.
- Explain material dependency changes in the pull request.
- Review relevant security advisories and license compatibility.

Do not commit generated dependency directories such as `node_modules/` or virtual environments.

## 12. Testing and Validation

Run the relevant checks for the areas you changed. Where available, use the repository’s existing scripts:

```bash
npm run validate:python
npm run validate:catalogs
npm run validate:integrity
npm run validate:html
npm run validate:links
npm run validate:i18n
npm run validate:pwa
npm test
```

These commands are examples based on the project’s configured scripts. Check the root `package.json` and the applicable script files before relying on a command; not every repository version will contain every script.

For backend changes, also run the relevant API and integration tests.

For frontend changes, inspect the affected pages and browser console.

For data changes, verify JSON syntax, schemas, and cross-catalog references.

Report checks that could not be completed. Never claim a test passed if it was not run successfully.

## 13. Branch and Commit Conventions

Use descriptive branch names, for example:

- `feature/course-filters`
- `fix/mobile-navigation`
- `docs/api-setup`
- `test/catalog-validation`
- `security/redact-error-logs`

Use clear commit messages, for example:

```text
feat: add course filtering
fix: correct scholarship catalog links
docs: clarify local development setup
test: validate college identifiers
security: redact sensitive API errors
```

These prefixes are recommended conventions; follow any stricter commit rules enforced by repository automation.

Keep commits focused and avoid including unrelated formatting or generated-file changes.

## 14. Pull Request Requirements

A pull request should include:

1. A concise description of the change.
2. The problem being solved and its expected benefit.
3. Relevant issue references, where applicable.
4. A summary of important implementation decisions.
5. Testing and validation results.
6. Screenshots for meaningful visual changes.
7. Data migrations, schema changes, or deployment considerations, if applicable.
8. Any known limitations or follow-up work.

Before submitting:

- Review your complete diff.
- Remove temporary files, debugging output, secrets, and unrelated changes.
- Confirm that links and affected pages still work.
- Update documentation and tests where necessary.
- Resolve merge conflicts without discarding unrelated work.

Do not merge your own pull request if repository protection rules require approval.

## 15. Documentation

Update relevant documentation when a change affects:

- Installation or development setup.
- Environment variables or configuration.
- Public routes or API contracts.
- Data schemas or catalog formats.
- PWA behavior or caching.
- Security requirements.
- Build, validation, or deployment procedures.

Use relative links for files within the repository when practical.

## 16. Review and Maintainer Decisions

Maintainers may request changes, additional tests, clarification, or a narrower scope.

A contribution may be declined if it introduces security or privacy risks, breaks existing behavior, duplicates existing functionality, lacks sufficient justification, or falls outside the project’s scope.

Submitting a contribution does not guarantee acceptance or a particular release date.

## 17. License and Attribution

By submitting a contribution, you confirm that you have the right to contribute the material and that you have reviewed the repository’s license and applicable contribution terms.

Do not submit copied content, images, datasets, or code without the necessary rights and attribution.

## 18. Questions

For general questions, use the repository’s Discussions feature if enabled.

For reproducible defects, open a bug report.

For proposed improvements, open a feature request.

For security concerns, use the private reporting channel described in `SECURITY.md`.

Thank you for helping make MedOrbits more reliable, accessible, secure, and useful.
