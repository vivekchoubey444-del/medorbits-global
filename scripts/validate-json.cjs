#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "dist",
  "build",
  "coverage",
]);

const errors = [];
let validated = 0;

function walk(directory) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(`${directory}: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") &&
        entry.name !== ".well-known") {
      // Preserve hidden configuration files; skip hidden directories.
      if (entry.isDirectory()) continue;
    }

    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) {
      continue;
    }

    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(file);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    validateFile(file);
  }
}

function validateFile(file) {
  let source;

  try {
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    errors.push(`${file}: cannot read file: ${error.message}`);
    return;
  }

  // Remove a UTF-8 BOM if present; JSON.parse rejects it.
  if (source.charCodeAt(0) === 0xFEFF) {
    source = source.slice(1);
  }

  if (!source.trim()) {
    errors.push(`${file}: file is empty`);
    return;
  }

  try {
    JSON.parse(source);
    validated++;
    console.log(`PASS: ${path.relative(ROOT, file)}`);
  } catch (error) {
    errors.push(`${file}: ${error.message}`);

    const match = /position\s+(\d+)/i.exec(error.message);

    if (match) {
      const position = Number(match[1]);
      const before = source.slice(0, position);
      const line = before.split("\n").length;
      const column = position - before.lastIndexOf("\n");

      console.error(
        `  Location: line ${line}, column ${column}`
      );

      console.error(
        `  Context: ${JSON.stringify(
          source.slice(Math.max(0, position - 50), position + 50)
        )}`
      );
    }
  }
}

console.log("MedOrbits JSON validation\n");
walk(ROOT);

console.log(`\nValidated ${validated} JSON file(s).`);
console.log(`Errors: ${errors.length}`);

if (errors.length) {
  for (const error of errors) {
    console.error(`FAIL: ${error}`);
  }

  process.exitCode = 1;
} else {
  console.log("All JSON files are valid.");
}
