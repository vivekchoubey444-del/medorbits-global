#!/usr/bin/env node
'use strict';
/**
 * MedOrbits -- Security Configuration Checker
 * File: /scripts/check-security.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None for static checks.
 *
 * Performs read-only configuration checks.
 * Optional npm audit requires npm, package-lock.json, and registry access.
 *
 * Important:
 * Static indicators do not prove that security controls are effective.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT_DEFAULT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_FINDINGS = 500;
const AUDIT_TIMEOUT_MS = 120_000;
const EXIT = Object.freeze({
  OK: 0,
  FINDINGS: 1,
  CONFIG: 2,
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
const PLACEHOLDERS = [
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
const IGNORED_DIRECTORIES = new Set([
  '.git', 'node_modules', '.next', 'dist', 'build',
  'coverage', '.cache', '.turbo', '.vercel', '.netlify',
]);
function parseArgs(argv) {
  const options = {
    root: ROOT_DEFAULT,
    strict: false,
    json: false,
    audit: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--audit') options.audit = true;
    else if (arg === '--root') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--root requires a directory.');
      }
      options.root = path.resolve(value);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}
function help() {
  console.log(`
MedOrbits Security Configuration Checker
Usage:
  node scripts/check-security.mjs [options]
Options:
  --root <directory>  Project root
  --strict            Treat warnings as failures
  --json              Machine-readable JSON report
  --audit             Run npm audit --omit=dev
  --help, -h          Show help
Exit codes:
  0 = Checks passed
  1 = Security findings
  2 = Configuration/runtime error
`);
}
function inside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' ||
    (rel !== '..' && !rel.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(rel));
}
function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/') || '.';
}
function readText(root, relativePath) {
  const target = path.resolve(root, relativePath);
  if (!inside(root, target)) {
    throw new Error('Path escapes project root.');
  }
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  if (stat.size > MAX_TEXT_BYTES) {
    throw new Error('File exceeds inspection limit.');
  }
  const fd = fs.openSync(
    target,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.size > MAX_TEXT_BYTES) {
      throw new Error('Unsafe or oversized file.');
    }
    const buffer = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < buffer.length) {
      const n = fs.readSync(
        fd, buffer, offset, buffer.length - offset, offset,
      );
      if (n === 0) break;
      offset += n;
    }
    return buffer.subarray(0, offset).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}
function reportFactory(root, options) {
  return {
    tool: 'MedOrbits Security Configuration Checker',
    version: 2,
    timestamp: new Date().toISOString(),
    root,
    strict: options.strict,
    findings: [],
    omittedFindings: 0,
    summary: {
      passed: 0,
      warnings: 0,
      errors: 0,
      skipped: 0,
    },
  };
}
function finding(report, level, code, message, file = undefined) {
  report.summary[level === 'passed' ? 'passed'
    : level === 'warning' ? 'warnings'
      : level === 'error' ? 'errors' : 'skipped'] += 1;
  if (
    (level === 'warning' || level === 'error') &&
    report.findings.length >= MAX_FINDINGS
  ) {
    report.omittedFindings += 1;
    return;
  }
  report.findings.push({
    level,
    code,
    message,
    ...(file ? { file } : {}),
  });
}
function walk(root, callback, report) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      finding(report, 'warning', 'DIRECTORY_UNREADABLE',
        'A directory could not be inspected.',
        relative(root, dir));
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      const rel = relative(root, full);
      if (!inside(root, full)) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        callback(full, rel);
      }
    }
  }
}
function checkPackage(root, report) {
  let pkg;
  try {
    const raw = readText(root, 'package.json');
    if (raw === null) throw new Error('Missing package.json.');
    pkg = JSON.parse(raw);
  } catch {
    finding(report, 'error', 'PACKAGE_JSON_INVALID',
      'package.json is missing, unreadable, or invalid JSON.',
      'package.json');
    return;
  }
  finding(report, 'passed', 'PACKAGE_JSON_VALID',
    'package.json is valid JSON.', 'package.json');
  if (!pkg.scripts?.start) {
    finding(report, 'warning', 'START_SCRIPT_MISSING',
      'No npm start script is defined.', 'package.json');
  } else {
    finding(report, 'passed', 'START_SCRIPT_PRESENT',
      'An npm start script is defined.', 'package.json');
  }
  if (!pkg.scripts?.test) {
    finding(report, 'warning', 'TEST_SCRIPT_MISSING',
      'No npm test script is defined.', 'package.json');
  }
  if (pkg.engines?.node) {
    finding(report, 'passed', 'NODE_ENGINE_DECLARED',
      `Node engine requirement is declared: ${String(pkg.engines.node).slice(0, 100)}.`,
      'package.json');
  } else {
    finding(report, 'warning', 'NODE_ENGINE_UNDECLARED',
      'Consider declaring a supported Node.js engine range.',
      'package.json');
  }
}
function checkLockfile(root, report) {
  const candidates = [
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ];
  const found = candidates.some((file) => {
    try {
      const s = fs.lstatSync(path.join(root, file));
      return s.isFile() && !s.isSymbolicLink();
    } catch {
      return false;
    }
  });
  finding(report, found ? 'passed' : 'warning',
    found ? 'LOCKFILE_PRESENT' : 'LOCKFILE_MISSING',
    found
      ? 'A dependency lockfile was found.'
      : 'No recognized dependency lockfile was found.');
}
function checkGitIgnore(root, report) {
  let text;
  try {
    text = readText(root, '.gitignore');
  } catch {
    text = null;
  }
  if (text === null) {
    finding(report, 'warning', 'GITIGNORE_MISSING',
      'A root .gitignore file was not found.', '.gitignore');
    return;
  }
  finding(report, 'passed', 'GITIGNORE_PRESENT',
    'A root .gitignore file exists.', '.gitignore');
  const lines = text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const checks = [
    {
      code: 'ENV_IGNORE_RULE',
      regex: /^\.env(?:$|\/|\*|\.)/,
      label: '.env exclusion rule',
    },
    {
      code: 'STORAGE_IGNORE_RULE',
      regex: /^\/?storage\/?$/,
      label: 'storage exclusion rule',
    },
  ];
  for (const check of checks) {
    const found = lines.some((line) => check.regex.test(line));
    finding(report, found ? 'passed' : 'warning',
      check.code,
      found
        ? `${check.label} found. Verify there are no later negation rules that re-include sensitive files.`
        : `Could not detect a ${check.label} in .gitignore.`,
      '.gitignore');
  }
}
function checkSensitiveFiles(root, report) {
  const sensitiveNames = new Set([
    '.env',
    '.env.production',
    '.env.local',
    '.env.development.local',
    'id_rsa',
    'id_ed25519',
    'service-account.json',
    'credentials.json',
  ]);
  walk(root, (_full, rel) => {
    const name = path.basename(rel);
    if (sensitiveNames.has(name)) {
      finding(report, 'warning', 'SENSITIVE_FILE_REVIEW',
        'Potentially sensitive file exists in the working tree. Verify Git tracking and permissions.',
        rel);
    }
    if (name === '.npmrc') {
      finding(report, 'warning', 'NPMRC_REVIEW',
        'Review npm configuration for embedded registry credentials.',
        rel);
    }
  }, report);
}
function isPlaceholder(value) {
  return PLACEHOLDERS.some((pattern) => pattern.test(value.trim())) ||
    /\b(change.?me|replace.?this|your.?secret|sample.?secret)\b/i.test(value);
}
function checkSecrets(report) {
  const production =
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  for (const name of SECRET_NAMES) {
    const value = process.env[name];
    if (typeof value !== 'string' || value.trim() === '') {
      const required = ['SESSION_SECRET', 'JWT_SECRET'].includes(name);
      finding(report,
        required && production ? 'error' : 'warning',
        required && production
          ? 'REQUIRED_SECRET_MISSING'
          : 'SECRET_NOT_CONFIGURED',
        required && production
          ? `${name} is missing in production.`
          : `${name} is not configured in this process environment. Confirm whether your application requires it.`);
      continue;
    }
    if (isPlaceholder(value)) {
      finding(report, production ? 'error' : 'warning',
        'PLACEHOLDER_SECRET',
        `${name} appears to contain a placeholder. Its value was not printed.`);
      continue;
    }
    if (
      ['SESSION_SECRET', 'JWT_SECRET', 'ENCRYPTION_KEY'].includes(name) &&
      value.length < 32
    ) {
      finding(report, production ? 'error' : 'warning',
        'SHORT_SECRET',
        `${name} is shorter than the recommended 32-character minimum.`);
      continue;
    }
    finding(report, 'passed', 'SECRET_CONFIGURED',
      `${name} is configured; its value was not displayed.`);
  }
}
function checkSecurityIndicators(root, report) {
  const files = [
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
  let count = 0;
  for (const file of files) {
    try {
      const text = readText(root, file);
      if (text !== null) {
        combined += `\n${text}`;
        count += 1;
      }
    } catch {
      finding(report, 'warning', 'SECURITY_FILE_UNREADABLE',
        'A candidate security configuration file could not be inspected.',
        file);
    }
  }
  if (count === 0) {
    finding(report, 'warning', 'SECURITY_CONFIG_NOT_FOUND',
      'No common server or security middleware entry point was found.');
    return;
  }
  const checks = [
    ['NOSNIFF_HEADER', /X-Content-Type-Options|noSniff\s*:\s*true/i],
    ['REFERRER_POLICY', /Referrer-Policy|referrerPolicy/i],
    ['FRAME_PROTECTION', /X-Frame-Options|frameguard|frameAncestors/i],
    ['CONTENT_SECURITY_POLICY', /Content-Security-Policy|contentSecurityPolicy/i],
    ['HTTPS_HANDLING', /httpsRedirect|req\.secure|x-forwarded-proto/i],
    ['HTTPONLY_COOKIE', /httpOnly\s*:\s*true/i],
    ['SECURE_COOKIE', /secure\s*:\s*true|secure\s*:\s*process\.env/i],
    ['CORS_CONFIGURATION', /\bcors\s*\(|Access-Control-Allow-Origin/i],
    ['RATE_LIMITING', /rateLimit|rate-limit|express-rate-limit/i],
  ];
  for (const [code, pattern] of checks) {
    const detected = pattern.test(combined);
    finding(report, detected ? 'passed' : 'warning',
      detected ? code : `${code}_NOT_DETECTED`,
      detected
        ? `${code.replaceAll('_', ' ')} configuration indicator detected.`
        : `Could not detect ${code.replaceAll('_', ' ').toLowerCase()} in inspected entry points. Verify manually.`);
  }
  finding(report, 'warning', 'STATIC_ANALYSIS_LIMITATION',
    `Inspected ${count} candidate file(s). Text matching does not prove that controls are correctly configured or mounted.`);
}
function runNpmAudit(root, report) {
  const lockPath = path.join(root, 'package-lock.json');
  try {
    const s = fs.lstatSync(lockPath);
    if (!s.isFile() || s.isSymbolicLink()) throw new Error();
  } catch {
    finding(report, 'warning', 'NPM_AUDIT_SKIPPED',
      'npm audit requires a regular package-lock.json file.');
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
        npm_config_fund: 'false',
      },
    },
  );
  if (result.error) {
    finding(report, 'error', 'NPM_AUDIT_EXECUTION_FAILED',
      result.error.code === 'ETIMEDOUT'
        ? 'npm audit timed out.'
        : 'npm audit could not be executed.');
    return;
  }
  let audit;
  try {
    audit = JSON.parse(result.stdout || '{}');
  } catch {
    finding(report, 'error', 'NPM_AUDIT_INVALID_OUTPUT',
      'npm audit did not return valid JSON output.');
    return;
  }
  const v = audit.metadata?.vulnerabilities || {};
  const counts = {
    critical: Number(v.critical || 0),
    high: Number(v.high || 0),
    moderate: Number(v.moderate || 0),
    low: Number(v.low || 0),
    info: Number(v.info || 0),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (result.status === 0 && total === 0) {
    finding(report, 'passed', 'NPM_AUDIT_PASSED',
      'npm audit found no production dependency vulnerabilities.');
  } else {
    finding(report, total > 0 ? 'warning' : 'error',
      'NPM_AUDIT_FINDINGS',
      `Production dependency audit summary: ${JSON.stringify(counts)}.`);
  }
}
function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`ARGUMENT ERROR: ${error.message}`);
    return EXIT.CONFIG;
  }
  if (options.help) {
    help();
    return EXIT.OK;
  }
  let root;
  try {
    root = fs.realpathSync(options.root);
    if (!fs.statSync(root).isDirectory()) {
      throw new Error('Root is not a directory.');
    }
  } catch {
    console.error('CONFIGURATION ERROR: Project root is inaccessible.');
    return EXIT.CONFIG;
  }
  const report = reportFactory(root, options);
  checkPackage(root, report);
  checkLockfile(root, report);
  checkGitIgnore(root, report);
  checkSensitiveFiles(root, report);
  checkSecrets(report);
  checkSecurityIndicators(root, report);
  if (options.audit) {
    runNpmAudit(root, report);
  } else {
    finding(report, 'skipped', 'NPM_AUDIT_NOT_REQUESTED',
      'Dependency audit was not run. Use --audit to request npm audit.');
  }
  const failed = report.summary.errors > 0 ||
    (options.strict && report.summary.warnings > 0);
  report.status = failed ? 'failed' : 'passed';
  report.exitCode = failed ? EXIT.FINDINGS : EXIT.OK;
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\nMedOrbits Security Configuration Check');
    console.log('='.repeat(50));
    for (const item of report.findings) {
      console.log(
        `[${item.level.toUpperCase()}] ${item.code}: ${item.message}` +
        `${item.file ? ` (${item.file})` : ''}`,
      );
    }
    console.log('\nSummary');
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Warnings: ${report.summary.warnings}`);
    console.log(`Errors: ${report.summary.errors}`);
    console.log(`Skipped: ${report.summary.skipped}`);
    console.log(`Result: ${report.status.toUpperCase()}`);
  }
  return report.exitCode;
}
try {
  process.exitCode = main();
} catch {
  console.error('FATAL ERROR: Security checker failed unexpectedly.');
  process.exitCode = EXIT.CONFIG;
}