Updated /python/scripts/download_required.py

Replace the previous script with this version. The domain allowlist is now optional; when omitted, the downloader accepts public internet hosts while blocking non-public IP destinations and validating redirects.

#!/usr/bin/env python3
"""
MedOrbits Required Asset Downloader
===================================
Python 3.12+ | Standard library only.
Downloads publicly accessible files from JSON manifests or URL lists.
Features:
- Public internet downloads without a predefined domain allowlist.
- HTTPS by default; optional HTTP.
- Redirect validation.
- Private, loopback, link-local and reserved IP blocking.
- Optional domain allowlist.
- SHA-256 verification.
- Retry and timeout controls.
- File-size limits.
- Safe relative destination paths.
- Duplicate URL and content detection.
- Atomic downloads.
- Dry-run mode.
- JSON reporting.
Exit codes:
    0 = All downloads succeeded or were skipped safely.
    1 = One or more downloads failed.
    2 = Invalid configuration or manifest.
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
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import (
    HTTPRedirectHandler,
    Request,
    build_opener,
)
VERSION = "2.0.0"
USER_AGENT = "MedOrbits-AssetDownloader/2.0"
DEFAULT_TIMEOUT = 20.0
DEFAULT_RETRIES = 3
DEFAULT_MAX_SIZE_MB = 50.0
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download publicly accessible MedOrbits assets."
    )
    parser.add_argument(
        "manifest",
        type=Path,
        help="JSON manifest or text file containing URLs.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("downloads/required"),
        help="Output directory.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional JSON report path.",
    )
    parser.add_argument(
        "--allow-domain",
        action="append",
        default=[],
        help="Optional hostname allowlist; repeat for multiple domains.",
    )
    parser.add_argument(
        "--allow-http",
        action="store_true",
        help="Allow HTTP as well as HTTPS.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing files after successful verification.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate URLs and destinations without downloading.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help="Network timeout in seconds.",
    )
    parser.add_argument(
        "--retries",
        type=int,
        default=DEFAULT_RETRIES,
        help="Number of retries after transient failures.",
    )
    parser.add_argument(
        "--max-size-mb",
        type=float,
        default=DEFAULT_MAX_SIZE_MB,
        help="Maximum download size per file in MB.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero.")
    if args.retries < 0:
        parser.error("--retries cannot be negative.")
    if args.max_size_mb <= 0:
        parser.error("--max-size-mb must be greater than zero.")
    return args
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
def normalize_host(host: str) -> str:
    return host.strip().lower().rstrip(".")
def host_is_allowed(host: str, domains: set[str]) -> bool:
    host = normalize_host(host)
    return any(
        host == domain or host.endswith("." + domain)
        for domain in domains
    )
def is_public_ip(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False
    return ip.is_global
def validate_public_host(host: str) -> tuple[bool, str]:
    """Reject hosts that resolve to non-public IP addresses."""
    try:
        literal_ip = ipaddress.ip_address(host)
        addresses = {str(literal_ip)}
    except ValueError:
        try:
            results = socket.getaddrinfo(
                host,
                None,
                type=socket.SOCK_STREAM,
            )
            addresses = {
                result[4][0].split("%", 1)[0]
                for result in results
            }
        except (OSError, socket.gaierror) as exc:
            return False, f"Hostname resolution failed: {exc}"
    if not addresses:
        return False, "Hostname did not resolve to an IP address."
    non_public = [
        address for address in addresses
        if not is_public_ip(address)
    ]
    if non_public:
        return False, (
            "Hostname resolves to a non-public IP address: "
            + ", ".join(sorted(non_public))
        )
    return True, "Public host validated."
def validate_url(
    url: str,
    allow_http: bool,
    allowed_domains: set[str],
) -> tuple[bool, str]:
    try:
        parsed = urlsplit(url.strip())
    except ValueError as exc:
        return False, f"Malformed URL: {exc}"
    allowed_schemes = {"https"}
    if allow_http:
        allowed_schemes.add("http")
    scheme = parsed.scheme.lower()
    if scheme not in allowed_schemes:
        return False, (
            f"Unsupported URL scheme {scheme!r}; allowed schemes: "
            + ", ".join(sorted(allowed_schemes))
        )
    if not parsed.hostname:
        return False, "URL is missing a hostname."
    if parsed.username is not None or parsed.password is not None:
        return False, "URLs containing embedded credentials are not allowed."
    try:
        port = parsed.port
    except ValueError:
        return False, "URL contains an invalid port."
    if port is not None and not 1 <= port <= 65535:
        return False, "URL port is invalid."
    host = normalize_host(parsed.hostname)
    if allowed_domains and not host_is_allowed(host, allowed_domains):
        return False, f"Host is not in the domain allowlist: {host}"
    valid, message = validate_public_host(host)
    if not valid:
        return False, message
    return True, "URL validated."
class SafeRedirectHandler(HTTPRedirectHandler):
    """Validate every redirect before following it."""
    def __init__(
        self,
        allow_http: bool,
        allowed_domains: set[str],
    ) -> None:
        super().__init__()
        self.allow_http = allow_http
        self.allowed_domains = allowed_domains
    def redirect_request(
        self,
        request: Request,
        response: Any,
        code: int,
        message: str,
        headers: Any,
        new_url: str,
    ) -> Request | None:
        target = urljoin(request.full_url, new_url)
        valid, reason = validate_url(
            target,
            self.allow_http,
            self.allowed_domains,
        )
        if not valid:
            raise URLError(f"Redirect rejected: {reason}")
        return super().redirect_request(
            request,
            response,
            code,
            message,
            headers,
            target,
        )
def make_opener(
    allow_http: bool,
    allowed_domains: set[str],
):
    return build_opener(
        SafeRedirectHandler(allow_http, allowed_domains)
    )
def load_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"Manifest not found: {path}")
    text = path.read_text(encoding="utf-8-sig")
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        entries = []
        for line_number, line in enumerate(text.splitlines(), start=1):
            url = line.strip()
            if url and not url.startswith("#"):
                entries.append({
                    "url": url,
                    "path": None,
                    "sha256": None,
                    "_line": line_number,
                })
        if not entries:
            raise ValueError("No URLs found in the manifest.")
        return entries
    if isinstance(data, dict):
        data = data.get("files")
    if not isinstance(data, list):
        raise ValueError(
            "JSON manifest must be an array or contain a 'files' array."
        )
    entries = []
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Entry {index} must be an object.")
        url = item.get("url")
        destination = item.get("path")
        checksum = item.get("sha256")
        if not isinstance(url, str) or not url.strip():
            raise ValueError(f"Entry {index} requires a URL.")
        if destination is not None and (
            not isinstance(destination, str) or not destination.strip()
        ):
            raise ValueError(f"Entry {index} has an invalid path.")
        if checksum is not None and (
            not isinstance(checksum, str)
            or not re.fullmatch(r"[a-fA-F0-9]{64}", checksum)
        ):
            raise ValueError(f"Entry {index} has an invalid SHA-256 checksum.")
        entries.append({
            "url": url.strip(),
            "path": destination,
            "sha256": checksum.lower() if checksum else None,
            "_line": index,
        })
    if not entries:
        raise ValueError("Manifest contains no entries.")
    return entries
def safe_destination(
    root: Path,
    requested_path: str | None,
    url: str,
) -> Path:
    if requested_path:
        relative = Path(requested_path)
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("Absolute paths and '..' are not allowed.")
        if not relative.parts:
            raise ValueError("Destination path cannot be empty.")
        candidate = root / relative
    else:
        filename = Path(unquote(urlsplit(url).path)).name
        if not filename or filename in {".", ".."}:
            raise ValueError(
                "URL has no filename; specify a destination 'path'."
            )
        candidate = root / filename
    resolved_root = root.resolve()
    resolved = candidate.resolve()
    if resolved == resolved_root or resolved_root not in resolved.parents:
        raise ValueError("Destination must be inside the output directory.")
    return resolved
def download_once(
    url: str,
    destination: Path,
    checksum: str | None,
    args: argparse.Namespace,
    domains: set[str],
    max_bytes: int,
) -> dict[str, Any]:
    if destination.exists() and not args.overwrite:
        actual_hash = sha256_file(destination)
        if checksum and actual_hash != checksum:
            return {
                "status": "failed",
                "message": (
                    "Existing file failed SHA-256 verification. "
                    "Use --overwrite to replace it."
                ),
                "bytes": destination.stat().st_size,
                "sha256": actual_hash,
            }
        return {
            "status": "skipped",
            "message": "File already exists and passed available verification.",
            "bytes": destination.stat().st_size,
            "sha256": actual_hash,
        }
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
        },
    )
    opener = make_opener(args.allow_http, domains)
    temporary: Path | None = None
    try:
        with opener.open(request, timeout=args.timeout) as response:
            if not 200 <= response.status < 300:
                raise ValueError(f"Unexpected HTTP status: {response.status}")
            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    declared = int(content_length)
                except ValueError:
                    declared = None
                if declared is not None and declared > max_bytes:
                    raise ValueError("Remote file exceeds the size limit.")
            digest = hashlib.sha256()
            total = 0
            with tempfile.NamedTemporaryFile(
                mode="wb",
                prefix=".medorbits-",
                suffix=".tmp",
                dir=destination.parent,
                delete=False,
            ) as file:
                temporary = Path(file.name)
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValueError("Downloaded file exceeds the size limit.")
                    digest.update(chunk)
                    file.write(chunk)
                file.flush()
                os.fsync(file.fileno())
        actual_hash = digest.hexdigest()
        if total == 0:
            raise ValueError("Downloaded file is empty.")
        if checksum and actual_hash != checksum:
            raise ValueError("SHA-256 checksum mismatch.")
        # Avoid clobbering a file created during the download.
        if destination.exists() and not args.overwrite:
            raise FileExistsError(
                f"Destination appeared during download: {destination}"
            )
        temporary.replace(destination)
        temporary = None
        return {
            "status": "downloaded",
            "message": "Downloaded and verified successfully.",
            "bytes": total,
            "sha256": actual_hash,
        }
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
def download_with_retries(
    entry: dict[str, Any],
    destination: Path,
    args: argparse.Namespace,
    domains: set[str],
    max_bytes: int,
) -> dict[str, Any]:
    last_error = "Download failed."
    for attempt in range(args.retries + 1):
        try:
            return download_once(
                entry["url"],
                destination,
                entry.get("sha256"),
                args,
                domains,
                max_bytes,
            )
        except HTTPError as exc:
            last_error = f"HTTP {exc.code}: {exc.reason}"
            if exc.code < 500 and exc.code != 429:
                break
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            last_error = str(exc)
            if isinstance(exc, FileExistsError):
                break
        if attempt < args.retries:
            time.sleep(min(2 ** attempt, 8))
    return {
        "status": "failed",
        "message": last_error,
        "bytes": 0,
        "sha256": None,
    }
def write_report(path: Path, report: dict[str, Any]) -> None:
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        raise FileExistsError(f"Report already exists: {path}")
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as file:
            json.dump(report, file, indent=2, ensure_ascii=False)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
            temporary = Path(file.name)
        if path.exists():
            raise FileExistsError(f"Report already exists: {path}")
        temporary.replace(path)
        temporary = None
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
def main() -> int:
    args = parse_args()
    manifest = args.manifest.expanduser().resolve()
    output = args.output.expanduser().resolve()
    report_path = args.report.expanduser().resolve() if args.report else None
    if report_path == manifest:
        print("ERROR: Report cannot overwrite the manifest.", file=sys.stderr)
        return 2
    domains = {
        normalize_host(item)
        for item in args.allow_domain
        if item.strip()
    }
    try:
        entries = load_manifest(manifest)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    max_bytes = int(args.max_size_mb * 1024 * 1024)
    results = []
    downloaded = 0
    skipped = 0
    failed = 0
    seen_urls: set[str] = set()
    seen_destinations: set[Path] = set()
    print("MedOrbits Required Asset Downloader")
    print(f"Entries: {len(entries)}")
    print(f"Output: {output}")
    print("Allowed hosts: explicit allowlist" if domains else "Allowed hosts: public internet")
    print(f"Dry run: {'yes' if args.dry_run else 'no'}")
    print()
    for entry in entries:
        url = entry["url"]
        item = {
            "url": url,
            "destination": None,
            "status": "failed",
            "message": "",
            "bytes": 0,
            "sha256": None,
        }
        if url in seen_urls:
            item["status"] = "skipped"
            item["message"] = "Duplicate URL in manifest."
            skipped += 1
            results.append(item)
            print(f"[SKIP] Duplicate URL: {url}")
            continue
        seen_urls.add(url)
        valid, message = validate_url(url, args.allow_http, domains)
        if not valid:
            item["message"] = message
            failed += 1
            results.append(item)
            print(f"[ERROR] {url}: {message}")
            continue
        try:
            destination = safe_destination(output, entry.get("path"), url)
            item["destination"] = str(destination)
            if destination == manifest:
                raise ValueError("Download cannot overwrite the manifest.")
            if report_path and destination == report_path:
                raise ValueError("Download cannot overwrite the report.")
            if destination in seen_destinations:
                raise ValueError("Multiple manifest entries target the same file.")
            seen_destinations.add(destination)
            if args.dry_run:
                item["status"] = "planned"
                item["message"] = "URL and destination validated."
                downloaded += 1
                print(f"[PLAN] {url} -> {destination}")
            else:
                result = download_with_retries(
                    entry,
                    destination,
                    args,
                    domains,
                    max_bytes,
                )
                item.update(result)
                if result["status"] == "downloaded":
                    downloaded += 1
                    print(f"[OK] {url} -> {destination}")
                elif result["status"] == "skipped":
                    skipped += 1
                    print(f"[SKIP] {destination}")
                else:
                    failed += 1
                    print(f"[ERROR] {url}: {result['message']}")
        except (OSError, ValueError) as exc:
            item["message"] = str(exc)
            failed += 1
            print(f"[ERROR] {url}: {exc}")
        results.append(item)
    report = {
        "metadata": {
            "tool": "MedOrbits Required Asset Downloader",
            "version": VERSION,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "manifest": str(manifest),
            "outputDirectory": str(output),
            "dryRun": args.dry_run,
        },
        "summary": {
            "total": len(entries),
            "downloadedOrPlanned": downloaded,
            "skipped": skipped,
            "failed": failed,
        },
        "results": results,
    }
    if report_path:
        try:
            if not args.dry_run:
                write_report(report_path, report)
            print(f"\nReport: {report_path}")
        except (OSError, ValueError) as exc:
            failed += 1
            print(f"[ERROR] Report could not be written: {exc}")
    print("\nSummary")
    print(f"Downloaded/planned: {downloaded}")
    print(f"Skipped:            {skipped}")
    print(f"Failed:             {failed}")
    return 1 if failed else 0
if __name__ == "__main__":
    raise SystemExit(main())

Usage

1. Download from any publicly accessible HTTPS host

python python/scripts/download_required.py \
  python/data/required-assets.json \
  --output assets

2. Download from any public host, allowing HTTP too

python python/scripts/download_required.py \
  python/data/required-assets.json \
  --output assets \
  --allow-http

3. Preview without downloading

python python/scripts/download_required.py \
  python/data/required-assets.json \
  --output assets \
  --dry-run

4. Download with larger file limits and more retries

python python/scripts/download_required.py \
  python/data/required-assets.json \
  --output assets \
  --max-size-mb 200 \
  --timeout 45 \
  --retries 5

5. Restrict downloads to trusted domains when needed

python python/scripts/download_required.py \
  python/data/required-assets.json \
  --output assets \
  --allow-domain example.com \
  --allow-domain github.com

The downloader now accepts public hosts without requiring --allow-domain. DNS checks and redirect validation provide additional protections, but standard-library DNS validation cannot completely eliminate DNS-rebinding or network-level risks. Use this script only with trusted manifests, particularly in automated deployments.