
#!/usr/bin/env python3
"""
MedOrbits Tool Factory
======================

File:
    tools/tool_factory.py

Purpose:
    Create, organize, document, audit, and expand the MedOrbits /tools/
    directory using safe, repeatable repository automation.

Capabilities:
    1. Initialize the tools directory and development guidelines.
    2. Create a machine-readable tool registry.
    3. Generate reusable Python tool templates.
    4. Scaffold new Python tools from a name and description.
    5. Audit existing Python tools without executing them.
    6. Detect missing documentation, duplicate names, syntax problems,
       unsafe-operation indicators, and incomplete tool structure.
    7. Recommend useful new repository tools.
    8. Generate a JSON audit report.
    9. Preserve existing files.
   10. Support dry-run mode and explicit apply mode.

Safety:
    - Dry-run is the default.
    - Existing files are never overwritten.
    - No files are deleted or renamed.
    - Repository Python files are parsed, never imported or executed.
    - Generated code is a scaffold and must be reviewed before use.
    - Symlinks and paths outside the selected repository are rejected.
    - Python standard library only.

Examples:
    python tools/tool_factory.py
    python tools/tool_factory.py --init --apply
    python tools/tool_factory.py --audit
    python tools/tool_factory.py --audit --report
    python tools/tool_factory.py --recommend
    python tools/tool_factory.py --scaffold validate_json --description "Validate repository JSON files"
    python tools/tool_factory.py --scaffold validate_json --description "Validate repository JSON files" --apply
    python tools/tool_factory.py --root . --init --audit --apply
"""

from __future__ import annotations

import argparse
import ast
import json
import keyword
import os
import re
import sys

from datetime import datetime, timezone
from pathlib import Path


VERSION = "1.0.0"

DEFAULT_IGNORED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".pytest_cache",
}

TOOL_CATALOG = [
    {
        "name": "repository_health",
        "purpose": "Check repository structure, required files, and basic consistency.",
        "priority": "high",
        "dependencies": "Python standard library",
    },
    {
        "name": "validate_json",
        "purpose": "Validate JSON and JSON Schema documents.",
        "priority": "high",
        "dependencies": "Python standard library for JSON; schema validation may require an optional package.",
    },
    {
        "name": "validate_html",
        "purpose": "Check HTML structure, metadata, and internal references.",
        "priority": "high",
        "dependencies": "Python standard library",
    },
    {
        "name": "check_internal_links",
        "purpose": "Find broken local links and missing linked pages.",
        "priority": "high",
        "dependencies": "Python standard library",
    },
    {
        "name": "asset_reference_audit",
        "purpose": "Find missing CSS, JavaScript, image, and font references.",
        "priority": "high",
        "dependencies": "Python standard library",
    },
    {
        "name": "security_audit",
        "purpose": "Identify suspicious patterns and configuration risks for manual review.",
        "priority": "high",
        "dependencies": "Python standard library; not a replacement for a security scanner",
    },
    {
        "name": "accessibility_audit",
        "purpose": "Flag common HTML accessibility issues for review.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "seo_audit",
        "purpose": "Check page titles, descriptions, headings, and canonical metadata.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "i18n_audit",
        "purpose": "Check translation key consistency across language files.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "data_catalog_builder",
        "purpose": "Generate a catalog of local JSON data files and their top-level keys.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "duplicate_content_audit",
        "purpose": "Identify duplicate or near-duplicate HTML and text content.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "documentation_builder",
        "purpose": "Build a local Markdown index for tools and project documentation.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "dependency_inventory",
        "purpose": "Inventory declared dependencies and lockfiles without installing packages.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "release_readiness",
        "purpose": "Check release documentation, version metadata, tests, and workflows.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "backup_manifest",
        "purpose": "Create a checksum manifest for selected repository files.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
    {
        "name": "test_inventory",
        "purpose": "List test files and summarize their test functions.",
        "priority": "medium",
        "dependencies": "Python standard library",
    },
]


GUIDE_CONTENT = r'''# MedOrbits Tools Development Guide

## 1. Purpose

The `tools/` directory contains maintainable developer utilities for repository
maintenance, validation, documentation, data quality, accessibility, security
review, testing, and release preparation.

Tools must be predictable, documented, auditable, and safe by default.

## 2. Naming conventions

- Use lowercase `snake_case` for Python tool filenames.
- Prefer action-oriented names such as `validate_json.py`.
- Give each tool one primary responsibility.
- Avoid ambiguous names such as `helper.py`, `misc.py`, or `final_tool.py`.
- Keep shared utilities separate from command-line entry points when practical.

## 3. Required Python tool structure

Every new command-line Python tool should include:

1. A shebang and module docstring.
2. A clear purpose and usage examples.
3. Standard-library imports grouped at the top.
4. A `main()` function.
5. An `argparse.ArgumentParser`.
6. A `if __name__ == "__main__":` entry point.
7. Explicit error handling and meaningful exit codes.
8. A dry-run option for operations that change files.
9. Path validation and protection against path traversal.
10. Tests or documented manual verification steps.

## 4. File modification policy

- Never overwrite existing files unless the user explicitly requests a
  separate, reviewed migration or replacement workflow.
- Prefer writing a new file with exclusive creation (`open(..., "x")`).
- Do not delete or rename files automatically.
- Preview changes before applying them.
- Avoid following symlinks outside the repository.
- Write reports to a dedicated output location.
- Do not place generated reports or caches into source directories unnecessarily.

## 5. Security requirements

- Never execute discovered repository scripts during an audit.
- Do not use `eval`, `exec`, or dynamic imports to run repository content.
- Do not print API keys, passwords, tokens, or environment variables.
- Do not hardcode secrets in generated tools.
- Validate user-supplied paths and filenames.
- Do not disable TLS verification or security checks.
- Treat audit findings as indicators requiring review, not definitive proof.
- Do not automatically run package installation, deployment, migrations,
  network requests, or destructive commands.

## 6. Recommended CLI conventions

Use consistent flags when applicable:

- `--root`: repository root.
- `--apply`: apply changes after preview.
- `--report`: emit a machine-readable JSON report.
- `--output`: explicit report destination.
- `--max-files`: limit work on large repositories.
- `--verbose`: show detailed progress.
- `--strict`: return a nonzero exit code for configured policy violations.

Do not add irrelevant options to simple tools.

## 7. Exit codes

- `0`: successful execution; no configured policy failure.
- `1`: audit findings or validation failures.
- `2`: invalid arguments, invalid configuration, or fatal execution error.

Document any tool that uses a different convention.

## 8. Testing requirements

For each tool, consider:

- A normal successful case.
- Missing files and directories.
- Empty files and malformed input.
- Unicode paths and content.
- Symlink and path traversal handling.
- Permission errors.
- Existing-output collision.
- Dry-run behavior.
- Large input and resource limits where relevant.

Use temporary directories for file-operation tests.

## 9. Suggested development workflow

1. Identify a repetitive or error-prone repository task.
2. Define inputs, outputs, limits, and failure behavior.
3. Check whether an existing tool already performs the task.
4. Create a uniquely named tool with `tool_factory.py`.
5. Review the generated scaffold.
6. Implement the actual business logic.
7. Add tests and update the tool registry.
8. Run syntax and static checks.
9. Preview file modifications.
10. Review the report before committing changes.

## 10. Useful MedOrbits tool categories

- Repository integrity and structure
- HTML, CSS, JavaScript, and asset references
- JSON and schema validation
- College, course, fee, scholarship, and admissions data quality
- SEO and accessibility checks
- Internationalization and translation completeness
- Security configuration and secret-handling review
- Documentation and API inventory
- Test coverage inventory
- Build and release readiness

## 11. Generated content policy

Generated HTML, data records, documentation, and configuration must be reviewed
before publication or deployment.

Never invent admission deadlines, eligibility rules, fees, rankings, cutoffs,
official contact information, accreditation status, or legal requirements.
Use verified sources for factual content and record the source and verification
date where appropriate.

## 12. Completion checklist

- [ ] Clear module docstring and usage examples
- [ ] Correct repository-root handling
- [ ] No accidental overwrite or deletion
- [ ] Dry-run for modifications
- [ ] Safe error handling
- [ ] Tests or verification instructions
- [ ] Tool registry updated
- [ ] Documentation updated
- [ ] Static analysis completed
- [ ] Changes reviewed before release
'''


README_CONTENT = r'''# MedOrbits Repository Tools

This directory contains utilities for repository quality, validation, security
review, documentation, data consistency, and release preparation.

## Tool factory

Run from the repository root:

```bash
python tools/tool_factory.py
python tools/tool_factory.py --init --apply
python tools/tool_factory.py --audit --report
python tools/tool_factory.py --recommend
```

Scaffold a new Python utility:

```bash
python tools/tool_factory.py \
  --scaffold validate_json \
  --description "Validate JSON files in the repository"
```

Preview first, then explicitly create it:

```bash
python tools/tool_factory.py \
  --scaffold validate_json \
  --description "Validate JSON files in the repository" \
  --apply
```

## Safety

The factory does not execute tools that it discovers. It does not overwrite
existing files or delete repository content. Generated tools are starter
scaffolds and require implementation, testing, and review before use.

See `TOOLING_GUIDE.md` for development standards.
'''


TEMPLATE_CONTENT = r'''#!/usr/bin/env python3
"""
{title}
{underline}

Purpose:
    {description}

Safety:
    - Does not execute other repository scripts.
    - Does not overwrite or delete files by default.
    - Review all changes before using this tool in production.

Example:
    python tools/{filename} --root .
"""

from __future__ import annotations

import argparse
import json
import sys

from datetime import datetime, timezone
from pathlib import Path


VERSION = "1.0.0"


def utc_now() -> str:
    """Return the current UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def main() -> int:
    parser = argparse.ArgumentParser(
        description={description_repr}
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Repository root (default: current directory).",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Output a JSON report.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Display additional diagnostic information.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()

    if not root.is_dir():
        print(f"ERROR: repository root does not exist: {{root}}", file=sys.stderr)
        return 2

    # TODO: Implement the tool's documented responsibility here.
    # Keep the default operation read-only.
    result = {{
        "tool": "{tool_name}",
        "version": VERSION,
        "timestamp": utc_now(),
        "repository": str(root),
        "status": "scaffold",
        "message": "Implementation and tests are required.",
    }}

    if args.report:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(result["message"])
        print(f"Repository: {{root}}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_name(value: str) -> str:
    """Normalize a proposed tool name to a safe Python identifier."""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")

    if not value:
        raise ValueError("Tool name must contain letters or numbers.")

    if value[0].isdigit():
        value = "tool_" + value

    if keyword.iskeyword(value):
        value += "_tool"

    if not value.isidentifier():
        raise ValueError("Tool name is not a valid Python identifier.")

    return value


def inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def safe_path(root: Path, candidate: Path) -> Path | None:
    """Reject paths outside root and symlinked path components."""
    root = Path(os.path.abspath(root))
    candidate = Path(os.path.abspath(candidate))

    if not inside(candidate, root):
        return None

    current = root

    try:
        parts = candidate.relative_to(root).parts
    except ValueError:
        return None

    for part in parts:
        current = current / part
        if current.is_symlink():
            return None

    return candidate


def discover_python_tools(tools_dir: Path) -> list[Path]:
    if not tools_dir.is_dir():
        return []

    found = []

    for directory, dirs, filenames in os.walk(tools_dir, followlinks=False):
        current = Path(directory)

        dirs[:] = [
            name for name in dirs
            if name not in DEFAULT_IGNORED_DIRS
            and not (current / name).is_symlink()
        ]

        for filename in filenames:
            path = current / filename

            if path.is_symlink() or path.suffix.lower() != ".py":
                continue

            if filename.startswith("."):
                continue

            found.append(path)

    return sorted(found)


def analyze_python(path: Path, root: Path) -> dict:
    """Statically inspect a Python file without importing or executing it."""
    relative = path.relative_to(root).as_posix()

    result = {
        "file": relative,
        "bytes": 0,
        "syntax_valid": None,
        "has_docstring": False,
        "has_main": False,
        "has_cli_parser": False,
        "has_entry_point": False,
        "findings": [],
    }

    try:
        source = path.read_text(encoding="utf-8-sig", errors="replace")
        result["bytes"] = path.stat().st_size
    except OSError as exc:
        result["findings"].append(f"Cannot read file: {exc}")
        return result

    if not source.strip():
        result["findings"].append("Empty Python file.")
        result["syntax_valid"] = None
        return result

    try:
        tree = ast.parse(source, filename=relative)
        result["syntax_valid"] = True
    except SyntaxError as exc:
        result["syntax_valid"] = False
        result["findings"].append(
            f"Syntax error at line {exc.lineno}: {exc.msg}"
        )
        return result

    result["has_docstring"] = bool(ast.get_docstring(tree))
    if not result["has_docstring"]:
        result["findings"].append("Missing module docstring.")

    names = set()
    imports = set()

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)

        if isinstance(node, ast.Import):
            imports.update(alias.name.split(".")[0] for alias in node.names)

        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])

    result["has_main"] = "main" in names
    if not result["has_main"]:
        result["findings"].append("No main() function found.")

    result["has_cli_parser"] = "argparse" in imports
    if not result["has_cli_parser"]:
        result["findings"].append(
            "No argparse import found; confirm whether CLI arguments are needed."
        )

    result["has_entry_point"] = bool(
        re.search(
            r"""if\s+__name__\s*==\s*["']__main__["']\s*:""",
            source,
        )
    )
    if not result["has_entry_point"]:
        result["findings"].append("Missing standard __main__ entry point.")

    # Heuristic flags only. These patterns are not proof of malicious behavior.
    suspicious_patterns = {
        "Dynamic code execution pattern": r"\b(?:eval|exec)\s*\(",
        "Subprocess execution pattern": r"\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\(",
        "Shell command pattern": r"\bos\.system\s*\(",
        "Potential network access": r"\b(?:requests\.(?:get|post|put|delete)|urlopen)\s*\(",
        "Potential embedded secret": r"""(?i)\b(?:api[_-]?key|secret|password|access[_-]?token)\s*=\s*["'][^"']{8,}["']""",
    }

    for label, pattern in suspicious_patterns.items():
        if re.search(pattern, source):
            result["findings"].append(
                f"{label}: manual review recommended."
            )

    result["standard_library_imports"] = sorted(imports)
    return result


def make_scaffold(name: str, description: str) -> str:
    title = name.replace("_", " ").title()
    underline = "=" * len(title)

    return TEMPLATE_CONTENT.format(
        title=title,
        underline=underline,
        description=description.replace("\n", " ").strip(),
        description_repr=repr(description.strip()),
        filename=name + ".py",
        tool_name=name,
    )


def build_registry(existing_tools: list[Path], root: Path) -> dict:
    entries = []

    for path in existing_tools:
        entries.append({
            "name": path.stem,
            "path": path.relative_to(root).as_posix(),
            "type": "python",
            "managed_by": "manual_or_tool_factory",
        })

    return {
        "registry_version": 1,
        "generated_at": utc_now(),
        "tools": entries,
    }


def recommend_tools() -> list[dict]:
    return TOOL_CATALOG.copy()


def write_new_file(path: Path, content: str, root: Path) -> tuple[str, str]:
    """Create a new file exclusively; never replace existing content."""
    checked = safe_path(root, path)

    if checked is None:
        return "rejected", "Path is outside the repository or contains a symlink."

    if checked.exists():
        return "skipped", "File already exists; existing content preserved."

    try:
        checked.parent.mkdir(parents=True, exist_ok=True)

        # Exclusive creation protects against accidental overwrite and races.
        with checked.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(content)

        return "created", "Created successfully."

    except FileExistsError:
        return "skipped", "File appeared during execution; existing content preserved."
    except OSError as exc:
        return "error", str(exc)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Initialize, audit, and expand the MedOrbits tools directory."
    )

    parser.add_argument(
        "--root",
        default=".",
        help="Repository root (default: current directory).",
    )
    parser.add_argument(
        "--init",
        action="store_true",
        help="Prepare tools/README.md, TOOLING_GUIDE.md, template, and registry.",
    )
    parser.add_argument(
        "--audit",
        action="store_true",
        help="Audit existing Python tools without executing them.",
    )
    parser.add_argument(
        "--recommend",
        action="store_true",
        help="Display a catalog of useful future tools.",
    )
    parser.add_argument(
        "--scaffold",
        metavar="NAME",
        help="Prepare a new Python tool using a safe snake_case name.",
    )
    parser.add_argument(
        "--description",
        default="A MedOrbits repository utility.",
        help="Description for a scaffolded tool.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Create missing files. Without this flag, the tool only previews.",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Output a machine-readable JSON report.",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=5000,
        help="Maximum number of Python tools to audit.",
    )

    args = parser.parse_args()

    if args.max_files < 1:
        parser.error("--max-files must be at least 1")

    root = Path(args.root).resolve()

    if not root.is_dir():
        print(f"ERROR: repository root not found: {root}", file=sys.stderr)
        return 2

    tools_dir = root / "tools"
    checked_tools_dir = safe_path(root, tools_dir)

    if checked_tools_dir is None:
        print("ERROR: tools/ is outside the root or contains a symlink.", file=sys.stderr)
        return 2

    existing_tools = discover_python_tools(tools_dir)[:args.max_files]
    audit_results = []

    if args.audit:
        audit_results = [
            analyze_python(path, root)
            for path in existing_tools
        ]

    planned_files: dict[Path, str] = {}

    if args.init:
        planned_files[tools_dir / "README.md"] = README_CONTENT
        planned_files[tools_dir / "TOOLING_GUIDE.md"] = GUIDE_CONTENT
        planned_files[tools_dir / "templates" / "tool_template.py"] = (
            make_scaffold(
                "example_tool",
                "Example starter utility. Replace this description with the actual task.",
            )
        )

        registry_path = tools_dir / "tool_registry.json"

        # The registry is generated only if it does not already exist.
        registry = build_registry(existing_tools, root)
        planned_files[registry_path] = json.dumps(
            registry,
            indent=2,
            ensure_ascii=False,
        ) + "\n"

    if args.scaffold:
        try:
            name = safe_name(args.scaffold)
        except ValueError as exc:
            parser.error(str(exc))

        description = args.description.strip()
        if not description:
            parser.error("--description must not be empty")

        scaffold_path = tools_dir / f"{name}.py"
        planned_files[scaffold_path] = make_scaffold(name, description)

    actions = []

    for path, content in planned_files.items():
        relative = path.relative_to(root).as_posix()

        if path.exists():
            actions.append({
                "path": relative,
                "status": "skipped",
                "reason": "Existing file preserved.",
            })
            continue

        if not args.apply:
            actions.append({
                "path": relative,
                "status": "would_create",
                "bytes": len(content.encode("utf-8")),
            })
            continue

        status, message = write_new_file(path, content, root)
        actions.append({
            "path": relative,
            "status": status,
            "message": message,
            "bytes": len(content.encode("utf-8")) if status == "created" else 0,
        })

    report = {
        "tool": "MedOrbits Tool Factory",
        "version": VERSION,
        "timestamp": utc_now(),
        "repository": str(root),
        "mode": "apply" if args.apply else "dry-run",
        "existing_python_tools": len(existing_tools),
        "actions": actions,
        "audit": {
            "requested": args.audit,
            "files_analyzed": len(audit_results),
            "files_with_findings": sum(
                bool(item["findings"]) for item in audit_results
            ),
            "results": audit_results,
        },
        "recommendations": recommend_tools() if args.recommend else [],
        "safety": {
            "existing_files_overwritten": False,
            "files_deleted": False,
            "repository_tools_executed": False,
            "static_audit_only": True,
        },
    }

    if args.report:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    print(f"MedOrbits Tool Factory v{VERSION}")
    print(f"Repository: {root}")
    print(f"Python tools discovered: {len(existing_tools)}")
    print(f"Mode: {'APPLY' if args.apply else 'DRY RUN'}")

    if actions:
        print("\nFile actions:")
        for action in actions:
            print(f"  {action['status'].upper():12} {action['path']}")
            if action.get("message"):
                print(f"               {action['message']}")

    if args.audit:
        print("\nStatic audit:")
        print(f"  Files analyzed: {len(audit_results)}")
        flagged = [
            item for item in audit_results
            if item["findings"]
        ]
        print(f"  Files with findings: {len(flagged)}")

        for item in flagged:
            print(f"\n  {item['file']}")
            for finding in item["findings"]:
                print(f"    - {finding}")

    if args.recommend:
        print("\nRecommended tools:")
        for item in recommend_tools():
            print(
                f"  [{item['priority'].upper():6}] "
                f"{item['name']}: {item['purpose']}"
            )

    if not (args.init or args.audit or args.recommend or args.scaffold):
        print("\nNo operation selected. Suggested next steps:")
        print("  python tools/tool_factory.py --init")
        print("  python tools/tool_factory.py --audit")
        print("  python tools/tool_factory.py --recommend")
        print("  python tools/tool_factory.py --scaffold validate_json "
              '--description "Validate repository JSON files"')

    if not args.apply and actions:
        print("\nDRY RUN: no files were created.")
        print("Add --apply to create missing files.")

    print("\nExisting files are never overwritten or deleted.")
    print("Review generated code and test it before production use.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
