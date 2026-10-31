
#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * MEDORBITS -- CI SUMMARY GENERATOR
 * File: .github/scripts/ci-summary.js
 * Version: 2.1.3
 *
 * Purpose:
 *   Generate a structured Continuous Integration summary for GitHub Actions.
 *
 * Features:
 *   - CI job result reporting
 *   - GitHub Actions step summary integration
 *   - Environment metadata
 *   - Workflow status evaluation
 *   - Markdown report generation
 *   - JSON report generation
 *   - Safe handling of missing environment variables
 *   - Local execution support
 *
 * Usage:
 *   node .github/scripts/ci-summary.js
 *   node .github/scripts/ci-summary.js --json
 *   node .github/scripts/ci-summary.js --output reports/ci-summary.md
 *
 * Exit codes:
 *   0 = All required jobs passed
 *   1 = One or more jobs failed
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

const DEFAULT_OUTPUT = path.join(
  ROOT,
  "ci-summary.md"
);

// ============================================================================
// UTILITIES
// ============================================================================

function log(message) {
  process.stdout.write(`[MedOrbits CI] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[ERROR] ${message}\n`);
}

function getEnv(name, fallback = "Not available") {
  const value = process.env[name];

  return value && value.trim()
    ? value.trim()
    : fallback;
}

function normalizeStatus(value) {
  const allowed = new Set([
    "success",
    "failure",
    "cancelled",
    "skipped",
    "neutral",
    "unknown"
  ]);

  const normalized = String(value || "unknown")
    .trim()
    .toLowerCase();

  return allowed.has(normalized)
    ? normalized
    : "unknown";
}

function escapeMarkdown(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

// ============================================================================
// CI JOB COLLECTION
// ============================================================================

function collectJobs() {
  const definitions = [
    {
      id: "repository",
      label: "Repository Validation",
      env: "REPOSITORY_RESULT"
    },
    {
      id: "node",
      label: "Node.js Validation",
      env: "NODE_RESULT"
    },
    {
      id: "python",
      label: "Python Validation",
      env: "PYTHON_RESULT"
    },
    {
      id: "security",
      label: "Security Validation",
      env: "SECURITY_RESULT"
    }
  ];

  return definitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    status: normalizeStatus(
      process.env[definition.env]
    )
  }));
}

// ============================================================================
// STATUS EVALUATION
// ============================================================================

function evaluateJobs(jobs) {
  const passed = jobs.filter(
    (job) => job.status === "success"
  );

  const failed = jobs.filter(
    (job) => job.status === "failure"
  );

  const cancelled = jobs.filter(
    (job) => job.status === "cancelled"
  );

  const skipped = jobs.filter(
    (job) => job.status === "skipped"
  );

  const unknown = jobs.filter(
    (job) => job.status === "unknown"
  );

  const allPassed =
    jobs.length > 0 &&
    passed.length === jobs.length;

  let overall = "failure";

  if (allPassed) {
    overall = "success";
  } else if (cancelled.length > 0) {
    overall = "cancelled";
  } else if (
    failed.length === 0 &&
    unknown.length === 0 &&
    skipped.length > 0
  ) {
    overall = "incomplete";
  }

  return {
    overall,
    total: jobs.length,
    passed: passed.length,
    failed: failed.length,
    cancelled: cancelled.length,
    skipped: skipped.length,
    unknown: unknown.length
  };
}

// ============================================================================
// REPORT METADATA
// ============================================================================

function collectMetadata() {
  return {
    project: "MedOrbits",
    generator: "MedOrbits CI Summary Generator",
    version: VERSION,

    repository: getEnv("GITHUB_REPOSITORY"),
    branch: getEnv("GITHUB_REF_NAME"),
    commit: getEnv("GITHUB_SHA"),
    workflow: getEnv("GITHUB_WORKFLOW"),
    runId: getEnv("GITHUB_RUN_ID"),
    runNumber: getEnv("GITHUB_RUN_NUMBER"),
    actor: getEnv("GITHUB_ACTOR"),

    event: getEnv("GITHUB_EVENT_NAME"),
    runner: getEnv("RUNNER_OS", process.platform),

    nodeVersion: process.version,
    generatedAt: new Date().toISOString()
  };
}

// ============================================================================
// REPORT MODEL
// ============================================================================

function createReport() {
  const jobs = collectJobs();

  const summary = evaluateJobs(jobs);

  const metadata = collectMetadata();

  return {
    metadata,
    summary,
    jobs,
    status: summary.overall
  };
}

// ============================================================================
// MARKDOWN GENERATION
// ============================================================================

function statusLabel(status) {
  const labels = {
    success: "PASSED",
    failure: "FAILED",
    cancelled: "CANCELLED",
    skipped: "SKIPPED",
    neutral: "NEUTRAL",
    unknown: "UNKNOWN",
    incomplete: "INCOMPLETE"
  };

  return labels[status] || "UNKNOWN";
}

function createMarkdown(report) {
  const metadata = report.metadata;
  const summary = report.summary;

  const lines = [
    "# MedOrbits -- CI Report",
    "",
    `**Overall Status:** ${statusLabel(report.status)}`,
    "",
    "## Workflow Information",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Project | ${escapeMarkdown(metadata.project)} |`,
    `| Repository | ${escapeMarkdown(metadata.repository)} |`,
    `| Branch | ${escapeMarkdown(metadata.branch)} |`,
    `| Commit | ${escapeMarkdown(metadata.commit)} |`,
    `| Workflow | ${escapeMarkdown(metadata.workflow)} |`,
    `| Run ID | ${escapeMarkdown(metadata.runId)} |`,
    `| Event | ${escapeMarkdown(metadata.event)} |`,
    `| Runner | ${escapeMarkdown(metadata.runner)} |`,
    `| Node.js | ${escapeMarkdown(metadata.nodeVersion)} |`,
    `| Generated | ${escapeMarkdown(metadata.generatedAt)} |`,
    "",
    "## Job Results",
    "",
    "| Job | Status |",
    "|---|---|"
  ];

  for (const job of report.jobs) {
    lines.push(
      `| ${escapeMarkdown(job.label)} | ${statusLabel(job.status)} |`
    );
  }

  lines.push(
    "",
    "## Summary Statistics",
    "",
    "| Metric | Count |",
    "|---|---:|",
    `| Total jobs | ${summary.total} |`,
    `| Passed | ${summary.passed} |`,
    `| Failed | ${summary.failed} |`,
    `| Cancelled | ${summary.cancelled} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Unknown | ${summary.unknown} |`,
    "",
    "---",
    "",
    "Generated automatically by MedOrbits CI."
  );

  return lines.join("\n") + "\n";
}

// ============================================================================
// OUTPUT HANDLING
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
// GITHUB ACTIONS INTEGRATION
// ============================================================================

function writeGitHubSummary(content) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryPath) {
    log("GitHub step summary is unavailable; local execution detected.");
    return false;
  }

  fs.appendFileSync(summaryPath, content, {
    encoding: "utf8"
  });

  log("GitHub Actions step summary updated.");

  return true;
}

// ============================================================================
// CLI
// ============================================================================

function parseArguments(argv) {
  const options = {
    format: "markdown",
    output: null,
    githubSummary: true,
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

      case "--no-github-summary":
        options.githubSummary = false;
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
MedOrbits CI Summary Generator

Usage:
  node .github/scripts/ci-summary.js [options]

Options:
  --json                 Generate JSON report
  --markdown             Generate Markdown report
  --output FILE          Save report to a file
  --no-github-summary    Disable GitHub step summary
  --version              Display version
  --help                 Display help

Environment variables:
  REPOSITORY_RESULT
  NODE_RESULT
  PYTHON_RESULT
  SECURITY_RESULT
  GITHUB_REPOSITORY
  GITHUB_REF_NAME
  GITHUB_SHA
  GITHUB_WORKFLOW
  GITHUB_RUN_ID
  GITHUB_RUN_NUMBER
  GITHUB_EVENT_NAME
  GITHUB_STEP_SUMMARY
`);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  try {
    const options = parseArguments(
      process.argv.slice(2)
    );

    if (options.help) {
      printHelp();
      return 0;
    }

    if (options.version) {
      log(`Version ${VERSION}`);
      return 0;
    }

    log("Generating CI report.");

    const report = createReport();

    const markdown = createMarkdown(report);

    if (options.githubSummary) {
      writeGitHubSummary(markdown);
    }

    if (options.format === "json") {
      const json = JSON.stringify(report, null, 2) + "\n";

      if (options.output) {
        writeOutput(options.output, json);
      } else {
        process.stdout.write(json);
      }
    } else {
      if (options.output) {
        writeOutput(options.output, markdown);
      } else if (!options.githubSummary) {
        process.stdout.write(markdown);
      }
    }

    log(`Overall status: ${report.status}`);

    if (report.status === "success") {
      log("All CI jobs passed.");
      return 0;
    }

    logError("One or more CI jobs did not pass.");

    return 1;

  } catch (err) {
    logError(err.message);
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
  collectJobs,
  collectMetadata,
  createMarkdown,
  createReport,
  evaluateJobs,
  normalizeStatus
};

// ============================================================================
// END OF MEDORBITS CI SUMMARY GENERATOR
// ============================================================================
