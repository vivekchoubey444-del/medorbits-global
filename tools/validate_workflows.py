
#!/usr/bin/env python3
“””
MedOrbits GitHub Actions Workflow Validator
===========================================

File: tools/validate_workflows.py
Version: 2.0.0

Purpose:
    Validate YAML syntax and basic GitHub Actions workflow structure.

Requirements:
    Python 3.10+
    PyYAML

Install:
    python -m pip install PyYAML

Run:
    python tools/validate_workflows.py
    python tools/validate_workflows.py —strict
    python tools/validate_workflows.py .github/workflows/ci.yml

Exit codes:
    0 = Validation passed
    1 = Workflow validation failed
    2 = Validator configuration or dependency error

Safety:
    Read-only. Does not install dependencies or modify workflow files.
“””

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
    from yaml.constructor import ConstructorError
    from yaml.nodes import MappingNode
    from yaml.resolver import BaseResolver
except ImportError:
    print(
        “ERROR: PyYAML is not installed.\n”
        “Install it with: python -m pip install PyYAML”,
        file=sys.stderr,
    )
    raise SystemExit(2)


VERSION = “2.0.0”
MAX_FILE_SIZE = 5 * 1024 * 1024

SCRIPT_PATH = Path(__file__).resolve()
ROOT = SCRIPT_PATH.parent.parent
WORKFLOWS_DIR = ROOT / “.github” / “workflows”

IGNORED_DIRS = {
    “.git”,
    “node_modules”,
    “.venv”,
    “venv”,
    “vendor”,
    “__pycache__”,
    “dist”,
    “build”,
    “coverage”,
    “.next”,
    “.cache”,
}

WORKFLOW_SUFFIXES = {“.yml”, “.yaml”}

ERRORS: list[str] = []
WARNINGS: list[str] = []


class UniqueKeySafeLoader(yaml.SafeLoader):
    “””Safe YAML loader with YAML 1.2-style boolean handling.”””


# PyYAML defaults to YAML 1.1, where on/off/yes/no become booleans.
# GitHub Actions requires “on” to remain a string.
UniqueKeySafeLoader.yaml_implicit_resolvers = {
    key: [
        (tag, regex)
        for tag, regex in resolvers
        if tag != “tag:yaml.org,2002:bool”
    ]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}

UniqueKeySafeLoader.add_implicit_resolver(
    “tag:yaml.org,2002:bool”,
    re.compile(r”^(?:true|false)$”, re.IGNORECASE),
    list(“tTfF”),
)


def construct_unique_mapping(
    loader: UniqueKeySafeLoader,
    node: MappingNode,
    deep: bool = False,
) -> dict[Any, Any]:
    “””Reject duplicate explicit keys while allowing YAML merge overrides.”””

    if not isinstance(node, MappingNode):
        raise ConstructorError(
            None,
            None,
            “Expected a YAML mapping node”,
            node.start_mark,
        )

    explicit_keys: set[Any] = set()

    # Check original explicit keys before expanding YAML merge mappings.
    for key_node, _value_node in node.value:
        if key_node.tag == “tag:yaml.org,2002:merge”:
            continue

        key = loader.construct_object(key_node, deep=deep)

        try:
            if key in explicit_keys:
                raise ConstructorError(
                    “while constructing a mapping”,
                    node.start_mark,
                    f”duplicate key {key!r}”,
                    key_node.start_mark,
                )

            explicit_keys.add(key)

        except TypeError as exc:
            raise ConstructorError(
                “while constructing a mapping”,
                node.start_mark,
                “unhashable mapping key”,
                key_node.start_mark,
            ) from exc

    loader.flatten_mapping(node)

    try:
        return yaml.SafeLoader.construct_mapping(
            loader,
            node,
            deep=deep,
        )
    except TypeError as exc:
        raise ConstructorError(
            “while constructing a mapping”,
            node.start_mark,
            “unhashable mapping key”,
            node.start_mark,
        ) from exc


UniqueKeySafeLoader.add_constructor(
    BaseResolver.DEFAULT_MAPPING_TAG,
    construct_unique_mapping,
)


def display_path(path: Path) -> str:
    “””Return a repository-relative path.”””
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def add_error(path: Path, message: str) -> None:
    ERRORS.append(f”{display_path(path)}: {message}”)


def add_warning(path: Path, message: str) -> None:
    WARNINGS.append(f”{display_path(path)}: {message}”)


def is_inside_root(path: Path) -> bool:
    “””Check whether a resolved path stays inside the repository.”””
    try:
        path.relative_to(ROOT)
        return True
    except ValueError:
        return False


def discover_workflows(directory: Path) -> list[Path]:
    “””Find YAML workflows without following symbolic links.”””

    if not directory.is_dir():
        raise FileNotFoundError(
            f”Workflow directory does not exist: {directory}”
        )

    results: list[Path] = []
    pending = [directory]

    while pending:
        current = pending.pop()

        try:
            entries = sorted(
                os.scandir(current),
                key=lambda entry: entry.name.lower(),
            )
        except OSError as exc:
            add_error(current, f”cannot read directory: {exc}”)
            continue

        for entry in entries:
            entry_path = Path(entry.path)

            if entry.is_symlink():
                continue

            if entry.is_dir(follow_symlinks=False):
                if entry.name not in IGNORED_DIRS:
                    pending.append(entry_path)
                continue

            if (
                entry.is_file(follow_symlinks=False)
                and entry_path.suffix.lower() in WORKFLOW_SUFFIXES
            ):
                results.append(entry_path)

    return sorted(results)


def load_yaml(path: Path) -> Any:
    “””Load exactly one YAML document using a safe loader.”””

    stat = path.lstat()

    if path.is_symlink() or not path.is_file():
        raise ValueError(“Workflow must be a regular, non-symlink file”)

    if stat.st_size > MAX_FILE_SIZE:
        raise ValueError(
            f”File exceeds the {MAX_FILE_SIZE // 1024 // 1024} MB size limit”
        )

    with path.open(“r”, encoding=“utf-8-sig”) as file:
        documents = list(
            yaml.load_all(file, Loader=UniqueKeySafeLoader)
        )

    if len(documents) != 1:
        raise ValueError(
            f”Expected exactly one YAML document, found {len(documents)}”
        )

    return documents[0]


def validate_non_empty_string(
    path: Path,
    value: Any,
    label: str,
) -> None:
    if not isinstance(value, str) or not value.strip():
        add_error(path, f”{label} must be a non-empty string”)


def validate_permissions(
    path: Path,
    value: Any,
    label: str,
) -> None:
    “””Validate workflow or job permissions.”””

    if isinstance(value, str):
        if value not in {“read-all”, “write-all”}:
            add_error(
                path,
                f”{label} must be ‘read-all’, ‘write-all’, or a mapping”,
            )
        elif value == “write-all”:
            add_warning(
                path,
                f”{label} grants broad write permissions; review necessity”,
            )
        return

    if not isinstance(value, dict):
        add_error(path, f”{label} must be a mapping or supported string”)
        return

    allowed = {
        “actions”,
        “attestations”,
        “checks”,
        “contents”,
        “deployments”,
        “discussions”,
        “id-token”,
        “issues”,
        “packages”,
        “pages”,
        “pull-requests”,
        “repository-projects”,
        “security-events”,
        “statuses”,
    }

    for permission, access in value.items():
        if permission not in allowed:
            add_error(
                path,
                f”{label} contains unknown permission: {permission}”,
            )
            continue

        if access not in {“read”, “write”, “none”}:
            add_error(
                path,
                f”{label}.{permission} must be read, write, or none”,
            )


def validate_concurrency(
    path: Path,
    value: Any,
    label: str,
) -> None:
    if isinstance(value, str):
        if not value.strip():
            add_error(path, f”{label} must not be empty”)
        return

    if not isinstance(value, dict):
        add_error(path, f”{label} must be a string or mapping”)
        return

    if “group” not in value:
        add_error(path, f”{label} requires a group”)

    else:
        validate_non_empty_string(
            path,
            value[“group”],
            f”{label}.group”,
        )

    if “cancel-in-progress” in value and not isinstance(
        value[“cancel-in-progress”],
        (bool, str),
    ):
        add_error(
            path,
            f”{label}.cancel-in-progress must be a boolean or expression”,
        )


def validate_needs(
    path: Path,
    job_id: str,
    job: dict[Any, Any],
    job_ids: set[str],
) -> None:
    needs = job.get(“needs”)

    if needs is None:
        return

    if isinstance(needs, str):
        dependencies = [needs]
    elif isinstance(needs, list):
        dependencies = needs
    else:
        add_error(
            path,
            f”job ‘{job_id}’ needs must be a string or list”,
        )
        return

    if not dependencies:
        add_error(
            path,
            f”job ‘{job_id}’ needs list must not be empty”,
        )
        return

    for dependency in dependencies:
        if not isinstance(dependency, str) or not dependency.strip():
            add_error(
                path,
                f”job ‘{job_id}’ has an invalid dependency identifier”,
            )
        elif dependency not in job_ids:
            add_error(
                path,
                f”job ‘{job_id}’ references unknown dependency ‘{dependency}’”,
            )


def validate_local_action(
    path: Path,
    uses: str,
    prefix: str,
) -> None:
    “””Check repository-local action references.”””

    if not uses.startswith(“./“):
        return

    candidate = ROOT / uses[2:]

    try:
        resolved = candidate.resolve(strict=True)
    except (OSError, RuntimeError):
        add_error(
            path,
            f”{prefix} local action does not exist: {uses}”,
        )
        return

    if not is_inside_root(resolved):
        add_error(
            path,
            f”{prefix} local action escapes repository root: {uses}”,
        )
        return

    if not resolved.is_dir():
        add_error(
            path,
            f”{prefix} local action must reference a directory: {uses}”,
        )
        return

    action_files = (
        resolved / “action.yml”,
        resolved / “action.yaml”,
        resolved / “Dockerfile”,
    )

    if not any(item.is_file() for item in action_files):
        add_error(
            path,
            f”{prefix} local action directory has no action.yml, “
            f”action.yaml, or Dockerfile: {uses}”,
        )


def validate_step(
    path: Path,
    job_id: str,
    index: int,
    step: Any,
) -> None:
    prefix = f”job ‘{job_id}’, step {index}”

    if not isinstance(step, dict):
        add_error(path, f”{prefix} must be a mapping”)
        return

    has_uses = “uses” in step
    has_run = “run” in step

    if has_uses == has_run:
        add_error(
            path,
            f”{prefix} must specify exactly one of ‘uses’ or ‘run’”,
        )
        return

    if has_uses:
        uses = step[“uses”]
        validate_non_empty_string(path, uses, f”{prefix} uses”)

        if isinstance(uses, str) and uses.strip():
            validate_local_action(path, uses, prefix)

            if not uses.startswith(“./“) and “@“ not in uses:
                add_warning(
                    path,
                    f”{prefix} action reference has no explicit version: {uses}”,
                )

    if has_run:
        validate_non_empty_string(path, step[“run”], f”{prefix} run”)

    if “name” in step and not isinstance(step[“name”], str):
        add_error(path, f”{prefix} name must be a string”)

    for field in (“env”, “with”):
        if field in step and not isinstance(step[field], dict):
            add_error(path, f”{prefix} {field} must be a mapping”)

    if “timeout-minutes” in step:
        timeout = step[“timeout-minutes”]

        if (
            isinstance(timeout, bool)
            or not isinstance(timeout, (int, float))
            or timeout <= 0
        ):
            add_error(
                path,
                f”{prefix} timeout-minutes must be a positive number”,
            )


def validate_job(
    path: Path,
    job_id: Any,
    job: Any,
    job_ids: set[str],
) -> None:
    prefix = f”job ‘{job_id}’”

    if not isinstance(job_id, str) or not job_id.strip():
        add_error(path, “job identifiers must be non-empty strings”)
        return

    if not isinstance(job, dict):
        add_error(path, f”{prefix} must be a mapping”)
        return

    validate_needs(path, job_id, job, job_ids)

    if “permissions” in job:
        validate_permissions(
            path,
            job[“permissions”],
            f”{prefix} permissions”,
        )

    if “concurrency” in job:
        validate_concurrency(
            path,
            job[“concurrency”],
            f”{prefix} concurrency”,
        )

    if “uses” in job:
        uses = job[“uses”]

        validate_non_empty_string(
            path,
            uses,
            f”{prefix} reusable workflow uses”,
        )

        if isinstance(uses, str):
            if not uses.startswith(“./“) and “@“ not in uses:
                add_error(
                    path,
                    f”{prefix} reusable workflow must include a ref after @“,
                )

            if uses.startswith(“./“):
                validate_local_action(
                    path,
                    uses,
                    prefix,
                )

        for forbidden in (“steps”, “runs-on”, “environment”, “container”, “services”):
            if forbidden in job:
                add_error(
                    path,
                    f”{prefix} reusable workflow cannot define ‘{forbidden}’”,
                )

        if “with” in job and not isinstance(job[“with”], dict):
            add_error(path, f”{prefix} with must be a mapping”)

        if “secrets” in job and not (
            isinstance(job[“secrets”], dict)
            or job[“secrets”] == “inherit”
        ):
            add_error(
                path,
                f”{prefix} secrets must be a mapping or ‘inherit’”,
            )

        return

    runs_on = job.get(“runs-on”)

    valid_runs_on = (
        isinstance(runs_on, str) and bool(runs_on.strip())
    ) or (
        isinstance(runs_on, list)
        and bool(runs_on)
        and all(
            isinstance(item, str) and item.strip()
            for item in runs_on
        )
    )

    if not valid_runs_on:
        add_error(
            path,
            f”{prefix} is missing a valid runs-on value”,
        )

    steps = job.get(“steps”)

    if not isinstance(steps, list):
        add_error(path, f”{prefix} steps must be a list”)
        return

    if not steps:
        add_warning(path, f”{prefix} has an empty steps list”)

    for index, step in enumerate(steps, start=1):
        validate_step(path, job_id, index, step)


def validate_workflow(
    path: Path,
    strict: bool = False,
) -> None:
    print(f”[CHECK] {display_path(path)}”)

    try:
        data = load_yaml(path)
    except (OSError, UnicodeError, yaml.YAMLError, ValueError) as exc:
        add_error(path, f”invalid YAML or file structure: {exc}”)
        return

    if not isinstance(data, dict):
        add_error(path, “workflow must be a YAML mapping”)
        return

    if “name” in data:
        validate_non_empty_string(
            path,
            data[“name”],
            “workflow name”,
        )
    else:
        add_warning(path, “workflow has no name”)

    if “on” not in data:
        add_error(path, “missing ‘on’ trigger configuration”)
    else:
        triggers = data[“on”]

        if isinstance(triggers, str):
            if not triggers.strip():
                add_error(path, “’on’ trigger must not be empty”)

        elif isinstance(triggers, list):
            if not triggers:
                add_error(path, “’on’ trigger list must not be empty”)
            elif not all(
                isinstance(item, str) and item.strip()
                for item in triggers
            ):
                add_error(
                    path,
                    “’on’ trigger list must contain non-empty strings”,
                )

        elif isinstance(triggers, dict):
            if not triggers:
                add_error(path, “’on’ trigger mapping must not be empty”)

        else:
            add_error(
                path,
                “’on’ must be a string, list, or mapping”,
            )

    jobs = data.get(“jobs”)

    if not isinstance(jobs, dict) or not jobs:
        add_error(path, “missing or empty jobs mapping”)
        return

    job_ids = {
        job_id
        for job_id in jobs
        if isinstance(job_id, str)
    }

    for job_id, job in jobs.items():
        validate_job(path, job_id, job, job_ids)

    if “permissions” in data:
        validate_permissions(
            path,
            data[“permissions”],
            “workflow permissions”,
        )

    if “concurrency” in data:
        validate_concurrency(
            path,
            data[“concurrency”],
            “workflow concurrency”,
        )

    if strict:
        # Strict mode turns security-related warnings into failures.
        for warning in list(WARNINGS):
            if warning.startswith(f”{display_path(path)}:”):
                if (
                    “write permissions” in warning
                    or “no explicit version” in warning
                ):
                    ERRORS.append(
                        warning.replace(“: “, “: strict mode: “, 1)
                    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=“Validate MedOrbits GitHub Actions workflows.”
    )

    parser.add_argument(
        “targets”,
        nargs=“*”,
        help=“Workflow YAML files or directories under .github/workflows.”,
    )

    parser.add_argument(
        “—strict”,
        action=“store_true”,
        help=“Treat selected security warnings as failures.”,
    )

    parser.add_argument(
        “—version”,
        action=“version”,
        version=f”MedOrbits Workflow Validator {VERSION}”,
    )

    args = parser.parse_args()

    if not ROOT.is_dir():
        print(
            f”ERROR: Repository root unavailable: {ROOT}”,
            file=sys.stderr,
        )
        return 2

    if not WORKFLOWS_DIR.is_dir():
        print(
            f”ERROR: Workflow directory not found: {WORKFLOWS_DIR}”,
            file=sys.stderr,
        )
        return 2

    try:
        if args.targets:
            workflow_files: list[Path] = []

            for target in args.targets:
                candidate = (ROOT / target).resolve()

                if not is_inside_root(candidate):
                    raise ValueError(
                        f”Target escapes repository root: {target}”
                    )

                if not candidate.exists():
                    raise FileNotFoundError(
                        f”Target does not exist: {target}”
                    )

                if candidate.is_symlink():
                    raise ValueError(
                        f”Symbolic-link target rejected: {target}”
                    )

                if candidate.is_file():
                    if candidate.suffix.lower() not in WORKFLOW_SUFFIXES:
                        raise ValueError(
                            f”Unsupported workflow extension: {target}”
                        )

                    try:
                        candidate.relative_to(WORKFLOWS_DIR.resolve())
                    except ValueError as exc:
                        raise ValueError(
                            f”Workflow target must be inside .github/workflows: {target}”
                        ) from exc

                    workflow_files.append(candidate)

                elif candidate.is_dir():
                    try:
                        candidate.relative_to(WORKFLOWS_DIR.resolve())
                    except ValueError as exc:
                        raise ValueError(
                            f”Workflow directory must be inside .github/workflows: {target}”
                        ) from exc

                    workflow_files.extend(
                        discover_workflows(candidate)
                    )

                else:
                    raise ValueError(
                        f”Unsupported target type: {target}”
                    )

            workflow_files = sorted(set(workflow_files))

        else:
            workflow_files = discover_workflows(WORKFLOWS_DIR)

    except (OSError, ValueError) as exc:
        print(f”ERROR: {exc}”, file=sys.stderr)
        return 2

    if not workflow_files:
        print(“ERROR: No workflow YAML files found.”, file=sys.stderr)
        return 1

    print(“=“ * 64)
    print(“MedOrbits GitHub Actions Workflow Validation”)
    print(“=“ * 64)
    print(f”Repository: {ROOT}”)
    print(f”Version:    {VERSION}”)
    print(f”Strict:     {‘yes’ if args.strict else ‘no’}”)
    print(f”Files:      {len(workflow_files)}”)
    print(“=“ * 64)

    for workflow in workflow_files:
        validate_workflow(workflow, strict=args.strict)

    print(“\nWorkflow Validation Summary”)
    print(“=“ * 64)
    print(f”Files checked: {len(workflow_files)}”)
    print(f”Errors:        {len(ERRORS)}”)
    print(f”Warnings:      {len(WARNINGS)}”)

    for warning in WARNINGS:
        print(f”[WARNING] {warning}”)

    for error in ERRORS:
        print(f”[ERROR] {error}”)

    print(“=“ * 64)

    if ERRORS:
        print(“RESULT: FAILED”)
        return 1

    print(“RESULT: YAML and basic workflow structure passed.”)
    print(
        “NOTE: This does not validate GitHub expressions, remote action “
        “inputs, runner behavior, or actual workflow execution.”
    )
    print(
        “RECOMMENDED: Run actionlint and review workflow permissions.”
    )

    return 0


if __name__ == “__main__”:
    raise SystemExit(main())
