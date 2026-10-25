
#!/usr/bin/env python3
"""
MedOrbits Repository Integrity Auditor
======================================

Audits a repository for:
- Missing local files and broken relative references.
- Python import and syntax problems.
- Invalid JSON files.
- HTML references to local assets and pages.
- CSS url(...) references.
- JavaScript static relative imports.
- Python package structure.
- Common accidental files and directory issues.

Creates:
    reports/repository-integrity.json
    reports/repository-integrity.txt

Optional:
    --create-init
        Create missing __init__.py files in directories containing Python
        modules. Review the proposed changes before committing them.

Compatible with Python 3.10+
Uses only the Python standard library.

Run from the repository root:
    python python/tools/repository_integrity.py

Include hidden files:
    python python/tools/repository_integrity.py --include-hidden

Create missing Python package markers:
    python python/tools/repository_integrity.py --create-init
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_IGNORES = {
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "venv",
    "env",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".cache",
}

REPORT_DIRECTORY = "reports"

TEXT_EXTENSIONS = {
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".py",
    ".xml",
    ".svg",
    ".webmanifest",
}

PYTHON_EXTENSIONS = {".py"}

HTML_REFERENCE_ATTRIBUTES = {
    "src",
    "href",
    "poster",
    "action",
    "data",
    "srcset",
}

CSS_URL_PATTERN = re.compile(
    r"""url\(\s*(?P<quote>["']?)(?P<url>.*?)(?P=quote)\s*\)""",
    re.IGNORECASE,
)

JS_IMPORT_PATTERN = re.compile(
    r"""
    (?:
        \bimport\s+(?:[^'";]*?\s+from\s+)?
        |
        \bexport\s+[^'";]*?\s+from\s+
        |
        \bimport\s*\(\s*
        |
        \brequire\s*\(\s*
    )
    ["'](?P<specifier>[^"'`]+)["']
    """,
    re.VERBOSE,
)

JS_EXTENSION_CANDIDATES = (
    "",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".ts",
    ".tsx",
    ".jsx",
    ".css",
    ".html",
)

HTML_EXTENSION_CANDIDATES = (
    "",
    ".html",
    ".htm",
    "/index.html",
)

CSS_EXTENSION_CANDIDATES = (
    "",
    ".css",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".woff",
    ".woff2",
    ".ttf",
)


@dataclass
class Finding:
    """One actionable repository audit finding."""

    severity: str
    code: str
    file: str
    message: str
    line: int | None = None
    reference: str | None = None
    suggestion: str | None = None


class AuditReport:
    """Collect findings and produce machine-readable and human-readable output."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.findings: list[Finding] = []
        self.scanned_files = 0
        self.scanned_directories = 0
        self.skipped_files = 0
        self.created_files: list[str] = []

    def add(
        self,
        severity: str,
        code: str,
        file: Path | str,
        message: str,
        *,
        line: int | None = None,
        reference: str | None = None,
        suggestion: str | None = None,
    ) -> None:
        if isinstance(file, Path):
            try:
                file_name = file.relative_to(self.root).as_posix()
            except ValueError:
                file_name = str(file)
        else:
            file_name = file

        self.findings.append(
            Finding(
                severity=severity.upper(),
                code=code,
                file=file_name,
                message=message,
                line=line,
                reference=reference,
                suggestion=suggestion,
            )
        )

    def summary(self) -> dict[str, Any]:
        counts = Counter(item.severity for item in self.findings)

        return {
            "root": str(self.root),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "scanned_files": self.scanned_files,
            "scanned_directories": self.scanned_directories,
            "skipped_files": self.skipped_files,
            "created_files": list(self.created_files),
            "findings_total": len(self.findings),
            "errors": counts.get("ERROR", 0),
            "warnings": counts.get("WARNING", 0),
            "info": counts.get("INFO", 0),
            "findings": [asdict(item) for item in self.findings],
        }

    def write(self, output_directory: Path) -> tuple[Path, Path]:
        output_directory.mkdir(parents=True, exist_ok=True)

        json_path = output_directory / "repository-integrity.json"
        text_path = output_directory / "repository-integrity.txt"

        payload = self.summary()

        json_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        lines = [
            "MEDORBITS REPOSITORY INTEGRITY REPORT",
            "=" * 42,
            f"Repository: {self.root}",
            f"Generated: {payload['generated_at']}",
            f"Files scanned: {self.scanned_files}",
            f"Directories scanned: {self.scanned_directories}",
            f"Files skipped: {self.skipped_files}",
            f"Errors: {payload['errors']}",
            f"Warnings: {payload['warnings']}",
            f"Information: {payload['info']}",
            "",
        ]

        if not self.findings:
            lines.append("No issues detected by the configured checks.")
        else:
            for item in self.findings:
                location = item.file
                if item.line is not None:
                    location += f":{item.line}"

                lines.append(
                    f"[{item.severity}] {item.code} -- {location}"
                )
                lines.append(f"  {item.message}")

                if item.reference:
                    lines.append(f"  Reference: {item.reference}")

                if item.suggestion:
                    lines.append(f"  Suggested action: {item.suggestion}")

                lines.append("")

        text_path.write_text(
            "\n".join(lines).rstrip() + "\n",
            encoding="utf-8",
        )

        return json_path, text_path


class HTMLReferenceParser(HTMLParser):
    """Extract local resource references from HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, int]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._collect(attrs)

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self._collect(attrs)

    def _collect(self, attrs: list[tuple[str, str | None]]) -> None:
        for attribute, value in attrs:
            if not value:
                continue

            attribute = attribute.lower()

            if attribute in {"srcset"}:
                for candidate in value.split(","):
                    parts = candidate.strip().split()
                    if parts:
                        self.references.append(
                            (parts[0], self.getpos()[0])
                        )

            elif attribute in HTML_REFERENCE_ATTRIBUTES:
                self.references.append(
                    (value.strip(), self.getpos()[0])
                )


class RepositoryAuditor:
    """Perform static repository checks without importing project code."""

    def __init__(
        self,
        root: Path,
        *,
        include_hidden: bool = False,
        create_init: bool = False,
    ) -> None:
        self.root = root.resolve()
        self.include_hidden = include_hidden
        self.create_init = create_init
        self.report = AuditReport(self.root)
        self.files: list[Path] = []
        self.python_modules: set[Path] = set()

    def run(self) -> AuditReport:
        if not self.root.is_dir():
            raise NotADirectoryError(
                f"Repository root is not a directory: {self.root}"
            )

        self._collect_files()
        self._audit_python()
        self._audit_json()
        self._audit_html_css_js()
        self._audit_repository_structure()

        return self.report

    # ------------------------------------------------------------------
    # File discovery
    # ------------------------------------------------------------------

    def _collect_files(self) -> None:
        for current, directories, filenames in __import__("os").walk(self.root):
            current_path = Path(current)

            retained_directories = []

            for directory in directories:
                if directory in DEFAULT_IGNORES:
                    continue

                if not self.include_hidden and directory.startswith("."):
                    continue

                retained_directories.append(directory)

            directories[:] = retained_directories
            self.report.scanned_directories += 1

            for filename in filenames:
                path = current_path / filename

                if not self.include_hidden and any(
                    part.startswith(".")
                    for part in path.relative_to(self.root).parts
                ):
                    self.report.skipped_files += 1
                    continue

                if path.suffix.lower() in TEXT_EXTENSIONS:
                    self.files.append(path)
                    self.report.scanned_files += 1

                    if path.suffix.lower() in PYTHON_EXTENSIONS:
                        self.python_modules.add(path)

        self.files.sort()

    def _read_text(self, path: Path) -> str | None:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            self.report.add(
                "WARNING",
                "TEXT_ENCODING",
                path,
                "File is not valid UTF-8 text; content checks were skipped.",
                suggestion="Save the file as UTF-8 if it is intended to be text.",
            )
        except OSError as exc:
            self.report.add(
                "ERROR",
                "FILE_READ",
                path,
                f"Unable to read file: {exc}",
            )

        return None

    # ------------------------------------------------------------------
    # Path resolution
    # ------------------------------------------------------------------

    def _inside_root(self, path: Path) -> bool:
        try:
            path.resolve().relative_to(self.root)
            return True
        except (ValueError, OSError):
            return False

    def _resolve_local_reference(
        self,
        source_file: Path,
        reference: str,
        *,
        kind: str,
    ) -> Path | None:
        """
        Resolve a local reference.

        Root-relative web paths such as /assets/app.css are resolved relative
        to the repository root. Relative paths are resolved from the source
        file's directory. URLs, fragments, data URIs and protocol-relative
        URLs are ignored.
        """

        reference = reference.strip()

        if not reference:
            return None

        if reference.startswith(("#", "//")):
            return None

        parsed = urlsplit(reference)

        if parsed.scheme or parsed.netloc:
            return None

        raw_path = unquote(parsed.path).strip()

        if not raw_path:
            return None

        if raw_path.startswith("~"):
            return None

        # A web root path is interpreted relative to the repository root.
        if raw_path.startswith("/"):
            candidate = self.root / raw_path.lstrip("/")
        else:
            candidate = source_file.parent / raw_path

        candidate = candidate.resolve(strict=False)

        if not self._inside_root(candidate):
            self.report.add(
                "WARNING",
                "REFERENCE_OUTSIDE_ROOT",
                source_file,
                "Local reference resolves outside the repository root.",
                reference=reference,
                suggestion="Use a repository-local path or verify the reference.",
            )
            return None

        if candidate.exists():
            return candidate

        if kind == "html":
            extensions = HTML_EXTENSION_CANDIDATES
        elif kind == "css":
            extensions = CSS_EXTENSION_CANDIDATES
        else:
            extensions = JS_EXTENSION_CANDIDATES

        # Support extensionless JS imports and common directory index files.
        for extension in extensions:
            alternative = Path(str(candidate) + extension).resolve(strict=False)

            if self._inside_root(alternative) and alternative.exists():
                return alternative

        # For browser directory URLs, allow an index page.
        if candidate.is_dir():
            for index_name in ("index.html", "index.htm"):
                index_file = candidate / index_name
                if index_file.is_file():
                    return index_file

        return candidate

    def _check_reference(
        self,
        source_file: Path,
        reference: str,
        *,
        line: int | None,
        kind: str,
    ) -> None:
        resolved = self._resolve_local_reference(
            source_file,
            reference,
            kind=kind,
        )

        if resolved is None:
            return

        if not resolved.exists():
            self.report.add(
                "WARNING",
                "BROKEN_LOCAL_REFERENCE",
                source_file,
                "Referenced local file does not exist.",
                line=line,
                reference=reference,
                suggestion=(
                    "Correct the relative path, restore the missing file, "
                    "or remove the obsolete reference."
                ),
            )

    # ------------------------------------------------------------------
    # Python checks
    # ------------------------------------------------------------------

    def _audit_python(self) -> None:
        for path in sorted(self.python_modules):
            source = self._read_text(path)

            if source is None:
                continue

            try:
                tree = ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                self.report.add(
                    "ERROR",
                    "PYTHON_SYNTAX",
                    path,
                    exc.msg,
                    line=exc.lineno,
                    suggestion="Fix the syntax error before running the module.",
                )
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        self._check_python_import(
                            path,
                            alias.name,
                            level=0,
                            line=node.lineno,
                        )

                elif isinstance(node, ast.ImportFrom):
                    self._check_python_import(
                        path,
                        node.module or "",
                        level=node.level,
                        line=node.lineno,
                    )

    def _check_python_import(
        self,
        source_file: Path,
        module_name: str,
        *,
        level: int,
        line: int,
    ) -> None:
        """
        Check likely project-local Python imports.

        Standard-library and third-party imports are not flagged merely
        because their package is absent from this repository.
        """

        if level > 0:
            base = source_file.parent

            for _ in range(level - 1):
                base = base.parent

            if module_name:
                candidate = base.joinpath(*module_name.split("."))
            else:
                candidate = base

            candidates = [
                candidate.with_suffix(".py"),
                candidate / "__init__.py",
            ]

            if not any(item.is_file() for item in candidates):
                # A relative import may target a namespace package or a
                # directory containing modules. Check for either.
                if not candidate.is_dir():
                    self.report.add(
                        "WARNING",
                        "PYTHON_RELATIVE_IMPORT",
                        source_file,
                        "Relative import target could not be found.",
                        line=line,
                        reference="." * level + module_name,
                        suggestion=(
                            "Verify the relative import level and module path."
                        ),
                    )
            return

        if not module_name:
            return

        top_level = module_name.split(".", 1)[0]
        local_candidate = self.root / top_level

        if local_candidate.is_dir():
            module_path = self.root.joinpath(*module_name.split("."))
            candidates = [
                module_path.with_suffix(".py"),
                module_path / "__init__.py",
            ]

            if not any(item.is_file() for item in candidates):
                self.report.add(
                    "WARNING",
                    "PYTHON_LOCAL_IMPORT",
                    source_file,
                    "Import appears to refer to a local package or module "
                    "that could not be resolved.",
                    line=line,
                    reference=module_name,
                    suggestion=(
                        "Check the package name, module filename and "
                        "the package's __init__.py structure."
                    ),
                )

    # ------------------------------------------------------------------
    # JSON checks
    # ------------------------------------------------------------------

    def _audit_json(self) -> None:
        for path in self.files:
            if path.suffix.lower() != ".json":
                continue

            source = self._read_text(path)

            if source is None:
                continue

            try:
                json.loads(source)
            except json.JSONDecodeError as exc:
                self.report.add(
                    "ERROR",
                    "INVALID_JSON",
                    path,
                    exc.msg,
                    line=exc.lineno,
                    suggestion=(
                        "Fix JSON syntax. Use double quotes for strings and "
                        "property names, and remove trailing commas."
                    ),
                )

    # ------------------------------------------------------------------
    # HTML, CSS and JavaScript checks
    # ------------------------------------------------------------------

    def _audit_html_css_js(self) -> None:
        for path in self.files:
            suffix = path.suffix.lower()

            if suffix not in {".html", ".htm", ".css", ".js", ".mjs", ".cjs"}:
                continue

            source = self._read_text(path)

            if source is None:
                continue

            if suffix in {".html", ".htm"}:
                self._audit_html_file(path, source)

            elif suffix == ".css":
                self._audit_css_file(path, source)

            elif suffix in {".js", ".mjs", ".cjs"}:
                self._audit_js_file(path, source)

    def _audit_html_file(self, path: Path, source: str) -> None:
        parser = HTMLReferenceParser()

        try:
            parser.feed(source)
            parser.close()
        except Exception as exc:
            self.report.add(
                "WARNING",
                "HTML_PARSE",
                path,
                f"HTML reference parsing failed: {exc}",
            )
            return

        for reference, line in parser.references:
            self._check_reference(
                path,
                reference,
                line=line,
                kind="html",
            )

        if re.search(r"<html\b", source, re.IGNORECASE) is None:
            self.report.add(
                "INFO",
                "HTML_ROOT",
                path,
                "No <html> root element detected.",
                suggestion="Verify whether this file is a full HTML page or a fragment.",
            )

        if re.search(r"<title\b", source, re.IGNORECASE) is None:
            self.report.add(
                "INFO",
                "HTML_TITLE",
                path,
                "No <title> element detected.",
                suggestion="Add a descriptive page title when this is a full HTML page.",
            )

    def _audit_css_file(self, path: Path, source: str) -> None:
        for match in CSS_URL_PATTERN.finditer(source):
            reference = match.group("url").strip()

            if not reference:
                continue

            if reference.startswith(("data:", "#", "blob:")):
                continue

            line = source.count("\n", 0, match.start()) + 1

            self._check_reference(
                path,
                reference,
                line=line,
                kind="css",
            )

    def _audit_js_file(self, path: Path, source: str) -> None:
        for match in JS_IMPORT_PATTERN.finditer(source):
            reference = match.group("specifier")

            # Only relative or root-relative paths are considered local.
            # Bare specifiers such as "react" may be installed dependencies.
            if not reference.startswith(("./", "../", "/")):
                continue

            line = source.count("\n", 0, match.start()) + 1

            self._check_reference(
                path,
                reference,
                line=line,
                kind="js",
            )

    # ------------------------------------------------------------------
    # Repository structure checks
    # ------------------------------------------------------------------

    def _audit_repository_structure(self) -> None:
        root_names = {path.name for path in self.root.iterdir()}

        if "README.md" not in root_names and "README" not in root_names:
            self.report.add(
                "INFO",
                "README_MISSING",
                ".",
                "No root README file was found.",
                suggestion="Add a README describing setup, configuration and test commands.",
            )

        if "pyproject.toml" not in root_names and "setup.py" not in root_names:
            if any(path.suffix.lower() == ".py" for path in self.files):
                self.report.add(
                    "INFO",
                    "PYTHON_PROJECT_CONFIG",
                    ".",
                    "No root pyproject.toml or setup.py was found.",
                    suggestion=(
                        "Consider adding pyproject.toml for project metadata, "
                        "tool configuration and test settings."
                    ),
                )

        if "python" in root_names:
            python_root = self.root / "python"

            if python_root.is_dir():
                integration_dir = python_root / "integrations"

                if integration_dir.is_dir():
                    base_file = integration_dir / "base.py"
                    registry_file = integration_dir / "registry.py"
                    exceptions_file = integration_dir / "exceptions.py"

                    for required in (
                        base_file,
                        registry_file,
                        exceptions_file,
                    ):
                        if not required.is_file():
                            self.report.add(
                                "WARNING",
                                "INTEGRATION_FILE_MISSING",
                                required,
                                "Expected integration module was not found.",
                                suggestion=(
                                    "Confirm the intended architecture before "
                                    "creating or renaming this module."
                                ),
                            )

        if self.create_init:
            self._create_missing_init_files()

    def _create_missing_init_files(self) -> None:
        """
        Create __init__.py only in directories containing Python source.

        Existing files are never overwritten. Directories excluded during
        discovery are not considered.
        """

        directories = {
            path.parent
            for path in self.python_modules
        }

        for directory in sorted(directories):
            init_file = directory / "__init__.py"

            if init_file.exists():
                continue

            try:
                init_file.write_text(
                    '"""Python package."""\n',
                    encoding="utf-8",
                )
            except OSError as exc:
                self.report.add(
                    "ERROR",
                    "INIT_CREATE_FAILED",
                    init_file,
                    f"Could not create __init__.py: {exc}",
                )
                continue

            self.report.created_files.append(
                init_file.relative_to(self.root).as_posix()
            )

            self.report.add(
                "INFO",
                "INIT_CREATED",
                init_file,
                "Created a Python package marker.",
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit MedOrbits repository references and structure."
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root directory (default: inferred from this script).",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden directories and files in the scan.",
    )

    parser.add_argument(
        "--create-init",
        action="store_true",
        help="Create missing __init__.py files in directories with Python modules.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Report directory (default: <root>/reports).",
    )

    parser.add_argument(
        "--fail-on-warning",
        action="store_true",
        help="Exit with status 1 if any warning or error is found.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()

    output_directory = (
        args.output.expanduser().resolve()
        if args.output
        else root / REPORT_DIRECTORY
    )

    try:
        auditor = RepositoryAuditor(
            root,
            include_hidden=args.include_hidden,
            create_init=args.create_init,
        )
        report = auditor.run()
        json_path, text_path = report.write(output_directory)

    except (OSError, NotADirectoryError) as exc:
        print(f"Repository audit failed: {exc}", file=sys.stderr)
        return 2

    summary = report.summary()

    print("MedOrbits Repository Integrity Audit")
    print("=" * 38)
    print(f"Root:        {root}")
    print(f"Files:       {summary['scanned_files']}")
    print(f"Directories: {summary['scanned_directories']}")
    print(f"Errors:      {summary['errors']}")
    print(f"Warnings:    {summary['warnings']}")
    print(f"Info:        {summary['info']}")
    print(f"JSON report: {json_path}")
    print(f"Text report: {text_path}")

    if summary["created_files"]:
        print("\nCreated package markers:")
        for name in summary["created_files"]:
            print(f"  + {name}")

    if summary["errors"] > 0:
        return 1

    if args.fail_on_warning and summary["warnings"] > 0:
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
