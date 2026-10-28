
# MedOrbits GitHub Actions Workflows

This directory contains automation for testing, validation, security, deployment, release management, and repository maintenance.

## Workflow categories

### Continuous integration
- `CI.yml`
- `test.yml`

Run checks on relevant repository events.

### Security
- `codeql.yml`
- `security.yml`
- `security_audit.yml`
- `secret-scan.yml`
- `dependabot-review.yml`
- `dependabot-security-gate.yml`
- `dependency-review.yml`

Audit dependencies, detect potential secrets, and perform configured security checks.

### Deployment
- `deploy.yml`
- `deploy_production.yml`
- `deploy_staging.yml`

Coordinate deployment workflows. Verify environment protection rules and deployment credentials before enabling production deployments.

### Dependency and lockfile management
- `generate-lockfile.yml`
- `lockfile.yml`
- `update-lockfile.yml`

Generate, refresh, or validate npm lockfiles. Review generated changes before merging them.

### Release and publishing
- `release.yml`
- `npm-publish.yml`
- `sync-official-releases.yml`

Manage GitHub releases, optionally publish npm packages, and check configured upstream release versions.

### Validation
- `openapi-lint.yml`
- `validate-config.yml`
- `validate-documents.yml`
- `validate-json.yml`

Validate API specifications, supported configuration formats, documentation, and JSON files.

### Repository maintenance
- `stale_issue.yml`
- `stake_issue.yml`

Label issues and manage stale issues and pull requests.

## Required setup

1. Confirm that workflow filenames match the files actually present in the repository.
2. Review each workflow’s trigger, permissions, and concurrency settings.
3. Add required repository secrets, such as `NPM_TOKEN`, only when the relevant workflow needs them.
4. Configure GitHub Environments and required reviewers for production deployments.
5. Pin third-party actions to verified full commit SHAs when enforcing a hardened supply-chain policy.
6. Validate workflow YAML and test workflows in a non-production branch before enabling production operations.

## Security guidance

- Never commit API keys, access tokens, private keys, or production credentials.
- Prefer `GITHUB_TOKEN` with the minimum permissions required.
- Do not automatically apply dependency upgrades without review.
- Treat security scanner output as a signal requiring investigation, not proof that the repository is secure.
- Protect release and deployment branches with rulesets and required checks.

## Important

A workflow being present in this directory does not guarantee that it is correct for the current repository. Check file paths, package scripts, project structure, action versions, permissions, and deployment settings before relying on it.
