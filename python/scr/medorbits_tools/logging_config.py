
"""Logging configuration for MedOrbits Python tools.

Features:
    - Structured JSON and human-readable text logging.
    - Consistent timestamps and log fields.
    - Secret redaction for common credentials and sensitive values.
    - Idempotent logger setup to avoid duplicate handlers.
    - Optional file logging with explicit destinations.
    - Safe exception formatting.
    - No logging configuration changes merely from importing this module.

Compatible with Python 3.10+.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, TextIO


__all__ = [
    "MedOrbitsRedactionFilter",
    "MedOrbitsTextFormatter",
    "MedOrbitsJsonFormatter",
    "configure_logging",
    "get_logger",
    "reset_logging",
    "redact_text",
]


DEFAULT_LOGGER_NAME = "medorbits"
DEFAULT_LOG_FORMAT = "text"
DEFAULT_LOG_LEVEL = "INFO"
MAX_MESSAGE_LENGTH = 16_384
MAX_EXCEPTION_LENGTH = 12_000
MAX_EXTRA_FIELDS = 50

_REDACTED = "[REDACTED]"

_SECRET_NAME_PATTERN = re.compile(
    r"(?i)"
    r"(?:"
    r"password|passwd|secret|token|api[_-]?key|"
    r"access[_-]?key|private[_-]?key|client[_-]?secret|"
    r"authorization|cookie|credential|database[_-]?url"
    r")"
)

_SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"""(?ix)
    (
        ["']?
        (?:password|passwd|secret|token|api[_-]?key|
           access[_-]?key|private[_-]?key|client[_-]?secret|
           authorization|cookie|credential|database[_-]?url)
        ["']?
        \s*[:=]\s*
    )
    (
        "(?:\\.|[^"\\])*"
        |
        '(?:\\.|[^'\\])*'
        |
        [^\s,;&]+
    )
    """
)

_BEARER_PATTERN = re.compile(
    r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+"
)

_BASIC_AUTH_PATTERN = re.compile(
    r"(?i)\bBasic\s+[A-Za-z0-9+/=]+"
)

_URL_CREDENTIAL_PATTERN = re.compile(
    r"(?i)(https?://)([^/\s:@]+):([^@\s/]+)@"
)

_PRIVATE_KEY_PATTERN = re.compile(
    r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
    r".*?"
    r"-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    re.DOTALL,
)

_EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

_LOCK = threading.RLock()
_CONFIGURED_LOGGERS: set[str] = set()


def _truncate(value: str, limit: int) -> str:
    """Bound the size of a log value."""
    if len(value) <= limit:
        return value
    return value[:limit] + "...[TRUNCATED]"


def redact_text(value: str) -> str:
    """Redact common credentials embedded in log messages.

    This is a defensive best-effort filter, not a substitute for avoiding
    sensitive data in log messages in the first place.
    """
    text = _truncate(str(value), MAX_MESSAGE_LENGTH)

    text = _PRIVATE_KEY_PATTERN.sub(_REDACTED, text)
    text = _BEARER_PATTERN.sub("Bearer " + _REDACTED, text)
    text = _BASIC_AUTH_PATTERN.sub("Basic " + _REDACTED, text)
    text = _URL_CREDENTIAL_PATTERN.sub(
        lambda match: f"{match.group(1)}{_REDACTED}:{_REDACTED}@",
        text,
    )

    text = _SECRET_ASSIGNMENT_PATTERN.sub(
        lambda match: match.group(1) + _REDACTED,
        text,
    )

    return text


def _safe_extra_fields(
    fields: Mapping[str, Any],
) -> dict[str, Any]:
    """Convert approved extra fields into bounded, redacted log values."""
    safe_fields: dict[str, Any] = {}

    for index, (key, value) in enumerate(fields.items()):
        if index >= MAX_EXTRA_FIELDS:
            safe_fields["additional_fields"] = "[TRUNCATED]"
            break

        safe_key = str(key)[:128]

        if _SECRET_NAME_PATTERN.search(safe_key):
            safe_fields[safe_key] = _REDACTED
            continue

        if value is None or isinstance(value, (bool, int, float)):
            safe_fields[safe_key] = value
        elif isinstance(value, str):
            safe_fields[safe_key] = redact_text(value)
        elif isinstance(value, (list, tuple)):
            safe_fields[safe_key] = redact_text(repr(value)[:2048])
        elif isinstance(value, dict):
            safe_fields[safe_key] = "[OBJECT OMITTED]"
        else:
            safe_fields[safe_key] = f"<{type(value).__name__}>"

    return safe_fields


class MedOrbitsRedactionFilter(logging.Filter):
    """Redact sensitive-looking content before formatting a log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            message = "[LOG MESSAGE FORMATTING FAILED]"

        record.msg = redact_text(message)
        record.args = ()

        if record.exc_info:
            exception_type, exception_value, _ = record.exc_info

            # Preserve the exception type while redacting its displayed value.
            safe_value = redact_text(str(exception_value))
            record.safe_exception_type = exception_type.__name__
            record.safe_exception_message = _truncate(
                safe_value,
                MAX_EXCEPTION_LENGTH,
            )

        return True


class MedOrbitsTextFormatter(logging.Formatter):
    """Format log records as readable single-line text."""

    def __init__(self) -> None:
        super().__init__(
            fmt=(
                "%(asctime)s %(levelname)s "
                "%(name)s %(message)s"
            ),
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )

    def format(self, record: logging.LogRecord) -> str:
        original_message = record.msg

        try:
            record.msg = redact_text(record.getMessage())
            record.args = ()

            output = super().format(record)

            if record.exc_info:
                exception_type = getattr(
                    record,
                    "safe_exception_type",
                    "Exception",
                )
                exception_message = getattr(
                    record,
                    "safe_exception_message",
                    "[exception details redacted]",
                )
                output += (
                    f" | exception={exception_type}: "
                    f"{exception_message}"
                )

            return _truncate(output, MAX_MESSAGE_LENGTH)
        finally:
            record.msg = original_message


class MedOrbitsJsonFormatter(logging.Formatter):
    """Format log records as JSON Lines."""

    STANDARD_FIELDS = frozenset(
        logging.makeLogRecord({}).__dict__.keys()
    )

    def format(self, record: logging.LogRecord) -> str:
        try:
            message = redact_text(record.getMessage())
        except Exception:
            message = "[LOG MESSAGE FORMATTING FAILED]"

        timestamp = datetime.fromtimestamp(
            record.created,
            tz=timezone.utc,
        ).isoformat()

        payload: dict[str, Any] = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "process_id": record.process,
            "thread_name": record.threadName,
        }

        if record.exc_info:
            payload["exception"] = {
                "type": getattr(
                    record,
                    "safe_exception_type",
                    "Exception",
                ),
                "message": getattr(
                    record,
                    "safe_exception_message",
                    "[exception details redacted]",
                ),
            }

        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in self.STANDARD_FIELDS
            and key not in {
                "message",
                "asctime",
                "safe_exception_type",
                "safe_exception_message",
            }
            and not key.startswith("_")
        }

        payload.update(_safe_extra_fields(extras))

        return _truncate(
            json.dumps(
                payload,
                ensure_ascii=False,
                separators=(",", ":"),
                default=lambda _: "[UNSUPPORTED VALUE]",
            ),
            MAX_MESSAGE_LENGTH,
        )


def _resolve_level(level: str | int) -> int:
    """Resolve and validate a logging level."""
    if isinstance(level, int):
        if level < 0:
            raise ValueError("Logging level must not be negative.")
        return level

    resolved = logging.getLevelName(level.strip().upper())

    if not isinstance(resolved, int):
        raise ValueError("Unsupported logging level.")

    return resolved


def _resolve_stream(stream: TextIO | None) -> TextIO:
    """Choose the output stream."""
    return sys.stderr if stream is None else stream


def configure_logging(
    *,
    level: str | int = DEFAULT_LOG_LEVEL,
    log_format: str = DEFAULT_LOG_FORMAT,
    logger_name: str = DEFAULT_LOGGER_NAME,
    stream: TextIO | None = None,
    log_file: Path | None = None,
    force: bool = False,
) -> logging.Logger:
    """Configure a MedOrbits logger without duplicate handlers.

    Args:
        level: Logging level, such as INFO or DEBUG.
        log_format: Either "text" or "json".
        logger_name: Logger to configure.
        stream: Optional text stream. Defaults to stderr.
        log_file: Optional explicit log file path.
        force: Replace handlers installed by this function.

    Security:
        This function does not create a log file unless log_file is provided.
        Log-file permissions depend on the host operating system and umask.
        The logger does not automatically capture environment variables.
    """
    if not logger_name or not logger_name.strip():
        raise ValueError("Logger name must not be empty.")

    normalized_format = log_format.strip().lower()

    if normalized_format not in {"text", "json"}:
        raise ValueError("Log format must be 'text' or 'json'.")

    resolved_level = _resolve_level(level)
    logger = logging.getLogger(logger_name)

    with _LOCK:
        logger.setLevel(resolved_level)
        logger.propagate = False

        if force or logger_name not in _CONFIGURED_LOGGERS:
            # Remove only handlers owned by this module.
            for handler in list(logger.handlers):
                if getattr(handler, "_medorbits_managed", False):
                    logger.removeHandler(handler)
                    try:
                        handler.close()
                    except Exception:
                        pass

            formatter: logging.Formatter
            if normalized_format == "json":
                formatter = MedOrbitsJsonFormatter()
            else:
                formatter = MedOrbitsTextFormatter()

            stream_handler = logging.StreamHandler(
                _resolve_stream(stream)
            )
            stream_handler.setLevel(resolved_level)
            stream_handler.setFormatter(formatter)
            stream_handler.addFilter(MedOrbitsRedactionFilter())
            stream_handler._medorbits_managed = True  # type: ignore[attr-defined]
            logger.addHandler(stream_handler)

            if log_file is not None:
                file_path = log_file.expanduser().resolve()
                file_path.parent.mkdir(parents=True, exist_ok=True)

                file_handler = logging.FileHandler(
                    file_path,
                    encoding="utf-8",
                    delay=True,
                )
                file_handler.setLevel(resolved_level)
                file_handler.setFormatter(formatter)
                file_handler.addFilter(MedOrbitsRedactionFilter())
                file_handler._medorbits_managed = True  # type: ignore[attr-defined]
                logger.addHandler(file_handler)

            _CONFIGURED_LOGGERS.add(logger_name)

        return logger


def get_logger(
    name: str | None = None,
) -> logging.Logger:
    """Return a child logger under the MedOrbits namespace."""
    if name is None or not name.strip():
        return logging.getLogger(DEFAULT_LOGGER_NAME)

    normalized = name.strip()

    if normalized == DEFAULT_LOGGER_NAME:
        return logging.getLogger(DEFAULT_LOGGER_NAME)

    if normalized.startswith(DEFAULT_LOGGER_NAME + "."):
        return logging.getLogger(normalized)

    return logging.getLogger(f"{DEFAULT_LOGGER_NAME}.{normalized}")


def reset_logging(
    *,
    logger_name: str = DEFAULT_LOGGER_NAME,
) -> None:
    """Close and remove handlers installed by this module.

    Intended primarily for tests and controlled application shutdown.
    Handlers owned by other libraries are left untouched.
    """
    logger = logging.getLogger(logger_name)

    with _LOCK:
        for handler in list(logger.handlers):
            if getattr(handler, "_medorbits_managed", False):
                logger.removeHandler(handler)
                try:
                    handler.flush()
                except Exception:
                    pass
                try:
                    handler.close()
                except Exception:
                    pass

        _CONFIGURED_LOGGERS.discard(logger_name)


def configure_from_environment() -> logging.Logger:
    """Configure logging from environment variables.

    Recognized variables:
        LOG_LEVEL
        LOG_FORMAT

    Invalid values raise ValueError without exposing environment contents.
    """
    level = os.environ.get("LOG_LEVEL", DEFAULT_LOG_LEVEL)
    log_format = os.environ.get("LOG_FORMAT", DEFAULT_LOG_FORMAT)

    return configure_logging(
        level=level,
        log_format=log_format,
    )
