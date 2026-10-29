
#!/usr/bin/env python3
"""
MedOrbits GitHub Actions Workflow Validator
Path: /tools/validate_workflows.py

Install:
    python -m pip install PyYAML

Run from repository root:
    python tools/validate_workflows.py
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print(
        "ERROR: PyYAML is not installed.\n"
        "Install it with: python -m pip install PyYAML",
        file=sys.stderr,
    )
    raise SystemExit(2)

ROOT = Path.cwd()
WORKFLOWS_DIR = ROOT / ".github" / "workflows"

IGNORED_DIRS = {
    ".git", "node_modules", ".venv", "venv",
    "dist", "build", "__pycache__",
}


def main() -> int:
    if not (ROOT / ".git").exists() and not (ROOT / ".github").exists():
        print("ERROR: Run this script from the repository root.")
        return 2

    if not WORKFLOWS_DIR.is_dir():
        print("ERROR: .github/workflows directory does not exist.")
        return 2

    workflow_files = sorted(
        path
        for path in WORKFLOWS_DIR.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".yml", ".yaml"}
        and not any(part in IGNORED_DIRS for part in path.parts)
    )

    if not workflow_files:
        print("ERROR: No workflow YAML files found.")
        return 1

    errors: list[str] = []
    warnings: list[str] = []

    for path in workflow_files:
        relative = path.relative_to(ROOT)
        print(f"Checking {relative}")

        try:
            with path.open("r", encoding="utf-8") as file:
                documents = list(yaml.safe_load_all(file))
        except (OSError, UnicodeError, yaml.YAMLError) as exc:
            errors.append(f"{relative}: invalid YAML: {exc}")
            continue

        if len(documents) != 1 or not isinstance(documents[0], dict):
            errors.append(f"{relative}: expected one YAML mapping document")
            continue

        data = documents[0]

        # GitHub Actions uses the key "on". YAML 1.1 parsers can
        # interpret an unquoted "on" as a boolean, so support both.
        triggers = data.get("on", data.get(True))

        if not isinstance(data.get("name"), str) or not data["name"].strip():
            warnings.append(f"{relative}: missing or empty workflow name")

        if triggers is None:
            errors.append(f"{relative}: missing 'on' trigger configuration")

        jobs = data.get("jobs")
        if not isinstance(jobs, dict) or not jobs:
            errors.append(f"{relative}: missing or empty jobs mapping")
            continue

        for job_id, job in jobs.items():
            if not isinstance(job, dict):
                errors.append(f"{relative}: job '{job_id}' must be a mapping")
                continue

            if not job.get("runs-on"):
                errors.append(f"{relative}: job '{job_id}' is missing runs-on")

            steps = job.get("steps", [])
            if not isinstance(steps, list):
                errors.append(f"{relative}: job '{job_id}' steps must be a list")
                continue

            for index, step in enumerate(steps, start=1):
                if not isinstance(step, dict):
                    errors.append(
                        f"{relative}: job '{job_id}', step {index} must be a mapping"
                    )
                    continue

                if "uses" not in step and "run" not in step:
                    errors.append(
                        f"{relative}: job '{job_id}', step {index} "
                        "needs 'uses' or 'run'"
                    )

                if "uses" in step and isinstance(step["uses"], str):
                    if step["uses"].startswith("./"):
                        local_action = ROOT / step["uses"][2:]
                        if not local_action.exists():
                            warnings.append(
                                f"{relative}: local action path not found: "
                                f"{step['uses']}"
                            )

    print("\nWorkflow Validation Summary")
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
    print("Note: GitHub-specific expression and action validation requires CI.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
