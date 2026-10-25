#!/usr/bin/env python3
"""
MedOrbits Repository Scaffolder and Structure Matcher
=====================================================
Python 3.10+
Standard library only.
Features:
- Create manifest-declared HTML, CSS, JS, and JSON files.
- Fill empty or whitespace-only files from structurally related files.
- Match reference files using directory, filename, extension, and content.
- Allow an explicit reference file or reference directory.
- Adapt basic page titles and JSON dataset metadata.
- Integrate declared CSS, JS, and navigation references.
- Preserve non-empty files unless --overwrite is explicitly supplied.
- Back up files before replacing them.
- Validate JSON, Python syntax, and local frontend references.
- Generate JSON audit reports.
Examples:
    python python/tools/repository_scaffolder.py --root .
    python python/tools/repository_scaffolder.py --root . --manifest scaffold.json
    python python/tools/repository_scaffolder.py --root . --manifest scaffold.json --apply
    python python/tools/repository_scaffolder.py --root . --fill-empty --apply
    python python/tools/repository_scaffolder.py --root . --manifest scaffold.json --fill-empty --apply
    python python/tools/repository_scaffolder.py --root . --manifest scaffold.json --reference-dir pages --fill-empty --apply
    python python/tools/repository_scaffolder.py --root . --manifest scaffold.json --reference pages/about.html --fill-empty --apply
Safety:
- Dry-run is the default.
- Non-empty files are preserved unless --overwrite is specified.
- Empty files can be populated with --fill-empty.
- Overwritten files are backed up under .scaffold_backups/.
- Reference files are never modified merely because they were selected.
- Related-file matching is heuristic; review results before deployment.
"""
from __future__ import annotations
import argparse
import ast
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit
VERSION = "2.0.0"
SUPPORTED_TYPES = {"html", "css", "js", "json"}
EXTENSION_TYPES = {
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".js": "js",
    ".mjs": "js",
    ".json": "json",
}
IGNORED_DIRS = {
    ".git", ".hg", ".svn", ".venv", "venv",
    "node_modules", "__pycache__", ".pytest_cache",
    ".mypy_cache", ".ruff_cache", "dist", "build",
    ".scaffold_backups",
}
IGNORED_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
}
HTML_REF_RE = re.compile(
    r"""(?:href|src)\s*=\s*["']([^"'#]+)["']""",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(
    r"""url\(\s*["']?([^"'()]+?)["']?\s*\)""",
    re.IGNORECASE,
)
JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[^'"]*?\s+from\s+)?|"""
    r"""export\s+[^'"]*?\s+from\s+|import\s*\()"""
    r"""["']([^"']+)["']""",
    re.MULTILINE,
)
class ScaffoldError(Exception):
    """Invalid manifest or unsafe filesystem operation."""
@dataclass
class Issue:
    severity: str
    code: str
    path: str
    message: str
    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "code": self.code,
            "path": self.path,
            "message": self.message,
        }
@dataclass
class Report:
    root: str
    mode: str
    created: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    filled: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    references: dict[str, str] = field(default_factory=dict)
    backups: list[str] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    checked_files: int = 0
    def add_issue(
        self,
        severity: str,
        code: str,
        path: str,
        message: str,
    ) -> None:
        self.issues.append(
            Issue(severity, code, path, message)
        )
    def to_dict(self) -> dict[str, Any]:
        return {
            "tool": "MedOrbits Repository Scaffolder",
            "version": VERSION,
            "timestamp": dt.datetime.now(
                dt.timezone.utc
            ).isoformat(),
            "root": self.root,
            "mode": self.mode,
            "summary": {
                "checked_files": self.checked_files,
                "created": len(self.created),
                "modified": len(self.modified),
                "filled": len(self.filled),
                "skipped": len(self.skipped),
                "backups": len(self.backups),
                "errors": sum(
                    item.severity == "error"
                    for item in self.issues
                ),
                "warnings": sum(
                    item.severity == "warning"
                    for item in self.issues
                ),
            },
            "created": self.created,
            "modified": self.modified,
            "filled": self.filled,
            "skipped": self.skipped,
            "references": self.references,
            "backups": self.backups,
            "issues": [
                item.to_dict()
                for item in self.issues
            ],
        }
def normalize_relative_path(value: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ScaffoldError("A non-empty relative path is required.")
    value = value.replace("\\", "/")
    candidate = Path(value)
    if candidate.is_absolute():
        raise ScaffoldError(f"Absolute path rejected: {value}")
    if re.match(r"^[A-Za-z]:", value):
        raise ScaffoldError(f"Drive-qualified path rejected: {value}")
    if ".." in candidate.parts:
        raise ScaffoldError(f"Path traversal rejected: {value}")
    if any(part in {"", "."} for part in candidate.parts):
        raise ScaffoldError(f"Invalid path component: {value}")
    return candidate
def resolve_inside_root(
    root: Path,
    relative: str | Path,
) -> Path:
    rel = (
        normalize_relative_path(relative)
        if isinstance(relative, str)
        else relative
    )
    destination = root / rel
    try:
        destination.resolve(strict=False).relative_to(root.resolve())
    except ValueError as exc:
        raise ScaffoldError(
            f"Path escapes repository root: {rel}"
        ) from exc
    current = root
    for part in rel.parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise ScaffoldError(
                f"Symlinked parent rejected: {current}"
            )
    if destination.is_symlink():
        raise ScaffoldError(
            f"Symbolic-link destination rejected: {destination}"
        )
    return destination
def infer_type(path: Path) -> str | None:
    return EXTENSION_TYPES.get(path.suffix.lower())
def read_json_file(path: Path) -> Any:
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            return json.load(stream)
    except json.JSONDecodeError as exc:
        raise ScaffoldError(
            f"Invalid JSON at {path}, line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
    except OSError as exc:
        raise ScaffoldError(f"Cannot read {path}: {exc}") from exc
def load_manifest(path: Path) -> dict[str, Any]:
    data = read_json_file(path)
    if not isinstance(data, dict):
        raise ScaffoldError("Manifest root must be a JSON object.")
    entries = data.get("files", [])
    if not isinstance(entries, list):
        raise ScaffoldError("'files' must be an array.")
    seen: set[str] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ScaffoldError(
                f"files[{index}] must be an object."
            )
        if "path" not in entry:
            raise ScaffoldError(
                f"files[{index}] is missing 'path'."
            )
        rel = normalize_relative_path(entry["path"])
        declared = entry.get("type") or infer_type(rel)
        actual = infer_type(rel)
        if declared not in SUPPORTED_TYPES:
            raise ScaffoldError(
                f"Unsupported file type for {rel}: {declared!r}"
            )
        if actual and actual != declared:
            raise ScaffoldError(
                f"Extension/type mismatch for {rel}: "
                f"{actual} versus {declared}"
            )
        key = rel.as_posix().casefold()
        if key in seen:
            raise ScaffoldError(f"Duplicate manifest path: {rel}")
        seen.add(key)
        for field_name in ("css", "js", "navigation"):
            if field_name in entry and not isinstance(
                entry[field_name], list
            ):
                raise ScaffoldError(
                    f"{field_name} must be an array for {rel}"
                )
    return data
def discover_files(root: Path) -> list[Path]:
    result: list[Path] = []
    for current, dirs, filenames in os.walk(
        root,
        followlinks=False,
    ):
        current_path = Path(current)
        dirs[:] = [
            name for name in dirs
            if name not in IGNORED_DIRS
            and not (current_path / name).is_symlink()
        ]
        for filename in filenames:
            if filename in IGNORED_FILES:
                continue
            path = current_path / filename
            if path.is_symlink() or not path.is_file():
                continue
            result.append(path)
    return result
def is_empty_file(path: Path) -> bool:
    """Treat zero-byte and whitespace-only text files as empty."""
    try:
        if path.stat().st_size == 0:
            return True
        return not path.read_text(
            encoding="utf-8-sig"
        ).strip()
    except (OSError, UnicodeError):
        return False
def normalized_words(value: str) -> set[str]:
    return {
        word.casefold()
        for word in re.findall(r"[A-Za-z0-9]+", value)
        if len(word) > 1
    }
def similarity_score(
    root: Path,
    target: Path,
    candidate: Path,
) -> int:
    """
    Heuristic score for choosing a related reference file.
    Exact extension is required. Same-directory and similar-name
    candidates score higher. The target itself is never considered.
    """
    if target.resolve(strict=False) == candidate.resolve(strict=False):
        return -1
    if infer_type(target) != infer_type(candidate):
        return -1
    target_rel = target.relative_to(root)
    candidate_rel = candidate.relative_to(root)
    score = 0
    if target_rel.parent == candidate_rel.parent:
        score += 45
    target_stem = target_rel.stem.casefold()
    candidate_stem = candidate_rel.stem.casefold()
    if target_stem == candidate_stem:
        score += 60
    target_words = normalized_words(target_stem)
    candidate_words = normalized_words(candidate_stem)
    if target_words and candidate_words:
        overlap = len(target_words & candidate_words)
        union = len(target_words | candidate_words)
        score += int(35 * overlap / union) if union else 0
    if target_rel.parent.name.casefold() == candidate_rel.parent.name.casefold():
        score += 15
    if target_rel.parent in candidate_rel.parents:
        score += 10
    # Prefer shallower distance between directory structures.
    common = 0
    for left, right in zip(
        target_rel.parts[:-1],
        candidate_rel.parts[:-1],
    ):
        if left.casefold() != right.casefold():
            break
        common += 1
    score += min(common * 4, 20)
    return score
def choose_reference(
    root: Path,
    target: Path,
    files: list[Path],
    explicit_reference: Path | None = None,
    reference_dir: Path | None = None,
) -> Path | None:
    """Choose an explicit reference or the highest-scoring peer."""
    if explicit_reference is not None:
        reference = resolve_inside_root(root, explicit_reference)
        if not reference.is_file():
            raise ScaffoldError(
                f"Reference file does not exist: {reference}"
            )
        if infer_type(reference) != infer_type(target):
            raise ScaffoldError(
                f"Reference type does not match target: {reference}"
            )
        if is_empty_file(reference):
            raise ScaffoldError(
                f"Reference file is empty: {reference}"
            )
        return reference
    candidates: list[tuple[int, str, Path]] = []
    for candidate in files:
        if infer_type(candidate) != infer_type(target):
            continue
        if is_empty_file(candidate):
            continue
        if reference_dir is not None:
            try:
                candidate.relative_to(reference_dir)
            except ValueError:
                continue
        score = similarity_score(root, target, candidate)
        if score >= 15:
            candidates.append(
                (
                    score,
                    candidate.relative_to(root).as_posix(),
                    candidate,
                )
            )
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], item[1].casefold()))
    return candidates[0][2]
def default_html(entry: dict[str, Any]) -> str:
    title = html.escape(
        str(entry.get("title") or Path(entry["path"]).stem)
    )
    description = html.escape(
        str(entry.get("description") or "MedOrbits information page.")
    )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#172d49">
  <meta name="description" content="{description}">
  <meta name="robots" content="index,follow">
  <title>{title} | MedOrbits</title>
</head>
<body>
  <header class="site-header">
    <a href="/" aria-label="MedOrbits home">MedOrbits</a>
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
    </nav>
  </header>
  <main id="main-content">
    <h1>{title}</h1>
    <p>{description}</p>
  </main>
  <footer class="site-footer">
    <p>&copy; MedOrbits. Verify important information with official sources.</p>
  </footer>
</body>
</html>
"""
def default_css(entry: dict[str, Any]) -> str:
    return """/*
 * MedOrbits stylesheet.
 */
:root {
  --mo-navy: #172d49;
  --mo-blue: #315b85;
  --mo-surface: #edf2f7;
  --mo-text: #243247;
  --mo-radius: 14px;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  color: var(--mo-text);
  background: var(--mo-surface);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}
img,
video {
  max-width: 100%;
  height: auto;
}
a {
  color: var(--mo-blue);
}
.site-header,
.site-footer {
  padding: 1rem clamp(1rem, 4vw, 3rem);
}
#main-content {
  width: min(100% - 2rem, 1200px);
  margin-inline: auto;
  padding-block: 2rem;
}
"""
def default_js(entry: dict[str, Any]) -> str:
    return """/*
 * MedOrbits page JavaScript.
 */
"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("#main-content");
  if (!main) {
    return;
  }
  // Add page-specific behavior after defining its real requirements.
});
"""
def default_json(entry: dict[str, Any]) -> str:
    return json.dumps(
        {
            "metadata": {
                "schemaVersion": "1.0.0",
                "dataset": Path(entry["path"]).stem,
                "generatedOn": dt.date.today().isoformat(),
                "verificationPolicy": (
                    "Verify time-sensitive information with official sources."
                ),
            },
            "items": [],
        },
        indent=2,
        ensure_ascii=False,
    ) + "\n"
def adapt_reference_content(
    content: str,
    entry: dict[str, Any],
    file_type: str,
) -> str:
    """
    Reuse a related file's structure.
    HTML: replace the document title and description where present.
    JSON: preserve the original schema and update dataset metadata.
    CSS/JS: preserve source content as-is because arbitrary code
    transformations could break selectors, IDs, or business logic.
    """
    if file_type == "html":
        title = html.escape(
            str(entry.get("title") or Path(entry["path"]).stem)
        )
        description = html.escape(
            str(
                entry.get("description")
                or "MedOrbits information page."
            )
        )
        if re.search(r"<title\b[^>]*>.*?</title>", content, re.I | re.S):
            content = re.sub(
                r"<title\b[^>]*>.*?</title>",
                f"<title>{title} | MedOrbits</title>",
                content,
                count=1,
                flags=re.I | re.S,
            )
        if re.search(
            r"""<meta\b[^>]*\bname=["']description["'][^>]*>""",
            content,
            re.I,
        ):
            content = re.sub(
                r"""<meta\b(?=[^>]*\bname=["']description["'])[^>]*>""",
                lambda match: re.sub(
                    r"""content=["'][^"']*["']""",
                    f'content="{description}"',
                    match.group(0),
                    count=1,
                    flags=re.I,
                ),
                content,
                count=1,
                flags=re.I,
            )
    elif file_type == "json":
        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            return content
        if isinstance(payload, dict):
            metadata = payload.get("metadata")
            if isinstance(metadata, dict) and "dataset" in metadata:
                metadata["dataset"] = Path(entry["path"]).stem
            content = json.dumps(
                payload,
                indent=2,
                ensure_ascii=False,
            ) + "\n"
    return content
def generate_content(
    root: Path,
    entry: dict[str, Any],
    all_files: list[Path],
    explicit_reference: Path | None,
    reference_dir: Path | None,
    report: Report,
) -> str:
    template = entry.get("content")
    if template is not None:
        if not isinstance(template, str):
            raise ScaffoldError(
                f"'content' must be a string for {entry['path']}"
            )
        return template
    target = normalize_relative_path(entry["path"])
    file_type = entry.get("type") or infer_type(target)
    per_file_reference = entry.get("reference")
    chosen_explicit = (
        normalize_relative_path(per_file_reference)
        if per_file_reference
        else explicit_reference
    )
    reference = choose_reference(
        root=root,
        target=root / target,
        files=all_files,
        explicit_reference=chosen_explicit,
        reference_dir=reference_dir,
    )
    if reference is not None:
        report.references[target.as_posix()] = (
            reference.relative_to(root).as_posix()
        )
        try:
            source = reference.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise ScaffoldError(
                f"Cannot read reference {reference}: {exc}"
            ) from exc
        return adapt_reference_content(
            source,
            entry,
            file_type,
        )
    report.add_issue(
        "warning",
        "NO_RELATED_REFERENCE",
        target.as_posix(),
        "No sufficiently similar reference file found; using a starter template.",
    )
    generators = {
        "html": default_html,
        "css": default_css,
        "js": default_js,
        "json": default_json,
    }
    return generators[file_type](entry)
def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except Exception:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
        raise
def create_backup(root: Path, target: Path) -> Path:
    relative = target.relative_to(root)
    timestamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    backup = root / ".scaffold_backups" / timestamp / relative
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup)
    return backup
def safe_manifest_url(value: str) -> str:
    value = str(value).strip()
    if not value:
        raise ScaffoldError("Empty navigation URL.")
    parsed = urlsplit(value)
    if parsed.scheme.lower() in {
        "javascript", "data", "vbscript", "file",
    }:
        raise ScaffoldError(f"Unsafe navigation URL: {value}")
    return value
def relative_url(from_file: Path, target_file: str) -> str:
    target = normalize_relative_path(target_file).as_posix()
    if target.startswith("/"):
        return target
    return Path(
        os.path.relpath(
            target,
            start=from_file.parent.as_posix() or ".",
        )
    ).as_posix()
def insert_before_closing_tag(
    source: str,
    closing_tag: str,
    snippet: str,
) -> str:
    match = re.search(
        rf"</{closing_tag}\s*>",
        source,
        re.IGNORECASE,
    )
    if match:
        return (
            source[:match.start()]
            + "\n"
            + snippet
            + "\n"
            + source[match.start():]
        )
    return source.rstrip() + "\n" + snippet + "\n"
def integrate_html(
    entry: dict[str, Any],
    source: str,
) -> str:
    page_path = normalize_relative_path(entry["path"])
    original = source
    head_additions: list[str] = []
    body_additions: list[str] = []
    for css_path in entry.get("css", []):
        href = relative_url(page_path, css_path)
        if not re.search(
            r"""<link\b[^>]*\bhref\s*=\s*["']"""
            + re.escape(href)
            + r"""["']""",
            source,
            re.I,
        ):
            head_additions.append(
                f'<link rel="stylesheet" href="{html.escape(href, quote=True)}">'
            )
    for js_path in entry.get("js", []):
        src = relative_url(page_path, js_path)
        if not re.search(
            r"""<script\b[^>]*\bsrc\s*=\s*["']"""
            + re.escape(src)
            + r"""["']""",
            source,
            re.I,
        ):
            body_additions.append(
                f'<script src="{html.escape(src, quote=True)}" defer></script>'
            )
    if head_additions:
        source = insert_before_closing_tag(
            source,
            "head",
            "\n".join(head_additions),
        )
    navigation = entry.get("navigation", [])
    if navigation:
        links: list[str] = []
        for item in navigation:
            if not isinstance(item, dict):
                raise ScaffoldError(
                    "Each navigation entry must be an object."
                )
            label = html.escape(str(item.get("label") or "Page"))
            href = safe_manifest_url(item.get("href", ""))
            links.append(
                f'<a href="{html.escape(href, quote=True)}">{label}</a>'
            )
        missing = [link for link in links if link not in source]
        if missing:
            block = (
                '<nav aria-label="Related pages" '
                'data-generated-by="medorbits-scaffolder">\n'
                + "\n".join(missing)
                + "\n</nav>"
            )
            managed = re.compile(
                r"""<nav\b[^>]*data-generated-by=["']medorbits-scaffolder["'][^>]*>.*?</nav>""",
                re.I | re.S,
            )
            if managed.search(source):
                source = managed.sub(block, source, count=1)
            else:
                source = insert_before_closing_tag(
                    source,
                    "header",
                    block,
                )
    if body_additions:
        source = insert_before_closing_tag(
            source,
            "body",
            "\n".join(body_additions),
        )
    if source == original:
        return original
    return source
def local_reference_target(
    root: Path,
    source_file: Path,
    reference: str,
) -> Path | None:
    reference = html.unescape(reference.strip())
    if not reference:
        return None
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc:
        return None
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    candidate = (
        root / raw_path.lstrip("/")
        if raw_path.startswith("/")
        else source_file.parent / raw_path
    )
    try:
        resolved = candidate.resolve(strict=False)
        resolved.relative_to(root.resolve())
        return resolved
    except (ValueError, OSError):
        return None
def validate_repository(
    root: Path,
    report: Report,
) -> None:
    files = discover_files(root)
    report.checked_files = len(files)
    for path in files:
        relative = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        try:
            if suffix == ".json":
                read_json_file(path)
            elif suffix == ".py":
                ast.parse(
                    path.read_text(encoding="utf-8"),
                    filename=relative,
                )
        except (
            OSError,
            UnicodeError,
            SyntaxError,
            ScaffoldError,
        ) as exc:
            report.add_issue(
                "error",
                "FILE_VALIDATION_FAILED",
                relative,
                str(exc),
            )
            continue
        if suffix not in {
            ".html", ".htm", ".css", ".js", ".mjs",
        }:
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            report.add_issue(
                "error",
                "FILE_READ_FAILED",
                relative,
                str(exc),
            )
            continue
        if suffix in {".html", ".htm"}:
            references = HTML_REF_RE.findall(source)
        elif suffix == ".css":
            references = CSS_URL_RE.findall(source)
        else:
            references = JS_IMPORT_RE.findall(source)
        for reference in references:
            if suffix in {".js", ".mjs"} and not (
                reference.startswith(".")
                or reference.startswith("/")
            ):
                continue
            target = local_reference_target(
                root,
                path,
                reference,
            )
            if target is not None and not target.exists():
                report.add_issue(
                    "warning",
                    "MISSING_LOCAL_REFERENCE",
                    relative,
                    f"Referenced file does not exist: {reference}",
                )
def apply_manifest(
    root: Path,
    manifest: dict[str, Any],
    report: Report,
    apply_changes: bool,
    overwrite: bool,
    fill_empty: bool,
    explicit_reference: Path | None,
    reference_dir: Path | None,
    integrate: bool,
) -> None:
    entries = manifest.get("files", [])
    files = discover_files(root)
    for entry in entries:
        relative = normalize_relative_path(entry["path"])
        destination = resolve_inside_root(root, relative)
        exists = destination.exists()
        empty = (
            exists
            and destination.is_file()
            and is_empty_file(destination)
        )
        should_fill = empty and fill_empty
        if exists and not should_fill and not overwrite:
            report.skipped.append(relative.as_posix())
            continue
        if exists and not destination.is_file():
            report.add_issue(
                "error",
                "DESTINATION_NOT_FILE",
                relative.as_posix(),
                "Destination exists but is not a regular file.",
            )
            continue
        try:
            content = generate_content(
                root=root,
                entry=entry,
                all_files=files,
                explicit_reference=explicit_reference,
                reference_dir=reference_dir,
                report=report,
            )
        except (KeyError, TypeError, ScaffoldError) as exc:
            report.add_issue(
                "error",
                "GENERATION_FAILED",
                relative.as_posix(),
                str(exc),
            )
            continue
        if exists and should_fill:
            report.filled.append(relative.as_posix())
        elif exists:
            report.modified.append(relative.as_posix())
        else:
            report.created.append(relative.as_posix())
        if not apply_changes:
            continue
        try:
            if exists:
                backup = create_backup(root, destination)
                report.backups.append(
                    backup.relative_to(root).as_posix()
                )
            atomic_write(destination, content)
            if not exists:
                files.append(destination)
        except (OSError, ScaffoldError) as exc:
            report.add_issue(
                "error",
                "WRITE_FAILED",
                relative.as_posix(),
                str(exc),
            )
    if not integrate:
        return
    for entry in entries:
        file_type = entry.get("type") or infer_type(
            Path(entry["path"])
        )
        if file_type != "html":
            continue
        if not any(
            entry.get(key)
            for key in ("css", "js", "navigation")
        ):
            continue
        relative = normalize_relative_path(entry["path"])
        destination = resolve_inside_root(root, relative)
        if not destination.is_file():
            report.add_issue(
                "warning",
                "INTEGRATION_SKIPPED",
                relative.as_posix(),
                "HTML file is not available.",
            )
            continue
        try:
            source = destination.read_text(encoding="utf-8")
            updated = integrate_html(entry, source)
            if updated == source:
                continue
            if not apply_changes:
                report.modified.append(
                    f"{relative.as_posix()} (integration planned)"
                )
                continue
            # Ensure integration changes are backed up too.
            backup = create_backup(root, destination)
            report.backups.append(
                backup.relative_to(root).as_posix()
            )
            atomic_write(destination, updated)
            if relative.as_posix() not in report.modified:
                report.modified.append(relative.as_posix())
        except (OSError, ScaffoldError) as exc:
            report.add_issue(
                "error",
                "INTEGRATION_FAILED",
                relative.as_posix(),
                str(exc),
            )
def fill_existing_empty_files(
    root: Path,
    report: Report,
    apply_changes: bool,
    reference_dir: Path | None,
    explicit_reference: Path | None,
) -> None:
    """Fill empty supported files even when they are not in a manifest."""
    files = discover_files(root)
    for target in files:
        if infer_type(target) not in SUPPORTED_TYPES:
            continue
        if not is_empty_file(target):
            continue
        relative = target.relative_to(root)
        file_type = infer_type(target)
        try:
            reference = choose_reference(
                root=root,
                target=target,
                files=files,
                explicit_reference=explicit_reference,
                reference_dir=reference_dir,
            )
            if reference is not None:
                content = adapt_reference_content(
                    reference.read_text(encoding="utf-8-sig"),
                    {"path": relative.as_posix()},
                    file_type,
                )
                report.references[relative.as_posix()] = (
                    reference.relative_to(root).as_posix()
                )
            else:
                entry = {"path": relative.as_posix(), "type": file_type}
                generators = {
                    "html": default_html,
                    "css": default_css,
                    "js": default_js,
                    "json": default_json,
                }
                content = generators[file_type](entry)
                report.add_issue(
                    "warning",
                    "NO_RELATED_REFERENCE",
                    relative.as_posix(),
                    "No related file found; used a starter template.",
                )
            report.filled.append(relative.as_posix())
            if apply_changes:
                backup = create_backup(root, target)
                report.backups.append(
                    backup.relative_to(root).as_posix()
                )
                atomic_write(target, content)
        except (OSError, ScaffoldError, UnicodeError) as exc:
            report.add_issue(
                "error",
                "EMPTY_FILE_FILL_FAILED",
                relative.as_posix(),
                str(exc),
            )
def write_report(
    root: Path,
    report: Report,
    output_path: str | None,
    apply_changes: bool,
) -> None:
    if not output_path:
        return
    destination = resolve_inside_root(root, output_path)
    rendered = json.dumps(
        report.to_dict(),
        indent=2,
        ensure_ascii=False,
    ) + "\n"
    if apply_changes:
        atomic_write(destination, rendered)
    else:
        print(
            "Dry-run mode: report was not written to disk.",
            file=sys.stderr,
        )
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create missing MedOrbits files, fill empty files "
            "from related files, and audit local references."
        )
    )
    parser.add_argument("--root", default=".")
    parser.add_argument("--manifest")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--fill-empty", action="store_true")
    parser.add_argument("--no-integrate", action="store_true")
    parser.add_argument("--reference")
    parser.add_argument("--reference-dir")
    parser.add_argument("--report")
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    try:
        root = Path(args.root).expanduser().resolve()
        if not root.is_dir():
            raise ScaffoldError(
                f"Repository root is not a directory: {root}"
            )
        explicit_reference = (
            normalize_relative_path(args.reference)
            if args.reference
            else None
        )
        reference_dir = (
            resolve_inside_root(root, args.reference_dir)
            if args.reference_dir
            else None
        )
        if reference_dir is not None and not reference_dir.is_dir():
            raise ScaffoldError(
                f"Reference directory does not exist: {reference_dir}"
            )
        report = Report(
            root=str(root),
            mode="apply" if args.apply else "dry-run",
        )
        if args.manifest:
            manifest_path = resolve_inside_root(
                root,
                args.manifest,
            )
            manifest = load_manifest(manifest_path)
            apply_manifest(
                root=root,
                manifest=manifest,
                report=report,
                apply_changes=args.apply,
                overwrite=args.overwrite,
                fill_empty=args.fill_empty,
                explicit_reference=explicit_reference,
                reference_dir=reference_dir,
                integrate=not args.no_integrate,
            )
        elif not args.fill_empty:
            report.add_issue(
                "warning",
                "NO_ACTION_SPECIFIED",
                "",
                "Supply --manifest, --fill-empty, or both.",
            )
        if args.fill_empty:
            fill_existing_empty_files(
                root=root,
                report=report,
                apply_changes=args.apply,
                reference_dir=reference_dir,
                explicit_reference=explicit_reference,
            )
        validate_repository(root, report)
        print(
            json.dumps(
                report.to_dict(),
                indent=2,
                ensure_ascii=False,
            )
        )
        if args.report:
            write_report(
                root,
                report,
                args.report,
                args.apply,
            )
        return (
            1
            if any(
                issue.severity == "error"
                for issue in report.issues
            )
            else 0
        )
    except (ScaffoldError, OSError, ValueError) as exc:
        print(
            f"[MedOrbits Scaffolder] ERROR: {exc}",
            file=sys.stderr,
        )
        return 2
if __name__ == "__main__":
    raise SystemExit(main())