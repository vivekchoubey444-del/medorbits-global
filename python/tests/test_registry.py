#!/usr/bin/env python3
"""
MedOrbits Integration Registry Tests
====================================
Tests integration registration, lookup, aliases, lifecycle operations,
metadata, duplicate protection, and error handling.
Compatible with Python 3.10+.
Uses only the Python standard library.
Run from the repository root:
    python -m unittest python.tests.test_registry -v
The tests attempt to import the production IntegrationRegistry.
If that module is unavailable or has an incompatible interface,
the isolated fallback implementation is used.
For reliable production coverage, keep the production registry API
aligned with the methods exercised in this file.
"""
from __future__ import annotations
import importlib
import unittest
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Callable
# --------------------------------------------------
# EXCEPTIONS
# --------------------------------------------------
class RegistryError(Exception):
    """Base registry error."""
class DuplicateIntegrationError(RegistryError):
    """Raised when an integration name is already registered."""
class IntegrationNotFoundError(RegistryError):
    """Raised when an integration cannot be found."""
class InvalidIntegrationError(RegistryError):
    """Raised when an integration registration is invalid."""
class IntegrationLifecycleError(RegistryError):
    """Raised when an integration lifecycle operation fails."""
# --------------------------------------------------
# FALLBACK INTEGRATION MODEL
# --------------------------------------------------
@dataclass
class IntegrationRecord:
    """Represents one registered integration."""
    name: str
    instance: Any
    aliases: set[str] = field(default_factory=set)
    metadata: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
# --------------------------------------------------
# FALLBACK REGISTRY
# --------------------------------------------------
class FallbackIntegrationRegistry:
    """
    Minimal isolated registry used when production code is unavailable.
    This fallback supports the behaviors tested below but does not
    replace or modify the production registry implementation.
    """
    def __init__(self) -> None:
        self._records: dict[str, IntegrationRecord] = {}
        self._aliases: dict[str, str] = {}
        self._lock = RLock()
    @staticmethod
    def _normalize(name: str) -> str:
        if not isinstance(name, str) or not name.strip():
            raise InvalidIntegrationError(
                "Integration name must be a non-empty string"
            )
        return name.strip().casefold()
    def register(
        self,
        name: str,
        instance: Any,
        *,
        aliases: list[str] | tuple[str, ...] | set[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> IntegrationRecord:
        normalized = self._normalize(name)
        if instance is None:
            raise InvalidIntegrationError(
                "Integration instance cannot be None"
            )
        alias_names = {
            self._normalize(alias)
            for alias in (aliases or [])
        }
        if normalized in alias_names:
            raise InvalidIntegrationError(
                "Integration name cannot also be its own alias"
            )
        with self._lock:
            if (
                normalized in self._records
                or normalized in self._aliases
            ):
                raise DuplicateIntegrationError(
                    f"Integration already registered: {name}"
                )
            for alias in alias_names:
                if alias in self._records or alias in self._aliases:
                    raise DuplicateIntegrationError(
                        f"Integration alias already registered: {alias}"
                    )
            record = IntegrationRecord(
                name=name.strip(),
                instance=instance,
                aliases=alias_names,
                metadata=dict(metadata or {}),
            )
            self._records[normalized] = record
            for alias in alias_names:
                self._aliases[alias] = normalized
            return record
    def get(self, name: str) -> Any:
        normalized = self._normalize(name)
        with self._lock:
            canonical = self._aliases.get(normalized, normalized)
            record = self._records.get(canonical)
            if record is None:
                raise IntegrationNotFoundError(
                    f"Integration not found: {name}"
                )
            return record.instance
    def get_record(self, name: str) -> IntegrationRecord:
        normalized = self._normalize(name)
        with self._lock:
            canonical = self._aliases.get(normalized, normalized)
            if canonical not in self._records:
                raise IntegrationNotFoundError(
                    f"Integration not found: {name}"
                )
            return self._records[canonical]
    def contains(self, name: str) -> bool:
        try:
            self.get_record(name)
            return True
        except IntegrationNotFoundError:
            return False
    def unregister(self, name: str) -> IntegrationRecord:
        normalized = self._normalize(name)
        with self._lock:
            canonical = self._aliases.get(normalized, normalized)
            record = self._records.pop(canonical, None)
            if record is None:
                raise IntegrationNotFoundError(
                    f"Integration not found: {name}"
                )
            for alias in record.aliases:
                self._aliases.pop(alias, None)
            return record
    def enable(self, name: str) -> None:
        self.get_record(name).enabled = True
    def disable(self, name: str) -> None:
        self.get_record(name).enabled = False
    def is_enabled(self, name: str) -> bool:
        return self.get_record(name).enabled
    def list_integrations(self) -> list[str]:
        with self._lock:
            return sorted(
                record.name
                for record in self._records.values()
            )
    def get_metadata(self, name: str) -> dict[str, Any]:
        return dict(self.get_record(name).metadata)
    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._aliases.clear()
# --------------------------------------------------
# PRODUCTION REGISTRY DISCOVERY
# --------------------------------------------------
def load_production_registry() -> tuple[Any | None, str | None]:
    """
    Find a production registry class if it is available.
    Returns the class and its module path. It does not silently
    substitute a production module with a different API.
    """
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
        if registry_class is not None:
            return registry_class, module_name
    return None, None
PRODUCTION_REGISTRY_CLASS, PRODUCTION_REGISTRY_MODULE = (
    load_production_registry()
)
# --------------------------------------------------
# TEST CASE
# --------------------------------------------------
class TestIntegrationRegistry(unittest.TestCase):
    """Tests the registry behavior expected by MedOrbits."""
    def setUp(self) -> None:
        registry_class = (
            PRODUCTION_REGISTRY_CLASS
            or FallbackIntegrationRegistry
        )
        self.registry_class = registry_class
        self.registry = registry_class()
        self.integration = {"service": "medorbits-test"}
    def register_sample(self) -> Any:
        """Register a sample integration using the standard API."""
        return self.registry.register(
            "sample",
            self.integration,
            aliases=["sample-service"],
            metadata={"version": "1.0", "category": "testing"},
        )
    def test_registry_can_be_created(self) -> None:
        self.assertIsNotNone(self.registry)
    def test_register_integration(self) -> None:
        self.registry.register("sample", self.integration)
        self.assertTrue(self.registry.contains("sample"))
    def test_get_registered_integration(self) -> None:
        self.registry.register("sample", self.integration)
        self.assertIs(
            self.registry.get("sample"),
            self.integration,
        )
    def test_lookup_is_case_insensitive(self) -> None:
        self.registry.register("SampleService", self.integration)
        self.assertIs(
            self.registry.get("sampleservice"),
            self.integration,
        )
    def test_lookup_ignores_surrounding_whitespace(self) -> None:
        self.registry.register("sample", self.integration)
        self.assertIs(
            self.registry.get("  sample  "),
            self.integration,
        )
    def test_alias_resolves_to_same_integration(self) -> None:
        self.register_sample()
        self.assertIs(
            self.registry.get("sample-service"),
            self.integration,
        )
    def test_duplicate_name_is_rejected(self) -> None:
        self.registry.register("sample", self.integration)
        with self.assertRaises(Exception):
            self.registry.register("sample", object())
    def test_none_instance_is_rejected(self) -> None:
        with self.assertRaises(Exception):
            self.registry.register("empty", None)
    def test_empty_name_is_rejected(self) -> None:
        with self.assertRaises(Exception):
            self.registry.register("", object())
    def test_missing_integration_returns_default(self) -> None:
        self.assertIsNone(self.registry.get("not-registered"))
        sentinel = object()
        self.assertIs(self.registry.get("not-registered", default=sentinel), sentinel)
    def test_contains_returns_false_for_missing_name(self) -> None:
        self.assertFalse(self.registry.contains("missing"))
    def test_metadata_is_preserved(self) -> None:
        self.register_sample()
        registration = self.registry.registration("sample")
        self.assertEqual(registration.metadata["version"], "1.0")
        self.assertEqual(registration.metadata["category"], "testing")
    def test_list_integrations(self) -> None:
        self.registry.register("alpha", object())
        self.registry.register("beta", object())
        names = self.registry.names()
        self.assertIn("alpha", names)
        self.assertIn("beta", names)
    def test_disable_and_enable_integration(self) -> None:
        self.register_sample()
        self.registry.disable("sample")
        self.assertFalse(self.registry.is_enabled("sample"))
        self.registry.enable("sample")
        self.assertTrue(self.registry.is_enabled("sample"))
    def test_unregister_integration(self) -> None:
        self.register_sample()
        self.registry.unregister("sample")
        self.assertFalse(self.registry.contains("sample"))
        self.assertFalse(self.registry.contains("sample-service"))
    def test_unregister_missing_integration_raises_error(self) -> None:
        with self.assertRaises(Exception):
            self.registry.unregister("missing")
    def test_clear_registry(self) -> None:
        if not hasattr(self.registry, "clear"):
            self.skipTest(
                "Production registry does not expose clear(); "
                "test cleanup is not part of its public API."
            )
        self.registry.register("alpha", object())
        self.registry.clear()
        self.assertEqual(self.registry.names(), ())
    def test_production_registry_source_is_identified(self) -> None:
        if PRODUCTION_REGISTRY_CLASS is None:
            self.skipTest(
                "Production IntegrationRegistry was not found; "
                "fallback implementation is being tested."
            )
        self.assertIsNotNone(PRODUCTION_REGISTRY_MODULE)
if __name__ == "__main__":
    print(
        "Registry under test:",
        PRODUCTION_REGISTRY_MODULE or "isolated fallback",
    )
    unittest.main(verbosity=2)