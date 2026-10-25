# /python/tests/test_import_export.py
"""
MedOrbits -- Import/Export Unit Tests
====================================

Purpose:
    Test JSON and text import/export workflows, serialization integrity,
    invalid input handling, file safety, and round-trip consistency.

Framework:
    Python standard-library unittest.

Dependencies:
    Python 3.10+ recommended. No third-party packages required.

Run from the repository root:
    python -m unittest discover -s python/tests -p "test_import_export.py" -v

Important:
    These tests exercise a self-contained reference implementation. To test
    the actual MedOrbits application, connect the tests to its production
    import/export module and public functions.
"""

from __future__ import annotations

import csv
import io
import json
import math
import os
import tempfile
import unittest

from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Domain-specific exceptions
# ---------------------------------------------------------------------------


class ImportExportError(ValueError):
    """Base exception for import/export failures."""


class ImportFormatError(ImportExportError):
    """Raised when imported data has an invalid or unsupported format."""


class ExportFormatError(ImportExportError):
    """Raised when data cannot be exported to the requested format."""


class FileOperationError(ImportExportError):
    """Raised when a file operation fails."""


# ---------------------------------------------------------------------------
# Reference implementation
# Replace these helpers with imports from the production module when known.
# ---------------------------------------------------------------------------


SUPPORTED_FORMATS = frozenset({"json", "csv", "txt"})


def _validate_format(format_name: str) -> str:
    """Validate and normalize a supported export/import format."""
    if not isinstance(format_name, str):
        raise ImportExportError("format must be a string")

    normalized = format_name.strip().lower()

    if normalized not in SUPPORTED_FORMATS:
        raise ImportExportError(
            f"Unsupported format: {normalized or '<empty>'}"
        )

    return normalized


def import_json(source: str | bytes | bytearray) -> Any:
    """
    Parse JSON from a string or bytes.

    JSON syntax is validated by the standard-library parser. Top-level JSON
    values may be objects, arrays, strings, numbers, booleans, or null.
    """
    if isinstance(source, (bytes, bytearray)):
        try:
            source = bytes(source).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ImportFormatError("JSON input must be UTF-8 encoded") from exc

    if not isinstance(source, str):
        raise ImportFormatError("JSON source must be text or UTF-8 bytes")

    try:
        return json.loads(source)
    except json.JSONDecodeError as exc:
        raise ImportFormatError(
            f"Invalid JSON at line {exc.lineno}, column {exc.colno}"
        ) from exc


def export_json(
    data: Any,
    *,
    indent: int | None = 2,
    ensure_ascii: bool = False,
) -> str:
    """Serialize JSON-compatible data into a deterministic JSON string."""
    if indent is not None and (
        isinstance(indent, bool) or not isinstance(indent, int) or indent < 0
    ):
        raise ExportFormatError("indent must be a non-negative integer or None")

    if not isinstance(ensure_ascii, bool):
        raise ExportFormatError("ensure_ascii must be a boolean")

    try:
        return json.dumps(
            data,
            indent=indent,
            ensure_ascii=ensure_ascii,
            allow_nan=False,
        )
    except (TypeError, ValueError, OverflowError) as exc:
        raise ExportFormatError("Data cannot be serialized as valid JSON") from exc


def import_csv(
    source: str,
    *,
    delimiter: str = ",",
) -> list[dict[str, str]]:
    """
    Import CSV text as dictionaries using the first row as field names.

    Duplicate, empty, or whitespace-only column names are rejected to avoid
    ambiguous or silently overwritten fields.
    """
    if not isinstance(source, str):
        raise ImportFormatError("CSV source must be text")

    if not isinstance(delimiter, str) or len(delimiter) != 1:
        raise ImportFormatError("CSV delimiter must be one character")

    try:
        reader = csv.DictReader(io.StringIO(source, newline=""), delimiter=delimiter)

        if reader.fieldnames is None:
            raise ImportFormatError("CSV input must include a header row")

        headers = reader.fieldnames

        if not headers:
            raise ImportFormatError("CSV header row must not be empty")

        if any(not isinstance(header, str) or not header.strip() for header in headers):
            raise ImportFormatError("CSV column names must not be empty")

        if len(set(headers)) != len(headers):
            raise ImportFormatError("CSV column names must be unique")

        records: list[dict[str, str]] = []

        for row in reader:
            if None in row:
                raise ImportFormatError("CSV row contains more values than headers")

            if any(value is None for value in row.values()):
                raise ImportFormatError("CSV row contains fewer values than headers")

            records.append(dict(row))

        return records

    except csv.Error as exc:
        raise ImportFormatError("CSV input is malformed") from exc


def export_csv(
    records: list[dict[str, Any]],
    *,
    fieldnames: list[str] | None = None,
    delimiter: str = ",",
) -> str:
    """
    Export a list of dictionaries to CSV.

    Values are converted to strings by csv.DictWriter, following standard
    library behavior. Nested dictionaries and lists should be serialized
    explicitly before export if structured JSON values are required.
    """
    if not isinstance(records, list):
        raise ExportFormatError("CSV data must be a list of dictionaries")

    if any(not isinstance(record, dict) for record in records):
        raise ExportFormatError("Every CSV record must be a dictionary")

    if not isinstance(delimiter, str) or len(delimiter) != 1:
        raise ExportFormatError("CSV delimiter must be one character")

    if fieldnames is None:
        fieldnames = list(records[0].keys()) if records else []

    if not isinstance(fieldnames, list) or any(
        not isinstance(name, str) or not name for name in fieldnames
    ):
        raise ExportFormatError("CSV field names must be non-empty strings")

    if len(set(fieldnames)) != len(fieldnames):
        raise ExportFormatError("CSV field names must be unique")

    for record in records:
        unexpected = set(record) - set(fieldnames)
        if unexpected:
            raise ExportFormatError(
                "Record contains fields absent from CSV headers: "
                + ", ".join(sorted(unexpected))
            )

    if not fieldnames and records:
        raise ExportFormatError("CSV field names are required")

    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(
        buffer,
        fieldnames=fieldnames,
        delimiter=delimiter,
        extrasaction="raise",
        lineterminator="\n",
    )

    if fieldnames:
        writer.writeheader()
        writer.writerows(records)

    return buffer.getvalue()


def import_text(source: str, *, strip: bool = False) -> str:
    """Import plain text, optionally removing surrounding whitespace."""
    if not isinstance(source, str):
        raise ImportFormatError("Text source must be a string")

    return source.strip() if strip else source


def export_text(data: Any) -> str:
    """Export a string without implicit formatting or serialization."""
    if not isinstance(data, str):
        raise ExportFormatError("Text export requires a string")

    return data


def import_file(
    path: str | os.PathLike[str],
    *,
    format_name: str,
) -> Any:
    """Read a file as UTF-8 and parse it according to the specified format."""
    fmt = _validate_format(format_name)
    file_path = Path(path)

    try:
        source = file_path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise FileOperationError(f"Unable to read import file: {file_path.name}") from exc

    if fmt == "json":
        return import_json(source)
    if fmt == "csv":
        return import_csv(source)
    return import_text(source)


def export_file(
    path: str | os.PathLike[str],
    data: Any,
    *,
    format_name: str,
) -> Path:
    """
    Serialize data and write it as UTF-8.

    The parent directory must already exist. The target file is written
    directly; use a temporary file plus atomic replacement in production
    workflows that require crash-safe updates.
    """
    fmt = _validate_format(format_name)
    file_path = Path(path)

    if fmt == "json":
        content = export_json(data)
    elif fmt == "csv":
        content = export_csv(data)
    else:
        content = export_text(data)

    try:
        file_path.write_text(content, encoding="utf-8", newline="")
    except (OSError, UnicodeError) as exc:
        raise FileOperationError(f"Unable to write export file: {file_path.name}") from exc

    return file_path


# ---------------------------------------------------------------------------
# JSON import tests
# ---------------------------------------------------------------------------


class TestJsonImport(unittest.TestCase):
    """Verify JSON parsing and malformed-input behavior."""

    def test_imports_json_object(self) -> None:
        self.assertEqual(
            import_json('{"course": "MBBS", "active": true}'),
            {"course": "MBBS", "active": True},
        )

    def test_imports_json_array(self) -> None:
        self.assertEqual(import_json('[1, 2, 3]'), [1, 2, 3])

    def test_imports_json_string(self) -> None:
        self.assertEqual(import_json('"MedOrbits"'), "MedOrbits")

    def test_imports_json_number(self) -> None:
        self.assertEqual(import_json("42"), 42)

    def test_imports_json_boolean(self) -> None:
        self.assertIs(import_json("true"), True)

    def test_imports_json_null(self) -> None:
        self.assertIsNone(import_json("null"))

    def test_imports_utf8_bytes(self) -> None:
        self.assertEqual(import_json('{"name":"विद्यार्थी"}'.encode("utf-8")),
                         {"name": "विद्यार्थी"})

    def test_rejects_invalid_utf8(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_json(b"\xff\xfe")

    def test_rejects_malformed_json(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_json('{"course":')

    def test_rejects_trailing_comma(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_json('{"course": "MBBS",}')

    def test_rejects_non_string_source(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_json(123)  # type: ignore[arg-type]

    def test_accepts_nested_json(self) -> None:
        source = '{"student":{"name":"A","scores":[80,90]}}'
        self.assertEqual(
            import_json(source),
            {"student": {"name": "A", "scores": [80, 90]}},
        )


# ---------------------------------------------------------------------------
# JSON export tests
# ---------------------------------------------------------------------------


class TestJsonExport(unittest.TestCase):
    """Verify JSON serialization and export constraints."""

    def test_exports_dictionary(self) -> None:
        output = export_json({"course": "MBBS"})
        self.assertEqual(json.loads(output), {"course": "MBBS"})

    def test_exports_unicode_without_ascii_escaping(self) -> None:
        output = export_json({"name": "विद्यार्थी"})
        self.assertIn("विद्यार्थी", output)

    def test_supports_compact_output(self) -> None:
        self.assertEqual(export_json({"a": 1}, indent=None), '{"a": 1}')

    def test_supports_empty_object(self) -> None:
        self.assertEqual(json.loads(export_json({})), {})

    def test_preserves_boolean_and_null_types(self) -> None:
        result = json.loads(export_json({"active": False, "value": None}))
        self.assertIs(result["active"], False)
        self.assertIsNone(result["value"])

    def test_rejects_unserializable_object(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"path": Path("file.txt")})

    def test_rejects_nan(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"score": math.nan})

    def test_rejects_infinity(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"score": math.inf})

    def test_rejects_negative_indent(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"a": 1}, indent=-1)

    def test_rejects_boolean_indent(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"a": 1}, indent=True)

    def test_rejects_non_boolean_ensure_ascii(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_json({"a": 1}, ensure_ascii="yes")  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# CSV import tests
# ---------------------------------------------------------------------------


class TestCsvImport(unittest.TestCase):
    """Verify CSV headers, values, and malformed row handling."""

    def test_imports_single_record(self) -> None:
        self.assertEqual(
            import_csv("name,course\nA,MBBS\n"),
            [{"name": "A", "course": "MBBS"}],
        )

    def test_imports_multiple_records(self) -> None:
        result = import_csv("id,name\n1,A\n2,B\n")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[1]["name"], "B")

    def test_imports_header_only_csv(self) -> None:
        self.assertEqual(import_csv("id,name\n"), [])

    def test_imports_quoted_commas(self) -> None:
        result = import_csv('name,description\nA,"Admissions, guidance"\n')
        self.assertEqual(result[0]["description"], "Admissions, guidance")

    def test_imports_escaped_quotes(self) -> None:
        result = import_csv('name\n"Med ""Orbits"""\n')
        self.assertEqual(result[0]["name"], 'Med "Orbits"')

    def test_supports_custom_delimiter(self) -> None:
        self.assertEqual(
            import_csv("id;course\n1;MBBS\n", delimiter=";"),
            [{"id": "1", "course": "MBBS"}],
        )

    def test_rejects_non_string_source(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv(None)  # type: ignore[arg-type]

    def test_rejects_invalid_delimiter(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("a,b\n1,2\n", delimiter="::")

    def test_rejects_duplicate_headers(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("id,id\n1,2\n")

    def test_rejects_empty_header(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("id,\n1,2\n")

    def test_rejects_extra_values(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("id,name\n1,A,unexpected\n")

    def test_rejects_missing_values(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("id,name\n1\n")

    def test_rejects_empty_input_without_header(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_csv("")


# ---------------------------------------------------------------------------
# CSV export tests
# ---------------------------------------------------------------------------


class TestCsvExport(unittest.TestCase):
    """Verify CSV serialization and header consistency."""

    def test_exports_records(self) -> None:
        output = export_csv([{"id": "1", "name": "A"}])
        self.assertEqual(output, "id,name\n1,A\n")

    def test_exports_empty_values(self) -> None:
        output = export_csv([{"id": "1", "name": ""}])
        self.assertEqual(import_csv(output), [{"id": "1", "name": ""}])

    def test_quotes_commas_correctly(self) -> None:
        output = export_csv([{"name": "A", "description": "one, two"}])
        self.assertEqual(
            import_csv(output),
            [{"name": "A", "description": "one, two"}],
        )

    def test_exports_unicode(self) -> None:
        output = export_csv([{"name": "विद्यार्थी"}])
        self.assertIn("विद्यार्थी", output)

    def test_supports_custom_field_order(self) -> None:
        output = export_csv(
            [{"id": "1", "name": "A"}],
            fieldnames=["name", "id"],
        )
        self.assertEqual(output, "name,id\nA,1\n")

    def test_supports_custom_delimiter(self) -> None:
        output = export_csv([{"id": "1", "name": "A"}], delimiter=";")
        self.assertEqual(import_csv(output, delimiter=";"), [{"id": "1", "name": "A"}])

    def test_rejects_non_list_input(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_csv({"id": "1"})  # type: ignore[arg-type]

    def test_rejects_non_dictionary_record(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_csv(["invalid"])  # type: ignore[list-item]

    def test_rejects_unexpected_record_field(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_csv([{"id": "1", "extra": "x"}], fieldnames=["id"])

    def test_rejects_duplicate_fieldnames(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_csv([{"id": "1"}], fieldnames=["id", "id"])

    def test_rejects_empty_fieldname(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_csv([{"": "1"}], fieldnames=[""])

    def test_empty_record_list_exports_empty_text(self) -> None:
        self.assertEqual(export_csv([]), "")


# ---------------------------------------------------------------------------
# Plain-text import/export tests
# ---------------------------------------------------------------------------


class TestTextImportExport(unittest.TestCase):
    """Verify plain-text behavior without implicit data transformation."""

    def test_import_preserves_whitespace_by_default(self) -> None:
        self.assertEqual(import_text("  MedOrbits\n"), "  MedOrbits\n")

    def test_import_can_strip_whitespace(self) -> None:
        self.assertEqual(import_text("  MedOrbits\n", strip=True), "MedOrbits")

    def test_import_preserves_unicode(self) -> None:
        self.assertEqual(import_text("नमस्ते"), "नमस्ते")

    def test_rejects_non_string_input(self) -> None:
        with self.assertRaises(ImportFormatError):
            import_text(100)  # type: ignore[arg-type]

    def test_export_preserves_text(self) -> None:
        self.assertEqual(export_text("Line 1\nLine 2"), "Line 1\nLine 2")

    def test_export_rejects_non_string_input(self) -> None:
        with self.assertRaises(ExportFormatError):
            export_text({"key": "value"})


# ---------------------------------------------------------------------------
# File-operation tests
# ---------------------------------------------------------------------------


class TestFileImportExport(unittest.TestCase):
    """Test UTF-8 file round trips using isolated temporary directories."""

    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_directory.cleanup)
        self.root = Path(self.temp_directory.name)

    def test_exports_and_imports_json_file(self) -> None:
        path = self.root / "data.json"
        payload = {"course": "MBBS", "active": True}

        export_file(path, payload, format_name="json")

        self.assertEqual(import_file(path, format_name="json"), payload)

    def test_exports_and_imports_csv_file(self) -> None:
        path = self.root / "data.csv"
        records = [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}]

        export_file(path, records, format_name="csv")

        self.assertEqual(import_file(path, format_name="csv"), records)

    def test_exports_and_imports_text_file(self) -> None:
        path = self.root / "notes.txt"
        content = "MedOrbits support\nUnicode: नमस्ते\n"

        export_file(path, content, format_name="txt")

        self.assertEqual(import_file(path, format_name="txt"), content)

    def test_preserves_unicode_in_json_file(self) -> None:
        path = self.root / "unicode.json"
        payload = {"name": "विद्यार्थी"}

        export_file(path, payload, format_name="json")

        self.assertEqual(import_file(path, format_name="json"), payload)

    def test_rejects_unsupported_import_format(self) -> None:
        path = self.root / "data.xml"
        path.write_text("<data />", encoding="utf-8")

        with self.assertRaises(ImportExportError):
            import_file(path, format_name="xml")

    def test_rejects_unsupported_export_format(self) -> None:
        with self.assertRaises(ImportExportError):
            export_file(self.root / "data.xml", "<data />", format_name="xml")

    def test_missing_file_raises_safe_error(self) -> None:
        with self.assertRaises(FileOperationError):
            import_file(self.root / "missing.json", format_name="json")

    def test_invalid_utf8_file_raises_safe_error(self) -> None:
        path = self.root / "invalid.json"
        path.write_bytes(b"\xff\xfe")

        with self.assertRaises(FileOperationError):
            import_file(path, format_name="json")

    def test_missing_parent_directory_raises_safe_error(self) -> None:
        path = self.root / "missing" / "data.json"

        with self.assertRaises(FileOperationError):
            export_file(path, {"a": 1}, format_name="json")

    def test_export_returns_target_path(self) -> None:
        path = self.root / "data.json"
        result = export_file(path, {"a": 1}, format_name="json")

        self.assertEqual(result, path)
        self.assertTrue(path.is_file())

    def test_does_not_create_unrequested_parent_directories(self) -> None:
        path = self.root / "new-folder" / "data.json"

        with self.assertRaises(FileOperationError):
            export_file(path, {"a": 1}, format_name="json")

        self.assertFalse(path.parent.exists())


# ---------------------------------------------------------------------------
# Format handling and round-trip integrity
# ---------------------------------------------------------------------------


class TestFormatValidation(unittest.TestCase):
    """Verify format normalization and rejection of invalid format names."""

    def test_normalizes_uppercase_format(self) -> None:
        self.assertEqual(_validate_format("JSON"), "json")

    def test_trims_format_whitespace(self) -> None:
        self.assertEqual(_validate_format(" csv "), "csv")

    def test_rejects_empty_format(self) -> None:
        with self.assertRaises(ImportExportError):
            _validate_format("")

    def test_rejects_unknown_format(self) -> None:
        with self.assertRaises(ImportExportError):
            _validate_format("yaml")

    def test_rejects_non_string_format(self) -> None:
        with self.assertRaises(ImportExportError):
            _validate_format(None)  # type: ignore[arg-type]


class TestRoundTripIntegrity(unittest.TestCase):
    """Verify representative datasets survive supported round trips."""

    def test_json_round_trip_preserves_nested_data(self) -> None:
        original = {
            "schemaVersion": "1.0.0",
            "course": {"name": "MBBS", "active": True},
            "fees": [1000, 2500, 5000],
            "optional": None,
        }

        restored = import_json(export_json(original))

        self.assertEqual(restored, original)

    def test_csv_round_trip_preserves_string_records(self) -> None:
        original = [
            {"id": "001", "name": "A, Student"},
            {"id": "002", "name": 'B "Student"'},
        ]

        restored = import_csv(export_csv(original))

        self.assertEqual(restored, original)

    def test_csv_preserves_leading_zeroes(self) -> None:
        original = [{"postal_code": "001234"}]

        restored = import_csv(export_csv(original))

        self.assertEqual(restored, original)

    def test_empty_string_remains_empty_string_in_json(self) -> None:
        original = {"name": ""}

        self.assertEqual(import_json(export_json(original)), original)

    def test_json_output_is_parseable(self) -> None:
        output = export_json({"items": [1, 2, 3]})

        # The standard JSON parser must accept every successful export.
        json.loads(output)


if __name__ == "__main__":
    unittest.main(verbosity=2)