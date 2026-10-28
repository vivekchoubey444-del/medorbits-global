#!/usr/bin/env python3
"""
MedOrbits Link Validator
========================
Validates URLs and internal file links in HTML, CSS, JavaScript, JSON,
Markdown, and text files.
Features:
- Detects malformed URLs and unsupported URL schemes.
- Checks local file links and relative asset references.
- Detects broken HTML href/src/action links.
- Checks Markdown links and CSS url(...) references.
- Supports optional HTTP/HTTPS availability checks.
- Supports configurable exclusions and allowed domains.
- Generates JSON reports.
- Never modifies source files.
Python: 3.12+
Dependencies: Python standard library only.
Exit codes:
    0 = No errors found.
    1 = One or more validation errors found.
    2 = Invalid arguments or execution error.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
VERSION = "1.0.0"
DEFAULT_EXTENSIONS = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".md",
    ".txt",
}
DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    "coverage",
}
IGNORED_SCHEMES = {
    "mailto",
    "tel",
    "sms",
    "javascript",
    "data",
    "blob",
}
ALLOWED_SCHEMES = {
    "http",
    "https",
    "mailto",
    "tel",
    "sms",
    "javascript",
    "data",
    "blob",
    "ftp",
}
HTML_LINK_ATTRIBUTES = {
    "href",
    "src",
    "action",
    "poster",
    "data",
    "formaction",
    "cite",
    "manifest",
}
URL_PATTERN = re.compile(
    r"""url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)""",
    re.IGNORECASE,
)
MARKDOWN_LINK_PATTERN = re.compile(
    r"""!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))"""
)
PLAIN_URL_PATTERN = re.compile(
    r"""(?<!["'=])\bhttps?://[^\s<>"'`]+""",
    re.IGNORECASE,
)
@dataclass
class LinkFinding:
    """One link-validation finding."""
    file: str
    line: int
    link: str
    kind: str
    severity: str
    message: str
@dataclass
class LinkReference:
    """A discovered link reference."""
    file: Path
    line: int
    link: str
    kind: str
class HTMLLinkParser(HTMLParser):
    """Extract links from HTML tags and inline styles."""
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[int, str, str]] = []
    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        line = self.getpos()[0]
        for attribute, value in attrs:
            if value is None:
                continue
            attribute = attribute.lower()
            if attribute in HTML_LINK_ATTRIBUTES:
                self.references.append((line, value.strip(), attribute))
            elif attribute == "srcset":
                for item in value.split(","):
                    parts = item.strip().split()
                    if parts:
                        self.references.append(
                            (line, parts[0], "srcset")
                        )
            elif attribute == "style":
                for match in URL_PATTERN.finditer(value):
                    url = next(
                        (
                            group
                            for group in match.groups()
                            if group is not None
                        ),
                        "",
                    ).strip()
                    if url:
                        self.references.append(
                            (line, url, "css-url")
                        )
    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.handle_starttag(tag, attrs)
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate links in MedOrbits project files."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Project directory or a single supported file. Default: current directory.",
    )
    parser.add_argument(
        "--extensions",
        default=",".join(sorted(DEFAULT_EXTENSIONS)),
        help="Comma-separated file extensions to scan.",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        help="Directory name to exclude. May be specified more than once.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Relative file or directory path to exclude. May be specified more than once.",
    )
    parser.add_argument(
        "--allow-domain",
        action="append",
        default=[],
        help="External domain to allow. May be specified more than once.",
    )
    parser.add_argument(
        "--check-external",
        action="store_true",
        help="Check HTTP/HTTPS links online. Network access is disabled by default.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=8.0,
        help="Timeout per external request in seconds. Default: 8.",
    )
    parser.add_argument(
        "--user-agent",
        default="MedOrbits-LinkValidator/1.0",
        help="User-Agent for external link checks.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Write a JSON report to this path.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors for the final exit code.",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files and directories.",
    )
    parser.add_argument(
        "--allow-root-escape",
        action="store_true",
        help="Allow relative file links to resolve outside the project root.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero.")
    return args
def normalize_extensions(value: str) -> set[str]:
    extensions = set()
    for item in value.split(","):
        extension = item.strip().lower()
        if not extension:
            continue
        if not extension.startswith("."):
            extension = "." + extension
        extensions.add(extension)
    if not extensions:
        raise ValueError("At least one file extension is required.")
    return extensions
def is_hidden(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        relative = path
    return any(part.startswith(".") for part in relative.parts)
def discover_files(
    root: Path,
    extensions: set[str],
    excluded_dirs: set[str],
    excluded_paths: set[Path],
    include_hidden: bool,
) -> list[Path]:
    if root.is_file():
        if root.suffix.lower() not in extensions:
            raise ValueError(
                f"Unsupported file extension: {root.suffix or '(none)'}"
            )
        if root.resolve() in excluded_paths:
            return []
        return [root.resolve()]
    if not root.is_dir():
        raise FileNotFoundError(
            f"Root path does not exist or is not accessible: {root}"
        )
    root = root.resolve()
    found: list[Path] = []
    for path in root.rglob("*"):
        try:
            if not path.is_file():
                continue
            resolved = path.resolve()
            if resolved in excluded_paths:
                continue
            if path.suffix.lower() not in extensions:
                continue
            relative_parts = path.relative_to(root).parts
            if any(part in excluded_dirs for part in relative_parts):
                continue
            if not include_hidden and is_hidden(path, root):
                continue
            found.append(resolved)
        except (OSError, ValueError):
            continue
    return sorted(set(found))
def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig", errors="replace")
def extract_html_links(path: Path, content: str) -> list[LinkReference]:
    parser = HTMLLinkParser()
    try:
        parser.feed(content)
        parser.close()
    except Exception:
        # Other extracted references can still be checked.
        pass
    return [
        LinkReference(path, line, link, kind)
        for line, link, kind in parser.references
    ]
def extract_css_links(path: Path, content: str) -> list[LinkReference]:
    references = []
    for match in URL_PATTERN.finditer(content):
        line = content.count("\n", 0, match.start()) + 1
        link = next(
            (
                group
                for group in match.groups()
                if group is not None
            ),
            "",
        ).strip()
        if link:
            references.append(
                LinkReference(path, line, link, "css-url")
            )
    return references
def extract_markdown_links(
    path: Path,
    content: str,
) -> list[LinkReference]:
    references = []
    for match in MARKDOWN_LINK_PATTERN.finditer(content):
        link = match.group(1) or match.group(2) or ""
        link = link.strip()
        if link:
            line = content.count("\n", 0, match.start()) + 1
            references.append(
                LinkReference(path, line, link, "markdown")
            )
    return references
def extract_plain_urls(
    path: Path,
    content: str,
) -> list[LinkReference]:
    references = []
    for match in PLAIN_URL_PATTERN.finditer(content):
        link = match.group(0).rstrip(".,;:!?)")
        line = content.count("\n", 0, match.start()) + 1
        if link:
            references.append(
                LinkReference(path, line, link, "external-url")
            )
    return references
def extract_json_links(
    path: Path,
    content: str,
) -> list[LinkReference]:
    references = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return references
    def visit(value: Any, line_hint: int = 1) -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if isinstance(item, str):
                    normalized_key = key.lower()
                    if (
                        normalized_key in {
                            "url",
                            "uri",
                            "href",
                            "src",
                            "link",
                            "website",
                            "official_url",
                            "application_url",
                            "source_url",
                            "image_url",
                        }
                        or normalized_key.endswith("_url")
                        or normalized_key.endswith("_uri")
                    ):
                        references.append(
                            LinkReference(
                                path,
                                line_hint,
                                item.strip(),
                                f"json:{key}",
                            )
                        )
                visit(item, line_hint)
        elif isinstance(value, list):
            for item in value:
                visit(item, line_hint)
    visit(data)
    return references
def extract_references(
    path: Path,
    content: str,
) -> list[LinkReference]:
    suffix = path.suffix.lower()
    references: list[LinkReference] = []
    if suffix in {".html", ".htm"}:
        references.extend(extract_html_links(path, content))
        references.extend(extract_css_links(path, content))
    elif suffix == ".css":
        references.extend(extract_css_links(path, content))
    elif suffix == ".md":
        references.extend(extract_markdown_links(path, content))
        references.extend(extract_plain_urls(path, content))
    elif suffix == ".json":
        references.extend(extract_json_links(path, content))
    elif suffix in {".js", ".mjs", ".txt"}:
        references.extend(extract_plain_urls(path, content))
    # Preserve order while removing exact duplicate references.
    seen = set()
    unique = []
    for reference in references:
        key = (
            reference.line,
            reference.link,
            reference.kind,
        )
        if key not in seen:
            seen.add(key)
            unique.append(reference)
    return unique
def is_ignored_link(link: str) -> bool:
    value = link.strip()
    if not value:
        return True
    if value.startswith("#"):
        return True
    parsed = urllib.parse.urlsplit(value)
    return parsed.scheme.lower() in IGNORED_SCHEMES
def normalize_domain(domain: str) -> str:
    return domain.strip().lower().rstrip(".")
def domain_is_allowed(
    hostname: str,
    allowed_domains: set[str],
) -> bool:
    hostname = normalize_domain(hostname)
    for domain in allowed_domains:
        domain = normalize_domain(domain)
        if hostname == domain or hostname.endswith("." + domain):
            return True
    return False
def validate_external_url(
    link: str,
    reference: LinkReference,
    allowed_domains: set[str],
    check_external: bool,
    timeout: float,
    user_agent: str,
) -> list[LinkFinding]:
    findings = []
    try:
        parsed = urllib.parse.urlsplit(link)
    except ValueError as exc:
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Malformed URL: {exc}",
            )
        ]
    scheme = parsed.scheme.lower()
    if not scheme:
        return []
    if scheme not in ALLOWED_SCHEMES:
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Unsupported URL scheme: {scheme}",
            )
        ]
    if scheme not in {"http", "https"}:
        return findings
    if not parsed.hostname:
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                "HTTP/HTTPS URL is missing a hostname.",
            )
        ]
    if domain_is_allowed(parsed.hostname, allowed_domains):
        return findings
    if not check_external:
        return findings
    request = urllib.request.Request(
        link,
        headers={"User-Agent": user_agent},
        method="HEAD",
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=timeout,
        ) as response:
            status = response.status
            if status >= 400:
                findings.append(
                    LinkFinding(
                        str(reference.file),
                        reference.line,
                        link,
                        reference.kind,
                        "error",
                        f"External URL returned HTTP {status}.",
                    )
                )
    except urllib.error.HTTPError as exc:
        # Some servers reject HEAD requests; retry using GET.
        if exc.code in {403, 405, 501}:
            try:
                get_request = urllib.request.Request(
                    link,
                    headers={
                        "User-Agent": user_agent,
                        "Range": "bytes=0-0",
                    },
                    method="GET",
                )
                with urllib.request.urlopen(
                    get_request,
                    timeout=timeout,
                ) as response:
                    if response.status >= 400:
                        findings.append(
                            LinkFinding(
                                str(reference.file),
                                reference.line,
                                link,
                                reference.kind,
                                "error",
                                f"External URL returned HTTP {response.status}.",
                            )
                        )
            except urllib.error.HTTPError as retry_exc:
                findings.append(
                    LinkFinding(
                        str(reference.file),
                        reference.line,
                        link,
                        reference.kind,
                        "warning"
                        if retry_exc.code in {401, 403, 429}
                        else "error",
                        f"External URL returned HTTP {retry_exc.code}.",
                    )
                )
            except (urllib.error.URLError, TimeoutError, OSError) as retry_exc:
                findings.append(
                    LinkFinding(
                        str(reference.file),
                        reference.line,
                        link,
                        reference.kind,
                        "warning",
                        f"External URL could not be verified: {retry_exc}",
                    )
                )
        else:
            findings.append(
                LinkFinding(
                    str(reference.file),
                    reference.line,
                    link,
                    reference.kind,
                    "warning"
                    if exc.code in {401, 403, 429}
                    else "error",
                    f"External URL returned HTTP {exc.code}.",
                )
            )
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        findings.append(
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "warning",
                f"External URL could not be verified: {exc}",
            )
        )
    return findings
def resolve_local_target(
    link: str,
    source_file: Path,
    root: Path,
) -> tuple[Path | None, str | None]:
    value = link.strip()
    if not value:
        return None, "Empty local link."
    # Support root-relative website links such as /assets/logo.svg.
    # These resolve against the project root, not the operating-system root.
    parsed = urllib.parse.urlsplit(value)
    path_part = urllib.parse.unquote(parsed.path)
    if not path_part:
        return None, None
    if "\\" in path_part:
        path_part = path_part.replace("\\", "/")
    if path_part.startswith("/"):
        target = root / path_part.lstrip("/")
    else:
        target = source_file.parent / path_part
    try:
        resolved_target = target.resolve()
        resolved_root = root.resolve()
        if (
            resolved_target != resolved_root
            and resolved_root not in resolved_target.parents
        ):
            return resolved_target, "Link resolves outside the project root."
        return resolved_target, None
    except (OSError, RuntimeError, ValueError) as exc:
        return None, f"Could not resolve local path: {exc}"
def validate_local_link(
    reference: LinkReference,
    root: Path,
    allow_root_escape: bool,
) -> list[LinkFinding]:
    link = reference.link.strip()
    if is_ignored_link(link):
        return []
    try:
        parsed = urllib.parse.urlsplit(link)
    except ValueError as exc:
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Malformed link: {exc}",
            )
        ]
    if parsed.scheme:
        return []
    # Protocol-relative URLs, e.g. //cdn.example.com/file.js.
    if link.startswith("//"):
        return []
    target, resolution_error = resolve_local_target(
        link,
        reference.file,
        root,
    )
    if resolution_error:
        if (
            allow_root_escape
            and "outside the project root" in resolution_error
        ):
            return []
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                resolution_error,
            )
        ]
    if target is None:
        return []
    # A fragment-only link is ignored above. For a link with a path and
    # fragment, only the local path is checked.
    if not target.exists():
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Local target does not exist: {target}",
            )
        ]
    return []
def validate_reference(
    reference: LinkReference,
    root: Path,
    allowed_domains: set[str],
    check_external: bool,
    timeout: float,
    user_agent: str,
    allow_root_escape: bool,
) -> list[LinkFinding]:
    link = reference.link.strip()
    if is_ignored_link(link):
        return []
    try:
        parsed = urllib.parse.urlsplit(link)
    except ValueError as exc:
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Malformed link: {exc}",
            )
        ]
    if parsed.scheme.lower() in {"http", "https"}:
        return validate_external_url(
            link,
            reference,
            allowed_domains,
            check_external,
            timeout,
            user_agent,
        )
    if parsed.scheme:
        if parsed.scheme.lower() in ALLOWED_SCHEMES:
            return []
        return [
            LinkFinding(
                str(reference.file),
                reference.line,
                link,
                reference.kind,
                "error",
                f"Unsupported URL scheme: {parsed.scheme}",
            )
        ]
    if link.startswith("//"):
        if not parsed.netloc:
            return [
                LinkFinding(
                    str(reference.file),
                    reference.line,
                    link,
                    reference.kind,
                    "error",
                    "Protocol-relative URL is missing a hostname.",
                )
            ]
        if check_external:
            absolute_url = "https:" + link
            return validate_external_url(
                absolute_url,
                reference,
                allowed_domains,
                check_external,
                timeout,
                user_agent,
            )
        return []
    return validate_local_link(
        reference,
        root,
        allow_root_escape,
    )
def relative_display(path: Path, root: Path) -> str:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()
def write_report(
    output_path: Path,
    report: dict[str, Any],
    overwrite: bool,
) -> None:
    output_path = output_path.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Report already exists: {output_path}. "
            "Choose another path or remove the old report."
        )
    output_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
def main() -> int:
    args = parse_args()
    started = time.monotonic()
    try:
        root = args.root.expanduser().resolve()
        extensions = normalize_extensions(args.extensions)
        excluded_dirs = DEFAULT_EXCLUDED_DIRS | set(args.exclude_dir)
        excluded_paths = {
            (root / item).resolve()
            for item in args.exclude
        }
        report_path = (
            args.report.expanduser().resolve()
            if args.report
            else None
        )
        if report_path is not None:
            # Prevent overwriting a source file, including when --root
            # points directly to a single file.
            if root.is_file() and report_path == root:
                raise ValueError(
                    "The report path cannot overwrite the scanned source file."
                )
            excluded_paths.add(report_path)
        files = discover_files(
            root,
            extensions,
            excluded_dirs,
            excluded_paths,
            args.include_hidden,
        )
        project_root = root if root.is_dir() else root.parent
        allowed_domains = {
            normalize_domain(domain)
            for domain in args.allow_domain
            if domain.strip()
        }
        findings: list[LinkFinding] = []
        files_scanned = 0
        links_checked = 0
        unreadable_files = 0
        for path in files:
            try:
                content = read_text(path)
            except OSError as exc:
                unreadable_files += 1
                findings.append(
                    LinkFinding(
                        relative_display(path, project_root),
                        1,
                        "",
                        "file",
                        "error",
                        f"Could not read file: {exc}",
                    )
                )
                continue
            files_scanned += 1
            references = extract_references(path, content)
            for reference in references:
                links_checked += 1
                link_findings = validate_reference(
                    reference,
                    project_root,
                    allowed_domains,
                    args.check_external,
                    args.timeout,
                    args.user_agent,
                    args.allow_root_escape,
                )
                for finding in link_findings:
                    finding.file = relative_display(
                        reference.file,
                        project_root,
                    )
                    findings.append(finding)
        counts = Counter(finding.severity for finding in findings)
        errors = counts.get("error", 0)
        warnings = counts.get("warning", 0)
        report = {
            "metadata": {
                "tool": "MedOrbits Link Validator",
                "version": VERSION,
                "generatedAt": datetime.now(
                    timezone.utc
                ).isoformat(),
                "root": str(project_root),
                "externalChecksEnabled": args.check_external,
                "durationSeconds": round(
                    time.monotonic() - started,
                    3,
                ),
            },
            "summary": {
                "filesDiscovered": len(files),
                "filesScanned": files_scanned,
                "unreadableFiles": unreadable_files,
                "linksChecked": links_checked,
                "errors": errors,
                "warnings": warnings,
                "passed": errors == 0 and (
                    warnings == 0 or not args.strict
                ),
            },
            "findings": [
                asdict(finding)
                for finding in findings
            ],
        }
        print("MedOrbits Link Validator")
        print("=" * 26)
        print(f"Project root:      {project_root}")
        print(f"Files discovered:  {len(files)}")
        print(f"Files scanned:     {files_scanned}")
        print(f"Links checked:     {links_checked}")
        print(f"Errors:            {errors}")
        print(f"Warnings:          {warnings}")
        if findings:
            print("\nFindings:")
            for finding in findings:
                location = f"{finding.file}:{finding.line}"
                print(
                    f"[{finding.severity.upper()}] "
                    f"{location} | {finding.link or '(file)'}"
                )
                print(f"  {finding.message}")
        if report_path is not None:
            write_report(
                report_path,
                report,
                overwrite=False,
            )
            print(f"\nJSON report: {report_path}")
        if errors > 0 or (args.strict and warnings > 0):
            return 1
        return 0
    except (OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())

#
# Run commands
#
# # Scan the entire MedOrbits project
# python python/scripts/validate_links.py --root .
# # Scan the website pages and assets
# python python/scripts/validate_links.py --root pages
# # Check external HTTP/HTTPS links (requires network access)
# python python/scripts/validate_links.py --root . --check-external
# # Save a JSON report
# python python/scripts/validate_links.py \
#   --root . \
#   --report reports/link-validation.json
# # Fail on warnings as well as errors
# python python/scripts/validate_links.py --root . --strict
# # Exclude a directory and a file
# python python/scripts/validate_links.py \
#   --root . \
#   --exclude-dir archives \
#   --exclude pages/legacy.html
# # Allow known external domains to be skipped during online checks
# python python/scripts/validate_links.py \
#   --root . \
#   --check-external \
#   --allow-domain example.com
#
# Important: External checks are disabled by default, so the validator can run offline. Internal links are resolved against the project root for root-relative website paths such as /assets/images/logo.svg. The script checks whether local targets exist; it does not verify that a fragment such as #section-name exists inside the target document.
