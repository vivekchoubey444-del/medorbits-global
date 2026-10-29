
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits package-lock repair utility
 *
 * Usage from repository root:
 *   node tools/repair-package-lock.cjs
 *   node tools/repair-package-lock.cjs --local-agent
 *   node tools/repair-package-lock.cjs --check
 *
 * Generates a real npm lockfile from the matching package.json.
 * Does not push changes or run package lifecycle scripts.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const localAgent = args.has('--local-agent');

if ([...args].some((arg) =>
  !['--check', '--local-agent'].includes(arg)
)) {
  console.error(
    'Usage: node tools/repair-package-lock.cjs [--check] [--local-agent]'
  );
  process.exit(2);
}

const repoRoot = path.resolve(__dirname, '..');
const packageDir = localAgent
  ? path.join(repoRoot, 'local-agent')
  : repoRoot;

const packagePath = path.join(packageDir, 'package.json');
const lockPath = path.join(packageDir, 'package-lock.json');

function stop(message, code = 1) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function readJson(file) {
  let text;

  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    stop(`Cannot read ${path.relative(repoRoot, file)}: ${error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    stop(`Invalid JSON in ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

if (!fs.existsSync(packagePath)) {
  stop(
    `package.json not found at ${path.relative(repoRoot, packagePath)}. ` +
    'Run from the repository containing the intended manifest.'
  );
}

const manifest = readJson(packagePath);

if (
  !manifest ||
  typeof manifest !== 'object' ||
  Array.isArray(manifest) ||
  typeof manifest.name !== 'string' ||
  !manifest.name.trim()
) {
  stop('package.json must contain a non-empty string "name".');
}

if (manifest.packageManager &&
    !/^npm@/.test(manifest.packageManager)) {
  console.warn(
    `WARNING: packageManager is "${manifest.packageManager}". ` +
    'Confirm npm is the intended package manager.'
  );
}

console.log(`Package directory: ${packageDir}`);
console.log(`Package name: ${manifest.name}`);

if (checkOnly) {
  if (!fs.existsSync(lockPath)) {
    stop(`Lockfile missing: ${path.relative(repoRoot, lockPath)}`);
  }

  const lock = readJson(lockPath);

  if (lock.name !== manifest.name) {
    stop(
      `Lockfile name "${lock.name}" does not match ` +
      `package.json name "${manifest.name}".`
    );
  }

  if (lock.version !== manifest.version) {
    stop(
      `Lockfile version "${lock.version}" does not match ` +
      `package.json version "${manifest.version}".`
    );
  }

  if (!lock.packages || typeof lock.packages !== 'object') {
    stop('Lockfile is missing the "packages" object.');
  }

  if (!lock.packages['']) {
    stop('Lockfile is missing packages[""] root metadata.');
  }

  if (lock.lockfileVersion !== 3) {
    stop(`Expected lockfileVersion 3; found ${lock.lockfileVersion}.`);
  }

  console.log('OK: package.json and package-lock.json metadata match.');
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const npmVersion = spawnSync(npmCommand, ['--version'], {
  cwd: packageDir,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (npmVersion.error || npmVersion.status !== 0) {
  stop(
    `npm is unavailable. Install a supported Node.js/npm version first. ` +
    `${npmVersion.error ? npmVersion.error.message : npmVersion.stderr || ''}`
  );
}

console.log(`npm version: ${npmVersion.stdout.trim()}`);
console.log('Generating package-lock.json from package.json...');

const result = spawnSync(
  npmCommand,
  [
    'install',
    '--package-lock-only',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ],
  {
    cwd: packageDir,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.error) {
  stop(`Could not start npm: ${result.error.message}`);
}

if (result.status !== 0) {
  stop(`npm failed with exit code ${result.status ?? 'unknown'}.`);
}

if (!fs.existsSync(lockPath)) {
  stop('npm finished without creating package-lock.json.');
}

const lock = readJson(lockPath);

if (lock.name !== manifest.name) {
  stop('Generated lockfile name does not match package.json.');
}

if (lock.version !== manifest.version) {
  stop('Generated lockfile version does not match package.json.');
}

if (lock.lockfileVersion !== 3) {
  stop(`Expected lockfileVersion 3; found ${lock.lockfileVersion}.`);
}

if (!lock.packages || !lock.packages['']) {
  stop('Generated lockfile is missing root package metadata.');
}

console.log('SUCCESS: package-lock.json generated and validated.');
console.log('Review the Git diff before committing.');
