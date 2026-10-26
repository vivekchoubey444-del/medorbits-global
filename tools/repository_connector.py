
#!/usr/bin/env python3
"""
MedOrbits Repository Connector
Version: 1.0.1
Python: 3.10+
Dependencies: Standard library only.

Default behavior:
- Scans repository files and references.
- Maps dependencies between files.
- Identifies potential broken references.
- Detects possible Git conflict markers.
- Suggests related HTML pages.
- Generates JSON and CSV reports.
- Never edits or deletes source files.
- Never executes Git operations.
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


VERSION = "1.0.1"

SOURCE_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".jsx", ".ts", ".tsx", ".json", ".jsonc", ".py",
    ".md", ".mdx", ".xml", ".svg", ".webmanifest",
    ".yml", ".yaml", ".toml", ".ini", ".txt", ".sh",
    ".sql", ".php", ".vue", ".svelte",
}

ASSET_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif",
    ".ico", ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3", ".wav", ".pdf", ".doc",
    ".docx", ".xls", ".xlsx", ".zip",
}

SCAN_EXTENSIONS = SOURCE_EXTENSIONS | ASSET_EXTENSIONS

EXCLUDED_DIRS = {
    ".git", ".svn", ".hg", ".idea", ".vscode",
    "node_modules", "vendor", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", ".next", ".nuxt",
    "dist", "build", "coverage", ".venv", "venv",
    "repository-reports",
}

BINARY_EXTENSIONS = ASSET_EXTENSIONS - {".svg"}

HTML_ATTR_RE = re.compile(
    r"""(?P<name>href|src|action|poster|data-src|data-href|srcset)
        \s*=\s*(?P<q>["'])(?P<value>.*?)(?P=q)""",
    re.IGNORECASE | re.DOTALL | re.VERBOSE,
)

CSS_URL_RE = re.compile(
    r"""url\(\s*["']?(?P<url>[^)"']+)["']?\s*\)""",
    re.IGNORECASE,
)

CSS_IMPORT_RE = re.compile(
    r"""@import\s+(?:url\()?["'](?P<url>[^"']+)["']""",
    re.IGNORECASE,
)

JS_IMPORT_RE = re.compile(
    r"""(?:\bimport\s+(?:[^"'`]*?\s+from\s+)?|\bexport\s+[^"'`]*?\s+from\s+)
        ["'](?P<url>[^"']+)["']
        |\bimport\(\s*["'](?P<dynamic>[^"']+)["']\s*\)
        |\brequire\(\s*["'](?P<require>[^"']+)["']\s*\)""",
    re.VERBOSE,
)

JSON_REF_KEYS = {
    "src", "href", "url", "path", "file", "image", "icon",
    "logo", "stylesheet", "script", "template", "schema",
    "endpoint", "baseurl", "asset", "assetpath",
}

API_RE = re.compile(
    r"""(?:
        \b(?:app|router|server)\s*\.\s*
        (get|post|put|patch|delete|options|head|use|all)\s*
        \(\s*["'`]([^"'`]+)
        |
        \b(?:fetch|axios\.(?:get|post|put|patch|delete)|request)\s*
        \(\s*["'`]([^"'`]+)
        |
        \bapp\s*\.\s*use\s*\(\s*["'`]([^"'`]+)
    )""",
    re.IGNORECASE | re.VERBOSE,
)

CONFLICT_MARKERS = (
    "<<<<<<< ",
    "=======",
    ">>>>>>> ",
)

IGNORE_URL_SCHEMES = {
    "http", "https", "mailto", "tel", "data",
    "javascript", "blob", "ftp", "sms",
}

IGNORE_SPECIAL_PREFIXES = (
    "{{", "{%", "${", "process.env", "import.meta.env",
    "env(", "var(", "currentcolor",
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def rel(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def is_external(target: str) -> bool:
    target = target.strip()

    if not target or target.startswith(IGNORE_SPECIAL_PREFIXES):
        return True

    if target.startswith("//"):
        return True

    try:
        scheme = urlsplit(target).scheme.lower()
    except ValueError:
        return True

    return scheme in IGNORE_URL_SCHEMES


def clean_target(target: str) -> str:
    target = html.unescape(target.strip())
    return target.replace("\\/", "/")


def safe_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (UnicodeDecodeError, OSError, PermissionError):
        return None


def walk_repository(
    root: Path,
    include_hidden: bool = False,
) -> list[Path]:
    results: list[Path] = []

    for current, dirs, files in os.walk(root, followlinks=False):
        current_path = Path(current)

        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS
            and (include_hidden or not name.startswith("."))
        ]

        for name in files:
            path = current_path / name

            if path.is_symlink():
                continue

            relative_parts = path.relative_to(root).parts

            if not include_hidden and any(
                part.startswith(".") for part in relative_parts
            ):
                continue

            if path.suffix.lower() in SCAN_EXTENSIONS:
                results.append(path)

    return sorted(results, key=lambda p: rel(p, root).lower())


def extract_html_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []

    kinds = {
        "href": "html-link",
        "src": "html-asset",
        "action": "html-form-action",
        "poster": "html-poster",
        "data-src": "html-lazy-asset",
        "data-href": "html-lazy-link",
        "srcset": "html-srcset",
    }

    for match in HTML_ATTR_RE.finditer(text):
        attr = match.group("name").lower()
        value = match.group("value").strip()
        kind = kinds.get(attr, "html-reference")
        line = line_number(text, match.start())

        if attr == "srcset":
            for candidate in value.split(","):
                parts = candidate.strip().split()
                if parts:
                    refs.append(
                        Reference(source, line, kind, parts[0])
                    )
        else:
            refs.append(Reference(source, line, kind, value))

    return refs


def extract_css_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []

    for pattern, kind in (
        (CSS_URL_RE, "css-asset"),
        (CSS_IMPORT_RE, "css-import"),
    ):
        for match in pattern.finditer(text):
            target = match.groupdict().get("url", "").strip()

            if target:
                refs.append(
                    Reference(
                        source,
                        line_number(text, match.start()),
                        kind,
                        target,
                    )
                )

    return refs


def extract_js_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []

    for match in JS_IMPORT_RE.finditer(text):
        target = (
            match.group("url")
            or match.group("dynamic")
            or match.group("require")
        )

        if target:
            refs.append(
                Reference(
                    source,
                    line_number(text, match.start()),
                    "js-import",
                    target,
                )
            )

    fetch_pattern = re.compile(
        r"""(?:fetch|axios\.(?:get|post|put|patch|delete))\s*
            \(\s*["'`]([^"'`]+)["'`]""",
        re.IGNORECASE | re.VERBOSE,
    )

    for match in fetch_pattern.finditer(text):
        refs.append(
            Reference(
                source,
                line_number(text, match.start()),
                "api-call",
                match.group(1),
            )
        )

    return refs


def extract_python_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []

    try:
        tree = ast.parse(text)
    except SyntaxError:
        return refs

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                refs.append(
                    Reference(
                        source, node.lineno, "python-import", alias.name
                    )
                )

        elif isinstance(node, ast.ImportFrom) and node.module:
            refs.append(
                Reference(
                    source, node.lineno, "python-import", node.module
                )
            )

    path_pattern = re.compile(
        r"""["']([^"'\n]+\.(?:json|html?|css|m?js|svg|png|jpe?g|pdf))["']""",
        re.IGNORECASE,
    )

    for match in path_pattern.finditer(text):
        refs.append(
            Reference(
                source,
                line_number(text, match.start()),
                "python-file-reference",
                match.group(1),
            )
        )

    return refs


def extract_json_refs(text: str, source: str) -> list[Reference]:
    refs: list[Reference] = []

    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        data = None

    normalized_keys = {
        key.lower().replace("_", "").replace("-", "")
        for key in JSON_REF_KEYS
    }

    def visit(value, key=""):
        if isinstance(value, dict):
            for child_key, child_value in value.items():
                visit(child_value, str(child_key))

        elif isinstance(value, list):
            for child in value:
                visit(child, key)

        elif isinstance(value, str):
            normalized = key.lower().replace("_", "").replace("-", "")

            if normalized in normalized_keys:
                refs.append(
                    Reference(source, 1, "json-reference", value)
                )

    if data is not None:
        visit(data)

    path_pattern = re.compile(
        r"""["']([^"'\n]+\.(?:html?|css|m?js|json|svg|png|jpe?g|webp|pdf))["']""",
        re.IGNORECASE,
    )

    for match in path_pattern.finditer(text):
        refs.append(
            Reference(
                source,
                line_number(text, match.start()),
                "json-path-candidate",
                match.group(1),
            )
        )

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
            refs.append(
                Reference(
                    source,
                    line_number(text, match.start()),
                    "markdown-link",
                    target,
                )
            )

    return refs


def extract_api_routes(text: str, source: str) -> list[ApiRoute]:
    routes: list[ApiRoute] = []

    for match in API_RE.finditer(text):
        groups = match.groups()

        method = (groups[0] or "request").upper()
        path = groups[1] or groups[2] or groups[3]

        if not path:
            continue

        kind = (
            "route-definition"
            if method in {
                "GET", "POST", "PUT", "PATCH", "DELETE",
                "OPTIONS", "HEAD", "USE", "ALL",
            }
            else "api-request"
        )

        routes.append(
            ApiRoute(
                source=source,
                line=line_number(text, match.start()),
                method=method,
                path=path,
                kind=kind,
            )
        )

    return routes


def detect_conflicts(text: str, source: str) -> list[dict]:
    findings = []

    for number, line in enumerate(text.splitlines(), 1):
        marker = next(
            (item for item in CONFLICT_MARKERS if line.startswith(item)),
            None,
        )

        if marker:
            findings.append(
                {
                    "file": source,
                    "line": number,
                    "marker": marker.strip(),
                    "text": line[:200],
                }
            )

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

    raw_path = unquote(parsed.path).replace("\\", "/")

    if not raw_path:
        ref.status = "same-document"
        ref.resolved_path = ref.source
        return

    candidates: list[Path] = []

    if raw_path.startswith("/"):
        candidates.append(root / raw_path.lstrip("/"))
        candidates.append(source_path.parent / raw_path.lstrip("/"))
    else:
        candidates.append(source_path.parent / raw_path)
        candidates.append(root / raw_path)

    expanded: list[Path] = []

    for candidate in candidates:
        expanded.append(candidate)

        if candidate.suffix == "":
            expanded.append(candidate / "index.html")
            expanded.append(candidate / "index.htm")

    for candidate in expanded:
        try:
            normalized = candidate.resolve(strict=False)
            normalized_rel = normalized.relative_to(
                root.resolve()
            ).as_posix()
        except (ValueError, OSError, RuntimeError):
            continue

        if normalized_rel in known_files:
            ref.status = "resolved"
            ref.resolved_path = normalized_rel
            return

        if normalized_rel in known_dirs:
            ref.status = "directory"
            ref.resolved_path = normalized_rel
            return

    if raw_path.startswith("/"):
        ref.status = "unresolved-root-path"
        ref.note = "Check the deployed site's document root."
    else:
        ref.status = "broken-candidate"
        ref.note = (
            "Target was not found at the source-relative "
            "or repository-root path."
        )


def create_html_connection_proposals(
    root: Path,
    files: list[Path],
    max_links: int = 8,
) -> list[dict]:
    html_files = [
        path for path in files
        if path.suffix.lower() in {".html", ".htm"}
    ]

    by_dir: dict[str, list[Path]] = defaultdict(list)

    for path in html_files:
        by_dir[path.parent.as_posix()].append(path)

    proposals = []

    for page in html_files:
        page_rel = rel(page, root)
        siblings = sorted(
            by_dir.get(page.parent.as_posix(), []),
            key=lambda item: item.name.lower(),
        )

        existing_text = safe_text(page) or ""
        existing_links = set()

        for match in HTML_ATTR_RE.finditer(existing_text):
            if match.group("name").lower() == "href":
                existing_links.add(
                    clean_target(match.group("value")).split("#")[0]
                )

        suggestions = []

        for candidate in siblings:
            if candidate == page:
                continue

            candidate_rel = rel(candidate, root)
            relative_target = os.path.relpath(
                candidate, page.parent
            ).replace(os.sep, "/")

            if relative_target in existing_links:
                continue

            stem_a = page.stem.lower().replace("-", " ").replace("_", " ")
            stem_b = candidate.stem.lower().replace("-", " ").replace("_", " ")

            tokens_a = {
                token for token in re.findall(r"[a-z0-9]+", stem_a)
                if len(token) >= 4
            }

            tokens_b = {
                token for token in re.findall(r"[a-z0-9]+", stem_b)
                if len(token) >= 4
            }

            overlap = tokens_a & tokens_b

            if overlap:
                suggestions.append(
                    {
                        "target": candidate_rel,
                        "href": relative_target,
                        "reason": (
                            "Shared filename terms: "
                            + ", ".join(sorted(overlap))
                        ),
                    }
                )

        suggestions.sort(key=lambda item: item["target"].lower())

        if suggestions and max_links > 0:
            proposals.append(
                {
                    "source": page_rel,
                    "suggestions": suggestions[:max_links],
                    "instruction": (
                        "Suggestion only. Verify relevance and navigation "
                        "design before editing this page."
                    ),
                }
            )

    return proposals


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def write_csv(
    path: Path,
    rows: list[dict],
    fieldnames: list[str],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=fieldnames,
            extrasaction="ignore",
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely map MedOrbits repository dependencies."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory.",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write reports.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files except excluded directories.",
    )

    parser.add_argument(
        "--show-conflicts",
        action="store_true",
        help="Print detected conflict-marker locations.",
    )

    parser.add_argument(
        "--max-links",
        type=int,
        default=8,
        help="Maximum page suggestions per HTML page.",
    )

    args = parser.parse_args()
    root = Path(args.root).expanduser().resolve()

    if not root.is_dir():
        print(
            f"ERROR: Repository root is not a directory: {root}",
            file=sys.stderr,
        )
        return 2

    report_dir = root / "tools" / "repository-reports"

    print("MedOrbits Repository Connector", VERSION)
    print(f"Repository: {root}")
    print("Source modifications: DISABLED")
    print("Automatic deletions: DISABLED")
    print("Git operations: NONE")

    files = walk_repository(root, args.include_hidden)

    known_files = {rel(path, root) for path in files}
    known_dirs = set()

    for path in root.rglob("*"):
        if not path.is_dir() or path.is_symlink():
            continue

        relative = path.relative_to(root)

        if any(part in EXCLUDED_DIRS for part in relative.parts):
            continue

        if not args.include_hidden and any(
            part.startswith(".") for part in relative.parts
        ):
            continue

        known_dirs.add(relative.as_posix())

    references: list[Reference] = []
    api_routes: list[ApiRoute] = []
    conflicts: list[dict] = []
    parse_errors: list[dict] = []
    inventory: list[dict] = []

    for path in files:
        file_rel = rel(path, root)

        try:
            file_hash = sha256_file(path)
            size = path.stat().st_size
        except OSError as exc:
            parse_errors.append(
                {
                    "file": file_rel,
                    "error": f"Could not read file metadata: {exc}",
                }
            )
            continue

        inventory.append(
            {
                "path": file_rel,
                "extension": path.suffix.lower(),
                "bytes": size,
                "sha256": file_hash,
            }
        )

        if path.suffix.lower() in BINARY_EXTENSIONS:
            continue

        text = safe_text(path)

        if text is None:
            parse_errors.append(
                {
                    "file": file_rel,
                    "error": "Unreadable as UTF-8; reference scan skipped.",
                }
            )
            continue

        conflicts.extend(detect_conflicts(text, file_rel))
        ext = path.suffix.lower()

        if ext in {".html", ".htm", ".svg", ".xml", ".vue", ".svelte"}:
            references.extend(extract_html_refs(text, file_rel))
            references.extend(extract_css_refs(text, file_rel))
            references.extend(extract_js_refs(text, file_rel))

        if ext == ".css":
            references.extend(extract_css_refs(text, file_rel))

        if ext in {
            ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx",
            ".vue", ".svelte",
        }:
            references.extend(extract_js_refs(text, file_rel))

        if ext == ".py":
            references.extend(extract_python_refs(text, file_rel))

        if ext in {".json", ".jsonc", ".webmanifest"}:
            references.extend(extract_json_refs(text, file_rel))

        if ext in {".md", ".mdx"}:
            references.extend(extract_markdown_refs(text, file_rel))

        api_routes.extend(extract_api_routes(text, file_rel))

        if ext in {".yml", ".yaml", ".toml", ".ini", ".sh", ".sql", ".txt"}:
            pattern = re.compile(
                r"""["']([^"'\n]+\.(?:html?|css|m?js|json|svg|png|jpe?g|pdf))["']""",
                re.IGNORECASE,
            )

            for match in pattern.finditer(text):
                references.append(
                    Reference(
                        file_rel,
                        line_number(text, match.start()),
                        "config-path-candidate",
                        match.group(1),
                    )
                )

    source_to_path = {rel(path, root): path for path in files}

    for ref in references:
        source_path = source_to_path.get(ref.source)

        if source_path:
            resolve_reference(
                ref,
                root,
                source_path,
                known_files,
                known_dirs,
            )

    connection_counts = Counter(
        (ref.source, ref.resolved_path)
        for ref in references
        if ref.status == "resolved" and ref.resolved_path
    )

    dependency_edges = [
        {
            "source": source,
            "target": target,
            "reference_count": count,
        }
        for (source, target), count in sorted(connection_counts.items())
    ]

    broken = [
        asdict(ref)
        for ref in references
        if ref.status in {
            "broken-candidate",
            "unresolved-root-path",
        }
    ]

    unresolved = [
        asdict(ref)
        for ref in references
        if ref.status not in {
            "resolved",
            "directory",
            "external-or-dynamic",
            "fragment-only",
            "same-document",
        }
    ]

    page_suggestions = create_html_connection_proposals(
        root,
        files,
        max_links=max(0, args.max_links),
    )

    summary = {
        "tool": "MedOrbits Repository Connector",
        "version": VERSION,
        "created_at_epoch": int(time.time()),
        "repository_root": str(root),
        "read_only_scan": True,
        "automatic_source_edits": False,
        "automatic_deletions": False,
        "git_operations": [],
        "files_scanned": len(files),
        "references_found": len(references),
        "resolved_references": sum(
            1 for ref in references if ref.status == "resolved"
        ),
        "dependency_edges": len(dependency_edges),
        "broken_candidates": len(broken),
        "unresolved_references": len(unresolved),
        "api_route_candidates": len(api_routes),
        "conflict_marker_lines": len(conflicts),
        "parse_warnings": len(parse_errors),
        "html_pages_with_suggestions": len(page_suggestions),
        "reference_status_counts": dict(
            Counter(ref.status for ref in references)
        ),
        "file_extension_counts": dict(
            Counter(path.suffix.lower() or "[no extension]" for path in files)
        ),
        "limitations": [
            "Runtime-generated URLs cannot always be resolved statically.",
            "Absolute website paths depend on deployment configuration.",
            "API route detection is heuristic.",
            "Page connection suggestions are not applied.",
            "Conflict markers must be reviewed manually.",
        ],
    }

    outputs = {
        "summary.json": summary,
        "file-inventory.json": inventory,
        "references.json": [asdict(ref) for ref in references],
        "dependency-edges.json": dependency_edges,
        "broken-references.json": broken,
        "unresolved-references.json": unresolved,
        "api-routes.json": [asdict(route) for route in api_routes],
        "conflict-markers.json": conflicts,
        "parse-warnings.json": parse_errors,
        "page-connection-suggestions.json": page_suggestions,
    }

    csv_outputs = {
        "dependency-edges.csv": (
            dependency_edges,
            ["source", "target", "reference_count"],
        ),
        "broken-references.csv": (
            broken,
            [
                "source", "line", "kind", "target",
                "status", "resolved_path", "note",
            ],
        ),
        "file-inventory.csv": (
            inventory,
            ["path", "extension", "bytes", "sha256"],
        ),
    }

    if args.dry_run:
        print("\nDRY RUN: no reports or source files were written.")

        for name in list(outputs) + list(csv_outputs):
            print("Would write:", rel(report_dir / name, root))

    else:
        report_dir.mkdir(parents=True, exist_ok=True)

        for name, value in outputs.items():
            write_json(report_dir / name, value)

        for name, (rows, fields) in csv_outputs.items():
            write_csv(report_dir / name, rows, fields)

        print(f"\nReports saved in: {rel(report_dir, root)}/")

    print("\nSCAN SUMMARY")
    print(f"Files scanned: {len(files)}")
    print(f"References detected: {len(references)}")
    print(f"Dependency edges: {len(dependency_edges)}")
    print(f"Broken-reference candidates: {len(broken)}")
    print(f"Unresolved references: {len(unresolved)}")
    print(f"API route candidates: {len(api_routes)}")
    print(f"Conflict-marker lines: {len(conflicts)}")
    print(f"Parse warnings: {len(parse_errors)}")
    print(f"Pages with suggestions: {len(page_suggestions)}")

    if args.show_conflicts and conflicts:
        print("\nCONFLICT MARKERS")

        for finding in conflicts:
            print(
                f"{finding['file']}:{finding['line']}: "
                f"{finding['marker']}"
            )

    if conflicts:
        print(
            "\nWARNING: Potential conflict markers detected. "
            "No conflicts were resolved."
        )

    print("\nCompleted. Source files were not edited.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
