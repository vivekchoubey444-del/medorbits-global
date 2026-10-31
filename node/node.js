
#!/usr/bin/env node
"use strict";

/**
 * =============================================================================
 * MEDORBITS -- CENTRAL NODE.JS RUNTIME CONTROLLER
 * File: /node/node.js
 * Version: 2.0.0
 *
 * Responsibilities:
 * - Node.js and npm runtime validation
 * - Repository structure inspection
 * - Package configuration validation
 * - Dependency and lockfile inspection
 * - Environment configuration checks
 * - Security baseline checks
 * - Runtime health reporting
 * - Safe diagnostics and repair recommendations
 *
 * Safety:
 * - No automatic deployment
 * - No destructive Git commands
 * - No automatic dependency upgrades
 * - No secret disclosure
 * - No application file overwriting
 * =============================================================================
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const VERSION = "2.0.0";

const ROOT = path.resolve(__dirname, "..");
const NODE_DIR = __dirname;
const REPORT_DIR = path.join(NODE_DIR, "reports");

const REQUIRED_NODE_MAJOR = 20;

const REQUIRED_DIRECTORIES = [
  "assets",
  "pages",
  "api",
  "config",
  "tools",
  ".github"
];

const REQUIRED_FILES = [
  "package.json",
  "README.md"
];

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  ".repair-backups",
  "dist",
  "build",
  "coverage"
]);

const findings = [];

const summary = {
  checks: 0,
  passed: 0,
  warnings: 0,
  errors: 0,
  skipped: 0
};

function log(level, message, details = "") {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details
  };

  findings.push(record);

  const prefix = {
    PASS: "[PASS]",
    INFO: "[INFO]",
    WARN: "[WARN]",
    ERROR: "[ERROR]",
    SKIP: "[SKIP]"
  }[level] || "[INFO]";

  console.log(
    `${prefix} ${message}`,
    details ? `\n      ${details}` : ""
  );
}

function check(condition, message, details = "") {
  summary.checks++;

  if (condition) {
    summary.passed++;
    log("PASS", message, details);
  } else {
    summary.errors++;
    log("ERROR", message, details);
  }

  return Boolean(condition);
}

function warn(message, details = "") {
  summary.checks++;
  summary.warnings++;
  log("WARN", message, details);
}

function skip(message, details = "") {
  summary.skipped++;
  log("SKIP", message, details);
}

function exists(target) {
  return fs.existsSync(path.join(ROOT, target));
}

function safeRead(file) {
  const target = path.join(ROOT, file);

  if (!fs.existsSync(target)) {
    return null;
  }

  try {
    return fs.readFileSync(target, "utf8");
  } catch (error) {
    log("ERROR", `Cannot read ${file}`, error.message);
    summary.errors++;
    return null;
  }
}

function validateNode() {
  console.log("\n=== NODE.JS RUNTIME ===");

  const major = Number(process.versions.node.split(".")[0]);

  check(
    major >= REQUIRED_NODE_MAJOR,
    "Node.js version requirement",
    `Detected ${process.version}; required >= ${REQUIRED_NODE_MAJOR}`
  );

  check(
    process.platform.length > 0,
    "Operating system detected",
    `${process.platform} ${process.arch}`
  );

  check(
    process.execPath.length > 0,
    "Node.js executable available",
    process.execPath
  );

  log(
    "INFO",
    "Node.js runtime information",
    JSON.stringify({
      version: process.version,
      v8: process.versions.v8,
      platform: process.platform,
      architecture: process.arch,
      memory: os.totalmem()
    }, null, 2)
  );
}

function validateNpm() {
  console.log("\n=== NPM VALIDATION ===");

  try {
    const version = execFileSync(
      "npm",
      ["--version"],
      {
        encoding: "utf8",
        timeout: 10000
      }
    ).trim();

    const major = Number(version.split(".")[0]);

    check(
      major >= 10,
      "npm version requirement",
      `Detected npm ${version}; required >= 10`
    );

  } catch (error) {
    warn(
      "npm unavailable",
      "Install npm or ensure it is available in PATH."
    );
  }
}

function validateStructure() {
  console.log("\n=== PROJECT STRUCTURE ===");

  for (const directory of REQUIRED_DIRECTORIES) {
    if (exists(directory)) {
      summary.checks++;
      summary.passed++;
      log("PASS", `Directory exists: ${directory}`);
    } else {
      warn(
        `Optional or missing directory: ${directory}`,
        "Verify whether this directory is required by the project."
      );
    }
  }

  for (const file of REQUIRED_FILES) {
    check(
      exists(file),
      `Required file: ${file}`
    );
  }

  check(
    fs.existsSync(ROOT),
    "Repository root accessible",
    ROOT
  );
}

function validatePackage() {
  console.log("\n=== PACKAGE CONFIGURATION ===");

  const content = safeRead("package.json");

  if (!content) {
    warn(
      "Root package.json unavailable",
      "Package validation skipped."
    );
    return;
  }

  let pkg;

  try {
    pkg = JSON.parse(content);

    check(
      typeof pkg === "object" && pkg !== null && !Array.isArray(pkg),
      "package.json root is an object"
    );

  } catch (error) {
    check(
      false,
      "package.json JSON syntax",
      error.message
    );
    return;
  }

  check(
    typeof pkg.name === "string" && pkg.name.length > 0,
    "Package name configured"
  );

  check(
    typeof pkg.version === "string",
    "Package version configured"
  );

  if (pkg.scripts !== undefined) {
    check(
      typeof pkg.scripts === "object" &&
      pkg.scripts !== null &&
      !Array.isArray(pkg.scripts),
      "Package scripts configuration valid"
    );
  }

  const dependencies = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {})
  };

  log(
    "INFO",
    "Dependency inventory",
    `${Object.keys(dependencies).length} direct dependencies`
  );

  for (const name of Object.keys(dependencies)) {
    if (!/^[a-zA-Z0-9@._/-]+$/.test(name)) {
      warn(
        "Unusual dependency name",
        name
      );
    }
  }
}

function validateLockfile() {
  console.log("\n=== LOCKFILE VALIDATION ===");

  const packageLock = path.join(ROOT, "package-lock.json");

  const yarnLock = path.join(ROOT, "yarn.lock");

  const pnpmLock = path.join(ROOT, "pnpm-lock.yaml");

  const found = [
    packageLock,
    yarnLock,
    pnpmLock
  ].filter(file => fs.existsSync(file));

  if (found.length === 0) {
    warn(
      "No package lockfile detected",
      "Check the repository's package manager."
    );
    return;
  }

  if (fs.existsSync(packageLock)) {
    try {
      const lock = JSON.parse(
        fs.readFileSync(packageLock, "utf8")
      );

      check(
        lock.lockfileVersion !== undefined,
        "package-lock.json lockfileVersion exists"
      );

      check(
        typeof lock.packages === "object",
        "package-lock.json package inventory exists"
      );

    } catch (error) {
      check(
        false,
        "package-lock.json syntax",
        error.message
      );
    }
  }

  if (found.length > 1) {
    warn(
      "Multiple lockfiles detected",
      found.map(file => path.basename(file)).join(", ")
    );
  }
}

function validateEnvironment() {
  console.log("\n=== ENVIRONMENT VALIDATION ===");

  const envExample = path.join(ROOT, ".env.example");
  const envLocal = path.join(ROOT, ".env");

  if (fs.existsSync(envExample)) {
    check(
      true,
      ".env.example exists"
    );
  } else {
    warn(
      ".env.example not found",
      "Create a sanitized environment template if required."
    );
  }

  if (fs.existsSync(envLocal)) {
    warn(
      ".env exists",
      "Verify that it is excluded from Git. Values are never printed."
    );
  }

  const gitignore = safeRead(".gitignore");

  if (gitignore) {
    const protectsEnv =
      /^\.env(?:\.\*)?$/m.test(gitignore) ||
      /^\.env\/?$/m.test(gitignore);

    check(
      protectsEnv,
      ".gitignore protects environment files",
      protectsEnv ? "" : "Review .env exclusion rules."
    );
  } else {
    warn(
      ".gitignore unavailable",
      "Verify secret-file exclusions."
    );
  }
}

function validateSecurity() {
  console.log("\n=== SECURITY BASELINE ===");

  const packageContent = safeRead("package.json");

  if (!packageContent) {
    skip("Security package checks skipped");
    return;
  }

  let pkg;

  try {
    pkg = JSON.parse(packageContent);
  } catch {
    skip("Invalid package.json; security check skipped");
    return;
  }

  const scripts = pkg.scripts || {};

  const securityScripts = [
    "audit",
    "lint",
    "test"
  ];

  for (const script of securityScripts) {
    if (scripts[script]) {
      log(
        "PASS",
        `Security/quality script available: ${script}`
      );
      summary.checks++;
      summary.passed++;
    } else {
      warn(
        `Missing recommended npm script: ${script}`
      );
    }
  }

  const lockExists = fs.existsSync(
    path.join(ROOT, "package-lock.json")
  );

  if (!lockExists) {
    warn(
      "No npm lockfile for reproducible dependency installation"
    );
  }
}

function validateGit() {
  console.log("\n=== GIT VALIDATION ===");

  try {
    const result = execFileSync(
      "git",
      ["rev-parse", "--show-toplevel"],
      {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 10000
      }
    ).trim();

    check(
      path.resolve(result) === ROOT,
      "Git repository root matches project root",
      result
    );

  } catch {
    warn(
      "Git repository could not be detected",
      "Git checks skipped."
    );
  }
}

function validateRequiredPaths() {
  console.log("\n=== CONFIGURATION PATHS ===");

  const paths = [
    "server.js",
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    ".github/dependabot.yml"
  ];

  for (const file of paths) {
    if (exists(file)) {
      log("PASS", `Detected: ${file}`);
      summary.checks++;
      summary.passed++;
    } else {
      log(
        "INFO",
        `Not present: ${file}`,
        "May be optional depending on the project structure."
      );
    }
  }
}

function createReport() {
  console.log("\n=== REPORT GENERATION ===");

  fs.mkdirSync(REPORT_DIR, {
    recursive: true
  });

  const report = {
    application: "MedOrbits",
    controller: "node/node.js",
    version: VERSION,
    generatedAt: new Date().toISOString(),
    repository: ROOT,
    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    summary,
    findings
  };

  const jsonFile = path.join(
    REPORT_DIR,
    "node-health-report.json"
  );

  const markdownFile = path.join(
    REPORT_DIR,
    "node-health-report.md"
  );

  fs.writeFileSync(
    jsonFile,
    JSON.stringify(report, null, 2),
    "utf8"
  );

  const markdown = [
    "# MedOrbits Node.js Health Report",
    "",
    `Version: ${VERSION}`,
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    ...Object.entries(summary).map(
      ([key, value]) => `- ${key}: ${value}`
    ),
    "",
    "## Findings",
    "",
    ...findings.map(
      item =>
        `- **${item.level}** ${item.message}` +
        (item.details ? ` -- ${item.details}` : "")
    )
  ].join("\n");

  fs.writeFileSync(
    markdownFile,
    markdown,
    "utf8"
  );

  log(
    "PASS",
    "Node.js diagnostic reports generated",
    REPORT_DIR
  );
}

function main() {
  console.log(`
=================================================
 MEDORBITS CENTRAL NODE.JS CONTROLLER
 Version: ${VERSION}
=================================================
`);

  try {
    validateNode();
    validateNpm();
    validateStructure();
    validatePackage();
    validateLockfile();
    validateEnvironment();
    validateSecurity();
    validateGit();
    validateRequiredPaths();

    createReport();

  } catch (error) {
    summary.errors++;

    log(
      "ERROR",
      "Unexpected controller failure",
      error.stack || error.message
    );
  }

  console.log(`
=================================================
 MEDORBITS NODE.JS DIAGNOSTIC SUMMARY
=================================================

Checks:   ${summary.checks}
Passed:   ${summary.passed}
Warnings: ${summary.warnings}
Errors:   ${summary.errors}
Skipped:  ${summary.skipped}

`);

  if (summary.errors > 0) {
    console.log("STATUS: ACTION REQUIRED");
    process.exitCode = 1;
  } else {
    console.log("STATUS: DIAGNOSTICS COMPLETED");
  }
}

main();
