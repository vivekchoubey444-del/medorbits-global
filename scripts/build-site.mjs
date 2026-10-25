
'use strict';

/**
 * MedOrbits -- Site Build and Integrity Checker
 *
 * File: scripts/build-site.mjs
 * Runtime: Node.js >= 20
 *
 * Purpose:
 * - Validate the expected public website structure.
 * - Parse JSON data files.
 * - Validate JSON files against available JSON Schema files when Ajv is installed.
 * - Check local asset references in HTML documents.
 * - Detect missing local pages, scripts, stylesheets and images.
 * - Validate basic HTML document structure.
 * - Produce a deterministic build report.
 *
 * Usage:
 *   node scripts/build-site.mjs
 *   node scripts/build-site.mjs --strict
 *   node scripts/build-site.mjs --root .
 *   node scripts/build-site.mjs --no-schema-validation
 *
 * Optional dependencies:
 *   npm install --save-dev ajv ajv-formats
 *
 * Notes:
 * - This script is a build-time integrity checker, not a security scanner.
 * - It does not execute website JavaScript or make network requests.
 * - It does not overwrite source files.
 * - Configure the paths below to match the actual repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, '..');

const CONFIG = Object.freeze({
  publicDirectory: 'public',
  fallbackPublicDirectories: ['dist', ''],
  dataDirectory: 'data',
  schemasDirectory: 'schemas',
  apiSchemasDirectory: path.join('api', 'schemas'),
  reportsDirectory: 'reports',

  requiredFiles: [
    'package.json',
  ],

  requiredDirectories: [
    'scripts',
  ],

  expectedDataFiles: [
    'countries.json',
    'courses.json',
    'colleges.json',
    'universities.json',
    'scholarships.json',
    'hostels.json',
    'fees.json',
    'admission-process.json',
    'entrance-exams.json',
    'documents.json',
    'career-options.json',
    'jobs.json',
    'faqs.json',
    'news.json',
    'notifications.json',
    'testimonials.json',
    'services.json',
  ],

  supportedHtmlExtensions: new Set(['.html', '.htm']),
  supportedDataExtensions: new Set(['.json']),
  ignoredDirectoryNames: new Set([
    '.git',
    '.github',
    '.next',
    '.nuxt',
    '.output',
    '.turbo',
    'coverage',
    'node_modules',
    'vendor',
    '.vercel',
    '.netlify',
  ]),

  maxReportedIssues: 100,
});

const EXIT_CODES = Object.freeze({
  success: 0,
  buildFailure: 1,
  configurationError: 2,
});

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    strict: false,
    schemaValidation: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--no-schema-validation') {
      options.schemaValidation = false;
      continue;
    }

    if (arg === '--root') {
      const value = argv[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error('--root requires a directory path.');
      }

      options.root = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    if (arg.startsWith('--root=')) {
      const value = arg.slice('--root='.length);

      if (!value) {
        throw new Error('--root requires a directory path.');
      }

      options.root = path.resolve(process.cwd(), value);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`
MedOrbits Site Build and Integrity Checker

Usage:
  node scripts/build-site.mjs [options]

Options:
  --root <path>              Project root directory
  --strict                   Treat warnings as build failures
  --no-schema-validation     Skip Ajv schema validation
  --help, -h                 Show this help

Examples:
  node scripts/build-site.mjs
  node scripts/build-site.mjs --strict
  node scripts/build-site.mjs --root .
`);
}

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function walkFiles(directory, options = {}) {
  const {
    ignoredDirectories = CONFIG.ignoredDirectoryNames,
  } = options;

  if (!isDirectory(directory)) {
    return [];
  }

  const results = [];

  let entries;

  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Cannot read directory "${directory}": ${error.message}`,
    );
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      results.push(...walkFiles(fullPath, options));
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function addIssue(report, level, code, file, message) {
  report.totalIssues += 1;

  if (level === 'error') {
    report.errors += 1;
  } else {
    report.warnings += 1;
  }

  if (report.issues.length < CONFIG.maxReportedIssues) {
    report.issues.push({
      level,
      code,
      file: file || '(project)',
      message,
    });
  }
}

function readJsonFile(filePath, report, root, codePrefix = 'JSON') {
  let raw;

  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    addIssue(
      report,
      'error',
      `${codePrefix}_READ`,
      relative(root, filePath),
      `Unable to read file: ${error.message}`,
    );

    return null;
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    addIssue(
      report,
      'error',
      `${codePrefix}_PARSE`,
      relative(root, filePath),
      `Invalid JSON: ${error.message}`,
    );

    return null;
  }
}

function resolvePublicDirectory(root) {
  for (const candidate of CONFIG.fallbackPublicDirectories) {
    const fullPath = candidate
      ? path.join(root, candidate)
      : root;

    if (!isDirectory(fullPath)) {
      continue;
    }

    const hasHtml = walkFiles(fullPath).some((file) =>
      CONFIG.supportedHtmlExtensions.has(path.extname(file).toLowerCase()),
    );

    if (hasHtml) {
      return fullPath;
    }
  }

  return null;
}

function checkRequiredPaths(root, report) {
  for (const file of CONFIG.requiredFiles) {
    const fullPath = path.join(root, file);

    if (!isFile(fullPath)) {
      addIssue(
        report,
        'error',
        'REQUIRED_FILE_MISSING',
        file,
        'Required project file was not found.',
      );
    }
  }

  for (const directory of CONFIG.requiredDirectories) {
    const fullPath = path.join(root, directory);

    if (!isDirectory(fullPath)) {
      addIssue(
        report,
        'error',
        'REQUIRED_DIRECTORY_MISSING',
        directory,
        'Required project directory was not found.',
      );
    }
  }
}

function checkPackageJson(root, report) {
  const packagePath = path.join(root, 'package.json');

  if (!isFile(packagePath)) {
    return;
  }

  const packageJson = readJsonFile(
    packagePath,
    report,
    root,
    'PACKAGE_JSON',
  );

  if (!packageJson) {
    return;
  }

  if (
    typeof packageJson.name !== 'string' ||
    packageJson.name.trim() === ''
  ) {
    addIssue(
      report,
      'warning',
      'PACKAGE_NAME_MISSING',
      'package.json',
      'The package name is missing or empty.',
    );
  }

  const nodeRequirement = packageJson.engines?.node;

  if (typeof nodeRequirement === 'string') {
    report.nodeRequirement = nodeRequirement;

    if (process.versions.node) {
      const currentMajor = Number(process.versions.node.split('.')[0]);

      if (currentMajor < 20) {
        addIssue(
          report,
          'error',
          'NODE_VERSION_UNSUPPORTED',
          'package.json',
          `Node.js >= 20 is required by this build script; current version is ${process.versions.node}.`,
        );
      }
    }
  }

  if (
    packageJson.type !== undefined &&
    !['module', 'commonjs'].includes(packageJson.type)
  ) {
    addIssue(
      report,
      'warning',
      'PACKAGE_TYPE_UNUSUAL',
      'package.json',
      `Unrecognized package type "${String(packageJson.type)}".`,
    );
  }
}

function collectSchemaFiles(root) {
  const directories = [
    path.join(root, CONFIG.schemasDirectory),
    path.join(root, CONFIG.apiSchemasDirectory),
  ];

  const files = [];

  for (const directory of directories) {
    if (!isDirectory(directory)) {
      continue;
    }

    for (const file of walkFiles(directory)) {
      if (path.extname(file).toLowerCase() === '.json') {
        files.push(file);
      }
    }
  }

  return [...new Set(files)].sort();
}

function schemaId(schema, filePath) {
  if (schema && typeof schema.$id === 'string' && schema.$id.trim()) {
    return schema.$id;
  }

  return pathToFileURL(filePath).href;
}

async function loadAjv() {
  try {
    const ajvModule = await import('ajv/dist/2020.js');
    const Ajv2020 = ajvModule.default;

    let addFormats = null;

    try {
      const formatsModule = await import('ajv-formats');
      addFormats = formatsModule.default;
    } catch {
      // ajv-formats is optional. Standard JSON Schema validation remains
      // available, but format checks may not be enforced by Ajv.
    }

    return { Ajv2020, addFormats };
  } catch {
    return null;
  }
}

async function validateJsonSchemas(root, report, options) {
  if (!options.schemaValidation) {
    report.schemaValidation = 'skipped by command-line option';
    return;
  }

  const schemaFiles = collectSchemaFiles(root);

  if (schemaFiles.length === 0) {
    report.schemaValidation = 'no schema files found';

    addIssue(
      report,
      'warning',
      'SCHEMA_DIRECTORY_EMPTY',
      CONFIG.schemasDirectory,
      'No JSON Schema files were found; JSON syntax will still be checked.',
    );

    return;
  }

  const ajvDependencies = await loadAjv();

  if (!ajvDependencies) {
    report.schemaValidation = 'skipped because Ajv is not installed';

    addIssue(
      report,
      'warning',
      'AJV_NOT_INSTALLED',
      'package.json',
      'Install ajv and ajv-formats to enable automatic JSON Schema validation.',
    );

    return;
  }

  const { Ajv2020, addFormats } = ajvDependencies;

  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateSchema: true,
    allowUnionTypes: true,
    loadSchema: undefined,
  });

  if (addFormats) {
    addFormats(ajv);
  }

  const schemas = [];
  const seenIds = new Map();

  for (const filePath of schemaFiles) {
    const schema = readJsonFile(filePath, report, root, 'SCHEMA');

    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      if (schema !== null) {
        addIssue(
          report,
          'error',
          'SCHEMA_NOT_OBJECT',
          relative(root, filePath),
          'A JSON Schema must be a JSON object.',
        );
      }

      continue;
    }

    const id = schemaId(schema, filePath);

    if (seenIds.has(id)) {
      addIssue(
        report,
        'error',
        'SCHEMA_DUPLICATE_ID',
        relative(root, filePath),
        `Duplicate schema identifier "${id}" also appears in ${relative(root, seenIds.get(id))}.`,
      );

      continue;
    }

    seenIds.set(id, filePath);
    schemas.push({ filePath, schema, id });
  }

  for (const item of schemas) {
    try {
      ajv.addSchema(item.schema, item.id);
    } catch (error) {
      addIssue(
        report,
        'error',
        'SCHEMA_REGISTER_FAILED',
        relative(root, item.filePath),
        error.message,
      );
    }
  }

  report.schemaCount = schemas.length;
  report.schemaValidation = 'enabled';

  const schemaDirectories = [
    path.join(root, CONFIG.schemasDirectory),
    path.join(root, CONFIG.apiSchemasDirectory),
  ].filter(isDirectory);

  const candidateDataFiles = [];

  for (const directory of schemaDirectories) {
    for (const filePath of walkFiles(directory)) {
      if (path.extname(filePath).toLowerCase() !== '.json') {
        continue;
      }

      // Schema documents are definitions, not instance data.
      const isSchemaDirectory = path.basename(path.dirname(filePath)) ===
        CONFIG.schemasDirectory ||
        relative(root, filePath).startsWith(`${CONFIG.schemasDirectory}/`) ||
        relative(root, filePath).startsWith(`${CONFIG.apiSchemasDirectory}/`);

      if (isSchemaDirectory) {
        continue;
      }

      candidateDataFiles.push(filePath);
    }
  }

  const dataDirectory = path.join(root, CONFIG.dataDirectory);

  if (isDirectory(dataDirectory)) {
    candidateDataFiles.push(
      ...walkFiles(dataDirectory).filter((filePath) =>
        path.extname(filePath).toLowerCase() === '.json',
      ),
    );
  }

  const publicDirectory = resolvePublicDirectory(root);

  if (publicDirectory) {
    candidateDataFiles.push(
      ...walkFiles(publicDirectory).filter((filePath) =>
        path.extname(filePath).toLowerCase() === '.json',
      ),
    );
  }

  const uniqueDataFiles = [...new Set(candidateDataFiles)].sort();

  for (const filePath of uniqueDataFiles) {
    const instance = readJsonFile(filePath, report, root, 'DATA_JSON');

    if (instance === null) {
      continue;
    }

    const basename = path.basename(filePath);
    const matchingSchema = schemas.find((item) => {
      const schemaBasename = path.basename(item.filePath);

      return schemaBasename === basename.replace(/\.fixture\.json$/i, '.schema.json') ||
        schemaBasename === basename.replace(/\.json$/i, '.schema.json') ||
        schemaBasename === `${basename.replace(/\.json$/i, '')}.schema.json`;
    });

    if (!matchingSchema) {
      continue;
    }

    const validate = ajv.getSchema(matchingSchema.id);

    if (!validate) {
      addIssue(
        report,
        'warning',
        'SCHEMA_NOT_COMPILED',
        relative(root, matchingSchema.filePath),
        'Schema could not be resolved for validation.',
      );

      continue;
    }

    const valid = validate(instance);

    if (!valid) {
      const details = (validate.errors || [])
        .slice(0, 8)
        .map((error) => {
          const location = error.instancePath || '/';
          return `${location}: ${error.message || 'validation failed'}`;
        })
        .join('; ');

      addIssue(
        report,
        'error',
        'DATA_SCHEMA_INVALID',
        relative(root, filePath),
        `Schema validation failed against ${relative(root, matchingSchema.filePath)}: ${details}`,
      );
    }
  }
}

function checkExpectedDataFiles(root, report) {
  const dataDirectory = path.join(root, CONFIG.dataDirectory);

  if (!isDirectory(dataDirectory)) {
    addIssue(
      report,
      'warning',
      'DATA_DIRECTORY_MISSING',
      CONFIG.dataDirectory,
      'The conventional data directory was not found. Update CONFIG if your JSON data lives elsewhere.',
    );

    return;
  }

  for (const filename of CONFIG.expectedDataFiles) {
    const filePath = path.join(dataDirectory, filename);

    if (!isFile(filePath)) {
      addIssue(
        report,
        'warning',
        'EXPECTED_DATA_FILE_MISSING',
        relative(root, filePath),
        'Expected data file was not found. Remove it from CONFIG if it is not part of this deployment.',
      );
    }
  }
}

function getAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const pattern = new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );

  const match = tag.match(pattern);

  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : null;
}

function isExternalOrSpecialReference(reference) {
  const value = reference.trim();

  return (
    value === '' ||
    value.startsWith('#') ||
    value.startsWith('//') ||
    /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|about:|sms:)/i.test(value)
  );
}

function stripQueryAndHash(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function decodePathSafely(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveLocalReference(reference, htmlFile, publicDirectory) {
  const cleaned = decodePathSafely(stripQueryAndHash(reference.trim()));

  if (!cleaned) {
    return null;
  }

  let target;

  if (cleaned.startsWith('/')) {
    target = path.resolve(publicDirectory, `.${cleaned}`);
  } else {
    target = path.resolve(path.dirname(htmlFile), cleaned);
  }

  const root = path.resolve(publicDirectory);
  const relativeTarget = path.relative(root, target);

  if (
    relativeTarget === '..' ||
    relativeTarget.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTarget)
  ) {
    return { outsideRoot: true, target };
  }

  return { outsideRoot: false, target };
}

function checkHtmlDocument(html, filePath, root, publicDirectory, report) {
  const relativeFile = relative(root, filePath);

  if (!/<!doctype\s+html/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_DOCTYPE_MISSING',
      relativeFile,
      'HTML document does not declare an HTML doctype.',
    );
  }

  if (!/<html(?:\s|>)/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_ROOT_MISSING',
      relativeFile,
      'HTML root element was not found.',
    );
  }

  if (!/<head(?:\s|>)/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_HEAD_MISSING',
      relativeFile,
      'HTML head element was not found.',
    );
  }

  if (!/<body(?:\s|>)/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_BODY_MISSING',
      relativeFile,
      'HTML body element was not found.',
    );
  }

  if (!/<meta\b[^>]*\bcharset\s*=/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_CHARSET_MISSING',
      relativeFile,
      'Declare a character encoding, typically UTF-8.',
    );
  }

  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_VIEWPORT_MISSING',
      relativeFile,
      'Viewport meta tag was not found.',
    );
  }

  if (!/<title(?:\s|>)/i.test(html)) {
    addIssue(
      report,
      'warning',
      'HTML_TITLE_MISSING',
      relativeFile,
      'HTML title element was not found.',
    );
  }

  const attributePattern = /\b(src|href|poster|data-src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;

  while ((match = attributePattern.exec(html)) !== null) {
    const reference = match[2] ?? match[3] ?? match[4] ?? '';
    const attribute = match[1].toLowerCase();

    if (isExternalOrSpecialReference(reference)) {
      continue;
    }

    // Some HTML references use template expressions resolved by the server.
    if (reference.includes('{{') || reference.includes('${')) {
      continue;
    }

    const resolved = resolveLocalReference(
      reference,
      filePath,
      publicDirectory,
    );

    if (!resolved) {
      continue;
    }

    if (resolved.outsideRoot) {
      addIssue(
        report,
        'warning',
        'HTML_REFERENCE_OUTSIDE_ROOT',
        relativeFile,
        `${attribute} reference "${reference}" resolves outside the selected website directory.`,
      );

      continue;
    }

    if (isDirectory(resolved.target)) {
      const indexCandidates = [
        path.join(resolved.target, 'index.html'),
        path.join(resolved.target, 'index.htm'),
      ];

      if (!indexCandidates.some(isFile)) {
        addIssue(
          report,
          'warning',
          'HTML_DIRECTORY_INDEX_MISSING',
          relativeFile,
          `${attribute} reference "${reference}" points to a directory without an index.html or index.htm.`,
        );
      }

      continue;
    }

    if (!exists(resolved.target)) {
      addIssue(
        report,
        'error',
        'HTML_REFERENCE_MISSING',
        relativeFile,
        `${attribute} reference "${reference}" does not resolve to an existing local file.`,
      );
    }
  }

  // Check for common duplicate IDs within one document.
  const idPattern = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const seenIds = new Set();
  let idMatch;

  while ((idMatch = idPattern.exec(html)) !== null) {
    const id = (idMatch[1] ?? idMatch[2] ?? idMatch[3] ?? '').trim();

    if (!id) {
      continue;
    }

    if (seenIds.has(id)) {
      addIssue(
        report,
        'warning',
        'HTML_DUPLICATE_ID',
        relativeFile,
        `Duplicate HTML id "${id}" was found.`,
      );
    } else {
      seenIds.add(id);
    }
  }
}

function checkWebsite(root, report) {
  const publicDirectory = resolvePublicDirectory(root);

  if (!publicDirectory) {
    addIssue(
      report,
      'error',
      'WEBSITE_DIRECTORY_MISSING',
      CONFIG.publicDirectory,
      'No website directory containing HTML files was found. Expected public/, dist/, or HTML files at the project root.',
    );

    return;
  }

  report.websiteDirectory = relative(root, publicDirectory) || '.';

  const allFiles = walkFiles(publicDirectory);
  const htmlFiles = allFiles.filter((filePath) =>
    CONFIG.supportedHtmlExtensions.has(path.extname(filePath).toLowerCase()),
  );

  report.htmlFiles = htmlFiles.length;
  report.publicFiles = allFiles.length;

  if (htmlFiles.length === 0) {
    addIssue(
      report,
      'error',
      'HTML_FILES_MISSING',
      report.websiteDirectory,
      'No HTML files were found in the selected website directory.',
    );

    return;
  }

  for (const filePath of htmlFiles) {
    let html;

    try {
      html = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      addIssue(
        report,
        'error',
        'HTML_READ_FAILED',
        relative(root, filePath),
        error.message,
      );

      continue;
    }

    checkHtmlDocument(html, filePath, root, publicDirectory, report);
  }

  // Validate JSON syntax for JSON files shipped with the website.
  for (const filePath of allFiles) {
    if (path.extname(filePath).toLowerCase() !== '.json') {
      continue;
    }

    readJsonFile(filePath, report, root, 'PUBLIC_JSON');
  }
}

function checkJsonSyntax(root, report) {
  const dataDirectory = path.join(root, CONFIG.dataDirectory);

  if (!isDirectory(dataDirectory)) {
    return;
  }

  const jsonFiles = walkFiles(dataDirectory).filter((filePath) =>
    path.extname(filePath).toLowerCase() === '.json',
  );

  report.dataJsonFiles = jsonFiles.length;

  for (const filePath of jsonFiles) {
    readJsonFile(filePath, report, root, 'DATA_JSON');
  }
}

function printReport(report, options) {
  console.log('\nMedOrbits Site Build Report');
  console.log('='.repeat(30));
  console.log(`Project root:       ${report.root}`);
  console.log(`Node.js:            ${process.version}`);
  console.log(`Website directory:  ${report.websiteDirectory || 'not found'}`);
  console.log(`HTML files:         ${report.htmlFiles}`);
  console.log(`Website files:      ${report.publicFiles}`);
  console.log(`Data JSON files:    ${report.dataJsonFiles}`);
  console.log(`Schema files:       ${report.schemaCount}`);
  console.log(`Schema validation:  ${report.schemaValidation}`);
  console.log(`Errors:             ${report.errors}`);
  console.log(`Warnings:           ${report.warnings}`);

  if (report.issues.length > 0) {
    console.log('\nIssues');
    console.log('-'.repeat(30));

    for (const issue of report.issues) {
      const prefix = issue.level.toUpperCase().padEnd(7);

      console.log(`[${prefix}] ${issue.code} -- ${issue.file}`);
      console.log(`         ${issue.message}`);
    }

    if (report.totalIssues > report.issues.length) {
      console.log(
        `\n${report.totalIssues - report.issues.length} additional issue(s) omitted from the console report.`,
      );
    }
  }

  const failed = report.errors > 0 || (options.strict && report.warnings > 0);

  console.log('\nResult');
  console.log('-'.repeat(30));

  if (failed) {
    console.log('BUILD FAILED');
  } else if (report.warnings > 0) {
    console.log('BUILD COMPLETED WITH WARNINGS');
  } else {
    console.log('BUILD CHECKS PASSED');
  }
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Configuration error: ${error.message}`);
    console.error('Run with --help to see supported options.');
    process.exitCode = EXIT_CODES.configurationError;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!isDirectory(options.root)) {
    console.error(`Project root is not a directory: ${options.root}`);
    process.exitCode = EXIT_CODES.configurationError;
    return;
  }

  const report = {
    root: options.root,
    nodeRequirement: null,
    websiteDirectory: null,
    htmlFiles: 0,
    publicFiles: 0,
    dataJsonFiles: 0,
    schemaCount: 0,
    schemaValidation: 'not run',
    errors: 0,
    warnings: 0,
    totalIssues: 0,
    issues: [],
  };

  try {
    checkRequiredPaths(options.root, report);
    checkPackageJson(options.root, report);
    checkExpectedDataFiles(options.root, report);
    checkJsonSyntax(options.root, report);
    checkWebsite(options.root, report);

    await validateJsonSchemas(options.root, report, options);

    printReport(report, options);

    const failed =
      report.errors > 0 ||
      (options.strict && report.warnings > 0);

    process.exitCode = failed
      ? EXIT_CODES.buildFailure
      : EXIT_CODES.success;
  } catch (error) {
    console.error(`\nBuild checker failed unexpectedly: ${error.stack || error.message}`);
    process.exitCode = EXIT_CODES.buildFailure;
  }
}

main();
