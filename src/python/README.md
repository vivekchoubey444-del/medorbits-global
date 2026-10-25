
# MedOrbits Python Source

**Directory:** `src/python/`  
**Package:** `medorbits`  
**Purpose:** Python utilities and supporting services for the MedOrbits platform.

—

## 1. Overview

The `src/python/` directory contains the MedOrbits Python package and its command-line interface.

It provides shared functionality for configuration management, input validation, logging, health checks, and structured data import/export.

The Python code is designed to complement the main MedOrbits application without coupling reusable utilities directly to a specific web framework or database driver.

### Primary objectives

- Centralize reusable Python functionality.
- Validate application and recruitment data.
- Support controlled CSV, JSON, and JSONL processing.
- Standardize logging and diagnostic output.
- Provide command-line utilities for development and maintenance.
- Establish a foundation for future Python-based background jobs and services.

—

## 2. Directory Structure

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

### File responsibilities

| File | Responsibility |
|—|—|
| `README.md` | Python source directory documentation |
| `cli.py` | Command-line entry point for common maintenance tasks |
| `medorbits/__init__.py` | Package metadata and version information |
| `medorbits/README.md` | Package-specific technical documentation |
| `medorbits/config.py` | Environment configuration and settings validation |
| `medorbits/data_export.py` | Structured data export |
| `medorbits/data_import.py` | Structured data import |
| `medorbits/healthcheck.py` | Liveness, readiness, and dependency probe utilities |
| `medorbits/logging_config.py` | Logging configuration, formatting, and redaction |
| `medorbits/validators.py` | Reusable input and payload validation |

Keep this structure aligned with the actual repository. Add files to the tree when they are created and remove references when files are retired.

—

## 3. Requirements

Recommended environment:

- Python 3.10 or later
- A supported operating system: Linux, macOS, or Windows
- A virtual environment for development and testing
- Git for source control

The listed modules primarily use the Python standard library. Optional integrations may require additional dependencies.

Check the repository’s dependency manifest before installing packages.

—

## 4. Python Environment Setup

From the repository root, create and activate a virtual environment.

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

Set the Python package directory on the import path.

### Linux or macOS

```bash
export PYTHONPATH=“$PWD/src/python${PYTHONPATH:+:$PYTHONPATH}”
```

### Windows PowerShell

```powershell
$existingPythonPath = $env:PYTHONPATH
$env:PYTHONPATH = if ($existingPythonPath) {
    “$PWD\src\python;$existingPythonPath”
} else {
    “$PWD\src\python”
}
```

For repeatable deployment, consider adding a `pyproject.toml` at the Python package root and installing the package into the virtual environment.

—

## 5. Command-Line Interface

The CLI is located at:

```text
src/python/cli.py
```

Display available commands:

```bash
python src/python/cli.py —help
```

### Supported commands

| Command | Purpose |
|—|—|
| `version` | Display package and Python versions |
| `config-check` | Load and validate environment configuration |
| `validate-email` | Validate basic email syntax |
| `validate-application` | Validate an application JSON file |
| `validate-job` | Validate a job JSON file |
| `import-data` | Import supported structured records |
| `export-data` | Export JSON records to a supported format |
| `health` | Run a local liveness check |

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
python src/python/cli.py —log-level INFO —log-format json version
```

The `health` command checks local application liveness. It does not establish that external services are available.

—

## 6. Configuration

Environment configuration is managed by `medorbits/config.py`.

Example development configuration:

```dotenv
NODE_ENV=development
DEBUG=false
HOST=127.0.0.1
PORT=8000
API_PREFIX=/api
LOG_LEVEL=INFO

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

This example is a starting point, not a guarantee that every variable is required or that all values match the current implementation. Check `medorbits/config.py` before using it.

### Configuration rules

- Do not commit credentials or API keys.
- Use the deployment platform’s secret management for production.
- Validate production settings before starting the service.
- Keep database engine settings consistent with the installed adapter.
- Restrict CORS origins to trusted application domains.
- Keep debug mode disabled in production.
- Use secure storage permissions for uploaded documents.

Configuration loading does not automatically connect to external services.

—

## 7. Validation

The `medorbits/validators.py` module provides reusable validation for common data types and business payloads.

Example:

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
    # Pass validated data to the application service layer.
    print(validated_payload)
```

### Validation coverage

- Email and phone number syntax
- Password policies
- Identifiers and names
- Text and numeric values
- Dates and enumerated values
- URL syntax
- Required fields and payload structure
- Pagination constraints
- Declared MIME types and file sizes
- Application and job payloads

Validation does not replace authorization, database constraints, domain-specific eligibility rules, or output encoding.

—

## 8. Logging

Logging is configured through `medorbits/logging_config.py`.

Example:

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

Useful environment settings:

```dotenv
LOG_LEVEL=INFO
LOG_FORMAT=json
```

Prefer structured logging in production environments. Never log passwords, access tokens, payment credentials, full identity documents, or unnecessary personal information.

—

## 9. Data Import and Export

### Import

The import module provides controlled processing for supported data formats.

Recommended workflow:

1. Validate the input file size.
2. Verify the expected format.
3. Parse records.
4. Validate field names and values.
5. Apply business rules and authorization.
6. Persist approved records through the application service.
7. Record a sanitized audit event.

### Export

The export module supports structured output formats such as CSV, JSON, and JSONL.

Before exporting:

- Confirm that the requesting user is authorized.
- Select only necessary fields.
- Exclude secrets and unnecessary personal data.
- Apply spreadsheet formula-injection protections for CSV.
- Enforce retention and access policies for generated files.

Check the current import/export function signatures before integrating the CLI with these modules.

—

## 10. Health Checks

The health-check module provides reusable probe and report functionality.

Use separate checks for:

- Application liveness
- Database connectivity
- Redis or queue availability
- Other dependencies required for request processing

Use finite connection timeouts for every network probe. A timeout around a Python thread does not forcibly stop a blocking operation that is already running.

Public health endpoints should not reveal credentials, stack traces, internal hostnames, or sensitive infrastructure details.

—

## 11. Testing

Keep Python tests separate from the Node.js test suite.

Suggested layout:

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

If the project uses `pytest`, install it as a development dependency and run:

```bash
python -m pytest tests/python/medorbits -q
```

Test at least:

- Invalid and missing environment variables
- Malformed payloads and boundary values
- Invalid dates, email addresses, and URLs
- Oversized and malformed input files
- Sensitive-field redaction
- CSV formula-injection handling
- Health-probe failures and timeouts
- CLI exit codes and error output
- Authorization at the service layer

The suggested directory layout is a recommendation; create the test files before relying on them in CI.

—

## 12. Security Requirements

1. Validate all untrusted input on the server.
2. Enforce authorization independently of validation.
3. Use parameterized database queries.
4. Keep credentials out of source control and logs.
5. Validate file content and signatures, not just extensions or MIME declarations.
6. Scan uploaded documents for malware where appropriate.
7. Protect server-side URL fetching against SSRF.
8. Restrict exports to authorized fields.
9. Keep production error responses generic.
10. Apply request, upload, and processing limits.
11. Keep audit records free of secrets.
12. Review dependencies and security advisories regularly.

—

## 13. Integration with the Main MedOrbits Application

Recommended architecture:

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

Keep Python utility modules independent of HTTP request and response objects.

If the Node.js application and Python services share schemas, maintain a single canonical definition or automated compatibility tests. Keep field names, allowed values, error codes, and required-field rules aligned across both implementations.

—

## 14. Deployment Notes

Before deploying:

- Verify the Python runtime version.
- Install the declared dependencies.
- Confirm the package import path.
- Validate environment configuration.
- Run automated tests.
- Confirm the database adapter matches the configured engine.
- Check file and directory permissions.
- Verify health probes use bounded timeouts.
- Confirm that production logging does not expose secrets.
- Test CLI commands in the target environment.

Do not run the CLI’s configuration or health commands as a substitute for a full integration test.

—

## 15. Maintenance

- Update documentation when modules or CLI commands change.
- Keep package version metadata synchronized.
- Add regression tests for validation and security fixes.
- Review allowed fields against the canonical application and job schemas.
- Document new environment variables.
- Avoid introducing unnecessary dependencies into shared utilities.
- Use deliberate, documented changes for breaking interfaces.

—

## 16. License

Copyright MedOrbits. All rights reserved.

This source is proprietary unless a separate written license or agreement specifies otherwise.
```

**Compatibility note:** The CLI and package modules should be integration-tested together. In particular, verify the exact constructor and return types used by `data_import.py`, `data_export.py`, and `healthcheck.py` before relying on the example commands in production.