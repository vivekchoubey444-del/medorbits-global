
#!/usr/bin/env node

'use strict';

/**
 * MedOrbits -- JSON Validation Utility
 * -----------------------------------
 * File: scripts/validate-json.js
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Features:
 * - Recursively validates JSON files.
 * - Reports syntax errors with line and column where available.
 * - Detects UTF-8 BOMs and warns without modifying source files.
 * - Supports strict mode, where warnings fail validation.
 * - Supports configurable root directory and excluded directories.
 * - Supports hidden-file inclusion.
 * - Avoids following symbolic links.
 * - Enforces a configurable maximum JSON file size.
 * - Detects files changed during validation where practical.
 * - Handles unreadable files and directory traversal errors.
 * - Produces deterministic, human-readable CI output.
 * - Returns stable exit codes.
 *
 * Usage:
 *   node scripts/validate-json.js
 *   node scripts/validate-json.js --strict
 *   node scripts/validate-json.js --root ./api
 *   node scripts/validate-json.js --exclude uploads --exclude temp
 *   node scripts/validate-json.js --include-hidden
 *   node scripts/validate-json.js --max-size 20
 *   node scripts/validate-json.js --json
 *   node scripts/validate-json.js --help
 *
 * Exit codes:
 *   0 = success
 *   1 = validation failure
 *   2 = invalid arguments or fatal configuration error
 *
 * This script validates JSON syntax only. It does not validate JSON Schema.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.netlify',
];

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const MAX_REPORTED_ISSUES = 1000;

const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILURE: 1,
  CONFIGURATION_ERROR: 2,
});

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

  --json
      Output the final report as JSON instead of a human-readable report.

  --help, -h
      Display this help message.

Examples:
  node scripts/validate-json.js
  node scripts/validate-json.js --strict
  node scripts/validate-json.js --root ./api
  node scripts/validate-json.js --exclude uploads --exclude temp
  node scripts/validate-json.js --include-hidden --strict
  node scripts/validate-json.js --max-size 20
  node scripts/validate-json.js --json
`);
}

function parseArguments(args) {
  const options = {
    root: process.cwd(),
    strict: false,
    includeHidden: false,
    maxSizeMB: DEFAULT_MAX_FILE_SIZE_MB,
    excludedDirectories: new Set(DEFAULT_IGNORED_DIRECTORIES),
    jsonOutput: false,
    help: false,
    errors: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true;
        break;

      case '--strict':
        options.strict = true;
        break;

      case '--include-hidden':
        options.includeHidden = true;
        break;

      case '--json':
        options.jsonOutput = true;
        break;

      case '--root': {
        const value = args[index + 1];

        if (!value || value.startsWith('--')) {
          options.errors.push('--root requires a directory path.');
          break;
        }

        options.root = path.resolve(process.cwd(), value);
        index += 1;
        break;
      }

      case '--exclude': {
        const value = args[index + 1];

        if (!value || value.startsWith('--')) {
          options.errors.push('--exclude requires a directory name.');
          break;
        }

        if (
          value === '.' ||
          value === '..' ||
          value.includes('/') ||
          value.includes('\\')
        ) {
          options.errors.push(
            `Invalid exclusion "${value}". Supply a directory name, not a path.`,
          );
          break;
        }

        options.excludedDirectories.add(value);
        index += 1;
        break;
      }

      case '--max-size': {
        const value = args[index + 1];

        if (
          value === undefined ||
          value.startsWith('--') ||
          value.trim() === '' ||
          !Number.isFinite(Number(value)) ||
          Number(value) < 0
        ) {
          options.errors.push(
            '--max-size requires a finite, non-negative number in megabytes.',
          );
          break;
        }

        options.maxSizeMB = Number(value);
        index += 1;
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
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'unknown size';
  }

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
  const relativePath = path.relative(root, target);
  return relativePath || '.';
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
    filesChangedDuringRead: 0,
    symbolicLinksSkipped: 0,
    warnings: 0,
    errors: 0,
    bytesRead: 0,
  };
}

function createReporter() {
  return {
    issues: [],
    omittedIssues: 0,
  };
}

function addIssue(
  reporter,
  statistics,
  level,
  filePath,
  code,
  message,
) {
  if (level === 'error') {
    statistics.errors += 1;
  } else {
    statistics.warnings += 1;
  }

  if (reporter.issues.length < MAX_REPORTED_ISSUES) {
    reporter.issues.push({
      level,
      path: filePath,
      code,
      message,
    });
  } else {
    reporter.omittedIssues += 1;
  }
}

function addError(reporter, statistics, filePath, code, message) {
  addIssue(
    reporter,
    statistics,
    'error',
    filePath,
    code,
    message,
  );
}

function addWarning(reporter, statistics, filePath, code, message) {
  addIssue(
    reporter,
    statistics,
    'warning',
    filePath,
    code,
    message,
  );
}

function shouldSkipHidden(name, includeHidden) {
  if (includeHidden) {
    return false;
  }

  return name.startsWith('.') && name !== '.well-known';
}

function isJsonFile(fileName) {
  return fileName.toLowerCase().endsWith('.json');
}

function isInsideRoot(root, target) {
  const relativePath = path.relative(root, target);

  return (
    relativePath === '' ||
    (
      relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath)
    )
  );
}

/**
 * Extract a JSON parser position from Node/V8 error messages.
 *
 * Different Node.js versions produce different error messages.
 * Position-based locations are used when available. Otherwise, the
 * original parser message is retained without inventing a location.
 */
function getErrorLocation(message, source) {
  const patterns = [
    /\bposition\s+(\d+)\b/i,
    /\bline\s+(\d+)\s+column\s+(\d+)\b/i,
  ];

  const lineColumnMatch = message.match(patterns[1]);

  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2]),
      message,
    };
  }

  const positionMatch = message.match(patterns[0]);

  if (!positionMatch) {
    return {
      line: null,
      column: null,
      message,
    };
  }

  const position = Number(positionMatch[1]);
  const safePosition = Math.max(0, Math.min(position, source.length));
  const precedingText = source.slice(0, safePosition);
  const lines = precedingText.split('\n');

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

function getFileStat(filePath, options, reporter, statistics) {
  try {
    const stat = fs.lstatSync(filePath);

    // Do not follow symbolic links. A file may have changed since
    // directory enumeration, so inspect the link itself first.
    if (stat.isSymbolicLink()) {
      statistics.symbolicLinksSkipped += 1;
      return null;
    }

    if (!stat.isFile()) {
      return null;
    }

    return stat;
  } catch (error) {
    statistics.filesUnreadable += 1;

    addError(
      reporter,
      statistics,
      getRelativePath(options.root, filePath),
      'FILE_STAT_FAILED',
      `Cannot inspect file: ${error.message}`,
    );

    return null;
  }
}

function validateJsonFile(
  filePath,
  options,
  reporter,
  statistics,
) {
  const relativePath = getRelativePath(options.root, filePath);
  const initialStat = getFileStat(
    filePath,
    options,
    reporter,
    statistics,
  );

  if (!initialStat) {
    return;
  }

  statistics.filesDiscovered += 1;

  const maxBytes = options.maxSizeMB * 1024 * 1024;

  if (maxBytes > 0 && initialStat.size > maxBytes) {
    statistics.filesTooLarge += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_TOO_LARGE',
      `File exceeds the ${options.maxSizeMB} MB limit (${formatBytes(initialStat.size)}).`,
    );

    return;
  }

  let source;
  let finalStat;

  try {
    source = fs.readFileSync(filePath, 'utf8');

    // Check the opened path again to catch common file replacement
    // and mutation cases. This is a best-effort integrity check, not
    // a guarantee against concurrent filesystem changes.
    finalStat = fs.lstatSync(filePath);
  } catch (error) {
    statistics.filesUnreadable += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_READ_FAILED',
      `Cannot read file: ${error.message}`,
    );

    return;
  }

  if (finalStat.isSymbolicLink() || !finalStat.isFile()) {
    statistics.filesChangedDuringRead += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_CHANGED_DURING_READ',
      'The file was replaced or changed into a non-regular file during validation.',
    );

    return;
  }

  const bytesRead = Buffer.byteLength(source, 'utf8');
  statistics.bytesRead += bytesRead;

  if (maxBytes > 0 && bytesRead > maxBytes) {
    statistics.filesTooLarge += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_GREW_BEYOND_LIMIT',
      `File content exceeds the ${options.maxSizeMB} MB limit (${formatBytes(bytesRead)}).`,
    );

    return;
  }

  if (
    initialStat.size !== finalStat.size ||
    initialStat.mtimeMs !== finalStat.mtimeMs
  ) {
    statistics.filesChangedDuringRead += 1;

    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_CHANGED_DURING_READ',
      'File size or modification time changed during validation. Retry against a stable file.',
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
      'UTF8_BOM',
      'UTF-8 BOM detected. Save the file as UTF-8 without a BOM.',
    );
  }

  // Strip only for parsing; never modify the source file.
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
      'INVALID_JSON',
      formatParseError(error, parseSource),
    );
  }
}

function walk(
  directory,
  options,
  reporter,
  statistics,
) {
  statistics.directoriesVisited += 1;

  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });

    // Stable ordering makes CI output easier to compare.
    entries.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    addError(
      reporter,
      statistics,
      getRelativePath(options.root, directory),
      'DIRECTORY_READ_FAILED',
      `Cannot read directory: ${error.message}`,
    );

    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = getRelativePath(options.root, fullPath);

    if (shouldSkipHidden(entry.name, options.includeHidden)) {
      if (entry.isDirectory()) {
        statistics.directoriesSkipped += 1;
      }

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

      // Guard against unexpected traversal paths.
      if (!isInsideRoot(options.root, fullPath)) {
        statistics.directoriesSkipped += 1;

        addWarning(
          reporter,
          statistics,
          relativePath,
          'DIRECTORY_OUTSIDE_ROOT',
          'Directory was skipped because it resolves outside the configured root.',
        );

        continue;
      }

      walk(
        fullPath,
        options,
        reporter,
        statistics,
      );

      continue;
    }

    if (!entry.isFile() || !isJsonFile(entry.name)) {
      continue;
    }

    if (!isInsideRoot(options.root, fullPath)) {
      addWarning(
        reporter,
        statistics,
        relativePath,
        'FILE_OUTSIDE_ROOT',
        'File was skipped because it resolves outside the configured root.',
      );

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

function buildReport(options, reporter, statistics, elapsedMs) {
  const failed =
    statistics.errors > 0 ||
    (options.strict && statistics.warnings > 0);

  return {
    tool: 'MedOrbits JSON Validation Utility',
    version: 2,
    root: options.root,
    strict: options.strict,
    includeHidden: options.includeHidden,
    maxSizeMB: options.maxSizeMB,
    excludedDirectories: [...options.excludedDirectories].sort(),
    durationMs: Number(elapsedMs.toFixed(2)),
    statistics,
    issues: reporter.issues,
    omittedIssues: reporter.omittedIssues,
    result: failed ? 'failed' : 'passed',
    exitCode: failed
      ? EXIT_CODES.VALIDATION_FAILURE
      : EXIT_CODES.SUCCESS,
  };
}

function printHumanReport(report) {
  const { statistics } = report;

  console.log('');
  console.log('MedOrbits JSON Validation');
  console.log('='.repeat(48));
  console.log(`Root directory:         ${report.root}`);
  console.log(`Strict mode:            ${report.strict ? 'enabled' : 'disabled'}`);
  console.log(`Hidden paths:           ${report.includeHidden ? 'included' : 'excluded'}`);

  console.log(
    `Maximum file size:      ${
      report.maxSizeMB === 0 ? 'unlimited' : `${report.maxSizeMB} MB`
    }`,
  );

  console.log('');
  console.log('Validation details');
  console.log('-'.repeat(48));
  console.log(`Directories visited:    ${statistics.directoriesVisited}`);
  console.log(`Directories skipped:    ${statistics.directoriesSkipped}`);
  console.log(`JSON files discovered:  ${statistics.filesDiscovered}`);
  console.log(`JSON files checked:     ${statistics.filesChecked}`);
  console.log(`Valid JSON files:       ${statistics.filesValid}`);
  console.log(`Invalid JSON files:     ${statistics.filesInvalid}`);
  console.log(`Oversized files:        ${statistics.filesTooLarge}`);
  console.log(`Unreadable files:       ${statistics.filesUnreadable}`);
  console.log(`Files changed mid-read: ${statistics.filesChangedDuringRead}`);
  console.log(`Symbolic links skipped: ${statistics.symbolicLinksSkipped}`);
  console.log(`Warnings:               ${statistics.warnings}`);
  console.log(`Errors:                 ${statistics.errors}`);
  console.log(`Data read:              ${formatBytes(statistics.bytesRead)}`);
  console.log(`Duration:               ${report.durationMs} ms`);

  const warnings = report.issues.filter(
    (issue) => issue.level === 'warning',
  );

  const errors = report.issues.filter(
    (issue) => issue.level === 'error',
  );

  if (warnings.length > 0) {
    console.log('');
    console.log('Warnings');
    console.log('-'.repeat(48));

    for (const warning of warnings) {
      console.warn(
        `WARN  ${warning.path} [${warning.code}]: ${warning.message}`,
      );
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log('Errors');
    console.log('-'.repeat(48));

    for (const error of errors) {
      console.error(
        `ERROR ${error.path} [${error.code}]: ${error.message}`,
      );
    }
  }

  if (report.omittedIssues > 0) {
    console.log('');
    console.log(
      `Note: ${report.omittedIssues} additional issue(s) omitted from the report.`,
    );
  }

  console.log('');
  console.log('Final result');
  console.log('-'.repeat(48));

  if (report.result === 'failed') {
    console.error('FAILED: JSON validation did not pass.');

    if (report.strict && statistics.warnings > 0) {
      console.error('Strict mode treats warnings as failures.');
    }
  } else {
    console.log('PASSED: All checked JSON files are syntactically valid.');

    if (statistics.warnings > 0) {
      console.log('Warnings remain. Use --strict to fail on warnings.');
    }
  }

  console.log('');
}

function main() {
  const startedAt = performance.now();
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }

  if (options.errors.length > 0) {
    for (const error of options.errors) {
      console.error(`ARGUMENT ERROR: ${error}`);
    }

    console.error('Run with --help to see supported options.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  let rootStat;

  try {
    rootStat = fs.statSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot access "${options.root}": ${error.message}`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  if (!rootStat.isDirectory()) {
    console.error(
      `ROOT ERROR: "${options.root}" is not a directory.`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  // Canonicalize the root so reported paths and containment checks
  // use a stable absolute path.
  try {
    options.root = fs.realpathSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot resolve root directory: ${error.message}`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
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

  const report = buildReport(
    options,
    reporter,
    statistics,
    elapsedMs,
  );

  if (options.jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  return report.exitCode;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error('FATAL ERROR: Unexpected validator failure.');

  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = EXIT_CODES.CONFIGURATION_ERROR;
}
