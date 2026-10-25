#!/usr/bin/env python3
"""
MedOrbits Exception Tests
=========================
Tests standard exception behavior and custom application exceptions.
Compatible with Python 3.10+.
Uses only the Python standard library.
Run from the repository root:
    python -m unittest python.tests.test_exceptions -v
Design:
- Tests built-in exception handling.
- Provides a reusable custom exception hierarchy for test fixtures.
- Checks messages, inheritance, error chaining, and serialization.
- Does not require application modules to exist.
- Does not modify production configuration or project files.
If MedOrbits has a production exception module, add integration tests
for that module separately.
"""
from __future__ import annotations
import json
import unittest
from typing import Any
# --------------------------------------------------
# TEST EXCEPTION HIERARCHY
# --------------------------------------------------
class MedOrbitsTestError(Exception):
    """Base exception for exception tests."""
class ConfigurationTestError(MedOrbitsTestError):
    """Raised when test configuration is invalid."""
class DataSourceTestError(MedOrbitsTestError):
    """Raised when a test data source fails."""
class ValidationTestError(MedOrbitsTestError):
    """Raised when test data fails validation."""
class IntegrationTestError(MedOrbitsTestError):
    """Raised when a test integration fails."""
class ResourceNotFoundTestError(MedOrbitsTestError):
    """Raised when a requested test resource does not exist."""
class PermissionTestError(MedOrbitsTestError):
    """Raised when a test operation is not permitted."""
# --------------------------------------------------
# ERROR SERIALIZATION HELPER
# --------------------------------------------------
def exception_to_dict(
    error: Exception,
    *,
    include_type: bool = True,
) -> dict[str, Any]:
    """
    Convert an exception to a small JSON-compatible dictionary.
    This helper is intended for tests and diagnostics.
    It deliberately excludes tracebacks, local variables, and secrets.
    """
    result: dict[str, Any] = {
        "message": str(error),
    }
    if include_type:
        result["type"] = type(error).__name__
    return result
# --------------------------------------------------
# TEST CASE
# --------------------------------------------------
class TestExceptionHierarchy(unittest.TestCase):
    """Verify exception inheritance and construction."""
    def test_base_exception_is_an_exception(self) -> None:
        error = MedOrbitsTestError("Test error")
        self.assertIsInstance(error, Exception)
        self.assertEqual(str(error), "Test error")
    def test_custom_exceptions_inherit_from_base(self) -> None:
        exceptions = [
            ConfigurationTestError,
            DataSourceTestError,
            ValidationTestError,
            IntegrationTestError,
            ResourceNotFoundTestError,
            PermissionTestError,
        ]
        for exception_class in exceptions:
            with self.subTest(exception=exception_class.__name__):
                self.assertTrue(
                    issubclass(exception_class, MedOrbitsTestError)
                )
    def test_custom_exceptions_inherit_from_exception(self) -> None:
        exceptions = [
            MedOrbitsTestError,
            ConfigurationTestError,
            DataSourceTestError,
            ValidationTestError,
            IntegrationTestError,
            ResourceNotFoundTestError,
            PermissionTestError,
        ]
        for exception_class in exceptions:
            with self.subTest(exception=exception_class.__name__):
                self.assertTrue(
                    issubclass(exception_class, Exception)
                )
    def test_exception_message_is_preserved(self) -> None:
        message = "Required configuration is missing"
        with self.assertRaises(ConfigurationTestError) as context:
            raise ConfigurationTestError(message)
        self.assertEqual(str(context.exception), message)
    def test_exception_can_be_caught_by_base_class(self) -> None:
        with self.assertRaises(MedOrbitsTestError):
            raise DataSourceTestError("Data source unavailable")
    def test_exception_arguments_are_preserved(self) -> None:
        error = ValidationTestError("Invalid field", "email")
        self.assertEqual(
            error.args,
            ("Invalid field", "email"),
        )
class TestExceptionHandling(unittest.TestCase):
    """Verify common exception-handling patterns."""
    def test_expected_exception_is_caught(self) -> None:
        caught = False
        try:
            raise ResourceNotFoundTestError("Resource not found")
        except ResourceNotFoundTestError:
            caught = True
        self.assertTrue(caught)
    def test_unrelated_exception_is_not_swallowed(self) -> None:
        with self.assertRaises(ValueError):
            try:
                raise ValueError("Invalid value")
            except ResourceNotFoundTestError:
                pass
    def test_exception_chaining_preserves_cause(self) -> None:
        original = ValueError("Invalid port")
        try:
            try:
                raise original
            except ValueError as exc:
                raise ConfigurationTestError(
                    "Configuration loading failed"
                ) from exc
        except ConfigurationTestError as wrapped:
            self.assertIs(wrapped.__cause__, original)
            self.assertIsInstance(wrapped.__cause__, ValueError)
    def test_implicit_exception_context_is_preserved(self) -> None:
        try:
            try:
                raise OSError("File access failed")
            except OSError:
                raise DataSourceTestError("Unable to load data")
        except DataSourceTestError as wrapped:
            self.assertIsInstance(wrapped.__context__, OSError)
            self.assertFalse(wrapped.__suppress_context__)
    def test_raise_from_none_suppresses_displayed_context(self) -> None:
        try:
            try:
                raise ValueError("Internal detail")
            except ValueError:
                raise DataSourceTestError(
                    "Unable to load data"
                ) from None
        except DataSourceTestError as wrapped:
            self.assertIsNone(wrapped.__cause__)
            self.assertTrue(wrapped.__suppress_context__)
    def test_finally_runs_when_exception_is_raised(self) -> None:
        cleanup_ran = False
        try:
            try:
                raise RuntimeError("Simulated failure")
            finally:
                cleanup_ran = True
        except RuntimeError:
            pass
        self.assertTrue(cleanup_ran)
class TestExceptionSerialization(unittest.TestCase):
    """Verify safe conversion of exceptions into diagnostic data."""
    def test_exception_to_dict_includes_type_and_message(self) -> None:
        error = ValidationTestError("Invalid course identifier")
        result = exception_to_dict(error)
        self.assertEqual(
            result,
            {
                "message": "Invalid course identifier",
                "type": "ValidationTestError",
            },
        )
    def test_exception_to_dict_can_omit_type(self) -> None:
        error = DataSourceTestError("Dataset unavailable")
        result = exception_to_dict(error, include_type=False)
        self.assertEqual(
            result,
            {"message": "Dataset unavailable"},
        )
        self.assertNotIn("type", result)
    def test_exception_data_is_json_serializable(self) -> None:
        error = IntegrationTestError("Integration failed")
        serialized = json.dumps(exception_to_dict(error))
        restored = json.loads(serialized)
        self.assertEqual(restored["type"], "IntegrationTestError")
        self.assertEqual(restored["message"], "Integration failed")
    def test_empty_exception_message(self) -> None:
        error = MedOrbitsTestError()
        result = exception_to_dict(error)
        self.assertEqual(result["message"], "")
        self.assertEqual(result["type"], "MedOrbitsTestError")
class TestExceptionAssertions(unittest.TestCase):
    """Verify useful assertions for application error contracts."""
    def test_invalid_json_raises_json_decode_error(self) -> None:
        with self.assertRaises(json.JSONDecodeError):
            json.loads('{"invalid": }')
    def test_missing_dictionary_key_raises_key_error(self) -> None:
        data = {"application": "MedOrbits"}
        with self.assertRaises(KeyError):
            _ = data["missing_setting"]
    def test_invalid_type_raises_type_error(self) -> None:
        with self.assertRaises(TypeError):
            len(None)  # type: ignore[arg-type]
    def test_missing_file_raises_file_not_found_error(self) -> None:
        with self.assertRaises(FileNotFoundError):
            with open(
                "medorbits_nonexistent_test_file_928371.json",
                "r",
                encoding="utf-8",
            ):
                pass
if __name__ == "__main__":
    unittest.main(verbosity=2)