
"""
MedOrbits -- Data Import Utilities

File: src/python/medorbits/data_import.py

Purpose:
    Parse and validate CSV, JSON arrays, and JSON Lines for MedOrbits.

Security:
    - Treat all imported data as untrusted.
    - Authorize uploads before parsing.
    - Never execute imported values or interpolate them into SQL.
    - Apply business validation before persisting records.
    - Avoid logging imported rows, personal data, or secrets.
    - This module does not write to a database or access the filesystem.
"""

from __future__ import annotations

import csv
import io
import json
import math
from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Final, TextIO


SUPPORTED_IMPORT_FORMATS: Final[frozenset[str]] = frozenset(
    {"csv", "json", "jsonl"}
)

DEFAULT_MAX_FILE_BYTES: Final[int] = 10 * 1024 * 1024
DEFAULT_MAX_ROWS: Final[int] = 100_000
DEFAULT_MAX_COLUMNS: Final[int] = 200
DEFAULT_MAX_FIELD_CHARS: Final[int] = 1_000_000
DEFAULT_MAX_JSON_DEPTH: Final[int] = 64


class ImportErrorBase(ValueError):
    """Base exception for data-import errors."""


class ImportFormatError(ImportErrorBase):
    """Raised when an import format or document structure is invalid."""


class ImportLimitError(ImportErrorBase):
    """Raised when input exceeds configured resource limits."""


class ImportValidationError(ImportErrorBase):
    """Raised when imported records fail validation."""


@dataclass(frozen=True, slots=True)
class ImportOptions:
    """Immutable, validated options for importing data."""

    format: str = "csv"
    max_file_bytes: int = DEFAULT_MAX_FILE_BYTES
    max_rows: int = DEFAULT_MAX_ROWS
    max_columns: int = DEFAULT_MAX_COLUMNS
    max_field_chars: int = DEFAULT_MAX_FIELD_CHARS
    max_json_depth: int = DEFAULT_MAX_JSON_DEPTH
    required_columns: tuple[str, ...] = ()
    allowed_columns: tuple[str, ...] | None = None
    reject_unknown_columns: bool = True
    allow_empty_values: bool = True
    skip_blank_rows: bool = True
    strip_values: bool = False

    def __post_init__(self) -> None:
        if not isinstance(self.format, str):
            raise ImportFormatError("Import format must be a string.")

        normalized_format = self.format.strip().lower()

        if normalized_format not in SUPPORTED_IMPORT_FORMATS:
            raise ImportFormatError(
                "Import format must be csv, json, or jsonl."
            )

        object.__setattr__(self, "format", normalized_format)

        limits = (
            ("max_file_bytes", self.max_file_bytes, 1024 * 1024 * 1024),
            ("max_rows", self.max_rows, 10_000_000),
            ("max_columns", self.max_columns, 10_000),
            ("max_field_chars", self.max_field_chars, 10_000_000),
            ("max_json_depth", self.max_json_depth, 256),
        )

        for name, value, maximum in limits:
            if (
                not isinstance(value, int)
                or isinstance(value, bool)
                or not 1 <= value <= maximum
            ):
                raise ImportLimitError(
                    f"{name} must be an integer between 1 and {maximum}."
                )

        for name, value in (
            ("reject_unknown_columns", self.reject_unknown_columns),
            ("allow_empty_values", self.allow_empty_values),
            ("skip_blank_rows", self.skip_blank_rows),
            ("strip_values", self.strip_values),
        ):
            if not isinstance(value, bool):
                raise ImportFormatError(f"{name} must be a boolean.")

        self._validate_column_options(
            "required_columns",
            self.required_columns,
        )

        if self.allowed_columns is not None:
            self._validate_column_options(
                "allowed_columns",
                self.allowed_columns,
            )

            if not self.allowed_columns:
                raise ImportFormatError(
                    "allowed_columns cannot be empty when specified."
                )

            if len(self.allowed_columns) > self.max_columns:
                raise ImportLimitError(
                    "allowed_columns exceeds max_columns."
                )

            if not set(self.required_columns).issubset(
                set(self.allowed_columns)
            ):
                raise ImportFormatError(
                    "required_columns must be included in allowed_columns."
                )

    @staticmethod
    def _validate_column_options(
        name: str,
        columns: tuple[str, ...],
    ) -> None:
        if not isinstance(columns, tuple):
            raise ImportFormatError(f"{name} must be a tuple.")

        if any(
            not isinstance(column, str)
            or not column
            or column.strip() != column
            for column in columns
        ):
            raise ImportFormatError(
                f"{name} must contain non-empty trimmed strings."
            )

        if len(set(columns)) != len(columns):
            raise ImportFormatError(
                f"{name} must not contain duplicates."
            )


def _check_size(data: bytes | str, options: ImportOptions) -> None:
    """Enforce the input byte limit."""
    if isinstance(data, bytes):
        size = len(data)
    else:
        size = len(data.encode("utf-8"))

    if size > options.max_file_bytes:
        raise ImportLimitError(
            f"Input exceeds the configured {options.max_file_bytes}-byte limit."
        )


def _decode_utf8(data: bytes) -> str:
    """Decode UTF-8 input while accepting an optional UTF-8 BOM."""
    try:
        return data.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        raise ImportFormatError(
            "Input must be valid UTF-8 text."
        ) from exc


def _check_json_depth(value: Any, maximum: int) -> None:
    """Reject excessive nesting after JSON decoding."""
    stack: list[tuple[Any, int]] = [(value, 1)]

    while stack:
        current, depth = stack.pop()

        if depth > maximum:
            raise ImportLimitError(
                f"JSON nesting exceeds the maximum depth of {maximum}."
            )

        if isinstance(current, dict):
            stack.extend(
                (item, depth + 1)
                for item in current.values()
            )
        elif isinstance(current, list):
            stack.extend(
                (item, depth + 1)
                for item in current
            )


def _reject_duplicate_keys(
    pairs: list[tuple[str, Any]],
) -> dict[str, Any]:
    """Reject duplicate keys in JSON objects."""
    result: dict[str, Any] = {}

    for key, value in pairs:
        if key in result:
            raise ImportFormatError(
                "JSON input contains duplicate object keys."
            )
        result[key] = value

    return result


def _reject_non_finite_constant(value: str) -> None:
    """Reject non-standard JSON NaN and Infinity constants."""
    raise ImportFormatError(
        f"JSON input contains unsupported numeric constant: {value}."
    )


def _parse_json(text: str, options: ImportOptions) -> Any:
    """Parse strict JSON and enforce structural limits."""
    try:
        value = json.loads(
            text,
            object_pairs_hook=_reject_duplicate_keys,
            parse_constant=_reject_non_finite_constant,
            parse_float=Decimal,
        )
    except ImportFormatError:
        raise
    except (json.JSONDecodeError, RecursionError, ValueError) as exc:
        raise ImportFormatError("Input contains invalid JSON.") from exc

    _check_json_depth(value, options.max_json_depth)
    _check_json_value_limits(value, options)
    return value


def _check_json_value_limits(
    value: Any,
    options: ImportOptions,
) -> None:
    """Validate nested JSON value sizes and numeric finiteness."""
    stack = [value]

    while stack:
        current = stack.pop()

        if isinstance(current, str):
            if len(current) > options.max_field_chars:
                raise ImportLimitError(
                    "JSON contains a string exceeding max_field_chars."
                )

        elif isinstance(current, Decimal):
            if not current.is_finite():
                raise ImportFormatError(
                    "JSON contains a non-finite numeric value."
                )

        elif isinstance(current, float):
            if not math.isfinite(current):
                raise ImportFormatError(
                    "JSON contains a non-finite numeric value."
                )

        elif isinstance(current, dict):
            if len(current) > options.max_columns:
                raise ImportLimitError(
                    "A JSON object exceeds max_columns."
                )

            for key, item in current.items():
                if len(key) > options.max_field_chars:
                    raise ImportLimitError(
                        "A JSON object key exceeds max_field_chars."
                    )
                stack.append(item)

        elif isinstance(current, list):
            stack.extend(current)


def _normalize_record(
    record: Mapping[str, Any],
    options: ImportOptions,
    row_number: int,
) -> dict[str, Any]:
    """Validate record keys and return an independent dictionary."""
    if not isinstance(record, Mapping):
        raise ImportFormatError(
            f"Record {row_number} must be an object or mapping."
        )

    if len(record) > options.max_columns:
        raise ImportLimitError(
            f"Record {row_number} exceeds max_columns."
        )

    normalized: dict[str, Any] = {}

    for key, value in record.items():
        if not isinstance(key, str) or not key:
            raise ImportFormatError(
                f"Record {row_number} contains an invalid column name."
            )

        if key.strip() != key:
            raise ImportFormatError(
                f"Record {row_number} contains a column name with "
                "surrounding whitespace."
            )

        if len(key) > options.max_field_chars:
            raise ImportLimitError(
                f"Record {row_number} contains an oversized column name."
            )

        if key in normalized:
            raise ImportFormatError(
                f"Record {row_number} contains duplicate column names."
            )

        normalized[key] = value

    return normalized


def _validate_columns(
    columns: tuple[str, ...],
    options: ImportOptions,
) -> None:
    """Validate schema, required columns, and the configured allowlist."""
    if not columns:
        raise ImportFormatError("The import contains no columns.")

    if len(columns) > options.max_columns:
        raise ImportLimitError("Import exceeds max_columns.")

    if any(not column for column in columns):
        raise ImportFormatError("Import contains an empty column name.")

    if len(set(columns)) != len(columns):
        raise ImportFormatError(
            "Import contains duplicate column names."
        )

    if any(len(column) > options.max_field_chars for column in columns):
        raise ImportLimitError(
            "An import column name exceeds max_field_chars."
        )

    missing = set(options.required_columns) - set(columns)

    if missing:
        raise ImportValidationError(
            "Import is missing one or more required columns."
        )

    if options.allowed_columns is not None:
        unknown = set(columns) - set(options.allowed_columns)

        if unknown and options.reject_unknown_columns:
            raise ImportValidationError(
                "Import contains columns that are not permitted."
            )


def _validate_values(
    record: dict[str, Any],
    options: ImportOptions,
    row_number: int,
) -> dict[str, Any]:
    """Validate field sizes and optionally normalize string values."""
    for key, value in record.items():
        if isinstance(value, str):
            if len(value) > options.max_field_chars:
                raise ImportLimitError(
                    f"Record {row_number} contains an oversized value."
                )

            if options.strip_values:
                value = value.strip()
                record[key] = value

            if not options.allow_empty_values and value == "":
                raise ImportValidationError(
                    f"Record {row_number} contains an empty value."
                )

        elif value is None and not options.allow_empty_values:
            raise ImportValidationError(
                f"Record {row_number} contains a null value."
            )

    return record


def _iter_csv_text(
    text: str,
    options: ImportOptions,
) -> Iterator[dict[str, Any]]:
    """Parse CSV records with strict row and column validation."""
    stream = io.StringIO(text, newline="")

    try:
        reader = csv.reader(
            stream,
            dialect="excel",
            strict=True,
        )

        header: tuple[str, ...] | None = None
        row_number = 0

        for row in reader:
            if options.skip_blank_rows and (
                not row or all(value == "" for value in row)
            ):
                continue

            if any(len(value) > options.max_field_chars for value in row):
                raise ImportLimitError(
                    "A CSV field exceeds max_field_chars."
                )

            if header is None:
                header = tuple(row)

                if any(column.strip() != column for column in header):
                    raise ImportFormatError(
                        "CSV headers must not contain surrounding whitespace."
                    )

                _validate_columns(header, options)
                continue

            row_number += 1

            if row_number > options.max_rows:
                raise ImportLimitError("CSV import exceeds max_rows.")

            if len(row) != len(header):
                raise ImportFormatError(
                    f"CSV record {row_number} has a different number "
                    "of fields than the header."
                )

            record = dict(zip(header, row, strict=True))
            yield _validate_values(record, options, row_number)

        if header is None:
            raise ImportFormatError(
                "CSV input is empty or has no header."
            )

    except csv.Error as exc:
        raise ImportFormatError("CSV input is malformed.") from exc


def _iter_jsonl_text(
    text: str,
    options: ImportOptions,
) -> Iterator[dict[str, Any]]:
    """Parse JSON Lines with duplicate-key and schema validation."""
    row_number = 0
    columns: frozenset[str] | None = None

    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue

        value = _parse_json(line, options)

        if not isinstance(value, dict):
            raise ImportFormatError(
                f"JSONL line {line_number} must contain a JSON object."
            )

        row_number += 1

        if row_number > options.max_rows:
            raise ImportLimitError("JSONL import exceeds max_rows.")

        record = _normalize_record(value, options, row_number)
        current_columns = frozenset(record)

        if columns is None:
            columns = current_columns
            _validate_columns(tuple(record.keys()), options)
        elif current_columns != columns:
            raise ImportFormatError(
                f"JSONL line {line_number} has a different schema "
                "from the first record."
            )

        yield _validate_values(record, options, row_number)


def _iter_json_text(
    text: str,
    options: ImportOptions,
) -> Iterator[dict[str, Any]]:
    """Parse a JSON array of objects."""
    value = _parse_json(text, options)

    if not isinstance(value, list):
        raise ImportFormatError(
            "JSON import must contain a top-level array of objects."
        )

    if len(value) > options.max_rows:
        raise ImportLimitError("JSON import exceeds max_rows.")

    columns: frozenset[str] | None = None

    for row_number, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ImportFormatError(
                f"JSON record {row_number} must be an object."
            )

        record = _normalize_record(item, options, row_number)
        current_columns = frozenset(record)

        if columns is None:
            columns = current_columns
            _validate_columns(tuple(record.keys()), options)
        elif current_columns != columns:
            raise ImportFormatError(
                f"JSON record {row_number} has a different schema "
                "from the first record."
            )

        yield _validate_values(record, options, row_number)

    if not value and options.required_columns:
        _validate_columns(options.required_columns, options)


def iter_import_text(
    text: str,
    options: ImportOptions | None = None,
) -> Iterator[dict[str, Any]]:
    """
    Yield records from text.

    The input string is already resident in memory. This API streams parsed
    records, not input bytes. Use bounded uploads and incremental parsing for
    large files that must not be buffered in full.
    """
    options = options or ImportOptions()

    if not isinstance(text, str):
        raise TypeError("text must be a string.")

    _check_size(text, options)

    if options.format == "csv":
        yield from _iter_csv_text(text, options)
    elif options.format == "json":
        yield from _iter_json_text(text, options)
    elif options.format == "jsonl":
        yield from _iter_jsonl_text(text, options)
    else:
        raise ImportFormatError("Unsupported import format.")


def iter_import_bytes(
    data: bytes,
    options: ImportOptions | None = None,
) -> Iterator[dict[str, Any]]:
    """Decode and parse bounded UTF-8 file contents."""
    options = options or ImportOptions()

    if not isinstance(data, bytes):
        raise TypeError("data must be bytes.")

    _check_size(data, options)
    yield from iter_import_text(_decode_utf8(data), options)


def iter_import_stream(
    source: TextIO,
    options: ImportOptions | None = None,
) -> Iterator[dict[str, Any]]:
    """
    Parse an already-open text stream.

    This implementation reads the stream into memory to enforce the total
    byte limit before parsing. It is not suitable for unbounded streams.
    """
    options = options or ImportOptions()

    if not callable(getattr(source, "read", None)):
        raise TypeError("source must be an open text stream.")

    text = source.read()

    if not isinstance(text, str):
        raise TypeError("source must be a text stream.")

    yield from iter_import_text(text, options)


def import_records(
    data: bytes | str,
    options: ImportOptions | None = None,
    *,
    validator: Callable[[Mapping[str, Any]], Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Import records into a list and optionally validate each record.

    The callback may raise an exception or return False to reject a record.
    This function does not persist records or authorize the operation.
    """
    options = options or ImportOptions()

    if validator is not None and not callable(validator):
        raise TypeError("validator must be callable.")

    if isinstance(data, bytes):
        records = iter_import_bytes(data, options)
    elif isinstance(data, str):
        records = iter_import_text(data, options)
    else:
        raise TypeError("data must be bytes or text.")

    result: list[dict[str, Any]] = []

    for row_number, record in enumerate(records, start=1):
        if validator is not None:
            try:
                validation_result = validator(record)
            except Exception as exc:
                raise ImportValidationError(
                    f"Record {row_number} failed validation."
                ) from exc

            if validation_result is False:
                raise ImportValidationError(
                    f"Record {row_number} failed validation."
                )

        result.append(record)

    return result


__all__ = [
    "ImportErrorBase",
    "ImportFormatError",
    "ImportLimitError",
    "ImportOptions",
    "ImportValidationError",
    "import_records",
    "iter_import_bytes",
    "iter_import_stream",
    "iter_import_text",
]
