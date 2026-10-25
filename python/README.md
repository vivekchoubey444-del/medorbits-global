
# MedOrbits — Python Engineering Toolkit

**Directory:** `python/`  
**Python:** 3.12+  
**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**Website:** https://www.medorbits.in/  
**Purpose:** Repository automation, data validation, integration management, and automated testing.

—

## 1. Overview

The MedOrbits Python Engineering Toolkit provides reusable utilities for maintaining repository integrity, validating datasets, analyzing dependencies, managing integrations, and running automated tests.

It is designed around five engineering principles:

- **Security:** Protect credentials, personal data, and production resources.
- **Reliability:** Validate inputs, handle failures explicitly, and test expected behavior.
- **Maintainability:** Use focused modules, stable interfaces, and shared utilities.
- **Data integrity:** Preserve existing files and validate generated content.
- **Transparency:** Distinguish intended functionality from functionality that has been implemented and verified.

This document describes the intended architecture. The existence and behavior of individual files must be verified against the actual repository.

## 2. Directory Structure

```text
python/
├── README.md
├── scripts/
├── tools/
│   ├── repository_integrity.py
│   ├── structure_adapter.py
│   ├── dependency_binder.py
│   ├── data_source_manager.py
│   └── repository_scaffolder.py
├── integrations/
│   ├── __init__.py
│   ├── base.py
│   ├── config.py
│   ├── exceptions.py
│   ├── registry.py
│   ├── http_client.py
│   ├── health.py
│   ├── api_client.py
│   ├── storage_client.py
│   ├── repository_integration.py
│   ├── education/
│   ├── admissions/
│   ├── recruitment/
│   ├── notifications/
│   └── storage/
└── tests/
    ├── README.md
    ├── test_base.py
    ├── test_config.py
    ├── test_exceptions.py
    ├── test_http_client.py
    ├── test_registry.py
    ├── test_suite_runner.py
    ├── test_import_export.py
    ├── test_json_data.py
    └── test_validators.py
```

This is the intended structure, not a verified inventory. Confirm the existence of files, packages, and nested modules before importing them or referencing them in automation.

## 3. Component Responsibilities

| Component | Responsibilities |
|—|—|
| `scripts/` | Repeatable development, maintenance, and operational workflows |
| `tools/` | Repository inspection, structure analysis, dependency mapping, data-source management, and scaffolding |
| `integrations/` | Shared infrastructure and adapters for authorized external services |
| `tests/` | Unit, regression, validation, and utility tests |

Each component should have a clearly defined responsibility. Prefer extending existing implementations over introducing duplicate functionality.

### 3.1 Repository tools

- `repository_integrity.py`: inspect repository consistency and report structural or configuration issues.
- `structure_adapter.py`: analyze source and target structures and identify potential adaptations.
- `dependency_binder.py`: inspect declared dependencies, references, and integration points.
- `data_source_manager.py`: validate and manage supported data sources.
- `repository_scaffolder.py`: create eligible files and directories according to explicit generation rules.

These descriptions define intended responsibilities. Actual features, command-line options, and side effects must be documented by the corresponding implementations.

## 4. Runtime and Dependencies

### Requirements

- Python 3.12 or later.
- A working installation of the project’s declared dependencies.
- Execution from the appropriate repository root.
- Environment-specific configuration for external services.
- Automated tests for implemented functionality.

Check the active interpreter:

```bash
python —version
python -m pip —version
```

Install dependencies using the repository’s actual dependency configuration. For example, if `requirements-dev.txt` exists:

```bash
python -m pip install -r requirements-dev.txt
```

If the project uses `pyproject.toml`, follow its declared build system and dependency groups instead. Do not introduce a second dependency-management approach without a specific requirement.

### Recommended environment isolation

Create a virtual environment when one is not already configured:

```bash
python -m venv .venv
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

Activate it in Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Use the project’s documented environment setup if it differs from these examples.

## 5. Common Development Commands

Run commands from the repository root unless the project specifies otherwise.

### Compile Python files

```bash
python -m compileall -q python/
```

This checks whether Python files can be compiled. It does not establish that imports, integrations, or runtime behavior are correct.

### Run the test suite

```bash
python -m pytest python/tests/ -v
```

### Run an individual test module

```bash
python -m pytest python/tests/test_validators.py -v
```

### Check linting

If Ruff is installed and configured:

```bash
ruff check python/
```

### Check formatting

```bash
ruff format —check python/
```

Use the actual configured test and lint tools. Optional commands may require additional development dependencies.

## 6. Configuration Management

Configuration should be explicit, validated, environment-aware, and free of committed secrets.

Recommended practices:

1. Keep safe defaults separate from deployment-specific values.
2. Store credentials in environment variables or an approved secrets manager.
3. Validate required settings before starting dependent operations.
4. Reject malformed configuration instead of silently substituting production defaults.
5. Resolve filesystem paths against a known project root.
6. Avoid network requests and external-service initialization during package imports.
7. Never print complete database URLs, access tokens, passwords, or authorization headers.

Where useful, maintain a placeholder-only `.env.example`. Never commit populated secret files.

Configuration precedence, supported keys, and validation behavior must be documented by the actual configuration loader.

## 7. Integration Architecture

The `integrations/` package provides shared infrastructure for approved external services.

Its intended responsibilities include:

- Provider contracts and registration.
- Configuration and secret references.
- HTTP communication and connection management.
- API and storage client operations.
- Standardized exception handling.
- Health reporting.
- Repository-level integration inspection.
- Domain-specific education, admissions, recruitment, and notification adapters.

### Integration requirements

Every external integration should:

- Use explicit connection and request timeouts.
- Verify TLS certificates.
- Validate requests and external responses.
- Apply bounded retries only to appropriate transient failures.
- Respect provider rate limits.
- Avoid retrying non-idempotent operations without appropriate safeguards.
- Redact sensitive information from logs.
- Expose useful, sanitized failure details.
- Support deterministic unit testing through mocked dependencies.

### Provider lifecycle

A recommended provider lifecycle is:

1. Load and validate configuration.
2. Resolve the provider through the registry.
3. Initialize the provider explicitly.
4. Perform the requested operation.
5. Validate the returned data.
6. Record sanitized operational metadata.
7. Close resources when required.

A registered provider or valid configuration does not prove that a remote service is reachable or operational. Verify actual behavior through appropriate tests.

See `integrations/README.md` for the detailed integration architecture, if that file exists.

## 8. Data Validation and Import Safety

Data-source utilities must treat remote content as untrusted input.

### Validation requirements

- Validate supported formats and expected data types.
- Enforce maximum payload sizes and collection limits.
- Reject malformed or empty responses where prohibited.
- Validate required identifiers and fields.
- Detect duplicate records and conflicting identifiers.
- Normalize records consistently before comparison.
- Preserve source attribution and canonical URLs where required.
- Prevent unsafe HTML or untrusted content from being rendered without sanitization.
- Report invalid records without exposing sensitive data.

### Remote-source security

For integrations that fetch external data:

- Use an explicit hostname allowlist.
- Require HTTPS where applicable.
- Validate DNS results and resolved destination addresses.
- Reject loopback, private, link-local, and cloud-metadata destinations.
- Revalidate redirect destinations.
- Apply timeouts and streaming response-size limits.
- Fail closed when security validation cannot be completed.

These controls must be enforced by the actual network client. A configuration file alone cannot guarantee their operation.

### Publication safeguards

For admissions, scholarships, fees, examinations, job listings, and announcements:

- Validate data before import.
- Keep new or changed records pending review when required.
- Preserve manually edited records.
- Never publish quarantined or unverified records.
- Keep an audit trail for material changes and approvals.
- Do not delete records merely because a source temporarily omits them.

## 9. Repository Modification Safety

Repository automation must preserve existing project behavior.

### Default behavior

- Prefer read-only inspection.
- Require explicit options for modifications.
- Preserve non-empty files unless overwriting is explicitly authorized.
- Reject paths outside the permitted repository boundary.
- Handle symbolic links deliberately.
- Avoid destructive wildcard operations.
- Create backups before destructive changes where supported.
- Write generated files atomically when practical.
- Validate generated Python and JSON files.
- Report every failed operation clearly.

### Before applying changes

A tool that modifies files should, where applicable:

1. Identify the repository root.
2. Resolve and validate all target paths.
3. Produce a proposed-change summary.
4. Detect existing files and potential conflicts.
5. Require explicit authorization for overwrites or deletions.
6. Apply changes in a controlled manner.
7. Validate the resulting files.
8. Report changed, skipped, and failed operations.

A successful command must not be reported as a successful modification unless the operation actually completed.

## 10. Testing and Quality Assurance

The `tests/` package protects existing behavior and verifies new functionality.

### Recommended test coverage

| Area | Coverage |
|—|—|
| Input validation | Valid, invalid, empty, malformed, and boundary values |
| Configuration | Missing settings, invalid types, environment overrides, and secrets handling |
| Exceptions | Error mapping, sanitized messages, and failure propagation |
| HTTP clients | Timeouts, retry limits, rate limiting, TLS errors, and invalid responses |
| Registry | Registration, duplicate identifiers, missing providers, and lifecycle behavior |
| JSON data | Parsing, schema validation, duplicates, and normalization |
| Import/export | Serialization, data integrity, and invalid records |
| Repository tools | Path traversal, existing-file protection, dry runs, and failed writes |
| Integrations | Mocked provider behavior and controlled integration tests |
| Regression | Previously resolved defects and preserved interfaces |

### Testing principles

- Mock external services during unit tests.
- Use isolated temporary directories for filesystem tests.
- Use dedicated test credentials and databases where integration testing requires them.
- Never run destructive tests against production resources.
- Test both expected success and failure paths.
- Avoid tests that depend on uncontrolled network availability.
- Clean up temporary files and external resources after tests.
- Ensure tests do not leak credentials or personal data.

See `tests/README.md` for detailed testing instructions, if present.

## 11. Security Standards

The toolkit should follow these minimum security practices:

- Keep API keys, passwords, and tokens out of source control.
- Separate development, testing, staging, and production credentials.
- Enforce TLS certificate verification.
- Validate external URLs and restrict outbound destinations.
- Apply authorization checks to sensitive storage and document operations.
- Avoid logging personal data unless strictly necessary and authorized.
- Use least-privilege access for service accounts.
- Avoid executing commands or code constructed from untrusted input.
- Keep dependency versions and security updates under review.
- Restrict access to production data and operational reports.

Security-sensitive operations should fail safely and provide actionable, sanitized diagnostics.

## 12. Logging and Operational Diagnostics

Logs should provide enough information to diagnose failures without exposing sensitive values.

Recommended fields include:

- Timestamp.
- Operation or tool name.
- Correlation identifier.
- Sanitized error category.
- Duration.
- Counts of processed, skipped, or rejected records.
- Success or failure status.

Do not log passwords, access tokens, cookies, private keys, complete authorization headers, or raw sensitive payloads.

Use consistent logging levels:

- `DEBUG`: detailed development diagnostics.
- `INFO`: significant operations and successful outcomes.
- `WARNING`: recoverable issues and unexpected conditions.
- `ERROR`: failed operations requiring attention.
- `CRITICAL`: severe failures affecting continued safe operation.

Use only levels and structured fields supported by the actual logging implementation.

## 13. Troubleshooting

| Problem | Recommended action |
|—|—|
| Import errors | Verify the working directory, package layout, and interpreter |
| Missing dependencies | Follow the project’s documented installation procedure |
| Invalid JSON | Check encoding, syntax, required fields, and expected types |
| Missing references | Verify paths against the actual repository structure |
| HTTP failures | Check sanitized errors, timeouts, authentication, and provider status |
| Repeated retries | Review retry limits, rate limits, and circuit-breaker behavior |
| Configuration errors | Verify required keys and environment settings without printing secrets |
| Unexpected file changes | Inspect the version-control diff and restore unintended changes |
| Test failures | Run the failing test independently, then rerun the relevant suite |
| Permission errors | Check filesystem permissions and service-account access |
| Provider health failures | Distinguish configuration validity from actual connectivity |

## 14. Development Workflow

For every change:

1. Inspect the existing implementation and its public interfaces.
2. Identify affected tools, integrations, datasets, and tests.
3. Reuse established utilities where appropriate.
4. Implement the smallest coherent change.
5. Add or update regression tests.
6. Run syntax checks and relevant automated tests.
7. Review the repository diff and generated reports.
8. Update documentation and configuration examples.
9. Check for secrets and unintended file modifications.
10. Verify deployment-specific behavior where necessary.

Do not treat successful syntax compilation as proof of runtime correctness or production readiness.

## 15. Definition of Done

A change is complete when all applicable criteria are satisfied:

- [ ] Python syntax checks pass.
- [ ] Relevant automated tests pass.
- [ ] Regression coverage is included where appropriate.
- [ ] Configuration and dependencies are documented.
- [ ] Existing files are preserved as intended.
- [ ] Security-sensitive behavior is validated.
- [ ] External integrations are tested at the appropriate level.
- [ ] Generated data and reports are validated.
- [ ] Documentation reflects the actual implementation.
- [ ] No unintended secrets or file changes are introduced.
- [ ] Operational claims are supported by verification.

## 16. Maintenance

Keep this README synchronized with the actual directory structure, Python version, dependency configuration, tool interfaces, integration contracts, and test commands.

Remove obsolete examples when implementations change. Document new tools and packages only after their interfaces and responsibilities are established.

**Engineering principle:** Build reusable, secure, testable Python utilities. Preserve existing project behavior, make file modifications explicit, and distinguish intended functionality from functionality that has been implemented and verified.
