
#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function runGit(args) {
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });
}

function getTrackedJsonFiles() {
  const result = runGit([
    'ls-files',
    '-z',
    '--',
    '*.json',
    '**/*.json'
  ]);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      result.stderr.trim() || 'Unable to list tracked JSON files.'
    );
  }

  return [...new Set(
    result.stdout
      .split('\0')
      .filter(Boolean)
      .filter((file) => file.toLowerCase().endsWith('.json'))
  )].sort();
}

function validateJsonFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);

  if (
    absolutePath !== ROOT &&
    !absolutePath.startsWith(ROOT + path.sep)
  ) {
    console.error(`FAIL ${relativePath}: path is outside the repository.`);
    return false;
  }

  let contents;

  try {
    contents = fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    console.error(`FAIL ${relativePath}: ${error.message}`);
    return false;
  }

  try {
    JSON.parse(contents.replace(/^\uFEFF/, ''));
    console.log(`PASS ${relativePath}`);
    return true;
  } catch (error) {
    const match = /position\s+(\d+)/i.exec(error.message);
    let location = '';

    if (match) {
      const position = Number(match[1]);
      const beforeError = contents.slice(0, position);
      const line = beforeError.split('\n').length;
      const lastNewline = beforeError.lastIndexOf('\n');
      const column = position - lastNewline;

      location = ` at line ${line}, column ${column}`;
    }

    console.error(`FAIL ${relativePath}${location}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

function main() {
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    const gitDirectory = runGit(['rev-parse', '--show-toplevel']);

    if (gitDirectory.status !== 0) {
      console.error('ERROR: Run this utility inside a Git repository.');
      process.exitCode = 2;
      return;
    }
  }

  let files;

  try {
    files = getTrackedJsonFiles();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (files.length === 0) {
    console.log('No tracked JSON files were found.');
    return;
  }

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    if (validateJsonFile(file)) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log('');
  console.log(`Tracked JSON files: ${files.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
