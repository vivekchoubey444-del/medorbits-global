
# Running Python in MedOrbits

**Project:** MedOrbits — Education · Admissions · Careers · Recruitment  
**File:** `docs/RUNNING_PYTHON.md`  
**Primary backend:** Node.js 20+ with Express.js  
**Database:** PostgreSQL  
**Python role:** Optional scripts, automation, data processing, validation, and background tasks

—

## 1. Purpose

This document explains how to run Python scripts in the MedOrbits repository safely and consistently.

MedOrbits uses Node.js and Express.js as its primary backend. Python is an optional supporting runtime for tasks such as:

- Validating and transforming education datasets.
- Checking JSON files and data quality.
- Processing approved CSV or spreadsheet imports.
- Generating reports.
- Running offline analysis.
- Performing scheduled data-maintenance tasks.
- Supporting machine-learning workflows where explicitly required.

**Important:** Do not introduce a Python service solely because Python is available. Use it when a specific task benefits from Python and document how it integrates with the existing application.

—

## 2. Prerequisites

Install a supported Python 3 release compatible with the scripts and dependencies used by the project.

Check the installed version:

```bash
python —version
```

On systems where Python is exposed as `python3`:

```bash
python3 —version
```

Check pip:

```bash
python -m pip —version
```

Or:

```bash
python3 -m pip —version
```

If Python is not installed, install it through the official Python distribution or your operating system’s supported package manager.

Do not assume that installing Python also installs every dependency required by MedOrbits scripts.

—

## 3. Recommended Directory Structure

Keep Python utilities separate from the Node.js application.

Example:

```text
MedOrbits/
├── api/
│   ├── routes/
│   ├── controllers/
│   ├── services/
│   └── schemas/
├── assets/
│   └── data/
├── scripts/
│   └── python/
│       ├── README.md
│       ├── validate_json.py
│       └── requirements.txt
├── tests/
│   └── python/
├── docs/
│   └── RUNNING_PYTHON.md
├── package.json
└── server.js
```

This is a recommended structure, not a claim that every listed file already exists.

Create only the directories and files required by the implementation. Keep production API code in the established backend architecture unless a separately deployed Python service has been deliberately approved.

—

## 4. Create a Virtual Environment

Use a virtual environment to isolate project dependencies from system Python packages.

### Windows PowerShell

From the repository root:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python —version
```

If PowerShell blocks script activation, use the operating system’s approved execution policy or invoke the environment’s Python executable directly. Do not weaken system security settings unnecessarily.

### Windows Command Prompt

```bat
py -m venv .venv
.venv\Scripts\activate.bat
python —version
```

### macOS and Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python —version
```

### Verify the active interpreter

```bash
python -c “import sys; print(sys.executable)”
```

The displayed path should point to the intended virtual environment.

To leave the environment:

```bash
deactivate
```

Add `.venv/` to `.gitignore`. Do not commit the virtual environment to Git.

—

## 5. Install Dependencies

If the Python utility requires third-party packages, declare them in a dedicated requirements file.

Example:

`scripts/python/requirements.txt`

```text
# Add only dependencies required by the implemented scripts.
# Pin or constrain versions according to the project’s dependency policy.
```

Install dependencies inside the active virtual environment:

```bash
python -m pip install -r scripts/python/requirements.txt
```

If the requirements file is empty or does not yet exist, create it only when the project actually needs third-party packages.

### Dependency rules

- Prefer the Python standard library for simple tasks.
- Declare all direct dependencies.
- Use reproducible dependency versions for automated environments.
- Review dependency licenses and security advisories.
- Avoid installing unreviewed packages directly in production.
- Never use `sudo pip install` as a routine project setup step.
- Keep Node.js dependencies and Python dependencies managed separately.

—

## 6. Run a Python Script

Run scripts from the repository root so that relative paths behave predictably.

General command:

```bash
python scripts/python/script_name.py
```

For systems using `python3`:

```bash
python3 scripts/python/script_name.py
```

Replace `script_name.py` with the actual script path.

### Run a module

If a Python utility is structured as a package with the required `__init__.py` files:

```bash
python -m scripts.python.module_name
```

The module path must match the actual package structure.

### Run with arguments

```bash
python scripts/python/script_name.py —help
```

A script should provide help output when it uses a command-line argument parser such as `argparse`.

Do not assume that a particular command-line option exists until it has been implemented.

—

## 7. Example: Validate JSON Files

Python’s standard library can validate JSON syntax without third-party dependencies.

Create this optional utility:

`scripts/python/validate_json.py`

```python
#!/usr/bin/env python3
“””Validate the syntax of one or more JSON files.”””

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Sequence


def validate_json_file(path: Path) -> tuple[bool, str]:
    “””Return whether a JSON file is syntactically valid.”””
    try:
        with path.open(“r”, encoding=“utf-8”) as file:
            json.load(file)
    except FileNotFoundError:
        return False, “File does not exist.”
    except PermissionError:
        return False, “Permission denied.”
    except UnicodeDecodeError:
        return False, “File is not valid UTF-8.”
    except json.JSONDecodeError as exc:
        return (
            False,
            f”Invalid JSON at line {exc.lineno}, column {exc.colno}: “
            f”{exc.msg}”,
        )
    except OSError as exc:
        return False, f”Could not read file: {exc.strerror or ‘I/O error’}”

    return True, “Valid JSON syntax.”


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=“Validate JSON syntax in one or more files.”
    )
    parser.add_argument(
        “files”,
        nargs=“+”,
        type=Path,
        help=“JSON files to validate.”,
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    failed = False

    for path in args.files:
        valid, message = validate_json_file(path)
        status = “PASS” if valid else “FAIL”
        print(f”[{status}] {path}: {message}”)

        if not valid:
            failed = True

    return 1 if failed else 0


if __name__ == “__main__”:
    sys.exit(main())
```

Run it against selected files:

```bash
python scripts/python/validate_json.py \
  assets/data/courses.json \
  assets/data/colleges.json
```

The command exits with status `0` if all supplied files contain valid JSON syntax, and a nonzero status if any file fails.

**Scope:** This script validates JSON syntax only. It does not validate JSON Schema, field requirements, cross-file references, admissions accuracy, or business rules.

—

## 8. JSON Schema and Data Quality

JSON syntax validation is not a substitute for schema validation.

For structured datasets, use the project’s chosen JSON Schema validator and ensure that its version and supported schema draft are documented.

Validate:

- Required fields.
- Field types.
- String and numeric boundaries.
- Allowed enumeration values.
- Array item structure.
- Stable identifiers.
- Date formats.
- References between datasets.
- Business rules not expressible in the schema.

Potential MedOrbits datasets include:

- `courses.json`
- `colleges.json`
- `universities.json`
- `fees.json`
- `scholarships.json`
- `jobs.json`
- `documents.json`
- `admission-process.json`
- `official-document-resources.json`

Check the actual repository before using these paths in a validation command.

Do not publish generated or transformed data until the required validation checks pass.

—

## 9. Run Python Tests

Use Python’s built-in `unittest` framework for standard-library test suites.

Example command:

```bash
python -m unittest discover -s tests/python -v
```

This command assumes that `tests/python/` exists and contains discoverable tests.

Test cases should cover:

- Valid input.
- Invalid input.
- Missing files.
- Empty files.
- Malformed JSON.
- Invalid encodings.
- Boundary values.
- Permission and I/O failures where practical.
- Expected exit codes.
- Unexpected exceptions.

### Example test for the JSON validator

Create `tests/python/test_validate_json.py` if the example utility has been adopted:

```python
import tempfile
import unittest
from pathlib import Path

from scripts.python.validate_json import validate_json_file


class ValidateJsonTests(unittest.TestCase):
    def test_accepts_valid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / “valid.json”
            path.write_text(‘{“success”: true}’, encoding=“utf-8”)

            valid, message = validate_json_file(path)

            self.assertTrue(valid)
            self.assertEqual(message, “Valid JSON syntax.”)

    def test_rejects_invalid_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / “invalid.json”
            path.write_text(‘{“success”: }’, encoding=“utf-8”)

            valid, message = validate_json_file(path)

            self.assertFalse(valid)
            self.assertIn(“Invalid JSON”, message)

    def test_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / “missing.json”

            valid, message = validate_json_file(path)

            self.assertFalse(valid)
            self.assertEqual(message, “File does not exist.”)


if __name__ == “__main__”:
    unittest.main()
```

Run the test suite:

```bash
python -m unittest discover -s tests/python -v
```

The test import assumes the repository root is the current working directory and the relevant Python package structure is importable. Add the required package files or adjust the import path if the repository uses a different layout.

—

## 10. Integration with Node.js

MedOrbits uses Node.js as its primary backend. Python scripts should not be invoked from public HTTP requests without a specific, reviewed requirement.

For simple offline data validation, prefer a dedicated script executed during development or CI.

### Optional npm script

If the project has adopted `scripts/python/validate_json.py`, an optional script in `package.json` might look like:

```json
{
  “scripts”: {
    “validate:python-json”: “python scripts/python/validate_json.py assets/data/courses.json assets/data/colleges.json”
  }
}
```

This example is platform-dependent because the executable name may be `python`, `python3`, or another configured interpreter. Adapt it to the project’s supported development and CI environments.

Before adding this script:

1. Confirm the target JSON files exist.
2. Confirm the intended Python interpreter is available in CI.
3. Ensure the command’s exit code propagates to npm.
4. Avoid making optional Python tooling a mandatory production dependency unless required.

### Calling Python from Node.js

If Node.js must run a Python process, use `node:child_process` with `spawn()` or `execFile()` and an argument array. Avoid constructing shell commands from user input.

Illustrative example:

```javascript
import { spawn } from “node:child_process”;

function runPythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.env.PYTHON_EXECUTABLE || “python3”,
      [scriptPath, ...args],
      {
        shell: false,
        stdio: [“ignore”, “pipe”, “pipe”],
      }
    );

    let stdout = “”;
    let stderr = “”;

    child.stdout.setEncoding(“utf8”);
    child.stderr.setEncoding(“utf8”);

    child.stdout.on(“data”, (chunk) => {
      stdout += chunk;
    });

    child.stderr.on(“data”, (chunk) => {
      stderr += chunk;
    });

    child.once(“error”, reject);

    child.once(“close”, (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(
        `Python process failed (code=${code}, signal=${signal || “none”}).`
      );

      error.exitCode = code;
      error.stderr = stderr;
      reject(error);
    });
  });
}
```

This is an illustrative process wrapper, not a complete production job runner.

For production use, additionally implement:

- Execution timeouts.
- Output-size limits.
- Cancellation and process cleanup.
- Fixed, trusted script paths.
- Strict argument validation.
- Concurrency limits.
- Sanitized logging.
- A clear policy for retryable failures.
- Isolation for untrusted or resource-intensive workloads.

Do not allow request parameters to choose arbitrary script paths, executable names, or shell fragments. Do not return raw process output to public clients.

For long-running work, use a background worker or job queue rather than blocking an HTTP request.

—

## 11. PostgreSQL Access from Python

Use a supported PostgreSQL driver only when a Python task genuinely needs database access.

Examples of possible drivers include `psycopg` and `psycopg2`. Choose one, document its version, and configure it through the project’s dependency-management process.

### Database requirements

- Use environment-based configuration.
- Keep credentials out of source code.
- Use parameterized SQL.
- Apply least-privilege database permissions.
- Use transactions for related writes.
- Configure connection and statement timeouts.
- Close database connections correctly.
- Avoid running schema changes from ad hoc scripts.
- Use a separate test database for tests.
- Never point destructive scripts at production by default.

A Python script must respect the same data integrity and authorization rules as the Node.js application.

If the script updates shared application data, document which component owns the business logic and how concurrent updates are handled.

—

## 12. Environment Variables and Secrets

Python scripts may read configuration from environment variables.

Example:

```python
import os

database_url = os.environ.get(“DATABASE_URL”)

if not database_url:
    raise RuntimeError(“Required configuration is missing.”)
```

Do not print the database URL or other secret values.

### Security rules

- Keep `.env` files out of version control.
- Use a secret manager or hosting-platform secrets for deployed workloads.
- Never place server secrets in public JavaScript, HTML, or JSON resources.
- Avoid logging tokens, credentials, personal data, or document contents.
- Validate required configuration before running a job.
- Use separate credentials for development, testing, and production.
- Do not disable TLS certificate verification to work around connection errors.

—

## 13. Data Import and Export

Python can be useful for importing approved datasets into MedOrbits.

Before importing data:

1. Verify the source and permitted use.
2. Validate file format and encoding.
3. Check required columns and data types.
4. Normalize values according to documented rules.
5. Detect duplicate identifiers.
6. Validate references to existing records.
7. Generate a preview or dry-run report.
8. Require appropriate approval for sensitive or destructive changes.
9. Apply writes transactionally where feasible.
10. Record a sanitized audit summary.

For exports:

- Export only fields the requester is authorized to access.
- Avoid including passwords, session tokens, and internal secrets.
- Protect personal information.
- Use controlled output paths.
- Define retention and deletion procedures.
- Avoid publishing private application data in static assets.

Never treat an imported dataset as trustworthy merely because it is valid CSV, JSON, or Excel.

—

## 14. Production and Deployment

Before deploying Python utilities:

- Confirm the hosting environment supports the required Python version.
- Install dependencies reproducibly.
- Verify script paths and file permissions.
- Configure environment variables securely.
- Ensure the runtime user has only necessary permissions.
- Add timeouts and resource limits.
- Define failure handling and operational alerts.
- Verify that the Node.js service can operate if an optional Python task is unavailable.

If the deployment platform does not provide Python, do not assume the script will run just because it works locally. Either provision a supported runtime, execute the script in CI, or use a separately deployed worker.

### Production execution policy

Do not execute arbitrary Python code submitted by users.

Do not use `eval`, `exec`, or dynamically generated Python source to process user requests.

For any workload that processes untrusted files or content, evaluate sandboxing, CPU and memory limits, filesystem isolation, and network restrictions.

—

## 15. Troubleshooting

### `python` or `python3` is not recognized

- Confirm Python is installed.
- Check the executable name for the operating system.
- Verify the PATH configuration.
- Use the virtual environment’s interpreter directly if needed.

### `ModuleNotFoundError`

- Activate the correct virtual environment.
- Confirm the package is declared in the appropriate requirements file.
- Install dependencies using that environment’s Python interpreter.
- Verify the import path and package structure.

### `PermissionError`

- Check file and directory permissions.
- Confirm the process runs under the intended account.
- Avoid broad permission changes as a workaround.

### JSON validation fails

- Inspect the reported line and column.
- Confirm the file is UTF-8 encoded.
- Check commas, quotes, brackets, and escape sequences.
- Distinguish JSON syntax errors from JSON Schema or business-rule failures.

### Python subprocess fails in Node.js

- Verify the configured Python executable.
- Check the script path and working directory.
- Inspect sanitized standard error logs.
- Check process exit codes and timeouts.
- Ensure the environment contains required dependencies.
- Do not disable process restrictions or interpolate user input into shell commands.

### Works locally but fails in CI

- Verify the Python version and operating system.
- Confirm dependencies are installed in CI.
- Check case-sensitive file paths.
- Ensure scripts do not depend on local absolute paths.
- Check environment variables and test data.
- Confirm the command exits nonzero when validation fails.

—

## 16. Python Readiness Checklist

### Environment

- [ ] Python version is documented.
- [ ] A virtual environment is used for local development.
- [ ] `.venv/` is ignored by Git.
- [ ] Dependencies are declared and reviewed.
- [ ] Secrets are supplied through environment configuration.

### Code quality

- [ ] Scripts have a clear purpose and usage instructions.
- [ ] Inputs and arguments are validated.
- [ ] File operations handle expected failures.
- [ ] Exit codes indicate success or failure.
- [ ] Logs exclude secrets and unnecessary personal information.
- [ ] Scripts do not execute arbitrary user-supplied code.

### Integration

- [ ] Node.js integration uses fixed script paths and argument arrays.
- [ ] Process timeouts and output limits are implemented where required.
- [ ] Database access uses safe queries and least privilege.
- [ ] Long-running work uses a suitable background mechanism.
- [ ] Production runtime support is confirmed.

### Testing and deployment

- [ ] Unit tests cover valid and invalid input.
- [ ] Integration tests use isolated test resources.
- [ ] CI installs required dependencies.
- [ ] Validation failures cause the command or job to fail.
- [ ] Deployment and rollback procedures are documented.

—

## 17. Definition of Done

A Python utility is ready for use when:

1. Its purpose and invocation are documented.
2. Its dependencies and runtime requirements are explicit.
3. Its inputs are validated.
4. Errors produce actionable diagnostics without leaking secrets.
5. Its exit status correctly indicates failure.
6. Tests cover expected and invalid inputs.
7. Database and filesystem access follow least-privilege rules.
8. Its execution model is compatible with local development and deployment.
9. CI checks run wherever the utility is required.
10. The Node.js application remains secure and reliable if an optional task fails.

—

## 18. Maintenance

Update this document when Python utilities, dependencies, runtime versions, deployment responsibilities, or Node.js integration change.

Keep related files aligned:

- `docs/INTEGRATION.md`
- `docs/VALIDATION.md`
- `scripts/python/`
- `tests/python/`
- `api/services/`
- `package.json`
- `.github/workflows/`

**Final standard:** Python is a supporting tool in MedOrbits, not an excuse to bypass the existing backend’s validation, authorization, data-integrity, and operational controls.
