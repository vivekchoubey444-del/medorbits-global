
#!/usr/bin/env python3
“””
===============================================================================
MedOrbits Extra Repository Connector
File: tools/repository_connector_extra.py
Version: 1.0.1
Python: 3.10+

PURPOSE
    Extended, read-only repository analysis independent of
    tools/repository_connector.py.

FEATURES
    - File inventory and SHA-256 checksums.
    - HTML, CSS, JavaScript, Python and Markdown reference extraction.
    - Dependency edge reporting.
    - Broken and unresolved reference detection.
    - Express-style API route discovery.
    - Git conflict-marker detection without executing Git.
    - Advisory HTML connection suggestions.
    - JSON and CSV report generation.
    - Hidden-file scanning option.
    - Dry-run and strict modes.

SAFETY
    - Does not edit or delete source files.
    - Does not execute repository scripts.
    - Does not execute Git commands.
    - Does not install dependencies.
    - Does not automatically apply suggested HTML changes.
    - Does not follow symbolic links.
    - Skips large files above the configured size limit.

REPORT DIRECTORY
    tools/repository-reports/

USAGE
    python tools/repository_connector_extra.py
    python tools/repository_connector_extra.py —root .
    python tools/repository_connector_extra.py —dry-run
    python tools/repository_connector_extra.py —include-hidden
    python tools/repository_connector_extra.py —show-conflicts
    python tools/repository_connector_extra.py —strict
    python tools/repository_connector_extra.py —json-summary

===============================================================================
“””

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import stat
import sys

from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import unquote, urlsplit


VERSION = “1.0.1”

REPORT_DIRECTORY = Path(“tools/repository-reports”)

SKIP_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.idea”,
    “.vscode”,
    “.venv”,
    “venv”,
    “node_modules”,
    “__pycache__”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “coverage”,
    “dist”,
    “build”,
    “vendor”,
    “repository-reports”,
}

SKIP_FILES = {
    “.DS_Store”,
    “Thumbs.db”,
    “package-lock.json”,
    “pnpm-lock.yaml”,
    “yarn.lock”,
}

SOURCE_EXTENSIONS = {
    “.html”,
    “.htm”,
    “.css”,
    “.js”,
    “.mjs”,
    “.cjs”,
    “.jsx”,
    “.ts”,
    “.tsx”,
    “.py”,
    “.md”,
    “.json”,
    “.xml”,
    “.yml”,
    “.yaml”,
    “.toml”,
    “.sh”,
    “.sql”,
    “.txt”,
}

TEXT_EXTENSIONS = SOURCE_EXTENSIONS | {
    “.svg”,
    “.webmanifest”,
    “.env.example”,
}

REFERENCE_EXTENSIONS = {
    “.html”,
    “.htm”,
    “.css”,
    “.js”,
    “.mjs”,
    “.cjs”,
    “.jsx”,
    “.ts”,
    “.tsx”,
    “.py”,
    “.md”,
}

MAX_FILE_MB_DEFAULT = 5

CONFLICT_MARKERS = (
    re.compile(r”^<<<<<<<(?: .*)?$”, re.MULTILINE),
    re.compile(r”^=======$”, re.MULTILINE),
    re.compile(r”^>>>>>>>(?: .*)?$”, re.MULTILINE),
)

JS_REFERENCE_PATTERN = re.compile(
    r”””
    \b(?:import|export)\s+
    (?:(?:[^’”;]+?)\s+from\s+)?
    (?P<quote>[‘”])
    (?P<target>[^’”]+)
    (?P=quote)
    |
    \bimport\s*\(\s*
    (?P<dynamic_quote>[‘”])
    (?P<dynamic_target>[^’”]+)
    (?P=dynamic_quote)
    “””,
    re.VERBOSE,
)

PYTHON_REFERENCE_PATTERN = re.compile(
    r”””
    \b(?:open|Path)\s*\(\s*
    (?P<quote>[‘”])
    (?P<target>[^’”]+)
    (?P=quote)
    “””,
    re.VERBOSE,
)

MARKDOWN_REFERENCE_PATTERN = re.compile(
    r”!?\[[^\]]*\]\(([^)]+)\)”
)

CSS_REFERENCE_PATTERN = re.compile(
    r”””
    url\(\s*
    (?:
        [‘”](?P<quoted>[^’”]+)[‘”]
        |
        (?P<plain>[^)’”]+)
    )
    \s*\)
    |
    @import\s+
    [‘”](?P<imported>[^’”]+)[‘”]
    “””,
    re.IGNORECASE | re.VERBOSE,
)

API_ROUTE_PATTERN = re.compile(
    r”””
    \b
    (?P<receiver>[A-Za-z_$][\w$]*)
    \s*\.\s*
    (?P<method>get|post|put|patch|delete|all|use|options|head)
    \s*\(
    \s*
    (?:
        (?P<quote>[‘”`])
        (?P<literal>[^’”`]+)
        (?P=quote)
        |
        (?P<dynamic>[^,\s)]+)
    )
    “””,
    re.IGNORECASE | re.VERBOSE,
)


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class InventoryItem:
    path: str
    extension: str
    size: int
    sha256: str
    category: str


@dataclass
class Reference:
    source: str
    target: str
    kind: str
    line: int
    status: str = “unresolved”
    resolved_path: str = “”


@dataclass
class ApiRoute:
    source: str
    receiver: str
    method: str
    path: str
    line: int
    dynamic: bool = False


@dataclass
class Conflict:
    path: str
    line: int
    marker: str
    text: str


@dataclass
class Finding:
    severity: str
    category: str
    path: str
    line: int
    message: str


# =============================================================================
# LOGGING
# =============================================================================

class Logger:

    def __init__(self, quiet: bool = False) -> None:
        self.quiet = quiet

    def info(self, message: str) -> None:
        if not self.quiet:
            print(f”[INFO] {message}”)

    def success(self, message: str) -> None:
        if not self.quiet:
            print(f”[PASS] {message}”)

    def warning(self, message: str) -> None:
        if not self.quiet:
            print(f”[WARN] {message}”)

    def error(self, message: str) -> None:
        print(f”[FAIL] {message}”, file=sys.stderr)


# =============================================================================
# HTML REFERENCE EXTRACTION
# =============================================================================

class HTMLReferenceParser(HTMLParser):

    ATTRIBUTES = {
        “href”: “html-href”,
        “src”: “html-src”,
        “action”: “html-action”,
        “poster”: “html-poster”,
        “data”: “html-data”,
        “srcset”: “html-srcset”,
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, str, int]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._process(attrs)

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self._process(attrs)

    def _process(self, attrs: list[tuple[str, str | None]]) -> None:
        line = self.getpos()[0]

        for attribute, value in attrs:
            if not value:
                continue

            attribute = attribute.lower()

            if attribute == “srcset”:
                for candidate in value.split(“,”):
                    candidate = candidate.strip()

                    if not candidate:
                        continue

                    target = candidate.split()[0]

                    self.references.append(
                        (“html-srcset”, target, line)
                    )

            elif attribute in self.ATTRIBUTES:
                self.references.append(
                    (self.ATTRIBUTES[attribute], value.strip(), line)
                )


# =============================================================================
# REPOSITORY CONNECTOR
# =============================================================================

class RepositoryConnectorExtra:

    def __init__(
        self,
        root: Path,
        include_hidden: bool = False,
        show_conflicts: bool = False,
        max_links: int = 10000,
        max_file_mb: int = MAX_FILE_MB_DEFAULT,
    ) -> None:

        self.root = root.resolve(strict=True)
        self.include_hidden = include_hidden
        self.show_conflicts = show_conflicts
        self.max_links = max_links
        self.max_file_bytes = max_file_mb * 1024 * 1024

        self.logger = Logger()

        self.inventory: list[InventoryItem] = []
        self.references: list[Reference] = []
        self.routes: list[ApiRoute] = []
        self.conflicts: list[Conflict] = []
        self.findings: list[Finding] = []

        self.known_files: set[str] = set()
        self.known_directories: set[str] = set()

        self.scanned_files = 0
        self.skipped_files = 0
        self.read_errors = 0

        self.timestamp = datetime.now(
            timezone.utc
        ).strftime(“%Y%m%dT%H%M%SZ”)

    # =========================================================================
    # PATH HELPERS
    # =========================================================================

    def relative(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def is_hidden(self, path: Path) -> bool:
        if self.include_hidden:
            return False

        return any(
            part.startswith(“.”)
            for part in path.relative_to(self.root).parts
        )

    def safe_source_path(self, path: Path) -> bool:
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)
        except (OSError, RuntimeError, ValueError):
            return False

        return not path.is_symlink() and resolved.is_file()

    # =========================================================================
    # DISCOVERY
    # =========================================================================

    def discover(self) -> list[Path]:
        discovered: list[Path] = []

        def on_walk_error(exc: OSError) -> None:
            self.read_errors += 1
            self.findings.append(
                Finding(
                    severity=“warning”,
                    category=“filesystem”,
                    path=str(exc.filename or “”),
                    line=0,
                    message=str(exc),
                )
            )

        for current, dirs, files in os.walk(
            self.root,
            topdown=True,
            followlinks=False,
            onerror=on_walk_error,
        ):
            current_path = Path(current)

            filtered_dirs = []

            for directory in dirs:
                candidate = current_path / directory

                if directory in SKIP_DIRS:
                    continue

                if not self.include_hidden and directory.startswith(“.”):
                    continue

                try:
                    metadata = candidate.lstat()
                except OSError as exc:
                    self.read_errors += 1
                    self.findings.append(
                        Finding(
                            “warning”,
                            “filesystem”,
                            self.relative(candidate),
                            0,
                            str(exc),
                        )
                    )
                    continue

                if stat.S_ISLNK(metadata.st_mode):
                    self.findings.append(
                        Finding(
                            “warning”,
                            “symlink”,
                            self.relative(candidate),
                            0,
                            “Symbolic-link directory skipped.”,
                        )
                    )
                    continue

                if stat.S_ISDIR(metadata.st_mode):
                    filtered_dirs.append(directory)

                    self.known_directories.add(
                        self.relative(candidate)
                    )

            dirs[:] = filtered_dirs

            for filename in files:
                if filename in SKIP_FILES:
                    continue

                path = current_path / filename

                if self.is_hidden(path):
                    continue

                try:
                    metadata = path.lstat()
                except OSError as exc:
                    self.read_errors += 1
                    self.findings.append(
                        Finding(
                            “warning”,
                            “filesystem”,
                            self.relative(path),
                            0,
                            str(exc),
                        )
                    )
                    continue

                if stat.S_ISLNK(metadata.st_mode):
                    self.findings.append(
                        Finding(
                            “warning”,
                            “symlink”,
                            self.relative(path),
                            0,
                            “Symbolic-link file skipped.”,
                        )
                    )
                    continue

                if not stat.S_ISREG(metadata.st_mode):
                    continue

                relative = self.relative(path)
                self.known_files.add(relative)
                discovered.append(path)

        return sorted(discovered, key=lambda item: str(item).lower())

    # =========================================================================
    # INVENTORY
    # =========================================================================

    @staticmethod
    def category_for(path: Path) -> str:
        extension = path.suffix.lower()

        if extension in {“.html”, “.htm”}:
            return “web-page”

        if extension in {“.js”, “.mjs”, “.cjs”, “.jsx”, “.ts”, “.tsx”}:
            return “javascript”

        if extension == “.py”:
            return “python”

        if extension == “.css”:
            return “stylesheet”

        if extension == “.json”:
            return “json-data”

        if extension in {“.yml”, “.yaml”, “.toml”}:
            return “configuration”

        if extension in {“.md”, “.txt”}:
            return “documentation”

        if extension == “.sh”:
            return “shell”

        return “other”

    def inventory_file(self, path: Path) -> None:
        try:
            metadata = path.stat()

            if metadata.st_size > self.max_file_bytes:
                self.skipped_files += 1
                self.findings.append(
                    Finding(
                        “warning”,
                        “file-size”,
                        self.relative(path),
                        0,
                        f”Skipped file larger than {self.max_file_bytes} bytes.”,
                    )
                )
                return

            digest = hashlib.sha256()

            with path.open(“rb”) as handle:
                while True:
                    chunk = handle.read(1024 * 1024)

                    if not chunk:
                        break

                    digest.update(chunk)

            self.inventory.append(
                InventoryItem(
                    path=self.relative(path),
                    extension=path.suffix.lower(),
                    size=metadata.st_size,
                    sha256=digest.hexdigest(),
                    category=self.category_for(path),
                )
            )

            self.scanned_files += 1

        except OSError as exc:
            self.read_errors += 1
            self.findings.append(
                Finding(
                    “warning”,
                    “read-error”,
                    self.relative(path),
                    0,
                    str(exc),
                )
            )

    # =========================================================================
    # TEXT READING
    # =========================================================================

    def read_text(self, path: Path) -> str | None:
        try:
            if not self.safe_source_path(path):
                return None

            if path.stat().st_size > self.max_file_bytes:
                return None

            return path.read_text(
                encoding=“utf-8-sig”,
                errors=“replace”,
            )

        except OSError as exc:
            self.read_errors += 1
            self.findings.append(
                Finding(
                    “warning”,
                    “read-error”,
                    self.relative(path),
                    0,
                    str(exc),
                )
            )
            return None

    # =========================================================================
    # REFERENCE EXTRACTION
    # =========================================================================

    def add_reference(
        self,
        source: str,
        target: str,
        kind: str,
        line: int,
    ) -> None:

        if len(self.references) >= self.max_links:
            return

        target = target.strip()

        if not target:
            return

        self.references.append(
            Reference(
                source=source,
                target=target,
                kind=kind,
                line=line,
            )
        )

    def extract_html(self, path: Path, content: str) -> None:
        parser = HTMLReferenceParser()

        try:
            parser.feed(content)
            parser.close()
        except Exception as exc:
            self.findings.append(
                Finding(
                    “warning”,
                    “html-parse”,
                    self.relative(path),
                    0,
                    str(exc),
                )
            )
            return

        for kind, target, line in parser.references:
            self.add_reference(
                self.relative(path),
                target,
                kind,
                line,
            )

    def extract_css(self, path: Path, content: str) -> None:
        for match in CSS_REFERENCE_PATTERN.finditer(content):
            target = (
                match.group(“quoted”)
                or match.group(“plain”)
                or match.group(“imported”)
            )

            if target:
                line = content.count(“\n”, 0, match.start()) + 1

                self.add_reference(
                    self.relative(path),
                    target.strip(),
                    “css-reference”,
                    line,
                )

    def extract_javascript(self, path: Path, content: str) -> None:
        for match in JS_REFERENCE_PATTERN.finditer(content):
            target = (
                match.group(“target”)
                or match.group(“dynamic_target”)
            )

            if target:
                line = content.count(“\n”, 0, match.start()) + 1

                self.add_reference(
                    self.relative(path),
                    target,
                    “javascript-import”,
                    line,
                )

    def extract_python(self, path: Path, content: str) -> None:
        for match in PYTHON_REFERENCE_PATTERN.finditer(content):
            target = match.group(“target”)

            line = content.count(“\n”, 0, match.start()) + 1

            self.add_reference(
                self.relative(path),
                target,
                “python-file-reference”,
                line,
            )

    def extract_markdown(self, path: Path, content: str) -> None:
        for match in MARKDOWN_REFERENCE_PATTERN.finditer(content):
            target = match.group(1).strip()

            if target.startswith(“<“) and target.endswith(“>”):
                target = target[1:-1]

            target = target.split()[0] if target else “”

            line = content.count(“\n”, 0, match.start()) + 1

            self.add_reference(
                self.relative(path),
                target,
                “markdown-link”,
                line,
            )

    # =========================================================================
    # API ROUTE DISCOVERY
    # =========================================================================

    def extract_api_routes(self, path: Path, content: str) -> None:
        for match in API_ROUTE_PATTERN.finditer(content):
            groups = match.groups()

            # Keep route selection explicit and compatible with the
            # earlier connector’s four-group extraction convention.
            path_value = (
                groups[3]
                or groups[4]
                or “”
            )

            # Named-group extraction is authoritative for this version.
            route_path = (
                match.group(“literal”)
                or match.group(“dynamic”)
                or “”
            )

            if not route_path:
                continue

            dynamic = bool(match.group(“dynamic”))

            self.routes.append(
                ApiRoute(
                    source=self.relative(path),
                    receiver=match.group(“receiver”),
                    method=match.group(“method”).upper(),
                    path=route_path,
                    line=content.count(“\n”, 0, match.start()) + 1,
                    dynamic=dynamic,
                )
            )

    # =========================================================================
    # CONFLICT MARKERS
    # =========================================================================

    def extract_conflicts(self, path: Path, content: str) -> None:
        if not self.show_conflicts:
            return

        for line_number, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()

            marker = None

            if stripped.startswith(“<<<<<<<“):
                marker = “<<<<<<<“

            elif stripped == “=======“:
                marker = “=======“

            elif stripped.startswith(“>>>>>>>”):
                marker = “>>>>>>>”

            if marker:
                self.conflicts.append(
                    Conflict(
                        path=self.relative(path),
                        line=line_number,
                        marker=marker,
                        text=stripped[:300],
                    )
                )

    # =========================================================================
    # FILE SCANNING
    # =========================================================================

    def scan_file(self, path: Path) -> None:
        extension = path.suffix.lower()

        if extension not in REFERENCE_EXTENSIONS:
            return

        content = self.read_text(path)

        if content is None:
            return

        if extension in {“.html”, “.htm”}:
            self.extract_html(path, content)

        elif extension == “.css”:
            self.extract_css(path, content)

        elif extension in {
            “.js”, “.mjs”, “.cjs”, “.jsx”, “.ts”, “.tsx”
        }:
            self.extract_javascript(path, content)
            self.extract_api_routes(path, content)

        elif extension == “.py”:
            self.extract_python(path, content)

        elif extension == “.md”:
            self.extract_markdown(path, content)

        self.extract_conflicts(path, content)

    # =========================================================================
    # REFERENCE RESOLUTION
    # =========================================================================

    @staticmethod
    def is_external_reference(target: str) -> bool:
        value = target.strip()

        if not value:
            return True

        if value.startswith((“#”, “//“, “?”, “data:”, “blob:”)):
            return True

        try:
            parsed = urlsplit(value)
        except ValueError:
            return False

        return bool(
            parsed.scheme
            or parsed.netloc
        )

    @staticmethod
    def has_dynamic_reference(target: str) -> bool:
        return any(
            marker in target
            for marker in (
                “${“,
                “{{“,
                “}}”,
                “<%”,
                “%>”,
                “__dirname”,
                “process.env”,
                “import.meta”,
            )
        )

    def candidate_paths(
        self,
        source: str,
        target: str,
    ) -> list[str]:

        parsed = urlsplit(target)
        raw_path = unquote(parsed.path)

        if not raw_path:
            return [source]

        if “\\” in raw_path:
            return []

        if “\x00” in raw_path:
            return []

        source_parent = PurePosixPath(source).parent

        if raw_path.startswith(“/“):
            base = PurePosixPath(raw_path.lstrip(“/“))
        else:
            base = source_parent / raw_path

        normalized = PurePosixPath(os.path.normpath(str(base)))

        if normalized.is_absolute() or “..” in normalized.parts:
            return []

        candidate = normalized.as_posix()

        candidates = [candidate]

        if not PurePosixPath(candidate).suffix:
            candidates.extend(
                [
                    candidate + “.html”,
                    candidate + “.htm”,
                    candidate + “.js”,
                    candidate + “.mjs”,
                    candidate + “.css”,
                    candidate + “.json”,
                ]
            )

        candidates.extend(
            [
                candidate.rstrip(“/“) + “/index.html”,
                candidate.rstrip(“/“) + “/index.htm”,
            ]
        )

        return list(dict.fromkeys(candidates))

    def resolve_references(self) -> None:
        for reference in self.references:

            if self.is_external_reference(reference.target):
                reference.status = “external”
                continue

            if self.has_dynamic_reference(reference.target):
                reference.status = “dynamic”
                continue

            candidates = self.candidate_paths(
                reference.source,
                reference.target,
            )

            if not candidates:
                reference.status = “unsafe-or-invalid”
                continue

            matched = next(
                (
                    candidate
                    for candidate in candidates
                    if candidate in self.known_files
                ),
                None,
            )

            if matched:
                reference.status = “resolved”
                reference.resolved_path = matched
                continue

            directory_match = next(
                (
                    candidate
                    for candidate in candidates
                    if candidate in self.known_directories
                ),
                None,
            )

            if directory_match:
                reference.status = “directory-only”
                reference.resolved_path = directory_match
                continue

            reference.status = “broken”

    # =========================================================================
    # ADVISORY HTML SUGGESTIONS
    # =========================================================================

    def create_html_connection_proposals(self) -> list[dict[str, Any]]:
        “””
        Generate suggestions only.

        No HTML source file is modified.
        “””

        proposals = []

        for reference in self.references:
            if reference.status != “broken”:
                continue

            if not reference.kind.startswith(“html-“):
                continue

            proposals.append(
                {
                    “source”: reference.source,
                    “line”: reference.line,
                    “missing_target”: reference.target,
                    “suggestion”: (
                        “Verify the target path, filename, extension “
                        “and deployment base path.”
                    ),
                    “automatic_change”: False,
                }
            )

        return proposals

    # =========================================================================
    # COMPLETE SCAN
    # =========================================================================

    def scan(self) -> None:
        self.logger.info(“Discovering repository files.”)

        files = self.discover()

        self.logger.info(
            f”Discovered {len(files)} regular files.”
        )

        for path in files:
            self.inventory_file(path)
            self.scan_file(path)

        self.resolve_references()

    # =========================================================================
    # REPORT HELPERS
    # =========================================================================

    def dependency_edges(self) -> list[dict[str, Any]]:
        return [
            {
                “source”: item.source,
                “target”: item.resolved_path or item.target,
                “kind”: item.kind,
                “status”: item.status,
                “line”: item.line,
            }
            for item in self.references
        ]

    def broken_references(self) -> list[dict[str, Any]]:
        return [
            asdict(item)
            for item in self.references
            if item.status in {
                “broken”,
                “unsafe-or-invalid”,
                “directory-only”,
            }
        ]

    def unresolved_references(self) -> list[dict[str, Any]]:
        return [
            asdict(item)
            for item in self.references
            if item.status in {
                “dynamic”,
                “directory-only”,
                “unsafe-or-invalid”,
            }
        ]

    def summary(self) -> dict[str, Any]:
        statuses: dict[str, int] = defaultdict(int)

        for reference in self.references:
            statuses[reference.status] += 1

        return {
            “connector”: “MedOrbits Extra Repository Connector”,
            “version”: VERSION,
            “generated_at”: datetime.now(
                timezone.utc
            ).isoformat(),
            “repository”: str(self.root),
            “files_discovered”: len(self.known_files),
            “files_scanned”: self.scanned_files,
            “files_skipped”: self.skipped_files,
            “read_errors”: self.read_errors,
            “references”: len(self.references),
            “reference_statuses”: dict(statuses),
            “api_routes”: len(self.routes),
            “conflict_markers”: len(self.conflicts),
            “findings”: len(self.findings),
            “broken_references”: sum(
                1 for item in self.references
                if item.status == “broken”
            ),
        }

    # =========================================================================
    # REPORT WRITING
    # =========================================================================

    def report_directory(self) -> Path:
        directory = self.root / REPORT_DIRECTORY

        current = self.root

        for part in REPORT_DIRECTORY.parts:
            current = current / part

            try:
                metadata = current.lstat()
            except FileNotFoundError:
                continue

            if stat.S_ISLNK(metadata.st_mode):
                raise ValueError(
                    f”Report path contains a symbolic link: {current}”
                )

            if current != directory and not stat.S_ISDIR(metadata.st_mode):
                raise ValueError(
                    f”Report parent is not a directory: {current}”
                )

            if current == directory and not stat.S_ISDIR(metadata.st_mode):
                raise ValueError(
                    f”Report destination is not a directory: {current}”
                )

        directory.mkdir(
            parents=True,
            exist_ok=True,
        )

        if directory.is_symlink() or not directory.is_dir():
            raise ValueError(
                “Report destination is not a safe directory.”
            )

        return directory

    @staticmethod
    def atomic_write(path: Path, content: str) -> None:
        import tempfile

        descriptor, temporary_name = tempfile.mkstemp(
            prefix=“.connector-“,
            suffix=“.tmp”,
            dir=path.parent,
        )

        temporary = Path(temporary_name)

        try:
            with os.fdopen(
                descriptor,
                “w”,
                encoding=“utf-8”,
                newline=“\n”,
            ) as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())

            if path.is_symlink():
                raise ValueError(
                    f”Refusing to overwrite symbolic link: {path}”
                )

            os.replace(temporary, path)

        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass

    def write_json(
        self,
        directory: Path,
        name: str,
        data: Any,
    ) -> Path:

        path = directory / name

        content = json.dumps(
            data,
            indent=2,
            ensure_ascii=False,
        ) + “\n”

        self.atomic_write(path, content)

        return path

    def write_csv(
        self,
        directory: Path,
        name: str,
        rows: list[dict[str, Any]],
    ) -> Path:

        path = directory / name

        if rows:
            fieldnames = list(rows[0].keys())
        else:
            fieldnames = [“status”]

        from io import StringIO

        buffer = StringIO(newline=“”)

        writer = csv.DictWriter(
            buffer,
            fieldnames=fieldnames,
            extrasaction=“ignore”,
        )

        writer.writeheader()
        writer.writerows(rows)

        self.atomic_write(path, buffer.getvalue())

        return path

    def write_reports(self) -> list[Path]:
        directory = self.report_directory()

        prefix = f”extra-{self.timestamp}”

        proposals = self.create_html_connection_proposals()

        reports = [
            (
                f”{prefix}-summary.json”,
                self.summary(),
            ),
            (
                f”{prefix}-inventory.json”,
                [asdict(item) for item in self.inventory],
            ),
            (
                f”{prefix}-references.json”,
                [asdict(item) for item in self.references],
            ),
            (
                f”{prefix}-dependencies.json”,
                self.dependency_edges(),
            ),
            (
                f”{prefix}-broken-references.json”,
                self.broken_references(),
            ),
            (
                f”{prefix}-unresolved-references.json”,
                self.unresolved_references(),
            ),
            (
                f”{prefix}-api-routes.json”,
                [asdict(item) for item in self.routes],
            ),
            (
                f”{prefix}-conflicts.json”,
                [asdict(item) for item in self.conflicts],
            ),
            (
                f”{prefix}-findings.json”,
                [asdict(item) for item in self.findings],
            ),
            (
                f”{prefix}-html-suggestions.json”,
                proposals,
            ),
        ]

        written = []

        for name, data in reports:
            written.append(
                self.write_json(directory, name, data)
            )

        csv_reports = [
            (
                f”{prefix}-inventory.csv”,
                [asdict(item) for item in self.inventory],
            ),
            (
                f”{prefix}-references.csv”,
                [asdict(item) for item in self.references],
            ),
            (
                f”{prefix}-api-routes.csv”,
                [asdict(item) for item in self.routes],
            ),
            (
                f”{prefix}-conflicts.csv”,
                [asdict(item) for item in self.conflicts],
            ),
        ]

        for name, rows in csv_reports:
            written.append(
                self.write_csv(directory, name, rows)
            )

        return written

    # =========================================================================
    # FINAL STATUS
    # =========================================================================

    def has_strict_failures(self) -> bool:
        broken = any(
            item.status == “broken”
            for item in self.references
        )

        invalid = any(
            item.status == “unsafe-or-invalid”
            for item in self.references
        )

        errors = any(
            item.severity == “error”
            for item in self.findings
        )

        return broken or invalid or errors


# =============================================================================
# CLI
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=“Extended read-only MedOrbits repository scanner.”
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path.cwd(),
        help=“Repository root.”,
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Scan without writing reports.”,
    )

    parser.add_argument(
        “—include-hidden”,
        action=“store_true”,
        help=“Include hidden files and directories.”,
    )

    parser.add_argument(
        “—show-conflicts”,
        action=“store_true”,
        help=“Scan files for Git conflict markers.”,
    )

    parser.add_argument(
        “—max-links”,
        type=int,
        default=10000,
        help=“Maximum references to collect.”,
    )

    parser.add_argument(
        “—max-file-mb”,
        type=int,
        default=MAX_FILE_MB_DEFAULT,
        help=“Maximum file size to read, in MiB.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Return exit code 1 when broken references are found.”,
    )

    parser.add_argument(
        “—json-summary”,
        action=“store_true”,
        help=“Print the machine-readable summary to stdout.”,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.max_links < 1:
        print(“ERROR: —max-links must be at least 1.”, file=sys.stderr)
        return 2

    if args.max_file_mb < 1:
        print(“ERROR: —max-file-mb must be at least 1.”, file=sys.stderr)
        return 2

    try:
        root = args.root.expanduser().resolve(strict=True)

        if not root.is_dir():
            raise ValueError(“Repository root must be a directory.”)

        connector = RepositoryConnectorExtra(
            root=root,
            include_hidden=args.include_hidden,
            show_conflicts=args.show_conflicts,
            max_links=args.max_links,
            max_file_mb=args.max_file_mb,
        )

        connector.scan()

        summary = connector.summary()

        if args.json_summary:
            print(
                json.dumps(
                    summary,
                    indent=2,
                    ensure_ascii=False,
                )
            )
        else:
            print(“\nMedOrbits Extra Connector”)
            print(“=“ * 45)
            print(f”Repository:       {root}”)
            print(f”Files discovered: {summary[‘files_discovered’]}”)
            print(f”Files scanned:    {summary[‘files_scanned’]}”)
            print(f”Files skipped:    {summary[‘files_skipped’]}”)
            print(f”References:       {summary[‘references’]}”)
            print(f”Broken references:{summary[‘broken_references’]:>5}”)
            print(f”API routes:       {summary[‘api_routes’]}”)
            print(f”Conflict markers: {summary[‘conflict_markers’]}”)
            print(f”Findings:         {summary[‘findings’]}”)

        if args.dry_run:
            print(“\nDRY-RUN: No reports or source files were written.”)

        else:
            reports = connector.write_reports()

            print(
                f”\nReports generated: {len(reports)}”
            )

            print(
                “Report directory: “
                f”{root / REPORT_DIRECTORY}”
            )

        if args.strict and connector.has_strict_failures():
            print(
                “\nSTRICT CHECK FAILED: “
                “Broken references or errors were detected.”
            )
            return 1

        print(“\nConnector completed.”)
        print(“Repository source files were not modified.”)

        return 0

    except (OSError, ValueError, RuntimeError) as exc:
        print(
            f”ERROR: Repository connector failed: {exc}”,
            file=sys.stderr,
        )
        return 1


if __name__ == “__main__”:
    raise SystemExit(main())
