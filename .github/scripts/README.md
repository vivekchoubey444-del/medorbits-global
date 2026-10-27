
# 🛠️ MedOrbits — GitHub Scripts

**Project:** MedOrbits  
**Release target:** `2.0.0`  
**Directory:** `.github/scripts/`

This directory contains helper scripts for repository validation, commit-message enforcement, testing, and maintenance tasks used by MedOrbits.

Scripts should be predictable, documented, secure, and safe to run locally or from GitHub Actions.

—

## 📁 Directory Structure

The intended structure is:

```text
.github/
└── scripts/
    ├── README.md
    ├── validate-commit-message.sh
    └── test-validate-commit-message.sh
```

Keep this list synchronized with the files actually present in the repository.

## 1. ✅ Available Scripts

### `validate-commit-message.sh`

Validates commit messages against the commit conventions configured for MedOrbits.

**Expected responsibilities:**

- Validate the commit header format.
- Enforce approved Conventional Commit types.
- Support optional scopes.
- Check subject length and formatting.
- Reject empty or malformed headers.
- Reject prohibited merge, fixup, squash, and amend message patterns.
- Provide usage information through `—help`.
- Return an appropriate exit status.

**Supported types:**

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`

**Expected format:**

```text
type(scope): subject
type: subject
```

Examples:

```text
feat(admissions): add college search
fix(api): handle missing request body
docs: update installation guide
security(auth): validate authorization headers
```

**Usage:**

The validator expects a path to a commit-message file as its first argument.

```bash
bash .github/scripts/validate-commit-message.sh /path/to/commit-message.txt
```

Display usage information:

```bash
bash .github/scripts/validate-commit-message.sh —help
```

Do not pass a commit-message string directly unless the validator is explicitly changed to support that interface.

### `test-validate-commit-message.sh`

Tests the commit-message validator using representative valid and invalid messages.

The test suite creates temporary files, invokes the validator, reports individual results, and returns a failure status if any assertion fails.

**Usage:**

```bash
bash .github/scripts/test-validate-commit-message.sh
```

Enable verbose output:

```bash
bash .github/scripts/test-validate-commit-message.sh —verbose
```

Display help:

```bash
bash .github/scripts/test-validate-commit-message.sh —help
```

**Environment variable:**

| Variable | Purpose |
|—|—|
| `VALIDATOR_PATH` | Optional path to `validate-commit-message.sh` |

Example:

```bash
VALIDATOR_PATH=“$PWD/.github/scripts/validate-commit-message.sh” \
  bash .github/scripts/test-validate-commit-message.sh
```

The test suite should cover:

- Valid Conventional Commit messages.
- Invalid types and malformed headers.
- Empty messages and missing subjects.
- Subject-length limits.
- Unsupported merge, fixup, squash, and amend patterns.
- Help and verbose options.
- Correct exit codes.
- Temporary-file cleanup.

Keep test expectations synchronized with the validator’s actual rules.

—

## 2. 🧪 Local Validation

Run the following commands from the repository root.

### Verify required files

```bash
test -f .github/scripts/validate-commit-message.sh
test -f .github/scripts/test-validate-commit-message.sh
test -f .github/scripts/README.md
```

### Check Bash syntax

```bash
bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh
```

### Run the test suite

```bash
bash .github/scripts/test-validate-commit-message.sh
```

### Run with detailed output

```bash
bash .github/scripts/test-validate-commit-message.sh —verbose
```

A successful syntax check confirms that Bash can parse the scripts. It does not prove that the validator behaves correctly. Run the test suite to check the documented behavior.

Use `sh` only for scripts specifically written and tested for POSIX shell compatibility. These scripts use Bash features and should be executed with Bash.

## 3. 📐 Development Standards

When creating or modifying repository scripts:

1. Use descriptive filenames and clear function names.
2. Document arguments, environment variables, dependencies, and exit codes.
3. Quote variable expansions and handle paths containing spaces safely.
4. Use explicit error handling and meaningful failure messages.
5. Avoid `eval` and unsafe execution of user-controlled input.
6. Never print tokens, passwords, API keys, or other secrets.
7. Avoid destructive Git commands and automatic history rewrites.
8. Use temporary directories with cleanup traps for generated files.
9. Keep scripts independent of production credentials where possible.
10. Validate external input before using it.
11. Keep test expectations aligned with actual implementation.
12. Update this README whenever script behavior or usage changes.

## 4. 🔐 Security Requirements

Treat commit messages, filenames, environment variables, and other external input as untrusted.

- Do not embed credentials in scripts.
- Do not expose secrets in GitHub Actions logs.
- Avoid running untrusted downloaded scripts.
- Give workflow jobs only the permissions they require.
- Review scripts before running those that modify repository state.
- Ensure scripts fail clearly when required files or tools are missing.
- Keep temporary test data isolated and clean it up after execution.
- Do not treat commit-message validation as a substitute for code review or security scanning.

Commit-message validation does not establish contributor identity, authorize repository access, or prevent someone from bypassing local hooks. Enforcement requires appropriate Git hooks, CI checks, and repository rules.

## 5. ⚙️ GitHub Actions Integration

Scripts may be called by workflows under `.github/workflows/`.

When integrating a script:

- Reference the correct repository-relative path.
- Use a reasonable job timeout.
- Preserve useful error output.
- Avoid exposing secrets to untrusted pull-request code.
- Verify workflow permissions and trigger conditions.
- Pin third-party actions to reviewed versions or full commit SHAs where appropriate.
- Test the workflow locally or in a controlled branch before making it a required status check.
- Ensure the workflow validates the intended commit message, not merely an unrelated commit.

For a workflow that validates a commit message, define explicitly whether the policy applies to pull-request titles, individual commits, merge commits, or all of these. They are different inputs and may require different validation logic.

## 6. 🩹 Troubleshooting

### Permission denied

Run the script through Bash:

```bash
bash .github/scripts/test-validate-commit-message.sh
```

If executable permissions are required, set them deliberately:

```bash
chmod +x .github/scripts/validate-commit-message.sh
chmod +x .github/scripts/test-validate-commit-message.sh
```

### Syntax errors

Run:

```bash
bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh
```

### Tests fail

1. Identify the failing test.
2. Compare the expected behavior with the validator’s documented rules.
3. Check whether the validator is being invoked with the correct file path.
4. Run the test suite with `—verbose`.
5. Correct the implementation or test expectation, then rerun the complete suite.

Do not change tests merely to hide a genuine validator defect.

### Validator not found

Verify the exact path and filename:

```bash
ls -la .github/scripts/
```

If using `VALIDATOR_PATH`, confirm that it points to the intended validator file. GitHub Actions runners typically use Linux, where filenames are case-sensitive.

## 7. 📋 Contribution Checklist

Before committing script changes:

- [ ] The script has a clear purpose and documented usage.
- [ ] Bash syntax validation passes.
- [ ] Relevant tests pass.
- [ ] Error conditions and exit codes are handled correctly.
- [ ] Paths and external inputs are handled safely.
- [ ] No secrets or sensitive information are exposed.
- [ ] No unintended repository changes occur.
- [ ] Temporary files are cleaned up.
- [ ] Related documentation is updated.
- [ ] Any workflow integration has been reviewed.

## 8. 📚 Official References

- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/)
- [Git documentation](https://git-scm.com/docs)
- [GitHub Actions documentation](https://docs.github.com/en/actions)
- [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)

—

### Maintenance Note

This README documents the intended structure and operating conventions for MedOrbits `2.0.0`.

It does **not** confirm that every listed file exists, that the tests pass, or that GitHub Actions enforcement is configured. Verify the repository contents and run the documented checks before relying on these controls.
