
#!/usr/bin/env python3
“””
===============================================================================
MEDORBITS — REPOSITORY LINK VALIDATOR
File: .github/scripts/check-links.py
Version: 2.1.3

Purpose:
    Detect broken local links and invalid references in repository files.

Features:
    - Markdown link validation
    - Markdown image reference validation
    - HTML href and src validation
    - Relative path resolution
    - Anchor validation for Markdown headings
    - Missing local asset detection
    - External URL syntax validation
    - Git-tracked file scanning
    - Optional untracked file scanning
    - CI-friendly reporting

Usage:
    python .github/scripts/check-links.py
    python .github/scripts/check-links.py —all-files
    python .github/scripts/check-links.py —strict
    python .github/scripts/check-links.py —help

Exit codes:
    0 = No broken links detected
    1 = Broken links detected
    2 = Execution or configuration error
===============================================================================
“””

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

from pathlib import Path
from urllib.parse import unquote, urlsplit


# =============================================================================
# CONFIGURATION
# =============================================================================

VERSION = “2.1.3”

ROOT = Path(__file__).resolve().parents[2]

MAX_FILE_SIZE = 2 * 1024 * 1024

SUPPORTED_EXTENSIONS = {
    “.md”,
    “.mdx”,
    “.html”,
    “.htm”,
}

EXCLUDED_DIRECTORIES = {
    “.git”,
    “node_modules”,
    “.venv”,
    “venv”,
    “__pycache__”,
    “dist”,
    “build”,
    “coverage”,
    “.next”,
    “.nuxt”,
}

IGNORED_SCHEMES = {
    “mailto”,
    “tel”,
    “sms”,
    “javascript”,
    “data”,
    “blob”,
}

# =============================================================================
# REGULAR EXPRESSIONS
# =============================================================================

MARKDOWN_LINK_PATTERN = re.compile(
    r”!?\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))(?:\s+[‘\”][^’\”]*[‘\”])?\)”
)

MARKDOWN_REFERENCE_PATTERN = re.compile(
    r”(?m)^\s*\[[^\]]+\]:\s*(\S+)”
)

HTML_ATTRIBUTE_PATTERN = re.compile(
    r”””(?is)\b(?:href|src)\s*=\s*(?:”([^”]*)”|’([^’]*)’|([^\s>]+))”””
)

HEADING_PATTERN = re.compile(
    r”^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$”,
    re.MULTILINE,
)

HTML_ID_PATTERN = re.compile(
    r”””(?i)\bid\s*=\s*[“’]([^”’]+)[“’]”””
)

HTML_NAME_PATTERN = re.compile(
    r”””(?i)\bname\s*=\s*[“’]([^”’]+)[“’]”””
)

HTML_COMMENT_PATTERN = re.compile(
    r”<!—.*?—>”,
    re.DOTALL,
)

FENCED_CODE_PATTERN = re.compile(
    r”(?ms)^\s*(```+|~~~+).*?^\s*\1\s*$”
)


# =============================================================================
# DATA MODEL
# =============================================================================

class LinkFinding:
    “””Represent a broken repository link.”””

    def __init__(
        self,
        file: str,
        line: int,
        target: str,
        reason: str,
    ) -> None:

        self.file = file
        self.line = line
        self.target = target
        self.reason = reason


# =============================================================================
# FILE DISCOVERY
# =============================================================================

def is_excluded(path: Path) -> bool:
    “””Check whether a path belongs to an excluded directory.”””

    return any(
        part in EXCLUDED_DIRECTORIES
        for part in path.parts
    )


def get_tracked_files() -> list[Path]:
    “””Return Git-tracked Markdown and HTML files.”””

    try:

        result = subprocess.run(
            [
                “git”,
                “-C”,
                str(ROOT),
                “ls-files”,
                “-z”,
            ],
            check=True,
            capture_output=True,
            text=False,
        )

    except FileNotFoundError as exc:
        raise RuntimeError(“Git executable not found.”) from exc

    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            “Unable to retrieve Git-tracked files.”
        ) from exc

    files = []

    for item in result.stdout.split(b”\0”):

        if not item:
            continue

        relative = Path(os.fsdecode(item))

        if relative.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        if is_excluded(relative):
            continue

        absolute = ROOT / relative

        if absolute.is_file():
            files.append(absolute)

    return files


def get_all_files() -> list[Path]:
    “””Return eligible Markdown and HTML files from the working tree.”””

    files = []

    for path in ROOT.rglob(“*”):

        if not path.is_file():
            continue

        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            continue

        if is_excluded(relative):
            continue

        files.append(path)

    return files


# =============================================================================
# DOCUMENT PARSING
# =============================================================================

def clean_document(content: str) -> str:
    “””Remove comments and fenced code blocks before link extraction.”””

    content = HTML_COMMENT_PATTERN.sub(“”, content)

    content = FENCED_CODE_PATTERN.sub(“”, content)

    return content


def extract_links(content: str) -> list[tuple[int, str]]:
    “””Extract links and their source line numbers.”””

    links = []

    for pattern in (
        MARKDOWN_LINK_PATTERN,
        MARKDOWN_REFERENCE_PATTERN,
        HTML_ATTRIBUTE_PATTERN,
    ):

        for match in pattern.finditer(content):

            groups = [
                group
                for group in match.groups()
                if group is not None
            ]

            if not groups:
                continue

            target = groups[0].strip()

            if not target:
                continue

            line_number = (
                content.count(“\n”, 0, match.start()) + 1
            )

            links.append((line_number, target))

    return links


# =============================================================================
# ANCHOR VALIDATION
# =============================================================================

def slugify_heading(heading: str) -> str:
    “””Convert a Markdown heading into a GitHub-style anchor.”””

    heading = re.sub(r”`([^`]*)`”, r”\1”, heading)

    heading = re.sub(
        r”\[([^\]]+)\]\([^)]+\)”,
        r”\1”,
        heading,
    )

    heading = heading.strip().lower()

    heading = re.sub(r”[^\w\- ]”, “”, heading)

    heading = re.sub(r”\s+”, “-“, heading)

    return heading


def extract_anchors(content: str) -> set[str]:
    “””Extract heading and explicit HTML anchors.”””

    anchors = set()

    for match in HEADING_PATTERN.finditer(content):
        anchors.add(slugify_heading(match.group(1)))

    for pattern in (
        HTML_ID_PATTERN,
        HTML_NAME_PATTERN,
    ):

        for match in pattern.finditer(content):
            anchors.add(match.group(1))

    return anchors


# =============================================================================
# LINK RESOLUTION
# =============================================================================

def resolve_local_target(
    source_file: Path,
    target: str,
) -> tuple[Path | None, str]:

    “””Resolve a local link into a repository path and anchor.”””

    parsed = urlsplit(target)

    path_part = unquote(parsed.path)
    anchor = unquote(parsed.fragment)

    if not path_part:
        return source_file, anchor

    if path_part.startswith(“/“):
        resolved = ROOT / path_part.lstrip(“/“)
    else:
        resolved = source_file.parent / path_part

    try:
        resolved = resolved.resolve()
        resolved.relative_to(ROOT.resolve())
    except (ValueError, OSError):
        return None, anchor

    return resolved, anchor


def validate_target(
    source_file: Path,
    target: str,
    document_cache: dict[Path, str],
) -> str | None:
    “””Return an error reason when a link is broken.”””

    if not target:
        return “Empty link target.”

    parsed = urlsplit(target)

    scheme = parsed.scheme.lower()

    if scheme in IGNORED_SCHEMES:
        return None

    if scheme in {“http”, “https”}:

        if not parsed.netloc:
            return “External URL has no hostname.”

        return None

    if scheme and scheme != “file”:
        return None

    if scheme == “file”:
        return “File URI references are not supported.”

    resolved, anchor = resolve_local_target(
        source_file,
        target,
    )

    if resolved is None:
        return “Target resolves outside the repository.”

    if not resolved.exists():
        return “Local target does not exist.”

    if not resolved.is_file() and not resolved.is_dir():
        return “Target is not a file or directory.”

    if anchor:

        if not resolved.is_file():
            return “Anchor target is not a file.”

        if resolved not in document_cache:

            try:
                document_cache[resolved] = resolved.read_text(
                    encoding=“utf-8”,
                    errors=“replace”,
                )
            except OSError:
                return “Unable to read anchor target.”

        anchors = extract_anchors(
            document_cache[resolved]
        )

        if anchor not in anchors:
            return f”Anchor not found: #{anchor}”

    return None


# =============================================================================
# DOCUMENT SCANNING
# =============================================================================

def scan_file(
    path: Path,
    document_cache: dict[Path, str],
) -> list[LinkFinding]:

    findings = []

    try:

        if path.stat().st_size > MAX_FILE_SIZE:
            return findings

        content = path.read_text(
            encoding=“utf-8”,
            errors=“replace”,
        )

    except OSError as exc:

        print(
            f”[WARNING] Unable to read {path}: {exc}”,
            file=sys.stderr,
        )

        return findings

    document_cache[path] = content

    cleaned = clean_document(content)

    for line_number, target in extract_links(cleaned):

        reason = validate_target(
            path,
            target,
            document_cache,
        )

        if reason:

            findings.append(
                LinkFinding(
                    file=str(path.relative_to(ROOT)),
                    line=line_number,
                    target=target,
                    reason=reason,
                )
            )

    return findings


# =============================================================================
# REPOSITORY SCAN
# =============================================================================

def scan_repository(
    all_files: bool = False,
) -> list[LinkFinding]:

    files = (
        get_all_files()
        if all_files
        else get_tracked_files()
    )

    print(f”[INFO] Scanning {len(files)} document(s).”)

    document_cache: dict[Path, str] = {}

    findings = []

    for path in files:

        findings.extend(
            scan_file(
                path,
                document_cache,
            )
        )

    return findings


# =============================================================================
# REPORTING
# =============================================================================

def print_report(
    findings: list[LinkFinding],
) -> None:

    print()
    print(“=“ * 72)
    print(“MEDORBITS REPOSITORY LINK VALIDATION”)
    print(“=“ * 72)

    if not findings:

        print(“[PASS] No broken local links detected.”)

    else:

        for finding in findings:

            print(
                f”[BROKEN] {finding.file}:{finding.line}”
            )

            print(f”  Target: {finding.target}”)
            print(f”  Reason: {finding.reason}”)

        print()
        print(
            f”[FAIL] {len(findings)} broken link(s) detected.”
        )

    print(“=“ * 72)


# =============================================================================
# ARGUMENT PARSING
# =============================================================================

def parse_args() -> argparse.Namespace:

    parser = argparse.ArgumentParser(
        description=“MedOrbits repository link validator.”
    )

    parser.add_argument(
        “—all-files”,
        action=“store_true”,
        help=“Scan tracked and untracked eligible files.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Reserved for future strict validation policies.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Link Validator {VERSION}”,
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main() -> int:

    args = parse_args()

    print(f”[INFO] MedOrbits Link Validator {VERSION}”)
    print(f”[INFO] Repository: {ROOT}”)

    try:

        findings = scan_repository(
            all_files=args.all_files
        )

        print_report(findings)

        return 1 if findings else 0

    except RuntimeError as exc:

        print(
            f”[ERROR] {exc}”,
            file=sys.stderr,
        )

        return 2

    except KeyboardInterrupt:

        print(
            “\n[ERROR] Scan interrupted.”,
            file=sys.stderr,
        )

        return 2


if __name__ == “__main__”:
    raise SystemExit(main())

# =============================================================================
# END OF MEDORBITS LINK VALIDATOR
# =============================================================================
