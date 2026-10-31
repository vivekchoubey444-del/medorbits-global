
#!/usr/bin/env python3
“””
MedOrbits Tool Factory
======================

File: tools/tool_factory.py
Version: 2.0.0

Purpose:
    Initialize, scaffold, and statically audit MedOrbits repository tools.

Requirements:
    Python 3.10+
    Python standard library only

Examples:
    python tools/tool_factory.py —init
    python tools/tool_factory.py —init —apply
    python tools/tool_factory.py —audit —report
    python tools/tool_factory.py —audit —strict
    python tools/tool_factory.py —recommend
    python tools/tool_factory.py —scaffold validate_json \
        —description “Validate repository JSON files”
    python tools/tool_factory.py —scaffold validate_json —apply

Safety:
    - Dry-run is the default.
    - Existing files are never overwritten or deleted.
    - Python files are parsed, never imported or executed.
    - Symlinked paths are rejected.
    - Files are created exclusively.
    - Uses only the Python standard library.
“””

from __future__ import annotations

import argparse
import ast
import json
import keyword
import os
import re
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

VERSION = “2.0.0”
MAX_AUDIT_FILE_SIZE = 5 * 1024 * 1024

IGNORED_DIRS = {
    “.git”,
    “.venv”,
    “venv”,
    “__pycache__”,
    “node_modules”,
    “dist”,
    “build”,
    “coverage”,
    “.pytest_cache”,
    “.mypy_cache”,
    “.ruff_cache”,
    “.tox”,
    “.next”,
    “.cache”,
    “.turbo”,
    “vendor”,
}

CATALOG = [
    {
        “name”: “repository_health”,
        “priority”: “high”,
        “purpose”: “Check repository structure and consistency.”,
    },
    {
        “name”: “validate_json”,
        “priority”: “high”,
        “purpose”: “Validate JSON files and optional schemas.”,
    },
    {
        “name”: “validate_html”,
        “priority”: “high”,
        “purpose”: “Check HTML structure, metadata, and references.”,
    },
    {
        “name”: “check_internal_links”,
        “priority”: “high”,
        “purpose”: “Find broken local links.”,
    },
    {
        “name”: “asset_reference_audit”,
        “priority”: “high”,
        “purpose”: “Find missing CSS, JavaScript, image, and font assets.”,
    },
    {
        “name”: “security_audit”,
        “priority”: “high”,
        “purpose”: “Flag suspicious patterns for manual review.”,
    },
    {
        “name”: “accessibility_audit”,
        “priority”: “medium”,
        “purpose”: “Flag common accessibility issues.”,
    },
    {
        “name”: “seo_audit”,
        “priority”: “medium”,
        “purpose”: “Check titles, descriptions, headings, and canonical metadata.”,
    },
    {
        “name”: “i18n_audit”,
        “priority”: “medium”,
        “purpose”: “Check translation-key consistency.”,
    },
    {
        “name”: “data_catalog_builder”,
        “priority”: “medium”,
        “purpose”: “Catalog JSON files and their top-level keys.”,
    },
    {
        “name”: “documentation_builder”,
        “priority”: “medium”,
        “purpose”: “Build a local documentation index.”,
    },
    {
        “name”: “dependency_inventory”,
        “priority”: “medium”,
        “purpose”: “Inventory dependencies without installing packages.”,
    },
    {
        “name”: “release_readiness”,
        “priority”: “medium”,
        “purpose”: “Check release documentation, tests, and workflows.”,
    },
    {
        “name”: “backup_manifest”,
        “priority”: “medium”,
        “purpose”: “Create checksums for selected repository files.”,
    },
    {
        “name”: “test_inventory”,
        “priority”: “medium”,
        “purpose”: “List tests and summarize test functions.”,
    },
]

README = “””# MedOrbits Repository Tools

## Tool Factory

```bash
python tools/tool_factory.py —init
python tools/tool_factory.py —init —apply
python tools/tool_factory.py —audit —report
python tools/tool_factory.py —audit —strict
python tools/tool_factory.py —recommend
python tools/tool_factory.py —scaffold validate_json —description “Validate JSON files”
```

Dry-run is the default.

Existing files are never overwritten or deleted.

Generated tools are scaffolds. They must be implemented, tested,
and reviewed before production use.

See `TOOLING_GUIDE.md`.
“””

GUIDE = “””# MedOrbits Tools Development Guide

## Architecture

- Use lowercase `snake_case` filenames.
- Give each tool one primary responsibility.
- Keep reusable logic separate from CLI entry points.
- Document inputs, outputs, dependencies, and exit codes.

## Safety

- Default to read-only or dry-run behavior.
- Never overwrite or delete repository files automatically.
- Validate paths and reject symlinks when writing files.
- Never execute discovered repository scripts during static audits.
- Do not print secrets.
- Do not install packages or deploy automatically.
- Treat heuristic security findings as indicators for manual review.

## Quality

- Use `argparse` for command-line interfaces.
- Expose a `main()` function.
- Return meaningful exit codes.
- Test malformed input, missing files, Unicode paths, permissions,
  output collisions, and dry-run behavior.
- Test on supported Python and Node.js versions.

## MedOrbits Content

Verify admissions deadlines, fees, eligibility, cutoffs, rankings,
and legal facts before publication.
“””

TEMPLATE = ‘’’#!/usr/bin/env python3
“””
{title}

MedOrbits repository utility.

This file is a scaffold. Implement and test before production use.
“””

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

VERSION = “1.0.0”
TOOL_NAME = {name_literal}
DESCRIPTION = {description_literal}


def main() -> int:
    “””Application entry point.”””

    parser = argparse.ArgumentParser(
        description=DESCRIPTION,
    )

    parser.add_argument(
        “—root”,
        default=“.”,
        help=“Repository root.”,
    )

    parser.add_argument(
        “—report”,
        action=“store_true”,
        help=“Print a JSON report.”,
    )

    args = parser.parse_args()

    root = Path(args.root).expanduser()

    try:
        root = root.resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        print(
            f”ERROR: Cannot resolve repository root: {{exc}}”,
            file=sys.stderr,
        )
        return 2

    if not root.is_dir():
        print(
            “ERROR: Repository root is not a directory.”,
            file=sys.stderr,
        )
        return 2

    result = {{
        “tool”: TOOL_NAME,
        “version”: VERSION,
        “timestamp”: datetime.now(timezone.utc).isoformat(),
        “repository”: str(root),
        “status”: “scaffold”,
        “implemented”: False,
        “message”: “Implementation and tests are required.”,
    }}

    if args.report:
        print(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False,
            )
        )
    else:
        print(result[“message”])
        print(“Repository: “ + str(root))

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())
‘’’


def utc_now() -> str:
    “””Return an ISO-8601 UTC timestamp.”””
    return datetime.now(timezone.utc).isoformat()


def safe_name(value: str) -> str:
    “””Convert a requested name into a valid Python identifier.”””

    value = re.sub(
        r”_+”,
        “_”,
        re.sub(
            r”[^a-z0-9_]+”,
            “_”,
            value.strip().lower(),
        ),
    ).strip(“_”)

    if not value:
        raise ValueError(
            “Tool name must contain letters or numbers.”
        )

    if value[0].isdigit():
        value = “tool_” + value

    if keyword.iskeyword(value):
        value += “_tool”

    if not value.isidentifier():
        raise ValueError(
            “Tool name is not a valid Python identifier.”
        )

    return value


def is_within(path: Path, root: Path) -> bool:
    “””Check whether a path is inside a root directory.”””

    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def safe_components(path: Path, root: Path) -> bool:
    “””
    Reject paths outside the repository and existing symlink components.

    Both arguments must be absolute paths.
    “””

    root = Path(os.path.abspath(root))
    path = Path(os.path.abspath(path))

    if not is_within(path, root):
        return False

    if root.is_symlink():
        return False

    current = root

    for component in path.relative_to(root).parts:
        current = current / component

        if current.is_symlink():
            return False

    return True


def discover_tools(
    tools_dir: Path,
    root: Path,
    limit: int,
) -> tuple[list[Path], bool]:
    “””Discover Python files without following symlinks.”””

    found: list[Path] = []

    if not tools_dir.is_dir() or tools_dir.is_symlink():
        return found, False

    for directory, dirs, filenames in os.walk(
        tools_dir,
        followlinks=False,
        onerror=lambda error: print(
            f”WARNING: Cannot scan {error.filename}: {error}”,
            file=sys.stderr,
        ),
    ):
        current = Path(directory)

        dirs[:] = sorted(
            name
            for name in dirs
            if name not in IGNORED_DIRS
            and not (current / name).is_symlink()
        )

        for filename in sorted(filenames):
            path = current / filename

            if (
                path.suffix.lower() != “.py”
                or filename.startswith(“.”)
                or path.is_symlink()
                or not safe_components(path, root)
            ):
                continue

            found.append(path)

            if len(found) > limit:
                return sorted(found[:limit]), True

    return sorted(found), False


def audit_file(path: Path, root: Path) -> dict:
    “””Statically inspect a Python file without importing or executing it.”””

    result = {
        “file”: path.relative_to(root).as_posix(),
        “bytes”: 0,
        “syntax_valid”: None,
        “has_docstring”: False,
        “has_main”: False,
        “has_cli_parser”: False,
        “has_entry_point”: False,
        “imports”: [],
        “findings”: [],
    }

    try:
        stat_result = path.lstat()

        if path.is_symlink() or not path.is_file():
            result[“findings”].append(
                “Not a regular non-symlink file.”
            )
            return result

        result[“bytes”] = stat_result.st_size

        if stat_result.st_size > MAX_AUDIT_FILE_SIZE:
            result[“findings”].append(
                f”File exceeds {MAX_AUDIT_FILE_SIZE // 1024 // 1024} MB audit limit.”
            )
            return result

        source = path.read_text(encoding=“utf-8-sig”)

    except (OSError, UnicodeError) as exc:
        result[“findings”].append(
            f”Cannot read file: {exc}”
        )
        return result

    if not source.strip():
        result[“findings”].append(“Empty Python file.”)
        return result

    try:
        tree = ast.parse(
            source,
            filename=result[“file”],
        )
        result[“syntax_valid”] = True

    except SyntaxError as exc:
        result[“syntax_valid”] = False

        result[“findings”].append(
            f”Syntax error at line {exc.lineno}: {exc.msg}”
        )
        return result

    result[“has_docstring”] = bool(
        ast.get_docstring(tree)
    )

    if not result[“has_docstring”]:
        result[“findings”].append(
            “Missing module docstring.”
        )

    names = {
        node.name
        for node in ast.walk(tree)
        if isinstance(
            node,
            (
                ast.FunctionDef,
                ast.AsyncFunctionDef,
                ast.ClassDef,
            ),
        )
    }

    result[“has_main”] = “main” in names

    if not result[“has_main”]:
        result[“findings”].append(
            “No main() function found.”
        )

    imports = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(
                alias.name.split(“.”)[0]
                for alias in node.names
            )

        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(“.”)[0])

    result[“imports”] = sorted(imports)
    result[“has_cli_parser”] = “argparse” in imports

    if not result[“has_cli_parser”]:
        result[“findings”].append(
            “No argparse import found; review whether CLI arguments are required.”
        )

    result[“has_entry_point”] = bool(
        re.search(
            r”””if\s+__name__\s*==\s*[“’]__main__[“’]\s*:”””,
            source,
        )
    )

    if not result[“has_entry_point”]:
        result[“findings”].append(
            “Missing standard __main__ entry point.”
        )

    suspicious_patterns = {
        “Dynamic code execution pattern”:
            r”\b(?:eval|exec)\s*\(“,

        “Subprocess execution pattern”:
            r”\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\(“,

        “Shell command pattern”:
            r”\bos\.system\s*\(“,

        “Potential network access”:
            r”\b(?:requests\.(?:get|post|put|delete)|urlopen)\s*\(“,

        “Potential embedded secret”:
            r”””(?i)\b(?:api[_-]?key|secret|password|access[_-]?token)\s*=\s*[“’][^”’]{8,}[“’]”””,
    }

    for label, pattern in suspicious_patterns.items():
        if re.search(pattern, source):
            result[“findings”].append(
                label + “: manual review recommended.”
            )

    return result


def make_scaffold(name: str, description: str) -> str:
    “””
    Generate a safe Python scaffold.

    repr() protects user-provided descriptions and names from breaking
    Python string literals or injecting template syntax.
    “””

    title = name.replace(“_”, “ “).title()

    return TEMPLATE.format(
        title=title,
        name_literal=repr(name),
        description_literal=repr(description.strip()),
    )


def create_exclusive(
    path: Path,
    content: str,
    root: Path,
    executable: bool = False,
) -> tuple[str, str]:
    “””Create a file exclusively without overwriting existing content.”””

    if not safe_components(path, root):
        return (
            “rejected”,
            “Path is outside the repository or contains a symlink.”,
        )

    try:
        path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        # Check again after parent creation.
        if not safe_components(path, root):
            return (
                “rejected”,
                “Path became unsafe during creation.”,
            )

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL

        if hasattr(os, “O_NOFOLLOW”):
            flags |= os.O_NOFOLLOW

        mode = 0o755 if executable else 0o644

        descriptor = os.open(
            path,
            flags,
            mode,
        )

        with os.fdopen(
            descriptor,
            “w”,
            encoding=“utf-8”,
            newline=“\n”,
        ) as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())

        if executable:
            path.chmod(mode)

        return “created”, “Created successfully.”

    except FileExistsError:
        return “skipped”, “Existing file preserved.”

    except OSError as exc:
        return “error”, str(exc)


def build_registry(
    existing: list[Path],
    root: Path,
    planned_names: set[str],
) -> dict:
    “””Build a registry that distinguishes existing and planned tools.”””

    entries = []
    seen_paths = set()

    for path in existing:
        relative = path.relative_to(root).as_posix()

        entries.append({
            “name”: path.stem,
            “path”: relative,
            “type”: “python”,
            “status”: “existing”,
            “managed_by”: “manual_or_tool_factory”,
        })

        seen_paths.add(relative)

    for name in sorted(planned_names):
        relative = f”tools/{name}.py”

        if relative in seen_paths:
            continue

        entries.append({
            “name”: name,
            “path”: relative,
            “type”: “python”,
            “status”: “planned”,
            “managed_by”: “tool_factory_scaffold”,
        })

    entries.sort(
        key=lambda item: (
            item[“name”],
            item[“path”],
        )
    )

    return {
        “registry_version”: 2,
        “generated_at”: utc_now(),
        “repository”: “MedOrbits”,
        “tools”: entries,
        “note”: (
            “Planned entries are not confirmed to exist until “
            “the corresponding scaffold has been created.”
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            “Initialize, scaffold, and statically audit “
            “MedOrbits repository tools.”
        )
    )

    parser.add_argument(
        “—root”,
        default=“.”,
        help=“Repository root.”,
    )

    parser.add_argument(
        “—init”,
        action=“store_true”,
        help=“Prepare README, guide, template, and registry.”,
    )

    parser.add_argument(
        “—audit”,
        action=“store_true”,
        help=“Audit Python tools without executing them.”,
    )

    parser.add_argument(
        “—recommend”,
        action=“store_true”,
        help=“Display recommended future tools.”,
    )

    parser.add_argument(
        “—scaffold”,
        metavar=“NAME”,
        help=“Generate a Python tool scaffold.”,
    )

    parser.add_argument(
        “—description”,
        default=“A MedOrbits repository utility.”,
        help=“Description for the generated scaffold.”,
    )

    parser.add_argument(
        “—apply”,
        action=“store_true”,
        help=“Create missing files. Default is dry-run.”,
    )

    parser.add_argument(
        “—report”,
        action=“store_true”,
        help=“Output a machine-readable JSON report.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Return failure when audit findings or truncation occur.”,
    )

    parser.add_argument(
        “—max-files”,
        type=int,
        default=5000,
        help=“Maximum Python files to inspect.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Tool Factory {VERSION}”,
    )

    args = parser.parse_args()

    if args.max_files < 1:
        parser.error(“—max-files must be at least 1”)

    if args.description is not None and not args.description.strip():
        parser.error(“—description must not be empty”)

    try:
        supplied_root = Path(
            os.path.abspath(
                os.path.expanduser(args.root)
            )
        )

        if supplied_root.is_symlink():
            print(
                “ERROR: Repository root cannot be a symlink.”,
                file=sys.stderr,
            )
            return 2

        root = supplied_root.resolve(strict=True)

        if not root.is_dir():
            print(
                “ERROR: Repository root is not a directory.”,
                file=sys.stderr,
            )
            return 2

    except (OSError, RuntimeError, ValueError) as exc:
        print(
            f”ERROR: Invalid repository root: {exc}”,
            file=sys.stderr,
        )
        return 2

    tools_dir = root / “tools”

    if tools_dir.exists() and (
        tools_dir.is_symlink() or not tools_dir.is_dir()
    ):
        print(
            “ERROR: tools path is not a safe directory.”,
            file=sys.stderr,
        )
        return 2

    if not safe_components(tools_dir, root):
        print(
            “ERROR: tools path is outside root or contains a symlink.”,
            file=sys.stderr,
        )
        return 2

    existing, truncated = discover_tools(
        tools_dir,
        root,
        args.max_files,
    )

    audits = [
        audit_file(path, root)
        for path in existing
    ] if args.audit else []

    planned: dict[Path, tuple[str, bool]] = {}
    planned_names: set[str] = set()

    if args.init:
        planned[tools_dir / “README.md”] = (
            README,
            False,
        )

        planned[tools_dir / “TOOLING_GUIDE.md”] = (
            GUIDE,
            False,
        )

        planned[
            tools_dir / “templates” / “tool_template.py”
        ] = (
            make_scaffold(
                “example_tool”,
                “Example starter utility. Replace this description with the actual task.”,
            ),
            True,
        )

        planned_names.add(“example_tool”)

    if args.scaffold:
        try:
            name = safe_name(args.scaffold)
        except ValueError as exc:
            parser.error(str(exc))

        planned[
            tools_dir / f”{name}.py”
        ] = (
            make_scaffold(
                name,
                args.description,
            ),
            True,
        )

        planned_names.add(name)

    if args.init:
        planned[
            tools_dir / “tool_registry.json”
        ] = (
            json.dumps(
                build_registry(
                    existing,
                    root,
                    planned_names,
                ),
                indent=2,
                ensure_ascii=False,
            ) + “\n”,
            False,
        )

    actions = []

    for path, (body, executable) in planned.items():
        relative = path.relative_to(root).as_posix()

        if path.exists() or path.is_symlink():
            actions.append({
                “path”: relative,
                “status”: “skipped”,
                “reason”: “Existing filesystem entry preserved.”,
            })

        elif not args.apply:
            actions.append({
                “path”: relative,
                “status”: “would_create”,
                “bytes”: len(body.encode(“utf-8”)),
            })

        else:
            status, message = create_exclusive(
                path,
                body,
                root,
                executable,
            )

            actions.append({
                “path”: relative,
                “status”: status,
                “message”: message,
                “bytes”: (
                    len(body.encode(“utf-8”))
                    if status == “created”
                    else 0
                ),
            })

    flagged = [
        item
        for item in audits
        if item[“findings”]
    ]

    syntax_errors = sum(
        item[“syntax_valid”] is False
        for item in audits
    )

    action_errors = any(
        item[“status”] in {“error”, “rejected”}
        for item in actions
    )

    report = {
        “tool”: “MedOrbits Tool Factory”,
        “version”: VERSION,
        “timestamp”: utc_now(),
        “repository”: str(root),
        “mode”: “apply” if args.apply else “dry-run”,
        “existing_python_tools”: len(existing),
        “audit_truncated”: truncated,
        “actions”: actions,
        “audit”: {
            “requested”: args.audit,
            “files_analyzed”: len(audits),
            “files_with_findings”: len(flagged),
            “syntax_errors”: syntax_errors,
            “results”: audits,
        },
        “recommendations”: (
            CATALOG if args.recommend else []
        ),
        “safety”: {
            “existing_files_overwritten”: False,
            “files_deleted”: False,
            “repository_tools_executed”: False,
            “static_audit_only”: True,
        },
    }

    if args.report:
        print(
            json.dumps(
                report,
                indent=2,
                ensure_ascii=False,
            )
        )

    else:
        print(f”MedOrbits Tool Factory v{VERSION}”)
        print(f”Repository: {root}”)
        print(f”Mode: {‘APPLY’ if args.apply else ‘DRY RUN’}”)
        print(
            f”Python tools discovered: {len(existing)}”
            + (
                “ (discovery limit reached)”
                if truncated
                else “”
            )
        )

        if actions:
            print(“\nFile actions:”)

            for action in actions:
                print(
                    f”  {action[‘status’].upper():12} “
                    f”{action[‘path’]}”
                )

                if action.get(“reason”):
                    print(
                        “               “ + action[“reason”]
                    )

                if action.get(“message”):
                    print(
                        “               “ + action[“message”]
                    )

        if args.audit:
            print(
                f”\nStatic audit: {len(audits)} files; “
                f”{len(flagged)} with findings; “
                f”{syntax_errors} syntax errors.”
            )

            for item in flagged:
                print(f”\n  {item[‘file’]}”)

                for finding in item[“findings”]:
                    print(“    - “ + finding)

        if args.recommend:
            print(“\nRecommended tools:”)

            for item in CATALOG:
                print(
                    f”  [{item[‘priority’].upper():6}] “
                    f”{item[‘name’]}: {item[‘purpose’]}”
                )

        if not (
            args.init
            or args.audit
            or args.recommend
            or args.scaffold
        ):
            print(
                “\nNo operation selected. Use —init, —audit, “
                “—recommend, or —scaffold NAME.”
            )

        if not args.apply and actions:
            print(
                “\nDRY RUN: no files were created. “
                “Add —apply to create missing files.”
            )

        print(
            “\nExisting files are never overwritten or deleted.”
        )

    if action_errors:
        return 2

    if args.strict and (flagged or truncated):
        return 1

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())
