
"""
MedOrbits Integration Configuration
===================================

Centralized, validated configuration for MedOrbits integration clients.

Features:
    - Environment-variable configuration.
    - Immutable, typed configuration objects.
    - HTTP and HTTPS endpoint validation.
    - Timeout and retry policy validation.
    - Safe header validation and secret redaction.
    - Explicit development and production safeguards.
    - No network requests or external dependencies.
    - Compatibility with Python 3.10+.

Security:
    - Never hardcode production credentials.
    - Never log raw authorization headers or secret values.
    - Require HTTPS for production endpoints.
    - Do not disable TLS verification in production.
    - Treat environment variables as configuration, not as a secrets vault.
"""

from __future__ import annotations

import math
import os
import re

from dataclasses import dataclass, field
from typing import Final, Mapping
from urllib.parse import urlsplit


__all__ = [
    "IntegrationConfigError",
    "RetryConfig",
    "IntegrationConfig",
    "IntegrationSettings",
    "load_integration_settings",
    "redact_secrets",
]


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_TIMEOUT: Final[float] = 10.0
DEFAULT_CONNECT_TIMEOUT: Final[float] = 5.0
DEFAULT_READ_TIMEOUT: Final[float] = 10.0
DEFAULT_MAX_ATTEMPTS: Final[int] = 3
DEFAULT_INITIAL_RETRY_DELAY: Final[float] = 0.25
DEFAULT_MAX_RETRY_DELAY: Final[float] = 5.0

MAX_TIMEOUT: Final[float] = 300.0
MAX_RETRY_ATTEMPTS: Final[int] = 10
MAX_HEADER_COUNT: Final[int] = 100

_SECRET_HEADER_NAMES: Final[frozenset[str]] = frozenset(
    {
        "authorization",
        "proxy-authorization",
        "x-api-key",
        "api-key",
        "x-auth-token",
        "cookie",
        "set-cookie",
    }
)

_ENVIRONMENT_NAMES: Final[frozenset[str]] = frozenset(
    {
        "development",
        "test",
        "staging",
        "production",
    }
)

_HEADER_TOKEN_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$"
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class IntegrationConfigError(ValueError):
    """Raised when integration configuration is invalid or unsafe."""


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _require_non_empty_string(
    value: object,
    *,
    field_name: str,
    max_length: int = 2048,
) -> str:
    """Validate a non-empty string and return its trimmed value."""
    if not isinstance(value, str):
        raise IntegrationConfigError(
            f"{field_name} must be a string"
        )

    normalized = value.strip()

    if not normalized:
        raise IntegrationConfigError(
            f"{field_name} must not be empty"
        )

    if len(normalized) > max_length:
        raise IntegrationConfigError(
            f"{field_name} exceeds the maximum length of {max_length}"
        )

    if "\x00" in normalized:
        raise IntegrationConfigError(
            f"{field_name} must not contain null characters"
        )

    return normalized


def _validate_positive_number(
    value: object,
    *,
    field_name: str,
    maximum: float = MAX_TIMEOUT,
) -> float:
    """Validate a finite, positive numeric value."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise IntegrationConfigError(
            f"{field_name} must be a number"
        )

    numeric_value = float(value)

    if not math.isfinite(numeric_value):
        raise IntegrationConfigError(
            f"{field_name} must be finite"
        )

    if numeric_value <= 0:
        raise IntegrationConfigError(
            f"{field_name} must be greater than zero"
        )

    if numeric_value > maximum:
        raise IntegrationConfigError(
            f"{field_name} must not exceed {maximum}"
        )

    return numeric_value


def _validate_base_url(
    value: str | None,
    *,
    require_https: bool = False,
) -> str | None:
    """Validate an absolute HTTP(S) service endpoint."""
    if value is None:
        return None

    url = _require_non_empty_string(
        value,
        field_name="base_url",
        max_length=2048,
    )

    if any(character.isspace() for character in url):
        raise IntegrationConfigError(
            "base_url must not contain whitespace"
        )

    try:
        parsed = urlsplit(url)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError as exc:
        raise IntegrationConfigError(
            "base_url contains invalid URL syntax"
        ) from exc

    scheme = parsed.scheme.lower()

    if scheme not in {"http", "https"}:
        raise IntegrationConfigError(
            "base_url must use HTTP or HTTPS"
        )

    if require_https and scheme != "https":
        raise IntegrationConfigError(
            "HTTPS is required for this environment"
        )

    if not parsed.netloc or not hostname:
        raise IntegrationConfigError(
            "base_url must include a hostname"
        )

    if parsed.username is not None or parsed.password is not None:
        raise IntegrationConfigError(
            "base_url must not contain embedded credentials"
        )

    if parsed.query or parsed.fragment:
        raise IntegrationConfigError(
            "base_url must not contain a query string or fragment"
        )

    if hostname.startswith(".") or hostname.endswith(".") or ".." in hostname:
        raise IntegrationConfigError(
            "base_url contains an invalid hostname"
        )

    return url.rstrip("/")


def _validate_headers(
    headers: Mapping[str, str],
) -> dict[str, str]:
    """Validate HTTP header names and values without logging their contents."""
    if not isinstance(headers, Mapping):
        raise IntegrationConfigError(
            "headers must be a mapping"
        )

    if len(headers) > MAX_HEADER_COUNT:
        raise IntegrationConfigError(
            f"headers cannot contain more than {MAX_HEADER_COUNT} entries"
        )

    normalized: dict[str, str] = {}
    normalized_names: set[str] = set()

    for name, value in headers.items():
        if not isinstance(name, str) or not isinstance(value, str):
            raise IntegrationConfigError(
                "Header names and values must be strings"
            )

        header_name = name.strip()
        header_value = value.strip()

        if not header_name or not _HEADER_TOKEN_PATTERN.fullmatch(header_name):
            raise IntegrationConfigError(
                "A header name contains invalid characters"
            )

        if "\r" in value or "\n" in value or "\x00" in value:
            raise IntegrationConfigError(
                "Header values must not contain control characters"
            )

        if len(header_value) > 8192:
            raise IntegrationConfigError(
                "A header value exceeds the permitted length"
            )

        lower_name = header_name.lower()

        if lower_name in normalized_names:
            raise IntegrationConfigError(
                "Duplicate header names are not permitted"
            )

        normalized_names.add(lower_name)
        normalized[header_name] = header_value

    return normalized


def redact_secrets(
    headers: Mapping[str, str],
) -> dict[str, str]:
    """
    Return a logging-safe copy of HTTP headers.

    Header values are replaced for common credential-bearing headers.
    This helper is not a substitute for avoiding sensitive logging.
    """
    safe_headers: dict[str, str] = {}

    for name, value in headers.items():
        if name.lower() in _SECRET_HEADER_NAMES:
            safe_headers[name] = "[REDACTED]"
        else:
            safe_headers[name] = value

    return safe_headers


def _parse_bool_environment(
    name: str,
    default: bool,
) -> bool:
    """Parse a boolean environment variable strictly."""
    raw = os.getenv(name)

    if raw is None:
        return default

    normalized = raw.strip().lower()

    if normalized in {"1", "true", "yes", "on"}:
        return True

    if normalized in {"0", "false", "no", "off"}:
        return False

    raise IntegrationConfigError(
        f"{name} must be a valid boolean value"
    )


def _parse_int_environment(
    name: str,
    default: int,
) -> int:
    """Parse an integer environment variable strictly."""
    raw = os.getenv(name)

    if raw is None:
        return default

    try:
        # Reject decimal notation, booleans, and other non-integer strings.
        return int(raw.strip())
    except ValueError as exc:
        raise IntegrationConfigError(
            f"{name} must be an integer"
        ) from exc


def _parse_float_environment(
    name: str,
    default: float,
) -> float:
    """Parse a floating-point environment variable strictly."""
    raw = os.getenv(name)

    if raw is None:
        return default

    try:
        return float(raw.strip())
    except ValueError as exc:
        raise IntegrationConfigError(
            f"{name} must be a number"
        ) from exc


# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class RetryConfig:
    """Validated retry settings for transient, retry-safe operations."""

    max_attempts: int = DEFAULT_MAX_ATTEMPTS
    initial_delay: float = DEFAULT_INITIAL_RETRY_DELAY
    maximum_delay: float = DEFAULT_MAX_RETRY_DELAY
    multiplier: float = 2.0
    jitter: float = 0.1

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_attempts, bool)
            or not isinstance(self.max_attempts, int)
            or not 1 <= self.max_attempts <= MAX_RETRY_ATTEMPTS
        ):
            raise IntegrationConfigError(
                f"max_attempts must be between 1 and {MAX_RETRY_ATTEMPTS}"
            )

        for name in (
            "initial_delay",
            "maximum_delay",
            "multiplier",
            "jitter",
        ):
            value = getattr(self, name)

            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise IntegrationConfigError(
                    f"{name} must be a number"
                )

            if not math.isfinite(float(value)):
                raise IntegrationConfigError(
                    f"{name} must be finite"
                )

        if self.initial_delay < 0:
            raise IntegrationConfigError(
                "initial_delay must not be negative"
            )

        if self.maximum_delay < self.initial_delay:
            raise IntegrationConfigError(
                "maximum_delay must be at least initial_delay"
            )

        if self.maximum_delay > MAX_TIMEOUT:
            raise IntegrationConfigError(
                f"maximum_delay must not exceed {MAX_TIMEOUT}"
            )

        if self.multiplier < 1:
            raise IntegrationConfigError(
                "multiplier must be at least 1"
            )

        if not 0 <= self.jitter <= 1:
            raise IntegrationConfigError(
                "jitter must be between 0 and 1"
            )


# ---------------------------------------------------------------------------
# Per-integration configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class IntegrationConfig:
    """
    Configuration for a single provider or integration.

    Credentials are intentionally excluded. Provider-specific clients should
    load secrets through an appropriate secrets provider or environment
    variables and must never include them in logs.
    """

    name: str
    base_url: str | None = None
    timeout: float = DEFAULT_TIMEOUT
    connect_timeout: float = DEFAULT_CONNECT_TIMEOUT
    read_timeout: float = DEFAULT_READ_TIMEOUT
    enabled: bool = True
    verify_tls: bool = True
    headers: Mapping[str, str] = field(default_factory=dict)
    retry: RetryConfig = field(default_factory=RetryConfig)

    def __post_init__(self) -> None:
        name = _require_non_empty_string(
            self.name,
            field_name="name",
            max_length=128,
        )

        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", name):
            raise IntegrationConfigError(
                "name contains unsupported characters"
            )

        object.__setattr__(self, "name", name)

        for field_name in (
            "timeout",
            "connect_timeout",
            "read_timeout",
        ):
            value = _validate_positive_number(
                getattr(self, field_name),
                field_name=field_name,
            )
            object.__setattr__(self, field_name, value)

        if not isinstance(self.enabled, bool):
            raise IntegrationConfigError(
                "enabled must be a boolean"
            )

        if not isinstance(self.verify_tls, bool):
            raise IntegrationConfigError(
                "verify_tls must be a boolean"
            )

        if not isinstance(self.retry, RetryConfig):
            raise IntegrationConfigError(
                "retry must be a RetryConfig instance"
            )

        object.__setattr__(
            self,
            "base_url",
            _validate_base_url(self.base_url),
        )

        validated_headers = _validate_headers(self.headers)

        # Copy and freeze the mapping so callers cannot mutate it afterward.
        from types import MappingProxyType

        object.__setattr__(
            self,
            "headers",
            MappingProxyType(validated_headers),
        )

    def safe_headers(self) -> dict[str, str]:
        """Return headers with common secret-bearing values redacted."""
        return redact_secrets(self.headers)


# ---------------------------------------------------------------------------
# Application-wide integration settings
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class IntegrationSettings:
    """Shared settings used by the MedOrbits integration subsystem."""

    environment: str = "development"
    default_timeout: float = DEFAULT_TIMEOUT
    connect_timeout: float = DEFAULT_CONNECT_TIMEOUT
    read_timeout: float = DEFAULT_READ_TIMEOUT
    verify_tls: bool = True
    user_agent: str = "MedOrbits-Integrations/1.0.0"

    def __post_init__(self) -> None:
        if not isinstance(self.environment, str):
            raise IntegrationConfigError(
                "environment must be a string"
            )

        environment = self.environment.strip().lower()

        if environment not in _ENVIRONMENT_NAMES:
            raise IntegrationConfigError(
                "environment must be development, test, staging, or production"
            )

        object.__setattr__(self, "environment", environment)

        for field_name in (
            "default_timeout",
            "connect_timeout",
            "read_timeout",
        ):
            object.__setattr__(
                self,
                field_name,
                _validate_positive_number(
                    getattr(self, field_name),
                    field_name=field_name,
                ),
            )

        if not isinstance(self.verify_tls, bool):
            raise IntegrationConfigError(
                "verify_tls must be a boolean"
            )

        if environment == "production" and not self.verify_tls:
            raise IntegrationConfigError(
                "TLS verification cannot be disabled in production"
            )

        user_agent = _require_non_empty_string(
            self.user_agent,
            field_name="user_agent",
            max_length=256,
        )

        if any(ord(character) < 32 or ord(character) == 127 for character in user_agent):
            raise IntegrationConfigError(
                "user_agent must not contain control characters"
            )

        object.__setattr__(self, "user_agent", user_agent)

    @property
    def is_production(self) -> bool:
        """Return whether the current environment is production."""
        return self.environment == "production"


# ---------------------------------------------------------------------------
# Environment-based settings loader
# ---------------------------------------------------------------------------


def load_integration_settings() -> IntegrationSettings:
    """
    Build integration settings from MEDORBITS_* environment variables.

    Supported variables:
        MEDORBITS_ENV
        MEDORBITS_INTEGRATION_TIMEOUT
        MEDORBITS_INTEGRATION_CONNECT_TIMEOUT
        MEDORBITS_INTEGRATION_READ_TIMEOUT
        MEDORBITS_INTEGRATION_VERIFY_TLS
        MEDORBITS_INTEGRATION_USER_AGENT

    Missing values use conservative defaults. Invalid explicitly supplied
    values raise IntegrationConfigError instead of being silently ignored.
    """
    environment = os.getenv(
        "MEDORBITS_ENV",
        "development",
    ).strip().lower()

    verify_tls = _parse_bool_environment(
        "MEDORBITS_INTEGRATION_VERIFY_TLS",
        True,
    )

    return IntegrationSettings(
        environment=environment,
        default_timeout=_parse_float_environment(
            "MEDORBITS_INTEGRATION_TIMEOUT",
            DEFAULT_TIMEOUT,
        ),
        connect_timeout=_parse_float_environment(
            "MEDORBITS_INTEGRATION_CONNECT_TIMEOUT",
            DEFAULT_CONNECT_TIMEOUT,
        ),
        read_timeout=_parse_float_environment(
            "MEDORBITS_INTEGRATION_READ_TIMEOUT",
            DEFAULT_READ_TIMEOUT,
        ),
        verify_tls=verify_tls,
        user_agent=os.getenv(
            "MEDORBITS_INTEGRATION_USER_AGENT",
            "MedOrbits-Integrations/1.0.0",
        ),
    )
