#!/usr/bin/env node
"use strict";

/**
 * MedOrbits Package Lock Validator
 * File: tools/repair-package-lock.js
 *
 * Safe behavior:
 * - Validates package.json and package-lock.json.
 * - Detects empty, malformed, or incompatible lockfiles.
 * - Does not delete files, install dependencies, or rewrite the lockfile.
 * - Exits non-zero when a repair is required.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_FILE = path.join(ROOT, "package.json");
const LOCK_FILE = path.join(ROOT, "package-lock.json");

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
}

function readJson(file) {
  if (!fs.existsSync(file)) {
    fail(`Required file is missing: ${path.relative(ROOT, file)}`);
    return null;
  }

  let content;

  try {
    content = fs.readFileSync(file, "utf8");
  } catch (error) {
    fail(`Cannot read ${path.relative(ROOT, file)}: ${error.message}`);
    return null;
  }

  if (!content.trim()) {
    fail(`${path.relative(ROOT, file)} is empty.`);
    return null;
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    fail(`Invalid JSON in ${path.relative(ROOT, file)}: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function main() {
  console.log("MedOrbits package-lock validation");
  console.log(`Repository: ${ROOT}`);

  const manifest = readJson(PACKAGE_FILE);
  const lock = readJson(LOCK_FILE);

  if (!manifest || !lock || process.exitCode) {
    console.error(
      "\nValidation failed. Correct the reported file before running npm ci."
    );
    return;
  }

  if (!isObject(manifest)) {
    fail("package.json must contain a JSON object.");
    return;
  }

  if (!isObject(lock)) {
    fail("package-lock.json must contain a JSON object.");
    return;
  }

  if (typeof manifest.name !== "string" || !manifest.name.trim()) {
    fail('package.json must have a non-empty "name" field.');
  }

  if (
    manifest.scripts !== undefined &&
    !isObject(manifest.scripts)
  ) {
    fail('package.json "scripts" must be an object.');
  }

  const version = lock.lockfileVersion;

  if (![2, 3].includes(version)) {
    fail(
      `Unsupported or missing lockfileVersion: ${String(version)}. ` +
      "Generate a real npm lockfile using a compatible npm version."
    );
  }

  if (version >= 2) {
    if (!isObject(lock.packages)) {
      fail('package-lock.json must contain a "packages" object.');
    } else if (!isObject(lock.packages[""])) {
      fail('package-lock.json must contain a valid packages[""] entry.');
    } else {
      const root = lock.packages[""];

      for (const key of ["name", "version"]) {
        if (
          manifest[key] !== undefined &&
          root[key] !== undefined &&
          manifest[key] !== root[key]
        ) {
          fail(
            `package.json "${key}" does not match packages[""]."${key}" ` +
            "in package-lock.json."
          );
        }
      }

      for (const section of [
        "dependencies",
        "devDependencies",
        "optionalDependencies"
      ]) {
        if (
          manifest[section] !== undefined &&
          !isObject(manifest[section])
        ) {
          fail(`package.json "${section}" must be an object.`);
        }
      }
    }
  }

  if (process.exitCode) {
    console.error(
      "\nValidation failed. The lockfile was not changed. " +
      "Regenerate it before using npm ci."
    );
    return;
  }

  console.log("[PASS] package.json");
  console.log("[PASS] package-lock.json");
  console.log(`Lockfile version: ${version}`);
  console.log("Package-lock validation completed successfully.");
}

main();
