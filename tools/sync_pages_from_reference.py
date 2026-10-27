
#!/usr/bin/env python3
"""
MedOrbits Repository-Wide Page Design Synchronizer
==================================================

File:
    tools/sync_pages_from_reference.py

Reference source:
    /pages/**/*.html

Targets:
    All eligible nested HTML pages across the repository, excluding:
      - HTML files directly in the repository root.
      - HTML files inside /pages (the reference pages).
      - Template files and template directories.
      - Dependencies, generated output, backups, and Git internals.

Features:
    - Uses CSS and JavaScript references found in /pages HTML files.
    - Supports local and external CSS/JS references.
    - Resolves local assets relative to their actual reference page.
    - Rewrites local asset URLs relative to each destination page.
    - Creates missing destination HTML head/body containers if needed.
    - Optionally replaces existing linked stylesheet and script references.
    - Optionally creates missing CSS/JS scaffold assets.
    - Preserves page-specific content, forms, metadata, and inline code.
    - Dry-run by default.
    - Optional backups and JSON audit reports.
    - Refuses to overwrite files outside the repository.
    - Does not download or execute external code.

Requirements:
    Python 3.10+
    beautifulsoup4 >= 4.12.3

Usage:
    python -m pip install "beautifulsoup4>=4.12.3"

    # Preview only
    python tools/sync_pages_from_reference.py --root .

    # Apply shared asset references
    python tools/sync_pages_from_reference.py --root . --apply --backup

    # Replace existing linked CSS/JS references on target pages
    python tools/sync_pages_from_reference.py --root . --apply --backup --replace-assets

    # Create missing CSS/JS scaffold assets
    python tools/sync_pages_from_reference.py --root . --apply --create-scaffold

    # Custom reference directory
    python tools/sync_pages_from_reference.py --root . --reference pages

Safety:
    Dry-run is the default. Review the report before applying changes.
    Existing CSS/JS asset contents are never overwritten by this script.
    --replace-assets replaces HTML references, not the actual asset files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit, urlunsplit

try:
    from bs4 import BeautifulSoup, Tag
except ImportError:
    print(
        "ERROR: beautifulsoup4 is required.\n"
        'Install it with: python -m pip install "beautifulsoup4>=4.12.3"',
        file=sys.stderr,
    )
    raise SystemExit(2)


VERSION = "2.0.0"

EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    "vendor",
    "__pycache__",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "coverage",
    "playwright-report",
    "test-results",
    ".medorbits-backups",
}

TEMPLATE_DIRS = {
    "template",
    "templates",
    "_template",
    "_templates",
    "html-templates",
    "page-templates",
}

TEMPLATE_FILES = {
    "template.html",
    "template.htm",
    "base.html",
    "base.htm",
    "layout.html",
    "layout.htm",
    "master.html",
    "master.htm",
}

CSS_SUFFIXES = {".css"}
JS_SUFFIXES = {".js", ".mjs"}
HTML_SUFFIXES = {".html", ".htm"}

DEFAULT_REPORT = Path("reports/page-reference-sync-report.json")
DEFAULT_SCAFFOLD_CSS = Path("assets/css/reference-sync.css")
DEFAULT_SCAFFOLD_JS = Path("assets/js/reference-sync.js")


SCAFFOLD_CSS = r"""
/*
 * MedOrbits Reference Synchronization Layer
 * Generated scaffold; customize only after reviewing the reference design.
 *
 * This file intentionally contains conservative defaults. The reference
 * pages' actual stylesheets remain the primary design source.
 */

:root {
  --mo-reference-transition: 240ms ease;
}

html {
  scroll-behavior: smooth;
}

img,
picture,
video,
canvas,
svg {
  max-width: 100%;
}

img {
  height: auto;
}

button,
input,
select,
textarea {
  font: inherit;
}

a,
button {
  -webkit-tap-highlight-color: transparent;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
""".strip() + "\n"


SCAFFOLD_JS = r"""
/*
 * MedOrbits Reference Synchronization Layer
 * Generated scaffold; does not replace page-specific JavaScript.
 */
(() => {
  "use strict";

  if (document.documentElement.dataset.moReferenceSync === "true") {
    return;
  }

  document.documentElement.dataset.moReferenceSync = "true";

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  document.documentElement.classList.toggle(
    "mo-reduced-motion",
    reducedMotion.matches
  );

  const updateMotionPreference = (event) => {
    document.documentElement.classList.toggle(
      "mo-reduced-motion",
      event.matches
    );
  };

  if (typeof reducedMotion.addEventListener === "function") {
    reducedMotion.addEventListener("change", updateMotionPreference);
  }
})();
""".strip() + "\n"


@dataclass
class AssetReference:
    kind: str
    source_url: str
    reference_page: str
    local_path: str | None = None
    external: bool = False
    integrity: str | None = None
    crossorigin: str | None = None
    media: str | None = None
    script_type: str | None = None
    defer: bool = False
    async_attr: bool = False


@dataclass
class PageResult:
    path: str
    status: str
    references_added: int = 0
    references_removed: int = 0
    backup: str | None = None
    before_sha256: str | None = None
    after_sha256: str | None = None
    reason: str | None = None


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (ValueError, OSError):
        return False


def is_template_file(path: Path) -> bool:
    name = path.name.lower()
    stem = path.stem.lower()

    if name in TEMPLATE_FILES:
        return True

    if stem in {"template", "base", "layout", "master"}:
        return True

    if stem.endswith((".template", ".tmpl", ".layout")):
        return True

    return False


def excluded_directory(path: Path) -> bool:
    name = path.name.lower()

    return name in EXCLUDED_DIRS or name in TEMPLATE_DIRS


def discover_html(root: Path, reference_dir: Path) -> list[Path]:
    result: list[Path] = []

    for current, dirs, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)

        filtered: list[str] = []

        for dirname in dirs:
            child = current_path / dirname

            if child.is_symlink() or excluded_directory(child):
                continue

            # Never process the reference pages as targets.
            if child.resolve() == reference_dir.resolve():
                continue

            if not is_within(child, root):
                continue

            filtered.append(dirname)

        dirs[:] = filtered

        for filename in filenames:
            path = current_path / filename

            if path.is_symlink() or not path.is_file():
                continue

            if path.suffix.lower() not in HTML_SUFFIXES:
                continue

            if is_template_file(path):
                continue

            if not is_within(path, root):
                continue

            if path.resolve() == reference_dir.resolve():
                continue

            try:
                relative = path.relative_to(root)
            except ValueError:
                continue

            # Root-level HTML pages are intentionally excluded.
            if len(relative.parts) == 1:
                continue

            # Never modify pages within the reference directory.
            if is_within(path, reference_dir):
                continue

            if any(part.lower() in TEMPLATE_DIRS for part in relative.parts):
                continue

            result.append(path)

    return sorted(set(result))


def resolve_reference_asset(
    href: str,
    reference_page: Path,
    root: Path,
    kind: str,
) -> AssetReference | None:
    """
    Resolve an HTML asset URL to a repository-local asset when possible.

    External URLs, data URLs, and fragment-only URLs are not copied or
    fetched. Root-relative URLs are interpreted relative to repository root.
    """
    parsed = urlsplit(href.strip())

    if not href.strip():
        return None

    if parsed.scheme.lower() in {"data", "blob", "javascript", "mailto"}:
        return None

    if parsed.scheme.lower() in {"http", "https"} or parsed.netloc:
        return AssetReference(
            kind=kind,
            source_url=href.strip(),
            reference_page=str(reference_page.relative_to(root)),
            external=True,
        )

    if parsed.scheme:
        return None

    raw_path = unquote(parsed.path)

    if not raw_path:
        return None

    if raw_path.startswith("/"):
        candidate = root / raw_path.lstrip("/")
    else:
        candidate = reference_page.parent / raw_path

    candidate = candidate.resolve()

    if not is_within(candidate, root):
        return None

    expected_suffixes = CSS_SUFFIXES if kind == "css" else JS_SUFFIXES

    if candidate.suffix.lower() not in expected_suffixes:
        return None

    # A missing asset is still recorded as a reference, but flagged by the
    # validation stage. We never download or fabricate the original asset.
    return AssetReference(
        kind=kind,
        source_url=href.strip(),
        reference_page=str(reference_page.relative_to(root)),
        local_path=str(candidate.relative_to(root)),
        external=False,
    )


def read_reference_pages(
    root: Path,
    reference_dir: Path,
) -> tuple[list[AssetReference], list[dict[str, str]]]:
    references: list[AssetReference] = []
    diagnostics: list[dict[str, str]] = []

    if not reference_dir.is_dir():
        raise FileNotFoundError(
            f"Reference directory does not exist: {reference_dir}"
        )

    reference_pages = sorted(
        path
        for path in reference_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in HTML_SUFFIXES
        and not path.is_symlink()
        and not is_template_file(path)
        and not any(excluded_directory(part_path)
                    for part_path in path.parents
                    if part_path != root and part_path != reference_dir)
    )

    if not reference_pages:
        raise RuntimeError(
            f"No eligible HTML reference pages found in {reference_dir}"
        )

    for page in reference_pages:
        try:
            raw = page.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            diagnostics.append({
                "page": str(page.relative_to(root)),
                "error": f"Could not read reference page: {exc}",
            })
            continue

        soup = BeautifulSoup(raw, "html.parser")

        for link in soup.find_all("link", href=True):
            rel = link.get("rel", [])
            if isinstance(rel, str):
                rel = rel.split()

            if "stylesheet" not in [str(item).lower() for item in rel]:
                continue

            ref = resolve_reference_asset(
                str(link.get("href", "")), page, root, "css"
            )

            if ref is None:
                continue

            ref.integrity = link.get("integrity")
            ref.crossorigin = link.get("crossorigin")
            ref.media = link.get("media")
            references.append(ref)

        for script in soup.find_all("script", src=True):
            script_type = str(script.get("type", "")).strip().lower()

            # Import maps and non-JavaScript data scripts are not asset files.
            if script_type in {
                "importmap",
                "application/json",
                "application/ld+json",
                "text/template",
                "text/x-template",
            }:
                continue

            ref = resolve_reference_asset(
                str(script.get("src", "")), page, root, "js"
            )

            if ref is None:
                continue

            ref.integrity = script.get("integrity")
            ref.crossorigin = script.get("crossorigin")
            ref.script_type = script.get("type")
            ref.defer = script.has_attr("defer")
            ref.async_attr = script.has_attr("async")
            references.append(ref)

    # Deduplicate by kind and resolved target. Keep the first reference's
    # ordering because stylesheet and script order can affect functionality.
    unique: list[AssetReference] = []
    seen: set[tuple[str, str]] = set()

    for reference in references:
        identity = (
            reference.kind,
            reference.local_path or reference.source_url,
        )

        if identity in seen:
            continue

        seen.add(identity)
        unique.append(reference)

    return unique, diagnostics


def ensure_html_structure(soup: BeautifulSoup) -> tuple[Tag, Tag]:
    html = soup.find("html")

    if html is None:
        html = soup.new_tag("html")
        old_contents = list(soup.contents)

        for child in old_contents:
            html.append(child.extract())

        soup.append(html)

    head = soup.find("head")

    if head is None:
        head = soup.new_tag("head")
        html.insert(0, head)

    body = soup.find("body")

    if body is None:
        body = soup.new_tag("body")

        for child in list(html.contents):
            if child is head:
                continue
            body.append(child.extract())

        html.append(body)

    return head, body


def local_url_for_target(
    reference: AssetReference,
    target_page: Path,
    root: Path,
) -> str:
    if reference.external:
        return reference.source_url

    if not reference.local_path:
        return reference.source_url

    asset_path = root / reference.local_path

    relative = os.path.relpath(
        asset_path,
        start=target_page.parent,
    ).replace(os.sep, "/")

    parsed = urlsplit(reference.source_url)

    return urlunsplit((
        "",
        "",
        relative,
        parsed.query,
        parsed.fragment,
    ))


def same_asset_url(
    actual_url: str,
    expected_url: str,
    target_page: Path,
    root: Path,
) -> bool:
    if actual_url == expected_url:
        return True

    actual = urlsplit(actual_url)
    expected = urlsplit(expected_url)

    if actual.scheme or actual.netloc or expected.scheme or expected.netloc:
        return actual_url == expected_url

    if not actual.path or not expected.path:
        return False

    actual_path = (target_page.parent / unquote(actual.path)).resolve()
    expected_path = (target_page.parent / unquote(expected.path)).resolve()

    return (
        is_within(actual_path, root)
        and is_within(expected_path, root)
        and actual_path == expected_path
        and actual.query == expected.query
        and actual.fragment == expected.fragment
    )


def is_reference_managed_tag(tag: Tag) -> bool:
    marker = tag.get("data-mo-reference-sync")

    return marker == "managed"


def remove_managed_tags(soup: BeautifulSoup, kind: str) -> int:
    removed = 0

    for tag in list(soup.find_all(attrs={"data-mo-reference-sync": "managed"})):
        if kind == "css" and tag.name == "link":
            tag.extract()
            removed += 1
        elif kind == "js" and tag.name == "script":
            tag.extract()
            removed += 1

    return removed


def existing_css_link(
    soup: BeautifulSoup,
    url: str,
    target_page: Path,
    root: Path,
) -> bool:
    for link in soup.find_all("link", href=True):
        rel = link.get("rel", [])
        if isinstance(rel, str):
            rel = rel.split()

        if "stylesheet" not in [str(item).lower() for item in rel]:
            continue

        if same_asset_url(str(link.get("href", "")), url, target_page, root):
            return True

    return False


def existing_script(
    soup: BeautifulSoup,
    url: str,
    target_page: Path,
    root: Path,
) -> bool:
    for script in soup.find_all("script", src=True):
        if same_asset_url(str(script.get("src", "")), url, target_page, root):
            return True

    return False


def inject_references(
    soup: BeautifulSoup,
    target_page: Path,
    root: Path,
    references: list[AssetReference],
    replace_assets: bool,
) -> tuple[int, int]:
    head, body = ensure_html_structure(soup)

    removed = 0

    if replace_assets:
        removed += remove_managed_tags(soup, "css")
        removed += remove_managed_tags(soup, "js")

        # Remove existing linked CSS and external JS references only.
        # Inline scripts, inline styles, JSON-LD, and import maps are retained.
        for link in list(soup.find_all("link", href=True)):
            rel = link.get("rel", [])
            if isinstance(rel, str):
                rel = rel.split()

            if "stylesheet" in [str(item).lower() for item in rel]:
                link.extract()
                removed += 1

        for script in list(soup.find_all("script", src=True)):
            script_type = str(script.get("type", "")).strip().lower()

            if script_type in {
                "importmap",
                "application/json",
                "application/ld+json",
                "text/template",
                "text/x-template",
            }:
                continue

            script.extract()
            removed += 1

    added = 0
    scripts_to_add: list[Tag] = []

    for reference in references:
        url = local_url_for_target(reference, target_page, root)

        if reference.kind == "css":
            if existing_css_link(soup, url, target_page, root):
                continue

            tag = soup.new_tag("link")
            tag["rel"] = ["stylesheet"]
            tag["href"] = url
            tag["data-mo-reference-sync"] = "managed"

            if reference.integrity:
                tag["integrity"] = reference.integrity
            if reference.crossorigin:
                tag["crossorigin"] = reference.crossorigin
            if reference.media:
                tag["media"] = reference.media

            head.append(tag)
            added += 1

        elif reference.kind == "js":
            if existing_script(soup, url, target_page, root):
                continue

            tag = soup.new_tag("script")
            tag["src"] = url
            tag["data-mo-reference-sync"] = "managed"

            # Preserve module semantics and defer behavior when available.
            if reference.script_type:
                tag["type"] = reference.script_type
            elif not reference.external:
                # Keep classic script behavior by default.
                pass

            if reference.integrity:
                tag["integrity"] = reference.integrity
            if reference.crossorigin:
                tag["crossorigin"] = reference.crossorigin

            # async can reorder scripts; defer is safer for ordered assets.
            if reference.defer:
                tag["defer"] = True
            elif reference.async_attr:
                tag["async"] = True
            elif not reference.external:
                tag["defer"] = True

            scripts_to_add.append(tag)

    # Scripts are inserted in the original reference order at the end of body.
    for script in scripts_to_add:
        body.append(script)
        added += 1

    return added, removed


def create_scaffold_assets(root: Path, apply: bool) -> list[dict[str, str]]:
    assets = {
        root / DEFAULT_SCAFFOLD_CSS: SCAFFOLD_CSS,
        root / DEFAULT_SCAFFOLD_JS: SCAFFOLD_JS,
    }

    outcomes: list[dict[str, str]] = []

    for path, content in assets.items():
        relative = str(path.relative_to(root))

        if path.exists():
            outcomes.append({
                "path": relative,
                "status": "existing",
                "reason": "Existing asset was preserved; no overwrite performed.",
            })
            continue

        if not apply:
            outcomes.append({
                "path": relative,
                "status": "planned",
                "reason": "Would create missing scaffold asset.",
            })
            continue

        path.parent.mkdir(parents=True, exist_ok=True)

        temporary = path.with_name(path.name + ".mo-tmp")

        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())

            os.replace(temporary, path)
        finally:
            if temporary.exists():
                temporary.unlink()

        outcomes.append({
            "path": relative,
            "status": "created",
            "reason": "Missing scaffold asset created.",
        })

    return outcomes


def backup_file(path: Path, root: Path, backup_root: Path) -> Path:
    relative = path.relative_to(root)
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists():
        raise FileExistsError(
            f"Backup already exists; refusing to overwrite it: {destination}"
        )

    shutil.copy2(path, destination)
    return destination


def write_atomic(path: Path, text: str, original_mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".mo-tmp")

    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())

        if original_mode is not None:
            os.chmod(temporary, original_mode)

        os.replace(temporary, path)

    finally:
        if temporary.exists():
            temporary.unlink()


def sync_page(
    path: Path,
    root: Path,
    references: list[AssetReference],
    apply: bool,
    backup: bool,
    backup_root: Path,
    replace_assets: bool,
) -> PageResult:
    result = PageResult(path=str(path.relative_to(root)), status="skipped")

    try:
        original_bytes = path.read_bytes()
        original = original_bytes.decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        result.status = "failed"
        result.reason = f"Could not read UTF-8 HTML: {exc}"
        return result

    result.before_sha256 = digest(original_bytes)

    try:
        soup = BeautifulSoup(original, "html.parser")
        added, removed = inject_references(
            soup=soup,
            target_page=path,
            root=root,
            references=references,
            replace_assets=replace_assets,
        )
        updated = str(soup)
    except Exception as exc:
        result.status = "failed"
        result.reason = f"Could not synchronize HTML: {exc}"
        return result

    result.references_added = added
    result.references_removed = removed
    updated_bytes = updated.encode("utf-8")

    if updated_bytes == original_bytes:
        result.status = "unchanged"
        result.after_sha256 = result.before_sha256
        result.reason = "Page already matches the requested references."
        return result

    result.after_sha256 = digest(updated_bytes)

    if not apply:
        result.status = "dry-run"
        result.reason = "Changes proposed; no files were written."
        return result

    try:
        backup_path = None

        if backup:
            backup_path = backup_file(path, root, backup_root)
            result.backup = str(backup_path.relative_to(root))

        original_mode = path.stat().st_mode
        write_atomic(path, updated, original_mode)
        result.status = "updated"
        result.reason = "HTML asset references synchronized."

    except OSError as exc:
        result.status = "failed"
        result.reason = f"Could not save updated HTML: {exc}"

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Synchronize nested MedOrbits HTML pages with CSS and JS references "
            "found in the /pages reference directory."
        )
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Repository root (default: current directory).",
    )

    parser.add_argument(
        "--reference",
        type=Path,
        default=Path("pages"),
        help="Reference HTML directory, relative to root by default.",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. Default mode is dry-run.",
    )

    parser.add_argument(
        "--backup",
        action="store_true",
        help="Back up each modified target HTML page.",
    )

    parser.add_argument(
        "--replace-assets",
        action="store_true",
        help=(
            "Replace linked CSS and external JS references on target pages "
            "with references found in /pages. Inline code is preserved."
        ),
    )

    parser.add_argument(
        "--create-scaffold",
        action="store_true",
        help="Create missing shared CSS/JS scaffold assets without overwriting existing files.",
    )

    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="Audit report path relative to root by default.",
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        root = args.root.resolve(strict=True)
    except OSError as exc:
        print(f"ERROR: Invalid repository root: {exc}", file=sys.stderr)
        return 2

    if not root.is_dir():
        print("ERROR: --root must be a directory.", file=sys.stderr)
        return 2

    reference_dir = args.reference

    if not reference_dir.is_absolute():
        reference_dir = root / reference_dir

    reference_dir = reference_dir.resolve()

    if not is_within(reference_dir, root):
        print(
            "ERROR: The reference directory must be inside the repository.",
            file=sys.stderr,
        )
        return 2

    report_path = args.report

    if not report_path.is_absolute():
        report_path = root / report_path

    report_path = report_path.resolve()

    if not is_within(report_path, root):
        print(
            "ERROR: The report path must be inside the repository.",
            file=sys.stderr,
        )
        return 2

    try:
        references, diagnostics = read_reference_pages(root, reference_dir)
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: Could not load reference pages: {exc}", file=sys.stderr)
        return 2

    # Validate local references before modifying any target pages.
    missing_assets: list[str] = []

    for reference in references:
        if reference.local_path:
            asset = root / reference.local_path
            if not asset.is_file():
                missing_assets.append(reference.local_path)

    pages = discover_html(root, reference_dir)

    print(f"MedOrbits Page Reference Synchronizer {VERSION}")
    print(f"Repository: {root}")
    print(f"Reference directory: {reference_dir}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Reference assets discovered: {len(references)}")
    print(f"Eligible target pages: {len(pages)}")
    print(f"Missing local reference assets: {len(missing_assets)}")
    print()

    for missing in sorted(set(missing_assets)):
        print(f"WARNING: Referenced local asset is missing: {missing}")

    results: list[PageResult] = []
    failures = 0
    backup_root = root / ".medorbits-backups"

    for index, page in enumerate(pages, start=1):
        result = sync_page(
            path=page,
            root=root,
            references=references,
            apply=args.apply,
            backup=args.backup,
            backup_root=backup_root,
            replace_assets=args.replace_assets,
        )

        results.append(result)

        if result.status == "failed":
            failures += 1

        print(
            f"[{index}/{len(pages)}] {result.status.upper():9} {result.path}"
        )

        if result.references_added or result.references_removed:
            print(
                f"    Added: {result.references_added}; "
                f"removed: {result.references_removed}"
            )

        if result.reason:
            print(f"    {result.reason}")

    scaffold_results: list[dict[str, str]] = []

    if args.create_scaffold:
        try:
            scaffold_results = create_scaffold_assets(root, args.apply)
            for item in scaffold_results:
                print(
                    f"[{item['status'].upper()}] {item['path']}: "
                    f"{item['reason']}"
                )
        except OSError as exc:
            failures += 1
            print(f"ERROR: Could not create scaffold assets: {exc}", file=sys.stderr)

    report: dict[str, Any] = {
        "tool": "MedOrbits Page Reference Synchronizer",
        "version": VERSION,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "repository_root": str(root),
        "reference_directory": str(reference_dir.relative_to(root)),
        "mode": "apply" if args.apply else "dry-run",
        "replace_assets": args.replace_assets,
        "root_level_html_excluded": True,
        "reference_pages_modified": False,
        "reference_assets": [asdict(ref) for ref in references],
        "missing_local_assets": sorted(set(missing_assets)),
        "diagnostics": diagnostics,
        "scaffold_assets": scaffold_results,
        "summary": {
            "target_pages": len(pages),
            "updated": sum(item.status == "updated" for item in results),
            "dry_run": sum(item.status == "dry-run" for item in results),
            "unchanged": sum(item.status == "unchanged" for item in results),
            "skipped": sum(item.status == "skipped" for item in results),
            "failed": failures,
        },
        "pages": [asdict(item) for item in results],
    }

    try:
        if args.apply:
            write_atomic(
                report_path,
                json.dumps(report, indent=2, ensure_ascii=False) + "\n",
            )
            print(f"\nAudit report: {report_path}")
        else:
            print("\nDry run completed. No target HTML or asset files were written.")
            print("Run again with --apply to make the changes.")

    except OSError as exc:
        failures += 1
        print(f"ERROR: Could not write audit report: {exc}", file=sys.stderr)

    print("\nSummary")
    print("-------")

    for key, value in report["summary"].items():
        print(f"{key.replace('_', ' ').title():16}: {value}")

    if missing_assets:
        print(
            "\nWARNING: One or more reference assets are missing. "
            "Resolve these before relying on the synchronized design."
        )

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
