
#!/usr/bin/env node

/**
 * MedOrbits JSON Validator
 * File: tools/validate-json.js
 * Version: 2.0.0
 *
 * Usage:
 *   node tools/validate-json.js
 *   node tools/validate-json.js assets/data/news.json
 *   node tools/validate-json.js package.json package-lock.json
 *
 * Options:
 *   --help       Show help.
 *   --version    Show version.
 *
 * Safety:
 *   - Read-only; never modifies or deletes files.
 *   - Does not install dependencies.
 *   - Does not execute application code.
 *   - Does not follow symbolic links.
 *   - Explicit file paths must remain inside the repository.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT = path.resolve(SCRIPT_DIR, "..");

const VERSION = "2.0.0";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EXCLUDED = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "vendor",
  "__pycache__",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".turbo",
  ".cache"
]);

let checked = 0;
let passed = 0;
let failed = 0;
let skipped = 0;

const failures = [];

function printHelp() {
  console.log(`
MedOrbits JSON Validator v${VERSION}

Usage:
  node tools/validate-json.js
  node tools/validate-json.js <file.json> [more-files.json]

Options:
  --help       Display this help message.
  --version    Display version information.

Behavior:
  - Validates JSON syntax using the native JSON parser.
  - Scans the repository when no file paths are supplied.
  - Rejects symbolic links and paths outside the repository.
  - Skips excluded dependency and generated directories.
  - Never modifies source files.
`);
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function isInsideRoot(file) {
  const relative = path.relative(ROOT, file);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function reportPass(file) {
  passed += 1;
  checked += 1;

  console.log(`[PASS] ${relativePath(file)}`);
}

function reportFailure(file, message) {
  failed += 1;
  checked += 1;

  const relative = relativePath(file);
  const description = `${relative}: ${message}`;

  failures.push(description);

  console.error(`[FAIL] ${description}`);
}

function reportSkip(message) {
  skipped += 1;
  console.log(`[SKIP] ${message}`);
}

function reportError(message) {
  failed += 1;
  failures.push(message);

  console.error(`[ERROR] ${message}`);
}

function getLocation(source, position) {
  const safePosition = Math.max(
    0,
    Math.min(position, source.length)
  );

  const before = source.slice(0, safePosition);
  const lines = before.split("\n");

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function getJsonErrorLocation(error, source) {
  const message = String(error.message || error);

  // Node.js error formats commonly contain "position N".
  const positionMatch = message.match(/position\s+(\d+)/i);

  if (positionMatch) {
    const location = getLocation(
      source,
      Number(positionMatch[1])
    );

    return `line ${location.line}, column ${location.column}`;
  }

  // Some runtimes report a line and column directly.
  const lineMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (lineMatch) {
    return `line ${lineMatch[1]}, column ${lineMatch[2]}`;
  }

  return null;
}

function validateJson(file) {
  let stat;

  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    return {
      ok: false,
      message: `Cannot inspect file: ${error.message}`
    };
  }

  if (stat.isSymbolicLink()) {
    return {
      ok: false,
      message: "Symbolic links are not permitted."
    };
  }

  if (!stat.isFile()) {
    return {
      ok: false,
      message: "Path is not a regular file."
    };
  }

  if (stat.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      message: `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB size limit.`
    };
  }

  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    return {
      ok: false,
      message: `Cannot read file: ${error.message}`
    };
  }

  // Reject a UTF-8 BOM explicitly instead of silently altering input.
  if (source.charCodeAt(0) === 0xFEFF) {
    return {
      ok: false,
      message: "UTF-8 BOM detected. Save the JSON file without a BOM."
    };
  }

  try {
    JSON.parse(source);

    return { ok: true };
  } catch (error) {
    const location = getJsonErrorLocation(error, source);

    return {
      ok: false,
      message: location
        ? `${error.message} (${location})`
        : error.message
    };
  }
}

function collectJsonFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true
    });
  } catch (error) {
    reportError(
      `Cannot read directory ${relativePath(directory)}: ${error.message}`
    );

    return results;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED.has(entry.name)) {
        continue;
      }

      collectJsonFiles(fullPath, results);
      continue;
    }

    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".json")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function resolveRequestedFiles(requested) {
  const files = [];

  for (const argument of requested) {
    const resolved = path.resolve(ROOT, argument);

    if (!isInsideRoot(resolved)) {
      reportError(
        `Path outside repository rejected: ${argument}`
      );
      continue;
    }

    let stat;

    try {
      stat = fs.lstatSync(resolved);
    } catch (error) {
      reportError(
        `${argument}: Cannot access requested path: ${error.message}`
      );
      continue;
    }

    if (stat.isSymbolicLink()) {
      reportError(
        `${argument}: Symbolic links are not permitted.`
      );
      continue;
    }

    if (!stat.isFile()) {
      reportError(
        `${argument}: Expected a regular JSON file.`
      );
      continue;
    }

    if (!resolved.toLowerCase().endsWith(".json")) {
      reportError(
        `${argument}: File extension must be .json.`
      );
      continue;
    }

    files.push(resolved);
  }

  return files;
}

function main() {
  const argumentsList = process.argv.slice(2);

  if (argumentsList.includes("--help") || argumentsList.includes("-h")) {
    printHelp();
    return;
  }

  if (argumentsList.includes("--version")) {
    console.log(`MedOrbits JSON Validator v${VERSION}`);
    return;
  }

  if (argumentsList.some(arg => arg.startsWith("--"))) {
    reportError("Unknown option supplied.");
    printHelp();
    process.exitCode = 2;
    return;
  }

  let files;

  if (argumentsList.length > 0) {
    files = resolveRequestedFiles(argumentsList);
  } else {
    files = collectJsonFiles(ROOT);
  }

  files = [...new Set(files)].sort();

  if (files.length === 0) {
    if (failed === 0) {
      reportSkip("No JSON files found.");
    }
  }

  for (const file of files) {
    const result = validateJson(file);

    if (result.ok) {
      reportPass(file);
    } else {
      reportFailure(file, result.message);
    }
  }

  console.log("");
  console.log("============================================================");
  console.log("MedOrbits JSON Validation Summary");
  console.log("============================================================");
  console.log(`Repository: ${ROOT}`);
  console.log(`Version:    ${VERSION}`);
  console.log(`Checked:    ${checked}`);
  console.log(`Passed:     ${passed}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Skipped:    ${skipped}`);
  console.log("============================================================");

  if (failures.length > 0) {
    console.error("\nFailure details:");

    for (const failure of failures) {
      console.error(` - ${failure}`);
    }

    console.error("\n[RESULT] JSON VALIDATION FAILED");
    process.exitCode = 1;
    return;
  }

  if (skipped > 0) {
    console.log("[RESULT] Completed with skipped items.");
  } else {
    console.log("[RESULT] All discovered JSON files passed syntax validation.");
  }
}

main();
