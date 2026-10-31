import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const defaultRoot = path.resolve(mobileRoot, '..');
const sourceRoot = path.resolve(process.env.MEDORBITS_WEB_ROOT || defaultRoot);
const outputRoot = path.join(mobileRoot, 'www');

const excludedNames = new Set([
  '.git', '.github', '.husky', '.vscode', 'node_modules', '.venv', 'venv',
  'mobile', 'db', 'database', 'server', 'controllers', 'models', 'services',
  'migrations', 'backups', 'secrets', 'private', 'logs', 'coverage',
  'dist', 'build', 'tests', 'test', 'tools', 'python', 'shell'
]);
const excludedFiles = new Set([
  '.env', '.env.local', '.env.production', '.env.development',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'
]);
const excludedExtensions = new Set(['.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.sql', '.dump', '.bak']);

function excluded(name) {
  return excludedNames.has(name) || excludedFiles.has(name) ||
    name.startsWith('.env.') || excludedExtensions.has(path.extname(name).toLowerCase());
}
async function copyTree(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (excluded(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) { console.warn(`Skipping symlink: ${from}`); continue; }
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}
const stat = await fs.stat(sourceRoot).catch(() => null);
if (!stat?.isDirectory()) throw new Error(`Website source directory not found: ${sourceRoot}`);
if (sourceRoot === mobileRoot || sourceRoot.startsWith(mobileRoot + path.sep)) {
  throw new Error('Refusing to stage from inside mobile package');
}
await fs.rm(outputRoot, { recursive: true, force: true });
await copyTree(sourceRoot, outputRoot);
const index = await fs.stat(path.join(outputRoot, 'index.html')).catch(() => null);
if (!index?.isFile()) throw new Error('Staging failed: root index.html not found. Set MEDORBITS_WEB_ROOT.');
console.log(`Staged ${sourceRoot} -> ${outputRoot}`);
console.warn('Inspect staged files for sensitive or admin-only content before release.');
