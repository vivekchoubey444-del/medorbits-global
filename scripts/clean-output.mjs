#!/usr/bin/env node

/**
 * MedOrbits -- Safe Build Output Cleaner
 * File: scripts/clean-output.mjs
 *
 * Purpose:
 * - Remove generated build and test output.
 * - Remove common temporary artifacts.
 * - Preserve source files, public assets, JSON datasets,
 *   migrations, configuration and repository tooling.
 *
 * Safety:
 * - Dry-run by default.
 * - --apply is required to delete anything.
 * - Only removes explicitly allowlisted paths and patterns.
 * - Refuses to operate outside the repository.
 * - Never follows symbolic links.
 * - Does not execute shell commands.
 *
 * Usage:
 *   node scripts/clean-output.mjs
 *   node scripts/clean-output.mjs --apply
 *   node scripts/clean-output.mjs --target dist
 *   node scripts/clean-output.mjs --apply --target coverage
 *   node scripts/clean-output.mjs --help
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

const args = process.argv.slice(2);

const APPLY = args.includes("--apply");
const HELP = args.includes("--help") || args.includes("-h");

const TARGET_INDEX = args.indexOf("--target");
const TARGET_ARGUMENT =
  TARGET_INDEX >= 0 ? args[TARGET_INDEX + 1] : null;

/**
 * Only these exact root-level directories can be cleaned.
 *
 * Add a directory only if it contains reproducible generated output.
 * Never add src, public, assets, api, data, migrations or scripts.
 */
const CLEANABLE_DIRECTORIES = new Set([
  "dist",
  "build",
  "coverage",
  ".nyc_output",
  ".cache",
  ".parcel-cache",
  ".turbo",
  ".vite",
  ".next",
  ".nuxt",
  "playwright-report",
  "test-results",
]);

/**
 * Temporary filename patterns.
 *
 * These patterns apply only inside known generated output directories
 * unless --target explicitly selects an allowlisted directory.
 */
const TEMP_FILE_PATTERNS = [
  /\.tmp$/i,
  /\.temp$/i,
  /\.log$/i,
  /\.pid$/i,
  /\.swp$/i,
  /~$/,
];

let removed = 0;
let proposed = 0;
let errors = 0;
let preserved = 0;

function relative(target) {
  return path.relative(ROOT, target) || ".";
}

function insideRoot(target) {
  const rel = path.relative(ROOT, target);

  return (
    rel === "" ||
    (
      rel !== ".." &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel)
    )
  );
}

function help() {
  console.log(`
MedOrbits Safe Output Cleaner

Usage:
  node scripts/clean-output.mjs [options]

Options:
  --apply          Actually remove eligible generated output
  --target <name>  Select one allowlisted output directory
  --help, -h       Display help

Default behavior is a dry run.

Examples:
  node scripts/clean-output.mjs
  node scripts/clean-output.mjs --apply
  node scripts/clean-output.mjs --target dist
  node scripts/clean-output.mjs --apply --target coverage
`);
}

function reportError(message) {
  errors += 1;
  console.error(`ERROR: ${message}`);
}

function isSymlink(target) {
  try {
    return fs.lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}

function removeEntry(target) {
  const rel = relative(target);

  if (!insideRoot(target) || target === ROOT) {
    reportError(`Refusing to remove path outside repository: ${rel}`);
    return;
  }

  if (isSymlink(target)) {
    reportError(`Refusing to remove symbolic link: ${rel}`);
    return;
  }

  if (!APPLY) {
    console.log(`DRY-RUN  ${rel}`);
    proposed += 1;
    return;
  }

  try {
    fs.rmSync(target, {
      recursive: true,
      force: false,
      maxRetries: 2,
      retryDelay: 100,
    });

    console.log(`REMOVED  ${rel}`);
    removed += 1;
  } catch (error) {
    reportError(`${rel}: ${error.message}`);
  }
}

function cleanDirectory(directory) {
  if (!fs.existsSync(directory)) {
    console.log(`SKIP     ${relative(directory)} (not present)`);
    return;
  }

  let stat;

  try {
    stat = fs.lstatSync(directory);
  } catch (error) {
    reportError(`${relative(directory)}: ${error.message}`);
    return;
  }

  if (stat.isSymbolicLink()) {
    reportError(
      `Refusing to clean symbolic-link directory: ${relative(directory)}`
    );
    return;
  }

  if (!stat.isDirectory()) {
    reportError(
      `Expected a generated directory: ${relative(directory)}`
    );
    return;
  }

  removeEntry(directory);
}

function cleanTemporaryFiles(directory) {
  if (!fs.existsSync(directory)) return;

  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (error) {
    reportError(`${relative(directory)}: ${error.message}`);
    return;
  }

  for (const entry of entries) {
    const target = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      preserved += 1;
      continue;
    }

    if (entry.isDirectory()) {
      // Do not recurse through source or unknown directories.
      if (CLEANABLE_DIRECTORIES.has(entry.name)) {
        cleanDirectory(target);
      } else {
        preserved += 1;
      }

      continue;
    }

    if (
      entry.isFile() &&
      TEMP_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))
    ) {
      removeEntry(target);
    } else {
      preserved += 1;
    }
  }
}

function main() {
  if (HELP) {
    help();
    return 0;
  }

  if (TARGET_INDEX >= 0 && !TARGET_ARGUMENT) {
    reportError("--target requires a directory name.");
    return 2;
  }

  console.log("MedOrbits Safe Output Cleaner");
  console.log(`Repository: ${ROOT}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  if (TARGET_ARGUMENT) {
    // Restrict target selection to an exact allowlisted directory name.
    if (
      TARGET_ARGUMENT.includes("/") ||
      TARGET_ARGUMENT.includes("\\") ||
      TARGET_ARGUMENT === "." ||
      TARGET_ARGUMENT === ".." ||
      !CLEANABLE_DIRECTORIES.has(TARGET_ARGUMENT)
    ) {
      reportError(
        `Target is not allowlisted: ${TARGET_ARGUMENT}`
      );
      return 2;
    }

    cleanDirectory(path.resolve(ROOT, TARGET_ARGUMENT));
  } else {
    for (const directory of CLEANABLE_DIRECTORIES) {
      cleanDirectory(path.resolve(ROOT, directory));
    }

    // Temporary files are only inspected at the repository root.
    // Source directories are never recursively cleaned.
    cleanTemporaryFiles(ROOT);
  }

  console.log("\nSummary");
  console.log(`  Proposed removals: ${proposed}`);
  console.log(`  Removed:           ${removed}`);
  console.log(`  Preserved entries: ${preserved}`);
  console.log(`  Errors:            ${errors}`);

  if (!APPLY && proposed > 0) {
    console.log(
      "\nDry run only. Review the paths, then rerun with --apply."
    );
  }

  return errors > 0 ? 1 : 0;
}

process.exitCode = main();
