# /python/tests/test_json_data.py
"""
MedOrbits -- JSON Data Validation Tests
======================================

Purpose:
    Test JSON loading, parsing, schema validation, required fields, nested
    structures, data types, encoding, serialization, and error handling.

Framework:
    Python standard-library unittest.

Dependencies:
    Python 3.10+ recommended. No third-party dependencies required.

Run from the repository root:
    python -m unittest discover -s python/tests -p "test_json_data.py" -v

Scope:
    This file contains reusable reference validation functions and tests.
    Replace the reference functions with imports from the production
    MedOrbits JSON-data module when its actual API is available.

Security:
    No network access, credentials, or production data are required.
"""

from __future__ import annotations

import json
import math
import tempfile
import unittest

from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class JsonDataError(ValueError):
    """Base exception for JSON-data processing errors."""


class JsonParseError(JsonDataError):
    """Raised when JSON cannot be parsed."""


class JsonSchemaError(JsonDataError):
    """Raised when parsed JSON violates expected structure or rules."""


class JsonFileError(JsonDataError):
    """Raised when a JSON file cannot be read or decoded."""


# ---------------------------------------------------------------------------
# Reference implementation
# ---------------------------------------------------------------------------


def parse_json(source: str | bytes | bytearray) -> Any:
    """
    Parse a JSON string or UTF-8 byte sequence.

    Returns any valid JSON value: object, array, string, number, boolean,
    or null. Schema validation is performed separately.
    """
    if isinstance(source, (bytes, bytearray)):
        try:
            source = bytes(source).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise JsonParseError("JSON input must be UTF-8 encoded") from exc

    if not isinstance(source, str):
        raise JsonParseError("JSON input must be text or UTF-8 bytes")

    try:
        return json.loads(source)
    except json.JSONDecodeError as exc:
        raise JsonParseError(
            f"Invalid JSON at line {exc.lineno}, column {exc.colno}"
        ) from exc


def load_json_file(path: str | Path) -> Any:
    """Read and parse a UTF-8 JSON file."""
    file_path = Path(path)

    try:
        content = file_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise JsonFileError(
            f"Unable to read JSON file: {file_path.name}"
        ) from exc

    try:
        return parse_json(content)
    except JsonParseError as exc:
        raise JsonFileError(
            f"JSON file contains invalid JSON: {file_path.name}"
        ) from exc


def serialize_json(
    data: Any,
    *,
    indent: int | None = 2,
    ensure_ascii: bool = False,
) -> str:
    """Serialize JSON-compatible data without non-standard NaN values."""
    if indent is not None and (
        isinstance(indent, bool) or not isinstance(indent, int) or indent < 0
    ):
        raise JsonDataError("indent must be a non-negative integer or None")

    if not isinstance(ensure_ascii, bool):
        raise JsonDataError("ensure_ascii must be a boolean")

    try:
        return json.dumps(
            data,
            indent=indent,
            ensure_ascii=ensure_ascii,
            allow_nan=False,
        )
    except (TypeError, ValueError, OverflowError) as exc:
        raise JsonDataError("Data cannot be serialized as valid JSON") from exc


def validate_json_object(data: Any) -> dict[str, Any]:
    """Require a top-level JSON object."""
    if not isinstance(data, dict):
        raise JsonSchemaError("Top-level JSON value must be an object")

    return data


def validate_required_keys(
    data: Any,
    required_keys: set[str] | list[str] | tuple[str, ...],
) -> dict[str, Any]:
    """Require specified keys and reject missing or empty values."""
    if not isinstance(data, dict):
        raise JsonSchemaError("Data must be a JSON object")

    if isinstance(required_keys, (str, bytes)):
        raise JsonSchemaError("Required keys must be a collection of names")

    keys = tuple(required_keys)

    if any(not isinstance(key, str) or not key for key in keys):
        raise JsonSchemaError("Required key names must be non-empty strings")

    missing = [
        key
        for key in keys
        if key not in data
        or data[key] is None
        or (isinstance(data[key], str) and not data[key].strip())
    ]

    if missing:
        raise JsonSchemaError(
            "Missing or empty required keys: " + ", ".join(sorted(missing))
        )

    return data


def validate_field_types(
    data: Any,
    expected_types: dict[str, type | tuple[type, ...]],
) -> dict[str, Any]:
    """
    Validate the types of specified fields.

    Unspecified fields are allowed. Boolean values are not accepted as
    integers unless bool is explicitly included in the expected type.
    """
    if not isinstance(data, dict):
        raise JsonSchemaError("Data must be a JSON object")

    if not isinstance(expected_types, dict):
        raise JsonSchemaError("Expected types must be a dictionary")

    for field, expected_type in expected_types.items():
        if field not in data:
            raise JsonSchemaError(f"Missing field: {field}")

        value = data[field]

        # Python considers bool a subclass of int. Avoid that ambiguity.
        allows_bool = (
            expected_type is bool
            or (
                isinstance(expected_type, tuple)
                and bool in expected_type
            )
        )

        if isinstance(value, bool) and not allows_bool:
            raise JsonSchemaError(f"Field '{field}' has an invalid type")

        if not isinstance(value, expected_type):
            raise JsonSchemaError(f"Field '{field}' has an invalid type")

    return data


def validate_json_compatible(data: Any) -> Any:
    """Reject Python values that cannot be represented as strict JSON."""
    try:
        json.dumps(data, allow_nan=False)
    except (TypeError, ValueError, OverflowError) as exc:
        raise JsonSchemaError(
            "Data contains values that are not valid JSON"
        ) from exc

    return data


def validate_string_list(data: Any, *, field: str) -> list[str]:
    """Require a list containing only non-empty strings."""
    if not isinstance(data, dict):
        raise JsonSchemaError("Data must be a JSON object")

    if field not in data:
        raise JsonSchemaError(f"Missing field: {field}")

    value = data[field]

    if not isinstance(value, list):
        raise JsonSchemaError(f"Field '{field}' must be a list")

    for index, item in enumerate(value):
        if not isinstance(item, str) or not item.strip():
            raise JsonSchemaError(
                f"Field '{field}' contains an invalid item at index {index}"
            )

    return value


def validate_unique_ids(
    records: Any,
    *,
    id_field: str = "id",
) -> list[dict[str, Any]]:
    """Validate a list of objects with non-empty, unique string IDs."""
    if not isinstance(records, list):
        raise JsonSchemaError("Records must be a list")

    seen: set[str] = set()

    for index, record in enumerate(records):
        if not isinstance(record, dict):
            raise JsonSchemaError(f"Record at index {index} must be an object")

        identifier = record.get(id_field)

        if not isinstance(identifier, str) or not identifier.strip():
            raise JsonSchemaError(
                f"Record at index {index} must have a non-empty string ID"
            )

        if identifier in seen:
            raise JsonSchemaError(f"Duplicate ID: {identifier}")

        seen.add(identifier)

    return records


def validate_non_negative_number(
    data: Any,
    *,
    field: str,
) -> int | float:
    """Require a finite, non-negative numeric field; reject booleans."""
    if not isinstance(data, dict):
        raise JsonSchemaError("Data must be a JSON object")

    if field not in data:
        raise JsonSchemaError(f"Missing field: {field}")

    value = data[field]

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise JsonSchemaError(f"Field '{field}' must be a number")

    if not math.isfinite(value):
        raise JsonSchemaError(f"Field '{field}' must be finite")

    if value < 0:
        raise JsonSchemaError(f"Field '{field}' must not be negative")

    return value


# ---------------------------------------------------------------------------
# JSON parsing tests
# ---------------------------------------------------------------------------


class TestJsonParsing(unittest.TestCase):
    """Verify valid JSON parsing and malformed-input rejection."""

    def test_parses_object(self) -> None:
        self.assertEqual(parse_json('{"name":"MedOrbits"}'),
                         {"name": "MedOrbits"})

    def test_parses_array(self) -> None:
        self.assertEqual(parse_json("[1,2,3]"), [1, 2, 3])

    def test_parses_string(self) -> None:
        self.assertEqual(parse_json('"hello"'), "hello")

    def test_parses_integer(self) -> None:
        self.assertEqual(parse_json("42"), 42)

    def test_parses_boolean(self) -> None:
        self.assertIs(parse_json("true"), True)

    def test_parses_null(self) -> None:
        self.assertIsNone(parse_json("null"))

    def test_parses_nested_data(self) -> None:
        source = '{"course":{"name":"MBBS","fees":[1000,2000]}}'
        self.assertEqual(
            parse_json(source),
            {"course": {"name": "MBBS", "fees": [1000, 2000]}},
        )

    def test_parses_utf8_bytes(self) -> None:
        self.assertEqual(
            parse_json('{"name":"नमस्ते"}'.encode("utf-8")),
            {"name": "नमस्ते"},
        )

    def test_rejects_malformed_json(self) -> None:
        with self.assertRaises(JsonParseError):
            parse_json('{"name":')

    def test_rejects_trailing_comma(self) -> None:
        with self.assertRaises(JsonParseError):
            parse_json('{"name":"A",}')

    def test_rejects_invalid_utf8(self) -> None:
        with self.assertRaises(JsonParseError):
            parse_json(b"\xff")

    def test_rejects_unsupported_input_type(self) -> None:
        with self.assertRaises(JsonParseError):
            parse_json(123)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# JSON file tests
# ---------------------------------------------------------------------------


class TestJsonFileLoading(unittest.TestCase):
    """Verify file loading with isolated temporary files."""

    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_directory.cleanup)
        self.root = Path(self.temp_directory.name)

    def test_loads_valid_json_file(self) -> None:
        path = self.root / "courses.json"
        path.write_text('{"courses":["MBBS","BDS"]}', encoding="utf-8")

        self.assertEqual(
            load_json_file(path),
            {"courses": ["MBBS", "BDS"]},
        )

    def test_loads_unicode_json_file(self) -> None:
        path = self.root / "unicode.json"
        path.write_text('{"name":"नमस्ते"}', encoding="utf-8")

        self.assertEqual(load_json_file(path), {"name": "नमस्ते"})

    def test_rejects_missing_file(self) -> None:
        with self.assertRaises(JsonFileError):
            load_json_file(self.root / "missing.json")

    def test_rejects_malformed_json_file(self) -> None:
        path = self.root / "invalid.json"
        path.write_text('{"broken":', encoding="utf-8")

        with self.assertRaises(JsonFileError):
            load_json_file(path)

    def test_rejects_invalid_utf8_file(self) -> None:
        path = self.root / "invalid-encoding.json"
        path.write_bytes(b"\xff\xfe")

        with self.assertRaises(JsonFileError):
            load_json_file(path)

    def test_does_not_modify_source_file(self) -> None:
        path = self.root / "data.json"
        original = '{"status":"active"}'
        path.write_text(original, encoding="utf-8")

        load_json_file(path)

        self.assertEqual(path.read_text(encoding="utf-8"), original)


# ---------------------------------------------------------------------------
# Serialization tests
# ---------------------------------------------------------------------------


class TestJsonSerialization(unittest.TestCase):
    """Verify strict JSON serialization and round-trip behavior."""

    def test_serializes_object(self) -> None:
        self.assertEqual(
            json.loads(serialize_json({"active": True})),
            {"active": True},
        )

    def test_serializes_unicode(self) -> None:
        output = serialize_json({"name": "नमस्ते"})
        self.assertIn("नमस्ते", output)

    def test_supports_compact_serialization(self) -> None:
        self.assertEqual(
            serialize_json({"a": 1}, indent=None),
            '{"a": 1}',
        )

    def test_rejects_non_serializable_object(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({"path": Path("data.json")})

    def test_rejects_nan(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({"value": math.nan})

    def test_rejects_infinity(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({"value": math.inf})

    def test_rejects_negative_indent(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({}, indent=-1)

    def test_rejects_boolean_indent(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({}, indent=True)

    def test_rejects_non_boolean_ascii_setting(self) -> None:
        with self.assertRaises(JsonDataError):
            serialize_json({}, ensure_ascii=1)  # type: ignore[arg-type]

    def test_round_trip_preserves_nested_data(self) -> None:
        original = {
            "metadata": {"schemaVersion": "1.0.0"},
            "courses": ["MBBS", "BDS", "BAMS"],
            "enabled": True,
            "optional": None,
            "count": 0,
        }

        self.assertEqual(
            parse_json(serialize_json(original)),
            original,
        )


# ---------------------------------------------------------------------------
# Object and required-key validation tests
# ---------------------------------------------------------------------------


class TestJsonObjectValidation(unittest.TestCase):
    """Verify top-level object and required-key rules."""

    def test_accepts_dictionary(self) -> None:
        payload = {"name": "MedOrbits"}
        self.assertEqual(validate_json_object(payload), payload)

    def test_rejects_array_as_top_level_object(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_json_object([])

    def test_rejects_none_as_top_level_object(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_json_object(None)

    def test_accepts_all_required_keys(self) -> None:
        payload = {"id": "C001", "name": "MBBS"}
        self.assertEqual(validate_required_keys(payload, {"id", "name"}), payload)

    def test_rejects_missing_required_key(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_required_keys({"id": "C001"}, {"id", "name"})

    def test_rejects_none_required_value(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_required_keys({"name": None}, {"name"})

    def test_rejects_blank_required_value(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_required_keys({"name": "   "}, {"name"})

    def test_accepts_zero_as_valid_value(self) -> None:
        self.assertEqual(validate_required_keys({"count": 0}, {"count"}),
                         {"count": 0})

    def test_accepts_false_as_valid_value(self) -> None:
        self.assertEqual(validate_required_keys({"enabled": False}, {"enabled"}),
                         {"enabled": False})

    def test_rejects_string_instead_of_key_collection(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_required_keys({"name": "A"}, "name")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# Field-type validation tests
# ---------------------------------------------------------------------------


class TestJsonFieldTypes(unittest.TestCase):
    """Verify required field types and boolean/integer distinction."""

    def test_accepts_expected_types(self) -> None:
        payload = {"name": "MBBS", "active": True, "count": 5}
        result = validate_field_types(
            payload,
            {"name": str, "active": bool, "count": int},
        )
        self.assertEqual(result, payload)

    def test_rejects_wrong_string_type(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_field_types({"name": 10}, {"name": str})

    def test_rejects_boolean_for_integer_field(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_field_types({"count": True}, {"count": int})

    def test_accepts_boolean_when_explicitly_expected(self) -> None:
        self.assertEqual(
            validate_field_types({"active": True}, {"active": bool}),
            {"active": True},
        )

    def test_rejects_missing_field(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_field_types({}, {"name": str})

    def test_accepts_tuple_of_types(self) -> None:
        result = validate_field_types(
            {"score": 10.5},
            {"score": (int, float)},
        )
        self.assertEqual(result["score"], 10.5)

    def test_rejects_non_object_input(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_field_types([], {"name": str})


# ---------------------------------------------------------------------------
# JSON compatibility tests
# ---------------------------------------------------------------------------


class TestJsonCompatibility(unittest.TestCase):
    """Reject values that standard JSON cannot represent safely."""

    def test_accepts_nested_json_data(self) -> None:
        payload = {"items": [{"id": 1}, {"id": 2}]}
        self.assertEqual(validate_json_compatible(payload), payload)

    def test_rejects_path_object(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_json_compatible({"path": Path("file.json")})

    def test_rejects_non_finite_number(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_json_compatible({"value": math.nan})

    def test_accepts_null(self) -> None:
        self.assertIsNone(validate_json_compatible(None))

    def test_accepts_unicode(self) -> None:
        payload = {"message": "नमस्ते"}
        self.assertEqual(validate_json_compatible(payload), payload)


# ---------------------------------------------------------------------------
# List and identifier validation tests
# ---------------------------------------------------------------------------


class TestJsonStringLists(unittest.TestCase):
    """Verify list fields contain non-empty strings."""

    def test_accepts_string_list(self) -> None:
        payload = {"languages": ["English", "Hindi"]}
        self.assertEqual(
            validate_string_list(payload, field="languages"),
            ["English", "Hindi"],
        )

    def test_accepts_empty_list(self) -> None:
        self.assertEqual(
            validate_string_list({"languages": []}, field="languages"),
            [],
        )

    def test_rejects_missing_list_field(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_string_list({}, field="languages")

    def test_rejects_string_instead_of_list(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_string_list({"languages": "English"}, field="languages")

    def test_rejects_empty_string_item(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_string_list({"languages": ["English", " "]},
                                 field="languages")

    def test_rejects_non_string_item(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_string_list({"languages": ["English", 10]},
                                 field="languages")


class TestUniqueIdentifiers(unittest.TestCase):
    """Verify identifiers exist and remain unique within a dataset."""

    def test_accepts_unique_ids(self) -> None:
        records = [{"id": "C001"}, {"id": "C002"}]
        self.assertEqual(validate_unique_ids(records), records)

    def test_accepts_empty_dataset(self) -> None:
        self.assertEqual(validate_unique_ids([]), [])

    def test_rejects_duplicate_ids(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_unique_ids([{"id": "C001"}, {"id": "C001"}])

    def test_rejects_missing_id(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_unique_ids([{"name": "MBBS"}])

    def test_rejects_blank_id(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_unique_ids([{"id": " "}])

    def test_rejects_non_string_id(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_unique_ids([{"id": 123}])

    def test_supports_custom_id_field(self) -> None:
        records = [{"courseCode": "MBBS"}, {"courseCode": "BDS"}]
        self.assertEqual(
            validate_unique_ids(records, id_field="courseCode"),
            records,
        )

    def test_rejects_non_object_record(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_unique_ids(["invalid"])  # type: ignore[list-item]


# ---------------------------------------------------------------------------
# Numeric data validation tests
# ---------------------------------------------------------------------------


class TestNonNegativeNumbers(unittest.TestCase):
    """Verify finite, non-negative numeric fields."""

    def test_accepts_zero(self) -> None:
        self.assertEqual(
            validate_non_negative_number({"fees": 0}, field="fees"),
            0,
        )

    def test_accepts_positive_integer(self) -> None:
        self.assertEqual(
            validate_non_negative_number({"fees": 5000}, field="fees"),
            5000,
        )

    def test_accepts_positive_float(self) -> None:
        self.assertEqual(
            validate_non_negative_number({"rating": 4.5}, field="rating"),
            4.5,
        )

    def test_rejects_negative_value(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({"fees": -1}, field="fees")

    def test_rejects_boolean(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({"fees": True}, field="fees")

    def test_rejects_nan(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({"fees": math.nan}, field="fees")

    def test_rejects_infinity(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({"fees": math.inf}, field="fees")

    def test_rejects_missing_field(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({}, field="fees")

    def test_rejects_numeric_string(self) -> None:
        with self.assertRaises(JsonSchemaError):
            validate_non_negative_number({"fees": "5000"}, field="fees")


if __name__ == "__main__":
    unittest.main(verbosity=2)