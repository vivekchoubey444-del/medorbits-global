
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits package-lock repair utility.
 *
 * Usage:
 *   node tools/repair-package-lock.cjs
 *   node tools/repair-package-lock.cjs --check
 *   node tools/repair-package-lock.cjs --local-agent
 *   node tools/repair-package-lock.cjs --local-agent --check
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const allowed = new Set(['--check', '--local-agent']);

for (const arg of args) {
  if (!allowed.has(arg)) {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

const checkOnly = args.includes('--check');
const localAgent = args.includes('--local-agent');

const root = path.resolve(__dirname, '..');
const directory = localAgent
  ? path.join(root, 'local-agent')
  : root;

const manifestPath = path.join(directory, 'package.json');
const lockPath = path.join(directory, 'package-lock.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function readJson(file) {
  let content;

  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`Cannot read ${file}: ${error.message}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    fail(`Invalid JSON in ${file}: ${error.message}`);
  }
}

if (!fs.existsSync(manifestPath)) {
  fail(`package.json not found: ${manifestPath}`);
}

const manifest = readJson(manifestPath);

if (
  !manifest ||
  typeof manifest !== 'object' ||
  Array.isArray(manifest) ||
  typeof manifest.name !== 'string' ||
  !manifest.name.trim()
) {
  fail('package.json must contain a non-empty string "name".');
}

console.log(`Package: ${manifest.name}`);
console.log(`Directory: ${directory}`);

if (checkOnly) {
  if (!fs.existsSync(lockPath)) {
    fail(`package-lock.json not found: ${lockPath}`);
  }

  const lock = readJson(lockPath);
  const rootPackage = lock.packages && lock.packages[''];

  if (lock.name !== manifest.name) {
    fail('Lockfile name does not match package.json.');
  }

  if (
    manifest.version !== undefined &&
    lock.version !== manifest.version
  ) {
    fail('Lockfile version does not match package.json.');
  }

  if (
    lock.lockfileVersion !== 3 ||
    !lock.packages ||
    typeof lock.packages !== 'object' ||
    !rootPackage
  ) {
    fail('Lockfile is missing required npm lockfile v3 metadata.');
  }

  for (const key of ['name', 'version']) {
    if (
      manifest[key] !== undefined &&
      rootPackage[key] !== undefined &&
      manifest[key] !== rootPackage[key]
    ) {
      fail(`Lockfile root package ${key} does not match package.json.`);
    }
  }

  console.log('PASS: package.json and package-lock.json are consistent.');
  process.exit(0);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const version = spawnSync(npm, ['--version'], {
  cwd: directory,
  encoding: 'utf8',
  shell: process.platform === 'win32'
});

if (version.error || version.status !== 0) {
  fail(
    `Unable to execute npm: ${
      version.error ? version.error.message : version.stderr
    }`
  );
}

console.log(`npm version: ${version.stdout.trim()}`);
console.log('Generating the lockfile from package.json...');

const result = spawnSync(
  npm,
  [
    'install',
    '--package-lock-only',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund'
  ],
  {
    cwd: directory,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  }
);

if (result.error) {
  fail(`npm execution failed: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(`npm exited with code ${result.status ?? 'unknown'}.`);
}

if (!fs.existsSync(lockPath)) {
  fail('npm did not create package-lock.json.');
}

const lock = readJson(lockPath);
const rootPackage = lock.packages && lock.packages[''];

if (
  lock.name !== manifest.name ||
  (
    manifest.version !== undefined &&
    lock.version !== manifest.version
  ) ||
  lock.lockfileVersion !== 3 ||
  !lock.packages ||
  typeof lock.packages !== 'object' ||
  !rootPackage
) {
  fail('Generated lockfile failed validation.');
}

for (const key of ['name', 'version']) {
  if (
    manifest[key] !== undefined &&
    rootPackage[key] !== undefined &&
    manifest[key] !== rootPackage[key]
  ) {
    fail(`Generated lockfile root package ${key} does not match package.json.`);
  }
}

console.log('SUCCESS: package-lock.json generated and validated.');
console.log('Review your Git changes before committing.');
