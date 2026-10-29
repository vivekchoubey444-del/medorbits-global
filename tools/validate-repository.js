#!/usr/bin/env node
'use strict';

/**
 * MedOrbits Repository Validation Runner
 * File: tools/validate-repository.js
 *
 * Runs the repository's existing validators sequentially.
 * Does not modify source files or suppress failures.
 *
 * Usage:
 *   node tools/validate-repository.js
 *   node tools/validate-repository.js --strict
 *
 * Exit codes:
 *   0 = all configured checks passed
 *   1 = one or more checks failed
 *   2 = runner configuration or runtime error
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const STRICT = process.argv.includes('--strict');

const CHECKS = [
  {
    name: 'JavaScript syntax',
    file: 'tools/validate-javascript.js'
  },
  {
    name: 'JSON syntax',
    file: 'tools/validate-json.js'
  },
  {
    name: 'JSON Schema',
    file: 'tools/validate-json-schema.js'
  },
  {
    name: 'YAML syntax',
    file: 'tools/validate-yaml.js'
  },
  {
    name: 'HTML structure',
    file: 'tools/validate-html.js'
  }
];

function runCheck(check) {
  const script = path.join(ROOT, check.file);

  if (!fs.existsSync(script)) {
    return {
      name: check.name,
      status: 'FAIL',
      detail: `Required validator not found: ${check.file}`
    };
  }

  const result = spawnSync(
    NODE,
    [script],
    {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );

  const output = [
    result.stdout || '',
    result.stderr || ''
  ].filter(Boolean).join('\n').trim();

  if (result.error) {
    return {
      name: check.name,
      status: 'FAIL',
      detail: result.error.message
    };
  }

  if (result.status !== 0) {
    return {
      name: check.name,
      status: 'FAIL',
      detail: output || `Validator exited with code ${result.status}`
    };
  }

  return {
    name: check.name,
    status: 'PASS',
    detail: output
  };
}

function main() {
  if (process.argv.some(
    (arg) => !['--strict'].includes(arg)
  )) {
    console.error(
      'Usage: node tools/validate-repository.js [--strict]'
    );
    process.exitCode = 2;
    return;
  }

  console.log('==========================================');
  console.log(' MedOrbits Repository Health Check');
  console.log('==========================================');
  console.log(`Root: ${ROOT}`);
  console.log(`Node: ${process.version}`);
  console.log(`Mode: ${STRICT ? 'strict' : 'standard'}`);
  console.log('');

  const results = [];

  for (const check of CHECKS) {
    console.log(`\n[RUN] ${check.name}`);

    const result = runCheck(check);
    results.push(result);

    console.log(`[${result.status}] ${result.name}`);

    if (result.detail) {
      console.log(result.detail);
    }
  }

  const passed = results.filter(
    (result) => result.status === 'PASS'
  ).length;

  const failed = results.filter(
    (result) => result.status === 'FAIL'
  ).length;

  console.log('\n==========================================');
  console.log(' FINAL VALIDATION SUMMARY');
  console.log('==========================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.error(
      '\nVALIDATION FAILED. Correct the reported errors and rerun.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nAll configured validation checks passed.');
  console.log(
    'Note: passing these checks does not guarantee deployment success.'
  );

  process.exitCode = 0;
}

main();
