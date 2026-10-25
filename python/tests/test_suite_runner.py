#!/usr/bin/env python3
"""
MedOrbits Master Test Suite Runner
==================================
Automatically discovers, validates, and runs MedOrbits tests.
Compatible with Python 3.10+.
Uses only the Python standard library.
Features:
- Discovers test_*.py files automatically.
- Runs unittest-compatible tests.
- Checks Python syntax across project files.
- Validates project JSON files.
- Checks test-module importability.
- Detects production Python modules without matching test files.
- Reports discovered test modules and missing test coverage.
- Supports strict mode for missing tests.
- Produces an optional JSON test report.
- Does not generate or overwrite test files automatically.
Run from repository root:
    python python/tests/test_suite_runner.py
Run with unittest discovery:
    python -m unittest discover -s python/tests -p "test_*.py" -v
Check missing tests:
    python python/tests/test_suite_runner.py --check-coverage
Strict coverage check:
    python python/tests/test_suite_runner.py --check-coverage --strict
Validate Python and JSON:
    python python/tests/test_suite_runner.py --static-only
Write a report:
    python python/tests/test_suite_runner.py --report reports/test-suite.json
"""
from __future__ import annotations
import argparse
import ast
import importlib.util
import json
import os
import sys
import time
import unittest
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------
def find_project_root() -> Path:
    configured = os.environ.get("MEDORBITS_PROJECT_ROOT")
    if configured:
        root = Path(configured).expanduser().resolve()
        if not root.is_dir():
            raise NotADirectoryError(
                f"MEDORBITS_PROJECT_ROOT is not a directory: {root}"
            )
        return root
    current = Path(__file__).resolve().parent
    for directory in (current, *current.parents):
        if (
            (directory / ".git").exists()
            or (directory / "package.json").is_file()
            or (directory / "pyproject.toml").is_file()
            or (
                (directory / "python").is_dir()
                and (directory / "assets").is_dir()
            )
        ):
            return directory
    # Expected structure: <root>/python/tests/test_suite_runner.py
    return Path(__file__).resolve().parents[2]
PROJECT_ROOT = find_project_root()
PYTHON_ROOT = PROJECT_ROOT / "python"
TESTS_ROOT = PYTHON_ROOT / "tests"
EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
}
# --------------------------------------------------
# DISCOVERY
# --------------------------------------------------
def iter_files(root: Path, suffix: str) -> list[Path]:
    """Recursively discover files, skipping common generated folders."""
    if not root.is_dir():
        return []
    results: list[Path] = []
    for path in root.rglob(f"*{suffix}"):
        if not path.is_file():
            continue
        try:
            relative = path.relative_to(root)
        except ValueError:
            continue
        if any(
            part in EXCLUDED_DIRECTORY_NAMES
            for part in relative.parts
        ):
            continue
        results.append(path)
    return sorted(results)
def discover_test_files() -> list[Path]:
    """Find test_*.py files in the configured test directory."""
    if not TESTS_ROOT.is_dir():
        return []
    return sorted(
        path
        for path in iter_files(TESTS_ROOT, ".py")
        if path.name.startswith("test_")
        and path.name != "test_suite_runner.py"
    )
def discover_python_sources() -> list[Path]:
    """Find Python source files under python/, excluding tests."""
    return [
        path
        for path in iter_files(PYTHON_ROOT, ".py")
        if TESTS_ROOT not in path.parents
        and path.name != "__init__.py"
    ]
def module_name_from_path(path: Path) -> str:
    """Convert a project-relative Python path into a module name."""
    relative = path.relative_to(PROJECT_ROOT).with_suffix("")
    parts = list(relative.parts)
    if parts and parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)
# --------------------------------------------------
# STATIC CHECKS
# --------------------------------------------------
def check_python_syntax() -> dict[str, Any]:
    """Compile Python source into an AST without executing it."""
    files = iter_files(PROJECT_ROOT, ".py")
    checked = 0
    errors: list[dict[str, str]] = []
    for path in files:
        checked += 1
        try:
            source = path.read_text(encoding="utf-8-sig")
            ast.parse(source, filename=str(path))
        except (OSError, SyntaxError, UnicodeError) as exc:
            errors.append({
                "file": str(path.relative_to(PROJECT_ROOT)),
                "error": str(exc),
            })
    return {
        "checked": checked,
        "errors": errors,
        "passed": not errors,
    }
def check_json_files() -> dict[str, Any]:
    """Parse JSON files and report malformed documents."""
    files = iter_files(PROJECT_ROOT, ".json")
    checked = 0
    errors: list[dict[str, str]] = []
    for path in files:
        checked += 1
        try:
            with path.open("r", encoding="utf-8-sig") as file:
                json.load(file)
        except (OSError, json.JSONDecodeError, UnicodeError) as exc:
            errors.append({
                "file": str(path.relative_to(PROJECT_ROOT)),
                "error": str(exc),
            })
    return {
        "checked": checked,
        "errors": errors,
        "passed": not errors,
    }
# --------------------------------------------------
# TEST COVERAGE CHECKS
# --------------------------------------------------
def expected_test_name(source: Path) -> str:
    """Map a production Python module to its conventional test filename."""
    return f"test_{source.stem}.py"
def check_test_coverage() -> dict[str, Any]:
    """
    Find production modules that lack a conventionally named test.
    This is a heuristic, not proof of missing test coverage:
    multiple production modules may be tested by one integration suite.
    """
    sources = discover_python_sources()
    test_files = discover_test_files()
    existing_names = {path.name for path in test_files}
    covered: list[str] = []
    missing: list[str] = []
    for source in sources:
        expected = expected_test_name(source)
        relative_source = str(source.relative_to(PROJECT_ROOT))
        if expected in existing_names:
            covered.append(relative_source)
        else:
            missing.append(relative_source)
    return {
        "source_modules": len(sources),
        "test_files": len(test_files),
        "conventionally_covered": covered,
        "missing_conventional_tests": missing,
        "note": (
            "Coverage matching is filename-based and may report false "
            "positives for modules covered by shared integration tests."
        ),
    }
# --------------------------------------------------
# TEST DISCOVERY AND EXECUTION
# --------------------------------------------------
def build_test_suite() -> unittest.TestSuite:
    """Discover all unittest-compatible tests."""
    if not TESTS_ROOT.is_dir():
        raise FileNotFoundError(
            f"Test directory does not exist: {TESTS_ROOT}"
        )
    # unittest discovery expects the start directory to be importable.
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))
    if str(PYTHON_ROOT) not in sys.path:
        sys.path.insert(0, str(PYTHON_ROOT))
    loader = unittest.TestLoader()
    return loader.discover(
        start_dir=str(TESTS_ROOT),
        pattern="test_*.py",
        top_level_dir=str(PROJECT_ROOT),
    )
def count_tests(suite: unittest.TestSuite) -> int:
    """Count tests recursively without executing them."""
    total = 0
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            total += count_tests(item)
        else:
            total += 1
    return total
def run_tests(verbosity: int = 2) -> dict[str, Any]:
    """Execute discovered tests and return a summary."""
    suite = build_test_suite()
    total = count_tests(suite)
    print(f"\nProject root: {PROJECT_ROOT}")
    print(f"Test directory: {TESTS_ROOT}")
    print(f"Discovered tests: {total}")
    print("-" * 72)
    started = time.perf_counter()
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    elapsed = time.perf_counter() - started
    failures = [
        {
            "test": str(test),
            "traceback": traceback,
        }
        for test, traceback in result.failures
    ]
    errors = [
        {
            "test": str(test),
            "traceback": traceback,
        }
        for test, traceback in result.errors
    ]
    skipped = [
        {
            "test": str(test),
            "reason": reason,
        }
        for test, reason in result.skipped
    ]
    return {
        "total": result.testsRun,
        "successful": result.testsRun - len(result.failures) - len(result.errors),
        "failures": failures,
        "errors": errors,
        "skipped": skipped,
        "elapsed_seconds": round(elapsed, 3),
        "passed": result.wasSuccessful(),
    }
# --------------------------------------------------
# REPORTING
# --------------------------------------------------
def print_static_results(
    python_result: dict[str, Any],
    json_result: dict[str, Any],
) -> None:
    """Display syntax and JSON validation results."""
    print("\nPython syntax")
    print("-" * 72)
    print(f"Files checked: {python_result['checked']}")
    print(f"Errors: {len(python_result['errors'])}")
    for item in python_result["errors"]:
        print(f"  FAIL {item['file']}: {item['error']}")
    print("\nJSON validation")
    print("-" * 72)
    print(f"Files checked: {json_result['checked']}")
    print(f"Errors: {len(json_result['errors'])}")
    for item in json_result["errors"]:
        print(f"  FAIL {item['file']}: {item['error']}")
def print_coverage_results(coverage: dict[str, Any]) -> None:
    """Display modules without conventionally named tests."""
    print("\nTest coverage inventory")
    print("-" * 72)
    print(f"Production Python modules: {coverage['source_modules']}")
    print(f"Test files discovered: {coverage['test_files']}")
    print(
        "Modules with matching test filename: "
        f"{len(coverage['conventionally_covered'])}"
    )
    missing = coverage["missing_conventional_tests"]
    print(f"Modules without matching test filename: {len(missing)}")
    for source in missing:
        print(f"  MISSING test for: {source}")
    print(f"Note: {coverage['note']}")
def write_report(path: str | Path, report: dict[str, Any]) -> Path:
    """Write the summary report without exposing environment secrets."""
    destination = Path(path).expanduser()
    if not destination.is_absolute():
        destination = PROJECT_ROOT / destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(
            report,
            file,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        )
        file.write("\n")
    return destination
# --------------------------------------------------
# COMMAND LINE
# --------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the MedOrbits test suite and static checks."
    )
    parser.add_argument(
        "--static-only",
        action="store_true",
        help="Check Python syntax and JSON files without running tests.",
    )
    parser.add_argument(
        "--check-coverage",
        action="store_true",
        help="Report production modules without matching test filenames.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return failure if conventional test files are missing.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Write a JSON report to the specified path.",
    )
    parser.add_argument(
        "--verbosity",
        type=int,
        choices=(0, 1, 2),
        default=2,
        help="unittest output verbosity (default: 2).",
    )
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    report: dict[str, Any] = {
        "project": "MedOrbits",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version.split()[0],
        "project_root": str(PROJECT_ROOT),
    }
    python_result = check_python_syntax()
    json_result = check_json_files()
    report["python_syntax"] = python_result
    report["json_validation"] = json_result
    print_static_results(python_result, json_result)
    overall_success = (
        python_result["passed"]
        and json_result["passed"]
    )
    if args.check_coverage or args.strict:
        coverage = check_test_coverage()
        report["coverage"] = coverage
        print_coverage_results(coverage)
        if args.strict and coverage["missing_conventional_tests"]:
            overall_success = False
    if not args.static_only:
        try:
            test_result = run_tests(verbosity=args.verbosity)
            report["tests"] = test_result
            overall_success = overall_success and test_result["passed"]
        except Exception as exc:
            report["test_runner_error"] = {
                "type": type(exc).__name__,
                "message": str(exc),
            }
            print(
                f"\nUnable to run tests: "
                f"{type(exc).__name__}: {exc}"
            )
            overall_success = False
    report["passed"] = overall_success
    if args.report:
        destination = write_report(args.report, report)
        print(f"\nReport written to: {destination}")
    print("\n" + "=" * 72)
    print("MEDORBITS TEST SUITE:", "PASSED" if overall_success else "FAILED")
    print("=" * 72)
    return 0 if overall_success else 1
if __name__ == "__main__":
    raise SystemExit(main())