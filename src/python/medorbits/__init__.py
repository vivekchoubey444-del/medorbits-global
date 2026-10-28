
"""MedOrbits Python package.

File: src/python/medorbits/__init__.py

Purpose:
    Define package metadata and a stable, lightweight public API.

Design principles:
    - Avoid side effects during package import.
    - Never load environment files or initialize external services.
    - Never expose credentials or private configuration.
    - Prefer installed distribution metadata for the package version.
    - Support imports from an uninstalled source checkout.
"""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version
from typing import Final


__title__: Final[str] = "medorbits"

__description__: Final[str] = (
    "MedOrbits education, admissions, career guidance, "
    "recruitment, and application services."
)

__author__: Final[str] = "MedOrbits"
__license__: Final[str] = "Proprietary"
__copyright__: Final[str] = "Copyright MedOrbits"

# Keep synchronized with pyproject.toml or the project's packaging metadata.
_VERSION_FALLBACK: Final[str] = "0.1.0"


def _resolve_version() -> str:
    """Return the installed distribution version or source fallback."""
    try:
        installed_version = version(__title__)
    except PackageNotFoundError:
        return _VERSION_FALLBACK

    return installed_version or _VERSION_FALLBACK


__version__: Final[str] = _resolve_version()


__all__ = [
    "__author__",
    "__copyright__",
    "__description__",
    "__license__",
    "__title__",
    "__version__",
]
