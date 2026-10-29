#!/usr/bin/env node
'use strict';

/**
 * MedOrbits YAML Validator
 * File: tools/validate-yaml.js
 *
 * Requirements:
 *   Node.js >= 20
 *   npm install --save-dev yaml
 *
 * Usage:
 *   node tools/validate-yaml.js
 *   node tools/validate-yaml.js .github/workflows
 *   node tools/validate-yaml.js .github/workflows/ci.yml
 *
 * Exit codes:
 *   0 = all checked YAML files are valid
 *   1 = validation errors found
 *   2 = setup or runtime error
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  'vendor',
  '__pycache__',
  'dist',
  'build',
  'coverage'
]);

const YAML_EXTENSIONS = new Set(['.yaml', '.yml']);

function print(message = '') {
  process.stdout.write(`${message}\n`);
}

function collectYamlFiles(target) {
  let stat;

  try {
    stat = fs.statSync(target);
  } catch {
    throw new Error(`Path does not exist: ${target}`);
  }

  if (stat.isFile()) {
    if (!YAML_EXTENSIONS.has(path.extname(target).toLowerCase())) {
      throw new Error(`Not a YAML file: ${target}`);
    }

    return [target];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...collectYamlFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      YAML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatParserError(error) {
  const message = error && error.message
    ? error.message
    : String(error);

  const line = error?.linePos?.[0]?.line;
  const column = error?.linePos?.[0]?.col;

  if (line && column) {
    return `${message} (line ${line}, column ${column})`;
  }

  return message;
}

async function main() {
  let YAML;

  try {
    YAML = require('yaml');
  } catch {
    print('ERROR: The "yaml" package is not installed.');
    print('Run: npm install --save-dev yaml');
    process.exitCode = 2;
    return;
  }

  const targets = process.argv.slice(2);
  const inputs = targets.length > 0 ? targets : [ROOT];
  const files = [];

  try {
    for (const input of inputs) {
      const absolutePath = path.resolve(ROOT, input);
      files.push(...collectYamlFiles(absolutePath));
    }
  } catch (error) {
    print(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (uniqueFiles.length === 0) {
    print('No YAML files found.');
    process.exitCode = 0;
    return;
  }

  let passed = 0;
  let failed = 0;

  print(`Validating ${uniqueFiles.length} YAML file(s)...`);

  for (const file of uniqueFiles) {
    const relativePath = path.relative(ROOT, file);

    try {
      const source = fs.readFileSync(file, 'utf8');

      if (source.trim() === '') {
        throw new Error('File is empty');
      }

      const document = YAML.parseDocument(source, {
        uniqueKeys: true,
        prettyErrors: true,
        strict: true
      });

      if (document.errors.length > 0) {
        throw document.errors[0];
      }

      passed++;
      print(`PASS ${relativePath}`);
    } catch (error) {
      failed++;
      print(`FAIL ${relativePath}`);
      print(`     ${formatParserError(error)}`);
    }
  }

  print('');
  print(`Results: ${passed} passed, ${failed} failed.`);

  if (failed > 0) {
    print('Fix the reported files and run this validator again.');
    process.exitCode = 1;
  } else {
    print('All checked YAML files passed syntax validation.');
    process.exitCode = 0;
  }
}

main().catch((error) => {
  print(`FATAL: ${error.stack || error.message || error}`);
  process.exitCode = 2;
});