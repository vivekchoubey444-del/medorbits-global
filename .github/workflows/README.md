
# MedOrbits GitHub Actions Workflows

This directory contains repository validation, security, release, package, and deployment workflows.

## Before enabling workflows

1. Copy this directory into the repository as `.github/workflows/`.
2. Review branch names and path filters against the actual repository.
3. Configure required repository/environment secrets before running deployment or publishing workflows.
4. Configure GitHub branch protection/rulesets for the checks you require.
5. Test changes on a non-production branch before enabling production deployment.

## Important behavior

- `deploy_production.yml` handles automatic production deployment from relevant changes on `main` and confirmed manual runs.
- `deploy.yml` is retained for confirmed manual production deployment only, avoiding two automatic deploy-hook calls for the same push.
- `deploy_staging.yml` handles staging deployment from the `staging` branch and confirmed manual runs.
- `generate-lockfile.yml` generates a lockfile without depending on a lockfile already existing, validates `package.json` as JSON, and only commits on eligible non-pull-request events.
- Publishing/release workflows require explicit manual confirmation.
- Workflows using third-party actions still use major-version tags (for example `@v4`); for higher supply-chain assurance, pin actions to reviewed full commit SHAs.

## Required secrets and environment configuration

Review the workflow files for their exact names before configuring secrets. Common deployment workflows expect Render deploy-hook secrets. Do not commit secret values into this repository or print them in logs.

## Validation

The YAML files should be parsed and reviewed after changes. YAML syntax validation alone does not guarantee that GitHub accepts every expression, action input, permission, secret, or environment configuration. Validate the workflows in a test branch and review the Actions logs.
