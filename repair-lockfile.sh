#!/usr/bin/env bash
# MedOrbits root npm lockfile repair
# Run from the repository root: bash repair-lockfile.sh
# Requires Node.js and npm. Does not commit or push changes automatically.

set -Eeuo pipefail

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js is not installed or not on PATH."
command -v npm >/dev/null 2>&1 || fail "npm is not installed or not on PATH."

[[ -f package.json ]] || fail "package.json was not found in the current directory. Run this script from the repository root."

printf '%s\n' "== MedOrbits lockfile repair =="

node <<'NODE'
const fs = require('node:fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!p || typeof p !== 'object' || Array.isArray(p)) {
  throw new Error('Root package.json must contain a JSON object.');
}
console.log(`Package: ${p.name || '(name not set)'}`);
console.log(`Version: ${p.version || '(version not set)'}`);
NODE

printf '\n%s\n' "Generating package-lock.json from the current package.json..."
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

printf '\n%s\n' "Validating generated lockfile..."
node <<'NODE'
const fs = require('node:fs');

function readJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is missing or invalid JSON: ${error.message}`);
  }
}

const pkg = readJson('package.json');
const lock = readJson('package-lock.json');

if (lock.lockfileVersion !== 3) {
  throw new Error(`Expected lockfileVersion 3; got ${lock.lockfileVersion}.`);
}
if (pkg.name && lock.name !== pkg.name) {
  throw new Error(`Package name mismatch: package.json=${pkg.name}, lockfile=${lock.name}`);
}
if (pkg.version && lock.version !== pkg.version) {
  throw new Error(`Package version mismatch: package.json=${pkg.version}, lockfile=${lock.version}`);
}
if (!lock.packages || !lock.packages['']) {
  throw new Error('Lockfile is missing packages[""] root metadata.');
}

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  for (const name of Object.keys(pkg[section] || {})) {
    if (!lock.packages[`node_modules/${name}`]) {
      throw new Error(`Declared ${section} entry is not represented in the lockfile: ${name}`);
    }
  }
}

console.log('PASS: package-lock.json is valid and matches package.json metadata.');
NODE

printf '\n%s\n' "Lockfile generated and validated."
printf '%s\n' "Review and commit it with:"
printf '%s\n' "  git status --short"
printf '%s\n' "  git add package-lock.json"
printf '%s\n' '  git commit -m "fix: regenerate root npm lockfile"'
printf '%s\n' "  git push"
