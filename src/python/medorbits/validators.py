
"""
MedOrbits validation utilities.

File: src/python/medorbits/validators.py

Reusable validation primitives for education, admissions, applications,
recruitment, document uploads, and career services.

Security:
    - Validate types before operating on untrusted values.
    - Reject malformed input rather than silently coercing it.
    - Bound input sizes, collection sizes, and numeric ranges.
    - Never include submitted values in validation errors.
    - Keep validation independent of web frameworks and database drivers.

This module does not replace database constraints, authorization,
malware scanning, password hashing, or business-rule checks.
"""

from __future__ import annotations

import ipaddress
import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from enum import Enum
from typing import Any, Mapping, Sequence
from urllib.parse import urlsplit


__all__ = [
    "ValidationError",
    "ValidationIssue",
    "ValidationResult",
    "EmailValidation",
    "PasswordPolicy",
    "PhoneValidation",
    "Pagination",
    "validate_email",
    "validate_phone",
    "validate_password",
    "validate_url",
    "validate_identifier",
    "validate_name",
    "validate_text",
    "validate_integer",
    "validate_number",
    "validate_boolean",
    "validate_date",
    "validate_enum",
    "validate_mapping",
    "validate_required_fields",
    "validate_pagination",
    "validate_mime_type",
    "validate_file_size",
    "validate_application_payload",
    "validate_job_payload",
    "normalize_whitespace",
    "normalize_email",
    "sanitize_plain_text",
    "require_valid",
]


MAX_MAPPING_FIELDS = 200
MAX_COLLECTION_ITEMS = 100
MAX_IDENTIFIER_LENGTH = 128
MAX_URL_LENGTH = 2048
MAX_EMAIL_LENGTH = 254
MAX_TEXT_LENGTH = 20_000
MAX_INTEGER_DIGITS = 100
MAX_NUMERIC_LENGTH = 128
MAX_VALIDATION_DEPTH = 32


class ValidationError(ValueError):
    """Raised when input fails validation."""

    def __init__(
        self,
        message: str = "Input validation failed.",
        *,
        field_name: str | None = None,
        code: str = "invalid_input",
    ) -> None:
        if not isinstance(message, str):
            message = "Input validation failed."

        if field_name is not None and (
            not isinstance(field_name, str)
            or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", field_name)
        ):
            field_name = None

        if not isinstance(code, str) or not re.fullmatch(
            r"[a-z][a-z0-9_]{0,63}", code
        ):
            code = "invalid_input"

        super().__init__(message)
        self.field_name = field_name
        self.code = code

    def to_dict(self) -> dict[str, str]:
        """Return a sanitized, API-friendly error."""
        result = {
            "code": self.code,
            "message": str(self),
        }
        if self.field_name:
            result["field"] = self.field_name
        return result


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    """A single validation issue."""

    field: str
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "field": self.field,
            "code": self.code,
            "message": self.message,
        }


@dataclass(frozen=True, slots=True)
class ValidationResult:
    """Validation outcome containing issues but no submitted values."""

    valid: bool
    issues: tuple[ValidationIssue, ...] = field(default_factory=tuple)

    @classmethod
    def success(cls) -> "ValidationResult":
        return cls(valid=True)

    @classmethod
    def failure(
        cls,
        issues: Sequence[ValidationIssue],
    ) -> "ValidationResult":
        return cls(valid=False, issues=tuple(issues))

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "issues": [issue.to_dict() for issue in self.issues],
        }


@dataclass(frozen=True, slots=True)
class EmailValidation:
    normalized: str
    local_part: str
    domain: str


@dataclass(frozen=True, slots=True)
class PhoneValidation:
    normalized: str
    digits: str
    country_code: str | None = None


@dataclass(frozen=True, slots=True)
class PasswordPolicy:
    """Configurable password acceptance policy."""

    min_length: int = 12
    max_length: int = 128
    require_lowercase: bool = True
    require_uppercase: bool = True
    require_digit: bool = True
    require_symbol: bool = False
    reject_whitespace: bool = False
    reject_common_passwords: bool = True

    def __post_init__(self) -> None:
        if (
            isinstance(self.min_length, bool)
            or not isinstance(self.min_length, int)
            or not 1 <= self.min_length <= 4096
        ):
            raise ValueError("min_length must be between 1 and 4096.")

        if (
            isinstance(self.max_length, bool)
            or not isinstance(self.max_length, int)
            or not self.min_length <= self.max_length <= 4096
        ):
            raise ValueError(
                "max_length must be >= min_length and at most 4096."
            )

        for name in (
            "require_lowercase",
            "require_uppercase",
            "require_digit",
            "require_symbol",
            "reject_whitespace",
            "reject_common_passwords",
        ):
            if not isinstance(getattr(self, name), bool):
                raise ValueError(f"{name} must be a boolean.")


@dataclass(frozen=True, slots=True)
class Pagination:
    page: int
    page_size: int
    offset: int


_EMAIL_LOCAL_PATTERN = re.compile(
    r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$"
)
_DOMAIN_LABEL_PATTERN = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"
)
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_PHONE_ALLOWED_PATTERN = re.compile(r"^[+0-9().\-\s]+$")
_MIME_PATTERN = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*/"
    r"[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$"
)
_CONTROL_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_COMMON_PASSWORDS = frozenset({
    "123456789012",
    "password123",
    "password1234",
    "qwerty123456",
    "admin123456",
    "letmein12345",
    "welcome12345",
    "iloveyou1234",
})

_APPLICATION_ALLOWED_FIELDS = frozenset({
    "application_id", "full_name", "email", "phone", "course",
    "course_type", "qualification", "date_of_birth", "address",
    "city", "state", "country", "postal_code", "institution",
    "exam_name", "exam_score", "exam_rank", "graduation_year",
    "message", "consent",
})

_APPLICATION_REQUIRED_FIELDS = frozenset({
    "full_name", "email", "course",
})

_JOB_ALLOWED_FIELDS = frozenset({
    "job_id", "title", "description", "employment_type", "location",
    "department", "experience_min_years", "experience_max_years",
    "salary_min", "salary_max", "currency", "skills", "qualifications",
    "application_deadline", "is_remote", "status",
})

_JOB_REQUIRED_FIELDS = frozenset({
    "title", "description", "employment_type", "location",
})


def _field_error(
    message: str,
    field_name: str,
    code: str,
) -> ValidationError:
    return ValidationError(
        message,
        field_name=field_name,
        code=code,
    )


def normalize_whitespace(value: str) -> str:
    """Collapse whitespace and trim surrounding whitespace."""
    if not isinstance(value, str):
        raise ValidationError("Value must be a string.", code="invalid_type")
    return " ".join(value.split())


def validate_text(
    value: Any,
    *,
    field_name: str = "text",
    min_length: int = 1,
    max_length: int = 5_000,
    strip: bool = True,
    allow_empty: bool = False,
    allow_newlines: bool = True,
) -> str:
    """Validate text type, length, and control characters."""
    if not isinstance(value, str):
        raise _field_error("Value must be a string.", field_name, "invalid_type")

    if (
        isinstance(min_length, bool)
        or not isinstance(min_length, int)
        or isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or min_length < 0
        or max_length < min_length
        or max_length > MAX_TEXT_LENGTH
    ):
        raise ValueError("Invalid text length limits.")

    text = value.strip() if strip else value

    if len(text) > max_length:
        raise _field_error(
            f"Value must contain at most {max_length} characters.",
            field_name,
            "max_length",
        )

    if not allow_newlines and any(char in text for char in "\r\n\t"):
        raise _field_error(
            "Newlines and tabs are not allowed.",
            field_name,
            "invalid_whitespace",
        )

    if not text and not allow_empty:
        raise _field_error("This field is required.", field_name, "required")

    if len(text) < min_length and not (allow_empty and not text):
        raise _field_error(
            f"Value must contain at least {min_length} characters.",
            field_name,
            "min_length",
        )

    for char in text:
        category = unicodedata.category(char)
        if category == "Cc" and char not in "\n\r\t":
            raise _field_error(
                "Value contains unsupported control characters.",
                field_name,
                "control_character",
            )
        if category == "Cf":
            raise _field_error(
                "Value contains unsupported formatting characters.",
                field_name,
                "formatting_character",
            )

    return text


def sanitize_plain_text(
    value: str,
    *,
    max_length: int = 5_000,
    allow_newlines: bool = False,
    strip: bool = True,
) -> str:
    """Normalize plain text; this is not an HTML sanitizer."""
    text = validate_text(
        value,
        field_name="text",
        min_length=0,
        max_length=max_length,
        strip=strip,
        allow_empty=True,
        allow_newlines=allow_newlines,
    )

    if allow_newlines:
        # Preserve line breaks but reject tabs and other control characters.
        for char in text:
            if unicodedata.category(char) == "Cc" and char not in "\r\n":
                raise _field_error(
                    "Text contains unsupported control characters.",
                    "text",
                    "control_character",
                )
        return text

    return normalize_whitespace(text)


def validate_name(
    value: Any,
    *,
    field_name: str = "name",
    max_length: int = 150,
) -> str:
    """Validate a person's name while supporting international scripts."""
    name = validate_text(
        value,
        field_name=field_name,
        min_length=1,
        max_length=max_length,
        allow_newlines=False,
    )

    if not any(char.isalpha() for char in name):
        raise _field_error(
            "Name must contain at least one letter.",
            field_name,
            "invalid_name",
        )

    return name


def validate_email(
    value: Any,
    *,
    allow_internationalized: bool = False,
    max_length: int = MAX_EMAIL_LENGTH,
) -> EmailValidation:
    """Validate email syntax without claiming mailbox existence."""
    if not isinstance(value, str):
        raise _field_error("Email must be a string.", "email", "invalid_type")

    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or not 3 <= max_length <= MAX_EMAIL_LENGTH
    ):
        raise ValueError("max_length must be between 3 and 254.")

    email = value.strip()

    if (
        not email
        or len(email) > max_length
        or len(email.encode("utf-8")) > max_length
        or any(
            char.isspace() or unicodedata.category(char).startswith("C")
            for char in email
        )
        or email.count("@") != 1
    ):
        raise _field_error("Enter a valid email address.", "email", "invalid_email")

    local, domain = email.rsplit("@", 1)

    if (
        not local
        or not domain
        or len(local.encode("utf-8")) > 64
        or local.startswith(".")
        or local.endswith(".")
        or ".." in local
    ):
        raise _field_error("Enter a valid email address.", "email", "invalid_email")

    if not allow_internationalized and not _EMAIL_LOCAL_PATTERN.fullmatch(local):
        raise _field_error(
            "Email contains unsupported characters.",
            "email",
            "invalid_email",
        )

    try:
        ascii_domain = domain.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise _field_error(
            "Email domain is invalid.",
            "email",
            "invalid_email",
        ) from exc

    if len(ascii_domain) > 253 or "." not in ascii_domain:
        raise _field_error("Email domain is invalid.", "email", "invalid_email")

    labels = ascii_domain.split(".")
    if any(
        not label
        or len(label) > 63
        or not _DOMAIN_LABEL_PATTERN.fullmatch(label)
        for label in labels
    ):
        raise _field_error("Email domain is invalid.", "email", "invalid_email")

    # Preserve local-part casing. Case-insensitive account matching is a
    # separate application policy and should be applied consistently.
    return EmailValidation(
        normalized=f"{local}@{ascii_domain}",
        local_part=local,
        domain=ascii_domain,
    )


def normalize_email(value: str) -> str:
    """Normalize the domain while preserving the local part."""
    return validate_email(value).normalized


def validate_phone(
    value: Any,
    *,
    min_digits: int = 7,
    max_digits: int = 15,
    require_plus: bool = False,
) -> PhoneValidation:
    """Validate basic phone syntax, not a country-specific numbering plan."""
    if not isinstance(value, str):
        raise _field_error(
            "Phone number must be a string.",
            "phone",
            "invalid_type",
        )

    if (
        isinstance(min_digits, bool)
        or not isinstance(min_digits, int)
        or isinstance(max_digits, bool)
        or not isinstance(max_digits, int)
        or min_digits < 1
        or max_digits < min_digits
        or max_digits > 15
    ):
        raise ValueError("Invalid phone digit limits.")

    phone = value.strip()

    if not phone or len(phone) > 64 or not _PHONE_ALLOWED_PATTERN.fullmatch(phone):
        raise _field_error(
            "Phone number contains unsupported characters.",
            "phone",
            "invalid_phone",
        )

    if phone.count("+") > 1 or ("+" in phone and not phone.startswith("+")):
        raise _field_error(
            "The plus sign may appear only at the beginning.",
            "phone",
            "invalid_phone",
        )

    digits = "".join(char for char in phone if char.isdigit())

    if not min_digits <= len(digits) <= max_digits:
        raise _field_error(
            f"Phone number must contain {min_digits}–{max_digits} digits.",
            "phone",
            "invalid_phone_length",
        )

    if require_plus and not phone.startswith("+"):
        raise _field_error(
            "Include the international dialing prefix.",
            "phone",
            "country_code_required",
        )

    return PhoneValidation(
        normalized=f"+{digits}" if phone.startswith("+") else digits,
        digits=digits,
    )


def validate_password(
    value: Any,
    *,
    policy: PasswordPolicy | None = None,
) -> str:
    """Validate a password without modifying it or exposing its value."""
    if not isinstance(value, str):
        raise _field_error(
            "Password must be a string.",
            "password",
            "invalid_type",
        )

    rules = policy or PasswordPolicy()

    if not rules.min_length <= len(value) <= rules.max_length:
        raise _field_error(
            f"Password must be {rules.min_length}–{rules.max_length} characters long.",
            "password",
            "invalid_password_length",
        )

    if rules.reject_whitespace and any(char.isspace() for char in value):
        raise _field_error(
            "Password must not contain whitespace.",
            "password",
            "password_whitespace",
        )

    checks = (
        (rules.require_lowercase, any(char.islower() for char in value), "lowercase"),
        (rules.require_uppercase, any(char.isupper() for char in value), "uppercase"),
        (rules.require_digit, any(char.isdigit() for char in value), "digit"),
        (
            rules.require_symbol,
            any(not char.isalnum() and not char.isspace() for char in value),
            "symbol",
        ),
    )

    for required, satisfied, label in checks:
        if required and not satisfied:
            raise _field_error(
                f"Password must contain a {label}.",
                "password",
                f"password_{label}",
            )

    if rules.reject_common_passwords and value.casefold() in _COMMON_PASSWORDS:
        raise _field_error(
            "Choose a less common password.",
            "password",
            "common_password",
        )

    return value


def validate_identifier(
    value: Any,
    *,
    field_name: str = "identifier",
    min_length: int = 1,
    max_length: int = MAX_IDENTIFIER_LENGTH,
    allow_colon: bool = True,
) -> str:
    """Validate a compact identifier, not a filesystem path."""
    if not isinstance(value, str):
        raise _field_error(
            "Identifier must be a string.",
            field_name,
            "invalid_type",
        )

    if (
        isinstance(min_length, bool)
        or not isinstance(min_length, int)
        or isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or min_length < 1
        or max_length < min_length
        or max_length > MAX_IDENTIFIER_LENGTH
    ):
        raise ValueError("Invalid identifier length limits.")

    identifier = value.strip()
    pattern = (
        _IDENTIFIER_PATTERN
        if allow_colon
        else re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    )

    if (
        not min_length <= len(identifier) <= max_length
        or not pattern.fullmatch(identifier)
        or ".." in identifier
        or identifier.endswith(".")
    ):
        raise _field_error(
            "Identifier contains unsupported characters or length.",
            field_name,
            "invalid_identifier",
        )

    return identifier


def validate_integer(
    value: Any,
    *,
    field_name: str = "value",
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """Validate an integer without accepting booleans or decimal strings."""
    if isinstance(value, bool):
        raise _field_error("Value must be an integer.", field_name, "invalid_type")

    if isinstance(value, int):
        number = value
    elif isinstance(value, str):
        candidate = value.strip()
        if len(candidate.lstrip("-")) > MAX_INTEGER_DIGITS or not re.fullmatch(
            r"-?\d+", candidate
        ):
            raise _field_error(
                "Value must be an integer.",
                field_name,
                "invalid_integer",
            )
        try:
            number = int(candidate)
        except ValueError as exc:
            raise _field_error(
                "Value must be an integer.",
                field_name,
                "invalid_integer",
            ) from exc
    else:
        raise _field_error("Value must be an integer.", field_name, "invalid_integer")

    if minimum is not None and number < minimum:
        raise _field_error(
            f"Value must be at least {minimum}.",
            field_name,
            "below_minimum",
        )

    if maximum is not None and number > maximum:
        raise _field_error(
            f"Value must be at most {maximum}.",
            field_name,
            "above_maximum",
        )

    return number


def validate_number(
    value: Any,
    *,
    field_name: str = "value",
    minimum: float | Decimal | None = None,
    maximum: float | Decimal | None = None,
    decimal_places: int | None = None,
) -> Decimal:
    """Validate a finite number and return Decimal for predictable precision."""
    if isinstance(value, bool) or value is None:
        raise _field_error("Value must be numeric.", field_name, "invalid_number")

    if isinstance(value, float) and not math.isfinite(value):
        raise _field_error(
            "Value must be finite.",
            field_name,
            "non_finite_number",
        )

    if not isinstance(value, (str, int, float, Decimal)):
        raise _field_error("Value must be numeric.", field_name, "invalid_number")

    raw = str(value).strip()

    if len(raw) > MAX_NUMERIC_LENGTH:
        raise _field_error(
            "Numeric value is too long.",
            field_name,
            "invalid_number",
        )

    try:
        number = Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise _field_error(
            "Value must be numeric.",
            field_name,
            "invalid_number",
        ) from exc

    if not number.is_finite():
        raise _field_error(
            "Value must be finite.",
            field_name,
            "non_finite_number",
        )

    if minimum is not None and number < Decimal(str(minimum)):
        raise _field_error(
            f"Value must be at least {minimum}.",
            field_name,
            "below_minimum",
        )

    if maximum is not None and number > Decimal(str(maximum)):
        raise _field_error(
            f"Value must be at most {maximum}.",
            field_name,
            "above_maximum",
        )

    if decimal_places is not None:
        if (
            isinstance(decimal_places, bool)
            or not isinstance(decimal_places, int)
            or decimal_places < 0
            or decimal_places > 100
        ):
            raise ValueError("decimal_places must be between 0 and 100.")

        if max(0, -number.as_tuple().exponent) > decimal_places:
            raise _field_error(
                f"Value may have at most {decimal_places} decimal places.",
                field_name,
                "decimal_places",
            )

    return number


def validate_boolean(value: Any, *, field_name: str = "value") -> bool:
    """Accept only an actual boolean."""
    if not isinstance(value, bool):
        raise _field_error("Value must be a boolean.", field_name, "invalid_boolean")
    return value


def validate_date(
    value: Any,
    *,
    field_name: str = "date",
    allow_datetime: bool = False,
) -> date:
    """Validate a date object or strict ISO YYYY-MM-DD string."""
    if isinstance(value, datetime):
        if not allow_datetime:
            raise _field_error(
                "A date is required, not a datetime.",
                field_name,
                "invalid_date",
            )
        return value.date()

    if isinstance(value, date):
        return value

    if not isinstance(value, str):
        raise _field_error(
            "Date must be an ISO YYYY-MM-DD string.",
            field_name,
            "invalid_date",
        )

    candidate = value.strip()

    try:
        parsed = date.fromisoformat(candidate)
    except ValueError as exc:
        raise _field_error(
            "Date must use YYYY-MM-DD format.",
            field_name,
            "invalid_date",
        ) from exc

    if parsed.isoformat() != candidate:
        raise _field_error(
            "Date must use YYYY-MM-DD format.",
            field_name,
            "invalid_date",
        )

    return parsed


def validate_enum(
    value: Any,
    allowed_values: Sequence[str] | type[Enum],
    *,
    field_name: str = "value",
    case_sensitive: bool = False,
) -> str:
    """Validate a string against allowed values or an Enum."""
    if isinstance(allowed_values, type) and issubclass(allowed_values, Enum):
        allowed = [item.value for item in allowed_values]
    else:
        if isinstance(allowed_values, (str, bytes)):
            raise ValueError("allowed_values must be a sequence of strings.")
        allowed = list(allowed_values)

    if (
        not allowed
        or len(allowed) > MAX_COLLECTION_ITEMS
        or any(not isinstance(item, str) for item in allowed)
    ):
        raise ValueError("allowed_values must contain 1–100 strings.")

    if not isinstance(value, str):
        raise _field_error("Value must be a string.", field_name, "invalid_type")

    candidate = value.strip()

    if case_sensitive:
        if candidate in allowed:
            return candidate
    else:
        lookup = {item.casefold(): item for item in allowed}
        matched = lookup.get(candidate.casefold())
        if matched is not None:
            return matched

    raise _field_error(
        "Value is not an allowed option.",
        field_name,
        "invalid_choice",
    )


def validate_url(
    value: Any,
    *,
    field_name: str = "url",
    allowed_schemes: Sequence[str] = ("https",),
    allow_localhost: bool = False,
    allow_ip_address: bool = False,
    max_length: int = MAX_URL_LENGTH,
) -> str:
    """
    Validate an absolute URL.

    This does not prevent SSRF. Server-side fetchers must additionally enforce
    destination allowlists, resolve and block non-public IPs, and revalidate
    every redirect.
    """
    if not isinstance(value, str):
        raise _field_error("URL must be a string.", field_name, "invalid_type")

    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or not 1 <= max_length <= MAX_URL_LENGTH
    ):
        raise ValueError("max_length must be between 1 and 2048.")

    url = value.strip()

    if (
        not url
        or len(url) > max_length
        or "\\" in url
        or any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in url)
    ):
        raise _field_error("URL is malformed.", field_name, "invalid_url")

    if isinstance(allowed_schemes, (str, bytes)):
        raise ValueError("allowed_schemes must be a sequence of strings.")

    schemes = {
        scheme.lower()
        for scheme in allowed_schemes
        if isinstance(scheme, str)
    }

    if not schemes or any(
        not re.fullmatch(r"[a-z][a-z0-9+.-]*", scheme)
        for scheme in schemes
    ):
        raise ValueError("allowed_schemes contains an invalid scheme.")

    try:
        parts = urlsplit(url)
        port = parts.port
        hostname = parts.hostname
    except ValueError as exc:
        raise _field_error("URL is malformed.", field_name, "invalid_url") from exc

    if parts.scheme.lower() not in schemes:
        raise _field_error(
            "URL scheme is not permitted.",
            field_name,
            "invalid_url_scheme",
        )

    if not parts.netloc or not hostname:
        raise _field_error("URL must include a hostname.", field_name, "invalid_url")

    if parts.username is not None or parts.password is not None:
        raise _field_error(
            "URLs containing embedded credentials are not allowed.",
            field_name,
            "url_credentials",
        )

    if parts.fragment:
        raise _field_error(
            "URL fragments are not allowed.",
            field_name,
            "url_fragment",
        )

    if port is not None and not 1 <= port <= 65535:
        raise _field_error("URL port is invalid.", field_name, "invalid_port")

    normalized_host = hostname.rstrip(".").lower()

    if (
        normalized_host == "localhost"
        or normalized_host.endswith(".localhost")
    ) and not allow_localhost:
        raise _field_error(
            "Localhost URLs are not allowed.",
            field_name,
            "local_hostname",
        )

    try:
        address = ipaddress.ip_address(normalized_host)
    except ValueError:
        address = None

    if address is not None:
        if not allow_ip_address:
            raise _field_error(
                "IP-address URLs are not allowed.",
                field_name,
                "ip_address_not_allowed",
            )
        if not address.is_global:
            raise _field_error(
                "Non-public IP addresses are not allowed.",
                field_name,
                "non_public_ip",
            )
    else:
        try:
            ascii_host = normalized_host.encode("idna").decode("ascii")
        except UnicodeError as exc:
            raise _field_error(
                "URL hostname is invalid.",
                field_name,
                "invalid_hostname",
            ) from exc

        if (
            not ascii_host
            or len(ascii_host) > 253
            or any(
                not label
                or len(label) > 63
                or not _DOMAIN_LABEL_PATTERN.fullmatch(label)
                for label in ascii_host.split(".")
            )
        ):
            raise _field_error(
                "URL hostname is invalid.",
                field_name,
                "invalid_hostname",
            )

    return url


def validate_mapping(
    value: Any,
    *,
    field_name: str = "payload",
    allowed_fields: set[str] | frozenset[str] | None = None,
    required_fields: set[str] | frozenset[str] | None = None,
    reject_unknown_fields: bool = True,
) -> dict[str, Any]:
    """Validate a mapping and enforce field-count and key constraints."""
    if not isinstance(value, Mapping):
        raise _field_error(
            "Payload must be a JSON object.",
            field_name,
            "invalid_type",
        )

    if len(value) > MAX_MAPPING_FIELDS:
        raise _field_error(
            "Payload contains too many fields.",
            field_name,
            "too_many_fields",
        )

    payload = dict(value)

    if any(
        not isinstance(key, str)
        or not key
        or len(key) > 100
        or _CONTROL_PATTERN.search(key)
        for key in payload
    ):
        raise _field_error(
            "Object field names are invalid.",
            field_name,
            "invalid_field_name",
        )

    if allowed_fields is not None:
        if any(not isinstance(key, str) for key in allowed_fields):
            raise ValueError("allowed_fields must contain strings.")
        if reject_unknown_fields and set(payload) - set(allowed_fields):
            raise _field_error(
                "Payload contains unsupported fields.",
                field_name,
                "unknown_fields",
            )

    if required_fields:
        if any(not isinstance(key, str) for key in required_fields):
            raise ValueError("required_fields must contain strings.")
        if set(required_fields) - set(payload):
            raise _field_error(
                "Payload is missing required fields.",
                field_name,
                "missing_fields",
            )

    return payload


def validate_required_fields(
    payload: Mapping[str, Any],
    required_fields: Sequence[str],
    *,
    allow_blank_strings: bool = False,
) -> None:
    """Ensure required fields exist and are not missing or blank."""
    if not isinstance(payload, Mapping):
        raise ValidationError("Payload must be an object.", code="invalid_type")

    for field_name in required_fields:
        if field_name not in payload or payload[field_name] is None:
            raise _field_error(
                "A required field is missing.",
                field_name,
                "required",
            )

        value = payload[field_name]
        if (
            not allow_blank_strings
            and isinstance(value, str)
            and not value.strip()
        ):
            raise _field_error(
                "A required field cannot be blank.",
                field_name,
                "required",
            )


def validate_pagination(
    *,
    page: Any = 1,
    page_size: Any = 20,
    max_page_size: int = 100,
) -> Pagination:
    """Validate pagination and reject offsets beyond signed 64-bit range."""
    if (
        isinstance(max_page_size, bool)
        or not isinstance(max_page_size, int)
        or not 1 <= max_page_size <= 100_000
    ):
        raise ValueError("max_page_size must be between 1 and 100000.")

    normalized_page = validate_integer(page, field_name="page", minimum=1)
    normalized_size = validate_integer(
        page_size,
        field_name="page_size",
        minimum=1,
        maximum=max_page_size,
    )

    offset = (normalized_page - 1) * normalized_size
    if offset > 9_223_372_036_854_775_807:
        raise _field_error("Page offset is too large.", "page", "offset_too_large")

    return Pagination(
        page=normalized_page,
        page_size=normalized_size,
        offset=offset,
    )


def validate_mime_type(
    value: Any,
    *,
    allowed_types: Sequence[str],
    field_name: str = "mime_type",
) -> str:
    """Validate a declared MIME type against an explicit allowlist."""
    if not isinstance(value, str):
        raise _field_error(
            "MIME type must be a string.",
            field_name,
            "invalid_type",
        )

    mime = value.strip().lower()
    if not _MIME_PATTERN.fullmatch(mime):
        raise _field_error(
            "MIME type is malformed.",
            field_name,
            "invalid_mime_type",
        )

    if isinstance(allowed_types, (str, bytes)):
        raise ValueError("allowed_types must be a sequence of MIME types.")

    if len(allowed_types) > MAX_COLLECTION_ITEMS:
        raise ValueError("allowed_types contains too many entries.")

    normalized: set[str] = set()
    for item in allowed_types:
        if not isinstance(item, str):
            raise ValueError("allowed_types must contain strings.")
        candidate = item.strip().lower()
        if not _MIME_PATTERN.fullmatch(candidate):
            raise ValueError("allowed_types contains an invalid MIME type.")
        normalized.add(candidate)

    if mime not in normalized:
        raise _field_error(
            "Uploaded file type is not permitted.",
            field_name,
            "mime_type_not_allowed",
        )

    return mime


def validate_file_size(
    value: Any,
    *,
    max_bytes: int,
    min_bytes: int = 1,
    field_name: str = "file_size",
) -> int:
    """Validate an upload size expressed in bytes."""
    if (
        isinstance(max_bytes, bool)
        or not isinstance(max_bytes, int)
        or isinstance(min_bytes, bool)
        or not isinstance(min_bytes, int)
        or min_bytes < 0
        or max_bytes < min_bytes
    ):
        raise ValueError("Invalid file-size limits.")

    return validate_integer(
        value,
        field_name=field_name,
        minimum=min_bytes,
        maximum=max_bytes,
    )


def _validate_payload_values(
    value: Any,
    *,
    field_name: str,
    depth: int = 0,
) -> None:
    """Bound nested data structures and reject unsupported value types."""
    if depth > MAX_VALIDATION_DEPTH:
        raise _field_error(
            "Payload nesting is too deep.",
            field_name,
            "maximum_depth",
        )

    if isinstance(value, Mapping):
        if len(value) > MAX_MAPPING_FIELDS:
            raise _field_error(
                "Object contains too many fields.",
                field_name,
                "too_many_fields",
            )
        for key, child in value.items():
            if not isinstance(key, str) or len(key) > 100:
                raise _field_error(
                    "Object field names are invalid.",
                    field_name,
                    "invalid_field_name",
                )
            _validate_payload_values(
                child,
                field_name=field_name,
                depth=depth + 1,
            )
        return

    if isinstance(value, (list, tuple)):
        if len(value) > MAX_COLLECTION_ITEMS:
            raise _field_error(
                "List contains too many items.",
                field_name,
                "too_many_items",
            )
        for child in value:
            _validate_payload_values(
                child,
                field_name=field_name,
                depth=depth + 1,
            )
        return

    if isinstance(value, str):
        if len(value) > MAX_TEXT_LENGTH:
            raise _field_error(
                "A payload value is too long.",
                field_name,
                "max_length",
            )
        if _CONTROL_PATTERN.search(value):
            raise _field_error(
                "Payload contains control characters.",
                field_name,
                "control_character",
            )
        return

    if value is None or isinstance(value, (bool, int, float, Decimal, date)):
        if isinstance(value, float) and not math.isfinite(value):
            raise _field_error(
                "Payload contains a non-finite number.",
                field_name,
                "non_finite_number",
            )
        if isinstance(value, Decimal) and not value.is_finite():
            raise _field_error(
                "Payload contains a non-finite number.",
                field_name,
                "non_finite_number",
            )
        return

    raise _field_error(
        "Payload contains an unsupported value type.",
        field_name,
        "invalid_type",
    )


def validate_application_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    """Validate application payload shape and common field types."""
    required = (
        _APPLICATION_REQUIRED_FIELDS
        if required_fields is None
        else required_fields
    )

    data = validate_mapping(
        payload,
        field_name="application",
        allowed_fields=_APPLICATION_ALLOWED_FIELDS,
        required_fields=required,
        reject_unknown_fields=reject_unknown_fields,
    )
    _validate_payload_values(data, field_name="application")

    if "full_name" in data:
        data["full_name"] = validate_name(
            data["full_name"],
            field_name="full_name",
        )

    if "email" in data:
        data["email"] = normalize_email(data["email"])

    if data.get("phone") not in (None, ""):
        data["phone"] = validate_phone(data["phone"]).normalized

    for name in (
        "course", "course_type", "qualification", "institution",
        "exam_name", "city", "state", "country", "postal_code",
    ):
        if data.get(name) is not None:
            data[name] = validate_text(
                data[name],
                field_name=name,
                max_length=250,
                allow_newlines=False,
            )

    if data.get("address") is not None:
        data["address"] = sanitize_plain_text(
            data["address"],
            max_length=500,
            allow_newlines=True,
        )

    if data.get("message") is not None:
        data["message"] = sanitize_plain_text(
            data["message"],
            max_length=5_000,
            allow_newlines=True,
        )

    if data.get("date_of_birth") not in (None, ""):
        data["date_of_birth"] = validate_date(
            data["date_of_birth"],
            field_name="date_of_birth",
        ).isoformat()

    if data.get("graduation_year") not in (None, ""):
        data["graduation_year"] = validate_integer(
            data["graduation_year"],
            field_name="graduation_year",
            minimum=1900,
            maximum=date.today().year + 10,
        )

    if data.get("exam_score") not in (None, ""):
        data["exam_score"] = validate_number(
            data["exam_score"],
            field_name="exam_score",
            minimum=0,
            decimal_places=4,
        )

    if data.get("exam_rank") not in (None, ""):
        data["exam_rank"] = validate_integer(
            data["exam_rank"],
            field_name="exam_rank",
            minimum=1,
        )

    if "consent" in data:
        data["consent"] = validate_boolean(
            data["consent"],
            field_name="consent",
        )

    if data.get("application_id") is not None:
        data["application_id"] = validate_identifier(
            data["application_id"],
            field_name="application_id",
        )

    return data


def validate_job_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    """Validate a job posting's structure and common field constraints."""
    required = (
        _JOB_REQUIRED_FIELDS
        if required_fields is None
        else required_fields
    )

    data = validate_mapping(
        payload,
        field_name="job",
        allowed_fields=_JOB_ALLOWED_FIELDS,
        required_fields=required,
        reject_unknown_fields=reject_unknown_fields,
    )
    _validate_payload_values(data, field_name="job")

    if "title" in data:
        data["title"] = validate_text(
            data["title"],
            field_name="title",
            max_length=200,
            allow_newlines=False,
        )

    if "description" in data:
        data["description"] = sanitize_plain_text(
            data["description"],
            max_length=20_000,
            allow_newlines=True,
        )

    if "employment_type" in data:
        data["employment_type"] = validate_enum(
            data["employment_type"],
            (
                "full_time", "part_time", "contract",
                "internship", "temporary", "freelance",
            ),
            field_name="employment_type",
        )

    if "location" in data:
        data["location"] = validate_text(
            data["location"],
            field_name="location",
            max_length=250,
            allow_newlines=False,
        )

    for name in ("department", "currency"):
        if data.get(name) is not None:
            data[name] = validate_text(
                data[name],
                field_name=name,
                max_length=100,
                allow_newlines=False,
            )

    for name in ("experience_min_years", "experience_max_years"):
        if data.get(name) is not None:
            data[name] = validate_number(
                data[name],
                field_name=name,
                minimum=0,
                maximum=80,
                decimal_places=1,
            )

    minimum_experience = data.get("experience_min_years")
    maximum_experience = data.get("experience_max_years")
    if (
        minimum_experience is not None
        and maximum_experience is not None
        and minimum_experience > maximum_experience
    ):
        raise _field_error(
            "Minimum experience cannot exceed maximum experience.",
            "experience_min_years",
            "invalid_experience_range",
        )

    for name in ("salary_min", "salary_max"):
        if data.get(name) is not None:
            data[name] = validate_number(
                data[name],
                field_name=name,
                minimum=0,
                decimal_places=2,
            )

    minimum_salary = data.get("salary_min")
    maximum_salary = data.get("salary_max")
    if (
        minimum_salary is not None
        and maximum_salary is not None
        and minimum_salary > maximum_salary
    ):
        raise _field_error(
            "Minimum salary cannot exceed maximum salary.",
            "salary_min",
            "invalid_salary_range",
        )

    for name in ("skills", "qualifications"):
        if name in data:
            items = data[name]
            if not isinstance(items, list):
                raise _field_error(
                    "Value must be a list of strings.",
                    name,
                    "invalid_type",
                )
            if len(items) > MAX_COLLECTION_ITEMS:
                raise _field_error(
                    "List contains too many items.",
                    name,
                    "too_many_items",
                )
            data[name] = [
                validate_text(
                    item,
                    field_name=name,
                    max_length=200,
                    allow_newlines=False,
                )
                for item in items
            ]

    if data.get("application_deadline") not in (None, ""):
        data["application_deadline"] = validate_date(
            data["application_deadline"],
            field_name="application_deadline",
        ).isoformat()

    if "is_remote" in data:
        data["is_remote"] = validate_boolean(
            data["is_remote"],
            field_name="is_remote",
        )

    if "status" in data:
        data["status"] = validate_enum(
            data["status"],
            ("draft", "open", "paused", "closed", "archived"),
            field_name="status",
        )

    if data.get("job_id") is not None:
        data["job_id"] = validate_identifier(
            data["job_id"],
            field_name="job_id",
        )

    return data


def require_valid(
    condition: Any,
    message: str,
    *,
    field_name: str | None = None,
    code: str = "invalid_input",
) -> None:
    """Raise ValidationError when a validation condition is false."""
    if not condition:
        raise ValidationError(
            message,
            field_name=field_name,
            code=code,
        )
