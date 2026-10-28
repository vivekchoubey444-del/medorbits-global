
#!/usr/bin/env python3
"""
MedOrbits Reference-Driven Asset Collector and Site Builder
==========================================================

File:
    tools/repository_connector_extra.py

Supported:
    HTML, HTM, CSS, JavaScript, TypeScript, JSON, JSONL, XML,
    Markdown, CSV, YAML, PDF, images, Word documents, spreadsheets,
    presentations, text documents, fonts, audio, video and archives.

Capabilities:
    - Discover existing repository files.
    - Extract references from HTML, CSS, JavaScript and JSON.
    - Resolve references to exact repository-relative destinations.
    - Find candidate assets in an optional source directory.
    - Copy matching assets only to missing destinations.
    - Build a JSON asset catalogue.
    - Build a Markdown reference report.
    - Validate JSON files.
    - Report missing and ambiguous assets.
    - Never overwrite existing destination files.
    - Never delete source files.
    - Never execute discovered scripts.
    - No network access.

Default mode is read-only.

Examples:
    python tools/repository_connector_extra.py --report

    python tools/repository_connector_extra.py --all

    python tools/repository_connector_extra.py \
        --source-dir incoming-documents --all

    python tools/repository_connector_extra.py \
        --source-dir incoming-documents --collect --apply

    python tools/repository_connector_extra.py \
        --source-dir incoming-documents --all --apply

    python tools/repository_connector_extra.py \
        --root . --output-dir storage/repository-reports --all
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import sys

from collections import Counter, defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


VERSION = "2.0.0"
MAX_FILES = 100_000
MAX_FILE_BYTES = 100 * 1024 * 1024

EXCLUDED_DIRS = {
    ".git", ".hg", ".svn", ".venv", "venv",
    "node_modules", "__pycache__", ".next", ".nuxt",
    "dist", "build", "coverage", "vendor",
}

# Inventory only. These extensions are not automatically executed.
SUPPORTED_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".ts", ".tsx", ".jsx", ".json", ".jsonl", ".xml",
    ".md", ".txt", ".csv", ".yaml", ".yml", ".toml",
    ".py", ".sh", ".pdf",
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".ico", ".avif", ".bmp", ".tif", ".tiff",
    ".doc", ".docx", ".odt", ".rtf",
    ".xls", ".xlsx", ".ods", ".ppt", ".pptx", ".odp",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".mov",
    ".zip", ".gz", ".tar",
}

HTML_EXTENSIONS = {".html", ".htm"}
CSS_EXTENSIONS = {".css"}
JS_EXTENSIONS = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"}
JSON_EXTENSIONS = {".json", ".jsonl"}

HTML_ATTRIBUTES = {
    "href", "src", "poster", "data", "action", "formaction",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def safe_path(root: Path, candidate: Path) -> Path | None:
    """Reject path traversal and symbolic links in every path component."""
    candidate = Path(os.path.abspath(candidate))

    if not inside(candidate, root):
        return None

    current = root

    try:
        parts = candidate.relative_to(root).parts
    except ValueError:
        return None

    for part in parts:
        current = current / part

        if current.is_symlink():
            return None

    return candidate


def rel(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def is_excluded(path: Path, root: Path) -> bool:
    if not inside(path, root):
        return True

    return any(
        part in EXCLUDED_DIRS
        for part in path.relative_to(root).parts
    )


def scan_files(root: Path) -> list[Path]:
    results: list[Path] = []

    for folder, directories, filenames in os.walk(
        root,
        followlinks=False,
    ):
        base = Path(folder)

        directories[:] = [
            item for item in directories
            if item not in EXCLUDED_DIRS
            and not (base / item).is_symlink()
        ]

        for filename in filenames:
            path = base / filename

            if path.is_symlink() or is_excluded(path, root):
                continue

            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            results.append(path)

            if len(results) >= MAX_FILES:
                raise RuntimeError(
                    f"File discovery limit reached: {MAX_FILES}"
                )

    return sorted(results)


def read_text(path: Path) -> str:
    if path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("File exceeds text inspection size limit")

    return path.read_text(encoding="utf-8-sig", errors="replace")


class HTMLReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        values = dict(attrs)

        for attribute in HTML_ATTRIBUTES:
            value = values.get(attribute)

            if value:
                self.references.append({
                    "kind": "html-" + attribute,
                    "value": value.strip(),
                })

        srcset = values.get("srcset")

        if srcset:
            for item in srcset.split(","):
                parts = item.strip().split()

                if parts:
                    self.references.append({
                        "kind": "html-srcset",
                        "value": parts[0],
                    })


def css_references(text: str) -> list[tuple[str, str]]:
    # Handles common url(...) syntax. It is not a full CSS parser.
    pattern = r"""url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)"""

    found: list[tuple[str, str]] = []

    for match in re.finditer(pattern, text, flags=re.IGNORECASE):
        value = (match.group(2) or match.group(3) or "").strip()

        if value:
            found.append(("css-url", value))

    return found


def js_references(text: str) -> list[tuple[str, str]]:
    patterns = [
        r"""(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]""",
        r"""\brequire\(\s*['"]([^'"]+)['"]\s*\)""",
        r"""\bimport\(\s*['"]([^'"]+)['"]\s*\)""",
    ]

    values: set[str] = set()

    for pattern in patterns:
        values.update(re.findall(pattern, text))

    return [
        ("js-import", value)
        for value in sorted(values)
        if value.startswith((".", "/"))
    ]


def json_references(data: object) -> list[tuple[str, str]]:
    """Collect path-like strings from JSON without assuming every string is a path."""
    result: list[tuple[str, str]] = []

    path_key = re.compile(
        r"(?:src|href|url|path|file|image|logo|document|pdf|asset|"
        r"stylesheet|script|download|thumbnail|poster|icon|cover)",
        re.IGNORECASE,
    )

    def visit(value: object, parent_key: str = "") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                visit(child, str(key))

        elif isinstance(value, list):
            for child in value:
                visit(child, parent_key)

        elif isinstance(value, str) and path_key.search(parent_key):
            if value.strip():
                result.append(("json-path", value.strip()))

    visit(data)
    return result


def extract_references(path: Path) -> list[tuple[str, str]]:
    extension = path.suffix.lower()

    try:
        text = read_text(path)
    except (OSError, ValueError):
        return []

    if extension in HTML_EXTENSIONS:
        parser = HTMLReferences()

        try:
            parser.feed(text)
            parser.close()
        except Exception:
            return []

        return [
            (item["kind"], item["value"])
            for item in parser.references
        ]

    if extension in CSS_EXTENSIONS:
        return css_references(text)

    if extension in JS_EXTENSIONS:
        return js_references(text)

    if extension in {".json", ".jsonl"}:
        try:
            if extension == ".json":
                data = json.loads(text)
            else:
                data = [
                    json.loads(line)
                    for line in text.splitlines()
                    if line.strip()
                ]
        except (json.JSONDecodeError, ValueError):
            return []

        return json_references(data)

    return []


def resolve_reference(
    source: Path,
    raw_value: str,
    root: Path,
) -> Path | None:
    value = raw_value.strip()

    if not value or value.startswith(("#", "?", "//")):
        return None

    parsed = urlsplit(value)

    if parsed.scheme or parsed.netloc:
        return None

    decoded = unquote(parsed.path)

    if not decoded:
        return None

    if decoded.startswith("/"):
        # Website-root references resolve from the repository root.
        candidate = root / decoded.lstrip("/")
    else:
        candidate = source.parent / decoded

    candidate = Path(os.path.abspath(candidate))

    return safe_path(root, candidate)


def resolve_existing(
    target: Path,
    kind: str,
    existing: set[Path],
) -> Path | None:
    candidates = [target]

    # Common extension and index resolution for local JS modules.
    if kind == "js-import" and not target.suffix:
        candidates.extend(
            target.with_suffix(extension)
            for extension in (".js", ".mjs", ".cjs", ".json", ".ts")
        )
        candidates.append(target / "index.js")
        candidates.append(target / "index.ts")

    return next(
        (candidate for candidate in candidates if candidate in existing),
        None,
    )


def build_reference_map(
    files: list[Path],
    root: Path,
) -> tuple[list[dict], list[dict], dict[str, list[str]]]:
    known_files = set(files)
    references: list[dict] = []
    missing: list[dict] = []
    related: dict[str, list[str]] = defaultdict(list)

    for source in files:
        for kind, value in extract_references(source):
            target = resolve_reference(source, value, root)

            if target is None:
                continue

            resolved = resolve_existing(target, kind, known_files)

            record = {
                "source": rel(source, root),
                "reference": value,
                "kind": kind,
                "expected_path": rel(target, root),
                "status": "resolved" if resolved else "missing",
                "resolved_path": rel(resolved, root) if resolved else None,
            }

            references.append(record)

            if resolved:
                related[rel(source, root)].append(rel(resolved, root))
            else:
                missing.append(record)

    return references, missing, related


def find_candidates(
    missing: list[dict],
    source_files: list[Path],
    source_root: Path,
    destination_root: Path,
) -> tuple[list[dict], list[dict]]:
    """
    Match missing targets to source files.

    Matching order:
      1. Exact relative path.
      2. Unique case-insensitive basename.

    Ambiguous basename matches are never selected automatically.
    """
    by_relative = {
        rel(path, source_root).casefold(): path
        for path in source_files
    }

    by_name: dict[str, list[Path]] = defaultdict(list)

    for path in source_files:
        by_name[path.name.casefold()].append(path)

    candidates: list[dict] = []
    ambiguous: list[dict] = []
    seen_targets: set[str] = set()

    for item in missing:
        target_text = item["expected_path"]

        if target_text in seen_targets:
            continue

        seen_targets.add(target_text)

        destination = destination_root / target_text
        exact = by_relative.get(target_text.casefold())

        if exact:
            candidates.append({
                "source": str(exact),
                "destination": str(destination),
                "match": "exact-relative-path",
                "reference": item["reference"],
            })
            continue

        basename_matches = by_name.get(
            Path(target_text).name.casefold(),
            [],
        )

        if len(basename_matches) == 1:
            candidates.append({
                "source": str(basename_matches[0]),
                "destination": str(destination),
                "match": "unique-basename",
                "reference": item["reference"],
            })
        elif len(basename_matches) > 1:
            ambiguous.append({
                "destination": str(destination),
                "reference": item["reference"],
                "possible_sources": [
                    str(path) for path in basename_matches
                ],
            })

    return candidates, ambiguous


def validate_json(files: list[Path], root: Path) -> list[dict]:
    results: list[dict] = []

    for path in files:
        if path.suffix.lower() not in JSON_EXTENSIONS:
            continue

        record = {
            "file": rel(path, root),
            "valid": False,
            "error": None,
        }

        try:
            text = read_text(path)

            if path.suffix.lower() == ".json":
                json.loads(text, parse_constant=_reject_constant)
            else:
                for number, line in enumerate(text.splitlines(), start=1):
                    if line.strip():
                        try:
                            json.loads(line, parse_constant=_reject_constant)
                        except (json.JSONDecodeError, ValueError) as exc:
                            raise ValueError(f"line {number}: {exc}") from exc

            record["valid"] = True

        except (OSError, ValueError, json.JSONDecodeError) as exc:
            record["error"] = str(exc)

        results.append(record)

    return results


def _reject_constant(value: str) -> None:
    raise ValueError(f"Non-standard JSON constant: {value}")


def build_catalogue(
    files: list[Path],
    root: Path,
    related: dict[str, list[str]],
) -> dict:
    entries = []

    for path in files:
        try:
            stat = path.stat()

            if stat.st_size > MAX_FILE_BYTES:
                digest = None
                hash_status = "skipped-size-limit"
            else:
                digest = sha256_file(path)
                hash_status = "computed"

            entries.append({
                "path": rel(path, root),
                "filename": path.name,
                "extension": path.suffix.lower(),
                "size_bytes": stat.st_size,
                "sha256": digest,
                "hash_status": hash_status,
                "related_files": sorted(set(
                    related.get(rel(path, root), [])
                )),
            })

        except OSError:
            continue

    return {
        "schema_version": "1.0.0",
        "generated_at": now_utc(),
        "file_count": len(entries),
        "files": entries,
    }


def write_new_file(path: Path, content: str, root: Path) -> None:
    """Create a new file exclusively. Existing files are never replaced."""
    path = Path(os.path.abspath(path))

    checked = safe_path(root, path)

    if checked is None:
        raise ValueError(f"Unsafe output path: {path}")

    if checked.exists():
        raise FileExistsError(
            f"Output already exists; refusing to overwrite: {checked}"
        )

    checked.parent.mkdir(parents=True, exist_ok=True)

    checked = safe_path(root, checked)

    if checked is None:
        raise ValueError("Output path became unsafe.")

    with checked.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(content)
        stream.flush()
        os.fsync(stream.fileno())


def copy_candidate(
    source: Path,
    destination: Path,
    root: Path,
    source_root: Path,
) -> str:
    source = Path(os.path.abspath(source))
    destination = Path(os.path.abspath(destination))

    checked_source = safe_path(source_root, source)
    checked_destination = safe_path(root, destination)

    if checked_source is None or checked_destination is None:
        raise ValueError("Source or destination path is unsafe.")

    if not checked_source.is_file():
        raise ValueError(f"Source is not a regular file: {source}")

    if checked_source.stat().st_size > MAX_FILE_BYTES:
        raise ValueError(f"Source exceeds size limit: {source}")

    if checked_destination.exists():
        raise FileExistsError(
            f"Destination exists; preserving it: {destination}"
        )

    checked_destination.parent.mkdir(parents=True, exist_ok=True)

    # Revalidate after creating directories.
    checked_destination = safe_path(root, checked_destination)

    if checked_destination is None or checked_destination.exists():
        raise FileExistsError(
            f"Destination became unavailable: {destination}"
        )

    # Exclusive mode prevents overwriting a destination created concurrently.
    with checked_source.open("rb") as src:
        with checked_destination.open("xb") as dst:
            shutil.copyfileobj(src, dst)
            dst.flush()
            os.fsync(dst.fileno())

    if sha256_file(checked_source) != sha256_file(checked_destination):
        raise IOError(f"Copied-file checksum mismatch: {destination}")

    return "copied"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Map repository references, catalogue assets, and safely "
            "collect files to referenced destinations."
        )
    )

    parser.add_argument("--root", default=".", help="Repository root.")
    parser.add_argument(
        "--source-dir",
        help="Directory containing supplied documents and assets.",
    )
    parser.add_argument(
        "--output-dir",
        default="storage/repository-reports",
        help="Repository-relative report directory.",
    )
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--validate-json", action="store_true")
    parser.add_argument("--catalogue", action="store_true")
    parser.add_argument("--collect", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write requested reports and copy selected assets.",
    )

    args = parser.parse_args()
    root = Path(args.root).resolve()

    if not root.is_dir():
        print(f"ERROR: invalid repository root: {root}", file=sys.stderr)
        return 2

    if args.all:
        args.report = True
        args.validate_json = True
        args.catalogue = True

    if args.collect and not args.source_dir:
        print("ERROR: --collect requires --source-dir.", file=sys.stderr)
        return 2

    try:
        files = scan_files(root)
        references, missing, related = build_reference_map(files, root)

        json_results = (
            validate_json(files, root)
            if args.validate_json
            else []
        )

        catalogue = build_catalogue(files, root, related)

        source_root = None
        source_files: list[Path] = []
        copy_candidates: list[dict] = []
        ambiguous: list[dict] = []

        if args.source_dir:
            source_root = Path(args.source_dir)

            if not source_root.is_absolute():
                source_root = root / source_root

            source_root = source_root.resolve()

            if not source_root.is_dir():
                raise ValueError(
                    f"Source directory does not exist: {source_root}"
                )

            source_files = scan_files(source_root)

            copy_candidates, ambiguous = find_candidates(
                missing,
                source_files,
                source_root,
                root,
            )

        report = {
            "tool": "MedOrbits Reference-Driven Asset Collector",
            "version": VERSION,
            "generated_at": now_utc(),
            "repository_root": str(root),
            "summary": {
                "files_discovered": len(files),
                "references_discovered": len(references),
                "resolved_references": sum(
                    item["status"] == "resolved"
                    for item in references
                ),
                "missing_references": len(missing),
                "json_files_checked": len(json_results),
                "invalid_json_files": sum(
                    not item["valid"] for item in json_results
                ),
                "source_files_available": len(source_files),
                "copy_candidates": len(copy_candidates),
                "ambiguous_matches": len(ambiguous),
            },
            "references": references,
            "missing_references": missing,
            "json_validation": json_results,
            "catalogue": catalogue if args.catalogue else None,
            "copy_candidates": copy_candidates,
            "ambiguous_matches": ambiguous,
            "safety": {
                "dry_run": not args.apply,
                "existing_files_overwritten": False,
                "source_files_deleted": False,
                "scripts_executed": False,
                "network_access": False,
                "ambiguous_matches_auto_copied": False,
            },
        }

        output_dir = Path(args.output_dir)

        if not output_dir.is_absolute():
            output_dir = root / output_dir

        output_dir = Path(os.path.abspath(output_dir))

        if not inside(output_dir, root):
            raise ValueError("Output directory must be inside the repository.")

        print("MedOrbits Reference-Driven Asset Collector")
        print(f"Repository: {root}")
        print(f"Files discovered: {len(files)}")
        print(f"References discovered: {len(references)}")
        print(f"Missing references: {len(missing)}")
        print(f"Copy candidates: {len(copy_candidates)}")
        print(f"Ambiguous matches: {len(ambiguous)}")

        if args.report:
            print("\nMissing reference preview:")
            for item in missing[:50]:
                print(
                    f"  {item['source']} -> {item['expected_path']}"
                )

        if args.collect:
            print("\nAsset collection preview:")
            for item in copy_candidates[:100]:
                print(
                    f"  {item['source']} -> {item['destination']} "
                    f"[{item['match']}]"
                )

        if args.apply:
            # Write reports first; exclusive creation prevents replacement.
            outputs: list[tuple[Path, str]] = [
                (
                    output_dir / "repository-connector-report.json",
                    json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                )
            ]

            if args.catalogue:
                outputs.append((
                    output_dir / "asset-catalogue.json",
                    json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n",
                ))

            for path, content in outputs:
                write_new_file(path, content, root)
                print(f"CREATED REPORT: {rel(path, root)}")

            if args.collect and source_root is not None:
                copied = 0
                skipped = 0
                failed = 0

                for item in copy_candidates:
                    try:
                        result = copy_candidate(
                            Path(item["source"]),
                            Path(item["destination"]),
                            root,
                            source_root,
                        )
                        copied += 1
                        print(f"COPIED: {item['destination']} [{result}]")

                    except FileExistsError as exc:
                        skipped += 1
                        print(f"SKIPPED: {exc}", file=sys.stderr)

                    except (OSError, ValueError) as exc:
                        failed += 1
                        print(f"FAILED: {exc}", file=sys.stderr)

                print(
                    f"Collection complete: copied={copied}, "
                    f"skipped={skipped}, failed={failed}"
                )

                if failed:
                    return 1

        else:
            print("\nDRY RUN: no files were written or copied.")

            if args.report or args.all:
                print(
                    "Report preview available. Add --apply to write "
                    "the JSON report and requested catalogue."
                )

            if args.collect:
                print(
                    "Add --apply to copy unambiguous candidates. "
                    "Existing destinations will be preserved."
                )

        if report["summary"]["invalid_json_files"]:
            return 1

        return 0

    except (OSError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
