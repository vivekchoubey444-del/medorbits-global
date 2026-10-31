
# Changelog — MedOrbits Local Agent

All notable changes to the MedOrbits Local Agent are documented in this file.

This project follows a versioned release process. Dates use ISO 8601 format.
Unreleased changes are listed first.

## [Unreleased]

### Added
- Repository utility tools for validation, inventory, and file cataloguing.
- JSON specification support for controlled file generation.
- Dry-run planning for file creation and scaffolding.
- Repository-relative path validation and symbolic-link checks.
- Timestamped backups before replacing existing files.
- Python and JSON syntax validation.
- HTML local-reference checks.
- Read-only security scanning utilities.
- Shared JavaScript helpers for path validation, task normalization, and
  secret redaction.
- Environment configuration template for local development.
- Git ignore rules for secrets, caches, runtime state, and generated reports.
- Dashboard structure for status, tasks, activity, and health views.

### Security
- Disabled arbitrary shell execution by default.
- Disabled file writes and deletions by default in the agent configuration.
- Restricted generation specifications to a bounded number of entries.
- Added output-size limits for generated files.
- Added exclusions for dependency directories, caches, and Git metadata.
- Added warnings for missing local HTML references.
- Documented that local AI providers must not receive private repository
  content without explicit authorization.

### Changed
- Standardized the Local Agent on Python’s standard library for baseline
  repository tools.
- Added explicit command-line options for planning and applying scaffolds.
- Added structured error messages and non-zero exit codes for failed checks.

### Known limitations
- The dashboard requires a compatible server implementation and API routes.
- The security scanner is heuristic and cannot guarantee that a repository
  contains no secrets or vulnerabilities.
- HTML reference checking does not replace a full browser or accessibility test.
- File-generation checks cannot eliminate every filesystem race condition.
- Long-running Python operations cannot safely interrupt non-cooperative code
  merely by timing out a parent operation.
- Environment variables must be wired into the actual configuration loader;
  example variables alone do not configure the application.

## [1.1.0] - 2026-10-29

### Added
- Improved standalone `agent.py` repository utility.
- Added escaped HTML scaffold metadata to prevent unsafe markup injection.
- Added reusable validation and inventory commands.
- Added explicit apply controls for scaffold generation.

### Security
- Added sensitive-filename checks for generated outputs.
- Added bounded specification and generated-file sizes.
- Added repository containment checks and rejection of symbolic-link paths.
- Added temporary-file writes to reduce partial-write risk.
- Added backup creation before replacing existing files.

### Fixed
- Improved error handling for invalid JSON specifications.
- Added HTML checks for missing local references and repository path escapes.
- Clarified the distinction between preview and write operations.

## [1.0.0] - 2026-10-29

### Added
- Initial Local Agent configuration and utility structure.
- Initial repository inspection, validation, and cataloguing utilities.
- Initial dashboard HTML, CSS, and JavaScript integration.
- Initial safe-mode defaults and local development documentation.

—

## Versioning policy

- **MAJOR**: incompatible API, configuration, or file-format changes.
- **MINOR**: backward-compatible functionality.
- **PATCH**: backward-compatible fixes and security improvements.

## Release checklist

- [ ] Validate Python syntax.
- [ ] Validate JSON configuration files.
- [ ] Run repository security checks.
- [ ] Run automated tests.
- [ ] Verify dashboard API compatibility.
- [ ] Review environment-variable documentation.
- [ ] Check that no secrets or generated runtime files are committed.
- [ ] Document known limitations and migration requirements.
- [ ] Confirm the release version matches package metadata.

## Security reporting

Do not publish credentials, access tokens, private keys, or sensitive repository
data in issues or changelog entries. Report security issues through the
project’s designated private reporting channel.

## Dashboard integration update — 2026-11-01

- Replaced the simulated dashboard with a real API-connected dashboard served from `public/index.html`.
- Added live polling for server status, configuration, and task history.
- Connected the four server-allowlisted operations: repository validation, security audit, syntax check, and file catalog.
- Added backend-confirmed task output inspection and cancellation controls.
- Removed unsupported SSE/start/pause/stop assumptions from the dashboard.
- Changed the default `npm start` entry point to `server.js`; retained the separate orchestration CLI as `npm run start:cli`.
- Documented local-only defaults, runtime requirements, and public-exposure restrictions.
