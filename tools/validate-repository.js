
#!/usr/bin/env node

/**
 * MedOrbits Repository Validation Runner
 * File: tools/validate-repository.js
 * Version: 2.0.0
 *
 * Runs configured repository validators sequentially.
 *
 * Usage:
 *   node tools/validate-repository.js
 *   node tools/validate-repository.js --strict
 *   node tools/validate-repository.js --help
 *   node tools/validate-repository.js --version
 *
 * Exit codes:
 *   0 = all executed checks passed
 *   1 = one or more checks failed
 *   2 = runner configuration or runtime error
 *
 * Safety:
 *   - Does not install dependencies.
 *   - Does not execute application entry points.
 *   - Does not modify repository source files.
 *   - Executes only explicitly configured validator scripts.
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

const TIMEOUT_MS = 180000;
const MAX_BUFFER = 10 * 1024 * 1024;

const STRICT = process.argv.includes("--strict");

const CHECKS = [
  {
    name: "JavaScript syntax",
    file: "tools/validate-javascript.js"
  },
  {
    name: "JSON syntax",
    file: "tools/validate-json.js"
  },
  {
    name: "JSON Schema",
    file: "tools/validate-json-schema.js"
  },
  {
    name: "YAML syntax",
    file: "tools/validate-yaml.js"
  },
  {
    name: "HTML structure",
    file: "tools/validate-html.js"
  }
];

const VALID_STATUSES = new Set([
  "PASS",
  "FAIL",
  "SKIP"
]);

function printHelp() {
  console.log(`
MedOrbits Repository Validation Runner v${VERSION}

Usage:
  node tools/validate-repository.js [options]

Options:
  --strict     Treat missing validators as failures.
  --help, -h   Display this help message.
  --version    Display version information.

Behavior:
  - Runs configured validators sequentially.
  - Uses the current Node.js executable.
  - Captures validator output.
  - Enforces a timeout for each validator.
  - Does not install dependencies or modify source files.

Exit codes:
  0 = no failures
  1 = one or more validation failures
  2 = runner configuration or runtime error
`);
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

function getRelativePath(target) {
  return path.relative(ROOT, target).split(path.sep).join("/");
}

function createResult(name, status, detail = "") {
  return {
    name,
    status,
    detail
  };
}

function validateConfiguration() {
  const names = new Set();
  const files = new Set();

  for (const check of CHECKS) {
    if (
      !check ||
      typeof check.name !== "string" ||
      typeof check.file !== "string" ||
      !check.name.trim() ||
      !check.file.trim()
    ) {
      return "Invalid validator configuration.";
    }

    if (path.isAbsolute(check.file)) {
      return `Absolute validator path is not permitted: ${check.file}`;
    }

    const resolved = path.resolve(ROOT, check.file);

    if (!isInsideRoot(resolved)) {
      return `Validator path escapes repository root: ${check.file}`;
    }

    if (names.has(check.name)) {
      return `Duplicate validator name: ${check.name}`;
    }

    if (files.has(resolved)) {
      return `Duplicate validator file: ${check.file}`;
    }

    names.add(check.name);
    files.add(resolved);
  }

  return null;
}

function runCheck(check) {
  const script = path.resolve(ROOT, check.file);

  if (!isInsideRoot(script)) {
    return createResult(
      check.name,
      "FAIL",
      `Validator path escapes repository root: ${check.file}`
    );
  }

  let stat;

  try {
    stat = fs.lstatSync(script);
  } catch (error) {
    if (error.code === "ENOENT") {
      return createResult(
        check.name,
        STRICT ? "FAIL" : "SKIP",
        `Validator not found: ${check.file}`
      );
    }

    return createResult(
      check.name,
      "FAIL",
      `Cannot inspect validator: ${error.message}`
    );
  }

  if (stat.isSymbolicLink()) {
    return createResult(
      check.name,
      "FAIL",
      `Symbolic-link validators are not permitted: ${check.file}`
    );
  }

  if (!stat.isFile()) {
    return createResult(
      check.name,
      "FAIL",
      `Validator is not a regular file: ${check.file}`
    );
  }

  const result = spawnSync(
    NODE,
    [script],
    {
      cwd: ROOT,
      encoding: "utf8",
      timeout: TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: MAX_BUFFER,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        MEDORBITS_VALIDATION_RUNNER: "1",
        MEDORBITS_REPOSITORY_ROOT: ROOT
      }
    }
  );

  const output = [
    result.stdout || "",
    result.stderr || ""
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  if (result.error) {
    const isTimeout =
      result.error.code === "ETIMEDOUT" ||
      result.error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";

    return createResult(
      check.name,
      "FAIL",
      [
        isTimeout
          ? `Validator timed out or exceeded its output buffer.`
          : `Could not execute validator: ${result.error.message}`,
        output
      ].filter(Boolean).join("\n")
    );
  }

  if (result.signal) {
    return createResult(
      check.name,
      "FAIL",
      `Validator terminated by signal: ${result.signal}\n${output}`
    );
  }

  if (result.status !== 0) {
    return createResult(
      check.name,
      "FAIL",
      [
        `Validator exited with code ${result.status}.`,
        output
      ].filter(Boolean).join("\n")
    );
  }

  return createResult(
    check.name,
    "PASS",
    output
  );
}

function printResult(result) {
  console.log(`\n[${result.status}] ${result.name}`);

  if (!result.detail) {
    return;
  }

  const lines = result.detail.split(/\r?\n/);

  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

function printSummary(results, duration) {
  const passed = results.filter(
    result => result.status === "PASS"
  ).length;

  const failed = results.filter(
    result => result.status === "FAIL"
  ).length;

  const skipped = results.filter(
    result => result.status === "SKIP"
  ).length;

  console.log("\n============================================================");
  console.log("MedOrbits Repository Validation Summary");
  console.log("============================================================");
  console.log(`Repository: ${ROOT}`);
  console.log(`Version:    ${VERSION}`);
  console.log(`Node:       ${process.version}`);
  console.log(`Mode:       ${STRICT ? "strict" : "standard"}`);
  console.log(`Passed:     ${passed}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Total:      ${results.length}`);
  console.log(`Duration:   ${(duration / 1000).toFixed(2)} seconds`);
  console.log("============================================================");

  if (failed > 0) {
    console.error("\n[RESULT] REPOSITORY VALIDATION FAILED");

    for (const result of results) {
      if (result.status === "FAIL") {
        console.error(` - ${result.name}`);
      }
    }

    return 1;
  }

  if (skipped > 0) {
    console.log("\n[RESULT] VALIDATION COMPLETED WITH SKIPPED CHECKS.");
    console.log("[NOTE] Skipped checks are not counted as passed.");
  } else {
    console.log("\n[RESULT] ALL CONFIGURED VALIDATORS PASSED.");
  }

  console.log(
    "Passing these checks does not guarantee application or deployment success."
  );

  return 0;
}

function main() {
  const args = process.argv.slice(2);
  const allowed = new Set([
    "--strict",
    "--help",
    "-h",
    "--version"
  ]);

  const unknown = args.filter(arg => !allowed.has(arg));

  if (unknown.length > 0) {
    console.error(
      `[ERROR] Unknown argument: ${unknown.join(", ")}`
    );

    console.error(
      "Usage: node tools/validate-repository.js [--strict]"
    );

    process.exitCode = 2;
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version")) {
    console.log(`MedOrbits Repository Validation Runner v${VERSION}`);
    return;
  }

  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
    console.error("[ERROR] Repository root is unavailable.");
    process.exitCode = 2;
    return;
  }

  const configurationError = validateConfiguration();

  if (configurationError) {
    console.error(`[ERROR] ${configurationError}`);
    process.exitCode = 2;
    return;
  }

  console.log("============================================================");
  console.log("MedOrbits Repository Health Check");
  console.log("============================================================");
  console.log(`Root:    ${ROOT}`);
  console.log(`Node:    ${process.version}`);
  console.log(`Mode:    ${STRICT ? "strict" : "standard"}`);
  console.log(`Checks:  ${CHECKS.length}`);
  console.log("============================================================");

  const started = process.hrtime.bigint();
  const results = [];

  for (const check of CHECKS) {
    console.log(`\n[RUN] ${check.name}`);

    const result = runCheck(check);

    if (!VALID_STATUSES.has(result.status)) {
      console.error(
        `[ERROR] Invalid result status from ${check.name}.`
      );

      process.exitCode = 2;
      return;
    }

    results.push(result);
    printResult(result);
  }

  const duration = Number(
    process.hrtime.bigint() - started
  ) / 1e6;

  process.exitCode = printSummary(results, duration);
}

try {
  main();
} catch (error) {
  console.error(
    `[FATAL] Repository validation runner failed: ${error.message}`
  );

  process.exitCode = 2;
}
