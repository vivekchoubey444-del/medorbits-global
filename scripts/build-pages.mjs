
#!/usr/bin/env node

/**
 * MedOrbits -- Site Build Orchestrator
 *
 * File: scripts/build-site.mjs
 *
 * Requirements:
 *   - Node.js 20+
 *
 * Usage:
 *   node scripts/build-site.mjs
 *   node scripts/build-site.mjs --dry-run
 *   node scripts/build-site.mjs --json
 *   node scripts/build-site.mjs --strict
 *   node scripts/build-site.mjs --skip=html,json
 *   node scripts/build-site.mjs --help
 *
 * Environment:
 *   SITE_BUILD_DIR       Build output directory (default: dist)
 *   SITE_BUILD_TIMEOUT   Per-command timeout in milliseconds
 *
 * Build stages:
 *   1. Validate repository configuration
 *   2. Validate JSON files, when the validator exists
 *   3. Validate HTML files, when the validator exists
 *   4. Build the document catalogue, when configured
 *   5. Run the project's configured build command, if present
 *   6. Verify generated output
 *
 * Safety:
 *   - Does not delete existing build output.
 *   - Does not invoke a shell to execute commands.
 *   - Does not print environment variables or secrets.
 *   - Skips optional stages when their scripts are absent.
 *   - Reports failed stages with non-zero exit status.
 *
 * Note:
 *   This orchestrator does not deploy or publish the site.
 *   Configure package.json scripts for project-specific build steps.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");

const DEFAULT_BUILD_DIR = process.env.SITE_BUILD_DIR || "dist";
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60 * 60 * 1000;

const STAGES = [
  {
    id: "json",
    label: "JSON validation",
    script: "scripts/validate-json.cjs",
    command: "node",
    args: ["scripts/validate-json.cjs"],
    optional: true,
  },
  {
    id: "html",
    label: "HTML validation",
    script: "scripts/validate-html.mjs",
    command: "node",
    args: ["scripts/validate-html.mjs"],
    optional: true,
  },
  {
    id: "catalogue",
    label: "Document catalogue",
    script: "scripts/build-document-catalogue.mjs",
    command: "node",
    args: ["scripts/build-document-catalogue.mjs"],
    optional: true,
  },
];

const results = [];
const errors = [];
const warnings = [];

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function relative(file) {
  return path.relative(ROOT_DIR, file).split(path.sep).join("/") || ".";
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);

  return (
    rel === "" ||
    (
      rel !== ".." &&
      !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel)
    )
  );
}

function addError(stage, message) {
  errors.push({ stage, message });
}

function addWarning(stage, message) {
  warnings.push({ stage, message });
}

function parsePositiveInteger(value, name, maximum) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > maximum
  ) {
    throw new Error(`${name} must be between 1 and ${maximum}.`);
  }

  return number;
}

function parseArguments(argv) {
  const options = {
    dryRun: false,
    json: false,
    strict: false,
    help: false,
    buildDir: DEFAULT_BUILD_DIR,
    skip: new Set(),
  };

  const seen = new Set();

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    const match = arg.match(/^--(skip|out|output)=(.*)$/);

    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const [, name, value] = match;
    const key = name === "skip" ? "skip" : "buildDir";

    if (seen.has(key)) {
      throw new Error(`Option --${name} was provided more than once.`);
    }

    seen.add(key);

    if (!value.trim()) {
      throw new Error(`Option --${name} cannot be empty.`);
    }

    if (key === "skip") {
      const values = value.split(",").map((item) => item.trim());

      for (const item of values) {
        if (!["json", "html", "catalogue", "project"].includes(item)) {
          throw new Error(`Unknown build stage in --skip: ${item}`);
        }

        options.skip.add(item);
      }
    } else {
      options.buildDir = value.trim();
    }
  }

  return options;
}

function resolveRepositoryPath(input, label) {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.includes("\0")
  ) {
    throw new Error(`${label} must be a valid non-empty path.`);
  }

  const resolved = path.resolve(ROOT_DIR, input);

  if (!isInside(ROOT_DIR, resolved) || resolved === ROOT_DIR) {
    throw new Error(`${label} must remain inside the repository.`);
  }

  return resolved;
}

function safeLstat(target) {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return null;
    }

    throw error;
  }
}

function assertNoSymlinkPath(target) {
  if (!isInside(ROOT_DIR, target)) {
    throw new Error("Path escapes the repository root.");
  }

  const components = path
    .relative(ROOT_DIR, target)
    .split(path.sep)
    .filter(Boolean);

  let current = ROOT_DIR;

  for (const component of components) {
    current = path.join(current, component);
    const stat = safeLstat(current);

    if (stat?.isSymbolicLink()) {
      throw new Error(
        `Symlinked path is not permitted: ${relative(current)}`
      );
    }
  }
}

function validateRepository() {
  const packageFile = path.join(ROOT_DIR, "package.json");

  if (!fs.existsSync(packageFile)) {
    addWarning(
      "repository",
      "package.json was not found; package scripts will not be available."
    );

    return null;
  }

  let packageJson;

  try {
    const source = fs.readFileSync(packageFile, "utf8").replace(/^\uFEFF/, "");
    packageJson = JSON.parse(source);
  } catch (error) {
    addError("repository", `Invalid package.json: ${messageOf(error)}`);
    return null;
  }

  if (
    !packageJson ||
    typeof packageJson !== "object" ||
    Array.isArray(packageJson)
  ) {
    addError("repository", "package.json must contain a JSON object.");
    return null;
  }

  if (
    packageJson.scripts !== undefined &&
    (
      !packageJson.scripts ||
      typeof packageJson.scripts !== "object" ||
      Array.isArray(packageJson.scripts)
    )
  ) {
    addError("repository", 'package.json "scripts" must be an object.');
    return null;
  }

  return packageJson;
}

function runCommand(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    let settled = false;
    let timedOut = false;

    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: "inherit",
    });

    let forceKillTimer;

    function finish(result) {
      if (settled) return;

      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);

      resolve({
        ...result,
        durationMs: Date.now() - start,
      });
    }

    const timeout = setTimeout(() => {
      timedOut = true;

      try {
        child.kill("SIGTERM");
      } catch {
        // Process may have exited.
      }

      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          try {
            child.kill("SIGKILL");
          } catch {
            // Process may have exited.
          }
        }
      }, 5000);

      forceKillTimer.unref();
    }, timeoutMs);

    timeout.unref();

    child.on("error", (error) => {
      finish({
        ok: false,
        exitCode: null,
        error: `Unable to start ${command}: ${messageOf(error)}`,
      });
    });

    child.on("close", (code, signal) => {
      if (timedOut) {
        finish({
          ok: false,
          exitCode: code,
          error: `Command timed out after ${timeoutMs} ms.`,
        });

        return;
      }

      finish({
        ok: code === 0,
        exitCode: code,
        signal,
        error: code === 0 ? null : `Command failed with exit code ${code}.`,
      });
    });
  });
}

async function runStage(stage, timeoutMs, dryRun) {
  const scriptPath = path.resolve(ROOT_DIR, stage.script);

  if (!isInside(ROOT_DIR, scriptPath)) {
    addError(stage.id, "Stage script path escapes the repository.");
    return;
  }

  const stat = safeLstat(scriptPath);

  if (!stat) {
    if (stage.optional) {
      addWarning(stage.id, `Optional script not found: ${stage.script}`);

      results.push({
        id: stage.id,
        status: "skipped",
        reason: "optional script not found",
      });

      return;
    }

    addError(stage.id, `Required script not found: ${stage.script}`);
    return;
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    addError(stage.id, `Stage script is not a regular file: ${stage.script}`);
    return;
  }

  if (dryRun) {
    results.push({
      id: stage.id,
      status: "dry-run",
      command: stage.command,
      args: stage.args,
    });

    return;
  }

  console.log(`\n[MedOrbits] ${stage.label}`);

  const result = await runCommand(
    stage.command,
    stage.args,
    timeoutMs
  );

  results.push({
    id: stage.id,
    status: result.ok ? "passed" : "failed",
    durationMs: result.durationMs,
    exitCode: result.exitCode,
    error: result.error,
  });

  if (!result.ok) {
    addError(stage.id, result.error || "Stage failed.");
  }
}

function checkBuildOutput(buildDirectory) {
  const stat = safeLstat(buildDirectory);

  if (!stat) {
    addWarning(
      "output",
      `Build directory does not exist: ${relative(buildDirectory)}`
    );

    return;
  }

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    addError(
      "output",
      "Build output path must be a real directory, not a symlink or file."
    );

    return;
  }

  let entries;

  try {
    entries = fs.readdirSync(buildDirectory);
  } catch (error) {
    addError("output", `Cannot read build output: ${messageOf(error)}`);
    return;
  }

  if (entries.length === 0) {
    addWarning("output", "Build output directory is empty.");
    return;
  }

  const indexFile = path.join(buildDirectory, "index.html");

  if (!fs.existsSync(indexFile)) {
    addWarning(
      "output",
      "No index.html found at the build output root."
    );
  } else {
    const indexStat = safeLstat(indexFile);

    if (!indexStat?.isFile() || indexStat.isSymbolicLink()) {
      addError("output", "index.html must be a regular file.");
    }
  }
}

function printHelp() {
  console.log(`MedOrbits Site Build Orchestrator

Usage:
  node scripts/build-site.mjs [options]

Options:
  --dry-run           Show planned steps without running them
  --json              Print machine-readable JSON report
  --strict            Treat warnings as failures
  --skip=STAGES       Skip comma-separated stages
  --output=PATH       Build output directory (default: dist)
  --out=PATH          Alias for --output
  --help, -h          Show help

Stages:
  json
  html
  catalogue
  project

Examples:
  node scripts/build-site.mjs --dry-run
  node scripts/build-site.mjs --strict
  node scripts/build-site.mjs --skip=catalogue
  node scripts/build-site.mjs --output=dist-public
`);
}

async function main() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`[MedOrbits Build] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  let timeoutMs;

  try {
    timeoutMs = parsePositiveInteger(
      process.env.SITE_BUILD_TIMEOUT || DEFAULT_TIMEOUT_MS,
      "SITE_BUILD_TIMEOUT",
      MAX_TIMEOUT_MS
    );

    if (timeoutMs < MIN_TIMEOUT_MS) {
      throw new Error(
        `SITE_BUILD_TIMEOUT must be at least ${MIN_TIMEOUT_MS}.`
      );
    }
  } catch (error) {
    console.error(`[MedOrbits Build] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }

  let buildDirectory;

  try {
    buildDirectory = resolveRepositoryPath(
      options.buildDir,
      "Build output directory"
    );

    assertNoSymlinkPath(buildDirectory);
  } catch (error) {
    console.error(`[MedOrbits Build] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }

  const packageJson = validateRepository();

  if (errors.length > 0) {
    printReport(options);
    process.exitCode = 1;
    return;
  }

  console.log("MedOrbits Site Build");
  console.log(`Repository: ${relative(ROOT_DIR)}`);
  console.log(`Output: ${relative(buildDirectory)}`);
  console.log(`Dry run: ${options.dryRun ? "yes" : "no"}`);

  for (const stage of STAGES) {
    if (options.skip.has(stage.id)) {
      results.push({
        id: stage.id,
        status: "skipped",
        reason: "disabled by --skip",
      });

      continue;
    }

    await runStage(stage, timeoutMs, options.dryRun);

    if (errors.length > 0) {
      break;
    }
  }

  if (
    errors.length === 0 &&
    !options.skip.has("project") &&
    packageJson?.scripts?.build
  ) {
    const projectStage = {
      id: "project",
      label: "Project build",
      command: "npm",
      args: ["run", "build"],
    };

    if (options.dryRun) {
      results.push({
        id: projectStage.id,
        status: "dry-run",
        command: projectStage.command,
        args: projectStage.args,
      });
    } else {
      console.log(`\n[MedOrbits] ${projectStage.label}`);

      const result = await runCommand(
        projectStage.command,
        projectStage.args,
        timeoutMs
      );

      results.push({
        id: projectStage.id,
        status: result.ok ? "passed" : "failed",
        durationMs: result.durationMs,
        exitCode: result.exitCode,
        error: result.error,
      });

      if (!result.ok) {
        addError("project", result.error || "Project build failed.");
      }
    }
  } else if (
    !options.skip.has("project") &&
    !packageJson?.scripts?.build
  ) {
    addWarning(
      "project",
      'No "build" script is configured in package.json; no project build was run.'
    );
  }

  if (errors.length === 0 && !options.dryRun) {
    checkBuildOutput(buildDirectory);
  }

  printReport(options, buildDirectory);

  if (errors.length > 0 || (options.strict && warnings.length > 0)) {
    process.exitCode = 1;
  }
}

function printReport(options, buildDirectory = null) {
  const failed =
    errors.length > 0 ||
    (options.strict && warnings.length > 0);

  const report = {
    ok: !failed,
    dryRun: options.dryRun,
    strict: options.strict,
    buildDirectory: buildDirectory ? relative(buildDirectory) : null,
    summary: {
      stages: results.length,
      passed: results.filter((item) => item.status === "passed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      errors: errors.length,
      warnings: warnings.length,
    },
    results,
    errors,
    warnings,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\nBuild Summary");
  console.log(`Stages: ${report.summary.stages}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Skipped: ${report.summary.skipped}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);

  for (const warning of warnings) {
    console.warn(`WARNING [${warning.stage}]: ${warning.message}`);
  }

  for (const error of errors) {
    console.error(`ERROR [${error.stage}]: ${error.message}`);
  }

  console.log(
    failed
      ? "\nBuild FAILED."
      : options.dryRun
        ? "\nDry run completed."
        : "\nBuild checks completed."
  );
}

main().catch((error) => {
  console.error(`[MedOrbits Build] ${messageOf(error)}`);
  process.exitCode = 1;
});
