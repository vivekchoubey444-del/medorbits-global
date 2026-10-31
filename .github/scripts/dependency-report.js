
#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * MEDORBITS -- DEPENDENCY REPORT GENERATOR
 * File: .github/scripts/dependency-report.js
 * Version: 2.1.3
 *
 * Purpose:
 *   Generate a structured report of project dependencies.
 *
 * Features:
 *   - Production dependency reporting
 *   - Development dependency reporting
 *   - Package metadata validation
 *   - Lockfile consistency checks
 *   - Dependency count summaries
 *   - Security-relevant package information
 *   - JSON report generation
 *   - Markdown report generation
 *   - CI-friendly exit codes
 *
 * Usage:
 *   node .github/scripts/dependency-report.js
 *   node .github/scripts/dependency-report.js --json
 *   node .github/scripts/dependency-report.js --markdown
 *   node .github/scripts/dependency-report.js --output report.json
 *
 * Exit codes:
 *   0 = Report generated successfully
 *   1 = Dependency validation errors
 *   2 = Execution or configuration error
 * ============================================================================
 */

const fs = require("node:fs");
const path = require("node:path");

// ============================================================================
// CONFIGURATION
// ============================================================================

const VERSION = "2.1.3";

const ROOT = path.resolve(__dirname, "../..");

const PACKAGE_FILE = path.join(ROOT, "package.json");

const LOCK_FILE = path.join(ROOT, "package-lock.json");

const DEFAULT_OUTPUT = path.join(
  ROOT,
  "dependency-report.json"
);

// ============================================================================
// UTILITIES
// ============================================================================

function log(message) {
  process.stdout.write(`[MedOrbits] ${message}\n`);
}

function error(message) {
  process.stderr.write(`[ERROR] ${message}\n`);
}

function readJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${path.basename(filePath)}: ${err.message}`
    );
  }
}

function sortObject(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );
}

// ============================================================================
// PACKAGE VALIDATION
// ============================================================================

function validatePackage(pkg) {
  const errors = [];

  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    throw new Error("package.json must contain a JSON object.");
  }

  if (
    typeof pkg.name !== "string" ||
    !pkg.name.trim()
  ) {
    errors.push("Package name is missing.");
  }

  if (
    typeof pkg.version !== "string" ||
    !pkg.version.trim()
  ) {
    errors.push("Package version is missing.");
  }

  if (
    pkg.dependencies !== undefined &&
    (
      typeof pkg.dependencies !== "object" ||
      pkg.dependencies === null ||
      Array.isArray(pkg.dependencies)
    )
  ) {
    errors.push("dependencies must be a JSON object.");
  }

  if (
    pkg.devDependencies !== undefined &&
    (
      typeof pkg.devDependencies !== "object" ||
      pkg.devDependencies === null ||
      Array.isArray(pkg.devDependencies)
    )
  ) {
    errors.push("devDependencies must be a JSON object.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

// ============================================================================
// DEPENDENCY ANALYSIS
// ============================================================================

function analyzeDependencies(pkg) {
  const production = sortObject(pkg.dependencies || {});

  const development = sortObject(pkg.devDependencies || {});

  const optional = sortObject(pkg.optionalDependencies || {});

  const peer = sortObject(pkg.peerDependencies || {});

  const bundled = Array.isArray(pkg.bundleDependencies)
    ? [...pkg.bundleDependencies].sort()
    : [];

  const productionCount = Object.keys(production).length;

  const developmentCount = Object.keys(development).length;

  const optionalCount = Object.keys(optional).length;

  const peerCount = Object.keys(peer).length;

  const totalDeclared =
    productionCount +
    developmentCount +
    optionalCount +
    peerCount;

  return {
    production,
    development,
    optional,
    peer,
    bundled,
    summary: {
      production: productionCount,
      development: developmentCount,
      optional: optionalCount,
      peer: peerCount,
      totalDeclared
    }
  };
}

// ============================================================================
// LOCKFILE VALIDATION
// ============================================================================

function validateLockfile(pkg, lock) {
  const warnings = [];

  if (
    !lock ||
    typeof lock !== "object" ||
    Array.isArray(lock)
  ) {
    throw new Error("package-lock.json must contain a JSON object.");
  }

  if (
    lock.lockfileVersion === undefined ||
    !Number.isInteger(lock.lockfileVersion)
  ) {
    throw new Error("Invalid or missing lockfileVersion.");
  }

  if (
    lock.name &&
    pkg.name &&
    lock.name !== pkg.name
  ) {
    throw new Error(
      "package.json and package-lock.json names do not match."
    );
  }

  if (
    lock.version &&
    pkg.version &&
    lock.version !== pkg.version
  ) {
    throw new Error(
      "package.json and package-lock.json versions do not match."
    );
  }

  if (
    lock.lockfileVersion >= 2 &&
    lock.packages &&
    typeof lock.packages === "object"
  ) {
    const rootPackage = lock.packages[""];

    if (rootPackage) {
      for (const field of [
        "dependencies",
        "devDependencies",
        "optionalDependencies",
        "peerDependencies"
      ]) {
        if (
          rootPackage[field] &&
          JSON.stringify(sortObject(rootPackage[field])) !==
            JSON.stringify(sortObject(pkg[field] || {}))
        ) {
          warnings.push(
            `Root lockfile ${field} differs from package.json.`
          );
        }
      }
    }
  }

  return {
    lockfileVersion: lock.lockfileVersion,
    warnings
  };
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function createReport(pkg, dependencies, lockInfo) {
  return {
    metadata: {
      project: pkg.name || "MedOrbits",
      version: pkg.version || "Not specified",
      generatedAt: new Date().toISOString(),
      generator: "MedOrbits Dependency Report",
      generatorVersion: VERSION,
      nodeVersion: process.version,
      platform: process.platform
    },

    scripts: sortObject(pkg.scripts || {}),

    engines: pkg.engines || {},

    dependencies,

    lockfile: lockInfo,

    status: "completed"
  };
}

// ============================================================================
// MARKDOWN REPORT
// ============================================================================

function createMarkdown(report) {
  const lines = [
    "# MedOrbits Dependency Report",
    "",
    `**Project:** ${report.metadata.project}`,
    `**Version:** ${report.metadata.version}`,
    `**Generated:** ${report.metadata.generatedAt}`,
    `**Node.js:** ${report.metadata.nodeVersion}`,
    "",
    "## Dependency Summary",
    "",
    "| Type | Count |",
    "|---|---:|",
    `| Production | ${report.dependencies.summary.production} |`,
    `| Development | ${report.dependencies.summary.development} |`,
    `| Optional | ${report.dependencies.summary.optional} |`,
    `| Peer | ${report.dependencies.summary.peer} |`,
    `| Total declared | ${report.dependencies.summary.totalDeclared} |`,
    "",
    "## Production Dependencies",
    ""
  ];

  for (const [name, version] of Object.entries(
    report.dependencies.production
  )) {
    lines.push(`- \`${name}\`: \`${version}\``);
  }

  lines.push(
    "",
    "## Development Dependencies",
    ""
  );

  for (const [name, version] of Object.entries(
    report.dependencies.development
  )) {
    lines.push(`- \`${name}\`: \`${version}\``);
  }

  lines.push(
    "",
    "## Optional Dependencies",
    ""
  );

  for (const [name, version] of Object.entries(
    report.dependencies.optional
  )) {
    lines.push(`- \`${name}\`: \`${version}\``);
  }

  lines.push(
    "",
    "## Peer Dependencies",
    ""
  );

  for (const [name, version] of Object.entries(
    report.dependencies.peer
  )) {
    lines.push(`- \`${name}\`: \`${version}\``);
  }

  lines.push(
    "",
    "## Lockfile",
    "",
    `Lockfile version: ${report.lockfile.lockfileVersion}`,
    "",
    "## Warnings",
    ""
  );

  if (report.lockfile.warnings.length === 0) {
    lines.push("No lockfile consistency warnings.");
  } else {
    for (const warning of report.lockfile.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push(
    "",
    "---",
    "",
    "Generated automatically by MedOrbits."
  );

  return lines.join("\n") + "\n";
}

// ============================================================================
// OUTPUT
// ============================================================================

function writeOutput(outputPath, content) {
  const absolutePath = path.resolve(ROOT, outputPath);

  const relativePath = path.relative(ROOT, absolutePath);

  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "Output path must remain inside the repository."
    );
  }

  fs.mkdirSync(path.dirname(absolutePath), {
    recursive: true
  });

  fs.writeFileSync(absolutePath, content, {
    encoding: "utf8",
    flag: "w"
  });

  log(`Report saved: ${relativePath}`);
}

// ============================================================================
// CLI ARGUMENTS
// ============================================================================

function parseArguments(argv) {
  const options = {
    format: "summary",
    output: null,
    help: false,
    version: false
  };

  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i];

    switch (argument) {
      case "--json":
        options.format = "json";
        break;

      case "--markdown":
        options.format = "markdown";
        break;

      case "--output":
        if (!argv[i + 1]) {
          throw new Error("--output requires a file path.");
        }

        options.output = argv[++i];
        break;

      case "--help":
      case "-h":
        options.help = true;
        break;

      case "--version":
        options.version = true;
        break;

      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function printHelp() {
  process.stdout.write(`
MedOrbits Dependency Report Generator

Usage:
  node .github/scripts/dependency-report.js [options]

Options:
  --json       Generate JSON output
  --markdown   Generate Markdown output
  --output     Specify output file
  --version    Display version
  --help       Display help

Examples:
  node .github/scripts/dependency-report.js
  node .github/scripts/dependency-report.js --json
  node .github/scripts/dependency-report.js --markdown
  node .github/scripts/dependency-report.js --json --output reports/dependencies.json
`);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));

    if (options.help) {
      printHelp();
      return 0;
    }

    if (options.version) {
      log(`Version ${VERSION}`);
      return 0;
    }

    log("Starting dependency analysis.");

    const pkg = readJSON(PACKAGE_FILE);

    validatePackage(pkg);

    const dependencies = analyzeDependencies(pkg);

    let lockInfo;

    if (fs.existsSync(LOCK_FILE)) {
      const lock = readJSON(LOCK_FILE);

      lockInfo = validateLockfile(pkg, lock);
    } else {
      lockInfo = {
        lockfileVersion: null,
        warnings: ["package-lock.json not found."]
      };
    }

    const report = createReport(
      pkg,
      dependencies,
      lockInfo
    );

    if (options.format === "json") {
      const output = JSON.stringify(report, null, 2) + "\n";

      if (options.output) {
        writeOutput(options.output, output);
      } else {
        process.stdout.write(output);
      }

    } else if (options.format === "markdown") {
      const output = createMarkdown(report);

      if (options.output) {
        writeOutput(options.output, output);
      } else {
        process.stdout.write(output);
      }

    } else {
      log(`Project: ${report.metadata.project}`);
      log(`Version: ${report.metadata.version}`);

      log(
        `Production dependencies: ${dependencies.summary.production}`
      );

      log(
        `Development dependencies: ${dependencies.summary.development}`
      );

      log(
        `Optional dependencies: ${dependencies.summary.optional}`
      );

      log(
        `Peer dependencies: ${dependencies.summary.peer}`
      );

      log(
        `Total declared dependencies: ${dependencies.summary.totalDeclared}`
      );

      log(
        `Lockfile version: ${lockInfo.lockfileVersion ?? "Not found"}`
      );

      for (const warning of lockInfo.warnings) {
        process.stderr.write(`[WARNING] ${warning}\n`);
      }
    }

    log("Dependency analysis completed.");

    return 0;

  } catch (err) {
    error(err.message);
    return 2;
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  analyzeDependencies,
  createMarkdown,
  createReport,
  validateLockfile,
  validatePackage
};

// ============================================================================
// END OF MEDORBITS DEPENDENCY REPORT GENERATOR
// ============================================================================
