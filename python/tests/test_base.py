#!/usr/bin/env python3
"""
MedOrbits Base Test Utilities
=============================
Reusable base classes and helpers for the MedOrbits test suite.
Compatible with Python 3.10+.
Uses only the Python standard library.
Run from the repository root:
    python -m unittest discover -s python/tests -p "test_*.py"
This module provides:
- Repository root discovery
- Project directory checks
- JSON loading and validation helpers
- Python module import checks
- Temporary file and directory helpers
- Environment and configuration checks
- Consistent unittest assertions
"""
from __future__ import annotations
import importlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, Iterable
# --------------------------------------------------
# PATH CONFIGURATION
# --------------------------------------------------
def discover_project_root(start: Path | None = None) -> Path:
    """
    Discover the MedOrbits repository root.
    Searches upward for common repository markers.
    Falls back to the parent of the python directory when possible.
    """
    current = (start or Path(__file__)).resolve()
    if current.is_file():
        current = current.parent
    markers = (
        ".git",
        "package.json",
        "pyproject.toml",
        "requirements.txt",
        "README.md",
    )
    directories = (current, *current.parents)
    # Prefer unambiguous repository markers before README.md, because
    # subdirectories such as python/tests may contain their own README.
    for directory in directories:
        if (directory / ".git").exists() or (directory / "package.json").is_file():
            return directory
    for directory in directories:
        if (directory / "pyproject.toml").is_file() and (directory / "python").is_dir():
            return directory
    for directory in directories:
        if directory.name.lower() == "python":
            return directory.parent
    for directory in directories:
        if (directory / "README.md").is_file() and (directory / "python").is_dir():
            return directory
    raise RuntimeError(
        "Unable to discover the MedOrbits project root. "
        "Set MEDORBITS_PROJECT_ROOT to the repository directory."
    )
def resolve_project_root() -> Path:
    """Resolve the root from the environment or automatic discovery."""
    configured_root = os.environ.get("MEDORBITS_PROJECT_ROOT")
    if configured_root:
        root = Path(configured_root).expanduser().resolve()
        if not root.is_dir():
            raise NotADirectoryError(
                f"MEDORBITS_PROJECT_ROOT is not a directory: {root}"
            )
        return root
    return discover_project_root()
PROJECT_ROOT = resolve_project_root()
PYTHON_ROOT = PROJECT_ROOT / "python"
TESTS_ROOT = PYTHON_ROOT / "tests"
# --------------------------------------------------
# TEST PATH SETUP
# --------------------------------------------------
def add_project_paths() -> None:
    """
    Add the repository and Python directories to sys.path.
    This supports tests run through unittest discovery without
    requiring the project to be installed as a package.
    """
    for directory in (PROJECT_ROOT, PYTHON_ROOT):
        path = str(directory)
        if directory.is_dir() and path not in sys.path:
            sys.path.insert(0, path)
add_project_paths()
# --------------------------------------------------
# FILE AND JSON HELPERS
# --------------------------------------------------
def read_json(path: str | Path) -> Any:
    """Read and parse a JSON file with a useful error message."""
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = PROJECT_ROOT / file_path
    if not file_path.is_file():
        raise FileNotFoundError(f"JSON file not found: {file_path}")
    try:
        with file_path.open("r", encoding="utf-8-sig") as file:
            return json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON in {file_path} "
            f"at line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
def write_json(
    path: str | Path,
    data: Any,
    *,
    indent: int = 2,
) -> Path:
    """Write JSON data to a file, creating parent directories."""
    file_path = Path(path)
    if not file_path.is_absolute():
        file_path = PROJECT_ROOT / file_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with file_path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=indent,
            allow_nan=False,
        )
        file.write("\n")
    return file_path
def find_json_files(
    directories: Iterable[str | Path],
) -> list[Path]:
    """Find JSON files recursively in the supplied directories."""
    discovered: set[Path] = set()
    for directory in directories:
        root = Path(directory)
        if not root.is_absolute():
            root = PROJECT_ROOT / root
        if not root.is_dir():
            continue
        for file_path in root.rglob("*.json"):
            if file_path.is_file():
                discovered.add(file_path.resolve())
    return sorted(discovered)
# --------------------------------------------------
# MODULE IMPORT HELPERS
# --------------------------------------------------
def import_module_checked(module_name: str) -> Any:
    """
    Import a Python module and return it.
    Raises the original import error so tests retain useful
    diagnostic information.
    """
    if not module_name or not module_name.strip():
        raise ValueError("module_name must not be empty")
    return importlib.import_module(module_name.strip())
# --------------------------------------------------
# BASE TEST CASE
# --------------------------------------------------
class MedOrbitsTestCase(unittest.TestCase):
    """Base class for MedOrbits unit and integration tests."""
    project_root = PROJECT_ROOT
    python_root = PYTHON_ROOT
    tests_root = TESTS_ROOT
    def project_path(self, *parts: str) -> Path:
        """Build an absolute path relative to the repository root."""
        return self.project_root.joinpath(*parts)
    def assert_project_path_exists(
        self,
        *parts: str,
        directory: bool = False,
    ) -> Path:
        """Assert that a project-relative file or directory exists."""
        path = self.project_path(*parts)
        if directory:
            self.assertTrue(
                path.is_dir(),
                f"Expected directory does not exist: {path}",
            )
        else:
            self.assertTrue(
                path.is_file(),
                f"Expected file does not exist: {path}",
            )
        return path
    def assert_valid_json(self, path: str | Path) -> Any:
        """Assert that a JSON file exists and parses successfully."""
        try:
            return read_json(path)
        except (OSError, ValueError) as exc:
            self.fail(f"JSON validation failed for {path}: {exc}")
    def assert_json_keys(
        self,
        data: Any,
        required_keys: Iterable[str],
    ) -> None:
        """Assert that a JSON object contains all required keys."""
        self.assertIsInstance(
            data,
            dict,
            "Expected JSON data to be an object",
        )
        missing = set(required_keys) - set(data.keys())
        self.assertFalse(
            missing,
            f"Missing required JSON keys: {sorted(missing)}",
        )
    def assert_importable(self, module_name: str) -> Any:
        """Assert that a Python module can be imported."""
        try:
            return import_module_checked(module_name)
        except Exception as exc:
            self.fail(
                f"Unable to import module {module_name!r}: "
                f"{type(exc).__name__}: {exc}"
            )
    def assert_non_empty_file(self, path: str | Path) -> None:
        """Assert that a file exists and contains data."""
        file_path = Path(path)
        if not file_path.is_absolute():
            file_path = self.project_root / file_path
        self.assertTrue(file_path.is_file(), f"File not found: {file_path}")
        self.assertGreater(
            file_path.stat().st_size,
            0,
            f"File is empty: {file_path}",
        )
    def temporary_directory(self) -> tempfile.TemporaryDirectory[str]:
        """Return a temporary directory managed by the caller."""
        return tempfile.TemporaryDirectory(prefix="medorbits_test_")
    def temporary_json_file(self, data: Any) -> Path:
        """
        Create a temporary JSON file.
        The caller is responsible for deleting the file when finished.
        """
        handle = tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".json",
            prefix="medorbits_test_",
            delete=False,
        )
        path = Path(handle.name)
        try:
            with handle:
                json.dump(
                    data,
                    handle,
                    ensure_ascii=False,
                    indent=2,
                    allow_nan=False,
                )
                handle.write("\n")
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return path
# --------------------------------------------------
# BASE TESTS
# --------------------------------------------------
class TestBaseUtilities(MedOrbitsTestCase):
    """Tests for the base testing utilities themselves."""
    def test_project_root_exists(self) -> None:
        self.assertTrue(
            self.project_root.is_dir(),
            f"Project root is not a directory: {self.project_root}",
        )
    def test_python_directory_exists(self) -> None:
        self.assertTrue(
            self.python_root.is_dir(),
            f"Python directory is not present: {self.python_root}",
        )
    def test_json_round_trip(self) -> None:
        expected = {
            "project": "MedOrbits",
            "enabled": True,
            "items": [1, 2, 3],
        }
        path = self.temporary_json_file(expected)
        try:
            actual = read_json(path)
            self.assertEqual(actual, expected)
        finally:
            path.unlink(missing_ok=True)
    def test_json_rejects_non_finite_numbers(self) -> None:
        with self.assertRaises(ValueError):
            self.temporary_json_file({"value": float("nan")})
    def test_json_writer_creates_parent_directories(self) -> None:
        with tempfile.TemporaryDirectory(
            prefix="medorbits_test_"
        ) as temporary_root:
            destination = (
                Path(temporary_root) / "nested" / "data.json"
            )
            write_json(destination, {"status": "ok"})
            self.assertTrue(destination.is_file())
            self.assertEqual(read_json(destination), {"status": "ok"})
    def test_find_json_files_ignores_missing_directories(self) -> None:
        with tempfile.TemporaryDirectory(
            prefix="medorbits_test_"
        ) as temporary_root:
            root = Path(temporary_root)
            (root / "valid.json").write_text(
                '{"valid": true}',
                encoding="utf-8",
            )
            results = find_json_files(
                [root, root / "does-not-exist"]
            )
            self.assertEqual(
                results,
                [(root / "valid.json").resolve()],
            )
if __name__ == "__main__":
    unittest.main(verbosity=2)