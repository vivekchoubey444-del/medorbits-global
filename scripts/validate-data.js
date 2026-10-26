
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, process.argv[2] || 'assets/data');

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage'
]);

const errors = [];
const warnings = [];
const files = [];

function isInsideRoot(targetPath) {
  const relative = path.relative(ROOT, targetPath);
  return relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative));
}

function collectJsonFiles(directory) {
  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(
      `${path.relative(ROOT, directory) || '.'}: unable to read directory: ${error.message}`
    );
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    // Do not follow symbolic links.
    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        collectJsonFiles(fullPath);
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }
}

function findRecordArrays(data) {
  const arrays = [];

  function visit(value, location = '$', depth = 0) {
    if (depth > 50 || value === null || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      const containsRecords = value.some(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          !Array.isArray(item)
      );

      if (containsRecords) {
        arrays.push({ records: value, location });
      }

      // Continue checking nested arrays and objects.
      value.forEach((item, index) => {
        if (item !== null && typeof item === 'object') {
          visit(item, `${location}[${index}]`, depth + 1);
        }
      });

      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (child !== null && typeof child === 'object') {
        visit(child, `${location}.${key}`, depth + 1);
      }
    }
  }

  visit(data);
  return arrays;
}

function validateIds(data, relativeFile) {
  for (const { records, location } of findRecordArrays(data)) {
    const seen = new Map();

    records.forEach((record, index) => {
      if (
        record === null ||
        typeof record !== 'object' ||
        Array.isArray(record) ||
        !Object.prototype.hasOwnProperty.call(record, 'id')
      ) {
        return;
      }

      const id = record.id;
      const recordLocation = `${relativeFile}:${location}[${index}]`;

      if (
        id === null ||
        id === undefined ||
        (typeof id === 'string' && id.trim() === '')
      ) {
        errors.push(`${recordLocation}: id must not be empty`);
        return;
      }

      if (!['string', 'number'].includes(typeof id)) {
        errors.push(`${recordLocation}: id must be a string or number`);
        return;
      }

      const normalizedId = `${typeof id}:${String(id)}`;

      if (seen.has(normalizedId)) {
        errors.push(
          `${recordLocation}: duplicate id ${JSON.stringify(id)}; first used at ${seen.get(normalizedId)}`
        );
      } else {
        seen.set(normalizedId, recordLocation);
      }
    });
  }
}

function main() {
  if (!isInsideRoot(DATA_DIR)) {
    console.error('Error: data directory must be inside the repository root.');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(DATA_DIR)) {
    console.error(
      `Error: data directory does not exist: ${path.relative(ROOT, DATA_DIR)}`
    );
    process.exitCode = 1;
    return;
  }

  let stat;

  try {
    stat = fs.statSync(DATA_DIR);
  } catch (error) {
    console.error(`Error: cannot access data directory: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (!stat.isDirectory()) {
    console.error('Error: configured data path is not a directory.');
    process.exitCode = 1;
    return;
  }

  collectJsonFiles(DATA_DIR);

  files.sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    warnings.push(
      `No JSON files found in ${path.relative(ROOT, DATA_DIR) || '.'}`
    );
  }

  for (const file of files) {
    const relativeFile = path.relative(ROOT, file);
    let data;

    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push(`${relativeFile}: invalid JSON: ${error.message}`);
      continue;
    }

    validateIds(data, relativeFile);
  }

  for (const warning of warnings) {
    console.warn(`WARNING: ${warning}`);
  }

  if (errors.length > 0) {
    console.error(`\nData validation failed: ${errors.length} error(s).`);

    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }

    console.error(
      `\nChecked ${files.length} JSON file(s) in ${path.relative(ROOT, DATA_DIR) || '.'}.`
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${files.length} JSON file(s) in ${path.relative(ROOT, DATA_DIR) || '.'}.`
  );

  console.log('JSON syntax and record ID checks passed.');
}

main();
