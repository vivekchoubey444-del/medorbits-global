import fs from 'node:fs/promises';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });
add('Node.js >= 20', Number(process.versions.node.split('.')[0]) >= 20, process.versions.node);
for (const command of ['npm', 'git']) {
  try {
    const version = execFileSync(command, ['--version'], { encoding: 'utf8' }).trim();
    add(command, true, version);
  } catch { add(command, false, 'not found on PATH'); }
}
for (const file of ['package.json', 'capacitor.config.ts', 'www/index.html']) {
  try { await fs.access(new URL(`../${file}`, import.meta.url)); add(file, true, 'present'); }
  catch { add(file, false, 'missing'); }
}
console.table(checks);
if (checks.some(check => !check.ok)) process.exitCode = 1;
