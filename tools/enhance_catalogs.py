
#!/usr/bin/env python3
"""
MedOrbits Animated Catalog & Hero Enhancement Tool
===================================================

Suggested file:
    tools/enhance_catalogs.py

Purpose:
    Upgrade existing HTML pages with:
      - Responsive 2x2 square catalog cards.
      - Sliding catalog pages and automatic rotation.
      - Accessible previous/next controls and pagination indicators.
      - Animated hero typography and floating decorative emojis.
      - Premium animated backgrounds and card hover effects.
      - Shared CSS and JavaScript assets.
      - Template exclusions and conservative HTML modification.
      - Backups, dry-run support, and JSON audit reports.

Requirements:
    Python 3.10+
    beautifulsoup4 >= 4.12.3

Examples:
    python tools/enhance_catalogs.py --root .
    python tools/enhance_catalogs.py --root . --apply
    python tools/enhance_catalogs.py --root . --apply --backup
    python tools/enhance_catalogs.py --root . --apply --no-auto-slide

Safety:
    Dry-run is the default.
    Only use --apply to write changes.
    Templates and generated/dependency directories are excluded.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import time

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

try:
    from bs4 import BeautifulSoup, Tag
except ImportError:
    print(
        "Missing dependency: beautifulsoup4\n"
        "Install it with: python -m pip install beautifulsoup4",
        file=sys.stderr,
    )
    raise SystemExit(2)


VERSION = "2.0.0"

EXCLUDED_DIRECTORY_NAMES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "node_modules",
    "vendor",
    "__pycache__",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "coverage",
    "playwright-report",
    "test-results",
    "templates",
    "template",
    "_templates",
    "_template",
    "html-templates",
    "page-templates",
}

EXCLUDED_FILE_PATTERNS = {
    "template.html",
    "template.htm",
    "base.html",
    "base.htm",
    "layout.html",
    "layout.htm",
    "master.html",
    "master.htm",
}

EXCLUDED_PATH_PARTS = {
    "templates",
    "template",
    "_templates",
    "_template",
    "html-templates",
    "page-templates",
}

CATALOG_KEYWORDS = re.compile(
    r"(catalog|catalogue|collection|showcase|"
    r"banner|course-list|course-grid|"
    r"college-list|college-grid|"
    r"program-list|program-grid|"
    r"category-grid|explore-section|"
    r"featured-courses|featured-colleges|"
    r"resource-grid|service-grid|"
    r"product-grid|destination-grid)",
    re.IGNORECASE,
)

CARD_KEYWORDS = re.compile(
    r"(card|tile|catalog-item|catalogue-item|"
    r"catalog-card|course-item|college-item|"
    r"service-item|category-item|"
    r"product-item|destination-item)",
    re.IGNORECASE,
)

HERO_KEYWORDS = re.compile(
    r"(^|[-_\s])(hero|masthead|banner-header)([-_\s]|$)",
    re.IGNORECASE,
)

EMOJIS = (
    "✨",
    "🎓",
    "🌟",
    "📚",
    "🚀",
    "💫",
    "🌍",
    "🧭",
)

CSS_ASSET = Path("assets/css/catalog-motion.css")
JS_ASSET = Path("assets/js/catalog-motion.js")
REPORT_PATH = Path("reports/catalog-enhancement-report.json")
BACKUP_DIRECTORY = Path(".medorbits-backups")


CSS_CONTENT = r"""
/* MedOrbits Animated Catalog System -- 2.0.0 */

:root {
  --mo-ink: #18283c;
  --mo-surface: #f4eee7;
  --mo-accent: #b88a55;
  --mo-accent-light: #ead6b7;
  --mo-radius: 22px;
  --mo-card-gap: 18px;
  --mo-motion-duration: 550ms;
  --mo-shadow: 0 18px 48px rgba(22, 36, 54, .12);
}

.mo-catalog-enhanced {
  position: relative;
  isolation: isolate;
  margin-block: clamp(2rem, 5vw, 5rem);
  padding: clamp(1rem, 3vw, 2.5rem);
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(
      circle at 8% 12%,
      rgba(220, 188, 140, .24),
      transparent 36%
    ),
    radial-gradient(
      circle at 95% 85%,
      rgba(120, 151, 175, .17),
      transparent 36%
    ),
    linear-gradient(135deg, #f6efe7, #e9edf0 55%, #f3e7da);
}

.mo-catalog-enhanced::before {
  content: "";
  position: absolute;
  inset: -60%;
  z-index: -1;
  pointer-events: none;
  background: conic-gradient(
    from 0deg,
    transparent,
    rgba(184, 138, 85, .10),
    transparent 32%,
    rgba(111, 144, 170, .10),
    transparent 65%
  );
  animation: mo-background-orbit 32s linear infinite;
}

.mo-catalog-heading {
  max-width: 850px;
  margin: 0 auto 1.8rem;
  text-align: center;
}

.mo-catalog-heading h2 {
  margin: 0;
  color: var(--mo-ink);
  font-size: clamp(1.65rem, 4vw, 3rem);
  font-weight: 850;
  line-height: 1.13;
  letter-spacing: -.045em;
  text-wrap: balance;
  animation: mo-heading-arrive 800ms both;
}

.mo-catalog-heading p {
  max-width: 680px;
  margin: .8rem auto 0;
  color: #526174;
  font-size: clamp(.94rem, 1.6vw, 1.12rem);
  line-height: 1.8;
}

.mo-catalog-viewport {
  width: 100%;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
  border-radius: var(--mo-radius);
}

.mo-catalog-track {
  display: flex;
  align-items: stretch;
  gap: 0;
  transform: translate3d(0, 0, 0);
  transition: transform var(--mo-motion-duration) cubic-bezier(.2, .75, .25, 1);
  will-change: transform;
}

.mo-catalog-page {
  box-sizing: border-box;
  flex: 0 0 100%;
  min-width: 0;
  padding: 5px;
}

.mo-catalog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mo-card-gap);
  align-items: stretch;
}

.mo-catalog-card {
  position: relative;
  display: flex;
  min-width: 0;
  aspect-ratio: 1 / 1;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: var(--mo-radius);
  background:
    radial-gradient(circle at 85% 15%, rgba(255,255,255,.65), transparent 32%),
    linear-gradient(145deg, #e4d2bc, #c4d5de 56%, #dcd1e5);
  box-shadow: 0 8px 24px rgba(25, 40, 60, .08);
  color: var(--mo-ink);
  text-decoration: none;
  isolation: isolate;
  transform: translateZ(0);
  transition:
    transform 320ms ease,
    box-shadow 320ms ease,
    border-color 320ms ease;
}

.mo-catalog-card:nth-child(4n + 2) {
  background: linear-gradient(145deg, #e8d5c9, #c9d9d3);
}

.mo-catalog-card:nth-child(4n + 3) {
  background: linear-gradient(145deg, #d5d9ed, #e8d5c9);
}

.mo-catalog-card:nth-child(4n + 4) {
  background: linear-gradient(145deg, #d6e3e5, #ead9b9);
}

.mo-catalog-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  opacity: .65;
  background:
    radial-gradient(circle at 78% 18%, rgba(255,255,255,.85), transparent 23%),
    linear-gradient(180deg, transparent 30%, rgba(20, 34, 49, .65));
  transition: opacity 320ms ease;
}

.mo-catalog-card:hover,
.mo-catalog-card:focus-visible {
  z-index: 2;
  transform: translateY(-5px) scale(1.012);
  box-shadow: var(--mo-shadow);
  border-color: rgba(184, 138, 85, .8);
}

.mo-catalog-card:focus-visible {
  outline: 3px solid #77552e;
  outline-offset: 4px;
}

.mo-catalog-card img {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 650ms cubic-bezier(.2, .75, .25, 1);
}

.mo-catalog-card:hover img {
  transform: scale(1.07);
}

.mo-catalog-card-content {
  position: relative;
  z-index: 1;
  padding: clamp(.75rem, 2.2vw, 1.4rem);
  color: #fff;
}

.mo-catalog-card h3 {
  margin: 0;
  font-size: clamp(.98rem, 2.2vw, 1.45rem);
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -.025em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.mo-catalog-card p {
  display: -webkit-box;
  margin: .45rem 0 0;
  overflow: hidden;
  color: rgba(255, 255, 255, .92);
  font-size: clamp(.76rem, 1.4vw, .94rem);
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mo-catalog-card .mo-card-icon {
  display: inline-grid;
  place-items: center;
  width: 2.7rem;
  height: 2.7rem;
  margin-bottom: .8rem;
  border: 1px solid rgba(255,255,255,.5);
  border-radius: 50%;
  background: rgba(255,255,255,.2);
  font-size: 1.35rem;
  backdrop-filter: blur(8px);
}

.mo-catalog-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: .85rem;
  margin-top: 1.4rem;
}

.mo-catalog-button {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: .65rem .9rem;
  border: 1px solid rgba(24, 40, 60, .18);
  border-radius: 999px;
  background: rgba(255,255,255,.68);
  color: var(--mo-ink);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background 200ms ease, transform 200ms ease;
}

.mo-catalog-button:hover {
  transform: translateY(-2px);
  background: #fff;
}

.mo-catalog-button:focus-visible {
  outline: 3px solid #77552e;
  outline-offset: 3px;
}

.mo-catalog-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
}

.mo-catalog-dot {
  width: 10px;
  height: 10px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #9ba7b1;
  cursor: pointer;
  transition: width 220ms ease, background 220ms ease;
}

.mo-catalog-dot[aria-current="true"] {
  width: 27px;
  background: var(--mo-ink);
}

.mo-hero-enhanced {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.mo-hero-enhanced .mo-hero-emoji {
  position: absolute;
  z-index: 0;
  top: var(--mo-emoji-top, 18%);
  left: var(--mo-emoji-left, 78%);
  pointer-events: none;
  user-select: none;
  font-size: clamp(1.5rem, 3.5vw, 3.4rem);
  opacity: .65;
  filter: drop-shadow(0 8px 16px rgba(20, 34, 49, .12));
  animation: mo-float 6s ease-in-out infinite;
}

.mo-hero-enhanced .mo-hero-emoji:nth-of-type(2) {
  animation-delay: -2s;
}

.mo-hero-enhanced .mo-hero-emoji:nth-of-type(3) {
  animation-delay: -4s;
}

.mo-hero-enhanced h1 {
  text-wrap: balance;
  animation: mo-heading-arrive 900ms cubic-bezier(.2, .75, .25, 1) both;
}

.mo-hero-enhanced h1 .mo-title-word {
  display: inline;
  background: linear-gradient(100deg, currentColor 0%, #b88a55 48%, currentColor 90%);
  background-size: 220% auto;
  background-clip: text;
  -webkit-background-clip: text;
  animation: mo-text-shimmer 8s linear infinite;
}

.mo-hero-enhanced p {
  animation: mo-fade-up 900ms 150ms both;
}

.mo-catalog-enhanced [data-mo-reveal] {
  animation: mo-fade-up 650ms both;
}

@keyframes mo-background-orbit {
  to { transform: rotate(360deg); }
}

@keyframes mo-heading-arrive {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes mo-fade-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes mo-float {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(-7deg); }
  50% { transform: translate3d(0, -17px, 0) rotate(7deg); }
}

@keyframes mo-text-shimmer {
  0% { background-position: 100% center; }
  100% { background-position: -120% center; }
}

@media (max-width: 480px) {
  .mo-catalog-enhanced {
    padding: .8rem;
    border-radius: 18px;
  }

  .mo-catalog-grid {
    gap: 10px;
  }

  .mo-catalog-card {
    border-radius: 15px;
  }

  .mo-catalog-card-content {
    padding: .7rem;
  }

  .mo-catalog-card .mo-card-icon {
    width: 2rem;
    height: 2rem;
    margin-bottom: .45rem;
    font-size: 1rem;
  }

  .mo-catalog-card p {
    -webkit-line-clamp: 2;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mo-catalog-enhanced::before,
  .mo-catalog-heading h2,
  .mo-hero-enhanced .mo-hero-emoji,
  .mo-hero-enhanced h1,
  .mo-hero-enhanced h1 .mo-title-word,
  .mo-hero-enhanced p,
  .mo-catalog-enhanced [data-mo-reveal] {
    animation: none !important;
  }

  .mo-catalog-track,
  .mo-catalog-card,
  .mo-catalog-card img,
  .mo-catalog-button,
  .mo-catalog-dot {
    transition: none !important;
  }
}
""".strip() + "\n"


JS_CONTENT = r"""
/* MedOrbits Animated Catalog System -- 2.0.0 */
(() => {
  "use strict";

  const ROOT_SELECTOR = "[data-mo-catalog]";
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const instances = new WeakMap();

  function initCatalog(root) {
    if (instances.has(root)) return;

    const track = root.querySelector(".mo-catalog-track");
    const pages = Array.from(root.querySelectorAll(".mo-catalog-page"));
    const previous = root.querySelector("[data-mo-previous]");
    const next = root.querySelector("[data-mo-next]");
    const dots = Array.from(root.querySelectorAll("[data-mo-dot]"));

    if (!track || pages.length === 0) return;

    let index = 0;
    let timer = null;
    let pointerStartX = null;

    const autoSlide = root.dataset.moAutoSlide !== "false";
    const interval = Math.max(
      2500,
      Math.min(Number(root.dataset.moInterval) || 5000, 20000)
    );

    function render(animate = true) {
      if (!animate || reducedMotion.matches) {
        track.style.transition = "none";
      } else {
        track.style.removeProperty("transition");
      }

      track.style.transform = `translate3d(-${index * 100}%, 0, 0)`;

      pages.forEach((page, i) => {
        page.setAttribute("aria-hidden", String(i !== index));

        page.querySelectorAll("a, button, input, select, textarea, [tabindex]")
          .forEach((element) => {
            if (i === index) {
              if (element.dataset.moPreviousTabindex !== undefined) {
                element.setAttribute(
                  "tabindex",
                  element.dataset.moPreviousTabindex
                );
                delete element.dataset.moPreviousTabindex;
              } else if (element.getAttribute("tabindex") === "-1") {
                element.removeAttribute("tabindex");
              }
            } else {
              if (element.dataset.moPreviousTabindex === undefined) {
                const current = element.getAttribute("tabindex");
                if (current !== null) {
                  element.dataset.moPreviousTabindex = current;
                } else {
                  element.dataset.moPreviousTabindex = "";
                }
              }
              element.setAttribute("tabindex", "-1");
            }
          });
      });

      dots.forEach((dot, i) => {
        dot.setAttribute("aria-current", String(i === index));
      });
    }

    function goTo(nextIndex) {
      index = (nextIndex + pages.length) % pages.length;
      render();
    }

    function stopTimer() {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function startTimer() {
      stopTimer();

      if (
        !autoSlide ||
        reducedMotion.matches ||
        pages.length < 2 ||
        document.hidden
      ) {
        return;
      }

      timer = window.setInterval(() => goTo(index + 1), interval);
    }

    previous?.addEventListener("click", () => {
      goTo(index - 1);
      startTimer();
    });

    next?.addEventListener("click", () => {
      goTo(index + 1);
      startTimer();
    });

    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        goTo(i);
        startTimer();
      });
    });

    root.addEventListener("pointerenter", stopTimer);
    root.addEventListener("pointerleave", startTimer);
    root.addEventListener("focusin", stopTimer);
    root.addEventListener("focusout", (event) => {
      if (!root.contains(event.relatedTarget)) startTimer();
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        goTo(index - 1);
        startTimer();
      } else if (event.key === "ArrowRight") {
        goTo(index + 1);
        startTimer();
      }
    });

    root.addEventListener("pointerdown", (event) => {
      pointerStartX = event.clientX;
    }, { passive: true });

    root.addEventListener("pointerup", (event) => {
      if (pointerStartX === null) return;

      const difference = event.clientX - pointerStartX;
      pointerStartX = null;

      if (Math.abs(difference) > 55) {
        goTo(index + (difference < 0 ? 1 : -1));
        startTimer();
      }
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopTimer();
      else startTimer();
    });

    reducedMotion.addEventListener?.("change", () => {
      render(false);
      startTimer();
    });

    render(false);
    startTimer();

    instances.set(root, { stopTimer, startTimer });
  }

  function init() {
    document.querySelectorAll(ROOT_SELECTOR).forEach(initCatalog);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
""".strip() + "\n"


@dataclass
class PageResult:
    path: str
    status: str
    catalogs_found: int = 0
    catalogs_enhanced: int = 0
    cards_found: int = 0
    hero_enhanced: bool = False
    backup: str | None = None
    reason: str | None = None
    before_sha256: str | None = None
    after_sha256: str | None = None


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalized_classes(tag: Tag) -> str:
    classes = tag.get("class", [])
    if isinstance(classes, str):
        classes = classes.split()

    return " ".join(str(item) for item in classes)


def element_identifiers(tag: Tag) -> str:
    return " ".join(
        [
            str(tag.get("id", "")),
            normalized_classes(tag),
            str(tag.get("data-section", "")),
            str(tag.get("aria-label", "")),
        ]
    )


def is_template_path(path: Path, root: Path) -> bool:
    try:
        relative = path.relative_to(root)
    except ValueError:
        return True

    if any(part.lower() in EXCLUDED_PATH_PARTS for part in relative.parts):
        return True

    if path.name.lower() in EXCLUDED_FILE_PATTERNS:
        return True

    stem = path.stem.lower()

    if stem in {"template", "base", "layout", "master"}:
        return True

    if stem.endswith((".template", ".tmpl", ".layout")):
        return True

    return False


def discover_html(root: Path) -> list[Path]:
    results: list[Path] = []

    for current, directories, files in os.walk(root, followlinks=False):
        directories[:] = sorted(
            directory
            for directory in directories
            if directory.lower() not in EXCLUDED_DIRECTORY_NAMES
            and not (Path(current) / directory).is_symlink()
        )

        for filename in sorted(files):
            path = Path(current) / filename

            if path.suffix.lower() not in {".html", ".htm"}:
                continue

            if path.is_symlink() or not path.is_file():
                continue

            if is_template_path(path, root):
                continue

            results.append(path)

    return sorted(results)


def is_after_hero(tag: Tag, hero: Tag | None) -> bool:
    if hero is None or tag is hero:
        return False

    try:
        comparison = hero.compare_document_position(tag)
    except Exception:
        comparison = None

    # BeautifulSoup's tree API differs from the browser DOM.
    # Use document-order indices rather than compare_document_position.
    if comparison is not None:
        return False

    elements = list(tag.find_parent().descendants) if tag.find_parent() else []
    del elements

    return True


def find_hero(soup: BeautifulSoup) -> Tag | None:
    candidates: list[Tag] = []

    for tag in soup.find_all(["header", "section", "div", "main"]):
        identity = element_identifiers(tag)

        if HERO_KEYWORDS.search(identity):
            candidates.append(tag)

    if not candidates:
        # Fall back to a semantic header only when it contains a heading.
        for tag in soup.find_all("header"):
            if tag.find(["h1", "h2"]):
                candidates.append(tag)

    if not candidates:
        return None

    # Prefer the smallest matching hero container to avoid animating
    # the entire page wrapper.
    return min(candidates, key=lambda item: len(list(item.descendants)))


def find_catalog_candidates(
    soup: BeautifulSoup,
    hero: Tag | None,
) -> list[Tag]:
    candidates: list[Tag] = []
    elements = list(soup.find_all(["section", "div", "article"]))

    if hero is not None:
        try:
            hero_index = elements.index(hero)
        except ValueError:
            hero_index = -1
    else:
        hero_index = -1

    for position, tag in enumerate(elements):
        if hero is not None and position <= hero_index:
            continue

        identity = element_identifiers(tag)

        if not CATALOG_KEYWORDS.search(identity):
            continue

        if tag.find_parent(attrs={"data-mo-catalog": True}):
            continue

        # Avoid selecting nested wrappers repeatedly.
        if any(
            CATALOG_KEYWORDS.search(element_identifiers(parent))
            for parent in tag.parents
            if isinstance(parent, Tag)
            and parent.name in {"section", "div", "article"}
            and parent is not soup
        ):
            continue

        candidates.append(tag)

    return candidates


def choose_cards(section: Tag) -> list[Tag]:
    """
    Find direct card-like descendants while retaining original card content.
    Existing links, images, titles and descriptions remain in the DOM.
    """
    descendants = section.find_all(["article", "li", "a", "div", "figure"])

    candidates: list[Tag] = []

    for tag in descendants:
        if tag.find_parent(attrs={"data-mo-catalog": True}):
            continue

        identity = element_identifiers(tag)
        has_heading = tag.find(["h2", "h3", "h4", "h5"]) is not None
        has_image = tag.find("img") is not None

        if CARD_KEYWORDS.search(identity) and (has_heading or has_image):
            candidates.append(tag)

    # Prefer outer card wrappers and remove nested card matches.
    selected: list[Tag] = []

    for candidate in candidates:
        nested_in_selected = any(
            candidate is ancestor or ancestor in candidate.parents
            for ancestor in selected
        )

        if nested_in_selected:
            continue

        selected.append(candidate)

    if len(selected) >= 2:
        return selected

    # Conservative fallback: direct children with headings or images.
    fallback: list[Tag] = []

    for child in section.find_all(recursive=False):
        if not isinstance(child, Tag):
            continue

        if child.name in {"h2", "h3", "p", "script", "style", "nav"}:
            continue

        if child.find(["h2", "h3", "h4", "h5"]) or child.find("img"):
            fallback.append(child)

    return fallback if len(fallback) >= 2 else []


def get_heading(section: Tag) -> str:
    heading = section.find(["h2", "h3"])

    if heading:
        text = heading.get_text(" ", strip=True)
        if text:
            return text

    aria_label = section.get("aria-label")

    if isinstance(aria_label, str) and aria_label.strip():
        return aria_label.strip()

    identifier = section.get("id") or "Explore our collection"
    identifier = re.sub(r"[-_]+", " ", str(identifier))
    return identifier.strip().title()


def get_section_description(section: Tag) -> str | None:
    for paragraph in section.find_all("p", limit=4):
        if paragraph.find_parent(["article", "li"]):
            continue

        text = paragraph.get_text(" ", strip=True)

        if text and len(text) > 15:
            return text

    return None


def has_meaningful_content(tag: Tag) -> bool:
    return bool(
        tag.find(["h2", "h3", "h4", "h5", "img", "picture", "a", "button"])
    )


def prepare_card(card: Tag) -> Tag:
    card["class"] = list(dict.fromkeys(
        list(card.get("class", [])) + ["mo-catalog-card"]
    ))

    if card.name == "a":
        if not card.get("href"):
            card["aria-label"] = (
                card.get_text(" ", strip=True) or "Catalog item"
            )

    # Retain meaningful original text and images.
    # Only wrap content when it is not already wrapped.
    if not card.find(class_="mo-catalog-card-content"):
        content = card.new_tag("div")
        content["class"] = ["mo-catalog-card-content"]

        for child in list(card.contents):
            if isinstance(child, Tag) and child.name in {
                "img", "picture", "video", "source"
            }:
                continue

            if isinstance(child, Tag) and child.name == "script":
                continue

            content.append(child.extract())

        card.append(content)

    if not card.find("img") and not card.find("picture"):
        icon = card.new_tag("span")
        icon["class"] = ["mo-card-icon"]
        icon["aria-hidden"] = "true"

        seed = hashlib.sha256(
            card.get_text(" ", strip=True).encode("utf-8")
        ).digest()[0]

        icon.string = EMOJIS[seed % len(EMOJIS)]

        content = card.find(class_="mo-catalog-card-content")
        if content:
            content.insert(0, icon)

    return card


def make_button(
    soup: BeautifulSoup,
    text: str,
    label: str,
    attribute: str,
) -> Tag:
    button = soup.new_tag("button")
    button["type"] = "button"
    button["class"] = ["mo-catalog-button"]
    button[attribute] = ""
    button["aria-label"] = label
    button.string = text
    return button


def enhance_catalog(
    soup: BeautifulSoup,
    section: Tag,
    cards: list[Tag],
    auto_slide: bool,
    interval_ms: int,
) -> int:
    heading_text = get_heading(section)
    description = get_section_description(section)

    # Preserve the existing section and its semantic identity.
    section["class"] = list(dict.fromkeys(
        list(section.get("class", [])) + ["mo-catalog-enhanced"]
    ))
    section["data-mo-catalog"] = "true"
    section["data-mo-auto-slide"] = "true" if auto_slide else "false"
    section["data-mo-interval"] = str(interval_ms)
    section["tabindex"] = section.get("tabindex", "0")
    section["aria-roledescription"] = "carousel"

    heading_id = section.get("id")

    if not heading_id:
        heading_id = "mo-catalog-" + hashlib.sha1(
            heading_text.encode("utf-8")
        ).hexdigest()[:10]
        section["id"] = heading_id

    section["aria-labelledby"] = (
        section.find(["h2", "h3"]).get("id")
        if section.find(["h2", "h3"]) and
        section.find(["h2", "h3"]).get("id")
        else heading_id + "-heading"
    )

    existing_heading = section.find(["h2", "h3"])

    if existing_heading:
        existing_heading["id"] = section["aria-labelledby"]

    else:
        heading = soup.new_tag("h2", id=section["aria-labelledby"])
        heading.string = heading_text
        section.insert(0, heading)

    heading = section.find(id=section["aria-labelledby"])

    if heading:
        heading["class"] = list(dict.fromkeys(
            list(heading.get("class", [])) + ["mo-catalog-title"]
        ))

    # Build a new carousel around the existing card elements.
    # Keep non-card content, headings, and descriptive paragraphs intact.
    viewport = soup.new_tag("div")
    viewport["class"] = ["mo-catalog-viewport"]
    viewport["aria-label"] = heading_text
    viewport["aria-live"] = "off"

    track = soup.new_tag("div")
    track["class"] = ["mo-catalog-track"]

    for start in range(0, len(cards), 4):
        page_cards = cards[start:start + 4]

        page = soup.new_tag("div")
        page["class"] = ["mo-catalog-page"]
        page["role"] = "group"
        page["aria-roledescription"] = "slide"
        page["aria-label"] = (
            f"Items {start + 1} through {start + len(page_cards)} "
            f"of {len(cards)}"
        )

        grid = soup.new_tag("div")
        grid["class"] = ["mo-catalog-grid"]

        for card in page_cards:
            # Detach from the original container before appending.
            card.extract()
            grid.append(prepare_card(card))

        page.append(grid)
        track.append(page)

    viewport.append(track)

    # Place the carousel after the section heading and intro paragraphs.
    # Preserve other non-card content rather than deleting it.
    insertion_point = heading

    if insertion_point:
        insertion_point.insert_after(viewport)
    else:
        section.append(viewport)

    controls = soup.new_tag("div")
    controls["class"] = ["mo-catalog-controls"]
    controls["aria-label"] = "Catalog navigation"

    previous = make_button(
        soup, "←", "Previous catalog page", "data-mo-previous"
    )
    next_button = make_button(
        soup, "→", "Next catalog page", "data-mo-next"
    )

    dots = soup.new_tag("div")
    dots["class"] = ["mo-catalog-dots"]
    dots["role"] = "group"
    dots["aria-label"] = "Choose catalog page"

    page_count = (len(cards) + 3) // 4

    for index in range(page_count):
        dot = soup.new_tag("button")
        dot["type"] = "button"
        dot["class"] = ["mo-catalog-dot"]
        dot["data-mo-dot"] = str(index)
        dot["aria-label"] = f"Go to catalog page {index + 1}"
        dot["aria-current"] = "true" if index == 0 else "false"
        dots.append(dot)

    controls.append(previous)
    controls.append(dots)
    controls.append(next_button)

    viewport.insert_after(controls)

    if description and not section.find(class_="mo-catalog-description"):
        paragraph = soup.new_tag("p")
        paragraph["class"] = ["mo-catalog-description"]
        paragraph.string = description

        heading.insert_after(paragraph)

    return len(cards)


def enhance_hero(hero: Tag | None) -> bool:
    if hero is None:
        return False

    classes = hero.get("class", [])

    if "mo-hero-enhanced" not in classes:
        hero["class"] = list(dict.fromkeys(
            list(classes) + ["mo-hero-enhanced"]
        ))

    if hero.get("data-mo-hero") == "true":
        return True

    hero["data-mo-hero"] = "true"

    heading = hero.find("h1")

    if heading:
        heading["data-mo-reveal"] = "true"

    existing = hero.find_all(class_="mo-hero-emoji")

    if existing:
        return True

    # Add subtle decorative accents without replacing the hero content.
    for index, emoji in enumerate(EMOJIS[:3]):
        element = hero.new_tag("span")
        element["class"] = ["mo-hero-emoji"]
        element["aria-hidden"] = "true"
        element["style"] = (
            f"--mo-emoji-top: {16 + index * 23}%; "
            f"--mo-emoji-left: {76 - index * 17}%;"
        )
        element.string = emoji
        hero.append(element)

    return True


def relative_asset_url(html_path: Path, asset_path: Path) -> str:
    parent = html_path.parent
    relative = os.path.relpath(asset_path, start=parent)
    return relative.replace(os.sep, "/")


def inject_asset_links(
    soup: BeautifulSoup,
    html_path: Path,
    root: Path,
) -> None:
    css_path = root / CSS_ASSET
    js_path = root / JS_ASSET

    css_url = relative_asset_url(html_path, CSS_ASSET)
    js_url = relative_asset_url(html_path, JS_ASSET)

    head = soup.head

    if head is None:
        html = soup.find("html")

        if html is None:
            html = soup.new_tag("html")
            for item in list(soup.contents):
                html.append(item.extract())
            soup.append(html)

        head = soup.new_tag("head")
        html.insert(0, head)

    existing_css = False

    for link in head.find_all("link", href=True):
        rel = link.get("rel", [])
        if isinstance(rel, str):
            rel = rel.split()

        href = str(link.get("href", ""))

        if "stylesheet" in rel and (
            "catalog-motion.css" in href
            or href == css_url
        ):
            existing_css = True
            break

    if not existing_css:
        link = soup.new_tag("link")
        link["rel"] = ["stylesheet"]
        link["href"] = css_url
        link["data-mo-asset"] = "catalog-motion"
        head.append(link)

    existing_js = False

    for script in soup.find_all("script", src=True):
        src = str(script.get("src", ""))

        if "catalog-motion.js" in src or src == js_url:
            existing_js = True
            break

    if not existing_js:
        script = soup.new_tag("script")
        script["src"] = js_url
        script["defer"] = True
        script["data-mo-asset"] = "catalog-motion"

        if soup.body:
            soup.body.append(script)
        else:
            soup.append(script)


def safe_backup(
    original: Path,
    root: Path,
    backup_root: Path,
) -> Path:
    relative = original.relative_to(root)
    destination = backup_root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists():
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        destination = destination.with_name(
            destination.name + "." + timestamp + ".bak"
        )

    shutil.copy2(original, destination)
    return destination


def transform_page(
    path: Path,
    root: Path,
    auto_slide: bool,
    interval_ms: int,
    apply: bool,
    backup: bool,
    backup_root: Path,
) -> PageResult:
    result = PageResult(path=str(path.relative_to(root)), status="skipped")

    try:
        raw_bytes = path.read_bytes()
        original = raw_bytes.decode("utf-8-sig")
    except (OSError, UnicodeError) as exc:
        result.status = "failed"
        result.reason = f"Cannot read UTF-8 HTML: {exc}"
        return result

    result.before_sha256 = sha256_text(original)

    soup = BeautifulSoup(original, "html.parser")
    hero = find_hero(soup)
    catalogs = find_catalog_candidates(soup, hero)

    result.catalogs_found = len(catalogs)

    if not catalogs and hero is None:
        result.reason = "No recognizable hero or catalog section found."
        return result

    # Modify only sections with enough identifiable cards.
    for section in catalogs:
        cards = choose_cards(section)

        if len(cards) < 2:
            continue

        try:
            count = enhance_catalog(
                soup=soup,
                section=section,
                cards=cards,
                auto_slide=auto_slide,
                interval_ms=interval_ms,
            )
        except Exception as exc:
            result.status = "failed"
            result.reason = (
                f"Could not safely enhance catalog section: {exc}"
            )
            return result

        result.catalogs_enhanced += 1
        result.cards_found += count

    result.hero_enhanced = enhance_hero(hero)

    if result.catalogs_enhanced == 0 and not result.hero_enhanced:
        result.reason = (
            "No safe transformation found; no source changes proposed."
        )
        return result

    inject_asset_links(soup, path, root)

    # Preserve a readable, stable HTML representation.
    updated = str(soup)

    # Avoid writing if there is no actual change.
    if updated == original:
        result.status = "unchanged"
        result.after_sha256 = result.before_sha256
        result.reason = "HTML was already enhanced."
        return result

    result.after_sha256 = sha256_text(updated)

    if not apply:
        result.status = "dry-run"
        result.reason = "Changes proposed; use --apply to write them."
        return result

    try:
        backup_path = None

        if backup:
            backup_path = safe_backup(path, root, backup_root)
            result.backup = str(backup_path)

        # Preserve original file permissions.
        mode = path.stat().st_mode

        temporary = path.with_name(path.name + ".medorbits-tmp")

        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as stream:
                stream.write(updated)
                stream.flush()
                os.fsync(stream.fileno())

            os.chmod(temporary, mode)
            os.replace(temporary, path)

        finally:
            if temporary.exists():
                temporary.unlink()

        result.status = "updated"
        result.reason = "HTML enhanced successfully."

    except OSError as exc:
        result.status = "failed"
        result.reason = f"Could not write updated HTML: {exc}"

    return result


def write_assets(root: Path, apply: bool) -> list[str]:
    outputs = {
        root / CSS_ASSET: CSS_CONTENT,
        root / JS_ASSET: JS_CONTENT,
    }

    planned: list[str] = []

    for path, content in outputs.items():
        planned.append(str(path.relative_to(root)))

        if not apply:
            continue

        path.parent.mkdir(parents=True, exist_ok=True)

        if path.exists():
            try:
                existing = path.read_text(encoding="utf-8")
            except (OSError, UnicodeError):
                raise RuntimeError(
                    f"Cannot safely inspect existing asset: {path}"
                )

            if existing == content:
                continue

            # Never overwrite an existing asset with unrelated content.
            if "MedOrbits Animated Catalog System" not in existing:
                raise RuntimeError(
                    f"Refusing to overwrite an unrelated asset: {path}. "
                    "Review or rename the existing file first."
                )

        temporary = path.with_name(path.name + ".medorbits-tmp")

        try:
            with temporary.open("w", encoding="utf-8", newline="\n") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())

            os.replace(temporary, path)

        finally:
            if temporary.exists():
                temporary.unlink()

    return planned


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Safely enhance MedOrbits HTML catalogs and hero sections."
        )
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=Path("."),
        help="Repository root directory (default: current directory).",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes. Without this option, the tool runs in dry-run mode.",
    )

    parser.add_argument(
        "--backup",
        action="store_true",
        help="Back up each modified HTML page before writing it.",
    )

    parser.add_argument(
        "--no-auto-slide",
        action="store_true",
        help="Disable automatic catalog rotation.",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=5000,
        help="Auto-slide interval in milliseconds; minimum 2500 (default: 5000).",
    )

    parser.add_argument(
        "--report",
        type=Path,
        default=REPORT_PATH,
        help="JSON audit report path, relative to the repository root by default.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help=(
            "Include hidden directories other than excluded dependency/"
            "template directories."
        ),
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {VERSION}",
    )

    args = parser.parse_args()

    if args.interval < 2500 or args.interval > 20000:
        parser.error("--interval must be between 2500 and 20000 milliseconds.")

    return args


def main() -> int:
    args = parse_args()

    try:
        root = args.root.resolve(strict=True)
    except OSError as exc:
        print(f"ERROR: Repository root does not exist: {exc}", file=sys.stderr)
        return 2

    if not root.is_dir():
        print("ERROR: --root must point to a directory.", file=sys.stderr)
        return 2

    report_path = args.report

    if not report_path.is_absolute():
        report_path = root / report_path

    report_path = report_path.resolve()

    # Never accidentally scan a backup directory.
    global EXCLUDED_DIRECTORY_NAMES
    EXCLUDED_DIRECTORY_NAMES = set(EXCLUDED_DIRECTORY_NAMES) | {
        BACKUP_DIRECTORY.name.lower(),
        report_path.parent.name.lower()
        if report_path.parent != root
        else "__report_output__",
    }

    html_files = discover_html(root)

    if not html_files:
        print("No eligible HTML pages found.")
        print("Templates, dependencies, and generated directories are excluded.")
        return 0

    print(f"MedOrbits catalog enhancer {VERSION}")
    print(f"Repository: {root}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")
    print(f"Eligible HTML pages: {len(html_files)}")
    print()

    backup_root = root / BACKUP_DIRECTORY

    results: list[PageResult] = []
    failures = 0

    for index, path in enumerate(html_files, start=1):
        result = transform_page(
            path=path,
            root=root,
            auto_slide=not args.no_auto_slide,
            interval_ms=args.interval,
            apply=args.apply,
            backup=args.backup,
            backup_root=backup_root,
        )

        results.append(result)

        if result.status == "failed":
            failures += 1

        print(
            f"[{index}/{len(html_files)}] "
            f"{result.status.upper():9} {result.path}"
        )

        if result.reason:
            print(f"    {result.reason}")

        if result.catalogs_enhanced:
            print(
                f"    Catalogs: {result.catalogs_enhanced}; "
                f"cards: {result.cards_found}"
            )

    planned_assets: list[str] = []

    changed_results = [
        item for item in results
        if item.status in {"updated", "dry-run"}
    ]

    if changed_results:
        try:
            planned_assets = write_assets(root, args.apply)

            for asset in planned_assets:
                print(
                    f"[{'READY' if args.apply else 'PLANNED'}] {asset}"
                )

        except (OSError, RuntimeError) as exc:
            failures += 1
            print(f"ERROR: Asset generation failed: {exc}", file=sys.stderr)

    report = {
        "tool": "MedOrbits Animated Catalog Enhancer",
        "version": VERSION,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "repository_root": str(root),
        "mode": "apply" if args.apply else "dry-run",
        "auto_slide": not args.no_auto_slide,
        "interval_ms": args.interval,
        "templates_excluded": True,
        "html_pages_discovered": len(html_files),
        "assets": planned_assets,
        "summary": {
            "updated": sum(r.status == "updated" for r in results),
            "dry_run": sum(r.status == "dry-run" for r in results),
            "skipped": sum(r.status == "skipped" for r in results),
            "unchanged": sum(r.status == "unchanged" for r in results),
            "failed": failures,
        },
        "pages": [asdict(result) for result in results],
    }

    try:
        if args.apply:
            report_path.parent.mkdir(parents=True, exist_ok=True)

            temporary = report_path.with_name(
                report_path.name + ".medorbits-tmp"
            )

            try:
                with temporary.open(
                    "w", encoding="utf-8", newline="\n"
                ) as stream:
                    json.dump(report, stream, indent=2, ensure_ascii=False)
                    stream.write("\n")
                    stream.flush()
                    os.fsync(stream.fileno())

                os.replace(temporary, report_path)

            finally:
                if temporary.exists():
                    temporary.unlink()

            print(f"\nAudit report: {report_path}")

        else:
            print("\nDry run complete. No HTML pages or assets were written.")
            print("Review the results, then rerun with --apply.")

    except OSError as exc:
        failures += 1
        print(f"ERROR: Could not write report: {exc}", file=sys.stderr)

    print("\nSummary")
    print("-------")

    for key, value in report["summary"].items():
        print(f"{key.replace('_', ' ').title():12}: {value}")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
