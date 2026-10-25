
"""
MedOrbits -- Data Export Utilities

File: src/python/medorbits/data_export.py

Purpose:
    Export authorized application data to CSV, JSON, and JSON Lines.

Security:
    - Callers must authorize access before exporting records.
    - Export only explicitly permitted fields.
    - Never export credentials, tokens, OTPs, or secrets.
    - Do not log exported rows or sensitive values.
    - The caller owns destination permissions and retention policies.
    - CSV formula mitigation is defense in depth, not a universal guarantee.
"""

from __future__ import annotations

import csv
import io
import json
import math
import re
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Any, Final, TextIO
from uuid import UUID


DEFAULT_MAX_ROWS: Final[int] = 100_000
DEFAULT_MAX_COLUMNS: Final[int] = 200
DEFAULT_MAX_CELL_CHARS: Final[int] = 1_000_000

SUPPORTED_FORMATS: Final[frozenset[str]] = frozenset(
    {"csv", "json", "jsonl"}
)

SAFE_EXPORT_NAME_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$"
)

SENSITIVE_FIELD_NAMES: Final[frozenset[str]] = frozenset(
    {
        "password",
        "password_hash",
        "passwd",
        "secret",
        "client_secret",
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "id_token",
        "token",
        "authorization",
        "cookie",
        "session",
        "session_id",
        "otp",
        "one_time_password",
        "private_key",
        "webhook_secret",
        "card_number",
        "cvv",
        "cvc",
        "security_code",
        "recovery_code",
        "credential",
        "credentials",
        "smtp_password",
        "ai_api_key",
        "database_url",
    }
)

_NORMALIZED_SENSITIVE_FIELDS: Final[frozenset[str]] = frozenset(
    re.sub(r"[^a-z0-9]", "", name.casefold())
    for name in SENSITIVE_FIELD_NAMES
)


class ExportError(ValueError):
    """Raised when an export request or record cannot be safely processed."""


class ExportFormatError(ExportError):
    """Raised when an unsupported export format is requested."""


class ExportLimitError(ExportError):
    """Raised when an export exceeds its configured limits."""


@dataclass(frozen=True, slots=True)
class ExportOptions:
    """Immutable options for a data export."""

    format: str = "csv"
    columns: tuple[str, ...] | None = None
    max_rows: int = DEFAULT_MAX_ROWS
    max_columns: int = DEFAULT_MAX_COLUMNS
    max_cell_chars: int = DEFAULT_MAX_CELL_CHARS
    include_header: bool = True
    spreadsheet_safe: bool = True
    json_indent: int | None = 2
    allow_sensitive_fields: bool = False

    def __post_init__(self) -> None:
        if not isinstance(self.format, str):
            raise ExportFormatError("Export format must be a string.")

        normalized_format = self.format.strip().lower()

        if normalized_format not in SUPPORTED_FORMATS:
            raise ExportFormatError(
                "Export format must be csv, json, or jsonl."
            )

        object.__setattr__(self, "format", normalized_format)

        for name, value, maximum in (
            ("max_rows", self.max_rows, 10_000_000),
            ("max_columns", self.max_columns, 10_000),
            ("max_cell_chars", self.max_cell_chars, 10_000_000),
        ):
            if (
                not isinstance(value, int)
                or isinstance(value, bool)
                or not 1 <= value <= maximum
            ):
                raise ExportLimitError(
                    f"{name} must be an integer between 1 and {maximum}."
                )

        for name, value in (
            ("include_header", self.include_header),
            ("spreadsheet_safe", self.spreadsheet_safe),
            ("allow_sensitive_fields", self.allow_sensitive_fields),
        ):
            if not isinstance(value, bool):
                raise ExportError(f"{name} must be a boolean.")

        if self.json_indent is not None and (
            not isinstance(self.json_indent, int)
            or isinstance(self.json_indent, bool)
            or not 0 <= self.json_indent <= 8
        ):
            raise ExportError(
                "json_indent must be None or an integer from 0 to 8."
            )

        if self.columns is not None:
            if not isinstance(self.columns, tuple):
                raise ExportError("columns must be a tuple of field names.")

            if not self.columns:
                raise ExportError("columns cannot be empty.")

            if len(self.columns) > self.max_columns:
                raise ExportLimitError(
                    "Requested columns exceed max_columns."
                )

            if any(
                not isinstance(column, str)
                or not column
                or column.strip() != column
                for column in self.columns
            ):
                raise ExportError(
                    "Column names must be non-empty trimmed strings."
                )

            if len(set(self.columns)) != len(self.columns):
                raise ExportError(
                    "Column names must not contain duplicates."
                )


def validate_export_name(name: str) -> str:
    """
    Validate a filename stem.

    This does not create a path or guarantee destination safety.
    """
    if (
        not isinstance(name, str)
        or not SAFE_EXPORT_NAME_PATTERN.fullmatch(name)
        or name in {".", ".."}
        or name.startswith(".")
    ):
        raise ExportError("Export name contains unsupported characters.")

    return name


def _is_sensitive_field(name: str) -> bool:
    """Check normalized field names against the default blocklist."""
    normalized = re.sub(r"[^a-z0-9]", "", name.casefold())

    if normalized in _NORMALIZED_SENSITIVE_FIELDS:
        return True

    # Catch common variations such as user_password, apiKey, or token_value.
    sensitive_fragments = (
        "password",
        "passwd",
        "secret",
        "apikey",
        "accesstoken",
        "refreshtoken",
        "idtoken",
        "privatekey",
        "webhooksecret",
        "authorization",
        "credential",
        "one time password",
        "onetimepassword",
        "sessionid",
        "securitycode",
        "recoverycode",
    )

    return any(
        re.sub(r"[^a-z0-9]", "", fragment) in normalized
        for fragment in sensitive_fragments
    ) or normalized.endswith("token")


def _validate_columns(
    columns: Sequence[str],
    options: ExportOptions,
) -> tuple[str, ...]:
    """Validate column names, count, uniqueness, and sensitive-field policy."""
    if not columns:
        raise ExportError("At least one export column is required.")

    if len(columns) > options.max_columns:
        raise ExportLimitError(
            "Export exceeds the maximum column count."
        )

    if any(
        not isinstance(column, str)
        or not column
        or column.strip() != column
        for column in columns
    ):
        raise ExportError(
            "Export column names must be non-empty trimmed strings."
        )

    if len(set(columns)) != len(columns):
        raise ExportError("Export column names must be unique.")

    if not options.allow_sensitive_fields and any(
        _is_sensitive_field(column) for column in columns
    ):
        raise ExportError(
            "Export contains a field blocked by the default "
            "sensitive-field policy."
        )

    return tuple(columns)


def _to_json_compatible(value: Any, *, depth: int = 0) -> Any:
    """Convert supported values into strict JSON-compatible data."""
    if depth > 100:
        raise ExportLimitError("Export value nesting exceeds the depth limit.")

    if value is None or isinstance(value, (str, bool, int)):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ExportError(
                "Non-finite floating-point values are not supported."
            )
        return value

    if isinstance(value, Decimal):
        if not value.is_finite():
            raise ExportError("Non-finite Decimal values are not supported.")
        # Preserve decimal precision instead of silently converting to float.
        return format(value, "f")

    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ExportError(
                "Datetime values must include timezone information."
            )
        return value.isoformat()

    if isinstance(value, date):
        return value.isoformat()

    if isinstance(value, time):
        if value.tzinfo is not None and value.utcoffset() is None:
            raise ExportError("Time value has an invalid timezone.")
        return value.isoformat()

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, Enum):
        return _to_json_compatible(value.value, depth=depth + 1)

    if isinstance(value, Path):
        return str(value)

    if isinstance(value, Mapping):
        result: dict[str, Any] = {}

        for key, item in value.items():
            if not isinstance(key, str):
                raise ExportError("JSON object keys must be strings.")

            if key in result:
                raise ExportError("Duplicate JSON object keys are not allowed.")

            result[key] = _to_json_compatible(item, depth=depth + 1)

        return result

    if isinstance(value, (list, tuple)):
        return [
            _to_json_compatible(item, depth=depth + 1)
            for item in value
        ]

    raise ExportError(
        f"Unsupported export value type: {type(value).__name__}."
    )


def _format_cell(value: Any, options: ExportOptions) -> str:
    """Convert one value to bounded text."""
    compatible = _to_json_compatible(value)

    if compatible is None:
        text = ""
    elif isinstance(compatible, (dict, list)):
        text = json.dumps(
            compatible,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        )
    elif isinstance(compatible, bool):
        text = "true" if compatible else "false"
    else:
        text = str(compatible)

    if len(text) > options.max_cell_chars:
        raise ExportLimitError(
            "An export cell exceeds max_cell_chars."
        )

    return text


def _spreadsheet_safe_cell(value: str) -> str:
    """
    Mitigate spreadsheet formula injection in CSV exports.

    This is defense in depth; spreadsheet applications differ in how they
    interpret leading whitespace, control characters, and formula prefixes.
    """
    probe = value.lstrip(" \t\r\n\x00")

    if probe.startswith(("=", "+", "-", "@")):
        return "'" + value

    if value.startswith(("\t", "\r", "\n")):
        return "'" + value

    return value


def _prepare_row(
    record: Mapping[str, Any],
    columns: tuple[str, ...],
    options: ExportOptions,
) -> dict[str, Any]:
    """Select and normalize the requested fields from one record."""
    if not isinstance(record, Mapping):
        raise ExportError("Every exported record must be a mapping.")

    missing = [column for column in columns if column not in record]

    if missing:
        raise ExportError(
            "A record is missing one or more requested export columns."
        )

    return {
        column: _to_json_compatible(record[column])
        for column in columns
    }


def _resolve_columns(
    records: Iterable[Mapping[str, Any]],
    options: ExportOptions,
) -> tuple[tuple[str, ...], Iterator[Mapping[str, Any]]]:
    """
    Resolve columns without consuming the entire dataset.

    If columns are omitted, the first record defines the schema.
    Supply columns explicitly for empty datasets or stable export schemas.
    """
    iterator = iter(records)

    if options.columns is not None:
        return _validate_columns(options.columns, options), iterator

    try:
        first_record = next(iterator)
    except StopIteration as exc:
        raise ExportError(
            "Columns must be supplied when exporting an empty dataset."
        ) from exc

    if not isinstance(first_record, Mapping):
        raise ExportError("Every exported record must be a mapping.")

    columns = _validate_columns(tuple(first_record.keys()), options)

    def records_with_first() -> Iterator[Mapping[str, Any]]:
        yield first_record
        yield from iterator

    return columns, records_with_first()


def iter_csv(
    records: Iterable[Mapping[str, Any]],
    options: ExportOptions | None = None,
) -> Iterator[str]:
    """Yield CSV text chunks without buffering the complete export."""
    options = options or ExportOptions(format="csv")

    if options.format != "csv":
        raise ExportFormatError("iter_csv requires format='csv'.")

    columns, record_iterator = _resolve_columns(records, options)
    buffer = io.StringIO(newline="")
    writer = csv.writer(
        buffer,
        dialect="excel",
        lineterminator="\r\n",
        quoting=csv.QUOTE_MINIMAL,
    )

    if options.include_header:
        writer.writerow(columns)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

    row_count = 0

    for record in record_iterator:
        row_count += 1

        if row_count > options.max_rows:
            raise ExportLimitError("Export exceeds max_rows.")

        prepared = _prepare_row(record, columns, options)
        row = [
            _format_cell(prepared[column], options)
            for column in columns
        ]

        if options.spreadsheet_safe:
            row = [_spreadsheet_safe_cell(value) for value in row]

        writer.writerow(row)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)


def iter_jsonl(
    records: Iterable[Mapping[str, Any]],
    options: ExportOptions | None = None,
) -> Iterator[str]:
    """Yield one strict JSON object per line."""
    options = options or ExportOptions(format="jsonl")

    if options.format != "jsonl":
        raise ExportFormatError("iter_jsonl requires format='jsonl'.")

    columns, record_iterator = _resolve_columns(records, options)
    row_count = 0

    for record in record_iterator:
        row_count += 1

        if row_count > options.max_rows:
            raise ExportLimitError("Export exceeds max_rows.")

        prepared = _prepare_row(record, columns, options)

        yield (
            json.dumps(
                prepared,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            )
            + "\n"
        )


def export_json(
    records: Iterable[Mapping[str, Any]],
    options: ExportOptions | None = None,
) -> str:
    """Serialize records as a JSON array, bounded by max_rows."""
    options = options or ExportOptions(format="json")

    if options.format != "json":
        raise ExportFormatError("export_json requires format='json'.")

    columns = (
        _validate_columns(options.columns, options)
        if options.columns is not None
        else None
    )
    exported: list[dict[str, Any]] = []

    for record in records:
        if len(exported) >= options.max_rows:
            raise ExportLimitError("Export exceeds max_rows.")

        if not isinstance(record, Mapping):
            raise ExportError("Every exported record must be a mapping.")

        if columns is None:
            columns = _validate_columns(tuple(record.keys()), options)

        exported.append(_prepare_row(record, columns, options))

    if columns is None:
        raise ExportError(
            "Columns must be supplied when exporting an empty dataset."
        )

    return json.dumps(
        exported,
        ensure_ascii=False,
        allow_nan=False,
        indent=options.json_indent,
    )


def export_records(
    records: Iterable[Mapping[str, Any]],
    options: ExportOptions | None = None,
) -> str:
    """
    Export records into a single string.

    Prefer iter_csv(), iter_jsonl(), or write_export() for large datasets.
    JSON arrays are buffered in memory and should be used with bounded sizes.
    """
    options = options or ExportOptions()

    if options.format == "json":
        return export_json(records, options)

    if options.format == "csv":
        return "".join(iter_csv(records, options))

    if options.format == "jsonl":
        return "".join(iter_jsonl(records, options))

    raise ExportFormatError("Unsupported export format.")


def write_export(
    records: Iterable[Mapping[str, Any]],
    destination: TextIO,
    options: ExportOptions | None = None,
) -> int:
    """
    Write an export to an already-open text destination.

    Returns the number of exported records. The caller owns the destination
    and must manage its permissions, lifecycle, and secure storage.
    """
    options = options or ExportOptions()

    if not callable(getattr(destination, "write", None)):
        raise TypeError("destination must be an open text stream.")

    if options.format == "json":
        text = export_json(records, options)
        destination.write(text)
        return len(json.loads(text))

    if options.format == "csv":
        iterator = iter_csv(records, options)
    elif options.format == "jsonl":
        iterator = iter_jsonl(records, options)
    else:
        raise ExportFormatError("Unsupported export format.")

    # Count records independently of output chunks so CSV headers are excluded.
    count = 0
    source = iter(records)

    # Avoid consuming a one-shot iterator twice. The export iterator above
    # already owns the same iterator for most iterable types, so record
    # counting is performed as rows are serialized below instead.
    del source

    if options.format == "csv":
        # Count CSV data rows, excluding an optional header.
        for index, chunk in enumerate(iterator):
            destination.write(chunk)
            if not (options.include_header and index == 0):
                count += 1
        return count

    for chunk in iterator:
        destination.write(chunk)
        count += 1

    return count


__all__ = [
    "ExportError",
    "ExportFormatError",
    "ExportLimitError",
    "ExportOptions",
    "export_json",
    "export_records",
    "iter_csv",
    "iter_jsonl",
    "validate_export_name",
    "write_export",
]
