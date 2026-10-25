#!/usr/bin/env python3
"""
MedOrbits Storage Client
========================
Unified storage client for MedOrbits application services.
Compatible with Python 3.10+.
Uses only the Python standard library and the optional MedOrbits
storage backend registry.
Features:
- Local filesystem storage
- Optional registered backend support
- Safe relative object keys
- JSON read/write operations
- File upload and download helpers
- Metadata and existence checks
- Listing and deletion
- Size limits
- Atomic local writes
- Consistent storage exceptions
Environment:
    MEDORBITS_STORAGE_BACKEND=local
    MEDORBITS_STORAGE_ROOT=storage
Security:
- Relative keys cannot escape the configured storage root.
- Symlinks resolving outside the root are rejected.
- Writes use temporary files and atomic replacement.
- Authentication and authorization must be enforced by the caller.
"""
from __future__ import annotations
import json
import os
import shutil
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO
# --------------------------------------------------
# STORAGE REGISTRY
# --------------------------------------------------
try:
    from python.integrations.storage import (
        create_backend,
        backend_available,
        StorageError,
        StorageConfigurationError,
        StorageBackendNotFoundError,
        StorageOperationError,
    )
except ImportError:
    create_backend = None
    backend_available = None
    class StorageError(Exception):
        """Base storage error."""
    class StorageConfigurationError(StorageError):
        """Invalid storage configuration."""
    class StorageBackendNotFoundError(StorageError):
        """Requested storage backend is unavailable."""
    class StorageOperationError(StorageError):
        """Storage operation failed."""
# --------------------------------------------------
# CLIENT EXCEPTIONS
# --------------------------------------------------
class StorageClientError(StorageError):
    """Base exception for storage-client failures."""
class StorageObjectNotFoundError(StorageClientError):
    """Requested storage object does not exist."""
class StorageObjectExistsError(StorageClientError):
    """Storage object already exists when overwrite is disabled."""
class StorageSecurityError(StorageClientError):
    """Unsafe or unauthorized storage path."""
class StorageValidationError(StorageClientError):
    """Invalid storage input or object key."""
# --------------------------------------------------
# STORAGE CLIENT
# --------------------------------------------------
class StorageClient:
    """
    Storage facade for local and registered storage backends.
    The local backend is implemented directly by this class.
    Remote backends must be registered and expose the required methods.
    Supported remote backend methods:
        put(key, data, overwrite=True)
        get(key)
        exists(key)
        delete(key)
        list(prefix="")
        get_metadata(key)
    """
    def __init__(
        self,
        root_dir: str | Path | None = None,
        *,
        backend: str | None = None,
        max_file_size: int = 50 * 1024 * 1024,
        create_root: bool = True,
    ) -> None:
        if max_file_size <= 0:
            raise StorageConfigurationError(
                "max_file_size must be greater than zero"
            )
        self.backend_name = (
            backend
            or os.environ.get(
                "MEDORBITS_STORAGE_BACKEND",
                "local",
            )
        ).strip().casefold()
        if not self.backend_name:
            raise StorageConfigurationError(
                "Storage backend name cannot be empty"
            )
        self.max_file_size = int(max_file_size)
        self._lock = threading.RLock()
        self._backend: Any | None = None
        configured_root = (
            root_dir
            or os.environ.get("MEDORBITS_STORAGE_ROOT")
            or "storage"
        )
        self.root_dir = Path(configured_root).expanduser().resolve()
        if self.backend_name == "local":
            if create_root:
                self.root_dir.mkdir(
                    parents=True,
                    exist_ok=True,
                )
            if self.root_dir.exists() and not self.root_dir.is_dir():
                raise StorageConfigurationError(
                    "Storage root must be a directory"
                )
        else:
            if create_backend is None or backend_available is None:
                raise StorageBackendNotFoundError(
                    f"Storage backend registry unavailable: "
                    f"{self.backend_name}"
                )
            if not backend_available(self.backend_name):
                raise StorageBackendNotFoundError(
                    f"Storage backend not registered: "
                    f"{self.backend_name}"
                )
            try:
                self._backend = create_backend(self.backend_name)
            except Exception as exc:
                raise StorageOperationError(
                    f"Unable to initialize storage backend "
                    f"{self.backend_name!r}"
                ) from exc
    # --------------------------------------------------
    # KEY VALIDATION
    # --------------------------------------------------
    @staticmethod
    def _validate_key(key: str | Path) -> str:
        """Validate an object key as a safe relative path."""
        if isinstance(key, Path):
            key = key.as_posix()
        if not isinstance(key, str) or not key.strip():
            raise StorageValidationError(
                "Storage key must not be empty"
            )
        if "\x00" in key:
            raise StorageValidationError(
                "Storage key contains a null character"
            )
        normalized = key.replace("\\", "/")
        pure_path = PurePosixPath(normalized)
        if pure_path.is_absolute():
            raise StorageSecurityError(
                "Absolute storage keys are not allowed"
            )
        if any(part in {".", ".."} for part in normalized.split("/")):
            raise StorageSecurityError(
                "Storage key contains an unsafe path segment"
            )
        if len(normalized) > 1024:
            raise StorageValidationError(
                "Storage key exceeds the maximum length"
            )
        return pure_path.as_posix()
    def _resolve_local_path(self, key: str | Path) -> Path:
        """Resolve and verify a local object path."""
        safe_key = self._validate_key(key)
        candidate = (self.root_dir / safe_key).resolve()
        try:
            candidate.relative_to(self.root_dir)
        except ValueError as exc:
            raise StorageSecurityError(
                "Storage key resolves outside the storage root"
            ) from exc
        # Resolve existing ancestors to detect symlink escapes.
        current = self.root_dir
        for part in PurePosixPath(safe_key).parts:
            current = current / part
            if current.is_symlink():
                resolved = current.resolve()
                try:
                    resolved.relative_to(self.root_dir)
                except ValueError as exc:
                    raise StorageSecurityError(
                        "Storage path traverses a symlink outside the root"
                    ) from exc
        return candidate
    # --------------------------------------------------
    # WRITE OPERATIONS
    # --------------------------------------------------
    def put(
        self,
        key: str | Path,
        data: bytes | bytearray | memoryview,
        *,
        overwrite: bool = True,
    ) -> dict[str, Any]:
        """Store binary data and return object metadata."""
        safe_key = self._validate_key(key)
        if not isinstance(data, (bytes, bytearray, memoryview)):
            raise StorageValidationError(
                "put() requires bytes-like data"
            )
        content = bytes(data)
        if len(content) > self.max_file_size:
            raise StorageValidationError(
                "Object exceeds the configured file-size limit"
            )
        if self.backend_name != "local":
            return self._remote_put(
                safe_key,
                content,
                overwrite=overwrite,
            )
        destination = self._resolve_local_path(safe_key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            if destination.exists() and not overwrite:
                raise StorageObjectExistsError(
                    f"Object already exists: {safe_key}"
                )
            temporary_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="wb",
                    dir=destination.parent,
                    prefix=".medorbits-",
                    suffix=".tmp",
                    delete=False,
                ) as temporary:
                    temporary.write(content)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                    temporary_path = Path(temporary.name)
                if not overwrite and destination.exists():
                    raise StorageObjectExistsError(
                        f"Object already exists: {safe_key}"
                    )
                os.replace(temporary_path, destination)
                temporary_path = None
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)
        return self.get_metadata(safe_key)
    def put_json(
        self,
        key: str | Path,
        data: Any,
        *,
        overwrite: bool = True,
        indent: int = 2,
    ) -> dict[str, Any]:
        """Serialize and store JSON data."""
        try:
            encoded = json.dumps(
                data,
                ensure_ascii=False,
                allow_nan=False,
                indent=indent,
            ).encode("utf-8")
        except (TypeError, ValueError) as exc:
            raise StorageValidationError(
                "Data cannot be serialized as valid JSON"
            ) from exc
        return self.put(
            key,
            encoded,
            overwrite=overwrite,
        )
    def upload_file(
        self,
        source: str | Path,
        key: str | Path,
        *,
        overwrite: bool = True,
    ) -> dict[str, Any]:
        """Upload a local file into storage."""
        source_path = Path(source).expanduser()
        if not source_path.is_file():
            raise StorageObjectNotFoundError(
                f"Source file does not exist: {source_path}"
            )
        if source_path.stat().st_size > self.max_file_size:
            raise StorageValidationError(
                "Source file exceeds the configured size limit"
            )
        with source_path.open("rb") as file:
            content = file.read(self.max_file_size + 1)
        if len(content) > self.max_file_size:
            raise StorageValidationError(
                "Source file exceeds the configured size limit"
            )
        return self.put(
            key,
            content,
            overwrite=overwrite,
        )
    # --------------------------------------------------
    # READ OPERATIONS
    # --------------------------------------------------
    def get(self, key: str | Path) -> bytes:
        """Retrieve an object as bytes."""
        safe_key = self._validate_key(key)
        if self.backend_name != "local":
            return self._remote_get(safe_key)
        path = self._resolve_local_path(safe_key)
        if not path.is_file():
            raise StorageObjectNotFoundError(
                f"Storage object not found: {safe_key}"
            )
        if path.stat().st_size > self.max_file_size:
            raise StorageValidationError(
                "Stored object exceeds the configured size limit"
            )
        try:
            with path.open("rb") as file:
                content = file.read(self.max_file_size + 1)
        except OSError as exc:
            raise StorageOperationError(
                f"Unable to read storage object: {safe_key}"
            ) from exc
        if len(content) > self.max_file_size:
            raise StorageValidationError(
                "Stored object exceeds the configured size limit"
            )
        return content
    def get_json(self, key: str | Path) -> Any:
        """Retrieve an object and parse it as JSON."""
        content = self.get(key)
        try:
            return json.loads(content.decode("utf-8-sig"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise StorageValidationError(
                f"Stored object is not valid JSON: {key}"
            ) from exc
    def download_file(
        self,
        key: str | Path,
        destination: str | Path,
        *,
        overwrite: bool = True,
    ) -> Path:
        """Download an object to a destination file."""
        target = Path(destination).expanduser().resolve()
        if target.exists() and not overwrite:
            raise StorageObjectExistsError(
                f"Destination already exists: {target}"
            )
        content = self.get(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=target.parent,
                prefix=".medorbits-download-",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary.write(content)
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_path = Path(temporary.name)
            if not overwrite and target.exists():
                raise StorageObjectExistsError(
                    f"Destination already exists: {target}"
                )
            os.replace(temporary_path, target)
            temporary_path = None
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
        return target
    # --------------------------------------------------
    # METADATA AND EXISTENCE
    # --------------------------------------------------
    def exists(self, key: str | Path) -> bool:
        """Check whether an object exists."""
        safe_key = self._validate_key(key)
        if self.backend_name != "local":
            method = getattr(self._backend, "exists", None)
            if not callable(method):
                raise StorageOperationError(
                    "Backend does not implement exists()"
                )
            return bool(method(safe_key))
        return self._resolve_local_path(safe_key).is_file()
    def get_metadata(self, key: str | Path) -> dict[str, Any]:
        """Return basic object metadata."""
        safe_key = self._validate_key(key)
        if self.backend_name != "local":
            method = getattr(self._backend, "get_metadata", None)
            if not callable(method):
                raise StorageOperationError(
                    "Backend does not implement get_metadata()"
                )
            result = method(safe_key)
            if not isinstance(result, dict):
                raise StorageOperationError(
                    "Backend returned invalid metadata"
                )
            return result
        path = self._resolve_local_path(safe_key)
        if not path.is_file():
            raise StorageObjectNotFoundError(
                f"Storage object not found: {safe_key}"
            )
        stat = path.stat()
        return {
            "key": safe_key,
            "size_bytes": stat.st_size,
            "modified_at": datetime.fromtimestamp(
                stat.st_mtime,
                tz=timezone.utc,
            ).isoformat(),
            "content_type": self._guess_content_type(path),
            "backend": "local",
        }
    @staticmethod
    def _guess_content_type(path: Path) -> str:
        import mimetypes
        content_type, _ = mimetypes.guess_type(path.name)
        return content_type or "application/octet-stream"
    # --------------------------------------------------
    # LISTING AND DELETION
    # --------------------------------------------------
    def list(self, prefix: str = "") -> list[str]:
        """List object keys under an optional relative prefix."""
        if self.backend_name != "local":
            method = getattr(self._backend, "list", None)
            if not callable(method):
                raise StorageOperationError(
                    "Backend does not implement list()"
                )
            result = method(prefix=prefix)
            if not isinstance(result, (list, tuple)):
                raise StorageOperationError(
                    "Backend list() must return a list or tuple"
                )
            return [str(item) for item in result]
        if prefix:
            safe_prefix = self._validate_key(prefix)
            base = self._resolve_local_path(safe_prefix)
        else:
            base = self.root_dir
        if not base.exists():
            return []
        if base.is_file():
            return [
                base.relative_to(self.root_dir).as_posix()
            ]
        results: list[str] = []
        for path in base.rglob("*"):
            if path.is_symlink():
                try:
                    path.resolve().relative_to(self.root_dir)
                except ValueError as exc:
                    raise StorageSecurityError(
                        "Storage listing encountered a symlink "
                        "outside the storage root"
                    ) from exc
            if path.is_file():
                resolved = path.resolve()
                try:
                    resolved.relative_to(self.root_dir)
                except ValueError as exc:
                    raise StorageSecurityError(
                        "Storage listing encountered a path "
                        "outside the storage root"
                    ) from exc
                results.append(
                    path.relative_to(self.root_dir).as_posix()
                )
        return sorted(results)
    def delete(self, key: str | Path, *, missing_ok: bool = False) -> bool:
        """Delete a stored object."""
        safe_key = self._validate_key(key)
        if self.backend_name != "local":
            method = getattr(self._backend, "delete", None)
            if not callable(method):
                raise StorageOperationError(
                    "Backend does not implement delete()"
                )
            try:
                result = method(safe_key)
                return result is not False
            except StorageObjectNotFoundError:
                if missing_ok:
                    return False
                raise
        path = self._resolve_local_path(safe_key)
        with self._lock:
            if not path.is_file():
                if missing_ok:
                    return False
                raise StorageObjectNotFoundError(
                    f"Storage object not found: {safe_key}"
                )
            try:
                path.unlink()
            except OSError as exc:
                raise StorageOperationError(
                    f"Unable to delete storage object: {safe_key}"
                ) from exc
        return True
    # --------------------------------------------------
    # REMOTE BACKEND ADAPTERS
    # --------------------------------------------------
    def _remote_put(
        self,
        key: str,
        content: bytes,
        *,
        overwrite: bool,
    ) -> dict[str, Any]:
        method = getattr(self._backend, "put", None)
        if not callable(method):
            raise StorageOperationError(
                "Backend does not implement put()"
            )
        try:
            result = method(
                key,
                content,
                overwrite=overwrite,
            )
        except Exception as exc:
            raise StorageOperationError(
                f"Backend failed to store object: {key}"
            ) from exc
        if isinstance(result, dict):
            return result
        return {
            "key": key,
            "size_bytes": len(content),
            "backend": self.backend_name,
        }
    def _remote_get(self, key: str) -> bytes:
        method = getattr(self._backend, "get", None)
        if not callable(method):
            raise StorageOperationError(
                "Backend does not implement get()"
            )
        try:
            result = method(key)
        except Exception as exc:
            raise StorageOperationError(
                f"Backend failed to retrieve object: {key}"
            ) from exc
        if not isinstance(result, bytes):
            raise StorageOperationError(
                "Backend get() must return bytes"
            )
        if len(result) > self.max_file_size:
            raise StorageValidationError(
                "Retrieved object exceeds the configured size limit"
            )
        return result
    # --------------------------------------------------
    # LIFECYCLE
    # --------------------------------------------------
    def close(self) -> None:
        """Close the backend if it supports a close method."""
        if self._backend is not None:
            method = getattr(self._backend, "close", None)
            if callable(method):
                method()
    def __enter__(self) -> StorageClient:
        return self
    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()
# --------------------------------------------------
# FACTORY
# --------------------------------------------------
def create_storage_client(**kwargs: Any) -> StorageClient:
    """Create a configured MedOrbits storage client."""
    return StorageClient(**kwargs)
__all__ = [
    "StorageClient",
    "StorageClientError",
    "StorageObjectNotFoundError",
    "StorageObjectExistsError",
    "StorageSecurityError",
    "StorageValidationError",
    "create_storage_client",
]