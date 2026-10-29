
#!/usr/bin/env python3
"""
MedOrbits GitHub Actions Workflow Validator
===========================================

File: tools/validate_workflows.py

Purpose:
    Validate YAML syntax and basic GitHub Actions workflow structure.

Requirements:
    Python 3.10+
    PyYAML

Install:
    python -m pip install PyYAML

Run from repository root:
    python tools/validate_workflows.py

Run from any working directory:
    python /path/to/MedOrbits/tools/validate_workflows.py

Exit codes:
    0 = Validation passed
    1 = Workflow validation failed
    2 = Validator configuration or dependency error

Notes:
    This validator does not replace GitHub Actions validation, actionlint,
    GitHub-hosted workflow execution, or security review.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

try:
    import yaml
    from yaml.constructor import ConstructorError
    from yaml.nodes import MappingNode
except ImportError:
    print(
        "ERROR: PyYAML is not installed.\n"
        "Install it with: python -m pip install PyYAML",
        file=sys.stderr,
    )
    raise SystemExit(2)


SCRIPT_PATH = Path(__file__).resolve()
ROOT = SCRIPT_PATH.parent.parent
WORKFLOWS_DIR = ROOT / ".github" / "workflows"

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "__pycache__",
}

WORKFLOW_SUFFIXES = {".yml", ".yaml"}


class UniqueKeySafeLoader(yaml.SafeLoader):
    """
    Safe YAML loader that rejects duplicate mapping keys.

    Duplicate keys can silently overwrite configuration values in ordinary
    YAML loading. Rejecting them helps catch accidental workflow errors.
    """


def construct_unique_mapping(
    loader: UniqueKeySafeLoader,
    node: MappingNode,
    deep: bool = False,
) -> dict[Any, Any]:
    """Construct a mapping while rejecting duplicate keys."""
    if not isinstance(node, MappingNode):
        raise ConstructorError(
            None,
            None,
            "Expected a YAML mapping node",
            node.start_mark,
        )

    loader.flatten_mapping(node)
    result: dict[Any, Any] = {}

    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)

        try:
            duplicate = key in result
        except TypeError as exc:
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "unhashable mapping key",
                key_node.start_mark,
            ) from exc

        if duplicate:
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"duplicate key {key!r}",
                key_node.start_mark,
            )

        result[key] = loader.construct_object(value_node, deep=deep)

    return result


UniqueKeySafeLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    construct_unique_mapping,
)


def is_ignored(path: Path) -> bool:
    """Return whether a path contains an ignored directory."""
    return any(part in IGNORED_DIRS for part in path.parts)


def discover_workflows() -> list[Path]:
    """Find workflow YAML files under .github/workflows."""
    return sorted(
        path
        for path in WORKFLOWS_DIR.rglob("*")
        if path.is_file()
        and path.suffix.lower() in WORKFLOW_SUFFIXES
        and not is_ignored(path.relative_to(ROOT))
    )


def display_path(path: Path) -> str:
    """Return a repository-relative path for diagnostics."""
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def add_error(errors: list[str], path: Path, message: str) -> None:
    errors.append(f"{display_path(path)}: {message}")


def add_warning(warnings: list[str], path: Path, message: str) -> None:
    warnings.append(f"{display_path(path)}: {message}")


def load_yaml(path: Path) -> Any:
    """Load one YAML document using the safe, duplicate-checking loader."""
    with path.open("r", encoding="utf-8-sig") as file:
        documents = list(yaml.load_all(file, Loader=UniqueKeySafeLoader))

    if len(documents) != 1:
        raise ValueError(
            f"expected exactly one YAML document, found {len(documents)}"
        )

    return documents[0]


def validate_triggers(
    path: Path,
    data: dict[Any, Any],
    errors: list[str],
) -> None:
    """
    Validate the workflow trigger declaration.

    GitHub Actions uses the key 'on'. YAML 1.1 parsers may interpret an
    unquoted 'on' as Boolean True; support that representation as well.
    """
    if "on" in data:
        triggers = data["on"]
    elif True in data:
        triggers = data[True]
    else:
        add_error(errors, path, "missing 'on' trigger configuration")
        return

    valid = isinstance(triggers, (str, list, dict))

    if not valid:
        add_error(
            errors,
            path,
            "'on' must be a string, list, or mapping",
        )
        return

    if isinstance(triggers, list):
        if not triggers:
            add_error(errors, path, "'on' trigger list must not be empty")
        elif not all(isinstance(item, str) and item.strip() for item in triggers):
            add_error(
                errors,
                path,
                "'on' trigger list must contain non-empty strings",
            )

    if isinstance(triggers, dict) and not triggers:
        add_error(errors, path, "'on' trigger mapping must not be empty")

    if isinstance(triggers, str) and not triggers.strip():
        add_error(errors, path, "'on' trigger must not be empty")


def validate_job(
    path: Path,
    job_id: Any,
    job: Any,
    errors: list[str],
    warnings: list[str],
) -> None:
    """Validate the basic structure of a regular or reusable workflow job."""
    prefix = f"job '{job_id}'"

    if not isinstance(job_id, str) or not job_id.strip():
        add_error(errors, path, "job identifiers must be non-empty strings")
        return

    if not isinstance(job, dict):
        add_error(errors, path, f"{prefix} must be a mapping")
        return

    # A job can invoke a reusable workflow instead of running local steps.
    reusable_workflow = "uses" in job

    if reusable_workflow:
        if not isinstance(job["uses"], str) or not job["uses"].strip():
            add_error(
                errors,
                path,
                f"{prefix} has an invalid reusable workflow 'uses' value",
            )

        if "steps" in job or "runs-on" in job:
            add_error(
                errors,
                path,
                f"{prefix} cannot combine reusable workflow 'uses' "
                "with 'steps' or 'runs-on'",
            )

        if "with" in job and not isinstance(job["with"], dict):
            add_error(errors, path, f"{prefix} 'with' must be a mapping")

        if "secrets" in job and not (
            isinstance(job["secrets"], dict)
            or job["secrets"] == "inherit"
        ):
            add_error(
                errors,
                path,
                f"{prefix} 'secrets' must be a mapping or 'inherit'",
            )

        return

    runs_on = job.get("runs-on")

    valid_runs_on = (
        isinstance(runs_on, str) and bool(runs_on.strip())
    ) or (
        isinstance(runs_on, list)
        and bool(runs_on)
        and all(isinstance(item, str) and item.strip() for item in runs_on)
    )

    if not valid_runs_on:
        add_error(
            errors,
            path,
            f"{prefix} is missing a valid 'runs-on' value",
        )

    if "steps" not in job:
        add_error(errors, path, f"{prefix} is missing 'steps'")
        return

    steps = job["steps"]

    if not isinstance(steps, list):
        add_error(errors, path, f"{prefix} 'steps' must be a list")
        return

    if not steps:
        add_warning(warnings, path, f"{prefix} has an empty steps list")

    for index, step in enumerate(steps, start=1):
        step_prefix = f"{prefix}, step {index}"

        if not isinstance(step, dict):
            add_error(errors, path, f"{step_prefix} must be a mapping")
            continue

        has_uses = "uses" in step
        has_run = "run" in step

        if has_uses == has_run:
            add_error(
                errors,
                path,
                f"{step_prefix} must specify exactly one of 'uses' or 'run'",
            )
            continue

        if has_uses:
            uses = step["uses"]

            if not isinstance(uses, str) or not uses.strip():
                add_error(
                    errors,
                    path,
                    f"{step_prefix} has an invalid 'uses' value",
                )
                continue

            # Local actions must resolve relative to the repository root.
            if uses.startswith("./"):
                local_action = (ROOT / uses[2:]).resolve()

                try:
                    local_action.relative_to(ROOT)
                except ValueError:
                    add_error(
                        errors,
                        path,
                        f"{step_prefix} local action path escapes "
                        "the repository root",
                    )
                    continue

                if not local_action.exists():
                    add_error(
                        errors,
                        path,
                        f"{step_prefix} local action path does not exist: {uses}",
                    )
                elif local_action.is_dir() and not any(
                    (local_action / filename).is_file()
                    for filename in ("action.yml", "action.yaml", "Dockerfile")
                ):
                    add_warning(
                        warnings,
                        path,
                        f"{step_prefix} local action directory has no "
                        "action.yml, action.yaml, or Dockerfile: {uses}",
                    )

        if has_run:
            run_value = step["run"]

            if not isinstance(run_value, str) or not run_value.strip():
                add_error(
                    errors,
                    path,
                    f"{step_prefix} has an empty or invalid 'run' value",
                )

        if "name" in step and not isinstance(step["name"], str):
            add_error(errors, path, f"{step_prefix} 'name' must be a string")

        if "env" in step and not isinstance(step["env"], dict):
            add_error(errors, path, f"{step_prefix} 'env' must be a mapping")

        if "with" in step and not isinstance(step["with"], dict):
            add_error(errors, path, f"{step_prefix} 'with' must be a mapping")


def validate_workflow(
    path: Path,
    errors: list[str],
    warnings: list[str],
) -> None:
    """Validate one workflow file."""
    relative = display_path(path)
    print(f"Checking {relative}")

    try:
        data = load_yaml(path)
    except (OSError, UnicodeError, yaml.YAMLError, ValueError) as exc:
        add_error(errors, path, f"invalid YAML or document structure: {exc}")
        return

    if not isinstance(data, dict):
        add_error(errors, path, "workflow must be a YAML mapping")
        return

    workflow_name = data.get("name")

    if not isinstance(workflow_name, str) or not workflow_name.strip():
        add_warning(warnings, path, "missing or empty workflow name")

    validate_triggers(path, data, errors)

    jobs = data.get("jobs")

    if not isinstance(jobs, dict) or not jobs:
        add_error(errors, path, "missing or empty 'jobs' mapping")
        return

    for job_id, job in jobs.items():
        validate_job(path, job_id, job, errors, warnings)


def main() -> int:
    """Run validation and print a summary."""
    if not ROOT.is_dir():
        print(
            f"ERROR: Repository root could not be resolved: {ROOT}",
            file=sys.stderr,
        )
        return 2

    if not (ROOT / ".git").exists() and not (ROOT / ".github").is_dir():
        print(
            "ERROR: Repository root not detected. Expected .git or .github "
            f"under {ROOT}.",
            file=sys.stderr,
        )
        return 2

    if not WORKFLOWS_DIR.is_dir():
        print(
            "ERROR: .github/workflows directory does not exist.",
            file=sys.stderr,
        )
        return 2

    workflow_files = discover_workflows()

    if not workflow_files:
        print("ERROR: No workflow YAML files found.", file=sys.stderr)
        return 1

    errors: list[str] = []
    warnings: list[str] = []

    for path in workflow_files:
        validate_workflow(path, errors, warnings)

    print("\nWorkflow Validation Summary")
    print(f"Repository: {ROOT}")
    print(f"Files checked: {len(workflow_files)}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    for item in warnings:
        print(f"WARNING: {item}")

    for item in errors:
        print(f"ERROR: {item}")

    if errors:
        print("\nRESULT: FAILED")
        return 1

    print("\nRESULT: YAML and basic workflow structure passed.")
    print(
        "NOTE: This does not validate GitHub expressions, action inputs, "
        "permissions, runner behavior, or remote workflow execution."
    )
    print(
        "RECOMMENDED: Run actionlint and test workflows in GitHub Actions."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
