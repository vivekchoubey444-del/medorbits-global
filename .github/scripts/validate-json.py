
#!/usr/bin/env python3
“””
===============================================================================
MEDORBITS — JSON VALIDATOR
File: .github/scripts/validate-json.py
Version: 2.1.3

Purpose:
    Validate JSON files throughout the MedOrbits repository.

Features:
    - JSON syntax validation
    - Recursive directory scanning
    - Duplicate JSON key detection
    - UTF-8 encoding validation
    - Empty JSON file detection
    - Optional strict validation
    - Exclusion rules
    - CI-compatible reporting
    - Safe error messages with file and line information

Usage:
    python .github/scripts/validate-json.py
    python .github/scripts/validate-json.py —recursive
    python .github/scripts/validate-json.py —strict
    python .github/scripts/validate-json.py —directory assets/data
    python .github/scripts/validate-json.py —help

Exit codes:
    0 = All JSON files valid
    1 = JSON validation errors found
    2 = Execution or configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import json
import sys

from pathlib import Path
from typing import Any


# =============================================================================
# CONFIGURATION
# =============================================================================

VERSION = “2.1.3”

ROOT = Path(__file__).resolve().parents[2]

DEFAULT_DIRECTORY = ROOT

MAX_FILE_SIZE = 10 * 1024 * 1024

EXCLUDED_DIRECTORIES = {
    “.git”,
    “node_modules”,
    “.venv”,
    “venv”,
    “__pycache__”,
    “.next”,
    “.nuxt”,
    “dist”,
    “build”,
    “coverage”,
    “.cache”,
    “.turbo”,
}

EXCLUDED_FILES = {
    “package-lock.json”,
    “pnpm-lock.yaml”,
    “yarn.lock”,
}


# =============================================================================
# DATA MODEL
# =============================================================================

class ValidationIssue:
    “””Represent a JSON validation issue.”””

    def __init__(
        self,
        file: str,
        message: str,
        line: int | None = None,
        column: int | None = None,
    ) -> None:

        self.file = file
        self.message = message
        self.line = line
        self.column = column


class ValidationReport:
    “””Collect JSON validation results.”””

    def __init__(self) -> None:
        self.checked = 0
        self.valid = 0
        self.failed = 0
        self.issues: list[ValidationIssue] = []

    def add_issue(
        self,
        issue: ValidationIssue,
    ) -> None:

        self.failed += 1
        self.issues.append(issue)


# =============================================================================
# JSON OBJECT VALIDATION
# =============================================================================

def reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    “””
    Reject duplicate object keys.

    Standard Python JSON parsing silently accepts duplicate keys.
    This hook makes duplicate-key detection explicit.
    “””

    result = {}

    for key, value in pairs:

        if key in result:
            raise ValueError(
                f”Duplicate JSON object key: {key!r}”
            )

        result[key] = value

    return result


def reject_non_standard_constants(value: str) -> None:
    “””Reject NaN and Infinity, which are not standard JSON values.”””

    raise ValueError(
        f”Non-standard JSON constant is not allowed: {value}”
    )


# =============================================================================
# DIRECTORY DISCOVERY
# =============================================================================

def is_excluded(path: Path) -> bool:
    “””Determine whether a path should be excluded.”””

    if any(
        part in EXCLUDED_DIRECTORIES
        for part in path.parts
    ):
        return True

    if path.name in EXCLUDED_FILES:
        return True

    return False


def discover_json_files(
    directory: Path,
    recursive: bool,
) -> list[Path]:
    “””Discover eligible JSON files.”””

    if not directory.exists():
        raise FileNotFoundError(
            f”Directory does not exist: {directory}”
        )

    if not directory.is_dir():
        raise NotADirectoryError(
            f”Path is not a directory: {directory}”
        )

    iterator = (
        directory.rglob(“*.json”)
        if recursive
        else directory.glob(“*.json”)
    )

    files = []

    for path in iterator:

        if not path.is_file():
            continue

        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            raise ValueError(
                f”JSON file is outside repository root: {path}”
            )

        if is_excluded(relative):
            continue

        files.append(path)

    return sorted(files)


# =============================================================================
# SINGLE FILE VALIDATION
# =============================================================================

def validate_json_file(
    path: Path,
    strict: bool = False,
) -> list[ValidationIssue]:
    “””Validate one JSON file.”””

    issues = []

    try:

        file_size = path.stat().st_size

        if file_size > MAX_FILE_SIZE:

            return [
                ValidationIssue(
                    file=str(path.relative_to(ROOT)),
                    message=(
                        f”File exceeds maximum size of “
                        f”{MAX_FILE_SIZE} bytes.”
                    ),
                )
            ]

        if file_size == 0:

            return [
                ValidationIssue(
                    file=str(path.relative_to(ROOT)),
                    message=“JSON file is empty.”,
                )
            ]

        content = path.read_text(
            encoding=“utf-8”
        )

        if not content.strip():

            return [
                ValidationIssue(
                    file=str(path.relative_to(ROOT)),
                    message=“JSON file contains only whitespace.”,
                )
            ]

        json.loads(
            content,
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=reject_non_standard_constants,
        )

        if strict:

            # Strict mode requires a top-level JSON object or array.
            parsed = json.loads(
                content,
                object_pairs_hook=reject_duplicate_keys,
                parse_constant=reject_non_standard_constants,
            )

            if not isinstance(parsed, (dict, list)):

                issues.append(
                    ValidationIssue(
                        file=str(path.relative_to(ROOT)),
                        message=(
                            “Strict mode requires a top-level “
                            “JSON object or array.”
                        ),
                    )
                )

    except json.JSONDecodeError as exc:

        issues.append(
            ValidationIssue(
                file=str(path.relative_to(ROOT)),
                message=exc.msg,
                line=exc.lineno,
                column=exc.colno,
            )
        )

    except UnicodeDecodeError:

        issues.append(
            ValidationIssue(
                file=str(path.relative_to(ROOT)),
                message=“File is not valid UTF-8.”,
            )
        )

    except ValueError as exc:

        issues.append(
            ValidationIssue(
                file=str(path.relative_to(ROOT)),
                message=str(exc),
            )
        )

    except OSError as exc:

        issues.append(
            ValidationIssue(
                file=str(path.relative_to(ROOT)),
                message=f”Unable to read file: {exc}”,
            )
        )

    return issues


# =============================================================================
# REPOSITORY VALIDATION
# =============================================================================

def validate_directory(
    directory: Path,
    recursive: bool,
    strict: bool,
) -> ValidationReport:
    “””Validate all eligible JSON files in a directory.”””

    report = ValidationReport()

    files = discover_json_files(
        directory=directory,
        recursive=recursive,
    )

    print(
        f”[INFO] Found {len(files)} JSON file(s).”
    )

    for path in files:

        report.checked += 1

        issues = validate_json_file(
            path=path,
            strict=strict,
        )

        if issues:

            report.add_issue(
                issues[0]
            )

            # Preserve any additional issues.
            for issue in issues[1:]:
                report.add_issue(issue)

            print(
                f”[FAIL] {path.relative_to(ROOT)}”
            )

        else:

            report.valid += 1

            print(
                f”[PASS] {path.relative_to(ROOT)}”
            )

    return report


# =============================================================================
# REPORTING
# =============================================================================

def print_report(
    report: ValidationReport,
) -> None:
    “””Print validation summary.”””

    print()
    print(“=“ * 72)
    print(“MEDORBITS JSON VALIDATION REPORT”)
    print(“=“ * 72)

    for issue in report.issues:

        location = issue.file

        if issue.line is not None:
            location += f”:{issue.line}”

        if issue.column is not None:
            location += f”:{issue.column}”

        print(
            f”[ERROR] {location}”
        )

        print(
            f”        {issue.message}”
        )

    print()
    print(f”Files checked : {report.checked}”)
    print(f”Files valid   : {report.valid}”)
    print(f”Files failed  : {report.failed}”)

    print(“=“ * 72)

    if report.failed:
        print(“[FAILED] JSON validation completed with errors.”)
    else:
        print(“[SUCCESS] All discovered JSON files are valid.”)


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def parse_args() -> argparse.Namespace:

    parser = argparse.ArgumentParser(
        description=“MedOrbits recursive JSON validator.”
    )

    parser.add_argument(
        “—directory”,
        type=Path,
        default=DEFAULT_DIRECTORY,
        help=“Directory containing JSON files.”,
    )

    parser.add_argument(
        “—recursive”,
        action=“store_true”,
        help=“Scan subdirectories recursively.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Require a top-level JSON object or array.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits JSON Validator {VERSION}”,
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:

    args = parse_args()

    directory = args.directory

    if not directory.is_absolute():
        directory = ROOT / directory

    directory = directory.resolve()

    try:
        directory.relative_to(ROOT.resolve())
    except ValueError:
        print(
            “[ERROR] Scan directory must be inside the repository.”,
            file=sys.stderr,
        )
        return 2

    print(
        f”[INFO] MedOrbits JSON Validator {VERSION}”
    )

    print(
        f”[INFO] Directory: {directory}”
    )

    print(
        f”[INFO] Recursive: {args.recursive}”
    )

    print(
        f”[INFO] Strict: {args.strict}”
    )

    try:

        report = validate_directory(
            directory=directory,
            recursive=args.recursive,
            strict=args.strict,
        )

        print_report(report)

        return 1 if report.failed else 0

    except (OSError, ValueError) as exc:

        print(
            f”[ERROR] {exc}”,
            file=sys.stderr,
        )

        return 2

    except KeyboardInterrupt:

        print(
            “\n[ERROR] Validation interrupted.”,
            file=sys.stderr,
        )

        return 2


if __name__ == “__main__”:
    raise SystemExit(main())

# =============================================================================
# END OF MEDORBITS JSON VALIDATOR
# =============================================================================
