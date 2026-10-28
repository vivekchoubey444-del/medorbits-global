
"""MedOrbits exception hierarchy.

File: src/python/medorbits/exception.py

Purpose:
    Provide consistent, safe exceptions for MedOrbits Python services.

Security:
    - Never include secrets, credentials, tokens, or connection strings in
      public error messages.
    - Avoid exposing internal implementation details to API clients.
    - Preserve exception chaining for internal debugging.
    - Keep exception types independent of web frameworks.
"""

from __future__ import annotations

from typing import Final


__all__ = [
    "MedOrbitsError",
    "ConfigurationError",
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "ResourceNotFoundError",
    "ResourceConflictError",
    "RateLimitError",
    "DependencyError",
    "DependencyTimeoutError",
    "ServiceUnavailableError",
    "ImportDataError",
    "ExportDataError",
    "StorageError",
    "ExternalServiceError",
    "ErrorCode",
    "safe_error_message",
]


class ErrorCode:
    """Stable, non-sensitive application error codes."""

    INTERNAL: Final[str] = "INTERNAL_ERROR"
    CONFIGURATION: Final[str] = "CONFIGURATION_ERROR"
    VALIDATION: Final[str] = "VALIDATION_ERROR"
    AUTHENTICATION: Final[str] = "AUTHENTICATION_ERROR"
    AUTHORIZATION: Final[str] = "AUTHORIZATION_ERROR"
    NOT_FOUND: Final[str] = "NOT_FOUND"
    CONFLICT: Final[str] = "CONFLICT"
    RATE_LIMITED: Final[str] = "RATE_LIMITED"
    DEPENDENCY: Final[str] = "DEPENDENCY_ERROR"
    DEPENDENCY_TIMEOUT: Final[str] = "DEPENDENCY_TIMEOUT"
    SERVICE_UNAVAILABLE: Final[str] = "SERVICE_UNAVAILABLE"
    IMPORT_FAILED: Final[str] = "IMPORT_FAILED"
    EXPORT_FAILED: Final[str] = "EXPORT_FAILED"
    STORAGE: Final[str] = "STORAGE_ERROR"
    EXTERNAL_SERVICE: Final[str] = "EXTERNAL_SERVICE_ERROR"


class MedOrbitsError(Exception):
    """Base exception for expected MedOrbits application failures."""

    default_code: Final[str] = ErrorCode.INTERNAL
    default_public_message: Final[str] = "An unexpected application error occurred."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        public_message: str | None = None,
    ) -> None:
        internal_message = message or self.default_public_message

        if not isinstance(internal_message, str):
            raise TypeError("Exception message must be a string.")

        if code is not None and (
            not isinstance(code, str)
            or not code
            or len(code) > 64
            or not code.replace("_", "").isalnum()
            or not code.isascii()
        ):
            raise ValueError("Exception code is invalid.")

        if public_message is not None and not isinstance(public_message, str):
            raise TypeError("Public error message must be a string.")

        self.code = code or self.default_code
        self.public_message = safe_error_message(
            public_message or self.default_public_message
        )

        # Internal messages are available to trusted server-side exception
        # handling only. Do not serialize str(exc) directly to API clients.
        super().__init__(internal_message)


class ConfigurationError(MedOrbitsError):
    """Invalid or incomplete application configuration."""

    default_code = ErrorCode.CONFIGURATION
    default_public_message = "Application configuration is invalid."


class ValidationError(MedOrbitsError):
    """Request, payload, or domain validation failure."""

    default_code = ErrorCode.VALIDATION
    default_public_message = "The supplied data is invalid."


class AuthenticationError(MedOrbitsError):
    """Missing or invalid authentication credentials."""

    default_code = ErrorCode.AUTHENTICATION
    default_public_message = "Authentication is required or invalid."


class AuthorizationError(MedOrbitsError):
    """Authenticated caller lacks required permissions."""

    default_code = ErrorCode.AUTHORIZATION
    default_public_message = "You are not authorized to perform this action."


class ResourceNotFoundError(MedOrbitsError):
    """Requested resource does not exist or is not accessible."""

    default_code = ErrorCode.NOT_FOUND
    default_public_message = "The requested resource was not found."


class ResourceConflictError(MedOrbitsError):
    """Request conflicts with the current resource state."""

    default_code = ErrorCode.CONFLICT
    default_public_message = "The request conflicts with the current resource state."


class RateLimitError(MedOrbitsError):
    """Caller has exceeded an application rate limit."""

    default_code = ErrorCode.RATE_LIMITED
    default_public_message = "Too many requests. Please try again later."


class DependencyError(MedOrbitsError):
    """A required application dependency failed."""

    default_code = ErrorCode.DEPENDENCY
    default_public_message = "A required dependency is unavailable."


class DependencyTimeoutError(DependencyError):
    """A dependency operation exceeded its configured timeout."""

    default_code = ErrorCode.DEPENDENCY_TIMEOUT
    default_public_message = "A required dependency timed out."


class ServiceUnavailableError(MedOrbitsError):
    """The application cannot currently fulfill a request."""

    default_code = ErrorCode.SERVICE_UNAVAILABLE
    default_public_message = "The service is temporarily unavailable."


class ImportDataError(MedOrbitsError):
    """A data import operation failed."""

    default_code = ErrorCode.IMPORT_FAILED
    default_public_message = "The data could not be imported."


class ExportDataError(MedOrbitsError):
    """A data export operation failed."""

    default_code = ErrorCode.EXPORT_FAILED
    default_public_message = "The data could not be exported."


class StorageError(MedOrbitsError):
    """A local or remote storage operation failed."""

    default_code = ErrorCode.STORAGE
    default_public_message = "A storage operation could not be completed."


class ExternalServiceError(MedOrbitsError):
    """An external API or service operation failed."""

    default_code = ErrorCode.EXTERNAL_SERVICE
    default_public_message = "An external service request failed."


def safe_error_message(
    message: str,
    *,
    fallback: str = "The request could not be completed.",
    max_length: int = 300,
) -> str:
    """Normalize a public-facing error message.

    This function removes control characters and bounds message length.
    It does not automatically detect or redact every possible secret, so
    callers must use fixed, reviewed public messages rather than raw
    exception text.
    """
    if not isinstance(message, str):
        raise TypeError("message must be a string.")

    if not isinstance(fallback, str) or not fallback.strip():
        raise ValueError("fallback must be a non-empty string.")

    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or not 1 <= max_length <= 2000
    ):
        raise ValueError("max_length must be between 1 and 2000.")

    cleaned = "".join(
        character
        for character in message
        if character in "\t" or ord(character) >= 32
    ).replace("\x7f", "")

    cleaned = " ".join(cleaned.split()).strip()

    if not cleaned:
        cleaned = " ".join(fallback.split()).strip()

    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()

    return cleaned or "The request could not be completed."
