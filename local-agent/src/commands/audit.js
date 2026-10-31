
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/commands/audit.js
 * Purpose: Safely audit repository structure, file inventory, references,
 *          configuration, and common security risks.
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins and the local-agent safety modules.
 *
 * Safety:
 * - Read-only by default.
 * - Never executes repository code.
 * - Never reads file contents from protected paths.
 * - Never prints secret values.
 * - Restricts all audit paths to the configured repository root.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const AUDIT_VERSION = '1.0.0';

const DEFAULTS = Object.freeze({
  maxFiles: 5000,
  maxDepth: 12,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFindings: 1000,
  includeHidden: false,
  hashFiles: false,
  checkReferences: true,
  checkSecrets: true,
  checkSyntax: true
});

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  '.nuxt',
  'dist',
  'build',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.cache'
]);

const PROTECTED_SEGMENTS = new Set([
  '.ssh',
  '.aws',
  '.azure',
  '.config',
  'credentials',
  'secrets',
  'private'
]);

const SECRET_FILENAME_PATTERN =
  /(^|\.)(\.env($|\.)|id_rsa|id_ed25519|credentials|secrets?|private[-_.]?key|service[-_.]?account)/i;

const SECRET_CONTENT_PATTERNS = [
  {
    id: 'private-key',
    severity: 'critical',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/
  },
  {
    id: 'generic-api-key-assignment',
    severity: 'high',
    pattern: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{20,}/i
  },
  {
    id: 'jwt-like-token',
    severity: 'medium',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/
  },
  {
    id: 'database-url-with-credentials',
    severity: 'high',
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s/]+@/i
  },
  {
    id: 'cloud-access-key',
    severity: 'high',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/
  }
];

const REFERENCE_EXTENSIONS = new Set([
  '.html',
  '.htm',
  '.css',
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '.py',
  '.yml',
  '.yaml',
  '.md',
  '.xml',
  '.svg'
]);

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '.py'
]);

class AuditError extends Error {
  constructor(message, code = 'AUDIT_ERROR', options = {}) {
    super(message, options);
    this.name = 'AuditError';
    this.code = code;
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateOptions(options = {}) {
  if (!isPlainObject(options)) {
    throw new AuditError('Options must be a plain object.', 'INVALID_OPTIONS');
  }

  const result = { ...DEFAULTS, ...options };

  for (const key of ['maxFiles', 'maxDepth', 'maxFileBytes', 'maxTotalBytes', 'maxFindings']) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 1) {
      throw new AuditError(`${key} must be a positive safe integer.`, 'INVALID_OPTIONS');
    }
  }

  for (const key of [
    'includeHidden',
    'hashFiles',
    'checkReferences',
    'checkSecrets',
    'checkSyntax'
  ]) {
    if (typeof result[key] !== 'boolean') {
      throw new AuditError(`${key} must be a boolean.`, 'INVALID_OPTIONS');
    }
  }

  return result;
}

function canonicalRoot(root) {
  if (typeof root !== 'string' || !root.trim()) {
    throw new AuditError('A repository root is required.', 'INVALID_ROOT');
  }

  let resolved;

  try {
    resolved = fs.realpathSync(path.resolve(root));
  } catch (error) {
    throw new AuditError(
      'Repository root does not exist or cannot be accessed.',
      'INVALID_ROOT',
      { cause: error }
    );
  }

  const stat = fs.statSync(resolved);

  if (!stat.isDirectory()) {
    throw new AuditError('Repository root must be a directory.', 'INVALID_ROOT');
  }

  return resolved;
}

function isInsideRoot(root, target) {
  const relative = path.relative(root, target);

  return relative === '' ||
    (!path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`));
}

function safeRelativePath(root, target) {
  const relative = path.relative(root, target);

  if (!isInsideRoot(root, target)) {
    throw new AuditError('Path escapes the repository root.', 'PATH_ESCAPE');
  }

  return relative.split(path.sep).join('/');
}

function isProtectedPath(relativePath) {
  const segments = relativePath.split('/').filter(Boolean);

  return segments.some((segment) => {
    const normalized = segment.toLowerCase();

    return PROTECTED_SEGMENTS.has(normalized) ||
      normalized === '.env' ||
      normalized.startsWith('.env.') ||
      SECRET_FILENAME_PATTERN.test(segment);
  });
}

function isExcludedDirectory(name, options) {
  if (!options.includeHidden && name.startsWith('.')) {
    return true;
  }

  return EXCLUDED_DIRECTORIES.has(name.toLowerCase());
}

function addFinding(findings, options, finding) {
  if (findings.length >= options.maxFindings) return;

  findings.push({
    id: finding.id || 'AUDIT_FINDING',
    severity: finding.severity || 'low',
    path: finding.path || '',
    message: finding.message || 'Audit finding.',
    ...(finding.line ? { line: finding.line } : {}),
    ...(finding.recommendation
      ? { recommendation: finding.recommendation }
      : {})
  });
}

function walkRepository(root, options, findings) {
  const files = [];
  const visitedDirectories = new Set();

  let totalBytes = 0;
  let truncated = false;

  function walk(directory, depth) {
    if (truncated || depth > options.maxDepth) {
      if (depth > options.maxDepth) {
        addFinding(findings, options, {
          id: 'MAX_DEPTH_REACHED',
          severity: 'low',
          path: safeRelativePath(root, directory),
          message: 'Directory traversal stopped at the configured depth limit.'
        });
      }
      return;
    }

    let realDirectory;

    try {
      realDirectory = fs.realpathSync(directory);
    } catch {
      addFinding(findings, options, {
        id: 'DIRECTORY_UNREADABLE',
        severity: 'low',
        path: safeRelativePath(root, directory),
        message: 'Directory could not be resolved or accessed.'
      });
      return;
    }

    if (!isInsideRoot(root, realDirectory)) {
      addFinding(findings, options, {
        id: 'DIRECTORY_SYMLINK_ESCAPE',
        severity: 'high',
        path: safeRelativePath(root, directory),
        message: 'Directory resolves outside the repository and was skipped.'
      });
      return;
    }

    if (visitedDirectories.has(realDirectory)) return;
    visitedDirectories.add(realDirectory);

    let entries;

    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      addFinding(findings, options, {
        id: 'DIRECTORY_UNREADABLE',
        severity: 'low',
        path: safeRelativePath(root, directory),
        message: 'Directory could not be listed.'
      });
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncated) return;

      if (!options.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = safeRelativePath(root, absolutePath);

      if (isProtectedPath(relativePath)) {
        if (SECRET_FILENAME_PATTERN.test(entry.name)) {
          addFinding(findings, options, {
            id: 'SENSITIVE_FILENAME',
            severity: 'medium',
            path: relativePath,
            message: 'A potentially sensitive filename exists; its contents were not inspected.',
            recommendation: 'Ensure this file is excluded from version control and access-controlled.'
          });
        }
        continue;
      }

      let stat;

      try {
        stat = fs.lstatSync(absolutePath);
      } catch {
        addFinding(findings, options, {
          id: 'FILE_STAT_FAILED',
          severity: 'low',
          path: relativePath,
          message: 'File metadata could not be inspected.'
        });
        continue;
      }

      if (stat.isSymbolicLink()) {
        let realTarget;

        try {
          realTarget = fs.realpathSync(absolutePath);
        } catch {
          addFinding(findings, options, {
            id: 'BROKEN_SYMLINK',
            severity: 'low',
            path: relativePath,
            message: 'Symbolic link is broken or inaccessible.'
          });
          continue;
        }

        if (!isInsideRoot(root, realTarget)) {
          addFinding(findings, options, {
            id: 'SYMLINK_ESCAPE',
            severity: 'high',
            path: relativePath,
            message: 'Symbolic link points outside the repository and was not followed.',
            recommendation: 'Remove the link or ensure it targets an approved repository path.'
          });
        } else {
          addFinding(findings, options, {
            id: 'SYMLINK_SKIPPED',
            severity: 'info',
            path: relativePath,
            message: 'Symbolic link was not followed during this audit.'
          });
        }

        continue;
      }

      if (stat.isDirectory()) {
        if (isExcludedDirectory(entry.name, options)) continue;
        walk(absolutePath, depth + 1);
        continue;
      }

      if (!stat.isFile()) continue;

      if (files.length >= options.maxFiles) {
        truncated = true;
        addFinding(findings, options, {
          id: 'MAX_FILES_REACHED',
          severity: 'medium',
          path: relativePath,
          message: 'File inventory stopped at the configured file limit.'
        });
        return;
      }

      const record = {
        path: relativePath,
        extension: path.extname(entry.name).toLowerCase(),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        bytesRead: 0
      };

      files.push(record);

      if (stat.size > options.maxFileBytes) {
        addFinding(findings, options, {
          id: 'FILE_TOO_LARGE',
          severity: 'low',
          path: relativePath,
          message: `File exceeds the ${options.maxFileBytes}-byte inspection limit.`
        });
        continue;
      }

      if (totalBytes + stat.size > options.maxTotalBytes) {
        truncated = true;
        addFinding(findings, options, {
          id: 'MAX_TOTAL_BYTES_REACHED',
          severity: 'medium',
          path: relativePath,
          message: 'Content inspection stopped at the configured total-byte limit.'
        });
        continue;
      }

      totalBytes += stat.size;
    }
  }

  walk(root, 0);

  return { files, totalBytes, truncated };
}

function readTextFile(root, relativePath, maxBytes) {
  const absolutePath = path.resolve(root, relativePath);

  if (!isInsideRoot(root, absolutePath)) {
    throw new AuditError('File path escapes repository root.', 'PATH_ESCAPE');
  }

  if (isProtectedPath(relativePath)) {
    throw new AuditError('Protected paths cannot be read.', 'PROTECTED_PATH');
  }

  // Re-check the resolved target immediately before reading.
  const realPath = fs.realpathSync(absolutePath);

  if (!isInsideRoot(root, realPath)) {
    throw new AuditError('Resolved file escapes repository root.', 'PATH_ESCAPE');
  }

  const stat = fs.statSync(realPath);

  if (!stat.isFile() || stat.size > maxBytes) {
    throw new AuditError('File is not eligible for content inspection.', 'FILE_LIMIT');
  }

  const buffer = fs.readFileSync(realPath);

  // Skip likely binary files.
  if (buffer.includes(0)) return null;

  return buffer.toString('utf8');
}

function inspectSecrets(root, files, options, findings) {
  if (!options.checkSecrets) return;

  for (const file of files) {
    if (findings.length >= options.maxFindings) return;
    if (isProtectedPath(file.path)) continue;

    const baseName = path.posix.basename(file.path);

    if (SECRET_FILENAME_PATTERN.test(baseName)) {
      addFinding(findings, options, {
        id: 'SENSITIVE_FILENAME',
        severity: 'medium',
        path: file.path,
        message: 'Potentially sensitive filename detected; contents were not inspected.'
      });
      continue;
    }

    if (!REFERENCE_EXTENSIONS.has(file.extension)) continue;

    let content;

    try {
      content = readTextFile(root, file.path, options.maxFileBytes);
    } catch {
      continue;
    }

    if (content === null) continue;

    file.bytesRead = Buffer.byteLength(content, 'utf8');

    const lines = content.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      for (const rule of SECRET_CONTENT_PATTERNS) {
        if (!rule.pattern.test(line)) continue;

        addFinding(findings, options, {
          id: `POSSIBLE_SECRET_${rule.id.toUpperCase().replace(/-/g, '_')}`,
          severity: rule.severity,
          path: file.path,
          line: index + 1,
          message: `Potential secret pattern detected (${rule.id}); matched content was not recorded.`,
          recommendation: 'Remove exposed credentials, rotate them if real, and use environment variables or a secret manager.'
        });
      }
    }
  }
}

function inspectReferences(root, files, options, findings) {
  if (!options.checkReferences) return;

  const knownPaths = new Set(files.map((file) => file.path));
  const referencePattern =
    /(?:require\s*\(\s*|from\s+|import\s*\(\s*|src\s*=\s*["']|href\s*=\s*["'])(\.{1,2}\/[^"'()\s]+|\/assets\/[^"'()\s]+)/g;

  for (const file of files) {
    if (findings.length >= options.maxFindings) return;
    if (!REFERENCE_EXTENSIONS.has(file.extension)) continue;
    if (isProtectedPath(file.path)) continue;

    let content;

    try {
      content = readTextFile(root, file.path, options.maxFileBytes);
    } catch {
      continue;
    }

    if (content === null) continue;

    const matches = content.matchAll(referencePattern);

    for (const match of matches) {
      const reference = match[1].split(/[?#]/, 1)[0];
      if (!reference || reference.startsWith('/assets/')) {
        if (reference && !knownPaths.has(reference.slice(1))) {
          addFinding(findings, options, {
            id: 'POSSIBLE_MISSING_ASSET',
            severity: 'low',
            path: file.path,
            message: 'An absolute /assets reference may not match an inventoried file.',
            recommendation: 'Verify the asset path and deployment base URL.'
          });
        }
        continue;
      }

      const base = path.posix.dirname(file.path);
      const resolved = path.posix.normalize(path.posix.join(base, reference));

      if (resolved === '..' || resolved.startsWith('../')) {
        addFinding(findings, options, {
          id: 'REFERENCE_OUTSIDE_ROOT',
          severity: 'medium',
          path: file.path,
          message: 'A relative reference appears to escape the repository root.',
          recommendation: 'Verify the path is intentional and resolve assets within the repository.'
        });
        continue;
      }

      const candidates = [
        resolved,
        `${resolved}.js`,
        `${resolved}.json`,
        `${resolved}.css`,
        `${resolved}.html`,
        path.posix.join(resolved, 'index.js'),
        path.posix.join(resolved, 'index.json')
      ];

      if (!candidates.some((candidate) => knownPaths.has(candidate))) {
        addFinding(findings, options, {
          id: 'POSSIBLE_MISSING_REFERENCE',
          severity: 'low',
          path: file.path,
          message: 'A relative file reference could not be matched to the inventory.',
          recommendation: 'Confirm the referenced file exists and is included in the repository.'
        });
      }
    }
  }
}

function inspectConfiguration(files, options, findings) {
  const names = new Set(files.map((file) => file.path));

  const expectedFiles = [
    'package.json',
    'README.md'
  ];

  for (const name of expectedFiles) {
    if (!names.has(name)) {
      addFinding(findings, options, {
        id: 'EXPECTED_FILE_MISSING',
        severity: 'low',
        path: name,
        message: `Expected repository file "${name}" was not found at the root.`,
        recommendation: 'Add the file if required by the project.'
      });
    }
  }

  const packageFile = files.find((file) => file.path === 'package.json');

  if (packageFile) {
    let content;

    try {
      content = readTextFile(
        process.env.MEDORBITS_REPO_ROOT
          ? canonicalRoot(process.env.MEDORBITS_REPO_ROOT)
          : process.cwd(),
        packageFile.path,
        options.maxFileBytes
      );
    } catch {
      // The caller may supply a repository root different from process.cwd().
      content = null;
    }

    if (content !== null) {
      try {
        const packageJson = JSON.parse(content);

        if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
          addFinding(findings, options, {
            id: 'PACKAGE_SCRIPTS_MISSING',
            severity: 'info',
            path: 'package.json',
            message: 'No scripts object was found in package.json.'
          });
        }

        if (!packageJson.engines || !packageJson.engines.node) {
          addFinding(findings, options, {
            id: 'NODE_ENGINE_UNDECLARED',
            severity: 'low',
            path: 'package.json',
            message: 'Node.js engine compatibility is not declared.',
            recommendation: 'Declare a supported Node.js version in package.json.'
          });
        }
      } catch {
        addFinding(findings, options, {
          id: 'PACKAGE_JSON_INVALID',
          severity: 'high',
          path: 'package.json',
          message: 'package.json could not be parsed as valid JSON.'
        });
      }
    }
  }
}

function inspectSyntax(root, files, options, findings) {
  if (!options.checkSyntax) return;

  for (const file of files) {
    if (findings.length >= options.maxFindings) return;
    if (isProtectedPath(file.path)) continue;

    if (file.extension === '.json') {
      let content;

      try {
        content = readTextFile(root, file.path, options.maxFileBytes);
      } catch {
        continue;
      }

      if (content === null) continue;

      try {
        JSON.parse(content);
      } catch {
        addFinding(findings, options, {
          id: 'INVALID_JSON',
          severity: 'high',
          path: file.path,
          message: 'JSON syntax validation failed.',
          recommendation: 'Validate the JSON syntax and required schema.'
        });
      }
    }
  }
}

function sha256File(root, relativePath, maxBytes) {
  const content = readTextFile(root, relativePath, maxBytes);
  if (content === null) return null;

  return crypto.createHash('sha256').update(content).digest('hex');
}

function severityCounts(findings) {
  const counts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const finding of findings) {
    if (Object.prototype.hasOwnProperty.call(counts, finding.severity)) {
      counts[finding.severity] += 1;
    }
  }

  return counts;
}

function auditRepository(rootPath, inputOptions = {}) {
  const options = validateOptions(inputOptions);
  const root = canonicalRoot(rootPath);
  const findings = [];

  const inventory = walkRepository(root, options, findings);

  inspectConfiguration(inventory.files, options, findings);
  inspectSyntax(root, inventory.files, options, findings);
  inspectSecrets(root, inventory.files, options, findings);
  inspectReferences(root, inventory.files, options, findings);

  if (options.hashFiles) {
    for (const file of inventory.files) {
      if (findings.length >= options.maxFindings) break;
      if (isProtectedPath(file.path)) continue;

      try {
        file.sha256 = sha256File(root, file.path, options.maxFileBytes);
      } catch {
        addFinding(findings, options, {
          id: 'HASH_FAILED',
          severity: 'low',
          path: file.path,
          message: 'File hash could not be calculated.'
        });
      }
    }
  }

  findings.sort((a, b) => {
    const severityOrder = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4
    };

    return (severityOrder[a.severity] ?? 5) -
      (severityOrder[b.severity] ?? 5) ||
      a.path.localeCompare(b.path) ||
      a.id.localeCompare(b.id);
  });

  return {
    version: AUDIT_VERSION,
    generatedAt: new Date().toISOString(),
    root,
    mode: 'read-only',
    summary: {
      filesInventoried: inventory.files.length,
      contentBytesBudgeted: inventory.totalBytes,
      inventoryTruncated: inventory.truncated,
      findings: findings.length,
      bySeverity: severityCounts(findings)
    },
    findings,
    files: inventory.files
  };
}

function formatAuditReport(report) {
  if (!report || typeof report !== 'object' || !report.summary) {
    throw new AuditError('A valid audit report is required.', 'INVALID_REPORT');
  }

  const lines = [
    `MedOrbits Repository Audit v${report.version}`,
    `Generated: ${report.generatedAt}`,
    `Root: ${report.root}`,
    `Mode: ${report.mode}`,
    '',
    'Summary',
    `  Files inventoried: ${report.summary.filesInventoried}`,
    `  Findings: ${report.summary.findings}`,
    `  Critical: ${report.summary.bySeverity.critical}`,
    `  High: ${report.summary.bySeverity.high}`,
    `  Medium: ${report.summary.bySeverity.medium}`,
    `  Low: ${report.summary.bySeverity.low}`,
    `  Info: ${report.summary.bySeverity.info}`,
    '',
    'Findings'
  ];

  if (report.findings.length === 0) {
    lines.push('  No findings detected by the enabled checks.');
  } else {
    for (const finding of report.findings) {
      const location = finding.line
        ? `${finding.path}:${finding.line}`
        : finding.path;

      lines.push(
        `  [${finding.severity.toUpperCase()}] ${finding.id} ${location}`,
        `    ${finding.message}`
      );

      if (finding.recommendation) {
        lines.push(`    Recommendation: ${finding.recommendation}`);
      }
    }
  }

  return lines.join('\n');
}

function parseArguments(args = []) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new AuditError('Arguments must be an array of strings.', 'INVALID_ARGUMENTS');
  }

  const options = {};
  let root = process.env.MEDORBITS_REPO_ROOT || process.cwd();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--root') {
      if (!args[index + 1]) {
        throw new AuditError('--root requires a directory path.', 'INVALID_ARGUMENTS');
      }
      root = args[++index];
    } else if (arg === '--max-files') {
      options.maxFiles = Number(args[++index]);
    } else if (arg === '--max-depth') {
      options.maxDepth = Number(args[++index]);
    } else if (arg === '--hash') {
      options.hashFiles = true;
    } else if (arg === '--include-hidden') {
      options.includeHidden = true;
    } else if (arg === '--no-secrets') {
      options.checkSecrets = false;
    } else if (arg === '--no-references') {
      options.checkReferences = false;
    } else if (arg === '--no-syntax') {
      options.checkSyntax = false;
    } else if (arg === '--json') {
      options.output = 'json';
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new AuditError(`Unknown argument: ${arg}`, 'INVALID_ARGUMENTS');
    }
  }

  return { root, options };
}

function printHelp() {
  return [
    'Usage: node local-agent/src/commands/audit.js [options]',
    '',
    'Options:',
    '  --root <path>       Repository root (default: MEDORBITS_REPO_ROOT or cwd)',
    '  --max-files <n>     Maximum inventory files',
    '  --max-depth <n>     Maximum directory depth',
    '  --hash              Include SHA-256 hashes for eligible files',
    '  --include-hidden    Include hidden paths except protected paths',
    '  --no-secrets        Disable content-based secret checks',
    '  --no-references     Disable reference checks',
    '  --no-syntax         Disable JSON syntax checks',
    '  --json              Print machine-readable JSON',
    '  --help, -h          Show this help',
    '',
    'The audit is read-only and does not execute repository code.'
  ].join('\n');
}

function runAuditCommand(args = [], dependencies = {}) {
  const logger = dependencies.logger || console;
  const parsed = parseArguments(args);

  if (parsed.options.help) {
    logger.log(printHelp());
    return { exitCode: 0, help: true };
  }

  const report = auditRepository(parsed.root, parsed.options);

  if (parsed.options.output === 'json') {
    logger.log(JSON.stringify(report, null, 2));
  } else {
    logger.log(formatAuditReport(report));
  }

  const severity = report.summary.bySeverity;

  return {
    exitCode: severity.critical > 0 || severity.high > 0 ? 1 : 0,
    report
  };
}

if (require.main === module) {
  try {
    const result = runAuditCommand(process.argv.slice(2));
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`[audit] ${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = {
  AUDIT_VERSION,
  AuditError,
  DEFAULTS,
  EXCLUDED_DIRECTORIES,
  auditRepository,
  formatAuditReport,
  isInsideRoot,
  isProtectedPath,
  parseArguments,
  printHelp,
  runAuditCommand,
  validateOptions
};
