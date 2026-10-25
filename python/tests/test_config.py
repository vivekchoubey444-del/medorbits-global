#!/usr/bin/env python3
"""
MedOrbits Configuration Tests
=============================
Tests configuration files, environment variables, required settings,
path resolution, and JSON configuration parsing.
Compatible with Python 3.10+.
Uses only the Python standard library.
Run from the repository root:
    python -m unittest python.tests.test_config -v
Optional environment variables:
    MEDORBITS_PROJECT_ROOT
    MEDORBITS_CONFIG_DIR
    MEDORBITS_DATA_DIRS
"""
from __future__ import annotations
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------
def discover_project_root() -> Path:
    """Locate the project root without importing application modules."""
    configured_root = os.environ.get("MEDORBITS_PROJECT_ROOT")
    if configured_root:
        root = Path(configured_root).expanduser().resolve()
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
    # Expected location: <project>/python/tests/test_config.py
    if current.name == "tests" and current.parent.name == "python":
        return current.parent.parent
    raise RuntimeError(
        "Cannot determine project root. Set MEDORBITS_PROJECT_ROOT."
    )
PROJECT_ROOT = discover_project_root()
PYTHON_ROOT = PROJECT_ROOT / "python"
# --------------------------------------------------
# CONFIGURATION HELPERS
# --------------------------------------------------
def resolve_config_path(
    path: str | Path,
    *,
    project_root: Path = PROJECT_ROOT,
) -> Path:
    """
    Resolve a configuration path.
    Relative paths are resolved against project_root.
    Absolute paths are preserved after normalization.
    """
    candidate = Path(path).expanduser()
    if not candidate.is_absolute():
        candidate = project_root / candidate
    return candidate.resolve()
def load_json_config(path: str | Path) -> dict:
    """
    Load a JSON configuration file.
    The root value must be a JSON object.
    Raises FileNotFoundError, ValueError, or OSError on failure.
    """
    config_path = Path(path)
    if not config_path.is_file():
        raise FileNotFoundError(
            f"Configuration file not found: {config_path}"
        )
    try:
        with config_path.open(
            "r",
            encoding="utf-8-sig",
        ) as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON configuration at {config_path}: "
            f"line {exc.lineno}, column {exc.colno}: {exc.msg}"
        ) from exc
    if not isinstance(data, dict):
        raise ValueError(
            f"Configuration root must be a JSON object: {config_path}"
        )
    return data
def validate_required_keys(
    config: dict,
    required_keys: tuple[str, ...] | list[str],
) -> list[str]:
    """Return required configuration keys that are missing or empty."""
    if not isinstance(config, dict):
        raise TypeError("Configuration must be a dictionary")
    missing: list[str] = []
    for key in required_keys:
        if key not in config:
            missing.append(key)
            continue
        value = config[key]
        if value is None:
            missing.append(key)
        elif isinstance(value, str) and not value.strip():
            missing.append(key)
    return missing
def parse_path_list(
    value: str | None,
    *,
    base_dir: Path = PROJECT_ROOT,
) -> list[Path]:
    """
    Parse a path list separated by os.pathsep.
    On Windows, the separator is ';'.
    On Linux and macOS, the separator is ':'.
    """
    if not value or not value.strip():
        return []
    paths: list[Path] = []
    seen: set[Path] = set()
    for item in value.split(os.pathsep):
        item = item.strip()
        if not item:
            continue
        path = Path(item).expanduser()
        if not path.is_absolute():
            path = base_dir / path
        resolved = path.resolve()
        if resolved not in seen:
            seen.add(resolved)
            paths.append(resolved)
    return paths
def read_env_value(
    name: str,
    *,
    default: str | None = None,
    required: bool = False,
) -> str | None:
    """Read a non-empty environment variable."""
    value = os.environ.get(name)
    if value is not None:
        value = value.strip()
    if not value:
        value = default
    if required and not value:
        raise ValueError(
            f"Required environment variable is missing: {name}"
        )
    return value
# --------------------------------------------------
# TEST CASE
# --------------------------------------------------
class TestConfigUtilities(unittest.TestCase):
    """Tests for configuration helpers."""
    def test_project_root_exists(self) -> None:
        self.assertTrue(PROJECT_ROOT.is_dir())
    def test_python_directory_exists(self) -> None:
        self.assertTrue(
            PYTHON_ROOT.is_dir(),
            f"Missing Python source directory: {PYTHON_ROOT}",
        )
    def test_relative_config_path(self) -> None:
        result = resolve_config_path(
            "config/settings.json",
            project_root=Path("/tmp/medorbits"),
        )
        self.assertEqual(
            result,
            Path("/tmp/medorbits/config/settings.json"),
        )
    def test_absolute_config_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            absolute_path = Path(directory) / "settings.json"
            result = resolve_config_path(absolute_path)
            self.assertEqual(result, absolute_path.resolve())
    def test_load_valid_json_config(self) -> None:
        expected = {
            "application": "MedOrbits",
            "debug": False,
            "features": ["admissions", "careers"],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                json.dumps(expected),
                encoding="utf-8",
            )
            self.assertEqual(load_json_config(path), expected)
    def test_load_json_with_utf8_bom(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text(
                '\ufeff{"enabled": true}',
                encoding="utf-8",
            )
            self.assertEqual(
                load_json_config(path),
                {"enabled": True},
            )
    def test_missing_config_raises_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "missing.json"
            with self.assertRaises(FileNotFoundError):
                load_json_config(path)
    def test_invalid_json_raises_value_error(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid.json"
            path.write_text('{"enabled": true,,}', encoding="utf-8")
            with self.assertRaises(ValueError):
                load_json_config(path)
    def test_json_array_is_not_a_config_object(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            path.write_text('["one", "two"]', encoding="utf-8")
            with self.assertRaises(ValueError):
                load_json_config(path)
    def test_required_keys(self) -> None:
        config = {
            "app_name": "MedOrbits",
            "api_url": "",
            "api_key": None,
            "debug": False,
        }
        missing = validate_required_keys(
            config,
            ["app_name", "api_url", "api_key", "debug", "database"],
        )
        self.assertEqual(
            missing,
            ["api_url", "api_key", "database"],
        )
    def test_required_keys_reject_non_dictionary(self) -> None:
        with self.assertRaises(TypeError):
            validate_required_keys([], ["app_name"])  # type: ignore[arg-type]
    def test_empty_required_keys_are_valid(self) -> None:
        self.assertEqual(
            validate_required_keys(
                {"debug": False, "port": 0},
                ["debug", "port"],
            ),
            [],
        )
    def test_environment_variable(self) -> None:
        with patch.dict(
            os.environ,
            {"MEDORBITS_TEST_SETTING": "enabled"},
        ):
            self.assertEqual(
                read_env_value("MEDORBITS_TEST_SETTING"),
                "enabled",
            )
    def test_environment_default(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                read_env_value(
                    "MEDORBITS_TEST_MISSING",
                    default="fallback",
                ),
                "fallback",
            )
    def test_required_environment_variable(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                read_env_value(
                    "MEDORBITS_TEST_REQUIRED",
                    required=True,
                )
    def test_path_list_empty_value(self) -> None:
        self.assertEqual(parse_path_list(None), [])
        self.assertEqual(parse_path_list(""), [])
    def test_path_list_resolves_relative_paths(self) -> None:
        paths = parse_path_list(
            os.pathsep.join(["assets/data", "python/data"]),
            base_dir=Path("/tmp/medorbits"),
        )
        self.assertEqual(
            paths,
            [
                Path("/tmp/medorbits/assets/data"),
                Path("/tmp/medorbits/python/data"),
            ],
        )
    def test_path_list_removes_duplicate_paths(self) -> None:
        paths = parse_path_list(
            os.pathsep.join(
                ["assets/data", "./assets/data"]
            ),
            base_dir=Path("/tmp/medorbits"),
        )
        self.assertEqual(len(paths), 1)
if __name__ == "__main__":
    unittest.main(verbosity=2)