
"""
MedOrbits Python package.

File: src/python/medorbits/__init__.py

Purpose:
    Define package metadata and a stable, minimal public API for MedOrbits
    Python components.

Design principles:
    - Avoid side effects during package import.
    - Do not load environment files or initialize external services.
    - Do not expose credentials, private configuration, or internal modules.
    - Keep imports lightweight for tests, CLI tools, and application startup.
    - Prefer installed distribution metadata for the package version.
    - Support importing directly from an uninstalled source checkout.

Recommended package layout:

    src/python/
    └── medorbits/
        ├── __init__.py
        ├── config.py
        ├── exceptions.py
        └── ...
"""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

__title__ = "medorbits"
__description__ = (
    "MedOrbits education, admissions, career guidance, "
    "recruitment, and application services."
)
__author__ = "MedOrbits"
__license__ = "Proprietary"
__copyright__ = "Copyright MedOrbits"

# Keep this fallback synchronized with the project's packaging metadata.
# Installed distribution metadata takes precedence when available.
_VERSION_FALLBACK = "0.1.0"

try:
    __version__ = version(__title__)
except PackageNotFoundError:
    # Expected when importing directly from an uninstalled source checkout.
    __version__ = _VERSION_FALLBACK

__all__ = [
    "__author__",
    "__copyright__",
    "__description__",
    "__license__",
    "__title__",
    "__version__",
]
