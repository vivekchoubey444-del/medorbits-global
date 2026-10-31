import fs from 'node:fs/promises';
import process from 'node:process';

const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
const config = await fs.readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
const problems = [];
if (!pkg.engines?.node || Number(pkg.engines.node.replace(/\D/g, '')) < 20) problems.push('Node.js >=20 engine is required');
if (!config.includes("appId: 'in.medorbits.app'")) problems.push('Expected appId is missing');
if (!config.includes("webDir: 'www'")) problems.push('Capacitor webDir must be www');
if (problems.length) {
  problems.forEach(problem => console.error(`ERROR: ${problem}`));
  process.exit(1);
}
console.log('Mobile package configuration checks passed.');
