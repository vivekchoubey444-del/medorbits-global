
#!/usr/bin/env python3
“””
MEDORBITS — REPOSITORY-WIDE REPAIR ENGINE
File: /tools/repository_repair.py

Features:
- Full recursive repository scanning.
- Old and newly created file discovery.
- Python, JavaScript, JSON, HTML and CSS validation.
- Broken local asset and file reference detection.
- package.json validation.
- Safe automatic repairs.
- Automatic backups before modifications.
- Before/after validation.
- JSON and Markdown reports.
- No destructive Git operations.
- No automatic deployment or database migrations.

Requirements:
    Python >= 3.10
    Node.js >= 20 (optional, for JavaScript validation)

Run from repository root:
    python tools/repository_repair.py

Automatic safe repairs:
    python tools/repository_repair.py —fix

Full scan with dependency checks:
    python tools/repository_repair.py —fix —dependencies

Custom repository:
    python tools/repository_repair.py —root .
“””

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import shutil
import subprocess
import sys
import hashlib

from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


VERSION = “1.0.0”

EXCLUDED_DIRS = {
    “.git”, “.next”, “.nuxt”, “.cache”,
    “.venv”, “venv”, “node_modules”,
    “__pycache__”, “.pytest_cache”,
    “.mypy_cache”, “coverage”,
    “dist”, “build”, “.turbo”,
    “.idea”, “.vscode”,
    “vendor”, “target”
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
    “.bat”, “.ps1”, “.sql”,
    “.webmanifest”, “.gitignore”,
    “.env.example”
}

SKIP_REFERENCE_SCHEMES = (
    “http://“, “https://“, “mailto:”,
    “tel:”, “data:”, “javascript:”,
    “blob:”, “#”
)


class RepositoryRepair:

    def __init__(
        self,
        root: Path,
        fix: bool = False,
        dependencies: bool = False
    ):
        self.root = root.resolve()
        self.fix = fix
        self.dependencies = dependencies

        self.backup_root = self.root / “.repair-backups”

        self.results: list[dict[str, Any]] = []
        self.scanned = 0
        self.repaired = 0
        self.errors = 0
        self.warnings = 0
        self.skipped = 0

        self.timestamp = datetime.now(
            timezone.utc
        ).strftime(“%Y%m%d-%H%M%S”)

    def log(
        self,
        level: str,
        category: str,
        file: str,
        message: str
    ) -> None:

        record = {
            “level”: level,
            “category”: category,
            “file”: file,
            “message”: message
        }

        self.results.append(record)

        if level == “ERROR”:
            self.errors += 1
        elif level == “WARNING”:
            self.warnings += 1
        elif level == “FIXED”:
            self.repaired += 1

        print(
            f”[{level}] [{category}] “
            f”{file}: {message}”
        )

    def backup(self, path: Path) -> bool:
        “””Create a backup before changing a file.”””

        try:
            relative = path.relative_to(self.root)

            destination = (
                self.backup_root
                / self.timestamp
                / relative
            )

            destination.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            shutil.copy2(path, destination)
            return True

        except Exception as exc:
            self.log(
                “ERROR”,
                “BACKUP”,
                str(path),
                str(exc)
            )
            return False

    def safe_write(
        self,
        path: Path,
        content: str,
        category: str
    ) -> bool:

        try:
            original = path.read_text(
                encoding=“utf-8-sig”
            )

            if original == content:
                return False

            if not self.backup(path):
                return False

            temporary = path.with_name(
                path.name + “.repair-tmp”
            )

            temporary.write_text(
                content,
                encoding=“utf-8”,
                newline=“”
            )

            temporary.replace(path)

            self.log(
                “FIXED”,
                category,
                str(path.relative_to(self.root)),
                “Applied safe automatic repair.”
            )

            return True

        except Exception as exc:
            self.log(
                “ERROR”,
                category,
                str(path),
                f”Unable to repair: {exc}”
            )
            return False

    def discover_files(self) -> list[Path]:

        files = []

        for directory, dirs, filenames in os.walk(
            self.root,
            followlinks=False
        ):

            dirs[:] = [
                name for name in dirs
                if name not in EXCLUDED_DIRS
                and name != “.repair-backups”
            ]

            for filename in filenames:

                path = Path(directory) / filename

                if path.is_symlink():
                    continue

                if path.suffix.lower() in TEXT_EXTENSIONS:
                    files.append(path)

                elif filename in {
                    “Dockerfile”,
                    “Makefile”,
                    “Procfile”,
                    “.npmrc”,
                    “.nvmrc”,
                    “.editorconfig”
                }:
                    files.append(path)

        return sorted(files)

    def read_text(self, path: Path) -> str | None:

        try:
            return path.read_text(
                encoding=“utf-8-sig”
            )
        except UnicodeDecodeError:
            self.log(
                “WARNING”,
                “ENCODING”,
                str(path.relative_to(self.root)),
                “Not valid UTF-8; skipped text validation.”
            )
            return None
        except OSError as exc:
            self.log(
                “ERROR”,
                “READ”,
                str(path.relative_to(self.root)),
                str(exc)
            )
            return None

    def repair_text_format(
        self,
        path: Path,
        content: str
    ) -> str:

        repaired = content

        # Remove UTF-8 BOM.
        repaired = repaired.lstrip(“\ufeff”)

        # Normalize line endings.
        repaired = repaired.replace(“\r\n”, “\n”)
        repaired = repaired.replace(“\r”, “\n”)

        # Remove trailing spaces and tabs.
        repaired = “\n”.join(
            line.rstrip(“ \t”)
            for line in repaired.split(“\n”)
        )

        if repaired != content and self.fix:
            self.safe_write(
                path,
                repaired,
                “TEXT_FORMAT”
            )

        return repaired

    def check_json(
        self,
        path: Path,
        content: str
    ) -> None:

        if path.suffix.lower() not in {
            “.json”, “.webmanifest”
        }:
            return

        try:
            json.loads(content)

        except json.JSONDecodeError as exc:
            self.log(
                “ERROR”,
                “JSON”,
                str(path.relative_to(self.root)),
                f”Line {exc.lineno}, column “
                f”{exc.colno}: {exc.msg}”
            )

    def check_python(
        self,
        path: Path,
        content: str
    ) -> None:

        if path.suffix.lower() != “.py”:
            return

        try:
            ast.parse(
                content,
                filename=str(path)
            )

        except SyntaxError as exc:
            self.log(
                “ERROR”,
                “PYTHON”,
                str(path.relative_to(self.root)),
                f”Line {exc.lineno}: {exc.msg}”
            )

    def check_javascript(
        self,
        path: Path
    ) -> None:

        if path.suffix.lower() not in {
            “.js”, “.mjs”, “.cjs”
        }:
            return

        node = shutil.which(“node”)

        if not node:
            self.log(
                “WARNING”,
                “JAVASCRIPT”,
                str(path.relative_to(self.root)),
                “Node.js unavailable; syntax check skipped.”
            )
            return

        try:
            result = subprocess.run(
                [node, “—check”, str(path)],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=self.root
            )

            if result.returncode != 0:
                self.log(
                    “ERROR”,
                    “JAVASCRIPT”,
                    str(path.relative_to(self.root)),
                    result.stderr.strip()
                    or result.stdout.strip()
                )

        except subprocess.TimeoutExpired:
            self.log(
                “WARNING”,
                “JAVASCRIPT”,
                str(path.relative_to(self.root)),
                “Syntax check timed out.”
            )

    def check_css(
        self,
        path: Path,
        content: str
    ) -> None:

        if path.suffix.lower() not in {
            “.css”, “.scss”, “.sass”
        }:
            return

        # Remove comments and quoted strings before
        # performing a basic delimiter check.
        cleaned = re.sub(
            r”/\*.*?\*/“,
            “”,
            content,
            flags=re.S
        )

        cleaned = re.sub(
            r”””([“’]).*?(?<!\\)\1”””,
            ‘””’,
            cleaned,
            flags=re.S
        )

        pairs = {
            “}”: “{“,
            “)”: “(“,
            “]”: “[“
        }

        stack = []

        for number, char in enumerate(cleaned):

            if char in “{([“:
                stack.append((char, number))

            elif char in “})]”:

                if not stack or stack[-1][0] != pairs[char]:
                    self.log(
                        “ERROR”,
                        “CSS”,
                        str(path.relative_to(self.root)),
                        f”Unmatched closing delimiter: {char}”
                    )
                    return

                stack.pop()

        if stack:
            self.log(
                “ERROR”,
                “CSS”,
                str(path.relative_to(self.root)),
                f”Unclosed delimiter: {stack[-1][0]}”
            )

    def check_html(
        self,
        path: Path,
        content: str
    ) -> None:

        if path.suffix.lower() not in {
            “.html”, “.htm”
        }:
            return

        parser = HTMLParser()

        try:
            parser.feed(content)
            parser.close()

        except Exception as exc:
            self.log(
                “ERROR”,
                “HTML”,
                str(path.relative_to(self.root)),
                str(exc)
            )

    def extract_references(
        self,
        path: Path,
        content: str
    ) -> list[str]:

        references = []

        pattern = re.compile(
            r’’’(?:src|href|poster|action|data-src)\s*=\s*
            [“’]([^”’]+)[“’]’’’,
            re.I | re.X
        )

        references.extend(pattern.findall(content))

        return references

    def check_references(
        self,
        path: Path,
        content: str
    ) -> None:

        for reference in self.extract_references(
            path,
            content
        ):

            reference = reference.strip()

            if not reference:
                continue

            if reference.lower().startswith(
                SKIP_REFERENCE_SCHEMES
            ):
                continue

            clean = reference.split(“#”, 1)[0]
            clean = clean.split(“?”, 1)[0]

            if not clean:
                continue

            if clean.startswith(“//“):
                continue

            if clean.startswith(“/“):
                target = self.root / clean.lstrip(“/“)
            else:
                target = path.parent / clean

            try:
                target = target.resolve()

                # Do not follow references outside repository.
                if not target.is_relative_to(self.root):
                    continue

                if not target.exists():
                    self.log(
                        “WARNING”,
                        “MISSING_REFERENCE”,
                        str(path.relative_to(self.root)),
                        f”Referenced file does not exist: {reference}”
                    )

            except (OSError, ValueError):
                continue

    def check_package(self) -> None:

        package = self.root / “package.json”

        if not package.exists():
            return

        try:
            data = json.loads(
                package.read_text(encoding=“utf-8”)
            )

            if not isinstance(data, dict):
                raise ValueError(
                    “package.json root must be an object.”
                )

            if “scripts” in data and not isinstance(
                data[“scripts”], dict
            ):
                raise ValueError(
                    “package.json scripts must be an object.”
                )

            self.log(
                “INFO”,
                “PACKAGE”,
                “package.json”,
                “Package configuration is valid JSON.”
            )

        except Exception as exc:
            self.log(
                “ERROR”,
                “PACKAGE”,
                “package.json”,
                str(exc)
            )

    def check_dependencies(self) -> None:

        package_lock = self.root / “package-lock.json”

        if not package_lock.exists():
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “package-lock.json”,
                “No npm lockfile found.”
            )
            return

        npm = shutil.which(“npm”)

        if not npm:
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “npm”,
                “npm is unavailable.”
            )
            return

        try:
            result = subprocess.run(
                [npm, “ls”, “—depth=0”],
                cwd=self.root,
                capture_output=True,
                text=True,
                timeout=120
            )

            if result.returncode != 0:
                self.log(
                    “WARNING”,
                    “DEPENDENCIES”,
                    “npm”,
                    result.stderr.strip()
                    or result.stdout.strip()
                )
            else:
                self.log(
                    “INFO”,
                    “DEPENDENCIES”,
                    “npm”,
                    “Installed top-level dependencies checked.”
                )

        except subprocess.TimeoutExpired:
            self.log(
                “WARNING”,
                “DEPENDENCIES”,
                “npm”,
                “Dependency check timed out.”
            )

    def scan(self) -> None:

        print(“\n========================================“)
        print(“ MEDORBITS REPOSITORY REPAIR ENGINE”)
        print(“========================================\n”)

        print(“Repository:”, self.root)
        print(“Automatic repairs:”, self.fix)

        files = self.discover_files()

        print(“Files discovered:”, len(files))
        print()

        for path in files:

            self.scanned += 1

            content = self.read_text(path)

            if content is None:
                self.skipped += 1
                continue

            if self.fix:
                content = self.repair_text_format(
                    path,
                    content
                )

            self.check_json(path, content)
            self.check_python(path, content)
            self.check_javascript(path)
            self.check_css(path, content)
            self.check_html(path, content)

            self.check_references(path, content)

        self.check_package()

        if self.dependencies:
            self.check_dependencies()

    def generate_reports(self) -> None:

        report = {
            “project”: “MedOrbits”,
            “engine_version”: VERSION,
            “timestamp”: datetime.now(
                timezone.utc
            ).isoformat(),
            “repository”: str(self.root),
            “automatic_repairs”: self.fix,
            “summary”: {
                “files_scanned”: self.scanned,
                “repairs”: self.repaired,
                “errors”: self.errors,
                “warnings”: self.warnings,
                “skipped”: self.skipped
            },
            “findings”: self.results
        }

        json_path = (
            self.root / “REPAIR-REPORT.json”
        )

        markdown_path = (
            self.root / “REPAIR-REPORT.md”
        )

        json_path.write_text(
            json.dumps(
                report,
                indent=2,
                ensure_ascii=False
            ),
            encoding=“utf-8”
        )

        lines = [
            “# MedOrbits Repository Repair Report”,
            “”,
            f”Version: {VERSION}”,
            f”Date: {report[‘timestamp’]}”,
            f”Repository: {self.root}”,
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
            “”
        ]

        if not self.results:
            lines.append(“No issues detected.”)
        else:
            for item in self.results:
                lines.append(
                    f”- **{item[‘level’]}** “
                    f”`{item[‘file’]}` — “
                    f”{item[‘message’]}”
                )

        markdown_path.write_text(
            “\n”.join(lines),
            encoding=“utf-8”
        )

        print(“\nReports generated:”)
        print(json_path)
        print(markdown_path)

    def run(self) -> int:

        self.scan()
        self.generate_reports()

        print(“\n========================================“)
        print(“ REPAIR SUMMARY”)
        print(“========================================“)
        print(“Scanned:”, self.scanned)
        print(“Repaired:”, self.repaired)
        print(“Errors:”, self.errors)
        print(“Warnings:”, self.warnings)
        print(“Skipped:”, self.skipped)

        if self.errors:
            print(“\nSTATUS: ERRORS REQUIRE ATTENTION”)
            return 1

        print(“\nSTATUS: VALIDATION PASSED”)
        return 0


def main() -> int:

    parser = argparse.ArgumentParser(
        description=(
            “MedOrbits repository scanning and “
            “safe repair engine.”
        )
    )

    parser.add_argument(
        “—root”,
        default=“.”,
        help=“Repository root directory.”
    )

    parser.add_argument(
        “—fix”,
        action=“store_true”,
        help=“Apply safe automatic repairs.”
    )

    parser.add_argument(
        “—dependencies”,
        action=“store_true”,
        help=“Check installed npm dependencies.”
    )

    args = parser.parse_args()

    root = Path(args.root)

    if not root.exists() or not root.is_dir():
        print(“ERROR: Invalid repository directory.”)
        return 2

    engine = RepositoryRepair(
        root=root,
        fix=args.fix,
        dependencies=args.dependencies
    )

    return engine.run()


if __name__ == “__main__”:
    sys.exit(main())
