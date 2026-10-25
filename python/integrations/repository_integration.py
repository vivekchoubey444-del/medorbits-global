#!/usr/bin/env python3
"""
MedOrbits Universal Repository Integration Manager
==================================================
File:
    python/integrations/repository_integration.py
Python:
    3.10+
Dependencies:
    Python standard library only.
Purpose:
    - Discover current and future repository modules and assets.
    - Register integration adapters for different file types.
    - Identify missing, empty, invalid, and unreferenced files.
    - Inspect Python imports and frontend asset relationships.
    - Detect missing manifest-declared dependencies.
    - Support custom adapters for future file types.
    - Integrate with repository scaffolding and audit tools when available.
    - Generate a JSON integration report.
    - Avoid modifying application source files automatically.
This is a discovery and orchestration layer, not a replacement for
application-specific APIs, business logic, or integration tests.
Usage:
    python python/integrations/repository_integration.py --root .
    python python/integrations/repository_integration.py --root . --scan
    python python/integrations/repository_integration.py --root . --validate
    python python/integrations/repository_integration.py --root . --report
    python python/integrations/repository_integration.py --root . --manifest integrations.json
Manifest example:
{
  "integrations": [
    {
      "name": "college-data",
      "source": "assets/data/colleges.json",
      "targets": [
        "pages/colleges.html",
        "assets/js/colleges.js"
      ],
      "required": true,
      "type": "json"
    }
  ]
}
Reports:
    reports/repository-integration.json
"""
from __future__ import annotations
import argparse
import ast
import datetime as dt
import hashlib
import importlib.util
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable
from urllib.parse import unquote, urlsplit
VERSION = "1.0.0"
DEFAULT_IGNORED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".scaffold_backups",
    "dist",
    "build",
}
SUPPORTED_TYPES = {
    ".py": "python",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".svg": "svg",
}
HTML_REFERENCE_RE = re.compile(
    r"""(?:href|src)\s*=\s*["']([^"'#]+)["']""",
    re.IGNORECASE,
)
CSS_REFERENCE_RE = re.compile(
    r"""url\(\s*["']?([^"'()]+?)["']?\s*\)""",
    re.IGNORECASE,
)
JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[^'"]*?\s+from\s+)?|"""
    r"""export\s+[^'"]*?\s+from\s+|import\s*\()"""
    r"""["']([^"']+)["']""",
    re.MULTILINE,
)
class IntegrationError(Exception):
    """Raised for invalid integration configuration or unsafe paths."""
@dataclass
class IntegrationIssue:
    severity: str
    code: str
    path: str
    message: str
    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "path": self.path,
            "message": self.message,
        }
@dataclass
class RepositoryFile:
    path: str
    file_type: str
    size_bytes: int
    empty: bool
    sha256: str | None = None
    valid: bool | None = None
    discovered_by: str = "filesystem"
    def to_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "type": self.file_type,
            "size_bytes": self.size_bytes,
            "empty": self.empty,
            "sha256": self.sha256,
            "valid": self.valid,
            "discovered_by": self.discovered_by,
        }
@dataclass
class IntegrationReport:
    root: str
    mode: str
    files: list[RepositoryFile] = field(default_factory=list)
    relationships: list[dict[str, Any]] = field(default_factory=list)
    integrations: list[dict[str, Any]] = field(default_factory=list)
    issues: list[IntegrationIssue] = field(default_factory=list)
    adapters: list[str] = field(default_factory=list)
    def add_issue(
        self,
        severity: str,
        code: str,
        path: str,
        message: str,
    ) -> None:
        self.issues.append(
            IntegrationIssue(
                severity=severity,
                code=code,
                path=path,
                message=message,
            )
        )
    def to_dict(self) -> dict[str, Any]:
        return {
            "tool": "MedOrbits Repository Integration Manager",
            "version": VERSION,
            "generated_at": dt.datetime.now(
                dt.timezone.utc
            ).isoformat(),
            "root": self.root,
            "mode": self.mode,
            "summary": {
                "files_discovered": len(self.files),
                "relationships_found": len(self.relationships),
                "integrations_checked": len(self.integrations),
                "errors": sum(
                    item.severity == "error"
                    for item in self.issues
                ),
                "warnings": sum(
                    item.severity == "warning"
                    for item in self.issues
                ),
            },
            "adapters": self.adapters,
            "files": [
                item.to_dict()
                for item in self.files
            ],
            "relationships": self.relationships,
            "integrations": self.integrations,
            "issues": [
                item.to_dict()
                for item in self.issues
            ],
        }
class IntegrationAdapter:
    """
    Base class for file-type integration adapters.
    Future integrations can subclass this class and implement inspect().
    Adapters inspect files by default; they do not rewrite source files.
    """
    name = "base"
    extensions: tuple[str, ...] = ()
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        return []
class PythonAdapter(IntegrationAdapter):
    name = "python"
    extensions = (".py",)
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(
            source,
            filename=path.relative_to(root).as_posix(),
        )
        relationships: list[dict[str, Any]] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    relationships.append({
                        "source": path.relative_to(root).as_posix(),
                        "target": alias.name,
                        "relationship": "python-import",
                        "line": node.lineno,
                        "resolution": "unresolved",
                    })
            elif isinstance(node, ast.ImportFrom):
                relationships.append({
                    "source": path.relative_to(root).as_posix(),
                    "target": "." * node.level + (node.module or ""),
                    "relationship": "python-from-import",
                    "line": node.lineno,
                    "resolution": "unresolved",
                })
        return relationships
class HTMLAdapter(IntegrationAdapter):
    name = "html"
    extensions = (".html", ".htm")
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        source = path.read_text(encoding="utf-8")
        relationships = []
        for reference in HTML_REFERENCE_RE.findall(source):
            relationships.append({
                "source": path.relative_to(root).as_posix(),
                "target": reference,
                "relationship": "html-reference",
                "resolution": "unresolved",
            })
        return relationships
class CSSAdapter(IntegrationAdapter):
    name = "css"
    extensions = (".css",)
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        source = path.read_text(encoding="utf-8")
        relationships = []
        for reference in CSS_REFERENCE_RE.findall(source):
            relationships.append({
                "source": path.relative_to(root).as_posix(),
                "target": reference.strip(),
                "relationship": "css-asset",
                "resolution": "unresolved",
            })
        return relationships
class JavaScriptAdapter(IntegrationAdapter):
    name = "javascript"
    extensions = (".js", ".mjs", ".cjs")
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        source = path.read_text(encoding="utf-8")
        relationships = []
        for reference in JS_IMPORT_RE.findall(source):
            relationships.append({
                "source": path.relative_to(root).as_posix(),
                "target": reference,
                "relationship": "javascript-import",
                "resolution": "unresolved",
            })
        return relationships
class JSONAdapter(IntegrationAdapter):
    name = "json"
    extensions = (".json",)
    def inspect(
        self,
        root: Path,
        path: Path,
    ) -> list[dict[str, Any]]:
        with path.open("r", encoding="utf-8-sig") as stream:
            json.load(stream)
        return []
class AdapterRegistry:
    """Register and discover adapters for present and future file types."""
    def __init__(self) -> None:
        self._adapters: dict[str, IntegrationAdapter] = {}
    def register(
        self,
        adapter: IntegrationAdapter,
        *,
        replace: bool = False,
    ) -> None:
        if not adapter.name:
            raise IntegrationError(
                "Adapter must have a non-empty name."
            )
        key = adapter.name.casefold()
        if key in self._adapters and not replace:
            raise IntegrationError(
                f"Adapter already registered: {adapter.name}"
            )
        self._adapters[key] = adapter
    def get(self, name: str) -> IntegrationAdapter | None:
        return self._adapters.get(name.casefold())
    def for_path(self, path: Path) -> IntegrationAdapter | None:
        extension = path.suffix.casefold()
        for adapter in self._adapters.values():
            if extension in adapter.extensions:
                return adapter
        return None
    def names(self) -> list[str]:
        return sorted(self._adapters)
    @classmethod
    def default(cls) -> "AdapterRegistry":
        registry = cls()
        for adapter in (
            PythonAdapter(),
            HTMLAdapter(),
            CSSAdapter(),
            JavaScriptAdapter(),
            JSONAdapter(),
        ):
            registry.register(adapter)
        return registry
def normalize_relative_path(value: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise IntegrationError(
            "A non-empty repository-relative path is required."
        )
    value = value.replace("\\", "/")
    path = Path(value)
    if path.is_absolute():
        raise IntegrationError(
            f"Absolute path rejected: {value}"
        )
    if re.match(r"^[A-Za-z]:", value):
        raise IntegrationError(
            f"Drive-qualified path rejected: {value}"
        )
    if ".." in path.parts:
        raise IntegrationError(
            f"Path traversal rejected: {value}"
        )
    return path
def resolve_inside_root(root: Path, value: str | Path) -> Path:
    relative = (
        normalize_relative_path(value)
        if isinstance(value, str)
        else value
    )
    target = root / relative
    try:
        target.resolve(strict=False).relative_to(root.resolve())
    except ValueError as exc:
        raise IntegrationError(
            f"Path escapes repository root: {relative}"
        ) from exc
    current = root
    for part in relative.parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise IntegrationError(
                f"Symlinked parent directory rejected: {current}"
            )
    if target.is_symlink():
        raise IntegrationError(
            f"Symlink destination rejected: {target}"
        )
    return target
def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(
            lambda: stream.read(1024 * 1024),
            b"",
        ):
            digest.update(chunk)
    return digest.hexdigest()
def discover_repository(
    root: Path,
    ignored_dirs: set[str] | None = None,
) -> list[Path]:
    ignored = DEFAULT_IGNORED_DIRS | (ignored_dirs or set())
    found: list[Path] = []
    for current, dirs, filenames in os.walk(
        root,
        followlinks=False,
    ):
        current_path = Path(current)
        dirs[:] = [
            name for name in dirs
            if name not in ignored
            and not (current_path / name).is_symlink()
        ]
        for filename in filenames:
            path = current_path / filename
            if path.is_symlink() or not path.is_file():
                continue
            found.append(path)
    return sorted(
        found,
        key=lambda path: path.relative_to(root).as_posix().casefold(),
    )
def validate_file(
    path: Path,
    file_type: str,
) -> tuple[bool | None, str | None]:
    try:
        if file_type == "python":
            ast.parse(
                path.read_text(encoding="utf-8"),
                filename=str(path),
            )
        elif file_type == "json":
            with path.open("r", encoding="utf-8-sig") as stream:
                json.load(stream)
        elif file_type in {
            "html", "css", "javascript", "markdown",
            "yaml", "toml", "xml", "svg",
        }:
            path.read_text(encoding="utf-8")
        return True, None
    except (OSError, UnicodeError, SyntaxError, json.JSONDecodeError) as exc:
        return False, str(exc)
def resolve_local_reference(
    root: Path,
    source: Path,
    reference: str,
) -> Path | None:
    reference = reference.strip()
    if not reference:
        return None
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    # Module aliases, hash routes, and non-file URLs require
    # application-specific resolution and are not guessed here.
    candidate = (
        root / raw_path.lstrip("/")
        if raw_path.startswith("/")
        else source.parent / raw_path
    )
    try:
        resolved = candidate.resolve(strict=False)
        resolved.relative_to(root.resolve())
        return resolved
    except (ValueError, OSError):
        return None
class RepositoryIntegrationManager:
    """Discover, validate, and report repository integrations."""
    def __init__(
        self,
        root: str | Path,
        registry: AdapterRegistry | None = None,
    ) -> None:
        self.root = Path(root).expanduser().resolve()
        if not self.root.is_dir():
            raise IntegrationError(
                f"Repository root does not exist: {self.root}"
            )
        self.registry = registry or AdapterRegistry.default()
    def scan(self) -> IntegrationReport:
        report = IntegrationReport(
            root=str(self.root),
            mode="scan",
            adapters=self.registry.names(),
        )
        paths = discover_repository(self.root)
        for path in paths:
            relative = path.relative_to(self.root).as_posix()
            extension = path.suffix.casefold()
            adapter = self.registry.for_path(path)
            if adapter is None:
                continue
            try:
                size = path.stat().st_size
                empty = (
                    size == 0
                    or not path.read_text(
                        encoding="utf-8-sig"
                    ).strip()
                )
                item = RepositoryFile(
                    path=relative,
                    file_type=adapter.name,
                    size_bytes=size,
                    empty=empty,
                    sha256=file_hash(path),
                )
                valid, error = validate_file(
                    path,
                    adapter.name,
                )
                item.valid = valid
                report.files.append(item)
                if empty:
                    report.add_issue(
                        "warning",
                        "EMPTY_FILE",
                        relative,
                        "File is empty or contains only whitespace.",
                    )
                if valid is False:
                    report.add_issue(
                        "error",
                        "INVALID_FILE",
                        relative,
                        error or "Validation failed.",
                    )
                for relationship in adapter.inspect(
                    self.root,
                    path,
                ):
                    if relationship.get("relationship") in {
                        "python-import",
                        "python-from-import",
                    }:
                        # Python imports need interpreter/package-aware
                        # resolution; leave unresolved rather than
                        # falsely declaring them broken.
                        report.relationships.append(relationship)
                        continue
                    reference = str(
                        relationship.get("target", "")
                    )
                    resolved = resolve_local_reference(
                        self.root,
                        path,
                        reference,
                    )
                    if resolved is None:
                        parsed = urlsplit(reference)
                        if parsed.scheme or parsed.netloc:
                            relationship["resolution"] = "external"
                        else:
                            relationship["resolution"] = "not-resolved"
                    elif resolved.exists():
                        relationship["resolution"] = "found"
                        relationship["resolved_path"] = (
                            resolved.relative_to(self.root).as_posix()
                        )
                    else:
                        relationship["resolution"] = "missing"
                        report.add_issue(
                            "warning",
                            "MISSING_REFERENCE",
                            relative,
                            f"Referenced resource not found: {reference}",
                        )
                    report.relationships.append(relationship)
            except (OSError, UnicodeError, IntegrationError) as exc:
                report.add_issue(
                    "error",
                    "SCAN_FAILED",
                    relative,
                    str(exc),
                )
        return report
    def validate_manifest(
        self,
        manifest_path: str | Path,
        report: IntegrationReport,
    ) -> None:
        manifest = resolve_inside_root(
            self.root,
            normalize_relative_path(str(manifest_path)),
        )
        if not manifest.is_file():
            raise IntegrationError(
                f"Manifest not found: {manifest}"
            )
        try:
            with manifest.open(
                "r",
                encoding="utf-8-sig",
            ) as stream:
                data = json.load(stream)
        except (OSError, json.JSONDecodeError) as exc:
            raise IntegrationError(
                f"Cannot load manifest: {exc}"
            ) from exc
        if not isinstance(data, dict):
            raise IntegrationError(
                "Manifest must contain a JSON object."
            )
        entries = data.get("integrations", [])
        if not isinstance(entries, list):
            raise IntegrationError(
                "'integrations' must be a JSON array."
            )
        seen: set[str] = set()
        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                report.add_issue(
                    "error",
                    "INVALID_MANIFEST_ENTRY",
                    f"integrations[{index}]",
                    "Integration entry must be an object.",
                )
                continue
            name = str(entry.get("name", "")).strip()
            source_value = entry.get("source")
            targets = entry.get("targets", [])
            required = bool(entry.get("required", True))
            if not name or not isinstance(source_value, str):
                report.add_issue(
                    "error",
                    "INVALID_MANIFEST_ENTRY",
                    f"integrations[{index}]",
                    "Each entry needs a name and source path.",
                )
                continue
            key = name.casefold()
            if key in seen:
                report.add_issue(
                    "error",
                    "DUPLICATE_INTEGRATION",
                    name,
                    "Integration name appears more than once.",
                )
                continue
            seen.add(key)
            if not isinstance(targets, list):
                report.add_issue(
                    "error",
                    "INVALID_TARGETS",
                    name,
                    "'targets' must be an array of paths.",
                )
                continue
            try:
                source_path = resolve_inside_root(
                    self.root,
                    source_value,
                )
                source_exists = source_path.is_file()
                result: dict[str, Any] = {
                    "name": name,
                    "source": source_path.relative_to(
                        self.root
                    ).as_posix(),
                    "source_exists": source_exists,
                    "required": required,
                    "targets": [],
                    "status": "ready" if source_exists else "missing-source",
                }
                if not source_exists:
                    report.add_issue(
                        "error" if required else "warning",
                        "MISSING_INTEGRATION_SOURCE",
                        name,
                        f"Source file does not exist: {source_value}",
                    )
                for target_value in targets:
                    if not isinstance(target_value, str):
                        report.add_issue(
                            "error",
                            "INVALID_TARGET_PATH",
                            name,
                            "Target paths must be strings.",
                        )
                        continue
                    target_path = resolve_inside_root(
                        self.root,
                        target_value,
                    )
                    target_exists = target_path.is_file()
                    result["targets"].append({
                        "path": target_path.relative_to(
                            self.root
                        ).as_posix(),
                        "exists": target_exists,
                    })
                    if not target_exists:
                        report.add_issue(
                            "error" if required else "warning",
                            "MISSING_INTEGRATION_TARGET",
                            name,
                            f"Target file does not exist: {target_value}",
                        )
                report.integrations.append(result)
            except IntegrationError as exc:
                report.add_issue(
                    "error",
                    "UNSAFE_INTEGRATION_PATH",
                    name,
                    str(exc),
                )
    def write_report(
        self,
        report: IntegrationReport,
        output_path: str | Path = "reports/repository-integration.json",
    ) -> Path:
        destination = resolve_inside_root(
            self.root,
            normalize_relative_path(str(output_path)),
        )
        destination.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        rendered = json.dumps(
            report.to_dict(),
            indent=2,
            ensure_ascii=False,
        ) + "\n"
        temporary = destination.with_name(
            f".{destination.name}.tmp"
        )
        try:
            temporary.write_text(
                rendered,
                encoding="utf-8",
                newline="\n",
            )
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
        return destination
def load_optional_tool(
    root: Path,
    relative_path: str,
) -> dict[str, Any]:
    """
    Report whether an optional tool is present without executing it.
    Importing arbitrary repository scripts may trigger side effects, so
    this function only checks file presence and Python module metadata.
    """
    path = resolve_inside_root(root, relative_path)
    return {
        "path": relative_path,
        "exists": path.is_file(),
        "purpose": "optional repository tool",
    }
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Discover and validate MedOrbits integrations across "
            "existing and future repository files."
        )
    )
    parser.add_argument("--root", default=".")
    parser.add_argument("--manifest")
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--output")
    parser.add_argument("--scan", action="store_true")
    parser.add_argument("--validate", action="store_true")
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    try:
        manager = RepositoryIntegrationManager(args.root)
        report = manager.scan()
        if args.manifest:
            manager.validate_manifest(
                args.manifest,
                report,
            )
        should_write = args.report or args.output
        if should_write:
            output = (
                args.output
                or "reports/repository-integration.json"
            )
            path = manager.write_report(report, output)
            print(f"Report written: {path}")
        print(json.dumps(
            report.to_dict(),
            indent=2,
            ensure_ascii=False,
        ))
        return (
            1
            if any(
                issue.severity == "error"
                for issue in report.issues
            )
            else 0
        )
    except (IntegrationError, OSError, ValueError) as exc:
        print(
            f"[MedOrbits Integration Manager] ERROR: {exc}",
            file=sys.stderr,
        )
        return 2
if __name__ == "__main__":
    raise SystemExit(main())