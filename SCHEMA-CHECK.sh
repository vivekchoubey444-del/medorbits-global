
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- JSON Schema Validation Runner
# File: SCHEMA-CHECK.sh
# Version: 1.0.0
#
# Usage:
#   bash SCHEMA-CHECK.sh
#   bash SCHEMA-CHECK.sh --strict
#   bash SCHEMA-CHECK.sh --path api/schemas
#   bash SCHEMA-CHECK.sh --help
#
# Safety:
#   - Read-only validation.
#   - No package installation.
#   - No file creation, deletion, overwriting, commits, or deployment.
#   - Uses Python standard library; jsonschema is optional.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

STRICT=0
TARGET="."

log()  { printf '[SCHEMA-CHECK] %s\n' "$*"; }
die()  { printf '[SCHEMA-CHECK] ERROR: %s\n' "$*" >&2; exit 2; }

usage() {
    cat <<'HELP'
MedOrbits JSON Schema Checker

Usage:
  bash SCHEMA-CHECK.sh [--strict] [--path PATH] [--help]

Options:
  --strict     Require the optional Python jsonschema package.
  --path PATH  Validate JSON files in a repository-relative directory.
               Default: entire repository.
  --help       Display this help.

Checks:
  - JSON syntax and duplicate keys
  - JSON Schema meta-schema validation (when jsonschema is installed)
  - Local $ref targets
  - Schema-to-data validation for conventional schema/data directories
HELP
}

while (($#)); do
    case "$1" in
        --strict) STRICT=1 ;;
        --path)
            (($# >= 2)) || die "--path requires a value"
            TARGET="$2"
            shift
            ;;
        --help|-h) usage; exit 0 ;;
        *) die "Unknown argument: $1" ;;
    esac
    shift
done

command -v python3 >/dev/null 2>&1 || die "Python 3 is required"

export MEDORBITS_SCHEMA_ROOT="$ROOT"
export MEDORBITS_SCHEMA_TARGET="$TARGET"
export MEDORBITS_SCHEMA_STRICT="$STRICT"

log "Repository: $ROOT"
log "Target: $TARGET"

python3 <<'PY'
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urldefrag

root = Path(os.environ["MEDORBITS_SCHEMA_ROOT"]).resolve()
target_arg = Path(os.environ["MEDORBITS_SCHEMA_TARGET"])
strict = os.environ.get("MEDORBITS_SCHEMA_STRICT") == "1"

def inside_root(path):
    try:
        path.resolve().relative_to(root)
        return True
    except (ValueError, OSError, RuntimeError):
        return False

target = target_arg if target_arg.is_absolute() else root / target_arg

if not inside_root(target):
    print("ERROR: target must remain inside the repository")
    sys.exit(2)

target = target.resolve()

if not target.exists():
    print(f"ERROR: target does not exist: {target_arg}")
    sys.exit(2)

if target.is_file():
    json_files = [target] if target.suffix.lower() == ".json" else []
    scan_root = target.parent
else:
    scan_root = target
    excluded = {
        ".git", "node_modules", ".venv", "venv",
        "__pycache__", "dist", "build", "coverage",
    }
    json_files = []
    for directory, dirs, names in os.walk(scan_root, followlinks=False):
        base = Path(directory)
        dirs[:] = [
            name for name in dirs
            if name not in excluded and not (base / name).is_symlink()
        ]
        for name in names:
            path = base / name
            if path.is_symlink():
                continue
            if path.suffix.lower() == ".json" and path.is_file():
                json_files.append(path)

def rel(path):
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)

errors = []
warnings = []
parsed = {}
schema_files = []

def reject_duplicates(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key!r}")
        result[key] = value
    return result

def reject_constants(value):
    raise ValueError(f"non-standard JSON constant: {value}")

for path in sorted(json_files):
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            data = json.load(
                stream,
                object_pairs_hook=reject_duplicates,
                parse_constant=reject_constants,
            )
        parsed[path.resolve()] = data

        if isinstance(data, dict) and (
            "$schema" in data or
            ("$id" in data and (
                "properties" in data or
                "type" in data or
                "$defs" in data or
                "definitions" in data
            ))
        ):
            schema_files.append(path.resolve())

    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        errors.append(f"{rel(path)}: {exc}")

print(f"JSON files discovered: {len(json_files)}")
print(f"JSON files parsed: {len(parsed)}")
print(f"Schema candidates: {len(schema_files)}")

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    jsonschema = None
    HAS_JSONSCHEMA = False

if not HAS_JSONSCHEMA:
    message = "Python package 'jsonschema' is unavailable; semantic schema validation skipped"
    if strict:
        errors.append(message)
    else:
        warnings.append(message)

# Check local file-based references without fetching remote resources.
for schema_path in schema_files:
    schema = parsed[schema_path]

    def walk_refs(value, pointer="$"):
        if isinstance(value, dict):
            ref = value.get("$ref")
            if isinstance(ref, str):
                base_ref, fragment = urldefrag(ref)
                if base_ref and not base_ref.startswith(("http://", "https://")):
                    decoded = unquote(base_ref)
                    ref_path = (schema_path.parent / decoded).resolve()

                    if not inside_root(ref_path):
                        errors.append(
                            f"{rel(schema_path)} {pointer}: $ref escapes repository: {ref}"
                        )
                    elif not ref_path.exists():
                        errors.append(
                            f"{rel(schema_path)} {pointer}: missing local $ref target: {ref}"
                        )
                    elif ref_path.is_file() and ref_path.suffix.lower() == ".json":
                        if ref_path not in parsed:
                            try:
                                with ref_path.open("r", encoding="utf-8-sig") as stream:
                                    json.load(stream)
                            except Exception as exc:
                                errors.append(
                                    f"{rel(ref_path)}: referenced JSON cannot be parsed: {exc}"
                                )

            for key, child in value.items():
                walk_refs(child, f"{pointer}/{key}")

        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk_refs(child, f"{pointer}/{index}")

    walk_refs(schema)

# Validate schema structures and compatible local data files when possible.
if HAS_JSONSCHEMA:
    for schema_path in schema_files:
        schema = parsed[schema_path]
        try:
            validator_cls = jsonschema.validators.validator_for(schema)
            validator_cls.check_schema(schema)
        except Exception as exc:
            errors.append(f"{rel(schema_path)}: invalid JSON Schema: {exc}")
            continue

        # Validate conventional adjacent data files only when names align.
        stem = schema_path.name
        candidates = {
            stem.replace(".schema.json", ".json"),
            stem.replace(".schema.json", ".data.json"),
            stem.replace(".schema.json", ".sample.json"),
        }
        for data_path in sorted(parsed):
            if data_path == schema_path or data_path.name not in candidates:
                continue
            try:
                validator = validator_cls(schema)
                issues = sorted(
                    validator.iter_errors(parsed[data_path]),
                    key=lambda error: list(error.absolute_path),
                )
                for issue in issues[:20]:
                    location = "/".join(map(str, issue.absolute_path)) or "$"
                    errors.append(
                        f"{rel(data_path)} against {rel(schema_path)} at {location}: "
                        f"{issue.message}"
                    )
                if len(issues) > 20:
                    warnings.append(
                        f"{rel(data_path)}: {len(issues) - 20} more validation errors omitted"
                    )
            except Exception as exc:
                errors.append(
                    f"{rel(data_path)} against {rel(schema_path)}: {exc}"
                )

for warning in warnings:
    print("WARN:", warning)

for error in errors:
    print("FAIL:", error)

print()
print(f"Summary: errors={len(errors)}, warnings={len(warnings)}")

if errors:
    sys.exit(1)

print("PASS: JSON and available schema checks completed.")
PY
