#!/usr/bin/env node
'use strict';

/**
 * MedOrbits JSON Schema Validator
 * File: tools/validate-json-schema.js
 *
 * Usage:
 *   node tools/validate-json-schema.js
 *   node tools/validate-json-schema.js api/schemas
 *   node tools/validate-json-schema.js api/schemas/career.schema.json
 *
 * JSON syntax is always checked.
 * JSON Schema semantic checks require the "ajv" package.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  'vendor',
  '__pycache__',
  'dist',
  'build',
  'coverage',
  '.next'
]);

const JSON_EXTENSIONS = new Set(['.json']);

function collectFiles(target) {
  const stat = fs.statSync(target);

  if (stat.isFile()) {
    if (path.extname(target).toLowerCase() !== '.json') {
      throw new Error(`Not a JSON file: ${target}`);
    }

    return [target];
  }

  if (!stat.isDirectory()) return [];

  const results = [];

  for (const entry of fs.readdirSync(target, {
    withFileTypes: true
  })) {
    if (entry.isSymbolicLink()) continue;

    const fullPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        results.push(...collectFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      JSON_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

function parseJson(file) {
  const source = fs.readFileSync(file, 'utf8');

  if (!source.trim()) {
    throw new Error('File is empty');
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    const match = /position\s+(\d+)/i.exec(error.message);

    if (match) {
      const position = Number(match[1]);
      const beforeError = source.slice(0, position);
      const line = beforeError.split('\n').length;
      const lastNewline = beforeError.lastIndexOf('\n');
      const column = position - lastNewline;

      throw new Error(
        `${error.message} (line ${line}, column ${column})`
      );
    }

    throw error;
  }
}

function main() {
  const targets = process.argv.slice(2);
  const inputs = targets.length ? targets : [ROOT];
  const files = [];

  try {
    for (const input of inputs) {
      const absolute = path.resolve(ROOT, input);

      if (!fs.existsSync(absolute)) {
        throw new Error(`Path does not exist: ${input}`);
      }

      files.push(...collectFiles(absolute));
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (!uniqueFiles.length) {
    console.log('No JSON files found.');
    return;
  }

  let Ajv;

  try {
    Ajv = require('ajv');
  } catch {
    Ajv = null;
  }

  let ajv = null;

  if (Ajv) {
    try {
      ajv = new Ajv({
        allErrors: true,
        strict: false,
        validateSchema: true
      });
    } catch (error) {
      console.error(`ERROR initializing Ajv: ${error.message}`);
      process.exitCode = 2;
      return;
    }
  }

  const parsed = new Map();
  let passed = 0;
  let failed = 0;

  console.log(`Checking ${uniqueFiles.length} JSON file(s)...`);

  for (const file of uniqueFiles) {
    const relative = path.relative(ROOT, file);

    try {
      const data = parseJson(file);
      parsed.set(file, data);

      const filename = path.basename(file).toLowerCase();
      const isSchema =
        filename.includes('.schema.') ||
        filename.includes('.schema-') ||
        filename.endsWith('.schema.json');

      if (isSchema && ajv) {
        const valid = ajv.validateSchema(data);

        if (!valid) {
          const details = (ajv.errors || [])
            .map((item) => {
              const location = item.instancePath || '/';
              return `${location}: ${item.message}`;
            })
            .join('\n');

          throw new Error(
            `Invalid JSON Schema:\n${details || 'Unknown schema error'}`
          );
        }
      }

      passed++;
      console.log(`PASS ${relative}`);
    } catch (error) {
      failed++;
      console.error(`\nFAIL ${relative}`);
      console.error(error.message);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);

  if (!ajv) {
    console.log(
      'NOTE: JSON syntax was checked. JSON Schema semantic validation was skipped because Ajv is not installed.'
    );
  }

  if (failed > 0) {
    process.exitCode = 1;
  } else {
    console.log('All checked JSON files passed the enabled checks.');
  }
}

main();
