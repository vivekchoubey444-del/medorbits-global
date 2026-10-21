'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
]);
const TEST_FILE = /\.(?:test|spec)\.[jt]sx?$/i;
// Matches simple test declarations with a single-quoted title.
// This is a line-based migration, not a full JavaScript parser.
const TEST_TITLE = /^(\s*(?:it|test|describe)(?:\.\w+)?\s*\(\s*)'((?:\\.|[^'\\])*)'(\s*,.*)$/;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {
    withFileTypes: true,
  })) {
    if (
      entry.isSymbolicLink() ||
      SKIP_DIRS.has(entry.name)
    ) {
      continue;
    }
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
    } else if (
      entry.isFile() &&
      TEST_FILE.test(entry.name)
    ) {
      fix(file);
    }
  }
}
function convertTitle(title) {
  // Decode escaped apostrophes and escape double quotes
  // before placing the title inside double quotes.
  return title
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/"/g, '\\"');
}
function fix(file) {
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split('\n');
  let changed = 0;
  const updated = lines.map((line) => {
    const match = line.match(TEST_TITLE);
    if (!match) {
      return line;
    }
    const title = match[2];
    // Avoid changing titles with template interpolation or
    // unusual escaping; review those cases manually.
    if (title.includes('${')) {
      return line;
    }
    changed++;
    return `${match[1]}"${convertTitle(title)}"${match[3]}`;
  });
  if (changed === 0) {
    return;
  }
  const backup = `${file}.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(file, backup);
  }
  fs.writeFileSync(file, updated.join('\n'), 'utf8');
  console.log(`${file}: ${changed} title(s) updated`);
}
walk(ROOT);