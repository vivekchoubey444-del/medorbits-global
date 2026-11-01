
“””
MEDORBITS — LOCAL AGENT API ENGINE
File: /local-agent/API_agent.py

Purpose:
    Central API communication layer for MedOrbits Local Agent.

Features:
    - Async HTTP requests
    - Centralized API configuration
    - Authentication support
    - Request timeout and retry
    - Secure API key handling
    - JSON response validation
    - Health checks
    - Education and admission APIs
    - Job and career APIs
    - AI provider integration
    - Structured logging
    - Error handling

Requirements:
    Python >= 3.10
“””

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin

import httpx


# ============================================================
# CONFIGURATION
# ============================================================

@dataclass(frozen=True)
class APIConfig:
    base_url: str
    api_key: str | None = None
    timeout: float = 20.0
    max_retries: int = 3
    retry_delay: float = 1.0
    verify_ssl: bool = True

    @classmethod
    def from_environment(cls) -> “APIConfig”:
        base_url = os.getenv(
            “MEDORBITS_API_URL”,
            “https://medorbits.in/api/“
        )

        return cls(
            base_url=base_url.rstrip(“/“) + “/“,
            api_key=os.getenv(“MEDORBITS_API_KEY”),
            timeout=float(os.getenv(“API_TIMEOUT”, “20”)),
            max_retries=int(os.getenv(“API_MAX_RETRIES”, “3”)),
            retry_delay=float(os.getenv(“API_RETRY_DELAY”, “1”)),
            verify_ssl=os.getenv(
                “API_VERIFY_SSL”, “true”
            ).lower() == “true”
        )


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(“medorbits.local_agent.api”)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            “%(asctime)s | %(levelname)s | %(name)s | %(message)s”
        )
    )
    logger.addHandler(handler)

logger.setLevel(
    os.getenv(“LOG_LEVEL”, “INFO”).upper()
)


# ============================================================
# API EXCEPTIONS
# ============================================================

class APIError(Exception):
    “””Base API exception.”””


class APIConnectionError(APIError):
    “””Connection failure.”””


class APIAuthenticationError(APIError):
    “””Authentication failure.”””


class APIRateLimitError(APIError):
    “””API rate limit exceeded.”””


class APIResponseError(APIError):
    “””Invalid or unsuccessful API response.”””


# ============================================================
# API CLIENT
# ============================================================

class MedOrbitsAPI:

    RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}

    def __init__(self, config: APIConfig | None = None):
        self.config = config or APIConfig.from_environment()

        if not self.config.base_url.startswith((“https://“, “http://“)):
            raise ValueError(“Invalid API base URL.”)

        if self.config.timeout <= 0:
            raise ValueError(“API timeout must be positive.”)

        if self.config.max_retries < 0:
            raise ValueError(“max_retries cannot be negative.”)

        if self.config.retry_delay < 0:
            raise ValueError(“retry_delay cannot be negative.”)

        self.client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.close()

    async def connect(self):
        if self.client is not None:
            return

        headers = {
            “Accept”: “application/json”,
            “Content-Type”: “application/json”,
            “User-Agent”: “MedOrbits-Local-Agent/1.0”
        }

        if self.config.api_key:
            headers[“Authorization”] = (
                f”Bearer {self.config.api_key}”
            )

        self.client = httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(self.config.timeout),
            verify=self.config.verify_ssl,
            follow_redirects=False,
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10
            )
        )

    async def close(self):
        if self.client is not None:
            await self.client.aclose()
            self.client = None

    def _build_url(self, endpoint: str) -> str:
        endpoint = endpoint.lstrip(“/“)

        if “://“ in endpoint:
            raise ValueError(“Absolute endpoint URLs are not allowed.”)

        return urljoin(self.config.base_url, endpoint)

    async def request(
        self,
        method: str,
        endpoint: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | list[Any] | None = None,
        data: Any = None,
        headers: dict[str, str] | None = None,
        require_json: bool = True
    ) -> Any:

        if self.client is None:
            await self.connect()

        url = self._build_url(endpoint)
        method = method.upper()

        if method not in {“GET”, “POST”, “PUT”, “PATCH”, “DELETE”}:
            raise ValueError(“Unsupported HTTP method.”)

        for attempt in range(self.config.max_retries + 1):
            started = time.monotonic()

            try:
                response = await self.client.request(
                    method,
                    url,
                    params=params,
                    json=json,
                    data=data,
                    headers=headers
                )

                elapsed = time.monotonic() - started

                logger.info(
                    “API %s completed in %.3fs”,
                    method,
                    elapsed
                )

                if response.status_code in self.RETRYABLE_STATUS_CODES:
                    if attempt < self.config.max_retries:
                        delay = min(
                            self.config.retry_delay * (2 ** attempt),
                            15
                        )
                        await asyncio.sleep(delay)
                        continue

                if response.status_code in (401, 403):
                    raise APIAuthenticationError(
                        “API authentication failed.”
                    )

                if response.status_code == 429:
                    raise APIRateLimitError(
                        “API rate limit exceeded.”
                    )

                if not response.is_success:
                    raise APIResponseError(
                        f”API returned HTTP {response.status_code}.”
                    )

                if response.status_code == 204:
                    return None

                if require_json:
                    try:
                        return response.json()
                    except ValueError as exc:
                        raise APIResponseError(
                            “API returned invalid JSON.”
                        ) from exc

                return response.text

            except (
                APIAuthenticationError,
                APIRateLimitError,
                APIResponseError
            ):
                raise

            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                if attempt >= self.config.max_retries:
                    logger.error(“API connection failed.”)
                    raise APIConnectionError(
                        “Unable to connect to MedOrbits API.”
                    ) from exc

                delay = min(
                    self.config.retry_delay * (2 ** attempt),
                    15
                )
                await asyncio.sleep(delay)

        raise APIConnectionError(“API request exhausted retries.”)

    # ========================================================
    # HTTP METHODS
    # ========================================================

    async def get(self, endpoint: str, **kwargs):
        return await self.request(“GET”, endpoint, **kwargs)

    async def post(self, endpoint: str, payload=None, **kwargs):
        return await self.request(
            “POST”, endpoint, json=payload, **kwargs
        )

    async def put(self, endpoint: str, payload=None, **kwargs):
        return await self.request(
            “PUT”, endpoint, json=payload, **kwargs
        )

    async def patch(self, endpoint: str, payload=None, **kwargs):
        return await self.request(
            “PATCH”, endpoint, json=payload, **kwargs
        )

    async def delete(self, endpoint: str, **kwargs):
        return await self.request(“DELETE”, endpoint, **kwargs)

    # ========================================================
    # HEALTH CHECK
    # ========================================================

    async def health_check(self):
        try:
            result = await self.get(
                “health”,
                require_json=True
            )

            return {
                “service”: “MedOrbits API”,
                “status”: “healthy”,
                “response”: result
            }

        except APIError as exc:
            return {
                “service”: “MedOrbits API”,
                “status”: “unavailable”,
                “error”: str(exc)
            }

    # ========================================================
    # EDUCATION SERVICES
    # ========================================================

    async def get_courses(self, params=None):
        return await self.get(“courses”, params=params)

    async def get_colleges(self, params=None):
        return await self.get(“colleges”, params=params)

    async def get_universities(self, params=None):
        return await self.get(“universities”, params=params)

    async def get_scholarships(self, params=None):
        return await self.get(“scholarships”, params=params)

    async def get_admission_process(self, params=None):
        return await self.get(“admission-process”, params=params)

    async def get_entrance_exams(self, params=None):
        return await self.get(“entrance-exams”, params=params)

    async def get_fees(self, params=None):
        return await self.get(“fees”, params=params)

    # ========================================================
    # JOB AND CAREER SERVICES
    # ========================================================

    async def get_jobs(self, params=None):
        return await self.get(“jobs”, params=params)

    async def get_career_options(self, params=None):
        return await self.get(“career-options”, params=params)

    async def get_recruitment_services(self, params=None):
        return await self.get(“services/recruitment”, params=params)

    # ========================================================
    # SEARCH SERVICES
    # ========================================================

    async def search(self, query: str, category: str | None = None):
        if not query.strip():
            raise ValueError(“Search query cannot be empty.”)

        return await self.get(
            “search”,
            params={
                “q”: query.strip(),
                “category”: category
            }
        )

    # ========================================================
    # AI SERVICES
    # ========================================================

    async def ask_ai(
        self,
        message: str,
        conversation_id: str | None = None
    ):
        if not message.strip():
            raise ValueError(“Message cannot be empty.”)

        return await self.post(
            “agent/chat”,
            {
                “message”: message.strip(),
                “conversation_id”: conversation_id
            }
        )


# ============================================================
# CONVENIENCE ENTRY POINT
# ============================================================

async def get_api_health():
    async with MedOrbitsAPI() as api:
        return await api.health_check()


async def main():
    result = await get_api_health()
    print(result)


if __name__ == “__main__”:
    asyncio.run(main())
