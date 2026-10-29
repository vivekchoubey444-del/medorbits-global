
#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function git(args) {
  return spawnSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true
  });
}

function getTrackedJsonFiles() {
  const result = git(['ls-files', '-z']);

  if (result.error) throw result.error;

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Git could not list tracked files.');
  }

  return [...new Set(
    result.stdout
      .split('\0')
      .filter(Boolean)
      .filter((file) => file.toLowerCase().endsWith('.json'))
  )].sort();
}

function validateFile(relativePath) {
  const absolutePath = path.resolve(ROOT, relativePath);

  if (!absolutePath.startsWith(ROOT + path.sep)) {
    console.error(`FAIL ${relativePath}: path is outside the repository.`);
    return false;
  }

  let contents;

  try {
    const stat = fs.lstatSync(absolutePath);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      console.error(`FAIL ${relativePath}: not a regular file.`);
      return false;
    }

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
      const prefix = contents.slice(0, position);
      const line = prefix.split('\n').length;
      const lastNewline = prefix.lastIndexOf('\n');
      const column = position - lastNewline;

      location = ` at line ${line}, column ${column}`;
    }

    console.error(`FAIL ${relativePath}${location}`);
    console.error(`  ${error.message}`);
    return false;
  }
}

function main() {
  let files;

  try {
    const rootResult = git(['rev-parse', '--show-toplevel']);

    if (rootResult.status !== 0) {
      throw new Error('Run this script inside a Git repository.');
    }

    const gitRoot = path.resolve(rootResult.stdout.trim());

    if (gitRoot !== ROOT) {
      throw new Error(
        `Expected repository root ${ROOT}, but Git reports ${gitRoot}.`
      );
    }

    files = getTrackedJsonFiles();
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  if (files.length === 0) {
    console.log('No tracked JSON files found.');
    return;
  }

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    if (validateFile(file)) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\nJSON validation summary');
  console.log(`Total: ${files.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) process.exitCode = 1;
}

main();
