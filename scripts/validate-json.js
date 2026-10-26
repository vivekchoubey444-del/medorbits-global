
"use strict";

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
]);

const EXCLUDED_FILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
]);

const JSON_EXTENSIONS = new Set([".json"]);

function collectJsonFiles(directory, results = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    console.error(
      `ERROR: Cannot read directory "${directory}": ${error.message}`
    );
    process.exitCode = 1;
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectJsonFiles(fullPath, results);
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
      results.push(fullPath);
    }
  }

  return results;
}

function getErrorPosition(source, position) {
  const safePosition = Math.max(0, Math.min(position, source.length));
  const precedingText = source.slice(0, safePosition);
  const lines = precedingText.split(/\r\n|\r|\n/);

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

function validateJsonFile(filePath) {
  let source;

  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error(
      `FAIL ${path.relative(ROOT_DIR, filePath)}: ${error.message}`
    );
    return false;
  }

  try {
    JSON.parse(source);
    console.log(`PASS ${path.relative(ROOT_DIR, filePath)}`);
    return true;
  } catch (error) {
    const match = error.message.match(/position\s+(\d+)/i);

    if (match) {
      const { line, column } = getErrorPosition(
        source,
        Number(match[1])
      );

      console.error(
        `FAIL ${path.relative(ROOT_DIR, filePath)}:${line}:${column}`
      );
      console.error(`  ${error.message}`);
    } else {
      console.error(
        `FAIL ${path.relative(ROOT_DIR, filePath)}`
      );
      console.error(`  ${error.message}`);
    }

    return false;
  }
}

function main() {
  const files = collectJsonFiles(ROOT_DIR);

  if (files.length === 0) {
    console.log("No JSON files found.");
    return;
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

  console.log("\nJSON validation summary");
  console.log(`Total:  ${files.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
    console.error("\nJSON validation failed.");
  } else {
    console.log("\nAll JSON files are valid.");
  }
}

main();
