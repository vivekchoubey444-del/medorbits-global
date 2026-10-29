
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- NPM Lockfile Repair Utility
 * File: tools/repair-package-lock.cjs
 * Requires: Node.js >= 22, npm >= 10
 *
 * Usage:
 *   node tools/repair-package-lock.cjs
 *   node tools/repair-package-lock.cjs --check
 *   node tools/repair-package-lock.cjs --local-agent
 *   node tools/repair-package-lock.cjs --local-agent --check
 *
 * This utility does not commit, push, delete project files, or run
 * package lifecycle scripts.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const VALID_ARGS = new Set(['--check', '--local-agent']);
const args = process.argv.slice(2);

for (const arg of args) {
  if (!VALID_ARGS.has(arg)) {
    console.error(`ERROR: Unknown option: ${arg}`);
    console.error(
      'Usage: node tools/repair-package-lock.cjs ' +
      '[--check] [--local-agent]'
    );
    process.exit(2);
  }
}

const checkOnly = args.includes('--check');
const useLocalAgent = args.includes('--local-agent');

const repositoryRoot = path.resolve(__dirname, '..');

const packageDirectory = useLocalAgent
  ? path.join(repositoryRoot, 'local-agent')
  : repositoryRoot;

const packageJsonPath = path.join(packageDirectory, 'package.json');
const packageLockPath = path.join(packageDirectory, 'package-lock.json');

function fail(message, exitCode = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(exitCode);
}

function readJson(filePath) {
  let source;

  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(
      `Cannot read ${path.relative(repositoryRoot, filePath)}: ` +
      error.message
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    fail(
      `Invalid JSON in ${path.relative(repositoryRoot, filePath)}: ` +
      error.message
    );
  }
}

function validateManifest(manifest) {
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    fail('package.json must contain a JSON object.');
  }

  if (
    typeof manifest.name !== 'string' ||
    manifest.name.trim() === ''
  ) {
    fail('package.json must contain a non-empty "name" string.');
  }

  if (
    manifest.version !== undefined &&
    typeof manifest.version !== 'string'
  ) {
    fail('package.json "version" must be a string when specified.');
  }
}

function validateLockfile(manifest, lock) {
  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) {
    fail('package-lock.json must contain a JSON object.');
  }

  if (lock.name !== manifest.name) {
    fail(
      `Lockfile name "${lock.name}" does not match ` +
      `manifest name "${manifest.name}".`
    );
  }

  if (
    manifest.version !== undefined &&
    lock.version !== manifest.version
  ) {
    fail(
      `Lockfile version "${lock.version}" does not match ` +
      `manifest version "${manifest.version}".`
    );
  }

  if (lock.lockfileVersion !== 3) {
    fail(
      `Expected lockfileVersion 3; found ${lock.lockfileVersion}.`
    );
  }

  if (
    !lock.packages ||
    typeof lock.packages !== 'object' ||
    Array.isArray(lock.packages)
  ) {
    fail('Lockfile is missing the "packages" object.');
  }

  if (
    !lock.packages[''] ||
    typeof lock.packages[''] !== 'object'
  ) {
    fail('Lockfile is missing the root packages[""] entry.');
  }

  if (lock.packages[''].name !== manifest.name) {
    fail('Root package metadata does not match package.json.');
  }

  if (
    manifest.version !== undefined &&
    lock.packages[''].version !== manifest.version
  ) {
    fail('Root package version metadata does not match package.json.');
  }

  return true;
}

function runNpm(argsToRun) {
  const npmCommand = process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

  const result = spawnSync(npmCommand, argsToRun, {
    cwd: packageDirectory,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (result.error) {
    fail(`Unable to start npm: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`npm exited with status ${result.status ?? 'unknown'}.`);
  }
}

function main() {
  console.log('');
  console.log('MedOrbits NPM Lockfile Repair');
  console.log('-----------------------------');
  console.log(`Repository: ${repositoryRoot}`);
  console.log(`Package directory: ${packageDirectory}`);

  if (!fs.existsSync(packageJsonPath)) {
    fail(
      `package.json not found at ` +
      `${path.relative(repositoryRoot, packageJsonPath)}.`
    );
  }

  const manifest = readJson(packageJsonPath);
  validateManifest(manifest);

  console.log(`Package name: ${manifest.name}`);
  console.log(`Package version: ${manifest.version || '(not specified)'}`);

  if (checkOnly) {
    if (!fs.existsSync(packageLockPath)) {
      fail(
        `package-lock.json not found at ` +
        `${path.relative(repositoryRoot, packageLockPath)}.`
      );
    }

    const lock = readJson(packageLockPath);
    validateLockfile(manifest, lock);

    console.log('');
    console.log('PASS: package.json and package-lock.json are consistent.');
    return;
  }

  const nodeMajor = Number(process.versions.node.split('.')[0]);

  if (nodeMajor < 22) {
    fail(`Node.js >= 22 is required; found ${process.versions.node}.`);
  }

  const npmCommand = process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

  const npmVersionResult = spawnSync(npmCommand, ['--version'], {
    cwd: packageDirectory,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (npmVersionResult.error || npmVersionResult.status !== 0) {
    fail(
      'npm is unavailable. Install npm >= 10 with a supported Node.js release.'
    );
  }

  const npmVersion = String(npmVersionResult.stdout || '').trim();
  const npmMajor = Number(npmVersion.split('.')[0]);

  if (!Number.isFinite(npmMajor) || npmMajor < 10) {
    fail(`npm >= 10 is required; found ${npmVersion || 'unknown'}.`);
  }

  console.log(`Node.js: ${process.versions.node}`);
  console.log(`npm: ${npmVersion}`);

  console.log('');
  console.log('Generating lockfile from package.json...');
  console.log('Lifecycle scripts and audit requests are disabled.');

  runNpm([
    'install',
    '--package-lock-only',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund'
  ]);

  if (!fs.existsSync(packageLockPath)) {
    fail('npm completed without creating package-lock.json.');
  }

  const generatedLock = readJson(packageLockPath);
  validateLockfile(manifest, generatedLock);

  console.log('');
  console.log('SUCCESS: Lockfile generated and validated.');
  console.log(
    'Next: review the Git diff and run your repository checks.'
  );
}

try {
  main();
} catch (error) {
  console.error(`UNEXPECTED ERROR: ${error.message}`);
  process.exitCode = 1;
}
