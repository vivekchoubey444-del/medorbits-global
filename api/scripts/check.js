'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
let failures = 0;
let checked = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js')) {
        checked++;
        const result = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
        if (result.status !== 0) {
          failures++;
          process.stderr.write(`[FAIL] ${path.relative(root, full)}\n${result.stderr}`);
        }
      } else if (entry.name.endsWith('.json')) {
        checked++;
        try {
          JSON.parse(fs.readFileSync(full, 'utf8'));
        } catch (error) {
          failures++;
          process.stderr.write(`[FAIL] ${path.relative(root, full)}: ${error.message}\n`);
        }
      }
    }
  }
}

walk(root);
console.log(`Checked ${checked} JavaScript/JSON files; failures: ${failures}`);
process.exitCode = failures ? 1 : 0;
