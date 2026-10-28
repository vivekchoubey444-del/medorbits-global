#!/usr/bin/env python3
"""
MedOrbits Repository-Wide Page Design Synchronizer
==================================================

Synchronizes CSS/JS references from HTML pages in a reference directory to
eligible nested HTML pages elsewhere in a repository.

Safety model
------------
- Dry-run by default.
- Root-level HTML, reference pages, templates, symlinks, dependencies, and
  generated directories are excluded.
- Existing assets are never overwritten.
- Existing stylesheet/script references are preserved unless --replace-assets
  is explicitly supplied.
- Apply mode writes a JSON audit report, including dry-run mode.
- HTML writes are atomic; optional backups are collision-safe.
- No external code is downloaded or executed.

Python 3.10+
Dependency: beautifulsoup4 >= 4.12.3

Examples
--------
python tools/sync_pages_from_reference.py --root .
python tools/sync_pages_from_reference.py --root . --report reports/sync.json
python tools/sync_pages_from_reference.py --root . --apply --backup
python tools/sync_pages_from_reference.py --root . --apply --backup --replace-assets
python tools/sync_pages_from_reference.py --root . --apply --create-scaffold
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
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


VERSION = "3.0.0"

EXCLUDED_DIRS = {
    ".git", ".hg", ".svn", ".venv", "venv", "node_modules", "vendor",
    "__pycache__", ".next", ".nuxt", "dist", "build", "coverage",
    "playwright-report", "test-results", ".medorbits-backups",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox",
}
TEMPLATE_DIRS = {
    "template", "templates", "_template", "_templates",
    "html-templates", "page-templates",
}
TEMPLATE_FILES = {
    "template.html", "template.htm", "base.html", "base.htm",
    "layout.html", "layout.htm", "master.html", "master.htm",
}
HTML_SUFFIXES = {".html", ".htm"}
CSS_SUFFIXES = {".css"}
JS_SUFFIXES = {".js", ".mjs"}
DEFAULT_REPORT = Path("reports/page-reference-sync-report.json")
DEFAULT_SCAFFOLD_CSS = Path("assets/css/reference-sync.css")
DEFAULT_SCAFFOLD_JS = Path("assets/js/reference-sync.js")

SCAFFOLD_CSS = r"""/*
 * MedOrbits reference synchronization scaffold.
 * This is an optional helper layer, not a replacement for the reference CSS.
 */
:root { --mo-reference-transition: 240ms ease; }
html { scroll-behavior: smooth; }
img, picture, video, canvas, svg { max-width: 100%; }
img { height: auto; }
button, input, select, textarea { font: inherit; }
a, button { -webkit-tap-highlight-color: transparent; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
"""

SCAFFOLD_JS = r"""/*
 * MedOrbits reference synchronization scaffold.
 * Does not replace page-specific JavaScript.
 */
(() => {
  "use strict";
  if (document.documentElement.dataset.moReferenceSync === "true") return;
  document.documentElement.dataset.moReferenceSync = "true";

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const update = (event) => {
    document.documentElement.classList.toggle("mo-reduced-motion", event.matches);
  };
  update(motion);
  if (typeof motion.addEventListener === "function") {
    motion.addEventListener("change", update);
  } else if (typeof motion.addListener === "function") {
    motion.addListener(update);
  }
})();
"""


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
    referrerpolicy: str | None = None


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
    warnings: list[str] | None = None


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (ValueError, OSError, RuntimeError):
        return False


def is_template_file(path: Path) -> bool:
    name, stem = path.name.lower(), path.stem.lower()
    return (
        name in TEMPLATE_FILES
        or stem in {"template", "base", "layout", "master"}
        or stem.endswith((".template", ".tmpl", ".layout"))
    )


def excluded_directory(path: Path) -> bool:
    name = path.name.lower()
    return name in EXCLUDED_DIRS or name in TEMPLATE_DIRS


def is_excluded_relative(relative: Path) -> bool:
    return any(part.lower() in EXCLUDED_DIRS | TEMPLATE_DIRS for part in relative.parts)


def discover_html(root: Path, reference_dir: Path, report_path: Path) -> list[Path]:
    targets: list[Path] = []
    ref_resolved = reference_dir.resolve()
    report_resolved = report_path.resolve()

    for current, dirs, filenames in os.walk(root, followlinks=False):
        current_path = Path(current)
        filtered = []
        for dirname in dirs:
            child = current_path / dirname
            if child.is_symlink() or excluded_directory(child):
                continue
            try:
                resolved = child.resolve()
            except OSError:
                continue
            if resolved == ref_resolved or not is_within(resolved, root):
                continue
            filtered.append(dirname)
        dirs[:] = filtered

        for filename in filenames:
            path = current_path / filename
            if path.is_symlink() or not path.is_file():
                continue
            if path.suffix.lower() not in HTML_SUFFIXES or is_template_file(path):
                continue
            if not is_within(path, root):
                continue
            try:
                relative = path.relative_to(root)
            except ValueError:
                continue
            if len(relative.parts) == 1 or is_excluded_relative(relative):
                continue
            if path.resolve() == report_resolved:
                continue
            if is_within(path, reference_dir):
                continue
            targets.append(path)

    return sorted(set(targets), key=lambda p: p.relative_to(root).as_posix().casefold())


def local_candidate(raw_path: str, reference_page: Path, root: Path) -> Path | None:
    # Root-relative URLs are interpreted as repository-root-relative, by policy.
    candidate = root / raw_path.lstrip("/") if raw_path.startswith("/") else reference_page.parent / raw_path
    try:
        resolved = candidate.resolve()
    except (OSError, RuntimeError):
        return None
    if not is_within(resolved, root):
        return None
    return resolved


def resolve_reference_asset(
    href: str, reference_page: Path, root: Path, kind: str
) -> AssetReference | None:
    href = href.strip()
    if not href:
        return None

    parsed = urlsplit(href)
    scheme = parsed.scheme.lower()

    if scheme in {"data", "blob", "javascript", "mailto", "tel"}:
        return None

    if scheme in {"http", "https"} or parsed.netloc:
        return AssetReference(
            kind=kind, source_url=href,
            reference_page=reference_page.relative_to(root).as_posix(),
            external=True,
        )

    if scheme:
        return None

    raw_path = unquote(parsed.path)
    if not raw_path:
        return None

    candidate = local_candidate(raw_path, reference_page, root)
    if candidate is None:
        return None

    suffixes = CSS_SUFFIXES if kind == "css" else JS_SUFFIXES
    if candidate.suffix.lower() not in suffixes:
        return None

    return AssetReference(
        kind=kind,
        source_url=href,
        reference_page=reference_page.relative_to(root).as_posix(),
        local_path=candidate.relative_to(root).as_posix(),
        external=False,
    )


def read_reference_pages(
    root: Path, reference_dir: Path
) -> tuple[list[AssetReference], list[dict[str, str]]]:
    if not reference_dir.is_dir():
        raise FileNotFoundError(f"Reference directory does not exist: {reference_dir}")

    pages = []
    for path in reference_dir.rglob("*"):
        if path.is_symlink() or not path.is_file():
            continue
        if path.suffix.lower() not in HTML_SUFFIXES or is_template_file(path):
            continue
        try:
            relative = path.relative_to(root)
        except ValueError:
            continue
        if is_excluded_relative(relative):
            continue
        pages.append(path)

    pages.sort(key=lambda p: p.relative_to(root).as_posix().casefold())
    if not pages:
        raise RuntimeError(f"No eligible HTML reference pages found in {reference_dir}")

    refs: list[AssetReference] = []
    diagnostics: list[dict[str, str]] = []

    for page in pages:
        try:
            raw = page.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            diagnostics.append({
                "page": page.relative_to(root).as_posix(),
                "severity": "error",
                "message": f"Could not read reference HTML: {exc}",
            })
            continue

        soup = BeautifulSoup(raw, "html.parser")

        for link in soup.find_all("link", href=True):
            rel = link.get("rel", [])
            if isinstance(rel, str):
                rel = rel.split()
            if "stylesheet" not in [str(x).lower() for x in rel]:
                continue
            ref = resolve_reference_asset(str(link.get("href", "")), page, root, "css")
            if ref:
                ref.integrity = link.get("integrity")
                ref.crossorigin = link.get("crossorigin")
                ref.media = link.get("media")
                ref.referrerpolicy = link.get("referrerpolicy")
                refs.append(ref)

        for script in soup.find_all("script", src=True):
            script_type = str(script.get("type", "")).strip().lower()
            if script_type in {
                "importmap", "application/json", "application/ld+json",
                "text/template", "text/x-template",
            }:
                continue
            ref = resolve_reference_asset(str(script.get("src", "")), page, root, "js")
            if ref:
                ref.integrity = script.get("integrity")
                ref.crossorigin = script.get("crossorigin")
                ref.script_type = script.get("type")
                ref.defer = script.has_attr("defer")
                ref.async_attr = script.has_attr("async")
                ref.referrerpolicy = script.get("referrerpolicy")
                refs.append(ref)

    # Preserve first-seen ordering, but deduplicate equivalent local asset paths.
    unique: list[AssetReference] = []
    seen: set[tuple[str, str]] = set()
    for ref in refs:
        identity = (ref.kind, ref.local_path or ref.source_url)
        if identity not in seen:
            seen.add(identity)
            unique.append(ref)

    if not unique:
        diagnostics.append({
            "page": reference_dir.relative_to(root).as_posix(),
            "severity": "warning",
            "message": "No eligible CSS or JavaScript references were found.",
        })

    return unique, diagnostics


def ensure_html_structure(soup: BeautifulSoup) -> tuple[Tag, Tag]:
    html = soup.find("html")
    if html is None:
        html = soup.new_tag("html")
        for child in list(soup.contents):
            html.append(child.extract())
        soup.append(html)

    head = html.find("head", recursive=False)
    if head is None:
        head = soup.new_tag("head")
        html.insert(0, head)

    body = html.find("body", recursive=False)
    if body is None:
        body = soup.new_tag("body")
        for child in list(html.contents):
            if child is not head:
                body.append(child.extract())
        html.append(body)

    return head, body


def local_url_for_target(ref: AssetReference, target: Path, root: Path) -> str:
    if ref.external or not ref.local_path:
        return ref.source_url
    asset = root / ref.local_path
    rel = os.path.relpath(asset, start=target.parent).replace(os.sep, "/")
    if not rel.startswith(".") and not rel.startswith("/"):
        rel = "./" + rel
    parsed = urlsplit(ref.source_url)
    return urlunsplit(("", "", rel, parsed.query, parsed.fragment))


def same_asset_url(actual_url: str, expected_url: str, target: Path, root: Path) -> bool:
    if actual_url == expected_url:
        return True
    actual, expected = urlsplit(actual_url), urlsplit(expected_url)
    if actual.scheme or actual.netloc or expected.scheme or expected.netloc:
        return actual_url == expected_url
    if not actual.path or not expected.path:
        return False
    try:
        a = (target.parent / unquote(actual.path)).resolve()
        e = (target.parent / unquote(expected.path)).resolve()
    except (OSError, RuntimeError):
        return False
    return (
        is_within(a, root) and is_within(e, root) and a == e
        and actual.query == expected.query and actual.fragment == expected.fragment
    )


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


def inject_references(
    soup: BeautifulSoup,
    target: Path,
    root: Path,
    refs: list[AssetReference],
    replace_assets: bool,
) -> tuple[int, int]:
    head, body = ensure_html_structure(soup)
    removed = 0

    if replace_assets:
        removed += remove_managed_tags(soup, "css")
        removed += remove_managed_tags(soup, "js")
        # Explicit destructive mode: remove linked CSS and external executable JS,
        # while retaining inline scripts, JSON-LD, import maps and data scripts.
        for link in list(soup.find_all("link", href=True)):
            rel = link.get("rel", [])
            if isinstance(rel, str):
                rel = rel.split()
            if "stylesheet" in [str(x).lower() for x in rel]:
                link.extract()
                removed += 1
        for script in list(soup.find_all("script", src=True)):
            stype = str(script.get("type", "")).strip().lower()
            if stype in {
                "importmap", "application/json", "application/ld+json",
                "text/template", "text/x-template",
            }:
                continue
            script.extract()
            removed += 1

    added = 0
    pending_scripts: list[Tag] = []

    for ref in refs:
        url = local_url_for_target(ref, target, root)
        if ref.kind == "css":
            if any(
                "stylesheet" in [
                    str(x).lower() for x in (
                        link.get("rel", []) if not isinstance(link.get("rel", []), str)
                        else link.get("rel", "").split()
                    )
                ] and same_asset_url(str(link.get("href", "")), url, target, root)
                for link in soup.find_all("link", href=True)
            ):
                continue

            tag = soup.new_tag("link", rel="stylesheet", href=url)
            tag["data-mo-reference-sync"] = "managed"
            for attr in ("integrity", "crossorigin", "media", "referrerpolicy"):
                value = getattr(ref, attr)
                if value:
                    tag[attr] = value
            head.append(tag)
            added += 1

        elif ref.kind == "js":
            if any(
                same_asset_url(str(script.get("src", "")), url, target, root)
                for script in soup.find_all("script", src=True)
            ):
                continue

            tag = soup.new_tag("script", src=url)
            tag["data-mo-reference-sync"] = "managed"
            if ref.script_type:
                tag["type"] = ref.script_type
            for attr in ("integrity", "crossorigin", "referrerpolicy"):
                value = getattr(ref, attr)
                if value:
                    tag[attr] = value
            if ref.defer:
                tag["defer"] = True
            elif ref.async_attr:
                tag["async"] = True
            elif not ref.external:
                tag["defer"] = True
            pending_scripts.append(tag)

    for script in pending_scripts:
        body.append(script)
        added += 1

    return added, removed


def validate_local_assets(refs: list[AssetReference], root: Path) -> tuple[list[str], list[str]]:
    missing: set[str] = set()
    unsafe: set[str] = set()
    for ref in refs:
        if ref.external or not ref.local_path:
            continue
        candidate = root / ref.local_path
        if not is_within(candidate, root):
            unsafe.add(ref.local_path)
        elif not candidate.is_file():
            missing.add(ref.local_path)
    return sorted(missing), sorted(unsafe)


def backup_file(path: Path, root: Path, backup_root: Path) -> Path:
    relative = path.relative_to(root)
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        destination = destination.with_name(destination.name + f".{stamp}.bak")
        if destination.exists():
            raise FileExistsError(f"Backup collision: {destination}")
    shutil.copy2(path, destination)
    return destination


def write_atomic(path: Path, data: bytes, mode: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temp = Path(temp_name)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        if mode is not None:
            os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass


def sync_page(
    path: Path, root: Path, refs: list[AssetReference], apply: bool,
    backup: bool, backup_root: Path, replace_assets: bool,
) -> PageResult:
    result = PageResult(path=path.relative_to(root).as_posix(), status="skipped", warnings=[])
    try:
        original_bytes = path.read_bytes()
        original = original_bytes.decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        result.status = "failed"
        result.reason = f"Could not read UTF-8 HTML: {exc}"
        return result

    result.before_sha256 = sha256(original_bytes)
    try:
        soup = BeautifulSoup(original, "html.parser")
        added, removed = inject_references(soup, path, root, refs, replace_assets)
        updated = str(soup)
        updated_bytes = updated.encode("utf-8")
    except Exception as exc:
        result.status = "failed"
        result.reason = f"Could not prepare HTML: {type(exc).__name__}: {exc}"
        return result

    result.references_added = added
    result.references_removed = removed
    result.after_sha256 = sha256(updated_bytes)

    if updated_bytes == original_bytes:
        result.status = "unchanged"
        result.reason = "No changes required."
        return result

    if not apply:
        result.status = "dry-run"
        result.reason = "Changes planned; no page file was written."
        return result

    try:
        # Detect concurrent edits before replacing the file.
        if sha256(path.read_bytes()) != result.before_sha256:
            raise RuntimeError("File changed during synchronization; refusing to overwrite.")
        backup_path = backup_file(path, root, backup_root) if backup else None
        mode = path.stat().st_mode
        write_atomic(path, updated_bytes, mode)
        result.status = "updated"
        result.reason = "HTML references synchronized."
        if backup_path:
            result.backup = backup_path.relative_to(root).as_posix()
    except Exception as exc:
        result.status = "failed"
        result.reason = f"Could not save page: {type(exc).__name__}: {exc}"
    return result


def create_scaffold_assets(root: Path, apply: bool) -> list[dict[str, str]]:
    outcomes = []
    for relative, content in (
        (DEFAULT_SCAFFOLD_CSS, SCAFFOLD_CSS),
        (DEFAULT_SCAFFOLD_JS, SCAFFOLD_JS),
    ):
        path = root / relative
        if path.exists():
            outcomes.append({
                "path": relative.as_posix(), "status": "existing",
                "reason": "Existing file preserved; no overwrite performed.",
            })
        elif not apply:
            outcomes.append({
                "path": relative.as_posix(), "status": "planned",
                "reason": "Would create optional scaffold file.",
            })
        else:
            try:
                write_atomic(path, content.encode("utf-8"))
                outcomes.append({
                    "path": relative.as_posix(), "status": "created",
                    "reason": "Optional scaffold file created.",
                })
            except OSError as exc:
                outcomes.append({
                    "path": relative.as_posix(), "status": "failed",
                    "reason": str(exc),
                })
    return outcomes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Synchronize nested HTML asset references from /pages reference HTML."
    )
    parser.add_argument("--root", type=Path, default=Path("."), help="Repository root.")
    parser.add_argument("--reference", type=Path, default=Path("pages"),
                        help="Reference directory, relative to root unless absolute.")
    parser.add_argument("--apply", action="store_true", help="Write changes; default is dry-run.")
    parser.add_argument("--backup", action="store_true", help="Back up changed HTML before writing.")
    parser.add_argument("--replace-assets", action="store_true",
                        help="Remove existing linked stylesheets and executable external scripts before adding reference assets.")
    parser.add_argument("--create-scaffold", action="store_true",
                        help="Create optional CSS/JS scaffold files if missing.")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT,
                        help="Audit report path, relative to root unless absolute.")
    parser.add_argument("--strict-missing-assets", action="store_true",
                        help="Return a non-zero exit code if reference assets are missing.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
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

    reference_dir = args.reference if args.reference.is_absolute() else root / args.reference
    try:
        reference_dir = reference_dir.resolve(strict=True)
    except OSError as exc:
        print(f"ERROR: Invalid reference directory: {exc}", file=sys.stderr)
        return 2
    if not reference_dir.is_dir() or not is_within(reference_dir, root):
        print("ERROR: Reference directory must be an existing directory inside the repository.", file=sys.stderr)
        return 2

    report_path = args.report if args.report.is_absolute() else root / args.report
    report_path = report_path.resolve()
    if not is_within(report_path, root):
        print("ERROR: Report path must be inside the repository.", file=sys.stderr)
        return 2
    if report_path == reference_dir or is_within(report_path, reference_dir):
        print("ERROR: Report path cannot be inside the reference directory.", file=sys.stderr)
        return 2

    try:
        refs, diagnostics = read_reference_pages(root, reference_dir)
    except (OSError, RuntimeError) as exc:
        print(f"ERROR: Could not load reference pages: {exc}", file=sys.stderr)
        return 2

    missing_assets, unsafe_assets = validate_local_assets(refs, root)
    if unsafe_assets:
        print("ERROR: Unsafe asset paths found; refusing to continue:", file=sys.stderr)
        for item in unsafe_assets:
            print(f"  - {item}", file=sys.stderr)
        return 2

    pages = discover_html(root, reference_dir, report_path)
    print(f"MedOrbits Page Reference Synchronizer {VERSION}")
    print(f"Repository: {root}")
    print(f"Reference directory: {reference_dir}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Reference assets discovered: {len(refs)}")
    print(f"Eligible target pages: {len(pages)}")
    print(f"Missing local reference assets: {len(missing_assets)}")
    if args.replace_assets:
        print("WARNING: --replace-assets is enabled; existing linked CSS/JS references may be removed.")
    for item in missing_assets:
        print(f"WARNING: Missing local asset: {item}")
    print()

    results: list[PageResult] = []
    failures = 0
    backup_root = root / ".medorbits-backups"

    for index, page in enumerate(pages, start=1):
        result = sync_page(
            page, root, refs, args.apply, args.backup, backup_root, args.replace_assets
        )
        results.append(result)
        if result.status == "failed":
            failures += 1
        print(f"[{index}/{len(pages)}] {result.status.upper():9} {result.path}")
        if result.references_added or result.references_removed:
            print(f"    Added: {result.references_added}; removed: {result.references_removed}")
        if result.reason:
            print(f"    {result.reason}")

    scaffold_results = create_scaffold_assets(root, args.apply) if args.create_scaffold else []
    for item in scaffold_results:
        print(f"[{item['status'].upper()}] {item['path']}: {item['reason']}")
        if item["status"] == "failed":
            failures += 1

    summary = {
        "target_pages": len(pages),
        "updated": sum(x.status == "updated" for x in results),
        "dry_run": sum(x.status == "dry-run" for x in results),
        "unchanged": sum(x.status == "unchanged" for x in results),
        "skipped": sum(x.status == "skipped" for x in results),
        "failed": sum(x.status == "failed" for x in results),
    }
    report: dict[str, Any] = {
        "tool": "MedOrbits Page Reference Synchronizer",
        "version": VERSION,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "repository_root": str(root),
        "reference_directory": reference_dir.relative_to(root).as_posix(),
        "mode": "apply" if args.apply else "dry-run",
        "replace_assets": args.replace_assets,
        "backup_enabled": args.backup,
        "root_level_html_excluded": True,
        "reference_pages_modified": False,
        "reference_assets": [asdict(x) for x in refs],
        "missing_local_assets": missing_assets,
        "diagnostics": diagnostics,
        "scaffold_assets": scaffold_results,
        "summary": summary,
        "pages": [asdict(x) for x in results],
    }

    try:
        report_bytes = (json.dumps(report, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
        if args.apply:
            write_atomic(report_path, report_bytes)
            print(f"\nAudit report: {report_path}")
        else:
            print("\nDry run completed. Target HTML and scaffold files were not written.")
            print(f"Planned audit report: {report_path}")
            print("Use --apply to write changes and persist the report.")
    except OSError as exc:
        failures += 1
        print(f"ERROR: Could not write audit report: {exc}", file=sys.stderr)

    print("\nSummary")
    print("-------")
    for key, value in summary.items():
        print(f"{key.replace('_', ' ').title():16}: {value}")

    if failures:
        return 1
    if missing_assets and args.strict_missing_assets:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
