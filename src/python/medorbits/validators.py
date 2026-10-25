
"""
MedOrbits validation utilities.

File: src/python/medorbits/validators.py

Reusable validation primitives for education, admissions, applications,
recruitment, document uploads, and career services.

Security principles:
- Validate types before operating on user-controlled values.
- Reject malformed input instead of silently coercing it.
- Normalize only where explicitly intended.
- Never log submitted personal data or credential values.
- Keep validation independent of web frameworks and database drivers.

This module does not replace database constraints, authorization, malware
scanning, password hashing, or business-rule checks.
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


# ---------------------------------------------------------------------------
# Exceptions and result models
# ---------------------------------------------------------------------------

class ValidationError(ValueError):
    """Raised when input fails validation."""

    def __init__(
        self,
        message: str = "Input validation failed.",
        *,
        field_name: str | None = None,
        code: str = "invalid_input",
    ) -> None:
        super().__init__(message)
        self.field_name = field_name
        self.code = code

    def to_dict(self) -> dict[str, str]:
        """Return an API-friendly error without submitted values."""
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
            or self.min_length < 1
        ):
            raise ValueError("min_length must be a positive integer.")

        if (
            isinstance(self.max_length, bool)
            or not isinstance(self.max_length, int)
            or self.max_length < self.min_length
        ):
            raise ValueError("max_length must be an integer >= min_length.")

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


# ---------------------------------------------------------------------------
# Constants and patterns
# ---------------------------------------------------------------------------

_EMAIL_LOCAL_PATTERN = re.compile(
    r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$"
)
_DOMAIN_LABEL_PATTERN = re.compile(
    r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"
)
_IDENTIFIER_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"
)
_PHONE_ALLOWED_PATTERN = re.compile(r"^[+0-9().\-\s]+$")
_MIME_PATTERN = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*/"
    r"[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$"
)

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
    "application_id",
    "full_name",
    "email",
    "phone",
    "course",
    "course_type",
    "qualification",
    "date_of_birth",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "institution",
    "exam_name",
    "exam_score",
    "exam_rank",
    "graduation_year",
    "message",
    "consent",
})

_APPLICATION_REQUIRED_FIELDS = frozenset({
    "full_name",
    "email",
    "course",
})

_JOB_ALLOWED_FIELDS = frozenset({
    "job_id",
    "title",
    "description",
    "employment_type",
    "location",
    "department",
    "experience_min_years",
    "experience_max_years",
    "salary_min",
    "salary_max",
    "currency",
    "skills",
    "qualifications",
    "application_deadline",
    "is_remote",
    "status",
})

_JOB_REQUIRED_FIELDS = frozenset({
    "title",
    "description",
    "employment_type",
    "location",
})


# ---------------------------------------------------------------------------
# Normalization and text
# ---------------------------------------------------------------------------

def normalize_whitespace(value: str) -> str:
    """Collapse consecutive whitespace and trim surrounding whitespace."""
    if not isinstance(value, str):
        raise ValidationError(
            "Value must be a string.",
            code="invalid_type",
        )
    return " ".join(value.split())


def sanitize_plain_text(
    value: str,
    *,
    max_length: int = 5_000,
    allow_newlines: bool = False,
    strip: bool = True,
) -> str:
    """
    Validate plain text and reject control/formatting characters.

    This is not an HTML sanitizer. Escape untrusted content at the output
    boundary and use parameterized queries for database operations.
    """
    text = validate_text(
        value,
        field_name="text",
        min_length=0,
        max_length=max_length,
        strip=strip,
        allow_empty=True,
        allow_newlines=allow_newlines,
    )

    result: list[str] = []

    for char in text:
        category = unicodedata.category(char)

        if category == "Cc":
            if allow_newlines and char in "\n\r\t":
                result.append(char)
                continue

            raise ValidationError(
                "Text contains unsupported control characters.",
                field_name="text",
                code="control_character",
            )

        if category == "Cf":
            raise ValidationError(
                "Text contains unsupported formatting characters.",
                field_name="text",
                code="formatting_character",
            )

        result.append(char)

    cleaned = "".join(result)

    if not allow_newlines:
        cleaned = normalize_whitespace(cleaned)

    if len(cleaned) > max_length:
        raise ValidationError(
            f"Text must be at most {max_length} characters.",
            field_name="text",
            code="max_length",
        )

    return cleaned


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
        raise ValidationError(
            "Value must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    if (
        isinstance(min_length, bool)
        or not isinstance(min_length, int)
        or min_length < 0
        or isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or max_length < min_length
    ):
        raise ValueError("Invalid text length limits.")

    text = value.strip() if strip else value

    if not allow_newlines and any(char in text for char in "\r\n\t"):
        raise ValidationError(
            "Newlines and tabs are not allowed.",
            field_name=field_name,
            code="invalid_whitespace",
        )

    if not allow_empty and not text:
        raise ValidationError(
            "This field is required.",
            field_name=field_name,
            code="required",
        )

    if len(text) < min_length and not (allow_empty and not text):
        raise ValidationError(
            f"Value must contain at least {min_length} characters.",
            field_name=field_name,
            code="min_length",
        )

    if len(text) > max_length:
        raise ValidationError(
            f"Value must contain at most {max_length} characters.",
            field_name=field_name,
            code="max_length",
        )

    if any(
        unicodedata.category(char) == "Cc"
        and char not in "\n\r\t"
        for char in text
    ):
        raise ValidationError(
            "Value contains unsupported control characters.",
            field_name=field_name,
            code="control_character",
        )

    return text


def validate_name(
    value: Any,
    *,
    field_name: str = "name",
    max_length: int = 150,
) -> str:
    """Validate a person's name without restricting legitimate scripts."""
    name = validate_text(
        value,
        field_name=field_name,
        min_length=1,
        max_length=max_length,
        allow_newlines=False,
    )

    if not any(char.isalpha() for char in name):
        raise ValidationError(
            "Name must contain at least one letter.",
            field_name=field_name,
            code="invalid_name",
        )

    if any(unicodedata.category(char) == "Cf" for char in name):
        raise ValidationError(
            "Name contains unsupported formatting characters.",
            field_name=field_name,
            code="invalid_name",
        )

    return name


# ---------------------------------------------------------------------------
# Email and phone
# ---------------------------------------------------------------------------

def validate_email(
    value: Any,
    *,
    allow_internationalized: bool = False,
    max_length: int = 254,
) -> EmailValidation:
    """Validate basic email syntax; this does not verify mailbox existence."""
    if not isinstance(value, str):
        raise ValidationError(
            "Email must be a string.",
            field_name="email",
            code="invalid_type",
        )

    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or max_length < 3
    ):
        raise ValueError("max_length must be an integer of at least 3.")

    email = value.strip()

    if not email or len(email) > max_length:
        raise ValidationError(
            "Email is required and must be within the allowed length.",
            field_name="email",
            code="invalid_email",
        )

    if any(char.isspace() or unicodedata.category(char).startswith("C")
           for char in email):
        raise ValidationError(
            "Email must not contain whitespace or control characters.",
            field_name="email",
            code="invalid_email",
        )

    if email.count("@") != 1:
        raise ValidationError(
            "Enter a valid email address.",
            field_name="email",
            code="invalid_email",
        )

    local, domain = email.rsplit("@", 1)

    if (
        not local
        or not domain
        or len(local.encode("utf-8")) > 64
        or local.startswith(".")
        or local.endswith(".")
        or ".." in local
    ):
        raise ValidationError(
            "Enter a valid email address.",
            field_name="email",
            code="invalid_email",
        )

    if not allow_internationalized:
        if not _EMAIL_LOCAL_PATTERN.fullmatch(local):
            raise ValidationError(
                "Email contains unsupported characters.",
                field_name="email",
                code="invalid_email",
            )
    elif any(
        unicodedata.category(char).startswith("C")
        for char in local
    ):
        raise ValidationError(
            "Email contains unsupported characters.",
            field_name="email",
            code="invalid_email",
        )

    try:
        ascii_domain = domain.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise ValidationError(
            "Email domain is invalid.",
            field_name="email",
            code="invalid_email",
        ) from exc

    if len(ascii_domain) > 253 or "." not in ascii_domain:
        raise ValidationError(
            "Email domain is invalid.",
            field_name="email",
            code="invalid_email",
        )

    labels = ascii_domain.split(".")

    if any(
        not label
        or len(label) > 63
        or not _DOMAIN_LABEL_PATTERN.fullmatch(label)
        for label in labels
    ):
        raise ValidationError(
            "Email domain is invalid.",
            field_name="email",
            code="invalid_email",
        )

    if len(email.encode("utf-8")) > max_length:
        raise ValidationError(
            "Email exceeds the maximum encoded length.",
            field_name="email",
            code="max_length",
        )

    return EmailValidation(
        normalized=f"{local.lower()}@{ascii_domain}",
        local_part=local,
        domain=ascii_domain,
    )


def normalize_email(value: str) -> str:
    """Normalize an email for application-level comparisons."""
    return validate_email(value).normalized


def validate_phone(
    value: Any,
    *,
    min_digits: int = 7,
    max_digits: int = 15,
    require_plus: bool = False,
) -> PhoneValidation:
    """Validate basic phone syntax, not a country's numbering plan."""
    if not isinstance(value, str):
        raise ValidationError(
            "Phone number must be a string.",
            field_name="phone",
            code="invalid_type",
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

    if not phone or not _PHONE_ALLOWED_PATTERN.fullmatch(phone):
        raise ValidationError(
            "Phone number contains unsupported characters.",
            field_name="phone",
            code="invalid_phone",
        )

    if phone.count("+") > 1 or ("+" in phone and not phone.startswith("+")):
        raise ValidationError(
            "The plus sign may appear only at the beginning.",
            field_name="phone",
            code="invalid_phone",
        )

    digits = "".join(char for char in phone if char.isdigit())

    if not min_digits <= len(digits) <= max_digits:
        raise ValidationError(
            f"Phone number must contain {min_digits}–{max_digits} digits.",
            field_name="phone",
            code="invalid_phone_length",
        )

    if require_plus and not phone.startswith("+"):
        raise ValidationError(
            "Include the international dialing prefix.",
            field_name="phone",
            code="country_code_required",
        )

    return PhoneValidation(
        normalized=f"+{digits}" if phone.startswith("+") else digits,
        digits=digits,
    )


# ---------------------------------------------------------------------------
# Passwords and identifiers
# ---------------------------------------------------------------------------

def validate_password(
    value: Any,
    *,
    policy: PasswordPolicy | None = None,
) -> str:
    """Validate a password without trimming, changing, or returning secrets in errors."""
    if not isinstance(value, str):
        raise ValidationError(
            "Password must be a string.",
            field_name="password",
            code="invalid_type",
        )

    rules = policy or PasswordPolicy()

    if not rules.min_length <= len(value) <= rules.max_length:
        raise ValidationError(
            f"Password must be {rules.min_length}–{rules.max_length} "
            "characters long.",
            field_name="password",
            code="invalid_password_length",
        )

    if rules.reject_whitespace and any(char.isspace() for char in value):
        raise ValidationError(
            "Password must not contain whitespace.",
            field_name="password",
            code="password_whitespace",
        )

    if rules.require_lowercase and not any(char.islower() for char in value):
        raise ValidationError(
            "Password must contain a lowercase letter.",
            field_name="password",
            code="password_lowercase",
        )

    if rules.require_uppercase and not any(char.isupper() for char in value):
        raise ValidationError(
            "Password must contain an uppercase letter.",
            field_name="password",
            code="password_uppercase",
        )

    if rules.require_digit and not any(char.isdigit() for char in value):
        raise ValidationError(
            "Password must contain a digit.",
            field_name="password",
            code="password_digit",
        )

    if rules.require_symbol and not any(
        not char.isalnum() and not char.isspace()
        for char in value
    ):
        raise ValidationError(
            "Password must contain a symbol.",
            field_name="password",
            code="password_symbol",
        )

    if rules.reject_common_passwords and value.casefold() in _COMMON_PASSWORDS:
        raise ValidationError(
            "Choose a less common password.",
            field_name="password",
            code="common_password",
        )

    return value


def validate_identifier(
    value: Any,
    *,
    field_name: str = "identifier",
    min_length: int = 1,
    max_length: int = 128,
    allow_colon: bool = True,
) -> str:
    """Validate a compact identifier, not a filesystem path."""
    if not isinstance(value, str):
        raise ValidationError(
            "Identifier must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    if (
        isinstance(min_length, bool)
        or not isinstance(min_length, int)
        or isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or min_length < 1
        or max_length < min_length
    ):
        raise ValueError("Invalid identifier length limits.")

    identifier = value.strip()

    if not min_length <= len(identifier) <= max_length:
        raise ValidationError(
            f"Identifier must be {min_length}–{max_length} characters.",
            field_name=field_name,
            code="invalid_identifier_length",
        )

    pattern = (
        _IDENTIFIER_PATTERN
        if allow_colon
        else re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    )

    if not pattern.fullmatch(identifier) or ".." in identifier:
        raise ValidationError(
            "Identifier contains unsupported characters.",
            field_name=field_name,
            code="invalid_identifier",
        )

    if identifier.endswith("."):
        raise ValidationError(
            "Identifier contains an invalid sequence.",
            field_name=field_name,
            code="invalid_identifier",
        )

    return identifier


# ---------------------------------------------------------------------------
# Numbers, booleans, dates, and enumerations
# ---------------------------------------------------------------------------

def validate_integer(
    value: Any,
    *,
    field_name: str = "value",
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """Validate an integer, rejecting booleans and decimal strings."""
    if isinstance(value, bool):
        raise ValidationError(
            "Value must be an integer.",
            field_name=field_name,
            code="invalid_type",
        )

    if isinstance(value, int):
        number = value
    elif isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        number = int(value.strip())
    else:
        raise ValidationError(
            "Value must be an integer.",
            field_name=field_name,
            code="invalid_integer",
        )

    if minimum is not None and number < minimum:
        raise ValidationError(
            f"Value must be at least {minimum}.",
            field_name=field_name,
            code="below_minimum",
        )

    if maximum is not None and number > maximum:
        raise ValidationError(
            f"Value must be at most {maximum}.",
            field_name=field_name,
            code="above_maximum",
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
    """Validate a finite numeric value and return Decimal for precision."""
    if isinstance(value, bool) or value is None:
        raise ValidationError(
            "Value must be numeric.",
            field_name=field_name,
            code="invalid_number",
        )

    if isinstance(value, float) and not math.isfinite(value):
        raise ValidationError(
            "Value must be finite.",
            field_name=field_name,
            code="non_finite_number",
        )

    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, AttributeError) as exc:
        raise ValidationError(
            "Value must be numeric.",
            field_name=field_name,
            code="invalid_number",
        ) from exc

    if not number.is_finite():
        raise ValidationError(
            "Value must be finite.",
            field_name=field_name,
            code="non_finite_number",
        )

    if minimum is not None and number < Decimal(str(minimum)):
        raise ValidationError(
            f"Value must be at least {minimum}.",
            field_name=field_name,
            code="below_minimum",
        )

    if maximum is not None and number > Decimal(str(maximum)):
        raise ValidationError(
            f"Value must be at most {maximum}.",
            field_name=field_name,
            code="above_maximum",
        )

    if decimal_places is not None:
        if (
            isinstance(decimal_places, bool)
            or not isinstance(decimal_places, int)
            or decimal_places < 0
        ):
            raise ValueError(
                "decimal_places must be a non-negative integer."
            )

        if max(0, -number.as_tuple().exponent) > decimal_places:
            raise ValidationError(
                f"Value may have at most {decimal_places} decimal places.",
                field_name=field_name,
                code="decimal_places",
            )

    return number


def validate_boolean(
    value: Any,
    *,
    field_name: str = "value",
) -> bool:
    """Accept only an actual Python boolean."""
    if not isinstance(value, bool):
        raise ValidationError(
            "Value must be a boolean.",
            field_name=field_name,
            code="invalid_boolean",
        )
    return value


def validate_date(
    value: Any,
    *,
    field_name: str = "date",
    allow_datetime: bool = False,
) -> date:
    """Validate a date object or a strict ISO YYYY-MM-DD string."""
    if isinstance(value, datetime):
        if not allow_datetime:
            raise ValidationError(
                "A date is required, not a datetime.",
                field_name=field_name,
                code="invalid_date",
            )
        return value.date()

    if isinstance(value, date):
        return value

    if not isinstance(value, str):
        raise ValidationError(
            "Date must be an ISO YYYY-MM-DD string.",
            field_name=field_name,
            code="invalid_date",
        )

    candidate = value.strip()

    try:
        parsed = date.fromisoformat(candidate)
    except ValueError as exc:
        raise ValidationError(
            "Date must use YYYY-MM-DD format.",
            field_name=field_name,
            code="invalid_date",
        ) from exc

    if parsed.isoformat() != candidate:
        raise ValidationError(
            "Date must use YYYY-MM-DD format.",
            field_name=field_name,
            code="invalid_date",
        )

    return parsed


def validate_enum(
    value: Any,
    allowed_values: Sequence[str] | type[Enum],
    *,
    field_name: str = "value",
    case_sensitive: bool = False,
) -> str:
    """Validate against an enum or sequence of allowed strings."""
    if isinstance(allowed_values, type) and issubclass(allowed_values, Enum):
        allowed = [item.value for item in allowed_values]
    else:
        allowed = list(allowed_values)

    if not allowed or any(not isinstance(item, str) for item in allowed):
        raise ValueError("allowed_values must contain strings.")

    if not isinstance(value, str):
        raise ValidationError(
            "Value must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    candidate = value.strip()

    if case_sensitive:
        return candidate if candidate in allowed else _raise_invalid_choice(
            field_name
        )

    lookup = {item.casefold(): item for item in allowed}
    matched = lookup.get(candidate.casefold())

    if matched is None:
        return _raise_invalid_choice(field_name)

    return matched


def _raise_invalid_choice(field_name: str) -> Any:
    raise ValidationError(
        "Value is not an allowed option.",
        field_name=field_name,
        code="invalid_choice",
    )


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------

def validate_url(
    value: Any,
    *,
    field_name: str = "url",
    allowed_schemes: Sequence[str] = ("https",),
    allow_localhost: bool = False,
    allow_ip_address: bool = False,
    max_length: int = 2_048,
) -> str:
    """
    Validate an absolute URL.

    This function does not resolve DNS or prevent SSRF by itself. For
    server-side fetching, use a host allowlist, block private/reserved
    destination addresses, and revalidate redirect targets.
    """
    if not isinstance(value, str):
        raise ValidationError(
            "URL must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    if (
        isinstance(max_length, bool)
        or not isinstance(max_length, int)
        or max_length < 1
    ):
        raise ValueError("max_length must be a positive integer.")

    url = value.strip()

    if not url or len(url) > max_length:
        raise ValidationError(
            "URL is required and must be within the allowed length.",
            field_name=field_name,
            code="invalid_url",
        )

    if any(ord(char) < 32 or char.isspace() for char in url):
        raise ValidationError(
            "URL must not contain whitespace or control characters.",
            field_name=field_name,
            code="invalid_url",
        )

    try:
        parts = urlsplit(url)
        port = parts.port
        hostname = parts.hostname
    except ValueError as exc:
        raise ValidationError(
            "URL is malformed.",
            field_name=field_name,
            code="invalid_url",
        ) from exc

    schemes = {
        scheme.lower()
        for scheme in allowed_schemes
        if isinstance(scheme, str)
    }

    if parts.scheme.lower() not in schemes:
        raise ValidationError(
            "URL scheme is not permitted.",
            field_name=field_name,
            code="invalid_url_scheme",
        )

    if not parts.netloc or not hostname:
        raise ValidationError(
            "URL must include a hostname.",
            field_name=field_name,
            code="invalid_url",
        )

    if parts.username is not None or parts.password is not None:
        raise ValidationError(
            "URLs containing embedded credentials are not allowed.",
            field_name=field_name,
            code="url_credentials",
        )

    normalized_host = hostname.rstrip(".").lower()

    if (
        normalized_host == "localhost"
        or normalized_host.endswith(".localhost")
    ) and not allow_localhost:
        raise ValidationError(
            "Localhost URLs are not allowed.",
            field_name=field_name,
            code="local_hostname",
        )

    try:
        parsed_ip = ipaddress.ip_address(normalized_host)
    except ValueError:
        parsed_ip = None

    if parsed_ip is not None:
        if not allow_ip_address:
            raise ValidationError(
                "IP-address URLs are not allowed.",
                field_name=field_name,
                code="ip_address_not_allowed",
            )

        if not parsed_ip.is_global:
            raise ValidationError(
                "Non-public IP addresses are not allowed.",
                field_name=field_name,
                code="non_public_ip",
            )

    if port is not None and not 1 <= port <= 65535:
        raise ValidationError(
            "URL port is invalid.",
            field_name=field_name,
            code="invalid_port",
        )

    return url


# ---------------------------------------------------------------------------
# Mapping and required fields
# ---------------------------------------------------------------------------

def validate_mapping(
    value: Any,
    *,
    field_name: str = "payload",
    allowed_fields: set[str] | frozenset[str] | None = None,
    required_fields: set[str] | frozenset[str] | None = None,
    reject_unknown_fields: bool = True,
) -> dict[str, Any]:
    """Validate an object and optionally enforce an explicit field schema."""
    if not isinstance(value, Mapping):
        raise ValidationError(
            "Payload must be a JSON object.",
            field_name=field_name,
            code="invalid_type",
        )

    payload = dict(value)

    if any(not isinstance(key, str) for key in payload):
        raise ValidationError(
            "Object field names must be strings.",
            field_name=field_name,
            code="invalid_field_name",
        )

    if allowed_fields is not None and reject_unknown_fields:
        if set(payload) - set(allowed_fields):
            raise ValidationError(
                "Payload contains unsupported fields.",
                field_name=field_name,
                code="unknown_fields",
            )

    if required_fields:
        if set(required_fields) - set(payload):
            raise ValidationError(
                "Payload is missing required fields.",
                field_name=field_name,
                code="missing_fields",
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
        raise ValidationError(
            "Payload must be an object.",
            code="invalid_type",
        )

    for field_name in required_fields:
        if field_name not in payload or payload[field_name] is None:
            raise ValidationError(
                "A required field is missing.",
                field_name=field_name,
                code="required",
            )

        value = payload[field_name]

        if (
            not allow_blank_strings
            and isinstance(value, str)
            and not value.strip()
        ):
            raise ValidationError(
                "A required field cannot be blank.",
                field_name=field_name,
                code="required",
            )


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

def validate_pagination(
    *,
    page: Any = 1,
    page_size: Any = 20,
    max_page_size: int = 100,
) -> Pagination:
    """Validate pagination values and calculate a bounded offset."""
    if (
        isinstance(max_page_size, bool)
        or not isinstance(max_page_size, int)
        or max_page_size < 1
    ):
        raise ValueError("max_page_size must be a positive integer.")

    normalized_page = validate_integer(
        page,
        field_name="page",
        minimum=1,
    )
    normalized_size = validate_integer(
        page_size,
        field_name="page_size",
        minimum=1,
        maximum=max_page_size,
    )

    return Pagination(
        page=normalized_page,
        page_size=normalized_size,
        offset=(normalized_page - 1) * normalized_size,
    )


# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------

def validate_mime_type(
    value: Any,
    *,
    allowed_types: Sequence[str],
    field_name: str = "mime_type",
) -> str:
    """
    Validate a declared MIME type against an explicit allowlist.

    The declared type is client-controlled. Verify file signatures and
    inspect content server-side before trusting uploaded files.
    """
    if not isinstance(value, str):
        raise ValidationError(
            "MIME type must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    mime = value.strip().lower()

    if not _MIME_PATTERN.fullmatch(mime):
        raise ValidationError(
            "MIME type is malformed.",
            field_name=field_name,
            code="invalid_mime_type",
        )

    if isinstance(allowed_types, (str, bytes)):
        raise ValueError("allowed_types must be a sequence of MIME types.")

    normalized_allowlist: set[str] = set()

    for item in allowed_types:
        if not isinstance(item, str):
            raise ValueError("allowed_types must contain strings.")

        candidate = item.strip().lower()

        if not _MIME_PATTERN.fullmatch(candidate):
            raise ValueError("allowed_types contains an invalid MIME type.")

        normalized_allowlist.add(candidate)

    if mime not in normalized_allowlist:
        raise ValidationError(
            "Uploaded file type is not permitted.",
            field_name=field_name,
            code="mime_type_not_allowed",
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


# ---------------------------------------------------------------------------
# Application payload
# ---------------------------------------------------------------------------

def validate_application_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    """
    Validate the shape of an application submission.

    Eligibility, admissions rules, consent recording, and authorization
    must be enforced separately by the application service.
    """
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

    if "full_name" in data:
        data["full_name"] = validate_name(
            data["full_name"],
            field_name="full_name",
        )

    if "email" in data:
        data["email"] = normalize_email(data["email"])

    if data.get("phone") not in (None, ""):
        data["phone"] = validate_phone(data["phone"]).normalized

    for field_name in (
        "course",
        "course_type",
        "qualification",
        "institution",
        "exam_name",
        "city",
        "state",
        "country",
        "postal_code",
        "address",
    ):
        if field_name in data and data[field_name] is not None:
            data[field_name] = validate_text(
                data[field_name],
                field_name=field_name,
                max_length=500 if field_name == "address" else 250,
                allow_newlines=field_name == "address",
            )

    if data.get("message") is not None:
        if "message" in data:
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


# ---------------------------------------------------------------------------
# Job payload
# ---------------------------------------------------------------------------

def validate_job_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | frozenset[str] | None = None,
) -> dict[str, Any]:
    """Validate a job posting's basic data shape and numeric ranges."""
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
                "full_time",
                "part_time",
                "contract",
                "internship",
                "temporary",
                "freelance",
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

    for field_name in ("department", "currency"):
        if data.get(field_name) is not None:
            data[field_name] = validate_text(
                data[field_name],
                field_name=field_name,
                max_length=100,
                allow_newlines=False,
            )

    for field_name in (
        "experience_min_years",
        "experience_max_years",
    ):
        if data.get(field_name) is not None:
            data[field_name] = validate_number(
                data[field_name],
                field_name=field_name,
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
        raise ValidationError(
            "Minimum experience cannot exceed maximum experience.",
            field_name="experience_min_years",
            code="invalid_experience_range",
        )

    for field_name in ("salary_min", "salary_max"):
        if data.get(field_name) is not None:
            data[field_name] = validate_number(
                data[field_name],
                field_name=field_name,
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
        raise ValidationError(
            "Minimum salary cannot exceed maximum salary.",
            field_name="salary_min",
            code="invalid_salary_range",
        )

    for field_name in ("skills", "qualifications"):
        if field_name in data:
            items = data[field_name]

            if not isinstance(items, list):
                raise ValidationError(
                    "Value must be a list of strings.",
                    field_name=field_name,
                    code="invalid_type",
                )

            if len(items) > 100:
                raise ValidationError(
                    "List contains too many items.",
                    field_name=field_name,
                    code="too_many_items",
                )

            data[field_name] = [
                validate_text(
                    item,
                    field_name=field_name,
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


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

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
