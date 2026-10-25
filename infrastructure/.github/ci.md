
# MedOrbits — Continuous Integration Guide

**Project:** MedOrbits — Education · Medical Admissions · Official Resources · Careers  
**File:** `infrastructure/github/ci.md`  
**Runtime:** Node.js 20+  
**Backend:** Express.js with ES modules  
**Database:** PostgreSQL  
**CI Platform:** GitHub Actions  
**Status:** Engineering standard and implementation guide

—

## 1. Purpose

This document defines the continuous integration (CI) standards for MedOrbits.

CI automatically checks proposed code changes before they are merged or released. The objective is to detect defects early, maintain consistent code quality, protect sensitive information, and ensure that required checks run reliably.

The CI process should cover:

- Dependency installation and runtime compatibility.
- Code formatting and linting.
- JSON and configuration validation.
- Unit and integration testing.
- API contract and schema validation.
- Security and dependency checks.
- Build verification.
- Pull request status reporting.
- Deployment readiness.

**Implementation rule:** A documented check is not considered enforced until the corresponding script or workflow exists, runs successfully, and is configured as a required status check where appropriate.

—

## 2. CI Workflow

Recommended pipeline:

```text
Pull Request / Push
        |
        v
Check Out Source
        |
        v
Set Up Node.js
        |
        v
Install Locked Dependencies
        |
        v
Formatting and Linting
        |
        v
Validate JSON and Schemas
        |
        v
Run Unit Tests
        |
        v
Run Integration Tests
        |
        v
Check API Contracts
        |
        v
Security and Dependency Checks
        |
        v
Build Verification
        |
        v
Required Checks Pass
        |
        v
Eligible for Review and Merge
```

The pipeline must stop when a required check fails.

Some checks may be conditional when a repository does not yet implement the corresponding capability. Conditional checks must not be presented as enforced quality gates.

—

## 3. Recommended Repository Structure

```text
repository-root/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy.yml
│   ├── scripts/
│   │   └── validate-commit-message.sh
│   └── ISSUE_TEMPLATE/
├── .husky/
│   ├── pre-commit
│   ├── commit-msg
│   └── pre-push
├── api/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   ├── middleware/
│   └── schemas/
├── assets/
│   └── data/
├── infrastructure/
│   └── github/
│       ├── ci.md
│       └── deployment.md
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
├── package.json
├── package-lock.json
└── server.js
```

This is a recommended layout. Preserve the repository’s existing conventions and avoid creating duplicate workflows or directories.

—

## 4. Trigger Policy

CI should run on pull requests and on pushes to protected branches.

Recommended events:

- Pull requests targeting `main`.
- Pushes to `main`.
- Manual runs for diagnosis when useful.
- Release events when a release-specific verification process exists.

Use concurrency controls to cancel obsolete checks for the same pull request when safe.

Do not use privileged deployment credentials in ordinary pull-request CI.

—

## 5. Node.js and Dependency Management

MedOrbits requires Node.js 20 or a supported newer version, subject to the runtime policy declared by the project.

### Dependency installation

Use:

```bash
npm ci
```

`npm ci` installs dependencies from the lockfile and fails when the lockfile and package manifest are inconsistent.

Requirements:

- Commit `package-lock.json`.
- Keep dependency changes in reviewed pull requests.
- Do not update dependencies automatically during a normal CI run.
- Avoid relying on globally installed packages.
- Keep CI and production runtime requirements compatible.
- Review dependency advisories and license requirements.

To inspect the available project scripts:

```bash
npm run
```

Do not configure CI to execute commands that are absent from `package.json`.

—

## 6. GitHub Actions Workflow

Create or update:

`.github/workflows/ci.yml`

The following is a baseline workflow. It assumes the repository has an npm lockfile. Replace optional commands with required checks once their scripts have been implemented.

```yaml
name: MedOrbits CI

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: medorbits-ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Code Quality and Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: “20”
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Display available scripts
        run: npm run

      - name: Check formatting
        run: npm run format:check —if-present

      - name: Run lint
        run: npm run lint —if-present

      - name: Validate JSON
        run: npm run validate:json —if-present

      - name: Run unit tests
        run: npm test —if-present

      - name: Build application
        run: npm run build —if-present
```

### Important limitations

The example is a baseline, not a fully enforced production pipeline.

- `—if-present` skips missing npm scripts.
- `npm test —if-present` can pass without executing tests if no test script exists.
- The JSON step only validates JSON if the relevant script actually exists and works.
- The build step is meaningful only if a build script is defined.
- Integration tests may require a separate PostgreSQL service.
- Security scanning is not included in this baseline.

Before making CI checks mandatory, implement the required scripts and remove `—if-present` from checks that must always run.

—

## 7. Required Quality Gates

Once the corresponding scripts exist, configure the following checks as required for protected branches.

| Check | Purpose | Required before merge |
|—|—|—|
| Dependency installation | Confirm dependencies install reproducibly | Yes |
| Formatting | Maintain consistent source formatting | Yes |
| Linting | Detect code-quality issues | Yes |
| JSON validation | Detect malformed JSON resources | Yes, when applicable |
| JSON Schema validation | Verify resource structure | Yes, when schemas are maintained |
| Unit tests | Verify individual functions and services | Yes |
| Integration tests | Verify routes, middleware, and database interactions | Yes, where implemented |
| API contract validation | Detect API documentation or schema errors | Yes, when maintained |
| Build verification | Confirm production packaging succeeds | Yes, when a build step exists |
| Security checks | Detect known dependency and configuration risks | According to security policy |

A check should not be marked as required until it runs reliably and produces a stable status.

—

## 8. JSON and Schema Validation

MedOrbits may use public JSON datasets for courses, colleges, universities, fees, scholarships, jobs, official resources, and other content.

CI should validate:

1. JSON syntax.
2. JSON Schema conformity.
3. Required properties and data types.
4. Allowed enumeration values.
5. Duplicate identifiers.
6. Cross-file references where applicable.
7. Required provenance metadata for time-sensitive information.

Example command, if implemented:

```bash
npm run validate:json
```

The command must fail with a nonzero exit code if a required file is missing or invalid.

JSON syntax validation alone does not prove that admission information, fee values, dates, or eligibility criteria are correct.

For admissions-related information, use the project’s data-verification process and authoritative sources.

—

## 9. Unit Tests

Unit tests should verify individual functions, validators, utilities, and services without requiring a production database.

Coverage should include:

- Valid input.
- Invalid input.
- Boundary values.
- Missing fields.
- Unexpected data types.
- Error handling.
- Business rules.
- Regression cases.

Use the test framework already established by the repository.

Example:

```bash
npm test
```

This command must correspond to a real `test` script in `package.json`.

Do not require an arbitrary coverage threshold without first establishing a reliable baseline. Introduce coverage thresholds incrementally, with particular attention to security-sensitive modules.

—

## 10. Integration Tests

Integration tests verify that application components work together.

Recommended coverage:

- Authentication and session handling.
- Authorization and ownership checks.
- API request validation.
- Database transactions.
- Application submission workflows.
- Job listing and publishing workflows.
- Document upload and access controls.
- Error middleware.
- Rate limiting.
- Notification and background-job integration.

### Test database requirements

- Use a dedicated test database.
- Do not use production credentials.
- Apply the appropriate test schema or migrations.
- Clean up test data safely.
- Avoid running destructive tests against shared production systems.
- Ensure test failures propagate to CI.

If integration tests require PostgreSQL, provision a dedicated CI database service or use an approved isolated test environment.

—

## 11. API Contract Validation

If `api/openapi.yaml` is maintained, validate it as part of CI.

Check that:

- Paths and methods are valid.
- Request schemas are defined.
- Response schemas are documented.
- Authentication requirements are accurate.
- Error responses match implementation behavior.
- Examples conform to their schemas.
- Breaking changes are reviewed explicitly.

Use a validator compatible with the project’s OpenAPI version.

Do not assume that a syntactically valid OpenAPI document accurately represents the deployed API. Where possible, add tests that compare documented contracts with actual endpoint behavior.

—

## 12. Security Checks

Security validation should be layered rather than relying on a single command.

Recommended controls:

- Dependency vulnerability review.
- Secret scanning.
- Static analysis where appropriate.
- Permission checks for GitHub Actions.
- Validation of untrusted inputs.
- Tests for authorization boundaries.
- Review of upload and download controls.
- Checks for accidental publication of private data.
- Review of third-party GitHub Actions.

A dependency audit can be run using:

```bash
npm audit
```

The exact policy for failing CI on vulnerabilities should be documented. Review severity, exploitability, dependency reachability, and available remediation.

Do not automatically run `npm audit fix —force` in CI. Forced dependency changes can introduce breaking upgrades.

Never print secrets or full environment configuration into CI logs.

—

## 13. GitHub Actions Security

Use least-privilege permissions.

For ordinary CI:

```yaml
permissions:
  contents: read
```

Additional permissions should be added only when a workflow requires them.

### Pull request safety

- Do not expose production secrets to untrusted pull requests.
- Avoid running untrusted pull-request code in privileged workflows.
- Do not use `pull_request_target` to check out and execute untrusted code with elevated permissions.
- Pin third-party actions to reviewed commit SHAs when stronger supply-chain assurance is required.
- Review changes to workflow files carefully.
- Restrict production deployment permissions to approved environments.

### Secret handling

Never commit:

- Database credentials.
- Session secrets.
- API keys.
- Private keys.
- Production tokens.
- Sensitive user records.

Store secrets in the appropriate GitHub or hosting-provider secret store.

—

## 14. Python Validation Jobs

Python may be used for optional data-validation or reporting tasks.

If Python checks become part of required CI:

1. Specify the supported Python version.
2. Install dependencies from a reviewed requirements or project configuration file.
3. Run scripts in a controlled environment.
4. Ensure failures produce nonzero exit codes.
5. Add tests for validation scripts.
6. Avoid passing secrets to tasks that do not need them.

For guidance, see `docs/RUNNING_PYTHON.md`, if that file exists in the repository.

Do not make Python a mandatory CI dependency unless a required workflow actually uses it.

—

## 15. Build Verification

If the application has a build step, execute it in CI.

Example:

```bash
npm run build
```

Verify that:

- The build completes successfully.
- Required assets are generated.
- Static files are available at the expected paths.
- Environment-specific values are handled correctly.
- Build output does not contain secrets.
- The application can start using the intended production command.

Do not invent a build script for a project that serves static assets directly and has no build process. Define the intended packaging behavior first.

—

## 16. CI Failure Handling

When a required check fails:

1. Identify the failed workflow and step.
2. Read the relevant error output.
3. Reproduce the failure locally where practical.
4. Correct the underlying issue.
5. Add regression coverage if the failure exposed a defect.
6. Push the correction.
7. Confirm the required checks pass.

Do not bypass a required security or test check merely to merge a change.

If a check is genuinely flaky or unavailable, document the incident, restrict any exception, and restore the check as soon as possible.

—

## 17. Branch Protection and Merge Policy

Configure GitHub branch protection or repository rulesets to require the relevant CI status checks.

Recommended policy:

- Pull requests are required for changes to protected branches.
- Required CI checks must pass.
- Reviews follow the project’s governance policy.
- Direct pushes are restricted as appropriate.
- Force pushes and branch deletion are restricted.
- Production deployment permissions are controlled separately from merge permissions.

Confirm the exact status-check names in GitHub after the workflow has run successfully.

A workflow file alone does not enforce branch protection.

—

## 18. CI Performance and Reliability

Keep CI fast enough to provide useful feedback without removing essential coverage.

Recommended practices:

- Use the npm cache supported by `actions/setup-node`.
- Run independent jobs in parallel where appropriate.
- Set reasonable job timeouts.
- Use deterministic test data.
- Avoid unnecessary external service dependencies.
- Separate fast unit tests from slower integration tests.
- Keep retries limited and explicit.
- Record test and build failures clearly.

Do not hide intermittent failures through unlimited retries or unconditional success steps.

—

## 19. CI Maintenance Checklist

### Configuration

- [ ] Workflow YAML parses correctly.
- [ ] Node.js version matches the project policy.
- [ ] The lockfile is committed.
- [ ] `npm ci` succeeds.
- [ ] Required scripts exist.
- [ ] No production secrets are exposed to pull-request workflows.

### Quality

- [ ] Formatting and linting run successfully.
- [ ] JSON resources are validated.
- [ ] Required schema checks run.
- [ ] Unit tests execute.
- [ ] Integration tests execute where implemented.
- [ ] API contracts are validated where maintained.
- [ ] Build verification runs where applicable.

### Governance

- [ ] Required status checks are configured.
- [ ] Branch protection is enabled as appropriate.
- [ ] Workflow permissions follow least privilege.
- [ ] Production deployment permissions are restricted.
- [ ] Dependency and secret scanning are addressed.
- [ ] Failure handling is documented.

—

## 20. Definition of Done

A CI implementation is ready for enforcement when:

1. Required workflows exist in the repository.
2. Required scripts and dependencies are implemented.
3. Workflow configuration has been validated.
4. Checks execute successfully against representative changes.
5. Failures produce nonzero status codes.
6. Sensitive credentials are protected.
7. Required checks are configured in repository rules.
8. Integration tests use isolated resources.
9. Security-related checks have a documented policy.
10. Maintainers know how to diagnose and resolve failures.

—

## 21. Related Documentation

Review these documents when available:

- `infrastructure/github/deployment.md`
- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `docs/RUNNING_PYTHON.md`
- `docs/TESTING.md`
- `docs/CONTRIBUTING.md`
- `api/openapi.yaml`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `package.json`

Relative paths should be adjusted if the repository uses a different layout.

—

## 22. Final Standard

MedOrbits CI must provide repeatable, meaningful evidence that a change satisfies the project’s quality requirements before it is merged or deployed.

**CI principle:** Reproducible dependencies, enforceable quality gates, isolated tests, least-privilege automation, and transparent failure reporting.
