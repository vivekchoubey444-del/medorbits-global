
“””
MEDORBITS — OFFLINE / ONLINE / HYBRID ENGINE
File: /local-agent/work_offline_online_both.py

Python >= 3.10

Features:
    - Online, offline and hybrid operating modes
    - Automatic connectivity detection
    - Persistent SQLite cache
    - Offline request queue
    - Automatic synchronization
    - Retry and timeout handling
    - Local data access
    - Online API integration
    - Graceful fallback
    - Async execution
    - Thread-safe SQLite access
    - Structured logging

Dependencies:
    httpx
“””

from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import time

from enum import Enum
from pathlib import Path
from typing import Any

import httpx


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = Path(
    os.getenv(“MEDORBITS_LOCAL_DATA”, BASE_DIR / “data”)
)

CACHE_DIR = DATA_DIR / “cache”
DATABASE_PATH = DATA_DIR / “offline_database.sqlite3”

API_BASE_URL = os.getenv(
    “MEDORBITS_API_URL”,
    “https://medorbits.in/api/“
).rstrip(“/“) + “/“

API_KEY = os.getenv(“MEDORBITS_API_KEY”)

CONNECTIVITY_TIMEOUT = 5.0
REQUEST_TIMEOUT = 20.0

CACHE_TTL = 86400
MAX_RETRIES = 3

SYNC_INTERVAL = 60

DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(“medorbits.local_agent.offline_online”)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            “%(asctime)s | %(levelname)s | %(message)s”
        )
    )
    logger.addHandler(handler)

logger.setLevel(logging.INFO)


# ============================================================
# OPERATING MODES
# ============================================================

class OperatingMode(str, Enum):

    ONLINE = “online”
    OFFLINE = “offline”
    HYBRID = “hybrid”


class ConnectionStatus(str, Enum):

    CONNECTED = “connected”
    DISCONNECTED = “disconnected”
    UNKNOWN = “unknown”


# ============================================================
# EXCEPTIONS
# ============================================================

class OfflineError(Exception):
    pass


class SynchronizationError(Exception):
    pass


class CacheError(Exception):
    pass


# ============================================================
# SQLITE STORAGE
# ============================================================

class OfflineDatabase:

    def __init__(self, database_path=DATABASE_PATH):

        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        self._initialize()

    def _connect(self):

        connection = sqlite3.connect(
            self.database_path,
            timeout=30
        )

        connection.row_factory = sqlite3.Row

        connection.execute(“PRAGMA journal_mode=WAL”)
        connection.execute(“PRAGMA foreign_keys=ON”)

        return connection

    def _initialize(self):

        with self._connect() as db:

            db.executescript(“””

                CREATE TABLE IF NOT EXISTS cache (

                    cache_key TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL

                );

                CREATE TABLE IF NOT EXISTS offline_queue (

                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    method TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    payload TEXT,
                    status TEXT DEFAULT ‘pending’,
                    attempts INTEGER DEFAULT 0,
                    created_at REAL NOT NULL,
                    last_error TEXT

                );

                CREATE INDEX IF NOT EXISTS
                idx_offline_queue_status
                ON offline_queue(status);

                CREATE TABLE IF NOT EXISTS metadata (

                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at REAL NOT NULL

                );

            “””)

    # ———————————————————
    # CACHE
    # ———————————————————

    def set_cache(
        self,
        key: str,
        value: Any,
        ttl: int = CACHE_TTL
    ):

        now = time.time()

        with self._connect() as db:

            db.execute(“””

                INSERT INTO cache (
                    cache_key,
                    payload,
                    created_at,
                    expires_at
                )

                VALUES (?, ?, ?, ?)

                ON CONFLICT(cache_key)
                DO UPDATE SET

                    payload = excluded.payload,
                    created_at = excluded.created_at,
                    expires_at = excluded.expires_at

            “””, (
                key,
                json.dumps(value),
                now,
                now + ttl
            ))

    def get_cache(self, key: str):

        with self._connect() as db:

            row = db.execute(“””

                SELECT payload, expires_at
                FROM cache
                WHERE cache_key = ?

            “””, (key,)).fetchone()

        if row is None:
            return None

        if row[“expires_at”] < time.time():
            return None

        return json.loads(row[“payload”])

    def clear_expired_cache(self):

        with self._connect() as db:

            db.execute(
                “DELETE FROM cache WHERE expires_at < ?”,
                (time.time(),)
            )

    # ———————————————————
    # OFFLINE QUEUE
    # ———————————————————

    def enqueue(
        self,
        method: str,
        endpoint: str,
        payload: Any = None
    ):

        with self._connect() as db:

            cursor = db.execute(“””

                INSERT INTO offline_queue (
                    method,
                    endpoint,
                    payload,
                    created_at
                )

                VALUES (?, ?, ?, ?)

            “””, (
                method.upper(),
                endpoint,
                json.dumps(payload) if payload is not None else None,
                time.time()
            ))

            return cursor.lastrowid

    def get_pending(self, limit: int = 50):

        with self._connect() as db:

            rows = db.execute(“””

                SELECT *
                FROM offline_queue

                WHERE status = ‘pending’

                ORDER BY id ASC
                LIMIT ?

            “””, (limit,)).fetchall()

        return [dict(row) for row in rows]

    def update_queue_status(
        self,
        item_id: int,
        status: str,
        error: str | None = None
    ):

        with self._connect() as db:

            db.execute(“””

                UPDATE offline_queue

                SET status = ?,
                    attempts = attempts + 1,
                    last_error = ?

                WHERE id = ?

            “””, (status, error, item_id))

    def set_metadata(self, key: str, value: Any):

        with self._connect() as db:

            db.execute(“””

                INSERT INTO metadata (key, value, updated_at)

                VALUES (?, ?, ?)

                ON CONFLICT(key)
                DO UPDATE SET

                    value = excluded.value,
                    updated_at = excluded.updated_at

            “””, (
                key,
                json.dumps(value),
                time.time()
            ))


# ============================================================
# CONNECTIVITY MONITOR
# ============================================================

class ConnectivityMonitor:

    def __init__(self):

        self.status = ConnectionStatus.UNKNOWN

    async def check(self) -> bool:

        try:

            async with httpx.AsyncClient(
                timeout=CONNECTIVITY_TIMEOUT,
                follow_redirects=False
            ) as client:

                response = await client.get(
                    API_BASE_URL + “health”
                )

                self.status = (
                    ConnectionStatus.CONNECTED
                    if response.is_success
                    else ConnectionStatus.DISCONNECTED
                )

                return response.is_success

        except httpx.HTTPError:

            self.status = ConnectionStatus.DISCONNECTED
            return False


# ============================================================
# ONLINE API ENGINE
# ============================================================

class OnlineEngine:

    def __init__(self):

        headers = {
            “Accept”: “application/json”,
            “Content-Type”: “application/json”
        }

        if API_KEY:
            headers[“Authorization”] = f”Bearer {API_KEY}”

        self.client = httpx.AsyncClient(
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            follow_redirects=False
        )

    async def request(
        self,
        method: str,
        endpoint: str,
        payload: Any = None
    ):

        if “://“ in endpoint:
            raise ValueError(“Absolute endpoint URLs are not allowed.”)

        url = API_BASE_URL + endpoint.lstrip(“/“)

        response = await self.client.request(
            method.upper(),
            url,
            json=payload
        )

        response.raise_for_status()

        if response.status_code == 204:
            return None

        return response.json()

    async def close(self):

        await self.client.aclose()


# ============================================================
# OFFLINE / ONLINE / HYBRID CONTROLLER
# ============================================================

class MedOrbitsOperatingEngine:

    def __init__(
        self,
        mode: OperatingMode = OperatingMode.HYBRID
    ):

        self.mode = OperatingMode(mode)

        self.database = OfflineDatabase()

        self.monitor = ConnectivityMonitor()

        self.online = OnlineEngine()

        self.is_online = False

        self._sync_lock = asyncio.Lock()

    async def initialize(self):

        self.database.clear_expired_cache()

        self.is_online = await self.monitor.check()

        logger.info(
            “Engine initialized | Mode: %s | Online: %s”,
            self.mode.value,
            self.is_online
        )

    # ———————————————————
    # MODE MANAGEMENT
    # ———————————————————

    async def set_mode(self, mode: OperatingMode):

        self.mode = OperatingMode(mode)

        if self.mode == OperatingMode.ONLINE:

            connected = await self.monitor.check()

            if not connected:
                raise OfflineError(
                    “Online mode requires API connectivity.”
                )

            self.is_online = True

        elif self.mode == OperatingMode.OFFLINE:

            self.is_online = False

        else:

            self.is_online = await self.monitor.check()

        return self.status()

    def status(self):

        return {
            “mode”: self.mode.value,
            “connection”: self.monitor.status.value,
            “online”: self.is_online,
            “database”: str(self.database.database_path)
        }

    # ———————————————————
    # REQUEST PROCESSOR
    # ———————————————————

    async def execute(
        self,
        method: str,
        endpoint: str,
        payload: Any = None,
        cache_key: str | None = None,
        cache_ttl: int = CACHE_TTL,
        queue_if_offline: bool = False
    ):

        method = method.upper()

        if method not in {“GET”, “POST”, “PUT”, “PATCH”, “DELETE”}:
            raise ValueError(“Unsupported HTTP method.”)

        if “://“ in endpoint:
            raise ValueError(“Absolute endpoint URLs are not allowed.”)

        if self.mode == OperatingMode.OFFLINE:

            return self._offline_request(
                method,
                endpoint,
                payload,
                cache_key,
                queue_if_offline
            )

        if self.mode == OperatingMode.HYBRID:

            self.is_online = await self.monitor.check()

            if not self.is_online:

                return self._offline_request(
                    method,
                    endpoint,
                    payload,
                    cache_key,
                    queue_if_offline
                )

        for attempt in range(MAX_RETRIES + 1):

            try:

                result = await self.online.request(
                    method,
                    endpoint,
                    payload
                )

                self.is_online = True

                if method == “GET” and cache_key:
                    self.database.set_cache(
                        cache_key,
                        result,
                        cache_ttl
                    )

                return {
                    “success”: True,
                    “source”: “online”,
                    “data”: result
                }

            except httpx.HTTPStatusError as exc:

                status_code = exc.response.status_code

                if status_code in {401, 403, 400, 404, 422}:
                    raise

                if attempt == MAX_RETRIES:
                    return self._offline_request(
                        method,
                        endpoint,
                        payload,
                        cache_key,
                        queue_if_offline
                    )

            except (httpx.TimeoutException, httpx.NetworkError):

                if attempt == MAX_RETRIES:
                    self.is_online = False

                    if self.mode == OperatingMode.ONLINE:
                        raise OfflineError(
                            “Online request failed.”
                        )

                    return self._offline_request(
                        method,
                        endpoint,
                        payload,
                        cache_key,
                        queue_if_offline
                    )

            await asyncio.sleep(min(2 ** attempt, 10))

    # ———————————————————
    # OFFLINE PROCESSING
    # ———————————————————

    def _offline_request(
        self,
        method,
        endpoint,
        payload,
        cache_key,
        queue_if_offline
    ):

        if method == “GET” and cache_key:

            cached = self.database.get_cache(cache_key)

            if cached is not None:

                return {
                    “success”: True,
                    “source”: “offline_cache”,
                    “data”: cached
                }

        if queue_if_offline and method in {
            “POST”, “PUT”, “PATCH”, “DELETE”
        }:

            queue_id = self.database.enqueue(
                method,
                endpoint,
                payload
            )

            return {
                “success”: True,
                “source”: “offline_queue”,
                “queued”: True,
                “queue_id”: queue_id,
                “message”: “Request saved for synchronization.”
            }

        return {
            “success”: False,
            “source”: “offline”,
            “error”: “Data unavailable offline.”,
            “data”: None
        }

    # ———————————————————
    # AUTOMATIC SYNCHRONIZATION
    # ———————————————————

    async def synchronize(self):

        if self.mode == OperatingMode.OFFLINE:
            return {
                “success”: False,
                “message”: “Synchronization disabled in offline mode.”
            }

        async with self._sync_lock:

            if not await self.monitor.check():

                self.is_online = False

                return {
                    “success”: False,
                    “message”: “Internet connection unavailable.”
                }

            self.is_online = True

            pending = self.database.get_pending()

            synchronized = 0
            failed = 0

            for item in pending:

                try:

                    payload = (
                        json.loads(item[“payload”])
                        if item[“payload”]
                        else None
                    )

                    await self.online.request(
                        item[“method”],
                        item[“endpoint”],
                        payload
                    )

                    self.database.update_queue_status(
                        item[“id”],
                        “completed”
                    )

                    synchronized += 1

                except httpx.HTTPStatusError as exc:

                    code = exc.response.status_code

                    if code in {400, 401, 403, 404, 409, 422}:
                        status = “failed”
                    else:
                        status = “pending”

                    self.database.update_queue_status(
                        item[“id”],
                        status,
                        f”HTTP {code}”
                    )

                    failed += 1

                except Exception as exc:

                    self.database.update_queue_status(
                        item[“id”],
                        “pending”,
                        str(exc)[:500]
                    )

                    failed += 1

            self.database.set_metadata(
                “last_sync”,
                {
                    “timestamp”: time.time(),
                    “synchronized”: synchronized,
                    “failed”: failed
                }
            )

            return {
                “success”: failed == 0,
                “synchronized”: synchronized,
                “failed”: failed,
                “total”: len(pending)
            }

    # ———————————————————
    # BACKGROUND SYNC
    # ———————————————————

    async def background_sync(self):

        while True:

            if self.mode != OperatingMode.OFFLINE:

                try:
                    await self.synchronize()

                except Exception:
                    logger.exception(
                        “Background synchronization failed.”
                    )

            await asyncio.sleep(SYNC_INTERVAL)

    # ———————————————————
    # CLOSE ENGINE
    # ———————————————————

    async def close(self):

        await self.online.close()


# ============================================================
# PUBLIC API
# ============================================================

async def create_engine(
    mode: str = “hybrid”
):

    engine = MedOrbitsOperatingEngine(
        mode=OperatingMode(mode.lower())
    )

    await engine.initialize()

    return engine


# ============================================================
# STANDALONE EXECUTION
# ============================================================

async def main():

    engine = await create_engine(“hybrid”)

    try:

        print(“\nMEDORBITS OPERATING ENGINE”)
        print(json.dumps(engine.status(), indent=4))

        result = await engine.execute(
            method=“GET”,
            endpoint=“courses”,
            cache_key=“medorbits_courses”,
            cache_ttl=86400
        )

        print(“\nCOURSES:”)
        print(json.dumps(result, indent=4))

        sync_result = await engine.synchronize()

        print(“\nSYNCHRONIZATION:”)
        print(json.dumps(sync_result, indent=4))

    finally:

        await engine.close()


if __name__ == “__main__”:

    asyncio.run(main())
