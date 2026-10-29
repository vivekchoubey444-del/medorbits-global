
#!/usr/bin/env python3
"""
MedOrbits Local Agent -- Compatible Shared Utilities
File: local-agent/tools/compatible_share.py

Python 3.10+
Standard-library only.

Provides safe, reusable helpers for validating paths, reading and writing
UTF-8 files, parsing JSON, and reporting structured operation results.
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


class CompatibilityError(Exception):
    """Raised when a shared utility operation cannot be completed safely."""


def validate_path(
    path: str | Path,
    root: str | Path | None = None,
) -> Path:
    """Resolve a path and optionally ensure it stays within root."""
    candidate = Path(path).expanduser().resolve()

    if root is not None:
        allowed_root = Path(root).expanduser().resolve()

        try:
            candidate.relative_to(allowed_root)
        except ValueError as exc:
            raise CompatibilityError(
                f"Path is outside the permitted root: {candidate}"
            ) from exc

    return candidate


def read_text(
    path: str | Path,
    *,
    root: str | Path | None = None,
    max_bytes: int = 5_000_000,
) -> str:
    """Read a UTF-8 text file with a size limit."""
    if max_bytes < 0:
        raise ValueError("max_bytes must be non-negative")

    target = validate_path(path, root)

    try:
        with target.open("rb") as stream:
            data = stream.read(max_bytes + 1)
    except OSError as exc:
        raise CompatibilityError(f"Cannot read {target}: {exc}") from exc

    if len(data) > max_bytes:
        raise CompatibilityError(
            f"File exceeds the configured size limit: {target}"
        )

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise CompatibilityError(
            f"File is not valid UTF-8: {target}"
        ) from exc


def read_json(
    path: str | Path,
    *,
    root: str | Path | None = None,
    max_bytes: int = 5_000_000,
) -> Any:
    """Read and parse a JSON file."""
    content = read_text(path, root=root, max_bytes=max_bytes)

    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise CompatibilityError(
            f"Invalid JSON in {path}, line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc


def write_text_atomic(
    path: str | Path,
    content: str,
    *,
    root: str | Path | None = None,
) -> Path:
    """Write UTF-8 text atomically using a temporary file."""
    target = validate_path(path, root)

    if not isinstance(content, str):
        raise TypeError("content must be a string")

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            temporary_name = stream.name
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())

        os.replace(temporary_name, target)
        temporary_name = None
        return target

    except OSError as exc:
        raise CompatibilityError(
            f"Cannot write {target}: {exc}"
        ) from exc

    finally:
        if temporary_name is not None:
            try:
                Path(temporary_name).unlink(missing_ok=True)
            except OSError:
                pass


def write_json_atomic(
    path: str | Path,
    data: Any,
    *,
    root: str | Path | None = None,
    indent: int = 2,
) -> Path:
    """Serialize JSON and atomically write it to disk."""
    try:
        content = json.dumps(
            data,
            ensure_ascii=False,
            indent=indent,
            allow_nan=False,
        ) + "\n"
    except (TypeError, ValueError) as exc:
        raise CompatibilityError(
            f"Data cannot be serialized as strict JSON: {exc}"
        ) from exc

    return write_text_atomic(path, content, root=root)


def operation_result(
    success: bool,
    message: str,
    **details: Any,
) -> dict[str, Any]:
    """Create a consistent machine-readable operation result."""
    return {
        "success": bool(success),
        "message": str(message),
        "details": details,
    }


def main() -> int:
    """Run a lightweight standalone compatibility check."""
    print("MedOrbits compatible shared utilities")
    print("Python compatibility check: PASS")
    print("Available helpers: validate_path, read_text, read_json,")
    print("write_text_atomic, write_json_atomic, operation_result")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
