GitHub Scripts

This directory contains helper scripts for repository validation, commit message enforcement, testing, and maintenance tasks used by MedOrbits.

Scripts should be predictable, documented, secure, and safe to run locally or from GitHub Actions.

Directory Structure

.github/
└── scripts/
    ├── README.md
    ├── validate-commit-message.sh
    └── test-validate-commit-message.sh

This is the intended structure. Keep this list synchronized with the scripts actually present in the repository.

Available Scripts

validate-commit-message.sh

Validates commit messages against the commit conventions configured for MedOrbits.

Expected responsibilities:

* Validate the commit message format.
* Enforce approved Conventional Commit types.
* Check subject length and formatting.
* Reject empty or malformed messages.
* Return a nonzero exit status for invalid messages.
* Provide usage information if supported by the script.

Example invocation, if the validator accepts a message argument:

bash .github/scripts/validate-commit-message.sh \
  “feat: add admission search”

If the validator expects a file path or another interface, follow its actual usage instructions.

test-validate-commit-message.sh

Tests the commit message validator.

Run it with:

bash .github/scripts/test-validate-commit-message.sh

The test suite should cover:

* Valid Conventional Commit messages.
* Invalid types and malformed subjects.
* Subject-length boundaries.
* Empty messages and missing arguments.
* Supported help and version options.
* Supported environment-variable settings.
* Verbose output, if implemented.
* Appropriate exit codes.
* Temporary-file cleanup.

Tests must match the actual validator interface and should not modify tracked project files.

Local Validation

Run these commands from the repository root.

Check that the expected scripts exist:

test -f .github/scripts/validate-commit-message.sh
test -f .github/scripts/test-validate-commit-message.sh

Check shell syntax:

bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh

Run the tests:

bash .github/scripts/test-validate-commit-message.sh

Use sh instead of bash only when a script is designed for POSIX shell compatibility.

Development Standards

When creating or modifying scripts:

1. Use descriptive filenames and clear function names.
2. Document arguments, environment variables, dependencies, and exit codes.
3. Quote variable expansions and handle paths containing spaces safely.
4. Use explicit error handling and meaningful failure messages.
5. Avoid eval and unsafe execution of user-controlled input.
6. Never print tokens, passwords, API keys, or other secrets.
7. Avoid destructive Git commands and automatic history rewrites.
8. Use temporary directories and cleanup traps for generated files.
9. Keep scripts independent of production credentials where possible.
10. Update this README whenever script behavior or usage changes.

Security Requirements

* Treat commit messages, filenames, environment variables, and other external input as untrusted.
* Do not embed credentials in scripts.
* Do not expose secrets in GitHub Actions logs.
* Avoid running untrusted downloaded scripts.
* Give workflow jobs only the permissions they require.
* Review changes before running scripts that modify repository state.
* Ensure scripts fail clearly when required files or tools are missing.

GitHub Actions Integration

Scripts may be called by workflows under .github/workflows/.

When integrating a script:

* Use the correct relative path.
* Set a reasonable job timeout.
* Preserve useful error output.
* Avoid exposing secrets to untrusted pull-request code.
* Verify the workflow’s permissions and trigger conditions.
* Test locally before making the workflow a required status check.

Troubleshooting

Permission denied

Run the script through Bash:

bash .github/scripts/example.sh

If it is intended to be executable, set the executable bit:

chmod +x .github/scripts/example.sh

Syntax errors

Run:

bash -n .github/scripts/example.sh

Tests fail

Check the failing test, compare it with the validator’s actual interface, and verify that expected behavior is documented correctly.

Script not found

Verify the exact path and filename. GitHub Actions runners use Linux, where filenames are case-sensitive.

Contribution Checklist

Before committing script changes:

* [ ]	The script has a clear purpose and documented usage.
* [ ]	Shell syntax validation passes.
* [ ]	Relevant tests pass.
* [ ]	Error conditions and exit codes are handled correctly.
* [ ]	No secrets or sensitive information are exposed.
* [ ]	No unintended repository changes occur.
* [ ]	Related documentation is updated.

⸻

Maintenance note: This README documents intended conventions. Verify that each referenced script exists and that the examples match its current implementation.