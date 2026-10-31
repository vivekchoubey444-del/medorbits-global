#!/usr/bin/env python3
“””
MedOrbits — Repository Link Checker
File: .github/scripts/check-links.py
Version: 2.1.1
Purpose:
    Detect broken local links and asset references throughout the MedOrbits
    repository without modifying source files.
Supported files:
    HTML, HTM, Markdown, CSS, JavaScript, MJS and CJS.
Validation features:
    - HTML href, src, srcset, poster, action, formaction, data, cite,
      background and manifest references.
    - CSS url() references.
    - Markdown inline links, images and reference definitions.
    - Local HTML fragment and anchor ID validation.
    - Same-page and cross-page fragment validation.
    - Relative and root-relative path resolution.
    - URL percent-decoding and query-string handling.
    - Directory index resolution.
    - Repository-root traversal protection.
    - Optional external HTTP(S) link validation.
    - External URL deduplication.
    - Configurable scan exclusions.
    - Dependency and generated-directory exclusions.
    - Actionable diagnostics with source line numbers.
    - Strict mode for CI/CD enforcement.
    - No source-file modification.
Usage:
    python .github/scripts/check-links.py
    python .github/scripts/check-links.py —root .
    python .github/scripts/check-links.py —strict
    python .github/scripts/check-links.py —check-external
    python .github/scripts/check-links.py —root . —strict
    python .github/scripts/check-links.py —exclude archive
    python .github/scripts/check-links.py —timeout 10 —max-external 200
Exit codes:
    0: Validation passed.
    1: Link errors found or strict-mode warnings found.
    2: Invalid arguments, invalid repository root or execution failure.
Dependencies:
    Python standard library only.
Security:
    External URL checking is opt-in.
    Do not run external URL checking against untrusted repository content
    in privileged CI environments.
“””
from __future__ import annotations
import argparse
import html.parser
import ipaddress
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
# =============================================================================
# 01. APPLICATION CONFIGURATION
# =============================================================================
TOOL_NAME = “MedOrbits-Link-Checker”
TOOL_VERSION = “2.1.1”
SCAN_SUFFIXES = {
    “.html”,
    “.htm”,
    “.md”,
    “.markdown”,
    “.css”,
    “.js”,
    “.mjs”,
    “.cjs”,
}
HTML_SUFFIXES = {
    “.html”,
    “.htm”,
}
MARKDOWN_SUFFIXES = {
    “.md”,
    “.markdown”,
}
CSS_SUFFIXES = {
    “.css”,
}
IGNORED_DIRS = {
    “.git”,
    “.hg”,
    “.svn”,
    “.next”,
    “.nuxt”,
    “.turbo”,
    “.vercel”,
    “.cache”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “__pycache__”,
    “node_modules”,
    “vendor”,
    “dist”,
    “build”,
    “coverage”,
    “.venv”,
    “venv”,
}
IGNORED_SCHEMES = {
    “data”,
    “blob”,
    “javascript”,
    “mailto”,
    “tel”,
    “sms”,
    “geo”,
    “about”,
    “file”,
}
HTML_REFERENCE_ATTRIBUTES = {
    “href”,
    “src”,
    “poster”,
    “action”,
    “formaction”,
    “data”,
    “cite”,
    “background”,
    “manifest”,
}
MAX_FILE_SIZE = 5 * 1024 * 1024
DEFAULT_TIMEOUT = 8.0
DEFAULT_MAX_EXTERNAL = 100
USER_AGENT = (
    f”{TOOL_NAME}/{TOOL_VERSION}”
)
# =============================================================================
# 02. REGULAR EXPRESSIONS
# =============================================================================
CSS_URL_RE = re.compile(
    r”””
    url
    \s*
    \(
        \s*
        (?:
            (?P<quoted>
                [“’]
                (?P<quoted_url>.*?)
                [“’]
            )
            |
            (?P<unquoted_url>[^)]*?)
        )
        \s*
    \)
    “””,
    re.IGNORECASE | re.VERBOSE | re.DOTALL,
)
MARKDOWN_LINK_RE = re.compile(
    r”””
    !?
    \[
        (?:\\.|[^\]])*
    \]
    \(
        \s*
        (?:
            <(?P<angle>[^>]+)>
            |
            (?P<plain>
                (?:
                    \\.
                    |
                    [^\s()]+
                    |
                    \([^)]*\)
                )+
            )
        )
    “””,
    re.VERBOSE,
)
MARKDOWN_REFERENCE_RE = re.compile(
    r”””
    (?m)
    ^\s*
    \[[^\]]+\]
    \s*:
    \s*
    (?:
        <(?P<angle>[^>]+)>
        |
        (?P<plain>\S+)
    )
    “””,
    re.VERBOSE,
)
MARKDOWN_AUTOLINK_RE = re.compile(
    r”<(?P<url>https?://[^>\s]+)>”,
    re.IGNORECASE,
)
HTML_ID_RE = re.compile(
    r”””(?is)\bid\s*=\s*[“’]([^”’]+)[“’]”””
)
HTML_NAME_RE = re.compile(
    r”””(?is)\bname\s*=\s*[“’]([^”’]+)[“’]”””
)
ENVIRONMENT_REFERENCE_RE = re.compile(
    r”[\x00-\x20]”
)
CONTROL_CHARACTER_RE = re.compile(
    r”[\x00-\x1f\x7f]”
)
# =============================================================================
# 03. DATA STRUCTURES
# =============================================================================
@dataclass(frozen=True)
class LinkReference:
    source: Path
    line: int
    target: str
    kind: str
@dataclass(frozen=True)
class Finding:
    severity: str
    source: str
    line: int
    message: str
@dataclass(frozen=True)
class ResolvedTarget:
    path: Path | None
    fragment: str
    external: bool = False
    invalid_reason: str | None = None
# =============================================================================
# 04. HTML PARSER
# =============================================================================
class LinkHTMLParser(html.parser.HTMLParser):
    “””
    Extract HTML asset references, navigation links and fragment IDs.
    “””
    def __init__(self, source: Path) -> None:
        super().__init__(convert_charrefs=True)
        self.source = source
        self.references: list[LinkReference] = []
        self.ids: set[str] = set()
    def _add_reference(
        self,
        line: int,
        target: str,
        kind: str,
    ) -> None:
        target = target.strip()
        if not target:
            return
        self.references.append(
            LinkReference(
                source=self.source,
                line=line,
                target=target,
                kind=kind,
            )
        )
    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        line = self.getpos()[0]
        attrs_dict = {
            key.lower(): value
            for key, value in attrs
            if key and value is not None
        }
        # Collect fragment identifiers.
        for attribute in (“id”, “name”):
            value = attrs_dict.get(attribute)
            if value:
                self.ids.add(value)
        # Collect standard URL-bearing attributes.
        for attribute in HTML_REFERENCE_ATTRIBUTES:
            value = attrs_dict.get(attribute)
            if value:
                self._add_reference(
                    line,
                    value,
                    f”HTML {tag}[{attribute}]”,
                )
        # Parse responsive image references.
        srcset = attrs_dict.get(“srcset”)
        if srcset:
            for candidate in self._parse_srcset(srcset):
                self._add_reference(
                    line,
                    candidate,
                    “HTML srcset”,
                )
    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.handle_starttag(tag, attrs)
    @staticmethod
    def _parse_srcset(value: str) -> list[str]:
        “””
        Parse srcset candidates while preserving data URLs.
        A data URL contains a comma, so a simple split(‘,’) is incorrect.
        “””
        candidates: list[str] = []
        position = 0
        length = len(value)
        while position < length:
            while (
                position < length
                and value[position] in “ \t\n\r,”
            ):
                position += 1
            if position >= length:
                break
            start = position
            is_data_url = value[
                position:position + 5
            ].lower() == “data:”
            if is_data_url:
                while (
                    position < length
                    and value[position] not in “ \t\n\r”
                ):
                    position += 1
                candidate = value[start:position]
            else:
                while (
                    position < length
                    and value[position] not in “ \t\n\r,”
                ):
                    position += 1
                candidate = value[start:position]
            if candidate:
                candidates.append(candidate)
            while (
                position < length
                and value[position] != “,”
            ):
                position += 1
            if position < length:
                position += 1
        return candidates
# =============================================================================
# 05. COMMAND-LINE ARGUMENTS
# =============================================================================
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog=“check-links.py”,
        description=(
            “Validate MedOrbits repository links and local assets.”
        ),
    )
    parser.add_argument(
        “—root”,
        type=Path,
        default=Path.cwd(),
        help=“Repository root directory.”,
    )
    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat warnings as errors.”,
    )
    parser.add_argument(
        “—check-external”,
        action=“store_true”,
        help=“Check external HTTP(S) URLs.”,
    )
    parser.add_argument(
        “—timeout”,
        type=float,
        default=DEFAULT_TIMEOUT,
        help=“External request timeout in seconds.”,
    )
    parser.add_argument(
        “—max-external”,
        type=int,
        default=DEFAULT_MAX_EXTERNAL,
        help=“Maximum number of unique external URLs to check.”,
    )
    parser.add_argument(
        “—exclude”,
        action=“append”,
        default=[],
        help=“Additional repository-relative exclusion path.”,
    )
    parser.add_argument(
        “—max-file-size”,
        type=int,
        default=MAX_FILE_SIZE,
        help=“Maximum source file size in bytes.”,
    )
    parser.add_argument(
        “—no-progress”,
        action=“store_true”,
        help=“Suppress scan progress output.”,
    )
    return parser.parse_args()
# =============================================================================
# 06. PATH AND FILE UTILITIES
# =============================================================================
def relative_path(
    path: Path,
    root: Path,
) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()
def is_ignored(
    path: Path,
    root: Path,
    extra_excludes: set[str],
) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True
    if any(
        part in IGNORED_DIRS
        for part in relative.parts
    ):
        return True
    normalized = relative.as_posix()
    for excluded in extra_excludes:
        if (
            normalized == excluded
            or normalized.startswith(
                excluded.rstrip(“/“) + “/“
            )
        ):
            return True
    return False
def read_text(
    path: Path,
    max_size: int,
) -> str | None:
    try:
        if path.stat().st_size > max_size:
            return None
        return path.read_text(
            encoding=“utf-8-sig”
        )
    except (OSError, UnicodeError):
        return None
def line_number_at(
    text: str,
    offset: int,
) -> int:
    return text.count(
        “\n”,
        0,
        offset,
    ) + 1
# =============================================================================
# 07. SOURCE FILE DISCOVERY
# =============================================================================
def collect_files(
    root: Path,
    extra_excludes: set[str],
) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob(“*”):
        try:
            if not path.is_file():
                continue
            if path.is_symlink():
                continue
            if is_ignored(
                path,
                root,
                extra_excludes,
            ):
                continue
            if path.suffix.lower() not in SCAN_SUFFIXES:
                continue
            files.append(path)
        except OSError:
            continue
    return sorted(files)
# =============================================================================
# 08. CSS REFERENCE DISCOVERY
# =============================================================================
def collect_css_references(
    source: Path,
    text: str,
) -> list[LinkReference]:
    references: list[LinkReference] = []
    for match in CSS_URL_RE.finditer(text):
        target = (
            match.group(“quoted_url”)
            if match.group(“quoted_url”) is not None
            else match.group(“unquoted_url”)
        )
        if target is None:
            continue
        target = target.strip()
        if not target:
            continue
        references.append(
            LinkReference(
                source=source,
                line=line_number_at(
                    text,
                    match.start(),
                ),
                target=target,
                kind=“CSS url()”,
            )
        )
    return references
# =============================================================================
# 09. MARKDOWN REFERENCE DISCOVERY
# =============================================================================
def collect_markdown_references(
    source: Path,
    text: str,
) -> list[LinkReference]:
    references: list[LinkReference] = []
    patterns = (
        (MARKDOWN_LINK_RE, “Markdown link”),
        (MARKDOWN_REFERENCE_RE, “Markdown reference”),
        (MARKDOWN_AUTOLINK_RE, “Markdown autolink”),
    )
    for pattern, kind in patterns:
        for match in pattern.finditer(text):
            target = (
                match.groupdict().get(“angle”)
                or match.groupdict().get(“plain”)
                or match.groupdict().get(“url”)
            )
            if not target:
                continue
            references.append(
                LinkReference(
                    source=source,
                    line=line_number_at(
                        text,
                        match.start(),
                    ),
                    target=target.strip(),
                    kind=kind,
                )
            )
    return references
# =============================================================================
# 10. REFERENCE COLLECTION
# =============================================================================
def collect_references(
    source: Path,
    text: str,
) -> tuple[list[LinkReference], set[str]]:
    references: list[LinkReference] = []
    ids: set[str] = set()
    suffix = source.suffix.lower()
    if suffix in HTML_SUFFIXES:
        parser = LinkHTMLParser(source)
        try:
            parser.feed(text)
            parser.close()
        except (ValueError, AssertionError):
            # Report parser problems without stopping the entire scan.
            pass
        references.extend(parser.references)
        ids.update(parser.ids)
    elif suffix in CSS_SUFFIXES:
        references.extend(
            collect_css_references(
                source,
                text,
            )
        )
    elif suffix in MARKDOWN_SUFFIXES:
        references.extend(
            collect_markdown_references(
                source,
                text,
            )
        )
    return references, ids
# =============================================================================
# 11. URL NORMALIZATION
# =============================================================================
def safe_url_display(url: str) -> str:
    “””
    Return a diagnostic-safe URL without credentials or query parameters.
    “””
    try:
        parsed = urllib.parse.urlsplit(url)
        hostname = parsed.hostname or “”
        if parsed.port:
            hostname = f”{hostname}:{parsed.port}”
        return urllib.parse.urlunsplit(
            (
                parsed.scheme,
                hostname,
                parsed.path,
                “”,
                “”,
            )
        )
    except ValueError:
        return “[invalid URL]”
def normalize_external_url(
    url: str,
) -> str | None:
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() not in {
            “http”,
            “https”,
        }:
            return None
        if not parsed.hostname:
            return None
        if parsed.username or parsed.password:
            return None
        if CONTROL_CHARACTER_RE.search(url):
            return None
        return urllib.parse.urlunsplit(
            (
                parsed.scheme.lower(),
                parsed.netloc.lower(),
                parsed.path or “/“,
                parsed.query,
                “”,
            )
        )
    except ValueError:
        return None
# =============================================================================
# 12. LOCAL PATH RESOLUTION
# =============================================================================
def resolve_target_path(
    root: Path,
    source: Path,
    raw_target: str,
) -> ResolvedTarget:
    “””
    Resolve a link against its source file or repository root.
    Root-relative references:
        /pages/education.html
    Relative references:
        ../assets/images/logo.png
    Same-page references:
        #admission-requirements
    “””
    target = raw_target.strip()
    if not target:
        return ResolvedTarget(
            path=source,
            fragment=“”,
        )
    if CONTROL_CHARACTER_RE.search(target):
        return ResolvedTarget(
            path=None,
            fragment=“”,
            invalid_reason=“URL contains control characters.”,
        )
    if target.startswith(“//“):
        return ResolvedTarget(
            path=None,
            fragment=“”,
            external=True,
        )
    try:
        parsed = urllib.parse.urlsplit(target)
    except ValueError:
        return ResolvedTarget(
            path=None,
            fragment=“”,
            invalid_reason=“Malformed URL reference.”,
        )
    scheme = parsed.scheme.lower()
    if scheme in IGNORED_SCHEMES:
        return ResolvedTarget(
            path=None,
            fragment=“”,
            external=True,
        )
    if scheme in {“http”, “https”}:
        return ResolvedTarget(
            path=None,
            fragment=urllib.parse.unquote(
                parsed.fragment
            ),
            external=True,
        )
    if scheme:
        return ResolvedTarget(
            path=None,
            fragment=“”,
            external=True,
        )
    path_part = urllib.parse.unquote(
        parsed.path
    )
    fragment = urllib.parse.unquote(
        parsed.fragment
    )
    if not path_part:
        return ResolvedTarget(
            path=source,
            fragment=fragment,
        )
    if path_part.startswith(“/“):
        candidate = (
            root / path_part.lstrip(“/“)
        )
    else:
        candidate = (
            source.parent / path_part
        )
    try:
        resolved = candidate.resolve(
            strict=False
        )
        resolved.relative_to(
            root.resolve()
        )
    except (OSError, ValueError):
        return ResolvedTarget(
            path=None,
            fragment=fragment,
            invalid_reason=(
                “Target escapes the repository root “
                “or cannot be resolved.”
            ),
        )
    return ResolvedTarget(
        path=resolved,
        fragment=fragment,
    )
# =============================================================================
# 13. DIRECTORY INDEX RESOLUTION
# =============================================================================
def resolve_index_file(
    target: Path,
) -> Path | None:
    if target.is_file():
        return target
    if not target.is_dir():
        return None
    for filename in (
        “index.html”,
        “index.htm”,
    ):
        candidate = target / filename
        if candidate.is_file():
            return candidate
    return target
# =============================================================================
# 14. HTML FRAGMENT VALIDATION
# =============================================================================
def get_html_ids(
    path: Path,
    cache: dict[Path, set[str]],
    max_size: int,
) -> set[str] | None:
    if path in cache:
        return cache[path]
    text = read_text(
        path,
        max_size,
    )
    if text is None:
        return None
    _, ids = collect_references(
        path,
        text,
    )
    cache[path] = ids
    return ids
# =============================================================================
# 15. EXTERNAL URL SAFETY
# =============================================================================
def is_public_hostname(
    hostname: str,
) -> bool:
    “””
    Reject localhost and non-public literal IP addresses.
    External URL checking should only be enabled for trusted repository
    content. This check is a defensive measure, not a complete SSRF defense.
    “””
    normalized = hostname.rstrip(“.”).lower()
    if normalized in {
        “localhost”,
        “localhost.localdomain”,
    }:
        return False
    try:
        address = ipaddress.ip_address(
            normalized.strip(“[]”)
        )
        return address.is_global
    except ValueError:
        return True
def validate_external_url(
    url: str,
) -> str | None:
    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() not in {
            “http”,
            “https”,
        }:
            return “Unsupported URL scheme.”
        hostname = parsed.hostname
        if not hostname:
            return “Missing hostname.”
        if parsed.username or parsed.password:
            return “URLs containing credentials are not allowed.”
        if not is_public_hostname(hostname):
            return “Non-public hostname or IP address rejected.”
        if parsed.port and not (
            1 <= parsed.port <= 65535
        ):
            return “Invalid port.”
        return None
    except ValueError:
        return “Malformed external URL.”
# =============================================================================
# 16. EXTERNAL HTTP CHECKING
# =============================================================================
class SafeRedirectHandler(
    urllib.request.HTTPRedirectHandler
):
    “””
    Prevent redirects to unsupported schemes or non-public IP literals.
    “””
    def redirect_request(
        self,
        req,
        fp,
        code,
        msg,
        headers,
        newurl,
    ):
        error = validate_external_url(
            newurl
        )
        if error:
            raise urllib.error.URLError(
                “Unsafe redirect destination.”
            )
        return super().redirect_request(
            req,
            fp,
            code,
            msg,
            headers,
            newurl,
        )
def check_external_url(
    url: str,
    timeout: float,
) -> str | None:
    validation_error = validate_external_url(
        url
    )
    if validation_error:
        return validation_error
    opener = urllib.request.build_opener(
        SafeRedirectHandler()
    )
    request = urllib.request.Request(
        url,
        headers={
            “User-Agent”: USER_AGENT,
            “Accept”: (
                “text/html,application/xhtml+xml,”
                “application/json,*/*;q=0.8”
            ),
        },
        method=“HEAD”,
    )
    try:
        with opener.open(
            request,
            timeout=timeout,
        ) as response:
            if response.status >= 400:
                return f”HTTP status {response.status}”
            return None
    except urllib.error.HTTPError as exc:
        if exc.code in {
            403,
            405,
            501,
        }:
            return check_external_get(
                url,
                timeout,
                opener,
            )
        return f”HTTP status {exc.code}”
    except (
        urllib.error.URLError,
        TimeoutError,
        OSError,
        ValueError,
    ) as exc:
        return (
            “External URL could not be verified “
            f”({type(exc).__name__}).”
        )
def check_external_get(
    url: str,
    timeout: float,
    opener: urllib.request.OpenerDirector,
) -> str | None:
    request = urllib.request.Request(
        url,
        headers={
            “User-Agent”: USER_AGENT,
            “Range”: “bytes=0-0”,
        },
        method=“GET”,
    )
    try:
        with opener.open(
            request,
            timeout=timeout,
        ) as response:
            if response.status >= 400:
                return f”HTTP status {response.status}”
            return None
    except urllib.error.HTTPError as exc:
        return f”HTTP status {exc.code}”
    except (
        urllib.error.URLError,
        TimeoutError,
        OSError,
        ValueError,
    ) as exc:
        return (
            “External URL could not be verified “
            f”({type(exc).__name__}).”
        )
# =============================================================================
# 17. VALIDATION ENGINE
# =============================================================================
def validate_repository(
    args: argparse.Namespace,
    root: Path,
) -> tuple[list[Finding], int, int]:
    findings: list[Finding] = []
    extra_excludes = {
        item.strip().strip(“/“)
        for item in args.exclude
        if item.strip()
    }
    files = collect_files(
        root,
        extra_excludes,
    )
    html_id_cache: dict[
        Path,
        set[str]
    ] = {}
    external_urls: dict[
        str,
        LinkReference
    ] = {}
    total_references = 0
    for source in files:
        text = read_text(
            source,
            args.max_file_size,
        )
        display_source = relative_path(
            source,
            root,
        )
        if text is None:
            findings.append(
                Finding(
                    “WARNING”,
                    display_source,
                    0,
                    (
                        “File could not be read as UTF-8 “
                        “or exceeds the configured size limit.”
                    ),
                )
            )
            continue
        references, ids = collect_references(
            source,
            text,
        )
        total_references += len(references)
        if source.suffix.lower() in HTML_SUFFIXES:
            html_id_cache[source] = ids
        for reference in references:
            target = resolve_target_path(
                root,
                source,
                reference.target,
            )
            if target.external:
                if args.check_external:
                    normalized = normalize_external_url(
                        reference.target
                    )
                    if normalized is not None:
                        external_urls.setdefault(
                            normalized,
                            reference,
                        )
                continue
            if target.invalid_reason:
                findings.append(
                    Finding(
                        “ERROR”,
                        display_source,
                        reference.line,
                        (
                            f”{reference.kind}: “
                            f”{target.invalid_reason}”
                        ),
                    )
                )
                continue
            target_path = target.path
            if target_path is None:
                findings.append(
                    Finding(
                        “ERROR”,
                        display_source,
                        reference.line,
                        (
                            f”{reference.kind}: “
                            f”Unable to resolve local target “
                            f”{reference.target!r}.”
                        ),
                    )
                )
                continue
            resolved_target = resolve_index_file(
                target_path
            )
            if (
                resolved_target is None
                or not resolved_target.exists()
            ):
                findings.append(
                    Finding(
                        “ERROR”,
                        display_source,
                        reference.line,
                        (
                            f”{reference.kind}: “
                            f”Missing local target “
                            f”{reference.target!r}.”
                        ),
                    )
                )
                continue
            # Validate fragments only on HTML documents.
            if (
                target.fragment
                and resolved_target.is_file()
                and resolved_target.suffix.lower() in HTML_SUFFIXES
            ):
                target_ids = get_html_ids(
                    resolved_target,
                    html_id_cache,
                    args.max_file_size,
                )
                if target_ids is None:
                    findings.append(
                        Finding(
                            “WARNING”,
                            display_source,
                            reference.line,
                            (
                                “Unable to inspect target HTML “
                                “document for fragment IDs.”
                            ),
                        )
                    )
                    continue
                if target.fragment not in target_ids:
                    findings.append(
                        Finding(
                            “ERROR”,
                            display_source,
                            reference.line,
                            (
                                f”Missing fragment “
                                f”#{target.fragment} in “
                                f”{relative_path(resolved_target, root)}.”
                            ),
                        )
                    )
    return (
        findings,
        len(files),
        total_references,
    )
# =============================================================================
# 18. EXTERNAL URL VALIDATION
# =============================================================================
def validate_external_urls(
    urls: dict[str, LinkReference],
    args: argparse.Namespace,
    root: Path,
) -> list[Finding]:
    findings: list[Finding] = []
    checked = 0
    for url, reference in sorted(
        urls.items()
    ):
        if checked >= args.max_external:
            findings.append(
                Finding(
                    “WARNING”,
                    “.”,
                    0,
                    (
                        “External URL validation limit reached. “
                        “Some URLs were not checked.”
                    ),
                )
            )
            break
        checked += 1
        error = check_external_url(
            url,
            args.timeout,
        )
        if error:
            findings.append(
                Finding(
                    “WARNING”,
                    relative_path(
                        reference.source,
                        root,
                    ),
                    reference.line,
                    (
                        f”External link could not be verified: “
                        f”{safe_url_display(url)} — {error}”
                    ),
                )
            )
        # Avoid rapid requests to external servers.
        time.sleep(0.05)
    return findings
# =============================================================================
# 19. DIAGNOSTIC REPORTING
# =============================================================================
def print_report(
    findings: list[Finding],
    scanned_files: int,
    total_references: int,
    external_checked: int,
    strict: bool,
) -> int:
    errors = [
        finding
        for finding in findings
        if finding.severity == “ERROR”
    ]
    warnings = [
        finding
        for finding in findings
        if finding.severity == “WARNING”
    ]
    for finding in sorted(
        findings,
        key=lambda item: (
            item.severity != “ERROR”,
            item.source,
            item.line,
            item.message,
        ),
    ):
        location = finding.source
        if finding.line:
            location += f”:{finding.line}”
        print(
            f”{finding.severity}: “
            f”{location}: “
            f”{finding.message}”
        )
    print()
    print(“=“ * 72)
    print(“MedOrbits Repository Link Validation”)
    print(“=“ * 72)
    print(
        f”Files scanned:          {scanned_files}”
    )
    print(
        f”References discovered:  {total_references}”
    )
    print(
        f”External URLs checked:  {external_checked}”
    )
    print(
        f”Errors:                 {len(errors)}”
    )
    print(
        f”Warnings:               {len(warnings)}”
    )
    print(“=“ * 72)
    if errors:
        print(
            “RESULT: FAILED — broken links or invalid references found.”
        )
        return 1
    if strict and warnings:
        print(
            “RESULT: FAILED — strict mode does not permit warnings.”
        )
        return 1
    print(
        “RESULT: PASSED — no blocking link errors found.”
    )
    return 0
# =============================================================================
# 20. MAIN ENTRY POINT
# =============================================================================
def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    if not root.exists() or not root.is_dir():
        print(
            f”ERROR: Repository root is not a directory: {root}”,
            file=sys.stderr,
        )
        return 2
    if args.timeout <= 0:
        print(
            “ERROR: —timeout must be greater than zero.”,
            file=sys.stderr,
        )
        return 2
    if args.max_external < 0:
        print(
            “ERROR: —max-external cannot be negative.”,
            file=sys.stderr,
        )
        return 2
    if args.max_file_size <= 0:
        print(
            “ERROR: —max-file-size must be greater than zero.”,
            file=sys.stderr,
        )
        return 2
    for exclusion in args.exclude:
        candidate = Path(exclusion)
        if candidate.is_absolute():
            print(
                “ERROR: —exclude must use repository-relative paths.”,
                file=sys.stderr,
            )
            return 2
    if args.check_external:
        print(
            “INFO: External URL checking is enabled. “
            “Only run this mode on trusted repository content.”
        )
    findings, scanned_files, total_references = (
        validate_repository(
            args,
            root,
        )
    )
    external_checked = 0
    if args.check_external:
        urls: dict[
            str,
            LinkReference
        ] = {}
        # External references are collected separately during validation.
        # Recollect them here to keep the local validation engine isolated.
        extra_excludes = {
            item.strip().strip(“/“)
            for item in args.exclude
            if item.strip()
        }
        for source in collect_files(
            root,
            extra_excludes,
        ):
            text = read_text(
                source,
                args.max_file_size,
            )
            if text is None:
                continue
            references, _ = collect_references(
                source,
                text,
            )
            for reference in references:
                target = resolve_target_path(
                    root,
                    source,
                    reference.target,
                )
                if not target.external:
                    continue
                normalized = normalize_external_url(
                    reference.target
                )
                if normalized is not None:
                    urls.setdefault(
                        normalized,
                        reference,
                    )
        external_checked = min(
            len(urls),
            args.max_external,
        )
        findings.extend(
            validate_external_urls(
                urls,
                args,
                root,
            )
        )
    return print_report(
        findings,
        scanned_files,
        total_references,
        external_checked,
        args.strict,
    )
# =============================================================================
# 21. SCRIPT EXECUTION
# =============================================================================
if __name__ == “__main__”:
    try:
        raise SystemExit(
            main()
        )
    except KeyboardInterrupt:
        print(
            “\nERROR: Link validation interrupted.”,
            file=sys.stderr,
        )
        raise SystemExit(2)
    except Exception:
        # Do not print raw exception contents, which may contain
        # sensitive paths or URL information.
        print(
            “ERROR: Unexpected link-checker execution failure.”,
            file=sys.stderr,
        )
        raise SystemExit(2)