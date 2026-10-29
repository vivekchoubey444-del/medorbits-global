#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${path.basename(file)} is invalid: ${error.message}`);
  }
}

if (!fs.existsSync(packagePath)) {
  console.error('ERROR: package.json not found in the current directory.');
  process.exit(1);
}

let pkg;
try {
  pkg = readJson(packagePath);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (!pkg.name || !pkg.version) {
  console.error('ERROR: package.json must contain name and version.');
  process.exit(1);
}

let lock = null;
let needsRepair = !fs.existsSync(lockPath);

if (!needsRepair) {
  try {
    lock = readJson(lockPath);
    const lockedRoot = lock.packages && lock.packages[''];
    needsRepair = lock.name !== pkg.name ||
      lock.version !== pkg.version ||
      !lockedRoot ||
      lockedRoot.name !== pkg.name ||
      lockedRoot.version !== pkg.version ||
      JSON.stringify(lockedRoot.dependencies || {}) !== JSON.stringify(pkg.dependencies || {}) ||
      JSON.stringify(lockedRoot.devDependencies || {}) !== JSON.stringify(pkg.devDependencies || {});
  } catch (error) {
    console.warn(error.message);
    needsRepair = true;
  }
}

if (!needsRepair) {
  console.log('package-lock.json metadata matches package.json.');
  process.exit(0);
}

if (fs.existsSync(lockPath)) {
  const backupPath = `${lockPath}.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(lockPath, backupPath);
  console.log(`Backup created: ${path.basename(backupPath)}`);
}

console.log('Regenerating lockfile metadata and dependency resolution with npm...');
const result = spawnSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
  { cwd: root, stdio: 'inherit', shell: false, windowsHide: true }
);

if (result.error || result.status !== 0) {
  console.error('ERROR: npm could not regenerate the lockfile.');
  console.error('Check registry connectivity and dependency versions, then rerun this script.');
  process.exit(2);
}

try {
  pkg = readJson(packagePath);
  lock = readJson(lockPath);
  const lockedRoot = lock.packages && lock.packages[''];
  if (
    lock.name !== pkg.name || lock.version !== pkg.version ||
    !lockedRoot || lockedRoot.name !== pkg.name || lockedRoot.version !== pkg.version ||
    JSON.stringify(lockedRoot.dependencies || {}) !== JSON.stringify(pkg.dependencies || {}) ||
    JSON.stringify(lockedRoot.devDependencies || {}) !== JSON.stringify(pkg.devDependencies || {})
  ) {
    throw new Error('Generated lockfile metadata still does not match package.json.');
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(2);
}

console.log('Lockfile regenerated and verified.');
