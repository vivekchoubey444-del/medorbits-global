
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- JSON Validation Utility
 * File: scripts/validate-json.js
 *
 * Validates repository JSON files without modifying them.
 *
 * Features:
 * - Recursive JSON discovery
 * - UTF-8 BOM handling
 * - Empty-file detection
 * - Line, column, and error context
 * - Configurable directory exclusions
 * - CI-compatible exit codes
 * - No dependencies or network access
 *
 * Usage:
 *   node scripts/validate-json.js
 *   node scripts/validate-json.js --strict
 *   node scripts/validate-json.js --dir api/schemas
 *   node scripts/validate-json.js --help
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".wrangler",
  ".venv",
  "venv",
  "__pycache__",
]);

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
]);

const JSON_EXTENSIONS = new Set([".json"]);

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const HELP = args.includes("--help") || args.includes("-h");

function showHelp() {
  console.log(`
MedOrbits JSON Validator

Usage:
  node scripts/validate-json.js [options]

Options:
  --dir <path>  Validate a directory inside the repository
  --strict      Enable strict validation mode
  --help, -h    Display this help

The validator never modifies JSON files.
`);
}

function isInsideRoot(target) {
  const relative = path.relative(ROOT_DIR, target);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

function collectJsonFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (error) {
    console.error(
      `ERROR: Cannot read "${path.relative(ROOT_DIR, directory)}": ` +
      error.message
    );

    process.exitCode = 1;
    return results;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      // Skip hidden directories, but do not automatically ignore
      // JSON files simply because their parent directory is hidden.
      if (entry.isDirectory()) {
        continue;
      }
    }

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectJsonFiles(
          path.join(directory, entry.name),
          results
        );
      }

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (
      JSON_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
      !EXCLUDED_FILES.has(entry.name)
    ) {
      results.push(path.join(directory, entry.name));
    }
  }

  return results;
}

function locatePosition(source, position) {
  const safePosition = Math.max(
    0,
    Math.min(position, source.length)
  );

  const preceding = source.slice(0, safePosition);
  const lines = preceding.split(/\r\n|\r|\n/);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function extractErrorPosition(message) {
  const patterns = [
    /position\s+(\d+)/i,
    /at position\s+(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function printContext(source, position) {
  const start = Math.max(0, position - 45);
  const end = Math.min(source.length, position + 45);
  const context = source.slice(start, end);

  console.error(`  Context: ${JSON.stringify(context)}`);
}

function validateJsonFile(filePath) {
  const displayPath = path.relative(ROOT_DIR, filePath);

  let source;

  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(
      `FAIL ${displayPath}: unable to read file: ${error.message}`
    );

    return false;
  }

  // A UTF-8 BOM is not valid JSON text. Remove it before parsing.
  if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
  }

  if (source.trim().length === 0) {
    console.error(`FAIL ${displayPath}: file is empty.`);
    return false;
  }

  try {
    JSON.parse(source);
    console.log(`PASS ${displayPath}`);
    return true;
  } catch (error) {
    const position = extractErrorPosition(error.message);

    if (position !== null) {
      const location = locatePosition(source, position);

      console.error(
        `FAIL ${displayPath}:${location.line}:${location.column}`
      );

      printContext(source, position);
    } else {
      console.error(`FAIL ${displayPath}`);
    }

    console.error(`  ${error.message}`);
    return false;
  }
}

function main() {
  if (HELP) {
    showHelp();
    return 0;
  }

  const dirIndex = args.indexOf("--dir");
  let targetDirectory = ROOT_DIR;

  if (dirIndex !== -1) {
    const suppliedPath = args[dirIndex + 1];

    if (!suppliedPath || suppliedPath.startsWith("--")) {
      console.error("ERROR: --dir requires a directory path.");
      return 2;
    }

    targetDirectory = path.resolve(ROOT_DIR, suppliedPath);

    if (!isInsideRoot(targetDirectory)) {
      console.error(
        "ERROR: --dir must point inside the repository."
      );

      return 2;
    }

    if (
      !fs.existsSync(targetDirectory) ||
      !fs.statSync(targetDirectory).isDirectory()
    ) {
      console.error(
        `ERROR: Directory not found: ${path.relative(ROOT_DIR, targetDirectory)}`
      );

      return 2;
    }
  }

  const files = collectJsonFiles(targetDirectory);

  if (process.exitCode === 1) {
    return 1;
  }

  if (files.length === 0) {
    console.log("No JSON files found.");
    return 0;
  }

  console.log(`Validating ${files.length} JSON file(s)...\n`);

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    if (validateJsonFile(file)) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log("\nJSON Validation Summary");
  console.log("-----------------------");
  console.log(`Total:  ${files.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.error("\nJSON validation failed.");
    return 1;
  }

  console.log("\nAll JSON files are valid.");
  return 0;
}

process.exitCode = main();
