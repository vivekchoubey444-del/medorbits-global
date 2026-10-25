#!/usr/bin/env python3
"""
MedOrbits HTTP Client
=====================
Reusable HTTP client for MedOrbits integrations and external APIs.
Compatible with Python 3.10+.
Uses only the Python standard library.
Features:
- GET, POST, PUT, PATCH, and DELETE
- JSON request and response handling
- Query parameters and custom headers
- Bearer-token authentication
- Configurable request timeouts
- Bounded retries with exponential backoff
- HTTP and transport error normalization
- Safe response metadata
- Optional host allowlisting
- Context-manager support
Example:
    from python.integrations.http_client import HttpClient
    with HttpClient(
        base_url="https://api.example.com",
        timeout=10,
        retries=2,
    ) as client:
        result = client.get("/v1/status")
        print(result.data)
Security:
- HTTPS is recommended for external APIs.
- Do not place secrets in URLs.
- Do not automatically retry non-idempotent requests.
- Never disable TLS certificate verification in production.
"""
from __future__ import annotations
import json
import random
import socket
import ssl
import time
from dataclasses import dataclass, field
from email.message import Message
from http.client import HTTPException
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse, urlunparse
from urllib.request import (
    HTTPHandler,
    HTTPSHandler,
    Request,
    build_opener,
)
# --------------------------------------------------
# EXCEPTIONS
# --------------------------------------------------
class HttpClientError(Exception):
    """Base exception for HTTP client errors."""
class HttpConfigurationError(HttpClientError):
    """Raised for invalid HTTP client configuration."""
class HttpRequestError(HttpClientError):
    """Raised when a request fails at the transport layer."""
class HttpTimeoutError(HttpRequestError):
    """Raised when a request times out."""
class HttpResponseError(HttpClientError):
    """Raised when the server returns an unsuccessful status."""
class HttpResponseDecodeError(HttpResponseError):
    """Raised when a response cannot be decoded as expected."""
# --------------------------------------------------
# RESPONSE MODEL
# --------------------------------------------------
@dataclass(frozen=True)
class HttpResponse:
    """Normalized HTTP response."""
    status_code: int
    data: Any
    headers: dict[str, str] = field(default_factory=dict)
    url: str = ""
    method: str = ""
    elapsed_ms: float = 0.0
    @property
    def ok(self) -> bool:
        """Whether the response status is successful."""
        return 200 <= self.status_code < 300
    @property
    def is_empty(self) -> bool:
        """Whether the decoded response body is empty."""
        return self.data is None
    def raise_for_status(self) -> None:
        """Raise an exception for unsuccessful HTTP status codes."""
        if not self.ok:
            raise HttpResponseError(
                f"HTTP {self.status_code} for {self.method} request"
            )
    def json(self) -> Any:
        """Return already-decoded response data."""
        return self.data
    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-compatible response representation."""
        return {
            "status_code": self.status_code,
            "ok": self.ok,
            "data": self.data,
            "headers": dict(self.headers),
            "url": self.url,
            "method": self.method,
            "elapsed_ms": self.elapsed_ms,
        }
# --------------------------------------------------
# HTTP CLIENT
# --------------------------------------------------
class HttpClient:
    """Configurable HTTP client for MedOrbits API integrations."""
    IDEMPOTENT_METHODS = {
        "GET",
        "HEAD",
        "OPTIONS",
        "PUT",
        "DELETE",
    }
    RETRYABLE_STATUSES = {
        408,
        429,
        500,
        502,
        503,
        504,
    }
    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout: float = 10.0,
        retries: int = 2,
        backoff_factor: float = 0.25,
        max_backoff: float = 5.0,
        headers: Mapping[str, str] | None = None,
        bearer_token: str | None = None,
        user_agent: str = "MedOrbits-HTTP-Client/1.0",
        allowed_hosts: set[str] | None = None,
        max_response_bytes: int = 10 * 1024 * 1024,
        verify_tls: bool = True,
    ) -> None:
        if timeout <= 0:
            raise HttpConfigurationError(
                "timeout must be greater than zero"
            )
        if retries < 0:
            raise HttpConfigurationError(
                "retries cannot be negative"
            )
        if backoff_factor < 0 or max_backoff < 0:
            raise HttpConfigurationError(
                "Backoff values cannot be negative"
            )
        if max_response_bytes <= 0:
            raise HttpConfigurationError(
                "max_response_bytes must be positive"
            )
        if not user_agent.strip():
            raise HttpConfigurationError(
                "user_agent must not be empty"
            )
        self.base_url = self._validate_base_url(base_url)
        self.timeout = float(timeout)
        self.retries = int(retries)
        self.backoff_factor = float(backoff_factor)
        self.max_backoff = float(max_backoff)
        self.max_response_bytes = int(max_response_bytes)
        self.verify_tls = bool(verify_tls)
        self._closed = False
        self.headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": user_agent,
        }
        if headers:
            for key, value in headers.items():
                self._validate_header(key, value)
                self.headers[key] = value
        if bearer_token:
            self.headers["Authorization"] = (
                f"Bearer {bearer_token}"
            )
        self.allowed_hosts = (
            {host.lower().rstrip(".") for host in allowed_hosts}
            if allowed_hosts is not None
            else None
        )
        if self.allowed_hosts is not None and not self.allowed_hosts:
            raise HttpConfigurationError(
                "allowed_hosts cannot be empty when specified"
            )
        if self.base_url:
            self._check_allowed_host(self.base_url)
        handlers = [HTTPHandler()]
        if self.verify_tls:
            handlers.append(HTTPSHandler(context=ssl.create_default_context()))
        else:
            # Explicit opt-out; never recommended for production.
            handlers.append(
                HTTPSHandler(
                    context=ssl._create_unverified_context()
                )
            )
        self._opener = build_opener(*handlers)
    # --------------------------------------------------
    # CONFIGURATION VALIDATION
    # --------------------------------------------------
    @staticmethod
    def _validate_base_url(
        base_url: str | None,
    ) -> str | None:
        if base_url is None:
            return None
        HttpClient._validate_url(base_url)
        parsed = urlparse(base_url)
        if parsed.query or parsed.fragment:
            raise HttpConfigurationError(
                "base_url must not contain a query or fragment"
            )
        return base_url.rstrip("/") + "/"
    @staticmethod
    def _validate_url(url: str) -> None:
        if not isinstance(url, str) or not url.strip():
            raise HttpConfigurationError(
                "URL must be a non-empty string"
            )
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise HttpConfigurationError(
                "Only HTTP and HTTPS URLs are supported"
            )
        if not parsed.hostname:
            raise HttpConfigurationError(
                "URL must contain a hostname"
            )
        if parsed.username or parsed.password:
            raise HttpConfigurationError(
                "Credentials in URLs are not permitted"
            )
        try:
            _ = parsed.port
        except ValueError as exc:
            raise HttpConfigurationError(
                "URL contains an invalid port"
            ) from exc
    @staticmethod
    def _validate_header(key: str, value: str) -> None:
        if not isinstance(key, str) or not key.strip():
            raise HttpConfigurationError(
                "Header name must not be empty"
            )
        if not isinstance(value, str):
            raise HttpConfigurationError(
                f"Header {key!r} value must be a string"
            )
        if any(character in key + value for character in "\r\n"):
            raise HttpConfigurationError(
                "Header names and values cannot contain newlines"
            )
    def _check_allowed_host(self, url: str) -> None:
        if self.allowed_hosts is None:
            return
        hostname = (urlparse(url).hostname or "").lower().rstrip(".")
        if hostname not in self.allowed_hosts:
            raise HttpConfigurationError(
                "Request host is not in the configured allowlist"
            )
    def _resolve_url(self, path: str) -> str:
        if not isinstance(path, str) or not path.strip():
            raise HttpConfigurationError(
                "Request path must not be empty"
            )
        if self.base_url:
            # Do not allow a supplied absolute URL to override the
            # configured base URL.
            parsed = urlparse(path)
            if parsed.scheme or parsed.netloc:
                raise HttpConfigurationError(
                    "Absolute request URLs are not allowed "
                    "when base_url is configured"
                )
            url = urljoin(self.base_url, path.lstrip("/"))
        else:
            url = path
        self._validate_url(url)
        self._check_allowed_host(url)
        return url
    # --------------------------------------------------
    # REQUEST HELPERS
    # --------------------------------------------------
    @staticmethod
    def _encode_json(data: Any) -> bytes:
        try:
            return json.dumps(
                data,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            ).encode("utf-8")
        except (TypeError, ValueError) as exc:
            raise HttpConfigurationError(
                "Request body cannot be encoded as JSON"
            ) from exc
    @staticmethod
    def _safe_headers(headers: Any) -> dict[str, str]:
        if headers is None:
            return {}
        return {
            str(key): str(value)
            for key, value in headers.items()
        }
    @staticmethod
    def _is_timeout_error(error: BaseException) -> bool:
        if isinstance(error, (TimeoutError, socket.timeout)):
            return True
        if isinstance(error, URLError):
            return HttpClient._is_timeout_error(error.reason)
        return False
    def _retry_delay(
        self,
        attempt: int,
        retry_after: str | None = None,
    ) -> float:
        """Calculate bounded exponential backoff with jitter."""
        delay = min(
            self.max_backoff,
            self.backoff_factor * (2 ** attempt),
        )
        # Numeric Retry-After values are supported. HTTP-date values
        # are intentionally ignored rather than parsed incorrectly.
        if retry_after:
            try:
                delay = min(
                    self.max_backoff,
                    max(delay, float(retry_after)),
                )
            except ValueError:
                pass
        return delay + random.uniform(0, min(0.1, delay * 0.1))
    def request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        json_body: Any = None,
        data: bytes | str | None = None,
        timeout: float | None = None,
        retries: int | None = None,
        retry_non_idempotent: bool = False,
        expected_json: bool = True,
    ) -> HttpResponse:
        """Send a request and return a normalized response."""
        if self._closed:
            raise HttpRequestError("HTTP client is closed")
        method = method.strip().upper()
        if not method:
            raise HttpConfigurationError(
                "HTTP method must not be empty"
            )
        request_timeout = self.timeout if timeout is None else timeout
        retry_count = self.retries if retries is None else retries
        if request_timeout <= 0:
            raise HttpConfigurationError(
                "timeout must be greater than zero"
            )
        if retry_count < 0:
            raise HttpConfigurationError(
                "retries cannot be negative"
            )
        url = self._resolve_url(path)
        if params:
            parsed = urlparse(url)
            query = urlencode(params, doseq=True)
            combined_query = (
                f"{parsed.query}&{query}"
                if parsed.query
                else query
            )
            url = urlunparse(
                parsed._replace(query=combined_query)
            )
        request_headers = dict(self.headers)
        if headers:
            for key, value in headers.items():
                self._validate_header(key, value)
                request_headers[key] = value
        if json_body is not None and data is not None:
            raise HttpConfigurationError(
                "Use either json_body or data, not both"
            )
        body: bytes | None = None
        if json_body is not None:
            body = self._encode_json(json_body)
            if not any(
                key.lower() == "content-type"
                for key in request_headers
            ):
                request_headers["Content-Type"] = "application/json"
        elif data is not None:
            if isinstance(data, str):
                body = data.encode("utf-8")
            elif isinstance(data, bytes):
                body = data
            else:
                raise HttpConfigurationError(
                    "data must be a string or bytes"
                )
        can_retry = (
            method in self.IDEMPOTENT_METHODS
            or retry_non_idempotent
        )
        attempts = retry_count + 1 if can_retry else 1
        last_error: BaseException | None = None
        for attempt in range(attempts):
            started = time.monotonic()
            request = Request(
                url,
                data=body,
                headers=request_headers,
                method=method,
            )
            try:
                with self._opener.open(
                    request,
                    timeout=float(request_timeout),
                ) as response:
                    status_code = response.getcode()
                    response_headers = self._safe_headers(
                        response.headers
                    )
                    raw_body = response.read(
                        self.max_response_bytes + 1
                    )
                elapsed_ms = round(
                    (time.monotonic() - started) * 1000,
                    2,
                )
                if len(raw_body) > self.max_response_bytes:
                    raise HttpResponseDecodeError(
                        "Response exceeds the configured size limit"
                    )
                if status_code in self.RETRYABLE_STATUSES:
                    if attempt < attempts - 1:
                        delay = self._retry_delay(
                            attempt,
                            response_headers.get("Retry-After"),
                        )
                        time.sleep(delay)
                        continue
                if not 200 <= status_code < 300:
                    raise HttpResponseError(
                        f"HTTP request failed with status {status_code}"
                    )
                if not raw_body:
                    response_data = None
                elif expected_json:
                    try:
                        response_data = json.loads(
                            raw_body.decode("utf-8")
                        )
                    except (
                        UnicodeDecodeError,
                        json.JSONDecodeError,
                    ) as exc:
                        raise HttpResponseDecodeError(
                            "Response body is not valid UTF-8 JSON"
                        ) from exc
                else:
                    response_data = raw_body
                return HttpResponse(
                    status_code=status_code,
                    data=response_data,
                    headers=response_headers,
                    url=url,
                    method=method,
                    elapsed_ms=elapsed_ms,
                )
            except HTTPError as exc:
                last_error = exc
                if (
                    exc.code in self.RETRYABLE_STATUSES
                    and attempt < attempts - 1
                ):
                    retry_after = exc.headers.get("Retry-After") if exc.headers else None
                    time.sleep(
                        self._retry_delay(attempt, retry_after)
                    )
                    continue
                raise HttpResponseError(
                    f"HTTP request failed with status {exc.code}"
                ) from exc
            except (URLError, TimeoutError, socket.timeout, OSError, HTTPException) as exc:
                last_error = exc
                if attempt < attempts - 1:
                    time.sleep(self._retry_delay(attempt))
                    continue
                if self._is_timeout_error(exc):
                    raise HttpTimeoutError(
                        "HTTP request timed out"
                    ) from exc
                raise HttpRequestError(
                    f"HTTP transport failed: {type(exc).__name__}"
                ) from exc
        if last_error is not None:
            raise HttpRequestError(
                "HTTP request failed after all retry attempts"
            ) from last_error
        raise HttpRequestError("HTTP request failed")
    # --------------------------------------------------
    # HTTP METHODS
    # --------------------------------------------------
    def get(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request("GET", path, **kwargs)
    def post(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request("POST", path, **kwargs)
    def put(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request("PUT", path, **kwargs)
    def patch(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request("PATCH", path, **kwargs)
    def delete(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request("DELETE", path, **kwargs)
    def head(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request(
            "HEAD",
            path,
            expected_json=False,
            **kwargs,
        )
    def options(self, path: str, **kwargs: Any) -> HttpResponse:
        return self.request(
            "OPTIONS",
            path,
            expected_json=False,
            **kwargs,
        )
    # --------------------------------------------------
    # LIFECYCLE
    # --------------------------------------------------
    def close(self) -> None:
        """Mark the client as closed."""
        self._closed = True
    def __enter__(self) -> HttpClient:
        if self._closed:
            raise HttpRequestError("HTTP client is closed")
        return self
    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()
# --------------------------------------------------
# FACTORY
# --------------------------------------------------
def create_http_client(**kwargs: Any) -> HttpClient:
    """Create a configured HTTP client."""
    return HttpClient(**kwargs)
__all__ = [
    "HttpClient",
    "HttpResponse",
    "HttpClientError",
    "HttpConfigurationError",
    "HttpRequestError",
    "HttpTimeoutError",
    "HttpResponseError",
    "HttpResponseDecodeError",
    "create_http_client",
]