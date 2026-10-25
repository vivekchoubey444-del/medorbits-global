
# MedOrbits Python Configuration

**Directory:** `/python/config/`  
**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**Website:** https://www.medorbits.in/  
**Runtime:** Python 3.10+ recommended  
**Status:** Configuration documentation

## 1. Overview

The `/python/config/` directory contains configuration files used by MedOrbits Python utilities, validation tools, repository analysis scripts, and automation workflows.

Configuration files should define application behavior without embedding environment-specific values, credentials, or secrets directly in source code.

This directory should prioritize:

- Explicit configuration schemas and versioning.
- Secure defaults and fail-closed validation.
- Consistent path handling across operating systems.
- Reproducible execution and predictable error handling.
- Environment-specific overrides without committed secrets.
- Automated validation and regression tests.

## 2. Recommended Directory Structure

```text
python/
├── config/
│   ├── README.md
│   ├── defaults.json
│   ├── schema.json
│   ├── development.json
│   ├── production.json
│   └── test.json
├── tools/
│   ├── README.md
│   └── structure_adapter.py
└── tests/
    └── config/
        ├── test_config_schema.py
        ├── test_config_loading.py
        └── fixtures/
            └── valid-config.json
```

This is a recommended layout, not a statement that all these files already exist. Keep only files that the application actually uses.

## 3. Configuration File Responsibilities

| File | Purpose |
|—|—|
| `defaults.json` | Safe, non-secret baseline settings |
| `schema.json` | Defines supported fields, types, constraints, and required properties |
| `development.json` | Local development overrides |
| `production.json` | Production-specific non-secret settings |
| `test.json` | Isolated test settings |
| `.env` or deployment secrets | Sensitive environment-specific values; never commit secrets |

If MedOrbits uses a different configuration format or loader, document the actual implementation rather than introducing a second configuration system unnecessarily.

## 4. Configuration Loading Rules

All configuration consumers should follow the same loading policy.

1. Load the baseline configuration.
2. Apply permitted environment-specific overrides.
3. Validate the merged configuration against the schema.
4. Reject unknown or invalid values where strict validation is required.
5. Resolve relative paths against an explicit project root, not an unpredictable current working directory.
6. Never log passwords, tokens, private keys, cookies, or other sensitive values.
7. Fail clearly when a required setting is missing.
8. Avoid silently replacing malformed production configuration with defaults.

Configuration precedence should be documented and consistent. A recommended precedence is:

1. Built-in safe defaults.
2. Environment-specific configuration.
3. Explicit environment-variable overrides.
4. Explicit command-line overrides.

Only implement precedence levels that the actual loader supports.

## 5. Security Requirements

### Secrets management

- Never commit production credentials or API keys.
- Keep secret values in the deployment platform’s secret manager or environment variables.
- Commit an `.env.example` containing placeholder values only.
- Redact secrets from exceptions, diagnostic reports, and audit logs.
- Restrict access to production configuration and deployment credentials.

### File and path security

- Resolve paths before accessing files.
- Validate that configuration paths remain within approved directories when required.
- Reject unexpected symbolic links where they could bypass security boundaries.
- Avoid loading configuration files from untrusted user-controlled locations.
- Use atomic writes for configuration updates where appropriate.
- Do not overwrite an existing configuration silently.

### Remote source configuration

If the configuration defines external data sources, such as admissions, colleges, courses, jobs, fees, or announcements:

- Require HTTPS.
- Use an explicit hostname allowlist.
- Validate resolved IP addresses and every redirect destination.
- Block loopback, private, link-local, and cloud-metadata destinations.
- Enforce request timeouts and response-size limits.
- Validate the returned data before importing or publishing it.
- Keep automatic publication disabled until the review and approval workflow has been verified.

These protections must be implemented by the code that consumes the configuration; documenting a security setting does not enforce it.

## 6. Environment Configuration

Use explicit environment names, for example:

```text
development
test
staging
production
```

Production settings should not be loaded implicitly during tests. Tests must use isolated fixtures and must not contact production services or mutate production data.

Recommended environment variables include:

```text
MEDORBITS_ENV
MEDORBITS_CONFIG_DIR
MEDORBITS_LOG_LEVEL
MEDORBITS_DATABASE_URL
```

The database URL is sensitive and must never be printed in full. Add additional variables only when they are supported by the application.

## 7. JSON Schema Validation

For JSON configuration files, use JSON Schema or an equivalent validator to check:

- Required properties and data types.
- Supported configuration versions.
- Numeric bounds and string length limits.
- Enumerated values such as environment names and log levels.
- URL and hostname restrictions where applicable.
- Duplicate identifiers and conflicting settings.
- Unknown properties in security-sensitive sections.

A schema validates the configuration’s structure. Application-level validation must still enforce cross-field rules and runtime security requirements.

## 8. Testing Requirements

Configuration tests should verify:

- Valid configuration loads successfully.
- Missing required settings produce clear errors.
- Invalid JSON and unsupported schema versions are rejected.
- Incorrect types and out-of-range values are rejected.
- Environment overrides follow documented precedence.
- Secrets are not included in logs or error messages.
- Relative paths resolve consistently.
- Production configuration cannot be loaded accidentally by tests.
- Invalid remote source URLs and unapproved hosts are rejected.
- Failed configuration updates do not corrupt the previous valid file.

Run the tests using the project’s configured Python test runner. For example, if `pytest` is installed and configured:

```bash
python -m pytest python/tests/config -q
```

Adjust the path if the actual test suite uses a different directory structure.

## 9. Error Handling and Diagnostics

Configuration errors should identify the setting or file that failed and explain how to correct it, without exposing sensitive values.

Recommended error categories:

- `CONFIG_NOT_FOUND`
- `CONFIG_PARSE_ERROR`
- `CONFIG_SCHEMA_ERROR`
- `CONFIG_VERSION_UNSUPPORTED`
- `CONFIG_PATH_INVALID`
- `CONFIG_SECURITY_VALIDATION_FAILED`
- `CONFIG_ENVIRONMENT_MISMATCH`

Use these identifiers only if the application’s error-handling implementation supports them.

## 10. Change Management

For every configuration change:

1. Update the relevant schema and documentation.
2. Add or update tests.
3. Review security-sensitive changes separately.
4. Run validation before deployment.
5. Preserve a known-good configuration for rollback.
6. Record who approved production changes and when, using the project’s audit mechanism.

Do not store secrets in version-control history, test fixtures, generated reports, or configuration backups.

## 11. Definition of Done

The configuration directory is ready for production use when:

- [ ] All referenced configuration files exist.
- [ ] The loader and schema agree on supported fields.
- [ ] Environment precedence is documented and tested.
- [ ] Secrets are managed outside committed configuration files.
- [ ] Invalid configurations fail safely.
- [ ] Remote-source protections are enforced by application code.
- [ ] Tests run without accessing production resources.
- [ ] Production changes have an auditable review and rollback process.

## 12. Maintenance

Keep this README aligned with the actual files, configuration loader, schema, and tests in the repository. Remove obsolete examples when the implementation changes.

**Reference:** [Python Packaging User Guide — Writing `pyproject.toml`](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/) for Python project metadata and tooling configuration conventions.
