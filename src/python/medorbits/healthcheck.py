"""MedOrbits health checks.

File: src/python/medorbits/healthcheck.py

Provides liveness, readiness, and pluggable dependency probes.

Security:
    - Never expose credentials, connection strings, SQL, internal hostnames,
      or exception messages in public health responses.
    - Log only sanitized probe identifiers and exception type names.
    - Do not initialize services or make network calls at import time.
    - Health endpoints are not a substitute for authorization.

Timeout note:
    Python cannot forcibly terminate a running synchronous function. Probes
    must implement their own I/O timeouts and avoid unbounded blocking calls.
"""

from __future__ import annotations

import logging
import math
import threading
import time
from collections.abc import Callable, Mapping
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Final


__all__ = [
    "HealthChecker",
    "HealthReport",
    "HealthStatus",
    "ProbeResult",
    "liveness_report",
    "readiness_report",
]

logger = logging.getLogger("medorbits.healthcheck")

DEFAULT_PROBE_TIMEOUT_SECONDS: Final[float] = 2.0
DEFAULT_OVERALL_TIMEOUT_SECONDS: Final[float] = 5.0
MAX_PROBE_TIMEOUT_SECONDS: Final[float] = 30.0
MAX_PROBES: Final[int] = 50
MAX_WORKERS: Final[int] = 50

HealthProbe = Callable[[], bool]


class HealthStatus(str, Enum):
    """Supported health status values."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class ProbeResult:
    """Sanitized result of one dependency probe."""

    name: str
    status: HealthStatus
    duration_ms: float
    required: bool
    reason: str | None = None

    def to_dict(self, *, include_reason: bool = False) -> dict[str, Any]:
        result: dict[str, Any] = {
            "name": self.name,
            "status": self.status.value,
            "duration_ms": round(self.duration_ms, 2),
            "required": self.required,
        }

        if include_reason and self.reason is not None:
            result["reason"] = self.reason

        return result


@dataclass(frozen=True, slots=True)
class HealthReport:
    """Immutable aggregate health-check result."""

    status: HealthStatus
    checked_at_unix: float
    duration_ms: float
    probes: tuple[ProbeResult, ...] = field(default_factory=tuple)

    @property
    def is_healthy(self) -> bool:
        return self.status is HealthStatus.HEALTHY

    @property
    def is_ready(self) -> bool:
        return self.status is HealthStatus.HEALTHY

    def to_dict(
        self,
        *,
        include_details: bool = False,
        include_reasons: bool = False,
    ) -> dict[str, Any]:
        result: dict[str, Any] = {
            "status": self.status.value,
            "checked_at_unix": round(self.checked_at_unix, 3),
            "duration_ms": round(self.duration_ms, 2),
        }

        if include_details:
            result["checks"] = [
                probe.to_dict(include_reason=include_reasons)
                for probe in self.probes
            ]

        return result


@dataclass(frozen=True, slots=True)
class _RegisteredProbe:
    name: str
    callback: HealthProbe
    required: bool
    timeout_seconds: float


def _validate_probe_name(name: str) -> str:
    """Validate a probe name suitable for logs and health responses."""
    if not isinstance(name, str):
        raise TypeError("Probe name must be a string.")

    if (
        not name
        or len(name) > 80
        or not name.isascii()
        or not name.replace("_", "").replace("-", "").isalnum()
    ):
        raise ValueError(
            "Probe name must contain only ASCII letters, numbers, "
            "underscores, or hyphens."
        )

    return name


def _validate_timeout(value: float, label: str) -> float:
    """Validate a finite, bounded timeout value."""
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value <= 0
        or value > MAX_PROBE_TIMEOUT_SECONDS
    ):
        raise ValueError(
            f"{label} must be finite, greater than 0, and at most "
            f"{MAX_PROBE_TIMEOUT_SECONDS} seconds."
        )

    return float(value)


def _aggregate_status(
    probes: tuple[ProbeResult, ...],
) -> HealthStatus:
    """Aggregate probe statuses, respecting required dependencies."""
    if any(
        probe.required
        and probe.status is not HealthStatus.HEALTHY
        for probe in probes
    ):
        return HealthStatus.UNHEALTHY

    if any(
        probe.status is not HealthStatus.HEALTHY
        for probe in probes
    ):
        return HealthStatus.DEGRADED

    return HealthStatus.HEALTHY


def _result_for_unrun_probe(
    probe: _RegisteredProbe,
    *,
    reason: str,
) -> ProbeResult:
    """Represent a probe that could not be completed."""
    return ProbeResult(
        name=probe.name,
        status=HealthStatus.UNKNOWN,
        duration_ms=0.0,
        required=probe.required,
        reason=reason,
    )


class HealthChecker:
    """Register and execute dependency probes.

    Probes run concurrently in a bounded thread pool. A probe must be a
    small, read-only, synchronous check that returns exactly True when
    healthy and exactly False when unhealthy.

    A timeout cannot terminate a callback that is already running. Configure
    database and network client timeouts independently.
    """

    def __init__(
        self,
        *,
        max_workers: int = 8,
        overall_timeout_seconds: float = DEFAULT_OVERALL_TIMEOUT_SECONDS,
    ) -> None:
        if (
            isinstance(max_workers, bool)
            or not isinstance(max_workers, int)
            or not 1 <= max_workers <= MAX_WORKERS
        ):
            raise ValueError(
                f"max_workers must be an integer between 1 and {MAX_WORKERS}."
            )

        self._overall_timeout = _validate_timeout(
            overall_timeout_seconds,
            "overall_timeout_seconds",
        )
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="medorbits-health",
        )
        self._probes: dict[str, _RegisteredProbe] = {}
        self._lock = threading.RLock()
        self._closed = False
        self._active_checks = 0
        self._idle = threading.Condition(self._lock)

    def register(
        self,
        name: str,
        callback: HealthProbe,
        *,
        required: bool = True,
        timeout_seconds: float = DEFAULT_PROBE_TIMEOUT_SECONDS,
    ) -> None:
        """Register a uniquely named synchronous probe."""
        name = _validate_probe_name(name)
        timeout = _validate_timeout(timeout_seconds, "timeout_seconds")

        if not callable(callback):
            raise TypeError("Health probe callback must be callable.")

        if not isinstance(required, bool):
            raise TypeError("required must be a boolean.")

        with self._lock:
            if self._closed:
                raise RuntimeError("HealthChecker has been closed.")

            if name in self._probes:
                raise ValueError(f"Health probe '{name}' is already registered.")

            if len(self._probes) >= MAX_PROBES:
                raise ValueError(
                    f"At most {MAX_PROBES} health probes may be registered."
                )

            self._probes[name] = _RegisteredProbe(
                name=name,
                callback=callback,
                required=required,
                timeout_seconds=timeout,
            )

    def unregister(self, name: str) -> bool:
        """Remove a registered probe by name."""
        with self._lock:
            if self._closed:
                return False
            return self._probes.pop(name, None) is not None

    def registered_probes(self) -> tuple[str, ...]:
        """Return registered names without exposing callbacks."""
        with self._lock:
            return tuple(self._probes)

    def _execute_probe(
        self,
        probe: _RegisteredProbe,
    ) -> tuple[HealthStatus, str | None]:
        """Execute one callback and return a sanitized status and reason."""
        try:
            outcome = probe.callback()

            if outcome is True:
                return HealthStatus.HEALTHY, None

            if outcome is False:
                return HealthStatus.UNHEALTHY, "probe_failed"

            return HealthStatus.UNHEALTHY, "invalid_probe_result"

        except Exception as exc:
            logger.warning(
                "Health probe raised an exception: name=%s error_type=%s",
                probe.name,
                type(exc).__name__,
            )
            return HealthStatus.UNHEALTHY, "probe_error"

    def check(self) -> HealthReport:
        """Run dependency probes within the overall time budget."""
        started = time.monotonic()
        checked_at = time.time()
        deadline = started + self._overall_timeout

        with self._lock:
            if self._closed:
                return HealthReport(
                    status=HealthStatus.UNHEALTHY,
                    checked_at_unix=checked_at,
                    duration_ms=0.0,
                    probes=(),
                )

            self._active_checks += 1
            probes = tuple(self._probes.values())

        results: dict[str, ProbeResult] = {}
        futures: dict[
            Future[tuple[HealthStatus, str | None]],
            _RegisteredProbe,
        ] = {}

        try:
            for probe in probes:
                if time.monotonic() >= deadline:
                    results[probe.name] = _result_for_unrun_probe(
                        probe,
                        reason="overall_timeout",
                    )
                    continue

                try:
                    future = self._executor.submit(
                        self._execute_probe,
                        probe,
                    )
                except RuntimeError:
                    results[probe.name] = _result_for_unrun_probe(
                        probe,
                        reason="checker_unavailable",
                    )
                    continue

                futures[future] = probe

            for future, probe in futures.items():
                remaining = deadline - time.monotonic()

                if remaining <= 0:
                    future.cancel()
                    results[probe.name] = _result_for_unrun_probe(
                        probe,
                        reason="overall_timeout",
                    )
                    continue

                probe_started = time.monotonic()
                wait_seconds = min(probe.timeout_seconds, remaining)

                try:
                    status, reason = future.result(timeout=wait_seconds)

                except TimeoutError:
                    future.cancel()
                    status = HealthStatus.UNHEALTHY
                    reason = (
                        "overall_timeout"
                        if time.monotonic() >= deadline
                        else "probe_timeout"
                    )

                except Exception as exc:
                    logger.warning(
                        "Health probe execution failed: name=%s error_type=%s",
                        probe.name,
                        type(exc).__name__,
                    )
                    status = HealthStatus.UNHEALTHY
                    reason = "probe_error"

                results[probe.name] = ProbeResult(
                    name=probe.name,
                    status=status,
                    duration_ms=(time.monotonic() - probe_started) * 1000,
                    required=probe.required,
                    reason=reason,
                )

            report_probes = tuple(
                results[probe.name]
                for probe in probes
                if probe.name in results
            )

            return HealthReport(
                status=_aggregate_status(report_probes),
                checked_at_unix=checked_at,
                duration_ms=(time.monotonic() - started) * 1000,
                probes=report_probes,
            )

        finally:
            with self._lock:
                self._active_checks -= 1
                self._idle.notify_all()

    def close(self, *, wait: bool = True) -> None:
        """Reject new checks and shut down the worker pool.

        With wait=True, waits for active check calls to finish before shutting
        down the executor. Running callbacks may still block indefinitely;
        their own I/O timeouts remain essential.
        """
        with self._lock:
            if self._closed:
                return

            self._closed = True

            if wait:
                while self._active_checks:
                    self._idle.wait()

        self._executor.shutdown(
            wait=wait,
            cancel_futures=True,
        )

    def __enter__(self) -> "HealthChecker":
        return self

    def __exit__(
        self,
        exc_type: Any,
        exc_value: Any,
        traceback_value: Any,
    ) -> None:
        self.close()


def liveness_report() -> Mapping[str, str]:
    """Return a minimal process-liveness response without probing services."""
    return MappingProxyType(
        {
            "status": HealthStatus.HEALTHY.value,
            "service": "medorbits",
        }
    )


def readiness_report(checker: HealthChecker) -> HealthReport:
    """Evaluate registered dependency probes for application readiness."""
    if not isinstance(checker, HealthChecker):
        raise TypeError("checker must be a HealthChecker instance.")

    return checker.check()