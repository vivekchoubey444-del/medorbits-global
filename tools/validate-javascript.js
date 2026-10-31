
#!/usr/bin/env node

/**
 * MedOrbits JavaScript Syntax Validator
 * File: tools/validate-javascript.js
 * Version: 2.0.0
 *
 * Usage:
 *   node tools/validate-javascript.js
 *   node tools/validate-javascript.js tools scripts
 *   node tools/validate-javascript.js tools/repair-package-lock.cjs
 *
 * Options:
 *   --help       Show help.
 *   --version    Show version.
 *
 * Validation:
 *   - Uses Node.js built-in syntax checking.
 *   - Supports .js, .cjs and .mjs.
 *   - Does not execute application code.
 *
 * Safety:
 *   - Read-only.
 *   - Does not install dependencies.
 *   - Does not modify source files.
 *   - Does not follow symbolic links.
 *   - Rejects paths outside the repository.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const ROOT = path.resolve(SCRIPT_DIR, "..");

const VERSION = "2.0.0";
const NODE = process.execPath;

const TIMEOUT_MS = 30000;
const MAX_BUFFER = 5 * 1024 * 1024;

const EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs"
]);

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".venv",
  "venv",
  "vendor",
  "__pycache__",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".turbo",
  ".cache"
]);

const results = {
  checked: 0,
  passed: 0,
  failed: 0,
  skipped: 0
};

const failures = [];

function printHelp() {
  console.log(`
MedOrbits JavaScript Syntax Validator v${VERSION}

Usage:
  node tools/validate-javascript.js [options] [paths...]

Examples:
  node tools/validate-javascript.js
  node tools/validate-javascript.js tools scripts
  node tools/validate-javascript.js tools/repair-package-lock.cjs

Options:
  --help       Display help.
  --version    Display version.

Supported extensions:
  .js
  .cjs
  .mjs

Safety:
  Uses node --check.
  Does not execute application code.
  Does not modify source files.
`);
}

function relativePath(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function isInsideRoot(target) {
  const relative = path.relative(ROOT, target);

  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function recordPass(file) {
  results.checked++;
  results.passed++;

  console.log(`[PASS] ${relativePath(file)}`);
}

function recordFailure(file, message) {
  results.checked++;

  results.failed++;

  const description = `${relativePath(file)}: ${message}`;

  failures.push(description);

  console.error(`[FAIL] ${description}`);
}

function recordSkip(message) {
  results.skipped++;

  console.log(`[SKIP] ${message}`);
}

function collectFiles(directory, output = []) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `Cannot read directory ${relativePath(directory)}: ${error.message}`
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    // Never traverse symbolic links.
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        collectFiles(fullPath, output);
      }

      continue;
    }

    if (
      entry.isFile() &&
      EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      output.push(fullPath);
    }
  }

  return output;
}

function resolveTargets(targets) {
  const files = [];

  for (const target of targets) {
    const absolute = path.resolve(ROOT, target);

    if (!isInsideRoot(absolute)) {
      throw new Error(
        `Path outside repository rejected: ${target}`
      );
    }

    let stat;

    try {
      stat = fs.lstatSync(absolute);
    } catch (error) {
      throw new Error(
        `Cannot access ${target}: ${error.message}`
      );
    }

    if (stat.isSymbolicLink()) {
      throw new Error(
        `Symbolic links are not permitted: ${target}`
      );
    }

    if (stat.isFile()) {
      const extension = path.extname(absolute).toLowerCase();

      if (!EXTENSIONS.has(extension)) {
        throw new Error(
          `Unsupported JavaScript extension: ${target}`
        );
      }

      files.push(absolute);
      continue;
    }

    if (stat.isDirectory()) {
      files.push(...collectFiles(absolute));
      continue;
    }

    throw new Error(
      `Unsupported filesystem entry: ${target}`
    );
  }

  return [...new Set(files)].sort();
}

function validateFile(file) {
  let stat;

  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    return {
      ok: false,
      message: `Cannot inspect file: ${error.message}`
    };
  }

  if (stat.isSymbolicLink()) {
    return {
      ok: false,
      message: "Symbolic links are not permitted."
    };
  }

  if (!stat.isFile()) {
    return {
      ok: false,
      message: "Not a regular file."
    };
  }

  const result = spawnSync(
    NODE,
    ["--check", file],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  if (result.error) {
    const timedOut =
      result.error.code === "ETIMEDOUT";

    return {
      ok: false,
      message: timedOut
        ? `Syntax check exceeded ${TIMEOUT_MS} ms.`
        : `Unable to execute Node.js syntax checker: ${result.error.message}`,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  if (result.signal) {
    return {
      ok: false,
      message: `Syntax checker terminated by signal ${result.signal}.`,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  if (result.status !== 0) {
    return {
      ok: false,
      message: `Node.js syntax check exited with code ${result.status}.`,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  return {
    ok: true
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version")) {
    console.log(
      `MedOrbits JavaScript Syntax Validator v${VERSION}`
    );
    return;
  }

  if (args.some(arg => arg.startsWith("--"))) {
    console.error("[ERROR] Unknown option.");
    printHelp();
    process.exitCode = 2;
    return;
  }

  let files;

  try {
    files = args.length > 0
      ? resolveTargets(args)
      : collectFiles(ROOT);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (files.length === 0) {
    recordSkip("No JavaScript files found.");
    return;
  }

  console.log("============================================================");
  console.log("MedOrbits JavaScript Syntax Validation");
  console.log("============================================================");
  console.log(`Repository: ${ROOT}`);
  console.log(`Version:    ${VERSION}`);
  console.log(`Node:       ${process.version}`);
  console.log(`Files:      ${files.length}`);
  console.log("============================================================");

  for (const file of files) {
    const result = validateFile(file);

    if (result.ok) {
      recordPass(file);
      continue;
    }

    recordFailure(file, result.message);

    if (result.stderr) {
      console.error(
        result.stderr.trim().split(/\r?\n/).slice(0, 12).join("\n")
      );
    }

    if (result.stdout) {
      console.error(
        result.stdout.trim().split(/\r?\n/).slice(0, 12).join("\n")
      );
    }
  }

  console.log("\n============================================================");
  console.log("MedOrbits JavaScript Validation Summary");
  console.log("============================================================");
  console.log(`Checked: ${results.checked}`);
  console.log(`Passed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log("============================================================");

  if (results.failed > 0) {
    console.error("\nFailure details:");

    for (const failure of failures) {
      console.error(` - ${failure}`);
    }

    console.error("\n[RESULT] JAVASCRIPT VALIDATION FAILED");
    process.exitCode = 1;
    return;
  }

  if (results.skipped > 0) {
    console.log(
      "\n[RESULT] Completed with skipped checks."
    );
  } else {
    console.log(
      "\n[RESULT] All discovered JavaScript files passed syntax validation."
    );
  }
}

try {
  main();
} catch (error) {
  console.error(`[FATAL] ${error.message}`);
  process.exitCode = 2;
}
