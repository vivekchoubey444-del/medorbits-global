
#!/usr/bin/env node

/**
 * MedOrbits JSON Validation Utility
 * ---------------------------------
 * Recursively validates JSON files throughout the project.
 *
 * Features:
 * - Recursive directory traversal.
 * - JSON syntax validation.
 * - UTF-8 BOM detection.
 * - Strict mode: warnings cause failure.
 * - Detailed error locations with line and column numbers.
 * - Configurable root directory and excluded directories.
 * - Hidden-file handling.
 * - Symbolic-link protection.
 * - Maximum file-size protection.
 * - Human-readable summary and CI-compatible exit codes.
 *
 * Usage:
 *   node scripts/validate-json.js
 *   node scripts/validate-json.js --strict
 *   node scripts/validate-json.js --root ./api
 *   node scripts/validate-json.js --exclude uploads
 *   node scripts/validate-json.js --include-hidden
 *   node scripts/validate-json.js --max-size 5
 *   node scripts/validate-json.js --help
 *
 * Requirements:
 *   Node.js 20+
 *   No third-party dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

const DEFAULT_IGNORED_DIRECTORIES = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  ".cache",
  ".turbo",
  ".vercel",
  ".netlify",
];

const DEFAULT_MAX_FILE_SIZE_MB = 10;

function printHelp() {
  console.log(`
MedOrbits JSON Validation Utility

Usage:
  node scripts/validate-json.js [options]

Options:
  --strict
      Treat warnings as validation failures.

  --root <directory>
      Directory to scan. Defaults to the current working directory.

  --exclude <name>
      Exclude a directory by name. Can be repeated.

  --include-hidden
      Include hidden files and directories, except excluded directories.

  --max-size <MB>
      Maximum JSON file size in megabytes.
      Defaults to ${DEFAULT_MAX_FILE_SIZE_MB} MB.
      Use 0 to disable the size limit.

  --help, -h
      Display this help message.

Examples:
  node scripts/validate-json.js
  node scripts/validate-json.js --strict
  node scripts/validate-json.js --root ./api
  node scripts/validate-json.js --exclude uploads --exclude temp
  node scripts/validate-json.js --include-hidden --strict
  node scripts/validate-json.js --max-size 20
`);
}

function parseArguments(args) {
  const options = {
    root: process.cwd(),
    strict: false,
    includeHidden: false,
    maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB,
    excludedDirectories: new Set(DEFAULT_IGNORED_DIRECTORIES),
    help: false,
    errors: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--strict":
        options.strict = true;
        break;

      case "--include-hidden":
        options.includeHidden = true;
        break;

      case "--root": {
        const value = args[++index];

        if (!value || value.startsWith("--")) {
          options.errors.push("--root requires a directory path.");
          break;
        }

        options.root = path.resolve(value);
        break;
      }

      case "--exclude": {
        const value = args[++index];

        if (!value || value.startsWith("--")) {
          options.errors.push("--exclude requires a directory name.");
          break;
        }

        options.excludedDirectories.add(value);
        break;
      }

      case "--max-size": {
        const value = args[++index];

        if (
          value === undefined ||
          value.startsWith("--") ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0
        ) {
          options.errors.push(
            "--max-size requires a non-negative number in megabytes.",
          );
          break;
        }

        options.maxSizeMB = Number(value);
        break;
      }

      default:
        options.errors.push(`Unknown option: ${argument}`);
        break;
    }
  }

  return options;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function getRelativePath(root, target) {
  const relative = path.relative(root, target);
  return relative || ".";
}

function getErrorLocation(message, source) {
  /*
   * V8 commonly reports JSON.parse failures using:
   *   Unexpected token ... in JSON at position 12
   *
   * Newer Node.js versions may use different wording.
   * If no position is available, return the original message.
   */
  const match = message.match(/\bposition\s+(\d+)\b/i);

  if (!match) {
    return {
      line: null,
      column: null,
      message,
    };
  }

  const position = Number(match[1]);
  const safePosition = Math.max(0, Math.min(position, source.length));
  const precedingText = source.slice(0, safePosition);
  const lines = precedingText.split("\n");

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
    message,
  };
}

function formatParseError(error, source) {
  const detail = getErrorLocation(error.message, source);

  if (detail.line !== null) {
    return `line ${detail.line}, column ${detail.column}: ${detail.message}`;
  }

  return detail.message;
}

function createStatistics() {
  return {
    directoriesVisited: 0,
    directoriesSkipped: 0,
    filesDiscovered: 0,
    filesChecked: 0,
    filesValid: 0,
    filesInvalid: 0,
    filesTooLarge: 0,
    filesUnreadable: 0,
    symbolicLinksSkipped: 0,
    warnings: 0,
    errors: 0,
    bytesRead: 0,
  };
}

function createReporter() {
  return {
    errors: [],
    warnings: [],
  };
}

function addError(reporter, statistics, filePath, message) {
  reporter.errors.push({
    path: filePath,
    message,
  });

  statistics.errors += 1;
}

function addWarning(reporter, statistics, filePath, message) {
  reporter.warnings.push({
    path: filePath,
    message,
  });

  statistics.warnings += 1;
}

function shouldSkipHidden(name, includeHidden) {
  if (includeHidden) {
    return false;
  }

  return name.startsWith(".") && name !== ".well-known";
}

function isJsonFile(fileName) {
  return fileName.toLowerCase().endsWith(".json");
}

function validateJsonFile(filePath, options, reporter, statistics) {
  const relativePath = getRelativePath(options.root, filePath);

  let fileStat;

  try {
    fileStat = fs.statSync(filePath);
  } catch (error) {
    statistics.filesUnreadable += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      `Cannot inspect file: ${error.message}`,
    );

    return;
  }

  if (!fileStat.isFile()) {
    return;
  }

  statistics.filesDiscovered += 1;

  const maxBytes = options.maxSizeMB * 1024 * 1024;

  if (maxBytes > 0 && fileStat.size > maxBytes) {
    statistics.filesTooLarge += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      `File exceeds the ${options.maxSizeMB} MB limit (${formatBytes(fileStat.size)}).`,
    );

    return;
  }

  let source;

  try {
    source = fs.readFileSync(filePath, "utf8");
    statistics.bytesRead += Buffer.byteLength(source, "utf8");
  } catch (error) {
    statistics.filesUnreadable += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      `Cannot read file: ${error.message}`,
    );

    return;
  }

  statistics.filesChecked += 1;

  const hasBom = source.charCodeAt(0) === 0xfeff;

  if (hasBom) {
    addWarning(
      reporter,
      statistics,
      relativePath,
      "UTF-8 BOM detected. Save the file as UTF-8 without a BOM.",
    );
  }

  /*
   * Remove the BOM only for parsing. The warning remains recorded,
   * and strict mode will fail if any warning exists.
   */
  const parseSource = hasBom ? source.slice(1) : source;

  try {
    JSON.parse(parseSource);
    statistics.filesValid += 1;
  } catch (error) {
    statistics.filesInvalid += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      formatParseError(error, parseSource),
    );
  }
}

function walk(directory, options, reporter, statistics) {
  statistics.directoriesVisited += 1;

  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (error) {
    addError(
      reporter,
      statistics,
      getRelativePath(options.root, directory),
      `Cannot read directory: ${error.message}`,
    );

    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = getRelativePath(options.root, fullPath);

    if (shouldSkipHidden(entry.name, options.includeHidden)) {
      statistics.directoriesSkipped += entry.isDirectory() ? 1 : 0;
      continue;
    }

    if (entry.isSymbolicLink()) {
      statistics.symbolicLinksSkipped += 1;
      continue;
    }

    if (entry.isDirectory()) {
      if (options.excludedDirectories.has(entry.name)) {
        statistics.directoriesSkipped += 1;
        continue;
      }

      walk(fullPath, options, reporter, statistics);
      continue;
    }

    if (!entry.isFile() || !isJsonFile(entry.name)) {
      continue;
    }

    validateJsonFile(
      fullPath,
      options,
      reporter,
      statistics,
    );
  }
}

function printResults(options, reporter, statistics, elapsedMs) {
  console.log("");
  console.log("MedOrbits JSON Validation");
  console.log("=".repeat(48));
  console.log(`Root directory:       ${options.root}`);
  console.log(`Strict mode:          ${options.strict ? "enabled" : "disabled"}`);
  console.log(`Hidden paths:         ${options.includeHidden ? "included" : "excluded"}`);
  console.log(
    `Maximum file size:    ${
      options.maxSizeMB === 0 ? "unlimited" : `${options.maxSizeMB} MB`
    }`,
  );

  console.log("");
  console.log("Validation details");
  console.log("-".repeat(48));

  console.log(`Directories visited:  ${statistics.directoriesVisited}`);
  console.log(`Directories skipped:  ${statistics.directoriesSkipped}`);
  console.log(`JSON files discovered:${String(statistics.filesDiscovered).padStart(7)}`);
  console.log(`JSON files checked:   ${statistics.filesChecked}`);
  console.log(`Valid JSON files:     ${statistics.filesValid}`);
  console.log(`Invalid JSON files:   ${statistics.filesInvalid}`);
  console.log(`Oversized files:      ${statistics.filesTooLarge}`);
  console.log(`Unreadable files:     ${statistics.filesUnreadable}`);
  console.log(`Symbolic links skipped: ${statistics.symbolicLinksSkipped}`);
  console.log(`Warnings:             ${statistics.warnings}`);
  console.log(`Errors:               ${statistics.errors}`);
  console.log(`Data read:            ${formatBytes(statistics.bytesRead)}`);
  console.log(`Duration:             ${elapsedMs.toFixed(2)} ms`);

  if (reporter.warnings.length > 0) {
    console.log("");
    console.log("Warnings");
    console.log("-".repeat(48));

    for (const warning of reporter.warnings) {
      console.warn(`WARN  ${warning.path}: ${warning.message}`);
    }
  }

  if (reporter.errors.length > 0) {
    console.log("");
    console.log("Errors");
    console.log("-".repeat(48));

    for (const error of reporter.errors) {
      console.error(`ERROR ${error.path}: ${error.message}`);
    }
  }

  const failed =
    statistics.errors > 0 ||
    (options.strict && statistics.warnings > 0);

  console.log("");
  console.log("Final result");
  console.log("-".repeat(48));

  if (failed) {
    console.error("FAILED: JSON validation did not pass.");

    if (options.strict && statistics.warnings > 0) {
      console.error("Strict mode treats warnings as failures.");
    }
  } else {
    console.log("PASSED: All checked JSON files are syntactically valid.");

    if (statistics.warnings > 0) {
      console.log(
        "Note: warnings were found. Use --strict to fail on warnings.",
      );
    }
  }

  console.log("");

  return failed ? 1 : 0;
}

function main() {
  const startedAt = performance.now();
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return 0;
  }

  if (options.errors.length > 0) {
    for (const error of options.errors) {
      console.error(`ARGUMENT ERROR: ${error}`);
    }

    console.error("Use --help to see supported options.");
    return 2;
  }

  let rootStat;

  try {
    rootStat = fs.statSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot access "${options.root}": ${error.message}`,
    );

    return 2;
  }

  if (!rootStat.isDirectory()) {
    console.error(
      `ROOT ERROR: "${options.root}" is not a directory.`,
    );

    return 2;
  }

  const reporter = createReporter();
  const statistics = createStatistics();

  walk(
    options.root,
    options,
    reporter,
    statistics,
  );

  const elapsedMs = performance.now() - startedAt;

  return printResults(
    options,
    reporter,
    statistics,
    elapsedMs,
  );
}

try {
  process.exitCode = main();
} catch (error) {
  console.error("FATAL ERROR: Unexpected validator failure.");

  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = 2;
}
