
#!/usr/bin/env python3
“””
MEDORBITS - REPOSITORY-WIDE REPAIR ENGINE
File: tools/repository_repair.py
Version: 2.0.0

Features:
    - Recursive repository discovery.
    - Optional baseline comparison for new and removed files.
    - Python, JavaScript, JSON, HTML and CSS checks.
    - Local HTML/CSS reference detection.
    - package.json validation.
    - Conservative automatic repairs.
    - Backups before source modifications.
    - Before/after validation.
    - JSON and Markdown reports.
    - Optional npm dependency inspection.
    - No destructive Git operations.
    - No deployment or database migrations.

Requirements:
    Python >= 3.10
    Node.js >= 20 (optional)
    npm (optional)
    No mandatory third-party Python dependencies.

Usage:
    python tools/repository_repair.py
    python tools/repository_repair.py —dry-run
    python tools/repository_repair.py —fix
    python tools/repository_repair.py —fix —dependencies
    python tools/repository_repair.py —root .
    python tools/repository_repair.py —baseline
    python tools/repository_repair.py —compare-baseline

Safety:
    Automatic repair is limited to UTF-8 BOM removal and line-ending
    normalization. It does not rewrite application logic or dependencies.
“””

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import tokenize

from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


VERSION = “2.0.0”

EXCLUDED_DIRS = {
    “.git”,
    “.next”,
    “.nuxt”,
    “.cache”,
    “.venv”,
    “venv”,
    “node_modules”,
    “__pycache__”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “coverage”,
    “dist”,
    “build”,
    “.turbo”,
    “.idea”,
    “.vscode”,
    “vendor”,
    “target”,
    “.repair-backups”,
}

TEXT_EXTENSIONS = {
    “.py”, “.js”, “.mjs”, “.cjs”,
    “.jsx”, “.ts”, “.tsx”,
    “.json”, “.jsonc”,
    “.html”, “.htm”,
    “.css”, “.scss”, “.sass”,
    “.xml”, “.svg”, “.yml”, “.yaml”,
    “.toml”, “.ini”, “.cfg”,
    “.md”, “.txt”, “.sh”,
    “.bash”, “.bat”, “.ps1”, “.sql”,
    “.webmanifest”, “.gitignore”,
    “.env.example”,
}

SPECIAL_FILENAMES = {
    “Dockerfile”,
    “Makefile”,
    “Procfile”,
    “.npmrc”,
    “.nvmrc”,
    “.editorconfig”,
}

REFERENCE_ATTRIBUTES = {
    “href”,
    “src”,
    “poster”,
    “action”,
    “data-src”,
    “data-href”,
}

SKIP_SCHEMES = {
    “http”,
    “https”,
    “mailto”,
    “tel”,
    “data”,
    “javascript”,
    “blob”,
    “ftp”,
}

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_REPORT_SIZE = 20 * 1024 * 1024

BASELINE_FILE = “.repository-repair-baseline.json”


class RepairError(Exception):
    “””Raised when a repository safety operation fails.”””


class HTMLReferenceParser(HTMLParser):
    “””Extract local references and IDs from HTML.”””

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._handle_attributes(attrs)

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self._handle_attributes(attrs)

    def _handle_attributes(self, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if value is None:
                continue

            key = name.lower()

            if key in REFERENCE_ATTRIBUTES:
                self.references.append(value)

            elif key == “srcset”:
                for item in value.split(“,”):
                    candidate = item.strip().split()
                    if candidate:
                        self.references.append(candidate[0])

            elif key == “id”:
                if value in self.ids:
                    self.duplicate_ids.add(value)
                self.ids.add(value)


class RepositoryRepair:
    def __init__(
        self,
        root: Path,
        fix: bool = False,
        dependencies: bool = False,
        dry_run: bool = False,
        strict: bool = False,
        compare_baseline: bool = False,
    ) -> None:
        self.root = root.resolve(strict=True)
        self.fix = fix
        self.dependencies = dependencies
        self.dry_run = dry_run
        self.strict = strict
        self.compare_baseline = compare_baseline

        self.backup_root = self.root / “.repair-backups”
        self.timestamp = datetime.now(timezone.utc).strftime(
            “%Y%m%dT%H%M%S%fZ”
        )

        self.results: list[dict[str, Any]] = []
        self.scanned = 0
        self.repaired = 0
        self.errors = 0
        self.warnings = 0
        self.skipped = 0

        self.files: list[Path] = []
        self.before_errors: int | None = None
        self.after_errors: int | None = None

    def relative(self, path: Path) -> str:
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def log(
        self,
        level: str,
        category: str,
        file: str,
        message: str,
    ) -> None:
        record = {
            “level”: level,
            “category”: category,
            “file”: file,
            “message”: message,
        }

        self.results.append(record)

        if level == “ERROR”:
            self.errors += 1
        elif level == “WARNING”:
            self.warnings += 1
        elif level == “FIXED”:
            self.repaired += 1

        print(f”[{level}] [{category}] {file}: {message}”)

    def safe_path(self, path: Path, allow_missing: bool = False) -> Path:
        “””Reject paths outside the repository and symlink components.”””
        absolute = Path(os.path.abspath(path))

        try:
            relative = absolute.relative_to(self.root)
        except ValueError as exc:
            raise RepairError(“Path is outside repository root.”) from exc

        current = self.root

        for index, component in enumerate(relative.parts):
            current = current / component

            if current.is_symlink():
                raise RepairError(
                    f”Symbolic link is not allowed: {self.relative(current)}”
                )

            if not current.exists() and not allow_missing:
                raise RepairError(
                    f”Path does not exist: {self.relative(current)}”
                )

            if index < len(relative.parts) - 1 and current.exists():
                if not current.is_dir():
                    raise RepairError(
                        f”Parent component is not a directory: “
                        f”{self.relative(current)}”
                    )

        return absolute

    def discover_files(self) -> list[Path]:
        discovered: list[Path] = []

        for directory, dirs, filenames in os.walk(
            self.root,
            topdown=True,
            followlinks=False,
        ):
            current = Path(directory)

            dirs[:] = sorted(
                name
                for name in dirs
                if name not in EXCLUDED_DIRS
                and not (current / name).is_symlink()
            )

            for filename in sorted(filenames):
                path = current / filename

                if path.is_symlink():
                    self.skipped += 1
                    continue

                if filename in SPECIAL_FILENAMES:
                    discovered.append(path)
                elif path.suffix.lower() in TEXT_EXTENSIONS:
                    discovered.append(path)

        return sorted(discovered)

    def read_text(self, path: Path) -> str | None:
        try:
            self.safe_path(path)
            if path.stat().st_size > MAX_FILE_SIZE:
                self.log(
                    “WARNING”,
                    “SIZE”,
                    self.relative(path),
                    “File exceeds the 10 MB inspection limit.”,
                )
                self.skipped += 1
                return None

            with tokenize.open(path) as file:
                return file.read()

        except (OSError, UnicodeError, SyntaxError, LookupError) as exc:
            self.log(
                “WARNING”,
                “READ”,
                self.relative(path),
                f”File could not be read as text: {exc}”,
            )
            self.skipped += 1
            return None

    def backup(self, path: Path) -> Path:
        “””Create an exclusive backup before modifying a source file.”””
        self.safe_path(path)

        if not path.is_file():
            raise RepairError(“Backup source is not a regular file.”)

        relative = path.relative_to(self.root)
        destination = (
            self.backup_root
            / self.timestamp
            / relative
        )

        self.safe_path(destination.parent, allow_missing=True)

        destination.parent.mkdir(parents=True, exist_ok=True)

        # Recheck after directory creation.
        self.safe_path(destination.parent)

        source_data = path.read_bytes()
        source_mode = path.stat().st_mode & 0o777

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, “O_NOFOLLOW”):
            flags |= os.O_NOFOLLOW

        fd = os.open(destination, flags, 0o600)

        try:
            with os.fdopen(fd, “wb”) as output:
                output.write(source_data)
                output.flush()
                os.fsync(output.fileno())

            os.chmod(destination, source_mode)

        except Exception:
            destination.unlink(missing_ok=True)
            raise

        return destination

    def safe_write(
        self,
        path: Path,
        content: str,
        category: str,
    ) -> bool:
        “””Back up and atomically replace a source file.”””
        import stat

        try:
            self.safe_path(path)

            original = path.read_bytes()
            new_data = content.encode(“utf-8”)

            if original == new_data:
                return False

            if not self.fix or self.dry_run:
                self.log(
                    “WARNING”,
                    category,
                    self.relative(path),
                    “A safe repair is available but was not applied.”,
                )
                return False

            backup_path = self.backup(path)
            self.log(
                “INFO”,
                “BACKUP”,
                self.relative(path),
                f”Backup created: {self.relative(backup_path)}”,
            )

            mode = stat.S_IMODE(path.stat().st_mode)

            fd, temporary_name = tempfile.mkstemp(
                prefix=f”.{path.name}.repair-“,
                suffix=“.tmp”,
                dir=path.parent,
            )
            temporary = Path(temporary_name)

            try:
                os.fchmod(fd, mode)

                with os.fdopen(fd, “wb”) as output:
                    output.write(new_data)
                    output.flush()
                    os.fsync(output.fileno())

                self.safe_path(path)

                os.replace(temporary, path)

            finally:
                temporary.unlink(missing_ok=True)

            self.log(
                “FIXED”,
                category,
                self.relative(path),
                “Applied conservative text-format repair.”,
            )
            return True

        except (OSError, ValueError, RepairError) as exc:
            self.log(
                “ERROR”,
                “REPAIR”,
                self.relative(path),
                str(exc),
            )
            return False

    def repair_text_format(self, path: Path, content: str) -> str:
        “””Only remove BOM and normalize CRLF/CR line endings.”””
        repaired = content.lstrip(“\ufeff”)
        repaired = repaired.replace(“\r\n”, “\n”).replace(“\r”, “\n”)

        if repaired != content:
            if self.fix and not self.dry_run:
                if self.safe_write(path, repaired, “TEXT_FORMAT”):
                    return repaired

            elif self.dry_run:
                self.log(
                    “WARNING”,
                    “TEXT_FORMAT”,
                    self.relative(path),
                    “BOM or non-LF line endings detected; dry-run only.”,
                )

        return repaired

    def check_json(self, path: Path, content: str) -> None:
        if path.suffix.lower() not in {“.json”, “.webmanifest”}:
            return

        try:
            json.loads(content)
        except json.JSONDecodeError as exc:
            self.log(
                “ERROR”,
                “JSON”,
                self.relative(path),
                f”Line {exc.lineno}, column {exc.colno}: {exc.msg}”,
            )

    def check_python(self, path: Path, content: str) -> None:
        if path.suffix.lower() != “.py”:
            return

        try:
            ast.parse(content, filename=str(path))
        except SyntaxError as exc:
            self.log(
                “ERROR”,
                “PYTHON”,
                self.relative(path),
                f”Line {exc.lineno}, column {exc.offset}: {exc.msg}”,
            )

    def check_javascript(self, path: Path) -> None:
        if path.suffix.lower() not in {“.js”, “.mjs”, “.cjs”}:
            return

        node = shutil.which(“node”)

        if not node:
            self.log(
                “WARNING”,
                “JAVASCRIPT”,
                self.relative(path),
                “Node.js unavailable; syntax check skipped.”,
            )
            return

        try:
            result = subprocess.run(
                [node, “—check”, str(path)],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            if result.returncode:
                message = result.stderr.strip() or result.stdout.strip()
                self.log(
                    “ERROR”,
                    “JAVASCRIPT”,
                    self.relative(path),
                    message[:4000],
                )

        except subprocess.TimeoutExpired:
            self.log(
                “WARNING”,
                “JAVASCRIPT”,
                self.relative(path),
                “Syntax check timed out.”,
            )

    def check_css(self, path: Path, content: str) -> None:
        if path.suffix.lower() not in {“.css”, “.scss”, “.sass”}:
            return

        # Lightweight lexical scan. Ignores comments and quoted strings.
        stack: list[tuple[str, int]] = []
        pairs = {“}”: “{“, “)”: “(“, “]”: “[“}

        quote: str | None = None
        escaped = False
        in_comment = False
        index = 0

        while index < len(content):
            char = content[index]
            next_char = content[index + 1] if index + 1 < len(content) else “”

            if in_comment:
                if char == “*” and next_char == “/“:
                    in_comment = False
                    index += 2
                    continue
                index += 1
                continue

            if quote:
                if escaped:
                    escaped = False
                elif char == “\\”:
                    escaped = True
                elif char == quote:
                    quote = None
                index += 1
                continue

            if char == “/“ and next_char == “*”:
                in_comment = True
                index += 2
                continue

            if char in {“’”, ‘”’}:
                quote = char
                index += 1
                continue

            if char in “{([“:
                stack.append((char, index))

            elif char in “})]”:
                if not stack or stack[-1][0] != pairs[char]:
                    self.log(
                        “ERROR”,
                        “CSS”,
                        self.relative(path),
                        f”Unmatched closing delimiter {char} at offset {index}.”,
                    )
                    return

                stack.pop()

            index += 1

        if quote:
            self.log(
                “ERROR”,
                “CSS”,
                self.relative(path),
                “Unterminated quoted string.”,
            )

        if in_comment:
            self.log(
                “ERROR”,
                “CSS”,
                self.relative(path),
                “Unterminated CSS comment.”,
            )

        if stack:
            self.log(
                “ERROR”,
                “CSS”,
                self.relative(path),
                f”Unclosed delimiter {stack[-1][0]}.”,
            )

    def extract_css_references(self, content: str) -> list[str]:
        pattern = re.compile(
            r”””url\(\s*([‘”]?)(.*?)\1\s*\)”””,
            re.IGNORECASE | re.DOTALL,
        )

        return [
            match.group(2).strip()
            for match in pattern.finditer(content)
            if match.group(2).strip()
        ]

    def extract_references(
        self,
        path: Path,
        content: str,
    ) -> tuple[list[str], set[str]]:
        references: list[str] = []
        ids: set[str] = set()

        if path.suffix.lower() in {“.html”, “.htm”, “.svg”, “.xml”}:
            parser = HTMLReferenceParser()

            try:
                parser.feed(content)
                parser.close()
            except Exception as exc:
                self.log(
                    “ERROR”,
                    “HTML”,
                    self.relative(path),
                    str(exc),
                )

            references.extend(parser.references)
            ids = parser.ids

            for duplicate in sorted(parser.duplicate_ids):
                self.log(
                    “WARNING”,
                    “HTML”,
                    self.relative(path),
                    f”Duplicate HTML id: {duplicate}”,
                )

        if path.suffix.lower() in {“.css”, “.scss”, “.sass”}:
            references.extend(self.extract_css_references(content))

        return references, ids

    def resolve_reference(self, source: Path, reference: str) -> Path | None:
        reference = reference.strip()

        if not reference:
            return None

        if reference.startswith(“//“):
            return None

        parsed = urlsplit(reference)

        if parsed.scheme.lower() in SKIP_SCHEMES:
            return None

        if parsed.netloc:
            return None

        if reference.startswith(“#”):
            return source

        raw_path = unquote(parsed.path)

        if not raw_path:
            return source

        if raw_path.startswith(“/“):
            target = self.root / raw_path.lstrip(“/“)
        else:
            target = source.parent / raw_path

        target = Path(os.path.abspath(target))

        try:
            target.relative_to(self.root)
        except ValueError:
            return None

        return target

    def check_references(
        self,
        path: Path,
        content: str,
        html_ids: set[str],
    ) -> None:
        references, _ = self.extract_references(path, content)

        for reference in references:
            target = self.resolve_reference(path, reference)

            if target is None:
                continue

            parsed = urlsplit(reference)
            fragment = unquote(parsed.fragment)

            if target == path and fragment:
                if fragment not in html_ids:
                    self.log(
                        “WARNING”,
                        “BROKEN_FRAGMENT”,
                        self.relative(path),
                        f”Missing same-page fragment: #{fragment}”,
                    )
                continue

            try:
                self.safe_path(target)

            except RepairError:
                self.log(
                    “WARNING”,
                    “UNSAFE_REFERENCE”,
                    self.relative(path),
                    f”Reference resolves through an unsafe path: {reference}”,
                )
                continue

            if not target.exists():
                self.log(
                    “WARNING”,
                    “MISSING_REFERENCE”,
                    self.relative(path),
                    f”Referenced file does not exist: {reference}”,
                )

    def check_html(self, path: Path, content: str) -> None:
        if path.suffix.lower() not in {“.html”, “.htm”}:
            return

        parser = HTMLReferenceParser()

        try:
            parser.feed(content)
            parser.close()
        except Exception as exc:
            self.log(
                “ERROR”,
                “HTML”,
                self.relative(path),
                str(exc),
            )

        for duplicate in sorted(parser.duplicate_ids):
            self.log(
                “WARNING”,
                “HTML”,
                self.relative(path),
                f”Duplicate id attribute: {duplicate}”,
            )

        # Basic image accessibility check.
        image_pattern = re.compile(r”<img\b([^>]*)>”, re.IGNORECASE)

        for match in image_pattern.finditer(content):
            attributes = match.group(1)

            if not re.search(r”\balt\s*=“, attributes, re.IGNORECASE):
                self.log(
                    “WARNING”,
                    “HTML_ACCESSIBILITY”,
                    self.relative(path),
                    “Image element is missing an alt attribute.”,
                )

    def check_package(self) -> None:
        package = self.root / “package.json”

        if not package.exists():
            return

        try:
            data = json.loads(package.read_text(encoding=“utf-8-sig”))

            if not isinstance(data, dict):
                raise ValueError(“package.json root must be an object.”)

            if not isinstance(data.get(“name”, “”), str):
                raise ValueError(“package.json name must be a string.”)

            for field in (
                “scripts”,
                “dependencies”,
                “devDependencies”,
                “engines”,
            ):
                if field in data and not isinstance(data[field], dict):
                    raise ValueError(
                        f”package.json {field} must be an object.”
                    )

            scripts = data.get(“scripts”, {})

            for name, command in scripts.items():
                if not isinstance(name, str) or not isinstance(command, str):
                    raise ValueError(
                        “Every package script must have a string name “
                        “and string command.”
                    )

            self.log(
                “INFO”,
                “PACKAGE”,
                “package.json”,
                “Package configuration is valid.”,
            )

        except (OSError, UnicodeError, ValueError) as exc:
            self.log(
                “ERROR”,
                “PACKAGE”,
                “package.json”,
                str(exc),
            )

    def check_dependencies(self) -> None:
        lockfile = self.root / “package-lock.json”

        if not lockfile.is_file():
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “package-lock.json”,
                “No npm lockfile found.”,
            )
            return

        npm = shutil.which(“npm”)

        if not npm:
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “npm”,
                “npm is unavailable.”,
            )
            return

        try:
            result = subprocess.run(
                [npm, “ls”, “—depth=0”],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )

            if result.returncode:
                self.log(
                    “WARNING”,
                    “DEPENDENCIES”,
                    “npm”,
                    (result.stderr or result.stdout).strip()[:4000],
                )
            else:
                self.log(
                    “INFO”,
                    “DEPENDENCIES”,
                    “npm”,
                    “Installed top-level dependencies checked.”,
                )

        except subprocess.TimeoutExpired:
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “npm”,
                “Dependency inspection timed out.”,
            )

    def load_baseline(self) -> set[str]:
        path = self.root / BASELINE_FILE

        if not path.exists():
            self.log(
                “WARNING”,
                “BASELINE”,
                BASELINE_FILE,
                “No baseline exists. Run with —baseline to create one.”,
            )
            return set()

        try:
            data = json.loads(path.read_text(encoding=“utf-8”))

            entries = data.get(“files”, [])

            if not isinstance(entries, list) or not all(
                isinstance(item, str) for item in entries
            ):
                raise ValueError(“Invalid baseline file list.”)

            return set(entries)

        except (OSError, ValueError, TypeError) as exc:
            self.log(
                “ERROR”,
                “BASELINE”,
                BASELINE_FILE,
                str(exc),
            )
            return set()

    def write_baseline(self) -> None:
        entries = [
            self.relative(path)
            for path in self.files
        ]

        payload = {
            “version”: VERSION,
            “created_at”: datetime.now(timezone.utc).isoformat(),
            “files”: entries,
        }

        path = self.root / BASELINE_FILE

        self.write_report_file(
            path,
            json.dumps(payload, indent=2, ensure_ascii=False) + “\n”,
        )

        self.log(
            “INFO”,
            “BASELINE”,
            BASELINE_FILE,
            f”Recorded {len(entries)} repository files.”,
        )

    def compare_baseline_files(self) -> None:
        previous = self.load_baseline()

        if not previous:
            return

        current = {
            self.relative(path)
            for path in self.files
        }

        for item in sorted(current - previous):
            self.log(
                “INFO”,
                “NEW_FILE”,
                item,
                “File was not present in the saved baseline.”,
            )

        for item in sorted(previous - current):
            self.log(
                “WARNING”,
                “MISSING_FILE”,
                item,
                “File was present in the baseline but is now missing.”,
            )

    def write_report_file(self, path: Path, content: str) -> None:
        “””Atomically write generated reports within the repository.”””
        self.safe_path(path, allow_missing=True)

        encoded = content.encode(“utf-8”)

        if len(encoded) > MAX_REPORT_SIZE:
            raise RepairError(“Generated report exceeds size limit.”)

        fd, temporary_name = tempfile.mkstemp(
            prefix=f”.{path.name}.”,
            suffix=“.tmp”,
            dir=path.parent,
        )
        temporary = Path(temporary_name)

        try:
            with os.fdopen(fd, “wb”) as output:
                output.write(encoded)
                output.flush()
                os.fsync(output.fileno())

            self.safe_path(path, allow_missing=True)
            os.replace(temporary, path)

        finally:
            temporary.unlink(missing_ok=True)

    def generate_reports(self) -> None:
        report = {
            “project”: “MedOrbits”,
            “engine_version”: VERSION,
            “timestamp”: datetime.now(timezone.utc).isoformat(),
            “repository”: str(self.root),
            “automatic_repairs”: self.fix,
            “dry_run”: self.dry_run,
            “summary”: {
                “files_scanned”: self.scanned,
                “repairs”: self.repaired,
                “errors”: self.errors,
                “warnings”: self.warnings,
                “skipped”: self.skipped,
            },
            “findings”: self.results,
        }

        json_path = self.root / “REPAIR-REPORT.json”
        markdown_path = self.root / “REPAIR-REPORT.md”

        try:
            self.write_report_file(
                json_path,
                json.dumps(report, indent=2, ensure_ascii=False) + “\n”,
            )

            lines = [
                “# MedOrbits Repository Repair Report”,
                “”,
                f”- Version: {VERSION}”,
                f”- Date: {report[‘timestamp’]}”,
                f”- Repository: `{self.root}`”,
                f”- Automatic repairs: {self.fix}”,
                f”- Dry run: {self.dry_run}”,
                “”,
                “## Summary”,
                “”,
                f”- Files scanned: {self.scanned}”,
                f”- Repairs: {self.repaired}”,
                f”- Errors: {self.errors}”,
                f”- Warnings: {self.warnings}”,
                f”- Skipped: {self.skipped}”,
                “”,
                “## Findings”,
                “”,
            ]

            if not self.results:
                lines.append(“No issues detected.”)
            else:
                for item in self.results:
                    message = item[“message”].replace(“\n”, “ “)
                    lines.append(
                        f”- **{item[‘level’]}** “
                        f”`{item[‘file’]}` “
                        f”({item[‘category’]}): {message}”
                    )

            self.write_report_file(
                markdown_path,
                “\n”.join(lines) + “\n”,
            )

            print(“\nReports generated:”)
            print(self.relative(json_path))
            print(self.relative(markdown_path))

        except (OSError, RepairError, ValueError) as exc:
            self.log(
                “ERROR”,
                “REPORT”,
                “REPAIR-REPORT”,
                str(exc),
            )

    def run_checks(self) -> None:
        self.files = self.discover_files()

        print(f”Files discovered: {len(self.files)}”)

        for path in self.files:
            self.scanned += 1

            content = self.read_text(path)

            if content is None:
                continue

            if self.fix:
                content = self.repair_text_format(path, content)

            self.check_json(path, content)
            self.check_python(path, content)
            self.check_javascript(path)
            self.check_css(path, content)
            self.check_html(path, content)

            references, ids = self.extract_references(path, content)
            self.check_references(path, content, ids)

        self.check_package()

        if self.dependencies:
            self.check_dependencies()

    def run(self) -> int:
        print(“=“ * 58)
        print(“ MEDORBITS REPOSITORY-WIDE REPAIR ENGINE”)
        print(“=“ * 58)
        print(f”Version: {VERSION}”)
        print(f”Repository: {self.root}”)
        print(f”Fix mode: {self.fix}”)
        print(f”Dry run: {self.dry_run}”)
        print()

        self.run_checks()

        if self.compare_baseline:
            self.compare_baseline_files()

        if self.errors == 0 and self.fix and not self.dry_run:
            print(“\nRunning post-repair validation...”)

            previous_results = self.results
            previous_errors = self.errors
            previous_warnings = self.warnings

            self.results = []
            self.errors = 0
            self.warnings = 0

            self.run_checks()

            self.after_errors = self.errors
            self.before_errors = previous_errors

            self.results = previous_results + self.results
            self.errors += previous_errors
            self.warnings += previous_warnings

        self.generate_reports()

        print(“\n” + “=“ * 58)
        print(“ REPAIR SUMMARY”)
        print(“=“ * 58)
        print(f”Scanned:  {self.scanned}”)
        print(f”Repaired: {self.repaired}”)
        print(f”Errors:   {self.errors}”)
        print(f”Warnings: {self.warnings}”)
        print(f”Skipped:  {self.skipped}”)

        if self.errors:
            print(“\nSTATUS: ERRORS REQUIRE ATTENTION”)
            return 1

        print(“\nSTATUS: VALIDATION PASSED”)
        return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=“MedOrbits repository scanning and repair engine.”
    )

    parser.add_argument(
        “—root”,
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help=“Repository root directory.”,
    )

    parser.add_argument(
        “—fix”,
        action=“store_true”,
        help=“Apply conservative automatic repairs.”,
    )

    parser.add_argument(
        “—dry-run”,
        action=“store_true”,
        help=“Preview repairs without modifying source files.”,
    )

    parser.add_argument(
        “—dependencies”,
        action=“store_true”,
        help=“Inspect installed npm dependencies using npm ls.”,
    )

    parser.add_argument(
        “—baseline”,
        action=“store_true”,
        help=“Save a snapshot of discovered repository files.”,
    )

    parser.add_argument(
        “—compare-baseline”,
        action=“store_true”,
        help=“Compare discovered files with the saved baseline.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Return failure when warnings are present.”,
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        root = args.root.expanduser().resolve(strict=True)

        if not root.is_dir():
            raise RepairError(“Repository root is not a directory.”)

        if not (
            (root / “.git”).exists()
            or (root / “.github”).is_dir()
            or (root / “package.json”).is_file()
        ):
            raise RepairError(
                “Directory does not look like a repository. “
                “Expected .git, .github or package.json.”
            )

        engine = RepositoryRepair(
            root=root,
            fix=args.fix,
            dependencies=args.dependencies,
            dry_run=args.dry_run,
            strict=args.strict,
            compare_baseline=args.compare_baseline,
        )

        if args.baseline:
            engine.files = engine.discover_files()
            engine.write_baseline()
            return 0

        result = engine.run()

        if args.strict and engine.warnings:
            return 1

        return result

    except (OSError, RuntimeError, RepairError, ValueError) as exc:
        print(f”ERROR: {exc}”, file=sys.stderr)
        return 2


if __name__ == “__main__”:
    raise SystemExit(main())
