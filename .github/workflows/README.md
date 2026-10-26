GitHub Scripts

This directory contains helper scripts used to validate, maintain, and troubleshoot the MedOrbits repository. Scripts should be safe, documented, repeatable, and suitable for local development or GitHub Actions where applicable.

Directory Structure

.github/
└── scripts/
    ├── README.md
    ├── validate-commit-message.sh
    └── test-validate-commit-message.sh

This is the intended structure. Keep this documentation synchronized with the scripts actually present in the repository.

Available Scripts

1. Commit Message Validator

File: validate-commit-message.sh

Validates commit messages against the repository’s configured commit message conventions.

Typical responsibilities include:

* Checking Conventional Commit types and message structure.
* Rejecting malformed or empty commit subjects.
* Enforcing the configured subject-length limit.
* Providing usage information and version details, if implemented.
* Returning a nonzero exit code when validation fails.

Example:

sh .github/scripts/validate-commit-message.sh “feat: add admission search”

The example assumes the validator accepts a commit message as a positional argument. If the script instead accepts a file path, use the interface documented in that script.

2. Commit Message Validator Tests

File: test-validate-commit-message.sh

Tests the commit message validator’s expected behavior, including valid messages, invalid messages, boundary conditions, and supported command-line options.

Run the test suite with:

sh .github/scripts/test-validate-commit-message.sh

The tests should verify that:

* Valid Conventional Commit messages pass.
* Invalid message types and malformed subjects fail.
* Subject-length limits are enforced.
* Help and version options behave as documented.
* Supported environment variables work correctly.
* Verbose output is produced only when supported and enabled.
* Temporary files are removed after execution.
* The test suite does not modify tracked project files.

Keep the test expectations aligned with the validator’s actual interface and behavior.

Running Scripts Locally

Run commands from the repository root unless a script explicitly documents otherwise.

Check that the scripts exist:

test -f .github/scripts/validate-commit-message.sh
test -f .github/scripts/test-validate-commit-message.sh

Check shell syntax:

sh -n .github/scripts/validate-commit-message.sh
sh -n .github/scripts/test-validate-commit-message.sh

Run the test suite:

sh .github/scripts/test-validate-commit-message.sh

If a script requires Bash-specific syntax, use bash for syntax checks and execution instead of sh.

Development Guidelines

When adding or changing scripts:

1. Use clear names that describe the script’s purpose.
2. Document required arguments, environment variables, dependencies, and exit codes.
3. Prefer portable shell syntax when practical.
4. Quote variable expansions and handle paths containing spaces safely.
5. Use explicit error handling for commands that can fail.
6. Avoid destructive operations unless they are explicitly requested and protected by safeguards.
7. Never print credentials, API keys, tokens, or private user data.
8. Avoid downloading or executing untrusted code.
9. Keep tests independent of production credentials and external services.
10. Update this README whenever a script’s behavior or interface changes.

Security and Reliability

* Treat all user-provided input as untrusted.
* Do not use eval to process arbitrary input.
* Avoid exposing secrets through command-line arguments, logs, or workflow output.
* Use temporary directories and cleanup traps for generated test files.
* Make scripts fail clearly when required files or tools are missing.
* Review changes before running scripts that alter repository state.
* Do not automatically rewrite commit history, delete files, or force-push from validation scripts.

GitHub Actions Integration

Scripts may be invoked from workflows in .github/workflows/.

When integrating a script into a workflow:

* Grant only the permissions required for that job.
* Pin third-party actions to verified commit SHAs for production use.
* Set reasonable job timeouts.
* Do not expose secrets to untrusted pull-request code.
* Preserve useful error output and make failures visible.
* Test the workflow against the actual repository structure.

Troubleshooting

Permission denied

Run a shell script through its interpreter:

bash .github/scripts/example.sh

Alternatively, if the script is intended to be executable:

chmod +x .github/scripts/example.sh

Command not found

Check that the required interpreter and dependencies are installed.

Tests fail

Run the syntax check first, review the failing assertion, and verify that the test suite matches the current validator interface.

Script is missing

Check the exact path and filename. GitHub paths are case-sensitive in Linux-based runners.

Contribution Checklist

Before committing a script change:

* [ ]	The script has a clear purpose and documented interface.
* [ ]	Shell syntax validation passes.
* [ ]	Relevant tests pass.
* [ ]	Failure cases return appropriate exit codes.
* [ ]	No secrets or personal data are exposed.
* [ ]	No unintended repository modifications occur.
* [ ]	Related documentation is updated.

⸻

Maintenance note: This README documents the intended conventions for .github/scripts/. Confirm that each referenced script exists before relying on the examples.