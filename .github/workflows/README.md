
# MedOrbits — GitHub Scripts

**Directory:** `.github/scripts/`  
**Documentation version:** 2.0.0

## 1. Purpose

This directory contains helper scripts for validating, testing, maintaining, and troubleshooting the MedOrbits repository.

Scripts should be safe, documented, repeatable, and suitable for local development or GitHub Actions where applicable.

**Documentation policy:** This README describes the intended interfaces and conventions. Verify each script’s actual implementation before relying on optional features or command-line examples.

## 2. Directory Structure

The intended structure is:

```text
.github/
└── scripts/
    ├── README.md
    ├── validate-commit-message.sh
    └── test-validate-commit-message.sh
```

Keep this documentation synchronized with the scripts actually present in the repository.

## 3. Available Scripts

### 3.1 Commit Message Validator

**File:** `validate-commit-message.sh`

Validates commit messages against the conventions configured for the repository.

Typical responsibilities include:

- Checking Conventional Commit types and subject structure.
- Rejecting empty or malformed commit subjects.
- Enforcing the configured subject-length limit.
- Providing help or version information, if implemented.
- Returning a nonzero exit status when validation fails.

#### Usage

The following examples assume that the validator accepts a commit message as a positional argument. Confirm the actual interface in the script before using them.

```bash
bash .github/scripts/validate-commit-message.sh “feat: add admission search”
```

If the validator accepts a message-file path instead, use the documented file-based interface.

#### Expected behavior

| Condition | Expected result |
|—|—|
| Valid commit message | Exit status `0` |
| Invalid commit message | Nonzero exit status |
| Invalid command-line arguments | Nonzero exit status, with usage information where supported |
| Missing required input | Nonzero exit status, with a clear error |

These expectations must be aligned with the actual implementation.

### 3.2 Commit Message Validator Tests

**File:** `test-validate-commit-message.sh`

Tests the commit-message validator’s supported behavior, including valid and invalid messages, boundary conditions, and command-line options.

#### Run the tests

```bash
bash .github/scripts/test-validate-commit-message.sh
```

The test suite should verify the following behaviors where applicable:

- Valid Conventional Commit messages pass.
- Invalid types and malformed subjects fail.
- Empty messages are rejected.
- Subject-length limits are enforced at their documented boundaries.
- Help and version options behave as documented.
- Supported environment variables work correctly.
- Verbose output appears only when supported and enabled.
- Temporary files are cleaned up after execution.
- The test suite does not modify tracked project files.
- Test failures produce a nonzero exit status.

Tests must reflect the validator’s actual interface rather than assuming unsupported options or behavior.

## 4. Running Scripts Locally

Run commands from the repository root unless a script explicitly documents another working directory.

### 4.1 Verify that the scripts exist

```bash
test -f .github/scripts/validate-commit-message.sh
test -f .github/scripts/test-validate-commit-message.sh
```

These commands return a nonzero status if a required file is missing.

### 4.2 Check shell syntax

If the scripts use Bash-specific syntax:

```bash
bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh
```

If both scripts are strictly POSIX-compatible, the following checks may also be used:

```bash
sh -n .github/scripts/validate-commit-message.sh
sh -n .github/scripts/test-validate-commit-message.sh
```

**Important:** `sh -n` is not a reliable substitute for `bash -n` when a script uses Bash-specific features such as arrays, `[[ ... ]]`, or `mapfile`.

### 4.3 Run the test suite

```bash
bash .github/scripts/test-validate-commit-message.sh
```

Review the output and exit status. Do not treat a test suite that skips all assertions as a successful validation.

## 5. Development Guidelines

When adding or modifying repository scripts:

1. Use clear filenames that describe the script’s purpose.
2. Document arguments, environment variables, dependencies, and exit codes.
3. Prefer POSIX-compatible syntax when practical.
4. Use Bash explicitly when Bash-specific features are required.
5. Quote variable expansions and safely handle filenames containing spaces.
6. Enable appropriate error handling and check the status of important commands.
7. Avoid destructive operations unless explicitly requested and protected by safeguards.
8. Never print credentials, API keys, access tokens, or private user data.
9. Avoid downloading or executing untrusted code.
10. Keep tests independent of production credentials and external services.
11. Use temporary directories or files with reliable cleanup traps.
12. Update this README whenever a script’s interface or behavior changes.
13. Preserve source files and repository state during validation.
14. Report skipped checks clearly instead of presenting them as completed tests.

## 6. Security and Reliability

Treat script arguments, environment variables, filenames, and external command output as untrusted input.

### Required safeguards

- Do not use `eval` to execute arbitrary input.
- Avoid exposing secrets in command-line arguments, logs, error messages, or workflow summaries.
- Use securely created temporary files and directories.
- Clean up temporary resources on normal exit and common failure paths.
- Fail clearly when required files, commands, or interpreters are missing.
- Avoid following untrusted symbolic links when traversing files, where relevant.
- Do not automatically rewrite commit history, delete project files, or force-push.
- Do not execute code from untrusted pull requests with privileged credentials.
- Use the minimum GitHub Actions permissions necessary.
- Prefer immutable, verified commit-SHA pins for third-party Actions in production workflows.

### Exit-status convention

Unless a script documents a different contract:

| Exit code | Meaning |
|—|—|
| `0` | Operation completed successfully |
| Nonzero | Validation failed, an error occurred, or a required prerequisite was unavailable |

A skipped check must be reported distinctly from a check that actually passed.

## 7. GitHub Actions Integration

Scripts in this directory may be invoked from workflows under `.github/workflows/`.

Example:

```yaml
- name: Validate commit-message scripts
  shell: bash
  run: |
    set -Eeuo pipefail

    bash -n .github/scripts/validate-commit-message.sh
    bash -n .github/scripts/test-validate-commit-message.sh
    bash .github/scripts/test-validate-commit-message.sh
```

Before integrating a script into a workflow:

- Confirm the script exists at the documented path.
- Use the correct interpreter.
- Grant only the permissions required by the job.
- Set reasonable job timeouts.
- Do not expose secrets to untrusted pull-request code.
- Preserve useful diagnostic output.
- Allow genuine failures to fail the workflow.
- Test the workflow against the actual repository structure.

## 8. Troubleshooting

### Permission denied

Run the script through its interpreter:

```bash
bash .github/scripts/validate-commit-message.sh
```

Alternatively, if direct execution is intended:

```bash
chmod +x .github/scripts/validate-commit-message.sh
```

The script must have a valid shebang for direct execution.

### Command not found

Check that the required interpreter and dependencies are installed.

```bash
command -v bash
command -v sh
```

Check additional dependencies against the script’s documentation.

### Tests fail

1. Run the appropriate shell syntax check.
2. Identify the failing assertion.
3. Verify the validator’s current interface.
4. Check whether the expected subject-length limit or commit types changed.
5. Re-run the tests after making a targeted correction.

Do not weaken assertions simply to make the suite pass.

### Script is missing

Check the exact path and filename:

```bash
ls -la .github/scripts/
```

GitHub Actions runners use Linux, where paths and filenames are case-sensitive.

### Script succeeds but performs no meaningful checks

Review whether the test suite executed its assertions and whether the validator’s exit status is propagated. A successful shell exit alone does not prove that validation occurred.

## 9. Contribution Checklist

Before committing changes to `.github/scripts/`:

- [ ] The script has a clear purpose and documented interface.
- [ ] Required dependencies and environment variables are documented.
- [ ] Shell syntax validation passes using the correct interpreter.
- [ ] Relevant tests execute and pass.
- [ ] Failure cases return appropriate exit codes.
- [ ] Temporary files are cleaned up.
- [ ] No credentials or personal data are exposed.
- [ ] No unintended repository modifications occur.
- [ ] GitHub Actions integration uses least-privilege permissions.
- [ ] Related documentation is updated.

## 10. Maintenance

This README documents the intended conventions for `.github/scripts/`.

Before relying on any command or feature documented here, confirm that the corresponding script exists and implements the described behavior.

When introducing a new script:

1. Add the script to `.github/scripts/`.
2. Document its purpose, interface, prerequisites, and exit codes.
3. Add or update automated tests.
4. Integrate it into CI where appropriate.
5. Update the directory structure and this README.

**Repository policy:** Validation should be repeatable, failures should be visible, and routine checks should not modify tracked source files.
```
