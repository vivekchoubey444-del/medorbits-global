import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const badNames = new Set(['.env', '.env.local', '.env.production', 'id_rsa', 'id_ed25519']);
const findings = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (badNames.has(entry.name) || entry.name.startsWith('.env.')) findings.push(file);
    if (entry.isDirectory()) await walk(file);
  }
}
await walk(root).catch(() => findings.push('www missing or unreadable'));
if (findings.length) {
  findings.forEach(item => console.error(`Potential secret file: ${item}`));
  process.exit(1);
}
const index = await fs.stat(path.join(root, 'index.html')).catch(() => null);
if (!index?.isFile()) {
  console.error('www/index.html missing; run npm run stage:web or restore the placeholder.');
  process.exit(1);
}
console.log('Staged website checks passed (filename scan only; manual review required).');
