#!/usr/bin/env python3
"""
MedOrbits Repository Manager
============================

A safe-by-default helper for organizing assets, creating requested files,
downloading explicitly configured resources, checking syntax, and auditing
local references across a mixed HTML/CSS/JavaScript/Python/JSON/SQL repository.

Python: 3.10+
Dependencies: Python standard library only.

Examples:
  python tools/repository_manager.py inspect
  python tools/repository_manager.py validate
  python tools/repository_manager.py organize --dry-run
  python tools/repository_manager.py organize --apply
  python tools/repository_manager.py create --manifest tools/content-manifest.json
  python tools/repository_manager.py download --manifest tools/content-manifest.json
  python tools/repository_manager.py validate --json-report tools/repository-report.json

Safety:
- Never overwrites an existing file by default.
- Downloads only URLs explicitly listed in a manifest.
- Rejects unsafe paths and limits download size.
- Does not execute downloaded files, run SQL, deploy, or silently rewrite code.
- Python syntax issues are reported, not automatically "fixed" with guessed edits.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import html.parser
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable

VERSION = "1.0.0"
DEFAULT_SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", "dist", "build",
    "coverage", ".next", ".cache",
}
EXTENSION_TARGETS = {
    # Documents
    ".pdf": "docs",
    ".doc": "docs", ".docx": "docs", ".odt": "docs", ".rtf": "docs",
    ".txt": "docs", ".md": "docs", ".csv": "data",
    ".xlsx": "data", ".xls": "data", ".ods": "data",
    # Images
    ".jpg": "assets/images", ".jpeg": "assets/images", ".png": "assets/images",
    ".webp": "assets/images", ".gif": "assets/images", ".svg": "assets/images",
    ".avif": "assets/images", ".ico": "assets/images",
    # Web assets
    ".html": "pages", ".htm": "pages",
    ".css": "assets/css", ".js": "assets/js", ".mjs": "assets/js",
    # Data and database
    ".json": "data", ".jsonl": "data", ".yaml": "config", ".yml": "config",
    ".sql": "database/sql",
    # Python source and tests are not moved automatically; only reported.
    ".py": "python",
}
BINARY_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".odt", ".rtf", ".xlsx", ".xls", ".ods",
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".ico",
}
ALLOWED_DOWNLOAD_SCHEMES = {"https", "http"}
MAX_DOWNLOAD_BYTES_DEFAULT = 20 * 1024 * 1024
USER_AGENT = f"MedOrbitsRepositoryManager/{VERSION}"


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

    def add(self, severity: str, code: str, path: Path | str, message: str) -> None:
        try:
            shown_path = str(Path(path).resolve().relative_to(Path(self.root).resolve()))
        except (ValueError, OSError):
            shown_path = str(path)
        self.issues.append(Issue(severity, code, shown_path, message))

    @property
    def error_count(self) -> int:
        return sum(i.severity == "ERROR" for i in self.issues)

    @property
    def warning_count(self) -> int:
        return sum(i.severity == "WARN" for i in self.issues)


def safe_relative_path(value: str) -> Path:
    """Return a safe relative path or raise ValueError."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Path must be a non-empty string.")
    raw = value.replace("\\", "/")
    candidate = Path(raw)
    if candidate.is_absolute() or re.match(r"^[A-Za-z]:", raw):
        raise ValueError(f"Absolute paths are not allowed: {value}")
    if any(part in {"..", "."} for part in candidate.parts):
        raise ValueError(f"Path traversal or dot segments are not allowed: {value}")
    if "\x00" in raw:
        raise ValueError("NUL bytes are not allowed in paths.")
    return candidate


def iter_files(root: Path, skip_dirs: set[str] | None = None) -> Iterable[Path]:
    skipped = skip_dirs or DEFAULT_SKIP_DIRS
    for current, dirs, filenames in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in skipped and not (Path(current) / d).is_symlink())
        for filename in sorted(filenames):
            path = Path(current) / filename
            if path.is_symlink():
                continue
            yield path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Manifest not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid manifest JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc
    if not isinstance(data, dict):
        raise ValueError("Manifest root must be a JSON object.")
    return data


def relative_display(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def detect_text_encoding(path: Path) -> tuple[str, str]:
    raw = path.read_bytes()
    if b"\x00" in raw[:8192]:
        raise UnicodeError("File appears to be binary.")
    try:
        return raw.decode("utf-8-sig"), "utf-8"
    except UnicodeDecodeError:
        # Latin-1 is only a fallback for reporting; do not rewrite the file.
        return raw.decode("latin-1"), "latin-1"


def check_python(path: Path, report: Report) -> None:
    try:
        text, _ = detect_text_encoding(path)
        ast.parse(text, filename=str(path))
    except SyntaxError as exc:
        report.add(
            "ERROR", "PYTHON_SYNTAX", path,
            f"SyntaxError at line {exc.lineno}, column {exc.offset}: {exc.msg}",
        )
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "PYTHON_READ", path, str(exc))


def check_json(path: Path, report: Report) -> None:
    try:
        json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        report.add(
            "ERROR", "JSON_SYNTAX", path,
            f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}",
        )
    except (OSError, UnicodeError) as exc:
        report.add("ERROR", "JSON_READ", path, str(exc))


class HTMLReferenceParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, str]] = []
        self.ids: set[str] = set()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            self.ids.add(element_id)
        for key in ("src", "href", "poster"):
            value = values.get(key)
            if value:
                self.references.append((key, value))
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])


def is_external_reference(value: str) -> bool:
    stripped = value.strip()
    return (
        not stripped
        or stripped.startswith(("#", "data:", "mailto:", "tel:", "javascript:", "blob:"))
        or bool(urllib.parse.urlparse(stripped).scheme)
        or stripped.startswith("//")
    )


def resolve_local_reference(source: Path, value: str, root: Path) -> Path | None:
    clean = urllib.parse.unquote(value.split("#", 1)[0].split("?", 1)[0]).strip()
    if is_external_reference(clean):
        return None
    if not clean:
        return None
    if clean.startswith("/"):
        candidate = (root / clean.lstrip("/")).resolve()
    else:
        candidate = (source.parent / clean).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        raise ValueError(f"Reference escapes repository root: {value}")
    return candidate


def check_html(path: Path, root: Path, report: Report) -> None:
    try:
        text, _ = detect_text_encoding(path)
        parser = HTMLReferenceParser()
        parser.feed(text)
        parser.close()
    except (OSError, UnicodeError) as exc:
        report.add("ERROR", "HTML_READ", path, str(exc))
        return
    except Exception as exc:
        report.add("ERROR", "HTML_PARSE", path, str(exc))
        return

    for attr, value in parser.references:
        try:
            target = resolve_local_reference(path, value, root)
        except ValueError as exc:
            report.add("WARN", "HTML_UNSAFE_REFERENCE", path, f"{attr}={value!r}: {exc}")
            continue
        if target is not None and not target.exists():
            report.add("WARN", "HTML_BROKEN_REFERENCE", path, f"Missing local {attr}: {value}")


def check_css(path: Path, report: Report) -> None:
    try:
        text, _ = detect_text_encoding(path)
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "CSS_READ", path, str(exc))
        return
    # A lightweight sanity check, not a complete CSS parser.
    if text.count("{") != text.count("}"):
        report.add("ERROR", "CSS_BRACES", path, "Unbalanced opening and closing braces.")
    if re.search(r"/\*.*?\*/", text, flags=re.S) is None and "/*" in text and "*/" not in text:
        report.add("WARN", "CSS_COMMENT", path, "Possible unclosed CSS comment.")


def check_javascript(path: Path, report: Report) -> None:
    # Syntax is checked with Node.js when available; otherwise report limitation.
    node = shutil.which("node")
    if not node:
        report.add("WARN", "JS_CHECK_UNAVAILABLE", path, "Node.js unavailable; JavaScript syntax not checked.")
        return
    try:
        result = subprocess.run(
            [node, "--check", str(path)],
            capture_output=True, text=True, timeout=15, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        report.add("WARN", "JS_CHECK_FAILED", path, str(exc))
        return
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        report.add("ERROR", "JS_SYNTAX", path, " ".join(detail[-3:])[:700])


def check_sql(path: Path, report: Report) -> None:
    try:
        text, _ = detect_text_encoding(path)
    except (OSError, UnicodeError) as exc:
        report.add("WARN", "SQL_READ", path, str(exc))
        return
    if not text.strip():
        report.add("WARN", "SQL_EMPTY", path, "SQL file is empty.")
        return
    # Deliberately no SQL execution. This only flags common accidental blanks.
    if re.search(r"\b(DROP\s+DATABASE|TRUNCATE\s+TABLE)\b", text, flags=re.I):
        report.add(
            "WARN", "SQL_DESTRUCTIVE_STATEMENT", path,
            "Contains a potentially destructive SQL statement; review manually. Not executed.",
        )


def validate_repository(root: Path, report: Report) -> None:
    root = root.resolve()
    files = list(iter_files(root))
    report.files_scanned = len(files)
    for path in files:
        suffix = path.suffix.lower()
        if suffix == ".py":
            check_python(path, report)
        elif suffix in {".json", ".jsonl"}:
            if suffix == ".json":
                check_json(path, report)
            else:
                try:
                    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                        if line.strip():
                            json.loads(line)
                except (OSError, UnicodeError, json.JSONDecodeError) as exc:
                    report.add("ERROR", "JSONL_SYNTAX", path, f"Invalid JSONL: {exc}")
        elif suffix in {".html", ".htm"}:
            check_html(path, root, report)
        elif suffix == ".css":
            check_css(path, report)
        elif suffix in {".js", ".mjs", ".cjs"}:
            check_javascript(path, report)
        elif suffix == ".sql":
            check_sql(path, report)

    # Detect likely Python import references that may be missing is intentionally
    # not automated here: imports can be third-party, namespace packages, or dynamic.
    report.actions.append(f"Validated {len(files)} files without executing project code.")


def inspect_repository(root: Path, report: Report) -> None:
    root = root.resolve()
    counts: dict[str, int] = {}
    for path in iter_files(root):
        ext = path.suffix.lower() or "[no extension]"
        counts[ext] = counts.get(ext, 0) + 1
    report.files_scanned = sum(counts.values())
    report.actions.append("Extension inventory:")
    for ext, count in sorted(counts.items()):
        report.actions.append(f"  {ext}: {count}")


def organize_repository(root: Path, apply: bool, report: Report) -> None:
    """
    Propose moves into common asset folders.
    HTML and Python files are not moved by default because routes/imports may rely
    on their locations. For all other file types, only moves into absent targets
    are proposed. Existing target names are never overwritten.
    """
    root = root.resolve()
    proposals: list[tuple[Path, Path]] = []
    for source in iter_files(root):
        rel = source.relative_to(root)
        if len(rel.parts) < 2:
            continue
        suffix = source.suffix.lower()
        target_folder = EXTENSION_TARGETS.get(suffix)
        if not target_folder or suffix in {".html", ".htm", ".py", ".js", ".mjs", ".css", ".json", ".sql"}:
            continue
        if rel.parts[0] in {"assets", "docs", "data", "config", "database"}:
            continue
        target = root / target_folder / source.name
        if target == source:
            continue
        if target.exists():
            report.add("WARN", "ORGANIZE_COLLISION", source,
                       f"Target exists; skipped move to {relative_display(target, root)}")
            continue
        proposals.append((source, target))

    if not proposals:
        report.actions.append("No safe file organization moves found.")
        return

    for source, target in proposals:
        report.actions.append(
            f"{'MOVE' if apply else 'WOULD MOVE'}: "
            f"{relative_display(source, root)} -> {relative_display(target, root)}"
        )
        if not apply:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            report.add("WARN", "ORGANIZE_RACE", source, "Target appeared during organization; skipped.")
            continue
        shutil.move(str(source), str(target))
    if apply:
        report.actions.append("Organization moves applied. Review references and Git diff.")


def create_from_manifest(root: Path, manifest_path: Path, apply: bool, report: Report) -> None:
    manifest = load_manifest(manifest_path)
    entries = manifest.get("files", [])
    if not isinstance(entries, list):
        raise ValueError("Manifest 'files' must be a list.")

    for entry in entries:
        if not isinstance(entry, dict):
            report.add("ERROR", "MANIFEST_ENTRY", manifest_path, "Each files entry must be an object.")
            continue
        try:
            relative = safe_relative_path(entry.get("path", ""))
        except ValueError as exc:
            report.add("ERROR", "MANIFEST_PATH", manifest_path, str(exc))
            continue
        content = entry.get("content", "")
        if not isinstance(content, str):
            report.add("ERROR", "MANIFEST_CONTENT", relative.as_posix(), "File content must be a string.")
            continue
        target = (root / relative).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            report.add("ERROR", "MANIFEST_PATH", relative.as_posix(), "Target escapes repository root.")
            continue
        if target.exists() or target.is_symlink():
            report.add("WARN", "CREATE_EXISTS", relative.as_posix(), "Existing path preserved; no overwrite.")
            continue
        report.actions.append(f"{'CREATE' if apply else 'WOULD CREATE'}: {relative.as_posix()}")
        if apply:
            target.parent.mkdir(parents=True, exist_ok=True)
            # Exclusive creation prevents overwriting a file created concurrently.
            try:
                with target.open("x", encoding="utf-8", newline="") as stream:
                    stream.write(content)
                    if content and not content.endswith("\n"):
                        stream.write("\n")
            except FileExistsError:
                report.add("WARN", "CREATE_RACE", relative.as_posix(), "Path appeared during creation.")
                continue


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

    for entry in entries:
        if not isinstance(entry, dict):
            report.add("ERROR", "DOWNLOAD_ENTRY", manifest_path, "Each download entry must be an object.")
            continue
        url = entry.get("url")
        relative_value = entry.get("path")
        if not isinstance(url, str) or not isinstance(relative_value, str):
            report.add("ERROR", "DOWNLOAD_FIELDS", manifest_path, "Each download needs string 'url' and 'path'.")
            continue
        try:
            relative = safe_relative_path(relative_value)
        except ValueError as exc:
            report.add("ERROR", "DOWNLOAD_PATH", manifest_path, str(exc))
            continue

        parsed = urllib.parse.urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if parsed.scheme not in ALLOWED_DOWNLOAD_SCHEMES or not hostname:
            report.add("ERROR", "DOWNLOAD_URL", relative.as_posix(), "Only explicit HTTP/HTTPS URLs are supported.")
            continue
        if allowed_hosts and hostname not in allowed_hosts:
            report.add("ERROR", "DOWNLOAD_HOST", relative.as_posix(),
                       f"Host '{hostname}' is not in the manifest allowlist.")
            continue
        if parsed.username or parsed.password:
            report.add("ERROR", "DOWNLOAD_URL_CREDENTIALS", relative.as_posix(),
                       "URLs containing embedded credentials are rejected.")
            continue

        target = (root / relative).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            report.add("ERROR", "DOWNLOAD_PATH", relative.as_posix(), "Target escapes repository root.")
            continue
        if target.exists() or target.is_symlink():
            report.add("WARN", "DOWNLOAD_EXISTS", relative.as_posix(), "Existing path preserved; no overwrite.")
            continue

        report.actions.append(f"{'DOWNLOAD' if apply else 'WOULD DOWNLOAD'}: {url} -> {relative.as_posix()}")
        if not apply:
            continue

        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        temp_path: Path | None = None
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                final_url = response.geturl()
                final_parsed = urllib.parse.urlparse(final_url)
                final_host = (final_parsed.hostname or "").lower()
                if final_parsed.scheme not in ALLOWED_DOWNLOAD_SCHEMES:
                    raise ValueError("Redirected URL uses an unsupported scheme.")
                if allowed_hosts and final_host not in allowed_hosts:
                    raise ValueError(f"Redirected host '{final_host}' is not in the allowlist.")
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > max_bytes:
                    raise ValueError(f"Download exceeds size limit ({max_bytes} bytes).")
                target.parent.mkdir(parents=True, exist_ok=True)
                fd, temp_name = tempfile.mkstemp(prefix=".download-", dir=str(target.parent))
                temp_path = Path(temp_name)
                size = 0
                with os.fdopen(fd, "wb") as output:
                    while True:
                        block = response.read(64 * 1024)
                        if not block:
                            break
                        size += len(block)
                        if size > max_bytes:
                            raise ValueError(f"Download exceeds size limit ({max_bytes} bytes).")
                        output.write(block)
            if target.exists() or target.is_symlink():
                raise FileExistsError(f"Target appeared during download: {target}")
            temp_path.replace(target)
            temp_path = None
            report.actions.append(f"DOWNLOADED: {relative.as_posix()} ({size} bytes; sha256={sha256_file(target)})")
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            report.add("ERROR", "DOWNLOAD_FAILED", relative.as_posix(), str(exc))
        finally:
            if temp_path is not None:
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass


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
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def print_report(report: Report) -> None:
    print(f"\nMedOrbits Repository Manager v{report.version}")
    print(f"Root: {report.root}")
    print(f"Files scanned: {report.files_scanned}")
    for action in report.actions:
        print(f"[ACTION] {action}")
    for issue in report.issues:
        print(f"[{issue.severity}] {issue.code} {issue.path}: {issue.message}")
    print(f"\nSummary: {report.error_count} error(s), {report.warning_count} warning(s).")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=None, help="Repository root (default: parent of this script's directory).")
    parser.add_argument("--json-report", default=None, help="Optional JSON report path, relative to repository root.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("inspect", help="Inventory repository file extensions.")
    subparsers.add_parser("validate", help="Validate Python, JSON, HTML references, CSS, JS, and SQL warnings.")

    organize = subparsers.add_parser("organize", help="Propose or apply safe asset organization moves.")
    organize.add_argument("--apply", action="store_true", help="Apply proposed moves; default is dry-run.")

    create = subparsers.add_parser("create", help="Create files listed in a JSON manifest without overwriting.")
    create.add_argument("--manifest", required=True, help="Manifest path, relative to repository root unless absolute.")
    create.add_argument("--apply", action="store_true", help="Write files; default is dry-run.")

    download = subparsers.add_parser("download", help="Download explicitly listed manifest resources.")
    download.add_argument("--manifest", required=True, help="Manifest path, relative to repository root unless absolute.")
    download.add_argument("--apply", action="store_true", help="Perform downloads; default is dry-run.")
    download.add_argument("--max-bytes", type=int, default=MAX_DOWNLOAD_BYTES_DEFAULT)
    download.add_argument(
        "--allow-host", action="append", default=[],
        help="Allowed exact hostname. Repeat for each host. If none supplied, manifest must define allowed_hosts.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    script_path = Path(__file__).resolve()
    root = Path(args.root).resolve() if args.root else script_path.parent.parent.resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: repository root is not a directory: {root}", file=sys.stderr)
        return 2

    report = Report(root=str(root))
    try:
        if args.command == "inspect":
            inspect_repository(root, report)
        elif args.command == "validate":
            validate_repository(root, report)
        elif args.command == "organize":
            organize_repository(root, bool(args.apply), report)
        elif args.command == "create":
            manifest_path = Path(args.manifest)
            if not manifest_path.is_absolute():
                manifest_path = root / safe_relative_path(args.manifest)
            create_from_manifest(root, manifest_path, bool(args.apply), report)
        elif args.command == "download":
            manifest_path = Path(args.manifest)
            if not manifest_path.is_absolute():
                manifest_path = root / safe_relative_path(args.manifest)
            manifest = load_manifest(manifest_path)
            hosts = set(args.allow_host or manifest.get("allowed_hosts", []))
            if not hosts:
                raise ValueError(
                    "No download hosts allowed. Set 'allowed_hosts' in the manifest or pass --allow-host."
                )
            if args.max_bytes <= 0:
                raise ValueError("--max-bytes must be a positive integer.")
            download_from_manifest(
                root, manifest_path, bool(args.apply), report, args.max_bytes,
                {str(host).lower() for host in hosts},
            )
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        report.add("ERROR", "COMMAND_FAILED", root, str(exc))

    print_report(report)
    if args.json_report:
        try:
            report_path = Path(args.json_report)
            if not report_path.is_absolute():
                report_path = root / safe_relative_path(args.json_report)
            report_path = report_path.resolve()
            report_path.relative_to(root.resolve())
            write_report(report, report_path)
            print(f"JSON report: {report_path}")
        except (ValueError, OSError) as exc:
            print(f"ERROR: could not write JSON report: {exc}", file=sys.stderr)
            return 2
    return 1 if report.error_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
