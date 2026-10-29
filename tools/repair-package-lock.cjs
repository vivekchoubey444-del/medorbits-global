
#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${path.basename(file)} is invalid: ${error.message}`);
  }
}

if (!fs.existsSync(packagePath)) {
  console.error("ERROR: package.json not found in the current directory.");
  process.exit(1);
}

const pkg = readJson(packagePath);

if (!pkg.name || !pkg.version) {
  console.error("ERROR: package.json must contain name and version.");
  process.exit(1);
}

if (fs.existsSync(lockPath)) {
  try {
    readJson(lockPath);
    console.log("package-lock.json is valid JSON.");
    console.log("No repair was necessary. Check lockfile compatibility next.");
    process.exit(0);
  } catch (error) {
    console.log(error.message);
  }

  const backupPath = `${lockPath}.invalid-backup`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(lockPath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  }

  console.log(
    "The lockfile is malformed. Use npm to regenerate it; " +
    "this script will not invent dependency resolutions."
  );
  console.log(
    "Run: npm install --package-lock-only --ignore-scripts --no-audit --no-fund"
  );
  process.exitCode = 2;
} else {
  console.log("package-lock.json is missing.");
  console.log(
    "Run: npm install --package-lock-only --ignore-scripts --no-audit --no-fund"
  );
  process.exitCode = 2;
}
