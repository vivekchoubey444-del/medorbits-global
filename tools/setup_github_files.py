
#!/usr/bin/env python3
"""
MedOrbits GitHub Configuration Setup
====================================

File: tools/setup_github_files.py

Creates or prepares:
    .github/SECURITY.md
    .github/dependabot.yml
    .github/workflows/repository-validation.yml

Funding:
    .github/FUNDING.yml is optional. It is not created automatically because
    a comment-only funding file does not configure a supported funding source.

Usage:
    python tools/setup_github_files.py
    python tools/setup_github_files.py --dry-run
    python tools/setup_github_files.py --force
    python tools/setup_github_files.py --force --backup
    python tools/setup_github_files.py --root /path/to/MedOrbits

Safety:
    - Existing files are preserved unless --force is supplied.
    - Existing files are backed up before being overwritten.
    - Symlink targets are never overwritten.
    - No files are deleted.
    - No dependencies are installed by this script.
    - No GitHub changes are pushed.
    - Generated configuration must be reviewed before use.

Exit codes:
    0 = Setup completed successfully
    1 = One or more file operations failed
    2 = Invalid arguments or repository configuration error
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve()
DEFAULT_ROOT = SCRIPT_PATH.parent.parent

FILES: dict[str, str] = {
    ".github/SECURITY.md": """# MedOrbits Security Policy

> Maintainers: complete and verify this policy before relying on it.

## Supported Versions

Security fixes should prioritize versions that the maintainers actively
support. Publish an explicit version-support policy before making claims
about which releases receive security updates.

## Reporting a Vulnerability

**Do not publish exploitable vulnerability details, credentials, API keys,
access tokens, private records, or sensitive production information in
public issues.**

Use the repository's verified private vulnerability-reporting channel.
GitHub private vulnerability reporting may be used only if it is enabled
and available for this repository.

If no private reporting channel is available, do not publish sensitive
technical details while seeking clarification from a verified maintainer
contact.

When reporting privately, include relevant information such as the affected
component, affected version, potential impact, and safe reproduction details
that the recipient needs to assess the report. Do not include real passwords
or unrelated personal information.

## Coordinated Disclosure

Coordinate remediation and disclosure with the maintainers. Do not assume
that a report has been received, accepted, or resolved until confirmation
is available.

## Maintainer Setup Checklist

- [ ] Enable and verify an appropriate private reporting channel.
- [ ] Define supported versions and the remediation policy.
- [ ] Define the process for acknowledging and triaging reports.
- [ ] Document a realistic response policy before publishing response-time
      commitments.
- [ ] Review repository permissions and access to sensitive evidence.
""",
    ".github/dependabot.yml": """# MedOrbits Dependabot configuration.
# Confirm that each configured manifest exists in the repository.

version: 2

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
""",
    ".github/workflows/repository-validation.yml": r"""name: MedOrbits Repository Validation

on:
  push:
    branches:
      - main
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
      - name: Check out repository
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: false

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Install YAML validator
        run: python -m pip install --disable-pip-version-check PyYAML

      - name: Validate JSON
        shell: bash
        run: |
          python - <<'PY'
          import json
          import os
          import sys
          from pathlib import Path

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }
          errors = []
          checked = 0

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() != ".json":
                      continue

                  checked += 1
                  try:
                      with path.open(encoding="utf-8-sig") as file:
                          json.load(file)
                  except (OSError, UnicodeError, ValueError) as exc:
                      errors.append(f"{path}: {exc}")

          print(f"JSON files checked: {checked}")
          if errors:
              print("\n".join(errors))
              sys.exit(1)

          print("JSON validation passed.")
          PY

      - name: Validate YAML syntax and duplicate keys
        shell: bash
        run: |
          python - <<'PY'
          import os
          import sys
          from pathlib import Path

          import yaml
          from yaml.constructor import ConstructorError
          from yaml.nodes import MappingNode

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }

          class UniqueKeyLoader(yaml.SafeLoader):
              pass

          def construct_mapping(loader, node, deep=False):
              if not isinstance(node, MappingNode):
                  raise ConstructorError(
                      None, None, "expected a mapping", node.start_mark
                  )

              loader.flatten_mapping(node)
              result = {}

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

                  result[key] = loader.construct_object(
                      value_node, deep=deep
                  )

              return result

          UniqueKeyLoader.add_constructor(
              yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
              construct_mapping,
          )

          errors = []
          checked = 0

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() not in {
                      ".yml", ".yaml"
                  }:
                      continue

                  checked += 1
                  try:
                      with path.open(encoding="utf-8-sig") as file:
                          list(yaml.load_all(file, Loader=UniqueKeyLoader))
                  except (OSError, UnicodeError, yaml.YAMLError, ValueError) as exc:
                      errors.append(f"{path}: {exc}")

          print(f"YAML files checked: {checked}")
          if errors:
              print("\n".join(errors))
              sys.exit(1)

          print("YAML syntax and duplicate-key validation passed.")
          PY

      - name: Validate TOML
        shell: bash
        run: |
          python - <<'PY'
          import os
          import sys
          import tomllib
          from pathlib import Path

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }
          errors = []
          checked = 0

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() != ".toml":
                      continue

                  checked += 1
                  try:
                      with path.open("rb") as file:
                          tomllib.load(file)
                  except (OSError, UnicodeError, ValueError) as exc:
                      errors.append(f"{path}: {exc}")

          print(f"TOML files checked: {checked}")
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
          import os
          import sys
          from pathlib import Path

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }
          errors = []
          checked = 0

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() != ".py":
                      continue

                  checked += 1
                  try:
                      ast.parse(
                          path.read_text(encoding="utf-8"),
                          filename=path.as_posix(),
                      )
                  except (OSError, UnicodeError, SyntaxError, ValueError) as exc:
                      errors.append(f"{path}: {exc}")

          print(f"Python files checked: {checked}")
          if errors:
              print("\n".join(errors))
              sys.exit(1)

          print("Python syntax validation passed.")
          PY

      - name: Validate JavaScript syntax
        shell: bash
        run: |
          python - <<'PY' > "$RUNNER_TEMP/js-files.txt"
          import os
          from pathlib import Path

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() != ".js":
                      continue
                  print(path.as_posix())
          PY

          while IFS= read -r file; do
            [ -z "$file" ] && continue
            echo "Checking $file"
            node --check "$file" || exit 1
          done < "$RUNNER_TEMP/js-files.txt"

          echo "JavaScript syntax validation passed."

      - name: Validate shell syntax
        shell: bash
        run: |
          python - <<'PY' > "$RUNNER_TEMP/sh-files.txt"
          import os
          from pathlib import Path

          ignored = {
              ".git", "node_modules", ".venv", "venv",
              "__pycache__", "dist", "build", ".next", "coverage",
              ".repair-backups",
          }

          for current, directories, filenames in os.walk(
              ".", topdown=True, followlinks=False
          ):
              current_path = Path(current)
              directories[:] = sorted(
                  name for name in directories
                  if name not in ignored
                  and not (current_path / name).is_symlink()
              )

              for filename in sorted(filenames):
                  path = current_path / filename
                  if path.is_symlink() or path.suffix.lower() != ".sh":
                      continue
                  print(path.as_posix())
          PY

          while IFS= read -r file; do
            [ -z "$file" ] && continue
            echo "Checking $file"
            bash -n "$file" || exit 1
          done < "$RUNNER_TEMP/sh-files.txt"

          echo "Shell syntax validation passed."

      - name: Validation summary
        if: always()
        env:
          JOB_STATUS: ${{ job.status }}
        run: echo "Repository validation job status: $JOB_STATUS"
""",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="Repository root directory.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing regular files after creating backups.",
    )
    parser.add_argument(
        "--backup",
        action="store_true",
        help="Create backups even if --force is not supplied. "
             "Existing files are still preserved without --force.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report planned actions without writing files.",
    )
    return parser.parse_args()


def is_repository_root(root: Path) -> bool:
    git_entry = root / ".git"
    github_dir = root / ".github"
    return git_entry.exists() or git_entry.is_symlink() or github_dir.is_dir()


def backup_file(source: Path, root: Path) -> Path:
    """Create a timestamped backup without overwriting an existing backup."""
    relative = source.relative_to(root)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup_root = root / ".repair-backups" / timestamp
    destination = backup_root / relative

    destination.parent.mkdir(parents=True, exist_ok=True)

    # Exclusive creation prevents accidental backup overwrites.
    with source.open("rb") as src, destination.open("xb") as dst:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            dst.write(chunk)

    return destination


def atomic_write_new_file(target: Path, content: str) -> None:
    """
    Create a new file exclusively.

    This deliberately refuses to overwrite a file that appears between
    the existence check and the write.
    """
    target.parent.mkdir(parents=True, exist_ok=True)

    with target.open("x", encoding="utf-8", newline="\n") as file:
        file.write(content)


def write_file(
    root: Path,
    relative: str,
    content: str,
    force: bool,
    dry_run: bool,
    created: list[str],
    updated: list[str],
    preserved: list[str],
    errors: list[str],
) -> None:
    target = root / relative

    if target.is_symlink():
        errors.append(f"Refusing to write through symlink: {relative}")
        return

    if target.exists() and not target.is_file():
        errors.append(f"Target exists but is not a regular file: {relative}")
        return

    if target.is_file() and not force:
        preserved.append(relative)
        return

    if dry_run:
        action = "Would update" if target.is_file() else "Would create"
        print(f"DRY-RUN: {action} {relative}")
        return

    try:
        if target.is_file():
            # Back up existing content before a forced overwrite.
            backup = backup_file(target, root)
            print(f"BACKUP: {backup.relative_to(root).as_posix()}")

            # Replace the target only after the backup succeeds.
            temporary = target.with_name(
                f".{target.name}.setup-{os.getpid()}.tmp"
            )

            if temporary.exists() or temporary.is_symlink():
                errors.append(
                    f"Temporary path already exists; refusing overwrite: "
                    f"{temporary.relative_to(root).as_posix()}"
                )
                return

            try:
                with temporary.open(
                    "x", encoding="utf-8", newline="\n"
                ) as file:
                    file.write(content)

                os.replace(temporary, target)
                updated.append(relative)
            finally:
                # Only remove the temporary file created by this invocation.
                if temporary.is_file() and not temporary.is_symlink():
                    temporary.unlink(missing_ok=True)

        else:
            atomic_write_new_file(target, content)
            created.append(relative)

    except FileExistsError:
        preserved.append(relative)
        print(f"NOTICE: File appeared during setup; preserved {relative}")
    except OSError as exc:
        errors.append(f"{relative}: {exc}")


def main() -> int:
    args = parse_args()

    try:
        root = args.root.expanduser().resolve()
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"ERROR: Could not resolve repository root: {exc}", file=sys.stderr)
        return 2

    if not root.is_dir():
        print(f"ERROR: Directory does not exist: {root}", file=sys.stderr)
        return 2

    if not is_repository_root(root):
        print(
            "ERROR: Run from the MedOrbits repository root or provide "
            "a valid --root path containing .git or .github.",
            file=sys.stderr,
        )
        return 2

    created: list[str] = []
    updated: list[str] = []
    preserved: list[str] = []
    errors: list[str] = []

    for relative, content in FILES.items():
        write_file(
            root=root,
            relative=relative,
            content=content,
            force=args.force,
            dry_run=args.dry_run,
            created=created,
            updated=updated,
            preserved=preserved,
            errors=errors,
        )

    print("\nMedOrbits GitHub Configuration Setup")
    print("=" * 38)
    print(f"Repository: {root}")
    print(f"Created:    {len(created)}")
    print(f"Updated:    {len(updated)}")
    print(f"Preserved:  {len(preserved)}")
    print(f"Errors:     {len(errors)}")

    for path in created:
        print(f"CREATED   {path}")

    for path in updated:
        print(f"UPDATED   {path}")

    for path in preserved:
        print(f"PRESERVED {path}")

    for error in errors:
        print(f"ERROR     {error}", file=sys.stderr)

    if args.dry_run:
        print("\nDRY-RUN: No files were created or overwritten.")

    if errors:
        print("\nRESULT: FAILED -- review the errors above.")
        return 1

    print("\nReview the generated configuration before committing.")
    print("Suggested checks:")
    print("  git status --short")
    print("  git diff -- .github")
    print(
        "\nNOTE: A backup is created before each forced overwrite. "
        "If an operation fails, inspect the backup and working tree."
    )
    print(
        "NOTE: SECURITY.md is a starter policy. Verify the private reporting "
        "channel before relying on it."
    )
    print(
        "NOTE: The validation workflow checks syntax; it does not prove "
        "application correctness or deployment readiness."
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
