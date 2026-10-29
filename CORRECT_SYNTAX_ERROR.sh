
#!/usr/bin/env bash
# /CORRECT_SYNTAX_ERROR.sh
# MedOrbits repository syntax checker and safe repair utility.
# Usage:
#   bash CORRECT_SYNTAX_ERROR.sh
#   bash CORRECT_SYNTAX_ERROR.sh --fix
#   bash CORRECT_SYNTAX_ERROR.sh --fix --compile
#   bash CORRECT_SYNTAX_ERROR.sh --fix --commit

set -Eeuo pipefail
IFS=$'\n\t'

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

FIX=0
COMPILE=0
COMMIT=0
ERRORS=0
WARNINGS=0
FIXED=0
CHECKED=0

for arg in "$@"; do
  case "$arg" in
    --fix) FIX=1 ;;
    --compile) COMPILE=1 ;;
    --commit) COMMIT=1 ;;
    -h|--help)
      cat <<'HELP'
MedOrbits Syntax Repair

Options:
  --fix       Apply safe repairs and back up changed files.
  --compile   Compile all Python files after checking.
  --commit    Create a local Git commit if repairs were made.
  --help      Show this help.

Examples:
  bash CORRECT_SYNTAX_ERROR.sh
  bash CORRECT_SYNTAX_ERROR.sh --fix --compile
  bash CORRECT_SYNTAX_ERROR.sh --fix --compile --commit

This script does not push to a remote repository.
It does not automatically rewrite ambiguous source code.
HELP
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

BACKUP_DIR=".syntax-repair-backup/$(date +%Y%m%d-%H%M%S)"

say() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; WARNINGS=$((WARNINGS + 1)); }
fail() { printf 'ERROR: %s\n' "$*" >&2; ERRORS=$((ERRORS + 1)); }

backup_file() {
  local file="$1"
  mkdir -p "$BACKUP_DIR/$(dirname "$file")"
  cp -p "$file" "$BACKUP_DIR/$file"
}

is_ignored_path() {
  case "$1" in
    .git/*|node_modules/*|.venv/*|venv/*|__pycache__/*|\
    .syntax-repair-backup/*|dist/*|build/*|coverage/*)
      return 0 ;;
    *)
      return 1 ;;
  esac
}

safe_fix_file() {
  local file="$1"
  local tmp
  tmp="$(mktemp)"

  # Repair only common, unambiguous line-ending issues.
  if command -v python3 >/dev/null 2>&1; then
    if ! python3 - "$file" "$tmp" <<'PY'
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])

data = source.read_bytes()
data = data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
target.write_bytes(data)
PY
    then
      rm -f "$tmp"
      return 1
    fi

    if ! cmp -s "$file" "$tmp"; then
      backup_file "$file"
      cat "$tmp" > "$file"
      FIXED=$((FIXED + 1))
      printf 'Fixed line endings: %s\n' "$file"
    fi
  fi

  rm -f "$tmp"
}

check_python() {
  local file="$1"

  if ! command -v python3 >/dev/null 2>&1; then
    warn "python3 unavailable; skipped Python check: $file"
    return
  fi

  CHECKED=$((CHECKED + 1))

  # Detect JavaScript content incorrectly stored in a Python file.
  if grep -Eq '^[[:space:]]*use strict;|^[[:space:]]*const[[:space:]]+[A-Za-z_$]|^[[:space:]]*export[[:space:]]+(default|const|function|class)|^[[:space:]]*import[[:space:]].*from[[:space:]]' "$file"; then
    fail "Possible JavaScript saved as Python: $file"
    printf '  Inspect this file and move JavaScript to a .js file if appropriate.\n'
    return
  fi

  if python3 - "$file" <<'PY'
import ast
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    source = path.read_text(encoding="utf-8")
    ast.parse(source, filename=str(path))
except (SyntaxError, UnicodeDecodeError, ValueError) as exc:
    print(f"{path}: {exc}", file=sys.stderr)
    sys.exit(1)
PY
  then
    printf 'Python OK: %s\n' "$file"
  else
    fail "Python syntax error: $file"
  fi
}

check_json() {
  local file="$1"
  CHECKED=$((CHECKED + 1))

  if command -v python3 >/dev/null 2>&1; then
    if python3 -m json.tool "$file" >/dev/null 2>&1; then
      printf 'JSON OK: %s\n' "$file"
    else
      fail "Invalid JSON: $file"
      python3 -m json.tool "$file" >/dev/null 2>&1 || true
    fi
  elif command -v node >/dev/null 2>&1; then
    if node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$file"; then
      printf 'JSON OK: %s\n' "$file"
    else
      fail "Invalid JSON: $file"
    fi
  else
    warn "No Python or Node.js available; skipped JSON: $file"
  fi
}

check_javascript() {
  local file="$1"
  CHECKED=$((CHECKED + 1))

  if command -v node >/dev/null 2>&1; then
    if node --check "$file" >/dev/null 2>&1; then
      printf 'JavaScript OK: %s\n' "$file"
    else
      fail "JavaScript syntax error: $file"
      node --check "$file" 2>&1 || true
    fi
  else
    warn "Node.js unavailable; skipped JavaScript: $file"
  fi
}

check_yaml() {
  local file="$1"
  CHECKED=$((CHECKED + 1))

  if command -v ruby >/dev/null 2>&1; then
    if ruby -e 'require "yaml"; YAML.parse_file(ARGV[0])' "$file" >/dev/null 2>&1; then
      printf 'YAML OK: %s\n' "$file"
    else
      fail "Invalid YAML: $file"
      ruby -e 'require "yaml"; YAML.parse_file(ARGV[0])' "$file" 2>&1 || true
    fi
  elif command -v python3 >/dev/null 2>&1 && python3 -c 'import yaml' >/dev/null 2>&1; then
    if python3 - "$file" <<'PY'
import sys
import yaml
with open(sys.argv[1], encoding="utf-8") as f:
    list(yaml.safe_load_all(f))
PY
    then
      printf 'YAML OK: %s\n' "$file"
    else
      fail "Invalid YAML: $file"
    fi
  else
    warn "No YAML parser available; skipped: $file"
  fi
}

check_shell() {
  local file="$1"
  CHECKED=$((CHECKED + 1))

  if command -v bash >/dev/null 2>&1; then
    if bash -n "$file" 2>/dev/null; then
      printf 'Shell OK: %s\n' "$file"
    else
      fail "Shell syntax error: $file"
      bash -n "$file" 2>&1 || true
    fi
  fi
}

say "MedOrbits syntax audit"
printf 'Repository: %s\n' "$ROOT"
printf 'Safe line-ending repair: %s\n' "$([[ "$FIX" == 1 ]] && echo enabled || echo disabled)"

if [[ "$FIX" == 1 ]]; then
  say "Applying safe line-ending repairs"
  while IFS= read -r -d '' file; do
    is_ignored_path "$file" && continue
    safe_fix_file "$file" || warn "Could not normalize: $file"
  done < <(find . -type f \
    \( -name '*.py' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \
       -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \
       -o -name '*.sh' \) -print0)
fi

say "Checking source files"

while IFS= read -r -d '' file; do
  is_ignored_path "$file" && continue

  case "$file" in
    *.py) check_python "$file" ;;
    *.json) check_json "$file" ;;
    *.js|*.mjs|*.cjs)
      # CommonJS JavaScript is checked using Node's parser.
      check_javascript "$file"
      ;;
    *.yml|*.yaml) check_yaml "$file" ;;
    *.sh) check_shell "$file" ;;
  esac
done < <(find . -type f \
  \( -name '*.py' -o -name '*.js' -o -name '*.mjs' -o -name '*.cjs' \
     -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' \
     -o -name '*.sh' \) -print0)

if [[ "$COMPILE" == 1 ]]; then
  say "Compiling Python files"
  if command -v python3 >/dev/null 2>&1; then
    while IFS= read -r -d '' file; do
      is_ignored_path "$file" && continue
      if python3 -m py_compile "$file" 2>/dev/null; then
        printf 'Compiled: %s\n' "$file"
      else
        fail "Python compilation failed: $file"
      fi
    done < <(find . -type f -name '*.py' -print0)
  else
    warn "python3 unavailable; compilation skipped"
  fi
fi

if [[ "$COMMIT" == 1 ]]; then
  say "Preparing optional local commit"

  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    fail "Git repository not found; cannot commit"
  elif [[ "$FIXED" -eq 0 ]]; then
    warn "No automatic repairs were made; no commit created"
  else
    git add -- '*.py' '*.js' '*.mjs' '*.cjs' '*.json' '*.yml' '*.yaml' '*.sh' 2>/dev/null || true
    git add -- "$BACKUP_DIR" 2>/dev/null || true

    if git diff --cached --quiet; then
      warn "No staged changes to commit"
    else
      git commit -m "fix: normalize source syntax file line endings" || fail "Git commit failed"
    fi
  fi
fi

say "Summary"
printf 'Files checked: %s\n' "$CHECKED"
printf 'Automatic repairs: %s\n' "$FIXED"
printf 'Warnings: %s\n' "$WARNINGS"
printf 'Errors: %s\n' "$ERRORS"

if [[ "$FIXED" -gt 0 ]]; then
  printf 'Backups: %s\n' "$BACKUP_DIR"
fi

if [[ "$ERRORS" -gt 0 ]]; then
  printf '\nSome errors require manual correction. Review the first reported error in each file.\n' >&2
  exit 1
fi

printf '\nSyntax audit completed without detected errors.\n'
