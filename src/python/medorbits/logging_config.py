
"""MedOrbits logging configuration.

File: src/python/medorbits/logging_config.py

Provides:
    - Environment-driven log levels and formats.
    - Human-readable console logs for development.
    - Structured JSON logs for production.
    - Request and correlation IDs using context variables.
    - Redaction of common credentials and personal information.
    - Safe, idempotent logger configuration.
    - Standard-library-only implementation.

This module does not initialize application services, load .env files,
write directly to files, or transmit logs to external providers.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import sys
import traceback
from collections.abc import Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Iterator


__all__ = [
    "CorrelationIdFilter",
    "ConsoleFormatter",
    "JsonFormatter",
    "MedOrbitsLoggerAdapter",
    "RedactingFilter",
    "configure_logging",
    "get_logger",
    "log_context",
    "request_id_context",
    "set_request_id",
]

_DEFAULT_LOG_LEVEL = "INFO"
_MAX_CONTEXT_VALUE_LENGTH = 256
_MAX_TEXT_LENGTH = 10_000
_MAX_COLLECTION_ITEMS = 500
_MAX_STRUCTURED_DEPTH = 8

request_id_context: ContextVar[str | None] = ContextVar(
    "medorbits_request_id",
    default=None,
)

_correlation_id_context: ContextVar[str | None] = ContextVar(
    "medorbits_correlation_id",
    default=None,
)

_SENSITIVE_KEY_NAMES = frozenset({
    "authorization",
    "accesstoken",
    "apikey",
    "authtoken",
    "cardnumber",
    "clientsecret",
    "cookie",
    "credential",
    "credentials",
    "currentpassword",
    "databaseurl",
    "emailpassword",
    "idtoken",
    "jwt",
    "password",
    "passwd",
    "paymenttoken",
    "privatekey",
    "refreshtoken",
    "secret",
    "session",
    "sessionid",
    "setcookie",
    "smtp_password",
    "token",
    "webhooksecret",
})

_SECRET_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(
            r"(?i)\b(authorization\s*[:=]\s*)"
            r"(?:bearer\s+)?[^\s,;]+"
        ),
        r"\1[REDACTED]",
    ),
    (
        re.compile(
            r"""(?i)\b(password|passwd|pwd|secret|api[_-]?key|"""
            r"""access[_-]?token|refresh[_-]?token|client[_-]?secret|"""
            r"""database[_-]?url|private[_-]?key|smtp[_-]?password)"""
            r"""(\s*[:=]\s*)(['"]?)[^\s,;'" ]+\3"""
        ),
        r"\1\2[REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b((?:postgres(?:ql)?|mysql|mariadb|redis|"
            r"mongodb(?:\+srv)?|amqp|https?)://[^:/@\s]+:)"
            r"([^@\s/]+)(@)"
        ),
        r"\1[REDACTED]\3",
    ),
    (
        re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
        ),
        "[EMAIL_REDACTED]",
    ),
    (
        re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"),
        "[CARD_NUMBER_REDACTED]",
    ),
)

_STANDARD_RECORD_KEYS = frozenset(
    logging.makeLogRecord({}).__dict__.keys()
)


def _normalize_key(key: Any) -> str:
    """Normalize a field name for sensitive-key matching."""
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def _is_sensitive_key(key: Any) -> bool:
    """Identify common credential and sensitive-data field names."""
    normalized = _normalize_key(key)

    if normalized in _SENSITIVE_KEY_NAMES:
        return True

    return any(
        normalized.endswith(suffix)
        for suffix in (
            "password",
            "passwd",
            "secret",
            "token",
            "privatekey",
            "credential",
            "authorization",
            "cookie",
        )
    )


def _redact_text(value: str) -> str:
    """Redact common secrets and personal data from a bounded string."""
    result = value[:_MAX_TEXT_LENGTH]

    for pattern, replacement in _SECRET_PATTERNS:
        result = pattern.sub(replacement, result)

    return result


def _safe_value(
    value: Any,
    *,
    key: Any = None,
    depth: int = 0,
) -> Any:
    """Convert values to bounded, redacted JSON-safe representations."""
    if key is not None and _is_sensitive_key(key):
        return "[REDACTED]"

    if depth > _MAX_STRUCTURED_DEPTH:
        return "[MAX_DEPTH_EXCEEDED]"

    if value is None or isinstance(value, (bool, int)):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else "[NON_FINITE_NUMBER]"

    if isinstance(value, str):
        return _redact_text(value)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.isoformat() + " (naive)"
        return value.astimezone(timezone.utc).isoformat()

    if isinstance(value, Mapping):
        safe_mapping: dict[str, Any] = {}

        try:
            iterator = iter(value.items())
            for index, (item_key, item_value) in enumerate(iterator):
                if index >= _MAX_COLLECTION_ITEMS:
                    safe_mapping["_truncated"] = True
                    break

                safe_key = str(item_key)[:256]
                safe_mapping[safe_key] = _safe_value(
                    item_value,
                    key=item_key,
                    depth=depth + 1,
                )
        except Exception:
            return "[MAPPING_UNAVAILABLE]"

        return safe_mapping

    if isinstance(value, (list, tuple)):
        safe_items = [
            _safe_value(item, depth=depth + 1)
            for item in value[:_MAX_COLLECTION_ITEMS]
        ]

        if len(value) > _MAX_COLLECTION_ITEMS:
            safe_items.append("[ITEMS_TRUNCATED]")

        return safe_items

    if isinstance(value, (set, frozenset)):
        # Avoid promising deterministic ordering for unordered collections.
        safe_items = [
            _safe_value(item, depth=depth + 1)
            for item in list(value)[:_MAX_COLLECTION_ITEMS]
        ]

        if len(value) > _MAX_COLLECTION_ITEMS:
            safe_items.append("[ITEMS_TRUNCATED]")

        return safe_items

    # Do not call arbitrary repr() methods on application-defined objects.
    return f"[UNSERIALIZABLE:{type(value).__name__}]"


def _safe_exception(record: logging.LogRecord) -> dict[str, str] | None:
    """Build a bounded exception payload with redacted text."""
    if record.exc_info:
        exc_type, exc_value, exc_tb = record.exc_info

        try:
            message = str(exc_value) if exc_value is not None else ""
        except Exception:
            message = "[EXCEPTION_MESSAGE_UNAVAILABLE]"

        try:
            rendered = "".join(
                traceback.format_exception(exc_type, exc_value, exc_tb)
            )
        except Exception:
            rendered = "[TRACEBACK_UNAVAILABLE]"

        return {
            "type": (
                exc_type.__name__
                if exc_type is not None
                else "Exception"
            ),
            "message": _redact_text(message)[:4_000],
            "traceback": _redact_text(rendered)[:12_000],
        }

    if record.exc_text:
        return {
            "type": "Exception",
            "message": "[EXCEPTION_TEXT]",
            "traceback": _redact_text(record.exc_text)[:12_000],
        }

    return None


class CorrelationIdFilter(logging.Filter):
    """Attach request and correlation IDs to log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = request_id_context.get()
        correlation_id = _correlation_id_context.get()

        record.request_id = (
            _redact_text(request_id[:_MAX_CONTEXT_VALUE_LENGTH])
            if isinstance(request_id, str)
            else "-"
        )
        record.correlation_id = (
            _redact_text(correlation_id[:_MAX_CONTEXT_VALUE_LENGTH])
            if isinstance(correlation_id, str)
            else "-"
        )

        return True


class RedactingFilter(logging.Filter):
    """Redact messages and structured fields before handler formatting."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            message = "[LOG_MESSAGE_FORMATTING_FAILED]"

        # Render and redact now so interpolation arguments cannot be rendered
        # again by a later formatter.
        record.msg = _redact_text(message)
        record.args = ()

        for key, value in list(record.__dict__.items()):
            if key in _STANDARD_RECORD_KEYS or key.startswith("_"):
                continue

            if _is_sensitive_key(key):
                record.__dict__[key] = "[REDACTED]"
            else:
                record.__dict__[key] = _safe_value(value, key=key)

        return True


class JsonFormatter(logging.Formatter):
    """Serialize each log record as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(
            record.created,
            tz=timezone.utc,
        ).isoformat(timespec="milliseconds")

        try:
            message = record.getMessage()
        except Exception:
            message = "[LOG_MESSAGE_FORMATTING_FAILED]"

        payload: dict[str, Any] = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": _redact_text(message),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process": record.process,
            "thread": record.thread,
            "request_id": getattr(record, "request_id", "-"),
            "correlation_id": getattr(record, "correlation_id", "-"),
        }

        for key, value in record.__dict__.items():
            if key in _STANDARD_RECORD_KEYS or key.startswith("_"):
                continue

            if key in payload:
                continue

            safe_key = str(key)[:256]
            payload[safe_key] = _safe_value(value, key=key)

        exception = _safe_exception(record)
        if exception is not None:
            payload["exception"] = exception

        payload = {
            key: _safe_value(value, key=key)
            for key, value in payload.items()
        }

        return json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            allow_nan=False,
        )


class ConsoleFormatter(logging.Formatter):
    """Readable development formatter with request context."""

    def __init__(self) -> None:
        super().__init__(
            fmt=(
                "%(asctime)s %(levelname)s %(name)s "
                "[request_id=%(request_id)s "
                "correlation_id=%(correlation_id)s] "
                "%(message)s"
            ),
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    def format(self, record: logging.LogRecord) -> str:
        rendered = super().format(record)

        if record.exc_info:
            try:
                exception_text = self.formatException(record.exc_info)
            except Exception:
                exception_text = "[TRACEBACK_UNAVAILABLE]"

            rendered += "\n" + _redact_text(exception_text)

        elif record.exc_text:
            rendered += "\n" + _redact_text(record.exc_text)

        return _redact_text(rendered)


class MedOrbitsLoggerAdapter(logging.LoggerAdapter):
    """Merge adapter context with per-call structured fields."""

    def process(
        self,
        msg: Any,
        kwargs: dict[str, Any],
    ) -> tuple[Any, dict[str, Any]]:
        extra = dict(self.extra or {})
        supplied_extra = kwargs.get("extra")

        if supplied_extra is not None:
            if not isinstance(supplied_extra, Mapping):
                raise TypeError("The 'extra' argument must be a mapping.")
            extra.update(supplied_extra)

        kwargs["extra"] = extra
        return msg, kwargs


def _normalize_context_id(value: str | None) -> str | None:
    """Validate and bound a request or correlation ID."""
    if value is None:
        return None

    if not isinstance(value, str):
        raise TypeError("Context IDs must be strings or None.")

    normalized = value.strip()

    if not normalized:
        return None

    if any(ord(char) < 32 or ord(char) == 127 for char in normalized):
        raise ValueError("Context IDs must not contain control characters.")

    return normalized[:_MAX_CONTEXT_VALUE_LENGTH]


def set_request_id(request_id: str | None) -> None:
    """Set the request ID in the current execution context."""
    request_id_context.set(_normalize_context_id(request_id))


@contextmanager
def log_context(
    *,
    request_id: str | None = None,
    correlation_id: str | None = None,
) -> Iterator[None]:
    """Temporarily set context IDs and restore previous values."""
    request_token = None
    correlation_token = None

    if request_id is not None:
        request_token = request_id_context.set(
            _normalize_context_id(request_id)
        )

    if correlation_id is not None:
        correlation_token = _correlation_id_context.set(
            _normalize_context_id(correlation_id)
        )

    try:
        yield
    finally:
        if request_token is not None:
            request_id_context.reset(request_token)

        if correlation_token is not None:
            _correlation_id_context.reset(correlation_token)


def _resolve_level(level: str | int | None) -> int:
    """Resolve an explicit or environment-defined logging level."""
    if isinstance(level, bool):
        raise ValueError("Boolean values are not valid logging levels.")

    if isinstance(level, int):
        if level < 0:
            raise ValueError("Log level must be non-negative.")
        return level

    value = level if level is not None else os.getenv(
        "LOG_LEVEL",
        _DEFAULT_LOG_LEVEL,
    )
    normalized = str(value).strip().upper()

    if normalized.isdigit():
        numeric_level = int(normalized)
        if numeric_level < 0:
            raise ValueError("Log level must be non-negative.")
        return numeric_level

    resolved = logging.getLevelName(normalized)

    if not isinstance(resolved, int):
        raise ValueError(
            "Invalid LOG_LEVEL. Use DEBUG, INFO, WARNING, ERROR, "
            "CRITICAL, or a numeric logging level."
        )

    return resolved


def _resolve_json_mode(
    json_logs: bool | None,
    environment: str,
) -> bool:
    """Resolve JSON logging mode from explicit settings or environment."""
    if json_logs is not None:
        if not isinstance(json_logs, bool):
            raise TypeError("json_logs must be True, False, or None.")
        return json_logs

    explicit = os.getenv("LOG_FORMAT", "").strip().lower()

    if explicit in {"json", "structured"}:
        return True

    if explicit in {"text", "console", "plain"}:
        return False

    if explicit:
        raise ValueError(
            "LOG_FORMAT must be json, structured, text, console, or plain."
        )

    return environment in {"production", "prod", "staging"}


def _attach_filter_once(
    handler: logging.Handler,
    filter_type: type[logging.Filter],
) -> None:
    """Attach a filter only if that filter type is not already present."""
    if not any(isinstance(item, filter_type) for item in handler.filters):
        handler.addFilter(filter_type())


def configure_logging(
    *,
    level: str | int | None = None,
    json_logs: bool | None = None,
    force: bool = False,
) -> logging.Logger:
    """Configure root logging.

    Args:
        level: Logging level, defaulting to LOG_LEVEL or INFO.
        json_logs: Explicitly select JSON or console output.
        force: Replace existing root handlers when True.

    Call during application startup, not per request.
    """
    environment = os.getenv(
        "APP_ENV",
        os.getenv("NODE_ENV", "development"),
    ).strip().lower()

    resolved_level = _resolve_level(level)
    use_json = _resolve_json_mode(json_logs, environment)

    root_logger = logging.getLogger()
    root_logger.setLevel(resolved_level)

    if force:
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
            try:
                handler.close()
            except Exception:
                pass

    if root_logger.handlers and not force:
        # Preserve host-owned formatters and handlers. The safety filters
        # enrich records and redact values before existing formatters run.
        for handler in root_logger.handlers:
            handler.setLevel(resolved_level)
            _attach_filter_once(handler, CorrelationIdFilter)
            _attach_filter_once(handler, RedactingFilter)

        return root_logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(resolved_level)
    handler.addFilter(CorrelationIdFilter())
    handler.addFilter(RedactingFilter())
    handler.setFormatter(
        JsonFormatter() if use_json else ConsoleFormatter()
    )
    root_logger.addHandler(handler)

    for logger_name in ("urllib3", "httpx", "httpcore", "asyncio"):
        logging.getLogger(logger_name).setLevel(
            max(resolved_level, logging.WARNING)
        )

    return root_logger


def get_logger(
    name: str,
    *,
    context: Mapping[str, Any] | None = None,
) -> logging.Logger | MedOrbitsLoggerAdapter:
    """Return a named logger, optionally enriched with structured context."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Logger name must be a non-empty string.")

    logger = logging.getLogger(name.strip())

    if context is None:
        return logger

    if not isinstance(context, Mapping):
        raise TypeError("Logger context must be a mapping or None.")

    if len(context) > _MAX_COLLECTION_ITEMS:
        raise ValueError("Logger context contains too many fields.")

    safe_context = {
        str(key)[:256]: value
        for key, value in context.items()
    }

    return MedOrbitsLoggerAdapter(logger, safe_context)


if __name__ == "__main__":
    configure_logging()

    logger = get_logger(
        "medorbits.logging_config",
        context={"service": "medorbits-python"},
    )
    logger.info("Logging configuration initialized.")
