#!/usr/bin/env python3
“””
MedOrbits — JSON Validation Utility
File: .github/scripts/validate-json.py

Purpose:
    Validate JSON files across the repository.

Checks:
    - Malformed JSON.
    - Duplicate object keys.
    - Invalid UTF-8 encoding.
    - Empty files.
    - UTF-8 BOM.
    - Invalid top-level values in strict mode.
    - File access and discovery errors.
    - Optional machine-readable JSON reports.

Usage:
    python .github/scripts/validate-json.py
    python .github/scripts/validate-json.py —recursive
    python .github/scripts/validate-json.py data/colleges.json
    python .github/scripts/validate-json.py data/ —recursive
    python .github/scripts/validate-json.py —strict
    python .github/scripts/validate-json.py —exclude node_modules
    python .github/scripts/validate-json.py —json-report reports/json-validation.json

Safety:
    - Source JSON files are never modified.
    - Uses only the Python standard library.
    - Does not follow symbolic links.
    - Avoids excluded directories during recursive discovery.
    - Exits non-zero when validation fails.
“””

from __future__ import annotations

import argparse
import json
import os
import sys

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]

DEFAULT_EXCLUDES = {
    “.git”,
    “.hg”,
    “.svn”,
    “.venv”,
    “venv”,
    “node_modules”,
    “__pycache__”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.next”,
    “.nuxt”,
    “dist”,
    “build”,
    “coverage”,
    “vendor”,
}

JSON_EXTENSIONS = {“.json”}

SPECIAL_JSON_FILENAMES = {
    “manifest.webmanifest”,
}

MAX_REPORT_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class ValidationIssue:
    “””One JSON validation finding.”””

    path: str
    message: str
    line: int | None = None
    column: int | None = None

    def __str__(self) -> str:
        location = self.path

        if self.line is not None:
            location += f”:{self.line}”

            if self.column is not None:
                location += f”:{self.column}”

        return f”{location}: {self.message}”


class DuplicateKeyError(ValueError):
    “””Raised when a JSON object contains duplicate keys.”””


class NonStandardConstantError(ValueError):
    “””Raised for non-standard JSON constants such as NaN or Infinity.”””


def relative_path(path: Path) -> str:
    “””Return a readable repository-relative path where possible.”””

    try:
        return path.resolve(strict=False).relative_to(ROOT).as_posix()
    except (OSError, ValueError):
        return str(path)


def reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    “””Build a JSON object while rejecting duplicate keys.”””

    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(
                f”duplicate object key {key!r}”
            )

        result[key] = value

    return result


def reject_nonstandard_constant(value: str) -> None:
    “””Reject NaN, Infinity and -Infinity.”””

    raise NonStandardConstantError(
        f”non-standard JSON constant {value!r}”
    )


def validate_json_file(
    path: Path,
    *,
    allow_duplicates: bool = False,
    require_object_or_array: bool = False,
    strict: bool = False,
) -> list[ValidationIssue]:
    “””Validate one JSON file without modifying it.”””

    display_path = relative_path(path)
    issues: list[ValidationIssue] = []

    try:
        if path.is_symlink():
            return [
                ValidationIssue(
                    display_path,
                    “symbolic links are not followed”,
                )
            ]

        if not path.is_file():
            return [
                ValidationIssue(
                    display_path,
                    “path is not a regular file”,
                )
            ]

        raw = path.read_bytes()

        if not raw:
            return [
                ValidationIssue(
                    display_path,
                    “file is empty”,
                )
            ]

        has_bom = raw.startswith(b”\xef\xbb\xbf”)

        if has_bom:
            issue = ValidationIssue(
                display_path,
                “UTF-8 BOM detected”,
            )

            if strict:
                issues.append(issue)
            else:
                print(f”WARNING: {issue}”, file=sys.stderr)

            raw = raw[3:]

        try:
            content = raw.decode(“utf-8”)

        except UnicodeDecodeError as exc:
            issues.append(
                ValidationIssue(
                    display_path,
                    f”file is not valid UTF-8: byte offset {exc.start}”,
                )
            )
            return issues

        kwargs: dict[str, Any] = {
            “parse_constant”: reject_nonstandard_constant,
        }

        if not allow_duplicates:
            kwargs[“object_pairs_hook”] = reject_duplicate_keys

        try:
            parsed = json.loads(content, **kwargs)

        except json.JSONDecodeError as exc:
            issues.append(
                ValidationIssue(
                    display_path,
                    f”invalid JSON: {exc.msg}”,
                    line=exc.lineno,
                    column=exc.colno,
                )
            )
            return issues

        except DuplicateKeyError as exc:
            issues.append(
                ValidationIssue(
                    display_path,
                    str(exc),
                )
            )
            return issues

        except NonStandardConstantError as exc:
            issues.append(
                ValidationIssue(
                    display_path,
                    str(exc),
                )
            )
            return issues

        if require_object_or_array and not isinstance(
            parsed,
            (dict, list),
        ):
            issues.append(
                ValidationIssue(
                    display_path,
                    “top-level JSON value must be an object or array”,
                )
            )

    except PermissionError:
        issues.append(
            ValidationIssue(
                display_path,
                “permission denied while reading file”,
            )
        )

    except OSError as exc:
        issues.append(
            ValidationIssue(
                display_path,
                f”file access error: {exc}”,
            )
        )

    return issues


def is_excluded(
    relative: Path,
    excluded_names: set[str],
) -> bool:
    “””Check whether any path component is excluded.”””

    return any(
        part in excluded_names
        for part in relative.parts
    )


def is_json_file(path: Path) -> bool:
    “””Determine whether a path is a supported JSON file.”””

    return (
        path.suffix.lower() in JSON_EXTENSIONS
        or path.name in SPECIAL_JSON_FILENAMES
    )


def discover_json_files(
    targets: Iterable[Path],
    *,
    recursive: bool,
    excluded_names: set[str],
) -> tuple[list[Path], list[ValidationIssue]]:
    “””Discover JSON files without following directory symlinks.”””

    found: set[Path] = set()
    issues: list[ValidationIssue] = []

    for target in targets:

        try:
            if target.is_symlink():
                issues.append(
                    ValidationIssue(
                        relative_path(target),
                        “symbolic links are not followed”,
                    )
                )
                continue

            if not target.exists():
                issues.append(
                    ValidationIssue(
                        relative_path(target),
                        “path does not exist”,
                    )
                )
                continue

            if target.is_file():

                if is_json_file(target):
                    found.add(target.resolve())

                else:
                    issues.append(
                        ValidationIssue(
                            relative_path(target),
                            “not a supported JSON file”,
                        )
                    )

                continue

            if not target.is_dir():
                issues.append(
                    ValidationIssue(
                        relative_path(target),
                        “path is neither a regular file nor directory”,
                    )
                )
                continue

            if recursive:

                for current_root, directories, filenames in os.walk(
                    target,
                    topdown=True,
                    followlinks=False,
                    onerror=lambda exc: issues.append(
                        ValidationIssue(
                            relative_path(Path(exc.filename or target)),
                            f”directory traversal error: {exc}”,
                        )
                    ),
                ):
                    current_path = Path(current_root)

                    directories[:] = sorted(
                        directory
                        for directory in directories
                        if directory not in excluded_names
                        and not (current_path / directory).is_symlink()
                    )

                    for filename in sorted(filenames):
                        candidate = current_path / filename

                        try:
                            relative = candidate.relative_to(target)

                            if is_excluded(relative, excluded_names):
                                continue

                            if candidate.is_symlink():
                                continue

                            if candidate.is_file() and is_json_file(candidate):
                                found.add(candidate.resolve())

                        except OSError as exc:
                            issues.append(
                                ValidationIssue(
                                    relative_path(candidate),
                                    f”discovery error: {exc}”,
                                )
                            )

            else:

                try:
                    for candidate in sorted(target.iterdir()):

                        if candidate.is_symlink():
                            continue

                        if not candidate.is_file():
                            continue

                        if not is_json_file(candidate):
                            continue

                        relative = candidate.relative_to(target)

                        if is_excluded(relative, excluded_names):
                            continue

                        found.add(candidate.resolve())

                except OSError as exc:
                    issues.append(
                        ValidationIssue(
                            relative_path(target),
                            f”cannot list directory: {exc}”,
                        )
                    )

        except OSError as exc:
            issues.append(
                ValidationIssue(
                    relative_path(target),
                    f”discovery error: {exc}”,
                )
            )

    return sorted(found), issues


def parse_args() -> argparse.Namespace:
    “””Parse command-line arguments.”””

    parser = argparse.ArgumentParser(
        description=“Validate JSON files in the MedOrbits repository.”
    )

    parser.add_argument(
        “paths”,
        nargs=“*”,
        help=“Files or directories to validate. Defaults to repository root.”,
    )

    parser.add_argument(
        “—recursive”,
        action=“store_true”,
        help=“Search directories recursively.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=(
            “Reject UTF-8 BOMs and require top-level objects or arrays.”
        ),
    )

    parser.add_argument(
        “—allow-duplicate-keys”,
        action=“store_true”,
        help=“Allow duplicate object keys (not recommended).”,
    )

    parser.add_argument(
        “—exclude”,
        action=“append”,
        default=[],
        metavar=“DIRECTORY”,
        help=“Exclude a directory name; may be supplied multiple times.”,
    )

    parser.add_argument(
        “—quiet”,
        action=“store_true”,
        help=“Suppress successful file messages.”,
    )

    parser.add_argument(
        “—json-report”,
        metavar=“PATH”,
        help=“Write a machine-readable JSON report.”,
    )

    return parser.parse_args()


def write_json_report(
    report_path: Path,
    *,
    checked: int,
    issues: list[ValidationIssue],
) -> None:
    “””Write a JSON report without overwriting a source JSON file.”””

    resolved_report = report_path.resolve(strict=False)

    if resolved_report.exists() and resolved_report.is_dir():
        raise OSError(“report path points to a directory”)

    report = {
        “tool”: “MedOrbits JSON Validator”,
        “version”: “1.0.0”,
        “repository”: str(ROOT),
        “checked_files”: checked,
        “error_count”: len(issues),
        “success”: not issues,
        “errors”: [
            asdict(issue)
            for issue in issues
        ],
    }

    encoded = (
        json.dumps(
            report,
            indent=2,
            ensure_ascii=False,
        )
        + “\n”
    )

    if len(encoded.encode(“utf-8”)) > MAX_REPORT_BYTES:
        raise OSError(“generated JSON report exceeds the size limit”)

    report_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    report_path.write_text(
        encoded,
        encoding=“utf-8”,
    )


def main() -> int:
    “””Run JSON validation.”””

    args = parse_args()

    targets = [
        Path(item).expanduser()
        for item in args.paths
    ] or [ROOT]

    targets = [
        target.resolve(strict=False)
        for target in targets
    ]

    excluded_names = DEFAULT_EXCLUDES | set(args.exclude)

    files, discovery_issues = discover_json_files(
        targets,
        recursive=args.recursive,
        excluded_names=excluded_names,
    )

    report_path: Path | None = None

    if args.json_report:
        report_path = Path(
            args.json_report
        ).expanduser().resolve(strict=False)

        if report_path in files:
            print(
                “ERROR: JSON report path matches an input file; “
                “choose a separate report path.”,
                file=sys.stderr,
            )
            return 2

    all_issues = list(discovery_issues)
    checked = 0

    if not args.quiet:
        print(“MedOrbits JSON Validator”)
        print(f”Repository: {ROOT}”)
        print(f”Files discovered: {len(files)}”)
        print(“-“ * 64)

    for path in files:
        checked += 1

        issues = validate_json_file(
            path,
            allow_duplicates=args.allow_duplicate_keys,
            require_object_or_array=args.strict,
            strict=args.strict,
        )

        all_issues.extend(issues)

        if issues:
            for issue in issues:
                print(f”ERROR: {issue}”)

        elif not args.quiet:
            print(f”OK: {relative_path(path)}”)

    for issue in discovery_issues:
        print(f”ERROR: {issue}”)

    if report_path is not None:
        try:
            write_json_report(
                report_path,
                checked=checked,
                issues=all_issues,
            )

            if not args.quiet:
                print(f”JSON report: {report_path}”)

        except (OSError, ValueError) as exc:
            print(
                f”ERROR: Could not write JSON report: {exc}”,
                file=sys.stderr,
            )
            return 2

    print(“-“ * 64)

    if all_issues:
        print(
            f”FAILED: checked {checked} file(s); “
            f”found {len(all_issues)} issue(s).”
        )
        return 1

    print(
        f”PASSED: checked {checked} JSON file(s).”
    )

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())