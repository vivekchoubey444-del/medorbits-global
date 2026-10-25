#!/usr/bin/env python3
"""
MedOrbits Live Notifications Downloader
=======================================
Reads trusted HTTPS JSON, RSS, or Atom sources from:
    /python/config/live-source-import.json
Generates:
    /python/assets/data/live-notifications.json
Features:
- Configurable trusted-host allowlist
- HTTPS-only source URLs
- Redirect validation
- Public-IP validation to reduce SSRF risks
- Response-size limits and timeouts
- JSON, RSS, and Atom support
- Normalization and duplicate removal
- Atomic output writing
- Dry-run mode
- No external dependencies; Python 3.10+
IMPORTANT:
Replace the example hostname in the configuration with a real,
trusted source domain before enabling any source.
"""
from __future__ import annotations
import argparse
import hashlib
import ipaddress
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
# ------------------------------------------------------------
# CONSTANTS
# ------------------------------------------------------------
SCRIPT_PATH = Path(__file__).resolve()
PYTHON_ROOT = SCRIPT_PATH.parent.parent
DEFAULT_CONFIG = PYTHON_ROOT / "config" / "live-source-import.json"
DEFAULT_OUTPUT = (
    PYTHON_ROOT / "assets" / "data" / "live-notifications.json"
)
USER_AGENT = "MedOrbitsLiveNotifications/1.0"
DEFAULT_TIMEOUT = 15
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_ITEMS_PER_SOURCE = 200
MAX_TOTAL_ITEMS = 1000
MAX_TITLE_LENGTH = 240
MAX_SUMMARY_LENGTH = 1200
MAX_URL_LENGTH = 2048
MAX_ID_LENGTH = 512
# ------------------------------------------------------------
# GENERAL HELPERS
# ------------------------------------------------------------
def utc_now() -> str:
    """Return a UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
def clean_text(value: Any, max_length: int = 1200) -> str:
    """Convert input to plain text and limit its length."""
    if value is None:
        return ""
    text = str(value)
    # Remove script/style blocks before removing remaining tags.
    text = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1\s*>",
        " ",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_length]
def safe_filename_parent(path: Path) -> None:
    """Create the output parent directory if required."""
    path.parent.mkdir(parents=True, exist_ok=True)
def load_json_file(path: Path) -> Any:
    """Read a JSON file."""
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError as exc:
        raise RuntimeError(f"File not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Invalid JSON in {path}: line {exc.lineno}, "
            f"column {exc.colno}: {exc.msg}"
        ) from exc
# ------------------------------------------------------------
# URL AND NETWORK SECURITY
# ------------------------------------------------------------
def validate_https_url(url: str) -> urllib.parse.SplitResult:
    """
    Validate a URL and reject non-HTTPS, credentials, invalid ports,
    localhost, and literal non-public IP addresses.
    """
    if not isinstance(url, str) or not url.strip():
        raise ValueError("Source URL is empty.")
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("Source URL exceeds the maximum length.")
    parsed = urllib.parse.urlsplit(url.strip())
    if parsed.scheme.lower() != "https":
        raise ValueError("Only HTTPS source URLs are permitted.")
    if not parsed.hostname:
        raise ValueError("Source URL has no hostname.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials in source URLs are not permitted.")
    if parsed.fragment:
        raise ValueError("URL fragments are not permitted.")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Source URL contains an invalid port.") from exc
    if port not in (None, 443):
        raise ValueError("Only the default HTTPS port 443 is permitted.")
    hostname = parsed.hostname.lower().rstrip(".")
    if hostname in {"localhost", "localhost.localdomain"}:
        raise ValueError("Localhost URLs are not permitted.")
    if hostname.endswith(".local"):
        raise ValueError("Local network hostnames are not permitted.")
    try:
        address = ipaddress.ip_address(hostname)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError("Non-public IP addresses are not permitted.")
    return parsed
def hostname_is_allowed(hostname: str, allowed_hosts: list[str]) -> bool:
    """
    Match an exact hostname or a deliberately configured subdomain rule.
    Example:
        example.com       matches example.com only
        .example.com      matches example.com and its subdomains
    """
    hostname = hostname.lower().rstrip(".")
    for entry in allowed_hosts:
        if not isinstance(entry, str):
            continue
        rule = entry.strip().lower().rstrip(".")
        if not rule or rule.startswith("YOUR-"):
            continue
        if rule.startswith("*."):
            rule = "." + rule[2:]
        if rule.startswith("."):
            root = rule[1:]
            if hostname == root or hostname.endswith("." + root):
                return True
        elif hostname == rule:
            return True
    return False
def validate_source_url(url: str, allowed_hosts: list[str]) -> str:
    """Validate HTTPS and enforce the configured hostname allowlist."""
    parsed = validate_https_url(url)
    hostname = parsed.hostname.lower().rstrip(".")
    if not hostname_is_allowed(hostname, allowed_hosts):
        raise ValueError(
            f"Host '{hostname}' is not in the configured allowed_hosts list."
        )
    return urllib.parse.urlunsplit(parsed)
def validate_public_dns(hostname: str) -> None:
    """
    Reject hostnames resolving to private, loopback, reserved, or otherwise
    non-global IP addresses.
    This is a defensive check, not a complete guarantee against DNS rebinding.
    """
    try:
        results = socket.getaddrinfo(
            hostname,
            443,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise ValueError(
            f"Could not resolve source hostname '{hostname}': {exc}"
        ) from exc
    if not results:
        raise ValueError(f"No DNS addresses found for '{hostname}'.")
    for result in results:
        address_text = result[4][0].split("%", 1)[0]
        try:
            address = ipaddress.ip_address(address_text)
        except ValueError as exc:
            raise ValueError("DNS returned an invalid IP address.") from exc
        if not address.is_global:
            raise ValueError(
                f"Hostname '{hostname}' resolves to a non-public IP address."
            )
class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Validate every redirect before following it."""
    def __init__(self, allowed_hosts: list[str]):
        super().__init__()
        self.allowed_hosts = allowed_hosts
    def redirect_request(
        self,
        request: urllib.request.Request,
        response: Any,
        code: int,
        message: str,
        headers: Any,
        new_url: str,
    ) -> urllib.request.Request | None:
        validated_url = validate_source_url(
            new_url,
            self.allowed_hosts,
        )
        parsed = urllib.parse.urlsplit(validated_url)
        validate_public_dns(parsed.hostname)
        return super().redirect_request(
            request,
            response,
            code,
            message,
            headers,
            validated_url,
        )
def build_opener(allowed_hosts: list[str]) -> urllib.request.OpenerDirector:
    """Build an HTTP opener with redirect validation."""
    return urllib.request.build_opener(
        SafeRedirectHandler(allowed_hosts)
    )
# ------------------------------------------------------------
# DOWNLOAD
# ------------------------------------------------------------
def download_url(
    url: str,
    allowed_hosts: list[str],
    timeout: int = DEFAULT_TIMEOUT,
) -> tuple[bytes, str, str]:
    """
    Download a source using HTTPS.
    Returns:
        response_bytes, final_url, content_type
    """
    validated_url = validate_source_url(url, allowed_hosts)
    parsed = urllib.parse.urlsplit(validated_url)
    validate_public_dns(parsed.hostname)
    request = urllib.request.Request(
        validated_url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": (
                "application/json, application/rss+xml, "
                "application/atom+xml, application/xml, text/xml"
            ),
        },
        method="GET",
    )
    opener = build_opener(allowed_hosts)
    try:
        with opener.open(request, timeout=timeout) as response:
            final_url = response.geturl()
            final_parsed = urllib.parse.urlsplit(
                validate_source_url(final_url, allowed_hosts)
            )
            validate_public_dns(final_parsed.hostname)
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    declared_length = int(content_length)
                except ValueError:
                    declared_length = 0
                if declared_length > MAX_RESPONSE_BYTES:
                    raise ValueError(
                        "Source response exceeds the maximum allowed size."
                    )
            data = response.read(MAX_RESPONSE_BYTES + 1)
            if len(data) > MAX_RESPONSE_BYTES:
                raise ValueError(
                    "Source response exceeds the maximum allowed size."
                )
            content_type = response.headers.get(
                "Content-Type",
                "",
            ).lower()
            return data, final_parsed.geturl(), content_type
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"HTTP error {exc.code} while downloading source."
        ) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Network error while downloading source: {exc.reason}"
        ) from exc
    except TimeoutError as exc:
        raise RuntimeError("Source download timed out.") from exc
# ------------------------------------------------------------
# SOURCE PARSERS
# ------------------------------------------------------------
def parse_json_items(data: bytes) -> list[dict[str, Any]]:
    """Parse common JSON feed shapes."""
    try:
        payload = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Source is not valid UTF-8 JSON: {exc}") from exc
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = None
        for key in ("items", "notifications", "announcements", "results", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                records = value
                break
        if records is None:
            # Accept a single notification object.
            if any(
                key in payload
                for key in ("title", "headline", "message", "summary")
            ):
                records = [payload]
            else:
                raise ValueError(
                    "JSON feed must contain an array named items, "
                    "notifications, announcements, results, or data."
                )
    else:
        raise ValueError("Unsupported JSON feed structure.")
    return [
        item for item in records[:MAX_ITEMS_PER_SOURCE]
        if isinstance(item, dict)
    ]
def xml_local_name(tag: str) -> str:
    """Remove an XML namespace from an element name."""
    return tag.rsplit("}", 1)[-1].lower()
def xml_child_text(element: ET.Element, names: set[str]) -> str:
    """Return text from the first matching descendant."""
    for child in element.iter():
        if xml_local_name(child.tag) in names:
            text = "".join(child.itertext()).strip()
            if text:
                return text
    return ""
def parse_xml_items(data: bytes) -> list[dict[str, Any]]:
    """Parse RSS and Atom feed entries."""
    # Reject DTD/entity declarations before parsing.
    if re.search(
        rb"<!\s*(DOCTYPE|ENTITY)\b",
        data,
        flags=re.IGNORECASE,
    ):
        raise ValueError("XML DTD and entity declarations are not permitted.")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f"Invalid RSS/Atom XML: {exc}") from exc
    items: list[dict[str, Any]] = []
    for element in root.iter():
        if xml_local_name(element.tag) not in {"item", "entry"}:
            continue
        title = xml_child_text(element, {"title"})
        summary = xml_child_text(
            element,
            {"description", "summary", "content", "encoded"},
        )
        published = xml_child_text(
            element,
            {"pubdate", "published", "updated", "date"},
        )
        item_id = xml_child_text(element, {"guid", "id"})
        link = ""
        for child in element.iter():
            if xml_local_name(child.tag) != "link":
                continue
            href = child.attrib.get("href", "").strip()
            rel = child.attrib.get("rel", "alternate").lower()
            if href and rel in {"alternate", ""}:
                link = href
                break
            if child.text and child.text.strip():
                link = child.text.strip()
                break
        items.append(
            {
                "id": item_id,
                "title": title,
                "summary": summary,
                "published": published,
                "url": link,
            }
        )
        if len(items) >= MAX_ITEMS_PER_SOURCE:
            break
    return items
# ------------------------------------------------------------
# NORMALIZATION
# ------------------------------------------------------------
def normalize_link(value: Any, base_url: str) -> str:
    """Resolve and validate an item's optional link."""
    if not isinstance(value, str) or not value.strip():
        return ""
    value = value.strip()
    if len(value) > MAX_URL_LENGTH:
        return ""
    absolute = urllib.parse.urljoin(base_url, value)
    try:
        parsed = urllib.parse.urlsplit(absolute)
    except ValueError:
        return ""
    if parsed.scheme.lower() not in {"http", "https"}:
        return ""
    if not parsed.hostname or parsed.username or parsed.password:
        return ""
    if parsed.scheme.lower() == "https":
        try:
            validate_https_url(absolute)
        except ValueError:
            return ""
    return absolute
def first_value(record: dict[str, Any], keys: tuple[str, ...]) -> Any:
    """Find the first non-empty field in a record."""
    for key in keys:
        value = record.get(key)
        if value is not None and str(value).strip():
            return value
    return ""
def normalize_record(
    record: dict[str, Any],
    source: dict[str, Any],
    source_url: str,
    default_category: str,
) -> dict[str, Any] | None:
    """Convert a source record into the MedOrbits feed schema."""
    title = clean_text(
        first_value(record, ("title", "headline", "name", "subject")),
        MAX_TITLE_LENGTH,
    )
    summary = clean_text(
        first_value(
            record,
            ("summary", "description", "message", "content", "body"),
        ),
        MAX_SUMMARY_LENGTH,
    )
    if not title:
        title = summary[:MAX_TITLE_LENGTH]
    if not title:
        return None
    raw_id = first_value(
        record,
        ("id", "guid", "uuid", "notification_id", "slug"),
    )
    if raw_id:
        item_id = clean_text(raw_id, MAX_ID_LENGTH)
    else:
        identity = "|".join(
            (
                str(source.get("name", "")),
                title,
                summary,
                str(first_value(record, ("published", "date", "created_at"))),
            )
        )
        item_id = hashlib.sha256(
            identity.encode("utf-8")
        ).hexdigest()[:24]
    raw_url = first_value(
        record,
        ("url", "link", "href", "source_url"),
    )
    link = normalize_link(raw_url, source_url)
    category = clean_text(
        record.get("category") or default_category,
        80,
    ).lower()
    published = clean_text(
        first_value(
            record,
            ("published", "pubDate", "date", "created_at", "updated"),
        ),
        100,
    )
    return {
        "id": item_id,
        "title": title,
        "summary": summary,
        "url": link,
        "category": category or "announcement",
        "source": clean_text(source.get("name", "External source"), 120),
        "publishedAt": published,
        "fetchedAt": utc_now(),
    }
def normalize_source_records(
    records: list[dict[str, Any]],
    source: dict[str, Any],
    source_url: str,
) -> list[dict[str, Any]]:
    """Normalize and deduplicate records from a single source."""
    default_category = str(
        source.get("category", "announcement")
    )
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    for record in records[:MAX_ITEMS_PER_SOURCE]:
        item = normalize_record(
            record=record,
            source=source,
            source_url=source_url,
            default_category=default_category,
        )
        if item is None:
            continue
        dedupe_key = item["id"].strip().lower()
        if not dedupe_key or dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        normalized.append(item)
    return normalized
# ------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------
def load_config(path: Path) -> dict[str, Any]:
    """Load and validate the source configuration."""
    config = load_json_file(path)
    if not isinstance(config, dict):
        raise ValueError("Configuration must be a JSON object.")
    allowed_hosts = config.get("allowed_hosts", [])
    sources = config.get("sources", [])
    if not isinstance(allowed_hosts, list):
        raise ValueError("'allowed_hosts' must be a list.")
    if not isinstance(sources, list):
        raise ValueError("'sources' must be a list.")
    cleaned_hosts = []
    for host in allowed_hosts:
        if not isinstance(host, str):
            raise ValueError("Each allowed_hosts entry must be a string.")
        host = host.strip().lower()
        if not host or host.startswith("YOUR-"):
            continue
        cleaned_hosts.append(host)
    if not cleaned_hosts:
        raise ValueError(
            "No real trusted hosts are configured. "
            "Edit allowed_hosts in the source configuration."
        )
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise ValueError(f"Source #{index + 1} must be an object.")
        if not isinstance(source.get("enabled", False), bool):
            raise ValueError(
                f"Source #{index + 1}: 'enabled' must be true or false."
            )
    return {
        "allowed_hosts": cleaned_hosts,
        "sources": sources,
    }
# ------------------------------------------------------------
# FEED GENERATION
# ------------------------------------------------------------
def fetch_source(
    source: dict[str, Any],
    allowed_hosts: list[str],
    timeout: int,
) -> list[dict[str, Any]]:
    """Download and parse one configured source."""
    name = str(source.get("name", "Unnamed source"))
    url = source.get("url")
    if not isinstance(url, str) or not url.strip():
        raise ValueError(f"{name}: source URL is missing.")
    source_url = validate_source_url(url, allowed_hosts)
    data, final_url, content_type = download_url(
        source_url,
        allowed_hosts,
        timeout,
    )
    format_name = str(source.get("format", "auto")).lower().strip()
    if format_name == "auto":
        path = urllib.parse.urlsplit(final_url).path.lower()
        if path.endswith((".rss", ".xml", ".atom")):
            format_name = "xml"
        elif "xml" in content_type or "rss" in content_type or "atom" in content_type:
            format_name = "xml"
        else:
            format_name = "json"
    if format_name == "json":
        records = parse_json_items(data)
    elif format_name in {"xml", "rss", "atom"}:
        records = parse_xml_items(data)
    else:
        raise ValueError(
            f"{name}: unsupported format '{format_name}'. "
            "Use json, xml, rss, atom, or auto."
        )
    return normalize_source_records(
        records=records,
        source=source,
        source_url=final_url,
    )
def create_feed(
    config: dict[str, Any],
    timeout: int,
) -> tuple[dict[str, Any], list[str]]:
    """Fetch all enabled sources and construct the feed."""
    all_items: list[dict[str, Any]] = []
    errors: list[str] = []
    seen_ids: set[str] = set()
    successful_sources = 0
    enabled_sources = 0
    for source in config["sources"]:
        if not source.get("enabled", False):
            continue
        enabled_sources += 1
        name = str(source.get("name", "Unnamed source"))
        try:
            records = fetch_source(
                source=source,
                allowed_hosts=config["allowed_hosts"],
                timeout=timeout,
            )
            successful_sources += 1
            for item in records:
                item_id = item["id"].lower()
                if item_id in seen_ids:
                    continue
                seen_ids.add(item_id)
                all_items.append(item)
                if len(all_items) >= MAX_TOTAL_ITEMS:
                    break
            print(
                f"[OK] {name}: imported {len(records)} item(s).",
                file=sys.stderr,
            )
        except Exception as exc:
            message = f"{name}: {type(exc).__name__}: {exc}"
            errors.append(message)
            print(f"[ERROR] {message}", file=sys.stderr)
        if len(all_items) >= MAX_TOTAL_ITEMS:
            break
    feed = {
        "metadata": {
            "schemaVersion": "1.0.0",
            "dataset": "medorbits-live-notifications",
            "generatedAt": utc_now(),
            "totalItems": len(all_items),
            "enabledSources": enabled_sources,
            "successfulSources": successful_sources,
            "verificationPolicy": (
                "Verify important announcements with the original "
                "publishing organization before acting on them."
            ),
        },
        "notifications": all_items,
    }
    return feed, errors
# ------------------------------------------------------------
# SAFE OUTPUT
# ------------------------------------------------------------
def write_json_atomic(
    output_path: Path,
    payload: dict[str, Any],
    overwrite: bool,
) -> None:
    """Write JSON atomically, refusing an existing file unless requested."""
    output_path = output_path.resolve()
    if output_path == DEFAULT_CONFIG.resolve():
        raise ValueError(
            "Output path cannot be the source configuration file."
        )
    safe_filename_parent(output_path)
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"Output already exists: {output_path}. "
            "Use --overwrite to replace it."
        )
    temporary_path = output_path.with_name(
        output_path.name + ".tmp"
    )
    try:
        with temporary_path.open("w", encoding="utf-8", newline="\n") as file:
            json.dump(
                payload,
                file,
                ensure_ascii=False,
                indent=2,
            )
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        if output_path.exists() and not overwrite:
            raise FileExistsError(
                f"Output already exists: {output_path}."
            )
        os.replace(temporary_path, output_path)
    finally:
        try:
            if temporary_path.exists():
                temporary_path.unlink()
        except OSError:
            pass
# ------------------------------------------------------------
# COMMAND LINE
# ------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Download trusted MedOrbits live notification feeds."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(
            os.environ.get("MEDORBITS_LIVE_CONFIG", str(DEFAULT_CONFIG))
        ),
        help="Path to live-source-import.json.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(
            os.environ.get("MEDORBITS_LIVE_OUTPUT", str(DEFAULT_OUTPUT))
        ),
        help="Destination JSON feed path.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help="Network timeout in seconds.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print generated JSON without writing a file.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing an existing output file.",
    )
    return parser.parse_args()
def main() -> int:
    args = parse_args()
    if args.timeout < 1 or args.timeout > 120:
        print(
            "[ERROR] Timeout must be between 1 and 120 seconds.",
            file=sys.stderr,
        )
        return 2
    try:
        config_path = args.config.expanduser().resolve()
        output_path = args.output.expanduser().resolve()
        config = load_config(config_path)
        if config_path == output_path:
            raise ValueError(
                "Configuration and output paths must be different."
            )
        enabled_sources = [
            source
            for source in config["sources"]
            if source.get("enabled", False)
        ]
        if not enabled_sources:
            raise ValueError(
                "No sources are enabled. Set 'enabled': true for a "
                "configured source after replacing its placeholder URL."
            )
        feed, errors = create_feed(
            config=config,
            timeout=args.timeout,
        )
        if args.dry_run:
            print(
                json.dumps(
                    feed,
                    ensure_ascii=False,
                    indent=2,
                )
            )
        else:
            write_json_atomic(
                output_path=output_path,
                payload=feed,
                overwrite=args.overwrite,
            )
            print(
                f"[OK] Feed saved to: {output_path}",
                file=sys.stderr,
            )
            print(
                f"[OK] Total notifications: "
                f"{feed['metadata']['totalItems']}",
                file=sys.stderr,
            )
        # Signal partial failure when at least one source failed.
        if errors:
            print(
                f"[WARNING] {len(errors)} source(s) failed.",
                file=sys.stderr,
            )
            return 1
        return 0
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 2
if __name__ == "__main__":
    raise SystemExit(main())