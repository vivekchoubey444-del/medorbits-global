#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
if [[ -f "$ROOT_DIR/package.json" ]] && command -v npm >/dev/null 2>&1; then
  if node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("node:fs");
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.exit(p.scripts && (p.scripts["docs"] || p.scripts["docs:build"] || p.scripts["build:docs"]) ? 0 : 1);
NODE
  then
    if node - "$ROOT_DIR/package.json" <<'NODE'
const fs = require("node:fs");
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const s = p.scripts || {};
console.log(s.docs ? "docs" : s["docs:build"] ? "docs:build" : "build:docs");
NODE
    then
      SCRIPT_NAME="$(node - "$ROOT_DIR/package.json" <<'NODE'
const p = require(process.argv[2]); const s=p.scripts||{};
process.stdout.write(s.docs ? "docs" : s["docs:build"] ? "docs:build" : "build:docs");
NODE
)"
      cd "$ROOT_DIR"; exec npm run "$SCRIPT_NAME"
    fi
  fi
fi
echo "[ERROR] No docs build script found in package.json." >&2
echo "Add a documented docs/docs:build/build:docs npm script, then rerun." >&2
exit 2
