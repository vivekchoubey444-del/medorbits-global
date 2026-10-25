
"""
MedOrbits Integration Base
==========================

Shared foundation for external service integrations, API clients, and
internal adapters.

Features:
    - Typed integration configuration and results.
    - Consistent integration exceptions.
    - Configurable request timeouts.
    - Bounded retries with exponential backoff.
    - Retry handling for explicitly retryable operations.
    - Safe logging without credentials or response-body disclosure.
    - Lifecycle management and context-manager support.
    - Dependency injection for testability.
    - No network activity during module import.

Compatibility:
    Python 3.10+

Security:
    - Never hardcode credentials.
    - Avoid logging tokens, authorization headers, or personal data.
    - Set explicit timeouts for all network operations.
    - Only retry operations when repeating them is safe.
    - Provider-specific clients must implement their own transport and
      response validation.
"""

from __future__ import annotations

import logging
import random
import threading
import time

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Generic, Mapping, TypeVar
from urllib.parse import urlsplit


__all__ = [
    "IntegrationBase",
    "IntegrationConfig",
    "IntegrationError",
    "IntegrationConfigurationError",
    "IntegrationConnectionError",
    "IntegrationTimeoutError",
    "IntegrationResponseError",
    "IntegrationRetryExhaustedError",
    "IntegrationClosedError",
    "IntegrationStatus",
    "IntegrationResult",
    "RetryPolicy",
]


T = TypeVar("T")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class IntegrationError(Exception):
    """Base exception for integration-related failures."""


class IntegrationConfigurationError(IntegrationError):
    """Raised when integration configuration is invalid."""


class IntegrationConnectionError(IntegrationError):
    """Raised when a connection to an external service fails."""


class IntegrationTimeoutError(IntegrationConnectionError):
    """Raised when an integration operation exceeds its timeout."""


class IntegrationResponseError(IntegrationError):
    """Raised when a provider response is invalid or unsuccessful."""


class IntegrationRetryExhaustedError(IntegrationError):
    """Raised when a retryable operation fails after all allowed attempts."""

    def __init__(
        self,
        message: str,
        *,
        attempts: int,
        last_error: Exception | None = None,
    ) -> None:
        super().__init__(message)
        self.attempts = attempts
        self.last_error = last_error


class IntegrationClosedError(IntegrationError):
    """Raised when an operation is attempted after an integration is closed."""


# ---------------------------------------------------------------------------
# Status and result types
# ---------------------------------------------------------------------------


class IntegrationStatus(str, Enum):
    """Standard lifecycle states for integration instances."""

    INITIALIZED = "initialized"
    READY = "ready"
    DEGRADED = "degraded"
    CLOSED = "closed"


@dataclass(frozen=True, slots=True)
class IntegrationResult(Generic[T]):
    """
    Standard result container for integration operations.

    `data` contains the successful result, if any.
    `status_code` is optional because not every integration uses HTTP.
    `request_id` should contain only a non-sensitive correlation identifier.
    """

    success: bool
    data: T | None = None
    status_code: int | None = None
    request_id: str | None = None
    error_code: str | None = None
    message: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Retry configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """
    Bounded retry policy for transient failures.

    `max_attempts` includes the initial attempt. Set it to 1 to disable retries.

    Retries must only be enabled for operations that are safe to repeat.
    For non-idempotent operations, use provider-supported idempotency keys
    or leave retries disabled.
    """

    max_attempts: int = 3
    initial_delay: float = 0.25
    maximum_delay: float = 5.0
    multiplier: float = 2.0
    jitter: float = 0.1

    def __post_init__(self) -> None:
        if (
            isinstance(self.max_attempts, bool)
            or not isinstance(self.max_attempts, int)
            or self.max_attempts < 1
        ):
            raise IntegrationConfigurationError(
                "max_attempts must be an integer of at least 1"
            )

        for name, value in (
            ("initial_delay", self.initial_delay),
            ("maximum_delay", self.maximum_delay),
            ("multiplier", self.multiplier),
            ("jitter", self.jitter),
        ):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise IntegrationConfigurationError(
                    f"{name} must be a number"
                )

        if self.initial_delay < 0:
            raise IntegrationConfigurationError(
                "initial_delay must not be negative"
            )

        if self.maximum_delay < self.initial_delay:
            raise IntegrationConfigurationError(
                "maximum_delay must be at least initial_delay"
            )

        if self.multiplier < 1:
            raise IntegrationConfigurationError(
                "multiplier must be at least 1"
            )

        if not 0 <= self.jitter <= 1:
            raise IntegrationConfigurationError(
                "jitter must be between 0 and 1"
            )

    def delay_for_attempt(self, failed_attempt: int) -> float:
        """
        Calculate delay after a failed attempt.

        `failed_attempt=1` calculates the delay before attempt two.
        The result is bounded by maximum_delay, with optional jitter.
        """
        if (
            isinstance(failed_attempt, bool)
            or not isinstance(failed_attempt, int)
            or failed_attempt < 1
        ):
            raise ValueError("failed_attempt must be an integer of at least 1")

        base = min(
            self.initial_delay * self.multiplier ** (failed_attempt - 1),
            self.maximum_delay,
        )

        if self.jitter == 0 or base == 0:
            return base

        # Jitter is bounded and never produces a negative delay.
        adjustment = random.uniform(-self.jitter, self.jitter)
        return min(self.maximum_delay, max(0.0, base * (1 + adjustment)))


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class IntegrationConfig:
    """
    Immutable configuration shared by integration clients.

    `base_url` is optional for non-HTTP integrations.
    `headers` must not contain secrets that may be exposed through logs.
    Provider-specific authentication belongs in the provider adapter.
    """

    name: str
    base_url: str | None = None
    timeout: float = 10.0
    retry_policy: RetryPolicy = field(default_factory=RetryPolicy)
    headers: Mapping[str, str] = field(default_factory=dict)
    verify_tls: bool = True

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not self.name.strip():
            raise IntegrationConfigurationError(
                "Integration name must be a non-empty string"
            )

        if (
            isinstance(self.timeout, bool)
            or not isinstance(self.timeout, (int, float))
            or self.timeout <= 0
        ):
            raise IntegrationConfigurationError(
                "timeout must be a positive number"
            )

        if not isinstance(self.verify_tls, bool):
            raise IntegrationConfigurationError(
                "verify_tls must be a boolean"
            )

        if not isinstance(self.retry_policy, RetryPolicy):
            raise IntegrationConfigurationError(
                "retry_policy must be a RetryPolicy instance"
            )

        if not isinstance(self.headers, Mapping):
            raise IntegrationConfigurationError(
                "headers must be a mapping"
            )

        for key, value in self.headers.items():
            if (
                not isinstance(key, str)
                or not key.strip()
                or not isinstance(value, str)
            ):
                raise IntegrationConfigurationError(
                    "Header names must be non-empty strings and values must be strings"
                )

            if "\r" in key or "\n" in key or "\r" in value or "\n" in value:
                raise IntegrationConfigurationError(
                    "Headers must not contain newline characters"
                )

        if self.base_url is not None:
            self._validate_base_url(self.base_url)

    @staticmethod
    def _validate_base_url(url: str) -> None:
        if not isinstance(url, str) or not url.strip():
            raise IntegrationConfigurationError(
                "base_url must be a non-empty string when provided"
            )

        if any(character.isspace() for character in url):
            raise IntegrationConfigurationError(
                "base_url must not contain whitespace"
            )

        try:
            parsed = urlsplit(url)
            hostname = parsed.hostname
            _ = parsed.port
        except ValueError as exc:
            raise IntegrationConfigurationError(
                "base_url has invalid URL syntax"
            ) from exc

        if parsed.scheme.lower() not in {"http", "https"} or not hostname:
            raise IntegrationConfigurationError(
                "base_url must be an absolute HTTP or HTTPS URL"
            )

        if parsed.username is not None or parsed.password is not None:
            raise IntegrationConfigurationError(
                "base_url must not contain embedded credentials"
            )

        if parsed.query or parsed.fragment:
            raise IntegrationConfigurationError(
                "base_url must not contain a query or fragment"
            )

        if hostname.startswith(".") or hostname.endswith(".") or ".." in hostname:
            raise IntegrationConfigurationError(
                "base_url contains an invalid hostname"
            )


# ---------------------------------------------------------------------------
# Base integration
# ---------------------------------------------------------------------------


class IntegrationBase:
    """
    Abstract-by-convention base class for MedOrbits integrations.

    Subclasses should implement provider-specific behavior and may override
    `close()` to release their own resources.

    This base class deliberately does not create an HTTP session or perform
    network requests. Transport and authentication are provider-specific.
    """

    def __init__(
        self,
        config: IntegrationConfig,
        *,
        logger: logging.Logger | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        if not isinstance(config, IntegrationConfig):
            raise IntegrationConfigurationError(
                "config must be an IntegrationConfig instance"
            )

        if not callable(sleeper):
            raise IntegrationConfigurationError(
                "sleeper must be callable"
            )

        self._config = config
        self._logger = logger or logging.getLogger(
            f"medorbits.integrations.{config.name}"
        )
        self._sleeper = sleeper
        self._status = IntegrationStatus.INITIALIZED
        self._state_lock = threading.RLock()

        self._logger.debug(
            "Integration initialized: name=%s",
            self._config.name,
        )

    @property
    def config(self) -> IntegrationConfig:
        """Return the immutable integration configuration."""
        return self._config

    @property
    def name(self) -> str:
        """Return the configured integration name."""
        return self._config.name

    @property
    def status(self) -> IntegrationStatus:
        """Return the current lifecycle status."""
        with self._state_lock:
            return self._status

    @property
    def is_closed(self) -> bool:
        """Return whether the integration has been closed."""
        return self.status is IntegrationStatus.CLOSED

    def mark_ready(self) -> None:
        """Mark the integration as ready after provider setup succeeds."""
        with self._state_lock:
            self._ensure_open()
            self._status = IntegrationStatus.READY

        self._logger.info("Integration ready: name=%s", self.name)

    def mark_degraded(self) -> None:
        """Mark the integration as degraded without closing it."""
        with self._state_lock:
            self._ensure_open()
            self._status = IntegrationStatus.DEGRADED

        self._logger.warning("Integration degraded: name=%s", self.name)

    def _ensure_open(self) -> None:
        """Raise if the integration has already been closed."""
        if self._status is IntegrationStatus.CLOSED:
            raise IntegrationClosedError(
                f"Integration '{self.name}' is closed"
            )

    def ensure_open(self) -> None:
        """Public lifecycle guard for provider-specific operations."""
        with self._state_lock:
            self._ensure_open()

    def execute_with_retry(
        self,
        operation: Callable[[], T],
        *,
        retry_on: tuple[type[Exception], ...] = (
            IntegrationConnectionError,
            IntegrationTimeoutError,
        ),
        retry_safe: bool = False,
        operation_name: str = "operation",
    ) -> T:
        """
        Execute a callable with bounded retries for explicitly safe operations.

        Retries are disabled unless `retry_safe=True` is explicitly provided.
        The operation must raise one of the exception classes in `retry_on`
        to be retried.

        This method does not retry arbitrary exceptions, response validation
        failures, or operations that may create duplicate side effects.
        """
        self.ensure_open()

        if not callable(operation):
            raise TypeError("operation must be callable")

        if (
            not isinstance(retry_on, tuple)
            or not retry_on
            or any(
                not isinstance(exception_type, type)
                or not issubclass(exception_type, Exception)
                for exception_type in retry_on
            )
        ):
            raise TypeError(
                "retry_on must be a non-empty tuple of Exception classes"
            )

        if not isinstance(retry_safe, bool):
            raise TypeError("retry_safe must be a boolean")

        if not isinstance(operation_name, str) or not operation_name.strip():
            raise ValueError("operation_name must be a non-empty string")

        policy = self.config.retry_policy
        attempts_allowed = policy.max_attempts if retry_safe else 1
        last_error: Exception | None = None

        for attempt in range(1, attempts_allowed + 1):
            self.ensure_open()

            try:
                return operation()

            except retry_on as exc:
                last_error = exc

                if attempt >= attempts_allowed:
                    break

                delay = policy.delay_for_attempt(attempt)

                # Do not include exception messages; they may contain tokens,
                # URLs, personal data, or provider response content.
                self._logger.warning(
                    "Integration operation failed; retrying: "
                    "name=%s operation=%s attempt=%d delay_seconds=%.3f",
                    self.name,
                    operation_name,
                    attempt,
                    delay,
                )

                self._sleeper(delay)

        assert last_error is not None

        if retry_safe and attempts_allowed > 1:
            raise IntegrationRetryExhaustedError(
                f"Integration operation '{operation_name}' failed "
                f"after {attempts_allowed} attempts",
                attempts=attempts_allowed,
                last_error=last_error,
            ) from last_error

        # With retries disabled, preserve the original exception type.
        raise last_error

    def health_check(self) -> IntegrationResult[dict[str, Any]]:
        """
        Return a local lifecycle health result.

        This is not a remote provider health check and does not establish
        network connectivity or credential validity.
        """
        with self._state_lock:
            current_status = self._status

        return IntegrationResult(
            success=current_status
            in {IntegrationStatus.INITIALIZED, IntegrationStatus.READY},
            data={
                "integration": self.name,
                "status": current_status.value,
            },
        )

    def close(self) -> None:
        """
        Mark the integration as closed.

        Subclasses that own sessions or other resources should release those
        resources in an override and call super().close().
        """
        with self._state_lock:
            if self._status is IntegrationStatus.CLOSED:
                return

            self._status = IntegrationStatus.CLOSED

        self._logger.info("Integration closed: name=%s", self.name)

    def __enter__(self) -> IntegrationBase:
        """Support use with a context manager."""
        self.ensure_open()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: Any,
    ) -> bool:
        """Close the integration on context exit without suppressing errors."""
        self.close()
        return False
