#!/usr/bin/env python3
"""
MedOrbits Health Integration
============================
Centralized health, readiness, and liveness checks for MedOrbits.
Compatible with Python 3.10+.
Uses only the Python standard library.
Features:
- Application liveness and readiness checks
- Named health-check registration
- Custom dependency probes
- Configurable check timeouts
- Health report aggregation
- JSON-compatible output
- Safe exception reporting
- Optional IntegrationRegistry registration
This module does not start an HTTP server or expose a public endpoint.
Connect its report methods to the application's existing health route.
Example:
    from python.integrations.health import HealthIntegration
    health = HealthIntegration("MedOrbits")
    health.register_check(
        "configuration",
        lambda: {"status": "healthy"},
    )
    report = health.check_health()
    print(report["status"])
"""
from __future__ import annotations
import importlib
import json
import os
import platform
import socket
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
# --------------------------------------------------
# EXCEPTIONS
# --------------------------------------------------
class HealthIntegrationError(Exception):
    """Base exception for health integration failures."""
class HealthCheckRegistrationError(HealthIntegrationError):
    """Raised when a health check cannot be registered."""
class HealthCheckNotFoundError(HealthIntegrationError):
    """Raised when a requested health check does not exist."""
class HealthCheckExecutionError(HealthIntegrationError):
    """Raised when health-check execution cannot be completed."""
# --------------------------------------------------
# HEALTH CHECK MODEL
# --------------------------------------------------
HealthProbe = Callable[[], Any]
@dataclass(frozen=True)
class HealthCheckResult:
    """Immutable result for an individual health check."""
    name: str
    status: str
    duration_ms: float
    checked_at: str
    details: dict[str, Any] = field(default_factory=dict)
    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible representation."""
        return {
            "name": self.name,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "checked_at": self.checked_at,
            "details": self.details,
        }
@dataclass(frozen=True)
class HealthCheckDefinition:
    """Configuration for a registered health probe."""
    name: str
    probe: HealthProbe
    critical: bool = True
    timeout_seconds: float = 3.0
# --------------------------------------------------
# HEALTH INTEGRATION
# --------------------------------------------------
class HealthIntegration:
    """
    Health-check manager for application and dependency monitoring.
    Probe contract:
    - Return None or True to indicate success.
    - Return a dictionary to provide details; a dictionary with
      status="unhealthy" or status="degraded" affects the result.
    - Raise an exception to indicate a failed check.
    A critical failed check makes overall health unhealthy.
    A non-critical failed check makes overall health degraded.
    """
    VALID_STATUSES = {
        "healthy",
        "degraded",
        "unhealthy",
        "unknown",
    }
    def __init__(
        self,
        application_name: str = "MedOrbits",
        *,
        version: str | None = None,
        environment: str | None = None,
        default_timeout: float = 3.0,
    ) -> None:
        if not isinstance(application_name, str) or not application_name.strip():
            raise ValueError("application_name must not be empty")
        if default_timeout <= 0:
            raise ValueError("default_timeout must be greater than zero")
        self.application_name = application_name.strip()
        self.version = version or os.environ.get(
            "MEDORBITS_VERSION",
            "unknown",
        )
        self.environment = environment or os.environ.get(
            "MEDORBITS_ENV",
            "development",
        )
        self.default_timeout = float(default_timeout)
        self._checks: dict[str, HealthCheckDefinition] = {}
        self._lock = threading.RLock()
        self._started_at = time.monotonic()
    # --------------------------------------------------
    # REGISTRATION
    # --------------------------------------------------
    @staticmethod
    def _validate_name(name: str) -> str:
        if not isinstance(name, str) or not name.strip():
            raise HealthCheckRegistrationError(
                "Health check name must not be empty"
            )
        return name.strip()
    def register_check(
        self,
        name: str,
        probe: HealthProbe,
        *,
        critical: bool = True,
        timeout_seconds: float | None = None,
        replace: bool = False,
    ) -> None:
        """Register a named callable health probe."""
        normalized_name = self._validate_name(name)
        if not callable(probe):
            raise HealthCheckRegistrationError(
                f"Probe for {normalized_name!r} must be callable"
            )
        timeout = (
            self.default_timeout
            if timeout_seconds is None
            else float(timeout_seconds)
        )
        if timeout <= 0:
            raise HealthCheckRegistrationError(
                "timeout_seconds must be greater than zero"
            )
        definition = HealthCheckDefinition(
            name=normalized_name,
            probe=probe,
            critical=bool(critical),
            timeout_seconds=timeout,
        )
        with self._lock:
            if normalized_name in self._checks and not replace:
                raise HealthCheckRegistrationError(
                    f"Health check already registered: {normalized_name}"
                )
            self._checks[normalized_name] = definition
    def unregister_check(self, name: str) -> None:
        """Remove a previously registered probe."""
        normalized_name = self._validate_name(name)
        with self._lock:
            if normalized_name not in self._checks:
                raise HealthCheckNotFoundError(
                    f"Health check not found: {normalized_name}"
                )
            del self._checks[normalized_name]
    def list_checks(self) -> list[str]:
        """Return registered check names in sorted order."""
        with self._lock:
            return sorted(self._checks)
    # --------------------------------------------------
    # PROBE EXECUTION
    # --------------------------------------------------
    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()
    def _execute_check(
        self,
        definition: HealthCheckDefinition,
    ) -> HealthCheckResult:
        """
        Execute a probe with a timeout.
        The probe runs in a daemon thread. Python cannot safely terminate
        a timed-out thread, so probes must be designed to return promptly
        and should use their own network/database timeouts.
        """
        result: dict[str, Any] = {}
        completed = threading.Event()
        started = time.monotonic()
        def run_probe() -> None:
            try:
                result["value"] = definition.probe()
            except BaseException as exc:
                # Capture probe failures so they can be reported.
                result["error"] = exc
            finally:
                completed.set()
        worker = threading.Thread(
            target=run_probe,
            name=f"health-check-{definition.name}",
            daemon=True,
        )
        worker.start()
        completed.wait(definition.timeout_seconds)
        duration_ms = round((time.monotonic() - started) * 1000, 2)
        checked_at = self._timestamp()
        if not completed.is_set():
            return HealthCheckResult(
                name=definition.name,
                status="unhealthy",
                duration_ms=duration_ms,
                checked_at=checked_at,
                details={
                    "error": "Health check timed out",
                    "timeout_seconds": definition.timeout_seconds,
                },
            )
        if "error" in result:
            error = result["error"]
            return HealthCheckResult(
                name=definition.name,
                status="unhealthy",
                duration_ms=duration_ms,
                checked_at=checked_at,
                details={
                    "error_type": type(error).__name__,
                    "error": "Health check execution failed",
                },
            )
        value = result.get("value")
        if value is False:
            return HealthCheckResult(
                name=definition.name,
                status="unhealthy",
                duration_ms=duration_ms,
                checked_at=checked_at,
                details={"message": "Probe returned False"},
            )
        if value is None or value is True:
            details: dict[str, Any] = {}
            status = "healthy"
        elif isinstance(value, Mapping):
            details = dict(value)
            supplied_status = details.pop("status", "healthy")
            if supplied_status not in self.VALID_STATUSES:
                return HealthCheckResult(
                    name=definition.name,
                    status="unhealthy",
                    duration_ms=duration_ms,
                    checked_at=checked_at,
                    details={
                        "error": "Probe returned an invalid status"
                    },
                )
            status = supplied_status
        else:
            return HealthCheckResult(
                name=definition.name,
                status="unhealthy",
                duration_ms=duration_ms,
                checked_at=checked_at,
                details={
                    "error": "Probe returned an unsupported result type",
                    "result_type": type(value).__name__,
                },
            )
        return HealthCheckResult(
            name=definition.name,
            status=status,
            duration_ms=duration_ms,
            checked_at=checked_at,
            details=details,
        )
    # --------------------------------------------------
    # HEALTH REPORTS
    # --------------------------------------------------
    def check_health(
        self,
        *,
        include_checks: bool = True,
    ) -> dict[str, Any]:
        """
        Run all registered checks and return the aggregated report.
        Health is unhealthy when a critical check fails.
        Non-critical failures or degraded checks produce degraded status
        unless a critical check has failed.
        """
        with self._lock:
            definitions = list(self._checks.values())
        results = [
            self._execute_check(definition)
            for definition in definitions
        ]
        definitions_by_name = {
            definition.name: definition
            for definition in definitions
        }
        critical_failure = any(
            result.status == "unhealthy"
            and definitions_by_name[result.name].critical
            for result in results
        )
        any_degradation = any(
            result.status in {"degraded", "unknown"}
            or (
                result.status == "unhealthy"
                and not definitions_by_name[result.name].critical
            )
            for result in results
        )
        if critical_failure:
            status = "unhealthy"
        elif any_degradation:
            status = "degraded"
        else:
            status = "healthy"
        report: dict[str, Any] = {
            "application": self.application_name,
            "status": status,
            "version": self.version,
            "environment": self.environment,
            "timestamp": self._timestamp(),
            "uptime_seconds": round(
                time.monotonic() - self._started_at,
                2,
            ),
            "checks_total": len(results),
            "checks_healthy": sum(
                result.status == "healthy" for result in results
            ),
            "checks_degraded": sum(
                result.status in {"degraded", "unknown"}
                for result in results
            ),
            "checks_unhealthy": sum(
                result.status == "unhealthy" for result in results
            ),
        }
        if include_checks:
            report["checks"] = [
                result.to_dict()
                for result in results
            ]
        return report
    def liveness(self) -> dict[str, Any]:
        """
        Return a lightweight liveness report.
        Liveness indicates that the process can respond. It does not
        establish that every dependency is available.
        """
        return {
            "application": self.application_name,
            "status": "healthy",
            "check": "liveness",
            "timestamp": self._timestamp(),
            "uptime_seconds": round(
                time.monotonic() - self._started_at,
                2,
            ),
        }
    def readiness(self) -> dict[str, Any]:
        """Return dependency-aware readiness status."""
        report = self.check_health()
        report["check"] = "readiness"
        return report
    def health_json(self) -> str:
        """Return the complete health report as JSON."""
        return json.dumps(
            self.check_health(),
            ensure_ascii=False,
            allow_nan=False,
        )
    # --------------------------------------------------
    # BUILT-IN PROBES
    # --------------------------------------------------
    @staticmethod
    def filesystem_probe(path: str) -> dict[str, Any]:
        """Check that a required filesystem path exists."""
        target = os.path.abspath(path)
        if not os.path.exists(target):
            raise FileNotFoundError("Required path is unavailable")
        return {
            "status": "healthy",
            "path_exists": True,
            "is_directory": os.path.isdir(target),
        }
    @staticmethod
    def tcp_probe(
        host: str,
        port: int,
        *,
        timeout: float = 2.0,
    ) -> dict[str, Any]:
        """
        Check TCP connectivity to a dependency.
        Use only for configured, trusted hosts. This probe does not
        authenticate or validate the application-level protocol.
        """
        if not host or not host.strip():
            raise ValueError("host must not be empty")
        if not 1 <= int(port) <= 65535:
            raise ValueError("port must be between 1 and 65535")
        if timeout <= 0:
            raise ValueError("timeout must be greater than zero")
        with socket.create_connection(
            (host.strip(), int(port)),
            timeout=timeout,
        ):
            pass
        return {
            "status": "healthy",
            "host": host.strip(),
            "port": int(port),
            "connection": "successful",
        }
    # --------------------------------------------------
    # REGISTRY INTEGRATION
    # --------------------------------------------------
    def register_with_registry(
        self,
        registry: Any | None = None,
        *,
        name: str = "health",
    ) -> bool:
        """
        Register this integration with a compatible registry.
        If no registry is provided, attempts to discover the MedOrbits
        IntegrationRegistry. Returns False when no compatible registry
        is available. Does not create a global registry implicitly.
        """
        if registry is None:
            candidates = (
                "python.integrations.registry",
                "integrations.registry",
            )
            for module_name in candidates:
                try:
                    module = importlib.import_module(module_name)
                except ImportError:
                    continue
                registry_class = getattr(
                    module,
                    "IntegrationRegistry",
                    None,
                )
                if registry_class is None:
                    continue
                # Avoid guessing constructor arguments or mutating
                # an unknown global registry.
                try:
                    registry = registry_class()
                except Exception:
                    return False
                break
        if registry is None:
            return False
        register = getattr(registry, "register", None)
        if not callable(register):
            return False
        try:
            register(name, self)
        except Exception:
            return False
        return True
# --------------------------------------------------
# FACTORY
# --------------------------------------------------
def create_health_integration(
    application_name: str = "MedOrbits",
    **kwargs: Any,
) -> HealthIntegration:
    """Create a configured health integration instance."""
    return HealthIntegration(application_name, **kwargs)
__all__ = [
    "HealthIntegration",
    "HealthIntegrationError",
    "HealthCheckRegistrationError",
    "HealthCheckNotFoundError",
    "HealthCheckExecutionError",
    "HealthCheckResult",
    "HealthCheckDefinition",
    "create_health_integration",
]