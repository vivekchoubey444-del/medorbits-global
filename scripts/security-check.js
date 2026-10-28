#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Security Configuration Checker
 * File: /scripts/check-security.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None (npm audit is optional)
 *
 * Checks:
 * - Project configuration and package scripts
 * - Required secret configuration
 * - Placeholder and weak-secret detection
 * - .gitignore protection for environment and runtime files
 * - Accidental committed environment files
 * - HTTPS and security-header configuration indicators
 * - Cookie, CORS, and CSP configuration indicators
 * - Dependency lockfile presence
 * - Optional npm audit execution
 *
 * Important:
 * - This is a static configuration audit, not a penetration test.
 * - Does not print secret values.
 * - Does not modify project files or install dependencies.
 * - npm audit may access the configured registry when enabled.
 *
 * Usage:
 *   node scripts/check-security.mjs
 *   node scripts/check-security.mjs --strict
 *   node scripts/check-security.mjs --json
 *   node scripts/check-security.mjs --audit
 *   node scripts/check-security.mjs --root .
 *   node scripts/check-security.mjs --help
 *
 * Exit codes:
 *   0 = Checks passed
 *   1 = Security findings detected
 *   2 = Configuration or execution error
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_FINDINGS = 500;
const AUDIT_TIMEOUT_MS = 120_000;
const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FINDINGS: 1,
  CONFIGURATION_ERROR: 2,
});
const SECRET_NAMES = [
  'SESSION_SECRET',
  'JWT_SECRET',
  'DATABASE_URL',
  'JWT_PRIVATE_KEY',
  'ENCRYPTION_KEY',
  'API_SECRET',
  'AI_API_KEY',
  'ADMIN_TOKEN',
];
const PLACEHOLDER_PATTERNS = [
  /^change[-_ ]?me$/i,
  /^your[-_ ].*$/i,
  /^replace[-_ ].*$/i,
  /^example$/i,
  /^placeholder$/i,
  /^secret$/i,
  /^password$/i,
  /^123456+$/,
  /^<.*>$/,
  /^todo$/i,
  /^default$/i,
  /^insert[-_ ].*$/i,
  /^generate[-_ ].*$/i,
];
const DEFAULT_IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
  '.netlify',
]);
const SECURITY_HEADERS = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'X-Frame-Options',
  'Permissions-Policy',
];
function parseArguments(argv) {
  const options = {
    root: DEFAULT_ROOT,
    strict: false,
    json: false,
    audit: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--audit':
        options.audit = true;
        break;
      case '--root': {
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
          throw new Error('--root requires a directory path.');
        }
        options.root = path.resolve(process.cwd(), value);
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}
function printHelp() {
  console.log(`
MedOrbits Security Configuration Checker
Usage:
  node scripts/check-security.mjs [options]
Options:
  --root <directory>   Project root (default: repository root)
  --strict             Treat warnings as failures
  --json               Emit machine-readable JSON
  --audit              Run npm audit --omit=dev
  --help, -h           Show help
Checks:
  - Environment and secret configuration
  - Git ignore rules and tracked sensitive files
  - Package configuration and lockfiles
  - Security-header and cookie/CORS configuration indicators
  - Optional production dependency audit
Exit codes:
  0  Checks passed
  1  Security findings detected
  2  Configuration or execution error
`);
}
function createReport(root, options) {
  return {
    tool: 'MedOrbits Security Configuration Checker',
    version: 1,
    timestamp: new Date().toISOString(),
    root,
    strict: options.strict,
    auditRequested: options.audit,
    status: 'passed',
    summary: {
      checksRun: 0,
      passed: 0,
      warnings: 0,
      errors: 0,
      skipped: 0,
      omittedFindings: 0,
    },
    findings: [],
  };
}
function addFinding(report, level, code, message, file = undefined) {
  report.summary.checksRun += 1;
  if (level === 'passed') {
    report.summary.passed += 1;
  } else if (level === 'warning') {
    report.summary.warnings += 1;
  } else if (level === 'error') {
    report.summary.errors += 1;
  } else if (level === 'skipped') {
    report.summary.skipped += 1;
  }
  if (level === 'warning' || level === 'error') {
    if (report.findings.length >= MAX_REPORT_FINDINGS) {
      report.summary.omittedFindings += 1;
      return;
    }
  }
  report.findings.push({
    level,
    code,
    message,
    ...(file ? { file } : {}),
  });
}
function isInsideRoot(root, target) {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}
function safeStat(filePath) {
  try {
    return fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
function readTextFile(root, relativePath) {
  const fullPath = path.resolve(root, relativePath);
  if (!isInsideRoot(root, fullPath)) {
    throw new Error('Requested file resolves outside the project root.');
  }
  const stat = safeStat(fullPath);
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    return null;
  }
  if (stat.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(
      `File exceeds the ${MAX_TEXT_FILE_BYTES}-byte inspection limit.`,
    );
  }
  const descriptor = fs.openSync(
    fullPath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile()) {
      throw new Error('Path is not a regular file.');
    }
    if (openedStat.size > MAX_TEXT_FILE_BYTES) {
      throw new Error('File exceeds the inspection limit.');
    }
    const buffer = Buffer.alloc(openedStat.size);
    let offset = 0;
    while (offset < buffer.length) {
      const count = fs.readSync(
        descriptor,
        buffer,
        offset,
        buffer.length - offset,
        offset,
      );
      if (count === 0) {
        break;
      }
      offset += count;
    }
    return buffer.subarray(0, offset).toString('utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}
function walkProject(root, visit, report) {
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, {
        withFileTypes: true,
      });
      entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      addFinding(
        report,
        'warning',
        'DIRECTORY_UNREADABLE',
        'A directory could not be inspected.',
        path.relative(root, directory) || '.',
      );
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(root, fullPath);
      if (!isInsideRoot(root, fullPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        visit(fullPath, relativePath);
      }
    }
  }
}
function checkRootConfiguration(root, report) {
  const packageJsonPath = path.join(root, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    addFinding(
      report,
      'warning',
      'PACKAGE_JSON_MISSING',
      'No package.json was found at the project root.',
    );
    return null;
  }
  let packageJson;
  try {
    const raw = readTextFile(root, 'package.json');
    if (raw === null) {
      throw new Error('package.json is not a regular file.');
    }
    packageJson = JSON.parse(raw);
  } catch {
    addFinding(
      report,
      'error',
      'PACKAGE_JSON_INVALID',
      'package.json is unreadable or invalid JSON.',
      'package.json',
    );
    return null;
  }
  addFinding(
    report,
    'passed',
    'PACKAGE_JSON_VALID',
    'package.json is valid JSON.',
    'package.json',
  );
  if (packageJson.type !== 'module') {
    addFinding(
      report,
      'warning',
      'ESM_CONFIGURATION',
      'package.json does not declare "type": "module". Ensure .mjs scripts are used consistently.',
      'package.json',
    );
  } else {
    addFinding(
      report,
      'passed',
      'ESM_CONFIGURATION',
      'The project declares ES module mode.',
      'package.json',
    );
  }
  const scripts = packageJson.scripts || {};
  if (!scripts.start) {
    addFinding(
      report,
      'warning',
      'START_SCRIPT_MISSING',
      'No npm start script is defined.',
      'package.json',
    );
  } else {
    addFinding(
      report,
      'passed',
      'START_SCRIPT_PRESENT',
      'An npm start script is defined.',
      'package.json',
    );
  }
  if (!scripts.test) {
    addFinding(
      report,
      'warning',
      'TEST_SCRIPT_MISSING',
      'No npm test script is defined.',
      'package.json',
    );
  }
  return packageJson;
}
function checkLockfiles(root, report) {
  const lockfiles = [
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ];
  const found = lockfiles.filter((file) => {
    try {
      const stat = fs.lstatSync(path.join(root, file));
      return stat.isFile() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  });
  if (found.length === 0) {
    addFinding(
      report,
      'warning',
      'LOCKFILE_MISSING',
      'No recognized dependency lockfile was found.',
    );
    return;
  }
  addFinding(
    report,
    'passed',
    'LOCKFILE_PRESENT',
    `Dependency lockfile found: ${found.join(', ')}.`,
  );
}
function checkGitIgnore(root, report) {
  let gitignore;
  try {
    gitignore = readTextFile(root, '.gitignore');
  } catch {
    gitignore = null;
  }
  if (gitignore === null) {
    addFinding(
      report,
      'warning',
      'GITIGNORE_MISSING',
      'A root .gitignore file was not found.',
      '.gitignore',
    );
    return;
  }
  addFinding(
    report,
    'passed',
    'GITIGNORE_PRESENT',
    'A root .gitignore file exists.',
    '.gitignore',
  );
  const normalizedLines = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const requiredPatterns = [
    {
      code: 'ENV_IGNORE_RULE',
      pattern: '.env',
      regex: /^\.env(?:\/|\*|\s|$)/,
      message: 'Ensure .env and its variants are excluded from Git.',
    },
    {
      code: 'PRIVATE_STORAGE_IGNORE_RULE',
      pattern: 'storage',
      regex: /^\/?storage\/?$/,
      message: 'Ensure private runtime storage is excluded from Git.',
    },
  ];
  for (const requirement of requiredPatterns) {
    const found = normalizedLines.some((line) =>
      requirement.regex.test(line),
    );
    if (found) {
      addFinding(
        report,
        'passed',
        requirement.code,
        `A matching ignore rule for ${requirement.pattern} was found.`,
        '.gitignore',
      );
    } else {
      addFinding(
        report,
        'warning',
        requirement.code,
        requirement.message,
        '.gitignore',
      );
    }
  }
}
function checkEnvironmentFiles(root, report) {
  const sensitiveFileNames = new Set([
    '.env',
    '.env.production',
    '.env.local',
    '.env.development.local',
    '.npmrc',
    'id_rsa',
    'id_ed25519',
    'service-account.json',
    'credentials.json',
  ]);
  walkProject(
    root,
    (_fullPath, relativePath) => {
      const baseName = path.basename(relativePath);
      if (
        sensitiveFileNames.has(baseName) &&
        !relativePath.split(path.sep).includes('node_modules')
      ) {
        if (baseName === '.npmrc') {
          addFinding(
            report,
            'warning',
            'NPMRC_REVIEW',
            'Review this npm configuration for embedded registry tokens or credentials.',
            relativePath,
          );
        } else {
          addFinding(
            report,
            'warning',
            'SENSITIVE_FILE_PRESENT',
            'A potentially sensitive file exists in the working tree. Verify that it is ignored and contains no committed secrets.',
            relativePath,
          );
        }
      }
    },
    report,
  );
}
function checkEnvironmentSecrets(report) {
  const isProduction =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    if (value === undefined || value.trim() === '') {
      const required =
        name === 'SESSION_SECRET' ||
        name === 'JWT_SECRET';
      if (required && isProduction) {
        addFinding(
          report,
          'error',
          'REQUIRED_SECRET_MISSING',
          `${name} is missing in production.`,
        );
      } else {
        addFinding(
          report,
          'warning',
          'SECRET_NOT_CONFIGURED',
          `${name} is not configured in this process environment. Confirm whether the application requires it.`,
        );
      }
      continue;
    }
    const isPlaceholder = PLACEHOLDER_PATTERNS.some(
      (pattern) => pattern.test(value.trim()),
    );
    if (isPlaceholder) {
      addFinding(
        report,
        isProduction ? 'error' : 'warning',
        'PLACEHOLDER_SECRET',
        `${name} appears to contain a placeholder value. The value itself was not printed.`,
      );
      continue;
    }
    if (
      ['SESSION_SECRET', 'JWT_SECRET', 'ENCRYPTION_KEY'].includes(name) &&
      value.length < 32
    ) {
      addFinding(
        report,
        isProduction ? 'error' : 'warning',
        'SHORT_SECRET',
        `${name} is shorter than the recommended 32-character minimum.`,
      );
      continue;
    }
    addFinding(
      report,
      'passed',
      'SECRET_CONFIGURED',
      `${name} is configured; its value was not inspected or displayed.`,
    );
  }
}
function checkSecurityConfiguration(root, report) {
  const candidateFiles = [
    'server.js',
    'app.js',
    'index.js',
    'src/server.js',
    'src/app.js',
    'api/server.js',
    'api/app.js',
    'api/middleware/security.js',
    'api/middleware/security.mjs',
  ];
  let combined = '';
  let inspected = 0;
  for (const relativePath of candidateFiles) {
    let content;
    try {
      content = readTextFile(root, relativePath);
    } catch {
      content = null;
    }
    if (content === null) {
      continue;
    }
    combined += `\n${content}`;
    inspected += 1;
  }
  if (inspected === 0) {
    addFinding(
      report,
      'warning',
      'SECURITY_CONFIG_NOT_FOUND',
      'No common server or security middleware entry point was found. Security headers could not be assessed statically.',
    );
    return;
  }
  const checks = [
    {
      code: 'NOSNIFF_HEADER',
      regex: /X-Content-Type-Options|noSniff\s*:\s*true/i,
      message: 'X-Content-Type-Options configuration indicator found.',
    },
    {
      code: 'REFERRER_POLICY',
      regex: /Referrer-Policy|referrerPolicy/i,
      message: 'Referrer-Policy configuration indicator found.',
    },
    {
      code: 'FRAME_PROTECTION',
      regex: /X-Frame-Options|frameguard|frameAncestors/i,
      message: 'Frame-protection configuration indicator found.',
    },
    {
      code: 'CONTENT_SECURITY_POLICY',
      regex: /Content-Security-Policy|contentSecurityPolicy|contentSecurityPolicy\s*:/i,
      message: 'Content Security Policy configuration indicator found.',
    },
    {
      code: 'HTTPS_REDIRECT',
      regex: /httpsRedirect|redirect.*https|req\.secure|x-forwarded-proto/i,
      message: 'HTTPS/proxy handling indicator found. Verify trusted-proxy configuration.',
    },
    {
      code: 'COOKIE_SECURITY',
      regex: /httpOnly\s*:\s*true|httpOnly\s*=\s*true/i,
      message: 'HttpOnly cookie configuration indicator found.',
    },
    {
      code: 'COOKIE_SECURE',
      regex: /secure\s*:\s*true|secure\s*:\s*process\.env/i,
      message: 'Secure cookie configuration indicator found.',
    },
    {
      code: 'CORS_CONFIGURATION',
      regex: /\bcors\s*\(|Access-Control-Allow-Origin|origin\s*:/i,
      message: 'CORS configuration indicator found. Review the allowed origins.',
    },
    {
      code: 'RATE_LIMITING',
      regex: /rateLimit|rate-limit|express-rate-limit/i,
      message: 'Rate-limiting configuration indicator found.',
    },
  ];
  for (const check of checks) {
    if (check.regex.test(combined)) {
      addFinding(
        report,
        'passed',
        check.code,
        check.message,
      );
    } else {
      addFinding(
        report,
        'warning',
        `${check.code}_NOT_DETECTED`,
        `Could not statically detect ${check.code.replaceAll('_', ' ').toLowerCase()} in the inspected entry points. Verify the implementation manually.`,
      );
    }
  }
  addFinding(
    report,
    'warning',
    'STATIC_ANALYSIS_LIMITATION',
    `Inspected ${inspected} common server/security file(s). Text matching cannot prove that middleware is mounted or correctly configured.`,
  );
}
function runNpmAudit(root, report) {
  const packageLock = path.join(root, 'package-lock.json');
  if (!fs.existsSync(packageLock)) {
    addFinding(
      report,
      'warning',
      'NPM_AUDIT_SKIPPED',
      'npm audit was requested, but package-lock.json was not found.',
    );
    return;
  }
  const result = spawnSync(
    'npm',
    ['audit', '--omit=dev', '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: AUDIT_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        npm_config_audit: 'true',
        npm_config_fund: 'false',
      },
    },
  );
  if (result.error) {
    addFinding(
      report,
      'error',
      'NPM_AUDIT_EXECUTION_FAILED',
      result.error.code === 'ETIMEDOUT'
        ? 'npm audit timed out.'
        : 'npm audit could not be executed.',
    );
    return;
  }
  let auditReport;
  try {
    auditReport = JSON.parse(result.stdout || '{}');
  } catch {
    addFinding(
      report,
      'error',
      'NPM_AUDIT_INVALID_OUTPUT',
      'npm audit did not return valid JSON output.',
    );
    return;
  }
  const vulnerabilities =
    auditReport.metadata?.vulnerabilities || {};
  const counts = {
    critical: Number(vulnerabilities.critical || 0),
    high: Number(vulnerabilities.high || 0),
    moderate: Number(vulnerabilities.moderate || 0),
    low: Number(vulnerabilities.low || 0),
    info: Number(vulnerabilities.info || 0),
  };
  const total = Object.values(counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total === 0 && result.status === 0) {
    addFinding(
      report,
      'passed',
      'NPM_AUDIT_PASSED',
      'npm audit reported no production dependency vulnerabilities.',
    );
    return;
  }
  addFinding(
    report,
    total > 0 ? 'warning' : 'error',
    'NPM_AUDIT_FINDINGS',
    `Production dependency audit summary: ${JSON.stringify(counts)}.`,
  );
}
function finalizeReport(report, options) {
  const hasErrors = report.summary.errors > 0;
  const hasWarnings = report.summary.warnings > 0;
  if (hasErrors || (options.strict && hasWarnings)) {
    report.status = 'failed';
    return EXIT_CODES.FINDINGS;
  }
  report.status = 'passed';
  return EXIT_CODES.SUCCESS;
}
function printHumanReport(report) {
  console.log('');
  console.log('MedOrbits Security Configuration Check');
  console.log('='.repeat(54));
  console.log(`Project root: ${report.root}`);
  console.log(`Timestamp:   ${report.timestamp}`);
  console.log(`Strict mode: ${report.strict ? 'enabled' : 'disabled'}`);
  console.log('');
  for (const finding of report.findings) {
    const label = finding.level.toUpperCase().padEnd(7);
    const location = finding.file ? ` (${finding.file})` : '';
    console.log(
      `[${label}] ${finding.code}: ${finding.message}${location}`,
    );
  }
  console.log('');
  console.log('Summary');
  console.log('-'.repeat(54));
  console.log(`Checks:    ${report.summary.checksRun}`);
  console.log(`Passed:    ${report.summary.passed}`);
  console.log(`Warnings:  ${report.summary.warnings}`);
  console.log(`Errors:    ${report.summary.errors}`);
  console.log(`Skipped:   ${report.summary.skipped}`);
  if (report.summary.omittedFindings > 0) {
    console.log(
      `Omitted:   ${report.summary.omittedFindings} additional findings`,
    );
  }
  console.log('');
  console.log(`Result: ${report.status.toUpperCase()}`);
  console.log('');
}
function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`ARGUMENT ERROR: ${error.message}`);
    console.error('Run with --help for usage.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }
  if (options.help) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }
  let root;
  try {
    root = fs.realpathSync(options.root);
    const stat = fs.statSync(root);
    if (!stat.isDirectory()) {
      throw new Error('The configured root is not a directory.');
    }
  } catch {
    console.error(
      'CONFIGURATION ERROR: The project root is inaccessible or invalid.',
    );
    return EXIT_CODES.CONFIGURATION_ERROR;
  }
  const report = createReport(root, options);
  checkRootConfiguration(root, report);
  checkLockfiles(root, report);
  checkGitIgnore(root, report);
  checkEnvironmentFiles(root, report);
  checkEnvironmentSecrets(report);
  checkSecurityConfiguration(root, report);
  if (options.audit) {
    runNpmAudit(root, report);
  } else {
    addFinding(
      report,
      'skipped',
      'NPM_AUDIT_NOT_REQUESTED',
      'Dependency audit was not run. Use --audit to request npm audit.',
    );
  }
  const exitCode = finalizeReport(report, options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }
  return exitCode;
}
try {
  process.exitCode = main();
} catch {
  console.error(
    'FATAL ERROR: Security checker encountered an unexpected failure.',
  );
  process.exitCode = EXIT_CODES.CONFIGURATION_ERROR;
}