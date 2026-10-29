
#!/usr/bin/env python3
"""
MedOrbits -- Folder Index Design Enforcement
============================================

File:
    /tools/enforce-folder-index-design.py

Purpose:
    Enforce the local folder's index.html as the structural design
    reference for every HTML page in that folder.

Rules:
    1. Every HTML page must follow its own folder's index.html structure.
    2. Preserve the reference page's section order, layout patterns,
       navigation, header, footer, responsive behaviour and components.
    3. Page-specific colours and themes may differ when appropriate.
    4. Use relevant images, icons and emojis for each page's subject.
    5. Preserve page-specific content, metadata, canonical URLs and SEO.
    6. Do not overwrite index.html or template files.
    7. Do not remove functionality, forms, scripts, IDs or accessibility.
    8. Create a report and backups before making changes.
    9. Never invent a replacement reference when index.html is missing.
   10. This tool prepares instructions and audits the repository.
       Actual HTML restructuring requires an approved implementation agent.

Usage:
    python tools/enforce-folder-index-design.py
    python tools/enforce-folder-index-design.py --dry-run
    python tools/enforce-folder-index-design.py --root .
    python tools/enforce-folder-index-design.py --strict
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXCLUDED_DIRS = {
    ".git", ".github", ".next", ".nuxt", ".cache",
    "node_modules", "vendor", "dist", "build",
    "coverage", "__pycache__", ".venv", "venv",
    "templates", "template", "partials", "includes",
}

EXCLUDED_FILES = {
    "404.html",
    "offline.html",
}

REPORT_DIR = ".design-audit"
BACKUP_DIR = ".design-backups"

# This is the canonical instruction that an implementation agent must follow.
DESIGN_INSTRUCTION = r"""
MEDORBITS REPOSITORY-WIDE HTML DESIGN DIRECTIVE
================================================

AUTHORITY AND REFERENCE SELECTION
---------------------------------
For every HTML page, locate the nearest applicable index.html in its
own directory. That index.html is the primary visual and structural
reference for the page.

Examples:
- /education/index.html governs sibling pages in /education/.
- /education/courses/index.html governs sibling pages in
  /education/courses/, if that folder has its own index.html.
- /career/index.html governs sibling pages in /career/.
- /legal/index.html governs sibling pages in /legal/, if present.
- /index.html governs root-level HTML pages.

If the current directory has no index.html, search parent directories
for the nearest index.html. Use the nearest one as the fallback
reference and record the choice. Do not use a distant or unrelated
index.html when a closer valid reference exists.

Never use the target page itself as its own reference.
Never overwrite a reference index.html.
If no valid reference can be found, report the page as BLOCKED and
request an approved reference. Do not fabricate a design.

NON-NEGOTIABLE STRUCTURAL CONSISTENCY
-------------------------------------
Every target page must reproduce the reference's applicable design
system and page architecture, including:

1. Document language, viewport setup and accessible page foundation.
2. Header structure, branding, logo placement and navigation pattern.
3. Announcement or utility strip, when present in the reference.
4. Main container widths, spacing scale, grid system and breakpoints.
5. Breadcrumb structure where appropriate.
6. Hero layout, typography hierarchy, decorative elements and metadata.
7. Section sequence and layout patterns used by the reference.
8. Card geometry, border treatment, radii, shadows and spacing.
9. Image presentation, icon treatment and decorative visual language.
10. Sidebar, table of contents or secondary navigation when relevant.
11. Calls to action and button styles.
12. Footer structure, link groups, disclaimer and copyright treatment.
13. Mobile menu, dropdowns, sticky elements and responsive behaviour.
14. Keyboard accessibility, visible focus, semantic HTML and reduced motion.
15. Shared CSS and JavaScript integration used by the reference.

Do not create a completely unrelated layout for an individual page.
Do not arbitrarily reorder, omit or replace major reference components.
Keep the same overall visual grammar and component hierarchy.

PERMITTED PAGE-SPECIFIC ADAPTATION
----------------------------------
The following may adapt to the page's subject without breaking the
reference structure:

- Accent colours, gradients, background shades and theme variables.
- Page title, hero subtitle, eyebrow text and metadata.
- Relevant photographs, illustrations, SVGs and icons.
- Relevant emojis used sparingly as decorative enhancements.
- Section headings, section count and page-specific content.
- Tables, FAQs, forms, course lists, job cards and legal content.
- Relevant calls to action and related-page links.
- SEO title, description, canonical URL and social metadata.

A colour adaptation must retain adequate contrast, clear hierarchy
and the reference's premium visual style. Never use a pure-white
background or transparent-looking content section where the site's
design system requires a visibly tinted background. Do not force
every folder to use the same colour palette when its own index.html
establishes a different theme.

IMAGES AND EMOJIS
-----------------
Use images relevant to the actual page topic. Prefer existing,
licensed project assets already present in the repository.
Use descriptive alt text for meaningful images and empty alt text
for purely decorative images.

Do not:
- Reuse an unrelated image merely to fill space.
- fabricate image URLs or claim an unavailable image exists.
- add copyrighted, unsafe or unlicensed assets without authorization.
- use emojis as a substitute for headings, labels or accessible text.
- let decorative imagery damage mobile layout or text contrast.

If a suitable image is unavailable, use an existing design-system
illustration, a CSS decoration, an accessible icon, or a clearly
identified placeholder according to project conventions.

PRESERVE PAGE FUNCTIONALITY
---------------------------
Before changing a page, identify and preserve:
- Forms, validation, submission endpoints and field names.
- Existing IDs, anchors and in-page navigation targets.
- JavaScript event handlers and component initialization.
- API endpoints, JSON data sources and data bindings.
- Login, search, filter, pagination and application workflows.
- Structured data, analytics and consent mechanisms.
- Canonical links, metadata, language attributes and SEO semantics.
- Accessibility attributes, labels and keyboard interactions.
- Relative and absolute asset paths that currently work.

Do not silently remove functionality to make a page resemble the
reference. Adapt the layout around the target page's real content.

CSS AND JAVASCRIPT
------------------
Prefer the folder's existing shared CSS and JavaScript assets.
Do not duplicate global CSS or JavaScript unnecessarily.
Use page-specific CSS only when required and scoped to avoid leakage.
Avoid conflicting duplicate IDs, global selector regressions,
inline event-handler additions and unnecessary dependencies.

If the reference uses shared assets, follow that architecture.
Do not invent a stylesheet or script path without checking the
repository and the reference page first.

ACCESSIBILITY AND RESPONSIVENESS
-------------------------------
Every page must:
- Work at mobile, tablet and desktop widths.
- Avoid horizontal overflow and clipped content.
- Use semantic headings in logical order.
- Provide keyboard-accessible navigation and controls.
- Have visible focus indicators.
- Give inputs accessible labels and useful validation feedback.
- Use meaningful link text and image alt text.
- Respect prefers-reduced-motion.
- Maintain sufficient text/background contrast.
- Avoid conveying important information by colour alone.

IMPLEMENTATION AND SAFETY
-------------------------
1. Inspect the reference and target page before editing.
2. Create a structural inventory of the reference.
3. Map target content to the reference's components.
4. Preserve the target's unique content and working behaviour.
5. Apply the structure and design systematically.
6. Validate HTML, links, asset paths, scripts and responsive behaviour.
7. Compare the result with the reference at matching viewport sizes.
8. Record the reference path, changes, warnings and validation results.
9. Back up existing files before modification.
10. Never delete files or perform destructive bulk replacements.
11. Do not replace a page with the contents of index.html.
12. Do not report success unless changes were actually applied and checked.

COMPLETION CRITERIA
-------------------
A page is compliant only when:
- Its chosen reference is recorded and valid.
- Its main structural patterns match the reference.
- Its header, navigation and footer follow the reference architecture.
- Its responsive layout and design tokens are consistent.
- Its content remains specific to its own purpose.
- Relevant images and emojis are used appropriately.
- Existing functional behaviour is preserved.
- Automated checks pass or all remaining issues are documented.

The objective is consistent structure, not identical text or identical
colour on every page.
""".strip()


def should_skip(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True

    if any(part.lower() in EXCLUDED_DIRS for part in relative.parts):
        return True

    if path.name.lower() in EXCLUDED_FILES:
        return True

    if path.name.lower().endswith(".template.html"):
        return True

    return False


def discover_html(root: Path) -> list[Path]:
    pages = []
    for path in root.rglob("*.html"):
        if not should_skip(path, root):
            pages.append(path)
    return sorted(pages)


def find_reference(target: Path, root: Path) -> Path | None:
    """Find the nearest ancestor-folder index.html, excluding the target."""
    current = target.parent

    while True:
        candidate = current / "index.html"
        if candidate.is_file() and candidate.resolve() != target.resolve():
            return candidate

        if current.resolve() == root.resolve():
            break

        parent = current.parent
        if parent == current:
            break
        try:
            parent.resolve().relative_to(root.resolve())
        except ValueError:
            break
        current = parent

    root_index = root / "index.html"
    if root_index.is_file() and root_index.resolve() != target.resolve():
        return root_index

    return None


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace")


def inspect_page(path: Path) -> dict[str, Any]:
    source = read_text(path)
    lower = source.lower()

    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "has_doctype": bool(re.search(r"<!doctype\s+html", source, re.I)),
        "has_viewport": 'name="viewport"' in lower,
        "has_title": bool(re.search(r"<title\b[^>]*>.*?</title>", source, re.I | re.S)),
        "has_main": bool(re.search(r"<main\b", source, re.I)),
        "has_header": bool(re.search(r"<header\b", source, re.I)),
        "has_footer": bool(re.search(r"<footer\b", source, re.I)),
        "has_alt_attributes": bool(re.search(r"<img\b[^>]*\balt\s*=", source, re.I)),
        "has_reduced_motion": "prefers-reduced-motion" in lower,
        "has_responsive_css": "@media" in lower,
        "external_images": len(re.findall(r"<img\b[^>]*\bsrc\s*=\s*[\"']https?://", source, re.I)),
        "inline_scripts": len(re.findall(r"<script\b", source, re.I)),
        "stylesheet_links": len(re.findall(r"<link\b[^>]*\brel\s*=\s*[\"']stylesheet", source, re.I)),
        "duplicate_ids": sorted({
            item for item in re.findall(
                r'\bid\s*=\s*["\']([^"\']+)["\']', source, re.I
            )
            if len(re.findall(
                rf'\bid\s*=\s*["\']{re.escape(item)}["\']', source, re.I
            )) > 1
        }),
    }


def create_instruction_file(root: Path, dry_run: bool) -> Path:
    destination = root / "tools" / "DESIGN-ENFORCEMENT-INSTRUCTIONS.md"
    if dry_run:
        return destination

    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        "# MedOrbits HTML Design Enforcement Directive\n\n"
        "Apply this directive when creating, editing, reviewing or generating "
        "HTML pages in this repository.\n\n"
        "## Mandatory instruction for implementation agents\n\n"
        "```text\n"
        + DESIGN_INSTRUCTION
        + "\n```\n",
        encoding="utf-8",
    )
    return destination


def audit_repository(root: Path, strict: bool, dry_run: bool) -> dict[str, Any]:
    pages = discover_html(root)
    results = []

    for page in pages:
        reference = find_reference(page, root)
        target_info = inspect_page(page)

        item = {
            **target_info,
            "reference": str(reference) if reference else None,
            "status": "REFERENCE_FOUND" if reference else "BLOCKED_NO_REFERENCE",
            "warnings": [],
        }

        if reference:
            reference_info = inspect_page(reference)
            item["reference_features"] = {
                key: reference_info[key]
                for key in (
                    "has_header", "has_footer", "has_main",
                    "has_responsive_css", "has_reduced_motion",
                )
            }

            for feature in ("has_doctype", "has_viewport", "has_title", "has_main"):
                if not target_info[feature]:
                    item["warnings"].append(f"Missing baseline feature: {feature}")

            if target_info["duplicate_ids"]:
                item["warnings"].append(
                    "Duplicate HTML IDs: " + ", ".join(target_info["duplicate_ids"])
                )

            if strict:
                for feature in (
                    "has_header", "has_footer", "has_responsive_css",
                ):
                    if reference_info[feature] and not target_info[feature]:
                        item["warnings"].append(
                            f"Reference has {feature}; target does not"
                        )
        else:
            item["warnings"].append(
                "No folder or ancestor index.html found. Approve a reference "
                "before restructuring this page."
            )

        results.append(item)

    report = {
        "project": "MedOrbits",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "root": str(root),
        "mode": "dry-run" if dry_run else "audit",
        "strict": strict,
        "directive": DESIGN_INSTRUCTION,
        "pages_scanned": len(results),
        "pages_with_reference": sum(
            item["reference"] is not None for item in results
        ),
        "pages_blocked": sum(
            item["reference"] is None for item in results
        ),
        "pages_with_warnings": sum(bool(item["warnings"]) for item in results),
        "results": results,
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit HTML pages against their nearest folder index.html."
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory (default: current directory).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write the instruction or audit report.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Also warn when common structural features are missing.",
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"ERROR: repository root does not exist: {root}", file=sys.stderr)
        return 2

    report_dir = root / REPORT_DIR
    report_path = report_dir / "report.json"

    instruction_path = create_instruction_file(root, args.dry_run)
    report = audit_repository(root, args.strict, args.dry_run)

    if not args.dry_run:
        report_dir.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(report, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    print("=" * 72)
    print("MEDORBITS -- FOLDER INDEX DESIGN AUDIT")
    print("=" * 72)
    print(f"Repository:          {root}")
    print(f"HTML pages scanned:  {report['pages_scanned']}")
    print(f"References found:    {report['pages_with_reference']}")
    print(f"Pages blocked:       {report['pages_blocked']}")
    print(f"Pages with warnings: {report['pages_with_warnings']}")
    print()
    print("IMPORTANT: This script audits and writes the directive.")
    print("It does not automatically redesign HTML pages.")
    print("Use an implementation agent with repository write access to")
    print("apply the directive safely, then rerun the audit.")
    print()

    if not args.dry_run:
        print(f"Directive: {instruction_path}")
        print(f"Audit report: {report_path}")
    else:
        print("Dry run: no files were written.")

    for item in report["results"]:
        if item["status"] == "BLOCKED_NO_REFERENCE" or item["warnings"]:
            print(f"\n[{item['status']}] {item['path']}")
            if item["reference"]:
                print(f"  Reference: {item['reference']}")
            for warning in item["warnings"]:
                print(f"  WARNING: {warning}")

    return 1 if args.strict and report["pages_blocked"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
