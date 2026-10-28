#!/usr/bin/env node
/**
 * MedOrbits -- Site Build Orchestrator
 * File: /scripts/build-site.mjs
 *
 * Requirements:
 *   Node.js 20+
 *
 * Usage:
 *   node scripts/build-site.mjs
 *   node scripts/build-site.mjs --dry-run
 *   node scripts/build-site.mjs --json
 *   node scripts/build-site.mjs --help
 *
 * Optional environment:
 *   BUILD_TIMEOUT_MS=300000
 *   BUILD_CONFIG=build.config.json
 *
 * Configuration:
 *   Optional build.config.json in the repository root.
 *
 * Safety:
 *   - Does not execute commands through a shell.
 *   - Does not install packages or modify dependencies.
 *   - Does not delete build directories.
 *   - Validates configured task executables and arguments.
 *   - Supports a dry-run mode.
 *   - Stops after a required task fails.
 *   - Keeps runtime storage outside generated public assets.
 *
 * Note:
 *   This orchestrator does not assume a specific bundler. It can run
 *   explicitly configured tasks, or perform safe repository checks when
 *   no build configuration is present.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CONFIG = "build.config.json";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_TASKS = 100;
const MAX_ARGS = 100;
const MAX_ARG_LENGTH = 4000;
const args = process.argv.slice(2);
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}
function parsePositiveInteger(value, label, maximum) {
  if (!/^\d+$/.test(String(value))) {
    throw new Error(`${label} must be a positive integer.`);
  }
  const number = Number(value);
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    number > maximum
  ) {
    throw new Error(`${label} must be between 1 and ${maximum}.`);
  }
  return number;
}
function parseArguments(argv) {
  const options = {
    dryRun: false,
    json: false,
    help: false,
    config: process.env.BUILD_CONFIG || DEFAULT_CONFIG,
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
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--config=(.*)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    if (seen.has("config")) {
      throw new Error("--config was provided more than once.");
    }
    seen.add("config");
    if (!match[1].trim()) {
      throw new Error("--config cannot be empty.");
    }
    options.config = match[1];
  }
  return options;
}
function resolveRepositoryPath(input, label) {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.includes("\0")
  ) {
    throw new Error(`${label} must be a non-empty path.`);
  }
  const resolved = path.resolve(ROOT_DIR, input);
  if (!isInside(ROOT_DIR, resolved)) {
    throw new Error(`${label} must remain inside the repository.`);
  }
  return resolved;
}
function assertNoSymlinkComponents(target) {
  const relative = path.relative(ROOT_DIR, target);
  let current = ROOT_DIR;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new Error(
          `Symbolic links are not permitted in build paths: ${path.relative(
            ROOT_DIR,
            current
          )}`
        );
      }
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
  }
}
function readBuildConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {
      tasks: [],
      strict: false,
    };
  }
  assertNoSymlinkComponents(configPath);
  const stat = fs.lstatSync(configPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Build configuration must be a regular file.");
  }
  if (stat.size > MAX_CONFIG_BYTES) {
    throw new Error("Build configuration exceeds the maximum size.");
  }
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    throw new Error("Build configuration contains invalid JSON.");
  }
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config)
  ) {
    throw new Error("Build configuration root must be an object.");
  }
  if (config.tasks === undefined) {
    config.tasks = [];
  }
  if (!Array.isArray(config.tasks) || config.tasks.length > MAX_TASKS) {
    throw new Error(`Build configuration tasks must be an array of at most ${MAX_TASKS} entries.`);
  }
  if (config.strict !== undefined && typeof config.strict !== "boolean") {
    throw new Error("Build configuration strict must be a boolean.");
  }
  return config;
}
function validateTask(task, index) {
  if (
    !task ||
    typeof task !== "object" ||
    Array.isArray(task)
  ) {
    throw new Error(`tasks[${index}] must be an object.`);
  }
  if (
    typeof task.name !== "string" ||
    !task.name.trim() ||
    task.name.length > 120
  ) {
    throw new Error(`tasks[${index}].name is invalid.`);
  }
  if (
    typeof task.command !== "string" ||
    !/^[a-zA-Z0-9_.-]+$/.test(task.command)
  ) {
    throw new Error(
      `tasks[${index}].command must be a simple executable name, not a shell command.`
    );
  }
  const taskArgs = task.args === undefined ? [] : task.args;
  if (
    !Array.isArray(taskArgs) ||
    taskArgs.length > MAX_ARGS ||
    taskArgs.some(
      (value) =>
        typeof value !== "string" ||
        value.length > MAX_ARG_LENGTH ||
        value.includes("\0")
    )
  ) {
    throw new Error(`tasks[${index}].args is invalid.`);
  }
  const cwd = task.cwd === undefined
    ? "."
    : task.cwd;
  if (typeof cwd !== "string" || !cwd.trim()) {
    throw new Error(`tasks[${index}].cwd is invalid.`);
  }
  const resolvedCwd = resolveRepositoryPath(
    cwd,
    `tasks[${index}].cwd`
  );
  if (!fs.existsSync(resolvedCwd)) {
    throw new Error(`Task working directory does not exist: ${cwd}`);
  }
  const cwdStat = fs.lstatSync(resolvedCwd);
  if (!cwdStat.isDirectory() || cwdStat.isSymbolicLink()) {
    throw new Error(`Task working directory must be a real directory: ${cwd}`);
  }
  if (
    task.required !== undefined &&
    typeof task.required !== "boolean"
  ) {
    throw new Error(`tasks[${index}].required must be a boolean.`);
  }
  return {
    name: task.name.trim(),
    command: task.command,
    args: taskArgs,
    cwd: resolvedCwd,
    required: task.required !== false,
  };
}
function verifyNodeProject() {
  const packagePath = path.join(ROOT_DIR, "package.json");
  if (!fs.existsSync(packagePath)) {
    return {
      ok: true,
      skipped: true,
      message: "No root package.json found; generic build checks only.",
    };
  }
  const stat = fs.lstatSync(packagePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("package.json must be a regular file.");
  }
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    throw new Error("package.json contains invalid JSON.");
  }
  if (!packageJson || typeof packageJson !== "object") {
    throw new Error("package.json root must be an object.");
  }
  const scripts = packageJson.scripts || {};
  if (
    typeof scripts !== "object" ||
    Array.isArray(scripts)
  ) {
    throw new Error("package.json scripts must be an object.");
  }
  return {
    ok: true,
    skipped: false,
    packageName:
      typeof packageJson.name === "string"
        ? packageJson.name
        : null,
    availableScripts: Object.keys(scripts).sort(),
  };
}
function executeTask(task, timeoutMs, dryRun) {
  if (dryRun) {
    return Promise.resolve({
      name: task.name,
      command: task.command,
      args: task.args,
      status: "planned",
      required: task.required,
    });
  }
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let stdout = "";
    let stderr = "";
    const child = spawn(task.command, task.args, {
      cwd: task.cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let forceKillTimer;
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 3000);
      forceKillTimer.unref();
      finish({
        name: task.name,
        status: "timeout",
        required: task.required,
        durationMs: Date.now() - startedAt,
        error: `Task exceeded timeout of ${timeoutMs} ms.`,
      });
    }, timeoutMs);
    timeout.unref();
    function finish(result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
      resolve(result);
    }
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      // Keep output bounded in memory; logs can be enabled separately.
      if (stdout.length < 16_000) {
        stdout += chunk.toString("utf8").slice(0, 16_000 - stdout.length);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderr.length < 16_000) {
        stderr += chunk.toString("utf8").slice(0, 16_000 - stderr.length);
      }
    });
    child.on("error", (error) => {
      finish({
        name: task.name,
        status: "error",
        required: task.required,
        durationMs: Date.now() - startedAt,
        error: messageOf(error),
      });
    });
    child.on("close", (code, signal) => {
      finish({
        name: task.name,
        status: code === 0 ? "passed" : "failed",
        required: task.required,
        exitCode: code,
        signal,
        durationMs: Date.now() - startedAt,
        stdoutBytes,
        stderrBytes,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}
async function buildSite({
  config = DEFAULT_CONFIG,
  dryRun = false,
} = {}) {
  const timeoutMs = parsePositiveInteger(
    process.env.BUILD_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    "BUILD_TIMEOUT_MS",
    MAX_TIMEOUT_MS
  );
  const configPath = resolveRepositoryPath(config, "Build configuration");
  const project = verifyNodeProject();
  const configData = readBuildConfig(configPath);
  const tasks = configData.tasks.map(validateTask);
  if (configData.strict && tasks.length === 0) {
    throw new Error(
      "Strict build configuration requires at least one task."
    );
  }
  const results = [];
  let failedRequiredTask = false;
  for (const task of tasks) {
    if (failedRequiredTask) {
      results.push({
        name: task.name,
        status: "skipped",
        required: task.required,
        reason: "A previous required task failed.",
      });
      continue;
    }
    const result = await executeTask(task, timeoutMs, dryRun);
    results.push(result);
    if (
      task.required &&
      !["passed", "planned"].includes(result.status)
    ) {
      failedRequiredTask = true;
    }
  }
  const requiredFailures = results.filter(
    (result) =>
      result.required &&
      !["passed", "planned", "skipped"].includes(result.status)
  );
  return {
    ok: requiredFailures.length === 0,
    dryRun,
    root: ".",
    project,
    taskCount: tasks.length,
    results,
    requiredFailures: requiredFailures.length,
  };
}
async function main() {
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    console.error(`[MedOrbits Build] ${messageOf(error)}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(`MedOrbits Site Build Orchestrator
Usage:
  node scripts/build-site.mjs [options]
Options:
  --config=PATH   Build configuration JSON path
  --dry-run       Validate configuration without running tasks
  --json          Print JSON output
  --help          Show this help
Environment:
  BUILD_CONFIG
  BUILD_TIMEOUT_MS
If build.config.json is absent, no external tasks are executed.
`);
    return;
  }
  try {
    const result = await buildSite({
      config: options.config,
      dryRun: options.dryRun,
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("MedOrbits Site Build");
      console.log(`Status: ${result.ok ? "passed" : "failed"}`);
      console.log(`Dry run: ${result.dryRun ? "yes" : "no"}`);
      console.log(`Tasks: ${result.taskCount}`);
      for (const task of result.results) {
        console.log(
          `- ${task.name}: ${task.status}` +
          (task.durationMs !== undefined
            ? ` (${task.durationMs} ms)`
            : "")
        );
        if (task.error) {
          console.error(`  ${task.error}`);
        }
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    const result = {
      ok: false,
      error: messageOf(error),
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`[MedOrbits Build] ${result.error}`);
    }
    process.exitCode = 1;
  }
}
main();