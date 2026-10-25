
# MedOrbits — GitHub Infrastructure

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**Directory:** `infrastructure/github/`  
**Platform:** GitHub and GitHub Actions  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL

—

## 1. Purpose

This directory documents the GitHub infrastructure and repository-management practices used by MedOrbits.

It establishes guidance for:

- Continuous integration (CI) and automated quality checks.
- Deployment workflows and release verification.
- Repository permissions, branch protection, and rulesets.
- GitHub Actions security and secret management.
- Build validation, testing, and deployment readiness.
- Operational troubleshooting, maintenance, and recovery.

The objective is to make repository automation secure, predictable, maintainable, and consistent across development, testing, staging, and production environments.

**Implementation status:** This documentation defines intended standards. Verify the actual workflow files, repository settings, available npm scripts, hosting provider, and deployment configuration before treating any procedure as implemented or enforced.

—

## 2. Directory Contents

| File | Purpose |
|—|—|
| `README.md` | Index for GitHub infrastructure documentation |
| `ci.md` | Continuous integration, automated checks, testing, and quality gates |
| `deployment.md` | Deployment workflows, environment configuration, verification, and rollback |

These files form the intended documentation set. Additional guides may be introduced as the infrastructure evolves.

Creating a documentation file does not automatically create, enable, or enforce a workflow.

—

## 3. Start Here

### Setting up GitHub automation

Read [`ci.md`](ci.md) to understand the recommended workflow for dependency installation, formatting, linting, validation, testing, and build checks.

Before configuring required status checks:

1. Confirm that the relevant npm scripts exist.
2. Verify that the workflow uses the correct Node.js version.
3. Run the workflow successfully on a test branch.
4. Confirm that failed checks produce a failing status.
5. Configure branch protection or repository rulesets to require the intended checks.

### Deploying MedOrbits

Read [`deployment.md`](deployment.md) for deployment preparation, GitHub Actions configuration, environment secrets, database migration safeguards, health checks, and recovery procedures.

Before enabling production deployment, confirm the actual hosting provider, deployment command, required environment variables, database migration procedure, and rollback strategy.

### Reviewing repository security

Review both guides and verify the actual repository settings.

Pay particular attention to:

- Workflow token permissions.
- Production secrets and environment protection.
- Pull-request workflow isolation.
- Branch protection and required status checks.
- Third-party GitHub Actions.
- Production deployment approvals.
- Database and application credentials.
- Access to sensitive repository settings.

—

## 4. Recommended Repository Structure

The following is a reference structure, not a requirement to duplicate files that already exist.

```text
repository-root/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy.yml
│   ├── scripts/
│   ├── ISSUE_TEMPLATE/
│   └── CODEOWNERS
├── .husky/
│   ├── pre-commit
│   ├── commit-msg
│   └── pre-push
├── infrastructure/
│   └── github/
│       ├── README.md
│       ├── ci.md
│       └── deployment.md
├── api/
├── assets/
├── docs/
├── tests/
├── package.json
├── package-lock.json
└── server.js
```

Keep executable GitHub Actions workflow files under `.github/workflows/` at the repository root. Use `infrastructure/github/` for supporting documentation.

The directory tree is illustrative. Do not create duplicate workflows, scripts, or configuration files when equivalent implementations already exist.

—

## 5. Continuous Integration Standards

Continuous integration should provide repeatable evidence that proposed changes satisfy the project’s required quality checks.

Recommended checks include:

1. Dependency installation using the committed lockfile.
2. Code formatting and style checks.
3. Linting.
4. JSON syntax and schema validation.
5. Unit tests.
6. Integration tests where implemented.
7. API contract validation where maintained.
8. Dependency and security checks.
9. Build verification where applicable.
10. Workflow and configuration validation.

### Quality-gate requirements

- Required checks must run on the intended events and branches.
- Failed mandatory checks must fail the workflow.
- Missing scripts must not silently convert required checks into successful checks.
- Integration tests must use an isolated test database and test credentials.
- Test workflows must not require production secrets.
- Branch protection must require the actual status-check names emitted by the workflows.

Optional checks may use conditional execution only when their optional status is intentional and documented.

See [`ci.md`](ci.md) for the detailed CI guide.

—

## 6. Deployment Standards

Production deployment must follow a controlled release process.

Recommended safeguards include:

- Deploy reviewed and approved revisions.
- Require mandatory CI checks to pass.
- Restrict production deployment permissions.
- Store credentials in approved secret-management systems.
- Use protected GitHub Environments where appropriate.
- Apply database migrations through a controlled process.
- Verify application health and critical workflows after deployment.
- Record deployment results and the deployed revision.
- Maintain a tested rollback and recovery procedure.

### Database migration safety

Application rollback does not automatically reverse database migrations.

Prefer backward-compatible migration strategies when application and database changes may be deployed separately. Back up critical data when required by the recovery plan, and verify that restoration procedures are practical.

Do not automatically run destructive migrations in production without explicit safeguards and an approved recovery strategy.

See [`deployment.md`](deployment.md) for the deployment guide.

—

## 7. Security and Access Control

### Repository permissions

Grant repository access according to each contributor’s responsibilities.

- Apply least-privilege access.
- Protect production deployment credentials.
- Review access to repository and environment secrets.
- Restrict bypass permissions for protected branches.
- Require appropriate review for sensitive workflow changes.
- Remove access that is no longer required.
- Review administrative access periodically.

### GitHub Actions permissions

Declare the minimum permissions required by each workflow.

For ordinary read-only CI, the following may be sufficient:

```yaml
permissions:
  contents: read
```

Add permissions only when a workflow requires them. For example, publishing packages or creating releases may require additional permissions, which should be limited to the relevant job whenever practical.

Do not grant repository-wide write access merely for convenience.

### Secret management

Never commit:

- Database connection credentials.
- Session secrets.
- API keys.
- Private keys.
- Production access tokens.
- Sensitive application or user records.
- Unredacted production configuration files.

Never print secrets or complete environment configurations in workflow logs.

Do not expose production credentials to untrusted pull-request code. Forked pull-request workflows must be designed around GitHub’s secret-access restrictions rather than attempts to bypass them.

If a secret is exposed, revoke or rotate it immediately and investigate potential misuse.

### Third-party actions

- Review actions before adoption.
- Prefer trusted, maintained actions.
- Pin actions to reviewed full commit SHAs when stronger supply-chain controls are required.
- Review changes before upgrading action versions.
- Avoid unnecessary third-party actions.
- Restrict write permissions for workflows that only need to test code.
- Review dependencies and action permissions periodically.

—

## 8. Branch Protection and Release Governance

Protect the production branch, commonly `main`, using GitHub branch protection or repository rulesets.

Recommended controls include:

- Require pull requests for changes.
- Require mandatory CI status checks.
- Apply review requirements appropriate to the project.
- Restrict force pushes and branch deletion.
- Limit administrative bypass permissions.
- Require production approval where supported and appropriate.
- Separate deployment permissions from ordinary code-review permissions.
- Protect workflow, security, and dependency-management changes.

The exact configuration depends on the repository’s governance requirements and GitHub capabilities.

A workflow file alone does not enforce branch protection. Configure and verify the corresponding repository settings.

After changing required checks, confirm that the selected status-check names match the actual completed workflow jobs.

—

## 9. Environment and Configuration

Keep development, testing, staging, and production environments separate.

Document only environment variables actually supported by the application, including applicable settings for:

- Database connection configuration.
- Authentication and session management.
- Approved frontend origins.
- Application base URL.
- External-service credentials.
- Logging and monitoring.
- AI integrations, if enabled.
- File storage and upload services, if enabled.

Use GitHub Actions secrets or environment-specific secret stores for sensitive values.

### Configuration requirements

- Commit an `.env.example` containing placeholder values only, when appropriate.
- Never commit production `.env` files.
- Never place server-only credentials in frontend assets.
- Validate required environment variables at application startup.
- Avoid logging secrets, tokens, connection strings, or sensitive personal information.
- Document which settings are required, optional, or environment-specific.
- Use separate credentials for tests and production.

Do not assume a variable exists merely because it appears in an example workflow or documentation.

—

## 10. Operational Verification

After changing GitHub infrastructure, verify the affected behavior in the relevant environment.

### CI verification

- [ ] Workflow files are stored under `.github/workflows/`.
- [ ] Workflow YAML is valid.
- [ ] Dependencies install using the committed lockfile.
- [ ] The expected Node.js version is selected.
- [ ] Required checks execute on the intended events.
- [ ] Failed mandatory checks return a failing status.
- [ ] Pull-request workflows do not expose production secrets.
- [ ] Test jobs use isolated test resources.
- [ ] Branch protection requires the intended status checks.

### Deployment verification

- [ ] The intended branch, tag, or revision is deployed.
- [ ] Required CI checks have passed.
- [ ] Environment configuration is available.
- [ ] Database migrations complete as intended.
- [ ] Health checks pass.
- [ ] Critical API and frontend workflows work.
- [ ] Logs contain no unexpected startup or migration errors.
- [ ] The deployed revision is recorded.
- [ ] Rollback and recovery procedures are documented and reviewed.

### Security verification

- [ ] Workflow permissions follow least privilege.
- [ ] Production credentials are protected.
- [ ] Third-party actions have been reviewed.
- [ ] Deployment approvals are configured where required.
- [ ] Sensitive data is not exposed in logs or public artifacts.
- [ ] Branch protection and bypass permissions are reviewed.
- [ ] Secret rotation procedures are documented.

—

## 11. Troubleshooting

### CI does not run

Check:

- The workflow file is under `.github/workflows/`.
- The YAML syntax is valid.
- The configured trigger matches the branch or event.
- Repository Actions settings permit the workflow to run.
- The workflow has not been disabled.
- Path filters or branch filters are not excluding the change.

### Required status checks are missing

Check:

- The workflow has completed at least once.
- The expected job has run and reported its status.
- The configured status-check name matches the actual job.
- The workflow is enabled.
- The selected ruleset targets the intended branch.
- The required check is reported by the expected GitHub App or integration, where applicable.

### Dependency installation fails

Check:

- `package.json` and `package-lock.json` are synchronized.
- The selected Node.js version meets the project’s requirements.
- The workflow uses `npm ci` when a committed npm lockfile is available.
- Private registry credentials are configured only where needed.
- Native dependencies and system requirements are available in the runner.

### Deployment is blocked

Check:

- Required CI checks have passed.
- The intended branch, tag, or release revision is selected.
- GitHub Environment approval rules are satisfied.
- Required secrets and permissions are configured.
- The hosting provider’s deployment integration is available.
- The hosting provider’s build and runtime logs show no underlying failure.

### Secrets are unavailable

Check:

- The secret name matches the workflow reference.
- The workflow has access to the intended environment.
- Forked pull-request restrictions are being respected.
- Environment protection rules have been satisfied.
- The secret is configured at the correct repository, organization, or environment scope.

Never resolve a deployment problem by printing secrets into logs.

### Deployment succeeds but the application is unhealthy

Check:

- Application startup logs.
- Required environment variables.
- Database connectivity and migration state.
- Health-check endpoint behavior.
- Runtime and dependency compatibility.
- Frontend-to-API configuration.
- Recent code and configuration changes.

Follow the documented recovery procedure if the service cannot be restored safely.

—

## 12. Change Management

When changing GitHub infrastructure:

1. Identify affected workflows and repository settings.
2. Update the relevant documentation.
3. Review permissions and secret-exposure risks.
4. Validate workflow syntax.
5. Test the change in a safe environment.
6. Verify required checks and deployment behavior.
7. Confirm that failure conditions are handled correctly.
8. Update recovery procedures where necessary.
9. Record operationally significant changes through the established review process.

Changes to deployment workflows, permissions, secrets, branch protection, or release controls should receive appropriate review before production use.

—

## 13. Related Documentation

Review these files when available:

### GitHub infrastructure

- [CI Guide](ci.md)
- [Deployment Guide](deployment.md)

### Project documentation

- [Integration Guide](../../docs/INTEGRATION.md)
- [Validation Guide](../../docs/VALIDATION.md)
- [Python Utilities Guide](../../docs/RUNNING_PYTHON.md)
- [Testing Guide](../../docs/TESTING.md)
- [Contributing Guide](../../docs/CONTRIBUTING.md)

### Repository configuration

- [CI Workflow](../../.github/workflows/ci.yml)
- [Deployment Workflow](../../.github/workflows/deploy.yml)

These links assume the documented repository layout. Confirm that each referenced file exists and that its path and capitalization are correct.

If a referenced file does not exist, create it only when it is part of the agreed architecture; do not treat a broken documentation link as proof that an implementation exists.

—

## 14. Maintenance

Review this directory whenever:

- CI workflows or required checks change.
- The hosting provider changes.
- Deployment credentials or permissions change.
- Branch protection or repository rulesets are updated.
- The application runtime or package scripts change.
- Database migration procedures change.
- Third-party GitHub Actions are added or upgraded.
- New security or supply-chain requirements are introduced.
- Incident response or recovery procedures change.

Keep the documentation aligned with the actual workflows, repository settings, application scripts, and deployment procedures.

—

## 15. Final Standard

MedOrbits GitHub infrastructure should support reproducible checks, protected source code, least-privilege automation, verified releases, and recoverable operations.

**Infrastructure principle:** Secure automation, enforceable quality gates, controlled deployments, and documented recovery.

**Document owner:** MedOrbits maintainers  
**Review cadence:** After significant infrastructure changes and periodically  
**Implementation status:** Documentation and recommended standards; verify actual enforcement  
**Document status:** GitHub infrastructure documentation index
