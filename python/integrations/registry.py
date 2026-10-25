
"""
MedOrbits Integration Registry
==============================

Central registry for discovering and managing external service integrations.

Responsibilities:
    - Register and unregister integration instances.
    - Resolve integrations by canonical name or registered alias.
    - Prevent accidental duplicate registrations.
    - Support safe replacement and optional registration validation.
    - Provide thread-safe lookup and registry snapshots.
    - Filter integrations by category, tags, and capabilities.
    - Initialize and close integrations through optional lifecycle hooks.
    - Avoid network requests and optional dependency imports at module import time.
    - Keep registry errors explicit and predictable.

Compatibility:
    Python 3.10+

Design:
    This module intentionally avoids importing concrete integration providers.
    Provider implementations can be registered by application startup code.

Example:
    from python.integrations.registry import IntegrationRegistry

    registry = IntegrationRegistry()
    registry.register("payments", payment_integration)

    payments = registry.get("payments")
    print(registry.names())
"""

from __future__ import annotations

import logging
import re
import threading
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from types import MappingProxyType
from typing import Any, TypeVar


__all__ = [
    "IntegrationRegistry",
    "IntegrationRegistration",
    "IntegrationRegistryError",
    "IntegrationNotFoundError",
    "DuplicateIntegrationError",
    "InvalidIntegrationError",
    "IntegrationLifecycleError",
]


logger = logging.getLogger(__name__)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class IntegrationRegistryError(RuntimeError):
    """Base exception for integration registry failures."""


class IntegrationNotFoundError(IntegrationRegistryError, KeyError):
    """Raised when an integration cannot be resolved."""


class DuplicateIntegrationError(IntegrationRegistryError):
    """Raised when an integration name or alias is already registered."""


class InvalidIntegrationError(IntegrationRegistryError, ValueError):
    """Raised when an integration registration is invalid."""


class IntegrationLifecycleError(IntegrationRegistryError):
    """Raised when an integration lifecycle operation fails."""


# ---------------------------------------------------------------------------
# Registration metadata
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class IntegrationRegistration:
    """
    Immutable public metadata for a registered integration.

    The integration instance itself is deliberately excluded from this
    metadata object to keep registry snapshots easy to inspect and log.
    """

    name: str
    category: str | None = None
    aliases: tuple[str, ...] = ()
    tags: frozenset[str] = frozenset()
    capabilities: frozenset[str] = frozenset()
    description: str = ""
    enabled: bool = True
    metadata: Mapping[str, Any] = field(
        default_factory=lambda: MappingProxyType({})
    )


@dataclass(slots=True)
class _RegistryEntry:
    """Internal mutable record maintained by the registry."""

    registration: IntegrationRegistration
    instance: Any


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$")


def _normalize_name(value: str, *, field_name: str = "name") -> str:
    """Validate and normalize a registry name or alias."""

    if not isinstance(value, str):
        raise InvalidIntegrationError(
            f"{field_name} must be a string."
        )

    normalized = value.strip().lower()

    if not normalized:
        raise InvalidIntegrationError(
            f"{field_name} cannot be empty."
        )

    if not _NAME_PATTERN.fullmatch(normalized):
        raise InvalidIntegrationError(
            f"Invalid {field_name}: {value!r}. Use letters, digits, "
            "periods, underscores, colons, or hyphens."
        )

    return normalized


def _normalize_string_set(
    values: Iterable[str] | None,
    *,
    field_name: str,
) -> frozenset[str]:
    """Validate and normalize a collection of tags or capabilities."""

    if values is None:
        return frozenset()

    if isinstance(values, str):
        raise InvalidIntegrationError(
            f"{field_name} must be an iterable of strings, not a string."
        )

    try:
        normalized = {
            _normalize_name(value, field_name=field_name)
            for value in values
        }
    except TypeError as exc:
        raise InvalidIntegrationError(
            f"{field_name} must be an iterable of strings."
        ) from exc

    return frozenset(normalized)


def _validate_instance(instance: Any) -> None:
    """
    Validate the minimum contract for an integration object.

    The registry accepts duck-typed integrations rather than requiring
    inheritance from a particular base class. A provider can expose methods
    such as initialize(), close(), health_check(), or execute() as needed.
    """

    if instance is None:
        raise InvalidIntegrationError(
            "Integration instance cannot be None."
        )

    if isinstance(instance, type):
        raise InvalidIntegrationError(
            "Register an integration instance, not an integration class."
        )


# ---------------------------------------------------------------------------
# Integration registry
# ---------------------------------------------------------------------------


class IntegrationRegistry:
    """
    Thread-safe registry for integration instances.

    Names and aliases are normalized to lowercase. All aliases are reserved
    globally, so a name cannot accidentally shadow another integration's
    alias.

    The registry protects its own internal structures. It does not make
    integration instances themselves thread-safe.
    """

    def __init__(
        self,
        *,
        allow_replacement: bool = False,
        validator: Callable[[Any], bool | None] | None = None,
    ) -> None:
        """
        Create an empty integration registry.

        Args:
            allow_replacement:
                Allow register(..., replace=True) to replace an existing
                registration. The per-call replace flag must still be set.

            validator:
                Optional callback used to validate integration instances.
                Return False to reject an instance. Raise an exception to
                reject registration with an explanatory error.
        """

        if validator is not None and not callable(validator):
            raise TypeError("validator must be callable or None.")

        self._entries: dict[str, _RegistryEntry] = {}
        self._aliases: dict[str, str] = {}
        self._lock = threading.RLock()
        self._allow_replacement = bool(allow_replacement)
        self._validator = validator

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(
        self,
        name: str,
        instance: Any,
        *,
        category: str | None = None,
        aliases: Iterable[str] = (),
        tags: Iterable[str] | None = None,
        capabilities: Iterable[str] | None = None,
        description: str = "",
        enabled: bool = True,
        metadata: Mapping[str, Any] | None = None,
        replace: bool = False,
    ) -> Any:
        """
        Register an integration instance and return that instance.

        Args:
            name: Canonical integration name.
            instance: Provider or integration instance.
            category: Optional grouping, such as "payments" or "storage".
            aliases: Alternative names usable with get().
            tags: Searchable labels.
            capabilities: Features supported by the integration.
            description: Short human-readable description.
            enabled: Whether get() should resolve this integration by default.
            metadata: Additional descriptive metadata.
            replace: Replace an existing registration when permitted.

        Raises:
            InvalidIntegrationError: Invalid name, instance, or metadata.
            DuplicateIntegrationError: Name or alias collision.
        """

        canonical_name = _normalize_name(name)
        _validate_instance(instance)

        if category is not None:
            if not isinstance(category, str) or not category.strip():
                raise InvalidIntegrationError(
                    "category must be a non-empty string or None."
                )
            normalized_category = category.strip().lower()
        else:
            normalized_category = None

        if not isinstance(description, str):
            raise InvalidIntegrationError(
                "description must be a string."
            )

        if isinstance(aliases, str):
            raise InvalidIntegrationError(
                "aliases must be an iterable of strings, not a string."
            )

        try:
            normalized_aliases = tuple(
                sorted(
                    {
                        _normalize_name(alias, field_name="alias")
                        for alias in aliases
                    }
                )
            )
        except TypeError as exc:
            raise InvalidIntegrationError(
                "aliases must be an iterable of strings."
            ) from exc

        if canonical_name in normalized_aliases:
            normalized_aliases = tuple(
                alias
                for alias in normalized_aliases
                if alias != canonical_name
            )

        normalized_tags = _normalize_string_set(
            tags,
            field_name="tag",
        )
        normalized_capabilities = _normalize_string_set(
            capabilities,
            field_name="capability",
        )

        if metadata is None:
            normalized_metadata: Mapping[str, Any] = MappingProxyType({})
        elif not isinstance(metadata, Mapping):
            raise InvalidIntegrationError(
                "metadata must be a mapping or None."
            )
        else:
            # Copy the mapping so later changes to the caller's dictionary
            # do not alter the registry's top-level metadata.
            normalized_metadata = MappingProxyType(dict(metadata))

        if self._validator is not None:
            try:
                validation_result = self._validator(instance)
            except Exception as exc:
                raise InvalidIntegrationError(
                    f"Validation failed for integration "
                    f"{canonical_name!r}: {exc}"
                ) from exc

            if validation_result is False:
                raise InvalidIntegrationError(
                    f"Integration {canonical_name!r} was rejected "
                    "by the registry validator."
                )

        registration = IntegrationRegistration(
            name=canonical_name,
            category=normalized_category,
            aliases=normalized_aliases,
            tags=normalized_tags,
            capabilities=normalized_capabilities,
            description=description.strip(),
            enabled=bool(enabled),
            metadata=normalized_metadata,
        )

        with self._lock:
            existing_entry = self._entries.get(canonical_name)

            if existing_entry is not None and not replace:
                raise DuplicateIntegrationError(
                    f"Integration {canonical_name!r} is already registered."
                )

            if replace and not self._allow_replacement:
                raise DuplicateIntegrationError(
                    "Replacement is disabled for this registry. "
                    "Initialize with allow_replacement=True to enable it."
                )

            # Validate all new aliases before mutating any registry state.
            reserved_names = set(normalized_aliases)
            reserved_names.add(canonical_name)

            for reserved_name in reserved_names:
                alias_owner = self._aliases.get(reserved_name)

                if (
                    alias_owner is not None
                    and alias_owner != canonical_name
                ):
                    raise DuplicateIntegrationError(
                        f"Name or alias {reserved_name!r} is already "
                        f"reserved by integration {alias_owner!r}."
                    )

                if (
                    reserved_name in self._entries
                    and reserved_name != canonical_name
                ):
                    raise DuplicateIntegrationError(
                        f"Name or alias {reserved_name!r} conflicts with "
                        "an existing canonical integration name."
                    )

            # Replacement must remove old aliases before writing new ones.
            if existing_entry is not None:
                for old_alias in existing_entry.registration.aliases:
                    if self._aliases.get(old_alias) == canonical_name:
                        del self._aliases[old_alias]

            self._entries[canonical_name] = _RegistryEntry(
                registration=registration,
                instance=instance,
            )

            for alias in normalized_aliases:
                self._aliases[alias] = canonical_name

        logger.debug(
            "Registered integration %s (category=%s, enabled=%s).",
            canonical_name,
            normalized_category,
            registration.enabled,
        )

        return instance

    def unregister(
        self,
        name: str,
        *,
        close: bool = False,
    ) -> Any:
        """
        Remove a registration and return its instance.

        If close=True, call the instance's close() method after removal.
        A close failure is reported as IntegrationLifecycleError, but the
        registration remains removed.

        This method does not call close() by default.
        """

        canonical_name = self._resolve_name(name)

        with self._lock:
            entry = self._entries.pop(canonical_name, None)

            if entry is None:
                raise IntegrationNotFoundError(
                    f"Integration {canonical_name!r} is not registered."
                )

            for alias in entry.registration.aliases:
                if self._aliases.get(alias) == canonical_name:
                    del self._aliases[alias]

        if close:
            self._invoke_lifecycle(
                canonical_name,
                entry.instance,
                "close",
            )

        logger.debug("Unregistered integration %s.", canonical_name)
        return entry.instance

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------

    def get(
        self,
        name: str,
        *,
        default: T | None = None,
        require_enabled: bool = True,
    ) -> Any | T | None:
        """
        Resolve an integration by canonical name or alias.

        Returns default if the integration does not exist, or if it is
        disabled while require_enabled=True.
        """

        normalized_name = _normalize_name(name)

        with self._lock:
            canonical_name = self._aliases.get(
                normalized_name,
                normalized_name,
            )
            entry = self._entries.get(canonical_name)

            if entry is None:
                return default

            if require_enabled and not entry.registration.enabled:
                return default

            return entry.instance

    def require(self, name: str, *, require_enabled: bool = True) -> Any:
        """
        Resolve an integration or raise IntegrationNotFoundError.
        """

        normalized_name = _normalize_name(name)

        with self._lock:
            canonical_name = self._aliases.get(
                normalized_name,
                normalized_name,
            )
            entry = self._entries.get(canonical_name)

            if entry is None:
                raise IntegrationNotFoundError(
                    f"Integration {normalized_name!r} is not registered."
                )

            if require_enabled and not entry.registration.enabled:
                raise IntegrationNotFoundError(
                    f"Integration {canonical_name!r} is registered "
                    "but disabled."
                )

            return entry.instance

    def contains(self, name: str) -> bool:
        """Return True if a canonical name or alias is registered."""

        try:
            normalized_name = _normalize_name(name)
        except InvalidIntegrationError:
            return False

        with self._lock:
            canonical_name = self._aliases.get(
                normalized_name,
                normalized_name,
            )
            return canonical_name in self._entries

    def registration(self, name: str) -> IntegrationRegistration:
        """Return immutable registration metadata for a name or alias."""

        normalized_name = _normalize_name(name)

        with self._lock:
            canonical_name = self._aliases.get(
                normalized_name,
                normalized_name,
            )
            entry = self._entries.get(canonical_name)

            if entry is None:
                raise IntegrationNotFoundError(
                    f"Integration {normalized_name!r} is not registered."
                )

            return entry.registration

    # ------------------------------------------------------------------
    # Discovery and snapshots
    # ------------------------------------------------------------------

    def names(self, *, include_disabled: bool = True) -> tuple[str, ...]:
        """Return registered canonical names in sorted order."""

        with self._lock:
            return tuple(
                sorted(
                    name
                    for name, entry in self._entries.items()
                    if include_disabled or entry.registration.enabled
                )
            )

    def aliases(self) -> Mapping[str, str]:
        """Return a read-only snapshot mapping aliases to canonical names."""

        with self._lock:
            return MappingProxyType(dict(self._aliases))

    def registrations(
        self,
        *,
        category: str | None = None,
        tag: str | None = None,
        capability: str | None = None,
        enabled_only: bool = False,
    ) -> tuple[IntegrationRegistration, ...]:
        """
        Discover integrations by metadata.

        Filters are combined using AND semantics.
        """

        normalized_category = (
            category.strip().lower()
            if isinstance(category, str) and category.strip()
            else None
        )
        normalized_tag = (
            _normalize_name(tag, field_name="tag")
            if tag is not None
            else None
        )
        normalized_capability = (
            _normalize_name(capability, field_name="capability")
            if capability is not None
            else None
        )

        with self._lock:
            records = [
                entry.registration
                for entry in self._entries.values()
            ]

        matches = []

        for record in records:
            if enabled_only and not record.enabled:
                continue

            if (
                normalized_category is not None
                and record.category != normalized_category
            ):
                continue

            if normalized_tag is not None and normalized_tag not in record.tags:
                continue

            if (
                normalized_capability is not None
                and normalized_capability not in record.capabilities
            ):
                continue

            matches.append(record)

        return tuple(sorted(matches, key=lambda item: item.name))

    def snapshot(self) -> Mapping[str, IntegrationRegistration]:
        """
        Return a read-only snapshot of canonical names and metadata.

        The returned mapping is independent of future registry changes.
        Metadata values themselves are not recursively frozen.
        """

        with self._lock:
            data = {
                name: entry.registration
                for name, entry in self._entries.items()
            }

        return MappingProxyType(data)

    def instances(self, *, include_disabled: bool = False) -> Mapping[str, Any]:
        """
        Return a read-only snapshot mapping canonical names to instances.

        Instances are shared references, not copies. Avoid exposing this
        snapshot to untrusted callers.
        """

        with self._lock:
            data = {
                name: entry.instance
                for name, entry in self._entries.items()
                if include_disabled or entry.registration.enabled
            }

        return MappingProxyType(data)

    def __contains__(self, name: object) -> bool:
        return isinstance(name, str) and self.contains(name)

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def __iter__(self):
        """Iterate over a snapshot of canonical names."""

        return iter(self.names())

    # ------------------------------------------------------------------
    # Enable / disable
    # ------------------------------------------------------------------

    def set_enabled(self, name: str, enabled: bool) -> IntegrationRegistration:
        """
        Enable or disable an integration without removing its registration.

        This changes registry metadata only. It does not start, stop, or
        otherwise alter the underlying provider.
        """

        normalized_name = _normalize_name(name)

        with self._lock:
            canonical_name = self._aliases.get(
                normalized_name,
                normalized_name,
            )
            entry = self._entries.get(canonical_name)

            if entry is None:
                raise IntegrationNotFoundError(
                    f"Integration {normalized_name!r} is not registered."
                )

            updated = IntegrationRegistration(
                name=entry.registration.name,
                category=entry.registration.category,
                aliases=entry.registration.aliases,
                tags=entry.registration.tags,
                capabilities=entry.registration.capabilities,
                description=entry.registration.description,
                enabled=bool(enabled),
                metadata=entry.registration.metadata,
            )

            entry.registration = updated

        return updated

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def initialize(
        self,
        *,
        names: Iterable[str] | None = None,
        continue_on_error: bool = False,
    ) -> Mapping[str, bool]:
        """
        Call initialize() on selected enabled integrations when available.

        Integrations without initialize() are treated as successfully skipped.
        Lifecycle calls occur outside the registry lock.

        Returns:
            Read-only mapping of canonical integration names to success flags.

        Raises:
            IntegrationLifecycleError: On failure unless continue_on_error=True.
        """

        if names is None:
            selected_names = self.names(include_disabled=False)
        else:
            if isinstance(names, str):
                raise InvalidIntegrationError(
                    "names must be an iterable of integration names."
                )
            selected_names = tuple(
                dict.fromkeys(
                    self._resolve_name(name)
                    for name in names
                )
            )

        results: dict[str, bool] = {}

        for name in selected_names:
            with self._lock:
                entry = self._entries.get(name)

                if entry is None:
                    raise IntegrationNotFoundError(
                        f"Integration {name!r} is not registered."
                    )

                if not entry.registration.enabled:
                    continue

                instance = entry.instance

            try:
                self._invoke_lifecycle(name, instance, "initialize")
                results[name] = True
            except IntegrationLifecycleError:
                results[name] = False

                if not continue_on_error:
                    raise

        return MappingProxyType(results)

    def close(
        self,
        *,
        names: Iterable[str] | None = None,
        continue_on_error: bool = False,
    ) -> Mapping[str, bool]:
        """
        Call close() on selected registered integrations when available.

        Registrations are retained. Call unregister() to remove them.
        """

        if names is None:
            selected_names = self.names(include_disabled=True)
        else:
            if isinstance(names, str):
                raise InvalidIntegrationError(
                    "names must be an iterable of integration names."
                )
            selected_names = tuple(
                dict.fromkeys(
                    self._resolve_name(name)
                    for name in names
                )
            )

        results: dict[str, bool] = {}

        for name in selected_names:
            with self._lock:
                entry = self._entries.get(name)

                if entry is None:
                    raise IntegrationNotFoundError(
                        f"Integration {name!r} is not registered."
                    )

                instance = entry.instance

            try:
                self._invoke_lifecycle(name, instance, "close")
                results[name] = True
            except IntegrationLifecycleError:
                results[name] = False

                if not continue_on_error:
                    raise

        return MappingProxyType(results)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_name(self, name: str) -> str:
        """Resolve a canonical name or alias to its canonical name."""

        normalized_name = _normalize_name(name)

        with self._lock:
            return self._aliases.get(normalized_name, normalized_name)

    @staticmethod
    def _invoke_lifecycle(
        name: str,
        instance: Any,
        method_name: str,
    ) -> None:
        """Invoke an optional lifecycle method with consistent errors."""

        method = getattr(instance, method_name, None)

        if method is None:
            return

        if not callable(method):
            raise IntegrationLifecycleError(
                f"Integration {name!r} defines a non-callable "
                f"{method_name} attribute."
            )

        try:
            method()
        except Exception as exc:
            logger.exception(
                "Integration lifecycle method failed: %s.%s",
                name,
                method_name,
            )
            raise IntegrationLifecycleError(
                f"Integration {name!r} failed during {method_name}()."
            ) from exc


# ---------------------------------------------------------------------------
# Optional application-level default registry
# ---------------------------------------------------------------------------

_default_registry: IntegrationRegistry | None = None
_default_registry_lock = threading.Lock()


def get_default_registry() -> IntegrationRegistry:
    """
    Return the process-level default registry, creating it on first use.

    The registry is created lazily. Importing this module does not instantiate
    provider clients or perform network requests.
    """

    global _default_registry

    if _default_registry is None:
        with _default_registry_lock:
            if _default_registry is None:
                _default_registry = IntegrationRegistry()

    return _default_registry


def set_default_registry(registry: IntegrationRegistry) -> None:
    """Set the process-level default registry."""

    if not isinstance(registry, IntegrationRegistry):
        raise TypeError("registry must be an IntegrationRegistry instance.")

    global _default_registry

    with _default_registry_lock:
        _default_registry = registry
