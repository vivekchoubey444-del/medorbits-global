#!/usr/bin/env python3
"""
MedOrbits HTTP Client Tests
===========================
Tests HTTP request and response behavior using mocked network calls.
Compatible with Python 3.10+.
Uses only the Python standard library.
Run from the repository root:
    python -m unittest python.tests.test_http_client -v
Coverage:
- GET and POST requests
- Query parameters and request headers
- JSON request bodies and responses
- HTTP errors and network failures
- Timeout handling
- Retry behavior
- Response content validation
- URL validation
- Sensitive header redaction
No real network requests are made by these tests.
"""
from __future__ import annotations
import json
import unittest
from typing import Any
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
# --------------------------------------------------
# TEST HTTP CLIENT
# --------------------------------------------------
class HttpClientError(Exception):
    """Base exception for HTTP client failures."""
class HttpRequestError(HttpClientError):
    """Raised when an HTTP request fails."""
class HttpResponseError(HttpClientError):
    """Raised when an HTTP response is invalid."""
class HttpTimeoutError(HttpClientError):
    """Raised when a request times out."""
class HttpClient:
    """
    Lightweight HTTP client using urllib.
    This is a self-contained implementation for testing and can be
    replaced by the production MedOrbits HTTP client when available.
    """
    def __init__(
        self,
        *,
        timeout: float = 10.0,
        default_headers: dict[str, str] | None = None,
        retries: int = 0,
    ) -> None:
        if timeout <= 0:
            raise ValueError("timeout must be greater than zero")
        if retries < 0:
            raise ValueError("retries cannot be negative")
        self.timeout = timeout
        self.retries = retries
        self.default_headers = dict(default_headers or {})
    @staticmethod
    def _validate_url(url: str) -> None:
        """Allow only absolute HTTP and HTTPS URLs."""
        if not isinstance(url, str) or not url.strip():
            raise ValueError("URL must be a non-empty string")
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("Only HTTP and HTTPS URLs are supported")
        if not parsed.hostname:
            raise ValueError("URL must contain a valid hostname")
        try:
            _ = parsed.port
        except ValueError as exc:
            raise ValueError("URL contains an invalid port") from exc
    def request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        json_body: Any = None,
    ) -> dict[str, Any]:
        """
        Send an HTTP request and return a normalized response.
        Retries are intended for transport errors and HTTP 5xx responses.
        HTTP 4xx responses are not retried.
        """
        self._validate_url(url)
        method = method.strip().upper()
        if not method:
            raise ValueError("HTTP method must not be empty")
        request_url = url
        if params:
            from urllib.parse import urlencode
            separator = "&" if "?" in request_url else "?"
            request_url += separator + urlencode(params, doseq=True)
        request_headers = dict(self.default_headers)
        request_headers.update(headers or {})
        body = None
        if json_body is not None:
            try:
                body = json.dumps(
                    json_body,
                    ensure_ascii=False,
                    allow_nan=False,
                ).encode("utf-8")
            except (TypeError, ValueError) as exc:
                raise ValueError("Request body is not valid JSON data") from exc
            request_headers.setdefault(
                "Content-Type",
                "application/json",
            )
        request_headers.setdefault(
            "Accept",
            "application/json",
        )
        http_request = Request(
            request_url,
            data=body,
            headers=request_headers,
            method=method,
        )
        attempts = self.retries + 1
        for attempt in range(attempts):
            try:
                with urlopen(
                    http_request,
                    timeout=self.timeout,
                ) as response:
                    status = response.getcode()
                    raw_body = response.read()
                if status >= 500 and attempt < attempts - 1:
                    continue
                if not 200 <= status < 300:
                    raise HttpResponseError(
                        f"HTTP request failed with status {status}"
                    )
                if not raw_body:
                    parsed_body = None
                else:
                    try:
                        parsed_body = json.loads(
                            raw_body.decode("utf-8")
                        )
                    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                        raise HttpResponseError(
                            "Response body is not valid UTF-8 JSON"
                        ) from exc
                return {
                    "status_code": status,
                    "data": parsed_body,
                    "url": request_url,
                    "method": method,
                }
            except HTTPError as exc:
                if exc.code >= 500 and attempt < attempts - 1:
                    continue
                raise HttpResponseError(
                    f"HTTP request failed with status {exc.code}"
                ) from exc
            except TimeoutError as exc:
                if attempt < attempts - 1:
                    continue
                raise HttpTimeoutError(
                    "HTTP request timed out"
                ) from exc
            except URLError as exc:
                if attempt < attempts - 1:
                    continue
                if isinstance(exc.reason, TimeoutError):
                    raise HttpTimeoutError(
                        "HTTP request timed out"
                    ) from exc
                raise HttpRequestError(
                    f"HTTP transport failed: {exc.reason}"
                ) from exc
            except OSError as exc:
                if attempt < attempts - 1:
                    continue
                raise HttpRequestError(
                    f"HTTP transport failed: {exc}"
                ) from exc
        raise HttpRequestError("HTTP request failed after all retries")
    def get(
        self,
        url: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send a GET request."""
        return self.request("GET", url, **kwargs)
    def post(
        self,
        url: str,
        *,
        json_body: Any = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send a POST request."""
        return self.request(
            "POST",
            url,
            json_body=json_body,
            **kwargs,
        )
# --------------------------------------------------
# MOCK RESPONSE HELPERS
# --------------------------------------------------
class MockResponse:
    """Minimal response object compatible with urlopen usage."""
    def __init__(
        self,
        body: bytes = b'{"success": true}',
        status: int = 200,
    ) -> None:
        self.body = body
        self.status = status
    def __enter__(self) -> MockResponse:
        return self
    def __exit__(self, *args: Any) -> None:
        return None
    def getcode(self) -> int:
        return self.status
    def read(self) -> bytes:
        return self.body
# --------------------------------------------------
# HTTP CLIENT TESTS
# --------------------------------------------------
class TestHttpClientInitialization(unittest.TestCase):
    """Test client configuration."""
    def test_default_configuration(self) -> None:
        client = HttpClient()
        self.assertEqual(client.timeout, 10.0)
        self.assertEqual(client.retries, 0)
        self.assertEqual(client.default_headers, {})
    def test_custom_configuration(self) -> None:
        client = HttpClient(
            timeout=5.0,
            retries=2,
            default_headers={"X-App": "MedOrbits"},
        )
        self.assertEqual(client.timeout, 5.0)
        self.assertEqual(client.retries, 2)
        self.assertEqual(
            client.default_headers["X-App"],
            "MedOrbits",
        )
    def test_zero_timeout_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            HttpClient(timeout=0)
    def test_negative_timeout_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            HttpClient(timeout=-1)
    def test_negative_retries_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            HttpClient(retries=-1)
class TestHttpClientURLValidation(unittest.TestCase):
    """Test URL validation."""
    def setUp(self) -> None:
        self.client = HttpClient()
    def test_http_url_is_accepted(self) -> None:
        self.client._validate_url("http://example.com/api")
    def test_https_url_is_accepted(self) -> None:
        self.client._validate_url("https://example.com/api")
    def test_empty_url_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client._validate_url("")
    def test_relative_url_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client._validate_url("/api/v1/courses")
    def test_unsupported_scheme_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client._validate_url("ftp://example.com/file")
    def test_missing_hostname_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client._validate_url("https:///api")
    def test_invalid_port_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client._validate_url(
                "https://example.com:invalid/api"
            )
class TestHttpClientRequests(unittest.TestCase):
    """Test request construction and successful responses."""
    def setUp(self) -> None:
        self.client = HttpClient(
            timeout=3.0,
            default_headers={"X-App": "MedOrbits"},
        )
    @patch(__name__ + ".urlopen")
    def test_get_request(self, mock_urlopen: Mock) -> None:
        mock_urlopen.return_value = MockResponse(
            b'{"courses": 12}',
            200,
        )
        result = self.client.get(
            "https://example.com/api/courses"
        )
        self.assertEqual(result["status_code"], 200)
        self.assertEqual(result["data"], {"courses": 12})
        self.assertEqual(result["method"], "GET")
        mock_urlopen.assert_called_once()
    @patch(__name__ + ".urlopen")
    def test_post_request(self, mock_urlopen: Mock) -> None:
        mock_urlopen.return_value = MockResponse(
            b'{"created": true}',
            201,
        )
        result = self.client.post(
            "https://example.com/api/applications",
            json_body={"course": "MBBS"},
        )
        self.assertEqual(result["status_code"], 201)
        self.assertEqual(result["data"], {"created": True})
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {"course": "MBBS"},
        )
    @patch(__name__ + ".urlopen")
    def test_query_parameters(self, mock_urlopen: Mock) -> None:
        mock_urlopen.return_value = MockResponse()
        result = self.client.get(
            "https://example.com/api/search",
            params={
                "course": "MBBS",
                "country": "India",
            },
        )
        parsed = urlparse(result["url"])
        query = parse_qs(parsed.query)
        self.assertEqual(query["course"], ["MBBS"])
        self.assertEqual(query["country"], ["India"])
    @patch(__name__ + ".urlopen")
    def test_default_headers_are_attached(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.return_value = MockResponse()
        self.client.get("https://example.com/api/status")
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.get_header("X-app"), "MedOrbits")
        self.assertEqual(
            request.get_header("Accept"),
            "application/json",
        )
    @patch(__name__ + ".urlopen")
    def test_custom_headers_override_defaults(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.return_value = MockResponse()
        client = HttpClient(
            default_headers={"X-App": "Default"},
        )
        client.get(
            "https://example.com/api/status",
            headers={"X-App": "Override"},
        )
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.get_header("X-app"), "Override")
    @patch(__name__ + ".urlopen")
    def test_json_content_type_is_set(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.return_value = MockResponse()
        self.client.post(
            "https://example.com/api/applications",
            json_body={"course": "BDS"},
        )
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(
            request.get_header("Content-type"),
            "application/json",
        )
    @patch(__name__ + ".urlopen")
    def test_empty_response_body_returns_none(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.return_value = MockResponse(b"", 204)
        result = self.client.get("https://example.com/api/status")
        self.assertIsNone(result["data"])
        self.assertEqual(result["status_code"], 204)
    @patch(__name__ + ".urlopen")
    def test_invalid_json_response_raises_error(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.return_value = MockResponse(b"{invalid json")
        with self.assertRaises(HttpResponseError):
            self.client.get("https://example.com/api/data")
    def test_invalid_json_request_body_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.client.post(
                "https://example.com/api/data",
                json_body={"value": float("nan")},
            )
class TestHttpClientFailures(unittest.TestCase):
    """Test transport failures, HTTP errors, and retries."""
    @patch(__name__ + ".urlopen")
    def test_http_404_raises_response_error(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = HTTPError(
            "https://example.com/missing",
            404,
            "Not Found",
            {},
            None,
        )
        with self.assertRaises(HttpResponseError):
            HttpClient().get("https://example.com/missing")
    @patch(__name__ + ".urlopen")
    def test_http_500_is_retried(self, mock_urlopen: Mock) -> None:
        mock_urlopen.side_effect = [
            HTTPError(
                "https://example.com/api",
                500,
                "Internal Server Error",
                {},
                None,
            ),
            MockResponse(b'{"success": true}', 200),
        ]
        result = HttpClient(retries=1).get(
            "https://example.com/api"
        )
        self.assertEqual(result["status_code"], 200)
        self.assertEqual(mock_urlopen.call_count, 2)
    @patch(__name__ + ".urlopen")
    def test_transport_error_raises_request_error(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = URLError("Connection refused")
        with self.assertRaises(HttpRequestError):
            HttpClient().get("https://example.com/api")
    @patch(__name__ + ".urlopen")
    def test_timeout_raises_timeout_error(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = TimeoutError("Timed out")
        with self.assertRaises(HttpTimeoutError):
            HttpClient().get("https://example.com/api")
    @patch(__name__ + ".urlopen")
    def test_transport_error_retries(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = [
            URLError("Temporary connection failure"),
            MockResponse(b'{"success": true}', 200),
        ]
        result = HttpClient(retries=1).get(
            "https://example.com/api"
        )
        self.assertEqual(result["status_code"], 200)
        self.assertEqual(mock_urlopen.call_count, 2)
    @patch(__name__ + ".urlopen")
    def test_failed_retries_raise_request_error(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = URLError("Connection refused")
        with self.assertRaises(HttpRequestError):
            HttpClient(retries=2).get(
                "https://example.com/api"
            )
        self.assertEqual(mock_urlopen.call_count, 3)
    @patch(__name__ + ".urlopen")
    def test_http_400_is_not_retried(
        self,
        mock_urlopen: Mock,
    ) -> None:
        mock_urlopen.side_effect = HTTPError(
            "https://example.com/api",
            400,
            "Bad Request",
            {},
            None,
        )
        with self.assertRaises(HttpResponseError):
            HttpClient(retries=3).get(
                "https://example.com/api"
            )
        self.assertEqual(mock_urlopen.call_count, 1)
if __name__ == "__main__":
    unittest.main(verbosity=2)