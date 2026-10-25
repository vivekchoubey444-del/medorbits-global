#!/usr/bin/env python3
"""
MedOrbits API Client
====================
Centralized API client for MedOrbits internal and external integrations.
Compatible with Python 3.10+.
Uses the standard library and the optional MedOrbits HttpClient module.
Features:
- Configurable API base URL
- GET, POST, PUT, PATCH, DELETE
- Query parameters and JSON payloads
- Bearer-token and API-key authentication
- Per-request headers
- Configurable timeout and retries
- Response validation
- Consistent API exceptions
- Safe error messages
- Optional host allowlisting
- Compatibility with python/integrations/http_client.py
Security:
- Use HTTPS for external APIs.
- Load credentials from environment variables or a secrets manager.
- Do not expose tokens in logs or exception messages.
- Do not automatically retry non-idempotent requests.
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
# --------------------------------------------------
# OPTIONAL SHARED HTTP CLIENT
# --------------------------------------------------
try:
    from python.integrations.http_client import (
        HttpClient as SharedHttpClient,
        HttpClientError as SharedHttpClientError,
        HttpConfigurationError as SharedHttpConfigurationError,
        HttpRequestError as SharedHttpRequestError,
        HttpResponseError as SharedHttpResponseError,
        HttpTimeoutError as SharedHttpTimeoutError,
        HttpResponseDecodeError as SharedHttpResponseDecodeError,
    )
    SHARED_HTTP_CLIENT_AVAILABLE = True
except ImportError:
    SharedHttpClient = None
    SharedHttpClientError = Exception
    SharedHttpConfigurationError = Exception
    SharedHttpRequestError = Exception
    SharedHttpResponseError = Exception
    SharedHttpTimeoutError = Exception
    SharedHttpResponseDecodeError = Exception
    SHARED_HTTP_CLIENT_AVAILABLE = False
# --------------------------------------------------
# EXCEPTIONS
# --------------------------------------------------
class APIClientError(Exception):
    """Base exception for API client failures."""
class APIConfigurationError(APIClientError):
    """Raised when API client configuration is invalid."""
class APIAuthenticationError(APIClientError):
    """Raised when the API rejects authentication."""
class APIPermissionError(APIClientError):
    """Raised when access to an API resource is denied."""
class APIRequestError(APIClientError):
    """Raised when a request fails."""
class APIResponseError(APIClientError):
    """Raised when an API response is unsuccessful or malformed."""
class APITimeoutError(APIRequestError):
    """Raised when an API request times out."""
# --------------------------------------------------
# RESPONSE MODEL
# --------------------------------------------------
@dataclass(frozen=True)
class APIResponse:
    """Normalized API response."""
    status_code: int
    data: Any
    headers: dict[str, str]
    url: str
    method: str
    elapsed_ms: float = 0.0
    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300
    def json(self) -> Any:
        """Return decoded response data."""
        return self.data
    def raise_for_status(self) -> None:
        """Raise an API exception for unsuccessful status codes."""
        if self.status_code in (401, 403):
            if self.status_code == 401:
                raise APIAuthenticationError(
                    "API authentication failed"
                )
            raise APIPermissionError(
                "API permission was denied"
            )
        if not self.ok:
            raise APIResponseError(
                f"API request failed with HTTP {self.status_code}"
            )
    def to_dict(self) -> dict[str, Any]:
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
# API CLIENT
# --------------------------------------------------
class APIClient:
    """
    Configurable client for JSON APIs.
    Uses the shared MedOrbits HttpClient when available.
    Otherwise, uses urllib from the Python standard library.
    """
    IDEMPOTENT_METHODS = {
        "GET",
        "HEAD",
        "OPTIONS",
        "PUT",
        "DELETE",
    }
    def __init__(
        self,
        base_url: str | None = None,
        *,
        timeout: float = 10.0,
        retries: int = 2,
        headers: Mapping[str, str] | None = None,
        bearer_token: str | None = None,
        api_key: str | None = None,
        api_key_header: str = "X-API-Key",
        allowed_hosts: set[str] | None = None,
        max_response_bytes: int = 10 * 1024 * 1024,
    ) -> None:
        if timeout <= 0:
            raise APIConfigurationError(
                "timeout must be greater than zero"
            )
        if retries < 0:
            raise APIConfigurationError(
                "retries cannot be negative"
            )
        if max_response_bytes <= 0:
            raise APIConfigurationError(
                "max_response_bytes must be positive"
            )
        self.base_url = self._validate_base_url(
            base_url
            or os.environ.get("MEDORBITS_API_BASE_URL")
        )
        self.timeout = float(timeout)
        self.retries = int(retries)
        self.max_response_bytes = int(max_response_bytes)
        self._closed = False
        self.headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": "MedOrbits-API-Client/1.0",
        }
        if headers:
            for name, value in headers.items():
                self._validate_header(name, value)
                self.headers[name] = value
        if bearer_token:
            self.headers["Authorization"] = (
                f"Bearer {bearer_token}"
            )
        if api_key:
            self._validate_header(api_key_header, api_key)
            self.headers[api_key_header] = api_key
        self.allowed_hosts = (
            {host.lower().rstrip(".") for host in allowed_hosts}
            if allowed_hosts is not None
            else None
        )
        if self.allowed_hosts is not None and not self.allowed_hosts:
            raise APIConfigurationError(
                "allowed_hosts cannot be empty"
            )
        self._shared_client = None
        if SHARED_HTTP_CLIENT_AVAILABLE:
            try:
                self._shared_client = SharedHttpClient(
                    base_url=self.base_url,
                    timeout=self.timeout,
                    retries=self.retries,
                    headers=self.headers,
                    allowed_hosts=self.allowed_hosts,
                    max_response_bytes=self.max_response_bytes,
                )
            except Exception as exc:
                raise APIConfigurationError(
                    "Failed to initialize the shared HTTP client"
                ) from exc
    # --------------------------------------------------
    # VALIDATION
    # --------------------------------------------------
    @staticmethod
    def _validate_header(name: str, value: str) -> None:
        if not isinstance(name, str) or not name.strip():
            raise APIConfigurationError(
                "Header name must not be empty"
            )
        if not isinstance(value, str):
            raise APIConfigurationError(
                f"Header {name!r} value must be a string"
            )
        if any(char in name + value for char in "\r\n"):
            raise APIConfigurationError(
                "Header names and values cannot contain newlines"
            )
    @staticmethod
    def _validate_base_url(url: str | None) -> str | None:
        if url is None:
            return None
        APIClient._validate_url(url)
        parsed = urlparse(url)
        if parsed.query or parsed.fragment:
            raise APIConfigurationError(
                "base_url cannot contain a query or fragment"
            )
        return url.rstrip("/") + "/"
    @staticmethod
    def _validate_url(url: str) -> None:
        if not isinstance(url, str) or not url.strip():
            raise APIConfigurationError(
                "URL must not be empty"
            )
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise APIConfigurationError(
                "Only HTTP and HTTPS URLs are supported"
            )
        if not parsed.hostname:
            raise APIConfigurationError(
                "URL must contain a hostname"
            )
        if parsed.username or parsed.password:
            raise APIConfigurationError(
                "Credentials in URLs are not allowed"
            )
        try:
            _ = parsed.port
        except ValueError as exc:
            raise APIConfigurationError(
                "URL contains an invalid port"
            ) from exc
    def _resolve_url(self, endpoint: str) -> str:
        if not isinstance(endpoint, str) or not endpoint.strip():
            raise APIConfigurationError(
                "Endpoint must not be empty"
            )
        parsed = urlparse(endpoint)
        if self.base_url:
            if parsed.scheme or parsed.netloc:
                raise APIConfigurationError(
                    "Absolute endpoint URLs are not allowed "
                    "when base_url is configured"
                )
            url = urljoin(
                self.base_url,
                endpoint.lstrip("/"),
            )
        else:
            url = endpoint
        self._validate_url(url)
        hostname = (urlparse(url).hostname or "").lower().rstrip(".")
        if (
            self.allowed_hosts is not None
            and hostname not in self.allowed_hosts
        ):
            raise APIConfigurationError(
                "Endpoint host is not in the configured allowlist"
            )
        return url
    # --------------------------------------------------
    # REQUEST HANDLING
    # --------------------------------------------------
    def request(
        self,
        method: str,
        endpoint: str,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        json_body: Any = None,
        data: bytes | str | None = None,
        timeout: float | None = None,
        retries: int | None = None,
        retry_non_idempotent: bool = False,
        expected_json: bool = True,
    ) -> APIResponse:
        if self._closed:
            raise APIRequestError("API client is closed")
        method = method.strip().upper()
        if not method:
            raise APIConfigurationError(
                "HTTP method must not be empty"
            )
        request_timeout = self.timeout if timeout is None else timeout
        retry_count = self.retries if retries is None else retries
        if request_timeout <= 0 or retry_count < 0:
            raise APIConfigurationError(
                "Invalid timeout or retry count"
            )
        url = self._resolve_url(endpoint)
        if params:
            query = urlencode(params, doseq=True)
            url += ("&" if "?" in url else "?") + query
        request_headers = dict(self.headers)
        if headers:
            for name, value in headers.items():
                self._validate_header(name, value)
                request_headers[name] = value
        if json_body is not None and data is not None:
            raise APIConfigurationError(
                "Use either json_body or data, not both"
            )
        body: bytes | None = None
        if json_body is not None:
            try:
                body = json.dumps(
                    json_body,
                    ensure_ascii=False,
                    allow_nan=False,
                ).encode("utf-8")
            except (TypeError, ValueError) as exc:
                raise APIConfigurationError(
                    "Request body cannot be encoded as JSON"
                ) from exc
            request_headers.setdefault(
                "Content-Type",
                "application/json",
            )
        elif data is not None:
            if isinstance(data, str):
                body = data.encode("utf-8")
            elif isinstance(data, bytes):
                body = data
            else:
                raise APIConfigurationError(
                    "data must be a string or bytes"
                )
        if self._shared_client is not None:
            return self._request_with_shared_client(
                method,
                endpoint,
                params=params,
                headers=headers,
                json_body=json_body,
                data=data,
                timeout=request_timeout,
                retries=retry_count,
                retry_non_idempotent=retry_non_idempotent,
                expected_json=expected_json,
            )
        return self._request_with_urllib(
            method,
            url,
            request_headers,
            body,
            timeout=float(request_timeout),
            retries=retry_count,
            retry_non_idempotent=retry_non_idempotent,
            expected_json=expected_json,
        )
    def _request_with_shared_client(
        self,
        method: str,
        endpoint: str,
        **kwargs: Any,
    ) -> APIResponse:
        try:
            response = self._shared_client.request(
                method,
                endpoint,
                **kwargs,
            )
        except SharedHttpTimeoutError as exc:
            raise APITimeoutError("API request timed out") from exc
        except SharedHttpResponseDecodeError as exc:
            raise APIResponseError(
                "API returned an invalid response body"
            ) from exc
        except SharedHttpResponseError as exc:
            message = str(exc)
            if "401" in message:
                raise APIAuthenticationError(
                    "API authentication failed"
                ) from exc
            if "403" in message:
                raise APIPermissionError(
                    "API permission was denied"
                ) from exc
            raise APIResponseError(
                "API request returned an unsuccessful response"
            ) from exc
        except SharedHttpRequestError as exc:
            raise APIRequestError(
                "API transport request failed"
            ) from exc
        except SharedHttpClientError as exc:
            raise APIRequestError(
                "Shared HTTP client failed"
            ) from exc
        return APIResponse(
            status_code=response.status_code,
            data=response.data,
            headers=dict(response.headers),
            url=response.url,
            method=response.method,
            elapsed_ms=response.elapsed_ms,
        )
    def _request_with_urllib(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        body: bytes | None,
        *,
        timeout: float,
        retries: int,
        retry_non_idempotent: bool,
        expected_json: bool,
    ) -> APIResponse:
        import socket
        import time
        import random
        from http.client import HTTPException
        from urllib.error import HTTPError, URLError
        from urllib.request import Request, urlopen
        retryable_methods = {
            "GET", "HEAD", "OPTIONS", "PUT", "DELETE"
        }
        can_retry = (
            method in retryable_methods
            or retry_non_idempotent
        )
        attempts = retries + 1 if can_retry else 1
        for attempt in range(attempts):
            started = time.monotonic()
            request = Request(
                url,
                data=body,
                headers=headers,
                method=method,
            )
            try:
                with urlopen(request, timeout=timeout) as response:
                    status = response.getcode()
                    response_headers = dict(response.headers.items())
                    raw = response.read(self.max_response_bytes + 1)
                if len(raw) > self.max_response_bytes:
                    raise APIResponseError(
                        "API response exceeds the configured size limit"
                    )
                if not 200 <= status < 300:
                    raise APIResponseError(
                        f"API request failed with HTTP {status}"
                    )
                if not raw:
                    parsed: Any = None
                elif expected_json:
                    try:
                        parsed = json.loads(raw.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                        raise APIResponseError(
                            "API response is not valid UTF-8 JSON"
                        ) from exc
                else:
                    parsed = raw
                return APIResponse(
                    status_code=status,
                    data=parsed,
                    headers=response_headers,
                    url=url,
                    method=method,
                    elapsed_ms=round(
                        (time.monotonic() - started) * 1000,
                        2,
                    ),
                )
            except HTTPError as exc:
                if (
                    exc.code in {408, 429, 500, 502, 503, 504}
                    and attempt < attempts - 1
                ):
                    time.sleep(
                        min(5.0, 0.25 * (2 ** attempt))
                        + random.uniform(0, 0.05)
                    )
                    continue
                if exc.code == 401:
                    raise APIAuthenticationError(
                        "API authentication failed"
                    ) from exc
                if exc.code == 403:
                    raise APIPermissionError(
                        "API permission was denied"
                    ) from exc
                raise APIResponseError(
                    f"API request failed with HTTP {exc.code}"
                ) from exc
            except (URLError, TimeoutError, socket.timeout, OSError, HTTPException) as exc:
                if attempt < attempts - 1:
                    time.sleep(
                        min(5.0, 0.25 * (2 ** attempt))
                        + random.uniform(0, 0.05)
                    )
                    continue
                reason = getattr(exc, "reason", None)
                if isinstance(exc, (TimeoutError, socket.timeout)) or isinstance(
                    reason, (TimeoutError, socket.timeout)
                ):
                    raise APITimeoutError(
                        "API request timed out"
                    ) from exc
                raise APIRequestError(
                    f"API transport failed: {type(exc).__name__}"
                ) from exc
        raise APIRequestError("API request failed after retries")
    # --------------------------------------------------
    # HTTP METHODS
    # --------------------------------------------------
    def get(self, endpoint: str, **kwargs: Any) -> APIResponse:
        return self.request("GET", endpoint, **kwargs)
    def post(self, endpoint: str, **kwargs: Any) -> APIResponse:
        return self.request("POST", endpoint, **kwargs)
    def put(self, endpoint: str, **kwargs: Any) -> APIResponse:
        return self.request("PUT", endpoint, **kwargs)
    def patch(self, endpoint: str, **kwargs: Any) -> APIResponse:
        return self.request("PATCH", endpoint, **kwargs)
    def delete(self, endpoint: str, **kwargs: Any) -> APIResponse:
        return self.request("DELETE", endpoint, **kwargs)
    # --------------------------------------------------
    # LIFECYCLE
    # --------------------------------------------------
    def close(self) -> None:
        self._closed = True
        if self._shared_client is not None:
            self._shared_client.close()
    def __enter__(self) -> APIClient:
        if self._closed:
            raise APIRequestError("API client is closed")
        return self
    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()
# --------------------------------------------------
# FACTORY
# --------------------------------------------------
def create_api_client(**kwargs: Any) -> APIClient:
    """Create a configured MedOrbits API client."""
    return APIClient(**kwargs)
__all__ = [
    "APIClient",
    "APIResponse",
    "APIClientError",
    "APIConfigurationError",
    "APIAuthenticationError",
    "APIPermissionError",
    "APIRequestError",
    "APIResponseError",
    "APITimeoutError",
    "create_api_client",
    "SHARED_HTTP_CLIENT_AVAILABLE",
]