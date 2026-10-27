
# Husky Git Hooks

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/). These hooks run local quality checks at selected Git lifecycle events to help maintain code quality, repository consistency, and security.

## Purpose

Husky automates repository checks before selected Git operations. Depending on the configured hooks, it can run:

- Code linting and formatting checks.
- Unit tests and targeted validation.
- Commit-message validation.
- Secret and sensitive-file checks.
- Dependency and configuration validation.

Hooks should remain fast, predictable, and safe. Expensive checks belong in CI when they are not suitable for local execution.

## Directory Structure

```text
.husky/
├── README.md
├── pre-commit
├── commit-msg
└── pre-push
```

Only create hook files that are actually configured and required by the project.

| Hook | Purpose |
|—|—|
| `pre-commit` | Checks staged changes before creating a commit. |
| `commit-msg` | Validates the proposed commit message. |
| `pre-push` | Runs selected checks before pushing commits. |

## Requirements

- Git installed and repository initialized.
- Node.js version compatible with the project.
- npm installed.
- Husky installed as a project development dependency.
- Dependencies installed using the repository’s lockfile.

Install project dependencies with:

```bash
npm ci
```

If Husky is not already installed, add it as a development dependency:

```bash
npm install —save-dev husky
```

## Configure Husky

For a project using a compatible Husky version, configure the installation script in the root `package.json`:

```json
{
  “scripts”: {
    “prepare”: “husky”
  }
}
```

Preserve all existing scripts and merge the `prepare` entry rather than replacing the entire `scripts` object.

Initialize Husky with:

```bash
npx husky init
```

Review any files created or modified by this command before committing them.

> **Version compatibility:** Husky configuration differs between major versions. Check the installed version and follow its corresponding documentation before copying hook examples from older projects.

## Hook Guidelines

### `pre-commit`

Use this hook for quick checks on staged changes, such as linting, formatting verification, and staged-file validation.

Recommended practices:

- Prefer staged-file-aware tools when available.
- Avoid modifying unrelated files.
- Do not print secret values or sensitive environment variables.
- Return a nonzero exit code when a required check fails.

### `commit-msg`

Use this hook to validate commit-message conventions if the project defines them.

For example, a project may adopt Conventional Commits:

```text
feat: add career guidance page
fix: handle missing dependency metadata
docs: update API documentation
test: add controller validation tests
```

Configure the validator separately; Husky does not enforce a commit-message format automatically.

### `pre-push`

Use this hook for selected tests or checks that are appropriate before pushing. Keep the execution time reasonable and leave comprehensive security scans and full integration tests to CI where appropriate.

## Example Hook

A basic `pre-commit` hook for a project with a configured npm lint script:

```sh
#!/usr/bin/env sh

set -eu

if node -e ‘
  const pkg = require(“./package.json”);
  process.exit(pkg.scripts && pkg.scripts.lint ? 0 : 1);
‘; then
  npm run lint
else
  echo “No lint script configured; skipping local lint.”
fi
```

This example only checks for the existence of a lint script. Replace it with the checks that match the actual MedOrbits project configuration.

Ensure hook files have executable permissions where required:

```bash
chmod +x .husky/pre-commit
```

## Troubleshooting

### Hooks do not run

1. Confirm Husky is installed.
2. Run `npm ci` to install dependencies.
3. Verify the `prepare` script and Husky configuration for the installed major version.
4. Inspect the repository’s Git hook configuration:

   ```bash
   git config —get core.hooksPath
   ```

5. Confirm the expected hook file exists and is executable where required.

### A hook fails

Run the underlying lint, test, or validation command directly to inspect the error. Fix the underlying issue rather than bypassing a required quality check.

### Working in CI

CI should run the authoritative test and security checks independently. Local Git hooks improve feedback but can be bypassed by users or skipped in certain environments.

## Security and Maintenance

- Never place tokens, passwords, API keys, or private credentials in hook files.
- Do not execute downloaded scripts without reviewing their source.
- Do not use hooks to silently rewrite unrelated repository files.
- Keep hooks under version control and review changes to them.
- Avoid destructive Git commands in automated hooks.
- Treat local checks as an additional safeguard, not a replacement for branch protection and CI.

## Further Reading

- [Husky documentation](https://typicode.github.io/husky/)
- [Git hooks documentation](https://git-scm.com/docs/githooks)
- [npm documentation](https://docs.npmjs.com/)

—

**Maintenance note:** Keep this document synchronized with the actual hook files, installed Husky version, and scripts defined in the root `package.json`.
