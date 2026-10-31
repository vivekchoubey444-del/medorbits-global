
#!/usr/bin/env node

/**
 * =============================================================================
 * MEDORBITS -- YAML VALIDATOR
 *
 * File: tools/validate-yaml.js
 * Version: 2.0.0
 *
 * Requirements:
 *   - Node.js >= 22
 *   - yaml package
 *
 * Install:
 *   npm install --save-dev yaml
 *
 * Usage:
 *   node tools/validate-yaml.js
 *   node tools/validate-yaml.js .github/workflows
 *   node tools/validate-yaml.js .github/workflows/ci.yml
 *   node tools/validate-yaml.js tools .github/workflows
 *
 * Features:
 *   - Native ES module compatibility.
 *   - Multiple YAML document validation.
 *   - Duplicate key detection.
 *   - Recursive directory scanning.
 *   - Symbolic-link protection.
 *   - Duplicate scan target elimination.
 *   - Parser warning reporting.
 *   - File-size protection.
 *   - Detailed validation summary.
 *
 * Exit codes:
 *   0 = all checked YAML files are valid
 *   1 = YAML validation failures
 *   2 = setup or runtime failure
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);

const ROOT = path.resolve(SCRIPT_DIR, '..');

const SCRIPT_VERSION = '2.0.0';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
  '.next',
  '.cache',
  '.turbo',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache'
]);

const YAML_EXTENSIONS = new Set([
  '.yaml',
  '.yml'
]);

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

function print(message = '') {
  process.stdout.write(`${message}\n`);
}

function info(message) {
  print(`[INFO] ${message}`);
}

function pass(message) {
  print(`[PASS] ${message}`);
}

function warn(message) {
  print(`[WARN] ${message}`);
}

function fail(message) {
  print(`[FAIL] ${message}`);
}

function fatal(message) {
  process.stderr.write(`[FATAL] ${message}\n`);
  process.exitCode = 2;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function showHelp() {
  print(`
MedOrbits YAML Validator v${SCRIPT_VERSION}

Usage:
  node tools/validate-yaml.js [paths...]

Examples:
  node tools/validate-yaml.js
  node tools/validate-yaml.js .github/workflows
  node tools/validate-yaml.js .github/workflows/ci.yml
  node tools/validate-yaml.js tools .github/workflows

Options:
  --help, -h       Display help.
  --version        Display version.

Validation:
  - YAML syntax
  - Multiple YAML documents
  - Duplicate mapping keys
  - Parser warnings
  - File encoding
  - File size limits

Safety:
  - Read-only operation.
  - No automatic formatting.
  - No file modification.
  - No symbolic-link traversal.
  - No dependency installation.
`);
}

// -----------------------------------------------------------------------------
// Path handling
// -----------------------------------------------------------------------------

function isYamlFile(filePath) {
  return YAML_EXTENSIONS.has(
    path.extname(filePath).toLowerCase()
  );
}

function getRelativePath(filePath) {
  return path.relative(ROOT, filePath) || '.';
}

function collectYamlFiles(target) {
  let stat;

  try {
    stat = fs.lstatSync(target);
  } catch {
    throw new Error(`Path does not exist or cannot be accessed: ${target}`);
  }

  if (stat.isSymbolicLink()) {
    throw new Error(`Symbolic links are not accepted: ${target}`);
  }

  if (stat.isFile()) {
    if (!isYamlFile(target)) {
      throw new Error(`Not a YAML file: ${target}`);
    }

    return [fs.realpathSync(target)];
  }

  if (!stat.isDirectory()) {
    throw new Error(`Unsupported filesystem entry: ${target}`);
  }

  const files = [];

  let entries;

  try {
    entries = fs.readdirSync(target, {
      withFileTypes: true
    });
  } catch (error) {
    throw new Error(
      `Cannot read directory ${target}: ${error.message}`
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(target, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }

      files.push(...collectYamlFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      isYamlFile(entry.name)
    ) {
      files.push(fs.realpathSync(fullPath));
    }
  }

  return files;
}

// -----------------------------------------------------------------------------
// Parser error formatting
// -----------------------------------------------------------------------------

function formatParserError(error) {
  const message = error?.message || String(error);

  const position = error?.linePos?.[0];

  if (position?.line && position?.col) {
    return `${message} (line ${position.line}, column ${position.col})`;
  }

  return message;
}

// -----------------------------------------------------------------------------
// YAML validation
// -----------------------------------------------------------------------------

async function validateYamlFile(YAML, file) {
  const relativePath = getRelativePath(file);

  try {
    const stat = fs.statSync(file);

    if (stat.size > MAX_FILE_SIZE) {
      return {
        file: relativePath,
        status: 'skipped',
        errors: [],
        warnings: [
          `File exceeds maximum size of ${MAX_FILE_SIZE} bytes.`
        ],
        documents: 0
      };
    }

    const source = fs.readFileSync(file, 'utf8');

    if (source.includes('\u0000')) {
      throw new Error('File contains NUL characters.');
    }

    if (source.trim() === '') {
      throw new Error('YAML file is empty.');
    }

    const documents = YAML.parseAllDocuments(source, {
      uniqueKeys: true,
      prettyErrors: true,
      strict: true,
      version: '1.2'
    });

    const errors = [];
    const warnings = [];

    for (let index = 0; index < documents.length; index++) {
      const document = documents[index];

      for (const error of document.errors) {
        errors.push(
          `Document ${index + 1}: ${formatParserError(error)}`
        );
      }

      for (const warning of document.warnings) {
        warnings.push(
          `Document ${index + 1}: ${formatParserError(warning)}`
        );
      }
    }

    return {
      file: relativePath,
      status: errors.length > 0 ? 'failed' : 'passed',
      errors,
      warnings,
      documents: documents.length
    };

  } catch (error) {
    return {
      file: relativePath,
      status: 'failed',
      errors: [formatParserError(error)],
      warnings: [],
      documents: 0
    };
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--version')) {
    print(`${SCRIPT_VERSION}`);
    return;
  }

  const targets = args.filter(
    argument => !argument.startsWith('--')
  );

  let YAML;

  try {
    const yamlModule = await import('yaml');

    YAML = yamlModule.default ?? yamlModule;

    if (typeof YAML.parseAllDocuments !== 'function') {
      throw new Error('Installed yaml package lacks parseAllDocuments().');
    }

  } catch (error) {
    fatal(
      `Unable to load the YAML parser. Install it with: npm install --save-dev yaml. Details: ${error.message}`
    );
    return;
  }

  const inputs = targets.length > 0
    ? targets
    : [ROOT];

  const files = [];

  try {
    for (const input of inputs) {
      const absolutePath = path.resolve(ROOT, input);

      files.push(...collectYamlFiles(absolutePath));
    }

  } catch (error) {
    fatal(error.message);
    return;
  }

  const uniqueFiles = [...new Set(files)].sort();

  if (uniqueFiles.length === 0) {
    warn('No YAML files found.');
    return;
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let warningCount = 0;
  let documentCount = 0;

  print('');
  info(`MedOrbits YAML Validator v${SCRIPT_VERSION}`);
  info(`Repository root: ${ROOT}`);
  info(`Files discovered: ${uniqueFiles.length}`);
  print('');

  for (const file of uniqueFiles) {
    const result = await validateYamlFile(YAML, file);

    documentCount += result.documents;
    warningCount += result.warnings.length;

    if (result.status === 'passed') {
      passed++;

      pass(result.file);

    } else if (result.status === 'skipped') {
      skipped++;

      warn(`${result.file}: skipped`);

    } else {
      failed++;

      fail(result.file);

      for (const message of result.errors) {
        print(`     ERROR: ${message}`);
      }
    }

    for (const message of result.warnings) {
      warn(`${result.file}: ${message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  print('');
  print('============================================================');
  print(' MEDORBITS YAML VALIDATION SUMMARY');
  print('============================================================');

  print(`Files discovered: ${uniqueFiles.length}`);
  print(`Files passed:     ${passed}`);
  print(`Files failed:     ${failed}`);
  print(`Files skipped:    ${skipped}`);
  print(`Documents parsed: ${documentCount}`);
  print(`Warnings:         ${warningCount}`);

  print('============================================================');

  if (failed > 0) {
    fail('YAML validation failed. Correct the reported errors.');
    process.exitCode = 1;
    return;
  }

  if (skipped > 0) {
    warn('Some files were skipped. Review the scan limitations.');
  }

  if (warningCount > 0) {
    warn('YAML parsing completed with warnings.');
  }

  pass('All checked YAML files passed syntax validation.');
  process.exitCode = 0;
}

// -----------------------------------------------------------------------------
// Runtime error handling
// -----------------------------------------------------------------------------

main().catch(error => {
  fatal(error.stack || error.message || String(error));
});
