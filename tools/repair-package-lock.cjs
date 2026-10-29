
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- Package Lock Repair Utility
 * File: tools/repair-package-lock.cjs
 * Requires: Node.js >= 22 and npm >= 10
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

const VALID_OPTIONS = new Set(['--check', '--local-agent']);

function fail(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exitCode = code;
  throw new Error('MEDORBITS_REPAIR_STOP');
}

function parseOptions() {
  const options = process.argv.slice(2);

  for (const option of options) {
    if (!VALID_OPTIONS.has(option)) {
      console.error(
        'Usage: node tools/repair-package-lock.cjs ' +
        '[--check] [--local-agent]'
      );
      fail(`Unknown option: ${option}`, 2);
    }
  }

  return {
    checkOnly: options.includes('--check'),
    localAgent: options.includes('--local-agent')
  };
}

function readJson(filePath) {
  let source;

  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`Cannot read ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

function validateManifest(manifest, filePath) {
  if (
    !manifest ||
    typeof manifest !== 'object' ||
    Array.isArray(manifest)
  ) {
    fail(`${filePath} must contain a JSON object.`);
  }

  if (
    typeof manifest.name !== 'string' ||
    manifest.name.trim() === ''
  ) {
    fail(`${filePath} must contain a non-empty "name" string.`);
  }

  if (
    manifest.version !== undefined &&
    typeof manifest.version !== 'string'
  ) {
    fail(`${filePath}: "version" must be a string.`);
  }
}

function validateLock(manifest, lock, lockPath) {
  if (
    !lock ||
    typeof lock !== 'object' ||
    Array.isArray(lock)
  ) {
    fail(`${lockPath} must contain a JSON object.`);
  }

  if (lock.lockfileVersion !== 3) {
    fail(
      `${lockPath}: expected lockfileVersion 3; ` +
      `found ${lock.lockfileVersion}.`
    );
  }

  if (!lock.packages || typeof lock.packages !== 'object') {
    fail(`${lockPath} is missing its "packages" object.`);
  }

  const rootPackage = lock.packages[''];

  if (!rootPackage || typeof rootPackage !== 'object') {
    fail(`${lockPath} is missing packages[""] root metadata.`);
  }

  if (lock.name !== manifest.name) {
    fail(
      `Lockfile name "${lock.name}" does not match ` +
      `package name "${manifest.name}".`
    );
  }

  if (
    manifest.version !== undefined &&
    lock.version !== manifest.version
  ) {
    fail('Lockfile version does not match package.json.');
  }

  if (rootPackage.name !== manifest.name) {
    fail('Lockfile root package name does not match package.json.');
  }

  if (
    manifest.version !== undefined &&
    rootPackage.version !== manifest.version
  ) {
    fail('Lockfile root package version does not match package.json.');
  }

  console.log('PASS: package manifest and lockfile metadata match.');
}

function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (result.error) {
    fail(`Could not execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(`${command} exited with status ${result.status ?? 'unknown'}.`);
  }
}

function main() {
  const options = parseOptions();
  const repositoryRoot = path.resolve(__dirname, '..');

  const packageDirectory = options.localAgent
    ? path.join(repositoryRoot, 'local-agent')
    : repositoryRoot;

  const manifestPath = path.join(packageDirectory, 'package.json');
  const lockPath = path.join(packageDirectory, 'package-lock.json');

  console.log('MedOrbits Package Lock Repair');
  console.log(`Repository: ${repositoryRoot}`);
  console.log(`Package directory: ${packageDirectory}`);

  if (!fs.existsSync(manifestPath)) {
    fail(`Missing package.json: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath);
  validateManifest(manifest, manifestPath);

  console.log(`Package name: ${manifest.name}`);

  if (options.checkOnly) {
    if (!fs.existsSync(lockPath)) {
      fail(`Missing package-lock.json: ${lockPath}`);
    }

    const lock = readJson(lockPath);
    validateLock(manifest, lock, lockPath);
    return;
  }

  const nodeMajor = Number(process.versions.node.split('.')[0]);

  if (nodeMajor < 22) {
    fail(`Node.js >= 22 required; found ${process.versions.node}.`);
  }

  const npmCommand = process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

  const npmVersion = spawnSync(npmCommand, ['--version'], {
    cwd: packageDirectory,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (npmVersion.error || npmVersion.status !== 0) {
    fail('npm is unavailable. Install npm >= 10.');
  }

  const npmVersionText = String(npmVersion.stdout || '').trim();
  const npmMajor = Number(npmVersionText.split('.')[0]);

  if (!Number.isFinite(npmMajor) || npmMajor < 10) {
    fail(`npm >= 10 required; found ${npmVersionText || 'unknown'}.`);
  }

  console.log(`Node.js: ${process.versions.node}`);
  console.log(`npm: ${npmVersionText}`);
  console.log('Generating lockfile from package.json...');

  execute(
    npmCommand,
    [
      'install',
      '--package-lock-only',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund'
    ],
    packageDirectory
  );

  if (!fs.existsSync(lockPath)) {
    fail('npm did not create package-lock.json.');
  }

  const generatedLock = readJson(lockPath);
  validateLock(manifest, generatedLock, lockPath);

  console.log('SUCCESS: package-lock.json generated and validated.');
  console.log('Review the changes before committing.');
}

try {
  main();
} catch (error) {
  if (error.message !== 'MEDORBITS_REPAIR_STOP') {
    console.error(`Unexpected error: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
