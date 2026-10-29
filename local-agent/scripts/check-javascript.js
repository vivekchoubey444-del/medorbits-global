#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.local-agent']);
const extensions = new Set(['.js', '.cjs', '.mjs']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(full);
  }
}
walk(root);
const failures = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.status !== 0) failures.push(`${path.relative(root, file)}\n${result.stderr || result.error?.message || `exit ${result.status}`}`);
}
console.log(`JavaScript files checked: ${files.length}`);
if (failures.length) { console.error(failures.join('\n\n')); process.exitCode = 1; }
else console.log('JavaScript syntax validation passed.');
