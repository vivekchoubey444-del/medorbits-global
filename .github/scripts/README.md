
# MedOrbits — GitHub Automation Scripts

**Version:** 2.1.3  
**Directory:** `.github/scripts/`  
**Maintainer:** MedOrbits Engineering  
**Runtime:** Python 3.10+ and Node.js 20+

—

## 1. Overview

This directory contains repository maintenance, validation, security and reporting scripts used by the MedOrbits GitHub automation system.

The scripts support:

- Repository structure validation.
- Environment configuration validation.
- Secret detection.
- Broken-link detection.
- JSON syntax validation.
- Dependency reporting.
- CI summary generation.
- Automated commit-message validation.

These utilities are designed to work locally and within GitHub Actions.

## 2. Directory Structure

```text
.github/
├── scripts/
│   ├── README.md
│   ├── check-env-example.py
│   ├── check-links.py
│   ├── check-secrets.py
│   ├── ci-summary.js
│   ├── dependency-report.js
│   ├── test-validate-commit-message.sh
│   ├── validate-commit-message.sh
│   ├── validate-json.py
│   └── validate-repository.py
│
└── workflows/
    ├── ci.yml
    ├── codeql.yml
    └── ...
```

## 3. Requirements

### Python

Recommended Python version:

```text
Python >= 3.10
```

Check installation:

```bash
python —version
```

### Node.js

Recommended Node.js version:

```text
Node.js >= 20
```

Check installation:

```bash
node —version
npm —version
```

### Git

Git must be installed for scripts that inspect tracked repository files.

```bash
git —version
```

## 4. Script Reference

| Script | Purpose | Runtime |
|—|—|—|
| `check-secrets.py` | Detect potential exposed credentials | Python |
| `check-env-example.py` | Validate environment example files | Python |
| `check-links.py` | Detect broken local links | Python |
| `validate-json.py` | Validate repository JSON files | Python |
| `validate-repository.py` | Validate repository structure | Python |
| `dependency-report.js` | Generate dependency reports | Node.js |
| `ci-summary.js` | Generate CI summaries | Node.js |
| `validate-commit-message.sh` | Validate commit headers | Bash |
| `test-validate-commit-message.sh` | Test commit-message validation | Bash |

## 5. Secret Scanner

File:

```text
.github/scripts/check-secrets.py
```

Run:

```bash
python .github/scripts/check-secrets.py
```

Scan tracked and untracked eligible files:

```bash
python .github/scripts/check-secrets.py —all-files
```

Enable strict mode:

```bash
python .github/scripts/check-secrets.py —strict
```

The scanner reports file locations and secret categories without printing matched credential values.

**Security note:** Pattern matching cannot guarantee detection of every credential. Use GitHub Secret Scanning and push protection as additional security controls.

## 6. Environment Example Validation

File:

```text
.github/scripts/check-env-example.py
```

Default validation:

```bash
python .github/scripts/check-env-example.py
```

Strict validation:

```bash
python .github/scripts/check-env-example.py —strict
```

Validate a specific example file:

```bash
python .github/scripts/check-env-example.py —file .env.example
```

Environment examples should contain placeholders rather than actual credentials.

Never commit production `.env` files.

## 7. Link Validation

File:

```text
.github/scripts/check-links.py
```

Validate tracked Markdown and HTML files:

```bash
python .github/scripts/check-links.py
```

Include untracked files:

```bash
python .github/scripts/check-links.py —all-files
```

The validator checks common Markdown and HTML local references.

External URL reachability is not guaranteed.

## 8. JSON Validation

File:

```text
.github/scripts/validate-json.py
```

Validate JSON files in the repository root:

```bash
python .github/scripts/validate-json.py
```

Recursive validation:

```bash
python .github/scripts/validate-json.py —recursive
```

Strict validation:

```bash
python .github/scripts/validate-json.py —recursive —strict
```

Validate a specific data directory:

```bash
python .github/scripts/validate-json.py \
  —directory assets/data \
  —recursive
```

This script checks JSON syntax, duplicate keys and non-standard constants.

Application-specific JSON schema validation must be configured separately.

## 9. Repository Validation

File:

```text
.github/scripts/validate-repository.py
```

Standard validation:

```bash
python .github/scripts/validate-repository.py
```

GitHub configuration validation:

```bash
python .github/scripts/validate-repository.py \
  —profile github
```

Strict validation:

```bash
python .github/scripts/validate-repository.py \
  —strict
```

The validator checks required files, directories, Git metadata and package configuration.

Adjust its required paths to match the actual repository architecture.

## 10. Dependency Report

File:

```text
.github/scripts/dependency-report.js
```

Generate a console report:

```bash
node .github/scripts/dependency-report.js
```

Generate JSON:

```bash
node .github/scripts/dependency-report.js —json
```

Generate Markdown:

```bash
node .github/scripts/dependency-report.js —markdown
```

Save JSON:

```bash
node .github/scripts/dependency-report.js \
  —json \
  —output reports/dependencies.json
```

Save Markdown:

```bash
node .github/scripts/dependency-report.js \
  —markdown \
  —output reports/dependencies.md
```

The report summarizes declared dependencies and checks selected package and lockfile metadata.

It does not replace vulnerability scanning.

## 11. CI Summary

File:

```text
.github/scripts/ci-summary.js
```

Generate a local summary:

```bash
node .github/scripts/ci-summary.js \
  —no-github-summary
```

Generate JSON:

```bash
node .github/scripts/ci-summary.js \
  —json \
  —no-github-summary
```

Simulate successful CI jobs:

```bash
REPOSITORY_RESULT=success \
NODE_RESULT=success \
PYTHON_RESULT=success \
SECURITY_RESULT=success \
node .github/scripts/ci-summary.js \
  —no-github-summary
```

Inside GitHub Actions, the script can write to the file specified by:

```text
GITHUB_STEP_SUMMARY
```

## 12. Commit Message Validation

File:

```text
.github/scripts/validate-commit-message.sh
```

Validate a commit-message file:

```bash
bash .github/scripts/validate-commit-message.sh \
  .git/COMMIT_EDITMSG
```

Display help:

```bash
bash .github/scripts/validate-commit-message.sh —help
```

### Supported commit types

| Type | Purpose |
|—|—|
| `feat` | New functionality |
| `fix` | Bug fixes |
| `docs` | Documentation |
| `style` | Formatting and styling |
| `refactor` | Code restructuring |
| `perf` | Performance improvements |
| `test` | Testing |
| `build` | Build configuration |
| `ci` | CI/CD changes |
| `chore` | Maintenance |
| `revert` | Reverting changes |
| `security` | Security improvements |

### Valid examples

```text
feat(auth): add login validation
fix(api): handle missing response
docs: update installation guide
security(auth): strengthen token validation
```

### Invalid examples

```text
Add login page
feat:add login page
Feat: add login page
feat: .add login page
```

## 13. Commit Message Tests

File:

```text
.github/scripts/test-validate-commit-message.sh
```

Run:

```bash
bash .github/scripts/test-validate-commit-message.sh
```

The test suite validates accepted and rejected commit-message formats.

## 14. Complete Local Validation

Run these commands from the repository root:

```bash
# Python compilation
python -m compileall -q .github/scripts

# Python validators
python .github/scripts/check-secrets.py
python .github/scripts/check-env-example.py
python .github/scripts/check-links.py
python .github/scripts/validate-json.py —recursive
python .github/scripts/validate-repository.py

# JavaScript syntax
node —check .github/scripts/dependency-report.js
node —check .github/scripts/ci-summary.js

# Shell syntax
bash -n .github/scripts/validate-commit-message.sh
bash -n .github/scripts/test-validate-commit-message.sh

# Commit-message tests
bash .github/scripts/test-validate-commit-message.sh
```

Some checks require Git metadata, repository files or configured environment examples.

Run them from a complete Git checkout.

## 15. Exit Code Reference

| Exit code | Meaning |
|—|—|
| `0` | Validation successful |
| `1` | Validation failure or detected issue |
| `2` | Execution, configuration or usage error |

## 16. Security Guidelines

1. Never commit production environment files.
2. Never hardcode API keys or passwords.
3. Use GitHub Actions secrets for CI credentials.
4. Keep dependency lockfiles committed.
5. Review dependency updates before merging.
6. Enable GitHub Secret Scanning.
7. Enable push protection.
8. Review CodeQL findings.
9. Protect production deployment branches.
10. Avoid printing credentials in CI logs.

## 17. Maintenance Policy

When modifying a script:

- Preserve its documented command-line interface unless intentionally versioned.
- Validate Python and JavaScript syntax.
- Test expected success and failure conditions.
- Update this README when commands change.
- Keep CI execution deterministic.
- Avoid destructive repository operations.
- Do not introduce hardcoded credentials.

## 18. Version History

| Version | Description |
|—|—|
| 2.1.3 | Repository validation and automation improvements |
| 2.1.2 | Security and dependency reporting improvements |
| 2.1.1 | CI validation improvements |
| 2.1.0 | Expanded GitHub automation tooling |

—

**MedOrbits Engineering**

Repository automation and validation infrastructure.

Copyright © 2026 MedOrbits. All rights reserved.
