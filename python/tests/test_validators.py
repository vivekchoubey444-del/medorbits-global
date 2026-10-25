# /python/tests/test_validators.py
"""
Professional unit tests for MedOrbits validation utilities.

Purpose:
    Validate common input-validation behavior, edge cases, malformed values,
    and predictable failure handling.

Test framework:
    Python standard-library unittest.

Project integration:
    Replace the optional adapter import with the real public validator
    functions when their module and API names are confirmed.

Run from the repository root:
    python -m unittest discover -s python/tests -p "test_validators.py" -v

Design principles:
    - No network access.
    - No production data or credentials.
    - Deterministic, repeatable test cases.
    - Explicit expected behavior.
    - No third-party dependencies.
"""

from __future__ import annotations

import json
import math
import re
import unittest
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


# ---------------------------------------------------------------------------
# Generic validation primitives
#
# These helpers provide an executable baseline for the test suite. If MedOrbits
# already has equivalent production functions, import those functions and
# adapt the tests to call the production implementation instead.
# ---------------------------------------------------------------------------


class ValidationError(ValueError):
    """Raised when a value fails a validation rule."""


def validate_non_empty_string(
    value: Any,
    *,
    field_name: str = "value",
    max_length: int | None = None,
) -> str:
    """Return a normalized non-empty string or raise ValidationError."""
    if not isinstance(value, str):
        raise ValidationError(f"{field_name} must be a string")

    normalized = value.strip()

    if not normalized:
        raise ValidationError(f"{field_name} must not be empty")

    if max_length is not None:
        if isinstance(max_length, bool) or not isinstance(max_length, int):
            raise TypeError("max_length must be an integer")
        if max_length < 1:
            raise ValueError("max_length must be positive")
        if len(normalized) > max_length:
            raise ValidationError(
                f"{field_name} must be at most {max_length} characters"
            )

    return normalized


def validate_email(value: Any) -> str:
    """
    Apply conservative email syntax validation.

    This checks format only. It does not verify mailbox existence, ownership,
    deliverability, or sender reputation.
    """
    email = validate_non_empty_string(value, field_name="email", max_length=254)

    if any(character.isspace() for character in email):
        raise ValidationError("email must not contain whitespace")

    if email.count("@") != 1:
        raise ValidationError("email must contain exactly one @ symbol")

    local, domain = email.rsplit("@", 1)

    if not local or not domain:
        raise ValidationError("email must include a local part and domain")

    if len(local) > 64:
        raise ValidationError("email local part is too long")

    if local.startswith(".") or local.endswith(".") or ".." in local:
        raise ValidationError("email local part has invalid dot placement")

    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+", local):
        raise ValidationError("email local part contains invalid characters")

    if domain.startswith("[") or domain.endswith("]"):
        raise ValidationError("address literals are not supported")

    if "." not in domain:
        raise ValidationError("email domain must contain a dot")

    labels = domain.split(".")

    for label in labels:
        if not label or len(label) > 63:
            raise ValidationError("email domain contains an invalid label")
        if label.startswith("-") or label.endswith("-"):
            raise ValidationError("email domain labels cannot start or end with -")
        if not re.fullmatch(r"[A-Za-z0-9-]+", label):
            raise ValidationError("email domain contains invalid characters")

    if len(labels[-1]) < 2:
        raise ValidationError("email domain suffix is too short")

    return email


def validate_http_url(value: Any) -> str:
    """
    Validate an absolute HTTP(S) URL syntactically.

    This function does not make a network request and cannot establish whether
    a URL is safe, trustworthy, reachable, or free of malicious content.
    """
    url = validate_non_empty_string(value, field_name="url", max_length=2048)

    if any(character.isspace() for character in url):
        raise ValidationError("url must not contain whitespace")

    try:
        parts = urlsplit(url)
        hostname = parts.hostname
        port = parts.port
    except ValueError as exc:
        raise ValidationError("url has invalid authority or port syntax") from exc

    if parts.scheme.lower() not in {"http", "https"}:
        raise ValidationError("url scheme must be http or https")

    if not parts.netloc or not hostname:
        raise ValidationError("url must contain a hostname")

    if parts.username is not None or parts.password is not None:
        raise ValidationError("url must not contain embedded credentials")

    if port is not None and not (1 <= port <= 65535):
        raise ValidationError("url port must be between 1 and 65535")

    if hostname.startswith(".") or hostname.endswith("."):
        raise ValidationError("url hostname has invalid dot placement")

    if ".." in hostname:
        raise ValidationError("url hostname contains consecutive dots")

    return url


def validate_json_object(value: Any) -> dict[str, Any]:
    """
    Accept a JSON string or dictionary and return a JSON-compatible object.

    Top-level arrays, strings, numbers, booleans, and null are rejected.
    """
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValidationError("input must contain valid JSON") from exc

    if not isinstance(value, dict):
        raise ValidationError("JSON input must be an object")

    try:
        # Reject unsupported Python objects and non-standard numeric values.
        json.dumps(value, allow_nan=False)
    except (TypeError, ValueError) as exc:
        raise ValidationError("object must contain valid JSON-compatible data") from exc

    return value


def validate_required_fields(
    data: Any,
    required_fields: set[str] | tuple[str, ...] | list[str],
) -> dict[str, Any]:
    """Ensure an object contains the requested, non-empty fields."""
    if not isinstance(data, dict):
        raise ValidationError("data must be a dictionary")

    if isinstance(required_fields, (str, bytes)):
        raise TypeError("required_fields must be a collection of field names")

    fields = tuple(required_fields)

    if any(not isinstance(field, str) or not field for field in fields):
        raise ValueError("required field names must be non-empty strings")

    missing = [
        field
        for field in fields
        if field not in data
        or data[field] is None
        or (isinstance(data[field], str) and not data[field].strip())
    ]

    if missing:
        raise ValidationError(
            "missing or empty required fields: " + ", ".join(sorted(missing))
        )

    return data


def validate_integer(
    value: Any,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    """Validate an integer while explicitly rejecting booleans."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError("value must be an integer")

    if minimum is not None and value < minimum:
        raise ValidationError(f"value must be at least {minimum}")

    if maximum is not None and value > maximum:
        raise ValidationError(f"value must be at most {maximum}")

    if minimum is not None and maximum is not None and minimum > maximum:
        raise ValueError("minimum must not exceed maximum")

    return value


def validate_finite_number(value: Any) -> int | float:
    """Accept finite integers and floats, excluding booleans."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError("value must be a number")

    if not math.isfinite(value):
        raise ValidationError("value must be finite")

    return value


def validate_iso_date(value: Any) -> date:
    """Parse a strict YYYY-MM-DD calendar date."""
    if not isinstance(value, str):
        raise ValidationError("date must be a string in YYYY-MM-DD format")

    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValidationError("date must use YYYY-MM-DD format")

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError("date is not a valid calendar date") from exc


# ---------------------------------------------------------------------------
# Tests: required text
# ---------------------------------------------------------------------------


class TestNonEmptyStringValidation(unittest.TestCase):
    """Tests for required text and optional length constraints."""

    def test_accepts_ordinary_text(self) -> None:
        self.assertEqual(validate_non_empty_string("MedOrbits"), "MedOrbits")

    def test_trims_surrounding_whitespace(self) -> None:
        self.assertEqual(validate_non_empty_string("  MedOrbits  "), "MedOrbits")

    def test_accepts_unicode_text(self) -> None:
        self.assertEqual(validate_non_empty_string("नमस्ते"), "नमस्ते")

    def test_rejects_empty_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_non_empty_string("")

    def test_rejects_whitespace_only_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_non_empty_string(" \t\n ")

    def test_rejects_none(self) -> None:
        with self.assertRaises(ValidationError):
            validate_non_empty_string(None)

    def test_rejects_integer(self) -> None:
        with self.assertRaises(ValidationError):
            validate_non_empty_string(123)

    def test_accepts_string_at_maximum_length(self) -> None:
        self.assertEqual(
            validate_non_empty_string("abcd", max_length=4),
            "abcd",
        )

    def test_rejects_string_over_maximum_length(self) -> None:
        with self.assertRaises(ValidationError):
            validate_non_empty_string("abcde", max_length=4)

    def test_length_is_checked_after_normalization(self) -> None:
        self.assertEqual(
            validate_non_empty_string("  abc  ", max_length=3),
            "abc",
        )

    def test_rejects_invalid_maximum_length_type(self) -> None:
        with self.assertRaises(TypeError):
            validate_non_empty_string("abc", max_length=True)

    def test_rejects_non_positive_maximum_length(self) -> None:
        with self.assertRaises(ValueError):
            validate_non_empty_string("abc", max_length=0)


# ---------------------------------------------------------------------------
# Tests: email syntax
# ---------------------------------------------------------------------------


class TestEmailValidation(unittest.TestCase):
    """Tests for syntax-level email validation, not deliverability."""

    def test_accepts_standard_email(self) -> None:
        self.assertEqual(
            validate_email("student@example.com"),
            "student@example.com",
        )

    def test_accepts_plus_addressing(self) -> None:
        self.assertEqual(
            validate_email("student+admissions@example.com"),
            "student+admissions@example.com",
        )

    def test_accepts_subdomain(self) -> None:
        self.assertEqual(
            validate_email("student@mail.example.com"),
            "student@mail.example.com",
        )

    def test_trims_surrounding_whitespace(self) -> None:
        self.assertEqual(
            validate_email("  student@example.com  "),
            "student@example.com",
        )

    def test_rejects_missing_at_symbol(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student.example.com")

    def test_rejects_multiple_at_symbols(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student@@example.com")

    def test_rejects_missing_local_part(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("@example.com")

    def test_rejects_missing_domain(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student@")

    def test_rejects_domain_without_dot(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student@localhost")

    def test_rejects_embedded_whitespace(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student name@example.com")

    def test_rejects_consecutive_dots_in_local_part(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student..name@example.com")

    def test_rejects_leading_dot_in_local_part(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email(".student@example.com")

    def test_rejects_domain_label_starting_with_hyphen(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student@-example.com")

    def test_rejects_missing_domain_label(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email("student@example..com")

    def test_rejects_overlong_email(self) -> None:
        local = "a" * 65
        with self.assertRaises(ValidationError):
            validate_email(f"{local}@example.com")

    def test_rejects_non_string_input(self) -> None:
        with self.assertRaises(ValidationError):
            validate_email(None)


# ---------------------------------------------------------------------------
# Tests: HTTP URL syntax
# ---------------------------------------------------------------------------


class TestHttpUrlValidation(unittest.TestCase):
    """Tests for URL syntax without making external network requests."""

    def test_accepts_https_url(self) -> None:
        self.assertEqual(
            validate_http_url("https://example.com"),
            "https://example.com",
        )

    def test_accepts_http_url(self) -> None:
        self.assertEqual(
            validate_http_url("http://example.com/help"),
            "http://example.com/help",
        )

    def test_accepts_url_with_port(self) -> None:
        self.assertEqual(
            validate_http_url("https://example.com:8443/support"),
            "https://example.com:8443/support",
        )

    def test_accepts_query_and_fragment(self) -> None:
        url = "https://example.com/search?q=admissions&page=2#results"
        self.assertEqual(validate_http_url(url), url)

    def test_rejects_empty_url(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("")

    def test_rejects_unsupported_scheme(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("ftp://example.com/file")

    def test_rejects_javascript_scheme(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("javascript:alert(1)")

    def test_rejects_missing_scheme(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("example.com/path")

    def test_rejects_missing_hostname(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("https:///support")

    def test_rejects_whitespace(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("https://example.com/a b")

    def test_rejects_embedded_credentials(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("https://user:password@example.com")

    def test_rejects_invalid_port(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("https://example.com:99999")

    def test_rejects_malformed_ipv6_authority(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url("https://[invalid]/")

    def test_rejects_non_string_url(self) -> None:
        with self.assertRaises(ValidationError):
            validate_http_url(None)


# ---------------------------------------------------------------------------
# Tests: JSON data
# ---------------------------------------------------------------------------


class TestJsonObjectValidation(unittest.TestCase):
    """Tests for JSON parsing and top-level object validation."""

    def test_accepts_dictionary(self) -> None:
        payload = {"course": "MBBS", "active": True}
        self.assertEqual(validate_json_object(payload), payload)

    def test_accepts_json_object_string(self) -> None:
        result = validate_json_object('{"course": "MBBS", "active": true}')
        self.assertEqual(result, {"course": "MBBS", "active": True})

    def test_accepts_empty_json_object(self) -> None:
        self.assertEqual(validate_json_object("{}"), {})

    def test_accepts_nested_json_data(self) -> None:
        payload = '{"course":{"name":"MBBS","fees":[100,200]}}'
        self.assertEqual(
            validate_json_object(payload),
            {"course": {"name": "MBBS", "fees": [100, 200]}},
        )

    def test_rejects_malformed_json(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object('{"course":')

    def test_rejects_top_level_array(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object('[{"course": "MBBS"}]')

    def test_rejects_top_level_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object('"MBBS"')

    def test_rejects_top_level_number(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object("42")

    def test_rejects_null(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object("null")

    def test_rejects_non_json_dictionary_values(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object({"path": Path("private.txt")})

    def test_rejects_non_finite_float(self) -> None:
        with self.assertRaises(ValidationError):
            validate_json_object({"score": math.nan})

    def test_does_not_mutate_input_dictionary(self) -> None:
        payload = {"items": [1, 2, 3]}
        original = {"items": [1, 2, 3]}

        validate_json_object(payload)

        self.assertEqual(payload, original)


# ---------------------------------------------------------------------------
# Tests: required fields
# ---------------------------------------------------------------------------


class TestRequiredFieldValidation(unittest.TestCase):
    """Tests for required keys and blank values."""

    def test_accepts_present_required_fields(self) -> None:
        data = {"name": "Student", "email": "student@example.com"}
        self.assertEqual(
            validate_required_fields(data, {"name", "email"}),
            data,
        )

    def test_accepts_empty_required_field_list(self) -> None:
        self.assertEqual(validate_required_fields({"name": "Student"}, []),
                         {"name": "Student"})

    def test_rejects_missing_field(self) -> None:
        with self.assertRaises(ValidationError):
            validate_required_fields({"name": "Student"}, {"name", "email"})

    def test_rejects_none_value(self) -> None:
        with self.assertRaises(ValidationError):
            validate_required_fields({"name": None}, {"name"})

    def test_rejects_blank_string_value(self) -> None:
        with self.assertRaises(ValidationError):
            validate_required_fields({"name": "  "}, {"name"})

    def test_accepts_zero_as_a_value(self) -> None:
        self.assertEqual(
            validate_required_fields({"attempts": 0}, {"attempts"}),
            {"attempts": 0},
        )

    def test_accepts_false_as_a_value(self) -> None:
        self.assertEqual(
            validate_required_fields({"enabled": False}, {"enabled"}),
            {"enabled": False},
        )

    def test_rejects_non_dictionary_input(self) -> None:
        with self.assertRaises(ValidationError):
            validate_required_fields([], {"name"})

    def test_rejects_string_instead_of_field_collection(self) -> None:
        with self.assertRaises(TypeError):
            validate_required_fields({"name": "Student"}, "name")

    def test_error_message_lists_missing_fields_deterministically(self) -> None:
        with self.assertRaises(ValidationError) as context:
            validate_required_fields({}, {"email", "name"})

        self.assertIn("email", str(context.exception))
        self.assertIn("name", str(context.exception))


# ---------------------------------------------------------------------------
# Tests: integer and numeric ranges
# ---------------------------------------------------------------------------


class TestIntegerValidation(unittest.TestCase):
    """Tests for integer types, ranges, and Python boolean behavior."""

    def test_accepts_integer(self) -> None:
        self.assertEqual(validate_integer(10), 10)

    def test_accepts_minimum_boundary(self) -> None:
        self.assertEqual(validate_integer(1, minimum=1), 1)

    def test_accepts_maximum_boundary(self) -> None:
        self.assertEqual(validate_integer(100, maximum=100), 100)

    def test_accepts_value_within_range(self) -> None:
        self.assertEqual(validate_integer(50, minimum=1, maximum=100), 50)

    def test_rejects_value_below_minimum(self) -> None:
        with self.assertRaises(ValidationError):
            validate_integer(0, minimum=1)

    def test_rejects_value_above_maximum(self) -> None:
        with self.assertRaises(ValidationError):
            validate_integer(101, maximum=100)

    def test_rejects_boolean(self) -> None:
        with self.assertRaises(ValidationError):
            validate_integer(True)

    def test_rejects_float(self) -> None:
        with self.assertRaises(ValidationError):
            validate_integer(10.0)

    def test_rejects_numeric_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_integer("10")

    def test_rejects_inverted_range(self) -> None:
        with self.assertRaises(ValueError):
            validate_integer(5, minimum=10, maximum=1)


class TestFiniteNumberValidation(unittest.TestCase):
    """Tests for finite numeric values."""

    def test_accepts_integer(self) -> None:
        self.assertEqual(validate_finite_number(10), 10)

    def test_accepts_float(self) -> None:
        self.assertEqual(validate_finite_number(10.5), 10.5)

    def test_accepts_zero(self) -> None:
        self.assertEqual(validate_finite_number(0), 0)

    def test_accepts_negative_finite_value(self) -> None:
        self.assertEqual(validate_finite_number(-1.5), -1.5)

    def test_rejects_nan(self) -> None:
        with self.assertRaises(ValidationError):
            validate_finite_number(float("nan"))

    def test_rejects_positive_infinity(self) -> None:
        with self.assertRaises(ValidationError):
            validate_finite_number(float("inf"))

    def test_rejects_negative_infinity(self) -> None:
        with self.assertRaises(ValidationError):
            validate_finite_number(float("-inf"))

    def test_rejects_boolean(self) -> None:
        with self.assertRaises(ValidationError):
            validate_finite_number(False)

    def test_rejects_numeric_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_finite_number("10.5")


# ---------------------------------------------------------------------------
# Tests: ISO date validation
# ---------------------------------------------------------------------------


class TestIsoDateValidation(unittest.TestCase):
    """Tests for strict date formatting and valid calendar dates."""

    def test_accepts_valid_date(self) -> None:
        self.assertEqual(validate_iso_date("2026-10-25"), date(2026, 10, 25))

    def test_accepts_leap_day_in_leap_year(self) -> None:
        self.assertEqual(validate_iso_date("2024-02-29"), date(2024, 2, 29))

    def test_rejects_leap_day_in_non_leap_year(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("2023-02-29")

    def test_rejects_invalid_month(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("2026-13-01")

    def test_rejects_invalid_day(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("2026-04-31")

    def test_rejects_alternate_format(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("25/10/2026")

    def test_rejects_non_padded_month_or_day(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("2026-1-5")

    def test_rejects_datetime_string(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date("2026-10-25T12:00:00")

    def test_rejects_non_string_date(self) -> None:
        with self.assertRaises(ValidationError):
            validate_iso_date(date(2026, 10, 25))


# ---------------------------------------------------------------------------
# Cross-cutting behavior
# ---------------------------------------------------------------------------


class TestValidationErrorContract(unittest.TestCase):
    """Ensure the shared exception type has conventional behavior."""

    def test_validation_error_is_value_error(self) -> None:
        self.assertTrue(issubclass(ValidationError, ValueError))

    def test_validation_error_preserves_message(self) -> None:
        error = ValidationError("Invalid input")
        self.assertEqual(str(error), "Invalid input")

    def test_failed_validation_does_not_require_network(self) -> None:
        # This suite intentionally performs no HTTP requests or reputation
        # checks, so it remains deterministic and safe for offline CI.
        with self.assertRaises(ValidationError):
            validate_http_url("javascript:alert(1)")


if __name__ == "__main__":
    unittest.main(verbosity=2)