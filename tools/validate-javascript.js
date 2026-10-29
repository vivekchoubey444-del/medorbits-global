
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits JavaScript Syntax Validator
 * File: tools/validate-javascript.js
 *
 * Usage:
 *   node tools/validate-javascript.js
 *   node tools/validate-javascript.js tools scripts
 *   node tools/validate-javascript.js tools/repair-package-lock.cjs
 *
 * Uses Node.js built-in syntax checking.
 * Does not execute application code.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = process.cwd();

const EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  'vendor',
  '__pycache__',
  'dist',
  'build',
  'coverage',
  '.next'
]);

function collectFiles(target) {
  const stat = fs.statSync(target);

  if (stat.isFile()) {
    if (!EXTENSIONS.has(path.extname(target).toLowerCase())) {
      throw new Error(`Unsupported JavaScript file: ${target}`);
    }

    return [target];
  }

  if (!stat.isDirectory()) return [];

  const results = [];

  for (const entry of fs.readdirSync(target, {
    withFileTypes: true
  })) {
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        results.push(...collectFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function main() {
  const targets = process.argv.slice(2);
  const inputs = targets.length ? targets : [ROOT];
  const files = [];

  try {
    for (const input of inputs) {
      const absolute = path.resolve(ROOT, input);

      if (!fs.existsSync(absolute)) {
        throw new Error(`Path does not exist: ${input}`);
      }

      files.push(...collectFiles(absolute));
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (uniqueFiles.length === 0) {
    console.log('No JavaScript files found.');
    return;
  }

  let passed = 0;
  let failed = 0;

  console.log(`Checking ${uniqueFiles.length} JavaScript file(s)...`);

  for (const file of uniqueFiles) {
    const relative = path.relative(ROOT, file);

    const result = spawnSync(
      process.execPath,
      ['--check', file],
      {
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true
      }
    );

    if (result.error || result.status !== 0) {
      failed++;
      console.error(`\nFAIL ${relative}`);

      if (result.error) {
        console.error(result.error.message);
      }

      if (result.stderr) {
        console.error(result.stderr.trim());
      }

      if (result.stdout) {
        console.error(result.stdout.trim());
      }
    } else {
      passed++;
      console.log(`PASS ${relative}`);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('All checked JavaScript files passed syntax checks.');
  }
}

main();
