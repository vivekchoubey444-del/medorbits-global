'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED = new Set(['node_modules', '.git', 'coverage', 'dist', 'build']);
const failures = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walk(file);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      checked += 1;
      try {
        JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        failures.push(`${path.relative(ROOT, file)}: ${error.message}`);
      }
    }
  }
}

try {
  walk(ROOT);
} catch (error) {
  console.error(`JSON validation could not complete: ${error.message}`);
  process.exit(2);
}

if (failures.length) {
  console.error(`Invalid JSON files (${failures.length}/${checked} checked):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`JSON validation passed: ${checked} files checked.`);
