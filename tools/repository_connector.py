#!/usr/bin/env python3
"""
MedOrbits Repository Connector
Repository-wide dependency scanner and conservative HTML connection planner.

Read-only source scan; reports are written only when --dry-run is not used.
No source edits, file deletions, Git commands, or automatic conflict resolution.

Python 3.10+; standard library only.
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
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlsplit

VERSION = "1.0.0"

SOURCE_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs", ".jsx", ".ts",
    ".tsx", ".json", ".jsonc", ".py", ".md", ".mdx", ".xml", ".svg",
    ".webmanifest", ".yml", ".yaml", ".toml", ".ini", ".txt", ".sh",
    ".sql", ".php", ".vue", ".svelte",
}
ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm", ".mp3",
    ".wav", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip",
}
SCAN_EXTENSIONS = SOURCE_EXTENSIONS | ASSET_EXTENSIONS
BINARY_EXTENSIONS = ASSET_EXTENSIONS - {".svg"}
EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", ".idea", ".vscode", "node_modules", "vendor",
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".next",
    ".nuxt", "dist", "build", "coverage", ".venv", "venv",
    "repository-reports",
}
CONFLICT_MARKERS = ("<<<<<<< ", "=======", ">>>>>>> ")
IGNORE_URL_SCHEMES = {
    "http", "https", "mailto", "tel", "data", "javascript", "blob", "ftp", "sms",
}
IGNORE_SPECIAL_PREFIXES = (
    "{{", "{%", "${", "process.env", "import.meta.env", "env(", "var(",
    "currentcolor",
)
JSON_REF_KEYS = {
    "src", "href", "url", "path", "file", "image", "icon", "logo",
    "stylesheet", "script", "template", "schema", "endpoint", "baseurl",
    "asset", "assetpath",
}
HTML_ATTR_RE = re.compile(
    r"""(?P<name>href|src|action|poster|data-src|data-href|srcset)\s*=\s*
    (?P<q>["'])(?P<value>.*?)(?P=q)""", re.I | re.S | re.X
)
CSS_URL_RE = re.compile(r"""url\(\s*["']?(?P<url>[^)"']+)["']?\s*\)""", re.I)
CSS_IMPORT_RE = re.compile(r"""@import\s+(?:url\()?["'](?P<url>[^"']+)["']""", re.I)
JS_IMPORT_RE = re.compile(
    r"""(?:\bimport\s+(?:[^"'`]*?\s+from\s+)?|\bexport\s+[^"'`]*?\s+from\s+)
    ["'](?P<url>[^"']+)["']
    |\bimport\(\s*["'](?P<dynamic>[^"']+)["']\s*\)
    |\brequire\(\s*["'](?P<require>[^"']+)["']\s*\)""", re.X
)
API_RE = re.compile(
    r"""(?:
      \b(?:app|router|server)\s*\.\s*(?P<method>get|post|put|patch|delete|options|head|use|all)
      \s*\(\s*["'`](?P<route>[^"'`]+)
      |
      \b(?:fetch|axios\.(?:get|post|put|patch|delete)|request)\s*
      \(\s*["'`](?P<request>[^"'`]+)
    )""", re.I | re.X
)

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
    return text.count("\\n", 0, offset) + 1

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def safe_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (UnicodeDecodeError, OSError, PermissionError):
        return None

def clean_target(target: str) -> str:
    return html.unescape(target.strip()).replace("\\\\/", "/").strip()

def is_external(target: str) -> bool:
    target = target.strip()
    if not target or target.startswith(IGNORE_SPECIAL_PREFIXES) or target.startswith("//"):
        return True
    try:
        return urlsplit(target).scheme.lower() in IGNORE_URL_SCHEMES
    except ValueError:
        return True

def walk_repository(root: Path, include_hidden: bool = False) -> list[Path]:
    results: list[Path] = []
    for current, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and (include_hidden or not name.startswith("."))
            and not (Path(current) / name).is_symlink()
        ]
        current_path = Path(current)
        for name in names:
            path = current_path / name
            if path.is_symlink():
                continue
            try:
                parts = path.relative_to(root).parts
            except ValueError:
                continue
            if not include_hidden and any(part.startswith(".") for part in parts):
                continue
            if path.suffix.lower() in SCAN_EXTENSIONS:
                results.append(path)
    return sorted(results, key=lambda p: rel(p, root).lower())

def extract_html_refs(text: str, source: str) -> list[Reference]:
    result = []
    kinds = {
        "href": "html-link", "src": "html-asset", "action": "html-form-action",
        "poster": "html-poster", "data-src": "html-lazy-asset",
        "data-href": "html-lazy-link", "srcset": "html-srcset",
    }
    for match in HTML_ATTR_RE.finditer(text):
        attr, value = match.group("name").lower(), match.group("value").strip()
        line = line_number(text, match.start())
        if attr == "srcset":
            for candidate in value.split(","):
                bits = candidate.strip().split()
                if bits:
                    result.append(Reference(source, line, kinds[attr], bits[0]))
        else:
            result.append(Reference(source, line, kinds.get(attr, "html-reference"), value))
    return result

def extract_css_refs(text: str, source: str) -> list[Reference]:
    result = []
    for pattern, kind in ((CSS_URL_RE, "css-asset"), (CSS_IMPORT_RE, "css-import")):
        for match in pattern.finditer(text):
            target = match.groupdict().get("url", "").strip()
            if target:
                result.append(Reference(source, line_number(text, match.start()), kind, target))
    return result

def extract_js_refs(text: str, source: str) -> list[Reference]:
    result = []
    for match in JS_IMPORT_RE.finditer(text):
        target = match.group("url") or match.group("dynamic") or match.group("require")
        if target:
            result.append(Reference(source, line_number(text, match.start()), "js-import", target))
    fetch_re = re.compile(
        r"""(?:fetch|axios\.(?:get|post|put|patch|delete))\s*\(\s*["'`]([^"'`]+)["'`]""",
        re.I,
    )
    for match in fetch_re.finditer(text):
        result.append(Reference(source, line_number(text, match.start()), "api-call", match.group(1)))
    return result

def extract_python_refs(text: str, source: str) -> list[Reference]:
    result = []
    try:
        tree = ast.parse(text)
    except SyntaxError:
        tree = None
    if tree is not None:
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    result.append(Reference(source, node.lineno, "python-import", alias.name))
            elif isinstance(node, ast.ImportFrom) and node.module:
                result.append(Reference(source, node.lineno, "python-import", node.module))
    path_re = re.compile(r"""["']([^"'\\n]+\.(?:json|html?|css|m?js|svg|png|jpe?g|pdf))["']""", re.I)
    for match in path_re.finditer(text):
        result.append(Reference(source, line_number(text, match.start()), "python-file-reference", match.group(1)))
    return result

def extract_json_refs(text: str, source: str) -> list[Reference]:
    result = []
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        data = None
    keys = {k.lower().replace("_", "").replace("-", "") for k in JSON_REF_KEYS}
    def visit(value, key=""):
        if isinstance(value, dict):
            for k, v in value.items():
                visit(v, str(k))
        elif isinstance(value, list):
            for item in value:
                visit(item, key)
        elif isinstance(value, str) and key.lower().replace("_", "").replace("-", "") in keys:
            result.append(Reference(source, 1, "json-reference", value))
    if data is not None:
        visit(data)
    path_re = re.compile(r"""["']([^"'\\n]+\.(?:html?|css|m?js|json|svg|png|jpe?g|webp|pdf))["']""", re.I)
    for match in path_re.finditer(text):
        result.append(Reference(source, line_number(text, match.start()), "json-path-candidate", match.group(1)))
    return result

def extract_markdown_refs(text: str, source: str) -> list[Reference]:
    result = []
    pattern = re.compile(
        r"""!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?\s*\)|<((?:https?://|/|\./|\.\./)[^>]+)>""", re.I | re.X
    )
    for match in pattern.finditer(text):
        target = match.group(1) or match.group(2)
        if target:
            result.append(Reference(source, line_number(text, match.start()), "markdown-link", target))
    return result

def extract_api_routes(text: str, source: str) -> list[ApiRoute]:
    result = []
    for match in API_RE.finditer(text):
        method = (match.group("method") or "REQUEST").upper()
        path = match.group("route") or match.group("request")
        if not path:
            continue
        kind = "route-definition" if method in {
            "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "USE", "ALL"
        } else "api-request"
        result.append(ApiRoute(source, line_number(text, match.start()), method, path, kind))
    return result

def detect_conflicts(text: str, source: str) -> list[dict]:
    result = []
    for number, line in enumerate(text.splitlines(), 1):
        marker = next((m for m in CONFLICT_MARKERS if line.startswith(m)), None)
        if marker:
            result.append({"file": source, "line": number, "marker": marker.strip(), "text": line[:200]})
    return result

def resolve_reference(ref: Reference, root: Path, source_path: Path,
                      known_files: set[str], known_dirs: set[str]) -> None:
    target = clean_target(ref.target)
    if not target:
        ref.status = "empty"
        return
    if is_external(target):
        ref.status = "external-or-dynamic"
        return
    if target.startswith("#"):
        ref.status = "fragment-only"
        return
    try:
        parsed = urlsplit(target)
    except ValueError:
        ref.status = "invalid-url"
        return
    raw_path = unquote(parsed.path).replace("\\\\", "/")
    if not raw_path:
        ref.status, ref.resolved_path = "same-document", ref.source
        return
    if raw_path.startswith("/"):
        candidates = [root / raw_path.lstrip("/"), source_path.parent / raw_path.lstrip("/")]
    else:
        candidates = [source_path.parent / raw_path, root / raw_path]
    expanded = []
    for candidate in candidates:
        expanded.append(candidate)
        if candidate.suffix == "":
            expanded.extend([candidate / "index.html", candidate / "index.htm"])
    for candidate in expanded:
        try:
            normalized = candidate.resolve(strict=False)
            normalized_rel = normalized.relative_to(root.resolve()).as_posix()
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
        ref.note = "Check the deployed site's document root."
    else:
        ref.status = "broken-candidate"
        ref.note = "Not found at source-relative or repository-root path."

def create_html_connection_proposals(root: Path, files: list[Path], max_links: int = 8) -> list[dict]:
    pages = [p for p in files if p.suffix.lower() in {".html", ".htm"}]
    by_dir: dict[str, list[Path]] = defaultdict(list)
    for path in pages:
        by_dir[path.parent.as_posix()].append(path)
    proposals = []
    for page in pages:
        text = safe_text(page) or ""
        existing = set()
        for match in HTML_ATTR_RE.finditer(text):
            if match.group("name").lower() == "href":
                existing.add(clean_target(match.group("value")).split("#")[0])
        suggestions = []
        for candidate in sorted(by_dir[page.parent.as_posix()], key=lambda p: p.name.lower()):
            if candidate == page:
                continue
            href = os.path.relpath(candidate, page.parent).replace(os.sep, "/")
            if href in existing:
                continue
            a = {t for t in re.findall(r"[a-z0-9]+", page.stem.lower().replace("-", " ").replace("_", " ")) if len(t) >= 4}
            b = {t for t in re.findall(r"[a-z0-9]+", candidate.stem.lower().replace("-", " ").replace("_", " ")) if len(t) >= 4}
            overlap = a & b
            if overlap:
                suggestions.append({
                    "target": rel(candidate, root),
                    "href": href,
                    "reason": "Shared filename terms: " + ", ".join(sorted(overlap)),
                })
        if suggestions and max_links > 0:
            proposals.append({
                "source": rel(page, root),
                "suggestions": suggestions[:max_links],
                "instruction": "Suggestion only. Verify relevance before editing.",
            })
    return proposals

def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\\n", encoding="utf-8")

def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

def main() -> int:
    parser = argparse.ArgumentParser(description="Safely map MedOrbits repository dependencies.")
    parser.add_argument("--root", default=".", help="Repository root directory.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write reports.")
    parser.add_argument("--include-hidden", action="store_true", help="Include hidden paths except excluded directories.")
    parser.add_argument("--show-conflicts", action="store_true", help="Print detected conflict-marker locations.")
    parser.add_argument("--max-links", type=int, default=8, help="Maximum related-page suggestions per HTML page.")
    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: Repository root is not a directory: {root}", file=sys.stderr)
        return 2
    report_dir = root / "tools" / "repository-reports"
    print(f"MedOrbits Repository Connector {VERSION}")
    print(f"Repository: {root}")
    print("Source edits: DISABLED | Deletions: DISABLED | Git operations: NONE")
    files = walk_repository(root, args.include_hidden)
    known_files = {rel(p, root) for p in files}
    known_dirs = set()
    # Use os.walk with the same exclusions; do not follow symlinks.
    for current, dirs, _ in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS and (args.include_hidden or not d.startswith(".")) and not (Path(current) / d).is_symlink()]
        for name in dirs:
            known_dirs.add(rel(Path(current) / name, root))
    refs, routes, conflicts, warnings, inventory = [], [], [], [], []
    for path in files:
        file_rel = rel(path, root)
        try:
            digest, size = sha256_file(path), path.stat().st_size
        except OSError as exc:
            warnings.append({"file": file_rel, "error": f"Could not read metadata: {exc}"})
            continue
        inventory.append({"path": file_rel, "extension": path.suffix.lower(), "bytes": size, "sha256": digest})
        ext = path.suffix.lower()
        if ext in BINARY_EXTENSIONS:
            continue
        text = safe_text(path)
        if text is None:
            warnings.append({"file": file_rel, "error": "Not readable as UTF-8; reference scan skipped."})
            continue
        conflicts.extend(detect_conflicts(text, file_rel))
        if ext in {".html", ".htm", ".svg", ".xml", ".vue", ".svelte"}:
            refs.extend(extract_html_refs(text, file_rel))
            refs.extend(extract_css_refs(text, file_rel))
            refs.extend(extract_js_refs(text, file_rel))
        if ext == ".css":
            refs.extend(extract_css_refs(text, file_rel))
        if ext in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue", ".svelte"}:
            refs.extend(extract_js_refs(text, file_rel))
        if ext == ".py":
            refs.extend(extract_python_refs(text, file_rel))
        if ext in {".json", ".jsonc", ".webmanifest"}:
            refs.extend(extract_json_refs(text, file_rel))
        if ext in {".md", ".mdx"}:
            refs.extend(extract_markdown_refs(text, file_rel))
        routes.extend(extract_api_routes(text, file_rel))
        if ext in {".yml", ".yaml", ".toml", ".ini", ".sh", ".sql", ".txt"}:
            pat = re.compile(r"""["']([^"'\\n]+\.(?:html?|css|m?js|json|svg|png|jpe?g|pdf))["']""", re.I)
            for match in pat.finditer(text):
                refs.append(Reference(file_rel, line_number(text, match.start()), "config-path-candidate", match.group(1)))
    source_paths = {rel(p, root): p for p in files}
    for ref in refs:
        source_path = source_paths.get(ref.source)
        if source_path:
            resolve_reference(ref, root, source_path, known_files, known_dirs)
    edge_counts = Counter((r.source, r.resolved_path) for r in refs if r.status == "resolved" and r.resolved_path)
    edges = [{"source": s, "target": t, "reference_count": n} for (s, t), n in sorted(edge_counts.items())]
    broken = [asdict(r) for r in refs if r.status in {"broken-candidate", "unresolved-root-path"}]
    unresolved = [asdict(r) for r in refs if r.status not in {"resolved", "directory", "external-or-dynamic", "fragment-only", "same-document"}]
    proposals = create_html_connection_proposals(root, files, max(0, args.max_links))
    summary = {
        "tool": "MedOrbits Repository Connector", "version": VERSION,
        "created_at_epoch": int(time.time()), "repository_root": str(root),
        "read_only_scan": True, "automatic_source_edits": False,
        "automatic_deletions": False, "git_operations": [],
        "files_scanned": len(files), "references_found": len(refs),
        "resolved_references": sum(r.status == "resolved" for r in refs),
        "dependency_edges": len(edges), "broken_candidates": len(broken),
        "unresolved_references": len(unresolved), "api_route_candidates": len(routes),
        "conflict_marker_lines": len(conflicts), "parse_warnings": len(warnings),
        "html_pages_with_suggestions": len(proposals),
        "reference_status_counts": dict(Counter(r.status for r in refs)),
        "file_extension_counts": dict(Counter(p.suffix.lower() or "[no extension]" for p in files)),
        "limitations": [
            "Runtime-generated URLs cannot always be resolved statically.",
            "Absolute website paths depend on deployment configuration.",
            "API route detection is heuristic.",
            "HTML connection suggestions are proposals only.",
            "Conflict markers must be reviewed manually.",
        ],
    }
    json_outputs = {
        "summary.json": summary, "file-inventory.json": inventory,
        "references.json": [asdict(r) for r in refs], "dependency-edges.json": edges,
        "broken-references.json": broken, "unresolved-references.json": unresolved,
        "api-routes.json": [asdict(r) for r in routes], "conflict-markers.json": conflicts,
        "parse-warnings.json": warnings, "page-connection-suggestions.json": proposals,
    }
    csv_outputs = {
        "dependency-edges.csv": (edges, ["source", "target", "reference_count"]),
        "broken-references.csv": (broken, ["source", "line", "kind", "target", "status", "resolved_path", "note"]),
        "file-inventory.csv": (inventory, ["path", "extension", "bytes", "sha256"]),
    }
    if args.dry_run:
        print("\\nDRY RUN: no reports or source files were written.")
        for name in [*json_outputs, *csv_outputs]:
            print("Would write:", rel(report_dir / name, root))
    else:
        report_dir.mkdir(parents=True, exist_ok=True)
        for name, value in json_outputs.items():
            write_json(report_dir / name, value)
        for name, (rows, fields) in csv_outputs.items():
            write_csv(report_dir / name, rows, fields)
        print(f"Reports saved in: {rel(report_dir, root)}/")
    print("\\nSCAN SUMMARY")
    print(f"Files scanned: {len(files)}")
    print(f"References detected: {len(refs)}")
    print(f"Dependency edges: {len(edges)}")
    print(f"Broken-reference candidates: {len(broken)}")
    print(f"Unresolved references: {len(unresolved)}")
    print(f"API route candidates: {len(routes)}")
    print(f"Conflict-marker lines: {len(conflicts)}")
    print(f"Parse warnings: {len(warnings)}")
    print(f"Pages with suggestions: {len(proposals)}")
    if args.show_conflicts and conflicts:
        print("\\nCONFLICT MARKERS (review manually)")
        for finding in conflicts:
            print(f"{finding['file']}:{finding['line']}: {finding['marker']}")
    if conflicts:
        print("WARNING: Possible conflict markers found; none were resolved.")
    print("Finished. Source files were not edited.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
