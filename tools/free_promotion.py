
#!/usr/bin/env python3
"""
MedOrbits Free Website Promotion Assistant
Python 3.10+ | Standard library only

Features:
- Audits local HTML pages for basic SEO issues.
- Checks for sitemap.xml and robots.txt.
- Generates promotional drafts for social platforms.
- Creates a free-promotion checklist.
- Creates a suggested sitemap from local HTML pages.
- Optionally checks the live website with --check-live.
- Does not publish content, send messages, create accounts, or buy ads.
- Does not modify existing website pages.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import time

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


DEFAULT_SITE = "https://www.medorbits.in"
VERSION = "1.0.0"

EXCLUDED_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build",
    "coverage", "__pycache__", ".venv", "venv",
    "repository-reports", "duplicate-quarantine",
}

HTML_EXTENSIONS = {".html", ".htm"}

MAX_FILE_BYTES = 2_000_000
MAX_LIVE_PAGES = 30
USER_AGENT = "MedOrbitsFreePromotionAuditor/1.0"


class SEOParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts = []
        self.title_open = False
        self.description = ""
        self.canonical = ""
        self.robots = ""
        self.h1_count = 0
        self.h1_open = False
        self.h1_parts = []
        self.h1_texts = []
        self.links = []
        self.images_without_alt = 0
        self.og_title = ""
        self.og_description = ""
        self.og_image = ""
        self.lang = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        tag = tag.lower()

        if tag == "html":
            self.lang = attrs.get("lang", "")

        if tag == "title":
            self.title_open = True

        if tag == "h1":
            self.h1_count += 1
            self.h1_open = True
            self.h1_parts = []

        if tag == "img" and not attrs.get("alt", "").strip():
            self.images_without_alt += 1

        if tag == "a":
            href = attrs.get("href", "").strip()
            if href:
                self.links.append(href)

        if tag == "meta":
            name = attrs.get("name", "").lower()
            prop = attrs.get("property", "").lower()
            content = attrs.get("content", "").strip()

            if name == "description":
                self.description = content
            elif name == "robots":
                self.robots = content
            elif prop == "og:title":
                self.og_title = content
            elif prop == "og:description":
                self.og_description = content
            elif prop == "og:image":
                self.og_image = content

        if tag == "link":
            if attrs.get("rel", "").lower() == "canonical":
                self.canonical = attrs.get("href", "").strip()

    def handle_endtag(self, tag):
        tag = tag.lower()

        if tag == "title":
            self.title_open = False

        if tag == "h1" and self.h1_open:
            self.h1_texts.append(" ".join(self.h1_parts).strip())
            self.h1_open = False

    def handle_data(self, data):
        if self.title_open:
            self.title_parts.append(data.strip())

        if self.h1_open:
            self.h1_parts.append(data.strip())

    @property
    def title(self):
        return " ".join(part for part in self.title_parts if part).strip()


def relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def scan_html(root: Path) -> list[Path]:
    pages = []

    for current, dirs, filenames in __import__("os").walk(
        root, followlinks=False
    ):
        dirs[:] = [
            name for name in dirs
            if name not in EXCLUDED_DIRS and not name.startswith(".")
        ]

        for filename in filenames:
            path = Path(current) / filename

            if path.is_symlink():
                continue

            if path.suffix.lower() in HTML_EXTENSIONS:
                try:
                    if path.stat().st_size <= MAX_FILE_BYTES:
                        pages.append(path)
                except OSError:
                    pass

    return sorted(pages, key=lambda p: relative(p, root).lower())


def read_page(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        return None


def page_url(site: str, path: Path, root: Path) -> str:
    rel_path = relative(path, root)

    if rel_path.endswith(("index.html", "index.htm")):
        directory = rel_path.rsplit("/", 1)[0] if "/" in rel_path else ""
        route = f"{directory}/" if directory else "/"
    else:
        route = "/" + rel_path

    return site.rstrip("/") + route


def audit_page(path: Path, root: Path) -> dict:
    text = read_page(path)

    result = {
        "path": relative(path, root),
        "title": "",
        "title_length": 0,
        "meta_description_length": 0,
        "h1_count": 0,
        "h1_texts": [],
        "images_without_alt": 0,
        "lang": "",
        "canonical": "",
        "robots_meta": "",
        "og_title": "",
        "og_description": "",
        "og_image": "",
        "internal_link_count": 0,
        "issues": [],
    }

    if text is None:
        result["issues"].append("File could not be read as UTF-8.")
        return result

    parser = SEOParser()

    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:
        result["issues"].append(f"HTML parsing warning: {exc}")
        return result

    result.update({
        "title": parser.title,
        "title_length": len(parser.title),
        "meta_description_length": len(parser.description),
        "h1_count": parser.h1_count,
        "h1_texts": parser.h1_texts,
        "images_without_alt": parser.images_without_alt,
        "lang": parser.lang,
        "canonical": parser.canonical,
        "robots_meta": parser.robots,
        "og_title": parser.og_title,
        "og_description": parser.og_description,
        "og_image": parser.og_image,
        "internal_link_count": len(parser.links),
    })

    if not parser.title:
        result["issues"].append("Missing title element.")
    elif len(parser.title) > 70:
        result["issues"].append("Title is long; review its clarity in search results.")

    if not parser.description:
        result["issues"].append("Missing meta description.")
    elif len(parser.description) < 70:
        result["issues"].append("Meta description may be too short.")
    elif len(parser.description) > 170:
        result["issues"].append("Meta description may be too long.")

    if parser.h1_count == 0:
        result["issues"].append("No H1 heading found.")
    elif parser.h1_count > 1:
        result["issues"].append("Multiple H1 headings; review heading structure.")

    if not parser.lang:
        result["issues"].append("Missing HTML language attribute.")

    if parser.images_without_alt:
        result["issues"].append(
            f"{parser.images_without_alt} images have no descriptive alt text."
        )

    if not parser.og_title:
        result["issues"].append("Missing Open Graph title for social sharing.")

    if not parser.og_description:
        result["issues"].append("Missing Open Graph description.")

    if not parser.og_image:
        result["issues"].append("Missing Open Graph preview image.")

    return result


def make_sitemap(site: str, pages: list[Path], root: Path) -> str:
    urls = []

    for page in pages:
        url = page_url(site, page, root)
        urls.append(
            "  <url>\n"
            f"    <loc>{html.escape(url)}</loc>\n"
            "  </url>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def promotion_drafts(site: str) -> dict:
    return {
        "brand": "MedOrbits",
        "website": site,
        "disclaimer": (
            "Review all facts, links, and claims before publishing. "
            "Do not promise admission, employment, scholarships, or outcomes."
        ),
        "linkedin": (
            "Explore MedOrbits for education guidance, admissions resources, "
            "career information, and recruitment support.\n\n"
            f"Visit: {site}\n\n"
            "#Education #CareerGuidance #Admissions #MedOrbits"
        ),
        "instagram": (
            "Planning your next education or career step? 🎓\n\n"
            "Explore education resources, admissions guidance, and career "
            f"information with MedOrbits.\n\n{site}\n\n"
            "#MedOrbits #Education #Admissions #CareerGuidance"
        ),
        "facebook": (
            "Discover education, admissions, and career resources with "
            "MedOrbits. Explore our website and share it with someone who "
            f"may find these resources useful.\n\n{site}"
        ),
        "whatsapp": (
            "MedOrbits offers education resources, admissions information, "
            "and career guidance. Explore the website here: "
            f"{site}\n\nPlease share only with people who may find it useful."
        ),
        "short_directory_description": (
            "MedOrbits provides education resources, admissions information, "
            "career guidance, and recruitment-related services."
        ),
        "long_directory_description": (
            "MedOrbits is an online resource for education information, "
            "admissions guidance, career resources, and recruitment-related "
            "services. Visitors should verify eligibility, deadlines, fees, "
            "and official admission or employment requirements with the "
            "relevant institutions and authorities."
        ),
        "content_ideas": [
            "A practical checklist for preparing education application documents.",
            "How to verify admissions deadlines using official sources.",
            "Questions to ask before selecting a college or course.",
            "How to prepare a CV for entry-level opportunities.",
            "A guide to identifying recruitment scams and fake job offers.",
        ],
    }


def free_promotion_checklist(site: str) -> list[dict]:
    return [
        {
            "task": "Verify ownership in Google Search Console",
            "url": "https://search.google.com/search-console/",
            "action": "Verify the domain and submit the sitemap.",
        },
        {
            "task": "Submit sitemap to Bing Webmaster Tools",
            "url": "https://www.bing.com/webmasters/",
            "action": "Verify ownership and submit the valid sitemap.",
        },
        {
            "task": "Check Google Business Profile eligibility",
            "url": "https://www.google.com/business/",
            "action": (
                "Create a profile only if the business meets Google's "
                "eligibility rules. Do not invent a business address."
            ),
        },
        {
            "task": "Publish useful educational articles",
            "url": site,
            "action": (
                "Publish original, accurate articles with references to "
                "official sources and useful internal links."
            ),
        },
        {
            "task": "Share useful content on social media",
            "url": site,
            "action": (
                "Share relevant articles at a reasonable frequency. "
                "Avoid repetitive mass posting or unsolicited messages."
            ),
        },
        {
            "task": "Use legitimate business directories",
            "url": site,
            "action": (
                "Submit accurate business information only to reputable "
                "directories that permit your business category."
            ),
        },
        {
            "task": "Improve page performance and mobile usability",
            "url": "https://pagespeed.web.dev/",
            "action": "Review mobile performance, accessibility, and page speed.",
        },
        {
            "task": "Check indexing and robots rules",
            "url": site + "/robots.txt",
            "action": "Confirm important pages are crawlable and not blocked.",
        },
    ]


def check_live_url(url: str) -> dict:
    request = Request(
        url,
        headers={"User-Agent": USER_AGENT},
        method="GET",
    )

    try:
        with urlopen(request, timeout=12) as response:
            return {
                "url": url,
                "status": response.status,
                "final_url": response.geturl(),
                "content_type": response.headers.get("Content-Type", ""),
                "result": "reachable",
            }
    except HTTPError as exc:
        return {
            "url": url,
            "status": exc.code,
            "result": "http-error",
        }
    except (URLError, TimeoutError, OSError) as exc:
        return {
            "url": url,
            "result": "connection-error",
            "message": str(exc),
        }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prepare safe, free MedOrbits promotion resources."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Local repository root.",
    )

    parser.add_argument(
        "--site",
        default=DEFAULT_SITE,
        help="Canonical public website URL.",
    )

    parser.add_argument(
        "--check-live",
        action="store_true",
        help="Make limited GET requests to the site and key public endpoints.",
    )

    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    site_parts = urlparse(args.site)

    if not root.is_dir():
        print(f"ERROR: Repository directory not found: {root}")
        return 2

    if site_parts.scheme != "https" or not site_parts.netloc:
        print("ERROR: --site must be a valid HTTPS URL.")
        return 2

    site = args.site.rstrip("/")
    pages = scan_html(root)

    report_dir = root / "tools" / "repository-reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    audits = [audit_page(page, root) for page in pages]

    local_robots = root / "robots.txt"
    local_sitemap = root / "sitemap.xml"

    report = {
        "tool": "MedOrbits Free Promotion Assistant",
        "version": VERSION,
        "created_at_epoch": int(time.time()),
        "site": site,
        "local_html_pages": len(pages),
        "seo_audit": audits,
        "local_files": {
            "robots_txt_exists": local_robots.is_file(),
            "sitemap_xml_exists": local_sitemap.is_file(),
        },
        "promotion_drafts": promotion_drafts(site),
        "free_promotion_checklist": free_promotion_checklist(site),
        "live_checks": [],
        "safety": {
            "published_automatically": False,
            "sent_messages": False,
            "created_accounts": False,
            "paid_advertising": False,
            "modified_existing_html": False,
        },
    }

    # Generate a proposed sitemap as a separate report.
    # It is not automatically written to the website root.
    proposed_sitemap = make_sitemap(site, pages, root)

    (report_dir / "proposed-sitemap.xml").write_text(
        proposed_sitemap,
        encoding="utf-8",
    )

    if args.check_live:
        endpoints = [
            site + "/",
            site + "/robots.txt",
            site + "/sitemap.xml",
        ]

        for endpoint in endpoints[:MAX_LIVE_PAGES]:
            report["live_checks"].append(check_live_url(endpoint))

    report_path = report_dir / "free-promotion-report.json"

    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print("MedOrbits Free Promotion Assistant")
    print(f"Website: {site}")
    print(f"HTML pages audited: {len(pages)}")
    print(f"SEO pages with findings: {sum(bool(p['issues']) for p in audits)}")
    print(f"Report: {report_path.relative_to(root).as_posix()}")
    print(
        "Sitemap proposal: "
        "tools/repository-reports/proposed-sitemap.xml"
    )
    print("No content was published and no messages were sent.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
