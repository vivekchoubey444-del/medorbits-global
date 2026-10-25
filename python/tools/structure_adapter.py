
#!/usr/bin/env python3
"""
MedOrbits Structure Adapter
===========================

File:
    python/tools/structure_adapter.py

Purpose:
    Analyze related repository files and recommend how they should align
    with a selected reference file's architecture, imports, API conventions,
    naming patterns, and data contracts.

Features:
    - Safe repository-scoped file discovery.
    - Symlink and ignored-directory protection.
    - Python AST-based import and definition extraction.
    - JavaScript/TypeScript route and import heuristics.
    - JSON structure comparison.
    - Conservative secret-pattern detection.
    - SHA-256 source fingerprints.
    - Machine-readable JSON reports.
    - Explicit adaptation plans without automatic source rewriting.
    - Atomic report writes and optional backups before replacement.
    - Deterministic output and meaningful exit codes.
    - No network access and no third-party dependencies.

Compatibility:
    Python 3.10+
    Standard library only.

Examples:
    python python/tools/structure_adapter.py

    python python/tools/structure_adapter.py \
        --reference python/integrations/base.py

    python python/tools/structure_adapter.py \
        --reference python/integrations/base.py \
        --target python/integrations/registry.py

    python python/tools/structure_adapter.py \
        --reference python/integrations/base.py \
        --target python/integrations/registry.py \
        --output reports/structure-adaptation.json

    python python/tools/structure_adapter.py --check-secrets

    python python/tools/structure_adapter.py \
        --reference python/integrations/base.py \
        --target python/integrations/registry.py \
        --apply-safe

    python python/tools/structure_adapter.py \
        --output reports/structure-adaptation.json \
        --force

Safety:
    - Never executes discovered source code.
    - Never automatically rewrites source files.
    - Does not print detected secret values.
    - Restricts scanned files and report destinations to the repository.
    - Refuses to overwrite existing reports unless --force is specified.
    - Creates a backup before replacing an existing report with --force.
    - Treats inferred conventions as recommendations, not requirements.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


TOOL_NAME = "MedOrbits Structure Adapter"
SCHEMA_VERSION = "1.1.0"

# This file lives at <repository>/python/tools/structure_adapter.py.
PROJECT_ROOT = Path(__file__).resolve().parents[2]

IGNORED_DIRECTORIES = {
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
    ".tox",
    ".next",
    ".turbo",
    ".vercel",
    "dist",
    "build",
    "coverage",
    "out",
    "vendor",
    "site-packages",
}

SUPPORTED_EXTENSIONS = {
    ".py",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".html",
    ".css",
    ".json",
    ".yml",
    ".yaml",
    ".toml",
}

MAX_SOURCE_BYTES = 5 * 1024 * 1024
MAX_JSON_DEPTH = 100

SECRET_PATTERNS = (
    (
        "POSSIBLE_API_KEY",
        re.compile(
            r"""(?i)\b(?:api[_-]?key|access[_-]?token)\b"""
            r"""\s*[:=]\s*["'][^"' \r\n]{8,}["']"""
        ),
    ),
    (
        "POSSIBLE_PASSWORD",
        re.compile(
            r"""(?i)\b(?:password|passwd|client_secret)\b"""
            r"""\s*[:=]\s*["'][^"'\r\n]{4,}["']"""
        ),
    ),
    (
        "POSSIBLE_PRIVATE_KEY",
        re.compile(
            r"""-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"""
        ),
    ),
)

PYTHON_IMPORT_PATTERN = re.compile(
    r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))",
    re.MULTILINE,
)

API_PATH_PATTERN = re.compile(
    r"""(?P<quote>["'`])"""
    r"""(?P<path>/(?:api/)?[a-zA-Z0-9_./:{}?=&-]+)"""
    r"""(?P=quote)"""
)

JS_HTTP_METHOD_PATTERN = re.compile(
    r"""\.\s*(get|post|put|patch|delete|options|head)\s*"""
    r"""\(\s*["'`](?P<path>[^"'`\r\n]+)["'`]""",
    re.IGNORECASE,
)

NEXT_ROUTE_EXPORT_PATTERN = re.compile(
    r"""^\s*export\s+(?:async\s+)?function\s+"""
    r"""(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(""",
    re.MULTILINE,
)

JS_IMPORT_PATTERN = re.compile(
    r"""^\s*import\s+(?:type\s+)?"""
    r"""(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']""",
    re.MULTILINE,
)

JS_REQUIRE_PATTERN = re.compile(
    r"""\brequire\s*\(\s*["']([^"']+)["']\s*\)"""
)

NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@dataclass
class Issue:
    severity: str
    code: str
    file: str
    message: str
    line: int | None = None
    reference_file: str | None = None
    suggestion: str | None = None


@dataclass
class FileProfile:
    path: str
    extension: str
    sha256: str
    size_bytes: int
    line_count: int
    imports: list[str]
    definitions: list[str]
    api_paths: list[str]
    http_routes: list[dict[str, str]]
    json_top_level_type: str | None = None
    json_top_level_keys: list[str] | None = None


class StructureAdapter:
    """Analyze repository structure without executing or rewriting source."""

    def __init__(
        self,
        root: Path,
        reference: Path | None = None,
        target: Path | None = None,
        check_secrets: bool = False,
    ) -> None:
        self.root = root.expanduser().resolve(strict=True)

        if not self.root.is_dir():
            raise ValueError(f"Repository root is not a directory: {root}")

        self.reference = self._resolve_path(reference) if reference else None
        self.target = self._resolve_path(target) if target else None

        self.check_secrets = check_secrets
        self.issues: list[Issue] = []
        self.profiles: dict[str, FileProfile] = {}
        self._issue_keys: set[tuple[Any, ...]] = set()

    # --------------------------------------------------------
    # Path safety
    # --------------------------------------------------------

    def _resolve_path(self, path: Path) -> Path:
        candidate = path if path.is_absolute() else self.root / path
        candidate = candidate.resolve(strict=False)

        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise ValueError(
                f"Path must remain inside the repository: {path}"
            ) from exc

        return candidate

    def _relative(self, path: Path | None) -> str | None:
        if path is None:
            return None

        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return None

    def _safe_existing_file(self, path: Path) -> bool:
        try:
            resolved = path.resolve(strict=True)
            resolved.relative_to(self.root)

            return (
                resolved.is_file()
                and not self._contains_ignored_directory(resolved)
            )
        except (OSError, ValueError, RuntimeError):
            return False

    @staticmethod
    def _contains_ignored_directory(path: Path) -> bool:
        return any(
            part in IGNORED_DIRECTORIES
            for part in path.parts
        )

    # --------------------------------------------------------
    # Issue management
    # --------------------------------------------------------

    def _add_issue(self, issue: Issue) -> None:
        key = (
            issue.severity,
            issue.code,
            issue.file,
            issue.line,
            issue.message,
        )

        if key not in self._issue_keys:
            self._issue_keys.add(key)
            self.issues.append(issue)

    # --------------------------------------------------------
    # Source reading
    # --------------------------------------------------------

    def _read_text(self, path: Path) -> str | None:
        relative = self._relative(path) or "<outside-repository>"

        if not self._safe_existing_file(path):
            self._add_issue(
                Issue(
                    severity="ERROR",
                    code="UNSAFE_OR_MISSING_FILE",
                    file=relative,
                    message="File is missing, unsafe, or outside the repository.",
                )
            )
            return None

        try:
            size = path.stat().st_size

            if size > MAX_SOURCE_BYTES:
                self._add_issue(
                    Issue(
                        severity="WARNING",
                        code="FILE_TOO_LARGE",
                        file=relative,
                        message=(
                            f"File exceeds the {MAX_SOURCE_BYTES}-byte "
                            "analysis limit."
                        ),
                    )
                )
                return None

            return path.read_text(encoding="utf-8-sig")

        except UnicodeDecodeError:
            self._add_issue(
                Issue(
                    severity="WARNING",
                    code="UNSUPPORTED_ENCODING",
                    file=relative,
                    message="File is not valid UTF-8 text.",
                )
            )
        except OSError:
            self._add_issue(
                Issue(
                    severity="ERROR",
                    code="FILE_READ_FAILED",
                    file=relative,
                    message="Unable to read the file.",
                )
            )

        return None

    # --------------------------------------------------------
    # Discovery
    # --------------------------------------------------------

    def discover_files(self) -> list[Path]:
        """Discover supported files without following directory symlinks."""

        results: list[Path] = []

        def on_walk_error(_error: OSError) -> None:
            self._add_issue(
                Issue(
                    severity="WARNING",
                    code="DISCOVERY_DIRECTORY_UNREADABLE",
                    file=".",
                    message="One or more directories could not be scanned.",
                )
            )

        for current, directories, filenames in os.walk(
            self.root,
            topdown=True,
            followlinks=False,
            onerror=on_walk_error,
        ):
            current_path = Path(current)

            directories[:] = sorted(
                directory
                for directory in directories
                if directory not in IGNORED_DIRECTORIES
                and not directory.startswith(".")
                and not (current_path / directory).is_symlink()
            )

            for filename in sorted(filenames):
                path = current_path / filename

                if path.is_symlink():
                    continue

                if filename.startswith("."):
                    continue

                if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                if not self._safe_existing_file(path):
                    continue

                results.append(path)

        return sorted(results, key=lambda item: self._relative(item) or "")

    # --------------------------------------------------------
    # Language analysis
    # --------------------------------------------------------

    def _analyze_python(
        self,
        source: str,
        relative: str,
    ) -> tuple[list[str], list[str], list[dict[str, str]]]:
        imports: list[str] = []
        definitions: list[str] = []
        routes: list[dict[str, str]] = []

        try:
            tree = ast.parse(source, filename=relative)
        except SyntaxError as exc:
            self._add_issue(
                Issue(
                    severity="ERROR",
                    code="PYTHON_SYNTAX",
                    file=relative,
                    message=exc.msg,
                    line=exc.lineno,
                    suggestion="Fix Python syntax errors before adapting this file.",
                )
            )
            return imports, definitions, routes

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(alias.name for alias in node.names)

            elif isinstance(node, ast.ImportFrom):
                module = "." * node.level + (node.module or "")
                imports.append(module)

            elif isinstance(
                node,
                (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef),
            ):
                definitions.append(node.name)

            # Extract common static route patterns, such as:
            # app.get("/api/example", handler)
            elif isinstance(node, ast.Call):
                method_name: str | None = None

                if isinstance(node.func, ast.Attribute):
                    method_name = node.func.attr.lower()

                if method_name not in {
                    "get", "post", "put", "patch",
                    "delete", "options", "head",
                }:
                    continue

                if not node.args:
                    continue

                first_argument = node.args[0]

                if isinstance(first_argument, ast.Constant) and isinstance(
                    first_argument.value, str
                ):
                    routes.append(
                        {
                            "method": method_name.upper(),
                            "path": first_argument.value,
                        }
                    )

        return imports, definitions, routes

    def _analyze_javascript(
        self,
        source: str,
    ) -> tuple[list[str], list[str], list[dict[str, str]]]:
        imports: list[str] = []
        definitions: list[str] = []
        routes: list[dict[str, str]] = []

        imports.extend(JS_IMPORT_PATTERN.findall(source))
        imports.extend(JS_REQUIRE_PATTERN.findall(source))

        for match in NEXT_ROUTE_EXPORT_PATTERN.finditer(source):
            routes.append(
                {
                    "method": match.group(1).upper(),
                    "path": "<Next.js route-handler>",
                }
            )

        for match in JS_HTTP_METHOD_PATTERN.finditer(source):
            routes.append(
                {
                    "method": match.group(1).upper(),
                    "path": match.group("path"),
                }
            )

        # Heuristic only: this is not a complete JS/TS parser.
        definition_pattern = re.compile(
            r"""(?:^|\n)\s*"""
            r"""(?:(?:export|default|async)\s+)*"""
            r"""(?:function|class)\s+([A-Za-z_$][\w$]*)""",
            re.MULTILINE,
        )

        definitions.extend(definition_pattern.findall(source))

        return imports, definitions, routes

    # --------------------------------------------------------
    # JSON analysis
    # --------------------------------------------------------

    def _check_json_depth(self, payload: Any) -> bool:
        stack: list[tuple[Any, int]] = [(payload, 1)]

        while stack:
            current, depth = stack.pop()

            if depth > MAX_JSON_DEPTH:
                return False

            if isinstance(current, dict):
                stack.extend(
                    (value, depth + 1)
                    for value in current.values()
                )
            elif isinstance(current, list):
                stack.extend(
                    (value, depth + 1)
                    for value in current
                )

        return True

    def _analyze_json(
        self,
        source: str,
        relative: str,
    ) -> tuple[str | None, list[str] | None]:
        try:
            payload = json.loads(source)
        except json.JSONDecodeError as exc:
            self._add_issue(
                Issue(
                    severity="ERROR",
                    code="INVALID_JSON",
                    file=relative,
                    message=exc.msg,
                    line=exc.lineno,
                    suggestion=(
                        "Correct the JSON syntax before comparing data contracts."
                    ),
                )
            )
            return None, None

        if not self._check_json_depth(payload):
            self._add_issue(
                Issue(
                    severity="ERROR",
                    code="JSON_NESTING_LIMIT",
                    file=relative,
                    message="JSON exceeds the supported nesting depth.",
                )
            )
            return None, None

        top_level_type = type(payload).__name__

        if isinstance(payload, dict):
            keys = sorted(str(key) for key in payload.keys())
        else:
            keys = []

        return top_level_type, keys

    # --------------------------------------------------------
    # Secret scanning
    # --------------------------------------------------------

    def _scan_secrets(self, source: str, relative: str) -> None:
        """
        Report likely hard-coded secrets without emitting their values.

        This is a heuristic scanner. It can produce false positives and
        cannot detect every credential format.
        """

        for line_number, line in enumerate(source.splitlines(), start=1):
            for code, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    self._add_issue(
                        Issue(
                            severity="WARNING",
                            code=code,
                            file=relative,
                            line=line_number,
                            message=(
                                "Possible hard-coded credential detected. "
                                "The matching value was not included in the report."
                            ),
                            suggestion=(
                                "Verify the finding. Move real credentials "
                                "to a secret manager or server-side environment variable."
                            ),
                        )
                    )

    # --------------------------------------------------------
    # File profiling
    # --------------------------------------------------------

    def profile_file(self, path: Path) -> FileProfile | None:
        source = self._read_text(path)

        if source is None:
            return None

        relative = self._relative(path)

        if relative is None:
            return None

        extension = path.suffix.lower()
        imports: list[str] = []
        definitions: list[str] = []
        routes: list[dict[str, str]] = []
        api_paths: list[str] = []
        json_type: str | None = None
        json_keys: list[str] | None = None

        if extension == ".py":
            imports, definitions, routes = self._analyze_python(
                source,
                relative,
            )

        elif extension in {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"}:
            imports, definitions, routes = self._analyze_javascript(source)

        elif extension in {".html", ".css"}:
            # Textual API-path detection is heuristic and may match examples.
            api_paths.extend(
                match.group("path")
                for match in API_PATH_PATTERN.finditer(source)
            )

        elif extension == ".json":
            json_type, json_keys = self._analyze_json(source, relative)

        if extension not in {".py"}:
            api_paths.extend(
                match.group("path")
                for match in API_PATH_PATTERN.finditer(source)
            )

        for route in routes:
            if route["path"].startswith("/"):
                api_paths.append(route["path"])

        if self.check_secrets:
            self._scan_secrets(source, relative)

        profile = FileProfile(
            path=relative,
            extension=extension,
            sha256=hashlib.sha256(source.encode("utf-8")).hexdigest(),
            size_bytes=len(source.encode("utf-8")),
            line_count=len(source.splitlines()),
            imports=sorted(set(imports)),
            definitions=sorted(set(definitions)),
            api_paths=sorted(set(api_paths)),
            http_routes=sorted(
                routes,
                key=lambda route: (route["method"], route["path"]),
            ),
            json_top_level_type=json_type,
            json_top_level_keys=json_keys,
        )

        self.profiles[relative] = profile
        return profile

    # --------------------------------------------------------
    # Related files
    # --------------------------------------------------------

    def _group_related_files(
        self,
        files: Iterable[Path],
    ) -> dict[str, list[str]]:
        groups: dict[str, list[str]] = {}

        for path in files:
            relative = self._relative(path)

            if relative is None:
                continue

            key = f"{path.parent.relative_to(self.root).as_posix()}::{path.stem.lower()}"
            groups.setdefault(key, []).append(relative)

        return {
            key: sorted(items)
            for key, items in sorted(groups.items())
            if len(items) > 1
        }

    # --------------------------------------------------------
    # File comparison
    # --------------------------------------------------------

    def compare_files(
        self,
        reference: Path,
        target: Path,
    ) -> dict[str, Any]:
        reference_name = self._relative(reference)
        target_name = self._relative(target)

        if reference_name is None or target_name is None:
            return {
                "status": "incomplete",
                "message": "Reference or target is outside the repository.",
            }

        reference_profile = self.profiles.get(reference_name)
        target_profile = self.profiles.get(target_name)

        if reference_profile is None or target_profile is None:
            return {
                "status": "incomplete",
                "message": "Could not build both file profiles.",
            }

        recommendations: list[str] = []

        if reference_profile.extension != target_profile.extension:
            recommendations.append(
                "The files use different extensions. Compare architectural "
                "responsibilities rather than copying syntax directly."
            )

        shared_imports = sorted(
            set(reference_profile.imports)
            & set(target_profile.imports)
        )

        reference_only_imports = sorted(
            set(reference_profile.imports)
            - set(target_profile.imports)
        )

        target_only_imports = sorted(
            set(target_profile.imports)
            - set(reference_profile.imports)
        )

        if reference_only_imports:
            recommendations.append(
                "Reference-only imports require review; they are not "
                "automatically required by the target."
            )

        reference_paths = set(reference_profile.api_paths)
        target_paths = set(target_profile.api_paths)

        reference_only_paths = sorted(reference_paths - target_paths)
        target_only_paths = sorted(target_paths - reference_paths)

        if reference_only_paths or target_only_paths:
            recommendations.append(
                "API-path differences require semantic review. Different "
                "modules may legitimately expose different routes."
            )

        json_comparison: dict[str, Any] | None = None

        if (
            reference_profile.json_top_level_type is not None
            and target_profile.json_top_level_type is not None
        ):
            reference_type = reference_profile.json_top_level_type
            target_type = target_profile.json_top_level_type

            reference_keys = set(reference_profile.json_top_level_keys or [])
            target_keys = set(target_profile.json_top_level_keys or [])

            json_comparison = {
                "reference_type": reference_type,
                "target_type": target_type,
                "types_match": reference_type == target_type,
                "reference_only_keys": sorted(reference_keys - target_keys),
                "target_only_keys": sorted(target_keys - reference_keys),
                "shared_keys": sorted(reference_keys & target_keys),
            }

            if reference_type != target_type:
                recommendations.append(
                    "JSON top-level types differ. Verify whether both "
                    "files are intended to implement the same data contract."
                )

            if reference_keys != target_keys:
                recommendations.append(
                    "JSON key differences require schema or business-rule "
                    "review before any fields are added or removed."
                )

        if not recommendations:
            recommendations.append(
                "No obvious structural differences were detected by the "
                "supported heuristics. This does not prove full compatibility."
            )

        return {
            "status": "analyzed",
            "reference_file": reference_name,
            "target_file": target_name,
            "reference_sha256": reference_profile.sha256,
            "target_sha256": target_profile.sha256,
            "imports": {
                "shared": shared_imports,
                "reference_only": reference_only_imports,
                "target_only": target_only_imports,
            },
            "api_paths": {
                "shared": sorted(reference_paths & target_paths),
                "reference_only": reference_only_paths,
                "target_only": target_only_paths,
            },
            "json_contract": json_comparison,
            "recommendations": recommendations,
        }

    # --------------------------------------------------------
    # Analysis orchestration
    # --------------------------------------------------------

    def analyze(self) -> dict[str, Any]:
        all_files = self.discover_files()

        for path in all_files:
            self.profile_file(path)

        # Explicitly profile selected files even if discovery did not include
        # them, for example when their extensions are not in the normal list.
        for selected in (self.reference, self.target):
            if selected is None:
                continue

            if not selected.exists():
                self._add_issue(
                    Issue(
                        severity="ERROR",
                        code=(
                            "REFERENCE_MISSING"
                            if selected == self.reference
                            else "TARGET_MISSING"
                        ),
                        file=self._relative(selected) or "<invalid-path>",
                        message="The selected file does not exist.",
                    )
                )
                continue

            if not self._safe_existing_file(selected):
                self._add_issue(
                    Issue(
                        severity="ERROR",
                        code="SELECTED_FILE_UNSAFE",
                        file=self._relative(selected) or "<invalid-path>",
                        message=(
                            "The selected file is unsafe, unsupported, "
                            "or outside the repository."
                        ),
                    )
                )
                continue

            relative = self._relative(selected)

            if relative is not None and relative not in self.profiles:
                self.profile_file(selected)

        comparison = None

        if self.reference is not None and self.target is not None:
            if (
                self._relative(self.reference) in self.profiles
                and self._relative(self.target) in self.profiles
            ):
                comparison = self.compare_files(
                    self.reference,
                    self.target,
                )

        severity_counts = {
            severity: sum(
                issue.severity == severity
                for issue in self.issues
            )
            for severity in ("ERROR", "WARNING", "INFO")
        }

        return {
            "schema_version": SCHEMA_VERSION,
            "tool": TOOL_NAME,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository_root": str(self.root),
            "reference": self._relative(self.reference),
            "target": self._relative(self.target),
            "files_discovered": len(all_files),
            "files_profiled": len(self.profiles),
            "profiles": {
                name: asdict(profile)
                for name, profile in sorted(self.profiles.items())
            },
            "related_file_groups": self._group_related_files(all_files),
            "comparison": comparison,
            "issues": [
                asdict(issue)
                for issue in sorted(
                    self.issues,
                    key=lambda item: (
                        item.severity,
                        item.file,
                        item.line or 0,
                        item.code,
                    ),
                )
            ],
            "summary": {
                "errors": severity_counts["ERROR"],
                "warnings": severity_counts["WARNING"],
                "info": severity_counts["INFO"],
            },
            "apply_policy": {
                "automatic_source_rewrites": False,
                "review_required": True,
                "reason": (
                    "Static file similarities cannot establish business "
                    "requirements, route ownership, or data-contract intent."
                ),
            },
        }

    # --------------------------------------------------------
    # Report writing
    # --------------------------------------------------------

    def _resolve_output_path(self, output: Path) -> Path:
        resolved = self._resolve_path(output)

        if self._contains_ignored_directory(resolved):
            raise ValueError(
                "Report destination cannot be inside a dependency or build directory."
            )

        if resolved.suffix.lower() != ".json":
            raise ValueError("Report output must use the .json extension.")

        return resolved

    def _create_backup(self, path: Path) -> Path:
        if not path.exists():
            raise FileNotFoundError("Cannot back up a missing file.")

        if path.is_symlink() or not path.is_file():
            raise ValueError("Refusing to back up a symlink or non-file.")

        backup_dir = self.root / "reports" / "backups"
        backup_dir.mkdir(parents=True, exist_ok=True)

        if backup_dir.is_symlink():
            raise ValueError("Backup directory must not be a symbolic link.")

        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        digest = hashlib.sha256(
            path.read_bytes()
        ).hexdigest()[:12]

        backup_path = backup_dir / (
            f"{path.name}.{timestamp}.{digest}.bak"
        )

        shutil.copy2(path, backup_path)

        return backup_path

    def write_report(
        self,
        output: Path,
        payload: dict[str, Any],
        *,
        force: bool = False,
    ) -> Path:
        destination = self._resolve_output_path(output)
        destination.parent.mkdir(parents=True, exist_ok=True)

        if destination.is_symlink():
            raise ValueError("Refusing to write through a symbolic link.")

        if not destination.parent.is_dir():
            raise ValueError("Report parent path is not a directory.")

        backup_path: Path | None = None

        if destination.exists():
            if not force:
                raise FileExistsError(
                    f"Report already exists: {self._relative(destination)}. "
                    "Use --force to replace it with a backup."
                )

            backup_path = self._create_backup(destination)

        content = json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
            sort_keys=True,
        ) + "\n"

        temporary_path: Path | None = None

        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="\n",
                dir=destination.parent,
                prefix=".structure-adapter-",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temporary_path = Path(handle.name)
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())

            # Recheck the destination immediately before replacement.
            if destination.is_symlink():
                raise ValueError(
                    "Report destination became a symbolic link."
                )

            if destination.exists() and not force:
                raise FileExistsError(
                    "Report appeared during execution; refusing to overwrite."
                )

            os.replace(temporary_path, destination)
            temporary_path = None

        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink(missing_ok=True)
                except OSError:
                    pass

        if backup_path is not None:
            print(
                f"Previous report backup: "
                f"{self._relative(backup_path)}",
                file=sys.stderr,
            )

        return destination

    # --------------------------------------------------------
    # Adaptation plan
    # --------------------------------------------------------

    def apply_safe(
        self,
        payload: dict[str, Any],
        *,
        force: bool = False,
    ) -> Path:
        """
        Write a review-required adaptation plan.

        This method intentionally does not rewrite source code. Its name is
        retained for compatibility with the CLI option --apply-safe.
        """

        comparison = payload.get("comparison") or {}

        plan = {
            "schema_version": SCHEMA_VERSION,
            "tool": TOOL_NAME,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "review_required",
            "repository_root": str(self.root),
            "reference": payload.get("reference"),
            "target": payload.get("target"),
            "source_hashes": {
                name: profile["sha256"]
                for name, profile in payload.get("profiles", {}).items()
            },
            "recommendations": comparison.get("recommendations", []),
            "issues": payload.get("issues", []),
            "changes_applied": [],
            "source_files_modified": False,
            "message": (
                "No source files were modified. Review the findings, confirm "
                "the intended contract, and implement approved changes separately."
            ),
        }

        plan_path = self.root / "reports" / "adaptation-plan.json"

        written_path = self.write_report(
            plan_path,
            plan,
            force=force,
        )

        return written_path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Analyze related MedOrbits files and compare their structural "
            "conventions without rewriting source code."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument(
        "--root",
        type=Path,
        default=PROJECT_ROOT,
        help="Repository root.",
    )

    parser.add_argument(
        "--reference",
        type=Path,
        help="Reference file whose conventions should be reviewed.",
    )

    parser.add_argument(
        "--target",
        type=Path,
        help="Target file to compare against the reference.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="JSON report destination, relative to the repository root or an absolute path inside it.",
    )

    parser.add_argument(
        "--apply-safe",
        action="store_true",
        help=(
            "Write a review-required adaptation plan. Does not rewrite source files."
        ),
    )

    parser.add_argument(
        "--check-secrets",
        action="store_true",
        help="Enable heuristic scanning for likely hard-coded credentials.",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace existing report files after backing them up.",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        root = args.root.expanduser().resolve(strict=True)

        adapter = StructureAdapter(
            root=root,
            reference=args.reference,
            target=args.target,
            check_secrets=args.check_secrets,
        )

        payload = adapter.analyze()

        default_output = root / "reports" / "structure-adaptation.json"
        requested_output = args.output or default_output

        output = adapter.write_report(
            requested_output,
            payload,
            force=args.force,
        )

        plan_path: Path | None = None

        if args.apply_safe:
            plan_path = adapter.apply_safe(
                payload,
                force=args.force,
            )

    except FileExistsError as exc:
        print(f"Report not written: {exc}", file=sys.stderr)
        return 2

    except (OSError, ValueError, RuntimeError) as exc:
        # Do not dump environment variables or source contents in failures.
        print(
            f"Structure adaptation failed: {exc}",
            file=sys.stderr,
        )
        return 2

    errors = payload["summary"]["errors"]
    warnings = payload["summary"]["warnings"]

    print(TOOL_NAME)
    print("=" * len(TOOL_NAME))
    print(f"Repository:      {root}")
    print(f"Files discovered: {payload['files_discovered']}")
    print(f"Files profiled:   {payload['files_profiled']}")
    print(f"Errors:           {errors}")
    print(f"Warnings:         {warnings}")
    print(f"Report:           {output.relative_to(root).as_posix()}")

    if payload["comparison"]:
        print(
            "Comparison:      "
            f"{payload['comparison']['status']}"
        )

    if plan_path is not None:
        print(
            "Adaptation plan: "
            f"{plan_path.relative_to(root).as_posix()}"
        )
        print("Source modified: no")

    # A report containing errors should not be treated as a clean analysis.
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
