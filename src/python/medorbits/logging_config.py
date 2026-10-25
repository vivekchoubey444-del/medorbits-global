
"""MedOrbits logging configuration.

Provides consistent application logging with:
- Environment-driven log levels and formats.
- Human-readable console logs for local development.
- Structured JSON logs for production and log aggregation.
- Context variables for request and correlation IDs.
- Sensitive-data redaction for common credentials and personal data.
- Safe, idempotent logger configuration.
- Standard-library-only implementation.

This module configures logging only. It does not initialize application
services, write logs to files, or transmit logs to external providers.
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
import traceback
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Iterator, Mapping


__all__ = [
    "CorrelationIdFilter",
    "JsonFormatter",
    "MedOrbitsLoggerAdapter",
    "RedactingFilter",
    "configure_logging",
    "get_logger",
    "log_context",
    "request_id_context",
    "set_request_id",
]


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------

request_id_context: ContextVar[str | None] = ContextVar(
    "medorbits_request_id",
    default=None,
)

_correlation_id_context: ContextVar[str | None] = ContextVar(
    "medorbits_correlation_id",
    default=None,
)

_DEFAULT_LOG_LEVEL = "INFO"
_DEFAULT_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
_MAX_CONTEXT_VALUE_LENGTH = 256

# Keys are normalized before comparison. Never include values from these fields
# in structured logs.
_SENSITIVE_KEY_NAMES = {
    "authorization",
    "accesstoken",
    "apikey",
    "authtoken",
    "cardnumber",
    "cvv",
    "cvc",
    "cookie",
    "credential",
    "credentials",
    "currentpassword",
    "databaseurl",
    "emailpassword",
    "idtoken",
    "jwt",
    "password",
    "paymenttoken",
    "privatekey",
    "refreshtoken",
    "secret",
    "session",
    "sessionid",
    "setcookie",
    "smtp password",
    "smtp_password",
    "token",
    "webhooksecret",
}

# Common secrets embedded in free-text log messages.
_SECRET_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(
            r"(?i)\b(authorization\s*[:=]\s*)(?:bearer\s+)?"
            r"[^\s,;]+"
        ),
        r"\1[REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|"
            r"access[_-]?token|refresh[_-]?token|client[_-]?secret)"
            r"(\s*[:=]\s*)(['\"]?)[^\s,;'\"]+\3"
        ),
        r"\1\2[REDACTED]",
    ),
    (
        re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
        ),
        "[EMAIL_REDACTED]",
    ),
    (
        re.compile(
            r"(?i)\b(?:\d[ -]*?){13,19}\b"
        ),
        "[CARD_NUMBER_REDACTED]",
    ),
)


# ---------------------------------------------------------------------------
# Redaction helpers
# ---------------------------------------------------------------------------

def _normalize_key(key: Any) -> str:
    """Normalize a field name for sensitive-key matching."""
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def _is_sensitive_key(key: Any) -> bool:
    """Return True when a field name appears to contain sensitive data."""
    normalized = _normalize_key(key)
    return (
        normalized in _SENSITIVE_KEY_NAMES
        or normalized.endswith("password")
        or normalized.endswith("secret")
        or normalized.endswith("token")
        or normalized.endswith("privatekey")
        or normalized.endswith("credential")
    )


def _redact_text(value: str) -> str:
    """Redact common secrets and email addresses from free text."""
    result = value

    for pattern, replacement in _SECRET_PATTERNS:
        result = pattern.sub(replacement, result)

    return result


def _safe_value(
    value: Any,
    *,
    key: Any = None,
    depth: int = 0,
    max_depth: int = 8,
) -> Any:
    """Convert a value into a JSON-safe, redacted representation."""
    if key is not None and _is_sensitive_key(key):
        return "[REDACTED]"

    if depth > max_depth:
        return "[MAX_DEPTH_EXCEEDED]"

    if value is None or isinstance(value, (bool, int, float)):
        return value

    if isinstance(value, str):
        return _redact_text(value[:10_000])

    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.isoformat() + " (naive)"
        return value.astimezone(timezone.utc).isoformat()

    if isinstance(value, Mapping):
        safe_mapping: dict[str, Any] = {}

        for item_key, item_value in value.items():
            safe_key = str(item_key)[:256]
            safe_mapping[safe_key] = _safe_value(
                item_value,
                key=item_key,
                depth=depth + 1,
                max_depth=max_depth,
            )

        return safe_mapping

    if isinstance(value, (list, tuple, set, frozenset)):
        items = list(value)
        safe_items = [
            _safe_value(
                item,
                depth=depth + 1,
                max_depth=max_depth,
            )
            for item in items[:500]
        ]

        if len(items) > 500:
            safe_items.append("[ITEMS_TRUNCATED]")

        return safe_items

    # Avoid arbitrary repr() calls: custom objects can expose secrets or run
    # user-defined code. Use the type name rather than serializing the object.
    return f"[UNSERIALIZABLE:{type(value).__name__}]"


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class CorrelationIdFilter(logging.Filter):
    """Attach request and correlation IDs to every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = request_id_context.get()
        correlation_id = _correlation_id_context.get()

        record.request_id = (
            request_id[:_MAX_CONTEXT_VALUE_LENGTH]
            if isinstance(request_id, str)
            else "-"
        )
        record.correlation_id = (
            correlation_id[:_MAX_CONTEXT_VALUE_LENGTH]
            if isinstance(correlation_id, str)
            else "-"
        )

        return True


class RedactingFilter(logging.Filter):
    """Redact common secrets from log messages and structured extras."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            message = "[LOG_MESSAGE_FORMATTING_FAILED]"

        record.msg = _redact_text(message)
        record.args = ()

        # Redact extra fields before the formatter serializes them.
        standard_keys = set(
            logging.makeLogRecord({}).__dict__.keys()
        )

        for key, value in list(record.__dict__.items()):
            if key in standard_keys or key.startswith("_"):
                continue

            if _is_sensitive_key(key):
                record.__dict__[key] = "[REDACTED]"
            else:
                record.__dict__[key] = _safe_value(
                    value,
                    key=key,
                )

        return True


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

class JsonFormatter(logging.Formatter):
    """Format log records as one JSON object per line."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(
            record.created,
            tz=timezone.utc,
        ).isoformat(timespec="milliseconds")

        payload: dict[str, Any] = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": _redact_text(record.getMessage()),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "process": record.process,
            "thread": record.thread,
            "request_id": getattr(record, "request_id", "-"),
            "correlation_id": getattr(record, "correlation_id", "-"),
        }

        # Include application-provided structured fields while excluding
        # standard LogRecord metadata.
        standard_keys = set(
            logging.makeLogRecord({}).__dict__.keys()
        )

        for key, value in record.__dict__.items():
            if key in standard_keys or key.startswith("_"):
                continue

            if key in payload:
                continue

            if _is_sensitive_key(key):
                payload[key] = "[REDACTED]"
            else:
                payload[key] = _safe_value(value, key=key)

        if record.exc_info:
            exc_type, exc_value, exc_tb = record.exc_info
            payload["exception"] = {
                "type": (
                    exc_type.__name__
                    if exc_type is not None
                    else "Exception"
                ),
                # Exception messages can contain secrets or personal data.
                "message": _redact_text(str(exc_value))[:4_000],
                "traceback": _redact_text(
                    "".join(
                        traceback.format_exception(
                            exc_type,
                            exc_value,
                            exc_tb,
                        )
                    )
                )[:12_000],
            }
        elif record.exc_text:
            payload["exception"] = _redact_text(record.exc_text)[:12_000]

        return json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            default=lambda obj: f"[UNSERIALIZABLE:{type(obj).__name__}]",
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
            rendered += "\n" + _redact_text(
                self.formatException(record.exc_info)
            )
        elif record.exc_text:
            rendered += "\n" + _redact_text(record.exc_text)

        return rendered


# ---------------------------------------------------------------------------
# Logger adapter and context helpers
# ---------------------------------------------------------------------------

class MedOrbitsLoggerAdapter(logging.LoggerAdapter):
    """Logger adapter that merges structured context into log records."""

    def process(
        self,
        msg: Any,
        kwargs: dict[str, Any],
    ) -> tuple[Any, dict[str, Any]]:
        extra = dict(self.extra or {})
        supplied_extra = kwargs.get("extra")

        if supplied_extra:
            extra.update(supplied_extra)

        kwargs["extra"] = extra
        return msg, kwargs


def set_request_id(request_id: str | None) -> None:
    """Set the request ID for the current execution context."""
    if request_id is not None:
        request_id = request_id.strip()

        if not request_id:
            request_id = None
        elif len(request_id) > _MAX_CONTEXT_VALUE_LENGTH:
            request_id = request_id[:_MAX_CONTEXT_VALUE_LENGTH]

    request_id_context.set(request_id)


@contextmanager
def log_context(
    *,
    request_id: str | None = None,
    correlation_id: str | None = None,
) -> Iterator[None]:
    """Temporarily set request/correlation IDs for the current context."""
    request_token = None
    correlation_token = None

    if request_id is not None:
        normalized_request_id = request_id.strip()[
            :_MAX_CONTEXT_VALUE_LENGTH
        ]
        request_token = request_id_context.set(
            normalized_request_id or None
        )

    if correlation_id is not None:
        normalized_correlation_id = correlation_id.strip()[
            :_MAX_CONTEXT_VALUE_LENGTH
        ]
        correlation_token = _correlation_id_context.set(
            normalized_correlation_id or None
        )

    try:
        yield
    finally:
        if request_token is not None:
            request_id_context.reset(request_token)

        if correlation_token is not None:
            _correlation_id_context.reset(correlation_token)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _resolve_level(level: str | int | None) -> int:
    """Resolve a logging level from an integer or level-name string."""
    if isinstance(level, int):
        if level < 0:
            raise ValueError("Log level must be non-negative.")
        return level

    value = (
        level
        if level is not None
        else os.getenv("LOG_LEVEL", _DEFAULT_LOG_LEVEL)
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
            f"Invalid LOG_LEVEL {value!r}. Use DEBUG, INFO, WARNING, "
            "ERROR, CRITICAL, or a numeric logging level."
        )

    return resolved


def _resolve_json_mode(
    json_logs: bool | None,
    environment: str,
) -> bool:
    """Determine whether JSON logging should be enabled."""
    if json_logs is not None:
        return json_logs

    explicit = os.getenv("LOG_FORMAT", "").strip().lower()

    if explicit:
        if explicit in {"json", "structured"}:
            return True
        if explicit in {"text", "console", "plain"}:
            return False

        raise ValueError(
            "LOG_FORMAT must be json, structured, text, console, or plain."
        )

    return environment in {"production", "prod", "staging"}


def configure_logging(
    *,
    level: str | int | None = None,
    json_logs: bool | None = None,
    force: bool = False,
) -> logging.Logger:
    """Configure root logging for MedOrbits.

    Args:
        level: Explicit logging level. Defaults to LOG_LEVEL or INFO.
        json_logs: Override automatic JSON/text format selection.
        force: Replace existing root handlers when True.

    Returns:
        The configured root logger.

    Notes:
        Call once during application startup. Do not call per request.
        `force=True` removes existing root handlers and should be used only
        when the application intentionally owns global logging configuration.
    """
    environment = os.getenv("NODE_ENV", os.getenv("APP_ENV", "development"))
    environment = environment.strip().lower()

    resolved_level = _resolve_level(level)
    use_json = _resolve_json_mode(json_logs, environment)

    root_logger = logging.getLogger()
    root_logger.setLevel(resolved_level)

    if root_logger.handlers and not force:
        # Avoid duplicate output when a host application already configured
        # logging. Update levels and attach required filters to existing
        # handlers without replacing their formatters.
        for handler in root_logger.handlers:
            handler.setLevel(resolved_level)

            if not any(
                isinstance(item, CorrelationIdFilter)
                for item in handler.filters
            ):
                handler.addFilter(CorrelationIdFilter())

            if not any(
                isinstance(item, RedactingFilter)
                for item in handler.filters
            ):
                handler.addFilter(RedactingFilter())

        return root_logger

    if force:
        for handler in root_logger.handlers[:]:
            root_logger.removeHandler(handler)
            try:
                handler.close()
            except Exception:
                pass

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(resolved_level)
    handler.addFilter(CorrelationIdFilter())
    handler.addFilter(RedactingFilter())

    if use_json:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(ConsoleFormatter())

    root_logger.addHandler(handler)

    # Avoid noisy default output from common HTTP and database libraries.
    for logger_name in (
        "urllib3",
        "httpx",
        "httpcore",
        "asyncio",
    ):
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

    safe_context = {
        str(key): _safe_value(value, key=key)
        for key, value in context.items()
    }

    return MedOrbitsLoggerAdapter(logger, safe_context)


# ---------------------------------------------------------------------------
# Optional convenience entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    configure_logging()

    logger = get_logger(
        "medorbits.logging_config",
        context={"service": "medorbits-python"},
    )

    logger.info("Logging configuration initialized.")

