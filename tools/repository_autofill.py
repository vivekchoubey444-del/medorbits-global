
#!/usr/bin/env python3
"""
MedOrbits Repository Auto-Filler
================================

Purpose:
    Find and safely populate empty text files throughout a repository.
    Optionally create missing files from a manifest.
    Generate usable starter content for HTML, CSS, JavaScript, JSON,
    Python, Markdown, YAML, XML, SQL, SVG, shell, and other text files.

Safety:
    - Non-empty files are preserved by default.
    - Dry-run is enabled by default.
    - Existing empty files are backed up before being populated.
    - Writes are atomic.
    - Binary files and excluded directories are skipped.
    - Missing files are created only when listed in a manifest.
    - Reports are written outside the repository unless configured otherwise.

Python: 3.10+
Dependencies: Python standard library only.
"""

from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import html
import json
import os
import re
import shutil
import sys
import tempfile
import textwrap
import time
import xml.etree.ElementTree as ET

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VERSION = "1.0.0"

EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    ".next",
    ".nuxt",
    ".turbo",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "__pycache__",
    "node_modules",
    "vendor",
    "bower_components",
    "coverage",
    "dist",
    "build",
    "target",
    "out",
    "release",
    "debug",
    "venv",
    ".venv",
    "env",
    ".env",
    "site-packages",
}

EXCLUDED_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
}

TEXT_EXTENSIONS = {
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx",
    ".json", ".jsonc", ".json5", ".map",
    ".py", ".pyi",
    ".md", ".markdown", ".mdx", ".txt", ".rst",
    ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".xml", ".xhtml", ".svg",
    ".sql", ".sh", ".bash", ".zsh", ".fish",
    ".bat", ".cmd", ".ps1",
    ".gitignore", ".gitattributes", ".editorconfig",
    ".prettierrc", ".eslintrc", ".npmrc",
    ".properties", ".graphql", ".gql",
    ".proto", ".tf", ".hcl",
    ".csv", ".tsv",
    ".webmanifest", ".robots",
    ".lock", ".example", ".sample", ".template",
}

TEXT_FILENAMES = {
    "Dockerfile",
    "Makefile",
    "Justfile",
    "Procfile",
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "NOTICE",
    "CHANGELOG",
    "CONTRIBUTING",
    "SECURITY",
    "CODE_OF_CONDUCT",
    "SUPPORT",
    "README",
    "README.md",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".pre-commit-config.yaml",
    "requirements.txt",
    "Pipfile",
    "package.json",
    "tsconfig.json",
    "pyproject.toml",
    "pytest.ini",
    "ruff.toml",
    "tox.ini",
    "CITATION.cff",
}

BINARY_SIGNATURES = (
    b"\x89PNG\r\n\x1a\n",
    b"\xff\xd8\xff",
    b"GIF87a",
    b"GIF89a",
    b"PK\x03\x04",
    b"%PDF",
    b"\x7fELF",
    b"SQLite format 3",
)


@dataclass
class FileResult:
    path: str
    action: str
    reason: str
    sha256: str | None = None
    bytes_written: int = 0


@dataclass
class Settings:
    root: Path
    dry_run: bool = True
    overwrite_nonempty: bool = False
    create_missing: bool = False
    backups: bool = True
    max_file_bytes: int = 2_000_000
    manifest: Path | None = None
    report: Path | None = None


class RepositoryAutoFiller:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.root = settings.root.resolve()
        self.results: list[FileResult] = []
        self.created = 0
        self.skipped = 0
        self.failed = 0

        if not self.root.is_dir():
            raise ValueError(f"Repository root does not exist: {self.root}")

    # ---------------------------------------------------------
    # Logging and path safety
    # ---------------------------------------------------------

    def log(
        self,
        path: Path,
        action: str,
        reason: str,
        data: bytes | None = None,
    ) -> None:
        digest = (
            hashlib.sha256(data).hexdigest()
            if data is not None
            else None
        )

        self.results.append(
            FileResult(
                path=self.relative(path),
                action=action,
                reason=reason,
                sha256=digest,
                bytes_written=len(data) if data else 0,
            )
        )

        if action in {"created", "would_create", "filled", "would_fill"}:
            self.created += 1
        elif action == "failed":
            self.failed += 1
        else:
            self.skipped += 1

        print(f"[{action.upper():12}] {self.relative(path)}: {reason}")

    def relative(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.root).as_posix()
        except (ValueError, OSError):
            return str(path)

    def safe_path(self, value: str | Path) -> Path:
        candidate = (self.root / value).resolve()

        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise ValueError(
                f"Path escapes repository root: {value}"
            ) from exc

        return candidate

    def excluded(self, path: Path) -> bool:
        if path.name in EXCLUDED_FILES:
            return True

        if any(part in EXCLUDED_DIRS for part in path.parts):
            return True

        if path.is_symlink():
            return True

        return False

    def is_text_candidate(self, path: Path) -> bool:
        return (
            path.suffix.lower() in TEXT_EXTENSIONS
            or path.name in TEXT_FILENAMES
            or path.name.startswith(".")
            and path.suffix.lower() in TEXT_EXTENSIONS
        )

    # ---------------------------------------------------------
    # File scanning
    # ---------------------------------------------------------

    def scan(self) -> list[Path]:
        candidates: list[Path] = []

        for current, dirs, files in os.walk(self.root, followlinks=False):
            current_path = Path(current)

            dirs[:] = sorted(
                d for d in dirs
                if d not in EXCLUDED_DIRS
                and not (current_path / d).is_symlink()
            )

            for filename in sorted(files):
                path = current_path / filename

                if self.excluded(path):
                    continue

                if not self.is_text_candidate(path):
                    continue

                try:
                    if path.stat().st_size > self.settings.max_file_bytes:
                        self.log(path, "skipped", "File exceeds size limit")
                        continue

                    if path.stat().st_size == 0:
                        candidates.append(path)

                except OSError as exc:
                    self.log(path, "failed", f"Cannot inspect file: {exc}")

        return candidates

    # ---------------------------------------------------------
    # Content generators
    # ---------------------------------------------------------

    def html_content(self, path: Path) -> str:
        title = self.title_from_path(path)
        rel_root = self.relative_root(path)
        slug = path.stem.lower().replace("_", "-")

        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#32101f">
  <meta name="description" content="{html.escape(title)} -- MedOrbits education, admissions and career guidance.">
  <meta name="robots" content="index, follow">
  <title>{html.escape(title)} | MedOrbits</title>
  <link rel="stylesheet" href="{rel_root}assets/css/style.css">
  <link rel="stylesheet" href="{rel_root}assets/css/pages.css">
</head>
<body>
  <a class="skip-link" href="#main-content">Skip to main content</a>

  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="{rel_root}index.html" aria-label="MedOrbits home">
        <span class="brand-mark" aria-hidden="true">M</span>
        <span class="brand-copy">
          <strong>MedOrbits</strong>
          <small>Study · Career · Consultancy</small>
        </span>
      </a>
      <nav class="main-nav" aria-label="Main navigation">
        <a href="{rel_root}index.html">Home</a>
        <a href="{rel_root}pages/about.html">About</a>
        <a href="{rel_root}education/index.html">Education</a>
        <a href="{rel_root}career/index.html">Careers</a>
        <a href="{rel_root}pages/contact.html">Contact</a>
      </nav>
    </div>
  </header>

  <main id="main-content" class="container page-content" data-page="{slug}">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="{rel_root}index.html">Home</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{html.escape(title)}</span>
    </nav>

    <section class="page-hero">
      <p class="eyebrow">MedOrbits · Information and guidance</p>
      <h1>{html.escape(title)}</h1>
      <p>
        Explore information, guidance and useful resources from MedOrbits.
        Confirm important admission, fee, eligibility and career details
        with the relevant official institution or authority.
      </p>
      <a class="button button-primary" href="{rel_root}pages/contact.html">
        Request Guidance
      </a>
    </section>

    <section class="content-section">
      <h2>Overview</h2>
      <p>
        This page is ready for verified, page-specific content. Add relevant
        information, official sources, eligibility requirements, useful
        resources and next steps before publishing it to visitors.
      </p>
    </section>

    <section class="content-section">
      <h2>Explore related resources</h2>
      <div class="resource-grid">
        <a class="resource-card" href="{rel_root}education/index.html">
          <h3>Education</h3>
          <p>Explore courses and educational pathways.</p>
        </a>
        <a class="resource-card" href="{rel_root}career/index.html">
          <h3>Careers</h3>
          <p>Explore career resources and opportunities.</p>
        </a>
        <a class="resource-card" href="{rel_root}pages/contact.html">
          <h3>Get Guidance</h3>
          <p>Contact MedOrbits with your enquiry.</p>
        </a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© <span id="currentYear"></span> MedOrbits. All rights reserved.</p>
      <nav aria-label="Legal navigation">
        <a href="{rel_root}legal/terms.html">Terms</a>
        <a href="{rel_root}legal/privacy-policy.html">Privacy</a>
        <a href="{rel_root}legal/contact-details.html">Contact details</a>
      </nav>
    </div>
  </footer>

  <script src="{rel_root}assets/js/main.js" defer></script>
</body>
</html>
"""

    def relative_root(self, path: Path) -> str:
        depth = len(Path(self.relative(path)).parent.parts)

        if self.relative(path).startswith("."):
            depth = max(0, depth)

        return "../" * depth

    def title_from_path(self, path: Path) -> str:
        name = path.stem
        name = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
        name = re.sub(r"[-_]+", " ", name)
        name = re.sub(r"\s+", " ", name).strip()

        if name.lower() in {"index", "home"}:
            parent = path.parent.name
            return parent.replace("-", " ").replace("_", " ").title() or "Home"

        return name.title() or "MedOrbits"

    def json_content(self, path: Path) -> str:
        name = path.stem.lower()

        if name in {"package", "package.json"}:
            data: Any = {
                "name": "medorbits",
                "version": "1.0.0",
                "private": True,
                "description": "MedOrbits education and career platform",
            }
        elif name in {"tsconfig"}:
            data = {
                "compilerOptions": {
                    "target": "ES2022",
                    "module": "ESNext",
                    "strict": True,
                    "skipLibCheck": True,
                    "resolveJsonModule": True,
                },
                "include": ["**/*.ts", "**/*.tsx"],
                "exclude": ["node_modules", "dist", "build"],
            }
        elif name in {"manifest", "site.webmanifest"}:
            data = {
                "name": "MedOrbits",
                "short_name": "MedOrbits",
                "description": "Education, admissions and career guidance",
                "start_url": "/index.html",
                "display": "standalone",
                "theme_color": "#32101f",
                "background_color": "#170b12",
            }
        elif "schema" in name:
            data = {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "title": self.title_from_path(path),
                "description": "Replace with the documented schema for this resource.",
                "type": "object",
                "properties": {},
                "additionalProperties": True,
            }
        elif any(word in name for word in (
            "college", "course", "university", "job", "career",
            "scholarship", "testimonial", "notification", "news",
            "hostel", "faq", "service", "exam",
        )):
            data = []
        else:
            data = {
                "name": self.title_from_path(path),
                "version": "1.0.0",
                "description": "Replace with verified project data.",
                "items": [],
            }

        return json.dumps(data, indent=2, ensure_ascii=False) + "\n"

    def javascript_content(self, path: Path) -> str:
        name = path.stem
        safe_name = re.sub(r"[^a-zA-Z0-9_$]", "", name) or "module"
        module_name = safe_name[0].lower() + safe_name[1:]

        if path.suffix.lower() in {".cjs"}:
            return f"""'use strict';

/**
 * MedOrbits module: {name}
 * Add documented functionality here.
 */

function {module_name}() {{
  return {{
    ready: true,
    name: '{name}',
  }};
}}

module.exports = {{ {module_name} }};
"""

        if path.suffix.lower() in {".jsx", ".tsx"}:
            return f"""/**
 * MedOrbits component: {name}
 * Add the project's required UI framework and component implementation.
 */

export default function {safe_name}() {{
  return (
    <section aria-label="{name}">
      <h2>{name}</h2>
      <p>Component content is ready to be implemented.</p>
    </section>
  );
}}
"""

        return f"""/**
 * MedOrbits module: {name}
 * Add page-specific functionality here.
 *
 * Keep DOM access guarded so this module can be imported in tests.
 */

export function init{safe_name}() {{
  if (typeof document === "undefined") return;

  const root = document.querySelector("[data-module=\\"{module_name}\\"]");
  if (!root) return;

  root.dataset.initialized = "true";
}}

if (typeof document !== "undefined") {{
  if (document.readyState === "loading") {{
    document.addEventListener("DOMContentLoaded", init{safe_name}, {{ once: true }});
  }} else {{
    init{safe_name}();
  }}
}}
"""

    def css_content(self, path: Path) -> str:
        return f"""/*
 * MedOrbits stylesheet: {path.name}
 * Theme: burgundy, champagne and forest green.
 * Keep this file responsive and compatible with reduced-motion preferences.
 */

:root {{
  --mo-bg: #170b12;
  --mo-surface: #28131e;
  --mo-wine: #511a31;
  --mo-gold: #d7b77c;
  --mo-text: #f8f1f3;
  --mo-muted: #bba4ae;
  --mo-green: #174b39;
  --mo-green-pale: #c4f3dc;
  --mo-border: rgba(215, 183, 124, 0.2);
  --mo-radius: 16px;
}}

.{path.stem.replace('.', '-')}-root {{
  color: var(--mo-text);
  background:
    radial-gradient(ellipse at 10% 0%, rgba(81, 26, 49, 0.25), transparent 40%),
    linear-gradient(135deg, var(--mo-bg), var(--mo-surface));
}}

.container {{
  width: min(1180px, calc(100% - 32px));
  margin-inline: auto;
}}

.resource-grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
  gap: 16px;
}}

.resource-card {{
  padding: 20px;
  border: 1px solid var(--mo-border);
  border-radius: var(--mo-radius);
  background: rgba(40, 19, 30, 0.92);
  color: var(--mo-text);
  transition: transform 180ms ease, border-color 180ms ease;
}}

.resource-card:hover {{
  transform: translateY(-3px);
  border-color: var(--mo-gold);
}}

@media (max-width: 600px) {{
  .container {{
    width: calc(100% - 24px);
  }}
}}

@media (prefers-reduced-motion: reduce) {{
  *,
  *::before,
  *::after {{
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }}
}}
"""

    def python_content(self, path: Path) -> str:
        module = path.stem

        return f'''"""
MedOrbits module: {module}

Replace this starter implementation with documented, tested functionality.
"""

from __future__ import annotations


def main() -> int:
    """Run this module's entry point."""
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''

    def markdown_content(self, path: Path) -> str:
        title = self.title_from_path(path)

        if path.name.lower().startswith("readme"):
            return f"""# MedOrbits

Education, admissions and career guidance platform.

## Project structure

- `pages/` -- public website pages
- `assets/css/` -- shared stylesheets
- `assets/js/` -- browser-side functionality
- `data/` -- curated structured data
- `api/` -- API routes and schemas
- `tests/` -- automated tests
- `tools/` -- repository maintenance tools

## Development

1. Review the project's package and runtime requirements.
2. Configure environment variables using a local, untracked environment file.
3. Validate generated JSON and source files.
4. Run the project's tests and security checks before deployment.

## Content policy

Verify admissions, fee, eligibility and career claims against authoritative
sources. Do not publish placeholder records as verified information.

## Contact

Website: https://medorbits.in
"""
        return f"""# {title}

## Purpose

Document the purpose and scope of this resource.

## Usage

Add verified project-specific instructions here.

## Validation

Confirm that links, examples, configuration values and operational steps
match the current repository before publication.
"""

    def yaml_content(self, path: Path) -> str:
        name = path.name.lower()

        if "docker-compose" in name or name == "compose.yaml":
            return """services:
  web:
    build: .
    restart: unless-stopped
    ports:
      - "${PORT:-8080}:8080"
    environment:
      NODE_ENV: production
"""
        if "workflow" in str(path).lower() or ".github" in str(path):
            return """name: Repository Validation

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Check repository state
        run: |
          git status --short
          python --version
"""
        return f"""# MedOrbits configuration: {path.name}
# Replace these comments with validated configuration for the relevant tool.
# Do not store passwords, API keys, tokens or private credentials here.
"""

    def xml_content(self, path: Path) -> str:
        if path.suffix.lower() == ".svg":
            return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-labelledby="title">
  <title id="title">MedOrbits mark placeholder</title>
  <rect width="120" height="120" rx="24" fill="#32101f"/>
  <path d="M25 88V32h12l23 30 23-30h12v56H82V52L60 79 38 52v36z" fill="#c4f3dc"/>
</svg>
"""
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<resource name="{html.escape(self.title_from_path(path))}">
  <!-- Add the required XML elements and namespace for this resource. -->
</resource>
"""

    def sql_content(self, path: Path) -> str:
        return f"""-- MedOrbits SQL starter: {path.name}
-- Review against the actual database engine and existing schema before use.
-- Do not execute migrations against production without review and backup.

-- TODO: Define tables, constraints, indexes and migration strategy.
-- Use parameterized queries in application code.
"""

    def shell_content(self, path: Path) -> str:
        if path.suffix.lower() in {".bat", ".cmd"}:
            return f"""@echo off
REM MedOrbits script: {path.name}
setlocal
echo MedOrbits repository task: {path.stem}
exit /b 0
"""
        return f"""#!/usr/bin/env bash
# MedOrbits script: {path.name}
set -Eeuo pipefail

main() {{
  printf '%s\\\\n' 'MedOrbits repository task: {path.stem}'
}}

main "$@"
"""

    def content_for(self, path: Path) -> bytes:
        suffix = path.suffix.lower()
        name = path.name.lower()

        if suffix in {".html", ".htm"}:
            content = self.html_content(path)
        elif suffix in {".json", ".jsonc", ".json5", ".map", ".webmanifest"}:
            # JSONC and JSON5 files receive valid strict JSON starter content.
            content = self.json_content(path)
        elif suffix in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}:
            content = self.javascript_content(path)
        elif suffix in {".css", ".scss", ".sass", ".less"}:
            content = self.css_content(path)
        elif suffix in {".py", ".pyi"}:
            content = self.python_content(path)
        elif suffix in {".md", ".markdown", ".mdx", ".rst"} or name.startswith("readme"):
            content = self.markdown_content(path)
        elif suffix in {".yaml", ".yml"}:
            content = self.yaml_content(path)
        elif suffix in {".xml", ".xhtml"}:
            content = self.xml_content(path)
        elif suffix == ".svg":
            content = self.xml_content(path)
        elif suffix == ".sql":
            content = self.sql_content(path)
        elif suffix in {".sh", ".bash", ".zsh", ".fish", ".bat", ".cmd"}:
            content = self.shell_content(path)
        elif suffix in {".toml", ".ini", ".cfg", ".conf", ".properties"}:
            content = (
                "# MedOrbits configuration\n"
                "# Add validated tool-specific configuration here.\n"
                "# Never place secrets in tracked files.\n"
            )
        elif suffix in {".csv", ".tsv"}:
            delimiter = "\t" if suffix == ".tsv" else ","
            content = delimiter.join(["id", "name", "description"]) + "\n"
        elif name in {".gitignore"}:
            content = """# Local secrets and environment files
.env
.env.*
!.env.example

# Dependencies and generated files
node_modules/
__pycache__/
.pytest_cache/
.coverage
dist/
build/

# Local editor and operating-system files
.DS_Store
Thumbs.db
"""
        elif name in {"license", "license.md", "license.txt"}:
            content = (
                "License\n=======\n\n"
                "Add the complete license text selected for this project "
                "before distribution.\n"
            )
        else:
            content = (
                f"# MedOrbits starter file: {path.name}\n"
                "# Add the format-specific content required by this project.\n"
            )

        return content.encode("utf-8")

    # ---------------------------------------------------------
    # Atomic writes and backups
    # ---------------------------------------------------------

    def backup(self, path: Path) -> None:
        if not self.settings.backups or not path.exists():
            return

        if path.stat().st_size != 0:
            return

        backup_dir = self.root / ".repository-autofill-backups"
        backup_dir.mkdir(parents=True, exist_ok=True)

        relative = path.relative_to(self.root)
        backup_path = backup_dir / relative
        backup_path.parent.mkdir(parents=True, exist_ok=True)

        if not backup_path.exists():
            shutil.copy2(path, backup_path)

    def atomic_write(self, path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)

        fd, temp_name = tempfile.mkstemp(
            prefix=f".{path.name}.",
            suffix=".tmp",
            dir=str(path.parent),
        )
        temp_path = Path(temp_name)

        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())

            os.replace(temp_path, path)

            if path.suffix.lower() in {".sh", ".bash", ".zsh"}:
                try:
                    path.chmod(path.stat().st_mode | 0o111)
                except OSError:
                    pass

        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass

    def process_empty_file(self, path: Path) -> None:
        try:
            if not path.exists() or path.stat().st_size != 0:
                self.log(path, "skipped", "File is no longer empty")
                return

            data = self.content_for(path)

            if self.settings.dry_run:
                self.log(path, "would_fill", "Would populate empty file", data)
                return

            self.backup(path)
            self.atomic_write(path, data)
            self.log(path, "filled", "Populated empty file", data)

        except Exception as exc:
            self.log(path, "failed", str(exc))

    # ---------------------------------------------------------
    # Manifest handling
    # ---------------------------------------------------------

    def load_manifest(self) -> list[Path]:
        if not self.settings.manifest:
            return []

        manifest = self.settings.manifest.resolve()

        if not manifest.is_file():
            raise FileNotFoundError(f"Manifest not found: {manifest}")

        raw = json.loads(manifest.read_text(encoding="utf-8"))

        if isinstance(raw, dict):
            entries = raw.get("files", [])
        elif isinstance(raw, list):
            entries = raw
        else:
            raise ValueError("Manifest must be a JSON array or an object with 'files'")

        if not isinstance(entries, list):
            raise ValueError("Manifest 'files' must be an array")

        paths: list[Path] = []

        for entry in entries:
            if not isinstance(entry, str) or not entry.strip():
                continue

            path = self.safe_path(entry.strip())

            if self.excluded(path):
                self.log(path, "skipped", "Excluded manifest path")
                continue

            if not self.is_text_candidate(path):
                self.log(path, "skipped", "Unsupported or non-text extension")
                continue

            paths.append(path)

        return paths

    def create_missing_file(self, path: Path) -> None:
        try:
            if path.exists():
                if path.stat().st_size == 0:
                    self.process_empty_file(path)
                else:
                    self.log(path, "skipped", "Existing non-empty file preserved")
                return

            data = self.content_for(path)

            if self.settings.dry_run:
                self.log(path, "would_create", "Would create manifest file", data)
                return

            self.atomic_write(path, data)
            self.log(path, "created", "Created manifest file", data)

        except Exception as exc:
            self.log(path, "failed", str(exc))

    # ---------------------------------------------------------
    # Basic generated-content checks
    # ---------------------------------------------------------

    def validate_generated_content(self, path: Path, data: bytes) -> str | None:
        try:
            text = data.decode("utf-8")
        except UnicodeDecodeError:
            return "Generated content is not UTF-8"

        suffix = path.suffix.lower()

        if suffix in {".json", ".map", ".webmanifest"}:
            try:
                json.loads(text)
            except json.JSONDecodeError as exc:
                return f"Invalid JSON content: {exc}"

        if suffix in {".py", ".pyi"}:
            try:
                ast.parse(text, filename=str(path))
            except SyntaxError as exc:
                return f"Invalid Python syntax: {exc}"

        if suffix in {".xml", ".xhtml", ".svg"}:
            try:
                ET.fromstring(text)
            except ET.ParseError as exc:
                return f"Invalid XML content: {exc}"

        if not text.strip():
            return "Generated content is empty"

        return None

    # ---------------------------------------------------------
    # Report
    # ---------------------------------------------------------

    def write_report(self) -> None:
        report_path = self.settings.report

        if report_path is None:
            report_path = self.root / "repository-autofill-report.json"
        else:
            report_path = report_path.resolve()

        payload = {
            "tool": "MedOrbits Repository Auto-Filler",
            "version": VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository": str(self.root),
            "dry_run": self.settings.dry_run,
            "summary": {
                "created_or_filled_or_planned": self.created,
                "skipped": self.skipped,
                "failed": self.failed,
                "total": len(self.results),
            },
            "results": [asdict(item) for item in self.results],
        }

        if self.settings.dry_run:
            print("\nDry-run: report was not written.")
            print(json.dumps(payload["summary"], indent=2))
            return

        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"\nReport: {report_path}")
        except OSError as exc:
            print(f"Could not write report: {exc}", file=sys.stderr)

    # ---------------------------------------------------------
    # Main run
    # ---------------------------------------------------------

    def run(self) -> int:
        print(f"MedOrbits Repository Auto-Filler v{VERSION}")
        print(f"Repository: {self.root}")
        print(f"Mode: {'DRY RUN' if self.settings.dry_run else 'WRITE'}")
        print("-" * 72)

        empty_files = self.scan()

        for path in empty_files:
            self.process_empty_file(path)

        if self.settings.create_missing:
            for path in self.load_manifest():
                if not path.exists():
                    self.create_missing_file(path)
                elif path.stat().st_size == 0:
                    # Avoid processing the same empty file twice.
                    if path not in empty_files:
                        self.process_empty_file(path)
                else:
                    self.log(path, "skipped", "Existing non-empty file preserved")

        print("-" * 72)
        print(f"Created/filled/planned: {self.created}")
        print(f"Skipped:                {self.skipped}")
        print(f"Failed:                 {self.failed}")

        self.write_report()
        return 1 if self.failed else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safely populate empty text files in a MedOrbits repository."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root directory (default: current directory).",
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write files. Without this flag, the script performs a dry run.",
    )

    parser.add_argument(
        "--create-missing",
        action="store_true",
        help="Create missing files listed in --manifest.",
    )

    parser.add_argument(
        "--manifest",
        help="JSON manifest listing additional file paths relative to repository root.",
    )

    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not back up empty files before filling them.",
    )

    parser.add_argument(
        "--max-file-bytes",
        type=int,
        default=2_000_000,
        help="Skip candidate files larger than this size.",
    )

    parser.add_argument(
        "--report",
        help="Path for JSON report. Defaults to repository-autofill-report.json.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.max_file_bytes < 1:
        parser.error("--max-file-bytes must be positive")

    try:
        root = Path(args.root).expanduser().resolve()
        manifest = Path(args.manifest).expanduser() if args.manifest else None
        report = Path(args.report).expanduser() if args.report else None

        settings = Settings(
            root=root,
            dry_run=not args.apply,
            create_missing=args.create_missing,
            backups=not args.no_backup,
            max_file_bytes=args.max_file_bytes,
            manifest=manifest,
            report=report,
        )

        return RepositoryAutoFiller(settings).run()

    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
