
# MedOrbits Python Tools

**Directory:** `python/tools/`  
**Project:** MedOrbits — Education, Admissions, Careers & Recruitment  
**Runtime:** Python 3.11+ recommended  
**Purpose:** Reusable Python utilities for data processing, validation, automation, reporting, and backend support.

—

## 1. Overview

The `python/tools/` directory contains reusable Python utilities that support MedOrbits operational and data-processing workflows.

Potential use cases include:

- CSV, JSON, and spreadsheet processing.
- Education and course-catalog data validation.
- College and university data normalization.
- Application-data quality checks.
- Report and document generation.
- Data-import preparation.
- API integration utilities.
- Scheduled maintenance and administrative tasks.
- Test and deployment support.

Python tools should be modular, testable, safe to execute, and independent of the website’s presentation layer.

**Important:** These tools are separate from the Next.js API runtime unless an explicit integration is implemented. A Python script does not automatically become an HTTP endpoint simply because it exists in the repository.

## 2. Recommended Directory Structure

```text
python/
├── README.md
│
└── tools/
    ├── README.md
    ├── __init__.py
    ├── common.py
    ├── validate_json.py
    ├── validate_catalog.py
    ├── normalize_data.py
    ├── import_data.py
    ├── export_report.py
    └── tests/
        ├── __init__.py
        ├── test_common.py
        ├── test_validate_json.py
        └── test_normalize_data.py
```

This is a recommended structure. Create only the modules needed by actual workflows and document each tool’s inputs, outputs, and side effects.

### Module responsibilities

| Module | Intended responsibility |
|—|—|
| `common.py` | Shared logging, file handling, and validation helpers |
| `validate_json.py` | Validate JSON syntax and structure |
| `validate_catalog.py` | Check course or institution catalog records |
| `normalize_data.py` | Normalize approved input data |
| `import_data.py` | Prepare and validate data imports |
| `export_report.py` | Generate reports from authorized datasets |
| `tests/` | Automated unit and regression tests |

## 3. Runtime and Dependencies

Use a supported Python version and pin dependencies where reproducible execution is required.

Check the installed runtime:

```bash
python —version
```

Or:

```bash
python3 —version
```

For local development, create a virtual environment from the repository root:

```bash
python3 -m venv .venv
```

Activate it on Linux or macOS:

```bash
source .venv/bin/activate
```

Activate it in Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies from the project’s declared dependency file, if present:

```bash
python -m pip install -r requirements.txt
```

Do not create or install a dependency merely because a hypothetical tool might need it. Prefer the Python standard library for simple tasks.

## 4. Coding Standards

Python tools should follow these standards:

1. Use clear module and function names.
2. Add type hints to public functions where practical.
3. Document inputs, outputs, and side effects.
4. Use `pathlib.Path` for filesystem paths.
5. Use explicit encodings, normally UTF-8, for text files.
6. Validate external input before processing.
7. Avoid hard-coded credentials and production paths.
8. Use structured logging instead of scattered debugging prints.
9. Handle expected exceptions without hiding unexpected failures.
10. Return meaningful exit codes for command-line execution.
11. Keep business rules separate from command-line argument parsing.
12. Add unit tests for reusable functions and data transformations.

### Example function style

```python
from pathlib import Path
from typing import Any
import json


def load_json_file(file_path: Path) -> Any:
    “””Load and parse a UTF-8 JSON file.

    Args:
        file_path: Path to the JSON file.

    Returns:
        The parsed JSON value.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the file contains invalid JSON.
        OSError: If the file cannot be read.
    “””
    try:
        with file_path.open(“r”, encoding=“utf-8”) as file:
            return json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f”Invalid JSON in {file_path.name}: “
            f”line {exc.lineno}, column {exc.colno}”
        ) from exc
```

Avoid including sensitive file contents or confidential user data in exception messages.

## 5. File and Data Handling

MedOrbits may process JSON catalogs, college data, application records, job listings, and other structured information.

### Input validation

- Verify file existence and expected format.
- Enforce file-size limits for untrusted inputs.
- Validate required fields and data types.
- Reject malformed or unexpected structures.
- Check identifiers for duplicates.
- Validate URLs before using them.
- Normalize whitespace and formatting consistently.
- Preserve source records when normalization could lose information.

### Safe writes

For important generated files, prefer writing to a temporary file and replacing the destination only after successful validation.

Do not overwrite production datasets automatically unless the operation has an explicit, documented approval process.

### Data integrity

Before importing data into a database:

1. Validate the complete input.
2. Detect duplicate or conflicting identifiers.
3. Check required references.
4. Produce a summary of proposed changes.
5. Use database transactions for related writes.
6. Record import outcomes without exposing unnecessary personal information.
7. Support rollback or recovery where practical.

## 6. Security and Privacy

Python tools must follow the same security standards as the rest of MedOrbits.

### Secrets

- Read credentials from secure environment variables or a secret manager.
- Never commit passwords, API keys, access tokens, or private connection strings.
- Never print secrets in logs.
- Do not include production secrets in test fixtures.

### Filesystem safety

- Resolve paths against an explicitly configured root where necessary.
- Do not trust user-supplied paths.
- Prevent path traversal when processing uploaded or externally supplied filenames.
- Avoid following untrusted symbolic links.
- Do not execute files supplied by users.
- Do not use `eval()` or `exec()` to process data.

### Personal information

Application records, phone numbers, email addresses, and identity documents require restricted access.

Use synthetic data for tests. Minimize data collection, control access, and apply appropriate retention rules.

### External requests

For network requests:

- Set connection and read timeouts.
- Validate response status codes.
- Limit response sizes where possible.
- Verify TLS certificates.
- Handle retries conservatively.
- Avoid logging authorization headers.
- Validate returned data before processing.

## 7. Command-Line Interface Standards

Tools that are intended to be run manually or in automation should provide clear command-line arguments.

Example:

```bash
python -m python.tools.validate_json \
  —input data/courses.json
```

The command above is an example of a desired interface. It will work only after the corresponding module and arguments have been implemented.

Recommended conventions:

- `—help` displays usage information.
- Invalid arguments produce a clear error.
- Successful execution returns exit code `0`.
- Invalid input returns a nonzero exit code.
- Operational failures are reported to standard error.
- Generated output paths are explicit.
- Destructive operations require deliberate safeguards.

## 8. Logging and Exit Codes

Use Python’s `logging` module for operational messages.

Recommended exit-code conventions:

| Exit code | Meaning |
|—|—|
| `0` | Success |
| `1` | General processing failure |
| `2` | Invalid command-line arguments |
| `3` | Input validation failure |
| `4` | External dependency or service failure |

These are conventions for MedOrbits tools, not mandatory Python runtime behavior.

Logs should include enough information to diagnose a failure without exposing personal information, credentials, or full confidential records.

## 9. Testing

Use the standard library’s `unittest` framework unless the project already standardizes on another test framework.

Run tests from the repository root:

```bash
python -m unittest discover -s python/tools/tests -v
```

For a module using `pytest`, if it is installed and configured:

```bash
python -m pytest python/tools/tests -v
```

### Recommended test cases

- Valid input.
- Empty files.
- Malformed JSON.
- Missing required fields.
- Unexpected data types.
- Duplicate identifiers.
- Invalid encoding.
- Missing input files.
- Read-only destinations.
- Invalid output paths.
- Large input files.
- Permission failures.
- Interrupted writes.
- Duplicate import requests.
- Unexpected external API responses.

Use temporary directories and synthetic records to prevent tests from changing real project data.

## 10. Integration with MedOrbits

Python tools may support the main application through:

- Pre-deployment data validation.
- Catalog generation and maintenance.
- Administrative reporting.
- Batch data imports.
- Offline data-quality checks.
- Scheduled processing.

If a Python tool must be invoked by a Node.js service, define an explicit process or service boundary. Validate arguments, constrain filesystem access, set execution timeouts, and handle process failures.

Do not execute arbitrary shell commands assembled from user input.

For frequent or latency-sensitive operations, consider whether the functionality belongs in the existing Node.js backend or a dedicated Python service.

## 11. Configuration

Keep non-secret defaults in code only when they are genuinely safe and stable.

Use environment variables or explicit command-line arguments for deployment-specific settings such as:

```dotenv
PYTHON_ENV=development
PYTHON_LOG_LEVEL=INFO
PYTHON_DATA_DIRECTORY=data
PYTHON_OUTPUT_DIRECTORY=reports
```

These names are optional conventions. Implementations must explicitly read and validate them before they have any effect.

Do not assume that variables configured for Next.js or serverless functions are automatically available in every Python execution environment.

## 12. Troubleshooting

### `ModuleNotFoundError`

Confirm the virtual environment is activated and dependencies are installed. Run commands from the repository root so Python can resolve the intended package structure.

### Invalid JSON

Check the reported line and column, encoding, commas, quotation marks, and required structure.

### Permission denied

Verify filesystem permissions and ownership. Do not solve permission problems by granting broad write permissions to the project.

### Import failures

Check package names, `__init__.py` files where needed, and the current working directory. Prefer consistent module execution from the repository root.

### Production and local results differ

Compare Python versions, dependency versions, environment variables, input data, and filesystem permissions.

## 13. Development Checklist

Before merging a Python tool:

- [ ] Its purpose and inputs are documented.
- [ ] Input validation is implemented.
- [ ] File operations use safe paths.
- [ ] Secrets are not hard-coded or logged.
- [ ] Expected errors are handled.
- [ ] Exit codes are meaningful.
- [ ] Unit tests cover success and failure cases.
- [ ] Tests use synthetic data or temporary directories.
- [ ] Dependencies are declared.
- [ ] Generated files are not accidentally committed.
- [ ] The tool has been tested in the target environment.
- [ ] Any database writes or external requests are documented.

—

## 14. Reference Documentation

- Python documentation: https://docs.python.org/3/
- `pathlib`: https://docs.python.org/3/library/pathlib.html
- `json`: https://docs.python.org/3/library/json.html
- `logging`: https://docs.python.org/3/library/logging.html
- `unittest`: https://docs.python.org/3/library/unittest.html
- Python virtual environments: https://docs.python.org/3/library/venv.html

—

**Maintainer:** MedOrbits Engineering  
**Directory:** `python/tools/`  
**Status:** Architecture and implementation guidance

Update this document whenever tool interfaces, dependencies, data formats, or security requirements change.
