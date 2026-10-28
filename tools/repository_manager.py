#!/usr/bin/env python3
"""
MedOrbits Repository Connector
==============================

Version 3.0.0

Read-only repository inventory, dependency/reference scanner, API route
candidate inventory, conflict-marker detector, and advisory HTML connection
planner.

Safety properties:
- Never edits application source files or deletes files.
- Never executes discovered source code or runs Git commands.
- Does not follow directory symlinks; ignores file symlinks.
- Resolves local references conservatively and rejects paths outside root.
- Writes reports only below tools/repository-reports/.
- Uses atomic replacement for individual report files.
- Never applies HTML connection suggestions automatically.
- Uses only the Python standard library.

Python 3.10+

Examples:
    python tools/repository_connector.py
    python tools/repository_connector.py --root .
    python tools/repository_connector.py --dry-run
    python tools/repository_connector.py --include-hidden
    python tools/repository_connector.py --show-conflicts
    python tools/repository_connector.py --max-links 12
    python tools/repository_connector.py --max-file-mb 20
    python tools/repository_connector.py --strict
    python tools/repository_connector.py --json-summary
"""

from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import html
import json
import os
import re
import sys
import tempfile
import time

from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


VERSION = "3.0.0"
REPORT_DIRECTORY = Path("tools") / "repository-reports"

SOURCE_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".json", ".jsonc",
    ".py", ".md", ".mdx", ".xml", ".svg", ".webmanifest",
    ".yml", ".yaml", ".toml", ".ini", ".txt",
    ".sh", ".sql", ".php", ".vue", ".svelte",
}
ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif",
    ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".wav", ".pdf",
    ".doc", ".docx", ".xls", ".xlsx", ".zip",
}
SCAN_EXTENSIONS = SOURCE_EXTENSIONS | ASSET_EXTENSIONS
BINARY_EXTENSIONS = ASSET_EXTENSIONS - {".svg"}

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", ".idea", ".vscode",
    "node_modules", "vendor", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".next", ".nuxt",
    ".turbo", ".cache", ".parcel-cache", "dist", "build",
    "coverage", ".venv", "venv", ".tox", "playwright-report",
    "test-results", "storage", "tmp", "temp",
}
REPORT_DIR_REL = REPORT_DIRECTORY.as_posix()

IGNORE_URL_SCHEMES = {
    "http", "https", "mailto", "tel", "data", "javascript",
    "blob", "ftp", "sms", "ws", "wss", "file",
}
DYNAMIC_PREFIXES = (
    "{{", "{%", "${", "process.env", "import.meta.env",
    "env(", "var(", "currentcolor",
)
CONFLICT_MARKER_RE = re.compile(
    r"^(?:<{7}(?:\s|$)|={7}(?:\s|$)|>{7}(?:\s|$)|\|{7}(?:\s|$))"
)
HTML_ATTR_RE = re.compile(
    r"""(?P<name>
        href|src|action|poster|data-src|data-href|
        srcset|data-background|data-image
    )\s*=\s*(?P<q>["'])(?P<value>.*?)(?P=q)""",
    re.IGNORECASE | re.DOTALL | re.VERBOSE,
)
CSS_URL_RE = re.compile(
    r"""url\(\s*(?:["'](?P<quoted>[^"']*)["']|(?P<plain>[^)]*?))\s*\)""",
    re.IGNORECASE,
)
CSS_IMPORT_RE = re.compile(
    r"""@import\s+(?:url\(\s*)?["'](?P<url>[^"']+)["']""",
    re.IGNORECASE,
)
JS_IMPORT_RE = re.compile(
    r"""(?:\bimport\s+(?:[^"'`]*?\s+from\s+)?|
             \bexport\s+[^"'`]*?\s+from\s+)
            ["'](?P<url>[^"']+)["']
        |\bimport\(\s*["'](?P<dynamic>[^"']+)["']\s*\)
        |\brequire\(\s*["'](?P<require>[^"']+)["']\s*\)""",
    re.VERBOSE,
)
FETCH_RE = re.compile(
    r"""(?:\bfetch|
          \baxios\.(?:get|post|put|patch|delete)|
          \brequest)
        \s*\(\s*["'`]([^"'`]+)["'`]""",
    re.IGNORECASE | re.VERBOSE,
)
PATH_CANDIDATE_RE = re.compile(
    r"""["']([^"'\n]+\.
        (?:html?|css|m?js|c?js|jsx|tsx?|json|jsonc|
           svg|png|jpe?g|webp|avif|ico|pdf|woff2?|xml)
    )["']""",
    re.IGNORECASE | re.VERBOSE,
)
API_RE = re.compile(
    r"""(?:
        \b(?:app|router|server)\s*\.\s*
        (?P<method>get|post|put|patch|delete|options|head|use|all)\s*
        \(\s*["'`](?P<route>[^"'`]+)
        |
        \b(?:fetch|axios\.(?:get|post|put|patch|delete)|request)\s*
        \(\s*["'`](?P<request>[^"'`]+)
    )""",
    re.IGNORECASE | re.VERBOSE,
)
JSON_REF_KEYS = {
    "src", "href", "url", "path", "file", "image", "icon",
    "logo", "stylesheet", "script", "template", "schema",
    "endpoint", "baseurl", "asset", "assetpath",
}


@dataclass
class Reference:
    source: str
    line: int
    kind: str
    target: str
    status: str = "unresolved"
    resolved_path: str = ""
    note: str = ""


@dataclass
class ApiRoute:
    source: str
    line: int
    method: str
    path: str
    kind: str


def rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, max(0, offset)) + 1


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (UnicodeDecodeError, OSError):
        return None


def clean_target(target: str) -> str:
    return html.unescape(target.strip()).replace("\\/", "/")


def is_external_or_dynamic(target: str) -> bool:
    value = target.strip()
    if not value:
        return False
    if value.startswith(DYNAMIC_PREFIXES):
        return True
    try:
        parts = urlsplit(value)
    except ValueError:
        return False
    return parts.scheme.lower() in IGNORE_URL_SCHEMES or value.startswith("//")


def excluded_directory(name: str, include_hidden: bool) -> bool:
    if name in EXCLUDED_DIRS or name == "repository-reports":
        return True
    return not include_hidden and name.startswith(".")


def path_is_report_area(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True
    return relative.as_posix() == REPORT_DIR_REL or relative.as_posix().startswith(REPORT_DIR_REL + "/")


def walk_repository(root: Path, include_hidden: bool = False) -> tuple[list[Path], list[dict]]:
    results: list[Path] = []
    warnings: list[dict] = []

    def onerror(exc: OSError) -> None:
        warnings.append({
            "file": str(getattr(exc, "filename", "") or ""),
            "error": f"Directory traversal failed: {exc}",
        })

    for current, dirs, filenames in os.walk(
        root, topdown=True, onerror=onerror, followlinks=False
    ):
        current_path = Path(current)
        safe_dirs = []
        for name in dirs:
            candidate = current_path / name
            if excluded_directory(name, include_hidden):
                continue
            try:
                if candidate.is_symlink():
                    continue
            except OSError:
                continue
            safe_dirs.append(name)
        dirs[:] = safe_dirs

        for name in filenames:
            path = current_path / name
            try:
                if path.is_symlink() or not path.is_file():
                    continue
                if path.suffix.lower() not in SCAN_EXTENSIONS:
                    continue
                if path_is_report_area(path, root):
                    continue
                if not include_hidden and any(
                    part.startswith(".") for part in path.relative_to(root).parts
                ):
                    continue
                results.append(path)
            except (OSError, ValueError) as exc:
                warnings.append({
                    "file": str(path),
                    "error": f"File inspection failed: {exc}",
                })

    results.sort(key=lambda p: rel(p, root).casefold())
    return results, warnings


def collect_known_directories(root: Path, include_hidden: bool = False) -> set[str]:
    result: set[str] = set()
    for current, dirs, _ in os.walk(root, topdown=True, followlinks=False):
        current_path = Path(current)
        safe_dirs = []
        for name in dirs:
            candidate = current_path / name
            if excluded_directory(name, include_hidden):
                continue
            try:
                if candidate.is_symlink():
                    continue
            except OSError:
                continue
            safe_dirs.append(name)
            result.add(rel(candidate, root))
        dirs[:] = safe_dirs
    return result


def extract_html_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    for match in HTML_ATTR_RE.finditer(text):
        attr = match.group("name").lower()
        value = match.group("value").strip()
        kind = {
            "href": "html-link",
            "src": "html-asset",
            "action": "html-form-action",
            "poster": "html-poster",
            "data-src": "html-lazy-asset",
            "data-href": "html-lazy-link",
            "srcset": "html-srcset",
            "data-background": "html-background",
            "data-image": "html-data-image",
        }.get(attr, "html-reference")

        if attr == "srcset":
            # Conservative heuristic: commas in data URLs can complicate parsing.
            for candidate in re.split(r",\s*(?![^()]*\))", value):
                parts = candidate.strip().split()
                if parts:
                    refs.append(Reference(source, line_number(text, match.start()), kind, parts[0]))
        else:
            refs.append(Reference(source, line_number(text, match.start()), kind, value))
    return refs


def extract_css_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    for match in CSS_URL_RE.finditer(text):
        target = (
            match.group("quoted")
            if match.group("quoted") is not None
            else match.group("plain") or ""
        ).strip()
        if target:
            refs.append(Reference(source, line_number(text, match.start()), "css-asset", target))
    for match in CSS_IMPORT_RE.finditer(text):
        target = match.group("url").strip()
        if target:
            refs.append(Reference(source, line_number(text, match.start()), "css-import", target))
    return refs


def extract_js_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    for match in JS_IMPORT_RE.finditer(text):
        target = match.group("url") or match.group("dynamic") or match.group("require")
        if target:
            refs.append(Reference(source, line_number(text, match.start()), "js-import", target))
    for match in FETCH_RE.finditer(text):
        refs.append(Reference(source, line_number(text, match.start()), "api-call", match.group(1)))
    return refs


def extract_python_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    try:
        tree = ast.parse(text, filename=source)
    except (SyntaxError, ValueError):
        return refs
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                refs.append(Reference(source, node.lineno, "python-import", alias.name))
        elif isinstance(node, ast.ImportFrom) and node.module:
            refs.append(Reference(source, node.lineno, "python-import", node.module))
    for match in PATH_CANDIDATE_RE.finditer(text):
        refs.append(Reference(source, line_number(text, match.start()), "python-file-reference", match.group(1)))
    return refs


def extract_json_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        data = None

    normalized_keys = {key.lower().replace("_", "").replace("-", "") for key in JSON_REF_KEYS}

    def visit(value: Any, key: str = "") -> None:
        if isinstance(value, dict):
            for child_key, child_value in value.items():
                visit(child_value, str(child_key))
        elif isinstance(value, list):
            for child in value:
                visit(child, key)
        elif isinstance(value, str):
            normalized = key.lower().replace("_", "").replace("-", "")
            if normalized in normalized_keys:
                refs.append(Reference(source, 1, "json-reference", value))

    if data is not None:
        visit(data)

    # Literal path candidates also support JSONC and malformed JSON diagnostics.
    for match in PATH_CANDIDATE_RE.finditer(text):
        refs.append(Reference(source, line_number(text, match.start()), "json-path-candidate", match.group(1)))
    return refs


def extract_markdown_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []
    pattern = re.compile(
        r"""!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?\s*\)
            |<((?:https?://|/|\./|\.\./)[^>]+)>""",
        re.IGNORECASE | re.VERBOSE,
    )
    for match in pattern.finditer(text):
        target = match.group(1) or match.group(2)
        if target:
            refs.append(Reference(source, line_number(text, match.start()), "markdown-link", target))
    return refs


def extract_api_routes(text: str, source: str) -> list[ApiRoute]:
    routes: list[ApiRoute] = []
    for match in API_RE.finditer(text):
        method = match.group("method")
        route_path = match.group("route")
        request_path = match.group("request")
        if method and route_path:
            method, path, kind = method.upper(), route_path, "route-definition"
        else:
            method, path, kind = "REQUEST", request_path or "", "api-request"
        if path:
            routes.append(ApiRoute(source, line_number(text, match.start()), method, path, kind))
    return routes


def detect_conflicts(text: str, source: str) -> list[dict]:
    findings = []
    for number, line in enumerate(text.splitlines(), 1):
        if CONFLICT_MARKER_RE.match(line):
            findings.append({
                "file": source,
                "line": number,
                "marker": line.strip()[:80],
                "text": line[:200],
                "action": "manual-review-required",
            })
    return findings


def resolve_reference(
    ref: Reference,
    root: Path,
    source_path: Path,
    known_files: set[str],
    known_dirs: set[str],
) -> None:
    target = clean_target(ref.target)
    if not target:
        ref.status = "empty"
        return
    if is_external_or_dynamic(target):
        ref.status = "external-or-dynamic"
        return
    if target.startswith("#"):
        ref.status = "fragment-only"
        return

    try:
        parsed = urlsplit(target)
    except ValueError as exc:
        ref.status, ref.note = "invalid-url", str(exc)
        return
    if parsed.scheme:
        ref.status = "external-or-dynamic"
        return

    try:
        raw_path = unquote(parsed.path).replace("\\", "/")
    except (ValueError, UnicodeError):
        ref.status, ref.note = "invalid-url", "Could not decode URL path."
        return
    if not raw_path:
        ref.status, ref.resolved_path = "same-document", ref.source
        return

    # Resolve URL paths relative to the referencing file. Root-relative paths
    # are interpreted relative to the repository root as a configurable audit
    # convention, not as proof of the production document root.
    if raw_path.startswith("/"):
        candidates = [root / raw_path.lstrip("/")]
    else:
        candidates = [source_path.parent / raw_path, root / raw_path]

    expanded: list[Path] = []
    for candidate in candidates:
        expanded.append(candidate)
        if candidate.suffix == "":
            expanded.extend([candidate / "index.html", candidate / "index.htm"])

    root_resolved = root.resolve()
    for candidate in expanded:
        try:
            normalized = candidate.resolve(strict=False)
            normalized_rel = normalized.relative_to(root_resolved).as_posix()
        except (ValueError, OSError, RuntimeError):
            continue

        if normalized_rel in known_files:
            ref.status, ref.resolved_path = "resolved", normalized_rel
            return
        if normalized_rel in known_dirs:
            ref.status, ref.resolved_path = "directory", normalized_rel
            return

    if raw_path.startswith("/"):
        ref.status = "unresolved-root-path"
        ref.note = "Repository-root interpretation failed; check deployment document root/base path."
    else:
        ref.status = "broken-candidate"
        ref.note = "Not found at source-relative or repository-root path."


def create_html_connection_proposals(
    root: Path, files: list[Path], max_links: int = 8
) -> list[dict]:
    """Suggest same-directory HTML links. Suggestions are never applied."""
    html_files = [p for p in files if p.suffix.lower() in {".html", ".htm"}]
    by_dir: dict[str, list[Path]] = {}
    for path in html_files:
        by_dir.setdefault(path.parent.as_posix(), []).append(path)

    ignored = {"page", "home", "index", "main", "html", "about", "contact", "more", "with"}
    proposals = []

    for page in html_files:
        source_rel = rel(page, root)
        text = safe_text(page) or ""
        existing_links = set()
        for match in HTML_ATTR_RE.finditer(text):
            if match.group("name").lower() == "href":
                existing_links.add(clean_target(match.group("value")).split("#")[0])

        tokens_a = {
            token for token in re.findall(r"[a-z0-9]+", page.stem.casefold().replace("_", " "))
            if len(token) >= 4 and token not in ignored
        }
        suggestions = []
        for candidate in by_dir.get(page.parent.as_posix(), []):
            if candidate == page:
                continue
            href = os.path.relpath(candidate, page.parent).replace(os.sep, "/")
            if href in existing_links:
                continue
            tokens_b = {
                token for token in re.findall(r"[a-z0-9]+", candidate.stem.casefold().replace("_", " "))
                if len(token) >= 4 and token not in ignored
            }
            overlap = tokens_a & tokens_b
            if overlap:
                suggestions.append({
                    "target": rel(candidate, root),
                    "href": href,
                    "reason": "Shared filename terms: " + ", ".join(sorted(overlap)),
                })
        suggestions.sort(key=lambda item: item["target"].casefold())
        if suggestions and max_links:
            proposals.append({
                "source": source_rel,
                "suggestions": suggestions[:max_links],
                "instruction": "Advisory only; review relevance, accessibility, navigation, and page context.",
            })
    return proposals


def atomic_write_text(path: Path, content: str) -> None:
    """
    Atomically replace one report file. Reports are generated artifacts;
    application source files are never passed to this function.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def write_json(path: Path, value: Any) -> None:
    atomic_write_text(path, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    from io import StringIO
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    atomic_write_text(path, buffer.getvalue())


def build_reports(
    report_dir: Path,
    summary: dict,
    inventory: list[dict],
    references: list[Reference],
    dependency_edges: list[dict],
    broken: list[dict],
    unresolved: list[dict],
    api_routes: list[ApiRoute],
    conflicts: list[dict],
    parse_errors: list[dict],
    page_suggestions: list[dict],
) -> list[Path]:
    reports = {
        "summary.json": summary,
        "file-inventory.json": inventory,
        "references.json": [asdict(x) for x in references],
        "dependency-edges.json": dependency_edges,
        "broken-references.json": broken,
        "unresolved-references.json": unresolved,
        "api-routes.json": [asdict(x) for x in api_routes],
        "conflict-markers.json": conflicts,
        "parse-warnings.json": parse_errors,
        "page-connection-suggestions.json": page_suggestions,
    }
    destinations = []
    for name, payload in reports.items():
        destination = report_dir / name
        write_json(destination, payload)
        destinations.append(destination)

    csv_reports = [
        ("dependency-edges.csv", dependency_edges, ["source", "target", "reference_count"]),
        ("broken-references.csv", broken, ["source", "line", "kind", "target", "status", "resolved_path", "note"]),
        ("file-inventory.csv", inventory, ["path", "extension", "bytes", "sha256", "scan_status"]),
    ]
    for name, rows, fields in csv_reports:
        destination = report_dir / name
        write_csv(destination, rows, fields)
        destinations.append(destination)
    return destinations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Read-only MedOrbits repository inventory and connection audit."
    )
    parser.add_argument("--root", default=".", help="Repository root (default: current directory).")
    parser.add_argument("--dry-run", action="store_true", help="Scan without writing reports.")
    parser.add_argument("--include-hidden", action="store_true",
                        help="Include hidden paths except explicitly excluded directories.")
    parser.add_argument("--show-conflicts", action="store_true",
                        help="Print conflict-marker locations.")
    parser.add_argument("--max-links", type=int, default=8,
                        help="Maximum HTML suggestions per page (default: 8).")
    parser.add_argument("--max-file-mb", type=float, default=50,
                        help="Maximum file size to scan in MiB (default: 50).")
    parser.add_argument("--strict", action="store_true",
                        help="Return nonzero if broken candidates, conflicts, or scan warnings exist.")
    parser.add_argument("--json-summary", action="store_true",
                        help="Print the final summary as JSON.")
    args = parser.parse_args()
    if args.max_links < 0:
        parser.error("--max-links must be zero or greater.")
    if args.max_file_mb <= 0:
        parser.error("--max-file-mb must be greater than zero.")
    return args


def main() -> int:
    args = parse_args()
    try:
        root = Path(args.root).expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: Cannot resolve repository root: {exc}", file=sys.stderr)
        return 2
    if not root.is_dir():
        print(f"ERROR: Repository root is not a directory: {root}", file=sys.stderr)
        return 2

    report_dir = root / REPORT_DIRECTORY
    print(f"MedOrbits Repository Connector v{VERSION}")
    print(f"Repository: {root}")
    print("Source modifications: DISABLED")
    print("File deletion: DISABLED")
    print("Git operations: NONE")
    print(f"Report mode: {'DRY RUN' if args.dry_run else 'WRITE REPORTS'}")

    files, traversal_warnings = walk_repository(root, args.include_hidden)
    known_files = {rel(path, root) for path in files}
    known_dirs = collect_known_directories(root, args.include_hidden)
    source_to_path = {rel(path, root): path for path in files}

    references: list[Reference] = []
    api_routes: list[ApiRoute] = []
    conflicts: list[dict] = []
    parse_errors: list[dict] = list(traversal_warnings)
    inventory: list[dict] = []
    max_bytes = int(args.max_file_mb * 1024 * 1024)

    for path in files:
        file_rel = rel(path, root)
        try:
            stat = path.stat()
            size = stat.st_size
            if size > max_bytes:
                parse_errors.append({
                    "file": file_rel,
                    "error": f"File exceeds scan limit ({size} bytes; limit {max_bytes} bytes).",
                })
                inventory.append({
                    "path": file_rel, "extension": path.suffix.lower(),
                    "bytes": size, "sha256": "", "scan_status": "skipped-size-limit",
                })
                continue
            file_hash = sha256_file(path)
        except OSError as exc:
            parse_errors.append({"file": file_rel, "error": f"Could not hash/read metadata: {exc}"})
            continue

        inventory.append({
            "path": file_rel, "extension": path.suffix.lower(),
            "bytes": size, "sha256": file_hash, "scan_status": "inventoried",
        })
        if path.suffix.lower() in BINARY_EXTENSIONS:
            continue

        text = safe_text(path)
        if text is None:
            parse_errors.append({
                "file": file_rel,
                "error": "Unreadable as UTF-8 text; reference scan skipped.",
            })
            continue

        conflicts.extend(detect_conflicts(text, file_rel))
        ext = path.suffix.lower()

        if ext in {".html", ".htm", ".svg", ".xml", ".vue", ".svelte"}:
            references.extend(extract_html_refs(text, file_rel))
            references.extend(extract_css_refs(text, file_rel))
            references.extend(extract_js_refs(text, file_rel)
                              if ext in {".vue", ".svelte"} else [])
        if ext == ".css":
            references.extend(extract_css_refs(text, file_rel))
        if ext in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte"}:
            references.extend(extract_js_refs(text, file_rel))
        if ext == ".py":
            references.extend(extract_python_refs(text, file_rel))
        if ext in {".json", ".jsonc", ".webmanifest"}:
            references.extend(extract_json_refs(text, file_rel))
        if ext in {".md", ".mdx"}:
            references.extend(extract_markdown_refs(text, file_rel))
        if ext in {".yml", ".yaml", ".toml", ".ini", ".sh", ".sql", ".txt"}:
            for match in PATH_CANDIDATE_RE.finditer(text):
                references.append(Reference(
                    file_rel, line_number(text, match.start()),
                    "config-path-candidate", match.group(1),
                ))

        api_routes.extend(extract_api_routes(text, file_rel))

    # Deduplicate identical findings. Preserve distinct source lines and kinds.
    unique_refs: list[Reference] = []
    seen_refs: set[tuple[str, int, str, str]] = set()
    for ref in references:
        key = (ref.source, ref.line, ref.kind, ref.target)
        if key not in seen_refs:
            seen_refs.add(key)
            unique_refs.append(ref)
    references = unique_refs

    for ref in references:
        source_path = source_to_path.get(ref.source)
        if source_path:
            resolve_reference(ref, root, source_path, known_files, known_dirs)

    edge_counts = Counter(
        (ref.source, ref.resolved_path)
        for ref in references
        if ref.status == "resolved" and ref.resolved_path
    )
    dependency_edges = [
        {"source": source, "target": target, "reference_count": count}
        for (source, target), count in sorted(edge_counts.items())
    ]
    broken = [
        asdict(ref) for ref in references
        if ref.status in {"broken-candidate", "unresolved-root-path", "invalid-url"}
    ]
    unresolved = [
        asdict(ref) for ref in references
        if ref.status not in {
            "resolved", "directory", "external-or-dynamic",
            "fragment-only", "same-document",
        }
    ]
    page_suggestions = create_html_connection_proposals(root, files, args.max_links)
    extension_counts = Counter(path.suffix.lower() or "[no extension]" for path in files)
    status_counts = Counter(ref.status for ref in references)

    summary = {
        "tool": "MedOrbits Repository Connector",
        "version": VERSION,
        "created_at_epoch": int(time.time()),
        "repository_root": str(root),
        "read_only_source_scan": True,
        "automatic_source_edits": False,
        "automatic_deletions": False,
        "git_operations": [],
        "files_discovered": len(files),
        "files_inventoried": len(inventory),
        "references_found": len(references),
        "resolved_references": status_counts["resolved"],
        "broken_candidates": len(broken),
        "unresolved_references": len(unresolved),
        "dependency_edges": len(dependency_edges),
        "api_route_candidates": len(api_routes),
        "conflict_marker_lines": len(conflicts),
        "parse_warnings": len(parse_errors),
        "html_pages_with_suggestions": len(page_suggestions),
        "reference_status_counts": dict(status_counts),
        "file_extension_counts": dict(extension_counts),
        "configuration": {
            "include_hidden": args.include_hidden,
            "max_file_mb": args.max_file_mb,
            "max_links": args.max_links,
            "strict": args.strict,
        },
        "important_limitations": [
            "Static analysis cannot resolve every runtime-generated URL.",
            "Root-relative paths are interpreted relative to repository root for this scan.",
            "Framework aliases and package resolution require framework-aware analysis.",
            "API route detection is heuristic, not a complete router parser.",
            "Conflict markers require manual review; they are never resolved.",
            "HTML connection suggestions are advisory and never applied.",
            "SHA-256 hashes are fingerprints, not proof of authenticity.",
            "Skipped oversized or unreadable files make results incomplete.",
        ],
    }

    if args.dry_run:
        print("\nDRY RUN: no reports were written.")
        for name in (
            "summary.json", "file-inventory.json", "references.json",
            "dependency-edges.json", "broken-references.json",
            "unresolved-references.json", "api-routes.json",
            "conflict-markers.json", "parse-warnings.json",
            "page-connection-suggestions.json", "dependency-edges.csv",
            "broken-references.csv", "file-inventory.csv",
        ):
            print(f" - {rel(report_dir / name, root)}")
    else:
        try:
            destinations = build_reports(
                report_dir, summary, inventory, references, dependency_edges,
                broken, unresolved, api_routes, conflicts, parse_errors,
                page_suggestions,
            )
            print(f"\nReports written to: {rel(report_dir, root)}/")
            print(f"Report files written: {len(destinations)}")
        except (OSError, csv.Error, TypeError, ValueError) as exc:
            print(f"ERROR: Could not write reports: {exc}", file=sys.stderr)
            print(
                "Some report files may already have been replaced; "
                "application source files were not targeted.",
                file=sys.stderr,
            )
            return 2

    print("\nScan summary")
    print(f"  Files discovered:              {len(files)}")
    print(f"  Files inventoried:             {len(inventory)}")
    print(f"  References detected:           {len(references)}")
    print(f"  Dependency edges:              {len(dependency_edges)}")
    print(f"  Broken candidates:             {len(broken)}")
    print(f"  Unresolved references:         {len(unresolved)}")
    print(f"  API route candidates:          {len(api_routes)}")
    print(f"  Conflict-marker lines:         {len(conflicts)}")
    print(f"  Parse/traversal warnings:      {len(parse_errors)}")
    print(f"  Pages with link suggestions:   {len(page_suggestions)}")

    if args.show_conflicts and conflicts:
        print("\nConflict markers requiring manual review:")
        for finding in conflicts:
            print(f"  {finding['file']}:{finding['line']}: {finding['marker']}")
    if conflicts:
        print("\nWARNING: Conflict markers detected; no conflict resolution was attempted.")
    if broken:
        print("\nReview broken-references.json before changing source files.")
    if args.json_summary:
        print("\nJSON summary:")
        print(json.dumps(summary, indent=2, ensure_ascii=False))

    print("\nFinished. No application source files were edited. No files were deleted. No Git commands were executed.")
    if args.strict and (broken or conflicts or parse_errors):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
