
"""Centralized configuration for MedOrbits Python tools.

Responsibilities:
    - Read application settings from environment variables.
    - Validate configuration values and types.
    - Support explicit loading of a local dotenv file.
    - Provide safe defaults for repository tooling.
    - Avoid logging or displaying secret values.
    - Keep imports side-effect-free.

Security:
    - Never commit real credentials or production secrets.
    - Environment variables take precedence over dotenv values.
    - Dotenv loading is optional and requires an explicit call.
    - Configuration validation does not connect to external services.

Compatible with Python 3.10+.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping


__all__ = [
    "ConfigurationError",
    "MedOrbitsConfig",
    "get_config",
    "load_dotenv_file",
    "reset_config_cache",
    "validate_environment",
]


class ConfigurationError(ValueError):
    """Raised when application configuration is invalid."""


_TRUE_VALUES = frozenset({"1", "true", "yes", "on"})
_FALSE_VALUES = frozenset({"0", "false", "no", "off"})

_LOG_LEVELS = frozenset(
    {
        "CRITICAL",
        "ERROR",
        "WARNING",
        "INFO",
        "DEBUG",
        "NOTSET",
    }
)

_ENV_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_PORT_PATTERN = re.compile(r"^[0-9]{1,5}$")


def _read_bool(
    name: str,
    default: bool,
    environ: Mapping[str, str],
) -> bool:
    """Parse a boolean environment variable."""
    raw = environ.get(name)

    if raw is None or not raw.strip():
        return default

    normalized = raw.strip().lower()

    if normalized in _TRUE_VALUES:
        return True

    if normalized in _FALSE_VALUES:
        return False

    raise ConfigurationError(
        f"{name} must be a boolean value "
        "(true/false, yes/no, on/off, or 1/0)."
    )


def _read_int(
    name: str,
    default: int,
    environ: Mapping[str, str],
    *,
    minimum: int,
    maximum: int,
) -> int:
    """Parse and range-check an integer environment variable."""
    raw = environ.get(name)

    if raw is None or not raw.strip():
        value = default
    else:
        try:
            value = int(raw.strip())
        except ValueError as exc:
            raise ConfigurationError(
                f"{name} must be an integer."
            ) from exc

    if not minimum <= value <= maximum:
        raise ConfigurationError(
            f"{name} must be between {minimum} and {maximum}."
        )

    return value


def _read_text(
    name: str,
    default: str,
    environ: Mapping[str, str],
) -> str:
    """Read a non-empty text setting, falling back to a default."""
    value = environ.get(name, default).strip()

    if not value:
        return default

    if "\x00" in value:
        raise ConfigurationError(
            f"{name} contains an invalid null character."
        )

    return value


def _read_log_level(
    environ: Mapping[str, str],
) -> str:
    """Read and validate the logging level."""
    value = _read_text("LOG_LEVEL", "INFO", environ).upper()

    if value not in _LOG_LEVELS:
        raise ConfigurationError(
            "LOG_LEVEL must be one of: "
            + ", ".join(sorted(_LOG_LEVELS))
            + "."
        )

    return value


def _read_port(
    environ: Mapping[str, str],
) -> int:
    """Read a valid TCP port."""
    raw = environ.get("PORT")

    if raw is None or not raw.strip():
        return 8000

    raw = raw.strip()

    if not _PORT_PATTERN.fullmatch(raw):
        raise ConfigurationError("PORT must be a numeric TCP port.")

    port = int(raw)

    if not 1 <= port <= 65535:
        raise ConfigurationError("PORT must be between 1 and 65535.")

    return port


def _read_optional_path(
    name: str,
    environ: Mapping[str, str],
) -> Path | None:
    """Read an optional filesystem path without creating it."""
    raw = environ.get(name)

    if raw is None or not raw.strip():
        return None

    path = Path(raw.strip()).expanduser()

    return path


@dataclass(frozen=True, slots=True)
class MedOrbitsConfig:
    """Immutable settings for MedOrbits tooling."""

    app_name: str = "MedOrbits"
    app_environment: str = "development"
    app_version: str = "1.0.0"

    debug: bool = False
    testing: bool = False

    log_level: str = "INFO"
    log_format: str = "text"

    host: str = "127.0.0.1"
    port: int = 8000

    repository_root: Path = field(
        default_factory=lambda: Path.cwd().resolve()
    )

    data_dir: Path | None = None
    report_dir: Path | None = None
    schema_dir: Path | None = None

    enable_network: bool = False
    enable_ai: bool = False
    enable_external_integrations: bool = False

    request_timeout_seconds: int = 15
    max_input_bytes: int = 10 * 1024 * 1024
    max_report_files: int = 100_000

    @classmethod
    def from_environment(
        cls,
        environ: Mapping[str, str] | None = None,
    ) -> "MedOrbitsConfig":
        """Build validated settings from environment variables.

        Args:
            environ: Optional mapping for tests or controlled execution.
                Defaults to the process environment.

        Returns:
            A validated, immutable configuration object.

        Raises:
            ConfigurationError: If a configured value is invalid.
        """
        source = os.environ if environ is None else environ

        environment = _read_text(
            "APP_ENV",
            "development",
            source,
        ).lower()

        if environment not in {
            "development",
            "test",
            "staging",
            "production",
        }:
            raise ConfigurationError(
                "APP_ENV must be development, test, staging, or production."
            )

        debug = _read_bool("DEBUG", False, source)
        testing = _read_bool(
            "TESTING",
            environment == "test",
            source,
        )

        if environment == "production" and debug:
            raise ConfigurationError(
                "DEBUG must be disabled in production."
            )

        if environment == "production" and testing:
            raise ConfigurationError(
                "TESTING must be disabled in production."
            )

        log_format = _read_text(
            "LOG_FORMAT",
            "text",
            source,
        ).lower()

        if log_format not in {"text", "json"}:
            raise ConfigurationError(
                "LOG_FORMAT must be either text or json."
            )

        root = Path(
            _read_text(
                "MEDORBITS_ROOT",
                str(Path.cwd()),
                source,
            )
        ).expanduser().resolve()

        return cls(
            app_name=_read_text(
                "APP_NAME",
                "MedOrbits",
                source,
            ),
            app_environment=environment,
            app_version=_read_text(
                "APP_VERSION",
                "1.0.0",
                source,
            ),
            debug=debug,
            testing=testing,
            log_level=_read_log_level(source),
            log_format=log_format,
            host=_read_text("HOST", "127.0.0.1", source),
            port=_read_port(source),
            repository_root=root,
            data_dir=_read_optional_path("DATA_DIR", source),
            report_dir=_read_optional_path("REPORT_DIR", source),
            schema_dir=_read_optional_path("SCHEMA_DIR", source),
            enable_network=_read_bool(
                "ENABLE_NETWORK",
                False,
                source,
            ),
            enable_ai=_read_bool(
                "ENABLE_AI",
                False,
                source,
            ),
            enable_external_integrations=_read_bool(
                "ENABLE_EXTERNAL_INTEGRATIONS",
                False,
                source,
            ),
            request_timeout_seconds=_read_int(
                "REQUEST_TIMEOUT_SECONDS",
                15,
                source,
                minimum=1,
                maximum=300,
            ),
            max_input_bytes=_read_int(
                "MAX_INPUT_BYTES",
                10 * 1024 * 1024,
                source,
                minimum=1,
                maximum=1024 * 1024 * 1024,
            ),
            max_report_files=_read_int(
                "MAX_REPORT_FILES",
                100_000,
                source,
                minimum=1,
                maximum=1_000_000,
            ),
        )

    def safe_summary(self) -> dict[str, object]:
        """Return a diagnostic summary containing no credential values."""
        return {
            "app_name": self.app_name,
            "app_environment": self.app_environment,
            "app_version": self.app_version,
            "debug": self.debug,
            "testing": self.testing,
            "log_level": self.log_level,
            "log_format": self.log_format,
            "host": self.host,
            "port": self.port,
            "repository_root": str(self.repository_root),
            "data_dir_configured": self.data_dir is not None,
            "report_dir_configured": self.report_dir is not None,
            "schema_dir_configured": self.schema_dir is not None,
            "enable_network": self.enable_network,
            "enable_ai": self.enable_ai,
            "enable_external_integrations": (
                self.enable_external_integrations
            ),
            "request_timeout_seconds": self.request_timeout_seconds,
            "max_input_bytes": self.max_input_bytes,
            "max_report_files": self.max_report_files,
        }


_CONFIG_CACHE: MedOrbitsConfig | None = None


def get_config(
    *,
    reload: bool = False,
) -> MedOrbitsConfig:
    """Return cached configuration or load it from the environment."""
    global _CONFIG_CACHE

    if reload or _CONFIG_CACHE is None:
        _CONFIG_CACHE = MedOrbitsConfig.from_environment()

    return _CONFIG_CACHE


def reset_config_cache() -> None:
    """Clear cached configuration, useful for tests."""
    global _CONFIG_CACHE
    _CONFIG_CACHE = None


def validate_environment(
    environ: Mapping[str, str] | None = None,
) -> list[str]:
    """Return safe configuration validation errors.

    This function never includes raw environment values in its output.
    """
    try:
        MedOrbitsConfig.from_environment(environ)
    except ConfigurationError as exc:
        return [str(exc)]

    return []


def load_dotenv_file(
    path: Path,
    *,
    override: bool = False,
) -> int:
    """Explicitly load simple KEY=VALUE entries from a dotenv file.

    This lightweight parser intentionally does not implement the entire
    dotenv specification. It supports blank lines, comments, optional
    `export ` prefixes, and simple single- or double-quoted values.

    Existing environment variables take precedence unless override=True.

    Returns:
        Number of environment variables added or changed.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If a malformed entry or invalid variable name is found.

    Security:
        The file is never executed as shell code. Values are never printed.
    """
    dotenv_path = path.expanduser()

    if not dotenv_path.is_file():
        raise FileNotFoundError("Dotenv file is not a regular file.")

    try:
        lines = dotenv_path.read_text(encoding="utf-8-sig").splitlines()
    except (OSError, UnicodeError) as exc:
        raise ValueError("Dotenv file could not be read.") from exc

    pending: dict[str, str] = {}

    for line_number, original_line in enumerate(lines, start=1):
        line = original_line.strip()

        if not line or line.startswith("#"):
            continue

        if line.startswith("export "):
            line = line[len("export "):].strip()

        if "=" not in line:
            raise ValueError(
                f"Malformed dotenv entry on line {line_number}."
            )

        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip()

        if not _ENV_NAME_PATTERN.fullmatch(name):
            raise ValueError(
                f"Invalid environment variable name on line {line_number}."
            )

        if value.startswith(("'", '"')):
            quote = value[0]

            if len(value) < 2 or not value.endswith(quote):
                raise ValueError(
                    f"Unclosed quoted value on line {line_number}."
                )

            value = value[1:-1]
        else:
            # Remove an inline comment only when preceded by whitespace.
            comment_index = value.find(" #")
            if comment_index >= 0:
                value = value[:comment_index].rstrip()

        if "\x00" in value:
            raise ValueError(
                f"Invalid null character on line {line_number}."
            )

        pending[name] = value

    changed = 0

    for name, value in pending.items():
        if not override and name in os.environ:
            continue

        if os.environ.get(name) != value:
            os.environ[name] = value
            changed += 1

    if changed:
        reset_config_cache()

    return changed
