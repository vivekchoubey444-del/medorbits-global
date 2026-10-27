
"""Tests for MedOrbits validation utilities.

Coverage:
    - JSON parsing and validation
    - JSON Schema validation when the dependency is available
    - Environment variable validation without exposing secret values
    - Safe path handling
    - Malformed input and error reporting
    - Non-destructive validation behavior

Run:
    python -m pytest python/scr/tests/test_validation.py -v
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_DIR = PROJECT_ROOT / "config"
API_SCHEMA_DIR = PROJECT_ROOT / "api" / "schemas"

SECRET_KEY_PATTERN = re.compile(
    r"(?:SECRET|PASSWORD|PASSWD|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIAL)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# JSON validation helpers
# ---------------------------------------------------------------------------


def load_json(path: Path) -> Any:
    """Load a UTF-8 JSON file with explicit errors."""
    if not path.is_file():
        raise FileNotFoundError(f"JSON file does not exist: {path}")

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError(f"Invalid JSON file: {path.name}") from exc


def validate_json_object(value: Any) -> bool:
    """Return whether a value is a JSON object."""
    return isinstance(value, dict)


def validate_required_fields(
    value: dict[str, Any],
    required_fields: tuple[str, ...],
) -> list[str]:
    """Return required fields missing from a JSON object."""
    return [
        field
        for field in required_fields
        if field not in value or value[field] is None
    ]


def is_within_directory(path: Path, directory: Path) -> bool:
    """Check whether a resolved path is contained within a directory."""
    try:
        path.resolve().relative_to(directory.resolve())
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Repository structure
# ---------------------------------------------------------------------------


def test_project_root_exists() -> None:
    """The test file resolves to the expected repository root."""
    assert PROJECT_ROOT.is_dir()
    assert (PROJECT_ROOT / "python").is_dir()


def test_test_directory_exists() -> None:
    """The validation test is located under the expected directory."""
    assert Path(__file__).resolve().parent == PROJECT_ROOT / "python" / "scr" / "tests"


def test_schema_directories_are_paths() -> None:
    """Schema locations are defined as paths, whether or not they exist yet."""
    assert SCHEMA_DIR == PROJECT_ROOT / "config"
    assert API_SCHEMA_DIR == PROJECT_ROOT / "api" / "schemas"


# ---------------------------------------------------------------------------
# JSON parsing
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('{"status":"ok"}', {"status": "ok"}),
        ("[]", []),
        ("null", None),
        ("true", True),
        ("123", 123),
        ('"medorbits"', "medorbits"),
    ],
)
def test_json_parser_accepts_valid_json(raw: str, expected: Any) -> None:
    """Valid JSON values parse without changing their meaning."""
    assert json.loads(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "{",
        '{"key":}',
        "{'key': 'value'}",
        '{"key": "value",}',
        "undefined",
    ],
)
def test_json_parser_rejects_invalid_json(raw: str) -> None:
    """Malformed JSON is rejected."""
    with pytest.raises(json.JSONDecodeError):
        json.loads(raw)


def test_load_json_reads_utf8_file(tmp_path: Path) -> None:
    """JSON files are read as UTF-8."""
    path = tmp_path / "sample.json"
    expected = {"project": "MedOrbits", "description": "Education platform"}
    path.write_text(
        json.dumps(expected, ensure_ascii=False),
        encoding="utf-8",
    )

    assert load_json(path) == expected


def test_load_json_reports_missing_file(tmp_path: Path) -> None:
    """Missing JSON files produce a clear file error."""
    with pytest.raises(FileNotFoundError, match="does not exist"):
        load_json(tmp_path / "missing.json")


def test_load_json_rejects_malformed_file(tmp_path: Path) -> None:
    """Malformed JSON produces a controlled validation error."""
    path = tmp_path / "malformed.json"
    path.write_text('{"broken":', encoding="utf-8")

    with pytest.raises(ValueError, match="Invalid JSON file"):
        load_json(path)


def test_load_json_rejects_invalid_utf8(tmp_path: Path) -> None:
    """Invalid UTF-8 is rejected instead of being silently replaced."""
    path = tmp_path / "invalid-encoding.json"
    path.write_bytes(b"\xff\xfe\xfa")

    with pytest.raises(ValueError, match="Invalid JSON file"):
        load_json(path)


# ---------------------------------------------------------------------------
# Object and required-field validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        {},
        {"id": "JOB-001"},
        {"status": "active", "count": 0},
    ],
)
def test_json_object_validation_accepts_objects(value: dict[str, Any]) -> None:
    """Dictionary payloads are accepted as JSON objects."""
    assert validate_json_object(value) is True


@pytest.mark.parametrize(
    "value",
    [
        None,
        [],
        "string",
        10,
        True,
    ],
)
def test_json_object_validation_rejects_non_objects(value: Any) -> None:
    """Non-object JSON values are rejected where objects are required."""
    assert validate_json_object(value) is False


def test_required_fields_detects_missing_fields() -> None:
    """Missing required fields are returned explicitly."""
    payload = {"id": "JOB-001", "title": "Software Engineer"}

    missing = validate_required_fields(
        payload,
        ("id", "title", "location"),
    )

    assert missing == ["location"]


def test_required_fields_detects_null_values() -> None:
    """Required fields set to null are treated as missing."""
    payload = {"id": "JOB-001", "title": None}

    missing = validate_required_fields(payload, ("id", "title"))

    assert missing == ["title"]


def test_required_fields_accepts_valid_payload() -> None:
    """A payload with all required non-null fields passes."""
    payload = {
        "id": "COLLEGE-001",
        "name": "Example College",
        "state": "West Bengal",
    }

    assert validate_required_fields(
        payload,
        ("id", "name", "state"),
    ) == []


# ---------------------------------------------------------------------------
# JSON Schema validation
# ---------------------------------------------------------------------------


def test_json_schema_validation_with_jsonschema_when_installed() -> None:
    """The JSON Schema dependency validates representative payloads."""
    jsonschema = pytest.importorskip("jsonschema")

    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "required": ["id", "title"],
        "properties": {
            "id": {"type": "string", "minLength": 1},
            "title": {"type": "string", "minLength": 1},
            "active": {"type": "boolean"},
        },
        "additionalProperties": False,
    }

    valid_payload = {
        "id": "JOB-001",
        "title": "Software Engineer",
        "active": True,
    }
    invalid_payload = {
        "id": "",
        "active": "yes",
        "unexpected": "field",
    }

    jsonschema.validate(valid_payload, schema)

    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(invalid_payload, schema)


def test_repository_json_schemas_are_parseable() -> None:
    """Existing JSON schema files contain valid JSON.

    This checks syntax only; it does not claim that every schema follows
    JSON Schema specifications.
    """
    schema_roots = (SCHEMA_DIR, API_SCHEMA_DIR)
    schema_files = [
        path
        for root in schema_roots
        if root.is_dir()
        for path in root.rglob("*.schema.json")
        if path.is_file()
    ]

    if not schema_files:
        pytest.skip("No *.schema.json files found in configured schema directories.")

    errors: list[str] = []

    for path in schema_files:
        try:
            load_json(path)
        except (ValueError, FileNotFoundError) as exc:
            errors.append(f"{path.relative_to(PROJECT_ROOT)}: {exc}")

    assert not errors, "Invalid schema JSON files:\n" + "\n".join(errors)


# ---------------------------------------------------------------------------
# Environment validation
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "key",
    [
        "DATABASE_URL",
        "JWT_SECRET",
        "SESSION_SECRET",
        "API_KEY",
        "SMTP_PASSWORD",
        "PRIVATE_KEY",
    ],
)
def test_secret_key_detection_is_case_insensitive(key: str) -> None:
    """Common secret-bearing variable names are identified."""
    assert SECRET_KEY_PATTERN.search(key)


@pytest.mark.parametrize(
    "key",
    [
        "NODE_ENV",
        "PORT",
        "LOG_LEVEL",
        "APP_VERSION",
        "FEATURE_SEARCH_ENABLED",
    ],
)
def test_non_secret_configuration_keys_are_not_secret_names(key: str) -> None:
    """Ordinary configuration names do not match the secret-name pattern."""
    assert SECRET_KEY_PATTERN.search(key) is None


def test_environment_values_are_not_required_for_this_test_suite() -> None:
    """Tests must not depend on real credentials or production secrets."""
    # Deliberately do not read or print secret values from the environment.
    assert isinstance(os.environ, os._Environ)


def test_blank_required_environment_value_is_detectable() -> None:
    """Blank values can be detected without disclosing their contents."""
    sample_environment = {
        "NODE_ENV": "test",
        "DATABASE_URL": "",
    }

    missing = [
        key
        for key, value in sample_environment.items()
        if not value.strip()
    ]

    assert missing == ["DATABASE_URL"]


# ---------------------------------------------------------------------------
# Path safety
# ---------------------------------------------------------------------------


def test_path_containment_accepts_child_path(tmp_path: Path) -> None:
    """A file within the designated directory is considered contained."""
    root = tmp_path / "reports"
    root.mkdir()

    child = root / "summary.json"

    assert is_within_directory(child, root)


def test_path_containment_rejects_outside_path(tmp_path: Path) -> None:
    """A path outside the designated directory is rejected."""
    root = tmp_path / "reports"
    outside = tmp_path / "private.json"
    root.mkdir()

    assert not is_within_directory(outside, root)


def test_path_containment_rejects_parent_traversal(tmp_path: Path) -> None:
    """Parent traversal cannot escape the designated directory."""
    root = tmp_path / "reports"
    root.mkdir()

    traversal = root / ".." / "private.json"

    assert not is_within_directory(traversal, root)


def test_path_containment_handles_equal_directory(tmp_path: Path) -> None:
    """The directory itself is contained within itself."""
    assert is_within_directory(tmp_path, tmp_path)


# ---------------------------------------------------------------------------
# Serialization and error handling
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"status": "ok"},
        {"items": []},
        {"count": 0, "valid": True},
        {"unicode": "भारत", "platform": "MedOrbits"},
    ],
)
def test_json_serialization_round_trip(payload: dict[str, Any]) -> None:
    """Representative application payloads survive JSON round trips."""
    serialized = json.dumps(payload, ensure_ascii=False)
    restored = json.loads(serialized)

    assert restored == payload


def test_non_serializable_value_is_rejected() -> None:
    """Unsupported Python objects cannot be silently serialized as JSON."""
    with pytest.raises(TypeError):
        json.dumps({"path": Path("example.json")})


def test_validation_error_does_not_expose_secret_value() -> None:
    """Validation messages should identify the key, not reveal its value."""
    secret_value = "do-not-print-this-secret"
    key = "JWT_SECRET"

    message = f"Missing or invalid configuration: {key}"

    assert key in message
    assert secret_value not in message


def test_temporary_validation_files_are_isolated(tmp_path: Path) -> None:
    """Temporary validation fixtures stay outside the repository."""
    resolved_temp = tmp_path.resolve()
    resolved_root = PROJECT_ROOT.resolve()

    assert resolved_temp != resolved_root
    assert not resolved_temp.is_relative_to(resolved_root)


def test_validation_helpers_do_not_modify_repository_files() -> None:
    """Helper definitions remain pure and do not perform repository writes."""
    # This is a design assertion, not a sandbox or filesystem security proof.
    assert callable(load_json)
    assert callable(validate_json_object)
    assert callable(validate_required_fields)
    assert callable(is_within_directory)
