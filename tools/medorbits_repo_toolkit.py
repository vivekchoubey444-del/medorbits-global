
#!/usr/bin/env python3
"""
MedOrbits Repository Manager
============================

Version: 2.0.0
Python: 3.10+
Dependencies: Python standard library only.

Commands:
    inspect
    validate
    organize
    create
    download
    pages
    audit-pages

Examples:
    python tools/repository_manager.py inspect
    python tools/repository_manager.py validate
    python tools/repository_manager.py organize
    python tools/repository_manager.py organize --apply
    python tools/repository_manager.py create --manifest tools/content-manifest.json
    python tools/repository_manager.py create --manifest tools/content-manifest.json --apply
    python tools/repository_manager.py download --manifest tools/content-manifest.json
    python tools/repository_manager.py download --manifest tools/content-manifest.json --apply
    python tools/repository_manager.py pages
    python tools/repository_manager.py pages --apply
    python tools/repository_manager.py pages --apply --update
    python tools/repository_manager.py pages --manifest tools/site-pages.json --apply
    python tools/repository_manager.py pages --apply --discover
    python tools/repository_manager.py audit-pages
    python tools/repository_manager.py validate --json-report reports/repository-report.json

Safety:
    - Dry-run is the default for write operations.
    - Existing files are never overwritten by default.
    - Existing page updates require --update.
    - Existing pages are backed up before updates.
    - Downloads must be explicitly listed in a manifest.
    - Downloads are restricted to explicitly allowed hosts.
    - Downloaded files are never executed.
    - SQL is never executed.
    - No automatic guessed source-code repairs.
    - Paths are restricted to the repository root.
    - Symbolic links are not followed during repository scans.
    - Page discovery uses local repository files only.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import html
import html.parser
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable


VERSION = "2.0.0"

USER_AGENT = f"MedOrbitsRepositoryManager/{VERSION}"

MAX_DOWNLOAD_BYTES_DEFAULT = 20 * 1024 * 1024

ALLOWED_DOWNLOAD_SCHEMES = {"https", "http"}

DEFAULT_SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", ".venv", "venv",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    "dist", "build", "coverage", ".next", ".cache",
    ".idea", ".vscode", "vendor", "third_party", "generated",
}

PAGE_SKIP_DIRS = DEFAULT_SKIP_DIRS | {
    ".vercel", ".netlify", "playwright-report", "test-results",
}

EXTENSION_TARGETS = {
    ".pdf": "docs",
    ".doc": "docs",
    ".docx": "docs",
    ".odt": "docs",
    ".rtf": "docs",
    ".txt": "docs",
    ".md": "docs",
    ".csv": "data",
    ".xlsx": "data",
    ".xls": "data",
    ".ods": "data",
    ".jpg": "assets/images",
    ".jpeg": "assets/images",
    ".png": "assets/images",
    ".webp": "assets/images",
    ".gif": "assets/images",
    ".svg": "assets/images",
    ".avif": "assets/images",
    ".ico": "assets/images",
    ".html": "pages",
    ".htm": "pages",
    ".css": "assets/css",
    ".js": "assets/js",
    ".mjs": "assets/js",
    ".json": "data",
    ".jsonl": "data",
    ".yaml": "config",
    ".yml": "config",
    ".sql": "database/sql",
    ".py": "python",
}

BINARY_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".odt", ".rtf",
    ".xlsx", ".xls", ".ods", ".jpg", ".jpeg",
    ".png", ".webp", ".gif", ".avif", ".ico",
}

PAGE_EXTENSIONS = {".html", ".htm"}

DEFAULT_MANIFEST = "tools/content-manifest.json"
DEFAULT_PAGE_MANIFEST = "tools/site-pages.json"

PAGE_DEFAULTS = {
    "brand": "MedOrbits",
    "language": "en",
    "description": (
        "Explore education, medical admissions, colleges, courses, "
        "careers, study opportunities and guidance with MedOrbits."
    ),
    "primary_color": "#174a83",
    "secondary_color": "#6f4a83",
    "accent_color": "#c9a66b",
    "background_color": "#edf3fa",
}


# ---------------------------------------------------------------------------
# REPORTING
# ---------------------------------------------------------------------------

@dataclass
class Issue:
    severity: str
    code: str
    path: str
    message: str


@dataclass
class Report:
    root: str
    version: str = VERSION
    files_scanned: int = 0
    issues: list[Issue] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)

    def add(
        self,
        severity: str,
        code: str,
        path: Path | str,
        message: str,
    ) -> None:
        try:
            shown = str(
                Path(path).resolve().relative_to(Path(self.root).resolve())
            )
        except (ValueError, OSError):
            shown = str(path)

        self.issues.append(
            Issue(severity, code, shown, message)
        )

    @property
    def error_count(self) -> int:
        return sum(i.severity == "ERROR" for i in self.issues)

    @property
    def warning_count(self) -> int:
        return sum(i.severity == "WARN" for i in self.issues)


def print_report(report: Report) -> None:
    print(f"\nMedOrbits Repository Manager v{report.version}")
    print(f"Repository: {report.root}")
    print(f"Files scanned: {report.files_scanned}")

    for action in report.actions:
        print(f"[ACTION] {action}")

    for issue in report.issues:
        print(
            f"[{issue.severity}] {issue.code} "
            f"{issue.path}: {issue.message}"
        )

    print(
        f"\nSummary: {report.error_count} error(s), "
        f"{report.warning_count} warning(s)."
    )


def write_report(report: Report, path: Path) -> None:
    payload = {
        "root": report.root,
        "version": report.version,
        "files_scanned": report.files_scanned,
        "errors": report.error_count,
        "warnings": report.warning_count,
        "issues": [asdict(issue) for issue in report.issues],
        "actions": report.actions,
    }

    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(payload, stream, indent=2, ensure_ascii=False)
        stream.write("\n")


# ---------------------------------------------------------------------------
# PATH SAFETY AND FILE UTILITIES
# ---------------------------------------------------------------------------

def safe_relative_path(value: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Path must be a non-empty string.")

    raw = value.replace("\\", "/")

    if "\x00" in raw:
        raise ValueError("NUL bytes are not allowed in paths.")

    if raw.startswith("/") or re.match(r"^[A-Za-z]:", raw):
        raise ValueError(f"Absolute paths are not allowed: {value}")

    candidate = Path(raw)

    if any(part in {"..", "."} for part in candidate.parts):
        raise ValueError(
            f"Path traversal and dot segments are not allowed: {value}"
        )

    return candidate


def contained_path(root: Path, relative: str | Path) -> Path:
    root = root.resolve()
    candidate = (root / relative).resolve()

    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f"Path escapes repository root: {relative}"
        ) from exc

    return candidate


def iter_files(
    root: Path,
    skip_dirs: set[str] | None = None,
) -> Iterable[Path]:
    skipped = DEFAULT_SKIP_DIRS if skip_dirs is None else skip_dirs

    for current, dirs, filenames in os.walk(root, followlinks=False):
        dirs[:] = sorted(
            name
            for name in dirs
            if name not in skipped
            and not (Path(current) / name).is_symlink()
        )

        for filename in sorted(filenames):
            path = Path(current) / filename

            if path.is_symlink():
                continue

            yield path


def relative_display(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)

    return digest.hexdigest()


def detect_text_encoding(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()

    if b"\x00" in raw[:8192]:
        raise UnicodeError("File appears to be binary.")

    try:
        return raw.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        return raw.decode("latin-1"), "latin-1"


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise ValueError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid manifest JSON at line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc

    if not isinstance(data, dict):
        raise ValueError("Manifest root must be a JSON object.")

    return data


def resolve_manifest_path(root: Path, value: str) -> Path:
    supplied = Path(value)

    if supplied.is_absolute():
        result = supplied.resolve()
    else:
        result = contained_path(root, safe_relative_path(value))

    return result


def write_new_file(path: Path, content: str) -> bool:
    """Create a file exclusively. Never overwrite an existing path."""
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(content)

    return True


def backup_file(root: Path, target: Path) -> Path:
    """Create a timestamped, collision-safe backup inside the repository."""
    relative = target.relative_to(root.resolve())

    stamp = time.strftime("%Y%m%d-%H%M%S")
    base = Path("backups") / stamp / relative
    backup = contained_path(root, base.as_posix())

    backup.parent.mkdir(parents=True, exist_ok=True)

    candidate = backup
    counter = 1

    while candidate.exists():
        candidate = backup.with_name(
            f"{backup.name}.{counter}"
        )
        counter += 1

    shutil.copy2(target, candidate)
    return candidate


# ---------------------------------------------------------------------------
# HTML PARSING AND VALIDATION
# ---------------------------------------------------------------------------

class HTMLReferenceParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)

        self.references: list[tuple[str, str]] = []
        self.ids: set[str] = set()
        self.links: list[str] = []
        self.title_parts: list[str] = []

        self.in_title = False
        self.has_html = False
        self.has_head = False
        self.has_body = False
        self.has_main = False
        self.has_h1 = False
        self.has_footer = False
        self.has_viewport = False
        self.has_description = False

        self.main_count = 0
        self.heading_count = 0
        self.form_count = 0
        self.image_count = 0
        self.script_count = 0
        self.stylesheet_count = 0

    def handle_starttag(self, tag, attrs) -> None:
        tag = tag.lower()
        values = dict(attrs)

        if tag == "html":
            self.has_html = True
        elif tag == "head":
            self.has_head = True
        elif tag == "body":
            self.has_body = True
        elif tag == "main":
            self.has_main = True
            self.main_count += 1
        elif tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = (values.get("name") or "").lower()

            if name == "viewport":
                self.has_viewport = True

            if name == "description":
                self.has_description = True

        elif tag in {"h1", "h2", "h3"}:
            self.heading_count += 1

            if tag == "h1":
                self.has_h1 = True

        elif tag == "footer":
            self.has_footer = True
        elif tag == "form":
            self.form_count += 1
        elif tag == "img":
            self.image_count += 1
        elif tag == "script":
            self.script_count += 1
        elif tag == "link":
            rel = (values.get("rel") or "").lower().split()

            if "stylesheet" in rel:
                self.stylesheet_count += 1

        element_id = values.get("id")

        if element_id:
            self.ids.add(element_id)

        for attr in ("src", "href", "poster"):
            value = values.get(attr)

            if value:
                self.references.append((attr, value))

        if tag == "a" and values.get("href"):
            self.links.append(values["href"])

    def handle_endtag(self, tag) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data) -> None:
        if self.in_title:
            self.title_parts.append(data)


class PageLinkParser(HTMLReferenceParser):
    """Compatibility alias for page-discovery functionality."""


def is_external_reference(value: str) -> bool:
    stripped = value.strip()

    return (
        not stripped
        or stripped.startswith((
            "#", "data:", "mailto:", "tel:",
            "javascript:", "blob:",
        ))
        or bool(urllib.parse.urlparse(stripped).scheme)
        or stripped.startswith("//")
    )


def resolve_local_reference(
    source: Path,
    value: str,
    root: Path,
) -> Path | None:
    clean = urllib.parse.unquote(
        value.split("#", 1)[0].split("?", 1)[0]
    ).strip()

    if is_external_reference(clean) or not clean:
        return None

    if clean.startswith("/"):
        candidate = (root / clean.lstrip("/")).resolve()
    else:
        candidate = (source.parent / clean).resolve()

    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError(
            f"Reference escapes repository root: {value}"
        ) from exc

    return candidate


def parse_html(path: Path) -> tuple[str, HTMLReferenceParser]:
    source, _ = detect_text_encoding(path)

    parser = HTMLReferenceParser()
    parser.feed(source)
    parser.close()

    return source, parser


def check_html(path: Path, root: Path, report: Report) -> None:
    try:
        _, parser = parse_html(path)
    except (OSError, UnicodeError, Exception) as exc:
        report.add("ERROR", "HTML_PARSE", path, str(exc))
        return

    for attr, value in parser.references:
        try:
            target = resolve_local_reference(path, value, root)
        except ValueError as exc:
            report.add(
                "WARN", "HTML_UNSAFE_REFERENCE", path,
                f"{attr}={value!r}: {exc}",
            )
            continue

        if target is not None and not target.exists():
            report.add(
                "WARN", "HTML_BROKEN_REFERENCE", path,
                f"Missing local {attr}: {value}",
            )

    if not parser.has_html:
        report.add("WARN", "HTML_NO_ROOT", path, "Missing html element.")

    if not parser.has_head:
        report.add("WARN", "HTML_NO_HEAD", path, "Missing head element.")

    if not parser.has_body:
        report.add("WARN", "HTML_NO_BODY", path, "Missing body element.")

    if not parser.has_viewport:
        report.add(
            "WARN", "HTML_NO_VIEWPORT", path,
            "Missing responsive viewport metadata.",
        )

    if not parser.has_description:
        report.add(
            "WARN", "HTML_NO_DESCRIPTION", path,
            "Missing meta description.",
        )

    if not parser.has_main:
        report.add("WARN", "HTML_NO_MAIN", path, "Missing main element.")

    if not parser.has_h1:
        report.add("WARN", "HTML_NO_H1", path, "Missing primary heading.")


def check_css(path: Path, report: Report) -> None:
    try:
        text, _ = detect_text_encoding(path)
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "CSS_READ", path, str(exc))
        return

    stripped = re.sub(r"/\*.*?\*/", "", text, flags=re.S)

    if stripped.count("{") != stripped.count("}"):
        report.add(
            "ERROR", "CSS_BRACES", path,
            "Unbalanced CSS opening and closing braces.",
        )

    if stripped.count("(") != stripped.count(")"):
        report.add(
            "WARN", "CSS_PARENTHESES", path,
            "Possible unbalanced CSS parentheses.",
        )

    if "/*" in stripped:
        report.add(
            "WARN", "CSS_COMMENT",
            path, "Possible unclosed CSS comment.",
        )


def check_javascript(path: Path, report: Report) -> None:
    node = shutil.which("node")

    if not node:
        report.add(
            "WARN", "JS_CHECK_UNAVAILABLE", path,
            "Node.js unavailable; JavaScript syntax was not checked.",
        )
        return

    try:
        result = subprocess.run(
            [node, "--check", str(path)],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        report.add("WARN", "JS_CHECK_FAILED", path, str(exc))
        return

    if result.returncode:
        detail = (result.stderr or result.stdout).strip().splitlines()

        report.add(
            "ERROR", "JS_SYNTAX", path,
            " ".join(detail[-3:])[:700],
        )


def check_python(path: Path, report: Report) -> None:
    try:
        source, _ = detect_text_encoding(path)
        ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        report.add(
            "ERROR", "PYTHON_SYNTAX", path,
            f"Line {exc.lineno}, column {exc.offset}: {exc.msg}",
        )
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "PYTHON_READ", path, str(exc))


def check_json(path: Path, report: Report) -> None:
    try:
        json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        report.add(
            "ERROR", "JSON_SYNTAX", path,
            f"Line {exc.lineno}, column {exc.colno}: {exc.msg}",
        )
    except (OSError, UnicodeError) as exc:
        report.add("ERROR", "JSON_READ", path, str(exc))


def check_sql(path: Path, report: Report) -> None:
    try:
        source, _ = detect_text_encoding(path)
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "SQL_READ", path, str(exc))
        return

    if not source.strip():
        report.add("WARN", "SQL_EMPTY", path, "SQL file is empty.")

    if re.search(
        r"\b(DROP\s+DATABASE|TRUNCATE\s+TABLE)\b",
        source,
        flags=re.I,
    ):
        report.add(
            "WARN", "SQL_DESTRUCTIVE_STATEMENT", path,
            "Potentially destructive SQL found. It was not executed.",
        )


def validate_repository(root: Path, report: Report) -> None:
    files = list(iter_files(root))
    report.files_scanned = len(files)

    for path in files:
        suffix = path.suffix.lower()

        if suffix == ".py":
            check_python(path, report)

        elif suffix == ".json":
            check_json(path, report)

        elif suffix == ".jsonl":
            try:
                for number, line in enumerate(
                    path.read_text(encoding="utf-8").splitlines(), 1
                ):
                    if line.strip():
                        json.loads(line)
            except (
                OSError, UnicodeError, json.JSONDecodeError
            ) as exc:
                report.add(
                    "ERROR", "JSONL_SYNTAX", path,
                    f"Invalid JSONL: {exc}",
                )

        elif suffix in PAGE_EXTENSIONS:
            check_html(path, root, report)

        elif suffix == ".css":
            check_css(path, report)

        elif suffix in {".js", ".mjs", ".cjs"}:
            check_javascript(path, report)

        elif suffix == ".sql":
            check_sql(path, report)

    report.actions.append(
        f"Validated {len(files)} files without executing project code."
    )


# ---------------------------------------------------------------------------
# INSPECT AND ORGANIZE
# ---------------------------------------------------------------------------

def inspect_repository(root: Path, report: Report) -> None:
    counts: dict[str, int] = {}

    for path in iter_files(root):
        ext = path.suffix.lower() or "[no extension]"
        counts[ext] = counts.get(ext, 0) + 1

    report.files_scanned = sum(counts.values())
    report.actions.append("Extension inventory:")

    for ext, count in sorted(counts.items()):
        report.actions.append(f"  {ext}: {count}")


def organize_repository(
    root: Path,
    apply: bool,
    report: Report,
) -> None:
    root = root.resolve()
    proposals: list[tuple[Path, Path]] = []

    excluded = {
        ".html", ".htm", ".py", ".js", ".mjs",
        ".css", ".json", ".sql",
    }

    for source in iter_files(root):
        relative = source.relative_to(root)

        if len(relative.parts) < 2:
            continue

        suffix = source.suffix.lower()
        folder = EXTENSION_TARGETS.get(suffix)

        if not folder or suffix in excluded:
            continue

        if relative.parts[0] in {
            "assets", "docs", "data", "config", "database",
        }:
            continue

        target = root / folder / source.name

        if target.exists():
            report.add(
                "WARN", "ORGANIZE_COLLISION", source,
                f"Target exists: {relative_display(target, root)}",
            )
            continue

        proposals.append((source, target))

    if not proposals:
        report.actions.append("No safe organization moves found.")
        return

    for source, target in proposals:
        verb = "MOVE" if apply else "WOULD MOVE"

        report.actions.append(
            f"{verb}: {relative_display(source, root)} -> "
            f"{relative_display(target, root)}"
        )

        if not apply:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        if target.exists():
            report.add(
                "WARN", "ORGANIZE_RACE", source,
                "Target appeared during operation; skipped.",
            )
            continue

        shutil.move(str(source), str(target))

    if apply:
        report.actions.append(
            "Moves applied. Check references and review Git diff."
        )


# ---------------------------------------------------------------------------
# MANIFEST-BASED FILE CREATION
# ---------------------------------------------------------------------------

def create_from_manifest(
    root: Path,
    manifest_path: Path,
    apply: bool,
    report: Report,
) -> None:
    manifest = load_manifest(manifest_path)
    entries = manifest.get("files", [])

    if not isinstance(entries, list):
        raise ValueError("Manifest 'files' must be a list.")

    for entry in entries:
        if not isinstance(entry, dict):
            report.add(
                "ERROR", "MANIFEST_ENTRY", manifest_path,
                "Each file entry must be an object.",
            )
            continue

        try:
            relative = safe_relative_path(entry.get("path", ""))
            target = contained_path(root, relative)
        except ValueError as exc:
            report.add("ERROR", "MANIFEST_PATH", manifest_path, str(exc))
            continue

        content = entry.get("content", "")

        if not isinstance(content, str):
            report.add(
                "ERROR", "MANIFEST_CONTENT", relative,
                "File content must be a string.",
            )
            continue

        if target.exists() or target.is_symlink():
            report.add(
                "WARN", "CREATE_EXISTS", relative,
                "Existing path preserved.",
            )
            continue

        report.actions.append(
            f"{'CREATE' if apply else 'WOULD CREATE'}: {relative}"
        )

        if apply:
            try:
                write_new_file(target, content)
            except FileExistsError:
                report.add(
                    "WARN", "CREATE_RACE", relative,
                    "Path appeared during creation.",
                )


# ---------------------------------------------------------------------------
# MANIFEST-BASED DOWNLOADS
# ---------------------------------------------------------------------------

def download_from_manifest(
    root: Path,
    manifest_path: Path,
    apply: bool,
    report: Report,
    max_bytes: int,
    allowed_hosts: set[str],
) -> None:
    manifest = load_manifest(manifest_path)
    entries = manifest.get("downloads", [])

    if not isinstance(entries, list):
        raise ValueError("Manifest 'downloads' must be a list.")

    if max_bytes <= 0:
        raise ValueError("--max-bytes must be positive.")

    for entry in entries:
        if not isinstance(entry, dict):
            report.add(
                "ERROR", "DOWNLOAD_ENTRY", manifest_path,
                "Each download entry must be an object.",
            )
            continue

        url = entry.get("url")
        relative_value = entry.get("path")

        if not isinstance(url, str) or not isinstance(relative_value, str):
            report.add(
                "ERROR", "DOWNLOAD_FIELDS", manifest_path,
                "Each download needs string 'url' and 'path'.",
            )
            continue

        try:
            relative = safe_relative_path(relative_value)
            target = contained_path(root, relative)
        except ValueError as exc:
            report.add(
                "ERROR", "DOWNLOAD_PATH", manifest_path, str(exc)
            )
            continue

        parsed = urllib.parse.urlparse(url)
        hostname = (parsed.hostname or "").lower()

        if parsed.scheme != "https" or not hostname:
            report.add(
                "ERROR", "DOWNLOAD_URL", relative,
                "Only HTTPS download URLs are permitted.",
            )
            continue

        if parsed.username or parsed.password:
            report.add(
                "ERROR", "DOWNLOAD_URL_CREDENTIALS", relative,
                "Embedded URL credentials are rejected.",
            )
            continue

        if hostname not in allowed_hosts:
            report.add(
                "ERROR", "DOWNLOAD_HOST", relative,
                f"Host '{hostname}' is not allowlisted.",
            )
            continue

        if target.exists() or target.is_symlink():
            report.add(
                "WARN", "DOWNLOAD_EXISTS", relative,
                "Existing target preserved.",
            )
            continue

        report.actions.append(
            f"{'DOWNLOAD' if apply else 'WOULD DOWNLOAD'}: "
            f"{url} -> {relative}"
        )

        if not apply:
            continue

        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT},
        )

        temporary: Path | None = None

        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                final = urllib.parse.urlparse(response.geturl())
                final_host = (final.hostname or "").lower()

                if final.scheme != "https" or final_host not in allowed_hosts:
                    raise ValueError(
                        "Redirect target violates the HTTPS host allowlist."
                    )

                length = response.headers.get("Content-Length")

                if length and int(length) > max_bytes:
                    raise ValueError("Download exceeds size limit.")

                target.parent.mkdir(parents=True, exist_ok=True)

                fd, name = tempfile.mkstemp(
                    prefix=".download-",
                    dir=str(target.parent),
                )

                temporary = Path(name)
                size = 0

                with os.fdopen(fd, "wb") as output:
                    while True:
                        block = response.read(64 * 1024)

                        if not block:
                            break

                        size += len(block)

                        if size > max_bytes:
                            raise ValueError("Download exceeds size limit.")

                        output.write(block)

            if target.exists() or target.is_symlink():
                raise FileExistsError("Target appeared during download.")

            temporary.replace(target)
            temporary = None

            report.actions.append(
                f"DOWNLOADED: {relative} ({size} bytes; "
                f"sha256={sha256_file(target)})"
            )

        except (
            urllib.error.URLError,
            TimeoutError,
            OSError,
            ValueError,
        ) as exc:
            report.add(
                "ERROR", "DOWNLOAD_FAILED", relative, str(exc)
            )

        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# PAGE MANIFEST
# ---------------------------------------------------------------------------

def default_page_manifest() -> dict[str, Any]:
    return {
        "version": 1,
        "settings": {
            "brand": PAGE_DEFAULTS["brand"],
            "language": PAGE_DEFAULTS["language"],
            "description": PAGE_DEFAULTS["description"],
        },
        "pages": [
            {
                "path": "index.html",
                "title": "MedOrbits | Education and Admission Guidance",
                "description": (
                    "Explore medical admissions, colleges, courses, "
                    "careers and education guidance with MedOrbits."
                ),
                "category": "general",
                "intro": (
                    "Explore education opportunities, admission guidance "
                    "and career pathways with MedOrbits."
                ),
                "sections": [
                    "Medical admissions",
                    "Explore courses",
                    "Colleges and universities",
                    "Career opportunities",
                    "Student guidance",
                ],
                "related": [
                    "pages/about.html",
                    "pages/courses.html",
                    "pages/colleges.html",
                    "pages/careers.html",
                    "pages/contact.html",
                ],
            },
            {
                "path": "pages/about.html",
                "title": "About MedOrbits",
                "category": "general",
                "intro": (
                    "Learn about our education guidance approach, "
                    "services and student-support resources."
                ),
                "sections": [
                    "Our approach",
                    "What we offer",
                    "Student support",
                    "Our commitment",
                ],
                "related": [
                    "pages/services.html",
                    "pages/contact.html",
                ],
            },
            {
                "path": "pages/services.html",
                "title": "Education Consultancy Services",
                "category": "services",
                "intro": (
                    "Explore admission guidance, application support "
                    "and education-planning services."
                ),
                "sections": [
                    "Admission guidance",
                    "Application assistance",
                    "College shortlisting",
                    "Career planning",
                    "Document preparation",
                ],
                "related": [
                    "pages/contact.html",
                    "pages/admission-guide.html",
                ],
            },
            {
                "path": "pages/courses.html",
                "title": "Courses and Study Options",
                "category": "education",
                "intro": (
                    "Explore course categories and learn how to compare "
                    "eligibility, duration and career pathways."
                ),
                "sections": [
                    "MBBS and medical education",
                    "Dental and allied health",
                    "AYUSH programmes",
                    "Paramedical courses",
                    "Other academic pathways",
                ],
                "related": [
                    "pages/mbbs.html",
                    "pages/bds.html",
                    "pages/bams.html",
                    "pages/paramedical.html",
                ],
            },
            {
                "path": "pages/colleges.html",
                "title": "Colleges and Universities",
                "category": "education",
                "intro": (
                    "Research colleges, universities, programmes "
                    "and admission requirements."
                ),
                "sections": [
                    "College directory",
                    "University directory",
                    "Compare programmes",
                    "Eligibility and fees",
                    "How to verify official information",
                ],
                "related": [
                    "pages/courses.html",
                    "pages/mbbs.html",
                    "pages/admission-guide.html",
                ],
            },
            {
                "path": "pages/mbbs.html",
                "title": "MBBS Admission Guide",
                "category": "admissions",
                "intro": (
                    "Review the MBBS admission process, eligibility, "
                    "counselling stages and document preparation."
                ),
                "sections": [
                    "Eligibility overview",
                    "NEET UG and counselling",
                    "College research",
                    "Fees and budgeting",
                    "Required documents",
                    "Official verification checklist",
                ],
                "related": [
                    "pages/admission-guide.html",
                    "pages/colleges.html",
                    "pages/documents.html",
                ],
            },
            {
                "path": "pages/bds.html",
                "title": "BDS Admission Guide",
                "category": "admissions",
                "intro": (
                    "Explore dental education, eligibility and "
                    "admission-planning considerations."
                ),
                "sections": [
                    "Course overview",
                    "Eligibility",
                    "Entrance examination",
                    "Counselling and colleges",
                    "Document checklist",
                ],
                "related": [
                    "pages/mbbs.html",
                    "pages/courses.html",
                    "pages/documents.html",
                ],
            },
            {
                "path": "pages/bams.html",
                "title": "BAMS and AYUSH Admission Guide",
                "category": "admissions",
                "intro": (
                    "Explore AYUSH education pathways and verify "
                    "admission requirements through official sources."
                ),
                "sections": [
                    "Programme overview",
                    "Eligibility",
                    "Counselling process",
                    "College recognition",
                    "Document checklist",
                ],
                "related": [
                    "pages/courses.html",
                    "pages/colleges.html",
                    "pages/documents.html",
                ],
            },
            {
                "path": "pages/paramedical.html",
                "title": "Paramedical and Allied Health Courses",
                "category": "education",
                "intro": (
                    "Compare allied health course categories, "
                    "eligibility and career opportunities."
                ),
                "sections": [
                    "Course categories",
                    "Eligibility requirements",
                    "Institution selection",
                    "Career opportunities",
                    "Application documents",
                ],
                "related": [
                    "pages/courses.html",
                    "pages/careers.html",
                ],
            },
            {
                "path": "pages/admission-guide.html",
                "title": "Admission Guide",
                "category": "admissions",
                "intro": (
                    "Follow a structured checklist for researching "
                    "programmes and completing admission applications."
                ),
                "sections": [
                    "Research requirements",
                    "Check eligibility",
                    "Prepare documents",
                    "Submit applications",
                    "Track official deadlines",
                    "Verify offers and fees",
                ],
                "related": [
                    "pages/mbbs.html",
                    "pages/documents.html",
                    "pages/faqs.html",
                ],
            },
            {
                "path": "pages/documents.html",
                "title": "Admission Document Checklist",
                "category": "resources",
                "intro": (
                    "Prepare a course-specific document checklist "
                    "and verify each requirement with the authority."
                ),
                "sections": [
                    "Identity documents",
                    "Academic records",
                    "Entrance examination records",
                    "Category and domicile certificates where applicable",
                    "Counselling documents",
                    "Secure document handling",
                ],
                "related": [
                    "pages/admission-guide.html",
                    "pages/mbbs.html",
                    "pages/faqs.html",
                ],
            },
            {
                "path": "pages/careers.html",
                "title": "Careers and Opportunities",
                "category": "careers",
                "intro": (
                    "Explore career-planning resources, skill development "
                    "and education-to-employment pathways."
                ),
                "sections": [
                    "Career pathways",
                    "Skills and qualifications",
                    "Internships and apprenticeships",
                    "Job-search preparation",
                    "Professional development",
                ],
                "related": [
                    "pages/courses.html",
                    "pages/services.html",
                    "pages/contact.html",
                ],
            },
            {
                "path": "pages/faqs.html",
                "title": "Frequently Asked Questions",
                "category": "resources",
                "intro": (
                    "Find general guidance on admissions, courses, "
                    "documents and education planning."
                ),
                "sections": [
                    "Admission planning",
                    "Eligibility and examinations",
                    "Documents and applications",
                    "Fees and official notices",
                    "Contact and support",
                ],
                "related": [
                    "pages/admission-guide.html",
                    "pages/documents.html",
                    "pages/contact.html",
                ],
            },
            {
                "path": "pages/contact.html",
                "title": "Contact MedOrbits",
                "category": "general",
                "intro": (
                    "Use the verified contact channels published "
                    "by MedOrbits to request education guidance."
                ),
                "sections": [
                    "How to contact us",
                    "Information to prepare",
                    "Privacy and document safety",
                    "Frequently asked questions",
                ],
                "related": [
                    "pages/about.html",
                    "pages/services.html",
                    "pages/faqs.html",
                ],
            },
        ],
    }


def load_page_manifest(path: Path) -> dict[str, Any]:
    manifest = load_manifest(path)
    pages = manifest.get("pages", [])

    if not isinstance(pages, list):
        raise ValueError("'pages' must be a list.")

    seen: set[str] = set()

    for index, page in enumerate(pages):
        if not isinstance(page, dict):
            raise ValueError(f"Page entry {index} must be an object.")

        relative = safe_relative_path(page.get("path", ""))

        if relative.suffix.lower() not in PAGE_EXTENSIONS:
            raise ValueError(
                f"Page path must end in .html or .htm: {relative}"
            )

        key = relative.as_posix().lower()

        if key in seen:
            raise ValueError(f"Duplicate page path: {relative}")

        seen.add(key)

        for field_name in ("title", "description", "intro", "category"):
            value = page.get(field_name)

            if value is not None and not isinstance(value, str):
                raise ValueError(
                    f"Page field '{field_name}' must be a string."
                )

        for field_name in ("sections", "related", "keywords"):
            value = page.get(field_name)

            if value is not None and (
                not isinstance(value, list)
                or not all(isinstance(item, str) for item in value)
            ):
                raise ValueError(
                    f"Page field '{field_name}' must be a list of strings."
                )

        for related in page.get("related", []):
            safe_relative_path(related)

    settings = manifest.get("settings", {})

    if not isinstance(settings, dict):
        raise ValueError("'settings' must be an object.")

    return manifest


def page_manifest_index(
    manifest: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    index = {}

    for page in manifest.get("pages", []):
        path = safe_relative_path(page["path"]).as_posix()
        index[path.lower()] = page

    return index


# ---------------------------------------------------------------------------
# PAGE DISCOVERY
# ---------------------------------------------------------------------------

def discover_page_links(
    root: Path,
    report: Report,
) -> tuple[list[dict[str, Any]], set[str]]:
    root = root.resolve()
    discovered = []
    linked_paths: set[str] = set()

    for path in iter_files(root, PAGE_SKIP_DIRS):
        if path.suffix.lower() not in PAGE_EXTENSIONS:
            continue

        try:
            source, parser = parse_html(path)
        except Exception as exc:
            report.add(
                "WARN", "PAGE_DISCOVERY_READ", path, str(exc)
            )
            continue

        relative = relative_display(path, root)

        discovered.append({
            "path": relative,
            "title": "".join(parser.title_parts).strip()
                     or page_title_from_path(path),
            "source": source,
            "parser": parser,
        })

        for href in parser.links:
            try:
                target = resolve_local_reference(path, href, root)
            except ValueError as exc:
                report.add(
                    "WARN", "PAGE_LINK_UNSAFE", path,
                    f"Link {href!r}: {exc}",
                )
                continue

            if target is not None and target.suffix.lower() in PAGE_EXTENSIONS:
                linked_paths.add(
                    relative_display(target, root).lower()
                )

    discovered.sort(key=lambda item: item["path"].lower())

    return discovered, linked_paths


def page_title_from_path(path: Path) -> str:
    if path.name.lower() in {"index.html", "index.htm"}:
        if path.parent.name.lower() in {"", ".", "pages"}:
            return "Home"

        return path.parent.name.replace("-", " ").replace("_", " ").title()

    return path.stem.replace("-", " ").replace("_", " ").title()


def slugify_page_name(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "new-page"


def infer_related_pages(
    page_path: str,
    page_index: dict[str, dict[str, Any]],
    all_pages: list[dict[str, Any]],
    limit: int = 6,
) -> list[dict[str, str]]:
    current_key = page_path.lower()
    current = page_index.get(current_key, {})
    candidates: list[dict[str, str]] = []
    seen = {current_key}

    def add(path: str) -> None:
        try:
            relative = safe_relative_path(path).as_posix()
        except ValueError:
            return

        key = relative.lower()

        if key in seen:
            return

        seen.add(key)
        definition = page_index.get(key, {})

        candidates.append({
            "path": relative,
            "title": str(
                definition.get("title")
                or page_title_from_path(Path(relative))
            ),
        })

    for path in current.get("related", []):
        add(path)

    category = current.get("category")

    for item in all_pages:
        if len(candidates) >= limit:
            break

        definition = page_index.get(item["path"].lower(), {})

        if category and definition.get("category") == category:
            add(item["path"])

    for item in all_pages:
        if len(candidates) >= limit:
            break

        add(item["path"])

    return candidates[:limit]


def relative_url(from_path: str, to_path: str) -> str:
    source_parent = Path(from_path).parent
    target = Path(to_path)

    relative = os.path.relpath(
        target.as_posix(),
        source_parent.as_posix(),
    ).replace("\\", "/")

    return urllib.parse.quote(relative, safe="/-._~")


def page_escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def shared_asset_path(
    root: Path,
    page_path: str,
    candidates: tuple[str, ...],
) -> str | None:
    for candidate in candidates:
        target = root / candidate

        if target.is_file() and not target.is_symlink():
            return relative_url(page_path, candidate)

    return None


# ---------------------------------------------------------------------------
# COMPLETE HTML PAGE GENERATION
# ---------------------------------------------------------------------------

def render_page_navigation(
    page_path: str,
    pages: list[dict[str, Any]],
    limit: int = 8,
) -> str:
    links = []

    for item in pages:
        if item["path"].lower() == page_path.lower():
            continue

        href = relative_url(page_path, item["path"])

        links.append(
            f'<a href="{page_escape(href)}">'
            f'{page_escape(item["title"])}</a>'
        )

        if len(links) >= limit:
            break

    return "\n".join(links)


def render_section(title: str, index: int, page: dict[str, Any]) -> str:
    slug = slugify_page_name(title)
    heading = page_escape(title)

    return f"""
<section class="content-section" id="{slug}">
  <div class="section-heading">
    <span class="eyebrow">SECTION {index:02d}</span>
    <h2>{heading}</h2>
  </div>
  <p>
    Explore the relevant requirements, available options and next steps
    for {heading.lower()}. Verify eligibility, fees, deadlines and
    official procedures with the relevant institution or authority
    before making an application or payment.
  </p>
  <a class="text-link" href="#contact">
    Get guidance <span aria-hidden="true">→</span>
  </a>
</section>
""".strip()


def render_page(
    root: Path,
    page_path: str,
    definition: dict[str, Any],
    all_pages: list[dict[str, Any]],
    manifest: dict[str, Any],
) -> str:
    settings = {**PAGE_DEFAULTS, **manifest.get("settings", {})}

    title = definition.get("title") or page_title_from_path(Path(page_path))
    description = (
        definition.get("description")
        or settings["description"]
    )
    intro = definition.get("intro") or (
        f"Explore {title.lower()} and review the information "
        "needed to plan your next steps."
    )

    brand = settings["brand"]
    language = settings["language"]

    primary = settings.get("primary_color", "#174a83")
    secondary = settings.get("secondary_color", "#6f4a83")
    accent = settings.get("accent_color", "#c9a66b")
    background = settings.get("background_color", "#edf3fa")

    # Validate CSS custom-property colors before embedding them.
    color_pattern = re.compile(r"^#[0-9a-fA-F]{3,8}$")

    for color in (primary, secondary, accent, background):
        if not isinstance(color, str) or not color_pattern.fullmatch(color):
            raise ValueError(
                f"Invalid hexadecimal theme color for {page_path}: {color!r}"
            )

    sections = definition.get("sections", [])

    if not sections:
        sections = [
            "Overview",
            "Requirements and eligibility",
            "Important considerations",
            "Next steps",
        ]

    if not all(isinstance(item, str) and item.strip() for item in sections):
        raise ValueError(
            f"Sections must contain non-empty strings: {page_path}"
        )

    related = infer_related_pages(
        page_path,
        page_manifest_index(manifest),
        all_pages,
    )

    nav_html = render_page_navigation(page_path, all_pages)
    related_html = "\n".join(
        (
            '<li><a href="'
            + page_escape(relative_url(page_path, item["path"]))
            + '">'
            + page_escape(item["title"])
            + '</a></li>'
        )
        for item in related
    )

    sections_html = "\n\n".join(
        render_section(section, number, definition)
        for number, section in enumerate(sections, 1)
    )

    css_href = shared_asset_path(
        root,
        page_path,
        (
            "assets/css/style.css",
            "assets/css/main.css",
            "assets/css/global.css",
            "assets/css/styles.css",
            "assets/css/index.css",
        ),
    )

    js_href = shared_asset_path(
        root,
        page_path,
        (
            "assets/js/main.js",
            "assets/js/app.js",
            "assets/js/global.js",
            "assets/js/index.js",
        ),
    )

    css_tag = (
        f'<link rel="stylesheet" href="{page_escape(css_href)}">'
        if css_href
        else ""
    )

    js_tag = (
        f'<script src="{page_escape(js_href)}" defer></script>'
        if js_href
        else ""
    )

    # If shared assets do not exist, provide a complete self-contained page.
    inline_css = ""
    if not css_href:
        inline_css = f"""
<style>
:root {{
  color-scheme: light;
  --brand-primary: {primary};
  --brand-secondary: {secondary};
  --brand-accent: {accent};
  --page-background: {background};
  --text: #182638;
  --muted: #52647a;
  --surface: #f8f5ef;
  --border: #d6dfeb;
  --radius: 20px;
  --shadow: 0 16px 48px rgba(22,45,70,.09);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system,
               BlinkMacSystemFont, "Segoe UI", sans-serif;
}}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
body {{
  margin: 0;
  background:
    radial-gradient(ellipse at top left, #d9e7f8 0, transparent 45%),
    linear-gradient(135deg, var(--page-background), #f2eaf5 55%, #e7efe9);
  color: var(--text);
  line-height: 1.7;
}}
a {{ color: var(--brand-primary); }}
a:focus-visible, button:focus-visible {{
  outline: 3px solid var(--brand-accent);
  outline-offset: 4px;
}}
.container {{ width: min(1120px, calc(100% - 36px)); margin-inline: auto; }}
.site-header {{
  position: sticky; top: 0; z-index: 10;
  background: rgba(239,244,250,.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
}}
.header-inner {{
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; min-height: 76px; flex-wrap: wrap;
}}
.brand {{ font-size: 1.35rem; font-weight: 850; text-decoration: none; }}
.nav-links {{ display: flex; gap: 16px; flex-wrap: wrap; }}
.nav-links a {{ text-decoration: none; font-size: .93rem; font-weight: 650; }}
.hero {{ padding: clamp(56px, 9vw, 110px) 0 64px; }}
.hero-card {{
  padding: clamp(24px, 5vw, 64px);
  background: linear-gradient(135deg, #e5edf8, #f3e9f1 58%, #e7eee8);
  border: 1px solid rgba(255,255,255,.7);
  border-radius: 28px; box-shadow: var(--shadow);
}}
.eyebrow {{
  display: inline-block; color: var(--brand-secondary);
  font-size: .78rem; font-weight: 800; letter-spacing: .13em;
  text-transform: uppercase;
}}
h1 {{ font-size: clamp(2.2rem, 6vw, 4.4rem); line-height: 1.1; margin: 16px 0; }}
h2 {{ line-height: 1.25; font-size: clamp(1.45rem, 3vw, 2.2rem); }}
.hero p {{ max-width: 760px; font-size: 1.1rem; color: var(--muted); }}
.button {{
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; padding: 12px 19px; border-radius: 999px;
  color: #fff; background: var(--brand-primary);
  text-decoration: none; font-weight: 750; border: 0;
}}
.button-secondary {{ background: var(--brand-secondary); }}
.content-section {{
  padding: 28px; margin: 24px 0;
  background: rgba(248,245,239,.88);
  border: 1px solid var(--border); border-radius: var(--radius);
}}
.content-section p {{ color: var(--muted); }}
.text-link {{ font-weight: 750; text-decoration: none; }}
.related-list {{
  display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
  gap: 12px; padding: 0; list-style: none;
}}
.related-list a {{
  display: block; height: 100%; padding: 16px;
  background: #e8eef7; border-radius: 14px;
  text-decoration: none; font-weight: 700;
}}
.site-footer {{
  margin-top: 60px; padding: 36px 0;
  background: #1c3048; color: #e9edf4;
}}
.site-footer a {{ color: #e5d3ae; }}
.footer-grid {{
  display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr));
  gap: 24px;
}}
.site-footer h2 {{ font-size: 1.1rem; }}
@media(max-width:640px) {{
  .header-inner {{ padding: 12px 0; }}
  .nav-links {{ gap: 10px; }}
  .hero {{ padding-top: 30px; }}
  .content-section {{ padding: 20px; }}
}}
@media(prefers-reduced-motion:reduce) {{
  html {{ scroll-behavior: auto; }}
  *,*::before,*::after {{ animation-duration:.01ms!important; transition-duration:.01ms!important; }}
}}
</style>
"""

    # Do not claim a form is connected to a backend.
    return f"""<!doctype html>
<html lang="{page_escape(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="{page_escape(primary)}">
  <meta name="description" content="{page_escape(description)}">
  <meta name="author" content="{page_escape(brand)}">
  <meta name="robots" content="index,follow">
  <title>{page_escape(title)} | {page_escape(brand)}</title>
  {css_tag}
  {inline_css}
</head>
<body>
  <a href="#main-content" class="skip-link"
     style="position:absolute;left:-9999px;top:auto">
    Skip to main content
  </a>

  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="{page_escape(relative_url(page_path, 'index.html'))}"
         aria-label="{page_escape(brand)} home">
        {page_escape(brand)}
      </a>
      <nav class="nav-links" aria-label="Main navigation">
        {nav_html}
      </nav>
    </div>
  </header>

  <main id="main-content">
    <section class="hero">
      <div class="container">
        <div class="hero-card">
          <span class="eyebrow">Education • Guidance • Opportunities</span>
          <h1>{page_escape(title)}</h1>
          <p>{page_escape(intro)}</p>
          <a class="button" href="#content">Explore this page</a>
          <a class="button button-secondary"
             href="#contact" style="margin-left:8px">
            Get guidance
          </a>
        </div>
      </div>
    </section>

    <div class="container" id="content">
      {sections_html}

      <section class="content-section" id="related">
        <span class="eyebrow">Continue exploring</span>
        <h2>Related resources</h2>
        <p>
          Browse related MedOrbits pages to continue your research.
          Confirm current requirements with the relevant official authority.
        </p>
        <ul class="related-list">
          {related_html}
        </ul>
      </section>

      <section class="content-section" id="contact">
        <span class="eyebrow">Student support</span>
        <h2>Need further guidance?</h2>
        <p>
          Review your requirements and contact MedOrbits through its
          verified, published communication channels.
        </p>
        <a class="button"
           href="{page_escape(relative_url(page_path, 'pages/contact.html'))}">
          Contact MedOrbits
        </a>
      </section>
    </div>
  </main>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <section>
          <h2>{page_escape(brand)}</h2>
          <p>
            Education information, admission planning and career guidance.
          </p>
        </section>
        <section>
          <h2>Explore</h2>
          <p>
            <a href="{page_escape(relative_url(page_path, 'pages/courses.html'))}">
              Courses
            </a>
          </p>
          <p>
            <a href="{page_escape(relative_url(page_path, 'pages/colleges.html'))}">
              Colleges
            </a>
          </p>
          <p>
            <a href="{page_escape(relative_url(page_path, 'pages/careers.html'))}">
              Careers
            </a>
          </p>
        </section>
        <section>
          <h2>Support</h2>
          <p>
            <a href="{page_escape(relative_url(page_path, 'pages/faqs.html'))}">
              FAQs
            </a>
          </p>
          <p>
            <a href="{page_escape(relative_url(page_path, 'pages/contact.html'))}">
              Contact
            </a>
          </p>
        </section>
      </div>
      <p>
        © {time.strftime("%Y")} {page_escape(brand)}.
        Verify admissions, fees, eligibility and deadlines using official sources.
      </p>
    </div>
  </footer>

  {js_tag}
</body>
</html>
"""


# ---------------------------------------------------------------------------
# PAGE COMPLETENESS AND IMPROVEMENT
# ---------------------------------------------------------------------------

def page_completeness(
    source: str,
    parser: HTMLReferenceParser,
) -> tuple[int, list[str]]:
    checks = {
        "HTML root": parser.has_html,
        "head": parser.has_head,
        "body": parser.has_body,
        "responsive viewport": parser.has_viewport,
        "meta description": parser.has_description,
        "main content": parser.has_main,
        "primary heading": parser.has_h1,
        "page title": bool("".join(parser.title_parts).strip()),
        "navigation": bool(parser.links),
        "footer": parser.has_footer,
    }

    missing = [label for label, present in checks.items() if not present]
    score = round(100 * (len(checks) - len(missing)) / len(checks))

    if not source.strip():
        return 0, list(checks.keys())

    return score, missing


def discover_missing_pages(
    root: Path,
    manifest: dict[str, Any],
    report: Report,
) -> list[dict[str, str]]:
    discovered, _ = discover_page_links(root, report)
    existing = {item["path"].lower() for item in discovered}
    missing = []

    for definition in manifest.get("pages", []):
        relative = safe_relative_path(definition["path"]).as_posix()

        if relative.lower() not in existing:
            missing.append({
                "path": relative,
                "title": definition.get("title") or page_title_from_path(
                    Path(relative)
                ),
            })

    return missing


def audit_pages(root: Path, report: Report) -> None:
    discovered, linked_paths = discover_page_links(root, report)
    report.files_scanned = len(discovered)

    for item in discovered:
        parser = item["parser"]
        score, missing = page_completeness(item["source"], parser)

        report.actions.append(
            f"PAGE {item['path']}: completeness={score}%"
        )

        if missing:
            report.add(
                "WARN", "PAGE_INCOMPLETE", item["path"],
                "Missing: " + ", ".join(missing),
            )

        if item["path"].lower() not in linked_paths:
            if Path(item["path"]).name.lower() not in {
                "index.html", "index.htm",
            }:
                report.add(
                    "WARN", "PAGE_ORPHAN", item["path"],
                    "No local HTML page links to this page.",
                )

    report.actions.append(
        f"Discovered {len(discovered)} HTML pages."
    )


def create_page_manifest(
    root: Path,
    manifest_path: Path,
    apply: bool,
    report: Report,
) -> None:
    content = (
        json.dumps(default_page_manifest(), indent=2, ensure_ascii=False)
        + "\n"
    )

    if manifest_path.exists():
        report.actions.append(
            f"Manifest already exists: {manifest_path.relative_to(root)}"
        )
        return

    relative = manifest_path.relative_to(root)
    report.actions.append(
        f"{'CREATE' if apply else 'WOULD CREATE'} page manifest: {relative}"
    )

    if apply:
        write_new_file(manifest_path, content)


def pages_command(
    root: Path,
    manifest_path: Path,
    apply: bool,
    update: bool,
    discover: bool,
    report: Report,
) -> None:
    root = root.resolve()
    manifest_path = manifest_path.resolve()

    try:
        manifest_path.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            "Page manifest must be inside the repository root."
        ) from exc

    if not manifest_path.exists():
        create_page_manifest(root, manifest_path, apply, report)

        if not apply:
            report.actions.append(
                "Re-run with --apply to create the default manifest."
            )
            return

    manifest = load_page_manifest(manifest_path)
    settings = {**PAGE_DEFAULTS, **manifest.get("settings", {})}

    if not isinstance(settings.get("brand"), str):
        raise ValueError("Manifest setting 'brand' must be a string.")

    if discover:
        discovered, linked = discover_page_links(root, report)
        existing = {item["path"].lower() for item in discovered}

        for item in discovered:
            parser = item["parser"]
            score, missing = page_completeness(item["source"], parser)

            report.actions.append(
                f"DISCOVERED {item['path']}: {score}% complete"
            )

            if missing:
                report.actions.append(
                    f"  Missing features: {', '.join(missing)}"
                )

            if (
                item["path"].lower() not in linked
                and Path(item["path"]).name.lower()
                not in {"index.html", "index.htm"}
            ):
                report.actions.append(
                    f"  Review navigation: {item['path']}"
                )

        for definition in manifest.get("pages", []):
            relative = safe_relative_path(definition["path"]).as_posix()

            if relative.lower() not in existing:
                report.actions.append(
                    f"DISCOVERED MISSING PAGE: {relative}"
                )

    all_pages, _ = discover_page_links(root, report)
    index = page_manifest_index(manifest)

    for definition in manifest.get("pages", []):
        relative = safe_relative_path(definition["path"]).as_posix()
        target = contained_path(root, relative)

        if target.is_symlink():
            report.add(
                "ERROR", "PAGE_SYMLINK", relative,
                "Page target is a symbolic link; skipped.",
            )
            continue

        if target.exists():
            try:
                source, parser = parse_html(target)
            except Exception as exc:
                report.add(
                    "ERROR", "PAGE_READ", relative, str(exc)
                )
                continue

            score, missing = page_completeness(source, parser)

            if not update:
                report.actions.append(
                    f"PRESERVE {relative}: {score}% complete"
                    + (
                        f"; missing {', '.join(missing)}"
                        if missing else ""
                    )
                )
                continue

            try:
                new_content = render_page(
                    root,
                    relative,
                    definition,
                    all_pages,
                    manifest,
                )
            except (ValueError, OSError) as exc:
                report.add(
                    "ERROR", "PAGE_RENDER", relative, str(exc)
                )
                continue

            if source == new_content:
                report.actions.append(
                    f"UNCHANGED {relative}: generated content matches."
                )
                continue

            report.actions.append(
                f"{'UPDATE' if apply else 'WOULD UPDATE'} {relative}"
            )

            if apply:
                try:
                    backup = backup_file(root, target)

                    with target.open(
                        "w", encoding="utf-8", newline="\n"
                    ) as stream:
                        stream.write(new_content)

                    report.actions.append(
                        f"BACKUP {relative_display(backup, root)}"
                    )

                except OSError as exc:
                    report.add(
                        "ERROR", "PAGE_UPDATE_FAILED", relative, str(exc)
                    )

            continue

        try:
            new_content = render_page(
                root,
                relative,
                definition,
                all_pages,
                manifest,
            )
        except (ValueError, OSError) as exc:
            report.add("ERROR", "PAGE_RENDER", relative, str(exc))
            continue

        report.actions.append(
            f"{'CREATE' if apply else 'WOULD CREATE'} {relative}"
        )

        if apply:
            try:
                write_new_file(target, new_content)
                all_pages.append({
                    "path": relative,
                    "title": definition.get("title")
                             or page_title_from_path(Path(relative)),
                    "source": new_content,
                    "parser": HTMLReferenceParser(),
                })
            except FileExistsError:
                report.add(
                    "WARN", "PAGE_CREATE_RACE", relative,
                    "Page appeared during generation; preserved.",
                )
            except OSError as exc:
                report.add(
                    "ERROR", "PAGE_CREATE_FAILED", relative, str(exc)
                )

    report.actions.append(
        "Page generation finished. Run validate and audit-pages next."
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--root",
        default=None,
        help="Repository root. Defaults to the parent of this script directory.",
    )

    parser.add_argument(
        "--json-report",
        default=None,
        help="Write a JSON report inside the repository.",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        required=True,
    )

    subparsers.add_parser(
        "inspect",
        help="Inventory repository file extensions.",
    )

    subparsers.add_parser(
        "validate",
        help="Validate Python, JSON, HTML references, CSS, JS and SQL warnings.",
    )

    organize = subparsers.add_parser(
        "organize",
        help="Propose or apply safe asset organization moves.",
    )

    organize.add_argument(
        "--apply",
        action="store_true",
        help="Apply proposed moves. Default: dry-run.",
    )

    create = subparsers.add_parser(
        "create",
        help="Create files from a JSON manifest.",
    )

    create.add_argument(
        "--manifest",
        required=True,
        help="Manifest path relative to the repository root.",
    )

    create.add_argument(
        "--apply",
        action="store_true",
        help="Write files. Default: dry-run.",
    )

    download = subparsers.add_parser(
        "download",
        help="Download explicitly listed HTTPS resources.",
    )

    download.add_argument(
        "--manifest",
        required=True,
        help="Manifest path relative to the repository root.",
    )

    download.add_argument(
        "--apply",
        action="store_true",
        help="Perform downloads. Default: dry-run.",
    )

    download.add_argument(
        "--max-bytes",
        type=int,
        default=MAX_DOWNLOAD_BYTES_DEFAULT,
    )

    download.add_argument(
        "--allow-host",
        action="append",
        default=[],
        help="Allowed exact HTTPS hostname. Repeat for additional hosts.",
    )

    pages = subparsers.add_parser(
        "pages",
        help="Generate missing HTML pages and optionally update existing pages.",
    )

    pages.add_argument(
        "--manifest",
        default=DEFAULT_PAGE_MANIFEST,
        help="Page manifest path relative to repository root.",
    )

    pages.add_argument(
        "--apply",
        action="store_true",
        help="Create or update files. Default: dry-run.",
    )

    pages.add_argument(
        "--update",
        action="store_true",
        help="Replace existing HTML pages after making backups.",
    )

    pages.add_argument(
        "--discover",
        action="store_true",
        help="Report existing pages, missing pages and navigation issues.",
    )

    audit = subparsers.add_parser(
        "audit-pages",
        help="Audit HTML page completeness and navigation.",
    )

    audit.add_argument(
        "--manifest",
        default=None,
        help="Optional page manifest to compare against.",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    script_path = Path(__file__).resolve()

    root = (
        Path(args.root).resolve()
        if args.root
        else script_path.parent.parent.resolve()
    )

    if not root.exists() or not root.is_dir():
        print(
            f"ERROR: Repository root is not a directory: {root}",
            file=sys.stderr,
        )
        return 2

    report = Report(root=str(root))

    try:
        if args.command == "inspect":
            inspect_repository(root, report)

        elif args.command == "validate":
            validate_repository(root, report)

        elif args.command == "organize":
            organize_repository(root, args.apply, report)

        elif args.command == "create":
            manifest_path = resolve_manifest_path(
                root, args.manifest
            )

            create_from_manifest(
                root,
                manifest_path,
                args.apply,
                report,
            )

        elif args.command == "download":
            manifest_path = resolve_manifest_path(
                root, args.manifest
            )

            manifest = load_manifest(manifest_path)

            configured = manifest.get("allowed_hosts", [])

            if not isinstance(configured, list):
                raise ValueError("'allowed_hosts' must be a list.")

            hosts = {
                str(host).strip().lower()
                for host in (args.allow_host or configured)
                if str(host).strip()
            }

            if not hosts:
                raise ValueError(
                    "No download hosts allowed. Configure allowed_hosts "
                    "in the manifest or pass --allow-host."
                )

            download_from_manifest(
                root,
                manifest_path,
                args.apply,
                report,
                args.max_bytes,
                hosts,
            )

        elif args.command == "pages":
            manifest_path = resolve_manifest_path(
                root, args.manifest
            )

            pages_command(
                root,
                manifest_path,
                args.apply,
                args.update,
                args.discover,
                report,
            )

        elif args.command == "audit-pages":
            audit_pages(root, report)

            if args.manifest:
                manifest_path = resolve_manifest_path(
                    root, args.manifest
                )

                manifest = load_page_manifest(manifest_path)

                missing = discover_missing_pages(
                    root,
                    manifest,
                    report,
                )

                for item in missing:
                    report.add(
                        "WARN", "PAGE_MANIFEST_MISSING",
                        item["path"],
                        f"Page '{item['title']}' is listed in the manifest "
                        "but does not exist.",
                    )

    except (ValueError, OSError, json.JSONDecodeError) as exc:
        report.add("ERROR", "COMMAND_FAILED", root, str(exc))

    print_report(report)

    if args.json_report:
        try:
            report_path = resolve_manifest_path(
                root, args.json_report
            )

            write_report(report, report_path)
            print(f"JSON report: {report_path}")

        except (ValueError, OSError) as exc:
            print(
                f"ERROR: Could not write report: {exc}",
                file=sys.stderr,
            )
            return 2

    return 1 if report.error_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
