
# MedOrbits GitHub Scripts

Repository maintenance, validation, security-checking, and reporting utilities used by MedOrbits automation workflows.

These scripts are designed to support the MedOrbits education and admissions platform while preserving existing website pages, filenames, navigation, styling, and application behavior.

## 1. Directory Structure

```text
.github/
└── scripts/
    ├── README.md
    ├── check-env-example.py
    ├── check-links.py
    ├── check-secrets.py
    ├── ci-summary.js
    ├── dependency-report.js
    ├── validate-json.py
    └── validate-repository.py
```

This is the expected structure for the scripts documented here. Keep the directory listing synchronized with the actual repository; do not create placeholder files solely to match this list.

## 2. Requirements

- Python 3.10 or later is recommended.
- Node.js 20 or later is required for the JavaScript reporting utilities.
- Git is recommended for repository-aware checks.
- Python validation utilities primarily use the standard library.
- Node.js utilities may use installed project dependencies where specified.

No script should install dependencies, deploy the application, modify production data, or rewrite source files unless that behavior is explicitly documented.

## 3. Available Scripts

| Script | Purpose |
|—|—|
| `check-env-example.py` | Check `.env.example` and environment-variable references for common configuration inconsistencies. |
| `check-links.py` | Detect broken local links and references in supported website and documentation files. |
| `check-secrets.py` | Scan files for common patterns associated with accidentally exposed credentials. |
| `ci-summary.js` | Generate a GitHub Actions job summary from available results. |
| `dependency-report.js` | Generate a dependency inventory and optional audit report. |
| `validate-json.py` | Validate JSON syntax, encoding, and duplicate object keys. |
| `validate-repository.py` | Check repository structure, JSON and Python syntax, selected configuration files, and common hygiene issues. |

Script behavior depends on the implementation and supplied arguments. A successful check does not prove that the entire application is secure, accessible, or functionally correct.

## 4. Running the Validators

Run commands from the repository root.

### Validate JSON files

```bash
python .github/scripts/validate-json.py —recursive —strict \
  —exclude node_modules \
  —exclude .git
```

### Validate repository structure and syntax

```bash
python .github/scripts/validate-repository.py
```

For stricter checks and the optional secret scan:

```bash
python .github/scripts/validate-repository.py \
  —strict \
  —scan-secrets
```

### Check environment configuration

```bash
python .github/scripts/check-env-example.py
```

### Check local links

```bash
python .github/scripts/check-links.py
```

### Scan for potential secrets

```bash
python .github/scripts/check-secrets.py
```

### Generate a dependency report

```bash
node .github/scripts/dependency-report.js
```

### Generate a CI summary

```bash
node .github/scripts/ci-summary.js
```

Check each script’s `—help` output or source documentation before supplying optional arguments. Commands above assume the corresponding files exist and support the stated invocation.

## 5. Integration with GitHub Actions

Workflows belong in:

```text
.github/workflows/
```

A workflow may call these utilities during pull-request checks or pushes to the default branch.

Recommended validation order:

1. Check out the repository.
2. Set up supported Python and Node.js versions.
3. Install dependencies only when required by the selected checks.
4. Run syntax, JSON, link, and configuration validation.
5. Run automated tests.
6. Run dependency and security checks.
7. Upload useful reports as workflow artifacts when appropriate.

Use explicit permissions and grant only the minimum permissions required. Do not expose secrets in logs or pass production credentials to untrusted pull-request code.

## 6. Exit Codes and Reports

Python validation utilities should return:

- `0` — validation passed.
- `1` — validation errors were detected.
- `2` — an invocation, configuration, or report-writing failure occurred, where implemented.

JavaScript utilities may use different exit-code conventions. Check each script before relying on its exit status in a workflow.

JSON reports and GitHub Actions summaries are optional outputs. Store generated reports in a designated output directory, and avoid committing transient reports unless they are intentionally maintained as project artifacts.

## 7. Safety and Security

- Never commit real API keys, database credentials, access tokens, private keys, or production `.env` files.
- Keep `.env.example` limited to variable names and safe placeholder values.
- Treat secret-scanner findings as leads for manual investigation; false positives are possible.
- Rotate credentials immediately if they have been exposed.
- Do not automatically apply dependency upgrades in production without review and testing.
- Review third-party workflow actions and pin them to appropriate immutable references where practical.
- Do not interpret a clean static scan as a security certification.

## 8. Maintenance Rules

When adding or changing a script:

1. Use the naming and directory conventions already present in the repository.
2. Document its purpose, prerequisites, supported arguments, and exit codes.
3. Prefer read-only checks and clear error messages.
4. Avoid hard-coded absolute paths, credentials, and machine-specific settings.
5. Handle missing files and optional project components gracefully.
6. Keep output suitable for both local use and automated CI logs.
7. Add tests for important validation logic.
8. Update this README when script names or behavior change.
9. Preserve existing website functionality and project structure.
10. Do not claim that a check has passed unless it has actually run successfully.

## 9. Troubleshooting

**Python cannot find a file:** Run commands from the repository root and confirm the exact path and filename.

**A validator reports a missing file:** Confirm whether the file is required for this project configuration before creating it. Some checks intentionally report optional files.

**JSON validation fails:** Inspect the reported line and column. Standard JSON does not support comments or trailing commas.

**A link check fails:** Confirm the target exists, the path is relative to the correct file or configured base, and any fragment identifier matches the target.

**A security scan reports a possible secret:** Inspect the matching line without copying the credential into logs or issue comments. Revoke exposed credentials when necessary.

**A workflow fails:** Review its logs, required runtime versions, repository permissions, and expected paths.

## 10. Scope

These utilities support repository quality and maintenance. They do not replace application tests, accessibility testing, dependency review, deployment verification, database backup procedures, or a professional security assessment.

Maintain this directory as a collection of small, predictable tools that help keep MedOrbits reliable without unexpectedly changing the application.
