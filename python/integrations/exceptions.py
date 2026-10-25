
"""
MedOrbits Integration Exceptions
================================

Centralized exception hierarchy for external integrations, API clients,
provider adapters, authentication, transport, response validation, and
retry handling.

Design principles:
    - A single IntegrationError base class for integration failures.
    - Specific subclasses for predictable error handling.
    - Stable machine-readable error codes.
    - Optional, sanitized diagnostic context.
    - Explicit retryability metadata.
    - HTTP status and retry-after metadata where applicable.
    - Compatibility with Python 3.10+.
    - No external dependencies or network activity.

Security:
    - Never include credentials, tokens, or personal information in messages.
    - Do not store raw response bodies or authorization headers in exceptions.
    - Avoid exposing internal paths, database details, or provider secrets.
    - Chain underlying exceptions with `raise ... from exc` when appropriate.
"""

from __future__ import annotations

import math
import re

from collections.abc import Mapping
from typing import Any, Final


__all__ = [
    "IntegrationError",
    "IntegrationConfigurationError",
    "IntegrationAuthenticationError",
    "IntegrationAuthorizationError",
    "IntegrationConnectionError",
    "IntegrationTimeoutError",
    "IntegrationRateLimitError",
    "IntegrationResponseError",
    "IntegrationSerializationError",
    "IntegrationValidationError",
    "IntegrationNotFoundError",
    "IntegrationConflictError",
    "IntegrationServiceUnavailableError",
    "IntegrationRetryExhaustedError",
    "IntegrationClosedError",
    "IntegrationDependencyError",
    "IntegrationOperationError",
    "ErrorContext",
]


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_ERROR_CODE: Final[str] = "INTEGRATION_ERROR"
MAX_ERROR_MESSAGE_LENGTH: Final[int] = 1000
MAX_ERROR_CODE_LENGTH: Final[int] = 100
MAX_CONTEXT_FIELDS: Final[int] = 30
MAX_CONTEXT_STRING_LENGTH: Final[int] = 256

_ERROR_CODE_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^[A-Z][A-Z0-9_]*$"
)

_SENSITIVE_KEY_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"(password|passwd|secret|token|api[_-]?key|authorization|cookie|"
    r"credential|private[_-]?key|access[_-]?key|session|email|phone|"
    r"address|personal|payload|body|document|identity)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Safe diagnostic context
# ---------------------------------------------------------------------------


class ErrorContext(dict[str, str | int | float | bool | None]):
    """
    Sanitized diagnostic metadata for integration errors.

    Only explicitly supported scalar values are retained. Fields with names
    that appear sensitive are omitted. Context must never contain raw
    request bodies, credentials, or personally identifying information.

    Example:
        ErrorContext({
            "provider": "admissions",
            "operation": "fetch_courses",
            "attempt": 2,
        })
    """

    def __init__(
        self,
        values: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__()

        if values is None:
            return

        if not isinstance(values, Mapping):
            raise TypeError("Error context must be a mapping")

        if len(values) > MAX_CONTEXT_FIELDS:
            raise ValueError(
                f"Error context cannot exceed {MAX_CONTEXT_FIELDS} fields"
            )

        for key, value in values.items():
            if not isinstance(key, str) or not key.strip():
                raise ValueError("Context keys must be non-empty strings")

            normalized_key = key.strip()

            if _SENSITIVE_KEY_PATTERN.search(normalized_key):
                continue

            safe_value = self._normalize_value(value)

            if safe_value is not _OMIT:
                self[normalized_key] = safe_value

    @staticmethod
    def _normalize_value(
        value: Any,
    ) -> str | int | float | bool | None | object:
        """Allow bounded scalar metadata only."""
        if value is None or isinstance(value, bool):
            return value

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            return value if math.isfinite(value) else _OMIT

        if isinstance(value, str):
            if len(value) > MAX_CONTEXT_STRING_LENGTH:
                return value[:MAX_CONTEXT_STRING_LENGTH]
            if any(ord(char) < 32 and char not in "\t" for char in value):
                return _OMIT
            return value

        # Avoid arbitrary object representations, which may expose secrets.
        return _OMIT


_OMIT = object()


# ---------------------------------------------------------------------------
# Base exception
# ---------------------------------------------------------------------------


class IntegrationError(Exception):
    """
    Base class for all MedOrbits integration failures.

    Attributes:
        message:
            Safe, human-readable error description.
        code:
            Stable machine-readable error identifier.
        retryable:
            Whether the operation may be retried when the operation itself
            is safe to repeat.
        context:
            Sanitized scalar diagnostic metadata.
        provider:
            Optional non-sensitive integration/provider identifier.
        operation:
            Optional non-sensitive operation name.
    """

    default_code: Final[str] = DEFAULT_ERROR_CODE
    default_retryable: Final[bool] = False

    def __init__(
        self,
        message: str = "An integration error occurred",
        *,
        code: str | None = None,
        retryable: bool | None = None,
        context: Mapping[str, Any] | None = None,
        provider: str | None = None,
        operation: str | None = None,
    ) -> None:
        if not isinstance(message, str):
            raise TypeError("Exception message must be a string")

        normalized_message = message.strip()

        if not normalized_message:
            normalized_message = "An integration error occurred"

        self.message = normalized_message[:MAX_ERROR_MESSAGE_LENGTH]

        selected_code = code or self.default_code

        if (
            not isinstance(selected_code, str)
            or len(selected_code) > MAX_ERROR_CODE_LENGTH
            or not _ERROR_CODE_PATTERN.fullmatch(selected_code)
        ):
            raise ValueError(
                "Error code must use uppercase letters, digits, and underscores"
            )

        self.code = selected_code

        if retryable is None:
            self.retryable = self.default_retryable
        elif isinstance(retryable, bool):
            self.retryable = retryable
        else:
            raise TypeError("retryable must be a boolean")

        self.context = ErrorContext(context)

        self.provider = self._optional_identifier(
            provider,
            field_name="provider",
        )
        self.operation = self._optional_identifier(
            operation,
            field_name="operation",
        )

        super().__init__(self.message)

    @staticmethod
    def _optional_identifier(
        value: str | None,
        *,
        field_name: str,
    ) -> str | None:
        """Validate and bound non-sensitive identifiers."""
        if value is None:
            return None

        if not isinstance(value, str):
            raise TypeError(f"{field_name} must be a string or None")

        normalized = value.strip()

        if not normalized:
            return None

        if len(normalized) > 128:
            raise ValueError(f"{field_name} exceeds 128 characters")

        if any(ord(char) < 32 or ord(char) == 127 for char in normalized):
            raise ValueError(f"{field_name} contains control characters")

        return normalized

    def to_dict(self) -> dict[str, Any]:
        """
        Return a structured, logging-friendly representation.

        The original exception, traceback, and chained exception are excluded.
        """
        result: dict[str, Any] = {
            "type": type(self).__name__,
            "code": self.code,
            "message": self.message,
            "retryable": self.retryable,
        }

        if self.provider is not None:
            result["provider"] = self.provider

        if self.operation is not None:
            result["operation"] = self.operation

        if self.context:
            result["context"] = dict(self.context)

        return result


# ---------------------------------------------------------------------------
# Configuration and input errors
# ---------------------------------------------------------------------------


class IntegrationConfigurationError(IntegrationError):
    """Raised when integration settings are missing, invalid, or unsafe."""

    default_code = "INTEGRATION_CONFIGURATION_ERROR"


class IntegrationValidationError(IntegrationError):
    """Raised when data fails input or business-rule validation."""

    default_code = "INTEGRATION_VALIDATION_ERROR"


class IntegrationSerializationError(IntegrationError):
    """Raised when data cannot be serialized or deserialized."""

    default_code = "INTEGRATION_SERIALIZATION_ERROR"


# ---------------------------------------------------------------------------
# Authentication and authorization
# ---------------------------------------------------------------------------


class IntegrationAuthenticationError(IntegrationError):
    """Raised when authentication fails or credentials are rejected."""

    default_code = "INTEGRATION_AUTHENTICATION_ERROR"


class IntegrationAuthorizationError(IntegrationError):
    """Raised when the authenticated identity lacks required permissions."""

    default_code = "INTEGRATION_AUTHORIZATION_ERROR"


# ---------------------------------------------------------------------------
# Transport and timeout errors
# ---------------------------------------------------------------------------


class IntegrationConnectionError(IntegrationError):
    """Raised when a connection to a provider cannot be established."""

    default_code = "INTEGRATION_CONNECTION_ERROR"
    default_retryable = True


class IntegrationTimeoutError(IntegrationConnectionError):
    """Raised when a provider operation exceeds its configured timeout."""

    default_code = "INTEGRATION_TIMEOUT_ERROR"
    default_retryable = True


# ---------------------------------------------------------------------------
# Provider response errors
# ---------------------------------------------------------------------------


class IntegrationResponseError(IntegrationError):
    """Raised when a provider returns an invalid or unexpected response."""

    default_code = "INTEGRATION_RESPONSE_ERROR"

    def __init__(
        self,
        message: str = "The integration provider returned an invalid response",
        *,
        status_code: int | None = None,
        **kwargs: Any,
    ) -> None:
        if status_code is not None:
            if (
                isinstance(status_code, bool)
                or not isinstance(status_code, int)
                or not 100 <= status_code <= 599
            ):
                raise ValueError("status_code must be an HTTP status from 100 to 599")

        self.status_code = status_code
        super().__init__(message, **kwargs)

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()

        if self.status_code is not None:
            result["status_code"] = self.status_code

        return result


class IntegrationNotFoundError(IntegrationResponseError):
    """Raised when the requested provider resource does not exist."""

    default_code = "INTEGRATION_RESOURCE_NOT_FOUND"

    def __init__(
        self,
        message: str = "The requested integration resource was not found",
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 404)
        super().__init__(message, **kwargs)


class IntegrationConflictError(IntegrationResponseError):
    """Raised when a provider operation conflicts with existing state."""

    default_code = "INTEGRATION_CONFLICT"

    def __init__(
        self,
        message: str = "The integration operation conflicts with existing state",
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 409)
        super().__init__(message, **kwargs)


class IntegrationRateLimitError(IntegrationResponseError):
    """Raised when the provider limits request frequency."""

    default_code = "INTEGRATION_RATE_LIMITED"
    default_retryable = True

    def __init__(
        self,
        message: str = "The integration provider rate-limited the request",
        *,
        retry_after: float | None = None,
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 429)

        if retry_after is not None:
            if (
                isinstance(retry_after, bool)
                or not isinstance(retry_after, (int, float))
                or not math.isfinite(float(retry_after))
                or retry_after < 0
            ):
                raise ValueError("retry_after must be a finite non-negative number")

            retry_after = float(retry_after)

        self.retry_after = retry_after
        super().__init__(message, **kwargs)

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()

        if self.retry_after is not None:
            result["retry_after"] = self.retry_after

        return result


class IntegrationServiceUnavailableError(IntegrationResponseError):
    """Raised when a provider is temporarily unavailable."""

    default_code = "INTEGRATION_SERVICE_UNAVAILABLE"
    default_retryable = True

    def __init__(
        self,
        message: str = "The integration provider is temporarily unavailable",
        **kwargs: Any,
    ) -> None:
        kwargs.setdefault("status_code", 503)
        super().__init__(message, **kwargs)


# ---------------------------------------------------------------------------
# Lifecycle, dependencies, and operation errors
# ---------------------------------------------------------------------------


class IntegrationClosedError(IntegrationError):
    """Raised when an operation is attempted on a closed integration."""

    default_code = "INTEGRATION_CLOSED"


class IntegrationDependencyError(IntegrationError):
    """Raised when a required integration dependency is unavailable."""

    default_code = "INTEGRATION_DEPENDENCY_ERROR"


class IntegrationOperationError(IntegrationError):
    """Raised when an integration operation fails for another known reason."""

    default_code = "INTEGRATION_OPERATION_ERROR"


# ---------------------------------------------------------------------------
# Retry exhaustion
# ---------------------------------------------------------------------------


class IntegrationRetryExhaustedError(IntegrationError):
    """
    Raised after a retry-safe operation fails on every permitted attempt.

    `last_error` is retained for internal exception chaining and diagnostics.
    Do not serialize or log its message without reviewing it for sensitive data.
    """

    default_code = "INTEGRATION_RETRY_EXHAUSTED"

    def __init__(
        self,
        message: str = "The integration operation exhausted its retry attempts",
        *,
        attempts: int,
        last_error: Exception | None = None,
        **kwargs: Any,
    ) -> None:
        if (
            isinstance(attempts, bool)
            or not isinstance(attempts, int)
            or attempts < 1
        ):
            raise ValueError("attempts must be an integer of at least 1")

        if last_error is not None and not isinstance(last_error, Exception):
            raise TypeError("last_error must be an exception or None")

        self.attempts = attempts
        self.last_error = last_error

        super().__init__(
            message,
            retryable=False,
            **kwargs,
        )

    def to_dict(self) -> dict[str, Any]:
        result = super().to_dict()
        result["attempts"] = self.attempts

        if self.last_error is not None:
            result["last_error_type"] = type(self.last_error).__name__

        return result
