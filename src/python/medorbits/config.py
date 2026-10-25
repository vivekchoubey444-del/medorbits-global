
"""
MedOrbits -- Python Configuration
File: src/python/medorbits/config.py

Purpose:
    Centralize and validate configuration for MedOrbits Python services.

Features:
    - Typed environment-variable parsing.
    - Environment-specific validation.
    - Safe defaults for development and testing.
    - Production configuration safeguards.
    - Secret-safe settings representation.
    - No implicit .env loading or external service initialization.

Security:
    - Supply production secrets through the deployment environment or a
      dedicated secrets manager.
    - Never log secret values.
    - This module validates settings; it does not connect to services.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Final
from urllib.parse import urlsplit


SUPPORTED_ENVIRONMENTS: Final[frozenset[str]] = frozenset(
    {"development", "test", "staging", "production"}
)

DEFAULT_ALLOWED_ORIGINS: Final[tuple[str, ...]] = (
    "http://localhost:3000",
)

DEFAULT_UPLOAD_MIME_TYPES: Final[tuple[str, ...]] = (
    "application/pdf",
    "image/jpeg",
    "image/png",
)

DEFAULT_MAX_UPLOAD_SIZE_MB: Final[int] = 25
DEFAULT_MAX_UPLOAD_FILES: Final[int] = 10
DEFAULT_MAX_TOTAL_UPLOAD_SIZE_MB: Final[int] = 100

DEFAULT_LOG_LEVEL: Final[str] = "INFO"
SUPPORTED_LOG_LEVELS: Final[frozenset[str]] = frozenset(
    {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
)

DATABASE_ENGINES: Final[frozenset[str]] = frozenset(
    {"postgresql", "mysql"}
)

ENVIRONMENT_NAME_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$"
)

MIME_TYPE_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$"
)


class ConfigurationError(ValueError):
    """Raised when MedOrbits configuration is missing or invalid."""


def _get_string(
    name: str,
    default: str | None = None,
    *,
    required: bool = False,
    allow_empty: bool = False,
) -> str:
    """Read and normalize a string environment variable."""
    raw_value = os.environ.get(name)

    if raw_value is None:
        if required:
            raise ConfigurationError(
                f"Required environment variable {name} is missing."
            )
        return default if default is not None else ""

    value = raw_value.strip()

    if not value and not allow_empty:
        if required:
            raise ConfigurationError(
                f"Required environment variable {name} is empty."
            )
        if default is not None:
            return default

    if "\x00" in value:
        raise ConfigurationError(
            f"Environment variable {name} contains invalid characters."
        )

    return value


def _get_bool(name: str, default: bool = False) -> bool:
    """Parse a boolean environment variable strictly."""
    raw_value = os.environ.get(name)

    if raw_value is None:
        return default

    normalized = raw_value.strip().lower()

    if normalized in {"1", "true", "yes", "on"}:
        return True

    if normalized in {"0", "false", "no", "off"}:
        return False

    raise ConfigurationError(
        f"Environment variable {name} must be a valid boolean."
    )


def _get_int(
    name: str,
    default: int,
    *,
    minimum: int,
    maximum: int,
) -> int:
    """Parse and validate a bounded integer."""
    raw_value = os.environ.get(name)

    if raw_value is None:
        value = default
    else:
        normalized = raw_value.strip()

        if not re.fullmatch(r"[+-]?\d+", normalized):
            raise ConfigurationError(
                f"Environment variable {name} must be an integer."
            )

        try:
            value = int(normalized)
        except ValueError as exc:
            raise ConfigurationError(
                f"Environment variable {name} is invalid."
            ) from exc

    if not minimum <= value <= maximum:
        raise ConfigurationError(
            f"Environment variable {name} must be between "
            f"{minimum} and {maximum}."
        )

    return value


def _get_csv(
    name: str,
    default: tuple[str, ...] = (),
) -> tuple[str, ...]:
    """Parse a comma-separated list and reject empty entries."""
    raw_value = os.environ.get(name)

    if raw_value is None:
        return default

    if not raw_value.strip():
        return ()

    items = tuple(item.strip() for item in raw_value.split(","))

    if any(not item for item in items):
        raise ConfigurationError(
            f"Environment variable {name} contains an empty list item."
        )

    return tuple(dict.fromkeys(items))


def _validate_url(
    name: str,
    value: str,
    *,
    allowed_schemes: frozenset[str],
    require_host: bool = True,
) -> str:
    """Validate a service URL without including it in error messages."""
    try:
        parsed = urlsplit(value)
        # Accessing .port triggers validation of malformed port values.
        port = parsed.port
    except ValueError as exc:
        raise ConfigurationError(
            f"Environment variable {name} is not a valid URL."
        ) from exc

    if parsed.scheme.lower() not in allowed_schemes:
        raise ConfigurationError(
            f"Environment variable {name} uses an unsupported URL scheme."
        )

    if require_host and not parsed.hostname:
        raise ConfigurationError(
            f"Environment variable {name} must include a hostname."
        )

    if parsed.username or parsed.password:
        raise ConfigurationError(
            f"Environment variable {name} must not contain URL credentials."
        )

    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise ConfigurationError(
            f"Environment variable {name} contains control characters."
        )

    if port is not None and not 1 <= port <= 65535:
        raise ConfigurationError(
            f"Environment variable {name} contains an invalid port."
        )

    return value


def _validate_origins(origins: tuple[str, ...]) -> tuple[str, ...]:
    """Validate trusted browser origins."""
    validated: list[str] = []

    for origin in origins:
        if origin == "*":
            raise ConfigurationError(
                "Wildcard CORS origins are not permitted by this configuration."
            )

        try:
            parsed = urlsplit(origin)
            port = parsed.port
        except ValueError as exc:
            raise ConfigurationError(
                "CORS_ALLOWED_ORIGINS contains an invalid origin."
            ) from exc

        if parsed.scheme.lower() not in {"http", "https"}:
            raise ConfigurationError(
                "CORS_ALLOWED_ORIGINS must use HTTP or HTTPS."
            )

        if not parsed.hostname:
            raise ConfigurationError(
                "CORS_ALLOWED_ORIGINS must contain a hostname."
            )

        if (
            parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ConfigurationError(
                "CORS_ALLOWED_ORIGINS entries must be origins, not full URLs."
            )

        if port is not None and not 1 <= port <= 65535:
            raise ConfigurationError(
                "CORS_ALLOWED_ORIGINS contains an invalid port."
            )

        validated.append(origin.rstrip("/"))

    return tuple(dict.fromkeys(validated))


def _validate_mime_types(
    mime_types: tuple[str, ...],
) -> tuple[str, ...]:
    """Validate an explicit MIME-type allowlist."""
    normalized: list[str] = []

    for mime_type in mime_types:
        value = mime_type.lower()

        if "*" in value or not MIME_TYPE_PATTERN.fullmatch(value):
            raise ConfigurationError(
                "UPLOAD_ALLOWED_MIME_TYPES contains an invalid MIME type."
            )

        normalized.append(value)

    if not normalized:
        raise ConfigurationError(
            "At least one upload MIME type must be configured."
        )

    return tuple(dict.fromkeys(normalized))


@dataclass(frozen=True, slots=True)
class Settings:
    """Immutable MedOrbits Python service settings."""

    # Application
    app_name: str = "MedOrbits"
    environment: str = "development"
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000
    api_prefix: str = "/api/v1"

    # Logging
    log_level: str = DEFAULT_LOG_LEVEL

    # CORS
    cors_allowed_origins: tuple[str, ...] = DEFAULT_ALLOWED_ORIGINS
    cors_allow_credentials: bool = False

    # Database
    database_engine: str = "postgresql"
    database_url: str = field(default="", repr=False)
    database_connect_timeout_seconds: int = 10
    database_pool_min_size: int = 1
    database_pool_max_size: int = 10

    # Redis / queues
    queue_enabled: bool = False
    redis_url: str = field(default="", repr=False)

    # Email
    email_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = field(default="", repr=False)
    smtp_password: str = field(default="", repr=False)
    email_from_address: str = ""
    email_from_name: str = "MedOrbits"

    # Payments
    payments_enabled: bool = False
    payment_mode: str = "test"
    payment_currency: str = "INR"

    # Private storage
    storage_driver: str = "local"
    storage_local_path: str = "storage/private"
    storage_temp_path: str = "storage/tmp"

    # Upload restrictions
    upload_max_file_size_mb: int = DEFAULT_MAX_UPLOAD_SIZE_MB
    upload_max_files: int = DEFAULT_MAX_UPLOAD_FILES
    upload_max_total_size_mb: int = DEFAULT_MAX_TOTAL_UPLOAD_SIZE_MB
    upload_allowed_mime_types: tuple[str, ...] = DEFAULT_UPLOAD_MIME_TYPES

    # AI integration
    ai_enabled: bool = False
    ai_api_url: str = ""
    ai_api_key: str = field(default="", repr=False)
    ai_model: str = ""

    @classmethod
    def from_environment(cls) -> "Settings":
        """Create and validate settings from environment variables."""
        environment = _get_string(
            "NODE_ENV",
            "development",
        ).lower()

        if environment not in SUPPORTED_ENVIRONMENTS:
            raise ConfigurationError(
                "NODE_ENV must be development, test, staging, or production."
            )

        is_production = environment == "production"

        debug = _get_bool("DEBUG", False)

        if is_production and debug:
            raise ConfigurationError("DEBUG must be disabled in production.")

        host = _get_string("HOST", "127.0.0.1")
        if not host or any(
            character.isspace() or ord(character) < 32
            for character in host
        ):
            raise ConfigurationError("HOST contains an invalid hostname or address.")

        api_prefix = _get_string("API_PREFIX", "/api/v1")

        if (
            not api_prefix.startswith("/")
            or api_prefix.startswith("//")
            or "?" in api_prefix
            or "#" in api_prefix
            or "\\" in api_prefix
            or "%" in api_prefix
            or any(
                segment in {".", ".."}
                for segment in api_prefix.split("/")
            )
            or any(ord(character) < 32 for character in api_prefix)
        ):
            raise ConfigurationError("API_PREFIX is invalid.")

        api_prefix = api_prefix.rstrip("/") or "/"

        log_level = _get_string("LOG_LEVEL", DEFAULT_LOG_LEVEL).upper()

        if log_level not in SUPPORTED_LOG_LEVELS:
            raise ConfigurationError(
                "LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR, or CRITICAL."
            )

        cors_origins = _validate_origins(
            _get_csv(
                "CORS_ALLOWED_ORIGINS",
                DEFAULT_ALLOWED_ORIGINS,
            )
        )
        cors_allow_credentials = _get_bool(
            "CORS_ALLOW_CREDENTIALS",
            False,
        )

        if cors_allow_credentials and not cors_origins:
            raise ConfigurationError(
                "Credentialed CORS requires explicitly configured origins."
            )

        database_engine = _get_string(
            "DB_ENGINE",
            "postgresql",
        ).lower()

        if database_engine not in DATABASE_ENGINES:
            raise ConfigurationError(
                "DB_ENGINE must be postgresql or mysql."
            )

        database_url = _get_string("DATABASE_URL", allow_empty=True)

        database_connect_timeout_seconds = _get_int(
            "DB_CONNECT_TIMEOUT_SECONDS",
            10,
            minimum=1,
            maximum=120,
        )
        database_pool_min_size = _get_int(
            "DB_POOL_MIN_SIZE",
            1,
            minimum=0,
            maximum=100,
        )
        database_pool_max_size = _get_int(
            "DB_POOL_MAX_SIZE",
            10,
            minimum=1,
            maximum=500,
        )

        if database_pool_min_size > database_pool_max_size:
            raise ConfigurationError(
                "DB_POOL_MIN_SIZE cannot exceed DB_POOL_MAX_SIZE."
            )

        queue_enabled = _get_bool("QUEUE_ENABLED", False)
        redis_url = _get_string("REDIS_URL", allow_empty=True)

        if queue_enabled and not redis_url:
            raise ConfigurationError(
                "REDIS_URL is required when QUEUE_ENABLED is true."
            )

        if redis_url:
            redis_schemes = frozenset({"redis", "rediss"})
            _validate_url(
                "REDIS_URL",
                redis_url,
                allowed_schemes=redis_schemes,
            )

        email_enabled = _get_bool("EMAIL_ENABLED", False)
        smtp_host = _get_string("SMTP_HOST")
        smtp_port = _get_int(
            "SMTP_PORT",
            587,
            minimum=1,
            maximum=65535,
        )
        smtp_username = _get_string("SMTP_USER", allow_empty=True)
        smtp_password = _get_string("SMTP_PASSWORD", allow_empty=True)
        email_from_address = _get_string("EMAIL_FROM_ADDRESS")
        email_from_name = _get_string("EMAIL_FROM_NAME", "MedOrbits")

        if email_enabled:
            required_email_values = {
                "SMTP_HOST": smtp_host,
                "EMAIL_FROM_ADDRESS": email_from_address,
            }

            missing_email_values = [
                name
                for name, value in required_email_values.items()
                if not value
            ]

            if missing_email_values:
                raise ConfigurationError(
                    "Email is enabled but required SMTP or sender settings are missing."
                )

            if bool(smtp_username) != bool(smtp_password):
                raise ConfigurationError(
                    "SMTP_USER and SMTP_PASSWORD must either both be set or both be empty."
                )

        payments_enabled = _get_bool("PAYMENTS_ENABLED", False)
        payment_mode = _get_string("PAYMENT_MODE", "test").lower()
        payment_currency = _get_string(
            "PAYMENT_CURRENCY",
            "INR",
        ).upper()

        if payment_mode not in {"test", "live"}:
            raise ConfigurationError(
                "PAYMENT_MODE must be test or live."
            )

        if not re.fullmatch(r"[A-Z]{3}", payment_currency):
            raise ConfigurationError(
                "PAYMENT_CURRENCY must be a three-letter currency code."
            )

        if payments_enabled and is_production and payment_mode != "live":
            raise ConfigurationError(
                "Production payments require PAYMENT_MODE=live."
            )

        if payments_enabled and not is_production and payment_mode == "live":
            raise ConfigurationError(
                "Live payments are not permitted outside production."
            )

        storage_driver = _get_string("STORAGE_DRIVER", "local").lower()

        if storage_driver not in {"local", "s3"}:
            raise ConfigurationError(
                "STORAGE_DRIVER must be local or s3."
            )

        storage_local_path = _get_string(
            "STORAGE_LOCAL_PATH",
            "storage/private",
        )
        storage_temp_path = _get_string(
            "STORAGE_TEMP_PATH",
            "storage/tmp",
        )

        upload_max_file_size_mb = _get_int(
            "UPLOAD_MAX_FILE_SIZE_MB",
            DEFAULT_MAX_UPLOAD_SIZE_MB,
            minimum=1,
            maximum=MAX_UPLOAD_SIZE_MB,
        )
        upload_max_files = _get_int(
            "UPLOAD_MAX_FILES",
            DEFAULT_MAX_UPLOAD_FILES,
            minimum=1,
            maximum=1000,
        )
        upload_max_total_size_mb = _get_int(
            "UPLOAD_MAX_TOTAL_SIZE_MB",
            DEFAULT_MAX_TOTAL_UPLOAD_SIZE_MB,
            minimum=1,
            maximum=MAX_UPLOAD_SIZE_MB,
        )

        if upload_max_file_size_mb > upload_max_total_size_mb:
            raise ConfigurationError(
                "UPLOAD_MAX_FILE_SIZE_MB cannot exceed UPLOAD_MAX_TOTAL_SIZE_MB."
            )

        upload_allowed_mime_types = _validate_mime_types(
            _get_csv(
                "UPLOAD_ALLOWED_MIME_TYPES",
                DEFAULT_UPLOAD_MIME_TYPES,
            )
        )

        ai_enabled = _get_bool("AI_ENABLED", False)
        ai_api_url = _get_string("AI_API_URL", allow_empty=True)
        ai_api_key = _get_string("AI_API_KEY", allow_empty=True)
        ai_model = _get_string("AI_MODEL", allow_empty=True)

        if ai_enabled:
            if not ai_api_url or not ai_model:
                raise ConfigurationError(
                    "AI_API_URL and AI_MODEL are required when AI_ENABLED is true."
                )

            _validate_url(
                "AI_API_URL",
                ai_api_url,
                allowed_schemes=(
                    frozenset({"https"})
                    if is_production
                    else frozenset({"http", "https"})
                ),
            )

            if is_production and not ai_api_key:
                raise ConfigurationError(
                    "AI_API_KEY is required when AI is enabled in production."
                )

        if is_production:
            # Require an explicitly configured HTTPS origin in production.
            if not cors_origins:
                raise ConfigurationError(
                    "Production requires at least one trusted CORS origin."
                )

            for origin in cors_origins:
                if not origin.startswith("https://"):
                    raise ConfigurationError(
                        "Production CORS origins must use HTTPS."
                    )

            if storage_driver == "local":
                # The storage module performs final filesystem boundary
                # and symlink checks when initializing local storage.
                if os.path.isabs(storage_local_path) is False:
                    # Relative paths are permitted, but deployments should
                    # confirm their resolved location is private.
                    pass

        return cls(
            environment=environment,
            debug=debug,
            host=host,
            port=_get_int("PORT", 8000, minimum=1, maximum=65535),
            api_prefix=api_prefix,
            log_level=log_level,
            cors_allowed_origins=cors_origins,
            cors_allow_credentials=cors_allow_credentials,
            database_engine=database_engine,
            database_url=database_url,
            database_connect_timeout_seconds=database_connect_timeout_seconds,
            database_pool_min_size=database_pool_min_size,
            database_pool_max_size=database_pool_max_size,
            queue_enabled=queue_enabled,
            redis_url=redis_url,
            email_enabled=email_enabled,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            smtp_username=smtp_username,
            smtp_password=smtp_password,
            email_from_address=email_from_address,
            email_from_name=email_from_name,
            payments_enabled=payments_enabled,
            payment_mode=payment_mode,
            payment_currency=payment_currency,
            storage_driver=storage_driver,
            storage_local_path=storage_local_path,
            storage_temp_path=storage_temp_path,
            upload_max_file_size_mb=upload_max_file_size_mb,
            upload_max_files=upload_max_files,
            upload_max_total_size_mb=upload_max_total_size_mb,
            upload_allowed_mime_types=upload_allowed_mime_types,
            ai_enabled=ai_enabled,
            ai_api_url=ai_api_url,
            ai_api_key=ai_api_key,
            ai_model=ai_model,
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return cached, validated application settings.

    Environment variables must be set before the first call. Tests that
    change environment variables should call get_settings.cache_clear()
    before retrieving settings again.
    """
    return Settings.from_environment()


__all__ = [
    "ConfigurationError",
    "Settings",
    "get_settings",
]

