
#!/usr/bin/env python3
"""
MedOrbits Adaptive Repository Completer
========================================

Detects:
- Missing local HTML pages linked from existing pages.
- Missing topic pages linked from the nearest index.html.
- Empty or unusually small files that may need review.
- Broken internal HTML links.
- Candidate pages that can inherit context from a nearby index page.

Safety:
- Dry-run is the default.
- Never overwrites an existing file.
- Never deletes or renames files.
- Creates only missing local HTML pages.
- Does not execute repository code.
- Uses only Python's standard library.

Usage:
    python tools/complete_repository.py
    python tools/complete_repository.py --report
    python tools/complete_repository.py --apply
    python tools/complete_repository.py --apply --min-bytes 100
    python tools/complete_repository.py --root . --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


VERSION = "1.0.0"

IGNORED_DIRS = {
    ".git",
    ".github",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    "vendor",
}

IGNORED_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".sqlite", ".db",
}

TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".json", ".md", ".txt", ".xml", ".yaml", ".yml",
    ".py", ".sh", ".toml", ".yml",
}


class HTMLInspector(HTMLParser):
    """Extract page links and basic document metadata."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.title_parts: list[str] = []
        self.in_title = False
        self.description = ""
        self.heading_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attributes = dict(attrs)

        if tag.lower() == "a" and attributes.get("href"):
            self.links.append(attributes["href"])

        if tag.lower() == "title":
            self.in_title = True

        if tag.lower() == "meta":
            if attributes.get("name", "").lower() == "description":
                self.description = attributes.get("content", "")

        if tag.lower() in {"h1", "h2"}:
            self.heading_parts.append("")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data.strip())


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def ignored(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True

    return any(part in IGNORED_DIRS for part in parts)


def safe_path(root: Path, candidate: Path) -> Path | None:
    """Reject paths outside the root and any symlinked path component."""
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


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig", errors="replace")
    except OSError:
        return ""


def inspect_html(path: Path) -> HTMLInspector:
    parser = HTMLInspector()

    try:
        parser.feed(read_text(path))
        parser.close()
    except Exception:
        pass

    return parser


def discover_files(root: Path) -> list[Path]:
    found: list[Path] = []

    for directory, dirs, files in os.walk(root, followlinks=False):
        current = Path(directory)

        dirs[:] = [
            name for name in dirs
            if name not in IGNORED_DIRS
            and not (current / name).is_symlink()
        ]

        for filename in files:
            path = current / filename

            if path.is_symlink() or ignored(path, root):
                continue

            if path.suffix.lower() in TEXT_EXTENSIONS:
                found.append(path)

    return sorted(found)


def nearest_index(target: Path, root: Path, indexes: list[Path]) -> Path | None:
    """Find the closest index.html ancestor; otherwise closest topic index."""
    ancestors = [target.parent, *target.parent.parents]

    for ancestor in ancestors:
        if ancestor == root.parent:
            break

        for index in indexes:
            if index.parent == ancestor:
                return index

        if ancestor == root:
            break

    if not indexes:
        return None

    return min(
        indexes,
        key=lambda item: len(
            os.path.relpath(target.parent, item.parent).split(os.sep)
        ) + (
            0 if inside(target.parent, item.parent)
            else len(os.path.relpath(item.parent, target.parent).split(os.sep))
        ),
    )


def local_html_target(
    source: Path,
    href: str,
    root: Path,
) -> Path | None:
    """Resolve local HTML links while ignoring external and non-page links."""
    href = href.strip()

    if not href or href.startswith(("#", "?", "//")):
        return None

    parts = urlsplit(href)

    if parts.scheme or parts.netloc:
        return None

    decoded = unquote(parts.path)

    if not decoded:
        return None

    candidate = Path(decoded)

    if candidate.is_absolute():
        # Root-relative website paths map to the repository root.
        candidate = root / decoded.lstrip("/")
    else:
        candidate = source.parent / candidate

    if candidate.suffix.lower() not in {".html", ".htm"}:
        return None

    candidate = safe_path(root, candidate)

    if candidate is None or ignored(candidate, root):
        return None

    return candidate


def page_title(path: Path, root: Path) -> str:
    parser = inspect_html(path)

    title = " ".join(" ".join(parser.title_parts).split())

    if title:
        return title

    name = path.stem.replace("-", " ").replace("_", " ").strip()

    if name.lower() == "index":
        name = path.parent.name.replace("-", " ").replace("_", " ")

    return name.title() or "MedOrbits Resource"


def make_page(
    target: Path,
    root: Path,
    index: Path | None,
) -> str:
    title = page_title(target, root)
    relative = target.relative_to(root).as_posix()

    source_title = page_title(index, root) if index else "MedOrbits"

    description = (
        f"Explore {title} resources, guidance, and related information "
        f"from MedOrbits."
    )

    # Use a relative stylesheet reference only if the source index links
    # to a shared stylesheet. Otherwise create a clean, standalone page.
    stylesheet = ""
    if index:
        parser = inspect_html(index)
        text = read_text(index)
        match = re.search(
            r'<link\b[^>]*\bhref=["\']([^"\']+\.css(?:\?[^"\']*)?)["\']',
            text,
            flags=re.IGNORECASE,
        )
        if match:
            original = match.group(1)
            parts = urlsplit(original)

            if not parts.scheme and not parts.netloc and not original.startswith("//"):
                stylesheet_path = (index.parent / unquote(parts.path)).resolve()
                if inside(stylesheet_path, root) and stylesheet_path.is_file():
                    rel = os.path.relpath(
                        stylesheet_path,
                        target.parent,
                    ).replace(os.sep, "/")
                    if not rel.startswith("."):
                        rel = "./" + rel
                    stylesheet = (
                        f'  <link rel="stylesheet" href="{escape(rel, quote=True)}">\n'
                    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="{escape(description, quote=True)}">
  <meta name="theme-color" content="#102b43">
  <title>{escape(title)} | MedOrbits</title>
{stylesheet}</head>
<body>
  <header>
    <nav aria-label="Breadcrumb">
      <a href="{escape(os.path.relpath(root / 'index.html', target.parent).replace(os.sep, '/'), quote=True)}">Home</a>
      <span aria-hidden="true"> / </span>
      <span>{escape(title)}</span>
    </nav>
    <p>{escape(source_title)}</p>
  </header>

  <main>
    <article>
      <h1>{escape(title)}</h1>
      <p>{escape(description)}</p>

      <section aria-labelledby="overview">
        <h2 id="overview">Overview</h2>
        <p>
          This page has been generated as a starter file. Add verified,
          topic-specific information before publishing it.
        </p>
      </section>

      <section aria-labelledby="resources">
        <h2 id="resources">Related resources</h2>
        <p>
          Review the relevant MedOrbits topic index and link to verified
          resources, admission guidance, and supporting documents.
        </p>
      </section>
    </article>
  </main>

  <footer>
    <p>MedOrbits -- Information and guidance.</p>
    <p><small>Starter page; editorial review required.</small></p>
  </footer>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Detect and safely scaffold missing MedOrbits HTML pages."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root (default: current directory).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create missing HTML pages. Default is dry-run.",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Write a JSON report to stdout.",
    )
    parser.add_argument(
        "--min-bytes",
        type=int,
        default=80,
        help="Report existing text files smaller than this size (default: 80).",
    )
    parser.add_argument(
        "--max-create",
        type=int,
        default=200,
        help="Maximum missing pages to create in one run (default: 200).",
    )

    args = parser.parse_args()

    if args.min_bytes < 0:
        parser.error("--min-bytes must be zero or greater")

    if args.max_create < 1:
        parser.error("--max-create must be at least 1")

    root = Path(args.root).resolve()

    if not root.is_dir():
        print(f"ERROR: repository root not found: {root}", file=sys.stderr)
        return 2

    files = discover_files(root)
    indexes = [
        path for path in files
        if path.name.lower() == "index.html"
    ]

    missing: dict[Path, Path] = {}
    broken_links: list[dict[str, str]] = []
    small_files: list[dict[str, object]] = []

    for source in files:
        if source.suffix.lower() not in {".html", ".htm"}:
            try:
                size = source.stat().st_size
            except OSError:
                continue

            if size < args.min_bytes:
                small_files.append({
                    "file": source.relative_to(root).as_posix(),
                    "bytes": size,
                    "action": "review_only",
                })
            continue

        source_parser = inspect_html(source)

        for href in source_parser.links:
            target = local_html_target(source, href, root)

            if target is None or target.exists():
                continue

            context = nearest_index(target, root, indexes)

            if context is None:
                broken_links.append({
                    "source": source.relative_to(root).as_posix(),
                    "target": target.relative_to(root).as_posix(),
                    "reason": "missing local HTML target; no index context found",
                })
                continue

            missing.setdefault(target, context)

    candidates = sorted(missing.items(), key=lambda pair: pair[0])

    if len(candidates) > args.max_create:
        print(
            f"WARNING: limiting candidates from {len(candidates)} "
            f"to {args.max_create}.",
            file=sys.stderr,
        )
        candidates = candidates[:args.max_create]

    created: list[str] = []
    skipped: list[str] = []

    for target, context in candidates:
        relative = target.relative_to(root).as_posix()

        if target.exists():
            skipped.append(relative)
            continue

        if not args.apply:
            continue

        checked = safe_path(root, target)

        if checked is None:
            skipped.append(relative)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        # Exclusive creation prevents overwriting a file created concurrently.
        try:
            with target.open("x", encoding="utf-8", newline="\n") as handle:
                handle.write(make_page(target, root, context))
        except FileExistsError:
            skipped.append(relative)
            continue
        except OSError as exc:
            print(f"WARNING: could not create {relative}: {exc}", file=sys.stderr)
            skipped.append(relative)
            continue

        created.append(relative)

    report = {
        "tool": "MedOrbits Adaptive Repository Completer",
        "version": VERSION,
        "timestamp": utc_now(),
        "repository": str(root),
        "mode": "apply" if args.apply else "dry-run",
        "files_scanned": len(files),
        "index_pages_found": len(indexes),
        "missing_page_candidates": [
            {
                "target": target.relative_to(root).as_posix(),
                "context_index": context.relative_to(root).as_posix(),
            }
            for target, context in candidates
        ],
        "small_files_review_only": small_files,
        "unresolved_links": broken_links,
        "created": created,
        "skipped": skipped,
        "safety": {
            "existing_files_overwritten": False,
            "files_deleted": False,
            "repository_code_executed": False,
            "generated_pages_require_editorial_review": True,
        },
    }

    if args.report:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Repository: {root}")
        print(f"Files scanned: {len(files)}")
        print(f"Topic index pages: {len(indexes)}")
        print(f"Missing page candidates: {len(candidates)}")
        print(f"Small files to review: {len(small_files)}")
        print(f"Unresolved links without index context: {len(broken_links)}")

        if args.apply:
            print(f"Pages created: {len(created)}")
            print(f"Pages skipped: {len(skipped)}")
        else:
            print("DRY RUN: no files were created.")
            for target, context in candidates:
                print(
                    f"  WOULD CREATE {target.relative_to(root)} "
                    f"(context: {context.relative_to(root)})"
                )

        print("\nSmall files are reported for review only.")
        print("Generated pages contain starter content, not verified facts.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
