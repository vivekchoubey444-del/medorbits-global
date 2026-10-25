
#!/usr/bin/env python3
"""
MedOrbits Structure Adapter
===========================

File:
    python/tools/structure_adapter.py

Purpose:
    Analyze related project files and recommend how they should follow
    the same architecture, API conventions, imports, naming rules, and
    data contracts as a selected reference file.

Features:
    - Discover related files by extension, directory, and naming.
    - Extract API routes, exported functions/classes, and import references.
    - Compare a target file with a reference file.
    - Identify potentially inconsistent API paths and naming patterns.
    - Inspect JSON files for compatible top-level structures.
    - Produce a machine-readable adaptation plan.
    - Optionally apply safe, explicitly approved edits.
    - Create backups before applying approved edits.
    - Never invent API endpoints or credentials.
    - Never overwrite files silently.

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

Important:
    This tool analyzes conventions; it does not automatically rewrite
    imports, function signatures, API endpoints, or business logic.
    Use --apply-safe only for explicitly supported, low-risk changes.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import shutil
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


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

API_PATH_PATTERN = re.compile(
    r"""(?P<quote>["'`])(?P<path>/(?:api/)?[a-zA-Z0-9_./:{}?=&-]+)(?P=quote)"""
)

HTTP_METHOD_PATTERN = re.compile(
    r"""\.(get|post|put|patch|delete|options|head)\s*\("""
    r"""\s*["'`](?P<path>[^"'`]+)["'`]""",
    re.IGNORECASE,
)

PYTHON_IMPORT_PATTERN = re.compile(
    r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))",
    re.MULTILINE,
)

SECRET_PATTERN = re.compile(
    r"""(?i)\b(api[_-]?key|secret|password|token)\b\s*[:=]\s*["'][^"']+["']"""
)


@dataclass
class Issue:
    severity: str
    code: str
    file: str
    message: str
    reference_file: str | None = None
    suggestion: str | None = None


@dataclass
class FileProfile:
    path: str
    extension: str
    sha256: str
    line_count: int
    imports: list[str]
    definitions: list[str]
    api_paths: list[str]
    http_routes: list[dict[str, str]]
    json_top_level_type: str | None = None
    json_top_level_keys: list[str] | None = None


class StructureAdapter:
    """Analyze a repository and create structure-adaptation recommendations."""

    def __init__(
        self,
        root: Path,
        reference: Path | None = None,
        target: Path | None = None,
    ) -> None:
        self.root = root.resolve()
        self.reference = self._resolve_path(reference) if reference else None
        self.target = self._resolve_path(target) if target else None
        self.issues: list[Issue] = []
        self.profiles: dict[str, FileProfile] = {}

    def _resolve_path(self, path: Path) -> Path:
        candidate = path if path.is_absolute() else self.root / path
        candidate = candidate.resolve()

        try:
            candidate.relative_to(self.root)
        except ValueError as exc:
            raise ValueError(
                f"Path must remain inside repository: {path}"
            ) from exc

        return candidate

    def _relative(self, path: Path) -> str:
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def _read_text(self, path: Path) -> str | None:
        try:
            return path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeDecodeError) as exc:
            self.issues.append(
                Issue(
                    severity="ERROR",
                    code="FILE_READ_FAILED",
                    file=self._relative(path),
                    message=str(exc),
                )
            )
            return None

    def discover_files(self) -> list[Path]:
        """Find supported project files without traversing dependency folders."""

        results: list[Path] = []

        for path in self.root.rglob("*"):
            if not path.is_file():
                continue

            if any(part in IGNORED_DIRECTORIES for part in path.parts):
                continue

            if any(part.startswith(".") for part in path.relative_to(self.root).parts):
                continue

            if path.suffix.lower() in SUPPORTED_EXTENSIONS:
                results.append(path)

        return sorted(results)

    def profile_file(self, path: Path) -> FileProfile | None:
        source = self._read_text(path)

        if source is None:
            return None

        relative_path = self._relative(path)
        extension = path.suffix.lower()

        imports: list[str] = []
        definitions: list[str] = []
        api_paths: list[str] = []
        routes: list[dict[str, str]] = []
        json_type = None
        json_keys = None

        if extension == ".py":
            try:
                tree = ast.parse(source, filename=relative_path)
            except SyntaxError as exc:
                self.issues.append(
                    Issue(
                        severity="ERROR",
                        code="PYTHON_SYNTAX",
                        file=relative_path,
                        message=exc.msg,
                        suggestion="Fix syntax errors before adapting this file.",
                    )
                )
            else:
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        imports.extend(alias.name for alias in node.names)

                    elif isinstance(node, ast.ImportFrom):
                        module = "." * node.level + (node.module or "")
                        imports.append(module)

                    elif isinstance(
                        node,
                        (
                            ast.FunctionDef,
                            ast.AsyncFunctionDef,
                            ast.ClassDef,
                        ),
                    ):
                        definitions.append(node.name)

            for match in HTTP_METHOD_PATTERN.finditer(source):
                routes.append(
                    {
                        "method": match.group(1).upper(),
                        "path": match.group("path"),
                    }
                )

        else:
            imports.extend(
                match.group(1) or match.group(2)
                for match in PYTHON_IMPORT_PATTERN.finditer(source)
            )

            for match in API_PATH_PATTERN.finditer(source):
                api_paths.append(match.group("path"))

            for match in HTTP_METHOD_PATTERN.finditer(source):
                routes.append(
                    {
                        "method": match.group(1).upper(),
                        "path": match.group("path"),
                    }
                )

        if extension == ".json":
            try:
                payload = json.loads(source)
                json_type = type(payload).__name__

                if isinstance(payload, dict):
                    json_keys = sorted(str(key) for key in payload.keys())
                elif isinstance(payload, list):
                    json_keys = []
                else:
                    json_keys = []

            except json.JSONDecodeError as exc:
                self.issues.append(
                    Issue(
                        severity="ERROR",
                        code="INVALID_JSON",
                        file=relative_path,
                        message=exc.msg,
                        suggestion="Correct JSON syntax before comparing data contracts.",
                    )
                )

        combined_paths = sorted(
            set(api_paths)
            | {route["path"] for route in routes}
        )

        profile = FileProfile(
            path=relative_path,
            extension=extension,
            sha256=hashlib.sha256(source.encode("utf-8")).hexdigest(),
            line_count=len(source.splitlines()),
            imports=sorted(set(imports)),
            definitions=sorted(set(definitions)),
            api_paths=combined_paths,
            http_routes=routes,
            json_top_level_type=json_type,
            json_top_level_keys=json_keys,
        )

        self.profiles[relative_path] = profile
        return profile

    def analyze(self) -> dict[str, Any]:
        """Analyze files and compare the selected reference with its target."""

        all_files = self.discover_files()

        for path in all_files:
            self.profile_file(path)

        if self.reference and not self.reference.is_file():
            self.issues.append(
                Issue(
                    severity="ERROR",
                    code="REFERENCE_MISSING",
                    file=self._relative(self.reference),
                    message="The selected reference file does not exist.",
                )
            )

        if self.target and not self.target.is_file():
            self.issues.append(
                Issue(
                    severity="ERROR",
                    code="TARGET_MISSING",
                    file=self._relative(self.target),
                    message="The selected target file does not exist.",
                )
            )

        comparison = None

        if (
            self.reference
            and self.target
            and self.reference.is_file()
            and self.target.is_file()
        ):
            comparison = self.compare_files(self.reference, self.target)

        related_groups = self._group_related_files(all_files)

        return {
            "schema_version": "1.0.0",
            "tool": "MedOrbits Structure Adapter",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "repository_root": str(self.root),
            "reference": self._relative(self.reference) if self.reference else None,
            "target": self._relative(self.target) if self.target else None,
            "files_discovered": len(all_files),
            "profiles": {
                name: asdict(profile)
                for name, profile in sorted(self.profiles.items())
            },
            "related_file_groups": related_groups,
            "comparison": comparison,
            "issues": [asdict(issue) for issue in self.issues],
            "apply_policy": {
                "automatic_rewrites": False,
                "requires_review": True,
                "reason": (
                    "API routes, imports, and data contracts cannot be "
                    "safely inferred from file names alone."
                ),
            },
        }

    def compare_files(self, reference: Path, target: Path) -> dict[str, Any]:
        """Compare architecture signals without assuming files must be identical."""

        reference_profile = self.profiles.get(self._relative(reference))
        target_profile = self.profiles.get(self._relative(target))

        if reference_profile is None or target_profile is None:
            return {
                "status": "incomplete",
                "message": "Could not build both file profiles.",
            }

        recommendations: list[str] = []

        if reference.suffix.lower() != target.suffix.lower():
            recommendations.append(
                "Different file types: compare architecture rather than "
                "copying syntax or imports directly."
            )

        if reference_profile.extension == ".py" and target_profile.extension == ".py":
            missing_imports = sorted(
                set(reference_profile.imports) - set(target_profile.imports)
            )
            shared_imports = sorted(
                set(reference_profile.imports) & set(target_profile.imports)
            )

            if missing_imports:
                recommendations.append(
                    "Reference-only imports require manual review: "
                    + ", ".join(missing_imports)
                )

            recommendations.append(
                "Do not copy every reference import; add only dependencies "
                "actually required by the target module."
            )

        if reference_profile.api_paths or target_profile.api_paths:
            missing_api_paths = sorted(
                set(reference_profile.api_paths) - set(target_profile.api_paths)
            )
            recommendations.append(
                "Compare API paths semantically. Missing paths are not "
                "automatically defects because modules can have different roles."
            )

        else:
            missing_api_paths = []

        if (
            reference_profile.json_top_level_type is not None
            and target_profile.json_top_level_type is not None
            and reference_profile.json_top_level_type
            != target_profile.json_top_level_type
        ):
            recommendations.append(
                "JSON top-level types differ. Confirm whether both files "
                "are expected to follow the same data contract."
            )

        if (
            reference_profile.json_top_level_keys is not None
            and target_profile.json_top_level_keys is not None
        ):
            reference_keys = set(reference_profile.json_top_level_keys)
            target_keys = set(target_profile.json_top_level_keys)

            recommendations.append(
                "Reference-only JSON keys: "
                + (
                    ", ".join(sorted(reference_keys - target_keys))
                    or "(none)"
                )
            )
            recommendations.append(
                "Target-only JSON keys: "
                + (
                    ", ".join(sorted(target_keys - reference_keys))
                    or "(none)"
                )
            )

        return {
            "status": "analyzed",
            "reference_file": self._relative(reference),
            "target_file": self._relative(target),
            "reference_sha256": reference_profile.sha256,
            "target_sha256": target_profile.sha256,
            "reference_imports": reference_profile.imports,
            "target_imports": target_profile.imports,
            "shared_imports": sorted(
                set(reference_profile.imports) & set(target_profile.imports)
            ),
            "reference_api_paths": reference_profile.api_paths,
            "target_api_paths": target_profile.api_paths,
            "reference_only_api_paths": missing_api_paths,
            "recommendations": recommendations,
        }

    def _group_related_files(self, files: list[Path]) -> dict[str, list[str]]:
        """Group files by directory and filename stem for review."""

        groups: dict[str, list[str]] = {}

        for path in files:
            directory = self._relative(path.parent)
            stem = path.stem.lower()

            key = f"{directory}::{stem}"
            groups.setdefault(key, []).append(self._relative(path))

        return {
            key: sorted(paths)
            for key, paths in sorted(groups.items())
            if len(paths) > 1
        }

    def write_report(self, output: Path, payload: dict[str, Any]) -> None:
        output = output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)

        output.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    def apply_safe(self, payload: dict[str, Any]) -> None:
        """
        Apply only low-risk operations explicitly supported by this tool.

        Currently this intentionally does not rewrite source files. It writes
        a reviewed adaptation plan and records source hashes so a later
        implementation can verify files have not changed.
        """

        plan = {
            "schema_version": "1.0.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "review_required",
            "reference": payload.get("reference"),
            "target": payload.get("target"),
            "source_hashes": {
                name: profile["sha256"]
                for name, profile in payload.get("profiles", {}).items()
            },
            "recommendations": (
                payload.get("comparison") or {}
            ).get("recommendations", []),
            "changes_applied": [],
            "message": (
                "No source code was changed. Review the report and implement "
                "the confirmed changes in the correct application modules."
            ),
        }

        plan_path = self.root / "reports" / "adaptation-plan.json"
        plan_path.parent.mkdir(parents=True, exist_ok=True)
        plan_path.write_text(
            json.dumps(plan, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

        print(f"Adaptation plan: {plan_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Analyze and compare related MedOrbits files for architecture "
            "and API consistency."
        )
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
        default=None,
        help="Reference file whose conventions should be reviewed.",
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=None,
        help="Related file to compare with the reference.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output JSON report path.",
    )
    parser.add_argument(
        "--apply-safe",
        action="store_true",
        help="Write a review-required plan; does not rewrite source code.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.expanduser().resolve()

    try:
        adapter = StructureAdapter(
            root,
            reference=args.reference,
            target=args.target,
        )
        payload = adapter.analyze()

        output = (
            args.output.expanduser().resolve()
            if args.output
            else root / "reports" / "structure-adaptation.json"
        )

        adapter.write_report(output, payload)

        if args.apply_safe:
            adapter.apply_safe(payload)

    except (OSError, ValueError) as exc:
        print(f"Structure adaptation failed: {exc}", file=sys.stderr)
        return 2

    print("MedOrbits Structure Adapter")
    print("=" * 28)
    print(f"Repository: {root}")
    print(f"Files analyzed: {payload['files_discovered']}")
    print(f"Issues: {len(payload['issues'])}")
    print(f"Report: {output}")

    if payload["comparison"]:
        print(f"Comparison: {payload['comparison']['status']}")

    return 1 if any(
        issue["severity"] == "ERROR"
        for issue in payload["issues"]
    ) else 0


if __name__ == "__main__":
    raise SystemExit(main())
