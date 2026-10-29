
#!/usr/bin/env python3
"""
MedOrbits GitHub Configuration Setup
Creates:
  .github/FUNDING.yml
  .github/SECURITY.md
  .github/dependabot.yml
  .github/workflows/repository-validation.yml

Existing files are preserved unless --force is supplied.

Usage:
  python tools/setup_github_files.py
  python tools/setup_github_files.py --force
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

FILES = {
    ".github/FUNDING.yml": """# MedOrbits funding configuration.
# No sponsorship platforms are configured.
# Add a supported platform only if you choose to accept sponsorships.
""",
    ".github/SECURITY.md": """# Security Policy

## Supported Versions

Security fixes are prioritized for the latest maintained version of MedOrbits.

## Reporting a Vulnerability

Do not publish exploitable vulnerabilities, credentials, API keys, or
private user data in public issues.

If GitHub private vulnerability reporting is enabled, use it to report
security issues privately.

Include the affected component, reproduction steps, potential impact,
and any suggested mitigation. Never include real passwords or tokens.
""",
    ".github/dependabot.yml": """version: 2

updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - github-actions

  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - javascript

  - package-ecosystem: npm
    directory: /local-agent
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - local-agent

  - package-ecosystem: pip
    directory: /local-agent
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - dependencies
      - python
""",
    ".github/workflows/repository-validation.yml": r"""name: MedOrbits Repository Validation

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: repository-validation-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate repository files
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Validate JSON
        shell: bash
        run: |
          python - <<'PY'
          import json
          import sys
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          errors = []

          for path in Path(".").rglob("*.json"):
              if any(part in ignored for part in path.parts):
                  continue
              try:
                  with path.open(encoding="utf-8") as f:
                      json.load(f)
              except Exception as exc:
                  errors.append(f"{path}: {exc}")

          if errors:
              print("\n".join(errors))
              sys.exit(1)
          print("JSON validation passed.")
          PY

      - name: Install YAML validator
        run: python -m pip install --disable-pip-version-check PyYAML

      - name: Validate YAML
        shell: bash
        run: |
          python - <<'PY'
          import sys
          import yaml
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          errors = []

          for pattern in ("*.yml", "*.yaml"):
              for path in Path(".").rglob(pattern):
                  if any(part in ignored for part in path.parts):
                      continue
                  try:
                      with path.open(encoding="utf-8") as f:
                          list(yaml.safe_load_all(f))
                  except Exception as exc:
                      errors.append(f"{path}: {exc}")

          if errors:
              print("\n".join(errors))
              sys.exit(1)
          print("YAML validation passed.")
          PY

      - name: Validate TOML
        shell: bash
        run: |
          python - <<'PY'
          import sys
          import tomllib
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          errors = []

          for path in Path(".").rglob("*.toml"):
              if any(part in ignored for part in path.parts):
                  continue
              try:
                  with path.open("rb") as f:
                      tomllib.load(f)
              except Exception as exc:
                  errors.append(f"{path}: {exc}")

          if errors:
              print("\n".join(errors))
              sys.exit(1)
          print("TOML validation passed.")
          PY

      - name: Validate Python syntax
        shell: bash
        run: |
          python - <<'PY'
          import ast
          import sys
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          errors = []

          for path in Path(".").rglob("*.py"):
              if any(part in ignored for part in path.parts):
                  continue
              try:
                  ast.parse(path.read_text(encoding="utf-8"),
                            filename=str(path))
              except Exception as exc:
                  errors.append(f"{path}: {exc}")

          if errors:
              print("\n".join(errors))
              sys.exit(1)
          print("Python syntax validation passed.")
          PY

      - name: Validate JavaScript syntax
        shell: bash
        run: |
          python - <<'PY' > "$RUNNER_TEMP/js-files.txt"
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          for path in Path(".").rglob("*.js"):
              if not any(part in ignored for part in path.parts):
                  print(path.as_posix())
          PY

          while IFS= read -r file; do
            [ -z "$file" ] && continue
            echo "Checking $file"
            node --check "$file"
          done < "$RUNNER_TEMP/js-files.txt"

      - name: Validate shell syntax
        shell: bash
        run: |
          python - <<'PY' > "$RUNNER_TEMP/sh-files.txt"
          from pathlib import Path

          ignored = {".git", "node_modules", ".venv", "venv",
                     "dist", "build", ".next", "coverage"}
          for path in Path(".").rglob("*.sh"):
              if not any(part in ignored for part in path.parts):
                  print(path.as_posix())
          PY

          while IFS= read -r file; do
            [ -z "$file" ] && continue
            echo "Checking $file"
            bash -n "$file"
          done < "$RUNNER_TEMP/sh-files.txt"

      - name: Validation summary
        if: always()
        run: echo "Validation job status: ${{ job.status }}"
"""
}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite files that already exist.",
    )
    args = parser.parse_args()

    root = Path.cwd()
    if not (root / ".git").exists() and not (root / ".github").exists():
        print(
            "ERROR: Run this script from the MedOrbits repository root.",
            file=sys.stderr,
        )
        return 2

    created = []
    preserved = []
    errors = []

    for relative_path, content in FILES.items():
        target = root / relative_path

        if target.exists() and not args.force:
            preserved.append(relative_path)
            continue

        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8", newline="\n")
            created.append(relative_path)
        except OSError as exc:
            errors.append(f"{relative_path}: {exc}")

    for path in created:
        print(f"CREATED/UPDATED  {path}")
    for path in preserved:
        print(f"PRESERVED        {path}")
    for error in errors:
        print(f"ERROR            {error}", file=sys.stderr)

    print(f"\nCreated or updated: {len(created)}")
    print(f"Preserved: {len(preserved)}")
    print(f"Errors: {len(errors)}")

    if created:
        print("\nReview the changes before committing:")
        print("git status --short")
        print("git diff -- .github")

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
