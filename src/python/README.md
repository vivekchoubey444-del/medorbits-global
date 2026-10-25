
# MedOrbits Python Source

**Directory:** `src/python/`  
**Package:** `medorbits`  
**Purpose:** Reusable Python utilities, validation services, structured data processing, diagnostics, and command-line operations for the MedOrbits platform.

—

## 1. Overview

The MedOrbits Python package provides shared utilities that complement the primary MedOrbits application. It is designed to support education and admissions workflows, recruitment data, document-related utilities, and operational maintenance without unnecessarily coupling reusable functionality to a specific web framework or database driver.

The package includes the following planned or implemented capabilities, depending on the current repository state:

- Environment configuration and settings validation.
- Application, job, email, and general-purpose input validation.
- Structured logging and diagnostic context.
- JSON, CSV, and JSONL import and export.
- Local liveness and health reporting.
- Command-line utilities for development and maintenance.
- A foundation for future background processing and Python-based services.

**Implementation status:** Documentation does not establish that every module, function, or command described here already exists. The source code, dependency manifest, and tests define the actual supported interfaces.

## 2. Architecture and directory structure

The intended package structure is:

```text
src/
└── python/
    ├── README.md
    ├── cli.py
    └── medorbits/
        ├── __init__.py
        ├── README.md
        ├── config.py
        ├── data_export.py
        ├── data_import.py
        ├── healthcheck.py
        ├── logging_config.py
        └── validators.py
```

### Module responsibilities

| File | Responsibility |
|—|—|
| `README.md` | Python source documentation and operational guidance |
| `cli.py` | Command-line entry point |
| `medorbits/__init__.py` | Package metadata and version |
| `medorbits/README.md` | Package-specific documentation |
| `medorbits/config.py` | Configuration loading and validation |
| `medorbits/data_export.py` | Structured data serialization and export |
| `medorbits/data_import.py` | Parsing and import validation |
| `medorbits/healthcheck.py` | Liveness, readiness, and dependency probes |
| `medorbits/logging_config.py` | Logging configuration, structured output, and redaction |
| `medorbits/validators.py` | Reusable input and payload validation |

Keep this structure synchronized with the actual repository. Do not document a module as implemented until its source, dependencies, and expected behavior have been verified.

### Design principles

1. **Separation of concerns:** Keep configuration, validation, logging, import/export, and health reporting in separate modules.
2. **Explicit contracts:** Document public function signatures, return values, and exceptions.
3. **Minimal dependencies:** Prefer the standard library unless a dependency provides clear value.
4. **Security by default:** Validate untrusted input, protect secrets, and enforce bounded resource consumption.
5. **Deterministic behavior:** Make utilities testable without production services.
6. **Compatibility:** Coordinate shared schemas and error contracts with the Node.js application.

## 3. Requirements

Recommended development environment:

- Python 3.10 or later, subject to the version supported by the project.
- Linux, macOS, or Windows.
- Git.
- A virtual environment.
- The dependencies declared by the repository’s dependency manifest.

Check the actual Python version requirement and dependency files before installing packages. Do not assume that optional database, queue, storage, or AI integrations are installed.

## 4. Environment setup

Run commands from the repository root.

### Linux or macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install —upgrade pip
```

### Windows PowerShell

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install —upgrade pip
```

Install project dependencies using the repository’s actual dependency manifest. For example, if a Python requirements file exists:

```bash
python -m pip install -r src/python/requirements.txt
```

Do not run that command unless the referenced file exists.

### Configure the import path

When executing the CLI directly, `cli.py` can add its package directory to `sys.path`. For other scripts and test runners, configure the import path or install the package consistently.

Linux or macOS:

```bash
export PYTHONPATH=“$PWD/src/python${PYTHONPATH:+:$PYTHONPATH}”
```

Windows PowerShell:

```powershell
$packagePath = (Resolve-Path “src/python”).Path
$existingPythonPath = $env:PYTHONPATH

if ($existingPythonPath) {
    $env:PYTHONPATH = “$packagePath;$existingPythonPath”
} else {
    $env:PYTHONPATH = $packagePath
}
```

For repeatable deployment, consider adding a `pyproject.toml` and installing the package into the active virtual environment. Keep packaging changes aligned with the repository’s deployment process.

## 5. Command-line interface

The CLI entry point is:

```text
src/python/cli.py
```

Display help:

```bash
python src/python/cli.py —help
```

### Supported command interfaces

| Command | Purpose |
|—|—|
| `version` | Display package and Python versions |
| `config-check` | Load and validate configuration |
| `validate-email` | Validate email syntax |
| `validate-application` | Validate an application JSON file |
| `validate-job` | Validate a job JSON file |
| `import-data` | Import supported structured records |
| `export-data` | Export records into a supported format |
| `health` | Run a local liveness check |

These commands describe the CLI contract expected by this documentation. Verify their availability using `—help` and the current implementation.

### Examples

```bash
python src/python/cli.py version

python src/python/cli.py config-check

python src/python/cli.py validate-email applicant@example.com

python src/python/cli.py validate-application application.json

python src/python/cli.py validate-job job.json

python src/python/cli.py import-data records.json —format json

python src/python/cli.py export-data records.json \
    —format csv \
    —output records.csv

python src/python/cli.py health
```

Configure logging using global options before the subcommand:

```bash
python src/python/cli.py \
    —log-level INFO \
    —log-format json \
    version
```

### CLI conventions

- `—help` should describe available commands and arguments.
- Standard output should contain successful command results.
- Standard error should contain error responses and diagnostics.
- Exit codes should distinguish success, general failure, usage errors, and validation failures where supported.
- Errors must not reveal credentials, access tokens, database URLs, or sensitive submitted values.
- File processing should enforce explicit size limits.
- Commands should not perform unexpected writes or contact external services.

The CLI should remain a maintenance interface rather than a substitute for application-level authorization or business workflows.

## 6. Configuration management

Configuration is intended to be managed by `medorbits/config.py`.

Example development configuration:

```dotenv
NODE_ENV=development
DEBUG=false
HOST=127.0.0.1
PORT=8000
API_PREFIX=/api
LOG_LEVEL=INFO
LOG_FORMAT=json

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_CREDENTIALS=false

DB_ENGINE=postgresql
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DB_CONNECT_TIMEOUT_SECONDS=10
DB_POOL_MIN_SIZE=1
DB_POOL_MAX_SIZE=10

QUEUE_ENABLED=false
REDIS_URL=redis://localhost:6379/0

EMAIL_ENABLED=false
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM_ADDRESS=
EMAIL_FROM_NAME=MedOrbits

PAYMENTS_ENABLED=false
PAYMENT_MODE=test
PAYMENT_CURRENCY=INR

STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./var/uploads
STORAGE_TEMP_PATH=./var/tmp

AI_ENABLED=false
AI_API_URL=
AI_API_KEY=
AI_MODEL=
```

This is an illustrative template, not a declaration that every variable is supported or required. Confirm names, defaults, validation rules, and feature flags in the actual configuration implementation.

### Configuration requirements

- Validate required values and numeric ranges.
- Reject unsupported environment names and invalid configuration combinations.
- Keep secrets out of source control.
- Use deployment-managed secret storage in production.
- Keep the configured database engine consistent with the installed adapter.
- Restrict CORS origins to trusted domains.
- Disable debug mode in production.
- Use secure file permissions for uploaded documents and generated exports.
- Apply bounded timeouts and connection-pool limits where supported.
- Avoid logging raw configuration values.

Configuration loading must not automatically initiate payments, send emails, connect to external AI providers, or start background workers unless that behavior is explicitly part of the documented contract.

## 7. Input validation

The `medorbits/validators.py` module is intended to provide reusable validation for supported input types and payloads.

Illustrative usage:

```python
from medorbits.validators import (
    ValidationError,
    validate_application_payload,
)

payload = {
    “full_name”: “Aarav Sharma”,
    “email”: “aarav@example.com”,
    “course”: “MBBS”,
    “consent”: True,
}

try:
    validated_payload = validate_application_payload(payload)
except ValidationError as exc:
    error_response = {
        “success”: False,
        “error”: exc.to_dict(),
    }
else:
    # Pass validated data to the appropriate application service.
    print(validated_payload)
```

Confirm the actual function signature and exception contract before using this example.

### Validation coverage

Where applicable, validate:

- Required fields and payload structure.
- Email and phone number syntax.
- Identifiers and names.
- Password requirements.
- String lengths and character constraints.
- Numeric types, ranges, and safe boundaries.
- Dates and enumerated values.
- URL syntax.
- Pagination parameters.
- File sizes, formats, and declared MIME types.
- Application and job payloads.
- Unknown or protected fields.

### Validation boundaries

Validation is not authorization. A payload that is structurally valid may still be unauthorized, ineligible, or inconsistent with the current business state.

Do not rely exclusively on client-supplied role, ownership, status, payment state, or eligibility fields. Enforce trusted identity and business rules at the appropriate service and persistence layers.

## 8. Logging and diagnostics

Logging is intended to be configured by `medorbits/logging_config.py`.

Illustrative usage:

```python
from medorbits.logging_config import (
    configure_logging,
    get_logger,
    log_context,
)

configure_logging()

logger = get_logger(“medorbits.worker”)

with log_context(
    request_id=“req-example-001”,
    correlation_id=“corr-example-001”,
):
    logger.info(
        “Application processing started”,
        extra={“application_id”: “APP-1001”},
    )
```

Verify the actual function signatures before integrating this example.

### Logging requirements

- Support appropriate severity levels.
- Use structured logs where supported.
- Include request or correlation identifiers when useful.
- Avoid recording unnecessary personal information.
- Redact passwords, access tokens, API keys, payment credentials, and authorization headers.
- Never log complete identity documents or sensitive uploads.
- Keep public error responses separate from internal diagnostics.
- Avoid logging raw environment configuration or connection strings.

Example environment settings:

```dotenv
LOG_LEVEL=INFO
LOG_FORMAT=json
```

A redaction helper is not a replacement for avoiding sensitive data in log messages in the first place.

## 9. Structured data import and export

The `data_import.py` and `data_export.py` modules are intended to provide controlled structured data processing.

Supported formats may include CSV, JSON, and JSONL. Verify support and the exact function signatures in the current implementation.

### Import workflow

1. Validate the input path and enforce a file-size limit.
2. Decode input using an explicit encoding.
3. Parse the declared format.
4. Reject malformed structures and unsupported values.
5. Validate records against the canonical schema.
6. Apply business rules and authorization.
7. Persist approved records through the appropriate service.
8. Record a sanitized audit event when required.
9. Report success only after the operation has completed.

### Export workflow

1. Authorize the requesting user or process.
2. Select only approved fields.
3. Validate the output format and destination.
4. Enforce size and resource limits.
5. Serialize data using the appropriate format.
6. Protect CSV output against spreadsheet formula injection.
7. Write files using appropriate permissions.
8. Apply retention and access policies to generated files.

### Data integrity

- Avoid partial writes when an export fails.
- Use atomic replacement or a temporary-file strategy when appropriate.
- Avoid overwriting sensitive files without an explicit policy.
- Validate data types rather than relying on string coercion.
- Treat imported files as untrusted input.
- Keep large imports bounded in memory or process them incrementally where appropriate.

Import/export utilities should not independently bypass service-level authorization, business validation, or audit requirements.

## 10. Health checks

The `medorbits/healthcheck.py` module is intended to provide health reporting and probe utilities.

Distinguish these concepts:

| Probe | Purpose |
|—|—|
| Liveness | Indicates whether the process is running and able to continue |
| Readiness | Indicates whether the service is ready to accept relevant work |
| Dependency health | Reports the status of required external dependencies |

A liveness check should not fail solely because an optional external provider is unavailable. Readiness may depend on critical services, according to the deployment architecture.

### Health-check requirements

- Use finite timeouts for network operations.
- Avoid exposing credentials, internal hostnames, or sensitive infrastructure details.
- Return stable, documented status values.
- Keep expensive dependency checks out of frequently polled liveness endpoints.
- Close resources opened by probes.
- Handle expected connection failures without returning stack traces to callers.

A timeout around a Python thread does not forcibly terminate an already-blocked operation. Configure timeouts in the underlying network or database client.

The CLI `health` command should be understood as a local liveness check unless its implementation explicitly documents additional probes.

## 11. Testing

Keep Python tests separate from the Node.js test suite.

Suggested structure:

```text
tests/
└── python/
    └── medorbits/
        ├── test_cli.py
        ├── test_config.py
        ├── test_logging_config.py
        ├── test_validators.py
        ├── test_data_import.py
        ├── test_data_export.py
        └── test_healthcheck.py
```

Create these files before relying on them in CI. The structure is a recommendation, not a verified inventory.

If the repository uses `pytest`, install it through the project’s development dependency mechanism and run:

```bash
python -m pytest tests/python/medorbits -q
```

### Required test coverage

**CLI**
- Help output and command registration.
- Successful command exit codes.
- Invalid arguments and validation failures.
- Missing, malformed, and oversized input files.
- Safe standard output and standard error behavior.
- Configuration and health-check failures.

**Configuration**
- Missing required values.
- Invalid types and numeric boundaries.
- Unsupported configuration combinations.
- Secret redaction and safe diagnostics.

**Validation**
- Valid and invalid payloads.
- Required fields and unknown-field handling.
- Boundary values, malformed dates, and invalid identifiers.
- Consistent error structures.

**Import/export**
- Supported formats and malformed files.
- Encoding and file-size boundaries.
- CSV formula-injection protection.
- Output permissions and failure behavior.
- Preservation of record integrity.

**Logging**
- Structured output where supported.
- Context propagation.
- Redaction of known secret fields.
- Avoidance of sensitive payload logging.

**Health checks**
- Healthy and unhealthy states.
- Dependency failure handling.
- Timeouts and resource cleanup.

Tests should be deterministic, isolate external dependencies, and avoid production databases or live payment accounts.

## 12. Security requirements

Apply the following requirements to the Python package and any application services that consume it.

1. Validate untrusted input at system boundaries.
2. Enforce authorization independently of input validation.
3. Use parameterized database queries in persistence adapters.
4. Keep credentials out of source control and logs.
5. Validate uploaded file content, not just extensions or declared MIME types.
6. Apply malware scanning where the document workflow requires it.
7. Protect server-side URL fetching against SSRF.
8. Restrict exports to authorized fields.
9. Keep production error responses generic.
10. Apply file-size, request-size, and processing limits.
11. Keep audit records free of secrets and unnecessary personal information.
12. Review dependencies and security advisories regularly.
13. Use secure temporary-file handling and filesystem permissions.
14. Prevent path traversal and unintended symbolic-link access.
15. Avoid claiming an operation succeeded before its actual completion.

Security controls must be enforced by implementation and tested at the appropriate unit, integration, API, and security levels.

## 13. Integration with the main MedOrbits application

Recommended conceptual architecture:

```text
Node.js API / Python CLI / Background Workers
                    |
                    v
             Application Services
                    |
                    v
             MedOrbits Utilities
              /      |       \
       Validation  Logging  Data I/O
                    |
                    v
           Repository / Adapters
                    |
                    v
      Database / Queue / Storage / Providers
```

This diagram is an architectural guide, not proof that all components currently exist.

### Integration principles

- Keep reusable Python utilities independent of HTTP request and response objects.
- Keep persistence access behind explicit repository or adapter interfaces.
- Avoid circular dependencies between shared utilities and application services.
- Define stable function signatures and documented exceptions.
- Use explicit data contracts at language boundaries.
- Keep credentials and trusted identity in controlled server-side contexts.
- Make background jobs idempotent where repeated execution is possible.

If Node.js and Python share schemas, maintain a canonical definition or automated compatibility tests. Keep field names, allowed values, required fields, and error contracts aligned across implementations.

## 14. Deployment guidance

Before deploying:

- Confirm the supported Python runtime.
- Install dependencies from the project’s declared dependency manifest.
- Verify package imports.
- Validate environment configuration.
- Run automated tests.
- Confirm database engine and adapter compatibility.
- Check file and directory permissions.
- Verify health probes use bounded timeouts.
- Confirm production logging does not expose secrets.
- Test CLI commands in the target environment.
- Confirm external integrations are disabled or configured safely.
- Review dependency vulnerabilities.

Do not treat a successful configuration check or local liveness command as a substitute for integration testing.

## 15. Troubleshooting

| Symptom | Recommended checks |
|—|—|
| `ModuleNotFoundError` | Verify package path, package files, installation, and imports |
| Configuration validation failure | Check required environment variables and documented settings |
| Invalid payload | Inspect the schema and sanitized validation details |
| Import/export failure | Verify format, encoding, size limit, and module contract |
| Permission error | Check filesystem permissions and destination directory |
| Database connection failure | Check the configured driver, connection settings, and timeout |
| Health-check failure | Verify local package initialization and required dependencies |
| Test discovery failure | Check test paths, test runner, and dependency installation |
| Unexpected CLI exit code | Inspect the command contract and error-handling path |
| Sensitive information in logs | Remove the source of sensitive logging and review redaction behavior |

Do not expose full environment dumps, secrets, or unredacted tracebacks in public support logs.

## 16. Maintenance and compatibility

Update this documentation whenever:

- Modules or CLI commands are added, renamed, or removed.
- Public function signatures or exception contracts change.
- Configuration variables change.
- Import/export formats change.
- Dependency requirements change.
- Test structure or execution commands change.
- Security controls or logging policies change.
- Integration boundaries change.

Keep the package version synchronized with the actual release process. Avoid breaking public interfaces without an explicit migration plan.

## 17. License and ownership

**Copyright MedOrbits. All rights reserved.**

This source is proprietary unless a separate written license or agreement specifies otherwise.
