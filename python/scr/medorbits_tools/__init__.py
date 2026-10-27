
"""MedOrbits tools package.

Reusable utilities for repository validation, reporting, data processing,
and safe automation.

Package policy:
    - Keep package imports lightweight.
    - Avoid filesystem, network, or subprocess side effects on import.
    - Do not expose secrets through logs or exception messages.
    - Keep optional dependencies optional.
    - Preserve backwards compatibility for documented public functions.

Example:
    from medorbits_tools import __version__
    print(__version__)

    from medorbits_tools import validate_json_file
    result = validate_json_file("data/colleges.json")

Note:
    Individual modules should implement their own validation and error
    handling. Public imports are exposed lazily when their modules exist.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any


__version__ = "1.0.0"
__author__ = "MedOrbits"
__license__ = "BSD-3-Clause"


# Public API registry.
#
# Keys are the public names exported by this package.
# Values are (module_name, attribute_name) pairs relative to this package.
#
# Add entries only after the corresponding modules and public functions
# have been implemented and reviewed.
_PUBLIC_API: dict[str, tuple[str, str]] = {
    # Example:
    # "validate_json_file": ("validation", "validate_json_file"),
    # "generate_report": ("reporting", "generate_report"),
}

__all__ = [
    "__author__",
    "__license__",
    "__version__",
    *_PUBLIC_API.keys(),
]


def __getattr__(name: str) -> Any:
    """Resolve registered public API symbols lazily.

    Raises:
        AttributeError: If the requested name is not part of the public API.
        ImportError: If a registered module or its dependency cannot be loaded.
    """
    target = _PUBLIC_API.get(name)

    if target is None:
        raise AttributeError(
            f"module {__name__!r} has no attribute {name!r}"
        )

    module_name, attribute_name = target
    module = import_module(f".{module_name}", package=__name__)

    try:
        value = getattr(module, attribute_name)
    except AttributeError as exc:
        raise ImportError(
            f"Registered public API symbol {name!r} is missing from "
            f"{module_name!r}."
        ) from exc

    globals()[name] = value
    return value


def __dir__() -> list[str]:
    """Include lazily exported public symbols in package introspection."""
    return sorted(set(globals()) | set(__all__))
