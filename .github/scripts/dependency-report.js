
#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- Dependency Report Generator
 * File: .github/scripts/dependency-report.js
 * Version: 2.0.0
 *
 * Purpose:
 *   Inventory project dependencies and generate CI-friendly reports.
 *
 * Features:
 *   - Inspects root and server npm projects.
 *   - Reports production, development, optional and peer dependencies.
 *   - Detects missing manifests and lockfiles.
 *   - Reports Node.js engine and package-manager metadata.
 *   - Optionally executes npm audit --json.
 *   - Inventories Python dependency manifests.
 *   - Generates Markdown and JSON reports.
 *   - Validates report destinations.
 *   - Uses Node.js built-in modules only.
 *
 * Requirements:
 *   Node.js >= 20
 *
 * Safety:
 *   - Does not install, update or remove dependencies.
 *   - Does not modify package manifests or lockfiles.
 *   - Does not execute package scripts.
 *   - npm audit requires network access when enabled.
 *
 * Usage:
 *   node .github/scripts/dependency-report.js
 *   node .github/scripts/dependency-report.js --root .
 *   node .github/scripts/dependency-report.js --output reports/dependencies.md
 *   node .github/scripts/dependency-report.js --json reports/dependencies.json
 *   node .github/scripts/dependency-report.js --audit
 *   node .github/scripts/dependency-report.js --strict
 *   node .github/scripts/dependency-report.js --no-python
 *
 * Exit codes:
 *   0 = Report generated successfully.
 *   1 = Strict-mode validation failure.
 *   2 = Argument, input or output error.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const process = require("node:process");
const { spawnSync } = require("node:child_process");

const TOOL_NAME = "MedOrbits Dependency Report Generator";
const TOOL_VERSION = "2.0.0";

const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_REQUIREMENTS_BYTES = 2 * 1024 * 1024;
const MAX_DEPENDENCIES = 10000;

const NPM_PROJECT_DIRECTORIES = [
  "",
  "server",
];

const NPM_LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
];

const PYTHON_MANIFESTS = [
  "requirements.txt",
  "requirements-dev.txt",
  "requirements-test.txt",
  "requirements-prod.txt",
  "pyproject.toml",
  "Pipfile",
  "Pipfile.lock",
  "poetry.lock",
  "uv.lock",
];


/* ============================================================
   ARGUMENT PARSING
============================================================ */

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    output: null,
    json: null,
    audit: false,
    strict: false,
    includePython: true,
    help: false,
    auditTimeout: 120000,
  };

  const valueOptions = new Map([
    ["--root", "root"],
    ["--output", "output"],
    ["--json", "json"],
    ["--audit-timeout", "auditTimeout"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--audit") {
      options.audit = true;
      continue;
    }

    if (argument === "--strict") {
      options.strict = true;
      continue;
    }

    if (argument === "--no-python") {
      options.includePython = false;
      continue;
    }

    if (valueOptions.has(argument)) {
      const value = argv[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${argument}.`);
      }

      const key = valueOptions.get(argument);

      options[key] = key === "auditTimeout"
        ? Number(value)
        : value;

      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (
    !Number.isSafeInteger(options.auditTimeout) ||
    options.auditTimeout < 1000 ||
    options.auditTimeout > 900000
  ) {
    throw new Error(
      "--audit-timeout must be between 1000 and 900000 milliseconds.",
    );
  }

  options.root = path.resolve(options.root);

  return options;
}


function printHelp() {
  process.stdout.write([
    TOOL_NAME,
    `Version: ${TOOL_VERSION}`,
    "",
    "Usage:",
    "  node .github/scripts/dependency-report.js [options]",
    "",
    "Options:",
    "  --root <dir>             Repository root.",
    "  --output <file>          Write Markdown report.",
    "  --json <file>            Write JSON report.",
    "  --audit                  Run npm audit --json.",
    "  --audit-timeout <ms>     Audit timeout; default 120000.",
    "  --strict                 Fail on missing manifests, lockfiles or audit errors.",
    "  --no-python              Skip Python dependency inventory.",
    "  --help                   Display this help.",
    "",
    "The script does not install, update or remove dependencies.",
    "",
  ].join("\n"));
}


/* ============================================================
   GENERAL UTILITIES
============================================================ */

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function safeRelative(filename, root) {
  return path.relative(root, filename)
    .split(path.sep)
    .join("/") || ".";
}


function isRegularFile(filename) {
  try {
    return fs.lstatSync(filename).isFile();
  } catch {
    return false;
  }
}


function isRegularDirectory(filename) {
  try {
    return fs.lstatSync(filename).isDirectory();
  } catch {
    return false;
  }
}


function readBoundedFile(filename, maxBytes) {
  const stat = fs.lstatSync(filename);

  if (stat.isSymbolicLink()) {
    throw new Error("Symbolic links are not accepted.");
  }

  if (!stat.isFile()) {
    throw new Error("Path is not a regular file.");
  }

  if (stat.size > maxBytes) {
    throw new Error(
      `File exceeds the ${maxBytes} byte inspection limit.`,
    );
  }

  const content = fs.readFileSync(filename);

  if (content.length > maxBytes) {
    throw new Error(
      `File exceeds the ${maxBytes} byte inspection limit.`,
    );
  }

  return content;
}


function readJsonFile(filename) {
  const raw = readBoundedFile(
    filename,
    MAX_MANIFEST_BYTES,
  );

  if (raw.length === 0) {
    throw new Error("JSON file is empty.");
  }

  if (
    raw.length >= 3 &&
    raw[0] === 0xEF &&
    raw[1] === 0xBB &&
    raw[2] === 0xBF
  ) {
    throw new Error("JSON file contains a UTF-8 BOM.");
  }

  const content = raw.toString("utf8");

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error.message}`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      "JSON manifest root must be an object.",
    );
  }

  return parsed;
}


function markdownEscape(value) {
  return String(value ?? "--")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`")
    .replace(/\r?\n/g, " ")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function safeVersion(value) {
  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return "[invalid version declaration]";
}


/* ============================================================
   DEPENDENCY INVENTORY
============================================================ */

function collectDeclaredDependencies(manifest) {
  const groups = [
    ["dependencies", "production"],
    ["devDependencies", "development"],
    ["optionalDependencies", "optional"],
    ["peerDependencies", "peer"],
  ];

  const dependencies = [];
  const errors = [];

  for (const [field, type] of groups) {
    const entries = manifest[field];

    if (entries === undefined) {
      continue;
    }

    if (!isPlainObject(entries)) {
      errors.push(
        `"${field}" must be a JSON object.`,
      );
      continue;
    }

    const names = Object.keys(entries);

    if (dependencies.length + names.length > MAX_DEPENDENCIES) {
      errors.push(
        `Dependency inventory exceeds ${MAX_DEPENDENCIES} entries.`,
      );
      break;
    }

    for (const name of names) {
      if (
        !name.trim() ||
        typeof entries[name] !== "string" ||
        !entries[name].trim()
      ) {
        errors.push(
          `Invalid dependency declaration in "${field}": ${name}`,
        );
        continue;
      }

      dependencies.push({
        name,
        requestedVersion: safeVersion(entries[name]),
        type,
      });
    }
  }

  dependencies.sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    dependencies,
    errors,
  };
}


function inspectNpmProject(root, relativeDirectory) {
  const directory = path.resolve(
    root,
    relativeDirectory || ".",
  );

  const displayDirectory = relativeDirectory || ".";

  const manifestPath = path.join(
    directory,
    "package.json",
  );

  const base = {
    directory: displayDirectory,
    manifest: null,
    lockfiles: [],
    status: "ok",
    package: null,
    dependencies: [],
    dependencyCounts: {
      production: 0,
      development: 0,
      optional: 0,
      peer: 0,
      total: 0,
    },
    errors: [],
  };

  if (!isRegularDirectory(directory)) {
    base.status = "missing-project-directory";
    base.errors.push(
      `Project directory does not exist or is not a regular directory: ${displayDirectory}`,
    );
    return base;
  }

  let directoryEntries;

  try {
    directoryEntries = new Set(
      fs.readdirSync(directory),
    );
  } catch (error) {
    base.status = "directory-error";
    base.errors.push(
      `Cannot inspect project directory: ${error.message}`,
    );
    return base;
  }

  for (const name of NPM_LOCKFILES) {
    if (!directoryEntries.has(name)) {
      continue;
    }

    const lockPath = path.join(directory, name);

    if (isRegularFile(lockPath)) {
      base.lockfiles.push(
        safeRelative(lockPath, root),
      );
    }
  }

  if (!directoryEntries.has("package.json")) {
    base.status = "missing-manifest";
    base.errors.push(
      `Missing ${displayDirectory}/package.json`,
    );
    return base;
  }

  if (!isRegularFile(manifestPath)) {
    base.status = "invalid-manifest";
    base.errors.push(
      "package.json is not a regular file.",
    );
    return base;
  }

  base.manifest = safeRelative(
    manifestPath,
    root,
  );

  let manifest;

  try {
    manifest = readJsonFile(manifestPath);
  } catch (error) {
    base.status = "invalid-manifest";
    base.errors.push(
      `Could not read package manifest: ${error.message}`,
    );
    return base;
  }

  const collected = collectDeclaredDependencies(manifest);

  base.dependencies = collected.dependencies;
  base.errors.push(...collected.errors);

  const packageName =
    typeof manifest.name === "string" &&
    manifest.name.trim()
      ? manifest.name
      : null;

  const packageVersion =
    typeof manifest.version === "string" &&
    manifest.version.trim()
      ? manifest.version
      : null;

  const engines = manifest.engines === undefined
    ? {}
    : manifest.engines;

  if (!isPlainObject(engines)) {
    base.errors.push(
      '"engines" must be a JSON object.',
    );
  }

  const packageManager =
    typeof manifest.packageManager === "string"
      ? manifest.packageManager
      : null;

  base.package = {
    name: packageName,
    version: packageVersion,
    private: manifest.private === true,
    license:
      typeof manifest.license === "string"
        ? manifest.license
        : null,
    engines: isPlainObject(engines)
      ? engines
      : {},
    packageManager,
  };

  for (const dependency of base.dependencies) {
    base.dependencyCounts[dependency.type] += 1;
  }

  base.dependencyCounts.total =
    base.dependencies.length;

  if (base.errors.length > 0) {
    base.status = "invalid-manifest";
  } else if (base.lockfiles.length === 0) {
    base.status = "missing-lockfile";
    base.errors.push(
      `No recognized lockfile found in ${displayDirectory}.`,
    );
  }

  return base;
}


/* ============================================================
   PYTHON DEPENDENCY INVENTORY
============================================================ */

function parsePythonRequirements(filename, root) {
  const result = {
    path: safeRelative(filename, root),
    status: "ok",
    entries: [],
    errors: [],
  };

  let content;

  try {
    content = readBoundedFile(
      filename,
      MAX_REQUIREMENTS_BYTES,
    ).toString("utf8");
  } catch (error) {
    result.status = "unreadable";
    result.errors.push(error.message);
    return result;
  }

  const lines = content.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    let line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      return;
    }

    // Remove trailing comments only when separated by whitespace.
    line = line.replace(/\s+#.*$/, "").trim();

    if (!line) {
      return;
    }

    let kind = "requirement";

    if (
      /^(-r|--requirement|-c|--constraint)\s+/i.test(line)
    ) {
      kind = "include-or-constraint";
    } else if (line.startsWith("-")) {
      kind = "pip-option";
    }

    result.entries.push({
      line: index + 1,
      requirement: line,
      kind,
    });
  });

  return result;
}


function inspectPython(root) {
  const results = [];

  for (const name of PYTHON_MANIFESTS) {
    const absolute = path.join(root, name);

    if (!fs.existsSync(absolute)) {
      continue;
    }

    if (!isRegularFile(absolute)) {
      results.push({
        path: name,
        status: "invalid-path",
        errors: [
          "Python dependency manifest is not a regular file.",
        ],
      });
      continue;
    }

    if (
      name.startsWith("requirements") &&
      name.endsWith(".txt")
    ) {
      results.push(
        parsePythonRequirements(absolute, root),
      );
    } else {
      results.push({
        path: name,
        status: "present",
        note: (
          "Manifest detected. Dependency details are not parsed "
          + "by this inventory utility."
        ),
      });
    }
  }

  return results;
}


/* ============================================================
   NPM AUDIT
============================================================ */

function runNpmAudit(project, root, timeout) {
  if (!project.manifest) {
    return {
      status: "skipped",
      reason: "No valid package.json found.",
    };
  }

  const npmLockfiles = project.lockfiles.filter(
    (filename) =>
      filename.endsWith("/package-lock.json") ||
      filename === "package-lock.json" ||
      filename.endsWith("/npm-shrinkwrap.json") ||
      filename === "npm-shrinkwrap.json",
  );

  if (npmLockfiles.length === 0) {
    return {
      status: "skipped",
      reason: (
        "npm audit requires package-lock.json or "
        + "npm-shrinkwrap.json."
      ),
    };
  }

  const directory = path.resolve(
    root,
    project.directory,
  );

  const command = process.platform === "win32"
    ? "npm.cmd"
    : "npm";

  const args = [
    "audit",
    "--json",
    "--no-fund",
  ];

  let result;

  try {
    result = spawnSync(command, args, {
      cwd: directory,
      encoding: "utf8",
      timeout,
      maxBuffer: DEFAULT_MAX_OUTPUT_BYTES,
      windowsHide: true,
      shell: false,
    });
  } catch (error) {
    return {
      status: "error",
      reason: `Could not start npm audit: ${error.message}`,
    };
  }

  if (result.error) {
    const timedOut =
      result.error.code === "ETIMEDOUT";

    const outputLimit =
      result.error.code === "ENOBUFS";

    return {
      status: "error",
      reason: timedOut
        ? `npm audit timed out after ${timeout} ms.`
        : outputLimit
          ? "npm audit output exceeded the configured buffer limit."
          : `npm audit execution failed: ${result.error.message}`,
    };
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  let auditJson;

  try {
    auditJson = JSON.parse(
      stdout.trim() || stderr.trim(),
    );
  } catch {
    return {
      status: "error",
      reason: "npm audit did not return valid JSON.",
      exitCode: result.status,
      signal: result.signal || null,
    };
  }

  if (!isPlainObject(auditJson)) {
    return {
      status: "error",
      reason: "npm audit JSON root is not an object.",
      exitCode: result.status,
    };
  }

  const metadata = isPlainObject(auditJson.metadata)
    ? auditJson.metadata
    : {};

  const vulnerabilities = isPlainObject(
    metadata.vulnerabilities,
  )
    ? metadata.vulnerabilities
    : {};

  const counts = {};

  for (const level of [
    "info",
    "low",
    "moderate",
    "high",
    "critical",
    "total",
  ]) {
    const value = Number(
      vulnerabilities[level] || 0,
    );

    counts[level] =
      Number.isSafeInteger(value) && value >= 0
        ? value
        : 0;
  }

  const hasVulnerabilities =
    counts.total > 0 ||
    counts.critical > 0 ||
    counts.high > 0 ||
    counts.moderate > 0 ||
    counts.low > 0 ||
    counts.info > 0;

  const auditStatus =
    hasVulnerabilities
      ? "vulnerabilities-found"
      : result.status === 0
        ? "clean"
        : "error";

  return {
    status: auditStatus,
    exitCode: result.status,
    signal: result.signal || null,
    vulnerabilities: counts,
    reportVersion:
      auditJson.auditReportVersion || null,
    summary: hasVulnerabilities
      ? "npm audit reported vulnerabilities."
      : result.status === 0
        ? "npm audit completed without reported vulnerabilities."
        : "npm audit returned a non-zero exit code.",
  };
}


/* ============================================================
   REPORT GENERATION
============================================================ */

function buildReport(options) {
  let rootStat;

  try {
    rootStat = fs.lstatSync(options.root);
  } catch {
    throw new Error(
      `Repository root does not exist: ${options.root}`,
    );
  }

  if (
    rootStat.isSymbolicLink() ||
    !rootStat.isDirectory()
  ) {
    throw new Error(
      "Repository root must be a regular directory, not a symbolic link.",
    );
  }

  const npmProjects = NPM_PROJECT_DIRECTORIES.map(
    (directory) =>
      inspectNpmProject(
        options.root,
        directory,
      ),
  );

  const pythonManifests = options.includePython
    ? inspectPython(options.root)
    : [];

  const warnings = [];

  for (const project of npmProjects) {
    for (const error of project.errors) {
      warnings.push(
        `${project.directory}: ${error}`,
      );
    }
  }

  const report = {
    schemaVersion: 2,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    generatedAt: new Date().toISOString(),
    repositoryRoot: options.root,

    runtime: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
    },

    npmProjects,
    pythonManifests,
    warnings,
    audits: null,
  };

  if (options.audit) {
    report.audits = npmProjects.map(
      (project) => ({
        directory: project.directory,
        result: runNpmAudit(
          project,
          options.root,
          options.auditTimeout,
        ),
      }),
    );
  }

  return report;
}


/* ============================================================
   MARKDOWN REPORT
============================================================ */

function renderMarkdown(report) {
  const lines = [
    "# MedOrbits Dependency Report",
    "",
    `- **Generated:** ${report.generatedAt}`,
    `- **Node.js:** ${markdownEscape(report.runtime.node)}`,
    `- **Platform:** ${markdownEscape(report.runtime.platform)}`,
    `- **Architecture:** ${markdownEscape(report.runtime.architecture)}`,
    "",
    "## npm Projects",
    "",
    "| Directory | Package | Version | Status | Production | Development | Optional | Peer | Total |",
    "|---|---|---|---|---:|---:|---:|---:|---:|",
  ];

  for (const project of report.npmProjects) {
    const packageName = project.package
      ? project.package.name || "(unnamed)"
      : "--";

    const packageVersion = project.package
      ? project.package.version || "--"
      : "--";

    const counts = project.dependencyCounts;

    lines.push(
      `| ${markdownEscape(project.directory)}`
      + ` | ${markdownEscape(packageName)}`
      + ` | ${markdownEscape(packageVersion)}`
      + ` | ${markdownEscape(project.status)}`
      + ` | ${counts.production}`
      + ` | ${counts.development}`
      + ` | ${counts.optional}`
      + ` | ${counts.peer}`
      + ` | ${counts.total} |`,
    );
  }

  lines.push(
    "",
    "## Package Metadata",
    "",
  );

  for (const project of report.npmProjects) {
    lines.push(
      `### ${markdownEscape(project.directory)}`,
      "",
    );

    if (!project.package) {
      lines.push("Package metadata unavailable.", "");
      continue;
    }

    lines.push(
      `- **Name:** ${markdownEscape(project.package.name)}`,
      `- **Version:** ${markdownEscape(project.package.version)}`,
      `- **Private:** ${project.package.private}`,
      `- **License:** ${markdownEscape(project.package.license)}`,
      `- **Package manager:** ${markdownEscape(project.package.packageManager)}`,
      `- **Node.js requirement:** ${markdownEscape(project.package.engines.node || "--")}`,
      "",
    );
  }

  lines.push(
    "## Lockfiles",
    "",
  );

  for (const project of report.npmProjects) {
    lines.push(
      `### ${markdownEscape(project.directory)}`,
    );

    if (project.lockfiles.length === 0) {
      lines.push("- No recognized lockfile detected.");
    } else {
      for (const lockfile of project.lockfiles) {
        lines.push(
          `- \`${markdownEscape(lockfile)}\``,
        );
      }
    }

    lines.push("");
  }

  lines.push(
    "## Declared Dependencies",
    "",
  );

  for (const project of report.npmProjects) {
    lines.push(
      `### ${markdownEscape(project.directory)}`,
      "",
    );

    if (project.dependencies.length === 0) {
      lines.push("No valid dependency declarations found.", "");
      continue;
    }

    lines.push(
      "| Package | Requested version | Type |",
      "|---|---|---|",
    );

    for (const dependency of project.dependencies) {
      lines.push(
        `| ${markdownEscape(dependency.name)}`
        + ` | ${markdownEscape(dependency.requestedVersion)}`
        + ` | ${markdownEscape(dependency.type)} |`,
      );
    }

    lines.push("");
  }

  if (report.pythonManifests.length > 0) {
    lines.push(
      "## Python Dependency Manifests",
      "",
    );

    for (const manifest of report.pythonManifests) {
      lines.push(
        `### ${markdownEscape(manifest.path)}`,
        `- **Status:** ${markdownEscape(manifest.status)}`,
      );

      if (manifest.entries) {
        lines.push(
          `- **Requirement entries:** ${manifest.entries.length}`,
          "",
        );

        for (const entry of manifest.entries) {
          lines.push(
            `- Line ${entry.line}: \`${markdownEscape(entry.requirement)}\` (${markdownEscape(entry.kind)})`,
          );
        }
      } else if (manifest.note) {
        lines.push(
          `- ${markdownEscape(manifest.note)}`,
        );
      }

      if (manifest.errors) {
        for (const error of manifest.errors) {
          lines.push(
            `- **Error:** ${markdownEscape(error)}`,
          );
        }
      }

      lines.push("");
    }
  }

  if (report.audits) {
    lines.push(
      "## npm Security Audit",
      "",
    );

    for (const audit of report.audits) {
      lines.push(
        `### ${markdownEscape(audit.directory)}`,
        `- **Status:** ${markdownEscape(audit.result.status)}`,
      );

      const result = audit.result;

      if (result.vulnerabilities) {
        const v = result.vulnerabilities;

        lines.push(
          `- **Total:** ${v.total}`,
          `- **Critical:** ${v.critical}`,
          `- **High:** ${v.high}`,
          `- **Moderate:** ${v.moderate}`,
          `- **Low:** ${v.low}`,
          `- **Informational:** ${v.info}`,
        );
      }

      if (result.reason) {
        lines.push(
          `- **Details:** ${markdownEscape(result.reason)}`,
        );
      }

      if (result.summary) {
        lines.push(
          `- ${markdownEscape(result.summary)}`,
        );
      }

      lines.push("");
    }
  }

  if (report.warnings.length > 0) {
    lines.push(
      "## Inventory Warnings",
      "",
    );

    for (const warning of report.warnings) {
      lines.push(
        `- ${markdownEscape(warning)}`,
      );
    }

    lines.push("");
  }

  lines.push(
    "---",
    "",
    `_Generated by ${TOOL_NAME} v${TOOL_VERSION}._`,
    "",
  );

  return lines.join("\n");
}


/* ============================================================
   SAFE REPORT OUTPUT
============================================================ */

function canonicalPath(filename) {
  const absolute = path.resolve(filename);

  try {
    return fs.realpathSync(absolute);
  } catch {
    return path.resolve(
      path.dirname(absolute),
      path.basename(absolute),
    );
  }
}


function validateOutputPaths(options, report) {
  const destinations = [];

  if (options.output) {
    destinations.push({
      type: "markdown",
      filename: options.output,
    });
  }

  if (options.json) {
    destinations.push({
      type: "json",
      filename: options.json,
    });
  }

  if (destinations.length === 2) {
    if (
      canonicalPath(destinations[0].filename) ===
      canonicalPath(destinations[1].filename)
    ) {
      throw new Error(
        "Markdown and JSON report destinations must be different files.",
      );
    }
  }

  const sourceFiles = new Set();

  for (const project of report.npmProjects) {
    if (project.manifest) {
      sourceFiles.add(
        canonicalPath(
          path.join(options.root, project.manifest),
        ),
      );
    }

    for (const lockfile of project.lockfiles) {
      sourceFiles.add(
        canonicalPath(
          path.join(options.root, lockfile),
        ),
      );
    }
  }

  for (const manifest of report.pythonManifests) {
    sourceFiles.add(
      canonicalPath(
        path.join(options.root, manifest.path),
      ),
    );
  }

  for (const destination of destinations) {
    const absolute = path.resolve(destination.filename);

    if (sourceFiles.has(canonicalPath(absolute))) {
      throw new Error(
        `Report destination would overwrite a dependency source file: ${absolute}`,
      );
    }

    if (fs.existsSync(absolute)) {
      const stat = fs.lstatSync(absolute);

      if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error(
          `Report destination must be a regular file: ${absolute}`,
        );
      }
    }
  }
}


function writeFileSafely(filename, content) {
  const absolute = path.resolve(filename);

  fs.mkdirSync(
    path.dirname(absolute),
    { recursive: true },
  );

  if (fs.existsSync(absolute)) {
    const stat = fs.lstatSync(absolute);

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(
        `Output destination is not a regular file: ${absolute}`,
      );
    }
  }

  fs.writeFileSync(
    absolute,
    content,
    {
      encoding: "utf8",
      flag: "w",
    },
  );

  return absolute;
}


/* ============================================================
   STRICT MODE
============================================================ */

function hasStrictFailures(report, options) {
  const npmInventoryFailure = report.npmProjects.some(
    (project) =>
      project.status === "missing-manifest" ||
      project.status === "invalid-manifest" ||
      project.status === "missing-lockfile" ||
      project.status === "missing-project-directory" ||
      project.status === "directory-error",
  );

  const pythonInventoryFailure =
    report.pythonManifests.some(
      (manifest) =>
        manifest.status === "unreadable" ||
        manifest.status === "invalid-path",
    );

  const auditFailure =
    (report.audits || []).some(
      (audit) =>
        audit.result.status === "error" ||
        audit.result.status === "vulnerabilities-found",
    );

  return (
    npmInventoryFailure ||
    pythonInventoryFailure ||
    (options.audit && auditFailure)
  );
}


/* ============================================================
   MAIN
============================================================ */

function main() {
  let options;

  try {
    options = parseArgs(
      process.argv.slice(2),
    );
  } catch (error) {
    process.stderr.write(
      `Argument error: ${error.message}\n`,
    );

    return 2;
  }

  if (options.help) {
    printHelp();
    return 0;
  }

  try {
    const report = buildReport(options);

    validateOutputPaths(
      options,
      report,
    );

    const markdown = renderMarkdown(report);

    if (options.output) {
      const output = writeFileSafely(
        options.output,
        markdown,
      );

      process.stdout.write(
        `Markdown report written to ${output}\n`,
      );
    } else {
      process.stdout.write(markdown);
    }

    if (options.json) {
      const output = writeFileSafely(
        options.json,
        `${JSON.stringify(report, null, 2)}\n`,
      );

      process.stdout.write(
        `JSON report written to ${output}\n`,
      );
    }

    if (
      options.strict &&
      hasStrictFailures(report, options)
    ) {
      process.stderr.write(
        "STRICT FAILURE: Dependency inventory or audit checks failed.\n",
      );

      return 1;
    }

    process.stdout.write(
      "Dependency report completed.\n",
    );

    return 0;

  } catch (error) {
    process.stderr.write(
      `Dependency report error: ${error.message}\n`,
    );

    return 2;
  }
}


process.exitCode = main();
