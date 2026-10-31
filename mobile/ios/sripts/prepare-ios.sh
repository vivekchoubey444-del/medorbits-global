#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "ERROR: iOS native project generation requires macOS and Xcode." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js is required." >&2; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo "ERROR: Install Xcode and its command-line tools." >&2; exit 1; }

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run stage:web
if [[ ! -d ios/App ]]; then
  npx cap add ios
else
  echo "Existing ios/App detected; leaving it intact."
fi
npx cap sync ios
npx cap open ios
