'use strict';
/**
 * MedOrbits -- Test Title Quote Migration
 * File: /fix-titles.js
 *
 * Converts eligible single-quoted test titles to double quotes.
 *
 * Examples:
 *   it('loads the homepage', () => {});
 *   test('validates user input', function () {});
 *   describe('API routes', () => {});
 *
 * Safety features:
 *   - Dry-run by default.
 *   - Requires --write to modify files.
 *   - Supports an explicit --root directory.
 *   - Never follows symbolic links during traversal.
 *   - Skips dependency/build/coverage directories.
 *   - Creates exclusive backups without overwriting existing ones.
 *   - Writes through a temporary file and renames atomically.
 *   - Preserves original files when backup creation fails.
 *   - Reports skipped titles and filesystem errors.
 *
 * Usage:
 *   node fix-titles.js
 *   node fix-titles.js --root .
 *   node fix-titles.js --write
 *   node fix-titles.js --write --root .
 *   node fix-titles.js --check
 *   node fix-titles.js --help
 *
 * IMPORTANT:
 *   Review the dry-run output before using --write.
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
  --write       Apply changes. Without this flag, the script is dry-run.
  --check       Report whether eligible titles remain single-quoted.
  --verbose     Show additional scanning information.
  --help        Display this help message.
Safety:
  No files are modified without --write.
  Existing backup files are never overwritten.
  Symbolic links are skipped.
  Files with ambiguous line endings are preserved.
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
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch {
    throw new Error(`Root directory does not exist: ${root}`);
  }
  const rootStat = fs.lstatSync(root);
  if (rootStat.isSymbolicLink()) {
    throw new Error('The selected root must not be a symbolic link.');
  }
  if (!fs.statSync(realRoot).isDirectory()) {
    throw new Error(`Root is not a directory: ${root}`);
  }
  return realRoot;
}
function isTestFile(filename) {
  return TEST_FILE.test(filename);
}
function shouldSkipDirectory(entry) {
  return entry.isSymbolicLink() || SKIP_DIRS.has(entry.name);
}
/**
 * Convert the captured title's content into a double-quoted
 * JavaScript string literal without changing its meaning.
 *
 * Existing escape sequences are preserved where possible.
 * Escaped single quotes can become ordinary apostrophes inside
 * double-quoted strings.
 *
 * Unsupported escape sequences are rejected conservatively.
 */
function convertTitle(title) {
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
/**
 * This deliberately handles only simple, single-line declarations.
 * It does not parse JavaScript syntax and should not be treated as
 * a substitute for an AST-based codemod.
 */
function transformLine(line) {
  const match = line.match(TITLE_PATTERN);
  if (!match) {
    return {
      changed: false,
      skipped: false,
      line,
    };
  }
  const title = match[2];
  const converted = convertTitle(title);
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
function transformContent(content) {
  // Preserve the original line ending style.
  const usesCRLF = content.includes('\r\n');
  const newline = usesCRLF ? '\r\n' : '\n';
  // Do not silently normalize mixed line endings.
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
  const lines = content.split(/\r?\n/);
  let changedTitles = 0;
  let skippedTitles = 0;
  const updatedLines = lines.map((line) => {
    const result = transformLine(line);
    if (result.changed) changedTitles++;
    if (result.skipped) skippedTitles++;
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
 * Backup creation uses exclusive creation.
 * If a backup already exists, do not overwrite it.
 */
function createBackup(file, content) {
  const backupPath = `${file}.bak`;
  const descriptor = fs.openSync(
    backupPath,
    'wx',
    0o600
  );
  try {
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  stats.backupsCreated++;
  return backupPath;
}
/**
 * Write to a unique temporary file in the same directory, then
 * atomically rename it into place.
 *
 * A backup must already exist before this function is called.
 */
function atomicWrite(file, content, originalStat) {
  const directory = path.dirname(file);
  const basename = path.basename(file);
  const temporaryPath = path.join(
    directory,
    `.${basename}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  let descriptor;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      'wx',
      originalStat.mode & 0o777
    );
    fs.writeFileSync(descriptor, content);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    // Refuse to replace a file that changed after it was read.
    const currentStat = fs.statSync(file);
    if (
      currentStat.size !== originalStat.size ||
      currentStat.mtimeMs !== originalStat.mtimeMs
    ) {
      throw new Error('File changed during processing; refusing to overwrite.');
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
    // Only remove this script's own temporary file.
    // Never remove a user file or an existing backup.
    try {
      if (fs.existsSync(temporaryPath)) {
        fs.unlinkSync(temporaryPath);
      }
    } catch {
      warn(`Could not remove temporary file: ${temporaryPath}`);
    }
  }
}
function processFile(file, root) {
  stats.scanned++;
  let fileStat;
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
    original = fs.readFileSync(file, 'utf8');
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
      `DRY RUN ${path.relative(root, file)}: ` +
      `${result.changedTitles} title(s) would change`
    );
    stats.changedTitles += result.changedTitles;
    return;
  }
  try {
    // Create a backup before any replacement is attempted.
    const backupPath = createBackup(file, original);
    try {
      atomicWrite(file, result.content, fileStat);
    } catch (writeError) {
      error(
        `Could not update ${file}: ${writeError.message}. ` +
        `Original backup: ${backupPath}`
      );
      return;
    }
    stats.changedFiles++;
    stats.changedTitles += result.changedTitles;
    successLog(
      `${path.relative(root, file)}: ` +
      `${result.changedTitles} title(s) updated`
    );
  } catch (err) {
    error(`Could not back up ${file}: ${err.message}`);
  }
}
function successLog(message) {
  console.log(`[fix-titles] UPDATED ${message}`);
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
    if (entry.isSymbolicLink()) {
      if (options.verbose) {
        log(`Skipping symbolic link: ${path.join(directory, entry.name)}`);
      }
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
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
  console.log(`Files scanned:        ${stats.scanned}`);
  console.log(`Eligible titles:      ${stats.matched}`);
  console.log(`Files updated:        ${stats.changedFiles}`);
  console.log(`Titles updated:       ${stats.changedTitles}`);
  console.log(`Titles skipped:       ${stats.skippedTitles}`);
  console.log(`Backups created:      ${stats.backupsCreated}`);
  console.log(`Errors:               ${stats.errors}`);
  if (!options.write && !options.check) {
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
  log(`Mode: ${options.check ? 'CHECK' : options.write ? 'WRITE' : 'DRY RUN'}`);
  walk(root, root);
  printSummary();
  if (stats.errors > 0) {
    return 1;
  }
  if (options.check && stats.matched > 0) {
    console.error(
      '\n[fix-titles] CHECK FAILED: eligible single-quoted titles remain.'
    );
    return 1;
  }
  if (options.check) {
    log('CHECK PASSED: no eligible single-quoted titles remain.');
  }
  return 0;
}
try {
  process.exitCode = main();
} catch (err) {
  console.error(`[fix-titles] FATAL: ${err.message}`);
  process.exitCode = 1;
}