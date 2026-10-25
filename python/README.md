MedOrbits — Python Engineering Toolkit

Directory: python/
Python version: 3.12+
Purpose: Repository automation, data validation, integration management, and automated testing for the MedOrbits platform.

1. Overview

The MedOrbits Python toolkit provides reusable utilities for maintaining project structure, validating datasets, analyzing dependencies, managing integrations, and running automated tests.

The toolkit is designed to support reliable development workflows while preserving existing project files and protecting sensitive configuration.

2. Directory Structure

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

This is the intended structure based on the current project layout. Confirm individual files and packages exist before relying on them.

3. Component Responsibilities

Directory	Responsibility
scripts/	Repeatable development, maintenance, and operational scripts
tools/	Repository inspection, structure adaptation, dependency analysis, dataset management, and scaffolding
integrations/	Shared infrastructure and adapters for approved external services
tests/	Automated unit, regression, validation, and utility tests

Keep each component focused on one responsibility. Reuse existing utilities instead of creating duplicate implementations.

4. Requirements

* Python 3.12 or later.
* Project dependencies installed using the repository’s documented setup.
* Execution from the appropriate repository root.
* Environment-specific configuration for any external services.
* Automated tests for implemented functionality.

Check the active Python version:

python —version

Install dependencies using the actual project configuration. For example, if the repository contains a development requirements file:

python -m pip install -r requirements-dev.txt

Do not assume that optional dependency files exist.

5. Common Development Commands

Run these commands from the repository root.

Validate Python syntax

python -m compileall -q python/

Run the automated tests

python -m pytest python/tests/ -v

Run a specific test module

python -m pytest python/tests/test_validators.py

Run linting, if Ruff is configured

ruff check python/

Check formatting, if Ruff is configured

ruff format —check python/

These commands are examples of the intended workflow. Confirm the project’s installed tools and configuration before using optional commands.

6. Repository Tooling

The tools directory provides utilities for maintaining repository consistency.

* Repository integrity: identify structural or configuration issues.
* Structure adaptation: inspect or align project structures.
* Dependency binding: analyze declared dependencies and references.
* Data source management: validate or manage supported datasets.
* Repository scaffolding: generate missing files and fill eligible empty files according to explicit rules.

Safety requirements

* Prefer read-only inspection by default.
* Require explicit options for file modifications.
* Preserve non-empty files unless overwriting is explicitly authorized.
* Back up files before destructive changes where supported.
* Validate generated Python and JSON files.
* Report unresolved references and failed validations clearly.
* Never place credentials or sensitive data in generated reports.

7. Integration Management

The integrations/ package provides shared infrastructure for authorized external services.

Its intended responsibilities include:

* Provider contracts and registration.
* Configuration and secret references.
* Shared HTTP communication.
* API client operations.
* Storage-provider operations.
* Standardized exceptions.
* Health reporting.
* Repository-level integration inspection.

Provider adapters should validate external responses, use bounded timeouts, follow safe retry policies, and protect sensitive information.

A registered provider or valid configuration is not proof that an external service is operational. Verify connectivity and behavior through appropriate tests.

Refer to integrations/README.md for the detailed integration architecture.

8. Testing and Quality Assurance

The tests/ package protects existing behavior and verifies changes.

Testing should cover:

* Valid and invalid inputs.
* Boundary conditions.
* Configuration and environment handling.
* Exception mapping.
* HTTP failures and retry behavior.
* Registry operations.
* JSON validation.
* Import/export behavior.
* Regression cases for resolved defects.

Mock external services during unit tests. Use controlled sandboxes for provider integration tests and never run destructive tests against production resources.

Refer to tests/README.md for test execution and contribution standards.

9. Security and Configuration

* Keep API keys, passwords, and tokens out of source control.
* Use environment variables or an approved secrets manager.
* Separate development, testing, staging, and production credentials.
* Validate external URLs and restrict outbound destinations.
* Enable TLS certificate verification.
* Redact secrets and unnecessary personal data from logs.
* Protect uploaded documents and storage operations with authorization checks.
* Avoid network requests and external-service initialization during package imports.

Use .env.example for safe configuration templates where appropriate. Never commit populated secret files.

10. Development Workflow

For every change:

1. Inspect the existing implementation and its public interfaces.
2. Identify affected tools, integrations, datasets, and tests.
3. Reuse existing utilities where appropriate.
4. Implement the smallest coherent change.
5. Add or update regression tests.
6. Run relevant syntax checks and tests.
7. Review file modifications and generated reports.
8. Update documentation and configuration examples.
9. Verify that no secrets or unintended file changes were introduced.

Do not treat successful syntax compilation as proof of correct runtime behavior.

11. Troubleshooting

Problem	Action
Import errors	Verify the working directory, package structure, and Python environment
Missing dependencies	Follow the project’s documented installation process
Invalid JSON	Check encoding, syntax, required fields, and expected types
Missing local references	Verify paths against the actual repository structure
HTTP failures	Inspect sanitized error details, timeouts, authentication, and provider status
Test failures	Run the failing module independently, then rerun the complete suite
Unexpected file changes	Review the diff and restore unintended modifications
Missing configuration	Check required environment variables without printing secret values

12. Definition of Done

* [ ]	Python syntax checks pass.
* [ ]	Relevant automated tests pass.
* [ ]	Regression coverage is included where appropriate.
* [ ]	Configuration and dependencies are documented.
* [ ]	Existing project files are preserved as intended.
* [ ]	Sensitive data is protected.
* [ ]	Documentation reflects the actual implementation.
* [ ]	Operational claims are supported by verification.

13. Maintenance

Keep this README synchronized with the actual directory structure, supported Python version, dependency configuration, testing commands, and integration interfaces.

Engineering principle: Build reusable, secure, testable Python utilities. Preserve existing project behavior, make file modifications explicit, and distinguish intended functionality from functionality that has been implemented and verified.