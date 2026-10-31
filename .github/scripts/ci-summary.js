#!/usr/bin/env node
"use strict";

/**
 * MedOrbits -- CI Summary Generator
 * File: .github/scripts/ci-summary.js
 * Version: 2.0.0
 *
 * Purpose:
 *   Generate a Markdown summary for GitHub Actions workflow runs.
 *
 * Features:
 *   - GitHub Actions step summary integration.
 *   - Local Markdown report generation.
 *   - Optional JSON results input.
 *   - Test, validation, security and build summaries.
 *   - Workflow and Git metadata.
 *   - Markdown injection protection.
 *   - Input validation and bounded JSON reading.
 *   - Safe-integer validation for test counts.
 *   - Non-zero exit codes for failed checks.
 *   - Node.js built-in modules only.
 *
 * Requirements:
 *   Node.js >= 20
 *
 * Usage:
 *   node .github/scripts/ci-summary.js
 *   node .github/scripts/ci-summary.js --output ci-summary.md
 *   node .github/scripts/ci-summary.js --results artifacts/ci-results.json
 *   node .github/scripts/ci-summary.js --results artifacts/ci-results.json --strict
 *
 * Optional JSON input:
 * {
 *   "status": "success",
 *   "tests": {
 *     "passed": 42,
 *     "failed": 0,
 *     "skipped": 2
 *   },
 *   "checks": [
 *     {
 *       "name": "HTML validation",
 *       "status": "success"
 *     },
 *     {
 *       "name": "Link validation",
 *       "status": "success"
 *     }
 *   ],
 *   "security": {
 *     "status": "success",
 *     "findings": 0
 *   },
 *   "build": {
 *     "status": "success"
 *   },
 *   "notes": [
 *     "No deployment was performed."
 *   ]
 * }
 *
 * Exit codes:
 *   0 = Summary generated; no failure detected.
 *   1 = CI failure detected.
 *   2 = Invalid arguments, input or output error.
 */

const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");

const TOOL_NAME = "MedOrbits CI Summary Generator";
const TOOL_VERSION = "2.0.0";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 2000;
const MAX_CHECKS = 200;
const MAX_NOTES = 50;

const STATUS = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
  WARNING: "warning",
  UNKNOWN: "unknown",
});

const STATUS_SYMBOL = Object.freeze({
  success: "✅",
  failure: "❌",
  cancelled: "⏹️",
  skipped: "⏭️",
  warning: "⚠️",
  unknown: "ℹ️",
});

const VALID_STATUSES = new Set(
  Object.values(STATUS),
);

const STATUS_ALIASES = Object.freeze({
  passed: STATUS.SUCCESS,
  pass: STATUS.SUCCESS,
  ok: STATUS.SUCCESS,
  successful: STATUS.SUCCESS,
  succeeded: STATUS.SUCCESS,

  failed: STATUS.FAILURE,
  fail: STATUS.FAILURE,
  error: STATUS.FAILURE,
  errored: STATUS.FAILURE,

  canceled: STATUS.CANCELLED,
  cancelled: STATUS.CANCELLED,

  skipped: STATUS.SKIPPED,
  warning: STATUS.WARNING,
  warn: STATUS.WARNING,

  pending: STATUS.UNKNOWN,
  running: STATUS.UNKNOWN,
  unknown: STATUS.UNKNOWN,
});


/* ============================================================
   ARGUMENTS
============================================================ */

function parseArguments(argv) {
  const options = {
    output: null,
    results: null,
    title: "MedOrbits CI Summary",
    strict: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (argument === "--strict") {
      options.strict = true;
      continue;
    }

    if (
      argument === "--output" ||
      argument === "--results" ||
      argument === "--title"
    ) {
      const value = argv[index + 1];

      if (
        !value ||
        value.startsWith("--")
      ) {
        throw new Error(
          `Missing value for ${argument}.`,
        );
      }

      if (argument === "--output") {
        options.output = value;
      }

      if (argument === "--results") {
        options.results = value;
      }

      if (argument === "--title") {
        options.title = value;
      }

      index += 1;
      continue;
    }

    throw new Error(
      `Unknown argument: ${argument}`,
    );
  }

  return options;
}


function printHelp() {
  process.stdout.write(
    [
      TOOL_NAME,
      `Version: ${TOOL_VERSION}`,
      "",
      "Usage:",
      "  node .github/scripts/ci-summary.js [options]",
      "",
      "Options:",
      "  --output <file>    Write summary to a Markdown file.",
      "  --results <file>   Read optional JSON results.",
      "  --title <text>     Set the report title.",
      "  --strict           Fail when the overall status is unknown.",
      "  --help             Display this help message.",
      "",
      "Examples:",
      "  node .github/scripts/ci-summary.js",
      "  node .github/scripts/ci-summary.js --output ci-summary.md",
      "  node .github/scripts/ci-summary.js --results ci-results.json",
      "  node .github/scripts/ci-summary.js --results ci-results.json --strict",
      "",
    ].join("\n"),
  );
}


/* ============================================================
   NORMALIZATION AND SANITIZATION
============================================================ */

function normalizeStatus(value) {
  if (typeof value !== "string") {
    return STATUS.UNKNOWN;
  }

  const normalized = value.trim().toLowerCase();

  const status =
    STATUS_ALIASES[normalized] || normalized;

  return VALID_STATUSES.has(status)
    ? status
    : STATUS.UNKNOWN;
}


function safeText(value, fallback = "Not provided") {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      "",
    )
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  return cleaned || fallback;
}


function markdownText(value, fallback = "--") {
  return safeText(
    String(value ?? ""),
    fallback,
  )
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+.!|>~-])/g, "\\$1")
    .replace(/\r?\n/g, " ");
}


function markdownCell(value) {
  return safeText(
    String(value ?? ""),
    "--",
  )
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`")
    .replace(/\r?\n/g, " ")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function statusLabel(value) {
  const status = normalizeStatus(value);

  return `${STATUS_SYMBOL[status]} ${status}`;
}


function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


/* ============================================================
   JSON INPUT
============================================================ */

function readJsonFile(filename) {
  if (!filename) {
    return {};
  }

  const resolved = path.resolve(filename);

  let stat;

  try {
    stat = fs.lstatSync(resolved);
  } catch (error) {
    throw new Error(
      `Cannot access results file: ${error.message}`,
    );
  }

  if (stat.isSymbolicLink()) {
    throw new Error(
      "Results file must not be a symbolic link.",
    );
  }

  if (!stat.isFile()) {
    throw new Error(
      "Results path must point to a regular file.",
    );
  }

  if (stat.size > MAX_INPUT_BYTES) {
    throw new Error(
      `Results JSON exceeds the ${MAX_INPUT_BYTES} byte limit.`,
    );
  }

  let content;

  try {
    content = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read results file: ${error.message}`,
    );
  }

  if (!content.trim()) {
    throw new Error(
      "Results JSON file is empty.",
    );
  }

  if (content.charCodeAt(0) === 0xFEFF) {
    throw new Error(
      "Results JSON contains a UTF-8 BOM.",
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Invalid results JSON: ${error.message}`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new Error(
      "The JSON root must be an object.",
    );
  }

  return parsed;
}


/* ============================================================
   VALIDATION
============================================================ */

function validateCount(value, fieldName) {
  if (value === undefined || value === null) {
    return 0;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `Invalid count "${fieldName}": expected a non-negative safe integer.`,
    );
  }

  return value;
}


function buildTestSummary(tests) {
  if (
    tests === undefined ||
    tests === null
  ) {
    return {
      available: false,
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };
  }

  if (!isPlainObject(tests)) {
    throw new Error(
      '"tests" must be a JSON object.',
    );
  }

  const passed = validateCount(
    tests.passed,
    "tests.passed",
  );

  const failed = validateCount(
    tests.failed,
    "tests.failed",
  );

  const skipped = validateCount(
    tests.skipped,
    "tests.skipped",
  );

  const total = passed + failed + skipped;

  if (!Number.isSafeInteger(total)) {
    throw new Error(
      "Combined test total exceeds the safe integer limit.",
    );
  }

  return {
    available: true,
    passed,
    failed,
    skipped,
    total,
  };
}


function normalizeChecks(checks) {
  if (
    checks === undefined ||
    checks === null
  ) {
    return [];
  }

  if (!Array.isArray(checks)) {
    throw new Error(
      '"checks" must be an array.',
    );
  }

  if (checks.length > MAX_CHECKS) {
    throw new Error(
      `Too many checks. Maximum allowed: ${MAX_CHECKS}.`,
    );
  }

  return checks.map((check, index) => {
    if (!isPlainObject(check)) {
      throw new Error(
        `Invalid check entry at index ${index}.`,
      );
    }

    return {
      name: safeText(
        check.name,
        `Check ${index + 1}`,
      ),

      status: normalizeStatus(
        check.status,
      ),

      details: safeText(
        check.details,
        "",
      ),
    };
  });
}


function normalizeNotes(notes) {
  if (
    notes === undefined ||
    notes === null
  ) {
    return [];
  }

  if (!Array.isArray(notes)) {
    throw new Error(
      '"notes" must be an array.',
    );
  }

  return notes
    .filter((note) => typeof note === "string")
    .map((note) => safeText(note, ""))
    .filter(Boolean)
    .slice(0, MAX_NOTES);
}


function normalizeSecurity(security) {
  if (
    security === undefined ||
    security === null
  ) {
    return null;
  }

  if (!isPlainObject(security)) {
    throw new Error(
      '"security" must be a JSON object.',
    );
  }

  return {
    status: normalizeStatus(security.status),

    findings: validateCount(
      security.findings,
      "security.findings",
    ),
  };
}


function normalizeBuild(build) {
  if (
    build === undefined ||
    build === null
  ) {
    return null;
  }

  if (!isPlainObject(build)) {
    throw new Error(
      '"build" must be a JSON object.',
    );
  }

  return {
    status: normalizeStatus(build.status),

    details: safeText(
      build.details,
      "",
    ),
  };
}


/* ============================================================
   OVERALL STATUS
============================================================ */

function deriveOverallStatus(
  data,
  tests,
  checks,
  security,
  build,
) {
  const explicit = normalizeStatus(data.status);

  /*
   * A detected failure must never be overridden
   * by an explicit success status.
   */

  if (
    tests.failed > 0 ||
    checks.some(
      (check) => check.status === STATUS.FAILURE,
    ) ||
    (security && (
      security.status === STATUS.FAILURE ||
      security.findings > 0
    )) ||
    (build && build.status === STATUS.FAILURE)
  ) {
    return STATUS.FAILURE;
  }

  if (explicit === STATUS.FAILURE) {
    return STATUS.FAILURE;
  }

  if (explicit === STATUS.CANCELLED) {
    return STATUS.CANCELLED;
  }

  if (explicit === STATUS.SKIPPED) {
    return STATUS.SKIPPED;
  }

  if (explicit === STATUS.WARNING) {
    return STATUS.WARNING;
  }

  if (
    checks.some(
      (check) => check.status === STATUS.WARNING,
    ) ||
    (security && security.status === STATUS.WARNING) ||
    (build && build.status === STATUS.WARNING)
  ) {
    return STATUS.WARNING;
  }

  if (
    explicit === STATUS.UNKNOWN ||
    checks.some(
      (check) => check.status === STATUS.UNKNOWN,
    ) ||
    (security && security.status === STATUS.UNKNOWN) ||
    (build && build.status === STATUS.UNKNOWN)
  ) {
    return STATUS.UNKNOWN;
  }

  return STATUS.SUCCESS;
}


/* ============================================================
   WORKFLOW METADATA
============================================================ */

function getMetadata() {
  return {
    workflow: safeText(
      process.env.GITHUB_WORKFLOW,
      "Local execution",
    ),

    repository: safeText(
      process.env.GITHUB_REPOSITORY,
      "Local repository",
    ),

    branch: safeText(
      process.env.GITHUB_REF_NAME,
      "N/A",
    ),

    commit: safeText(
      process.env.GITHUB_SHA,
      "N/A",
    ),

    runNumber: safeText(
      process.env.GITHUB_RUN_NUMBER,
      "N/A",
    ),

    runAttempt: safeText(
      process.env.GITHUB_RUN_ATTEMPT,
      "N/A",
    ),

    actor: safeText(
      process.env.GITHUB_ACTOR,
      "N/A",
    ),

    event: safeText(
      process.env.GITHUB_EVENT_NAME,
      "N/A",
    ),
  };
}


/* ============================================================
   MARKDOWN GENERATION
============================================================ */

function buildSummary(data, options) {
  const tests = buildTestSummary(data.tests);

  const checks = normalizeChecks(
    data.checks,
  );

  const notes = normalizeNotes(
    data.notes,
  );

  const security = normalizeSecurity(
    data.security,
  );

  const build = normalizeBuild(
    data.build,
  );

  const overallStatus = deriveOverallStatus(
    data,
    tests,
    checks,
    security,
    build,
  );

  const metadata = getMetadata();

  const generatedAt = new Date().toISOString();

  const title = markdownText(
    options.title,
    "MedOrbits CI Summary",
  );

  const lines = [
    `# ${title}`,
    "",
    `**Overall status:** ${statusLabel(overallStatus)}`,
    "",
    "## Workflow Information",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Repository | ${markdownCell(metadata.repository)} |`,
    `| Workflow | ${markdownCell(metadata.workflow)} |`,
    `| Branch or ref | ${markdownCell(metadata.branch)} |`,
    `| Commit | ${markdownCell(metadata.commit)} |`,
    `| Run number | ${markdownCell(metadata.runNumber)} |`,
    `| Run attempt | ${markdownCell(metadata.runAttempt)} |`,
    `| Actor | ${markdownCell(metadata.actor)} |`,
    `| Event | ${markdownCell(metadata.event)} |`,
    `| Generated at (UTC) | ${generatedAt} |`,
    "",
    "## Test Results",
    "",
  ];

  if (tests.available) {
    lines.push(
      "| Passed | Failed | Skipped | Total |",
      "|---:|---:|---:|---:|",
      `| ${tests.passed} | ${tests.failed} | ${tests.skipped} | ${tests.total} |`,
      "",
    );
  } else {
    lines.push(
      "Test counts were not provided.",
      "",
    );
  }

  lines.push(
    "## Validation Checks",
    "",
  );

  if (checks.length > 0) {
    lines.push(
      "| Check | Status | Details |",
      "|---|---|---|",
    );

    for (const check of checks) {
      lines.push(
        `| ${markdownCell(check.name)} | ${markdownCell(statusLabel(check.status))} | ${markdownCell(check.details || "--")} |`,
      );
    }

    lines.push("");
  } else {
    lines.push(
      "No individual validation checks were provided.",
      "",
    );
  }

  if (build) {
    lines.push(
      "## Build Results",
      "",
      `- **Status:** ${statusLabel(build.status)}`,
    );

    if (build.details) {
      lines.push(
        `- **Details:** ${markdownCell(build.details)}`,
      );
    }

    lines.push("");
  }

  if (security) {
    lines.push(
      "## Security Review",
      "",
      `- **Status:** ${statusLabel(security.status)}`,
      `- **Reported findings:** ${security.findings}`,
      "",
    );
  }

  if (notes.length > 0) {
    lines.push(
      "## Notes",
      "",
    );

    for (const note of notes) {
      lines.push(
        `- ${markdownCell(note)}`,
      );
    }

    lines.push("");
  }

  lines.push(
    "---",
    "",
    `_Generated automatically by ${TOOL_NAME} v${TOOL_VERSION}._`,
    "",
  );

  return {
    markdown: lines.join("\n"),
    overallStatus,
    tests,
    checks,
    security,
    build,
    metadata,
    generatedAt,
  };
}


/* ============================================================
   OUTPUT
============================================================ */

function assertDifferentPaths(inputPath, outputPath) {
  if (!inputPath || !outputPath) {
    return;
  }

  const input = path.resolve(inputPath);
  const output = path.resolve(outputPath);

  if (input === output) {
    throw new Error(
      "Output path must not overwrite the results input file.",
    );
  }
}


function writeSummary(markdown, options) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;

  if (options.output) {
    const outputPath = path.resolve(
      options.output,
    );

    fs.mkdirSync(
      path.dirname(outputPath),
      { recursive: true },
    );

    fs.writeFileSync(
      outputPath,
      markdown,
      {
        encoding: "utf8",
        flag: "w",
      },
    );

    process.stdout.write(
      `CI summary written to ${outputPath}\n`,
    );

    return;
  }

  if (summaryPath) {
    const stat = fs.lstatSync(summaryPath);

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(
        "GITHUB_STEP_SUMMARY must point to a regular file.",
      );
    }

    fs.appendFileSync(
      summaryPath,
      `${markdown}\n`,
      "utf8",
    );

    process.stdout.write(
      "CI summary appended to GITHUB_STEP_SUMMARY.\n",
    );

    return;
  }

  process.stdout.write(markdown);
}


/* ============================================================
   MAIN
============================================================ */

function main() {
  let options;

  try {
    options = parseArguments(
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
    assertDifferentPaths(
      options.results,
      options.output,
    );

    const data = readJsonFile(
      options.results,
    );

    const summary = buildSummary(
      data,
      options,
    );

    writeSummary(
      summary.markdown,
      options,
    );

    if (
      summary.overallStatus === STATUS.FAILURE ||
      summary.tests.failed > 0
    ) {
      return 1;
    }

    if (
      options.strict &&
      summary.overallStatus === STATUS.UNKNOWN
    ) {
      process.stderr.write(
        "Strict mode: overall CI status is unknown.\n",
      );

      return 1;
    }

    return 0;

  } catch (error) {
    process.stderr.write(
      `CI summary error: ${error.message}\n`,
    );

    return 2;
  }
}


process.exitCode = main();