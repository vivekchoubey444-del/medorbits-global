
#!/usr/bin/env python3
"""
MedOrbits Dependency Binder
===========================

File:
    python/tools/dependency_binder.py

Purpose:
    Analyze and map relationships between project files so that modules,
    services, controllers, integrations, configuration, tests, and data
    files can be connected through explicit, verifiable dependencies.

Features:
    - Discover project files.
    - Analyze Python imports and relative imports.
    - Detect unresolved local Python dependencies.
    - Identify Python modules with no detected incoming dependencies.
    - Detect circular Python import relationships.
    - Inspect JSON datasets and HTML/CSS/JavaScript local references.
    - Produce a dependency graph and connection report.
    - Optionally create missing Python package markers.
    - Generate a JSON report and a Mermaid dependency diagram.
    - Avoid changing application logic or inventing API endpoints.

Compatibility:
    Python 3.10+
    Standard library only.

Run from the repository root:
    python python/tools/dependency_binder.py

Create missing package markers:
    python python/tools/dependency_binder.py --create-init

Export dependency diagram:
    python python/tools/dependency_binder.py --format mermaid

Note:
    A dependency is not automatically valid merely because a file imports
    another file. Runtime contracts, API routes, credentials, database
    connections, and business logic require separate validation.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[2]

IGNORED_DIRECTORIES = {
    ".git",
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
}

SUPPORTED_EXTENSIONS = {
    ".py",
    ".json",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
}

CSS_URL_PATTERN = re.compile(
    r"""url\(\s*["']?(.*?)["']?\s*\)""",
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
    ["'](?P<path>[^"'`]+)["']
    """,
    re.VERBOSE,
)

HTML_REFERENCE_PATTERN = re.compile(
    r"""(?:src|href|poster|action|data)\s*=\s*["']([^"'#]+)["']""",
    re.IGNORECASE,
)

JS_CANDIDATE_SUFFIXES = (
    "",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".json",
    ".css",
)

HTML_CANDIDATE_SUFFIXES = (
    "",
    ".html",
    ".htm",
    "/index.html",
)


class DependencyBinderError(RuntimeError):
    """Base exception for dependency binder errors."""


class DependencyBinder:
    """Discover and analyze dependencies without importing project code."""

    def __init__(
        self,
        root: Path,
        *,
        create_init: bool = False,
        include_hidden: bool = False,
    ) -> None:
        self.root = root.resolve()
        self.create_init = create_init
        self.include_hidden = include_hidden

        self.files: list[Path] = []
        self.python_files: list[Path] = []
        self.nodes: set[str] = set()
        self.edges: set[tuple[str, str, str]] = set()
        self.issues: list[dict[str, Any]] = []
        self.created_files: list[str] = []

        self.module_to_path: dict[str, Path] = {}
        self.path_to_module: dict[Path, str] = {}

    # ------------------------------------------------------------------
    # General utilities
    # ------------------------------------------------------------------

    def relative(self, path: Path) -> str:
        try:
            return path.resolve().relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def add_issue(
        self,
        severity: str,
        code: str,
        path: Path | str,
        message: str,
        suggestion: str | None = None,
    ) -> None:
        self.issues.append(
            {
                "severity": severity.upper(),
                "code": code,
                "file": self.relative(path) if isinstance(path, Path) else path,
                "message": message,
                "suggestion": suggestion,
            }
        )

    def read_text(self, path: Path) -> str | None:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            self.add_issue(
                "WARNING",
                "UNREADABLE_TEXT",
                path,
                "File is not UTF-8 text; dependency inspection was skipped.",
                "Save the file as UTF-8 if it is intended to be a text file.",
            )
        except OSError as exc:
            self.add_issue(
                "ERROR",
                "FILE_READ_FAILED",
                path,
                str(exc),
            )
        return None

    # ------------------------------------------------------------------
    # File discovery and module mapping
    # ------------------------------------------------------------------

    def discover(self) -> None:
        if not self.root.is_dir():
            raise DependencyBinderError(
                f"Repository root does not exist: {self.root}"
            )

        for current, directories, filenames in os.walk(self.root):
            current_path = Path(current)

            directories[:] = [
                directory
                for directory in directories
                if directory not in IGNORED_DIRECTORIES
                and (
                    self.include_hidden
                    or not directory.startswith(".")
                )
            ]

            for filename in filenames:
                path = current_path / filename

                if not self.include_hidden and any(
                    part.startswith(".")
                    for part in path.relative_to(self.root).parts
                ):
                    continue

                if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                self.files.append(path)

        self.files.sort()
        self.python_files = [
            path for path in self.files
            if path.suffix.lower() == ".py"
        ]

        self._build_python_module_index()

    def _build_python_module_index(self) -> None:
        """
        Map Python file paths to likely import names.

        Supports conventional packages and namespace-package directories.
        The repository root is treated as an import root for discovery;
        actual deployment import paths may differ.
        """

        for path in self.python_files:
            relative = path.relative_to(self.root)

            parts = list(relative.with_suffix("").parts)

            if parts and parts[-1] == "__init__":
                parts.pop()

            module_name = ".".join(parts)

            if not module_name:
                continue

            self.module_to_path[module_name] = path
            self.path_to_module[path.resolve()] = module_name
            self.nodes.add(self.relative(path))

    def _module_name_for_path(self, path: Path) -> str | None:
        return self.path_to_module.get(path.resolve())

    # ------------------------------------------------------------------
    # Python imports
    # ------------------------------------------------------------------

    def _resolve_import(
        self,
        source_file: Path,
        module_name: str,
        level: int,
    ) -> tuple[str | None, bool]:
        """
        Resolve an import to a discovered project module.

        Returns:
            (relative target file, target found)
        """

        source_module = self._module_name_for_path(source_file)

        if level > 0:
            package = (
                source_module.split(".")[:-1]
                if source_module
                else list(source_file.relative_to(self.root).parts[:-1])
            )

            # Relative imports resolve from the containing package.
            for _ in range(max(level - 1, 0)):
                if package:
                    package.pop()

            requested = module_name.split(".") if module_name else []
            candidate_parts = package + requested

            while candidate_parts:
                candidate_name = ".".join(candidate_parts)

                if candidate_name in self.module_to_path:
                    return (
                        self.relative(self.module_to_path[candidate_name]),
                        True,
                    )

                candidate_parts.pop()

            # A relative import may refer to a package directory.
            return None, False

        if not module_name:
            return None, False

        parts = module_name.split(".")

        for end in range(len(parts), 0, -1):
            candidate_name = ".".join(parts[:end])

            if candidate_name in self.module_to_path:
                return (
                    self.relative(self.module_to_path[candidate_name]),
                    True,
                )

        return None, False

    def analyze_python(self) -> None:
        for path in self.python_files:
            source = self.read_text(path)

            if source is None:
                continue

            try:
                tree = ast.parse(source, filename=str(path))
            except SyntaxError as exc:
                self.add_issue(
                    "ERROR",
                    "PYTHON_SYNTAX",
                    path,
                    exc.msg,
                    "Fix syntax errors before validating dependencies.",
                )
                continue

            source_name = self.relative(path)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        target, found = self._resolve_import(
                            path,
                            alias.name,
                            0,
                        )

                        if found and target:
                            self.edges.add(
                                (source_name, target, "python-import")
                            )
                        elif self._looks_local(alias.name):
                            self.add_issue(
                                "WARNING",
                                "UNRESOLVED_PYTHON_IMPORT",
                                path,
                                f"Potential local import could not be resolved: "
                                f"{alias.name}",
                                "Check package layout, import roots and module names.",
                            )

                elif isinstance(node, ast.ImportFrom):
                    target, found = self._resolve_import(
                        path,
                        node.module or "",
                        node.level,
                    )

                    if found and target:
                        self.edges.add(
                            (source_name, target, "python-import")
                        )
                    elif node.level > 0:
                        self.add_issue(
                            "WARNING",
                            "UNRESOLVED_RELATIVE_IMPORT",
                            path,
                            "Relative import could not be resolved: "
                            + "." * node.level
                            + (node.module or ""),
                            "Verify package directories and relative import levels.",
                        )

    def _looks_local(self, module_name: str) -> bool:
        first = module_name.split(".", 1)[0]
        return (
            first in {"python", "app", "src", "config", "controllers",
                      "models", "services", "integrations", "validators"}
            or first in {
                path.name
                for path in self.root.iterdir()
                if path.is_dir()
            }
        )

    # ------------------------------------------------------------------
    # HTML, CSS and JavaScript references
    # ------------------------------------------------------------------

    def _resolve_asset(
        self,
        source_file: Path,
        reference: str,
        suffixes: tuple[str, ...],
    ) -> Path | None:
        reference = reference.strip()

        if not reference or reference.startswith(("#", "//")):
            return None

        parsed = urlsplit(reference)

        if parsed.scheme or parsed.netloc:
            return None

        raw_path = unquote(parsed.path)

        if not raw_path:
            return None

        if raw_path.startswith("/"):
            candidate = self.root / raw_path.lstrip("/")
        else:
            candidate = source_file.parent / raw_path

        candidate = candidate.resolve(strict=False)

        try:
            candidate.relative_to(self.root)
        except ValueError:
            self.add_issue(
                "WARNING",
                "ASSET_OUTSIDE_ROOT",
                source_file,
                "Referenced path resolves outside the repository.",
                "Use a repository-local asset path.",
            )
            return None

        if candidate.is_file():
            return candidate

        for suffix in suffixes:
            alternative = Path(str(candidate) + suffix)

            if alternative.is_file():
                return alternative.resolve()

        if candidate.is_dir():
            for index_name in ("index.html", "index.htm"):
                index_file = candidate / index_name
                if index_file.is_file():
                    return index_file.resolve()

        return None

    def _check_asset_reference(
        self,
        source_file: Path,
        reference: str,
        kind: str,
    ) -> None:
        if kind == "html":
            suffixes = HTML_CANDIDATE_SUFFIXES
        else:
            suffixes = JS_CANDIDATE_SUFFIXES

        target = self._resolve_asset(
            source_file,
            reference,
            suffixes,
        )

        if target is not None:
            self.edges.add(
                (
                    self.relative(source_file),
                    self.relative(target),
                    kind,
                )
            )
            return

        parsed = urlsplit(reference)

        if parsed.scheme or parsed.netloc or not parsed.path:
            return

        if reference.startswith(("#", "data:", "blob:")):
            return

        self.add_issue(
            "WARNING",
            "BROKEN_LOCAL_REFERENCE",
            source_file,
            f"Local reference could not be resolved: {reference}",
            "Verify the path, extension, filename casing and base directory.",
        )

    def analyze_frontend(self) -> None:
        for path in self.files:
            suffix = path.suffix.lower()

            if suffix not in {
                ".html", ".htm", ".css", ".js", ".mjs", ".cjs",
                ".ts", ".tsx", ".jsx",
            }:
                continue

            source = self.read_text(path)

            if source is None:
                continue

            if suffix in {".html", ".htm"}:
                for match in HTML_REFERENCE_PATTERN.finditer(source):
                    reference = match.group(1).strip()
                    self._check_asset_reference(path, reference, "html-reference")

            elif suffix == ".css":
                for match in CSS_URL_PATTERN.finditer(source):
                    reference = match.group(1).strip()

                    if reference.startswith(("data:", "blob:", "#")):
                        continue

                    target = self._resolve_asset(
                        path,
                        reference,
                        JS_CANDIDATE_SUFFIXES,
                    )

                    if target is not None:
                        self.edges.add(
                            (
                                self.relative(path),
                                self.relative(target),
                                "css-reference",
                            )
                        )
                    elif reference and not urlsplit(reference).scheme:
                        self.add_issue(
                            "WARNING",
                            "BROKEN_CSS_REFERENCE",
                            path,
                            f"CSS resource could not be resolved: {reference}",
                            "Check relative asset paths and filenames.",
                        )

            else:
                for match in JS_IMPORT_PATTERN.finditer(source):
                    reference = match.group("path")

                    if not reference.startswith(("./", "../", "/")):
                        continue

                    self._check_asset_reference(
                        path,
                        reference,
                        "javascript-import",
                    )

    # ------------------------------------------------------------------
    # JSON validation
    # ------------------------------------------------------------------

    def analyze_json(self) -> None:
        for path in self.files:
            if path.suffix.lower() != ".json":
                continue

            source = self.read_text(path)

            if source is None:
                continue

            try:
                json.loads(source)
            except json.JSONDecodeError as exc:
                self.add_issue(
                    "ERROR",
                    "INVALID_JSON",
                    path,
                    f"{exc.msg} at line {exc.lineno}, column {exc.colno}.",
                    "Fix JSON syntax before using the dataset.",
                )

    # ------------------------------------------------------------------
    # Package markers
    # ------------------------------------------------------------------

    def create_package_markers(self) -> None:
        """
        Optionally create missing __init__.py files.

        Existing files are never overwritten. This is opt-in because modern
        Python namespace packages do not always require __init__.py.
        """

        directories = {path.parent for path in self.python_files}

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
                self.add_issue(
                    "ERROR",
                    "INIT_CREATE_FAILED",
                    init_file,
                    str(exc),
                )
                continue

            relative = self.relative(init_file)
            self.created_files.append(relative)

            self.add_issue(
                "INFO",
                "INIT_CREATED",
                init_file,
                "Created a missing Python package marker.",
            )

    # ------------------------------------------------------------------
    # Graph analysis
    # ------------------------------------------------------------------

    def find_unreferenced_files(self) -> list[str]:
        incoming = {target for _, target, _ in self.edges}

        # Entry points are often intentionally not imported by other modules.
        entrypoint_names = {
            "main.py",
            "app.py",
            "server.py",
            "manage.py",
            "wsgi.py",
            "asgi.py",
            "__main__.py",
        }

        result = []

        for node in sorted(self.nodes):
            if node in incoming:
                continue

            if Path(node).name in entrypoint_names:
                continue

            result.append(node)

        return result

    def find_cycles(self) -> list[list[str]]:
        adjacency: dict[str, list[str]] = defaultdict(list)

        for source, target, kind in self.edges:
            if kind == "python-import":
                adjacency[source].append(target)

        for source in adjacency:
            adjacency[source] = sorted(set(adjacency[source]))

        index = 0
        indices: dict[str, int] = {}
        lowlinks: dict[str, int] = {}
        stack: list[str] = []
        on_stack: set[str] = set()
        cycles: list[list[str]] = []

        def strong_connect(node: str) -> None:
            nonlocal index

            indices[node] = index
            lowlinks[node] = index
            index += 1

            stack.append(node)
            on_stack.add(node)

            for neighbor in adjacency.get(node, []):
                if neighbor not in indices:
                    strong_connect(neighbor)
                    lowlinks[node] = min(
                        lowlinks[node],
                        lowlinks[neighbor],
                    )
                elif neighbor in on_stack:
                    lowlinks[node] = min(
                        lowlinks[node],
                        indices[neighbor],
                    )

            if lowlinks[node] == indices[node]:
                component = []

                while stack:
                    member = stack.pop()
                    on_stack.remove(member)
                    component.append(member)

                    if member == node:
                        break

                if len(component) > 1:
                    cycles.append(sorted(component))

        for node in sorted(self.nodes):
            if node not in indices:
                strong_connect(node)

        return cycles

    def build_mermaid(self) -> str:
        lines = ["flowchart TD"]

        node_ids: dict[str, str] = {}

        all_nodes = sorted(
            self.nodes
            | {source for source, _, _ in self.edges}
            | {target for _, target, _ in self.edges}
        )

        for index, node in enumerate(all_nodes):
            identifier = f"N{index}"
            node_ids[node] = identifier
            label = node.replace("\\", "/").replace('"', "'")
            lines.append(f'    {identifier}["{label}"]')

        for source, target, kind in sorted(self.edges):
            if source not in node_ids or target not in node_ids:
                continue

            label = kind.replace('"', "'")
            lines.append(
                f'    {node_ids[source]} -->|"{label}"| {node_ids[target]}'
            )

        return "\n".join(lines) + "\n"

    # ------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------

    def run(self) -> dict[str, Any]:
        self.discover()
        self.analyze_python()
        self.analyze_frontend()
        self.analyze_json()

        if self.create_init:
            self.create_package_markers()

        cycles = self.find_cycles()

        for cycle in cycles:
            self.add_issue(
                "WARNING",
                "PYTHON_IMPORT_CYCLE",
                cycle[0],
                "Potential circular Python import: " + " -> ".join(cycle),
                "Consider moving shared interfaces into a lower-level module.",
            )

        return {
            "schema_version": "1.0.0",
            "tool": "MedOrbits Dependency Binder",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository_root": str(self.root),
            "files_scanned": len(self.files),
            "python_files_scanned": len(self.python_files),
            "dependency_edges": [
                {
                    "source": source,
                    "target": target,
                    "type": kind,
                }
                for source, target, kind in sorted(self.edges)
            ],
            "dependency_edge_count": len(self.edges),
            "unreferenced_python_files": self.find_unreferenced_files(),
            "circular_import_groups": cycles,
            "created_files": self.created_files,
            "issues": self.issues,
            "limitations": [
                "Static analysis does not execute application code.",
                "Dynamic imports and runtime plugin loading may be missed.",
                "An unreferenced module may intentionally be an entry point or plugin.",
                "External APIs and database schemas require separate contract checks.",
                "A detected reference does not prove runtime connectivity.",
            ],
        }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Map and audit dependencies in a MedOrbits repository."
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root directory.",
    )

    parser.add_argument(
        "--create-init",
        action="store_true",
        help="Create missing __init__.py files in directories containing Python modules.",
    )

    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Include hidden files and directories.",
    )

    parser.add_argument(
        "--format",
        choices=("json", "mermaid", "both"),
        default="both",
        help="Output report format.",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory. Defaults to <root>/reports.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()

    output_dir = (
        args.output_dir.expanduser().resolve()
        if args.output_dir
        else root / "reports"
    )

    try:
        binder = DependencyBinder(
            root,
            create_init=args.create_init,
            include_hidden=args.include_hidden,
        )

        report = binder.run()
        output_dir.mkdir(parents=True, exist_ok=True)

        if args.format in {"json", "both"}:
            report_path = output_dir / "dependency-map.json"
            report_path.write_text(
                json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            print(f"JSON report: {report_path}")

        if args.format in {"mermaid", "both"}:
            diagram_path = output_dir / "dependency-map.mmd"
            diagram_path.write_text(
                binder.build_mermaid(),
                encoding="utf-8",
            )
            print(f"Mermaid graph: {diagram_path}")

        errors = sum(
            issue["severity"] == "ERROR"
            for issue in report["issues"]
        )
        warnings = sum(
            issue["severity"] == "WARNING"
            for issue in report["issues"]
        )

        print("\nMedOrbits Dependency Binder")
        print("=" * 28)
        print(f"Files scanned: {report['files_scanned']}")
        print(f"Python files: {report['python_files_scanned']}")
        print(f"Dependency edges: {report['dependency_edge_count']}")
        print(f"Potential circular groups: {len(report['circular_import_groups'])}")
        print(f"Errors: {errors}")
        print(f"Warnings: {warnings}")

        if report["created_files"]:
            print("\nCreated package markers:")
            for path in report["created_files"]:
                print(f"  + {path}")

        return 1 if errors else 0

    except (OSError, DependencyBinderError) as exc:
        print(f"Dependency analysis failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
