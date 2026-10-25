
"""
MedOrbits -- Health Checks
File: src/python/medorbits/healthcheck.py

Purpose:
    Provide reusable liveness, readiness, and dependency health checks.

Features:
    - Process liveness checks.
    - Application readiness checks.
    - Pluggable dependency probes.
    - Bounded execution time for synchronous probes.
    - Sanitized health results.
    - No automatic network calls or service initialization at import time.

Security:
    - Do not return credentials, connection strings, internal hostnames,
      SQL statements, exception messages, or other sensitive details.
    - Keep detailed diagnostics in protected logs and monitoring systems.
    - Expose only the health information appropriate for each endpoint.
    - A health check is not a substitute for authentication or authorization.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Mapping
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Final


logger = logging.getLogger("medorbits.healthcheck")

DEFAULT_PROBE_TIMEOUT_SECONDS: Final[float] = 2.0
DEFAULT_OVERALL_TIMEOUT_SECONDS: Final[float] = 5.0
MAX_PROBE_TIMEOUT_SECONDS: Final[float] = 30.0
MAX_PROBES: Final[int] = 50

HealthProbe = Callable[[], bool | None]


class HealthStatus(str, Enum):
    """Supported health status values."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class ProbeResult:
    """Sanitized result of one dependency health probe."""

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

        if include_reason and self.reason:
            result["reason"] = self.reason

        return result


@dataclass(frozen=True, slots=True)
class HealthReport:
    """Aggregate health-check result."""

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
    if (
        not isinstance(name, str)
        or not name
        or len(name) > 80
        or not name.replace("_", "").replace("-", "").isalnum()
    ):
        raise ValueError(
            "Probe name must contain only letters, numbers, underscores, or hyphens."
        )

    return name


def _validate_timeout(value: float, label: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or value <= 0
        or value > MAX_PROBE_TIMEOUT_SECONDS
    ):
        raise ValueError(
            f"{label} must be greater than 0 and at most "
            f"{MAX_PROBE_TIMEOUT_SECONDS} seconds."
        )

    return float(value)


def _status_from_probes(
    probes: tuple[ProbeResult, ...],
) -> HealthStatus:
    if not probes:
        return HealthStatus.HEALTHY

    required_failures = any(
        probe.required and probe.status is not HealthStatus.HEALTHY
        for probe in probes
    )

    if required_failures:
        return HealthStatus.UNHEALTHY

    optional_failures = any(
        probe.status is not HealthStatus.HEALTHY
        for probe in probes
    )

    return (
        HealthStatus.DEGRADED
        if optional_failures
        else HealthStatus.HEALTHY
    )


class HealthChecker:
    """
    Register and execute application dependency probes.

    Probe callbacks should perform a small, read-only check and return True
    when healthy. They should not initialize services or mutate application
    state.

    Each probe runs in a worker thread. A timed-out synchronous probe cannot
    be forcibly stopped; design probes with their own database/network
    timeouts to avoid accumulating stuck worker threads.
    """

    def __init__(
        self,
        *,
        max_workers: int = 8,
        overall_timeout_seconds: float = DEFAULT_OVERALL_TIMEOUT_SECONDS,
    ) -> None:
        if (
            not isinstance(max_workers, int)
            or isinstance(max_workers, bool)
            or not 1 <= max_workers <= MAX_PROBES
        ):
            raise ValueError("max_workers must be an integer between 1 and 50.")

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

    def register(
        self,
        name: str,
        callback: HealthProbe,
        *,
        required: bool = True,
        timeout_seconds: float = DEFAULT_PROBE_TIMEOUT_SECONDS,
    ) -> None:
        """Register a unique synchronous dependency probe."""
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
        """Remove a registered probe. Return whether it existed."""
        with self._lock:
            return self._probes.pop(name, None) is not None

    def registered_probes(self) -> tuple[str, ...]:
        """Return registered probe names without exposing callback details."""
        with self._lock:
            return tuple(self._probes.keys())

    def _run_probe(
        self,
        probe: _RegisteredProbe,
        deadline: float,
    ) -> ProbeResult:
        start = time.monotonic()
        remaining = deadline - start
        timeout = min(probe.timeout_seconds, remaining)

        if timeout <= 0:
            return ProbeResult(
                name=probe.name,
                status=HealthStatus.UNKNOWN,
                duration_ms=0.0,
                required=probe.required,
                reason="overall_timeout",
            )

        future: Future[bool | None] = self._executor.submit(probe.callback)

        try:
            result = future.result(timeout=timeout)

            if result is False:
                status = HealthStatus.UNHEALTHY
                reason = "probe_failed"
            else:
                status = HealthStatus.HEALTHY
                reason = None

        except TimeoutError:
            future.cancel()
            status = HealthStatus.UNHEALTHY
            reason = "probe_timeout"

        except Exception as exc:
            # Do not expose exception text or connection details in results.
            logger.warning(
                "Health probe failed: name=%s error_type=%s",
                probe.name,
                type(exc).__name__,
            )
            status = HealthStatus.UNHEALTHY
            reason = "probe_error"

        duration_ms = (time.monotonic() - start) * 1000

        return ProbeResult(
            name=probe.name,
            status=status,
            duration_ms=duration_ms,
            required=probe.required,
            reason=reason,
        )

    def check(self) -> HealthReport:
        """
        Run dependency probes and return an aggregate report.

        A required failed probe makes the report unhealthy. An optional
        failed probe makes it degraded. An overall timeout can leave probes
        unchecked; readiness should be treated as unhealthy in that case.
        """
        start = time.monotonic()
        checked_at = time.time()
        deadline = start + self._overall_timeout

        with self._lock:
            if self._closed:
                return HealthReport(
                    status=HealthStatus.UNHEALTHY,
                    checked_at_unix=checked_at,
                    duration_ms=0.0,
                    probes=(),
                )

            probes = tuple(self._probes.values())

        results: list[ProbeResult] = []

        # Execute probes concurrently. Submission is bounded by the configured
        # executor; callbacks themselves must use short I/O timeouts.
        futures: dict[Future[bool | None], _RegisteredProbe] = {}

        for probe in probes:
            if time.monotonic() >= deadline:
                results.append(
                    ProbeResult(
                        name=probe.name,
                        status=HealthStatus.UNKNOWN,
                        duration_ms=0.0,
                        required=probe.required,
                        reason="overall_timeout",
                    )
                )
                continue

            futures[self._executor.submit(probe.callback)] = probe

        for future, probe in futures.items():
            remaining = deadline - time.monotonic()

            if remaining <= 0:
                future.cancel()
                results.append(
                    ProbeResult(
                        name=probe.name,
                        status=HealthStatus.UNKNOWN,
                        duration_ms=0.0,
                        required=probe.required,
                        reason="overall_timeout",
                    )
                )
                continue

            probe_start = time.monotonic()

            try:
                outcome = future.result(
                    timeout=min(probe.timeout_seconds, remaining)
                )

                if outcome is False:
                    status = HealthStatus.UNHEALTHY
                    reason = "probe_failed"
                else:
                    status = HealthStatus.HEALTHY
                    reason = None

            except TimeoutError:
                future.cancel()
                status = HealthStatus.UNHEALTHY
                reason = "probe_timeout"

            except Exception as exc:
                logger.warning(
                    "Health probe failed: name=%s error_type=%s",
                    probe.name,
                    type(exc).__name__,
                )
                status = HealthStatus.UNHEALTHY
                reason = "probe_error"

            results.append(
                ProbeResult(
                    name=probe.name,
                    status=status,
                    duration_ms=(time.monotonic() - probe_start) * 1000,
                    required=probe.required,
                    reason=reason,
                )
            )

        report_probes = tuple(results)

        # Unknown required probes are not ready. Optional unknown probes
        # degrade the report rather than making readiness fail.
        status = _status_from_probes(report_probes)

        report = HealthReport(
            status=status,
            checked_at_unix=checked_at,
            duration_ms=(time.monotonic() - start) * 1000,
            probes=report_probes,
        )

        return report

    def close(self, *, wait: bool = True) -> None:
        """Stop accepting new checks and release the executor."""
        with self._lock:
            if self._closed:
                return
            self._closed = True

        self._executor.shutdown(wait=wait, cancel_futures=True)

    def __enter__(self) -> "HealthChecker":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()


def liveness_report() -> Mapping[str, Any]:
    """
    Minimal process liveness response.

    This deliberately does not contact external dependencies. It indicates
    that the process can execute application code, not that it is ready
    to serve traffic.
    """
    return MappingProxyType(
        {
            "status": HealthStatus.HEALTHY.value,
            "service": "medorbits",
        }
    )


def readiness_report(checker: HealthChecker) -> HealthReport:
    """
    Check whether the service's required dependencies are ready.

    Register only the probes appropriate for this application process.
    """
    if not isinstance(checker, HealthChecker):
        raise TypeError("checker must be a HealthChecker instance.")

    return checker.check()


__all__ = [
    "HealthChecker",
    "HealthReport",
    "HealthStatus",
    "ProbeResult",
    "liveness_report",
    "readiness_report",
]

