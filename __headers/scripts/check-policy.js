
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const REQUIRED_FILES = [
  "package.json",
  "vercel/headers.fragment.json",
  "vercel/vercel.config.json",
  "vercel/security-policy.json",
  "vercel/validate-headers.js",
  "vercel/deployment-checklist.md"
];

let errors = 0;

function checkFile(relativePath) {
  const fullPath = path.join(ROOT, relativePath);

  if (!fs.existsSync(fullPath)) {
    console.error(`[MISSING] ${relativePath}`);
    errors++;
    return false;
  }

  console.log(`[FOUND] ${relativePath}`);
  return true;
}

function checkJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);

  if (!fs.existsSync(fullPath)) return;

  try {
    JSON.parse(fs.readFileSync(fullPath, "utf8"));
    console.log(`[VALID JSON] ${relativePath}`);
  } catch (error) {
    console.error(`[INVALID JSON] ${relativePath}: ${error.message}`);
    errors++;
  }
}

function main() {
  console.log("\nMedOrbits Headers Policy Check\n");

  for (const file of REQUIRED_FILES) {
    checkFile(file);
  }

  checkJson("package.json");
  checkJson("vercel/headers.fragment.json");
  checkJson("vercel/vercel.config.json");
  checkJson("vercel/security-policy.json");

  console.log("\n--------------------------------");
  console.log(`Errors: ${errors}`);
  console.log("--------------------------------");

  if (errors > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("MedOrbits header policy checks passed.");
}

main();
