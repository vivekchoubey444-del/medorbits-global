
#!/usr/bin/env node
'use strict';

/**
 * MedOrbits -- Data Validation CLI
 *
 * File: scripts/validate-data.mjs
 *
 * Purpose:
 * - Validate project JSON data files and their structure.
 * - Validate JSON syntax, required fields, duplicate IDs, and common data errors.
 * - Validate known MedOrbits data collections using configurable rules.
 * - Optionally validate JSON files against JSON Schema files.
 * - Detect missing files, invalid references, malformed URLs, and suspicious values.
 * - Support CI-friendly exit codes, concise output, and JSON reports.
 *
 * Requirements:
 * - Node.js >= 20
 * - No third-party dependencies required for built-in validation.
 *
 * Optional JSON Schema validation:
 * - Install Ajv in the project if you want schema validation.
 * - The script attempts to load Ajv when schema validation is requested.
 *
 * Usage:
 *   node scripts/validate-data.mjs
 *   node scripts/validate-data.mjs --root .
 *   node scripts/validate-data.mjs --dir data
 *   node scripts/validate-data.mjs --dir assets/data
 *   node scripts/validate-data.mjs --file data/jobs.json
 *   node scripts/validate-data.mjs --schema-dir api/schemas
 *   node scripts/validate-data.mjs --strict
 *   node scripts/validate-data.mjs --report-json reports/data-validation.json
 *   node scripts/validate-data.mjs --quiet
 *   node scripts/validate-data.mjs --help
 *
 * Exit codes:
 *   0 = validation passed
 *   1 = validation errors found
 *   2 = invalid CLI arguments or execution failure
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SCRIPT_NAME = 'validate-data.mjs';
const DEFAULT_ROOT = process.cwd();

const DEFAULT_DATA_DIRS = [
  'data',
  'assets/data',
  'api/data',
  'public/data',
  'career/data',
];

const DEFAULT_SCHEMA_DIRS = [
  'api/schemas',
  'schemas',
];

const DATA_FILE_EXTENSIONS = new Set(['.json', '.jsonc']);

const KNOWN_COLLECTION_RULES = {
  jobs: {
    requiredAny: ['id', 'jobId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'jobTitle', 'name'],
    idFields: ['id', 'jobId', 'slug'],
    urlFields: ['url', 'applyUrl', 'applicationUrl', 'sourceUrl'],
    dateFields: [
      'createdAt',
      'updatedAt',
      'postedAt',
      'publishedAt',
      'applicationDeadline',
      'deadline',
      'expiresAt',
    ],
    arrayFields: ['skills', 'requirements', 'responsibilities', 'benefits', 'tags'],
  },

  internships: {
    requiredAny: ['id', 'internshipId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'name', 'internshipTitle'],
    idFields: ['id', 'internshipId', 'slug'],
    urlFields: ['url', 'applyUrl', 'applicationUrl'],
    dateFields: ['createdAt', 'updatedAt', 'postedAt', 'deadline', 'applicationDeadline'],
    arrayFields: ['skills', 'requirements', 'responsibilities', 'tags'],
  },

  apprenticeships: {
    requiredAny: ['id', 'apprenticeshipId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'name', 'apprenticeshipTitle'],
    idFields: ['id', 'apprenticeshipId', 'slug'],
    urlFields: ['url', 'applyUrl', 'applicationUrl'],
    dateFields: ['createdAt', 'updatedAt', 'postedAt', 'deadline', 'applicationDeadline'],
    arrayFields: ['skills', 'requirements', 'responsibilities', 'tags'],
  },

  colleges: {
    requiredAny: ['id', 'collegeId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'collegeName', 'title'],
    idFields: ['id', 'collegeId', 'slug'],
    urlFields: ['url', 'website', 'officialWebsite', 'admissionUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['courses', 'facilities', 'accreditations', 'tags'],
  },

  universities: {
    requiredAny: ['id', 'universityId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'universityName', 'title'],
    idFields: ['id', 'universityId', 'slug'],
    urlFields: ['url', 'website', 'officialWebsite', 'admissionUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['courses', 'faculties', 'accreditations', 'tags'],
  },

  courses: {
    requiredAny: ['id', 'courseId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'courseName', 'title'],
    idFields: ['id', 'courseId', 'slug'],
    urlFields: ['url', 'detailsUrl', 'applicationUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['eligibility', 'subjects', 'careerOptions', 'tags'],
  },

  scholarships: {
    requiredAny: ['id', 'scholarshipId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'title', 'scholarshipName'],
    idFields: ['id', 'scholarshipId', 'slug'],
    urlFields: ['url', 'officialUrl', 'applicationUrl'],
    dateFields: ['createdAt', 'updatedAt', 'deadline', 'applicationDeadline'],
    arrayFields: ['eligibility', 'benefits', 'requiredDocuments', 'tags'],
  },

  hostels: {
    requiredAny: ['id', 'hostelId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'title'],
    idFields: ['id', 'hostelId', 'slug'],
    urlFields: ['url', 'website', 'bookingUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['facilities', 'rules', 'amenities', 'tags'],
  },

  fees: {
    requiredAny: ['id', 'feeId', 'slug'],
    requiredFields: [],
    titleFields: ['name', 'title', 'courseName', 'collegeName'],
    idFields: ['id', 'feeId', 'slug'],
    urlFields: ['url', 'sourceUrl', 'officialUrl'],
    dateFields: ['createdAt', 'updatedAt', 'effectiveFrom', 'effectiveTo'],
    arrayFields: ['feeComponents', 'installments', 'tags'],
    numericFields: [
      'amount',
      'fee',
      'tuitionFee',
      'annualFee',
      'totalFee',
      'applicationFee',
      'hostelFee',
    ],
  },

  applications: {
    requiredAny: ['id', 'applicationId', 'reference'],
    requiredFields: [],
    titleFields: ['title', 'courseName', 'applicantName'],
    idFields: ['id', 'applicationId', 'reference'],
    urlFields: ['url', 'documentUrl'],
    dateFields: ['createdAt', 'updatedAt', 'submittedAt', 'deadline'],
    arrayFields: ['documents', 'attachments', 'courses'],
  },

  notifications: {
    requiredAny: ['id', 'notificationId', 'slug'],
    requiredFields: ['title', 'message'],
    titleFields: ['title'],
    idFields: ['id', 'notificationId', 'slug'],
    urlFields: ['url', 'actionUrl', 'targetUrl'],
    dateFields: ['createdAt', 'updatedAt', 'publishedAt', 'expiresAt'],
    arrayFields: ['tags'],
  },

  'live-notifications': {
    requiredAny: ['id', 'notificationId', 'slug'],
    requiredFields: ['title', 'message'],
    titleFields: ['title'],
    idFields: ['id', 'notificationId', 'slug'],
    urlFields: ['url', 'actionUrl', 'targetUrl'],
    dateFields: ['createdAt', 'updatedAt', 'publishedAt', 'expiresAt'],
    arrayFields: ['tags'],
  },

  testimonials: {
    requiredAny: ['id', 'testimonialId', 'slug'],
    requiredFields: ['content'],
    titleFields: ['name', 'author', 'title'],
    idFields: ['id', 'testimonialId', 'slug'],
    urlFields: [],
    dateFields: ['createdAt', 'updatedAt', 'publishedAt'],
    arrayFields: ['tags'],
  },

  services: {
    requiredAny: ['id', 'serviceId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'title'],
    idFields: ['id', 'serviceId', 'slug'],
    urlFields: ['url', 'href', 'detailsUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['features', 'benefits', 'tags'],
  },

  faqs: {
    requiredAny: ['id', 'faqId', 'slug', 'question'],
    requiredFields: ['question', 'answer'],
    titleFields: ['question'],
    idFields: ['id', 'faqId', 'slug', 'question'],
    urlFields: ['url', 'sourceUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['tags'],
  },

  countries: {
    requiredAny: ['id', 'code', 'isoCode', 'slug', 'name'],
    requiredFields: ['name'],
    titleFields: ['name', 'countryName', 'title'],
    idFields: ['id', 'code', 'isoCode', 'slug'],
    urlFields: ['url', 'officialWebsite'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['languages', 'currency', 'tags'],
  },

  documents: {
    requiredAny: ['id', 'documentId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'title'],
    idFields: ['id', 'documentId', 'slug'],
    urlFields: ['url', 'downloadUrl', 'templateUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['requirements', 'acceptedFormats', 'tags'],
  },

  'career-options': {
    requiredAny: ['id', 'careerId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'name'],
    idFields: ['id', 'careerId', 'slug'],
    urlFields: ['url', 'detailsUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['skills', 'qualifications', 'courses', 'tags'],
  },

  'entrance-exams': {
    requiredAny: ['id', 'examId', 'slug'],
    requiredFields: ['name'],
    titleFields: ['name', 'examName', 'title'],
    idFields: ['id', 'examId', 'slug'],
    urlFields: ['url', 'officialWebsite', 'applicationUrl'],
    dateFields: ['createdAt', 'updatedAt', 'registrationDeadline', 'examDate'],
    arrayFields: ['eligibility', 'subjects', 'requiredDocuments', 'tags'],
  },

  'admission-process': {
    requiredAny: ['id', 'processId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'name'],
    idFields: ['id', 'processId', 'slug'],
    urlFields: ['url', 'detailsUrl'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['steps', 'documents', 'requirements', 'tags'],
  },

  'career-guides': {
    requiredAny: ['id', 'guideId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'name'],
    idFields: ['id', 'guideId', 'slug'],
    urlFields: ['url', 'downloadUrl'],
    dateFields: ['createdAt', 'updatedAt', 'publishedAt'],
    arrayFields: ['sections', 'tags'],
  },

  news: {
    requiredAny: ['id', 'newsId', 'slug'],
    requiredFields: ['title'],
    titleFields: ['title', 'headline'],
    idFields: ['id', 'newsId', 'slug'],
    urlFields: ['url', 'sourceUrl', 'articleUrl'],
    dateFields: ['createdAt', 'updatedAt', 'publishedAt', 'date'],
    arrayFields: ['tags', 'categories'],
  },

  countries: {
    requiredAny: ['id', 'code', 'isoCode', 'slug', 'name'],
    requiredFields: ['name'],
    titleFields: ['name', 'countryName', 'title'],
    idFields: ['id', 'code', 'isoCode', 'slug'],
    urlFields: ['url', 'officialWebsite'],
    dateFields: ['createdAt', 'updatedAt'],
    arrayFields: ['languages', 'tags'],
  },
};

const KNOWN_ID_KEYS = [
  'id',
  'jobId',
  'internshipId',
  'apprenticeshipId',
  'collegeId',
  'universityId',
  'courseId',
  'scholarshipId',
  'notificationId',
  'applicationId',
  'serviceId',
  'documentId',
  'examId',
  'careerId',
  'faqId',
  'slug',
  'code',
];

const COMMON_URL_KEYS = [
  'url',
  'href',
  'website',
  'officialWebsite',
  'sourceUrl',
  'applyUrl',
  'applicationUrl',
  'admissionUrl',
  'downloadUrl',
  'documentUrl',
  'image',
  'imageUrl',
  'thumbnail',
  'thumbnailUrl',
  'logo',
  'logoUrl',
];

const COMMON_DATE_KEYS = [
  'createdAt',
  'updatedAt',
  'publishedAt',
  'postedAt',
  'deadline',
  'applicationDeadline',
  'expiresAt',
  'effectiveFrom',
  'effectiveTo',
  'examDate',
  'registrationDeadline',
];

const RESERVED_FILE_NAMES = new Set([
  'README.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
]);

function parseArgs(argv) {
  const options = {
    root: DEFAULT_ROOT,
    dirs: [],
    files: [],
    schemaDirs: [],
    schemaFiles: [],
    strict: false,
    recursive: true,
    validateSchemas: false,
    allowJsonc: false,
    checkReferences: false,
    checkExternalUrls: false,
    quiet: false,
    verbose: false,
    help: false,
    reportJson: null,
    failOnWarning: false,
    maxDepth: 30,
    ignore: [],
  };

  const valueOptions = new Set([
    '--root',
    '--dir',
    '--file',
    '--schema-dir',
    '--schema',
    '--report-json',
    '--max-depth',
    '--ignore',
  ]);

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

    if (arg === '--no-recursive') {
      options.recursive = false;
      continue;
    }

    if (arg === '--validate-schemas') {
      options.validateSchemas = true;
      continue;
    }

    if (arg === '--allow-jsonc') {
      options.allowJsonc = true;
      continue;
    }

    if (arg === '--check-references') {
      options.checkReferences = true;
      continue;
    }

    if (arg === '--check-external-urls') {
      options.checkExternalUrls = true;
      continue;
    }

    if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
      continue;
    }

    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
      continue;
    }

    if (arg === '--fail-on-warning') {
      options.failOnWarning = true;
      continue;
    }

    if (valueOptions.has(arg)) {
      const value = argv[index + 1];

      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${arg}.`);
      }

      index += 1;

      if (arg === '--root') {
        options.root = path.resolve(value);
      } else if (arg === '--dir') {
        options.dirs.push(value);
      } else if (arg === '--file') {
        options.files.push(value);
      } else if (arg === '--schema-dir') {
        options.schemaDirs.push(value);
      } else if (arg === '--schema') {
        options.schemaFiles.push(value);
        options.validateSchemas = true;
      } else if (arg === '--report-json') {
        options.reportJson = value;
      } else if (arg === '--max-depth') {
        const depth = Number(value);

        if (!Number.isInteger(depth) || depth < 1 || depth > 200) {
          throw new Error('--max-depth must be an integer between 1 and 200.');
        }

        options.maxDepth = depth;
      } else if (arg === '--ignore') {
        options.ignore.push(value);
      }

      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.dirs.length === 0 && options.files.length === 0) {
    options.dirs = [...DEFAULT_DATA_DIRS];
  }

  if (options.schemaDirs.length === 0) {
    options.schemaDirs = [...DEFAULT_SCHEMA_DIRS];
  }

  return options;
}

function printHelp() {
  console.log(`
${SCRIPT_NAME} -- MedOrbits JSON data validator

Usage:
  node scripts/validate-data.mjs [options]

Options:
  --root <path>            Project root (default: current directory)
  --dir <path>             Data directory to scan; may be repeated
  --file <path>            Validate a specific JSON file; may be repeated
  --schema-dir <path>      JSON Schema directory; may be repeated
  --schema <path>          Validate against a specific JSON Schema file
  --validate-schemas       Enable JSON Schema validation with Ajv
  --strict                 Treat warnings as errors
  --fail-on-warning        Exit with code 1 if warnings are found
  --check-references       Check local JSON references in known fields
  --check-external-urls    Warn about external URLs; does not fetch URLs
  --allow-jsonc            Permit .jsonc files (comments/trailing commas)
  --no-recursive           Do not recursively scan data directories
  --max-depth <number>     Maximum object traversal depth (default: 30)
  --ignore <pattern>       Ignore path substring or glob-like pattern
  --report-json <path>     Write machine-readable JSON report
  --quiet, -q              Only print errors and final summary
  --verbose, -v            Print each validated file
  --help, -h               Show this help

Examples:
  node scripts/validate-data.mjs
  node scripts/validate-data.mjs --dir assets/data --strict
  node scripts/validate-data.mjs --file career/data/jobs.json
  node scripts/validate-data.mjs --validate-schemas --schema-dir api/schemas
  node scripts/validate-data.mjs --check-references --report-json reports/data.json
`);
}

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function relativeToRoot(root, target) {
  return normalizeSlashes(path.relative(root, target)) || '.';
}

function matchesIgnore(relativePath, patterns) {
  const normalized = normalizeSlashes(relativePath);

  return patterns.some((pattern) => {
    const clean = normalizeSlashes(pattern).replaceAll('\\', '/');

    if (clean === normalized || normalized.includes(clean)) {
      return true;
    }

    const escaped = clean
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replaceAll('**', '.*')
      .replaceAll('*', '[^/]*')
      .replaceAll('?', '.');

    try {
      return new RegExp(`^${escaped}$`).test(normalized);
    } catch {
      return false;
    }
  });
}

function createReporter(options) {
  const results = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    root: options.root,
    filesScanned: 0,
    filesPassed: 0,
    filesFailed: 0,
    errors: [],
    warnings: [],
    infos: [],
  };

  function add(level, file, message, details = {}) {
    const item = {
      level,
      file: file || null,
      message,
      ...details,
    };

    if (level === 'error') {
      results.errors.push(item);
    } else if (level === 'warning') {
      results.warnings.push(item);
    } else {
      results.infos.push(item);
    }

    if (options.quiet && level !== 'error') {
      return;
    }

    const prefix = level.toUpperCase().padEnd(7);
    const location = file ? ` ${file}` : '';
    const detailText = details.line ? `:${details.line}` : '';

    console.log(`${prefix}${location}${detailText} -- ${message}`);
  }

  return {
    results,
    error: (file, message, details) => add('error', file, message, details),
    warning: (file, message, details) => add('warning', file, message, details),
    info: (file, message, details) => add('info', file, message, details),
  };
}

function readJsonFile(filePath, allowJsonc = false) {
  const source = fs.readFileSync(filePath, 'utf8');
  let text = source.replace(/^\uFEFF/, '');

  if (path.extname(filePath).toLowerCase() === '.jsonc') {
    if (!allowJsonc) {
      throw new Error('JSONC file encountered. Use --allow-jsonc to enable JSONC parsing.');
    }

    text = stripJsonComments(text);
    text = stripTrailingCommas(text);
  }

  try {
    return {
      value: JSON.parse(text),
      source,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON: ${message}`);
  }
}

function stripJsonComments(input) {
  let output = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        output += char;
      } else {
        output += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        output += '  ';
        index += 1;
        inBlockComment = false;
      } else {
        output += char === '\n' || char === '\r' ? char : ' ';
      }
      continue;
    }

    if (inString) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === '/' && next === '/') {
      output += '  ';
      index += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      output += '  ';
      index += 1;
      inBlockComment = true;
      continue;
    }

    output += char;
  }

  return output;
}

function stripTrailingCommas(input) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ',') {
      let lookahead = index + 1;

      while (lookahead < input.length && /\s/.test(input[lookahead])) {
        lookahead += 1;
      }

      if (input[lookahead] === '}' || input[lookahead] === ']') {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function collectJsonFiles(startPath, options, reporter, root) {
  const absolute = path.resolve(root, startPath);
  const files = [];

  if (!isInside(root, absolute)) {
    reporter.error(relativeToRoot(root, absolute), 'Path resolves outside the configured project root.');
    return files;
  }

  if (!fs.existsSync(absolute)) {
    reporter.warning(relativeToRoot(root, absolute), 'Configured path does not exist; skipped.');
    return files;
  }

  let stat;

  try {
    stat = fs.statSync(absolute);
  } catch (error) {
    reporter.error(relativeToRoot(root, absolute), `Unable to inspect path: ${error.message}`);
    return files;
  }

  if (stat.isFile()) {
    if (DATA_FILE_EXTENSIONS.has(path.extname(absolute).toLowerCase())) {
      files.push(absolute);
    } else {
      reporter.warning(relativeToRoot(root, absolute), 'Specified file is not a .json or .jsonc file.');
    }

    return files;
  }

  if (!stat.isDirectory()) {
    reporter.warning(relativeToRoot(root, absolute), 'Path is neither a file nor a directory.');
    return files;
  }

  function walk(directory, depth) {
    if (depth > options.maxDepth) {
      reporter.warning(relativeToRoot(root, directory), `Maximum scan depth (${options.maxDepth}) reached.`);
      return;
    }

    let entries;

    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      reporter.error(relativeToRoot(root, directory), `Unable to read directory: ${error.message}`);
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.next' || entry.name === 'dist') {
        continue;
      }

      const target = path.join(directory, entry.name);
      const relative = relativeToRoot(root, target);

      if (matchesIgnore(relative, options.ignore)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        reporter.warning(relative, 'Symbolic link skipped for safety.');
        continue;
      }

      if (entry.isDirectory()) {
        if (options.recursive) {
          walk(target, depth + 1);
        }
        continue;
      }

      if (entry.isFile() && DATA_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        if (RESERVED_FILE_NAMES.has(entry.name)) {
          continue;
        }

        files.push(target);
      }
    }
  }

  walk(absolute, 0);
  return files;
}

function getCollectionName(filePath) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();

  return base
    .replace(/\.schema$/, '')
    .replace(/\.data$/, '')
    .replace(/[-_]v\d+$/, '');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getRecordId(record, fields = KNOWN_ID_KEYS) {
  for (const field of fields) {
    if (isNonEmptyString(record[field]) || typeof record[field] === 'number') {
      return String(record[field]).trim();
    }
  }

  return null;
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPotentialUrlField(key) {
  return /(?:url|uri|href|website|link)$/i.test(key)
    || /^(?:image|logo|thumbnail|avatar|banner|icon)$/i.test(key);
}

function isPotentialDateField(key) {
  return /(?:date|deadline|expiresAt|createdAt|updatedAt|publishedAt|postedAt|effectiveFrom|effectiveTo)$/i.test(key);
}

function inspectValueTree(value, context, depth = 0, seen = new WeakSet()) {
  const { file, reporter, options } = context;

  if (depth > options.maxDepth) {
    reporter.warning(file, `Object traversal limit reached at depth ${options.maxDepth}.`);
    return;
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      reporter.error(file, 'Circular reference detected in parsed data.');
      return;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        inspectValueTree(item, context, depth + 1, seenWithParent(seen, value));
        if (options.verbose && item === undefined) {
          reporter.warning(file, `Undefined array item at index ${index}.`);
        }
      });
    } else {
      for (const [key, child] of Object.entries(value)) {
        const fieldPath = `${context.path || '$'}.${key}`;

        if (typeof child === 'string') {
          const trimmed = child.trim();

          if (trimmed !== child) {
            reporter.warning(file, `Leading or trailing whitespace in string field "${fieldPath}".`);
          }

          if (isPotentialUrlField(key) && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('/')) {
            if (!isValidHttpUrl(trimmed) && !trimmed.startsWith('./') && !trimmed.startsWith('../')) {
              reporter.warning(file, `Field "${fieldPath}" looks like a URL but is not a valid HTTP(S) or relative URL.`);
            }
          }

          if (isPotentialDateField(key) && trimmed && !Number.isNaN(Date.parse(trimmed))) {
            // Date is valid; no further action required.
          } else if (isPotentialDateField(key) && trimmed) {
            reporter.warning(file, `Field "${fieldPath}" does not look like a parseable date.`);
          }

          if (/(?:password|secret|apiKey|accessToken|refreshToken|privateKey)/i.test(key)) {
            reporter.warning(file, `Potential secret-bearing field "${fieldPath}" found in public data.`);
          }

          if (trimmed === 'undefined' || trimmed === 'null' || trimmed === 'NaN') {
            reporter.warning(file, `Field "${fieldPath}" contains the literal string "${trimmed}".`);
          }
        }

        if (child === null && options.strict) {
          reporter.warning(file, `Field "${fieldPath}" is null.`);
        }

        if (isPotentialUrlField(key) && typeof child === 'number') {
          reporter.warning(file, `URL-like field "${fieldPath}" has a numeric value.`);
        }

        if (typeof child === 'number' && !Number.isFinite(child)) {
          reporter.error(file, `Field "${fieldPath}" is not a finite number.`);
        }

        if (typeof child === 'number' && /(?:amount|fee|price|salary|stipend|cost|count|age|duration|experience|vacancies|seats)$/i.test(key) && child < 0) {
          reporter.error(file, `Field "${fieldPath}" cannot be negative.`);
        }

        if (Array.isArray(child) && child.length === 0 && options.strict) {
          reporter.warning(file, `Field "${fieldPath}" is an empty array.`);
        }

        inspectValueTree(child, {
          ...context,
          path: fieldPath,
        }, depth + 1, seen);
      }
    }

    seen.delete(value);
  }
}

function seenWithParent(seen, parent) {
  const next = new WeakSet();

  // WeakSet is not iterable; the parent is tracked by the current traversal.
  // Each child recursion gets a fresh set to avoid treating shared references as cycles.
  if (parent && typeof parent === 'object') {
    next.add(parent);
  }

  return next;
}

function normalizeRecords(data, file, reporter) {
  if (Array.isArray(data)) {
    return data.map((record, index) => ({
      record,
      index,
      location: `$[${index}]`,
    }));
  }

  if (!isPlainObject(data)) {
    reporter.error(file, 'Top-level JSON value must be an object or an array.');
    return [];
  }

  for (const key of ['items', 'data', 'results', 'records', 'jobs', 'colleges', 'courses', 'notifications']) {
    if (Array.isArray(data[key])) {
      return data[key].map((record, index) => ({
        record,
        index,
        location: `$.${key}[${index}]`,
      }));
    }
  }

  if (Object.keys(data).length === 0) {
    reporter.warning(file, 'Top-level object is empty.');
    return [];
  }

  const values = Object.values(data);

  if (values.every((value) => isPlainObject(value))) {
    return Object.entries(data).map(([key, record], index) => ({
      record,
      index,
      location: `$.${key}`,
      mapKey: key,
    }));
  }

  return [{
    record: data,
    index: 0,
    location: '$',
  }];
}

function validateCollection(data, file, collectionName, reporter, options) {
  const rules = KNOWN_COLLECTION_RULES[collectionName];

  if (!rules) {
    reporter.info(file, `No collection-specific rule for "${collectionName}"; generic checks applied.`);
    return;
  }

  const records = normalizeRecords(data, file, reporter);

  if (records.length === 0) {
    reporter.warning(file, 'No records found to validate.');
    return;
  }

  const seenIds = new Map();

  records.forEach(({ record, location, mapKey }) => {
    if (!isPlainObject(record)) {
      reporter.error(file, `${location} must be an object.`);
      return;
    }

    const hasAnyId = rules.requiredAny.some((field) => {
      return isNonEmptyString(record[field]) || typeof record[field] === 'number';
    });

    if (!hasAnyId) {
      reporter.error(file, `${location} is missing an identifier. Expected one of: ${rules.requiredAny.join(', ')}.`);
    }

    for (const field of rules.requiredFields) {
      if (!isNonEmptyString(record[field])) {
        reporter.error(file, `${location}.${field} is required and must be a non-empty string.`);
      }
    }

    if (rules.titleFields?.length) {
      const hasTitle = rules.titleFields.some((field) => isNonEmptyString(record[field]));

      if (!hasTitle && options.strict) {
        reporter.warning(file, `${location} has no recognized title/name field (${rules.titleFields.join(', ')}).`);
      }
    }

    const recordId = getRecordId(record, rules.idFields);

    if (recordId !== null) {
      const previousLocation = seenIds.get(recordId);

      if (previousLocation) {
        reporter.error(file, `Duplicate identifier "${recordId}" at ${location}; first seen at ${previousLocation}.`);
      } else {
        seenIds.set(recordId, location);
      }
    }

    if (mapKey && recordId && mapKey !== recordId && options.strict) {
      reporter.warning(file, `${location} map key "${mapKey}" differs from record identifier "${recordId}".`);
    }

    for (const field of rules.arrayFields || []) {
      if (field in record && !Array.isArray(record[field])) {
        reporter.error(file, `${location}.${field} must be an array when present.`);
      }
    }

    for (const field of rules.numericFields || []) {
      if (field in record && record[field] !== null && (typeof record[field] !== 'number' || !Number.isFinite(record[field]))) {
        reporter.error(file, `${location}.${field} must be a finite number when present.`);
      }
    }

    for (const field of rules.urlFields || []) {
      if (!(field in record) || record[field] === null || record[field] === '') {
        continue;
      }

      if (typeof record[field] !== 'string') {
        reporter.error(file, `${location}.${field} must be a string when present.`);
      } else if (
        !isValidHttpUrl(record[field])
        && !record[field].startsWith('/')
        && !record[field].startsWith('./')
        && !record[field].startsWith('../')
        && !record[field].startsWith('#')
      ) {
        reporter.warning(file, `${location}.${field} is not a valid HTTP(S) or relative URL.`);
      }
    }

    for (const field of rules.dateFields || []) {
      if (!(field in record) || record[field] === null || record[field] === '') {
        continue;
      }

      const date = record[field];

      if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
        reporter.warning(file, `${location}.${field} is not a parseable date.`);
      }
    }

    if (typeof record.title === 'string' && record.title.trim().length < 3) {
      reporter.warning(file, `${location}.title is unusually short.`);
    }

    if (typeof record.name === 'string' && record.name.trim().length < 2) {
      reporter.warning(file, `${location}.name is unusually short.`);
    }

    if (typeof record.status === 'string' && record.status.trim() === '') {
      reporter.warning(file, `${location}.status is empty.`);
    }

    if (typeof record.isActive === 'string') {
      reporter.warning(file, `${location}.isActive should normally be a boolean, not a string.`);
    }

    if (typeof record.active === 'string') {
      reporter.warning(file, `${location}.active should normally be a boolean, not a string.`);
    }
  });
}

function extractLocalReferences(data, file) {
  const refs = [];

  function walk(value, currentPath = '$') {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${currentPath}[${index}]`));
      return;
    }

    if (!isPlainObject(value)) {
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const lowerKey = key.toLowerCase();

      if (
        typeof child === 'string'
        && /(collegeid|courseid|universityid|jobid|serviceid|documentid|scholarshipid|examid|relatedid|referenceid|refid)$/i.test(lowerKey)
      ) {
        refs.push({
          key,
          value: child,
          location: `${currentPath}.${key}`,
          file,
        });
      }

      walk(child, `${currentPath}.${key}`);
    }
  }

  walk(data);
  return refs;
}

function buildIdIndex(parsedFiles, root) {
  const index = new Map();

  for (const entry of parsedFiles) {
    const records = normalizeRecords(entry.data, entry.relativePath, {
      error() {},
      warning() {},
      info() {},
    });

    for (const { record } of records) {
      if (!isPlainObject(record)) {
        continue;
      }

      const id = getRecordId(record);

      if (!id) {
        continue;
      }

      const key = id.toLowerCase();
      const values = index.get(key) || [];

      values.push({
        id,
        file: entry.relativePath,
        root: relativeToRoot(root, entry.absolutePath),
      });

      index.set(key, values);
    }
  }

  return index;
}

function validateReferences(parsedFiles, root, reporter) {
  const idIndex = buildIdIndex(parsedFiles, root);

  for (const entry of parsedFiles) {
    for (const ref of extractLocalReferences(entry.data, entry.relativePath)) {
      const key = ref.value.toLowerCase();

      if (!idIndex.has(key)) {
        reporter.warning(
          entry.relativePath,
          `Possible unresolved reference "${ref.value}" at ${ref.location}.`,
        );
      }
    }
  }
}

async function loadAjv() {
  try {
    const module = await import('ajv');
    const Ajv = module.default || module.Ajv;

    if (typeof Ajv !== 'function') {
      throw new Error('Ajv module loaded but no Ajv constructor was found.');
    }

    return new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    });
  } catch {
    throw new Error(
      'JSON Schema validation was requested, but Ajv is unavailable. Install it with: npm install --save-dev ajv',
    );
  }
}

function collectSchemaFiles(schemaDirs, schemaFiles, options, reporter) {
  const found = [];

  for (const file of schemaFiles) {
    found.push(...collectJsonFiles(file, options, reporter, options.root));
  }

  for (const directory of schemaDirs) {
    found.push(...collectJsonFiles(directory, options, reporter, options.root));
  }

  return [...new Set(found)].filter((file) => {
    const base = path.basename(file).toLowerCase();
    return base.includes('schema') || schemaFiles.some((explicit) => path.resolve(options.root, explicit) === file);
  });
}

function matchSchemaForData(dataFile, schemaFiles) {
  const dataName = path.basename(dataFile, path.extname(dataFile))
    .toLowerCase()
    .replace(/[-_]v\d+$/, '');

  const candidates = schemaFiles.map((schemaFile) => ({
    file: schemaFile,
    name: path.basename(schemaFile, path.extname(schemaFile))
      .toLowerCase()
      .replace(/\.schema$/, '')
      .replace(/[-_]schema$/, '')
      .replace(/[-_]v\d+$/, ''),
  }));

  return candidates.find((candidate) => candidate.name === dataName)
    || candidates.find((candidate) => candidate.name === `${dataName}s`)
    || candidates.find((candidate) => candidate.name === dataName.replace(/s$/, ''))
    || null;
}

function validateAgainstSchema(data, schema, dataFile, schemaFile, ajv, reporter, root) {
  try {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      reporter.info(
        relativeToRoot(root, dataFile),
        `JSON Schema validation passed (${relativeToRoot(root, schemaFile)}).`,
      );
      return;
    }

    for (const error of validate.errors || []) {
      const instancePath = error.instancePath || '$';
      const schemaPath = error.schemaPath || '';
      const message = error.message || 'Schema validation failed';

      reporter.error(
        relativeToRoot(root, dataFile),
        `${instancePath}: ${message}`,
        {
          schema: relativeToRoot(root, schemaFile),
          schemaPath,
          keyword: error.keyword,
          params: error.params,
        },
      );
    }
  } catch (error) {
    reporter.error(
      relativeToRoot(root, dataFile),
      `Could not apply schema ${relativeToRoot(root, schemaFile)}: ${error.message}`,
    );
  }
}

function checkJsonFileSafety(filePath, relativePath, reporter) {
  const stat = fs.statSync(filePath);

  if (stat.size === 0) {
    reporter.error(relativePath, 'File is empty.');
    return false;
  }

  if (stat.size > 20 * 1024 * 1024) {
    reporter.warning(relativePath, 'File exceeds 20 MiB; consider splitting large data files.');
  }

  return true;
}

function validateFile(filePath, options, reporter) {
  const relative = relativeToRoot(options.root, filePath);

  reporter.results.filesScanned += 1;

  if (!checkJsonFileSafety(filePath, relative, reporter)) {
    reporter.results.filesFailed += 1;
    return null;
  }

  let parsed;

  try {
    parsed = readJsonFile(filePath, options.allowJsonc);
  } catch (error) {
    reporter.error(relative, error.message);
    reporter.results.filesFailed += 1;
    return null;
  }

  const beforeErrors = reporter.results.errors.length;

  if (parsed.value === undefined) {
    reporter.error(relative, 'Parsed JSON value is undefined.');
  }

  if (parsed.value === null) {
    reporter.error(relative, 'Top-level JSON value cannot be null.');
  }

  const collectionName = getCollectionName(filePath);

  validateCollection(parsed.value, relative, collectionName, reporter, options);

  inspectValueTree(parsed.value, {
    file: relative,
    reporter,
    options,
    path: '$',
  });

  if (reporter.results.errors.length === beforeErrors) {
    reporter.results.filesPassed += 1;

    if (options.verbose) {
      reporter.info(relative, 'Validation passed.');
    }
  } else {
    reporter.results.filesFailed += 1;
  }

  return {
    absolutePath: filePath,
    relativePath: relative,
    data: parsed.value,
  };
}

function writeJsonReport(reportPath, report, root, reporter) {
  const absolutePath = path.resolve(root, reportPath);

  if (!isInside(root, absolutePath)) {
    reporter.error(relativeToRoot(root, absolutePath), 'Report path must be inside the project root.');
    return false;
  }

  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });

    const payload = {
      ...report,
      finishedAt: new Date().toISOString(),
      summary: {
        filesScanned: report.filesScanned,
        filesPassed: report.filesPassed,
        filesFailed: report.filesFailed,
        errorCount: report.errors.length,
        warningCount: report.warnings.length,
        infoCount: report.infos.length,
      },
    };

    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;

    fs.writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });

    fs.renameSync(temporaryPath, absolutePath);

    if (!report.quiet) {
      console.log(`INFO    ${relativeToRoot(root, absolutePath)} -- JSON report written.`);
    }

    return true;
  } catch (error) {
    reporter.error(relativeToRoot(root, absolutePath), `Unable to write JSON report: ${error.message}`);
    return false;
  }
}

function printSummary(results, options) {
  results.finishedAt = new Date().toISOString();

  if (!options.quiet) {
    console.log('\nMedOrbits data validation summary');
    console.log('---------------------------------');
    console.log(`Files scanned : ${results.filesScanned}`);
    console.log(`Files passed  : ${results.filesPassed}`);
    console.log(`Files failed  : ${results.filesFailed}`);
    console.log(`Errors        : ${results.errors.length}`);
    console.log(`Warnings      : ${results.warnings.length}`);
  } else {
    console.log(
      `Validation: ${results.filesPassed}/${results.filesScanned} files passed; `
      + `${results.errors.length} error(s), ${results.warnings.length} warning(s).`,
    );
  }

  if (results.errors.length > 0) {
    console.log('\nResult: FAILED');
  } else if ((options.strict || options.failOnWarning) && results.warnings.length > 0) {
    console.log('\nResult: FAILED (warnings treated as failures)');
  } else {
    console.log('\nResult: PASSED');
  }
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Argument error: ${error.message}`);
    console.error('Use --help to see supported options.');
    process.exitCode = 2;
    return;
  }

  if (options.help) {
    printHelp();
    return;
  }

  if (!fs.existsSync(options.root) || !fs.statSync(options.root).isDirectory()) {
    console.error(`Project root does not exist or is not a directory: ${options.root}`);
    process.exitCode = 2;
    return;
  }

  const reporter = createReporter(options);

  if (!options.quiet) {
    console.log(`MedOrbits data validation -- ${SCRIPT_NAME}`);
    console.log(`Project root: ${options.root}`);
  }

  const dataFiles = [];

  for (const directory of options.dirs) {
    dataFiles.push(...collectJsonFiles(directory, options, reporter, options.root));
  }

  for (const file of options.files) {
    dataFiles.push(...collectJsonFiles(file, options, reporter, options.root));
  }

  const uniqueDataFiles = [...new Set(dataFiles)].sort();

  if (uniqueDataFiles.length === 0) {
    reporter.error(null, 'No JSON data files were found. Check --root, --dir, or --file.');
    printSummary(reporter.results, options);
    process.exitCode = 1;
    return;
  }

  const parsedFiles = [];

  for (const file of uniqueDataFiles) {
    const result = validateFile(file, options, reporter);

    if (result) {
      parsedFiles.push(result);
    }
  }

  if (options.checkReferences) {
    validateReferences(parsedFiles, options.root, reporter);
  }

  if (options.checkExternalUrls) {
    reporter.info(
      null,
      'External URL checking is syntax-only; this script does not send network requests.',
    );
  }

  if (options.validateSchemas) {
    const schemaFiles = collectSchemaFiles(
      options.schemaDirs,
      options.schemaFiles,
      options,
      reporter,
    );

    if (schemaFiles.length === 0) {
      reporter.error(null, 'Schema validation requested, but no JSON Schema files were found.');
    } else {
      let ajv;

      try {
        ajv = await loadAjv();
      } catch (error) {
        reporter.error(null, error.message);
      }

      if (ajv) {
        const schemas = [];

        for (const schemaFile of schemaFiles) {
          try {
            const { value } = readJsonFile(schemaFile, options.allowJsonc);

            if (!isPlainObject(value)) {
              reporter.error(relativeToRoot(options.root, schemaFile), 'JSON Schema must be a JSON object.');
              continue;
            }

            schemas.push({
              absolutePath: schemaFile,
              data: value,
              relativePath: relativeToRoot(options.root, schemaFile),
            });
          } catch (error) {
            reporter.error(relativeToRoot(options.root, schemaFile), `Unable to load schema: ${error.message}`);
          }
        }

        for (const entry of parsedFiles) {
          const matched = matchSchemaForData(entry.absolutePath, schemas.map((schema) => schema.absolutePath));

          if (!matched) {
            if (options.strict) {
              reporter.warning(entry.relativePath, 'No matching JSON Schema was found.');
            }
            continue;
          }

          const schemaEntry = schemas.find((schema) => schema.absolutePath === matched.file);

          if (schemaEntry) {
            validateAgainstSchema(
              entry.data,
              schemaEntry.data,
              entry.absolutePath,
              schemaEntry.absolutePath,
              ajv,
              reporter,
              options.root,
            );
          }
        }
      }
    }
  }

  if (options.reportJson) {
    writeJsonReport(options.reportJson, {
      ...reporter.results,
      quiet: options.quiet,
    }, options.root, reporter);
  }

  printSummary(reporter.results, options);

  const hasFailure = reporter.results.errors.length > 0
    || ((options.strict || options.failOnWarning) && reporter.results.warnings.length > 0);

  process.exitCode = hasFailure ? 1 : 0;
}

const isMainModule = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  main().catch((error) => {
    console.error(`Fatal validation error: ${error.stack || error.message || error}`);
    process.exitCode = 2;
  });
}

export {
  KNOWN_COLLECTION_RULES,
  collectJsonFiles,
  getCollectionName,
  isValidHttpUrl,
  normalizeRecords,
  parseArgs,
  readJsonFile,
  validateCollection,
  validateFile,
};

