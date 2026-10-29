
# MedOrbits Python Package

**Package:** `medorbits`  
**Version:** `0.1.0`  
**Runtime:** Python 3.10+  
**Purpose:** Shared infrastructure utilities for MedOrbits education, medical admissions, career guidance, recruitment, applications, and document workflows.

## 1. Overview

The `medorbits` package provides reusable Python utilities for:

- Environment-driven application configuration.
- Privacy-conscious structured logging.
- Input validation and normalization.
- Controlled CSV, JSON, and JSONL imports and exports.
- Dependency health checks and readiness reports.

The package is designed to remain independent of web frameworks, database drivers, and business-specific services.

### Core design principles

- Importing a module must not initialize application services or contact external systems.
- Configuration parsing must remain separate from service initialization.
- Untrusted input must be validated before processing.
- Sensitive information must not be deliberately written to logs or exported without authorization.
- Public interfaces and examples must remain synchronized with the implementation.
- Resource limits must be enforced for untrusted input and potentially expensive operations.

## 2. Package Structure

```text
src/
└── python/
    └── medorbits/
        ├── __init__.py
        ├── README.md
        ├── config.py
        ├── logging_config.py
        ├── validators.py
        ├── data_import.py
        ├── data_export.py
        └── healthcheck.py
```

Add modules only when they provide reusable functionality rather than duplicating application-specific business logic.

## 3. Module Reference

| Module | Responsibility |
|---|---|
| `__init__.py` | Package metadata and version information |
| `config.py` | Environment settings, type conversion, and configuration validation |
| `logging_config.py` | Logging configuration, JSON formatting, request context, and redaction |
| `validators.py` | Input validation and normalization |
| `data_import.py` | Controlled CSV, JSON, and JSONL parsing |
| `data_export.py` | Structured exports, field selection, and output safeguards |
| `healthcheck.py` | Dependency probes and readiness reports |

### `config.py`

Centralizes supported environment settings, which may include:

- Application environment and server configuration.
- CORS origins and credential policy.
- Database settings and connection timeouts.
- Redis and queue settings.
- SMTP and email configuration.
- Payment provider settings.
- File storage and upload restrictions.
- AI provider configuration.

Configuration parsing must not create database connections, initialize clients, or contact external providers.

Verify environment variable names, defaults, accepted values, and validation rules against the actual implementation.

### `logging_config.py`

Provides structured application logging, potentially including:

- Environment-driven log levels and output formats.
- JSON and readable console formatters.
- Request and correlation ID context.
- Structured application fields.
- Redaction of common credentials and personal information.

Redaction is defense in depth, not a guarantee that every secret or personal identifier will be detected. Never deliberately log credentials, authentication headers, complete application records, or document contents.

### `validators.py`

Provides validation helpers for supported input types and application payloads, including:

- Email addresses and phone numbers.
- Password policies.
- Identifiers and names.
- Text, numbers, booleans, and dates.
- URLs and enumerated values.
- Required fields and mapping structures.
- Pagination.
- MIME types and upload sizes.
- Application and job payloads.

Validation does not replace authorization, database constraints, eligibility checks, malware scanning, or business rules.

### `data_import.py`

Provides controlled parsing of supported structured formats, with configurable input and record limits and optional validation.

Before using it with large files, verify memory consumption, record limits, malformed-input handling, and cancellation behavior. A maximum input size does not automatically make a parser constant-memory.

### `data_export.py`

Provides CSV, JSON, and JSONL export helpers, with options for selecting fields and controlling output formats.

Export safeguards must be supplemented by authorization checks, access-controlled storage, retention policies, and appropriate handling of personal or confidential information.

CSV formula-injection protection should be tested against the spreadsheet applications used by recipients.

### `healthcheck.py`

Provides dependency probe registration, execution, and readiness reports.

Database, Redis, and HTTP probes must configure their own connection and operation timeouts. Python cannot forcibly terminate a synchronous operation that has already started when a thread-level timeout expires.

## 4. Requirements

- Python 3.10 or later.
- Python standard library for the documented core modules.
- Optional dependencies only where required by a specific integration or project configuration.

The Python version declared by the project's dependency manifest and continuous integration configuration is authoritative. Keep this README synchronized with those declarations.

## 5. Installation and Imports

The package resides under `src/python/medorbits/`.

### Linux or macOS

```bash
export PYTHONPATH="$PWD/src/python${PYTHONPATH:+:$PYTHONPATH}"
```

### Windows PowerShell

```powershell
$pythonPath = (Resolve-Path "src/python").Path

if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$pythonPath;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $pythonPath
}
```

### Example imports

```python
from medorbits.config import get_settings
from medorbits.logging_config import configure_logging, get_logger
from medorbits.validators import ValidationError
from medorbits.healthcheck import HealthChecker
```

These imports assume the named symbols are available in the installed module versions. Verify function signatures before copying examples into application code.

For permanent installation, configure packaging metadata in `pyproject.toml` at the Python project root and install the package in the project's virtual environment.

## 6. Configuration

The configuration module reads supported values from environment variables. Use environment-specific settings outside the source code.

The following is an illustrative template, not a guarantee that every variable is supported by the current implementation:

```dotenv
APP_ENV=development
LOG_LEVEL=INFO
LOG_FORMAT=text
HOST=127.0.0.1
PORT=8000
API_PREFIX=/api

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOW_CREDENTIALS=false

DB_ENGINE=postgresql
DATABASE_URL=
DB_CONNECT_TIMEOUT_SECONDS=10
DB_POOL_MIN_SIZE=1
DB_POOL_MAX_SIZE=10

QUEUE_ENABLED=false
REDIS_URL=

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

Before deployment, confirm each variable's name, accepted values, default, and validation rules in `config.py`. Do not assume that illustrative variables are implemented or that placeholder values are suitable for production.

### Configuration security

- Never commit real credentials to Git.
- Use a secrets manager or deployment-platform secret settings for production.
- Require HTTPS for production-facing origins and endpoints.
- Disable debug behavior in production.
- Keep credentials and API keys out of logs and error responses.
- Match the configured database engine to the installed database adapter.
- Validate production configuration during startup.
- Fail closed when mandatory security settings are missing or invalid.

## 7. Logging

Example usage:

```python
from medorbits.logging_config import (
    configure_logging,
    get_logger,
    log_context,
)

configure_logging()
logger = get_logger("medorbits.app")

with log_context(
    request_id="req-example-001",
    correlation_id="corr-example-001",
):
    logger.info(
        "Application processed",
        extra={
            "application_id": "APP-1001",
            "status": "received",
        },
    )
```

Example environment settings:

```dotenv
LOG_LEVEL=INFO
LOG_FORMAT=json
```

Use `LOG_FORMAT=text` for readable console output where appropriate.

Request and correlation IDs should be length-limited and validated before logging. Do not treat user-supplied identifiers as trusted identity or authorization claims.

Never log passwords, API keys, access tokens, authentication headers, document contents, or unnecessary personal information.

Redaction should be tested against both structured fields and rendered messages, including exception output. Prefer logging stable error codes and non-sensitive metadata instead of raw payloads or exception details.

## 8. Input Validation

Example usage:

```python
from medorbits.validators import (
    ValidationError,
    validate_application_payload,
)

payload = {
    "full_name": "Aarav Sharma",
    "email": "aarav@example.com",
    "course": "MBBS",
    "consent": True,
}

try:
    validated = validate_application_payload(payload)
except ValidationError as exc:
    error_response = {
        "success": False,
        "error": exc.to_dict(),
    }
else:
    # Pass validated data to the authorized service layer.
    process_application(validated)
```

This example assumes `ValidationError.to_dict()` and `validate_application_payload()` are available with these signatures. Confirm the installed implementation before using the example unchanged.

The application service must independently enforce:

- User permissions and record ownership.
- Medical admission and course eligibility.
- Required consent and data-processing rules.
- Business-specific constraints.
- Database uniqueness and integrity.
- Workflow and state-transition rules.

Validation is not authorization. A payload passing validation must not automatically be considered approved or eligible.

## 9. Data Import and Export

Recommended workflow:

1. Enforce an upload-size limit before parsing.
2. Validate the accepted format and file characteristics.
3. Parse CSV, JSON, or JSONL using the import utilities.
4. Validate each record against the appropriate schema.
5. Apply authorization and business rules.
6. Persist approved records through the service or repository layer.
7. Record a sanitized audit event.
8. Export only fields the requesting user is authorized to access.
9. Apply appropriate file retention and deletion policies.

Do not treat an uploaded filename, file extension, or declared MIME type as proof that a file is safe.

For large imports and exports, verify:

- Memory usage and maximum input size.
- Maximum record counts and field lengths.
- Output-size limits.
- Malformed-input behavior.
- Partial failure handling.
- Cancellation and cleanup behavior.
- CSV formula-injection safeguards.
- Sensitive-field exclusion.

Never expose raw imported records or confidential export contents through logs.

## 10. Health Checks

Register probes for dependencies required by the relevant service.

Example usage:

```python
from medorbits.healthcheck import (
    HealthChecker,
    readiness_report,
)

checker = HealthChecker(
    max_workers=8,
    overall_timeout_seconds=5.0,
)

try:
    checker.register(
        "database",
        callback=check_database_connection,
        required=True,
        timeout_seconds=2.0,
    )

    report = readiness_report(checker)
    print(report.to_dict(include_details=True))
finally:
    checker.close()
```

`check_database_connection` is an application-defined function, not a built-in package function. Implement it using the actual database adapter and configure the driver's connection and query timeouts.

Check the implementation's lifecycle and timeout semantics before adopting this example.

### Liveness versus readiness

- **Liveness:** Determines whether the process is alive enough to continue running. It should not depend on database or external-provider availability.
- **Readiness:** Determines whether the service can accept traffic based on its required dependencies.
- **Optional dependencies:** Affect status according to the application's documented degradation policy.

Do not expose stack traces, internal connection details, SQL statements, credentials, or raw exception messages through public health endpoints. Detailed diagnostics belong in protected logs and monitoring systems.

A thread-level timeout does not guarantee that an already-running synchronous probe has stopped. Probe implementations must enforce their own operation timeouts and clean up resources reliably.

## 11. Testing

Recommended test layout:

```text
tests/
└── python/
    └── medorbits/
        ├── test_config.py
        ├── test_logging_config.py
        ├── test_validators.py
        ├── test_data_import.py
        ├── test_data_export.py
        └── test_healthcheck.py
```

If `pytest` is configured as a development dependency, run:

```bash
python -m pytest tests/python/medorbits -q
```

Otherwise, use the project's configured test runner.

### Minimum test coverage

**Configuration**
- Missing, malformed, and unsupported environment values.
- Production secret requirements.
- Valid and invalid URLs, ports, and timeout settings.
- Cross-field constraints and configuration defaults.

**Logging**
- Credential redaction in messages and structured fields.
- Exception redaction.
- Request-context isolation across concurrent tasks.
- Repeated configuration without duplicate output.
- Malformed context values and oversized log fields.

**Validation**
- Invalid email, URL, identifier, and payload fields.
- Boundary values and malformed inputs.
- Unsupported fields and incorrect types.
- Unicode, whitespace, and normalization cases.

**Import/export**
- Malformed CSV, JSON, and JSONL.
- Oversized input and record limits.
- Sensitive-field exclusion.
- CSV formula-injection cases.
- Partial failures and output-size limits.
- Unicode and round-trip compatibility.

**Health checks**
- Successful and failing probes.
- Probe exceptions and timeouts.
- Required versus optional dependency failures.
- Overall deadline behavior.
- Concurrent checks and shutdown.
- Prevention of sensitive diagnostic disclosure.

Do not claim production readiness until the package has been tested with the actual application configuration and integrations.

## 12. Security and Privacy

1. **Input validation:** Validate untrusted data before processing.
2. **Authorization:** Enforce access controls independently of validation.
3. **Database safety:** Use parameterized queries and database constraints.
4. **Secrets management:** Keep credentials in protected configuration systems.
5. **Logging:** Exclude passwords, tokens, document contents, and unnecessary personal information.
6. **Uploads:** Enforce size limits, inspect file signatures, and scan files where appropriate.
7. **Exports:** Apply field allowlists, access checks, and retention rules.
8. **Outbound requests:** Protect server-side URL fetching against SSRF.
9. **Health endpoints:** Expose only diagnostic information appropriate to each audience.
10. **Production configuration:** Fail closed when mandatory security settings are missing or invalid.
11. **Resource limits:** Bound input sizes, record counts, execution times, and generated output.
12. **Dependency hygiene:** Review dependencies and security advisories regularly.

## 13. Integration Architecture

```text
API / Web Layer
      |
      v
Application Services
      |
      +----> Configuration
      +----> Logging
      +----> Validation
      +----> Import / Export
      +----> Health Checks
      |
      v
Repositories / External Integrations
      |
      +----> Database
      +----> Email Provider
      +----> Queue / Redis
      +----> File Storage
      +----> Payment Provider
      +----> AI Provider
```

Keep the package independent of HTTP request objects and framework-specific response types. Translate validation errors and health reports into HTTP responses in the web layer.

If MedOrbits also uses a Node.js backend, align the Python and Node.js implementations on environment variable names, schemas, database settings, and error contracts. Do not assume identical validation behavior without cross-language tests.

## 14. Versioning and Maintenance

- Keep `__version__` synchronized with release metadata.
- Introduce breaking changes deliberately.
- Maintain validation and configuration contracts where practical.
- Add regression tests for changes to validators and settings.
- Document new environment variables in deployment documentation.
- Review dependencies and security advisories regularly.
- Document changes to import/export formats and health response schemas.
- Keep examples synchronized with actual function signatures.
- Test supported Python versions in continuous integration.
- Verify that importing package modules does not initialize external services.

## 15. License

Copyright MedOrbits. All rights reserved.

Unless otherwise authorized in writing, this package is proprietary and may not be redistributed or commercially reused outside the applicable MedOrbits license or agreement.
