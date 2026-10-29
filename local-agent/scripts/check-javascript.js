'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = new Set(['node_modules', '.git', 'coverage', 'dist', 'build']);
const EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);
const files = [];
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) files.push(file);
  }
}

try {
  walk(ROOT);
} catch (error) {
  console.error(`JavaScript discovery failed: ${error.message}`);
  process.exit(2);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
    timeout: 15000,
    windowsHide: true
  });
  if (result.error || result.status !== 0) {
    failures.push({ file, message: result.error?.message || result.stderr || result.stdout || 'Syntax check failed' });
  }
}

if (failures.length) {
  console.error(`JavaScript syntax failures (${failures.length}/${files.length} files):`);
  for (const failure of failures) console.error(`\n${path.relative(ROOT, failure.file)}\n${failure.message.trim()}`);
  process.exit(1);
}

console.log(`JavaScript syntax passed: ${files.length} files checked.`);
