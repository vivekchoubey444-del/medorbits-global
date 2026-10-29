
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits JSON Validator
 * File: tools/validate-json.js
 *
 * Usage:
 *   node tools/validate-json.js
 *   node tools/validate-json.js assets/data/news.json
 *
 * Read-only: never rewrites or deletes files.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const EXCLUDED = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "vendor",
  "__pycache__",
  ".next",
  "dist",
  "build",
  "coverage"
]);

function collectJsonFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    console.error(`[ERROR] Cannot read ${directory}: ${error.message}`);
    return results;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && EXCLUDED.has(entry.name)) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectJsonFiles(fullPath, results);
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".json")
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function validateJson(file) {
  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    return {
      ok: false,
      message: `Cannot read file: ${error.message}`
    };
  }

  try {
    JSON.parse(source);
    return { ok: true };
  } catch (error) {
    const match = /position\s+(\d+)/i.exec(error.message);

    if (!match) {
      return { ok: false, message: error.message };
    }

    const position = Number(match[1]);
    const beforeError = source.slice(0, position);
    const lines = beforeError.split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return {
      ok: false,
      message: `${error.message} (line ${line}, column ${column})`
    };
  }
}

function main() {
  const requested = process.argv.slice(2);
  let files;

  if (requested.length > 0) {
    files = requested.map(file => path.resolve(ROOT, file));
  } else {
    files = collectJsonFiles(ROOT);
  }

  files = [...new Set(files)].sort();

  if (files.length === 0) {
    console.error("[ERROR] No JSON files found.");
    process.exitCode = 1;
    return;
  }

  let failures = 0;

  for (const file of files) {
    const relative = path.relative(ROOT, file);

    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      console.error(`[FAIL] ${relative}: file not found.`);
      failures += 1;
      continue;
    }

    const result = validateJson(file);

    if (result.ok) {
      console.log(`[PASS] ${relative}`);
    } else {
      console.error(`[FAIL] ${relative}: ${result.message}`);
      failures += 1;
    }
  }

  console.log(`\nJSON files checked: ${files.length}`);
  console.log(`Failures: ${failures}`);

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("All JSON files passed syntax validation.");
}

main();
