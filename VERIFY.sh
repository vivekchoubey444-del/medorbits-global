
#!/usr/bin/env bash
# ==============================================================================
# MedOrbits -- Repository Verification Runner
# File: VERIFY.sh
# Version: 1.0.0
#
# Usage:
#   bash VERIFY.sh
#   bash VERIFY.sh --strict
#   bash VERIFY.sh --help
#
# Safety:
#   - Read-only verification.
#   - No dependency installation.
#   - No file deletion, overwriting, commits, pushes, or deployments.
#   - Does not execute discovered application scripts.
# ==============================================================================

set -Eeuo pipefail
IFS=$'\n\t'
umask 077

readonly ROOT="$(
    cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P
)"

STRICT=0
PASS=0
FAIL=0
WARN=0

log()  { printf '[VERIFY] %s\n' "$*"; }
pass() { ((PASS += 1)); log "PASS: $*"; }
fail() { ((FAIL += 1)); log "FAIL: $*" >&2; }
warn() { ((WARN += 1)); log "WARN: $*" >&2; }

usage() {
    cat <<'HELP'
MedOrbits Repository Verification

Usage:
  bash VERIFY.sh [--strict] [--help]

Options:
  --strict   Treat unavailable optional verification tools as failures.
  --help     Display this help.

Checks:
  - Git repository status
  - Python syntax
  - JSON syntax
  - JavaScript syntax (Node.js)
  - Local HTML references
  - Required project files
HELP
}

while (($#)); do
    case "$1" in
        --strict) STRICT=1 ;;
        --help|-h) usage; exit 0 ;;
        *) printf 'Unknown argument: %s\n' "$1" >&2; exit 2 ;;
    esac
    shift
done

command -v python3 >/dev/null 2>&1 || {
    printf 'Python 3 is required.\n' >&2
    exit 2
}

cd "$ROOT"

log "Repository: $ROOT"

if command -v git >/dev/null 2>&1 &&
   git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    pass "Git repository detected"

    if git -C "$ROOT" diff --check; then
        pass "Git whitespace and conflict-marker checks"
    else
        fail "Git diff --check"
    fi

    if [[ -n "$(git -C "$ROOT" ls-files -u)" ]]; then
        fail "Unresolved Git index conflicts exist"
    else
        pass "No unresolved Git index conflicts"
    fi
else
    warn "Git repository not detected"
    ((STRICT == 0)) || fail "Git is required in strict mode"
fi

python3 - "$ROOT" <<'PY'
import ast
import json
import os
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(sys.argv[1]).resolve()
excluded = {
    ".git", ".venv", "venv", "node_modules", "__pycache__",
    "dist", "build", "coverage", "vendor",
}
python_errors = []
json_errors = []
html_errors = []
python_count = 0
json_count = 0
html_count = 0

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("href", "src", "poster"):
            value = attrs.get(key)
            if value:
                self.values.append(value.strip())

def files():
    for directory, dirs, names in os.walk(root, followlinks=False):
        base = Path(directory)
        dirs[:] = [
            d for d in dirs
            if d not in excluded and not (base / d).is_symlink()
        ]
        for name in names:
            path = base / name
            if path.is_symlink():
                continue
            yield path

all_files = list(files())
known = {p.resolve() for p in all_files if p.is_file()}

for path in all_files:
    if not path.is_file():
        continue

    try:
        if path.suffix.lower() == ".py":
            python_count += 1
            ast.parse(
                path.read_bytes(),
                filename=str(path.relative_to(root)),
            )

        elif path.suffix.lower() == ".json":
            json_count += 1
            with path.open("r", encoding="utf-8-sig") as stream:
                json.load(stream, parse_constant=lambda value: (
                    (_ for _ in ()).throw(
                        ValueError(f"Non-standard JSON constant: {value}")
                    )
                ))

        elif path.suffix.lower() in {".html", ".htm"}:
            html_count += 1
            parser = Links()
            parser.feed(path.read_text(encoding="utf-8-sig", errors="replace"))

            for raw in parser.values:
                parts = urlsplit(raw)

                if parts.scheme or parts.netloc or raw.startswith(("#", "//")):
                    continue

                value = unquote(parts.path)
                if not value:
                    continue

                target = (
                    root / value.lstrip("/")
                    if value.startswith("/")
                    else path.parent / value
                )
                target = Path(os.path.abspath(target))

                try:
                    target.relative_to(root)
                except ValueError:
                    continue

                if target.is_dir():
                    target = target / "index.html"

                # Ignore non-page references outside the known repository.
                if not target.exists():
                    html_errors.append(
                        f"{path.relative_to(root)} -> {raw}"
                    )

    except (OSError, SyntaxError, UnicodeError, ValueError, json.JSONDecodeError) as exc:
        message = f"{path.relative_to(root)}: {exc}"

        if path.suffix.lower() == ".py":
            python_errors.append(message)
        elif path.suffix.lower() == ".json":
            json_errors.append(message)
        else:
            html_errors.append(message)

print(f"Python files checked: {python_count}")
for item in python_errors:
    print("PYTHON ERROR:", item)
print(f"Python syntax: {'PASS' if not python_errors else 'FAIL'}")

print(f"JSON files checked: {json_count}")
for item in json_errors:
    print("JSON ERROR:", item)
print(f"JSON validation: {'PASS' if not json_errors else 'FAIL'}")

print(f"HTML pages checked: {html_count}")
for item in html_errors[:100]:
    print("HTML REFERENCE WARNING:", item)
if len(html_errors) > 100:
    print(f"... {len(html_errors) - 100} more issues")
print(f"HTML reference check: {'PASS' if not html_errors else 'FAIL'}")

sys.exit(1 if python_errors or json_errors or html_errors else 0)
PY
status=$?

if ((status == 0)); then
    pass "Python, JSON, and HTML checks"
else
    fail "Python, JSON, or HTML checks reported errors"
fi

if command -v node >/dev/null 2>&1; then
    if node --input-type=commonjs - "$ROOT" <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(process.argv[2]);
const excluded = new Set([
  ".git", ".venv", "venv", "node_modules", "__pycache__",
  "dist", "build", "coverage", "vendor"
]);
const extensions = new Set([".js", ".cjs"]);
const errors = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && excluded.has(entry.name)) continue;

    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      checked++;
      try {
        new vm.Script(fs.readFileSync(full, "utf8"), {
          filename: path.relative(root, full)
        });
      } catch (error) {
        errors.push(`${path.relative(root, full)}: ${error.message}`);
      }
    }
  }
}

walk(root);
console.log(`JavaScript files checked: ${checked}`);
for (const error of errors) console.error("JS ERROR:", error);
process.exitCode = errors.length ? 1 : 0;
JS
    then
        pass "JavaScript syntax"
    else
        fail "JavaScript syntax"
    fi
else
    warn "Node.js unavailable; JavaScript syntax not checked"
    ((STRICT == 0)) || fail "Node.js required in strict mode"
fi

for required in index.html package.json; do
    if [[ -f "$ROOT/$required" ]]; then
        pass "Required file exists: $required"
    else
        warn "Expected file missing: $required"
        ((STRICT == 0)) || fail "Required file missing: $required"
    fi
done

printf '\n'
log "Summary: PASS=$PASS FAIL=$FAIL WARN=$WARN"

if ((FAIL > 0)); then
    exit 1
fi

exit 0
