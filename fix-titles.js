
'use strict';

/**
 * MedOrbits -- Test Title Quote Migration
 * File: /fix-titles.js
 * Policy version: 2.0.0
 *
 * Converts eligible single-quoted test titles to double quotes.
 *
 * Supported examples:
 *   it('loads the homepage', () => {});
 *   test('validates user input', function () {});
 *   describe('API routes', () => {});
 *
 * Commands:
 *   node fix-titles.js
 *   node fix-titles.js --root .
 *   node fix-titles.js --check
 *   node fix-titles.js --write
 *   node fix-titles.js --write --root .
 *   node fix-titles.js --verbose
 *   node fix-titles.js --help
 *
 * Safety:
 *   - Dry-run unless --write is specified.
 *   - --check never writes files.
 *   - Explicit root validation.
 *   - No symbolic-link traversal.
 *   - Skips dependency and generated directories.
 *   - Exclusive backups; existing backups are never overwritten.
 *   - Removes incomplete backups created by this process on failure.
 *   - Uses same-directory temporary files and atomic rename.
 *   - Checks original content immediately before replacement.
 *   - Preserves file permission bits.
 *   - Rejects mixed or unsupported line endings.
 *   - Conservative, line-oriented transformation; not an AST codemod.
 *
 * IMPORTANT:
 *   Review dry-run output and repository changes before committing.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SKIP_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'coverage',
  'dist',
  'build',
  'vendor',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  'tmp',
  'temp',
]);

const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;

const DEFAULT_ROOT = process.cwd();

/**
 * Matches a simple, single-line call:
 *
 *   it('title', ...)
 *   test('title', ...)
 *   describe('title', ...)
 *
 * The title must be a regular single-quoted string literal.
 * Calls with unsupported syntax are intentionally ignored.
 */
const TITLE_PATTERN =
  /^(\s*(?:it|test|describe)(?:\.\w+)?\s*\(\s*)'((?:\\.|[^'\\])*)'(\s*,.*)$/;

const options = {
  root: DEFAULT_ROOT,
  write: false,
  check: false,
  help: false,
  verbose: false,
};

const stats = {
  scanned: 0,
  matched: 0,
  changedFiles: 0,
  changedTitles: 0,
  skippedTitles: 0,
  backupsCreated: 0,
  errors: 0,
};

function log(message) {
  console.log(`[fix-titles] ${message}`);
}

function warn(message) {
  console.warn(`[fix-titles] WARNING: ${message}`);
}

function error(message) {
  console.error(`[fix-titles] ERROR: ${message}`);
  stats.errors++;
}

function showHelp() {
  console.log(`
MedOrbits Test Title Quote Migration

Usage:
  node fix-titles.js [options]

Options:
  --root PATH   Root directory to scan. Defaults to current directory.
  --write       Apply changes. Without this flag, the script is a dry-run.
  --check       Exit nonzero if convertible single-quoted titles remain.
  --verbose     Show additional scanning information.
  --help, -h    Display this help message.

Safety:
  Source files are not modified without --write.
  Existing backup files are never overwritten.
  Symbolic links are skipped.
  Files with unsupported line endings are preserved.
  This script does not parse JavaScript with a full syntax tree.

Examples:
  node fix-titles.js
  node fix-titles.js --check
  node fix-titles.js --write --root ./tests
`);
}

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case '--root': {
        const value = argv[++i];

        if (!value || value.startsWith('--')) {
          throw new Error('--root requires a directory path.');
        }

        options.root = path.resolve(value);
        break;
      }

      case '--write':
        options.write = true;
        break;

      case '--check':
        options.check = true;
        break;

      case '--verbose':
        options.verbose = true;
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.write && options.check) {
    throw new Error('--write and --check cannot be used together.');
  }
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);

  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

function validateRoot(root) {
  const rootStat = fs.lstatSync(root);

  if (rootStat.isSymbolicLink()) {
    throw new Error('The selected root must not be a symbolic link.');
  }

  if (!rootStat.isDirectory()) {
    throw new Error(`Root is not a directory: ${root}`);
  }

  const realRoot = fs.realpathSync(root);

  if (!fs.statSync(realRoot).isDirectory()) {
    throw new Error(`Root is not a directory: ${root}`);
  }

  return realRoot;
}

function isTestFile(filename) {
  return TEST_FILE.test(filename);
}

/**
 * Convert captured single-quoted string contents to double-quoted
 * string contents while preserving supported JavaScript escapes.
 *
 * Escaped apostrophes become ordinary apostrophes.
 * Double quotes are escaped.
 * Other escape sequences are preserved.
 *
 * Returns null for conservatively rejected content.
 */
function convertTitle(title) {
  // Avoid changing strings whose contents could be ambiguous to
  // downstream template-oriented tooling.
  if (title.includes('${')) {
    return null;
  }

  let output = '';

  for (let i = 0; i < title.length; i++) {
    const char = title[i];

    if (char === '"') {
      output += '\\"';
      continue;
    }

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = title[i + 1];

    if (next === undefined) {
      return null;
    }

    if (next === "'") {
      output += "'";
      i++;
      continue;
    }

    // Preserve other escape sequences exactly.
    output += char + next;
    i++;
  }

  return output;
}

function transformLine(line) {
  const match = line.match(TITLE_PATTERN);

  if (!match) {
    return {
      changed: false,
      skipped: false,
      line,
    };
  }

  const converted = convertTitle(match[2]);

  if (converted === null) {
    return {
      changed: false,
      skipped: true,
      line,
    };
  }

  const updated = `${match[1]}"${converted}"${match[3]}`;

  return {
    changed: updated !== line,
    skipped: false,
    line: updated,
  };
}

/**
 * Transform content without silently normalizing line endings.
 *
 * UTF-8 is required because the migration is intended for JavaScript
 * and TypeScript source files.
 */
function transformContent(content) {
  const hasCRLF = content.includes('\r\n');
  const withoutCRLF = content.replace(/\r\n/g, '');

  if (withoutCRLF.includes('\r')) {
    return {
      safe: false,
      reason: 'Mixed or unsupported line endings.',
      content,
      changedTitles: 0,
      skippedTitles: 0,
    };
  }

  const newline = hasCRLF ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  let changedTitles = 0;
  let skippedTitles = 0;

  const updatedLines = lines.map((line) => {
    const result = transformLine(line);

    if (result.changed) {
      changedTitles++;
    }

    if (result.skipped) {
      skippedTitles++;
    }

    return result.line;
  });

  return {
    safe: true,
    content: updatedLines.join(newline),
    changedTitles,
    skippedTitles,
  };
}

/**
 * Create an exclusive backup.
 *
 * If writing the newly created backup fails, remove only the partial
 * backup created by this invocation. Never remove a pre-existing backup.
 */
function createBackup(file, content) {
  const backupPath = `${file}.bak`;

  let descriptor;
  let created = false;

  try {
    descriptor = fs.openSync(backupPath, 'wx', 0o600);
    created = true;

    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    stats.backupsCreated++;

    return backupPath;
  } catch (err) {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original failure.
      }
    }

    if (created) {
      try {
        fs.unlinkSync(backupPath);
      } catch (cleanupError) {
        warn(
          `Could not remove incomplete backup ${backupPath}: ` +
          cleanupError.message
        );
      }
    }

    throw err;
  }
}

/**
 * Replace a file through a unique temporary file in the same directory.
 *
 * The original file is checked again before replacement. This reduces
 * accidental overwrites when another process modifies the source.
 *
 * Atomic rename protects readers from seeing a partially written file,
 * but this is not a cross-platform file-locking mechanism.
 */
function atomicWrite(file, content, originalBuffer, originalStat) {
  const directory = path.dirname(file);
  const basename = path.basename(file);

  const temporaryPath = path.join(
    directory,
    `.${basename}.${process.pid}.` +
      `${crypto.randomBytes(8).toString('hex')}.tmp`
  );

  let descriptor;

  try {
    descriptor = fs.openSync(
      temporaryPath,
      'wx',
      originalStat.mode & 0o777
    );

    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    // Refuse to replace a file that has become a symlink or changed.
    const currentStat = fs.lstatSync(file);

    if (!currentStat.isFile() || currentStat.isSymbolicLink()) {
      throw new Error('Source is no longer a regular file.');
    }

    const currentBuffer = fs.readFileSync(file);

    if (!currentBuffer.equals(originalBuffer)) {
      throw new Error(
        'File contents changed during processing; refusing to overwrite.'
      );
    }

    // Also detect common same-content replacement or metadata races.
    if (
      currentStat.dev !== originalStat.dev ||
      currentStat.ino !== originalStat.ino
    ) {
      throw new Error(
        'File identity changed during processing; refusing to overwrite.'
      );
    }

    fs.renameSync(temporaryPath, file);
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original error.
      }
    }

    try {
      if (fs.existsSync(temporaryPath)) {
        fs.unlinkSync(temporaryPath);
      }
    } catch (cleanupError) {
      warn(
        `Could not remove temporary file ${temporaryPath}: ` +
        cleanupError.message
      );
    }
  }
}

function processFile(file, root) {
  stats.scanned++;

  let fileStat;
  let originalBuffer;
  let original;

  try {
    fileStat = fs.lstatSync(file);

    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      return;
    }

    const realFile = fs.realpathSync(file);

    if (!isInsideRoot(root, realFile)) {
      warn(`Skipped path outside root: ${file}`);
      return;
    }

    originalBuffer = fs.readFileSync(file);
    original = originalBuffer.toString('utf8');

    // Reject invalid UTF-8 rather than risking byte-level corruption.
    if (!Buffer.from(original, 'utf8').equals(originalBuffer)) {
      warn(`Skipped ${file}: file is not valid UTF-8.`);
      return;
    }
  } catch (err) {
    error(`Could not read ${file}: ${err.message}`);
    return;
  }

  const result = transformContent(original);

  stats.skippedTitles += result.skippedTitles;

  if (!result.safe) {
    warn(`Skipped ${file}: ${result.reason}`);
    return;
  }

  if (result.changedTitles === 0) {
    if (options.verbose) {
      log(`No eligible titles: ${path.relative(root, file)}`);
    }

    return;
  }

  stats.matched += result.changedTitles;

  if (!options.write) {
    log(
      `${options.check ? 'CHECK' : 'DRY RUN'} ` +
      `${path.relative(root, file)}: ` +
      `${result.changedTitles} title(s) would change`
    );

    stats.changedTitles += result.changedTitles;
    return;
  }

  let backupPath;

  try {
    // Preserve the original before attempting replacement.
    backupPath = createBackup(file, original);

    try {
      atomicWrite(file, result.content, originalBuffer, fileStat);
    } catch (writeError) {
      error(
        `Could not update ${file}: ${writeError.message}. ` +
        `Original backup: ${backupPath}`
      );
      return;
    }

    stats.changedFiles++;
    stats.changedTitles += result.changedTitles;

    log(
      `UPDATED ${path.relative(root, file)}: ` +
      `${result.changedTitles} title(s) updated; ` +
      `backup: ${path.basename(backupPath)}`
    );
  } catch (err) {
    error(`Could not back up ${file}: ${err.message}`);
  }
}

function walk(directory, root) {
  let entries;

  try {
    entries = fs.readdirSync(directory, {
      withFileTypes: true,
    });
  } catch (err) {
    error(`Cannot scan directory ${directory}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const target = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      if (options.verbose) {
        log(`Skipping symbolic link: ${target}`);
      }

      continue;
    }

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        if (options.verbose) {
          log(`Skipping directory: ${target}`);
        }

        continue;
      }

      if (!isInsideRoot(root, target)) {
        warn(`Skipping directory outside root: ${target}`);
        continue;
      }

      walk(target, root);
      continue;
    }

    if (!entry.isFile() || !isTestFile(entry.name)) {
      continue;
    }

    processFile(target, root);
  }
}

function printSummary() {
  console.log('\n--- Migration Summary ---');
  console.log(`Test files scanned:    ${stats.scanned}`);
  console.log(`Eligible titles:       ${stats.matched}`);
  console.log(`Files updated:         ${stats.changedFiles}`);
  console.log(`Titles updated:        ${stats.changedTitles}`);
  console.log(`Titles skipped:        ${stats.skippedTitles}`);
  console.log(`Backups created:       ${stats.backupsCreated}`);
  console.log(`Errors:                ${stats.errors}`);

  if (options.check) {
    if (stats.matched > 0) {
      console.log(
        '\nCHECK FAILED: convertible single-quoted titles remain.'
      );
    } else {
      console.log(
        '\nCHECK PASSED: no convertible single-quoted titles remain.'
      );
    }

    if (stats.skippedTitles > 0) {
      console.log(
        'WARNING: some titles were skipped and require manual review.'
      );
    }

    return;
  }

  if (!options.write) {
    console.log('\nDry-run only: no source files were modified.');
    console.log('Review the output, then use --write to apply changes.');
  }
}

function main() {
  parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    return 0;
  }

  const root = validateRoot(options.root);

  log(`Root: ${root}`);
  log(
    `Mode: ${
      options.check ? 'CHECK' : options.write ? 'WRITE' : 'DRY RUN'
    }`
  );

  walk(root, root);
  printSummary();

  if (stats.errors > 0) {
    return 1;
  }

  if (options.check && stats.matched > 0) {
    return 1;
  }

  if (options.check && stats.skippedTitles > 0) {
    // A skipped title means the migration could not fully assess
    // all matched title-like declarations.
    return 2;
  }

  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`[fix-titles] FATAL: ${err.message}`);
  process.exitCode = 1;
}
