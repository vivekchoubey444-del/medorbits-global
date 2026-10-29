
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits Repository Compatibility Check
 * File: tools/compatible-share.js
 *
 * Read-only validation. No files are deleted or overwritten.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "package.json",
  "assets/data/news.json"
];

function checkFile(relativePath) {
  const fullPath = path.join(ROOT, relativePath);

  try {
    if (!fs.existsSync(fullPath)) {
      console.error(`[MISSING] ${relativePath}`);
      return false;
    }

    if (!fs.statSync(fullPath).isFile()) {
      console.error(`[INVALID] ${relativePath} is not a file.`);
      return false;
    }

    console.log(`[PASS] ${relativePath}`);
    return true;
  } catch (error) {
    console.error(`[ERROR] ${relativePath}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log("MedOrbits compatibility validation");
  console.log(`Repository: ${ROOT}`);

  let passed = 0;

  for (const relativePath of REQUIRED_FILES) {
    if (checkFile(relativePath)) passed += 1;
  }

  console.log(`\nResult: ${passed}/${REQUIRED_FILES.length} files verified.`);

  if (passed !== REQUIRED_FILES.length) {
    process.exitCode = 1;
    console.error("Create or restore the missing files before continuing.");
    return;
  }

  console.log("Compatibility validation passed.");
}

main();
