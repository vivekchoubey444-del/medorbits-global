
#!/usr/bin/env python3
"""
MedOrbits Adaptive Repository Completer & Website Expander
==========================================================

Features
--------
1. Detects missing local HTML pages referenced by existing HTML files.
2. Discovers additional related MedOrbits topic pages from a page catalog.
3. Generates topic-specific starter pages with SEO metadata and breadcrumbs.
4. Creates a related-resources hub for newly discovered pages.
5. Detects empty and unusually small text files.
6. Detects broken local HTML links.
7. Identifies thin existing HTML pages.
8. Can create separate proposed upgrades without overwriting original pages.
9. Generates a JSON report.
10. Never executes repository code.

Safety
------
- Dry-run is the default.
- Never overwrites or deletes existing files.
- Missing pages are created with exclusive file creation.
- Existing page upgrades are written as separate .proposed.html files.
- Generated content is clearly marked for editorial review.
- Symlinks and paths outside the repository are rejected.
- Uses Python standard library only.

Usage
-----
Preview:
    python tools/complete_repository.py

Preview with related pages:
    python tools/complete_repository.py --expand-related

Create missing linked pages:
    python tools/complete_repository.py --apply

Expand the MedOrbits page catalog:
    python tools/complete_repository.py --expand-related --apply

Also prepare upgrade proposals for thin pages:
    python tools/complete_repository.py --expand-related --upgrade-thin --apply

Write a JSON report:
    python tools/complete_repository.py --expand-related --report

Limit page creation:
    python tools/complete_repository.py --expand-related --max-create 100 --apply

Choose repository:
    python tools/complete_repository.py --root . --expand-related --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


VERSION = "2.0.0"

IGNORED_DIRS = {
    ".git", ".next", ".nuxt", ".venv", "venv",
    "node_modules", "dist", "build", "coverage",
    "__pycache__", "vendor", ".repository-autofill-backups",
}

TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
    ".json", ".md", ".txt", ".xml", ".yaml", ".yml",
    ".py", ".sh", ".toml",
}

HTML_EXTENSIONS = {".html", ".htm"}

# Extend this catalog as MedOrbits grows.
# All generated pages contain starter copy, not verified admissions facts.
RELATED_PAGE_CATALOG = [
    {
        "path": "pages/medical-admissions.html",
        "title": "Medical Admissions Guide",
        "description": "Explore medical admissions pathways, eligibility, counselling and documentation.",
        "keywords": ["medical", "mbbs", "neet", "admission", "healthcare"],
    },
    {
        "path": "pages/mbbs-admission-guide.html",
        "title": "MBBS Admission Guide",
        "description": "Understand the MBBS admission process, eligibility and counselling stages.",
        "keywords": ["mbbs", "medical", "neet", "medicine"],
    },
    {
        "path": "pages/bds-admissions.html",
        "title": "BDS Admissions",
        "description": "Explore dental education pathways, eligibility and admission preparation.",
        "keywords": ["bds", "dental", "dentistry", "neet"],
    },
    {
        "path": "pages/bams-admissions.html",
        "title": "BAMS Admissions",
        "description": "Explore Ayurveda education pathways and admission preparation.",
        "keywords": ["bams", "ayurveda", "medical", "neet"],
    },
    {
        "path": "pages/paramedical-courses.html",
        "title": "Paramedical Courses",
        "description": "Compare paramedical study pathways and healthcare career options.",
        "keywords": ["paramedical", "healthcare", "courses", "career"],
    },
    {
        "path": "pages/college-finder.html",
        "title": "College Finder",
        "description": "Organize college searches by course, location and admission requirements.",
        "keywords": ["college", "university", "courses", "admission"],
    },
    {
        "path": "pages/college-comparison.html",
        "title": "College Comparison Guide",
        "description": "Compare colleges using verified fees, recognition, facilities and course information.",
        "keywords": ["college", "university", "comparison", "fees"],
    },
    {
        "path": "pages/fee-structure-guide.html",
        "title": "Fee Structure Guide",
        "description": "Review tuition, hostel, counselling and other education-related costs.",
        "keywords": ["fees", "fee", "cost", "college", "admission"],
    },
    {
        "path": "pages/scholarships.html",
        "title": "Scholarships and Financial Aid",
        "description": "Explore scholarship research, financial aid planning and application documents.",
        "keywords": ["scholarship", "financial", "funding", "student"],
    },
    {
        "path": "pages/admission-documents.html",
        "title": "Admission Documents Checklist",
        "description": "Prepare and verify common documents used during education admissions.",
        "keywords": ["documents", "certificate", "admission", "application"],
    },
    {
        "path": "pages/counselling-guide.html",
        "title": "Counselling Guide",
        "description": "Understand counselling workflows, choice filling and allotment stages.",
        "keywords": ["counselling", "counseling", "neet", "admission"],
    },
    {
        "path": "pages/study-abroad.html",
        "title": "Study Abroad Guide",
        "description": "Plan international education research, applications and documentation.",
        "keywords": ["abroad", "international", "overseas", "study"],
    },
    {
        "path": "pages/study-in-germany.html",
        "title": "Study in Germany",
        "description": "Research German education pathways, language preparation and application requirements.",
        "keywords": ["germany", "german", "abroad", "international"],
    },
    {
        "path": "pages/study-in-poland.html",
        "title": "Study in Poland",
        "description": "Research Polish universities, course options and international applications.",
        "keywords": ["poland", "abroad", "international", "university"],
    },
    {
        "path": "pages/career-guidance.html",
        "title": "Career Guidance",
        "description": "Explore career planning, skills development and education-to-employment pathways.",
        "keywords": ["career", "jobs", "employment", "guidance"],
    },
    {
        "path": "pages/jobs-and-apprenticeships.html",
        "title": "Jobs and Apprenticeships",
        "description": "Explore employment preparation, apprenticeships and career development resources.",
        "keywords": ["jobs", "job", "apprenticeship", "career", "recruitment"],
    },
    {
        "path": "pages/entrance-exams.html",
        "title": "Entrance Exam Guide",
        "description": "Organize exam eligibility, preparation resources and official exam notices.",
        "keywords": ["entrance", "exam", "neet", "test", "admission"],
    },
    {
        "path": "pages/online-consultation.html",
        "title": "Online Consultation",
        "description": "Learn how to prepare questions and documents for an education consultation.",
        "keywords": ["consultation", "consultancy", "guidance", "support"],
    },
    {
        "path": "pages/faqs.html",
        "title": "Frequently Asked Questions",
        "description": "Find answers to common education planning and application questions.",
        "keywords": ["faq", "faqs", "help", "support", "questions"],
    },
    {
        "path": "pages/contact.html",
        "title": "Contact MedOrbits",
        "description": "Find contact and support information for MedOrbits services.",
        "keywords": ["contact", "support", "help", "consultation"],
    },
]


class HTMLInspector(HTMLParser):
    """Extract links and basic document metadata."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []
        self.title_parts: list[str] = []
        self.headings: list[str] = []
        self.description = ""
        self.in_title = False
        self.in_heading = False
        self.heading_buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attributes = dict(attrs)
        tag = tag.lower()

        if tag == "a" and attributes.get("href"):
            self.links.append(attributes["href"])

        if tag == "title":
            self.in_title = True

        if tag == "meta" and attributes.get("name", "").lower() == "description":
            self.description = attributes.get("content", "")

        if tag in {"h1", "h2", "h3"}:
            self.in_heading = True
            self.heading_buffer = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()

        if tag == "title":
            self.in_title = False

        if tag in {"h1", "h2", "h3"} and self.in_heading:
            heading = " ".join(" ".join(self.heading_buffer).split())
            if heading:
                self.headings.append(heading)
            self.in_heading = False
            self.heading_buffer = []

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data.strip())

        if self.in_heading:
            self.heading_buffer.append(data.strip())


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def ignored(path: Path, root: Path) -> bool:
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return True
    return any(part in IGNORED_DIRS for part in parts)


def safe_path(root: Path, candidate: Path) -> Path | None:
    """Reject paths outside root and paths containing symlink components."""
    root = Path(os.path.abspath(root))
    candidate = Path(os.path.abspath(candidate))

    if not inside(candidate, root):
        return None

    current = root
    try:
        parts = candidate.relative_to(root).parts
    except ValueError:
        return None

    for part in parts:
        current = current / part
        if current.is_symlink():
            return None

    return candidate


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8-sig", errors="replace")
    except OSError:
        return ""


def inspect_html(path: Path) -> HTMLInspector:
    result = HTMLInspector()
    try:
        result.feed(read_text(path))
        result.close()
    except Exception:
        pass
    return result


def discover_files(root: Path) -> list[Path]:
    found: list[Path] = []

    for directory, dirs, filenames in os.walk(root, followlinks=False):
        current = Path(directory)
        dirs[:] = [
            name for name in dirs
            if name not in IGNORED_DIRS
            and not (current / name).is_symlink()
        ]

        for filename in filenames:
            path = current / filename
            if path.is_symlink() or ignored(path, root):
                continue
            if path.suffix.lower() in TEXT_EXTENSIONS:
                found.append(path)

    return sorted(found)


def page_title(path: Path, root: Path) -> str:
    parsed = inspect_html(path)
    title = " ".join(" ".join(parsed.title_parts).split())

    if title:
        return re.sub(r"\s*\|\s*MedOrbits\s*$", "", title, flags=re.I)

    name = path.stem.replace("-", " ").replace("_", " ").strip()
    if name.lower() == "index":
        name = path.parent.name.replace("-", " ").replace("_", " ")
    return name.title() or "MedOrbits Resource"


def nearest_index(
    target: Path,
    root: Path,
    indexes: list[Path],
) -> Path | None:
    for ancestor in [target.parent, *target.parent.parents]:
        if ancestor == root.parent:
            break

        for index in indexes:
            if index.parent == ancestor:
                return index

        if ancestor == root:
            break

    if not indexes:
        return None

    return min(
        indexes,
        key=lambda item: len(
            Path(os.path.relpath(target.parent, item.parent)).parts
        ),
    )


def local_html_target(source: Path, href: str, root: Path) -> Path | None:
    href = href.strip()

    if not href or href.startswith(("#", "?", "//")):
        return None

    parts = urlsplit(href)
    if parts.scheme or parts.netloc:
        return None

    decoded = unquote(parts.path)
    if not decoded:
        return None

    candidate = Path(decoded)

    if candidate.is_absolute():
        candidate = root / decoded.lstrip("/")
    else:
        candidate = source.parent / candidate

    if candidate.suffix.lower() not in HTML_EXTENSIONS:
        return None

    checked = safe_path(root, candidate)
    if checked is None or ignored(checked, root):
        return None

    return checked


def relative_href(source_dir: Path, destination: Path) -> str:
    href = os.path.relpath(destination, source_dir).replace(os.sep, "/")
    if not href.startswith("."):
        href = "./" + href
    return href


def matching_catalog_items(index: Path, root: Path) -> list[dict]:
    """Select related pages using index path, title, and existing page text."""
    title = page_title(index, root).lower()
    content = read_text(index).lower()
    context = f"{index.relative_to(root).as_posix().lower()} {title} {content[:20000]}"

    matches = []

    # The root landing page is a broad directory and can surface the full catalog.
    if index.parent == root:
        return RELATED_PAGE_CATALOG.copy()

    for item in RELATED_PAGE_CATALOG:
        score = sum(
            1 for keyword in item["keywords"]
            if keyword.lower() in context
        )
        if score >= 1:
            matches.append((score, item))

    matches.sort(key=lambda pair: (-pair[0], pair[1]["title"]))
    return [item for _, item in matches[:12]]


def make_page(target: Path, root: Path, index: Path | None) -> str:
    title = page_title(target, root)
    relative = target.relative_to(root).as_posix()
    description = (
        f"Explore {title} resources, guidance and related information "
        "from MedOrbits."
    )

    parent_index = index
    breadcrumbs = [
        f'<a href="{escape(relative_href(target.parent, root / "index.html"), quote=True)}">Home</a>'
    ]

    if parent_index and parent_index != target:
        breadcrumbs.append(
            f'<a href="{escape(relative_href(target.parent, parent_index), quote=True)}">'
            f'{escape(page_title(parent_index, root))}</a>'
        )

    breadcrumb_html = "\n      <span aria-hidden=\"true\"> / </span>\n      ".join(
        breadcrumbs
    )

    # Reuse a stylesheet only when a safe, existing local CSS file is found.
    stylesheet = ""
    if index:
        raw = read_text(index)
        matches = re.findall(
            r'<link\b[^>]*\bhref\s*=\s*["\']([^"\']+\.css(?:\?[^"\']*)?)["\']',
            raw,
            flags=re.I,
        )

        for href in matches:
            parts = urlsplit(href)
            if parts.scheme or parts.netloc or href.startswith("//"):
                continue

            css_candidate = index.parent / unquote(parts.path)
            css_candidate = safe_path(root, css_candidate)

            if css_candidate and css_candidate.is_file():
                stylesheet_href = relative_href(target.parent, css_candidate)
                stylesheet = (
                    f'  <link rel="stylesheet" href="{escape(stylesheet_href, quote=True)}">\n'
                )
                break

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="{escape(description, quote=True)}">
  <meta name="theme-color" content="#102b43">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="">
  <title>{escape(title)} | MedOrbits</title>
{stylesheet}</head>
<body>
  <header class="site-header">
    <nav aria-label="Breadcrumb">
      {breadcrumb_html}
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{escape(title)}</span>
    </nav>
    <p class="eyebrow">MedOrbits Education &amp; Career Guidance</p>
  </header>

  <main>
    <article>
      <section class="hero">
        <p class="eyebrow">Explore your options</p>
        <h1>{escape(title)}</h1>
        <p>{escape(description)}</p>
      </section>

      <section aria-labelledby="overview">
        <h2 id="overview">Overview</h2>
        <p>
          Use this guide to organize your research, compare relevant options,
          and identify the official information you need before making a decision.
        </p>
      </section>

      <section aria-labelledby="planning">
        <h2 id="planning">Planning checklist</h2>
        <ul>
          <li>Confirm eligibility using the latest official notification.</li>
          <li>Check deadlines, application procedures and applicable fees.</li>
          <li>Verify recognition, accreditation and course-specific requirements.</li>
          <li>Keep copies of required documents and application receipts.</li>
          <li>Record the official source and date for important information.</li>
        </ul>
      </section>

      <section aria-labelledby="verification">
        <h2 id="verification">Verify before applying</h2>
        <p>
          Requirements can change by institution, course, jurisdiction and
          admission cycle. Confirm current details with the relevant official
          authority. Do not rely on this starter page as a substitute for an
          official notification.
        </p>
      </section>

      <section aria-labelledby="related-resources">
        <h2 id="related-resources">Related resources</h2>
        <p>
          Visit the relevant MedOrbits topic index and connect this page to
          verified guides, official notices and supporting documents.
        </p>
      </section>

      <aside aria-label="Editorial notice">
        <p><strong>Editorial status:</strong> Starter content awaiting review.</p>
        <p>Confirm every factual claim and add verified, topic-specific material before publication.</p>
      </aside>
    </article>
  </main>

  <footer>
    <p>MedOrbits -- Education, admissions and career guidance.</p>
    <p><small>Page reference: {escape(relative)}</small></p>
  </footer>
</body>
</html>
"""


def make_related_hub(
    hub: Path,
    root: Path,
    pages: list[Path],
) -> str:
    title = "Related Resources"
    items = []

    for page in sorted(set(pages)):
        if page == hub or not page.exists() and page not in pages:
            continue
        href = relative_href(hub.parent, page)
        items.append(
            f'        <li><a href="{escape(href, quote=True)}">'
            f'{escape(page_title(page, root))}</a></li>'
        )

    listing = "\n".join(items) or "        <li>Resources will be added after review.</li>"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Browse related MedOrbits education and career resources.">
  <meta name="theme-color" content="#102b43">
  <title>{title} | MedOrbits</title>
</head>
<body>
  <header>
    <nav aria-label="Primary"><a href="{escape(relative_href(hub.parent, root / "index.html"), quote=True)}">Home</a></nav>
    <p>MedOrbits Resource Library</p>
  </header>
  <main>
    <h1>{title}</h1>
    <p>Browse related guides and review each page for current, verified information.</p>
    <ul>
{listing}
    </ul>
    <p><strong>Editorial notice:</strong> Verify all admission, fee, eligibility and deadline information with official sources.</p>
  </main>
  <footer><p>MedOrbits -- Education and career guidance.</p></footer>
</body>
</html>
"""


def make_upgrade_proposal(source: Path, root: Path) -> str:
    """Create a separate review copy; never replace the source page."""
    original = read_text(source)
    parsed = inspect_html(source)
    title = page_title(source, root)
    description = parsed.description or (
        f"Explore verified information, guidance and resources about {title}."
    )

    if re.search(r"<html\b", original, flags=re.I):
        # Preserve the original document inside a review wrapper rather than
        # trying to rewrite complex HTML structures automatically.
        safe_original = escape(original)
    else:
        safe_original = escape(original)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{escape(description, quote=True)}">
  <meta name="theme-color" content="#102b43">
  <title>Upgrade Proposal: {escape(title)} | MedOrbits</title>
</head>
<body>
  <header>
    <p>MedOrbits -- Editorial Upgrade Proposal</p>
    <h1>{escape(title)}</h1>
    <p>This is a separate review draft. It does not replace the original page.</p>
  </header>
  <main>
    <section>
      <h2>Recommended improvements</h2>
      <ul>
        <li>Review the title, description and canonical URL.</li>
        <li>Improve heading hierarchy and provide a clear introduction.</li>
        <li>Add verified, topic-specific content and relevant official references.</li>
        <li>Add useful internal links to existing related pages.</li>
        <li>Check mobile layout, accessibility and page performance.</li>
        <li>Review structured data and metadata where appropriate.</li>
        <li>Remove stale claims, duplicate content and unsupported promises.</li>
      </ul>
    </section>
    <section>
      <h2>Original content for reference</h2>
      <pre>{safe_original}</pre>
    </section>
  </main>
  <footer>
    <p>Review and manually merge approved improvements into the original page.</p>
  </footer>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely expand and audit the MedOrbits repository."
    )
    parser.add_argument("--root", default=".", help="Repository root.")
    parser.add_argument("--apply", action="store_true",
                        help="Create missing pages and proposal files.")
    parser.add_argument("--report", action="store_true",
                        help="Print a JSON report.")
    parser.add_argument("--expand-related", action="store_true",
                        help="Discover related pages from the built-in catalog.")
    parser.add_argument("--upgrade-thin", action="store_true",
                        help="Create separate .proposed.html files for thin pages.")
    parser.add_argument("--min-bytes", type=int, default=80,
                        help="Report files smaller than this size.")
    parser.add_argument("--thin-html-bytes", type=int, default=700,
                        help="Treat HTML files below this size as thin.")
    parser.add_argument("--max-create", type=int, default=200,
                        help="Maximum new pages to create per run.")
    parser.add_argument("--max-related-per-index", type=int, default=12,
                        help="Maximum related catalog pages selected per index.")
    args = parser.parse_args()

    if args.min_bytes < 0 or args.thin_html_bytes < 0:
        parser.error("byte limits must be zero or greater")
    if args.max_create < 1 or args.max_related_per_index < 1:
        parser.error("creation limits must be at least 1")

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"ERROR: repository root not found: {root}", file=sys.stderr)
        return 2

    files = discover_files(root)
    html_files = [p for p in files if p.suffix.lower() in HTML_EXTENSIONS]
    indexes = [p for p in html_files if p.name.lower() == "index.html"]

    missing: dict[Path, Path | None] = {}
    broken_links: list[dict[str, str]] = []
    small_files: list[dict[str, object]] = []
    thin_pages: list[Path] = []

    for source in files:
        try:
            size = source.stat().st_size
        except OSError:
            continue

        if size < args.min_bytes:
            small_files.append({
                "file": source.relative_to(root).as_posix(),
                "bytes": size,
                "action": "review_only",
            })

        if source.suffix.lower() not in HTML_EXTENSIONS:
            continue

        if size < args.thin_html_bytes:
            thin_pages.append(source)

        for href in inspect_html(source).links:
            target = local_html_target(source, href, root)
            if target is None or target.exists():
                continue

            context = nearest_index(target, root, indexes)
            if context is None:
                broken_links.append({
                    "source": source.relative_to(root).as_posix(),
                    "target": target.relative_to(root).as_posix(),
                    "reason": "missing local HTML target; no index context found",
                })
            else:
                missing.setdefault(target, context)

    related_candidates: list[Path] = []
    related_by_index: dict[str, list[str]] = {}

    if args.expand_related:
        for index in indexes:
            items = matching_catalog_items(index, root)
            items = items[:args.max_related_per_index]
            chosen = []

            for item in items:
                candidate = root / item["path"]
                checked = safe_path(root, candidate)

                if checked is None or ignored(checked, root):
                    continue

                chosen.append(checked)

                if not checked.exists():
                    missing.setdefault(checked, index)
                    related_candidates.append(checked)

            related_by_index[index.relative_to(root).as_posix()] = [
                p.relative_to(root).as_posix() for p in chosen
            ]

    candidates = sorted(missing.items(), key=lambda pair: pair[0])
    if len(candidates) > args.max_create:
        print(
            f"WARNING: limiting candidates from "
            f"{len(candidates)} to {args.max_create}.",
            file=sys.stderr,
        )
        candidates = candidates[:args.max_create]

    created: list[str] = []
    skipped: list[str] = []
    would_create: list[str] = []

    for target, context in candidates:
        relative = target.relative_to(root).as_posix()
        would_create.append(relative)

        if target.exists():
            skipped.append(relative)
            continue

        if not args.apply:
            continue

        checked = safe_path(root, target)
        if checked is None:
            skipped.append(relative)
            continue

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            # "x" prevents overwriting an existing file.
            with target.open("x", encoding="utf-8", newline="\n") as handle:
                handle.write(make_page(target, root, context))
            created.append(relative)
        except FileExistsError:
            skipped.append(relative)
        except OSError as exc:
            print(f"WARNING: could not create {relative}: {exc}", file=sys.stderr)
            skipped.append(relative)

    proposals_created: list[str] = []
    proposal_candidates: list[Path] = []

    if args.upgrade_thin:
        for source in thin_pages:
            proposal = source.with_name(source.stem + ".proposed.html")
            checked = safe_path(root, proposal)

            if checked is None or ignored(proposal, root):
                continue

            if proposal.exists():
                skipped.append(proposal.relative_to(root).as_posix())
                continue

            proposal_candidates.append(source)

            if not args.apply:
                continue

            try:
                with proposal.open("x", encoding="utf-8", newline="\n") as handle:
                    handle.write(make_upgrade_proposal(source, root))
                proposals_created.append(proposal.relative_to(root).as_posix())
            except FileExistsError:
                skipped.append(proposal.relative_to(root).as_posix())
            except OSError as exc:
                print(f"WARNING: could not create proposal for {source}: {exc}",
                      file=sys.stderr)

    # A central hub is generated only when related expansion was requested.
    hub = root / "related-resources.html"
    hub_candidate = False
    hub_created = False

    if args.expand_related:
        hub_checked = safe_path(root, hub)
        if hub_checked is not None and not hub.exists():
            hub_candidate = True
            if args.apply:
                page_targets = [
                    target for target, _ in candidates
                    if target.suffix.lower() in HTML_EXTENSIONS
                ]
                try:
                    with hub.open("x", encoding="utf-8", newline="\n") as handle:
                        handle.write(make_related_hub(hub, root, page_targets))
                    hub_created = True
                except FileExistsError:
                    skipped.append(hub.relative_to(root).as_posix())
                except OSError as exc:
                    print(f"WARNING: could not create related-resources.html: {exc}",
                          file=sys.stderr)

    report = {
        "tool": "MedOrbits Adaptive Repository Completer & Website Expander",
        "version": VERSION,
        "timestamp": utc_now(),
        "repository": str(root),
        "mode": "apply" if args.apply else "dry-run",
        "files_scanned": len(files),
        "html_pages_found": len(html_files),
        "index_pages_found": len(indexes),
        "missing_page_candidates": [
            {
                "target": target.relative_to(root).as_posix(),
                "context_index": (
                    context.relative_to(root).as_posix() if context else None
                ),
            }
            for target, context in candidates
        ],
        "related_pages_by_index": related_by_index,
        "related_hub": {
            "path": "related-resources.html",
            "candidate": hub_candidate,
            "created": hub_created,
        },
        "small_files_review_only": small_files,
        "thin_html_pages": [
            p.relative_to(root).as_posix() for p in thin_pages
        ],
        "upgrade_proposals": {
            "requested": args.upgrade_thin,
            "candidate_sources": [
                p.relative_to(root).as_posix() for p in proposal_candidates
            ],
            "created": proposals_created,
        },
        "unresolved_links_without_index_context": broken_links,
        "created": created,
        "skipped": skipped,
        "safety": {
            "existing_files_overwritten": False,
            "files_deleted": False,
            "original_thin_pages_modified": False,
            "repository_code_executed": False,
            "generated_pages_require_editorial_review": True,
        },
    }

    if args.report:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Repository: {root}")
        print(f"Files scanned: {len(files)}")
        print(f"HTML pages: {len(html_files)}")
        print(f"Index pages: {len(indexes)}")
        print(f"Missing page candidates: {len(candidates)}")
        print(f"Small files to review: {len(small_files)}")
        print(f"Thin HTML pages: {len(thin_pages)}")
        print(f"Unresolved links without index context: {len(broken_links)}")

        if args.expand_related:
            print(f"Related-page discovery: enabled")
            print(f"Related hub candidate: {hub_candidate}")

        if args.apply:
            print(f"Pages created: {len(created)}")
            print(f"Upgrade proposals created: {len(proposals_created)}")
            print(f"Pages skipped: {len(skipped)}")
        else:
            print("DRY RUN: no files were created.")
            for relative in would_create:
                print(f"  WOULD CREATE {relative}")

            if args.upgrade_thin:
                for source in proposal_candidates:
                    proposal = source.with_name(source.stem + ".proposed.html")
                    print(
                        "  WOULD CREATE PROPOSAL "
                        f"{proposal.relative_to(root).as_posix()}"
                    )

        print("\nExisting pages are not overwritten.")
        print("Generated content must be reviewed before publication.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
