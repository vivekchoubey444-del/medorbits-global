
#!/usr/bin/env node

'use strict';

/**
 * MedOrbits -- Safe Build Output Cleaner
 * --------------------------------------
 * File: scripts/clean-output.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Purpose:
 * - Clean generated build output and temporary artifacts.
 * - Support dry-run previews before deleting files.
 * - Protect source, configuration, database and repository directories.
 * - Prevent path traversal and symlink-based deletion.
 * - Report removed, skipped and failed paths.
 * - Support JSON output for CI workflows.
 *
 * Default cleanup targets:
 * - dist/
 * - build/
 * - coverage/
 * - .cache/
 * - .turbo/
 * - .next/
 * - .nuxt/
 * - .output/
 *
 * Optional cleanup targets:
 * - Temporary files (*.tmp, *.temp, *.log, *.bak, *.swp)
 * - Only when --temp is explicitly supplied.
 *
 * Usage:
 *   node scripts/clean-output.mjs --dry-run
 *   node scripts/clean-output.mjs --apply
 *   node scripts/clean-output.mjs --target dist --dry-run
 *   node scripts/clean-output.mjs --target dist --apply
 *   node scripts/clean-output.mjs --temp --dry-run
 *   node scripts/clean-output.mjs --apply --json
 *   node scripts/clean-output.mjs --help
 *
 * Exit codes:
 *   0 = success
 *   1 = cleanup operation failed
 *   2 = configuration error
 *
 * Safety:
 * - Without --apply, nothing is deleted.
 * - Only explicitly configured targets are eligible for removal.
 * - Paths must remain inside the project root.
 * - Symbolic links are never followed or recursively deleted.
 * - package.json, source code, schemas, database files, .git and
 *   node_modules are never default cleanup targets.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const DEFAULT_TARGETS = [
  'dist',
  'build',
  'coverage',
  '.cache',
  '.turbo',
  '.next',
  '.nuxt',
  '.output',
];

const TEMP_FILE_EXTENSIONS = new Set([
  '.tmp',
  '.temp',
  '.log',
  '.bak',
  '.swp',
  '.swo',
]);

const PROTECTED_ROOT_ENTRIES = new Set([
  '.git',
  'node_modules',
  'src',
  'source',
  'public',
  'assets',
  'api',
  'schemas',
  'database',
  'config',
  'controllers',
  'models',
  'services',
  'middleware',
  'middlewares',
  'routes',
  'tests',
  'test',
  'scripts',
  'docs',
  'documentation',
  'locales',
  'translations',
  'i18n',
  'uploads',
  'storage',
  'backups',
  'migrations',
  'seeds',
  'fixtures',
]);

const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  OPERATION_FAILED: 1,
  CONFIGURATION_ERROR: 2,
});

function printHelp() {
  console.log(`
MedOrbits Safe Build Output Cleaner

Usage:
  node scripts/clean-output.mjs [options]

Options:
  --dry-run
      Preview cleanup. This is the default.

  --apply
      Perform the selected deletions.

  --root <directory>
      Project root. Defaults to the current working directory.

  --target <path>
      Add a specific relative cleanup target. Can be repeated.

  --temp
      Include temporary files in the scan. Does not delete them
      unless --apply is also supplied.

  --include-hidden
      Include hidden directories when scanning for temporary files.
      Default build targets can include hidden directories.

  --json
      Output a machine-readable JSON report.

  --help, -h
      Display this help.

Default targets:
  ${DEFAULT_TARGETS.join(', ')}

Examples:
  node scripts/clean-output.mjs --dry-run
  node scripts/clean-output.mjs --apply
  node scripts/clean-output.mjs --target dist --dry-run
  node scripts/clean-output.mjs --target dist --apply
  node scripts/clean-output.mjs --temp --dry-run
  node scripts/clean-output.mjs --temp --apply
`);
}

function parseArguments(args) {
  const options = {
    root: process.cwd(),
    targets: [...DEFAULT_TARGETS],
    apply: false,
    temp: false,
    includeHidden: false,
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

      case '--dry-run':
        options.apply = false;
        break;

      case '--apply':
        options.apply = true;
        break;

      case '--temp':
        options.temp = true;
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

      case '--target': {
        const value = args[index + 1];

        if (!value || value.startsWith('--')) {
          options.errors.push('--target requires a path.');
          break;
        }

        options.targets.push(value);
        index += 1;
        break;
      }

      default:
        options.errors.push(`Unknown option: ${argument}`);
    }
  }

  options.targets = [...new Set(options.targets)];

  return options;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
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

function getRelativePath(root, target) {
  return path.relative(root, target).split(path.sep).join('/') || '.';
}

function isProtectedTarget(root, target) {
  const relativePath = path.relative(root, target);

  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    return true;
  }

  const segments = relativePath.split(path.sep);

  if (segments.some((segment) => segment === '..' || segment === '.')) {
    return true;
  }

  // Never allow cleanup targets to be or descend from protected directories.
  if (segments.some((segment) => PROTECTED_ROOT_ENTRIES.has(segment))) {
    return true;
  }

  const basename = path.basename(target);

  if (
    basename === 'package.json' ||
    basename === 'package-lock.json' ||
    basename === 'pnpm-lock.yaml' ||
    basename === 'yarn.lock' ||
    basename === 'npm-shrinkwrap.json' ||
    basename === '.env' ||
    basename.startsWith('.env.')
  ) {
    return true;
  }

  return false;
}

function validateTarget(root, target) {
  if (
    !target ||
    target.trim() === '' ||
    target.includes('\0')
  ) {
    return {
      ok: false,
      reason: 'Target path is empty or invalid.',
    };
  }

  const absoluteTarget = path.resolve(root, target);

  if (!isInsideRoot(root, absoluteTarget)) {
    return {
      ok: false,
      reason: 'Target resolves outside the project root.',
    };
  }

  if (isProtectedTarget(root, absoluteTarget)) {
    return {
      ok: false,
      reason: 'Target is protected and cannot be cleaned.',
    };
  }

  // Prevent deleting a directory that is a parent of the project root.
  if (absoluteTarget === root) {
    return {
      ok: false,
      reason: 'The project root itself cannot be cleaned.',
    };
  }

  return {
    ok: true,
    absoluteTarget,
  };
}

function calculateSize(target) {
  let stat;

  try {
    stat = fs.lstatSync(target);
  } catch {
    return 0;
  }

  if (stat.isSymbolicLink()) {
    return 0;
  }

  if (stat.isFile()) {
    return stat.size;
  }

  if (!stat.isDirectory()) {
    return 0;
  }

  let total = 0;

  let entries;

  try {
    entries = fs.readdirSync(target, {
      withFileTypes: true,
    });
  } catch {
    return 0;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    total += calculateSize(path.join(target, entry.name));
  }

  return total;
}

function formatBytes(bytes) {
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

function shouldSkipTemporaryScanDirectory(name, options) {
  if (!options.includeHidden && name.startsWith('.')) {
    return true;
  }

  if (
    name === 'node_modules' ||
    name === '.git' ||
    name === 'vendor' ||
    name === 'uploads' ||
    name === 'storage' ||
    name === 'backups'
  ) {
    return true;
  }

  return false;
}

function discoverTemporaryFiles(root, options, report) {
  const found = [];

  function walk(directory) {
    let entries;

    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true,
      });
    } catch (error) {
      report.warnings.push({
        path: getRelativePath(root, directory),
        message: `Unable to scan directory: ${error.message}`,
      });

      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isSymbolicLink()) {
        report.symbolicLinksSkipped += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (shouldSkipTemporaryScanDirectory(entry.name, options)) {
          report.pathsSkipped += 1;
          continue;
        }

        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (
        TEMP_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) ||
        entry.name.endsWith('~') ||
        entry.name.startsWith('.#')
      ) {
        if (!isProtectedTarget(root, fullPath)) {
          found.push(fullPath);
        }
      }
    }
  }

  walk(root);

  return [...new Set(found)].sort();
}

function removeTarget(target, root, report) {
  let stat;

  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') {
      report.skipped.push({
        path: getRelativePath(root, target),
        reason: 'Target no longer exists.',
      });

      return;
    }

    report.failures.push({
      path: getRelativePath(root, target),
      message: error.message,
    });

    return;
  }

  // Do not follow or remove symlinks. This avoids surprising effects when
  // generated output contains links to files outside the project.
  if (stat.isSymbolicLink()) {
    report.skipped.push({
      path: getRelativePath(root, target),
      reason: 'Symbolic links are not removed.',
    });

    report.symbolicLinksSkipped += 1;
    return;
  }

  try {
    if (stat.isDirectory()) {
      fs.rmSync(target, {
        recursive: true,
        force: false,
      });
    } else if (stat.isFile()) {
      fs.unlinkSync(target);
    } else {
      report.skipped.push({
        path: getRelativePath(root, target),
        reason: 'Not a regular file or directory.',
      });

      return;
    }

    report.removed.push({
      path: getRelativePath(root, target),
      bytes: stat.isFile() ? stat.size : 0,
    });
  } catch (error) {
    report.failures.push({
      path: getRelativePath(root, target),
      message: error.message,
    });
  }
}

function createReport() {
  return {
    candidates: [],
    removed: [],
    skipped: [],
    warnings: [],
    failures: [],
    symbolicLinksSkipped: 0,
    pathsSkipped: 0,
  };
}

function printReport(report, options, elapsedMs) {
  const failed = report.failures.length > 0;

  const output = {
    tool: 'MedOrbits Safe Build Output Cleaner',
    version: 1,
    root: options.root,
    mode: options.apply ? 'apply' : 'dry-run',
    temporaryFileCleanup: options.temp,
    durationMs: Number(elapsedMs.toFixed(2)),
    summary: {
      candidates: report.candidates.length,
      removed: report.removed.length,
      skipped: report.skipped.length,
      warnings: report.warnings.length,
      failures: report.failures.length,
      symbolicLinksSkipped: report.symbolicLinksSkipped,
      pathsSkipped: report.pathsSkipped,
      plannedBytes: report.candidates.reduce(
        (total, candidate) => total + candidate.bytes,
        0,
      ),
    },
    candidates: report.candidates,
    removed: report.removed,
    skipped: report.skipped,
    warnings: report.warnings,
    failures: report.failures,
    result: failed ? 'failed' : 'completed',
    exitCode: failed
      ? EXIT_CODES.OPERATION_FAILED
      : EXIT_CODES.SUCCESS,
  };

  if (options.jsonOutput) {
    console.log(JSON.stringify(output, null, 2));

    return output.exitCode;
  }

  console.log('');
  console.log('MedOrbits Output Cleanup');
  console.log('='.repeat(48));
  console.log(`Project root:        ${options.root}`);
  console.log(`Mode:                ${options.apply ? 'APPLY -- DELETE FILES' : 'DRY RUN -- NO DELETIONS'}`);
  console.log(`Temporary scan:      ${options.temp ? 'enabled' : 'disabled'}`);
  console.log(`Candidates:          ${report.candidates.length}`);
  console.log(`Removed:             ${report.removed.length}`);
  console.log(`Skipped:             ${report.skipped.length}`);
  console.log(`Warnings:            ${report.warnings.length}`);
  console.log(`Failures:            ${report.failures.length}`);
  console.log(`Symbolic links skipped: ${report.symbolicLinksSkipped}`);
  console.log(`Duration:            ${elapsedMs.toFixed(2)} ms`);

  if (report.candidates.length > 0) {
    console.log('');
    console.log(options.apply ? 'Cleanup targets' : 'Planned cleanup');
    console.log('-'.repeat(48));

    for (const candidate of report.candidates) {
      const status = candidate.status || 'planned';

      console.log(
        `[${status.toUpperCase()}] ${candidate.path} (${formatBytes(candidate.bytes)})`,
      );
    }
  } else {
    console.log('');
    console.log('No eligible cleanup targets found.');
  }

  if (report.skipped.length > 0) {
    console.log('');
    console.log('Skipped');
    console.log('-'.repeat(48));

    for (const item of report.skipped) {
      console.log(`${item.path}: ${item.reason}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log('');
    console.log('Warnings');
    console.log('-'.repeat(48));

    for (const item of report.warnings) {
      console.warn(`${item.path}: ${item.message}`);
    }
  }

  if (report.failures.length > 0) {
    console.log('');
    console.log('Failures');
    console.log('-'.repeat(48));

    for (const item of report.failures) {
      console.error(`${item.path}: ${item.message}`);
    }
  }

  if (!options.apply && report.candidates.length > 0) {
    console.log('');
    console.log('Nothing was deleted. Review the targets, then rerun with --apply.');
  }

  console.log('');
  console.log(failed ? 'CLEANUP FAILED' : 'CLEANUP COMPLETED');
  console.log('');

  return output.exitCode;
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

    console.error('Run with --help for usage information.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  try {
    options.root = fs.realpathSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot resolve "${options.root}": ${error.message}`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  if (!isDirectory(options.root)) {
    console.error(`ROOT ERROR: "${options.root}" is not a directory.`);
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  const report = createReport();
  const candidates = [];

  for (const target of options.targets) {
    const validation = validateTarget(options.root, target);

    if (!validation.ok) {
      report.skipped.push({
        path: target,
        reason: validation.reason,
      });

      continue;
    }

    const absoluteTarget = validation.absoluteTarget;

    if (!fs.existsSync(absoluteTarget)) {
      report.skipped.push({
        path: target,
        reason: 'Target does not exist.',
      });

      continue;
    }

    let stat;

    try {
      stat = fs.lstatSync(absoluteTarget);
    } catch (error) {
      report.failures.push({
        path: target,
        message: error.message,
      });

      continue;
    }

    if (stat.isSymbolicLink()) {
      report.skipped.push({
        path: target,
        reason: 'Symbolic links are not cleanup targets.',
      });

      report.symbolicLinksSkipped += 1;
      continue;
    }

    if (!stat.isFile() && !stat.isDirectory()) {
      report.skipped.push({
        path: target,
        reason: 'Target is not a regular file or directory.',
      });

      continue;
    }

    candidates.push({
      path: absoluteTarget,
      relativePath: getRelativePath(options.root, absoluteTarget),
      bytes: calculateSize(absoluteTarget),
    });
  }

  if (options.temp) {
    const temporaryFiles = discoverTemporaryFiles(
      options.root,
      options,
      report,
    );

    for (const filePath of temporaryFiles) {
      if (
        !candidates.some((candidate) =>
          candidate.path === filePath ||
          isInside(candidate.path, filePath),
        )
      ) {
        candidates.push({
          path: filePath,
          relativePath: getRelativePath(options.root, filePath),
          bytes: calculateSize(filePath),
        });
      }
    }
  }

  // Remove descendants already covered by a selected directory target.
  const uniqueCandidates = candidates
    .sort((a, b) => a.path.length - b.path.length)
    .filter((candidate, index, all) =>
      !all.slice(0, index).some((parent) =>
        isInside(parent.path, candidate.path),
      ),
    );

  for (const candidate of uniqueCandidates) {
    report.candidates.push({
      path: candidate.relativePath,
      bytes: candidate.bytes,
      status: options.apply ? 'pending' : 'planned',
    });
  }

  if (options.apply) {
    for (const candidate of uniqueCandidates) {
      // Revalidate immediately before deletion.
      const validation = validateTarget(
        options.root,
        candidate.path,
      );

      if (!validation.ok) {
        report.failures.push({
          path: candidate.relativePath,
          message: `Safety check failed before deletion: ${validation.reason}`,
        });

        continue;
      }

      removeTarget(
        validation.absoluteTarget,
        options.root,
        report,
      );
    }
  }

  const elapsedMs = performance.now() - startedAt;

  return printReport(
    report,
    options,
    elapsedMs,
  );
}

try {
  process.exitCode = main();
} catch (error) {
  console.error('FATAL ERROR: Unexpected cleanup failure.');

  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = EXIT_CODES.OPERATION_FAILED;
}
