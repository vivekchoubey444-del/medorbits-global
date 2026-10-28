
'use strict';

/**
 * MedOrbits Local Agent
 * File: /local-agent/src/commands/check.js
 * Version: 1.0.0
 *
 * Purpose:
 *   Perform read-only repository health checks:
 *   - Required project files and directories
 *   - JSON syntax and package.json validation
 *   - JavaScript syntax using Node.js --check
 *   - Python syntax using Python's AST parser when available
 *   - Local-agent configuration and security indicators
 *
 * Runtime: Node.js 20+
 * Dependencies: Node.js built-ins only.
 *
 * Security:
 *   - Never executes repository application code.
 *   - Never installs dependencies.
 *   - Never modifies inspected files.
 *   - All inspected paths remain inside the repository root.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK_VERSION = '1.0.0';

const DEFAULTS = Object.freeze({
  maxFiles: 3000,
  maxDepth: 12,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 30 * 1024 * 1024,
  maxCommandOutputBytes: 64 * 1024,
  timeoutMs: 10_000,
  checkJavaScript: true,
  checkPython: true,
  checkJson: true,
  checkRequiredFiles: true,
  checkSecurityIndicators: true
});

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache'
]);

const REQUIRED_FILES = Object.freeze([
  'package.json',
  'README.md'
]);

const REQUIRED_DIRECTORIES = Object.freeze([
  'local-agent',
  'local-agent/src'
]);

const PROTECTED_SEGMENTS = new Set([
  '.ssh',
  '.aws',
  '.azure',
  'credentials',
  'secrets',
  'private'
]);

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.cjs',
  '.mjs',
  '.json',
  '.py'
]);

class CheckError extends Error {
  constructor(message, code = 'CHECK_ERROR', options = {}) {
    super(message, options);
    this.name = 'CheckError';
    this.code = code;
  }
}

function validateOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new CheckError('Options must be an object.', 'INVALID_OPTIONS');
  }

  const config = { ...DEFAULTS, ...options };

  for (const key of [
    'maxFiles',
    'maxDepth',
    'maxFileBytes',
    'maxTotalBytes',
    'maxCommandOutputBytes',
    'timeoutMs'
  ]) {
    if (!Number.isSafeInteger(config[key]) || config[key] < 1) {
      throw new CheckError(`${key} must be a positive integer.`, 'INVALID_OPTIONS');
    }
  }

  for (const key of [
    'checkJavaScript',
    'checkPython',
    'checkJson',
    'checkRequiredFiles',
    'checkSecurityIndicators'
  ]) {
    if (typeof config[key] !== 'boolean') {
      throw new CheckError(`${key} must be a boolean.`, 'INVALID_OPTIONS');
    }
  }

  return config;
}

function canonicalRoot(rootPath) {
  if (typeof rootPath !== 'string' || !rootPath.trim()) {
    throw new CheckError('Repository root is required.', 'INVALID_ROOT');
  }

  let root;

  try {
    root = fs.realpathSync(path.resolve(rootPath));
  } catch (error) {
    throw new CheckError(
      'Repository root does not exist or cannot be accessed.',
      'INVALID_ROOT',
      { cause: error }
    );
  }

  if (!fs.statSync(root).isDirectory()) {
    throw new CheckError('Repository root must be a directory.', 'INVALID_ROOT');
  }

  return root;
}

function isInsideRoot(root, target) {
  const relative = path.relative(root, target);

  return relative === '' ||
    (!path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`));
}

function relativePath(root, target) {
  if (!isInsideRoot(root, target)) {
    throw new CheckError('Path escapes repository root.', 'PATH_ESCAPE');
  }

  return path.relative(root, target).split(path.sep).join('/');
}

function isProtected(relative) {
  return relative.split('/').filter(Boolean).some((segment) => {
    const name = segment.toLowerCase();

    return PROTECTED_SEGMENTS.has(name) ||
      name === '.env' ||
      name.startsWith('.env.');
  });
}

function addResult(results, options, result) {
  if (results.length >= options.maxFiles) return;

  results.push({
    check: result.check,
    status: result.status || 'fail',
    severity: result.severity || 'medium',
    path: result.path || '',
    message: result.message,
    ...(result.details ? { details: result.details } : {})
  });
}

function listFiles(root, options, results) {
  const files = [];
  const visited = new Set();
  let totalBytes = 0;
  let truncated = false;

  function walk(directory, depth) {
    if (truncated) return;

    if (depth > options.maxDepth) {
      addResult(results, options, {
        check: 'inventory.depth',
        status: 'warn',
        severity: 'low',
        path: relativePath(root, directory),
        message: 'Maximum directory depth reached.'
      });
      return;
    }

    let realDirectory;

    try {
      realDirectory = fs.realpathSync(directory);
    } catch {
      addResult(results, options, {
        check: 'inventory.directory',
        status: 'warn',
        path: relativePath(root, directory),
        message: 'Directory could not be resolved.'
      });
      return;
    }

    if (!isInsideRoot(root, realDirectory) || visited.has(realDirectory)) {
      return;
    }

    visited.add(realDirectory);

    let entries;

    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      addResult(results, options, {
        check: 'inventory.read',
        status: 'warn',
        path: relativePath(root, directory),
        message: 'Directory could not be listed.'
      });
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (truncated) return;

      if (entry.name.startsWith('.')) continue;

      const absolute = path.join(directory, entry.name);
      const rel = relativePath(root, absolute);

      if (isProtected(rel)) continue;

      let stat;

      try {
        stat = fs.lstatSync(absolute);
      } catch {
        addResult(results, options, {
          check: 'inventory.stat',
          status: 'warn',
          path: rel,
          message: 'File metadata could not be read.'
        });
        continue;
      }

      if (stat.isSymbolicLink()) {
        let target;

        try {
          target = fs.realpathSync(absolute);
        } catch {
          addResult(results, options, {
            check: 'inventory.symlink',
            status: 'warn',
            severity: 'low',
            path: rel,
            message: 'Broken or inaccessible symbolic link skipped.'
          });
          continue;
        }

        if (!isInsideRoot(root, target)) {
          addResult(results, options, {
            check: 'security.symlink',
            status: 'fail',
            severity: 'high',
            path: rel,
            message: 'Symbolic link escapes the repository root.'
          });
        }

        // Do not follow symlinks, even when they point inside the root.
        continue;
      }

      if (stat.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
        walk(absolute, depth + 1);
        continue;
      }

      if (!stat.isFile()) continue;

      if (files.length >= options.maxFiles) {
        truncated = true;
        addResult(results, options, {
          check: 'inventory.limit',
          status: 'warn',
          severity: 'low',
          path: rel,
          message: 'Maximum file count reached; inventory is incomplete.'
        });
        return;
      }

      files.push({
        path: rel,
        extension: path.extname(entry.name).toLowerCase(),
        size: stat.size
      });

      if (stat.size > options.maxFileBytes) {
        addResult(results, options, {
          check: 'file.size',
          status: 'warn',
          severity: 'low',
          path: rel,
          message: 'File exceeds the content-inspection size limit.'
        });
        continue;
      }

      if (totalBytes + stat.size > options.maxTotalBytes) {
        truncated = true;
        addResult(results, options, {
          check: 'inventory.byte-limit',
          status: 'warn',
          severity: 'low',
          path: rel,
          message: 'Total content-inspection byte limit reached.'
        });
        continue;
      }

      totalBytes += stat.size;
    }
  }

  walk(root, 0);

  return { files, totalBytes, truncated };
}

function readEligibleText(root, relative, maxBytes) {
  if (isProtected(relative)) {
    throw new CheckError('Protected paths cannot be inspected.', 'PROTECTED_PATH');
  }

  const absolute = path.resolve(root, relative);

  if (!isInsideRoot(root, absolute)) {
    throw new CheckError('Path escapes repository root.', 'PATH_ESCAPE');
  }

  const real = fs.realpathSync(absolute);

  if (!isInsideRoot(root, real)) {
    throw new CheckError('Resolved path escapes repository root.', 'PATH_ESCAPE');
  }

  const stat = fs.statSync(real);

  if (!stat.isFile() || stat.size > maxBytes) {
    throw new CheckError('File is not eligible for inspection.', 'FILE_LIMIT');
  }

  const buffer = fs.readFileSync(real);

  if (buffer.includes(0)) return null;

  return buffer.toString('utf8');
}

function checkRequiredPaths(root, options, results) {
  if (!options.checkRequiredFiles) return;

  for (const relative of REQUIRED_FILES) {
    const absolute = path.join(root, relative);
    const exists = fs.existsSync(absolute);

    addResult(results, options, {
      check: 'repository.required-file',
      status: exists && fs.statSync(absolute).isFile() ? 'pass' : 'fail',
      severity: 'medium',
      path: relative,
      message: exists
        ? 'Required file exists.'
        : 'Required file is missing.'
    });
  }

  for (const relative of REQUIRED_DIRECTORIES) {
    const absolute = path.join(root, relative);
    const exists = fs.existsSync(absolute);

    addResult(results, options, {
      check: 'repository.required-directory',
      status: exists && fs.statSync(absolute).isDirectory() ? 'pass' : 'fail',
      severity: 'medium',
      path: relative,
      message: exists
        ? 'Required directory exists.'
        : 'Required directory is missing.'
    });
  }
}

function checkJsonFiles(root, files, options, results) {
  if (!options.checkJson) return;

  for (const file of files) {
    if (file.extension !== '.json') continue;

    let content;

    try {
      content = readEligibleText(root, file.path, options.maxFileBytes);
    } catch {
      continue;
    }

    if (content === null) continue;

    try {
      JSON.parse(content);
      addResult(results, options, {
        check: 'syntax.json',
        status: 'pass',
        severity: 'low',
        path: file.path,
        message: 'Valid JSON.'
      });
    } catch (error) {
      addResult(results, options, {
        check: 'syntax.json',
        status: 'fail',
        severity: 'high',
        path: file.path,
        message: 'Invalid JSON syntax.',
        details: error.message.slice(0, 300)
      });
    }
  }
}

function checkPackageJson(root, files, options, results) {
  const packageFile = files.find((file) => file.path === 'package.json');

  if (!packageFile) return;

  let packageJson;

  try {
    const content = readEligibleText(root, packageFile.path, options.maxFileBytes);
    if (content === null) throw new Error('package.json appears to be binary.');
    packageJson = JSON.parse(content);
  } catch (error) {
    addResult(results, options, {
      check: 'package.json',
      status: 'fail',
      severity: 'high',
      path: 'package.json',
      message: 'package.json cannot be parsed.',
      details: error.message.slice(0, 300)
    });
    return;
  }

  const validName = typeof packageJson.name === 'string' &&
    packageJson.name.trim().length > 0;

  addResult(results, options, {
    check: 'package.name',
    status: validName ? 'pass' : 'warn',
    severity: 'low',
    path: 'package.json',
    message: validName
      ? 'Package name is declared.'
      : 'Package name is missing or invalid.'
  });

  const validScripts = packageJson.scripts === undefined ||
    (packageJson.scripts !== null &&
      typeof packageJson.scripts === 'object' &&
      !Array.isArray(packageJson.scripts));

  addResult(results, options, {
    check: 'package.scripts',
    status: validScripts ? 'pass' : 'fail',
    severity: 'medium',
    path: 'package.json',
    message: validScripts
      ? 'Scripts configuration has a valid shape.'
      : 'Scripts must be an object.'
  });

  const engines = packageJson.engines;
  const nodeEngine = engines && typeof engines.node === 'string';

  addResult(results, options, {
    check: 'package.node-engine',
    status: nodeEngine ? 'pass' : 'warn',
    severity: 'low',
    path: 'package.json',
    message: nodeEngine
      ? `Node.js engine declared: ${engines.node}`
      : 'Node.js engine is not declared.'
  });

  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };

  for (const [name, version] of Object.entries(dependencies)) {
    if (typeof version !== 'string') {
      addResult(results, options, {
        check: 'package.dependency-version',
        status: 'fail',
        severity: 'medium',
        path: 'package.json',
        message: `Dependency "${name}" has an invalid version declaration.`
      });
    }
  }
}

function runSyntaxCheck(executable, args, options, relativePathValue) {
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    timeout: options.timeoutMs,
    maxBuffer: options.maxCommandOutputBytes,
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    return {
      status: result.error.code === 'ENOENT' ? 'skip' : 'fail',
      message: result.error.code === 'ENOENT'
        ? `${executable} is not installed or not available on PATH.`
        : `Syntax check could not run: ${result.error.message.slice(0, 200)}`
    };
  }

  if (result.signal || result.status === null) {
    return {
      status: 'fail',
      message: 'Syntax check timed out or was terminated.'
    };
  }

  if (result.status === 0) {
    return { status: 'pass', message: 'Syntax check passed.' };
  }

  const output = `${result.stderr || ''}\n${result.stdout || ''}`
    .trim()
    .slice(0, 500);

  return {
    status: 'fail',
    message: output || `Syntax check failed for ${relativePathValue}.`
  };
}

function checkJavaScriptFiles(root, files, options, results) {
  if (!options.checkJavaScript) return;

  for (const file of files) {
    if (!['.js', '.cjs', '.mjs'].includes(file.extension)) continue;

    let absolute;

    try {
      absolute = path.resolve(root, file.path);

      if (!isInsideRoot(root, absolute)) {
        throw new CheckError('Path escapes root.', 'PATH_ESCAPE');
      }

      const real = fs.realpathSync(absolute);

      if (!isInsideRoot(root, real)) {
        throw new CheckError('Resolved path escapes root.', 'PATH_ESCAPE');
      }
    } catch {
      addResult(results, options, {
        check: 'syntax.javascript',
        status: 'fail',
        severity: 'high',
        path: file.path,
        message: 'File path could not be safely resolved.'
      });
      continue;
    }

    const result = runSyntaxCheck(
      process.execPath,
      ['--check', absolute],
      options,
      file.path
    );

    addResult(results, options, {
      check: 'syntax.javascript',
      status: result.status,
      severity: result.status === 'fail' ? 'high' : 'low',
      path: file.path,
      message: result.message
    });
  }
}

function checkPythonFiles(root, files, options, results) {
  if (!options.checkPython) return;

  const script = [
    'import ast, pathlib, sys',
    'p = pathlib.Path(sys.argv[1])',
    'ast.parse(p.read_text(encoding="utf-8"), filename=str(p))'
  ].join('; ');

  for (const file of files) {
    if (file.extension !== '.py') continue;

    const absolute = path.resolve(root, file.path);

    if (!isInsideRoot(root, absolute)) continue;

    let real;

    try {
      real = fs.realpathSync(absolute);
    } catch {
      continue;
    }

    if (!isInsideRoot(root, real)) continue;

    let executable = process.env.PYTHON || process.env.PYTHON3 || 'python3';
    let result = runSyntaxCheck(
      executable,
      ['-I', '-c', script, absolute],
      options,
      file.path
    );

    if (result.status === 'skip' && process.platform === 'win32') {
      executable = 'python';
      result = runSyntaxCheck(
        executable,
        ['-I', '-c', script, absolute],
        options,
        file.path
      );
    }

    addResult(results, options, {
      check: 'syntax.python',
      status: result.status,
      severity: result.status === 'fail' ? 'high' : 'low',
      path: file.path,
      message: result.message
    });
  }
}

function checkSecurityIndicators(files, options, results) {
  if (!options.checkSecurityIndicators) return;

  const riskyNames = /(^|\/)(\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.json)?|service-account(?:\.json)?)$/i;

  for (const file of files) {
    if (!riskyNames.test(file.path)) continue;

    addResult(results, options, {
      check: 'security.sensitive-file',
      status: 'warn',
      severity: 'medium',
      path: file.path,
      message: 'Potentially sensitive file name detected. File contents were not inspected.',
      details: 'Verify that this file contains no committed credentials and is appropriately ignored.'
    });
  }

  const envExample = files.find((file) => file.path === '.env.example');

  if (!envExample) {
    addResult(results, options, {
      check: 'security.env-example',
      status: 'info',
      severity: 'low',
      path: '.env.example',
      message: 'No .env.example file was inventoried; this is informational.'
    });
  }
}

function summarize(results) {
  const summary = {
    total: results.length,
    pass: 0,
    fail: 0,
    warn: 0,
    skip: 0,
    info: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }
  };

  for (const result of results) {
    if (Object.prototype.hasOwnProperty.call(summary, result.status)) {
      summary[result.status] += 1;
    }

    if (Object.prototype.hasOwnProperty.call(summary.bySeverity, result.severity)) {
      summary.bySeverity[result.severity] += 1;
    }
  }

  return summary;
}

function checkRepository(rootPath, inputOptions = {}) {
  const options = validateOptions(inputOptions);
  const root = canonicalRoot(rootPath);
  const results = [];

  checkRequiredPaths(root, options, results);

  const inventory = listFiles(root, options, results);

  checkPackageJson(root, inventory.files, options, results);
  checkJsonFiles(root, inventory.files, options, results);
  checkJavaScriptFiles(root, inventory.files, options, results);
  checkPythonFiles(root, inventory.files, options, results);
  checkSecurityIndicators(inventory.files, options, results);

  results.sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.check.localeCompare(b.check)
  );

  return {
    version: CHECK_VERSION,
    generatedAt: new Date().toISOString(),
    root,
    mode: 'read-only',
    inventory: {
      files: inventory.files.length,
      inspectedBytesBudget: inventory.totalBytes,
      truncated: inventory.truncated
    },
    summary: summarize(results),
    results
  };
}

function formatReport(report) {
  if (!report || typeof report !== 'object' || !report.summary) {
    throw new CheckError('A valid check report is required.', 'INVALID_REPORT');
  }

  const lines = [
    `MedOrbits Repository Check v${report.version}`,
    `Root: ${report.root}`,
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    '',
    `Files inventoried: ${report.inventory.files}`,
    `Checks: ${report.summary.total}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Warnings: ${report.summary.warn}`,
    `Skipped: ${report.summary.skip}`,
    '',
    'Results'
  ];

  for (const result of report.results) {
    lines.push(
      `[${result.status.toUpperCase()}] ${result.check} ${result.path}`,
      `  ${result.message}`
    );

    if (result.details) {
      lines.push(`  Details: ${result.details}`);
    }
  }

  return lines.join('\n');
}

function parseArguments(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new CheckError('Arguments must be an array of strings.', 'INVALID_ARGUMENTS');
  }

  let root = process.env.MEDORBITS_REPO_ROOT || process.cwd();
  const options = {};
  let output = 'text';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--root') {
      if (!args[index + 1]) {
        throw new CheckError('--root requires a path.', 'INVALID_ARGUMENTS');
      }
      root = args[++index];
    } else if (arg === '--max-files') {
      options.maxFiles = Number(args[++index]);
    } else if (arg === '--max-depth') {
      options.maxDepth = Number(args[++index]);
    } else if (arg === '--timeout') {
      options.timeoutMs = Number(args[++index]);
    } else if (arg === '--no-js') {
      options.checkJavaScript = false;
    } else if (arg === '--no-python') {
      options.checkPython = false;
    } else if (arg === '--no-json') {
      options.checkJson = false;
    } else if (arg === '--no-security') {
      options.checkSecurityIndicators = false;
    } else if (arg === '--json') {
      output = 'json';
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, root, options, output };
    } else {
      throw new CheckError(`Unknown argument: ${arg}`, 'INVALID_ARGUMENTS');
    }
  }

  return { help: false, root, options, output };
}

function printHelp() {
  return [
    'Usage: node local-agent/src/commands/check.js [options]',
    '',
    'Options:',
    '  --root <path>      Repository root',
    '  --max-files <n>    Maximum inventory file count',
    '  --max-depth <n>    Maximum directory traversal depth',
    '  --timeout <ms>     Per-file syntax-check timeout',
    '  --no-js            Skip JavaScript syntax checks',
    '  --no-python        Skip Python syntax checks',
    '  --no-json          Skip JSON syntax checks',
    '  --no-security      Skip sensitive filename indicators',
    '  --json             Print JSON report',
    '  --help, -h         Show this help',
    '',
    'This command is read-only and does not install packages or run project code.'
  ].join('\n');
}

function runCheckCommand(args = process.argv.slice(2), dependencies = {}) {
  const logger = dependencies.logger || console;
  const parsed = parseArguments(args);

  if (parsed.help) {
    logger.log(printHelp());
    return { exitCode: 0, help: true };
  }

  const report = checkRepository(parsed.root, parsed.options);

  logger.log(
    parsed.output === 'json'
      ? JSON.stringify(report, null, 2)
      : formatReport(report)
  );

  return {
    exitCode: report.summary.fail > 0 ? 1 : 0,
    report
  };
}

if (require.main === module) {
  try {
    const result = runCheckCommand();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`[check] ${error.code || 'ERROR'}: ${error.message}`);
    process.exitCode = 2;
  }
}

module.exports = {
  CHECK_VERSION,
  CheckError,
  DEFAULTS,
  REQUIRED_FILES,
  REQUIRED_DIRECTORIES,
  isInsideRoot,
  validateOptions,
  checkRepository,
  formatReport,
  parseArguments,
  printHelp,
  runCheckCommand
};
