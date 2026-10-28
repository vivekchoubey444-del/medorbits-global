#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- JSON Validation Utility
 * File: /scripts/validate-json.js
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Features:
 * - Recursive JSON syntax validation.
 * - Line and column reporting where available.
 * - UTF-8 BOM detection without modifying files.
 * - Strict mode: warnings cause failure.
 * - Configurable scan root and repeated directory exclusions.
 * - Optional hidden-file inclusion.
 * - Symbolic-link avoidance.
 * - Bounded file reads and configurable maximum size.
 * - Best-effort detection of files changed during validation.
 * - Deterministic human-readable or JSON output.
 * - Stable exit codes for CI/CD.
 *
 * Usage:
 *   node scripts/validate-json.js
 *   node scripts/validate-json.js --strict
 *   node scripts/validate-json.js --root ./api
 *   node scripts/validate-json.js --exclude uploads --exclude temp
 *   node scripts/validate-json.js --include-hidden
 *   node scripts/validate-json.js --max-size 20
 *   node scripts/validate-json.js --max-size 0
 *   node scripts/validate-json.js --json
 *   node scripts/validate-json.js --help
 *
 * Exit codes:
 *   0 = success
 *   1 = validation failure
 *   2 = invalid arguments or fatal configuration error
 *
 * This utility validates JSON syntax only. It does not validate JSON Schema.
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
const MAX_EXCLUSION_LENGTH = 255;
const READ_CHUNK_SIZE = 64 * 1024;
const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILURE: 1,
  CONFIGURATION_ERROR: 2,
});
class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
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
      Maximum JSON file size in MiB.
      Default: ${DEFAULT_MAX_FILE_SIZE_MB} MiB.
      Use 0 to disable the configured size limit.
  --json
      Output the final report as JSON.
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
          throw new ConfigurationError(
            '--root requires a directory path.',
          );
        }
        options.root = path.resolve(process.cwd(), value);
        index += 1;
        break;
      }
      case '--exclude': {
        const value = args[index + 1];
        if (!value || value.startsWith('--')) {
          throw new ConfigurationError(
            '--exclude requires a directory name.',
          );
        }
        if (
          value.length > MAX_EXCLUSION_LENGTH ||
          value === '.' ||
          value === '..' ||
          value.includes('/') ||
          value.includes('\\') ||
          value.includes('\0')
        ) {
          throw new ConfigurationError(
            `Invalid exclusion "${value}". Supply a directory name, not a path.`,
          );
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
          throw new ConfigurationError(
            '--max-size requires a finite, non-negative number in MiB.',
          );
        }
        const parsed = Number(value);
        if (parsed > Number.MAX_SAFE_INTEGER / (1024 * 1024)) {
          throw new ConfigurationError(
            '--max-size is too large.',
          );
        }
        options.maxSizeMB = parsed;
        index += 1;
        break;
      }
      default:
        throw new ConfigurationError(
          `Unknown option: ${argument}`,
        );
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
    return `${(bytes / 1024).toFixed(2)} KiB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}
function getRelativePath(root, target) {
  const relativePath = path.relative(root, target);
  return relativePath || '.';
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
  return !includeHidden && name.startsWith('.');
}
function isJsonFile(fileName) {
  return fileName.toLowerCase().endsWith('.json');
}
function safeErrorMessage(error) {
  // Do not expose full absolute paths from low-level filesystem errors.
  const code =
    typeof error?.code === 'string'
      ? ` (${error.code})`
      : '';
  const messages = {
    EACCES: 'Permission denied',
    EPERM: 'Operation not permitted',
    ENOENT: 'File or directory no longer exists',
    ELOOP: 'Symbolic-link loop detected',
    EMFILE: 'Too many open files',
    ENFILE: 'System file-descriptor limit reached',
    EISDIR: 'Expected a file but found a directory',
    ENOTDIR: 'Expected a directory component',
    EIO: 'Filesystem I/O error',
  };
  if (error?.code && messages[error.code]) {
    return `${messages[error.code]}${code}`;
  }
  return `Filesystem operation failed${code}`;
}
function getErrorLocation(message, source) {
  const lineColumnMatch = message.match(
    /\bline\s+(\d+)\s+column\s+(\d+)\b/i,
  );
  if (lineColumnMatch) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2]),
    };
  }
  const positionMatch = message.match(
    /\bposition\s+(\d+)\b/i,
  );
  if (!positionMatch) {
    return {
      line: null,
      column: null,
    };
  }
  const position = Number(positionMatch[1]);
  const safePosition = Math.max(
    0,
    Math.min(position, source.length),
  );
  const precedingText = source.slice(0, safePosition);
  const lines = precedingText.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}
function formatParseError(error, source) {
  const detail = getErrorLocation(
    String(error?.message || 'Invalid JSON'),
    source,
  );
  const message = String(
    error?.message || 'Invalid JSON syntax',
  )
    .replace(/\s+/g, ' ')
    .slice(0, 500);
  if (detail.line !== null) {
    return `line ${detail.line}, column ${detail.column}: ${message}`;
  }
  return message;
}
/**
 * Open a regular file without following a final-component symlink
 * where O_NOFOLLOW is supported.
 *
 * This is a best-effort protection. It does not eliminate all races
 * involving parent-directory replacement on every operating system.
 */
function openRegularFile(filePath) {
  const noFollow = fs.constants.O_NOFOLLOW || 0;
  const flags = fs.constants.O_RDONLY | noFollow;
  const descriptor = fs.openSync(filePath, flags);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) {
      throw new ConfigurationError(
        'The selected path is not a regular file.',
      );
    }
    return {
      descriptor,
      stat,
    };
  } catch (error) {
    fs.closeSync(descriptor);
    throw error;
  }
}
/**
 * Read a bounded file using a file descriptor.
 * This avoids loading an arbitrarily large file into memory.
 */
function readBoundedFile(descriptor, initialSize, maxBytes) {
  const chunks = [];
  let totalBytes = 0;
  let position = 0;
  const buffer = Buffer.allocUnsafe(READ_CHUNK_SIZE);
  while (true) {
    const bytesRead = fs.readSync(
      descriptor,
      buffer,
      0,
      buffer.length,
      position,
    );
    if (bytesRead === 0) {
      break;
    }
    totalBytes += bytesRead;
    if (maxBytes > 0 && totalBytes > maxBytes) {
      return {
        tooLarge: true,
        bytesRead: totalBytes,
        source: null,
      };
    }
    chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    position += bytesRead;
  }
  return {
    tooLarge: false,
    bytesRead: totalBytes,
    source: Buffer.concat(chunks).toString('utf8'),
    initialSize,
  };
}
function validateJsonFile(
  filePath,
  options,
  reporter,
  statistics,
) {
  const relativePath = getRelativePath(
    options.root,
    filePath,
  );
  statistics.filesDiscovered += 1;
  const maxBytes =
    options.maxSizeMB === 0
      ? 0
      : options.maxSizeMB * 1024 * 1024;
  let descriptor;
  let initialStat;
  try {
    // lstat avoids deliberately following a final-component symlink.
    const linkStat = fs.lstatSync(filePath);
    if (linkStat.isSymbolicLink()) {
      statistics.symbolicLinksSkipped += 1;
      return;
    }
    if (!linkStat.isFile()) {
      return;
    }
    if (maxBytes > 0 && linkStat.size > maxBytes) {
      statistics.filesTooLarge += 1;
      addError(
        reporter,
        statistics,
        relativePath,
        'FILE_TOO_LARGE',
        `File exceeds the ${options.maxSizeMB} MiB limit (${formatBytes(linkStat.size)}).`,
      );
      return;
    }
    const opened = openRegularFile(filePath);
    descriptor = opened.descriptor;
    initialStat = opened.stat;
  } catch (error) {
    if (error?.code === 'ELOOP') {
      statistics.symbolicLinksSkipped += 1;
      return;
    }
    statistics.filesUnreadable += 1;
    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_OPEN_FAILED',
      safeErrorMessage(error),
    );
    return;
  }
  let readResult;
  let finalStat;
  try {
    readResult = readBoundedFile(
      descriptor,
      initialStat.size,
      maxBytes,
    );
    finalStat = fs.fstatSync(descriptor);
  } catch (error) {
    statistics.filesUnreadable += 1;
    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_READ_FAILED',
      safeErrorMessage(error),
    );
    return;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch {
      // Do not conceal the primary validation result on close failure.
    }
  }
  statistics.bytesRead += readResult.bytesRead;
  if (readResult.tooLarge) {
    statistics.filesTooLarge += 1;
    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_GREW_BEYOND_LIMIT',
      `File content exceeded the ${options.maxSizeMB} MiB limit while reading.`,
    );
    return;
  }
  if (
    initialStat.dev !== finalStat.dev ||
    initialStat.ino !== finalStat.ino ||
    initialStat.size !== finalStat.size ||
    initialStat.mtimeMs !== finalStat.mtimeMs ||
    initialStat.ctimeMs !== finalStat.ctimeMs ||
    readResult.bytesRead !== finalStat.size
  ) {
    statistics.filesChangedDuringRead += 1;
    addError(
      reporter,
      statistics,
      relativePath,
      'FILE_CHANGED_DURING_READ',
      'File metadata changed during validation. Retry against a stable file.',
    );
    return;
  }
  statistics.filesChecked += 1;
  const source = readResult.source;
  const hasBom =
    source.length > 0 &&
    source.charCodeAt(0) === 0xfeff;
  if (hasBom) {
    addWarning(
      reporter,
      statistics,
      relativePath,
      'UTF8_BOM',
      'UTF-8 BOM detected. Save as UTF-8 without a BOM.',
    );
  }
  // Parse without the BOM, leaving the original file untouched.
  const parseSource = hasBom
    ? source.slice(1)
    : source;
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
    entries.sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    );
  } catch (error) {
    addError(
      reporter,
      statistics,
      getRelativePath(options.root, directory),
      'DIRECTORY_READ_FAILED',
      safeErrorMessage(error),
    );
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePath = getRelativePath(
      options.root,
      fullPath,
    );
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
function buildReport(
  options,
  reporter,
  statistics,
  elapsedMs,
) {
  const failed =
    statistics.errors > 0 ||
    (options.strict && statistics.warnings > 0);
  return {
    tool: 'MedOrbits JSON Validation Utility',
    version: 3,
    root: options.root,
    strict: options.strict,
    includeHidden: options.includeHidden,
    maxSizeMB: options.maxSizeMB,
    excludedDirectories: [
      ...options.excludedDirectories,
    ].sort(),
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
  console.log('='.repeat(52));
  console.log(`Root directory:         ${report.root}`);
  console.log(`Strict mode:            ${report.strict ? 'enabled' : 'disabled'}`);
  console.log(`Hidden paths:           ${report.includeHidden ? 'included' : 'excluded'}`);
  console.log(
    `Maximum file size:      ${
      report.maxSizeMB === 0
        ? 'unlimited'
        : `${report.maxSizeMB} MiB`
    }`,
  );
  console.log('');
  console.log('Validation details');
  console.log('-'.repeat(52));
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
  for (const level of ['warning', 'error']) {
    const issues = report.issues.filter(
      (issue) => issue.level === level,
    );
    if (issues.length === 0) {
      continue;
    }
    console.log('');
    console.log(
      level === 'warning' ? 'Warnings' : 'Errors',
    );
    console.log('-'.repeat(52));
    for (const issue of issues) {
      const prefix =
        level === 'warning' ? 'WARN ' : 'ERROR';
      console.log(
        `${prefix} ${issue.path} [${issue.code}]: ${issue.message}`,
      );
    }
  }
  if (report.omittedIssues > 0) {
    console.log('');
    console.log(
      `Note: ${report.omittedIssues} additional issue(s) omitted from output.`,
    );
  }
  console.log('');
  console.log('Final result');
  console.log('-'.repeat(52));
  if (report.result === 'failed') {
    console.error('FAILED: JSON validation did not pass.');
    if (report.strict && statistics.warnings > 0) {
      console.error(
        'Strict mode treats warnings as failures.',
      );
    }
  } else {
    console.log(
      'PASSED: All checked JSON files are syntactically valid.',
    );
    if (statistics.warnings > 0) {
      console.log(
        'Warnings remain. Use --strict to fail on warnings.',
      );
    }
  }
  console.log('');
}
function main() {
  const startedAt = performance.now();
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ARGUMENT ERROR: ${error.message}`);
    console.error('Run with --help to see supported options.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }
  if (options.help) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }
  let rootStat;
  try {
    rootStat = fs.statSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot access the configured root. ${safeErrorMessage(error)}`,
    );
    return EXIT_CODES.CONFIGURATION_ERROR;
  }
  if (!rootStat.isDirectory()) {
    console.error(
      'ROOT ERROR: The configured root is not a directory.',
    );
    return EXIT_CODES.CONFIGURATION_ERROR;
  }
  try {
    options.root = fs.realpathSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot resolve the configured root. ${safeErrorMessage(error)}`,
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
  const report = buildReport(
    options,
    reporter,
    statistics,
    performance.now() - startedAt,
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
  // Keep fatal output concise and avoid dumping arbitrary stacks or paths.
  console.error(
    `FATAL ERROR: ${safeErrorMessage(error)}`,
  );
  process.exitCode = EXIT_CODES.CONFIGURATION_ERROR;
}