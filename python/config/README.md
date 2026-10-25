
# MedOrbits Python Configuration

**Directory:** `/python/config/`  
**Purpose:** Centralize configuration for Python-based importers, data processing tasks, validation pipelines, and scheduled background jobs.

## 1. Overview

This directory contains configuration files that control how MedOrbits Python services discover data sources, import external records, validate incoming data, and prepare records for review or publication.

Configuration files define operational settings. They do not implement the behavior themselves; Python modules must explicitly load, validate, and enforce the configured values.

## 2. Directory Structure

```text
python/
├── config/
│   ├── README.md
│   └── live-source-import.json
├── ...
```

Keep this README alongside the configuration files it documents. Update the directory structure when new configuration files are added.

## 3. Configuration Registry

### `live-source-import.json`

Controls the configuration for importing approved JSON data from trusted external sources.

The configuration may define:

- `allowed_hosts`: Explicitly trusted source hostnames.
- `sources`: Registered import endpoints and their categories.
- `settings`: Request limits, timeouts, concurrency, and refresh intervals.
- `validation`: JSON parsing and record-validation requirements.
- `deduplication`: Rules for identifying existing records.
- `publication`: Review and publication controls.
- `retry`: Retry limits and backoff behavior.
- `rate_limit`: Request frequency limits.
- `change_detection`: Record change tracking.
- `storage`: Data retention and persistence preferences.
- `logging`: Operational logs and audit settings.

Refer to `live-source-import.json` for the current configuration values.

## 4. Configuration Loading

Python services should load configuration from a known path and validate it before starting an import.

Example:

```python
# python/config_loader.py

import json
from pathlib import Path
from typing import Any

CONFIG_DIR = Path(__file__).resolve().parent / “config”


def load_json_config(filename: str) -> dict[str, Any]:
    “””Load a JSON configuration from the trusted config directory.”””

    if Path(filename).name != filename:
        raise ValueError(“Configuration filename must not contain a path.”)

    if not filename.endswith(“.json”):
        raise ValueError(“Only JSON configuration files are supported.”)

    config_path = (CONFIG_DIR / filename).resolve()

    if config_path.parent != CONFIG_DIR.resolve():
        raise ValueError(“Configuration path is outside the config directory.”)

    try:
        with config_path.open(“r”, encoding=“utf-8”) as file:
            config = json.load(file)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f”Required configuration file is missing: {filename}”
        ) from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f”Invalid JSON in configuration file: {filename}”
        ) from exc

    if not isinstance(config, dict):
        raise RuntimeError(
            f”Configuration must contain a JSON object: {filename}”
        )

    return config


if __name__ == “__main__”:
    configuration = load_json_config(“live-source-import.json”)
    print(“Configuration loaded successfully.”)
    print(f”Registered sources: {len(configuration.get(‘sources’, []))}”)
```

Adjust the import path and module location to match the actual project layout.

Do not print secrets or sensitive configuration values to the console.

## 5. Environment-Specific Configuration

Use environment variables for deployment-specific settings and secrets.

Recommended environment names:

- `development`
- `test`
- `staging`
- `production`

Example environment variables:

```dotenv
MEDORBITS_ENV=development
MEDORBITS_IMPORT_ENABLED=false
MEDORBITS_IMPORT_TIMEOUT_SECONDS=15
MEDORBITS_IMPORT_MAX_RESPONSE_BYTES=5242880
MEDORBITS_IMPORT_LOG_LEVEL=INFO
```

These are suggested names, not automatically supported settings. The Python application must explicitly read and validate each variable.

### Environment rules

- Disable live imports during unit tests unless a test explicitly requires them.
- Use staging to verify new sources before production.
- Keep production publication under controlled review.
- Do not store API keys, passwords, tokens, or database credentials in committed JSON files.
- Keep `.env` files out of version control.
- Provide `.env.example` with placeholder values only.
- Never allow an untrusted environment variable or remote response to silently weaken security controls.

## 6. Live-Source Import Requirements

Before an import begins, the importing service should:

1. Load the configuration from the trusted filesystem.
2. Confirm that the overall importer is enabled.
3. Select only registered sources with `enabled: true`.
4. Validate source URLs and their hostnames against `allowed_hosts`.
5. Require HTTPS where configured.
6. Validate DNS resolutions and block prohibited network destinations.
7. Enforce request timeouts and response-size limits.
8. Validate redirect destinations before following redirects.
9. Apply per-host rate limits and retry policies.
10. Parse the response using the configured format.
11. Validate records before persistence.
12. Deduplicate records and preserve existing identifiers.
13. Record source attribution and import metadata.
14. Quarantine invalid records.
15. Submit eligible records for review.

Configuration flags do not enforce these protections automatically. Each control must be implemented in the relevant Python module.

## 7. Trusted Host Validation

Treat `allowed_hosts` as an explicit hostname allowlist.

Requirements:

- Use real hostnames rather than placeholder domains in production.
- Normalize hostnames consistently before comparison.
- Match exact hostnames or explicitly approved subdomains.
- Do not use substring matching to authorize hosts.
- Reject URLs with unsupported schemes or embedded credentials.
- Revalidate destinations after redirects.
- Block loopback, private, link-local, and cloud metadata addresses when making server-side requests.
- Validate DNS results and account for DNS rebinding risks.
- Do not allow imported records to register additional trusted hosts automatically.

The configuration’s `allowed_hosts` list must be enforced by the importer, not merely documented.

## 8. Validation and Data Integrity

Validate configuration and imported records independently.

### Configuration validation

Check that:

- The root JSON value is an object.
- `allowed_hosts` is a list of valid hostnames.
- `sources` is a list of source objects.
- Each source has the required fields.
- Each source URL uses an allowed scheme.
- Each source hostname is allowlisted.
- `format` is supported.
- `category` is recognized by the application.
- Timeout, retry, and concurrency settings are within safe limits.
- Unknown configuration properties are rejected or explicitly handled.

### Imported record validation

Use the appropriate canonical schema for each resource type. Where available, integrate the project’s JSON schemas for applications, colleges, courses, examinations, and jobs.

Validate cross-field rules separately when they cannot be expressed reliably in JSON Schema.

Do not publish a record merely because it is valid JSON.

## 9. Publication and Review

External data must be treated as untrusted until validated and reviewed according to the applicable workflow.

Recommended defaults:

- Automatic publication: disabled.
- Human review: required.
- Source attribution: required.
- Invalid records: quarantined.
- Existing manually maintained records: protected from unapproved overwrites.
- Missing upstream records: not automatically deleted.
- Change history: retained where supported.

Imported content must never be executed as code or treated as instructions to the importer.

## 10. Logging and Monitoring

Record operational events such as:

- Import run started or completed.
- Source identifier and hostname.
- Number of records discovered, imported, updated, skipped, or quarantined.
- Request failures and retry attempts.
- Validation failures.
- Duplicate detection results.
- Publication review outcomes.
- Unexpected source changes.

Do not log:

- Authentication headers or cookies.
- Secrets and credentials.
- Complete private applicant records.
- Uploaded document contents.
- Unnecessary personal information.

Use structured logs and avoid recording full response bodies by default.

## 11. Testing

Test configuration behavior without relying on live external websites.

Recommended tests include:

- Valid configuration loads successfully.
- Missing configuration files produce clear errors.
- Malformed JSON is rejected.
- Incorrect field types are rejected.
- Disabled sources are not contacted.
- Unapproved hosts are rejected.
- Redirects to unapproved hosts are blocked.
- Private network destinations are blocked.
- Oversized responses are rejected.
- Request timeouts are enforced.
- Invalid records are quarantined.
- Duplicate records are not inserted twice.
- Publication remains disabled unless explicitly approved.

Use mocked HTTP responses or a controlled local test server. Avoid hitting production sources during ordinary unit tests.

## 12. Operational Checklist

Before deploying a configuration change:

- [ ] JSON syntax is valid.
- [ ] All source URLs are intentional and verified.
- [ ] Every enabled source has an approved hostname.
- [ ] Timeouts and response-size limits are configured.
- [ ] Redirect and network protections are implemented.
- [ ] Rate limits and retry policies are enforced.
- [ ] Record validation and deduplication are tested.
- [ ] Publication and overwrite rules are correct.
- [ ] Logs do not expose sensitive information.
- [ ] Tests pass in CI.
- [ ] Changes are reviewed and committed to version control.

## 13. Troubleshooting

| Problem | Recommended action |
|—|—|
| Configuration file not found | Verify the resolved configuration directory and deployment packaging. |
| JSON decoding error | Validate the file syntax and encoding. |
| Source rejected | Check the URL, hostname allowlist, scheme, and source enablement. |
| Request timeout | Check source availability and adjust timeouts only when justified. |
| HTTP 429 response | Respect `Retry-After`, reduce request frequency, and retry with backoff. |
| Schema validation failure | Inspect safe validation diagnostics and correct the source mapping. |
| Duplicate records | Review canonical identifiers, URLs, and content-hash logic. |
| Records remain unpublished | Check review requirements, source verification, and publication permissions. |

## 14. Maintenance Policy

- Keep configuration files in version control.
- Review source ownership and access policies periodically.
- Remove retired sources and obsolete settings.
- Test configuration changes before production deployment.
- Document newly introduced settings and their accepted values.
- Keep documentation aligned with the actual Python implementation.
- Do not claim a control is enforced until the relevant code and tests verify it.

—

**Project:** MedOrbits  
**Directory:** `/python/config/`  
**Primary configuration:** `live-source-import.json`  
**Operational principle:** Explicit source trust, strict validation, controlled imports, and reviewed publication.
