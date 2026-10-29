#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['.git', 'node_modules', '.venv', 'venv', 'dist', 'build', 'coverage', '.local-agent']);
const errors = [];
let checked = 0;
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { errors.push(`${path.relative(root, dir)}: ${error.message}`); return; }
  for (const entry of entries) {
    if (excluded.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      checked++;
      try { JSON.parse(fs.readFileSync(full, 'utf8')); }
      catch (error) { errors.push(`${path.relative(root, full)}: ${error.message}`); }
    }
  }
}
walk(root);
console.log(`JSON files checked: ${checked}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('JSON validation passed.');
