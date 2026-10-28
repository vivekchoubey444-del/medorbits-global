
# MedOrbits Local Agent — Tools

Version: 1.0.0

Utilities for repository inspection, file cataloguing, validation,
security checks, and controlled task execution.

## Safety defaults

- Repository operations are read-only unless explicitly enabled.
- All repository paths must remain inside the configured root.
- Symbolic links are not followed during recursive scans.
- No shell commands are executed from task descriptions.
- File writes require explicit opt-in and are restricted to the repository.
- Secrets, dependency folders, build outputs, and Git internals are excluded.
- Task failures are reported without silently claiming success.

## Requirements

- Python 3.10+
- Node.js 20+ for JavaScript utilities
- Python standard library for the baseline tools

## Quick start

From the repository root:

    python local-agent/tools/validate_repository.py .
    python local-agent/tools/file_catalog.py . —output repository-catalog.json
    python local-agent/tools/security_audit.py .
    python local-agent/tools/syntax_check.py .

Use `—help` with any Python command for options.

## Important

These utilities do not override operating-system permissions, repository
protections, or security controls. They do not guarantee that all project
tests pass. Review generated reports before applying changes.
