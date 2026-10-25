"""
MedOrbits Integrations Package
==============================

Provides the package namespace and public metadata for MedOrbits integrations.

This package serves as the foundation for external API clients, third-party
service adapters, internal service connectors, and integration utilities.

Design principles:
    - Lightweight and deterministic package initialization.
    - No network requests or external client initialization during import.
    - No mandatory optional-provider dependencies.
    - Stable, explicitly declared package metadata.
    - Compatibility with automated testing and continuous integration.
    - Clear separation between package initialization and provider logic.

Security principles:
    - Never hardcode credentials, API keys, or access tokens.
    - Load secrets from environment variables or a dedicated secrets manager.
    - Never expose credentials or sensitive personal information in logs.
    - Validate external inputs at the appropriate integration boundary.
    - Apply timeouts, TLS verification, and safe error handling in provider
      implementations.

Compatibility:
    Python 3.10+
"""

from __future__ import annotations

from typing import Final


# ---------------------------------------------------------------------------
# Package metadata
# ---------------------------------------------------------------------------

__title__: Final[str] = "MedOrbits Integrations"
__version__: Final[str] = "1.0.0"
__description__: Final[str] = (
    "Secure, maintainable integration adapters and clients for MedOrbits."
)
__package_name__: Final[str] = "python.integrations"
__author__: Final[str] = "MedOrbits"
__python_requires__: Final[str] = ">=3.10"


# ---------------------------------------------------------------------------
# Public package interface
# ---------------------------------------------------------------------------

__all__ = [
    "__title__",
    "__version__",
    "__description__",
    "__package_name__",
    "__author__",
    "__python_requires__",
]