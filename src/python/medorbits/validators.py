
"""MedOrbits validation utilities.

Reusable validation primitives for education, admissions, applications,
recruitment, document uploads, and career services.

Security principles:
- Validate types before operating on user-controlled values.
- Reject malformed input instead of silently coercing it.
- Normalize only where normalization is safe and explicitly intended.
- Never log submitted personal data or credential values.
- Keep validation independent of web frameworks and database drivers.

This module validates input shape and basic constraints. It does not replace
database constraints, authorization, malware scanning, or business-rule checks.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from enum import Enum
from ipaddress import ip_address
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
        """Return a safe, API-friendly error representation."""
        result = {
            "code": self.code,
            "message": str(self),
        }
        if self.field_name:
            result["field"] = self.field_name
        return result


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    """A single field validation issue."""

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
    """Validation outcome containing safe issues, not submitted values."""

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
    """Password policy configuration."""

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
            raise ValueError(
                "max_length must be an integer >= min_length."
            )


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
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_PHONE_ALLOWED_PATTERN = re.compile(r"^[+0-9().\-\s]+$")
_MIME_PATTERN = re.compile(
    r"^[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*/"
    r"[a-zA-Z0-9][a-zA-Z0-9!#$&^_.+-]*$"
)
_COMMON_PASSWORDS = {
    "123456789012",
    "password123",
    "password1234",
    "qwerty123456",
    "admin123456",
    "letmein12345",
    "welcome12345",
    "iloveyou1234",
}

_APPLICATION_ALLOWED_FIELDS = {
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
}

_APPLICATION_REQUIRED_FIELDS = {
    "full_name",
    "email",
    "course",
}

_JOB_ALLOWED_FIELDS = {
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
}

_JOB_REQUIRED_FIELDS = {
    "title",
    "description",
    "employment_type",
    "location",
}


# ---------------------------------------------------------------------------
# General normalization
# ---------------------------------------------------------------------------

def normalize_whitespace(value: str) -> str:
    """Collapse consecutive whitespace and trim leading/trailing spaces."""
    if not isinstance(value, str):
        raise ValidationError(
            "Value must be a string.",
            code="invalid_type",
        )
    return " ".join(value.split())


def normalize_email(value: str) -> str:
    """Normalize an email address for comparison and storage.

    The complete address is lowercased for application-level consistency.
    Systems that need strict SMTP local-part case preservation should retain
    the original local part separately.
    """
    result = validate_email(value)
    return result.normalized


def sanitize_plain_text(
    value: str,
    *,
    max_length: int = 5_000,
    allow_newlines: bool = False,
    strip: bool = True,
) -> str:
    """Normalize plain text and reject control characters.

    This is not an HTML sanitizer. Escape or render untrusted text safely
    in the presentation layer, and use parameterized SQL for database access.
    """
    text = validate_text(
        value,
        field_name="text",
        min_length=0,
        max_length=max_length,
        strip=strip,
        allow_empty=True,
    )

    normalized: list[str] = []

    for char in text:
        category = unicodedata.category(char)

        if category == "Cc":
            if allow_newlines and char in "\n\r\t":
                normalized.append(char)
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

        normalized.append(char)

    result = "".join(normalized)

    if not allow_newlines:
        result = normalize_whitespace(result)

    if len(result) > max_length:
        raise ValidationError(
            f"Text must be at most {max_length} characters.",
            field_name="text",
            code="max_length",
        )

    return result


# ---------------------------------------------------------------------------
# Email and phone
# ---------------------------------------------------------------------------

def validate_email(
    value: Any,
    *,
    allow_internationalized: bool = False,
    max_length: int = 254,
) -> EmailValidation:
    """Validate basic email syntax without claiming mailbox existence."""
    if not isinstance(value, str):
        raise ValidationError(
            "Email must be a string.",
            field_name="email",
            code="invalid_type",
        )

    email = value.strip()

    if not email or len(email) > max_length:
        raise ValidationError(
            "Email is required and must be within the allowed length.",
            field_name="email",
            code="invalid_email",
        )

    if any(char.isspace() for char in email):
        raise ValidationError(
            "Email must not contain whitespace.",
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
        or len(local) > 64
        or local.startswith(".")
        or local.endswith(".")
        or ".." in local
    ):
        raise ValidationError(
            "Enter a valid email address.",
            field_name="email",
            code="invalid_email",
        )

    if not allow_internationalized and not _EMAIL_LOCAL_PATTERN.fullmatch(
        local
    ):
        raise ValidationError(
            "Email contains unsupported characters.",
            field_name="email",
            code="invalid_email",
        )

    if allow_internationalized:
        if any(unicodedata.category(ch).startswith("C") for ch in local):
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
            "Email domain must contain a valid public-style domain name.",
            field_name="email",
            code="invalid_email",
        )

    labels = ascii_domain.split(".")

    if any(
        not label or len(label) > 63
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


def validate_phone(
    value: Any,
    *,
    min_digits: int = 7,
    max_digits: int = 15,
    require_plus: bool = False,
) -> PhoneValidation:
    """Validate and normalize a phone number's basic syntax.

    For Indian mobile numbers, use a country-specific phone-number library
    when you need reliable national-format and numbering-plan validation.
    """
    if not isinstance(value, str):
        raise ValidationError(
            "Phone number must be a string.",
            field_name="phone",
            code="invalid_type",
        )

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

    normalized = f"+{digits}" if phone.startswith("+") else digits

    return PhoneValidation(
        normalized=normalized,
        digits=digits,
        country_code=None,
    )


# ---------------------------------------------------------------------------
# Passwords and identifiers
# ---------------------------------------------------------------------------

def validate_password(
    value: Any,
    *,
    policy: PasswordPolicy | None = None,
) -> str:
    """Validate a password without trimming or modifying it."""
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

    if rules.require_lowercase and not any(ch.islower() for ch in value):
        raise ValidationError(
            "Password must contain a lowercase letter.",
            field_name="password",
            code="password_lowercase",
        )

    if rules.require_uppercase and not any(ch.isupper() for ch in value):
        raise ValidationError(
            "Password must contain an uppercase letter.",
            field_name="password",
            code="password_uppercase",
        )

    if rules.require_digit and not any(ch.isdigit() for ch in value):
        raise ValidationError(
            "Password must contain a digit.",
            field_name="password",
            code="password_digit",
        )

    if rules.require_symbol and not any(
        not ch.isalnum() and not ch.isspace()
        for ch in value
    ):
        raise ValidationError(
            "Password must contain a symbol.",
            field_name="password",
            code="password_symbol",
        )

    if (
        rules.reject_common_passwords
        and value.casefold() in _COMMON_PASSWORDS
    ):
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
    """Validate a compact identifier used for internal records."""
    if not isinstance(value, str):
        raise ValidationError(
            "Identifier must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    identifier = value.strip()

    if not min_length <= len(identifier) <= max_length:
        raise ValidationError(
            f"Identifier must be {min_length}–{max_length} characters.",
            field_name=field_name,
            code="invalid_identifier_length",
        )

    pattern = (
        r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"
        if allow_colon
        else r"^[A-Za-z0-9][A-Za-z0-9._-]*$"
    )

    if not re.fullmatch(pattern, identifier):
        raise ValidationError(
            "Identifier contains unsupported characters.",
            field_name=field_name,
            code="invalid_identifier",
        )

    if ".." in identifier or identifier.endswith("."):
        raise ValidationError(
            "Identifier contains an invalid sequence.",
            field_name=field_name,
            code="invalid_identifier",
        )

    return identifier


# ---------------------------------------------------------------------------
# Text, names, numeric values and booleans
# ---------------------------------------------------------------------------

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
    """Validate a text value with length and control-character limits."""
    if not isinstance(value, str):
        raise ValidationError(
            "Value must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    text = value.strip() if strip else value

    if not allow_newlines and any(
        char in text for char in ("\n", "\r", "\t")
    ):
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
        and char not in ("\n", "\r", "\t")
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


def validate_integer(
    value: Any,
    *,
    field_name: str = "value",
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """Validate an integer; reject booleans and decimal strings."""
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
            raise ValueError("decimal_places must be a non-negative integer.")

        exponent = number.as_tuple().exponent
        actual_places = max(0, -exponent)

        if actual_places > decimal_places:
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
    """Validate a true Python boolean without permissive string coercion."""
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
    """Validate a date object or an ISO-8601 YYYY-MM-DD string."""
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

    try:
        parsed = date.fromisoformat(value.strip())
    except ValueError as exc:
        raise ValidationError(
            "Date must use YYYY-MM-DD format.",
            field_name=field_name,
            code="invalid_date",
        ) from exc

    if parsed.isoformat() != value.strip():
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
    """Validate a value against an enum or an explicit sequence of strings."""
    if isinstance(allowed_values, type) and issubclass(allowed_values, Enum):
        allowed = [str(item.value) for item in allowed_values]
    else:
        allowed = list(allowed_values)

    if not isinstance(value, str):
        raise ValidationError(
            "Value must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

    candidate = value.strip()

    if not case_sensitive:
        lookup = {item.casefold(): item for item in allowed}
        matched = lookup.get(candidate.casefold())
    else:
        matched = candidate if candidate in allowed else None

    if matched is None:
        raise ValidationError(
            "Value is not an allowed option.",
            field_name=field_name,
            code="invalid_choice",
        )

    return matched


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
    """Validate an absolute URL.

    By default, only HTTPS URLs are accepted. This validator does not resolve
    DNS or prevent SSRF on its own. Before server-side fetching, enforce an
    explicit host allowlist, resolve and check IP addresses, and revalidate
    every redirect target.
    """
    if not isinstance(value, str):
        raise ValidationError(
            "URL must be a string.",
            field_name=field_name,
            code="invalid_type",
        )

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
    except ValueError as exc:
        raise ValidationError(
            "URL is malformed.",
            field_name=field_name,
            code="invalid_url",
        ) from exc

    schemes = {scheme.lower() for scheme in allowed_schemes}

    if parts.scheme.lower() not in schemes:
        raise ValidationError(
            "URL scheme is not permitted.",
            field_name=field_name,
            code="invalid_url_scheme",
        )

    if not parts.netloc or not parts.hostname:
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

    hostname = parts.hostname.rstrip(".").lower()

    if hostname == "localhost" or hostname.endswith(".localhost"):
        if not allow_localhost:
            raise ValidationError(
                "Localhost URLs are not allowed.",
                field_name=field_name,
                code="local_hostname",
            )

    try:
        parsed_ip = ip_address(hostname.strip("[]"))
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
# Mapping and required-field validation
# ---------------------------------------------------------------------------

def validate_mapping(
    value: Any,
    *,
    field_name: str = "payload",
    allowed_fields: set[str] | None = None,
    required_fields: set[str] | None = None,
    reject_unknown_fields: bool = True,
) -> dict[str, Any]:
    """Validate a mapping and optionally enforce its field allowlist."""
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
        unknown = set(payload) - allowed_fields

        if unknown:
            # Do not include untrusted values in the error message.
            raise ValidationError(
                "Payload contains unsupported fields.",
                field_name=field_name,
                code="unknown_fields",
            )

    if required_fields:
        missing = required_fields - set(payload)

        if missing:
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
    """Validate page/page_size and calculate a safe SQL offset."""
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
# File upload validation
# ---------------------------------------------------------------------------

def validate_mime_type(
    value: Any,
    *,
    allowed_types: Sequence[str],
    field_name: str = "mime_type",
) -> str:
    """Validate a declared MIME type against an explicit allowlist.

    A declared MIME type is client-controlled. Verify file signatures and
    content server-side before trusting an uploaded file.
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

    normalized_allowlist = {
        item.strip().lower()
        for item in allowed_types
        if isinstance(item, str)
    }

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
    """Validate file size in bytes."""
    size = validate_integer(
        value,
        field_name=field_name,
        minimum=min_bytes,
        maximum=max_bytes,
    )
    return size


# ---------------------------------------------------------------------------
# MedOrbits application and job payloads
# ---------------------------------------------------------------------------

def validate_application_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Validate the basic shape of an application submission.

    Extend allowed fields to match the application's versioned API schema.
    This function does not validate eligibility or admission requirements.
    """
    data = validate_mapping(
        payload,
        field_name="application",
        allowed_fields=_APPLICATION_ALLOWED_FIELDS,
        required_fields=required_fields or _APPLICATION_REQUIRED_FIELDS,
        reject_unknown_fields=reject_unknown_fields,
    )

    if "full_name" in data:
        data["full_name"] = validate_name(
            data["full_name"],
            field_name="full_name",
        )

    if "email" in data:
        data["email"] = normalize_email(data["email"])

    if "phone" in data and data["phone"] not in (None, ""):
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
    ):
        if field_name in data and data[field_name] is not None:
            data[field_name] = validate_text(
                data[field_name],
                field_name=field_name,
                max_length=250,
                allow_newlines=False,
            )

    if "message" in data and data["message"] is not None:
        data["message"] = sanitize_plain_text(
            data["message"],
            max_length=5_000,
            allow_newlines=True,
        )

    if "date_of_birth" in data and data["date_of_birth"] not in (None, ""):
        data["date_of_birth"] = validate_date(
            data["date_of_birth"],
            field_name="date_of_birth",
        ).isoformat()

    if "graduation_year" in data and data["graduation_year"] not in (None, ""):
        data["graduation_year"] = validate_integer(
            data["graduation_year"],
            field_name="graduation_year",
            minimum=1900,
            maximum=date.today().year + 10,
        )

    for field_name in ("exam_score", "exam_rank"):
        if field_name in data and data[field_name] not in (None, ""):
            data[field_name] = validate_number(
                data[field_name],
                field_name=field_name,
                minimum=0,
                decimal_places=4 if field_name == "exam_score" else 0,
            )

    if "consent" in data:
        data["consent"] = validate_boolean(
            data["consent"],
            field_name="consent",
        )

    if "application_id" in data and data["application_id"] is not None:
        data["application_id"] = validate_identifier(
            data["application_id"],
            field_name="application_id",
        )

    return data


def validate_job_payload(
    payload: Any,
    *,
    reject_unknown_fields: bool = True,
    required_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Validate a job posting's basic data shape."""
    data = validate_mapping(
        payload,
        field_name="job",
        allowed_fields=_JOB_ALLOWED_FIELDS,
        required_fields=required_fields or _JOB_REQUIRED_FIELDS,
        reject_unknown_fields=reject_unknown_fields,
    )

    data["title"] = validate_text(
        data["title"],
        field_name="title",
        max_length=200,
        allow_newlines=False,
    )

    data["description"] = sanitize_plain_text(
        data["description"],
        max_length=20_000,
        allow_newlines=True,
    )

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

    data["location"] = validate_text(
        data["location"],
        field_name="location",
        max_length=250,
        allow_newlines=False,
    )

    for field_name in ("department", "currency"):
        if field_name in data and data[field_name] is not None:
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
        if field_name in data and data[field_name] is not None:
            data[field_name] = validate_number(
                data[field_name],
                field_name=field_name,
                minimum=0,
                maximum=80,
                decimal_places=1,
            )

    min_experience = data.get("experience_min_years")
    max_experience = data.get("experience_max_years")

    if (
        min_experience is not None
        and max_experience is not None
        and Decimal(str(min_experience)) > Decimal(str(max_experience))
    ):
        raise ValidationError(
            "Minimum experience cannot exceed maximum experience.",
            field_name="experience_min_years",
            code="invalid_experience_range",
        )

    for field_name in ("salary_min", "salary_max"):
        if field_name in data and data[field_name] is not None:
            data[field_name] = validate_number(
                data[field_name],
                field_name=field_name,
                minimum=0,
                decimal_places=2,
            )

    min_salary = data.get("salary_min")
    max_salary = data.get("salary_max")

    if (
        min_salary is not None
        and max_salary is not None
        and Decimal(str(min_salary)) > Decimal(str(max_salary))
    ):
        raise ValidationError(
            "Minimum salary cannot exceed maximum salary.",
            field_name="salary_min",
            code="invalid_salary_range",
        )

    for field_name in ("skills", "qualifications"):
        if field_name in data:
            value = data[field_name]

            if not isinstance(value, list):
                raise ValidationError(
                    "Value must be a list of strings.",
                    field_name=field_name,
                    code="invalid_type",
                )

            if len(value) > 100:
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
                for item in value
            ]

    if "application_deadline" in data and data["application_deadline"] not in (None, ""):
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

    if "job_id" in data and data["job_id"] is not None:
        data["job_id"] = validate_identifier(
            data["job_id"],
            field_name="job_id",
        )

    return data


# ---------------------------------------------------------------------------
# Exception helper
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

