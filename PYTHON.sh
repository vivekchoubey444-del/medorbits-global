
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Python Repository Manager
# File: /PYTHON.sh
# Requirements: Bash, Python 3.10+
#
# Usage:
#   bash PYTHON.sh
#   bash PYTHON.sh --force
#   bash PYTHON.sh --compile
#   bash PYTHON.sh --commit
#
# --force   Replace only files managed by this script.
# --compile Compile all Python files and report syntax failures.
# --commit  Commit changes after validation; never pushes or force-pushes.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

FORCE=false
COMPILE=false
COMMIT=false
CREATED=0
SKIPPED=0
FAILURES=0

log()  { printf '[INFO] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
die()  { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: bash PYTHON.sh [--force] [--compile] [--commit] [--help]

  --force    Replace managed baseline files, creating .bak backups.
  --compile  Compile every Python source file and report errors.
  --commit   Create a local Git commit after successful validation.
  --help     Show usage.
EOF
}

while (($#)); do
  case "$1" in
    --force) FORCE=true ;;
    --compile) COMPILE=true ;;
    --commit) COMMIT=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
  shift
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

command -v python3 >/dev/null 2>&1 ||
  die "Python 3 is required. Install Python 3.10 or later."

PYTHON_VERSION="$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')"
log "Repository: $ROOT"
log "Python: $PYTHON_VERSION"

python3 - <<'PY' || die "Python 3.10 or later is required."
import sys
if sys.version_info < (3, 10):
    raise SystemExit("Python 3.10 or later is required.")
PY

create_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"

  if [[ -e "$path" && "$FORCE" != true ]]; then
    log "Preserved existing file: $path"
    ((SKIPPED+=1))
    return 0
  fi

  if [[ -e "$path" && "$FORCE" == true ]]; then
    cp -p "$path" "$path.bak"
    warn "Backup created: $path.bak"
  fi

  local temporary
  temporary="$(mktemp "$(dirname "$path")/.python.XXXXXX")"
  printf '%s\n' "$content" > "$temporary"
  mv "$temporary" "$path"

  ((CREATED+=1))
  log "Created or updated: $path"
}

# ----------------------------------------------------------------------
# Python package structure
# ----------------------------------------------------------------------

directories=(
  "python/medorbits_tools"
  "python/scripts"
  "python/tests"
  "local-agent/tools"
  "tests/python"
  "reports/python"
)

for directory in "${directories[@]}"; do
  mkdir -p "$directory"
done

create_file "python/medorbits_tools/__init__.py" "$(cat <<'PY'
"""MedOrbits reusable Python utilities."""

__version__ = "1.0.0"
PY
)"

create_file "python/medorbits_tools/config.py" "$(cat <<'PY'
"""Environment-backed configuration helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Non-secret application configuration."""

    environment: str = "development"
    log_level: str = "INFO"
    api_base_url: str = ""

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            environment=os.getenv("APP_ENV", "development"),
            log_level=os.getenv("LOG_LEVEL", "INFO"),
            api_base_url=os.getenv("API_BASE_URL", ""),
        )
PY
)"

create_file "python/medorbits_tools/logging_config.py" "$(cat <<'PY'
"""Standard-library logging configuration."""

from __future__ import annotations

import logging
import os


def configure_logging() -> None:
    """Configure basic logging without exposing environment secrets."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
PY
)"

create_file "python/main.py" "$(cat <<'PY'
#!/usr/bin/env python3
"""MedOrbits Python utility entry point."""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description="MedOrbits Python tools."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Print a JSON health report.",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="MedOrbits Python tools 1.0.0",
    )

    args = parser.parse_args()

    if args.check:
        print(json.dumps({
            "application": "MedOrbits",
            "status": "ok",
            "python_version": sys.version.split()[0],
        }, indent=2))
    else:
        parser.print_help()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
PY
)"

create_file "python/tests/test_smoke.py" "$(cat <<'PY'
"""Smoke tests for the MedOrbits Python tools."""

import unittest

from medorbits_tools.config import Settings


class SettingsTests(unittest.TestCase):
    def test_defaults_are_available(self) -> None:
        settings = Settings()
        self.assertEqual(settings.environment, "development")
        self.assertEqual(settings.log_level, "INFO")

    def test_environment_factory(self) -> None:
        settings = Settings.from_environment()
        self.assertTrue(settings.environment)


if __name__ == "__main__":
    unittest.main()
PY
)"

create_file "python/requirements-dev.txt" "$(cat <<'TXT'
# Optional development dependencies.
# Keep versions reviewed and pinned when adding dependencies.
pytest==8.4.2
TXT
)"

# ----------------------------------------------------------------------
# Python syntax validator with useful diagnostics
# ----------------------------------------------------------------------

create_file "scripts/validate-python.py" "$(cat <<'PY'
#!/usr/bin/env python3
"""Validate Python syntax throughout a repository."""

from __future__ import annotations

import ast
import json
import sys
from pathlib import Path

IGNORED = {
    ".git", ".venv", "venv", "node_modules",
    "__pycache__", "dist", "build", "coverage",
    ".tox", ".mypy_cache", ".pytest_cache",
}


def main() -> int:
    root = Path.cwd()
    errors: list[str] = []
    checked = 0

    for path in root.rglob("*.py"):
        if any(part in IGNORED for part in path.parts):
            continue

        checked += 1
        try:
            source = path.read_text(encoding="utf-8-sig")
            ast.parse(source, filename=str(path))
        except SyntaxError as exc:
            line = exc.lineno or 1
            errors.append(f"{path}:{line}: {exc.msg}")

            print(f"\n--- {path}:{line} ---")
            try:
                lines = path.read_text(
                    encoding="utf-8-sig"
                ).splitlines()
                for number in range(max(1, line - 2), min(len(lines), line + 2) + 1):
                    marker = ">>" if number == line else "  "
                    print(f"{marker} {number:4}: {lines[number - 1]}")
            except OSError:
                pass
        except (OSError, UnicodeError) as exc:
            errors.append(f"{path}: cannot read source: {exc}")

    report = {
        "files_checked": checked,
        "error_count": len(errors),
        "errors": errors,
    }

    report_dir = root / "reports" / "python"
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "syntax-report.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"\nPython files checked: {checked}")
    print(f"Syntax/read errors: {len(errors)}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    print("Python syntax validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
PY
)"

# ----------------------------------------------------------------------
# Repair known incompatible_share.py only when it is clearly JS code.
# Do not overwrite a different Python implementation automatically.
# ----------------------------------------------------------------------

TARGET="local-agent/tools/compatible_share.py"

if [[ -f "$TARGET" ]]; then
  if grep -Eq "^[[:space:]]*['\"]use strict['\"];?|^[[:space:]]*/\\*" "$TARGET"; then
    warn "$TARGET appears to contain JavaScript syntax."

    if [[ "$FORCE" == true ]]; then
      cp -p "$TARGET" "$TARGET.bak"

      cat > "$TARGET" <<'PY'
#!/usr/bin/env python3
"""MedOrbits compatible shared helpers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class CompatibilityError(Exception):
    """Raised when a shared operation fails."""


def read_text(path: str | Path, *, max_bytes: int = 5_000_000) -> str:
    """Read a UTF-8 text file with a size limit."""
    target = Path(path)
    try:
        with target.open("rb") as stream:
            data = stream.read(max_bytes + 1)
    except OSError as exc:
        raise CompatibilityError(f"Cannot read {target}: {exc}") from exc

    if len(data) > max_bytes:
        raise CompatibilityError(f"File exceeds size limit: {target}")

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise CompatibilityError(f"Invalid UTF-8 file: {target}") from exc


def read_json(path: str | Path, *, max_bytes: int = 5_000_000) -> Any:
    """Read and parse JSON from a UTF-8 file."""
    try:
        return json.loads(read_text(path, max_bytes=max_bytes))
    except json.JSONDecodeError as exc:
        raise CompatibilityError(
            f"Invalid JSON in {path}: line {exc.lineno}, column {exc.colno}"
        ) from exc


def write_json(path: str | Path, data: Any) -> Path:
    """Write formatted JSON to a path."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False)
    target.write_text(content + "\n", encoding="utf-8")
    return target


def operation_result(success: bool, message: str, **details: Any) -> dict[str, Any]:
    """Create a consistent operation result."""
    return {
        "success": bool(success),
        "message": str(message),
        "details": details,
    }


if __name__ == "__main__":
    print("MedOrbits compatible shared utilities: PASS")
PY
      log "Replaced JavaScript-in-Python file with Python implementation."
    else
      warn "Use --force only if you want this specific file replaced."
    fi
  fi
fi

# ----------------------------------------------------------------------
# Validate Python files
# ----------------------------------------------------------------------

log "Validating Python source files..."

if ! python3 scripts/validate-python.py; then
  FAILURES=1
fi

if [[ "$COMPILE" == true ]]; then
  log "Compiling Python source files..."
  while IFS= read -r -d '' file; do
    if ! python3 -m py_compile "$file"; then
      FAILURES=1
    fi
  done < <(
    find . -type f -name '*.py' \
      -not -path './.git/*' \
      -not -path './node_modules/*' \
      -not -path './*/node_modules/*' \
      -not -path './.venv/*' \
      -not -path './venv/*' \
      -not -path './*/__pycache__/*' \
      -print0
  )
fi

log "Files created or replaced: $CREATED"
log "Existing files preserved: $SKIPPED"

if ((FAILURES != 0)); then
  die "Python validation failed. Read reports/python/syntax-report.json."
fi

# ----------------------------------------------------------------------
# Optional local commit
# ----------------------------------------------------------------------

if [[ "$COMMIT" == true ]]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 ||
    die "--commit requires a Git repository."

  git add -- \
    python/medorbits_tools \
    python/main.py \
    python/tests \
    python/requirements-dev.txt \
    scripts/validate-python.py \
    reports/python/syntax-report.json

  if [[ -f local-agent/tools/compatible_share.py ]]; then
    git add -- local-agent/tools/compatible_share.py
  fi

  if git diff --cached --quiet; then
    log "No changes to commit."
  else
    git diff --cached --check
    git commit -m "fix: add Python validation and utility baseline"
    log "Local commit created. No push performed."
  fi
fi

log "PYTHON.sh completed successfully."
