
#!/usr/bin/env python3
“””
MedOrbits Repository-Wide Page Design Synchronizer
==================================================

File: tools/sync_pages_from_reference.py
Version: 3.1.0

Purpose:
    Synchronize shared CSS and JavaScript references from HTML pages
    in a reference directory to eligible nested HTML pages.

Requirements:
    Python 3.10+
    beautifulsoup4 >= 4.12.3

Safety:
    - Dry-run is the default.
    - Root-level HTML files are excluded.
    - Reference pages and template directories are excluded.
    - Dependency and generated directories are excluded.
    - Symlinked files and directories are rejected.
    - Existing page-specific assets are preserved.
    - Replacement affects only synchronizer-managed references.
    - Scaffold files are created exclusively.
    - HTML writes use temporary files and atomic replacement.
    - Existing page content is checked before replacement.
    - No external code is downloaded or executed.

Examples:
    python tools/sync_pages_from_reference.py
    python tools/sync_pages_from_reference.py —apply
    python tools/sync_pages_from_reference.py —apply —backup
    python tools/sync_pages_from_reference.py —apply —replace-assets
    python tools/sync_pages_from_reference.py —apply —create-scaffold
    python tools/sync_pages_from_reference.py —strict
“””

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import sys
import tempfile

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit, urlunsplit

try:
    from bs4 import BeautifulSoup, Tag
except ImportError:
    print(
        “ERROR: beautifulsoup4 is required.\n”
        ‘Install with: python -m pip install “beautifulsoup4>=4.12.3”’,
        file=sys.stderr,
    )
    raise SystemExit(2)


VERSION = “3.1.0”

MAX_HTML_SIZE = 10 * 1024 * 1024
MAX_ASSET_SIZE = 25 * 1024 * 1024
MAX_REPORT_SIZE = 20 * 1024 * 1024

MANAGED_ATTRIBUTE = “data-mo-reference-sync”
MANAGED_VALUE = “managed”

EXCLUDED_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.venv”,
    “venv”,
    “node_modules”,
    “vendor”,
    “__pycache__”,
    “.next”,
    “.nuxt”,
    “dist”,
    “build”,
    “coverage”,
    “playwright-report”,
    “test-results”,
    “.medorbits-backups”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “.tox”,
    “.cache”,
    “.turbo”,
}

TEMPLATE_DIRS = {
    “template”,
    “templates”,
    “_template”,
    “_templates”,
    “html-templates”,
    “page-templates”,
}

TEMPLATE_FILES = {
    “template.html”,
    “template.htm”,
    “base.html”,
    “base.htm”,
    “layout.html”,
    “layout.htm”,
    “master.html”,
    “master.htm”,
}

HTML_SUFFIXES = {“.html”, “.htm”}
CSS_SUFFIXES = {“.css”}
JS_SUFFIXES = {“.js”, “.mjs”}

DEFAULT_REPORT = Path(
    “reports/page-reference-sync-report.json”
)

DEFAULT_SCAFFOLD_CSS = Path(
    “assets/css/reference-sync.css”
)

DEFAULT_SCAFFOLD_JS = Path(
    “assets/js/reference-sync.js”
)

SCAFFOLD_CSS = r”””/*
 * MedOrbits reference synchronization helper.
 * Optional shared helper layer.
 * Does not replace existing page stylesheets.
 */

:root {
    —mo-reference-transition: 240ms ease;
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
“””

SCAFFOLD_JS = r”””/*
 * MedOrbits reference synchronization helper.
 * Optional shared behavior.
 * Does not replace page-specific JavaScript.
 */

(() => {
    “use strict”;

    const root = document.documentElement;

    if (root.dataset.moReferenceSync === “true”) {
        return;
    }

    root.dataset.moReferenceSync = “true”;

    const motion = window.matchMedia(
        “(prefers-reduced-motion: reduce)”
    );

    const updateMotion = (event) => {
        root.classList.toggle(
            “mo-reduced-motion”,
            event.matches
        );
    };

    updateMotion(motion);

    if (typeof motion.addEventListener === “function”) {
        motion.addEventListener(“change”, updateMotion);
    } else if (typeof motion.addListener === “function”) {
        motion.addListener(updateMotion);
    }
})();
“””


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
    referrerpolicy: str | None = None

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
    warnings: list[str] = field(default_factory=list)


# =============================================================================
# General helpers
# =============================================================================

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def relative(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


def is_within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except (ValueError, OSError, RuntimeError):
        return False


def is_template_file(path: Path) -> bool:
    name = path.name.lower()
    stem = path.stem.lower()

    return (
        name in TEMPLATE_FILES
        or stem in {“template”, “base”, “layout”, “master”}
        or stem.endswith(
            (“.template”, “.tmpl”, “.layout”)
        )
    )


def is_excluded_relative(path: Path) -> bool:
    excluded = EXCLUDED_DIRS | TEMPLATE_DIRS

    return any(
        part.lower() in excluded
        for part in path.parts
    )


def validate_relative_path(path: Path) -> bool:
    if path.is_absolute():
        return False

    if not path.parts:
        return False

    return all(
        part not in {“”, “.”, “..”}
        for part in path.parts
    )


def safe_path(
    path: Path,
    root: Path,
    allow_missing: bool = True,
) -> bool:
    “””
    Reject paths outside root and existing symlink components.
    “””

    root = root.resolve()
    absolute = Path(os.path.abspath(path))

    if not is_within(absolute, root):
        return False

    try:
        relative_path = absolute.relative_to(root)
    except ValueError:
        return False

    current = root

    for component in relative_path.parts:
        current = current / component

        try:
            info = current.lstat()
        except FileNotFoundError:
            if allow_missing:
                continue
            return False
        except OSError:
            return False

        if stat.S_ISLNK(info.st_mode):
            return False

    return True


def read_regular_file(
    path: Path,
    max_size: int,
) -> bytes:
    “””
    Read a bounded regular file without following a final symlink.
    “””

    info = path.lstat()

    if stat.S_ISLNK(info.st_mode):
        raise OSError(“Symlinked files are not permitted.”)

    if not stat.S_ISREG(info.st_mode):
        raise OSError(“Path is not a regular file.”)

    if info.st_size > max_size:
        raise OSError(
            f”File exceeds size limit of {max_size} bytes.”
        )

    data = path.read_bytes()

    if len(data) > max_size:
        raise OSError(
            f”File exceeds size limit of {max_size} bytes.”
        )

    return data


# =============================================================================
# Discovery
# =============================================================================

def discover_html(
    root: Path,
    reference_dir: Path,
    report_path: Path,
) -> list[Path]:

    targets: list[Path] = []

    reference_resolved = reference_dir.resolve()
    report_resolved = report_path.resolve()

    for current, dirs, filenames in os.walk(
        root,
        followlinks=False,
    ):
        current_path = Path(current)

        filtered_dirs = []

        for dirname in dirs:
            child = current_path / dirname

            if child.is_symlink():
                continue

            if dirname.lower() in EXCLUDED_DIRS | TEMPLATE_DIRS:
                continue

            try:
                resolved = child.resolve(strict=True)
            except (OSError, RuntimeError):
                continue

            if resolved == reference_resolved:
                continue

            if not is_within(resolved, root):
                continue

            filtered_dirs.append(dirname)

        dirs[:] = sorted(filtered_dirs)

        for filename in sorted(filenames):
            path = current_path / filename

            if path.is_symlink():
                continue

            if path.suffix.lower() not in HTML_SUFFIXES:
                continue

            if is_template_file(path):
                continue

            try:
                info = path.lstat()
            except OSError:
                continue

            if not stat.S_ISREG(info.st_mode):
                continue

            if not safe_path(path, root, allow_missing=False):
                continue

            try:
                rel = path.relative_to(root)
            except ValueError:
                continue

            # Exclude root-level HTML pages.
            if len(rel.parts) == 1:
                continue

            if is_excluded_relative(rel):
                continue

            resolved = path.resolve()

            if resolved == report_resolved:
                continue

            if is_within(resolved, reference_dir):
                continue

            targets.append(path)

    return sorted(
        set(targets),
        key=lambda item: relative(root, item).casefold(),
    )


# =============================================================================
# Asset resolution
# =============================================================================

def local_candidate(
    raw_path: str,
    reference_page: Path,
    root: Path,
) -> Path | None:

    if raw_path.startswith(“/“):
        candidate = root / raw_path.lstrip(“/“)
    else:
        candidate = reference_page.parent / raw_path

    try:
        resolved = candidate.resolve()
    except (OSError, RuntimeError):
        return None

    if not is_within(resolved, root):
        return None

    return resolved


def resolve_reference_asset(
    url: str,
    reference_page: Path,
    root: Path,
    kind: str,
) -> AssetReference | None:

    url = url.strip()

    if not url:
        return None

    parsed = urlsplit(url)
    scheme = parsed.scheme.lower()

    if scheme in {
        “data”,
        “blob”,
        “javascript”,
        “mailto”,
        “tel”,
    }:
        return None

    if scheme in {“http”, “https”} or parsed.netloc:
        return AssetReference(
            kind=kind,
            source_url=url,
            reference_page=relative(root, reference_page),
            external=True,
        )

    if scheme:
        return None

    raw_path = unquote(parsed.path)

    if not raw_path:
        return None

    candidate = local_candidate(
        raw_path,
        reference_page,
        root,
    )

    if candidate is None:
        return None

    suffixes = (
        CSS_SUFFIXES
        if kind == “css”
        else JS_SUFFIXES
    )

    if candidate.suffix.lower() not in suffixes:
        return None

    return AssetReference(
        kind=kind,
        source_url=url,
        reference_page=relative(root, reference_page),
        local_path=relative(root, candidate),
        external=False,
    )


def read_reference_pages(
    root: Path,
    reference_dir: Path,
) -> tuple[list[AssetReference], list[dict[str, str]]]:

    if not reference_dir.is_dir():
        raise FileNotFoundError(
            f”Reference directory does not exist: {reference_dir}”
        )

    if not safe_path(
        reference_dir,
        root,
        allow_missing=False,
    ):
        raise RuntimeError(
            “Reference directory contains an unsafe path.”
        )

    pages: list[Path] = []

    for current, dirs, filenames in os.walk(
        reference_dir,
        followlinks=False,
    ):
        current_path = Path(current)

        dirs[:] = sorted(
            name
            for name in dirs
            if name.lower() not in EXCLUDED_DIRS | TEMPLATE_DIRS
            and not (current_path / name).is_symlink()
        )

        for filename in sorted(filenames):
            path = current_path / filename

            if path.is_symlink():
                continue

            if path.suffix.lower() not in HTML_SUFFIXES:
                continue

            if is_template_file(path):
                continue

            if not safe_path(
                path,
                root,
                allow_missing=False,
            ):
                continue

            pages.append(path)

    pages.sort(
        key=lambda item: relative(root, item).casefold()
    )

    if not pages:
        raise RuntimeError(
            “No eligible HTML reference pages were found.”
        )

    references: list[AssetReference] = []
    diagnostics: list[dict[str, str]] = []

    for page in pages:
        try:
            data = read_regular_file(
                page,
                MAX_HTML_SIZE,
            )
            raw = data.decode(“utf-8-sig”)
        except (OSError, UnicodeError) as exc:
            diagnostics.append({
                “page”: relative(root, page),
                “severity”: “error”,
                “message”: f”Cannot read reference HTML: {exc}”,
            })
            continue

        soup = BeautifulSoup(raw, “html.parser”)

        for link in soup.find_all(“link”, href=True):
            rel = link.get(“rel”, [])

            if isinstance(rel, str):
                rel = rel.split()

            rel_values = {
                str(value).lower()
                for value in rel
            }

            if “stylesheet” not in rel_values:
                continue

            ref = resolve_reference_asset(
                str(link.get(“href”, “”)),
                page,
                root,
                “css”,
            )

            if ref is None:
                continue

            ref.integrity = link.get(“integrity”)
            ref.crossorigin = link.get(“crossorigin”)
            ref.media = link.get(“media”)
            ref.referrerpolicy = link.get(“referrerpolicy”)

            references.append(ref)

        for script in soup.find_all(“script”, src=True):
            script_type = str(
                script.get(“type”, “”)
            ).strip().lower()

            if script_type in {
                “importmap”,
                “application/json”,
                “application/ld+json”,
                “text/template”,
                “text/x-template”,
            }:
                continue

            ref = resolve_reference_asset(
                str(script.get(“src”, “”)),
                page,
                root,
                “js”,
            )

            if ref is None:
                continue

            ref.integrity = script.get(“integrity”)
            ref.crossorigin = script.get(“crossorigin”)
            ref.script_type = script.get(“type”)
            ref.referrerpolicy = script.get(“referrerpolicy”)
            ref.defer = script.has_attr(“defer”)
            ref.async_attr = script.has_attr(“async”)

            references.append(ref)

    # Deduplicate only equivalent URLs with equivalent attributes.
    unique: list[AssetReference] = []
    seen: set[tuple[Any, ...]] = set()

    for ref in references:
        identity = (
            ref.kind,
            ref.local_path or ref.source_url,
            ref.integrity,
            ref.crossorigin,
            ref.media,
            ref.script_type,
            ref.referrerpolicy,
            ref.defer,
            ref.async_attr,
        )

        if identity in seen:
            continue

        seen.add(identity)
        unique.append(ref)

    if not unique:
        diagnostics.append({
            “page”: relative(root, reference_dir),
            “severity”: “warning”,
            “message”: “No eligible CSS or JavaScript references were found.”,
        })

    return unique, diagnostics


# =============================================================================
# HTML synchronization
# =============================================================================

def ensure_html_structure(
    soup: BeautifulSoup,
) -> tuple[Tag, Tag]:

    html = soup.find(“html”)

    if html is None:
        html = soup.new_tag(“html”)

        for child in list(soup.contents):
            html.append(child.extract())

        soup.append(html)

    head = html.find(“head”, recursive=False)

    if head is None:
        head = soup.new_tag(“head”)
        html.insert(0, head)

    body = html.find(“body”, recursive=False)

    if body is None:
        body = soup.new_tag(“body”)

        for child in list(html.contents):
            if child is not head:
                body.append(child.extract())

        html.append(body)

    return head, body


def local_url_for_target(
    ref: AssetReference,
    target: Path,
    root: Path,
) -> str:

    if ref.external or not ref.local_path:
        return ref.source_url

    asset = root / ref.local_path

    relative_url = os.path.relpath(
        asset,
        start=target.parent,
    ).replace(os.sep, “/“)

    if not relative_url.startswith((“.”, “/“)):
        relative_url = “./“ + relative_url

    parsed = urlsplit(ref.source_url)

    return urlunsplit((
        “”,
        “”,
        relative_url,
        parsed.query,
        parsed.fragment,
    ))


def same_asset_url(
    actual_url: str,
    expected_url: str,
    target: Path,
    root: Path,
) -> bool:

    if actual_url == expected_url:
        return True

    actual = urlsplit(actual_url)
    expected = urlsplit(expected_url)

    if (
        actual.scheme
        or actual.netloc
        or expected.scheme
        or expected.netloc
    ):
        return actual_url == expected_url

    if not actual.path or not expected.path:
        return False

    try:
        actual_path = (
            target.parent / unquote(actual.path)
        ).resolve()

        expected_path = (
            target.parent / unquote(expected.path)
        ).resolve()

    except (OSError, RuntimeError):
        return False

    return (
        is_within(actual_path, root)
        and is_within(expected_path, root)
        and actual_path == expected_path
        and actual.query == expected.query
        and actual.fragment == expected.fragment
    )


def remove_managed_tags(
    soup: BeautifulSoup,
    kind: str,
) -> int:

    removed = 0

    for tag in list(
        soup.find_all(
            attrs={MANAGED_ATTRIBUTE: MANAGED_VALUE}
        )
    ):
        if kind == “css” and tag.name == “link”:
            tag.extract()
            removed += 1

        elif kind == “js” and tag.name == “script”:
            tag.extract()
            removed += 1

    return removed


def is_stylesheet(tag: Tag) -> bool:
    rel = tag.get(“rel”, [])

    if isinstance(rel, str):
        rel = rel.split()

    return “stylesheet” in {
        str(value).lower()
        for value in rel
    }


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
        # Only remove tags managed by this synchronizer.
        removed += remove_managed_tags(soup, “css”)
        removed += remove_managed_tags(soup, “js”)

    added = 0
    pending_scripts: list[Tag] = []

    for ref in refs:
        url = local_url_for_target(
            ref,
            target,
            root,
        )

        if ref.kind == “css”:
            existing = any(
                is_stylesheet(link)
                and same_asset_url(
                    str(link.get(“href”, “”)),
                    url,
                    target,
                    root,
                )
                for link in soup.find_all(
                    “link”,
                    href=True,
                )
            )

            if existing:
                continue

            tag = soup.new_tag(
                “link”,
                rel=“stylesheet”,
                href=url,
            )

            tag[MANAGED_ATTRIBUTE] = MANAGED_VALUE

            for attribute in (
                “integrity”,
                “crossorigin”,
                “media”,
                “referrerpolicy”,
            ):
                value = getattr(ref, attribute)

                if value:
                    tag[attribute] = value

            head.append(tag)
            added += 1

        elif ref.kind == “js”:
            existing = any(
                same_asset_url(
                    str(script.get(“src”, “”)),
                    url,
                    target,
                    root,
                )
                for script in soup.find_all(
                    “script”,
                    src=True,
                )
            )

            if existing:
                continue

            tag = soup.new_tag(
                “script”,
                src=url,
            )

            tag[MANAGED_ATTRIBUTE] = MANAGED_VALUE

            if ref.script_type:
                tag[“type”] = ref.script_type

            for attribute in (
                “integrity”,
                “crossorigin”,
                “referrerpolicy”,
            ):
                value = getattr(ref, attribute)

                if value:
                    tag[attribute] = value

            if ref.defer:
                tag[“defer”] = True
            elif ref.async_attr:
                tag[“async”] = True
            elif not ref.external:
                tag[“defer”] = True

            pending_scripts.append(tag)

    for script in pending_scripts:
        body.append(script)
        added += 1

    return added, removed


# =============================================================================
# Asset validation
# =============================================================================

def validate_local_assets(
    refs: list[AssetReference],
    root: Path,
) -> tuple[list[str], list[str]]:

    missing: set[str] = set()
    unsafe: set[str] = set()

    for ref in refs:
        if ref.external or not ref.local_path:
            continue

        candidate = root / ref.local_path

        if not safe_path(
            candidate,
            root,
            allow_missing=True,
        ):
            unsafe.add(ref.local_path)
            continue

        if not candidate.is_file():
            missing.add(ref.local_path)
            continue

        try:
            info = candidate.lstat()

            if not stat.S_ISREG(info.st_mode):
                unsafe.add(ref.local_path)
                continue

            if info.st_size > MAX_ASSET_SIZE:
                unsafe.add(
                    ref.local_path + “ (exceeds size limit)”
                )

        except OSError:
            unsafe.add(ref.local_path)

    return sorted(missing), sorted(unsafe)


# =============================================================================
# Safe filesystem writes
# =============================================================================

def create_parent_directories(
    path: Path,
    root: Path,
) -> None:

    if not safe_path(path.parent, root):
        raise OSError(
            “Destination parent contains an unsafe path.”
        )

    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if not safe_path(
        path.parent,
        root,
        allow_missing=False,
    ):
        raise OSError(
            “Destination parent became unsafe.”
        )


def write_atomic(
    path: Path,
    data: bytes,
    root: Path,
    mode: int | None = None,
    overwrite: bool = True,
) -> None:
    “””
    Write using a temporary file in the destination directory.

    overwrite=False uses an exclusive hard-link installation so an existing
    destination cannot be replaced.
    “””

    if not safe_path(path, root):
        raise OSError(
            “Destination is outside the repository or contains a symlink.”
        )

    create_parent_directories(path, root)

    if path.is_symlink():
        raise OSError(“Refusing to write through a symlink.”)

    if not overwrite and path.exists():
        raise FileExistsError(path)

    fd, temporary_name = tempfile.mkstemp(
        prefix=f”.{path.name}.”,
        suffix=“.tmp”,
        dir=path.parent,
    )

    temporary = Path(temporary_name)

    try:
        with os.fdopen(fd, “wb”) as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())

        if mode is not None:
            os.chmod(temporary, stat.S_IMODE(mode))

        if overwrite:
            if not safe_path(path, root):
                raise OSError(
                    “Destination became unsafe before replacement.”
                )

            os.replace(temporary, path)

        else:
            # Same-directory hard link provides exclusive installation.
            os.link(temporary, path)
            temporary.unlink()

    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass


def backup_file(
    path: Path,
    root: Path,
    backup_root: Path,
) -> Path:

    relative_path = path.relative_to(root)
    destination = backup_root / relative_path

    if not safe_path(destination, root):
        raise OSError(
            “Backup destination contains an unsafe path.”
        )

    create_parent_directories(destination, root)

    if destination.exists() or destination.is_symlink():
        timestamp = datetime.now(
            timezone.utc
        ).strftime(“%Y%m%dT%H%M%S%fZ”)

        destination = destination.with_name(
            destination.name + f”.{timestamp}.bak”
        )

    if destination.exists() or destination.is_symlink():
        raise FileExistsError(
            f”Backup destination already exists: {destination}”
        )

    source_data = read_regular_file(
        path,
        MAX_HTML_SIZE,
    )

    write_atomic(
        destination,
        source_data,
        root,
        overwrite=False,
    )

    return destination


# =============================================================================
# Page processing
# =============================================================================

def sync_page(
    path: Path,
    root: Path,
    refs: list[AssetReference],
    apply: bool,
    backup: bool,
    backup_root: Path,
    replace_assets: bool,
) -> PageResult:

    result = PageResult(
        path=relative(root, path),
        status=“skipped”,
    )

    try:
        original_bytes = read_regular_file(
            path,
            MAX_HTML_SIZE,
        )

        original = original_bytes.decode(“utf-8-sig”)

    except (OSError, UnicodeError) as exc:
        result.status = “failed”
        result.reason = f”Cannot read HTML: {exc}”
        return result

    result.before_sha256 = sha256(original_bytes)

    try:
        soup = BeautifulSoup(
            original,
            “html.parser”,
        )

        added, removed = inject_references(
            soup,
            path,
            root,
            refs,
            replace_assets,
        )

        updated = str(soup)
        updated_bytes = updated.encode(“utf-8”)

    except Exception as exc:
        result.status = “failed”
        result.reason = (
            f”HTML processing failed: “
            f”{type(exc).__name__}: {exc}”
        )
        return result

    result.references_added = added
    result.references_removed = removed
    result.after_sha256 = sha256(updated_bytes)

    if updated_bytes == original_bytes:
        result.status = “unchanged”
        result.reason = “No changes required.”
        return result

    if not apply:
        result.status = “dry-run”
        result.reason = “Changes planned; no page file written.”
        return result

    backup_path: Path | None = None

    try:
        if not safe_path(
            path,
            root,
            allow_missing=False,
        ):
            raise OSError(
                “Target path became unsafe.”
            )

        current_bytes = read_regular_file(
            path,
            MAX_HTML_SIZE,
        )

        if sha256(current_bytes) != result.before_sha256:
            raise RuntimeError(
                “Page changed during synchronization; refusing replacement.”
            )

        original_mode = path.stat().st_mode

        if backup:
            backup_path = backup_file(
                path,
                root,
                backup_root,
            )

        write_atomic(
            path,
            updated_bytes,
            root,
            mode=original_mode,
            overwrite=True,
        )

        result.status = “updated”
        result.reason = “HTML references synchronized.”

        if backup_path:
            result.backup = relative(
                root,
                backup_path,
            )

    except Exception as exc:
        result.status = “failed”
        result.reason = (
            f”Could not save page: “
            f”{type(exc).__name__}: {exc}”
        )

    return result


# =============================================================================
# Optional scaffold creation
# =============================================================================

def create_scaffold_assets(
    root: Path,
    apply: bool,
) -> list[dict[str, str]]:

    outcomes = []

    assets = (
        (DEFAULT_SCAFFOLD_CSS, SCAFFOLD_CSS),
        (DEFAULT_SCAFFOLD_JS, SCAFFOLD_JS),
    )

    for relative_path, content in assets:
        path = root / relative_path

        if not safe_path(path, root):
            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “rejected”,
                “reason”: “Destination contains an unsafe path.”,
            })
            continue

        if path.exists() or path.is_symlink():
            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “existing”,
                “reason”: “Existing file preserved.”,
            })
            continue

        if not apply:
            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “planned”,
                “reason”: “Would create optional scaffold file.”,
            })
            continue

        try:
            write_atomic(
                path,
                content.encode(“utf-8”),
                root,
                mode=0o644,
                overwrite=False,
            )

            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “created”,
                “reason”: “Scaffold file created.”,
            })

        except FileExistsError:
            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “existing”,
                “reason”: “File appeared during creation; preserved.”,
            })

        except OSError as exc:
            outcomes.append({
                “path”: relative_path.as_posix(),
                “status”: “failed”,
                “reason”: str(exc),
            })

    return outcomes


# =============================================================================
# Report handling
# =============================================================================

def validate_report_destination(
    report_path: Path,
    root: Path,
    reference_dir: Path,
) -> str | None:

    if not is_within(report_path, root):
        return “Report destination must be inside the repository.”

    if not safe_path(report_path, root):
        return “Report destination contains an unsafe path.”

    if report_path == reference_dir or is_within(
        report_path,
        reference_dir,
    ):
        return “Report cannot be inside the reference directory.”

    if report_path.suffix.lower() != “.json”:
        return “Report must use a .json extension.”

    if report_path.exists():
        if report_path.is_symlink():
            return “Report destination cannot be a symlink.”

        if not report_path.is_file():
            return “Report destination must be a regular file.”

        if report_path.suffix.lower() not in {“.json”}:
            return “Existing report destination is not JSON.”

    return None


def save_report(
    report_path: Path,
    report: dict[str, Any],
    root: Path,
) -> None:

    data = (
        json.dumps(
            report,
            indent=2,
            ensure_ascii=False,
        ) + “\n”
    ).encode(“utf-8”)

    if len(data) > MAX_REPORT_SIZE:
        raise OSError(“Audit report exceeds the size limit.”)

    write_atomic(
        report_path,
        data,
        root,
        mode=0o600,
        overwrite=True,
    )


# =============================================================================
# CLI
# =============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            “Synchronize shared CSS and JavaScript references “
            “from reference HTML pages to eligible nested pages.”
        )
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path(“.”),
        help=“Repository root.”,
    )

    parser.add_argument(
        “—reference”,
        type=Path,
        default=Path(“pages”),
        help=“Reference directory.”,
    )

    parser.add_argument(
        “—apply”,
        action=“store_true”,
        help=“Write page changes. Default is dry-run.”,
    )

    parser.add_argument(
        “—backup”,
        action=“store_true”,
        help=“Back up changed pages before writing.”,
    )

    parser.add_argument(
        “—replace-assets”,
        action=“store_true”,
        help=(
            “Replace only synchronizer-managed CSS/JS references. “
            “Page-specific references are preserved.”
        ),
    )

    parser.add_argument(
        “—create-scaffold”,
        action=“store_true”,
        help=“Create optional CSS/JS helper files if missing.”,
    )

    parser.add_argument(
        “—report”,
        type=Path,
        default=DEFAULT_REPORT,
        help=“JSON report path, relative to repository root.”,
    )

    parser.add_argument(
        “—strict-missing-assets”,
        action=“store_true”,
        help=“Return failure when local reference assets are missing.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Return failure for missing assets, diagnostics, or page failures.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”%(prog)s {VERSION}”,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        root = args.root.expanduser().resolve(strict=True)

    except (OSError, RuntimeError) as exc:
        print(
            f”ERROR: Invalid repository root: {exc}”,
            file=sys.stderr,
        )
        return 2

    if not root.is_dir():
        print(
            “ERROR: —root must be a directory.”,
            file=sys.stderr,
        )
        return 2

    reference_dir = (
        args.reference
        if args.reference.is_absolute()
        else root / args.reference
    )

    try:
        reference_dir = reference_dir.resolve(strict=True)

    except (OSError, RuntimeError) as exc:
        print(
            f”ERROR: Invalid reference directory: {exc}”,
            file=sys.stderr,
        )
        return 2

    if (
        not reference_dir.is_dir()
        or not is_within(reference_dir, root)
        or not safe_path(reference_dir, root, allow_missing=False)
    ):
        print(
            “ERROR: Reference directory must be a safe directory inside the repository.”,
            file=sys.stderr,
        )
        return 2

    report_path = (
        args.report
        if args.report.is_absolute()
        else root / args.report
    )

    report_path = Path(os.path.abspath(report_path))

    report_error = validate_report_destination(
        report_path,
        root,
        reference_dir,
    )

    if report_error:
        print(
            f”ERROR: {report_error}”,
            file=sys.stderr,
        )
        return 2

    try:
        refs, diagnostics = read_reference_pages(
            root,
            reference_dir,
        )

    except (OSError, RuntimeError) as exc:
        print(
            f”ERROR: Could not load reference pages: {exc}”,
            file=sys.stderr,
        )
        return 2

    missing_assets, unsafe_assets = validate_local_assets(
        refs,
        root,
    )

    if unsafe_assets:
        print(
            “ERROR: Unsafe reference assets detected:”,
            file=sys.stderr,
        )

        for item in unsafe_assets:
            print(f”  - {item}”, file=sys.stderr)

        return 2

    pages = discover_html(
        root,
        reference_dir,
        report_path,
    )

    print(f”MedOrbits Page Reference Synchronizer {VERSION}”)
    print(f”Repository: {root}”)
    print(f”Reference directory: {reference_dir}”)
    print(f”Mode: {‘APPLY’ if args.apply else ‘DRY RUN’}”)
    print(f”Reference assets discovered: {len(refs)}”)
    print(f”Eligible target pages: {len(pages)}”)
    print(f”Missing local reference assets: {len(missing_assets)}”)

    if args.replace_assets:
        print(
            “Managed replacement enabled: only synchronizer-managed “
            “references can be removed.”
        )

    for item in missing_assets:
        print(f”WARNING: Missing local asset: {item}”)

    for item in diagnostics:
        print(
            f”{item[‘severity’].upper()}: “
            f”{item[‘page’]}: {item[‘message’]}”
        )

    print()

    results: list[PageResult] = []
    backup_root = root / “.medorbits-backups”

    for index, page in enumerate(pages, start=1):
        result = sync_page(
            path=page,
            root=root,
            refs=refs,
            apply=args.apply,
            backup=args.backup,
            backup_root=backup_root,
            replace_assets=args.replace_assets,
        )

        results.append(result)

        print(
            f”[{index}/{len(pages)}] “
            f”{result.status.upper():9} {result.path}”
        )

        if result.references_added or result.references_removed:
            print(
                f”    Added: {result.references_added}; “
                f”removed: {result.references_removed}”
            )

        if result.reason:
            print(f”    {result.reason}”)

    scaffold_results = (
        create_scaffold_assets(root, args.apply)
        if args.create_scaffold
        else []
    )

    for item in scaffold_results:
        print(
            f”[{item[‘status’].upper()}] “
            f”{item[‘path’]}: {item[‘reason’]}”
        )

    summary = {
        “target_pages”: len(pages),
        “updated”: sum(
            item.status == “updated”
            for item in results
        ),
        “dry_run”: sum(
            item.status == “dry-run”
            for item in results
        ),
        “unchanged”: sum(
            item.status == “unchanged”
            for item in results
        ),
        “skipped”: sum(
            item.status == “skipped”
            for item in results
        ),
        “failed”: sum(
            item.status == “failed”
            for item in results
        ),
        “missing_assets”: len(missing_assets),
        “diagnostics”: len(diagnostics),
        “scaffold_failures”: sum(
            item[“status”] in {“failed”, “rejected”}
            for item in scaffold_results
        ),
    }

    report = {
        “tool”: “MedOrbits Page Reference Synchronizer”,
        “version”: VERSION,
        “timestamp_utc”: utc_now(),
        “repository_root”: str(root),
        “reference_directory”: relative(root, reference_dir),
        “mode”: “apply” if args.apply else “dry-run”,
        “replace_assets”: args.replace_assets,
        “backup_enabled”: args.backup,
        “root_level_html_excluded”: True,
        “reference_pages_modified”: False,
        “existing_page_specific_assets_preserved”: True,
        “managed_references_only_replaced”: True,
        “limits”: {
            “html_bytes”: MAX_HTML_SIZE,
            “asset_bytes”: MAX_ASSET_SIZE,
            “report_bytes”: MAX_REPORT_SIZE,
        },
        “reference_assets”: [
            asdict(item)
            for item in refs
        ],
        “missing_local_assets”: missing_assets,
        “diagnostics”: diagnostics,
        “scaffold_assets”: scaffold_results,
        “summary”: summary,
        “pages”: [
            asdict(item)
            for item in results
        ],
    }

    report_error = None

    if args.apply:
        try:
            save_report(
                report_path,
                report,
                root,
            )

            print(f”\nAudit report: {report_path}”)

        except (OSError, ValueError) as exc:
            report_error = str(exc)
            print(
                f”ERROR: Could not save audit report: {exc}”,
                file=sys.stderr,
            )

    else:
        print(
            “\nDry run completed. HTML pages and scaffold files “
            “were not written.”
        )
        print(
            f”Planned audit report: {report_path}”
        )
        print(
            “Use —apply to write changes and persist the report.”
        )

    print(“\nSummary”)
    print(“-——“)

    for key, value in summary.items():
        print(
            f”{key.replace(‘_’, ‘ ‘).title():22}: {value}”
        )

    failures = (
        summary[“failed”]
        + summary[“scaffold_failures”]
        + (1 if report_error else 0)
    )

    strict_failure = (
        args.strict
        and (
            bool(missing_assets)
            or bool(diagnostics)
            or failures > 0
        )
    )

    missing_failure = (
        args.strict_missing_assets
        and bool(missing_assets)
    )

    if failures or strict_failure or missing_failure:
        return 1

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())
