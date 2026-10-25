
"""
MedOrbits Python package.

File: src/python/medorbits/__init__.py

Purpose:
    Define package metadata and a stable, minimal public API for the
    MedOrbits Python components.

Design principles:
    - Avoid side effects during package import.
    - Do not load environment files or initialize external services here.
    - Do not expose credentials, private configuration, or internal modules.
    - Keep imports lightweight for tests, CLI tools, and application startup.

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

# Keep this aligned with the Python package version configured by the
# project's packaging metadata. The fallback supports source checkouts
# where the package has not been installed.
try:
    __version__ = version("medorbits")
except PackageNotFoundError:
    __version__ = "0.1.0"

__all__ = [
    "__author__",
    "__copyright__",
    "__description__",
    "__license__",
    "__title__",
    "__version__",
]
