
#!/usr/bin/env node

'use strict';

/**
 * MedOrbits -- Static Security Audit
 * ----------------------------------
 * File: scripts/check-security.mjs
 * Runtime: Node.js >= 20
 * Dependencies: None
 *
 * Checks:
 * - Exposed credentials and secret-like values in tracked project files.
 * - Accidental .env files and private key files.
 * - Unsafe environment configuration and hardcoded API keys.
 * - Common insecure JavaScript patterns.
 * - SQL injection risk patterns.
 * - Unsafe child-process execution patterns.
 * - Weak cryptographic and password-handling patterns.
 * - CORS wildcard and insecure cookie configuration patterns.
 * - HTTP URLs and disabled TLS verification.
 * - Sensitive files inside public website directories.
 * - Dependency declarations and lockfile presence.
 * - Git ignore coverage for common sensitive files.
 * - Oversized files and suspicious executable permissions where supported.
 *
 * Usage:
 *   node scripts/check-security.mjs
 *   node scripts/check-security.mjs --strict
 *   node scripts/check-security.mjs --root .
 *   node scripts/check-security.mjs --exclude uploads
 *   node scripts/check-security.mjs --include-hidden
 *   node scripts/check-security.mjs --json
 *
 * Exit codes:
 *   0 = no blocking findings
 *   1 = security findings detected
 *   2 = configuration or runtime failure
 *
 * Important:
 * - This is a heuristic static audit, not a penetration test.
 * - Findings require human review; matches can be false positives.
 * - Never print actual secret values in the report.
 * - No network requests are made.
 * - No project files are modified.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const DEFAULT_IGNORED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '__pycache__',
  '.cache',
  '.turbo',
  '.vercel',
  '.netlify',
  'vendor',
];

const MAX_FILE_SIZE_MB = 5;
const MAX_REPORTED_FINDINGS = 2000;

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.config',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.md',
  '.txt',
  '.sh',
  '.bash',
  '.sql',
  '.env',
  '.example',
  '.sample',
  '.xml',
  '.properties',
  '.pem',
  '.key',
  '.crt',
  '.cer',
]);

const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FINDINGS: 1,
  CONFIGURATION_ERROR: 2,
});

function printHelp() {
  console.log(`
MedOrbits Static Security Audit

Usage:
  node scripts/check-security.mjs [options]

Options:
  --root <directory>
      Project root. Defaults to the current working directory.

  --exclude <name>
      Exclude a directory by name. Can be repeated.

  --include-hidden
      Include hidden files and directories, except excluded directories.

  --strict
      Treat warnings as failures.

  --json
      Output a machine-readable JSON report.

  --help, -h
      Display this help.

Examples:
  node scripts/check-security.mjs
  node scripts/check-security.mjs --strict
  node scripts/check-security.mjs --root .
  node scripts/check-security.mjs --exclude uploads --exclude temp
  node scripts/check-security.mjs --include-hidden
  node scripts/check-security.mjs --json
`);
}

function parseArguments(args) {
  const options = {
    root: process.cwd(),
    strict: false,
    includeHidden: false,
    jsonOutput: false,
    excludedDirectories: new Set(DEFAULT_IGNORED_DIRECTORIES),
    errors: [],
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--strict') {
      options.strict = true;
      continue;
    }

    if (argument === '--include-hidden') {
      options.includeHidden = true;
      continue;
    }

    if (argument === '--json') {
      options.jsonOutput = true;
      continue;
    }

    if (argument === '--root') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        options.errors.push('--root requires a directory path.');
        continue;
      }

      options.root = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }

    if (argument === '--exclude') {
      const value = args[index + 1];

      if (!value || value.startsWith('--')) {
        options.errors.push('--exclude requires a directory name.');
        continue;
      }

      if (
        value === '.' ||
        value === '..' ||
        value.includes('/') ||
        value.includes('\\')
      ) {
        options.errors.push(
          `Invalid exclusion "${value}". Supply a directory name, not a path.`,
        );
        continue;
      }

      options.excludedDirectories.add(value);
      index += 1;
      continue;
    }

    options.errors.push(`Unknown option: ${argument}`);
  }

  return options;
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

function relative(root, target) {
  return path.relative(root, target).split(path.sep).join('/') || '.';
}

function addFinding(report, severity, code, file, line, message) {
  report.totalFindings += 1;

  if (severity === 'critical' || severity === 'high') {
    report.highRiskFindings += 1;
  }

  if (severity === 'critical') {
    report.criticalFindings += 1;
  }

  if (severity === 'high') {
    report.highFindings += 1;
  }

  if (severity === 'medium') {
    report.mediumFindings += 1;
  }

  if (severity === 'low') {
    report.lowFindings += 1;
  }

  if (severity === 'info') {
    report.infoFindings += 1;
  }

  if (report.findings.length < MAX_REPORTED_FINDINGS) {
    report.findings.push({
      severity,
      code,
      file: file || '.',
      line: line ?? null,
      message,
    });
  } else {
    report.omittedFindings += 1;
  }
}

function shouldSkipHidden(name, includeHidden) {
  return !includeHidden && name.startsWith('.') && name !== '.well-known';
}

function walkFiles(directory, options, report) {
  const files = [];

  function walk(currentDirectory) {
    report.directoriesVisited += 1;

    let entries;

    try {
      entries = fs.readdirSync(currentDirectory, {
        withFileTypes: true,
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      addFinding(
        report,
        'medium',
        'DIRECTORY_UNREADABLE',
        relative(options.root, currentDirectory),
        null,
        `Could not inspect directory: ${error.message}`,
      );

      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isSymbolicLink()) {
        report.symbolicLinksSkipped += 1;
        continue;
      }

      if (shouldSkipHidden(entry.name, options.includeHidden)) {
        report.pathsSkipped += 1;
        continue;
      }

      if (entry.isDirectory()) {
        if (options.excludedDirectories.has(entry.name)) {
          report.pathsSkipped += 1;
          continue;
        }

        walk(fullPath);
        continue;
      }

      if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(options.root);
  return files;
}

function isTextFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (TEXT_EXTENSIONS.has(extension)) {
    return true;
  }

  const basename = path.basename(filePath);

  return (
    basename === 'Dockerfile' ||
    basename === 'Makefile' ||
    basename === '.gitignore' ||
    basename === '.dockerignore' ||
    basename === '.npmrc' ||
    basename === '.nvmrc' ||
    basename === 'Procfile' ||
    basename === 'CODEOWNERS' ||
    basename === 'LICENSE'
  );
}

function readTextFile(filePath, options, report) {
  let stat;

  try {
    stat = fs.lstatSync(filePath);
  } catch (error) {
    addFinding(
      report,
      'medium',
      'FILE_STAT_FAILED',
      relative(options.root, filePath),
      null,
      `Could not inspect file: ${error.message}`,
    );

    return null;
  }

  if (!stat.isFile() || stat.isSymbolicLink()) {
    return null;
  }

  if (stat.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    report.largeFilesSkipped += 1;
    return null;
  }

  if (!isTextFile(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Avoid analyzing binary data interpreted as UTF-8.
    if (content.includes('\u0000')) {
      return null;
    }

    report.filesRead += 1;

    return {
      content,
      lines: content.split(/\r?\n/),
      relativePath: relative(options.root, filePath),
      absolutePath: filePath,
    };
  } catch (error) {
    addFinding(
      report,
      'medium',
      'FILE_READ_FAILED',
      relative(options.root, filePath),
      null,
      `Could not read file: ${error.message}`,
    );

    return null;
  }
}

function isPlaceholderSecret(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/["'`]/g, '');

  const placeholders = [
    '',
    'undefined',
    'null',
    'changeme',
    'change-me',
    'change_me',
    'your-secret',
    'your_secret',
    'your-api-key',
    'your_api_key',
    'replace-me',
    'replace_me',
    'example',
    'placeholder',
    'redacted',
    'xxx',
    'xxxx',
    'test',
    'dummy',
    'sample',
    'your_password',
    'your-password',
    'secret_here',
    'secret-here',
  ];

  return (
    placeholders.includes(normalized) ||
    normalized.includes('replace-with-') ||
    normalized.includes('insert-your-') ||
    normalized.includes('put-your-')
  );
}

function redactValue(value) {
  if (!value) {
    return '[redacted]';
  }

  return '[redacted]';
}

function scanSecretPatterns(document, report) {
  const { lines, relativePath } = document;
  const basename = path.basename(relativePath);

  const rules = [
    {
      code: 'PRIVATE_KEY_MATERIAL',
      severity: 'critical',
      pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
      message: 'Private key material appears in a project file. Remove it and rotate the key if it was exposed.',
    },
    {
      code: 'AWS_ACCESS_KEY_ID',
      severity: 'high',
      pattern: /\bAKIA[0-9A-Z]{16}\b/,
      message: 'A string resembling an AWS access key ID was detected. Verify and rotate if genuine.',
    },
    {
      code: 'GITHUB_TOKEN',
      severity: 'high',
      pattern: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
      message: 'A string resembling a GitHub token was detected. Revoke it if genuine.',
    },
    {
      code: 'SLACK_TOKEN',
      severity: 'high',
      pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
      message: 'A string resembling a Slack token was detected. Revoke it if genuine.',
    },
    {
      code: 'STRIPE_SECRET_KEY',
      severity: 'high',
      pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
      message: 'A string resembling a Stripe secret key was detected. Remove and rotate if genuine.',
    },
    {
      code: 'GOOGLE_API_KEY',
      severity: 'high',
      pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/,
      message: 'A string resembling a Google API key was detected. Restrict or rotate if genuine.',
    },
    {
      code: 'GENERIC_PRIVATE_CREDENTIAL',
      severity: 'high',
      pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'`][^"'`\r\n]{12,}["'`]/i,
      message: 'A possible hardcoded credential assignment was detected. Use environment variables or a secret manager.',
    },
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Example files often intentionally document environment variables.
    // Credential-specific patterns still run against these files.
    const isEnvExample =
      /\.env\.(?:example|sample|template)$/i.test(basename) ||
      /\.(?:example|sample)$/i.test(basename);

    for (const rule of rules) {
      if (!rule.pattern.test(line)) {
        continue;
      }

      if (
        rule.code === 'GENERIC_PRIVATE_CREDENTIAL' &&
        isEnvExample
      ) {
        const assignment = line.match(
          /[:=]\s*["'`]([^"'`]*)["'`]/,
        );

        if (assignment && isPlaceholderSecret(assignment[1])) {
          continue;
        }
      }

      addFinding(
        report,
        rule.severity,
        rule.code,
        relativePath,
        index + 1,
        rule.message,
      );
    }

    const genericAssignment = line.match(
      /^\s*(?:export\s+)?([A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*(.*?)\s*$/i,
    );

    if (genericAssignment) {
      const variableName = genericAssignment[1];
      let value = genericAssignment[2].trim();

      if (
        value.startsWith('"') ||
        value.startsWith("'") ||
        value.startsWith('`')
      ) {
        value = value.slice(1, -1);
      }

      if (
        value &&
        !value.startsWith('#') &&
        !value.startsWith('${') &&
        !value.startsWith('$') &&
        !isPlaceholderSecret(value)
      ) {
        const isEnvExample =
          /\.env\.(?:example|sample|template)$/i.test(basename);

        if (!isEnvExample) {
          addFinding(
            report,
            'high',
            'POSSIBLE_HARDCODED_SECRET',
            relativePath,
            index + 1,
            `Variable "${variableName}" appears to contain a literal secret (${redactValue(value)}).`,
          );
        }
      }
    }
  }
}

function scanInsecureCodePatterns(document, report) {
  const { lines, relativePath } = document;

  const rules = [
    {
      code: 'TLS_VERIFICATION_DISABLED',
      severity: 'high',
      pattern: /rejectUnauthorized\s*:\s*false/,
      message: 'TLS certificate verification is disabled. Do not use this in production.',
    },
    {
      code: 'NODE_TLS_REJECT_UNAUTHORIZED_DISABLED',
      severity: 'critical',
      pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0\b/,
      message: 'Node.js TLS certificate verification appears disabled.',
    },
    {
      code: 'EVAL_USAGE',
      severity: 'high',
      pattern: /\beval\s*\(/,
      message: 'eval() executes dynamic code and may introduce code-injection risk.',
    },
    {
      code: 'DYNAMIC_FUNCTION_CONSTRUCTOR',
      severity: 'high',
      pattern: /\bnew\s+Function\s*\(/,
      message: 'Dynamic Function construction can execute injected code.',
    },
    {
      code: 'UNSAFE_INNER_HTML',
      severity: 'medium',
      pattern: /\.innerHTML\s*=/,
      message: 'Assignment to innerHTML can introduce XSS if content is untrusted. Prefer textContent or safe DOM APIs.',
    },
    {
      code: 'DOCUMENT_WRITE',
      severity: 'medium',
      pattern: /\bdocument\.write\s*\(/,
      message: 'document.write() can create DOM injection and rendering risks.',
    },
    {
      code: 'UNSAFE_CHILD_PROCESS',
      severity: 'high',
      pattern: /\bexec\s*\(\s*(?:`[^`]*\$\{|[^)]*\+\s*[A-Za-z_$])/,
      message: 'A child-process command may contain dynamically concatenated input. Use execFile/spawn with argument arrays and validation.',
    },
    {
      code: 'SQL_STRING_CONCATENATION',
      severity: 'medium',
      pattern: /(?:query|execute)\s*\(\s*`[^`]*\$\{/i,
      message: 'SQL may be constructed using template interpolation. Use parameterized queries.',
    },
    {
      code: 'WEAK_PASSWORD_HASH',
      severity: 'medium',
      pattern: /\b(?:createHash|createHmac)\s*\(\s*['"](?:md5|sha1)['"]/i,
      message: 'MD5/SHA-1 usage detected in cryptographic code. Do not use these for password storage.',
    },
    {
      code: 'CORS_WILDCARD',
      severity: 'medium',
      pattern: /\bcors\s*\(\s*\{\s*origin\s*:\s*['"]\*['"]/i,
      message: 'CORS wildcard origin detected. Review whether cross-origin access should be restricted.',
    },
    {
      code: 'INSECURE_COOKIE',
      severity: 'medium',
      pattern: /\b(?:secure\s*:\s*false|httpOnly\s*:\s*false)\b/i,
      message: 'A cookie security option is explicitly disabled. Verify whether this is appropriate for the environment.',
    },
    {
      code: 'JWT_NONE_ALGORITHM',
      severity: 'high',
      pattern: /\balgorithm\s*:\s*['"]none['"]/i,
      message: 'JWT algorithm "none" is unsafe for signed authentication tokens.',
    },
    {
      code: 'HTTP_URL_LITERAL',
      severity: 'low',
      pattern: /https?:\/\/(?:[^/\s"'`]+)\//i,
      message: 'A literal HTTP/HTTPS URL was found. Verify that production endpoints use HTTPS.',
    },
  ];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    for (const rule of rules) {
      if (!rule.pattern.test(line)) {
        continue;
      }

      // Suppress generic HTTP URL findings for documentation and examples.
      if (
        rule.code === 'HTTP_URL_LITERAL' &&
        /\.(?:md|txt)$/i.test(relativePath)
      ) {
        continue;
      }

      addFinding(
        report,
        rule.severity,
        rule.code,
        relativePath,
        index + 1,
        rule.message,
      );
    }
  }
}

function scanSensitiveFiles(files, options, report) {
  const sensitiveNames = [
    /^\.env$/i,
    /^\.env\.(?!example$|sample$|template$)[^/]+$/i,
    /^id_rsa(?:\.pub)?$/i,
    /^id_ed25519(?:\.pub)?$/i,
    /^credentials(?:\.json)?$/i,
    /^service-account(?:-key)?\.json$/i,
    /^secrets?\.json$/i,
    /^private(?:-key)?\.(?:pem|key)$/i,
  ];

  const publicRoots = [
    path.join(options.root, 'public'),
    path.join(options.root, 'dist'),
    path.join(options.root, 'build'),
  ].filter(isDirectory);

  for (const filePath of files) {
    const basename = path.basename(filePath);
    const fileRelative = relative(options.root, filePath);
    const sensitiveName = sensitiveNames.some((pattern) =>
      pattern.test(basename),
    );

    if (sensitiveName) {
      addFinding(
        report,
        'high',
        'SENSITIVE_FILE_PRESENT',
        fileRelative,
        null,
        'A file with a sensitive filename was found. Verify that it contains no production credentials and is not committed or publicly deployed.',
      );
    }

    for (const publicRoot of publicRoots) {
      if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
        continue;
      }

      if (
        sensitiveName ||
        /\.(?:pem|key|p12|pfx|keystore|jks)$/i.test(basename) ||
        /(?:^|[._-])(?:secrets?|credentials?)(?:[._-]|$)/i.test(basename)
      ) {
        addFinding(
          report,
          'critical',
          'SENSITIVE_FILE_IN_PUBLIC_DIRECTORY',
          fileRelative,
          null,
          'A potentially sensitive file exists in a public deployment directory. Remove it from the public build unless exposure is intentional and verified safe.',
        );
      }

      break;
    }
  }
}

function scanEnvironmentConfiguration(files, options, report) {
  const gitignorePath = path.join(options.root, '.gitignore');
  let gitignore = '';

  if (isFile(gitignorePath)) {
    try {
      gitignore = fs.readFileSync(gitignorePath, 'utf8');
    } catch {
      // The general file scanner will report a read failure if applicable.
    }
  }

  const normalizedRules = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const ignoresEnv =
    normalizedRules.some((rule) =>
      rule === '.env' ||
      rule === '.env*' ||
      rule === '.env.*' ||
      rule === '**/.env' ||
      rule === '**/.env.*' ||
      rule === '.env/',
    );

  if (!ignoresEnv) {
    addFinding(
      report,
      'medium',
      'ENV_NOT_IGNORED',
      '.gitignore',
      null,
      'No obvious .env ignore rule was found. Add rules for environment files while keeping safe example templates tracked.',
    );
  }

  const packageJsonPath = path.join(options.root, 'package.json');
  const lockfiles = [
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
  ];

  if (isFile(packageJsonPath)) {
    const presentLockfiles = lockfiles.filter((name) =>
      isFile(path.join(options.root, name)),
    );

    if (presentLockfiles.length === 0) {
      addFinding(
        report,
        'low',
        'LOCKFILE_MISSING',
        'package.json',
        null,
        'No common package-manager lockfile was found. A lockfile improves dependency reproducibility.',
      );
    }
  }

  const packageLockPath = path.join(options.root, 'package-lock.json');

  if (isFile(packageLockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

      if (
        lock.lockfileVersion !== undefined &&
        ![1, 2, 3].includes(lock.lockfileVersion)
      ) {
        addFinding(
          report,
          'low',
          'UNUSUAL_LOCKFILE_VERSION',
          'package-lock.json',
          null,
          'Unrecognized npm lockfile version. Verify compatibility with the project npm version.',
        );
      }
    } catch {
      addFinding(
        report,
        'high',
        'INVALID_PACKAGE_LOCK',
        'package-lock.json',
        null,
        'package-lock.json is not valid JSON. Run npm install to regenerate it after reviewing dependency changes.',
      );
    }
  }

  if (options.includeHidden) {
    report.hiddenPathsIncluded = true;
  }

  // Keep the files argument in the function contract so additional
  // environment checks can be added without changing the call structure.
  void files;
}

function scanExecutablePermissions(files, options, report) {
  if (process.platform === 'win32') {
    return;
  }

  for (const filePath of files) {
    let stat;

    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    const executableBits = stat.mode & 0o111;

    if (
      executableBits &&
      /\.(?:env|json|pem|key|p12|pfx)$/i.test(filePath)
    ) {
      addFinding(
        report,
        'medium',
        'SENSITIVE_FILE_EXECUTABLE',
        relative(options.root, filePath),
        null,
        'A sensitive-looking file has executable permission bits. Review and restrict permissions where appropriate.',
      );
    }
  }
}

function printReport(report, options, elapsedMs) {
  const failed =
    report.criticalFindings > 0 ||
    report.highFindings > 0 ||
    (options.strict && (report.errors > 0 || report.warnings > 0));

  const result = {
    tool: 'MedOrbits Static Security Audit',
    version: 1,
    root: options.root,
    strict: options.strict,
    durationMs: Number(elapsedMs.toFixed(2)),
    summary: {
      filesDiscovered: report.filesDiscovered,
      filesRead: report.filesRead,
      directoriesVisited: report.directoriesVisited,
      pathsSkipped: report.pathsSkipped,
      symbolicLinksSkipped: report.symbolicLinksSkipped,
      largeFilesSkipped: report.largeFilesSkipped,
      criticalFindings: report.criticalFindings,
      highFindings: report.highFindings,
      mediumFindings: report.mediumFindings,
      lowFindings: report.lowFindings,
      infoFindings: report.infoFindings,
      totalFindings: report.totalFindings,
      omittedFindings: report.omittedFindings,
    },
    findings: report.findings,
    result: failed ? 'failed' : 'passed',
    exitCode: failed
      ? EXIT_CODES.FINDINGS
      : EXIT_CODES.SUCCESS,
  };

  if (options.jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return result.exitCode;
  }

  console.log('');
  console.log('MedOrbits Security Audit');
  console.log('='.repeat(52));
  console.log(`Project root:          ${options.root}`);
  console.log(`Strict mode:           ${options.strict ? 'enabled' : 'disabled'}`);
  console.log(`Files discovered:      ${report.filesDiscovered}`);
  console.log(`Text files analyzed:   ${report.filesRead}`);
  console.log(`Directories visited:   ${report.directoriesVisited}`);
  console.log(`Paths skipped:         ${report.pathsSkipped}`);
  console.log(`Symbolic links skipped:${String(report.symbolicLinksSkipped).padStart(7)}`);
  console.log(`Large files skipped:   ${report.largeFilesSkipped}`);
  console.log('');
  console.log('Findings');
  console.log('-'.repeat(52));
  console.log(`Critical:              ${report.criticalFindings}`);
  console.log(`High:                  ${report.highFindings}`);
  console.log(`Medium:                ${report.mediumFindings}`);
  console.log(`Low:                   ${report.lowFindings}`);
  console.log(`Informational:         ${report.infoFindings}`);
  console.log(`Total:                 ${report.totalFindings}`);
  console.log(`Duration:              ${elapsedMs.toFixed(2)} ms`);

  if (report.findings.length > 0) {
    console.log('');
    console.log('Details');
    console.log('-'.repeat(52));

    for (const finding of report.findings) {
      const location = finding.line ? `:${finding.line}` : '';

      console.log(
        `[${finding.severity.toUpperCase().padEnd(8)}] ${finding.code} -- ${finding.file}${location}`,
      );

      console.log(`           ${finding.message}`);
    }
  } else {
    console.log('');
    console.log('No heuristic security findings detected.');
  }

  if (report.omittedFindings > 0) {
    console.log('');
    console.log(
      `${report.omittedFindings} additional finding(s) omitted.`,
    );
  }

  console.log('');
  console.log('Final result');
  console.log('-'.repeat(52));

  if (failed) {
    console.error('FAILED: Review and resolve high-risk findings before release.');
  } else {
    console.log('PASSED: No critical or high-risk findings were detected.');

    if (report.totalFindings > 0) {
      console.log('Review medium and low findings before production deployment.');
    }
  }

  console.log('');
  return result.exitCode;
}

function main() {
  const startedAt = performance.now();
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return EXIT_CODES.SUCCESS;
  }

  if (options.errors.length > 0) {
    for (const error of options.errors) {
      console.error(`ARGUMENT ERROR: ${error}`);
    }

    console.error('Run with --help for usage information.');
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  try {
    options.root = fs.realpathSync(options.root);
  } catch (error) {
    console.error(
      `ROOT ERROR: Cannot resolve "${options.root}": ${error.message}`,
    );

    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  if (!isDirectory(options.root)) {
    console.error(`ROOT ERROR: "${options.root}" is not a directory.`);
    return EXIT_CODES.CONFIGURATION_ERROR;
  }

  const report = {
    filesDiscovered: 0,
    filesRead: 0,
    directoriesVisited: 0,
    pathsSkipped: 0,
    symbolicLinksSkipped: 0,
    largeFilesSkipped: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0,
    infoFindings: 0,
    highRiskFindings: 0,
    totalFindings: 0,
    omittedFindings: 0,
    findings: [],
    hiddenPathsIncluded: false,
  };

  const files = walkFiles(options.root, options, report);
  report.filesDiscovered = files.length;

  for (const filePath of files) {
    const document = readTextFile(filePath, options, report);

    if (!document) {
      continue;
    }

    scanSecretPatterns(document, report);
    scanInsecureCodePatterns(document, report);
  }

  scanSensitiveFiles(files, options, report);
  scanEnvironmentConfiguration(files, options, report);
  scanExecutablePermissions(files, options, report);

  const elapsedMs = performance.now() - startedAt;

  return printReport(
    report,
    options,
    elapsedMs,
  );
}

try {
  process.exitCode = main();
} catch (error) {
  console.error('FATAL ERROR: Unexpected security audit failure.');

  if (error instanceof Error) {
    console.error(error.stack || error.message);
  } else {
    console.error(String(error));
  }

  process.exitCode = EXIT_CODES.CONFIGURATION_ERROR;
}
