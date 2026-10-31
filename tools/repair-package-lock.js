
#!/usr/bin/env node

/**
 * =============================================================================
 * MedOrbits Package Lock Validator
 * File: tools/repair-package-lock.js
 * Version: 2.0.0
 *
 * Purpose:
 *   Validate package.json and package-lock.json before npm ci.
 *
 * Features:
 *   - Native ES module compatibility.
 *   - Supports npm lockfile versions 1, 2 and 3.
 *   - Detects missing, empty, malformed and incompatible manifests.
 *   - Checks package metadata and dependency declarations.
 *   - Rejects symbolic-link manifest files.
 *   - Provides actionable validation errors.
 *
 * Safety:
 *   - Read-only.
 *   - Does not delete files.
 *   - Does not install dependencies.
 *   - Does not generate or rewrite lockfiles.
 *   - Does not execute package scripts.
 * =============================================================================
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

const VERSION = "2.0.0";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const PACKAGE_FILE = path.join(ROOT, "package.json");
const LOCK_FILE = path.join(ROOT, "package-lock.json");

const FILES = [
  {
    label: "package.json",
    path: PACKAGE_FILE
  },
  {
    label: "package-lock.json",
    path: LOCK_FILE
  }
];

const SUPPORTED_LOCK_VERSIONS = new Set([1, 2, 3]);

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies"
];

// -----------------------------------------------------------------------------
// RESULT TRACKING
// -----------------------------------------------------------------------------

const errors = [];
const warnings = [];

let checksPassed = 0;

function pass(message) {
  checksPassed++;
  console.log(`[PASS] ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.warn(`[WARN] ${message}`);
}

function fail(message) {
  errors.push(message);
  console.error(`[FAIL] ${message}`);
}

function section(message) {
  console.log(`\n${message}`);
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// -----------------------------------------------------------------------------
// SAFE FILE READING
// -----------------------------------------------------------------------------

function readJson(file) {
  const label = relativePath(file);

  try {
    const stat = fs.lstatSync(file);

    if (stat.isSymbolicLink()) {
      fail(`${label} must not be a symbolic link.`);
      return null;
    }

    if (!stat.isFile()) {
      fail(`${label} is not a regular file.`);
      return null;
    }

    const content = fs.readFileSync(file, "utf8");

    if (!content.trim()) {
      fail(`${label} is empty.`);
      return null;
    }

    // Remove a single optional UTF-8 BOM.
    const normalized = content.replace(/^\uFEFF/, "");

    let parsed;

    try {
      parsed = JSON.parse(normalized);
    } catch (error) {
      fail(`Invalid JSON in ${label}: ${error.message}`);
      return null;
    }

    if (!isObject(parsed)) {
      fail(`${label} must contain a JSON object.`);
      return null;
    }

    pass(`${label} is readable and contains valid JSON.`);

    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") {
      fail(`Required file is missing: ${label}`);
    } else {
      fail(`Cannot read ${label}: ${error.message}`);
    }

    return null;
  }
}

// -----------------------------------------------------------------------------
// PACKAGE MANIFEST VALIDATION
// -----------------------------------------------------------------------------

function validatePackageManifest(manifest) {
  section("PACKAGE MANIFEST VALIDATION");

  if (!manifest) {
    return false;
  }

  let valid = true;

  if (!isNonEmptyString(manifest.name)) {
    fail('package.json requires a non-empty "name" field.');
    valid = false;
  } else {
    pass(`Package name: ${manifest.name}`);
  }

  if (
    manifest.version !== undefined &&
    !isNonEmptyString(manifest.version)
  ) {
    fail('package.json "version" must be a non-empty string.');
    valid = false;
  } else if (manifest.version) {
    pass(`Package version: ${manifest.version}`);
  }

  for (const sectionName of [
    "scripts",
    ...DEPENDENCY_SECTIONS,
    "peerDependencies",
    "overrides",
    "resolutions"
  ]) {
    if (
      manifest[sectionName] !== undefined &&
      !isObject(manifest[sectionName])
    ) {
      fail(`package.json "${sectionName}" must be an object.`);
      valid = false;
    }
  }

  if (manifest.engines !== undefined && !isObject(manifest.engines)) {
    fail('package.json "engines" must be an object.');
    valid = false;
  }

  if (manifest.packageManager !== undefined) {
    if (!isNonEmptyString(manifest.packageManager)) {
      fail('"packageManager" must be a non-empty string.');
      valid = false;
    } else {
      pass(`Package manager: ${manifest.packageManager}`);
    }
  }

  if (valid) {
    pass("package.json structure is valid.");
  }

  return valid;
}

// -----------------------------------------------------------------------------
// DEPENDENCY VALIDATION
// -----------------------------------------------------------------------------

function validateDependencySections(manifest) {
  let valid = true;

  for (const sectionName of DEPENDENCY_SECTIONS) {
    const sectionData = manifest[sectionName];

    if (sectionData === undefined) {
      continue;
    }

    if (!isObject(sectionData)) {
      valid = false;
      continue;
    }

    for (const [name, specification] of Object.entries(sectionData)) {
      if (!isNonEmptyString(name)) {
        fail(`Invalid dependency name in ${sectionName}.`);
        valid = false;
      }

      if (!isNonEmptyString(specification)) {
        fail(
          `Invalid dependency specification: ${sectionName}.${name}`
        );
        valid = false;
      }
    }
  }

  if (valid) {
    pass("Dependency declarations have valid structures.");
  }

  return valid;
}

// -----------------------------------------------------------------------------
// LOCKFILE METADATA
// -----------------------------------------------------------------------------

function validateLockMetadata(manifest, lock) {
  section("LOCKFILE METADATA VALIDATION");

  let valid = true;

  const lockVersion = lock.lockfileVersion;

  if (
    !Number.isInteger(lockVersion) ||
    !SUPPORTED_LOCK_VERSIONS.has(lockVersion)
  ) {
    fail(
      `Unsupported or missing lockfileVersion: ${String(lockVersion)}. ` +
      "Supported versions: 1, 2 and 3."
    );

    return false;
  }

  pass(`Lockfile version: ${lockVersion}`);

  if (
    lock.name !== undefined &&
    manifest.name !== undefined &&
    lock.name !== manifest.name
  ) {
    fail("package.json name does not match package-lock.json name.");
    valid = false;
  }

  if (
    lock.version !== undefined &&
    manifest.version !== undefined &&
    lock.version !== manifest.version
  ) {
    fail("package.json version does not match package-lock.json version.");
    valid = false;
  }

  if (lockVersion >= 2) {
    if (!isObject(lock.packages)) {
      fail('Lockfile must contain a "packages" object.');
      return false;
    }

    if (!isObject(lock.packages[""])) {
      fail('Lockfile must contain a valid packages[""] root entry.');
      return false;
    }

    const rootPackage = lock.packages[""];

    for (const key of ["name", "version"]) {
      if (
        manifest[key] !== undefined &&
        rootPackage[key] !== undefined &&
        manifest[key] !== rootPackage[key]
      ) {
        fail(
          `package.json "${key}" does not match packages[""]."${key}".`
        );
        valid = false;
      }
    }

    if (
      rootPackage.dependencies !== undefined &&
      !isObject(rootPackage.dependencies)
    ) {
      fail('packages[""].dependencies must be an object.');
      valid = false;
    }

    if (
      rootPackage.devDependencies !== undefined &&
      !isObject(rootPackage.devDependencies)
    ) {
      fail('packages[""].devDependencies must be an object.');
      valid = false;
    }

    if (
      rootPackage.optionalDependencies !== undefined &&
      !isObject(rootPackage.optionalDependencies)
    ) {
      fail('packages[""].optionalDependencies must be an object.');
      valid = false;
    }

    for (const sectionName of DEPENDENCY_SECTIONS) {
      const declared = manifest[sectionName] || {};
      const locked = rootPackage[sectionName] || {};

      if (!isObject(locked)) {
        continue;
      }

      for (const [name, specification] of Object.entries(declared)) {
        if (!hasOwn(locked, name)) {
          fail(
            `Lockfile root entry is missing ${sectionName}.${name}.`
          );
          valid = false;
          continue;
        }

        if (locked[name] !== specification) {
          fail(
            `Dependency specification mismatch: ${sectionName}.${name}.`
          );
          valid = false;
        }
      }

      for (const name of Object.keys(locked)) {
        if (!hasOwn(declared, name)) {
          fail(
            `Lockfile contains undeclared root dependency: ${sectionName}.${name}.`
          );
          valid = false;
        }
      }
    }
  } else {
    // Lockfile v1 does not have the packages[""] metadata structure.
    if (
      lock.dependencies !== undefined &&
      !isObject(lock.dependencies)
    ) {
      fail('Version 1 lockfile "dependencies" must be an object.');
      valid = false;
    }

    if (!isObject(lock.dependencies)) {
      warn(
        "Version 1 lockfile has no dependency tree. " +
        "Verify compatibility with your installed npm version."
      );
    }
  }

  if (valid) {
    pass("Lockfile metadata is consistent with package.json.");
  }

  return valid;
}

// -----------------------------------------------------------------------------
// LOCKFILE STRUCTURE
// -----------------------------------------------------------------------------

function validateLockStructure(lock) {
  section("LOCKFILE STRUCTURE VALIDATION");

  let valid = true;

  if (lock.lockfileVersion >= 2) {
    const packages = lock.packages;

    for (const [packagePath, metadata] of Object.entries(packages)) {
      if (!isObject(metadata)) {
        fail(`Invalid package metadata at packages["${packagePath}"].`);
        valid = false;
      }
    }

    if (valid) {
      pass(`Validated ${Object.keys(packages).length} lockfile package entries.`);
    }
  }

  if (lock.dependencies !== undefined && !isObject(lock.dependencies)) {
    fail('Lockfile "dependencies" must be an object.');
    valid = false;
  }

  if (valid) {
    pass("Lockfile structure is valid.");
  }

  return valid;
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------

function printSummary() {
  section("VALIDATION SUMMARY");

  console.log(`Version: ${VERSION}`);
  console.log(`Passed: ${checksPassed}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Errors: ${errors.length}`);

  if (warnings.length > 0) {
    console.warn("\nWarnings:");

    for (const message of warnings) {
      console.warn(`  - ${message}`);
    }
  }

  if (errors.length > 0) {
    console.error("\nValidation failed:");

    for (const message of errors) {
      console.error(`  - ${message}`);
    }

    console.error(
      "\nCorrect the reported issues before running npm ci."
    );

    console.error("The validator did not modify either file.");

    process.exitCode = 1;
    return;
  }

  console.log("\n[PASS] package.json");
  console.log("[PASS] package-lock.json");
  console.log("[PASS] Lockfile validation completed successfully.");
  console.log("[INFO] No files were modified.");
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

function main() {
  console.log("MedOrbits Package Lock Validator");
  console.log(`Version: ${VERSION}`);
  console.log(`Repository: ${ROOT}`);

  const manifest = readJson(PACKAGE_FILE);
  const lock = readJson(LOCK_FILE);

  if (!manifest || !lock) {
    printSummary();
    return;
  }

  const manifestValid = validatePackageManifest(manifest);
  const dependenciesValid = validateDependencySections(manifest);

  if (!manifestValid || !dependenciesValid) {
    printSummary();
    return;
  }

  const metadataValid = validateLockMetadata(manifest, lock);
  const structureValid = validateLockStructure(lock);

  if (!metadataValid || !structureValid) {
    printSummary();
    return;
  }

  printSummary();
}

main();
